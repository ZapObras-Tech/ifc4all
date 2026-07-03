import type { ElementTask } from "../ifc/schedule";

export interface GanttHooks {
  /**
   * Chamado ao mexer no scrubber: quem deve estar visível naquela data.
   * Emite as tarefas (não localIds soltos) porque com múltiplos modelos o
   * localId só é único dentro de cada modelo — quem aplica precisa do model.
   */
  onScrub: (date: Date, visible: ElementTask[], hidden: ElementTask[]) => void;
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
    // linha "Hoje" (só aparece se dentro do domínio)
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

function fmt(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}
