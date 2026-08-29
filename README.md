# RANGER ZERO v24.1 — TEAM & GIANT BATTLE 360

Build cumulativa basata su **v24 GIANT FIGHT REWORK**, mantenendo anche il fix v23.0.1 di intro/allarme/trasformazione e tutto il safety pass derivato dalla v22.

## Focus della v24.1

Questa versione corregge il playtest della v24 senza rifare la sequenza di combinazione, che resta uno dei momenti principali del gioco.

### Squadra sulla spiaggia
- Wave 1: 3 scagnozzi.
- Wave 2: 4 scagnozzi.
- Arco, Meridiana e gli altri due Ranger combattono in entrambe le wave.
- Dopo la Wave 2 non restano piu' congelati: si dispongono verso il mare durante il reveal.
- Quando Il Raccoglitore raggiunge la riva, i quattro Ranger continuano a combattere con Zero.
- Gli alleati fanno danno reale ma minimo e non possono infliggere il colpo finale al boss.
- Fra seconda wave e Raccoglitore TIC fornisce una carica d'emergenza fino a **+25 HP**, senza riportare automaticamente Zero al 100%.

### Raccoglitore
- Continua a emergere realmente dal mare.
- Mantiene il volto/maschera della v24.
- La squadra lo attacca sui fianchi invece di fermarsi dopo le wave.

## Combinazione Colosso
La sequenza della v24 e' mantenuta:
1. gambe;
2. nucleo/torso;
3. braccia;
4. testa;
5. hero shot.

Correzione importante: la combinazione usa **gli stessi quattro Ranger presenti sulla spiaggia**. Durante la convergenza i modelli normali vengono nascosti, quindi non compaiono piu' Ranger duplicati/clonati.

## Giant Battle 3/4 — fix camera
La camera del combattimento non eredita piu' un angolo fisso dalla cinematic.

Durante `GIANT BATTLE` viene ricalcolata ogni frame sul punto medio fra:
- Colosso Ranger;
- Raccoglitore gigante.

In questo modo il gameplay non puo' continuare dietro una visuale rimasta bloccata sulla cutscene.

## Giant Battle — bilanciamento
Lo scontro non deve piu' essere vincibile semplicemente spammando F/C/SHIFT senza leggere il boss.

- Boss: **520 HP**.
- `F`: 10 danni con cooldown piu' netto.
- `C`: speciale solo a energia piena, 55 danni.
- `SHIFT`: guardia con cooldown; la finestra perfetta richiede timing.
- Guardia perfetta ricarica anche energia.
- Tre telegraph del boss:
  - PUGNO GIGANTE;
  - COLPO DALL'ALTO;
  - RAGGIO IN CARICA.
- La fase `SOVRACCARICO` aumenta la pressione.
- I due giganti fanno piccoli spostamenti laterali automatici e affondi durante i colpi, invece di restare statue ferme.
- Il finisher con `C` resta obbligatorio alla fine.

## Panorama 360
`arena_sky.png` e' ora il panorama equirettangolare **2:1** fornito per questa build (1774x887).

Non viene piu' usato come singolo pannello frontale.

Il renderer lo avvolge su un **cilindro a 32 segmenti** intorno all'arena:
- il mare/tramonto centrale della texture guarda verso il punto di emersione del Raccoglitore;
- la cucitura viene messa dietro il punto di ingresso;
- la camera puo' guardare lateralmente senza mostrare il bordo del vecchio fondale;
- le bande procedurali restano sotto come fallback mentre la texture si carica.

La mini-citta' 3D della v24 resta all'interno del panorama per dare scala ai due giganti.

## Intro preservata
Una nuova partita mantiene obbligatoriamente:

**Torre → dialoghi → allarme → trasformazione visibile → trasferimento → spiaggia**

`SPAZIO` dal titolo avvia una nuova partita. `CONTINUA` resta una scelta separata.

## Safety mantenuta
- checkpoint automatici;
- CONTINUA;
- pausa P / ESC;
- auto-pausa su perdita focus;
- Game Over da checkpoint pulito;
- key repeat filtrato;
- debug solo con `?dev=1`;
- texture NPOT sicure;
- render scale limitato;
- WebGL context-loss handler;
- coordinate non finite protette;
- clamp nemici;
- buffer dinamici riutilizzati;
- LIMEN_META_V1 + compatibilita' precedente.

## Flusso prioritario di playtest
1. Nuova partita: verificare briefing, allarme e trasformazione.
2. Wave 1 e Wave 2 con i quattro Ranger attivi.
3. Controllare la cura TIC dopo la seconda wave.
4. Controllare il panorama 360 guardando anche lateralmente.
5. Verificare emersione del Raccoglitore dal mare.
6. Verificare che gli NPC continuino ad aiutarvi contro Il Raccoglitore.
7. Sconfiggere il midboss e verificare che non compaiano Ranger duplicati durante la combinazione.
8. Dopo l'hero shot, verificare che la camera passi davvero al fight 3/4 e resti centrata sui due giganti.
9. Provare a spammare F/C/SHIFT: il boss deve richiedere comunque lettura dei telegraph e timing della guardia.
10. Completare il finisher e verificare Torre → pannello anomalo → Archivio.

## Nota texture
Per testare le texture WebGL usare GitHub Pages o un server HTTP. Alcuni browser bloccano `oculo_eye.png` e `arena_sky.png` se `index.html` viene aperto direttamente tramite `file://`.
