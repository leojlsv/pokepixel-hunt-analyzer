const STATE_KEY = "counterState";

const RARITIES = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

const numberFormatter =
  new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  });

let currentState = null;

function formatNumber(value) {
  return numberFormatter.format(
    Number(value) || 0
  );
}

function formatRate(
  numerator,
  denominator
) {
  if (!denominator) return "—";

  return `${
    (
      (numerator / denominator) *
      100
    ).toFixed(2)
  }%`;
}

function formatDuration(milliseconds) {
  const totalSeconds =
    Math.max(
      0,
      Math.floor(milliseconds / 1000)
    );

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":");
  }

  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":");
}

function emptyBucket() {
  return {
    seen: 0,
    captured: 0,
    failed: 0
  };
}

function emptyHunt() {
  return {
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
  };
}

function createFallbackState() {
  const rarities = {
    unknown: emptyBucket()
  };

  for (const [key] of RARITIES) {
    rarities[key] =
      emptyBucket();
  }

  return {
    sessionStartedAt: Date.now(),
    totals: emptyBucket(),
    rarities,
    shiny: emptyBucket(),
    hunt: emptyHunt()
  };
}

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(0, number)
    : 0;
}

function safeState(state) {
  const fallback =
    createFallbackState();

  if (
    !state ||
    typeof state !== "object"
  ) {
    return fallback;
  }

  fallback.sessionStartedAt =
    Number.isFinite(
      state.sessionStartedAt
    )
      ? state.sessionStartedAt
      : fallback.sessionStartedAt;

  for (
    const key of [
      "seen",
      "captured",
      "failed"
    ]
  ) {
    fallback.totals[key] =
      safeNumber(
        state?.totals?.[key]
      );

    fallback.shiny[key] =
      safeNumber(
        state?.shiny?.[key]
      );
  }

  for (
    const rarity of [
      ...RARITIES.map(
        ([key]) => key
      ),
      "unknown"
    ]
  ) {
    for (
      const key of [
        "seen",
        "captured",
        "failed"
      ]
    ) {
      fallback.rarities[
        rarity
      ][key] =
        safeNumber(
          state
            ?.rarities
            ?.[rarity]
            ?.[key]
        );
    }
  }

  const hunt =
    state.hunt;

  if (
    hunt &&
    typeof hunt === "object"
  ) {
    fallback.hunt.running =
      Boolean(hunt.running);

    fallback.hunt.startedAt =
      Number.isFinite(hunt.startedAt)
        ? hunt.startedAt
        : null;

    fallback.hunt.accumulatedMs =
      safeNumber(
        hunt.accumulatedMs
      );

    fallback.hunt.trainerExp =
      safeNumber(
        hunt.trainerExp
      );

    fallback.hunt.pokemonExp =
      safeNumber(
        hunt.pokemonExp
      );

    fallback.hunt.dollars =
      safeNumber(
        hunt.dollars
      );

    fallback.hunt.lootEvents =
      safeNumber(
        hunt.lootEvents
      );
  }

  return fallback;
}

function activeHuntMs(
  hunt,
  now = Date.now()
) {
  let total =
    safeNumber(
      hunt.accumulatedMs
    );

  if (
    hunt.running &&
    Number.isFinite(
      hunt.startedAt
    )
  ) {
    total +=
      Math.max(
        0,
        now - hunt.startedAt
      );
  }

  return total;
}

function perHour(
  amount,
  elapsedMs
) {
  if (
    elapsedMs <= 0 ||
    amount <= 0
  ) {
    return 0;
  }

  return (
    amount /
    (elapsedMs / 3600000)
  );
}

function createRarityRows() {
  const body =
    document.getElementById(
      "rarity-body"
    );

  for (
    const [key, label]
    of RARITIES
  ) {
    const row =
      document.createElement("tr");

    row.dataset.rarity = key;

    row.innerHTML = `
      <td>
        <span
          class="rarity-name rarity-${key}"
        >
          ${label}
        </span>
      </td>

      <td data-field="seen">0</td>
      <td data-field="captured">0</td>
      <td data-field="failed">0</td>
      <td data-field="rate">—</td>
    `;

    body.appendChild(row);
  }
}

