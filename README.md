# Danger & Dragons

PWA gratuita per creare e gestire personaggi di un gioco di ruolo fantasy, in **italiano e inglese**, anche **offline**.
Contiene solo i contenuti dell'**SRD 5.2.1** (CC-BY-4.0); tutto il resto lo aggiungi tu come homebrew.

_Danger & Dragons è un'app non ufficiale, creata da appassionati. Non è affiliata, approvata né sponsorizzata da Wizards of the Coast._

## Cosa fa
- **Creazione guidata** di personaggi (classe, sottoclasse, specie, background, caratteristiche, equipaggiamento, incantesimi) e **passaggio di livello**, anche multiclasse.
- **Scheda** con calcoli automatici, riposi, magia, equipaggiamento e privilegi; su desktop a colonne affiancate.
- **Scheda PDF** (A4) originale, in italiano o inglese, con font libero incorporato.
- **Homebrew**: crea le tue specie, classi, talenti, oggetti, incantesimi… ed esporta/importa pacchetti (vedi `data/homebrew/README.md`).
- **Backup e ripristino** di tutti i personaggi in un file JSON; i dati restano sul tuo dispositivo (nessun account, nessun server).
- **Lingua**: segue il browser (fallback inglese); si cambia da Impostazioni. Tema chiaro/scuro/automatico.
- **Accessibile**: testo ≥ 16px, bersagli ≥ 48px, contrasto WCAG AA, uso da tastiera.

## Uso
- **Online / installata**: apri l'app nel browser e usa «Aggiungi a Home» (iPhone/Android) o «Installa» (desktop). Dopo il primo caricamento funziona senza rete.
- **In locale**: `npm ci && npm run dev`.
- **Con Docker**:
  ```
  cp .env.example .env        # facoltativo: cambia PORT (default 8098)
  docker compose up -d --build
  ```
  L'app è statica (nginx); si aggiorna con `git pull && docker compose up -d --build`.

## Homebrew
Dalla schermata **Homebrew**: *Nuova voce*, *Importa* (file o testo incollato), *Esporta*. Esempi inventati e un modello commentato sono in `data/homebrew/`. I personaggi che usano homebrew lo portano con sé nel backup.

## Sviluppo
```
npm ci
npm run typecheck
npm test               # dati SRD, motore, interfaccia, guardie legali
npm run validate:data
npm run build
npm run e2e:smoke      # percorso completo con un browser vero (Playwright + Chromium)
npm run e2e            # layout/accessibilità: 3 viewport × IT/EN × chiaro/scuro (lento)
npm run extract:data   # rigenera data/srd/ dai PDF in docs/srd/
```
Struttura: `src/engine` (regole), `src/ui` e `src/pages` (interfaccia), `src/export` (PDF), `src/homebrew`, `src/i18n`, `data/srd` (dati IT/EN), `data/homebrew` (esempi). Piano e storico: `PLAN.md`, `TODO.md`; checklist di rilascio: `docs/RELEASE.md`.

## Licenze
- **Codice**: MIT (`LICENSE`).
- **Contenuti di gioco**: SRD 5.2.1, CC-BY-4.0.
- **Font della scheda PDF**: Noto Sans, SIL OFL 1.1 (`docs/licenses/`).
- Dettagli in `ATTRIBUTION.md` e nell'app (menu → Informazioni e licenze).

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
>
> Quest'opera include materiale tratto dal System Reference Document 5.2.1 ("SRD 5.2.1") di Wizards of the Coast LLC, disponibile all'indirizzo https://www.dndbeyond.com/srd. Il SRD 5.2.1 è concesso in licenza ai sensi della licenza di attribuzione 4.0 Internazionale di Creative Commons, disponibile all'indirizzo https://creativecommons.org/licenses/by/4.0/legalcode.

Danger & Dragons is an unofficial, fan-made app. It is not affiliated with, endorsed or sponsored by Wizards of the Coast. / Danger & Dragons è un'app non ufficiale, creata da appassionati. Non è affiliata, approvata né sponsorizzata da Wizards of the Coast.
