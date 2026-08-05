import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { systemPrompt, escalateTool } from "@/lib/prompts";
import { createServiceClient } from "@/lib/supabase/service";

type Priority = "urgent" | "normal" | "informative";
const PRIORITIES: Priority[] = ["urgent", "normal", "informative"];

// NDJSON stream: one JSON object per line.
// { type: "text", text }  incremental assistant text
// { type: "escalated" }   the case was escalated to a nurse
// { type: "error", text } something failed
function line(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: Request) {
  const { token, message } = (await request.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
  };
  if (!token || typeof message !== "string" || !message.trim()) {
    return new Response("Solicitud inválida", { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, patient_name, status")
    .eq("token", token)
    .single();
  if (!conv) return new Response("No encontrado", { status: 404 });

  // Persist the user's message first so it's part of the transcript and the model context.
  await supabase
    .from("messages")
    .insert({ conversation_id: conv.id, role: "user", content: message });

  // Once escalated, a human is handling it — don't let the AI keep answering. (Slice 1: no AI after escalation.)
  if (conv.status === "escalated") {
    const text =
      "Tu caso ya está en revisión por una enfermera. Te contactaremos a la brevedad.";
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(line({ type: "text", text }));
          c.close();
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } },
    );
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  const messages: Anthropic.MessageParam[] = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      try {
        const ai = getAnthropic().messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt({ name: conv.patient_name }),
          tools: [escalateTool],
          messages,
        });

        ai.on("text", (delta) => {
          assistantText += delta;
          controller.enqueue(line({ type: "text", text: delta }));
        });

        const final = await ai.finalMessage();
        const toolUse = final.content.find(
          (b): b is Anthropic.ToolUseBlock =>
            b.type === "tool_use" && b.name === "escalate",
        );

        if (toolUse) {
          const input = toolUse.input as { priority?: string; summary?: string };
          const priority: Priority = PRIORITIES.includes(input.priority as Priority)
            ? (input.priority as Priority)
            : "normal";
          const summary = input.summary ?? "";

          await supabase
            .from("alerts")
            .insert({ conversation_id: conv.id, priority, status: "active" });
          await supabase
            .from("conversations")
            .update({ summary, status: "escalated", updated_at: new Date().toISOString() })
            .eq("id", conv.id);

          const notice = assistantText.trim()
            ? "\n\nUna enfermera revisará tu caso y te contactará pronto."
            : "Gracias. Una enfermera revisará tu caso y te contactará pronto.";
          assistantText += notice;
          controller.enqueue(line({ type: "text", text: notice }));
          controller.enqueue(line({ type: "escalated" }));
        }

        if (assistantText.trim()) {
          await supabase.from("messages").insert({
            conversation_id: conv.id,
            role: "assistant",
            content: assistantText,
          });
        }
      } catch {
        controller.enqueue(
          line({ type: "error", text: "Ocurrió un error. Intenta nuevamente." }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
