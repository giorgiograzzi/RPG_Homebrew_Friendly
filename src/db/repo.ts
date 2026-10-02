import Dexie, { type EntityTable } from "dexie";
import { hbKey, type HbEntry } from "../engine/homebrew";
import type { Character } from "../engine/types";
import { tr } from "../i18n/tr";
import { migrateCharacter } from "./migrations";

// Riga salvata: i dati restano nel formato con cui sono stati scritti, si migrano alla lettura
export interface CharacterRow { id: string; name: string; updatedAt: number; data: unknown }
export interface SettingRow { key: string; value: unknown }
// Una voce homebrew per riga (chiave "tipo/id"): due schede aperte non si sovrascrivono l'intero elenco
export interface HomebrewRow { key: string; entry: HbEntry }
// Copie di sicurezza di un personaggio (prima di salire di livello o di riaprire la creazione)
export interface SnapshotRow { id?: number; characterId: string; createdAt: number; label: string; data: unknown }
export interface CharacterSummary { id: string; name: string; updatedAt: number }
export type LoadResult = { ok: true; character: Character } | { ok: false; id: string; error: string };

export const SNAPSHOTS_PER_CHARACTER = 10;

class AppDb extends Dexie {
  characters!: EntityTable<CharacterRow, "id">;
  settings!: EntityTable<SettingRow, "key">;
  homebrew!: EntityTable<HomebrewRow, "key">;
  snapshots!: EntityTable<SnapshotRow, "id">;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ characters: "id, updatedAt", settings: "key" });
    // v2: homebrew a righe e copie di sicurezza. L'elenco homebrew della v1 (un'unica riga in `settings`) si sposta nella nuova tabella.
    this.version(2).stores({ characters: "id, updatedAt", settings: "key", homebrew: "key", snapshots: "++id, characterId, createdAt" })
      .upgrade(async (tx) => {
        const old = await tx.table<SettingRow, string>("settings").get("homebrew");
        if (Array.isArray(old?.value)) {
          const rows = (old.value as HbEntry[]).filter((e) => e?.data?.id).map((entry) => ({ key: hbKey(entry), entry }));
          if (rows.length) await tx.table("homebrew").bulkPut(rows);
        }
        await tx.table("settings").delete("homebrew");
      });
  }
}

export function createRepo(dbName = "srd-personaggi") {
  const db = new AppDb(dbName);
  return {
    async list(): Promise<CharacterSummary[]> {
      const rows = await db.characters.orderBy("updatedAt").reverse().toArray();
      return rows.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
    },
    async load(id: string): Promise<LoadResult> {
      const row = await db.characters.get(id);
      if (!row) return { ok: false, id, error: tr("Personaggio non trovato.", "Character not found.") };
      const r = migrateCharacter(row.data);
      return r.ok ? { ok: true, character: r.character } : { ok: false, id, error: r.error };
    },
    // Dati così come stanno nell'archivio, anche se non passano la validazione: servono a recuperare un personaggio rovinato
    async loadRaw(id: string): Promise<unknown> { return (await db.characters.get(id))?.data; },
    async save(ch: Character, now = Date.now()): Promise<void> {
      await db.characters.put({ id: ch.id, name: ch.name, updatedAt: now, data: ch });
    },
    async remove(id: string): Promise<void> {
      await db.transaction("rw", db.characters, db.snapshots, async () => {
        await db.characters.delete(id);
        await db.snapshots.where("characterId").equals(id).delete();
      });
    },
    async getSetting<T>(key: string): Promise<T | undefined> { return (await db.settings.get(key))?.value as T | undefined; },
    async setSetting(key: string, value: unknown): Promise<void> { await db.settings.put({ key, value }); },

    async listHomebrew(): Promise<HbEntry[]> { return (await db.homebrew.toArray()).map((r) => r.entry); },
    // Scrive solo ciò che è cambiato rispetto a `prev` (l'elenco che questa scheda conosceva): le voci aggiunte altrove restano
    async syncHomebrew(prev: HbEntry[], next: HbEntry[]): Promise<void> {
      const keep = new Set(next.map(hbKey));
      const gone = prev.map(hbKey).filter((k) => !keep.has(k));
      await db.transaction("rw", db.homebrew, async () => {
        if (gone.length) await db.homebrew.bulkDelete(gone);
        await db.homebrew.bulkPut(next.map((entry) => ({ key: hbKey(entry), entry })));
      });
    },

    async addSnapshot(ch: Character, label: string, now = Date.now()): Promise<void> {
      await db.transaction("rw", db.snapshots, async () => {
        await db.snapshots.add({ characterId: ch.id, createdAt: now, label, data: ch });
        const all = await db.snapshots.where("characterId").equals(ch.id).sortBy("createdAt");
        const extra = all.slice(0, Math.max(0, all.length - SNAPSHOTS_PER_CHARACTER));
        if (extra.length) await db.snapshots.bulkDelete(extra.map((s) => s.id!));
      });
    },
    async listSnapshots(characterId: string): Promise<{ id: number; createdAt: number; label: string }[]> {
      const rows = await db.snapshots.where("characterId").equals(characterId).sortBy("createdAt");
      return rows.reverse().map((s) => ({ id: s.id!, createdAt: s.createdAt, label: s.label }));
    },
    async loadSnapshot(id: number): Promise<LoadResult> {
      const row = await db.snapshots.get(id);
      if (!row) return { ok: false, id: String(id), error: tr("Copia non trovata.", "Snapshot not found.") };
      const r = migrateCharacter(row.data);
      return r.ok ? { ok: true, character: r.character } : { ok: false, id: row.characterId, error: r.error };
    },
    close() { db.close(); },
  };
}
export type Repo = ReturnType<typeof createRepo>;
