import { describe, expect, it } from "vitest";
import { resolveConditions } from "../engine/compute/conditions";
import { testCharacter } from "../engine/compute/testkit";
import { brokenReferences, grantedSpells, idsByKind, loadSrd, SRD_LANGS } from "./srdIntegrity";

// Conteggi presi dalle tabelle dell'SRD 5.2.1 (armi: 10 semplici da mischia + 4 semplici a distanza + 18 da guerra da mischia + 6 da guerra a distanza)
const COUNTS: Record<string, number> = {
  skills: 18, languages: 19, sizes: 6, damageTypes: 13, weaponProperties: 10, masteries: 8, coins: 5,
  weapons: 38, armors: 13, tools: 37, items: 352, backgrounds: 4, feats: 17, species: 9, classes: 12, subclasses: 12, spells: 339, conditions: 15, slotTables: 2, creation: 1,
};

describe.each(SRD_LANGS)("dati SRD (%s)", (lang) => {
  const rs = loadSrd(lang);
  it("nessuna voce scartata", () => { expect(rs.errors).toEqual([]); });
  it("conteggi attesi", () => {
    for (const [k, n] of Object.entries(COUNTS)) expect([k, (rs as unknown as Record<string, Map<string, unknown>>)[k]!.size]).toEqual([k, n]);
  });
  it("riferimenti incrociati", () => { expect(brokenReferences(rs)).toEqual([]); });
  it("tutte le voci sono marcate SRD", () => {
    for (const k of Object.keys(COUNTS).filter((x) => x !== "creation")) for (const e of (rs as unknown as Record<string, Map<string, { origin: string }>>)[k]!.values()) expect(e.origin).toBe("srd");
  });
});

describe("parità IT/EN", () => {
  it("stessi id nello stesso ordine", () => { expect(idsByKind("it")).toEqual(idsByKind("en")); });
  it("stessi numeri, nomi diversi", () => {
    const [it, en] = [loadSrd("it"), loadSrd("en")];
    for (const [id, w] of en.weapons) {
      const { name: _n1, ...a } = w; const { name: _n2, ...b } = it.weapons.get(id)!;
      expect(b).toEqual(a);
    }
    expect(it.weapons.get("dagger")!.name.it).toBe("Pugnale");
    expect(en.weapons.get("dagger")!.name.it).toBe("Dagger");
  });
});

describe("valori controllati sul PDF", () => {
  const rs = loadSrd("en");
  it("armi", () => {
    expect(rs.weapons.get("dagger")).toMatchObject({ damage: "1d4", damageType: "piercing", cost: 200, weight: 1, mastery: "nick", properties: ["finesse", "light", "thrown"], range: { normal: 20, long: 60 } });
    expect(rs.weapons.get("greatsword")).toMatchObject({ damage: "2d6", damageType: "slashing", cost: 5000, weight: 6, mastery: "graze" });
    expect(rs.weapons.get("quarterstaff")).toMatchObject({ versatileDamage: "1d8", mastery: "topple", cost: 20 });
    expect(rs.weapons.get("lance")).toMatchObject({ twoHandedUnlessMounted: true, damage: "1d10" });
    expect(rs.weapons.get("blowgun")).toMatchObject({ damage: "1", ammunition: "needles", range: { normal: 25, long: 100 } });
    expect(rs.weapons.get("heavy_crossbow")).toMatchObject({ properties: ["ammunition", "heavy", "loading", "two_handed"], mastery: "push", weight: 18, cost: 5000 });
    expect(rs.weapons.get("musket")).toMatchObject({ damage: "1d12", cost: 50000, ammunition: "bullets_firearm" });
    expect(rs.weapons.get("sling")).toMatchObject({ ammunition: "bullets_sling", weight: 0 });
    expect(rs.weapons.get("dart")).toMatchObject({ weight: 0.25, cost: 5 });
  });
  it("armature", () => {
    expect(rs.armors.get("leather_armor")).toMatchObject({ baseAc: 11, dexCap: null, cost: 1000, weight: 10, stealthDisadvantage: false });
    expect(rs.armors.get("half_plate_armor")).toMatchObject({ baseAc: 15, dexCap: 2, stealthDisadvantage: true, cost: 75000 });
    expect(rs.armors.get("chain_mail")).toMatchObject({ baseAc: 16, dexCap: 0, strRequired: 13, donMinutes: 10, doffMinutes: 5 });
    expect(rs.armors.get("plate_armor")).toMatchObject({ baseAc: 18, strRequired: 15, cost: 150000, weight: 65 });
    expect(rs.armors.get("shield")).toMatchObject({ category: "shield", baseAc: 2, cost: 1000 });
  });
  it("strumenti e oggetti", () => {
    expect(rs.tools.get("smiths_tools")).toMatchObject({ group: "artisan", ability: "str", cost: 2000, weight: 8 });
    expect(rs.tools.get("thieves_tools")).toMatchObject({ group: "other", ability: "dex", cost: 2500, weight: 1 });
    expect(rs.tools.get("lute")).toMatchObject({ group: "musical", ability: "cha", cost: 3500, weight: 2 });
    expect(rs.tools.get("dice")).toMatchObject({ group: "gaming", cost: 10 });
    expect(rs.items.get("spyglass")).toMatchObject({ cost: 100000, weight: 1 });
    expect(rs.items.get("dungeoneers_pack")).toMatchObject({ cost: 1200, weight: 55 });
    expect(rs.items.get("dungeoneers_pack")!.contents).toHaveLength(9);
    expect(rs.items.get("burglars_pack")!.contents).toContainEqual({ item: "candle", qty: 10 });
    expect(rs.items.get("arrows")).toMatchObject({ amount: 20, cost: 100, weight: 1 });
  });
  it("glossario", () => {
    expect(rs.skills.get("sleight_of_hand")!.extra).toEqual({ ability: "dex" });
    expect(rs.coins.get("ep")!.extra).toMatchObject({ copper: 50 });
    expect(rs.sizes.get("gargantuan")!.extra).toEqual({ spaceFeet: 20 });
  });
});

