---
name: prossimo-passo
description: Orienta una sessione su Libresca leggendo roadmap e stato della repo, poi propone il prossimo task. Usala a inizio sessione o quando si chiede da dove riprendere, cosa manca o qual è il prossimo step.
argument-hint: "[id task, es. F1.4]"
allowed-tools: Bash(git status *) Bash(git log *) Bash(git branch *)
---

# Prossimo passo

Stato della repo:

- Branch: !`git branch --show-current`
- Modifiche: !`git status --short`
- Ultimi commit: !`git log --oneline -8`

Task richiesto: $ARGUMENTS

## Procedura

1. Leggi `docs/ROADMAP.md`, in particolare stato attuale e decisioni aperte.
2. Confronta la roadmap con la repo reale. Se una casella non corrisponde al codice, segnalalo.
3. Scegli il task: quello indicato sopra o, se manca, il primo non completato le cui dipendenze sono soddisfatte.
4. Leggi solo i documenti che servono al task.
5. Rispondi in modo breve con:
   - dove siamo, in due righe
   - il task proposto e cosa consegnerà
   - eventuali decisioni che servono all'utente
   - i primi passi concreti
6. Attendi conferma prima di modificare file, salvo richiesta esplicita di procedere.

Se ci sono decisioni aperte che bloccano il task, poni solo quelle, ciascuna con una raccomandazione. Se un task è **L**, proponi prima come spezzarlo.
