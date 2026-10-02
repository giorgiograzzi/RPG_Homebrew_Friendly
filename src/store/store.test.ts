import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createRepo } from "../db/repo";
import { createAppStore, type Scheduler } from "./app";
import { backupDue, DEFAULT_APP_SETTINGS, normalizeSettings } from "./settings";

let n = 0;
function setup() {
  const tasks = new Map<number, () => void>();
  let id = 0, ids = 0, clock = 1000;
  const scheduler: Scheduler = { set: (fn) => { tasks.set(++id, fn); return id; }, clear: (h) => { tasks.delete(h as number); } };
  const repo = createRepo(`store-${++n}`);
  const store = createAppStore({ repo, scheduler, now: () => clock, newId: () => `id${++ids}` });
  const tick = () => { const all = [...tasks.values()]; tasks.clear(); all.forEach((f) => f()); };
  return { repo, store, tasks, tick, advance: (ms: number) => { clock += ms; } };
}

describe("store: salvataggio automatico", () => {
  it("modifica → pending → salva dopo la pausa (una sola scrittura per raffica)", async () => {
    const { store, repo, tasks, tick } = setup();
    await store.getState().init();
    const ch = await store.getState().create();
    store.getState().update((c) => ({ ...c, name: "A" }));
    store.getState().update((c) => ({ ...c, name: "Ab" }));
    expect(store.getState().saveStatus).toBe("pending");
    expect(tasks.size).toBe(1); // il timer è stato riarmato, non moltiplicato
    tick();
    await store.getState().flush();
    expect(store.getState().saveStatus).toBe("saved");
    const l = await repo.load(ch.id);
    expect(l.ok && l.character.name).toBe("Ab");
  });
  it("flush salva subito e cambiare personaggio non perde modifiche", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    const a = await store.getState().create();
    store.getState().update((c) => ({ ...c, name: "Prima" }));
    const b = await store.getState().create(); // create fa flush del precedente
    expect(b.id).not.toBe(a.id);
    const l = await repo.load(a.id);
    expect(l.ok && l.character.name).toBe("Prima");
    expect(store.getState().list).toHaveLength(2);
  });
  it("apre, segnala errori di apertura e cancella", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    const a = await store.getState().create();
    await store.getState().close();
    expect(store.getState().current).toBeNull();
    expect(await store.getState().open(a.id)).toBe(true);
    await repo.save({ ...a, id: "rotto", schemaVersion: 99 } as never, 5);
    expect(await store.getState().open("rotto")).toBe(false);
    expect(store.getState().error).toContain("più recente");
    await store.getState().remove(a.id);
    expect(store.getState().list.map((x) => x.id)).toEqual(["rotto"]);
  });
  it("update senza personaggio aperto non fa nulla", async () => {
    const { store, tasks } = setup();
    store.getState().update((c) => ({ ...c, name: "x" }));
    expect(tasks.size).toBe(0);
  });
  it("errore di scrittura → stato error, poi riprova", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    await store.getState().create();
    const real = repo.save;
    repo.save = async () => { throw new Error("disco pieno"); };
    store.getState().update((c) => ({ ...c, name: "X" }));
    await store.getState().flush();
    expect(store.getState().saveStatus).toBe("error");
    expect(store.getState().error).toContain("disco pieno");
    repo.save = real;
    store.getState().update((c) => ({ ...c, name: "Y" }));
    await store.getState().flush();
    expect(store.getState().saveStatus).toBe("saved");
  });
});

