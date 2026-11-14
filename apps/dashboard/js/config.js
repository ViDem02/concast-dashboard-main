// Configurazione impianti - Dati statici tecnici
const CONFIG = {
    // Cogeneratore
    cogeneratore: {
        potenza_max_kw: 400,
        potenza_min_kw: 200,
        potenza_max_vap_kw: 0,
        autoconsumo_perc: 100,
        efficienza_elettrica_perc: 39.9,
        efficienza_termica_perc: 47.3,
        efficienza_assorbimento_perc: 75.0,
        costo_manutenzione_eur_h: 11.00,
        costo_torre_eur_h: 0.00
    },
    
    // Caldaia
    caldaia: {
        efficienza_perc: 92,
        pci_gas_kwh_smc: 11.11,
        pcs_gas_kwh_smc: 10.06
    },
    
    // Chillers
    chillers: {
        eer: 4.00,
        efficienza_caldaia_perc: 92
    },
    
    // Titoli Efficienza Energetica
    tee: {
        valore_eur: 0,
        k_tee: 1.40
    },
    
    // Efficienza vapore caldaia
    efficienza_vapore: {
        kwh_smc: 4000,
        bar: 13
    },
    
    // Colori per i grafici
    colors: {
        // Prezzi
        pun: '#2563eb',           // blu
        prezzo_ee: '#f59e0b',     // arancione
        prezzo_gas: '#10b981',    // verde
        
        // Energia elettrica
        ee_coge: '#3b82f6',       // blu
        ee_fv: '#fbbf24',         // giallo
        ee_acquisto: '#ef4444',   // rosso
        ee_fabbisogno: '#1f2937', // grigio scuro
        
        // Termico
        ac_coge: '#3b82f6',       // blu
        ac_caldaie: '#f97316',    // arancione
        ac_fabbisogno: '#1f2937', // grigio scuro
        
        // Efficienza
        efficienza_ok: '#10b981',     // verde
        efficienza_warning: '#f59e0b', // arancione
        efficienza_error: '#ef4444'    // rosso
    },
    
    // Labels italiani
    labels: {
        mesi: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
        mesi_full: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
    },
    
    // Unità di misura
    units: {
        energia: 'kWh',
        potenza: 'kW',
        gas: 'Smc',
        prezzo_energia: '€/MWh',
        prezzo_gas: '€/Smc',
        efficienza: '%',
        costo: '€'
    }
};

// Export per uso nei moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
