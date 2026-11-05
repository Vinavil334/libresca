# Libresca: visione di prodotto

> *libresca* (agg.): "che viene dai libri". E in italiano chi ama leggere è un **topo di biblioteca**: da qui i topini, la tana e tutto il sottobosco.

## In una frase

La libreria condivisa di una cerchia di amici: cosa possiedi, cosa hai letto, cosa hanno i tuoi amici e cosa dovresti leggere dopo. Dentro una tana piena di funghi, topini e creaturine.

## Perché non bastano le app esistenti

| App | Punto forte | Cosa lascia scoperto per noi |
|---|---|---|
| Goodreads | Catalogo enorme | Di Amazon, con pubblicità; API chiuse a nuovi sviluppatori dal dicembre 2020 |
| Fable | Club e contenuti curati | Piattaforma chiusa, senza export della libreria (secondo Literal, che è un concorrente) |
| StoryGraph | Statistiche, mood, metadati strutturati | Parte social volutamente minima |
| Hardcover / Literal | Community indipendenti, buoni dati | Pensate per una community aperta, non per una cerchia di amici |

**Lo spazio che vogliamo occupare** è un'ipotesi, da verificare provando le app: queste app ruotano attorno a *cosa hai letto*. Libresca mette al centro anche *dove stanno fisicamente i libri* nella tua cerchia: chi ce l'ha, a chi l'hai prestato, cosa regalare a un amico senza comprargli un doppione.

## Pilastri

1. **La Tana**: la tua libreria. *Posseduto* e *letto* sono due assi indipendenti: puoi possedere senza aver letto e leggere senza possedere.
2. **Il Bosco**: gli amici, le loro tane, "chi ce l'ha?" e i prestiti.
3. **Le Spore**: consigli diretti da persona a persona, con una nota. Sono il segnale più prezioso dell'app.
4. **Il Micelio**: il recommender. Ogni suggerimento dice sempre *perché*.
5. **I tuoi dati sono tuoi**: export completo in CSV/JSON, sempre, gratis.
6. **L'incanto**: un'estetica che fa venire voglia di aprire l'app.

## Storie principali

- Scansiono il codice a barre di un libro in libreria e in 5 secondi è nella mia Tana.
- Importo la mia libreria da Goodreads senza perdere voti e date.
- Sono in libreria e controllo se ho già quel libro, o se ce l'ha un amico.
- Segno che ho prestato un libro a Luca e me ne ricordo sei mesi dopo.
- Mando a Marta una spora: "questo devi leggerlo", con due righe sul perché.
- Devo fare un regalo a Sara: vedo i suoi desideri, esclusi i libri che ha già.
- Apro i consigli e capisco perché mi viene proposto ogni libro.

## Fuori scopo

- Lettore di ebook, vendita di libri, link di affiliazione.
- Pubblicità o vendita di dati.
- Gamification che mette pressione: niente streak da non interrompere, sensi di colpa o classifiche di lettori.
- Scraping di Goodreads o di altri servizi.
- Community pubblica aperta prima della F5: l'architettura la prevede, ma il prodotto nasce su invito.

## Principi di prodotto

- **Prima l'utilità, poi la meraviglia.** La fantasia sta nella cornice; le informazioni restano chiare. Una parola fantasiosa non sostituisce mai quella comune alla prima occorrenza.
- **Ogni libro è gestibile a mano.** I metadati dei libri italiani saranno a volte incompleti: l'app non deve mai bloccare chi vuole inserire un libro.
- **Privato per scelta, condiviso per default con gli amici.** Ogni copia e lettura può essere nascosta.
- **Mobile first.** Il momento chiave è in piedi davanti a uno scaffale.
- **Costruita per pochi, pronta a crescere.** Si parte con pochi amici su invito: niente infrastruttura prematura, ma nessuna scelta che impedisca di aprirsi al pubblico o di arrivare su mobile.

## Misure di successo

Non sono metriche di crescita, ma domande da farsi dopo qualche mese:

- Ho smesso di aprire Goodreads?
- Almeno 5 amici aggiornano la propria Tana senza che glielo chieda?
- Almeno un prestito è passato dall'app?
- Qualcuno ha letto un libro grazie a una spora o al Micelio?