describe("store: backup e impostazioni", () => {
  it("export → import in un archivio vuoto ricrea tutto", async () => {
    const A = setup();
    await A.store.getState().init();
    await A.store.getState().create();
    A.store.getState().update((c) => ({ ...c, name: "Eroe", notes: "ciao" }));
    await A.store.getState().create();
    const text = await A.store.getState().exportAll();
    expect(A.store.getState().settings.lastBackupAt).toBe(1000);

    const B = setup();
    await B.store.getState().init();
    const p = await B.store.getState().previewImport(text);
    expect(p.ok && p.items.map((i) => i.status)).toEqual(["new", "new"]);
    expect(await B.store.getState().commitImport(p)).toBe(2);
    expect(B.store.getState().list).toHaveLength(2);
    // reimportando lo stesso file non cambia nulla
    const again = await B.store.getState().previewImport(text);
    expect(again.ok && again.items.every((i) => i.status === "same")).toBe(true);
    expect(await B.store.getState().commitImport(again)).toBe(0);
  });
  it("le impostazioni persistono e sono tolleranti ai valori sbagliati", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    await store.getState().updateSettings({ weaponSwap: "official", backupReminderDays: 7 });
    expect(await repo.getSetting("app")).toMatchObject({ weaponSwap: "official", backupReminderDays: 7 });
    expect(normalizeSettings({ weaponSwap: "boh", hand: 3, allowReroll: "sì", backupReminderDays: -3, lastBackupAt: "x" })).toEqual(DEFAULT_APP_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
  });
  it("promemoria backup", () => {
    const day = 86_400_000;
    expect(backupDue({ ...DEFAULT_APP_SETTINGS, lastBackupAt: null }, 0)).toBe(true);
    expect(backupDue({ ...DEFAULT_APP_SETTINGS, lastBackupAt: 0 }, 29 * day)).toBe(false);
    expect(backupDue({ ...DEFAULT_APP_SETTINGS, lastBackupAt: 0 }, 30 * day)).toBe(true);
    expect(backupDue({ ...DEFAULT_APP_SETTINGS, backupReminderDays: 0 }, 999 * day)).toBe(false);
  });
});

describe("store: homebrew", () => {
  it("si salva nell'archivio e torna alla riapertura; un incantesimo aggiunto a mano sopravvive al salvataggio", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    const entry = { kind: "feats" as const, enabled: true, data: { id: "hb_x", name: { it: "X" }, category: "general" } };
    await store.getState().setHomebrew([entry]);
    const again = createAppStore({ repo });
    await again.getState().init();
    expect(again.getState().homebrew).toEqual([entry]);

    const ch = await store.getState().create();
    store.getState().update((c) => ({ ...c, extraSpells: ["hb_s"], feats: [{ featId: "hb_x" }] }));
    await store.getState().flush();
    const l = await repo.load(ch.id);
    expect(l.ok && l.character.extraSpells).toEqual(["hb_s"]);
  });
  it("il backup porta tutta la libreria homebrew (anche le voci non usate e quelle spente) e si ripristina su un altro dispositivo", async () => {
    const a = setup();
    await a.store.getState().init();
    const on = { kind: "feats" as const, enabled: true, data: { id: "hb_a", name: { it: "A" }, category: "general" } };
    const off = { kind: "items" as const, enabled: false, data: { id: "hb_b", name: { it: "B" }, category: "Oggetto magico", effects: [{ op: "acBonus", value: 1 }] } };
    await a.store.getState().setHomebrew([on, off]);
    await a.store.getState().create();
    const text = await a.store.getState().exportAll();

    const b = setup();
    await b.store.getState().init();
    const preview = await b.store.getState().previewImport(text);
    await b.store.getState().commitImport(preview, {});
    expect(b.store.getState().homebrew).toEqual([on, off]);
  });
});

