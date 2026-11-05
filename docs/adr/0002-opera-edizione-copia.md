# ADR-0002: Modello opera, edizione, copia

- **Stato:** Accettata
- **Data:** 2026-11-05

## Contesto

Gli stessi libri esistono in più edizioni, traduzioni e copie fisiche. Gli amici possono leggere edizioni diverse dello stesso romanzo e devono comunque ritrovarsi. Inoltre posseduto e letto sono fatti distinti, e un libro può essere riletto più volte.

## Decisione

Separare `works`, `editions` e `copies`. Voti e consigli fanno riferimento all'opera, proprietà e prestiti alla copia. `copies` e `readings` sono indipendenti, e ogni lettura è una riga propria.

## Alternative considerate

- **Una sola tabella `books` per ISBN:** semplice, ma traduzioni ed edizioni diverse diventano libri diversi e il recommender perde gran parte del segnale.
- **Stato unico "posseduto/letto" per utente e libro:** non rappresenta riletture, libri letti e non posseduti o più copie.

## Conseguenze

- Query più articolate, compensate da viste dedicate.
- Il collegamento di un'edizione all'opera giusta è il problema difficile: serve deduplica prudente, con la possibilità di unire le opere dopo (`merged_into`).
