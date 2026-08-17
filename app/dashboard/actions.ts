"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidRut, formatRut } from "@/lib/rut";
import { parseMedications } from "@/lib/patient-record";
import { KB_MAX_CHARS, knowledgeLength } from "@/lib/knowledge-base";

const PRIORITIES = ["urgent", "normal", "informative"];

// Blank stays blank: an empty ficha field must be null, never "".
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

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

// Save the ficha de seguimiento. Fields left blank are stored as null, which is what keeps the AI
// from ever asserting their absence: renderRecordForPrompt omits them, so the model can't see them.
// See docs/adr/0007-per-patient-verbatim-record.md.
export async function updatePatientRecord(formData: FormData) {
  const supabase = await requireNurse();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) throw new Error("Paciente inválido");

  // The client sends an ISO instant already, converted from the datetime-local input against
  // America/Santiago (see fromSantiagoLocal), not against whatever zone the browser is in.
  const at = String(formData.get("nextAppointmentAt") ?? "").trim();
  const when = at ? new Date(at) : null;
  if (when && Number.isNaN(when.getTime())) throw new Error("Fecha de control inválida");

  const { data, error } = await supabase
    .from("patients")
    .update({
      next_appointment_at: when ? when.toISOString() : null,
      next_appointment_place: text(formData.get("nextAppointmentPlace")),
      medications: parseMedications(formData.get("medications")),
      allergies: text(formData.get("allergies")),
      restrictions: text(formData.get("restrictions")),
      record_source: "manual",
      record_synced_at: null,
    })
    .eq("id", patientId)
    .select("id");
  // An UPDATE that matches no row is not an error in Postgres: a deleted patient, a tampered id, or
  // an anonymous session filtered out by RLS all land here. Without this the action returns cleanly
  // and the nurse keeps looking at the medications she typed, believing the ficha saved.
  if (error || !data?.length) throw new Error("No se pudo guardar la ficha");

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients"); // the list shows "Completar ficha" vs "Ver ficha"
}

// Publica una versión de la base de conocimiento. Es lo que reemplaza al PR como gate de aprobación
// (ver docs/adr/0009-base-de-conocimiento-fuera-de-git.md): cada publicación es una fila nueva, firmada
// y con fecha, en una tabla sin update ni delete.
//
// La autorización real NO está acá sino en RLS: solo un usuario con app_metadata.can_publish_kb puede
// insertar. Este server action, como el resto del archivo, delega en la política y trata el insert sin
// filas como fallo — la enfermera que triage avisos puede abrir esta pantalla, pero no publicar.
export async function publishKnowledge(formData: FormData) {
  const supabase = await requireNurse();
  const version = {
    operational: String(formData.get("operational") ?? ""),
    clinical_added: String(formData.get("clinicalAdded") ?? ""),
    red_flags_added: String(formData.get("redFlagsAdded") ?? ""),
  };
  // Sin firma no es una publicación: el nombre de quien aprueba es el equivalente al autor del PR.
  const signedBy = String(formData.get("signedBy") ?? "").trim();
  if (!signedBy) throw new Error("Falta el nombre de quien aprueba el contenido");

  if (knowledgeLength(version) > KB_MAX_CHARS) {
    throw new Error(`El contenido supera el máximo de ${KB_MAX_CHARS} caracteres`);
  }

  const { data, error } = await supabase
    .from("knowledge_versions")
    .insert({ ...version, signed_by: signedBy })
    .select("id");
  // Mismo patrón que updatePatientRecord: RLS filtra sin devolver error, así que 0 filas = no publicó.
  // Sin esto el editor se queda mirando el texto que escribió, creyendo que quedó publicado.
  if (error || !data?.length) {
    throw new Error("No se pudo publicar. ¿Tu cuenta tiene permiso para publicar contenido?");
  }

  revalidatePath("/dashboard/knowledge");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/dashboard/login");
}
