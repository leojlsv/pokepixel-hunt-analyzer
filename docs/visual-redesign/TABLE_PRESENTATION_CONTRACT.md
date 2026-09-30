# Contrato de apresentação de dados — sem rolagem horizontal

**Decisão do PO — 29/09/2026:** identidade `Dark Tactical Analytics` aceita como direção, com correções vinculantes:

**Correção posterior sobre densidade visual (prevalece):** os cartões individuais de cada Pokémon foram rejeitados por dificultarem screenshots de comparação no Discord. Aplicar [SCREENSHOT_SHARING_CONTRACT.md](SCREENSHOT_SHARING_CONTRACT.md): linhas de tabela contínuas, faixas compactas e cabeçalhos compartilhados. Mantêm-se todos os demais critérios deste documento.

1. A UI **Captured** e **Failed** não exibirá `Level`/`Lv.` junto ao Pokémon. Dados armazenados permanecem inalterados; não modificar History Pokémon (cujo nível é chave legítima da agregação) nem modelos de domínio.
2. **Nenhuma tabela poderá exigir rolagem horizontal interna em nenhuma largura suportada**, quer seja Mobile ou Desktop. O usuário percorre os registros e seus atributos por leitura vertical. Não vale resolver escondendo conteúdo, reduzindo a fonte até ficar ilegível, alterando precisão ou expondo dados só por `title`/hover.
3. Manter a comparação tabular por colunas. Quando **não houver** largura, cada registro vira uma **linha contínua de duas faixas alinhadas** com cabeçalhos/legendas compartilhadas, dentro do mesmo fluxo de scroll principal — **não um cartão alto por registro**. Não implantar duas fontes de dados ou duas listas independentes.

## Formatos-alvo e conteúdo obrigatório

| Superfície | Informação sempre acessível | Adaptação sugerida |
| --- | --- | --- |
| Current **By Rarity** | 7 raridades, Seen, Captured, Failed, Capture Rate e indicadores Shiny. | Tabela tabular se couber; em largura mínima permitir quebrar campos em grid dentro de cada registro, sem perder associação com a raridade. |
| Current **Captured** | Pokémon e destaque Shiny/raridade, Gender, Nature, Quality, total e seis IVs quando observados, além dos detalhes já existentes de captura. **Não mostrar Level.** | Linha única de registro em duas faixas (metadados e seis IVs), com cabeçalho partilhado; permitir quebra só em nomes/conteúdo extremos. Manter filtros e ordenação existentes. |
| Current **Failed** | Pokémon e destaque Shiny/raridade, IV quando disponível, Pokéball, Chance com três decimais, Fled at. **Não mostrar Level.** | Header do registro + grid rotulado IV/Ball/Chance/Time sem scroll interno. Dados ausentes continuam `—`. |
| History **Hunts** | Date, Duration, Seen, Captured, Shiny, Legendary e Mythical, métricas expandidas, notables, Load More e DELETE protegido. | Card responsivo com data identificadora, métricas em células rotuladas; estados de expansão e ações preservados. |
| History **Pokémon** | Pokémon, **Level** (mantido aqui), Seen, Captured, Rate, XP/Cycle, Dollar/Cycle e drill-down. | Card responsivo; indicadores compactos agrupados, level explícito. |
| History **Attempts** | At, Pokémon, Result, Ball, Chance e IV, seleção/detalhes quando presentes. | Card responsivo com resultado semântico e Chance com precisão original. |
| Misc **Catch Gallery** | Pokémon, Captured at, Quality, IV e Generate/Copy, filtros e paginação. | Card compacto com ações no rodapé alcançáveis por toque. |

**Escopo global:** também impedir overflow horizontal de subtabelas, itens expandidos e longos Pokémon, valores extremos ou localizados. No Desktop, o critério vale para painel mínimo **415px** e para **620px**; no Mobile, **320px** e **390px**. Desktop forçado numa viewport inferior ao mínimo do painel continua um caso de recuperação geométrica a tratar separadamente, sem abrir exceção para tabelas.

