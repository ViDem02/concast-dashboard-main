# UI Design Guidelines

Versione: 1.0
Obiettivo: definire principi visivi, gerarchia e interazione per costruire interfacce web/app moderne e credibili con percezione “premium”.
Uso previsto: incolla questo file in Cursor come base stilistica del progetto.

---

## 1. Filosofia generale

### 1.1 Less is more

* Buon design = meno design.
* Mostrare solo ciò che serve all’azione principale.
* Evitare overload visivo: troppi colori, troppe label, troppi bordi.

Applicazione:

* Parti sempre dal core use case della pagina (esempio: titolo → input → bottone primario).
* Non partire da “header / hero / 6 sezioni / footer”.
* Non disegnare cose “per riempire”. Il riempimento è rumore.

### 1.2 Scansionabilità immediata

* L’utente deve capire “cosa devo fare qui” in meno di 2 secondi.
* Il layout deve essere leggibile come insieme prima dei dettagli.
* Se a colpo d’occhio non è chiaro cosa è importante, la gerarchia è sbagliata.

### 1.3 Creatività = combinazione, non invenzione

* Non serve inventare pattern nuovi da zero.
* Prendere elementi da interfacce top tier (Mobbin, Figma Community, app iOS di qualità) e combinarli in modo coerente.
* La creatività sta nel remix controllato, non nell’originalità pura.

---

## 2. Sistema visivo di base

Questo va definito prima di disegnare schermate:

1. Spaziatura
2. Tipografia
3. Colori
4. Raggi / ombre / profondità
5. Componenti base (bottoni, card, tab)

Questo è la “design system v0”. Anche minimale è sufficiente se è coerente.

### 2.1 Spaziatura

Usare una scala chiusa, multipli di 4px. Esempio:

* 4px  → 0.25rem
* 8px  → 0.5rem
* 12px → 0.75rem
* 16px → 1rem
* 20px → 1.25rem
* 24px → 1.5rem
* 32px → 2rem
* 40px → 2.5rem

Regole:

* Distanza interna tra elementi correlati: più piccola.
* Distanza tra blocchi diversi: più grande.

Procedura:

1. Parti con troppa aria.
2. Zoom out al 50%.
3. Riduci finché i pezzi correlati stanno insieme ma i blocchi restano separati.

Nota: mai progettare con lorem ipsum o dati finti. La spaziatura giusta dipende da contenuto reale.

### 2.2 Prossimità e similarità (Gestalt)

Principi:

* Elementi con stessa funzione → stesso stile (colore, peso, icona, forma).
* Elementi logicamente collegati → vicini tra loro.
* Elementi non collegati → separati.

Effetto:

* L’utente riconosce gruppi logici senza leggere tutto.
* Il layout comunica struttura da solo.

### 2.3 Tipografia

Scegli UNA famiglia sans moderna. Definisci una scala tipografica corta:

* Display / H1
* Section title / H2
* Body strong
* Body / paragraph
* Caption / meta

Regole tipografiche:

* Elemento importante: peso maggiore e/o dimensione maggiore e/o contrasto maggiore.
* Elemento secondario: colore meno contrastato e peso più leggero.
* Line-height:

  * Testo piccolo (14-16 px) → line-height alta (~1.5-1.6) per leggibilità.
  * Headline grande → line-height bassa (~1.1-1.3) per impatto.
* Evitare paragrafi centrati. Allineare a sinistra.

### 2.4 Colori

Setup minimo:

* `bg-base`      → sfondo principale (chiaro o scuro)
* `bg-surface`   → superfici sopra lo sfondo (card)
* `text-primary` → testo/valore principale
* `text-secondary` → testo descrittivo, meta
* `accent`       → CTA, highlight, stato attivo

Linee guida:

* Un singolo colore accent è sufficiente per identità.
* Evitare palette rumorose o “psicologia del colore” astratta. Serve leggibilità.
* Dark mode ≠ invertire testo bianco su sfondo nero. Serve anche ridefinire profondità (layer diversi di grigio/nero).

### 2.5 Raggi e curvature

* Raggi consistenti danno look moderno e “soft”.
* Definire 1-2 valori fissi:

  * 8px per chip / pulsanti piccoli
  * 16px-20px per card / modali / sezioni

### 2.6 Ombre e profondità

La profondità è il trucco principale per passare da “UI basica” a “UI premium”.

Concetto: la UI è fatta di piani fisici a diverse altezze.

Pattern base:

