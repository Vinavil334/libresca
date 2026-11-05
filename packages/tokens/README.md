# @libresca/tokens

I token del design system Sottobosco. `tokens.json` è la sorgente unica; tutto il resto si genera da lì.

| File | Cosa | Si modifica a mano? |
|---|---|---|
| `tokens.json` | Colori per tema (`giorno`, `notte`), tipografia, spazi, raggi, ombre, bordi, durate, curve | Sì |
| `tokens.css` | Variabili CSS (`--color-surface`…) e classi tipografiche (`.type-display-xl`…) | No, si rigenera |
| `scripts/build-css.mjs` | Generatore senza dipendenze | Solo per cambiare il formato |
| `scripts/build-css.test.mjs` | Nomi minimi del brief, temi completi, contrasto AA, CSS aggiornato | Insieme ai token |

## Comandi

```sh
node packages/tokens/scripts/build-css.mjs           # rigenera tokens.css
node packages/tokens/scripts/build-css.mjs --check   # errore se tokens.css non è aggiornato
node --test packages/tokens/scripts/build-css.test.mjs
```

Con la F0.3 diventeranno script del workspace pnpm e il controllo entrerà nella CI della F0.5.

## Formato

Lo stesso del design system su Claude: ogni famiglia è una lista `{"tokens": [{"name", "value", "usage"}]}`; i colori e le ombre hanno un valore per tema; `"{color-accent}"` è un alias. Ogni token ha una nota d'uso che dice dove si usa e su quali fondi si legge. Se cambi un valore, aggiornalo anche nel design system (o viceversa) e rigenera il CSS.

## Temi

`tokens.css` applica `giorno` su `:root` e `[data-theme="giorno"]`, `notte` su `[data-theme="notte"]` e, se l'utente non ha scelto, segue `prefers-color-scheme: dark`.

## App mobile

Il pacchetto non dipende da nulla del browser: in F5 lo stesso `tokens.json` genererà un modulo per React Native.
