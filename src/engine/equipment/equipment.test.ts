import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import { analyzeLoadout, equipItem, handsFor } from "./loadout";
import { DEFAULT_SETTINGS } from "../settings";
import type { Character } from "../types";

const rs = testRuleset();
// Guerriero 1° (competente in armi semplici e marziali), For 17 (+3), Des 14 (+2), Cos 14
const asi = [{ source: "Background", ability: "str" as const, amount: 2 }, { source: "Background", ability: "con" as const, amount: 1 }];
const inv = (...e: [string, "wielded" | "worn" | "stowed", object?][]) => e.map(([itemId, state, extra]) => ({ itemId, qty: 1, state, ...(extra ?? {}) }));
const mk = (over: Partial<Character> = {}) => testCharacter({ asi, ...over });
const run = (over: Partial<Character> = {}) => computeCharacter(mk(over), rs);
const atk = (d: ReturnType<typeof run>, label: string) => d.attacks.find((a) => a.label === label)!;

describe("equipaggiamento: mani, armatura, sintonia", () => {
  it("mani: Versatile a due mani e A due mani; Lancia da cavaliere in sella a una mano", () => {
    const e = { itemId: "longsword", qty: 1, state: "wielded" as const };
    expect([handsFor(rs.weapons.get("longsword")!, e, false), handsFor(rs.weapons.get("longsword")!, { ...e, grip: "two" }, false)]).toEqual([1, 2]);
    expect(handsFor(rs.weapons.get("greatsword")!, e, false)).toBe(2);
    expect([handsFor(rs.weapons.get("lance")!, e, false), handsFor(rs.weapons.get("lance")!, e, true)]).toEqual([2, 1]);
  });
  it("spada + scudo ok; spadone + scudo, o Versatile a due mani + scudo, sono troppe mani", () => {
    expect(analyzeLoadout(mk({ inventory: inv(["longsword", "wielded"], ["shield", "worn"]) }), rs)).toMatchObject({ handsUsed: 2, problems: [] });
    expect(analyzeLoadout(mk({ inventory: inv(["greatsword", "wielded"], ["shield", "worn"]) }), rs).problems[0]).toMatch(/Troppe mani/);
    expect(analyzeLoadout(mk({ inventory: inv(["longsword", "wielded", { grip: "two" }], ["shield", "worn"]) }), rs).problems[0]).toMatch(/Troppe mani/);
    const mounted = mk({ inventory: inv(["lance", "wielded"], ["shield", "worn"]), state: { ...testCharacter().state, mounted: true } });
    expect(analyzeLoadout(mounted, rs).problems).toEqual([]);
  });
  it("una sola armatura e un solo scudo; stati sbagliati; sintonia massimo 3; oggetti sconosciuti", () => {
    expect(analyzeLoadout(mk({ inventory: inv(["leather", "worn"], ["scale_mail", "worn"]) }), rs).problems[0]).toMatch(/una sola armatura/);
    expect(analyzeLoadout(mk({ inventory: inv(["leather", "wielded"]) }), rs).problems[0]).toMatch(/si indossa/);
    expect(analyzeLoadout(mk({ inventory: inv(["dagger", "worn"]) }), rs).problems[0]).toMatch(/si impugna/);
    const att = (n: number) => mk({ inventory: Array.from({ length: n }, () => ({ itemId: "ring", qty: 1, state: "worn" as const, attuned: true })) });
    expect(analyzeLoadout(att(3), rs).problems).toEqual([]);
    expect(analyzeLoadout(att(4), rs).problems.join()).toMatch(/massimo 3/);
    expect(analyzeLoadout(mk({ inventory: inv(["dagger", "wielded", { attuned: true }]) }), rs).attuned).toBe(1);
    expect(analyzeLoadout(mk({ inventory: inv(["boh", "stowed"]) }), rs).problems[0]).toMatch(/sconosciuto/);
  });
  it("peso: oggetti + monete (50 monete = 1 lb); capacità di carico For × 15", () => {
    const d = run({ inventory: [{ itemId: "rope", qty: 2, state: "stowed" }, { itemId: "greatsword", qty: 1, state: "stowed" }], coins: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 } });
    expect(d.loadout.weight).toBe(10 + 6 + 2);
    expect(d.loadout.capacity).toBe(255);
  });
});

