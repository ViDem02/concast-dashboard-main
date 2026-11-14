// Stats Page Controller - Statistiche giornaliere Fabbisogno Elettrico

(function() {
	function formatNumber(num, decimals = 0) {
		if (typeof num !== 'number' || isNaN(num)) return '-';
		return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	}

	function median(values) {
		if (!values.length) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	}

	function percentile(values, p) {
		if (!values.length) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const idx = (sorted.length - 1) * p;
		const low = Math.floor(idx);
		const high = Math.ceil(idx);
		if (low === high) return sorted[low];
		return sorted[low] * (high - idx) + sorted[high] * (idx - low);
	}

	function stddev(values) {
		if (!values.length) return 0;
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
		return Math.sqrt(variance);
	}

	function dayNameFromDate(date) {
		return ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][date.getDay()];
	}

	function parseDMY(dateStr) {
		// "dd/mm/yyyy" -> { d, m, y }
		const [d, m, y] = dateStr.split('/').map(x => parseInt(x, 10));
		return { d, m, y };
	}

	function dayOfYear(y, m, d) {
		const start = new Date(y, 0, 1);
		const current = new Date(y, m - 1, d);
		const diff = (current - start) / (1000 * 60 * 60 * 24);
		return Math.floor(diff) + 1;
	}

	// Calcola un fattore di dilatazione stagionale ondulato (coseno annuale)
	// Obiettivo: picco (estate ~ luglio) porta il Venerdì a 19; minimo (metà gennaio) porta il Venerdì a 14
	function seasonalFactorForDOY(baseFridayMean, doy) {
		if (!baseFridayMean || baseFridayMean <= 0) return 1;
		const factorPeak = 19 / baseFridayMean;   // estate
		const factorTrough = 14 / baseFridayMean; // metà gennaio
		const A = (factorPeak - factorTrough) / 2;
		const C = (factorPeak + factorTrough) / 2;
		// Allinea il massimo a ~ giornata 205 (fine luglio), minimo a ~ giorno 22 (metà gennaio)
		const phase = 205;
		const twoPi = Math.PI * 2;
		return C + A * Math.cos(twoPi * ((doy - phase) / 365));
	}

	async function init() {
		// Init processors/renderers from existing modules
		initDataProcessor();
		initChartRenderer();

		// Load all data (preloads normal + fv12). Default to normal.
		await dataLoader.loadAll(false);
		dataProcessor.setFVOptimized(false);

		// Populate and render
		await renderAll();

		// Version toggle
		document.getElementById('stats-version-select').addEventListener('change', async (e) => {
			const val = e.target.value;
			dataLoader.switchVersion(val === 'fv12');
			dataProcessor.setFVOptimized(val === 'fv12');
			await renderAll();
		});
	}

	function computeDailyFabbisogno() {
		const years = dataLoader.getAvailableYears();
		const daily = []; // { dateStr, year, dayName, value, hoursCount }
        const threshold = new Date(2024, 9, 10); // 10 Ott 2024 (mese 9)

		years.forEach(year => {
			const months = dataLoader.getAvailableMonths(year);
			months.forEach(month => {
				const monthData = dataLoader.getMonthData(year, month);
				const days = Object.keys(monthData.elaborazione || {}).sort((a, b) => parseInt(a) - parseInt(b));
					days.forEach(day => {
					let sum = 0;
						const hours = Object.keys(monthData.elaborazione[day] || {}).sort((a, b) => parseInt(a) - parseInt(b));
					hours.forEach(hour => {
						const fabb = monthData.elaborazione[day][hour]?.fabbisogno_ee_azienda_kwh || 0;
						sum += fabb;
					});
					const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
						if (d < threshold) {
							return; // salta giorni prima del 10/10/2024
						}
					daily.push({
						dateStr: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
						year: year,
						dayName: dayNameFromDate(d),
							value: sum,
							hoursCount: hours.length
					});
				});
			});
		});

		// Sort by date chronological
		daily.sort((a, b) => {
			const [da, ma, ya] = a.dateStr.split('/');
			const [db, mb, yb] = b.dateStr.split('/');
			const ta = new Date(parseInt(ya), parseInt(ma) - 1, parseInt(da)).getTime();
			const tb = new Date(parseInt(yb), parseInt(mb) - 1, parseInt(db)).getTime();
			return ta - tb;
		});
		return daily;
	}

	function computeStats(values) {
		const arr = [...values];
		if (!arr.length) return null;
		const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
		return {
			mean,
			median: median(arr),
			std: stddev(arr),
			min: Math.min(...arr),
			max: Math.max(...arr),
			p10: percentile(arr, 0.10),
			p25: percentile(arr, 0.25),
			p75: percentile(arr, 0.75),
			p90: percentile(arr, 0.90)
		};
	}

	function renderKPIs(stats) {
		document.getElementById('kpi-media').textContent = formatNumber(stats.mean, 0);
		document.getElementById('kpi-mediana').textContent = formatNumber(stats.median, 0);
		document.getElementById('kpi-std').textContent = formatNumber(stats.std, 0);
		document.getElementById('kpi-min').textContent = formatNumber(stats.min, 0);
		document.getElementById('kpi-max').textContent = formatNumber(stats.max, 0);
		document.getElementById('last-update').textContent = new Date().toLocaleString('it-IT');
	}

	function renderDailyTable(rows) {
		const body = document.getElementById('table-daily-body');
		body.innerHTML = '';
		rows.forEach(r => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${r.dateStr}</td>
				<td>${r.year}</td>
				<td>${r.dayName}</td>
				<td style="text-align:right">${r.hoursCount}</td>
				<td style="text-align:right">${formatNumber(r.value, 0)}</td>
			`;
			body.appendChild(tr);
		});
	}

	function renderDowTable(rows) {
		const byDow = {
			'Dom': [], 'Lun': [], 'Mar': [], 'Mer': [], 'Gio': [], 'Ven': [], 'Sab': []
		};
		rows.forEach(r => byDow[r.dayName]?.push(r.value));

		const order = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
		const body = document.getElementById('table-dow-body');
		body.innerHTML = '';
		order.forEach(dn => {
			const vals = byDow[dn] || [];
			const s = computeStats(vals);
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td style="text-align:left;">${dn}</td>
				<td style="text-align:right">${formatNumber(s?.mean || 0, 0)}</td>
				<td style="text-align:right">${formatNumber(s?.median || 0, 0)}</td>
				<td style="text-align:right">${formatNumber(s?.std || 0, 0)}</td>
				<td style="text-align:right">${formatNumber(s?.min || 0, 0)}</td>
				<td style="text-align:right">${formatNumber(s?.max || 0, 0)}</td>
				<td style="text-align:right">${vals.length}</td>
			`;
			body.appendChild(tr);
		});
	}

	function renderChart(rows) {
		const labels = rows.map(r => r.dateStr);
		const dataSeries = rows.map(r => r.value);
		const dataObj = { labels };
		const bars = { data: dataSeries, color: '#2563eb', label: 'Fabbisogno EE giornaliero (kWh)' };

		// Linee: media e mediana per Giorno della Settimana (statistiche generali)
		const byDow = { 'Dom': [], 'Lun': [], 'Mar': [], 'Mer': [], 'Gio': [], 'Ven': [], 'Sab': [] };
		rows.forEach(r => byDow[r.dayName]?.push(r.value));
		const dowStats = {};
		Object.keys(byDow).forEach(k => { dowStats[k] = computeStats(byDow[k] || []); });
		const seriesDowMean = rows.map(r => dowStats[r.dayName]?.mean || 0);
		const seriesDowMedian = rows.map(r => dowStats[r.dayName]?.median || 0);

		// Applica fattore di dilatazione stagionale ondulato in funzione del giorno dell'anno
		const baseFridayMean = dowStats['Ven']?.mean || 0;
		const seriesScaledMean = seriesDowMean.map((v, i) => {
			const { d, m, y } = parseDMY(rows[i].dateStr);
			const doy = dayOfYear(y, m, d);
			const f = seasonalFactorForDOY(baseFridayMean, doy);
			return v * f * 1000; // adattamento unità energia (kWh)
		});
		const seriesScaledMedian = seriesDowMedian.map((v, i) => {
			const { d, m, y } = parseDMY(rows[i].dateStr);
			const doy = dayOfYear(y, m, d);
			const f = seasonalFactorForDOY(baseFridayMean, doy);
			return v * f * 1000; // adattamento unità energia (kWh)
		});

		const lineMean = { data: seriesScaledMean, color: '#10b981', label: 'Media DOW (dilatata stagione)' };
		const lineMedian = { data: seriesScaledMedian, color: '#8b5cf6', label: 'Mediana DOW (dilatata stagione)' };

		chartRenderer.drawBarChartWithLines('chart-daily-ee', dataObj, 'legend-daily-ee', bars, [lineMean, lineMedian]);
	}

	async function renderAll() {
		const daily = computeDailyFabbisogno();
		const stats = computeStats(daily.map(d => d.value));
		renderKPIs(stats);
		renderChart(daily);
		renderDailyTable(daily);
		renderDowTable(daily);
		renderDowChart(daily);
	}

	function renderDowChart(rows) {
		const order = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
		const byDow = { 'Dom': [], 'Lun': [], 'Mar': [], 'Mer': [], 'Gio': [], 'Ven': [], 'Sab': [] };
		rows.forEach(r => byDow[r.dayName]?.push(r.value));
		const means = order.map(d => (computeStats(byDow[d] || [])?.mean || 0));
		const medians = order.map(d => (computeStats(byDow[d] || [])?.median || 0));

		// Applica SOLO la versione dilatata (scenario picco estivo):
		// usa il fattore di picco calcolato rispetto alla media dei Venerdì
		const baseFridayMean = computeStats(byDow['Ven'] || [])?.mean || 0;
		const factorPeak = baseFridayMean > 0 ? (19 / baseFridayMean) : 1;
		const meansDilated = means.map(v => v * factorPeak * 1000); // adattamento unità energia (kWh)
		const mediansDilated = medians.map(v => v * factorPeak * 1000); // adattamento unità energia (kWh)

		const dataObj = { labels: order };
		const bars = { data: meansDilated, color: '#2563eb', label: 'Media (dilatata stagione)' };
		const lineMed = { data: mediansDilated, color: '#8b5cf6', label: 'Mediana (dilatata stagione)' };
		chartRenderer.drawBarChartWithLines('chart-dow-summary', dataObj, 'legend-dow-summary', bars, [lineMed]);
	}

	document.addEventListener('DOMContentLoaded', () => {
		init().catch(err => {
			console.error('Errore inizializzazione stats:', err);
			alert('Errore nel caricamento delle statistiche. Ricarica la pagina.');
		});
	});
})();
