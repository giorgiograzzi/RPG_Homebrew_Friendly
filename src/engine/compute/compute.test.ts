import { describe, expect, it } from "vitest";
import { computeCharacter } from "./index";
import { combineMode } from "./rolls";
import { casterLevelOf } from "./slots";
import { spellChoiceCandidates, spellsMatching } from "../spells";
import { evalValue } from "./formula-eval";
import { testCharacter, testRuleset } from "./testkit";
import type { Character } from "../types";

const rs = testRuleset();
// Fighter 1 con background +2 For, +1 Cos → For 17 (+3), Des 14 (+2), Cos 14 (+2)
const asiStd = [{ source: "Background", ability: "str" as const, amount: 2 }, { source: "Background", ability: "con" as const, amount: 1 }];
const mk = (o: Partial<Character> = {}) => computeCharacter(testCharacter({ asi: asiStd, ...o }), rs);
const worn = (...ids: string[]) => ids.map((itemId) => ({ itemId, qty: 1, state: "worn" as const }));
const lv = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });

it("i dati di prova sono validi", () => expect(rs.errors).toEqual([]));

describe("caratteristiche e competenza", () => {
  it("aumenti del background e modificatori con fonti", () => {
    const d = mk();
    expect(d.scores.str.value).toBe(17);
    expect(d.scores.str.sources.map((s) => s.label)).toEqual(["Base", "Background"]);
    expect([d.mods.str.value, d.mods.dex.value, d.mods.con.value, d.mods.int.value]).toEqual([3, 2, 2, -1]);
  });
  it("tetto 20, sforabile solo con effetti (Dono epico → 30)", () => {
    const base = { baseScores: { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
    expect(mk({ ...base }).scores.str.value).toBe(20);
    expect(mk({ ...base, feats: [{ featId: "epic_boon" }] }).scores.str.value).toBe(23);
  });
  it.each([[1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6]])(
    "livello %i → competenza +%i", (l, pb) => {
      expect(mk({ classes: [lv("fighter", l)] }).proficiencyBonus.value).toBe(pb);
    });
  it("il bonus dipende dal livello TOTALE (multiclasse)", () => {
    expect(mk({ classes: [lv("fighter", 3), lv("wizard", 2)] }).proficiencyBonus.value).toBe(3);
  });
});

describe("tiri salvezza e abilità", () => {
  it("TS: competenti solo quelli della prima classe", () => {
    const d = mk({ classes: [lv("fighter", 1), lv("wizard", 1)] });
    expect(d.saves.str.bonus.value).toBe(5); // 3 + 2
    expect(d.saves.int.bonus.value).toBe(-1); // niente TS del mago in multiclasse
    expect(d.saves.dex.bonus.value).toBe(2);
  });
  it("abilità: background + scelte, maestria = doppio, Factotum = metà", () => {
    const d = mk({ decisions: { fighter_skills: ["perception"], fighter_expertise: ["athletics"] } });
    expect(d.skills.intimidation.bonus.value).toBe(3); // background: Car +1, competenza +2
    expect(d.skills.perception.bonus.value).toBe(2); // scelta di classe: Sag +0, competenza +2
    expect(d.skills.athletics.proficiency).toBe("expertise");
    expect(d.skills.athletics.bonus.value).toBe(3 + 4); // For +3, competenza doppia
    expect(d.skills.acrobatics.bonus.value).toBe(2); // solo Des
  });
  it("Factotum del Bardo", () => {
    const d = mk({ classes: [lv("bard", 2)] });
    expect(d.skills.stealth.proficiency).toBe("half");
    expect(d.skills.stealth.bonus.value).toBe(2 + 1);
  });
  it("iniziativa con Allerta = Des + competenza", () => {
    expect(mk().initiative.value).toBe(2);
    expect(mk({ feats: [{ featId: "alert" }] }).initiative.value).toBe(4);
  });
  it("percezione passiva = 10 + mod; ±5 con vantaggio/svantaggio", () => {
    expect(mk().passivePerception.value).toBe(10);
    expect(mk({ decisions: { fighter_skills: ["perception"] } }).passivePerception.value).toBe(12);
  });
});

describe("Punti Ferita", () => {
  it("1° livello: dado massimo + Cos", () => expect(mk().hp.max.value).toBe(12));
  it("livelli successivi: media (d10 = 6) + Cos", () => {
    expect(mk({ classes: [lv("fighter", 3)] }).hp.max.value).toBe(10 + 12 + 6);
  });
  it("tiri veri e minimo 1 per livello con Cos negativa", () => {
    const rolls = { classes: [lv("fighter", 3, { hpRolls: [0, 8, 1] })] };
    expect(mk({ ...rolls }).hp.max.value).toBe(10 + 8 + 1 + 6);
    const neg = mk({ classes: [lv("fighter", 2, { hpRolls: [0, 1] })], baseScores: { str: 10, dex: 10, con: 6, int: 10, wis: 10, cha: 10 }, asi: [] });
    expect(neg.hp.max.value).toBe(10 - 2 + 1); // liv.2 vale 1, non -1
  });
  it("multiclasse: la seconda classe usa la media, mai il massimo", () => {
    const d = mk({ classes: [lv("fighter", 1), lv("wizard", 1)] });
    expect(d.hp.max.value).toBe(10 + 4 + 2 * 2);
    expect(d.hp.hitDice).toEqual([{ die: 6, total: 1 }, { die: 10, total: 1 }]);
  });
  it("Cos retroattiva su tutti i livelli", () => {
    const a = mk({ classes: [lv("fighter", 4)] });
    const b = mk({ classes: [lv("fighter", 4)], asi: [...asiStd, { source: "Liv.4", ability: "con", amount: 2 }] });
    expect(b.hp.max.value - a.hp.max.value).toBe(4);
  });
  it("bonus per livello: Nano, Robusto, Stregone draconico (solo livelli da Stregone)", () => {
    const base = mk({ classes: [lv("fighter", 3)] }).hp.max.value;
    expect(mk({ classes: [lv("fighter", 3)], speciesId: "dwarf" }).hp.max.value).toBe(base + 3);
    expect(mk({ classes: [lv("fighter", 3)], feats: [{ featId: "tough" }] }).hp.max.value).toBe(base + 6);
    const s = mk({ classes: [lv("sorcerer", 2), lv("fighter", 2)] }).hp.max;
    const s0 = mk({ classes: [lv("wizard", 2), lv("fighter", 2)] }).hp.max;
    expect(s.value - s0.value).toBe(2); // +1 per ciascuno dei 2 livelli da Stregone
  });
  it("Dadi Vita rimasti", () => {
    const d = mk({ classes: [lv("fighter", 3)], state: { ...testCharacter().state, hitDiceUsed: 2 } });
    expect(d.hp.hitDiceRemaining).toBe(1);
  });
});

describe("Classe Armatura", () => {
  it("senza armatura 10 + Des; leggera; media con tetto Des; pesante fissa", () => {
    expect(mk().ac.value).toBe(12);
    expect(mk({ inventory: worn("leather") }).ac.value).toBe(13);
    expect(mk({ inventory: worn("scale_mail") }).ac.value).toBe(16);
    expect(mk({ inventory: worn("chain_mail") }).ac.value).toBe(16);
  });
  it("scudo +2 (18 = Cotta di maglia 16 + Scudo 2)", () => {
    const d = mk({ inventory: worn("chain_mail", "shield") });
    expect(d.ac.value).toBe(18);
    expect(d.ac.sources.map((s) => s.label)).toContain("shield");
  });
  it("Des alta: tetto 2 sulle medie, 3 con Maestro delle armature medie (Des 16+)", () => {
    const b = { baseScores: { str: 15, dex: 16, con: 13, int: 8, wis: 10, cha: 12 } };
    expect(mk({ ...b, inventory: worn("half_plate") }).ac.value).toBe(17);
    expect(mk({ ...b, inventory: worn("half_plate"), feats: [{ featId: "medium_armor_master" }] }).ac.value).toBe(18);
  });
  it("Stile Difesa +1 solo con armatura", () => {
    const f = [{ featId: "defense" }];
    expect(mk({ feats: f }).ac.value).toBe(12);
    expect(mk({ feats: f, inventory: worn("chain_mail") }).ac.value).toBe(17);
  });
  it("Barbaro: 10 + Des + Cos (scudo ammesso), la migliore formula, una sola", () => {
    const d = mk({ classes: [lv("barbarian", 1)] });
    expect(d.ac.value).toBe(14);
    expect(d.ac.formula).toContain("barbarian");
    expect(mk({ classes: [lv("barbarian", 1)], inventory: worn("shield") }).ac.value).toBe(16);
    // con armatura la formula del Barbaro non si applica
    expect(mk({ classes: [lv("barbarian", 1)], inventory: worn("leather") }).ac.value).toBe(13);
  });
  it("Monaco: 10 + Des + Sag, ma lo scudo la disattiva", () => {
    const b = { baseScores: { str: 10, dex: 14, con: 10, int: 10, wis: 14, cha: 10 }, asi: [] };
    expect(mk({ ...b, classes: [lv("monk", 1)] }).ac.value).toBe(14);
    // con scudo resta solo 10 + Des (senza addestramento nello scudo per il Monaco)
    expect(mk({ ...b, classes: [lv("monk", 1)], inventory: worn("shield") }).ac.value).toBe(12);
  });
  it("armatura senza addestramento: AC sì, ma svantaggio For/Des, niente incantesimi, avviso", () => {
    const d = mk({ classes: [lv("wizard", 1)], inventory: worn("chain_mail", "shield") });
    expect(d.ac.value).toBe(16); // scudo senza addestramento: nessun bonus
    expect(d.saves.str.mode).toBe("disadvantage");
    expect(d.saves.dex.mode).toBe("disadvantage");
    expect(d.skills.athletics.mode).toBe("disadvantage");
    expect(d.spellcastingBlocked).toBe(true);
    expect(d.warnings.length).toBe(2);
  });
  it("valore forzato a mano, visibile nelle fonti", () => {
    const d = mk({ overrides: { ac: 20 } });
    expect(d.ac.value).toBe(20);
    expect(d.ac.sources[0]!.label).toMatch(/forzato/);
  });
});

describe("velocità, sensi, resistenze", () => {
  it("base di specie e tratti sbloccati dal livello TOTALE", () => {
    expect(mk().speed.walk.value).toBe(30);
    expect(mk({ speciesId: "goliath" }).speed.walk.value).toBe(35);
    expect(mk({ speciesId: "goliath", classes: [lv("fighter", 3), lv("wizard", 2)] }).speed.walk.value).toBe(45);
    expect(mk({ speciesId: "goliath", classes: [lv("fighter", 4)] }).speed.walk.value).toBe(35);
  });
  it("Barbaro 5: +10 senza armatura pesante; Rapido +10", () => {
    const b = { classes: [lv("barbarian", 5)] };
    expect(mk(b).speed.walk.value).toBe(40);
    expect(mk({ ...b, inventory: worn("plate") }).speed.walk.value).toBe(30);
    expect(mk({ ...b, feats: [{ featId: "fleet" }] }).speed.walk.value).toBe(50);
  });
  it("armatura pesante con Forza insufficiente: -10", () => {
    const b = { baseScores: { str: 12, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, asi: [] };
    expect(mk({ ...b, inventory: worn("plate") }).speed.walk.value).toBe(20);
    expect(mk({ ...b, inventory: worn("chain_mail") }).speed.walk.value).toBe(20); // richiede For 13
    expect(mk({ ...b, baseScores: { ...b.baseScores, str: 13 }, inventory: worn("chain_mail") }).speed.walk.value).toBe(30);
  });
  it("sensi al valore maggiore, resistenze unite", () => {
    const d = mk({ speciesId: "dwarf" });
    expect(d.senses.darkvision?.value).toBe(120);
    expect(d.resistances).toEqual(["poison"]);
  });
});

describe("vantaggio/svantaggio, risorse, incantesimi", () => {
  it("si annullano se presenti entrambi", () => {
    expect(combineMode(["a"], []).mode).toBe("advantage");
    expect(combineMode([], ["b"]).mode).toBe("disadvantage");
    expect(combineMode(["a"], ["b"]).mode).toBe("normal");
    const d = mk({ classes: [lv("wizard", 1)], inventory: worn("chain_mail"), feats: [{ featId: "steady" }] });
    expect(d.saves.str.mode).toBe("normal"); // vantaggio TS For + svantaggio armatura
    expect(d.notes.join()).toMatch(/contro charmed/);
  });
  it("Furtività: svantaggio dall'armatura", () => {
    expect(mk({ inventory: worn("scale_mail") }).skills.stealth.mode).toBe("disadvantage");
  });
  it("risorse: tabella per livello di classe, usi rimasti", () => {
    const d = mk({ state: { ...testCharacter().state, resourcesUsed: { second_wind: 1 } } });
    expect(d.resources.second_wind).toMatchObject({ used: 1, remaining: 1, recharge: "short_rest" });
  });
  it("CD e attacco degli incantesimi: 8 + mod + competenza", () => {
    const d = mk({ classes: [lv("wizard", 1)], baseScores: { str: 10, dex: 10, con: 10, int: 15, wis: 10, cha: 10 }, asi: [] });
    expect(d.spellcasting[0]!.dc.value).toBe(12);
    expect(d.spellcasting[0]!.attack.value).toBe(4);
  });
  it("capacità di carico = Forza × 15", () => expect(mk().carryCapacity).toBe(255));
});

describe("scelte con source e tetto dei Doni epici", () => {
  it("skillsTools: abilità e strumenti in qualsiasi combinazione", () => {
    const rs2 = testRuleset();
    rs2.feats.set("skilled", { id: "skilled", name: { it: "Esperto" }, description: "", origin: "private", needsReview: false,
      effects: [], category: "origin", prerequisites: [], repeatable: true,
      choices: [{ id: "skilled_picks", label: { it: "3" }, count: 3, source: "skillsTools", distinct: true }] });
    const d = computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "skilled" }], decisions: { skilled_picks: ["stealth", "thieves_tools", "arcana"] } }), rs2);
    expect(d.skills.stealth.proficiency).toBe("proficient");
    expect(d.skills.arcana.proficiency).toBe("proficient");
    expect(d.proficiencies.tools).toContain("thieves_tools");
  });
  it("freespells: incantesimo sempre preparato con lancio gratuito", () => {
    const rs2 = testRuleset();
    rs2.feats.set("mi", { id: "mi", name: { it: "MI" }, description: "", origin: "private", needsReview: false, effects: [],
      category: "origin", prerequisites: [], repeatable: true,
      choices: [{ id: "mi_spell", label: { it: "1" }, count: 1, source: "freespells", distinct: true }] });
    const d = computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "mi" }], decisions: { mi_spell: ["shield_spell"] } }), rs2);
    expect(d.features).toBeDefined(); // il calcolo non si rompe con incantesimi non ancora in ruleset
  });
  it("aumenti di un Dono epico arrivano a 30, gli altri restano a 20", () => {
    const b = { baseScores: { str: 20, dex: 20, con: 10, int: 10, wis: 10, cha: 10 } };
    const d = mk({ ...b, asi: [{ source: "Dono", ability: "str", amount: 1, cap: 30 }, { source: "ASI", ability: "dex", amount: 1 }] });
    expect([d.scores.str.value, d.scores.dex.value]).toEqual([21, 20]);
  });
  it("tool di background a gruppo non finisce tra le competenze", () => {
    const rs2 = testRuleset();
    const bg = rs2.backgrounds.get("soldier")!;
    rs2.backgrounds.set("soldier", { ...bg, tool: "gaming" });
    expect(computeCharacter(testCharacter({ asi: asiStd }), rs2).proficiencies.tools).not.toContain("gaming");
  });
});

