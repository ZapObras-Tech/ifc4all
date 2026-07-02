# Shell Visual do Viewer BIM — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduzir o layout/aparência do mockup como shell de UI completo, com árvore IFC, painel de propriedades e Gantt (tabela+timeline) puxando dados reais; ferramentas não-implementadas como placeholders estilizados.

**Architecture:** Vanilla TS + CSS Grid sobre a stack Vite existente. `index.html` vira um grid de 4 regiões (topbar / rail+painel-esq / centro[viewport+gantt] / painel-dir). Módulos UI pequenos em `src/ui/` preenchem os painéis; `main.ts` liga tudo ao `Viewer`. Zero dependência nova.

**Tech Stack:** TypeScript, Vite, `@thatopen/components@3.4`, `@thatopen/fragments@3.4.6`, `three`, DOM + CSS puros.

## Global Constraints

- **Sem dep nova.** Nada de framework de UI, Tailwind, ou lib de componentes. Só DOM + CSS. (Evita lockstep de versão — ver CLAUDE.md.)
- **Lockstep intocado.** Não bumpar `@thatopen/*`, `three`, `web-ifc`. `WASM_PATH` fica em `unpkg.com/web-ifc@0.0.77/`.
- **`build.target: "esnext"`** no `vite.config.ts` — não rebaixar (top-level await em `main.ts`).
- **Sem framework de teste.** Lógica pura ganha self-check `assert` rodável com `node --experimental-strip-types`. UI/DOM se verifica por `npm run build` verde + inspeção visual no dev server. Segue o padrão do repo (`schedule.selfcheck.ts`).
- **Idioma:** rótulos de UI e comentários em português, com acentuação correta.
- **Placeholders** marcados com `// ponytail:`.
- **Dados reais** apenas em: árvore, propriedades, Gantt. Todo o resto é chrome estático.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `index.html` | Modify | Reestrutura `#app` no grid de 4 regiões; linka `shell.css`. |
| `src/ui/shell.css` | Create | Grid + todo o visual do chrome (topbar, rail, painéis, toolbars flutuantes, empty-states). |
| `src/ui/shell.ts` | Create | `buildShell()` monta o chrome estático e devolve handles dos containers reais. Troca de painel do rail. |
| `src/ui/tree.ts` | Create | `renderTree()` + `spatialLabel()` (puro). Árvore espacial a partir de `getSpatialStructure`. |
| `src/ui/tree.selfcheck.ts` | Create | Self-check de `spatialLabel`. |
| `src/ui/properties.ts` | Create | `renderProperties()` + `extractPsets()`. Tabela de atributos/PSets/dimensões do elemento. |
| `src/ui/gantt.ts` | Modify | Refactor para tabela+timeline com header de meses e linha "Hoje"; mantém scrubber 4D. Adiciona `monthTicks()` (puro). |
| `src/ui/gantt.selfcheck.ts` | Create | Self-check de `monthTicks`. |
| `src/ui/gantt.css` | Modify | Estilos da tabela+timeline. |
| `src/ifc/app.ts` | Modify | Expõe `getSpatial()`, `pickAt()`, `select()`, e getters de `canvas`/`camera`. |
| `src/main.ts` | Modify | Monta shell; liga tree→select→properties+highlight, click no viewport→select, gantt. |

---

## Task 1: Shell chrome + grid

Entrega o layout completo do mockup com painéis vazios. "Importar IFC" continua funcionando; viewport e gantt atuais aparecem nos seus lugares.

**Files:**
- Modify: `index.html`
- Create: `viewer/src/ui/shell.ts`
- Create: `viewer/src/ui/shell.css`
- Modify: `viewer/src/main.ts`

**Interfaces:**
- Produces:
  - `buildShell(root: HTMLElement): ShellHandles`
  - `interface ShellHandles { viewportEl: HTMLElement; ganttEl: HTMLElement; treeEl: HTMLElement; propsEl: HTMLElement; propsTabsEl: HTMLElement; fileInput: HTMLInputElement; statusEl: HTMLElement; fileNameEl: HTMLElement; }`

- [ ] **Step 1: Reescrever `index.html`**

Substituir todo o `<body>` por:

```html
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
```

E trocar o `<link>` do head de `gantt.css` para `shell.css` (o `shell.css` importa o gantt):

```html
    <link rel="stylesheet" href="/src/ui/shell.css" />
```

- [ ] **Step 2: Criar `viewer/src/ui/shell.ts`**

