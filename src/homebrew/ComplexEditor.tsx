import { useEffect, useState, type ReactNode } from "react";
import { newHbId, takenIds, validateEntry, type HbEntry, type HbKind } from "../engine/homebrew";
import type { Ruleset } from "../engine/ruleset";
import { ABILITIES, SKILLS } from "../engine/schema";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Check, Field } from "../ui/theme";
import {
  CASTER_COLUMNS, backgroundFromData, backgroundToData, classFromData, classToData, emptyBackground, emptyClass, emptyFeature, emptySet, emptySpecies,
  emptySubclass, isCaster, slotSources, speciesFromData, speciesToData, subclassFromData, subclassToData,
  type BackgroundDraft, type ClassDraft, type ColumnDraft, type ComplexKind, type FeatureDraft, type SetDraft, type SpeciesDraft, type SubclassDraft,
} from "./complex";
import { EffectsEditor } from "./parts";
import { summarize } from "./summary";

const t = it.homebrew;
const C = t.cx;
const F = t.f;
const AB = it.wizard.abilities as Record<string, string>;

export interface Then { kind: HbKind; classId?: string }
export interface ComplexProps {
  kind: ComplexKind; initial: HbEntry | null; rs: Ruleset; existing: HbEntry[]; presetClassId?: string;
  onSave: (e: HbEntry, then?: Then) => void; onCancel: () => void;
}

// ---- pezzi comuni ----
function Chips({ options, value, onChange, single }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <div className="hb-chips">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value.includes(o.id)}
          onClick={() => onChange(single ? [o.id] : value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id])}>{o.label}</button>
      ))}
    </div>
  );
}
const abilityOpts = ABILITIES.map((a) => ({ id: a, label: AB[a] ?? a }));
const skillOpts = (rs: Ruleset) => SKILLS.map((s) => ({ id: s, label: rs.skills.get(s)?.name.it ?? s }));

function Text({ label, value, onChange, help, long, number }: { label: string; value: string; onChange: (v: string) => void; help?: string; long?: boolean; number?: boolean }) {
  return (
    <Field label={label} help={help}>
      {long
        ? <textarea className="ui-input" rows={4} style={{ padding: 8 }} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className="ui-input" type="text" inputMode={number ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}
function Pick({ label, value, onChange, options, help, empty }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; help?: string; empty?: string }) {
  return (
    <Field label={label} help={help}>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </Field>
  );
}

// ---- bozza salvata: si può chiudere l'app e riprendere da dove si era ----
function useDraft<T>(kind: string, isNew: boolean, state: T, restore: (s: T) => void) {
  const key = `hb-draft:${kind}`;
  const read = (): T | null => { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; } };
  const [saved, setSaved] = useState<T | null>(() => (isNew ? read() : null));
  useEffect(() => {
    if (!isNew || saved) return; // finché la bozza trovata non è stata ripresa o scartata non si sovrascrive
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* archivio non disponibile: si lavora senza bozza */ }
  }, [state, saved, isNew, key]);
  const clear = () => { try { localStorage.removeItem(key); } catch { /* niente */ } };
  const banner = saved ? (
    <div className="ui-banner" role="status">
      {C.draftFound}{" "}
      <Button onClick={() => { restore(saved); setSaved(null); }}>{C.draftResume}</Button>{" "}
      <Button onClick={() => { clear(); setSaved(null); }}>{C.draftDiscard}</Button>
    </div>
  ) : null;
  return { banner, clear };
}

// ---- privilegi e tratti ----
const RECHARGE = Object.entries(C.rechargeOpts).map(([id, label]) => ({ id, label }));

