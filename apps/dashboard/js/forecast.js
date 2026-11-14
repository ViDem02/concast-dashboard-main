const MONTH_NAMES =
  (window.CONFIG && CONFIG.labels && CONFIG.labels.mesi_full) ||
  [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];

const numberFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const STRATEGY_DEFS = [
  { key: "coge_spento", fields: ["costo_coge_spento"], label: "Coge Spento", color: "#94a3b8" },
  { key: "coge_minimo", fields: ["costo_coge_minimo"], label: "Coge Minimo", color: "#10b981" },
  { key: "coge_ins_elettrico", fields: ["costo_coge_ins_elettrico"], label: "Ins Elettrico", color: "#3b82f6" },
  { key: "coge_massimo", fields: ["costo_coge_massimo"], label: "Coge Massimo", color: "#f59e0b" },
  { key: "coge_ins_termico", fields: ["costo_coge_ins_termico"], label: "Ins Termico", color: "#ec4899" },
];

const DEFAULT_ACTIVE_STRATEGIES = STRATEGY_DEFS.reduce(
  (acc, { key }) => ({ ...acc, [key]: true }),
  {}
);

const state = {
  meta: null,
  months: [],
  strategyAdvice: null,
  use350: false,
  recapData: null,
  activeStrategies: { ...DEFAULT_ACTIVE_STRATEGIES },
};

document.addEventListener("DOMContentLoaded", initForecastPage);

function setStrategyActive(strategyKey, value) {
  const activeCount = Object.values(state.activeStrategies).filter(Boolean).length;
  if (!value && activeCount <= 1) {
    console.warn("Almeno una strategia deve restare attiva");
    return false;
  }
  state.activeStrategies[strategyKey] = value;
  return true;
}

function isStrategyActive(key) {
  return state.activeStrategies[key] !== false;
}

function getActiveStrategyDefs() {
  return STRATEGY_DEFS.filter(({ key }) => isStrategyActive(key));
}

async function initForecastPage() {
  const loadingEl = document.getElementById("forecast-loading");
  const errorEl = document.getElementById("forecast-error");

  try {
    const forecast = await fetchJSON("data/forecast_2026.json");
    bindStrategyToggles();
    state.strategyAdvice = await loadStrategyAdvice();
    state.meta = forecast.meta;
    state.months = forecast.months;
    renderHero(state.meta);
    renderScenarioGrid(state.meta);
    renderSummary(state.meta);
    renderStrategyAdvice(state.strategyAdvice);
    renderTrendChart(state.months);
    renderMonthlyTable(state.months, state.meta.scenarios);

    loadingEl.classList.add("hidden");
  } catch (error) {
    console.error(error);
    loadingEl.classList.add("hidden");
    errorEl.style.display = "block";
    errorEl.textContent = `Impossibile caricare i dati: ${error.message}`;
  }
}

