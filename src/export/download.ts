// Su mobile apre il foglio "Condividi" con il file; dove non c'è, lo scarica
export async function shareOrDownloadJson(text: string, name: string): Promise<"shared" | "downloaded"> {
  try {
    const file = new File([text], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return "shared"; }
  } catch (e) { if ((e as Error)?.name === "AbortError") return "shared"; }
  downloadBytes(new TextEncoder().encode(text), name, "application/json");
  return "downloaded";
}

// Scarica dei byte come file (l'URL resta valido un po' di più: serve anche per "Apri")
export function downloadBytes(bytes: Uint8Array, name: string, type: string): string {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}
