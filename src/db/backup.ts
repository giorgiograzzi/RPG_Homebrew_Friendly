import { newId as makeId } from "./id";
import { z } from "zod";
import type { Character } from "../engine/types";
import { migrateCharacter } from "./migrations";
import { HB_KINDS, type HbEntry } from "../engine/homebrew";
import { tr } from "../i18n/tr";

export const BACKUP_FORMAT = "srd-personaggi-backup";
export const BACKUP_VERSION = 1;

const containerSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.number(),
  characters: z.array(z.unknown()),
  settings: z.unknown().optional(),
  homebrew: z.unknown().optional(), // libreria homebrew: così si importa anche su un altro dispositivo
});
export interface Backup { format: typeof BACKUP_FORMAT; version: number; exportedAt: number; characters: Character[]; settings?: unknown; homebrew?: HbEntry[] }

export function exportBackup(characters: Character[], settings?: unknown, now = Date.now(), homebrew: HbEntry[] = []): string {
  const b: Backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, characters, ...(settings !== undefined ? { settings } : {}), ...(homebrew.length ? { homebrew } : {}) };
  return JSON.stringify(b, null, 2);
}

// new = id sconosciuto; same = identico a quello già presente; conflict = stesso id ma contenuto diverso
export type ImportStatus = "new" | "same" | "conflict" | "invalid";
export interface ImportItem { index: number; id: string; name: string; status: ImportStatus; migratedFrom?: number; error?: string; character?: Character }
export type ImportPreview = { ok: true; exportedAt: number; items: ImportItem[]; settings?: unknown; homebrew?: HbEntry[] } | { ok: false; error: string };

export function previewImport(text: string, existing: Character[]): ImportPreview {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: tr("Il file non è un JSON leggibile.", "The file is not readable JSON.") }; }
  // Accetta anche un singolo personaggio esportato da solo
  const single = migrateCharacter(json);
  const container = containerSchema.safeParse(json);
  if (!container.success) {
    if (single.ok) return { ok: true, exportedAt: 0, items: [classify(0, single.character, single.migratedFrom, existing)] };
    return { ok: false, error: tr("Il file non è un backup di questa app.", "The file is not a backup of this app.") };
  }
  if (container.data.version > BACKUP_VERSION) return { ok: false, error: tr(`Backup creato da una versione più recente dell'app (formato ${container.data.version}). Aggiorna l'app.`, `Backup created by a newer version of the app (format ${container.data.version}). Update the app.`) };
  const items = container.data.characters.map((raw, i): ImportItem => {
    const r = migrateCharacter(raw);
    if (!r.ok) {
      const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      return { index: i, id: typeof o.id === "string" ? o.id : "", name: typeof o.name === "string" ? o.name : "", status: "invalid", error: r.error };
    }
    return classify(i, r.character, r.migratedFrom, existing);
  });
  const homebrew = readHomebrew(container.data.homebrew);
  return { ok: true, exportedAt: container.data.exportedAt, items, ...(container.data.settings !== undefined ? { settings: container.data.settings } : {}), ...(homebrew.length ? { homebrew } : {}) };
}

// Voci homebrew di un backup: si tengono solo quelle con la forma giusta (la validazione piena avviene quando il ruleset le legge)
function readHomebrew(raw: unknown): HbEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is HbEntry => {
    const x = e as Partial<HbEntry> | null;
    return !!x && typeof x === "object" && (HB_KINDS as readonly string[]).includes(String(x.kind)) && typeof x.data === "object" && x.data !== null
      && typeof (x.data as { id?: unknown }).id === "string" && typeof (x.data as { name?: { it?: unknown } }).name?.it === "string";
  }).map((e) => ({ kind: e.kind, enabled: e.enabled !== false, data: e.data, ...(typeof e.pack === "string" ? { pack: e.pack } : {}) }));
}

function classify(index: number, ch: Character, migratedFrom: number | undefined, existing: Character[]): ImportItem {
  const cur = existing.find((e) => e.id === ch.id);
  const status: ImportStatus = !cur ? "new" : JSON.stringify(cur) === JSON.stringify(ch) ? "same" : "conflict";
  return { index, id: ch.id, name: ch.name, status, ...(migratedFrom !== undefined ? { migratedFrom } : {}), character: ch };
}

// Cosa fare con i conflitti: sostituire l'esistente, tenere entrambi (copia con nuovo id) o saltare. Default: tenere entrambi.
export type Resolution = "replace" | "copy" | "skip";
export function applyImport(preview: ImportPreview, resolutions: Record<string, Resolution> = {}, newId: () => string = makeId): Character[] {
  if (!preview.ok) return [];
  const out: Character[] = [];
  for (const it of preview.items) {
    if (!it.character || it.status === "invalid" || it.status === "same") continue;
    if (it.status === "new") { out.push(it.character); continue; }
    const r = resolutions[it.id] ?? "copy";
    if (r === "replace") out.push(it.character);
    else if (r === "copy") out.push({ ...it.character, id: newId(), name: `${it.character.name} ${tr("(importato)", "(imported)")}` });
  }
  return out;
}
