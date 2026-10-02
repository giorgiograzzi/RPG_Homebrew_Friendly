import { lang, strings as it } from "../i18n";
import { CONTROLLER, POLICIES, type PolicyKind } from "../legal/policies";
import { Button } from "../ui/theme";

const t = it.legal;

// Privacy Policy e Cookie Policy (testi in src/legal/policies.ts), nella lingua dell'app
export function Legal({ kind, onBack, onOpen }: { kind: PolicyKind; onBack: () => void; onOpen: (kind: PolicyKind) => void }) {
  const doc = POLICIES[kind][lang];
  const other: PolicyKind = kind === "privacy" ? "cookies" : "privacy";
  return (
    <article className="legal" lang={lang} data-testid={`policy-${kind}`}>
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={onBack}>← {t.back}</Button></div>
      <h2>{doc.title}</h2>
      <p className="ui-muted">{doc.updated}</p>
      <p className="ui-muted">{t.controller}: {CONTROLLER.name} · <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a></p>
      {doc.intro.map((p, i) => <p key={i}>{p}</p>)}
      {doc.sections.map((s, i) => (
        <section key={i}>
          {s.h && <h3>{s.h}</h3>}
          {s.p?.map((p, j) => <p key={j}>{p}</p>)}
          {s.ul && <ul>{s.ul.map((li, j) => <li key={j}>{li}</li>)}</ul>}
          {s.table && (
            <div className="legal-table" tabIndex={0} role="region" aria-label={s.h || doc.title}>
              <table>
                <thead><tr>{s.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>{s.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      <p className="ui-muted">{t.disclaimer}</p>
      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button onClick={() => onOpen(other)}>{t.other[other]}</Button>
        <Button onClick={onBack}>← {t.back}</Button>
      </div>
    </article>
  );
}
