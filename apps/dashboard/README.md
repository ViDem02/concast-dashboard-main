# Dashboard Energia - Analisi Consumi 2024

Dashboard web statica per l'analisi e visualizzazione dei consumi energetici di un impianto produttivo con cogeneratore, fotovoltaico e caldaie.

## 🎯 Caratteristiche

- **Visualizzazione dati 2024** con granularità mensile e oraria
- **Grafici interattivi** realizzati con Canvas HTML5 (no librerie esterne)
- **Analisi prezzi** mercato energia elettrica e gas
- **Monitoraggio fabbisogni** elettrici e termici
- **Analisi efficienza** impianti vs valori nominali
- **Calcolo automatico** KPI e metriche economiche
- **Responsive design** ottimizzato per desktop e mobile

## 📊 Sezioni Dashboard

### 1. KPI Cards
- Consumo totale energia elettrica
- Autoproduzione (Cogeneratore + Fotovoltaico)
- Percentuale autosufficienza
- Costo totale periodo
- Risparmio da autoproduzione

### 2. Prezzi & Mercati
Grafico a linee che mostra l'andamento di:
- PUN (Prezzo Unico Nazionale)
- Prezzo acquisto energia elettrica
- Prezzo acquisto gas

### 3. Fabbisogni & Produzione Elettrica
Grafico ad area stacked che visualizza:
- Copertura da cogeneratore
- Copertura da fotovoltaico
- Acquisti dalla rete
- Linea fabbisogno totale (riferimento)

### 4. Fabbisogni & Produzione Termica
Grafico a barre stacked che mostra:
- Produzione acqua calda da cogeneratore
- Produzione acqua calda da caldaie
- Linea fabbisogno totale (riferimento)

### 5. Efficienza Impianti
Confronto efficienza effettiva vs nominale:
- Efficienza elettrica cogeneratore (39.9% nominale)
- Efficienza termica cogeneratore (47.3% nominale)
- Efficienza totale cogeneratore (87.2% nominale)
- Ore funzionamento equivalenti
- Fattore di carico medio

### 6. Analisi Economica
Breakdown dettagliato dei costi:
- Costo energia elettrica acquistata
- Costo gas (cogeneratore e caldaie)
- Costo manutenzione cogeneratore
- Risparmio da autoproduzione
- Costo medio per kWh

## 🚀 Come Usare

### Requisiti
- Browser moderno (Chrome, Firefox, Safari, Edge)
- Server web locale o hosting statico

### Installazione Locale

1. **Aprire con server locale:**
   ```bash
   # Opzione 1: Python
   cd apps/dashboard
   python3 -m http.server 8000
   
   # Opzione 2: Node.js
   cd apps/dashboard
   npx http-server . -p 8000
   
   # Opzione 3: PHP
   php -S localhost:8000 -t apps/dashboard
   ```

2. **Aprire nel browser:**
   ```
   http://localhost:8000
   ```

### Note Importanti
⚠️ Non aprire `index.html` direttamente dal file system (file://) - i browser bloccano il caricamento di file JSON per motivi di sicurezza. Usa sempre un server web locale.

## 🎨 Funzionalità

### Filtro Temporale
- **Vista Annuale**: Seleziona "Tutti i mesi" per vedere aggregazione mensile dell'intero anno
- **Vista Mensile**: Seleziona un mese specifico per vedere dati orari di quel mese
- **Profilo cogeneratore 350 kW**: attiva l'apposita spunta per usare i dati dei file `normal`/`fv12` con limite 350 kW

### Interattività
- Grafici ridimensionabili automaticamente
- KPI aggiornati in tempo reale
- Colori dinamici per indicatori efficienza
- Responsive su dispositivi mobili

## 📁 Struttura File

```
apps/dashboard/
├── index.html              # Pagina principale
├── css/
│   ├── main.css           # Stili layout e componenti
│   └── charts.css         # Stili grafici
├── js/
│   ├── config.js          # Configurazione e dati statici impianti
│   ├── dataLoader.js      # Caricamento file JSON
│   ├── dataProcessor.js   # Aggregazione e calcolo metriche
│   ├── charts.js          # Rendering grafici Canvas
│   └── app.js             # Controller principale
└── data/
    ├── elaborazione_consumi_estratti.json
    ├── inserimento_consumi_estratti.json
    └── inserimento_prezzi_estratti.json
```

## 🔧 Tecnologie Utilizzate

- **HTML5** - Struttura
- **CSS3** - Styling (Grid, Flexbox, Custom Properties)
- **JavaScript ES6+** - Logica applicazione
- **Canvas API** - Rendering grafici
- **Fetch API** - Caricamento dati

### Zero Dipendenze
✅ Nessuna libreria esterna richiesta
✅ Funziona offline dopo il primo caricamento
✅ Bundle leggero e performante

## 📈 Metriche Calcolate

### KPI Energetici
- Consumo totale EE/AC (kWh)
- Produzione cogeneratore (kWh)
- Produzione fotovoltaico (kWh)
- Energia acquistata dalla rete (kWh)
- % Autosufficienza energetica
- % Copertura cogeneratore su termico

### KPI Efficienza
- Efficienza elettrica effettiva (%)
- Efficienza termica effettiva (%)
- Efficienza globale (%)
- Ore funzionamento equivalenti
- Fattore di carico medio (%)

### KPI Economici
- Costo energia acquistata (€)
- Costo gas totale (€)
- Costo manutenzione (€)
- Risparmio da autoproduzione (€)
- Risparmio netto cogeneratore (€)
- Costo medio per kWh (€/kWh)

## 🎯 Dati Impianti

### Cogeneratore
- Potenza massima: 400 kW
- Potenza minima: 200 kW
- Efficienza elettrica nominale: 39.9%
- Efficienza termica nominale: 47.3%
- Costo manutenzione: 11 €/h

### Caldaie
- Efficienza nominale: 92%
- PCI gas: 11.11 kWh/Smc

### Fotovoltaico
- Produzione variabile in base a irraggiamento

## 🐛 Troubleshooting

### I grafici non si caricano
- Verifica di usare un server web locale (non file://)
- Controlla la console browser per errori
- Verifica che i file JSON siano nella cartella `data/`

### Errore "Failed to fetch"
- I file JSON devono essere accessibili via HTTP
- Controlla i permessi dei file
- Verifica che il path sia corretto

### Layout rotto su mobile
- Assicurati che il viewport meta tag sia presente
- Svuota la cache del browser
- Prova con un browser diverso

## 📝 Note Tecniche

- I dati sono caricati in modo asincrono al caricamento pagina
- Le aggregazioni mensili/annuali sono calcolate client-side
- I grafici sono ridisegnati automaticamente al resize finestra
- Formato numeri: separatore migliaia con punto (italiano)
- Formato date: italiano (gg/mm/aaaa)

## 🔜 Possibili Estensioni

- Export dati in Excel/PDF
- Confronto multi-anno
- Grafici aggiuntivi (scatter, heatmap)
- Dashboard real-time con WebSocket
- Integrazione con API esterne
- Sistema di alerting su anomalie
- Calcolo CO2 risparmiata

## 📄 Licenza

Dashboard sviluppata per analisi interna consumi energetici 2024.

---

**Ultima modifica**: Gennaio 2025  
**Versione**: 1.0.0
