# Plano de redesign visual — Hunt Analyzer (Desktop + Mobile)

**Status:** paleta/identidade Dark Tactical Analytics aceitas como direção; o PO rejeitou M1 em cartões por Pokémon por prejudicar prints compartilhados no Discord. **M1.1 em linhas contínuas** foi produzido offline e passou **52/52** cenários de geometria/densidade Edge, preservando Captured/Failed sem Level e tabelas sem rolagem horizontal. **A estética final M1.1 ainda precisa de confirmação do PO**; integração ao userscript permanece pendente.

**Base inspecionada:** código local de 29/09/2026, `package.json` 1.13.6, com alterações de trabalho ainda não consolidadas.
**Responsabilidade:** designer/PO define a linguagem final; desenvolvedor implementa; QA independente verifica paridade funcional e visual.

**Revisão disponível neste workspace:** [Comparativo M0 × M1.1](visual-redesign/review/compare.html), [comparativo específico da densidade de prints](visual-redesign/review/share-compare.html), [maquete interativa](visual-redesign/prototype/index.html), [evidência quantitativa M1.1](visual-redesign/SCREENSHOT_SHARING_QA_REPORT.md) e [gate de decisão](visual-redesign/REVIEW_GATE.md). Os comparativos dependem de PNGs locais; os comandos de reprodução estão no gate.

**Correção de escopo posterior (prioridade sobre esta versão inicial do plano):** seguir [contrato de tabelas sem rolagem horizontal](visual-redesign/TABLE_PRESENTATION_CONTRACT.md). O layout tabular poderá adaptar sua grade sem remover nenhum campo; **a solução de cartões individuais foi substituída** pela regra M1.1 indicada adiante. O nível é omitido de Captured/Failed, mas permanece onde é parte legítima do History.

**Correção visual subsequente (29/09/2026):** o PO rejeitou **cartões individuais por Pokémon**, pois prejudicam prints de listas densas compartilhados no Discord. Seguir [contrato M1.1 de compartilhamento visual](visual-redesign/SCREENSHOT_SHARING_CONTRACT.md), que prevalece sobre sugestões antigas de cards: linhas contínuas com cabeçalhos compartilhados e uma ou duas faixas por registro, sem rolagem horizontal e sem perda de campos.

## 1. Objetivo e definição de pronto

Modernizar a identidade visual do **PokePixel Hunt Analyzer** com uma linguagem coerente de analytics para jogo: legibilidade, hierarquia, densidade controlada e respostas visuais claras para eventos importantes. Desktop e Mobile devem compartilhar identidade e contratos funcionais, mas ter composição e interações adequadas a cada modo.

O projeto termina quando:

1. **Todas as funcionalidades existentes continuam alcançáveis e operacionais** em ambos os modos, com as mesmas fontes de dados, filtros, ações, estados e persistência.
2. Há protótipos e capturas de referência aprovados para as quatro superfícies (**Current, History, Misc, HUD**) e seus estados essenciais, em Desktop e Mobile.
3. Todos os elementos interativos e valores relevantes têm contraste, legibilidade, foco visível e alvos de toque apropriados; valores importantes não desaparecem por truncamento silencioso.
4. Alternância Auto/Desktop/Mobile, reload, painel aberto/minimizado, drag/resize/opacity onde aplicável e ACTIVE/STANDBY continuam previsíveis.
5. O build validado passa `npm run validate`, verificações de layout/teclado/touch e o smoke manual completo de `docs/DEVELOPMENT.md` nas duas plataformas.
6. Performance de atualização, armazenamento e contrato de embed permanecem no baseline estabelecido antes de implementar o redesign.

**Não é objetivo:** mudar fórmulas, WebSocket, IndexedDB, formato de dados, emissão de comandos de gameplay, infraestrutura, runtime Tampermonkey, conteúdo do Capture Ticket ou identidade do userscript; introduzir framework de UI ou duas árvores de DOM independentes. O ticket gerado continua com seu próprio layout/arte: esta iniciativa redesenha preview e controles em torno dele, não o PNG em si.

## 2. Diagnóstico do código atual

