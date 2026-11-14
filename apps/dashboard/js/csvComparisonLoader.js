// CSV Comparison Loader - Carica e processa dati CSV per analisi variazione MIN potenza cogeneratore

class CSVComparisonLoader {
    constructor() {
        this.data = {
            2024: null,
            2025: null
        };
        this.loading = false;
    }

    /**
     * Carica file CSV per un anno specifico
     */
    async loadYearData(year) {
        if (this.data[year]) {
            return this.data[year];
        }

        this.loading = true;
        // Il file CSV è nella directory webapp
        const filename = `Analisi variazione MIN potenza coge - ${year}.csv`;
        
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                // Se file non esiste, restituisci null senza lanciare errore
                if (response.status === 404) {
                    console.log(`File CSV ${year} non trovato`);
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            const parsed = this.parseCSV(csvText);
            this.data[year] = parsed;
            
            console.log(`✅ Dati confronto ${year} caricati:`, parsed.length, 'percentuali');
            return parsed;
        } catch (error) {
            console.error(`Errore caricamento CSV ${year}:`, error);
            return null;
        } finally {
            this.loading = false;
        }
    }

    /**
     * Parsa CSV e struttura i dati
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        const results = [];
        const ensureDerivedSavings = data => {
            const risparmi = data?.risparmi || {};
            const derive = (arrA, arrB, combiner) => {
                const len = Math.max(arrA?.length || 0, arrB?.length || 0);
                return Array.from({ length: len }, (_, idx) => {
                    const a = arrA && idx < arrA.length ? arrA[idx] : 0;
                    const b = arrB && idx < arrB.length ? arrB[idx] : 0;
                    return combiner(a, b);
                });
            };

            // Se mancano alcuni campi, prova a derivarli:
            // Attuale vs Best = Coge-Opt vs Attuale + Coge-Opt vs Best
            if (!risparmi.attuale_vs_best && (risparmi.coge_opt_vs_attuale || risparmi.coge_opt_vs_best)) {
                const attualeVsBest = derive(
                    risparmi.coge_opt_vs_attuale,
                    risparmi.coge_opt_vs_best,
                    (cogeAtt, cogeBest) => cogeAtt + cogeBest
                );
                const hasValue = attualeVsBest.some(v => typeof v === 'number' && !isNaN(v));
                if (hasValue) {
                    risparmi.attuale_vs_best = attualeVsBest;
                }
            }

            // Se manca il nuovo Coge-Opt vs Attuale ma abbiamo Attuale vs Best (vecchio) e Coge-Opt vs Best -> differenza (compatibilità vecchi dataset dove Attuale vs Best era attuale-minimo)
            if (!risparmi.coge_opt_vs_attuale && risparmi.attuale_vs_best && risparmi.coge_opt_vs_best) {
                risparmi.coge_opt_vs_attuale = derive(risparmi.attuale_vs_best, risparmi.coge_opt_vs_best, (att, best) => att - best);
            }
        };
        
        let currentPercentage = null;
        let currentData = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cells = this.parseCSVLine(line);
            
            // Rileva nuova percentuale (es. "0.00%,Totale nel periodo")
            if (cells[0] && cells[0].includes('%') && cells[1] && cells[1].includes('Totale nel periodo')) {
                // Salva dati precedenti se esistono
                if (currentPercentage !== null && currentData) {
                    ensureDerivedSavings(currentData);
                    results.push({
                        percentage: currentPercentage,
                        ...currentData
                    });
                }
                
                // Inizia nuova sezione
                const percMatch = cells[0].match(/(\d+\.?\d*)%/);
                currentPercentage = percMatch ? parseFloat(percMatch[1]) : 0;
                currentData = {
                    periodo: { giorni: [] },
                    range_costi: [],
                    risparmio_possibile: [],
                    costi: {},
                    risparmi: {},
                    ottimi: {}
                };
                continue;
            }
            
            if (currentPercentage === null) continue;
            
            // Parse diverse righe di dati
            const label = (cells[1] || '').trim();
            
            // Skip righe vuote
            if (!label && cells.every(c => !c || c.trim() === '')) {
                continue;
            }
            
            if (label === 'Periodo [giorni]') {
                const valori = [
                    this.parseNumber(cells[2]),
                    this.parseNumber(cells[3])
                ].filter(v => !isNaN(v));
                if (valori.length > 0) {
                    currentData.periodo.giorni = valori;
                }
            } else if (label === 'Range costi') {
                const valori = [
                    this.parseNumber(cells[2]),
                    this.parseNumber(cells[3])
                ].filter(v => !isNaN(v));
                if (valori.length > 0) {
                    currentData.range_costi = valori;
                }
            } else if (label === 'Risparmio possibile') {
                const valori = [
                    this.parseNumber(cells[2]),
                    this.parseNumber(cells[3])
                ].filter(v => !isNaN(v));
                if (valori.length > 0) {
                    currentData.risparmio_possibile = valori;
                }
            } else if (label.startsWith('Costo ')) {
                // Costi vari (attuale, coge spento, etc.)
                const costType = this.normalizeCostType(label);
                
                if (!currentData.costi[costType]) {
                    currentData.costi[costType] = [];
                }
                
                // Parse valori: sempre usa cells[2], e cells[3] solo se è un valore monetario
                const val1 = this.parseNumber(cells[2]);
                const val2 = this.parseNumber(cells[3]);
                
                // Se val2 è NaN (probabilmente è una percentuale), usa solo val1
                // Se entrambi sono validi, usa entrambi (formato 2025)
                const values = [];
                if (!isNaN(val1)) {
                    values.push(val1);
                }
                if (!isNaN(val2)) {
                    values.push(val2);
                }
                
                if (values.length > 0) {
                    currentData.costi[costType] = values;
                    
                    // Cerca percentuale ottimo se presente (colonna 6 o cells[5] se contiene %)
                    // Alcuni CSV hanno la percentuale in cells[5], altri in cells[4]
                    for (let colIdx = 4; colIdx <= 5; colIdx++) {
                        if (cells[colIdx] && (cells[colIdx].includes('%') || !isNaN(parseFloat(cells[colIdx])))) {
                            const perc = parseFloat(cells[colIdx].replace('%', '').replace(',', '.'));
                            if (!isNaN(perc)) {
                                currentData.ottimi[costType] = perc;
                                break;
                            }
                        }
                    }
                }
            } else if (label === 'Costo minimo') {
                currentData.costi.costo_minimo = [
                    this.parseNumber(cells[2]),
                    this.parseNumber(cells[3])
                ].filter(v => !isNaN(v));
            } else if (label.startsWith('Risparmio vs') || 
                       label.startsWith('Coge-Opt vs') || 
                       label.startsWith('Attuale vs')) {
                const savingsType = this.normalizeSavingsType(label);
                currentData.risparmi[savingsType] = [
                    this.parseNumber(cells[2]),
                    this.parseNumber(cells[3])
                ].filter(v => !isNaN(v));
            }
        }
        
        // Aggiungi ultimo elemento
        if (currentPercentage !== null && currentData) {
            ensureDerivedSavings(currentData);
            results.push({
                percentage: currentPercentage,
                ...currentData
            });
        }
        
        return results.sort((a, b) => a.percentage - b.percentage);
    }

    /**
     * Normalizza tipo di costo
     */
    normalizeCostType(label) {
        // Rimuovi spazi extra e normalizza
        const normalizedLabel = label.trim();
        
        // Mapping specifico con priorità (dal più specifico al più generico)
        if (normalizedLabel.includes('Elettrico+') || normalizedLabel.toLowerCase().includes('elettrico+')) {
            return 'coge_ins_elettrico_plus';
        }
        if (normalizedLabel.includes('ins. elettrico') || normalizedLabel.includes('ins. Elettrico')) {
            // Assicurati che non sia Elettrico+ (già gestito sopra)
            if (!normalizedLabel.includes('Elettrico+') && !normalizedLabel.toLowerCase().includes('elettrico+')) {
                return 'coge_ins_elettrico';
            }
        }
        if (normalizedLabel.includes('ins. Termico') || normalizedLabel.includes('ins. termico')) {
            return 'coge_ins_termico';
        }
        if (normalizedLabel.includes('coge minimo')) {
            return 'coge_minimo';
        }
        if (normalizedLabel.includes('coge spento')) {
            return 'coge_spento';
        }
        if (normalizedLabel.includes('coge massimo')) {
            return 'coge_massimo';
        }
        if (normalizedLabel.includes('attuale')) {
            return 'attuale';
        }
        if (normalizedLabel.includes('minimo') && !normalizedLabel.includes('coge')) {
            return 'costo_minimo';
        }
        
        // Fallback
        return normalizedLabel.toLowerCase()
            .replace(/costo\s+/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, '_')
            .replace(/\+/g, '_plus');
    }

