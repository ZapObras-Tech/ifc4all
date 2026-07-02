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
  /** Último modelo carregado; suficiente para o escopo mono-modelo atual. */
  model?: FRAGS.FragmentsModel;
  private selected?: number;

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

  /** 4D: mostra/oculta elementos por localId e força um redraw. */
  async setElementsVisible(localIds: number[], visible: boolean) {
    if (!this.model || localIds.length === 0) return;
    await this.model.setVisible(localIds, visible);
    await this.fragments.core.update(true);
  }

  /** Realça um elemento, resetando o realce anterior. */
  async select(localId: number): Promise<void> {
    if (!this.model) return;
    if (this.selected != null) await this.model.resetHighlight([this.selected]);
    await this.model.highlight([localId], SELECT_MAT);
    this.selected = localId;
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
  async getSpatial(): Promise<FRAGS.SpatialTreeItem | null> {
    if (!this.model) return null;
    return this.model.getSpatialStructure();
  }

  private async fitToModel() {
    if (!this.model) return;
    const boxes = await this.model.getBoxes();
    if (!boxes?.length) return;
    const union = boxes.reduce((acc, b) => acc.union(b), boxes[0].clone());
    this.world.camera.controls.fitToBox(union, true);
  }
}