```ts
export interface ShellHandles {
  viewportEl: HTMLElement;
  ganttEl: HTMLElement;
  treeEl: HTMLElement;
  propsEl: HTMLElement;
  propsTabsEl: HTMLElement;
  fileInput: HTMLInputElement;
  statusEl: HTMLElement;
  fileNameEl: HTMLElement;
}

// Ícones do rail. Só "Modelo" tem painel real; resto é placeholder.
const RAIL = [
  "Modelo", "Propriedades", "Camadas", "Medidas", "Cortes",
  "Quantidades", "Anotações", "BCF", "Configurações",
];

const MENUS = ["Arquivo", "Visualizar", "Ferramentas", "Janelas", "Ajuda"];

/** Monta o chrome estático do viewer e devolve os containers que recebem dados reais. */
export function buildShell(root: HTMLElement): ShellHandles {
  root.innerHTML = "";
  root.className = "shell";

  // ---- topbar ----
  const topbar = el("header", "topbar");
  const brand = el("div", "brand");
  brand.textContent = "BIM VIEWER";
  const menus = el("nav", "menus");
  for (const m of MENUS) {
    const b = el("button", "menu-item"); // ponytail: menus decorativos
    b.textContent = m;
    menus.appendChild(b);
  }
  const fileName = el("div", "file-name");
  fileName.textContent = "nenhum modelo carregado";
  const importLabel = el("label", "btn-import") as HTMLLabelElement;
  importLabel.textContent = "Importar IFC";
  const fileInput = el("input", "") as HTMLInputElement;
  fileInput.type = "file";
  fileInput.accept = ".ifc";
  fileInput.hidden = true;
  importLabel.appendChild(fileInput);
  const topActions = el("div", "top-actions");
  for (const g of ["⛶", "?", "🔔"]) { // ponytail: ações decorativas
    const b = el("button", "icon-btn");
    b.textContent = g;
    topActions.appendChild(b);
  }
  const avatar = el("div", "avatar");
  avatar.textContent = "AR";
  topActions.appendChild(avatar);
  topbar.append(brand, menus, fileName, importLabel, topActions);

  // ---- rail ----
  const rail = el("aside", "rail");
  const railBtns: HTMLButtonElement[] = [];
  RAIL.forEach((name, i) => {
    const b = el("button", "rail-btn") as HTMLButtonElement;
    if (i === 0) b.classList.add("active");
    b.textContent = name[0]; // inicial como ícone-placeholder
    b.title = name;
    b.dataset.panel = name;
    railBtns.push(b);
    rail.appendChild(b);
  });
  const railFoot = el("div", "rail-foot");
  railFoot.innerHTML = `<span>Projeto</span><small>v1.0.0</small>`;
  rail.appendChild(railFoot);

  // ---- painel esquerdo ----
  const left = el("aside", "panel panel-left");
  const leftHead = panelHead("MODELO IFC");
  const search = el("input", "tree-search") as HTMLInputElement;
  search.placeholder = "Buscar no modelo…";
  const treeEl = el("div", "tree");
  treeEl.innerHTML = `<p class="empty">Importe um IFC para ver a estrutura.</p>`;
  // Painéis placeholder das outras ferramentas do rail.
  const leftPlaceholder = el("div", "panel-placeholder");
  leftPlaceholder.hidden = true;
  left.append(leftHead, search, treeEl, leftPlaceholder);

  // Troca de painel do rail. ponytail: só "Modelo" tem conteúdo; resto = empty-state.
  const switchPanel = (name: string) => {
    railBtns.forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
    const isModel = name === "Modelo";
    search.hidden = !isModel;
    treeEl.hidden = !isModel;
    leftPlaceholder.hidden = isModel;
    leftPlaceholder.textContent = isModel ? "" : `${name} — em breve`;
    (leftHead.firstChild as Text).textContent = isModel ? "MODELO IFC" : name.toUpperCase();
  };
  railBtns.forEach((b) => b.addEventListener("click", () => switchPanel(b.dataset.panel!)));

  // ---- centro: viewport + gantt ----
  const center = el("main", "center");
  const viewTab = tabHead("VISUALIZAÇÃO 3D");
  const viewportEl = el("div", "viewport");
  const viewportChrome = viewportOverlays();
  viewportEl.appendChild(viewportChrome);
  const ganttHead = tabHead("PLANEJAMENTO - GANTT");
  const ganttEl = el("section", "gantt");
  center.append(viewTab, viewportEl, ganttHead, ganttEl);

  // ---- painel direito ----
  const right = el("aside", "panel panel-right");
  const rightHead = panelHead("PROPRIEDADES");
  const propsTabsEl = el("div", "props-tabs");
  ["Propriedades", "Classificação", "Relações"].forEach((t, i) => {
    const b = el("button", "props-tab") as HTMLButtonElement;
    if (i === 0) b.classList.add("active");
    b.textContent = t;
    propsTabsEl.appendChild(b);
  });
  const propsEl = el("div", "props");
  propsEl.innerHTML = `<p class="empty">Selecione um elemento.</p>`;
  right.append(rightHead, propsTabsEl, propsEl);

  // status oculto (compat com main.ts)
  const statusEl = el("span", "");
  statusEl.hidden = true;

  root.append(topbar, rail, left, center, right, statusEl);

  return { viewportEl, ganttEl, treeEl, propsEl, propsTabsEl, fileInput, statusEl, fileNameEl: fileName };
}

function viewportOverlays(): HTMLElement {
  const wrap = el("div", "vp-chrome");
  // toolbar superior — ponytail: decorativa
  const top = el("div", "vp-toolbar vp-top");
  ["↖", "✋", "⟲", "🚶", "⬚", "✎", "📏", "⋯"].forEach((g) => {
    const b = el("button", "vp-tool");
    b.textContent = g;
    top.appendChild(b);
  });
  // navcube — ponytail: decorativo
  const nav = el("div", "navcube");
  nav.textContent = "TOP";
  // zoom — ponytail: decorativo
  const zoom = el("div", "vp-zoom");
  ["+", "−", "⤢"].forEach((g) => {
    const b = el("button", "vp-tool");
    b.textContent = g;
    zoom.appendChild(b);
  });
  // toolbar inferior — ponytail: decorativa
  const bottom = el("div", "vp-toolbar vp-bottom");
  ["◫", "◑", "👁", "⚙"].forEach((g) => {
    const b = el("button", "vp-tool");
    b.textContent = g;
    bottom.appendChild(b);
  });
  wrap.append(top, nav, zoom, bottom);
  return wrap;
}

function panelHead(text: string): HTMLElement {
  const h = el("div", "panel-head");
  h.appendChild(document.createTextNode(text));
  const x = el("button", "panel-close");
  x.textContent = "×";
  h.appendChild(x);
  return h;
}

function tabHead(text: string): HTMLElement {
  const h = el("div", "tab-head");
  const t = el("span", "tab active");
  t.textContent = text;
  h.appendChild(t);
  return h;
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
```

