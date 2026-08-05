import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { systemPrompt, escalateTool, generateCertificateTool } from "@/lib/prompts";
import { entregarFolletoTool, getFolleto } from "@/lib/folletos";
import { createServiceClient } from "@/lib/supabase/service";

type Priority = "urgent" | "normal" | "informative";
const PRIORITIES: Priority[] = ["urgent", "normal", "informative"];

// NDJSON stream: one JSON object per line.
// { type: "text", text }  incremental assistant text
// { type: "escalated" }   the case was escalated to a nurse
// { type: "certificate" } a school certificate is ready to download
// { type: "folleto", id, title, url }  a folleto was delivered (url may be null until the PDF exists)
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

  // Once escalated, a nurse is handling it — the user's message is delivered to her (persisted above);
  // the AI stays silent so it doesn't talk over the nurse. No stream body.
  if (conv.status === "escalated") {
    return new Response(
      new ReadableStream({
        start(c) {
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
          // Prompt caching: the big static prompt (tools + KB + rules) is the cached prefix, identical
          // across all patients. The patient name goes in a second, uncached block after the breakpoint,
          // so it doesn't invalidate the shared prefix. Cache hits within a conversation (turns 2+) and
          // across patients. Note: caches on Sonnet (min 1024 tok); Haiku's min is 4096, so it may not.
          system: [
            {
              type: "text",
              text: systemPrompt(),
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: `Estás hablando con: ${conv.patient_name}.` },
          ],
          tools: [escalateTool, generateCertificateTool, entregarFolletoTool],
          messages,
        });

        ai.on("text", (delta) => {
          assistantText += delta;
          controller.enqueue(line({ type: "text", text: delta }));
        });

        const final = await ai.finalMessage();
        const toolUse = final.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );

        if (toolUse?.name === "escalate") {
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
        } else if (toolUse?.name === "generate_certificate") {
          await supabase
            .from("conversations")
            .update({
              certificate_issued_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", conv.id);

          const notice = assistantText.trim()
            ? "\n\nTu certificado de asistencia está listo: puedes descargarlo con el botón de abajo."
            : "Tu certificado de asistencia está listo: puedes descargarlo con el botón de abajo.";
          assistantText += notice;
          controller.enqueue(line({ type: "text", text: notice }));
          controller.enqueue(line({ type: "certificate" }));
        } else if (toolUse?.name === "entregar_folleto") {
          // The AI only picks an id; the server owns title+url so a link can't be fabricated.
          const id = (toolUse.input as { folleto_id?: string }).folleto_id ?? "";
          const folleto = getFolleto(id);
          if (folleto) {
            const notice = `\n\n📄 ${folleto.title}`;
            assistantText += notice;
            controller.enqueue(line({ type: "text", text: notice }));
            controller.enqueue(
              line({ type: "folleto", id: folleto.id, title: folleto.title, url: folleto.url }),
            );
          }
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
