# 🍄 Libresca

La libreria condivisa di una cerchia di amici: cosa possiedi, cosa hai letto, cosa hanno gli altri e cosa leggere dopo. Dentro una tana di funghi, topini e creaturine.

> **Stato:** fase di progettazione, nessun codice. I progressi stanno in [docs/ROADMAP.md](docs/ROADMAP.md).

## Cosa farà

- **La Tana:** libri posseduti e letti, scaffali, scanner del codice a barre, import da Goodreads
- **Il Bosco:** librerie degli amici, "chi ce l'ha?", prestiti, idee regalo
- **Le Spore:** consigli diretti tra amici
- **Il Micelio:** consigli automatici che spiegano sempre il perché
- **I tuoi dati:** export completo, sempre

## Documentazione

| Documento | Contenuto |
|---|---|
| [PRODUCT](docs/PRODUCT.md) | Visione e perimetro |
| [ROADMAP](docs/ROADMAP.md) | Fasi, task e decisioni aperte |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Stack, servizi, fonti dei dati |
| [DATA_MODEL](docs/DATA_MODEL.md) | Modello dati e visibilità |
| [RECOMMENDER](docs/RECOMMENDER.md) | Progetto del recommender |
| [DESIGN_BRIEF](docs/design/DESIGN_BRIEF.md) | Direzione estetica |
| [ADR](docs/adr/) | Decisioni motivate |

## Riprendere il lavoro da VS Code

1. Clona la repo e aprila in VS Code (1.94 o successiva).
2. Installa l'estensione **Claude Code** e accedi con il tuo account.
3. Accetta il dialogo di fiducia della cartella, così le impostazioni della repo si attivano.
4. Nel pannello di Claude scrivi `/prossimo-passo`.

Per iniziare lo sviluppo vero (F0.3) serviranno anche Node.js LTS, pnpm, Docker per Supabase locale e, dalla F3, Python con uv.

### Skill disponibili

| Comando | A cosa serve |
|---|---|
| `/prossimo-passo` | Legge roadmap e repo, propone cosa fare ora |
| `/fetta-verticale` | Porta un task dalla migrazione alla UI, con verifiche |
| `/migrazione-db` | Crea migrazioni Supabase con RLS e test |
| `/metadati-libri` | Regole per fonti, ISBN, copertine e import |
| `/recommender` | Sviluppo e valutazione del Micelio |
| `/ui-sottobosco` | Costruisce UI coerente con il design system |

## Design

La direzione visiva si sviluppa in una chat dedicata del progetto Claude, a partire dal [brief](docs/design/DESIGN_BRIEF.md).
