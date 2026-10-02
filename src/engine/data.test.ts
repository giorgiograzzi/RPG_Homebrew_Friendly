import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { checkReferences } from "./validate";
import { buildCtx, computeCharacter } from "./compute";
import { spellChoiceCandidates } from "./spells";
import { equipItem } from "./equipment";
import { testCharacter } from "./compute/testkit";

// Dati SRD 5.2.1 (tracciati in git)
const fullRuleset = () => loadSrd("it");

describe("dati SRD nel motore", () => {
  const rs = loadSrd("it");

  it("validi e con riferimenti coerenti", () => {
    expect(rs.errors).toEqual([]);
    expect(checkReferences(rs)).toEqual([]);
  });
  it("quantità attese", () => {
    const n = (m: Map<unknown, unknown>) => m.size;
    expect([n(rs.skills), n(rs.languages), n(rs.sizes), n(rs.damageTypes), n(rs.conditions), n(rs.coins)]).toEqual([18, 19, 6, 13, 15, 5]);
    expect([n(rs.weapons), n(rs.armors), n(rs.tools), n(rs.weaponProperties), n(rs.masteries)]).toEqual([38, 13, 37, 10, 8]);
    expect([...rs.weapons.values()].filter((w) => w.category === "simple")).toHaveLength(14);
  });
  it("talenti e background (step 5)", () => {
    const cat = (c: string) => [...rs.feats.values()].filter((f) => f.category === c).length;
    expect([cat("origin"), cat("general"), cat("fighting_style"), cat("epic_boon"), rs.backgrounds.size]).toEqual([4, 2, 4, 7, 4]); // SRD 5.2.1: Origine, Generali, Stili di combattimento, Doni epici, background
    // ogni background porta un talento di Origine
    for (const b of rs.backgrounds.values()) expect(rs.feats.get(b.feat)?.category).toBe("origin");
    // i talenti generali hanno tutti il prerequisito di livello 4, i Doni epici il 19
    for (const f of rs.feats.values()) {
      if (f.category === "general") expect(f.prerequisites).toContain("level>=4");
      if (f.category === "epic_boon") expect(f.prerequisites).toContain("level>=19");
    }
  });
  it("Soldato con Attaccante selvaggio e Allerta usano i dati SRD", () => {
    const full = fullRuleset();
    const ch = testCharacter({ backgroundId: "soldier", feats: [{ featId: "alert" }] });
    const d = computeCharacter(ch, full);
    expect(d.feats).toEqual(["alert", "savage_attacker"]);
    expect(d.skills.athletics.proficiency).toBe("proficient");
    expect(d.initiative.value).toBe(2 + 2); // Des +2, Allerta = competenza +2
    expect(d.hp.max.value).toBe(10 + 1); // d10 + Cos 13 (+1)
  });
  describe("specie (step 6)", () => {
    const fullRs = fullRuleset();
    const mk = (speciesId: string, level = 1, decisions: Record<string, string[]> = {}) =>
      testCharacter({ speciesId, decisions, classes: [{ classId: "fighter", level, hpRolls: [] }] });
    const spells = (ch: ReturnType<typeof mk>) =>
      buildCtx(ch, fullRs).active.flatMap(({ effect: e }) => (e.op === "grantSpell" ? [e.spell] : []));

    it("9 specie, ognuna con velocità e taglie", () => {
      expect(fullRs.species.size).toBe(9);
      for (const sp of fullRs.species.values()) expect(sp.sizes.length).toBeGreaterThan(0);
      expect([...fullRs.species.values()].filter((s) => s.sizes.length > 1).map((s) => s.id).sort()).toEqual(["human", "tiefling"]);
    });
    it("Nano: scurovisione 120, resistenza al veleno, +1 PF per livello (retroattivo)", () => {
      const d1 = computeCharacter(mk("dwarf", 1), fullRs), d5 = computeCharacter(mk("dwarf", 5), fullRs);
      expect(d1.senses.darkvision?.value).toBe(120);
      expect(d1.resistances).toEqual(["poison"]);
      const base5 = computeCharacter(mk("human", 5), fullRs).hp.max.value;
      expect(d5.hp.max.value - base5).toBe(5);
    });
    it("Goliath 35 ft; Elfo dei boschi 35 ft solo con quel lignaggio", () => {
      expect(computeCharacter(mk("goliath"), fullRs).speed.walk.value).toBe(35);
      expect(computeCharacter(mk("elf"), fullRs).speed.walk.value).toBe(30);
      expect(computeCharacter(mk("elf", 1, { elven_lineage: ["wood_elf"] }), fullRs).speed.walk.value).toBe(35);
    });
    it("Elfo Drow: scurovisione 120 e incantesimi sbloccati al 3° e 5° livello TOTALE", () => {
      const at = (l: number) => spells(mk("elf", l, { elven_lineage: ["drow"] }));
      expect(computeCharacter(mk("elf", 1, { elven_lineage: ["drow"] }), fullRs).senses.darkvision?.value).toBe(120);
      expect(at(1)).toEqual(["dancing_lights"]);
      expect(at(3)).toEqual(["dancing_lights", "faerie_fire"]);
      expect(at(5)).toEqual(["dancing_lights", "faerie_fire", "darkness"]);
    });
    it("Elfo: Sensi acuti dà la competenza scelta", () => {
      const d = computeCharacter(mk("elf", 1, { keen_senses: ["survival"] }), fullRs);
      expect(d.skills.survival.proficiency).toBe("proficient");
      expect(d.skills.insight.proficiency).toBe("none");
    });
    it("Dragonide: resistenza del colore scelto; usi del soffio = competenza", () => {
      const d = computeCharacter(mk("dragonborn", 1, { draconic_ancestry: ["gold"] }), fullRs);
      expect(d.resistances).toEqual(["fire"]);
      expect(d.resources.breath_weapon?.max.value).toBe(2);
      expect(computeCharacter(mk("dragonborn", 5, { draconic_ancestry: ["gold"] }), fullRs).resources.breath_weapon?.max.value).toBe(3);
    });
    it("tratti di livello 5 si attivano dal livello totale (Dragonide, Goliath)", () => {
      const has = (sp: string, l: number, r: string) => computeCharacter(mk(sp, l), fullRs).resources[r] !== undefined;
      expect([has("goliath", 4, "large_form"), has("goliath", 5, "large_form")]).toEqual([false, true]);
      expect([has("dragonborn", 4, "draconic_flight"), has("dragonborn", 5, "draconic_flight")]).toEqual([false, true]);
    });
    it("Tiefling infernale: resistenza al fuoco; Gnomo: vantaggio ai TS Int/Sag/Car", () => {
      expect(computeCharacter(mk("tiefling", 1, { fiendish_legacy: ["infernal"] }), fullRs).resistances).toEqual(["fire"]);
      const g = computeCharacter(mk("gnome"), fullRs);
      expect([g.saves.int.mode, g.saves.wis.mode, g.saves.cha.mode, g.saves.str.mode]).toEqual(["advantage", "advantage", "advantage", "normal"]);
    });
    it("Umano: Abile e Versatile concedono abilità e talento", () => {
      const d = computeCharacter(mk("human", 1, { skillful: ["arcana"], versatile: ["skilled"] }), fullRs);
      expect(d.skills.arcana.proficiency).toBe("proficient");
      expect(d.feats).toContain("skilled");
    });
  });

  it("il motore usa i dati veri: Cotta di maglia + Scudo = CA 18", () => {
    const ch = testCharacter({
      classes: [{ classId: "fighter", level: 1, hpRolls: [] }],
      inventory: [{ itemId: "chain_mail", qty: 1, state: "worn" }, { itemId: "shield", qty: 1, state: "worn" }],
    });
    const fighter = fullRuleset();
    expect(computeCharacter(ch, fighter).ac.value).toBe(18);
  });

  describe("classi 7a: Barbaro, Bardo, Chierico, Druido", () => {
    const R = fullRuleset();
    const cls = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });
    const mk = (classes: ReturnType<typeof cls>[], over: object = {}) => testCharacter({ classes, ...over });
    const spells = (ch: ReturnType<typeof mk>) => buildCtx(ch, R).active.flatMap(({ effect: e }) => (e.op === "grantSpell" ? [e.spell] : []));

    it("4 classi, 4 sottoclassi, tabelle 1-20 complete", () => {
      for (const id of ["barbarian", "bard", "cleric", "druid"]) {
        const c = R.classes.get(id)!;
        expect(c, id).toBeDefined();
        for (const col of Object.values(c.table)) expect(col).toHaveLength(20);
      }
      expect([...R.subclasses.values()].filter((s) => ["barbarian", "bard", "cleric", "druid"].includes(s.classId))).toHaveLength(4);
      expect(R.classes.get("cleric")!.spellSlots![4]).toEqual([4, 3, 2]); // liv. 5
      expect(R.classes.get("barbarian")!.hitDie).toBe(12);
    });
    it("Barbaro: Difesa senza armatura 10 + Des + Cos, Ira con usi dalla tabella", () => {
      const ch = mk([cls("barbarian", 1)], { baseScores: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 8 } });
      const d = computeCharacter(ch, R);
      expect(d.ac.value).toBe(14);
      expect(d.resources.rage?.max.value).toBe(2);
      expect(computeCharacter(mk([cls("barbarian", 12)]), R).resources.rage?.max.value).toBe(5);
      expect(d.saves.str.proficient).toBe(true);
      expect(d.hp.hitDice).toEqual([{ die: 12, total: 1 }]);
    });
    it("Barbaro: Movimento veloce dal 5° (no armatura pesante), Campione primordiale al 20° (cap 25)", () => {
      const base = { baseScores: { str: 18, dex: 10, con: 10, int: 8, wis: 10, cha: 8 } };
      expect(computeCharacter(mk([cls("barbarian", 4)], base), R).speed.walk.value).toBe(30);
      expect(computeCharacter(mk([cls("barbarian", 5)], base), R).speed.walk.value).toBe(40);
      expect(computeCharacter(mk([cls("barbarian", 20)], base), R).scores.str.value).toBe(22);
    });
    it("Bardo: Ispirazione bardica = mod Car (min 1); Factotum e Maestria", () => {
      const ch = mk([cls("bard", 2)], { baseScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
        decisions: { bard_skills: ["stealth", "arcana", "history"], bard_expertise_2: ["stealth"] } });
      const d = computeCharacter(ch, R);
      expect(d.resources.bardic_inspiration?.max.value).toBe(3);
      expect(d.skills.stealth.proficiency).toBe("expertise");
      expect(d.skills.acrobatics.proficiency).toBe("half"); // Factotum dal 2°
      expect(d.spellcasting[0]).toMatchObject({ classId: "bard", ability: "cha" });
      expect(d.spellcasting[0]!.dc.value).toBe(8 + 3 + 2);
    });
    it("Chierico: Ordine divino Taumaturgo = +mod Sag (min 1) ad Arcano e Religione; Protettore = armi marziali e armature pesanti", () => {
      const base = { baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
      const t = computeCharacter(mk([cls("cleric", 1)], { ...base, decisions: { cleric_divine_order: ["thaumaturge"] } }), R);
      expect(t.skills.arcana.bonus.value).toBe(1); // Int +0, Sag +0 → minimo +1
      expect(t.skills.religion.bonus.value).toBe(1);
      expect(t.skills.history.bonus.value).toBe(0);
      const p = computeCharacter(mk([cls("cleric", 1)], { ...base, decisions: { cleric_divine_order: ["protector"] } }), R);
      expect(p.proficiencies.armor).toContain("heavy");
      expect(p.proficiencies.weapons).toContain("martial");
    });
    it("Chierico: Incanalare divinità dal 2° con usi della tabella", () => {
      expect(computeCharacter(mk([cls("cleric", 1)]), R).resources.channel_divinity).toBeUndefined(); // privilegio del 2°
      expect(computeCharacter(mk([cls("cleric", 6)]), R).resources.channel_divinity?.max.value).toBe(3);
    });
    it("Dominio della Vita: incantesimi sempre preparati per livello di classe", () => {
      const at = (l: number) => spells(mk([cls("cleric", l, { subclassId: "life_domain" })]));
      expect(at(2)).toEqual([]);
      expect(at(3)).toEqual(["aid", "bless", "cure_wounds", "lesser_restoration"]);
      expect(at(5)).toContain("revivify");
      expect(at(5)).not.toContain("greater_restoration");
    });
    it("Druido: Circolo della Terra, terreno scelto → incantesimi per livello", () => {
      const at = (l: number) => spells(mk([cls("druid", l, { subclassId: "land" })], { decisions: { land_type: ["arid"] } }));
      expect(at(3)).toEqual(expect.arrayContaining(["blur", "burning_hands", "fire_bolt"]));
      expect(at(3)).not.toContain("fireball");
      expect(at(5)).toContain("fireball");
      expect(at(5)).not.toContain("blight");
      expect(computeCharacter(mk([cls("druid", 1)]), R).proficiencies.tools).toContain("herbalism_kit");
    });
    it("Druido: Ordine primordiale Custode = armi marziali + armature medie; Druidico dà Parlare con gli animali", () => {
      const d = computeCharacter(mk([cls("druid", 1)], { decisions: { druid_primal_order: ["warden"] } }), R);
      expect(d.proficiencies.armor).toEqual(expect.arrayContaining(["medium", "light", "shield"]));
      expect(spells(mk([cls("druid", 1)]))).toContain("speak_with_animals");
    });
    it("Collegio del Sapienza: 3 competenze bonus", () => {
      const lore = computeCharacter(mk([cls("bard", 3, { subclassId: "lore" })], { decisions: { lore_bonus_skills: ["arcana", "history", "nature"] } }), R);
      expect(lore.skills.nature.proficiency).toBe("proficient");
      expect(lore.skills.arcana.proficiency).toBe("proficient");
    });
  });

  describe("classi 7b: Guerriero, Monaco, Paladino, Ranger, Ladro, Stregone, Warlock, Mago", () => {
    const R = fullRuleset();
    const cls = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });
    const mk = (classes: ReturnType<typeof cls>[], over: object = {}) => testCharacter({ classes, ...over });
    const scores = (o: Partial<Record<string, number>>) => ({ baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...o } });
    const active = (ch: ReturnType<typeof mk>) => buildCtx(ch, R).active.map((a) => a.effect);
    const spells = (ch: ReturnType<typeof mk>) => active(ch).flatMap((e) => (e.op === "grantSpell" ? [e.spell] : []));

    it("12 classi, 12 sottoclassi (una per classe), tabelle 1-20 complete", () => {
      expect(R.classes.size).toBe(12);
      expect(R.subclasses.size).toBe(12);
      for (const c of R.classes.values()) {
        for (const col of Object.values(c.table)) expect(col, c.id).toHaveLength(20);
        expect(c.features.length, c.id).toBeGreaterThan(10);
        expect([...R.subclasses.values()].filter((sc) => sc.classId === c.id).length, c.id).toBe(1);
      }
    });
    it("Guerriero: usi da tabella (Recupero energie, Azione impetuosa) e Campione con critico 19-20 / 18-20", () => {
      expect(computeCharacter(mk([cls("fighter", 1)]), R).resources.second_wind?.max.value).toBe(2);
      expect(computeCharacter(mk([cls("fighter", 2)]), R).resources.action_surge?.max.value).toBe(1);
      expect(computeCharacter(mk([cls("fighter", 17)]), R).resources.action_surge?.max.value).toBe(2);
      const crit = (l: number) => active(mk([cls("fighter", l, { subclassId: "champion" })])).flatMap((e) => (e.op === "critRange" ? [e.min] : []));
      expect(crit(3)).toEqual([19]);
      expect(crit(15)).toEqual([19, 18]);
    });
    it("Monaco: CA 10 + Des + Sag, Movimento senza armatura a scaglioni, Arti marziali d6→d12", () => {
      const b = scores({ dex: 14, wis: 14 });
      expect(computeCharacter(mk([cls("monk", 1)], b), R).ac.value).toBe(14);
      const sp = (l: number, inv: object[] = []) => computeCharacter(mk([cls("monk", l)], { ...b, inventory: inv }), R).speed.walk.value;
      expect([sp(1), sp(2), sp(6), sp(18)]).toEqual([30, 40, 45, 60]);
      expect(sp(6, [{ itemId: "shield", qty: 1, state: "worn" }])).toBe(30); // niente scudo
      const dice = (l: number) => active(mk([cls("monk", l)], b)).flatMap((e) => (e.op === "unarmedDie" ? [e.die] : []));
      expect(dice(4)).toEqual(["1d6"]);
      expect(dice(5)).toEqual(["1d6", "1d8"]);
      expect(dice(17)).toEqual(["1d6", "1d8", "1d10", "1d12"]);
      expect(computeCharacter(mk([cls("monk", 2)], b), R).resources.monks_focus?.max.value).toBe(2);
    });
    it("Monaco 14°: competenza in tutti i TS", () => {
      const d = computeCharacter(mk([cls("monk", 14)]), R);
      expect(Object.values(d.saves).every((x) => x.proficient)).toBe(true);
    });
    it("Paladino: Imposizione delle mani = 5 × livello; Aura di protezione = mod Car ai TS dal 6°", () => {
      expect(computeCharacter(mk([cls("paladin", 3)]), R).resources.lay_on_hands?.max.value).toBe(15);
      const b = scores({ cha: 16, dex: 10 });
      expect(computeCharacter(mk([cls("paladin", 5)], b), R).saves.dex.bonus.value).toBe(0);
      expect(computeCharacter(mk([cls("paladin", 6)], b), R).saves.dex.bonus.value).toBe(3);
      expect(R.classes.get("paladin")!.spellSlots![4]).toEqual([4, 2]);
      expect(R.classes.get("paladin")!.choices.some((c) => c.id === "paladin_cantrips")).toBe(false); // il Paladino non ha trucchetti
    });
    it("Ranger: Marchio del cacciatore sempre preparato, Vagabondo, Sensi ferini", () => {
      expect(spells(mk([cls("ranger", 1)]))).toContain("hunters_mark");
      expect(computeCharacter(mk([cls("ranger", 1)]), R).resources.favored_enemy?.max.value).toBe(2);
      expect(computeCharacter(mk([cls("ranger", 6)]), R).speed.walk.value).toBe(40);
      expect(computeCharacter(mk([cls("ranger", 18)]), R).senses.blindsight?.value).toBe(30);
    });
    it("Ladro: 4 abilità, due Maestrie (1° e 6°), Attacco furtivo dalla tabella", () => {
      const c = R.classes.get("rogue")!;
      expect(c.skillChoices.count).toBe(4);
      expect(c.toolProficiency).toEqual(["thieves_tools"]);
      const d = computeCharacter(mk([cls("rogue", 6)], { decisions: { rogue_skills: ["stealth", "acrobatics", "perception", "investigation"], rogue_expertise_1: ["stealth", "perception"], rogue_expertise_6: ["acrobatics", "investigation"] } }), R);
      expect(["stealth", "perception", "acrobatics", "investigation"].map((s) => d.skills[s as "stealth"].proficiency)).toEqual(Array(4).fill("expertise"));
      expect(c.table.sneak_attack![10]).toBe("6d6");
    });
    it("Stregone: punti stregoneria = livello, Stregoneria innata 2 usi, Metamagia con costi", () => {
      expect(computeCharacter(mk([cls("sorcerer", 5)]), R).resources.font_of_magic?.max.value).toBe(5);
      expect(computeCharacter(mk([cls("sorcerer", 2)]), R).resources.innate_sorcery?.max.value).toBe(2);
      const meta = R.classes.get("sorcerer")!.features.find((f) => f.id === "metamagic")!.choices[0]!;
      expect(meta.options).toHaveLength(10);
      expect(meta.options!.every((o) => o.cost === 1 || o.cost === 2 || o.cost === 3)).toBe(true);
    });
    it("Stregone draconico: CA 10 + Des + Car e +1 PF per livello da Stregone (più 3)", () => {
      const b = scores({ dex: 14, cha: 16, con: 10 });
      const dr = computeCharacter(mk([cls("sorcerer", 3, { subclassId: "draconic" })], b), R);
      expect(dr.ac.value).toBe(10 + 2 + 3);
      const plain = computeCharacter(mk([cls("sorcerer", 3)], b), R).hp.max.value;
      expect(dr.hp.max.value - plain).toBe(3 + 3);
    });
    it("Warlock: slot del patto separati (3 slot di 5° all'11°), 28 invocazioni con prerequisiti", () => {
      const w = R.classes.get("warlock")!;
      expect(w.caster).toBe("pact");
      expect(w.spellSlots).toBeUndefined();
      expect(w.pactSlots![10]).toEqual({ count: 3, level: 5 });
      const inv = w.features.find((f) => f.id === "eldritch_invocations")!.choices[0]!;
      expect(inv.options).toHaveLength(28);
      expect(inv.countFrom).toBe("invocations");
      expect(inv.options!.some((o) => o.requires)).toBe(true);
    });
    it("Mago: libro degli incantesimi (6, +2 a livello), Recupero arcano, Studioso", () => {
      const w = R.classes.get("wizard")!;
      expect(w.choices.find((c) => c.id === "wizard_spellbook")).toMatchObject({ count: 1, countFormula: "4 + 2 * classLevel:wizard" });
      expect(computeCharacter(mk([cls("wizard", 1)]), R).resources.arcane_recovery?.max.value).toBe(1);
      const d = computeCharacter(mk([cls("wizard", 2)], { decisions: { wizard_skills: ["arcana", "history"], wizard_scholar: ["arcana"] } }), R);
      expect(d.skills.arcana.proficiency).toBe("expertise");
      expect(w.spellSlots![16]).toEqual([4, 3, 3, 3, 2, 1, 1, 1, 1]);
    });
    it("classi con lista di incantesimi: colonne trucchetti/preparati (tranne Paladino e Ranger)", () => {
      for (const id of ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"]) expect(R.classes.get(id)!.table.cantrips, id).toBeDefined();
      for (const id of ["paladin", "ranger"]) expect(R.classes.get(id)!.table.cantrips, id).toBeUndefined();
    });
  });

  describe("correzioni del DATA_TODO", () => {
    const R = fullRuleset();
    const cls = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });
    const mk = (classes: ReturnType<typeof cls>[], over: object = {}) => testCharacter({ classes, ...over });
    const spellsOf = (ch: ReturnType<typeof mk>) => computeCharacter(ch, R).grantedSpells;

    it("caratteristica da incantatore della specie: la scelta spell_ability arriva agli incantesimi concessi", () => {
      const drow = spellsOf(mk([cls("fighter", 3)], { speciesId: "elf", decisions: { elven_lineage: ["drow"], spell_ability: ["wis"] } }));
      const dl = drow.find((x) => x.spell === "dancing_lights")!;
      expect(dl.ability).toBe("wis");
      expect(dl.dc).toBe(8 + 0 + 2); // Sag 10 (+0), competenza +2
      expect(drow.find((x) => x.spell === "faerie_fire")).toMatchObject({ ability: "wis", freeCast: { uses: 1, recharge: "long_rest" } });
      expect(spellsOf(mk([cls("fighter", 1)], { speciesId: "elf", decisions: { elven_lineage: ["drow"] } }))[0]!.ability).toBeUndefined(); // scelta non ancora fatta
      const t = spellsOf(mk([cls("fighter", 1)], { speciesId: "tiefling", decisions: { spell_ability: ["cha"], fiendish_legacy: ["infernal"] } }));
      expect(t.find((x) => x.spell === "thaumaturgy")!.ability).toBe("cha");
      const g = spellsOf(mk([cls("fighter", 1)], { speciesId: "gnome", decisions: { gnomish_lineage: ["forest_gnome"], spell_ability: ["int"] } }));
      expect(g.find((x) => x.spell === "speak_with_animals")!.freeCast).toEqual({ uses: 2, recharge: "long_rest" }); // bonus competenza
    });
    it("incantesimi di classe e sottoclasse usano la caratteristica della classe", () => {
      const life = spellsOf(mk([cls("cleric", 3, { subclassId: "life_domain" })], { baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 } }));
      expect(life.find((x) => x.spell === "bless")).toMatchObject({ ability: "wis", dc: 8 + 3 + 2, attack: 5 });
    });
    it("Iniziato alla magia: caratteristica dalla scelta; due acquisizioni con liste diverse", () => {
      const ch = mk([cls("fighter", 1)], { feats: [
        { featId: "magic_initiate", choices: { magic_initiate_ability: ["wis"], magic_initiate_cantrips: ["guidance", "resistance"], magic_initiate_spell: ["cure_wounds"] } },
        { featId: "magic_initiate", choices: { magic_initiate_ability: ["int"], magic_initiate_cantrips: ["light", "mage_hand"], magic_initiate_spell: ["sleep"] } },
      ] });
      const sp = spellsOf(ch);
      expect(sp.find((x) => x.spell === "guidance")!.ability).toBe("wis");
      expect(sp.find((x) => x.spell === "mage_hand")!.ability).toBe("int");
      expect(sp.find((x) => x.spell === "sleep")).toMatchObject({ ability: "int", mode: "alwaysPrepared", freeCast: { uses: 1, recharge: "long_rest" } });
      expect(sp.filter((x) => x.mode === "cantrip")).toHaveLength(4);
    });
    it("un talento non ripetibile non si somma (background + talento scelto)", () => {
      const once = computeCharacter(mk([cls("fighter", 1)], { backgroundId: "criminal" }), R).initiative.value; // Allerta dal background
      const twice = computeCharacter(mk([cls("fighter", 1)], { backgroundId: "criminal", feats: [{ featId: "alert" }] }), R).initiative.value;
      expect(twice).toBe(once);
    });
    it("Guerriero benedetto/druidico: 2 trucchetti con Car/Sag, in alternativa allo Stile", () => {
      const p = R.classes.get("paladin")!.features.find((f) => f.id === "fighting_style")!;
      expect(p.choices.map((c) => [c.id, c.group])).toEqual([["paladin_fighting_style", "paladin_style"], ["paladin_blessed_warrior", "paladin_style"]]);
      const bw = spellsOf(mk([cls("paladin", 2)], { decisions: { paladin_blessed_warrior: ["guidance", "sacred_flame"] } }));
      expect(bw.filter((x) => x.mode === "cantrip").map((x) => [x.spell, x.ability])).toEqual([["guidance", "cha"], ["sacred_flame", "cha"]]);
      const dw = spellsOf(mk([cls("ranger", 2)], { decisions: { ranger_druidic_warrior: ["druidcraft"] } }));
      expect(dw.find((x) => x.spell === "druidcraft")!.ability).toBe("wis");
    });
    it("sottoclassi: incantesimi sempre preparati (Vita, Immondo, Draconico) e Circolo della Terra", () => {
      const has = (c: ReturnType<typeof cls>, spell: string) => spellsOf(mk([c])).find((x) => x.spell === spell);
      expect(has(cls("warlock", 3, { subclassId: "fiend" }), "burning_hands")).toBeDefined();
      expect(has(cls("warlock", 3), "burning_hands")).toBeUndefined();
      expect(has(cls("sorcerer", 3, { subclassId: "draconic" }), "alter_self")).toBeDefined();
      expect(has(cls("sorcerer", 3), "alter_self")).toBeUndefined();
      expect(has(cls("cleric", 3, { subclassId: "life_domain" }), "cure_wounds")).toBeDefined();
      expect(has(cls("druid", 3, { subclassId: "land" }), "speak_with_animals")).toBeDefined();
    });
    it("Circolo della Terra: resistenza dal 10° secondo il terreno scelto", () => {
      const r = (l: number, t: string) => computeCharacter(mk([cls("druid", l, { subclassId: "land" })], { decisions: { land_type: [t] } }), R).resistances;
      expect(r(9, "arid")).toEqual([]);
      expect(r(10, "arid")).toEqual(["fire"]);
      expect(r(10, "polar")).toEqual(["cold"]);
      expect(r(10, "temperate")).toEqual(["lightning"]);
      expect(r(10, "tropical")).toEqual(["poison"]);
    });
    it("Iniziato alla magia e Maestro delle armi: scelte con filtri", () => {
      const f = (id: string) => R.feats.get(id)!;
      expect(f("magic_initiate").choices.length).toBeGreaterThan(0);
      expect(R.classes.get("fighter")!.features.some((x) => x.id === "weapon_mastery") || R.classes.get("fighter")!.choices.length > 0).toBe(true);
    });
    it("nessun needsReview rimasto sui talenti codificati", () => {
      const left = [...R.feats.values()].filter((x) => x.needsReview).map((x) => x.id);
      expect(left).toEqual([]);
    });
  });

  describe("condizioni (spec SRD)", () => {
    const R = fullRuleset();
    const base = testCharacter({ classes: [{ classId: "fighter", level: 1, hpRolls: [] }] });
    const run = (state: object) => computeCharacter({ ...base, state: { ...base.state, ...state } }, R);

    it("15 condizioni con id, pagina del manuale e riferimenti coerenti", () => {
      expect(R.conditions.size).toBe(15);
      expect(checkReferences(R)).toEqual([]);
      expect([...R.conditions.values()].filter((c) => c.stackable).map((c) => c.id)).toEqual(["exhaustion"]);
      expect([...R.conditions.values()].filter((c) => c.requiresSource).map((c) => c.id).sort()).toEqual(["charmed", "frightened", "grappled"]);
      for (const c of R.conditions.values()) { expect(c.description, c.id).not.toBe(""); }
      const g = R.conditions.get("grappled")!;
      expect(g.escape).toMatchObject({ action: true, check: [{ ability: "str", skill: "athletics" }, { ability: "dex", skill: "acrobatics" }] });
      expect(R.conditions.get("exhaustion")!.levels).toEqual({ min: 1, max: 6, deathAt: 6 });
    });
    it("Privo di sensi: include Incapacitato e Prono; Velocità 0; TS For/Des falliti; colpi critici entro 5 ft", () => {
      const d = run({ conditions: ["unconscious"] });
      expect(d.conditions.active.sort()).toEqual(["incapacitated", "prone", "unconscious"]);
      expect(d.speed.walk.value).toBe(0);
      expect(d.saves.str.autoFail.length + d.saves.dex.autoFail.length).toBe(2);
      expect(d.conditions.attacksAgainstYou.advantage).toContain("Privo di sensi");
      expect(d.conditions.attacksAgainstYou.autoCritical).toHaveLength(1);
      expect(d.conditions.attackRolls.mode).toBe("disadvantage"); // Prono: Svantaggio ai tuoi tiri per colpire
      expect(d.conditions.cannot).toEqual(expect.arrayContaining(["compiere azione", "parlare"]));
    });
    it("Pietrificato: include Incapacitato, immune ad Avvelenato, resistenza a tutti i danni", () => {
      const d = run({ conditions: ["petrified", "poisoned"] });
      expect(d.conditions.active).not.toContain("poisoned");
      expect(d.resistances).toContain("all");
      expect(d.conditions.active).toContain("incapacitated");
    });
    it("Trattenuto: Velocità 0, Svantaggio ai tuoi attacchi e ai TS Des", () => {
      const d = run({ conditions: ["restrained"] });
      expect(d.speed.walk.value).toBe(0);
      expect(d.conditions.attackRolls.mode).toBe("disadvantage");
      expect(d.saves.dex.mode).toBe("disadvantage");
      expect(d.saves.str.mode).toBe("normal");
    });
    it("Accecato: Vantaggio a chi ti attacca e Svantaggio ai tuoi; prove di vista fallite", () => {
      const d = run({ conditions: ["blinded"] });
      expect(d.conditions.attacksAgainstYou.advantage).toEqual(["Accecato"]);
      expect(d.conditions.attackRolls.mode).toBe("disadvantage");
      expect(d.conditions.autoFailChecks[0]).toMatch(/vista/);
      expect(d.conditions.cannot).toContain("vedere");
    });
    it("Afferrato e Spaventato: fonte tracciata, effetti situazionali in testo", () => {
      const d = run({ conditions: ["grappled", "frightened"], conditionSources: { grappled: "Ogre", frightened: "Lich" } });
      expect(d.speed.walk.value).toBe(0);
      expect(d.conditions.situational.join(" ")).toMatch(/Ogre/);
      expect(d.conditions.situational.join(" ")).toMatch(/Lich/);
      expect(d.conditions.attackRolls.mode).toBe("normal"); // Svantaggio solo se non attacchi chi ti afferra / fonte in vista
    });
    it("Prono e Invisibile: gli effetti che dipendono dalla distanza o da chi ti vede restano testo", () => {
      const p = run({ conditions: ["prone"] });
      expect(p.conditions.attackRolls.mode).toBe("disadvantage");
      expect(p.conditions.attacksAgainstYou.advantage).toEqual([]); // dipende dalla distanza
      expect(p.conditions.situational.length).toBeGreaterThan(0);
      const i = run({ conditions: ["invisible"] });
      expect(i.conditions.initiativeMode.mode).toBe("advantage");
    });
    it("Esaurimento 1-6 con i dati veri", () => {
      const at = (l: number) => run({ exhaustion: l });
      expect(at(0).speed.walk.value).toBe(30);
      expect([1, 2, 5].map((l) => at(l).speed.walk.value)).toEqual([25, 20, 5]);
      expect(at(2).skills.acrobatics.bonus.value - at(0).skills.acrobatics.bonus.value).toBe(-4);
      expect(at(5).conditions.dead).toBe(false);
      expect(at(6).conditions.dead).toBe(true);
    });
    it("Avvelenato e Assordato: Svantaggio alle prove, prove di udito fallite", () => {
      const d = run({ conditions: ["poisoned", "deafened"] });
      expect(d.skills.perception.mode).toBe("disadvantage");
      expect(d.conditions.autoFailChecks.join()).toMatch(/udito/);
    });
  });

  describe("incantesimi", () => {
    const R = fullRuleset();
    const cls = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });
    const mk = (classes: ReturnType<typeof cls>[], over: object = {}) => testCharacter({ classes, ...over });
    const slots = (ch: ReturnType<typeof mk>) => computeCharacter(ch, R).spellSlots;

    it("339 incantesimi: 27 trucchetti, 57 di 1°... 16 di 9°; 133 a Concentrazione, 29 rituali", () => {
      const by = (l: number) => [...R.spells.values()].filter((x) => x.level === l).length;
      expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(by)).toEqual([27, 57, 57, 42, 34, 38, 31, 20, 17, 16]);
      expect([...R.spells.values()].filter((x) => x.concentration)).toHaveLength(133);
      expect([...R.spells.values()].filter((x) => x.ritual)).toHaveLength(29);
    });
    it("liste per classe (Paladino e Ranger senza trucchetti)", () => {
      const n = (c: string, lv?: number) => [...R.spells.values()].filter((x) => x.classes.includes(c as never) && (lv === undefined || x.level === lv)).length;
      expect(["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"].map((c) => n(c))).toEqual([130, 109, 124, 38, 48, 140, 72, 218]);
      expect([n("paladin", 0), n("ranger", 0), n("wizard", 0)]).toEqual([0, 0, 15]);
    });
    it("schede: Palla di fuoco, Identificare (costo), Scudo (reazione), Revivificare", () => {
      const f = R.spells.get("fireball")!;
      expect([f.level, f.school, f.resolution, f.castingTime.unit, f.range]).toEqual([3, "evocation", "save_dex", "action", "45 metri"]);
      expect(f.name.it).toBe("Palla di fuoco");
      expect(R.spells.get("identify")!).toMatchObject({ ritual: true, castingTime: { unit: "minute", amount: 1 }, components: { materialCost: 100, materialConsumed: false } });
      expect(R.spells.get("shield")!.castingTime).toMatchObject({ unit: "reaction", trigger: expect.stringContaining("colpito") });
      expect(R.spells.get("revivify")!.components).toMatchObject({ materialCost: 300, materialConsumed: true });
      expect(R.spells.get("chill_touch")!).toMatchObject({ level: 0, resolution: "attack_melee" });
      expect(R.spells.get("acid_splash")!.higherLevels).toMatch(/2d6/);
    });
    it("ogni incantesimo concesso dai dati esiste, con il modo giusto (trucchetto solo al livello 0)", () => {
      expect(checkReferences(R)).toEqual([]);
      const sub = R.subclasses.get("land")!.features.find((f) => f.id === "circle_of_the_land_spells")!.choices[0]!.options![0]!.effects.filter((e) => e.op === "grantSpell");
      expect(sub.find((e) => e.op === "grantSpell" && e.spell === "fire_bolt")).toMatchObject({ mode: "cantrip" });
      expect(sub.find((e) => e.op === "grantSpell" && e.spell === "blur")).toMatchObject({ mode: "alwaysPrepared" });
    });
    it("lignaggi della specie: trucchetti a volontà, incantesimi di 1°+ con lancio gratuito", () => {
      const sp = (species: string, dec: object) => computeCharacter(mk([cls("fighter", 5)], { speciesId: species, decisions: dec }), R).grantedSpells;
      const gnome = sp("gnome", { gnomish_lineage: ["forest_gnome"], spell_ability: ["int"] });
      expect(gnome.find((x) => x.spell === "minor_illusion")).toMatchObject({ mode: "cantrip" });
      expect(gnome.find((x) => x.spell === "speak_with_animals")).toMatchObject({ mode: "alwaysPrepared" });
      const inf = sp("tiefling", { fiendish_legacy: ["infernal"], spell_ability: ["cha"] });
      expect(inf.find((x) => x.spell === "fire_bolt")).toMatchObject({ mode: "cantrip" });
      expect(inf.find((x) => x.spell === "fire_bolt")!.freeCast).toBeUndefined();
      expect(inf.find((x) => x.spell === "hellish_rebuke")).toMatchObject({ mode: "alwaysPrepared", freeCast: { recharge: "long_rest" } });
    });
    it("candidati delle scelte: liste di classe, Iniziato alla magia", () => {
      const choice = (featId: string, id: string) => R.feats.get(featId)!.choices.find((c) => c.id === id)!;
      const ids = (l: { id: string }[]) => l.map((x) => x.id);
      const cant = spellChoiceCandidates(R, R.classes.get("bard")!.choices.find((c) => c.id === "bard_cantrips")!);
      expect(cant).toHaveLength(10);
      expect(cant.every((x) => x.level === 0 && x.classes.includes("bard"))).toBe(true);
      expect(spellChoiceCandidates(R, choice("magic_initiate", "magic_initiate_cantrips"), {})).toEqual([]); // lista non ancora scelta
      const cl = spellChoiceCandidates(R, choice("magic_initiate", "magic_initiate_cantrips"), { magic_initiate_list: ["cleric"] });
      expect(ids(cl)).toContain("guidance");
      expect(ids(cl)).not.toContain("fire_bolt");
    });
    it("slot con una sola classe: tabella della classe", () => {
      expect(slots(mk([cls("cleric", 5)]))).toMatchObject({ slots: [4, 3, 2], casterLevel: 5 });
      expect(slots(mk([cls("paladin", 5)])).slots).toEqual([4, 2]);
      expect(slots(mk([cls("fighter", 3)])).slots).toEqual([]);
      expect(slots(mk([cls("barbarian", 20)]))).toMatchObject({ slots: [], casterLevel: 0 });
    });
    it("slot in multiclasse: livello combinato e tabella dell'incantatore completo", () => {
      expect(slots(mk([cls("wizard", 3), cls("cleric", 2)]))).toMatchObject({ casterLevel: 5, slots: [4, 3, 2] });
      expect(slots(mk([cls("paladin", 4), cls("ranger", 3)]))).toMatchObject({ casterLevel: 4, slots: [4, 3] }); // 2 + 2 (metà, per eccesso)
      expect(slots(mk([cls("wizard", 20), cls("bard", 1)])).slots).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]); // 21 → tetto 20
    });
    it("slot del patto separati dal resto; slot spesi", () => {
      expect(slots(mk([cls("warlock", 11)]))).toMatchObject({ slots: [], pact: { count: 3, level: 5 } });
      const both = slots(mk([cls("wizard", 5), cls("warlock", 3)]));
      expect(both).toMatchObject({ slots: [4, 3, 2], pact: { count: 2, level: 2 } });
      const spent = computeCharacter(mk([cls("wizard", 5)], { state: { ...testCharacter().state, slotsUsed: { 1: 2, 3: 5 } } }), R).spellSlots;
      expect(spent.used).toEqual([2, 0, 2]); // non si spendono più slot di quanti ce ne sono
      expect(spent.remaining).toEqual([2, 3, 0]);
    });
    it("tabelle degli slot del multiclasse presenti e coerenti con le classi", () => {
      const full = R.slotTables.get("full_caster")!.slots;
      for (const id of ["wizard", "bard", "cleric", "druid", "sorcerer"]) expect(R.classes.get(id)!.spellSlots, id).toEqual(full);
      const half = R.slotTables.get("half_caster")!.slots;
      for (const id of ["paladin", "ranger"]) expect(R.classes.get(id)!.spellSlots, id).toEqual(half);
    });
  });

  describe("equipaggiamento e attacchi con i dati SRD", () => {
    const R = fullRuleset();
    const cls = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });
    const inv = (...e: [string, "wielded" | "worn" | "stowed", object?][]) => e.map(([itemId, state, x]) => ({ itemId, qty: 1, state, ...(x ?? {}) }));
    const sc = (o: object) => ({ baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...o } });
    const run = (classes: ReturnType<typeof cls>[], over: object = {}) => computeCharacter(testCharacter({ classes, ...over }), R);
    const atk = (d: ReturnType<typeof run>, label: string) => d.attacks.find((a) => a.label === label)!;

    it("Guerriero con Spadone: Pesante, 2d6 + For, maestria Colpo di striscio solo se scelta", () => {
      const inventory = inv(["greatsword", "wielded"]);
      const base = sc({ str: 16 });
      const m = atk(run([cls("fighter", 1)], { ...base, inventory, decisions: { fighter_weapon_mastery: ["greatsword"] } }), "Spadone");
      expect([m.hands, m.damage.dice, m.damage.bonus.value, m.toHit.value]).toEqual([2, "2d6", 3, 5]);
      expect(m.mastery).toMatchObject({ id: "graze", active: true });
      const n = atk(run([cls("fighter", 1)], { ...base, inventory }), "Spadone");
      expect(n.mastery).toMatchObject({ id: "graze", active: false });
      expect(atk(run([cls("fighter", 1)], { ...sc({ str: 12 }), inventory }), "Spadone").mode).toBe("disadvantage"); // Pesante: serve For 13
    });
    it("Rovesciare: CD = 8 + modificatore + competenza", () => {
      const a = atk(run([cls("fighter", 1)], { ...sc({ str: 16 }), inventory: inv(["warhammer", "wielded"]), decisions: { fighter_weapon_mastery: ["warhammer"] } }), "Martello da guerra");
      expect(a.mastery).toBeTruthy();
      const b = atk(run([cls("fighter", 1)], { ...sc({ str: 16 }), inventory: inv(["battleaxe", "wielded"]), decisions: { fighter_weapon_mastery: ["battleaxe"] } }), "Ascia da battaglia");
      expect(b.mastery).toMatchObject({ id: "topple", active: true, dc: 8 + 3 + 2 });
    });
    it("Stili di combattimento SRD: Tiro con l'arco, Difesa, Combattere con armi possenti", () => {
      const style = (id: string) => ({ decisions: { fighter_fighting_style: [id] }, feats: [{ featId: id }] });
      const b = sc({ str: 16, dex: 14 });
      expect(atk(run([cls("fighter", 1)], { ...b, ...style("archery"), inventory: inv(["longbow", "wielded"]) }), "Arco lungo").toHit.value).toBe(2 + 2 + 2);
      expect(atk(run([cls("fighter", 1)], { ...b, inventory: inv(["longbow", "wielded"]) }), "Arco lungo").toHit.value).toBe(2 + 2);
      const armor = inv(["chain_mail", "worn"]);
      expect(run([cls("fighter", 1)], { ...b, ...style("defense"), inventory: armor }).ac.value).toBe(17);
      expect(run([cls("fighter", 1)], { ...b, inventory: armor }).ac.value).toBe(16);
    });
    it("Arco lungo: Des, gittata 150/600, Frecce dall'inventario", () => {
      const a = atk(run([cls("fighter", 1)], { ...sc({ dex: 16 }), inventory: [...inv(["longbow", "wielded"]), { itemId: "arrows", qty: 3, state: "stowed" }] }), "Arco lungo");
      expect([a.ability, a.range, a.ammo?.itemId]).toEqual(["dex", { normal: 150, long: 600 }, "arrows"]);
    });
    it("Attacco extra: Guerriero 2/3/4 attacchi, Barbaro al 5°", () => {
      const n = (c: string, l: number) => run([cls(c, l)]).attacksPerAction;
      expect([n("fighter", 1), n("fighter", 5), n("fighter", 11), n("fighter", 20), n("barbarian", 4), n("barbarian", 5)]).toEqual([1, 2, 3, 4, 1, 2]);
    });
    it("Campione: critico 19-20 dal 3° e 18-20 dal 15°", () => {
      const c = (l: number) => atk(run([cls("fighter", l, { subclassId: "champion" })], { inventory: inv(["longsword", "wielded"]) }), "Spada lunga").critRange;
      expect([c(2), c(3), c(15)]).toEqual([20, 19, 18]);
    });
    it("Monaco: Arti marziali (Des, dado per livello) solo senza armatura né scudo", () => {
      const b = sc({ str: 10, dex: 16 });
      const u = (l: number, inv2: object[] = []) => atk(run([cls("monk", l)], { ...b, inventory: inv2 }), "Colpo senz'armi");
      expect([u(1).damage.dice, u(5).damage.dice, u(11).damage.dice, u(17).damage.dice]).toEqual(["1d6", "1d8", "1d10", "1d12"]);
      expect([u(1).ability, u(1).abilityWhy, u(1).damage.bonus.value]).toEqual(["dex", "Arti marziali", 3]);
      const armored = u(5, inv(["studded_leather_armor", "worn"]));
      expect([armored.ability, armored.damage.dice]).toEqual(["str", "1"]); // armatura: niente Arti marziali
      const w = atk(run([cls("monk", 1)], { ...b, inventory: inv(["shortsword", "wielded"]) }), "Spada corta");
      expect([w.ability, w.abilityWhy]).toEqual(["dex", "Accurata"]);
      const club = atk(run([cls("monk", 1)], { ...sc({ str: 10, dex: 16 }), inventory: inv(["mace", "wielded"]) }), "Mazza"); // arma da Monaco
      expect([club.ability, club.abilityWhy, club.proficient]).toEqual(["dex", "Arti marziali", true]);
      const greatsword = atk(run([cls("monk", 1)], { ...b, inventory: inv(["greatsword", "wielded"]) }), "Spadone"); // né semplice né Leggera
      expect([greatsword.ability, greatsword.proficient]).toEqual(["str", false]);
    });
    it("Ladro: Attacco furtivo con arma Accurata o a distanza; competenza nelle armi marziali Accurate o Leggere", () => {
      const r = (w: string) => atk(run([cls("rogue", 5)], { ...sc({ dex: 16 }), inventory: inv([w, "wielded"]) }), R.weapons.get(w)!.name.it);
      expect(r("rapier").riders[0]).toMatch(/Attacco furtivo 3d6/);
      expect(r("rapier").proficient).toBe(true);
      expect(r("shortbow").riders[0]).toMatch(/3d6/);
      expect(r("longsword").riders).toEqual([]);
      expect(r("longsword").proficient).toBe(false); // marziale non Accurata né Leggera
    });
    it("Warlock del Patto della Lama: l'arma del patto usa Carisma", () => {
      const ch = { ...sc({ str: 8, cha: 16 }), inventory: inv(["longsword", "wielded"]), pactWeapon: "longsword", decisions: { warlock_invocations: ["pact_of_the_blade"] } };
      const a = atk(run([cls("warlock", 3)], ch), "Spada lunga");
      expect([a.ability, a.abilityWhy]).toEqual(["cha", "arma del patto"]);
      expect(atk(run([cls("warlock", 3)], { ...ch, pactWeapon: undefined }), "Spada lunga").ability).toBe("str");
    });
    it("tempi con i dati veri: Cotta di maglia 10 minuti, Scudo 1 azione, sintonia e peso", () => {
      const ch = testCharacter({ classes: [cls("fighter", 1)], inventory: inv(["chain_mail", "stowed"], ["shield", "stowed"]) });
      const r = equipItem(ch, R, "chain_mail", "worn");
      expect(r.time.minutes).toBe(10);
      expect(equipItem(r.character, R, "shield", "worn").time.action).toBe(true);
      const d = computeCharacter(equipItem(equipItem(ch, R, "chain_mail", "worn").character, R, "shield", "worn").character, R);
      expect(d.ac.value).toBe(18);
      expect(d.loadout.weight).toBe(55 + 6);
    });
  });
});