async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} per ${path}`);
  }
  return response.json();
}

function renderHero(meta) {
  const totals = meta.totals || {};
  const totalBase = totals.ee_total_kwh || 0;
  const totalPV = totals.ee_pv_kwh || 0;
  const totalWithPv = totals.ee_total_with_pv_kwh || totalBase + totalPV;
  const totalGrid = totals.ee_grid_kwh || 0;
  const totalCoge = totals.ee_coge_kwh || 0;

  const pvShare = totalWithPv > 0 ? (totalPV / totalWithPv) * 100 : 0;
  const gridShare = totalWithPv > 0 ? (totalGrid / totalWithPv) * 100 : 0;
  const cogeShare = totalWithPv > 0 ? (totalCoge / totalWithPv) * 100 : 0;
  const gridFactor = getGridFactor();
  const co2SavedKg = totals.co2_avoided_kg ?? totalPV * gridFactor;

  setText("metric-ee-total", `${formatMWh(totalWithPv)} MWh`);
  setText(
    "metric-ee-meta",
    `Base ${formatMWh(totalBase)} MWh · FV ${formatMWh(totalPV)} MWh`,
  );
  setText("metric-co2-saved", `${formatTons(co2SavedKg)} t`);
  setText(
    "metric-co2-saved-meta",
    gridFactor
      ? `Calcolata con ${gridFactor} kg/kWh rete`
      : "Imposta il fattore rete nello script",
  );
  setText("metric-gas", `${formatSmc(totals.gas_coge_smc || 0)} Smc`);
  setText("metric-gas-meta", "Smc medi");

  setText("metric-grid-share", `${decimalFormatter.format(gridShare)}%`);
  setText("metric-grid-ee-meta", `${formatMWh(totalGrid)} MWh dalla rete`);

  setText("metric-coge-share", `${decimalFormatter.format(cogeShare)}%`);
  setText("metric-coge-ee-meta", `${formatMWh(totalCoge)} MWh dal cogeneratore`);

  setText("metric-pv-share", `${decimalFormatter.format(pvShare)}%`);
  setText("metric-pv-meta", `${formatMWh(totalPV)} MWh dal FV`);

  // Calculate and display user-friendly CO2 equivalents
  const treesEquivalent = calculateTreesEquivalent(co2SavedKg);
  const carKmEquivalent = calculateCarKmEquivalent(co2SavedKg);
  const electricityEquivalent = calculateElectricityEquivalent(co2SavedKg);

  setText("metric-trees-equivalent", `${numberFormatter.format(Math.round(treesEquivalent))} alberi`);
  setText("metric-car-km-equivalent", `${numberFormatter.format(Math.round(carKmEquivalent))} km`);
  setText("metric-electricity-equivalent", `${numberFormatter.format(Math.round(electricityEquivalent))} kWh`);
}

async function loadStrategyAdvice() {
  try {
    const folder = state.use350 ? "normal350" : "normal";
    const years = ["2024", "2025"];
    const recaps = await Promise.all(
      years.map(async (year) => {
        const recap = await fetchJSON(`data/${year}/${folder}/recap_estratti.json`);
        return { year: Number(year), recap: recap[year] || recap[String(year)] || recap };
      })
    );
    state.recapData = recaps;
    return computeStrategyAdvice(recaps);
  } catch (error) {
    console.warn("Impossibile caricare i dati strategie per il consiglio 2026:", error);
    return null;
  }
}

function computeStrategyAdvice(recaps) {
  if (!recaps || recaps.length === 0) return null;

  const weekBuckets = new Map();
  const monthBuckets = new Map();
  const monthWeekBuckets = {};

  recaps.forEach(({ year, recap }) => {
    if (!recap) return;
    Object.entries(recap).forEach(([monthKey, daysObj]) => {
      Object.entries(daysObj || {}).forEach(([dayKey, hoursObj]) => {
        Object.entries(hoursObj || {}).forEach(([hourKey, data]) => {
          const date = new Date(Number(year), Number(monthKey) - 1, Number(dayKey), Number(hourKey));
          const weekNumber = getISOWeekNumber(date);
          const weekOfMonth = Math.min(3, Math.floor((Number(dayKey) - 1) / 7)); // W1-W4

          const weekKey = String(weekNumber).padStart(2, "0");
          const monthBucketKey = String(monthKey).padStart(2, "0");

          accumulateStrategyCosts(weekBuckets, weekKey, data);
          accumulateStrategyCosts(monthBuckets, monthBucketKey, data);

          if (!monthWeekBuckets[monthBucketKey]) {
            monthWeekBuckets[monthBucketKey] = [initBucket(), initBucket(), initBucket(), initBucket()];
          }
          accumulateStrategyCostsObject(monthWeekBuckets[monthBucketKey][weekOfMonth], data);
        });
      });
    });
  });

  const weekly = finalizeStrategyBuckets(weekBuckets, "Settimana");
  const monthly = finalizeStrategyBuckets(monthBuckets, "Mese", MONTH_NAMES);
  const monthWeeks = finalizeMonthWeeks(monthWeekBuckets, MONTH_NAMES);

  return { weekly, monthly, monthWeeks };
}

function accumulateStrategyCosts(bucketMap, key, data) {
  if (!bucketMap.has(key)) {
    const initialCosts = STRATEGY_DEFS.reduce((acc, { key: k }) => ({ ...acc, [k]: 0 }), { attuale: 0, minimo: 0 });
    bucketMap.set(key, { costs: initialCosts, hours: 0 });
  }
  const bucket = bucketMap.get(key);
  bucket.hours += 1;
  bucket.costs.attuale += numeric(data.costo_attuale);

  const activeDefs = getActiveStrategyDefs();
  activeDefs.forEach(({ key: stratKey, fields }) => {
    bucket.costs[stratKey] += getFieldValue(data, fields);
  });
}

function accumulateStrategyCostsObject(bucketObj, data) {
  if (!bucketObj) return;
  bucketObj.hours += 1;
  bucketObj.costs.attuale += data.costo_attuale || 0;

  const activeDefs = getActiveStrategyDefs();
  activeDefs.forEach(({ key: stratKey, fields }) => {
    bucketObj.costs[stratKey] += getFieldValue(data, fields);
  });
}

function initBucket() {
  return {
    hours: 0,
    costs: STRATEGY_DEFS.reduce((acc, { key }) => ({ ...acc, [key]: 0 }), { attuale: 0, minimo: 0 }),
  };
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getFieldValue(obj, fieldNames) {
  for (const f of fieldNames) {
    const v = obj[f];
    if (typeof v === "number") return v;
    if (v != null && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

function finalizeStrategyBuckets(bucketMap, labelPrefix, monthNames = []) {
  const entries = Array.from(bucketMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));

  return entries
    .map(([key, bucket]) => {
      const baseline = bucket.costs.attuale;
      if (bucket.hours === 0 || baseline <= 0) {
        return null;
      }

      const strategyDefs = getActiveStrategyDefs();
      const strategyCosts = strategyDefs.map((def) => ({
        ...def,
        value: bucket.costs[def.key],
      }));
      const best = strategyCosts.length
        ? strategyCosts.reduce((min, cur) => (cur.value < min.value ? cur : min), strategyCosts[0])
        : { label: "—", value: baseline, color: "#94a3b8" };

      // Vincolo: una sola strategia fissa per l'intero bucket (settimana/mese)
      const savingEur = baseline - best.value;
      const savingPct = baseline > 0 ? (savingEur / baseline) * 100 : 0;
      const baselineOff = bucket.costs.coge_spento || 0;
      const savingVsOff = baselineOff ? baselineOff - best.value : savingEur;

      const label =
        labelPrefix === "Mese" && monthNames.length > 0
          ? `${monthNames[Number(key) - 1] || key}`
          : `${labelPrefix} ${key}`;

      return {
        key,
        label,
        best,
        baseline,
        savingEur,
        savingPct,
        baselineOff,
        savingVsOff,
      };
    })
    .filter(Boolean);
}

function finalizeMonthWeeks(monthBuckets, monthNames) {
  const result = [];
  Object.entries(monthBuckets).forEach(([monthKey, weeks]) => {
    const label = monthNames[Number(monthKey) - 1] || monthKey;
    const weekStats = weeks.map((bucket, idx) => finalizeSingleBucket(bucket, `W${idx + 1}`)).filter(Boolean);
    result.push({ key: monthKey, label, weeks: weekStats });
  });
  return result.sort((a, b) => Number(a.key) - Number(b.key));
}

function finalizeSingleBucket(bucket, label) {
  if (!bucket) return null;
  const baseline = bucket.costs.attuale;
  if (bucket.hours === 0 || baseline <= 0) return null;

  const strategyDefs = getActiveStrategyDefs();
  const strategyCosts = strategyDefs.map((def) => ({
    ...def,
    value: bucket.costs[def.key],
  }));
  const best = strategyCosts.length
    ? strategyCosts.reduce((min, cur) => (cur.value < min.value ? cur : min), strategyCosts[0])
    : { label: "—", value: baseline, color: "#94a3b8" };

  // Vincolo: una sola strategia fissa per il bucket
  const savingEur = baseline - best.value;
  const savingPct = baseline > 0 ? (savingEur / baseline) * 100 : 0;
  const baselineOff = bucket.costs.coge_spento || 0;
  const savingVsOff = baselineOff ? baselineOff - best.value : savingEur;
  return { key: label, label, best, baseline, savingEur, savingPct, baselineOff, savingVsOff };
}

function renderStrategyAdvice(advice) {
  const wrapper = document.getElementById("strategy-advice");
  const monthContainer = document.getElementById("strategy-month-strips");
  const legendContainer = document.getElementById("strategy-legend");

  if (!wrapper || !monthContainer || !legendContainer) return;
  if (!advice) {
    wrapper.classList.remove("hidden");
    monthContainer.innerHTML = `<p class="strategy-empty">Strategie non disponibili al momento.</p>`;
    return;
  }

  wrapper.classList.remove("hidden");
  const toggle = document.getElementById("strategy-350-toggle");
  if (toggle) {
    toggle.checked = state.use350;
  }
  renderStrategyLegend(legendContainer);
  renderStrategyMonthsGrid(monthContainer, advice);
}

function renderStrategyLegend(container) {
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "strategy-toggle-list";

  STRATEGY_DEFS.forEach((s) => {
    const item = document.createElement("div");
    item.className = "strategy-toggle";

    const label = document.createElement("div");
    label.className = "strategy-toggle-label";
    label.innerHTML = `<span class="legend-swatch" style="background:${s.color};"></span>${s.label}`;

    const toggle = document.createElement("label");
    toggle.className = "toggle toggle-compact";
    toggle.title = "Attiva/Disattiva strategia nel calcolo";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isStrategyActive(s.key);
    const slider = document.createElement("span");
    slider.className = "toggle-slider";
    toggle.appendChild(input);
    toggle.appendChild(slider);

    input.addEventListener("change", () => {
      const ok = setStrategyActive(s.key, input.checked);
      if (!ok) {
        input.checked = true;
        return;
      }
      refreshStrategyAdvice();
    });

    item.appendChild(label);
    item.appendChild(toggle);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function renderStrategyMonthsGrid(container, advice) {
  container.innerHTML = "";
  const months = advice?.monthWeeks || [];
  const monthly = advice?.monthly || [];

  console.log("Rendering Strategy Grid", { months: months.length, monthly: monthly.length });

  if (!months.length && !monthly.length) {
    container.innerHTML = `<p class="strategy-empty">Nessun dato disponibile.</p>`;
    return;
  }

  // 1. Add Explanatory Header Row
  const headerRow = document.createElement("div");
  headerRow.className = "strategy-grid-header";
  headerRow.innerHTML = `
    <div class="header-col header-month">MESE</div>
    <div class="header-col header-weeks">CONSIGLIO SETTIMANALE (STRATEGIA + RISPARMIO)</div>
    <div class="header-col header-saving">RISPARMIO TOTALE<br><span style="font-weight:400; opacity:0.7;">(vs COSTO ATTUALE)</span></div>
  `;
  container.appendChild(headerRow);

  const monthlyMap = new Map(monthly.map((m) => [m.key, m]));

  let totalAnnualSaving = 0;

  for (let i = 1; i <= 12; i++) {
    const key = String(i).padStart(2, "0");
    const monthWeeks = months.find((m) => m.key === key);
    const monthBest = monthlyMap.get(key);

    const strip = document.createElement("div");
    strip.className = "strategy-month-strip";

    const monthTitle = MONTH_NAMES[i - 1] || key;
    const weekItems = monthWeeks?.weeks || [];
    const monthlySaving = weekItems.reduce((acc, wk) => acc + (wk?.savingEur ?? 0), 0);
    totalAnnualSaving += monthlySaving;
    const monthlyBaseline = weekItems.reduce((acc, wk) => acc + (wk?.baseline ?? 0), 0);
    const monthlyPct = monthlyBaseline > 0 ? (monthlySaving / monthlyBaseline) * 100 : 0;
    const monthlyBestLabel = monthBest?.best?.label || "—";
    const monthlyBestColor = monthBest?.best?.color || "#94a3b8";

    // Use helper for alpha colors
    const bgAlpha = toAlpha(monthlyBestColor, 0.08); // Very subtle background
    const textAlpha = toAlpha(monthlyBestColor, 1);

    // Left: Month Info
    const infoDiv = document.createElement("div");
    infoDiv.className = "month-info";
    infoDiv.innerHTML = `
      <span class="month-name">${monthTitle}</span>
      <span class="month-best-label" style="color:${textAlpha};">${monthlyBestLabel}</span>
    `;

    // Center: Weeks Visual (Detailed Blocks)
    const weeksDiv = document.createElement("div");
    weeksDiv.className = "weeks-visual";

    for (let w = 0; w < 4; w++) {
      const wk = weekItems[w];
      const label = `W${w + 1}`;
      const bestLabel = wk?.best?.label || "—";
      // Shorten label if needed
      const shortBestLabel = bestLabel.replace("Coge ", "").replace("Ins ", "");

      const bestColor = wk?.best?.color || "#e5e7eb";
      const saving = wk?.savingEur ?? 0;

      // Design System: Depth over borders
      // We use a subtle tint of the strategy color for the background ("patina")
      const blockBg = toAlpha(bestColor, 0.08);

      const block = document.createElement("div");
      block.className = "week-block";
      // We'll handle the specific styling in CSS to keep JS clean, 
      // but we pass the color as a variable for the accent
      block.style.setProperty('--accent-color', bestColor);
      block.style.backgroundColor = blockBg;

      block.innerHTML = `
        <div class="week-block-content">
          <span class="week-strategy-name">${shortBestLabel}</span>
          <span class="week-saving-value">${euroFormatter.format(saving)}</span>
        </div>
        <div class="week-meta">
            <span class="week-number">${label}</span>
        </div>
      `;

      weeksDiv.appendChild(block);
    }

    // Right: Savings
    const savingsDiv = document.createElement("div");
    savingsDiv.className = "savings-info";
    const savingClass = monthlySaving >= 0 ? "saving-pos" : "saving-neg";
    const sign = monthlySaving >= 0 ? "-" : "+";

    savingsDiv.innerHTML = `
      <div class="saving-value ${savingClass}">
        ${sign}${euroFormatter.format(Math.abs(monthlySaving))}
      </div>
      <div class="saving-pct">${monthlyPct.toFixed(1)}%</div>
    `;

    strip.appendChild(infoDiv);
    strip.appendChild(weeksDiv);
    strip.appendChild(savingsDiv);
    container.appendChild(strip);
  }

  // Add Total Annual Savings Footer
  const totalClass = totalAnnualSaving >= 0 ? "saving-pos" : "saving-neg";
  const totalSign = totalAnnualSaving >= 0 ? "-" : "+";

  const footerRow = document.createElement("div");
  footerRow.className = "strategy-grid-footer";
  footerRow.innerHTML = `
    <div class="footer-label">TOTALE ANNUALE STIMATO</div>
    <div class="footer-value ${totalClass}">
      ${totalSign}${euroFormatter.format(Math.abs(totalAnnualSaving))}
    </div>
  `;
  container.appendChild(footerRow);
}

function renderScenarioGrid(meta) {
  const container = document.getElementById("scenario-compare-grid");
  container.innerHTML = "";

  const { scenarios = {}, scenario_stats = {} } = meta;
  Object.entries(scenarios).forEach(([key, info]) => {
    const stats = scenario_stats[key] || {};
    const card = document.createElement("article");
    card.className = "scenario-compare-card";
    card.dataset.scenario = key;
    card.innerHTML = `
      <div>
        <div class="scenario-pill" data-scenario="${key}">${info.label || key}</div>
        <h3>${info.label || key}</h3>
        <p class="scenario-desc">${info.description || ""}</p>
      </div>
      <div class="scenario-metrics">
        <div class="scenario-metric">
          <label>PUN medio</label>
          <span>${decimalFormatter.format(
      stats.avg_pun_eur_per_mwh || 0,
    )} €/MWh</span>
        </div>
        <div class="scenario-metric">
          <label>PSV medio</label>
          <span>${decimalFormatter.format(
      stats.avg_psv_eur_per_mwh || 0,
    )} €/MWh</span>
        </div>
      </div>
      <div class="scenario-cost">
        <span>Anno 2026</span>
        <strong>${euroFormatter.format(stats.total_cost_eur || 0)}</strong>
      </div>
      <div class="scenario-cost-meta">
        <span>Rete: ${euroFormatter.format(stats.grid_cost_eur || 0)}</span>
        <span>Gas: ${euroFormatter.format(stats.gas_cost_eur || 0)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderSummary(meta) {
  const totals = meta.totals || {};
  const totalEE = totals.ee_total_kwh || 0;
  const gridEE = totals.ee_grid_kwh || 0;
  const cogeEE = totals.ee_coge_kwh || 0;
  const totalPV = totals.ee_pv_kwh || 0;
  const totalWithPv = totals.ee_total_with_pv_kwh || totalEE + totalPV;
  const gridFactor = getGridFactor();
  const co2Total = totals.co2_total_kg || 0;

  setText(
    "metric-emission",
    [
      gridFactor ? `rete ${gridFactor} kg/kWh` : null,
      meta.methane_emission_factor_kg_per_smc != null
        ? `coge ${meta.methane_emission_factor_kg_per_smc} kg/Smc`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Configura i fattori nello script",
  );
  setText(
    "metric-grid-share",
    `${formatPercentage(gridEE, totalWithPv)}`
  );
  setText(
    "metric-grid-ee-meta",
    `${formatMWh(gridEE)} MWh dalla rete`,
  );

  setText(
    "metric-coge-share",
    `${formatPercentage(cogeEE, totalWithPv)}`
  );
  setText(
    "metric-coge-ee-meta",
    `${formatMWh(cogeEE)} MWh dal cogeneratore`,
  );

  const co2Grid = state.months.reduce(
    (acc, row) => acc + (row.co2_grid_kg || 0),
    0,
  );
  const co2Coge = state.months.reduce(
    (acc, row) => acc + (row.co2_coge_kg || 0),
    0,
  );

  setText(
    "metric-co2-breakdown",
    `${formatPercentage(co2Grid, co2Total)} · ${formatPercentage(
      co2Coge,
      co2Total,
    )}`,
  );
  setText(
    "summary-co2-meta",
    `Rete ${formatTons(co2Grid)} · Coge ${formatTons(co2Coge)}`,
  );
  setText("metric-total-ee", `${formatKwh(totalWithPv)} kWh`);
  setText(
    "summary-total-ee-meta",
    `Base ${formatKwh(totalEE)} · FV ${formatKwh(totalPV)}`,
  );
}

let tableEventsBound = false;

function renderMonthlyTable(months, scenarios) {
  const tbody = document.getElementById("monthly-table-body");
  tbody.innerHTML = "";
  const gridFactor = getGridFactor();
  const totals = {
    grid: 0,
    coge: 0,
    fv: 0,
    total: 0,
    co2: 0,
    optimistic: 0,
    standard: 0,
    pessimistic: 0,
  };

  const sortedMonths = [...months].sort((a, b) => a.month - b.month);

  sortedMonths
    .forEach((monthEntry) => {
      const pvValue = monthEntry.ee_pv_kwh || 0;
      const totalWithPv =
        monthEntry.ee_total_with_pv_kwh || (monthEntry.ee_total_kwh || 0) + pvValue;
      const co2SavedKg =
        monthEntry.co2_avoided_kg ?? (pvValue || 0) * gridFactor;
      const optimisticCost = monthEntry.scenarios?.optimistic?.total_cost_eur || 0;
      const standardCost = monthEntry.scenarios?.standard?.total_cost_eur || 0;
      const pessimisticCost = monthEntry.scenarios?.pessimistic?.total_cost_eur || 0;

      totals.grid += monthEntry.ee_grid_kwh || 0;
      totals.coge += monthEntry.ee_coge_kwh || 0;
      totals.fv += pvValue;
      totals.total += totalWithPv;
      totals.co2 += co2SavedKg;
      totals.optimistic += optimisticCost;
      totals.standard += standardCost;
      totals.pessimistic += pessimisticCost;

      const tr = document.createElement("tr");
      tr.dataset.month = String(monthEntry.month);
      tr.innerHTML = `
        <td>
          <button class="detail-toggle" data-month="${monthEntry.month}" aria-label="Dettaglio ${monthEntry.label}">
            ⊕
          </button>
        </td>
        <td class="value-strong">${monthEntry.label}</td>
        <td>${formatKwh(monthEntry.ee_grid_kwh)}</td>
        <td>${formatKwh(monthEntry.ee_coge_kwh)}</td>
        <td>${formatKwh(pvValue)}</td>
        <td class="value-strong" data-role="pv-total">${formatKwh(totalWithPv)}</td>
        <td class="co2-highlight" data-role="pv-co2">
          <span class="co2-leaf">🍃</span>
          <strong>${formatTons(co2SavedKg)}</strong>
        </td>
        ${renderScenarioCells(monthEntry.scenarios)}
      `;
      tbody.appendChild(tr);

      const detailRow = document.createElement("tr");
      detailRow.className = "detail-row hidden";
      detailRow.dataset.month = String(monthEntry.month);
      detailRow.innerHTML = `
        <td colspan="10">
          ${renderDetailContent(monthEntry, scenarios, gridFactor)}
        </td>
      `;
      tbody.appendChild(detailRow);
    });

  // Totali
  setText("monthly-total-grid", formatKwh(totals.grid));
  setText("monthly-total-coge", formatKwh(totals.coge));
  setText("monthly-total-fv", formatKwh(totals.fv));
  setText("monthly-total-total", formatKwh(totals.total));
  setText("monthly-total-co2", formatTons(totals.co2));
  document.getElementById("monthly-total-optimistic").textContent = euroFormatter.format(totals.optimistic);
  document.getElementById("monthly-total-standard").textContent = euroFormatter.format(totals.standard);
  document.getElementById("monthly-total-pessimistic").textContent = euroFormatter.format(totals.pessimistic);

  if (!tableEventsBound) {
    tbody.addEventListener("click", handleDetailToggle);
    tableEventsBound = true;
  }
}

function renderScenarioCells(scenarios) {
  return ["optimistic", "standard", "pessimistic"]
    .map((key) => {
      const entry = scenarios[key];
      if (!entry) return "<td>—</td>";
      return `<td class="scenario-cell" data-scenario="${key}">${euroFormatter.format(entry.total_cost_eur || 0)}</td>`;
    })
    .join("");
}

function renderDetailContent(monthEntry, scenariosInfo, gridFactor) {
  const historyList = monthEntry.history
    .map(
      (row) => `
      <li class="history-chip">
        <span class="history-year">${row.year}</span>
        <span class="history-data">rete ${formatKwh(row.ee_grid_kwh)} kWh · coge ${formatKwh(row.ee_coge_kwh)} kWh · gas ${formatSmc(row.gas_coge_smc)} Smc</span>
      </li>
    `,
    )
    .join("");
  const pvValue = monthEntry.ee_pv_kwh || 0;
  const co2SavedKg =
    monthEntry.co2_avoided_kg ?? (pvValue || 0) * gridFactor;
  const pvDetails = `
    <div class="pv-stats">
      <div class="pv-stat">
        <span class="pv-stat-label">FV stimato</span>
        <strong>${formatKwh(pvValue)} kWh</strong>
      </div>
      <div class="pv-stat">
        <span class="pv-stat-label">CO₂ evitata</span>
        <strong>${formatTons(co2SavedKg)} t</strong>
      </div>
    </div>
  `;

  const scenarioBreakdown = ["optimistic", "standard", "pessimistic"]
    .map((key) => {
      const entry = monthEntry.scenarios[key];
      if (!entry) return "";
      return `
        <div class="scenario-cost-pill">
          <div class="scenario-cost-pill__header">
            <span class="scenario-pill" data-scenario="${key}">${(scenariosInfo[key] && scenariosInfo[key].label) || key}</span>
            <strong>${euroFormatter.format(entry.total_cost_eur || 0)}</strong>
          </div>
          <div class="scenario-cost-pill__meta">
            <span>Rete ${euroFormatter.format(entry.grid_cost_eur || 0)}</span>
            <span>Gas ${euroFormatter.format(entry.gas_cost_eur || 0)}</span>
          </div>
          <div class="scenario-cost-pill__meta is-muted">
            <span>PUN ${decimalFormatter.format(entry.pun_eur_per_mwh || 0)} · PSV ${decimalFormatter.format(entry.psv_eur_per_mwh || 0)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="detail-content">
      <div class="detail-meta-cards">
        <div class="detail-card">
          <p class="detail-card__title">Storico utilizzato</p>
          <ul class="history-list">
            ${historyList}
          </ul>
        </div>
        <div class="detail-card detail-card--pv">
          <p class="detail-card__title">Fotovoltaico</p>
          ${pvDetails}
        </div>
      </div>
      <div class="detail-card">
        <p class="detail-card__title">Costi mensili stimati</p>
        <div class="scenario-cost-list compact">
          ${scenarioBreakdown}
        </div>
      </div>
    </div>
  `;
}

function renderTrendChart(months) {
  const container = document.getElementById("forecast-bars");
  if (!container) return;
  container.innerHTML = "";
  if (!months.length) return;

  const totals = months.map((month) => {
    const baseValue = month.ee_total_kwh || 0;
    const pvValue = month.ee_pv_kwh || 0;
    return month.ee_total_with_pv_kwh || baseValue + pvValue;
  });
  const max = Math.max(...totals) || 1;

  months.forEach((month, idx) => {
    const baseValue = month.ee_total_kwh || 0;
    const pvValue = month.ee_pv_kwh || 0;
    const total = month.ee_total_with_pv_kwh || baseValue + pvValue;
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${(total / max) * 100}%`;
    const pvRatio = total ? (pvValue / total) * 100 : 0;
    if (pvRatio > 0) {
      bar.style.background = `linear-gradient(180deg, rgba(59,130,246,0.85) 0%, rgba(59,130,246,0.85) ${100 - pvRatio}%, rgba(250,204,21,0.95) ${100 - pvRatio}%, rgba(250,204,21,0.95) 100%)`;
    } else {
      bar.style.background = `linear-gradient(180deg, rgba(59,130,246,0.85), rgba(59,130,246,0.5))`;
    }

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = formatKwh(total);

    const monthLabel = document.createElement("span");
    monthLabel.className = "bar-month";
    const shortLabel = month.label
      ? month.label.slice(0, 3)
      : MONTH_NAMES[idx % MONTH_NAMES.length].slice(0, 3);
    monthLabel.textContent = shortLabel;

    bar.appendChild(label);
    bar.appendChild(monthLabel);
    container.appendChild(bar);
  });
}

function handleDetailToggle(event) {
  const button = event.target.closest(".detail-toggle");
  if (!button) return;
  const month = button.dataset.month;
  const tbody = document.getElementById("monthly-table-body");
  const detail = tbody.querySelector(`.detail-row[data-month="${month}"]`);
  if (detail) {
    detail.classList.toggle("hidden");
    button.textContent = detail.classList.contains("hidden") ? "⊕" : "⊖";
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatKwh(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return numberFormatter.format(Math.round(value));
}

function formatMWh(value) {
  if (value == null) return "0";
  return decimalFormatter.format(value / 1000);
}

function formatSmc(value) {
  if (value == null) return "—";
  return numberFormatter.format(Math.round(value));
}

function formatTons(valueKg) {
  if (valueKg == null) return "—";
  return decimalFormatter.format(valueKg / 1000);
}

function formatPercentage(part, total) {
  if (!total) return "—";
  return `${decimalFormatter.format((part / total) * 100)}%`;
}

function getISOWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}

function getGridFactor() {
  return state.meta?.grid_emission_factor_kg_per_kwh ?? 0;
}

function bindStrategyToggles() {
  const toggle350 = document.getElementById("strategy-350-toggle");
  if (toggle350) {
    toggle350.addEventListener("change", async (e) => {
      state.use350 = e.target.checked;
      const loading = document.getElementById("forecast-loading");
      if (loading) loading.classList.remove("hidden");
      state.strategyAdvice = await loadStrategyAdvice();
      renderStrategyAdvice(state.strategyAdvice);
      if (loading) loading.classList.add("hidden");
    });
  }
}

function refreshStrategyAdvice() {
  if (!state.recapData) return;
  state.strategyAdvice = computeStrategyAdvice(state.recapData);
  renderStrategyAdvice(state.strategyAdvice);
  syncStrategyToggleUI();
}

function toAlpha(colorHex, alpha) {
  const hex = colorHex.replace("#", "");
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function syncStrategyToggleUI() {
  // toggles sono rigenerati in legenda, niente da sincronizzare qui
}

// CO2 equivalents calculation functions
function calculateTreesEquivalent(co2Kg) {
  // Trees absorb approximately 20 kg CO2 per year
  const CO2_PER_TREE_KG_YEAR = 20;
  return co2Kg / CO2_PER_TREE_KG_YEAR;
}

function calculateCarKmEquivalent(co2Kg) {
  // Average car emits approximately 0.15 kg CO2 per km
  const CO2_PER_KM = 0.15;
  return co2Kg / CO2_PER_KM;
}

function calculateElectricityEquivalent(co2Kg) {
  // Electricity grid mix in Italy/EU emits approximately 0.25 kg CO2 per kWh
  const CO2_PER_KWH = 0.25;
  return co2Kg / CO2_PER_KWH;
}
