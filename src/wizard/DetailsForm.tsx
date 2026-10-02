import { DETAIL_FIELDS, type DetailField } from "../engine/types";
import type { Character } from "../engine/types";
import { strings as it } from "../i18n";
import { Field } from "../ui/theme";

const t = it.wizard.details;
const SHORT: DetailField[] = ["player", "age", "height", "weight"];

// Dettagli facoltativi del personaggio (giocatore, aspetto, personalità, storia). Si usa nella creazione e nella scheda.
export function DetailsForm({ ch, onChange }: { ch: Character; onChange: (c: Character) => void }) {
  const set = (k: DetailField, v: string) => onChange({ ...ch, details: { ...ch.details, [k]: v } });
  return (
    <>
      <p className="ui-muted">{t.help}</p>
      {DETAIL_FIELDS.map((k) => (
        <Field key={k} label={t.labels[k]}>
          {SHORT.includes(k)
            ? <input className="ui-input" value={ch.details?.[k] ?? ""} maxLength={80} onChange={(e) => set(k, e.target.value)} />
            : <textarea className="ui-input" style={{ minHeight: 84, padding: 8 }} value={ch.details?.[k] ?? ""} maxLength={8000} onChange={(e) => set(k, e.target.value)} />}
        </Field>
      ))}
    </>
  );
}
