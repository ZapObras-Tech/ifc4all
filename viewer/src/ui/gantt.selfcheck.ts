import assert from "node:assert";
import { monthTicks } from "./gantt.ts";

const start = new Date(2024, 4, 1); // maio/2024
const end = new Date(2024, 9, 14); // out/2024
const ticks = monthTicks(start, end);

// um tick por mês virado: jun, jul, ago, set, out = 5
assert.equal(ticks.length, 5);
assert.equal(ticks[0].label, "jun 2024");
assert.equal(ticks[4].label, "out 2024");
// primeiro tick > 0% e último < 100% (dentro do domínio)
assert.ok(ticks[0].x > 0 && ticks[0].x < 100);
assert.ok(ticks[4].x > ticks[0].x);

console.log("gantt.selfcheck OK");
