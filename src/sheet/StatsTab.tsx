import { useState } from "react";
import { ABILITIES, SKILLS, type Ability } from "../engine/schema";
import type { Sourced } from "../engine/types";
import it from "../i18n/it.json";
import { fmt } from "../ui/format";
import { RollDialog } from "./dialogs";
import type { TabProps } from "./types";
import { AB, sign } from "./util";
import type { RollMode } from "../engine/compute/types";

const t = it.play;
interface Rolling { title: string; bonus: Sourced; mode: RollMode; modeSources: string[]; note?: string }
const P = it.play.proficiency as Record<string, string>;

export function StatsTab({ rs, d }: TabProps) {
  const [rolling, setRolling] = useState<Rolling | null>(null);
  const cs = d.conditions;
  // prova di caratteristica: mod + penalità di Esaurimento; il vantaggio/svantaggio viene dalle condizioni
  const check = (a: Ability): Rolling => ({
    title: fmt(t.check, { a: AB[a] }),
    bonus: { value: d.mods[a].value + cs.d20Penalty, sources: [...d.mods[a].sources, ...(cs.d20Penalty ? [{ label: "Esaurimento", value: cs.d20Penalty }] : [])] },
    mode: cs.abilityChecks.mode, modeSources: cs.abilityChecks.modeSources,
  });
  return (
    <>
      <h3>{t.abilities}</h3>
      <ul className="pl-list">
        {ABILITIES.map((a) => (
          <li key={a}><button type="button" onClick={() => setRolling(check(a))}>
            <span className="nm">{AB[a]}<br /><span className="pl-sub">{d.scores[a].value}</span></span><span className="val">{sign(d.mods[a].value)}</span>
          </button></li>
        ))}
      </ul>

      <h3>{t.saves}</h3>
      <ul className="pl-list">
        {ABILITIES.map((a) => {
          const s = d.saves[a];
          return (
            <li key={a}><button type="button" onClick={() => setRolling({ title: fmt(t.save, { a: AB[a] }), bonus: s.bonus, mode: s.mode, modeSources: s.autoFail.length ? [`Fallimento automatico: ${s.autoFail.join(", ")}`] : s.modeSources })}>
              <span className="prof" aria-label={s.proficient ? "Competente" : ""}>{s.proficient ? P.proficient : ""}</span>
              <span className="nm">{AB[a]}</span><span className="val">{sign(s.bonus.value)}</span>
            </button></li>
          );
        })}
      </ul>

      <h3>{t.skills}</h3>
      <ul className="pl-list">
        {SKILLS.map((k) => {
          const s = d.skills[k];
          return (
            <li key={k}><button type="button" onClick={() => setRolling({ title: rs_name(k, rs), bonus: s.bonus, mode: s.mode, modeSources: s.modeSources })}>
              <span className="prof" aria-label={s.proficiency}>{P[s.proficiency]}</span>
              <span className="nm">{rs_name(k, rs)} <span className="pl-sub">({AB[s.ability].slice(0, 3)})</span></span><span className="val">{sign(s.bonus.value)}</span>
            </button></li>
          );
        })}
      </ul>

      <h3>{t.senses}</h3>
      <p>{Object.entries(d.senses).map(([k, v]) => `${k} ${v!.value} ft`).join(" · ") || "—"}</p>
      <h3>{t.languages}</h3>
      <ul className="wz-tags">{d.languages.map((l) => <li key={l}>{rs.languages.get(l)?.name.it ?? l}</li>)}</ul>
      <h3>{t.profs}</h3>
      <p className="xp-muted">{t.armor}: {d.proficiencies.armor.join(", ") || "—"}</p>
      <p className="xp-muted">{t.weapons}: {d.proficiencies.weapons.join(", ") || "—"}</p>
      <p className="xp-muted">{t.tools}: {d.proficiencies.tools.map((x) => rs.tools.get(x)?.name.it ?? x).join(", ") || "—"}</p>
      {d.resistances.length > 0 && <p className="xp-muted">{t.resistances}: {d.resistances.join(", ")}</p>}
      {d.notes.length > 0 && <ul>{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      {rolling && <RollDialog {...rolling} onClose={() => setRolling(null)} />}
    </>
  );
}

function rs_name(k: string, rs: TabProps["rs"]): string { return rs.skills.get(k)?.name.it ?? k; }