- [ ] **Step 3: Criar `viewer/src/ui/shell.css`**

```css
@import "./gantt.css";

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #1f2937;
  background: #eef1f5;
}
button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
.empty { color: #9ca3af; font-size: 13px; padding: 12px; }

.shell {
  display: grid;
  grid-template-columns: 56px 260px 1fr 320px;
  grid-template-rows: 56px 1fr;
  height: 100vh;
}

/* topbar */
.topbar {
  grid-column: 1 / -1;
  display: flex; align-items: center; gap: 16px;
  padding: 0 16px; background: #0f172a; color: #e5e7eb;
}
.brand { font-weight: 700; letter-spacing: .5px; color: #fff; }
.menus { display: flex; gap: 4px; }
.menu-item { padding: 6px 10px; border-radius: 6px; color: #cbd5e1; font-size: 14px; }
.menu-item:hover { background: #1e293b; }
.file-name { margin-left: auto; margin-right: auto; font-size: 14px; color: #cbd5e1; }
.btn-import { background: #2563eb; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 14px; }
.btn-import:hover { background: #1d4ed8; }
.top-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn { width: 32px; height: 32px; border-radius: 8px; color: #cbd5e1; }
.icon-btn:hover { background: #1e293b; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: #475569; color: #fff;
  display: grid; place-items: center; font-size: 12px; }

/* rail */
.rail {
  grid-row: 2; background: #111827;
  display: flex; flex-direction: column; align-items: center; padding: 8px 0;
}
.rail-btn { width: 40px; height: 40px; margin: 4px 0; border-radius: 10px;
  color: #9ca3af; font-weight: 600; }
.rail-btn:hover { background: #1f2937; color: #e5e7eb; }
.rail-btn.active { background: #2563eb; color: #fff; }
.rail-foot { margin-top: auto; color: #6b7280; font-size: 10px; text-align: center; }
.rail-foot span { display: block; }

/* painéis */
.panel { grid-row: 2; background: #fff; border-left: 1px solid #e5e7eb;
  display: flex; flex-direction: column; overflow: hidden; }
.panel-left { border-left: none; border-right: 1px solid #e5e7eb; }
.panel-head { display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; font-size: 12px; font-weight: 700; letter-spacing: .4px; color: #374151; }
.panel-close { color: #9ca3af; font-size: 18px; line-height: 1; }
.panel-placeholder { padding: 24px 14px; color: #9ca3af; font-size: 13px; }

/* árvore */
.tree-search { margin: 0 12px 8px; padding: 8px 10px; border: 1px solid #e5e7eb;
  border-radius: 8px; font-size: 13px; }
.tree { overflow: auto; flex: 1; padding: 4px 6px; }
.tree-node { display: flex; align-items: center; gap: 4px; padding: 3px 6px;
  border-radius: 6px; font-size: 13px; white-space: nowrap; cursor: pointer; }
.tree-node:hover { background: #f3f4f6; }
.tree-node.selected { background: #dbeafe; color: #1d4ed8; }
.tree-caret { width: 14px; color: #9ca3af; }
.tree-children { padding-left: 14px; }

/* centro */
.center { grid-row: 2; display: flex; flex-direction: column; background: #f8fafc; overflow: hidden; }
.tab-head { padding: 8px 14px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.tab { font-size: 12px; font-weight: 700; color: #374151; padding: 4px 8px;
  border-radius: 6px 6px 0 0; }
.tab.active { color: #2563eb; }
.viewport { position: relative; flex: 1; min-height: 0; }
.viewport canvas { display: block; width: 100%; height: 100%; }
.gantt { height: 320px; overflow: auto; background: #fff; border-top: 1px solid #e5e7eb; }

/* overlays do viewport (decorativos) */
.vp-chrome { position: absolute; inset: 0; pointer-events: none; }
.vp-chrome button { pointer-events: auto; }
.vp-toolbar { position: absolute; display: flex; gap: 4px; background: #fff;
  padding: 6px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.vp-top { top: 12px; left: 12px; }
.vp-bottom { bottom: 12px; left: 50%; transform: translateX(-50%); }
.vp-zoom { position: absolute; top: 90px; right: 12px; display: flex; flex-direction: column;
  gap: 4px; background: #fff; padding: 6px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.vp-tool { width: 30px; height: 30px; border-radius: 8px; color: #374151; }
.vp-tool:hover { background: #f3f4f6; }
.navcube { position: absolute; top: 12px; right: 12px; width: 60px; height: 60px;
  background: #fff; border-radius: 8px; display: grid; place-items: center;
  font-size: 10px; color: #6b7280; box-shadow: 0 2px 8px rgba(0,0,0,.12); }

/* propriedades */
.props-tabs { display: flex; gap: 2px; padding: 0 12px; border-bottom: 1px solid #e5e7eb; }
.props-tab { padding: 8px 10px; font-size: 13px; color: #6b7280; border-bottom: 2px solid transparent; }
.props-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
.props { overflow: auto; flex: 1; }
.props-group { padding: 8px 0; }
.props-group h4 { margin: 0; padding: 8px 14px; font-size: 12px; color: #6b7280;
  background: #f9fafb; }
.props-row { display: grid; grid-template-columns: 40% 60%; padding: 6px 14px;
  font-size: 13px; border-bottom: 1px solid #f3f4f6; }
.props-row .k { color: #6b7280; }
.props-row .v { color: #111827; text-align: right; word-break: break-word; }
```

