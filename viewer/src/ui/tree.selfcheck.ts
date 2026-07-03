import assert from "node:assert";
import type { SpatialTreeItem } from "@thatopen/fragments";
import { flatten, spatialLabel } from "./tree.ts";

// category + sem localId → só a categoria, sem "#"
assert.equal(spatialLabel({ category: "IFCBUILDINGSTOREY", localId: null }), "IfcBuildingStorey");
// category + localId → categoria (o id não polui o rótulo de contêiner)
assert.equal(spatialLabel({ category: "IFCWALL", localId: 42 }), "IfcWall");
// sem category → cai pro id
assert.equal(spatialLabel({ category: null, localId: 7 }), "#7");
// nada → rótulo neutro
assert.equal(spatialLabel({ category: null, localId: null }), "(sem nome)");

// Project → (#27 sem category) → Site → Wall. O wrapper #27 deve sumir.
const raw = {
  category: "IFCPROJECT",
  localId: 1,
  children: [
    {
      localId: 27, // wrapper de agregação: sem category
      children: [{ category: "IFCSITE", localId: 5, children: [{ category: "IFCWALL", localId: 9 }] }],
    },
  ],
} as unknown as SpatialTreeItem;
const [project] = flatten(raw);
assert.equal(project.category, "IFCPROJECT");
const site = project.children![0];
assert.equal(site.category, "IFCSITE", "Site vira filho direto de Project (wrapper #27 achatado)");
assert.equal(site.localId, 5, "localId preservado");
assert.equal(site.children![0].category, "IFCWALL");

console.log("tree.selfcheck OK");
