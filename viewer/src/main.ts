import type * as FRAGS from "@thatopen/fragments";
import { Viewer } from "./ifc/app";
import { buildSchedule, type ElementTask } from "./ifc/schedule";
import { Gantt } from "./ui/gantt";
import { buildShell } from "./ui/shell";
import { renderProperties } from "./ui/properties";
import { renderTree } from "./ui/tree";

const root = document.getElementById("app")!;
const h = buildShell(root);

const viewer = new Viewer();
const gantt = new Gantt();

await viewer.init(h.viewportEl);

async function selectAndShow(localId: number) {
  await viewer.select(localId);
  const item = await viewer.getItemData(localId);
  renderProperties(h.propsEl, item);
}

viewer.canvas.addEventListener("click", async (e) => {
  const localId = await viewer.pickAt(e.clientX, e.clientY);
  if (localId == null) return;
  // ponytail: tree has no "select row by id" API, so a viewport pick only
  // clears the stale tree highlight instead of re-highlighting the row.
  h.treeEl.querySelectorAll(".tree-node.selected").forEach((n) => n.classList.remove("selected"));
  await selectAndShow(localId);
});

// Aplica visibilidade a um lote de tarefas, agrupando por modelo (localId só é
// único dentro de cada modelo, então cada setVisible precisa do model certo).
function applyVisibility(tasks: ElementTask[], visible: boolean) {
  const byModel = new Map<FRAGS.FragmentsModel, number[]>();
  for (const t of tasks) {
    (byModel.get(t.model) ?? byModel.set(t.model, []).get(t.model)!).push(t.localId);
  }
  for (const [model, ids] of byModel) viewer.setElementsVisible(model, ids, visible);
}

h.fileInput.addEventListener("change", async () => {
  const files = [...(h.fileInput.files ?? [])];
  if (files.length === 0) return;
  h.fileNameEl.textContent = `carregando ${files.length} modelo(s)…`;
  h.treeEl.innerHTML = "";

  const allTasks: ElementTask[] = [];
  const loaded: string[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const model = await viewer.loadIfc(bytes, file.name.replace(/\.ifc$/i, ""));
    if (!model) continue;
    loaded.push(file.name);
    allTasks.push(...(await buildSchedule(model)));

    const spatial = await viewer.getSpatial(model);
    if (spatial) {
      const sub = document.createElement("div");
      h.treeEl.appendChild(sub);
      // Fixa o model ativo antes de selecionar: select/getItemData operam sobre
      // viewer.model, e cliques na árvore não passam pelo raycast que faria isso.
      renderTree(sub, spatial, {
        onSelect: (localId) => {
          viewer.model = model;
          selectAndShow(localId);
        },
      });
    }
  }

  h.fileNameEl.textContent = loaded.length ? loaded.join(", ") : "falha ao carregar modelo";

  gantt.render(h.ganttEl, allTasks, {
    onScrub: (_date, visible, hidden) => {
      applyVisibility(hidden, false);
      applyVisibility(visible, true);
    },
  });
});
