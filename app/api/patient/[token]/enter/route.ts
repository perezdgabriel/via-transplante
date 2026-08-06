import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// Resolve a patient magic-link into a chat. The patient's identity is already known (the nurse
// registered it at discharge), so nothing is asked here: resume the open consulta if there is one
// (one open per patient), otherwise start a fresh one pre-bound to the patient.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // `new: true` = the user pressed "Nueva consulta" to start a fresh topic (also bounds AI context).
  const body = (await request.json().catch(() => ({}))) as { new?: boolean };
  const forceNew = body.new === true;
  const supabase = createServiceClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, rut")
    .eq("token", token)
    .single();
  if (!patient) {
    return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
  }

  // The anonymous session owns the conversation (powers patient Realtime via RLS). Point ownership at
  // whichever device is opening the link now, so Realtime works on the currently-active device.
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  const { data: open } = await supabase
    .from("conversations")
    .select("token, status")
    .eq("patient_id", patient.id)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    // "Nueva consulta" closes the current AI consulta and falls through to create a fresh one.
    // Never abandon an escalated thread this way — a nurse is handling it; just resume it.
    if (forceNew && open.status === "ai_active") {
      await supabase
        .from("conversations")
        .update({ status: "resolved", updated_at: new Date().toISOString() })
        .eq("token", open.token);
    } else {
      if (user) {
        await supabase
          .from("conversations")
          .update({ owner_id: user.id })
          .eq("token", open.token);
      }
      return NextResponse.json({ token: open.token });
    }
  }

  const convToken = crypto.randomUUID();
  const { error } = await supabase.from("conversations").insert({
    token: convToken,
    patient_id: patient.id,
    patient_name: patient.name, // denormalized snapshot; keeps chat/certificate/dashboard join-free
    rut: patient.rut,
    status: "ai_active",
    owner_id: user?.id ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "No se pudo iniciar" }, { status: 500 });
  }
  return NextResponse.json({ token: convToken });
}
