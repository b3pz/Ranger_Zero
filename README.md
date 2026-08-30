# RANGER ZERO v43 — solo grafica: Colosso smussato, capsule arrotondate

## Colosso
Prima ogni pezzo era un `boxMesh` puro — motivo principale del "sembra un ammasso di cubi".
Aggiunte varianti arrotondate (ottagono + cupola, stessa tecnica gia' usata per i caschi dei
Ranger) e applicate ai pezzi piu' grandi e piu' visibili: **gambe, petto, spalle/braccia,
testa** (con cupola vera sopra invece di un tetto piatto). Lasciati come box i pezzi piccoli
o strutturali (piedi, placche sottili, spada, accenti) dove smussare non avrebbe aggiunto
niente. Verificato visivamente: gambe e petto ora mostrano sfaccettature/angoli invece di
spigoli puri.

## Il Raccoglitore
Gia' beneficiava del lavoro fatto sui caschi Ranger (elmo e spallacci sono `octMesh`,
condivisi tramite la stessa funzione `buildBodyParts`) — non serviva toccare altro li'.

## Archivio (richiesto esplicitamente di ricordarlo)
Aggiunta una cupola arrotondata sopra ogni capsula (`capsuleDomeMesh`, stessa tecnica),
invece del tetto piatto di prima. Combinato con la luce e il riempimento gia' fatti nelle
sessioni precedenti, ora la fila di capsule si vede bene: occupanti diversi, monitor con
barre colorate sopra ognuna, cupole non piu' a spigolo vivo.

## Onesta' sui limiti
Il motore ha SOLO geometria piatta (box e ottagoni), niente sfere o curve vere — quello che
ho fatto e' il massimo ottenibile con questa tecnica senza riscrivere il motore di render.
Non ho toccato: gli edifici della citta' nello scontro col Colosso, i moduli animali durante
la chiamata, gli scagnozzi/civili di base. Se dopo aver visto questa versione altre parti
saltano all'occhio come "troppo a cubi", dimmele in ordine di importanza e procedo da li'.

---

# RANGER ZERO v42 — bug spada, movimento Colosso/Raccoglitore, pop del windup

## Bug corretto: "clicco C e parte subito il raggio"
Trovato nel codice: dentro `colossoSpecial()`, quando il colpo finale e' pronto
(`finisherReady`), c'era ANCORA un `colosso.beamBursts.push({t:0,kind:"beam"})` — un
raggio istantaneo lasciato da PRIMA che la sequenza della spada venisse costruita. Scattava
insieme a `startColossoFinish()`, quindi premendo C si vedevano contemporaneamente: il
raggio immediato E, sopra, la sequenza vera (fulmini → spada dal cielo → fendente →
Raccoglitore scagliato indietro). Rimosso il raggio istantaneo — ora parte SOLO la
sequenza vera. **Verificato**: controllato lo stato `beamBursts` 50ms dopo aver premuto C,
nessun burst di tipo "beam" presente immediatamente.

## Corretto: Colosso e Raccoglitore fermi sul posto
Testato con dati veri: durante 5 secondi di combattimento normale, la profondita' (Z) di
entrambi restava **esattamente fissa** (nessuna variazione), oscillavano solo un po' in
orizzontale (X) — leggeva davvero come "due sagome ferme che si toccano". Aggiunto
movimento vero anche in profondita', con frequenze diverse tra Colosso e Raccoglitore cosi'
non sembrano sincronizzati a specchio. **Verificato**: la Z ora varia visibilmente nel
tempo (es. Raccoglitore da -64.28 a -65.69 in 3 secondi).

## Migliorato: preavviso d'attacco troppo sottile
Il rigonfiamento del nemico durante il windup (aggiunto nella sessione precedente) era
leggibile solo guardando con attenzione o leggendo il testo — non abbastanza per giocare
d'istinto. Aggiunto un vero punto esclamativo da fumetto che scatta di colpo sopra la testa
del nemico (non cresce lentamente, appare quasi subito) e rimbalza leggermente per tutta la
durata del windup — pensato per essere letto a colpo d'occhio, non solo dal popup di testo.

## Da verificare di persona
Il "!" funziona ed e' visibile nei miei test, ma nel mio ultimo screenshot appariva un po'
piccolo e posizionato in alto rispetto alla testa del nemico — probabile conseguenza
dell'angolazione di telecamera del mio test piu' che un problema del posizionamento reale
(la formula usa l'altezza della testa del nemico specifico). Guardalo tu in condizioni di
gioco normali e dimmi se la dimensione/posizione va aggiustata.

---

# RANGER ZERO v41 — combattimento: preavviso vero sui colpi nemici

## Cosa ho trovato testando (non a memoria, con un vero playtest)
Prima di cambiare qualcosa a caso ho giocato il combattimento a ritmo umano realistico:
**10.2 secondi per ripulire 3 scagnozzi base, 21 danni subiti su 100 (21% della vita)**.
Numero interessante ma non allarmante di per se' — il problema vero emerso testando e'
qualitativo: **gli scagnozzi e Il Raccoglitore colpivano di scatto**, danno applicato nello
stesso istante in cui il cooldown scadeva, senza NESSUN segnale prima. Il combattimento del
Colosso invece ha gia' un vero telegraph ("LEGGI L'ATTACCO // SHIFT AL MOMENTO GIUSTO") —
un'asimmetria vera tra le due meta' del gioco.

## Corretto
Aggiunto un preavviso vero prima di ogni colpo nemico in spiaggia (`en.windupT`,
`en.telegraph`): quando il nemico e' a portata e il cooldown e' scaduto, invece di colpire
subito **carica per 0.42s (scagnozzi) o 0.55s (Il Raccoglitore)**, restando fermo e
pulsando visibilmente piu' grande (`windupPulse` nel render, cresce avvicinandosi al
rilascio). Solo alla FINE del windup ricontrolla la distanza e infligge danno — se il
giocatore si e' allontanato nel frattempo, il colpo semplicemente non arriva.

