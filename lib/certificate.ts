import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// School-attendance certificate. Contains ONLY name, RUT and date — no diagnosis or sensitive data.
// El nombre del hospital viene del tenant: es un documento que sale del edificio con el nombre de una
// institución encima, así que no puede quedar hardcodeado ni traer un valor por defecto.
// ponytail: la redacción exacta sigue pendiente de acordar con el equipo (igual que el prompt).

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildCertificatePdf(opts: {
  name: string;
  rut: string;
  date: Date;
  hospitalName: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 64;
  const maxWidth = width - margin * 2;
  const ink = rgb(0.1, 0.1, 0.1);

  const fecha = opts.date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const emitido = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let y = 760;
  // Se envuelve como el resto del texto: el nombre lo pone el operador por tenant, y los nombres
  // oficiales chilenos son largos ("Hospital de Niños Dr. Roberto del Río — Servicio de Salud
  // Metropolitano Norte"). Sin envolver se recortaría en silencio en cada certificado emitido.
  for (const l of wrap(opts.hospitalName, bold, 16, maxWidth)) {
    page.drawText(l, { x: margin, y, size: 16, font: bold, color: ink });
    y -= 22;
  }
  y -= 38;
  page.drawText("Certificado de Asistencia", { x: margin, y, size: 22, font: bold, color: ink });
  y -= 50;

  const body =
    `Se certifica que ${opts.name}, RUT ${opts.rut}, fue atendido/a en este ` +
    `establecimiento con fecha ${fecha}.`;
  for (const l of wrap(body, font, 13, maxWidth)) {
    page.drawText(l, { x: margin, y, size: 13, font, color: ink });
    y -= 22;
  }

  y -= 20;
  const note = "Este documento contiene únicamente nombre, RUT y fecha. No incluye información clínica ni datos sensibles.";
  for (const l of wrap(note, font, 10, maxWidth)) {
    page.drawText(l, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 16;
  }

  page.drawText(`Emitido el ${emitido}.`, {
    x: margin,
    y: 90,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  return pdf.save();
}
