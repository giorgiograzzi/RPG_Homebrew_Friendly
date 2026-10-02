import { tr } from "../../i18n/tr";
import { ABILITIES, type Ability } from "../schema";
import type { Ruleset } from "../ruleset";
import type { Character, Sourced } from "../types";
import { combineMode } from "./rolls";
import type { ConditionState, Derived, Lists } from "./types";

const FACTOR = /^(-?\d+)\s*\*\s*exhaustion_level$/; // "-2 * exhaustion_level"
const CANNOT: Record<string, string> = {
  cant_see: tr("vedere", "see"), cant_hear: tr("sentire", "hear"), cant_speak: tr("parlare", "speak"), break_concentration: tr("concentrarsi", "concentrate"),
  unaware_of_surroundings: tr("percepire ciò che ti circonda", "be aware of your surroundings"),
};
const BLOCK: Record<string, string> = { action: tr("azione", "an action"), bonus_action: tr("azione bonus", "a bonus action"), reaction: tr("reazione", "a reaction") };

const lists = (): Lists => ({ adv: [], dis: [] });
const push = (l: Lists, mode: "advantage" | "disadvantage" | undefined, who: string) => { if (mode) (mode === "advantage" ? l.adv : l.dis).push(who); };
const uniq = <T>(a: T[]) => [...new Set(a)];

