# RANGER ZERO v24 — GIANT FIGHT REWORK

Build cumulativa basata su **v23.0.1 INTRO / TRANSFORM HOTFIX** e quindi sulla **v22** come base di contenuto.

## Obiettivo di questa build

Il pass grosso corregge i problemi emersi nel playtest della v23 senza rimuovere le parti gia' riuscite: intro/dialoghi/allarme/trasformazione, Torre, Archivio/capsule, safety pass, checkpoint, Oculo, tre finali e LIMEN restano presenti.

## Novita' principali

### Spiaggia: due ondate vere
- **Wave 1:** 3 scagnozzi.
- pausa radio breve.
- **Wave 2:** 4 scagnozzi che arrivano da posizioni differenti e piu' vicine alla battigia.
- dopo la seconda wave arriva il silenzio prima del reveal del boss.

### La squadra combatte con Zero
Arco, Meridiana e gli altri due Ranger sono presenti fisicamente sulla spiaggia e si muovono verso gli scagnozzi. Attaccano in modo leggero/scriptato: aiutano visivamente e tolgono pochissima vita, ma non possono completare la wave al posto del giocatore.

### Raccoglitore: vera emersione dal mare
Il Raccoglitore parte sott'acqua nella zona profonda, non sulla sabbia. Dopo la seconda wave:
1. la telecamera guarda dalla spiaggia verso il mare;
2. il mostro sale dall'acqua con lo splash;
3. avanza fino al bagnasciuga;
4. soltanto allora entra nel combattimento normale.

### Fondale `arena_sky.png`
Il fondale costiero viene renderizzato come quad a doppia faccia per evitare il problema di culling che nella v23 poteva farlo sparire. Il pannello e' stato anche leggermente avanzato davanti alla parete procedurale per evitare sovrapposizioni.

### Raccoglitore
Il volto introdotto nella v23 resta: occhi, maschera, bocca/griglia, denti e corna. Sono invece state rimosse le placche rosse/blu/viola/verdi dal suo corpo: quei colori ora appartengono chiaramente al **Colosso Ranger**.

## Combinazione Colosso rifatta
La combinazione usa una regia chiusa e prevedibile, non piu' una camera che orbita liberamente:
1. shot basso sulle gambe;
2. shot medio su nucleo/torso;
3. shot alto su testa/elmo;
4. hero shot completo con robot + avversario.

I moduli colorati della squadra diventano placche visibili sul robot combinato.

## Nuovo combattimento gigante in 3/4
La prima persona e' stata sostituita dal combattimento **in terza persona / camera 3/4 cinematografica**.

Entrambi i giganti restano visibili:
- Colosso Ranger a sinistra;
- Raccoglitore gigante a destra;
- mini-citta' low-poly ai loro piedi;
- mare e tramonto sullo sfondo.

La mini-citta' non e' un livello aggiuntivo: sono piccoli edifici, strade e antenne scenografiche per far percepire immediatamente la scala dei personaggi.

### Combat gigante
- **F:** attacco. Il Colosso fa un affondo visivo verso il nemico.
- **SHIFT:** guardia / guardia perfetta sul telegraph.
- **C:** speciale e colpo finale.
- Il Raccoglitore si muove fisicamente in avanti quando attacca.
- Camera shake e impatti restano presenti.
- Fase 2 **SOVRACCARICO** resta attiva a meta' vita.
- Finisher finale resta obbligatorio con `C`.

## Intro e trasformazione
Resta il fix della v23.0.1:

**NUOVA PARTITA → dialoghi Torre → allarme → trasformazione visibile → trasferimento → spiaggia**

`SPAZIO` dal titolo non carica automaticamente un vecchio checkpoint. `CONTINUA` e' una scelta separata.

## Safety mantenuta
- checkpoint Torre / Spiaggia / Colosso / Archivio;
- CONTINUA;
- pausa `P` / `ESC`;
- auto-pausa su perdita focus;
- Game Over con ripristino checkpoint pulito;
- key repeat filtrato;
- debug soltanto con `?dev=1`;
- texture NPOT sicure;
- render scale limitato;
- WebGL context-loss handler;
- clamp e protezione coordinate non finite;
- buffer dinamici riutilizzati;
- `LIMEN_META_V1` + compatibilita' vecchio sistema.

## Flusso da testare
1. Nuova partita.
2. Controllare che avvengano dialoghi, allarme e trasformazione.
3. Spiaggia: verificare **due wave distinte** e squadra alleata in combattimento.
4. Verificare che `arena_sky.png` sia visibile.
5. Verificare che il Raccoglitore emerga chiaramente dal **mare**.
6. Sconfiggere il Raccoglitore normale.
7. Verificare i quattro shot della combinazione.
8. Verificare il nuovo fight gigante 3/4 con mini-citta'.
9. Provare F / SHIFT / C e fase SOVRACCARICO.
10. Terminare il boss e controllare ritorno Torre → pannello anomalo → Archivio.

## Nota test texture
Per i test reali usare GitHub Pages o un server HTTP. Alcuni browser possono bloccare le texture WebGL (`oculo_eye.png` / `arena_sky.png`) se `index.html` viene aperto direttamente con `file://`.
