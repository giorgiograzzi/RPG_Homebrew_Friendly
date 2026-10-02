import { describe, expect, it } from "vitest";
import { CONTROLLER, POLICIES, type PolicyKind } from "./policies";

const kinds: PolicyKind[] = ["privacy", "cookies"];
const shape = (p: (typeof POLICIES)["privacy"]["it"]) => p.sections.map((s) => [!!s.h, s.p?.length ?? 0, s.ul?.length ?? 0, s.table?.rows.length ?? 0, s.table?.head.length ?? 0].join());

describe("Privacy Policy e Cookie Policy", () => {
  for (const k of kinds) {
    it(`${k}: italiano e inglese hanno la stessa struttura`, () => {
      expect(shape(POLICIES[k].en)).toEqual(shape(POLICIES[k].it));
      expect(POLICIES[k].en.intro.length).toBe(POLICIES[k].it.intro.length);
    });
    for (const l of ["it", "en"] as const) {
      it(`${k}/${l}: nomina il titolare, il contatto (e il Garante nella privacy) e non ha testi vuoti`, () => {
        const all = JSON.stringify(POLICIES[k][l]);
        expect(all).toContain(CONTROLLER.name);
        expect(all).toContain(CONTROLLER.email);
        if (k === "privacy") expect(all).toMatch(/Garante/);
        const texts = POLICIES[k][l].sections.flatMap((x) => [...(x.p ?? []), ...(x.ul ?? [])]);
        expect(texts.filter((x) => !x.trim())).toEqual([]);
        expect(POLICIES[k][l].updated).toMatch(/2026/);
      });
    }
  }
  it("la tabella degli archivi è la stessa nelle due policy e cita ogni chiave usata dall'app", () => {
    for (const l of ["it", "en"] as const) {
      const t = (k: PolicyKind) => JSON.stringify(POLICIES[k][l].sections.find((s) => s.table && s.table.head.length === 4)?.table);
      expect(t("privacy")).toBe(t("cookies"));
      for (const key of ["srd-personaggi", "lang", "theme", "hb-draft:", "cookie-notice", "reloaded"]) expect(t("cookies"), key).toContain(key);
    }
  });
});
