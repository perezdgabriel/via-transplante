"use client";

import { useState } from "react";
import { publishKnowledge } from "../actions";
import {
  EMPTY_KNOWLEDGE,
  KB_MAX_CHARS,
  KB_WARN_CHARS,
  knowledgeLength,
  type ClinicalPackage,
  type TenantKnowledge,
} from "@/lib/knowledge-base";

const box =
  "mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-xs leading-relaxed dark:border-white/20 dark:bg-zinc-800";

// El baseline se muestra en solo lectura encima de cada campo: quien edita tiene que ver a qué le está
// sumando, y ver que no lo puede quitar. Es la misma idea que el texto de ayuda de las alergias en
// RecordForm — la interfaz explica el modo de falla en vez de confiar en que se recuerde.
function Baseline({ text }: { text: string }) {
  return (
    <details className="mt-2 rounded-lg border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900">
      <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Ver contenido base (no editable)
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
        {text}
      </pre>
    </details>
  );
}

export type Version = TenantKnowledge & {
  id: string;
  signed_by: string;
  published_at: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago" });

export function KnowledgeForm({
  versions,
  pkg,
  canPublish,
  operationalTemplate,
}: {
  versions: Version[];
  pkg: ClinicalPackage;
  canPublish: boolean;
  operationalTemplate: string;
}) {
  const [kb, setKb] = useState<TenantKnowledge>(versions[0] ?? EMPTY_KNOWLEDGE);
  const total = knowledgeLength(kb);
  const over = total > KB_MAX_CHARS;
  const warn = total > KB_WARN_CHARS;

  const set = (patch: Partial<TenantKnowledge>) => setKb((prev) => ({ ...prev, ...patch }));

  return (
    <form action={publishKnowledge} className="mt-4 space-y-8">
      {!canPublish && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Tu cuenta puede ver este contenido, pero no publicarlo. Pide a la administración del hospital
          que habilite el permiso de publicación.
        </p>
      )}

      <section>
        <h2 className="text-sm font-medium">Información operativa</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Horarios, ubicaciones y requisitos de este hospital. No hay contenido base: si lo dejas
          vacío, la IA deriva a la enfermera toda pregunta de horarios o ubicaciones en vez de
          inventarla.
        </p>
        <textarea
          name="operational"
          rows={14}
          value={kb.operational}
          onChange={(e) => set({ operational: e.target.value })}
          placeholder={operationalTemplate}
          className={box}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium">Contenido clínico adicional</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Se <strong>suma</strong> al contenido base de {pkg.label.toLowerCase()}. No lo reemplaza ni
          lo puede quitar.
        </p>
        <Baseline text={pkg.clinical} />
        <textarea
          name="clinicalAdded"
          rows={8}
          value={kb.clinical_added}
          onChange={(e) => set({ clinical_added: e.target.value })}
          className={box}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium">Señales de alarma adicionales</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Se <strong>suman</strong> a las señales de alarma base, que no se pueden quitar ni editar
          desde aquí. Agregar señales hace que la IA derive más casos, nunca menos.
        </p>
        <Baseline text={pkg.redFlags} />
        <textarea
          name="redFlagsAdded"
          rows={5}
          value={kb.red_flags_added}
          onChange={(e) => set({ red_flags_added: e.target.value })}
          className={box}
        />
      </section>

      <p
        className={`text-xs ${
          over ? "text-red-600" : warn ? "text-amber-600" : "text-zinc-500"
        }`}
      >
        {total.toLocaleString("es-CL")} de {KB_MAX_CHARS.toLocaleString("es-CL")} caracteres.
        {over
          ? " Supera el máximo: reduce el contenido antes de publicar."
          : warn
            ? " Este texto se envía completo en cada mensaje del chat; contenido muy largo encarece cada consulta."
            : ""}
      </p>

      <div className="border-t border-black/10 pt-4 dark:border-white/15">
        <label className="block text-sm">
          <span className="block font-medium">Aprobado por</span>
          <input
            name="signedBy"
            required
            placeholder="Dra. Nombre Apellido"
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-800 sm:w-80"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Nombre del profesional que aprueba este contenido. Queda registrado con la versión y no se
            puede editar después.
          </span>
        </label>

        <button
          disabled={!canPublish || over}
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          Publicar versión
        </button>
      </div>

      <section className="border-t border-black/10 pt-4 dark:border-white/15">
        <h2 className="text-sm font-medium">Historial de versiones</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cada publicación queda registrada y no se puede editar ni borrar. Volver a una versión
          anterior es cargarla y publicarla de nuevo, con una firma nueva: queda como una publicación
          más, no reescribe la historia.
        </p>
        {versions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Todavía no hay versiones publicadas. Hasta que publiques la información operativa, la IA
            deriva a la enfermera las preguntas de horarios y ubicaciones.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 text-sm dark:divide-white/10">
            {versions.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  Aprobado por <strong>{v.signed_by}</strong>
                  {i === 0 && <span className="ml-2 text-xs text-emerald-600">vigente</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-zinc-500">{fmt(v.published_at)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setKb({
                        operational: v.operational,
                        clinical_added: v.clinical_added,
                        red_flags_added: v.red_flags_added,
                      })
                    }
                    className="rounded-lg border border-black/15 px-3 py-1 text-xs dark:border-white/20"
                  >
                    Cargar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </form>
  );
}
