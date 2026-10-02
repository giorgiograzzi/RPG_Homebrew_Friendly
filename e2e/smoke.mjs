// Smoke test dell'app con un browser vero (step 5): crea un mago con il wizard in italiano, passa all'inglese,
// sale di livello, esporta il backup, elimina il personaggio e lo reimporta.
// Uso: npm run e2e:smoke   (come layout.mjs: PLAYWRIGHT_MODULE e CHROME_PATH per percorsi non standard)
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import en from "../src/i18n/en.json" with { type: "json" };
import it from "../src/i18n/it.json" with { type: "json" };
import { DISCLAIMER, SRD_NOTICE } from "../src/legal/attribution.ts";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const PORT = 5198, URL = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => { try { server.kill(); } catch { /* già chiuso */ } };
process.on("exit", stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* non ancora pronto */ } await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
await page.addInitScript(() => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("lang", "it"); sessionStorage.setItem("seeded", "1"); } } catch { /* niente */ } });

let step = "avvio";
const log = (s) => { step = s; console.log(`• ${s}`); };
const fail = (m) => { throw new Error(`[${step}] ${m}`); };
const expect = (cond, m) => { if (!cond) fail(m); };
const wait = (ms = 250) => page.waitForTimeout(ms);

// Compila le domande aperte della vista corrente: clicca la prima opzione libera finché ogni domanda è completa
async function fillQuestions(label) {
  for (let i = 0; i < 60; i++) {
    // una scelta che ne cancella altre: la si rifiuta (confermare distruggerebbe le scelte già fatte)
    const dlg = page.locator(".ui-dialog button", { hasText: new RegExp(`^(${it.wizard.confirmNo}|${en.wizard.confirmNo})$`) });
    if (await dlg.count()) { await dlg.first().click(); await wait(); }
    // aumenti di caratteristica: si alza qualche caratteristica finché «Applica» si abilita
    const asi = page.locator(".wz-q:has(.wz-score)", { hasNot: page.locator(".meta:has-text('✓')") });
    if (await asi.count()) {
      const q = asi.first(), apply = q.getByRole("button", { name: new RegExp(`^(${it.wizard.asi.apply}|${en.wizard.asi.apply})$`) });
      const plus = q.locator("button[aria-label$=' +']:not([disabled])");
      const chosen = async () => (await q.locator(".v").allInnerTexts()).some((x) => /^\+[1-9]/.test(x));
      for (let k = 0; k < 6 && !((await chosen()) && (await apply.isEnabled())) && (await plus.count()); k++) { await plus.first().click(); await wait(80); }
      expect(await apply.isEnabled(), `aumento di caratteristica non applicabile: ${await q.innerText()}`);
      await apply.click(); await wait(150);
      continue;
    }
    const open = page.locator(".wz-q:not(:has(.wz-score))", { hasNot: page.locator(".meta:has-text('✓')") })
      .locator(".wz-opt[aria-disabled='false'][aria-checked='false']");
    if (!(await open.count())) return;
    await open.first().click();
    await wait(120);
    if (i === 59) fail(`${label}: troppe scelte aperte`);
  }
}
const stepTabs = () => page.locator(".wz-steps button");

