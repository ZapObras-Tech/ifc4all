import { Viewer } from "./ifc/app";
import { buildSchedule } from "./ifc/schedule";
import { Gantt } from "./ui/gantt";
import { buildShell } from "./ui/shell";
import { renderTree } from "./ui/tree";

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

  const spatial = await viewer.getSpatial();
  if (spatial) {
    renderTree(h.treeEl, spatial, {
      onSelect: (localId) => {
        // ponytail: seleção completa (highlight + propriedades) vem na Task 3.
        console.log("selecionado localId", localId);
      },
    });
  }

  gantt.render(h.ganttEl, tasks, {
    onScrub: (_date, visible, hidden) => {
      viewer.setElementsVisible(hidden, false);
      viewer.setElementsVisible(visible, true);
    },
  });
});
