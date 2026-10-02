import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { applyImport, exportBackup, previewImport } from "./backup";
import { migrateCharacter, type Migration } from "./migrations";
import { createRepo } from "./repo";
import { emptyCharacter } from "../engine/character";
import { CHARACTER_SCHEMA_VERSION } from "../engine/schema";
import type { Character } from "../engine/types";

const pg = (id: string, name = "Aria"): Character => ({ ...emptyCharacter(id), name });
let n = 0;
const freshRepo = () => createRepo(`test-${++n}`);

describe("migrazioni", () => {
  it("accetta il formato corrente senza migrare", () => {
    const r = migrateCharacter(pg("a"));
    expect(r).toMatchObject({ ok: true });
    expect((r as { migratedFrom?: number }).migratedFrom).toBeUndefined();
  });
  it("applica la catena in ordine (v1→v2→v3) e poi valida", () => {
    const m: Record<number, Migration> = {
      1: (d) => ({ ...d, notes: `${String(d.notes)}a` }),
      2: (d) => ({ ...d, notes: `${String(d.notes)}b` }),
    };
    const r = migrateCharacter({ ...pg("a"), schemaVersion: 1 }, m, 3);
    expect(r).toMatchObject({ ok: true, migratedFrom: 1 });
    if (r.ok) { expect(r.character.notes).toBe("ab"); expect(r.character.schemaVersion).toBe(3); }
  });
  it("rifiuta versioni future, migrazioni mancanti, migrazioni che falliscono e dati invalidi", () => {
    expect(migrateCharacter({ ...pg("a"), schemaVersion: CHARACTER_SCHEMA_VERSION + 1 })).toMatchObject({ ok: false, error: expect.stringContaining("più recente") });
    expect(migrateCharacter({ ...pg("a"), schemaVersion: 1 }, {}, 2)).toMatchObject({ ok: false, error: expect.stringContaining("Manca la migrazione") });
    expect(migrateCharacter({ ...pg("a"), schemaVersion: 1 }, { 1: () => { throw new Error("boom"); } }, 2)).toMatchObject({ ok: false, error: expect.stringContaining("boom") });
    expect(migrateCharacter({ ...pg("a"), baseScores: 3 })).toMatchObject({ ok: false, error: expect.stringContaining("baseScores") });
    expect(migrateCharacter(null)).toMatchObject({ ok: false });
    expect(migrateCharacter({ id: "x" })).toMatchObject({ ok: false, error: expect.stringContaining("Versione") });
  });
});

describe("repository", () => {
  it("salva, elenca (più recente prima), carica e cancella", async () => {
    const repo = freshRepo();
    await repo.save(pg("a", "Uno"), 1);
    await repo.save(pg("b", "Due"), 2);
    expect((await repo.list()).map((x) => x.id)).toEqual(["b", "a"]);
    const l = await repo.load("a");
    expect(l).toMatchObject({ ok: true });
    await repo.remove("a");
    expect(await repo.load("a")).toMatchObject({ ok: false });
    expect(await repo.list()).toHaveLength(1);
  });
  it("segnala un personaggio corrotto senza rompere l'elenco", async () => {
    const repo = freshRepo();
    await repo.save({ ...pg("a"), schemaVersion: 99 } as Character, 1);
    expect(await repo.load("a")).toMatchObject({ ok: false, error: expect.stringContaining("più recente") });
    expect(await repo.list()).toHaveLength(1);
  });
  it("impostazioni chiave/valore", async () => {
    const repo = freshRepo();
    expect(await repo.getSetting("x")).toBeUndefined();
    await repo.setSetting("x", { a: 1 });
    expect(await repo.getSetting("x")).toEqual({ a: 1 });
  });
});

describe("backup: export → import", () => {
  const rich = (): Character => {
    const c = pg("r", "Ricco");
    c.classes = [{ classId: "wizard", level: 3, hpRolls: ["avg", 4, "avg"] }];
    c.decisions = { "class/skills": ["arcana", "history"] };
    c.inventory = [{ itemId: "dagger", qty: 2, state: "wielded", grip: "one" }];
    c.state.slotsUsed = { "1": 2 };
    c.creation = { method: "roll", rolls: [15, 14, 13, 12, 10, 8] };
    return c;
  };
  it("round-trip identico su archivio vuoto", () => {
    const orig = [rich(), pg("b")];
    const p = previewImport(exportBackup(orig), []);
    expect(p.ok && p.items.map((i) => i.status)).toEqual(["new", "new"]);
    expect(applyImport(p)).toEqual(orig);
  });
  it("riconosce identici, conflitti e file non validi", () => {
    const a = rich();
    const text = exportBackup([a, { ...pg("b"), name: "Nuovo nome" }, { ...pg("c"), schemaVersion: 99 } as Character]);
    const p = previewImport(text, [a, pg("b")]);
    expect(p.ok && p.items.map((i) => i.status)).toEqual(["same", "conflict", "invalid"]);
    expect(previewImport("non json", [])).toMatchObject({ ok: false });
    expect(previewImport(JSON.stringify({ format: "altro" }), [])).toMatchObject({ ok: false });
    expect(previewImport(JSON.stringify({ format: "srd-personaggi-backup", version: 9, exportedAt: 0, characters: [] }), [])).toMatchObject({ ok: false, error: expect.stringContaining("più recente") });
  });
  it("risolve i conflitti: copia (default), sostituisci, salta", () => {
    const changed = { ...pg("b"), name: "Nuovo" };
    const p = previewImport(exportBackup([changed]), [pg("b")]);
    expect(applyImport(p, {}, () => "nuovo-id")).toEqual([{ ...changed, id: "nuovo-id", name: "Nuovo (importato)" }]);
    expect(applyImport(p, { b: "replace" })).toEqual([changed]);
    expect(applyImport(p, { b: "skip" })).toEqual([]);
  });
  it("accetta un personaggio singolo", () => {
    const p = previewImport(JSON.stringify(pg("s")), []);
    expect(p.ok && p.items).toHaveLength(1);
  });
});

describe("id casuali senza contesto sicuro", () => {
  it("funziona anche senza crypto.randomUUID (http://192.168...)", async () => {
    const { newId } = await import("./id");
    const real = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = newId(), b = newId();
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(a).not.toBe(b);
    } finally { Object.defineProperty(globalThis.crypto, "randomUUID", { value: real, configurable: true }); }
  });
});

describe("migrazione v1 → v2: maestrie d'arma per classe", () => {
  it("sposta weapon_mastery_pick sulla scelta della prima classe", () => {
    const v1 = { ...pg("a"), schemaVersion: 1, classes: [{ classId: "fighter", level: 1, hpRolls: [] }], decisions: { weapon_mastery_pick: ["greatsword", "flail", "longsword"], fighter_skills: ["athletics"] } };
    const r = migrateCharacter(v1);
    expect(r).toMatchObject({ ok: true, migratedFrom: 1 });
    if (r.ok) {
      expect(r.character.schemaVersion).toBe(2);
      expect(r.character.decisions.fighter_weapon_mastery).toEqual(["greatsword", "flail", "longsword"]);
      expect(r.character.decisions.weapon_mastery_pick).toBeUndefined();
      expect(r.character.decisions.fighter_skills).toEqual(["athletics"]);
    }
  });
});
