// Pagina MILP - lettura dei risultati dalla cartella "risultati milp"
(function () {
    const DEFAULT_HORIZON = 'hourly';
    const FOLDER_NAME = 'risultati milp';
    const YEARS = ['2024', '2025'];
    const CUTOFF = { year: 2025, month: 9 }; // includi fino a settembre 2025
    const HORIZON_LABELS = {
        hourly: 'Orario',
        daily: 'Giornaliero',
        weekly: 'Settimanale',
        monthly: 'Mensile'
    };

    let currentHorizon = DEFAULT_HORIZON;
    let chartsReady = false;

    const formatNumber = (num, decimals = 0) => {
        if (!isFinite(num)) return '-';
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const safeDivide = (num, den) => (den ? num / den : 0);

    const parseNumber = (value) => {
        if (value === null || value === undefined) return 0;
        const cleaned = String(value).replace(/\./g, '').replace(',', '.').trim();
        const n = Number(cleaned);
        return isFinite(n) ? n : 0;
    };

    const showError = (message) => {
        const el = document.getElementById('ai-error');
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
    };

    const hideError = () => {
        const el = document.getElementById('ai-error');
        if (el) el.style.display = 'none';
    };

    const ensureCharts = () => {
        if (!chartsReady && typeof initChartRenderer === 'function') {
            initChartRenderer();
            chartsReady = true;
        }
    };

    const fetchText = async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} nel caricamento ${url}`);
        }
        return await response.text();
    };

    const parseTimestamp = (ts) => {
        const [date, time] = (ts || '').split(' ');
        const [year, month, day] = (date || '').split('-');
        const [hour] = (time || '').split(':');
        return {
            year: year || '',
            month: month || '',
            day: day || '',
            hour: hour || '00'
        };
    };

    function parseCsv(text) {
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        lines.shift(); // header

        return lines.map(line => {
            const parts = line.split(';');
            const timestamp = parts[1] || '';
            const ts = parseTimestamp(timestamp);

            return {
                timestamp,
                year: ts.year,
                month: ts.month,
                day: ts.day,
                hour: ts.hour,
                demand: parseNumber(parts[2]),
                thermal: parseNumber(parts[3]),
                origCost: parseNumber(parts[5]),
                coge: parseNumber(parts[6]),
                status: parts[7] || '',
                boiler: parseNumber(parts[8]),
                gridBuy: parseNumber(parts[9]),
                gridSell: parseNumber(parts[10]),
                optCost: parseNumber(parts[11]),
                savings: parseNumber(parts[12])
            };
        });
    }

    const buildBaseCandidates = () => {
        const encoded = encodeURIComponent(FOLDER_NAME);
        return [
            `./${encoded}`,
            `../${encoded}`,
            `../../${encoded}`,
            `/${encoded}`
        ];
    };

    async function loadDataset(horizon) {
        const bases = buildBaseCandidates();
        let lastError = null;

        for (const base of bases) {
            const collectedRows = [];
            const reports = [];

            for (const year of YEARS) {
                const prefix = `${base}/${year}/${horizon}`;
                try {
                    const [csvText, reportText] = await Promise.all([
                        fetchText(`${prefix}/risultato_ottimizzazione.csv`),
                        fetchText(`${prefix}/report.txt`).catch(() => '')
                    ]);

                    const parsed = parseCsv(csvText).filter(row => {
                        const y = Number(row.year);
                        const m = Number(row.month);
                        if (Number.isNaN(y) || Number.isNaN(m)) return false;
                        if (y < CUTOFF.year) return true;
                        if (y === CUTOFF.year) return m <= CUTOFF.month;
                        return false;
                    });

                    collectedRows.push(...parsed);
                    reports.push({ year, text: reportText });
                } catch (error) {
                    lastError = error;
                    continue;
                }
            }

            if (collectedRows.length > 0) {
                return {
                    rows: collectedRows,
                    report: reports,
                    basePath: base
                };
            }
        }

        throw lastError || new Error('Impossibile individuare i dati MILP.');
    }

    function buildAggregates(rows) {
        const monthlyBuckets = new Map();
        const years = new Set();

        const hourlyProfile = Array.from({ length: 24 }, () => ({
            demand: 0,
            autoprod: 0,
            buy: 0,
            count: 0
        }));

        const totals = {
            demand: 0,
            buy: 0,
            sell: 0,
            coge: 0,
            autoprodUsed: 0,
            autoprodCoge: 0,
            autoprodPv: 0,
            origCost: 0,
            optCost: 0,
            savings: 0
        };

        rows.forEach(entry => {
            const year = String(entry.year || '').padStart(4, '0');
            const month = String(entry.month || '').padStart(2, '0');
            const key = `${year}-${month}`;
            years.add(year);

            const demand = entry.demand;
            const buy = entry.gridBuy;
            const coge = entry.coge;
            const sell = entry.gridSell;
            const origCost = entry.origCost;
            const optCost = entry.optCost;
            const savings = entry.savings;

            const hourIdx = Number(entry.hour);

            const rawAutoprod = Math.max(0, demand - buy);
            const autoprodCoge = Math.min(rawAutoprod, coge, demand);
            const autoprodPv = Math.max(0, demand - buy - autoprodCoge); // quota virtuale per coprire il fabbisogno
            const autoprodUsed = Math.min(demand, autoprodCoge + autoprodPv);

            totals.demand += demand;
            totals.buy += buy;
            totals.sell += sell;
            totals.coge += coge;
            totals.autoprodUsed += autoprodUsed;
            totals.autoprodCoge += autoprodCoge;
            totals.autoprodPv += autoprodPv;
            totals.origCost += origCost;
            totals.optCost += optCost;
            totals.savings += savings;

            if (!monthlyBuckets.has(key)) {
                monthlyBuckets.set(key, {
                    year,
                    month,
                    demand: 0,
                    buy: 0,
                    sell: 0,
                    coge: 0,
                    autoprodUsed: 0,
                    autoprodCoge: 0,
                    autoprodPv: 0,
                    origCost: 0,
                    optCost: 0,
                    savings: 0
                });
            }
            const m = monthlyBuckets.get(key);
            m.demand += demand;
            m.buy += buy;
            m.sell += sell;
            m.coge += coge;
            m.autoprodUsed += autoprodUsed;
            m.autoprodCoge += autoprodCoge;
            m.autoprodPv += autoprodPv;
            m.origCost += origCost;
            m.optCost += optCost;
            m.savings += savings;

            if (hourIdx >= 0 && hourIdx < 24) {
                const h = hourlyProfile[hourIdx];
                h.demand += demand;
                h.autoprod += autoprodUsed;
                h.buy += buy;
                h.count += 1;
            }
        });

        const sortedMonths = Array.from(monthlyBuckets.values()).sort((a, b) => {
            if (a.year === b.year) return Number(a.month) - Number(b.month);
            return Number(a.year) - Number(b.year);
        });

        const monthLabels = sortedMonths.map(m => {
            const monthIdx = Number(m.month) - 1;
            const monthName = (CONFIG && CONFIG.labels && CONFIG.labels.mesi && CONFIG.labels.mesi[monthIdx]) ? CONFIG.labels.mesi[monthIdx] : m.month;
            return `${monthName} ${m.year}`;
        });

        const monthlySeries = {
            labels: monthLabels,
            demand: sortedMonths.map(m => m.demand),
            autoprodCoge: sortedMonths.map(m => m.autoprodCoge),
            autoprodPv: sortedMonths.map(m => m.autoprodPv),
            buy: sortedMonths.map(m => m.buy),
            optCost: sortedMonths.map(m => m.optCost),
            origCost: sortedMonths.map(m => m.origCost),
            savings: sortedMonths.map(m => m.savings)
        };

        hourlyProfile.forEach(h => {
            if (h.count > 0) {
                h.demand = h.demand / h.count;
                h.autoprod = h.autoprod / h.count;
                h.buy = h.buy / h.count;
            }
        });

        totals.autoprodShare = safeDivide(totals.autoprodUsed, totals.demand) * 100;
        totals.savingsShare = safeDivide(totals.savings, totals.origCost) * 100;

        const yearsSorted = Array.from(years).sort();

        return {
            monthlySeries,
            hourlyProfile,
            totals,
            years: yearsSorted,
            totalHours: rows.length
        };
    }

    function renderKPIs(totals) {
        const set = (id, value, decimals = 0) => {
            const el = document.getElementById(id);
            if (el) el.textContent = formatNumber(value, decimals);
        };

        set('kpi-total-demand', totals.demand);
        set('kpi-autoprod', totals.autoprodUsed);
        set('kpi-autoprod-share', totals.autoprodShare, 1);
        set('kpi-grid-buy', totals.buy);
        set('kpi-savings', totals.savings);
        set('kpi-savings-share', totals.savingsShare, 1);
        set('kpi-total-cost', totals.optCost);
        set('kpi-orig-cost', totals.origCost);
    }

    function renderProcessInsights(totals, totalHours) {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        const formatMoney = (value) => `€ ${formatNumber(value, 0)}`;

        setText('milp-process-autoprod', `${formatNumber(totals.autoprodShare, 1)}%`);
        setText('milp-process-savings', `${formatNumber(totals.savingsShare, 1)}%`);
        setText('milp-process-hours', `${formatNumber(totalHours, 0)} righe`);
        setText('milp-process-demand', `${formatNumber(totals.demand, 0)} kWh`);
        setText('milp-process-grid', `${formatNumber(totals.buy, 0)} kWh`);
        setText('milp-process-coge', `${formatNumber(totals.autoprodCoge, 0)} kWh`);
        setText('milp-process-orig', formatMoney(totals.origCost));
        setText('milp-process-opt', formatMoney(totals.optCost));

        const delta = totals.origCost - totals.optCost;
        const deltaLabel = delta >= 0 ? `Risparmio: € ${formatNumber(delta, 0)}` : `Extra costo: € ${formatNumber(Math.abs(delta), 0)}`;
        setText('milp-process-delta', deltaLabel);

        setText('hero-autoprod-share', `${formatNumber(totals.autoprodShare, 1)}%`);
        setText('hero-savings-share', `${formatNumber(totals.savingsShare, 1)}%`);
        setText('hero-demand', `${formatNumber(totals.demand, 0)} kWh`);
        setText('hero-grid', `${formatNumber(totals.buy, 0)} kWh`);
        setText('hero-coge', `${formatNumber(totals.autoprodCoge, 0)} kWh`);

        setText('summary-autoprod-share', `${formatNumber(totals.autoprodShare, 1)}%`);
        setText('summary-savings-share', `${formatNumber(totals.savingsShare, 1)}%`);
        setText('summary-demand', `${formatNumber(totals.demand, 0)} kWh`);
        setText('summary-grid', `${formatNumber(totals.buy, 0)} kWh`);
        setText('summary-coge', `${formatNumber(totals.autoprodCoge, 0)} kWh`);
        setText('summary-optcost', formatMoney(totals.optCost));
        setText('summary-origcost', formatMoney(totals.origCost));
        setText('summary-delta', deltaLabel);
    }

    function renderEnergyMix(monthlySeries) {
        const data = {
            labels: monthlySeries.labels,
            consumi: {
                ee_coge: monthlySeries.autoprodCoge,
                ee_fv: monthlySeries.autoprodPv,
                ee_acquistata: monthlySeries.buy
            },
            fabbisogni: {
                ee: monthlySeries.demand
            }
        };
        chartRenderer.drawAreaChart('ai-energy-mix', data, 'ai-energy-mix-legend');
    }

    function renderCostChart(monthlySeries) {
        const data = { labels: monthlySeries.labels };

        const bars = {
            data: monthlySeries.optCost,
            color: '#0ea5e9',
            label: 'Costo ottimizzato'
        };

        const lines = [
            { data: monthlySeries.origCost, color: '#ef4444', label: 'Costo storico' },
            { data: monthlySeries.savings, color: '#10b981', label: 'Risparmio' }
        ];

        chartRenderer.drawBarChartWithLines('ai-costs-chart', data, 'ai-costs-legend', bars, lines, '€');
    }

    function renderHourlyProfile(hourlyProfile) {
        const labels = hourlyProfile.map((_, i) => `${String(i).padStart(2, '0')}:00`);
        const data = { labels };

        const bars = {
            data: hourlyProfile.map(h => h.demand),
            color: '#6366f1',
            label: 'Domanda media (kWh)'
        };

        const lines = [
            { data: hourlyProfile.map(h => h.autoprod), color: '#22c55e', label: 'Autoproduzione coge' },
            { data: hourlyProfile.map(h => h.buy), color: '#ef4444', label: 'Acquisto rete' }
        ];

        chartRenderer.drawBarChartWithLines('ai-hourly-profile', data, 'ai-hourly-legend', bars, lines);
    }

    function renderMeta(years, totalHours) {
        const rangeEl = document.getElementById('milp-dataset-range');
        const rangeHeroEl = document.getElementById('milp-dataset-range-hero');
        const heroHorizonEl = document.getElementById('hero-horizon');
        const heroHoursEl = document.getElementById('hero-hours');
        if (rangeEl && years.length) {
            const first = years[0];
            const last = years[years.length - 1];
            const horizonLabel = HORIZON_LABELS[currentHorizon] || currentHorizon;
            const yearLabel = years.length > 1 ? `${first}-${last}` : first;
            rangeEl.textContent = `Dataset MILP ${yearLabel} · ${horizonLabel.toLowerCase()}`;
        }
        if (rangeHeroEl && years.length) {
            const first = years[0];
            const last = years[years.length - 1];
            const horizonLabel = HORIZON_LABELS[currentHorizon] || currentHorizon;
            const yearLabel = years.length > 1 ? `${first}-${last}` : first;
            rangeHeroEl.textContent = `${yearLabel} · ${horizonLabel.toLowerCase()}`;
        }
        const hoursEl = document.getElementById('milp-hours-pill');
        if (hoursEl) {
            const horizonLabel = HORIZON_LABELS[currentHorizon] || currentHorizon;
            hoursEl.textContent = `${formatNumber(totalHours, 0)} righe ${horizonLabel.toLowerCase()}`;
        }
        if (heroHoursEl) {
            heroHoursEl.textContent = formatNumber(totalHours, 0);
        }
        if (heroHorizonEl) {
            const horizonLabel = HORIZON_LABELS[currentHorizon] || currentHorizon;
            heroHorizonEl.textContent = horizonLabel;
        }
    }

    function updateMaterials(basePath, horizon, reportChunks) {
        const availableYears = reportChunks.map(r => r.year).filter(Boolean);
        const latestYear = availableYears.length ? availableYears.sort()[availableYears.length - 1] : '';
        const prefix = latestYear ? `${basePath}/${latestYear}/${horizon}` : `${basePath}/${horizon}`;

        const listEl = document.getElementById('milp-datasets-list');
        const countEl = document.getElementById('milp-datasets-count');
        if (listEl) {
            listEl.innerHTML = '';
            const ordered = [...reportChunks].sort((a, b) => Number(a.year) - Number(b.year));
            if (ordered.length === 0) {
                listEl.innerHTML = '<p class="page-note">Nessun dataset trovato per l\'orizzonte selezionato.</p>';
            } else {
                ordered.forEach(r => {
                    const year = r.year || 'Dataset';
                    const row = document.createElement('div');
                    row.className = 'materials-dataset';

                    const info = document.createElement('div');
                    info.className = 'materials-dataset__info';
                    const title = document.createElement('div');
                    title.className = 'materials-dataset__title';
                    title.textContent = `MILP ${year}`;
                    const subtitle = document.createElement('div');
                    subtitle.className = 'materials-dataset__subtitle';
                    subtitle.textContent = `${HORIZON_LABELS[horizon] || horizon} • CSV + report`;
                    info.appendChild(title);
                    info.appendChild(subtitle);

                    const actions = document.createElement('div');
                    actions.className = 'materials-dataset__actions';
                    const csvLink = document.createElement('a');
                    csvLink.className = 'ghost-link';
                    csvLink.href = `${basePath}/${year}/${horizon}/risultato_ottimizzazione.csv`;
                    csvLink.target = '_blank';
                    csvLink.rel = 'noopener';
                    csvLink.textContent = 'CSV';
                    const repLink = document.createElement('a');
                    repLink.className = 'ghost-link';
                    repLink.href = `${basePath}/${year}/${horizon}/report.txt`;
                    repLink.target = '_blank';
                    repLink.rel = 'noopener';
                    repLink.textContent = 'Report';
                    actions.appendChild(csvLink);
                    actions.appendChild(repLink);

                    row.appendChild(info);
                    row.appendChild(actions);
                    listEl.appendChild(row);
                });
            }
        }
        if (countEl) {
            countEl.textContent = `${reportChunks.length || 0} dataset`;
        }

        const reportEl = document.getElementById('milp-report');
        if (reportEl) {
            if (reportChunks.length === 0) {
                reportEl.textContent = 'Report non disponibile per la selezione corrente.';
            } else {
                reportEl.textContent = reportChunks.map(r => `=== ${r.year} ===\n${r.text || 'Report non disponibile.'}`).join('\n\n');
            }
        }

        const csvLink = document.getElementById('milp-csv-link');
        if (csvLink) {
            csvLink.href = `${prefix}/risultato_ottimizzazione.csv`;
        }

        const reportLink = document.getElementById('milp-report-link');
        if (reportLink) {
            reportLink.href = `${prefix}/report.txt`;
        }

    }

    async function refresh() {
        hideError();
        try {
            const { rows, report, basePath } = await loadDataset(currentHorizon);
            const aggregates = buildAggregates(rows);

            renderKPIs(aggregates.totals);
            renderProcessInsights(aggregates.totals, aggregates.totalHours);
            renderMeta(aggregates.years, aggregates.totalHours);
            updateMaterials(basePath, currentHorizon, report);

            const ts = document.getElementById('ai-last-update');
            if (ts) ts.textContent = new Date().toLocaleString('it-IT');
        } catch (error) {
            console.error('Errore caricamento MILP:', error);
            showError('Impossibile caricare i risultati MILP selezionati.');
        }
    }

    function initSelectors() {
        const horizonSelect = document.getElementById('milp-horizon-select');

        if (horizonSelect) {
            currentHorizon = horizonSelect.value || DEFAULT_HORIZON;
            horizonSelect.addEventListener('change', () => {
                currentHorizon = horizonSelect.value;
                refresh();
            });
        }
    }

    function init() {
        initSelectors();
        refresh();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
