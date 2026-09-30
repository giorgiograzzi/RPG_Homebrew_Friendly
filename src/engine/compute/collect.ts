import { SKILLS, type Choice, type Effect } from "../schema";
import type { Character } from "../types";
import type { Ruleset } from "../ruleset";
import { lookupItem, needsAttunement } from "../equipment/loadout";
import type { FeatureInfo } from "./types";

// Un effetto con la sua provenienza ("da dove viene")
export interface Entry {
  effect: Effect;
  label: string;
  classId?: string; // per risorse a tabella e caratteristica da incantatore: classe proprietaria
}

type ActivationDef = { resource?: string; requires?: string; label?: { it: string }; duration?: string; options?: { id: string; name: { it: string }; description?: string; effects: Effect[] }[] };
type PlayFields = { usage?: { uses: number | string | { table: number[] }; recharge: "short_rest" | "long_rest" | "dawn" | "none"; partialShortRest?: number }; activation?: ActivationDef; needsReview?: boolean };

export interface Collected {
  entries: Entry[];
  features: Set<string>;
  feats: Set<string>;
  languages: Set<string>; // linguaggi (Comune + scelte + Druidico, Gergo dei ladri)
  masteries: Set<string>; // armi di cui si usa la proprietà di maestria (scelte `weaponMastery`)
  info: Omit<FeatureInfo, "active" | "picked">[]; // elenco dei privilegi (senza lo stato di attivazione)
}

const SKILL_IDS = new Set<string>(SKILLS);

type Picks = (choiceId: string) => string[] | undefined;
// prefix: chiave delle scelte interne di un talento concesso da una scelta ("asi_fighter_4/"): due acquisizioni non si mescolano
type Owner = { label: string; classId?: string; picks: Picks; prefix: string };
type Holder = { name: { it: string }; effects: Effect[]; choices: Choice[] } & PlayFields;

const withAbility = (c: Choice, spell: Effect & { op: "grantSpell" }): Effect =>
  ({ ...spell, ...(c.ability ? { ability: c.ability } : {}), ...(c.abilityFrom ? { abilityFrom: c.abilityFrom } : {}) });

// Convenzione per le scelte "source": gli id scelti diventano effetti standard.
//   skills / expertise / skillsTools / tools:* / weapons:* / cantrips:* / spells:* / freespells / alwaysspells / resistance / feats:*
// Le altre (languages, weaponMastery...) non hanno effetti sul calcolo.
function sourceEffects(c: Choice, picked: string[], key: string): Effect[] {
  const kind = c.source!.split(":")[0];
  const spell = (s: string, mode: "cantrip" | "known" | "alwaysPrepared", free?: boolean) =>
    withAbility(c, { op: "grantSpell", spell: s, mode, ...(free ? { freeCast: { uses: 1, recharge: "long_rest" as const } } : {}) });
  switch (kind) {
    case "skills": return [{ op: "grantSkillProficiency", skills: picked as never, expertise: false, upgradeToExpertise: false }];
    case "expertise": return [{ op: "grantSkillProficiency", skills: picked as never, expertise: true, upgradeToExpertise: false }];
    case "tools": return [{ op: "grantToolProficiency", tools: picked }];
    case "weapons": return [{ op: "grantWeaponProficiency", weapons: picked }];
    case "cantrips": return picked.map((s) => spell(s, "cantrip"));
    case "spells": return picked.map((s) => spell(s, "known"));
    case "feats": return picked.map((f) => ({ op: "grantFeat", feat: f, via: key }));
    // abilità e strumenti in qualsiasi combinazione (talento Esperto)
    case "skillsTools": {
      const skills = picked.filter((p) => SKILL_IDS.has(p)), tools = picked.filter((p) => !SKILL_IDS.has(p));
      return [
        ...(skills.length ? [{ op: "grantSkillProficiency", skills: skills as never, expertise: false, upgradeToExpertise: false } as Effect] : []),
        ...(tools.length ? [{ op: "grantToolProficiency", tools } as Effect] : []),
      ];
    }
    // incantesimo sempre preparato, lanciabile 1 volta per Riposo Lungo senza slot
    case "freespells": return picked.map((s) => spell(s, "alwaysPrepared", true));
    // incantesimo sempre preparato (senza lancio gratuito)
    case "alwaysspells": return picked.map((s) => spell(s, "alwaysPrepared"));
    case "resistance": return [{ op: "resistance", types: picked }];
    default: return [];
  }
}

