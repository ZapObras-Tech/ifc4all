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
