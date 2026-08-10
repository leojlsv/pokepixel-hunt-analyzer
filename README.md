# PokePixel Hunt Counter

Uma extensão para Microsoft Edge / Chrome que acompanha suas Hunts no
**PokePixel** em tempo real, direto num painel lateral do navegador —
sem precisar alt-tab pra planilha nenhuma.

Ela fica ouvindo (só ouvindo) o tráfego do jogo enquanto você joga
normalmente, e calcula tudo sozinha: quantos Pokémon você viu, quantos
capturou, quanto ganhou de EXP e dinheiro por hora, e guarda o
histórico de cada Hunt pra você comparar depois.

**Status atual**: `v1.0.0` ✅

---

## 🧭 O que ela faz

### Current — sua Hunt, ao vivo
Abra o painel e veja, atualizando sozinho a cada segundo:
- tempo ativo da Hunt (pausa automaticamente se você parar de caçar);
- EXP/h (seu e do Pokémon), Dólar/h e Lucro Total (ganho − gasto com
  Pokébolas e Potions);
- quantos Pokémon você **viu**, **capturou** e **deixou escapar**, e a
  taxa de captura;
- uma tabela por raridade (Weak → Mythical), com contagem de shinies
  destacada;
- a lista de tudo que você já capturou nessa Hunt, com Natureza,
  Qualidade e os IVs de cada um — filtrável por raridade, qualidade
  mínima e total de IV.

### History — suas Hunts passadas
Todo Hunt que você fez fica salvo. Filtre por data, entre em qualquer
sessão antiga pra ver o detalhe completo (espécie, nível, elementos,
gênero, IV, se era shiny, se capturou ou não), ou apague uma sessão se
quiser.

### Compare — qual Pokémon/config vale mais a pena
Agrupa tudo que você já capturou por **espécie + nível + configuração**
("By Cycle") ou por **raridade** ("By Rarity"), com filtros por
Pokémon, Pokébola usada e Elemento. Útil pra descobrir onde seu tempo
de Hunt está rendendo mais.

### Export — leve seus dados pra onde quiser
Um clique baixa um backup completo em JSON (sessões, configs,
encontros) — sem token, sem cookie, sem nada que possa comprometer sua
conta.

Tudo fica salvo **localmente no seu navegador** (IndexedDB) — sobrevive
a fechar o Edge/Chrome e reiniciar o computador. Nada é enviado pra
lugar nenhum.

---

## 🌐 Compatibilidade de navegadores

| Navegador | Funciona? |
|---|---|
| **Microsoft Edge** (versão 114+) | ✅ Sim — navegador alvo do projeto |
| **Google Chrome** (versão 114+) | ✅ Sim — mesma tecnologia de base |
| Opera / Vivaldi (recentes) | ⚠️ Provavelmente, mas não testado oficialmente |
| Brave | ❌ Não, hoje — o `chrome.sidePanel` tem bugs abertos e não resolvidos no Brave (o painel some sozinho depois de ~1s, e a sidebar deles ainda não tem UI própria pra ativar extensões de side panel; [issues](https://github.com/brave/brave-browser/issues/32132) [reportadas](https://github.com/brave/brave-browser/issues/31334), baixa prioridade no roadmap deles) |
| Firefox | ❌ Não — o navegador não tem a API de painel lateral que a extensão usa |
| Zen Browser | ❌ Não — é baseado no motor do Firefox (Gecko), não no Chromium; mesma incompatibilidade do Firefox |
| Safari | ❌ Não — modelo de extensões incompatível |

Em resumo: **Edge e Chrome são os garantidos.** Chromium sozinho não é
garantia de funcionar (o caso do Brave mostra isso) — qualquer outro
navegador, mesmo que baseado em Chromium, vale a pena testar antes de
confiar.

---

## 🔒 Privacidade e segurança

A extensão é estritamente **passiva** — ela só observa, nunca age:

- nunca envia, repete, modifica ou automatiza mensagens do jogo (não é
  um bot, não interfere na jogatina);
- nunca guarda tokens, cookies, senha, ou qualquer coisa que dê acesso
  à sua conta;
- pede o mínimo de permissão possível ao navegador, e só tem acesso ao
  domínio do próprio jogo;
- toda comunicação interna da extensão valida de onde a mensagem veio
  antes de fazer qualquer coisa.

Detalhes técnicos completos em `docs/ARCHITECTURE.md §1` e
`docs/DEVELOPMENT.md §1`.

---

## 📦 Instalação

1. Abra `edge://extensions` (ou `chrome://extensions` no Chrome).
2. Ative o **Modo do desenvolvedor** (canto da tela).
3. Clique **Carregar sem compactação** e selecione a pasta deste
   projeto.
4. Abra o PokePixel e recarregue a aba (F5) pra extensão começar a
   observar.
5. Abra o painel: atalho `Ctrl+Shift+7` ou clicando no ícone da
   extensão na barra de ferramentas.

---

## 🛠️ Desenvolvimento

Domínio e persistência (`domain/`, `data/`, `services/`) têm testes
automatizados; a interface (`sidepanel/`) é verificada manualmente e
via preview:

```powershell
npm test
```

### Preview visual (sem precisar instalar a extensão)

`sidepanel/preview.html`/`preview.js` são um clone autocontido do
painel real, com dados fictícios — sem depender do navegador ter a
extensão instalada. Sirva a pasta com qualquer servidor HTTP estático
(ex.: `python -m http.server`, ou rode `start-preview.ps1`) e abra
`sidepanel/preview.html`.

---

## 📚 Documentação

- `docs/ARCHITECTURE.md` — schema do banco local, identidade de
  encontro/sessão, fluxo de dados, decisões de layout da UI.
- `docs/PROTOCOL_AND_ANALYTICS.md` — quais campos do protocolo são
  extraídos e as fórmulas exatas de cada métrica.
- `docs/DEVELOPMENT.md` — fases de implementação, critérios de aceite
  do `v1.0.0`, convenções de git.
- `CHANGELOG.md` — histórico de mudanças.
- `CLAUDE.md` — convenções do projeto para desenvolvimento assistido
  por IA.
