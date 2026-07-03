import type * as FRAGS from "@thatopen/fragments";

export interface ElementTask {
  model: FRAGS.FragmentsModel;
  localId: number;
  name: string;
  eap: string;
  building: string;
  storey: string;
  start: Date;
  finish: Date;
  durationDays: number;
  /** Hierarquia Summary1-4 (ex: "1.3 Estruturas" → "1.3.2 TORRE 02" → …). */
  summary1?: string;
  summary2?: string;
  summary3?: string;
  summary4?: string;
}

const BUILDING_CATEGORIES: RegExp[] = [
  /WALL/, /SLAB/, /COLUMN/, /BEAM/, /FOOTING/, /ROOF/,
  /STAIR/, /RAILING/, /COVERING/, /MEMBER/, /PLATE/,
  /WINDOW/, /DOOR/, /BUILDINGELEMENTPROXY/,
];

// Alias PT/EN → nome exato da propriedade no IFC
const EAP_ALIASES = ["eap-cod", "eap", "wbs"];
const BUILDING_ALIASES = ["prédio", "predio", "building", "edificio", "edifício", "torre"];
const STOREY_ALIASES = ["pavimento", "storey", "level", "nível", "nivel", "andar"];

/** Aceita ISO (YYYY-MM-DD), DD/MM/YYYY e timestamps numéricos. */
export function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return safe(new Date(+br[3], +br[2] - 1, +br[1]));
  if (/^\d+$/.test(s)) return safe(new Date(Number(s)));
  return safe(new Date(s));
}

function safe(d: Date): Date | null {
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? undefined : n;
}

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === "string" ? v : String((v as any).value ?? v);
  return s.trim() || undefined;
}

/**
 * Extrai todas as propriedades Name/NominalValue de um item IFC recursivamente.
 * Retorna um mapa { nomeLower → valor }.
 */
function collectAllProps(item: any): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new WeakSet<object>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    const name = node.Name?.value ?? node.Name;
    const value = node.NominalValue?.value ?? (node as any).value;
    if (typeof name === "string" && (value != null && value !== "")) {
      out.set(name.trim().toLowerCase(), String(value));
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(item);
  return out;
}

function findAlias(props: Map<string, string>, aliases: string[]): string | undefined {
  for (const a of aliases) {
    const v = props.get(a);
    if (v) return v;
  }
  return undefined;
}

/**
 * Varre elementos construtivos e monta tarefas 4D a partir do PSet BIM4D_Cronograma.
 *
 * Estrutura esperada no IFC:
 *   Task1, Task1Inicio, Task1Fim, Task1DuracaoDias
 *   Task2, Task2Inicio, Task2Fim, Task2DuracaoDias
 *   ...
 *   CronogramaInicio, CronogramaFim, NumeroTarefas
 *   Summary1, Summary2, Summary3, Summary4
 */
export async function buildSchedule(
  model: FRAGS.FragmentsModel,
): Promise<ElementTask[]> {
  const byCategory = await model.getItemsOfCategories(BUILDING_CATEGORIES);
  const localIds = Object.values(byCategory).flat() as number[];
  if (localIds.length === 0) return [];

  const data = await model.getItemsData(localIds, {
    attributesDefault: false,
    attributes: ["Name", "NominalValue"],
    relations: {
      IsDefinedBy: { attributes: true, relations: true },
    },
  });

  const tasks: ElementTask[] = [];
  data.forEach((item, i) => {
    const props = collectAllProps(item);
    const name = str(item?.Name) ?? `#${localIds[i]}`;
    const eap = findAlias(props, EAP_ALIASES) ?? "(sem EAP)";
    const building = findAlias(props, BUILDING_ALIASES) ?? "(sem prédio)";
    const storey = findAlias(props, STOREY_ALIASES) ?? "(sem pavimento)";

    const summary1 = props.get("summary1");
    const summary2 = props.get("summary2");
    const summary3 = props.get("summary3");
    const summary4 = props.get("summary4");

    // Coleta tasks dinamicamente (Task1..N)
    const taskEntries: { name: string; start: Date; finish: Date; days: number }[] = [];
    for (let n = 1; n <= 50; n++) {
      const tName = props.get(`task${n}`);
      const tStart = parseDate(props.get(`task${n}inicio`));
      const tFinish = parseDate(props.get(`task${n}fim`));
      if (!tName && !tStart && !tFinish) continue; // sem mais tasks
      if (!tStart || !tFinish) continue;
      const tDays = num(props.get(`task${n}duracaodias`))
        ?? Math.round((tFinish.getTime() - tStart.getTime()) / 86_400_000);
      taskEntries.push({ name: tName ?? `Tarefa ${n}`, start: tStart, finish: tFinish, days: tDays });
    }

    // Fallback: se não achou tasks numeradas, tenta StartDate/FinishDate legado
    if (taskEntries.length === 0) {
      const legacyStart = parseDate(
        findAlias(props, ["startdate", "start", "início", "inicio", "datainicio"]),
      );
      const legacyFinish = parseDate(
        findAlias(props, ["finishdate", "finish", "fim", "término", "termino", "datafim"]),
      );
      if (legacyStart && legacyFinish) {
        taskEntries.push({
          name,
          start: legacyStart,
          finish: legacyFinish,
          days: Math.round((legacyFinish.getTime() - legacyStart.getTime()) / 86_400_000),
        });
      }
    }

    if (taskEntries.length === 0) return;

    for (const te of taskEntries) {
      tasks.push({
        model,
        localId: localIds[i],
        name: te.name,
        eap,
        building,
        storey,
        start: te.start,
        finish: te.finish,
        durationDays: te.days,
        summary1,
        summary2,
        summary3,
        summary4,
      });
    }
  });

  return tasks;
}
