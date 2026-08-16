// Run: node lib/patient-record.test.ts  (Node 24 strips TS types natively)
import assert from "node:assert";
import {
  fromSantiagoLocal,
  parseMedications,
  renderRecordForPrompt,
  toSantiagoLocal,
  todayInChile,
  type PatientRecord,
} from "./patient-record.ts";

const empty: PatientRecord = {
  next_appointment_at: null,
  next_appointment_place: null,
  medications: [],
  allergies: null,
  restrictions: null,
};

// Reference "now": 2026-08-16 11:00 in Santiago (UTC-4 in the southern winter).
const now = new Date("2026-08-16T15:00:00Z");

// --- Nothing to say -> nothing appended. The caller must not emit an empty FICHA header.
assert.equal(renderRecordForPrompt(empty, now), null);
assert.equal(renderRecordForPrompt({ ...empty, medications: null }, now), null);
assert.equal(renderRecordForPrompt({ ...empty, allergies: "   " }, now), null);

// --- SAFETY: an empty field is omitted entirely, so the model cannot see the gap and
// cannot turn "not recorded" into "no tiene alergias". This is the core guard.
const onlyAllergies = renderRecordForPrompt(
  { ...empty, allergies: "Ninguna conocida" },
  now,
);
assert.ok(onlyAllergies !== null);
assert.ok(onlyAllergies.includes("Ninguna conocida"));
assert.ok(!onlyAllergies.includes("Próximo control"));
assert.ok(!onlyAllergies.includes("Medicamentos"));
assert.ok(!onlyAllergies.includes("Restricciones"));

// --- SAFETY: a past appointment is dropped. The model has no date sense of its own, so a
// stale date would be read back confidently on the wrong day.
const past = renderRecordForPrompt(
  {
    ...empty,
    next_appointment_at: "2026-08-10T14:00:00Z",
    next_appointment_place: "Policlínico 2",
    allergies: "Ninguna conocida",
  },
  now,
);
assert.ok(past !== null);
assert.ok(!past.includes("Próximo control"));
assert.ok(!past.includes("Policlínico 2"));
assert.ok(past.includes("Ninguna conocida"));

// --- Future appointment: absolute date, place, and an unambiguous relative distance.
const future = renderRecordForPrompt(
  {
    ...empty,
    next_appointment_at: "2026-09-03T14:00:00Z",
    next_appointment_place: "Policlínico 2",
  },
  now,
);
assert.ok(future !== null);
assert.ok(future.includes("Próximo control"));
assert.ok(future.includes("3 de septiembre"));
assert.ok(future.includes("10:00"));
assert.ok(future.includes("Policlínico 2"));
assert.ok(future.includes("en 18 días"));

// Same-day (later) and next-day read naturally instead of "en 0 días".
const todayAppt = renderRecordForPrompt(
  { ...empty, next_appointment_at: "2026-08-16T22:00:00Z" },
  now,
);
assert.ok(todayAppt!.includes("hoy"));
const tomorrowAppt = renderRecordForPrompt(
  { ...empty, next_appointment_at: "2026-08-17T14:00:00Z" },
  now,
);
assert.ok(tomorrowAppt!.includes("mañana"));

// An appointment with no place recorded still renders, without a dangling separator.
const noPlace = renderRecordForPrompt(
  { ...empty, next_appointment_at: "2026-09-03T14:00:00Z" },
  now,
);
assert.ok(noPlace!.includes("3 de septiembre"));
assert.ok(!noPlace!.includes("·"));

// --- Medications carry dose and frequency; that is the whole point of the field.
const meds = renderRecordForPrompt(
  {
    ...empty,
    medications: [
      { name: "Tacrolimus", dose: "1 mg", frequency: "cada 12 horas", schedule: "8:00 y 20:00" },
      { name: "Micofenolato", dose: "250 mg", frequency: "cada 12 horas" },
    ],
  },
  now,
);
assert.ok(meds !== null);
assert.ok(meds.includes("Tacrolimus"));
assert.ok(meds.includes("1 mg"));
assert.ok(meds.includes("cada 12 horas"));
assert.ok(meds.includes("8:00 y 20:00"));
assert.ok(meds.includes("Micofenolato"));
assert.ok(meds.includes("250 mg"));

// Blank rows left behind by the dashboard repeater are dropped, not rendered as noise.
const blankRows = renderRecordForPrompt(
  {
    ...empty,
    medications: [
      { name: "", dose: "", frequency: "" },
      { name: "  ", dose: "1 mg", frequency: "" },
    ],
  },
  now,
);
assert.equal(blankRows, null);

