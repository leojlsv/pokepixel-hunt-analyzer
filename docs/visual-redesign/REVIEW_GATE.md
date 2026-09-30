# Gate visual M1 — Hunt Analyzer

**Data da revisão:** 29/09/2026. **Status atualizado:** direção de paleta/tipografia M1 aceita pelo PO, **porém a apresentação em um cartão por Pokémon foi rejeitada** por reduzir o número de registros visíveis nos prints compartilhados no Discord. A alternativa M1.1 de **linhas contínuas e densas** foi implementada em protótipo e validada em Edge headless; aguarda revisão estética do PO. Permanece sem scroll horizontal e sem Level em Captured/Failed. A aceitação anterior de M1 não deve ser interpretada como aprovação dos cartões. Ainda é necessário portar o resultado visual para o userscript e validar seus comportamentos operacionais.

**Novo contrato que prevalece sobre qualquer referência anterior a cartões nesta página:** [SCREENSHOT_SHARING_CONTRACT.md](SCREENSHOT_SHARING_CONTRACT.md). Comparativo dedicado: [share-compare.html](review/share-compare.html), com screenshots congelados do M1 rejeitado à esquerda e screenshots da nova proposta à direita.

**Resultado mensurado da revisão:** [SCREENSHOT_SHARING_QA_REPORT.md](SCREENSHOT_SHARING_QA_REPORT.md): Captured caiu de aproximadamente **260px para 76px por Pokémon** no Mobile; `Mobile 390×844` passou de 1 para 4 registros completos por print, `Mobile 320×568` de 0 para 3 no início da seção. **52/52 verificações Edge PASS** com 13 estados por viewport e ausência de rolagem horizontal.

**Contrato atualizado que prevalece sobre menções históricas de scroll desta página:** [TABLE_PRESENTATION_CONTRACT.md](TABLE_PRESENTATION_CONTRACT.md).

## 1. Abrir e comparar

Com o workspace aberto no Windows:

| Recurso | Arquivo local | O que permite avaliar |
| --- | --- | --- |
| **Comparativo lado a lado** | `G:\pokepixel-hunt-analyzer\docs\visual-redesign\review\compare.html` | Interface atual (M0) à esquerda e proposta visual vigente à direita, com quatro viewports e quatro destinos. |
| **Comparativo de densidade** | `G:\pokepixel-hunt-analyzer\docs\visual-redesign\review\share-compare.html` | M1 rejeitado em cartões versus M1.1 em linhas compactas, incluindo screenshot Mobile 320/390 e Desktop 415/620. |
| **Protótipo interativo** | `G:\pokepixel-hunt-analyzer\docs\visual-redesign\prototype\index.html` | Alternar Desktop 415/620 e Mobile 320/390, navegar Current/History/Misc/HUD, experimentar filtros sintéticos e layouts do HUD. |
| **Baseline da arquitetura** | `docs/visual-redesign/BASELINE.md` | Estados, seletores, riscos e funcionalidades que a implementação real deve preservar. |
| **Capturas reprodutíveis** | `docs/visual-redesign/reference/screenshots/` e `docs/visual-redesign/review/screenshots/` | 16 imagens da UI atual e **36 capturas do M1**, incluindo Current Captured/Failed e as três subtelas History, mais medidas geométricas e hashes dos arquivos. |

**Observação:** as imagens são geradas e ignoradas pelo Git; existem neste workspace. Para refazê-las de forma local e isolada:

```powershell
node docs/visual-redesign/reference/build.mjs
node docs/visual-redesign/reference/capture.mjs
node docs/visual-redesign/review/capture-prototype.mjs
```

O comparativo permite selecionar `Desktop 415`, `Desktop 620`, `Mobile 320`, `Mobile 390` e, para cada tamanho, `Current`, `History`, `Misc` e `HUD`. Os estados detalhados de Captured, Failed, Gallery e History Pokémon/Attempts também ficam em `review/screenshots/`. Os conjuntos sintéticos da referência e do protótipo **não contêm os mesmos valores**, portanto diferenças numéricas entre lados não indicam cálculo alterado.

## 2. O que mudou na proposta visual

| Área | Layout atual (M0) | Proposta (M1) | Validação funcional futura |
| --- | --- | --- | --- |
| Identidade | Tons oliva/grafite e vários tamanhos de 8–10 px. | Grafite-azulado, ouro como acento de marca, ciano para foco, tipografia de KPIs e estados ampliada e hierarquizada. | Cores de raridade, Shiny, captura/falha, lucro e ACTIVE/STANDBY precisam continuar independentes. |
| Desktop 415 | KPIs principais em quatro colunas, largura curta por valor; filtros e várias tabelas compactos. | KPIs XP/economia **2×2**, quatro KPIs de captura ainda em linha, ações agrupadas, seções com respiro consistente. | Confirmar preferência de densidade vs altura de rolagem adicional. |
| Desktop 620 | Mesma hierarquia com mais largura. | Quatro KPIs XP/economia por linha, filtros com expansão por espaço, tabelas inteiras. | Scroll, resize, drag e geometry persistida continuam contratos do runtime real. |
| Mobile 320/390 | Fullscreen com bottom nav 54 px, KPIs XP/economia 2×2, captura em uma linha. History tem quatro filtros lado a lado. | Fullscreen simulado com bottom nav ilustrativa de 60 px, KPIs principais 2×2, captura em uma linha, History filtros 2×2 e linhas/cartões responsivos SEM scroll horizontal. | Teclado/safe-area/touch e acesso a todos os campos ainda exigem smoke real. |
| Misc | Interface, Sound Alerts e Catch Gallery no mesmo fluxo. | Seções mais claras, alertas Captured/Fled separados por legibilidade e controles de galeria agrupados. | Áudio, volume/mute, import, Gallery, Copy/Generate e persistência exigem integração real. |
| HUD | Configuração com presets, Custom, Rarity/Shiny trackers, Balls/Potions, Mobile One Column/PX Only. | Launcher e configurações reformulados, mantendo três footprints e semântica dos widgets. | A maquete M1 já espelha os quatro presets, Default Rarity Tracker span 2 e slots ocultos em One Column/PX Only; configuração Custom e persistência ainda exigem integração/smoke. |

