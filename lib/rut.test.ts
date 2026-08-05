// Run: node lib/rut.test.ts  (Node 24 strips TS types natively)
import assert from "node:assert";
import { isValidRut, formatRut, cleanRut } from "./rut.ts";

// Known-valid RUTs (real check digits).
assert.equal(isValidRut("11.111.111-1"), true);
assert.equal(isValidRut("12.345.678-5"), true);
assert.equal(isValidRut("10.000.013-K"), true);
assert.equal(isValidRut("10000013k"), true); // lenient input

// Invalid: wrong check digit / malformed.
assert.equal(isValidRut("11.111.111-2"), false);
assert.equal(isValidRut("12.345.678-9"), false);
assert.equal(isValidRut("abc"), false);
assert.equal(isValidRut(""), false);

// Formatting normalizes to XX.XXX.XXX-D
assert.equal(formatRut("111111111"), "11.111.111-1");
assert.equal(formatRut("10000013k"), "10.000.013-K");
assert.equal(cleanRut("12.345.678-5"), "123456785");

console.log("rut.test.ts: OK");
