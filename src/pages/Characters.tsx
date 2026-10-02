import { useState } from "react";
import { strings as it } from "../i18n";
import { Button, Dialog } from "../ui/theme";
import { formatDate } from "../ui/format";
import { useApp } from "../ui/useApp";
import { backupDue } from "../store";
import { exportNow } from "./Settings";
import { shareOrDownloadJson } from "../export/download";

export function Characters({ onOpened }: { onOpened: () => void }) {
  const list = useApp((s) => s.list);
  const current = useApp((s) => s.current);
  const error = useApp((s) => s.error);
  const create = useApp((s) => s.create);
  const open = useApp((s) => s.open);
  const remove = useApp((s) => s.remove);
  const settings = useApp((s) => s.settings);
  const exportAll = useApp((s) => s.exportAll);
  const duplicate = useApp((s) => s.duplicate);
  const exportOne = useApp((s) => s.exportOne);
  const exportRaw = useApp((s) => s.exportRaw);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const fileName = (id: string, suffix = "") => `${(list.find((c) => c.id === id)?.name || "personaggio").replace(/[^\p{L}\p{N}]+/gu, "-")}${suffix}.json`;
  const t = it.characters;

  return (
    <>
      <h2>{t.title}</h2>
      {error && <div className="ui-error" role="alert">{error}</div>}
      {failed && (
        <div className="ui-banner" role="alert">{t.broken}
          <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => void exportRaw(failed).then((x) => x && shareOrDownloadJson(x, fileName(failed, "-grezzo")))}>{t.exportRaw}</Button></div>
        </div>
      )}
      {list.length > 0 && backupDue(settings) && (
        <div className="ui-banner" role="alert">
          {t.backupDue}
          <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button variant="primary" onClick={() => void exportNow(exportAll)}>{it.settings.exportNow}</Button></div>
        </div>
      )}
      <div className="ui-actions">
        <Button variant="primary" onClick={() => void create().then(onOpened)}>+ {t.new}</Button>
      </div>
      {list.length === 0 ? (
        <p className="ui-empty ui-muted">{t.empty}</p>
      ) : (
        <ul className="ui-list">
          {list.map((c) => (
            <li key={c.id} className={c.id === current?.id ? "active" : ""}>
              <div className="grow">
                <div className="name">{c.name || t.unnamed}</div>
                <div className="ui-muted">{formatDate(c.updatedAt)}</div>
              </div>
              <div className="row-actions">
              <Button onClick={() => void open(c.id).then((ok) => { setFailed(ok ? null : c.id); if (ok) onOpened(); })}>{t.open}</Button>
              <Button onClick={() => void duplicate(c.id)}>{t.duplicate}</Button>
              <Button onClick={() => void exportOne(c.id).then((x) => x && shareOrDownloadJson(x, fileName(c.id)))}>{t.export}</Button>
              <Button variant="danger" aria-label={`${t.delete} ${c.name || t.unnamed}`} onClick={() => setToDelete(c.id)}>✕</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {toDelete && (
        <Dialog title={t.delete} onClose={() => setToDelete(null)}>
          <p>{t.confirmDelete}</p>
          <div className="ui-actions footer">
            <Button onClick={() => setToDelete(null)}>{it.import.cancel}</Button>
            <Button variant="danger" onClick={() => void remove(toDelete).then(() => setToDelete(null))}>{t.delete}</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
