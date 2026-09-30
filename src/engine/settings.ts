// Impostazioni di regola che l'utente può cambiare (schermata Impostazioni, step 12)
export interface Settings {
  // Cambio arma: "official" = estrarre/riporre fa parte dell'azione di Attacco (gratis, un oggetto per turno);
  // "house" = costa 1 azione (regola della casa scelta, file 03 §4b)
  weaponSwap: "official" | "house";
}
export const DEFAULT_SETTINGS: Settings = { weaponSwap: "house" };
