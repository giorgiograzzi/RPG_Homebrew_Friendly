# RPG Homebrew Friendly

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

## Licenze
Codice: MIT (`LICENSE`). Contenuti SRD: CC-BY-4.0 (`ATTRIBUTION.md`).
