# PokePixel Hunt Analyzer

Analytics de Hunt em tempo real para **PokePixel**, direto dentro do jogo.

O PokePixel Hunt Analyzer é um userscript comunitário para **Tampermonkey** que acompanha suas Hunts, calcula métricas de eficiência e mantém os dados localmente no navegador.

**Versão atual:** `v1.6.1`  
**Status:** estável  
**Execução:** 100% local  
**Automação de gameplay:** nenhuma

> Projeto não oficial da comunidade. Não possui vínculo com PokePixel, Nintendo, Game Freak ou The Pokémon Company.

<img width="417" height="867" alt="Captura de tela 2026-08-19 154031" src="https://github.com/user-attachments/assets/3fa35245-616b-49ac-97e4-b14b68ba25ad" />

---

## O que ele faz

Enquanto você joga normalmente, o Analyzer observa passivamente os eventos necessários do PokePixel e transforma a Hunt em métricas úteis.

### HUD compacto

Quando minimizado, o Analyzer continua mostrando rapidamente:

- total de Pokémon vistos e `Seen/h`;
- capturas por raridade;
- cores correspondentes às raridades do Analyzer.

<img width="155" height="47" alt="Captura de tela 2026-08-19 154111" src="https://github.com/user-attachments/assets/ec47b02b-1099-4ce0-b884-877cd84d5c35" />

### Current

A tela principal acompanha a Hunt atual em tempo real:

- tempo ativo da Hunt;
- `XP/h You` e XP total;
- `XP/h Poké` e XP total;
- Dollar total e `$/h`;
- Profit e Expenses;
- Seen, Captured, Failed e Capture Rate;
- distribuição completa por raridade;
- Pokémon capturados;
- tentativas de captura que falharam;
- filtros por Rarity, Quality e IV.

As listas de Captured e Failed exibem Pokémon, gênero, Nature, Quality e IVs disponíveis no evento observado.

<img width="411" height="869" alt="Captura de tela 2026-08-19 154225" src="https://github.com/user-attachments/assets/36295356-d8fa-464e-884a-22e0aed6b6de" />

### Compare

Use os dados acumulados para comparar Hunts e encontrar cenários mais eficientes.

O Compare possui:

- `By Cycle` — comparação por Pokémon, nível e configuração de captura;
- `By Rarity` — comparação consolidada por raridade;
- filtros por Pokémon;
- filtro por Capsule;
- filtro por Element;
- ordenação pelas métricas da tabela.

<img width="413" height="248" alt="Captura de tela 2026-08-19 154244" src="https://github.com/user-attachments/assets/4762accf-c306-4740-81a8-451087872afa" />


<img width="417" height="315" alt="image" src="https://github.com/user-attachments/assets/1bf82dfd-11d7-4d2c-be37-d526d2aba7c7" />


### Interface ajustável

O painel pode ser:

- arrastado pela tela;
- redimensionado;
- minimizado para HUD;
- parcialmente transparente pelo controle `α`;
- recolhido por seção.

Posição, tamanho, transparência e estado da interface são preservados localmente.

---

## Privacidade e segurança

O Analyzer foi projetado para ser **passivo**.

Ele não:

- envia comandos para o jogo;
- automatiza batalha, movimento ou captura;
- altera mensagens enviadas pelo PokePixel;
- armazena senha, token, cookie ou Authorization header;
- persiste frames WebSocket brutos;
- envia seus dados para servidor externo.

Os dados de Hunt são armazenados no **IndexedDB do próprio navegador**.

O userscript intercepta apenas o necessário para produzir as métricas e deixa o gameplay sob controle do jogador.

> Mesmo sendo uma ferramenta passiva, este é um projeto comunitário não oficial. O jogador continua responsável por seguir as regras do PokePixel.

---

# Instalação

## 1. Instale o Tampermonkey

Acesse o site oficial do Tampermonkey e instale a extensão correspondente ao seu navegador:

**https://www.tampermonkey.net/**

O Analyzer é desenvolvido principalmente em **Microsoft Edge / Chromium desktop**.

### Chrome / Edge: permitir userscripts

Versões atuais de navegadores baseados em Chromium podem exigir uma permissão adicional para executar userscripts.

Se o script estiver instalado mas não executar:

