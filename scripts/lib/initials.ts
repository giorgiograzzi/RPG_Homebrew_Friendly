// Il PDF inglese dell'SRD perde le maiuscole F G H I J K (anche a inizio frase: "t can also go" per "It can also go").
// Si ripristinano scegliendo la lettera che dà la parola più frequente nel resto dell'SRD; quelle in mezzo alla frase si
// segnalano e si correggono con una tabella (MID_FIXES), perché lì il contesto non basta.

// parole che la frequenza non risolve (nessuna occorrenza intera nel resto del testo)
const LOST_INITIAL: Record<string, string> = { t: "It", uided: "Guided", urthermore: "Furthermore" };

export async function restoreInitials(pages: string[]) {
  const freq = new Map<string, number>();
  for (const t of pages) for (const w of t.toLowerCase().match(/[a-z’]+/g) ?? []) freq.set(w, (freq.get(w) ?? 0) + 1);
  const n = (w: string) => freq.get(w) ?? 0;
  const cands = (w: string) => ["f", "g", "h", "i", "j", "k"].map((c) => [c + w, n(c + w)] as const).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]);

  /** Ripristina le iniziali perse e segnala (con `bad`) le parole sospette in mezzo alla frase (tranne quelle in `ok`). */
  return (text: string, where: string, bad: (m: string) => void, ok: Set<string> = new Set()): string => {
    let out = text;
    // inizio di paragrafo, di riga di tabella o di frase
    out = out.replace(/(^|\n|[.!?] +)([a-z][a-z’]*)/g, (all, pre: string, w: string) => {
      if (LOST_INITIAL[w]) return pre + LOST_INITIAL[w];
      const c = cands(w);
      // parola normale che inizia davvero in minuscolo, oppure ambigua
      if (!c.length || n(w) * 5 >= c[0]![1]) return all;
      if (c[1] && c[0]![1] < c[1][1] * 3) { bad(`${where}: iniziale persa non risolvibile in "${pre.trim()}${w}"`); return all; }
      const best = c[0]![0];
      return pre + best[0]!.toUpperCase() + best.slice(1);
    });
    // in mezzo alla frase: una parola rara che con una F-K davanti diventa una parola frequente
    for (const m of out.matchAll(/(?<![A-Za-z’-])([a-z][a-z’]{1,})(?![A-Za-z’])/g)) {
      const w = m[1]!, c = cands(w);
      if (c.length && !ok.has(w) && n(w) <= 2 && c[0]![1] >= Math.max(5, n(w) * 10)) bad(`${where}: forse manca una maiuscola: "${w}" → "${c[0]![0]}" (${m.index})`);
    }
    return out;
  };
}