describe("store: archivio sicuro (P2-2)", () => {
  const mkEntry = (id: string) => ({ kind: "feats" as const, enabled: true, data: { id, name: { it: id, en: id }, description: { it: "", en: "" }, category: "general" } }) as never;
  it("migra l'homebrew della v1 (un blocco in settings) alla tabella a righe", async () => {
    const Dexie = (await import("dexie")).default;
    const name = `mig-${++n}`;
    const old = new Dexie(name);
    old.version(1).stores({ characters: "id, updatedAt", settings: "key" });
    await old.table("settings").put({ key: "homebrew", value: [mkEntry("a"), mkEntry("b")] });
    old.close();
    const repo = createRepo(name);
    expect((await repo.listHomebrew()).map((e) => (e.data as { id: string }).id).sort()).toEqual(["a", "b"]);
    expect(await repo.getSetting("homebrew")).toBeUndefined();
  });
  it("due schede: le voci homebrew aggiunte altrove non si perdono, e le modifiche arrivano all'altra scheda", async () => {
    const listeners: ((m: never) => void)[] = [];
    const bus = (): import("./app").Channel => ({ post: (m) => listeners.forEach((l) => l(m as never)), subscribe: (cb) => { listeners.push(cb as never); } });
    const repo = createRepo(`store-${++n}`);
    const a = createAppStore({ repo, channel: bus(), newId: () => "x1" });
    const b = createAppStore({ repo, channel: bus(), newId: () => "x2" });
    await a.getState().init(); await b.getState().init();
    await a.getState().setHomebrew([mkEntry("da_a")]);
    await new Promise((r) => setTimeout(r, 20));
    expect(b.getState().homebrew).toHaveLength(1); // arrivata via canale
    await b.getState().setHomebrew([...b.getState().homebrew, mkEntry("da_b")]);
    expect((await repo.listHomebrew()).length).toBe(2);
    // un personaggio aperto in entrambe: la modifica di A compare in B (B non ha modifiche in sospeso)
    const ch = await a.getState().create();
    await b.getState().open(ch.id);
    a.getState().update((c) => ({ ...c, name: "Da A" }));
    await a.getState().flush();
    await new Promise((r) => setTimeout(r, 20));
    expect(b.getState().current?.name).toBe("Da A");
    // se B ha modifiche non salvate, non si sovrascrive in silenzio: compare un avviso
    b.getState().update((c) => ({ ...c, name: "Da B" }));
    a.getState().update((c) => ({ ...c, name: "Di nuovo A" }));
    await a.getState().flush();
    await new Promise((r) => setTimeout(r, 20));
    expect(b.getState().current?.name).toBe("Da B");
    expect(b.getState().error).toContain("altra scheda");
  });
  it("snapshot: se ne tengono 10 per personaggio e si ripristina", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    await store.getState().create();
    for (let i = 0; i < 12; i++) {
      store.getState().update((c) => ({ ...c, name: `v${i}` }));
      await store.getState().snapshot(`s${i}`);
    }
    const list = await store.getState().snapshots();
    expect(list).toHaveLength(10);
    expect(list[0]!.label).toBe("s11");
    const old = list[list.length - 1]!; // s2 → nome v2
    expect(await store.getState().restoreSnapshot(old.id)).toBe(true);
    expect(store.getState().current?.name).toBe("v2");
    expect(store.getState().saveStatus).toBe("saved");
    const l = await repo.load(store.getState().current!.id);
    expect(l.ok && l.character.name).toBe("v2");
  });
  it("duplica, esporta un solo personaggio e recupera i dati grezzi di una riga rovinata", async () => {
    const { store, repo } = setup();
    await store.getState().init();
    const ch = await store.getState().create();
    store.getState().update((c) => ({ ...c, name: "Aria" }));
    const dupId = await store.getState().duplicate(ch.id);
    expect(dupId).not.toBe(ch.id);
    const dup = await repo.load(dupId!);
    expect(dup.ok && dup.character.name).toBe("Aria (copia)");
    const one = JSON.parse((await store.getState().exportOne(ch.id))!);
    expect(one.characters).toHaveLength(1);
    // righe rovinate: i dati grezzi si recuperano anche se non passano la validazione; id sconosciuto → null
    expect(JSON.parse((await store.getState().exportRaw(ch.id))!).id).toBe(ch.id);
    expect(await store.getState().exportRaw("inesistente")).toBeNull();
  });
});
