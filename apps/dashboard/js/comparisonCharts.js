// Comparison Charts - Rendering grafici per analisi variazione MIN potenza cogeneratore

class ComparisonChartRenderer {
    constructor(config) {
        this.config = config;
    }

    /**
     * Formatta numero con separatore migliaia
     */
    formatNumber(num, decimals = 0) {
        if (typeof num !== 'number' || isNaN(num)) return '-';
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    /**
     * Calcola kW dalla percentuale (0% = 0kW, 100% = 500kW)
     */
    calculateKW(percentage) {
        return (percentage / 100) * 500;
    }

    /**
     * Rendering tabella principale - Design System: Less is more, scansionabile
     */
    renderMainTable(data) {
        const tbody = document.getElementById('comparison-main-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        const riferimentoAttuale = data[0]?.costi?.attuale?.[0] || 0;
        
        // Trova costo minimo globale per evidenziare riga ottimale
        const allMinCosts = data.map(d => d.costi?.costo_minimo?.[0] || Infinity);
        const globalMinCost = Math.min(...allMinCosts);

        data.forEach(item => {
            const row = document.createElement('tr');
            
            const perc = item.percentage;
            const kW = this.calculateKW(perc);
            const attuale = item.costi?.attuale?.[0] || 0;
            const insEl = item.costi?.coge_ins_elettrico?.[0] || 0;
            const insTerm = item.costi?.coge_ins_termico?.[0] || 0;
            const costoMin = item.costi?.costo_minimo?.[0] || 0;
            
            // Calcola risparmio rispetto all'attuale
            const risparmio = riferimentoAttuale - costoMin;
            
            // Trova strategia migliore per questa percentuale
            const strategie = [
                { key: 'insEl', cost: insEl, label: 'Ins. El.' },
                { key: 'insTerm', cost: insTerm, label: 'Ins. Term.' },
                { key: 'min', cost: costoMin, label: 'Minimo' }
            ].filter(s => s.cost > 0);
            
            const migliore = strategie.reduce((best, curr) => curr.cost < best.cost ? curr : best, strategie[0]);
            const isOttimale = costoMin === globalMinCost;

            row.innerHTML = `
                <td class="table-percentage"><strong>${this.formatNumber(perc, 1)}%</strong></td>
                <td class="table-kw">${this.formatNumber(kW, 0)}</td>
                <td class="table-reference">${this.formatNumber(attuale, 0)}</td>
                <td class="table-strategy ${migliore?.key === 'insEl' ? 'best-strategy' : ''}">
                    ${this.formatNumber(insEl, 0)}
                </td>
                <td class="table-strategy ${migliore?.key === 'insTerm' ? 'best-strategy' : ''}">
                    ${this.formatNumber(insTerm, 0)}
                </td>
                <td class="table-minimum ${isOttimale ? 'optimal-cost' : ''}">
                    <strong>${this.formatNumber(costoMin, 0)}</strong>
                </td>
                <td class="table-savings ${risparmio > 0 ? 'has-savings' : ''}">
                    ${risparmio > 0 ? '<span class="savings-amount">-' + this.formatNumber(risparmio, 0) + '</span>' : '-'}
                </td>
            `;

            // Evidenzia riga ottimale
            if (isOttimale) {
                row.classList.add('optimal-row');
            }

            tbody.appendChild(row);
        });
    }
    
    /**
     * Mantiene renderTable per retrocompatibilità (non usato più)
     */
    renderTable(data) {
        this.renderMainTable(data);
    }

    /**
     * Grafico evoluzione costi per percentuale
     */
    drawCostsChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 40, bottom: 50, left: 70 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Prepara dati
        const percentages = data.map(d => d.percentage);
        const datasets = [
            {
                label: 'Costo Attuale',
                data: data.map(d => d.costi?.attuale?.[0] || 0),
                color: '#ef4444'
            },
            {
                label: 'Coge Spento',
                data: data.map(d => d.costi?.coge_spento?.[0] || 0),
                color: '#64748b'
            },
            {
                label: 'Coge Minimo',
                data: data.map(d => d.costi?.coge_minimo?.[0] || 0),
                color: '#10b981'
            },
            {
                label: 'Coge Ins. Elettrico',
                data: data.map(d => d.costi?.coge_ins_elettrico?.[0] || 0),
                color: '#3b82f6'
            },
            {
                label: 'Coge Massimo',
                data: data.map(d => d.costi?.coge_massimo?.[0] || 0),
                color: '#f59e0b'
            },
            {
                label: 'Coge Ins. Termico',
                data: data.map(d => d.costi?.coge_ins_termico?.[0] || 0),
                color: '#ec4899'
            },
            {
                label: 'Costo Minimo',
                data: data.map(d => d.costi?.costo_minimo?.[0] || 0),
                color: '#06b6d4',
                lineWidth: 3,
                dashed: true
            }
        ];

        // Calcola scale
        const allValues = datasets.flatMap(d => d.data);
        const minVal = Math.min(...allValues) * 0.98;
        const maxVal = Math.max(...allValues) * 1.02;

        // Disegna griglia
        this.drawGrid(ctx, padding, width, height, minVal, maxVal, percentages.length);

        // Disegna assi
        this.drawAxes(ctx, padding, width, height, percentages.map(p => `${p}%`), minVal, maxVal, '€');

        // Disegna linee
        datasets.forEach(dataset => {
            if (dataset.dashed) {
                ctx.setLineDash([8, 4]);
            } else {
                ctx.setLineDash([]);
            }
            
            this.drawLine(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color, dataset.lineWidth || 2);
        });
        ctx.setLineDash([]);

        // Disegna punti su costo minimo
        const minDataset = datasets.find(d => d.label === 'Costo Minimo');
        if (minDataset) {
            this.drawPoints(ctx, minDataset.data, padding, width, height, minVal, maxVal, minDataset.color);
        }

        // Aggiorna leggenda
        this.updateLegend(legendId, datasets, '€');

        // Tooltip
        this.addTooltip(canvas, datasets, percentages.map(p => `${p}%`), padding, width, height, minVal, maxVal, '€');
    }

    /**
     * Grafico risparmi potenziali
     */
    drawSavingsChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 40, bottom: 50, left: 70 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        const percentages = data.map(d => d.percentage);
        const datasets = [
            {
                label: 'Risparmio Possibile',
                data: data.map(d => d.risparmio_possibile?.[0] || 0),
                color: '#10b981'
            },
            {
                label: 'Risparmio vs Off',
                data: data.map(d => d.risparmi?.risparmio_vs_off?.[0] || 0),
                color: '#3b82f6'
            },
            {
                label: 'Coge-Opt vs Attuale',
                data: data.map(d => d.risparmi?.coge_opt_vs_attuale?.[0] || 0),
                color: '#f59e0b'
            },
            {
                label: 'Attuale vs Best',
                data: data.map(d => d.risparmi?.attuale_vs_best?.[0] || 0),
                color: '#8b5cf6'
            }
        ];

        const allValues = datasets.flatMap(d => d.data);
        const minVal = Math.min(...allValues) * 1.1;
        const maxVal = Math.max(...allValues) * 1.05;

        this.drawGrid(ctx, padding, width, height, minVal, maxVal, percentages.length);
        this.drawAxes(ctx, padding, width, height, percentages.map(p => `${p}%`), minVal, maxVal, '€');

        datasets.forEach(dataset => {
            this.drawLine(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color, 2);
            this.drawPoints(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color);
        });

        this.updateLegend(legendId, datasets, '€');
        this.addTooltip(canvas, datasets, percentages.map(p => `${p}%`), padding, width, height, minVal, maxVal, '€');
    }

