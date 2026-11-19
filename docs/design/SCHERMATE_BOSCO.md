# Schermate del Bosco (D3)

Le schermate del Bosco, dei prestiti, delle spore e del Micelio approvate in D3, da usare in F2 e in F3.7. Il disegno sta nella tela di design su Claude, pagina "D3 · Bosco" (privata, del proprietario della repo), costruita con i componenti del design system Sottobosco. Qui ci sono le decisioni e la struttura di ogni schermata; colori, tipografia e componenti stanno in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), le schermate della Tana in [`SCHERMATE_TANA.md`](SCHERMATE_TANA.md).

I testi citati sono le frasi da usare: vanno in `packages/i18n/messages/`, non nei componenti. I nomi di amici e libri nelle schermate sono esempi.

## Decisioni trasversali

- **Prima ciò che chiede una risposta.** Una richiesta di prestito o di amicizia sta in cima, in una scheda miele (`color-honey`). Il resto viene dopo.
- **Niente pressione sociale.** Nel feed e nelle spore non ci sono like, contatori o classifiche. "Non ora" e "Non fa per me" non chiedono spiegazioni e non si notificano a nessuno.
- **Si mostra solo ciò che l'altro può già vedere.** La Tana di un amico, "Nel tuo Bosco", le idee regalo e i motivi del Micelio usano solo dati con visibilità `friends`. Di un libro nascosto non resta traccia, nemmeno come assenza: le idee regalo escludono soltanto i libri che l'amico mostra.
- **Le spore ricevute stanno nel Micelio**, in cima ai consigli. Il feed del Bosco non le mostra: sono tra due persone.
- **Biglietti per ciò che viaggia.** Prestiti e spore usano il biglietto tratteggiato (`color-ticket`, `border-dash`).
- **Navigazione completa.** Con F2 la barra mostra Tana, Bosco, Scansiona, Micelio e Tu. Il Micelio compare quando arrivano le spore (F2.6), anche prima dei consigli automatici.
- **Desktop:** si riusa la struttura della Tana desktop di D2 (navigazione in alto, colonna a sinistra); non c'è un disegno a parte.

## Il Bosco (F2.1, F2.3, F2.4, F2.8)

**Pagina del Bosco**
- Chioma "Il Bosco" · "i tuoi amici · 6 amici"; a destra le lucciole con il numero di quelle nuove e "Invita".
- Scheda miele "Un amico bussa alla tana": chi chiede, il libro, la sua nota, "Prestalo" (principale) e "Non ora".
- "I tuoi amici": avatar in fila con il nome, lucciola sull'avatar di chi ha novità; "Tutti" porta alla pagina Amici.
- "I tuoi prestiti": i biglietti dei libri in viaggio con la pillola `loan` o `late`; "Tutti" porta ai Prestiti.
- "Cosa succede nel Bosco": chi ha finito un libro (con il voto), chi l'ha cominciato, chi l'ha messo in Dispensa. Ogni voce apre la scheda del libro.

**Tana di un amico**
- Chioma "La Tana di Marta" · "214 libri · nel tuo Bosco da marzo"; sotto, "Bosco" per tornare e "Idee regalo".
- Riquadro `color-why` con quello che avete in comune: "23 libri li avete letti tutti e due."
- `Segmented` "La sua Tana / I suoi desideri", ricerca "Cerca nella Tana di Marta".
- Chip: Si può prestare, Non ce l'hai, Letti, In lettura. Le righe `BookRow` mostrano lo stato e il voto dell'amico; "ce l'hai anche tu" accanto all'autore.
- In fondo: "Vedi solo quello che Marta condivide con gli amici."

**Nel tuo Bosco** (blocco della scheda libro)
- Viene prima di "Ce l'hai?" quando il libro non è nella tua Tana.
- Se un amico può prestarlo: "Ce l'ha Marta: potresti chiederlo a lei" · "Si può prestare · è a casa sua" e "Chiedilo a Marta" come azione principale.
- Poi le altre righe: chi ce l'ha ma non lo presta, chi l'ha letto con il voto e una riga delle sue note, chi lo desidera ("un'idea per un regalo").
- "Ce l'hai?" diventa più breve, con "Ce l'ho" e "Lo vorrei", che lo mette tra i desideri.

