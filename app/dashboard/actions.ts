"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/dashboard/login");
}
