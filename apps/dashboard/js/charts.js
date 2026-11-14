// Charts - Rendering grafici con Canvas HTML5

class ChartRenderer {
    constructor(config) {
        this.config = config;
        this._zoom = {}; // per-canvas zoom state: { start: 0, end: N-1 }
        this._payloads = {}; // last draw payloads per canvas for redraw
    }

    /**
     * Formatta numero con separatore migliaia
     */
    formatNumber(num, decimals = 0) {
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    /**
     * Disegna grafico linee con doppio asse Y (Prezzi & Mercati)
     * Asse sinistro: PUN, Prezzo EE (scala alta)
     * Asse destro: Prezzo Gas, PSV (scala bassa)
     */
    drawLineChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        // Imposta dimensioni canvas
        canvas.width = rect.width * 2; // Retina display
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 60, bottom: 40, left: 60 }; // Aumentato padding destro per secondo asse
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola scale separate per i due assi
        // Asse sinistro: EE (PUN, Prezzo EE)
        const leftValues = [
            ...data.prezzi.pun,
            ...data.prezzi.prezzo_ee
        ];
        const minValLeft = 0;
        const maxValLeft = Math.max(...leftValues) * 1.1;

        // Asse destro: Gas (Prezzo Gas, PSV)
        const rightValues = [
            ...data.prezzi.prezzo_gas,
            ...(data.prezzi.psv || [])
        ];
        const minValRight = 0;
        const maxValRight = Math.max(...rightValues) * 1.1;

        // Disegna griglia (usa scala sinistra)
        this.drawGrid(ctx, padding, width, height, minValLeft, maxValLeft, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna asse sinistro (EE)
        this.drawLeftAxis(ctx, padding, width, height, data.labels, minValLeft, maxValLeft, '€/MWh EE');

        // Disegna asse destro (Gas)
        this.drawRightAxis(ctx, padding, width, height, minValRight, maxValRight, '€/MWh Gas');

        // Disegna linee EE (asse sinistro)
        const datasetsLeft = [
            { data: data.prezzi.pun, color: this.config.colors.pun, label: 'PUN', axis: 'left' },
            { data: data.prezzi.prezzo_ee, color: this.config.colors.prezzo_ee, label: 'Prezzo EE', axis: 'left' }
        ];

        datasetsLeft.forEach(dataset => {
            this.drawLine(ctx, dataset.data, padding, width, height, minValLeft, maxValLeft, dataset.color, 2);
        });

        // Disegna linee Gas (asse destro) - più spesse per differenziare
        const datasetsRight = [
            { data: data.prezzi.prezzo_gas, color: this.config.colors.prezzo_gas, label: 'Prezzo Gas', axis: 'right' }
        ];

        // Aggiungi PSV solo se presente
        if (data.prezzi.psv && data.prezzi.psv.length > 0) {
            datasetsRight.push({
                data: data.prezzi.psv,
                color: '#f97316', // Arancione per PSV
                label: 'PSV',
                axis: 'right'
            });
        }

        datasetsRight.forEach(dataset => {
            this.drawLine(ctx, dataset.data, padding, width, height, minValRight, maxValRight, dataset.color, 3);
        });

        // Disegna punti
        [...datasetsLeft, ...datasetsRight].forEach(dataset => {
            const minVal = dataset.axis === 'left' ? minValLeft : minValRight;
            const maxVal = dataset.axis === 'left' ? maxValLeft : maxValRight;
            this.drawPoints(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color);
        });

        // Aggiungi tooltip interattivo
        this.addDualAxisTooltip(canvas, [...datasetsLeft, ...datasetsRight], data.labels, padding, width, height,
            minValLeft, maxValLeft, minValRight, maxValRight);
    }

    /**
     * Disegna grafico area stacked (Fabbisogni EE)
     */
    drawAreaChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola max per scaling (fabbisogno totale)
        const maxVal = Math.max(...data.fabbisogni.ee) * 1.1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Prepara datasets in ordine (dal basso verso l'alto)
        // IMPORTANTE: Assicurati che tutti i valori siano >= 0 per il grafico stacked
        const datasets = [
            {
                data: data.consumi.ee_acquistata.map(v => Math.max(0, v)), // Forza >= 0
                color: this.config.colors.ee_acquisto,
                label: 'Acquisto Rete',
                totale: 0
            },
            {
                data: data.consumi.ee_fv.map(v => Math.max(0, v)), // Forza >= 0
                color: this.config.colors.ee_fv,
                label: 'Fotovoltaico',
                totale: 0
            },
            {
                data: data.consumi.ee_coge.map(v => Math.max(0, v)), // Forza >= 0
                color: this.config.colors.ee_coge,
                label: 'Cogeneratore',
                totale: 0
            }
        ];

        // Check per valori negativi
        const has_negative = data.consumi.ee_fv.some(v => v < 0);
        if (has_negative) {
            console.warn('⚠️ Rilevati valori FV negativi nel grafico!');
        }

        // Calcola totali per leggenda
        datasets.forEach(ds => {
            ds.totale = ds.data.reduce((a, b) => a + b, 0);
        });

        // Disegna aree stacked
        let cumulativeData = new Array(data.labels.length).fill(0);

        datasets.forEach(dataset => {
            // Crea array cumulativo per questo layer
            const layerData = dataset.data.map((val, i) => cumulativeData[i] + val);

            // Disegna area
            this.drawArea(ctx, cumulativeData, layerData, padding, width, height, 0, maxVal, dataset.color);

            // Aggiorna cumulativo per prossimo layer
            cumulativeData = layerData;
        });

        // Disegna linea fabbisogno totale come riferimento
        ctx.setLineDash([5, 5]);
        this.drawLine(ctx, data.fabbisogni.ee, padding, width, height, 0, maxVal, this.config.colors.ee_fabbisogno, 2);
        ctx.setLineDash([]);

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip
        const tooltipDatasets = [
            ...datasets,
            { data: data.fabbisogni.ee, color: this.config.colors.ee_fabbisogno, label: 'Fabbisogno Totale' }
        ];
        this.addTooltip(canvas, tooltipDatasets, data.labels, padding, width, height, 0, maxVal, 'kWh');
    }

    /**
     * Disegna grafico area stacked termico (Fabbisogni AC Coge + Caldaie)
     * Simile a drawAreaChart ma per dati termici con pattern tratteggiato per caldaie
     */
    drawThermalStackedChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola produzione totale AC (somma coge + caldaie) per ogni punto
        const totalProduction = data.consumi.ac_totale;