**Amici**
- Biglietto "Invita qualcuno nel Bosco": "Un invito vale per una persona e dura 7 giorni. Chi entra con il tuo invito è subito nel tuo Bosco." "Crea un invito" (principale); gli inviti aperti con "Copia il link".
- "Chi bussa": richieste di amicizia in miele, con "@nome · 2 amici in comune", "Accetta" e "Non ora".
- "Cerca qualcuno" per nome o @nome: "Trovi solo chi è già nell'app. Per gli altri c'è l'invito."
- "Il tuo Bosco": elenco degli amici con @nome e numero di libri.

**Invito** (la pagina del link, prima del login)
- Chioma "Un invito per te", topina segnaposto, biglietto "Marta ti apre la porta del suo Bosco".
- Due righe su cos'è Libresca; "Entrando con questo invito tu e Marta siete subito amici."
- "Entra con Google" (principale), "L'invito vale fino al 26 novembre ed è solo per te."
- In fondo: "Quello che metti nella tua Tana lo vedono i tuoi amici. Ogni libro e ogni lettura si possono tenere solo per te."

**Lucciole** (notifiche in app)
- "Lucciole" · "le tue notifiche · 2 nuove", con "Segna come viste".
- "Nuove" in schede con la lucciola sull'avatar e l'azione a destra ("Rispondi", "Apri"); "Prima" in righe semplici.
- Tipi: richiesta di prestito, prestito accettato, spora ricevuta, grazie per una spora, promemoria di un prestito lungo, amico entrato con il tuo invito, richiesta di amicizia.

**Bosco vuoto**
- Chioma "Il Bosco" · "i tuoi amici · ancora nessuno"; tre avatar vuoti.
- "Il Bosco è ancora silenzioso" · "Invita le persone con cui ti scambi i libri: vedrai cosa leggono e a chi chiederne uno in prestito."
- "Invita qualcuno" (principale), "Cerca chi è già qui"; biglietto "Cosa si fa nel Bosco" con tre righe.

## Prestiti (F2.5)

**Passaggi:** richiesta → "Da consegnare" → "In viaggio" → "È tornato". Dopo tre mesi, o dopo la data di ritorno se c'è, il prestito diventa "Con calma" (pillola `late`). Chi presta può anche segnare un prestito da sé, senza richiesta.

**Elenco**
- "Prestiti" · "i libri in viaggio"; `Segmented` "Li hai prestati · 4 / Te li hanno prestati · 1".
- "Da consegnare" in miele, con "L'ho dato".
- "In viaggio": un biglietto per prestito ("In viaggio da Luca" · "dal 2 ottobre"), con "È tornato". Chi è fuori dal Bosco ha "fuori dal Bosco"; un prestito lungo si intitola "Sara, con calma" · "da 5 mesi".
- "Tornati a casa · 12 libri" in fondo, poi "Hai prestato un libro? Segnalo".

**Un amico bussa** (foglio dal basso)
- "Luca bussa alla tana", il libro con la tua copia, la nota di Luca.
- "Quando dovrebbe tornare?": Nessuna fretta (scelta di default), Fra un mese, Fra tre mesi, Scegli una data.
- "Lo segniamo da consegnare. Quando glielo dai, tocca "L'ho dato"."
- "Prestalo a Luca" (principale), "Non ora": "Con "Non ora" Luca sa solo che per adesso non si può. Niente da spiegare."

**Chiedilo a un amico** (foglio)
- "Chiedilo a Marta", il libro con "la copia di Marta".
- "Due righe per Marta", facoltative. "Marta riceve una lucciola e può dirti di sì oppure "non ora"."
- "Manda la richiesta"; "La ritrovi in Prestiti, tra quelli che ti prestano."

