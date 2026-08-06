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
    .select("patient_name, rut, certificate_issued_at")
    .eq("token", token)
    .single();

  if (!conv || !conv.certificate_issued_at) {
    return new Response("Certificado no disponible", { status: 404 });
  }

  // The certificate names the registered patient (the child); patient_name/rut are that identity.
  const { patient_name: name, rut } = conv;

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
