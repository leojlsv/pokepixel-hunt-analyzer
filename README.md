# PokePixel Hunt Counter

Extensão standalone Manifest V3 para Microsoft Edge / Chromium:
observa passivamente o WebSocket do PokePixel e mantém analytics
locais e persistentes de Hunt num painel lateral (Side Panel).

**Status**: em desenvolvimento — Fase 5 (Hardening + Release) da v1,
ainda não `v1.0.0` (ver `docs/DEVELOPMENT.md §6/§8`). Baseline atual:
`v0.3.0` (manifest).

## O que faz

- **Current**: status da Hunt ao vivo (tempo ativo, EXP/h, Dólar/h,
  Lucro Total, Seen/Captured/Failed e taxas, By Rarity com contagem de
  shiny, lista de capturados com Nature/Quality/IVs).
- **History**: histórico paginado de Hunts anteriores, filtro por
  data, detalhe por sessão, exclusão.
- **Compare**: agregação por espécie+nível+config ("By Cycle") ou por
  raridade ("By Rarity"), com filtros por Pokémon/Pokébola/Elemento.
- **Export**: backup JSON completo (sessões, configs, encontros) — sem
  tokens, cookies ou frames WebSocket brutos.

Tudo persistido localmente em IndexedDB (`pokepixel_hunt_analyzer`) —
sobrevive a fechar o Edge e a reiniciar o navegador
(`docs/ARCHITECTURE.md §7`).

## Privacidade / segurança

A extensão é estritamente passiva:

- nunca envia, repete, modifica ou automatiza mensagens WebSocket do
  jogo;
- nunca persiste tokens, cookies, cabeçalhos de autenticação, URLs de
  WebSocket autenticadas ou frames brutos;
- permissões mínimas (`storage`, `sidePanel`, host permission só pro
  domínio do jogo).

Ver `docs/ARCHITECTURE.md §1` (escopo) e `docs/DEVELOPMENT.md §1`
(segurança) para os detalhes completos.

## Instalação (modo desenvolvedor)

1. Abra `edge://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique **Carregar sem compactação** e selecione a pasta deste
   projeto (ou recarregue a extensão existente se já estiver instalada
   nesta pasta).
4. Abra o PokePixel e recarregue a aba (F5).
5. Abra o painel lateral: atalho `Ctrl+Shift+7` ou o ícone da extensão
   na barra de ferramentas.

## Desenvolvimento

Domínio e persistência (`domain/`, `data/`, `services/`) têm testes
automatizados; UI (`sidepanel/`) é verificada manualmente/via preview:

```powershell
npm test
```

### Preview visual (sem instalar a extensão)

`sidepanel/preview.html`/`preview.js` são um clone autocontido do Side
Panel real, com dados fictícios determinísticos — sem `chrome.*`, sem
IndexedDB real. Sirva a pasta com qualquer servidor HTTP estático
(ex.: `python -m http.server`, ou `start-preview.ps1`) e abra
`sidepanel/preview.html`.

## Documentação

- `docs/ARCHITECTURE.md` — schema IndexedDB, identidade de
  encontro/sessão, fluxo de dados, decisões de layout da UI.
- `docs/PROTOCOL_AND_ANALYTICS.md` — quais campos do protocolo são
  extraídos e as fórmulas exatas de cada métrica.
- `docs/DEVELOPMENT.md` — fases de implementação, critérios de aceite
  do `v1.0.0`, convenções de git.
- `CHANGELOG.md` — histórico de mudanças.
- `CLAUDE.md` — convenções do projeto para desenvolvimento assistido
  por IA.
