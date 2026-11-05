---
name: migrazione-db
description: Crea o modifica lo schema Postgres di Libresca con migrazioni Supabase, policy RLS e test. Usala per tabelle, colonne, indici, funzioni SQL, policy o qualsiasi cambio al database.
---

# Migrazioni database

`supabase/migrations/` è l'unica fonte dello schema. Non modificare mai una migrazione già applicata fuori dal tuo ambiente locale: creane una nuova.

## Procedura

1. Controlla `docs/DATA_MODEL.md`; se il modello cambia, aggiornalo.
2. Crea la migrazione con la CLI di Supabase e un nome descrittivo in inglese.
3. Scrivi tabella, vincoli, indici e policy nello stesso file.
4. Aggiungi i test delle policy in `supabase/tests/`.
5. Ricrea il database locale da zero e lancia i test.
6. Rigenera i tipi TypeScript.
7. Non applicare nulla al database remoto senza conferma esplicita dell'utente.

## Modello per i dati personali

```sql
create table public.copies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  edition_id uuid not null references public.editions(id),
  visibility public.visibility not null default 'friends',
  created_at timestamptz not null default now()
);

create index copies_owner_id_idx on public.copies (owner_id);

alter table public.copies enable row level security;

create policy "copies are readable by owner and allowed friends"
on public.copies for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (visibility = 'friends' and private.are_friends((select auth.uid()), owner_id))
);

create policy "copies are writable by owner"
on public.copies for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
```

## Checklist

- [ ] RLS attiva sulla tabella
- [ ] Ruolo `to authenticated` esplicito; `anon` senza accesso, salvo motivo documentato
- [ ] `with check` presente sulle scritture
- [ ] `auth.uid()` racchiuso in `select`, per farlo valutare una volta sola
- [ ] Indici sulle colonne usate dalle policy
- [ ] Funzioni `security definer` in uno schema non esposto, con `search_path` fissato
- [ ] `on delete` deciso per ogni chiave esterna, verificando la cancellazione dell'account
- [ ] Una riga `private` non è leggibile da un amico
- [ ] Un utente non può creare righe per conto di un altro

## Test minimi

Per ogni tabella personale, verifica con almeno tre identità:

| Identità | Atteso |
|---|---|
| Proprietario | Legge e modifica |
| Amico | Legge solo i dati `friends`, non modifica |
| Sconosciuto autenticato | Non legge nulla |