## Verificato con test veri
- Tracciato `windupT` frame per frame: scende da 0.42 a 0 in ~500ms, poi (e solo allora)
  la vita del giocatore scende di 7 (danno scagnozzo) — il preavviso non e' decorativo, il
  danno arriva davvero solo dopo.
- Test di schivata: allontanarsi APPENA il windup inizia evita il colpo del tutto — vita
  rimasta a 100 invece di scendere a 93. Il preavviso e' reagibile per davvero, non solo
  estetico.
- Nessun errore console, nessuna regressione al ritmo generale del combattimento.

## Perche' questo e non altro
"Il combattimento va migliorato" era generico — ho scelto di partire da qui perche' era
l'unica cosa emersa da un playtest vero (non da supposizioni) e perche' avvicina la
spiaggia allo standard di leggibilita' gia' stabilito nel combattimento del Colosso, invece
di introdurre un sistema nuovo scollegato dal resto. Se il bilanciamento numerico
(danno/vita/tempi) va ancora rivisto dopo aver provato questa versione, fammi sapere cosa
senti esattamente — troppo facile, troppo lento, i nemici sembrano tutti uguali — e
procedo da li'.

---

# RANGER ZERO v40 — maglia civile di Zero verde + corridoio Archivio riempito

## Corretto: maglia civile di Zero
La palette civile (`PAL_CIVILE`) era rimasta grigia con l'accento ruggine/bronzo di prima
della v36 (quando Zero divenne verde) — non era mai stata aggiornata insieme al resto
della squadra. Ora segue la stessa regola degli altri: maglia del colore della tuta da
Ranger (verde smeraldo scuro, accento oro). Verificato visivamente.

## Corretto: Archivio "grande ma con poche cose"
Chiarito dall'utente: non e' che manchi contenuto (tubi/monitor/capsule ci sono davvero),
e' che la stanza e' proporzionata molto piu' grande di quanto serva — circa 15 unita' di
corridoio completamente vuoto tra l'ingresso e l'area delle capsule, su un totale di 26.
Invece di rifare la stanza da zero, riempito quel tratto con condotti a parete a intervalli
regolari (5 punti su entrambi i lati) e casse a terra (4 posizioni) — costa poco, non serve
nessuna nuova interazione, ma la sensazione di corridoio vuoto sparisce. Verificato
visivamente: ora si vedono elementi lungo tutto il tragitto invece di un vuoto lungo prima
di arrivare alle capsule.

---

# RANGER ZERO v39 — controllo scrupoloso v38 + luce Archivio

## Cosa ho controllato (playtest vero, non a memoria)
- Titolo → intro → "conosci la squadra" (5 membri: Arco/Meridiana/Jun/Vale/DON) → allarme →
  trasformazione → spiaggia: tutto pulito, zero errori console.
- **Falso allarme sulla cinematica di chiamata moduli**: il primo test mostrava un
  riquadro minuscolo invece della scena — ho pensato fosse un bug vero e ho indagato a
  fondo (controllato FOV, canvas, coordinate camera). Era un errore MIO: avevo richiamato
  `startColossoSequence()` direttamente dalla Torre invece che dalla spiaggia, e la camera
  di quella scena usa le coordinate dell'arena — fuori contesto, guarda nel vuoto. Rifatto
  il test partendo dal punto giusto: **la scena è bella davvero** — tutta la squadra in
  posa con i diamanti sul petto, poi ogni modulo (Dragone Rosso, Gatto Giallo, Gorilla
  Nero...) entra in scena uno alla volta con il proprio testo di chiamata. Nessuna
  correzione necessaria qui.
- **Archivio: non è vuoto, ma è troppo buio per vedersi**. Andando avanti nel corridoio si
  vedono chiaramente: condotti che convergono al soffitto, capsule con occupanti diversi,
  monitor con barre colorate sopra ogni capsula. Tutto quello descritto nel changelog della
  v36 c'è davvero. Il problema è la luce: colori delle pareti troppo scuri + colore di
  sfondo quasi nero facevano sparire i dettagli, specialmente vicino all'ingresso.

## Corretto
- **Luce dell'Archivio alzata**: colore di sfondo da quasi-nero (.02,.02,.03) a un blu
  scuro piu' percepibile (.045,.05,.075); pareti da (.12,.125,.15)/(.065,.085,.105) a
  (.17,.18,.21)/(.10,.125,.155). L'atmosfera resta cupa (non e' diventata una stanza
  illuminata a giorno), ma i dettagli che gia' c'erano ora si vedono, specialmente vicino
  all'ingresso che prima era quasi completamente nero.

## Prompt per le tre immagini dei finali
Scritti nella chat (non nel codice) — tre scene illustrate, stesso stile rosso/oro/ciano
delle altre immagini gia' fatte, una per ogni finale (buono/normale/oscuro). Da generare e
poi mandare per l'inserimento.