**Correção do PO:** as tabelas Captured/Failed/History/Gallery e By Rarity mantêm seus **campos e valores**, mas podem adaptar sua **composição visual** para cartões/grades rotuladas quando faltar largura. Nenhuma delas poderá expor scroll horizontal interno no Desktop ou Mobile; dados não podem ser simplesmente cortados para ocultar barras.

## 3. Evidência objetiva já obtida

- **Baseline automatizado do repositório:** `node --test` focalizado de UI **52/52 PASS**; `npm test` completo **453/453 PASS**, incluindo integração/regressão de fixtures. Isso valida a baseline de código atualmente presente; o redesign ainda não entrou no userscript.
- **16 capturas do front real com cenário offline**: `reference/capture.mjs` usou Edge headless com viewport emulado. Medidas registraram painel 415/620 px Desktop, painel 320/390 px Mobile, barra Mobile 54 px e uma tab selecionada nos dezesseis estados.
- **M1 anterior validado quanto ao overflow, mas rejeitado quanto à densidade:** Edge headless verificou 36/36 estados sem scroll horizontal, porém constatou média de **260 px por Captured em Mobile** e somente um registro completo em print Mobile390 iniciado na seção. **M1.1 passou** nos cenários ampliados de overflow e em **métricas adicionais de registros completos por screenshot** (**52/52 PASS**). O harness captura também screenshots ancorados ao topo das tabelas; veja o relatório específico.
- **Semântica sintética**: `prototype/qa.mjs` PASS verifica sete tabelas com todas as colunas, rótulos/preservação de células, IV Total + seis componentes, `Seen = Captured + Failed` por raridade, KPIs e Rare+, sort/ARIA/teclado, filtros mock, quatro presets HUD × três modos de coluna, alvo de toque Mobile de ações/ordenação e contraste de uma amostra representativa de tokens. Não é uma auditoria WCAG integral.
- **Isolamento:** nenhuma página do jogo foi aberta, não houve tráfego WebSocket do PokePixel, nenhuma alteração de IndexedDB, nenhum commit/push/tag e nenhum arquivo de runtime real foi modificado.

## 4. Contratos ainda pendentes da implementação real

O protótipo simula somente estados de apresentação; os controles New/Pause/End, Delete, Copy/Generate, import de áudio, cálculo de dados, filtros históricos complexos, persistence e tab leadership **não estão conectados**. A etapa M2–M5 deve usar os renderers, IDs e fontes canônicas existentes.

Riscos prioritários confirmados no código:

1. **Navegação distribuída** entre `ui.js`, `audio-alerts.js` e `closed-hud-runtime.js`; é necessário garantir exclusividade e refresh correto de Current/History/Misc/HUD.
2. **CSS injetado em camadas**; consolidar tokens preservando selectors, cascata e componentes de formulário.
3. **Desktop forçado em viewport menor que 415 px**, menus Mobile com teclado/safe-area e rolagem/lotes de registros; exigem teste de navegador, não só regex ou screenshot inicial.
4. **Acessibilidade de History subtabs e cabeçalhos ordenáveis**; adicionar teclado/ARIA sem mudar comportamento ou dados.
5. **Paridade do HUD e estado persistido**, incluindo três footprints Mobile, captura Shiny/Rarity e early hydration.

## 5. Decisão solicitada ao PO

**Decisão atual recebida:** identidade, zero H-scroll e ausência de Level em Captured/Failed seguem exigidos; o PO acrescentou o requisito primordial de **prints densos, com muitos Pokémon e seus campos simultaneamente visíveis**. A apresentação em boxes não está aceita. O gate M1.1 demonstrou por screenshot e `fullyVisibleRecords` uma composição de linhas contínuas, sem campos perdidos e com as affordances funcionais do protótipo. O aceite estético dessa alternativa e a migração ao runtime são decisões posteriores.

Após validar as **condições de apresentação** no M1 atualizado, iniciar M2 em worktree isolado sobre snapshot acordado, mantendo todos os WIP atuais protegidos. Dividir por componentes, validar com os testes existentes e novos testes de DOM/layout e executar smoke real somente no ambiente autorizado. A entrega de M1 **não altera** o canal Tampermonkey nem o build publicado.
