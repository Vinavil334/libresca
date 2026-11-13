# Export CSV di Goodreads

Elenco verificato sull'intestazione di un export reale del novembre 2026. Goodreads può cambiarlo: il parser legge le colonne per nome e tollera quelle mancanti.

## Colonne note

`Book Id`, `Title`, `Author`, `Author l-f`, `Additional Authors`, `ISBN`, `ISBN13`, `My Rating`, `Publisher`, `Binding`, `Number of Pages`, `Year Published`, `Original Publication Year`, `Date Read`, `Date Added`, `Bookshelves`, `Bookshelves with positions`, `Exclusive Shelf`, `My Review`, `Spoiler`, `Private Notes`, `Read Count`, `Owned Copies`

Gli export più vecchi avevano anche `Average Rating`, che non si importa.

Leggi le colonne per nome, mai per posizione.

## Mappatura

| Goodreads | Libresca |
|---|---|
| `Exclusive Shelf` = `read` | `readings.status = read` |
| `Exclusive Shelf` = `currently-reading` | `readings.status = reading` |
| `Exclusive Shelf` = `to-read` | `readings.status = want` |
| `My Rating` da 1 a 5 | `rating_quarter` = voto × 4 |
| `My Rating` = 0 | `rating_quarter` = NULL: significa nessun voto |
| `Date Read` | `finished_on`; se è vuota resta `NULL` |
| Non esiste | `started_on` resta `NULL` |
| `Bookshelves` | Crea o riusa `shelves`, escludendo gli scaffali esclusivi |
| `Exclusive Shelf` = `read`, oppure `Owned Copies` > 0 | Una copia: si dà per posseduto ogni libro letto, e l'utente toglie a mano quelli che non ha (decisione dell'utente in F1.8) |
| `Read Count` > 1 | Non inventare date per le riletture: segnalale nel report |
| `Private Notes` | Note con visibilità `private` |

## Particolarità

- **La data di inizio lettura non è nell'export.** Non stimarla: l'utente deve poterla completare in seguito.
- `Date Read` può mancare anche per libri davvero letti. Non sostituirla con `Date Added`: segnala il libro nel report.
- Gli ISBN possono arrivare in forma `="1770460829"`, con il wrapper da foglio di calcolo. Il parser deve rimuoverlo.
- Molte righe possono non avere ISBN; in tal caso cerca per titolo e autore, chiedendo conferma.
- L'edizione esportata può differire da quella che possiedi.
- `Average Rating` cambia nel tempo: non importarlo.
- L'ordine degli scaffali in `Bookshelves` non è affidabile.
- Aprire e salvare il file in Excel può alterare ISBN e date: importa sempre il file originale.
- L'export si scarica da desktop: **My Books → Import and export → Export Library**.