* Elevazione bassa (card cliccabile, elemento attivo):

  * Highlight chiaro in alto (anche inset shadow chiaro)
  * Ombra morbida scura in basso
* Elevazione alta (hover stato attivo / elemento critico):

  * Stessa logica, ma blur e offset più grandi
* Effetto incassato (contenitore “sotto” il piano base, tipo tabella):

  * Inset shadow scuro in alto
  * Inset highlight chiaro in basso
  * Background leggermente più scuro per simulare “pozzetto”

Regole:

* Ombra combinata chiaro+scuro è più realistica di una box-shadow generica singola.
* Più contrasto luce/ombra = sembra più vicino = più importante.

Gradienti:

* Un riempimento piatto può diventare più “materiale” con un gradiente leggero (alto più chiaro, basso più scuro).
* Aggiungere highlight chiara sottile in alto del gradiente simula luce dall’alto.

---

## 3. Gerarchia visiva

Obiettivo: l’occhio deve andare subito sul contenuto chiave.

### 3.1 Primo fuoco

Domanda da fare: cosa deve saltare all’occhio per prima?

* Titolo della sezione?
* Valore numerico?
* CTA?
* Avatar umano per fiducia (es. testimonial fintech)?

La gerarchia si ottiene enfatizzando ciò che conta e togliendo attenzione da ciò che non conta.

Leve di gerarchia:

1. Dimensione testo
2. Peso testo
3. Colore / contrasto
4. Spaziatura attorno (più aria = più importanza)
5. Elevazione / ombra / card
6. Icona o immagine

Procedura:

1. Dai lo stesso peso visivo a tutto.
2. Zoom out al 25%-50%.
3. Controlla dove cade l’occhio.
4. Se non cade sul punto giusto:

   * aumenta peso/dimensione/contrasto del target
   * abbassa contrasto degli altri
   * aumenta aria intorno al target

Nota: la gerarchia è contestuale. Non assumere che H1 > H2 > H3 sempre. A volte un numero in body è più importante di un titolo semantico.

### 3.2 Riduzione rumore

* Testo secondario con colore attenuato.
* Icone non critiche con stroke più sottile.
* Evitare bordi se la separazione è già chiara tramite differenza di layer / profondità.

### 3.3 Stati attivi e selezionati

Per tab bar / sidebar / radio card selezionata:

* Usa versione “più filled / bold” dell’icona quando attiva.
* Cambiare solo colore è livello base. Cambiare stile icona comunica stato in modo più chiaro e più premium.

---

## 4. Componenti chiave

### 4.1 Pulsanti e link

Definire almeno due varianti:

* Primario = azione principale
* Secondario = azione neutra

Linee guida:

* Primario:

  * background `accent`
  * testo alto contrasto
  * leggera elevazione (ombra morbida sotto)
* Secondario:

  * fondo trasparente o `bg-surface`
  * bordo leggero o ombra interna leggera

Stati:

* Hover / focus → più elevazione (ombra più ampia o highlight più visibile)
* Disabled → contrasto ridotto e profondità rimossa

### 4.2 Card

Uso: contenere contenuto correlato (profilo, piano pricing, testimonial).

Struttura:

* Wrapper con `bg-surface` diverso da `bg-base`
* Border-radius coerente
* Ombra piccola (highlight top + shadow bottom)
* Headline forte
* Descrizione attenuata
* CTA visibile

Hover:

* Ombra più ampia
* Leggero scale-up
* Gradiente header più evidente

### 4.3 Tab bar / Navbar / Sidebar

Pattern:

* Creare layer multipli della stessa tinta (es. 3 livelli di grigio o blu con lightness diversa)
* Barra di navigazione: fondo leggermente diverso dallo sfondo pagina → sembra “sopra”
* Contenuto sotto header può sembrare “incassato” usando inset shadow scuro in alto e highlight in basso

Stato attivo voce di navigazione:

* Riempimento più chiaro o più saturo
* Icona filled vs outline
* Testo con più contrasto

Risultato: lo stato attivo è leggibile anche senza colore.

### 4.4 Liste / Tabelle / Radio group

Obiettivo: evitare look piatto e banale.

Tecniche:

1. Wrappare il gruppo in una card leggermente diversa dal background.
2. Evidenziare l’opzione selezionata con elevazione (ombra piccola).
3. Aggiungere icona o avatar per dare umanità.
4. Curare tipografia:

   * Titolo opzione più forte
   * Descrizione in `text-secondary`
