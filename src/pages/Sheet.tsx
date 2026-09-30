import { useMemo, useState } from "react";
import { useRuleset } from "../data/ruleset";
import { missingHomebrew } from "../engine/homebrew";
import { fmt } from "../ui/format";
import it from "../i18n/it.json";
import { Button, Dialog } from "../ui/xp";
import { useApp } from "../ui/useApp";
import { PlaySheet } from "../sheet/PlaySheet";
import type { SheetView } from "../sheet/sections";
import { Wizard } from "../wizard/Wizard";
import { isFinalized, reopenCreation } from "../wizard/logic";

// Scheda: finché la creazione non è chiusa mostra il wizard; poi il riepilogo (la scheda giocabile arriva allo step 14)
export function Sheet({ section, onSection }: { section: SheetView; onSection: (s: SheetView) => void }) {
  const rs = useRuleset();
  const ch = useApp((s) => s.current);
  const update = useApp((s) => s.update);
  const flush = useApp((s) => s.flush);
  const allowReroll = useApp((s) => s.settings.allowReroll);
  const [reopen, setReopen] = useState(false);
  // contenuti homebrew usati dal personaggio che qui non ci sono: avviso con l'elenco, mai un errore muto
  const missing = useMemo(() => (ch ? missingHomebrew(ch, rs) : []), [ch, rs]);
  if (!ch) return null;
  const warning = missing.length > 0 ? <div className="xp-banner" role="alert">{fmt(it.homebrew.missing, { list: missing.join(", ") })}</div> : null;
  if (rs.classes.size === 0) return <div className="xp-error" role="alert">{it.wizard.noData}</div>;

  if (!isFinalized(ch)) {
    return <>{warning}<Wizard ch={ch} rs={rs} allowReroll={allowReroll} onChange={(c) => update(() => c)} onDone={(c) => { update(() => c); void flush(); }} /></>;
  }
  return (
    <>
      {warning}
      <PlaySheet ch={ch} rs={rs} update={update} onReopen={() => setReopen(true)} tab={section} onSection={onSection} />
      {reopen && (
        <Dialog title={it.wizard.sum.reopen} onClose={() => setReopen(false)}>
          <p>{it.wizard.sum.reopenConfirm}</p>
          <div className="xp-actions footer">
            <Button onClick={() => setReopen(false)}>{it.wizard.confirmNo}</Button>
            <Button variant="primary" onClick={() => { update(reopenCreation); setReopen(false); }}>{it.wizard.confirmYes}</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
