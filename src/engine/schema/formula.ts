// Formule numeriche dei dati: "pb", "mod:wis", "max(1, mod:wis)", "2 * level".
// Qui solo il parser (AST); la valutazione sta in compute/ (step 3).
export type Formula =
  | { t: "num"; v: number }
  | { t: "var"; name: string; arg?: string }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; l: Formula; r: Formula }
  | { t: "fn"; name: "max" | "min" | "floor"; args: Formula[] };

// Variabili ammesse (con eventuale argomento dopo i due punti)
const VARS = new Set(["pb", "level", "classLevel", "mod", "score"]);
const TOKEN = /\s*(\d+|[a-zA-Z_]+(?::[a-z_]+)?|[-+*/(),])/y;

export function parseFormula(src: string): Formula {
  const toks: string[] = [];
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  let end = 0;
  while ((m = TOKEN.exec(src))) {
    toks.push(m[1]!);
    end = TOKEN.lastIndex;
  }
  if (src.slice(end).trim() !== "") throw new Error(`Formula non valida: "${src}"`);
  let i = 0;
  const peek = () => toks[i];
  const eat = (t?: string) => {
    const x = toks[i++];
    if (x === undefined || (t && x !== t)) throw new Error(`Formula non valida: "${src}"`);
    return x;
  };
  const primary = (): Formula => {
    const x = eat();
    if (/^\d+$/.test(x)) return { t: "num", v: Number(x) };
    if (x === "(") {
      const e = sum();
      eat(")");
      return e;
    }
    if (x === "max" || x === "min" || x === "floor") {
      eat("(");
      const args = [sum()];
      while (peek() === ",") { eat(","); args.push(sum()); }
      eat(")");
      return { t: "fn", name: x, args };
    }
    const [name, arg] = x.split(":") as [string, string | undefined];
    if (!VARS.has(name)) throw new Error(`Variabile sconosciuta "${name}" in "${src}"`);
    return arg === undefined ? { t: "var", name } : { t: "var", name, arg };
  };
  const product = (): Formula => {
    let l = primary();
    while (peek() === "*" || peek() === "/") {
      const op = eat() as "*" | "/";
      l = { t: "bin", op, l, r: primary() };
    }
    return l;
  };
  const sum = (): Formula => {
    let l = product();
    while (peek() === "+" || peek() === "-") {
      const op = eat() as "+" | "-";
      l = { t: "bin", op, l, r: product() };
    }
    return l;
  };
  const f = sum();
  if (i !== toks.length) throw new Error(`Formula non valida: "${src}"`);
  return f;
}

export const isValidFormula = (s: string): boolean => {
  try { parseFormula(s); return true; } catch { return false; }
};