describe("oggetti magici (SRD 5.2.1, Magic Items A–Z)", () => {
  const [en, ita] = [loadSrd("en"), loadSrd("it")]; // `it` è il test
  const magic = (rs: typeof en) => [...rs.items.values()].filter((i) => i.magic);
  it("258 voci in entrambe le lingue", () => { expect(magic(en)).toHaveLength(258); expect(magic(ita)).toHaveLength(258); });
  it("tipo, rarità e sintonia", () => {
    expect(en.items.get("amulet_of_health")).toMatchObject({ attunement: true, magic: { type: "wondrous", rarity: [{ rarity: "rare" }] } });
    expect(en.items.get("potion_of_climbing")).toMatchObject({ attunement: false, magic: { type: "potion", rarity: [{ rarity: "common" }] } });
    expect(en.items.get("weapon_plus")!.magic!.rarity.map((r) => [r.rarity, r.note])).toEqual([["uncommon", "+1"], ["rare", "+2"], ["very_rare", "+3"]]);
    expect(en.items.get("holy_avenger")!.magic).toMatchObject({ type: "weapon", attunementBy: "a Paladin" });
    expect(ita.items.get("holy_avenger")!.magic).toMatchObject({ attunementBy: "un paladino" });
    expect(en.items.get("potions_of_healing")!.magic).toMatchObject({ varies: true, rarity: [] });
    expect(ita.items.get("bag_of_holding")!.name.it).toBe("Borsa conservante");
  });
  it("testo presente e senza residui del PDF", () => {
    for (const rs of [en, ita]) for (const i of magic(rs)) {
      expect(i.description.length, i.id).toBeGreaterThan(40);
      expect(i.description, i.id).not.toMatch(/[\u0000-\u0008\u007f-\u009f]/);
    }
  });
  it("le tabelle sono righe con celle separate da |", () => {
    expect(en.items.get("horn_of_valhalla")!.description).toContain("41–75 | Brass | 3 | Proficiency with all Simple weapons");
  });
});

