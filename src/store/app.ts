import { createStore } from "zustand/vanilla";
import { newId } from "../db/id";
import { applyImport, exportBackup, previewImport, type ImportPreview, type Resolution } from "../db/backup";
import type { CharacterSummary, Repo } from "../db/repo";
import { emptyCharacter } from "../engine/character";
import { charactersUsing, mergeEntries, type HbEntry } from "../engine/homebrew";
import type { Character } from "../engine/types";
import { normalizeSettings, type AppSettings, DEFAULT_APP_SETTINGS } from "./settings";
import { tr } from "../i18n/tr";

// Scheduler iniettabile: nei test si controlla il tempo a mano
export interface Scheduler { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }
const realScheduler: Scheduler = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

// Canale tra schede dello stesso browser (BroadcastChannel): chi salva avvisa le altre, così non si sovrascrivono in silenzio
export type SyncMessage = { type: "character"; id: string } | { type: "homebrew" };
export interface Channel { post(m: SyncMessage): void; subscribe(cb: (m: SyncMessage) => void): void }
export const broadcastChannel = (name = "srd-personaggi-sync"): Channel | undefined => {
  if (typeof BroadcastChannel === "undefined") return undefined;
  const bc = new BroadcastChannel(name);
  return { post: (m) => bc.postMessage(m), subscribe: (cb) => { bc.onmessage = (e) => cb(e.data as SyncMessage); } };
};

export type SaveStatus = "saved" | "pending" | "saving" | "error";
export interface AppState {
  ready: boolean;
  list: CharacterSummary[];
  current: Character | null;
  saveStatus: SaveStatus;
  error: string | null;
  settings: AppSettings;
  homebrew: HbEntry[]; // voci homebrew (attive e no); quelle attive entrano nel ruleset
}
export interface AppActions {
  init(): Promise<void>;
  create(): Promise<Character>;
  open(id: string): Promise<boolean>;
  close(): Promise<void>;
  // Modifica il personaggio aperto; il salvataggio avviene da solo dopo una breve pausa
  update(fn: (c: Character) => Character): void;
  flush(): Promise<void>;
  remove(id: string): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  setHomebrew(entries: HbEntry[]): Promise<void>;
  // nomi dei personaggi salvati che usano almeno una di queste voci homebrew (per avvisare prima di spegnerle o cancellarle)
  homebrewUsers(ids: string[]): Promise<string[]>;
  exportAll(): Promise<string>;
  exportOne(id: string): Promise<string | null>; // un solo personaggio, nello stesso formato del backup
  exportRaw(id: string): Promise<string | null>; // dati grezzi di un personaggio che non si apre più
  duplicate(id: string): Promise<string | null>; // copia con un nuovo id; restituisce il nuovo id
  snapshot(label: string): Promise<void>; // copia di sicurezza del personaggio aperto
  snapshots(): Promise<{ id: number; createdAt: number; label: string }[]>;
  restoreSnapshot(id: number): Promise<boolean>;
  previewImport(text: string): Promise<ImportPreview>;
  commitImport(preview: ImportPreview, resolutions?: Record<string, Resolution>): Promise<number>;
}

export interface StoreDeps { repo: Repo; channel?: Channel; scheduler?: Scheduler; debounceMs?: number; now?: () => number; newId?: () => string }

