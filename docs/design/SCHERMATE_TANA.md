# Schermate della Tana (D2)

Le schermate della Tana approvate in D2, da usare in F1.6, F1.7 e F1.10 e per rivedere aggiunta e scanner. Il disegno sta nella tela di design su Claude, pagina "D2 · Tana" (privata, del proprietario della repo), costruita con i componenti del design system Sottobosco. Qui ci sono le decisioni e la struttura di ogni schermata; colori, tipografia e componenti stanno in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

I testi citati sono le frasi da usare: vanno in `packages/i18n/messages/`, non nei componenti.

## Decisioni trasversali

- **Posseduto e letto separati ovunque.** Nella scheda libro due blocchi in alto ("Ce l'hai", "Letto 2 volte"); nella scheda di un libro solo nel catalogo due domande distinte ("Ce l'hai?", "L'hai letto?").
- **La Tana contiene anche i libri letti ma non posseduti.** Una riga senza copia lo dice accanto all'autore: "non ce l'hai".
- **`abandoned` si chiama "Messo da parte"**, mai "abbandonato" (pillola `paused`, contorno grigio, due barre).
- **Il voto sta su ogni lettura.** Il badge miele della scheda mostra quello della lettura più recente con un voto.
- **Le date sconosciute restano vuote.** "Non ricordi una data? Lasciala vuota: va bene così." Si mostra "inizio non segnato", mai una data stimata.
- **All'aggiunta si chiede anche la lettura.** La scheda di conferma ha "Ce l'ho", "Si può prestare" e "L'hai letto?" (Non ancora · Lo sto leggendo · L'ho letto).
- **Navigazione:** la barra finale ha Tana, Bosco, Scansiona, Micelio e Tu. Fino a F2 si mostrano solo Tana, Scansiona e Tu. Su desktop la barra diventa una navigazione in alto con "Aggiungi un libro".
- **Le schermate di compito (aggiunta, scanner, conferma) non hanno la chioma** né la barra in basso: hanno un link per tornare indietro e il titolo `display-l`.

## La Tana (F1.7)

**Elenco** (vista di default)
- Chioma: "La tua Tana" · "la tua libreria · 128 libri".
- Ricerca interna: "Cerca nella tua Tana".
- Filtri a chip combinabili: In lettura, Letti, Dispensa, Messi da parte. Su desktop anche Ce l'ho e Si può prestare, con i conteggi.
- Riga con `Segmented` Elenco / Griglia e ordine a destra ("Aggiunti di recente").
- Sezione "Stai leggendo" in cima (solo se ci sono letture in corso), poi "Tutta la Tana" con il totale.
- Righe `BookRow`: copertina, titolo, autore, una pillola di stato, voto. Lo stato mostrato è quello della lettura più recente; "Letto 2 volte" quando le letture finite sono più di una.

**Griglia di uno scaffale**
- Chioma con il nome dello scaffale ("Comodino" · "uno scaffale della tua Tana · 9 libri"), link "Tutti gli scaffali".
- Tre colonne su telefono (copertina 106 px, titolo, autore); i filtri restano. Con un filtro attivo si dice quanti libri si vedono: "6 su 9 · solo Dispensa".

**Scaffali**
- Chioma "Scaffali" · "come li sistemi tu · 4 scaffali", bottone "Nuovo scaffale".
- Una scheda per scaffale: copertine sovrapposte (fino a 3), nome, numero di libri.
- Nota: "Un libro può stare su più scaffali. Gli scaffali sono solo tuoi: dentro la Tana ritrovi comunque tutto."

**Ricerca senza risultati**
- Titolo che ripete cosa si cercava e con quali filtri: "Nessun libro letto con «lezioni americane»".
- "Forse non l'hai ancora segnato come letto, oppure non è nella tua Tana."
- Azioni: "Togli il filtro Letti" (secondaria) e "Cercalo nel catalogo" (principale, apre `/add` con la stessa ricerca).

**Desktop**
- Pagina fluida: navigazione in alto, chioma a tutta larghezza, colonna dei filtri a sinistra (ricerca, Lettura, Copie, Scaffali) che su telefono va sopra.
- "Stai leggendo" in righe affiancate; "Tutta la Tana" in griglia di copertine da 140 px con titolo, autore e stato.

## Scheda libro (F1.6, F1.7)

**Libro nella tua Tana**, dall'alto:
1. Chioma bassa senza titolo, con "Tana" (indietro) e "Altre azioni".
2. Copertina 136 px sollevata che scavalca la chioma; accanto il badge del voto ("4,5 funghetti").
3. Titolo `display-l`, autori, "Prima edizione: 1957".
4. Due riquadri affiancati che portano alle sezioni: "Ce l'hai · 1 copia · si può prestare" e "Letto 2 volte · ultima a marzo 2024".
5. "Ce l'hai": per ogni copia edizione, "Si può prestare", "Presa il …", note; "Modifica" e "Ne ho un'altra copia".
6. "Le tue letture": una voce per lettura, dalla più recente ("Seconda lettura", "Prima lettura"), con pillola di stato, date ("dal 2 al 18 marzo 2024", "finita nel 2011 · inizio non segnato") e voto. "Inizia una rilettura" e "Modifica".
7. "Le tue note" (il campo `review` della lettura), in `note`.
8. "Di cosa parla", poi "Edizioni" con quella della tua copia segnata.

**Libro solo nel catalogo**
- Stessa testata, senza badge; sotto il titolo "nel catalogo comune".
- "Ce l'hai?" con "Non è ancora nella tua Tana. Poi scegli l'edizione che hai in mano." e il bottone principale "Ce l'ho".
- "L'hai letto?" con "Vale anche se non ce l'hai: un prestito, la biblioteca, un regalo che hai ridato." e tre scelte: "Voglio leggerlo · in Dispensa", "Lo sto leggendo", "L'ho già letto".
- "Hai un'altra edizione? Aggiungila" sotto le edizioni.

