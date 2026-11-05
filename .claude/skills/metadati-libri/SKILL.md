---
name: metadati-libri
description: Regole per metadati e copertine dei libri a Libresca, normalizzazione ISBN, deduplica e import da altre app. Usala quando lavori con Open Library, Google Books, SBN, ricerca libri, scanner o import Goodreads.
---

# Metadati dei libri

Prima di tutto leggi la sezione "Fonti dei metadati" di `docs/ARCHITECTURE.md` e `docs/adr/0004-fonti-metadati.md`. L'ordine delle fonti deciso dallo spike F0.2 prevale su qualsiasi ipotesi.

## Regole

- Tutte le chiamate passano dal servizio server. Il client carica direttamente solo le immagini delle copertine.
- Prima si cerca nel catalogo locale, poi nelle fonti esterne.
- Open Library: massimo 3 richieste al secondo, con `User-Agent` del tipo `Libresca (contatto)`, contatto letto da variabile d'ambiente.
- Per più libri preferisci `search.json` a centinaia di richieste singole. Per elaborazioni massicce usa i dump mensili.
- Copertine: salva e usa `cover_id` oppure OLID; gli accessi per ISBN hanno un limite di 100 richieste ogni 5 minuti per IP.
- Google Books: chiave solo lato server. Prima di aggiungere una cache persistente rileggi i termini d'uso correnti.
- Conserva sempre la provenienza: fonte, ID esterno, payload grezzo.
- Nessuno scraping.

## Normalizzazione ISBN

1. Rimuovi spazi, trattini e wrapper dei fogli di calcolo.
2. Valida la cifra di controllo.
3. Converti ISBN-10 in ISBN-13 con prefisso `978`.
4. Salva sempre la forma ISBN-13.

Ricorda che alcuni codici a barre sui libri non sono ISBN e che l'editore può aver riusato un ISBN: mostra sempre una conferma con titolo e copertina prima di salvare.

## Opere ed edizioni

- Non unire le opere in base al solo titolo: i falsi positivi sono peggiori dei doppioni, perché i doppioni si possono unire dopo.
- Una corrispondenza sicura richiede un identificatore condiviso, oppure titolo e autore normalizzati con conferma.
- Gestisci accenti, articoli iniziali e sottotitoli.
- I traduttori stanno in `contributors` come dato dell'edizione.

## Import

Per Goodreads leggi [goodreads-csv.md](goodreads-csv.md).

Requisiti per ogni importatore:

- Parser puro e testato in `packages/domain/`, con fixture inventate.
- Riprendibile e idempotente: rilanciarlo non crea doppioni.
- Mai scartare una riga in silenzio: quelle dubbie vanno nella schermata di revisione.
- Non caricare in repo export reali.
