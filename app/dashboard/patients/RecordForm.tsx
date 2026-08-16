"use client";

import { useState } from "react";
import { updatePatientRecord } from "../actions";
import {
  fromSantiagoLocal,
  toSantiagoLocal,
  type Medication,
  type PatientRecord,
} from "@/lib/patient-record";

const input =
  "mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-800";

const blankMed = (): Medication => ({ name: "", dose: "", frequency: "", schedule: "" });

export function RecordForm({
  patientId,
  record,
}: {
  patientId: string;
  record: PatientRecord;
}) {
  const [when, setWhen] = useState(toSantiagoLocal(record.next_appointment_at));
  const [meds, setMeds] = useState<Medication[]>(
    record.medications?.length ? record.medications : [blankMed()],
  );

  const setMed = (i: number, patch: Partial<Medication>) =>
    setMeds((prev) => prev.map((m, j) => (i === j ? { ...m, ...patch } : m)));

  return (
    <form action={updatePatientRecord} className="mt-4 space-y-5">
      <input type="hidden" name="patientId" value={patientId} />
      {/* The repeater lives in React state; submit it as one JSON field instead of indexed inputs.
          The action re-parses and re-validates it (parseMedications). */}
      <input type="hidden" name="medications" value={JSON.stringify(meds)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block font-medium">Próximo control</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={input}
          />
          <input type="hidden" name="nextAppointmentAt" value={fromSantiagoLocal(when)} />
          <span className="mt-1 block text-xs text-zinc-500">Hora de Chile.</span>
        </label>
        <label className="text-sm">
          <span className="block font-medium">Lugar</span>
          <input
            name="nextAppointmentPlace"
            defaultValue={record.next_appointment_place ?? ""}
            placeholder="Policlínico 2, 3er piso"
            className={input}
          />
        </label>
      </div>

      <fieldset className="text-sm">
        <legend className="font-medium">Medicamentos</legend>
        <p className="mt-1 text-xs text-zinc-500">
          Escribe la dosis y la frecuencia tal como las indicó el equipo tratante. La IA las
          entrega textualmente, sin ajustarlas.
        </p>
        <div className="mt-2 space-y-2">
          {meds.map((m, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <input
                value={m.name}
                onChange={(e) => setMed(i, { name: e.target.value })}
                placeholder="Tacrolimus"
                className={`${input} mt-0 flex-1 min-w-32`}
              />
              <input
                value={m.dose}
                onChange={(e) => setMed(i, { dose: e.target.value })}
                placeholder="1 mg"
                className={`${input} mt-0 w-24`}
              />
              <input
                value={m.frequency}
                onChange={(e) => setMed(i, { frequency: e.target.value })}
                placeholder="cada 12 horas"
                className={`${input} mt-0 w-36`}
              />
              <input
                value={m.schedule ?? ""}
                onChange={(e) => setMed(i, { schedule: e.target.value })}
                placeholder="8:00 y 20:00"
                className={`${input} mt-0 w-32`}
              />
              <button
                type="button"
                aria-label={`Quitar ${m.name || "medicamento"}`}
                onClick={() => setMeds((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMeds((prev) => [...prev, blankMed()])}
          className="mt-2 rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          + Agregar medicamento
        </button>
      </fieldset>

      <label className="block text-sm">
        <span className="block font-medium">Alergias</span>
        <input
          name="allergies"
          defaultValue={record.allergies ?? ""}
          // The placeholder is the mechanism: blank means "not recorded", so the AI escalates.
          // If the child has none, that has to be written down explicitly.
          placeholder="Ninguna conocida"
          className={input}
        />
        <span className="mt-1 block text-xs text-zinc-500">
          Si lo dejas vacío, la IA no dirá que no tiene alergias: derivará la consulta.
        </span>
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Restricciones</span>
        <textarea
          name="restrictions"
          rows={2}
          defaultValue={record.restrictions ?? ""}
          placeholder="Dieta, actividad física, etc."
          className={input}
        />
      </label>

      <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
        Guardar ficha
      </button>
    </form>
  );
}