## Semântica e interações que não podem ser perdidas

- No protótipo é válido manter `<table>/<tr>/<th>/<td>` e mudar apresentação por CSS/grid; na implementação real, preservar os elementos interativos originais, `data-*`, links de sort e event delegation. Não reconstruir linhas de maneira que percam eventos, foco ou estado de expansão.
- Se `thead` deixar de aparecer em um layout, **cada campo tem rótulo visual e nome acessível equivalente**. Ordenação por cabeçalho não pode desaparecer junto com o `thead`: oferecer mecanismo de sort acessível por teclado com `aria-sort` ou seletor equivalente.
- **Ordenação Current:** cabeçalhos hoje dependem de click e setas textuais (`ui-markup.js:57-59,76-79`, `current-view.js:188-199`). No runtime, manter as mesmas regras `encounter-list-model.js` por meio de botões alcançáveis por Enter/Space e estado de ordenação anunciado. Gallery já possui controles de sort que devem continuar alcançáveis após o reflow.
- Destaques `Shiny`, raridade, `Captured/Failed`, hover/focus/selected e resultados numéricos não podem depender só de cor; conservar sinais textuais.
- **Nenhum overflow mascarado:** `overflow-x:hidden` sozinho, `white-space:nowrap` combinado com corte, `text-overflow:ellipsis` sem caminho de acesso ao valor completo e mini fontes para caber são reprovações.
- Leitura por teclado e leitores de tela precisa seguir ordem lógica, primeiro identificação do registro, depois atributos, depois ações; não quebrar `aria-expanded`, pagination ou filtro.
- Navegação principal Mobile, HUD 2/1/PX Only, persistência e fórmulas de analytics são intocados pela mudança de apresentação tabular.
- **Lotes/paginação:** o Current renderiza em lotes de 100 ligados ao scroll de `.table-wrap` (`current-view.js:21-24,201-206,382-458`); Attempts também usa 100 e seu wrapper (`history-view.js:18-20,256-265,736-795`); History sessions paginam 20 e Gallery 5. Ao consolidar o scroll vertical, mudar também os sentinelas/callbacks para o novo scroll owner, de modo a mostrar registros 101+, 201+ com filtro/sort e não renderizar quantidades ilimitadas.

## Evidências necessárias antes de integrar

1. Em **todos os 4 tamanhos**, validar visualmente Current com By Rarity/Captured/Failed abertos e pelo menos um registro com todos os campos, History com as três subtabs, Gallery e estados expandidos.
2. Instrumentar Edge headless: em cada wrapper visível, `scrollWidth <= clientWidth + 2`; computed `overflow-x` não é `auto`/`scroll`; nenhum `td/th` visível transborda o wrapper. Aplicar o teste também ao scroller principal para detectar overflow acidental horizontal.
3. Testar filtros de Captured/Failed, histórico/galeria, ordenação, teclado, badges Shiny, número longo, IV ausente, chance pequena (`<0.001%`) e chance alta (`100.000%`), nomes compridos **inclusive sem espaços**, e valores presentes em cada registro. Os rótulos de dados devem continuar visíveis com `thead` oculto; data/hora completa não pode depender apenas de tooltip (especialmente no toque).
4. Fotos e resultados devem ser comparados no [reviewer M0×M1](review/compare.html), com indicação explícita de que **M0 é histórico e pode ter rolagem**. A obrigação de zero scroll é da **proposta M1 e do runtime futuro**, não do baseline.
5. Para o runtime real, testar **201+ Captured, 201+ Failed e 201+ Attempts**, últimos registros alcançáveis após filtros, sort, alternância de view, expansão e resize, sem perder foco ou duplicar listeners; Gallery segue 5/page e History sessions 20/page. Validar 200% de zoom e leitura por leitor de tela quando a apresentação deixar de ser tabular.

**Gate:** validar primeiro a composição M1 sem scroll e então portar para `userscript/` em M3/M4 após congelamento do snapshot do WIP. A implementação real deve manter os contratos nativos de sorting/ARIA e todos os registros sem duplicar fluxo de dados.
