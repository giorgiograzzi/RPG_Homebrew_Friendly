import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { fixedHp } from "../compute/constants";
import { emptyCharacter } from "../character";
import { creationProgress } from "../creation";
import { buildRuleset } from "../ruleset";
import type { Character } from "../types";
import { autoComplete } from "../../wizard/logic";
import { levelUp, totalLevel } from "./index";

// Gira solo dove esistono i dati privati (non tracciati): test "golden" delle 12 classi ai livelli 1, 5, 11, 20
const DIR = "data/private";
describe.skipIf(!existsSync(`${DIR}/classes.json`))("avanzamento di livello con i dati veri (step 17)", () => {
  const R = buildRuleset(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))));
  const CLASSES = [...R.classes.keys()];
  const PB: Record<number, number> = { 1: 2, 5: 3, 11: 4, 20: 6 };
  // Un personaggio creato al 1° livello (scelte automatiche) e portato al livello L, completando le scelte a ogni livello
  function at(classId: string, L: number): Character {
    let c = autoComplete({ ...emptyCharacter(`g-${classId}`), name: classId, classes: [{ classId, level: 1, hpRolls: [] }], speciesId: "human", backgroundId: "soldier" }, R);
    c = { ...c, classes: c.classes.map((x) => ({ ...x, hpRolls: [R.classes.get(classId)!.hitDie] })), state: { ...c.state, hp: 1 } };
    while (totalLevel(c) < L) {
      const r = levelUp(c, R, classId, "avg");
      expect(r.errors, `${classId} → ${totalLevel(c) + 1}`).toEqual([]);
      c = autoComplete(r.character, R);
    }
    return c;
  }
  const FULL: Record<number, number[]> = { 1: [2], 5: [4, 3, 2], 11: [4, 3, 3, 3, 2, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1] };
  const HALF: Record<number, number[]> = { 1: [2], 5: [4, 2], 11: [4, 3, 3], 20: [4, 3, 3, 3, 2] };

  for (const cid of CLASSES) {
    for (const L of [1, 5, 11, 20]) {
      it(`${cid} al ${L}° livello`, () => {
        const c = at(cid, L);
        const def = R.classes.get(cid)!;
        const d = computeCharacter(c, R);
        expect(totalLevel(c)).toBe(L);
        const prog = creationProgress(c, R);
        expect(prog.steps.filter((s) => !s.complete && s.step !== "details").map((s) => `${s.step}: ${s.missing} ${s.problems}`)).toEqual([]);
        expect(d.proficiencyBonus.value).toBe(PB[L]);
        // PF: primo livello al massimo del dado, poi il valore fisso + Cos, tutto × livello (senza bonus di specie o sottoclasse)
        const con = d.mods.con.value;
        const extra = d.hp.max.sources.filter((s) => !/Dadi Vita|Costituzione/.test(s.label));
        if (!extra.length) expect(d.hp.max.value).toBe(def.hitDie + (L - 1) * Math.max(fixedHp(def.hitDie) + con, 1) + con);
        expect(d.hp.hitDice).toEqual([{ die: def.hitDie, total: L }]);
        expect(d.warnings).toEqual([]);
        // privilegi sbloccati: ogni privilegio di classe fino al livello compare nell'elenco
        const ids = new Set(d.featureList.map((f) => f.id));
        for (const f of def.features.filter((x) => x.level <= L)) expect(ids.has(f.id), f.id).toBe(true);
        // slot degli incantatori (tabelle del file 04) e del Patto
        if (def.caster === "full") expect(d.spellSlots.slots.filter((n) => n > 0)).toEqual(FULL[L]);
        if (def.caster === "half") expect(d.spellSlots.slots.filter((n) => n > 0)).toEqual(HALF[L]);
        if (def.caster === "pact") expect(d.spellSlots.pact).toMatchObject({ count: { 1: 1, 5: 2, 11: 3, 20: 4 }[L], level: { 1: 1, 5: 3, 11: 5, 20: 5 }[L] });
        // sottoclasse scelta dal livello previsto
        if (L >= def.subclassLevel) expect(c.classes[0]!.subclassId, "sottoclasse").toBeTruthy();
      });
    }
  }
  it("Guerriero: Attacchi per azione 1/2/3/4 e Azione impetuosa; Barbaro: usi di Ira 2/3/4/6", () => {
    for (const [L, atk] of [[1, 1], [5, 2], [11, 3], [20, 4]] as const) expect(computeCharacter(at("fighter", L), R).attacksPerAction).toBe(atk);
    for (const [L, rage] of [[1, 2], [5, 3], [11, 4], [20, 6]] as const) expect(computeCharacter(at("barbarian", L), R).resources.rage!.max.value).toBe(rage);
  });
  it("terzo incantatore (Cavaliere mistico, Mistificatore arcano): slot dal 3° livello, tabella del file 04", () => {
    const THIRD: Record<number, number[]> = { 5: [3], 11: [4, 3], 20: [4, 3, 3, 1] };
    for (const [cid, sub] of [["fighter", "eldritch_knight"], ["rogue", "arcane_trickster"]] as const) {
      for (const L of [5, 11, 20]) {
        const c = at(cid, L);
        expect(c.classes[0]!.subclassId).toBeTruthy();
        const forced = { ...c, classes: [{ ...c.classes[0]!, subclassId: sub }] };
        expect(computeCharacter(forced, R).spellSlots.slots.filter((n) => n > 0), `${sub} ${L}`).toEqual(THIRD[L]);
      }
      expect(computeCharacter({ ...at(cid, 3), classes: [{ ...at(cid, 3).classes[0]!, subclassId: sub }] }, R).spellSlots.slots.filter((n) => n > 0)).toEqual([2]);
    }
  });
  it("multiclasse Guerriero → Mago: competenze parziali, niente TS del Mago, slot dal livello da incantatore", () => {
    let c = autoComplete({ ...emptyCharacter("mc"), name: "mc", classes: [{ classId: "fighter", level: 1, hpRolls: [] }], speciesId: "human", backgroundId: "sage" }, R);
    c = { ...c, baseScores: { ...c.baseScores, int: 14, str: 15 }, classes: c.classes.map((x) => ({ ...x, hpRolls: [10] })) };
    const r = levelUp(c, R, "wizard", "avg");
    expect(r.ok).toBe(true);
    const d = computeCharacter(r.character, R);
    expect(d.saves.int.proficient).toBe(false);
    expect(d.saves.wis.proficient).toBe(false);
    expect(d.spellSlots.casterLevel).toBe(1);
    expect(d.spellSlots.slots[0]).toBe(2);
    // le scelte del Mago al 1° livello (libro, trucchetti) compaiono da fare, ma NON le abilità di classe
    const keys = r.pending.map((q) => q.key);
    expect(keys.some((k) => /wizard_skills/.test(k))).toBe(false);
    expect(keys).toContain("wizard_cantrips");
  });
  it("multiclasse: armature e armi 'multiclasse' della nuova classe, non quelle iniziali", () => {
    let c = autoComplete({ ...emptyCharacter("mc2"), name: "mc2", classes: [{ classId: "wizard", level: 1, hpRolls: [] }], speciesId: "human", backgroundId: "sage" }, R);
    c = { ...c, baseScores: { ...c.baseScores, int: 15, str: 14 }, classes: c.classes.map((x) => ({ ...x, hpRolls: [6] })) };
    expect(computeCharacter(c, R).proficiencies.armor).toEqual([]);
    const fighter = levelUp(c, R, "fighter", "avg");
    expect(fighter.ok).toBe(true);
    const d = computeCharacter(fighter.character, R);
    expect(d.proficiencies.armor.sort()).toEqual(["light", "medium", "shield"]); // "Ottieni": armature leggere, medie, scudi (non pesanti)
    expect(d.proficiencies.weapons).toContain("martial");
    expect(d.saves.str.proficient).toBe(false); // i TS del Guerriero non si aggiungono
  });
  it("Mente di ferro: Saggezza se non l'hai già, altrimenti Intelligenza o Carisma", () => {
    const opt = (_c: Character, id: string) => R.subclasses.get("gloom_stalker")!.features.find((f) => f.id === "iron_mind")!.choices[0]!.options!.find((o) => o.id === id)!;
    expect(opt({} as Character, "wis").requires).toBe("!saveProficient:wis");
    // Ranger di partenza: TS For e Des, niente Saggezza → si può scegliere Saggezza, non Int/Car
    const ranger = { ...emptyCharacter("gs"), classes: [{ classId: "ranger", level: 7, subclassId: "gloom_stalker", hpRolls: [] }] };
    const q = (c: Character) => import("../creation").then((m) => m.allQuestions(c, R).find((x) => x.key === "iron_mind")!);
    return q(ranger).then((x) => {
      expect(x.options.find((o) => o.id === "wis")!.enabled).toBe(true);
      expect(x.options.find((o) => o.id === "int")).toMatchObject({ enabled: false, disabledReason: expect.stringContaining("Saggezza") });
    });
  });
});