## NON affrontato in questa sessione (grandi, confermati a se')
- **Ridisegno vero di Colosso e Il Raccoglitore**: il Colosso ha gia' pannelli colorati per
  modulo (rosso/nero/giallo/blu/rosa/verde) ma resta comunque costruito solo da box — un
  vero ridisegno con forme piu' definite e' un lavoro a se'.
- **Ingresso nella Torre**: attualmente il gioco comincia gia' dentro la Torre, senza una
  vera scena di arrivo — non toccato in questa sessione.
- **Archivio come "impianto" ancora piu' scenico** oltre alla sola luce (es. animazioni sui
  monitor, effetti sui tubi) — non fatto, solo la visibilita' di base e' stata corretta.

---

RANGER ZERO v38 LAST FIX

# RANGER ZERO v37 — MODULE SUMMON / FINAL ATTACK / VICTORY POSE

## v37 — modifiche principali

- Chiamata moduli in camera frontale: Rosso/Dragone, Giallo/Gatto, Blu/Cane, Nero/Gorilla, Rosa/Uccello, Verde/Drago.
- Ogni modulo entra realmente in scena prima dell'assemblaggio.
- Colosso ridisegnato: petto rosso, braccia nere, gamba gialla + blu, testa rosa, ali verdi, nessuna cresta.
- Attacco finale rifatto: ATTACCO SPECIALE → fulmini → SPADA DEL COLOSSO dall'alto → fendente → Raccoglitore scagliato all'indietro verso il mare.
- Il Raccoglitore non cade piu' in avanti sul robot.
- Posa finale: Colosso si gira verso camera e alza la spada.
- VITTORIA senza pulsante CONTINUA; il rientro alla Torre avviene automaticamente dopo il payoff.

# RANGER ZERO v36 — TEAM / DON / COLLECTOR LORE / ARCHIVE SYSTEM

Build cumulativa basata direttamente su **Ranger Zero v35**.

## 1. Zero è ora il sesto Ranger VERDE
- `PAL_ZERO` passa dal rosso ruggine al verde smeraldo/scuro con accenti oro.
- Zero resta il membro speciale della formazione: la squadra standard è ora composta da cinque Ranger, Zero è il **Sixth Frame**.
- La capsula speciale dell'Archivio lo identifica come `SIXTH FRAME // UNIT: ZERO // COLOR: GREEN`.

## 2. Il modulo non è più attaccato alla schiena di Zero
Il vecchio modulo dorsale della v35 era visivamente letto come uno zaino/mecha agganciato al Ranger. È stato rimosso completamente dal corpo di Zero.

Il modulo verde di Zero compare ora **solo sul Colosso combinato**:
- nucleo verde;
- modulo dorsale;
- due pinne/elementi oro;
- piastra verde anteriore.

La logica è quindi: **Ranger pulito → richiamo moduli → assemblaggio → modulo Zero sul Colosso**.

## 3. Retro dei Ranger chiuso e leggibile
Da dietro i Ranger sembravano sagome aperte perché il torso mostrava quasi soltanto la sottotuta scura. Tutti i Ranger hanno ora:
- pannello posteriore sottile del colore della tuta;
- elemento bianco posteriore coordinato con il motivo frontale;
- nessuna appendice mecha sui corpi normali.

È un fix visivo, non una corazza aggiuntiva: il target resta tuta tokusatsu, non robot umanoide.

## 4. DON — quinto Ranger nero
Aggiunto il quinto membro della squadra base:
- **DON**;
- Ranger nero/gunmetal con trim argento;
- forma civile dedicata;
- pelle e capelli differenziati;
- waypoint nella Torre;
- combattimento in spiaggia;
- posa Colosso;
- dialoghi iniziali e post-boss.

Il collegamento a IT SHIFT è volutamente leggibile ma non spiegato apertamente. DON dice di aver lavorato prima con `server, porte, impianti` e chiude il discorso con `storia lunga`.

La squadra è quindi:
1. Arco — rosso
2. Meridiana — blu
3. Jun — giallo
4. Vale — rosa
5. DON — nero
6. Zero — verde, sesto Ranger speciale

L'introduzione richiede ora di parlare con **5/5** membri prima dell'allarme.

## 5. Colosso aggiornato a sei moduli
La combinazione usa ora tutti i cinque Ranger base più il modulo speciale di Zero.

Distribuzione visiva:
- rosso / blu: parte superiore e braccia;
- giallo / rosa: gambe;
- nero DON: struttura centrale/inferiore;
- verde Zero: nucleo e modulo dorsale speciale.

Non è ancora il ridisegno definitivo del Colosso come mecha complesso, ma corregge la logica dei moduli e prepara il successivo model pass.

## 6. Il Raccoglitore ha finalmente una provenienza chiara
La v35 lasciava un'ambiguità poco utile: non si capiva se fosse un mostro di un nemico esterno oppure qualcosa legato a Oculo.

La v36 stabilisce la verità narrativa:

**Il Raccoglitore è una procedura/unità della Torre controllata dal nodo di supervisione di Oculo.**

Durante il rientro:
- Meridiana rileva la firma Ranger;
- DON rileva anche una **autorizzazione interna della Torre**;
- Oculo chiude immediatamente la diagnostica.

Nell'Archivio il registro rivela:
`COLLECTOR UNIT // OWNER: SUPERVISOR NODE // FUNCTION: FIELD RECOVERY + CORE EXTRACTION`

Nel climax Oculo ammette che il Raccoglitore serve a:
- misurare la squadra;
- recuperare unità;
- trasferire energia/core;
- alimentare la continuità del ciclo.

