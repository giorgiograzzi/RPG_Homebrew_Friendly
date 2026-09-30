export const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Costo in monete di rame (1 mo = 100 mr): gp×100, sp×10, cp×1
export const toCopper = (n: string, unit: string) => Math.round(Number(n) * ({ gp: 100, sp: 10, ep: 50, cp: 1 } as Record<string, number>)[unit]!);

// "Martello leggero Light Hammer" + id "light_hammer" → { it, en }
// Cerca il suffisso di parole che coincide con l'id; se non c'è, usa l'aiuto `en`.
export function splitNames(text: string, id: string, en?: string): { it: string; en: string } {
  const words = text.trim().split(/\s+/);
  if (en) {
    const k = en.split(/\s+/).length;
    return { it: words.slice(0, words.length - k).join(" "), en };
  }
  for (let k = 1; k < words.length; k++) {
    const suffix = words.slice(words.length - k);
    if (compact(suffix.join("")) === compact(id)) return { it: words.slice(0, words.length - k).join(" "), en: suffix.join(" ") };
  }
  throw new Error(`Impossibile separare i nomi in "${text}" (id ${id})`);
}