describe("background e talenti: valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  it("background", () => {
    expect(en.backgrounds.get("acolyte")).toMatchObject({ abilityOptions: ["int", "wis", "cha"], feat: "magic_initiate", featConfig: { list: "cleric" }, skills: ["insight", "religion"], tool: "calligraphers_supplies" });
    expect(en.backgrounds.get("criminal")).toMatchObject({ abilityOptions: ["dex", "con", "int"], feat: "alert", skills: ["sleight_of_hand", "stealth"], tool: "thieves_tools" });
    expect(en.backgrounds.get("sage")).toMatchObject({ abilityOptions: ["con", "int", "wis"], feat: "magic_initiate", featConfig: { list: "wizard" }, skills: ["arcana", "history"] });
    expect(en.backgrounds.get("soldier")).toMatchObject({ abilityOptions: ["str", "dex", "con"], feat: "savage_attacker", skills: ["athletics", "intimidation"], tool: "gaming" });
    for (const b of en.backgrounds.values()) expect(b.equipment.B).toEqual({ items: [], gp: 50 });
    expect(en.backgrounds.get("acolyte")!.equipment.A!.gp).toBe(8);
    expect(en.backgrounds.get("criminal")!.equipment.A).toEqual({ items: [{ item: "dagger", qty: 2 }, { item: "thieves_tools", qty: 1 }, { item: "crowbar", qty: 1 }, { item: "pouch", qty: 2 }, { item: "travelers_clothes", qty: 1 }], gp: 16 });
    expect(en.backgrounds.get("sage")!.equipment.A!.items).toContainEqual({ item: "parchment", qty: 8 });
    expect(en.backgrounds.get("soldier")!.equipment.A!.items).toContainEqual({ item: "arrows", qty: 1 }); // 20 frecce = 1 confezione da 20
  });
  it("lo stesso equipaggiamento in IT e EN (note a parte)", () => {
    for (const [id, b] of en.backgrounds) expect(rsIt.backgrounds.get(id)!.equipment.A!.items.map((x) => [x.item, x.qty])).toEqual(b.equipment.A!.items.map((x) => [x.item, x.qty]));
    expect(rsIt.backgrounds.get("acolyte")!.equipment.A!.items.find((x) => x.item === "book")!.note).toBe("preghiere");
    expect(en.backgrounds.get("acolyte")!.equipment.A!.items.find((x) => x.item === "book")!.note).toBe("prayers");
  });
  it("talenti: categorie e prerequisiti", () => {
    const cats: Record<string, number> = {};
    for (const f of en.feats.values()) cats[f.category] = (cats[f.category] ?? 0) + 1;
    expect(cats).toEqual({ origin: 4, general: 2, fighting_style: 4, epic_boon: 7 });
    expect(en.feats.get("grappler")).toMatchObject({ prerequisites: ["level>=4", "ability:str>=13 || ability:dex>=13"], abilityIncrease: ["str", "dex"] });
    expect(en.feats.get("ability_score_improvement")).toMatchObject({ repeatable: true, prerequisites: ["level>=4"] });
    expect(en.feats.get("boon_of_spell_recall")!.prerequisites).toEqual(["level>=19", "hasFeature:spellcasting"]);
    expect(en.feats.get("defense")!.prerequisites).toEqual(["hasFeature:fighting_style"]);
    expect(en.feats.get("magic_initiate")!.repeatable).toBe(true);
    expect(en.feats.get("skilled")!.repeatable).toBe(true);
    expect(rsIt.feats.get("grappler")!.name.it).toBe("Lottatore");
    expect(en.feats.get("archery")!.name.it).toBe("Archery");
  });
});

describe("specie: valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  const darkvision = (id: string) => en.species.get(id)!.effects.flatMap((e) => (e.op === "sense" && e.kind === "darkvision" ? [e.range] : []));
  it("le 9 specie, con taglia e velocità in piedi", () => {
    expect([...en.species.keys()]).toEqual(["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"]);
    expect(Object.fromEntries([...en.species.values()].map((s) => [s.id, [s.speed, s.sizes.join("/")]]))).toEqual({
      dragonborn: [30, "medium"], dwarf: [30, "medium"], elf: [30, "medium"], gnome: [30, "small"], goliath: [35, "medium"],
      halfling: [30, "small"], human: [30, "medium/small"], orc: [30, "medium"], tiefling: [30, "medium/small"],
    });
  });
  it("scurovisione", () => {
    expect(["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"].map((id) => [id, darkvision(id)[0] ?? 0])).toEqual([
      ["dragonborn", 60], ["dwarf", 120], ["elf", 60], ["gnome", 60], ["goliath", 0], ["halfling", 0], ["human", 0], ["orc", 120], ["tiefling", 60]]);
    const drow = en.species.get("elf")!.choices.find((c) => c.id === "elven_lineage")!.options!.find((o) => o.id === "drow")!;
    expect(drow.effects.some((e) => e.op === "sense" && e.kind === "darkvision" && e.range === 120)).toBe(true);
  });
  it("antenati draconici: tipo di danno", () => {
    const opts = en.species.get("dragonborn")!.choices[0]!.options!;
    expect(Object.fromEntries(opts.map((o) => [o.id, (o.effects[0] as { types: string[] }).types[0]]))).toEqual({
      black: "acid", blue: "lightning", brass: "fire", bronze: "lightning", copper: "acid", gold: "fire", green: "poison", red: "fire", silver: "cold", white: "cold" });
  });
  it("lignaggi elfici e retaggi immondi (incantesimi per livello)", () => {
    const spells = (sp: string, ch: string, opt: string) => en.species.get(sp)!.choices.find((c) => c.id === ch)!.options!.find((o) => o.id === opt)!.effects
      .flatMap((e) => (e.op === "grantSpell" ? [`${e.spell}@${e.when ?? "1"}`] : []));
    expect(spells("elf", "elven_lineage", "drow")).toEqual(["dancing_lights@1", "faerie_fire@level>=3", "darkness@level>=5"]);
    expect(spells("elf", "elven_lineage", "high_elf")).toEqual(["prestidigitation@1", "detect_magic@level>=3", "misty_step@level>=5"]);
    expect(spells("elf", "elven_lineage", "wood_elf")).toEqual(["druidcraft@1", "longstrider@level>=3", "pass_without_trace@level>=5"]);
    expect(spells("tiefling", "fiendish_legacy", "abyssal")).toEqual(["poison_spray@1", "ray_of_sickness@level>=3", "hold_person@level>=5"]);
    expect(spells("tiefling", "fiendish_legacy", "chthonic")).toEqual(["chill_touch@1", "false_life@level>=3", "ray_of_enfeeblement@level>=5"]);
    expect(spells("tiefling", "fiendish_legacy", "infernal")).toEqual(["fire_bolt@1", "hellish_rebuke@level>=3", "darkness@level>=5"]);
    const wood = en.species.get("elf")!.choices.find((c) => c.id === "elven_lineage")!.options!.find((o) => o.id === "wood_elf")!;
    expect(wood.effects).toContainEqual({ op: "setSpeed", mode: "walk", value: 35 });
  });
  it("usi dei tratti", () => {
    const usage = (sp: string, t: string) => en.species.get(sp)!.traits.find((x) => x.id === t)!.usage;
    expect(usage("dragonborn", "breath_weapon")).toEqual({ uses: "pb", recharge: "long_rest" });
    expect(usage("orc", "adrenaline_rush")).toEqual({ uses: "pb", recharge: "short_rest" });
    expect(usage("orc", "relentless_endurance")).toEqual({ uses: 1, recharge: "long_rest" });
    expect(en.species.get("goliath")!.traits.find((x) => x.id === "large_form")!.level).toBe(5);
    expect(en.species.get("dragonborn")!.traits.find((x) => x.id === "draconic_flight")!.level).toBe(5);
    expect(en.species.get("goliath")!.choices[0]!.options).toHaveLength(6);
  });
  it("stessa struttura in IT e EN (nomi e testi a parte)", () => {
    const noText = (es: object[]) => es.map(({ against: _a, ...e }: { against?: string }) => e); // `against` è testo libero per lingua
    const shape = (rs: typeof en) => [...rs.species.values()].map((s) => ({ id: s.id, sizes: s.sizes, speed: s.speed, effects: noText(s.effects), traits: s.traits.map((t) => [t.id, t.level, t.usage, t.activation?.resource, t.effects]), choices: s.choices.map((c) => [c.id, c.count, c.source, (c.options ?? []).map((o) => [o.id, o.effects])]) }));
    expect(shape(rsIt)).toEqual(shape(en));
    expect(rsIt.species.get("dwarf")!.name.it).toBe("Nano");
    expect(rsIt.species.get("elf")!.choices.find((c) => c.id === "elven_lineage")!.options!.find((o) => o.id === "high_elf")!.name.it).toBe("Elfo alto");
  });
});