describe("meccanismi nuovi (senza dati privati)", () => {
  const fx = (over: object) => ({ id: "t", name: { it: "T" }, description: "", origin: "private", needsReview: false, category: "general", prerequisites: [], repeatable: false, effects: [], choices: [], ...over }) as never;
  it("upgradeToExpertise: competenza, o Maestria se già competente", () => {
    const rs2 = testRuleset();
    rs2.feats.set("km", fx({ id: "km", effects: [
      { op: "grantSkillProficiency", skills: ["athletics"], expertise: false, upgradeToExpertise: true },
      { op: "grantSkillProficiency", skills: ["arcana"], expertise: false, upgradeToExpertise: true }] }));
    const d = computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "km" }] }), rs2); // Atletica dal background
    expect([d.skills.athletics.proficiency, d.skills.arcana.proficiency]).toEqual(["expertise", "proficient"]);
  });
  it("senso additivo: si somma a quello che hai già", () => {
    const rs2 = testRuleset();
    rs2.feats.set("dv", fx({ id: "dv", effects: [{ op: "sense", kind: "darkvision", range: 60, additive: true }] }));
    expect(computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "dv" }] }), rs2).senses.darkvision?.value).toBe(60);
    expect(computeCharacter(testCharacter({ asi: asiStd, speciesId: "dwarf", feats: [{ featId: "dv" }] }), rs2).senses.darkvision?.value).toBe(180);
  });
  it("grantSpell con abilityFrom: la caratteristica arriva dalla scelta; CD e attacco calcolati", () => {
    const rs2 = testRuleset();
    rs2.feats.set("sp", fx({ id: "sp", effects: [{ op: "grantSpell", spell: "light", mode: "cantrip", abilityFrom: "sp_ab" }],
      choices: [{ id: "sp_ab", label: { it: "C" }, count: 1, distinct: true, options: [{ id: "wis", name: { it: "Sag" }, effects: [] }] }] }));
    const ch = testCharacter({ asi: asiStd, baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, feats: [{ featId: "sp", choices: { sp_ab: ["wis"] } }] });
    expect(computeCharacter(ch, rs2).grantedSpells[0]).toMatchObject({ spell: "light", ability: "wis", dc: 8 + 3 + 2, attack: 5 });
    expect(computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "sp" }] }), rs2).grantedSpells[0]!.ability).toBeUndefined();
  });
  it("talento ripetibile: scelte separate per acquisizione; non ripetibile non si duplica", () => {
    const rs2 = testRuleset();
    rs2.feats.set("rs", fx({ id: "rs", repeatable: true, choices: [{ id: "rs_c", label: { it: "S" }, count: 1, distinct: true,
      options: ["str", "dex"].map((a) => ({ id: a, name: { it: a }, effects: [{ op: "grantSaveProficiency", abilities: [a] }] })) }] }));
    const d = computeCharacter(testCharacter({ asi: asiStd, classes: [{ classId: "wizard", level: 1, hpRolls: [] }],
      feats: [{ featId: "rs", choices: { rs_c: ["str"] } }, { featId: "rs", choices: { rs_c: ["dex"] } }] }), rs2);
    expect(d.saves.str.proficient && d.saves.dex.proficient).toBe(true);
    const one = computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "alert" }, { featId: "alert" }] }), rs2).initiative.value;
    expect(one).toBe(2 + 2); // Des +2, Allerta una sola volta
  });
});

