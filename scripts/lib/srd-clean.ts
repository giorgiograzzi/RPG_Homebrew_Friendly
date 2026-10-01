// Pulizia del testo estratto dai PDF dell'SRD 5.2.1.
//
// Il PDF italiano è pulito. Il PDF inglese invece ha, in alcuni font, una tabella ToUnicode sbagliata:
// i glifi sono mappati sul loro indice nel font e non sul carattere vero. Il guasto è regolare:
//   maiuscole A-E, L-O, Q-V, X      → codici di controllo U+0004…  (codice = lettera − 61: A=U+0004, T=U+0017)
//   minuscole d, j, k, q, u, x      → codici C1 U+0083…           (codice = lettera + 34: d=U+0086, x=U+009A)
//   cifre 0-9                       → U+0372…U+037B (greco)
//   ( ) — ’ - : ; + − ×             → U+020B, U+020C, U+0204, U+01EF, U+01E6, U+01E3, U+01E2, U+03AA, U+03AB, U+03AD
// Le altre lettere (F-K, P, W, Y, Z e le altre minuscole) escono corrette.
// La tabella è stata ricavata e verificata sul PDF (vedi src/data/srdClean.test.ts).

const MAP = new Map<string, string>();
// maiuscole (U+0009-U+000D sono spazi bianchi e non si toccano: le lettere F-K non sono corrotte)
for (let c = 0x04; c <= 0x1d; c++) if (c < 0x09 || c > 0x0e) MAP.set(String.fromCharCode(c), String.fromCharCode(c + 61));
// minuscole
for (let c = 0x83; c <= 0x9c; c++) MAP.set(String.fromCharCode(c), String.fromCharCode(c - 34));
// cifre
for (let d = 0; d <= 9; d++) MAP.set(String.fromCharCode(0x372 + d), String(d));
for (const [from, to] of Object.entries({
  "ȋ": "(", "Ȍ": ")", "Ȅ": "—", "ǯ": "’", "Ǧ": "-", "ǣ": ":", "Ǣ": ";",
  "Ϊ": "+", "Ϋ": "−", "έ": "×",
})) MAP.set(from, to);

/** Rimette i caratteri giusti nel testo inglese. Non cambia la struttura delle righe. */
export function fixEnGlyphs(s: string): string {
  let out = "";
  for (const ch of s) out += MAP.get(ch) ?? ch;
  // Il trattino dopo una cifra ("15-foot") esce con il codice della Q: "15Qfoot", "20Q⏎foot"
  return out.replace(/(\d)Q(?=\s*foot\b)/g, "$1-");
}

/** Caratteri che dopo la correzione non dovrebbero più comparire (controlli, C1, greco, ecc.). */
export function leftoverOddChars(s: string): string[] {
  const found = new Set<string>();
  for (const m of s.matchAll(/[\u0000-\u0008\u000e-\u001f\u007f-\u009fĀ-Ͽ᪞]/g)) found.add(m[0]);
  return [...found];
}

/** Testo "da leggere" (descrizioni): unisce le parole spezzate a fine riga ("Trem-⏎bling", "compe - ⏎tenza") e le righe. */
export function joinProse(s: string): string {
  return s
    .replace(/(\p{L}) ?-[ \t]*\n(\p{Ll})/gu, "$1$2")
    .replace(/\s*\n\s*/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}