| Área | Contrato atual | Consequência para o redesign |
| --- | --- | --- |
| Modos | `ui-mode.js` detecta Mobile por ponteiro primário coarse + sem hover e menor dimensão até 768 px; override Auto/Desktop/Mobile. `ui-state.js` persiste geometria Desktop e launcher por modo. | Validar **modo e largura disponível**, inclusive overrides, resize e rotação. Evitar regra responsiva exclusivamente por `window.innerWidth`. |
| Shell Desktop | `ui.js` monta Shadow DOM, move/abre painel e launcher, ajusta viewport, persiste drag/resize. `closed-hud-runtime.js` aplica mínimo Desktop compacto de **415 px** e migra o antigo 430 px. | Priorizar a janela flutuante de 415–620 px; não propor sidebar permanente que roube o espaço dos dados. Preservar posição, alpha e interações. |
| Shell Mobile | `mobile-styles.js` usa painel fullscreen com `100dvh`/safe areas e uma superfície principal de scroll; `closed-hud-mobile-styles.js` transforma a navegação nativa em barra inferior de quatro abas (54 px). | Preservar bottom nav Current/History/Misc/HUD, launcher e `visualViewport`; testar teclado virtual, rotação e recorte de menus. |
| Apresentação | Tokens parciais em `styles.js`; regras locais e cores literais em `ui-markup.js`, `history-styles.js`, `closed-hud.js`, `closed-hud-runtime.js`, `mobile-styles.js`, `closed-hud-mobile-styles.js`, `audio-alerts.js` e `catch-gallery.js`. | Criar inventário de cascata antes de trocar tema. Centralizar tokens sem quebrar prioridade das injeções nem os seletores reais. |
| Navegação | Current/History vêm do shell; Misc e HUD são montados/integrados depois, com semântica de tabs em `closed-hud-runtime.js`. O controle de view é distribuído entre `ui.js`, `audio-alerts.js` e `closed-hud-runtime.js`. | Manter quatro destinos, ARIA/teclado, refresh exclusivo da view visível e posição dos nós operacionais entre modos. Avaliar controlador único em refactor isolado com testes de navegação, sem mudar ações. |
| Mobile denso | Métricas principais em 2 colunas; resumo Seen/Captured/Failed/Rate em **uma linha de 4**; Captured/Failed continuam tabelas; filtros e botões usam áreas de toque de 44 px. | Não substituir tabelas por cards que ocultem colunas, nem transformar quatro KPIs de captura em scroll/carrossel sem decisão explícita. |
| Closed HUD | Desktop 2×2; Mobile inclui também One Column e PX Only. Catálogo, hierarquia de raridades e contagens são contratados em `docs/CLOSED_HUD.md`. | Tratar o launcher como superfície com densidade própria. Preservar **Captured exato**, `★ Seen / Captured`, seleções de raridade e inventário de Balls/Potions. |
| Limites de runtime | `docs/ARCHITECTURE.md` define embed separado: o Analyzer embutido expõe resumo público, sem montar painel/HUD. O preview do Capture Ticket tem Shadow DOM próprio. | Restringir redesign à UI standalone; não modificar `__POKEPIXEL_HUNT_ANALYZER_PUBLIC__`. Estilizar o preview isoladamente, sem presumir herança de tokens pelo segundo Shadow DOM. |

**Risco principal identificado:** existem vários blocos de CSS injetados em momentos diferentes, além de estilos inline e testes que verificam CSS por strings exatas (`tests/unit/designTokens.test.js`, `desktopLayout.test.js`, `mobileStyles.test.js`, `layoutPolish.test.js`). A migração deve preservar comportamento e adaptar esses testes para as propriedades pretendidas, complementando-os com verificações de DOM/renderização; uma busca/substituição global de paleta é inadequada.

## 3. Direção visual proposta para aprovação

**Conceito: Dark Tactical Analytics.** Visual escuro, técnico e contemporâneo, conectado ao jogo por acentos discretos. A interface deve parecer um instrumento de leitura rápida, sem neon generalizado, textura pesada, bordas grossas, tipografia minúscula ou abundância de cards decorativos.

