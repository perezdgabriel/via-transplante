import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordFields, type PatientRecord } from "@/lib/patient-record";
import { getTenant } from "@/lib/tenants";

// Load a conversation and its transcript by token (the token is the access secret; no login).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tenant = getTenant(request.headers.get("host"));
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const supabase = createServiceClient(tenant);

  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      "id, patient_name, status, certificate_issued_at, patients(next_appointment_at, next_appointment_place, medications, allergies, restrictions, record_source, record_synced_at)",
    )
    .eq("token", token)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  // No generated Supabase types here; the to-one join comes back as an object, but accept an array
  // too so a shape surprise doesn't silently drop the ficha from the family's card.
  const joined = (conversation as unknown as { patients: PatientRecord | PatientRecord[] | null })
    .patients;
  const record = Array.isArray(joined) ? (joined[0] ?? null) : joined;

  return NextResponse.json({
    id: conversation.id,
    patientName: conversation.patient_name,
    status: conversation.status,
    certificateAvailable: conversation.certificate_issued_at != null,
    // Computed here, not on the device: the card and the model's system block must agree on both
    // the code path (recordFields) and the clock, or the card can show a control the AI has already
    // dropped as past. A family device with a wrong date must not change what the ficha says.
    recordFields: recordFields(record),
    messages: messages ?? [],
  });
}
