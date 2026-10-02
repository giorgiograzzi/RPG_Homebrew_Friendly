import type { Ability } from "../schema";
import type { Weapon } from "../types";
import { analyzeLoadout, type WieldedWeapon } from "../equipment/loadout";
import { buildCtx, type Ctx } from "./context";
import { combineMode } from "./rolls";
import { evalValue } from "./formula-eval";
import type { Profs } from "./proficiencies";
import { sum, type Part } from "./sourced";
import type { AttackOption, ConditionState } from "./types";
import { tr } from "../../i18n/tr";

const AB_IT: Record<Ability, string> = tr("x", "y") === "x" ? { str: "For", dex: "Des", con: "Cos", int: "Int", wis: "Sag", cha: "Car" } : { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
const sign = (n: number) => (n >= 0 ? `+ ${n}` : `- ${-n}`);

// Competenza nell'arma: id, categoria, oppure categoria con filtro ("martial[light]", "martial[finesse|light]")
export function isProficient(w: Weapon, prof: Set<string>): boolean {
  if (prof.has(w.id) || prof.has(w.category)) return true;
  for (const p of prof) {
    const m = /^(\w+)\[(.+)\]$/.exec(p);
    if (m && m[1] === w.category && m[2]!.split("|").some((f) => w.properties.includes(f))) return true;
  }
  return false;
}
// Armi da Monaco: armi semplici da mischia + armi marziali da mischia con la proprietà Leggera
const isMonkWeapon = (w: Weapon) => w.kind === "melee" && (w.category === "simple" || w.properties.includes("light"));
const avg = (dice: string) => { const m = /^(\d*)d(\d+)$/.exec(dice); return m ? (Number(m[1] || 1) * (Number(m[2]) + 1)) / 2 : Number(dice); };
const normDie = (d: string | number) => (typeof d === "number" ? String(d) : /^d/.test(d) ? `1${d}` : d);

// Attacchi: uno per ogni arma impugnata (più la versione lanciata delle armi Da lancio e la mano secondaria con due armi
// Leggere) e il colpo senz'armi. Le condizioni degli effetti (Duellare, Tiro con l'arco...) si valutano sul contesto di ogni attacco.
export function computeAttacks(x: Ctx, profs: Profs, cs: ConditionState, untrained: boolean): AttackOption[] {
  const { ch, rs } = x;
  const load = analyzeLoadout(ch, rs);
  const out: AttackOption[] = [];
  const feats = x.collected.feats, feat = x.collected.features;
  const noArmorNoShield = !x.bodyArmor && !x.shield;
  const lights = load.wielded.filter((w) => w.weapon.properties.includes("light"));

  const build = (wf: WieldedWeapon | undefined, opts: { thrown?: boolean; offhand?: boolean }): AttackOption => {
    const w = wf?.weapon;
    const thrown = !!opts.thrown, offhand = !!opts.offhand;
    const kind: "melee" | "ranged" = !w ? "melee" : thrown ? "ranged" : w.kind;
    const hands = wf?.hands ?? 0;
    const asWeapon = w ? ({ ...w, kind } as Weapon) : undefined; // lanciata = attacco a distanza per le condizioni
    const others = load.wielded.filter((o) => o !== wf).length > 0;

    // caratteristica: mischia For (Accurata: For o Des); distanza Des; Monaco con arma da Monaco Des; arma del patto Car
    const cand: [Ability, string][] = [];
    if (!w) { cand.push(["str", "For"]); if (feat.has("martial_arts") && noArmorNoShield) cand.push(["dex", "Arti marziali"]); }
    else if (w.kind === "ranged" && !thrown) cand.push(["dex", "arma a distanza"]);
    else {
      cand.push(["str", "For"]);
      if (w.properties.includes("finesse")) cand.push(["dex", "Accurata"]);
      if (feat.has("martial_arts") && noArmorNoShield && isMonkWeapon(w)) cand.push(["dex", "Arti marziali"]);
    }
    if (w && ch.pactWeapon === wf!.entry.itemId && feat.has("pact_of_the_blade")) cand.push(["cha", tr("arma del patto", "pact weapon")]);
    const [ability, why] = cand.reduce((b, c) => (x.mods[c[0]] > x.mods[b[0]] ? c : b));
    const c2 = buildCtx(ch, rs, asWeapon, { twoHanded: hands === 2, otherWeapon: others, ability });

    const proficient = !w || isProficient(w, profs.weapons);
    const parts: Part[] = [{ label: tr(`Mod ${AB_IT[ability]}`, `${AB_IT[ability]} mod`), value: x.mods[ability] }];
    if (proficient) parts.push({ label: tr("Competenza", "Proficiency"), value: x.pb });
    else parts.push({ label: tr("Senza competenza", "Not proficient"), value: 0 });
    if (cs.d20Penalty) parts.push({ label: tr("Indebolimento", "Exhaustion"), value: cs.d20Penalty });
    const dmgParts: Part[] = [];
    if (!offhand || x.mods[ability] < 0 || feats.has("two_weapon_fighting")) dmgParts.push({ label: tr(`Mod ${AB_IT[ability]}`, `${AB_IT[ability]} mod`), value: x.mods[ability] });
    let crit = 20;
    for (const { effect: e, label } of c2.active) {
      if (e.op === "attackBonus" && (e.attackType === "any" || e.attackType === kind)) parts.push({ label, value: evalValue(e.value, c2) });
      if (e.op === "damageBonus" && (e.attackType === "any" || e.attackType === kind)) dmgParts.push({ label, value: evalValue(e.value, c2) });
      if (e.op === "critRange") crit = Math.min(crit, e.min);
    }

    const adv = [...cs.rolls.attack.adv], dis = [...cs.rolls.attack.dis];
    if (untrained && (ability === "str" || ability === "dex")) dis.push("Armatura senza addestramento");
    if (w?.properties.includes("heavy") && ((kind === "melee" && x.scores.str < 13) || (kind === "ranged" && x.scores.dex < 13))) dis.push(tr(`Arma Pesante con ${kind === "melee" ? "For" : "Des"} sotto 13`, `Heavy weapon with ${kind === "melee" ? "Str" : "Dex"} below 13`));
    const mode = combineMode(adv, dis);

    // dado di danno
    let dice: string, type = w?.damageType ?? "bludgeoning";
    if (w) dice = hands === 2 && w.properties.includes("versatile") && w.versatileDamage ? w.versatileDamage : w.damage;
    else {
      const opts2 = ["1"];
      for (const { effect: e } of c2.active) if (e.op === "unarmedDie") opts2.push(normDie(e.die));
      if (feats.has("unarmed_fighting")) opts2.push(load.wielded.length === 0 && !x.shield ? "1d8" : "1d6");
      dice = opts2.reduce((b, d) => (avg(d) > avg(b) ? d : b));
    }
    const bonus = sum(dmgParts.length ? dmgParts : [{ label: tr("Nessun bonus", "No bonus"), value: 0 }]);
    const dmgType = rs.damageTypes.get(type)?.name.it ?? type;

    const notes: string[] = [];
    if (w?.properties.includes("loading")) notes.push(tr("Ricarica: una sola munizione per azione, azione bonus o reazione", "Loading: only one piece of ammunition per action, bonus action or reaction"));
    if (kind === "ranged" && !feats.has("sharpshooter")) notes.push(tr("Svantaggio oltre la gittata normale e con un nemico entro 1,5 m", "Disadvantage beyond normal range and with an enemy within 5 ft"));
    if (w?.properties.includes("thrown") && !thrown && w.kind === "melee") notes.push(tr("Da lancio: può essere scagliata (attacco a distanza)", "Thrown: can be hurled (ranged attack)"));
    if (feats.has("great_weapon_fighting") && kind === "melee" && hands === 2 && (w!.properties.includes("two_handed") || w!.properties.includes("versatile"))) notes.push(tr("Combattere con armi possenti: 1 e 2 sui dadi di danno contano 3", "Great Weapon Fighting: 1s and 2s on damage dice count as 3"));
    if (offhand) notes.push(tr("Attacco extra della proprietà Leggera (Azione Bonus; con Intaccare fa parte dell'azione di Attacco)", "Extra attack from the Light property (Bonus Action; with Nick it is part of the Attack action)"));
    if (w?.twoHandedUnlessMounted) notes.push(ch.state.mounted ? tr("In sella: si impugna a una mano", "Mounted: wielded with one hand") : tr("A due mani se non in sella", "Two-handed unless mounted"));
    if (x.mods[ability] < 0 && offhand) notes.push(tr("Mano secondaria: il modificatore negativo si applica al danno", "Off-hand: a negative modifier applies to damage"));
    if (!proficient) notes.push(tr("Non sei competente: niente bonus di competenza al tiro per colpire", "Not proficient: no proficiency bonus on the attack roll"));
    const riders: string[] = [];
    const rogue = x.classLevels.rogue;
    if (rogue && feat.has("sneak_attack") && w && (w.properties.includes("finesse") || kind === "ranged")) {
      riders.push(tr(`Attacco furtivo ${rs.classes.get("rogue")?.table.sneak_attack?.[rogue - 1] ?? "?"} (1 volta per turno; con Vantaggio o con un alleato adiacente al bersaglio)`, `Sneak Attack ${rs.classes.get("rogue")?.table.sneak_attack?.[rogue - 1] ?? "?"} (once per turn; with Advantage or with an ally adjacent to the target)`));
    }

    const mast = w && rs.masteries.get(w.mastery);
    const mastery = w && mast ? {
      id: w.mastery, name: mast.name.it, active: x.collected.masteries.has(w.id),
      ...(w.mastery === "topple" ? { dc: 8 + x.mods[ability] + x.pb } : {}),
    } : undefined;
    const ammoId = w?.ammunition;
    const ammo = ammoId ? {
      itemId: ammoId,
      available: ch.inventory.filter((e) => e.itemId === ammoId).reduce((n, e) => n + e.qty * Number(/\((\d+)\)/.exec(rs.items.get(ammoId)?.name.it ?? "")?.[1] ?? 1), 0),
    } : undefined;
    const range = w?.range && (thrown || w.kind === "ranged") ? w.range : undefined;
    const label = !w ? tr("Colpo senz'armi", "Unarmed Strike") : `${w.name.it}${thrown ? tr(" (lanciata)", " (thrown)") : ""}${offhand ? tr(" (mano secondaria)", " (off-hand)") : hands === 2 && w.properties.includes("versatile") ? tr(" (due mani)", " (two-handed)") : ""}`;
    return {
      id: wf?.entry.itemId ?? "unarmed", ...(w ? { weaponId: w.id } : {}), label, kind, thrown, offhand, hands: hands as 0 | 1 | 2,
      ability, abilityWhy: why, proficient, toHit: sum(parts), ...mode,
      damage: { dice, bonus, type, text: `${dice} ${sign(bonus.value)} ${dmgType}` },
      critRange: crit, reach: w?.properties.includes("reach") ? 10 : 5, ...(range ? { range } : {}),
      ...(mastery ? { mastery } : {}), ...(ammo ? { ammo } : {}), riders, notes,
    };
  };

  for (const wf of load.wielded) {
    out.push(build(wf, {}));
    if (wf.weapon.properties.includes("thrown")) out.push(build(wf, { thrown: true }));
  }
  // due armi Leggere impugnate: la seconda dà l'attacco extra (mano secondaria)
  if (lights.length === 2 && load.wielded.length === 2) out.push(build(lights[1]!, { offhand: true }));
  out.push(build(undefined, {}));
  return out;
}

// Attacchi per azione di Attacco: Attacco extra (2), Due attacchi extra (3), Tre attacchi extra (4), colonna "Attacchi" del Guerriero
export function attacksPerAction(x: Ctx): number {
  const f = x.collected.features;
  let n = f.has("three_extra_attacks") ? 4 : f.has("two_extra_attacks") ? 3 : f.has("extra_attack") ? 2 : 1;
  const col = x.rs.classes.get("fighter")?.table.attacchi;
  const lv = x.classLevels.fighter;
  if (col && lv) n = Math.max(n, Number(col[lv - 1]));
  return n;
}
