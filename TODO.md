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
- [ ] 🔴 Nome definitivo dell'app (provvisorio "Personaggi SRD 5.2"): niente "D&D", "Dungeons & Dragons", loghi o marchi WotC. Il nome della repo `RPG_Homebrew_Friendly` è ok.
- [ ] 🔴 Dicitura CC-BY: copiare **testo esatto** dalla prima pagina di ciascun PDF (la versione IT e quella EN sono diverse).
- [ ] 🟡 Font per la scheda PDF: usare solo font con licenza libera (es. OFL) e citarli in `ATTRIBUTION.md`.
- [ ] 🟡 Icone/immagini: usare solo asset originali (le attuali in `public/icons/` vanno riviste: se sono generiche ok, altrimenti rifarle).
- [ ] 🟡 Licenza delle dipendenze npm: controllare che siano tutte compatibili con MIT (report `npm ls` / license-checker).
- [ ] 🟡 Rileggere il testo legale finale con calma prima della release (non sono un avvocato: è una verifica tecnica, non un parere legale).

### Codice e struttura
- [ ] 🟡 `.env.example`: porta 8097 scelta per l'app privata; rivedere se serve (step 9).
- [ ] 🟡 Commento in `scripts/extract-conditions.ts` cita fonti non SRD: sparisce con la riscrittura degli estrattori (step 2).
- [ ] 🟡 `ATTRIBUTION.md`: diciture trascritte dai PDF, riverificare a occhio (step 8).
- [ ] 🟡 Nome del database Dexie e chiavi localStorage: usare nomi nuovi per non scontrarsi con l'app privata se servite dallo stesso dominio.
- [ ] 🟡 I test `*.private.test.ts` saltano i dati mancanti: rinominarli e farli girare sempre, sui dati SRD tracciati (step 4).
- [ ] 🟡 `README` e doc dell'app privata citano il bunker, Cloudflare, porte e dominio personale: **non** portarli nella repo pubblica.
- [ ] 🟡 Testi in `it.json` che citano regole del "2024"/"5.5": riscriverli neutri (step 1).
- [ ] 🟢 Workflow CI GitHub Actions (step 9).

### Prodotto
- [ ] 🟡 Con l'SRD le opzioni sono meno: pensare a un messaggio chiaro in creazione ("contenuto non presente: aggiungilo come homebrew") e a un modo semplice per importare pacchetti homebrew dell'utente.
- [ ] 🟡 Verifica in app che cambiare lingua non perda scelte del personaggio (id stabili).
- [ ] 🟢 Terza lingua in futuro? L'architettura dei dati per lingua (`data/srd/<lang>/`) la permette.

## Chiusi
- [x] 🔴 **Versioni diverse dell'SRD**: EN è la **5.2** (361 pag.), IT è la **5.2.1** (405 pag.). Possono differire (testi, errata, nuove voci). Decidere: cercare l'EN 5.2.1 (Giorgio può caricarlo al posto del 5.2) oppure accettare la differenza e segnare in `ATTRIBUTION.md` le due versioni. Serve prima dello step 2. → chiuso in step 0 (EN 5.2.1 trovato in root: stessa versione dell'IT)
- [x] 🔴 Il PDF inglese in root ha un nome con `:` (`https::media.dndbeyond.com:…SRD_CC_v5.2.pdf`): rinominare in `docs/srd/SRD_5.2_en.pdf` (step 0) — su Windows/macOS i nomi con `:` danno problemi. → chiuso in step 0
- [x] 🔴 Recuperare il PDF italiano dalla cronologia dell'app privata (`2b0a85e^:IT_SRD_CC_v5.2.1.pdf`) e metterlo in `docs/srd/` (step 0). → chiuso in step 0
- [x] 🔴 Copiare l'app **senza cronologia** e senza `data/*.pdf`, `public/forms/`, `data/private` (step 0). → chiuso in step 0
