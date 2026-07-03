import type { ElementTask } from "../ifc/schedule";

export interface GanttHooks {
  onScrub: (date: Date, visible: ElementTask[], hidden: ElementTask[]) => void;
  onSelect: (tasks: ElementTask[]) => void;
}

interface TreeNode {
  id: string;
  label: string;
  depth: number;
  start: Date;
  finish: Date;
  durationDays: number;
  tasks: ElementTask[];
  children: TreeNode[];
  collapsed: boolean;
}

const MS_DAY = 86_400_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const TASK_BAR_COLOR = "#2563eb";

export function monthTicks(start: Date, end: Date): { label: string; x: number; year: number; initial: string }[] {
  const span = end.getTime() - start.getTime() || 1;
  const ticks: { label: string; x: number; year: number; initial: string }[] = [];
  const d = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (d.getTime() < end.getTime()) {
    ticks.push({
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      x: ((d.getTime() - start.getTime()) / span) * 100,
      year: d.getFullYear(),
      initial: MONTH_INITIALS[d.getMonth()],
    });
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

function msDate(d: Date): number {
  return d.getTime();
}

function collectAllTasks(n: TreeNode): ElementTask[] {
  if (n.tasks.length > 0) return n.tasks;
  const out: ElementTask[] = [];
  for (const c of n.children) out.push(...collectAllTasks(c));
  return out;
}

export class Gantt {
  private domainStart = 0;
  private domainEnd = 1;
  private mode: "gantt" | "table" = "gantt";
  private _container!: HTMLElement;
  private _tasks!: ElementTask[];
  private _hooks!: GanttHooks;
  private _tree!: TreeNode[];
  private _flat: TreeNode[] = [];
  private _selected: TreeNode | null = null;

  render(container: HTMLElement, tasks: ElementTask[], hooks: GanttHooks) {
    this._container = container;
    this._tasks = tasks;
    this._hooks = hooks;
    this.mode = "gantt";
    this._selected = null;
    this._tree = this.buildTree(tasks);
    this._renderView();
  }

  // ── construção da árvore ────────────────────────────────────────

  private buildTree(tasks: ElementTask[]): TreeNode[] {
    if (tasks.length === 0) return [];

    this.domainStart = Math.min(...tasks.map((t) => msDate(t.start)));
    this.domainEnd = Math.max(...tasks.map((t) => msDate(t.finish)));

    const nodes = new Map<string, TreeNode>();
    const mkKey = (label: string, depth: number) => `${depth}::${label}`;

    const getOrCreate = (label: string, depth: number): TreeNode => {
      const key = mkKey(label, depth);
      if (nodes.has(key)) return nodes.get(key)!;
      const n: TreeNode = {
        id: key, label, depth,
        start: new Date(Infinity), finish: new Date(-Infinity),
        durationDays: 0, tasks: [], children: [], collapsed: false,
      };
      nodes.set(key, n);
      return n;
    };

    const root: TreeNode = {
      id: "root", label: "Cronograma", depth: -1,
      start: new Date(this.domainStart), finish: new Date(this.domainEnd),
      durationDays: 0, tasks: [], children: [], collapsed: false,
    };

    const byTaskName = new Map<string, ElementTask[]>();
    for (const t of tasks) {
      const arr = byTaskName.get(t.name) ?? [];
      arr.push(t);
      byTaskName.set(t.name, arr);
    }

    for (const [, taskGroup] of byTaskName) {
      const t = taskGroup[0];
      const s1 = t.summary1 ?? t.building;
      const s2 = t.summary2 ?? t.storey;
      const s3 = t.summary3;
      const s4 = t.summary4 ?? t.eap;

      let parent = root;
      const chain: [string, number][] = [];
      if (s1) chain.push([s1, 0]);
      if (s2) chain.push([s2, 1]);
      if (s3) chain.push([s3, 2]);
      if (s4) chain.push([s4, 3]);

      for (const [label, depth] of chain) {
        const child = getOrCreate(label, depth);
        if (!parent.children.includes(child)) parent.children.push(child);
        parent = child;
      }

      const taskStart = new Date(Math.min(...taskGroup.map((x) => msDate(x.start))));
      const taskFinish = new Date(Math.max(...taskGroup.map((x) => msDate(x.finish))));
      const leaf: TreeNode = {
        id: `task::${t.name}`,
        label: t.name,
        depth: 4,
        start: taskStart,
        finish: taskFinish,
        durationDays: Math.round((msDate(taskFinish) - msDate(taskStart)) / MS_DAY),
        tasks: taskGroup,
        children: [],
        collapsed: false,
      };
      parent.children.push(leaf);

      let cur: TreeNode | undefined = parent;
      while (cur && cur.id !== "root") {
        if (msDate(taskStart) < msDate(cur.start)) cur.start = taskStart;
        if (msDate(taskFinish) > msDate(cur.finish)) cur.finish = taskFinish;
        cur.durationDays = Math.round((msDate(cur.finish) - msDate(cur.start)) / MS_DAY);
        const idx: number = cur.depth - 1;
        const labels: (string | undefined)[] = [s1, s2, s3, s4];
        const nextLabel: string | undefined = labels[idx];
        cur = nextLabel ? nodes.get(`${idx}::${nextLabel}`) : root;
      }
    }

    const calcDur = (n: TreeNode) => {
      for (const c of n.children) calcDur(c);
      if (n.children.length > 0 && n.tasks.length === 0) {
        n.start = new Date(Math.min(...n.children.map((c) => msDate(c.start))));
        n.finish = new Date(Math.max(...n.children.map((c) => msDate(c.finish))));
        n.durationDays = Math.round((msDate(n.finish) - msDate(n.start)) / MS_DAY);
      }
    };
    calcDur(root);

    return root.children;
  }

  // ── renderização ────────────────────────────────────────────────

  private flatten(nodes: TreeNode[]): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (list: TreeNode[]) => {
      for (const n of list) {
        out.push(n);
        if (!n.collapsed && n.children.length > 0) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }

  private _renderView() {
    const { _container: container, _tasks: tasks, _hooks: hooks } = this;
    container.innerHTML = "";
    container.appendChild(this.toolbar());

    if (tasks.length === 0) {
      const msg = document.createElement("p");
      msg.className = "empty";
      msg.textContent = "Nenhum elemento com cronograma encontrado.";
      container.appendChild(msg);
      return;
    }

    this._flat = this.flatten(this._tree);

    if (this.mode === "gantt") {
      const body = document.createElement("div");
      body.className = "gantt-body";
      body.append(this.combinedPanel());
      container.appendChild(body);
      container.appendChild(this.scrubber(tasks, hooks));
    } else {
      container.appendChild(this.fullTable(tasks));
    }
  }

  private x(t: number): number {
    const span = this.domainEnd - this.domainStart || 1;
    return ((t - this.domainStart) / span) * 100;
  }

  /** Toggle: se já está selecionado, desmarca. Senão, seleciona. */
  private selectNode(n: TreeNode | null) {
    if (n && this._selected === n) {
      this._selected = null;
      this._hooks.onSelect([]);
    } else {
      this._selected = n;
      if (n) this._hooks.onSelect(collectAllTasks(n));
    }
  }

  // ── toolbar (toggle + export) ───────────────────────────────────

  private toolbar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "gantt-toolbar";

    const toggle = document.createElement("button");
    toggle.className = "gantt-btn gantt-toggle";
    toggle.textContent = this.mode === "gantt" ? "☰ Tabela" : "📊 Gantt";
    toggle.title = "Alternar visualização";
    toggle.addEventListener("click", () => {
      this.mode = this.mode === "gantt" ? "table" : "gantt";
      this._renderView();
    });

    const exportBtn = document.createElement("button");
    exportBtn.className = "gantt-btn";
    exportBtn.textContent = "⬇ CSV";
    exportBtn.title = "Exportar tabela para CSV";
    exportBtn.addEventListener("click", () => this.exportCSV());

    bar.appendChild(toggle);
    bar.appendChild(exportBtn);
    return bar;
  }

  // ── export CSV ──────────────────────────────────────────────────

  private exportCSV() {
    const rows = [["#", "EAP 1", "EAP 2", "EAP 3", "EAP 4", "Pavimento", "Tarefa", "Início", "Término", "Dias"]];
    const byTaskName = new Map<string, ElementTask[]>();
    for (const t of this._tasks) {
      const arr = byTaskName.get(t.name) ?? [];
      arr.push(t);
      byTaskName.set(t.name, arr);
    }
    const sorted = [...byTaskName.values()]
      .map((ts) => ts[0])
      .sort((a, b) => msDate(a.start) - msDate(b.start));
    sorted.forEach((t, i) => {
      rows.push([
        String(i + 1), t.summary1 || "—", t.summary2 || "—", t.summary3 || "—", t.summary4 || "—",
        t.storey || "—",
        t.name, fmt(t.start), fmt(t.finish), `${t.durationDays}`,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cronograma.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── painel combinado (info + barras) ──────────────────────────

  private combinedPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "gantt-combined";

    const monthsRow = document.createElement("div");
    monthsRow.className = "gantt-combined-months";
    const monthsInfo = document.createElement("div");
    monthsInfo.className = "gantt-combined-months-info";
    monthsInfo.textContent = "Tarefa";
    const monthsBars = document.createElement("div");
    monthsBars.className = "gantt-combined-months-bars";

    const ticks = monthTicks(new Date(this.domainStart), new Date(this.domainEnd));

    const yearsRow = document.createElement("div");
    yearsRow.className = "gantt-years-row";
    let lastYear = 0;
    for (const tick of ticks) {
      if (tick.year !== lastYear) {
        const y = document.createElement("span");
        y.className = "gantt-year-label";
        y.style.left = `${tick.x}%`;
        y.textContent = String(tick.year);
        yearsRow.appendChild(y);
        lastYear = tick.year;
      }
    }

    const initialsRow = document.createElement("div");
    initialsRow.className = "gantt-initials-row";
    for (const tick of ticks) {
      const m = document.createElement("span");
      m.className = "gantt-month-initial";
      m.style.left = `${tick.x}%`;
      m.textContent = tick.initial;
      initialsRow.appendChild(m);
    }

    monthsBars.append(yearsRow, initialsRow);
    monthsRow.append(monthsInfo, monthsBars);
    panel.appendChild(monthsRow);

    this._flat.forEach((n) => {
      const row = document.createElement("div");
      row.className = `gantt-combined-row gantt-depth-${Math.min(n.depth, 4)}`;
      const isLeaf = n.tasks.length > 0 && n.children.length === 0;
      if (isLeaf) row.classList.add("gantt-leaf");
      if (n === this._selected) row.classList.add("gantt-selected");

      const info = document.createElement("div");
      info.className = "gantt-combined-info";
      const indent = n.depth >= 0 ? (n.depth + 1) * 14 : 0;
      const allTasks = collectAllTasks(n);
      const elemCount = new Set(allTasks.map((x) => x.localId)).size;

      const hasChildren = n.children.length > 0;
      if (hasChildren) {
        const caret = document.createElement("span");
        caret.className = "gantt-caret";
        caret.textContent = n.collapsed ? "▸" : "▾";
        caret.style.cursor = "pointer";
        caret.style.marginRight = "4px";
        caret.style.color = "#9ca3af";
        caret.addEventListener("click", (e) => {
          e.stopPropagation();
          n.collapsed = !n.collapsed;
          this._flat = this.flatten(this._tree);
          this._renderView();
        });
        info.appendChild(caret);
      } else {
        const spacer = document.createElement("span");
        spacer.style.display = "inline-block";
        spacer.style.width = "18px";
        info.appendChild(spacer);
      }

      const labelSpan = document.createElement("span");
      labelSpan.textContent = n.label;
      labelSpan.style.overflow = "hidden";
      labelSpan.style.textOverflow = "ellipsis";
      labelSpan.style.whiteSpace = "nowrap";
      if (elemCount > 1) labelSpan.title = `${elemCount} elementos`;
      info.appendChild(labelSpan);

      const datesSpan = document.createElement("span");
      datesSpan.className = "gantt-combined-dates";
      datesSpan.textContent = `${fmt(n.start)} → ${fmt(n.finish)} (${n.durationDays}d)`;
      info.appendChild(datesSpan);

      info.style.paddingLeft = `${indent}px`;
      row.appendChild(info);

      const bars = document.createElement("div");
      bars.className = "gantt-combined-bars";
      const bar = document.createElement("div");
      bar.className = "gantt-bar";
      bar.style.left = `${this.x(msDate(n.start))}%`;
      bar.style.width = `${Math.max(0.5, this.x(msDate(n.finish)) - this.x(msDate(n.start)))}%`;

      const isSummary = n.tasks.length === 0 && n.children.length > 0;
      bar.title = `${n.label}\n${fmt(n.start)} → ${fmt(n.finish)} (${n.durationDays}d)`;

      if (isSummary) {
        const wrap = document.createElement("div");
        wrap.className = "gantt-bar-summary-wrap";
        wrap.style.left = bar.style.left;
        wrap.style.width = bar.style.width;
        wrap.title = bar.title;
        const line = document.createElement("div");
        line.className = "gantt-bar-summary-line";
        const triStart = document.createElement("div");
        triStart.className = "gantt-bar-summary-tri gantt-bar-summary-tri-start";
        const triEnd = document.createElement("div");
        triEnd.className = "gantt-bar-summary-tri gantt-bar-summary-tri-end";
        wrap.appendChild(line);
        wrap.appendChild(triStart);
        wrap.appendChild(triEnd);
        bars.appendChild(wrap);
      } else {
        bar.style.background = TASK_BAR_COLOR;
        bars.appendChild(bar);
      }
      row.appendChild(bars);

      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        this.selectNode(n);
        this._renderView();
      });
      panel.appendChild(row);
    });

    const today = Date.now();
    if (today >= this.domainStart && today <= this.domainEnd) {
      const line = document.createElement("div");
      line.className = "gantt-today-combined";
      line.style.left = `calc(50% + ${this.x(today)}% * 50 / 100)`;
      panel.appendChild(line);
    }

    return panel;
  }

  // ── tabela completa (modo tabela) ───────────────────────────────

  private fullTable(tasks: ElementTask[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "gantt-full-table";
    const cols = ["#", "EAP 1", "EAP 2", "EAP 3", "EAP 4", "Pavimento", "Tarefa", "Início", "Término", "Dias"];
    const header = document.createElement("div");
    header.className = "gantt-tr gantt-th";
    for (const c of cols) {
      const cell = document.createElement("span");
      cell.textContent = c;
      header.appendChild(cell);
    }
    wrap.appendChild(header);

    const byTaskName = new Map<string, ElementTask[]>();
    for (const t of tasks) {
      const arr = byTaskName.get(t.name) ?? [];
      arr.push(t);
      byTaskName.set(t.name, arr);
    }
    const groups = [...byTaskName.values()]
      .map((ts) => ts[0])
      .sort((a, b) => msDate(a.start) - msDate(b.start));

    let selectedIdx = -1;
    groups.forEach((t, i) => {
      const tr = document.createElement("div");
      tr.className = "gantt-tr";
      tr.style.cursor = "pointer";
      const cells = [
        String(i + 1), t.summary1 || "—", t.summary2 || "—", t.summary3 || "—", t.summary4 || "—",
        t.storey || "—",
        t.name, fmt(t.start), fmt(t.finish), `${t.durationDays}d`,
      ];
      for (const c of cells) {
        const cell = document.createElement("span");
        cell.textContent = c;
        cell.title = c;
        tr.appendChild(cell);
      }
      tr.addEventListener("click", () => {
        if (selectedIdx === i) {
          selectedIdx = -1;
          this._hooks.onSelect([]);
        } else {
          selectedIdx = i;
          this._hooks.onSelect(byTaskName.get(t.name) ?? [t]);
        }
        wrap.querySelectorAll(".gantt-tr").forEach((r, ri) => {
          r.classList.toggle("gantt-table-selected", ri === selectedIdx);
        });
      });
      wrap.appendChild(tr);
    });
    return wrap;
  }

  // ── scrubber 4D ─────────────────────────────────────────────────

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
      const visible: ElementTask[] = [];
      const hidden: ElementTask[] = [];
      for (const task of tasks) {
        (task.start.getTime() <= t ? visible : hidden).push(task);
      }
      hooks.onScrub(date, visible, hidden);
    };
    input.addEventListener("input", apply);
    apply();

    wrap.append(document.createTextNode("Data: "), readout, input);
    return wrap;
  }
}