Oculo lo aveva presentato come `nemico` perché era la definizione più semplice da far accettare ai Ranger.

## 7. Archivio più leggibile come impianto di assorbimento
Senza rifare la mappa da zero sono stati aggiunti elementi funzionali:
- tubi verticali per ogni capsula;
- condotti che convergono verso il soffitto;
- due dorsali energetiche longitudinali;
- monitor laterali su ogni capsula;
- barre colorate che simulano output / decadimento / drenaggio;
- nodo di estrazione sul fondo;
- maxi-monitor di Oculo più grande rispetto alla v35.

Lo scopo è far leggere visivamente la stanza come **impianto clandestino di estrazione Ranger**, non come corridoio vuoto con teche.

## 8. Dialoghi / continuità aggiornati
- DON è incluso nella lista dei membri e nei log di continuità.
- Il Frame Zero viene definito `Sixth Frame`.
- La relazione Oculo ↔ Raccoglitore viene chiarita nel finale.
- Il richiamo a IT SHIFT tramite DON resta sottile e non viene spiegato come crossover diretto.

## Controlli tecnici
- `game.js` passa `node --check`.
- Nessun asset della v35 è stato rimosso.
- Menu, touch, panorama, combat, Archivio, finali e safety della v35 restano presenti.

---

# RANGER ZERO v35 — bug visiera, colori classici, sesto Ranger

## Bug corretto (confermato in foto dall'utente)
La visiera dell'elmo era visibile anche da dietro — verificato con uno screenshot identico
al problema mostrato. Corretto con un occlusore pieno dentro il casco (invece di rincorrere
la causa esatta nel motore di render, un blocco opaco garantisce che non si possa vedere
attraverso da nessun angolo). Rimossa anche la cresta sull'elmo, come richiesto — profilo
piu' pulito.

## Colori classici da sentai
Riassegnati: Arco rosso (capo squadra), Meridiana blu vero (prima era azzurro ghiaccio),
Jun giallo, Vale rosa. **Zero resta apposta fuori da questa palette** — il suo rosso ruggine
desaturato lo mantiene visivamente separato, perche' narrativamente e' il sesto Ranger, non
un membro qualunque della squadra classica dei cinque.

## Forma civile: maglia del colore dell'uniforme
Prima tutti avevano una maglia grigia/blu generica in borghese. Ora il colore della maglia
riprende quello della tuta da Ranger di ciascuno — verificato visivamente nella Torre: si
vedono chiaramente maglie blu, rossa, rosa, gialla sui quattro compagni.

## Differenziazione NPC femminili
Meridiana e Vale (le due donne della squadra) hanno ora una coda di cavallo che le
distingue anche di spalle, non solo per colore — un pezzo in piu' sulla nuca, gestito da un
flag `pal.female` nella palette.

## Il sesto Ranger: modulo dorsale per Zero
Aggiunto un modulo esclusivo sulla schiena di Zero (nucleo centrale + due ali angolate +
due propulsori con bagliore caldo) — nessun altro Ranger lo porta. Verificato visivamente:
la sagoma di Zero da dietro e' chiaramente diversa dagli altri quattro.

## NON affrontato in questa sessione (grandi, a se')
- **Ridisegno del Colosso e de Il Raccoglitore**: l'utente ha segnalato che il Colosso
  "sembra un ammasso di cubi che si muove" — vero, ma un ridisegno vero della geometria di
  questi due modelli e' un lavoro a se', non una rifinitura, e non l'ho toccato.
- **Archivio come stanza vera**: l'utente vuole schermi/computer grafici che mostrano
  l'assorbimento, tubi che si collegano, un monitor con Oculo in forma piu' grande — anche
  questo e' un lavoro di scena a se', non fatto in questa sessione.

---

# RANGER ZERO v34 — fine sessione: bug vittoria, ciclo vittoria vero, cornici nuove, controlli touch

## Bug corretto
Il Raccoglitore "si rialzava" dopo la vittoria: il tilt di caduta (`finishTilt`) si applicava
solo durante la fase `"finishing"`, azzerandosi di scatto appena la fase passava a `"won"`.
Ora resta applicato anche durante `"won"` — il gigante rimane a terra per davvero.

## Ciclo vittoria ricostruito
- Raffica di esplosioni sparse (`finishBoomT`/`finishBoomNext`) invece di un'unica bolla che
  si gonfia — riusa lo stesso sistema di scoppi randomizzati dei pugni.