describe("condizioni", () => {
  const withState = (over: object) => testCharacter({ asi: asiStd, state: { ...testCharacter().state, ...over } });
  const run = (over: object) => computeCharacter(withState(over), rs);

  it("Paralizzato include Incapacitato (ricorsivo, senza duplicati) e azzera velocità, TS For/Des, azioni", () => {
    const d = run({ conditions: ["paralyzed", "incapacitated", "paralyzed"] });
    expect(d.conditions.active.sort()).toEqual(["incapacitated", "paralyzed"]);
    expect(d.speed.walk.value).toBe(0);
    expect(d.saves.str.autoFail).toEqual(["Paralizzato"]);
    expect(d.saves.dex.autoFail).toHaveLength(1);
    expect(d.saves.wis.autoFail).toEqual([]);
    expect(d.conditions.cannot).toEqual(expect.arrayContaining(["compiere azione", "compiere reazione", "parlare", "concentrarsi"]));
    expect(d.conditions.attacksAgainstYou.advantage).toEqual(["Paralizzato"]);
    expect(d.conditions.attacksAgainstYou.autoCritical[0]).toMatch(/entro 5 ft/);
    expect(d.spellcastingBlocked).toBe(true);
    expect(d.conditions.initiativeMode.mode).toBe("disadvantage");
  });
  it("Pietrificato: immune ad Avvelenato (la condizione cade), resistenza a tutti i danni", () => {
    const d = run({ conditions: ["petrified", "poisoned"] });
    expect(d.conditions.active).toEqual(expect.arrayContaining(["petrified", "incapacitated"]));
    expect(d.conditions.active).not.toContain("poisoned");
    expect(d.conditions.immune).toEqual(["poisoned"]);
    expect(d.resistances).toContain("all");
    expect(d.skills.athletics.mode).toBe("normal"); // niente Svantaggio da Avvelenato
  });
  it("Avvelenato: Svantaggio a tiri per colpire e prove; si annulla con un Vantaggio", () => {
    const d = run({ conditions: ["poisoned"] });
    expect(d.conditions.attackRolls).toEqual({ mode: "disadvantage", modeSources: ["Avvelenato"] });
    expect(d.skills.stealth.mode).toBe("disadvantage");
    expect(d.saves.dex.mode).toBe("normal"); // i TS non sono prove di caratteristica
    // Trattenuto: TS Des con Svantaggio, ma un Vantaggio dello stesso TS li annulla
    const rs2 = testRuleset();
    rs2.feats.set("adv", { id: "adv", name: { it: "V" }, description: "", origin: "private", needsReview: false, category: "general", prerequisites: [], repeatable: false, choices: [], effects: [{ op: "saveAdvantage", abilities: ["dex"] }] } as never);
    const both = computeCharacter(testCharacter({ asi: asiStd, feats: [{ featId: "adv" }], state: { ...testCharacter().state, conditions: ["restrained"] } }), rs2);
    expect(both.saves.dex.mode).toBe("normal");
    expect(computeCharacter(withState({ conditions: ["restrained"] }), rs).saves.dex.mode).toBe("disadvantage");
  });
  it("Esaurimento a livelli: -2 × livello ai Tiri D20, -5 ft × livello, 6 = morte", () => {
    const base = run({});
    const d = run({ exhaustion: 3 });
    expect(d.conditions.active).toEqual(["exhaustion"]);
    expect(d.skills.athletics.bonus.value).toBe(base.skills.athletics.bonus.value - 6);
    expect(d.saves.con.bonus.value).toBe(base.saves.con.bonus.value - 6);
    expect(d.initiative.value).toBe(base.initiative.value - 6);
    expect(d.speed.walk.value).toBe(30 - 15);
    expect(d.passivePerception.value).toBe(base.passivePerception.value); // non è un Tiro D20
    expect(d.conditions.dead).toBe(false);
    const dead = run({ exhaustion: 6 });
    expect(dead.conditions.dead).toBe(true);
    expect(dead.speed.walk.value).toBe(0);
    expect(run({ exhaustion: 9 }).conditions.exhaustion).toBe(6); // tetto al livello massimo
  });
  it("effetti che dipendono dalla fonte/situazione restano testo (Spaventato), con la fonte tracciata", () => {
    const d = run({ conditions: ["frightened"], conditionSources: { frightened: "Drago rosso" } });
    expect(d.conditions.attackRolls.mode).toBe("normal");
    expect(d.conditions.situational).toEqual(["Spaventato (da Drago rosso): Spaventato: riassunto"]);
    expect(d.skills.stealth.mode).toBe("normal");
  });
  it("Invisibile: Vantaggio all'Iniziativa; il resto (dipende da chi ti vede) è testo", () => {
    const d = run({ conditions: ["invisible"] });
    expect(d.conditions.initiativeMode.mode).toBe("advantage");
    expect(d.conditions.attackRolls.mode).toBe("normal");
    expect(d.conditions.situational).toHaveLength(1);
  });
  it("condizioni sconosciute si ignorano; senza dati non cambia nulla", () => {
    const d = run({ conditions: ["boh"] });
    expect(d.conditions.active).toEqual([]);
    expect(d.speed.walk.value).toBe(30);
  });
});

