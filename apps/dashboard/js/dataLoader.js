// DataLoader - Caricamento e gestione dati JSON

class DataLoader {
    constructor() {
        this.data = {
            consumi: null,
            prezzi: null,
            elaborazione: null,
            recap: null
        };
        // Repository di versioni caricate (normal, fv12, normal350, fv12350)
        this.versions = {};
        // Coppia di versioni correnti per i confronti FV (si aggiorna con il toggle 350)
        this.bothVersions = { normal: null, fv12: null };
        this.activeScenarioKey = null;
        this.loading = false;
        this.error = null;
        this.basePath = 'data'; // root dati (default V3); può essere reindirizzato a data_v4
    }

    /**
     * Determina la chiave scenario in base ai toggle FV e 350 kW
     */
    getScenarioKey(fvOptimized = false, use350 = false) {
        if (use350) {
            return fvOptimized ? 'fv12350' : 'normal350';
        }
        return fvOptimized ? 'fv12' : 'normal';
    }

    /**
     * Carica i JSON per uno scenario (cartella es. normal, fv12, normal350, fv12350)
     */
    async loadScenario(folderName, years) {
        const scenarioData = { consumi: {}, prezzi: {}, elaborazione: {}, recap: {} };

        const trimToSeptember2025 = (dataObj) => {
            const yearKey = '2025';
            if (!dataObj || !dataObj[yearKey]) return;
            Object.keys(dataObj[yearKey]).forEach((month) => {
                if (parseInt(month, 10) >= 10) {
                    delete dataObj[yearKey][month];
                }
            });
        };
        const dropYear = (dataObj, yearKey) => {
            if (dataObj && dataObj[yearKey]) {
                delete dataObj[yearKey];
            }
        };

        for (const year of years) {
            const basePath = `${this.basePath}/${year}/${folderName}`;
            const [consumi, prezzi, elaborazione, recap] = await Promise.all([
                this.loadJSON(`${basePath}/inserimento_consumi_estratti.json`),
                this.loadJSON(`${basePath}/inserimento_prezzi_estratti.json`),
                this.loadJSON(`${basePath}/elaborazione_consumi_estratti.json`),
                this.loadJSON(`${basePath}/recap_estratti.json`)
            ]);

            // Taglia i dati 2025 oltre settembre per evitare buchi su ottobre-dicembre
            trimToSeptember2025(consumi);
            trimToSeptember2025(prezzi);
            trimToSeptember2025(elaborazione);
            trimToSeptember2025(recap);
            // Rimuove eventuali 2026 residui
            dropYear(consumi, '2026');
            dropYear(prezzi, '2026');
            dropYear(elaborazione, '2026');
            dropYear(recap, '2026');

            // Ogni file espone il proprio anno come chiave root: mergiamo semplicemente
            Object.assign(scenarioData.consumi, consumi || {});
            Object.assign(scenarioData.prezzi, prezzi || {});
            Object.assign(scenarioData.elaborazione, elaborazione || {});
            Object.assign(scenarioData.recap, recap || {});
        }

        return scenarioData;
    }

    /**
     * Imposta la radice dei dati (es. 'data' o 'data_v4')
     */
    setBasePath(basePath) {
        this.basePath = basePath || 'data';
    }

    /**
     * Carica tutti i file JSON (normal, fv12, normal350, fv12350)
     * @param {boolean} fvOptimized - Se true, predispone FV12 come default attivo
     * @param {boolean} use350 - Se true, predispone la variante 350 kW come default attivo
     */
    async loadAll(fvOptimized = false, use350 = false) {
        if (this.loading) {
            console.warn('Caricamento già in corso...');
            return this.data;
        }

        this.loading = true;
        this.error = null;

        try {
            const years = ['2024', '2025'];
            const scenarioFolders = {
                normal: 'normal',
                fv12: 'fv12',
                normal350: 'normal350',
                fv12350: 'fv12350'
            };

            console.log('📦 Caricamento dati (Normal, FV12, Normal350, FV12350)...');

            // Carica in parallelo le quattro varianti
            const loadedEntries = await Promise.all(
                Object.entries(scenarioFolders).map(async ([key, folder]) => {
                    const scenarioData = await this.loadScenario(folder, years);
                    return [key, scenarioData];
                })
            );

            this.versions = Object.fromEntries(loadedEntries);

            // Imposta la versione attiva e la coppia per il confronto
            this.setActiveVersion(fvOptimized, use350);

            console.log('✅ Dati caricati con successo:');
            console.log('- Varianti disponibili:', Object.keys(this.versions).join(', '));
            console.log('- Consumi (anni attivi):', Object.keys(this.data.consumi).join(', '));
            console.log('- Prezzi (anni attivi):', Object.keys(this.data.prezzi).join(', '));

            return this.data;

        } catch (error) {
            this.error = error;
            console.error('Errore nel caricamento dei dati:', error);
            throw error;
        } finally {
            this.loading = false;
        }
    }

