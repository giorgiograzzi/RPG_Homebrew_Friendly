import { CHARACTER_SCHEMA_VERSION, characterSchema } from "../engine/schema";
import type { Character } from "../engine/types";

// Migrazione da versione N a N+1, su dati grezzi (ancora non validati)
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

// La chiave è la versione di partenza. Alla versione 1 non c'è ancora nulla da migrare:
// quando cambia il formato si alza CHARACTER_SCHEMA_VERSION e si aggiunge qui il passaggio.
export const MIGRATIONS: Record<number, Migration> = {};

export type MigrateResult = { ok: true; character: Character; migratedFrom?: number } | { ok: false; error: string };

export function migrateCharacter(
  raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, target = CHARACTER_SCHEMA_VERSION,
): MigrateResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Il file non contiene un personaggio valido." };
  let data = raw as Record<string, unknown>;
  const from = data.schemaVersion;
  if (typeof from !== "number" || !Number.isInteger(from) || from < 1) return { ok: false, error: "Versione del personaggio mancante o non valida." };
  if (from > target) return { ok: false, error: `Personaggio creato con una versione più recente dell'app (formato ${from}, supportato fino a ${target}). Aggiorna l'app.` };
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, error: `Manca la migrazione dal formato ${v} al ${v + 1}.` };
    try { data = { ...step(data), schemaVersion: v + 1 }; }
    catch (e) { return { ok: false, error: `Migrazione dal formato ${v} fallita: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  const parsed = characterSchema.safeParse(data);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `Personaggio non valido (${i?.path.join(".") || "radice"}: ${i?.message ?? "errore"}).` };
  }
  return from < target ? { ok: true, character: parsed.data, migratedFrom: from } : { ok: true, character: parsed.data };
}
