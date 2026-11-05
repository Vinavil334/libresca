---
name: ui-sottobosco
description: Costruisce interfacce di Libresca coerenti con l'estetica whimsical e il design system. Usala per schermate, componenti, testi, stati vuoti, animazioni e icone.
---

# UI del sottobosco

Se esiste `docs/design/DESIGN_SYSTEM.md`, è la fonte principale. In caso contrario usa `docs/design/DESIGN_BRIEF.md` e tieni la UI neutra, con token provvisori: la direzione visiva viene decisa nella chat di design.

## Principi

- La fantasia sta nella cornice, le informazioni restano chiare.
- Mobile first: progetta prima per il telefono e per l'uso a una mano.
- Riusa i componenti esistenti prima di crearne di nuovi.
- Usa solo token semantici: niente colori, font o spaziature scritte a mano.
- Le creature sono originali e arrivano da `public/creatures/`. Non improvvisare personaggi definitivi e non imitare personaggi esistenti.

## Ogni schermata include

- Stato di caricamento discreto
- Stato vuoto con un invito all'azione
- Stato di errore, con testo gentile e una via d'uscita
- Dati lunghi, mancanti o accentati gestiti senza rompere il layout
- Libri senza copertina, con la copertina generata

## Testi

- Tutti i testi stanno nel file centrale dei messaggi.
- Italiano semplice, gentile, un po' ironico; mai colpevolizzante.
- Le azioni dicono cosa succede: "Aggiungi alla Tana", non "OK".
- La prima volta affianca la parola comune: "La tua Tana · la tua libreria".
- Niente pressioni: "ti aspetta", non "sei indietro".

## Accessibilità

- Contrasto WCAG AA, anche sopra texture e illustrazioni.
- Navigazione da tastiera e focus visibile.
- Target tattili di almeno 44 × 44 px.
- Il voto a funghetti ha un valore testuale per i lettori di schermo.
- Le immagini decorative hanno `alt=""`; le altre hanno una descrizione utile.
- Le animazioni rispettano `prefers-reduced-motion` e non bloccano mai un'azione.

## Verifica

Controlla la schermata a 390 px e a 1280 px, in modalità chiara e scura, con screenshot e con la sola tastiera.
