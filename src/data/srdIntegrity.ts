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
  for (const i of rs.items.values()) for (const c of i.contents ?? []) need(`items/${i.id}`, "items", c.item);
  return p;
}