- Il Colosso si gira davvero verso la telecamera durante la fase "won" (interpolazione
  `winT` su ~1.1s dall'angolo di combattimento verso `atan2(eye-robotPos)`), invece di
  restare voltato verso il nemico a terra.
- "VITTORIA" ora e' l'immagine fornita dall'utente (`victory_logo.png`), non piu' testo in
  un balloon — mostrata/nascosta via CSS in base alla classe `.win`.
- Il bottone CONTINUA ora risponde anche a SPAZIO (`doColossoOutcomeContinue`, richiamata
  sia dal click che da un handler keydown dedicato), non solo al mouse.

## Cornici immagine nuove
Sostituita la cornice larga (pensata per i dialoghi) usata per forza sui menu — ora:
- `menu_frame_vertical.png` per pausa/errore di sessione (proporzioni verticali vere,
  titolo+testo+bottoni ci stanno senza schiacciarsi).
- `choice_frame_square.png` per le tre carte di scelta finale (quadrata, meno stiracchiata).

## Controlli touch (nuovi da zero)
Non esisteva alcun supporto touch prima. Aggiunto:
- Rilevamento automatico dispositivo touch (`'ontouchstart' in window`), classe
  `body.touch-device` che mostra i controlli solo quando serve.
- Tastierino direzionale (mappato sullo stesso oggetto `keys{}` della tastiera).
- Tre bottoni azione (schiva/attacca/speciale) che lanciano un vero `KeyboardEvent`
  sintetico con lo stesso `code` del tasto fisico — passano dal listener della tastiera
  gia' esistente invece di duplicare la logica di attacco/Colosso in parallelo.
- **Verificato con un tocco vero**: premendo ATTACCA su un nemico a distanza di combattimento,
  la vita e' scesa da 30 a 14 (16 danni, lo stesso di un pugno da tastiera) — non e' solo
  estetica, il touch controlla davvero il gioco.

## Non rifinito
- E' un tastierino direzionale a bottoni, non un vero joystick analogico scorrevole — per
  un gioco con movimento a "tank controls" gia' esistente e' coerente, ma se in futuro si
  vuole un vero stick trascinabile serve un'implementazione diversa.
- Non ho verificato il touch su TUTTE le schermate (Colosso, Archivio) per limiti di tempo
  — solo sul combattimento base in spiaggia.

---

# RANGER ZERO v33 — collo aggiunto (nuca non più vuota)

## Cosa ho cambiato
L'utente aveva notato che nelle versioni precedenti "la nuca sembrava non esistere" — ho
controllato le coordinate: il busto arriva fino a y≈1.36, l'elmo/testa comincia a y≈1.38-1.42
a seconda del tipo di personaggio. C'era un vuoto reale di qualche centesimo di unita' tra i
due, mai coperto da nessun pezzo — visibile soprattutto da dietro, dove si vedeva attraverso
quel varco.

**Corretto**: aggiunto un pezzo di collo stretto che riempie esattamente quello spazio, per
tutti i tipi di personaggio (Ranger, civile, scagnozzo, Raccoglitore). Colore della tuta per
chi e' vestito/armato (Ranger, scagnozzo, Raccoglitore), colore pelle per la forma civile.

## Verificato
Screenshot da dietro: prima si vedeva un varco tra elmo e busto, ora la connessione e'
continua e solida. Nessun errore console.

---

# RANGER ZERO v32 — pareti coerenti + menu con cornice immagine

## Cosa ho cambiato
- **Pareti della Torre uniformate**: prima le pareti laterali (est/ovest) erano un
  grigio-blu piatto (`wallCol`), mentre solo la parete di fondo dietro Oculo aveva le bande
  sfumate calde (`backBands`) — si vedeva uno stacco netto agli angoli. Ora tutte e tre le
  pareti usano le stesse bande di colore, la stanza legge come un unico ambiente coerente.
  Verificato visivamente: nessuno stacco di colore visibile.
- **Menu con cornice immagine invece di riquadri di testo**: pausa, errore di sessione, e
  le tre scelte finali ora usano `dialogue_frame.png` come sfondo (stessa immagine gia'
  usata per i dialoghi), invece di semplici box con bordo CSS. Nuova classe `.hudPanel`
  riusabile per qualunque altro popup futuro che vorra' lo stesso trattamento.

## Verificato
- Pareti: nessuno stacco di colore, confermato visivamente.
- Schermata di scelta: le tre opzioni hanno tutte la cornice, leggono bene, coerenti con lo
  stile del resto del gioco. Risultato solido.
- Menu pausa: la cornice compare correttamente, ma dato che il contenuto (titolo + testo +
  3 bottoni) e' piu' alto del formato naturale dell'immagine (che e' una banda larga e
  bassa, pensata per una riga di dialogo), la cornice risulta un po' schiacciata/stirata
  verticalmente e la "tab" del nome in alto a sinistra si vede tagliata in modo strano.
  Funziona, ma non e' rifinito quanto la schermata di scelta.

## Se si vuole rifinire ulteriormente
Il problema del menu pausa si risolverebbe con un'immagine di cornice dedicata, piu'
verticale/quadrata invece che a banda larga — oppure restringendo il testo/bottoni per
avvicinarsi di piu' alle proporzioni naturali dell'immagine attuale. Non l'ho fatto in
questa sessione per limiti di tempo.

---

# RANGER ZERO v31 — redesign tuta vera (riferimento Power Rangers classico)

## Cosa ho cambiato
L'utente ha mandato un'immagine di riferimento (le tute classiche Mighty Morphin): colore
pieno, grande diamante bianco sul petto, guanti e stivali bianchi, niente piastre "tattiche"
sopra. Quello costruito nelle versioni precedenti (v26-v28) era piu' "armatura applicata a
una sottotuta" — troppi pezzi separati (piastra petto, trim a X, spallacci, polsini,
ginocchiere, piastre stivali, mandibola, fianchi elmo).

**Rimosso**: piastra del petto + trim a X (sostituiti da un diamante), spallacci per la
forma Ranger (restano solo su Il Raccoglitore, che deve leggere come armatura raccogliticcia
per contrasto), polsini/gauntlet a blocco, ginocchiere, piastre sugli stivali, mandibola
dell'elmo, fianchi dell'elmo.