**Prestalo a qualcuno** (foglio dalla tua copia)
- "A chi lo presti?": gli amici come avatar, più "Qualcun altro" con "Come si chiama?" (`borrower_name`): "Non è nel Bosco: non riceve niente, è un promemoria solo per te."
- "Gliel'hai dato il" e "Torna entro", entrambe facoltative, con la frase sulle date vuote.
- "Segna il prestito".

**Scheda di un libro prestato**
- Il riquadro "Ce l'hai" dice "è da Sara, con calma"; nel blocco della copia, la pillola `late` e il biglietto del prestito.
- "È tornato" (principale) e "Ricordalo a Sara": "Le arriva una lucciola: «Come va con Seta? Nessuna fretta.» Una volta sola, scritta da noi." Non si scrive un testo proprio.
- Sotto, i prestiti passati della copia: "È già stato da Luca, nel 2023, per due mesi."
- Dopo "È tornato": "È tornato a casa" · "Seta è di nuovo nella tua Tana."

**Promemoria:** quando un prestito diventa "Con calma" arriva una lucciola solo a chi presta, una volta: "«Seta» è da Sara da 5 mesi. Nessuna fretta: se vuoi, puoi ricordarglielo." La lumaca dei prestiti lunghi arriva con la D4.

## Spore (F2.6)

**Mandare una spora** (foglio dalla scheda libro)
- "Manda una spora" · "un consiglio da amico · Stoner".
- "A chi?": avatar a scelta multipla; sotto ognuno, se serve, "l'ha già letto", "lo sta leggendo" o "ce l'ha".
- "Ognuno la riceve per sé: non vede a chi altro l'hai mandata." Una riga di `spores` per destinatario.
- "Perché dovrebbe leggerlo?", campo in Fraunces corsivo: "Due righe bastano. La leggete solo tu e chi la riceve."
- Il bottone nomina i destinatari: "Manda a Luca e Sara".

**Spora ricevuta**
- Biglietto sollevato "Una spora da Pietro" · "2 giorni fa", con la nota grande in `note`.
- Il libro con il voto di chi la manda e, se c'è, "Ce l'ha Pietro: si può prestare".
- I quattro passi, con forma e parola: Ricevuta, In Dispensa, Letta, Grazie.
- "Mettilo in Dispensa" (principale), "Chiedilo a Pietro", "L'ho già letto", "Non fa per me".
- "Pietro vede quando lo metti in Dispensa, quando lo finisci e il tuo grazie. "Non fa per me" resta tra te e la spora."

**Spore**
- "Spore" · "i consigli tra amici", `Segmented` "Ricevute / Mandate".
- Ricevute divise in Nuove, In Dispensa, Lette; ogni riga è un biglietto con chi l'ha mandata, la nota e la pillola. "Letta · grazie detto" quando il grazie c'è.
- Per un libro finito da una spora senza grazie: "Hai finito «…»" · "Era una spora di Anna" con "Di' grazie".
- Mandate: per ogni destinatario solo i passi positivi.

**Libro finito da una spora**
- Il momento "Finito!" della D2, con in più "Era una spora di Anna", "Dille grazie" già spuntato e "Due righe per Anna, se vuoi".

## Desideri e regali (F2.7)

- "Lo vorrei" sulla scheda libro mette il libro tra i desideri (`wishes`); "I suoi desideri" è una vista della Tana dell'amico.
- **Un regalo per Sara:** chioma "Un regalo per Sara" · "idee senza doppioni"; prima "I suoi desideri" con la sua nota e "ci tiene molto" (`priority`), poi "Potrebbe piacerle" con il `WhyBox` "Perché a Sara" (da F3).
- "Restano fuori i libri che Sara ha o ha già letto, tra quelli che mostra agli amici. Sara non vede che stai cercando un regalo."
- Niente "Lo regalo io": per ora non si prenota un regalo.

## Micelio (F3.7)

