import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { distance, weight } from "../ui/units";

// Messaggi mostrati all'utente: devono passare da tr("italiano", "english") o da it.json/en.json, mai solo in italiano.
const ITALIAN = /\b(non|per|il|la|di|del|della|con|hai|puoi|serve|nessun[oa]?|manca|scegli|tira|assegna|oggetto|slot di|livello)\b/i;
const SKIP = [/ruleset\.ts$/, /validate\.ts$/, /\.test\.ts$/, /testkit\.ts$/, /schema\//, /srdIntegrity/, /legal\//, /i18n\//, /data\//];
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : []; });

describe("niente messaggi solo in italiano nel motore e nello store", () => {
  it("ogni stringa italiana con spazi passa da tr()", () => {
    const bad: string[] = [];
    for (const dir of ["engine", "db", "store", "wizard", "pages", "sheet", "export", "ui", "homebrew"]) for (const f of walk(join(__dirname, "..", dir))) {
      if (SKIP.some((r) => r.test(f))) continue;
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/\btr\(/.test(code) || /^\s*\*/.test(code) || /autoComplete:/.test(code)) return;
        for (const m of code.matchAll(/(["`])((?:\\.|(?!\1).)*?)\1/g)) if (m[2]!.includes(" ") && ITALIAN.test(m[2]!)) bad.push(`${f.split("/src/")[1]}:${i + 1}: ${m[2]!.slice(0, 60)}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it("unità: metri e kg in italiano, piedi e libbre in inglese", () => {
    expect(distance(30, "it")).toBe("9 m");
    expect(distance(5, "it")).toBe("1,5 m");
    expect(distance(30, "en")).toBe("30 ft");
    expect(weight(2, "it")).toBe("1 kg");
    expect(weight(3, "it")).toBe("1,5 kg");
    expect(weight(8, "en")).toBe("8 lb");
  });
});
