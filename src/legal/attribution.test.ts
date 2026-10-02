import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { CC_BY_URL, DISCLAIMER, SRD_NOTICE } from "./attribution";

const norm = (s: string) => s.replace(/­/g, "").replace(/\s+/g, " ").trim();
// nel PDF una riga può spezzare un indirizzo («4.0/ legalcode»): per il confronto con l'SRD si tolgono tutti gli spazi
const flat = (s: string) => norm(s).replace(/ /g, "");
async function firstPages(path: string, n = 3) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  let t = "";
  for (let i = 1; i <= n; i++) t += (await (await doc.getPage(i)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" ") + " ";
  return norm(t);
}

describe("attribuzioni: la dicitura CC-BY è quella dell'SRD", () => {
  for (const lang of ["it", "en"] as const) {
    it(`la dicitura ${lang} coincide con la prima pagina del PDF SRD`, async () => {
      expect(flat(await firstPages(`docs/srd/SRD_5.2.1_${lang}.pdf`))).toContain(flat(SRD_NOTICE[lang]));
    });
    it(`la dicitura e l'avviso ${lang} stanno in ATTRIBUTION.md e README.md`, () => {
      for (const f of ["ATTRIBUTION.md", "README.md"]) {
        const txt = norm(readFileSync(f, "utf8").replace(/^> ?/gm, ""));
        expect(txt, f).toContain(norm(SRD_NOTICE[lang]));
        expect(txt, f).toContain(norm(DISCLAIMER[lang]));
      }
    });
  }
  it("la dicitura rimanda alla licenza e dice «5.2.1»", () => {
    for (const l of ["it", "en"] as const) { expect(SRD_NOTICE[l]).toContain(CC_BY_URL); expect(SRD_NOTICE[l]).toContain("5.2.1"); }
  });
  it("l'avviso nomina l'app e dice che non è ufficiale", () => {
    expect(DISCLAIMER.it).toMatch(/Placet del Master.*non ufficiale/);
    expect(DISCLAIMER.en).toMatch(/Placet del Master.*unofficial/);
  });
  it("il nome dell'app è lo stesso ovunque", () => {
    expect(readFileSync("index.html", "utf8")).toContain("<title>Placet del Master</title>");
    expect(readFileSync("vite.config.ts", "utf8")).toContain('name: "Placet del Master"');
    for (const l of ["it", "en"]) expect(JSON.parse(readFileSync(`src/i18n/${l}.json`, "utf8")).app.title).toBe("Placet del Master");
  });
});
