import type * as FRAGS from "@thatopen/fragments";
import { Viewer } from "./ifc/app";
import { buildSchedule, type ElementTask } from "./ifc/schedule";
import { Gantt } from "./ui/gantt";
import { buildShell } from "./ui/shell";
import { renderProperties, renderPropertiesMulti } from "./ui/properties";
import { renderTree, selectNodeById } from "./ui/tree";
import type { SpatialTreeItem } from "@thatopen/fragments";

const root = document.getElementById("app")!;
const h = buildShell(root);

const viewer = new Viewer();
const gantt = new Gantt();

await viewer.init(h.viewportEl);

async function selectAndShow(localId: number, model?: FRAGS.FragmentsModel) {
  await viewer.select(localId, model);
  const item = await viewer.getItemData(localId);
  renderProperties(h.propsEl, item);
}

viewer.canvas.addEventListener("click", async (e) => {
  const localId = await viewer.pickAt(e.clientX, e.clientY);
  if (localId == null) return;
  selectNodeById(h.treeEl, localId);
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

/** Coleta localIds de todos os IfcBuildingStorey na árvore espacial. */
function collectStoreyIds(item: SpatialTreeItem): number[] {
  const ids: number[] = [];
  if (item.category === "IFCBUILDINGSTOREY" && item.localId != null) ids.push(item.localId);
  for (const c of item.children ?? []) ids.push(...collectStoreyIds(c));
  return ids;
}

h.fileInput.addEventListener("change", async () => {
  const files = [...(h.fileInput.files ?? [])];
  if (files.length === 0) return;
  h.treeEl.innerHTML = "";

  const allTasks: ElementTask[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const model = await viewer.loadIfc(bytes, file.name.replace(/\.ifc$/i, ""));
    if (!model) continue;
    allTasks.push(...(await buildSchedule(model)));

    const spatial = await viewer.getSpatial(model);
    if (spatial) {
      const storeyIds = collectStoreyIds(spatial);
      const labelMap = new Map<number, string>();
      if (storeyIds.length) {
        const data = await model.getItemsData(storeyIds, {
          attributesDefault: false,
          attributes: ["Name"],
        });
        for (let i = 0; i < storeyIds.length; i++) {
          const attrs = (data as any[])?.[i]?.attributes;
          const name = attrs?.Name;
          if (name) labelMap.set(storeyIds[i], String(name));
        }
      }

      const wrapper = document.createElement("div");
      wrapper.className = "tree-model";
      h.treeEl.appendChild(wrapper);
      renderTree(wrapper, file.name, spatial, {
        onSelect: (localId) => {
          selectAndShow(localId, model);
        },
        labelMap,
      });
    }
  }

  gantt.render(h.ganttEl, allTasks, {
    onScrub: (_date, visible, hidden) => {
      applyVisibility(hidden, false);
      applyVisibility(visible, true);
    },
    onSelect: async (tasks) => {
      viewer.highlightElements(tasks);
      if (tasks.length === 0) {
        renderPropertiesMulti(h.propsEl, []);
        return;
      }
      const byModel = new Map<FRAGS.FragmentsModel, number[]>();
      for (const t of tasks) {
        (byModel.get(t.model) ?? byModel.set(t.model, []).get(t.model)!).push(t.localId);
      }
      const allItems: any[] = [];
      for (const [model, ids] of byModel) {
        const data = await model.getItemsData(ids, {
          attributesDefault: true,
          relations: {
            IsDefinedBy: { attributes: true, relations: true },
          },
        });
        allItems.push(...(data as any[]));
      }
      renderPropertiesMulti(h.propsEl, allItems);
    },
  });
});
