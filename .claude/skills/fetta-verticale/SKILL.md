---
name: fetta-verticale
description: Implementa un task della roadmap di Libresca come fetta verticale completa, dal database alla UI, con test e verifica. Usala per costruire una funzione o quando si chiede di implementare un task come F1.4.
argument-hint: "[id task]"
---

# Fetta verticale

Task: $ARGUMENTS

## 1. Prepara

1. Leggi il task in `docs/ROADMAP.md` e il criterio "Fatto quando" della fase.
2. Leggi le sezioni pertinenti di `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md` e degli ADR.
3. Crea un branch `feat/<fase>-<descrizione-breve>` da `main` aggiornato.
4. Se il task coinvolge più di una decisione non ovvia, presenta un piano breve prima di scrivere codice.

## 2. Costruisci nell'ordine

1. **Dati:** migrazione, RLS e test delle policy (skill `migrazione-db`).
2. **Dominio:** logica pura in `packages/domain/` con test.
3. **Server:** Server Actions con validazione degli input e gestione degli errori.
4. **UI:** stati di caricamento, vuoto ed errore inclusi (skill `ui-sottobosco`).
5. **Test end-to-end:** solo per il percorso principale.

Tieni la fetta piccola. Se emerge lavoro fuori dal task, annotalo per l'utente e non includerlo.

## 3. Verifica

Esegui i comandi di `CLAUDE.md` per typecheck, lint e test. Poi prova la funzione nel browser, con viewport mobile se c'è UI, controllando:

- percorso principale ed errori di rete
- utente senza permessi e, se c'entrano gli amici, dati `private`
- titoli lunghi, caratteri accentati, libri senza copertina
- accessibilità da tastiera e `prefers-reduced-motion`

## 4. Chiudi

1. Spunta il task in `docs/ROADMAP.md` e aggiorna lo stato attuale.
2. Aggiorna i documenti diventati inesatti. Scrivi un ADR se è stata presa una decisione importante.
3. Fai commit con Conventional Commits.
4. Riassumi cosa è stato fatto, come è stato verificato e cosa viene dopo.