**Consigli**
- Chioma "Micelio" · "consigli per te, sempre con il perché".
- "Spore per te" in cima, con "Tutte le spore".
- `Segmented` "Per te / Da farti prestare / Regali" (le modalità di `RECOMMENDER.md`).
- "Dal Micelio" · "cresciuti stanotte": schede con copertina, titolo, autore, `WhyBox` con al massimo 3 motivi, un'azione secondaria ("Mettilo in Dispensa", "Comincialo" se è già in Dispensa) e "Non mi interessa".
- Un "Fungo raro · inaspettato" per elenco, su biglietto tratteggiato con l'etichetta miele.
- I motivi citano solo fatti visibili: "Marta, che ha gusti simili ai tuoi, gli ha dato 4,5 funghetti", "Ce l'ha Luca: si può prestare", "È già nella tua Dispensa".

**Non mi interessa** (foglio)
- "Lo togliamo dai consigli"; "Ci dici perché? Se vuoi.": L'ho già letto (poi chiede i funghetti), Non fa per me, Non adesso (torna fra qualche mese), Preferisco non dirlo.
- "Togli dai consigli"; "Subito dopo puoi ancora annullare. Nessuno degli amici lo vede." Il motivo va in `reco_events`.

**Micelio vuoto**
- "Il Micelio sta ancora crescendo" · "Sotto terra ci vuole un po'. Per consigliarti bene gli servono qualche libro letto con i suoi funghetti, oppure qualche amico nel Bosco."
- "Dai i funghetti ai libri letti", "Invita qualcuno nel Bosco". Nessuna barra di avanzamento.
- Biglietto "Spore per te" che spiega dove arriveranno.

## Tu e la privacy (F2.2, F2.10)

**Tu**
- Chioma "Tu" · "il tuo profilo"; avatar (la creatura arriva con la D4), nome, "@nome · 128 libri · 6 amici", "Modifica".
- "Chi vede cosa": "Libri e letture nuovi li vedono" con `Segmented` "I tuoi amici / Solo tu" (default amici); interruttore "I miei libri aiutano i consigli agli amici" (acceso): "Il Micelio usa solo quello che gli amici vedono già. Mai i libri che tieni per te."; "Spore e prestiti li vede solo chi c'è dentro. Gli scaffali sono solo tuoi."
- "I tuoi dati": Scarica tutto (F1.9), Importa da Goodreads, Inviti.
- "Account": "Esci", "Elimina l'account" in `color-danger`: "Spariscono Tana, letture, prestiti e spore. Le schede del catalogo restano, senza il tuo nome."

**Chi la vede** (foglio della copia; lo stesso nel foglio della lettura)
- "Chi la vede?": "I tuoi amici" ("La vedono nella tua Tana e in «Chi ce l'ha?».") e "Solo tu" ("Per gli amici non c'è. Il Micelio non la usa per i loro consigli.").
- Con "Solo tu", "Si può prestare" si spegne: "Con "Solo tu" nessuno può chiedertela in prestito."
- "Le note della copia restano sempre solo tue."

## Cosa serve al modello dati

Da applicare nei task di F2, con le loro migrazioni:

- `invites`: durata di 7 giorni; riscattare un invito crea anche l'amicizia con chi l'ha creato (F2.1).
- `profiles`: visibilità di default per libri e letture nuovi e consenso all'uso nei consigli degli amici (F2.2, F3).
- `copies.notes` resta privata anche quando la copia è `friends`.
- `loans.status`: `requested`, `accepted` (da consegnare), `lent`, `returned`, `declined`; `lent_on` e `due_on` facoltative; "Con calma" si calcola, non si salva (F2.5).
- `spores.status`: `received`, `saved` (in Dispensa), `read`, `thanked`, più `dismissed` ("Non fa per me"), che chi l'ha mandata non vede (F2.6).

## Notte

Il Bosco e il Micelio sono disegnati anche nel tema `notte`: stesse schermate, cambia solo `data-theme`. Le lucciole della chioma e degli avatar si accendono di notte.
