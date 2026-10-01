# Projeto: paletas de cores do Hunt Analyzer

**Status:** quatro paletas aprovadas pelo PO e integradas ao código do userscript (P3). Obsidiana é o padrão; Ametista Noturna, Cobre Vulcânico e Titânio são alternativas. Original e Verde Profundo foram descartadas como opções. Builds e validação offline não substituem o aceite manual em jogo (P4); nenhuma publicação foi realizada.

## Objetivo e limites

Permitir escolher as cores da interface do Analyzer sem alterar fórmulas, eventos, IndexedDB, capturas ou a API pública consumida pelo Better UI. **Obsidiana é o novo padrão e fallback**. O tema Original e Verde Profundo não integram o catálogo nem o seletor.

**Incluído:** painel Desktop/Mobile, Closed HUD (2 colunas, 1 coluna e PX-only), filtros, History, Catch Gallery, Sound Alerts, menus e scrollbar.
**Excluído da primeira fase:** redesign de layout M1.1 (ainda precisa de aprovação), artes do Capture Ticket, sprites, elementos do próprio jogo e a interface do Better UI.

Uma paleta não deve apagar o significado de raridades, Shiny, sucesso, erro, aviso, ACTIVE/STANDBY, lucro positivo/negativo, foco nem desabilitado.

## Diagnóstico técnico

- `userscript/styles.js` já define tokens `--hunt-surface-*`, `--hunt-border-*`, `--hunt-text-*`, `--hunt-accent-*` no `:host`, além de aliases legados (`--bg`, `--gold`, etc.).
- A auditoria inicial identificou **199 ocorrências** de cores literais hexadecimal/RGB(A) nos arquivos JS do userscript: 68 em `styles.js`, 33 em `history-styles.js`, 22 em `closed-hud.js`, 21 em `mobile-styles.js`.
- Essas ocorrências não correspondem a 199 tokens substituíveis: incluem duplicações, cores semânticas, sombras e arte do Capture Ticket.
- Closed HUD e History repetem cores de raridade; Closed HUD também fixa separadores, superfícies, positivo/negativo e Shiny. Não substituir hexadecimais indiscriminadamente.
- `userscript/ui.js` monta o Analyzer em Shadow DOM: a troca de paletas pode ser escopada no host, sem alterar o jogo.
- `docs/visual-redesign/` é uma linha de redesign de layout independente da seleção de paletas.

## Contrato proposto

1. **Tokens decorativos:** superfícies (canvas, elevada, header, topbar, launcher, controles e selecionados), bordas, textos primário/secundário/muted, acento, foco, scrollbar, sombra e overlay.
2. **Tokens funcionais:** ACTIVE/STANDBY, Start/Pause/End, sucesso/erro/aviso, lucro positivo/negativo. A identidade do estado deve permanecer clara em todos os temas.
3. **Identidade de dados:** sete raridades, Shiny e destaque das métricas não herdam automaticamente a cor decorativa da paleta. Contraste por tema requer revisão isolada.
4. **Compatibilidade:** aliases CSS atuais continuam apontando para tokens semânticos durante a migração; substituição de cores decorativas em etapas pequenas.

**Persistência implementada:** chave versionada `pokepixel_hunt_analyzer_palette_v1` em localStorage, separada das Hunts, do estado do HUD e de `ui_v2`. Ausência, valor desconhecido ou storage indisponível escolhem Obsidiana. Se a gravação falhar, a escolha ainda se aplica à janela atual.

**Aplicação implementada:** atributo `data-pha-palette` no host do Shadow DOM com regras CSS estáticas `:host([data-pha-palette="..."])`, definidas em `userscript/palette-theme.js`. Seletor nativo acessível em `Misc > Interface`, aplicação imediata, sem reload nem chamadas ao jogo. Somente quatro IDs enumerados podem ser persistidos/aplicados; não existe interpolação de CSS não confiável.

**Compatibilidade de instalação:** nenhum novo `@grant`/`@connect`; não alterar nomes do userscript ou assets; nenhuma extensão do contrato público de analytics para comandar apresentação.

## Paletas aprovadas

**Comparativo offline:** [Comparar as alternativas lado a lado com Obsidiana](visual-redesign/palettes/compare.html). O comparador importa o mesmo módulo de cores utilizado pelo produto, renderiza módulos reais com dados sintéticos e oferece visão interativa. Processo de captura e limites: [palettes/README.md](visual-redesign/palettes/README.md).


| Nome | Canvas | Superfície elevada | Texto principal | Acento decorativo | Conceito |
|---|---|---|---|---|---|
| Obsidiana (padrão) | `#171c23` | `#222a33` | `#ebf3fa` | `#8cbcff` | Grafite frio e azul discreto |
| Ametista Noturna | `#1d1a29` | `#2a263a` | `#f1edff` | `#c6a8ff` | Grafite arroxeado e lavanda, com distinção entre navegação e dados |
| Titânio | `#191d23` | `#272d35` | `#eff3f7` | `#c2d6e9` | Grafite metálico e prata fria; menor saturação |
| Cobre Vulcânico | `#211c1b` | `#312924` | `#f5eee8` | `#e9b48d` | Carvão quente e cobre suave; acento acolhedor sem verde |

Os quatro códigos são os pontos de referência de uma tabela CSS completa, incluindo bordas, hover, foco, controles e HUD. As identidades funcionais, raridades e Shiny são independentes das cores decorativas. Arte do Capture Ticket, sprites e cores do jogo permanecem fora do escopo.

## Critérios de qualidade

- Texto normal: contraste WCAG AA de pelo menos **4,5:1**; ícones, bordas funcionais e foco: **3:1**, com revisão específica das fontes pequenas do HUD.
- Não usar só cor para transmitir sucesso/erro, ACTIVE/STANDBY, shiny/raridade ou sinais financeiros. Preservar texto, números e indicadores.
- Obsidiana deve ser aplicada antes da primeira renderização; o seletor deve persistir as escolhas após reload e ignorar temas descartados.
- Revisar Current, History, HUD, Gallery, Misc, menus, filtros, badges, scrollbar, hover, foco e campos desabilitados.
- Verificar Desktop 415/620, Mobile 320/390 e HUD 220×52/145×52/PX-only. Não alterar largura, fontes ou semântica de dados ao alternar paletas.
- Preferir material offline/fixtures determinísticas. Aceite em jogo real cabe ao PO, não à automação local.

## Sequenciamento com gates

| Gate | Produto | Condição de aceite |
|---|---|---|
| P0 — decisão | Quatro temas escuros aprovados | Concluído: Obsidiana padrão, Ametista/Cobre/Titânio alternativos. |
| P1 — tokens | CSS e exceções semânticas isolados no Shadow DOM | Implementado em `userscript/palette-theme.js`. |
| P2 — comparação | Protótipos offline com a mesma fixture | Reproduzível em `visual-redesign/palettes/`. |
| P3 — implementação | Seletor acessível, fallback seguro, persistência, QA | Implementado; validação automatizada em curso/concluída conforme testes registrados. |
| P4 — aceite | Teste manual em jogo e eventual publicação | Pendente de validação manual do PO; não publicada. |

O reparo de tipografia do Closed HUD permanece uma correção independente. A revisão em ambiente real do jogo e a decisão de publicação continuam sob controle do PO.
