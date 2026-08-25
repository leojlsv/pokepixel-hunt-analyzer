# Contribuindo

Contribuições são bem-vindas. Antes de alterar o código, leia `docs/ARCHITECTURE.md` e `docs/DEVELOPMENT.md`.

## Ambiente

Requisitos:

- Node.js 24 ou superior;
- npm;
- Tampermonkey para testes no jogo.

Instale exatamente as dependências registradas no `package-lock.json` e valide o projeto:

```bash
npm ci
npm run validate
```

## Fluxo de trabalho

Crie uma branch a partir de `main`:

```text
feat/nome-da-feature
fix/nome-do-bug
refactor/nome-do-refactor
docs/nome-da-documentacao
```

Mantenha cada mudança focada em um problema. Evite misturar feature, refactor e alteração visual sem necessidade.

## Regras de implementação

- O runtime suportado é Tampermonkey.
- O Analyzer deve permanecer passivo: nunca enviar, repetir ou modificar mensagens do jogo.
- Não persistir tokens, cookies, headers de autenticação, URLs WebSocket autenticadas ou frames brutos.
- Regras de domínio ficam em `domain/`, persistência em `data/` e coordenação em `services/`.
- A UI não deve recalcular regras que já existem no domínio.
- `package.json` é a única fonte da versão da aplicação.
- `package-lock.json` deve permanecer versionado e sincronizado com `package.json`.
- Não criar arquivos de patch por versão (`*-v123.js`). Evolua os módulos por responsabilidade.
- Não registrar changelog em comentários de código. Histórico de release pertence ao `CHANGELOG.md`.
- Não adicionar dependências ou novos `@grant`/`@connect` sem necessidade concreta e revisão do impacto no runtime.
- Integrações com objetos JS da página, como `WebSocket`, devem usar explicitamente o page window resolvido pelo runtime; não assumir que o `window` do userscript é o `window` da página quando existem grants Tampermonkey.

## Testes

Toda alteração deve manter:

```bash
npm run validate
```

Mudanças de domínio ou persistência devem incluir teste automatizado quando houver comportamento novo ou corrigido.

Mudanças de UI/runtime também exigem smoke test manual no PokePixel:

1. jogo conecta normalmente com o userscript habilitado;
2. `window.__POKEPIXEL_HUNT_ANALYZER_USERSCRIPT_HOOKED__ === true`;
3. Current atualiza Seen / XP / Dollar durante a Hunt;
4. New Hunt / Pause / Resume / End Hunt;
5. Captured / Failed, filtros e detalhes;
6. HUD minimizado;
7. drag, resize, scroll e alpha;
8. History: Hunts / Pokémon / Attempts, filtros e drill-downs;
9. DELETE: Running/Paused Current bloqueada; Hunt encerrada pode ser apagada e permanece apagada após refresh/F5;
10. Sound Alerts: Sound 1 / Sound 2, exclusividade por slot e persistência;
11. Custom Audio: import / replace / remove / persistência;
12. Catch Gallery: collapse, filtros, ordenação e paginação;
13. Capture Ticket BETA: Generate e Copy quando suportado pelo browser;
14. F5 preserva IndexedDB e estado de UI;
15. duas abas: apenas uma ACTIVE e a outra STANDBY.

## Pull Request

O PR deve explicar:

- o problema;
- o que foi alterado;
- como foi validado;
- riscos ou limitações conhecidas;
- novos grants, conexões externas ou migrations, quando existirem.

Não inclua `dist/`, exports locais, logs, credenciais ou capturas brutas do navegador.
