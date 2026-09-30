// npm run validate:data — valida tutti i JSON in data/ (schema Zod + riferimenti incrociati)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildRuleset } from "../src/engine/ruleset";
import { parsePack } from "../src/engine/homebrew";
import { checkReferences } from "../src/engine/validate";

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : [];
    });
  } catch { return []; }
}

// data/homebrew/ contiene pacchetti di esempio (altro formato): si validano a parte, contro i dati di gioco
const all = walk("data");
const packs = all.filter((f) => f.replace(/\\/g, "/").startsWith("data/homebrew/"));
const files = all.filter((f) => !packs.includes(f));
if (!files.length) { console.log("validate:data: nessun file in data/ (private/ assente?) — niente da validare"); process.exit(0); }
const rs = buildRuleset(files.map((f) => JSON.parse(readFileSync(f, "utf8"))));
const errors = [...rs.errors, ...checkReferences(rs)];
const counts = Object.entries(rs).filter(([, v]) => v instanceof Map && v.size).map(([k, v]) => `${k}: ${(v as Map<unknown, unknown>).size}`);
console.log(`File: ${files.length} — ${counts.join(", ")}`);
if (errors.length) { console.error(`\n${errors.length} errori:\n- ${errors.join("\n- ")}`); process.exit(1); }
const packErrors = packs.flatMap((f) => {
  const r = parsePack(readFileSync(f, "utf8"), rs);
  return r.ok ? r.errors.map((e) => `${f}: ${e}`) : [`${f}: ${r.error}`];
});
// senza i dati privati i riferimenti (maestrie, tipi di danno) mancano: gli esempi si controllano solo se ci sono
if (rs.masteries.size && packErrors.length) { console.error(`\n${packErrors.length} errori negli esempi homebrew:\n- ${packErrors.join("\n- ")}`); process.exit(1); }
console.log(`validate:data: OK (${packs.length} pacchetti homebrew di esempio)`);
