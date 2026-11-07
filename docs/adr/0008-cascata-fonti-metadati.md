# ADR-0008: Ordine delle fonti dei metadati, dai numeri dello spike F0.2

- **Stato:** Accettata
- **Data:** 2026-11-07
- **Completa:** [ADR-0004](0004-fonti-metadati.md)

## Contesto

L'ADR-0004 rimandava l'ordine delle fonti a una misura reale. Lo spike F0.2 (`tools/spikes/metadata_coverage.py`) ha interrogato Open Library, Google Books e OPAC SBN su 49 ISBN presi dall'export Goodreads dell'autore. Il campione contiene 35 edizioni italiane di 31 editori diversi e 14 edizioni straniere, cioè tutte quelle presenti nell'export. Lo script stampa solo dati aggregati. Il campione è piccolo, ha poche edizioni anteriori al 2000 (3) e molte recenti (14 dal 2023): i numeri indicano l'ordine di grandezza, non la precisione al punto percentuale.

### Risultati sulle edizioni italiane (35)

| Campo | Open Library | Google Books | SBN | Le tre insieme |
|---|---|---|---|---|
| Edizione trovata | 26% | 89% | 60% | 91% |
| Titolo corretto | 23% | 89% | 60% | 91% |
| Autore corretto | 20% | 86% | 57% | 89% |
| Traduttore (27 libri con altri autori) | 7% | campo assente | 56% | |
| Descrizione | 11% | 29% | assente | 34% |
| Numero pagine | 20% | 66% | 60% | 91% |
| Pagine coerenti con Goodreads | 6 su 7 | 13 su 23 | 21 su 21 | |
| Copertina riutilizzabile | 20% | 77% | non riutilizzabile | 83% |

### Risultati sulle edizioni straniere (14)

| Campo | Open Library | Google Books | SBN |
|---|---|---|---|
| Edizione trovata | 93% | 93% | 21% |
| Descrizione | 50% | 79% | assente |
| Numero pagine | 86% | 50% | 21% |
| Copertina | 71% | 86% | non riutilizzabile |

### Altre osservazioni

- Nessuna fonte trova 3 edizioni italiane su 35, tutte pubblicate dal 2023 in poi. Senza Google Books sarebbero 13. SBN arriva in ritardo sulle novità, perché le biblioteche le catalogano dopo.
- Google Books trova da solo 11 edizioni che le altre due fonti non hanno. Open Library e SBN non aggiungono edizioni che Google Books non trovi già, ma aggiungono campi: pagine affidabili e traduttori.
- Le pagine di Google Books sono spesso sbagliate sulle edizioni italiane: solo 13 su 23 sono coerenti con Goodreads. Quelle di SBN lo sono tutte.
- In 6 casi su 13 Open Library scrive l'autore di un libro straniero nell'alfabeto originale, mentre Goodreads usa la traslitterazione.
- SBN espone un endpoint JSON non documentato, `opac.sbn.it/opacmobilegw/` (`search.json?isbn=`, `full.json?bid=`), che usa la sua app ufficiale. Ha risposto a 73 richieste senza errori, a un ritmo di una al secondo. Il campo copertina di SBN è un URL di LibraryThing con la chiave sviluppatore di SBN: non possiamo riutilizzarlo.
- Google Books non risponde senza chiave: la quota anonima è zero.

### Vincoli dei termini d'uso