    /**
     * Grafico principale compatto: Strategie chiave vs Minimo
     */
    drawMainCompactChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 15, right: 30, bottom: 35, left: 60 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        const percentages = data.map(d => d.percentage);
        const riferimentoAttuale = data[0]?.costi?.attuale?.[0] || 0;
        
        // MOSTRA COSTI ASSOLUTI delle strategie che variano
        const datasets = [
            {
                label: 'Ins. Elettrico',
                data: data.map(d => d.costi?.coge_ins_elettrico?.[0] || 0),
                color: '#3b82f6'
            },
            {
                label: 'Ins. Termico',
                data: data.map(d => d.costi?.coge_ins_termico?.[0] || 0),
                color: '#ec4899'
            },
            {
                label: 'Costo Minimo',
                data: data.map(d => d.costi?.costo_minimo?.[0] || 0),
                color: '#06b6d4',
                lineWidth: 3,
                dashed: true
            }
        ];

        // Calcola range per assi (include riferimento attuale)
        const allValues = [
            ...datasets.flatMap(d => d.data),
            riferimentoAttuale
        ];
        const minVal = Math.min(...allValues) * 0.98;
        const maxVal = Math.max(...allValues) * 1.02;

        this.drawGrid(ctx, padding, width, height, minVal, maxVal, percentages.length);
        
