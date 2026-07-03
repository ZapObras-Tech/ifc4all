// Self-check da lógica de datas. Rodar: node --experimental-strip-types src/ifc/schedule.selfcheck.ts
import assert from "node:assert";
import { parseDate } from "./schedule.ts";

assert.strictEqual(parseDate("2026-03-15")?.getFullYear(), 2026, "ISO");
assert.strictEqual(parseDate("15/03/2026")?.getMonth(), 2, "BR mês 0-based");
assert.strictEqual(parseDate("15/03/2026")?.getDate(), 15, "BR dia");
assert.strictEqual(parseDate(""), null, "vazio → null");
assert.strictEqual(parseDate("banana"), null, "inválido → null");
assert.ok(parseDate(String(Date.UTC(2026, 0, 1))) instanceof Date, "timestamp");

console.log("schedule.selfcheck OK");
