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

## Cosa manca ancora (in ordine di priorità, secondo l'utente)
1. Un vero sistema di interazione (per leggere il pannello IT SHIFT nella Torre, per ora è
   solo un prop visivo senza testo).
2. Più contenuto narrativo dopo il Colosso (l'utente ha chiesto di "chiudere la storia in
   2-3 passaggi" — verifica se è stato scritto un piano nella chat, altrimenti chiedilo).
3. Transizione vera tra Torre e Arena (oggi è un teletrasporto istantaneo via tasto M o
   automatico a fine intro) — stesso discorso per l'ingresso al Colosso.
4. Musica/ambiente di sottofondo (per ora solo SFX puntuali).
5. Un vero modello/animazione del Colosso, se in futuro si vuole uscire dalla sola vista in
   prima persona (es. per una scena non giocabile che lo mostri dall'esterno).

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
