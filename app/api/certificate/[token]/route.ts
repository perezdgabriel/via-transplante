import { createServiceClient } from "@/lib/supabase/service";
import { buildCertificatePdf } from "@/lib/certificate";

// Serves the school-attendance PDF for a conversation. Gated on the assistant having issued it
// (certificate_issued_at set by the generate_certificate tool). Token is the access secret.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("patient_name, rut, certificate_name, certificate_rut, certificate_issued_at")
    .eq("token", token)
    .single();

  if (!conv || !conv.certificate_issued_at) {
    return new Response("Certificado no disponible", { status: 404 });
  }

  // Prefer the student identity the tool collected; fall back to the account holder for
  // certificates issued before that was captured.
  const name = conv.certificate_name ?? conv.patient_name;
  const rut = conv.certificate_rut ?? conv.rut;

  const pdf = await buildCertificatePdf({
    name,
    rut,
    date: new Date(conv.certificate_issued_at),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-${rut}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
