import { CHARACTER_SCHEMA_VERSION, characterSchema } from "../engine/schema";
import type { Character } from "../engine/types";
import { tr } from "../i18n/tr";

// Migrazione da versione N a N+1, su dati grezzi (ancora non validati)
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

// La chiave è la versione di partenza: quando cambia il formato si alza CHARACTER_SCHEMA_VERSION e si aggiunge qui il passaggio.
export const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: `weapon_mastery_pick` → `<prima classe>_weapon_mastery` (nella v1 poteva esserci una sola classe con questa scelta)
  1: (raw) => {
    const decisions = { ...((raw.decisions ?? {}) as Record<string, string[]>) };
    const first = (raw.classes as { classId?: string }[] | undefined)?.[0]?.classId;
    if (decisions.weapon_mastery_pick) {
      if (first) decisions[`${first}_weapon_mastery`] = decisions.weapon_mastery_pick;
      delete decisions.weapon_mastery_pick;
    }
    return { ...raw, decisions };
  },
};

export type MigrateResult = { ok: true; character: Character; migratedFrom?: number } | { ok: false; error: string };

export function migrateCharacter(
  raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, target = CHARACTER_SCHEMA_VERSION,
): MigrateResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: tr("Il file non contiene un personaggio valido.", "The file does not contain a valid character.") };
  let data = raw as Record<string, unknown>;
  const from = data.schemaVersion;
  if (typeof from !== "number" || !Number.isInteger(from) || from < 1) return { ok: false, error: tr("Versione del personaggio mancante o non valida.", "Character version missing or invalid.") };
  if (from > target) return { ok: false, error: tr(`Personaggio creato con una versione più recente dell'app (formato ${from}, supportato fino a ${target}). Aggiorna l'app.`, `Character created with a newer version of the app (format ${from}, supported up to ${target}). Update the app.`) };
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, error: tr(`Manca la migrazione dal formato ${v} al ${v + 1}.`, `Missing migration from format ${v} to ${v + 1}.`) };
    try { data = { ...step(data), schemaVersion: v + 1 }; }
    catch (e) { return { ok: false, error: tr(`Migrazione dal formato ${v} fallita: ${e instanceof Error ? e.message : String(e)}`, `Migration from format ${v} failed: ${e instanceof Error ? e.message : String(e)}`) }; }
  }
  const parsed = characterSchema.safeParse(data);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: tr(`Personaggio non valido (${i?.path.join(".") || "radice"}: ${i?.message ?? "errore"}).`, `Invalid character (${i?.path.join(".") || "root"}: ${i?.message ?? "error"}).`) };
  }
  return from < target ? { ok: true, character: parsed.data, migratedFrom: from } : { ok: true, character: parsed.data };
}