- **Google Books.** I [Google APIs Terms of Service](https://developers.google.com/terms), sezione 5(e), vietano di "build databases, or otherwise create permanent copies" dei contenuti e di tenerli in cache oltre l'intestazione di cache. I [termini della Books API](https://developers.google.com/books/terms) aggiungono tre obblighi: rimuovere i contenuti su richiesta e indicare un contatto per farlo, avvisare gli utenti che ciò che inviano alla API può diventare pubblico, non far pagare l'uso dell'app senza accordo con Google.
- **SBN.** Nel 2013 l'ICCU ha approvato la licenza CC0 per i dati dell'OPAC SBN ([relazione CNC](https://www.iccu.sbn.it/export/sites/iccu/documenti/2014/CNC_SBN_Verb11-9-13/Relazione_CNC_11-9-2013.pdf), [open data ICCU](https://www.iccu.sbn.it/en/activities/open-data/)). I dati sono riutilizzabili; l'endpoint, però, non è un servizio pubblico documentato.
- **Open Library.** I dati del catalogo sono aperti. Restano i limiti di ritmo già scritti in `docs/ARCHITECTURE.md`.

## Decisione

Le fonti non si interrogano più in una cascata che si ferma alla prima risposta. All'aggiunta di un libro per ISBN, `/api/v1` le interroga **in parallelo**, con timeout brevi, e unisce i risultati campo per campo:

- **Open Library:** sempre.
- **Google Books:** sempre.
- **SBN:** solo per i prefissi italiani `978-88` e `979-12`.

Si salva in modo permanente solo ciò che viene da fonti aperte. Google Books serve a trovare il libro e a completare la scheda, ma i suoi contenuti non entrano nel catalogo come copia permanente.

| Campo | Priorità | Cosa si salva |
|---|---|---|
| Titolo, autore, editore, anno | SBN, Open Library, Google Books | Il valore confermato dall'utente nella schermata di aggiunta. Se viene da Google Books, la provenienza resta `googlebooks`, così un job successivo può sostituirlo con un dato aperto |
| Numero pagine | SBN, Open Library, Google Books | Come sopra. Il valore di Google Books ha bassa affidabilità e va mostrato come modificabile |
| Traduttore | SBN, Open Library | In `contributors` |
| Descrizione | Open Library, Google Books | Si salva solo quella di Open Library. Quella di Google Books si mostra dal vivo tramite `/api/v1`, con cache entro i limiti dell'intestazione HTTP |
| Copertina | Open Library (`cover_id`), Google Books (ID del volume), foto dell'utente, copertina generata | Si salva l'ID, mai l'immagine. Quella di Google Books si carica dal vivo, costruendo l'URL dall'ID del volume |
| ID esterni | Tutte | Per Google Books si salva solo l'ID del volume, senza il payload grezzo |

## Alternative considerate

- **Cascata sequenziale Open Library → Google Books → SBN, come nell'ADR-0004:** sui libri italiani Open Library risponde una volta su quattro. Partire da lì aggiunge latenza e non decide quasi mai da solo.
- **Solo Google Books:** copre bene, ma ha pagine poco affidabili e nessun traduttore, e i termini vietano di costruirci sopra il catalogo.
- **Solo fonti aperte (Open Library e SBN):** sui libri italiani si fermerebbe al 63% delle edizioni trovate e al 20% delle copertine. Diventerebbe la strada obbligata se l'uso di Google Books non fosse più possibile, per esempio con un'app a pagamento.
- **Servizi a pagamento come ISBNdb:** i buchi residui (3 novità su 35) non giustificano un costo, che oggi deve restare zero.

## Conseguenze

- `external_ids.raw` non contiene payload di Google Books. Lo schema in `docs/DATA_MODEL.md` va adattato in F1.1, insieme a `authors.alternate_names` per gli autori scritti in alfabeti diversi.
- Serve una chiave Google Books lato server (`GOOGLE_BOOKS_API_KEY`). La quota giornaliera della chiave va controllata nella console Google Cloud prima di F1.2, insieme all'eventuale obbligo di attribuzione visibile.
- Le novità restano il punto debole. L'inserimento manuale e la foto della copertina devono essere comodi già in F1.3. Un job può ritentare SBN e Open Library sulle edizioni incomplete, perché SBN si aggiorna ogni settimana.
- Prima della F5 servono tre verifiche:
  - una revisione legale di questa lettura dei termini di Google, in F5.5;
  - una richiesta all'ICCU sull'uso dell'endpoint `opacmobilegw`, o in alternativa il passaggio a un canale documentato, se ne esiste uno;
  - se l'app diventa a pagamento, l'esclusione di Google Books.
- Se SBN smette di rispondere, perdiamo soprattutto pagine affidabili e traduttori delle edizioni italiane, non la capacità di trovarle.
- Per rifare la misura basta rilanciare lo script, che ha una cache locale in `data/private/`.
