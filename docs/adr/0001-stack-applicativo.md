# ADR-0001: PWA Next.js con Supabase

- **Stato:** Proposta
- **Data:** 2026-11-05

## Contesto

Un solo sviluppatore, assistito da Claude Code, deve costruire un'app per pochi amici. Il telefono è il dispositivo principale, serve lo scanner da fotocamera e i permessi tra amici sono il punto delicato. Il budget atteso è vicino allo zero.

## Decisione

PWA mobile-first in Next.js e TypeScript, su Vercel, con Supabase per Postgres, autenticazione, storage e pgvector. I permessi stanno nelle policy RLS. Nessun backend separato: il codice server vive in Server Components e Server Actions.

## Alternative considerate

- **Expo / React Native:** migliore integrazione nativa, ma pubblicazione sugli store e distribuzione più pesanti per una cerchia di amici.
- **Backend dedicato (FastAPI o simili):** più controllo, ma un servizio in più da gestire senza un bisogno concreto.
- **SQLite self-hosted:** economico e semplice, ma richiede di gestire server, backup, autenticazione e ricerca vettoriale.
- **Applicazione federata basata su BookWyrm:** progetto interessante, ma l'obiettivo qui è un prodotto su misura per una cerchia e un'estetica molto specifica.

## Conseguenze

- Si invia un link e si è operativi, senza store.
- Lo scanner su iOS richiede un polyfill WASM, perché Safari non implementa la Barcode Detection API.
- Il progetto Supabase gratuito va in pausa dopo una settimana di inattività.
- Il vincolo a Supabase resta moderato: lo schema è Postgres standard, ma RLS e Auth andrebbero migrati con cura.
