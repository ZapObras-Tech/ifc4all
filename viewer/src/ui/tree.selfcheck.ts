import assert from "node:assert";
import { spatialLabel } from "./tree.ts";

// category + sem localId → só a categoria, sem "#"
assert.equal(spatialLabel({ category: "IFCBUILDINGSTOREY", localId: null }), "IfcBuildingStorey");
// category + localId → categoria (o id não polui o rótulo de contêiner)
assert.equal(spatialLabel({ category: "IFCWALL", localId: 42 }), "IfcWall");
// sem category → cai pro id
assert.equal(spatialLabel({ category: null, localId: 7 }), "#7");
// nada → rótulo neutro
assert.equal(spatialLabel({ category: null, localId: null }), "(sem nome)");

console.log("tree.selfcheck OK");
