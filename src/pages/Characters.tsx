import { useState } from "react";
import { strings as it } from "../i18n";
import { Button, Dialog } from "../ui/theme";
import { formatDate } from "../ui/format";
import { useApp } from "../ui/useApp";
import { backupDue } from "../store";
import { exportNow } from "./Settings";

export function Characters({ onOpened }: { onOpened: () => void }) {
  const list = useApp((s) => s.list);
  const current = useApp((s) => s.current);
  const error = useApp((s) => s.error);
  const create = useApp((s) => s.create);
  const open = useApp((s) => s.open);
  const remove = useApp((s) => s.remove);
  const settings = useApp((s) => s.settings);
  const exportAll = useApp((s) => s.exportAll);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const t = it.characters;

  return (
    <>
      <h2>{t.title}</h2>
      {error && <div className="ui-error" role="alert">{error}</div>}
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
              <Button onClick={() => void open(c.id).then((ok) => ok && onOpened())}>{t.open}</Button>
              <Button variant="danger" aria-label={`${t.delete} ${c.name || t.unnamed}`} onClick={() => setToDelete(c.id)}>✕</Button>
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