## Letture (F1.6)

**Foglio di modifica** (sale dal basso, `radius-sheet`)
- Testata: copertina piccola, "La tua lettura", "titolo · seconda lettura", chiudi.
- "A che punto sei": quattro scelte esclusive (radio) in griglia 2×2: Voglio leggerlo, Lo sto leggendo, L'ho letto, Messo da parte.
- "Iniziato" e "Finito", entrambe facoltative, con la frase sulle date vuote.
- "Quanti funghetti?": voto da toccare, un quarto in meno a ogni nuovo tocco sullo stesso funghetto (ADR-0009); "Senza voto" lo toglie (`rating_quarter` a `NULL`). Compare solo con "L'ho letto" e "Messo da parte": una lettura aperta non ha voto (F1.6).
- "Note", "Solo per te, per ora." (fino a F2.2).
- "Salva la lettura"; "Elimina questa lettura" in `color-danger`, con conferma.

**Libro finito**
- Quando una lettura passa a "L'ho letto": finestra sul biglietto (`color-ticket`, bordo tratteggiato, `shadow-lift`) con la topina segnaposto.
- "Finito!" · "«Le città invisibili» è tra i tuoi letti." · "Quanti funghetti gli dai?" · "Salva", "Scrivi due righe", "Più tardi". Senza "da oggi": la data di fine non si mette mai da sola.
- Solo quando una lettura aperta (Dispensa o in corso) diventa letta; non all'aggiunta e non per una lettura passata.
- Un solo movimento in entrata con `ease-pop` e `motion-slow`; niente con `prefers-reduced-motion`. Nessun conteggio o obiettivo.

## Aggiungere un libro (revisione di F1.3 e F1.4)

- **Ricerca:** titolo "Aggiungi un libro", casella "Titolo, autore o ISBN", subito sotto "Scansiona il codice" (principale) e "A mano". Risultati in "Già nel catalogo" (con "Scegli l'edizione che hai in mano") e "Trovati altrove" (con la fonte e, se serve, "Forse è già nel catalogo" in `color-warning`). In fondo "Non c'è quello che cerchi? Inseriscilo a mano".
- **Controlla la scheda:** in alto il biglietto "«…» è già nel catalogo. È la stessa opera?" con "Sì, è la stessa" / "No, è un'altra"; copertina con "Usa una tua foto"; ogni campo con la fonte a destra ("da SBN"); avviso sulle pagine di Google Books sotto il campo; riquadro "Nella tua Tana" con "Ce l'ho", "Si può prestare" e "L'hai letto?"; bottone fisso in basso "Aggiungi alla Tana".
- **A mano:** "Inseriscilo a mano" · "Scrivi quello che sai: basta il titolo, il resto si può completare dopo."; riquadro della foto ("Foto pronta", "Cambia foto", "Togli la foto"); titolo e autore subito, il resto in "Altri dettagli · editore, anno, pagine, lingua, traduttori".
- **Nessun risultato:** "Non l'abbiamo trovato da nessuna parte" · "Capita, soprattutto con le novità. Prova con meno parole, oppure scrivilo tu: basta il titolo." · dove si è cercato; "Inseriscilo a mano" e "Scansiona il codice a barre".
- **Scanner:** inquadratura a tutto schermo con cornice miele; in alto chiudi, stato ("Sto leggendo il codice…"), luce; in basso un foglio con l'eventuale avviso ("Questo codice non è un ISBN…"), l'aiuto ("Inquadra il codice con il 978 o il 979…"), "Fotografa il codice" e "Scrivi l'ISBN".
- **Fotocamera chiusa:** "La fotocamera resta chiusa" · "Senza il tuo permesso non la apriamo…"; "Fotografa il codice", "Scrivi l'ISBN"; "Come riaprire la fotocamera" con i passi per iPhone e per Chrome su Android.

## Copertine generate (F1.10)

La versione definitiva è il `BookCover` del design system, non quella provvisoria di F1.3a:
- quattro toni (`canopy`, `honey`, `inverse`, `accent`) scelti dal titolo, stabili ovunque;
- cappello di fungo al centro, terra in ombra in basso, titolo in Fraunces in basso, autore solo da 80 px;
- contorno d'inchiostro e `radius-cover` come le copertine vere;
- misure dell'app: 136 (scheda), 106 (griglia), 48 (elenco);
- sparisce appena c'è una copertina vera o una foto.

## Prima volta ed errori

- **Tana vuota:** chioma "La tua Tana" · "la tua libreria · ancora vuota"; topina segnaposto; "Qui stanno spuntando i primi funghetti" · "Metti al riparo il primo libro: quello più vicino a te va benissimo."; "Scansiona il codice a barre" (principale), "Cercalo per titolo o autore"; biglietto "Hai già i tuoi libri su Goodreads?" con "Importa da Goodreads" (attivo da F1.8).
- **Pagina che non c'è** (404 e schede unite): pagina rosicchiata, "Il tarlo ha mangiato questa pagina" · "Quello che cercavi non è qui: forse il link è sbagliato, oppure la scheda è stata unita a un'altra."; "Torna alla Tana", "Cerca un libro". Il tarlo vero arriva con la D4.

## Notte

Tana, scheda libro e Tana vuota sono disegnate anche nel tema `notte`: stesse schermate, cambia solo `data-theme`. Le lucciole compaiono solo di notte, nella chioma.
