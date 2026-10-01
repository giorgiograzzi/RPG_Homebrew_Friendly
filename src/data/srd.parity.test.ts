import { describe, expect, it } from "vitest";
import { brokenReferences, idsByKind, loadSrd, SRD_LANGS } from "./srdIntegrity";

// Conteggi presi dalle tabelle dell'SRD 5.2.1 (armi: 10 semplici da mischia + 4 semplici a distanza + 18 da guerra da mischia + 6 da guerra a distanza)
const COUNTS: Record<string, number> = {
  skills: 18, languages: 19, sizes: 6, damageTypes: 13, weaponProperties: 10, masteries: 8, coins: 5,
  weapons: 38, armors: 13, tools: 37, items: 94, backgrounds: 4, feats: 17, species: 9,
};

describe.each(SRD_LANGS)("dati SRD (%s)", (lang) => {
  const rs = loadSrd(lang);
  it("nessuna voce scartata", () => { expect(rs.errors).toEqual([]); });
  it("conteggi attesi", () => {
    for (const [k, n] of Object.entries(COUNTS)) expect([k, (rs as unknown as Record<string, Map<string, unknown>>)[k]!.size]).toEqual([k, n]);
  });
  it("riferimenti incrociati", () => { expect(brokenReferences(rs)).toEqual([]); });
  it("tutte le voci sono marcate SRD", () => {
    for (const k of Object.keys(COUNTS)) for (const e of (rs as unknown as Record<string, Map<string, { origin: string }>>)[k]!.values()) expect(e.origin).toBe("srd");
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