try {
  // ── Creazione in italiano ────────────────────────────────────────────────
  await page.goto(URL);
  await page.waitForSelector(".ui-app");
  expect((await page.locator("html").getAttribute("lang")) === "it", "la lingua iniziale non è l'italiano");
  // avviso sui cookie: compare al primo accesso, con i link alle policy, e dopo «Ho capito» non torna
  log("avviso sui cookie");
  const banner = page.getByRole("region", { name: it.cookieNotice.label });
  expect(await banner.isVisible(), "l'avviso sui cookie non compare al primo accesso");
  await banner.getByRole("button", { name: it.cookieNotice.cookies }).click();
  expect(await page.getByTestId("policy-cookies").isVisible(), "il link dell'avviso non apre la Cookie Policy");
  await page.getByTestId("policy-cookies").getByRole("button", { name: it.legal.other.privacy }).click();
  expect(await page.getByTestId("policy-privacy").isVisible(), "dalla Cookie Policy non si apre la Privacy Policy");
  await page.getByTestId("policy-privacy").getByRole("button", { name: new RegExp(it.legal.back) }).first().click();
  await banner.getByRole("button", { name: it.cookieNotice.ok }).click();
  await page.reload(); await page.waitForSelector(".ui-app");
  expect(!(await banner.count()), "l'avviso sui cookie riappare dopo «Ho capito»");
  log("creazione in italiano");
  await page.getByRole("button", { name: new RegExp(`^\\+ ${it.characters.new}`) }).click();
  await wait(400);
  // passo 1: classe = Mago (tante scelte: libro incantesimi, trucchetti)
  await stepTabs().nth(1).click();
  await page.locator(".wz-opt", { hasText: /^\s*Mago/ }).first().click();
  await wait();
  await fillQuestions("classe");
  await stepTabs().nth(2).click();
  await page.locator(".wz-opt", { hasText: /^\s*Soldato/ }).first().click();
  await wait();
  for (const [i, name] of [[2, "background"], [3, "specie"], [4, "linguaggi"]]) { await stepTabs().nth(i).click(); await wait(); await fillQuestions(name); }
  // punteggi: serie standard
  await stepTabs().nth(5).click();
  await page.locator(".ui-seg button").first().click();
  await wait();
  await stepTabs().nth(6).click(); await wait(); await fillQuestions("allineamento");
  await stepTabs().nth(7).click(); await wait(); await fillQuestions("dettagli");
  await page.locator(".ui-input").first().fill("Smoke");
  await stepTabs().last().click();
  await wait(400);
  const finish = page.getByRole("button", { name: it.wizard.finish });
  if (process.env.E2E_DEBUG && !(await finish.isEnabled())) { await stepTabs().nth(2).click(); await wait(); console.error(await page.locator(".ui-body").innerText()); }
  expect(await finish.isEnabled(), `«${it.wizard.finish}» è disabilitato: ${(await page.locator(".ui-banner").allInnerTexts()).join(" | ")}`);
  await finish.click();
  await page.waitForSelector(".pl-hp");
  const hp = (await page.locator(".pl-hp .big").first().innerText()).trim();
  expect(/^\d+ \/ \d+$/.test(hp), `PF non validi: ${hp}`);
  expect(/Mago 1/.test(await page.locator(".pl-head, .ui-body").first().innerText()), "la scheda non mostra «Mago 1»");
  log(`scheda creata (PF ${hp})`);

  // ── Riposi sulla scheda: si consuma una risorsa, il riposo lungo la ripristina ─────────
  log("riposo lungo");
  const res = page.locator(".pl-list li", { hasText: "Recupero arcano" }).first();
  const val = async () => (await res.locator(".val").innerText()).trim();
  const full = await val();
  await res.getByRole("button", { name: new RegExp(`^${it.play.use} `) }).click();
  expect((await val()) !== full, "«Usa» non consuma la risorsa");
  await page.getByRole("button", { name: it.play.longRest, exact: true }).click();
  await page.locator(".ui-dialog").getByRole("button", { name: it.wizard.confirmYes }).click();
  await wait();
  expect((await val()) === full, `il riposo lungo non ripristina la risorsa (${await val()} invece di ${full})`);

  // ── Cambio lingua in inglese ─────────────────────────────────────────────
  log("cambio lingua in inglese");
  await page.locator(".ui-title-btn:not(.ui-back)").click();
  await page.getByRole("menuitem", { name: it.menu.settings }).click();
  await Promise.all([page.waitForNavigation(), page.getByRole("button", { name: "English", exact: true }).click()]);
  await page.waitForSelector(".ui-app");
  expect((await page.locator("html").getAttribute("lang")) === "en", "la lingua non è passata all'inglese");
  await page.waitForSelector(".ui-list li");
  expect(await page.locator(".ui-list li", { hasText: "Smoke" }).count() === 1, "il personaggio non c'è più dopo il cambio lingua");
  await page.locator(".ui-list li", { hasText: "Smoke" }).getByRole("button", { name: en.characters.open }).click();
  await page.waitForSelector(".pl-hp");
  expect(/Wizard 1/.test(await page.locator(".ui-body").innerText()), "in inglese la scheda non mostra «Wizard 1»");
  expect((await page.locator(".pl-hp .big").first().innerText()).trim() === hp, "i PF cambiano con la lingua");

  // ── Informazioni e licenze: dicitura CC-BY e avviso nella lingua dell'app ─────────
  log("informazioni e licenze");
  expect((await page.title()) === "Placet del Master", `titolo pagina: ${await page.title()}`);
  await page.locator(".ui-title-btn:not(.ui-back)").click();
  await page.getByRole("menuitem", { name: en.menu.about }).click();
  const notice = (await page.getByTestId("srd-notice").innerText()).replace(/\s+/g, " ");
  expect(notice === SRD_NOTICE.en, `dicitura diversa da quella dell'SRD: ${notice.slice(0, 80)}`);
  expect((await page.getByTestId("disclaimer").innerText()) === DISCLAIMER.en, "avviso «non ufficiale» mancante");
  expect(await page.locator('.ui-body a[href="https://creativecommons.org/licenses/by/4.0/legalcode"]').count() >= 1, "manca il link alla licenza");
  await page.getByRole("button", { name: new RegExp(en.about.back) }).click();
  // Privacy Policy e Cookie Policy: dal menu, nella lingua dell'app, con il contatto del titolare
  for (const [item, id] of [[en.menu.privacy, "policy-privacy"], [en.menu.cookies, "policy-cookies"]]) {
    await page.locator(".ui-title-btn:not(.ui-back)").click();
    await page.getByRole("menuitem", { name: item }).click();
    const doc = page.getByTestId(id);
    expect(await doc.locator("h2").innerText() === item, `titolo della policy diverso da «${item}»`);
    expect((await doc.innerText()).includes("giorgiograzzi1987@gmail.com"), `${id}: manca il contatto del titolare`);
    await doc.getByRole("button", { name: new RegExp(en.legal.back) }).first().click();
  }

  // ── Level-up ─────────────────────────────────────────────────────────────
  log("level-up");
  await page.getByRole("button", { name: en.levelup.button, exact: true }).click();
  await page.waitForSelector(".ui-dialog");
  const small = await page.evaluate(() => [...document.querySelectorAll(".ui-dialog button:not(.ui-icon-btn)")].filter((b) => b.getBoundingClientRect().height < 47.5).map((b) => b.textContent.trim()));
  expect(small.length === 0, `level-up: bersagli sotto i 48px → ${small.join(", ")}`);
  expect(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "level-up: scroll orizzontale");
  await page.getByRole("button", { name: new RegExp(`${en.levelup.next}`) }).click(); // classe: Wizard (già scelta)
  await page.getByRole("button", { name: new RegExp(`${en.levelup.next}`) }).click(); // PF: valore fisso
  await wait();
  await fillQuestions("level-up");
  const conf = page.getByRole("button", { name: en.levelup.confirm });
  expect(await conf.isEnabled(), `«${en.levelup.confirm}» disabilitato: ${await page.locator(".ui-dialog").innerText()}`);
  await conf.click();
  await wait(400);
  expect(/Wizard 2/.test(await page.locator(".ui-body").innerText()), "dopo il level-up la scheda non mostra «Wizard 2»");
  const hp2 = Number((await page.locator(".pl-hp .big").first().innerText()).split("/")[1]);
  expect(hp2 > Number(hp.split("/")[1]), `i PF massimi non sono saliti (${hp} → ${hp2})`);
  log(`level-up ok (PF max ${hp2})`);

  // ── Scheda PDF: dalla sezione «Altro» ────────────────────────────────────
  log("scheda PDF");
  await page.getByRole("button", { name: en.play.tabs.misc, exact: true }).click();
  const [pdfDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: en.wizard.sheet.button }).click()]);
  const pdfBytes = readFileSync(await pdfDl.path());
  expect(pdfBytes.subarray(0, 5).toString() === "%PDF-" && pdfBytes.length > 20_000, `il PDF non è valido (${pdfBytes.length} byte)`);
  expect(/^scheda-smoke\.pdf$/.test(pdfDl.suggestedFilename()), `nome file inatteso: ${pdfDl.suggestedFilename()}`);
  await page.getByRole("button", { name: en.play.tabs.status, exact: true }).click();

  // ── Backup: esporta, elimina, reimporta ─────────────────────────────────
  log("backup e ripristino");
  await page.locator(".ui-title-btn:not(.ui-back)").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: en.menu.export }).click()]);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path, "utf8"));
  expect(backup.characters?.length === 1 && backup.characters[0].name === "Smoke", "il backup non contiene il personaggio");
  expect(backup.characters[0].classes[0].level === 2, "il backup non ha il livello 2");
  await page.locator(".ui-back").click();
  await page.waitForSelector(".ui-list li");
  await page.getByRole("button", { name: new RegExp(`^${en.characters.delete} Smoke`) }).click();
  await page.locator(".ui-dialog").getByRole("button", { name: en.characters.delete }).click();
  await wait(400);
  expect(await page.locator(".ui-list li").count() === 0, "il personaggio non è stato eliminato");
  await page.locator(".ui-title-btn:not(.ui-back)").click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: en.menu.import }).click()]);
  await chooser.setFiles(path);
  await page.locator(".ui-dialog").getByRole("button", { name: en.import.apply, exact: true }).click();
  await wait(500);
  await page.waitForSelector(".ui-list li");
  await page.locator(".ui-list li", { hasText: "Smoke" }).getByRole("button", { name: en.characters.open }).click();
  await page.waitForSelector(".pl-hp");
  expect(/Wizard 2/.test(await page.locator(".ui-body").innerText()), "dopo il ripristino la scheda non è al livello 2");
  log("ripristino ok");
  expect(errors.length === 0, `errori del browser:\n${[...new Set(errors.map((e) => e.replace(/%s/g, "").slice(0, 160)))].slice(0, 5).join("\n")}`);
  console.log("SMOKE OK");
} catch (e) {
  console.error(`SMOKE FALLITO: ${e.message}`);
  if (process.env.E2E_DEBUG) console.error((await page.locator(".ui-body").innerText().catch(() => "")).slice(0, 2500));
  await page.screenshot({ path: "e2e/out/smoke-fail.png" }).catch(() => {});
  if (errors.length) console.error(errors.slice(0, 5).join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
  stop();
}
