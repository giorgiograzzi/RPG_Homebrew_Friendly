import { lang, type Lang } from "../i18n";

// I dati stanno in piedi e libbre (come l'SRD inglese). L'SRD italiano usa metri e chilogrammi: 1 ft = 0,3 m, 1 lb = 0,5 kg
// (30 ft = 9 m, 5 ft = 1,5 m; 2 lb = 1 kg). L'italiano converte, l'inglese lascia com'è.
const num = (n: number, l: Lang) => {
  const r = Math.round(n * 100) / 100;
  return l === "it" ? String(r).replace(".", ",") : String(r);
};
export const distance = (ft: number, l: Lang = lang): string => (l === "it" ? `${num(ft * 0.3, l)} m` : `${num(ft, l)} ft`);
export const weight = (lb: number, l: Lang = lang): string => (l === "it" ? `${num(lb * 0.5, l)} kg` : `${num(lb, l)} lb`);