describe("classi (blocco 1: Barbaro, Guerriero, Monaco, Ladro): valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  const cls = (id: string) => en.classes.get(id)!;
  const levels = (id: string, fid: string) => cls(id).features.filter((x) => x.id.startsWith(fid)).map((x) => x.level);
  it("tratti fondamentali", () => {
    expect(["barbarian", "fighter", "monk", "rogue"].map((id) => [id, cls(id).hitDie, cls(id).primaryAbility.join("/"), cls(id).saves.join("/"), cls(id).skillChoices.count])).toEqual([
      ["barbarian", 12, "str", "str/con", 2], ["fighter", 10, "str/dex", "str/con", 2], ["monk", 8, "dex/wis", "str/dex", 2], ["rogue", 8, "dex", "dex/int", 4]]);
    expect(cls("rogue").weaponProficiency).toEqual(["simple", "martial[finesse|light]"]);
    expect(cls("monk").weaponProficiency).toEqual(["simple", "martial[light]"]);
    expect(cls("fighter").armorTraining).toEqual(["light", "medium", "heavy", "shield"]);
    expect(cls("monk").armorTraining).toEqual([]);
  });
  it("equipaggiamento di partenza", () => {
    expect(cls("barbarian").equipment.A).toEqual({ items: [{ item: "greataxe", qty: 1 }, { item: "handaxe", qty: 4 }, { item: "explorers_pack", qty: 1 }], gp: 15 });
    expect(cls("fighter").equipment.C).toEqual({ items: [], gp: 155 });
    expect(cls("rogue").equipment.B).toEqual({ items: [], gp: 100 });
    expect(cls("monk").equipment.A!.items).toContainEqual({ item: "$tool", qty: 1 });
  });
  it("tabelle dei livelli", () => {
    expect(cls("barbarian").table.rages).toEqual([2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6]);
    expect(cls("barbarian").table.rage_damage![0]).toBe(2); expect(cls("barbarian").table.rage_damage![8]).toBe(3); expect(cls("barbarian").table.rage_damage![15]).toBe(4);
    expect(cls("fighter").table.second_wind).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(cls("fighter").table.weapon_mastery![0]).toBe(3); expect(cls("fighter").table.weapon_mastery![19]).toBe(6);
    expect(cls("monk").table.martial_arts![0]).toBe("1d6"); expect(cls("monk").table.martial_arts![4]).toBe("1d8"); expect(cls("monk").table.martial_arts![10]).toBe("1d10"); expect(cls("monk").table.martial_arts![16]).toBe("1d12");
    expect(cls("monk").table.focus_points).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(cls("monk").table.unarmored_movement).toEqual([0, 10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20, 25, 25, 25, 25, 30, 30, 30]); // piedi
    expect(cls("rogue").table.sneak_attack![0]).toBe("1d6"); expect(cls("rogue").table.sneak_attack![18]).toBe("10d6"); expect(cls("rogue").table.sneak_attack![19]).toBe("10d6");
  });
  it("livelli dei privilegi", () => {
    expect(levels("barbarian", "ability_score_improvement")).toEqual([4, 8, 12, 16]);
    expect(levels("fighter", "ability_score_improvement")).toEqual([4, 6, 8, 12, 14, 16]);
    expect(levels("rogue", "ability_score_improvement")).toEqual([4, 8, 10, 12, 16]);
    expect(levels("monk", "ability_score_improvement")).toEqual([4, 8, 12, 16]);
    for (const id of ["barbarian", "fighter", "monk", "rogue"]) {
      expect(cls(id).subclassLevel).toBe(3);
      expect(cls(id).features.find((x) => x.id === `${id}_subclass`)!.level).toBe(3);
      expect(cls(id).features.find((x) => x.id === "epic_boon")!.level).toBe(19);
    }
    expect(["extra_attack", "two_extra_attacks", "three_extra_attacks"].map((id) => cls("fighter").features.find((x) => x.id === id)!.level)).toEqual([5, 11, 20]);
    expect(cls("monk").features.find((x) => x.id === "extra_attack")!.level).toBe(5);
    expect(cls("barbarian").features.find((x) => x.id === "rage")!.usage).toEqual({ uses: { table: cls("barbarian").table.rages }, recharge: "long_rest", partialShortRest: 1 });
  });
  it("ogni privilegio ha nome e descrizione in IT e EN", () => {
    const all = (rs: typeof en) => [...rs.classes.values()].flatMap((c) => c.features).concat([...rs.subclasses.values()].flatMap((s) => s.features));
    const [a, b] = [all(rsIt), all(en)];
    expect(a.length).toBe(b.length);
    for (const [i, x] of a.entries()) { expect(x.description.trim().length, x.id).toBeGreaterThan(10); expect(x.description, x.id).not.toBe(b[i]!.description); expect(x.name.it, x.id).not.toBe(""); }
  });
  it("sottoclassi", () => {
    const sub = (id: string) => [...en.subclasses.values()].find((s) => s.classId === id)!;
    expect(["barbarian", "fighter", "monk", "rogue"].map((id) => [sub(id).id, sub(id).features.map((x) => x.level).join(",")])).toEqual([
      ["berserker", "3,6,10,14"], ["champion", "3,3,7,10,15,18"], ["open_hand", "3,6,11,17"], ["thief", "3,3,9,13,17"]]);
    expect(en.subclasses.get("champion")!.features.find((x) => x.id === "improved_critical")!.effects).toEqual([{ op: "critRange", min: 19 }]);
    expect(rsIt.subclasses.get("thief")!.name.it).toBe("Furfante");
    expect(en.subclasses.get("open_hand")!.name.it).toBe("Warrior of the Open Hand");
  });
  it("stessa struttura in IT e EN (nomi e testi a parte)", () => {
    const shape = (rs: typeof en) => [...rs.classes.values()].map((c) => ({ id: c.id, hitDie: c.hitDie, table: c.table, caster: c.caster, spellSlots: c.spellSlots, choices: c.choices.map((k) => [k.id, k.count, k.countFrom, k.source]), equipment: c.equipment, features: c.features.map((x) => [x.id, x.level, x.usage, x.effects, (x.choices ?? []).map((k) => [k.id, k.count, k.countFrom, k.source])]) }));
    expect(shape(rsIt)).toEqual(shape(en));
    expect(rsIt.classes.get("barbarian")!.name.it).toBe("Barbaro");
    expect(rsIt.classes.get("rogue")!.features.find((x) => x.id === "sneak_attack")!.name.it).toBe("Attacco furtivo");
    expect(rsIt.classes.get("barbarian")!.features.find((x) => x.id === "primal_knowledge")!.choices[0]!.options![1]!.name.it).toBe("Atletica");
  });
});

