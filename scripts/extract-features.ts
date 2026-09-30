// Step 14b: contatori (usi limitati) e stati attivabili (Ira, Forma selvatica...) dei privilegi → data/private.
// Va dopo le altre estrazioni: legge classi, sottoclassi, specie e talenti già generati e aggiunge `usage` / `activation`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { applyFeaturePlay } from "./lib/feature-play";

const OUT = "data/private";
const KINDS = ["classes", "subclasses", "species", "feats"] as const;
for (const k of KINDS) if (!existsSync(`${OUT}/${k}.json`)) throw new Error(`Manca ${OUT}/${k}.json: lancia prima le altre estrazioni`);
const files = Object.fromEntries(KINDS.map((k) => [k, JSON.parse(readFileSync(`${OUT}/${k}.json`, "utf8")) as { kind: string; entries: any[] }]));
const rep = applyFeaturePlay({ classes: files.classes!.entries, subclasses: files.subclasses!.entries, species: files.species!.entries, feats: files.feats!.entries });
for (const k of KINDS) writeFileSync(`${OUT}/${k}.json`, JSON.stringify(files[k], null, 1) + "\n");
console.log(`contatori         ${rep.usage.length} privilegi con usi limitati`);
console.log(`attivabili        ${rep.activations.length}: ${rep.activations.map((a) => a.split("/").pop()).join(", ")}`);
if (rep.missing.length) throw new Error(`Attivazioni senza privilegio: ${rep.missing.join(", ")}`);
