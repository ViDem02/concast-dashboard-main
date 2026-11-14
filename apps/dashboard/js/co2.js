const decimalFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const intFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
});

document.addEventListener("DOMContentLoaded", initCo2Page);

async function initCo2Page() {
  const loadingEl = document.getElementById("co2-loading");
  const errorEl = document.getElementById("co2-error");

  try {
    const [monthlySummary, forecast, pvCsvText, pvForecast2026] = await Promise.all([
      fetchJSON("data/monthly_summary.json"),
      fetchJSON("data/forecast_2026.json"),
      fetchText("data/pv_data.csv"),
      fetchJSON("data/pv_estimate_2026.json")
    ]);

    // Parse PV CSV for 2025 monthly breakdown
    const pvMonthly2025 = parsePVMonthly2025(pvCsvText);

    // Process Data with verified values and seasonal projection
    const yearlyData = processData(monthlySummary, forecast, pvMonthly2025, pvForecast2026);
    const totalStats = calculateTotalStats(yearlyData);

    // Render
    renderYearlyCards(yearlyData);
    renderEquivalents(totalStats.totalAvoided);

    // Update Header KPI
    document.getElementById("total-saved-kpi").textContent = `${decimalFormatter.format(totalStats.totalAvoided / 1000)} t`;

    loadingEl.style.display = "none";

    // Initialize GSAP animations after content is rendered
    initGSAPAnimations(totalStats.totalAvoided);

  } catch (error) {
    console.error(error);
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    errorEl.textContent = `Errore nel caricamento dati: ${error.message}`;
  }
}

async function fetchJSON(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} per ${path}`);
  return resp.json();
}

async function fetchText(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} per ${path}`);
  return resp.text();
}

function parsePVMonthly2025(csvText) {
  const lines = csvText.split('\n');
  const monthly = {
    normal: { 1: 0, 2: 0, 3: 0 }, // Gen, Feb, Mar
    fv12: { 1: 0, 2: 0, 3: 0 }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    const dateStr = cols[0];
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) continue;

    const dateParts = dateStr.split(' ')[0].split('/');
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const year = parseInt(dateParts[2]);

    // Only process 2025 data for Jan, Feb, Mar
    if (year !== 2025 || month > 3) continue;

    // Col 1: Normal (Impianto 0), Col 5: FV12 (Energia totale)
    const normalVal = parseFloat(cols[1]) || 0;
    const fv12Val = parseFloat(cols[5]) || 0;

    monthly.normal[month] += normalVal;
    monthly.fv12[month] += fv12Val;
  }

  return monthly;
}

function parsePVCsv(csvText) {
  const lines = csvText.split('\n');
  const yearly = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    const dateStr = cols[0];
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) continue;

    const dateParts = dateStr.split(' ')[0].split('/');
    const year = parseInt(dateParts[2]);

    if (isNaN(year)) continue;

    if (!yearly[year]) {
      yearly[year] = { normal: 0, fv12: 0 };
    }

    // Col 1: Normal (Impianto 0)
    // Col 5: FV12 (Energia totale)
    const normalVal = parseFloat(cols[1]) || 0;
    const fv12Val = parseFloat(cols[5]) || 0;

    yearly[year].normal += normalVal;
    yearly[year].fv12 += fv12Val;
  }

  return yearly;
}