    /**
     * Normalizza tipo di risparmio
     */
    normalizeSavingsType(label) {
        const normalized = label.toLowerCase();
        const sanitized = normalized.replace(/-/g, ' ');
        
        if (sanitized.includes('risparmio vs off')) return 'risparmio_vs_off';
        if (sanitized.includes('attuale vs best')) return 'attuale_vs_best';
        if (sanitized.includes('coge opt vs attuale')) return 'coge_opt_vs_attuale';
        if (sanitized.includes('coge opt vs best')) return 'coge_opt_vs_best';
        
        return sanitized.replace(/\s+/g, '_');
    }

    /**
     * Parsa una linea CSV (gestisce virgolette e virgole)
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * Converte stringa numero italiano (con punto separatore migliaia) a numero
     */
    parseNumber(str) {
        if (!str || str === '' || str === '-') return NaN;
        
        // Rimuovi virgolette e spazi
        str = str.replace(/"/g, '').trim();
        
        // Rimuovi il simbolo €
        str = str.replace(/€/g, '').trim();
        
        // Sostituisci punto (separatore migliaia) con nulla e virgola (decimale) con punto
        str = str.replace(/\./g, '').replace(',', '.');
        
        const num = parseFloat(str);
        return isNaN(num) ? NaN : num;
    }

    /**
     * Ottieni dati per un anno
     */
    getYearData(year) {
        return this.data[year] || null;
    }

    /**
     * Verifica se i dati sono caricati
     */
    isYearLoaded(year) {
        return this.data[year] !== null;
    }
}

// Istanza globale
const csvComparisonLoader = new CSVComparisonLoader();
