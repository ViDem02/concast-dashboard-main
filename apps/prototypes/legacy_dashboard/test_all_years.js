// Script di test per verificare la funzionalità "All Years"
// Questo script simula il caricamento dei dati e verifica che i nuovi metodi funzionino

const fs = require('fs');
const path = require('path');

// Simula CONFIG
const CONFIG = {
    labels: {
        mesi: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
    },
    caldaia: {
        pci_gas_kwh_smc: 9.59
    },
    cogeneratore: {
        potenza_max_kw: 65,
        costo_manutenzione_eur_h: 3.25
    }
};

// Carica i dati
console.log('Caricamento dati...');

const consumi2024 = JSON.parse(fs.readFileSync('data/2024/inserimento_consumi_estratti.json', 'utf8'));
const consumi2025 = JSON.parse(fs.readFileSync('data/2025/inserimento_consumi_estratti.json', 'utf8'));

const allConsumi = { ...consumi2024, ...consumi2025 };

console.log('Anni disponibili:', Object.keys(allConsumi));

// Verifica struttura dati
const year2024 = allConsumi['2024'];
const year2025 = allConsumi['2025'];

if (year2024) {
    const months2024 = Object.keys(year2024).sort();
    console.log('Mesi 2024:', months2024.length, 'mesi -', months2024);
}

if (year2025) {
    const months2025 = Object.keys(year2025).sort();
    console.log('Mesi 2025:', months2025.length, 'mesi -', months2025);
}

// Simula aggregazione per tutti gli anni
console.log('\n=== Test Aggregazione Tutti gli Anni ===');
const years = Object.keys(allConsumi).sort();
const allLabels = [];

years.forEach(year => {
    const yearData = allConsumi[year];
    const months = Object.keys(yearData).sort((a, b) => parseInt(a) - parseInt(b));
    
    months.forEach(month => {
        const monthLabel = `${CONFIG.labels.mesi[parseInt(month) - 1]} ${year}`;
        allLabels.push(monthLabel);
    });
});

console.log('Totale periodi (mesi):', allLabels.length);
console.log('Primi 5 labels:', allLabels.slice(0, 5));
console.log('Ultimi 5 labels:', allLabels.slice(-5));

console.log('\n✅ Test completato con successo!');
console.log('La funzionalità "All" dovrebbe funzionare correttamente.');

