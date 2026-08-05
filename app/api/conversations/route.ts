import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isValidRut, formatRut } from "@/lib/rut";

// Create a conversation from the entry form (nombre + RUT). Returns the re-entry token.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { name, rut } = (body ?? {}) as { name?: unknown; rut?: unknown };

  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }
  if (typeof rut !== "string" || !isValidRut(rut)) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }

  // The patient's anonymous session owns the conversation (powers Realtime via RLS).
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  const token = crypto.randomUUID();
  const supabase = createServiceClient();
  const { error } = await supabase.from("conversations").insert({
    token,
    patient_name: name.trim(),
    rut: formatRut(rut),
    status: "ai_active",
    owner_id: user?.id ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo crear la conversación" },
      { status: 500 },
    );
  }
  return NextResponse.json({ token });
}
