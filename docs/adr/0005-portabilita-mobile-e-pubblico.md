# ADR-0005: Costruire ora per mobile e pubblico

- **Stato:** Accettata
- **Data:** 2026-11-05

## Contesto

All'inizio Libresca è una web app su invito, a costo zero e in italiano. In futuro deve poter diventare un'app mobile, aprirsi al pubblico e parlare altre lingue. Ottimizzare subito per milioni di utenti sarebbe uno spreco, ma alcune scelte iniziali sono costose da cambiare: dove sta la logica, come si autenticano i client, come si gestiscono testi e accessi.

## Decisione

Rimandiamo l'infrastruttura, non i confini tra i componenti.

- **Logica condivisa:** regole in `packages/domain`, accesso ai dati in `packages/data`, senza dipendenze da Next.js o React DOM.
- **Backend utilizzabile da ogni client:** dati tramite client Supabase e RLS; operazioni con segreti o servizi esterni in API HTTP versionate `/api/v1`, con token Bearer.
- **Server Actions non strutturali:** una futura app nativa non può usarle come API, quindi restano al massimo piccoli adattatori per il web.
- **Accesso configurabile:** `profiles.status` e `app_settings.signup_mode` governano l'ingresso. Il modello non contiene il concetto di cerchia unica.
- **Lingue da subito:** next-intl, messaggi in `packages/i18n`, lingua nel profilo. All'inizio una sola lingua e nessun prefisso negli URL.
- **Token portabili:** sorgente JSON in `packages/tokens`, CSS generato per il web.
- **App mobile:** Expo in F5, nello stesso monorepo.

## Alternative considerate

- **Sola PWA, senza pensare al mobile:** più veloce all'inizio, ma la logica finirebbe intrecciata con Next.js.
- **Backend separato da subito:** la portabilità sarebbe massima, ma aggiunge un servizio da gestire e probabilmente da pagare.
- **Tutto in Supabase Edge Functions:** molto portabile, ma aggiunge un secondo runtime. Resta possibile, perché il contratto è HTTP.
- **Involucro Capacitor attorno al sito:** economico, ma Apple chiede che un'app vada oltre un sito riconfezionato. Non è la strada principale.

## Conseguenze

- Un po' più di struttura iniziale: pacchetti, schemi di validazione, API versionate.
- Una versione dell'app installata può durare a lungo, quindi i cambi di API dovranno essere compatibili o passare a `/api/v2`.
- Non è prevista alcuna riscrittura del modello dati per aprire al pubblico, ma prima serviranno moderazione, documenti legali, piani a pagamento e un catalogo locale più robusto: la checklist è in F5.
- Le parti dipendenti dal web, come il rendering delle pagine e il service worker, andranno comunque rifatte in Expo.
