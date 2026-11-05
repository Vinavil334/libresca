---
paths:
  - "supabase/**"
---

# Database

- Non modificare migrazioni già applicate al database remoto.
- Ogni tabella nel schema `public` ha RLS attiva e test delle policy.
- Non disattivare la RLS per far passare un test: correggi la policy.
- Nessun dato reale in `seed.sql` o nei test.
- Prima di lavorare qui, usa la skill `migrazione-db`.
