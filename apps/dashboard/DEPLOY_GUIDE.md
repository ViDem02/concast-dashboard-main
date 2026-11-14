# Guida al Deploy su Firebase Hosting

## 📋 Prerequisiti

Il tuo sito è già pronto per il deploy! È un'applicazione web statica perfettamente compatibile con Firebase Hosting.

## 🚀 Passi per il Deployment

### 1. Installa Firebase CLI

Apri il terminale ed esegui:

```bash
npm install -g firebase-tools
```

Se non hai npm installato, scaricalo da [nodejs.org](https://nodejs.org/)

### 2. Accedi a Firebase

```bash
firebase login
```

Questo aprirà il browser per autenticarti con il tuo account Google.

### 3. Crea un Progetto Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Clicca su "Aggiungi progetto" o "Add project"
3. Dai un nome al progetto (es. "concast-dashboard")
4. Segui la procedura guidata
5. Seleziona il piano **Spark (gratuito)**

### 4. Inizializza Firebase nel Progetto

Dalla directory `apps/dashboard`, esegui:

```bash
cd /Users/carlozamuner/Documents/GitHub/concast-dashboard/apps/dashboard
firebase init hosting
```

Quando ti chiede:
- **"Please select an option"**: Scegli "Use an existing project"
- **"Select a default Firebase project"**: Scegli il progetto creato al passo 3
- **"What do you want to use as your public directory?"**: Premi INVIO (usa ".")
- **"Configure as a single-page app?"**: Rispondi "No"
- **"Set up automatic builds?"**: Rispondi "No"
- **"File . already exists. Overwrite?"**: Rispondi "No" per tutti i file

### 5. Deploy del Sito

```bash
firebase deploy
```

Al termine, vedrai un URL del tipo: `https://concast-dashboard.web.app`

Il tuo sito sarà **LIVE e accessibile da qualsiasi parte del mondo!** 🌍

## 🔄 Aggiornamenti Futuri

Per pubblicare nuove modifiche:

```bash
cd /Users/carlozamuner/Documents/GitHub/concast-dashboard/apps/dashboard
firebase deploy
```

## 📊 Monitoraggio

Puoi monitorare l'utilizzo nella [Console Firebase](https://console.firebase.google.com):
- Traffico mensile (max 10 GB gratis)
- Storage utilizzato (max 10 GB gratis)
- Performance del sito

## 🌐 Dominio Personalizzato (Opzionale)

Se hai un dominio tuo, puoi collegarlo gratuitamente:

1. Vai su Console Firebase > Hosting
2. Clicca su "Add custom domain"
3. Segui le istruzioni per configurare i record DNS

Firebase fornirà automaticamente il certificato SSL!

## ⚡ Vantaggi di Firebase Hosting

- ✅ **Gratuito**: 10 GB storage + 10 GB bandwidth/mese
- ✅ **CDN Globale**: Sito veloce in tutto il mondo
- ✅ **SSL Automatico**: HTTPS configurato automaticamente
- ✅ **Deploy Instantaneo**: Aggiornamenti in pochi secondi
- ✅ **Rollback**: Puoi tornare a versioni precedenti
- ✅ **Preview**: Puoi creare URL temporanei per testare

## 🆘 Comandi Utili

```bash
# Testare localmente prima del deploy
firebase serve

# Vedere la cronologia dei deploy
firebase hosting:channel:list

# Rollback a una versione precedente
# (vai su Console Firebase > Hosting > Release history)
```

## 📝 Note

- I file di test (`test_*.js`, `test_*.html`) non verranno pubblicati
- I dati JSON sono inclusi e accessibili
- Il sito supporta tutte le funzionalità JavaScript/CSS già implementate

## 💡 Troubleshooting

**Problema**: "Error: Failed to get Firebase project"
**Soluzione**: Verifica di aver eseguito `firebase login` e di aver selezionato il progetto corretto

**Problema**: "Permission denied"
**Soluzione**: Esegui `sudo npm install -g firebase-tools` su Mac/Linux

**Problema**: File non trovati dopo il deploy
**Soluzione**: Verifica che i percorsi nel codice siano relativi (es. `./data/...`) non assoluti

## 🎯 Quick Start (Comandi Rapidi)

```bash
# 1. Installa Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Vai nella directory del progetto
cd /Users/carlozamuner/Documents/GitHub/concast-dashboard/apps/dashboard

# 4. Deploy!
firebase deploy
```

---

**Nota Importante**: Il progetto è già configurato con i file `firebase.json` e `.firebaserc`. 
Devi solo creare il progetto su Firebase Console e fare il deploy!
