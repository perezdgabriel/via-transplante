// Base de conocimiento. La IA SOLO puede relatar este texto de forma TEXTUAL; no redacta indicaciones
// clínicas por su cuenta (ver docs/adr/0004-ai-clinical-scope-verbatim-kb.md).
//
// Se compone de DOS orígenes, con reglas distintas
// (ver docs/adr/0009-base-de-conocimiento-fuera-de-git.md):
//
//   1. BASELINE (este archivo, versionado en git, revisado en PR, compartido por todos los hospitales).
//      Es contenido de una ESPECIALIDAD, no de una unidad: vale para cualquier niño/a trasplantado.
//      El hospital puede AÑADIRLE, nunca quitarle.
//   2. CONTENIDO DEL HOSPITAL (tabla knowledge_versions en el Supabase de cada tenant, editable desde
//      el dashboard). Incluye lo OPERATIVO (horarios, ubicaciones, requisitos), que no tiene baseline
//      porque es distinto en cada institución.
//
// Add-only se garantiza POR CONSTRUCCIÓN, no por política: systemPrompt() concatena el baseline
// primero y los añadidos después. No existe camino de código que elimine una línea del baseline.
// La invariante está cubierta en lib/prompts.test.ts.
//
// ⚠️ CONTENIDO DE DEMO (MVP): los datos de abajo son plausibles pero INVENTADOS para la demostración.
// NADA de esto está clínicamente validado. Antes de producción, cada tabla de ayuno, cuidado y señal de
// alarma DEBE ser reemplazado por contenido real firmado por el equipo clínico. Los pacientes
// trasplantados están inmunosuprimidos: el umbral de alarma es más bajo y los errores son de alto riesgo.
//
// Las bandas por edad usan límites numéricos inequívocos a propósito: la IA calza la banda como una
// búsqueda, no como un juicio clínico.

/** Baseline de una especialidad. Hoy solo trasplante pediátrico; el registro existe para admitir otra. */
export type ClinicalPackage = {
  id: string;
  label: string;
  /** Señales de alarma. Tienen PRECEDENCIA sobre todo lo demás. El hospital solo puede añadir. */
  redFlags: string;
  /** Contenido clínico válido para la especialidad completa. El hospital solo puede añadir. */
  clinical: string;
};

/** Lo que el hospital escribe desde el dashboard. Una fila de `knowledge_versions`. */
export type TenantKnowledge = {
  /** Horarios, ubicaciones, requisitos. SIN baseline: es distinto en cada institución. */
  operational: string;
  /** Se AÑADE al `clinical` del paquete. */
  clinical_added: string;
  /** Se AÑADE a los `redFlags` del paquete. */
  red_flags_added: string;
};

export const EMPTY_KNOWLEDGE: TenantKnowledge = {
  operational: "",
  clinical_added: "",
  red_flags_added: "",
};

// La BdC se inyecta ENTERA en el system prompt en cada turno (sin RAG, ver 0004), así que su tamaño se
// paga en cada mensaje de cada familia. El aviso llega antes de que el costo duela; el tope duro evita
// que un hospital pegue su manual completo y descubra el problema en la factura.
// ponytail: se cuenta en caracteres, no en tokens — evita una dependencia de tokenizador para un aviso.
export const KB_WARN_CHARS = 30_000;
export const KB_MAX_CHARS = 48_000;

export function knowledgeLength(kb: TenantKnowledge): number {
  return kb.operational.length + kb.clinical_added.length + kb.red_flags_added.length;
}

const TRASPLANTE_RED_FLAGS = `SEÑALES DE ALARMA (paciente trasplantado — DEMO, pendiente de firma clínica):
- FIEBRE ≥ 38°C (en un niño trasplantado/inmunosuprimido la fiebre es una urgencia; no esperar en casa).
- Signos de posible rechazo o falla del injerto:
    · Hígado: color amarillo de piel u ojos (ictericia), orina muy oscura, deposiciones muy pálidas,
      dolor en la zona del hígado.
    · Riñón: orina mucho menos de lo habitual, hinchazón de piernas/cara, dolor sobre el injerto,
      subida brusca de presión arterial.
- Vómitos o diarrea que impiden tomar los medicamentos inmunosupresores (no logra retenerlos).
- Contacto reciente con alguien con varicela o sarampión, o aparición de ampollas/erupción.
- Dificultad para respirar, respiración muy rápida o quejido.
- Decaimiento marcado, no reacciona, muy irritable, o no se puede despertar.
- Convulsiones.
- Signos de deshidratación (no orina, boca seca, sin lágrimas, muy decaído).
- Sangrado que no se detiene, o herida quirúrgica roja, caliente, hinchada o que supura.
- Cualquier cosa que el cuidador describa como grave o de rápido empeoramiento.`;

