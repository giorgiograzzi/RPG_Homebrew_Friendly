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
- [ ] 🟡 **Limite del PDF EN non risolvibile con la mappa**: in alcuni paragrafi manca del tutto la prima lettera (es. "ere are" per "Here are", "or example"); i blocchi dei mostri (pag. 258+) e una riga di pag. 192 usano altri font corrotti (non servono). Per i testi lunghi (incantesimi, classi) si estrae dall'IT (pulito) e si ricostruisce l'EN a mano/riscrivendo.
- [ ] 🟡 Nel PDF IT mancano dalla tabella delle abilità le righe Furtività e Sopravvivenza (testo non estraibile): nomi e caratteristica verificati dall'elenco per caratteristica; riguardare la pagina a occhio.
- [ ] 🟡 Dotazioni (pacchetti): peso IT ≠ peso EN per Scassinatore (38 vs 42 lb), Intrattenitore (58 vs 58,5) e Sacerdote (28 vs 29); il prezzo delle dotazioni di Diplomatico, Intrattenitore e Studioso non coincide con la somma degli oggetti (39 mo vs 40, 40 vs 39,5, 40 vs 40,02). Nei dati si tiene il valore EN/del PDF. Le differenze restano anche con il testo EN corretto: sono probabilmente differenze reali tra i due PDF, da riguardare a occhio.
- [ ] 🟡 Pesi in libbre nei dati (1 lb = 0,5 kg come nell'SRD IT): l'interfaccia italiana deve mostrare i kg (step 3/5). Costi in monete di rame.
- [ ] 🟡 `loadRuleset` legge solo `data/srd/it` fino allo step 3 (selezione lingua).
- [ ] 🟢 Le munizioni hanno `amount` (pezzi per confezione); peso e costo sono della confezione.

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
