# RANGER ZERO — vertical slice / prototipo tecnico
Capitolo 2 dell'antologia LIMEN. Questo README è scritto per un'altra AI (ChatGPT o altro)
che riprenda il lavoro dopo che Claude ha chiuso la sessione. Leggilo tutto prima di toccare
il codice — spiega cosa esiste, come è fatto, e cosa NON va cambiato senza motivo.

## Come si avvia
File statici puri, nessuna build, nessuna dipendenza npm. `index.html` + `game.js` (un solo
file JS, IIFE, "use strict") + immagini PNG nella stessa cartella.

**IMPORTANTE**: va servito con un server locale, NON aperto con doppio click (file://).
Le texture WebGL (l'occhio di Oculo) vengono bloccate dal browser su file://. Il codice ha
già un fallback che avvisa a schermo se succede ("Le texture 3D non si caricano..."), ma la
soluzione è: `cd cartella-progetto && python3 -m http.server 8000`, poi apri
`http://localhost:8000`.

## Cos'è già stato deciso e PERCHÉ (non ridiscuterlo senza un motivo forte)
- **Personaggi 3D veri, non sprite/billboard.** Nel capitolo precedente (IT SHIFT) gli NPC
  erano sprite 2D piatti e hanno causato ore di bug (si vedevano di taglio, sembravano
  "staccarsi" da certe angolazioni). Ranger Zero usa invece un rig 3D vero fatto di scatole
  (box) con trasformazioni locali per ogni parte del corpo. Non tornare agli sprite.
- **Nessuna libreria esterna.** WebGL puro, mat4 scritto a mano (`mat4` object in cima al
  file). Se serve aggiungere funzionalità 3D, estendi questo sistema, non introdurre
  three.js o simili — cambierebbe tutta l'architettura.
- **Le texture immagine si usano per cose che sarebbero "pesanti" da costruire a scatole**
  (l'occhio di Oculo, l'HUD, la copertina) tramite un secondo programma shader dedicato
  (`texProg`, `loadTexture()`, `drawTexturedQuad()`). Tutto il resto (personaggi, stanze,
  arena) resta geometria a scatole con colore pieno per coerenza stilistica PSX/low-poly.
- **Niente nomi Power Rangers / Saban / Hasbro nel gioco vero.** "Megazord" → **"Il
  Colosso"**. "Goldar" era solo ispirazione visiva per Il Raccoglitore (il vostro
  antagonista originale, corna + armatura fatta di pezzi di vecchi Ranger). Vedi il file di
  pre-produzione originale (fuori da questa cartella, nella chat con l'utente) per tutta la
  bibbia narrativa/nomi/palette.

## Struttura del codice (in ordine di apparizione nel file)
1. **`mat4`** — libreria matrici minimale (identity, multiply, perspective, lookAt,
   translate, rotX/Y/Z, scale). `mul(...)` compone più matrici in sequenza.
2. **Shader principale** (`prog`) — box con normali e colore per vertice, luce direzionale
   fissa, uniform `uAlphaMain` per trasparenza (usato per il fade-out del Raccoglitore che
   si ritira, e per il burst dell'attacco speciale).
3. **Shader texture** (`texProg`) — quad con UV, usato SOLO da `drawTexturedQuad()`.
4. **`boxMesh(col)`** — genera la geometria di un cubo unitario colorato. `bakeParts(parts)`
   fonde più box (ognuno con la propria matrice locale) in un unico buffer statico.
5. **La Torre** (sala di comando) — pareti a bande sfumate, fascio di luce, colonne,
   consolle a V, pannelli laterali, il nucleo LIMEN nascosto (easter egg verde fosforo
   `#b7ff4a`, stesso colore degli indizi LMN in IT SHIFT — c'è un pannello spento tra gli
   altri pensato per ospitare in futuro un riferimento esplicito a IT SHIFT, tipo un
   frammento dati con "STUDIO" corrotto o un numero di badge).
6. **`buildBodyParts(pal, walkPhase, speedFactor, helmet, kind, attackPhase, weaponOut)`**
   — il rig del personaggio, parametrizzato. `kind` cambia sagoma: `"ranger"` (eroico,
   casco con cresta), `"scagnozzo"` (niente cresta, visiera a fessura, leggermente curvo),
   `"raccoglitore"` (corna, spallacci asimmetrici). `attackPhase` (0→1) anima un pugno vero
   col braccio destro. `weaponOut` aggiunge una lama energetica in mano (attacco speciale).
7. **Le 4 palette Ranger + Zero + civile + scagnozzo + raccoglitore** — vedi
   `makePalette(suit, accent, skin)`. Colori scelti apposta per essere diversi dai colori
   primari puri (niente vero rosso/blu/giallo Power Rangers).
8. **TIC** — drone, sagoma volutamente diversa da un Ranger (disco + cupola + un occhio +
   antenna), per non sembrare "un altro personaggio in miniatura".
9. **Arena** — spiaggia (sabbia + mare), sostituita alle rovine urbane iniziali su richiesta
   esplicita. Il mare è già lì apposta: Il Raccoglitore dovrà uscirne in una fase futura
   (non ancora costruita). Confine nord = riva del mare (`SEA_EDGE_Z`), niente nuoto per ora.
10. **Sistema di zone** (`ZONES`, `zoneBounds()`, `enterArena()`, `enterTorre()`) — la Torre
    e l'Arena sono due spazi separati nello stesso mondo (offset in Z), non scene diverse.
    Il passaggio tra le due è un teletrasporto istantaneo, non c'è ancora una vera
    transizione/cutscene di viaggio.
11. **Sistema di dialoghi** (`playDialogue()`, `advanceDialogue()`, `introLines`) — coda di
    battute {speaker, text}, avanzamento con click o SPAZIO, blocca l'input mentre attivo.
    L'intro attuale: Oculo spiega perché il protagonista è stato reclutato, due battute con
    Arco/Meridiana/TIC (con dentro il riferimento a IT SHIFT su "sessioni/badge/registri"),
    allarme, trasformazione automatica, teletrasporto in arena.
12. **Trasformazione** (`startTransformation()`, `updateTransformation()`) — SOLO lampi di
    schermo (flash bianco) + zoom telecamera, NESSUNA immagine/card (ne avevamo messa una,
    l'utente l'ha bocciata esplicitamente come "brutta", non rimetterla senza chiedere).
13. **Combat** (`tryAttack()`, `trySpecial()`, `tryDodge()`, `updateEnemies()`,
    `damageEnemy()`) — attacco normale = pugno/corpo a corpo, danno base. Attacco speciale
    (tasto C, richiede energia piena) = lama energetica + burst di luce/esplosione nel punto
    colpito + flash dorato distinto dal flash bianco della trasformazione. Il Raccoglitore
    non muore mai in questa arena: a HP 0 si ritira (fade out), pensato per tornare gigante
    in una fase 2 non ancora costruita.
14. **Game over** (`triggerGameOver()`) — a HP 0 il player mostra "SESSIONE INTERROTTA" con
    pulsante RIPRENDI che resetta HP e re-innesca l'arena (non rifà l'intro).
15. **HUD** — `hud_frame.png` per il pannello obiettivo/energia, barra vita separata sotto
    (CSS puro), vignetta rossa a schermo quando il player subisce danno.

## File immagine attesi nella cartella
- `hud_frame.png` — cornice HUD (generata con ChatGPT, prompt nella chat)
- `title_cover.png` — copertina schermata iniziale
- `oculo_eye.png` — texture dell'occhio di Oculo (sfondo reso trasparente da Claude via
  script PIL, l'originale generato da ChatGPT aveva sfondo bianco)
- `transform_card.png` — **NON PIÙ USATA**, l'utente l'ha bocciata. Può restare nella
  cartella ma non è referenziata da index.html/game.js. Non rimetterla senza che l'utente
  la richieda esplicitamente.

## Aggiornamento (dopo la sessione con Il Colosso + audio + collisioni)
Questa versione (v12) aggiunge, rispetto a quanto descritto sopra:
- **Il Colosso è costruito e funziona**: quando Il Raccoglitore si ritira nell'arena
  normale (`damageEnemy`), parte `startColossoSequence()` — cutscene di crescita (testo +
  scala che aumenta), poi `zone="colosso"`, combattimento in **prima persona fissa** (niente
  camminata, solo `colossoPunch()`/`colossoSpecial()` su F/C), barra vita dedicata al boss,
  vittoria/sconfitta con overlay proprio (`colossoOutcomeEl`) e pulsante che riporta alla
  Torre. La "combinazione dei 5 Ranger" è solo implicita (testo + cambio camera), non è
  stato costruito un modello del Colosso stesso — la prima persona aggira il problema.
  **Nota per chi riprende**: i pugni in vista (viewmodel) sono stati provati e rimossi
  perché non risultavano visibili nei test; se li si vuole reintrodurre, verificare bene
  la posizione rispetto a `COLOSSO_CAM_Z`/`COLOSSO_GIANT_Z` prima di fidarsi che siano a
  schermo.
- **Collisioni**: nemico-nemico (si respingono a vicenda invece di sovrapporsi, vedi fondo
  di `updateEnemies`) e giocatore-nemico (il player viene spinto fuori se si sovrappone a
  un nemico vivo, subito dopo il clamp di `zoneBounds()` nel loop principale). Solo nella
  zona "arena" per ora — Torre e Colosso non ne hanno bisogno (statica/senza nemici mobili
  la prima, camera fissa la seconda).
- **Audio**: tutto sintetizzato via Web Audio (oscillatori + rumore bianco per gli impatti,
  vedi il blocco `AUDIO` in cima a game.js — funzioni `tone()`, `noiseBurst()`, oggetto
  `sfx`). Si sblocca al primo Space/click (`unlockAudio()` dentro `beginGame()`), perché i
  browser bloccano l'audio finché l'utente non interagisce. Coperti: dialoghi (blip),
  trasformazione, attacco/schivata/speciale, colpire/essere colpiti, nemico sconfitto,
  allarme, vittoria/sconfitta (sia nel game over normale sia nel Colosso). **Non c'è
  ancora musica/ambiente di sottofondo**, solo effetti puntuali.
- La card di trasformazione (`transform_card.png`) è stata rimossa dal codice e dallo zip:
  l'utente l'ha bocciata esplicitamente ("è veramente brutta"). Non reintrodurla.
- Il balloon dei dialoghi ora ha un trattamento PSX via CSS (angoli a mirino + bevel),
  niente immagine esterna: vedi `#dialogueBox` in index.html.

## Aggiornamento v13 — Archivio, finali, cliffhanger, e leggibilita' del prologo
- **Archivio costruito**: terza stanza della Torre (`ARCHIVIO_CX=40`, lontana dalle altre
  zone), si sblocca dopo la vittoria sul Colosso (`archivioUnlocked=true`,
  `startArchiveSequence()`). Elmi danneggiati appesi alla parete est (colori spenti,
  richiamano le vecchie squadre), un terminale con `SQUADRA_07/08/09 — STATO: TERMINATA`.
  **Nota per chi riprende**: la stanza inizialmente non aveva il muro est e si vedeva
  attraverso fino a geometria di altre zone lontane — controllato e corretto, ma se si
  aggiungono altre stanze verificare sempre che abbiano tutti e 4 i muri.
- **Rottura della quarta parete**: dopo il registro, Oculo smette di rivolgersi a "unita'
  Zero" e parla direttamente a chi gioca (`archiveLines` in game.js).
- **Scelta finale a tre vie** (`showChoiceScreen()`): RIFIUTA / COMPLETA / PRENDI IL SUO
  POSTO, che portano a `triggerEnding('good'|'normal'|'evil')`. Ogni finale scrive su
  `localStorage["LIMEN_SESSION_01"]` (stessa chiave condivisa con IT SHIFT) un campo
  `LMN_02:{ending,ts}`.
- **Cliffhanger**: lampo bianco breve dopo qualche secondo sul finale, poi il testo sfuma
  nel nero **permanente** (bug corretto: la prima versione faceva sfumare anche lo sfondo,
  rivelando di nuovo il gioco dietro — ora solo il testo sparisce, lo sfondo nero resta).
- **Prologo piu' leggibile**: nascosto il tag di debug (`#tag`) e i controlli (`#hint`)
  durante i dialoghi, che prima si sovrapponevano al balloon. Il giocatore ora nasce
  rivolto verso la squadra/Oculo invece che di spalle. La telecamera gira verso chi sta
  parlando durante i dialoghi (`dialogueFocus`, mappa `DIALOGUE_FOCUS_POS`).
- **Vita nella Torre**: TIC pattuglia tra i pannelli (`TIC_PATROL`, waypoints con
  interpolazione), i 4 Ranger hanno un leggero dondolio idle invece di restare immobili, e
  chi sta parlando in quel momento si illumina leggermente.
- **Cielo per l'arena**: prima c'era il vuoto nero sopra la spiaggia, ora pareti a bande
  colorate sull'orizzonte (`arenaSkyBuf`) + `clearColor` coordinato per zona.
- **Teletrasporto vero**: lampo ciano + suono (`teleportFlash()`) sia per Torre→Arena che
  per il ritorno, invece di un salto secco senza feedback.
- **Transizione del Colosso rifatta**: ora c'e' una fase "converge" (1.5s) PRIMA della
  cutscene di crescita — i 4 compagni volano verso il giocatore e convergono, poi lampo,
  poi passa a `zone="colosso"` e la crescita del Raccoglitore parte. Prima era solo testo.
  **Importante per chi riprende**: questo ha allungato la sequenza totale (converge 1.5s +
  cutscene 2.8s = 4.3s prima che `colosso.phase` diventi `"fight"`) — se si scrivono altri
  test o si aggiungono altre fasi, tenerne conto nei tempi di attesa.

## Aggiornamento v14 — Archivio giocabile, occhio come cliffhanger, immagini nelle scelte
- **Archivio ora è esplorabile, non più solo narrativo**: il giocatore cammina liberamente,
  si avvicina al terminale o alla parete degli elmi, e preme SPAZIO quando appare il prompt
  per scoprire il pezzo di storia corrispondente (`TERMINAL_POS`, `HELMET_POS`,
  `nearInteractable`, `doArchiveInteract()`). Solo dopo aver scoperto ENTRAMBI
  (`archiveState.terminalRead` e `.helmetsRead`), parte automaticamente la rivelazione di
  Oculo (`maybeStartOculoReveal()`) che porta alla scelta finale. Aggiunge un vero elemento
  di gioco/scoperta invece di un blocco di dialogo forzato.
- **Cliffhanger sull'occhio**: dopo il lampo bianco, l'immagine di Oculo (`oculo_eye.png`,
  gia' usata per la Torre) compare enorme al centro dello schermo su sfondo nero puro, resta
  a fissare per qualche secondo, poi sfuma nel buio permanente. Sostituisce il vecchio
  lampo bianco semplice.
- **Immagine nella schermata di scelta**: l'occhio di Oculo ora e' anche lo sfondo
  atmosferico dietro ai tre bottoni (RIFIUTA/COMPLETA/PRENDI IL SUO POSTO), invece di un
  semplice testo su nero.
- **Nota tecnica per chi riprende**: durante i test e' emerso che i controlli di
  prossimita' (`Math.hypot(...)<soglia`) vanno verificati con margine — un test posizionato
  esattamente al valore soglia (es. distanza 1.6 con condizione `<1.6`) puo' fallire per
  arrotondamento float. Non e' un bug del gioco, ma va tenuto a mente scrivendo altri
  controlli di distanza in futuro.

## Aggiornamento v15 — balloon dei dialoghi con immagine vera
- Il balloon dei dialoghi (prima solo CSS con angoli a mirino, giudicato "non bello"
  dall'utente) ora usa un'immagine vera generata con ChatGPT (`dialogue_frame.png`),
  stessa famiglia visiva di `hud_frame.png` (rosso/oro/ciano). Sfondo reso trasparente da
  Claude via script PIL (solo il nero puro delle punte esterne, non il pannello interno
  scuro che serve da sfondo al testo — soglia RGB<3).
- Nome dello speaker (`#dialogueName`) posizionato nella "tab" in alto a sinistra
  dell'immagine, testo (`#dialogueText`) nel pannello centrale, prompt "SPAZIO PER
  CONTINUARE" (`#dialoguePrompt`) in basso a destra — tutti posizionati in percentuale
  sopra l'immagine di sfondo, NON generati a parte. Se si cambia l'immagine della cornice
  in futuro, ricontrollare queste percentuali (`left/top/width/height` in `%`) perche' sono
  tarate sulle proporzioni esatte di questa immagine (2172×724).

## Aggiornamento v16 — font
- Sostituito Courier New (monospazio generico) con **Rajdhani** da Google Fonts (pesi
  400/500/600/700), caricato via `<link>` in `index.html`. Fallback a Courier New se
  offline, quindi nessuna rottura se il font non si carica.
- **Nota per chi riprende**: se si cambia ancora il font, occhio ai 3 bottoni
  (`gameOverBtn`, `colossoOutcomeBtn`, `.choiceBtn`) — non ereditano `font-family` dal
  `body` per via del comportamento di default dei browser sui `<button>`, hanno una
  dichiarazione `font:` scorciatoia separata che va aggiornata a mano.

## Aggiornamento v17 — momenti epici + correzione bug vero
- **Rallentatore/hit-stop globale** (`slowMoT`, `slowMoFactor`, `triggerSlowMo(durata,fattore)`
  in cima al file): un fattore di scala applicato a `dt` nel loop principale. Il countdown
  va in tempo REALE (non scalato), altrimenti non finirebbe mai. Usato per: micro-freeze sui
  colpi normali (`damageEnemy`), sui pugni/speciali del Colosso (`colossoPunch`/
  `colossoSpecial`), e per il colpo di grazia finale (piu' lungo e marcato).
- **Sequenza vera per l'emersione de Il Raccoglitore** (`emergeCutscene`, 
  `maybeEmergeRaccoglitore()`, `updateEmergeCutscene()`): prima l'emersione succedeva sullo
  sfondo mentre il giocatore restava libero di muoversi, ora e' una scena bloccata a tutti
  gli effetti — telecamera fissa cinematica sul mare, input del giocatore bloccato, fasi
  "buildup" (2.2s di tensione) → "rising" (l'emersione vera, con spruzzo/ruggito) → "hold"
  (si resta a inquadrarlo un attimo) → ritorno al controllo normale. Si attiva solo dopo
  aver ripulito tutti gli scagnozzi (`maybeEmergeRaccoglitore` controlla
  `enemies.some(scagnozzo && !dead)`).
- **Colpo di grazia in rallentatore sul Colosso**: nuova fase `colosso.phase==="finishing"`
  tra il combattimento e la vittoria — la telecamera si stringe sul gigante
  (`colosso.finishZoom`) mentre crolla in avanti (`colosso.finishTilt`), invece di saltare
  dritti alla schermata di vittoria. Nota: essendo in rallentatore, la sequenza dura piu'
  a lungo in tempo REALE di quanto suggerisca la sua durata "di gioco" (2.0s scalati a
  fattore .22 diventano ~9s di orologio se il rallentatore non si esaurisse prima — dato
  che `triggerSlowMo` ha un tetto massimo in tempo reale, il rallentatore finisce prima e
  il resto scorre a velocita' normale: nei test la sequenza completa richiede ~9-10s reali).
- **Ombre a terra** (`drawShadow()`, mesh condivisa `shadowBuf`) sotto il giocatore, i 4
  Ranger nella Torre, e i nemici in spiaggia (scalate in base alla loro `scale`).
- **Bug vero trovato e corretto**: `#interactPrompt` (il prompt "SPAZIO — LEGGI" 
  dell'Archivio) aveva l'animazione CSS `blink` applicata SEMPRE, non solo con la classe
  `.show` — le animazioni CSS sovrascrivono il valore statico di `opacity`, quindi il
  prompt lampeggiava debolmente anche quando avrebbe dovuto essere invisibile (opacity:0).
  Scoperto testando la cutscene dell'emersione in una zona diversa dall'Archivio. Corretto
  spostando `animation:blink` dentro la regola `.show`. **Attenzione per chi riprende**: se
  si aggiungono altri elementi con `opacity:0` di base PIU' un'animazione CSS, la stessa
  trappola puo' ripresentarsi — l'animazione va sempre gated dietro la classe che controlla
  la visibilita', mai nella regola base.

## Aggiornamento v18 — musica d'ambiente
- Aggiunto un sistema di musica d'ambiente sintetizzata (droni con oscillatori scordati +
  rumore filtrato per il mare), stessa filosofia degli SFX — nessun file audio esterno.
  Vedi il blocco subito dopo `sfx{}`: `ensureMusicGain()`, `stopAmbient(fade)`,
  `playAmbient(zona)`, preset in `AMBIENT_PRESETS` (torre/arena/colosso/archivio, ognuno
  con la propria base di frequenza, forma d'onda, filtro, e se ha o no il "mare" di fondo).
- `playAmbient()` è idempotente — chiamarla di nuovo con la stessa zona non fa nulla, quindi
  si può richiamare tranquillamente ad ogni ingresso zona senza doversi preoccupare di
  duplicare i droni. Dissolvenza automatica tra una zona e l'altra (mai un taglio secco).
- Musica si ferma in dissolvenza lunga (3.5s) quando parte il finale/cliffhanger — il gioco
  finisce nel silenzio, non con la musica che continua sotto la schermata nera.
- **Nota per chi riprende**: non è possibile verificare il suono per davvero in un ambiente
  di test headless senza scheda audio — verificato solo che il codice non generi errori e
  che i nodi Web Audio si creino/distruggano senza eccezioni lungo tutto il flusso di gioco
  (Torre→Spiaggia→Colosso→finale). Se in futuro si sente che qualcosa non suona come
  dovrebbe, il problema è probabile sia nei valori dei preset (`AMBIENT_PRESETS`), non nella
  meccanica del sistema (quella è stata testata a fondo).

## Aggiornamento v19 — bug vero corretto: input "mangiato" durante i colpi ripetuti
- **Trovato testando sul serio** (non a memoria): colpendo ripetutamente Il Raccoglitore o
  il Colosso, molti input venivano ignorati — su 20 pugni ne registravano solo 5-8. Causa:
  l'hit-stop (rallentatore breve ad ogni colpo) scala `dt` globalmente, e i timer di
  recupero attacco (`player.attackT`, `colosso.punchT`/`beamT`, `en.cd` dei nemici)
  venivano decrementati con quello stesso `dt` scalato — quindi durante l'hit-stop il
  recupero rallentava insieme a tutto il resto, "mangiando" i tasti premuti nel frattempo.
- **Corretto**: aggiunto `rawDtGlobal` (tempo reale non scalato dell'ultimo frame,
  aggiornato in cima a `frame()`). Tutti i timer di recupero attacco ora decrementano con
  `rawDtGlobal` invece di `dt` — restano legati al tempo reale, non a quello rallentato.
  Le animazioni e gli effetti visivi restano su `dt` scalato (quello e' l'effetto voluto
  dell'hit-stop). **Nota per chi riprende**: se si aggiungono nuovi timer di
  recupero/cooldown per azioni del giocatore o dei nemici, usare sempre `rawDtGlobal`, mai
  `dt` — altrimenti si ricade nello stesso problema.
- Verificato col test che aveva scoperto il bug: prima 20 pugni sul Colosso registravano
  90 danni su 360 possibili, ora 342 su 360.

## Cosa manca ancora
1. Musica/ambiente di sottofondo (solo SFX puntuali per ora).
2. Bilanciamento vero del combattimento (numeri di danno/HP scelti a naso).
3. I tre finali restano testualmente essenziali — la struttura regge un approfondimento
   narrativo futuro senza bisogno di ricostruire il sistema.
4. Il combattimento in spiaggia e la fase Colosso restano gli unici segmenti "action" veri
   — l'Archivio e' esplorazione+lettura, non combattimento, per scelta narrativa.

## Metodo di lavoro da rispettare
- **Testa sempre prima di consegnare.** In questa cartella non c'è modo di "vedere" il
  risultato senza eseguirlo: se hai un browser headless (Playwright, Puppeteer) usalo per
  aprire il gioco, simulare input da tastiera, e fare screenshot di verifica PRIMA di dire
  che una cosa funziona. L'utente ha beccato più volte cose "teoricamente giuste" ma rotte
  nella pratica.
- **Un cambiamento alla volta quando è rischioso.** Se stai per toccare il rig dei
  personaggi o il sistema di camera/collisioni, verifica che non rompi le altre parti che
  li usano (giocatore, squadra, nemici li condividono tutti).
- **Ogni zip consegnato deve contenere questo file** (aggiornalo se cambi qualcosa di
  strutturale, non lasciarlo disallineato dal codice).
