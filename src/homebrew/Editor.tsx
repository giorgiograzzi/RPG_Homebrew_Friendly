import { useMemo, useState } from "react";
import { buildEffect, newHbId, readEffect, takenIds, validateEntry, type HbEntry, type HbKind } from "../engine/homebrew";
import type { Ruleset } from "../engine/ruleset";
import type { Effect } from "../engine/types";
import { strings as it } from "../i18n";
import { Button, Field } from "../ui/theme";
import { ComplexEditor, type Then } from "./ComplexEditor";
import { isComplex, type EffectRow } from "./complex";
import { FIELDS, dataToDraft, draftToData, emptyDraft, withDefaults, type Draft, type FlatKind } from "./forms";
import { EffectsEditor, FieldInput } from "./parts";
import { summarize } from "./summary";

const t = it.homebrew;

interface EditorProps {
  kind: HbKind; initial: HbEntry | null; rs: Ruleset; existing: HbEntry[]; presetClassId?: string;
  onSave: (e: HbEntry, then?: Then) => void; onCancel: () => void;
}

// Un editor per tipo: i contenuti semplici hanno un modulo a campi, quelli complessi (specie, background, classi, sottoclassi) un editor a sezioni
export function Editor(p: EditorProps) {
  if (isComplex(p.kind)) return <ComplexEditor {...p} kind={p.kind} />;
  return <FlatEditor {...p} kind={p.kind} />;
}

// Modulo guidato per una voce semplice: campi, effetti (talenti), anteprima e controllo con lo schema del motore
function FlatEditor({ kind, initial, rs, existing, onSave, onCancel }: EditorProps & { kind: FlatKind }) {
  const [draft, setDraft] = useState<Draft>(() => (initial ? dataToDraft(kind, initial.data) : withDefaults(kind, emptyDraft(kind), rs)));
  // effetti del talento: quelli che il modulo sa leggere si modificano, gli altri (copiati da una voce ufficiale) restano com'erano
  const [rows, setRows] = useState<EffectRow[]>(() => ((initial?.data.effects as Effect[] | undefined) ?? []).flatMap((e) => { const r = readEffect(e); return r && JSON.stringify(buildEffect(r.preset, r.values)) === JSON.stringify(e) ? [r] : []; }));
  const [advanced] = useState<unknown[]>(() => ((initial?.data.effects as Effect[] | undefined) ?? []).filter((e) => { const r = readEffect(e); return !(r && JSON.stringify(buildEffect(r.preset, r.values)) === JSON.stringify(e)); }));
  const [pack, setPack] = useState(initial?.pack ?? "");
  const [tried, setTried] = useState(false);
  const id = initial?.data.id ?? newHbId(String(draft.name), takenIds(rs, existing));
  // le cariche vengono sempre dal modulo: se le svuoti spariscono
  const extra = initial ? (() => { const { id: _i, name: _n, description: _d, charges: _c, ...rest } = initial.data as Record<string, unknown>; void _i; void _n; void _d; void _c; return rest; })() : {};
  const result = useMemo(() => {
    const effects = [...rows.map((r) => buildEffect(r.preset, r.values)), ...advanced];
    // i campi che il modulo non mostra (copiati da una voce ufficiale) si conservano; quelli del modulo hanno la precedenza
    return validateEntry(kind, { ...extra, ...draftToData(kind, draft, id, effects) }, rs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, draft, rows, advanced, id, rs]);
  const set = (k: string, v: Draft[string]) => setDraft((d) => ({ ...d, [k]: v }));
  const packs = [...new Set(existing.map((e) => e.pack).filter((x): x is string => !!x))];

  return (
    <>
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={onCancel}>← {t.back}</Button></div>
      <h2>{initial ? t.edit : t.new}: {t.kinds[kind]}</h2>
      {FIELDS[kind].filter((s) => !s.show || s.show(draft)).map((s) => <FieldInput key={s.key} spec={s} draft={draft} set={set} rs={rs} />)}
      {(kind === "feats" || kind === "items" || kind === "weapons" || kind === "armors") && <EffectsEditor rows={rows} onChange={setRows} rs={rs} help={kind === "feats" ? undefined : t.gearEffectsHelp} />}
      {advanced.length > 0 && <p className="ui-muted">{it.homebrew.cx.advanced.replace("{n}", String(advanced.length))}</p>}
      <Field label={it.homebrew.cx.pack} help={it.homebrew.cx.packHelp}>
        <input className="ui-input" list="hb-packs-flat" value={pack} onChange={(e) => setPack(e.target.value)} />
        <datalist id="hb-packs-flat">{packs.map((x) => <option key={x} value={x} />)}</datalist>
      </Field>

      <fieldset className="ui-group">
        <legend>{t.preview}</legend>
        {result.ok ? (
          <>
            <p><strong>{result.data.name.it}</strong> <span className="hb-badge">{t.badge}</span></p>
            {summarize(kind, result.data, rs).map((l, i) => <p key={i} className="ui-muted" style={{ margin: "2px 0" }}>{l}</p>)}
            {String(result.data.description ?? "") && <p>{String(result.data.description)}</p>}
          </>
        ) : <p className="ui-muted">{t.previewHelp}</p>}
      </fieldset>

      {!result.ok && tried && <div className="ui-error" role="alert"><strong>{t.errors}</strong><ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      <div className="ui-actions">
        <Button onClick={onCancel}>{t.cancel}</Button>
        <Button variant="primary" onClick={() => { setTried(true); if (result.ok) onSave({ kind, enabled: initial?.enabled ?? true, data: result.data, ...(pack.trim() ? { pack: pack.trim() } : {}) }); }}>{t.save}</Button>
      </div>
    </>
  );
}