function processData(summary, forecast, pvMonthly2025, pvForecast2026) {
  const meta = summary.meta || {};
  const gridFactor = meta.grid_emission_factor_kg_per_kwh || 0.33;
  const gasFactor = meta.methane_emission_factor_kg_per_smc || 1.9;

  // Get gas consumption from monthly_summary for 2024 and 2025
  const historyByYear = {};
  (summary.data || []).forEach(row => {
    if (!historyByYear[row.year]) {
      historyByYear[row.year] = { gas_smc: 0 };
    }
    historyByYear[row.year].gas_smc += row.gas_coge_smc || 0;
  });

  // VERIFIED DATA for 2024 (full year)
  const data2024 = {
    normal: {
      grid_kwh: 2694453,
      pv_kwh: 169534,
      coge_kwh: 1936721
    },
    fv12: {
      grid_kwh: 2327417,
      pv_kwh: 533460,
      coge_kwh: 1936721
    }
  };

  // 2025 PROJECTION: Gen-Set (9 mesi) + Gen-Feb-Mar duplicati per Ott-Nov-Dic
  const data2025_9months = {
    normal: {
      grid_kwh: 2493214,
      pv_kwh: 158633,
      coge_kwh: 1177452
    },
    fv12: {
      grid_kwh: 2176475,
      pv_kwh: 463654,
      coge_kwh: 1177452
    }
  };

  // Calculate PV for Oct-Nov-Dec by duplicating Jan-Feb-Mar
  const pvOctNovDec = {
    normal: pvMonthly2025.normal[1] + pvMonthly2025.normal[2] + pvMonthly2025.normal[3],
    fv12: pvMonthly2025.fv12[1] + pvMonthly2025.fv12[2] + pvMonthly2025.fv12[3]
  };

  // Full year 2025 projection
  const data2025 = {
    normal: {
      grid_kwh: Math.round((data2025_9months.normal.grid_kwh / 9) * 12),
      pv_kwh: Math.round(data2025_9months.normal.pv_kwh + pvOctNovDec.normal),
      coge_kwh: Math.round((data2025_9months.normal.coge_kwh / 9) * 12)
    },
    fv12: {
      grid_kwh: Math.round((data2025_9months.fv12.grid_kwh / 9) * 12),
      pv_kwh: Math.round(data2025_9months.fv12.pv_kwh + pvOctNovDec.fv12),
      coge_kwh: Math.round((data2025_9months.fv12.coge_kwh / 9) * 12)
    }
  };

  // Process 2024
  const gas2024 = historyByYear[2024]?.gas_smc || 0;
  const co2_normal_2024 = (data2024.normal.grid_kwh * gridFactor) + (gas2024 * gasFactor);
  const delta_pv_2024 = data2024.fv12.pv_kwh - data2024.normal.pv_kwh;
  const co2_avoided_2024 = delta_pv_2024 * gridFactor;
  const co2_fv12_2024 = Math.max(co2_normal_2024 - co2_avoided_2024, 0);

  // Process 2025 (with projection)
  const gas2025_9months = historyByYear[2025]?.gas_smc || 0;
  const gas2025_projected = Math.round((gas2025_9months / 9) * 12);

  const co2_normal_2025 = (data2025.normal.grid_kwh * gridFactor) + (gas2025_projected * gasFactor);
  const delta_pv_2025 = data2025.fv12.pv_kwh - data2025.normal.pv_kwh;
  const co2_avoided_2025 = delta_pv_2025 * gridFactor;
  const co2_fv12_2025 = Math.max(co2_normal_2025 - co2_avoided_2025, 0);

  const processedYears = [
    {
      year: 2024,
      isForecast: false,
      isProjected: false,

      grid_kwh: data2024.normal.grid_kwh,
      gas_smc: gas2024,
      pv_normal_kwh: data2024.normal.pv_kwh,
      pv_fv12_kwh: data2024.fv12.pv_kwh,

      normal_kg: co2_normal_2024,
      avoided_kg: co2_avoided_2024,
      fv12_kg: co2_fv12_2024,

      grid_factor: gridFactor,
      gas_factor: gasFactor
    },
    {
      year: 2025,
      isForecast: false,
      isProjected: true,

      grid_kwh: data2025.normal.grid_kwh,
      gas_smc: gas2025_projected,
      pv_normal_kwh: data2025.normal.pv_kwh,
      pv_fv12_kwh: data2025.fv12.pv_kwh,

      normal_kg: co2_normal_2025,
      avoided_kg: co2_avoided_2025,
      fv12_kg: co2_fv12_2025,

      grid_factor: gridFactor,
      gas_factor: gasFactor
    }
  ];

  // 3. Process Forecast (2026)
  // Use data from forecast_2026.json directly
  const fTotals = forecast.meta?.totals || {};

  // If forecast totals are missing, sum from months
  let fGrid = fTotals.ee_grid_kwh || 0;
  let fGas = fTotals.gas_coge_smc || 0;

  if (fGrid === 0 && forecast.months) {
    forecast.months.forEach(m => {
      fGrid += m.ee_grid_kwh || 0;
      fGas += m.gas_coge_smc || 0;
    });
  }

  // Calculate PV 2026 from the specific forecast file
  let pvNormal2026 = 0;
  let pvFV122026 = 0;

  if (Array.isArray(pvForecast2026)) {
    pvForecast2026.forEach(row => {
      pvNormal2026 += row.imp0_kwh || 0;
      pvFV122026 += row.tot_kwh || 0;
    });
  }

  const co2_normal_2026 = (fGrid * gridFactor) + (fGas * gasFactor);
  const delta_pv_2026 = Math.max(pvFV122026 - pvNormal2026, 0);
  const co2_avoided_2026 = delta_pv_2026 * gridFactor;
  const co2_fv12_2026 = Math.max(co2_normal_2026 - co2_avoided_2026, 0);

  const forecastData = {
    year: 2026,
    isForecast: true,

    grid_kwh: fGrid,
    gas_smc: fGas,
    pv_normal_kwh: pvNormal2026,
    pv_fv12_kwh: pvFV122026,

    normal_kg: co2_normal_2026,
    avoided_kg: co2_avoided_2026,
    fv12_kg: co2_fv12_2026,

    grid_factor: gridFactor,
    gas_factor: gasFactor
  };

  return [...processedYears, forecastData];
}

