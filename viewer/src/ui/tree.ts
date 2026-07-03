import type { SpatialTreeItem } from "@thatopen/fragments";

export interface TreeHooks {
  onSelect: (localId: number) => void;
  labelMap?: Map<number, string>;
}

/** Rótulo de um nó: labelMap override, categoria IFC "humanizada", ou #id. */
export function spatialLabel(item: SpatialTreeItem, labelMap?: Map<number, string>): string {
  if (item.localId != null && labelMap?.has(item.localId)) return labelMap.get(item.localId)!;
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

/**
 * Nós sem `category` são wrappers de agregação. `IFCBUILDING` é pulado para
 * mostrar IfcSite ▸ IfcBuildingStorey direto (padrão BIM).
 */
const SKIP_CATEGORIES = new Set(["IFCBUILDING"]);

export function flatten(item: SpatialTreeItem): SpatialTreeItem[] {
  const kids = (item.children ?? []).flatMap(flatten);
  if (item.category == null || SKIP_CATEGORIES.has(item.category)) return kids;
  return [{ ...item, children: kids }];
}

/** Renderiza a árvore espacial com o arquivo como raiz. */
export function renderTree(
  container: HTMLElement,
  filename: string,
  root: SpatialTreeItem,
  hooks: TreeHooks,
): void {
  container.innerHTML = "";

  // Root node: filename with caret
  const wrap = document.createElement("div");
  const row = document.createElement("div");
  row.className = "tree-node tree-root";
  const caret = document.createElement("span");
  caret.className = "tree-caret";
  caret.textContent = "▾";
  const label = document.createElement("span");
  label.textContent = filename;
  row.append(caret, label);
  wrap.appendChild(row);

  const childBox = document.createElement("div");
  childBox.className = "tree-children";
  for (const item of flatten(root)) childBox.appendChild(node(item, hooks));
  wrap.appendChild(childBox);

  caret.addEventListener("click", (e) => {
    e.stopPropagation();
    const hidden = childBox.hidden;
    childBox.hidden = !hidden;
    caret.textContent = hidden ? "▾" : "▸";
  });

  container.appendChild(wrap);
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
  label.textContent = spatialLabel(item, hooks.labelMap);
  row.append(caret, label);

  if (item.localId != null) {
    row.dataset.localId = String(item.localId);
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

/** Seleciona um nó da árvore por localId (para sync viewport → tree). */
export function selectNodeById(container: HTMLElement, localId: number): void {
  container.querySelectorAll(".tree-node.selected").forEach((n) => n.classList.remove("selected"));
  const row = container.querySelector<HTMLElement>(`.tree-node[data-local-id="${localId}"]`);
  if (!row) return;
  row.classList.add("selected");
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
