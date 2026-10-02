# PLAN2.md — Audit della creazione personaggio + piano di rifinitura

Seconda fase dopo `PLAN.md` (step 0–8 chiusi; 9 e 10 ancora da fare). Nasce da un audit del 2026-10-02 su: modalità di creazione del giocatore, termini italiani rispetto al manuale (SRD 5.2.1 IT, `docs/srd/SRD_5.2.1_it.pdf`), prove a campione sul motore, parte "back" (archivio, backup, PWA).

Come è stato fatto l'audit: lettura di `src/engine/creation/*`, `src/wizard/*`, `src/db/*`, `src/store/*`; confronto automatico dei nomi dei dati con il testo del PDF IT; prove con test usa-e-getta (non committati) su tutte le classi ai livelli 1, 2, 3, 4, 6, 8, 9, 12, 15, 17, 19, 20 e su alcuni scenari (cambio classe/specie/livello, metodi di punteggio, creazione senza nome).

## 1. Cosa funziona (verificato)
- `typecheck` pulito; `npm test`: 575 test su 577 passano (i 2 che falliscono sono il bug B1 qui sotto).
- Tutti i nomi dei dati IT (classi, sottoclassi, specie, background, talenti, incantesimi, armi, armature, strumenti, abilità, condizioni, tipi di danno, maestrie, proprietà, privilegi e tratti) compaiono nel PDF italiano: **0 mancanti**. Le 12 voci "mancanti" tra gli oggetti sono nomi composti (es. «Focus arcano (cristallo)»), non errori.
- Creazione: ogni classe a 12 livelli diversi (1→20) si completa, si chiude e non produce avvisi; le domande rimaste senza risposta sono zero.
- Cambio classe: le scelte che non valgono più vengono tolte con richiesta di conferma. Rifare i tiri si blocca se disattivato. Senza nome non si chiude.

## 2. Bug trovati
| # | Gravità | Dove | Cosa |
|---|---|---|---|
| B1 | 🔴 CI | `src/export/sheetPdf.test.ts:40` | Scrive in `/tmp/claude-0/pdfout/…`: la cartella non esiste altrove, quindi il test fallisce (2 test). Va tolto il `writeFileSync` o usata una cartella temporanea creata dal test. |
| B2 | 🟡 | `wizard/Summary.tsx`, `sheet/StatusTab.tsx`, `sheet/StatsTab.tsx`, `pages/Equip.tsx` | L'interfaccia **italiana** mostra «ft» e «lb», mentre il manuale IT usa **metri e kg** (769 «m», 174 «kg», 0 «ft»/«lb» nel PDF). Manca una conversione per lingua (la nota esiste già nel `TODO.md`, sezione 2a/2c). Il PDF della scheda ha lo stesso problema. |
| B3 | 🟡 | `engine/creation/*`, `compute/*`, `equipment/*`, `magic/*`, `play/*`, `db/*`, `store/app.ts` | Decine di messaggi scritti **solo in italiano** (non passano da `tr()`): «Supererebbe il massimo», «Tira i dadi per i punteggi», «Assegna i valori…», «Manca una scelta per l'equipaggiamento», «Arma Pesante con For/Des sotto 13», «Oggetto non nel tuo inventario», «Salvataggio fallito», «Senza nome», «(importato)»… Con l'app in inglese compaiono in italiano. |
| B4 | 🟡 | `engine/creation/questions.ts` (`AB_IT`) | I nomi delle caratteristiche negli aumenti sono sempre in italiano (Forza, Destrezza…) anche in inglese. |
| B5 | 🟡 | `engine/creation/questions.ts` (`equipmentName`), `wizard/Summary.tsx` | La valuta è scritta «mo» anche in inglese (dovrebbe essere «gp»). |
| B6 | 🟡 | `engine/creation/decisions.ts` / `setStartLevel` | Abbassando il livello (es. 5→2) la sottoclasse scelta resta salvata anche sotto il livello della sottoclasse (3): non dà privilegi, ma resta nei dati e riappare risalendo. Meglio toglierla con la solita conferma. |
| B7 | 🟢 | `it.json` | Testi rimasti da sviluppo: `characters.creationSoon`, `soon.sheet/equip/magic`, `wizard.sum.features/done/progress` non sono usati; `wizard.noCreation` cita «npm run extract:data… sul server» (testo da sviluppatore mostrato all'utente). |

## 3. Termini italiani diversi dal manuale
| Nell'app (it.json) | Nel manuale IT | Dove |
|---|---|---|
| Esaurimento | **Indebolimento** (è il nome della condizione `exhaustion` nei dati stessi) | `play.exhaustion`, `play.longConfirm`, ConditionsTab |
| Linguaggi (passo, riepilogo, scheda) | **Lingue** («Linguaggi» nel manuale è solo un incantesimo) | `wizard.steps.languages`, `wizard.sum.languages`, `play.languages`, `homebrew.kinds.languages` |
| Array standard | **Serie standard** | `wizard.scores.array` |
| Tiri su Morte | **Tiri salvezza contro morte** | `play.deathSaves` |
| Azione Bonus (maiuscola) | Azione bonus | `magic.time.bonus_action` |
| Bonus competenza | **Bonus di competenza** | `play.pb` |
| Livello/«Punti Ferita» | il manuale scrive «punti ferita» minuscolo nel testo corrente (le maiuscole vanno bene nelle etichette) | solo estetica, nessuna azione |

Da decidere con Giorgio: «Tiro dei dadi» e «Acquisto a punti» **non sono nell'SRD 5.2.1** (nel PDF c'è solo la serie standard, più la tabella «Serie standard per classe»). Sono regole note e non protette, ma il progetto dice «solo SRD»: tenerli come metodi "extra" con una nota, oppure toglierli. Vale anche per il metodo "Manuale" (che accetta 20 in tutto).

