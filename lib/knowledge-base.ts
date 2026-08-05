// Base de conocimiento del hospital. La IA SOLO puede relatar este texto de forma TEXTUAL; no redacta
// indicaciones clínicas por su cuenta (ver docs/adr/0004-ai-clinical-scope-verbatim-kb.md).
//
// Unidad de referencia: Unidad de Trasplante Hepático y Renal Pediátrico.
//
// ⚠️ CONTENIDO DE DEMO (MVP): los datos de abajo son plausibles pero INVENTADOS para la demostración.
// NADA de esto está clínicamente validado. Antes de producción, cada horario, requisito, tabla de
// ayuno, cuidado y señal de alarma DEBE ser reemplazado por contenido real firmado por el equipo
// clínico de la unidad. Los pacientes trasplantados están inmunosuprimidos: el umbral de alarma es más
// bajo y los errores son de alto riesgo.
//
// Las bandas por edad usan límites numéricos inequívocos a propósito: la IA calza la banda como una
// búsqueda, no como un juicio clínico.

// Señales de alarma: tienen PRECEDENCIA sobre cualquier contenido de abajo. Si el mensaje del cuidador
// menciona alguna, la IA escala (urgente) en vez de tranquilizar. En pacientes trasplantados el umbral
// es más bajo (ej: la fiebre es una urgencia). Lista de DEMO — pendiente de firma clínica.
export const RED_FLAGS = `SEÑALES DE ALARMA (paciente trasplantado — DEMO, pendiente de firma clínica):
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

export const KNOWLEDGE_BASE = `## 1. Información operativa y logística (DEMO — reemplazar por datos reales de la unidad)
Horarios:
- Visitas en hospitalización: 16:00 a 19:00 hrs. Por control de infecciones, un acompañante permanente
  (adulto responsable) más una visita a la vez.
- Toma de muestras (laboratorio): lunes a sábado, 07:00 a 11:00 hrs, sin cita.
- Policlínico de Trasplante (controles): lunes a viernes, 08:30 a 16:30 hrs, solo con hora agendada.

Ubicaciones:
- Unidad de Trasplante (hospitalización): 4º piso, ala norte.
- Policlínico de Trasplante: 2º piso.
- Toma de muestras / Laboratorio: 1er piso.
- Imagenología (ecografía y radiografía): 1er piso.
- Farmacia: 1er piso, hall central.

Requisitos de admisión / control:
- Cédula de identidad o RUT del niño/a y del adulto responsable.
- Orden médica o carné de control de trasplante.
- Lista actualizada de todos los medicamentos que toma el niño/a (o traerlos en sus envases).

Hospitalización — qué llevar:
- Artículos de aseo personal propios y limpios (cepillo y pasta de dientes, jabón, toalla). No compartir.
- Ropa cómoda y muda. Pañales si corresponde.
- NO llevar flores ni plantas (riesgo de infección para pacientes inmunosuprimidos).

Protocolo de visitas (unidad inmunosuprimida):
- No pueden ingresar personas con fiebre, tos, resfrío, diarrea o vómitos.
- Uso de mascarilla y lavado de manos obligatorio al entrar y salir.
- No se permiten visitas de menores de 12 años (consultar excepciones con la enfermera).
- Máximo 2 visitantes por paciente, y solo una persona junto a la cama a la vez.

## 2. Preparación para exámenes (DEMO — pendiente de firma clínica)
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

## 3. Cuidados generales y síntomas leves (DEMO — pendiente de firma clínica)
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
