import { describeEffect, type HbData, type HbKind } from "../engine/homebrew";
import type { Effect } from "../engine/types";
import type { Ruleset } from "../engine/ruleset";
import { formatCost } from "../engine/equipment";
import { strings as it } from "../i18n";
import { tr } from "../i18n/tr";
import { distance, weight as fmtWeight } from "../ui/units";

const O = it.homebrew.opts;
const AB = it.wizard.abilities as Record<string, string>;
const SIZE: Record<string, string> = { tiny: tr("Minuscola", "Tiny"), small: tr("Piccola", "Small"), medium: tr("Media", "Medium"), large: tr("Grande", "Large") };
const names = (list: unknown[]) => list.map((x) => AB[String(x)] ?? String(x)).join(", ");
const levelsOf = (list: { name: { it: string }; level?: number }[]) => list.map((f) => `${f.name.it} (${f.level ?? 1}°)`).join(", ");
const name = (m: Map<string, { name: { it: string } }>, id: unknown) => m.get(String(id))?.name.it ?? String(id);

// Righe di riepilogo di una voce (elenco e anteprima del modulo)
export function summarize(kind: HbKind, x: HbData, rs: Ruleset): string[] {
  const d = x as Record<string, any>;
  const cost = d.cost > 0 ? [formatCost(d.cost)] : [];
  const fx = ((d.effects ?? []) as Effect[]).map((e) => describeEffect(e, rs)); // effetti magici: bonus mentre l'oggetto è usato
  const ch = d.charges as { max: number; recharge: string; regain?: string } | undefined;
  if (ch) fx.unshift(tr(`${ch.max} cariche${ch.recharge === "none" ? "" : `, si ricarica: ${(it.homebrew.cx.rechargeOpts as Record<string, string>)[ch.recharge]?.toLowerCase()}${ch.regain ? ` (recupera ${ch.regain})` : " (tutte)"}`}`, `${ch.max} charges${ch.recharge === "none" ? "" : `, recharges: ${(it.homebrew.cx.rechargeOpts as Record<string, string>)[ch.recharge]?.toLowerCase()}${ch.regain ? ` (regains ${ch.regain})` : " (all)"}`}`));
  switch (kind) {
    case "weapons": return [
      `${(O.weaponCategory as Record<string, string>)[d.category]} · ${(O.weaponKind as Record<string, string>)[d.kind]}`,
      `${d.damage} ${name(rs.damageTypes, d.damageType)}${d.versatileDamage ? ` (${d.versatileDamage} ${tr("a due mani", "two-handed")})` : ""}`,
      [...(d.properties as string[]).map((p) => name(rs.weaponProperties, p)), `${tr("Maestria", "Mastery")}: ${name(rs.masteries, d.mastery)}`].join(", "),
      [...(d.attunement ? [tr("sintonia", "attunement")] : []), ...cost, d.weight ? fmtWeight(d.weight) : ""].filter(Boolean).join(" · "),
      ...fx,
    ].filter(Boolean);
    case "armors": return [
      `${(O.armorCategory as Record<string, string>)[d.category]} · ${tr("CA", "AC")} ${d.category === "shield" ? "+" : ""}${d.baseAc}${d.dexCap === null ? "" : d.dexCap === 0 ? "" : ` + ${tr("Des", "Dex")} (max ${d.dexCap})`}`,
      [d.strRequired ? `${AB.str} ${d.strRequired}` : "", d.stealthDisadvantage ? tr("Svantaggio a Furtività", "Disadvantage on Stealth") : ""].filter(Boolean).join(" · "),
      [...(d.attunement ? [tr("sintonia", "attunement")] : []), ...cost, d.weight ? fmtWeight(d.weight) : ""].filter(Boolean).join(" · "),
      ...fx,
    ].filter(Boolean);
    case "items": return [[d.category, d.attunement ? "sintonia" : "", ...cost, d.weight ? fmtWeight(d.weight) : ""].filter(Boolean).join(" · "), ...fx];
    case "feats": return [
      (O.featCategory as Record<string, string>)[d.category] ?? d.category,
      ...((d.prerequisites as string[]).length ? [`${tr("Richiede", "Requires")}: ${(d.prerequisites as string[]).join(", ")}`] : []),
      ...((d.effects as Effect[]).map((e) => describeEffect(e, rs))),
    ];
    case "species": return [
      `${(d.sizes as string[]).map((z) => SIZE[z] ?? z).join(" / ")} · ${tr("Velocità", "Speed")} ${distance(d.speed)}`,
      ...((d.traits as { name: { it: string }; level?: number }[]).length ? [`${tr("Tratti", "Traits")}: ${levelsOf(d.traits)}`] : []),
    ];
    case "backgrounds": return [
      `${tr("Caratteristiche", "Abilities")}: ${names(d.abilityOptions)} · ${tr("Abilità", "Skills")}: ${(d.skills as string[]).map((k) => name(rs.skills, k)).join(", ")}`,
      `${tr("Talento", "Feat")}: ${name(rs.feats, d.feat)} · ${tr("Strumento", "Tool")}: ${rs.tools.get(d.tool)?.name.it ?? d.tool}`,
    ];
    case "classes": return [
      `d${d.hitDie} · ${tr("TS", "Saves")} ${names(d.saves)} · ${tr("Caratteristica primaria", "Primary ability")}: ${names(d.primaryAbility)}${d.caster !== "none" ? ` · ${tr("Incantatore", "Spellcaster")} (${names([d.spellAbility])})` : ""}`,
      `${tr("Privilegi", "Features")}: ${levelsOf(d.features) || tr("nessuno", "none")}`,
      ...(Object.keys(d.table ?? {}).length ? [`${tr("Tabella", "Table")}: ${Object.keys(d.table).join(", ")}`] : []),
    ];
    case "subclasses": return [tr(`Sottoclasse di ${name(rs.classes, d.classId)}`, `Subclass of ${name(rs.classes, d.classId)}`), `${tr("Privilegi", "Features")}: ${levelsOf(d.features) || tr("nessuno", "none")}`];
    case "languages": return [tr(`Lingua ${d.extra?.rarity === "rare" ? "rara" : "standard"}`, `${d.extra?.rarity === "rare" ? "Rare" : "Standard"} language`)];
    case "damageTypes": return [d.description || tr("Tipo di danno", "Damage type")];
    case "conditions": return [d.description || tr("Condizione", "Condition"), ...(d.requiresSource ? [tr("Serve sapere chi la causa", "You must know who causes it")] : [])].filter(Boolean);
    case "spells": return [
      `${d.level === 0 ? tr("Trucchetto", "Cantrip") : `${d.level}°`} · ${(O.school as Record<string, string>)[d.school]} · ${(d.classes as string[]).map((c) => (O.classes as Record<string, string>)[c] ?? name(rs.classes, c)).join(", ") || tr("nessuna classe", "no class")}`,
      `${(O.castUnit as Record<string, string>)[d.castingTime.unit]} · ${d.range} · ${d.duration}${d.concentration ? ` (${tr("Concentrazione", "Concentration")})` : ""}${d.ritual ? ` · ${tr("Rituale", "Ritual")}` : ""}`,
      d.summary,
    ].filter(Boolean);
  }
}