| Elemento | Proposta inicial | Regra de uso |
| --- | --- | --- |
| Superfícies | Canvas grafite-azulado escuro, elevação sutil para cartões/painéis e cabeçalhos distintos por luminosidade. Referências exploratórias: `#151B1D`, `#1D2528`, `#273134`. | Separação por espaçamento, borda de 1 px e luminância; sombra curta somente para janela, menus e popovers. Valores finais dependem de teste de contraste. |
| Acentos | Ouro preservado como reconhecimento da marca (`#D7B45D` atual); ciano reservado a informação e foco. | Ouro não deve representar simultaneamente botão primário, todos os labels e estados informativos. |
| Semântica | Manter cores próprias de raridades e estados Active/Standby, Captured/Failed, Shiny e ações New/Pause/End. | Não depender exclusivamente da cor: manter números, texto, símbolo/estado acessível. |
| Tipografia | Inter/sans do projeto, numerais tabulares, títulos e valores alinhados. Escala inicial: valor KPI 16–20 px; corpo/controle 12–14 px Desktop e 13–14 px Mobile; microinformação apenas quando não operacional. | Inspecionar o espaço real do painel compacto. Evitar 8–9 px para instruções, labels tocáveis e texto que exige leitura. |
| Espaçamento/forma | Escala 4/8/12/16 px, cartões 6 px, painel 8 px no Desktop, indicadores/badges moderados; áreas de toque Mobile >=44×44 px. | Manter densidade informacional; raios consistentes; não inflar altura de tabelas desnecessariamente. |
| Movimento | Hover discreto, pressed claro, skeleton só se necessário; respeito a `prefers-reduced-motion`. | Nenhuma animação contínua durante Hunt nem transição que atrase estado crítico. |

**Decisão visual do PO na etapa 1:** validar esse conceito com comparativo real (estado atual e protótipos) em painel Desktop compacto, Mobile retrato e Closed HUD. Cores/cantos acima são hipóteses de design, não tokens definitivos.

### Composição Desktop

- Preservar painel flutuante redimensionável (prioridade: **415 px compacto** e **620 px padrão**). Header de identidade compacto; tabs Current/History/Misc/HUD visíveis e estado ACTIVE/STANDBY distinguível.
- Current: status e ações de Hunt com evidência semântica, 4 KPIs econômicos/XP, resumo de 4 KPIs de captura, Rarity, Captured e Failed; cabeçalhos de seção consistentes, colapsos claros e dados alinhados por coluna.
- History: subtabs Hunts/Pokémon/Attempts, filtros em linhas estáveis, expansão e detalhes legíveis; no painel estreito, preferir hierarquia/detalhes sob demanda e contêiner de tabela explícito à eliminação de dados. Aplicar semântica de tabs e interação por teclado aos subtabs; ordenação de tabela precisa ser acionável sem mouse.
- Misc/HUD: organizar grupos por tarefa, mantendo selects nativos quando aplicável, toolbar e ações destrutivas visivelmente distintas.

### Composição Mobile

- Painel fullscreen respeitando safe area, header operacional condensado, **uma superfície vertical principal de rolagem**, bottom nav de quatro destinos alcançável e conteúdo nunca escondido atrás dela.
- Current: métricas de XP/economia em grid 2×2, resumo de captura em linha de quatro com labels legíveis, Rarity e tabelas Captured/Failed com as mesmas informações e filtros.
- Filtros em duas colunas quando couberem; dropdowns/proxies com limites pelo viewport visível; teclado numérico não pode cobrir seleção, aplicar filtro ou navegação.
- History: manter Hunts/Pokémon/Attempts e todos os seus detalhes. Em larguras compactas, usar linhas/cartões responsivos rotulados **sem perder campos ou comportamentos** e sem barras de rolagem horizontal.
- HUD: preservar modos 2 Columns, One Column e PX Only; compactação distinta do painel cheio. Tocar, arrastar e abrir o launcher não podem conflitar.
- Orientação paisagem: ajustar densidade conforme espaço real, preservar navegação e o botão de fechar; não depender apenas de orientação CSS. O modo Auto é escolhido na montagem: tratar mudanças de viewport dentro do modo sem supor troca automática Mobile↔Desktop.

## 4. Matriz de paridade funcional (obrigatória)

