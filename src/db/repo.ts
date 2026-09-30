import Dexie, { type EntityTable } from "dexie";
import type { Character } from "../engine/types";
import { migrateCharacter } from "./migrations";

// Riga salvata: i dati restano nel formato con cui sono stati scritti, si migrano alla lettura
export interface CharacterRow { id: string; name: string; updatedAt: number; data: unknown }
export interface SettingRow { key: string; value: unknown }
export interface CharacterSummary { id: string; name: string; updatedAt: number }
export type LoadResult = { ok: true; character: Character } | { ok: false; id: string; error: string };

class AppDb extends Dexie {
  characters!: EntityTable<CharacterRow, "id">;
  settings!: EntityTable<SettingRow, "key">;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ characters: "id, updatedAt", settings: "key" });
  }
}

export function createRepo(dbName = "dnd-personaggi") {
  const db = new AppDb(dbName);
  return {
    async list(): Promise<CharacterSummary[]> {
      const rows = await db.characters.orderBy("updatedAt").reverse().toArray();
      return rows.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
    },
    async load(id: string): Promise<LoadResult> {
      const row = await db.characters.get(id);
      if (!row) return { ok: false, id, error: "Personaggio non trovato." };
      const r = migrateCharacter(row.data);
      return r.ok ? { ok: true, character: r.character } : { ok: false, id, error: r.error };
    },
    async save(ch: Character, now = Date.now()): Promise<void> {
      await db.characters.put({ id: ch.id, name: ch.name, updatedAt: now, data: ch });
    },
    async remove(id: string): Promise<void> { await db.characters.delete(id); },
    async getSetting<T>(key: string): Promise<T | undefined> { return (await db.settings.get(key))?.value as T | undefined; },
    async setSetting(key: string, value: unknown): Promise<void> { await db.settings.put({ key, value }); },
    close() { db.close(); },
  };
}
export type Repo = ReturnType<typeof createRepo>;
