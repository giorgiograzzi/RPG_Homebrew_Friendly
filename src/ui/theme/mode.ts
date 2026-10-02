// Aspetto dell'app: automatico (come il dispositivo), chiaro o scuro. La scelta sta nel browser (localStorage) e si applica prima del primo disegno (vedi index.html).
export type ThemePref = "auto" | "light" | "dark";
const KEY = "theme";
export const THEME_COLORS = { light: "#ffffff", dark: "#181b2e" } as const;

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; }
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", pref);
  // colore della barra del browser: due meta con `media` per l'automatico, lo stesso colore su entrambi se forzato
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const dark = m.media.includes("dark");
    m.content = pref === "auto" ? (dark ? THEME_COLORS.dark : THEME_COLORS.light) : THEME_COLORS[pref];
  }
}

export function setThemePref(pref: ThemePref) {
  try { if (pref === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* archivio non disponibile: vale per questa sessione */ }
  applyTheme(pref);
}
