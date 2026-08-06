"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidRut, formatRut } from "@/lib/rut";

const PRIORITIES = ["urgent", "normal", "informative"];

async function requireNurse() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return supabase;
}

export async function reclassifyPriority(formData: FormData) {
  const supabase = await requireNurse();
  const alertId = String(formData.get("alertId"));
  const priority = String(formData.get("priority"));
  if (!PRIORITIES.includes(priority)) throw new Error("Prioridad inválida");

  await supabase.from("alerts").update({ priority }).eq("id", alertId);
  revalidatePath("/dashboard");
}

export async function resolveAlert(formData: FormData) {
  const supabase = await requireNurse();
  const alertId = String(formData.get("alertId"));
  const conversationId = String(formData.get("conversationId"));
  const note = String(formData.get("note") ?? "").trim();

  await supabase
    .from("alerts")
    .update({
      status: "resolved",
      internal_note: note || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", alertId);
  await supabase
    .from("conversations")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath("/dashboard");
}

export async function replyToUser(formData: FormData) {
  const supabase = await requireNurse();
  const conversationId = String(formData.get("conversationId"));
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "nurse", content });
  revalidatePath("/dashboard");
}

// Register a patient (the child) at discharge and mint its magic-link token. The family opens
// /p/<token> to chat; the link is bound to this patient, so identity is captured once, by the nurse.
export async function registerPatient(formData: FormData) {
  const supabase = await requireNurse();
  const name = String(formData.get("name") ?? "").trim();
  const rut = String(formData.get("rut") ?? "");
  if (name.length < 2) throw new Error("Nombre inválido");
  if (!isValidRut(rut)) throw new Error("RUT inválido");

  const { error } = await supabase
    .from("patients")
    .insert({ token: crypto.randomUUID(), name, rut: formatRut(rut) });
  if (error) throw new Error("No se pudo registrar al paciente");
  revalidatePath("/dashboard/patients");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/dashboard/login");
}