| Superfície | Casos que precisam seguir funcionando | Desktop / Mobile |
| --- | --- | --- |
| Shell | Abrir/minimizar, four-tab nav, ACTIVE/STANDBY, modo Auto/override, alpha, F5 e persistência; drag/resize Desktop; launcher drag/touch Mobile. | Ambos, com gestos próprios. |
| Current/Hunt | New Hunt, Pause/Resume, End; duração ativa; XP/h You, XP/h Poké, Dollar, Profit/Expenses, Seen/Captured/Failed/Rate, By Rarity/Shiny. | Mesmos cálculos, valores, estados e colapsos. |
| Captured | Filtro multisseleção de raridades, Shiny, Quality, IV; ordem, detalhes de IV/genética/captura quando disponíveis. | Mesmas colunas, critérios e ordenação; zero vazamento de popover. |
| Failed | Filtro Rarity/Shiny/IV, Pokémon/IV/Pokéball/Chance/Fled at, timestamp e ordenação. | Mesmo significado e precisão; nenhum valor faltante inferido. |
| History | Hunts/Pokémon/Attempts, filtros básicos/avançados, Load More, expandir detalhes/notables, DELETE com confirmação e bloqueio da Hunt ativa. | Mesmas ações; estados vazios e erro incluídos. |
| Misc | Alertas Captured/Fled, Sound 1/2, volume/mute, custom audio import/replace/remove; Catch Gallery filtrar/ordenar/paginar/Generate/Copy; Interface UI Mode/Opacity. | Mesmas funções e persistência; ticket PNG sem redesign de conteúdo. |
| HUD | Presets/Custom, slots/widgets, Rarity Tracker/Shiny Tracker, Ball/Potion e inventário; One Column/PX Only Mobile; dados hidratados antes de exibir. | Catalogação e semântica preservadas. |
| Integrações | Shadow DOM, runtime passivo, IndexedDB, ACTIVE/STANDBY multitab, resumo público e embed sem UI. | Sem alteração de contrato. |

## 5. Marcos, entregas e ordem de execução

Estimativa indicativa para **1 desenvolvedor com revisões de UX e QA**. Uma tarefa deve caber em um dia; marcos só avançam com aceite de suas evidências. Estimativas são de esforço, não prazos prometidos.

| Marco | Trabalho em lotes de até 1 dia | Entrega verificável | Esforço |
| --- | --- | --- | --- |
| **M0 — Congelar referência** | Inventariar mudanças WIP e escolher baseline isolado; capturar screenshots Desktop/Mobile dos 4 destinos e estados normal/vazio/filtro aberto/HUD; inventariar seletores, classes, cascade e contratos de teste. | Matriz de telas + imagens baseline e lista de DOM/ações invariantes. | 2–3 d |
| **M1 — Protótipos e tokens** | Construir proposta de paleta/escala em arquivo de design; testar legibilidade Desktop 415/620 e Mobile 320/390; validar shell, KPI, tabela, filtro, HUD e alertas; registrar decisão do PO. | Spec visual de componentes com estados hover/pressed/focus/disabled e referências aprovadas. | 2–3 d |
| **M2 — Fundação compartilhada** | Consolidar tokens semânticos e aliases existentes; mapear ordem de injeção dos estilos; modernizar botão/input/select, badge, seção, row/table, popover/foco; isolar adaptações por modo/container. Decidir, com teste de contrato, se a navegação distribuída será mantida ou reunida em controlador único. | Componentes base consistentes sem alterar handlers, seletores e IDs. | 3–4 d |
| **M3 — Shell e Current** | Redesenhar header/nav/painel/launcher; validar geometry/resize/persistência, exclusividade das 4 views e semântica de tabs; redesenhar status/Hunt/KPIs, rarity, filtros, tables Captured/Failed; tratar 320/415 sem perda de campos. | Current e shell funcionais nos dois modos e evidências de antes/depois. | 4–5 d |
| **M4 — History, Misc e HUD** | Redesenhar filtros/tabelas/drill-down History; Sound Alerts e Interface; Gallery e janela de preview do Ticket; configurações e launcher HUD 2×2/One Column/PX Only. | Paridade completa dos quatro destinos e HUD, ambos os modos. | 4–6 d |
| **M5 — Gate de qualidade** | Testes por contrato e computed layout, screenshots comparativas, smoke em ambiente de jogo autorizado, duas abas e browsers alvo; corrigir regressões; documentar rollout/reversão. | Evidências QA e candidato de build isolado; aprovação para liberar é decisão separada. | 3–4 d |