describe("cambio di equipaggiamento e tempi", () => {
  const base = mk({ inventory: inv(["chain_mail", "stowed"], ["leather", "worn"], ["longsword", "stowed"], ["shield", "stowed"], ["greatsword", "stowed"]) });
  it("armatura: togliere la vecchia e indossare la nuova (tempi dai dati), una sola alla volta", () => {
    const r = equipItem(base, rs, "chain_mail", "worn");
    expect(r.problems).toEqual([]);
    expect(r.time.minutes).toBe(10 + 1); // pesante 10 + togliere la leggera 1
    expect(r.character.inventory.find((e) => e.itemId === "leather")!.state).toBe("stowed");
    expect(analyzeLoadout(r.character, rs).body?.id).toBe("chain_mail");
    expect(equipItem(r.character, rs, "chain_mail", "stowed").time.minutes).toBe(5);
  });
  it("scudo: 1 azione", () => {
    expect(equipItem(base, rs, "shield", "worn").time).toMatchObject({ action: true, free: false });
  });
  it("cambio arma: regola della casa = 1 azione; ufficiale = gratis nell'azione di Attacco", () => {
    expect(equipItem(base, rs, "longsword", "wielded", DEFAULT_SETTINGS).time).toMatchObject({ action: true });
    expect(equipItem(base, rs, "longsword", "wielded", { weaponSwap: "official" }).time).toMatchObject({ action: false, free: true });
  });
  it("cambio non valido: personaggio invariato e motivo", () => {
    const withShield = equipItem(equipItem(base, rs, "shield", "worn").character, rs, "longsword", "wielded").character;
    const r = equipItem(withShield, rs, "greatsword", "wielded");
    expect(r.character).toBe(withShield);
    expect(r.problems[0]).toMatch(/Troppe mani/);
    expect(equipItem(base, rs, "boh", "wielded").problems[0]).toMatch(/non nel tuo inventario/);
  });
});

