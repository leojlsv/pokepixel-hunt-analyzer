# Paletas de cores — comparação offline da versão aprovada

**Estado:** as quatro paletas estão integradas no código do Analyzer e o comparador offline usa os mesmos tokens/CSS. Obsidiana é o padrão; Ametista Noturna, Cobre Vulcânico e Titânio são alternativas. A publicação e o aceite manual em jogo continuam pendentes.

A prévia usa os módulos reais do Hunt Analyzer com uma fixture sintética determinística. Não abre PokePixel, não coleta dados do jogo, não observa WebSocket nem executa userscript/main.js.

## Como abrir

No Windows, abra este arquivo no Edge, Chrome ou Firefox:

`G:\pokepixel-hunt-analyzer\docs\visual-redesign\palettes\compare.html`

Alternativamente: `file:///G:/pokepixel-hunt-analyzer/docs/visual-redesign/palettes/compare.html`

Compare **Obsidiana** (referência fixa e padrão do produto) com Ametista Noturna, Titânio e Cobre Vulcânico. Alterne entre Current, History, Misc, HUD e os três formatos de HUD minimizado; veja Desktop 415/620 e Mobile 320/390. Há links para abrir uma prévia interativa dos componentes reais, sem conexão com o jogo. Original e Verde Profundo não integram o catálogo aprovado.

## Reproduzir screenshots

```powershell
cd G:\pokepixel-hunt-analyzer
node docs/visual-redesign/reference/build.mjs
node docs/visual-redesign/palettes/capture.mjs
node --test tests/unit/palettePreview.test.js tests/unit/closedHudTypography.test.js
```

O script roda um Edge headless isolado, reutilizado em todos os casos. Gera 112 imagens PNG (4 paletas × 4 dimensões × 7 estados) em `palettes/screenshots/`, ignoradas pelo Git. Cada quadro mantém dados e relógio sintéticos idênticos. O script compara assinaturas de conteúdo, cores de raridade e estados, geometria e visibilidade do HUD com a Obsidiana e interrompe caso encontre diferenças.

Para gerar apenas uma condição, defina `PALETTE_CAPTURE_FILTER` (por exemplo `desktop-415-current`) antes do comando. Rodadas filtradas sobrescrevem o manifesto da execução completa; execute sem filtro antes de uma revisão final.

O seletor fica em `Misc > Interface > Paleta` no Analyzer e persiste no localStorage sob `pokepixel_hunt_analyzer_palette_v1`, com fallback para Obsidiana. O layout M1.1 permanece um projeto separado.
