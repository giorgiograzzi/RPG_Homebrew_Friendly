# TODO.md — cose da correggere / decidere man mano

Regole: aggiungi una riga quando trovi qualcosa, spuntala quando è chiusa (con lo step o il commit). Niente voci vaghe: dì *cosa* e *dove*.
Legenda priorità: 🔴 blocca uno step · 🟡 da fare prima della release · 🟢 migliorie.

## Aperti

### Fonti e dati
- [ ] 🔴 **Censimento dell'SRD prima di estrarre**: dall'indice dei due PDF elencare esattamente cosa contiene (classi, sottoclassi, specie, background, talenti, incantesimi, oggetti magici) e scrivere i numeri attesi nei test. Non dare per scontato il contenuto: va verificato sul PDF.
- [ ] 🟡 Gli estrattori attuali leggono riepiloghi del Manuale del Giocatore (`01-05_*.pdf`) e regole di `scripts/lib/*-rules.ts` scritte su quei dati: vanno riscritti sull'SRD, non adattati a occhio.
- [ ] 🟡 Le 48 sottoclassi e gli incantesimi/specie/background fuori SRD spariscono: verificare che i privilegi/talenti rimasti non citino id non più esistenti (`validate:data` sui riferimenti incrociati).
- [ ] 🟡 Le voci `needsReview` dell'app privata non si portano dietro: ripartire da zero per i dubbi.
- [ ] 🟢 Decidere se includere gli oggetti magici dell'SRD (step 2g).

### Legale
- [ ] 🔴 Nome definitivo dell'app (ora "Personaggi SRD 5.2", provvisorio "Personaggi SRD 5.2"): niente "D&D", "Dungeons & Dragons", loghi o marchi WotC. Il nome della repo `RPG_Homebrew_Friendly` è ok.
- [ ] 🔴 Dicitura CC-BY: copiare **testo esatto** dalla prima pagina di ciascun PDF (la versione IT e quella EN sono diverse).
- [ ] 🟡 Font per la scheda PDF: usare solo font con licenza libera (es. OFL) e citarli in `ATTRIBUTION.md`.
- [ ] 🟡 Icone/immagini: usare solo asset originali (le attuali in `public/icons/` vanno riviste: se sono generiche ok, altrimenti rifarle).
- [ ] 🟡 Licenza delle dipendenze npm: controllare che siano tutte compatibili con MIT (report `npm ls` / license-checker).
- [ ] 🟡 Rileggere il testo legale finale con calma prima della release (non sono un avvocato: è una verifica tecnica, non un parere legale).