function FeatureCard({ f, set, onRemove, rs }: { f: FeatureDraft; set: (f: FeatureDraft) => void; onRemove: () => void; rs: Ruleset }) {
  const up = (p: Partial<FeatureDraft>) => set({ ...f, ...p });
  return (
    <fieldset className="ui-group hb-feature">
      <legend>{f.name || C.newFeature}</legend>
      <Text label={F.name} value={f.name} onChange={(v) => up({ name: v })} />
      <Text label={C.featureLevel} value={f.level} number onChange={(v) => up({ level: v })} />
      <Text label={F.description} value={f.description} long onChange={(v) => up({ description: v })} />
      <EffectsEditor rows={f.rows} onChange={(rows) => up({ rows })} rs={rs} />
      {f.advanced.length > 0 && <p className="ui-muted">{fmt(C.advanced, { n: f.advanced.length })}</p>}

      <Check checked={f.usesOn} onChange={(v) => up({ usesOn: v })}>{C.usesOn}</Check>
      {f.usesOn && (
        <>
          <Text label={C.uses} help={C.usesHelp} value={f.uses} onChange={(v) => up({ uses: v })} />
          <Pick label={C.recharge} value={f.recharge} options={RECHARGE} onChange={(v) => up({ recharge: v })} />
        </>
      )}
      <Check checked={f.activatable} onChange={(v) => up({ activatable: v })}>{C.activatable}</Check>
      {f.activatable && <Text label={C.duration} help={C.activatableHelp} value={f.duration} onChange={(v) => up({ duration: v })} />}

      <h4 style={{ margin: "8px 0 4px" }}>{C.choices}</h4>
      {f.advancedChoices.length > 0 && <p className="ui-muted">{fmt(C.advancedChoices, { n: f.advancedChoices.length })}</p>}
      {f.choices.map((c, ci) => (
        <fieldset key={ci} className="ui-group">
          <legend>{c.label || C.choiceLabel}</legend>
          <Text label={C.choiceLabel} value={c.label} onChange={(v) => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, label: v } : x)) })} />
          <Text label={C.choiceCount} value={c.count} number onChange={(v) => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, count: v } : x)) })} />
          {c.options.map((o, oi) => (
            <div key={oi} className="hb-effect">
              <Text label={C.optionName} value={o.name} onChange={(v) => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, options: x.options.map((y, j) => (j === oi ? { ...y, name: v } : y)) } : x)) })} />
              <Text label={F.description} value={o.description} long onChange={(v) => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, options: x.options.map((y, j) => (j === oi ? { ...y, description: v } : y)) } : x)) })} />
              <EffectsEditor rows={o.rows} rs={rs}
                onChange={(rows) => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, options: x.options.map((y, j) => (j === oi ? { ...y, rows } : y)) } : x)) })} />
              <Button variant="danger" onClick={() => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, options: x.options.filter((_, j) => j !== oi) } : x)) })}>{C.removeOption}</Button>
            </div>
          ))}
          <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <Button onClick={() => up({ choices: f.choices.map((x, k) => (k === ci ? { ...x, options: [...x.options, { id: "", name: "", description: "", rows: [] }] } : x)) })}>{C.addOption}</Button>
            <Button variant="danger" onClick={() => up({ choices: f.choices.filter((_, k) => k !== ci) })}>{C.removeChoice}</Button>
          </div>
        </fieldset>
      ))}
      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button onClick={() => up({ choices: [...f.choices, { id: "", label: "", count: "1", options: [{ id: "", name: "", description: "", rows: [] }, { id: "", name: "", description: "", rows: [] }] }] })}>{C.addChoice}</Button>
        <Button variant="danger" onClick={onRemove}>{C.removeFeature}</Button>
      </div>
    </fieldset>
  );
}

function FeaturesEditor({ features, onChange, rs, level, title, help }: { features: FeatureDraft[]; onChange: (f: FeatureDraft[]) => void; rs: Ruleset; level: number; title: string; help?: string }) {
  return (
    <>
      <h3>{title}</h3>
      {help && <p className="ui-muted">{help}</p>}
      {features.map((f, i) => <FeatureCard key={i} f={f} rs={rs} set={(x) => onChange(features.map((y, k) => (k === i ? x : y)))} onRemove={() => onChange(features.filter((_, k) => k !== i))} />)}
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => onChange([...features, emptyFeature(level)])}>{C.addFeature}</Button></div>
    </>
  );
}