// Condizioni attive → effetti calcolabili. Regole (spec condizioni dell'SRD):
//  - le condizioni incluse (grantsConditions) si risolvono ricorsivamente e senza duplicati;
//  - un'immunità (Pietrificato → Avvelenato) toglie la condizione;
//  - Vantaggio e Svantaggio sullo stesso tiro si annullano (combineMode);
//  - Esaurimento è a livelli (state.exhaustion, 0-6).
// Gli effetti con `when`/`unless` (fonte in vista, attaccante entro 5 ft...) non sono calcolabili: vanno in `situational`.
export function resolveConditions(ch: Character, rs: Ruleset): ConditionState {
  const level = Math.max(0, Math.min(6, Math.floor(ch.state.exhaustion)));
  const seed = ch.state.conditions.filter((c) => c !== "exhaustion");
  if (level > 0) seed.push("exhaustion");
  const active = new Set<string>();
  const visit = (id: string) => {
    const d = rs.conditions.get(id);
    if (!d || active.has(id)) return;
    active.add(id);
    d.grantsConditions.forEach(visit);
  };
  seed.forEach(visit);

  const immune = new Set<string>();
  for (const id of active) for (const e of rs.conditions.get(id)!.effects) if (e.type === "condition_immunity") e.conditions?.forEach((c) => immune.add(c));
  const blocked = [...immune].filter((c) => active.delete(c));

  const st: ConditionState = {
    active: [], exhaustion: level, dead: false, immune: blocked, noActions: false, cannot: [], speedZero: [], d20Penalty: 0, speedPenalty: 0,
    rolls: { attack: lists(), checks: lists(), initiative: lists(), saves: Object.fromEntries(ABILITIES.map((a) => [a, lists()])) as Record<Ability, Lists> },
    attackRolls: { mode: "normal", modeSources: [] }, abilityChecks: { mode: "normal", modeSources: [] }, initiativeMode: { mode: "normal", modeSources: [] },
    autoFailSaves: {}, autoFailChecks: [], attacksAgainstYou: { advantage: [], disadvantage: [], autoCritical: [] }, resistAll: [], situational: [],
  };
  const situational = new Set<string>();

  for (const id of active) {
    const d = rs.conditions.get(id)!;
    const from = ch.state.conditionSources?.[id];
    const who = from ? `${d.name.it} (da ${from})` : d.name.it;
    const note = () => situational.add(`${who}: ${d.description}`);
    for (const e of d.effects) {
      // `when` sullo stato al tiro di Iniziativa si applica; ogni altra `when`/`unless` è situazionale
      const situ = !!(e.when && !e.when.endsWith("_when_rolling_initiative")) || !!e.unless;
      switch (e.type) {
        case "cant_see": case "cant_hear": case "cant_speak": case "break_concentration": case "unaware_of_surroundings":
          st.cannot.push(CANNOT[e.type]!); break;
        case "no_actions": st.noActions = true; for (const b of (e.blocks as string[] | undefined) ?? []) st.cannot.push(tr(`compiere ${BLOCK[b] ?? b}`, `take ${BLOCK[b] ?? b}`)); break;
        case "auto_fail_ability_check": st.autoFailChecks.push(tr(`${who}: prove che richiedono ${e.requires === "sight" ? "la vista" : "l'udito"}`, `${who}: checks that require ${e.requires === "sight" ? "sight" : "hearing"}`)); break;
        case "auto_fail_saving_throw": for (const a of e.abilities ?? []) (st.autoFailSaves[a] ??= []).push(who); break;
        case "saving_throw_mode": for (const a of e.abilities ?? []) push(st.rolls.saves[a], e.mode, who); break;
        case "own_attack_rolls": if (situ) note(); else push(st.rolls.attack, e.mode, who); break;
        case "own_ability_checks": if (situ) note(); else push(st.rolls.checks, e.mode, who); break;
        case "initiative_mode": push(st.rolls.initiative, e.mode, who); break;
        case "attack_rolls_against_self":
          if (situ) note(); else if (e.mode) st.attacksAgainstYou[e.mode].push(who); break;
        case "auto_critical_hit_against_self": st.attacksAgainstYou.autoCritical.push(`${who} (attaccante entro ${e.attackerWithinFt ?? 5} ft)`); break;
        case "speed_zero": st.speedZero.push(who); break;
        case "speed_modifier": case "d20_test_modifier": {
          const m = e.formula ? FACTOR.exec(e.formula) : null;
          if (!m) { note(); break; }
          const v = Number(m[1]) * level;
          if (e.type === "speed_modifier") st.speedPenalty += v; else st.d20Penalty += v;
          break;
        }
        case "death_at_level": if (e.level !== undefined && level >= e.level) st.dead = true; break;
        case "damage_resistance": if (e.damageTypes === "all") st.resistAll.push(who); else note(); break;
        case "condition_immunity": break; // già applicata sopra
        default: note(); // concealed, movimento, oggetti lasciati cadere, effetti legati alla fonte...
      }
    }
  }
  st.active = [...active];
  st.cannot = uniq(st.cannot);
  st.attackRolls = combineMode(st.rolls.attack.adv, st.rolls.attack.dis);
  st.abilityChecks = combineMode(st.rolls.checks.adv, st.rolls.checks.dis);
  st.initiativeMode = combineMode(st.rolls.initiative.adv, st.rolls.initiative.dis);
  st.situational = [...situational];
  return st;
}

// Velocità: le condizioni che la azzerano hanno la precedenza sui modificatori; Esaurimento -5 ft per livello (minimo 0)
export function applyConditionSpeed(speed: Derived["speed"], st: ConditionState): Derived["speed"] {
  if (!st.speedZero.length && !st.speedPenalty) return speed;
  const out = { ...speed };
  for (const k of Object.keys(speed) as (keyof Derived["speed"])[]) {
    const base = speed[k];
    if (base.value <= 0) continue;
    let v = base.value;
    const sources = [...base.sources];
    if (st.speedPenalty) { const p = Math.max(st.speedPenalty, -v); v += p; sources.push({ label: tr("Indebolimento", "Exhaustion"), value: p }); }
    if (st.speedZero.length) { sources.push({ label: tr(`Velocità 0: ${st.speedZero.join(", ")}`, `Speed 0: ${st.speedZero.join(", ")}`), value: -v }); v = 0; }
    out[k] = { value: v, sources } as Sourced;
  }
  return out;
}
