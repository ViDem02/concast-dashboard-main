// App Controller - Inizializzazione e gestione dashboard

class DashboardApp {
    constructor() {
        this.currentYear = 'all'; // Default su tutti gli anni (2024-2025)
        this.currentMonth = null;
        this.currentWeek = null; // { startDay, endDay }
        this.isLoading = false;
        this.fvOptimized = false; // Flag per fotovoltaico ottimizzato
        this.useCogen350 = false; // Flag per variante cogeneratore 350 kW
        this.comparisonCurrentYear = '2025'; // Anno corrente nella sezione confronto
        this.comparisonYearSelectIsUpdating = false; // Flag per prevenire loop nel selettore anno confronto
    }

    /**
     * Inizializza l'applicazione
     */
    async init() {
        console.log('Inizializzazione dashboard...');

        try {
            // Mostra loading
            this.showLoading();

            // Inizializza componenti
            initDataProcessor();
            initChartRenderer();
            initComparisonChartRenderer();
            initThermalDataProcessor();

            // Dashboard principale: usa dati V3; carica anche V4 per il solo grafico termico
            dataLoader.setBasePath('data');
            dataLoaderV4.setBasePath('data_v4');

            // Carica tutti i dati (normal/fv12 + varianti 350) per V3 e V4 in parallelo
            await Promise.all([
                dataLoader.loadAll(this.fvOptimized, this.useCogen350),
                dataLoaderV4.loadAll(this.fvOptimized, this.useCogen350)
            ]);

            // Popola selettori
            this.populateSelectors();

            // Imposta stato iniziale fotovoltaico ottimizzato
            dataProcessor.setFVOptimized(this.fvOptimized);
            dataProcessor.setCogen350Enabled(this.useCogen350);
            thermalDataProcessor.setFVOptimized(this.fvOptimized);
            thermalDataProcessor.setCogen350Enabled(this.useCogen350);

            // Carica vista iniziale (anno completo)
            await this.loadView(this.currentYear, this.currentMonth);

            // Setup event listeners
            this.setupEventListeners();

            // Carica inizialmente la sezione confronto (default 2025 se disponibile)
            await this.initializeComparisonSection();

            // Nascondi loading
            this.hideLoading();

            // Aggiorna timestamp
            this.updateTimestamp();

            console.log('Dashboard inizializzata con successo!');

        } catch (error) {
            console.error('Errore inizializzazione dashboard:', error);
            alert('Errore nel caricamento dei dati. Ricarica la pagina.');
        }
    }