**Envelope:** aproximadamente **18–25 dias úteis de esforço** + **20% de margem** para variações de conteúdo, CSS dinâmico e discrepâncias entre navegadores (total aproximado de 22–30 dias de trabalho). Revisões do PO/QA podem ocorrer em paralelo; nenhuma data de entrega fica presumida.

### Dependências e regras de execução

1. M0 deve começar **após fixar um snapshot verificável** do WIP atual, sem limpar nem sobrescrever alterações de terceiros. O desenvolvimento segue em branch/worktree isolado sobre baseline acordado.
2. M1 é gate visual: nenhuma migração estética ampla antes de comparar designs e definir tokens aceitos. Primeiro testar um painel compacto e um celular; são os formatos mais restritivos.
3. M2 mantém os nomes semânticos `--hunt-*` como camada de compatibilidade e migra os hardcodes de forma localizada. Stylesheet principal, `ui-markup`, styles específicos e injeções tardias devem ter hierarquia documentada.
4. M3–M4 devem preservar IDs, atributos, renderers, handlers e o fluxo que move nós entre header, nav e Misc; mudanças de DOM funcional só se justificam por teste equivalente.
5. Testes existentes que verificam **valores CSS literais** serão atualizados de maneira deliberada para os novos tokens e propriedades, sem simplesmente remover asserts. Adicionar testes de comportamento/layout onde a regex não prova o resultado final.
6. Não alterar o bundle `dist/`, canal de atualização ou release como parte dos protótipos. Release continua sob processo de `docs/TAMPERMONKEY_UPDATES.md`.

## 6. Critérios verificáveis por viewport e estado

| Cenário | Verificação obrigatória |
| --- | --- |
| Mobile retrato **320×568**, 360×800, 390×844, 430×932 | Bottom nav visível com teclado recolhido; **nenhuma tabela com scroll horizontal interno**; vertical scroll principal alcança todos os valores; nenhum controle interativo fica permanentemente inacessível por safe area/nav/teclado; áreas de toque >=44×44 px; KPIs/labels e valores sem truncamento silencioso; filtros editáveis e fecháveis. |
| Mobile paisagem 640×360 e 844×390; simular inset/teclado | Header/rodapé não colidem quando o teclado está fechado; campo focado e opção selecionada continuam alcançáveis dentro do `visualViewport`; menu fecha por Escape ou gesto; minimizar e navegar continuam possíveis após dispensar teclado. Em altura reduzida, não exigir que teclado, todos os campos e nav fiquem simultaneamente visíveis. |
| Tablet/coarse 768×1024, override Auto/Desktop/Mobile | Regra de detecção + override funciona; cada modo responde ao espaço disponível; transição por reload não perde preferências. Documentar Auto estático após montagem. |
| Desktop forçado com viewport de **360–390 px** | Painel mínimo atual de 415 px pode ultrapassar viewport: fornecer recuperação acessível para voltar a Mobile ou limitar geometria sem perder controles. Nenhuma posição persistida pode tornar o seletor de modo inacessível. |
| Desktop painel **415×280**, 620×~700 e 900×~700 em browser 1280×720 / 1920×1080 | Resize/drag/restore mantêm painel visível; header/tabs e ações não colidem; tabelas preservam cabeçalhos/labels e leitura **sem rolagem horizontal interna**; scroll não captura a página do jogo indevidamente. |
| Estados e conteúdo extremo | Sem Hunt, Running, Paused, Ended, ACTIVE/STANDBY; valores grandes/negativos, texto longo, raridade Shiny, taxa muito pequena e dados nulos mostram representação correta; colapsos e filtros persistem. |
| Navegação e atualização | Vinte alternâncias entre Current/History/Misc/HUD + F5 com filtros ativos mantêm exatamente um painel visível, uma tab com `aria-selected=true`/`tabIndex=0`, handlers e menus não duplicados; abrir Misc/HUD não gera refresh extra de History nem segundo fluxo de polling. |
| HUD compactado | Mobile 2 Columns **220×52**, One Column **145×52** e PX Only **52×52**, com dados reais após hidratação; tap com deslocamento inferior ao limiar de 8 px abre uma vez, drag acima do limiar move sem abrir, sem posição persistida fora do viewport seguro. |
| Acessibilidade/legibilidade | Contraste de texto normal >=4.5:1 e controles/ícones relevantes >=3:1 quando aplicável; foco visível; tablist principal e subtabs History por setas/Home/End; ordenação por teclado com `aria-sort`; labels acessíveis; zoom browser até 200% testado. |
| Compatibilidade | Chrome/Edge desktop, Chrome Android e ao menos um browser móvel secundário quando disponível; mouse, teclado, touch, tab ACTIVE/STANDBY, load de painel e hidratação do HUD. |
| Custos | Fixar baseline de tamanho do bundle e render/refresh por fixture antes de M2; após M5, não aceitar regressão material de tempo/memória/bundle sem análise explícita e aprovação. |

