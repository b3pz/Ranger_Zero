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