- [ ] **Step 4: Reescrever `viewer/src/main.ts` para montar o shell**

```ts
import { Viewer } from "./ifc/app";
import { buildSchedule } from "./ifc/schedule";
import { Gantt } from "./ui/gantt";
import { buildShell } from "./ui/shell";

const root = document.getElementById("app")!;
const h = buildShell(root);

const viewer = new Viewer();
const gantt = new Gantt();

await viewer.init(h.viewportEl);

h.fileInput.addEventListener("change", async () => {
  const file = h.fileInput.files?.[0];
  if (!file) return;
  h.fileNameEl.textContent = `carregando ${file.name}…`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const model = await viewer.loadIfc(bytes, file.name.replace(/\.ifc$/i, ""));
  if (!model) {
    h.fileNameEl.textContent = "falha ao carregar modelo";
    return;
  }

  const tasks = await buildSchedule(model);
  h.fileNameEl.textContent = file.name;

  gantt.render(h.ganttEl, tasks, {
    onScrub: (_date, visible, hidden) => {
      viewer.setElementsVisible(hidden, false);
      viewer.setElementsVisible(visible, true);
    },
  });
});
```

- [ ] **Step 5: Typecheck + build**

Rodar de `viewer/`:
```bash
npm run build
```
Esperado: PASS (tsc --noEmit + vite build sem erros).

- [ ] **Step 6: Verificação visual**

```bash
npm run dev
```
Abrir http://localhost:5173. Esperado: chrome completo do mockup (topbar escura, rail de ícones, painel MODELO IFC vazio, viewport com grid 3D e overlays flutuantes, faixa PLANEJAMENTO-GANTT, painel PROPRIEDADES vazio). Clicar nos ícones do rail troca o título/estado do painel esquerdo (só "Modelo" mostra a árvore). "Importar IFC" carrega um `.ifc` e o modelo aparece no viewport + gantt embaixo. Sem erros no console.

- [ ] **Step 7: Commit**

```bash
git add index.html viewer/src/ui/shell.ts viewer/src/ui/shell.css viewer/src/main.ts
git commit -m "feat: shell visual do viewer (grid + chrome estático)"
```

---

## Task 2: Árvore espacial IFC (real)

Preenche o painel MODELO IFC com a estrutura do modelo via `getSpatialStructure`. Clique num nó dispara callback com o `localId` (fiação de seleção vem na Task 3).

**Files:**
- Modify: `viewer/src/ifc/app.ts`
- Create: `viewer/src/ui/tree.ts`
- Create: `viewer/src/ui/tree.selfcheck.ts`
- Modify: `viewer/src/main.ts`

**Interfaces:**
- Consumes (de app.ts): `viewer.model`, `ShellHandles.treeEl`
- Produces:
  - `Viewer.getSpatial(): Promise<SpatialTreeItem | null>`
  - `renderTree(container: HTMLElement, root: SpatialTreeItem, hooks: { onSelect: (localId: number) => void }): void`
  - `spatialLabel(item: SpatialTreeItem): string`

- [ ] **Step 1: Adicionar `getSpatial` ao `Viewer` (`app.ts`)**

No topo, garantir o import de tipo:
```ts
import type * as FRAGS from "@thatopen/fragments";
```
(já existe). Adicionar método na classe `Viewer`, após `setElementsVisible`:
```ts
  /** Estrutura espacial (IfcProject → Site → Building → Storey → elementos). */
  async getSpatial(): Promise<FRAGS.SpatialTreeItem | null> {
    if (!this.model) return null;
    return this.model.getSpatialStructure();
  }
```

- [ ] **Step 2: Escrever o self-check de `spatialLabel` (`tree.selfcheck.ts`)**

