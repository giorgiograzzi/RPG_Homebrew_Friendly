import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { HB_KINDS, type HbEntry } from "./pack";

// Quali voci homebrew usa un personaggio. Gli id homebrew iniziano per "hb_": si cercano in tutti i punti dove un personaggio
// può riferirsi a un contenuto (specie, background, classi, sottoclassi, talenti, incantesimi aggiunti, zaino, scelte).
const isHb = (id: unknown): id is string => typeof id === "string" && id.startsWith("hb_");

export function homebrewIds(ch: Character): string[] {
  const ids = new Set<string>();
  const add = (x: unknown) => { if (isHb(x)) ids.add(x); };
  add(ch.speciesId); add(ch.backgroundId);
  for (const c of ch.classes) { add(c.classId); add(c.subclassId); }
  for (const f of ch.feats) { add(f.featId); for (const v of Object.values(f.choices ?? {})) v.forEach(add); }
  ch.extraSpells?.forEach(add);
  ch.inventory.forEach((i) => add(i.itemId));
  for (const v of Object.values(ch.decisions)) v.forEach(add);
  return [...ids].sort();
}

const exists = (rs: Ruleset, id: string) => HB_KINDS.some((k) => (rs[k] as Map<string, unknown>).has(id));

// Id homebrew usati dal personaggio che il ruleset attuale non ha più (pacchetto spento, cancellato o mancante su questo dispositivo)
export const missingHomebrew = (ch: Character, rs: Ruleset): string[] => homebrewIds(ch).filter((id) => !exists(rs, id));

// Voci (attive o no) che servono ai personaggi dati: per esportarle insieme a loro
export function entriesUsedBy(entries: HbEntry[], chars: Character[]): HbEntry[] {
  const ids = new Set(chars.flatMap(homebrewIds));
  // una classe porta con sé le sottoclassi scelte, una sottoclasse la sua classe, un background il suo talento
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of entries) {
      const d = e.data as { classId?: string; feat?: string };
      const need = [ids.has(e.data.id) ? d.classId : undefined, ids.has(e.data.id) ? d.feat : undefined];
      for (const n of need) if (isHb(n) && !ids.has(n)) { ids.add(n); grew = true; }
    }
  }
  return entries.filter((e) => ids.has(e.data.id));
}

// Personaggi che usano almeno una di queste voci (per avvisare prima di spegnerle o cancellarle)
export const charactersUsing = <C extends Character>(chars: C[], ids: string[]): C[] =>
  chars.filter((c) => homebrewIds(c).some((id) => ids.includes(id)));