        // Linea orizzontale per riferimento Attuale (costante)
        const attualeY = padding.top + height - ((riferimentoAttuale - minVal) / (maxVal - minVal)) * height;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, attualeY);
        ctx.lineTo(padding.left + width, attualeY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Etichetta "Attuale" a destra della linea
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Attuale (rif.)', padding.left + width - 5, attualeY - 5);

        // Assi con valori assoluti
        this.drawAxes(ctx, padding, width, height, percentages.map(p => `${p}%`), minVal, maxVal, '€');

        // Disegna linee delle strategie
        datasets.forEach(dataset => {
            if (dataset.dashed) {
                ctx.setLineDash([8, 4]);
            } else {
                ctx.setLineDash([]);
            }
            this.drawLine(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color, dataset.lineWidth || 2);
        });
        ctx.setLineDash([]);

        this.updateLegend(legendId, datasets, '€');
        this.addTooltip(canvas, datasets, percentages.map(p => `${p}%`), padding, width, height, minVal, maxVal, '€');
    }

    /**
     * Grafico confronto vs costo minimo (differenze) - DEPRECATED
     */
    drawComparisonVsMinimumChart(canvasId, data, legendId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        const padding = { top: 20, right: 40, bottom: 50, left: 70 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, rect.width, rect.height);

        const percentages = data.map(d => d.percentage);
        
        // Calcola differenze vs costo minimo
        const datasets = [
            {
                label: 'Attuale vs Minimo',
                data: data.map(d => {
                    const attuale = d.costi?.attuale?.[0] || 0;
                    const minimo = d.costi?.costo_minimo?.[0] || 0;
                    return attuale - minimo;
                }),
                color: '#ef4444'
            },
            {
                label: 'Coge Minimo vs Minimo',
                data: data.map(d => {
                    const cogeMin = d.costi?.coge_minimo?.[0] || 0;
                    const minimo = d.costi?.costo_minimo?.[0] || 0;
                    return cogeMin - minimo;
                }),
                color: '#10b981'
            },
            {
                label: 'Coge Ins. Elettrico vs Minimo',
                data: data.map(d => {
                    const insElettrico = d.costi?.coge_ins_elettrico?.[0] || 0;
                    const minimo = d.costi?.costo_minimo?.[0] || 0;
                    return insElettrico - minimo;
                }),
                color: '#3b82f6'
            },
            {
                label: 'Coge Ins. Termico vs Minimo',
                data: data.map(d => {
                    const insTermico = d.costi?.coge_ins_termico?.[0] || 0;
                    const minimo = d.costi?.costo_minimo?.[0] || 0;
                    return insTermico - minimo;
                }),
                color: '#ec4899'
            }
        ];

        const allValues = datasets.flatMap(d => d.data);
        const minVal = Math.min(...allValues, 0) * 1.1;
        const maxVal = Math.max(...allValues, 0) * 1.05;

        this.drawGrid(ctx, padding, width, height, minVal, maxVal, percentages.length);
        
        // Linea zero
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const zeroY = padding.top + height - ((0 - minVal) / (maxVal - minVal)) * height;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(padding.left + width, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        this.drawAxes(ctx, padding, width, height, percentages.map(p => `${p}%`), minVal, maxVal, '€ (differenza)');

        datasets.forEach(dataset => {
            this.drawLine(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color, 2);
            this.drawPoints(ctx, dataset.data, padding, width, height, minVal, maxVal, dataset.color);
        });

        this.updateLegend(legendId, datasets, '€');
        this.addTooltip(canvas, datasets, percentages.map(p => `${p}%`), padding, width, height, minVal, maxVal, '€');
    }

    /**
     * Aggiorna KPI nel header compatto
     */
    updateKPIs(data) {
        if (!data || data.length === 0) return;

        // Trova costo minimo assoluto e percentuale corrispondente
        let minCost = Infinity;
        let optimalPercentage = 0;
        let maxSavings = 0;

        data.forEach(item => {
            const costoMin = item.costi?.costo_minimo?.[0] || Infinity;
            const attuale = item.costi?.attuale?.[0] || 0;
            const risparmio = item.risparmio_possibile?.[0] || 0;

            if (costoMin < minCost) {
                minCost = costoMin;
                optimalPercentage = item.percentage;
            }

            if (risparmio > maxSavings) {
                maxSavings = risparmio;
            }
        });

        const optPercEl = document.getElementById('comparison-kpi-optimal-percentage');
        const minCostEl = document.getElementById('comparison-kpi-min-cost');
        const maxSavingsEl = document.getElementById('comparison-kpi-max-savings');

        if (optPercEl) optPercEl.textContent = this.formatNumber(optimalPercentage, 1);
        if (minCostEl) minCostEl.textContent = this.formatNumber(minCost, 0);
        if (maxSavingsEl) maxSavingsEl.textContent = this.formatNumber(maxSavings, 0);
    }

    /**
     * Metodi helper per disegno (riutilizzati da charts.js)
     */
    drawGrid(ctx, padding, width, height, minVal, maxVal, numPoints) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;

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
        ctx.translate(20, padding.top + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.fillText(unit, 0, 0);
        ctx.restore();

        // Asse X
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        
        const maxLabels = width < 600 ? 6 : labels.length;
        const step = Math.ceil(labels.length / maxLabels);
        
        labels.forEach((label, i) => {
            if (i % step === 0 || i === labels.length - 1) {
                const x = padding.left + (width / (labels.length - 1)) * i;
                ctx.fillText(label, x, padding.top + height + 25);
            }
        });
    }

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

    updateLegend(legendId, datasets, unit) {
        const legendEl = document.getElementById(legendId);
        if (!legendEl) return;

        legendEl.innerHTML = '';
        
        datasets.forEach(dataset => {
            const totale = dataset.data.reduce((a, b) => a + b, 0);
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
            value.textContent = `(${this.formatNumber(totale)} ${unit})`;
            
            item.appendChild(colorBox);
            item.appendChild(label);
            item.appendChild(value);
            legendEl.appendChild(item);
        });
    }

    addTooltip(canvas, datasets, labels, padding, width, height, minVal, maxVal, unit) {
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
            const dataWidth = width;
            const index = Math.round((relativeX / dataWidth) * (labels.length - 1));

            if (index < 0 || index >= labels.length) {
                tooltip.classList.remove('visible');
                if (canvasSnapshot) {
                    ctx.putImageData(canvasSnapshot, 0, 0);
                }
                return;
            }

            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
                const x = padding.left + (width / (labels.length - 1)) * index;
                
                // Disegna linea verticale
                ctx.save();
                ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + height);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Disegna punti
                datasets.forEach(dataset => {
                    const value = dataset.data[index];
                    const y = padding.top + height - ((value - minVal) / (maxVal - minVal)) * height;
                    
                    ctx.fillStyle = dataset.color + '40';
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.strokeStyle = dataset.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.stroke();
                });
                
                ctx.restore();
            }

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
            if (canvasSnapshot) {
                ctx.putImageData(canvasSnapshot, 0, 0);
            }
        });
    }
}

// Istanza globale
let comparisonChartRenderer = null;

// Inizializza il renderer
function initComparisonChartRenderer() {
    comparisonChartRenderer = new ComparisonChartRenderer(CONFIG);
}
