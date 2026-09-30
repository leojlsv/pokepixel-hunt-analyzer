# Evidência M1.1 — capacidade de screenshots do Hunt Analyzer

**Data:** 29/09/2026. **Artefato:** protótipo independente `docs/visual-redesign/prototype/`. **Cenário:** dados sintéticos de Pokémon/IVs; Edge headless isolado, sem jogo, tráfego WebSocket, Tampermonkey nem alteração de dados reais.

## Resultado visual — caixas rejeitadas versus linhas contínuas

| Tamanho / vista | M1 anterior — cards por Pokémon | M1.1 — linhas contínuas | Comparação |
| --- | --- | --- | --- |
| Mobile **320×568**, Captured, seção no topo | **0/4** registros inteiros; linha média **260px** | **3/4** registros inteiros; linha média **76px** | Agora o quarto registro começa no mesmo print. |
| Mobile **390×844**, Captured, seção no topo | **1/4** registros inteiros; linha média **260px** | **4/4** registros inteiros; linha média **76px** | Também aparece o início de Failed na parte inferior. |
| Desktop **415×700**, Captured, seção no topo | **1/4** registros inteiros; linha média **246px** | **4/4** registros inteiros; linha média **76px** | Filtros recolhidos, controles sempre reabertos com toque/teclado. |
| Desktop **620×700**, Captured, seção no topo | **1/4** registros inteiros; linha média **195px** | **4/4** registros inteiros; linha média **76px** | Failed aparece logo abaixo quando há área útil. |
| Mobile **320×568**, Captured com topo da tabela alinhado | **1/4** inteiro | **4/4** inteiros | Campos de todos os quatro registros permanecem visíveis. |
| Mobile **320×568**, History Attempts | Antes dos ajustes, nenhum registro na primeira tela em configuração de filtros abertos. | **2/3** registros completos com a seção no topo e **3/3** quando a tabela está alinhada ao topo; **51px por linha**. | As seis colunas permanecem presentes em duas faixas compactas, com controles de toque de 44px. |
| Mobile **320×568**, Catch Gallery | **1/3** registro inteiro na seção; linha média **220px**. | **3/3** registros inteiros; linha média **70px**. | Quality, IV, timestamp e ações continuam expostos. |

**Como conferir visualmente:** abrir [comparação específica para prints](review/share-compare.html), alternar `Mobile 320`, `Mobile 390`, `Desktop 415`, `Desktop 620`. À esquerda, a composição M1 rejeitada congelada em cinco PNGs locais; à direita, a última proposta M1.1. Para testar a navegação, abrir a [maquete offline interativa](prototype/index.html).

## Protocolo automatizado

```powershell
node docs/visual-redesign/prototype/qa.mjs
node docs/visual-redesign/review/capture-prototype.mjs
```

A segunda rotina fotografa **52 cenários** (quatro viewports × treze estados): Current, History Hunts/Pokémon/Attempts, Misc, HUD, Captured, Failed, Gallery e quatro estados adicionais com o topo da **tabela** alinhado ao scroll vertical. Cada navegação recebe um `captureCase` único e espera o URL, o viewport, a view e a subtab efetivos antes de medir, evitando fotografar conteúdo de uma navegação anterior.

Checks geométricos por cenário: dimensões exatas do frame, uma tela e tab principal ativas, quatro destinos, nenhum wrapper de tabela com `overflow-x:auto/scroll`, `scrollWidth <= clientWidth + 2px` tanto do wrapper como do scroller principal, nenhum campo ou célula recortado lateralmente e ausência de Level em Captured/Failed. History Pokémon mantém Lvl. Critérios de densidade são computados a partir de registros cujo retângulo completo fica dentro do scroller; não se contam cabeçalhos ou linhas parciais.

Na execução de 29/09/2026, **52/52 estados PASS**, inclusive as metas mínimas de densidade de Mobile320/390 e Desktop415/620 e a Gallery/History Attempts de Mobile320. O teste DOM `prototype/qa.mjs` também passou nos contratos de colunas, IV total + seis IVs, raridades, filtros/sort, ARIA/tablist e HUD; ele não substitui teste com tecnologia assistiva real. Casos sintéticos adicionais com nomes/bolas muito longos, chance de **100.000%** e detalhe Captured expandido passaram na geometria Mobile320 sem scroll horizontal; esses extremos podem aumentar a altura de uma linha excepcional.

## Conteúdo e limites da aprovação

- **Captured:** total de IV + HP, Atk, sAtk, Def, sDef e Speed visíveis na segunda faixa de cada registro, com gênero, natureza e qualidade na primeira. Sem Level. Detalhes de Ball/Chance/Time podem ser abertos no próprio registro, mas não ocupam altura quando fechados.
- **Failed:** Pokémon, IV disponível ou `—`, Ball, Chance com precisão e horário visíveis lado a lado. Sem Level.
- **History Pokémon:** Level explícito como chave de agregação; os campos Hunts/Attempts e Gallery não são descartados. Ações e ordenação do protótipo continuam representativas, não conectadas a banco/jogo.
- **Compartilhamento:** não existe captura/exportação automática por Discord neste escopo; o objetivo é que um screenshot **normal** do Analyzer já tenha densidade útil, sem modo paralelo nem duas listas de dados.

**Ainda pendente:** conferir o visual no dispositivo/zoom real e validar NVDA/VoiceOver e nomes extremos; implementar o reflow no userscript efetivo com todos os campos e fluxos reais, incluindo carregamento de 201+ encontros, filtros, paginação, sort e Details. A execução desta maquete não autoriza commit, atualização do Tampermonkey ou release.
