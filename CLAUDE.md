# Libresca

App per gestire la libreria personale, i libri degli amici, i prestiti e i consigli di lettura. Alternativa intima a Goodreads e Fable, con un'estetica whimsical: funghi, topini, creaturine. All'inizio è una web app su invito e a costo zero; deve poter diventare pubblica, multilingua e app mobile senza riscritture.

**Stato:** nessun codice ancora. Controlla sempre `docs/ROADMAP.md`: è la fonte di verità su cosa è fatto e cosa viene dopo. Usa `/prossimo-passo` per riprendere il lavoro.

## Lingua

- Con l'utente, nei documenti e nei testi dell'app: italiano.
- Codice, nomi di tabelle, commit e branch: inglese.
- Commit in stile Conventional Commits: `feat(tana): add barcode scanner`.

## Dove trovare le cose

- `docs/PRODUCT.md`: visione, pilastri, cosa è fuori scopo
- `docs/ROADMAP.md`: fasi, task, decisioni aperte
- `docs/ARCHITECTURE.md`: stack, fonti metadati, limiti dei servizi
- `docs/DATA_MODEL.md`: schema logico e regole di visibilità
- `docs/RECOMMENDER.md`: progetto del Micelio
- `docs/design/DESIGN_BRIEF.md`: direzione estetica, vocabolario
- `docs/adr/`: decisioni motivate; una decisione importante nuova richiede un ADR

## Stack

Next.js PWA in TypeScript, Tailwind, next-intl, Supabase (Postgres, Auth, Storage, pgvector), worker Python batch per il recommender. In F5, Expo per l'app mobile. Vedi `docs/adr/0001-stack-applicativo.md` e `docs/adr/0005-portabilita-mobile-e-pubblico.md`.

## Comandi

Non esistono ancora. Il task F0.3 deve sostituire questa sezione con i comandi reali per installare, avviare, fare typecheck, lint, eseguire tutti i test o un singolo file di test.

## Regole del progetto

- `copies` e `readings` sono indipendenti: posseduto e letto non vanno mai fusi in un unico stato.
- Voti e consigli stanno sull'opera, ISBN e copertine sull'edizione, proprietà e prestiti sulla copia.
- Ogni tabella nuova ha RLS attiva e test delle policy nella stessa migrazione o PR.
- La logica pura (ISBN, parser degli import, validazione) vive in `packages/domain/` e ha test unitari.
- L'accesso ai dati vive in `packages/data/`. I pacchetti condivisi non dipendono da Next.js né da React DOM, così una futura app mobile può riusarli.
- Niente logica applicativa in componenti o Server Actions: al massimo richiamano i pacchetti.
- Ciò che richiede segreti o servizi esterni sta in `/api/v1`, autenticato con token Supabase Bearer.
- I testi stanno in `packages/i18n/messages/`, mai nei componenti. Date e numeri passano da `Intl`.
- L'accesso dipende da `profiles.status` e `app_settings`: mai regole fisse su una cerchia.
- La UI usa solo token semantici: niente colori o font scritti a mano nei componenti.
- Nessuna chiamata diretta dal client alle API dei metadati: passano da `/api/v1`, che gestisce limiti, cache e chiavi.
- Le parole fantasiose (Tana, Micelio…) stanno nella UI e nei documenti di prodotto. Nel codice usa i nomi di `docs/DATA_MODEL.md`.

## Attenzione

- Finché l'app è privata il costo deve restare zero: segnala prima qualunque servizio a pagamento. Limiti in `docs/ARCHITECTURE.md`.
- Il login è con Google: le email integrate di Supabase non raggiungono gli amici.
- Non usare l'ottimizzazione immagini di Vercel per le copertine.
- Licenze: nel prodotto solo dipendenze permissive (MIT, Apache-2.0, BSD, ISC). Segnala GPL, AGPL e LGPL prima di aggiungerle: compromettono l'App Store. Nome e illustrazioni non sono MIT (`ASSETS_LICENSE.md`).
- La repo è pubblica. Mai committare dati reali di amici, export personali, chiavi. I file personali vanno in `data/private/`.
- Open Library: massimo 3 richieste al secondo con `User-Agent` identificato, niente download massivi via API.
- Il dataset UCSD Book Graph è solo per uso accademico: non usarlo per il prodotto.
- Il design è ancora aperto. Non inventare un'estetica definitiva: usa i token provvisori finché `docs/design/DESIGN_SYSTEM.md` non esiste.

## Come lavoriamo

- Procedi per fette verticali piccole, un task della roadmap alla volta (`/fetta-verticale`).
- Lavora su un branch, mai direttamente su `main`.
- Prima di dire che un task è finito, esegui i controlli e prova la funzione davvero, anche in viewport mobile quando c'è UI.
- A fine task aggiorna la roadmap. Se scopri che il piano è sbagliato, dillo e proponi la modifica.