```ts
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
```

- [ ] **Step 3: Rodar o self-check e ver falhar**

```bash
node --experimental-strip-types viewer/src/ui/tree.selfcheck.ts
```
Esperado: FAIL (`Cannot find module './tree.ts'` ou `spatialLabel is not a function`).

- [ ] **Step 4: Escrever `viewer/src/ui/tree.ts`**

```ts
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

// "IFCBUILDINGSTOREY" → "IfcBuildingStorey" (só cosmético).
function humanize(cat: string): string {
  const low = cat.toLowerCase();
  return low.startsWith("ifc")
    ? "Ifc" + low.slice(3).replace(/^./, (c) => c.toUpperCase())
    : cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
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
```

- [ ] **Step 5: Rodar o self-check e ver passar**

```bash
node --experimental-strip-types viewer/src/ui/tree.selfcheck.ts
```
Esperado: `tree.selfcheck OK`.

- [ ] **Step 6: Ligar a árvore no `main.ts`**

Adicionar import:
```ts
import { renderTree } from "./ui/tree";
```
Dentro do handler de `change`, depois de `buildSchedule` e antes do `gantt.render`, inserir:
```ts
  const spatial = await viewer.getSpatial();
  if (spatial) {
    renderTree(h.treeEl, spatial, {
      onSelect: (localId) => {
        // ponytail: seleção completa (highlight + propriedades) vem na Task 3.
        console.log("selecionado localId", localId);
      },
    });
  }
```

- [ ] **Step 7: Build + verificação visual**

```bash
npm run build && npm run dev
```
Esperado: build PASS. Ao importar um IFC, o painel MODELO IFC mostra a árvore (IfcProject → … → pavimentos/elementos), carets expandem/colapsam, clique num elemento loga o `localId` no console.

- [ ] **Step 8: Commit**

```bash
git add viewer/src/ifc/app.ts viewer/src/ui/tree.ts viewer/src/ui/tree.selfcheck.ts viewer/src/main.ts
git commit -m "feat: arvore espacial IFC no painel do modelo"
```

---

## Task 3: Propriedades + highlight de seleção (real)

Selecionar um nó da árvore realça o elemento no 3D e preenche o painel PROPRIEDADES.

**Files:**
- Modify: `viewer/src/ifc/app.ts`
- Create: `viewer/src/ui/properties.ts`
- Modify: `viewer/src/main.ts`

**Interfaces:**
- Consumes: `viewer.model`, `ShellHandles.propsEl`, `renderTree` onSelect
- Produces:
  - `Viewer.select(localId: number): Promise<void>` — realça o elemento (reseta o anterior)
  - `Viewer.getItemData(localId: number): Promise<any | null>` — atributos + PSets do elemento
  - `renderProperties(container: HTMLElement, item: any): void`

- [ ] **Step 1: Adicionar highlight + getItemData ao `Viewer` (`app.ts`)**

Adicionar imports no topo:
```ts
import * as THREE from "three";
import { RenderedFaces } from "@thatopen/fragments";
```
Adicionar campo na classe (junto de `model?`):
```ts
  private selected?: number;
```
Adicionar constante de material acima da classe:
```ts
const SELECT_MAT = {
  color: new THREE.Color("#2563eb"),
  renderedFaces: RenderedFaces.TWO,
  opacity: 1,
  transparent: false,
};
```
Adicionar métodos após `setElementsVisible`:
```ts
  /** Realça um elemento, resetando o realce anterior. */
  async select(localId: number): Promise<void> {
    if (!this.model) return;
    if (this.selected != null) await this.model.resetHighlight([this.selected]);
    await this.model.highlight([localId], SELECT_MAT);
    this.selected = localId;
    await this.fragments.core.update(true);
  }

  /** Atributos + PSets de um elemento (para o painel de propriedades). */
  async getItemData(localId: number): Promise<any | null> {
    if (!this.model) return null;
    const [item] = await this.model.getItemsData([localId], {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        ContainedInStructure: { attributes: true, relations: false },
      },
    });
    return item ?? null;
  }
```

- [ ] **Step 2: Escrever `viewer/src/ui/properties.ts`**

```ts
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
```

- [ ] **Step 3: Ligar seleção no `main.ts`**

Adicionar imports:
```ts
import { renderProperties } from "./ui/properties";
```
Substituir o `onSelect` da Task 2 por:
```ts
      onSelect: async (localId) => {
        await viewer.select(localId);
        const item = await viewer.getItemData(localId);
        renderProperties(h.propsEl, item);
      },
```

- [ ] **Step 4: Build**

```bash
npm run build
```
Esperado: PASS.

- [ ] **Step 5: Verificação visual**

```bash
npm run dev
```
Importar IFC → clicar num elemento (ex. parede) na árvore. Esperado: elemento fica azul no 3D; painel PROPRIEDADES mostra "Elemento Selecionado" (Tipo/Name/GlobalId/…) + grupos de PSet. Selecionar outro elemento reseta o realce do anterior. Sem erros no console.

- [ ] **Step 6: Commit**