// ---- equipaggiamento iniziale ----
function itemOptions(rs: Ruleset) {
  const by = (m: Map<string, { id: string; name: { it: string } }>) => [...m.values()].map((x) => ({ id: x.id, label: x.name.it })).sort((a, b) => a.label.localeCompare(b.label, "it"));
  return [
    { group: C.itemGroups.other, list: Object.entries(C.itemPlaceholders).map(([id, label]) => ({ id, label })) },
    { group: C.itemGroups.weapons, list: by(rs.weapons) }, { group: C.itemGroups.armors, list: by(rs.armors) },
    { group: C.itemGroups.items, list: by(rs.items) }, { group: C.itemGroups.tools, list: by(rs.tools) },
  ].filter((g) => g.list.length);
}
function SetEditor({ label, set, onChange, rs }: { label: string; set: SetDraft; onChange: (s: SetDraft) => void; rs: Ruleset }) {
  const groups = itemOptions(rs);
  return (
    <fieldset className="ui-group">
      <legend>{label}</legend>
      <Text label={C.gold} value={set.gp} number onChange={(v) => onChange({ ...set, gp: v })} />
      {set.items.map((row, i) => (
        <div key={i} className="hb-effect">
          <Field label={C.chooseItem}>
            <select className="ui-select" value={row.item} onChange={(e) => onChange({ ...set, items: set.items.map((x, k) => (k === i ? { ...x, item: e.target.value } : x)) })}>
              <option value="">—</option>
              {groups.map((g) => <optgroup key={g.group} label={g.group}>{g.list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>)}
            </select>
          </Field>
          <Text label={C.qty} value={row.qty} number onChange={(v) => onChange({ ...set, items: set.items.map((x, k) => (k === i ? { ...x, qty: v } : x)) })} />
          <Button variant="danger" onClick={() => onChange({ ...set, items: set.items.filter((_, k) => k !== i) })}>{C.removeItem}</Button>
        </div>
      ))}
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => onChange({ ...set, items: [...set.items, { item: "", qty: "1" }] })}>{C.addItem}</Button></div>
    </fieldset>
  );
}

