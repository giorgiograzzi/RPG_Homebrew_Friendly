import { useEffect, useRef, useState } from "react";
import type { ImportPreview, Resolution } from "../db/backup";
import { getLangPref, setLangPref, strings as it, type LangPref } from "../i18n";
import { Button, Check, Dialog, Field, Segmented } from "../ui/theme";
import { getThemePref, setThemePref, type ThemePref } from "../ui/theme/mode";
import { fmt, formatDate } from "../ui/format";
import type { PolicyKind } from "../legal/policies";
import { resetCookieNotice } from "../ui/CookieBanner";
import { InstallHint } from "../ui/InstallHint";
import { useApp } from "../ui/useApp";
import { backupDue, formatBytes, requestPersistence, storageInfo, type StorageInfo } from "../store";

const t = it.settings;
const REMINDERS = [0, 7, 14, 30, 90];

export function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const exportNow = async (exportAll: () => Promise<string>) =>
  download(await exportAll(), `personaggi-srd-${new Date().toISOString().slice(0, 10)}.json`);

const isStandalone = () => { try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true; } catch { return false; } };

function StorageStatus() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => { void storageInfo().then(setInfo); }, []);
  if (!info) return null;
  const tt = t.storage;
  return (
    <fieldset className="ui-group">
      <legend>{tt.title}</legend>
      <p role="status">{!info.supported ? (isStandalone() ? tt.installedNoApi : tt.unsupported) : info.persisted ? tt.persisted : tt.notPersisted}</p>
      {info.usage !== undefined && info.quota !== undefined && <p className="ui-muted">{fmt(tt.usage, { u: formatBytes(info.usage), q: formatBytes(info.quota) })}</p>}
      {info.supported && !info.persisted && <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => void requestPersistence().then(setInfo)}>{tt.request}</Button></div>}
    </fieldset>
  );
}

