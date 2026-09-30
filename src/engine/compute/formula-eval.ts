import { parseFormula, type Formula, type Ability } from "../schema";

export interface FormulaCtx {
  pb: number;
  level: number;
  classLevels: Record<string, number>;
  scores: Record<Ability, number>;
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export function evalFormulaNode(f: Formula, c: FormulaCtx): number {
  switch (f.t) {
    case "num": return f.v;
    case "var": {
      if (f.name === "pb") return c.pb;
      if (f.name === "level") return c.level;
      if (f.name === "classLevel") return c.classLevels[f.arg ?? ""] ?? 0;
      const sc = c.scores[f.arg as Ability];
      if (sc === undefined) throw new Error(`Caratteristica sconosciuta "${f.arg}"`);
      return f.name === "mod" ? abilityMod(sc) : sc;
    }
    case "bin": {
      const l = evalFormulaNode(f.l, c), r = evalFormulaNode(f.r, c);
      return f.op === "+" ? l + r : f.op === "-" ? l - r : f.op === "*" ? l * r : l / r;
    }
    case "fn": {
      const a = f.args.map((x) => evalFormulaNode(x, c));
      return f.name === "max" ? Math.max(...a) : f.name === "min" ? Math.min(...a) : Math.floor(a[0]!);
    }
  }
}

// Numero o formula → intero (arrotondamento per difetto, file 02 §9)
export function evalValue(v: number | string, c: FormulaCtx): number {
  return Math.floor(typeof v === "number" ? v : evalFormulaNode(parseFormula(v), c));
}
