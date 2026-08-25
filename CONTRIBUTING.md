# Contribuindo

Contribuições são bem-vindas. Antes de alterar o código, leia `docs/ARCHITECTURE.md`, `docs/PROTOCOL_AND_ANALYTICS.md` e `docs/DEVELOPMENT.md`. Para mudanças relacionadas ao HuntSim, leia também `docs/HUNTSIM_PROTOCOL_COMPATIBILITY.md`.

## Ambiente

Requisitos:

- Node.js 24 ou superior;
- npm;
- Tampermonkey para testes no jogo.

Instale exatamente as dependências registradas no `package-lock.json` e valide o projeto:

```bash
npm ci
npm run audit:deps
npm run validate
```

Para validar especificamente o servidor/protocolo DEV:

```bash
npm run build:userscript:dev
```

## Fluxo de trabalho

Crie uma branch a partir de `main`:

```text
feat/nome-da-feature
fix/nome-do-bug
refactor/nome-do-refactor
docs/nome-da-documentacao
dev/nome-da-compatibilidade
```

Mantenha cada mudança focada em um problema. Evite misturar feature, refactor e alteração visual sem necessidade.

## Regras de implementação

- O runtime suportado é Tampermonkey.
- O Analyzer deve permanecer passivo: nunca enviar, repetir ou modificar mensagens do jogo.
- Não persistir tokens, cookies, headers de autenticação, URLs WebSocket autenticadas ou frames brutos.
- Regras de domínio ficam em `domain/`, persistência em `data/` e coordenação em `services/`.
- Reconciliação específica da geração/protocolo fica em `userscript/protocol-adapter.js`; normalização do evento canônico fica em `domain/events.js`.
- Eventos legados canônicos devem continuar passando pelo adapter sem alteração semântica.
- Projeções duplicadas do HuntSim não podem gerar dupla contagem.
- A UI não deve recalcular regras que já existem no domínio.
- `package.json` é a única fonte da versão da aplicação.
- `package-lock.json` deve permanecer versionado e sincronizado com `package.json`.
- O build PROD deve preservar o namespace histórico do userscript; o build DEV usa identidade isolada.
- Não criar arquivos de patch por versão (`*-v123.js`). Evolua os módulos por responsabilidade.
- Não registrar changelog em comentários de código. Histórico de release pertence ao `CHANGELOG.md`.
- Não adicionar dependências ou novos `@grant`/`@connect` sem necessidade concreta e revisão do impacto no runtime.
- Integrações com objetos JS da página, como `WebSocket`, devem usar explicitamente o page window resolvido pelo runtime; não assumir que o `window` do userscript é o `window` da página quando existem grants Tampermonkey.

## Testes

Toda alteração deve manter:

```bash
npm run validate
```

Mudanças de domínio, protocolo ou persistência devem incluir teste automatizado quando houver comportamento novo ou corrigido.

Mudanças de UI/runtime também exigem smoke test manual no PokePixel:

1. jogo conecta normalmente com o userscript habilitado;
2. `window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__ === true`;
3. Current atualiza Seen / XP / Dollar durante a Hunt;
4. New Hunt / Pause / Resume / End Hunt;
5. Captured: dados/filtros/detalhes corretos;
6. Failed: `Pokémon | IV | Pokéball | Fled at` e filtros Rarity/Shiny/IV;
7. HUD minimizado;
8. drag, resize, scroll e alpha;
9. History: Hunts / Pokémon / Attempts, filtros e drill-downs;
10. DELETE: Running/Paused Current bloqueada; Hunt encerrada pode ser apagada e permanece apagada após refresh/F5;
11. Sound Alerts: Sound 1 / Sound 2, exclusividade por slot e persistência;
12. Custom Audio: import / replace / remove / persistência;
13. Catch Gallery: collapse, filtros, ordenação e paginação;
14. Capture Ticket BETA: Generate/preview/download, render pixelado e Copy quando suportado pelo browser;
15. F5 preserva IndexedDB e estado de UI;
16. duas abas: apenas uma ACTIVE e a outra STANDBY.

Em mudança de protocolo, valide também ausência de dupla contagem e correlação correta de `capture.*` + recompensa, incluindo ordering terminal-before-loot quando aplicável.

## Pull Request

O PR deve explicar:

- o problema;
- o que foi alterado;
- como foi validado;
- riscos ou limitações conhecidas;
- novos grants, conexões externas ou migrations, quando existirem;
- deployment gate, quando a mudança depender de rollout do servidor/jogo.

Não inclua `dist/`, exports locais, logs, credenciais ou capturas brutas do navegador.
