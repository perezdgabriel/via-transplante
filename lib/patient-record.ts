// Ficha de seguimiento: the operational subset of a patient that the AI may read back TAL CUAL.
// Alcance clínico: ver docs/adr/0007-per-patient-verbatim-record.md (amplía 0004).
//
// The safety property lives in renderRecordForPrompt: a field with no value produces NO LINE,
// so the model never sees that the field exists and cannot turn "not recorded" into a claim
// ("no tiene alergias"). Absence of data must never become data.

const TZ = "America/Santiago";

export type Medication = {
  name: string;
  dose: string;
  frequency: string;
  schedule?: string;
};

export type PatientRecord = {
  next_appointment_at: string | null;
  next_appointment_place: string | null;
  medications: Medication[] | null;
  allergies: string | null;
  restrictions: string | null;
  record_source?: "manual" | "his";
  record_synced_at?: string | null;
};

const trim = (v: string | null | undefined) => (v ?? "").trim();

// Wall clock in Santiago as "YYYY-MM-DDTHH:mm" — the shape <input type="datetime-local"> wants.
const wallClock = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

/**
 * Instant -> Santiago wall time for the datetime-local input. Pinned to the hospital's zone rather
 * than the rendering machine's, so the server and the browser agree (no hydration mismatch) and a
 * nurse browsing from anywhere still sees the appointment in the time the hospital means.
 */
export function toSantiagoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : wallClock(d);
}

/** The inverse: Santiago wall time from the input -> instant. "" when the input is empty/invalid. */
export function fromSantiagoLocal(local: string): string {
  const wall = trim(local).slice(0, 16);
  // Check the shape explicitly: Date.parse is lenient enough to turn "basura:00Z" into year 2000.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall)) return "";
  const asIfUtc = Date.parse(`${wall}:00Z`);
  if (Number.isNaN(asIfUtc)) return "";
  // Correct by the zone offset in effect at that instant. One pass is exact outside the one
  // ambiguous hour when Chile falls back, where it resolves to the earlier of the two.
  const offset = asIfUtc - Date.parse(`${wallClock(new Date(asIfUtc))}:00Z`);
  return new Date(asIfUtc + offset).toISOString();
}

// Calendar-day distance in Santiago. Done on Y-M-D strings rather than raw milliseconds so a
// DST change (Chile shifts in September and April) can't turn 18 days into 17.5 and round wrong.
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const daysApart = (from: Date, to: Date) =>
  Math.round((Date.parse(ymd(to)) - Date.parse(ymd(from))) / 86_400_000);

const longDate = (d: Date) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

const time = (d: Date) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

/** "Hoy es martes, 16 de agosto de 2026." — the model has no clock of its own. */
export function todayInChile(now: Date = new Date()): string {
  return longDate(now);
}

/**
 * Parse the medications repeater, which arrives as a JSON string in a form field. Anything
 * unparseable or unexpected degrades to an empty list rather than throwing — a broken row must
 * not block the nurse from saving the rest of the ficha. Rows without a drug name are dropped.
 */
export function parseMedications(raw: unknown): Medication[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
    .map((m) => ({
      name: trim(String(m.name ?? "")),
      dose: trim(String(m.dose ?? "")),
      frequency: trim(String(m.frequency ?? "")),
      schedule: trim(String(m.schedule ?? "")),
    }))
    .filter((m) => m.name.length > 0);
  // No cap: silently dropping a medication is a worse failure than a long list, and the rows are
  // typed by hand in the dashboard repeater.
}

export function medicationLabel(m: Medication): string {
  return [trim(m.name), trim(m.dose), trim(m.frequency), trim(m.schedule)]
    .filter(Boolean)
    .join(" — ");
}

/** A medication row is real only if it names a drug; the dashboard repeater leaves blanks behind. */
const usableMeds = (meds: Medication[] | null) =>
  (meds ?? []).filter((m) => trim(m?.name).length > 0);

export type RecordField = { label: string; value?: string; items?: string[] };

/**
 * The single source of truth for what the ficha shows. Both the model's system block and the
 * family's card render from this, so they can never disagree about what the record says.
 *
 * Only fields with a value are returned. A past appointment is dropped entirely — the model has no
 * clock of its own, and a parent must not be told about a control that already happened.
 */
export function recordFields(
  record: PatientRecord | null | undefined,
  now: Date = new Date(),
): RecordField[] {
  if (!record) return [];
  const fields: RecordField[] = [];

  const at = trim(record.next_appointment_at);
  if (at) {
    const when = new Date(at);
    if (!Number.isNaN(when.getTime()) && when.getTime() > now.getTime()) {
      const days = daysApart(now, when);
      const relative = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
      const place = trim(record.next_appointment_place);
      fields.push({
        label: "Próximo control",
        value: `${longDate(when)}, ${time(when)}${place ? ` · ${place}` : ""} (${relative})`,
      });
    }
  }

  const meds = usableMeds(record.medications);
  if (meds.length > 0) {
    fields.push({ label: "Medicamentos", items: meds.map(medicationLabel) });
  }

  const allergies = trim(record.allergies);
  if (allergies) fields.push({ label: "Alergias", value: allergies });

  const restrictions = trim(record.restrictions);
  if (restrictions) fields.push({ label: "Restricciones", value: restrictions });

  return fields;
}

/** Render the record for the model's (uncached) system block, or null if there is nothing to say. */
export function renderRecordForPrompt(
  record: PatientRecord | null | undefined,
  now: Date = new Date(),
): string | null {
  const fields = recordFields(record, now);
  if (fields.length === 0) return null;

  const lines = fields.flatMap((f) =>
    f.items ? [`- ${f.label}:`, ...f.items.map((i) => `  - ${i}`)] : [`- ${f.label}: ${f.value}`],
  );

  return `FICHA DE SEGUIMIENTO de este paciente (campos aprobados; léelos TAL CUAL):\n${lines.join("\n")}`;
}
