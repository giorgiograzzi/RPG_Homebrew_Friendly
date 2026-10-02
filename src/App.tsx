import { useEffect, useState } from "react";
import { strings as it } from "./i18n";
import { Characters } from "./pages/Characters";
import { Homebrew } from "./pages/Homebrew";
import { Legal } from "./pages/Legal";
import { Licenses } from "./pages/Licenses";
import type { PolicyKind } from "./legal/policies";
import { CookieBanner } from "./ui/CookieBanner";
import { Sheet } from "./pages/Sheet";
import { ImportDialog, Settings, exportNow } from "./pages/Settings";
import type { ImportPreview } from "./db/backup";
import { SectionBar, TabBar, icons, type IconName, type TabDef } from "./ui/theme";
import { SHEET_SECTIONS, type SheetView } from "./sheet/sections";
import { isFinalized } from "./wizard/logic";
import { ReloadPrompt } from "./ui/ReloadPrompt";
import { useApp } from "./ui/useApp";
import { useMedia, WIDE } from "./ui/useMedia";
import { requestPersistence } from "./store";

const SECTION_ICONS: Record<(typeof SHEET_SECTIONS)[number], IconName> = { status: "heart", attacks: "sword", equip: "equip", magic: "magic", misc: "notes" };
// Le tab principali non riguardano un personaggio; Scheda, Equip e Magie sono sezioni della scheda
type TabId = "characters" | "sheet" | "homebrew";

export function App() {
  const init = useApp((s) => s.init);
  const ready = useApp((s) => s.ready);
  const current = useApp((s) => s.current);
  const hand = useApp((s) => s.settings.hand);
  const saveStatus = useApp((s) => s.saveStatus);
  const flush = useApp((s) => s.flush);
  const exportAll = useApp((s) => s.exportAll);
  const previewImport = useApp((s) => s.previewImport);
  const [tab, setTab] = useState<TabId>("characters");
  const [section, setSection] = useState<SheetView>("status");
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [about, setAbout] = useState(false);
  const [legal, setLegal] = useState<PolicyKind | null>(null);
  const [importing, setImporting] = useState<ImportPreview | null>(null);

  useEffect(() => { void init().then(() => requestPersistence()); }, [init]);
  // Salva subito quando l'app va in secondo piano o si chiude
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide); };
  }, [flush]);

  const tabs: TabDef[] = [
    { id: "characters", label: it.tabs.characters, icon: "characters" },
    { id: "homebrew", label: it.tabs.homebrew, icon: "homebrew" },
  ];
  const shown: TabId = !current && tab === "sheet" ? "characters" : tab;
  // scheda giocabile aperta: la barra in basso mostra le sue sezioni invece delle tab principali
  const wide = useMedia(WIDE);
  const inSheet = shown === "sheet" && !!current && isFinalized(current);
  const Menu = icons.menu;
  const menuLegal = (kind: PolicyKind) => { setSettings(false); setAbout(false); setLegal(kind); };
  const closeAll = () => { setSettings(false); setAbout(false); setLegal(null); };
  const pickFile = () => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "application/json,.json" });
    input.onchange = () => { const f = input.files?.[0]; if (f) void f.text().then(previewImport).then(setImporting); };
    input.click();
  };

  if (!ready) return null;
  return (
    <div className={`ui-app hand-${hand}`}>
      <a className="ui-skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>{it.app.skip}</a>
      <header className="ui-title">
        {inSheet && <button type="button" className="ui-title-btn ui-back" aria-label={it.play.back} title={it.play.back} onClick={() => { closeAll(); setTab("characters"); }}><icons.back /></button>}
        <h1>{current ? current.name || it.characters.unnamed : it.app.title}</h1>
        <span className="ui-status" role="status" aria-live="polite">{saveStatus === "error" ? it.settings.saveStatus.error : ""}</span>
        <button type="button" className="ui-title-btn" aria-label={it.menu.open} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu /></button>
      </header>
      {menu && (
        <div className="ui-menu" role="menu" onClick={() => setMenu(false)} onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}>
          <button type="button" role="menuitem" onClick={() => { setAbout(false); setLegal(null); setSettings(true); }}>{it.menu.settings}</button>
          <button type="button" role="menuitem" onClick={() => { setSettings(false); setLegal(null); setAbout(true); }}>{it.menu.about}</button>
          <button type="button" role="menuitem" onClick={() => menuLegal("privacy")}>{it.menu.privacy}</button>
          <button type="button" role="menuitem" onClick={() => menuLegal("cookies")}>{it.menu.cookies}</button>
          <button type="button" role="menuitem" onClick={() => void exportNow(exportAll)}>{it.menu.export}</button>
          <button type="button" role="menuitem" onClick={pickFile}>{it.menu.import}</button>
        </div>
      )}
      <main className="ui-body" id="main" tabIndex={-1}>
        {legal ? <Legal kind={legal} onBack={() => setLegal(null)} onOpen={setLegal} /> : about ? <Licenses onBack={() => setAbout(false)} onLegal={setLegal} /> : settings ? <Settings onBack={() => setSettings(false)} onLegal={setLegal} /> : (
          <>
            {shown === "characters" && <Characters onOpened={() => { setSection("status"); setTab("sheet"); }} />}
            {shown === "sheet" && <Sheet section={section} onSection={setSection} />}
            {shown === "homebrew" && <Homebrew />}
          </>
        )}
      </main>
      {inSheet
        ? <SectionBar items={SHEET_SECTIONS.filter((id) => !wide || !(["attacks", "magic"] as string[]).includes(id)).map((id) => ({ id, label: id === "status" && wide ? it.play.tabs.overview : it.play.tabs[id], icon: SECTION_ICONS[id] }))} current={section === "conditions" || (wide && ["attacks", "magic"].includes(section)) ? "status" : section} backLabel={it.play.back}
            onSelect={(id) => { closeAll(); setSection(id as SheetView); }} onBack={() => { closeAll(); setTab("characters"); }} />
        : <TabBar tabs={tabs} current={shown} onSelect={(id) => { closeAll(); setTab(id as TabId); }} />}
      {importing && <ImportDialog preview={importing} onClose={() => setImporting(null)} onDone={() => setImporting(null)} />}
      <CookieBanner onOpen={setLegal} open={!!legal} />
      <ReloadPrompt />
    </div>
  );
}
