# ADR-0007: Licenza MIT per il codice, identità riservata

- **Stato:** Accettata
- **Data:** 2026-11-05

## Contesto

La repo è pubblica e l'app potrebbe arrivare sull'App Store. La priorità indicata è evitare ostacoli a quella distribuzione. L'estetica è l'elemento più distintivo del progetto.

## Decisione

Codice sotto licenza MIT. Nome, logo, illustrazioni, creature e testi dell'app restano riservati, come indicato in `ASSETS_LICENSE.md`. Nel prodotto entrano solo dipendenze con licenze permissive, come MIT, Apache-2.0, BSD e ISC.

## Alternative considerate

- **AGPL-3.0:** protegge dai servizi chiusi basati sul codice, ma la famiglia GPL ha un conflitto noto con i termini dell'App Store: nel caso VLC la Free Software Foundation sostenne che fossero incompatibili con la GPLv2. Il titolare può aggirarlo finché il codice è solo suo, ma resta un attrito, soprattutto con contributi esterni.
- **Nessuna licenza:** non crea problemi sull'App Store, ma nessun altro può riusare o contribuire al codice in modo chiaro.

## Conseguenze

- Il codice può essere pubblicato sull'App Store senza clausole in conflitto.
- Chiunque può riusare il codice, anche in prodotti chiusi e commerciali. Le versioni pubblicate restano sotto MIT anche se in futuro la licenza cambiasse.
- La protezione del progetto passa da nome e illustrazioni, non dal codice.
- Va controllata la licenza di ogni nuova dipendenza. Librerie GPL, AGPL o LGPL richiedono una valutazione esplicita: per lo scanner, ad esempio, il polyfill `barcode-detector` è MIT, mentre ZBar non va usato senza verifica.