function renderHunt(
  state,
  now = Date.now()
) {
  const hunt = state.hunt;
  const elapsedMs =
    activeHuntMs(hunt, now);

  const trainerExpHour =
    perHour(
      hunt.trainerExp,
      elapsedMs
    );

  const dollarsHour =
    perHour(
      hunt.dollars,
      elapsedMs
    );

  document
    .getElementById("hunt-time")
    .textContent =
      formatDuration(elapsedMs);

  document
    .getElementById(
      "trainer-exp-hour"
    )
    .textContent =
      elapsedMs > 0
        ? formatNumber(
            trainerExpHour
          )
        : "—";

  document
    .getElementById(
      "trainer-exp-total"
    )
    .textContent =
      formatNumber(
        hunt.trainerExp
      );

  document
    .getElementById(
      "dollars-hour"
    )
    .textContent =
      elapsedMs > 0
        ? formatNumber(
            dollarsHour
          )
        : "—";

  document
    .getElementById(
      "dollars-total"
    )
    .textContent =
      formatNumber(
        hunt.dollars
      );

  const status =
    document.getElementById(
      "hunt-status"
    );

  status.classList.remove(
    "running",
    "paused"
  );

  if (hunt.running) {
    status.textContent = "Running";
    status.classList.add(
      "running"
    );
  } else if (elapsedMs > 0) {
    status.textContent = "Paused";
    status.classList.add(
      "paused"
    );
  } else {
    status.textContent = "Waiting";
  }
}

function render(
  stateInput,
  now = Date.now()
) {
  const state =
    safeState(stateInput);

  currentState = state;

  renderHunt(state, now);

  document
    .getElementById(
      "total-seen"
    )
    .textContent =
      formatNumber(
        state.totals.seen
      );

  document
    .getElementById(
      "total-captured"
    )
    .textContent =
      formatNumber(
        state.totals.captured
      );

  document
    .getElementById(
      "total-failed"
    )
    .textContent =
      formatNumber(
        state.totals.failed
      );

  document
    .getElementById(
      "seen-rate"
    )
    .textContent =
      formatRate(
        state.totals.captured,
        state.totals.seen
      );

  const attempts =
    state.totals.captured +
    state.totals.failed;

  document
    .getElementById(
      "attempt-rate"
    )
    .textContent =
      formatRate(
        state.totals.captured,
        attempts
      );

  const rarePlusFailed =
    state.rarities.rare.failed +
    state.rarities.epic.failed +
    state.rarities.legendary.failed +
    state.rarities.mythical.failed;

  document
    .getElementById(
      "rare-plus-failed"
    )
    .textContent =
      formatNumber(
        rarePlusFailed
      );

  document
    .getElementById(
      "shiny-seen"
    )
    .textContent =
      formatNumber(
        state.shiny.seen
      );

  document
    .getElementById(
      "shiny-captured"
    )
    .textContent =
      formatNumber(
        state.shiny.captured
      );

  document
    .getElementById(
      "shiny-failed"
    )
    .textContent =
      formatNumber(
        state.shiny.failed
      );

  for (
    const [key]
    of RARITIES
  ) {
    const row =
      document.querySelector(
        `[data-rarity="${key}"]`
      );

    const bucket =
      state.rarities[key];

    row
      .querySelector(
        '[data-field="seen"]'
      )
      .textContent =
        formatNumber(
          bucket.seen
        );

    row
      .querySelector(
        '[data-field="captured"]'
      )
      .textContent =
        formatNumber(
          bucket.captured
        );

    row
      .querySelector(
        '[data-field="failed"]'
      )
      .textContent =
        formatNumber(
          bucket.failed
        );

    row
      .querySelector(
        '[data-field="rate"]'
      )
      .textContent =
        formatRate(
          bucket.captured,
          bucket.seen
        );
  }

  const unknown =
    state.rarities.unknown;

  const hasUnknown =
    unknown.seen > 0 ||
    unknown.captured > 0 ||
    unknown.failed > 0;

  document
    .getElementById(
      "unknown-warning"
    )
    .hidden =
      !hasUnknown;
}

async function loadState() {
  const result =
    await chrome.storage.session.get(
      STATE_KEY
    );

  render(
    result[STATE_KEY]
  );
}

async function resetCounters() {
  const confirmed =
    window.confirm(
      "Zerar a Hunt e todos os contadores desta sessão?"
    );

  if (!confirmed) return;

  await chrome.runtime.sendMessage({
    type: "counter.reset"
  });

  await loadState();
}

createRarityRows();
loadState();

document
  .getElementById(
    "reset-button"
  )
  .addEventListener(
    "click",
    resetCounters
  );

chrome.storage.onChanged.addListener(
  (
    changes,
    areaName
  ) => {
    if (
      areaName !== "session"
    ) {
      return;
    }

    if (
      !changes[STATE_KEY]
    ) {
      return;
    }

    render(
      changes[STATE_KEY].newValue
    );
  }
);

// Atualização visual do relógio/rates.
// Não incrementa o tempo: recalcula a partir dos timestamps.
setInterval(() => {
  if (!currentState) return;

  renderHunt(
    currentState,
    Date.now()
  );
}, 1000);