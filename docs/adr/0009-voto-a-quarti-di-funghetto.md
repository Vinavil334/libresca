# ADR-0009: Voto a quarti di funghetto

- **Stato:** Accettata
- **Data:** 2026-11-13

## Contesto

Da F1.6 il voto andava da mezzo a cinque funghetti, salvato come `readings.rating_half` da 1 a 10. Con l'import da Goodreads (F1.8) l'utente ha chiesto voti più fini: tra un libro da quattro e uno da cinque c'è spesso un mezzo voto che non basta. Goodreads esporta voti interi da 1 a 5, quindi l'import non perde nulla con nessuna delle due scale.

## Decisione

Il voto va da un quarto a cinque funghetti. La colonna diventa `readings.rating_quarter`, intera da 1 a 20: un quarto di funghetto per unità. La migrazione raddoppia i voti già salvati senza toccare `updated_at`. Nell'app si tocca un funghetto per dargli quel valore, e ogni nuovo tocco sullo stesso funghetto toglie un quarto (4, 3¾, 3½, 3¼, poi di nuovo 4); il valore si legge come numero, "4,25 funghetti".

## Alternative considerate

- **Tenere i mezzi funghetti:** più semplice da toccare, ma non dà la sfumatura chiesta.
- **Decimi o decimali nel database:** troppa precisione per un voto personale, e i decimali in Postgres complicano confronti e statistiche. I quarti restano interi.
- **Una colonna nuova accanto a quella vecchia:** due fonti di verità per lo stesso voto.

## Conseguenze

- Il funghetto si disegna riempito per quarti; il voto compatto e il badge mostrano il numero.
- Il Micelio legge `rating_quarter` (1-20): le soglie come "voto alto" vanno espresse in quarti.
- Un import da altre app con voti a mezzi o interi si converte moltiplicando per 4 o per 2.
