# Design system: Sottobosco

La direzione visiva scelta in D0 (direzione D, "Sottobosco"): una linoleografia a due lastre resa morbida. Contorni d'inchiostro, ombre piene spostate, angoli tondi, muschio, funghi e qualche creatura che abita la tana.

Questo file contiene le regole sintetiche. I valori stanno in [`packages/tokens/tokens.json`](../../packages/tokens/tokens.json), le icone e i motivi in [`assets/`](assets/). Il riferimento visivo completo, con componenti e anteprime dal vivo, è il design system "Libresca · Sottobosco" e la tela di D0 su Claude (privati, del proprietario della repo).

## Regola d'oro

**La fantasia sta nella cornice, le informazioni restano chiare.** Titoli, autori, date, voti e stati si leggono al primo sguardo, in Bricolage Grotesque e nei colori di testo. L'incanto vive in intestazioni a chioma, stati vuoti, conferme, lucciole e angoli.

## Token

Usa solo token semantici: niente colori, font, raggi o ombre scritti a mano.

| Ruolo | Token |
|---|---|
| Fondo, schede | `--color-surface`, `--color-surface-raised` |
| Testo | `--color-text`, `--color-text-muted`, `--color-link` |
| Contorno d'inchiostro | `--color-border` con `--border-ink` (2px); divisori `--color-rule` con `--border-rule` |
| Azione principale | `--color-accent` con `--color-on-accent`: una per schermata, più Scansiona |
| Chioma delle intestazioni | `--color-canopy` con `--color-on-canopy` |
| In movimento, chiede attenzione | `--color-honey` con `--color-on-honey` (mai come testo) |
| Biglietti (prestiti, spore) | `--color-ticket` con bordo `--border-dash` |
| Perché di un consiglio | `--color-why` |
| Selezione, prestito lungo | `--color-inverse` con `--color-on-inverse` |
| Stati | `--color-success`, `--color-warning`, `--color-danger`, sempre con icona e parola |
| Focus | outline 3px `--color-focus`, offset 2px |
| Tipografia | `--font-display` (Fraunces), `--font-body` (Bricolage Grotesque), classi `.type-*` |
| Spazi | `--space-1` … `--space-8` (4–32px) |
| Raggi | `--radius-cover` 6, `--radius-card` 18, `--radius-square` 22, `--radius-sheet` 30, `--radius-pill` |
| Ombre | `--shadow-card`, `--shadow-lift` (piene, mai sfumate), `--shadow-glow` (lucciole, solo notte) |
| Movimento | `--motion-gentle` 220ms, `--motion-quick`, `--motion-slow`; curve `--ease-gentle`, `--ease-pop` |

Temi: `giorno` (avena e muschio) e `notte` (prugna, muschio scuro, lucciole). Si sceglie con `data-theme` sulla radice; senza scelta segue il sistema. Ogni coppia testo/fondo è AA in entrambi i temi: lo verificano i test di `packages/tokens`.

## Tipografia

- Fraunces solo per titoli di schermata (`display-xl`), titoli di libri (`display-l`, `title`, `title-s`), intestazioni di sezione in corsivo (`heading`) e note (`note`). Sempre con `font-variation-settings: 'SOFT' 100, 'WONK' 1` (lo fanno le classi `.type-*`).
- Bricolage per tutto il resto: `body`, `body-strong`, `small`, `label`, `nav`; `stamp` in maiuscolo solo per timbri rari.
- Entrambi da Google Fonts, licenza OFL. Due famiglie in tutto.
- I titoli lunghi vanno a capo, non si troncano. I layout reggono testi più lunghi del 30%.

## Forme e movimento

- Contorno d'inchiostro 2px su schede, righe, bottoni, copertine, campi, avatar. Ombre piene spostate su ciò che si tocca; alla pressione rientrano.
- Il bordo a smerlo chiude solo le intestazioni a chioma.
- Target tattili di almeno 44×44px; bottoni principali 48–56px; testo dei campi 16px.
- Movimento: `motion-gentle` con `ease-gentle`; `ease-pop` solo per creature e conferme. Con `prefers-reduced-motion` niente movimento. Solo trasformazioni, opacità e ombre: deve funzionare anche in un'app nativa.

## Componenti di base

Definiti nel design system su Claude con anteprime e linee guida; nell'app si ricostruiscono come componenti sottili sugli stessi token.

