# Checklist di rilascio — v1.0.0

Verifiche tecniche fatte il 2026-10-02 (non sono un parere legale).

## Automatiche
- [x] `npm run typecheck` ok
- [x] `npm test`: 34 file, 577 test verdi (incluse guardie legali: niente contenuti protetti, dicitura identica ai PDF SRD)
- [x] `npm run validate:data` ok
- [x] `npm run build` ok (PWA, 19 file in precache)
- [x] `npm run e2e:smoke` ok (crea → IT/EN → level-up → PDF → backup → ripristino)
- [ ] `npm run e2e` (layout, 3 viewport × IT/EN × tema): lento (>9 min); da lanciare in locale prima del tag

## Licenze
- [x] Dipendenze di produzione: MIT (pdf-lib, fontkit, react, zod, zustand), Apache-2.0 (dexie), OFL-1.1 (Noto Sans)
- [x] Dicitura CC-BY in app, README, `ATTRIBUTION.md`, PDF
- [x] Nessun asset di terzi non libero; icone originali
- [x] Nel codice e nell'interfaccia non compaiono «Dungeons & Dragons» né «D&D» (guardia `noProtected.test.ts`)

## Da firmare — Giorgio
- [ ] Ho riletto dicitura, avviso «non affiliato», nome e icona
- [ ] Decisione sul nome «Danger & Dragons» (la sigla coincide con D&D, marchio WotC): ricerca marchi / parere legale, oppure accetto il rischio
- [ ] Prova a mano con VoiceOver / TalkBack
- [ ] Prova su telefono: installazione PWA e uso offline
- [ ] Via libera al tag: `git tag -a v1.0.0 -m "Danger & Dragons 1.0.0" && git push origin v1.0.0`
