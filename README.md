# PokePixel Hunt Counter — v0.3.0

Extensão MV3 para Microsoft Edge.

## Novidades da v0.3.0

Além dos contadores de captura, a extensão agora calcula:

- Tempo ativo da Hunt
- EXP/h Treinador
- EXP Treinador total
- Dólar/h
- Dólar total

Tudo continua sendo agregado em `chrome.storage.session`.

Não existe log de eventos nem histórico individual de Pokémon.

## Eventos usados

### `combat.started`

- incrementa `Seen`;
- inicia ou retoma o cronômetro como fallback.

### `capture.success`

- incrementa `Captured`.

### `capture.failed`

- incrementa `Failed`.

### `loot.received`

Acumula:

```text
trainer_exp
pokemon_exp
gold
```

A interface usa:

```text
EXP/h Treinador = trainer_exp acumulado / horas ativas
Dólar/h         = gold acumulado / horas ativas
```

### `hunt.stopped`

Pausa o cronômetro.

### `hunt.analyzer_reset`

Não zera a extensão.

Ele é tratado apenas como sinal de atividade/início.

O botão `Reset` da própria extensão continua sendo a autoridade para
começar uma nova medição.

## Cronômetro

A extensão NÃO incrementa um contador a cada segundo.

Ela persiste:

```javascript
{
  running: true,
  startedAt: 1234567890,
  accumulatedMs: 0
}
```

E calcula:

```text
tempo = accumulatedMs + (agora - startedAt)
```

Isso evita o problema clássico de cronômetro visual congelar quando um
timer JavaScript deixa de executar temporariamente.

O `setInterval` do Side Panel serve apenas para atualizar a tela.

## Config Key preparada

Foi deixada uma estrutura preparada para uma evolução futura:

```javascript
species + level + expRate + captureConfig
```

Exemplo:

```text
kabutops|90|2x|ultra
```

A chave NÃO está ativa nesta versão e NÃO é usada como identificador único
de encontro.

A v0.3.0 continua tratando tudo como uma única Hunt até o usuário apertar
`Reset`.

## Instalação / atualização

1. Extraia o ZIP.
2. Abra:
   `edge://extensions`
3. Ative **Modo do desenvolvedor**.
4. Se já estiver usando uma versão anterior na mesma pasta, substitua os
   arquivos e clique em **Recarregar**.
5. Se estiver usando esta pasta como instalação nova, clique:
   **Carregar sem compactação**.
6. Selecione:
   `pokepixel-capture-counter-sidepanel-v0.3.0`
7. Faça F5 no PokePixel.
8. Abra:
   `edge://extensions/shortcuts`
9. Confirme:
   `Ctrl+Shift+7`

## Preview visual

Execute:

```powershell
.\start-preview.ps1
```

Depois abra:

```text
http://127.0.0.1:8000/preview.html
```

O preview inclui dados fictícios de Tempo, EXP/h e Dólar/h.

Para alterar cores/layout:

```text
sidepanel/sidepanel.css
```

Para alterar os mocks:

```text
sidepanel/preview.js
```

## Estado agregado

Conceitualmente:

```javascript
{
  totals: {
    seen: 0,
    captured: 0,
    failed: 0
  },

  hunt: {
    running: false,
    startedAt: null,
    accumulatedMs: 0,

    trainerExp: 0,
    pokemonExp: 0,
    dollars: 0,
    lootEvents: 0,

    config: {
      key: null,
      speciesId: null,
      level: null,
      expRate: null,
      captureConfig: null
    }
  }
}
```

## Sem armazenamento individual

Não são persistidos:

- payloads WebSocket;
- `wild_monster_id`;
- espécie por encontro;
- IV individual;
- timestamps de cada Pokémon;
- tokens;
- URLs de WebSocket;
- histórico da Hunt.

## Observação sobre pausa/retomada

`hunt.stopped` pausa o relógio.

Nos dados analisados, `hunt.resume` pode ocorrer no sentido cliente → servidor,
enquanto esta extensão observa principalmente os frames recebidos.

Por isso `combat.started`, `hunt.analyzer_reset` e `loot.received` funcionam
como fallback de retomada.

Na prática, ao voltar a caçar, o relógio retoma assim que a atividade da Hunt
volta a ser observada.