describe("attacchi", () => {
  it("spada lunga a una mano: For, competenza, 1d8 + For; a due mani 1d10", () => {
    const d = run({ inventory: inv(["longsword", "wielded"]) });
    const a = atk(d, "longsword");
    expect([a.ability, a.toHit.value, a.damage.dice, a.damage.bonus.value, a.critRange, a.reach]).toEqual(["str", 3 + 2, "1d8", 3, 20, 5]);
    expect(a.damage.text).toBe("1d8 + 3 slashing");
    expect(atk(run({ inventory: inv(["longsword", "wielded", { grip: "two" }]) }), "longsword (due mani)").damage.dice).toBe("1d10");
  });
  it("Accurata: la caratteristica migliore tra For e Des; la lanciata è un attacco a distanza con gittata", () => {
    const dexy = { baseScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, asi: [] };
    const a = atk(run({ ...dexy, inventory: inv(["dagger", "wielded"]) }), "dagger");
    expect([a.ability, a.abilityWhy, a.toHit.value]).toEqual(["dex", "Accurata", 3 + 2]);
    const t = atk(run({ ...dexy, inventory: inv(["dagger", "wielded"]) }), "dagger (lanciata)");
    expect([t.kind, t.thrown, t.range]).toEqual(["ranged", true, { normal: 20, long: 60 }]);
    const noFinesse = atk(run({ ...dexy, inventory: inv(["longsword", "wielded"]) }), "longsword");
    expect(noFinesse.ability).toBe("str");
  });
  it("arco: Des, munizioni disponibili, promemoria di gittata", () => {
    const d = run({ inventory: [...inv(["shortbow", "wielded"]), { itemId: "arrow", qty: 2, state: "stowed" }] });
    const a = atk(d, "shortbow");
    expect([a.kind, a.ability, a.range]).toEqual(["ranged", "dex", { normal: 80, long: 320 }]);
    expect(a.ammo).toEqual({ itemId: "arrow", available: 40 });
    expect(a.notes.join()).toMatch(/gittata normale/);
  });
  it("arma Pesante: Svantaggio con For < 13 (mischia)", () => {
    const weak = { baseScores: { str: 12, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, asi: [] };
    expect(atk(run({ ...weak, inventory: inv(["greatsword", "wielded"]) }), "greatsword").mode).toBe("disadvantage");
    expect(atk(run({ inventory: inv(["greatsword", "wielded"]) }), "greatsword").mode).toBe("normal");
  });
  it("senza competenza: niente bonus di competenza", () => {
    const rs2 = testRuleset();
    rs2.classes.set("fighter", { ...rs2.classes.get("fighter")!, weaponProficiency: ["simple"] });
    const a = computeCharacter(mk({ inventory: inv(["longsword", "wielded"]) }), rs2).attacks.find((x) => x.label === "longsword")!;
    expect([a.proficient, a.toHit.value]).toEqual([false, 3]);
    expect(a.notes.join()).toMatch(/Non sei competente/);
  });
  it("Tiro con l'arco: +2 solo alle armi a distanza (anche lanciate)", () => {
    const f = [{ featId: "archery" }];
    expect(atk(run({ feats: f, inventory: inv(["shortbow", "wielded"]) }), "shortbow").toHit.value).toBe(2 + 2 + 2);
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded"]) }), "longsword").toHit.value).toBe(5);
    expect(atk(run({ feats: f, inventory: inv(["dagger", "wielded"]) }), "dagger (lanciata)").toHit.value).toBe(3 + 2 + 2); // Accurata: For 3 ≥ Des 2
  });
  it("Duellare: +2 al danno con una sola arma a una mano (scudo ammesso), non con due armi né a due mani", () => {
    const f = [{ featId: "dueling" }];
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded"]) }), "longsword").damage.bonus.value).toBe(5);
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded"], ["shield", "worn"]) }), "longsword").damage.bonus.value).toBe(5);
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded", { grip: "two" }]) }), "longsword (due mani)").damage.bonus.value).toBe(3);
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded"], ["rapier", "wielded"]) }), "longsword").damage.bonus.value).toBe(3);
    expect(atk(run({ feats: f, inventory: inv(["greatsword", "wielded"]) }), "greatsword").damage.bonus.value).toBe(3);
  });
  it("due armi Leggere: la mano secondaria non aggiunge il modificatore, salvo Combattere con due armi", () => {
    const two = inv(["dagger", "wielded"], ["handaxe", "wielded"]);
    const off = atk(run({ inventory: two }), "handaxe (mano secondaria)");
    expect([off.offhand, off.damage.bonus.value]).toEqual([true, 0]);
    expect(atk(run({ inventory: two }), "dagger").damage.bonus.value).toBe(3);
    expect(atk(run({ inventory: two, feats: [{ featId: "two_weapon_fighting" }] }), "handaxe (mano secondaria)").damage.bonus.value).toBe(3);
    expect(run({ inventory: inv(["dagger", "wielded"], ["longsword", "wielded"]) }).attacks.some((a) => a.offhand)).toBe(false);
  });
  it("Combattere con armi possenti: promemoria solo a due mani", () => {
    const f = [{ featId: "great_weapon_fighting" }];
    expect(atk(run({ feats: f, inventory: inv(["greatsword", "wielded"]) }), "greatsword").notes.join()).toMatch(/contano 3/);
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded"]) }), "longsword").notes.join()).not.toMatch(/contano 3/);
    expect(atk(run({ feats: f, inventory: inv(["longsword", "wielded", { grip: "two" }]) }), "longsword (due mani)").notes.join()).toMatch(/contano 3/);
  });
  it("colpo senz'armi sempre disponibile: 1 + For", () => {
    const u = atk(run({}), "Colpo senz'armi");
    expect([u.damage.dice, u.damage.bonus.value, u.toHit.value, u.proficient, u.damage.type]).toEqual(["1", 3, 5, true, "bludgeoning"]);
  });
  it("Lancia da cavaliere: Portata 10 ft, a due mani se non in sella", () => {
    const foot = atk(run({ inventory: inv(["lance", "wielded"]) }), "lance");
    expect([foot.hands, foot.reach]).toEqual([2, 10]);
    expect(foot.notes.join()).toMatch(/due mani se non in sella/);
    expect(atk(run({ inventory: inv(["lance", "wielded"]), state: { ...testCharacter().state, mounted: true } }), "lance").hands).toBe(1);
  });
  it("condizioni e Esaurimento cambiano i tiri per colpire", () => {
    const st = (over: object) => ({ state: { ...testCharacter().state, ...over } });
    expect(atk(run({ inventory: inv(["longsword", "wielded"]), ...st({ conditions: ["poisoned"] }) }), "longsword").mode).toBe("disadvantage");
    expect(atk(run({ inventory: inv(["longsword", "wielded"]), ...st({ exhaustion: 2 }) }), "longsword").toHit.value).toBe(5 - 4);
  });
  it("armatura senza addestramento: Svantaggio agli attacchi con For/Des", () => {
    const rs2 = testRuleset();
    rs2.classes.set("fighter", { ...rs2.classes.get("fighter")!, armorTraining: [] });
    const d = computeCharacter(mk({ inventory: inv(["chain_mail", "worn"], ["longsword", "wielded"]) }), rs2);
    expect(d.attacks.find((a) => a.label === "longsword")!.mode).toBe("disadvantage");
  });
  it("i problemi di equipaggiamento arrivano in Derived.loadout", () => {
    expect(run({ inventory: inv(["greatsword", "wielded"], ["shield", "worn"]) }).loadout.problems).toHaveLength(1);
    expect(run({ inventory: inv(["chain_mail", "worn"], ["shield", "worn"]) }).loadout).toMatchObject({ body: "chain_mail", shield: "shield", handsUsed: 1 });
  });
});
