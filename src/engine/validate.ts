import type { Ruleset } from "./ruleset";
import { parseCondition, type Choice, type Condition, type Effect } from "./schema";

function atoms(c: Condition, out: Condition[] = []): Condition[] {
  if (c.t === "and" || c.t === "or") c.items.forEach((i) => atoms(i, out));
  else if (c.t === "not") atoms(c.item, out);
  else out.push(c);
  return out;
}


// Controllo dei riferimenti incrociati tra voci dei dati (oltre alla validazione Zod).
// Ogni controllo salta se la tabella di destinazione è vuota (dati non ancora caricati).
export function checkReferences(rs: Ruleset): string[] {
  const errs: string[] = [];
  const need = (from: string, what: string, id: string, target: Map<string, unknown>, tname: string) => {
    if (target.size > 0 && !target.has(id)) errs.push(`${from}: ${what} "${id}" non esiste in ${tname}`);
  };
  for (const w of rs.weapons.values()) {
    need(`weapons/${w.id}`, "maestria", w.mastery, rs.masteries, "masteries");
    need(`weapons/${w.id}`, "tipo di danno", w.damageType, rs.damageTypes, "damageTypes");
    for (const p of w.properties) need(`weapons/${w.id}`, "proprietà", p, rs.weaponProperties, "weaponProperties");
  }
  for (const it of rs.items.values())
    for (const c of it.contents ?? []) need(`items/${it.id}`, "contenuto", c.item, rs.items, "items");
  
  const known = (id: string) =>
    id.startsWith("$") || rs.items.has(id) || rs.weapons.has(id) || rs.armors.has(id) || rs.tools.has(id);
  for (const b of rs.backgrounds.values()) {
    need(`backgrounds/${b.id}`, "talento", b.feat, rs.feats, "feats");
    if (!["artisan", "gaming", "musical"].includes(b.tool)) need(`backgrounds/${b.id}`, "strumento", b.tool, rs.tools, "tools");
    for (const skill of b.skills) need(`backgrounds/${b.id}`, "abilità", skill, rs.skills, "skills");
    for (const [opt, set] of Object.entries(b.equipment))
      for (const it of set?.items ?? [])
        if (rs.items.size && !known(it.item)) errs.push(`backgrounds/${b.id}: equipaggiamento ${opt}: "${it.item}" non esiste`);
    if (b.tool === "gaming" || b.tool === "musical" || b.tool === "artisan") {
      const ch = b.choices.find((c) => c.id === `${b.id}_tool`);
      if (!ch) errs.push(`backgrounds/${b.id}: manca la scelta dello strumento`);
    }
  }
  for (const f of rs.feats.values())
    for (const e of f.effects)
      if (e.op === "grantFeat") need(`feats/${f.id}`, "talento concesso", e.feat, rs.feats, "feats");
  for (const c of rs.conditions.values()) {
    for (const g of c.grantsConditions) need(`conditions/${c.id}`, "condizione inclusa", g, rs.conditions, "conditions");
    for (const e of c.effects) for (const i of e.conditions ?? []) need(`conditions/${c.id}`, "immunità a", i, rs.conditions, "conditions");
    if (c.stackable && !c.levels) errs.push(`conditions/${c.id}: cumulativa senza livelli`);
    if (c.requiresSource && !c.effects.length) errs.push(`conditions/${c.id}: richiede la fonte ma non ha effetti`);
  }
  // hasFeature / hasFeat nelle condizioni (prerequisiti, requires, when) devono riferirsi a privilegi e talenti che esistono
  const featureIds = new Set<string>();
  const choicesOf = (h: { choices: Choice[] }) => h.choices.flatMap((c) => c.options ?? []);
  const holders: { where: string; effects: Effect[]; choices: Choice[]; features?: { id: string; effects: Effect[]; choices: Choice[] }[] }[] = [
    ...[...rs.species.values()].map((x) => ({ where: `species/${x.id}`, effects: x.effects, choices: x.choices, features: x.traits })),
    ...[...rs.classes.values()].map((x) => ({ where: `classes/${x.id}`, effects: x.effects, choices: x.choices, features: x.features })),
    ...[...rs.subclasses.values()].map((x) => ({ where: `subclasses/${x.id}`, effects: x.effects, choices: x.choices, features: x.features })),
    ...[...rs.feats.values()].map((x) => ({ where: `feats/${x.id}`, effects: x.effects, choices: x.choices })),
  ];
  for (const h of holders) {
    for (const f of h.features ?? []) featureIds.add(f.id);
    for (const c of [h, ...(h.features ?? [])]) {
      for (const o of choicesOf(c)) featureIds.add(o.id);
      for (const e of c.effects) if (e.op === "grantFeature") featureIds.add(e.feature);
    }
  }
  const checkCond = (where: string, src: string | undefined) => {
    if (!src || !featureIds.size) return;
    for (const a of atoms(parseCondition(src))) {
      if (a.t === "hasFeature" && !featureIds.has(a.value)) errs.push(`${where}: hasFeature:${a.value} non corrisponde a nessun privilegio`);
      if (a.t === "hasFeat" && rs.feats.size && !rs.feats.has(a.value)) errs.push(`${where}: hasFeat:${a.value} non corrisponde a nessun talento`);
    }
  };
  for (const h of holders) {
    for (const c of [h, ...(h.features ?? [])]) {
      for (const e of c.effects) checkCond(h.where, e.when);
      for (const o of choicesOf(c)) { checkCond(`${h.where}/${o.id}`, o.requires); for (const e of o.effects) checkCond(`${h.where}/${o.id}`, e.when); }
    }
  }
  for (const f of rs.feats.values()) for (const p of f.prerequisites) checkCond(`feats/${f.id}`, p);
  // incantesimi concessi: devono esistere e il modo deve coincidere col livello (trucchetto ⇔ livello 0); filtri delle scelte coerenti
  if (rs.spells.size) {
    const SCHOOLS = new Set([...rs.spells.values()].map((sp) => sp.school));
    const CLASSES = new Set(["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"]);
    for (const h of holders) {
      for (const c of [h, ...(h.features ?? [])]) {
        const effects = [...c.effects, ...choicesOf(c).flatMap((o) => o.effects)];
        for (const e of effects) {
          if (e.op !== "grantSpell") continue;
          const sp = rs.spells.get(e.spell);
          if (!sp) { errs.push(`${h.where}: incantesimo "${e.spell}" non esiste in spells`); continue; }
          if ((sp.level === 0) !== (e.mode === "cantrip")) errs.push(`${h.where}: ${e.spell} (livello ${sp.level}) con modo "${e.mode}"`);
        }
        for (const ch of c.choices) {
          for (const sc of ch.filter?.schools ?? []) if (!SCHOOLS.has(sc as never)) errs.push(`${h.where}/${ch.id}: scuola "${sc}" non valida`);
          for (const cl of ch.filter?.classes ?? []) if (!CLASSES.has(cl)) errs.push(`${h.where}/${ch.id}: lista "${cl}" non valida`);
          const from = ch.filter?.classFrom;
          if (from && !c.choices.some((x) => x.id === from)) errs.push(`${h.where}/${ch.id}: classFrom "${from}" non è una scelta dello stesso privilegio`);
          const list = ch.source && /^(cantrips|spells):(\w+)$/.exec(ch.source)?.[2];
          if (list && !CLASSES.has(list)) errs.push(`${h.where}/${ch.id}: lista "${list}" non valida`);
        }
      }
    }
  }
  for (const s of rs.skills.values()) {
    const ab = String(s.extra.ability ?? "");
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(ab)) errs.push(`skills/${s.id}: caratteristica "${ab}" non valida`);
  }
  return errs;
}
