// Archivio persistente: senza, il browser può cancellare IndexedDB di una PWA poco usata (soprattutto su iOS/Safari o con poco spazio)
export interface StorageInfo { supported: boolean; persisted: boolean; usage?: number; quota?: number }

export async function storageInfo(): Promise<StorageInfo> {
  const s = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!s?.persisted) return { supported: false, persisted: false };
  try {
    const est = await s.estimate?.();
    return { supported: true, persisted: await s.persisted(), ...(est?.usage !== undefined ? { usage: est.usage } : {}), ...(est?.quota !== undefined ? { quota: est.quota } : {}) };
  } catch { return { supported: true, persisted: false }; }
}

// Chiede la protezione (il browser può accettare, rifiutare o chiedere all'utente) e dice com'è andata
export async function requestPersistence(): Promise<StorageInfo> {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* non disponibile */ }
  return storageInfo();
}
export const formatBytes = (n: number): string => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);