// Nota: la antigua sección "1. Información operativa y logística" (horarios de visita, pisos,
// requisitos de admisión) SALIÓ del baseline a propósito. Eran los datos de UNA unidad concreta;
// recitárselos a la familia de otro hospital es afirmar algo falso. Ahora los escribe cada hospital
// en `operational`, y si no los escribe, la IA escala en vez de inventar.
const TRASPLANTE_CLINICAL = `## Preparación para exámenes (DEMO — pendiente de firma clínica)
Ayuno para exámenes de sangre generales:
- Menor de 12 meses: 4 horas de ayuno.
- 12 meses o más: 8 horas de ayuno.
(Si la edad es de borde o el cuidador no está seguro, entrega ambas bandas o escala; no elijas por él.)

Nivel de inmunosupresor en sangre (ej: tacrolimus / ciclosporina):
- La muestra se toma en ayunas y ANTES de la dosis de la mañana.
- Lleve el medicamento a la toma de muestras para dárselo al niño/a justo DESPUÉS de la extracción.
- Importante: no suspenda ni cambie la dosis por su cuenta. Ante cualquier duda de dosis o de un cambio
  reciente, escale a la enfermera.

Ecografía abdominal (hígado/riñón): acudir con 4 horas de ayuno.
Ecografía renal y de vejiga: el niño/a debe tomar agua y llegar con la vejiga llena (no orinar en la
hora previa, según tolere).
Radiografía: ropa sin botones, cierres ni broches metálicos en la zona a examinar.
Biopsia (hepática o renal): la preparación es específica de cada niño/a. Escale a la enfermera para las
indicaciones (ayuno, medicamentos y horario).

## Cuidados generales y síntomas leves (DEMO — pendiente de firma clínica)
Prevención de infecciones (clave en trasplantados):
- Lavado de manos frecuente en la casa; evitar aglomeraciones y contacto con personas enfermas.
- Evitar contacto con personas con varicela, sarampión o herpes zóster. Si ocurre, avise al equipo.

Vacunas:
- Los niños/as trasplantados NO deben recibir vacunas "vivas" (ej: sarampión, varicela, BCG) sin
  autorización del equipo de trasplante. Confirme siempre antes de vacunar.
- Tras una vacuna permitida puede haber molestia local o fiebre leve. Recuerde: cualquier fiebre ≥ 38°C
  en un niño/a trasplantado es motivo de consulta (ver señales de alarma).

Herida quirúrgica:
- Mantener la zona limpia y seca. Lavar las manos antes de tocarla.
- Rasmilladuras superficiales: limpiar con agua y jabón neutro.
- Si la herida está roja, caliente, hinchada, dolorosa o supura → señal de alarma, escale.

Alimentación segura (inmunosuprimidos):
- Lavar bien frutas y verduras. Evitar carnes, huevos o pescado crudos o poco cocidos, y lácteos o jugos
  no pasteurizados.
- NO dar pomelo ni jugo de pomelo: interfiere con los medicamentos inmunosupresores.
- Gastroenteritis (diarrea/vómitos leves): privilegiar la hidratación con pequeñas cantidades frecuentes
  de líquido. Si no logra tomar los medicamentos, o hay signos de deshidratación → señal de alarma.

Protección solar:
- Los inmunosupresores aumentan la sensibilidad de la piel al sol. Use bloqueador, ropa y sombrero, y
  evite el sol del mediodía.`;

export const PACKAGES: Record<string, ClinicalPackage> = {
  trasplante_pediatrico: {
    id: "trasplante_pediatrico",
    label: "Trasplante hepático y renal pediátrico",
    redFlags: TRASPLANTE_RED_FLAGS,
    clinical: TRASPLANTE_CLINICAL,
  },
};

/**
 * Baseline de la especialidad del tenant. Lanza si el id no existe: servir el paquete equivocado
 * (ej: contenido de trasplante a una unidad de cardiología) es peor que caerse.
 */
export function getPackage(id: string): ClinicalPackage {
  const pkg = PACKAGES[id];
  if (!pkg) throw new Error(`Paquete clínico desconocido: ${id}`);
  return pkg;
}

/**
 * Esqueleto que el dashboard muestra como placeholder del campo operativo. NUNCA se inyecta en el
 * prompt: es andamiaje de UI para que el hospital sepa qué escribir, no contenido aprobado.
 */
export const OPERATIONAL_TEMPLATE = `Horarios:
- Visitas en hospitalización:
- Toma de muestras (laboratorio):
- Policlínico de Trasplante (controles):

Ubicaciones:
- Unidad de Trasplante (hospitalización):
- Policlínico de Trasplante:
- Toma de muestras / Laboratorio:
- Farmacia:

Requisitos de admisión / control:
-

Hospitalización — qué llevar:
-

Protocolo de visitas:
-`;

// ponytail: invariante de arranque — el id del registro debe calzar con el id del paquete. Falla al
// importar (no en runtime) si alguien copia una entrada y olvida cambiar el id, que es cuando quieres
// enterarte: un id desalineado sirve el baseline de otra especialidad.
for (const [key, pkg] of Object.entries(PACKAGES)) {
  if (key !== pkg.id) throw new Error(`knowledge-base.ts: id desalineado (${key} !== ${pkg.id})`);
}
