import { useState } from "react";
import type { FeatureInfo } from "../engine/compute/types";
import { setActive, useResource } from "../engine/play";
import it from "../i18n/it.json";
import { fmt } from "../ui/format";
import { Button, Dialog } from "../ui/xp";
import type { TabProps } from "./types";

const t = it.play.features;
const KINDS = ["species", "background", "class", "subclass", "feat"] as const;

export function FeaturesTab({ ch, rs, d, update }: TabProps) {
  const [kind, setKind] = useState<"all" | FeatureInfo["kind"]>("all");
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pick, setPick] = useState<FeatureInfo | null>(null);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");

  const all = d.featureList;
  const levels = [...new Set(all.map((f) => f.level))].sort((a, b) => a - b);
  const shown = all.filter((f) => (kind === "all" || f.kind === kind) && (level === "all" || f.level === Number(level))
    && (!q || `${f.name} ${f.description}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.level - b.level || a.name.localeCompare(b.name, "it"));

  const activate = (f: FeatureInfo, picks: string[] = []) => {
    const r = setActive(ch, rs, d, f.id, true, picks);
    if (!r.ok) { setError(r.errors[0] ?? ""); return; }
    setError(""); update(() => r.character); setPick(null);
  };
  const end = (f: FeatureInfo) => { const r = setActive(ch, rs, d, f.id, false); update(() => r.character); setError(""); };

  return (
    <>
      <h2>{t.title}</h2>
      {error && <div className="xp-error" role="alert">{error}</div>}
      <div className="pl-tabs" role="group" aria-label={t.kinds.class}>
        <button type="button" aria-pressed={kind === "all"} onClick={() => setKind("all")}>{t.all}</button>
        {KINDS.filter((k) => all.some((f) => f.kind === k)).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{t.kinds[k]}</button>
        ))}
      </div>
      <div className="pl-row">
        <input className="xp-input" style={{ flex: 1, minWidth: 140 }} type="search" placeholder={t.search} aria-label={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="xp-select" style={{ width: "auto" }} aria-label={t.allLevels} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">{t.allLevels}</option>
          {levels.map((l) => <option key={l} value={l}>{l === 0 ? t.kinds.feat : fmt(t.level, { n: l })}</option>)}
        </select>
      </div>

      {shown.length === 0 && <p className="xp-muted">{t.empty}</p>}
      <ul className="pl-list">
        {shown.map((f) => {
          const r = f.resourceId ? d.resources[f.resourceId] : undefined;
          const expanded = open[f.id] ?? false;
          return (
            <li key={f.id} className={f.active ? "pl-feat active" : "pl-feat"}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen({ ...open, [f.id]: !expanded })}>
                <span className="nm">
                  <b>{f.name}</b>{f.active && <span className="pl-badge"> {t.active}{f.picked.length ? `: ${f.activation?.options.find((o) => o.id === f.picked[0])?.name ?? ""}` : ""}</span>}
                  <br /><span className="pl-sub">{f.kind === "feat" ? t.kinds.feat : f.source}{f.level ? ` · ${fmt(t.level, { n: f.level })}` : ""}{f.needsReview ? ` · ${t.review}` : ""}</span>
                </span>
                {r && <span className="val">{r.remaining}/{r.max.value}</span>}
              </button>
              {expanded && f.description && <p className="pl-desc">{f.description}</p>}
              {(r || f.activation) && (
                <div className="pl-row" style={{ padding: "0 12px 8px" }}>
                  {r && <>
                    <Button aria-label={`${t.use} ${f.name}`} disabled={r.remaining <= 0} onClick={() => update((c) => useResource(c, f.resourceId!, r.max.value, 1))}>{t.use}</Button>
                    <Button aria-label={`${t.restore} ${f.name}`} disabled={r.used <= 0} onClick={() => update((c) => useResource(c, f.resourceId!, r.max.value, -1))}>+</Button>
                    <span className="pl-sub">{r.recharge !== "none" ? (t.recharge as Record<string, string>)[r.recharge] : ""}</span>
                  </>}
                  {f.activation && (f.active
                    ? <Button variant="danger" onClick={() => end(f)}>{t.end}</Button>
                    : <Button variant="primary" onClick={() => { if (f.activation!.options.length) { setPick(f); setChoice(""); setError(""); } else activate(f); }}>{t.activate}</Button>)}
                  {f.activation?.duration && <span className="pl-sub">{fmt(t.duration, { d: f.activation.duration })}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pick?.activation && (
        <Dialog title={fmt(t.chooseTitle, { n: pick.name })} onClose={() => setPick(null)}>
          <p>{pick.activation.label ?? ""}</p>
          <ul className="wz-opts" role="radiogroup" aria-label={pick.activation.label ?? pick.name}>
            {pick.activation.options.map((o) => (
              <li key={o.id}>
                <button type="button" className="wz-opt" role="radio" aria-checked={choice === o.id} onClick={() => setChoice(o.id)}>
                  <span className="mark radio" aria-hidden="true">{choice === o.id ? "●" : ""}</span>
                  <span className="txt"><span className="nm">{o.name}</span>{o.description && <span className="desc" style={{ display: "block" }}>{o.description}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
          {error && <div className="xp-error" role="alert">{error}</div>}
          <div className="xp-actions footer">
            <Button onClick={() => setPick(null)}>{it.wizard.confirmNo}</Button>
            <Button variant="primary" disabled={!choice} onClick={() => activate(pick, [choice])}>{t.confirm}</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