**Aggiunto**: un diamante bianco sul petto (`chestDiamond`, un box ruotato 45° — tecnica
identica al riferimento: il diamante e' bianco per tutti i Ranger, non colorato per
personaggio, esattamente come nella foto). Guanti bianchi piccoli e puliti alla fine
dell'avambraccio (`pm.glove`, ora bianco invece che colorato). Stivali bianchi: non piu'
nuovi pezzi, semplicemente il colore `pal.boot` (gia' esistente, cambiato da grigio scuro a
bianco) ora si vede perche' non c'e' piu' una piastra sopra a coprirlo.

**Elmo semplificato**: resta calotta arrotondata (ottagono+cupola, dalla v28) + visiera nera
+ piccola cresta, ma senza mandibola ne' pezzi laterali — silhouette piu' liscia, piu' vicina
al casco del riferimento.

## Verificato
- Sintassi OK, nessun errore console.
- Guanti e stivali bianchi confermati visivamente sui compagni di squadra E sul giocatore,
  da piu' angolazioni.
- Niente piu' spallacci a blocco visibili sulla forma Ranger.
- Il Raccoglitore mantiene la sua armatura asimmetrica (invariata, per contrasto narrativo).

## Non verificato
- Non sono riuscito a ottenere uno screenshot pulito di fronte al personaggio (il calcolo
  dell'angolazione della telecamera nei miei test continuava a mostrare il retro) — quindi
  non ho visto con i miei occhi il diamante bianco sul petto nella build finale, anche se il
  codice lo posiziona correttamente in teoria (centrato, sul lato frontale del busto).
  Verificalo tu appena lo apri.
- Gli elmi appesi nell'Archivio (corretti nella stessa sessione, vedi sotto) non sono stati
  ricontrollati con questa ultima modifica alla tuta — dovrebbero essere indipendenti ma
  vale la pena un'occhiata.

---

# RANGER ZERO v30 — merge v26.1 (Archive Escort) + v27-v29 (Claude)

Unione tra due rami di sviluppo paralleli:
- **v26.1** (caricata dall'utente): Meridiana e TIC ora entrano fisicamente nell'Archivio
  insieme a Zero invece di teletrasportarsi separatamente — scena di accompagnamento al
  pannello anomalo (`archiveEscortLines`), poi arrivo insieme (`archiveArrivalLines`), solo
  dopo TIC comincia la scansione a waypoint (`ticPatrol`). Telecamera dei dialoghi corretta
  per puntare alla posizione vera di TIC nella Torre invece di un punto fisso vecchio
  (`getTowerTicPosition`, condivisa tra render e fuoco dialogo).
- **v27-v29** (mie, sessioni precedenti): luce di riempimento nello shader, redesign tuta
  (visiera nera, elmo arrotondato, pettorale/spallacci ridimensionati), scala del Colosso
  aumentata (1.62×) per essere piu' grande de Il Raccoglitore, impatti dei pugni sparsi sul
  corpo invece che sempre nello stesso punto.

## Come ho fatto il merge
Diff riga per riga tra il game.js della v26 (base condivisa) e quello della v26.1 (105 righe
di differenza, tutte isolate al sistema Archivio/TIC — nessuna sovrapposizione con le zone
toccate in v27-v29, quindi applicazione diretta senza conflitti). Applicate tutte le stesse
modifiche, nello stesso ordine, sopra il game.js della v29. Verificato che ogni punto di
innesto matchasse esattamente il codice base prima di sostituire.

## Verificato
- Sintassi OK.
- Scena di arrivo nell'Archivio testata direttamente: la battuta di Meridiana
  ("Siamo dentro. Io controllo il registro...") appare correttamente, TIC resta con lei
  invece di partire subito in pattuglia.
- Nessun errore console.

## Non verificato in questa sessione
- La scena di accompagnamento al pannello anomalo (`doAnomalyInteract`, la parte PRIMA
  dell'ingresso, con Arco che avverte "fate attenzione") non e' stata testata direttamente
  — richiede replicare lo stato `postBossState` che non ho un aggancio dev diretto per
  forzare. La logica e' identica a quella della v26.1 originale (stesso codice, non
  modificato durante il merge), quindi il rischio di rottura e' basso, ma non l'ho vista
  con i miei occhi in questa sessione.

---

# RANGER ZERO v29 — SCALA COLOSSO + IMPATTI SPARSI

## Cosa ho cambiato (feedback: "Colosso più piccolo del Raccoglitore" + "hitbox sempre a basso ventre")
- **Confermato nel codice, non solo impressione**: il Colosso (`drawColossoRobot`) e'
  costruito con parti fino a ~8.7 unita' di altezza (cresta dorata), Il Raccoglitore
  gigante arriva a ~13.6 (rig base ~1.9 × `giantScale` 7.15) — nessuno scaling applicato al
  Colosso prima d'ora.
- **Corretto**: aggiunta `COLOSSO_SCALE=1.62` dentro `drawColossoRobot`, applicata alla
  matrice `base` (quindi a tutte le parti insieme, non serviva toccarle una per una). Il
  Colosso ora dovrebbe leggere come il più grande dei due — verificare di persona in gioco,
  non sono riuscito a fare un confronto laterale preciso per limiti di tempo/angolazione
  nello screenshot che ho controllato.
- **Impatti dei pugni**: prima l'altezza base era fissa (Y=5.1) con una variazione minima
  (`oy` compresso a ×.25 su un range già stretto) — il colpo sembrava sempre nello stesso
  punto basso. Ora la base è più alta (Y=7.0, centro busto) e il range di variazione è
  molto più ampio (`oy` fino a ±3.75 unità, `ox` fino a ±1.7) — verificato numericamente in
  test: su 6 pugni consecutivi le altezze d'impatto sono andate da -3.36 a +2.74, quindi
  ora si spargono davvero sul busto invece di clusterizzare in un punto.
- **Bonus**: gli attacchi del gigante contro il Colosso (pugno/colpo dall'alto) prima non
  avevano NESSUN effetto d'impatto visivo (solo il raggio ce l'aveva) — aggiunto un nuovo
  tipo di scoppio (`enemyHit`) con la stessa randomizzazione, cosi' anche i colpi subiti dal
  Colosso si vedono e variano.

## Cosa NON ho verificato
- Il confronto di altezza esatto tra Colosso e Raccoglitore andrebbe controllato di persona
  fianco a fianco alla stessa distanza dalla camera — il mio test ha usato un'angolazione
  3/4 che rende difficile giudicare con certezza chi sia più alto.

---

# RANGER ZERO v28 — REDESIGN TUTA (meno robot, più sentai)

Base cumulativa: v27 LUCE DI RIEMPIMENTO (di seguito), a sua volta su v26 dell'utente.

## Cosa ho cambiato (richiesta: "sembra più robot che sentai power rangers")
- **Visiera nera** invece di ciano acceso (`makePalette`, campo `visor`) — legge da vera
  protezione, non da schermo/occhio robotico.
- **Nuova geometria arrotondata**: il motore aveva solo `boxMesh` (cubi), che è la causa
  principale dell'effetto "mecha" — ogni pezzo era uno spigolo vivo. Aggiunte due funzioni
  nuove: `octMesh` (prisma ottagonale, stesso ingombro di un box ma 8 lati invece di 4) e
  `domeMesh` (calotta a due gradini + punta, per una cima arrotondata invece che piatta).
  Usate su: calotta dell'elmo (`helmetShell`+`helmetDome`), spallacci (`shoulderPad`).
- **Pettorale rimpicciolito**: da piastra piena (.37×.24×.15) a scudo centrale più piccolo
  (.28×.19×.13) — copriva troppo torso e leggeva da armatura mecha invece che da costume.
- **Spallacci più piccoli e arrotondati** (ottagonali invece di blocchi squadrati).
- Le "teste" nell'Archivio (capsule) usano la stessa funzione `buildBodyParts` del
  giocatore — la correzione dell'elmo si applica automaticamente anche lì, non serviva
  toccare il codice delle capsule separatamente.

## Onestà su cosa NON ho ancora sistemato
- La cima dell'elmo, anche ammorbidita, resta un po' più "a punta/cappuccio" che
  "cupola arrotondata vera" — il motore non ha geometria curva reale (niente sfere), solo
  poligoni piatti a 8 lati. Per una vera cupola liscia servirebbe una mesh con più segmenti
  (16+) e shading più morbido, che however aumenta il costo — da valutare se vale la pena.
- Non ho toccato le proporzioni del busto/gambe (restano dritte, senza vita stretta) né
  aggiunto un vero effetto "tessuto" sulla sottotuta — se il problema "sembra ancora
  robot" persiste anche dopo questo passaggio, il prossimo punto da guardare è la
  silhouette generale del busto, non solo elmo/petto/spalle.
- Non ho girato intorno al personaggio con tutti gli angoli possibili per verificare —
  solo fronte e un lato, per limiti di tempo in questa risposta.

---


## Cosa ho cambiato (Claude, dopo aver ripreso il progetto da v26)
Ripreso il progetto dallo zip v26 caricato dall'utente — molto piu' avanti di dove l'avevo
lasciato io (coreografia NPC vera, combinazione Colosso con formazione/chiamata moduli,
stage cittadino costiero per il boss gigante, Archivio con 8 capsule + Frame Zero, tute
Ranger riviste con pettorale/spallacci/cinturone/guanti). Buon lavoro, non l'ho toccato.

**Unico problema trovato**: con una sola luce direzionale (ambient .46, diffuse .62), i lati
e il retro dei personaggi — dove stanno la maggior parte dei dettagli nuovi delle tute
(spallacci, trim del petto, cinturone) — restavano troppo scuri per leggersi, anche da
vicino. Il lavoro di modellazione c'era gia' ed era buono, semplicemente non si vedeva.

**Corretto**: aggiunta una seconda luce di riempimento (`fillDir`), piu' debole (.22 contro
.56 della luce principale) e leggermente fredda/bluastra per contrasto cromatico con quella
principale neutra, nel fragment shader (`fsSrc`, cerca `keyDir`/`fillDir`). Ambient abbassato
leggermente (.46→.40) perche' con due luci non serve piu' cosi' alto per evitare il nero
totale. Verificato sia nella Torre (luce ambientale scura, lo scenario piu' punitivo) sia
in spiaggia (con `arena_sky.png` gia' presente e funzionante, molto bello) — bordi tra
spallacci/busto/cinturone ora visibili in entrambi i casi.

**Nota per chi riprende**: se si vogliono ulteriori miglioramenti di "modellazione", le
strade piu' immediate sono (1) un leggero smusso/bevel su elmo e pettorale invece degli
spigoli vivi da cubo puro, e (2) un rim-light view-dependent vero (richiede passare la
posizione camera come uniform al fragment shader, non presente ora) per un contorno luminoso
da "eroe" sul bordo delle sagome. Nessuna delle due e' stata implementata in questo passaggio
per mancanza di tempo — la luce di riempimento da sola era il fix a maggior impatto/minor
rischio disponibile subito.

---

Questa build non aggiunge nuovi boss o nuove mappe principali. Rifinisce regia, coreografia NPC, scena di combinazione, stage gigante e Archivio finale, mantenendo il loop completo gia' stabile.

## NPC: coreografia vera nella Torre
- Arco, Meridiana, Jun e Vale hanno waypoint manuali diversi all'inizio.
- Dopo il Colosso usano routine differenti e non si limitano ad arrivare a un punto e congelarsi.
- I percorsi sono lontani dal pannello anomalo e dagli oggetti interattivi.
- Il personaggio che sta parlando si ferma durante il dialogo, gli altri possono continuare la propria routine.
- Entrando nell'Archivio, la routine della Torre viene disattivata: solo Meridiana e TIC esistono nella scena finale.

## Combinazione Colosso
La combinazione non fa piu' convergere i Ranger uno sopra l'altro.
1. La squadra interrompe il combattimento.
2. I quattro alleati raggiungono una formazione tokusatsu leggibile.
3. Arco chiama la Formazione Colosso.
4. La squadra richiama i moduli.
5. Solo dopo parte la cinematic di assemblaggio del robot, gia' riuscita nelle build precedenti.

Battute di raccordo:
- `ARCO // NON BASTA. SQUADRA — FORMAZIONE COLOSSO!`
- `ARCO // CHIAMIAMO I MODULI!`
- `SQUADRA // MODULI, RISPONDETE! COLOSSO — COMBINAZIONE!`

## Giant fight: citta' costiera
- Nel combattimento gigante non viene piu' usato il terreno della piccola spiaggia come base.
- Colosso e Raccoglitore combattono su un quartiere urbano costiero.
- Il mare e' oltre il porto, non tutto intorno ai giganti.
- Citta' ampliata con viale centrale, strade trasversali, edifici laterali, banchina e piccolo distretto industriale.
- Il centro resta volutamente libero per leggere i due giganti e non farli compenetrare nei palazzi.
- Il panorama 360 resta invariato e potra' essere sostituito in seguito con un asset migliore senza riscrivere il livello.

## Armature Ranger v26
Il v25 aveva corretto l'effetto "sommozzatore" ma si era spinto troppo verso il mini-mecha. In v26:
- pettorale piu' piccolo;
- spallacci molto piu' sottili;
- mandibola e pinne del casco alleggerite;
- avambraccio principalmente in sottotuta con polsino/guanto rigido;
- ginocchiere e stivali meno voluminosi;
- restano visiera, cintura, casco e accenti colorati.

Target visivo: persona in costume tokusatsu con dettagli rigidi, non piccolo robot.

## Archivio ricostruito
La scena finale ora ha una stanza piu' leggibile:
- pavimento industriale continuo;
- passerella centrale e guide luminose;
- pareti piu' visibili;
- soffitto, costole strutturali e tubazioni;
- terminale piu' leggibile;
- 8 capsule di vecchie unita' disposte in due file;
- ulteriori record implicano che quello visibile e' solo una parte dell'Archivio;
- nicchia separata per `FRAME ZERO`.

### Frame Zero
La capsula speciale e' vuota e restituisce:
`FRAME: ZERO // STATUS: VACANT // RESERVATION: ACTIVE`

Il gioco non dichiara che Zero sia "l'ultima squadra". La designazione viene trattata come qualcosa di speciale gia' usato in passato, ma il significato resta volutamente incompleto.

Per arrivare alla rivelazione di Oculo bisogna scoprire:
1. Registro.
2. Capsule in stasi.
3. Frame Zero vuoto gia' riservato.

## Regia narrativa rivista
- Rimossa la battuta `siamo gia' arrivati a Zero`.
- Il vecchio Ranger riconosce la designazione ma non ne spiega subito il significato.
- Vale e Meridiana hanno un conflitto piu' chiaro sul dato `RANGER CORE`.
- TIC recupera una memoria incompatibile con i propri log.
- Oculo distingue esplicitamente fra designazioni permanenti e individui temporanei.
- La rottura della quarta parete arriva solo dopo Registro + capsule + Frame Zero.
- Il collegamento LMN_01 / STUDIO resta un indizio piccolo, non un crossover esplicito.

## Forma civile
Resta disponibile `R` nelle zone sicure per trasformare/rilasciare l'armatura. Il Frame Zero riporta anche se il `COMBAT FRAME LINK` e' ACTIVE o SUSPENDED.

## Preservato
- intro con dialoghi prima dell'allarme;
- trasformazione;
- doppia wave;
- squadra che combatte in spiaggia;
- Raccoglitore dal mare;
- cura TIC;
- combinazione del robot;
- boss gigante 3/4;
- guardia/speciale/fase 2/finisher;
- panorama 360;
- checkpoint/safety;
- tre finali LIMEN.

## Test eseguiti
- `node --check game.js`: OK.
- Intro 4/4 -> allarme -> trasformazione -> arena: OK.
- Waypoint post-boss: movimento verificato nel runtime mock.
- Formazione Colosso: 4 Ranger in quattro posizioni distinte, poi cinematic di assemblaggio: OK.
- Archivio: Registro -> capsule -> Frame Zero -> rivelazione Oculo: OK.
- Ripristino checkpoint Archivio in forma civile: OK.

Il playtest browser resta necessario per valutare soprattutto coreografia, silhouette delle tute e resa grafica della nuova citta'/Archivio.
