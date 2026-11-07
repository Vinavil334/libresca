# @libresca/tokens

I token del design system Sottobosco. `tokens.json` è la sorgente unica; tutto il resto si genera da lì.

| File | Cosa | Si modifica a mano? |
|---|---|---|
| `tokens.json` | Colori per tema (`giorno`, `notte`), tipografia, spazi, raggi, ombre, bordi, durate, curve | Sì |
| `tokens.css` | Variabili CSS (`--color-surface`…) e classi tipografiche (`.type-display-xl`…) | No, si rigenera |
| `tailwind.css` | Tema Tailwind 4 che espone solo i token: `bg-surface`, `text-text-muted`, `p-4`, `rounded-card`, `shadow-card`, `ease-gentle`. Azzera palette, scale e font di default | No, si rigenera |
| `scripts/build-css.mjs` | Generatore senza dipendenze | Solo per cambiare il formato |
| `scripts/build-css.test.mjs` | Nomi minimi del brief, temi completi, contrasto AA, tema Tailwind, file generati aggiornati | Insieme ai token |

## Comandi

Dalla radice della repo:

```sh
pnpm tokens                               # rigenera tokens.css e tailwind.css
pnpm --filter @libresca/tokens check      # errore se uno dei due non è aggiornato
pnpm test packages/tokens                 # test del pacchetto
```

Il controllo entrerà nella CI della F0.5.

## Uso nell'app web

`apps/web/src/app/globals.css` importa nell'ordine `tailwindcss`, `tokens.css` e `tailwind.css`. Il tema usa `@theme inline reference`: le classi puntano direttamente alle variabili di `tokens.css` e Tailwind non le ridichiara, perché avrebbero lo stesso nome e diventerebbero circolari. I font arrivano da `next/font`, che sovrascrive `--font-display` e `--font-body` sul `<body>` con i file serviti dal sito.

## Formato

Lo stesso del design system su Claude: ogni famiglia è una lista `{"tokens": [{"name", "value", "usage"}]}`; i colori e le ombre hanno un valore per tema; `"{color-accent}"` è un alias. Ogni token ha una nota d'uso che dice dove si usa e su quali fondi si legge. Se cambi un valore, aggiornalo anche nel design system (o viceversa) e rigenera il CSS.

## Temi

`tokens.css` applica `giorno` su `:root` e `[data-theme="giorno"]`, `notte` su `[data-theme="notte"]` e, se l'utente non ha scelto, segue `prefers-color-scheme: dark`.

## App mobile

Il pacchetto non dipende da nulla del browser: in F5 lo stesso `tokens.json` genererà un modulo per React Native.
