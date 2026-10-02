// Controlli di layout con un browser vero: tre viewport × IT/EN × chiaro/scuro.
// Uso: npm run e2e   (serve Playwright e Chromium; con PLAYWRIGHT_MODULE e CHROME_PATH si indicano percorsi non standard)
// Per ogni schermata: screenshot in e2e/out/, nessuno scroll orizzontale, bersagli >= 48px, nessun testo tagliato.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const PORT = 5199, URL = `http://localhost:${PORT}/`;
const VIEWPORTS = [["telefono", 375, 812], ["tablet", 768, 1024], ["desktop", 1280, 800]];
const ONLY = (process.env.E2E_ONLY ?? "").split(",").filter(Boolean);
const pick = (v, all) => (v ? v.split(",") : all);
const VP_SEL = pick(process.env.E2E_VP, VIEWPORTS.map((v) => v[0])), LANGS = pick(process.env.E2E_LANG, ["it", "en"]), SCHEMES = pick(process.env.E2E_SCHEME, ["light", "dark"]);
mkdirSync("e2e/out", { recursive: true });

const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => { try { server.kill(); } catch { /* già chiuso */ } };
process.on("exit", stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* non ancora pronto */ } await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const problems = [];
let shots = 0;

async function seed(page) {
  await page.evaluate(async () => {
    const { appStore } = await import("/src/store/index.ts");
    const logic = await import("/src/wizard/logic.ts");
    const { getRuleset } = await import("/src/data/ruleset.ts");
    const { emptyCharacter } = await import("/src/engine/character.ts");
    const rs = getRuleset();
    const st = appStore.getState();
    await st.init();
    if (st.list.length) return;
    const ch = await st.create();
    const base = { ...emptyCharacter(ch.id), name: "Aria", classes: [{ classId: "wizard", level: 5, hpRolls: [] }], speciesId: "elf", backgroundId: "sage" };
    const fin = logic.finalizeCharacter(logic.autoComplete(base, rs), rs, { gaming_set: [...rs.tools.values()].find((t) => t.group === "gaming")?.id }).character;
    appStore.getState().update(() => fin);
    await appStore.getState().flush();
    await appStore.getState().close();
  });
}

async function check(page, tag) {
  const r = await page.evaluate(() => {
    const out = { hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, small: [], clipped: [] };
    const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    for (const e of document.querySelectorAll("button, select, input:not([type=hidden]), a[href]")) {
      if (!vis(e)) continue;
      const b = e.getBoundingClientRect();
      const box = e.type === "checkbox" ? e.closest("label") ?? e : e;
      const bb = box.getBoundingClientRect();
      if (bb.height < 47.5 || bb.width < 47.5) out.small.push(`${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ")[0]} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(bb.width)}×${Math.round(bb.height)}`);
    }
    for (const e of document.querySelectorAll(".ui-btn, .ui-tab, .ui-seg button, .wz-steps button, .pl-tabs button, .hb-chips button")) {
      if (vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible") out.clipped.push((e.textContent || "").trim().slice(0, 30));
    }
    // inglese: nessuna parola italiana evidente nel testo visibile
    out.italian = [];
    if (document.documentElement.lang === "en") {
      const txt = document.body.innerText;
      for (const m of txt.matchAll(/[^\n]*(?:[àèìòù]|\b(?:Scegli|Nessun[oa]?|Livello|Punti Ferita|Forza|Destrezza|Costituzione|Saggezza|Carisma|Competenza|Incantesim\w+|Non |Già|Richiede|Mancano)\b)[^\n]*/g)) out.italian.push(m[0].trim().slice(0, 70));
    }
    return out;
  });
  if (r.italian?.length) problems.push(`${tag}: testo italiano in inglese → ${[...new Set(r.italian)].slice(0, 5).join(" | ")}`);
  if (r.hscroll) problems.push(`${tag}: scroll orizzontale`);
  if (r.small.length) problems.push(`${tag}: bersagli piccoli → ${[...new Set(r.small)].slice(0, 6).join(" | ")}`);
  if (r.clipped.length) problems.push(`${tag}: testo tagliato → ${[...new Set(r.clipped)].join(" | ")}`);
}

for (const [vpName, width, height] of VIEWPORTS.filter((v) => VP_SEL.includes(v[0]))) for (const lang of LANGS) for (const scheme of SCHEMES) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, locale: lang === "it" ? "it-IT" : "en-US" });
  const page = await ctx.newPage();
  await page.addInitScript(([l, s]) => { try { localStorage.setItem("lang", l); localStorage.setItem("theme", s); } catch { /* niente */ } }, [lang, scheme]);
  await page.goto(URL);
  await page.waitForSelector(".ui-app");
  await seed(page);
  await page.reload();
  await page.waitForSelector(".ui-app");
  const shot = async (name) => {
    const tag = `${vpName}/${lang}/${scheme}/${name}`;
    if (ONLY.length && !ONLY.includes(name)) return;
    await page.waitForTimeout(150);
    await page.screenshot({ path: `e2e/out/${vpName}-${lang}-${scheme}-${name}.png` });
    shots++;
    await check(page, tag);
  };
  await shot("personaggi");
  // nuovo personaggio: wizard di creazione (primo passo e un passo avanti)
  await page.getByRole("button", { name: /^\+/ }).first().click();
  await page.waitForTimeout(300);
  await shot("wizard-1");
  await page.locator(".wz-opt").first().click().catch(() => {});
  await page.getByRole("button", { name: lang === "it" ? "Avanti" : "Next" }).first().click().catch(() => {});
  await page.waitForTimeout(250);
  await shot("wizard-2");
  await page.locator(".ui-tab, .ui-back").first().click().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator(".ui-tab").nth(1).click().catch(() => {});
  await page.waitForTimeout(300);
  await shot("homebrew");
  await page.locator(".ui-tab").first().click().catch(() => {});
  await page.waitForTimeout(200);
  // apre il personaggio: primo pulsante «Apri»
  await page.locator(".ui-list li", { hasText: "Aria" }).locator("button").first().click();
  await page.waitForTimeout(300);
  await shot("scheda-stato");
  const sections = page.locator(".ui-sections button:not(.back)");
  const n = await sections.count();
  for (const [i, name] of [[1, "privilegi"], [2, "statistiche"], [3, "attacchi"], [4, "equip"], [5, "magie"]]) {
    if (i < n) { await sections.nth(i).click(); await page.waitForTimeout(250); await shot(`scheda-${name}`); }
  }
  await page.locator(".ui-menu, .ui-title-btn").first().click().catch(() => {});
  await page.getByRole("menuitem").first().click().catch(() => {});
  await page.waitForTimeout(250);
  await shot("impostazioni");
  await ctx.close();
}
await browser.close();
stop();
console.log(`${shots} schermate controllate, screenshot in e2e/out/`);
if (problems.length) { console.log(problems.join("\n")); process.exitCode = process.env.E2E_STRICT ? 1 : 0; }
else console.log("nessun problema di layout");
