import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Load a conversation and its transcript by token (the token is the access secret; no login).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, patient_name, status, certificate_issued_at")
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

  return NextResponse.json({
    patientName: conversation.patient_name,
    status: conversation.status,
    certificateAvailable: conversation.certificate_issued_at != null,
    // Only user/assistant turns are shown in the chat (nurse replies are Slice 2).
    messages: (messages ?? []).filter((m) => m.role !== "nurse"),
  });
}
