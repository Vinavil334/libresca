# Brief di design

Punto di partenza per la chat di design. Niente qui è definitivo: sono proposte da accettare, cambiare o buttare.

## La sensazione

Una **tana accogliente sotto le radici**, piena di libri, dove qualche creaturina ha appena lasciato in giro una tazza e una ghianda. Calda, artigianale, un po' dispettosa. Come un taccuino di un naturalista che studia un bosco inventato.

- **Sì:** illustrato a mano, inchiostro e acquerello, carta, muschio, lanterne, piccoli dettagli da scoprire.
- **No:** infantile, zuccheroso, gamification da app per bambini, stock art, sfumature da startup.

L'idea guida viene dall'italiano: chi ama i libri è un **topo di biblioteca**.

## Regola d'oro

**La fantasia sta nella cornice, le informazioni restano chiare.** Titoli, date, voti e stati di un prestito si leggono al primo sguardo. L'incanto vive in stati vuoti, transizioni, conferme, intestazioni e angoli dello schermo.

## Personaggi proposti

| Creatura | Ruolo |
|---|---|
| **Topina bibliotecaria** | Mascotte e guida; accoglie e accompagna l'onboarding |
| **Funghetti** | Unità di voto, da mezzo a cinque |
| **Lumaca** | Prestiti in ritardo: lenta, ma senza rimprovero |
| **Tarlo** | Errori e 404: "il tarlo ha mangiato questa pagina" |
| **Lucciole** | Notifiche e guida nella modalità scura |
| **Spore** | Consigli che viaggiano tra amici |

Ogni amico può scegliere una creatura come avatar invece di una foto.

## Vocabolario proposto

Ogni parola compare accanto a quella comune la prima volta ("La tua Tana · la tua libreria"). Il vocabolario finale verrà centralizzato nei file dei testi.

| Parola | Significato |
|---|---|
| Tana | La tua libreria |
| Bosco | Gli amici e le loro attività |
| Dispensa | Libri da leggere |
| Spora | Consiglio diretto da un amico |
| Micelio | Consigli automatici |
| Funghetti | Voto |
| Fungo raro | Consiglio inaspettato |

Tono dei testi: italiano semplice, gentile, ironico quanto basta. Mai colpevolizzare: "questo libro ti aspetta", non "hai 42 libri non letti".

## Schermate da progettare

In ordine di priorità:

1. Tana: griglia dei libri, scaffali, filtri
2. Scheda libro: posseduto, letto, voto, note, chi ce l'ha
3. Aggiunta libro: scanner, ricerca, inserimento manuale
4. Copertina generata per i libri senza immagine
5. Stati vuoti e onboarding
6. Bosco e tana di un amico
7. Prestiti
8. Invio e ricezione di una spora
9. Consigli con spiegazione del perché

## Vincoli

- **Mobile first:** uso con una mano, in piedi davanti a uno scaffale.
- **Copertine:** devono convivere con immagini di qualsiasi colore e qualità, e con griglie da centinaia di libri.
- **Modalità chiara e scura:** la scura può essere il bosco di notte, con le lucciole.
- **Accessibilità:** contrasto WCAG AA, target tattili ampi, supporto a `prefers-reduced-motion`; mai il solo colore per dare un'informazione.
- **App mobile futura:** oggi è una web app, ma la direzione deve funzionare anche in un'app nativa. Niente che dipenda da effetti disponibili solo nel browser.
- **Più lingue:** l'italiano viene prima, ma i layout devono reggere testi più lunghi. Tana, Spora e le altre parole andranno adattate, non tradotte alla lettera.
- **Prestazioni:** illustrazioni SVG leggere, animazioni CSS dove possibile, font in numero minimo.
- **Originalità:** creature e illustrazioni originali, senza imitare personaggi, illustratori o opere esistenti. A differenza del codice, restano riservate (vedi `ASSETS_LICENSE.md`): assicurati di avere i diritti su tutto ciò che entra in repo. Font con licenza compatibile per un'app web.

## Cosa deve uscire dalla chat di design

1. Direzione visiva scelta, con esempi applicati ad almeno due schermate.
2. Design system: palette, tipografia, spaziature, raggi, ombre, movimento, componenti base.
3. Token esportati in CSS, con nomi semantici.
4. Schermate prioritarie per mobile.
5. Regole di uso delle creature e vocabolario finale.

### Come rientra in repo

- Token: `packages/tokens/tokens.json` come sorgente, da cui si genera il CSS di `apps/web`. Solo nomi semantici.
- Asset: `apps/web/public/creatures/`, SVG ottimizzati.
- Regole sintetiche: `docs/design/DESIGN_SYSTEM.md`.

Nomi minimi attesi per i token, nella forma CSS:

```css
:root {
  --color-surface: ;
  --color-surface-raised: ;
  --color-text: ;
  --color-text-muted: ;
  --color-accent: ;
  --color-border: ;
  --color-success: ;
  --color-warning: ;
  --color-danger: ;
  --font-display: ;
  --font-body: ;
  --radius-card: ;
  --shadow-card: ;
  --motion-gentle: ;
}
```

## Domande per la chat di design

- Illustrazione più ingenua o più botanica e raffinata?
- Le texture di carta restano in tutta l'app o solo nei momenti speciali?
- Quanto deve "vivere" l'interfaccia: creature animate o solo apparizioni discrete?
- Il logo è un marchio con creatura o un lettering disegnato?
- Come si producono le illustrazioni: disegnate da te, commissionate, generate e poi ridisegnate?

## Prompt per aprire la chat

```text
Lavoriamo alla traccia design di Libresca (D0 in ROADMAP.md). Leggi DESIGN_BRIEF.md
nel progetto. Proponimi tre direzioni visive molto diverse, ciascuna applicata alla
Tana su mobile e alla scheda di un libro, poi scegliamo insieme. Il risultato finale
dovrà diventare un design system riutilizzabile.
```
