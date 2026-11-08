# Libresca

App per gestire la libreria personale, i libri degli amici, i prestiti e i consigli di lettura. Alternativa intima a Goodreads e Fable, con un'estetica whimsical: funghi, topini, creaturine. All'inizio è una web app su invito e a costo zero; deve poter diventare pubblica, multilingua e app mobile senza riscritture.

**Stato:** login Google, accesso per i soli account attivi e shell PWA online; nello schema ci sono profili, impostazioni, il catalogo condiviso (F1.1) e le copie possedute (F1.5), i primi dati personali, leggibili per ora solo dal proprietario. `/api/v1/books/isbn/{isbn}` propone la scheda di un libro dalle fonti e `/api/v1/books/search?q=` cerca per titolo e autore (F1.2). `/add` aggiunge un libro al catalogo, anche a mano con la foto della copertina (bucket Storage `covers`), e `/books/{id}` ne mostra la scheda essenziale (F1.3); lo scanner legge l'ISBN dalla fotocamera o da una foto (F1.4). Controlla sempre `docs/ROADMAP.md`: è la fonte di verità su cosa è fatto e cosa viene dopo. Usa `/prossimo-passo` per riprendere il lavoro.

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
- `docs/design/DESIGN_BRIEF.md`: brief di partenza della traccia design
- `docs/design/DESIGN_SYSTEM.md`: regole del design system Sottobosco, vocabolario, creature
- `packages/tokens/`: token del design system, CSS generato e tema Tailwind
- `docs/adr/`: decisioni motivate; una decisione importante nuova richiede un ADR

## Stack

Next.js PWA in TypeScript, Tailwind, next-intl, Supabase (Postgres, Auth, Storage, pgvector), worker Python batch per il recommender. In F5, Expo per l'app mobile. Vedi `docs/adr/0001-stack-applicativo.md` e `docs/adr/0005-portabilita-mobile-e-pubblico.md`.

## Comandi

Monorepo pnpm (versione fissata in `package.json`, si attiva con `corepack enable pnpm`), Node 24. Tutti i comandi partono dalla radice.

```sh
pnpm install                                   # dipendenze di tutto il workspace
pnpm dev                                       # app web su http://localhost:3000
pnpm build                                     # build di produzione dell'app web
pnpm typecheck                                 # tsc su ogni pacchetto e sull'app
pnpm lint                                      # ESLint e controllo Prettier
pnpm format                                    # applica Prettier
pnpm test                                      # test unitari Vitest di tutti i pacchetti
pnpm test packages/domain/src/isbn.test.ts     # un solo file di test
pnpm test:e2e                                  # Playwright su viewport mobile e desktop
pnpm tokens                                    # rigenera tokens.css e tailwind.css da tokens.json
pnpm icons                                     # rigenera le icone dell'app dalla topina segnaposto e dai token
pnpm db:start                                  # Supabase locale in Docker (Studio su http://localhost:54323)
pnpm db:stop                                   # ferma i container
pnpm db:reset                                  # ricrea il database locale da migrazioni e seed.sql
pnpm db:test                                   # test pgTAP in supabase/tests/
pnpm db:types                                  # rigenera packages/data/src/database.types.ts dal database locale
```

Il primo `pnpm test:e2e` richiede `pnpm --filter @libresca/web exec playwright install chromium webkit` (WebKit per il progetto iPhone). Gli e2e girano sempre contro lo stack locale (`pnpm db:start`): creano account finti con password, perché Google nei test non c'è. L'app legge un solo `.env.local` nella radice, che in sviluppo punta allo stack locale. I comandi `db:*` richiedono Docker Desktop avviato; `pnpm exec supabase status` mostra URL e chiavi locali. Dopo ogni migrazione: `db:reset`, `db:test`, `db:types`. La CI (`.github/workflows/ci.yml`) ripete su ogni PR typecheck, lint, test unitari, test pgTAP, e2e e controlla che `database.types.ts` sia aggiornato. La CLI agisce sul database locale salvo `--remote`: `pnpm exec supabase db push --remote` applica le migrazioni al progetto remoto e richiede la conferma esplicita dell'utente.

Struttura: `apps/web` (Next.js), `packages/domain`, `packages/data`, `packages/metadata` (fonti dei metadati, solo lato server; `@libresca/metadata/client` per tipi e funzioni pure usabili nel browser), `packages/i18n`, `packages/tokens`, `supabase/` (config, migrazioni, test pgTAP, seed). I pacchetti esportano sorgenti TypeScript e l'app li compila: non c'è un passo di build per i pacchetti.

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
- La UI usa solo token semantici: niente colori o font scritti a mano nei componenti. Tailwind espone solo i token (`bg-surface`, `text-text-muted`, `p-4`, `rounded-card`); la tipografia passa dalle classi `.type-*`. ESLint blocca i colori esadecimali nell'app, le spaziature fuori dalla scala dei token (`pl-12`, `inset-0`: usa un passo 1-6 o 8, oppure un valore arbitrario come `inset-[0]`) e gli import di Next.js o React DOM nei pacchetti.
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
- Il design system è `docs/design/DESIGN_SYSTEM.md` con i token di `packages/tokens/`: non inventare colori, font o stili fuori da lì. Dopo aver cambiato `tokens.json` lancia `pnpm tokens` e `pnpm test packages/tokens`. Le creature definitive arrivano con la D4: fino ad allora solo i segnaposto in `docs/design/assets/motivi/`.

## Come lavoriamo

- Procedi per fette verticali piccole, un task della roadmap alla volta (`/fetta-verticale`).
- Lavora su un branch, mai direttamente su `main`.
- Prima di dire che un task è finito, esegui i controlli e prova la funzione davvero, anche in viewport mobile quando c'è UI. Uno Stop hook (`.claude/hooks/typecheck-on-stop.mjs`) blocca la fine del turno se ci sono file TypeScript o JSON modificati e `pnpm typecheck` fallisce.
- A fine task aggiorna la roadmap. Se scopri che il piano è sbagliato, dillo e proponi la modifica.
