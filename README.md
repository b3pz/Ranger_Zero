# RANGER ZERO v24.1.1 — CAMERA / 360 / TUTORIAL HOTFIX

Base: v24.1 TEAM & GIANT BATTLE 360.

## Fix bloccanti
- Corretto il giant fight che sembrava bloccato su un angolo pur continuando a ricevere F/C/SHIFT.
- Causa individuata: le quattro pareti-cielo fallback venivano disegnate davanti al panorama e una di esse finiva tra la camera 3/4 e i giganti.
- `arena_sky.png` 360 ora viene renderizzato come vero background senza depth test; le pareti a bande compaiono solo finche' la texture non e' pronta.
- L'immagine 360 inclusa e' esattamente quella 1774x887 fornita nel playtest: non devi rigenerarla.

## Tutorial Colosso
Prima dello scontro il gioco si ferma e spiega chiaramente:
- F = pugno / carica energia
- SHIFT = guardia; timing corretto = Guardia Perfetta
- C = speciale solo con energia piena
- SPAZIO / COMBATTI avvia il boss fight

Durante il tutorial il boss non attacca. Al via la camera viene ricostruita in 3/4 e il primo attacco ha un ritardo maggiore.

## Preservato
Tutta la v24.1: doppia wave, alleati contro Raccoglitore, cura TIC, emersione dal mare, combinazione, mini-citta', fase 2, finisher, Archivio, checkpoint e safety pass.