// ---- tabella dei livelli ----
function ColumnsEditor({ columns, onChange, caster }: { columns: ColumnDraft[]; onChange: (c: ColumnDraft[]) => void; caster: boolean }) {
  const missing = caster ? CASTER_COLUMNS.filter((n) => !columns.some((c) => c.name === n)) : [];
  const blank = (name: string): ColumnDraft => ({ name, values: Array(20).fill("0") });
  return (
    <>
      <h3>{C.table}</h3>
      <p className="ui-muted">{C.tableHelp}</p>
      {missing.length > 0 && (
        <div className="ui-banner">
          {C.casterColumnsHelp}{" "}
          <Button onClick={() => onChange([...columns, ...missing.map(blank)])}>{C.addCasterColumns}</Button>
        </div>
      )}
      {columns.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="hb-table">
            <thead>
              <tr>
                <th scope="col">{C.levelShort}</th>
                {columns.map((c, ci) => (
                  <th key={ci} scope="col">
                    <input className="ui-input" aria-label={C.columnName} value={c.name} onChange={(e) => onChange(columns.map((x, k) => (k === ci ? { ...x, name: e.target.value } : x)))} />
                    <Button variant="danger" aria-label={C.removeColumn} onClick={() => onChange(columns.filter((_, k) => k !== ci))}>✕</Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 20 }, (_, lv) => (
                <tr key={lv}>
                  <th scope="row">{lv + 1}</th>
                  {columns.map((c, ci) => (
                    <td key={ci}>
                      <input className="ui-input" aria-label={`${c.name || C.columnName} ${lv + 1}`} value={c.values[lv] ?? ""}
                        onChange={(e) => onChange(columns.map((x, k) => (k === ci ? { ...x, values: Array.from({ length: 20 }, (_, i) => (i === lv ? e.target.value : x.values[i] ?? "0")) } : x)))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => onChange([...columns, blank("")])}>{C.addColumn}</Button></div>
    </>
  );
}

// ---- guscio comune: anteprima, pacchetto, controllo con lo schema, salvataggio ----
interface Ctx { ok: boolean; save: (then?: Then) => void }
function Shell({ p, id, data, pack, setPack, clear, children }: {
  p: ComplexProps; id: string; data: HbEntry["data"]; pack: string; setPack: (s: string) => void; clear: () => void; children: (c: Ctx) => ReactNode;
}) {
  const [tried, setTried] = useState(false);
  const result = validateEntry(p.kind, data, p.rs);
  const packs = [...new Set(p.existing.map((e) => e.pack).filter((x): x is string => !!x))];
  const save = (then?: Then) => {
    setTried(true);
    if (!result.ok) return;
    clear();
    p.onSave({ kind: p.kind, enabled: p.initial?.enabled ?? true, data: result.data, ...(pack.trim() ? { pack: pack.trim() } : {}) }, then);
  };
  void id;
  return (
    <>
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => { clear(); p.onCancel(); }}>← {t.back}</Button></div>
      <h2>{p.initial ? t.edit : t.new}: {t.kinds[p.kind]}</h2>
      {children({ ok: result.ok, save })}
      <Field label={C.pack} help={C.packHelp}>
        <input className="ui-input" list="hb-packs" value={pack} onChange={(e) => setPack(e.target.value)} />
        <datalist id="hb-packs">{packs.map((x) => <option key={x} value={x} />)}</datalist>
      </Field>
      <fieldset className="ui-group">
        <legend>{t.preview}</legend>
        {result.ok ? (
          <>
            <p><strong>{result.data.name.it}</strong> <span className="hb-badge">{t.badge}</span></p>
            {summarize(p.kind, result.data, p.rs).map((l, i) => <p key={i} className="ui-muted" style={{ margin: "2px 0" }}>{l}</p>)}
            {String(result.data.description ?? "") && <p>{String(result.data.description)}</p>}
          </>
        ) : <p className="ui-muted">{t.previewHelp}</p>}
      </fieldset>
      {!result.ok && tried && <div className="ui-error" role="alert"><strong>{t.errors}</strong><ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      <div className="ui-actions">
        <Button onClick={() => { clear(); p.onCancel(); }}>{t.cancel}</Button>
        <Button variant="primary" onClick={() => save()}>{t.save}</Button>
      </div>
    </>
  );
}
const useId = (p: ComplexProps, name: string) => p.initial?.data.id ?? newHbId(name, takenIds(p.rs, p.existing));

// ---- specie ----
function SpeciesForm(p: ComplexProps) {
  const [d, setD] = useState<SpeciesDraft>(() => (p.initial ? speciesFromData(p.initial.data) : emptySpecies()));
  const [pack, setPack] = useState(p.initial?.pack ?? "");
  const draft = useDraft("species", !p.initial, d, setD);
  const id = useId(p, d.name);
  const up = (x: Partial<SpeciesDraft>) => setD({ ...d, ...x });
  return (
    <>
      {draft.banner}
      <Shell p={p} id={id} data={speciesToData(d, id)} pack={pack} setPack={setPack} clear={draft.clear}>
        {() => (
          <>
            <Text label={F.name} value={d.name} onChange={(v) => up({ name: v })} />
            <Text label={F.description} value={d.description} long onChange={(v) => up({ description: v })} />
            <Field label={C.sizes}><Chips options={Object.entries(C.sizeOpts).map(([i, label]) => ({ id: i, label }))} value={d.sizes} onChange={(v) => up({ sizes: v })} /></Field>
            <Text label={C.speed} value={d.speed} number onChange={(v) => up({ speed: v })} />
            <FeaturesEditor title={C.traits} help={C.traitsHelp} features={d.features} rs={p.rs} level={1} onChange={(features) => up({ features })} />
          </>
        )}
      </Shell>
    </>
  );
}

// ---- background ----
function BackgroundForm(p: ComplexProps) {
  const [d, setD] = useState<BackgroundDraft>(() => (p.initial ? backgroundFromData(p.initial.data) : emptyBackground(p.rs)));
  const [pack, setPack] = useState(p.initial?.pack ?? "");
  const draft = useDraft("backgrounds", !p.initial, d, setD);
  const id = useId(p, d.name);
  const up = (x: Partial<BackgroundDraft>) => setD({ ...d, ...x });
  const toolOpts = [...Object.entries(C.bgToolGroups).map(([i, label]) => ({ id: i, label })), ...[...p.rs.tools.values()].map((x) => ({ id: x.id, label: x.name.it }))];
  const featOpts = [...p.rs.feats.values()].filter((f) => f.category === "origin").map((f) => ({ id: f.id, label: f.origin === "homebrew" ? `${f.name.it} · ${t.badge}` : f.name.it }));
  return (
    <>
      {draft.banner}
      <Shell p={p} id={id} data={backgroundToData(d, id)} pack={pack} setPack={setPack} clear={draft.clear}>
        {() => (
          <>
            <Text label={F.name} value={d.name} onChange={(v) => up({ name: v })} />
            <Text label={F.description} value={d.description} long onChange={(v) => up({ description: v })} />
            <Field label={C.bgAbilities} help={C.bgAbilitiesHelp}><Chips options={abilityOpts} value={d.abilities} onChange={(v) => up({ abilities: v.slice(-3) })} /></Field>
            <Field label={C.bgSkills}><Chips options={skillOpts(p.rs)} value={d.skills} onChange={(v) => up({ skills: v.slice(-2) })} /></Field>
            <Pick label={C.bgTool} value={d.tool} options={toolOpts} onChange={(v) => up({ tool: v })} />
            <Pick label={C.bgFeat} value={d.feat} options={featOpts} help={C.bgFeatHelp} onChange={(v) => up({ feat: v })} empty="—" />
            <h3>{C.equipment}</h3>
            <SetEditor label={C.setA} set={d.sets.A} rs={p.rs} onChange={(A) => up({ sets: { ...d.sets, A } })} />
            <SetEditor label={C.setB} set={d.sets.B} rs={p.rs} onChange={(B) => up({ sets: { ...d.sets, B } })} />
          </>
        )}
      </Shell>
    </>
  );
}

// ---- classe (a passi: base → tabella → privilegi → equipaggiamento → sottoclassi) ----
const STEPS = ["base", "table", "features", "equipment", "subclasses"] as const;
type ClassStep = (typeof STEPS)[number];

function ClassForm(p: ComplexProps) {
  const [d, setD] = useState<ClassDraft>(() => (p.initial ? classFromData(p.initial.data) : emptyClass()));
  const [pack, setPack] = useState(p.initial?.pack ?? "");
  const [step, setStep] = useState<ClassStep>("base");
  const draft = useDraft("classes", !p.initial, d, setD);
  const id = useId(p, d.name);
  const up = (x: Partial<ClassDraft>) => setD({ ...d, ...x });
  const subs = p.existing.filter((e) => e.kind === "subclasses" && (e.data as { classId?: string }).classId === id);
  const sources = isCaster(d.caster) ? slotSources(p.rs, d.caster) : [];
  const slotOpts = [...(p.initial && (p.initial.data.spellSlots || p.initial.data.pactSlots) ? [{ id: "keep", label: C.slotsKeep }] : []), ...sources];
  return (
    <>
      {draft.banner}
      <Shell p={p} id={id} data={classToData(d, id, p.rs, p.initial?.data as Record<string, unknown> | undefined)} pack={pack} setPack={setPack} clear={draft.clear}>
        {({ ok, save }) => (
          <>
            <div className="pl-tabs" role="group" aria-label={C.steps}>
              {STEPS.map((s, i) => <button key={s} type="button" aria-pressed={step === s} onClick={() => setStep(s)}>{i + 1}. {C.stepLabels[s]}</button>)}
            </div>
            {step === "base" && (
              <>
                <Text label={F.name} value={d.name} onChange={(v) => up({ name: v })} />
                <Text label={F.description} value={d.description} long onChange={(v) => up({ description: v })} />
                <Pick label={C.hitDie} value={d.hitDie} options={[6, 8, 10, 12].map((n) => ({ id: String(n), label: `d${n}` }))} onChange={(v) => up({ hitDie: v })} />
                <Field label={C.primary}><Chips options={abilityOpts} value={d.primary} onChange={(v) => up({ primary: v })} /></Field>
                <Field label={C.saves}><Chips options={abilityOpts} value={d.saves} onChange={(v) => up({ saves: v.slice(-2) })} /></Field>
                <Text label={C.skillCount} value={d.skillCount} number onChange={(v) => up({ skillCount: v })} />
                <Field label={C.skillFrom} help={C.skillFromHelp}><Chips options={skillOpts(p.rs)} value={d.skillFrom} onChange={(v) => up({ skillFrom: v })} /></Field>
                <Field label={C.armor}><Chips options={Object.entries(it.homebrew.opts.armorCategory).map(([i, label]) => ({ id: i, label }))} value={d.armor} onChange={(v) => up({ armor: v })} /></Field>
                <Field label={C.weapons}><Chips options={Object.entries(C.weaponOpts).map(([i, label]) => ({ id: i, label }))} value={d.weapons} onChange={(v) => up({ weapons: v })} /></Field>
                <Pick label={C.caster} value={d.caster} options={Object.entries(C.casterOpts).map(([i, label]) => ({ id: i, label }))}
                  onChange={(v) => up({ caster: v, slotsFrom: v === d.caster ? d.slotsFrom : "" })} />
                {isCaster(d.caster) && (
                  <>
                    <Pick label={C.spellAbility} value={d.spellAbility} options={abilityOpts} empty="—" onChange={(v) => up({ spellAbility: v })} />
                    <Pick label={C.spellList} value={d.spellList} help={C.spellListHelp} empty={C.spellListOwn} onChange={(v) => up({ spellList: v })}
                      options={Object.entries(it.homebrew.opts.classes).map(([i, label]) => ({ id: i, label }))} />
                    <Pick label={C.slotsFrom} value={d.slotsFrom} options={slotOpts} empty={C.slotsNone} help={C.slotsHelp} onChange={(v) => up({ slotsFrom: v })} />
                    {slotOpts.length === 0 && <p className="ui-muted">{C.slotsNoSource}</p>}
                  </>
                )}
                <Text label={C.subclassLevel} value={d.subclassLevel} number onChange={(v) => up({ subclassLevel: v })} />
              </>
            )}
            {step === "table" && <ColumnsEditor columns={d.columns} caster={isCaster(d.caster)} onChange={(columns) => up({ columns })} />}
            {step === "features" && <FeaturesEditor title={C.features} help={C.featuresHelp} features={d.features} rs={p.rs} level={1} onChange={(features) => up({ features })} />}
            {step === "equipment" && (
              <>
                <h3>{C.equipment}</h3>
                <SetEditor label={C.setA} set={d.sets.A} rs={p.rs} onChange={(A) => up({ sets: { ...d.sets, A } })} />
                <SetEditor label={C.setB} set={d.sets.B} rs={p.rs} onChange={(B) => up({ sets: { ...d.sets, B } })} />
              </>
            )}
            {step === "subclasses" && (
              <>
                <h3>{C.subclassList}</h3>
                <p className="ui-muted">{C.subclassesHelp}</p>
                {subs.length === 0 ? <p className="ui-muted">{C.noSubclasses}</p> : <ul>{subs.map((s) => <li key={s.data.id}>{s.data.name.it}</li>)}</ul>}
                <div className="ui-actions" style={{ justifyContent: "flex-start" }}>
                  <Button disabled={!ok} onClick={() => save({ kind: "subclasses", classId: id })}>{C.newSubclass}</Button>
                </div>
                {!ok && <p className="ui-muted">{C.subclassNeedsValid}</p>}
              </>
            )}
          </>
        )}
      </Shell>
    </>
  );
}

// ---- sottoclasse ----
function SubclassForm(p: ComplexProps) {
  const [d, setD] = useState<SubclassDraft>(() => (p.initial ? subclassFromData(p.initial.data) : emptySubclass(p.presetClassId ?? "")));
  const [pack, setPack] = useState(p.initial?.pack ?? "");
  const draft = useDraft("subclasses", !p.initial, d, setD);
  const id = useId(p, d.name);
  const up = (x: Partial<SubclassDraft>) => setD({ ...d, ...x });
  const classOpts = [...p.rs.classes.values()].map((c) => ({ id: c.id, label: c.origin === "homebrew" ? `${c.name.it} · ${t.badge}` : c.name.it }));
  const lv = p.rs.classes.get(d.classId)?.subclassLevel ?? 3;
  return (
    <>
      {draft.banner}
      <Shell p={p} id={id} data={subclassToData(d, id)} pack={pack} setPack={setPack} clear={draft.clear}>
        {() => (
          <>
            <Text label={F.name} value={d.name} onChange={(v) => up({ name: v })} />
            <Text label={F.description} value={d.description} long onChange={(v) => up({ description: v })} />
            <Pick label={C.classOf} value={d.classId} options={classOpts} empty="—" onChange={(v) => up({ classId: v })} />
            <FeaturesEditor title={C.features} help={fmt(C.subclassFeaturesHelp, { n: lv })} features={d.features} rs={p.rs} level={lv} onChange={(features) => up({ features })} />
          </>
        )}
      </Shell>
    </>
  );
}

export function ComplexEditor(p: ComplexProps) {
  switch (p.kind) {
    case "species": return <SpeciesForm {...p} />;
    case "backgrounds": return <BackgroundForm {...p} />;
    case "classes": return <ClassForm {...p} />;
    case "subclasses": return <SubclassForm {...p} />;
  }
}
void emptySet;