1. abra `edge://extensions` ou `chrome://extensions`;
2. abra os detalhes do Tampermonkey;
3. habilite **Allow User Scripts / Permitir scripts de usuário**, quando disponível;
4. se essa opção não aparecer, habilite o **Developer Mode / Modo do desenvolvedor** na página de extensões.

Referência oficial: [Tampermonkey — Permission to execute userscripts](https://www.tampermonkey.net/faq.php?q=Q209)

---

## 2. Baixe o userscript

Baixe o arquivo:

```text
pokepixel-hunt-analyzer.user.js
```

na versão mais recente do projeto.

**[LINK PARA DOWNLOAD / GITHUB RELEASES]**

> Para distribuição pública, o arquivo acima deve ser disponibilizado nas Releases do GitHub. Desenvolvedores também podem gerar esse arquivo localmente seguindo a seção de desenvolvimento deste README.

---

## 3. Adicione o JavaScript ao Tampermonkey

1. Clique no ícone do **Tampermonkey** no navegador.
2. Abra o **Dashboard**.
3. Clique em **Add a new script / Create a new script** (`+`).
4. Apague o conteúdo padrão do editor.
5. Abra `pokepixel-hunt-analyzer.user.js` em um editor de texto.
6. Copie **todo** o conteúdo do arquivo.
7. Cole no editor do Tampermonkey.
8. Salve com `Ctrl + S`.

O script deverá aparecer na lista de Installed Userscripts como:

```text
PokePixel Hunt Analyzer
```

<img width="371" height="45" alt="image" src="https://github.com/user-attachments/assets/b0174b9a-d601-4e49-b9b5-b8c0a2935e2b" />

---

## 4. Ative o userscript

No Dashboard do Tampermonkey, confirme que o botão ao lado de **PokePixel Hunt Analyzer** está habilitado.

O userscript é configurado para executar em:

```text
https://pokepixel.nietore.com/*
```

Abra ou recarregue o PokePixel com `F5`.

Se tudo estiver correto, o HUD `PX` aparecerá sobre a interface do jogo.

![Uploading Captura de tela 2026-08-19 154545.png…]()

---

# Como usar

## Iniciando uma Hunt

Abra o Analyzer clicando no HUD `PX`.

O painel possui as ações:

- **New Hunt** — encerra o contexto atual e inicia uma nova Hunt local;
- **Pause** — pausa manualmente o tempo ativo;
- **Resume** — continua a Hunt pausada;
- **End Hunt** — encerra a Hunt atual.

O Analyzer também acompanha o contexto do jogo para manter as sessões organizadas.

## Minimizando

Clique em `−` no canto superior do painel.

O Analyzer vira um HUD compacto contendo:

```text
TOTAL SEEN (SEEN/H)
CAPTURAS POR RARIDADE
```

Clique novamente no HUD para abrir o painel completo.

## Comparando resultados

Abra a aba **Compare** e escolha:

- `By Cycle`, para analisar Pokémon/configurações específicas;
- `By Rarity`, para comparar o desempenho agregado das raridades.

Use os filtros para reduzir o conjunto analisado.

---

# Raridades

O Analyzer utiliza as seguintes categorias:

| Rarity | Uso |
|---|---|
| Weak | encontros Weak |
| Common | encontros Common |
| Uncommon | encontros Uncommon |
| Rare | encontros Rare |
| Epic | encontros Epic |
| Legendary | encontros Legendary |
| Mythical | encontros Mythical |

Shinies continuam incluídos na contagem normal da raridade e recebem indicação adicional quando aplicável.

---

# Onde os dados ficam?

Tudo é armazenado localmente usando **IndexedDB**.

O banco mantém informações normalizadas de:

- Hunts/sessions;
- encounters;
- configurações de captura necessárias para comparação;
- métricas derivadas do uso local.

Fechar o navegador ou reiniciar o computador não apaga automaticamente o histórico.

Nenhum backend, login extra ou conta externa é necessário.

---

# Múltiplas abas

Para evitar duplicar eventos quando o PokePixel está aberto em mais de uma aba, o Analyzer possui liderança local entre abas.

Na interface você verá:

- `ACTIVE` — esta aba processa os eventos;
- `STANDBY` — outra aba é a responsável naquele momento.

Isso evita contar a mesma Hunt duas vezes.

---

# Compatibilidade

| Ambiente | Status |
|---|---|
| Microsoft Edge desktop | ✅ Validado |
| Google Chrome / Chromium desktop | ✅ Alvo suportado |
| Firefox 128+ | 🟡 Build compatível, ainda requer validação comunitária |
| Outros navegadores com Tampermonkey | 🟡 Não testados oficialmente |
| Mobile | ⚪ Fora do escopo atual |

Se encontrar um problema específico de navegador, abra uma Issue informando navegador, versão do navegador, versão do Tampermonkey e versão do Analyzer.

---

# Atualizando o Analyzer

Quando uma nova versão for publicada:

1. baixe o novo `pokepixel-hunt-analyzer.user.js`;
2. abra o script no Dashboard do Tampermonkey;
3. substitua o conteúdo pelo arquivo novo;
4. salve;
5. recarregue o PokePixel.

Os dados persistidos em IndexedDB são mantidos entre atualizações compatíveis.

Consulte o [CHANGELOG.md](CHANGELOG.md) para acompanhar as mudanças.

---

# Desenvolvimento

## Requisitos

- Git;
- Node.js;
- npm;
- navegador com Tampermonkey para o smoke test final.

## Clonar

```bash
git clone https://github.com/leojlsv/pokepixel-analyzer-sidepanel.git
cd pokepixel-analyzer-sidepanel
npm install
```

## Testar e gerar o userscript

```bash
npm run validate
```

Esse comando executa os testes automatizados e depois gera:

```text
dist/pokepixel-hunt-analyzer.user.js
```

Para executar separadamente:

```bash
npm test
npm run build:userscript
```

O arquivo em `dist/` é o artefato que deve ser instalado no Tampermonkey.

---

# Estrutura do projeto

```text
userscript/
├── main.js          # runtime, WebSocket, pipeline e lifecycle
├── ui.js            # shell e interação do painel
├── current-view.js  # Current, Captured, Failed e HUD
├── compare-view.js  # Compare, filtros e ordenação
├── ui-utils.js      # formatadores e helpers
└── styles.js        # interface visual

domain/              # regras e métricas puras
data/                # IndexedDB e repositories
services/            # pipeline de eventos
scripts/             # build do userscript
tests/               # testes automatizados
docs/                # documentação técnica
```

Fluxo simplificado:

```text
PokePixel WebSocket
        ↓
userscript/main.js
        ↓
services/eventPipeline
        ↓
domain + IndexedDB
        ↓
Current / HUD / Compare
```

---

# Contribuindo

Contribuições são bem-vindas.

Antes de abrir um Pull Request:

1. crie uma branch para a alteração;
2. mantenha mudanças pequenas e focadas;
3. não introduza automação de gameplay;
4. não persista dados sensíveis ou frames brutos;
5. adicione/atualize testes quando necessário;
6. execute:

```bash
npm run validate
```

7. registre mudanças relevantes no `CHANGELOG.md` — não dentro do código-fonte.

Para decisões internas e regras técnicas, consulte:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [PROTOCOL_AND_ANALYTICS.md](docs/PROTOCOL_AND_ANALYTICS.md)
- [DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [CHANGELOG.md](CHANGELOG.md)

---

# Problemas comuns

### O HUD não apareceu

Verifique:

- Tampermonkey instalado e habilitado;
- PokePixel Hunt Analyzer habilitado no Dashboard;
- permissão para executar userscripts no navegador;
- página aberta em `pokepixel.nietore.com`;
- página recarregada após instalar ou atualizar o script.

### O jogo deixou de carregar após uma atualização

Desabilite temporariamente o userscript e confirme se o jogo volta a funcionar.

Se o problema estiver relacionado ao Analyzer, abra uma Issue informando:

- versão do Analyzer;
- navegador e versão;
- versão do Tampermonkey;
- erro do Console, se houver.

**Não publique cookies, tokens, URLs autenticadas ou dados da sua conta.**

### Meus dados são enviados para algum lugar?

Não. O Analyzer atual não possui backend e trabalha com persistência local no navegador.

---

# Autor

**Rhyxus**  
PokePixel Ref Code: `Q4BSZJD`

Desenvolvido como ferramenta comunitária para transformar Hunts em dados úteis para comparação e theorycraft.
