import type Anthropic from "@anthropic-ai/sdk";

// Catálogo de folletos: ÚNICA fuente de verdad. De aquí se derivan tanto el enum de la herramienta
// como el listado que ve la IA en el system prompt, para que no se desincronicen.
// El servidor es dueño de `title` y `url`: la IA solo elige un `id`, nunca inventa un enlace.
//
// ponytail: PDFs pendientes. Colocar los archivos aprobados en public/folletos/<id>.pdf.
// Hasta entonces la tarjeta muestra el título sin descarga (url: null).
export type Folleto = {
  id: string;
  title: string;
  url: string | null;
  /** Cuándo entregarlo. Se inyecta en el prompt para guiar a la IA. */
  cuando: string;
};

export const FOLLETOS: Folleto[] = [
  {
    id: "alimentacion_complementaria",
    title: "Alimentación complementaria en menores de 1 año",
    url: null,
    cuando: "dudas sobre alimentación/nutrición en lactantes menores de 1 año",
  },
  {
    id: "vrs",
    title: "Prevención de virus respiratorios (VRS)",
    url: null,
    cuando: "dudas sobre prevención de virus respiratorios",
  },
];

const FOLLETO_IDS = FOLLETOS.map((f) => f.id);

export function getFolleto(id: string): Folleto | undefined {
  return FOLLETOS.find((f) => f.id === id);
}

/** Listado legible para el system prompt. */
export function folletosPromptListing(): string {
  return FOLLETOS.map((f) => `- ${f.id}: ${f.title} — entregar ante ${f.cuando}.`).join("\n");
}

export const entregarFolletoTool: Anthropic.Tool = {
  name: "entregar_folleto",
  description:
    "Entrega al usuario un folleto educativo del catálogo del hospital. Úsalo cuando la duda calce con un folleto disponible. Solo puedes elegir un id del catálogo; el enlace lo pone el servidor.",
  input_schema: {
    type: "object",
    properties: {
      folleto_id: {
        type: "string",
        enum: FOLLETO_IDS,
        description: "Id del folleto del catálogo a entregar.",
      },
    },
    required: ["folleto_id"],
  },
};

// ponytail: invariante de arranque — ids únicos y enum de la herramienta alineado con el catálogo.
// Falla al importar (no en runtime) si un id se duplica: es exactamente cuando quieres enterarte.
if (new Set(FOLLETO_IDS).size !== FOLLETO_IDS.length) {
  throw new Error("folletos.ts: ids de folleto duplicados en el catálogo");
}
