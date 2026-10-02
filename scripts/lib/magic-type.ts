// Riga del tipo di un oggetto magico, in inglese o in italiano:
// "Weapon (Any Ammunition), Uncommon (+1), Rare (+2), or Very Rare (+3) (Requires Attunement by a Wizard)"
// "Arma (qualsiasi munizione), non comune (+1), rara (+2) o molto rara (+3) (richiede sintonia con un mago)"
import type { Lang } from "./srd";

export const CATEGORY: Record<Lang, Record<string, string>> = {
  en: { Armor: "armor", Weapon: "weapon", "Wondrous Item": "wondrous", Potion: "potion", Ring: "ring", Rod: "rod", Scroll: "scroll", Staff: "staff", Wand: "wand" },
  it: { Armatura: "armor", Arma: "weapon", "Oggetto meraviglioso": "wondrous", Pozione: "potion", Anello: "ring", Verga: "rod", Pergamena: "scroll", Bastone: "staff", Bacchetta: "wand" },
};
const RARITY: Record<Lang, [RegExp, string][]> = {
  en: [[/^Common$/, "common"], [/^Uncommon$/, "uncommon"], [/^Rare$/, "rare"], [/^Very Rare$/, "very_rare"], [/^Legendary$/, "legendary"], [/^Artifact$/, "artifact"]],
  it: [[/^comune$/, "common"], [/^non comune$/, "uncommon"], [/^rar[oa]$/, "rare"], [/^molto rar[oa]$/, "very_rare"], [/^leggendari[oa]$/, "legendary"], [/^manufatto$/, "artifact"]],
};
const RARITY_WORDS: Record<Lang, string> = {
  en: "Common|Uncommon|Rare|Very Rare|Legendary|Artifact",
  it: "non comune|comune|molto raro|molto rara|raro|rara|leggendario|leggendaria|manufatto",
};

export interface ParsedType {
  category: string;
  appliesTo?: string; // "Any Medium or Heavy, Except Hide Armor"
  rarity: { rarity: string; note?: string }[]; // vuoto se la rarità varia
  varies: boolean;
  attunement: boolean;
  attunementBy?: string;
}

export function parseType(typeLine: string, l: Lang): ParsedType {
  let rest = typeLine.trim();
  // sintonia
  const att = l === "en" ? /\s*\(Requires Attunement(?: by (.+))?\)\s*$/.exec(rest) : /\s*\(richiede sintonia(?: con (.+))?\)\s*$/.exec(rest);
  if (att) rest = rest.slice(0, att.index);
  // categoria e, tra parentesi, a cosa si applica
  const cats = Object.keys(CATEGORY[l]).sort((a, b) => b.length - a.length).join("|");
  const m = new RegExp(`^(${cats})(?: \\((.+?)\\))?, (.+)$`).exec(rest);
  if (!m) throw new Error(`tipo non riconosciuto: "${typeLine}"`);
  const [, cat, appliesTo, rar] = m;
  const out: ParsedType = { category: CATEGORY[l][cat!]!, rarity: [], varies: false, attunement: !!att };
  if (appliesTo) out.appliesTo = appliesTo;
  if (att?.[1]) out.attunementBy = att[1];
  if (/^(Rarity Varies|rarità variabile)$/.test(rar!)) out.varies = true;
  else {
    const re = new RegExp(`(${RARITY_WORDS[l]})(?: \\(([^)]*)\\))?`, "g");
    let last = 0;
    for (const x of rar!.matchAll(re)) {
      const between = rar!.slice(last, x.index).replace(/^[,\s]*(or|o)?\s*/i, "").trim();
      if (between) throw new Error(`rarità non riconosciuta in "${typeLine}": "${between}"`);
      const id = RARITY[l].find(([r]) => r.test(x[1]!))?.[1];
      if (!id) throw new Error(`rarità sconosciuta "${x[1]}"`);
      out.rarity.push({ rarity: id, ...(x[2] ? { note: x[2] } : {}) });
      last = x.index! + x[0].length;
    }
    if (rar!.slice(last).trim()) throw new Error(`testo in più dopo la rarità in "${typeLine}": "${rar!.slice(last)}"`);
    if (!out.rarity.length) throw new Error(`nessuna rarità in "${typeLine}"`);
  }
  return out;
}
