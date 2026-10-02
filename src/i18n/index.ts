// Lingua dell'app (testi e dati di gioco): preferenza salvata (it | en | auto), altrimenti la lingua del browser, altrimenti inglese.
// La lingua si legge una volta all'avvio; cambiarla ricarica la pagina (i personaggi stanno nel database e non si perdono).
import en from "./en.json";
import it from "./it.json";

export type Lang = "it" | "en";
export type LangPref = Lang | "auto";
export const LANGS: Lang[] = ["it", "en"];
const KEY = "lang";

export const STRINGS = { it, en } as const;

export function resolveLang(pref: string | null | undefined, browser: string | undefined): Lang {
  if (pref === "it" || pref === "en") return pref;
  return /^it\b/i.test(browser ?? "") ? "it" : "en";
}

export function getLangPref(): LangPref {
  try { const v = localStorage.getItem(KEY); return v === "it" || v === "en" ? v : "auto"; } catch { return "auto"; }
}
// fuori dal browser (test, script) la lingua di riferimento è l'italiano
export const lang: Lang = typeof window === "undefined" ? "it" : resolveLang(getLangPref(), navigator.language);
export const strings: typeof it = STRINGS[lang];

export function setLangPref(pref: LangPref) {
  try { if (pref === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* archivio non disponibile: resta la lingua del browser */ }
  location.reload();
}

// Chiavi (a percorso: "wizard.scores.method") di un oggetto di testi: servono ai test di parità tra le lingue
export function keyPaths(o: unknown, prefix = ""): string[] {
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}
