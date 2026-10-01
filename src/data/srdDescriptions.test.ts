import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leftoverOddChars } from "../../scripts/lib/srd-clean";

// Voci dello step 2a che devono avere una descrizione breve in entrambe le lingue
const KINDS = ["skills", "sizes", "damageTypes", "weaponProperties", "masteries", "tools", "backgrounds", "feats", "species", "classes", "subclasses"] as const;
const load = (lang: "it" | "en", kind: string) =>
  (JSON.parse(readFileSync(`data/srd/${lang}/${kind}.json`, "utf8")) as { entries: { id: string; description?: string }[] }).entries;

describe.each(KINDS)("descrizioni: %s", (kind) => {
  it("ogni voce ha una descrizione in IT e in EN, pulita e diversa tra le lingue", () => {
    const [it, en] = [load("it", kind), load("en", kind)];
    expect(it.length).toBeGreaterThan(0);
    for (const e of it) {
      const x = en.find((v) => v.id === e.id);
      expect(e.description?.trim(), `${kind}/${e.id} IT`).toBeTruthy();
      expect(x?.description?.trim(), `${kind}/${e.id} EN`).toBeTruthy();
      expect(leftoverOddChars(e.description! + x!.description!), `${kind}/${e.id}`).toEqual([]);
      if (kind !== "damageTypes" || e.id !== "lightning") expect(e.description, `${kind}/${e.id} uguale in IT e EN`).not.toBe(x!.description);
    }
  });
});
