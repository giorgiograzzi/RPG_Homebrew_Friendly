// Guardia legale: nel codice, nei dati e negli asset non deve entrare contenuto non libero (solo SRD CC-BY).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCAN = ["src", "data", "public", "index.html"];
const SELF = join("src", "legal", "noProtected.test.ts");

// Parole vietate (senza distinzione di maiuscole), con i file dove la dicitura CC-BY può citarle.
const FORBIDDEN: { name: string; re: RegExp; allow?: RegExp }[] = [
  { name: "dndbeyond", re: /dndbeyond/i, allow: /attribution|licen[sc]/i },
  { name: "Player's Handbook", re: /player['’]?s handbook/i },
  { name: "Manuale del Giocatore", re: /manuale del giocatore/i },
  { name: "PHB", re: /\bPHB\b/ },
  { name: "Wizards", re: /wizards/i, allow: /attribution|licen[sc]/i },
  { name: "Dungeons & Dragons", re: /dungeons\s*(&|&amp;|and|e)\s*dragons/i },
  { name: "D&D", re: /\bD\s*(&|&amp;)\s*D\b/i },
  { name: "edizione 2024 / 5.5", re: /\b2024\b|\b5\.5\s*\(|edizione 5\.5/i },
  { name: "bookPage", re: /bookPage/ },
  // l'interfaccia non imita nessun sistema operativo o prodotto altrui
  { name: "tema di terzi", re: /\bwindows\b|ms-dos|tahoma|\b(xp|dos)-[a-z]/i },
  // contenuti che non sono nell'SRD 5.2.1 (specie, classi e sottoclassi di altri manuali)
  { name: "non SRD: sottoclassi e specie", re: /eldritch knight|cavaliere mistico|arcane trickster|mistificatore arcano|aasimar|artificer|artefice|tabaxi|warforged/i },
];

function walk(p: string, out: string[] = []): string[] {
  let st;
  try { st = statSync(p); } catch { return out; }
  if (st.isDirectory()) { for (const n of readdirSync(p)) { if (n !== "node_modules") walk(join(p, n), out); } }
  else out.push(p);
  return out;
}

const files = SCAN.flatMap((s) => walk(join(ROOT, s))).map((f) => relative(ROOT, f)).filter((f) => f !== SELF);

describe("guardia: niente contenuto protetto", () => {
  it("scandisce dei file", () => { expect(files.length).toBeGreaterThan(10); });

  it("nessun PDF fuori da docs/srd/", () => {
    expect(files.filter((f) => /\.pdf$/i.test(f) && !f.startsWith(`docs${sep}srd${sep}`))).toEqual([]);
  });

  it("nessuna parola vietata nei file di testo", () => {
    const hits: string[] = [];
    for (const f of files) {
      if (/\.(png|jpe?g|gif|ico|woff2?|ttf|otf|pdf)$/i.test(f)) continue;
      const text = readFileSync(join(ROOT, f), "utf8");
      text.split("\n").forEach((line, i) => {
        for (const w of FORBIDDEN) if (w.re.test(line) && !w.allow?.test(f)) hits.push(`${f}:${i + 1} [${w.name}]`);
      });
    }
    expect(hits).toEqual([]);
  });
});