    /**
     * Carica un singolo file JSON
     */
    async loadJSON(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Errore caricamento ${path}:`, error);
            throw error;
        }
    }

    /**
     * Imposta la versione attiva (Normal/FV12 con o senza 350 kW) senza ricaricare i dati
     */
    setActiveVersion(fvOptimized = false, use350 = false) {
        if (!this.versions || Object.keys(this.versions).length === 0) {
            console.error('Tentativo di switch versione ma i dati non sono stati caricati!');
            return;
        }

        const scenarioKey = this.getScenarioKey(fvOptimized, use350);
        const scenario = this.versions[scenarioKey];

        if (!scenario) {
            console.error(`Scenario ${scenarioKey} non disponibile nei dati caricati`);
            return;
        }

        console.log(`Switch a versione: ${scenarioKey}`);
        this.activeScenarioKey = scenarioKey;

        // Aggiorna puntatori attivi
        this.data.consumi = scenario.consumi;
        this.data.prezzi = scenario.prezzi;
        this.data.elaborazione = scenario.elaborazione;
        this.data.recap = scenario.recap;

        // Aggiorna coppia normal/fv12 per i grafici di confronto rispetto al profilo 350/non-350
        const normalKey = use350 ? 'normal350' : 'normal';
        const fvKey = use350 ? 'fv12350' : 'fv12';
        this.bothVersions = {
            normal: this.versions[normalKey]?.consumi || {},
            fv12: this.versions[fvKey]?.consumi || {}
        };

        if (this.bothVersions.normal === this.bothVersions.fv12) {
            console.error('⚠️ ERRORE CRITICO: bothVersions.normal e bothVersions.fv12 puntano agli stessi dati!');
        }
    }

    /**
     * Alias per retro-compatibilità
     */
    switchVersion(fvOptimized, use350 = false) {
        this.setActiveVersion(fvOptimized, use350);
    }

    /**
     * Restituisce la coppia Normal/FV12 correnti per i grafici di confronto
     */
    async loadBothVersionsForComparison() {
        if (!this.bothVersions.normal || !this.bothVersions.fv12) {
            throw new Error('Dati non ancora caricati');
        }
        
        return this.bothVersions;
    }

    /**
     * Verifica se i dati sono stati caricati
     */
    isLoaded() {
        return this.data.consumi !== null && 
               this.data.prezzi !== null && 
               this.data.elaborazione !== null &&
               this.data.recap !== null;
    }

    /**
     * Ottieni i dati caricati
     */
    getData() {
        if (!this.isLoaded()) {
            throw new Error('Dati non ancora caricati. Chiama loadAll() prima.');
        }
        return this.data;
    }

    /**
     * Ottieni dati fotovoltaico per un anno specifico
     */
    getFVData(year) {
        if (!this.isLoaded()) {
            throw new Error('Dati non ancora caricati');
        }
        // I dati FV non sono più separati - sono integrati nei consumi
        return this.data.fv?.[year] || {};
    }

    /**
     * Ottieni dati fotovoltaico per un giorno/ora specifica
     */
    getFVHourData(year, month, day, hour) {
        if (!this.isLoaded()) {
            throw new Error('Dati non ancora caricati');
        }

        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const hourStr = hour.toString().padStart(2, '0');

        // I dati FV sono integrati nei consumi tramite ee_prod_altro_kwh
        // Restituiamo un oggetto vuoto perché i dati FV sono già nei consumi
        return this.data.fv?.[year]?.[monthStr]?.[dayStr]?.[hourStr] || {
            impianto_fotovoltaico_1: "0",
            impianto_fotovoltaico_2: "0",
            fotovoltaico_1_2: "0"
        };
    }

    /**
     * Ottieni lista anni disponibili
     */
    getAvailableYears() {
        if (!this.isLoaded()) return [];
        return Object.keys(this.data.consumi).sort();
    }

    /**
     * Ottieni lista mesi disponibili per un anno
     */
    getAvailableMonths(year) {
        if (!this.isLoaded()) return [];
        const yearData = this.data.consumi[year];
        if (!yearData) return [];
        return Object.keys(yearData).sort((a, b) => parseInt(a) - parseInt(b));
    }

    /**
     * Ottieni dati per un anno specifico
     */
    getYearData(year) {
        if (!this.isLoaded()) {
            throw new Error('Dati non ancora caricati');
        }

        return {
            consumi: this.data.consumi[year] || {},
            prezzi: this.data.prezzi[year] || {},
            elaborazione: this.data.elaborazione[year] || {},
            recap: this.data.recap[year] || {}
        };
    }

    /**
     * Ottieni dati per un mese specifico
     */
    getMonthData(year, month) {
        if (!this.isLoaded()) {
            throw new Error('Dati non ancora caricati');
        }

        const monthStr = month.toString().padStart(2, '0');

        return {
            consumi: this.data.consumi[year]?.[monthStr] || {},
            prezzi: this.data.prezzi[year]?.[monthStr] || {},
            elaborazione: this.data.elaborazione[year]?.[monthStr] || {}
        };
    }

    /**
     * Ottieni dati per un giorno specifico
     */
    getDayData(year, month, day) {
        if (!this.isLoaded()) {
            throw new Error('Dati non ancora caricati');
        }

        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');

        return {
            consumi: this.data.consumi[year]?.[monthStr]?.[dayStr] || {},
            prezzi: this.data.prezzi[year]?.[monthStr]?.[dayStr] || {},
            elaborazione: this.data.elaborazione[year]?.[monthStr]?.[dayStr] || {}
        };
    }
}

// Istanza globale del loader
const dataLoader = new DataLoader();

// Loader dedicato ai dati V4 (usato solo per grafici selezionati)
const dataLoaderV4 = new DataLoader();
dataLoaderV4.setBasePath('data_v4');
