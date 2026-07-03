// Atributos escalares mostrados no topo, na ordem do mockup.
const ATTRS: [string, string][] = [
  ["Name", "Name"],
  ["Description", "Description"],
  ["ObjectType", "ObjectType"],
  ["Tag", "Tag"],
  ["PredefinedType", "PredefinedType"],
  ["GlobalId", "GlobalId"],
];

interface Pset { name: string; props: { name: string; value: string }[] }

/** Renderiza atributos + PSets de um único elemento selecionado. */
export function renderProperties(container: HTMLElement, item: any): void {
  container.innerHTML = "";
  if (!item) {
    container.innerHTML = `<p class="empty">Selecione um elemento.</p>`;
    return;
  }
  container.appendChild(buildItemBlock(item));
}

/** Renderiza múltiplos elementos com navegação < > e exportação. */
export function renderPropertiesMulti(
  container: HTMLElement,
  items: any[],
): void {
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = `<p class="empty">Selecione um elemento.</p>`;
    return;
  }
  if (items.length === 1) {
    container.appendChild(buildItemBlock(items[0]));
    return;
  }

  let idx = 0;

  const nav = document.createElement("div");
  nav.className = "props-nav";

  const btnPrev = document.createElement("button");
  btnPrev.className = "props-nav-btn";
  btnPrev.textContent = "\u25C0";

  const counter = document.createElement("span");
  counter.className = "props-nav-counter";

  const btnNext = document.createElement("button");
  btnNext.className = "props-nav-btn";
  btnNext.textContent = "\u25B6";

  const btnExport = document.createElement("button");
  btnExport.className = "props-nav-export";
  btnExport.textContent = "Exportar Todos";
  btnExport.title = "Exportar propriedades de todos os elementos selecionados";
  btnExport.addEventListener("click", () => exportAllCSV(items));

  nav.append(btnPrev, counter, btnNext, btnExport);
  container.appendChild(nav);

  const content = document.createElement("div");
  content.className = "props-content";
  container.appendChild(content);

  const render = () => {
    counter.textContent = `${idx + 1} / ${items.length}`;
    btnPrev.disabled = idx === 0;
    btnNext.disabled = idx === items.length - 1;
    content.innerHTML = "";
    content.appendChild(buildItemBlock(items[idx]));
  };

  btnPrev.addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
  btnNext.addEventListener("click", () => { if (idx < items.length - 1) { idx++; render(); } });
  render();
}

// ── helpers ──────────────────────────────────────────────────────

function buildItemBlock(item: any): HTMLElement {
  const frag = document.createDocumentFragment();

  const head = group("Elemento Selecionado");
  head.container.appendChild(row("Tipo", readCategory(item)));
  for (const [key, label] of ATTRS) {
    const v = readValue(item[key]);
    if (v != null) head.container.appendChild(row(label, v));
  }
  frag.appendChild(head.container);

  for (const pset of extractPsets(item)) {
    const g = group(pset.name);
    for (const p of pset.props) g.container.appendChild(row(p.name, p.value));
    frag.appendChild(g.container);
  }

  const wrap = document.createElement("div");
  wrap.appendChild(frag);
  return wrap;
}

function exportAllCSV(items: any[]) {
  const allRows: string[][] = [["Elemento", "Chave", "Valor"]];
  for (const item of items) {
    const name = readValue(item?.Name) ?? readValue(item?.GlobalId) ?? "?";
    for (const [key, label] of ATTRS) {
      const v = readValue(item[key]);
      if (v != null) allRows.push([name, label, v]);
    }
    for (const pset of extractPsets(item)) {
      for (const p of pset.props) {
        allRows.push([name, `${pset.name} > ${p.name}`, p.value]);
      }
    }
  }
  if (allRows.length <= 1) return;
  const csv = allRows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `propriedades_${items.length}_elementos.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  return c ? String(c) : "\u2014";
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

function group(title: string): { container: HTMLElement } {
  const g = document.createElement("div");
  g.className = "props-group";
  const h = document.createElement("h4");
  h.textContent = title;
  g.appendChild(h);
  return { container: g };
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
