import { readdirSync, readFileSync } from "node:fs";
import { buildRuleset, type Kind, type Ruleset } from "../engine/ruleset";

export const SRD_LANGS = ["it", "en"] as const;
export type SrdLang = (typeof SRD_LANGS)[number];

export const readSrdFiles = (lang: SrdLang): { file: string; kind: Kind; entries: { id: string }[] }[] =>
  readdirSync(`data/srd/${lang}`).filter((f) => f.endsWith(".json")).sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(`data/srd/${lang}/${f}`, "utf8")) }));

export const loadSrd = (lang: SrdLang): Ruleset => buildRuleset(readSrdFiles(lang));

// Id di ogni tipo di voce, in ordine di file: servono per la parità IT/EN
export const idsByKind = (lang: SrdLang): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const f of readSrdFiles(lang)) (out[f.kind] ??= []).push(...f.entries.map((e) => e.id));
  return out;
};

// Id degli incantesimi concessi (op "grantSpell") ovunque dentro una voce: effetti, tratti, opzioni delle scelte
export function grantedSpells(x: unknown): string[] {
  if (Array.isArray(x)) return x.flatMap(grantedSpells);
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return [...(o.op === "grantSpell" && typeof o.spell === "string" ? [o.spell] : []), ...Object.values(o).flatMap(grantedSpells)];
  }
  return [];
}

// Riferimenti incrociati tra le voci (un id citato deve esistere)
export function brokenReferences(rs: Ruleset): string[] {
  const p: string[] = [];
  const need = (from: string, kind: Kind, id: string | undefined) => { if (id && !rs[kind].has(id)) p.push(`${from} → ${kind}/${id} non esiste`); };
  for (const w of rs.weapons.values()) {
    need(`weapons/${w.id}`, "masteries", w.mastery);
    need(`weapons/${w.id}`, "damageTypes", w.damageType);
    need(`weapons/${w.id}`, "items", w.ammunition);
    for (const pr of w.properties) need(`weapons/${w.id}`, "weaponProperties", pr);
  }
  const gear = (id: string) => rs.items.has(id) || rs.tools.has(id) || rs.weapons.has(id) || rs.armors.has(id);
  for (const b of rs.backgrounds.values()) {
    need(`backgrounds/${b.id}`, "feats", b.feat);
    for (const sk of b.skills) need(`backgrounds/${b.id}`, "skills", sk);
    if (!rs.tools.has(b.tool) && !["artisan", "gaming", "musical"].includes(b.tool)) p.push(`backgrounds/${b.id} → tools/${b.tool} non esiste`);
    for (const [opt, set] of Object.entries(b.equipment)) for (const it of set.items) if (!it.item.startsWith("$") && !gear(it.item)) p.push(`backgrounds/${b.id}/${opt} → ${it.item} non esiste`);
  }
  // Incantesimi concessi da specie, classi, sottoclassi e talenti: si controllano quando i dati degli incantesimi ci sono (step 2e)
  if (rs.spells.size > 0) for (const [kind, map] of [["species", rs.species], ["classes", rs.classes], ["subclasses", rs.subclasses], ["feats", rs.feats]] as const)
    for (const e of map.values()) for (const sp of grantedSpells(e)) need(`${kind}/${e.id}`, "spells", sp);
  for (const i of rs.items.values()) for (const c of i.contents ?? []) need(`items/${i.id}`, "items", c.item);
  return p;
}
