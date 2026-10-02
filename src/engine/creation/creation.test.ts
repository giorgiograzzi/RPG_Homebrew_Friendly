import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter } from "../compute/testkit";
import { loadSrd } from "../../data/srdIntegrity";
import type { Character } from "../types";
import {
  allQuestions, availableOptions, classOptions, creationProgress, fillHpRolls, previewDecision, recommendedArray, setAsi, setBaseScores,
  startingEquipment, validateDecisions, type Question,
} from "./index";

describe("motore di creazione con i dati SRD", () => {
  const R = loadSrd("it");
  const cls = (classId: string, level: number, extra: object = {}) => ({ classId, level, hpRolls: [], ...extra });
  const mk = (over: Partial<Character> = {}) => testCharacter({ classes: [cls("fighter", 1)], speciesId: "human", backgroundId: "soldier", ...over });
  const q = (ch: Character, key: string): Question => allQuestions(ch, R).find((x) => x.key === key)!;
  const opt = (ch: Character, key: string, id: string) => q(ch, key).options.find((o) => o.id === id)!;
  const ok = (ch: Character, key: string, picked: string[]) => { const r = previewDecision(ch, R, key, picked); expect(r.errors, `${key}: ${r.errors}`).toEqual([]); return r; };

  describe("opzioni attive e bloccate, con il motivo", () => {
    it("abilità già competenti (dal background) sono bloccate nelle scelte di classe", () => {
      const ch = mk({ backgroundId: "acolyte", classes: [cls("cleric", 1)] }); // Accolito: Intuizione, Religione
      expect(opt(ch, "cleric_skills", "insight")).toMatchObject({ enabled: false, disabledReason: "Già competente" });
      expect(opt(ch, "cleric_skills", "medicine").enabled).toBe(true);
    });
    it("due scelte di abilità in conflitto: la seconda perde", () => {
      const ch = mk({ backgroundId: "acolyte", classes: [cls("cleric", 1)], speciesId: "elf" });
      const a = ok(ch, "cleric_skills", ["medicine", "history"]).character;
      expect(opt(a, "keen_senses", "perception").enabled).toBe(true);
      expect(previewDecision(a, R, "cleric_skills", ["insight"]).errors[0]).toMatch(/Già competente/);
      // Sensi acuti dell'Elfo: la competenza già avuta si esclude
      expect(opt(ch, "keen_senses", "insight")).toMatchObject({ enabled: false, disabledReason: "Già competente" });
    });
    it("Maestria solo su abilità in cui si è già competenti", () => {
      const ch = mk({ classes: [cls("rogue", 1)], decisions: { rogue_skills: ["stealth", "acrobatics", "perception", "persuasion"] } });
      const e = q(ch, "rogue_expertise_1");
      expect(e.options.find((o) => o.id === "stealth")!.enabled).toBe(true);
      expect(e.options.find((o) => o.id === "arcana")).toMatchObject({ enabled: false, disabledReason: "Serve prima la competenza" });
    });
    it("talenti: prerequisiti spiegati a parole, posseduti bloccati", () => {
      const ch = mk({ classes: [cls("fighter", 4)], baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      expect(opt(ch, "asi_fighter_4", "grappler")).toMatchObject({ enabled: false });
      expect(opt(ch, "asi_fighter_4", "grappler").disabledReason).toMatch(/Forza 13\+ oppure Destrezza 13\+/);
      expect(opt(ch, "asi_fighter_4", "ability_score_improvement").enabled).toBe(true);
      const strong = mk({ classes: [cls("fighter", 4)], baseScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      expect(opt(strong, "asi_fighter_4", "grappler").enabled).toBe(true);
      expect(opt(mk({ classes: [cls("fighter", 4)], feats: [{ featId: "grappler" }] }), "asi_fighter_4", "grappler")).toMatchObject({ enabled: false, disabledReason: "Già posseduto" });
      // il Dono epico richiede il livello 19
      expect(opt(mk({ classes: [cls("fighter", 19)] }), "epic_boon_fighter", "boon_of_combat_prowess").enabled).toBe(true);
    });
    it("Stile di combattimento o Guerriero benedetto (Paladino): scelte alternative", () => {
      const ch = mk({ classes: [cls("paladin", 2)] });
      expect(q(ch, "paladin_fighting_style").disabled).toBeUndefined();
      const a = ok(ch, "paladin_fighting_style", ["defense"]).character;
      expect(q(a, "paladin_blessed_warrior")).toMatchObject({ disabled: true, disabledReason: expect.stringContaining("Hai già scelto") });
      expect(previewDecision(a, R, "paladin_blessed_warrior", ["guidance", "light"]).errors[0]).toMatch(/Hai già scelto/);
      const b = ok(ch, "paladin_blessed_warrior", ["guidance", "light"]).character;
      expect(q(b, "paladin_fighting_style").disabled).toBe(true);
    });
    it("incantesimi preparati solo di livelli per cui si hanno slot; il Mago li sceglie dal libro", () => {
      const ch = mk({ classes: [cls("wizard", 1)] });
      expect(q(ch, "wizard_prepared").options).toEqual([]); // libro vuoto: niente da preparare
      const book = ["magic_missile", "shield", "sleep", "mage_armor", "detect_magic", "find_familiar"];
      const withBook = ok(ch, "wizard_spellbook", book).character;
      expect(q(withBook, "wizard_prepared").options.map((o) => o.id).sort()).toEqual([...book].sort());
      expect(previewDecision(withBook, R, "wizard_spellbook", ["fireball"]).errors[0]).toMatch(/Nessuno slot di 3° livello/);
      const cleric = mk({ classes: [cls("cleric", 1)] });
      expect(opt(cleric, "cleric_prepared", "cure_wounds").enabled).toBe(true);
      expect(opt(cleric, "cleric_prepared", "revivify")).toMatchObject({ enabled: false, disabledReason: "Nessuno slot di 3° livello" });
    });
    it("numero di scelte dalla tabella di classe e dalle formule", () => {
      expect(q(mk({ classes: [cls("wizard", 1)] }), "wizard_cantrips").count).toBe(3);
      expect(q(mk({ classes: [cls("wizard", 1)] }), "wizard_spellbook").count).toBe(6);
      expect(q(mk({ classes: [cls("wizard", 5)] }), "wizard_spellbook").count).toBe(14);
      expect(q(mk({ classes: [cls("wizard", 4)] }), "wizard_cantrips").count).toBe(4);
      expect(q(mk({ classes: [cls("sorcerer", 1)] }), "sorcerer_metamagic_2")).toBeUndefined(); // la Metamagia arriva al 2°
      expect(q(mk({ classes: [cls("sorcerer", 2)] }), "sorcerer_metamagic_2").count).toBe(2);
      expect(q(mk({ classes: [cls("fighter", 1)] }), "fighter_weapon_mastery").count).toBe(3);
      expect(q(mk({ classes: [cls("barbarian", 1)] }), "barbarian_weapon_mastery").count).toBe(2);
      const cleric = mk({ classes: [cls("cleric", 1)] });
      expect(q(cleric, "cleric_cantrips").count).toBe(3);
      expect(q(ok(cleric, "cleric_divine_order", ["thaumaturge"]).character, "cleric_cantrips").count).toBe(4); // +1 Taumaturgo
    });
    it("maestria nelle armi: solo armi in cui si è competenti; Barbaro solo da mischia", () => {
      const b = mk({ classes: [cls("barbarian", 1)] });
      expect(opt(b, "barbarian_weapon_mastery", "longbow")).toMatchObject({ enabled: false, disabledReason: "Solo armi da mischia" });
      expect(opt(b, "barbarian_weapon_mastery", "greataxe").enabled).toBe(true);
      const w = mk({ classes: [cls("wizard", 1)] }); // il Mago non ha competenza nelle armi da guerra
      expect(w.classes[0]!.classId).toBe("wizard");
      expect(q(w, "fighter_weapon_mastery")).toBeUndefined();
    });
    it("linguaggi: Comune + 2, i rari no, quelli già noti bloccati; Ladro e Ranger ne hanno di più", () => {
      const ch = mk();
      expect(q(ch, "languages").count).toBe(2);
      expect(q(ch, "languages").options.some((o) => o.id === "abyssal" || o.id === "common")).toBe(false);
      const two = ok(ch, "languages", ["elvish", "dwarvish"]).character;
      expect(computeCharacter(two, R).languages).toEqual(expect.arrayContaining(["common", "elvish", "dwarvish"]));
      expect(q(mk({ classes: [cls("rogue", 1)] }), "rogue_language").count).toBe(1);
      expect(q(mk({ classes: [cls("ranger", 2)] }), "ranger_languages").count).toBe(2);
      expect(computeCharacter(mk({ classes: [cls("druid", 1)] }), R).languages).toContain("druidic");
      expect(computeCharacter(mk({ classes: [cls("rogue", 1)] }), R).languages).toContain("thieves_cant");
    });
    it("Iniziato alla magia: gli incantesimi dipendono dalla lista scelta", () => {
      const ch = mk({ backgroundId: "acolyte" }); // il talento è Iniziato alla magia
      expect(q(ch, "magic_initiate_cantrips").options).toEqual([]);
      const wiz = ok(ch, "magic_initiate_list", ["wizard"]).character;
      const ids = q(wiz, "magic_initiate_cantrips").options.map((o) => o.id);
      expect(ids).toContain("fire_bolt");
      expect(ids).not.toContain("guidance");
    });
  });

  describe("scelte, annullamenti a cascata e conferma", () => {
    it("scelta non valida: errore e personaggio invariato", () => {
      const ch = mk({ backgroundId: "acolyte", classes: [cls("cleric", 1)] });
      const r = previewDecision(ch, R, "cleric_skills", ["insight"]);
      expect([r.ok, r.character]).toEqual([false, ch]);
      expect(previewDecision(ch, R, "cleric_skills", ["medicine", "history", "persuasion"]).errors[0]).toMatch(/al massimo 2/);
      expect(previewDecision(ch, R, "cleric_skills", ["medicine", "medicine"]).errors[0]).toMatch(/ripetute/);
      expect(previewDecision(ch, R, "cleric_skills", ["boh"]).errors[0]).toMatch(/sconosciuta/);
      expect(previewDecision(ch, R, "boh", ["x"]).errors[0]).toMatch(/non disponibile/);
    });
    it("cambiare la specie annulla le scelte della vecchia, con avviso; annullando si tiene il personaggio di partenza", () => {
      const ch = mk({ speciesId: "elf", decisions: { elven_lineage: ["drow"], spell_ability: ["wis"], keen_senses: ["survival"], languages: ["elvish", "dwarvish"] } });
      const r = previewDecision(ch, R, "pick:species", ["dwarf"]);
      expect(r.ok).toBe(true);
      expect(r.character.speciesId).toBe("dwarf");
      expect(r.removed.map((x) => x.key).sort()).toEqual(["elven_lineage", "keen_senses", "spell_ability"]);
      expect(r.removed[0]!.reason).toMatch(/non è più disponibile/);
      expect(r.character.decisions.languages).toEqual(["elvish", "dwarvish"]); // i linguaggi restano
      expect(ch.speciesId).toBe("elf"); // annullare = tenere `ch`: nessuna modifica
    });
    it("cambiare la classe toglie scelte di classe, sottoclasse e talenti collegati", () => {
      const ch = mk({ classes: [cls("fighter", 4)], baseScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        decisions: { fighter_skills: ["athletics", "perception"], asi_fighter_4: ["great_weapon_master"] } });
      const r = previewDecision(ch, R, "pick:class", ["wizard"]);
      expect(r.character.classes[0]).toMatchObject({ classId: "wizard", level: 4 });
      expect(r.removed.map((x) => x.key)).toEqual(expect.arrayContaining(["fighter_skills", "asi_fighter_4"]));
      expect(r.character.decisions.asi_fighter_4).toBeUndefined();
    });
    it("cambiando classe si annulla anche l'opzione di equipaggiamento scelta", () => {
      const ch = mk({ decisions: { "equipment:class": ["A"], "equipment:background": ["A"] } });
      const r = previewDecision(ch, R, "pick:class", ["wizard"]);
      expect(r.removed.map((x) => x.key)).toContain("equipment:class");
      expect(r.character.decisions["equipment:background"]).toEqual(["A"]); // il background resta
      expect(previewDecision(ch, R, "pick:class", ["fighter"]).removed).toEqual([]); // stessa classe: niente cambia
    });
    it("tempi: un personaggio di livello 20 si valuta in tempi ragionevoli", () => {
      const big = mk({ classes: [cls("wizard", 20, { subclassId: "evoker" })], speciesId: "elf" });
      const t0 = performance.now();
      const qs = allQuestions(big, R);
      const ms = performance.now() - t0;
      expect(qs.length).toBeGreaterThan(15);
      expect(ms).toBeLessThan(3000);
    });
    it("alzare il livello non annulla nulla; abbassare i punteggi annulla i talenti con prerequisiti", () => {
      const ch = mk({ classes: [cls("fighter", 4)], baseScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, decisions: { asi_fighter_4: ["grappler"] } });
      expect(validateDecisions(ch, R).removed).toEqual([]);
      const weak = setBaseScores({ ...ch, creation: { method: "manual" } }, R, "manual", { str: 12, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
      expect(weak.ok).toBe(true);
      expect(weak.removed.map((x) => [x.key, x.picked])).toEqual([["asi_fighter_4", ["grappler"]]]);
      expect(weak.removed[0]!.reason).toMatch(/Richiede Forza 13\+ oppure Destrezza 13\+/);
    });
    it("sottoclasse: disponibile dal livello 3; cambiare classe toglie sottoclasse e scelte collegate", () => {
      expect(q(mk({ classes: [cls("druid", 2)] }), "subclass:druid")).toBeUndefined();
      const ch = mk({ classes: [cls("druid", 3)] });
      expect(q(ch, "subclass:druid").options.map((o) => o.id)).toEqual(["land"]);
      const a = ok(ch, "subclass:druid", ["land"]).character;
      expect(a.classes[0]!.subclassId).toBe("land");
      expect(q(a, "land_type")).toBeDefined(); // il tipo di terra del Circolo della Terra
      const b = ok(a, "land_type", ["arid"]).character;
      const c = previewDecision(b, R, "pick:class", ["cleric"]);
      expect(c.character.classes[0]!.subclassId).toBeUndefined();
      expect(c.removed.map((x) => x.key)).toContain("land_type");
    });
  });

  describe("aumenti di caratteristica", () => {
    it("background: +2/+1 o +1/+1/+1 sulle tre caratteristiche, tetto 20", () => {
      const ch = mk({ baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 } }); // Soldato: For, Des, Cos
      expect(q(ch, "background/asi").options.filter((o) => o.enabled).map((o) => o.id)).toEqual(["str", "dex", "con"]);
      const a = setAsi(ch, R, "background/asi", [{ ability: "str", amount: 2 }, { ability: "con", amount: 1 }]);
      expect(a.ok).toBe(true);
      expect(computeCharacter(a.character, R).scores.str.value).toBe(17);
      expect(setAsi(ch, R, "background/asi", [{ ability: "int", amount: 2 }, { ability: "dex", amount: 1 }]).errors[0]).toMatch(/non consentita/);
      expect(setAsi({ ...ch, baseScores: { ...ch.baseScores, str: 19 } }, R, "background/asi", [{ ability: "str", amount: 2 }, { ability: "dex", amount: 1 }]).errors[0]).toMatch(/massimo \(20\)/);
      expect(setAsi(a.character, R, "background/asi", []).character.asi).toEqual([]); // togliere
    });
    it("cambiare background annulla gli aumenti del vecchio", () => {
      const ch = setAsi(mk({ baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 } }), R, "background/asi", [{ ability: "str", amount: 2 }, { ability: "dex", amount: 1 }]).character;
      const r = previewDecision(ch, R, "pick:background", ["sage"]); // Saggio: Cos, Int, Sag
      expect(r.character.asi).toEqual([]);
      expect(r.removed.map((x) => x.key)).toContain("background/asi");
    });
    it("Aumento dei punteggi (liv. 4): +2 a una o +1 a due, tetto 20; poi talenti con +1 e tetto 30 per i Doni epici", () => {
      const ch = mk({ classes: [cls("fighter", 4)], baseScores: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      const withFeat = ok(ch, "asi_fighter_4", ["ability_score_improvement"]).character;
      expect(q(withFeat, "asi_fighter_4/asi")).toMatchObject({ kind: "abilityIncrease", count: 2, asi: { mode: "asi", cap: 20 } });
      expect(setAsi(withFeat, R, "asi_fighter_4/asi", [{ ability: "str", amount: 2 }]).ok).toBe(true);
      expect(setAsi(withFeat, R, "asi_fighter_4/asi", [{ ability: "str", amount: 1 }, { ability: "dex", amount: 1 }]).ok).toBe(true);
      expect(setAsi({ ...withFeat, baseScores: { ...withFeat.baseScores, str: 19 } }, R, "asi_fighter_4/asi", [{ ability: "str", amount: 2 }]).errors[0]).toMatch(/massimo \(20\)/);
      const grappler = ok(mk({ classes: [cls("fighter", 4)], baseScores: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }), "asi_fighter_4", ["grappler"]).character;
      expect(q(grappler, "asi_fighter_4/asi").asi).toMatchObject({ mode: "plus1", allowed: ["str", "dex"] });
      expect(setAsi(grappler, R, "asi_fighter_4/asi", [{ ability: "con", amount: 1 }]).errors[0]).toMatch(/non consentita/);
      const epic = mk({ classes: [cls("fighter", 19)], baseScores: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      const boon = ok(epic, "epic_boon_fighter", ["boon_of_combat_prowess"]).character;
      expect(q(boon, "epic_boon_fighter/asi").asi).toMatchObject({ cap: 30 });
      const up = setAsi(boon, R, "epic_boon_fighter/asi", [{ ability: "str", amount: 1 }]);
      expect(up.ok).toBe(true);
      expect(computeCharacter(up.character, R).scores.str.value).toBe(21);
    });
    it("un aumento già fatto si invalida se la fonte cambia (talento diverso)", () => {
      const ch = mk({ classes: [cls("fighter", 4)], baseScores: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      const a = setAsi(ok(ch, "asi_fighter_4", ["ability_score_improvement"]).character, R, "asi_fighter_4/asi", [{ ability: "str", amount: 2 }]).character;
      const r = previewDecision(a, R, "asi_fighter_4", ["grappler"]);
      expect(r.character.asi).toEqual([]);
      expect(r.removed.map((x) => x.key)).toEqual(["asi_fighter_4/asi"]);
    });
    it("due Aumenti dei punteggi (ripetibili) non mescolano le scelte", () => {
      let ch = mk({ classes: [cls("fighter", 8)], baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      ch = ok(ch, "asi_fighter_4", ["ability_score_improvement"]).character;
      ch = ok(ch, "asi_fighter_8", ["ability_score_improvement"]).character; // ripetibile: ammesso
      ch = setAsi(ch, R, "asi_fighter_4/asi", [{ ability: "str", amount: 2 }]).character;
      ch = setAsi(ch, R, "asi_fighter_8/asi", [{ ability: "dex", amount: 2 }]).character;
      const d = computeCharacter(ch, R);
      expect([d.scores.str.value, d.scores.dex.value, d.scores.con.value]).toEqual([12, 12, 10]);
    });
  });

  describe("multiclasse, equipaggiamento, avanzamento", () => {
    it("multiclasse: 13 nella caratteristica di entrambe le classi", () => {
      const st = { baseScores: { str: 15, dex: 10, con: 13, int: 8, wis: 10, cha: 8 } };
      const o = (ch: Character, id: string) => classOptions(ch, R).find((x) => x.id === id)!;
      const fighter = mk({ ...st, classes: [cls("fighter", 5)] });
      expect(o(fighter, "barbarian").enabled).toBe(true);
      expect(o(fighter, "monk")).toMatchObject({ enabled: false, disabledReason: "Richiede Destrezza 13+ e Saggezza 13+" });
      expect(o(mk({ ...st, baseScores: { ...st.baseScores, str: 8, dex: 14 }, classes: [cls("fighter", 5)] }), "barbarian").enabled).toBe(false); // Guerriero: Forza o Destrezza
      expect(o(fighter, "wizard").disabledReason).toBe("Richiede Intelligenza 13+");
      // anche la classe di partenza deve rispettare il requisito: Monaco senza Saggezza 13 non può prendere altro
      const monk = mk({ ...st, classes: [cls("monk", 3)] });
      expect(o(monk, "barbarian").disabledReason).toMatch(/Per lasciare Monaco serve Destrezza 13\+ e Saggezza 13\+/);
      expect(o(mk({ classes: [] }), "wizard").enabled).toBe(true); // prima classe: nessun requisito
    });
    it("equipaggiamento iniziale: classe A + background A, strumento scelto, monete, armatura indossata", () => {
      const ch = mk({ decisions: { "equipment:class": ["A"], "equipment:background": ["A"], soldier_tool: ["dice_set"] } });
      const r = startingEquipment(ch, R);
      const has = (id: string) => r.inventory.find((e) => e.itemId === id);
      expect(has("chain_mail")).toMatchObject({ state: "worn", qty: 1 });
      expect(has("greatsword")).toMatchObject({ qty: 1, state: "stowed" });
      expect(has("javelin")!.qty).toBe(8);
      expect(has("dice_set")).toBeDefined(); // lo strumento scelto del Soldato
      expect(r.gp).toBe(4 + 14);
      expect(r.pending).toEqual([]);
      expect(startingEquipment({ ...ch, decisions: { ...ch.decisions, soldier_tool: [] } }, R).pending).toEqual(["$tool"]);
      const b = startingEquipment(mk({ decisions: { "equipment:class": ["B"], "equipment:background": ["B"] } }), R);
      expect(b.gp).toBe(11 + 50);
      expect(startingEquipment(mk({ decisions: { "equipment:class": ["C"], "equipment:background": ["B"] } }), R).gp).toBe(155 + 50);
    });
    it("Punti Ferita: primo livello al massimo, poi media o tiro", () => {
      const ch = fillHpRolls(mk({ classes: [cls("fighter", 3)] }), R, "avg");
      expect(ch.classes[0]!.hpRolls).toEqual([10, "avg", "avg"]);
      const rolled = fillHpRolls(mk({ classes: [cls("fighter", 3)] }), R, "roll", () => 0.999);
      expect(rolled.classes[0]!.hpRolls).toEqual([10, 10, 10]);
    });
    it("creazione completa di un personaggio a livello 1 (Chierico elfo Accolito): passo dopo passo fino a 'completo'", () => {
      let ch: Character = { ...testCharacter(), name: "", classes: [], speciesId: "", backgroundId: "" };
      expect(creationProgress(ch, R).next).toBe("class");
      ch = ok(ch, "pick:class", ["cleric"]).character;
      ch = ok(ch, "pick:background", ["acolyte"]).character;
      ch = ok(ch, "pick:species", ["elf"]).character;
      const rec = recommendedArray(R, "cleric")!;
      ch = setBaseScores(ch, R, "array", rec).character;
      ch = setAsi(ch, R, "background/asi", [{ ability: "wis", amount: 2 }, { ability: "cha", amount: 1 }]).character;
      // ogni domanda aperta si risolve con le prime opzioni attive
      for (let guard = 0; guard < 40; guard++) {
        const open = allQuestions(ch, R).find((x) => x.kind === "choice" && !x.complete && !x.disabled);
        if (!open) break;
        const picks = open.options.filter((o) => o.enabled).slice(0, open.count).map((o) => o.id);
        ch = ok(ch, open.key, picks).character;
      }
      ch = { ...ch, name: "Elyra" };
      const p = creationProgress(ch, R);
      expect(p.steps.filter((s) => !s.complete)).toEqual([]);
      expect(p.complete).toBe(true);
      const d = computeCharacter(fillHpRolls(ch, R, "avg"), R);
      expect(d.hp.max.value).toBeGreaterThan(0);
      expect(d.scores.wis.value).toBe(17); // 15 + 2
      expect(d.languages.length).toBe(3);
      const inv = startingEquipment(ch, R);
      expect(inv.inventory.length).toBeGreaterThan(0);
    });
    it("personaggio di livello alto: tutte le scelte da 1 a N (Guerriero 8: stile, maestrie, 2 ASI)", () => {
      const ch = mk({ classes: [cls("fighter", 8)] });
      const keys = allQuestions(ch, R).map((x) => x.key);
      expect(keys).toEqual(expect.arrayContaining(["fighter_fighting_style", "fighter_weapon_mastery", "asi_fighter_4", "asi_fighter_6", "asi_fighter_8", "subclass:fighter"]));
      expect(keys).not.toContain("asi_fighter_12");
      expect(availableOptions("class", ch, R).every((x) => x.step === "class")).toBe(true);
    });
  });
});
