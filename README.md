# RANGER ZERO v23.0.1 — INTRO / TRANSFORM HOTFIX

Hotfix cumulativo basato su v23. Corregge una regressione introdotta dal sistema checkpoint: un checkpoint esistente poteva fare in modo che SPAZIO dal titolo eseguisse CONTINUA e saltasse briefing, allarme e trasformazione.

## Fix
- SPAZIO dal titolo avvia sempre **NUOVA PARTITA**.
- **CONTINUA** resta disponibile solo dal pulsante dedicato.
- Nuova partita forza Zero in stato civile prima dell'intro.
- Sequenza iniziale resa esplicita: dialoghi -> allarme -> trasformazione -> trasferimento -> spiaggia.
- La trasformazione resta visibile prima del teleport e non puo' essere saltata da uno stato precedente.

---

# RANGER ZERO — v23 TOKUSATSU PAYOFF + SAFETY

Secondo episodio dell'antologia horror/meta **LIMEN**. Build cumulativa basata su **v22 (Archivio + capsule + HP bar)**.

## Avvio

Servire la cartella con un web server locale, per esempio:

```bash
python3 -m http.server 8000
```

poi aprire `http://localhost:8000`.

Le texture WebGL possono essere bloccate aprendo `index.html` direttamente con `file://`.

## File

- `index.html` — UI/menu/overlay
- `game.js` — gioco completo
- `title_cover.png` — cover menu
- `hud_frame.png` — HUD
- `dialogue_frame.png` — frame dialoghi
- `oculo_eye.png` — Oculo
- `arena_sky.png` — fondale costiero al tramonto

## Controlli

### Esplorazione / combattimento normale
- `W / S` — avanti / indietro
- `A / D` — ruota
- `Q / E` — telecamera
- `SPAZIO` — dialogo/interazione
- `F` — attacco
- `SHIFT` — schivata
- `C` — speciale quando l'energia è piena
- `P / ESC` — pausa

### Colosso
- `F` — attacco
- `C` — speciale / colpo finale
- `SHIFT` — guardia; se premuto durante il telegraph può diventare **GUARDIA PERFETTA**

## Flusso v23

1. Titolo
2. Torre / briefing
3. Trasformazione
4. Costa Sud
5. Scagnozzi
6. Emersione del Raccoglitore
7. Combattimento umano
8. Protocollo Colosso
9. **Combinazione visibile del robot low-poly**
10. Boss gigante in prima persona
11. Fase **SOVRACCARICO** al 50% HP
12. Colpo finale tokusatsu
13. Ritorno reale alla Torre
14. Pannello anomalo
15. Archivio / capsule
16. Oculo / quarta parete
17. Scelta REBELLION / COMPLIANCE / CONTROL
18. LMN_02

## Novità rispetto alla v22

### Tokusatsu payoff
- aggiunto `arena_sky.png` come vero fondale della spiaggia;
- sequenza di convergenza dei Ranger mantenuta;
- nuova combinazione di circa 10 secondi con robot completo visibile;
- Colosso composto da moduli/colori della squadra;
- Raccoglitore con volto più leggibile: occhi, maschera, bocca/griglia, corna;
- frammenti di vecchie armature Ranger sul Raccoglitore;
- guardia nel combattimento gigante;
- telegraph `ATTACCO IN ARRIVO`;
- guardia perfetta;
- fase `RACCOGLITORE // SOVRACCARICO`;
- colpo finale obbligatorio con `C`;
- esplosione/freeze finale più leggibile.

### Logica narrativa
- dopo la vittoria non si viene più teletrasportati automaticamente nell'Archivio;
- si ritorna alla Torre;
- TIC rileva un sottosistema non indicizzato;
- Oculo ordina di ignorarlo;
- nuovo obiettivo: `CONTROLLA IL PANNELLO ANOMALO`;
- solo interagendo col pannello si entra nell'Archivio;
- il registro chiarisce il decadimento energetico e perché servono nuovi Ranger;
- piccolo riferimento a `SESSION_01 // TYPE: STUDIO` / `LMN_01`;
- Oculo viene visualizzato su un monitor dell'Archivio durante il reveal;
- la quarta parete è più graduale;
- finale NORMAL rinominato **ARCHIVIA**;
- il finale CONTROL è preparato dal concetto `SUPERVISOR NODE // SUCCESSOR SLOT`.

### Safety / stabilità
- checkpoint automatici;
- `CONTINUA` dal menu;
- Game Over riparte da checkpoint pulito;
- pausa vera con `P / ESC`;
- auto-pausa quando la pagina perde focus;
- pulizia degli input trattenuti;
- filtro contro key-repeat sulle azioni;
- `T`, `M` e `window.__rz` disponibili solo con `?dev=1`;
- loader texture WebGL1 sicuro per immagini NPOT;
- rendering limitato a DPR massimo 2 e al limite GPU;
- gestione `webglcontextlost` / reload dal checkpoint;
- overlay per errori runtime;
- controllo coordinate non finite del player/nemici;
- clamp finale dei nemici dentro l'arena;
- buffer GPU dinamici riutilizzati per i personaggi animati;
- eliminato il doppio pannello sovrapposto della Torre che poteva causare z-fighting;
- timer narrativi principali aggiornati con un timer di gioco che non avanza in pausa.

## Checkpoint

La build registra automaticamente lo stato in `localStorage`:

- `torre`
- `arena`
- `colosso`
- `postboss` (ritorno Torre, prima dell'Archivio)
- `archivio`

Il checkpoint viene rimosso quando viene registrato un finale completo.

## LIMEN

La v23 continua a scrivere il formato legacy:

`LIMEN_SESSION_01`

ma introduce anche:

`LIMEN_META_V1`

Per `LMN_02` vengono registrati:

- `firstEnding`
- `lastEnding`
- `unlockedEndings`
- asse `rebellion / compliance / control`
- cronologia limitata delle scelte

Il profilo globale viene incrementato sulla **prima scelta autentica** della sessione, evitando che il semplice farming dei tre finali falsi il comportamento iniziale del giocatore.

## Modalità DEV

Aprire con:

`http://localhost:8000/?dev=1`

Solo allora diventano disponibili:

- `T` — trasformazione manuale
- `M` — cambio zona rapido
- `window.__rz` — helper dalla console

Nella build normale questi strumenti sono disattivati per non corrompere la progressione narrativa.

## Nota di scope

Questa build NON aggiunge:

- veicoli giocabili;
- robot free-roaming;
- città aggiuntive;
- skill tree;
- inventario;
- secondo boss gigante;
- combo avanzate.

La combinazione è volutamente una breve cutscene scriptata: deve vendere la fantasia tokusatsu senza trasformare il progetto in un simulatore di mecha.
