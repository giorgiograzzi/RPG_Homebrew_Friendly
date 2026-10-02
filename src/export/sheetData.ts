import { computeCharacter } from "../engine/compute";
import type { Skill } from "../engine/compute/types";
import { lookupItem } from "../engine/equipment";
import { characterSize } from "../engine/creation";
import { spellbook } from "../engine/magic";
import type { Ruleset } from "../engine/ruleset";
import { ABILITIES, type Ability } from "../engine/schema";
import { DETAIL_FIELDS, type Character } from "../engine/types";
import { lang as appLang, STRINGS, type Lang } from "../i18n";
import { distance } from "../ui/units";

// Dati del personaggio pronti da scrivere sulla scheda PDF (step 7): solo testi già formattati.
// Niente calcoli qui: ogni numero arriva dal motore (computeCharacter), la scheda stampata coincide con quella dell'app.
export interface SheetData {
  name: string; klass: string; level: string; subclass: string; species: string; background: string; xp: string; size: string;
  speed: string; initiative: string; passive: string; pb: string; hpNow: string; hpMax: string; hitDice: string; hitDiceUsed: string; ac: string; shield: boolean; inspiration: boolean;
  scores: Record<Ability, { score: string; mod: string; save: string; saveProf: boolean }>;
  skills: Partial<Record<Skill, { value: string; prof: "none" | "half" | "proficient" | "expertise" }>>;
  armor: { light: boolean; medium: boolean; heavy: boolean; shield: boolean };
  weapons: string; tools: string;
  attacks: { name: string; bonus: string; damage: string; notes: string }[];
  classFeatures: string[]; speciesTraits: string[]; feats: string[];
  // pagina 2
  details: string[]; // "Etichetta: testo" per ogni dettaglio compilato
  alignment: string; languages: string; equipment: string[]; attunement: string[];
  coins: { cp: string; sp: string; ep: string; gp: string; pp: string };
  spellAbility: string; spellMod: string; spellDc: string; spellAtk: string; slots: string[];
  spells: { level: string; name: string; time: string; range: string; concentration: boolean; ritual: boolean; material: boolean; notes: string; meta: string; summary: string; higher: string }[];
}

export const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const nameOf = (m: Map<string, { name: { it: string } }>, id: string) => m.get(id)?.name.it ?? id;

