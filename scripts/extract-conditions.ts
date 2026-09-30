// Condizioni: docs/rules/05_conditions.json (spec fornita da Giorgio, PHB 2024 App. C) → data/private/conditions.json
// Le chiavi passano da snake_case a camelCase; le caratteristiche ("STR") a id minuscoli; escape.check "STR_ATHLETICS" → {ability, skill}.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
const raw = JSON.parse(readFileSync(`${SRC}/05_conditions.json`, "utf8")) as { schema_version: number; conditions: any[] };
if (raw.schema_version !== 1) throw new Error(`schema_version ${raw.schema_version} non supportata`);

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const ABILS = new Set(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);

function convert(v: unknown, key = ""): unknown {
  if (Array.isArray(v)) {
    if (key === "abilities") return v.map((a) => { if (!ABILS.has(a)) throw new Error(`Caratteristica sconosciuta: ${a}`); return (a as string).toLowerCase(); });
    if (key === "check") return v.map((c: string) => { const [a, ...sk] = c.split("_"); return { ability: a!.toLowerCase(), skill: sk.join("_").toLowerCase() }; });
    return v.map((x) => convert(x));
  }
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [camel(k), convert(x, k)]));
  return v;
}

const entries = raw.conditions.map((c) => {
  const e = convert(c) as Record<string, any>;
  return {
    id: e.id, name: { it: e.nameIt, en: e.nameEn }, description: e.summaryIt ?? "", notes: e.notesIt ?? "",
    bookPage: e.bookPage, stackable: e.stackable, requiresSource: e.requiresSource, grantsConditions: e.grantsConditions,
    ...(e.levels ? { levels: e.levels } : {}), effects: e.effects,
    ...(e.removal ? { removal: e.removal } : {}), ...(e.endConditions ? { endConditions: e.endConditions } : {}),
    ...(e.escape ? { escape: e.escape } : {}),
  };
});
const ids = new Set(entries.map((e) => e.id));
if (entries.length !== 15 || ids.size !== 15) throw new Error(`Condizioni: ${entries.length} (attese 15 distinte)`);
for (const e of entries) for (const g of e.grantsConditions) if (!ids.has(g)) throw new Error(`${e.id}: condizione inclusa sconosciuta "${g}"`);

writeFileSync(`${OUT}/conditions.json`, JSON.stringify({ kind: "conditions", entries }, null, 1) + "\n");
console.log(`conditions        ${entries.length}`);
