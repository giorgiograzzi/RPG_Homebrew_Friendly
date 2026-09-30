import { evalValue } from "./formula-eval";
import type { Ctx } from "./context";
import type { Profs } from "./proficiencies";
import { sum, type Part } from "./sourced";
import type { Derived } from "./types";

// CA: si usa UNA sola formula, la migliore; poi scudo (se addestrato) e bonus (file 03 §4a).
export function computeAc(x: Ctx, profs: Profs, warnings: string[]): Derived["ac"] {
  const dex = x.mods.dex;
  const candidates: { name: string; parts: Part[]; shieldOk: boolean }[] = [];
  const arm = x.bodyArmor;
  if (arm) {
    const master = x.collected.feats.has("medium_armor_master") && x.scores.dex >= 16;
    // dexCap: null = nessun limite (leggera); 0 = nessun bonus Des (pesante, anche se negativo)
    const cap = arm.category === "medium" && master ? Math.max(arm.dexCap ?? 3, 3) : arm.dexCap;
    const dexPart = cap === null ? dex : cap === 0 ? 0 : Math.min(dex, cap);
    const parts: Part[] = [{ label: arm.name.it, value: arm.baseAc }];
    if (dexPart !== 0) parts.push({ label: cap !== null && dex > cap ? `Des (max ${cap})` : "Des", value: dexPart });
    candidates.push({ name: arm.name.it, parts, shieldOk: true });
    if (!profs.armor.has(arm.category)) warnings.push(`Armatura "${arm.name.it}" senza addestramento: svantaggio a For/Des e niente incantesimi`);
  } else {
    candidates.push({ name: "Senza armatura", parts: [{ label: "Base", value: 10 }, { label: "Des", value: dex }], shieldOk: true });
    for (const { effect: e, label } of x.active) {
      if (e.op !== "acFormula") continue;
      candidates.push({ name: label, parts: [{ label, value: evalValue(e.formula, x) }], shieldOk: e.shieldAllowed });
    }
  }
  const usable = candidates.filter((c) => c.shieldOk || !x.shield);
  const best = usable.reduce((b, c) => (sum(c.parts).value > sum(b.parts).value ? c : b));
  const parts = [...best.parts];
  if (x.shield) {
    if (best.shieldOk && profs.armor.has("shield")) parts.push({ label: x.shield.name.it, value: x.shield.baseAc });
    else if (best.shieldOk) warnings.push("Scudo senza addestramento: nessun bonus alla CA");
  }
  for (const { effect: e, label } of x.active) if (e.op === "acBonus") parts.push({ label, value: evalValue(e.value, x) });
  const total = sum(parts);
  const others = candidates.filter((c) => c !== best).map((c) => `${c.name} ${sum(c.parts).value}`);
  if (others.length) total.sources.push({ label: `Formula scelta: ${best.name} (scartate: ${others.join(", ")})`, value: 0 });
  return { ...total, formula: best.name };
}
