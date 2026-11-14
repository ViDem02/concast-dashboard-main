// DataProcessor - Elaborazione e aggregazione dati

class DataProcessor {
    constructor(dataLoader, config) {
        this.loader = dataLoader;
        this.config = config;
        this.fvOptimized = false; // Flag per fotovoltaico ottimizzato
        this.cogen350 = false; // Flag per variante cogeneratore 350 kW
        this.downtime = {
            start: new Date(2024, 10, 18), // 18 Nov 2024 (month is 0-based)
            end: new Date(2025, 1, 10)     // 10 Feb 2025
        };
    }

    /**
     * Imposta flag fotovoltaico ottimizzato
     */
    setFVOptimized(value) {
        this.fvOptimized = value;
        console.log('DataProcessor - FV ottimizzato impostato a:', this.fvOptimized);
    }

    /**
     * Imposta flag cogeneratore 350 kW (serve per debugging/analytics locale)
     */
    setCogen350Enabled(value) {
        this.cogen350 = value;
        console.log('DataProcessor - Profilo cogeneratore 350 kW:', this.cogen350 ? 'Attivo' : 'Disattivo');
    }

    /**
     * Verifica se una data (Y, M, D) ricade nel periodo di fermo coge
     */
    isInDowntime(year, month, day) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const d = parseInt(day, 10);
        if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return false;
        const current = new Date(y, m - 1, d);
        return current >= this.downtime.start && current <= this.downtime.end;
    }

    /**
     * Se siamo nel fermo, forza costo_attuale = costo_coge_spento
     */
    applyDowntimeCostAdjust(year, month, day, data) {
        if (!this.isInDowntime(year, month, day)) {
            return data;
        }
        if (!data) return data;
        const newAtt = data.costo_coge_spento || data.costo_attuale || 0;
        return { ...data, costo_attuale: newAtt };
    }

    /**
     * Applica la logica di fermo coge: sposta produzione coge su acquisto rete e azzera coge
     */
    applyDowntimeAdjust(year, month, day, values) {
        if (!this.isInDowntime(year, month, day)) {
            return values;
        }

        const ee_coge = values.ee_coge || 0;
        const ee_acquistata = (values.ee_acquistata || 0) + ee_coge;

        return {
            ...values,
            ee_acquistata,
            ee_coge: 0,
            ac_coge: 0,
            gas_coge: 0,
            gas_caldaie: values.gas_caldaie || 0,
            ac_caldaie: values.ac_caldaie || 0,
            ee_fv: values.ee_fv || 0
        };
    }

    /**
     * Ottieni valore fotovoltaico per un'ora specifica
     * I dati FV sono già integrati nei JSON come ee_prod_altro_kwh
     * Questo metodo ora restituisce solo il valore base perché
     * il caricamento dati dalla versione fv12 vs normal gestisce già le differenze
     */
    getFVValue(year, month, day, hour, baseValue) {
        // I dati FV sono già integrati nei consumi
        // Quando fvOptimized è true, i dati sono già caricati dalla versione fv12
        return baseValue;
    }

    /**
     * Aggrega dati per anno (mensili)
     */
    aggregateYearData(year) {
        const yearData = this.loader.getYearData(year);
        const months = Object.keys(yearData.consumi).sort((a, b) => parseInt(a) - parseInt(b));

        const aggregated = {
            labels: months.map(m => this.config.labels.mesi[parseInt(m) - 1]),
            prezzi: { pun: [], prezzo_ee: [], prezzo_gas: [], psv: [] },
            consumi: {
                ee_acquistata: [], ee_coge: [], ee_fv: [], ee_totale: [],
                ac_coge: [], ac_caldaie: [], ac_totale: [],
                gas_coge: [], gas_caldaie: [], gas_totale: []
            },
            fabbisogni: { ee: [], ac: [] }
        };

        months.forEach(month => {
            // Aggrega prezzi (media mensile)
            const prezziMonth = this.aggregateMonthPrices(year, month);
            aggregated.prezzi.pun.push(prezziMonth.pun);
            aggregated.prezzi.prezzo_ee.push(prezziMonth.prezzo_ee);
            aggregated.prezzi.prezzo_gas.push(prezziMonth.prezzo_gas);
            aggregated.prezzi.psv.push(prezziMonth.psv);

            // Aggrega consumi (somma mensile)
            const consumiMonth = this.aggregateMonthConsumption(year, month);
            aggregated.consumi.ee_acquistata.push(consumiMonth.ee_acquistata);
            aggregated.consumi.ee_coge.push(consumiMonth.ee_coge);
            aggregated.consumi.ee_fv.push(consumiMonth.ee_fv);
            aggregated.consumi.ee_totale.push(consumiMonth.ee_totale);
            aggregated.consumi.ac_coge.push(consumiMonth.ac_coge);
            aggregated.consumi.ac_caldaie.push(consumiMonth.ac_caldaie);
            aggregated.consumi.ac_totale.push(consumiMonth.ac_totale);
            aggregated.consumi.gas_coge.push(consumiMonth.gas_coge);
            aggregated.consumi.gas_caldaie.push(consumiMonth.gas_caldaie);
            aggregated.consumi.gas_totale.push(consumiMonth.gas_totale);

            // Aggrega fabbisogni (somma mensile)
            const fabbisogniMonth = this.aggregateMonthNeeds(year, month);
            aggregated.fabbisogni.ee.push(fabbisogniMonth.ee);
            aggregated.fabbisogni.ac.push(fabbisogniMonth.ac);
        });

        return aggregated;
    }

    /**
     * Aggrega dati per tutti gli anni disponibili (2024-2025)
     * Mostra i dati mese per mese per l'intero periodo
     */
    aggregateAllYearsData() {
        const years = this.loader.getAvailableYears();

        const aggregated = {
            labels: [],
            prezzi: { pun: [], prezzo_ee: [], prezzo_gas: [], psv: [] },
            consumi: {
                ee_acquistata: [], ee_coge: [], ee_fv: [], ee_totale: [],
                ac_coge: [], ac_caldaie: [], ac_totale: [],
                gas_coge: [], gas_caldaie: [], gas_totale: []
            },
            fabbisogni: { ee: [], ac: [] }
        };

        years.forEach(year => {
            const yearData = this.loader.getYearData(year);
            const months = Object.keys(yearData.consumi).sort((a, b) => parseInt(a) - parseInt(b));

            months.forEach(month => {
                // Label formato: "Gen 2024", "Feb 2024", etc.
                const monthLabel = `${this.config.labels.mesi[parseInt(month) - 1]} ${year}`;
                aggregated.labels.push(monthLabel);

                // Aggrega prezzi (media mensile)
                const prezziMonth = this.aggregateMonthPrices(year, month);
                aggregated.prezzi.pun.push(prezziMonth.pun);
                aggregated.prezzi.prezzo_ee.push(prezziMonth.prezzo_ee);
                aggregated.prezzi.prezzo_gas.push(prezziMonth.prezzo_gas);
                aggregated.prezzi.psv.push(prezziMonth.psv);

                // Aggrega consumi (somma mensile)
                const consumiMonth = this.aggregateMonthConsumption(year, month);
                aggregated.consumi.ee_acquistata.push(consumiMonth.ee_acquistata);
                aggregated.consumi.ee_coge.push(consumiMonth.ee_coge);
                aggregated.consumi.ee_fv.push(consumiMonth.ee_fv);
                aggregated.consumi.ee_totale.push(consumiMonth.ee_totale);
                aggregated.consumi.ac_coge.push(consumiMonth.ac_coge);
                aggregated.consumi.ac_caldaie.push(consumiMonth.ac_caldaie);
                aggregated.consumi.ac_totale.push(consumiMonth.ac_totale);
                aggregated.consumi.gas_coge.push(consumiMonth.gas_coge);
                aggregated.consumi.gas_caldaie.push(consumiMonth.gas_caldaie);
                aggregated.consumi.gas_totale.push(consumiMonth.gas_totale);

                // Aggrega fabbisogni (somma mensile)
                const fabbisogniMonth = this.aggregateMonthNeeds(year, month);
                aggregated.fabbisogni.ee.push(fabbisogniMonth.ee);
                aggregated.fabbisogni.ac.push(fabbisogniMonth.ac);
            });
        });

        return aggregated;
    }

    /**
     * Calcola settimane che toccano il mese (anche parzialmente)
     * Una settimana Lun-Dom viene inclusa se almeno 1 giorno cade nel mese
     */
    getWeeksInMonth(year, month) {
        const weeks = [];
        const monthInt = parseInt(month);
        let weekNum = 1;

        // Trova il primo giorno del mese e l'ultimo
        const firstDayOfMonth = new Date(year, monthInt - 1, 1);
        const lastDayOfMonth = new Date(year, monthInt, 0); // giorno 0 del mese successivo = ultimo giorno del mese corrente

        // Trova il Lunedì della settimana che contiene il primo giorno del mese
        let currentDate = new Date(firstDayOfMonth);
        const dayOfWeek = currentDate.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab

        // Retrocedi al Lunedì precedente (o stesso giorno se è già Lunedì)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentDate.setDate(currentDate.getDate() - daysToMonday);

        // Itera sulle settimane fino a superare l'ultimo giorno del mese
        while (currentDate <= lastDayOfMonth) {
            const weekStart = new Date(currentDate);
            const weekEnd = new Date(currentDate);
            weekEnd.setDate(weekEnd.getDate() + 6); // Domenica

            // Verifica se questa settimana tocca il mese corrente
            if (weekEnd >= firstDayOfMonth && weekStart <= lastDayOfMonth) {
                // Calcola i giorni effettivi della settimana
                const startDay = weekStart.getDate();
                const endDay = weekEnd.getDate();
                const startMonth = weekStart.getMonth() + 1;
                const endMonth = weekEnd.getMonth() + 1;

                // Crea label che mostra il range completo
                let label;
                if (startMonth === endMonth) {
                    // Settimana all'interno dello stesso mese
                    const monthName = this.config.labels.mesi[startMonth - 1];
                    label = `Sett. ${weekNum} (${String(startDay).padStart(2, '0')}-${String(endDay).padStart(2, '0')} ${monthName})`;
                } else {
                    // Settimana a cavallo tra mesi
                    const startMonthName = this.config.labels.mesi[startMonth - 1];
                    const endMonthName = this.config.labels.mesi[endMonth - 1];
                    label = `Sett. ${weekNum} (${String(startDay).padStart(2, '0')} ${startMonthName} - ${String(endDay).padStart(2, '0')} ${endMonthName})`;
                }

                weeks.push({
                    num: weekNum,
                    label: label,
                    startDate: new Date(weekStart),
                    endDate: new Date(weekEnd)
                });
                weekNum++;
            }

            // Passa alla settimana successiva
            currentDate.setDate(currentDate.getDate() + 7);
        }

        return weeks;
    }

    /**
     * Aggrega dati per settimana (orari) - include tutti i giorni anche se fuori dal mese
     */
    aggregateWeekData(year, startDate, endDate) {
        const aggregated = {
            labels: [],
            prezzi: { pun: [], prezzo_ee: [], prezzo_gas: [], psv: [] },
            consumi: {
                ee_acquistata: [], ee_coge: [], ee_fv: [], ee_totale: [],
                ac_coge: [], ac_caldaie: [], ac_totale: [],
                gas_coge: [], gas_caldaie: [], gas_totale: []
            },
            fabbisogni: { ee: [], ac: [] }
        };

        // Itera su tutti i giorni della settimana (anche se in mesi diversi)
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const currentYear = currentDate.getFullYear();
            const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
            const currentDay = String(currentDate.getDate()).padStart(2, '0');

            // Carica dati del mese corrente
            const monthData = this.loader.getMonthData(currentYear, currentMonth);

            if (monthData.consumi[currentDay]) {
                const hours = Object.keys(monthData.consumi[currentDay]).sort((a, b) => parseInt(a) - parseInt(b));

                hours.forEach(hour => {
                    // Label formato: "Lun 01/01 00:00"
                    const dayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][currentDate.getDay()];
                    aggregated.labels.push(`${dayName} ${String(currentDate.getDate()).padStart(2, '0')}/${currentMonth} ${hour}:00`);

                    // Prezzi orari
                    const prezziHour = monthData.prezzi[currentDay]?.[hour] || {};
                    aggregated.prezzi.pun.push(prezziHour.pun || 0);
                    aggregated.prezzi.prezzo_ee.push(prezziHour.prezzo_acquisto_ee_eur_mwh || 0);
                    aggregated.prezzi.prezzo_gas.push(prezziHour.prezzo_acquisto_gas_eur_mwh || 0);
                    aggregated.prezzi.psv.push(prezziHour.psv || 0);

                    // Consumi orari
                    const consumiHour = monthData.consumi[currentDay]?.[hour] || {};
                    const ee_acquistata = consumiHour.ee_acquistata_kwh || 0;
                    const ee_coge = consumiHour.ee_prod_coge_kwh || 0;
                    const ee_fv_base = consumiHour.ee_prod_altro_kwh || 0;
                    // Applica fotovoltaico ottimizzato se attivo
                    const ee_fv = this.getFVValue(currentYear, currentMonth, currentDay, hour, ee_fv_base);
                    const ac_coge = consumiHour.ac_prod_coge_kwh || 0;
                    const ac_caldaie = consumiHour.ac_prod_caldaie_kwh || 0;
                    const gas_coge = consumiHour.gas_consumato_coge_smc || 0;
                    const gas_caldaie = consumiHour.gas_consumato_caldaie_smc || 0;

                    // Applica fermo coge se dentro la finestra
                    const adjusted = this.applyDowntimeAdjust(currentYear, currentMonth, currentDay, {
                        ee_acquistata,
                        ee_coge,
                        ee_fv,
                        ac_coge,
                        ac_caldaie,
                        gas_coge,
                        gas_caldaie
                    });

                    aggregated.consumi.ee_acquistata.push(adjusted.ee_acquistata);
                    aggregated.consumi.ee_coge.push(adjusted.ee_coge);
                    aggregated.consumi.ee_fv.push(adjusted.ee_fv);
                    aggregated.consumi.ee_totale.push(adjusted.ee_acquistata + adjusted.ee_coge + adjusted.ee_fv);
                    aggregated.consumi.ac_coge.push(adjusted.ac_coge);
                    aggregated.consumi.ac_caldaie.push(adjusted.ac_caldaie);
                    aggregated.consumi.ac_totale.push(adjusted.ac_coge + adjusted.ac_caldaie);
                    aggregated.consumi.gas_coge.push(adjusted.gas_coge);
                    aggregated.consumi.gas_caldaie.push(adjusted.gas_caldaie);
                    aggregated.consumi.gas_totale.push(adjusted.gas_coge + adjusted.gas_caldaie);

                    // Fabbisogni orari
                    const fabbisogniHour = monthData.elaborazione[currentDay]?.[hour] || {};
                    aggregated.fabbisogni.ee.push(fabbisogniHour.fabbisogno_ee_azienda_kwh || 0);
                    aggregated.fabbisogni.ac.push(fabbisogniHour.fabbisogno_ac_azienda_kwh || 0);
                });
            }

            // Passa al giorno successivo
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return aggregated;
    }

    /**
     * Aggrega dati per mese (orari)
     */
    aggregateMonthData(year, month) {
        const monthData = this.loader.getMonthData(year, month);
        const days = Object.keys(monthData.consumi).sort((a, b) => parseInt(a) - parseInt(b));

        const aggregated = {
            labels: [],
            prezzi: { pun: [], prezzo_ee: [], prezzo_gas: [], psv: [] },
            consumi: {
                ee_acquistata: [], ee_coge: [], ee_fv: [], ee_totale: [],
                ac_coge: [], ac_caldaie: [], ac_totale: [],
                gas_coge: [], gas_caldaie: [], gas_totale: []
            },
            fabbisogni: { ee: [], ac: [] }
        };

        days.forEach(day => {
            const hours = Object.keys(monthData.consumi[day]).sort((a, b) => parseInt(a) - parseInt(b));

            hours.forEach(hour => {
                // Label formato: "Lun 01/01 00:00"
                const date = new Date(year, parseInt(month) - 1, parseInt(day));
                const dayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][date.getDay()];
                aggregated.labels.push(`${dayName} ${day}/${month} ${hour}:00`);

                // Prezzi orari
                const prezziHour = monthData.prezzi[day]?.[hour] || {};
                aggregated.prezzi.pun.push(prezziHour.pun || 0);
                aggregated.prezzi.prezzo_ee.push(prezziHour.prezzo_acquisto_ee_eur_mwh || 0);
                aggregated.prezzi.prezzo_gas.push(prezziHour.prezzo_acquisto_gas_eur_mwh || 0);
                aggregated.prezzi.psv.push(prezziHour.psv || 0);

                // Consumi orari
                const consumiHour = monthData.consumi[day]?.[hour] || {};
                const ee_acquistata = consumiHour.ee_acquistata_kwh || 0;
                const ee_coge = consumiHour.ee_prod_coge_kwh || 0;
                const ee_fv_base = consumiHour.ee_prod_altro_kwh || 0;
                // Applica fotovoltaico ottimizzato se attivo
                const ee_fv = this.getFVValue(year, month, day, hour, ee_fv_base);
                const ac_coge = consumiHour.ac_prod_coge_kwh || 0;
                const ac_caldaie = consumiHour.ac_prod_caldaie_kwh || 0;
                const gas_coge = consumiHour.gas_consumato_coge_smc || 0;
                const gas_caldaie = consumiHour.gas_consumato_caldaie_smc || 0;

                // DEBUG: Verifica valori FV quando toggle è attivo
                if (this.fvOptimized && ee_fv < 0) {
                    console.warn(`⚠️ FV negativo rilevato: ${ee_fv} kWh a ${day}/${month} ${hour}:00`);
                }

                // Applica fermo coge se dentro la finestra
                const adjusted = this.applyDowntimeAdjust(year, month, day, {
                    ee_acquistata,
                    ee_coge,
                    ee_fv,
                    ac_coge,
                    ac_caldaie,
                    gas_coge,
                    gas_caldaie
                });

                aggregated.consumi.ee_acquistata.push(adjusted.ee_acquistata);
                aggregated.consumi.ee_coge.push(adjusted.ee_coge);
                aggregated.consumi.ee_fv.push(adjusted.ee_fv);
                aggregated.consumi.ee_totale.push(adjusted.ee_acquistata + adjusted.ee_coge + adjusted.ee_fv);
                aggregated.consumi.ac_coge.push(adjusted.ac_coge);
                aggregated.consumi.ac_caldaie.push(adjusted.ac_caldaie);
                aggregated.consumi.ac_totale.push(adjusted.ac_coge + adjusted.ac_caldaie);
                aggregated.consumi.gas_coge.push(adjusted.gas_coge);
                aggregated.consumi.gas_caldaie.push(adjusted.gas_caldaie);
                aggregated.consumi.gas_totale.push(adjusted.gas_coge + adjusted.gas_caldaie);

                // Fabbisogni orari
                const fabbisogniHour = monthData.elaborazione[day]?.[hour] || {};
                aggregated.fabbisogni.ee.push(fabbisogniHour.fabbisogno_ee_azienda_kwh || 0);
                aggregated.fabbisogni.ac.push(fabbisogniHour.fabbisogno_ac_azienda_kwh || 0);
            });
        });

        return aggregated;
    }

    /**
     * Aggrega prezzi mensili (media)
     */
    aggregateMonthPrices(year, month) {
        const monthData = this.loader.getMonthData(year, month);
        const days = Object.keys(monthData.prezzi);

        let totals = { pun: 0, prezzo_ee: 0, prezzo_gas: 0, psv: 0, count: 0 };

        days.forEach(day => {
            const hours = Object.keys(monthData.prezzi[day]);
            hours.forEach(hour => {
                const data = monthData.prezzi[day][hour];
                totals.pun += data.pun || 0;
                totals.prezzo_ee += data.prezzo_acquisto_ee_eur_mwh || 0;
                totals.prezzo_gas += data.prezzo_acquisto_gas_eur_mwh || 0;
                totals.psv += data.psv || 0;
                totals.count++;
            });
        });

        return {
            pun: totals.count > 0 ? totals.pun / totals.count : 0,
            prezzo_ee: totals.count > 0 ? totals.prezzo_ee / totals.count : 0,
            prezzo_gas: totals.count > 0 ? totals.prezzo_gas / totals.count : 0,
            psv: totals.count > 0 ? totals.psv / totals.count : 0
        };
    }

    /**
     * Aggrega consumi mensili (somma)
     */
    aggregateMonthConsumption(year, month) {
        const monthData = this.loader.getMonthData(year, month);
        const days = Object.keys(monthData.consumi);

        let totals = {
            ee_acquistata: 0, ee_coge: 0, ee_fv: 0,
            ac_coge: 0, ac_caldaie: 0,
            gas_coge: 0, gas_caldaie: 0
        };

        days.forEach(day => {
            const hours = Object.keys(monthData.consumi[day]);
            hours.forEach(hour => {
                const data = monthData.consumi[day][hour];
                const ee_fv_base = data.ee_prod_altro_kwh || 0;
                const ee_fv = this.getFVValue(year, month, day, hour, ee_fv_base);

                const adjusted = this.applyDowntimeAdjust(year, month, day, {
                    ee_acquistata: data.ee_acquistata_kwh || 0,
                    ee_coge: data.ee_prod_coge_kwh || 0,
                    ee_fv,
                    ac_coge: data.ac_prod_coge_kwh || 0,
                    ac_caldaie: data.ac_prod_caldaie_kwh || 0,
                    gas_coge: data.gas_consumato_coge_smc || 0,
                    gas_caldaie: data.gas_consumato_caldaie_smc || 0
                });

                totals.ee_acquistata += adjusted.ee_acquistata;
                totals.ee_coge += adjusted.ee_coge;
                totals.ee_fv += adjusted.ee_fv;
                totals.ac_coge += adjusted.ac_coge;
                totals.ac_caldaie += adjusted.ac_caldaie;
                totals.gas_coge += adjusted.gas_coge;
                totals.gas_caldaie += adjusted.gas_caldaie;
            });
        });

        return {
            ...totals,
            ee_totale: totals.ee_acquistata + totals.ee_coge + totals.ee_fv,
            ac_totale: totals.ac_coge + totals.ac_caldaie,
            gas_totale: totals.gas_coge + totals.gas_caldaie
        };
    }

    /**
     * Aggrega fabbisogni mensili (somma)
     */
    aggregateMonthNeeds(year, month) {
        const monthData = this.loader.getMonthData(year, month);
        const days = Object.keys(monthData.elaborazione);

        let totals = { ee: 0, ac: 0 };

        days.forEach(day => {
            const hours = Object.keys(monthData.elaborazione[day]);
            hours.forEach(hour => {
                const data = monthData.elaborazione[day][hour];
                totals.ee += data.fabbisogno_ee_azienda_kwh || 0;
                totals.ac += data.fabbisogno_ac_azienda_kwh || 0;
            });
        });

        return totals;
    }

    /**
     * Calcola KPI principali per un periodo
     */
    calculateKPIs(year, month = null) {
        let data;
        if (month) {
            data = this.aggregateMonthData(year, month);
        } else {
            data = this.aggregateYearData(year);
        }

        // Somma totali
        const sum = arr => arr.reduce((a, b) => a + b, 0);
        const avg = arr => arr.length > 0 ? sum(arr) / arr.length : 0;

        const kpis = {
            // Consumi totali
            ee_totale: sum(data.consumi.ee_totale),
            ee_acquistata: sum(data.consumi.ee_acquistata),
            ee_autoprodotta: sum(data.consumi.ee_coge) + sum(data.consumi.ee_fv),
            ee_coge: sum(data.consumi.ee_coge),
            ee_fv: sum(data.consumi.ee_fv),

            ac_totale: sum(data.consumi.ac_totale),
            ac_coge: sum(data.consumi.ac_coge),
            ac_caldaie: sum(data.consumi.ac_caldaie),

            gas_totale: sum(data.consumi.gas_totale),
            gas_coge: sum(data.consumi.gas_coge),
            gas_caldaie: sum(data.consumi.gas_caldaie),

            // Fabbisogni
            fabbisogno_ee: sum(data.fabbisogni.ee),
            fabbisogno_ac: sum(data.fabbisogni.ac),

            // Prezzi medi
            prezzo_medio_pun: avg(data.prezzi.pun),
            prezzo_medio_ee: avg(data.prezzi.prezzo_ee),
            prezzo_medio_gas: avg(data.prezzi.prezzo_gas),

            // Prezzi min/max
            prezzo_min_pun: Math.min(...data.prezzi.pun),
            prezzo_max_pun: Math.max(...data.prezzi.pun),
        };

        // Calcola % autosufficienza (% energia NON acquistata dalla rete)
        kpis.autosufficienza_ee_perc = kpis.fabbisogno_ee > 0
            ? Math.max(0, Math.min(100, ((kpis.fabbisogno_ee - kpis.ee_acquistata) / kpis.fabbisogno_ee) * 100))
            : 0;

        kpis.copertura_coge_ac_perc = kpis.fabbisogno_ac > 0
            ? (kpis.ac_coge / kpis.fabbisogno_ac) * 100
            : 0;

        // Calcola efficienze effettive cogeneratore
        const pci = this.config.caldaia.pci_gas_kwh_smc;
        if (kpis.gas_coge > 0) {
            const energia_gas_coge = kpis.gas_coge * pci;
            kpis.eff_elettrica_coge_perc = (kpis.ee_coge / energia_gas_coge) * 100;
            kpis.eff_termica_coge_perc = (kpis.ac_coge / energia_gas_coge) * 100;
            kpis.eff_totale_coge_perc = kpis.eff_elettrica_coge_perc + kpis.eff_termica_coge_perc;
        } else {
            kpis.eff_elettrica_coge_perc = 0;
            kpis.eff_termica_coge_perc = 0;
            kpis.eff_totale_coge_perc = 0;
        }

        // Calcola ore equivalenti funzionamento cogeneratore
        kpis.ore_funz_coge = kpis.ee_coge > 0
            ? kpis.ee_coge / this.config.cogeneratore.potenza_max_kw
            : 0;

        // Calcola fattore di carico medio
        const ore_periodo = month ? 24 * 31 : 24 * 365; // approssimato
        kpis.fattore_carico_coge_perc = (kpis.ore_funz_coge / ore_periodo) * 100;

        return kpis;
    }

    /**
     * Calcola KPI per tutti gli anni disponibili (2024-2025)
     */
    calculateAllYearsKPIs() {
        const years = this.loader.getAvailableYears();
        const data = this.aggregateAllYearsData();

        // Somma totali
        const sum = arr => arr.reduce((a, b) => a + b, 0);
        const avg = arr => arr.length > 0 ? sum(arr) / arr.length : 0;

        const kpis = {
            // Consumi totali
            ee_totale: sum(data.consumi.ee_totale),
            ee_acquistata: sum(data.consumi.ee_acquistata),
            ee_autoprodotta: sum(data.consumi.ee_coge) + sum(data.consumi.ee_fv),
            ee_coge: sum(data.consumi.ee_coge),
            ee_fv: sum(data.consumi.ee_fv),

            ac_totale: sum(data.consumi.ac_totale),
            ac_coge: sum(data.consumi.ac_coge),
            ac_caldaie: sum(data.consumi.ac_caldaie),

            gas_totale: sum(data.consumi.gas_totale),
            gas_coge: sum(data.consumi.gas_coge),
            gas_caldaie: sum(data.consumi.gas_caldaie),

            // Fabbisogni
            fabbisogno_ee: sum(data.fabbisogni.ee),
            fabbisogno_ac: sum(data.fabbisogni.ac),

            // Prezzi medi
            prezzo_medio_pun: avg(data.prezzi.pun),
            prezzo_medio_ee: avg(data.prezzi.prezzo_ee),
            prezzo_medio_gas: avg(data.prezzi.prezzo_gas),

            // Prezzi min/max
            prezzo_min_pun: Math.min(...data.prezzi.pun),
            prezzo_max_pun: Math.max(...data.prezzi.pun),
        };

        // Calcola % autosufficienza (% energia NON acquistata dalla rete)
        kpis.autosufficienza_ee_perc = kpis.fabbisogno_ee > 0
            ? Math.max(0, Math.min(100, ((kpis.fabbisogno_ee - kpis.ee_acquistata) / kpis.fabbisogno_ee) * 100))
            : 0;

        kpis.copertura_coge_ac_perc = kpis.fabbisogno_ac > 0
            ? (kpis.ac_coge / kpis.fabbisogno_ac) * 100
            : 0;

        // Calcola efficienze effettive cogeneratore
        const pci = this.config.caldaia.pci_gas_kwh_smc;
        if (kpis.gas_coge > 0) {
            const energia_gas_coge = kpis.gas_coge * pci;
            kpis.eff_elettrica_coge_perc = (kpis.ee_coge / energia_gas_coge) * 100;
            kpis.eff_termica_coge_perc = (kpis.ac_coge / energia_gas_coge) * 100;
            kpis.eff_totale_coge_perc = kpis.eff_elettrica_coge_perc + kpis.eff_termica_coge_perc;
        } else {
            kpis.eff_elettrica_coge_perc = 0;
            kpis.eff_termica_coge_perc = 0;
            kpis.eff_totale_coge_perc = 0;
        }

        // Calcola ore equivalenti funzionamento cogeneratore
        kpis.ore_funz_coge = kpis.ee_coge > 0
            ? kpis.ee_coge / this.config.cogeneratore.potenza_max_kw
            : 0;

        // Calcola fattore di carico medio per tutti gli anni
        const ore_periodo = 24 * 365 * years.length; // ore totali per tutti gli anni
        kpis.fattore_carico_coge_perc = (kpis.ore_funz_coge / ore_periodo) * 100;

        return kpis;
    }

    /**
     * Aggrega dati strategie per anno
     */
    aggregateYearStrategies(year) {
        const yearData = this.loader.getYearData(year);
        const months = Object.keys(yearData.recap).sort((a, b) => parseInt(a) - parseInt(b));

        const strategies = {
            labels: months.map(m => this.config.labels.mesi[parseInt(m) - 1]),
            costo_attuale: [],
            costo_coge_spento: [],
            costo_coge_minimo: [],
            costo_coge_ins_elettrico: [],
            costo_coge_ins_elettrico_plus: [],
            costo_coge_massimo: [],
            costo_coge_ins_termico: [],
            minimo: [],
            risparmio_possibile: [],
            range_costi: [],
            total_hours: 0,
            // Array di conteggi flag per ogni mese
            minimo_attuale: [],
            minimo_spento: [],
            minimo_minimo: [],
            minimo_ins_ele: [],
            minimo_ins_ele_plus: [],
            minimo_massimo: [],
            minimo_ins_frigo: []
        };

        months.forEach(month => {
            const monthStrategies = this.aggregateMonthStrategies(year, month);
            strategies.costo_attuale.push(monthStrategies.costo_attuale);
            strategies.costo_coge_spento.push(monthStrategies.costo_coge_spento);
            strategies.costo_coge_minimo.push(monthStrategies.costo_coge_minimo);
            strategies.costo_coge_ins_elettrico.push(monthStrategies.costo_coge_ins_elettrico);
            strategies.costo_coge_ins_elettrico_plus.push(monthStrategies.costo_coge_ins_elettrico_plus);
            strategies.costo_coge_massimo.push(monthStrategies.costo_coge_massimo);
            strategies.costo_coge_ins_termico.push(monthStrategies.costo_coge_ins_termico);
            strategies.minimo.push(monthStrategies.minimo);
            strategies.risparmio_possibile.push(monthStrategies.risparmio_possibile);
            strategies.range_costi.push(monthStrategies.range_costi || 0);
            strategies.total_hours += monthStrategies.total_hours || 0;

            // Aggiungi conteggi flag (sono già sommati per tutto il mese)
            strategies.minimo_attuale.push(monthStrategies.minimo_attuale || 0);
            strategies.minimo_spento.push(monthStrategies.minimo_spento || 0);
            strategies.minimo_minimo.push(monthStrategies.minimo_minimo || 0);
            strategies.minimo_ins_ele.push(monthStrategies.minimo_ins_ele || 0);
            strategies.minimo_ins_ele_plus.push(monthStrategies.minimo_ins_ele_plus || 0);
            strategies.minimo_massimo.push(monthStrategies.minimo_massimo || 0);
            strategies.minimo_ins_frigo.push(monthStrategies.minimo_ins_frigo || 0);
        });

        return strategies;
    }

    /**
     * Aggrega dati strategie per tutti gli anni disponibili (2024-2025)
     * Mostra i dati mese per mese per l'intero periodo
     */
    aggregateAllYearsStrategies() {
        const years = this.loader.getAvailableYears();

        const strategies = {
            labels: [],
            costo_attuale: [],
            costo_coge_spento: [],
            costo_coge_minimo: [],
            costo_coge_ins_elettrico: [],
            costo_coge_ins_elettrico_plus: [],
            costo_coge_massimo: [],
            costo_coge_ins_termico: [],
            minimo: [],
            risparmio_possibile: [],
            range_costi: [],
            total_hours: 0,
            // Array di conteggi flag per ogni mese
            minimo_attuale: [],
            minimo_spento: [],
            minimo_minimo: [],
            minimo_ins_ele: [],
            minimo_ins_ele_plus: [],
            minimo_massimo: [],
            minimo_ins_frigo: []
        };

        years.forEach(year => {
            const yearData = this.loader.getYearData(year);
            const months = Object.keys(yearData.recap).sort((a, b) => parseInt(a) - parseInt(b));

            months.forEach(month => {
                // Label formato: "Gen 2024", "Feb 2024", etc.
                const monthLabel = `${this.config.labels.mesi[parseInt(month) - 1]} ${year}`;
                strategies.labels.push(monthLabel);

                const monthStrategies = this.aggregateMonthStrategies(year, month);
                strategies.costo_attuale.push(monthStrategies.costo_attuale);
                strategies.costo_coge_spento.push(monthStrategies.costo_coge_spento);
                strategies.costo_coge_minimo.push(monthStrategies.costo_coge_minimo);
                strategies.costo_coge_ins_elettrico.push(monthStrategies.costo_coge_ins_elettrico);
                strategies.costo_coge_ins_elettrico_plus.push(monthStrategies.costo_coge_ins_elettrico_plus);
                strategies.costo_coge_massimo.push(monthStrategies.costo_coge_massimo);
                strategies.costo_coge_ins_termico.push(monthStrategies.costo_coge_ins_termico);
                strategies.minimo.push(monthStrategies.minimo);
                strategies.risparmio_possibile.push(monthStrategies.risparmio_possibile);
                strategies.range_costi.push(monthStrategies.range_costi || 0);
                strategies.total_hours += monthStrategies.total_hours || 0;

                // Aggiungi conteggi flag (sono già sommati per tutto il mese)
                strategies.minimo_attuale.push(monthStrategies.minimo_attuale || 0);
                strategies.minimo_spento.push(monthStrategies.minimo_spento || 0);
                strategies.minimo_minimo.push(monthStrategies.minimo_minimo || 0);
                strategies.minimo_ins_ele.push(monthStrategies.minimo_ins_ele || 0);
                strategies.minimo_ins_ele_plus.push(monthStrategies.minimo_ins_ele_plus || 0);
                strategies.minimo_massimo.push(monthStrategies.minimo_massimo || 0);
                strategies.minimo_ins_frigo.push(monthStrategies.minimo_ins_frigo || 0);
            });
        });

        return strategies;
    }

    /**
     * Aggrega dati strategie per mese (somma costi orari)
     */
    aggregateMonthStrategies(year, month) {
        const yearData = this.loader.getYearData(year);
        const monthStr = month.toString().padStart(2, '0');
            const monthData = yearData.recap[monthStr] || {};
            const days = Object.keys(monthData).sort((a, b) => parseInt(a) - parseInt(b));

            const totals = {
            costo_attuale: 0,
            costo_coge_spento: 0,
            costo_coge_minimo: 0,
            costo_coge_ins_elettrico: 0,
            costo_coge_ins_elettrico_plus: 0,
            costo_coge_massimo: 0,
            costo_coge_ins_termico: 0,
            minimo: 0,
            risparmio_possibile: 0,
            range_costi: 0,
            total_hours: 0,
            // Conteggi flag per strategia ottimale
            minimo_attuale: 0,
            minimo_spento: 0,
            minimo_minimo: 0,
            minimo_ins_ele: 0,
            minimo_ins_ele_plus: 0,
            minimo_massimo: 0,
            minimo_ins_frigo: 0
        };

            days.forEach(day => {
                const hours = Object.keys(monthData[day]).sort((a, b) => parseInt(a) - parseInt(b));
                hours.forEach(hour => {
                    const data = this.applyDowntimeCostAdjust(year, month, day, monthData[day][hour]);
                    totals.costo_attuale += data.costo_attuale || 0;
                    totals.costo_coge_spento += data.costo_coge_spento || 0;
                    totals.costo_coge_minimo += data.costo_coge_minimo || 0;
                    totals.costo_coge_ins_elettrico += data.costo_coge_ins_elettrico || 0;
                totals.costo_coge_ins_elettrico_plus += data['costo_coge_ins_elettrico+'] || 0;
                totals.costo_coge_massimo += data.costo_coge_massimo || 0;
                totals.costo_coge_ins_termico += data.costo_coge_ins_termico || 0;
                totals.minimo += data.minimo || 0;
                totals.risparmio_possibile += data.risparmio_possibile || 0;
                totals.range_costi += data.range_costi || 0;
                totals.total_hours += 1;

                // Somma flag per strategia ottimale
                totals.minimo_attuale += data.minimo_att || 0;
                totals.minimo_spento += data.minimo_spento || 0;
                totals.minimo_minimo += data.minimo_minimo || 0;
                totals.minimo_ins_ele += data.minimo_ins_ele || 0;
                totals.minimo_ins_ele_plus += data['minimo_ins_ele+'] || 0;
                totals.minimo_massimo += data.minimo_massimo || 0;
                totals.minimo_ins_frigo += data.minimo_ins_frigo || 0;
            });
        });

        return totals;
    }

    /**
     * Aggrega dati strategie per mese (orari) - per grafici responsive
     */
    aggregateMonthDataStrategies(year, month) {
        const yearData = this.loader.getYearData(year);
        const monthStr = month.toString().padStart(2, '0');
        const monthData = yearData.recap[monthStr] || {};
        const days = Object.keys(monthData).sort((a, b) => parseInt(a) - parseInt(b));

        const strategies = {
            labels: [],
            costo_attuale: [],
            costo_coge_spento: [],
            costo_coge_minimo: [],
            costo_coge_ins_elettrico: [],
            costo_coge_ins_elettrico_plus: [],
            costo_coge_massimo: [],
            costo_coge_ins_termico: [],
            minimo: [],
            risparmio_possibile: [],
            range_costi: [],
            total_hours: 0,
            // Flag per strategia ottimale
            minimo_attuale: [],
            minimo_spento: [],
            minimo_minimo: [],
            minimo_ins_ele: [],
            minimo_ins_ele_plus: [],
            minimo_massimo: [],
            minimo_ins_frigo: []
        };

        days.forEach(day => {
            const hours = Object.keys(monthData[day]).sort((a, b) => parseInt(a) - parseInt(b));

            hours.forEach(hour => {
                // Label formato: "Lun 01/01 00:00"
                const date = new Date(year, parseInt(month) - 1, parseInt(day));
                const dayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][date.getDay()];
                strategies.labels.push(`${dayName} ${day}/${month} ${hour}:00`);

                const data = this.applyDowntimeCostAdjust(year, month, day, monthData[day][hour]);
                strategies.costo_attuale.push(data.costo_attuale || 0);
                strategies.costo_coge_spento.push(data.costo_coge_spento || 0);
                strategies.costo_coge_minimo.push(data.costo_coge_minimo || 0);
                strategies.costo_coge_ins_elettrico.push(data.costo_coge_ins_elettrico || 0);
                strategies.costo_coge_ins_elettrico_plus.push(data['costo_coge_ins_elettrico+'] || 0);
                strategies.costo_coge_massimo.push(data.costo_coge_massimo || 0);
                strategies.costo_coge_ins_termico.push(data.costo_coge_ins_termico || 0);
                strategies.minimo.push(data.minimo || 0);
                strategies.risparmio_possibile.push(data.risparmio_possibile || 0);
                strategies.range_costi.push(data.range_costi || 0);
                strategies.total_hours += 1;

                // Flag per strategia ottimale (1 = ottimale, 0 = non ottimale)
                strategies.minimo_attuale.push(data.minimo_att || 0);
                strategies.minimo_spento.push(data.minimo_spento || 0);
                strategies.minimo_minimo.push(data.minimo_minimo || 0);
                strategies.minimo_ins_ele.push(data.minimo_ins_ele || 0);
                strategies.minimo_ins_ele_plus.push(data['minimo_ins_ele+'] || 0);
                strategies.minimo_massimo.push(data.minimo_massimo || 0);
                strategies.minimo_ins_frigo.push(data.minimo_ins_frigo || 0);
            });
        });

        return strategies;
    }

    /**
     * Aggrega dati strategie per settimana (orari) - per grafici responsive
     */
    aggregateWeekDataStrategies(year, startDate, endDate) {
        const strategies = {
            labels: [],
            costo_attuale: [],
            costo_coge_spento: [],
            costo_coge_minimo: [],
            costo_coge_ins_elettrico: [],
            costo_coge_ins_elettrico_plus: [],
            costo_coge_massimo: [],
            costo_coge_ins_termico: [],
            minimo: [],
            risparmio_possibile: [],
            range_costi: [],
            total_hours: 0,
            // Flag per strategia ottimale
            minimo_attuale: [],
            minimo_spento: [],
            minimo_minimo: [],
            minimo_ins_ele: [],
            minimo_ins_ele_plus: [],
            minimo_massimo: [],
            minimo_ins_frigo: []
        };

        // Itera su tutti i giorni della settimana
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const currentYear = currentDate.getFullYear();
            const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
            const currentDay = String(currentDate.getDate()).padStart(2, '0');

            // Carica dati del mese corrente
            const yearData = this.loader.getYearData(currentYear);
            const monthData = yearData.recap[currentMonth] || {};

            if (monthData[currentDay]) {
                const hours = Object.keys(monthData[currentDay]).sort((a, b) => parseInt(a) - parseInt(b));

                hours.forEach(hour => {
                    // Label formato: "Lun 01/01 00:00"
                    const dayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][currentDate.getDay()];
                    strategies.labels.push(`${dayName} ${String(currentDate.getDate()).padStart(2, '0')}/${currentMonth} ${hour}:00`);

                    const data = monthData[currentDay][hour];
                    strategies.costo_attuale.push(data.costo_attuale || 0);
                    strategies.costo_coge_spento.push(data.costo_coge_spento || 0);
                    strategies.costo_coge_minimo.push(data.costo_coge_minimo || 0);
                    strategies.costo_coge_ins_elettrico.push(data.costo_coge_ins_elettrico || 0);
                    strategies.costo_coge_ins_elettrico_plus.push(data['costo_coge_ins_elettrico+'] || 0);
                    strategies.costo_coge_massimo.push(data.costo_coge_massimo || 0);
                    strategies.costo_coge_ins_termico.push(data.costo_coge_ins_termico || 0);
                    strategies.minimo.push(data.minimo || 0);
                    strategies.risparmio_possibile.push(data.risparmio_possibile || 0);
                    strategies.range_costi.push(data.range_costi || 0);
                    strategies.total_hours += 1;

                    // Flag per strategia ottimale
                    strategies.minimo_attuale.push(data.minimo_att || 0);
                    strategies.minimo_spento.push(data.minimo_spento || 0);
                    strategies.minimo_minimo.push(data.minimo_minimo || 0);
                    strategies.minimo_ins_ele.push(data.minimo_ins_ele || 0);
                    strategies.minimo_ins_ele_plus.push(data['minimo_ins_ele+'] || 0);
                    strategies.minimo_massimo.push(data.minimo_massimo || 0);
                    strategies.minimo_ins_frigo.push(data.minimo_ins_frigo || 0);
                });
            }

            // Passa al giorno successivo
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return strategies;
    }

    /**
     * Calcola KPI strategie per un periodo
     */
    calculateStrategyKPIs(strategies, isYearView = false, year = null) {
        const sum = arr => (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);

        // Totali periodo
        const totals = {
            costo_attuale: sum(strategies.costo_attuale),
            costo_coge_spento: sum(strategies.costo_coge_spento),
            costo_coge_minimo: sum(strategies.costo_coge_minimo),
            costo_coge_ins_elettrico: sum(strategies.costo_coge_ins_elettrico),
            costo_coge_massimo: sum(strategies.costo_coge_massimo),
            costo_coge_ins_termico: sum(strategies.costo_coge_ins_termico),
            minimo: sum(strategies.minimo),
            risparmio_possibile: sum(strategies.risparmio_possibile)
        };

        // Range costi: preferisci la somma dei range orari se disponibile, altrimenti fallback max-min totale
        const rangeFromData = strategies.range_costi && strategies.range_costi.length > 0
            ? sum(strategies.range_costi)
            : null;
        const allCosts = [
            totals.costo_attuale,
            totals.costo_coge_spento,
            totals.costo_coge_minimo,
            totals.costo_coge_ins_elettrico,
            totals.costo_coge_ins_elettrico_plus,
            totals.costo_coge_massimo,
            totals.costo_coge_ins_termico
        ];
        const validCosts = allCosts.filter(c => typeof c === 'number' && !isNaN(c));
        totals.range_costi = rangeFromData !== null
            ? rangeFromData
            : (validCosts.length ? Math.max(...validCosts) - Math.min(...validCosts) : 0);

        // Identifica la miglior strategia fissa (tra le opzioni standard)
        const staticStrategies = [
            totals.costo_coge_minimo,
            totals.costo_coge_ins_elettrico,
            totals.costo_coge_massimo,
            totals.costo_coge_ins_termico
        ].filter(v => typeof v === 'number' && !isNaN(v));
        const bestStaticStrategy = staticStrategies.length ? Math.min(...staticStrategies) : totals.minimo;

        // Calcola quale strategia è ottimale per ogni ora
        // Usa i campi minimo_* dai dati JSON invece di trovare il minimo
        const optimalCounts = {
            attuale: 0,
            coge_spento: 0,
            coge_minimo: 0,
            coge_ins_elettrico: 0,
            coge_massimo: 0,
            coge_ins_termico: 0
        };

        const numPoints = strategies.costo_attuale.length;
        const totalHoursFromData = strategies.total_hours || (!isYearView ? numPoints : 0);

        // Conta usando i flag minimo_* dai dati originali
        // I flag indicano quale strategia è ottimale per ogni ora
        const minFlags = {
            attuale: strategies.minimo_attuale || [],
            coge_spento: strategies.minimo_spento || [],
            coge_minimo: strategies.minimo_minimo || [],
            coge_ins_elettrico: strategies.minimo_ins_ele || [],
            coge_massimo: strategies.minimo_massimo || [],
            coge_ins_termico: strategies.minimo_ins_frigo || []
        };

        if (isYearView) {
            // Per la vista anno, i dati sono già sommati per mese
            // Quindi minimo_attuale contiene il conteggio totale delle ore per ogni mese
            // Dobbiamo sommare su tutti i mesi
            for (const [strategy, countArray] of Object.entries(minFlags)) {
                optimalCounts[strategy] = countArray.reduce((a, b) => a + b, 0);
            }
        } else {
            // Per la vista mese/settimana, i flag sono 0/1 per ogni ora
            for (let i = 0; i < numPoints; i++) {
                for (const [strategy, flagArray] of Object.entries(minFlags)) {
                    if (flagArray[i] === 1) {
                        optimalCounts[strategy]++;
                    }
                }
            }
        }

        // Calcola percentuali
        // Per la vista anno: totale ore anno
        // Per la vista mese/settimana: numPoints è il numero di ore
        let totalHours;
        if (totalHoursFromData) {
            totalHours = totalHoursFromData;
        } else if (isYearView) {
            if (year === '2025') {
                totalHours = 6791; // ~283 giorni * 24 ore
            } else if (year === '2024') {
                totalHours = 8760; // 365 giorni * 24 ore
            } else if (year === 'all') {
                totalHours = 8760 + 6791; // 2024 + 2025
            } else {
                totalHours = numPoints * 24 * 30.5; // Stima basata su numero di mesi
            }
        } else {
            totalHours = numPoints;
        }
        if (!totalHours || totalHours <= 0) {
            totalHours = numPoints || 1;
        }

        const optimalPercentages = {};
        for (const [strategy, count] of Object.entries(optimalCounts)) {
            optimalPercentages[strategy] = (count / totalHours) * 100;
        }

        // Risparmi specifici
        const cogeOptVsAttuale = totals.costo_attuale - totals.minimo; // Attuale vs ottimizzazione oraria
        const cogeOptVsBest = bestStaticStrategy - totals.minimo;      // Gap tra migliore strategia fissa e ottimizzazione oraria
        const attualeVsBest = cogeOptVsAttuale + cogeOptVsBest;        // Beneficio complessivo: attuale -> ottimo orario + gap vs migliore fissa
        const risparmi = {
            vs_spento: totals.costo_coge_spento - bestStaticStrategy,  // Risparmio passando da spento a miglior strategia fissa
            coge_opt_vs_attuale: cogeOptVsAttuale,
            coge_opt_vs_best: cogeOptVsBest,
            attuale_vs_best: attualeVsBest,
            coge_opt_vs_attuale_perc: totals.costo_attuale > 0 ? (cogeOptVsAttuale / totals.costo_attuale) * 100 : 0,
            coge_opt_vs_best_perc: bestStaticStrategy > 0 ? (cogeOptVsBest / bestStaticStrategy) * 100 : 0,
            attuale_vs_best_perc: totals.costo_attuale > 0 ? (attualeVsBest / totals.costo_attuale) * 100 : 0
        };

        // Calcola periodo correttamente in base alla vista
        let periodo_giorni;
        if (totalHoursFromData) {
            periodo_giorni = Math.max(1, Math.floor(totalHoursFromData / 24));
        } else if (isYearView) {
            // Vista anno: calcola giorni in base all'anno
            if (year === 'all') {
                periodo_giorni = 730; // Due anni completi (2024 + 2025)
            } else if (year === '2025') {
                periodo_giorni = 283; // 2025 parziale (fino al 10/10/25 ore 22:00)
            } else if (year === '2024') {
                periodo_giorni = 365; // 2024 completo
            } else if (numPoints === 12) {
                periodo_giorni = 365; // Anno completo
            } else if (numPoints === 24) {
                periodo_giorni = 730; // Due anni completi
            } else {
                // Stima basata sul numero di punti (mesi)
                periodo_giorni = Math.round(numPoints * 30.5); // Media giorni per mese
            }
        } else {
            // Vista mese/settimana: numPoints = ore, quindi giorni = ore / 24
            periodo_giorni = Math.max(1, Math.floor(numPoints / 24));
        }

        return {
            totals,
            optimalPercentages,
            risparmi,
            periodo_giorni
        };
    }

    /**
     * NUOVO: Aggrega dati per confronto diretto Normal vs FV12
     * Carica ENTRAMBE le versioni contemporaneamente
     * Restituisce formato ottimizzato per grafico a barre affiancate
     */
    async aggregateFVComparisonBars(year, month = null, week = null) {
        // Usa i dati già caricati (precaricati all'inizio)
        const bothVersions = this.loader.bothVersions;

        if (!bothVersions || !bothVersions.normal || !bothVersions.fv12) {
            console.error('Dati confronto FV non ancora caricati!');
            return null;
        }

        // DEBUG: Verifica che i dati siano diversi e disponibili
        if (!bothVersions.normal[year] || !bothVersions.fv12[year]) {
            console.error(`Dati anno ${year} non disponibili in bothVersions!`, {
                normal: !!bothVersions.normal[year],
                fv12: !!bothVersions.fv12[year],
                yearsNormal: Object.keys(bothVersions.normal),
                yearsFV12: Object.keys(bothVersions.fv12)
            });
            throw new Error(`Dati anno ${year} non disponibili per confronto FV`);
        }

        // Verifica che i dati siano effettivamente diversi (sanity check)
        const yearNormal = bothVersions.normal[year];
        const yearFV12 = bothVersions.fv12[year];
        if (yearNormal === yearFV12) {
            console.error('⚠️ ERRORE CRITICO: bothVersions.normal e bothVersions.fv12 puntano agli stessi dati!');
            throw new Error('Dati Normal e FV12 sono identici - possibile problema nel caricamento');
        }

        // DEBUG: Verifica un punto specifico per vedere se i dati sono effettivamente diversi
        const testMonth = Object.keys(yearNormal || {})[0];
        if (testMonth) {
            const testDay = Object.keys(yearNormal[testMonth] || {})[0];
            if (testDay) {
                const testHour = Object.keys(yearNormal[testMonth][testDay] || {})[0];
                if (testHour) {
                    const testNormal = yearNormal[testMonth][testDay][testHour];
                    const testFV12 = yearFV12?.[testMonth]?.[testDay]?.[testHour];
                    if (testNormal && testFV12) {
                        const nFV = testNormal.ee_prod_altro_kwh || 0;
                        const fFV = testFV12.ee_prod_altro_kwh || 0;
                        const nTot = (testNormal.ee_prod_coge_kwh || 0) + nFV;
                        const fTot = (testFV12.ee_prod_coge_kwh || 0) + fFV;
                        console.log(`🔍 Test punto ${year}/${testMonth}/${testDay}/${testHour}: Normal Tot=${nTot}, FV12 Tot=${fTot}, Diff=${Math.abs(nTot - fTot)}`);
                        if (testNormal === testFV12) {
                            console.error(`⚠️ ERRORE: Test point è lo stesso oggetto!`);
                        }
                    }
                }
            }
        }

        const comparison = {
            labels: [],
            normal: [],  // Produzione Normal
            fv12: [],    // Produzione FV12
            fabbisogno: [] // Fabbisogno per riferimento
        };

        // Supporta vista settimanale - AGGREGA PER GIORNO
        if (week && week.startDate && week.endDate) {
            console.log('Vista SETTIMANALE FV - Aggregazione giornaliera');
            const startDate = new Date(week.startDate);
            const endDate = new Date(week.endDate);
            const monthStr = month.toString().padStart(2, '0');

            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const day = currentDate.getDate().toString().padStart(2, '0');
                const date = new Date(year, parseInt(month) - 1, parseInt(day));
                const dayName = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][date.getDay()];

                // Aggrega tutte le ore del giorno
                let normal_day = 0;
                let fv12_day = 0;
                let fabbisogno_day = 0;

                const normalDayData = bothVersions.normal[year]?.[monthStr]?.[day];
                const fv12DayData = bothVersions.fv12[year]?.[monthStr]?.[day];

                if (!normalDayData || !fv12DayData) {
                    console.warn(`⚠️ Dati mancanti per ${year}/${monthStr}/${day}`);
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }

                // Verifica reference check
                if (normalDayData === fv12DayData) {
                    console.error(`⚠️ ERRORE: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}!`);
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }

                const hours = Object.keys(normalDayData).sort((a, b) => parseInt(a) - parseInt(b));

                hours.forEach(hour => {
                    // Dati Normal
                    const normalData = normalDayData[hour];
                    const fv12Data = fv12DayData[hour];

                    if (!normalData || !fv12Data) {
                        console.warn(`⚠️ Dati mancanti per ${year}/${monthStr}/${day}/${hour}`);
                        return;
                    }

                    // Verifica reference check
                    if (normalData === fv12Data) {
                        console.error(`⚠️ ERRORE: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}/${hour}!`);
                        return;
                    }

                    const normal_produzione = (normalData.ee_prod_coge_kwh || 0) + (normalData.ee_prod_altro_kwh || 0);
                    const fv12_produzione = (fv12Data.ee_prod_coge_kwh || 0) + (fv12Data.ee_prod_altro_kwh || 0);

                    // Dati fabbisogno
                    const elaborazione = this.loader.getMonthData(year, month);
                    const elaborazioneHour = elaborazione?.elaborazione?.[day]?.[hour] || {};
                    const fabbisogno = elaborazioneHour.fabbisogno_ee_azienda_kwh || 0;

                    normal_day += normal_produzione;
                    fv12_day += fv12_produzione;
                    fabbisogno_day += fabbisogno;
                });

                // DEBUG: Verifica che i valori siano diversi
                if (Math.abs(normal_day - fv12_day) < 0.01) {
                    console.warn(`⚠️ ATTENZIONE: normal_day (${normal_day}) e fv12_day (${fv12_day}) sono quasi identici per ${dayName} ${day}/${month}`);
                }

                comparison.labels.push(`${dayName} ${day}/${month}`);
                comparison.normal.push(normal_day);
                comparison.fv12.push(fv12_day);
                comparison.fabbisogno.push(fabbisogno_day);

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
        // Vista mensile - AGGREGA PER SETTIMANA
        else if (month) {
            console.log('Vista MENSILE FV - Aggregazione settimanale');
            const monthStr = month.toString().padStart(2, '0');
            const days = Object.keys(bothVersions.normal[year][monthStr]).sort((a, b) => parseInt(a) - parseInt(b));

            // Raggruppa giorni per settimana
            const weekGroups = {};
            const weekLabels = ['SET 1', 'SET 2', 'SET 3', 'SET 4', 'SET 5'];
            let weekIndex = 0;

            days.forEach(day => {
                const date = new Date(year, parseInt(month) - 1, parseInt(day));
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay()); // Domenica
                const weekKey = weekStart.toISOString().split('T')[0];

                if (!weekGroups[weekKey]) {
                    const weekLabel = weekLabels[weekIndex] || `SET ${weekIndex + 1}`;
                    weekGroups[weekKey] = {
                        label: weekLabel,
                        normal: 0,
                        fv12: 0,
                        fabbisogno: 0,
                        weekIndex: weekIndex
                    };
                    weekIndex++;
                }

                const normalDayData = bothVersions.normal[year][monthStr][day];
                const fv12DayData = bothVersions.fv12[year]?.[monthStr]?.[day];

                if (!normalDayData || !fv12DayData) {
                    console.warn(`⚠️ Dati mancanti per ${year}/${monthStr}/${day}`);
                    return;
                }

                // Verifica reference check
                if (normalDayData === fv12DayData) {
                    console.error(`⚠️ ERRORE: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}!`);
                    return;
                }

                const hours = Object.keys(normalDayData).sort((a, b) => parseInt(a) - parseInt(b));

                hours.forEach(hour => {
                    // Dati Normal
                    const normalData = normalDayData[hour];
                    const fv12Data = fv12DayData[hour];

                    if (!normalData || !fv12Data) {
                        console.warn(`⚠️ Dati mancanti per ${year}/${monthStr}/${day}/${hour}`);
                        return;
                    }

                    // Verifica reference check
                    if (normalData === fv12Data) {
                        console.error(`⚠️ ERRORE: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}/${hour}!`);
                        return;
                    }

                    const normal_produzione = (normalData.ee_prod_coge_kwh || 0) + (normalData.ee_prod_altro_kwh || 0);
                    const fv12_produzione = (fv12Data.ee_prod_coge_kwh || 0) + (fv12Data.ee_prod_altro_kwh || 0);

                    // Dati fabbisogno
                    const elaborazione = this.loader.getMonthData(year, month);
                    const elaborazioneHour = elaborazione?.elaborazione?.[day]?.[hour] || {};
                    const fabbisogno = elaborazioneHour.fabbisogno_ee_azienda_kwh || 0;

                    weekGroups[weekKey].normal += normal_produzione;
                    weekGroups[weekKey].fv12 += fv12_produzione;
                    weekGroups[weekKey].fabbisogno += fabbisogno;
                });
            });

            // Aggiungi dati raggruppati ordinati per settimana
            Object.values(weekGroups)
                .sort((a, b) => a.weekIndex - b.weekIndex)
                .forEach(group => {
                    comparison.labels.push(group.label);
                    comparison.normal.push(group.normal);
                    comparison.fv12.push(group.fv12);
                    comparison.fabbisogno.push(group.fabbisogno);
                });
        }
        // Vista annuale
        else {
            console.log('Vista ANNUALE FV');
            const months = Object.keys(bothVersions.normal[year]).sort((a, b) => parseInt(a) - parseInt(b));

            months.forEach(monthStr => {
                const monthNum = parseInt(monthStr);
                const monthLabel = this.config.labels.mesi[monthNum - 1];
                comparison.labels.push(`${monthLabel} ${year}`);

                // Verifica che i dati esistano per entrambe le versioni
                const normalMonthData = bothVersions.normal[year]?.[monthStr];
                const fv12MonthData = bothVersions.fv12[year]?.[monthStr];

                if (!normalMonthData) {
                    console.error(`⚠️ ERRORE: Dati Normal mancanti per ${year}/${monthStr}`);
                    comparison.normal.push(0);
                    comparison.fv12.push(0);
                    comparison.fabbisogno.push(0);
                    return;
                }

                if (!fv12MonthData) {
                    console.error(`⚠️ ERRORE: Dati FV12 mancanti per ${year}/${monthStr}`);
                    comparison.normal.push(0);
                    comparison.fv12.push(0);
                    comparison.fabbisogno.push(0);
                    return;
                }

                // Verifica reference check a livello di mese
                if (normalMonthData === fv12MonthData) {
                    console.error(`⚠️ ERRORE CRITICO: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}!`);
                    comparison.normal.push(0);
                    comparison.fv12.push(0);
                    comparison.fabbisogno.push(0);
                    return;
                }

                // Aggrega tutti i giorni del mese
                const days = Object.keys(normalMonthData || {});
                let normal_month = 0;
                let fv12_month = 0;
                let fabbisogno_month = 0;

                if (days.length === 0) {
                    console.warn(`⚠️ Nessun dato disponibile per mese ${monthStr} anno ${year}`);
                }

                days.forEach(day => {
                    // Verifica che i dati esistano per entrambe le versioni
                    const normalDayData = normalMonthData[day];
                    const fv12DayData = fv12MonthData[day];

                    if (!normalDayData) {
                        console.warn(`⚠️ Dati Normal mancanti per ${year}/${monthStr}/${day}`);
                        return;
                    }

                    if (!fv12DayData) {
                        console.warn(`⚠️ Dati FV12 mancanti per ${year}/${monthStr}/${day}`);
                        return;
                    }

                    // Verifica che non siano gli stessi oggetti (reference check)
                    if (normalDayData === fv12DayData) {
                        console.error(`⚠️ ERRORE CRITICO: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}!`);
                        console.error(`   normalMonthData[${day}]:`, normalMonthData[day]);
                        console.error(`   fv12MonthData[${day}]:`, fv12MonthData[day]);
                        console.error(`   normalMonthData === fv12MonthData:`, normalMonthData === fv12MonthData);
                        return;
                    }

                    // DEBUG: Verifica anche per la prima ora del primo giorno
                    if (parseInt(day) <= 2) {
                        const firstHour = Object.keys(normalDayData)[0];
                        if (firstHour) {
                            const nd = normalDayData[firstHour];
                            const fd = fv12DayData[firstHour];
                            if (nd === fd) {
                                console.error(`⚠️ ERRORE: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}/${firstHour}!`);
                            }
                        }
                    }

                    const hours = Object.keys(normalDayData);
                    hours.forEach(hour => {
                        const normalData = normalDayData[hour];
                        const fv12Data = fv12DayData[hour];

                        if (!normalData || !fv12Data) {
                            console.warn(`⚠️ Dati mancanti per ${year}/${monthStr}/${day}/${hour}`);
                            return;
                        }

                        // Verifica reference check anche a livello di ora
                        if (normalData === fv12Data) {
                            console.error(`⚠️ ERRORE: Dati Normal e FV12 sono lo stesso oggetto per ${year}/${monthStr}/${day}/${hour}!`);
                            return;
                        }

                        const normal_coge = normalData.ee_prod_coge_kwh || 0;
                        const normal_fv = normalData.ee_prod_altro_kwh || 0;
                        const normal_produzione = normal_coge + normal_fv;

                        const fv12_coge = fv12Data.ee_prod_coge_kwh || 0;
                        const fv12_fv = fv12Data.ee_prod_altro_kwh || 0;
                        const fv12_produzione = fv12_coge + fv12_fv;

                        // NOTE: log di debug rimossi per mantenere la console pulita

                        const elaborazione = this.loader.getMonthData(year, monthStr);
                        const elaborazioneHour = elaborazione?.elaborazione?.[day]?.[hour] || {};
                        const fabbisogno = elaborazioneHour.fabbisogno_ee_azienda_kwh || 0;

                        normal_month += normal_produzione;
                        fv12_month += fv12_produzione;
                        fabbisogno_month += fabbisogno;
                    });
                });

                // Silenziato logging di debug sui totali per evitare rumore in console

                comparison.normal.push(normal_month);
                comparison.fv12.push(fv12_month);
                comparison.fabbisogno.push(fabbisogno_month);
            });
        }

        // DEBUG: Verifica finale che i dati siano diversi
        const totalNormal = comparison.normal.reduce((a, b) => a + b, 0);
        const totalFV12 = comparison.fv12.reduce((a, b) => a + b, 0);
        // Log finale rimosso per tenere la console pulita

        return comparison;
    }

    /**
     * Aggrega FV comparison per tutti gli anni (aggregazione mensile)
     */
    async aggregateFVComparisonBarsAllYears() {
        const bothVersions = this.loader.bothVersions;

        if (!bothVersions || !bothVersions.normal || !bothVersions.fv12) {
            console.error('Dati confronto FV non ancora caricati!');
            throw new Error('Dati confronto FV non disponibili');
        }

        const comparison = {
            labels: [],
            normal: [],
            fv12: [],
            fabbisogno: []
        };

        const years = Object.keys(bothVersions.normal || {}).sort();

        years.forEach(year => {
            if (!bothVersions.fv12[year]) {
                return;
            }
            const months = Object.keys(bothVersions.normal[year] || {})
                .filter((m) => bothVersions.fv12[year][m])
                .sort((a, b) => parseInt(a) - parseInt(b));

            months.forEach(monthStr => {
                const monthNum = parseInt(monthStr);
                const monthLabel = this.config.labels.mesi[monthNum - 1];
                comparison.labels.push(`${monthLabel} ${year}`);

                // Aggrega mese
                const days = Object.keys(bothVersions.normal[year]?.[monthStr] || {})
                    .filter((d) => bothVersions.fv12[year]?.[monthStr]?.[d]);
                let normal_month = 0;
                let fv12_month = 0;
                let fabbisogno_month = 0;

                days.forEach(day => {
                    const hours = Object.keys(bothVersions.normal[year]?.[monthStr]?.[day] || {})
                        .filter((h) => bothVersions.fv12[year]?.[monthStr]?.[day]?.[h]);
                    hours.forEach(hour => {
                        const normalData = bothVersions.normal[year]?.[monthStr]?.[day]?.[hour];
                        const fv12Data = bothVersions.fv12[year]?.[monthStr]?.[day]?.[hour];
                        if (!normalData || !fv12Data) {
                            return;
                        }
                        const normal_produzione = (normalData.ee_prod_coge_kwh || 0) + (normalData.ee_prod_altro_kwh || 0);
                        const fv12_produzione = (fv12Data.ee_prod_coge_kwh || 0) + (fv12Data.ee_prod_altro_kwh || 0);

                        const elaborazione = this.loader.getMonthData(year, monthStr);
                        const elaborazioneHour = elaborazione?.elaborazione?.[day]?.[hour] || {};
                        const fabbisogno = elaborazioneHour.fabbisogno_ee_azienda_kwh || 0;

                        normal_month += normal_produzione;
                        fv12_month += fv12_produzione;
                        fabbisogno_month += fabbisogno;
                    });
                });

                comparison.normal.push(normal_month);
                comparison.fv12.push(fv12_month);
                comparison.fabbisogno.push(fabbisogno_month);
            });
        });

        return comparison;
    }

    /**
     * Aggiunge dati orari al confronto Normal vs FV12
     * DEPRECATO: Usa aggregateFVComparisonBars() invece
     */
    addFVComparisonBarData(comparison, year, month, day, hour, monthData) {
        const consumiHour = monthData.consumi[day][hour];
        const elaborazioneHour = monthData.elaborazione[day]?.[hour] || {};

        const fabbisogno = elaborazioneHour.fabbisogno_ee_azienda_kwh || 0;
        const ee_coge = consumiHour.ee_prod_coge_kwh || 0;
        const ee_fv = consumiHour.ee_prod_altro_kwh || 0;

        // Produzione totale (Normal se toggle OFF, FV12 se toggle ON)
        const produzione = ee_coge + ee_fv;

        // Per un confronto reale, dovremmo avere entrambi i valori
        // Per ora mostriamo lo stesso valore due volte (placeholders)
        comparison.fabbisogno.push(fabbisogno);
        comparison.normal.push(produzione); // TODO: Caricare da normal
        comparison.fv12.push(produzione); // TODO: Caricare da fv12
    }

    /**
     * Aggrega dati comparazione fotovoltaico ottimizzato
     * NUOVO DESIGN: Confronta produzione energia Normal vs FV12
     * Carica entrambi i dataset per mostrare la differenza reale
     */
    async aggregateFVOptimizationComparison(year, month = null, week = null) {
        // Riutilizza l'aggregazione Normal vs FV12 (che integra già il toggle 350 kW)
        const baseComparison = await this.aggregateFVComparisonBars(year, month, week);
        return this.buildFVOptimizationScenario(baseComparison);
    }

    /**
     * Aggiunge dati orari alla comparazione FV
     * NUOVO DESIGN: Confronta produzione Normal vs FV12
     * 
     * IMPORTANTE: Per fare un confronto reale, dobbiamo caricare i dati
     * da entrambe le versioni (normal e fv12) contemporaneamente.
     * Il DataLoader attuale carica solo una versione alla volta.
     * 
     * Soluzione: modifichiamo questo metodo per accettare un parametro
     * che indica quale dataset usare, o meglio ancora, carichiamo
     * entrambi i dataset separatamente.
     */
    addFVComparisonHourData(comparison, year, month, day, hour, monthData) {
        const consumiHour = monthData.consumi[day][hour];
        const elaborazioneHour = monthData.elaborazione[day]?.[hour] || {};

        // Dati base
        const fabbisogno = elaborazioneHour.fabbisogno_ee_azienda_kwh || 0;
        const ee_coge = consumiHour.ee_prod_coge_kwh || 0;
        const ee_fv = consumiHour.ee_prod_altro_kwh || 0;

        // Produzione totale attuale (può essere Normal o FV12 in base al toggle)
        const produzione = ee_coge + ee_fv;

        // NOTA: Per un confronto corretto Normal vs FV12, bisognerebbe caricare
        // i dati da ENTRAMBE le versioni. Per ora mostriamo i dati caricati.
        // TODO: Implementare caricamento parallelo di entrambi i dataset

        comparison.scenario_no_autoprod.push(fabbisogno); // Fabbisogno totale
        comparison.scenario_attuale_autoprod.push(produzione); // Produzione attuale
        comparison.scenario_attuale_acquisto.push(Math.max(0, fabbisogno - produzione)); // Residuo acquisto
        comparison.scenario_opt_autoprod.push(produzione); // Temporaneamente uguale
        comparison.scenario_opt_acquisto.push(Math.max(0, fabbisogno - produzione)); // Temporaneamente uguale
    }

    /**
     * Aggrega dati FV per visualizzazione più chiara
     * @param {Object} fvData - Dati FV grezzi (orari)
     * @param {string} aggregationType - 'daily', '6h', 'hourly'
     */
    aggregateFVData(fvData, aggregationType) {
        if (aggregationType === 'hourly' || fvData.labels.length <= 24) {
            // Se ci sono poche ore o vogliamo vista oraria, restituisci dati originali
            return fvData;
        }

        const aggregated = {
            labels: [],
            scenario_no_autoprod: [],
            scenario_attuale_autoprod: [],
            scenario_attuale_acquisto: [],
            scenario_opt_autoprod: [],
            scenario_opt_acquisto: []
        };

        if (aggregationType === 'daily') {
            // Raggruppa per giorno
            let currentDay = null;
            let dayData = {
                no_autoprod: 0,
                attuale_autoprod: 0, attuale_acquisto: 0,
                opt_autoprod: 0, opt_acquisto: 0,
                count: 0
            };

            fvData.labels.forEach((label, i) => {
                // Estrae il giorno dalla label (es. "Lun 01/01 10:00" -> "Lun 01/01")
                const dayPart = label.split(' ').slice(0, 2).join(' ');

                if (currentDay === null) {
                    currentDay = dayPart;
                }

                if (dayPart !== currentDay) {
                    // Nuovo giorno - aggiungi media del giorno precedente
                    aggregated.labels.push(currentDay);
                    aggregated.scenario_no_autoprod.push(dayData.no_autoprod / dayData.count);
                    aggregated.scenario_attuale_autoprod.push(dayData.attuale_autoprod / dayData.count);
                    aggregated.scenario_attuale_acquisto.push(dayData.attuale_acquisto / dayData.count);
                    aggregated.scenario_opt_autoprod.push(dayData.opt_autoprod / dayData.count);
                    aggregated.scenario_opt_acquisto.push(dayData.opt_acquisto / dayData.count);

                    // Reset per nuovo giorno
                    currentDay = dayPart;
                    dayData = {
                        no_autoprod: 0,
                        attuale_autoprod: 0, attuale_acquisto: 0,
                        opt_autoprod: 0, opt_acquisto: 0,
                        count: 0
                    };
                }

                // Accumula dati
                dayData.no_autoprod += fvData.scenario_no_autoprod[i];
                dayData.attuale_autoprod += fvData.scenario_attuale_autoprod[i];
                dayData.attuale_acquisto += fvData.scenario_attuale_acquisto[i];
                dayData.opt_autoprod += fvData.scenario_opt_autoprod[i];
                dayData.opt_acquisto += fvData.scenario_opt_acquisto[i];
                dayData.count++;
            });

            // Aggiungi l'ultimo giorno
            if (dayData.count > 0) {
                aggregated.labels.push(currentDay);
                aggregated.scenario_no_autoprod.push(dayData.no_autoprod / dayData.count);
                aggregated.scenario_attuale_autoprod.push(dayData.attuale_autoprod / dayData.count);
                aggregated.scenario_attuale_acquisto.push(dayData.attuale_acquisto / dayData.count);
                aggregated.scenario_opt_autoprod.push(dayData.opt_autoprod / dayData.count);
                aggregated.scenario_opt_acquisto.push(dayData.opt_acquisto / dayData.count);
            }

        } else if (aggregationType === '6h') {
            // Raggruppa ogni 6 ore (4 fasce al giorno: 0-5, 6-11, 12-17, 18-23)
            let currentPeriod = null;
            let periodData = {
                no_autoprod: 0,
                attuale_autoprod: 0, attuale_acquisto: 0,
                opt_autoprod: 0, opt_acquisto: 0,
                count: 0
            };

            fvData.labels.forEach((label, i) => {
                // Estrae ora dalla label (es. "Lun 01/01 10:00" -> 10)
                const parts = label.split(' ');
                const hourStr = parts[2].split(':')[0];
                const hour = parseInt(hourStr);
                const dayPart = parts.slice(0, 2).join(' ');

                // Determina fascia oraria (0-5, 6-11, 12-17, 18-23)
                let timeSlot;
                if (hour >= 0 && hour < 6) timeSlot = '00-06';
                else if (hour >= 6 && hour < 12) timeSlot = '06-12';
                else if (hour >= 12 && hour < 18) timeSlot = '12-18';
                else timeSlot = '18-24';

                const periodKey = `${dayPart} ${timeSlot}`;

                if (currentPeriod === null) {
                    currentPeriod = periodKey;
                }

                if (periodKey !== currentPeriod) {
                    // Nuovo periodo - aggiungi media del periodo precedente
                    aggregated.labels.push(currentPeriod);
                    aggregated.scenario_no_autoprod.push(periodData.no_autoprod / periodData.count);
                    aggregated.scenario_attuale_autoprod.push(periodData.attuale_autoprod / periodData.count);
                    aggregated.scenario_attuale_acquisto.push(periodData.attuale_acquisto / periodData.count);
                    aggregated.scenario_opt_autoprod.push(periodData.opt_autoprod / periodData.count);
                    aggregated.scenario_opt_acquisto.push(periodData.opt_acquisto / periodData.count);

                    // Reset per nuovo periodo
                    currentPeriod = periodKey;
                    periodData = {
                        no_autoprod: 0,
                        attuale_autoprod: 0, attuale_acquisto: 0,
                        opt_autoprod: 0, opt_acquisto: 0,
                        count: 0
                    };
                }

                // Accumula dati
                periodData.no_autoprod += fvData.scenario_no_autoprod[i];
                periodData.attuale_autoprod += fvData.scenario_attuale_autoprod[i];
                periodData.attuale_acquisto += fvData.scenario_attuale_acquisto[i];
                periodData.opt_autoprod += fvData.scenario_opt_autoprod[i];
                periodData.opt_acquisto += fvData.scenario_opt_acquisto[i];
                periodData.count++;
            });

            // Aggiungi l'ultimo periodo
            if (periodData.count > 0) {
                aggregated.labels.push(currentPeriod);
                aggregated.scenario_no_autoprod.push(periodData.no_autoprod / periodData.count);
                aggregated.scenario_attuale_autoprod.push(periodData.attuale_autoprod / periodData.count);
                aggregated.scenario_attuale_acquisto.push(periodData.attuale_acquisto / periodData.count);
                aggregated.scenario_opt_autoprod.push(periodData.opt_autoprod / periodData.count);
                aggregated.scenario_opt_acquisto.push(periodData.opt_acquisto / periodData.count);
            }
        }

        return aggregated;
    }

    /**
     * Calcola analisi economica
     */
    calculateEconomics(year, month = null) {
        const kpis = this.calculateKPIs(year, month);
        const pci = this.config.caldaia.pci_gas_kwh_smc;

        // Costi energia acquistata (€)
        const costo_ee_acquistata = (kpis.ee_acquistata * kpis.prezzo_medio_ee) / 1000;

        // Costi gas (€)
        const costo_gas_totale = (kpis.gas_totale * pci * kpis.prezzo_medio_gas) / 1000;
        const costo_gas_coge = (kpis.gas_coge * pci * kpis.prezzo_medio_gas) / 1000;
        const costo_gas_caldaie = (kpis.gas_caldaie * pci * kpis.prezzo_medio_gas) / 1000;

        // Costi manutenzione cogeneratore (€)
        const costo_manutenzione = kpis.ore_funz_coge * this.config.cogeneratore.costo_manutenzione_eur_h;

        // Costo totale reale
        const costo_totale = costo_ee_acquistata + costo_gas_totale + costo_manutenzione;

        // Scenario ipotetico: tutto acquistato dalla rete (senza autoproduzione)
        const costo_scenario_rete = (kpis.fabbisogno_ee * kpis.prezzo_medio_ee) / 1000;

        // RISPARMIO NETTO TOTALE: differenza tra scenario rete e scenario reale
        const risparmio_netto = costo_scenario_rete - costo_totale;

        // Risparmio da autoproduzione (solo mancato acquisto EE, non considera costi produzione)
        const risparmio_autoproduzione = ((kpis.ee_autoprodotta) * kpis.prezzo_medio_ee) / 1000;

        // Risparmio netto cogeneratore (considerando costi gas e manutenzione)
        const costo_ee_equivalente_coge = (kpis.ee_coge * kpis.prezzo_medio_ee) / 1000;
        const risparmio_coge = costo_ee_equivalente_coge - costo_gas_coge - costo_manutenzione;

        return {
            costo_ee_acquistata,
            costo_gas_totale,
            costo_gas_coge,
            costo_gas_caldaie,
            costo_manutenzione,
            costo_totale,
            costo_scenario_rete,
            risparmio_netto,
            risparmio_autoproduzione,
            risparmio_coge,
            costo_medio_kwh: costo_totale / kpis.fabbisogno_ee
        };
    }

    /**
     * Calcola analisi economica per tutti gli anni disponibili
     */
    calculateAllYearsEconomics() {
        const kpis = this.calculateAllYearsKPIs();
        const pci = this.config.caldaia.pci_gas_kwh_smc;

        // Costi energia acquistata (€)
        const costo_ee_acquistata = (kpis.ee_acquistata * kpis.prezzo_medio_ee) / 1000;

        // Costi gas (€)
        const costo_gas_totale = (kpis.gas_totale * pci * kpis.prezzo_medio_gas) / 1000;
        const costo_gas_coge = (kpis.gas_coge * pci * kpis.prezzo_medio_gas) / 1000;
        const costo_gas_caldaie = (kpis.gas_caldaie * pci * kpis.prezzo_medio_gas) / 1000;

        // Costi manutenzione cogeneratore (€)
        const costo_manutenzione = kpis.ore_funz_coge * this.config.cogeneratore.costo_manutenzione_eur_h;

        // Costo totale reale
        const costo_totale = costo_ee_acquistata + costo_gas_totale + costo_manutenzione;

        // Scenario ipotetico: tutto acquistato dalla rete (senza autoproduzione)
        const costo_scenario_rete = (kpis.fabbisogno_ee * kpis.prezzo_medio_ee) / 1000;

        // RISPARMIO NETTO TOTALE: differenza tra scenario rete e scenario reale
        const risparmio_netto = costo_scenario_rete - costo_totale;

        // Risparmio da autoproduzione (solo mancato acquisto EE, non considera costi produzione)
        const risparmio_autoproduzione = ((kpis.ee_autoprodotta) * kpis.prezzo_medio_ee) / 1000;

        // Risparmio netto cogeneratore (considerando costi gas e manutenzione)
        const costo_ee_equivalente_coge = (kpis.ee_coge * kpis.prezzo_medio_ee) / 1000;
        const risparmio_coge = costo_ee_equivalente_coge - costo_gas_coge - costo_manutenzione;

        return {
            costo_ee_acquistata,
            costo_gas_totale,
            costo_gas_coge,
            costo_gas_caldaie,
            costo_manutenzione,
            costo_totale,
            costo_scenario_rete,
            risparmio_netto,
            risparmio_autoproduzione,
            risparmio_coge,
            costo_medio_kwh: costo_totale / kpis.fabbisogno_ee
        };
    }

    /**
     * Aggrega dati comparazione fotovoltaico ottimizzato per tutti gli anni
     */
    async aggregateAllYearsFVOptimizationComparison() {
        const baseComparison = await this.aggregateFVComparisonBarsAllYears();
        if (!baseComparison) return null;
        return this.buildFVOptimizationScenario(baseComparison);
    }

    /**
     * Converte il confronto Normal vs FV12 in scenari di autoproduzione/acquisto
     */
    buildFVOptimizationScenario(baseComparison) {
        if (!baseComparison) return null;

        const scenario = {
            labels: baseComparison.labels || [],
            scenario_no_autoprod: [],
            scenario_attuale_autoprod: [],
            scenario_attuale_acquisto: [],
            scenario_opt_autoprod: [],
            scenario_opt_acquisto: []
        };

        scenario.labels.forEach((_, idx) => {
            const fabbisogno = baseComparison.fabbisogno?.[idx] || 0;
            const normalProd = baseComparison.normal?.[idx] || 0;
            const fvProd = baseComparison.fv12?.[idx] || 0;

            scenario.scenario_no_autoprod.push(fabbisogno);
            scenario.scenario_attuale_autoprod.push(normalProd);
            scenario.scenario_attuale_acquisto.push(Math.max(0, fabbisogno - normalProd));
            scenario.scenario_opt_autoprod.push(fvProd);
            scenario.scenario_opt_acquisto.push(Math.max(0, fabbisogno - fvProd));
        });

        return scenario;
    }
}

// Istanza globale del processor
let dataProcessor = null;
let thermalDataProcessor = null;

// Inizializza il processor quando i dati sono caricati
function initDataProcessor() {
    dataProcessor = new DataProcessor(dataLoader, CONFIG);
}

// Inizializza il processor per i dati V4 (usato per grafici selezionati)
function initThermalDataProcessor() {
    thermalDataProcessor = new DataProcessor(dataLoaderV4, CONFIG);
}
