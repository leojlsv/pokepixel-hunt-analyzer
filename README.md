# PokePixel Hunt Analyzer

Analytics de Hunt em tempo real para **PokePixel**, direto dentro do jogo.

O PokePixel Hunt Analyzer é um userscript comunitário para **Tampermonkey** que observa passivamente eventos do jogo, organiza Hunts e calcula métricas de eficiência sem automatizar gameplay.

**Versão:** `v1.9.0`  
**Core Analyzer:** estável  
**Capture Ticket:** BETA  
**Dados e analytics:** locais  
**Automação de gameplay:** nenhuma

> Projeto não oficial da comunidade. Não possui vínculo com PokePixel, Nintendo, Game Freak ou The Pokémon Company.

### [⬇️ Baixar a versão mais recente](https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest)

---

## Principais recursos

### Current

Acompanha a Hunt atual em tempo real:

- tempo ativo;
- `XP/h You` e XP total;
- `XP/h Poké` e XP total;
- Dollar total e `$/h`;
- Profit e Expenses;
- Seen, Captured, Failed e Capture Rate;
- distribuição por raridade e Shiny;
- listas de Captured e Failed;
- Captured com filtros por Rarity, Shiny, Quality e IV;
- Failed com filtros por Rarity, Shiny e IV e colunas diretas `Pokémon | IV | Pokéball | Fled at`;
- Captured mostra o breakdown de IVs em `HP · Atk · sAtk · Def · sDef · SpD`;
- detalhes de Captured incluem Capsule, timestamp e Chance quando disponível.

O Current usa cache de snapshots e agregados reutilizáveis para evitar reprocessamento excessivo em Hunts longas.


### Compatibilidade de protocolo

A v1.9 mantém uma fronteira explícita entre o protocolo observado do jogo e o domínio de analytics:

```text
PokePixel WebSocket
        ↓
websocket-observer.js
        ↓
protocol-adapter.js
        ↓ eventos canônicos
eventPipeline.js
        ↓
domain + IndexedDB
```

O adapter aceita tanto o fluxo legado baseado em `combat.started`/`loot.received` quanto o novo HuntSim baseado em `hunt.frame`, `hunt.capture_queue`, `hunt.events` e rewards agregados. Projeções duplicadas do HuntSim são reconciliadas/ignoradas para evitar dupla contagem.

Detalhes: [`docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`](docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md).

### History

Substitui o antigo Compare e organiza o histórico em três visões:

- **Hunts** — sessões recentes com duração, Seen, Captured e capturas notáveis;
- **Pokémon** — agregação por Pokémon + nível;
- **Attempts** — Captured/Fled em ordem cronológica.

Filtros disponíveis incluem período, Pokémon, raridade, resultado, Capsule, Element e Shiny.

Hunts podem ser expandidas para detalhes de XP/h, $/h, Profit, Expenses, Failed e notables.

#### DELETE Hunt

Uma Hunt encerrada pode ser removida pelo botão **DELETE** no detalhe expandido.

- exige confirmação explícita;
- remove a sessão e seus encounters persistidos;
- atualiza History imediatamente;
- remove capturas correspondentes da Catch Gallery;
- a **Current Hunt não pode ser apagada enquanto estiver Running ou Paused** — use **End Hunt** primeiro.

### Misc — Sound Alerts

Alertas configuráveis para:

- Epic;
- Legendary;
- Mythical;
- Shiny;

com eventos independentes para **Captured** e **Fled**.

Cada combinação pode usar:

- Sound 1;
- Sound 2;
- Custom Audio.

Custom Audio:

- MP3 / WAV / OGG / Opus quando o browser consegue decodificar;
- até 2 MB;
- até 10 segundos;
- armazenado localmente em um IndexedDB separado;
- nunca enviado para servidor externo.

### Misc — Catch Gallery / Capture Ticket BETA

Capturas novas elegíveis aparecem na **Catch Gallery**:

- Legendary;
- Mythical;
- Shiny.

A galeria permite:

- filtrar Pokémon e raridade;
- ordenar por Captured, Quality e IV;
- navegar em páginas de até 5 capturas;
- **Generate** — abrir preview/download do Capture Ticket;
- **Copy** — copiar o PNG para o clipboard quando suportado pelo browser.

O Capture Ticket está marcado como **BETA** porque ainda depende de validação comunitária em diferentes navegadores/Tampermonkey.

Para gerar o ticket, o userscript pode carregar:

- sprite público de `img.pokemondb.net`;
- fonte Silkscreen via Google Fonts.

Esses requests são usados apenas para renderização do ticket; os dados de Hunt não são enviados a um backend do Analyzer.

Mais detalhes: [`docs/CAPTURE_TICKETS.md`](docs/CAPTURE_TICKETS.md).

### HUD compacto

Quando minimizado, o Analyzer mantém um resumo rápido da Hunt sem fechar o processamento.

### Interface ajustável

O painel pode ser:

- arrastado;
- redimensionado;
- minimizado;
- parcialmente transparente pelo controle `α`;
- recolhido por seção.

Posição, tamanho, transparência e estado visual são preservados localmente.

---

## Privacidade e segurança

O Analyzer é projetado para permanecer **passivo**.

Ele não:

- envia comandos de gameplay;
- automatiza batalha, movimento ou captura;
- altera mensagens enviadas pelo PokePixel;
- persiste senha, token, cookie ou Authorization header;
- persiste frames WebSocket brutos;
- possui backend próprio para armazenar Hunts.

### Persistência local

Analytics ficam no IndexedDB:

```text
pokepixel_hunt_analyzer
```

O banco armazena sessões, encounters, snapshots de configuração e metadados necessários às métricas.

