# Danger & Dragons

_(repo: RPG Homebrew Friendly)_

PWA gratuita per creare e gestire personaggi, in **italiano e inglese**, anche offline.
Contiene solo contenuti dell'SRD 5.2.1 (CC-BY-4.0); il resto si aggiunge come homebrew.

> Progetto in costruzione: vedi `PLAN.md` (step) e `TODO.md`.

## Sviluppo
```
npm ci
npm run typecheck
npm test            # test unitari e di integrazione (dati SRD, motore, interfaccia)
npm run dev
npm run e2e         # controlli di layout e accessibilità con un browser vero (serve Playwright + Chromium)
npm run e2e:smoke   # crea un personaggio, cambia lingua, sale di livello, backup
npm run e2e:offline # build di produzione e verifica che la PWA riparta a rete spenta
npm run validate:data
npm run extract:data   # rigenera data/srd/ dai PDF in docs/srd/ (verifica IT e EN: si ferma se non coincidono)
```

## Interfaccia
Tema originale neutro (indaco), chiaro/scuro, mobile-first con layout desktop a colonne da 1100px.
Testo ≥ 16px, bersagli ≥ 48px, contrasto WCAG AA, uso da tastiera. Token in `src/ui/theme/theme.css`.

## Deploy con Docker
```
git clone <repo> srd-personaggi && cd srd-personaggi
cp .env.example .env        # facoltativo: cambia PORT (default 8098)
docker compose up -d --build
```
L'app è statica (nginx): si aggiorna con `git pull && docker compose up -d --build`. Il service worker e `index.html` non vanno in cache, così un aggiornamento arriva subito.

## Privacy e cookie
L'app non raccoglie dati personali e non imposta cookie: personaggi e impostazioni restano nel browser. Il testo di Privacy Policy e Cookie Policy (IT/EN) è in `src/legal/policies.ts`, si legge nell'app (menu → Privacy Policy / Cookie Policy) e il banner informativo è `src/ui/CookieBanner.tsx`. Se si aggiungono statistiche, servizi esterni o cookie vanno aggiornati i testi e il banner va reso con Accetta/Rifiuta. I testi non sono consulenza legale.

## Licenze
Codice: MIT (`LICENSE`). Font della scheda PDF: Noto Sans, SIL OFL 1.1 (`docs/licenses/`). Dettagli in `ATTRIBUTION.md`.

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
>
> Quest'opera include materiale tratto dal System Reference Document 5.2.1 ("SRD 5.2.1") di Wizards of the Coast LLC, disponibile all'indirizzo https://www.dndbeyond.com/srd. Il SRD 5.2.1 è concesso in licenza ai sensi della licenza di attribuzione 4.0 Internazionale di Creative Commons, disponibile all'indirizzo https://creativecommons.org/licenses/by/4.0/legalcode.

Danger & Dragons is an unofficial, fan-made app. It is not affiliated with, endorsed or sponsored by Wizards of the Coast. / Danger & Dragons è un'app non ufficiale, creata da appassionati. Non è affiliata, approvata né sponsorizzata da Wizards of the Coast.
