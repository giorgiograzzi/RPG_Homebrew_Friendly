import { useState } from "react";
import { defaultValues, buildEffect, optionSet, presetFor, validEffect, EFFECT_PRESETS, type ParamSpec, type ParamValues } from "../engine/homebrew";
import type { Ruleset } from "../engine/ruleset";
import { strings as it } from "../i18n";
import { Button, Check, Field } from "../ui/theme";
import type { EffectRow } from "./complex";
import type { Draft, FieldSpec } from "./forms";

const t = it.homebrew;
void buildEffect;


export function ParamInput({ spec, value, onChange, rs }: { spec: ParamSpec; value: ParamValues[string]; onChange: (v: ParamValues[string]) => void; rs: Ruleset }) {
  if (spec.type === "number") {
    return <Field label={spec.label}><input className="ui-input" type="number" inputMode="numeric" value={String(value)} min={spec.min} max={spec.max} onChange={(e) => onChange(Number(e.target.value))} /></Field>;
  }
  if (spec.type === "bool") return <Check checked={Boolean(value)} onChange={onChange}>{spec.label}</Check>;
  const opts = optionSet(spec.options, rs);
  if (spec.type === "select") {
    return (
      <Field label={spec.label}>
        <select className="ui-select" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.optional && <option value="">—</option>}
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
    );
  }
  const list = value as string[];
  return (
    <Field label={spec.label}>
      <div className="hb-chips">
        {opts.map((o) => <button key={o.id} type="button" aria-pressed={list.includes(o.id)} onClick={() => onChange(list.includes(o.id) ? list.filter((x) => x !== o.id) : [...list, o.id])}>{o.label}</button>)}
      </div>
    </Field>
  );
}

export function EffectsEditor({ rows, onChange, rs, help }: { rows: EffectRow[]; onChange: (r: EffectRow[]) => void; rs: Ruleset; help?: string }) {
  const [add, setAdd] = useState("");
  return (
    <fieldset className="ui-group">
      <legend>{t.effects}</legend>
      <span className="ui-help">{help ?? t.effectsHelp}</span>
      {rows.length === 0 && <p className="ui-muted">{t.noEffects}</p>}
      {rows.map((r, i) => (
        <div key={i} className="hb-effect">
          <strong>{r.preset.label}</strong>
          {r.preset.help && <span className="ui-help">{r.preset.help}</span>}
          {r.preset.params.map((p) => (
            <ParamInput key={p.key} spec={p} rs={rs} value={r.values[p.key]!} onChange={(v) => onChange(rows.map((x, k) => (k === i ? { ...x, values: { ...x.values, [p.key]: v } } : x)))} />
          ))}
          {!validEffect(r.preset, r.values) && <div className="ui-error" role="alert">Completa i campi di questo effetto.</div>}
          <Button variant="danger" onClick={() => onChange(rows.filter((_, k) => k !== i))}>{t.removeEffect}</Button>
        </div>
      ))}
      <Field label={t.addEffect}>
        <select className="ui-select" value={add} onChange={(e) => { const p = presetFor(e.target.value); if (p) { onChange([...rows, { preset: p, values: defaultValues(p, rs) }]); } setAdd(""); }}>
          <option value="">{t.chooseEffect}</option>
          {EFFECT_PRESETS.map((p) => <option key={p.op} value={p.op}>{p.label}</option>)}
        </select>
      </Field>
    </fieldset>
  );
}

export function FieldInput({ spec, draft, set, rs }: { spec: FieldSpec; draft: Draft; set: (k: string, v: Draft[string]) => void; rs: Ruleset }) {
  const v = draft[spec.key]!;
  const label = spec.label;
  if (spec.type === "bool") return <Check checked={Boolean(v)} onChange={(x) => set(spec.key, x)}>{label}</Check>;
  if (spec.type === "select") {
    return (
      <Field label={label} help={spec.help}>
        <select className="ui-select" value={String(v)} onChange={(e) => set(spec.key, e.target.value)}>
          {spec.options!(rs).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
    );
  }
  if (spec.type === "multi") {
    const list = v as string[];
    return (
      <Field label={label} help={spec.help}>
        <div className="hb-chips">
          {spec.options!(rs).map((o) => <button key={o.id} type="button" aria-pressed={list.includes(o.id)} onClick={() => set(spec.key, list.includes(o.id) ? list.filter((x) => x !== o.id) : [...list, o.id])}>{o.label}</button>)}
        </div>
      </Field>
    );
  }
  if (spec.type === "long") return <Field label={label} help={spec.help}><textarea className="ui-input" rows={4} style={{ padding: 8 }} value={String(v)} onChange={(e) => set(spec.key, e.target.value)} /></Field>;
  return <Field label={label} help={spec.help}><input className="ui-input" type="text" inputMode={spec.type === "number" ? "decimal" : undefined} value={String(v)} onChange={(e) => set(spec.key, e.target.value)} /></Field>;
}