// Raccoglie TUTTI gli effetti del personaggio senza valutare le condizioni `when`
// (si filtrano dopo, con il contesto giusto: armatura, arma...). Livello dei privilegi
// di specie/talento = livello totale; di classe/sottoclasse = livello di quella classe.
// Le scelte di un talento acquisito (Character.feats[i].choices) hanno la precedenza sulle
// decisioni generali: così un talento ripetibile (Resiliente, Iniziato alla magia) ha scelte per ogni acquisizione.
export function collectEffects(ch: Character, rs: Ruleset): Collected {
  const out: Collected = { entries: [], features: new Set(), feats: new Set(), masteries: new Set(), languages: new Set(["common"]), info: [] };
  const activeStates = ch.state.active ?? {};
  const seenFeats = new Set<string>();
  const general: Picks = (id) => ch.decisions[id];

  const add = (effect: Effect, o: Owner) => {
    // caratteristica da incantatore fissata da una scelta (es. spell_ability, magic_initiate_ability)
    if (effect.op === "grantSpell" && effect.abilityFrom && !effect.ability) {
      const a = o.picks(o.prefix + effect.abilityFrom)?.[0];
      if (a) effect = { ...effect, ability: a as never };
    }
    out.entries.push(o.classId ? { effect, label: o.label, classId: o.classId } : { effect, label: o.label });
    if (effect.op === "grantFeature") out.features.add(effect.feature);
    if (effect.op === "grantFeat") addFeat(effect.feat, undefined, general, effect.via ? `${effect.via}/` : "");
  };
  const addHolder = (h: Holder, o: Owner) => {
    for (const e of h.effects) add(e, o);
    for (const c of h.choices) addChoice(c, o);
  };
  // Usi limitati e attivazione di un privilegio/talento: `usage` diventa una risorsa (id = id del privilegio); se il privilegio è
  // attivo valgono anche gli effetti dell'opzione scelta all'attivazione. Restituisce l'elenco per la scheda.
  const playOf = (h: Holder & { id: string; description: string; level?: number }, o: Owner, kind: FeatureInfo["kind"], source: string, level: number) => {
    if (h.usage) add({ op: "resource", resourceId: h.id, uses: h.usage.uses, recharge: h.usage.recharge, ...(h.usage.partialShortRest ? { partialShortRest: h.usage.partialShortRest } : {}) } as Effect, o);
    const picked = activeStates[h.id];
    if (picked && h.activation?.options) for (const opt of h.activation.options) if (picked.includes(opt.id)) opt.effects.forEach((e) => add(e, o));
    const resourceId = h.usage ? h.id : (h.effects.find((e) => e.op === "resource") as { resourceId?: string } | undefined)?.resourceId;
    out.info.push({
      id: h.id, name: h.name.it, description: h.description, kind, source, level, ...(resourceId ? { resourceId } : {}),
      ...(h.activation ? { activation: {
        ...(h.activation.resource ? { resource: h.activation.resource } : {}), ...(h.activation.requires ? { requires: h.activation.requires } : {}),
        ...(h.activation.label ? { label: h.activation.label.it } : {}), ...(h.activation.duration ? { duration: h.activation.duration } : {}),
        options: (h.activation.options ?? []).map((x) => ({ id: x.id, name: x.name.it, ...(x.description ? { description: x.description } : {}) })),
      } } : {}),
      needsReview: !!h.needsReview,
    });
  };
  const addChoice = (c: Choice, o: Owner) => {
    const key = o.prefix + c.id;
    const picked = o.picks(key) ?? [];
    if (c.options) {
      for (const opt of c.options) {
        if (!picked.includes(opt.id)) continue;
        out.features.add(opt.id); // l'opzione scelta conta come posseduta (prerequisiti: hasFeature:pact_of_the_blade)
        opt.effects.forEach((e) => add(e, o));
      }
    } else if (c.source) {
      if (c.source === "weaponMastery") picked.forEach((w) => out.masteries.add(w));
      if (c.source.startsWith("languages")) picked.forEach((l) => out.languages.add(l));
      sourceEffects(c, picked, key).forEach((e) => add(e, o));
    }
  };
  const addFeat = (id: string, instance: Record<string, string[]> | undefined, base: Picks, prefix = "") => {
    const f = rs.feats.get(id);
    // un talento non ripetibile non si somma a se stesso (background + talento scelto)
    if (!f?.repeatable) { if (seenFeats.has(id)) return; seenFeats.add(id); }
    out.feats.add(id);
    if (f) {
      const fo = { label: f.name.it, prefix, picks: instance ? (cid: string) => instance[cid] ?? base(cid) : base };
      addHolder(f, fo);
      playOf(f, fo, "feat", f.name.it, 0);
    }
  };
  const addLeveled = (list: (Holder & { id: string; level: number; description: string })[],
    lvl: number, o: Owner, kind: FeatureInfo["kind"]) => {
    for (const f of list) {
      if (f.level > lvl) continue;
      out.features.add(f.id);
      const fo = { ...o, label: `${o.label}: ${f.name.it}` };
      addHolder(f, fo);
      playOf(f, fo, kind, o.label, f.level);
    }
  };

  const totalLevel = ch.classes.reduce((n, c) => n + c.level, 0);
  const sp = rs.species.get(ch.speciesId);
  if (sp) {
    const o = { label: sp.name.it, picks: general, prefix: "" };
    addHolder(sp, o);
    addLeveled(sp.traits, totalLevel, o, "species");
  }
  const bg = rs.backgrounds.get(ch.backgroundId);
  if (bg) {
    addHolder(bg, { label: bg.name.it, picks: general, prefix: "" });
    addFeat(bg.feat, undefined, general);
  }
  for (const cl of ch.classes) {
    const def = rs.classes.get(cl.classId);
    if (!def) continue;
    const o = { label: def.name.it, classId: cl.classId, picks: general, prefix: "" };
    addHolder(def, o);
    addLeveled(def.features, cl.level, o, "class");
    const sub = cl.subclassId ? rs.subclasses.get(cl.subclassId) : undefined;
    if (sub && cl.level >= def.subclassLevel) {
      const so = { label: sub.name.it, classId: cl.classId, picks: general, prefix: "" };
      addHolder(sub, so);
      addLeveled(sub.features, cl.level, so, "subclass");
    }
  }
  for (const f of ch.feats) addFeat(f.featId, f.choices ?? {}, general);
  // equipaggiamento magico: le cariche ci sono finché l'oggetto non è a terra (si ricaricano anche nello zaino);
  // gli effetti valgono con l'arma impugnata, l'armatura indossata, l'oggetto nello zaino, e con sintonia solo se sintonizzati
  for (const e of ch.inventory) {
    const f = lookupItem(rs, e.itemId);
    if (!f || e.state === "dropped") continue;
    const cg = "charges" in f.def ? f.def.charges : undefined;
    const effectsOn = f.def.effects.length > 0 && (f.kind === "weapon" ? e.state === "wielded" : f.kind === "armor" ? e.state === "worn" : true) && !(needsAttunement(f) && !e.attuned);
    if (!cg && !effectsOn) continue;
    const go = { label: f.def.name.it, picks: general, prefix: "" };
    if (cg) add({ op: "resource", resourceId: `item:${f.def.id}`, uses: cg.max, recharge: cg.recharge, ...(cg.regain ? { regain: cg.regain } : {}) } as Effect, go);
    if (!effectsOn) continue;
    for (const ef of f.def.effects) {
      // i bonus di un'arma valgono solo per i suoi attacchi, non per tutti
      const own = f.kind === "weapon" && (ef.op === "attackBonus" || ef.op === "damageBonus" || ef.op === "critRange");
      add(own ? { ...ef, when: ef.when ? `usingWeapon:${f.def.id} && (${ef.when})` : `usingWeapon:${f.def.id}` } : ef, go);
    }
  }
  // linguaggi: Comune + scelta di creazione + Druidico e Gergo dei ladri dai privilegi
  (ch.decisions.languages ?? []).forEach((l) => out.languages.add(l));
  if (out.features.has("druidic")) out.languages.add("druidic");
  if (out.features.has("thieves_cant")) out.languages.add("thieves_cant");
  return out;
}
