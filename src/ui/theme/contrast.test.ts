import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrasto WCAG AA (4.5 per il testo) calcolato direttamente sui token del tema, in chiaro e in scuro
const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const block = (start: string) => {
  const a = css.indexOf(start);
  const b = css.indexOf("}", a);
  return Object.fromEntries([...css.slice(a, b).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
};
const THEMES = { chiaro: block(":root {"), scuro: block(':root[data-theme="dark"]') };
const AUTO_DARK = block(':root:not([data-theme="light"])');

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

const PAIRS: [string, string][] = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"], ["text", "field"], ["text-dim", "bg"], ["text-dim", "surface"], ["text-dim", "surface-2"],
  ["accent-text", "accent"], ["accent-soft-text", "accent-soft"], ["ok-text", "ok"], ["danger-text", "danger"], ["warn-text", "warn-bg"],
  ["accent", "surface"], ["accent", "bg"], ["ok", "surface"], ["danger", "surface"], ["text", "ok-soft"], ["text", "danger-soft"],
];
describe.each(Object.entries(THEMES))("contrasto del tema %s", (_name, tokens) => {
  it.each(PAIRS)("%s su %s ≥ 4.5", (fg, bg) => {
    expect(tokens[fg], fg).toBeDefined();
    expect(tokens[bg], bg).toBeDefined();
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("il bordo dei campi si distingue dallo sfondo (≥ 3 per i componenti)", () => {
    expect(ratio(tokens["field-border"]!, tokens["surface"]!)).toBeGreaterThanOrEqual(3);
  });
});

describe("tema", () => {
  it("lo scuro automatico (prefers-color-scheme) ha gli stessi colori dello scuro forzato", () => {
    expect(AUTO_DARK).toEqual(Object.fromEntries(Object.entries(THEMES.scuro).filter(([k]) => k in AUTO_DARK)));
    expect(Object.keys(AUTO_DARK).length).toBeGreaterThan(15);
  });
  it("testo minimo 16px e bersagli 48px, niente glow/brightness", () => {
    expect(css).toMatch(/--tap:\s*48px/);
    const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/brightness\(|drop-shadow|filter:\s*blur|glow/i);
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("safe-area-inset-bottom");
  });
  it("tre fasce: telefono, tablet (640px) e desktop (1024px)", () => {
    expect(css).toContain("min-width: 640px");
    expect(css).toContain("min-width: 1024px");
  });
});
