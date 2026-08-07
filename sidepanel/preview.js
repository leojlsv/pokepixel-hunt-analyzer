const RARITIES = [
  ["weak", "Weak"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythical", "Mythical"]
];

const MOCK_STATE = {
  sessionStartedAt:
    Date.now() - 3 * 60 * 60 * 1000,

  totals: {
    seen: 2622,
    captured: 97,
    failed: 2525
  },

  rarities: {
    weak: {
      seen: 430,
      captured: 18,
      failed: 412
    },

    common: {
      seen: 1180,
      captured: 49,
      failed: 1131
    },

    uncommon: {
      seen: 585,
      captured: 21,
      failed: 564
    },

    rare: {
      seen: 320,
      captured: 7,
      failed: 313
    },

    epic: {
      seen: 82,
      captured: 2,
      failed: 80
    },

    legendary: {
      seen: 20,
      captured: 0,
      failed: 20
    },

    mythical: {
      seen: 5,
      captured: 0,
      failed: 5
    },

    unknown: {
      seen: 0,
      captured: 0,
      failed: 0
    }
  },

  shiny: {
    seen: 3,
    captured: 1,
    failed: 2
  },

  hunt: {
    running: true,

    // Faz o relógio continuar correndo no preview.
    startedAt:
      Date.now() -
      (4 * 60 + 56) * 1000,

    accumulatedMs: 0,

    trainerExp: 185673,
    pokemonExp: 278510,
    dollars: 7962,
    lootEvents: 56,

    config: {
      key: null,
      speciesId: null,
      level: null,
      expRate: null,
      captureConfig: null
    }
  }
};

const numberFormatter =
  new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0
  });

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

function activeHuntMs(
  hunt,
  now = Date.now()
) {
  let total =
    Number(hunt.accumulatedMs) || 0;

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

  document
    .getElementById("hunt-time")
    .textContent =
      formatDuration(elapsedMs);

  document
    .getElementById(
      "trainer-exp-hour"
    )
    .textContent =
      formatNumber(
        perHour(
          hunt.trainerExp,
          elapsedMs
        )
      );

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
      formatNumber(
        perHour(
          hunt.dollars,
          elapsedMs
        )
      );

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

  status.className =
    "status-badge running";

  status.textContent =
    "Running";
}

function render(
  state,
  now = Date.now()
) {
  renderHunt(
    state,
    now
  );

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
}

createRarityRows();
render(MOCK_STATE);

document
  .getElementById(
    "reset-button"
  )
  .addEventListener(
    "click",
    () => {
      alert(
        "Preview: nenhum dado real foi alterado."
      );
    }
  );

setInterval(() => {
  renderHunt(
    MOCK_STATE,
    Date.now()
  );
}, 1000);