# PokePixel Hunt Analyzer — Dark Tactical Analytics (protótipo M1.1)

Este é um **protótipo estático offline**, feito para comparar a direção visual do
redesign de Desktop e Mobile. É intencionalmente independente do runtime real:
não carrega Tampermonkey, bundles, fontes remotas, imagens remotas, APIs,
WebSocket, IndexedDB ou estado do PokePixel.

## Como abrir

Abra o arquivo abaixo no Edge, Chrome ou outro navegador moderno:

    /pokepixel-hunt-analyzer/docs/visual-redesign/prototype/index.html

No Windows, no checkout em G:\pokepixel-hunt-analyzer, a URL local é:

    file:///G:/pokepixel-hunt-analyzer/docs/visual-redesign/prototype/index.html

Também pode dar duplo clique em index.html. Os arquivos styles.css e app.js
são referências **relativas** ao mesmo diretório; não existe instalação,
servidor local, instalação de pacotes ou etapa de build.

Use a barra acima da maquete para alternar:

| Dimensão | Frame simulado | Observação |
|---|---|---|
| Desktop 415 | 415 × 700 | Janela compacta; dados completos em linhas contínuas, sem caixas individuais. |
| Desktop 620 | 620 × 700 | Janela padrão; Rarity/Failed/History em tabelas tradicionais, Captured/Gallery em duas faixas. |
| Mobile 320 | 320 × 568 | Tela pequena; navegação no rodapé e controles acessíveis no scroll vertical. |
| Mobile 390 | 390 × 844 | Retrato padrão; identidade compartilhada com composição móvel. |

**Navegação:** as abas Current, History, Misc e HUD funcionam dentro da maquete
e também pelo seletor Tela superior. As três subtabs History e seus
atalhos ArrowLeft / ArrowRight / Home / End são navegáveis. Os filtros Current
(Rarity multiselect, Shiny, Quality, IV), período History e busca/raridade da
Catch Gallery ocultam linhas **sintéticas**. Filtros Captured/Failed, History e
Gallery usam seções nativas recolhíveis: nos frames compactos **320/390/415**
aparecem **fechadas por padrão** para preservar a área útil de screenshots, mas mantêm estado/valores
ao abrir e filtrar. Toda tabela oferece ordenação ilustrativa por cabeçalhos
clicáveis quando há espaço ou por um pequeno disclosure "Sort" que contém
seletor + direção na apresentação compacta. Os presets HUD reproduzem o
**catálogo e a ocupação de slots** de userscript/closed-hud.js:131–156,
com valores numéricos apenas ilustrativos. O seletor Columns mostra
220 × 52, 145 × 52 ou PX Only 52 × 52.
As seções disclosure expandem/recolhem nativamente; Escape fecha popovers
abertos de filtragem. Tudo fica em memória e reinicia ao recarregar.

## URLs reproduzíveis para screenshots

O entrypoint suporta query parameters locais, inclusive via file://:

    index.html?viewport=desktop-415&screen=current
    index.html?viewport=desktop-620&screen=history&history=pokemon
    index.html?viewport=mobile-320&screen=misc
    index.html?viewport=mobile-390&screen=hud&hudLayout=1&hudPreset=capture
    index.html?viewport=mobile-390&screen=history&history=attempts

Valores aceitos:

- viewport: desktop-415, desktop-620, mobile-320, mobile-390.
- screen: current, history, misc, hud.
- history: hunts, pokemon, attempts.
- hudLayout: 2, 1, 0.
- hudPreset: default, leveling, economy, capture.

Parâmetros desconhecidos usam valores padrão. Nenhuma navegação abre URL externa.

## Conteúdo fiel ao contrato visual

Current apresenta XP/h You, XP/h Poké, Dollar/Profit, Seen/Captured/Failed/Rate
em **uma linha de quatro**, distribuição por sete raridades e tabelas Captured
(Pokémon, Gender, Nature, Quality, **IV Total + seis IVs individuais**) e Failed
(Pokémon, IV, Pokéball, Chance e Fled at). **Captured e Failed não mostram Level**,
conforme escolha de identidade visual do PO. History Pokémon mantém Level, pois
faz parte da agregação histórica. Um IV desconhecido em Failed aparece como
travessão, sem inferência.