5. Stato hover chiaro per indicare clickabilità.

Per dashboard/table:

* Dividere la pagina in layer:

  * `bg-base` come livello più profondo
  * Card KPI leggermente più chiara
  * Chart leggermente diversa ancora
  * Tabella leggermente più scura con inset shadow (aspetto “incassato”)
* Togliere bordi superflui. Il contrasto dei layer + ombre basta a separare.

---

## 5. Interazione e motion

### 5.1 Transizione fra tab / viste

* Evitare cambio istantaneo tipo “teletrasporto”.
* Usare slide orizzontale, dissolve morbido, o animazione spring breve.
* L’utente percepisce continuità spaziale. Sembra un oggetto fisico che si muove, non HTML che cambia div.

### 5.2 Micro-interazioni

Esempio invio messaggio vocale a un assistente AI:

* Icona microfono → ruota e diventa check.
* Background che si espande dal punto di tap.
* Testo “Listening” che sfuma con easing spring.

Valore:

* Costruisce percezione di qualità.
* Rende ogni azione memorabile.
* Se replicata in molti punti crea identità del prodotto.

Come progettarle:

* Spezzare l’interazione in sottopassi chiari (rotazione icona, espansione bg, fade testo).
* Far generare il codice/animazione all’LLM step-by-step. Mai chiedere tutto in un unico prompt generico.

### 5.3 Haptics (mobile)

* Tocco leggero per tap frequenti (input numerico, selezione rapida).
* Tocco più deciso per azioni di stato (salvato, confermato, cambio tab principale).

Risultato:

* L’interfaccia diventa fisica.
* L’utente continua a toccare anche “perché è piacevole”, non solo per necessità. Questo aumenta “stickiness”.

---

## 6. Icone e illustrazioni

### 6.1 Icone

* Evitare set base generici se serve personalità.
* Scegliere uno stile coerente:

  * stroke sottile
  * stroke spesso
  * filled
  * outline
* Non mischiare stili nella stessa barra.
* Eccezione: usare versione filled/bold per lo stato attivo e versione outline/thin per lo stato inattivo. Questo è lecito.

Effetto:

* La coerenza del peso linea icone comunica qualità subito.
* Icone incoerenti fanno percepire l’app “cheap”.

### 6.2 Illustrazioni e empty state

* Stato vuoto non = testo grigio “nessun dato”.
* Usare una mascotte o un personaggio. Questo aumenta fiducia e personalità.
* Generare varianti coerenti della mascotte per diversi stati (cercando dati, in pausa, nessun risultato, ecc.).
* Idealmente animare con strumenti tipo Rive. Micro-animazioni sugli stati vuoti fanno percepire cura.

Valore:

* Memorabilità.
* Identità visiva unica.
* Riduzione frustrazione quando l’app “non ha ancora contenuti”.

---

## 7. Dashboard e layout complessi

Obiettivo: dare struttura leggibile a viste dense (analytics, billing, admin).

Pattern pratico:

1. Impostare `bg-base` come piano più profondo.
2. Ogni blocco chiave (stats card, grafico, tabella) vive su un piano diverso di luminosità.

   * Non mettere tutto sullo stesso grigio / stesso bianco.
3. L’elemento più importante è anche il più “vicino”:

   * Ombra più estesa
   * Gradiente leggero
   * Più aria attorno
4. L’elemento meno importante può sembrare “sotto”:

   * Inset shadow scura in alto + highlight chiaro in basso
   * Background un pelo più scuro
5. Eliminare bordi ripetitivi. Se i layer sono chiari non servono mille stroke #E5E5E5.
6. Usare border-radius e padding interno ampio per leggibilità.

Risultato:

* Dashboard che sembra profonda e tattile, non un foglio Excel piatto.

---

## 8. Processo creativo replicabile

### 8.1 Raccolta ispirazioni

* Guardare layout reali su librerie tipo Mobbin (testimonials fintech, onboarding AI, pricing SaaS).
* Salvare 3-5 esempi ad alta credibilità.
* Annotare perché funzionano (volto umano = fiducia, testo diretto = autenticità, ecc.).

### 8.2 Sintesi

* Individuare pattern comuni tra le reference.
* Tenere solo gli elementi che servono alla storia del prodotto.
* Scartare abbellimenti gratuiti.

### 8.3 Incubazione

