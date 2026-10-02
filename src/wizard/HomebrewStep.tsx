import { hbKey, type HbEntry } from "../engine/homebrew";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import { GIVE_KINDS, give, has, take } from "../homebrew/give";
import { summarize } from "../homebrew/summary";
import { strings as it } from "../i18n";
import { Check } from "../ui/theme";
import { useApp } from "../ui/useApp";

const t = it.homebrew;

// Passo "Homebrew" della creazione (e della modifica): le creazioni attive si aggiungono al personaggio con un tocco.
// Stesso meccanismo del pulsante "Dai a..." nella scheda Homebrew, così il risultato è identico.
export function HomebrewStep({ ch, rs, onChange }: { ch: Character; rs: Ruleset; onChange: (c: Character) => void }) {
  const entries = useApp((s) => s.homebrew).filter((e: HbEntry) => e.enabled && GIVE_KINDS.includes(e.kind));
  if (entries.length === 0) return <p className="ui-muted">{t.wizardEmpty}</p>;
  return (
    <>
      <p className="ui-muted">{t.wizardIntro}</p>
      {GIVE_KINDS.map((kind) => {
        const list = entries.filter((e) => e.kind === kind);
        if (!list.length) return null;
        return (
          <fieldset key={kind} className="ui-group">
            <legend>{t.kindsPlural[kind]}</legend>
            <ul className="pl-list">
              {list.map((e) => (
                <li key={hbKey(e)} className="pl-feat hb-entry">
                  <p style={{ margin: 0 }}><strong>{e.data.name.it}</strong> <span className="hb-badge">{t.badge}</span></p>
                  {summarize(kind, e.data, rs).map((l, i) => <p key={i} className="ui-muted" style={{ margin: "2px 0" }}>{l}</p>)}
                  <Check checked={has(ch, e)} onChange={(v) => onChange(v ? give(ch, e) : take(ch, e))}>{t.wizardAdd}</Check>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </>
  );
}