export function Settings({ onBack, onLegal }: { onBack: () => void; onLegal: (kind: PolicyKind) => void }) {
  const s = useApp((x) => x.settings);
  const saveStatus = useApp((x) => x.saveStatus);
  const updateSettings = useApp((x) => x.updateSettings);
  const exportAll = useApp((x) => x.exportAll);
  const flush = useApp((x) => x.flush);
  const [importing, setImporting] = useState<{ preview: ImportPreview } | null>(null);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<ThemePref>(getThemePref());
  const file = useRef<HTMLInputElement>(null);
  const previewImport = useApp((x) => x.previewImport);

  return (
    <>
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}>
        <Button onClick={onBack}>← {t.back}</Button>
      </div>
      <h2>{t.title}</h2>
      <p className="ui-muted" role="status">{t.saveStatus[saveStatus]}</p>

      <fieldset className="ui-group">
        <legend>{t.theme}</legend>
        <span className="ui-help">{t.themeHelp}</span>
        <Segmented label={t.theme} value={theme} onChange={(v: ThemePref) => { setThemePref(v); setTheme(v); }}
          options={[{ value: "auto", label: t.themeAuto }, { value: "light", label: t.themeLight }, { value: "dark", label: t.themeDark }]} />
        <div style={{ height: 12 }} />
      </fieldset>

      <fieldset className="ui-group">
        <legend>{t.language}</legend>
        <span className="ui-help">{t.languageHelp}</span>
        <Segmented label={t.language} value={getLangPref()} onChange={(pref: LangPref) => { void flush().then(() => setLangPref(pref)); }}
          options={[{ value: "auto", label: t.languageAuto }, { value: "it", label: "Italiano" }, { value: "en", label: "English" }]} />
        <div style={{ height: 12 }} />
      </fieldset>

      <fieldset className="ui-group">
        <legend>{t.hand}</legend>
        <span className="ui-help">{t.handHelp}</span>
        <Segmented label={t.hand} value={s.hand} onChange={(hand) => void updateSettings({ hand })}
          options={[{ value: "left", label: t.left }, { value: "center", label: t.center }, { value: "right", label: t.right }]} />
        <div style={{ height: 12 }} />
      </fieldset>

      <fieldset className="ui-group">
        <legend>{it.tabs.sheet}</legend>
        <Field label={t.weaponSwap}>
          <Segmented label={t.weaponSwap} value={s.weaponSwap} onChange={(weaponSwap) => void updateSettings({ weaponSwap })}
            options={[{ value: "house", label: t.house }, { value: "official", label: t.official }]} />
        </Field>
        <Check checked={s.allowReroll} onChange={(allowReroll) => void updateSettings({ allowReroll })}>{t.allowReroll}</Check>
      </fieldset>

      <StorageStatus />

      <InstallHint />

      <fieldset className="ui-group">
        <legend>{t.privacy.title}</legend>
        <p>{t.privacy.text}</p>
        <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <Button onClick={() => onLegal("privacy")}>{t.privacy.privacy}</Button>
          <Button onClick={() => onLegal("cookies")}>{t.privacy.cookies}</Button>
          <Button onClick={resetCookieNotice}>{t.privacy.showNotice}</Button>
        </div>
      </fieldset>

      <fieldset className="ui-group">
        <legend>{t.backup}</legend>
        {backupDue(s) && <div className="ui-banner" role="alert">{t.backupDue}</div>}
        <Field label={t.reminder}>
          <select className="ui-select" value={s.backupReminderDays} onChange={(e) => void updateSettings({ backupReminderDays: Number(e.target.value) })}>
            {REMINDERS.map((n) => <option key={n} value={n}>{n === 0 ? t.reminderOff : fmt(t.reminderDays, { n })}</option>)}
          </select>
        </Field>
        <p>{t.lastBackup}: <strong>{s.lastBackupAt ? formatDate(s.lastBackupAt) : t.never}</strong></p>
        <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <Button variant="primary" onClick={() => void exportNow(exportAll)}>{t.exportNow}</Button>
          <Button onClick={() => file.current?.click()}>{t.importFile}</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (f) void f.text().then((text) => previewImport(text)).then((preview) => setImporting({ preview }));
          }} />
        {message && <p role="status">{message}</p>}
      </fieldset>

      <p className="ui-help" data-testid="build">{t.version}: {__BUILD__}</p>

      {importing && <ImportDialog preview={importing.preview} onClose={() => setImporting(null)} onDone={(m) => { setImporting(null); setMessage(m); }} />}
    </>
  );
}

export function ImportDialog({ preview, onClose, onDone }: { preview: ImportPreview; onClose: () => void; onDone: (msg: string) => void }) {
  const commitImport = useApp((x) => x.commitImport);
  const [res, setRes] = useState<Record<string, Resolution>>({});
  const st = it.import.status;
  const importable = preview.ok && preview.items.some((i) => i.status === "new" || i.status === "conflict");
  return (
    <Dialog title={it.import.title} onClose={onClose}>
      {!preview.ok ? <div className="ui-error" role="alert"><strong>{it.import.error}.</strong> {preview.error}</div> : (
        <>
          {preview.items.length === 0 && <p>{it.import.nothing}</p>}
          <ul className="ui-list">
            {preview.items.map((i) => (
              <li key={i.index} style={{ flexWrap: "wrap" }}>
                <div className="grow">
                  <div className="name">{i.name || it.characters.unnamed}</div>
                  <div className="ui-muted">{st[i.status]}{i.error ? `: ${i.error}` : ""}</div>
                </div>
                {i.status === "conflict" && (
                  <select className="ui-select" style={{ width: "auto" }} aria-label={i.name} value={res[i.id] ?? "copy"} onChange={(e) => setRes({ ...res, [i.id]: e.target.value as Resolution })}>
                    {(["copy", "replace", "skip"] as const).map((r) => <option key={r} value={r}>{it.import.resolve[r]}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="ui-actions footer">
        <Button onClick={onClose}>{it.import.cancel}</Button>
        {importable && <Button variant="primary" onClick={() => void commitImport(preview, res).then((n) => onDone(fmt(it.import.done, { n })))}>{it.import.apply}</Button>}
      </div>
    </Dialog>
  );
}