| Componente | Uso |
|---|---|
| Button | `primary` (uno per schermata), `secondary`, `quiet`; etichetta col verbo: "Aggiungi alla Tana" |
| Chip | Filtri combinabili, `aria-pressed`, miele quando attivo |
| Segmented | Due o tre viste esclusive: "Elenco / Griglia", "Scansiona / Cerca / A mano" |
| StatusPill | `read`, `reading`, `loan`, `pantry`, `late`, `paused` ("Messo da parte"): forma + icona + parola |
| MushroomRating | Voto da mezzo a cinque funghetti, con testo per lettori di schermo |
| BookCover | Copertina 2:3 con contorno; senza immagine, copertina generata stabile dal titolo |
| BookRow | Riga della Tana: copertina, titolo, autore, uno stato, voto |
| Card | Contenitore con intestazione in corsivo; `honey` solo per ciò che chiede risposta |
| LoanTicket | Biglietto tratteggiato del prestito: "In viaggio da Luca · dal 2 ottobre" |
| Avatar | Iniziale in un cerchio, lucciola per le novità; poi la creatura scelta |
| CanopyHeader | Chioma con titolo, sottotitolo, smerlo e funghi; lucciole di notte |
| SearchField | "Ce l'ho già? Cerca…", pillola 52px |
| WhyBox | "Perché te lo consigliamo": 1–3 ragioni concrete |
| NavBar | Tana, Bosco, Scansiona al centro, Micelio, Tu; finché Bosco e Micelio non esistono (F2, F3) solo Tana, Scansiona e Tu |

Posseduto e letto restano sempre due blocchi separati (es. "Ce l'hai" e "Letto 2 volte" nella scheda libro). Le schermate della Tana che usano questi componenti sono descritte in [`SCHERMATE_TANA.md`](SCHERMATE_TANA.md).

## Voce

- Italiano semplice, gentile, ironico quanto basta. Dai del tu. Niente emoji.
- Mai colpevolizzare: "questo libro ti aspetta", "Sara, con calma". Niente streak né classifiche.
- La prima volta affianca la parola comune: "La tua Tana · la tua libreria".

## Vocabolario

| Parola | Significato | Prima volta | Nel codice |
|---|---|---|---|
| Tana | La tua libreria | "La tua Tana · la tua libreria" | `copies` e `readings` dell'utente |
| Bosco | Gli amici e le loro attività | "Il Bosco · i tuoi amici" | `friendships`, feed |
| Dispensa | Libri da leggere | "Dispensa · da leggere" | `readings.status = 'want'` |
| spora | Consiglio diretto da un amico, con una nota | "una spora · un consiglio da un amico" | `spores` |
| Micelio | Consigli automatici, sempre con il perché | "Micelio · consigli per te" | `reco_candidates` (`reasons`) |
| Messo da parte | Lettura interrotta, senza giudizio: mai "abbandonato" | "Messo da parte" | `readings.status = 'abandoned'` |
| funghetti | Il voto, da mezzo a cinque | "4,5 funghetti" | `readings.rating_half` (1–10) |
| Fungo raro | Consiglio inaspettato | "Fungo raro · inaspettato" | candidato di esplorazione |
| In viaggio | Un tuo libro prestato | "In viaggio da Luca" | `loans` aperto |
| Con calma | Prestito lungo, senza rimprovero | "Sara, con calma" | `loans` aperto oltre la soglia |
| lucciola | Notifica | "2 lucciole nuove" | `notifications` |

Frasi della casa: "Ce l'ho già? Cerca…", "Non è ancora nella tua Tana", "Ce l'ha Marta: potresti chiederlo a lei", "Un amico bussa alla tana", "È tornato", "Perché te lo consigliamo", "Il tarlo ha mangiato questa pagina". In altre lingue le parole si adattano, non si traducono alla lettera.

## Creature

| Creatura | Ruolo |
|---|---|
| Topina bibliotecaria | Mascotte e guida: Tana, onboarding, stati vuoti, conferme |
| Funghetti | Unità di voto e motivo delle chiome |
| Lumaca | Prestiti lunghi, senza rimprovero |
| Tarlo | Errori e 404 |
| Lucciole | Notifiche e guida nel tema notte |
| Spore | Consigli tra amici |

- Stile: linoleografia morbida, contorno in `--color-shadow`, campiture piatte nei colori del sistema, puntini bianchi come intagli. Forme da cerchi e mezze lune.
- Una creatura per schermata al massimo; mai sopra titoli, dati o bottoni; mai dentro righe di libri o copertine vere.
- Originali e riservate (`ASSETS_LICENSE.md`). `assets/motivi/topina-provvisoria.svg` è solo un segnaposto per il tono: la mascotte definitiva arriva con la D4.

## Icone

Tratto 2px, griglia 24px, terminali tondi, in [`assets/icons/`](assets/icons/). Nei file l'inchiostro è `#2d2433`; nell'app si usano inline con `stroke="currentColor"`. Ogni icona di stato va con la sua parola; le icone senza testo hanno un `aria-label`.

## Copertine

Le copertine vere si mostrano intere, con contorno e `--radius-cover`, senza filtri. Senza immagine si usa la copertina generata: fondo in uno dei colori `canopy`, `honey`, `inverse`, `accent` scelto dal titolo, cappello di fungo e titolo in Fraunces.
