# Export CSV di Goodreads

Elenco ricostruito da script di terze parti e discussioni su Goodreads, non da una specifica ufficiale. Prima di scrivere il parser, confrontalo con un export reale.

## Colonne note

`Book Id`, `Title`, `Author`, `Author l-f`, `Additional Authors`, `ISBN`, `ISBN13`, `My Rating`, `Average Rating`, `Publisher`, `Binding`, `Number of Pages`, `Year Published`, `Original Publication Year`, `Date Read`, `Date Added`, `Bookshelves`, `Bookshelves with positions`, `Exclusive Shelf`, `My Review`, `Private Notes`, `Read Count`, `Owned Copies`

Leggi le colonne per nome, mai per posizione.

## Mappatura

| Goodreads | Libresca |
|---|---|
| `Exclusive Shelf` = `read` | `readings.status = read` |
| `Exclusive Shelf` = `currently-reading` | `readings.status = reading` |
| `Exclusive Shelf` = `to-read` | `readings.status = want` |
| `My Rating` da 1 a 5 | `rating_half` = voto × 2 |
| `My Rating` = 0 | `rating_half` = NULL: significa nessun voto |
| `Date Read` | `finished_on` |
| `Bookshelves` | Crea o riusa `shelves`, escludendo gli scaffali esclusivi |
| `Owned Copies` > 0 | Proponi la creazione di una copia, chiedendo conferma |
| `Read Count` > 1 | Non inventare date per le riletture: segnalale nel report |
| `Private Notes` | Note con visibilità `private` |

## Particolarità

- Gli ISBN possono arrivare in forma `="1770460829"`, con il wrapper da foglio di calcolo. Il parser deve rimuoverlo.
- Molte righe possono non avere ISBN; in tal caso cerca per titolo e autore, chiedendo conferma.
- L'edizione esportata può differire da quella che possiedi.
- `Average Rating` cambia nel tempo: non importarlo.
- L'ordine degli scaffali in `Bookshelves` non è affidabile.
- Aprire e salvare il file in Excel può alterare ISBN e date: importa sempre il file originale.
- L'export si scarica da desktop: **My Books → Import and export → Export Library**.
