import type { Ruleset } from "../ruleset";
import type { Character, Spell } from "../types";
import { evalCondition } from "../compute/condition-eval";
import { parseCondition } from "../schema";
import { buildCtx } from "../compute/context";
import { isProficient } from "../compute/attacks";
import { computeProfs } from "../compute/proficiencies";
import { spellChoiceCandidates } from "../spells";
import { describeCondition } from "./describe";
import type { Slot } from "./slots";
import type { OptionState } from "./types";

const ENERGY = ["acid", "cold", "fire", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"]; // Dono della resistenza all'energia
const opt = (id: string, name: string, extra: Partial<OptionState> = {}): OptionState => ({ id, name, enabled: true, selected: false, ...extra });
const off = (o: OptionState, reason: string): OptionState => ({ ...o, enabled: false, disabledReason: reason });

// Livello massimo di incantesimo per cui la classe ha slot (gli incantesimi preparati devono essere di questi livelli)
function maxSpellLevel(ch: Character, rs: Ruleset, classId: string): number {
  const cl = ch.classes.find((c) => c.classId === classId);
  const def = rs.classes.get(classId);
  if (!cl || !def) return 0;
  if (def.caster === "pact") return def.pactSlots?.[cl.level - 1]?.level ?? 0;
  const own = def.spellSlots ?? (cl.subclassId ? rs.subclasses.get(cl.subclassId)?.spellSlots : undefined);
  return own?.[cl.level - 1]?.length ?? 0;
}

// Stato delle opzioni di una scelta, in ordine: tiene conto di ciò che il personaggio ha GIÀ (dati fissi e scelte precedenti).
// `ch` deve essere il personaggio senza le decisioni di questa scelta e delle successive (lo fa questions.ts).
export function optionStates(slot: Slot, ch: Character, rs: Ruleset, selected: string[]): OptionState[] {
  const ctx = buildCtx(ch, rs);
  const profs = computeProfs(ctx);
  const c = slot.choice;
  const prefix = slot.key.slice(0, slot.key.length - c.id.length);
  const scoped = Object.fromEntries(Object.entries(ch.decisions).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
  const cond = (src: string) => evalCondition(parseCondition(src), { ...ctx, armorTraining: profs.armor });
  let list: OptionState[];

  if (c.options) {
    list = c.options.map((o) => {
      let st = opt(o.id, o.name.it, { ...(o.description ? { description: o.description } : {}), ...(o.cost !== undefined ? { cost: o.cost } : {}) });
      if (o.requires && !cond(o.requires)) st = off(st, `Richiede ${describeCondition(o.requires, rs)}`);
      for (const e of o.effects) {
        if (e.op === "grantSkillProficiency" && !e.upgradeToExpertise && !e.expertise && e.skills.every((s) => profs.skills.has(s))) st = off(st, "Già competente");
        if (e.op === "grantSaveProficiency" && e.abilities.every((a) => profs.saves.has(a))) st = off(st, "Già competente nel tiro salvezza");
      }
      return st;
    });
  } else {
    const [kind, arg] = (c.source ?? "").split(":");
    const skillOpts = () => [...rs.skills.values()].map((s) => opt(s.id, s.name.it));
    switch (kind) {
      case "skills": list = skillOpts().map((o) => (profs.skills.has(o.id) ? off(o, "Già competente") : o)); break;
      case "expertise": list = skillOpts().map((o) => (!profs.skills.has(o.id) ? off(o, "Serve prima la competenza") : profs.expertise.has(o.id) ? off(o, "Ha già la Maestria") : o)); break;
      case "skillsTools": list = [...skillOpts().map((o) => (profs.skills.has(o.id) ? off(o, "Già competente") : o)),
        ...[...rs.tools.values()].map((t) => (profs.tools.has(t.id) ? off(opt(t.id, t.name.it), "Già competente") : opt(t.id, t.name.it)))]; break;
      case "tools": {
        const groups = new Set(arg === "artisan_musical" ? ["artisan", "musical"] : [arg ?? ""]);
        list = [...rs.tools.values()].filter((t) => groups.has(t.group)).map((t) => (profs.tools.has(t.id) ? off(opt(t.id, t.name.it), "Già competente") : opt(t.id, t.name.it)));
        break;
      }
      case "weaponMastery":
        list = [...rs.weapons.values()].map((w) => {
          const o = opt(w.id, w.name.it);
          if (c.weaponFilter && w.kind !== c.weaponFilter.kind) return off(o, c.weaponFilter.kind === "melee" ? "Solo armi da mischia" : "Solo armi a distanza");
          return isProficient(w, profs.weapons) ? o : off(o, "Non sei competente");
        });
        break;
      case "feats": {
        const cat = arg === "general" ? "general" : arg;
        list = [...rs.feats.values()].filter((f) => f.category === cat).map((f) => {
          const o = opt(f.id, f.origin === "homebrew" ? `${f.name.it} · Homebrew` : f.name.it, { description: f.description });
          const unmet = f.prerequisites.find((p) => !cond(p));
          if (unmet) return off(o, `Richiede ${describeCondition(unmet, rs)}`);
          if (!f.repeatable && ctx.collected.feats.has(f.id)) return off(o, "Già posseduto");
          return o;
        });
        break;
      }
      case "cantrips": case "spells": case "freespells": case "alwaysspells": {
        let cands: Spell[] = spellChoiceCandidates(rs, c, scoped);
        // Mago: gli incantesimi preparati si scelgono dal libro
        if (kind === "spells" && slot.classId && /_prepared$/.test(c.id)) {
          const bookPicks = ch.decisions[`${slot.classId}_spellbook`];
          if (bookPicks !== undefined || rs.classes.get(slot.classId)?.features.some((f) => f.choices.some((k) => k.id === `${slot.classId}_spellbook`))) cands = cands.filter((s) => (bookPicks ?? []).includes(s.id));
        }
        const max = kind === "spells" && slot.classId ? maxSpellLevel(ch, rs, slot.classId) : 9;
        list = cands.map((s) => (s.level > max ? off(opt(s.id, s.name.it), max ? `Nessuno slot di ${s.level}° livello` : "Nessuno slot") : opt(s.id, s.name.it)));
        break;
      }
      case "languages":
        list = [...rs.languages.values()].filter((l) => l.id !== "common" && l.extra.rarity === "standard").map((l) => (ctx.collected.languages.has(l.id) ? off(opt(l.id, l.name.it), "Già conosciuto") : opt(l.id, l.name.it)));
        break;
      case "resistance": list = ENERGY.map((t) => opt(t, rs.damageTypes.get(t)?.name.it ?? t)); break;
      default: list = [];
    }
  }
  return list.map((o) => ({ ...o, selected: selected.includes(o.id) }));
}