describe("classi (blocco 2: Bardo, Chierico, Paladino, Ranger): valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  const cls = (id: string) => en.classes.get(id)!;
  it("tratti fondamentali e incantesimi", () => {
    expect(["bard", "cleric", "paladin", "ranger"].map((id) => [id, cls(id).hitDie, cls(id).primaryAbility.join("/"), cls(id).saves.join("/"), cls(id).skillChoices.count, cls(id).caster, cls(id).spellAbility, cls(id).spellList])).toEqual([
      ["bard", 8, "cha", "dex/cha", 3, "full", "cha", "bard"], ["cleric", 8, "wis", "wis/cha", 2, "full", "wis", "cleric"],
      ["paladin", 10, "str/cha", "wis/cha", 2, "half", "cha", "paladin"], ["ranger", 10, "dex/wis", "str/dex", 3, "half", "wis", "ranger"]]);
    expect(cls("bard").skillChoices.from).toBe("any");
    expect(cls("bard").choices.find((c) => c.id === "bard_tools")).toMatchObject({ count: 3, source: "tools:musical" });
    expect(cls("cleric").equipment.A!.items).toContainEqual({ item: "$holy_symbol", qty: 1 });
  });
  it("tabelle: dado bardico, trucchetti, preparati, incanalare divinità, nemico prescelto", () => {
    expect(cls("bard").table.bardic_die![0]).toBe("d6"); expect(cls("bard").table.bardic_die![4]).toBe("d8"); expect(cls("bard").table.bardic_die![9]).toBe("d10"); expect(cls("bard").table.bardic_die![14]).toBe("d12");
    expect(cls("bard").table.cantrips).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(cls("bard").table.prepared).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]);
    expect(cls("cleric").table.cantrips).toEqual([3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    expect(cls("cleric").table.channel_divinity).toEqual([0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4]);
    expect(cls("paladin").table.channel_divinity).toEqual([0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(cls("paladin").table.prepared).toEqual([2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]);
    expect(cls("ranger").table.favored_enemy).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
    expect(cls("ranger").table.prepared).toEqual([2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]);
  });
  it("slot incantesimo per livello", () => {
    expect(cls("bard").spellSlots![0]).toEqual([2]); expect(cls("bard").spellSlots![2]).toEqual([4, 2]); expect(cls("bard").spellSlots![8]).toEqual([4, 3, 3, 3, 1]); expect(cls("bard").spellSlots![19]).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(cls("cleric").spellSlots).toEqual(cls("bard").spellSlots);
    expect(cls("paladin").spellSlots![0]).toEqual([2]); expect(cls("paladin").spellSlots![4]).toEqual([4, 2]); expect(cls("paladin").spellSlots![16]).toEqual([4, 3, 3, 3, 1]); expect(cls("paladin").spellSlots![19]).toEqual([4, 3, 3, 3, 2]);
    expect(cls("ranger").spellSlots).toEqual(cls("paladin").spellSlots);
    for (const id of ["bard", "cleric", "paladin", "ranger"]) expect(Object.keys(cls(id).table).some((k) => k.startsWith("slot_"))).toBe(false);
  });
  it("scelte di incantesimi e privilegi", () => {
    expect(cls("bard").choices.filter((c) => c.countFrom).map((c) => [c.id, c.countFrom, c.source])).toEqual([["bard_cantrips", "cantrips", "cantrips:bard"], ["bard_prepared", "prepared", "spells:bard"]]);
    expect(cls("paladin").choices.filter((c) => c.countFrom).map((c) => c.id)).toEqual(["paladin_prepared"]);
    expect(cls("paladin").features.find((x) => x.id === "lay_on_hands")!.usage).toEqual({ uses: "5 * classLevel:paladin", recharge: "long_rest" });
    expect(cls("paladin").features.find((x) => x.id === "fighting_style")!.choices.map((c) => c.group)).toEqual(["paladin_style", "paladin_style"]);
    expect(cls("cleric").features.find((x) => x.id === "divine_order")!.choices[0]!.options!.map((o) => o.id)).toEqual(["protector", "thaumaturge"]);
    expect(cls("ranger").features.find((x) => x.id === "feral_senses")!.effects).toContainEqual({ op: "sense", kind: "blindsight", range: 30, additive: false });
    expect(["jack_of_all_trades", "extra_attack"].map((id) => [id, [cls("bard"), cls("paladin")].some((c) => c.features.some((x) => x.id === id))])).toEqual([["jack_of_all_trades", true], ["extra_attack", true]]);
    expect(levelsOf(cls("bard"), "expertise")).toEqual([2, 9]);
    expect(levelsOf(cls("ranger"), "expertise")).toEqual([9]);
  });
  it("sottoclassi e incantesimi concessi", () => {
    const sub = (id: string) => [...en.subclasses.values()].find((s) => s.classId === id)!;
    expect(["bard", "cleric", "paladin", "ranger"].map((id) => [sub(id).id, sub(id).features.map((x) => x.level).join(",")])).toEqual([
      ["lore", "3,3,6,14"], ["life_domain", "3,3,3,6,17"], ["devotion", "3,3,7,15,20"], ["hunter", "3,3,7,11,15"]]);
    const life = sub("cleric").features.find((x) => x.id === "life_domain_spells")!;
    expect(life.effects.map((e) => `${(e as { spell: string }).spell}@${e.when}`)).toEqual([
      "aid@classLevel:cleric>=3", "bless@classLevel:cleric>=3", "cure_wounds@classLevel:cleric>=3", "lesser_restoration@classLevel:cleric>=3",
      "mass_healing_word@classLevel:cleric>=5", "revivify@classLevel:cleric>=5", "aura_of_life@classLevel:cleric>=7", "death_ward@classLevel:cleric>=7",
      "greater_restoration@classLevel:cleric>=9", "mass_cure_wounds@classLevel:cleric>=9"]);
    const all = new Set([...en.classes.values(), ...en.subclasses.values()].flatMap(grantedSpells));
    for (const s of ["divine_smite", "find_steed", "hunters_mark", "power_word_heal", "power_word_kill", "commune", "flame_strike", "shield_of_faith"]) expect(all.has(s), s).toBe(true);
    expect(rsIt.subclasses.get("life_domain")!.name.it).toBe("Dominio della Vita");
    expect(rsIt.classes.get("ranger")!.features.find((x) => x.id === "favored_enemy")!.name.it).toBe("Nemico prescelto");
  });
});
const levelsOf = (c: { features: { id: string; level: number }[] }, id: string) => c.features.filter((x) => x.id.startsWith(id)).map((x) => x.level);

describe("classi (blocco 3: Druido, Stregone, Warlock, Mago): valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  const cls = (id: string) => en.classes.get(id)!;
  it("tratti fondamentali", () => {
    expect(["druid", "sorcerer", "warlock", "wizard"].map((id) => [id, cls(id).hitDie, cls(id).caster, cls(id).spellAbility, cls(id).spellList])).toEqual([
      ["druid", 8, "full", "wis", "druid"], ["sorcerer", 6, "full", "cha", "sorcerer"],
      ["warlock", 8, "pact", "cha", "warlock"], ["wizard", 6, "full", "int", "wizard"]]);
  });
  it("slot incantesimo e magia del patto", () => {
    expect(cls("druid").spellSlots).toEqual(cls("wizard").spellSlots);
    expect(cls("sorcerer").spellSlots).toEqual(cls("wizard").spellSlots);
    expect(cls("wizard").spellSlots![0]).toEqual([2]); expect(cls("wizard").spellSlots![19]).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(cls("warlock").spellSlots).toBeUndefined();
    expect(cls("warlock").pactSlots![0]).toEqual({ count: 1, level: 1 });
    expect(cls("warlock").pactSlots![19]).toEqual({ count: 4, level: 5 });
  });
  it("tabelle e scelte", () => {
    expect(cls("sorcerer").table.sorcery_points![1]).toBe(2);
    expect(cls("warlock").table.invocations![0]).toBe(1);
    expect(cls("warlock").choices.filter((c) => c.countFrom).map((c) => c.countFrom)).toEqual(["cantrips", "prepared"]);
    expect(cls("warlock").features.find((x) => x.id === "eldritch_invocations")!.choices[0]!.countFrom).toBe("invocations");
    expect(cls("warlock").features.find((x) => x.id === "eldritch_invocations")!.choices[0]!.options!.length).toBe(28);
    expect(cls("sorcerer").features.find((x) => x.id === "metamagic")!.choices[0]!.options!.length).toBe(10);
  });
  it("sottoclassi", () => {
    expect(["land", "draconic", "fiend", "evoker"].map((id) => rsIt.subclasses.get(id)?.classId)).toEqual(["druid", "sorcerer", "warlock", "wizard"]);
  });
});

