// Production Optimization Dashboard Initialization
const ProdOptiApp = {
    chartRenderer: null,
    currentYear: '2024',
    currentSeason: 'winter',
    currentPanelConfig: 'one_solar_panel',
    currentSpan: 'all',
    dailyAggregate: true,
    ganttViewMode: 'both', // 'both', 'original', 'optimized'
    timeShiftingData: null,
    timetableData: null,
    // Declare available datasets per year to prevent invalid selections
    dataAvailability: {
        '2024': ['winter', 'spring', 'summer', 'fall'],
        '2025': ['winter', 'spring', 'summer'],
    },

    async init() {
        this.showLoading();
        this.chartRenderer = new OptProdChartRenderer({ locale: 'it-IT' });
        
        // Debug: Check if methods exist
        console.log('Available methods:', {
            drawGanttChart: typeof this.chartRenderer.drawGanttChart,
            drawShiftTranslationChart: typeof this.chartRenderer.drawShiftTranslationChart,
            drawStackedAreaChart: typeof this.chartRenderer.drawStackedAreaChart,
            drawDualAxisLineChart: typeof this.chartRenderer.drawDualAxisLineChart
        });
        
        // Ensure filters reflect available datasets
        this.refreshSeasonOptions();
        this.setupEventListeners();
        await this.loadData();
        this.renderAllCharts();
        this.updateLastUpdateTime();
        this.hideLoading();
    },

    async loadData() {
        try {
            const tsUrl = `prodopti/data/${this.currentYear}/${this.currentSeason}/time_shifting.json`;
            const ttUrl = `prodopti/data/${this.currentYear}/${this.currentSeason}/${this.currentPanelConfig}/timetable.csv`;
            
            const [tsRes, ttRes] = await Promise.all([fetch(tsUrl), fetch(ttUrl)]);
            
            if (!tsRes.ok || !ttRes.ok) {
                // Try to fallback to first available season for the selected year
                const availableSeasons = this.dataAvailability[this.currentYear] || [];
                const fallbackSeason = availableSeasons[0];
                const currentCombo = `${this.currentSeason} ${this.currentYear}`;
                if (fallbackSeason && fallbackSeason !== this.currentSeason) {
                    console.warn(`Dataset missing for ${currentCombo}. Falling back to ${fallbackSeason} ${this.currentYear}.`);
                    this.currentSeason = fallbackSeason;
                    // Reflect UI
                    const seasonSel = document.getElementById('season-select');
                    if (seasonSel) seasonSel.value = this.currentSeason;
                    // Retry once with fallback
                    const retryUrlTs = `prodopti/data/${this.currentYear}/${this.currentSeason}/time_shifting.json`;
                    const retryUrlTt = `prodopti/data/${this.currentYear}/${this.currentSeason}/${this.currentPanelConfig}/timetable.csv`;
                    const [rTs, rTt] = await Promise.all([fetch(retryUrlTs), fetch(retryUrlTt)]);
                    if (!rTs.ok || !rTt.ok) {
                        alert(`Dati non disponibili per ${currentCombo}.`);
                        return false;
                    }
                    this.timeShiftingData = await rTs.json();
                    this.timetableData = this.parseCSV(await rTt.text());
                    return true;
                } else {
                    alert(`Dati non disponibili per ${currentCombo}.`);
                    console.warn(`Data not available for ${currentCombo}`);
                    return false;
                }
            }
            
            this.timeShiftingData = await tsRes.json();
            this.timetableData = this.parseCSV(await ttRes.text());
            
            console.log('Data loaded:', { 
                year: this.currentYear,
                season: this.currentSeason,
                panels: this.currentPanelConfig,
                phases: Object.keys(this.timeShiftingData.phases).length, 
                rows: this.timetableData.length 
            });
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            alert(`Error loading data: ${error.message}`);
            return false;
        }
    },

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',');
            if (values.length !== headers.length) continue;
            
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                let value = values[j].trim();
                if (header !== 'time' && value !== '' && !isNaN(value)) {
                    value = parseFloat(value);
                }
                obj[header] = value;
            }
            data.push(obj);
        }
        return data;
    },

    formatNumber(num, decimals = 0) {
        if (num == null || isNaN(num)) return '--';
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '&thinsp;');
    },

    filterDataBySpan(data, span) {
        if (!data || data.length === 0) return data;
        
        // Apply daily aggregation if enabled
        if (this.dailyAggregate && span === 'all') {
            return this.aggregateToDaily(data);
        }
        
        // If daily aggregation is disabled, downsample data to avoid freezing
        // Keep every Nth point to reduce chart complexity while maintaining trends
        if (span === 'all' && !this.dailyAggregate) {
            const maxPoints = 500; // Maximum points to display
            if (data.length > maxPoints) {
                const step = Math.ceil(data.length / maxPoints);
                return data.filter((_, i) => i % step === 0 || i === data.length - 1);
            }
            return data;
        }
        
        const firstDate = new Date(data[0].time);
        let cutoffDate;
        
        switch (span) {
            case 'day': cutoffDate = new Date(firstDate.getTime() + 24 * 60 * 60 * 1000); break;
            case 'week': cutoffDate = new Date(firstDate.getTime() + 7 * 24 * 60 * 60 * 1000); break;
            case 'month': cutoffDate = new Date(firstDate); cutoffDate.setMonth(cutoffDate.getMonth() + 1); break;
            default: return data;
        }
        
        return data.filter(entry => new Date(entry.time) < cutoffDate);
    },

    aggregateToDaily(data) {
        
        // Group data by date (day)
        const dailyGroups = {};
        
        data.forEach(entry => {
            const date = new Date(entry.time);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            if (!dailyGroups[dateKey]) {
                dailyGroups[dateKey] = [];
            }
            dailyGroups[dateKey].push(entry);
        });
        
        // Aggregate each day's data
        const aggregated = [];
        
        Object.keys(dailyGroups).sort().forEach(dateKey => {
            const dayEntries = dailyGroups[dateKey];
            const numEntries = dayEntries.length;
            
            // Sum all numeric fields
            const aggregatedEntry = {
                time: dateKey, // Use date as label
                price_of_electricity: 0,
                cost_original_production_plan: 0,
                cost_optimized_production_plan: 0,
                co2_emissions: 0,
                generated_electricity_solar: 0,
                generated_electricity_cogenerator: 0,
                used_electricity_production_phases: 0,
                wasted_generated_electricity: 0,
                pw_used_by_chiller_from_generated_sources: 0,
                pw_used_by_chiller_from_grid: 0,
                chiller_max_temp: 0,
                chiller_min_temp: 0,
                chiller_target_temp: 0,
                chiller_actual_temp: 0,
                outside_temp: 0
            };
            
            dayEntries.forEach(entry => {
                aggregatedEntry.price_of_electricity += entry.price_of_electricity || 0;
                aggregatedEntry.cost_original_production_plan += entry.cost_original_production_plan || 0;
                aggregatedEntry.cost_optimized_production_plan += entry.cost_optimized_production_plan || 0;
                aggregatedEntry.co2_emissions += entry.co2_emissions || 0;
                aggregatedEntry.generated_electricity_solar += entry.generated_electricity_solar || 0;
                aggregatedEntry.generated_electricity_cogenerator += entry.generated_electricity_cogenerator || 0;
                aggregatedEntry.used_electricity_production_phases += entry.used_electricity_production_phases || 0;
                aggregatedEntry.wasted_generated_electricity += entry.wasted_generated_electricity || 0;
                aggregatedEntry.pw_used_by_chiller_from_generated_sources += entry.pw_used_by_chiller_from_generated_sources || 0;
                aggregatedEntry.pw_used_by_chiller_from_grid += entry.pw_used_by_chiller_from_grid || 0;
                aggregatedEntry.chiller_max_temp += entry.chiller_max_temp || 0;
                aggregatedEntry.chiller_min_temp += entry.chiller_min_temp || 0;
                aggregatedEntry.chiller_target_temp += entry.chiller_target_temp || 0;
                aggregatedEntry.chiller_actual_temp += entry.chiller_actual_temp || 0;
                aggregatedEntry.outside_temp += entry.outside_temp || 0;
            });
            
            // Average for prices and temperatures
            aggregatedEntry.price_of_electricity /= numEntries;
            aggregatedEntry.chiller_max_temp /= numEntries;
            aggregatedEntry.chiller_min_temp /= numEntries;
            aggregatedEntry.chiller_target_temp /= numEntries;
            aggregatedEntry.chiller_actual_temp /= numEntries;
            aggregatedEntry.outside_temp /= numEntries;
            
            aggregated.push(aggregatedEntry);
        });
        
        return aggregated;
    },

    updateKPIs() {
        if (!this.timetableData || this.timetableData.length === 0) return;

        // Compute KPIs strictly from CSV columns, ignoring time_shifting.json metadata
        let totalOriginalCost = 0;
        let totalOptimizedCost = 0;

        for (let entry of this.timetableData) {
            totalOriginalCost += entry.cost_original_production_plan || 0;
            totalOptimizedCost += entry.cost_optimized_production_plan || 0;
        }

        // If original column is missing in older CSVs, fall back to previous estimation method
        if (!(totalOriginalCost > 0) && totalOptimizedCost > 0) {
            let energyCostGridOptimized = 0;
            let energyCostGridBaseline = 0;
            for (let entry of this.timetableData) {
                const price = entry.price_of_electricity || 0;
                const used = entry.used_electricity_production_phases || 0;
                const genSolar = entry.generated_electricity_solar || 0;
                const genCoge = entry.generated_electricity_cogenerator || 0;
                const chillerGrid = entry.pw_used_by_chiller_from_grid || 0;
                // Grid after optimization
                const gridPurchaseOptimized = Math.max(0, used - (genSolar + genCoge)) + chillerGrid;
                energyCostGridOptimized += price * gridPurchaseOptimized;
                // Baseline grid (no renewables alignment)
                const gridPurchaseBaseline = used + chillerGrid;
                energyCostGridBaseline += price * gridPurchaseBaseline;
            }
            totalOriginalCost = totalOptimizedCost - energyCostGridOptimized + energyCostGridBaseline;
            if (!isFinite(totalOriginalCost) || totalOriginalCost <= 0) totalOriginalCost = totalOptimizedCost;
        }

        const denom = totalOriginalCost > 0 ? totalOriginalCost : 1;
        const savingsPercent = Math.max(0, Math.min(100, ((totalOriginalCost - totalOptimizedCost) / denom) * 100));

        // CO2 from timetable
        let totalCO2 = 0;
        for (let entry of this.timetableData) totalCO2 += entry.co2_emissions || 0;

        // Update DOM
        document.getElementById('kpi-original-cost').innerHTML = this.formatNumber(totalOriginalCost, 2);
        document.getElementById('kpi-optimized-cost').innerHTML = this.formatNumber(totalOptimizedCost, 2);
        document.getElementById('kpi-savings-percent').innerHTML = this.formatNumber(savingsPercent, 1);
        document.getElementById('kpi-co2-emissions').innerHTML = this.formatNumber(totalCO2, 0);

        // Draw savings sparkline (CSV-derived only)
        try {
            const seriesSource = this.dailyAggregate ? this.aggregateToDaily(this.timetableData) : this.timetableData;
            const savingsSeries = [];
            for (const e of seriesSource) {
                const orig = (e.cost_original_production_plan || 0);
                const opti = (e.cost_optimized_production_plan || 0);
                const denomDay = orig > 0 ? orig : 1;
                const s = Math.max(0, Math.min(100, ((orig - opti) / denomDay) * 100));
                savingsSeries.push(s);
            }
            this.chartRenderer.drawSparkline('sparkline-savings', savingsSeries, {
                color: '#10b981',
                lineWidth: 2,
                fill: true,
                topPadding: 4,
                bottomPadding: 4
            });
        } catch (e) {
            console.warn('Sparkline render skipped:', e);
        }
    },

    toggleGanttView() {
        // Cycle through: both -> optimized -> original -> both
        if (this.ganttViewMode === 'both') {
            this.ganttViewMode = 'optimized';
        } else if (this.ganttViewMode === 'optimized') {
            this.ganttViewMode = 'original';
        } else {
            this.ganttViewMode = 'both';
        }
        
        // Update button text and description
        const btn = document.getElementById('gantt-toggle-btn');
        const desc = document.getElementById('gantt-description');
        
        if (this.ganttViewMode === 'both') {
            btn.innerHTML = '🔄 Vedi Solo Ottimizzati';
            desc.textContent = 'Confronto visivo tra i turni originali (bordo) e i turni ottimizzati (riempimento)';
        } else if (this.ganttViewMode === 'optimized') {
            btn.innerHTML = '↩️ Vedi Solo Originali';
            desc.textContent = 'Visualizzazione dei turni ottimizzati (spostati nel tempo)';
        } else {
            btn.innerHTML = '🔀 Confronta Entrambi';
            desc.textContent = 'Visualizzazione dei turni originali della produzione';
        }
        
        // Redraw only the Gantt chart
        if (this.timeShiftingData) {
            this.chartRenderer.drawGanttChart('chart-gantt', this.timeShiftingData, { 
                shadeShifts: true,
                viewMode: this.ganttViewMode 
            });
        }
    },

    renderAllCharts() {
        this.updateKPIs();
        
        if (this.timeShiftingData) {
            this.chartRenderer.drawGanttChart('chart-gantt', this.timeShiftingData, { 
                shadeShifts: true,
                viewMode: this.ganttViewMode 
            });
            this.chartRenderer.drawShiftTranslationChart('chart-time-shift', this.timeShiftingData, { legendId: 'legend-time-shift', sortByAbs: true });
        }
        
        if (this.timetableData) {
            const filtered = this.filterDataBySpan(this.timetableData, this.currentSpan);
            
            // Energy Consumption - align aesthetics with index.html (Fabbisogni & Produzione Elettrica)
            const solarGen = filtered.map(d => d.generated_electricity_solar || 0);
            const cogeGen = filtered.map(d => d.generated_electricity_cogenerator || 0);
            const fabbisognoEE = filtered.map(d => d.used_electricity_production_phases || 0);
            // Compute grid purchase as residual: fabbisogno - (FV + Coge), clamped to >= 0
            const acquistoRete = fabbisognoEE.map((v, i) => {
                const residual = v - ((solarGen[i] || 0) + (cogeGen[i] || 0));
                return Math.max(0, residual);
            });

            this.chartRenderer.drawStackedAreaChart('chart-energy-consumption', {
                labels: filtered.map(d => d.time),
                datasets: [
                    { label: 'Acquisto Rete', data: acquistoRete, color: '#ef4444' },
                    { label: 'Fotovoltaico', data: solarGen, color: '#fbbf24' },
                    { label: 'Cogeneratore', data: cogeGen, color: '#3b82f6' }
                ],
                referenceLine: fabbisognoEE
            }, 'legend-energy-consumption', { 
                showWeekends: true,
                unit: 'kWh',
                referenceColor: '#1f2937',
                referenceLabel: 'Fabbisogno Totale',
                referenceDash: [5, 5]
            });
            
            // Surplus & Prices - enhance aesthetics with soft area fill under surplus
            this.chartRenderer.drawDualAxisLineChart('chart-surplus-prices', {
                labels: filtered.map(d => d.time),
                leftAxis: {
                    'Energia Non Utilizzata': filtered.map(d => d.wasted_generated_electricity)
                },
                rightAxis: {
                    'Prezzo Elettricità': filtered.map(d => d.price_of_electricity)
                }
            }, {
                leftColors: { 'Energia Non Utilizzata': '#ef4444' },
                rightColors: { 'Prezzo Elettricità': '#22c55e' },
                leftAxisLabel: 'Surplus (kW)',
                rightAxisLabel: 'Prezzo (€/kWh)',
                showPoints: false,
                fillLeft: true,
                leftFillOpacity: 0.18,
                legendId: 'legend-surplus-prices'
            });
            
            // Chiller Control - Filter outliers
            const chillerFromGen = filtered.map(d => d.pw_used_by_chiller_from_generated_sources);
            const chillerFromGrid = filtered.map(d => d.pw_used_by_chiller_from_grid);
            
            // Calculate outlier threshold (using IQR method)
            const calculateOutlierThreshold = (data) => {
                const sorted = [...data].sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length * 0.25)];
                const q3 = sorted[Math.floor(sorted.length * 0.75)];
                const iqr = q3 - q1;
                return q3 + 1.5 * iqr;
            };
            
            const maxThreshold = Math.max(
                calculateOutlierThreshold(chillerFromGen),
                calculateOutlierThreshold(chillerFromGrid)
            );
            
            const chillerGenClamped = chillerFromGen.map(v => Math.min(v, maxThreshold));
            const chillerGridClamped = chillerFromGrid.map(v => Math.min(v, maxThreshold));
            const totalChiller = chillerGenClamped.map((v, i) => v + (chillerGridClamped[i] || 0));

            this.chartRenderer.drawStackedAreaChart('chart-chiller-control', {
                labels: filtered.map(d => d.time),
                datasets: [
                    { label: 'Da Fonti Generate', data: chillerGenClamped, color: '#22c55e', opacity: 0.6 },
                    { label: 'Da Rete', data: chillerGridClamped, color: '#ef4444', opacity: 0.5, pattern: true }
                ],
                referenceLine: totalChiller
            }, 'legend-chiller-control', { 
                showWeekends: true,
                unit: 'kW',
                referenceColor: '#1f2937',
                referenceLabel: 'Totale Potenza Chiller',
                referenceDash: [5, 5]
            });
            
            // Chiller Temperature
            const tempData = {
                labels: filtered.map(d => d.time),
                leftAxis: {
                    'Max Temp': filtered.map(d => d.chiller_max_temp),
                    'Min Temp': filtered.map(d => d.chiller_min_temp),
                    'Target Temp': filtered.map(d => d.chiller_target_temp),
                    'Actual Temp': filtered.map(d => d.chiller_actual_temp),
                    'Outside Temp': filtered.map(d => d.outside_temp)
                },
                rightAxis: {}
            };
            
            // Calculate dynamic Y-axis range
            const allTempValues = [
                ...tempData.leftAxis['Max Temp'],
                ...tempData.leftAxis['Min Temp'],
                ...tempData.leftAxis['Target Temp'],
                ...tempData.leftAxis['Actual Temp'],
                ...tempData.leftAxis['Outside Temp']
            ];
            const tempMin = Math.min(...allTempValues) - 1;
            const tempMax = Math.max(...allTempValues) + 1;
            
            const tempOptions = {
                leftColors: {
                    'Max Temp': '#ef4444',
                    'Min Temp': '#3b82f6',
                    'Target Temp': '#f97316',
                    'Actual Temp': '#22c55e'
                },
                rightColors: {
                    'Outside Temp': '#94a3b8'
                },
                leftLabels: {
                    'Max Temp': 'Temp massima',
                    'Min Temp': 'Temp minima',
                    'Target Temp': 'Target',
                    'Actual Temp': 'Temp cella frigo'
                },
                rightLabels: {
                    'Outside Temp': 'Temp esterna'
                },
                leftAxisLabel: 'Temperatura (°C)',
                rightAxisLabel: 'Temp Esterna (°C)',
                leftMin: tempMin,
                leftMax: tempMax,
                // Emphasize Actual Temp and dash Target
                leftLineWidths: { 'Actual Temp': 3 },
                leftLineWidth: 2,
                showPoints: false,
                // Shade the Min–Max band for better readability
                fillBandLeft: { lowerKey: 'Min Temp', upperKey: 'Max Temp', color: '#94a3b8', opacity: 0.12 },
                showWeekends: true
            };

            // Move Outside Temp to right axis for clarity
            tempData.rightAxis = { 'Outside Temp': tempData.leftAxis['Outside Temp'] };
            delete tempData.leftAxis['Outside Temp'];

            // Add legend like in chiller control
            tempOptions.legendId = 'legend-chiller-temperature';
            this.chartRenderer.drawDualAxisLineChart('chart-chiller-temperature', tempData, tempOptions);
            
            this.updateChillerParameters();
        }
    },

    updateChillerParameters() {
        document.getElementById('chiller-nominal-capacity').textContent = this.formatNumber(10.0, 1);
        document.getElementById('chiller-cooling-rate').textContent = this.formatNumber(3.0, 1);
        document.getElementById('chiller-efficiency').textContent = this.formatNumber(1.0, 1);
        document.getElementById('room-surface-area').textContent = this.formatNumber(100, 0);
        document.getElementById('room-u-value').textContent = this.formatNumber(0.5, 1);
        
        if (this.timetableData && this.timetableData.length > 0) {
            const first = this.timetableData[0];
            document.getElementById('sim-max-temp').textContent = first.chiller_max_temp.toFixed(1);
            document.getElementById('sim-min-temp').textContent = first.chiller_min_temp.toFixed(1);
            document.getElementById('sim-target-temp').textContent = first.chiller_target_temp.toFixed(1);
        }
        
        document.getElementById('sim-proportional-gain').textContent = '0.5';
        document.getElementById('sim-derivative-gain').textContent = '0.1';
    },

    setupEventListeners() {
        document.getElementById('year-select').addEventListener('change', async (e) => {
            this.showLoading();
            this.currentYear = e.target.value;
            // Adjust season options and ensure valid selection
            this.refreshSeasonOptions();
            await this.loadData();
            this.renderAllCharts();
            this.hideLoading();
        });
        
        document.getElementById('season-select').addEventListener('change', async (e) => {
            this.showLoading();
            this.currentSeason = e.target.value;
            await this.loadData();
            this.renderAllCharts();
            this.hideLoading();
        });
        
        document.getElementById('panel-select').addEventListener('change', async (e) => {
            this.showLoading();
            this.currentPanelConfig = e.target.value;
            await this.loadData();
            this.renderAllCharts();
            this.hideLoading();
        });
        
        document.getElementById('plot-span-select').addEventListener('change', (e) => {
            this.currentSpan = e.target.value;
            this.renderAllCharts();
        });
        
        document.getElementById('daily-aggregate-toggle').addEventListener('change', (e) => {
            this.dailyAggregate = e.target.checked;
            this.renderAllCharts();
        });
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.renderAllCharts(), 250);
        });
        
        // Setup chart resize functionality
        this.setupChartResize();
    },

    refreshSeasonOptions() {
        const seasonSel = document.getElementById('season-select');
        if (!seasonSel) return;
        const available = this.dataAvailability[this.currentYear] || [];

        // Rebuild options so only available seasons are selectable
        const labels = {
            winter: 'Inverno (Gen-Mar)',
            spring: 'Primavera (Mar-Giu)',
            summer: 'Estate (Giu-Set)',
            fall: 'Autunno (Set-Dic)'
        };

        // Preserve current selection if still available, otherwise switch to first available
        const desiredSeason = available.includes(this.currentSeason) ? this.currentSeason : available[0];

        // Clear and repopulate
        seasonSel.innerHTML = '';
        available.forEach(seasonKey => {
            const opt = document.createElement('option');
            opt.value = seasonKey;
            opt.textContent = labels[seasonKey] || seasonKey;
            seasonSel.appendChild(opt);
        });

        if (desiredSeason) {
            this.currentSeason = desiredSeason;
            seasonSel.value = desiredSeason;
        }
    },
    
    setupChartResize() {
        const containers = document.querySelectorAll('.chart-container[data-chart-id]');
        
        containers.forEach(container => {
            const chartId = container.getAttribute('data-chart-id');
            const handle = container.querySelector('.chart-resize-handle');
            
            if (!handle) return;
            
            // Load saved height from cookie
            const savedHeight = this.getChartHeight(chartId);
            if (savedHeight) {
                container.style.height = savedHeight + 'px';
            }
            
            let isResizing = false;
            let startY = 0;
            let startHeight = 0;
            
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = container.offsetHeight;
                container.classList.add('resizing');
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const deltaY = e.clientY - startY;
                const newHeight = Math.max(250, startHeight + deltaY); // Min height 250px
                container.style.height = newHeight + 'px';
                
                // Trigger chart redraw
                this.renderAllCharts();
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    container.classList.remove('resizing');
                    document.body.style.cursor = '';
                    
                    // Save height to cookie
                    this.saveChartHeight(chartId, container.offsetHeight);
                }
            });
        });
    },
    
    saveChartHeight(chartId, height) {
        // Save to cookie with 365 days expiration
        const expires = new Date();
        expires.setDate(expires.getDate() + 365);
        document.cookie = `chart_height_${chartId}=${height}; expires=${expires.toUTCString()}; path=/`;
    },
    
    getChartHeight(chartId) {
        const name = `chart_height_${chartId}=`;
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookieArray = decodedCookie.split(';');
        
        for (let i = 0; i < cookieArray.length; i++) {
            let cookie = cookieArray[i].trim();
            if (cookie.indexOf(name) === 0) {
                return parseInt(cookie.substring(name.length, cookie.length));
            }
        }
        return null;
    },

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'flex';
    },

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    updateLastUpdateTime() {
        const el = document.getElementById('last-update');
        if (el) {
            el.textContent = new Date().toLocaleDateString('it-IT', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('OptProdChartRenderer class:', OptProdChartRenderer);
    console.log('OptProdChartRenderer.prototype methods:', Object.getOwnPropertyNames(OptProdChartRenderer.prototype));
    ProdOptiApp.init();
});
