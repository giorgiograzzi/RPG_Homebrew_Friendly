import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { testCharacter, testRuleset } from "../engine/compute/testkit";
import { buildSheetData } from "./sheetData";
import { fillSheet } from "./sheetPdf";

const TEMPLATE = "public/forms/scheda-2024-it.pdf";

// Mago di prova (come in magic.test.ts): slot 4/3/2, un trucchetto, due preparati
function setup() {
  const rs = testRuleset();
  const w = rs.classes.get("wizard")!;
  (w as { caster: string }).caster = "full";
  w.spellSlots = Array.from({ length: 20 }, () => [4, 3, 2]);
  w.choices.push(
    { id: "wizard_cantrips", label: { it: "Trucchetti" }, count: 1, source: "cantrips:wizard", distinct: true } as never,
    { id: "wizard_prepared", label: { it: "Preparati" }, count: 2, source: "spells:wizard", distinct: true } as never,
  );
  const ch = testCharacter({
    name: "Brina d'Argento", classes: [{ classId: "wizard", level: 5, hpRolls: ["avg", "avg", "avg", "avg", "avg"] }],
    decisions: { wizard_cantrips: ["spark"], wizard_prepared: ["charm", "ward"] },
    inventory: [{ itemId: "dagger", qty: 1, state: "wielded" }, { itemId: "rope", qty: 2, state: "stowed" }, { itemId: "ring", qty: 1, state: "stowed", attuned: true }],
    coins: { cp: 3, sp: 14, ep: 0, gp: 120, pp: 1 },
  });
  return { rs, ch };
}

describe("scheda PDF: dati", () => {
  const { rs, ch } = setup();
  const d = buildSheetData(ch, rs);
  it("prende i numeri dal motore", () => {
    expect(d.name).toBe("Brina d'Argento");
    expect(d.klass).toBe("wizard");
    expect(d.level).toBe("5");
    expect(d.scores.str).toMatchObject({ score: "15", mod: "+2" });
    expect(d.pb).toBe("+3");
    expect(d.slots.slice(0, 4)).toEqual(["4", "3", "2", ""]);
    expect(d.spellAbility).toBe("Intelligenza");
  });
  it("elenca trucchetti e preparati, trucchetti per primi", () => {
    expect(d.spells.map((s) => s.name)).toEqual(["spark", "charm", "ward"]);
    expect(d.spells[0]?.level).toBe("0");
  });
  it("equipaggiamento, sintonia e attacchi", () => {
    expect(d.equipment).toHaveLength(3);
    expect(d.equipment).toContain("2× Corda");
    expect(d.attunement).toEqual(["Anello"]);
    expect(d.attacks[0]?.name.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!existsSync(TEMPLATE))("scheda PDF: file", () => {
  it("scrive sul modello ufficiale e resta di 2 pagine", async () => {
    const { rs, ch } = setup();
    const out = await fillSheet(readFileSync(TEMPLATE), buildSheetData(ch, rs));
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
    if (process.env.SHEET_OUT) writeFileSync(process.env.SHEET_OUT, out);
  }, 30000);
  it("non si rompe con caratteri fuori dal set del font e nomi lunghissimi", async () => {
    const { rs, ch } = setup();
    const d = buildSheetData({ ...ch, name: "Ælfwynn ★ ✓ " + "x".repeat(200) }, rs);
    const out = await fillSheet(readFileSync(TEMPLATE), { ...d, classFeatures: Array.from({ length: 80 }, (_, i) => `Privilegio ${i}: ${"testo lungo ".repeat(20)}`) });
    expect(out.length).toBeGreaterThan(1000);
  }, 30000);
});
