import { useEffect, useState } from "react";
import it from "./i18n/it.json";
import { Characters } from "./pages/Characters";
import { Homebrew } from "./pages/Homebrew";
import { Sheet } from "./pages/Sheet";
import { ImportDialog, Settings, exportNow } from "./pages/Settings";
import type { ImportPreview } from "./db/backup";
import { SectionBar, TabBar, icons, type IconName, type TabDef } from "./ui/xp";
import { SHEET_SECTIONS, type SheetView } from "./sheet/sections";
import { isFinalized } from "./wizard/logic";
import { ReloadPrompt } from "./ui/ReloadPrompt";
import { useApp } from "./ui/useApp";

const SECTION_ICONS: Record<(typeof SHEET_SECTIONS)[number], IconName> = { status: "heart", features: "star", stats: "chart", attacks: "sword", equip: "equip", magic: "magic", misc: "notes" };
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
  const [importing, setImporting] = useState<ImportPreview | null>(null);

  useEffect(() => { void init(); }, [init]);
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
  const inSheet = shown === "sheet" && !!current && isFinalized(current);
  const Menu = icons.menu;
  const pickFile = () => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "application/json,.json" });
    input.onchange = () => { const f = input.files?.[0]; if (f) void f.text().then(previewImport).then(setImporting); };
    input.click();
  };

  if (!ready) return null;
  return (
    <div className={`xp-app hand-${hand}`}>
      <header className="xp-title">
        <h1>{current ? current.name || it.characters.unnamed : it.app.title}</h1>
        <span className="xp-status" role="status" aria-live="polite">{saveStatus === "error" ? it.settings.saveStatus.error : ""}</span>
        <button type="button" className="xp-title-btn" aria-label={it.menu.open} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu /></button>
      </header>
      {menu && (
        <div className="xp-menu" role="menu" onClick={() => setMenu(false)}>
          <button type="button" role="menuitem" onClick={() => setSettings(true)}>{it.menu.settings}</button>
          <button type="button" role="menuitem" onClick={() => void exportNow(exportAll)}>{it.menu.export}</button>
          <button type="button" role="menuitem" onClick={pickFile}>{it.menu.import}</button>
        </div>
      )}
      <main className="xp-body">
        {settings ? <Settings onBack={() => setSettings(false)} /> : (
          <>
            {shown === "characters" && <Characters onOpened={() => { setSection("status"); setTab("sheet"); }} />}
            {shown === "sheet" && <Sheet section={section} onSection={setSection} />}
            {shown === "homebrew" && <Homebrew />}
          </>
        )}
      </main>
      {inSheet
        ? <SectionBar items={SHEET_SECTIONS.map((id) => ({ id, label: it.play.tabs[id], icon: SECTION_ICONS[id] }))} current={section === "conditions" ? "status" : section} backLabel={it.play.back}
            onSelect={(id) => { setSettings(false); setSection(id as SheetView); }} onBack={() => { setSettings(false); setTab("characters"); }} />
        : <TabBar tabs={tabs} current={shown} onSelect={(id) => { setSettings(false); setTab(id as TabId); }} />}
      {importing && <ImportDialog preview={importing} onClose={() => setImporting(null)} onDone={() => setImporting(null)} />}
      <ReloadPrompt />
    </div>
  );
}
