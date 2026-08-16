"use client";

import type { RecordField } from "@/lib/patient-record";

// The family's own copy of the ficha. The fields are computed on the server by recordFields — the
// same function and the same clock the model's system block uses — so the card and the assistant
// can never say different things. This path cannot hallucinate: it is the correct-by-construction
// answer, and the chat is the convenient one.
export function RecordCard({ fields }: { fields: RecordField[] }) {
  if (fields.length === 0) return null;

  return (
    <details className="border-b border-black/10 px-4 py-2 dark:border-white/15">
      <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Mi ficha de seguimiento
      </summary>
      <dl className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-medium text-zinc-500">{f.label}</dt>
            {f.items ? (
              <dd>
                <ul className="list-inside list-disc">
                  {f.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </dd>
            ) : (
              <dd>{f.value}</dd>
            )}
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-zinc-500">
        Datos entregados por el equipo del hospital. Si algo no está aquí o no calza, escríbelo en
        el chat y una enfermera lo revisará.
      </p>
    </details>
  );
}