Checklist funcional de execução: `docs/DEVELOPMENT.md` §8, testes `tests/unit/{designTokens,desktopLayout,mobileStyles,mobileBottomNavShell,layoutPolish,accessibilityStyles}.test.js`, testes de History/HUD/Gallery/Audio/Ticket e `npm run validate`. Resultados de testes CSS sem browser **não substituem** evidência visual em viewport real.

## 7. Riscos concretos e mitigação

| Risco | Mitigação | Prioridade |
| --- | --- | --- |
| CSS em múltiplas camadas/injeção tardia sobrescreve tema novo | Mapa de cascade no M0, tokens + aliases no M2, computed styles dos pontos críticos, revisão por feature. | Alta |
| Aumento de tipografia elimina campos em painel 415 px e tabela Mobile | Protótipos com valores extremos no M1; hierarquia e espaços responsivos medidos; detalhes completos acessíveis sem perda de coluna. | Alta |
| Alterar header/nav rompe movimento de nós, atalhos ou switches entre views | Preservar contratos de `closed-hud-runtime.js`/`ui.js`, smoke de teclado e modos no M3. | Alta |
| Misc usa desvio por History e HUD manipula views diretamente | Contratar exclusividade da rota, refresh apenas quando necessário e `getActiveView()` coerente; se centralizar controlador, testes antes da mudança visual. | Alta |
| Desktop forçado em viewport menor que 415 px pode deixar comandos fora da tela | Testar recovery no M1 e guarda geométrica no M3, sem quebrar modo Desktop em resoluções normais. | Alta |
| Launcher novo quebra arraste/click, persistência e configuração HUD | Tests de touch com threshold, reload e três layouts do HUD, sem alterar agregações. | Alta |
| Popover ultrapassa tela/teclado e bloqueia filtro | Usar limites de `visualViewport`, safe areas, overflow controlado e fechamento por Escape/toque; com teclado aberto exigir acesso ao foco e opção selecionada, não visibilidade integral da UI. | Alta |
| Subtabs History e headers de ordenação atuais não têm cobertura completa de tabulação/ARIA | Incluir controles acessíveis sem remover sort/filter nativo, testar teclado e anúncio de estado. | Média |
| Regressão de métricas, dados ou performance por acoplamento estético | Não tocar em `domain/`, `data/`, `services/`; renderers existentes; fixtures representativas; medir baseline. | Alta |
| Testes de string CSS passam/falham sem refletir interface real | Atualizar asserts intencionais, complementar com snapshots/medidas DOM; inspeção visual em ambos os modos. | Média |
| Alterações paralelas da branch mudam estrutura durante redesign | Isolar worktree e rebase planejado com comparação de contratos antes de integrar. | Alta |

## 8. Próxima ação concreta

**M0/M1.1 já executados offline:** baseline real sintético, redesign em linhas contínuas, comparativo Discord e testes de densidade+zero H-scroll em **52 cenários** Mobile320/390 e Desktop415/620. **Próxima decisão visual:** o PO avalia [share-compare.html](visual-redesign/review/share-compare.html), sobretudo legibilidade dos cabeçalhos/IVs nas larguras 320/390 e o número de Pokémon completos por screenshot. **Após aceite:** estabelecer snapshot verificável do WIP atual e iniciar vertical slice M2/M3 no userscript em branch/worktree isolado, mantendo as funcionalidades e acrescentando QA de 201+ registros, acessibilidade assistiva, estado de filtros, zoom e smoke em ambiente autorizado. Não criar commit, release ou publicar o build durante a fase de maquete.
