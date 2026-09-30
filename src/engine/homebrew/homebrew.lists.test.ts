import { describe, expect, it } from "vitest";
import { testRuleset } from "../compute/testkit";
import { buildPack, entryFiles, parsePack, type HbEntry } from "./index";
import { extendRuleset } from "../ruleset";
import { spellChoiceCandidates } from "../spells";
import type { Choice } from "../schema";

const t = (it: string) => ({ it });
const sp = (id: string, level: number, classes: string[]) => ({ id, name: t(id), level, school: "evocation", classes, castingTime: { unit: "action", amount: 1 }, range: "36 m", components: { v: true, s: true, m: false }, duration: "Istantanea", resolution: "attack_ranged", summary: "x" });
const E = (data: object): HbEntry => ({ kind: "spells", enabled: true, data: data as HbEntry["data"] });
const rs = extendRuleset(testRuleset(), entryFiles([E(sp("hb_scintilla", 0, ["wizard"])), E(sp("hb_palla", 2, ["wizard", "cleric"])), E(sp("hb_solo_chierico", 1, ["cleric"]))]));
const ids = (source: string) => spellChoiceCandidates(rs, { id: "x", label: "x", count: 1, source } as unknown as Choice).map((s) => s.id);

describe("incantesimi homebrew nelle liste di classe", () => {
  it("compaiono tra i candidati della classe scelta, e solo lì", () => {
    expect(ids("cantrips:wizard")).toContain("hb_scintilla");
    expect(ids("spells:wizard")).toContain("hb_palla");
    expect(ids("spells:wizard")).not.toContain("hb_solo_chierico");
    expect(ids("spells:cleric")).toEqual(expect.arrayContaining(["hb_palla", "hb_solo_chierico"]));
  });
  it("si importano con il pacchetto", () => {
    const pack = parsePack(buildPack("prova", [E(sp("hb_scintilla", 0, ["wizard"]))]), rs);
    expect(pack.ok).toBe(true);
  });
});