* Dopo aver raccolto idee, fermarsi e scollegarsi.
* Questo reset è parte del processo creativo.
* Se non emergono nuove idee è probabile overload o stress cognitivo, non “mancanza di talento”.

### 8.4 Shipping e feedback

* Non innamorarsi della prima versione.
* Mostrare la UI a colleghi / utenti.

  * Capiscono subito cosa devono fare?
  * Cliccano dove previsto?
  * Trovano bello qualcosa che in realtà non vorresti enfatizzare?
* Se sì, la gerarchia è ancora sbagliata. Correggere gerarchia, non solo colore.

### 8.5 Checklist operativa e tracking feedback

Problema reale: feedback sparsi su Slack, call, commenti Figma, email.

Soluzione:

* Centralizzare tutti i TODO in una lista unica (es. Google Tasks).
* Automazione tipo: ogni nuovo commento Figma → nuova task con:

  * chi ha scritto
  * testo commento
  * link profondo al nodo Figma

Risultato:

* Nessuna richiesta critica si perde prima di una review con stakeholder.
* Riduce rischio figuracce live (“dov’è quella variante che avevamo discusso?”).

---

## 9. Etica e responsabilità

### 9.1 Da human-centered a humanity-centered

* Il design non è solo “facile da usare”.
* Ogni feature ha impatto ambientale e sociale (materiali, smaltimento, ciclo di sostituzione forzata ogni 12-24 mesi, estrazione mineraria, consumo energetico).
* Il design deve considerare non solo l’utente singolo ma la collettività e l’ambiente.

Domanda chiave continua:

* Questo pattern aiuta l’utente o lo spinge a consumare di più senza reale beneficio?

### 9.2 Parlare il linguaggio del business

* “Fa bene all’ambiente” non è sufficiente per ottenere priorità.
* Bisogna mostrare foglio numerico:

  * ipotesi di costo
  * ipotesi di ricavo
  * margine
  * impatto reputazionale
  * retention utente
  * riduzione churn
* Va esplicitato: “Questa soluzione è sostenibile e ci fa guadagnare o risparmiare”.

Risultato:

* Design viene ascoltato dai decision maker.
* Il designer guadagna credibilità interna.

---

## 10. Checklist finale per ogni schermata

Usare prima di chiamare una vista “finita”.

1. Focus

   * Esiste un’azione primaria chiarissima?
   * È visibile in meno di 2 secondi?

2. Gerarchia

   * Il contenuto secondario è attenuato di proposito (colore più morbido, peso minore, meno elevazione)?

3. Spaziatura

   * I gruppi logici sono visivamente uniti?
   * I blocchi diversi sono separati con aria sufficiente?

4. Profondità / Layering

   * Ci sono almeno tre livelli visivi? (sfondo pagina / card / elemento in focus)
   * Ombre e gradienti comunicano importanza o sono solo decorativi?

5. Tipografia

   * Headline leggibile e con presenza.
   * Body leggibile con line-height corretta.
   * Niente paragrafi centrati lunghi.

6. Stato / Interazione

   * Hover, active, selected sono chiari?
   * Su mobile: previsti micro-motion o haptics nei punti chiave?

7. Personalità

   * C’è un tocco umano nei punti freddi (illustrazione mascotte, avatar reale, tono testo più diretto)?

8. Accessibilità base

   * Contrasto sufficiente testo/sfondo.
   * Touch target adeguato.

9. Sostenibilità narrativa

   * La schermata promuove consumo inutile o aiuta a risolvere un problema reale?

10. Documentazione

* Il feedback stakeholder è già in una lista di task tracciabile con link diretto?

Se una risposta è “no”, la vista non è pronta per review esterna.

---

## 11. Riassunto operativo

1. Parti dall’azione chiave. Taglia il resto.
2. Definisci scala spaziatura e scala tipografica prima di disegnare.
3. Usa 3-4 layer di profondità con variazioni della stessa tinta + ombra duale (highlight top + shadow bottom).
4. Costruisci gerarchia: aumenta ciò che conta, spegni il rumore.
5. Aggiungi micro-motion e (su mobile) haptics. L’app deve sembrare fisica.
6. Usa icone coerenti e illustrazioni personalizzate per dare riconoscibilità e calore.
7. Automatizza la raccolta feedback per non perdere richieste critiche.
8. Porta sempre numeri di business e impatto ambientale. Non solo estetica.

Questo documento è baseline. Ogni nuova schermata e ogni nuovo componente deve rispettare questi principi prima di essere considerato “di livello alto”.
