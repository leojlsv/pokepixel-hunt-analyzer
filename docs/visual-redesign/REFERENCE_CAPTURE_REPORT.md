# Evidência visual M0 — renderização offline da UI atual

**Data:** 29/09/2026. **Escopo:** UI standalone atual renderizada a partir dos módulos reais em Edge headless com registros sintéticos. Sem acesso ao PokePixel, gameplay, WebSocket ou IndexedDB. A auditoria estática separada está em [BASELINE.md](BASELINE.md).

## Reprodutibilidade

O harness está em [reference/](reference/README.md). Executar da raiz:

```powershell
node docs/visual-redesign/reference/build.mjs
node docs/visual-redesign/reference/capture.mjs
```

O script abre **um** Edge headless com perfil isolado, controla as dimensões de viewport por protocolo local do navegador e navega entre as quatro telas do Analyzer. Usa a montagem verdadeira de `userscript/ui.js`, estilos reais, `current-view.js`, `history-view.js`, Closed HUD, Misc e Catch Gallery. Os dados numéricos e encounters são artificiais. `reference/screenshots/manifest.json` fixa hashes SHA-256 dos módulos usados; `geometry.json` registra medidas efetivas dos elementos.

## Cobertura capturada

| View | Desktop 415 | Desktop 620 | Mobile 320×568 | Mobile 390×844 |
| --- | --- | --- | --- | --- |
| Current | `desktop-415-current.png` | `desktop-620-current.png` | `mobile-320-current.png` | `mobile-390-current.png` |
| History | `desktop-415-history.png` | `desktop-620-history.png` | `mobile-320-history.png` | `mobile-390-history.png` |
| Misc | `desktop-415-misc.png` | `desktop-620-misc.png` | `mobile-320-misc.png` | `mobile-390-misc.png` |
| HUD | `desktop-415-hud.png` | `desktop-620-hud.png` | `mobile-320-hud.png` | `mobile-390-hud.png` |

**Local dos PNGs gerados:** `docs/visual-redesign/reference/screenshots/` (arquivos temporários intencionalmente ignorados pelo Git).

## Observações verificadas na renderização

1. Nos cenários normais medidos, o painel tem exatamente a largura de **415/620 px no Desktop** e **320/390 px no Mobile**; não transborda a largura do viewport. A navegação Mobile mede **54 px de altura**, aparece na parte inferior e dispõe de quatro destinos. `geometry.json` confirma exatamente uma tab selecionada em todos os 16 snapshots.
2. O Desktop **415 px** mantém métricas econômicas/XP e captura em quatro colunas com sublabels pequenos. Ele preserva os dados sintéticos na interface, mas a hierarquia visual de várias linhas e a leitura de fontes diminutas tornam a densidade um ponto do redesign.
3. Mobile **320 px** apresenta KPIs econômicos em **2×2** e quatro indicadores Seen/Captured/Failed/Rate em uma linha; a tela contém uma fração do conteúdo e depende do scroll principal da view, com a navegação inferior presente. **390 px** dá mais espaço para labels, mas conserva a mesma composição.
4. History mantém quatro filtros lado a lado, inclusive no Mobile 320 px; no snapshot seus labels e controles são compactos. A seção Misc apresenta matriz de áudio e Gallery no mesmo fluxo, com mudança de visibilidade ao rolar, e o HUD usa uma coluna de configurações no Mobile.
5. Os valores de referência são sintéticos e a instrumentação não altera cálculos, persistência ou código operacional. O screenshot de Current carrega a tabela Captured com dados representativos, inclusive Shiny, IV e Chance, sem provar todos os estados extremos.

## Ainda não validado

As imagens representam **layout inicial em viewport emulado**. Não são resultados de toque físico, teclado virtual/safe area, zoom 200%, popovers abertos, drag/resize, multi-tab, renderização após centenas de registros nem smoke em PokePixel. A ausência de corte do **painel** medida no script não prova ausência de ellipsis/recorte nas **células**. Os riscos R1–R8 de [BASELINE.md](BASELINE.md) continuam abertos para o gate funcional de implementação.

O comparativo com a maquete M1 deve usar **o mesmo espaço disponível e o mesmo conjunto de campos**, especialmente Desktop 415 e Mobile 320, e registrar qualquer conteúdo que o redesign torne inacessível.
