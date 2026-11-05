# ADR-0004: Fonti dei metadati dei libri

- **Stato:** Proposta, da completare con i risultati dello spike F0.2
- **Data:** 2026-11-05

## Contesto

L'app dipende da metadati e copertine, ma molti libri della cerchia saranno edizioni italiane, dove le fonti aperte possono essere meno complete. L'API Goodreads non è disponibile per nuovi sviluppatori.

## Decisione

Catalogo locale come fonte primaria, alimentato da una cascata: Open Library, poi Google Books, poi eventualmente SBN, con inserimento manuale sempre possibile. L'ordine definitivo dipenderà dalle misure dello spike.

## Alternative considerate

- **Solo Google Books:** va verificato cosa consentono i termini sulla conservazione dei dati e dipenderemmo da una sola API.
- **Hardcover:** API in beta, pensata per uso personale da backend, inadatta ad alimentare il catalogo di un'altra app.
- **Scraping di Goodreads o degli OPAC:** fragile e a rischio di violare i termini d'uso.
- **ISBNdb o altri servizi a pagamento:** da considerare solo se lo spike mostra buchi gravi.

## Conseguenze

- Servono merge dei campi, provenienza dei dati e gestione delle lacune.
- La copertina generata diventa una funzione del prodotto.