// --- todayInChile is what tells the model what day it is; it must use Santiago, not UTC.
// 2026-01-01 00:30 UTC is still 31 December in Chile (UTC-3 in the southern summer).
assert.ok(todayInChile(new Date("2026-01-01T00:30:00Z")).includes("31 de diciembre"));
assert.ok(todayInChile(now).includes("16 de agosto"));

// --- recordFields is what the family's card renders. It must agree with the prompt exactly:
// same omissions, same past-appointment drop. Otherwise the card and the AI contradict each other.
import { recordFields } from "./patient-record.ts";

assert.deepEqual(recordFields(empty, now), []);
assert.deepEqual(recordFields(null, now), []);
assert.deepEqual(
  recordFields({ ...empty, next_appointment_at: "2026-08-10T14:00:00Z" }, now).map((f) => f.label),
  [], // past control: invisible on the card too, not just to the model
);
assert.deepEqual(
  recordFields(
    {
      ...empty,
      next_appointment_at: "2026-09-03T14:00:00Z",
      medications: [{ name: "Tacrolimus", dose: "1 mg", frequency: "cada 12 h" }],
      allergies: "Ninguna conocida",
    },
    now,
  ).map((f) => f.label),
  ["Próximo control", "Medicamentos", "Alergias"],
);
assert.deepEqual(
  recordFields(
    { ...empty, medications: [{ name: "Tacrolimus", dose: "1 mg", frequency: "cada 12 h" }] },
    now,
  )[0].items,
  ["Tacrolimus — 1 mg — cada 12 h"],
);

// --- parseMedications is a trust boundary: the repeater arrives as a JSON string in a form field.
assert.deepEqual(parseMedications("[]"), []);
assert.deepEqual(parseMedications("no es json"), []);
assert.deepEqual(parseMedications('{"name":"x"}'), []); // not an array
assert.deepEqual(parseMedications(null), []);
assert.deepEqual(parseMedications('[null, 3, "x"]'), []);
assert.deepEqual(
  parseMedications('[{"name":" Tacrolimus ","dose":"1 mg","frequency":"cada 12 h"}]'),
  [{ name: "Tacrolimus", dose: "1 mg", frequency: "cada 12 h", schedule: "" }],
);
// A row with no drug name is a leftover blank from the repeater, not data.
assert.deepEqual(parseMedications('[{"dose":"1 mg"},{"name":"Aspirina"}]'), [
  { name: "Aspirina", dose: "", frequency: "", schedule: "" },
]);
// Missing keys don't become the string "undefined".
assert.equal(parseMedications('[{"name":"X"}]')[0].dose, "");
// No silent truncation: dropping a medication would be worse than a long list.
assert.equal(
  parseMedications(JSON.stringify(Array.from({ length: 50 }, () => ({ name: "X" })))).length,
  50,
);

// --- datetime-local <-> instant, pinned to Santiago so server and browser render identically
// (no hydration mismatch) and an appointment can't shift by the offset of whoever is browsing.
assert.equal(toSantiagoLocal("2026-09-03T14:00:00Z"), "2026-09-03T10:00"); // invierno, UTC-4
assert.equal(toSantiagoLocal("2026-01-15T13:00:00Z"), "2026-01-15T10:00"); // verano, UTC-3
assert.equal(toSantiagoLocal(null), "");
assert.equal(toSantiagoLocal("no es fecha"), "");

assert.equal(fromSantiagoLocal("2026-09-03T10:00"), "2026-09-03T14:00:00.000Z");
assert.equal(fromSantiagoLocal("2026-01-15T10:00"), "2026-01-15T13:00:00.000Z");
assert.equal(fromSantiagoLocal(""), "");
assert.equal(fromSantiagoLocal("basura"), "");

// Round-trips in both directions, across the DST boundary.
for (const iso of [
  "2026-09-03T14:00:00.000Z",
  "2026-01-15T13:00:00.000Z",
  "2026-06-30T23:30:00.000Z",
]) {
  assert.equal(fromSantiagoLocal(toSantiagoLocal(iso)), iso);
}
// Midnight must render as 00:00, not 24:00 (the classic hour12:false trap).
assert.ok(toSantiagoLocal("2026-06-30T04:00:00Z").endsWith("T00:00"));

console.log("patient-record: ok");
