import { readFileSync } from "node:fs";

const OUT = "data/srd/it"; // gli id sono uguali nelle due lingue; i nomi italiani servono ai confronti con il PDF italiano
const read = (k: string) => (JSON.parse(readFileSync(`${OUT}/${k}.json`, "utf8")) as { entries: any[] }).entries;

// nome italiano → id, su armi, armature, strumenti e oggetti (dati dello step 4)
export const itemNames = () => new Map<string, string>(["weapons", "armors", "tools", "items"].flatMap((k) => read(k).map((e) => [e.name.it, e.id] as [string, string])));
export const readKind = read;

export function splitTop(s: string): string[] {
  const r: string[] = []; let d = 0, cur = "";
  for (const c of s) {
    if (c === "(") d++; if (c === ")") d--;
    if (c === "," && d === 0) { r.push(cur.trim()); cur = ""; } else cur += c;
  }
  return [...r, cur.trim()].filter(Boolean);
}

// Oggetti speciali: strumento scelto e voci in inglese lasciate dal PDF
const SPECIAL: Record<string, string> = {
  "lo strumento scelto": "$tool",
  "gaming set a scelta": "$gaming_set",
  "musical instrument a scelta": "$instrument",
};

// "Scorte da calligrafo, Libro (preghiere), 10× Pergamena (foglio), Veste, 8 mo" → { items, gp }
export function equipment(s: string, items: Map<string, string>) {
  const parts = splitTop(s);
  const gold = /^(\d+) mo$/.exec(parts[parts.length - 1]!);
  if (!gold) throw new Error(`Equipaggiamento senza monete finali: ${s}`);
  const list = parts.slice(0, -1).map((tok) => {
    const q = /^(\d+)× (.+)$/.exec(tok);
    const qty = q ? Number(q[1]) : 1;
    let name = q ? q[2]! : tok, note: string | undefined;
    if (SPECIAL[name]) return { item: SPECIAL[name]!, qty };
    while (!items.has(name)) {
      const g = /^(.*\S)\s*\(([^()]*)\)$/.exec(name);
      if (!g) throw new Error(`Oggetto sconosciuto: "${tok}"`);
      name = g[1]!; note = note ? `${g[2]}; ${note}` : g[2];
    }
    return { item: items.get(name)!, qty, ...(note ? { note } : {}) };
  });
  return { items: list, gp: Number(gold[1]) };
}