```bash
git add viewer/src/ifc/app.ts viewer/src/ui/properties.ts viewer/src/main.ts
git commit -m "feat: painel de propriedades + highlight na selecao da arvore"
```

---

## Task 4: Seleção por clique no viewport

Clicar no modelo 3D seleciona o elemento pela mesma rota (highlight + propriedades).

**Files:**
- Modify: `viewer/src/ifc/app.ts`
- Modify: `viewer/src/main.ts`

**Interfaces:**
- Consumes: `viewer.select`, `viewer.getItemData`, `ShellHandles.viewportEl`, `ShellHandles.propsEl`
- Produces:
  - `Viewer.pickAt(clientX: number, clientY: number): Promise<number | null>` — raycast → localId
  - `Viewer.canvas: HTMLCanvasElement` (getter)

- [ ] **Step 1: Adicionar `pickAt` + getter `canvas` ao `Viewer` (`app.ts`)**

Adicionar reuso de `THREE` (já importado na Task 3). Adicionar métodos após `getItemData`:
```ts
  /** Canvas do renderer, para eventos de ponteiro. */
  get canvas(): HTMLCanvasElement {
    return this.world.renderer!.three.domElement;
  }

  /** Raycast na posição do ponteiro → localId do elemento (ou null). */
  async pickAt(clientX: number, clientY: number): Promise<number | null> {
    if (!this.model) return null;
    const mouse = new THREE.Vector2(clientX, clientY);
    const res = await this.model.raycast({
      camera: this.world.camera.three as THREE.PerspectiveCamera,
      mouse,
      dom: this.canvas,
    });
    return res?.localId ?? null;
  }
```

- [ ] **Step 2: Ligar clique no viewport no `main.ts`**

Depois de `await viewer.init(h.viewportEl);`, adicionar:
```ts
viewer.canvas.addEventListener("click", async (e) => {
  const localId = await viewer.pickAt(e.clientX, e.clientY);
  if (localId == null) return;
  await viewer.select(localId);
  const item = await viewer.getItemData(localId);
  renderProperties(h.propsEl, item);
});
```

- [ ] **Step 3: Build**

```bash
npm run build
```
Esperado: PASS.

- [ ] **Step 4: Verificação visual**

```bash
npm run dev
```
Importar IFC → clicar direto numa peça no 3D. Esperado: peça realça em azul e o painel PROPRIEDADES preenche, igual ao clique na árvore. Clicar no vazio não quebra (nada acontece). Sem erros no console.

- [ ] **Step 5: Commit**

```bash
git add viewer/src/ifc/app.ts viewer/src/main.ts
git commit -m "feat: selecao por clique no viewport (raycast)"
```

---

## Task 5: Gantt tabela + timeline (refactor)

O painel Gantt vira o layout do mockup: tabela de tarefas à esquerda + timeline com header de meses e linha "Hoje" à direita. Scrubber 4D preservado.

**Files:**
- Modify: `viewer/src/ui/gantt.ts`
- Create: `viewer/src/ui/gantt.selfcheck.ts`
- Modify: `viewer/src/ui/gantt.css`

**Interfaces:**
- Consumes: `ElementTask[]` de `buildSchedule` (inalterado), `GanttHooks.onScrub` (inalterado)
- Produces:
  - `monthTicks(start: Date, end: Date): { label: string; x: number }[]` — marcações de mês em % do domínio
  - `Gantt.render` mantém a mesma assinatura pública

- [ ] **Step 1: Escrever o self-check de `monthTicks` (`gantt.selfcheck.ts`)**

```ts
import assert from "node:assert";
import { monthTicks } from "./gantt.ts";

const start = new Date(2024, 4, 1);  // maio/2024
const end = new Date(2024, 9, 14);   // out/2024
const ticks = monthTicks(start, end);

// um tick por mês virado: jun, jul, ago, set, out = 5
assert.equal(ticks.length, 5);
assert.equal(ticks[0].label, "jun 2024");
assert.equal(ticks[4].label, "out 2024");
// primeiro tick > 0% e último < 100% (dentro do domínio)
assert.ok(ticks[0].x > 0 && ticks[0].x < 100);
assert.ok(ticks[4].x > ticks[0].x);

console.log("gantt.selfcheck OK");
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --experimental-strip-types viewer/src/ui/gantt.selfcheck.ts
```
Esperado: FAIL (`monthTicks is not a function`).

- [ ] **Step 3: Refatorar `viewer/src/ui/gantt.ts`**

Substituir o corpo por (mantém `x()`, scrubber e agrupamento; troca o `render`/`axis`/`row` por tabela+timeline):

