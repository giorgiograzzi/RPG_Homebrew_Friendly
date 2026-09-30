import { z } from "zod";
import { DEFAULT_SETTINGS, type Settings } from "../engine/settings";

// Impostazioni dell'app: regole di gioco + preferenze di salvataggio
export interface AppSettings extends Settings {
  hand: "right" | "left" | "center"; // da che parte stanno i comandi principali (pollice)
  allowReroll: boolean; // permette di rifare i tiri dei punteggi nella creazione
  backupReminderDays: number; // 0 = promemoria disattivato
  lastBackupAt: number | null;
}
export const DEFAULT_APP_SETTINGS: AppSettings = { ...DEFAULT_SETTINGS, hand: "right", allowReroll: false, backupReminderDays: 30, lastBackupAt: null };

const schema = z.object({
  weaponSwap: z.enum(["official", "house"]).catch(DEFAULT_APP_SETTINGS.weaponSwap),
  hand: z.enum(["right", "left", "center"]).catch(DEFAULT_APP_SETTINGS.hand),
  allowReroll: z.boolean().catch(DEFAULT_APP_SETTINGS.allowReroll),
  backupReminderDays: z.number().int().min(0).max(365).catch(DEFAULT_APP_SETTINGS.backupReminderDays),
  lastBackupAt: z.number().nullable().catch(null),
});

// Tollerante: valori mancanti o sbagliati tornano al default (impostazioni scritte da versioni diverse)
export function normalizeSettings(raw: unknown): AppSettings {
  return schema.parse(typeof raw === "object" && raw !== null ? raw : {});
}

export function backupDue(s: AppSettings, now = Date.now()): boolean {
  if (s.backupReminderDays === 0) return false;
  if (s.lastBackupAt === null) return true;
  return now - s.lastBackupAt >= s.backupReminderDays * 86_400_000;
}
