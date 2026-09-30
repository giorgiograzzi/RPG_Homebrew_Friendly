// Sezioni della scheda del personaggio: stanno nella barra in basso al posto delle tab principali.
// "conditions" è una schermata raggiungibile da Stato (non ha un'icona nella barra: non c'è spazio per 9 icone da 48px).
export const SHEET_SECTIONS = ["status", "features", "stats", "attacks", "equip", "magic", "misc"] as const;
export type SheetSection = (typeof SHEET_SECTIONS)[number];
export type SheetView = SheetSection | "conditions";