```ts
import type { ElementTask } from "../ifc/schedule";

export interface GanttHooks {
  onScrub: (date: Date, visibleIds: number[], hiddenIds: number[]) => void;
}

interface Group {
  key: string;
  label: string;
  tasks: ElementTask[];
  start: Date;
  finish: Date;
}

const MS_DAY = 86_400_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const BAR_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899"];

/** Marcações de mês (viradas de mês dentro do domínio), em % da largura. */
export function monthTicks(start: Date, end: Date): { label: string; x: number }[] {
  const span = end.getTime() - start.getTime() || 1;
  const ticks: { label: string; x: number }[] = [];
  const d = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (d.getTime() < end.getTime()) {
    ticks.push({
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      x: ((d.getTime() - start.getTime()) / span) * 100,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}

/** Painel de cronograma tipo MS Project: tabela + timeline + scrubber 4D. */
export class Gantt {
  private domainStart = 0;
  private domainEnd = 1;

  render(container: HTMLElement, tasks: ElementTask[], hooks: GanttHooks) {
    container.innerHTML = "";
    if (tasks.length === 0) {
      container.innerHTML = `<p class="empty">Nenhum elemento com StartDate/FinishDate encontrado.</p>`;
      return;
    }

    this.domainStart = Math.min(...tasks.map((t) => t.start.getTime()));
    this.domainEnd = Math.max(...tasks.map((t) => t.finish.getTime()));
    const groups = this.buildGroups(tasks);

    container.appendChild(this.toolbar());
    const body = document.createElement("div");
    body.className = "gantt-body";
    body.append(this.table(groups), this.timeline(groups));
    container.appendChild(body);
    container.appendChild(this.scrubber(tasks, hooks));
  }

  private buildGroups(tasks: ElementTask[]): Group[] {
    const map = new Map<string, ElementTask[]>();
    for (const t of tasks) {
      const key = `${t.building} ▸ ${t.storey} ▸ ${t.eap}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    const groups: Group[] = [...map].map(([key, ts]) => ({
      key,
      label: key,
      tasks: ts,
      start: new Date(Math.min(...ts.map((t) => t.start.getTime()))),
      finish: new Date(Math.max(...ts.map((t) => t.finish.getTime()))),
    }));
    return groups.sort(
      (a, b) => a.start.getTime() - b.start.getTime() || a.label.localeCompare(b.label),
    );
  }

  private x(ms: number): number {
    const span = this.domainEnd - this.domainStart || 1;
    return ((ms - this.domainStart) / span) * 100;
  }

  private toolbar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "gantt-toolbar";
    // ponytail: botões decorativos exceto o que já existe (scrubber cuida do 4D)
    const left = ["+ Nova Tarefa", "Vincular ao IFC", "Configurações"];
    const right = ["Hoje", "Semanas ▾", "Filtro", "⤢"];
    const mk = (labels: string[], cls: string) => {
      const box = document.createElement("div");
      box.className = cls;
      for (const l of labels) {
        const b = document.createElement("button");
        b.className = "gantt-btn";
        b.textContent = l;
        box.appendChild(b);
      }
      return box;
    };
    bar.append(mk(left, "gantt-tb-left"), mk(right, "gantt-tb-right"));
    return bar;
  }

  private table(groups: Group[]): HTMLElement {
    const t = document.createElement("div");
    t.className = "gantt-table";
    const header = document.createElement("div");
    header.className = "gantt-tr gantt-th";
    for (const c of ["ID", "Nome da Tarefa", "Início", "Término", "Duração"]) {
      const cell = document.createElement("span");
      cell.textContent = c;
      header.appendChild(cell);
    }
    t.appendChild(header);
    groups.forEach((g, i) => {
      const days = Math.round((g.finish.getTime() - g.start.getTime()) / MS_DAY);
      const tr = document.createElement("div");
      tr.className = "gantt-tr";
      const cells = [String(i + 1), g.label, fmt(g.start), fmt(g.finish), `${days}d`];
      cells.forEach((c, j) => {
        const cell = document.createElement("span");
        cell.textContent = c;
        if (j === 1) cell.title = `${g.tasks.length} elementos`;
        tr.appendChild(cell);
      });
      t.appendChild(tr);
    });
    return t;
  }

  private timeline(groups: Group[]): HTMLElement {
    const tl = document.createElement("div");
    tl.className = "gantt-timeline";

    // header de meses
    const head = document.createElement("div");
    head.className = "gantt-months";
    for (const tick of monthTicks(new Date(this.domainStart), new Date(this.domainEnd))) {
      const m = document.createElement("span");
      m.className = "gantt-month";
      m.style.left = `${tick.x}%`;
      m.textContent = tick.label;
      head.appendChild(m);
    }
    tl.appendChild(head);

    // linhas de barras
    const rows = document.createElement("div");
    rows.className = "gantt-bars";
    groups.forEach((g, i) => {
      const track = document.createElement("div");
      track.className = "gantt-track";
      const bar = document.createElement("div");
      bar.className = "gantt-bar";
      bar.style.left = `${this.x(g.start.getTime())}%`;
      bar.style.width = `${Math.max(0.5, this.x(g.finish.getTime()) - this.x(g.start.getTime()))}%`;
      bar.style.background = BAR_COLORS[i % BAR_COLORS.length];
      bar.title = `${fmt(g.start)} → ${fmt(g.finish)}`;
      track.appendChild(bar);
      rows.appendChild(track);
    });
    // linha "Hoje" (2026-07-02 fica fora do domínio de teste; só aparece se dentro)
    const today = Date.now();
    if (today >= this.domainStart && today <= this.domainEnd) {
      const line = document.createElement("div");
      line.className = "gantt-today";
      line.style.left = `${this.x(today)}%`;
      rows.appendChild(line);
    }
    tl.appendChild(rows);
    return tl;
  }

  private scrubber(tasks: ElementTask[], hooks: GanttHooks): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "gantt-scrubber";
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1000";
    input.value = "1000";
    const readout = document.createElement("span");
    readout.className = "gantt-date";

    const apply = () => {
      const frac = Number(input.value) / 1000;
      const t = this.domainStart + frac * (this.domainEnd - this.domainStart);
      const date = new Date(t);
      readout.textContent = fmt(date);
      const visible: number[] = [];
      const hidden: number[] = [];
      for (const task of tasks) {
        (task.start.getTime() <= t ? visible : hidden).push(task.localId);
      }
      hooks.onScrub(date, visible, hidden);
    };
    input.addEventListener("input", apply);
    apply();

    wrap.append(document.createTextNode("Data: "), readout, input);
    return wrap;
  }
}