**Zero rolagem horizontal interna e zero cartões por Pokémon:** M1.1 substitui
os boxes de registros rejeitados pelo PO por **tabelas contínuas, cabeçalhos
compartilhados e separadores finos entre linhas**. Não há segunda árvore DOM,
contorno individual, radius ou shadow por Pokémon. Os 11 campos de Captured
continuam visíveis em cada registro: primeira faixa Pokémon/Gender/Nature/
Quality/**IV Total** (aproximação 14/2/6/4/4 em 30 frações); segunda faixa
com os **seis IVs individuais**, um por coluna (5/30 cada). Só o header
compartilhado traz rótulos: cada linha mostra valores, não 11 etiquetas
repetidas. Em Mobile a célula do Pokémon reserva altura mínima de 44 px
para o controle Details; a segunda faixa dos seis IVs ocupa cerca de 25 px.
Esse modelo procura deixar quatro registros completos em uma captura do
viewport Mobile390 alinhada ao início da seção Captured e três no Mobile320,
sem reduzir as cifras a microtexto. A capacidade efetiva é aferida por screenshot
no Edge e não apenas pelos testes DOM.

Failed e By Rarity usam **uma única faixa de colunas** mesmo em 320 px;
History Hunts/Pokémon ficam em faixa única e preservam Lvl em Pokémon;
History Attempts e Gallery usam duas faixas quando o frame for estreito.
No Desktop620, By Rarity, Failed e History mantêm tabelas completas; Captured
e Gallery usam o cabeçalho em duas faixas para manter leitura e densidade.
Nenhum IV, total, horário, chance ou ação foi transferido para tooltip/Details.
O layout reage à largura da moldura e não ao tamanho da janela externa.

A ordem das linhas pode mudar sem romper os filtros locais. Em History Hunts,
o detalhe expandido permanece associado ao respectivo registro após ordenar;
o controle da data expande/recolhe a informação por teclado. Em modo compacto,
o disclosure "Sort" é acionável por teclado; quando aberto oferece seleção
de coluna e direção, com alvos mínimos de 44 px para ambos os controles.
Os cabeçalhos continuam **visíveis e compartilhados** no DOM com scope/ARIA;
nomes longos são abreviados apenas no desenho (Gender→G, Quality→Qlt,
IV Total→Total), mas rótulos integrais permanecem nas opções Sort e ARIA.

No **Captured**, cada Pokémon tem o próprio botão *Details*, acionável por
clique/Enter/Espaço, que expande hora exata, Pokéball e Chance daquele registro.
O detalhe permanece vinculado à mesma linha após ordenar e desaparece com a
linha quando o filtro a exclui; não existe mais um quadro global de captura
desconectado da seleção. No **Failed**, o seletor de raridade oferece as sete
categorias reais (Weak → Mythical), inclusive quando uma raridade não tem
ocorrência nas poucas linhas demonstrativas.

Em **History**, somente *Period* filtra estas fixtures offline. Os seletores
Pokémon/Rarity/Result e os avançados ficam desabilitados e identificados como
placeholders demonstrativos, não como filtros que parecem operar sem efeito.
Hunts mantém expansão e ordenação demonstrativas; o drill-down individual de
Pokémon/Attempts do runtime ainda **não é simulado** nesta maquete estática,
embora todas as suas colunas estejam presentes. Antes de migrar o redesign à
UI real, esses detalhes permanecem no checklist de paridade funcional.
Em **Catch Gallery**, os timestamps de Captured incluem segundos; Generate/Copy
são botões nativos desabilitados e marcados como *Preview only*, sem efeito
de geração/cópia nesta maquete.

History mostra Hunts, Pokémon e Attempts, filtros básicos e avançados,
distribuição tabular, detalhes e affordance visual de Delete. Misc ilustra
Interface, Sound Alerts Captured/Fled, Custom, Volume e Catch Gallery com filtros
e ações Generate/Copy. HUD ilustra os quatro slots contratados, os três tamanhos
de launcher, raridades, Shiny Seen/Captured e estoques de Ball/Potion. O bloco
"Telemetry Semantics" é um catálogo ilustrativo **separado** do preset selecionado.
A semântica cromática
separa raridade, Shiny, ACTIVE, captura, falha, lucro e ações de Hunt. Fontes
usam apenas o stack de sistema (Inter quando instalado, Segoe UI/Arial fallback).

**Presets do launcher (ordem de slots 1–4):**

| Preset | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
|---|---|---|---|---|
| Default | Seen | Seen/h | Rarity Tracker **span 2** | Vazio, consumido pelo slot 3 |
| Leveling | Trainer XP/h | Pokémon XP/h | Seen | Seen/h |
| Economy | Dollar/h | Profit/h | Expenses | Hunt Time |
| Capture | Seen | Captured | Failed | Capture Rate |

O Rarity Tracker padrão mostra as **sete quantidades Captured por raridade**,
na ordem Weak → Mythical, sem exibir Failed porque o preset de origem possui
showFailed=false. Os números reproduzem a tabela sintética By Rarity.

Em **2 Columns**, o launcher exibe os quatro slots, exceto o slot 4 consumido
pelo Rarity Tracker no Default. Em **One Column**, mostra somente os inícios
de linha, **slots 1 e 3**, inclusive quando o slot 3 é um Rarity Tracker largo;
o componente passa a ocupar uma coluna. Em **PX Only**, o launcher mostra
**somente PX**, sem widgets. Os cards de configuração ocultam os slots que não
aparecem nos layouts 1 e 0; alterar o layout não apaga nem reordena o preset.

## Limitações explícitas

- Ações New Hunt, Pause, End Hunt, Delete, Generate e Copy são **elementos
  visuais**, deliberadamente sem interação com gameplay/IndexedDB/clipboard.
- Sound 1/2/Custom e controles reais de preferências não são reproduzidos;
  a matriz e o volume são somente ilustrativos e não emitem áudio.
- Filtros, ordenação e expansão alteram exclusivamente as poucas linhas de
  fixture embutidas no HTML. Os dados não são amostra do histórico do usuário.
- A prévia simula dimensões em uma moldura interna. Não simula teclado virtual,
  safe area de aparelho físico, drag/resize da janela, múltiplas abas reais,
  persistência, browser-host CSS nem tempo/telemetria em execução.
- Não é Capture Ticket: o PNG exportado preserva seu design atual. A Gallery
  apenas ilustra os controles.
- As cores e tamanhos são proposta M1 ainda sujeita à validação de contraste
  visual e aceite do PO; nada foi integrado à árvore real do userscript.

## Roteiro de QA da maquete

1. Abrir index.html por file://; inspecionar em DevTools que há apenas
   index.html, styles.css, app.js, sem requisições externas.
2. Alternar os quatro viewports e os quatro destinos; verificar uma única
   seção visível e a aba selecionada em Desktop e Mobile.
3. Abrir History → Pokémon → Attempts → Hunts; acionar subtabs via teclado.
   Alternar Period Today/Yesterday e expandir More filters.
4. Em Current, escolher Rarity apenas Legendary, Shiny Yes, Quality 2.00
   e IV 180; contagem de Captured deve chegar a 1. Com IV 185, exibir
   estado vazio. Acionar Details de Dragonite e Gengar e conferir que cada um
   tem sua própria hora/Ball/Chance; ordenar e filtrar após expandir. Testar
   Failed com IV 1: IV desconhecido não deve passar. Verificar as sete opções
   de Rarity Failed, mesmo com linhas de fixture somente Rare+.
5. Em Misc, procurar “mew”, filtrar “mythical”, depois combinação impossível
   para verificar estado vazio. Conferir texto da matriz Captured/Fled.
6. Em HUD, alternar os quatro presets e os layouts 2, 1, 0, confirmando
   proporções 220×52, 145×52 e 52×52 na moldura. Conferir slots
   exatos da tabela acima; Default Rarity Tracker ocupa 3+4, One Column
   mantém 1/3 e PX Only mostra apenas o monograma.
7. Em 320/390/415/620, verificar que **nenhuma tabela** nem o scroll
   principal têm rolagem horizontal nem box por registro. Captured mostra
   IV Total e os seis componentes na segunda faixa sob um único cabeçalho
   global; filtros Quality/IV e sort continuam válidos. Failed não apresenta
   nível, History Pokémon preserva Lvl. No Mobile, recolher Filters e Sort,
   fazer screenshot alinhado ao início de Captured e contar registros
   **completos**; metas de aceite M1.1: pelo menos 4 no Mobile390 e 3 no
   Mobile320, sem dado escondido/illegível. Em History Attempts Mobile320,
   confirmar ao menos 3 linhas completas quando alinhado à tabela.
   Reabrir Filter/Sort por teclado, alterar condições e verificar a
   associação correta dos detalhes depois da ordenação.
   Os filtros History desabilitados têm explicação visível; os detalhes de
   Pokémon/Attempts deverão ser revistos contra o runtime durante M3/M4.
8. Inspecionar contraste, foco visível, numerais tabulares e texto legível em
   415×700/620×700 e 320×568/390×844; confirmar que o conteúdo não sobrepõe
   a barra inferior em Mobile e que as três ações de Hunt simuladas têm
   altura mínima de 44 px no modo Mobile. Os indicadores visuais de Generate/Copy
   da Gallery e o botão de direção de ordenação também ocupam no mínimo 44 px,
   embora Generate/Copy continuem intencionalmente sem ação real.

Esta validação é **exclusivamente da maquete**. Gate M5 da UI real continua
exigindo testes próprios, screenshots e smoke de runtime separado.

Se o repositório já tiver as dependências de desenvolvimento instaladas,
execute o smoke de DOM local:

    node docs/visual-redesign/prototype/qa.mjs

O smoke utiliza happy-dom **apenas durante a validação**. O HTML aberto por
file:// continua sem nenhuma dependência Node, extensão ou chamada de rede.
