import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { systemPrompt, escalateTool, generateCertificateTool } from "@/lib/prompts";
import { entregarFolletoTool, getFolleto } from "@/lib/folletos";
import { createServiceClient } from "@/lib/supabase/service";
import { renderRecordForPrompt, todayInChile, type PatientRecord } from "@/lib/patient-record";
import { getTenant } from "@/lib/tenants";
import { EMPTY_KNOWLEDGE, type TenantKnowledge } from "@/lib/knowledge-base";

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

  const tenant = getTenant(request.headers.get("host"));
  if (!tenant) return new Response("No encontrado", { status: 404 });

  const supabase = createServiceClient(tenant);
  // The ficha is read LIVE through patient_id, not snapshotted like patient_name/rut: a stale
  // record is the failure mode this feature is designed against. patient_id is null on
  // conversations created before 0006 -> no ficha -> the AI escalates, same as an empty one.
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, patient_name, status, patients(next_appointment_at, next_appointment_place, medications, allergies, restrictions)",
    )
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

  // La BdC vigente es la última versión publicada. Se lee en paralelo con la transcripción para no
  // agregar latencia serial a cada turno. Sin versiones publicadas (hospital recién dado de alta) se
  // usa la vacía: la IA queda con el baseline clínico y escala toda pregunta operativa, que es el
  // modo de falla correcto — nunca inventa horarios ni recita los de otro hospital.
  const [{ data: history }, { data: publishedKb, error: kbError }] = await Promise.all([
    supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("knowledge_versions")
      .select("operational, clinical_added, red_flags_added")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  // Una caída transitoria de esta lectura es indistinguible de "todavía no publican nada": en ambos
  // casos el asistente pierde la BdC operativa y dice que no tiene la información. Se registra para
  // poder distinguir el bug del caso legítimo; degradar a escalar sigue siendo lo correcto.
  if (kbError) console.error("knowledge_versions read failed", kbError);
  const kb: TenantKnowledge = publishedKb ?? EMPTY_KNOWLEDGE;

  const messages: Anthropic.MessageParam[] = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  // Per-patient system block. No generated Supabase types in this repo, so cast the join; accept an
  // array too, because getting the shape wrong here fails silently (the model just never sees a ficha).
  const joined = (conv as unknown as { patients: PatientRecord | PatientRecord[] | null }).patients;
  const record = Array.isArray(joined) ? (joined[0] ?? null) : joined;
  const now = new Date();
  const ficha = renderRecordForPrompt(record, now);
  const patientBlock =
    `Hoy es ${todayInChile(now)}.\nEl paciente es: ${conv.patient_name}.` +
    (ficha ? `\n\n${ficha}` : "");

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      try {
        const ai = getAnthropic().messages.stream({
          model: MODEL,
          max_tokens: 1024,
          // Prompt caching: the big prompt (tools + KB + rules, including the rules ABOUT the ficha)
          // is the cached prefix, identical across all patients OF THIS HOSPITAL. Per-patient data —
          // today's date, the name, and the ficha itself — goes in a second, uncached block after the
          // breakpoint, so it doesn't invalidate the shared prefix. Cache hits within a conversation
          // (turns 2+) and across patients. Con la BdC por tenant el prefijo dejó de ser global, pero
          // sigue siendo compartido por todo el tráfico de un hospital, que es donde importa; publicar
          // una versión lo invalida, y eso pasa poco. Note: caches on Sonnet (min 1024 tok); Haiku's
          // min is 4096, so it may not.
          system: [
            {
              type: "text",
              text: systemPrompt(tenant, kb),
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: patientBlock },
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
          // Certificate names the registered patient (the child) — already on the conversation, so the
          // tool only marks it issued. No identity is collected mid-chat.
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
