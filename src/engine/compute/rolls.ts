import { ABILITIES, SKILLS, type Ability } from "../schema";
import type { Ctx } from "./context";
import { SKILL_ABILITY } from "./constants";
import { evalValue } from "./formula-eval";
import type { Profs } from "./proficiencies";
import { sum, type Part } from "./sourced";
import type { ConditionState, Derived, Proficiency, RollMode, Skill } from "./types";

// Vantaggio e svantaggio non si cumulano: se ci sono entrambi si annullano (file 02 §9)
export function combineMode(adv: string[], dis: string[]): { mode: RollMode; modeSources: string[] } {
  if (adv.length && dis.length) return { mode: "normal", modeSources: [...adv.map((s) => `+ ${s}`), ...dis.map((s) => `- ${s}`)] };
  if (adv.length) return { mode: "advantage", modeSources: adv };
  if (dis.length) return { mode: "disadvantage", modeSources: dis };
  return { mode: "normal", modeSources: [] };
}

// Armatura indossata senza addestramento: svantaggio alle prove d20 di For e Des
export function untrainedArmor(x: Ctx, profs: Profs) {
  const a = x.bodyArmor;
  return !!a && !profs.armor.has(a.category);
}

export function computeRolls(x: Ctx, profs: Profs, notes: string[], cs: ConditionState) {
  const untrained = untrainedArmor(x, profs);
  const armorDis = "Armatura senza addestramento";
  const saves = {} as Derived["saves"];
  for (const a of ABILITIES) {
    const proficient = profs.saves.has(a);
    const parts: Part[] = [{ label: `Mod ${a}`, value: x.mods[a] }];
    if (proficient) parts.push({ label: "Competenza", value: x.pb });
    const adv: string[] = [...cs.rolls.saves[a].adv], dis: string[] = [...cs.rolls.saves[a].dis];
    if (cs.d20Penalty) parts.push({ label: "Esaurimento", value: cs.d20Penalty });
    for (const { effect: e, label } of x.active) {
      if (e.op === "saveBonus" && (!e.ability || e.ability === a)) parts.push({ label, value: evalValue(e.value, x) });
      if (e.op === "saveAdvantage" && (!e.abilities || e.abilities.includes(a))) {
        if (e.against) continue;
        adv.push(label);
      }
    }
    if (untrained && (a === "str" || a === "dex")) dis.push(armorDis);
    saves[a] = { bonus: sum(parts), proficient, autoFail: cs.autoFailSaves[a] ?? [], ...combineMode(adv, dis) };
  }
  for (const { effect: e, label } of x.active) {
    if (e.op === "saveAdvantage" && e.against) notes.push(`Vantaggio ai TS${e.abilities ? ` (${e.abilities.join("/")})` : ""} contro ${e.against} — ${label}`);
  }
  const jack = x.collected.features.has("jack_of_all_trades"); // Factotum del Bardo
  const skills = {} as Derived["skills"];
  for (const s of SKILLS as readonly Skill[]) {
    const ab: Ability = SKILL_ABILITY[s];
    let prof: Proficiency = profs.expertise.has(s) ? "expertise" : profs.skills.has(s) ? "proficient" : jack ? "half" : "none";
    const parts: Part[] = [{ label: `Mod ${ab}`, value: x.mods[ab] }];
    if (prof === "proficient") parts.push({ label: "Competenza", value: x.pb });
    if (prof === "expertise") parts.push({ label: "Maestria", value: x.pb * 2 });
    if (prof === "half") parts.push({ label: "Factotum (metà competenza)", value: Math.floor(x.pb / 2) });
    for (const { effect: e, label } of x.active) {
      if (e.op === "checkBonus" && (!e.skills || e.skills.includes(s))) parts.push({ label, value: evalValue(e.value, x) });
    }
    if (cs.d20Penalty) parts.push({ label: "Esaurimento", value: cs.d20Penalty });
    const adv: string[] = [...cs.rolls.checks.adv], dis: string[] = [...cs.rolls.checks.dis];
    if (untrained && (ab === "str" || ab === "dex")) dis.push(armorDis);
    if (s === "stealth" && x.bodyArmor?.stealthDisadvantage) dis.push(x.bodyArmor.name.it);
    skills[s] = { bonus: sum(parts), ability: ab, proficiency: prof, ...combineMode(adv, dis) };
  }
  return { saves, skills };
}
