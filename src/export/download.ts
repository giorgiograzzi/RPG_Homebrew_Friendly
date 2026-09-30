// Scarica dei byte come file (l'URL resta valido un po' di più: serve anche per "Apri")
export function downloadBytes(bytes: Uint8Array, name: string, type: string): string {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}