describe("incantesimi: filtri delle scelte e livello da incantatore", () => {
  const ids = (l: { id: string }[]) => l.map((x) => x.id).sort();
  it("filtro per livello, scuola, rituale e lista di classe", () => {
    expect(ids(spellsMatching(rs, { level: 1, schools: ["enchantment", "divination"] }))).toEqual(["charm", "omen"]);
    expect(ids(spellsMatching(rs, { level: 1, ritual: true }))).toEqual(["omen"]);
    expect(ids(spellsMatching(rs, { level: 0 }, {}, "wizard"))).toEqual(["spark"]);
    expect(ids(spellsMatching(rs, { classes: ["cleric", "bard"], level: 1 }))).toEqual(["charm", "omen", "ward"]);
  });
  it("classFrom: la lista arriva da un'altra scelta; senza scelta nessun risultato", () => {
    const f = { level: 1, classFrom: "list" };
    expect(spellsMatching(rs, f, {})).toEqual([]);
    expect(ids(spellsMatching(rs, f, { list: ["cleric"] }))).toEqual(["omen", "ward"]);
  });
  it("candidati di una scelta per sorgente", () => {
    const c = (source: string, filter?: object) => ({ id: "x", label: { it: "x" }, count: 1, distinct: true, source, ...(filter ? { filter } : {}) }) as never;
    expect(ids(spellChoiceCandidates(rs, c("cantrips:cleric")))).toEqual(["comfort"]);
    expect(ids(spellChoiceCandidates(rs, c("spells:wizard")))).toEqual(["bolt", "charm", "ward"]); // niente trucchetti
    expect(ids(spellChoiceCandidates(rs, c("freespells", { level: 1, schools: ["abjuration"] })))).toEqual(["ward"]);
    expect(spellChoiceCandidates(rs, c("skills"))).toEqual([]);
  });
  it("livello da incantatore combinato: pieno, metà per eccesso, un terzo per difetto", () => {
    expect([casterLevelOf("full", 5), casterLevelOf("half", 3), casterLevelOf("half", 4), casterLevelOf("third", 8), casterLevelOf("third", 9)]).toEqual([5, 2, 2, 2, 3]);
  });
});

describe("formule", () => {
  it("valutazione con arrotondamento per difetto", () => {
    const c = { pb: 3, level: 5, classLevels: {}, scores: { str: 8, dex: 10, con: 10, int: 10, wis: 8, cha: 10 } };
    expect(evalValue("max(1, mod:wis)", c)).toBe(1);
    expect(evalValue("pb / 2", c)).toBe(1);
    expect(evalValue("2 * level + mod:str", c)).toBe(9);
  });
});