function calculateTotalStats(yearlyData) {
  return yearlyData.reduce((acc, curr) => {
    acc.totalNormal += curr.normal_kg;
    acc.totalFV12 += curr.fv12_kg;
    acc.totalAvoided += curr.avoided_kg;
    acc.totalPV += curr.pv_fv12_kwh;
    return acc;
  }, { totalNormal: 0, totalFV12: 0, totalAvoided: 0, totalPV: 0 });
}

function renderYearlyCards(data) {
  const container = document.getElementById("yearly-grid");

  container.innerHTML = data.map(y => {
    let badgeClass = "";
    let badgeText = "Storico";
    let badgeTooltip = "Dati reali verificati per l'intero anno solare";

    if (y.isForecast) {
      badgeClass = "forecast";
      badgeText = "Forecast";
      badgeTooltip = "Previsioni basate su modelli di consumo energetico e produzione fotovoltaica stimata per il 2026";
    } else if (y.isProjected) {
      badgeClass = "projected";
      badgeText = "Proiezione";
      badgeTooltip = "Dati Gen-Set (9 mesi) + proiezione: Grid/Gas media mensile×12, Fotovoltaico 9 mesi + Gen-Feb-Mar duplicati per Ott-Nov-Dic";
    }

    return `
    <article class="year-card">
      <div class="year-header">
        <h3>${y.year}</h3>
        <span class="year-badge ${badgeClass}" data-tooltip="${badgeTooltip}">${badgeText} ⓘ</span>
      </div>
      <div class="year-body">
        <div class="consumption-grid">
           <div class="cons-item">
             <span class="cons-label" data-tooltip="Energia elettrica acquistata dalla rete nazionale">Rete (kWh) ⓘ</span>
             <span class="cons-val">${intFormatter.format(y.grid_kwh)}</span>
           </div>
           <div class="cons-item">
             <span class="cons-label" data-tooltip="Gas metano consumato dal cogeneratore per produrre energia elettrica e termica">Gas (Smc) ⓘ</span>
             <span class="cons-val">${intFormatter.format(y.gas_smc)}</span>
           </div>
           <div class="cons-item">
             <span class="cons-label" data-tooltip="Produzione fotovoltaica scenario base (solo Impianto 0)">Fotovoltaico standard ⓘ</span>
             <span class="cons-val">${intFormatter.format(y.pv_normal_kwh)}</span>
           </div>
           <div class="cons-item">
             <span class="cons-label" data-tooltip="Produzione fotovoltaica scenario ottimizzato (3 impianti: Impianto 0 + 2 aggiuntivi)">Fotovoltaico (3 impianti) ⓘ</span>
             <span class="cons-val text-fv12">${intFormatter.format(y.pv_fv12_kwh)}</span>
           </div>
        </div>
        
        <hr class="card-divider">

        <div class="comparison-row">
          <span class="comp-label" data-tooltip="Emissioni CO₂ totali scenario Normal: (Grid kWh × 0,33) + (Gas Smc × 1,9) kg CO₂">CO₂ Normal ⓘ</span>
          <span class="comp-value normal">${decimalFormatter.format(y.normal_kg / 1000)} t</span>
        </div>
        <div class="comparison-row">
          <span class="comp-label" data-tooltip="Emissioni CO₂ scenario FV12 (3 impianti): Normal - CO₂ evitata grazie ai 2 impianti aggiuntivi">CO₂ FV12 ⓘ</span>
          <span class="comp-value fv12">${decimalFormatter.format(y.fv12_kg / 1000)} t</span>
        </div>
        
        <div class="savings-highlight">
          <span class="savings-label" data-tooltip="Emissioni evitate grazie ai 2 impianti fotovoltaici aggiuntivi: (PV FV12 - PV Normal) × 0,33 kg CO₂/kWh">CO₂ Risparmiata ⓘ</span>
          <span class="savings-value">-${decimalFormatter.format(y.avoided_kg / 1000)} t</span>
        </div>
      </div>
    </article>
  `}).join("");
}

