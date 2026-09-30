import { describe, expect, it } from "vitest";
import { testRuleset } from "../engine/compute/testkit";
import { validateEntry } from "../engine/homebrew";
import { dataToDraft, draftToData, emptyDraft } from "./forms";

const rs = testRuleset();
const make = (over: Record<string, unknown>) => ({ ...emptyDraft("items"), name: "Bacchetta", ...over });

describe("modulo homebrew: cariche degli oggetti", () => {
  it("massimo vuoto = nessuna carica; con il massimo si salvano ricarica e recupero", () => {
    expect(draftToData("items", make({}), "hb_b")).not.toHaveProperty("charges");
    const d = draftToData("items", make({ chargesMax: "7", chargesRecharge: "dawn", chargesRegain: "1d6+1" }), "hb_b");
    expect((d as unknown as { charges: unknown }).charges).toEqual({ max: 7, recharge: "dawn", regain: "1d6+1" });
    const all = draftToData("items", make({ chargesMax: "3", chargesRecharge: "long_rest", chargesRegain: "" }), "hb_b");
    expect((all as unknown as { charges: unknown }).charges).toEqual({ max: 3, recharge: "long_rest" });
    const never = draftToData("items", make({ chargesMax: "3", chargesRecharge: "none", chargesRegain: "2" }), "hb_b");
    expect((never as unknown as { charges: unknown }).charges).toEqual({ max: 3, recharge: "none" }); // senza ricarica non c'è "quante tornano"
  });
  it("si rilegge identico e si valida; armi e armature hanno gli stessi campi", () => {
    const d = draftToData("items", make({ chargesMax: "7", chargesRecharge: "dawn", chargesRegain: "1d6+1" }), "hb_b");
    expect(dataToDraft("items", d)).toMatchObject({ chargesMax: "7", chargesRecharge: "dawn", chargesRegain: "1d6+1" });
    expect(validateEntry("items", d, rs).ok).toBe(true);
    for (const k of ["weapons", "armors"] as const) {
      expect(dataToDraft(k, draftToData(k, { ...emptyDraft(k), name: "X", mastery: "sap", chargesMax: "2", chargesRecharge: "short_rest" }, "hb_x"))).toMatchObject({ chargesMax: "2", chargesRecharge: "short_rest" });
    }
  });
  it("rifiuta recuperi che non sono dadi o numeri", () => {
    const bad = draftToData("items", make({ chargesMax: "7", chargesRecharge: "dawn", chargesRegain: "abc" }), "hb_b");
    expect(validateEntry("items", bad, rs).ok).toBe(false);
  });
});