        // Scala lineare per un confronto diretto fra le componenti
        const maxVal = Math.max(...totalProduction) * 1.1 || 1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi con scala lineare
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Prepara datasets in ordine (dal basso verso l'alto)
        const datasets = [
            { data: data.consumi.ac_coge, color: this.config.colors.ac_coge, label: 'AC Cogeneratore', totale: 0, pattern: false },
            { data: data.consumi.ac_caldaie, color: this.config.colors.ac_caldaie, label: 'AC Caldaie', totale: 0, pattern: true }
        ];

        // Calcola totali per leggenda
        datasets.forEach(ds => {
            ds.totale = ds.data.reduce((a, b) => a + b, 0);
        });

        // Disegna aree stacked con scala lineare
        let cumulativeData = new Array(data.labels.length).fill(0);
        let caldaieLayerTop = null; // Per salvare la posizione della linea caldaie

        datasets.forEach((dataset, idx) => {
            // Crea array cumulativo per questo layer
            const layerData = dataset.data.map((val, i) => cumulativeData[i] + val);

            // Salva coordinate top se è il dataset caldaie
            if (dataset.pattern) {
                caldaieLayerTop = layerData;
            }

            // Disegna area con o senza pattern
            if (dataset.pattern) {
                // Layer caldaie con pattern tratteggiato
                this.drawAreaWithHatch(ctx, cumulativeData, layerData, padding, width, height, 0, maxVal, dataset.color);
            } else {
                // Layer cogeneratore normale
                this.drawArea(ctx, cumulativeData, layerData, padding, width, height, 0, maxVal, dataset.color);
            }

            // Aggiorna cumulativo per prossimo layer
            cumulativeData = layerData;
        });

        // ⭐️ MIGLIORA VISIBILITÀ AC CALDAIE: Aggiungi linea spessa e markers sopra l'area
        if (caldaieLayerTop) {
            // Usa le coordinate salvate specifiche del layer caldaie
            const caldaieTopLine = caldaieLayerTop;

            // Disegna linea spessa e visibile sopra l'area caldaie
            ctx.strokeStyle = '#f59e0b'; // Arancione brillante
            ctx.lineWidth = 3;
            ctx.setLineDash([]); // Nessun tratteggio per la linea

            ctx.beginPath();
            caldaieTopLine.forEach((value, i) => {
                const x = padding.left + (width / (caldaieTopLine.length - 1)) * i;
                const y = padding.top + height - ((value - 0) / (maxVal - 0)) * height;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Aggiungi markers/punti sulla linea per maggiore evidenza
            ctx.fillStyle = '#f59e0b';
            caldaieTopLine.forEach((value, i) => {
                const x = padding.left + (width / (caldaieTopLine.length - 1)) * i;
                const y = padding.top + height - ((value - 0) / (maxVal - 0)) * height;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();

                // Bordo bianco per far risaltare
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });
        }

        // Disegna linea produzione totale come riferimento (tratteggiata)
        ctx.setLineDash([5, 5]);
        this.drawLine(ctx, totalProduction, padding, width, height, 0, maxVal, this.config.colors.ac_fabbisogno, 2);
        ctx.setLineDash([]);

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip - usa produzione totale (somma coge + caldaie)
        const tooltipDatasets = [
            ...datasets,
            { data: totalProduction, color: this.config.colors.ac_fabbisogno, label: 'Produzione Totale AC' }
        ];
        this.addTooltip(canvas, tooltipDatasets, data.labels, padding, width, height, 0, maxVal, 'kWh');
    }

    /**
     * Disegna area con pattern tratteggiato (hatch)
     */
    drawAreaWithHatch(ctx, bottomData, topData, padding, width, height, minVal, maxVal, color) {
        // Prima riempi l'area con colore base - OPACITÀ AUMENTATA per caldaie
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6; // Aumentato da 0.3 a 0.6 per migliore visibilità

        ctx.beginPath();

        // Disegna top line
        topData.forEach((value, i) => {
            const x = padding.left + (width / (topData.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Disegna bottom line al contrario
        for (let i = bottomData.length - 1; i >= 0; i--) {
            const x = padding.left + (width / (bottomData.length - 1)) * i;
            const y = padding.top + height - ((bottomData[i] - minVal) / (maxVal - minVal)) * height;
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Poi aggiungi linee diagonali tratteggiate sopra
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5; // Aumentato da 1 a 1.5
        ctx.globalAlpha = 0.8; // Aumentato da 0.6 a 0.8

        // Salva il percorso dell'area per clipping
        ctx.save();
        ctx.beginPath();

        topData.forEach((value, i) => {
            const x = padding.left + (width / (topData.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        for (let i = bottomData.length - 1; i >= 0; i--) {
            const x = padding.left + (width / (bottomData.length - 1)) * i;
            const y = padding.top + height - ((bottomData[i] - minVal) / (maxVal - minVal)) * height;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.clip();

        // Disegna linee diagonali nel rettangolo clippato - più fitte per più visibilità
        const spacing = 6; // Ridotto da 8 a 6 per pattern più fitto
        for (let x = padding.left - height; x < padding.left + width + height; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x + height, padding.top + height);
            ctx.stroke();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /**
     * Disegna grafico barre singolo (per AC cogeneratore o caldaie)
     */
    drawSingleBarChart(canvasId, data, legendId, datasetConfig) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola max per scaling (solo dati specifici del dataset, non fabbisogno totale)
        const maxVal = Math.max(...datasetConfig.data) * 1.1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Calcola larghezza barra
        const barWidth = width / data.labels.length * 0.6;
        const barSpacing = width / data.labels.length;

        // Disegna barre
        data.labels.forEach((label, i) => {
            const value = datasetConfig.data[i];
            const barHeight = (value / maxVal) * height;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = padding.top + height - barHeight;

            ctx.fillStyle = datasetConfig.color;
            ctx.fillRect(x, y, barWidth, barHeight);
        });

        // Aggiorna leggenda
        const datasets = [
            { ...datasetConfig, totale: datasetConfig.data.reduce((a, b) => a + b, 0) }
        ];
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip
        const tooltipDatasets = [datasetConfig];
        this.addTooltip(canvas, tooltipDatasets, data.labels, padding, width, height, 0, maxVal, 'kWh');
    }

    /**
     * Disegna grafico a barre con una o più linee sovrapposte
     */
    drawBarChartWithLines(canvasId, data, legendId, barDataset, lineDatasets = [], unit = 'kWh') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Persist payload (anche se il canvas rimane statico)
        this._payloads[canvasId] = { data, legendId, barDataset, lineDatasets, unit };

        // Usa tutti i dati: lo zoom via mouse è disabilitato
        const visLabels = data.labels;
        const visBars = barDataset.data || [];
        const visLines = lineDatasets.map(ds => ({
            ...ds,
            data: ds.data || []
        }));

        // Calcola max per scaling considerando barre e linee
        const lineValues = visLines.flatMap(ds => ds?.data || []);
        const maxVal = Math.max(
            ...(visBars || [0]),
            ...(lineValues.length ? lineValues : [0])
        ) * 1.1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, visLabels.length);

        // Bande weekend
        this.drawWeekendBands(ctx, visLabels, padding, width, height);

        // Assi
        this.drawAxes(ctx, padding, width, height, visLabels, 0, maxVal, unit);

        // Barre
        const barWidth = width / visLabels.length * 0.6;
        const barSpacing = width / visLabels.length;
        visLabels.forEach((label, i) => {
            const value = visBars[i] || 0;
            const barHeight = (value / maxVal) * height;
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = padding.top + height - barHeight;
            ctx.fillStyle = barDataset.color;
            ctx.fillRect(x, y, barWidth, barHeight);
        });

        // Linee sovrapposte
        visLines.forEach(ds => {
            if (ds && Array.isArray(ds.data) && ds.data.length === visLabels.length) {
                this.drawLine(ctx, ds.data, padding, width, height, 0, maxVal, ds.color, 2.5);
            }
        });

        // Leggenda
        const datasets = [{ ...barDataset, totale: visBars.reduce((a, b) => a + b, 0) }];
        visLines.forEach(ds => datasets.push({ ...ds, totale: ds.data.reduce((a, b) => a + b, 0) }));
        if (legendId) this.updateLegend(legendId, datasets, unit);

        // Tooltip (mostra entrambi)
        const tooltipBar = { ...barDataset, data: visBars };
        this.addTooltip(canvas, [tooltipBar, ...visLines], visLabels, padding, width, height, 0, maxVal, unit);

        // Zoom disabilitato: nessun handler del mouse viene registrato
    }

    // Compat: metodo singola linea
    drawBarChartWithLine(canvasId, data, legendId, barDataset, lineDataset, unit = 'kWh') {
        this.drawBarChartWithLines(canvasId, data, legendId, barDataset, [lineDataset], unit);
    }

    _getZoom(canvasId, total) {
        if (!this._zoom[canvasId] || this._zoom[canvasId].total !== total) {
            this._zoom[canvasId] = { start: 0, end: total - 1, total };
        }
        return this._zoom[canvasId];
    }

    _setZoom(canvasId, start, end, total) {
        const s = Math.max(0, Math.min(start, total - 2));
        const e = Math.max(s + 1, Math.min(end, total - 1));
        this._zoom[canvasId] = { start: s, end: e, total };
    }

    _redraw(canvasId) {
        const p = this._payloads[canvasId];
        if (!p) return;
        this.drawBarChartWithLines(canvasId, p.data, p.legendId, p.barDataset, p.lineDatasets, p.unit || 'kWh');
    }

    _attachZoomHandlers(canvasId, canvas, padding, width, height, total) {
        if (canvas.__zoomHandlersAttached) return;
        canvas.__zoomHandlersAttached = true;

        let isDragging = false;
        let dragStartX = 0;
        let dragCurrentX = 0;

        const getIndexAtX = (x) => {
            const usable = width;
            const rel = Math.max(0, Math.min(x - padding.left, usable));
            const zoom = this._getZoom(canvasId, total);
            const visible = zoom.end - zoom.start + 1;
            const iVisible = Math.round((rel / usable) * (visible - 1));
            return Math.max(zoom.start, Math.min(zoom.start + iVisible, total - 1));
        };

        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const drawSelection = () => {
            const rect = canvas.getBoundingClientRect();
            const x1 = Math.min(dragStartX, dragCurrentX);
            const x2 = Math.max(dragStartX, dragCurrentX);
            ctx.save();
            ctx.fillStyle = 'rgba(37,99,235,0.15)';
            ctx.fillRect(x1, padding.top, x2 - x1, height);
            ctx.strokeStyle = 'rgba(37,99,235,0.5)';
            ctx.strokeRect(x1 + 0.5, padding.top + 0.5, x2 - x1 - 1, height - 1);
            ctx.restore();
        };

        canvas.addEventListener('mousedown', (e) => {
            const r = canvas.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            if (x < padding.left || x > r.width - padding.right) return;
            if (y < padding.top || y > r.height - padding.bottom) return;
            isDragging = true;
            dragStartX = x;
            dragCurrentX = x;
            canvas.style.cursor = 'ew-resize';
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const r = canvas.getBoundingClientRect();
            const x = e.clientX - r.left;
            // Clamp within plotting area
            dragCurrentX = Math.max(padding.left, Math.min(x, r.width - padding.right));
            // Redraw base and overlay selection
            this._redraw(canvasId);
            drawSelection();
        });

        canvas.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            canvas.style.cursor = 'default';
            const r = canvas.getBoundingClientRect();
            const x1 = Math.min(dragStartX, dragCurrentX);
            const x2 = Math.max(dragStartX, dragCurrentX);
            // Ignore tiny drags
            if (Math.abs(x2 - x1) < 10) {
                this._redraw(canvasId);
                return;
            }
            const i1 = getIndexAtX(x1);
            const i2 = getIndexAtX(x2);
            this._setZoom(canvasId, Math.min(i1, i2), Math.max(i1, i2), total);
            this._redraw(canvasId);
        });

        // Double click to reset zoom
        canvas.addEventListener('dblclick', () => {
            this._setZoom(canvasId, 0, total - 1, total);
            this._redraw(canvasId);
        });

        // Optional: wheel zoom towards cursor
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const r = canvas.getBoundingClientRect();
            const x = e.clientX - r.left;
            if (x < padding.left || x > r.width - padding.right) return;
            const zoom = this._getZoom(canvasId, total);
            const visible = zoom.end - zoom.start + 1;
            const usable = width;
            const rel = Math.max(0, Math.min(x - padding.left, usable));
            const centerIndex = Math.round(zoom.start + (rel / usable) * (visible - 1));
            const factor = e.deltaY < 0 ? 0.85 : 1.15; // zoom in/out
            const newVisible = Math.max(10, Math.min(total, Math.round(visible * factor)));
            let newStart = Math.round(centerIndex - newVisible / 2);
            let newEnd = newStart + newVisible - 1;
            if (newStart < 0) { newEnd -= newStart; newStart = 0; }
            if (newEnd > total - 1) { const shift = newEnd - (total - 1); newStart -= shift; newEnd = total - 1; newStart = Math.max(0, newStart); }
            this._setZoom(canvasId, newStart, newEnd, total);
            this._redraw(canvasId);
        }, { passive: false });
    }

    /**
     * Disegna grafico comparativo 2 linee (Strategie)
     */
    drawComparisonChart(canvasId, labels, dataset1, dataset2, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola min/max dinamici con "middle ground" scaling
        const allValues = [...dataset1.data, ...dataset2.data];
        const dataMax = Math.max(...allValues);
        const dataMin = Math.min(...allValues);

        let range = dataMax - dataMin;

        // "Middle Ground": Assicura che il range visualizzato sia almeno il 50% del valore massimo
        // Questo evita uno zoom eccessivo su piccole variazioni, mantenendo comunque il focus sui dati
        const minVisualRange = dataMax * 0.5;

        let minVal, maxVal;

        if (range < minVisualRange) {
            // Se la variazione è piccola, centra la vista ma mantieni un respiro ampio
            const center = (dataMax + dataMin) / 2;
            const halfRange = minVisualRange / 2;
            minVal = center - halfRange;
            maxVal = center + halfRange;
        } else {
            // Se la variazione è significativa, usa il range dei dati con un po' di padding
            const paddingVal = range * 0.1;
            minVal = dataMin - paddingVal;
            maxVal = dataMax + paddingVal;
        }

        // Clamp a 0 se i dati sono positivi e il calcolo va sotto zero
        if (dataMin >= 0 && minVal < 0) minVal = 0;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, minVal, maxVal, labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, labels, minVal, maxVal, '€');

        // Disegna linee
        const datasets = [dataset1, dataset2];

        datasets.forEach(dataset => {
            this.drawLine(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color, 3);
        });

        // Disegna punti
        datasets.forEach(dataset => {
            this.drawPoints(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color);
        });

        // Calcola totali per leggenda
        const datasetsWithTotals = datasets.map(ds => ({
            ...ds,
            totale: ds.data.reduce((a, b) => a + b, 0)
        }));

        // Aggiorna leggenda
        if (legendId) {
            this.updateLegend(legendId, datasetsWithTotals, '€');
        }

        // Aggiungi tooltip
        this.addTooltip(canvas, datasets, labels, padding, width, height, minVal, maxVal, '€');
    }

    /**
     * Disegna grafico barre verticali stacked (3 barre per punto)
     * Per confronto scenari FV ottimizzato
     */
    drawStackedScenarioBarChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola max per scaling (il massimo tra tutti gli scenari)
        const allValues = [
            ...data.scenario_no_autoprod,
            ...data.scenario_attuale_autoprod.map((v, i) => v + data.scenario_attuale_acquisto[i]),
            ...data.scenario_opt_autoprod.map((v, i) => v + data.scenario_opt_acquisto[i])
        ];
        const maxVal = Math.max(...allValues) * 1.1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Prepara datasets per leggenda
        const datasets = [
            {
                color: '#ef4444',
                label: 'Acquisto Rete',
                totale: data.scenario_attuale_acquisto.reduce((a, b) => a + b, 0)
            },
            {
                color: '#3b82f6',
                label: 'Autoproduzione Attuale (Coge + FV)',
                totale: data.scenario_attuale_autoprod.reduce((a, b) => a + b, 0)
            },
            {
                color: '#fbbf24',
                label: 'Autoproduzione Ottimizzata (Coge + 3 FV)',
                totale: data.scenario_opt_autoprod.reduce((a, b) => a + b, 0)
            }
        ];

        // Calcola dimensioni barre
        const groupSpacing = width / data.labels.length;
        const numBars = 3; // 3 barre per gruppo
        const barWidth = (groupSpacing * 0.75) / numBars;
        const barGap = barWidth * 0.15;

        // Disegna barre per ogni punto temporale
        data.labels.forEach((label, i) => {
            const groupX = padding.left + i * groupSpacing;
            const centerOffset = (groupSpacing - (numBars * barWidth + (numBars - 1) * barGap)) / 2;

            // Barra 1: Scenario senza autoproduzione (100% acquisto)
            const bar1X = groupX + centerOffset;
            const bar1Value = data.scenario_no_autoprod[i];
            const bar1Height = (bar1Value / maxVal) * height;
            const bar1Y = padding.top + height - bar1Height;
            ctx.fillStyle = '#94a3b8'; // Grigio per baseline
            ctx.fillRect(bar1X, bar1Y, barWidth, bar1Height);

            // Barra 2: Scenario attuale (stacked: autoproduzione + acquisto)
            const bar2X = groupX + centerOffset + barWidth + barGap;
            const bar2Autoprod = data.scenario_attuale_autoprod[i];
            const bar2Acquisto = data.scenario_attuale_acquisto[i];

            // Parte bassa: autoproduzione (blu)
            const bar2AutoprodHeight = (bar2Autoprod / maxVal) * height;
            const bar2AutoprodY = padding.top + height - bar2AutoprodHeight;
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(bar2X, bar2AutoprodY, barWidth, bar2AutoprodHeight);

            // Parte alta: acquisto (rosso)
            const bar2AcquistoHeight = (bar2Acquisto / maxVal) * height;
            const bar2AcquistoY = bar2AutoprodY - bar2AcquistoHeight;
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(bar2X, bar2AcquistoY, barWidth, bar2AcquistoHeight);

            // Barra 3: Scenario ottimizzato (stacked: autoproduzione opt + acquisto)
            const bar3X = groupX + centerOffset + 2 * (barWidth + barGap);
            const bar3Autoprod = data.scenario_opt_autoprod[i];
            const bar3Acquisto = data.scenario_opt_acquisto[i];

            // Parte bassa: autoproduzione ottimizzata (giallo/oro - colore FV)
            const bar3AutoprodHeight = (bar3Autoprod / maxVal) * height;
            const bar3AutoprodY = padding.top + height - bar3AutoprodHeight;
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(bar3X, bar3AutoprodY, barWidth, bar3AutoprodHeight);

            // Parte alta: acquisto (rosso)
            const bar3AcquistoHeight = (bar3Acquisto / maxVal) * height;
            const bar3AcquistoY = bar3AutoprodY - bar3AcquistoHeight;
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(bar3X, bar3AcquistoY, barWidth, bar3AcquistoHeight);
        });

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip
        this.addStackedScenarioTooltip(canvas, data, padding, width, height, 0, maxVal, 'kWh', groupSpacing, barWidth, barGap);
    }

    /**
     * Aggiungi tooltip per grafico barre stacked scenari
     */
    addStackedScenarioTooltip(canvas, data, padding, width, height, minVal, maxVal, unit, groupSpacing, barWidth, barGap) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        // Salva stato canvas originale (senza banda)
        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };

        // Salva snapshot dopo il rendering iniziale
        setTimeout(saveSnapshot, 100);

        // Rimuovi tooltip esistente se presente
        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        // Mouse move handler
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Verifica se il mouse è nell'area del grafico
            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                // Ripristina canvas senza banda
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            // Trova l'indice del gruppo più vicino
            const relativeX = mouseX - padding.left;
            const index = Math.floor(relativeX / groupSpacing);

            if (index < 0 || index >= data.labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            // Ripristina canvas e disegna banda verticale
            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const xStart = padding.left + index * groupSpacing;
                const xEnd = xStart + groupSpacing;
                this.drawVerticalBand(ctx, xStart, xEnd, padding, height);
            }

            // Costruisci contenuto tooltip
            let html = `<div class="chart-tooltip-title">${data.labels[index]}</div>`;

            // Scenario 1: Solo acquisto
            html += `<div class="chart-tooltip-section"><strong>Scenario senza autoproduzione:</strong></div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #94a3b8"></div>
                <span class="chart-tooltip-label">Solo Acquisto Rete:</span>
                <span class="chart-tooltip-value">${this.formatNumber(data.scenario_no_autoprod[index], 2)} ${unit}</span>
            </div>`;

            // Scenario 2: Attuale
            const attualeTot = data.scenario_attuale_autoprod[index] + data.scenario_attuale_acquisto[index];
            html += `<div class="chart-tooltip-section"><strong>Scenario attuale:</strong></div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #3b82f6"></div>
                <span class="chart-tooltip-label">Autoproduzione:</span>
                <span class="chart-tooltip-value">${this.formatNumber(data.scenario_attuale_autoprod[index], 2)} ${unit}</span>
            </div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #ef4444"></div>
                <span class="chart-tooltip-label">Acquisto Rete:</span>
                <span class="chart-tooltip-value">${this.formatNumber(data.scenario_attuale_acquisto[index], 2)} ${unit}</span>
            </div>`;
            html += `<div class="chart-tooltip-item">
                <span class="chart-tooltip-label"><strong>Totale:</strong></span>
                <span class="chart-tooltip-value"><strong>${this.formatNumber(attualeTot, 2)} ${unit}</strong></span>
            </div>`;

            // Scenario 3: Ottimizzato
            const optTot = data.scenario_opt_autoprod[index] + data.scenario_opt_acquisto[index];
            html += `<div class="chart-tooltip-section"><strong>Scenario 3 impianti FV:</strong></div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #fbbf24"></div>
                <span class="chart-tooltip-label">Autoproduzione:</span>
                <span class="chart-tooltip-value">${this.formatNumber(data.scenario_opt_autoprod[index], 2)} ${unit}</span>
            </div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #ef4444"></div>
                <span class="chart-tooltip-label">Acquisto Rete:</span>
                <span class="chart-tooltip-value">${this.formatNumber(data.scenario_opt_acquisto[index], 2)} ${unit}</span>
            </div>`;
            html += `<div class="chart-tooltip-item">
                <span class="chart-tooltip-label"><strong>Totale:</strong></span>
                <span class="chart-tooltip-value"><strong>${this.formatNumber(optTot, 2)} ${unit}</strong></span>
            </div>`;

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            // Posiziona tooltip
            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            // Mantieni tooltip nei limiti
            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        // Mouse leave handler
        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    }

    /**
     * Disegna grafico a barre affiancate per confronto Normal vs FV12
     * NUOVO DESIGN: 2 barre affiancate che mostrano direttamente la differenza di produzione
     */
    drawFVComparisonBars(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola max per scaling (il massimo tra Normal e FV12)
        const maxVal = Math.max(...data.normal, ...data.fv12) * 1.15;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Prepara datasets per leggenda
        const datasets = [
            {
                color: '#3b82f6',
                label: 'Produzione Normal (Coge + FV normal)',
                totale: data.normal.reduce((a, b) => a + b, 0)
            },
            {
                color: '#fbbf24',
                label: 'Produzione FV12 (Coge + 3 FV)',
                totale: data.fv12.reduce((a, b) => a + b, 0)
            }
        ];

        // Calcola dimensioni barre
        const groupSpacing = width / data.labels.length;
        const barWidth = (groupSpacing * 0.6) / 2; // 2 barre per gruppo
        const barGap = barWidth * 0.3;

        // Disegna barre per ogni punto temporale
        data.labels.forEach((label, i) => {
            const groupX = padding.left + i * groupSpacing;
            const centerOffset = (groupSpacing - (2 * barWidth + barGap)) / 2;

            // Barra 1: Normal (blu)
            const bar1X = groupX + centerOffset;
            const bar1Value = data.normal[i];
            const bar1Height = (bar1Value / maxVal) * height;
            const bar1Y = padding.top + height - bar1Height;
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(bar1X, bar1Y, barWidth, bar1Height);

            // Barra 2: FV12 (giallo)
            const bar2X = groupX + centerOffset + barWidth + barGap;
            const bar2Value = data.fv12[i];
            const bar2Height = (bar2Value / maxVal) * height;
            const bar2Y = padding.top + height - bar2Height;
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(bar2X, bar2Y, barWidth, bar2Height);

            // Opzionale: mostra differenza sopra le barre
            const differenza = bar2Value - bar1Value;
            if (Math.abs(differenza) > maxVal * 0.02) { // Solo se differenza significativa
                const textY = Math.min(bar1Y, bar2Y) - 5;
                const textX = groupX + groupSpacing / 2;
                ctx.fillStyle = differenza > 0 ? '#10b981' : '#ef4444';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${differenza > 0 ? '+' : ''}${this.formatNumber(differenza, 0)}`, textX, textY);
            }
        });

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip
        this.addFVComparisonTooltip(canvas, data, padding, width, height, 0, maxVal, 'kWh', groupSpacing, barWidth, barGap);
    }

    /**
     * Aggiungi tooltip per grafico confronto Normal vs FV12
     */
    addFVComparisonTooltip(canvas, data, padding, width, height, minVal, maxVal, unit, groupSpacing, barWidth, barGap) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };

        setTimeout(saveSnapshot, 100);

        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            const relativeX = mouseX - padding.left;
            const index = Math.floor(relativeX / groupSpacing);

            if (index < 0 || index >= data.labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const xStart = padding.left + index * groupSpacing;
                const xEnd = xStart + groupSpacing;
                this.drawVerticalBand(ctx, xStart, xEnd, padding, height);
            }

            const normal = data.normal[index];
            const fv12 = data.fv12[index];
            const differenza = fv12 - normal;
            const percentuale = normal > 0 ? ((differenza / normal) * 100).toFixed(1) : 0;

            let html = `<div class="chart-tooltip-title">${data.labels[index]}</div>`;
            html += `<div class="chart-tooltip-section"><strong>Confronto Produzione:</strong></div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #3b82f6"></div>
                <span class="chart-tooltip-label">Normal:</span>
                <span class="chart-tooltip-value">${this.formatNumber(normal, 2)} ${unit}</span>
            </div>`;
            html += `<div class="chart-tooltip-item">
                <div class="chart-tooltip-color" style="background-color: #fbbf24"></div>
                <span class="chart-tooltip-label">FV12:</span>
                <span class="chart-tooltip-value">${this.formatNumber(fv12, 2)} ${unit}</span>
            </div>`;
            html += `<div class="chart-tooltip-item">
                <span class="chart-tooltip-label"><strong>Differenza:</strong></span>
                <span class="chart-tooltip-value" style="color: ${differenza > 0 ? '#10b981' : '#ef4444'}">
                    <strong>${this.formatNumber(differenza, 2)} ${unit} (${percentuale > 0 ? '+' : ''}${percentuale}%)</strong>
                </span>
            </div>`;

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    }

    /**
     * Disegna grafico barre verticali raggruppate (3 barre per punto) - DEPRECATO
     * Per confronto FV ottimizzato
     */
    drawGroupedBarChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola max per scaling
        const maxVal = Math.max(...data.ee_acquistata_attuale) * 1.1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Prepara datasets per le 3 barre
        const datasets = [
            {
                data: data.ee_acquistata_attuale,
                color: this.config.colors.ee_acquisto,
                label: 'EE Acquistata Attuale',
                totale: 0
            },
            {
                data: data.ee_acquistata_con_fv_opt,
                color: '#10b981',
                label: 'EE Acquistata con FV Ottimizzato',
                totale: 0
            },
            {
                data: data.risparmio_fv_opt,
                color: '#fbbf24',
                label: 'Risparmio FV Ottimizzato',
                totale: 0
            }
        ];

        // Calcola totali per leggenda
        datasets.forEach(ds => {
            ds.totale = ds.data.reduce((a, b) => a + b, 0);
        });

        // Calcola dimensioni barre
        const groupSpacing = width / data.labels.length;
        const barWidth = (groupSpacing * 0.7) / datasets.length; // 3 barre per gruppo
        const barGap = barWidth * 0.1; // Spazio tra barre

        // Disegna barre raggruppate
        data.labels.forEach((label, i) => {
            const groupX = padding.left + i * groupSpacing;

            datasets.forEach((dataset, j) => {
                const value = dataset.data[i];
                const barHeight = (value / maxVal) * height;
                const x = groupX + j * (barWidth + barGap) + (groupSpacing - datasets.length * barWidth - (datasets.length - 1) * barGap) / 2;
                const y = padding.top + height - barHeight;

                ctx.fillStyle = dataset.color;
                ctx.fillRect(x, y, barWidth, barHeight);
            });
        });

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip
        this.addGroupedBarTooltip(canvas, datasets, data.labels, padding, width, height, 0, maxVal, 'kWh', groupSpacing, barWidth, barGap);
    }

    /**
     * Aggiungi tooltip per grafico barre raggruppate
     */
    addGroupedBarTooltip(canvas, datasets, labels, padding, width, height, minVal, maxVal, unit, groupSpacing, barWidth, barGap) {
        // Rimuovi tooltip esistente se presente
        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        // Mouse move handler
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Verifica se il mouse è nell'area del grafico
            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                return;
            }

            // Trova l'indice del gruppo più vicino
            const relativeX = mouseX - padding.left;
            const index = Math.floor(relativeX / groupSpacing);

            if (index < 0 || index >= labels.length) {
                tooltip.classList.remove('visible');
                return;
            }

            // Costruisci contenuto tooltip
            let html = `<div class="chart-tooltip-title">${labels[index]}</div>`;

            datasets.forEach(dataset => {
                const value = dataset.data[index];
                html += `
                    <div class="chart-tooltip-item">
                        <div class="chart-tooltip-color" style="background-color: ${dataset.color}"></div>
                        <span class="chart-tooltip-label">${dataset.label}:</span>
                        <span class="chart-tooltip-value">${this.formatNumber(value, 2)} ${unit}</span>
                    </div>
                `;
            });

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            // Posiziona tooltip
            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            // Mantieni tooltip nei limiti
            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        // Mouse leave handler
        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    }

    /**
     * Disegna grafico barre stacked (Fabbisogni Termici) - DEPRECATO
     */
    drawBarChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calcola max per scaling
        const maxVal = Math.max(...data.fabbisogni.ac) * 1.1;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, 0, maxVal, data.labels.length);

        // Disegna bande weekend
        this.drawWeekendBands(ctx, data.labels, padding, width, height);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, data.labels, 0, maxVal, 'kWh');

        // Prepara datasets
        const datasets = [
            { data: data.consumi.ac_caldaie, color: this.config.colors.ac_caldaie, label: 'Caldaie', totale: 0 },
            { data: data.consumi.ac_coge, color: this.config.colors.ac_coge, label: 'Cogeneratore', totale: 0 }
        ];

        datasets.forEach(ds => {
            ds.totale = ds.data.reduce((a, b) => a + b, 0);
        });

        // Calcola larghezza barra
        const barWidth = width / data.labels.length * 0.6;
        const barSpacing = width / data.labels.length;

        // Disegna barre stacked
        data.labels.forEach((label, i) => {
            const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
            let cumulativeHeight = 0;

            datasets.forEach(dataset => {
                const value = dataset.data[i];
                const barHeight = (value / maxVal) * height;
                const y = padding.top + height - cumulativeHeight - barHeight;

                // Disegna segmento barra
                ctx.fillStyle = dataset.color;
                ctx.fillRect(x, y, barWidth, barHeight);

                cumulativeHeight += barHeight;
            });

            // Disegna linea riferimento fabbisogno
            const fabbY = padding.top + height - (data.fabbisogni.ac[i] / maxVal) * height;
            ctx.strokeStyle = this.config.colors.ac_fabbisogno;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x, fabbY);
            ctx.lineTo(x + barWidth, fabbY);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, 'kWh');

        // Aggiungi tooltip
        const tooltipDatasets = [
            ...datasets,
            { data: data.fabbisogni.ac, color: this.config.colors.ac_fabbisogno, label: 'Fabbisogno Totale' }
        ];
        this.addTooltip(canvas, tooltipDatasets, data.labels, padding, width, height, 0, maxVal, 'kWh');
    }

    /**
     * Disegna bande weekend (sabato e domenica)
     */
    drawWeekendBands(ctx, labels, padding, width, height) {
        // Raggruppa label per giorno identificando weekend
        const weekendRanges = [];
        let currentWeekendStart = null;

        labels.forEach((label, i) => {
            // Estrae giorno della settimana dalla label (es. "Sab 15/01 10:00" → "Sab")
            const dayName = label.split(' ')[0];
            const isWeekend = dayName === 'Sab' || dayName === 'Dom';

            if (isWeekend && currentWeekendStart === null) {
                currentWeekendStart = i;
            } else if (!isWeekend && currentWeekendStart !== null) {
                weekendRanges.push({ start: currentWeekendStart, end: i - 1 });
                currentWeekendStart = null;
            }
        });

        // Se l'ultimo punto è weekend
        if (currentWeekendStart !== null) {
            weekendRanges.push({ start: currentWeekendStart, end: labels.length - 1 });
        }

        // Disegna bande weekend
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        weekendRanges.forEach(range => {
            const xStart = padding.left + (width / (labels.length - 1)) * range.start;
            const xEnd = padding.left + (width / (labels.length - 1)) * range.end;
            const bandWidth = xEnd - xStart + (width / (labels.length - 1));

            ctx.fillRect(xStart, padding.top, bandWidth, height);
        });
    }

    /**
     * Disegna griglia
     */
    drawGrid(ctx, padding, width, height, minVal, maxVal, numPoints) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;

        // Linee orizzontali
        const numHLines = 5;
        for (let i = 0; i <= numHLines; i++) {
            const y = padding.top + (height / numHLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + width, y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Disegna assi con labels
     */
    drawAxes(ctx, padding, width, height, labels, minVal, maxVal, unit) {
        // Asse Y
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'right';

        const numYLabels = 5;
        for (let i = 0; i <= numYLabels; i++) {
            const value = maxVal - (maxVal - minVal) / numYLabels * i;
            const y = padding.top + (height / numYLabels) * i;
            ctx.fillText(this.formatNumber(value, 0), padding.left - 10, y + 4);
        }

        // Label asse Y
        ctx.save();
        ctx.translate(15, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();

        // Asse X - mostra solo alcuni labels per evitare sovrapposizione
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';

        const maxLabels = width < 600 ? 6 : 12;
        const step = Math.ceil(labels.length / maxLabels);

        labels.forEach((label, i) => {
            if (i % step === 0 || i === labels.length - 1) {
                const x = padding.left + (width / (labels.length - 1)) * i;
                ctx.fillText(label, x, padding.top + height + 20);
            }
        });
    }

    /**
     * Disegna asse sinistro con labels (per doppio asse Y)
     */
    drawLeftAxis(ctx, padding, width, height, labels, minVal, maxVal, unit) {
        // Asse Y sinistro
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'right';

        const numYLabels = 5;
        for (let i = 0; i <= numYLabels; i++) {
            const value = maxVal - (maxVal - minVal) / numYLabels * i;
            const y = padding.top + (height / numYLabels) * i;
            ctx.fillText(this.formatNumber(value, 0), padding.left - 10, y + 4);
        }

        // Label asse Y sinistro
        ctx.save();
        ctx.translate(15, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();

        // Asse X - mostra solo alcuni labels per evitare sovrapposizione
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';

        const maxLabels = width < 600 ? 6 : 12;
        const step = Math.ceil(labels.length / maxLabels);

        labels.forEach((label, i) => {
            if (i % step === 0 || i === labels.length - 1) {
                const x = padding.left + (width / (labels.length - 1)) * i;
                ctx.fillText(label, x, padding.top + height + 20);
            }
        });
    }

    /**
     * Disegna asse destro con labels (per doppio asse Y)
     */
    drawRightAxis(ctx, padding, width, height, minVal, maxVal, unit) {
        // Asse Y destro
        ctx.fillStyle = '#f97316'; // Arancione per differenziare
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'left';

        const numYLabels = 5;
        const rightX = padding.left + width;

        for (let i = 0; i <= numYLabels; i++) {
            const value = maxVal - (maxVal - minVal) / numYLabels * i;
            const y = padding.top + (height / numYLabels) * i;
            ctx.fillText(this.formatNumber(value, 0), rightX + 10, y + 4);
        }

        // Label asse Y destro
        ctx.save();
        ctx.translate(padding.left + width + 45, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();
    }

    /**
     * Disegna assi per grafico termico con scala logaritmica (mostra valori reali sulle label)
     */
    drawLogarithmicAxes(ctx, padding, width, height, labels, minValLog, maxValLog, maxValRaw, unit) {
        // Asse Y - mostra valori reali anche se scala è logaritmica
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'right';

        const numYLabels = 5;
        for (let i = 0; i <= numYLabels; i++) {
            // Calcola valore logaritmico per posizionamento
            const valueLog = maxValLog - (maxValLog - minValLog) / numYLabels * i;
            // Inverti log per ottenere valore reale: e^valueLog - 1
            const valueReal = Math.exp(valueLog) - 1;
            const y = padding.top + (height / numYLabels) * i;
            ctx.fillText(this.formatNumber(valueReal, 0), padding.left - 10, y + 4);
        }

        // Label asse Y
        ctx.save();
        ctx.translate(15, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();

        // Asse X - mostra solo alcuni labels per evitare sovrapposizione
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';

        const maxLabels = width < 600 ? 6 : 12;
        const step = Math.ceil(labels.length / maxLabels);

        labels.forEach((label, i) => {
            if (i % step === 0 || i === labels.length - 1) {
                const x = padding.left + (width / (labels.length - 1)) * i;
                ctx.fillText(label, x, padding.top + height + 20);
            }
        });
    }

    /**
     * Disegna indicatore crosshair verticale per hover
     */
    drawCrosshair(ctx, x, padding, width, height, datasets, dataIndex, minValLeft, maxValLeft, minValRight, maxValRight) {
        // Linea verticale tratteggiata
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Evidenzia punti su tutte le serie
        datasets.forEach(dataset => {
            const value = dataset.data[dataIndex];
            const minVal = dataset.axis === 'left' ? minValLeft : minValRight;
            const maxVal = dataset.axis === 'left' ? maxValLeft : maxValRight;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            // Cerchio esterno (glow)
            ctx.fillStyle = dataset.color + '40'; // Trasparenza 25%
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();

            // Cerchio principale
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Bordo colorato
            ctx.strokeStyle = dataset.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Disegna indicatore crosshair per grafico singolo asse
     */
    drawSingleAxisCrosshair(ctx, x, padding, width, height, datasets, dataIndex, minVal, maxVal) {
        // Linea verticale tratteggiata
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Evidenzia punti su tutte le serie
        datasets.forEach(dataset => {
            const value = dataset.data[dataIndex];
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            // Cerchio esterno (glow)
            ctx.fillStyle = dataset.color + '40'; // Trasparenza 25%
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();

            // Cerchio principale
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Bordo colorato
            ctx.strokeStyle = dataset.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Disegna indicatore crosshair per grafico area (solo linea verticale + ultimo dataset)
     */
    drawAreaCrosshair(ctx, x, padding, width, height, datasets, dataIndex, minVal, maxVal) {
        // Linea verticale tratteggiata
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Evidenzia punto SOLO sull'ultimo dataset (linea fabbisogno totale)
        const lastDataset = datasets[datasets.length - 1];
        const value = lastDataset.data[dataIndex];
        const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

        // Cerchio esterno (glow)
        ctx.fillStyle = lastDataset.color + '40'; // Trasparenza 25%
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Cerchio principale
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Bordo colorato
        ctx.strokeStyle = lastDataset.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Disegna banda verticale per indicare range temporale (barre)
     */
    drawVerticalBand(ctx, xStart, xEnd, padding, height) {
        ctx.save();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(xStart, padding.top, xEnd - xStart, height);
        ctx.restore();
    }

    /**
     * Aggiungi tooltip per grafico con doppio asse Y
     */
    addDualAxisTooltip(canvas, datasets, labels, padding, width, height, minValLeft, maxValLeft, minValRight, maxValRight) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        // Salva stato canvas originale (senza crosshair)
        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };

        // Salva snapshot dopo il rendering iniziale
        setTimeout(saveSnapshot, 100);

        // Rimuovi tooltip esistente se presente
        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        // Mouse move handler
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Verifica se il mouse è nell'area del grafico
            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                // Ripristina canvas senza crosshair
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            // Trova l'indice del punto più vicino
            const relativeX = mouseX - padding.left;
            const dataWidth = width;
            const index = Math.round((relativeX / dataWidth) * (labels.length - 1));

            if (index < 0 || index >= labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            // Ripristina canvas e disegna crosshair
            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const x = padding.left + (width / (labels.length - 1)) * index;
                this.drawCrosshair(ctx, x, padding, width, height, datasets, index, minValLeft, maxValLeft, minValRight, maxValRight);
            }

            // Costruisci contenuto tooltip
            let html = `<div class="chart-tooltip-title">${labels[index]}</div>`;

            datasets.forEach(dataset => {
                const value = dataset.data[index];
                const unit = dataset.axis === 'left' ? '€/MWh' : '€/MWh';
                html += `
                    <div class="chart-tooltip-item">
                        <div class="chart-tooltip-color" style="background-color: ${dataset.color}"></div>
                        <span class="chart-tooltip-label">${dataset.label}:</span>
                        <span class="chart-tooltip-value">${this.formatNumber(value, 2)} ${unit}</span>
                    </div>
                `;
            });

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            // Posiziona tooltip
            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            // Mantieni tooltip nei limiti
            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        // Mouse leave handler
        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
            // Ripristina canvas senza crosshair
            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
            }
        });
    }

    /**
     * Disegna linea
     */
    drawLine(ctx, data, padding, width, height, minVal, maxVal, color, lineWidth = 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        data.forEach((value, i) => {
            const x = padding.left + (width / (data.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    /**
     * Disegna punti sulla linea
     */
    drawPoints(ctx, data, padding, width, height, minVal, maxVal, color) {
        ctx.fillStyle = color;

        data.forEach((value, i) => {
            const x = padding.left + (width / (data.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Disegna area tra due linee
     */
    drawArea(ctx, bottomData, topData, padding, width, height, minVal, maxVal, color) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;

        ctx.beginPath();

        // Disegna top line
        topData.forEach((value, i) => {
            const x = padding.left + (width / (topData.length - 1)) * i;
            const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Disegna bottom line al contrario
        for (let i = bottomData.length - 1; i >= 0; i--) {
            const x = padding.left + (width / (bottomData.length - 1)) * i;
            const y = padding.top + height - ((bottomData[i] - minVal) / (maxVal - minVal)) * height;
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    /**
     * Aggiorna leggenda grafico
     */
    updateLegend(legendId, datasets, unit) {
        const legendEl = document.getElementById(legendId);
        if (!legendEl) return;

        legendEl.innerHTML = '';

        datasets.reverse().forEach(dataset => {
            const item = document.createElement('div');
            item.className = 'legend-item';

            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = dataset.color;

            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = dataset.label;

            const value = document.createElement('span');
            value.className = 'legend-value';
            value.textContent = `(${this.formatNumber(dataset.totale)} ${unit})`;

            item.appendChild(colorBox);
            item.appendChild(label);
            item.appendChild(value);
            legendEl.appendChild(item);
        });
    }

    /**
     * Aggiungi tooltip interattivo al canvas
     */
    addTooltip(canvas, datasets, labels, padding, width, height, minVal, maxVal, unit) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();

        // Determina se è un grafico area stacked (ultimo dataset è una linea di riferimento)
        const isAreaChart = datasets.length > 1 &&
            (datasets[datasets.length - 1].label.includes('Totale') ||
                datasets[datasets.length - 1].label.includes('Fabbisogno') ||
                datasets[datasets.length - 1].label.includes('Produzione'));

        // Salva stato canvas originale (senza crosshair)
        let canvasSnapshot = null;
        const saveSnapshot = () => {
            canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        };

        // Salva snapshot dopo il rendering iniziale
        setTimeout(saveSnapshot, 100);

        // Rimuovi tooltip esistente se presente
        let tooltip = canvas.parentElement.querySelector('.chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        // Mouse move handler
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Verifica se il mouse è nell'area del grafico
            if (mouseX < padding.left || mouseX > rect.width - padding.right ||
                mouseY < padding.top || mouseY > rect.height - padding.bottom) {
                tooltip.classList.remove('visible');
                // Ripristina canvas senza crosshair
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            // Trova l'indice del punto più vicino
            const relativeX = mouseX - padding.left;
            const dataWidth = width;
            const index = Math.round((relativeX / dataWidth) * (labels.length - 1));

            if (index < 0 || index >= labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            // Ripristina canvas e disegna crosshair appropriato
            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const x = padding.left + (width / (labels.length - 1)) * index;

                if (isAreaChart) {
                    // Per grafici area stacked: solo linea + cerchio sull'ultima serie (linea totale)
                    this.drawAreaCrosshair(ctx, x, padding, width, height, datasets, index, minVal, maxVal);
                } else {
                    // Per grafici a linee normali: cerchi su tutte le serie
                    this.drawSingleAxisCrosshair(ctx, x, padding, width, height, datasets, index, minVal, maxVal);
                }
            }

            // Costruisci contenuto tooltip
            let html = `<div class="chart-tooltip-title">${labels[index]}</div>`;

            datasets.forEach(dataset => {
                const value = dataset.data[index];
                html += `
                    <div class="chart-tooltip-item">
                        <div class="chart-tooltip-color" style="background-color: ${dataset.color}"></div>
                        <span class="chart-tooltip-label">${dataset.label}:</span>
                        <span class="chart-tooltip-value">${this.formatNumber(value, 2)} ${unit}</span>
                    </div>
                `;
            });

            tooltip.innerHTML = html;
            tooltip.classList.add('visible');

            // Posiziona tooltip
            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX = mouseX + 15;
            let tooltipY = mouseY - tooltipRect.height / 2;

            // Mantieni tooltip nei limiti
            if (tooltipX + tooltipRect.width > rect.width) {
                tooltipX = mouseX - tooltipRect.width - 15;
            }
            if (tooltipY < 0) tooltipY = 10;
            if (tooltipY + tooltipRect.height > rect.height) {
                tooltipY = rect.height - tooltipRect.height - 10;
            }

            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
        });

        // Mouse leave handler
        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
            // Ripristina canvas senza crosshair
            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
            }
        });
    }
}

// Istanza globale del renderer
let chartRenderer = null;

// Inizializza il renderer
function initChartRenderer() {
    chartRenderer = new ChartRenderer(CONFIG);
}
