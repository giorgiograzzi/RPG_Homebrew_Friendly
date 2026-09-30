import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Verifica i contrasti (WCAG AA: 4.5 per il testo) direttamente sui colori del tema
const css = readFileSync(new URL("./xp.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--((?:xp|dos)-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

const PAIRS: [string, string][] = [
  ["xp-text", "xp-face"], ["xp-text", "xp-field"], ["xp-text-dim", "xp-face"], ["xp-text-dim", "xp-face-dark"],
  ["xp-title-text", "xp-title-a"], ["xp-title-text", "xp-title-b"],
  ["xp-accent-text", "xp-accent"], ["xp-ok-text", "xp-ok"], ["xp-danger-text", "xp-danger"], ["xp-select-text", "xp-select"],
  ["xp-text", "xp-face-dark"],
  // popup in stile MS-DOS / Windows 95
  ["dos-text", "dos-bg"], ["dos-bright", "dos-bg"], ["dos-dim", "dos-bg"], ["dos-accent", "dos-bg"], ["dos-danger", "dos-bg"],
  ["dos-dark", "dos-text"], ["dos-title-text", "dos-title-a"], ["dos-title-text", "dos-title-b"], ["dos-dark", "dos-face"], ["dos-shadow", "dos-bg"],
];
describe("contrasto del tema XP", () => {
  it.each(PAIRS)("%s su %s ≥ 4.5", (fg, bg) => {
    expect(tokens[fg], fg).toBeDefined();
    expect(tokens[bg], bg).toBeDefined();
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("testo minimo 16px e bersagli 48px, niente glow/brightness", () => {
    expect(css).toMatch(/--tap:\s*48px/);
    const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/brightness\(|drop-shadow|filter:\s*blur|glow/i);
    expect(css).toContain("prefers-reduced-motion");
  });
});
