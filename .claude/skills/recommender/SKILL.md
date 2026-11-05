---
name: recommender
description: Sviluppa e valuta il Micelio, il sistema di raccomandazione di Libresca. Usala per consigli automatici, embedding, modelli, ranking, spiegazioni, metriche offline o il job batch in ml/.
---

# Il Micelio

Leggi `docs/RECOMMENDER.md` prima di iniziare e `docs/adr/0003-recommender-batch-a-livelli.md` se il task tocca l'architettura.

## Regole

- Completa un livello prima di passare al successivo: M0, M1, M2, M3.
- Ogni modello si confronta con le baseline: niente nuovi modelli senza un confronto.
- Ogni consiglio ha `reasons` strutturati e una `model_version`.
- I filtri duri precedono il ranking: già letto, posseduto, scartato, dati privati.
- Mai un fatto `private` in una spiegazione o nei segnali usati per altri utenti.
- Registra in `reco_events` ciò che è stato mostrato, così i dati di feedback restano interpretabili.

## Procedura per un esperimento

1. Scrivi l'ipotesi e la metrica decisiva prima di guardare i risultati.
2. Fissa seed, dati e split temporale.
3. Misura baseline e nuovo modello con lo stesso harness.
4. Riporta intervalli di incertezza via bootstrap. Con pochi utenti non decidere su piccole differenze.
5. Guarda anche i consigli concreti: una metrica buona non basta se la lista sembra sbagliata.
6. Annota l'esito in `ml/experiments/`, con codice e parametri ma senza dati personali.

## Dati

- Prima di usare un dataset, verifica licenza e condizioni nella fonte originale e registrale.
- UCSD Book Graph è solo per uso accademico: non deve entrare nel prodotto.
- Dati, modelli e artefatti non vanno in git.
- La repo e i log di GitHub Actions sono pubblici: niente titoli, nomi o ID utente nei log.

## Job in produzione

- Il worker scrive solo nelle tabelle del recommender, con un ruolo dedicato.
- La scrittura di una nuova generazione deve essere atomica: l'app non deve mai vedere una lista a metà.
- Se il job fallisce, l'ultima generazione valida resta disponibile.