Custom Audio usa outro banco local:

```text
pokepixel_hunt_analyzer_assets
```

Fechar o navegador ou reiniciar o computador não apaga automaticamente o histórico.

### Permissões do userscript

A v1.9.0 usa permissões Tampermonkey para manter duas necessidades separadas:

- `unsafeWindow` — instalar o observer no `WebSocket` real da página;
- `GM_xmlhttpRequest` + `@connect img.pokemondb.net` — buscar sprites públicos para Capture Ticket sem contaminar o Canvas por CORS.

O namespace histórico do userscript é preservado para manter compatibilidade de atualização.

---

# Instalação

## 1. Instale o Tampermonkey

Use a extensão oficial do Tampermonkey para seu navegador.

O Analyzer é desenvolvido principalmente em **Microsoft Edge / Chromium desktop**.

Chrome/Edge atuais podem exigir **Allow User Scripts / Permitir scripts de usuário** nas configurações da extensão.

## 2. Baixe o userscript

Na release mais recente, baixe:

```text
pokepixel-hunt-analyzer.user.js
```

### [⬇️ Releases](https://github.com/leojlsv/pokepixel-hunt-analyzer/releases/latest)

## 3. Instale no Tampermonkey

1. Abra o Dashboard do Tampermonkey.
2. Crie um novo userscript.
3. Substitua o conteúdo padrão pelo conteúdo completo de `pokepixel-hunt-analyzer.user.js`.
4. Salve.
5. Recarregue `https://pokepixel.nietore.com/`.

O HUD `PX` deve aparecer na interface do jogo.

---

# Uso básico

### Hunt

- **New Hunt** — encerra o contexto atual e inicia uma nova Hunt local;
- **Pause** — pausa manualmente o tempo ativo;
- **Resume** — continua a Hunt pausada;
- **End Hunt** — encerra a Hunt atual.

### Navegação

```text
Current | History | Misc
```

### Múltiplas abas

Somente uma aba processa analytics por vez:

- `ACTIVE` — dona do lease local e responsável pelos eventos;
- `STANDBY` — aguarda a aba ativa liberar/expirar o lease.

Isso evita contagem duplicada.

---

# Compatibilidade

| Ambiente | Status |
|---|---|
| Microsoft Edge desktop | ✅ Validado |
| Google Chrome / Chromium desktop | ✅ Alvo suportado |
| Firefox 128+ | 🟡 Build compatível; requer mais validação comunitária |
| Outros navegadores + Tampermonkey | 🟡 Não testados oficialmente |
| Mobile | ⚪ Fora do escopo atual |

`Copy` do Capture Ticket também depende de suporte a `navigator.clipboard.write()` / `ClipboardItem`.

---

# Atualizando

1. baixe o `.user.js` da nova release;
2. substitua o conteúdo do script no Tampermonkey;
3. salve;
4. recarregue o PokePixel.

Migrations compatíveis preservam os dados existentes no IndexedDB.

---

# Desenvolvimento

## Requisitos

- Git;
- Node.js 24+;
- npm;
- Tampermonkey para smoke test ao vivo.

```bash
git clone https://github.com/leojlsv/pokepixel-hunt-analyzer.git
cd pokepixel-hunt-analyzer
npm ci
npm run validate
```

`npm run validate` executa os testes e gera o build **PROD**:

```text
dist/pokepixel-hunt-analyzer.user.js
```

Para smoke do servidor DEV sem alterar a identidade de release:

```bash
npm run build:userscript:dev
```

O `dist/` não é versionado; o artefato é gerado para teste/release.

## Estrutura principal

```text
userscript/
├── main.js
├── websocket-observer.js
├── protocol-adapter.js
├── tab-leadership.js
├── ui.js
├── ui-markup.js
├── current-view.js
├── history-view.js
├── history-delete.js
├── audio-alerts.js
├── custom-audio-repository.js
├── catch-gallery.js
├── capture-ticket.js
├── remote-image-loader.js
├── png-metadata.js
└── styles.js

domain/
data/
services/
tests/
docs/
scripts/
```

Fluxo simplificado:

```text
PokePixel WebSocket
        ↓
websocket-observer.js
        ↓
protocol-adapter.js
        ↓
main.js
        ↓
eventPipeline.js
        ↓
domain + IndexedDB
        ↓
Current / History / Misc
```

Documentação técnica:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PROTOCOL_AND_ANALYTICS.md`](docs/PROTOCOL_AND_ANALYTICS.md)
- [`docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`](docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md)
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
- [`docs/CAPTURE_TICKETS.md`](docs/CAPTURE_TICKETS.md)
- [`SECURITY.md`](SECURITY.md)
- [`CHANGELOG.md`](CHANGELOG.md)

---

# Problemas comuns

### O Analyzer abre, mas tudo fica zerado

No Console da página, verifique:

```javascript
window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__
```

O esperado é:

```text
true
```

Se estiver `undefined`, informe versão do browser, Tampermonkey e Analyzer ao abrir uma Issue.

### O jogo deixou de carregar após uma atualização

Desabilite temporariamente o userscript e confirme se o jogo volta a funcionar. Se o problema estiver relacionado ao Analyzer, abra uma Issue com:

- versão do Analyzer;
- navegador e versão;
- versão do Tampermonkey;
- erro do Console, se houver.

**Nunca publique cookies, tokens, URLs autenticadas ou dados privados da conta.**

---

# Licença

Distribuído sob a **MIT License**. Consulte [`LICENSE`](LICENSE).

Copyright (c) 2026 Rhyxus.

# Autor

**Rhyxus**  
PokePixel Ref Code: `Q4BSZJD`