describe("incantesimi: valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  const sp = (id: string) => en.spells.get(id)!;
  it("numero per livello", () => {
    const perLevel = Array.from({ length: 10 }, (_, l) => [...en.spells.values()].filter((s) => s.level === l).length);
    expect(perLevel).toEqual([27, 57, 57, 42, 34, 38, 31, 20, 17, 16]);
  });
  it("campi principali", () => {
    expect(sp("fireball")).toMatchObject({ level: 3, school: "evocation", classes: ["sorcerer", "wizard"], range: "150 feet", resolution: "save_dex", concentration: false });
    expect(rsIt.spells.get("fireball")).toMatchObject({ range: "45 metri", name: { it: "Palla di fuoco" } });
    expect(sp("fire_bolt")).toMatchObject({ level: 0, resolution: "attack_ranged" });
    expect(sp("shocking_grasp").resolution).toBe("attack_melee");
    expect(sp("bless")).toMatchObject({ concentration: true, duration: "Concentration, up to 1 minute" });
    expect(sp("alarm")).toMatchObject({ ritual: true, castingTime: { unit: "minute", amount: 1 } });
    expect(sp("shield").castingTime.unit).toBe("reaction");
    expect(sp("true_resurrection").components).toMatchObject({ m: true, materialCost: 25000, materialConsumed: true });
    expect(sp("flaming_sphere").school).toBe("evocation");
  });
  it("incantesimi concessi dalle classi esistono con livello coerente", () => {
    for (const id of ["speak_with_animals", "contact_other_plane", "alter_self", "chromatic_orb", "command", "dragons_breath", "fear", "fly", "arcane_eye", "charm_monster", "legend_lore", "summon_dragon", "burning_hands", "fireball", "geas", "insect_plague"]) expect(en.spells.has(id), id).toBe(true);
    expect(sp("summon_dragon").level).toBe(5);
    expect(sp("geas").level).toBe(5);
  });
  it("il testo non ha iniziali perse", () => {
    for (const s of en.spells.values()) expect(`${s.summary} ${s.higherLevels ?? ""}`, s.id).not.toMatch(/(^|[.!?] )[a-z]/);
  });
});

