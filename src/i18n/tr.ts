import { lang } from ".";

// Testo bilingue per i messaggi del motore e dei dati: `tr("italiano", "english")` dà quello della lingua dell'app.
// (Fuori dal browser, nei test e negli script, la lingua è l'italiano.)
export const tr = (it: string, en: string): string => (lang === "it" ? it : en);
