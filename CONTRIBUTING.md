# Contribuindo

Contribuições são bem-vindas. Antes de alterar o código, leia `docs/ARCHITECTURE.md` e `docs/DEVELOPMENT.md`.

## Ambiente

Requisitos:

- Node.js 24 ou superior;
- npm;
- Tampermonkey para testes no jogo.

Instale as dependências e valide o projeto:

```bash
npm install
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
- Não criar arquivos de patch por versão (`*-v123.js`). Evolua os módulos por responsabilidade.
- Não registrar changelog em comentários de código. Histórico de release pertence ao `CHANGELOG.md`.
- Não adicionar dependências sem uma necessidade concreta.

## Testes

Toda alteração deve manter:

```bash
npm run validate
```

Mudanças de domínio ou persistência devem incluir teste automatizado quando houver comportamento novo ou corrigido.

Mudanças de UI/runtime também exigem smoke test manual no PokePixel:

1. conexão do jogo;
2. Current e métricas;
3. New Hunt / Pause / Resume / End Hunt;
4. Captured / Failed e filtros;
5. HUD minimizado;
6. drag, resize, scroll e alpha;
7. Compare e ordenação;
8. reload e persistência;
9. duas abas com ACTIVE / STANDBY.

## Pull Request

O PR deve explicar:

- o problema;
- o que foi alterado;
- como foi validado;
- riscos ou limitações conhecidas.

Não inclua `dist/`, exports locais, logs, credenciais ou capturas brutas do navegador.