function fmt(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}
```

- [ ] **Step 4: Rodar o self-check e ver passar**

```bash
node --experimental-strip-types viewer/src/ui/gantt.selfcheck.ts
```
Esperado: `gantt.selfcheck OK`.

- [ ] **Step 5: Garantir que o self-check de datas continua verde**

```bash
node --experimental-strip-types viewer/src/ifc/schedule.selfcheck.ts
```
Esperado: passa (o refactor não tocou em `schedule.ts`).

- [ ] **Step 6: Estender `viewer/src/ui/gantt.css`**

Anexar ao final do arquivo (substitui o visual antigo de `gantt-grid`/`gantt-axis`/`gantt-label` se existir; pode remover regras órfãs desses seletores):

```css
.gantt-toolbar { display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; background: #fff; z-index: 2; }
.gantt-tb-left, .gantt-tb-right { display: flex; gap: 6px; }
.gantt-btn { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 13px; color: #374151; background: #fff; }
.gantt-btn:hover { background: #f3f4f6; }

.gantt-body { display: grid; grid-template-columns: 520px 1fr; }
.gantt-table { border-right: 1px solid #e5e7eb; }
.gantt-tr { display: grid; grid-template-columns: 40px 1fr 90px 90px 70px;
  align-items: center; height: 32px; padding: 0 8px; font-size: 13px;
  border-bottom: 1px solid #f3f4f6; }
.gantt-tr span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gantt-th { font-weight: 600; color: #6b7280; background: #f9fafb; position: sticky; top: 0; }

.gantt-timeline { position: relative; overflow: hidden; }
.gantt-months { position: relative; height: 32px; border-bottom: 1px solid #f3f4f6;
  background: #f9fafb; }
.gantt-month { position: absolute; top: 8px; font-size: 12px; color: #6b7280;
  border-left: 1px solid #e5e7eb; padding-left: 4px; }
.gantt-bars { position: relative; }
.gantt-track { position: relative; height: 32px; border-bottom: 1px solid #f3f4f6; }
.gantt-bar { position: absolute; top: 7px; height: 18px; border-radius: 5px; min-width: 4px; }
.gantt-today { position: absolute; top: 0; bottom: 0; width: 0;
  border-left: 2px dashed #ef4444; }

.gantt-scrubber { display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-top: 1px solid #e5e7eb; position: sticky; bottom: 0; background: #fff; }
.gantt-scrubber input[type="range"] { flex: 1; }
.gantt-date { font-size: 13px; color: #374151; min-width: 90px; }
```

- [ ] **Step 7: Build + verificação visual**

```bash
npm run build && npm run dev
```
Esperado: build PASS. Ao importar IFC com cronograma, o Gantt mostra: toolbar (Nova Tarefa/Vincular/Config à esquerda, Hoje/Semanas/Filtro à direita), tabela ID/Nome/Início/Término/Duração à esquerda, barras coloridas alinhadas ao header de meses à direita. O scrubber embaixo ainda oculta/mostra elementos no 3D conforme a data. Sem erros no console.

- [ ] **Step 8: Commit**

```bash
git add viewer/src/ui/gantt.ts viewer/src/ui/gantt.selfcheck.ts viewer/src/ui/gantt.css
git commit -m "feat: gantt tabela + timeline com header de meses e linha hoje"
```

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:** shell/grid → Task 1; rail+troca de painel → Task 1; árvore real → Task 2; propriedades real → Task 3; seleção viewport → Task 4; gantt tabela+timeline → Task 5; placeholders (menus, rail, toolbars, abas, ferramentas) → Task 1. `getSpatialStructure` → Task 2. Highlight → Task 3. Tudo coberto.
- **Placeholders de plano:** nenhum "TBD"/"etc" em passos de código; todo código é concreto.
- **Consistência de tipos:** `SpatialTreeItem` (fragments) usado em `getSpatial`/`renderTree`/`spatialLabel`; `select`/`getItemData`/`pickAt`/`canvas` definidos na app.ts e consumidos no main.ts com os mesmos nomes; `monthTicks` idêntico entre gantt.ts e o self-check; `GanttHooks.onScrub` inalterado (compat com main.ts).
- **Ordem:** cada task compila e é verificável isolada; seleção (T3) usada por T4; T5 independente.
```
