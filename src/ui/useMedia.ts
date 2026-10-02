import { useSyncExternalStore } from "react";

// true quando la finestra rispetta la media query (si aggiorna da sola ridimensionando)
export function useMedia(query: string): boolean {
  const subscribe = (cb: () => void) => {
    const m = window.matchMedia(query);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  };
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

// Da questa larghezza la scheda mette Stato, Statistiche, Attacchi e Magia in colonne affiancate
export const WIDE = "(min-width: 1100px)";
