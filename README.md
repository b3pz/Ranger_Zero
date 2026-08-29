# RANGER ZERO v25 — CHARACTER ARC / SUIT REWORK / CIVILIAN LIFE

Base cumulativa: v24.1.1 CAMERA / 360 / TUTORIAL HOTFIX.

## Obiettivo della v25
Questa build non aggiunge nuove mappe o nuovi boss: trasforma la squadra da semplici comparse in personaggi con un piccolo arco narrativo e rende piu' leggibile il contrasto fra persone e armature Ranger.

## Nuova apertura giocabile
Dopo il briefing di Oculo non parte piu' immediatamente l'allarme.
Zero resta in civile e deve conoscere la squadra nella Torre:
- ARCO — leader protettivo, crede ancora in Oculo.
- MERIDIANA — tecnica e sospettosa; nota subito qualcosa di strano nella numerazione di Zero.
- JUN — ironico, usa le battute per gestire la paura.
- VALE — disciplinata, difende il protocollo.

Dopo aver parlato con tutti e quattro parte la sequenza:
briefing -> allarme -> trasformazione -> trasferimento -> spiaggia.

## Squadra viva nella Torre
I quattro membri non sono piu' disposti come una fila di manichini:
- sono distribuiti in punti diversi della Sala di Comando;
- nel rientro post-boss si muovono verso console e pannelli con waypoint scriptati;
- TIC attraversa la sala e raggiunge fisicamente il pannello anomalo;
- e' possibile parlare di nuovo con Arco, Meridiana, Jun e Vale prima di entrare nell'Archivio.

## Forma civile / trasformazione libera
Dopo aver sbloccato la prima trasformazione:
- `R` in TORRE o ARCHIVIO = TRASFORMA / RILASCIA ARMATURA.
- Non e' disponibile durante il combattimento.
- Il checkpoint conserva la forma scelta.
- L'Archivio puo' quindi essere esplorato sia in civile sia in armatura.

La scena delle capsule reagisce alla scelta:
- in armatura viene rilevata la firma RANGER ZERO;
- in civile il vecchio Ranger avverte Zero di togliere la tuta quando puo' e suggerisce che l'armatura e' il legame con la Torre.

## Archivio piu' dinamico
- Meridiana entra realmente con Zero e si sposta fra terminale e capsule.
- TIC pattuglia/scansiona la stanza.
- Una vecchia unita' in capsula reagisce e parla.
- La rivelazione include la memoria cancellata di TIC e le precedenti Meridiana.
- Oculo spiega che l'armatura e' anche un collegamento di misura/controllo, non soltanto un costume da combattimento.

## Armature Ranger ridisegnate proceduralmente
I modelli restano low-poly e leggeri ma ora hanno:
- sottotuta scura separata;
- corazza toracica colorata;
- spallacci;
- cintura scura con fibbia;
- guanti/avambracci corazzati;
- ginocchiere e stivali corazzati;
- visiera nera ampia;
- mandibola metallica;
- elementi laterali del casco e cresta.

L'obiettivo e' allontanare la silhouette da una muta da sommozzatore e avvicinarla a un vero eroe tokusatsu originale, senza copiare IP esistenti.

## Preservato dalla v24.1.1
- doppia wave;
- alleati in combattimento;
- Raccoglitore dal mare;
- cura TIC;
- combinazione del Colosso;
- giant fight 3/4;
- panorama 360;
- mini-citta';
- tutorial Colosso;
- fase 2 e finisher;
- checkpoint e safety pass;
- tre finali LIMEN.

## Controlli principali
- W / S = avanti / indietro
- A / D = ruota Zero
- Q / E = camera
- SPAZIO = interagisci / dialoghi
- F = attacco
- SHIFT = schivata / guardia nel Colosso
- C = speciale
- R = trasforma / rilascia armatura nelle zone sicure dopo lo sblocco
- P / ESC = pausa

## Test automatici eseguiti
- `node --check game.js`: OK.
- Intro interattiva: 4/4 personaggi -> allarme -> trasformazione -> arena: OK.
- Rientro post-boss: squadra civile + waypoint: OK.
- Trasformazione manuale con R nelle zone sicure: OK.
- Ripristino Archivio in civile: OK.
- Capsule in forma civile: reazione/dialogo: OK.
- Loop combat v24.1 (wave 1, wave 2, Raccoglitore, Colosso): inizializzazione/runtime mock OK.

Nota: il playtest visivo finale va comunque fatto nel browser/GitHub Pages, soprattutto per valutare silhouette delle nuove tute e posizioni dei waypoint NPC.
