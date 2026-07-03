# ifc4all — Viewer 4D para Modelos IFC

Visualizador web de modelos **IFC** (BIM) com cronograma **4D** integrado. Carrega um arquivo `.ifc`, extrai as datas de início/fim dos elementos construtivos, e exibe um gráfico de Gantt interativo — similar ao MS Project, mas conectado diretamente ao modelo 3D.

Construído com [That Open Components](https://github.com/ThatOpen/engine) (engine open-source de BIM em JavaScript/TypeScript).

---

## PASSO 1 — Baixar as Ferramentas

### 1.1 Instalar o OpenCode Desktop

O OpenCode é a ferramenta que você vai usar para abrir e rodar o projeto.

1. Acesse: **https://opencode.ai**
2. Clique em **Download** e selecione a versão para **Windows**
3. Abra o arquivo baixado e siga as instruções de instalação
4. Abra o OpenCode após a instalação

### 1.2 Instalar o Node.js

O Node.js é necessário para rodar o projeto. O OpenCode pode verificar se já está instalado.

1. Acesse: **https://nodejs.org**
2. Clique no botão **LTS** (versão estável recomendada — atualmente v20)
3. Abra o arquivo baixado (`node-v20.x-x64.msi`)
4. Clique em **Next** em todas as telas, mantendo as opções padrão
5. Finalize a instalação

#### Como saber se instalou certo

Na barra de chat do OpenCode, cole o prompt abaixo e aperte **Enter**:

> **Peça ao OpenCode:**
> **Verifique se o Node.js e o npm estão instalados corretamente**

> O OpenCode vai rodar `node -v` e `npm -v` e mostrar as versões. Se aparecer algo como `v20.x.x`, instalou certo.
> O `npm` (gerenciador de pacotes) já vem junto com o Node — não precisa instalar separado.

---

## PASSO 2 — Baixar o Projeto

1. Acesse a página do repositório no GitHub
2. Clique no botão verde **\<\> Code**
3. Selecione **Download ZIP**
4. Salve o arquivo `ifc4all-main.zip` em uma pasta de sua escolha
5. Extraia o conteúdo do ZIP (clique com o botão direito → "Extrair tudo" no Windows)

> Resultado esperado: uma pasta `ifc4all-main` contendo as pastas `viewer/`, `ifc_model/`, etc.

---

## PASSO 3 — Abrir no OpenCode e Rodar

### 3.1 Abrir o projeto

1. Abra o **OpenCode Desktop**
2. Clique em **Open Folder** (ou **Abrir Pasta**)
3. Navegue até a pasta extraída `ifc4all-main` e selecione a pasta **`viewer`** dentro dela
4. Confirme — o OpenCode carrega a estrutura do projeto na lateral

> Resultado esperado: a pasta `viewer/` aparece no painel esquerdo do OpenCode, com os arquivos `src/`, `package.json`, etc.

### 3.2 Instalar as dependências

Na barra de chat do OpenCode, cole o prompt abaixo e aperte **Enter**:

> **Peça ao OpenCode:**
> **Instale as dependências do projeto. Rode `npm install` dentro da pasta `viewer`**

> Resultado esperado: uma pasta `node_modules/` é criada. Pode demorar 1-2 minutos na primeira vez.

### 3.3 Iniciar o servidor de desenvolvimento

Na barra de chat do OpenCode, cole o prompt abaixo e aperte **Enter**:

> **Peça ao OpenCode:**
> **Inicie o servidor de desenvolvimento. Rode `npm run dev` dentro da pasta `viewer`**

> Resultado esperado: o terminal mostra algo como `Local: http://localhost:5173/`
> O navegador abre automaticamente. Se não abrir, acesse manualmente: **http://localhost:5173**

### 3.4 Carregar um modelo IFC

1. Na tela do viewer, clique no botão **"Carregar arquivo"** (ou arraste um arquivo `.ifc` para a janela)
2. Selecione o arquivo `TORRE02_ESTRUTURA_4D.ifc` que está na pasta `ifc_model/` do projeto
3. Aguarde o processamento — o modelo 3D aparece na tela e o Gantt é gerado automaticamente

> Resultado esperado: visualização 3D do modelo + gráfico de Gantt com barras de tempo na parte inferior.

---

## Como Usar

| Ação | Como fazer |
|---|---|
| **Rotacionar o modelo** | Clique e arraste com o botão esquerdo |
| **Zoom** | Scroll do mouse |
| **Mover a câmera** | Botão direito + arraste |
| **Selecionar um elemento** | Clique nele no modelo 3D ou na árvore espacial |
| **Navegar no cronograma** | Arraste o scrubber (barra de tempo) no Gantt |
| **Ocultar elementos** | Ao mover o scrubber, elementos que ainda não começaram ficam ocultos |

---

## Comandos Disponíveis

Caso precise rodar qualquer um desses comandos, peça ao OpenCode no chat:

| Comando | O que faz | Prompt para o OpenCode |
|---|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento (porta 5173) | "Rode `npm run dev` dentro de `viewer`" |
| `npm run build` | Gera a versão para produção na pasta `dist/` | "Rode `npm run build` dentro de `viewer`" |
| `npm run preview` | Visualiza a versão de produção localmente | "Rode `npm run preview` dentro de `viewer`" |
| `npm run typecheck` | Verifica erros de tipos TypeScript | "Rode `npm run typecheck` dentro de `viewer`" |

---

## Estrutura do Projeto

```
ifc4all/
├── ifc_model/              # Modelos IFC de exemplo
│   └── TORRE02_ESTRUTURA_4D.ifc
├── viewer/                 # Aplicação principal (SPA)
│   ├── src/
│   │   ├── ifc/
│   │   │   ├── app.ts      # Setup do viewer 3D
│   │   │   └── schedule.ts # Extração de datas do IFC
│   │   ├── ui/
│   │   │   ├── gantt.ts    # Componente Gantt
│   │   │   ├── shell.ts    # Layout da interface
│   │   │   ├── tree.ts     # Árvore espacial do modelo
│   │   │   └── properties.ts # Painel de propriedades
│   │   └── main.ts         # Ponto de entrada
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## Solução de Problemas

**"O Gantt aparece vazio"**
O arquivo IFC precisa ter os atributos `StartDate` e `FinishDate` nos PSets dos elementos. Use um IFC pré-processado com esses atributos.

**"Erro ao carregar o modelo"**
Verifique se tem conexão com a internet — o WASM do web-ifc é baixado remotamente.

**"npm install dá erro de conflito"**
Peça ao OpenCode: **"Delete a pasta `node_modules` e o arquivo `package-lock.json`, depois rode `npm install` dentro de `viewer`"**

**"Porta 5173 já está em uso"**
O OpenCode mostra a mensagem no resultado. Peça ao OpenCode: **"Mude a porta do dev server para 5174"** ou encerre o processo que está usando a porta.

---

## Licença

Projeto privado — todos os direitos reservados.
