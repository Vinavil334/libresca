# Modello dati

Bozza del modello logico, da tradurre in migrazioni durante F1 e F2. I nomi di tabelle e colonne sono in inglese.

## Le tre idee centrali

1. **Opera, edizione, copia.** *Il nome della rosa* è un'opera; la tascabile Bompiani del 2012 è un'edizione; il volume sul tuo scaffale è una copia. Voti e consigli riguardano l'opera; ISBN e copertine l'edizione; proprietà e prestiti la copia.
2. **Possedere e leggere sono indipendenti.** `copies` e `readings` non si referenziano: un libro può stare in una, nell'altra o in entrambe.
3. **Ogni lettura è un evento.** Una riga per ogni lettura: una rilettura è una riga nuova, con le sue date e il suo voto.

## Convenzioni per poter crescere

- ID in UUID, generabili anche dal client: una futura app mobile potrà creare dati offline.
- `created_at` e `updated_at` sulle tabelle personali, utili alla sincronizzazione.
- Nessuna tabella "cerchia": le relazioni sono tra coppie di persone, quindi l'apertura al pubblico non cambia il modello.
- Lingua esplicita su edizioni e profili. L'interfaccia mostra, quando esiste, l'edizione nella lingua dell'utente.

```mermaid
erDiagram
  profiles ||--o{ copies : possiede
  profiles ||--o{ readings : legge
  profiles ||--o{ shelves : organizza
  profiles }o--o{ profiles : friendships
  works ||--o{ editions : ha
  works }o--o{ authors : work_authors
  editions }o--o{ contributors : edition_contributors
  editions ||--o{ external_ids : identificata_da
  editions ||--o{ copies : esemplare_di
  works ||--o{ readings : riguarda
  shelves ||--o{ shelf_items : contiene
  works ||--o{ shelf_items : inclusa_in
  copies ||--o{ loans : prestata_con
  profiles ||--o{ spores : invia
  works ||--o{ spores : consiglia
  works ||--o| work_embeddings : rappresentata_da
  profiles ||--o{ reco_candidates : riceve
  reco_candidates ||--o{ reco_events : genera
```

## Catalogo condiviso

| Tabella | Colonne principali | Note |
|---|---|---|
| `works` | `id`, `title`, `original_title`, `original_language`, `first_published_year`, `description`, `field_sources`, `merged_into`, `created_by` | `merged_into` permette di unire doppioni senza rompere riferimenti. `description` solo da fonti aperte o scritta dall'utente, mai da Google Books: un vincolo lo impedisce (ADR-0008) |
| `editions` | `id`, `work_id`, `title`, `isbn13`, `language`, `publisher`, `published_year`, `format`, `page_count`, `cover_source`, `cover_id`, `cover_path`, `metadata_status`, `field_sources`, `created_by` | `isbn13` unico quando presente, con cifra di controllo verificata anche dal database; molti libri vecchi non lo hanno. `cover_source` vale `openlibrary`, `googlebooks`, `upload` o `generated` (`NULL`: ancora nessuna copertina); per Google Books `cover_id` è l'ID del volume e l'immagine si carica dal vivo. `format`: `hardcover`, `paperback`, `ebook`, `audiobook`, `other`. `metadata_status`: `incomplete` (da ritentare sulle fonti aperte) o `complete` |
| `authors` | `id`, `name`, `sort_name`, `alternate_names`, `merged_into`, `created_by` | `alternate_names` raccoglie traslitterazioni e grafie originali: Open Library scrive alcuni autori stranieri nel loro alfabeto. `sort_name` ("Eco, Umberto") è proposto da `authorSortName` in `packages/domain` e resta modificabile. Anche gli autori doppioni si uniscono con `merged_into` |
| `work_authors` | `work_id`, `author_id`, `position` | |
| `contributors` | `edition_id`, `name`, `role`, `position` | Traduttori e curatori: contano molto nell'editoria italiana. `role`: `translator`, `editor`, `illustrator`, `introduction`, `other` |
| `external_ids` | uno solo tra `work_id`, `edition_id`, `author_id`; `source`, `value`, `raw` | Provenienza e payload grezzo. `source`: `openlibrary`, `googlebooks`, `sbn`, `goodreads`. Lo stesso ID di una fonte non può puntare a due righe dello stesso tipo. Per `googlebooks` solo l'ID del volume di un'edizione, con `raw` vuoto: i termini vietano copie permanenti (ADR-0008) |

`field_sources` dice da quale fonte viene ogni campo, per esempio `{"title": "sbn", "page_count": "googlebooks"}`; i valori ammessi sono quelli di `metadata_source`, cioè le fonti più `user`. Serve al job che sostituirà i dati di Google Books con dati aperti. `created_by` registra chi ha aggiunto la riga e diventa `NULL` se l'account viene cancellato.

Il catalogo è leggibile solo dagli account attivi. Nessuno lo scrive direttamente: le aggiunte passano da `public.create_edition(entry)`, che controlla l'account, crea in una sola transazione opera (o usa una esistente), autori, edizione, contributori e ID esterni, e restituisce `work_id` ed `edition_id`. La forma di `entry` è validata prima da `validateCatalogEntry` in `packages/domain`, e il database ripete i controlli essenziali. La funzione non abbina autori per nome: chi la chiama passa l'`id` di un autore esistente o i dati di uno nuovo, perché un falso abbinamento è peggio di un doppione.

