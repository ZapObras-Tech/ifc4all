// Atributos escalares mostrados no topo, na ordem do mockup.
const ATTRS: [string, string][] = [
  ["Name", "Name"],
  ["Description", "Description"],
  ["ObjectType", "ObjectType"],
  ["Tag", "Tag"],
  ["PredefinedType", "PredefinedType"],
  ["GlobalId", "GlobalId"],
];

/** Renderiza atributos + PSets do elemento selecionado. */
export function renderProperties(container: HTMLElement, item: any): void {
  container.innerHTML = "";
  if (!item) {
    container.innerHTML = `<p class="empty">Selecione um elemento.</p>`;
    return;
  }

  const head = group("Elemento Selecionado");
  head.appendChild(row("Tipo", readCategory(item)));
  for (const [key, label] of ATTRS) {
    const v = readValue(item[key]);
    if (v != null) head.appendChild(row(label, v));
  }
  container.appendChild(head);

  for (const pset of extractPsets(item)) {
    const g = group(pset.name);
    for (const p of pset.props) g.appendChild(row(p.name, p.value));
    container.appendChild(g);
  }
}

interface Pset { name: string; props: { name: string; value: string }[] }

/** Extrai PSets do IsDefinedBy: cada relação com HasProperties vira um grupo. */
export function extractPsets(item: any): Pset[] {
  const rels = asArray(item?.IsDefinedBy);
  const out: Pset[] = [];
  for (const rel of rels) {
    const props = asArray(rel?.HasProperties);
    if (!props.length) continue;
    const name = readValue(rel?.Name) ?? "Pset";
    const list = props
      .map((p: any) => ({ name: readValue(p?.Name) ?? "", value: readValue(p?.NominalValue) ?? "" }))
      .filter((p: { name: string }) => p.name);
    if (list.length) out.push({ name, props: list });
  }
  return out;
}

function readCategory(item: any): string {
  const c = item?._category?.value ?? item?._category ?? item?.category;
  return c ? String(c) : "—";
}

function readValue(v: any): string | null {
  if (v == null) return null;
  const inner = v.value ?? v;
  if (inner == null || typeof inner === "object") return null;
  return String(inner);
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function group(title: string): HTMLElement {
  const g = document.createElement("div");
  g.className = "props-group";
  const h = document.createElement("h4");
  h.textContent = title;
  g.appendChild(h);
  return g;
}

function row(k: string, v: string): HTMLElement {
  const r = document.createElement("div");
  r.className = "props-row";
  const kk = document.createElement("span");
  kk.className = "k";
  kk.textContent = k;
  const vv = document.createElement("span");
  vv.className = "v";
  vv.textContent = v;
  r.append(kk, vv);
  return r;
}
