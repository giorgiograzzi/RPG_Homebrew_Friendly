import { describeEffect, type HbData, type HbKind } from "../engine/homebrew";
import type { Effect } from "../engine/types";
import type { Ruleset } from "../engine/ruleset";
import { formatCost } from "../engine/equipment";
import it from "../i18n/it.json";

const O = it.homebrew.opts;
const AB = it.wizard.abilities as Record<string, string>;
const SIZE: Record<string, string> = { tiny: "Minuscola", small: "Piccola", medium: "Media", large: "Grande" };
const names = (list: unknown[]) => list.map((x) => AB[String(x)] ?? String(x)).join(", ");
const levelsOf = (list: { name: { it: string }; level?: number }[]) => list.map((f) => `${f.name.it} (${f.level ?? 1}°)`).join(", ");
const name = (m: Map<string, { name: { it: string } }>, id: unknown) => m.get(String(id))?.name.it ?? String(id);

// Righe di riepilogo di una voce (elenco e anteprima del modulo)
export function summarize(kind: HbKind, x: HbData, rs: Ruleset): string[] {
  const d = x as Record<string, any>;
  const cost = d.cost > 0 ? [formatCost(d.cost)] : [];
  const fx = ((d.effects ?? []) as Effect[]).map((e) => describeEffect(e, rs)); // effetti magici: bonus mentre l'oggetto è usato
  const ch = d.charges as { max: number; recharge: string; regain?: string } | undefined;
  if (ch) fx.unshift(`${ch.max} cariche${ch.recharge === "none" ? "" : `, si ricarica: ${(it.homebrew.cx.rechargeOpts as Record<string, string>)[ch.recharge]?.toLowerCase()}${ch.regain ? ` (recupera ${ch.regain})` : " (tutte)"}`}`);
  switch (kind) {
    case "weapons": return [
      `${(O.weaponCategory as Record<string, string>)[d.category]} · ${(O.weaponKind as Record<string, string>)[d.kind]}`,
      `${d.damage} ${name(rs.damageTypes, d.damageType)}${d.versatileDamage ? ` (${d.versatileDamage} a due mani)` : ""}`,
      [...(d.properties as string[]).map((p) => name(rs.weaponProperties, p)), `Maestria: ${name(rs.masteries, d.mastery)}`].join(", "),
      [...(d.attunement ? ["sintonia"] : []), ...cost, d.weight ? `${d.weight} lb` : ""].filter(Boolean).join(" · "),
      ...fx,
    ].filter(Boolean);
    case "armors": return [
      `${(O.armorCategory as Record<string, string>)[d.category]} · CA ${d.category === "shield" ? "+" : ""}${d.baseAc}${d.dexCap === null ? "" : d.dexCap === 0 ? "" : ` + Des (max ${d.dexCap})`}`,
      [d.strRequired ? `Forza ${d.strRequired}` : "", d.stealthDisadvantage ? "Svantaggio a Furtività" : ""].filter(Boolean).join(" · "),
      [...(d.attunement ? ["sintonia"] : []), ...cost, d.weight ? `${d.weight} lb` : ""].filter(Boolean).join(" · "),
      ...fx,
    ].filter(Boolean);
    case "items": return [[d.category, d.attunement ? "sintonia" : "", ...cost, d.weight ? `${d.weight} lb` : ""].filter(Boolean).join(" · "), ...fx];
    case "feats": return [
      (O.featCategory as Record<string, string>)[d.category] ?? d.category,
      ...((d.prerequisites as string[]).length ? [`Richiede: ${(d.prerequisites as string[]).join(", ")}`] : []),
      ...((d.effects as Effect[]).map((e) => describeEffect(e, rs))),
    ];
    case "species": return [
      `${(d.sizes as string[]).map((z) => SIZE[z] ?? z).join(" / ")} · Velocità ${d.speed} ft`,
      ...((d.traits as { name: { it: string }; level?: number }[]).length ? [`Tratti: ${levelsOf(d.traits)}`] : []),
    ];
    case "backgrounds": return [
      `Caratteristiche: ${names(d.abilityOptions)} · Abilità: ${(d.skills as string[]).map((k) => name(rs.skills, k)).join(", ")}`,
      `Talento: ${name(rs.feats, d.feat)} · Strumento: ${rs.tools.get(d.tool)?.name.it ?? d.tool}`,
    ];
    case "classes": return [
      `d${d.hitDie} · TS ${names(d.saves)} · Caratteristica primaria: ${names(d.primaryAbility)}${d.caster !== "none" ? ` · Incantatore (${names([d.spellAbility])})` : ""}`,
      `Privilegi: ${levelsOf(d.features) || "nessuno"}`,
      ...(Object.keys(d.table ?? {}).length ? [`Tabella: ${Object.keys(d.table).join(", ")}`] : []),
    ];
    case "subclasses": return [`Sottoclasse di ${name(rs.classes, d.classId)}`, `Privilegi: ${levelsOf(d.features) || "nessuno"}`];
    case "languages": return [`Linguaggio ${d.extra?.rarity === "rare" ? "raro" : "standard"}`];
    case "damageTypes": return [d.description || "Tipo di danno"];
    case "conditions": return [d.description || "Condizione", ...(d.requiresSource ? ["Serve sapere chi la causa"] : [])].filter(Boolean);
    case "spells": return [
      `${d.level === 0 ? "Trucchetto" : `${d.level}°`} · ${(O.school as Record<string, string>)[d.school]} · ${(d.classes as string[]).map((c) => (O.classes as Record<string, string>)[c] ?? name(rs.classes, c)).join(", ") || "nessuna classe"}`,
      `${(O.castUnit as Record<string, string>)[d.castingTime.unit]} · ${d.range} · ${d.duration}${d.concentration ? " (Concentrazione)" : ""}${d.ritual ? " · Rituale" : ""}`,
      d.summary,
    ].filter(Boolean);
  }
}
