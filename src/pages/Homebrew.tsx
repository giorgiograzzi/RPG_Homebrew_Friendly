import { useRef, useState } from "react";
import { examplePacks } from "../data/loadRuleset";
import { useRuleset } from "../data/ruleset";
import {
  HB_KINDS, KIND_GROUPS, buildPack, duplicateEntry, hbKey, mergeEntries, packNames, parsePack, slugify, type HbEntry, type HbKind, type ParsedPack,
} from "../engine/homebrew";
import { Editor } from "../homebrew/Editor";
import { canGiveKind, give, has, take } from "../homebrew/give";
import { summarize } from "../homebrew/summary";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Check, Dialog, Field } from "../ui/theme";
import { useApp } from "../ui/useApp";
import { isFinalized } from "../wizard/logic";
import { download } from "./Settings";
import { tr } from "../i18n/tr";

const t = it.homebrew;

type Editing = { kind: HbKind; entry: HbEntry | null; presetClassId?: string };

export function Homebrew() {
  const rs = useRuleset();
  const entries = useApp((s) => s.homebrew);
  const setHomebrew = useApp((s) => s.setHomebrew);
  const homebrewUsers = useApp((s) => s.homebrewUsers);
  const ch = useApp((s) => s.current);
  const update = useApp((s) => s.update);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [choose, setChoose] = useState(false);
  const [del, setDel] = useState<HbEntry | null>(null);
  const [warn, setWarn] = useState<{ names: string[]; run: () => void } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [packFilter, setPackFilter] = useState("all");
  const [note, setNote] = useState("");

  if (editing) {
    return (
      <Editor kind={editing.kind} initial={editing.entry} rs={rs} existing={entries} {...(editing.presetClassId ? { presetClassId: editing.presetClassId } : {})}
        onCancel={() => setEditing(null)}
        onSave={(e, then) => {
          const exists = entries.some((x) => hbKey(x) === hbKey(e));
          void setHomebrew(exists ? entries.map((x) => (hbKey(x) === hbKey(e) ? e : x)) : [...entries, e]);
          setNote(t.saved);
          setEditing(then ? { kind: then.kind, entry: null, ...(then.classId ? { presetClassId: then.classId } : {}) } : null);
        }} />
    );
  }

  const canGive = !!ch && isFinalized(ch);
  const packs = packNames(entries);
  const shownEntries = entries.filter((e) => packFilter === "all" || (packFilter === "none" ? !e.pack : e.pack === packFilter));
  const patch = (list: HbEntry[], patchFn: (e: HbEntry) => HbEntry) => void setHomebrew(entries.map((x) => (list.some((l) => hbKey(l) === hbKey(x)) ? patchFn(x) : x)));
  // Spegnere o eliminare una voce usata da personaggi salvati: prima si avvisa, con l'elenco dei personaggi coinvolti
  const guarded = async (list: HbEntry[], run: () => void) => {
    const names = await homebrewUsers(list.map((e) => e.data.id));
    if (names.length) setWarn({ names, run }); else run();
  };
  const setOne = (e: HbEntry, on: boolean) => { const run = () => patch([e], (x) => ({ ...x, enabled: on })); if (on) run(); else void guarded([e], run); };
  const setPack = (name: string, on: boolean) => {
    const list = entries.filter((e) => e.pack === name && e.enabled !== on);
    const run = () => patch(list, (x) => ({ ...x, enabled: on }));
    if (on) run(); else void guarded(list, run);
  };

  return (
    <>
      <h2>{t.title}</h2>
      <p className="ui-muted">{t.intro}</p>
      {note && <div className="ui-banner" role="status">{note}</div>}
      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={() => setChoose(true)}>{t.new}</Button>
        <Button onClick={() => setImporting(true)}>{t.import}</Button>
        <Button onClick={() => setExporting(true)} disabled={entries.length === 0}>{t.export}</Button>
      </div>
      {!canGive && <p className="ui-muted">{ch ? t.needSheet : t.noCharacter}</p>}
      {entries.length === 0 && <p className="ui-muted">{t.empty}</p>}
      {packs.length > 0 && (
        <fieldset className="ui-group">
          <legend>{t.pack}</legend>
          <Field label={t.pack}>
            <select className="ui-select" value={packFilter} onChange={(e) => setPackFilter(e.target.value)}>
              <option value="all">{t.allPacks}</option>
              {packs.map((p) => <option key={p} value={p}>{p}</option>)}
              {entries.some((e) => !e.pack) && <option value="none">{t.noPack}</option>}
            </select>
          </Field>
          {packFilter !== "all" && packFilter !== "none" && (
            <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <Button onClick={() => setPack(packFilter, true)}>{t.packOn}</Button>
              <Button onClick={() => setPack(packFilter, false)}>{t.packOff}</Button>
            </div>
          )}
        </fieldset>
      )}

      {HB_KINDS.map((kind) => {
        const list = shownEntries.filter((e) => e.kind === kind);
        if (!list.length) return null;
        return (
          <fieldset key={kind} className="ui-group">
            <legend>{t.kindsPlural[kind]}</legend>
            <ul className="pl-list">
              {list.map((e) => {
                const mine = canGive && ch && canGiveKind(e) ? has(ch, e) : false;
                return (
                  <li key={hbKey(e)} className="pl-feat hb-entry" data-enabled={e.enabled}>
                    <p style={{ margin: 0 }}><strong>{e.data.name.it}</strong> <span className="hb-badge">{t.badge}</span> {e.pack && <span className="ui-muted">· {e.pack}</span>} {!e.enabled && <span className="ui-muted">· {t.off}</span>}</p>
                    {summarize(kind, e.data, rs).map((l, i) => <p key={i} className="ui-muted" style={{ margin: "2px 0" }}>{l}</p>)}
                    <Check checked={e.enabled} onChange={(v) => setOne(e, v)}>{e.enabled ? t.on : t.toggleOn}</Check>
                    <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                      <Button onClick={() => setEditing({ kind, entry: e })}>{t.edit}</Button>
                      <Button onClick={() => void setHomebrew([...entries, duplicateEntry(e, rs, entries)])}>{t.duplicate}</Button>
                      <Button variant="danger" onClick={() => setDel(e)}>{t.delete}</Button>
                      {canGive && ch && e.enabled && canGiveKind(e) && (mine
                        ? <Button onClick={() => { update(() => take(ch, e)); setNote(fmt(t.removed, { name: ch.name || it.characters.unnamed })); }}>{t.remove}</Button>
                        : <Button variant="primary" onClick={() => { update(() => give(ch, e)); setNote(fmt(t.given, { name: ch.name || it.characters.unnamed })); }}>{fmt(t.giveTo, { name: ch.name || it.characters.unnamed })}</Button>)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      {choose && (
        <Dialog title={t.newWhat} onClose={() => setChoose(false)}>
          {KIND_GROUPS.map((g) => (
            <fieldset key={g.id} className="ui-group">
              <legend>{t.groups[g.id]}</legend>
              <div className="ui-actions" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>
                {g.kinds.map((k) => <Button key={k} onClick={() => { setChoose(false); setEditing({ kind: k, entry: null }); }}>{t.kinds[k]}</Button>)}
              </div>
            </fieldset>
          ))}
        </Dialog>
      )}
      {del && (
        <Dialog title={t.delete} onClose={() => setDel(null)}>
          <p>{t.confirmDelete}</p><p><strong>{del.data.name.it}</strong></p>
          <div className="ui-actions">
            <Button onClick={() => setDel(null)}>{t.cancel}</Button>
            <Button variant="danger" onClick={() => { const e = del; setDel(null); void guarded([e], () => void setHomebrew(entries.filter((x) => hbKey(x) !== hbKey(e)))); }}>{t.delete}</Button>
          </div>
        </Dialog>
      )}
      {warn && (
        <Dialog title={t.usedByAsk} onClose={() => setWarn(null)}>
          <p>{fmt(t.usedBy, { names: warn.names.join(", ") })}</p>
          <div className="ui-actions">
            <Button onClick={() => setWarn(null)}>{t.cancel}</Button>
            <Button variant="danger" onClick={() => { const r = warn.run; setWarn(null); r(); }}>{t.proceed}</Button>
          </div>
        </Dialog>
      )}
      {exporting && <ExportDialog entries={entries} onClose={() => setExporting(false)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={(m) => { setImporting(false); setNote(m); }} />}
    </>
  );
}

function ExportDialog({ entries, onClose }: { entries: HbEntry[]; onClose: () => void }) {
  const packs = packNames(entries);
  const [which, setWhich] = useState("all");
  const [name, setName] = useState(packs.length === 1 ? packs[0]! : tr("Il mio homebrew", "My homebrew"));
  const chosen = which === "all" ? entries : entries.filter((e) => e.pack === which);
  return (
    <Dialog title={t.export} onClose={onClose}>
      {packs.length > 0 && (
        <Field label={t.exportPack}>
          <select className="ui-select" value={which} onChange={(e) => { setWhich(e.target.value); if (e.target.value !== "all") setName(e.target.value); }}>
            <option value="all">{t.allPacks}</option>
            {packs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      )}
      <Field label={t.exportName}><input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="ui-actions">
        <Button onClick={onClose}>{t.cancel}</Button>
        <Button variant="primary" disabled={chosen.length === 0} onClick={() => { download(buildPack(name.trim() || "Homebrew", chosen), `homebrew-${slugify(name) || "pacchetto"}.json`); onClose(); }}>{t.export}</Button>
      </div>
    </Dialog>
  );
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const rs = useRuleset();
  const entries = useApp((s) => s.homebrew);
  const setHomebrew = useApp((s) => s.setHomebrew);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedPack | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const examples = Object.entries(examplePacks).map(([path, p]) => ({ path, pack: p as { name?: string } & Record<string, unknown> }));
  const count = (p: Record<string, unknown>) => HB_KINDS.reduce((n, k) => n + (Array.isArray(p[k]) ? (p[k] as unknown[]).length : 0), 0);
  const commit = (p: Extract<ParsedPack, { ok: true }>) => {
    const m = mergeEntries(entries, p.entries);
    void setHomebrew(m.entries);
    onDone(fmt(t.imported, { added: m.added, updated: m.updated }));
  };
  return (
    <Dialog title={t.import} onClose={onClose}>
      <p className="ui-muted">{t.importHelp}</p>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const x = await f.text(); setText(x); setParsed(parsePack(x, rs)); } e.target.value = ""; }} />
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => file.current?.click()}>{t.importFile}</Button></div>
      <Field label={t.importPaste}><textarea className="ui-input" rows={5} style={{ padding: 8 }} value={text} onChange={(e) => { setText(e.target.value); setParsed(null); }} /></Field>
      {parsed && !parsed.ok && <div className="ui-error" role="alert">{parsed.error}</div>}
      {parsed?.ok && (
        <>
          <p><strong>{parsed.name}</strong>: {fmt(t.exampleCount, { n: parsed.entries.length })}</p>
          {parsed.errors.length > 0 && <div className="ui-error" role="alert"><strong>{t.importSkipped}</strong><ul>{parsed.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
        </>
      )}
      <div className="ui-actions">
        <Button onClick={onClose}>{t.cancel}</Button>
        {parsed?.ok
          ? <Button variant="primary" disabled={parsed.entries.length === 0} onClick={() => commit(parsed)}>{t.importGo}</Button>
          : <Button variant="primary" disabled={!text.trim()} onClick={() => setParsed(parsePack(text, rs))}>{t.preview}</Button>}
      </div>
      {examples.length > 0 && (
        <fieldset className="ui-group">
          <legend>{t.examples}</legend>
          <span className="ui-help">{t.examplesHelp}</span>
          <ul className="pl-list">
            {examples.map(({ path, pack }) => (
              <li key={path} className="pl-feat">
                <p style={{ margin: 0 }}><strong>{pack.name ?? path}</strong> <span className="ui-muted">· {fmt(t.exampleCount, { n: count(pack) })}</span></p>
                <div className="ui-actions" style={{ justifyContent: "flex-start" }}>
                  <Button onClick={() => { const p = parsePack(JSON.stringify(pack), rs); if (p.ok) commit(p); else setParsed(p); }}>{t.exampleAdd}</Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="ui-muted">{t.template}</p>
        </fieldset>
      )}
    </Dialog>
  );
}