export function createAppStore({ repo, channel, scheduler = realScheduler, debounceMs = 800, now = Date.now, newId: makeId = newId }: StoreDeps) {
  let timer: unknown = null;
  let inFlight: Promise<void> = Promise.resolve();

  const store = createStore<AppState & AppActions>()((set, get) => {
    const refreshList = async () => set({ list: await repo.list() });
    const cancel = () => { if (timer !== null) { scheduler.clear(timer); timer = null; } };
    const allCharacters = async (): Promise<Character[]> => {
      const out: Character[] = [];
      for (const s of await repo.list()) { const r = await repo.load(s.id); if (r.ok) out.push(r.character); }
      return out;
    };

    const doSave = async () => {
      cancel();
      const ch = get().current;
      if (!ch || get().saveStatus === "saved") return;
      set({ saveStatus: "saving" });
      try {
        await repo.save(ch, now());
        channel?.post({ type: "character", id: ch.id });
        // se nel frattempo è arrivata un'altra modifica resta "pending"
        if (get().current === ch) set({ saveStatus: "saved", error: null });
        await refreshList();
      } catch (e) {
        set({ saveStatus: "error", error: tr(`Salvataggio fallito: ${e instanceof Error ? e.message : String(e)}`, `Save failed: ${e instanceof Error ? e.message : String(e)}`) });
      }
    };
    const enqueueSave = () => { inFlight = inFlight.then(doSave); return inFlight; };

    return {
      ready: false, list: [], current: null, saveStatus: "saved", error: null, settings: DEFAULT_APP_SETTINGS, homebrew: [],
      async init() {
        // se l'archivio del browser non risponde l'app si apre lo stesso, con l'errore in vista (mai pagina bianca)
        try {
          const settings = normalizeSettings(await repo.getSetting("app"));
          const homebrew = await repo.listHomebrew();
          set({ settings, homebrew, list: await repo.list(), ready: true });
        } catch (e) {
          set({ ready: true, error: tr(`Archivio del browser non disponibile: ${e instanceof Error ? e.message : String(e)}`, `Browser storage not available: ${e instanceof Error ? e.message : String(e)}`) });
        }
      },
      async create() {
        await get().flush();
        const ch = emptyCharacter(makeId());
        await repo.save(ch, now());
        set({ current: ch, saveStatus: "saved", error: null });
        await refreshList();
        return ch;
      },
      async open(id) {
        await get().flush();
        const r = await repo.load(id);
        if (!r.ok) { set({ error: r.error }); return false; }
        set({ current: r.character, saveStatus: "saved", error: null });
        return true;
      },
      async close() { await get().flush(); set({ current: null }); },
      update(fn) {
        const cur = get().current;
        if (!cur) return;
        set({ current: fn(cur), saveStatus: "pending" });
        cancel();
        timer = scheduler.set(() => { timer = null; void enqueueSave(); }, debounceMs);
      },
      async flush() { cancel(); if (get().saveStatus === "pending") await enqueueSave(); else await inFlight; },
      async remove(id) {
        if (get().current?.id === id) { cancel(); set({ current: null, saveStatus: "saved" }); }
        await inFlight;
        await repo.remove(id);
        await refreshList();
      },
      async updateSettings(patch) {
        const settings = normalizeSettings({ ...get().settings, ...patch });
        set({ settings });
        await repo.setSetting("app", settings);
      },
      async setHomebrew(entries) {
        const prev = get().homebrew;
        set({ homebrew: entries });
        await repo.syncHomebrew(prev, entries);
        channel?.post({ type: "homebrew" });
      },
      async homebrewUsers(ids) {
        await get().flush();
        return charactersUsing(await allCharacters(), ids).map((c) => c.name || tr("Senza nome", "Unnamed"));
      },
      async exportAll() {
        await get().flush();
        const chars = await allCharacters();
        const text = exportBackup(chars, get().settings, now(), get().homebrew); // tutta la libreria homebrew, anche le voci non ancora usate
        await get().updateSettings({ lastBackupAt: now() });
        return text;
      },
      async exportOne(id) {
        await get().flush();
        const r = await repo.load(id);
        return r.ok ? exportBackup([r.character], undefined, now()) : null;
      },
      async exportRaw(id) {
        const raw = await repo.loadRaw(id);
        return raw === undefined ? null : JSON.stringify(raw, null, 2);
      },
      async duplicate(id) {
        await get().flush();
        const r = await repo.load(id);
        if (!r.ok) return null;
        const copy = { ...r.character, id: makeId(), name: `${r.character.name} ${tr("(copia)", "(copy)")}`.trim() };
        await repo.save(copy, now());
        await refreshList();
        return copy.id;
      },
      async snapshot(label) {
        const cur = get().current; // lo stato di adesso: chi chiama modifica subito dopo
        await get().flush();
        if (cur) await repo.addSnapshot(cur, label, now());
      },
      async snapshots() { const cur = get().current; return cur ? repo.listSnapshots(cur.id) : []; },
      async restoreSnapshot(sid) {
        const r = await repo.loadSnapshot(sid);
        const cur = get().current;
        if (!r.ok || !cur || r.character.id !== cur.id) return false;
        await get().snapshot(tr("Prima del ripristino", "Before restore"));
        cancel();
        set({ current: r.character, saveStatus: "pending" });
        await enqueueSave();
        return true;
      },
      async previewImport(text) { await get().flush(); return previewImport(text, await allCharacters()); },
      async commitImport(preview, resolutions) {
        const toSave = applyImport(preview, resolutions, makeId);
        for (const c of toSave) await repo.save(c, now());
        // se si è sostituito il personaggio aperto, lo si ricarica
        const cur = get().current;
        const replaced = cur && toSave.find((c) => c.id === cur.id);
        if (replaced) set({ current: replaced, saveStatus: "saved" });
        // voci homebrew del backup: si aggiungono a quelle che ci sono già (le esistenti restano com'erano, attive o no)
        if (preview.ok && preview.homebrew?.length) {
          const have = new Set(get().homebrew.map((e) => `${e.kind}/${e.data.id}`));
          const fresh = preview.homebrew.filter((e) => !have.has(`${e.kind}/${e.data.id}`));
          if (fresh.length) await get().setHomebrew(mergeEntries(get().homebrew, fresh).entries);
        }
        await refreshList();
        return toSave.length;
      },
    };
  });
  // un'altra scheda ha salvato: si ricarica ciò che è cambiato, a meno che qui ci siano modifiche non ancora salvate
  channel?.subscribe(async (m) => {
    const st = store.getState();
    if (m.type === "homebrew") { store.setState({ homebrew: await repo.listHomebrew() }); return; }
    store.setState({ list: await repo.list() });
    if (st.current?.id !== m.id) return;
    if (st.saveStatus === "saved") {
      const r = await repo.load(m.id);
      if (r.ok) store.setState({ current: r.character });
    } else store.setState({ error: tr("Questo personaggio è stato modificato in un'altra scheda: i tuoi ultimi cambi potrebbero sovrascriverlo.", "This character was changed in another tab: your latest changes may overwrite it.") });
  });
  return store;
}
export type AppStore = ReturnType<typeof createAppStore>;
