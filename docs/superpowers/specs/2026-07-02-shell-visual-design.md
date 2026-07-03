# Shell Visual do Viewer BIM — Design

**Data:** 2026-07-02
**Escopo:** Reproduzir o layout/aparência do mockup (`ui-model/ChatGPT Image 2 de jul. de 2026, 19_30_45.png`) como um shell de UI completo, reusando as capacidades já existentes (viewport 3D, carga IFC, gantt 4D, leitura de PSets). Ferramentas BIM ainda não implementadas viram placeholders estilizados.

## Objetivo e recorte

Etapa **visual**: entregar o shell do mockup. Três painéis puxam **dados reais** do modelo carregado; o resto é placeholder estático com estado visual (empty-states "em breve").

- **Real:** árvore espacial IFC, painel de propriedades por seleção, tabela+timeline do Gantt.
- **Placeholder:** menus do topo, ícones do rail (só trocam estado ativo), toolbar flutuante do viewport, abas Classificação/Relações, painéis Camadas/Medidas/Cortes/Quantidades/Anotações/BCF/Configurações.

## Abordagem escolhida

**Vanilla TS + CSS Grid.** Mesma stack atual (Vite + TS, sem framework de UI). Zero dependência nova → evita as armadilhas de lockstep de versão documentadas no CLAUDE.md (`@thatopen/components@3.4` ⇄ `fragments@3.4` ⇄ `three` ⇄ `web-ifc@0.0.77`). CSS próprio dá controle total pra bater o mockup.

Rejeitadas: `@thatopen/ui` (+dep com lockstep, brigar com o look da lib custa mais que CSS próprio); Tailwind (dep de build sem ganho num app single-view).

## Layout

Grid no `#app`:

```
┌──────────────────────────────────────────────┐
│ topbar (menus + Importar IFC + ações)         │  56px, full width
├────┬─────────┬──────────────────────┬─────────┤
│rail│ MODELO  │  VISUALIZAÇÃO 3D     │PROPRIED.│
│icon│ IFC     │  (viewport)          │(painel  │
│56px│ (árvore)├──────────────────────┤ direito)│
│    │ 260px   │  PLANEJAMENTO GANTT  │ 320px   │
│    │         │  (tabela+timeline)   │         │
└────┴─────────┴──────────────────────┴─────────┘
```

- `grid-template-columns: 56px 260px 1fr 320px`
- `grid-template-rows: 56px 1fr`
- topbar ocupa todas as colunas (row 1).
- rail, painel esquerdo, painel direito ocupam a row 2.
- Centro (row 2, col 3) = flex column: viewport (flex:1) em cima + gantt (altura fixa ~320px) embaixo.

## Componentes

Todos em `src/ui/`. Cada módulo tem uma função `render`/construtor que recebe o container e (quando aplicável) o modelo/tarefas. Comunicação por callbacks explícitos — sem estado global.

### `shell.ts` — chrome estático
Monta a moldura: topbar (logo, menus Arquivo/Visualizar/Ferramentas/Janelas/Ajuda, nome do arquivo, botão Importar IFC, ícones fullscreen/ajuda/notificações/avatar), rail de ícones à esquerda (Modelo/Propriedades/Camadas/Medidas/Cortes/Quantidades/Anotações/BCF/Configurações + rodapé projeto/versão), headers dos painéis, toolbar flutuante do topo do viewport (select/pan/orbit/walk/section/measure/…), navcube e controles de zoom (decorativos), toolbar flutuante inferior do viewport, empty-states das ferramentas.
- **Depende de:** nada (DOM + CSS).
- **Expõe:** referências aos containers que os outros módulos preenchem (`#panel-tree`, `#panel-props`, `#viewport`, `#gantt`), e um hook de troca de painel do rail (troca qual painel esquerdo aparece; por ora só Modelo tem conteúdo, resto empty-state).
- Botão "Importar IFC" reusa o `<input type=file>` existente.

### `tree.ts` — árvore espacial IFC (real)
Renderiza IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → elementos, a partir do modelo carregado. Nós expansíveis.
- **Fonte de dados:** `model.getSpatialStructure()`.
- **Interação:** clique num elemento → callback `onSelect(localId)` → destaca no 3D + preenche propriedades. Busca (campo "Buscar no modelo…") filtra nós por nome — incluída se barata; senão placeholder.
- **Depende de:** `Viewer.model`, callback de seleção.

### `properties.ts` — painel de propriedades (real)
Ao selecionar um elemento: `model.getItemsData([localId], …)` → tabela com Elemento Selecionado (Tipo/GlobalId/Name/Description/ObjectType/Tag/PredefinedType/Material/Layer/ContainedInStructure), PSets (ex. Pset_WallCommon), e Dimensões (Comprimento/Altura/Largura/Área/Volume quando presentes).
- **Sem seleção:** empty-state ("Selecione um elemento").
- **Abas:** Propriedades (real); Classificação e Relações = empty-state placeholder.
- **Depende de:** `Viewer.model`, localId selecionado.

### `gantt.ts` — refactor tabela + timeline (real)
Evolui o gantt atual (barras agrupadas + scrubber) para o layout do mockup:
- **Tabela à esquerda:** colunas ID / Nome da Tarefa / Início / Término / Duração / Vinculado ao IFC.
- **Timeline à direita:** header de meses (Maio 2024 … Outubro 2024) com semanas, barras coloridas por tarefa, dependências (setas) opcionais, linha vertical "Hoje".
- **Toolbar:** botões Nova Tarefa / Vincular ao IFC / Configurações (placeholder) e à direita Hoje / seletor Semanas / filtro / fullscreen (placeholder).
- Mantém o **scrubber 4D** existente (`onScrub` → `Viewer.setElementsVisible`).
- **Fonte:** `ElementTask[]` de `buildSchedule` (inalterado). Agrupamento/ordenação por sequência construtiva preservados.

### `shell.css` (novo) + `gantt.css` (estende)
Todo o visual: paleta (fundo claro, rail escuro azulado, acento azul da seleção), tipografia, densidade das tabelas, barras do gantt.

## Fluxo de dados

```
Importar IFC → Viewer.loadIfc → model
   ├─ tree.render(model)          → clique → onSelect(localId)
   │                                   ├─ Viewer.highlight(localId)  (se barato)
   │                                   └─ properties.render(model, localId)
   └─ buildSchedule(model) → gantt.render(tasks)
                                   └─ scrubber → Viewer.setElementsVisible
```

`main.ts` continua sendo o fio condutor: monta o shell, liga os módulos ao viewer.

## Seleção no viewport

Clique no 3D → raycast → localId → mesma rota `onSelect` (destaca + preenche propriedades + realça o nó na árvore). Usar o Highlighter/raycast do That Open (linha 3.x).

## Fora de escopo (YAGNI)

Lógica de medir/cortar/quantificar/BCF/anotar; CRUD de tarefas; ações dos menus do topo; persistência de vistas salvas; multi-modelo. Tudo marcado com `// ponytail:` onde vira placeholder.

## Verificação

- `npm run build` (tsc --noEmit + vite build) verde — trava se tipos quebram.
- `node --experimental-strip-types src/ifc/schedule.selfcheck.ts` continua passando (gantt refactor não deve mexer na lógica de datas).
- Checagem visual manual contra o mockup (dev server), com um IFC de teste que tenha cronograma.
