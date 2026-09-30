import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Lancia tutte le estrazioni una per una. Se una fallisce (di solito manca un file in docs/rules) le altre girano lo stesso,
// e alla fine c'è il riepilogo di cosa è andato storto: un errore non lascia più metà dei dati senza dirlo.
const STEPS: { script: string; needs: string[]; produces: string }[] = [
  { script: "extract-data", needs: ["docs/rules/01_Dati_Gioco_DnD2024.pdf"], produces: "armi, armature, oggetti, strumenti" },
  { script: "extract-spells", needs: ["docs/rules/04_Incantesimi_DnD2024.pdf"], produces: "incantesimi" },
  { script: "extract-step5", needs: ["docs/rules/01_Dati_Gioco_DnD2024.pdf"], produces: "talenti, background" },
  { script: "extract-step6", needs: ["docs/rules/01_Dati_Gioco_DnD2024.pdf"], produces: "specie" },
  { script: "extract-classes", needs: ["docs/rules/01_Dati_Gioco_DnD2024.pdf"], produces: "classi e sottoclassi" },
  { script: "extract-conditions", needs: ["docs/rules/05_conditions.json"], produces: "condizioni" },
  { script: "extract-features", needs: ["data/private/classes.json", "data/private/species.json"], produces: "contatori e stati attivabili dei privilegi" },
  { script: "extract-creation", needs: ["docs/rules/02_Regole_Creazione_Personaggio.pdf"], produces: "regole di creazione (allineamenti, array, acquisto a punti)" },
];

const results: { script: string; status: "ok" | "saltato" | "errore"; note: string }[] = [];
for (const s of STEPS) {
  const missing = s.needs.filter((f) => !existsSync(f));
  if (missing.length) { results.push({ script: s.script, status: "saltato", note: `manca ${missing.join(", ")} (${s.produces})` }); continue; }
  console.log(`\n=== ${s.script} ===`);
  const r = spawnSync("npx", ["tsx", `scripts/${s.script}.ts`], { stdio: "inherit" });
  results.push({ script: s.script, status: r.status === 0 ? "ok" : "errore", note: r.status === 0 ? s.produces : `codice ${r.status} (${s.produces})` });
}

console.log("\n=== Riepilogo estrazione ===");
for (const r of results) console.log(`${r.status === "ok" ? "OK     " : r.status === "saltato" ? "SALTATO" : "ERRORE "}  ${r.script.padEnd(20)} ${r.note}`);
const bad = results.filter((r) => r.status !== "ok");
if (bad.length) console.log(`\nAttenzione: ${bad.length} passi non completati. I dati di quei passi mancano o sono vecchi.`);
process.exit(bad.some((r) => r.status === "errore") ? 1 : 0);
