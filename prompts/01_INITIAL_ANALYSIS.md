# Initial Claude Code task

Start Claude Code from the repository root in Plan Mode:

```powershell
claude --permission-mode plan
```

Then paste the prompt below.

---

Estamos iniciando a evolução da extensão PokePixel Hunt Counter v0.3.0 para o PokePixel Hunt Analyzer v1.

Leia o `CLAUDE.md` e depois leia integralmente:

- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL_AND_ANALYTICS.md`
- `docs/DEVELOPMENT.md`

Em seguida, inspecione todo o código atual do repositório.

Não altere nenhum arquivo nesta etapa.

Quero uma análise focada apenas na Fase 1.

Entregue:

1. **Current State** — estrutura real, responsabilidade dos arquivos e fluxo MAIN → ISOLATED → background → Side Panel.
2. **Spec Conflicts / Unknowns** — divergências, premissas de protocolo ainda não comprovadas e ajustes necessários antes de implementar.
3. **Phase 1 Design** — menor arquitetura necessária para canonical config, config hash, group key, IndexedDB, migrations, repositories e testes.
4. **Files** — arquivos novos, existentes que precisariam mudar, arquivos que devem ficar intocados e justificativa.
5. **Tests** — testes exatos e tooling baseado no que já existe no repo; não introduza framework/dependência sem justificar.
6. **Risks** — regressão, IndexedDB/service worker e migração da v0.3.0.
7. **Implementation Sequence** — ordem mínima e checkpoints de teste.

Restrições:

- não reescreva a extensão;
- não altere UI nesta fase;
- não altere `hook.js` ou comportamento WebSocket nesta fase;
- não introduza Native Messaging, SQLite, `%LOCALAPPDATA%`, backend ou cloud;
- preserve a v0.3.0 funcional;
- não assuma campos de protocolo não comprovados;
- não faça refactor não relacionado.

Ao final, apresente o plano e aguarde minha aprovação. Não implemente.
