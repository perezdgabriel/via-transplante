// Base de conocimiento del hospital. La IA SOLO puede relatar este texto de forma TEXTUAL; no redacta
// indicaciones clínicas por su cuenta (ver docs/adr/0004-ai-clinical-scope-verbatim-kb.md).
//
// ⚠️ TODO EL CONTENIDO CLÍNICO DE ABAJO ES PLACEHOLDER Y DEBE SER APROBADO POR UN CLÍNICO DEL HOSPITAL
// ANTES DE PRODUCCIÓN. Cada tabla de ayuno, cuidado y señal de alarma requiere firma clínica.
//
// Las bandas por edad usan límites numéricos inequívocos a propósito: la IA calza la banda como una
// búsqueda, no como un juicio clínico.

// Señales de alarma: tienen PRECEDENCIA sobre cualquier contenido de abajo. Si el mensaje del cuidador
// menciona alguna, la IA escala (urgente) en vez de tranquilizar. Lista aprobada por el hospital.
export const RED_FLAGS = `SEÑALES DE ALARMA (aprobadas — PENDIENTES de firma clínica):
- Dificultad para respirar, respiración muy rápida o quejido al respirar.
- Fiebre ≥ 39°C que no cede, o fiebre en menor de 3 meses.
- Decaimiento marcado, no reacciona, muy irritable o no se puede despertar.
- Convulsiones.
- Vómitos persistentes, signos de deshidratación (no orina, boca seca, sin lágrimas).
- Sangrado que no se detiene, o herida profunda/extensa.
- Coloración azulada o muy pálida de labios o piel.
- Cualquier cosa que el cuidador describa como grave o de rápido empeoramiento.`;

export const KNOWLEDGE_BASE = `## 1. Información operativa y logística (aprobada — PENDIENTE de datos reales del hospital)
- Horario de visitas: [PENDIENTE].
- Horario de toma de muestras: [PENDIENTE].
- Ubicación de especialidades: [PENDIENTE] (ej: "Traumatología está en el 2º piso").
- Requisitos de admisión/alta: documentos a llevar (cédula, RUT, orden médica) [PENDIENTE detalle].
- Artículos de aseo personal permitidos para hospitalización: [PENDIENTE].
- Protocolos de visita: quién puede acompañar al menor, restricciones de edad de visitantes, uso de
  mascarilla si aplica [PENDIENTE].

## 2. Preparación para exámenes (aprobada — PENDIENTE de firma clínica)
Ayuno pediátrico para exámenes de sangre generales:
- Menor de 12 meses: 4 horas de ayuno.
- 12 meses o más: 8 horas de ayuno.
(Si la edad es de borde o el cuidador no está seguro, entrega ambas bandas o escala; no elijas por él.)

Ecografías / radiografías:
- Ecografía pélvica: [PENDIENTE — ej. tomar agua antes / vejiga llena].
- Radiografía: ropa sin botones ni broches metálicos en la zona [PENDIENTE confirmar].

## 3. Cuidados generales y síntomas leves (aprobada — PENDIENTE de firma clínica)
Reacciones a vacunas: fiebre leve, enrojecimiento o irritabilidad en las primeras 24–48 h pueden ser
esperables [PENDIENTE texto exacto]. Ante señal de alarma, escalar.

Heridas y yesos: no mojar el yeso; limpiar rasmilladuras superficiales con agua y jabón neutro
[PENDIENTE texto exacto]. Herida profunda/extensa o que sangra → señal de alarma.

Alimentación en gastroenteritis: privilegiar hidratación; dieta blanda [PENDIENTE texto exacto].
Signos de deshidratación → señal de alarma.`;