// `lang` decide le parole scritte da qui (unità, tempi di lancio...); i nomi delle voci arrivano già nella lingua del ruleset
export function buildSheetData(ch: Character, rs: Ruleset, lang: Lang = appLang): SheetData {
  const P = STRINGS[lang].pdf, AB = STRINGS[lang].wizard.abilities as Record<Ability, string>;
  const TIME: Record<string, string> = { action: P.action, bonus_action: P.bonusAction, reaction: P.reaction };
  const d = computeCharacter(ch, rs);
  const totalLevel = ch.classes.reduce((n, c) => n + c.level, 0);
  const size = characterSize(ch, rs);
  const sheet = {} as SheetData["scores"];
  for (const a of ABILITIES) sheet[a] = { score: String(d.scores[a].value), mod: sign(d.mods[a].value), save: sign(d.saves[a].bonus.value), saveProf: d.saves[a].proficient };

  const skills: SheetData["skills"] = {};
  for (const [id, s] of Object.entries(d.skills) as [Skill, (typeof d.skills)[Skill]][]) skills[id] = { value: sign(s.bonus.value), prof: s.proficiency };

  const weaponNames = d.proficiencies.weapons.map((w) => (w === "simple" ? P.simpleWeapons : w === "martial" ? P.martialWeapons : w.replace(/\[.*\]$/, "") === "martial" ? P.martialWeaponsWith.replace("{p}", w.slice(8, -1)) : nameOf(rs.weapons, w)));
  const toolNames = d.proficiencies.tools.map((x) => nameOf(rs.tools, x));

  const info = (kinds: string[]) => d.featureList.filter((f) => kinds.includes(f.kind)).sort((a, b) => a.level - b.level)
    .map((f) => `${f.name}${f.level > 1 ? ` (${f.level}°)` : ""}${f.description ? `: ${f.description}` : ""}`);

  // incantesimi: prima i trucchetti, poi per livello; nell'elenco stanno quelli che il personaggio può usare
  const book = spellbook(ch, rs, d).filter((e) => e.sources.some((s) => s.kind !== "book") || e.castable)
    .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.it.localeCompare(b.spell.name.it, "it"));
  const kindWord: Record<string, string> = { cantrip: "", ...P.spellKind };
  const sc = d.spellcasting[0];
  const creation = rs.creation.get("creation");
  const align = ch.decisions["alignment"]?.[0];

  return {
    name: ch.name, klass: ch.classes.map((c) => nameOf(rs.classes, c.classId)).join(" / "), level: String(totalLevel),
    subclass: ch.classes.map((c) => (c.subclassId ? nameOf(rs.subclasses, c.subclassId) : "")).filter(Boolean).join(" / "),
    species: nameOf(rs.species, ch.speciesId), background: nameOf(rs.backgrounds, ch.backgroundId), xp: ch.xp !== undefined ? String(ch.xp) : "",
    size: size ? nameOf(rs.sizes, size) : "", speed: distance(d.speed.walk.value, lang), initiative: sign(d.initiative.value),
    passive: String(d.passivePerception.value), pb: sign(d.proficiencyBonus.value), hpNow: String(Math.min(ch.state.hp, d.hp.max.value)), hpMax: String(d.hp.max.value),
    hitDiceUsed: ch.state.hitDiceUsed ? String(ch.state.hitDiceUsed) : "", hitDice: d.hp.hitDice.map((h) => `${h.total}d${h.die}`).join(" + "), ac: String(d.ac.value), shield: !!d.loadout.shield, inspiration: ch.state.inspiration,
    scores: sheet, skills,
    armor: { light: d.proficiencies.armor.includes("light"), medium: d.proficiencies.armor.includes("medium"), heavy: d.proficiencies.armor.includes("heavy"), shield: d.proficiencies.armor.includes("shield") },
    weapons: weaponNames.join(", "), tools: toolNames.join(", "),
    attacks: d.attacks.slice(0, 8).map((a) => ({ name: a.label, bonus: sign(a.toHit.value), damage: a.damage.text, notes: a.notes.join(" · ") })),
    classFeatures: info(["class", "subclass"]), speciesTraits: info(["species"]), feats: info(["feat", "background"]),
    details: DETAIL_FIELDS.filter((k) => ch.details?.[k]?.trim()).map((k) => `${STRINGS[lang].wizard.details.labels[k]}: ${ch.details![k]!.trim()}`),
    alignment: align ? creation?.alignments.find((x) => x.id === align)?.name.it ?? align : "",
    languages: d.languages.map((l) => nameOf(rs.languages, l)).join(", "),
    equipment: ch.inventory.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${lookupItem(rs, i.itemId)?.def.name.it ?? i.itemId}`),
    attunement: ch.inventory.filter((i) => i.attuned).map((i) => lookupItem(rs, i.itemId)?.def.name.it ?? i.itemId),
    coins: { cp: String(ch.coins.cp), sp: String(ch.coins.sp), ep: String(ch.coins.ep), gp: String(ch.coins.gp), pp: String(ch.coins.pp) },
    spellAbility: sc ? AB[sc.ability] : "", spellMod: sc ? sign(d.mods[sc.ability].value) : "", spellDc: sc ? String(sc.dc.value) : "", spellAtk: sc ? sign(sc.attack.value) : "",
    slots: Array.from({ length: 9 }, (_, i) => (d.spellSlots.slots[i] ? String(d.spellSlots.slots[i]) : "")),
    spells: book.map((e) => {
      const c = e.spell.castingTime;
      const time = c.unit === "minute" ? `${c.amount} ${P.minute}` : c.unit === "hour" ? `${c.amount} ${P.hour}` : `${c.amount > 1 ? `${c.amount} ` : ""}${TIME[c.unit] ?? c.unit}`;
      return {
        level: String(e.spell.level), name: e.spell.name.it, time, range: e.spell.range,
        concentration: e.spell.concentration, ritual: e.spell.ritual, material: !!e.spell.components.m,
        notes: [kindWord[e.sources[0]?.kind ?? ""] ?? "", e.spell.components.material ?? ""].filter(Boolean).join(" · "),
        // scheda dettagliata: livello, tempo, gittata, componenti e durata; poi il testo
        meta: [e.spell.level === 0 ? P.cantrip : `${e.spell.level}°`, time, e.spell.range, [e.spell.components.v && "V", e.spell.components.s && "S", e.spell.components.m && "M"].filter(Boolean).join(" ") + (e.spell.components.material ? ` (${e.spell.components.material})` : ""),
          `${P.duration}: ${e.spell.duration}${e.spell.concentration ? " (C)" : ""}`].filter(Boolean).join(" · "),
        summary: e.spell.summary, higher: e.spell.higherLevels ?? "",
      };
    }),
  };
}