function renderEquivalents(totalAvoidedKg) {
  const container = document.getElementById("equivalents-grid");
  const totalEl = document.getElementById("impact-total-co2");

  if (totalEl) {
    totalEl.textContent = decimalFormatter.format(totalAvoidedKg / 1000);
  }

  const TREE_KG = 20;
  const CAR_KG = 0.15;
  const HOUSE_KG = 2700;

  const trees = Math.round(totalAvoidedKg / TREE_KG);
  const carKm = Math.round(totalAvoidedKg / CAR_KG);
  const houses = (totalAvoidedKg / HOUSE_KG).toFixed(1);

  const items = [
    { icon: "🌳", value: intFormatter.format(trees), label: "Alberi equivalenti" },
    { icon: "🚗", value: intFormatter.format(carKm), label: "Km in auto evitati" },
    { icon: "🏡", value: houses, label: "Famiglie a zero emissioni" }
  ];

  container.innerHTML = items.map(item => `
    <div class="eq-card">
      <span class="eq-icon">${item.icon}</span>
      <span class="eq-value">${item.value}</span>
      <span class="eq-label">${item.label}</span>
    </div>
  `).join("");
}

// ============================================
// GSAP ANIMATIONS - Counter Only
// ============================================

function initGSAPAnimations(totalAvoidedKg) {
  // Only animated counters
  if (typeof gsap !== 'undefined') {
    animateHeaderKPI(totalAvoidedKg);
    animateAllNumbers();
  }
}

// Animated Counter for Header KPI
function animateHeaderKPI(totalAvoidedKg) {
  const kpiElement = document.getElementById("total-saved-kpi");
  if (!kpiElement) return;

  const targetValue = totalAvoidedKg / 1000;
  const counterObj = { value: 0 };

  gsap.to(counterObj, {
    value: targetValue,
    duration: 2,
    ease: "power2.out",
    onUpdate: function () {
      kpiElement.textContent = `${decimalFormatter.format(counterObj.value)} t`;
    }
  });
}

// Animate all numbers on the page
function animateAllNumbers() {
  // Animate numbers in year cards
  const yearCards = document.querySelectorAll('.year-card');
  yearCards.forEach(card => animateCardNumbers(card));

  // Animate numbers in equivalent cards
  const eqCards = document.querySelectorAll('.eq-card');
  eqCards.forEach(card => animateEquivalentCardNumbers(card));
}

function parseItalianNumber(text) {
  // Extract first numeric token including thousand separators and decimals
  const match = text.match(/-?[\d.,]+/);
  if (!match) return null;

  const raw = match[0];
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);

  if (isNaN(value)) return null;

  return {
    value,
    hasDecimal: raw.includes(','),
    raw
  };
}

// Animate numbers inside year cards
function animateCardNumbers(card) {
  const numberElements = card.querySelectorAll('.cons-val, .comp-value, .savings-value');

  numberElements.forEach(el => {
    const text = el.textContent.trim();
    const parsed = parseItalianNumber(text);
    if (!parsed) return;

    const { value: targetValue, hasDecimal, raw } = parsed;
    const counterObj = { value: 0 };
    const unit = text.replace(raw, '').trim();

    gsap.to(counterObj, {
      value: targetValue,
      duration: 1.5,
      ease: "power2.out",
      onUpdate: function () {
        const formattedValue = hasDecimal
          ? decimalFormatter.format(counterObj.value)
          : intFormatter.format(Math.round(counterObj.value));
        el.textContent = unit ? `${formattedValue} ${unit}` : formattedValue;
      }
    });
  });
}

// Animate numbers in equivalent cards
function animateEquivalentCardNumbers(card) {
  const valueEl = card.querySelector('.eq-value');
  if (!valueEl) return;

  const text = valueEl.textContent.trim();
  const numStr = text.replace(/\./g, '').replace(/,/g, '.');  // Handle Italian format
  const targetValue = parseFloat(numStr);

  if (!isNaN(targetValue)) {
    const counterObj = { value: 0 };
    // Check if it's actually a decimal (less than 100 is a good heuristic for families count)
    const isDecimal = targetValue < 100 && text.includes(',');

    gsap.to(counterObj, {
      value: targetValue,
      duration: 1.5,
      ease: "power2.out",
      onUpdate: function () {
        valueEl.textContent = isDecimal
          ? counterObj.value.toFixed(1)
          : intFormatter.format(Math.round(counterObj.value));
      }
    });
  }
}
