# ADR-0006: Login Google e inviti a costo zero

- **Stato:** Accettata
- **Data:** 2026-11-05

## Contesto

Il piano iniziale prevedeva il login con magic link. Le email integrate di Supabase, però, arrivano solo ai membri del team del progetto, con un limite di 2 all'ora: gli amici non le riceverebbero. Un SMTP esterno funziona bene solo con un dominio di invio proprio, che oggi vogliamo evitare.

## Decisione

Login con Google tramite Supabase. L'autenticazione identifica la persona; il permesso di usare l'app dipende invece da `profiles.status`. Con `signup_mode = invite_only`, un account nasce `pending` e diventa `active` riscattando un invito. Con `open`, diventa attivo subito.

## Alternative considerate

- **Magic link con SMTP esterno:** comodo per chi non vuole usare Google, ma comporta dominio, configurazione e deliverability. Si riprende in F5.
- **Password:** il recupero password richiede comunque l'invio di email.
- **Lista di email autorizzate con hook Before User Created:** è disponibile anche nel piano gratuito, ma l'invito via link è più semplice e funziona con qualsiasi metodo di login.

## Conseguenze

- Nessun costo e nessuna email da inviare.
- Gli amici devono avere un account Google. Se qualcuno ne fosse privo, andrà riaperto il tema SMTP.
- Una configurazione iniziale in Google Cloud.
- Su iOS, chi usa Google come login principale deve offrire un'alternativa equivalente attenta alla privacy: è un requisito della F5.
- Le policy devono controllare `status`: una persona autenticata ma non attiva non vede nulla.
