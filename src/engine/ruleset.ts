import type { z } from "zod";
import {
  armorSchema, backgroundSchema, classSchema, conditionDefSchema, creationRulesSchema, featSchema, itemSchema, speciesSchema,
  slotTableSchema, spellSchema, subclassSchema, termSchema, toolSchema, weaponSchema,
} from "./schema";

const KINDS = {
  species: speciesSchema, backgrounds: backgroundSchema, classes: classSchema,
  subclasses: subclassSchema, feats: featSchema, weapons: weaponSchema,
  armors: armorSchema, items: itemSchema, spells: spellSchema, tools: toolSchema, slotTables: slotTableSchema, creation: creationRulesSchema,
  // glossario (tutti con termSchema)
  skills: termSchema, languages: termSchema, sizes: termSchema, damageTypes: termSchema,
  conditions: conditionDefSchema, weaponProperties: termSchema, masteries: termSchema, coins: termSchema,
} as const;

export type Kind = keyof typeof KINDS;
export type Ruleset = { [K in Kind]: Map<string, z.infer<(typeof KINDS)[K]>> } & {
  errors: string[]; // voci scartate perché non valide: l'app parte lo stesso
};
// Un file di dati: { "kind": "weapons", "entries": [...] }
export interface DataFile { kind: Kind; entries: unknown[] }

export function emptyRuleset(): Ruleset {
  const rs: Record<string, unknown> = { errors: [] };
  for (const k of Object.keys(KINDS)) rs[k] = new Map();
  return rs as Ruleset;
}

// Aggiunge file di dati a un ruleset. Tollerante: se una voce è invalida, l'errore finisce in `errors` e il resto funziona.
function addFiles(rs: Ruleset, files: unknown[]): Ruleset {
  for (const f of files) {
    const file = f as Partial<DataFile>;
    const schema = file.kind ? (KINDS[file.kind] as z.ZodType | undefined) : undefined;
    if (!schema || !Array.isArray(file.entries)) {
      rs.errors.push(`File dati non riconosciuto (kind=${String(file.kind)})`);
      continue;
    }
    const map = rs[file.kind!] as Map<string, unknown>;
    for (const entry of file.entries) {
      const r = schema.safeParse(entry);
      const eid = (entry as { id?: string })?.id ?? "?";
      if (!r.success) rs.errors.push(`${file.kind}/${eid}: ${r.error.issues[0]?.message}`);
      else if (map.has(eid)) rs.errors.push(`${file.kind}/${eid}: id duplicato`);
      else map.set(eid, r.data);
    }
  }
  return rs;
}

// Costruisce il ruleset da file già letti (se private/ manca la lista è più corta).
export const buildRuleset = (files: unknown[]): Ruleset => addFiles(emptyRuleset(), files);

// Copia di un ruleset con in più altri file (l'homebrew): l'originale non cambia, quindi si riparte dal base a ogni modifica.
export function extendRuleset(base: Ruleset, files: unknown[]): Ruleset {
  const rs = emptyRuleset();
  for (const k of Object.keys(KINDS)) (rs as Record<string, unknown>)[k] = new Map(base[k as Kind] as Map<string, unknown>);
  rs.errors = [...base.errors];
  return addFiles(rs, files);
}