## 4. Lacune della creazione rispetto al manuale
Il manuale (capitolo «Creare un personaggio») prevede: classe → origine (background, specie, lingue) → punteggi → allineamento → dettagli → equipaggiamento / livelli superiori. L'app copre tutto questo; mancano:
1. **Taglia a scelta** (Umano e Tiefling: Media o Piccola). Non c'è nessuna domanda e nei dati calcolati non esiste una taglia: la scheda PDF stampa «Media / Piccola» insieme (`export/sheetData.ts:62`).
2. **Dettagli del personaggio**: il passo "Dettagli" chiede solo il nome. Mancano aspetto, età/altezza/peso, tratti, ideali, legami, difetti, storia, nome del giocatore (esiste solo `notes` libero, nella scheda). Il PDF non ha dove metterli.
3. **Multiclasse alla creazione**: partendo da livello > 1 si crea una sola classe. La seconda classe si può aggiungere solo salendo di livello dalla scheda. Il manuale ("Iniziare a livelli superiori") lo permette.
4. **Oggetti magici di partenza**: a livello 2+ l'app scrive «Oggetti magici da concordare col DM» ma non li può assegnare (non ci sono oggetti magici nei dati: decisione 2g del `TODO.md` ancora aperta).
5. **Riepilogo povero**: mostra PF/CA/velocità/caratteristiche/lingue/incantesimi/oggetti, ma non abilità e competenze (salvezze, armature, armi, strumenti) né i privilegi ottenuti, quindi non si può ricontrollare la scelta prima di chiudere.
6. **Set da gioco** chiesto solo nel riepilogo (non nel passo "Dettagli" con l'equipaggiamento).
7. **Simbolo sacro** sempre «amuleto» di default (l'SRD ne ha tre): la scelta si fa dopo, nello zaino.
8. **Descrizioni mancanti** per armi, armature e oggetti (punto aperto nel `TODO.md`, 2a): durante la scelta dell'equipaggiamento si vedono solo i nomi.
9. **Anteprima**: nei dati calcolati ci sono i sensi e le velocità in piedi; la Percezione tellurica, il Volo draconico "pari alla velocità" e altri tratti restano solo a testo (elenco già nel `TODO.md`).

## 5. "Back": cosa manca per funzionare meglio
L'app è statica (nessun server): il "back" è IndexedDB (Dexie) + store + backup. Mancano:
- 🔴 **Archivio persistente**: nessuna chiamata a `navigator.storage.persist()` (nel codice non compare). Su iOS/Safari e con poco spazio il browser può cancellare l'archivio di una PWA non usata: i personaggi sparirebbero. Va richiesta all'avvio e mostrato lo stato nelle Impostazioni (con `storage.estimate()`).
- 🟡 **Doppia scheda aperta**: nessun controllo tra due schede/finestre dello stesso browser (nessun `BroadcastChannel` né blocco): l'ultimo salvataggio sovrascrive l'altro in silenzio.
- 🟡 **Salvataggio in chiusura**: il flush su `pagehide`/`visibilitychange` esiste (`App.tsx`) ma è asincrono e non garantito su iOS; con attesa di 800 ms si può perdere l'ultima modifica. Valutare un salvataggio più immediato per i campi critici (PF, slot) o un salvataggio sincrono di emergenza.
- 🟡 **Homebrew salvato come un unico blocco** (`settings/homebrew`): ogni modifica riscrive tutto l'elenco, quindi due schede possono perdere voci; e non c'è né una versione del formato né una migrazione per l'homebrew (i personaggi sì, ma `MIGRATIONS` è vuoto).
- 🟡 **Dexie a versione 1, senza passaggi di upgrade**: serve lo schema pronto per la prima modifica del formato (la struttura c'è, i passaggi no).
- 🟡 **Righe rovinate**: se un personaggio non passa la validazione compare in elenco ma non si apre, e non c'è modo di esportarne il JSON grezzo per recuperarlo.
- 🟡 **Backup solo manuale**: solo promemoria ogni N giorni; manca la funzione "Condividi" (Web Share) su mobile e l'esportazione di **un solo** personaggio dall'elenco (l'importazione del singolo c'è, l'esportazione no).
- 🟢 **Duplica personaggio** (utile per provare varianti/livelli) e **cronologia/annulla** delle ultime modifiche (almeno uno "snapshot" prima del level-up e prima di "Modifica la creazione").
- 🟢 **Nessun controllo sui dati homebrew importati** oltre alla forma minima (`readHomebrew` valida solo `id` e nome): gli errori escono tardi, alla lettura del ruleset.
- 🟢 **Step 9 (PWA, Docker, CI)**: non esiste `.github/workflows`; il `Dockerfile` è già a posto (nessun riferimento a `data/private`), ma `docker compose build`, il controllo offline e la CI non sono ancora fatti.
- Fuori portata ma da dire: nessuna sincronizzazione tra dispositivi (si passa dal file di backup). Se serve, sarebbe un progetto a parte (account + server).

## 6. Piano (ordine consigliato, un branch per step come in `PLAN.md`)

### P2-1 — Test e CI verdi  🔴
- Correggere B1 (niente scrittura in `/tmp/claude-0`).
- Step 9 di `PLAN.md`: workflow GitHub Actions con `typecheck`, `test`, `validate:data`, `build`; `docker compose build`; prova offline con Playwright.
- **Test**: CI verde; suite 577/577.

### P2-2 — Archivio sicuro (back)  🔴/🟡
- `storage.persist()` all'avvio + riga di stato nelle Impostazioni.
- Blocco tra schede (`BroadcastChannel` o Web Locks): la seconda scheda passa in sola lettura con avviso.
- Homebrew: una riga per voce (Dexie v2 con migrazione dal vecchio blocco), versione del formato.
- Righe rovinate: pulsante "Esporta dati grezzi".
- Snapshot automatici prima di level-up e "Modifica la creazione"; azione "Duplica"; "Esporta questo personaggio" e Web Share.
- **Test**: `db.test.ts` e `store.test.ts` estesi (migrazione v1→v2, due store sulla stessa base, snapshot).

### P2-3 — Lingua e terminologia  🟡
- Portare tutti i messaggi del motore dentro `tr()`/chiavi i18n (B3, B4, B5, B7), con un test che cerca stringhe italiane fuori da `tr`/`it.json` (come la guardia legale).
- Allineare i termini al manuale (sezione 3): Indebolimento, Lingue, Serie standard, Tiri salvezza contro morte, Bonus di competenza, Azione bonus.
- Unità: metri e kg in italiano (conversione in un solo punto, usata da interfaccia e PDF), piedi e libbre in inglese (B2).
- **Test**: parità IT/EN estesa ai messaggi del motore; test su "9 m"/"4,5 kg"; PDF IT senza «ft»/«lb».

### P2-4 — Creazione completa  🟡
- Taglia a scelta (domanda + valore calcolato + PDF).
- Passo "Dettagli": aspetto, età/altezza/peso, tratti, ideali, legami, difetti, storia, nome del giocatore (campi opzionali nel personaggio, migrazione di schema v2, sezione nel PDF).
- Multiclasse nel passo livello (seconda classe con la ripartizione dei livelli).
- Riepilogo con abilità, competenze e privilegi.
- Set da gioco e simbolo sacro scelti insieme all'equipaggiamento.
- Sottoclasse tolta se il livello scende sotto quello della sottoclasse (B6).
- **Test**: ogni specie × taglia; multiclasse 2 classi a livello 5 e 12; PDF con i nuovi campi.

### P2-5 — Contenuti e decisioni aperte  🟢
- Decidere con Giorgio: metodi di punteggio non SRD (sezione 3); oggetti magici SRD (2g) per i livelli alti; descrizioni di armi, armature e oggetti.
- Chiudere i punti "solo a testo" più visibili del `TODO.md` (Percezione tellurica, velocità "pari alla tua", Aura di protezione, ecc.).
- **Test**: guardia legale e parità dati IT/EN ancora verdi.

### P2-6 — Release (ex step 10)
- Passata finale sul `TODO.md`, README, controllo legale, tag `v1.0.0`, checklist firmata.

## 7. Domande aperte per Giorgio
1. Teniamo "Tiro dei dadi", "Acquisto a punti" e "Manuale" anche se non sono nell'SRD 5.2.1?
2. Per i dettagli del personaggio (P2-4) bastano i campi del manuale o vuoi anche ritratto/immagine?
3. Vuoi che P2-2 includa la sincronizzazione tra dispositivi, o restiamo sul file di backup?
