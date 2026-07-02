import type { SpatialTreeItem } from "@thatopen/fragments";

export interface TreeHooks {
  onSelect: (localId: number) => void;
}

/** Rótulo de um nó: categoria IFC "humanizada", ou #id, ou fallback. */
export function spatialLabel(item: SpatialTreeItem): string {
  if (item.category) return humanize(item.category);
  if (item.localId != null) return `#${item.localId}`;
  return "(sem nome)";
}

// Palavras compostas sem separador que a heurística genérica (só 1ª letra) erra.
// ponytail: tabela cobre só as categorias espaciais comuns; categoria composta
// desconhecida cai no fallback de 1ª-letra-maiúscula (cosmético, não quebra nada).
const KNOWN_COMPOUNDS: Record<string, string> = {
  buildingstorey: "BuildingStorey",
};

// "IFCBUILDINGSTOREY" → "IfcBuildingStorey", "IFCWALL" → "IfcWall" (só cosmético).
function humanize(cat: string): string {
  const low = cat.toLowerCase();
  if (!low.startsWith("ifc")) return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  const rest = low.slice(3);
  return "Ifc" + (KNOWN_COMPOUNDS[rest] ?? rest.replace(/^./, (c) => c.toUpperCase()));
}

/** Renderiza a árvore espacial. Clique num nó com localId dispara onSelect. */
export function renderTree(container: HTMLElement, root: SpatialTreeItem, hooks: TreeHooks): void {
  container.innerHTML = "";
  container.appendChild(node(root, hooks));
}

function node(item: SpatialTreeItem, hooks: TreeHooks): HTMLElement {
  const wrap = document.createElement("div");
  const row = document.createElement("div");
  row.className = "tree-node";
  const kids = item.children ?? [];

  const caret = document.createElement("span");
  caret.className = "tree-caret";
  caret.textContent = kids.length ? "▾" : "";
  const label = document.createElement("span");
  label.textContent = spatialLabel(item);
  row.append(caret, label);

  if (item.localId != null) {
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      container_selectedClear(row);
      row.classList.add("selected");
      hooks.onSelect(item.localId!);
    });
  }
  wrap.appendChild(row);

  if (kids.length) {
    const childBox = document.createElement("div");
    childBox.className = "tree-children";
    for (const c of kids) childBox.appendChild(node(c, hooks));
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      const hidden = childBox.hidden;
      childBox.hidden = !hidden;
      caret.textContent = hidden ? "▾" : "▸";
    });
    wrap.appendChild(childBox);
  }
  return wrap;
}

function container_selectedClear(row: HTMLElement) {
  const tree = row.closest(".tree");
  tree?.querySelectorAll(".tree-node.selected").forEach((n) => n.classList.remove("selected"));
}
