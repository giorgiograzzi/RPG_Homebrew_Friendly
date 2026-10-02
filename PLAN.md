# PLAN.md — RPG Homebrew Friendly (versione freeware, solo SRD 5.2)

PWA per creare e gestire personaggi, **italiano + inglese**, offline. Contiene **solo** contenuti dell'SRD 5.2 (CC-BY-4.0) e permette di aggiungere il resto come homebrew dell'utente.
Nasce dall'app privata `giorgiograzzi/Prova_creazione_dnd_character` (non si tocca: resta com'è). Il codice si copia **senza cronologia git**, così i PDF non liberi non entrano mai qui.

## Stato
**Chiusi: step 0 (PR #2), 1 (#3), 2a (#4), correttore glifi + descrizioni 2a (#5), piano 5b (#6), 2b (#7), 2c (#8), 2d-1 (#9), 2d-2 (#10), 2d-3 (#11), 2e (#12), 2f (#13): step 2 (dati SRD) chiuso. 3 (#14). 4 (#15). 5b-1 e 5b-2 (#16). 5b-3 (#17). 5b-4/5b-5 (#18): step 5b chiuso. Step 5 (#19). Step 6 (#22). Step 7 (#25). Step 8 (#26). Step 2g e step 9 in PR (stessa PR). 10: da fare.**

## Decisioni già prese (Giorgio)
| Tema | Scelta |
|---|---|
| Repo | separata: `giorgiograzzi/RPG_Homebrew_Friendly` |
| Contenuti | solo SRD 5.2 (IT e EN: 5.2.1). Niente Manuale del Giocatore, niente D&D Beyond |
| Lingue | italiano + inglese, cambio lingua dall'app; id dei contenuti uguali nelle due lingue |
| Frontend / tema | tema **neutro e moderno, mobile-first**, con layout **desktop** dedicato; chiaro/scuro; addio al tema Windows XP / Win95 (step 5b) |
| PDF scheda | scheda **originale** disegnata nel codice (pdf-lib); il PDF ufficiale WotC non c'è più |
| Homebrew | tenuto; **tolta** "copia da voce ufficiale"; esempi solo SRD |
| Licenze | codice MIT; contenuti SRD CC-BY 4.0 con la dicitura ufficiale nell'app e in `ATTRIBUTION.md` |
| Nome | **Danger & Dragons** (scelto da Giorgio il 2026-10-02). Mai la sigla «D&D» né loghi WotC; nome breve della PWA: «Danger&Dragons» |
| Dati | **tracciati in git** (sono CC-BY): niente più `data/private` |

## Come lavoriamo (regole valide in ogni chat)
1. **Un branch per step**: `step-N-nome-breve`. Un commit per sotto-passo.
2. **Si chiude uno step solo se**: `npm run typecheck`, `npm test`, `npm run validate:data` sono verdi e i test dello step (elencati sotto) esistono e passano.
3. **PR e merge: li fa Claude** (autorizzato da Giorgio il 2026-10-01). A fine step: PR verso `main` con descrizione e test, poi merge (merge commit) **solo se**: `typecheck` ok, nessun test *nuovo* rosso (gli 8 file in attesa dei dati di step 2-4 sono noti), nessun conflitto, nessun file non libero. **Si ferma e chiede** se: c'è un conflitto non banale, un test nuovo fallisce, serve una decisione di Giorgio (palette, nome app, scelta di contenuto), la modifica esce dal piano, o tocca licenze/attribuzioni. Mai force-push su `main`. A ogni merge: riepilogo breve in chat.
4. **Ad ogni step** si aggiorna: la riga *Stato* qui sopra, la casella dello step, e `TODO.md` (voci nuove e voci chiuse).
5. **Nuova chat?** Leggi prima *Stato* qui e `TODO.md`, poi riparti dal primo step non chiuso.
6. **Niente contenuto non SRD**: se un dato non si trova nel PDF SRD, non si inventa e non si scrive a memoria dal manuale: si segna in `TODO.md`. Test guardia in `src/legal/noProtected.test.ts` (parole vietate e specie/sottoclassi non SRD). Giorgio (2026-10-02): tutto deve riferirsi solo all'SRD 5.2.1, per poter pubblicare senza violare diritti.
7. Convenzioni (ereditate): file < ~300 righe, commenti in italiano, motore in `src/engine` senza UI, testi in `src/i18n/*.json`.

## Fonti in repo
- `docs/srd/SRD_5.2.1_en.pdf` (364 pag., inglese, 5.2.1).
- `docs/srd/SRD_5.2.1_it.pdf` (405 pag., italiano, 5.2.1).

---

## Step

### Step 0 — Bootstrap della repo  ☑
- **Cosa**: rinomina il PDF inglese in `docs/srd/SRD_5.2_en.pdf`; recupera il PDF italiano in `docs/srd/SRD_5.2.1_it.pdf`; copia dall'app privata (da `origin/main`, **senza** `.git`): `src/`, `scripts/`, `public/` (senza `public/forms/`), `index.html`, `vite.config.ts`, `tsconfig.json`, `package*.json`, `Dockerfile`, `docker/`, `docker-compose.yml`, `.env.example`, `.dockerignore`; **non** copiare `data/*.pdf`, `data/srd/`, le vecchie `PLAN/ARCHITECTURE/DATA_TODO/README`. Aggiungi `LICENSE` (MIT), `.gitignore`, `README.md` nuovo, `ATTRIBUTION.md` con la dicitura CC-BY (testo esatto dalla prima pagina di ciascun PDF).
- **Test/verifica**: `npm ci` ok; `npm run typecheck` ok (i test di dati possono ancora fallire: si sistemano negli step 1-4); `git ls-files | grep -i pdf` mostra solo i due SRD in `docs/srd/`; nessun file con `:` nel nome.

### Step 1 — Pulizia del non libero + test guardia  ☑
- **Cosa**: togli ogni riferimento a Manuale del Giocatore / PHB / D&D Beyond / "2024" / "5.5" in codice, testi, commenti, `index.html`, manifest PWA, `it.json`; rinomina l'app (nome neutro); rimuovi `public/forms/`; rimuovi/neutralizza i testi "bookPage" e le dizioni del manuale. Toglie dal `.gitignore` le regole su `data/private` e `docs/rules`.
- **Test**: nuovo `src/legal/noProtected.test.ts` che scandisce `src/`, `data/`, `public/`, `index.html` e fallisce se trova: `dndbeyond`, `Player's Handbook`, `Manuale del Giocatore`, `PHB`, `Wizards` (tranne `ATTRIBUTION`/dicitura), `Dungeons & Dragons`, estensioni `.pdf` fuori da `docs/srd/`. Il test deve fallire prima della pulizia e passare dopo.

### Step 2 — Estrazione dati SRD (IT + EN)  ☐
Riscrittura degli estrattori in `scripts/` perché leggano **solo** i due PDF SRD e scrivano JSON tracciati in `data/srd/it/` e `data/srd/en/` (stessi id in entrambe). Un sotto-passo = un commit = un blocco di dati.
- **2a Fondamenti** ☑: abilità, linguaggi, taglie, tipi di danno, PX/competenza, armi (+ proprietà e maestrie), armature, strumenti, equipaggiamento, monete.
- **2b Background e talenti** ☑: 4 background (Accolito, Criminale, Sapiente, Soldato) e 17 talenti (4 Origini, 2 Generali, 4 Stile di combattimento, 7 Doni epici), `scripts/extract-origins.ts`, verifica incrociata IT/EN.
- **2c Specie** ☑: 9 specie (Dragonide, Nano, Elfo, Gnomo, Goliath, Halfling, Umano, Orco, Tiefling) con lignaggi, retaggi, discendenze e tratti, `scripts/extract-species.ts` (verifica sui PDF).
- **2d Classi e sottoclassi** (3 blocchi, un commit/PR ciascuno): le 12 classi (tabelle 1-20) e la sottoclasse dell'SRD. `scripts/extract-classes.ts` verifica su IT ed EN tratti, equipaggiamento, tabella dei livelli e intestazioni.
  - **2d-1** ☑: Barbaro, Guerriero, Monaco, Ladro (senza incantesimi di classe).
  - **2d-2** ☑: Bardo, Chierico, Paladino, Ranger (incantatori: slot, trucchetti e preparati dalla tabella).
  - **2d-3** ☑: Druido, Stregone, Warlock, Mago.
- **2e Incantesimi** ☑ (339 incantesimi IT+EN; le tabelle slot multiclasse passano a 2f): tutti quelli dell'SRD (livello, scuola, classi, tempo, gittata, componenti, durata, testo, livelli superiori) + liste per classe + tabelle slot.
- **2f Condizioni, riposi, morte e regole di gioco** ☑ usate dal motore: 15 condizioni (Esaurimento incluso), tabella slot del multiclasse, regole di creazione (serie standard, costo in punti, serie per classe, tabella PE, fasce di partenza, 9 allineamenti). Riposi e morte restano costanti nel motore (da riverificare sull'SRD nello step 4).
- **2g Oggetti magici** ☑ (258 voci IT+EN, `scripts/extract-magic.ts`): tipo, rarità, sintonia e testo con tabelle; sono voci `items` con categoria `magic` e blocco `magic`, in `data/srd/<lingua>/magic_items.json`. L'abbinamento IT↔EN è la tabella a mano `scripts/lib/magic-names.ts`, ricontrollata dallo script (categoria, rarità, sintonia, dadi, CD). Gli effetti di gioco non sono modellati (solo testo, sintonia e cariche a mano).
- **Test per ogni sotto-passo**: `npm run validate:data` (schema Zod + riferimenti incrociati) su entrambe le lingue; test "IT e EN hanno gli stessi id" (`src/data/srd.parity.test.ts`); **conteggi attesi** scritti nel test (es. n. di classi, specie, incantesimi) presi dall'indice del PDF; controllo a campione di ≥10 voci per blocco contro il PDF (riportato nel riepilogo); i dubbi vanno in `TODO.md`, non inventati.

### Step 3 — Caricamento dati e lingua (i18n IT/EN)  ☑
- **Cosa**: `loadRuleset(lang)` legge `data/srd/<lang>/`; `src/i18n/en.json` accanto a `it.json`; selettore lingua in Impostazioni (default = lingua del browser, fallback EN); la lingua cambia testi **e** dati senza perdere i personaggi (salvati per id).
- **Test**: test che ogni chiave di `it.json` esiste in `en.json` e viceversa; test di cambio lingua (stesso personaggio, calcolo identico, nomi diversi); il ruleset si carica in entrambe le lingue; build con dati vuoti non si rompe.

### Step 4 — Motore con dati SRD  ☑ (`homebrew.content.test.ts` rosso fino allo step 6: chiuso lì)
- **Cosa**: adatta il motore ai dati ridotti (niente riferimenti a voci non SRD); i vecchi test `*.private.test.ts` diventano test normali (i dati ora sono tracciati) e vengono riscritti sui contenuti SRD.
- **Test**: `npm test` verde per compute, creation, levelup, magic, play, equipment; test nuovo "ogni voce dei dati SRD è creabile": per ogni classe × sottoclasse × specie × background si crea un personaggio di livello 1 e uno di livello 5 senza errori.

### Step 5 — Wizard, scheda e level-up  ☑ (smoke Playwright `e2e/smoke.mjs`; trovata e costruita la schermata di level-up che mancava)
- **Cosa**: verifica a mano e con test tutta l'interfaccia con i dati SRD in IT e EN: creazione, scheda, tab Equip/Magia, riposi, passaggio di livello, backup/ripristino.
- **Test**: test store/db esistenti verdi; smoke test Playwright (Chromium già installato): crea un personaggio in IT, cambia in EN, sale di livello, esporta e reimporta il backup.

### Step 5b — Frontend: tema neutro mobile-first + versione desktop  ☑
Oggi l'interfaccia imita Windows XP / Win95 (`src/ui/xp/`, 313 righe di CSS, ~266 classi `xp-*`/`dos-*` in 31 file, un solo punto di adattamento a 720px). Si sostituisce con un tema originale, e si aggiunge un layout per schermi grandi. Si fa **dopo lo step 5** (l'app funziona con i dati SRD) e **prima di 7 e 8** (che aggiungono schermate: pulsante Stampa, Informazioni e licenze).
- **5b-1 Fondamenta** ☑ (palette «indaco su grigio freddo» scelta da Giorgio il 2026-10-02): design token CSS (colori, spazi, raggi, ombre, tipografia) in `src/ui/theme/` al posto di `src/ui/xp/`; font di sistema (nessun font di terzi); chiaro/scuro con `prefers-color-scheme` + interruttore in Impostazioni; icone SVG originali; accento e palette neutri (scelta da confermare con Giorgio); rimuovere ogni riferimento a Windows/MS-DOS/Tahoma/"Start".
- **5b-2 Guscio dell'app** ☑: mobile (<640px) con barra a schede in basso e finestre a tutto schermo/«bottom sheet»; tablet (640-1024px); desktop (≥1024px) con navigazione laterale, contenuto centrato con larghezza massima e popup come finestre modali; aree sicure iPhone (`env(safe-area-inset-*)`), `theme-color` coerente con il tema.
- **5b-3 Schermate** ☑ (scheda a colonne da 1100px, wizard e Homebrew controllati su 3 viewport, messaggi del motore tradotti): Personaggi, wizard di creazione e level-up, Scheda (7 tab; su desktop Stato/Statistiche/Attacchi/Magia **affiancati in colonne** invece che a tab), Equip, Homebrew, Impostazioni. Ogni schermata prima in versione mobile, poi desktop.
- **5b-4 Accessibilità e usabilità** ☑ (focus nelle finestre, «vai al contenuto», navigazione con ruoli corretti, contrasto verificato sulle pagine vere): testo ≥16px e bersagli ≥48px (regola ereditata, da mantenere), contrasto WCAG AA in chiaro e scuro, focus visibile, navigazione da tastiera su desktop, `prefers-reduced-motion`, testi IT/EN senza troncamenti.
- **5b-5 Pulizia** ☑: eliminare `src/ui/xp/`, aggiornare `index.html` (colori), manifest PWA e icone provvisorie; stampa della scheda (CSS `@media print`) senza barre.
- **Test**: `contrast.test.ts` riscritto sui nuovi token (AA in chiaro e scuro); test Playwright con screenshot a 3 viewport (375×812, 768×1024, 1280×800) × IT/EN × chiaro/scuro; controlli automatici di **nessuno scroll orizzontale**, bersagli ≥48px e nessun testo tagliato; guardia nel test legale: niente `xp-`, `dos-`, "Windows", "MS-DOS", "Tahoma" in `src/` e `index.html`; `npm run build` ok e PWA ancora installabile.

### Step 6 — Homebrew adattato  ☑
- **Cosa**: rimuovi "copia da voce ufficiale" (UI, logica in `src/homebrew/`, `presets`); riscrivi `data/homebrew/` (modello commentato + esempi) usando solo contenuti SRD o inventati; README homebrew che spiega come l'utente aggiunge i propri contenuti.
- **Test**: gli esempi passano lo schema e si importano; test che l'editor non espone la copia da voce ufficiale; export/import di pacchetti e backup ancora verdi.

### Step 7 — Scheda PDF libera  ☑ (Noto Sans, scelto da Giorgio il 2026-10-02)
- **Cosa**: nuovo generatore con pdf-lib, layout originale (non copiare l'impaginazione della scheda ufficiale), A4, IT e EN, font liberi incorporati (es. OFL). Sostituisce `src/export/sheetPdf.ts` basato sul PDF ufficiale.
- **Test**: test che genera il PDF per un personaggio d'esempio in IT e EN, lo rilegge e controlla pagine, testi chiave e assenza di campi vuoti; nessun asset di terzi non libero (licenza del font in `ATTRIBUTION.md`).

### Step 8 — Attribuzione e note legali nell'app  ☑ (dicitura identica nei due PDF SRD 5.2.1, verificata dal test)
- **Cosa**: schermata "Informazioni e licenze" con la dicitura CC-BY esatta (versione per lingua: 5.2.1 sia IT sia EN), link alla licenza, avviso "contenuto non ufficiale, non affiliato a WotC", MIT del codice; stessa dicitura in `ATTRIBUTION.md`, `README` e (se presente) sul PDF della scheda.
- **Test**: test che la dicitura è presente nell'app, in `ATTRIBUTION.md` e nel PDF generato; il guardia dello step 1 continua a passare.

### Step 9 — PWA, Docker e CI  ☑ (workflow `.github/workflows/ci.yml`, `e2e/offline.mjs`; `docker compose build` verificato solo dal job CI: nella sandbox non c'è il demone Docker)
- **Cosa**: adatta manifest/nome/icone (nuove, originali), Docker (il build non dipende più da `data/private`), workflow GitHub Actions: `typecheck`, `test`, `validate:data`, `build`.
- **Test**: `docker compose build` ok; CI verde; build PWA offline verificato (Playwright con rete spenta dopo il primo caricamento).

### Step 10 — Rifinitura e release  ☐
- **Cosa**: passata finale sul `TODO.md`, README con istruzioni (uso, homebrew, lingue, licenze), controllo legale finale (rilettura della dicitura, del nome, dei loghi), tag `v1.0.0`.
- **Test**: tutta la suite + guardia legale + smoke test; checklist finale firmata da Giorgio.

---

## Mappa rapida dei test
| Step | Test principali |
|---|---|
| 0 | `npm ci`, `typecheck`, nessun PDF fuori da `docs/srd/` |
| 1 | guardia "niente contenuto protetto" |
| 2 | `validate:data`, parità id IT/EN, conteggi attesi, campione ≥10 voci |
| 3 | parità chiavi i18n, cambio lingua, build con dati vuoti |
| 4 | suite motore, "ogni voce è creabile" |
| 5 | store/db, smoke Playwright IT→EN→level-up→backup |
| 5b | contrasto AA chiaro/scuro, screenshot 3 viewport × IT/EN × tema, niente scroll orizzontale, guardia "niente tema Windows" |
| 6 | esempi homebrew validi, niente copia ufficiale |
| 7 | PDF IT/EN generati e riletti |
| 8 | dicitura presente in app, `ATTRIBUTION.md`, PDF |
| 9 | Docker, CI, offline |
| 10 | tutto + checklist finale |