`public.search_works(query, max_results)` cerca nei titoli delle opere, nei titoli delle edizioni e in tutti i nomi degli autori, senza badare a maiuscole e accenti (`pg_trgm` e `unaccent`). Mette prima le corrispondenze esatte di una sottostringa, poi quelle approssimate, e salta le opere unite.

## Dati personali

| Tabella | Colonne principali | Note |
|---|---|---|
| `profiles` | `id` (da `auth.users`), `handle`, `display_name`, `avatar_creature`, `locale`, `status` | `status`: `pending`, `active`, `suspended`. Creato da un trigger alla registrazione, `pending` o `active` secondo `signup_mode`. L'utente modifica solo `handle`, `display_name`, `avatar_creature` e `locale` |
| `friendships` | `user_low`, `user_high`, `status`, `requested_by`, `created_at` | Una sola riga per coppia, con vincolo `user_low < user_high` |
| `invites` | `code`, `created_by`, `expires_at`, `used_by` | Riscattare un invito attiva l'account |
| `app_settings` | `key`, `value` | Contiene `signup_mode`: `invite_only` oppure `open` |
| `copies` | `id`, `owner_id`, `edition_id`, `format`, `condition`, `location`, `is_lendable`, `acquired_at`, `visibility`, `notes` | Più copie possibili, anche della stessa edizione |
| `readings` | `id`, `user_id`, `work_id`, `edition_id?`, `status`, `started_on`, `finished_on`, `rating_half`, `review`, `visibility` | `status`: `want`, `reading`, `read`, `abandoned` |
| `shelves` | `id`, `owner_id`, `name`, `kind`, `visibility`, `position` | |
| `shelf_items` | `shelf_id`, `work_id`, `position` | |
| `wishes` | `user_id`, `work_id`, `note`, `priority`, `visibility` | Distinto da "da leggere": desidero possederlo |
| `import_jobs` | `id`, `user_id`, `source`, `status`, `total`, `done`, `report` | Import ripristinabili |
| `import_rows` | `job_id`, `raw`, `match_status`, `work_id?` | Revisione delle corrispondenze dubbie |

`started_on` e `finished_on` sono facoltative: l'export Goodreads non contiene la data di inizio e a volte nemmeno quella di fine. Una data sconosciuta resta `NULL`, mai stimata.

`rating_half` va da 1 a 10: mezzo funghetto per unità. Si evitano così i decimali nel database. Vale `NULL` quando manca il voto: un libro senza voto è diverso da un voto basso.

## Sociale

| Tabella | Colonne principali | Note |
|---|---|---|
| `loans` | `id`, `copy_id`, `borrower_id?`, `borrower_name?`, `status`, `requested_at`, `lent_on`, `due_on`, `returned_on` | Vincolo: una sola riga aperta per copia. Esattamente uno tra `borrower_id` e `borrower_name` |
| `spores` | `id`, `from_user`, `to_user`, `work_id`, `note`, `status`, `created_at` | Il segnale più forte per il recommender |
| `activity` | `id`, `actor_id`, `verb`, `object_type`, `object_id`, `visibility`, `created_at` | Feed; filtrato dalla RLS |
| `notifications` | `id`, `user_id`, `kind`, `payload`, `read_at` | |
| `blocks`, `reports` | Da progettare in F5 | Necessarie prima dell'apertura al pubblico |

## Recommender

| Tabella | Colonne principali | Note |
|---|---|---|
| `work_embeddings` | `work_id`, `model`, `embedding` | Il modello è esplicito: si possono ricalcolare senza confusione |
| `reco_candidates` | `id`, `user_id`, `work_id`, `score`, `reasons`, `sources`, `model_version`, `generated_at` | Riscritta dal batch; `reasons` è JSON strutturato, non testo libero |
| `reco_events` | `id`, `user_id`, `work_id`, `event`, `surface`, `model_version`, `created_at` | `shown`, `opened`, `saved`, `dismissed`, `started`, `finished` |

I log `reco_events` partono in F2.9, prima del modello: i dati persi non si recuperano.

## Regole di visibilità

`visibility` vale `private`, `friends` o `public`. Il default è `friends`. `public` esiste già nello schema, ma l'interfaccia lo propone solo dopo l'apertura al pubblico.

| Dato | Proprietario | Amico | Altri utenti |
|---|---|---|---|
| Copia o lettura `friends` | Vede e modifica | Vede | Non vede |
| Copia o lettura `private` | Vede e modifica | Non vede | Non vede |
| Prestito | Vede e modifica | Il beneficiario vede il proprio | Non vede |
| Spora | Mittente e destinatario | Non vede | Non vede |
| Consigli personali | Vede | Non vede | Non vede |

Regole derivate:

- "Chi ce l'ha?" mostra solo copie `friends` di amici.
- Il recommender non deve rivelare nulla di privato: un dato `private` non compare mai nelle spiegazioni e non alimenta i consigli per altri.
- L'export personale comprende tutto ciò che è dell'utente, anche i dati `private`.

## Indici

- `editions(isbn13)` univoco parziale; `editions(work_id)`.
- `copies(owner_id)`, `copies(edition_id)`.
- `readings(user_id, status)`, `readings(work_id)`.
- Ricerca testuale su titoli di opere ed edizioni e nomi degli autori con indici GIN trigram su `private.search_text()` (minuscole, senza accenti).
- `work_embeddings` con indice HNSW quando il volume lo giustifica.
- Indici su tutte le colonne usate nelle policy RLS.
