import type { Ctx } from "./context";
import { evalValue } from "./formula-eval";
import { fixedHp } from "./constants";
import { sum, type Part } from "./sourced";
import type { Derived } from "./types";
import { tr } from "../../i18n/tr";

// PF max = dado massimo 1° livello + Σ(tiro o media, min 1 con Cos) + mod Cos × livello + bonus.
// hpRolls[i] = livello i+1 della classe; per la prima classe l'indice 0 è ignorato (massimo).
export function computeHp(x: Ctx): Derived["hp"] {
  const con = x.mods.con;
  const parts: Part[] = [];
  const dice = new Map<number, number>();
  x.ch.classes.forEach((cl, ci) => {
    const def = x.rs.classes.get(cl.classId);
    if (!def) return;
    dice.set(def.hitDie, (dice.get(def.hitDie) ?? 0) + cl.level);
    let gain = 0;
    for (let i = 0; i < cl.level; i++) {
      if (ci === 0 && i === 0) { gain += def.hitDie; continue; }
      const roll = cl.hpRolls[i] ?? "avg";
      // Tiro/media + Cos, minimo 1 per livello (Cos negativa); il mod Cos è sommato a parte
      const die = roll === "avg" ? fixedHp(def.hitDie) : roll;
      gain += Math.max(die + con, 1) - con;
    }
    parts.push({ label: tr(`Dadi Vita ${def.name.it} (d${def.hitDie})`, `${def.name.it} Hit Dice (d${def.hitDie})`), value: gain });
  });
  parts.push({ label: tr(`Costituzione (${con >= 0 ? "+" : ""}${con} × ${x.level})`, `Constitution (${con >= 0 ? "+" : ""}${con} × ${x.level})`), value: con * x.level });
  for (const { effect: e, label } of x.active) {
    if (e.op === "hpMaxPerLevel") {
      const lv = e.classId ? x.classLevels[e.classId] ?? 0 : x.level;
      parts.push({ label, value: evalValue(e.value, x) * lv });
    }
    if (e.op === "hpMaxBonus") parts.push({ label, value: evalValue(e.value, x) });
  }
  const hitDice = [...dice].map(([die, total]) => ({ die, total })).sort((a, b) => a.die - b.die);
  const total = hitDice.reduce((n, d) => n + d.total, 0);
  return { max: sum(parts), hitDice, hitDiceRemaining: Math.max(0, total - x.ch.state.hitDiceUsed) };
}