describe("condizioni, slot multiclasse e creazione: valori controllati sul PDF (SRD 5.2.1)", () => {
  const [rsIt, en] = [loadSrd("it"), loadSrd("en")];
  const run = (state: object) => resolveConditions({ ...testCharacter(), state: { ...testCharacter().state, ...state } }, en);
  it("condizioni", () => {
    expect([...en.conditions.values()].filter((c) => c.stackable).map((c) => c.id)).toEqual(["exhaustion"]);
    expect([...en.conditions.values()].filter((c) => c.requiresSource).map((c) => c.id).sort()).toEqual(["charmed", "frightened", "grappled"]);
    expect(en.conditions.get("exhaustion")!.levels).toEqual({ min: 1, max: 6, deathAt: 6 });
    expect(en.conditions.get("grappled")!.escape).toMatchObject({ action: true, check: [{ ability: "str", skill: "athletics" }, { ability: "dex", skill: "acrobatics" }] });
    expect(rsIt.conditions.get("exhaustion")!.name.it).toBe("Indebolimento");
    for (const c of en.conditions.values()) expect(c.description, c.id).not.toBe("");
  });
  it("il motore applica le condizioni con i dati veri", () => {
    const u = run({ conditions: ["unconscious"] });
    expect(u.active.sort()).toEqual(["incapacitated", "prone", "unconscious"]);
    expect(u.attacksAgainstYou.autoCritical).toHaveLength(1);
    expect(u.cannot).toEqual(expect.arrayContaining(["compiere azione", "parlare"]));
    const p = run({ conditions: ["petrified", "poisoned"] });
    expect(p.active).not.toContain("poisoned");
    expect(p.resistAll).toHaveLength(1);
    expect(run({ conditions: ["blinded"] }).attackRolls.mode).toBe("disadvantage");
    expect(run({ conditions: ["invisible"] }).initiativeMode.mode).toBe("advantage");
    expect(run({ exhaustion: 2 })).toMatchObject({ d20Penalty: -4, speedPenalty: -10, dead: false });
    expect(run({ exhaustion: 6 }).dead).toBe(true);
  });
  it("slot del multiclasse", () => {
    const full = en.slotTables.get("full_caster")!.slots;
    expect(full[0]).toEqual([2]); expect(full[4]).toEqual([4, 3, 2]); expect(full[19]).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    for (const id of ["bard", "cleric", "druid", "sorcerer", "wizard"]) expect(en.classes.get(id)!.spellSlots, id).toEqual(full);
    for (const id of ["paladin", "ranger"]) expect(en.classes.get(id)!.spellSlots, id).toEqual(en.slotTables.get("half_caster")!.slots);
    expect(rsIt.slotTables.get("full_caster")!.slots).toEqual(full);
  });
  it("regole di creazione", () => {
    const c = en.creation.get("creation")!;
    expect(c.standardArray).toEqual([15, 14, 13, 12, 10, 8]);
    expect(c.pointBuy).toEqual({ budget: 27, min: 8, max: 15, costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } });
    expect(c.xpThresholds).toEqual([0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]);
    expect(c.recommendedArrays.wizard).toEqual({ str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 });
    expect(Object.keys(c.recommendedArrays)).toHaveLength(12);
    expect(c.startingLevels.map((b) => [b.minLevel, b.maxLevel, b.gold, b.goldDice?.multiplier])).toEqual([[2, 4, 0, undefined], [5, 10, 500, 25], [11, 16, 5000, 250], [17, 20, 20000, 250]]);
    expect(c.startingLevels[3]!.magicItems).toEqual({ common: 2, uncommon: 4, rare: 3, veryRare: 1 });
    expect(c.alignments.map((a) => a.id)).toHaveLength(9);
    expect(rsIt.creation.get("creation")!.alignments[0]!.name.it).toBe("Legale buono");
  });
});
