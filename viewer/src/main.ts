import { Viewer } from "./ifc/app";
import { buildSchedule } from "./ifc/schedule";
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

  const spatial = await viewer.getSpatial();
  if (spatial) {
    renderTree(h.treeEl, spatial, {
      onSelect: selectAndShow,
    });
  }

  gantt.render(h.ganttEl, tasks, {
    onScrub: (_date, visible, hidden) => {
      viewer.setElementsVisible(hidden, false);
      viewer.setElementsVisible(visible, true);
    },
  });
});
