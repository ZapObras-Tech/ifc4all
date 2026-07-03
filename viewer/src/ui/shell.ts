export interface ShellHandles {
  viewportEl: HTMLElement;
  ganttEl: HTMLElement;
  treeEl: HTMLElement;
  propsEl: HTMLElement;
  fileInput: HTMLInputElement;
}

/**
 * Canvas 3D infinito ao fundo, três painéis flutuantes por cima:
 * ESQUERDA = árvore, DIREITA = propriedades, BAIXO = gantt.
 * Painéis laterais são redimensionáveis; minimizar vira um ícone flutuante.
 */
export function buildShell(root: HTMLElement): ShellHandles {
  root.innerHTML = "";
  root.className = "shell";

  // ---- canvas de fundo (tela cheia) ----
  const viewportEl = el("div", "viewport");

  // ---- barra flutuante de import ----
  const bar = el("div", "topbar-float");
  const brand = el("span", "brand");
  brand.textContent = "BIM VIEWER";
  const fileInput = el("input", "") as HTMLInputElement;
  fileInput.type = "file";
  fileInput.accept = ".ifc";
  fileInput.multiple = true;
  fileInput.hidden = true;
  const importBtn = el("label", "btn-import-icon") as HTMLLabelElement;
  importBtn.title = "Importar IFC";
  importBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  importBtn.appendChild(fileInput);
  bar.append(brand, importBtn);

  // ---- painel esquerdo: árvore ----
  const left = floatPanel("MODELO IFC", "panel-left", "🗂");
  addResize(left.panel, "left");
  const search = el("input", "tree-search") as HTMLInputElement;
  search.placeholder = "Buscar no modelo…";
  const treeEl = el("div", "tree");
  treeEl.innerHTML = `<p class="empty">Importe um IFC para ver a estrutura.</p>`;
  left.body.append(search, treeEl);

  // ---- painel direito: propriedades ----
  const right = floatPanel("PROPRIEDADES", "panel-right", "🏷");
  addResize(right.panel, "right");
  const propsEl = el("div", "props");
  propsEl.innerHTML = `<p class="empty">Selecione um elemento.</p>`;
  right.body.append(propsEl);

  // ---- painel inferior: gantt ----
  const bottom = floatPanel("PLANEJAMENTO - GANTT", "panel-bottom", "📅");
  addResize(bottom.panel, "bottom");
  const ganttEl = el("section", "gantt");
  bottom.body.append(ganttEl);

  root.append(
    viewportEl,
    bar,
    left.panel, left.chip,
    right.panel, right.chip,
    bottom.panel, bottom.chip,
  );

  return { viewportEl, ganttEl, treeEl, propsEl, fileInput };
}

/**
 * Painel flutuante. O botão do header minimiza: esconde o painel e mostra um
 * chip (ícone) no mesmo canto; clicar no chip restaura.
 */
function floatPanel(
  title: string,
  cls: string,
  icon: string,
): { panel: HTMLElement; body: HTMLElement; chip: HTMLElement } {
  const panel = el("aside", `panel ${cls}`);
  const head = el("div", "panel-head");
  const label = el("span", "panel-title");
  label.textContent = title;
  const toggle = el("button", "panel-min") as HTMLButtonElement;
  toggle.textContent = "–";
  toggle.title = "Minimizar";
  head.append(label, toggle);
  const body = el("div", "panel-body");
  panel.append(head, body);

  // Chip: mesmo canto do painel (herda posição via a classe cls), escondido até minimizar.
  const chip = el("button", `panel-chip ${cls}`) as HTMLButtonElement;
  chip.textContent = icon;
  chip.title = title;
  chip.hidden = true;

  toggle.addEventListener("click", () => {
    panel.hidden = true;
    chip.hidden = false;
  });
  chip.addEventListener("click", () => {
    chip.hidden = true;
    panel.hidden = false;
  });
  return { panel, body, chip };
}

/**
 * Handle de arraste na borda do painel. side="left"/"right" → largura
 * (col-resize); side="bottom" → altura (row-resize).
 */
function addResize(panel: HTMLElement, side: "left" | "right" | "bottom"): void {
  const handle = el("div", "panel-resize");
  if (side === "bottom") {
    handle.classList.add("row", "resize-bottom");
    panel.appendChild(handle);
    const sidePanels = () => document.querySelectorAll<HTMLElement>(".panel-left, .panel-right");
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startH = panel.getBoundingClientRect().height;
      const onMove = (ev: PointerEvent) => {
        const dy = startY - ev.clientY;
        const h = Math.max(80, startH + dy);
        panel.style.height = `${h}px`;
        const sideBottom = 12 + h + 5;
        for (const s of sidePanels()) s.style.bottom = `${sideBottom}px`;
      };
      const onUp = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  } else {
    handle.classList.add("col", `resize-${side}`);
    panel.appendChild(handle);
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const w = Math.max(200, Math.min(640, side === "left" ? startW + dx : startW - dx));
        panel.style.width = `${w}px`;
      };
      const onUp = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