    /**
     * Mostra overlay loading
     */
    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
        this.isLoading = true;
    }

    /**
     * Nascondi overlay loading
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.isLoading = false;
    }

    /**
     * Popola i selettori anno/mese
     */
    populateSelectors() {
        // Selettore anno
        const yearSelect = document.getElementById('year-select');

        // Aggiungi opzione "Tutti" per visualizzare tutto il periodo
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Tutti (2024-2025)';
        yearSelect.appendChild(allOption);

        const years = dataLoader.getAvailableYears();
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        yearSelect.value = this.currentYear;

        // Selettore mese
        this.updateMonthSelector(this.currentYear);
    }

    /**
     * Aggiorna selettore mesi in base all'anno
     */
    updateMonthSelector(year) {
        const monthSelect = document.getElementById('month-select');
        monthSelect.innerHTML = '<option value="">Tutti i mesi</option>';

        // Se "all" è selezionato, disabilita il selettore mesi
        if (year === 'all') {
            monthSelect.disabled = true;
            this.resetWeekSelector();
            return;
        }

        monthSelect.disabled = false;
        const months = dataLoader.getAvailableMonths(year);
        months.forEach(month => {
            const monthNum = parseInt(month);
            const option = document.createElement('option');
            option.value = month;
            option.textContent = CONFIG.labels.mesi_full[monthNum - 1];
            monthSelect.appendChild(option);
        });

        // Reset e disabilita selettore settimane quando cambia anno
        this.resetWeekSelector();
    }

    /**
     * Aggiorna selettore settimane in base al mese
     */
    updateWeekSelector(year, month) {
        const weekSelect = document.getElementById('week-select');
        weekSelect.innerHTML = '<option value="">Tutto il mese</option>';

        const weeks = dataProcessor.getWeeksInMonth(year, month);
        weeks.forEach(week => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                startDate: week.startDate.toISOString(),
                endDate: week.endDate.toISOString()
            });
            option.textContent = week.label;
            weekSelect.appendChild(option);
        });

        // Abilita il selettore se ci sono settimane
        weekSelect.disabled = weeks.length === 0;
    }

    /**
     * Reset selettore settimane
     */
    resetWeekSelector() {
        const weekSelect = document.getElementById('week-select');
        weekSelect.innerHTML = '<option value="">Tutto il mese</option>';
        weekSelect.disabled = true;
        this.currentWeek = null;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Cambio anno aggiorna mesi e applica filtro automaticamente
        document.getElementById('year-select').addEventListener('change', (e) => {
            this.updateMonthSelector(e.target.value);
            this.applyFilter();
        });

        // Cambio mese aggiorna settimane e applica filtro automaticamente
        document.getElementById('month-select').addEventListener('change', (e) => {
            const month = e.target.value;
            if (month) {
                this.updateWeekSelector(this.currentYear, month);
            } else {
                this.resetWeekSelector();
            }
            this.applyFilter();
        });

        // Cambio settimana applica filtro automaticamente
        document.getElementById('week-select').addEventListener('change', (e) => {
            this.applyFilter();
        });

        // Checkbox fotovoltaico ottimizzato
        document.getElementById('fv-optimized-checkbox').addEventListener('change', async (e) => {
            this.fvOptimized = e.target.checked;
            console.log('Fotovoltaico ottimizzato:', this.fvOptimized ? 'Attivo' : 'Disattivo');

            // Switch immediato ai dati già caricati (zero fetch!)
            dataLoader.switchVersion(this.fvOptimized, this.useCogen350);

            // Aggiorna flag nel dataProcessor
            dataProcessor.setFVOptimized(this.fvOptimized);
            dataProcessor.setCogen350Enabled(this.useCogen350);

            // Ricarica la vista corrente (senza fetch!)
            await this.applyFilter();
        });

        // Checkbox cogeneratore 350 kW
        document.getElementById('cogen-350-checkbox').addEventListener('change', async (e) => {
            this.useCogen350 = e.target.checked;
            console.log('Profilo cogeneratore 350 kW:', this.useCogen350 ? 'Attivo' : 'Disattivo');

            dataLoader.switchVersion(this.fvOptimized, this.useCogen350);
            dataProcessor.setCogen350Enabled(this.useCogen350);

            await this.applyFilter();
        });

        // Selettore anno sezione confronto (INDIPENDENTE)
        const comparisonYearSelect = document.getElementById('comparison-year-select');
        if (comparisonYearSelect) {
            comparisonYearSelect.addEventListener('change', async (e) => {
                // Preveni loop durante aggiornamenti programmatici
                if (this.comparisonYearSelectIsUpdating) {
                    return;
                }

                const selectedYear = e.target.value;
                // Ignora se l'opzione è disabilitata
                if (e.target.options[e.target.selectedIndex].disabled) {
                    console.warn(`Anno ${selectedYear} non disponibile`);
                    // Ripristina selezione precedente
                    this.comparisonYearSelectIsUpdating = true;
                    e.target.value = this.comparisonCurrentYear || '2025';
                    setTimeout(() => {
                        this.comparisonYearSelectIsUpdating = false;
                    }, 100);
                    return;
                }

                // Ignora se è lo stesso anno già caricato
                if (selectedYear === this.comparisonCurrentYear) {
                    return;
                }

                console.log(`Cambio anno confronto a ${selectedYear}`);
                this.comparisonCurrentYear = selectedYear;
                await this.updateComparisonSection(selectedYear);
            });
        }

        // Rimozione selettore aggregazione FV (ora è automatica)

        // Window resize - ridisegna grafici
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!this.isLoading) {
                    this.redrawCharts();
                }
            }, 300);
        });
    }

    /**
     * Ricarica i dati (con flag FV/350) e ridisegna la vista + confronto.
     */
    async reloadDataWithCurrentFlags() {
        this.showLoading();
        try {
            await dataLoader.loadAll(this.fvOptimized, this.useCogen350);
            dataProcessor.setFVOptimized(this.fvOptimized);
            dataProcessor.setCogen350Enabled(this.useCogen350);
            await this.applyFilter();
            await this.initializeComparisonSection();
        } catch (err) {
            console.error('Errore nel ricaricare i dati:', err);
            alert('Errore durante il ricaricamento dei dati. Riprovare.');
        } finally {
            this.hideLoading();
            this.updateTimestamp();
        }
    }

    /**
     * Applica filtro temporale
     */
    async applyFilter() {
        const year = document.getElementById('year-select').value;
        const month = document.getElementById('month-select').value;
        const weekValue = document.getElementById('week-select').value;
        const fvOptimized = document.getElementById('fv-optimized-checkbox').checked;
        const useCogen350 = document.getElementById('cogen-350-checkbox').checked;

        this.currentYear = year;
        this.currentMonth = month || null;
        this.currentWeek = weekValue ? JSON.parse(weekValue) : null;
        this.fvOptimized = fvOptimized;
        this.useCogen350 = useCogen350;

        // Aggiorna flag nel dataProcessor / dataLoader
        dataProcessor.setFVOptimized(this.fvOptimized);
        dataProcessor.setCogen350Enabled(this.useCogen350);
        dataLoader.switchVersion(this.fvOptimized, this.useCogen350);
        thermalDataProcessor.setFVOptimized(this.fvOptimized);
        thermalDataProcessor.setCogen350Enabled(this.useCogen350);
        dataLoaderV4.switchVersion(this.fvOptimized, this.useCogen350);

        await this.loadView(year, this.currentMonth, this.currentWeek);
    }

    /**
     * Carica vista (anno, mese o settimana)
     */
    async loadView(year, month, week = null) {
        this.showLoading();

        try {
            // Aggrega dati
            let data;
            let thermalData;
            if (year === 'all') {
                // Vista tutti gli anni
                data = dataProcessor.aggregateAllYearsData();
                thermalData = thermalDataProcessor.aggregateAllYearsData();
            } else if (week && month) {
                // Vista settimanale - converti date da ISO string
                const startDate = new Date(week.startDate);
                const endDate = new Date(week.endDate);
                data = dataProcessor.aggregateWeekData(year, startDate, endDate);
                thermalData = thermalDataProcessor.aggregateWeekData(year, startDate, endDate);
            } else if (month) {
                // Vista mensile
                data = dataProcessor.aggregateMonthData(year, month);
                thermalData = thermalDataProcessor.aggregateMonthData(year, month);
            } else {
                // Vista annuale
                data = dataProcessor.aggregateYearData(year);
                thermalData = thermalDataProcessor.aggregateYearData(year);
            }

            // Calcola KPI ed economics (nota: KPI per settimana usano gli stessi dati aggregati)
            const kpis = year === 'all'
                ? dataProcessor.calculateAllYearsKPIs()
                : dataProcessor.calculateKPIs(year, month);
            const economics = year === 'all'
                ? dataProcessor.calculateAllYearsEconomics()
                : dataProcessor.calculateEconomics(year, month);

            // Aggrega dati strategie (responsive a filtri)
            let strategies;
            if (year === 'all') {
                // Vista tutti gli anni (mensile)
                strategies = dataProcessor.aggregateAllYearsStrategies();
            } else if (week && month) {
                // Vista settimanale
                const startDate = new Date(week.startDate);
                const endDate = new Date(week.endDate);
                strategies = dataProcessor.aggregateWeekDataStrategies(year, startDate, endDate);
            } else if (month) {
                // Vista mensile (oraria)
                strategies = dataProcessor.aggregateMonthDataStrategies(year, month);
            } else {
                // Vista annuale (mensile)
                strategies = dataProcessor.aggregateYearStrategies(year);
            }

            // Calcola KPI strategie
            const isYearView = (!month && !week) || year === 'all';
            const strategyKPIs = dataProcessor.calculateStrategyKPIs(strategies, isYearView, year);

            // Aggrega dati comparazione FV ottimizzato
            const fvComparison = year === 'all'
                ? await dataProcessor.aggregateAllYearsFVOptimizationComparison()
                : await dataProcessor.aggregateFVOptimizationComparison(year, month, week);

            // Aggiorna UI
            this.updateKPIs(kpis, economics);
            this.updateCharts(data, thermalData);
            this.updateFVSavingsChart(fvComparison);
            this.updateEfficiency(kpis);
            this.updateStrategyCharts(strategies);
            this.updateStrategyKPIs(strategyKPIs);

            // Aggiorna sezione confronto cogeneratore (INDIPENDENTE dai filtri)
            // Non passa year perché la sezione ha il suo selettore dedicato
            await this.updateComparisonSection();

        } catch (error) {
            console.error('Errore caricamento vista:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Aggiorna KPI cards
     */
    updateKPIs(kpis, economics) {
        // Fabbisogno elettrico
        document.getElementById('kpi-ee-totale').textContent =
            this.formatNumber(kpis.fabbisogno_ee, 0);

        // Energia autoprodotta
        document.getElementById('kpi-autoprod').textContent =
            this.formatNumber(kpis.ee_autoprodotta, 0);

        // Tasso autoproduzione (% energia NON acquistata dalla rete)
        document.getElementById('kpi-autosufficienza').textContent =
            this.formatNumber(kpis.autosufficienza_ee_perc, 1);

        // Costo totale periodo
        document.getElementById('kpi-costo').textContent =
            this.formatNumber(economics.costo_totale, 0);

        // Valore autoproduzione (quanto avrebbe costato se comprata dalla rete)
        document.getElementById('kpi-risparmio').textContent =
            this.formatNumber(economics.risparmio_autoproduzione, 0);

        // Colora sempre verde (è sempre positivo - valore di energia autoprodotta)
        const risparmioEl = document.getElementById('kpi-risparmio');
        risparmioEl.style.color = '#10b981';

        // Trigger GSAP animations for KPI values
        if (window.animateKPIValues) {
            window.animateKPIValues();
        }
    }

    /**
     * Aggiorna tutti i grafici
     */
    updateCharts(data, thermalData) {
        // Grafico prezzi
        chartRenderer.drawLineChart('chart-prezzi', data);

        // Grafico fabbisogni EE
        chartRenderer.drawAreaChart('chart-ee', data, 'legend-ee');

        // Grafico termico unificato (stacked area con pattern tratteggiato)
        chartRenderer.drawThermalStackedChart('chart-termico', thermalData || data, 'legend-termico');
    }

    /**
     * Aggiorna grafico risparmio FV ottimizzato
     * NUOVO DESIGN: Barre affiancate Normal vs FV12
     * Aggregazione automatica in base al filtro corrente (anno/mese/settimana)
     */
    async updateFVSavingsChart(fvComparison) {
        try {
            // Verifica che i dati siano caricati prima di procedere
            if (!dataLoader.bothVersions || !dataLoader.bothVersions.normal || !dataLoader.bothVersions.fv12) {
                console.warn('⚠️ Dati FV non ancora caricati, riprovo tra poco...');
                // Riprova dopo un breve delay se i dati non sono ancora pronti
                setTimeout(() => {
                    if (dataLoader.bothVersions && dataLoader.bothVersions.normal && dataLoader.bothVersions.fv12) {
                        this.updateFVSavingsChart(fvComparison);
                    }
                }, 500);
                return;
            }

            console.log('Aggregazione FV in base al filtro corrente...');

            // Usa i dati pre-aggregati se disponibili, altrimenti ricalcola in base ai filtri
            let comparisonScenario = fvComparison;
            if (!comparisonScenario) {
                if (this.currentWeek && this.currentMonth && this.currentYear !== 'all') {
                    const startDate = new Date(this.currentWeek.startDate);
                    const endDate = new Date(this.currentWeek.endDate);
                    comparisonScenario = await dataProcessor.aggregateFVOptimizationComparison(
                        this.currentYear,
                        this.currentMonth,
                        { startDate, endDate }
                    );
                } else if (this.currentMonth && this.currentYear !== 'all') {
                    comparisonScenario = await dataProcessor.aggregateFVOptimizationComparison(
                        this.currentYear,
                        this.currentMonth
                    );
                } else if (this.currentYear !== 'all') {
                    comparisonScenario = await dataProcessor.aggregateFVOptimizationComparison(
                        this.currentYear
                    );
                } else {
                    comparisonScenario = await dataProcessor.aggregateAllYearsFVOptimizationComparison();
                }
            }

            if (!comparisonScenario) {
                throw new Error('Dati aggregati non validi');
            }

            // Converte lo scenario in dati per il grafico a barre (Produzione Normal vs FV12)
            const comparisonData = {
                labels: comparisonScenario.labels || [],
                normal: comparisonScenario.scenario_attuale_autoprod || [],
                fv12: comparisonScenario.scenario_opt_autoprod || [],
                fabbisogno: comparisonScenario.scenario_no_autoprod || []
            };

            // Verifica che i dati siano diversi
            const totalNormal = comparisonData.normal.reduce((a, b) => a + b, 0);
            const totalFV12 = comparisonData.fv12.reduce((a, b) => a + b, 0);

            // Calcola differenza percentuale
            const diffPercent = totalNormal > 0 ? (Math.abs(totalNormal - totalFV12) / totalNormal) * 100 : 0;

            if (Math.abs(totalNormal - totalFV12) < 0.01) {
                console.error('⚠️ ERRORE: I dati Normal e FV12 sono identici dopo aggregazione!');
                console.error('Normal:', comparisonData.normal);
                console.error('FV12:', comparisonData.fv12);
                console.error('Differenza percentuale:', diffPercent.toFixed(4) + '%');
                console.error('⚠️ PROBLEMA: I file JSON per Normal e FV12 contengono gli stessi valori!');
                console.error('⚠️ Verificare che i file JSON siano stati generati correttamente con dati diversi.');

                // Se siamo nel 2025, mostra banner "Non disponibile al momento" invece del grafico
                if (this.currentYear === '2025' || this.currentYear === 2025) {
                    console.warn('⚠️ Dati 2025 identici - Mostro banner "Non disponibile al momento"');
                    this.showFVUnavailableBanner();
                    // Non renderizzare il grafico per il 2025
                    return;
                }

                // Per altri anni, mostra warning ma continua con il rendering
                const yearInfo = this.currentYear !== 'all' ? ` per l'anno ${this.currentYear}` : '';
                this.showFVComparisonWarning(
                    `I dati Normal e FV12 risultano identici${yearInfo}. ` +
                    `Verificare che i file JSON contengano dati diversi per i due scenari.`
                );

                // Procediamo comunque con il rendering per non bloccare l'app
                console.warn('⚠️ Procedo comunque con il rendering del grafico (mostrerà colonne identiche)');
            } else if (diffPercent < 1) {
                console.warn(`⚠️ ATTENZIONE: I dati Normal e FV12 sono molto simili (differenza: ${diffPercent.toFixed(2)}%)`);
                // Nascondi warning e banner se i dati sono diversi (anche se simili)
                this.hideFVComparisonWarning();
                this.hideFVUnavailableBanner();
            } else {
                // Dati sono diversi - rimuovi eventuali warning precedenti e banner
                this.hideFVComparisonWarning();
                this.hideFVUnavailableBanner();
                console.log(`✅ Dati Normal e FV12 hanno differenze significative (${diffPercent.toFixed(2)}%)`);
            }

            // Usa il nuovo grafico a barre affiancate
            chartRenderer.drawFVComparisonBars('chart-fv-savings', comparisonData, 'legend-fv-savings');

        } catch (error) {
            console.error('Errore aggregazione FV:', error);
            // Mostra messaggio di errore o grafico vuoto
            const canvas = document.getElementById('chart-fv-savings');
            if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Mostra messaggio di errore sul canvas
                ctx.fillStyle = '#ef4444';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Errore nel caricamento dei dati', canvas.width / 4, canvas.height / 4);
            }
        }
    }

    /**
     * Aggiorna grafici strategie
     */
    updateStrategyCharts(strategies) {
        const labels = strategies.labels;

        // 1. Attuale vs Coge Spento
        chartRenderer.drawComparisonChart(
            'chart-strategy-spento',
            labels,
            { data: strategies.costo_attuale, color: '#ef4444', label: 'Attuale' },
            { data: strategies.costo_coge_spento, color: '#64748b', label: 'Coge Spento' },
            'legend-strategy-spento'
        );

        // 2. Attuale vs Coge Minimo
        chartRenderer.drawComparisonChart(
            'chart-strategy-minimo',
            labels,
            { data: strategies.costo_attuale, color: '#ef4444', label: 'Attuale' },
            { data: strategies.costo_coge_minimo, color: '#10b981', label: 'Coge Minimo' },
            'legend-strategy-minimo'
        );

        // 3. Attuale vs Ins Elettrico
        chartRenderer.drawComparisonChart(
            'chart-strategy-elettrico',
            labels,
            { data: strategies.costo_attuale, color: '#ef4444', label: 'Attuale' },
            { data: strategies.costo_coge_ins_elettrico, color: '#3b82f6', label: 'Ins Elettrico' },
            'legend-strategy-elettrico'
        );

        // 5. Attuale vs Coge Massimo
        chartRenderer.drawComparisonChart(
            'chart-strategy-massimo',
            labels,
            { data: strategies.costo_attuale, color: '#ef4444', label: 'Attuale' },
            { data: strategies.costo_coge_massimo, color: '#f59e0b', label: 'Coge Massimo' },
            'legend-strategy-massimo'
        );

        // 4. Attuale vs Ins Termico
        chartRenderer.drawComparisonChart(
            'chart-strategy-termico',
            labels,
            { data: strategies.costo_attuale, color: '#ef4444', label: 'Attuale' },
            { data: strategies.costo_coge_ins_termico, color: '#ec4899', label: 'Ins Termico' },
            'legend-strategy-termico'
        );

        // 5. BEST: Attuale vs Minimo (strategia ottimale)
        chartRenderer.drawComparisonChart(
            'chart-strategy-best',
            labels,
            { data: strategies.costo_attuale, color: '#ef4444', label: 'Attuale' },
            { data: strategies.minimo, color: '#10b981', label: 'Strategia Ottimale' },
            'legend-strategy-best'
        );
    }

    /**
     * Ridisegna grafici (per resize)
     */
    redrawCharts() {
        if (this.isLoading) return;

        let data;

        if (this.currentYear === 'all') {
            // Vista tutti gli anni
            data = dataProcessor.aggregateAllYearsData();
        } else if (this.currentWeek && this.currentMonth) {
            // Vista settimanale - converti date da ISO string
            const startDate = new Date(this.currentWeek.startDate);
            const endDate = new Date(this.currentWeek.endDate);
            data = dataProcessor.aggregateWeekData(this.currentYear, startDate, endDate);
        } else if (this.currentMonth) {
            // Vista mensile
            data = dataProcessor.aggregateMonthData(this.currentYear, this.currentMonth);
        } else {
            // Vista annuale
            data = dataProcessor.aggregateYearData(this.currentYear);
        }

        this.updateCharts(data);

        // Ridisegna grafico FV con aggregazione automatica
        this.updateFVSavingsChart(null);
    }

    /**
     * Aggiorna sezione efficienza
     */
    updateEfficiency(kpis) {
        const pci = CONFIG.caldaia.pci_gas_kwh_smc;
        const potenzaMax = CONFIG.cogeneratore.potenza_max_kw;

        // Calcola energia gas consumato
        const energiaGasCoge = kpis.gas_coge * pci;

        // Efficienza elettrica
        const effEE = kpis.eff_elettrica_coge_perc;
        document.getElementById('eff-ee-actual').style.width = Math.min(effEE, 100) + '%';
        document.getElementById('eff-ee-value').textContent =
            `Effettiva: ${this.formatNumber(effEE, 1)}%`;
        document.getElementById('eff-ee-calc').textContent =
            `(${this.formatNumber(kpis.ee_coge, 0)} kWh / ${this.formatNumber(energiaGasCoge, 0)} kWh) × 100 = ${this.formatNumber(effEE, 1)}%`;

        // Efficienza termica
        const effTerm = kpis.eff_termica_coge_perc;
        document.getElementById('eff-term-actual').style.width = Math.min(effTerm, 100) + '%';
        document.getElementById('eff-term-value').textContent =
            `Effettiva: ${this.formatNumber(effTerm, 1)}%`;
        document.getElementById('eff-term-calc').textContent =
            `(${this.formatNumber(kpis.ac_coge, 0)} kWh / ${this.formatNumber(energiaGasCoge, 0)} kWh) × 100 = ${this.formatNumber(effTerm, 1)}%`;

        // Efficienza totale
        const effTot = kpis.eff_totale_coge_perc;
        document.getElementById('eff-tot-actual').style.width = Math.min(effTot, 100) + '%';
        document.getElementById('eff-tot-value').textContent =
            `Effettiva: ${this.formatNumber(effTot, 1)}%`;
        document.getElementById('eff-tot-calc').textContent =
            `${this.formatNumber(effEE, 1)}% + ${this.formatNumber(effTerm, 1)}% = ${this.formatNumber(effTot, 1)}%`;

        // Ore funzionamento
        const oreFunz = kpis.ore_funz_coge;
        document.getElementById('ore-funz').textContent =
            this.formatNumber(oreFunz, 0);
        document.getElementById('ore-funz-calc').textContent =
            `${this.formatNumber(kpis.ee_coge, 0)} kWh / ${potenzaMax} kW = ${this.formatNumber(oreFunz, 0)} ore`;

        // Fattore di carico
        const fattoreCarico = kpis.fattore_carico_coge_perc;
        const orePeriodo = this.currentMonth ? 24 * 31 : 24 * 365; // Approssimato
        document.getElementById('fattore-carico').textContent =
            this.formatNumber(fattoreCarico, 1) + '%';
        document.getElementById('fattore-carico-calc').textContent =
            `(${this.formatNumber(oreFunz, 0)} ore / ${orePeriodo} ore) × 100 = ${this.formatNumber(fattoreCarico, 1)}%`;

        // Colora barre efficienza in base a performance
        this.colorEfficiencyBars(effEE, effTerm, effTot);
    }

    /**
     * Colora barre efficienza in base a performance
     */
    colorEfficiencyBars(effEE, effTerm, effTot) {
        const nominalEE = CONFIG.cogeneratore.efficienza_elettrica_perc;
        const nominalTerm = CONFIG.cogeneratore.efficienza_termica_perc;
        const nominalTot = nominalEE + nominalTerm;

        // Elettrica
        const eeBar = document.getElementById('eff-ee-actual');
        eeBar.style.backgroundColor = this.getEfficiencyColor(effEE, nominalEE);

        // Termica
        const termBar = document.getElementById('eff-term-actual');
        termBar.style.backgroundColor = this.getEfficiencyColor(effTerm, nominalTerm);

        // Totale
        const totBar = document.getElementById('eff-tot-actual');
        totBar.style.backgroundColor = this.getEfficiencyColor(effTot, nominalTot);
    }

    /**
     * Determina colore efficienza in base a performance
     */
    getEfficiencyColor(actual, nominal) {
        const ratio = actual / nominal;
        if (ratio >= 0.95) return CONFIG.colors.efficienza_ok;
        if (ratio >= 0.85) return CONFIG.colors.efficienza_warning;
        return CONFIG.colors.efficienza_error;
    }

    /**
     * Aggiorna sezione KPI Strategie
     */
    updateStrategyKPIs(strategyKPIs) {
        // KPI Cards
        document.getElementById('strategy-kpi-periodo').textContent =
            this.formatNumber(strategyKPIs.periodo_giorni, 0);
        document.getElementById('strategy-kpi-attuale').textContent =
            this.formatNumber(strategyKPIs.totals.costo_attuale, 0);
        document.getElementById('strategy-kpi-minimo').textContent =
            this.formatNumber(strategyKPIs.totals.minimo, 0);
        document.getElementById('strategy-kpi-risparmio').textContent =
            this.formatNumber(strategyKPIs.totals.risparmio_possibile, 0);
        document.getElementById('strategy-kpi-range').textContent =
            this.formatNumber(strategyKPIs.totals.range_costi, 0);

        // Barre orizzontali strategia ottimale
        this.renderOptimalStrategyBars(strategyKPIs.optimalPercentages);

        // Cards risparmi
        document.getElementById('savings-vs-spento').textContent =
            this.formatNumber(strategyKPIs.risparmi.vs_spento, 0) + ' €';
        document.getElementById('savings-opt-attuale').textContent =
            this.formatNumber(strategyKPIs.risparmi.coge_opt_vs_attuale, 0) + ' € (' +
            this.formatNumber(strategyKPIs.risparmi.coge_opt_vs_attuale_perc, 1) + '%)';
        document.getElementById('savings-opt-best').textContent =
            this.formatNumber(strategyKPIs.risparmi.coge_opt_vs_best, 0) + ' € (' +
            this.formatNumber(strategyKPIs.risparmi.coge_opt_vs_best_perc, 1) + '%)';
        document.getElementById('savings-attuale-best').textContent =
            this.formatNumber(strategyKPIs.risparmi.attuale_vs_best, 0) + ' € (' +
            this.formatNumber(strategyKPIs.risparmi.attuale_vs_best_perc, 1) + '%)';

        // Trigger GSAP animations for strategy KPIs
        if (window.animateStrategyKPIValues) {
            window.animateStrategyKPIValues();
        }
    }

    /**
     * Renderizza barre orizzontali strategia ottimale
     */
    renderOptimalStrategyBars(percentages) {
        const container = document.getElementById('optimal-strategy-container');
        container.innerHTML = '';

        const strategies = [
            { key: 'coge_minimo', label: 'Coge Minimo', color: '#10b981' },
            { key: 'coge_massimo', label: 'Coge Massimo', color: '#f59e0b' },
            { key: 'coge_ins_elettrico', label: 'Ins Elettrico', color: '#3b82f6' },
            { key: 'coge_ins_termico', label: 'Ins Termico', color: '#ec4899' },
            { key: 'coge_spento', label: 'Coge Spento', color: '#64748b' }
        ];

        // Ordina per percentuale decrescente
        strategies.sort((a, b) => (percentages[b.key] || 0) - (percentages[a.key] || 0));

        strategies.forEach(strategy => {
            const percentage = percentages[strategy.key] || 0;

            const item = document.createElement('div');
            item.className = 'strategy-bar-item';

            const label = document.createElement('div');
            label.className = 'strategy-bar-label';
            label.textContent = strategy.label;

            const track = document.createElement('div');
            track.className = 'strategy-bar-track';

            const fill = document.createElement('div');
            fill.className = 'strategy-bar-fill';
            fill.style.width = percentage + '%';
            fill.style.background = `linear-gradient(90deg, ${strategy.color}, ${strategy.color}dd)`;

            const value = document.createElement('span');
            value.className = 'strategy-bar-value';
            value.textContent = this.formatNumber(percentage, 1) + '%';

            fill.appendChild(value);
            track.appendChild(fill);
            item.appendChild(label);
            item.appendChild(track);
            container.appendChild(item);
        });
    }

    /**
     * Aggiorna timestamp
     */
    updateTimestamp() {
        const now = new Date();
        const formatted = now.toLocaleDateString('it-IT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('last-update').textContent = formatted;
    }

    /**
     * Formatta numero con separatore migliaia e decimali (formato IT)
     */
    formatNumber(num, decimals = 0) {
        if (typeof num !== 'number' || isNaN(num)) return '-';
        return new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }

    /**
     * Mostra warning nella sezione FV comparison
     */
    showFVComparisonWarning(message) {
        try {
            // Trova la sezione corretta usando l'ID del canvas
            const canvas = document.getElementById('chart-fv-savings');
            if (!canvas) {
                console.warn('⚠️ Canvas chart-fv-savings non trovato, non posso mostrare il warning');
                return;
            }

            const section = canvas.closest('.chart-section');
            if (!section) {
                console.warn('⚠️ Sezione chart-section non trovata, non posso mostrare il warning');
                return;
            }

            // Rimuovi warning esistente se presente
            const existingWarning = section.querySelector('.fv-comparison-warning');
            if (existingWarning) {
                existingWarning.remove();
            }

            // Crea nuovo warning
            const warningEl = document.createElement('div');
            warningEl.className = 'fv-comparison-warning';
            warningEl.style.cssText = 'background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px; color: #92400e;';
            warningEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <span style="font-size: 24px; flex-shrink: 0;">⚠️</span>
                    <div style="flex: 1;">
                        <strong style="display: block; margin-bottom: 4px;">Attenzione: Dati identici rilevati</strong>
                        <div style="font-size: 14px;">${message}</div>
                        <div style="font-size: 12px; margin-top: 8px; color: #78350f;">
                            <strong>Causa probabile:</strong> I file JSON per Normal e FV12 contengono valori identici.<br>
                            Verificare che i file JSON siano stati generati correttamente con dati diversi per i due scenari.
                        </div>
                    </div>
                </div>
            `;

            // Inserisci dopo il section-header o prima del chart-container
            const sectionHeader = section.querySelector('.section-header');
            const chartContainer = section.querySelector('.chart-container');

            if (sectionHeader) {
                sectionHeader.insertAdjacentElement('afterend', warningEl);
                console.log('✅ Warning FV comparison inserito dopo section-header');
            } else if (chartContainer) {
                chartContainer.insertAdjacentElement('beforebegin', warningEl);
                console.log('✅ Warning FV comparison inserito prima del chart-container');
            } else {
                section.insertBefore(warningEl, section.firstChild);
                console.log('✅ Warning FV comparison inserito all\'inizio della sezione');
            }
        } catch (error) {
            console.error('⚠️ Errore nel mostrare il warning FV comparison:', error);
        }
    }

    /**
     * Nasconde warning nella sezione FV comparison
     */
    hideFVComparisonWarning() {
        const warnings = document.querySelectorAll('.fv-comparison-warning');
        warnings.forEach(w => w.remove());
    }

    /**
     * Mostra banner "Non disponibile al momento" per il grafico FV quando i dati 2025 sono identici
     */
    showFVUnavailableBanner() {
        try {
            // Trova la sezione corretta
            const canvas = document.getElementById('chart-fv-savings');
            if (!canvas) {
                console.warn('⚠️ Canvas chart-fv-savings non trovato, non posso mostrare il banner');
                return;
            }

            const section = canvas.closest('.chart-section');
            if (!section) {
                console.warn('⚠️ Sezione chart-section non trovata, non posso mostrare il banner');
                return;
            }

            // Rimuovi banner esistente se presente
            const existingBanner = section.querySelector('.fv-unavailable-banner');
            if (existingBanner) {
                existingBanner.remove();
            }

            // Nascondi canvas e legenda
            const chartContainer = section.querySelector('.chart-container');
            const legend = section.querySelector('#legend-fv-savings');

            if (chartContainer) {
                chartContainer.style.display = 'none';
            }
            if (legend) {
                legend.style.display = 'none';
            }

            // Crea nuovo banner
            const bannerEl = document.createElement('div');
            bannerEl.className = 'fv-unavailable-banner';
            bannerEl.style.cssText = 'background-color: #f3f4f6; border: 2px dashed #9ca3af; padding: 40px 20px; margin: 20px 0; border-radius: 8px; text-align: center; color: #6b7280;';
            bannerEl.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                    <span style="font-size: 48px;">📊</span>
                    <div>
                        <strong style="display: block; font-size: 18px; color: #374151; margin-bottom: 8px;">Analisi Non Disponibile</strong>
                        <div style="font-size: 14px;">
                            I dati per l'analisi Risparmio Fotovoltaico Ottimizzato non sono attualmente disponibili per l'anno 2025.<br>
                            I dati Normal e FV12 risultano identici nei file JSON.
                        </div>
                        <div style="font-size: 12px; margin-top: 12px; color: #6b7280;">
                            <em>Seleziona un altro anno per visualizzare il confronto.</em>
                        </div>
                    </div>
                </div>
            `;

            // Inserisci nel chart-container o dopo section-header
            if (chartContainer) {
                chartContainer.insertAdjacentElement('afterend', bannerEl);
            } else {
                const sectionHeader = section.querySelector('.section-header');
                if (sectionHeader) {
                    sectionHeader.insertAdjacentElement('afterend', bannerEl);
                } else {
                    section.insertBefore(bannerEl, section.firstChild);
                }
            }

            console.log('✅ Banner "Non disponibile" inserito per il grafico FV');
        } catch (error) {
            console.error('⚠️ Errore nel mostrare il banner FV non disponibile:', error);
        }
    }

    /**
     * Nasconde banner "Non disponibile" e mostra di nuovo il grafico
     */
    hideFVUnavailableBanner() {
        try {
            const banners = document.querySelectorAll('.fv-unavailable-banner');
            banners.forEach(b => b.remove());

            // Mostra di nuovo canvas e legenda
            const canvas = document.getElementById('chart-fv-savings');
            if (canvas) {
                const section = canvas.closest('.chart-section');
                if (section) {
                    const chartContainer = section.querySelector('.chart-container');
                    const legend = section.querySelector('#legend-fv-savings');

                    if (chartContainer) {
                        chartContainer.style.display = '';
                    }
                    if (legend) {
                        legend.style.display = '';
                    }
                }
            }
        } catch (error) {
            console.error('⚠️ Errore nel nascondere il banner FV non disponibile:', error);
        }
    }

    /**
     * Mostra messaggio temporaneo nella sezione confronto
     */
    showComparisonMessage(message, type = 'info') {
        const section = document.querySelector('.comparison-section');
        if (!section) return;

        // Rimuovi messaggio esistente se presente
        const existingMsg = section.querySelector('.comparison-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        // Crea nuovo messaggio
        const messageEl = document.createElement('div');
        messageEl.className = `comparison-message comparison-message-${type}`;
        messageEl.textContent = message;

        // Inserisci dopo l'header
        const header = section.querySelector('.comparison-header-compact');
        if (header) {
            header.insertAdjacentElement('afterend', messageEl);
        } else {
            section.insertBefore(messageEl, section.firstChild);
        }

        // Rimuovi dopo 4 secondi
        setTimeout(() => {
            if (messageEl && messageEl.parentNode) {
                messageEl.style.opacity = '0';
                messageEl.style.transition = 'opacity 0.3s';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 4000);
    }

    /**
     * Inizializza sezione confronto - verifica disponibilità file e imposta default
     */
    async initializeComparisonSection() {
        const yearSelect = document.getElementById('comparison-year-select');
        if (!yearSelect) return;

        // Verifica quali anni sono disponibili
        const availableYears = [];

        for (const year of ['2024', '2025']) {
            try {
                const data = await csvComparisonLoader.loadYearData(year);
                if (data && data.length > 0) {
                    availableYears.push(year);
                }
            } catch (e) {
                // File non disponibile, ignora
            }
        }

        // Disabilita opzioni non disponibili e aggiungi nota
        Array.from(yearSelect.options).forEach(option => {
            if (!availableYears.includes(option.value)) {
                option.disabled = true;
                option.textContent = `${option.value} (non disponibile)`;
            } else {
                // Assicura che il testo sia normale per gli anni disponibili
                option.textContent = option.value;
            }
        });

        // Se l'anno selezionato non è disponibile, usa il primo disponibile
        if (availableYears.length > 0) {
            if (!availableYears.includes(yearSelect.value)) {
                // Aggiorna selettore senza triggherare event
                this.comparisonYearSelectIsUpdating = true;
                yearSelect.value = availableYears[0];
                setTimeout(() => {
                    this.comparisonYearSelectIsUpdating = false;
                }, 100);
                this.comparisonCurrentYear = availableYears[0];
            } else {
                this.comparisonCurrentYear = yearSelect.value;
            }
        } else {
            // Nessun file disponibile
            this.showComparisonMessage('⚠️ Nessun file CSV disponibile per il confronto.', 'error');
            return;
        }

        // Carica dati per l'anno selezionato
        await this.updateComparisonSection(yearSelect.value);
    }

    /**
     * Aggiorna sezione confronto cogeneratore
     * INDIPENDENTE dai filtri temporali del resto del sito
     */
    async updateComparisonSection(year = null) {
        try {
            // Se year è null, usa l'anno dal selettore dedicato o default 2025
            const yearSelect = document.getElementById('comparison-year-select');
            if (!year) {
                year = yearSelect ? yearSelect.value : '2025';
            }

            // Verifica che l'anno sia valido
            if (year !== '2024' && year !== '2025') {
                console.warn(`Anno ${year} non supportato per confronto. Usando 2025 come default.`);
                year = '2025';
            }

            // Sincronizza selettore se necessario (senza triggherare event)
            if (yearSelect && yearSelect.value !== year) {
                // Disabilita temporaneamente l'event listener per evitare loop
                this.comparisonYearSelectIsUpdating = true;
                yearSelect.value = year;
                setTimeout(() => {
                    this.comparisonYearSelectIsUpdating = false;
                }, 100);
            }

            let comparisonData = await csvComparisonLoader.loadYearData(year);

            // Se non ci sono dati per l'anno selezionato, prova l'altro anno
            if (!comparisonData || comparisonData.length === 0) {
                const fallbackYear = year === '2024' ? '2025' : '2024';
                console.warn(`⚠️ File CSV per ${year} non trovato, utilizzo dati ${fallbackYear}`);
                comparisonData = await csvComparisonLoader.loadYearData(fallbackYear);
                if (comparisonData && comparisonData.length > 0) {
                    // Aggiorna anno e sincronizza selettore (senza triggherare event)
                    year = fallbackYear;
                    this.comparisonCurrentYear = fallbackYear;
                    if (yearSelect) {
                        // Disabilita temporaneamente l'event listener per evitare loop
                        this.comparisonYearSelectIsUpdating = true;
                        yearSelect.value = year;
                        setTimeout(() => {
                            this.comparisonYearSelectIsUpdating = false;
                        }, 100);
                        // Mostra breve messaggio all'utente
                        this.showComparisonMessage(`Anno ${year === '2024' ? '2024' : '2025'} non disponibile. Visualizzazione dati ${fallbackYear}.`);
                    }
                }
            } else {
                // Dati caricati con successo, aggiorna anno corrente
                this.comparisonCurrentYear = year;
            }

            if (!comparisonData || comparisonData.length === 0) {
                console.warn(`Dati confronto non disponibili né per 2024 né per 2025`);
                // Nascondi sezione se non ci sono dati
                const section = document.querySelector('.comparison-section');
                if (section) {
                    section.style.display = 'none';
                }
                // Mostra messaggio di errore
                this.showComparisonMessage('⚠️ Nessun dato disponibile per il confronto cogeneratore.', 'error');
                return;
            }

            // Mostra sezione se era nascosta
            const section = document.querySelector('.comparison-section');
            if (section) {
                section.style.display = 'block';
            }

            // Aggiorna display anno
            const displayYearEl = document.getElementById('comparison-display-year');
            const tableYearEl = document.getElementById('comparison-table-year');
            if (displayYearEl) displayYearEl.textContent = year;
            if (tableYearEl) tableYearEl.textContent = year;

            // Renderizza visualizzazioni
            if (comparisonChartRenderer) {
                // Tabella principale (scansionabile)
                comparisonChartRenderer.renderMainTable(comparisonData);

                // Grafico evoluzione
                comparisonChartRenderer.drawMainCompactChart('chart-comparison-main', comparisonData, 'legend-comparison-main');

                // Aggiorna KPI nel header
                comparisonChartRenderer.updateKPIs(comparisonData);
            }
        } catch (error) {
            console.error('Errore aggiornamento sezione confronto:', error);
            // Nascondi sezione in caso di errore
            const section = document.querySelector('.comparison-section');
            if (section) {
                section.style.display = 'none';
            }
        }
    }
}

// Istanza globale dell'app
const dashboardApp = new DashboardApp();

// Inizializza quando DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    dashboardApp.init();
});