### Dati SRD (step 2a)
- [x] 🟡 Descrizioni di 2a: riscritte con parole nostre per abilità, taglie, tipi di danno, proprietà e maestrie delle armi, strumenti (`scripts/lib/descriptions.ts`, IT+EN, test `srdDescriptions.test.ts`). → chiuso
- [ ] 🟡 Restano **senza descrizione** (solo dati numerici) armi, armature, oggetti d'equipaggiamento e lingue di 2a; decidere se servono nell'interfaccia (probabile per gli oggetti con effetto: acido, fuoco dell'alchimista, ecc.).
- [ ] 🟡 Le descrizioni sono parafrasi: ricontrollare a campione che non cambino la regola (specie Cleave/Topple/Light/Range) prima della release.
- [ ] 🟡 **Causa dei caratteri rovinati (trovata)**: solo il PDF EN. Alcuni font hanno la tabella glifo→Unicode sbagliata: maiuscole A-E, L-O, Q-V, X e minuscole d, j, k, q, u, x escono come codici di controllo/C1, cifre e punteggiatura come simboli greci. Corretti in `scripts/lib/srd-clean.ts` (test `srdClean.test.ts`). Il PDF IT è pulito. Dopo la correzione i dati di 2a non cambiano.
- [ ] 🟡 **Maiuscole F, G, H, I, J, K perse nel PDF EN** (codici U+0009-U+000D che pdfjs scarta come spazi: "it Point Die", "andaxes", "ntelligence"). Provata la correzione delle tabelle ToUnicode con pdf-lib: nessun effetto sul testo, scartata. Per le verifiche EN si confrontano i nomi ignorando quelle sei lettere (`squash` in `scripts/lib/srd.ts`); le descrizioni lunghe si riscrivono (IT pulito come base).
- [ ] 🟡 **Limite del PDF EN non risolvibile con la mappa**: in alcuni paragrafi manca del tutto la prima lettera (es. "ere are" per "Here are", "or example"); i blocchi dei mostri (pag. 258+) e una riga di pag. 192 usano altri font corrotti (non servono). Per i testi lunghi (incantesimi, classi) si estrae dall'IT (pulito) e si ricostruisce l'EN a mano/riscrivendo.
- [ ] 🟡 Nel PDF IT mancano dalla tabella delle abilità le righe Furtività e Sopravvivenza (testo non estraibile): nomi e caratteristica verificati dall'elenco per caratteristica; riguardare la pagina a occhio.
- [ ] 🟡 Dotazioni (pacchetti): peso IT ≠ peso EN per Scassinatore (38 vs 42 lb), Intrattenitore (58 vs 58,5) e Sacerdote (28 vs 29); il prezzo delle dotazioni di Diplomatico, Intrattenitore e Studioso non coincide con la somma degli oggetti (39 mo vs 40, 40 vs 39,5, 40 vs 40,02). Nei dati si tiene il valore EN/del PDF. Le differenze restano anche con il testo EN corretto: sono probabilmente differenze reali tra i due PDF, da riguardare a occhio.
- [ ] 🟡 Pesi in libbre nei dati (1 lb = 0,5 kg come nell'SRD IT): l'interfaccia italiana deve mostrare i kg (step 3/5). Costi in monete di rame.
- [ ] 🟡 `loadRuleset` legge solo `data/srd/it` fino allo step 3 (selezione lingua).
- [ ] 🟢 Le munizioni hanno `amount` (pezzi per confezione); peso e costo sono della confezione.

### Dati SRD (step 2b)
- [ ] 🟡 PDF IT (pag. 93): nell'equipaggiamento del Sapiente manca una virgola ("libro (storia) pergamena (8 fogli)"). L'estrattore la ricostruisce (parentesi + parola minuscola) e il risultato coincide con l'EN: ricontrollare a occhio la pagina.
- [ ] 🟡 Equipaggiamento dei background: `"$holy_symbol"` (Accolito: "simbolo sacro", uno a scelta tra amuleto/emblema/reliquiario) e `"$tool"` (Soldato: lo stesso gioco scelto) sono segnaposto: il motore (`src/engine/creation/equipment.ts`) deve saperli risolvere (step 4). `"gaming"` come strumento = scelta di un gioco.
- [ ] 🟡 `featConfig` dei background (Accolito: lista chierico; Sapiente: lista mago) è nei dati ma il motore non lo legge ancora: precompilare la scelta `magic_initiate_list` (step 4).
- [ ] 🟡 Prerequisiti `hasFeature:fighting_style` e `hasFeature:spellcasting` dei talenti: verificare che i privilegi esistano quando arrivano le classi (2d); `brokenReferences` oggi non li controlla.
- [ ] 🟡 Effetti di gioco dei talenti: solo Allerta (bonus a iniziativa), Tiro, Difesa e Dono della vista pura hanno effetti numerici; Combattere con armi possenti/due armi e Aumento dei punteggi sono gestiti dal motore per id. Restano a testo: Aggressore selvaggio, Lottatore, Dono del fato (ricarica), Dono delle abilità di combattimento, ecc.
- [ ] 🟢 Le "Abile"/"Iniziato alla magia" sono ripetibili: il motore le gestisce con scelte separate per acquisizione (verificare in step 4/5).

### Dati SRD (step 2c)
- [ ] 🔴 Gli incantesimi concessi dalle specie (21 id in `SPELL_NAMES`, es. `faerie_fire`, `speak_with_animals`) devono esistere in 2e con **questi id**: `brokenReferences` li controlla da quando `spells` non è vuoto.
- [ ] 🟡 Percezione tellurica (Nano, Esperto minatore) non è tra i sensi del motore (`senseKind`: scurovisione, vista cieca, vista pura): resta solo testo + contatore di usi. Valutare di aggiungere `tremorsense`.
- [ ] 🟡 Volo draconico: la velocità di volo è fissata a 30 ft (nell'SRD è "pari alla tua velocità"); il motore non ha un valore "uguale alla velocità". Da rivedere se la velocità cambia.
- [ ] 🟡 Taglia a scelta (Umano e Tiefling: Media o Piccola): nei dati `sizes: ["medium","small"]`; creazione e scheda devono chiederla (step 4/5).
- [ ] 🟡 Le velocità e le distanze delle specie sono in **piedi** nei dati (come l'SRD EN); le descrizioni IT usano i metri come il PDF IT. L'interfaccia italiana deve convertire (step 3/5).
- [ ] 🟡 `saveAdvantage.against` è testo libero per lingua ("la condizione Avvelenato" / "the Poisoned condition"); il motore scrive una frase in italiano ("Vantaggio ai TS contro ..."): da localizzare con lo step 3.
- [ ] 🟡 Solo a testo (nessun effetto): Fortuna, Furtività innata, Agilità halfling, Coraggioso, Trance, Intraprendente (Ispirazione eroica), sostituzione del trucchetto dell'Elfo alto, congegni dello Gnomo delle rocce, doni della Discendenza gigantica (tutti e 6), Presenza ultraterrena (la sua caratteristica segue la scelta).
- [ ] 🟡 Scarica di adrenalina (Orco): `recharge: "short_rest"` rappresenta "riposo breve o lungo"; verificare che il motore ricarichi anche con il riposo lungo.
- [ ] 🟢 L'altezza media di ogni specie non è nei dati (non serve al motore); si può aggiungere come testo.
- [ ] 🟢 Rimossi `scripts/lib/species-rules.ts` e `feat-rules.ts` (superati da `species-srd.ts` e `feats-srd.ts`); restano da riscrivere `class-rules.ts`, `feature-play.ts`, `spells.ts`, `equipment.ts` (2d-2e).

### Dati SRD (step 2d, blocco 1: Barbaro, Guerriero, Monaco, Ladro)
- [ ] 🟡 Le colonne delle tabelle di classe hanno id **inglesi** (`rages`, `rage_damage`, `second_wind`, `weapon_mastery`, `martial_arts`, `focus_points`, `unarmored_movement`, `sneak_attack`). Il motore usa `sneak_attack`, `cantrips` e `prepared` (rinominati in 2d-2, con l'editor homebrew e i suoi test); resta il vecchio `table.attacchi` del Guerriero in `attacksPerAction`.
- [ ] 🟡 Nelle tabelle il "—" è salvato come 0 (Monaco: punti concentrazione e Movimento senza armatura al 1° livello). Le distanze delle tabelle sono in piedi (IT in metri ×10/3, verificato uguale all'EN).
- [ ] 🟡 Solo a testo (nessun effetto di gioco): Attacco irruento, Percezione del pericolo (c'è solo il Vantaggio al TS), Istinto ferino, Balzo istintivo, Colpo brutale e migliorato, Ira implacabile/persistente, Potenza indomabile, Mente tattica, Spostamento tattico, Signore delle tattiche, Attacchi studiati, la maggior parte dei privilegi del Monaco (Devia attacchi, Colpo stordente, ecc.), Colpo astuto e Colpi infidi del Ladro, Mira ferma, Schivata prodigiosa, Dote affidabile, Furfante e le altre sottoclassi. Il Vantaggio alle prove di Forza dell'ira non ha un effetto per le prove.
- [ ] 🟡 `critRange`: Critico migliorato (19) e superiore (18) sono due effetti; verificare in step 4 che il motore prenda il minimo.
- [ ] 🟡 Scelta di strumenti del Monaco (`monk_tools`, sorgente `tools:artisan_musical`) e `$tool` nell'equipaggiamento: da provare in creazione (step 4/5).
- [ ] 🟡 Il Gergo ladresco è un privilegio con id `thieves_cant` (il motore aggiunge la lingua per id) + una scelta di lingua; verificare in step 4.
- [ ] 🟡 Impostazioni del multiclasse (`multiclass`) scritte a mano e verificate solo con una frase del PDF per classe.
- [ ] 🟢 Le sottoclassi dell'SRD sono una per classe (Berserker, Campione, Mano Aperta, Furfante qui); le altre si aggiungono come homebrew.

### Dati SRD (step 2d, blocco 2: Bardo, Chierico, Paladino, Ranger)
- [ ] 🔴 Incantesimi concessi dai privilegi (devono esistere in 2e con **questi id**; il controllo in `brokenReferences` si attiva da solo): `power_word_heal`, `power_word_kill`, `divine_smite`, `find_steed`, `hunters_mark`; Dominio della Vita: `aid`, `bless`, `cure_wounds`, `lesser_restoration`, `mass_healing_word`, `revivify`, `aura_of_life`, `death_ward`, `greater_restoration`, `mass_cure_wounds`; Giuramento di devozione: `protection_from_evil_and_good`, `shield_of_faith`, `zone_of_truth`, `beacon_of_hope`, `dispel_magic`, `freedom_of_movement`, `guardian_of_faith`, `commune`, `flame_strike`.
- [ ] 🟡 Slot incantesimo: `spellSlots[livello][livello dell'incantesimo]` ricavato dalle colonne della tabella (le colonne `slot_N` non restano in `table`). Le scelte `<classe>_cantrips` / `<classe>_prepared` usano `countFrom: cantrips|prepared` (colonne inglesi; l'editor homebrew traduce "trucchetti"/"preparati" in questi id).
- [ ] 🟡 Segreti magici (Bardo 10°) e Scoperte magiche (Collegio della Sapienza 6°): scelta di incantesimi da **più liste insieme** (bardo, chierico, druido, mago): nel motore `spells:<lista>` accetta una lista sola; per ora solo testo.
- [ ] 🟡 Solo testo, senza effetto di gioco: Scintilla divina/Scacciare non morti (opzioni di Incanalare divinità del Chierico e Percezione del Divino del Paladino), Colpi benedetti (la scelta c'è, non l'effetto), Colpi radiosi (1d8 non è un valore numerico del motore), Aura di protezione (bonus ai TS agli alleati), Abiurare nemici, Controfascino, Parole taglienti, Preda del cacciatore e Tattiche difensive (scelte senza effetto).
- [ ] 🟡 Girovago (Ranger): velocità di scalata e nuoto fissate a 30 ft (nell'SRD "pari alla velocità").
- [ ] 🟡 Ispirazione bardica: gli usi tornano con riposo lungo e, dal 5° (Fonte di ispirazione), anche con riposo breve; nei dati la risorsa passa a `short_rest` dal privilegio del 5° livello ma il motore non sostituisce l'uso precedente (verificare in step 4).
- [ ] 🟡 `$holy_symbol` e `$instrument` negli equipaggiamenti di Chierico, Paladino e Bardo: segnaposto da risolvere in creazione (step 4), come per i background.
- [ ] 🟢 Il dado bardico è salvato come stringa minuscola (`d6`, `d8`...).

### Codice e struttura
- [ ] 🟡 Scheda PDF: tolta in step 1 (usava il modello ufficiale). Resta `src/export/sheetData.ts`; il pulsante "Stampa scheda" torna con il nuovo generatore (step 7). Chiavi `wizard.sheet.*` in `it.json` ancora presenti.
- [x] `scripts/extract-*.ts` e `validate-data.ts` (citavano fonti non SRD) rimossi in step 1; `validate:data` ed `extract:data` (script npm) tornano con la riscrittura in step 2.
- [ ] 🟡 `origin: "private"` (default in `src/engine/schema/content.ts` e nei test): con i dati SRD tracciati va sostituito con `"srd"` (step 2/4).
- [ ] 🟡 `Dockerfile` e `.dockerignore` parlano ancora di `data/private` (step 9).
- [ ] 🟡 Dopo lo step 1 `npm test` ha 8 file che falliscono per mancanza di `data/` (stessi di prima): tornano verdi con gli step 2-4.
- [ ] 🟡 `.env.example`: porta 8097 scelta per l'app privata; rivedere se serve (step 9).
- [x] Commento in `scripts/extract-conditions.ts`: file rimosso in step 1.
- [ ] 🟡 `ATTRIBUTION.md`: diciture trascritte dai PDF, riverificare a occhio (step 8).
- [ ] 🟡 I test `*.private.test.ts` saltano i dati mancanti: rinominarli e farli girare sempre, sui dati SRD tracciati (step 4).
- [ ] 🟡 `README` e doc dell'app privata citano il bunker, Cloudflare, porte e dominio personale: **non** portarli nella repo pubblica.
- [ ] 🟢 Workflow CI GitHub Actions (step 9).

### Frontend (step 5b)
- [ ] 🔴 Tema Windows XP / Win95 (`src/ui/xp/`, ~266 classi in 31 file, popup "Prompt di MS-DOS", font Tahoma, icona "Start") da sostituire con il tema neutro mobile-first + desktop. Decisione presa: neutro, moderno, chiaro/scuro.
- [ ] 🟡 Scegliere la palette/accento del nuovo tema (proposta: neutri + un solo colore d'accento) e il nome visibile dell'app; Giorgio conferma.
- [ ] 🟡 Su desktop la Scheda va in colonne affiancate (non a 7 tab): progettare quali blocchi vanno insieme.
- [ ] 🟡 `index.html` ha `theme-color` blu XP; il manifest PWA e le icone usano i colori vecchi (step 5b-5 e 9).
- [ ] 🟡 `src/ui/xp/contrast.test.ts` verifica i colori XP: va riscritto sui nuovi token.
- [ ] 🟡 Un solo punto di adattamento schermo oggi (`max-width: 720px`): introdurre breakpoint 640 / 1024.
- [ ] 🟢 Valutare interruttore tema (sistema / chiaro / scuro) e dimensione testo in Impostazioni.

### Prodotto
- [ ] 🟡 Con l'SRD le opzioni sono meno: pensare a un messaggio chiaro in creazione ("contenuto non presente: aggiungilo come homebrew") e a un modo semplice per importare pacchetti homebrew dell'utente.
- [ ] 🟡 Verifica in app che cambiare lingua non perda scelte del personaggio (id stabili).
- [ ] 🟢 Terza lingua in futuro? L'architettura dei dati per lingua (`data/srd/<lang>/`) la permette.

## Chiusi
- [x] 🟡 Testi in `it.json` con "2024"/"5.5"/Manuale del Giocatore e nome "D&D" → neutri (step 1)
- [x] 🟡 Nomi Dexie/backup/pacchetto/Docker rinominati `srd-personaggi` (step 1)
- [x] 🔴 **Versioni diverse dell'SRD**: EN è la **5.2** (361 pag.), IT è la **5.2.1** (405 pag.). Possono differire (testi, errata, nuove voci). Decidere: cercare l'EN 5.2.1 (Giorgio può caricarlo al posto del 5.2) oppure accettare la differenza e segnare in `ATTRIBUTION.md` le due versioni. Serve prima dello step 2. → chiuso in step 0 (EN 5.2.1 trovato in root: stessa versione dell'IT)
- [x] 🔴 Il PDF inglese in root ha un nome con `:` (`https::media.dndbeyond.com:…SRD_CC_v5.2.pdf`): rinominare in `docs/srd/SRD_5.2_en.pdf` (step 0) — su Windows/macOS i nomi con `:` danno problemi. → chiuso in step 0
- [x] 🔴 Recuperare il PDF italiano dalla cronologia dell'app privata (`2b0a85e^:IT_SRD_CC_v5.2.1.pdf`) e metterlo in `docs/srd/` (step 0). → chiuso in step 0
- [x] 🔴 Copiare l'app **senza cronologia** e senza `data/*.pdf`, `public/forms/`, `data/private` (step 0). → chiuso in step 0
