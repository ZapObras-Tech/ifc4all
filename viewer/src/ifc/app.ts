import * as OBC from "@thatopen/components";
import type * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import { RenderedFaces } from "@thatopen/fragments";

const WORKER_URL =
  "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
const WASM_PATH = "https://unpkg.com/web-ifc@0.0.77/";

const SELECT_MAT = {
  color: new THREE.Color("#2563eb"),
  renderedFaces: RenderedFaces.TWO,
  opacity: 1,
  transparent: false,
};

/**
 * Encapsula o setup do That Open Components: mundo 3D, loader de IFC e
 * FragmentsManager. Uma instância = um viewport.
 */
export class Viewer {
  readonly components = new OBC.Components();
  fragments!: OBC.FragmentsManager;
  world!: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;
  /** Modelo ativo: o último carregado, ou o clicado no viewport (ver pickAt). */
  model?: FRAGS.FragmentsModel;
  private _highlighted = new Map<FRAGS.FragmentsModel, number[]>();

  async init(viewport: HTMLElement) {
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer
    >();

    world.scene = new OBC.SimpleScene(this.components);
    world.scene.setup();
    world.renderer = new OBC.SimpleRenderer(this.components, viewport);
    world.camera = new OBC.SimpleCamera(this.components);
    this.world = world;

    this.components.init();
    this.components.get(OBC.Grids).create(world);

    // Fragments precisa de um worker; carregado do CDN oficial.
    const blob = await (await fetch(WORKER_URL)).blob();
    const workerUrl = URL.createObjectURL(
      new File([blob], "worker.mjs", { type: "text/javascript" }),
    );
    const fragments = this.components.get(OBC.FragmentsManager);
    fragments.init(workerUrl);
    this.fragments = fragments;

    world.camera.controls.addEventListener("update", () =>
      fragments.core.update(),
    );
    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      this.model = model;
      fragments.core.update(true);
    });

    const ifcLoader = this.components.get(OBC.IfcLoader);
    // autoSetWasm:false é obrigatório. Com ele ligado (default), o loader busca
    // o package.json PUBLICADO do @thatopen/components e usa o peerDep web-ifc
    // de lá (0.0.66) — que não bate com o glue instalado (0.0.77) e quebra o
    // WASM ("Import #0 'a'"). Fixamos o path na versão local. Roda em setup() E
    // load(), então só passar `path` não basta; precisa desligar o auto.
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: { absolute: true, path: WASM_PATH },
    });
  }

  async loadIfc(bytes: Uint8Array, name: string) {
    const ifcLoader = this.components.get(OBC.IfcLoader);
    await ifcLoader.load(bytes, true, name);
    await this.fitToModel();
    return this.model;
  }

  /** 4D: mostra/oculta elementos de um modelo por localId e força um redraw. */
  async setElementsVisible(
    model: FRAGS.FragmentsModel,
    localIds: number[],
    visible: boolean,
  ) {
    if (localIds.length === 0) return;
    await model.setVisible(localIds, visible);
    await this.fragments.core.update(true);
  }

  /** Limpa todos os highlights rastreados. */
  private async clearHighlights() {
    for (const [model, ids] of this._highlighted) {
      await model.resetHighlight(ids);
    }
    this._highlighted.clear();
  }

  /** Realça um elemento, resetando o realce anterior. */
  async select(localId: number, model?: FRAGS.FragmentsModel): Promise<void> {
    const m = model ?? this.model;
    if (!m) return;
    await this.clearHighlights();
    await m.highlight([localId], SELECT_MAT);
    this._highlighted.set(m, [localId]);
    this.model = m;
    await this.fragments.core.update(true);
  }

  /** Realça elementos de qualquer modelo (para seleção via Gantt). */
  async highlightElements(tasks: { model: FRAGS.FragmentsModel; localId: number }[]): Promise<void> {
    await this.clearHighlights();
    const byModel = new Map<FRAGS.FragmentsModel, number[]>();
    for (const t of tasks) {
      (byModel.get(t.model) ?? byModel.set(t.model, []).get(t.model)!).push(t.localId);
    }
    for (const [model, ids] of byModel) {
      await model.highlight(ids, SELECT_MAT);
      this._highlighted.set(model, ids);
    }
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

  /** Estrutura espacial (IfcProject → Site → Building → Storey → elementos). */
  async getSpatial(
    model: FRAGS.FragmentsModel | undefined = this.model,
  ): Promise<FRAGS.SpatialTreeItem | null> {
    if (!model) return null;
    return model.getSpatialStructure();
  }

  /** Canvas do renderer, para eventos de ponteiro. */
  get canvas(): HTMLCanvasElement {
    return this.world.renderer!.three.domElement;
  }

  /**
   * Raycast na posição do ponteiro contra TODOS os modelos carregados → localId
   * do elemento mais próximo (ou null). O modelo atingido vira o `model` ativo,
   * então select/getItemData/props passam a operar sobre ele.
   */
  async pickAt(clientX: number, clientY: number): Promise<number | null> {
    const mouse = new THREE.Vector2(clientX, clientY);
    const camera = this.world.camera.three as THREE.PerspectiveCamera;
    let best: { model: FRAGS.FragmentsModel; localId: number; distance: number } | null =
      null;
    for (const model of this.fragments.list.values()) {
      const res = await model.raycast({ camera, mouse, dom: this.canvas });
      if (res?.localId == null) continue;
      if (!best || res.distance < best.distance)
        best = { model, localId: res.localId, distance: res.distance };
    }
    if (!best) return null;
    this.model = best.model;
    return best.localId;
  }

  private async fitToModel() {
    if (!this.model) return;
    const boxes = await this.model.getBoxes();
    if (!boxes?.length) return;
    const union = boxes.reduce((acc, b) => acc.union(b), boxes[0].clone());
    this.world.camera.controls.fitToBox(union, true);
  }
}
