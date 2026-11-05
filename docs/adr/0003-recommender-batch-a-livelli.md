# ADR-0003: Recommender batch a livelli

- **Stato:** Proposta
- **Data:** 2026-11-05

## Contesto

Con pochi utenti, il filtraggio collaborativo addestrato solo sui dati interni non funziona. L'app deve restare economica, senza server dedicati, e ogni consiglio deve essere spiegabile.

## Decisione

Costruire il sistema per livelli indipendenti: sociale, contenuto, collaborativo con prior da dati pubblici, ranking ibrido. I calcoli girano in un job Python notturno che scrive i risultati in Postgres; l'app legge soltanto la tabella dei risultati.

## Alternative considerate

- **Modello collaborativo sui soli dati interni:** dati insufficienti.
- **Servizio di inferenza sempre attivo:** costi e complessità ingiustificati, i consigli di lettura non hanno bisogno del tempo reale.
- **Consigli generati da un LLM a ogni richiesta:** costi variabili e valutazione difficile. Può tornare come supporto per le spiegazioni o l'arricchimento dei tag.

## Conseguenze

- Il sistema dà valore già dal primo livello.
- I consigli si aggiornano una volta al giorno.
- Le interazioni vanno registrate prima di avere il modello.
- Il worker richiede credenziali limitate nei secret di GitHub.
