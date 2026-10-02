// Verifica offline della PWA (step 9): build di produzione, primo caricamento con rete, poi rete spenta e ricarica.
// Uso: npm run e2e:offline   (come layout.mjs: PLAYWRIGHT_MODULE e CHROME_PATH per percorsi non standard)
// Passa se: il service worker si installa, e a rete spenta l'app riparte e mostra la lista personaggi (dati di gioco inclusi).
import { spawn, execSync } from "node:child_process";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const PORT = 5197, URL = `http://localhost:${PORT}/`;

execSync("npm run build", { stdio: "ignore" });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => { try { server.kill(); } catch { /* già chiuso */ } };
process.on("exit", stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* non ancora pronto */ } await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", serviceWorkers: "allow" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const fail = (m) => { console.error(`✗ ${m}`); stop(); process.exit(1); };

// 1. primo caricamento con rete: il service worker deve installarsi e prendere il controllo
await page.goto(URL, { waitUntil: "networkidle" });
const ready = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});
if (!ready) fail("il service worker non si è attivato");
console.log("• service worker attivo");
// il worker prende il controllo della pagina solo dopo un ricarico (registerType: prompt, niente clients.claim): lo si fa con la rete accesa
await page.reload({ waitUntil: "networkidle" });
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
if (!controlled) fail("il service worker non controlla la pagina dopo il ricarico");

// 2. nella cache c'è la pagina e almeno un file JS
const cached = await page.evaluate(async () => {
  const urls = [];
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
  return urls;
});
if (!cached.some((u) => u.endsWith("index.html") || u === "/")) fail("index.html non è in cache");
if (!cached.some((u) => u.endsWith(".js"))) fail("nessun file JS in cache");
console.log(`• ${cached.length} file in cache`);

// 3. rete spenta (anche per le richieste del service worker): ricarica e l'app deve partire
await ctx.setOffline(true);
await page.reload({ waitUntil: "load" });
try { await page.waitForSelector("#root *", { timeout: 15000 }); } catch { fail("a rete spenta la pagina è vuota"); }
const body = (await page.locator("body").innerText()).trim();
if (body.length < 20) fail(`a rete spenta il testo è troppo corto: «${body}»`);
// i dati di gioco stanno nel bundle: il ruleset deve caricarsi senza rete (la schermata Personaggi usa il motore)
if (/offline|ERR_INTERNET|non raggiungibile/i.test(body)) fail(`a rete spenta il browser mostra un errore: «${body.slice(0, 80)}»`);
// navigazione a un indirizzo interno (navigateFallback): deve restituire l'app, non un errore di rete
await page.goto(`${URL}qualsiasi/percorso`, { waitUntil: "load" }).catch(() => fail("a rete spenta un indirizzo interno non si apre"));
try { await page.waitForSelector("#root *", { timeout: 15000 }); } catch { fail("a rete spenta un indirizzo interno non mostra l'app"); }
console.log("• a rete spenta l'app riparte");

if (errors.length) fail(`errori nella pagina: ${errors.join(" | ")}`);
await browser.close();
stop();
console.log("OK: la PWA funziona offline");
