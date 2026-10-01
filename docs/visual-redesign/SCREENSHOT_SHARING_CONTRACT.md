# Contrato M1.1 — densidade para prints de Discord

**Feedback de produto: 29/09/2026, 13:51 UTC.** A apresentação por um **cartão alto por Pokémon** do protótipo M1 foi rejeitada, apesar de respeitar o requisito anterior de evitar rolagem horizontal. Os usuários compartilham **screenshots das listas de dados no Discord**; caberem poucos registros no mesmo frame reduz o valor do Analyzer.

## Requisito de produto

Um print de Captured, Failed, History ou Gallery deve permitir **comparar múltiplos registros completos**, de relance e sem arrastar a tabela lateralmente. A unidade visual é uma **tabela contínua de alta densidade**, não caixas individuais.

Estão mantidas as duas decisões anteriores: **Captured e Failed não exibem Level**; **nenhuma tabela exige rolagem horizontal** tanto em Mobile como Desktop. O nível continua presente em History Pokémon, pois é parte da agregação.

### Composição recomendada

- **Captured (11 campos):** uma faixa de identificação/alinhamento `Pokémon | Gender | Nature | Quality | IV Total` e outra de **seis IVs** `HP | Atk | sAtk | Def | sDef | SpD`; cabeçalho/legenda de coluna compartilhada, não repetida em cada registro; valores numéricos completos, Shiny e raridade legíveis.
- **Failed (5 campos):** uma ou duas faixas curtas conforme o tamanho do painel, mantendo Pokémon, IV ou `—`, Ball, Chance exata e Fled at. Sem Level.
- **History Hunts, Pokémon, Attempts:** cabeçalhos partilhados e linhas contínuas, com segunda faixa quando necessário para 7/7/6 campos; level de History Pokémon permanece. Detalhes e Delete não tomam altura em todas as linhas fechadas.
- **Gallery:** Pokémon, timestamp de captura **com segundos**, Quality, IV e duas ações; controles de toque de pelo menos 44px podem ocupar segunda faixa, sem caixas por registro.
- **By Rarity:** sete linhas contíguas com rótulos compartilhados, totais e rate legíveis.

Permitir contraste alternado suave e separador de 1px, mas **proibir borda completa, padding amplo, sombra e cabeçalho de cartão individual**. Nomes longos podem quebrar na própria linha, sem ellipsis/ocultação. Os valores devem manter ordem e precisão nativas; detalhes adicionais de uma captura podem ficar em disclosure opcional por registro sem esconder os campos de tabela.

### Área útil para o print

- A área de dados deve prevalecer sobre filtros e ordenação. Unificar filtros e sort em **um ou dois disclosures compactos**, recolhidos por padrão quando isso aumenta o número de registros visíveis, mantendo estado e indicação clara dos filtros ativos.
- A expansão de filtros/sort é sempre possível por toque/teclado, sem popover cortado; a captura do estado normal não precisa mostrar todos os inputs.
- O mesmo DOM da tabela serve a todos os tamanhos. Não duplicar registros em versão “share” separada; o layout normal já deve ser apropriado para screenshot.

### Medição e meta preliminar

O renderer anterior foi medido em Edge com dados sintéticos. **Antes da correção M1.1**, Captured tinha altura média de **260px por Pokémon em Mobile 390/320**, e **246px em Desktop 415**. Na tela Mobile 390, rolando até o início da seção Captured, cabia somente **1 registro completo de 4**; rolando ao topo direto da tabela, apenas **2 completos de 4**. Em Mobile 320, a seção Captured não apresentava nenhum registro completo. A Gallery custava cerca de 206–220px por registro. Esses números não validam o novo design: constituem baseline da falha de densidade.

Metas a medir **após** o redesign para a fixture Captured de quatro Pokémon:

| Dimensão | Ao colocar início da seção Captured no alto do scroll | Ao colocar início da tabela Captured no alto do scroll |
| --- | --- | --- |
| Mobile **320×568** | ≥3 registros completos | 4 registros completos |
| Mobile **390×844** | 4 registros completos | 4 registros completos |
| Desktop painel **415×700** | 4 registros completos | 4 registros completos |
| Desktop painel **620×700** | 4 registros completos | 4 registros completos |

Valores-alvo indicativos de linha Captured: **~45–70px** por registro dependendo da largura; prioridade para leitura de dados ≥11px, títulos/legendas compartilhados claros e controles interativos 44×44px. Para History Attempts 320×568, um print iniciando na seção deve mostrar pelo menos um registro antes da navegação inferior; ao alinhar o topo da tabela, devem caber os **3 exemplos completos**.

O teste de aceitação deve registrar `fullyVisibleRecords`, altura média/p95 das linhas e screenshots de cada tamanho. **Registros completos** são aqueles cujo retângulo inteiro cabe entre o topo do scroll principal e a navegação inferior; títulos cortados não contam. Uma fixture de só quatro registros verifica esses limites locais; uma fixture longa é necessária na fase M3/M4 para validar scroll/paginação/sort de 201+ linhas.

## Gates que permanecem obrigatórios

O contrato de [tabelas sem scroll horizontal](TABLE_PRESENTATION_CONTRACT.md) segue válido quanto a **todos os campos, ausência de H-scroll, níveis por contexto, precisão, acessibilidade, ordenação, filtros e lote de registros**; qualquer referência anterior a **cartões individuais** está substituída por este documento. Testes automatizados de layout não substituem a inspeção do print real, nem a leitura de tela NVDA/VoiceOver para CSS grid com elementos `<table>`.

**Âmbito atual:** maquete offline M1.1 e evidência visual. Nenhum código operacional do userscript foi modificado por esta iniciativa; a migração real será etapa posterior e depende de aceite da nova composição.
