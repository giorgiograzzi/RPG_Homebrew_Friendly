import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import { longRest, shortRest } from "../play/rest";
import { useResource } from "../play/state";
import type { Character } from "../types";

// Effetti degli oggetti magici: arma impugnata, armatura indossata, oggetto nello zaino; con sintonia solo se sintonizzato
const rs = testRuleset();
const asi = [{ source: "Background", ability: "str" as const, amount: 2 }, { source: "Background", ability: "con" as const, amount: 1 }];
const tx = (s: string) => ({ it: s });
rs.items.set("hb_ring_ac", { id: "hb_ring_ac", name: tx("Anello +1"), description: "", origin: "homebrew", needsReview: false, category: "Oggetto magico", weight: 0, cost: 0, attunement: true, effects: [{ op: "acBonus", value: 1 }] } as never);
rs.items.set("hb_charm", { id: "hb_charm", name: tx("Amuleto"), description: "", origin: "homebrew", needsReview: false, category: "Oggetto magico", weight: 0, cost: 0, attunement: false, effects: [{ op: "initiativeBonus", value: 2 }] } as never);
rs.weapons.set("hb_blade", { ...rs.weapons.get("longsword")!, id: "hb_blade", name: tx("Lama +1"), attunement: false, effects: [{ op: "attackBonus", value: 1, attackType: "any" }, { op: "damageBonus", value: 1, attackType: "any" }] } as never);
rs.items.set("hb_wand", { id: "hb_wand", name: tx("Bacchetta"), description: "", origin: "homebrew", needsReview: false, category: "Oggetto magico", weight: 0, cost: 0, attunement: false, effects: [], charges: { max: 7, recharge: "dawn", regain: "1d6+1" } } as never);
rs.items.set("hb_orb", { id: "hb_orb", name: tx("Sfera"), description: "", origin: "homebrew", needsReview: false, category: "Oggetto magico", weight: 0, cost: 0, attunement: false, effects: [], charges: { max: 3, recharge: "long_rest" } } as never);
rs.weapons.set("hb_staff", { ...rs.weapons.get("longsword")!, id: "hb_staff", name: tx("Bastone"), attunement: false, effects: [], charges: { max: 7, recharge: "dawn", regain: "1d6" } } as never);
const mk = (over: Partial<Character> = {}) => testCharacter({ asi, ...over });
const run = (over: Partial<Character> = {}) => computeCharacter(mk(over), rs);
const item = (itemId: string, state: "stowed" | "wielded" | "worn", attuned?: boolean) => ({ itemId, qty: 1, state, ...(attuned ? { attuned } : {}) });
const base = run();

describe("effetti degli oggetti", () => {
  it("con sintonia: conta solo se sintonizzato", () => {
    expect(run({ inventory: [item("hb_ring_ac", "worn")] }).ac.value).toBe(base.ac.value);
    const on = run({ inventory: [item("hb_ring_ac", "worn", true)] });
    expect(on.ac.value).toBe(base.ac.value + 1);
    expect(on.ac.sources.some((s) => s.label.includes("Anello +1"))).toBe(true);
  });
  it("senza sintonia: vale nello zaino, non se è a terra", () => {
    expect(run({ inventory: [item("hb_charm", "stowed")] }).initiative.value).toBe(base.initiative.value + 2);
    expect(run({ inventory: [{ itemId: "hb_charm", qty: 1, state: "dropped" }] }).initiative.value).toBe(base.initiative.value);
  });
  it("arma: bonus solo se impugnata e solo per i suoi attacchi", () => {
    const stowed = run({ inventory: [item("hb_blade", "stowed"), item("dagger", "wielded")] });
    expect(stowed.attacks.find((a) => a.label === "Lama +1")).toBeUndefined();
    const d = run({ inventory: [item("hb_blade", "wielded"), item("dagger", "wielded")] });
    const blade = d.attacks.find((a) => a.label === "Lama +1")!, dagger = d.attacks.find((a) => a.label === rs.weapons.get("dagger")!.name.it)!;
    const plain = run({ inventory: [item("longsword", "wielded"), item("dagger", "wielded")] });
    const ref = plain.attacks.find((a) => a.label === rs.weapons.get("longsword")!.name.it)!;
    expect(blade.toHit.value).toBe(ref.toHit.value + 1);
    expect(blade.damage.bonus.value).toBe(ref.damage.bonus.value + 1);
    expect(dagger.toHit.value).toBe(plain.attacks.find((a) => a.label === rs.weapons.get("dagger")!.name.it)!.toHit.value);
  });
});

describe("cariche degli oggetti", () => {
  const inv = [item("hb_wand", "stowed"), item("hb_orb", "stowed")];
  it("sono una risorsa dell'oggetto, con nome e ricarica", () => {
    const r = run({ inventory: inv }).resources;
    expect(r["item:hb_wand"]).toMatchObject({ used: 0, remaining: 7, recharge: "dawn", regain: "1d6+1" });
    expect(r["item:hb_wand"]!.max.sources[0]!.label).toBe("Bacchetta");
    expect(r["item:hb_orb"]).toMatchObject({ remaining: 3, recharge: "long_rest" });
  });
  it("se l'oggetto è a terra non compaiono", () => {
    expect(run({ inventory: [{ itemId: "hb_wand", qty: 1, state: "dropped" }] }).resources["item:hb_wand"]).toBeUndefined();
  });
  it("il riposo lungo ricarica tutto; con `regain` la ricarica è manuale e restano le cariche spese", () => {
    let ch = mk({ inventory: inv });
    ch = useResource(useResource(ch, "item:hb_wand", 7, 5), "item:hb_orb", 3, 2);
    const after = longRest(ch, computeCharacter(ch, rs));
    expect(after.state.resourcesUsed["item:hb_orb"]).toBeUndefined();
    expect(after.state.resourcesUsed["item:hb_wand"]).toBe(5);
    expect(shortRest(ch, computeCharacter(ch, rs)).state.resourcesUsed["item:hb_orb"]).toBe(2);
  });
  it("un'arma con cariche impugnata: l'attacco ha lo stesso id della risorsa (così le cariche compaiono negli Attacchi)", () => {
    const d = run({ inventory: [item("hb_staff", "wielded")] });
    const a = d.attacks.find((x) => x.label === "Bastone")!;
    expect(d.resources[`item:${a.id}`]).toMatchObject({ remaining: 7, regain: "1d6" });
    expect(run({ inventory: [item("hb_staff", "stowed")] }).resources["item:hb_staff"]).toBeDefined(); // nello zaino ha le cariche, ma senza attacco
  });
});
