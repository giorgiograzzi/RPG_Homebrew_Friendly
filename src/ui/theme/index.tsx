import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { strings } from "../../i18n";
import { icons, type IconName } from "./icons";
import "./theme.css";

export function Button({ variant, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" }) {
  return <button type="button" {...rest} className={`ui-btn ${variant ?? ""} ${className}`} />;
}

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      <span className="ui-label">{label}</span>
      {help && <span className="ui-help">{help}</span>}
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ui-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="ui-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export interface TabDef { id: string; label: string; icon: IconName; disabled?: boolean }
export function TabBar({ tabs, current, onSelect }: { tabs: TabDef[]; current: string; onSelect: (id: string) => void }) {
  return (
    <nav className="ui-tabs" aria-label={strings.app.nav}>
      {tabs.map((t) => {
        const Icon = icons[t.icon];
        return (
          <button key={t.id} type="button" className="ui-tab" aria-current={t.id === current ? "page" : undefined} disabled={t.disabled} onClick={() => onSelect(t.id)}>
            <Icon /><span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Barra in basso della scheda: al posto delle tab principali, con "Indietro" per tornare al menu principale
// Solo icone per risparmiare spazio (il nome è in aria-label e title)
export function SectionBar({ items, current, onSelect, onBack, backLabel }: { items: { id: string; label: string; icon: IconName }[]; current: string; onSelect: (id: string) => void; onBack: () => void; backLabel: string }) {
  const Back = icons.back;
  return (
    <nav className="ui-sections" aria-label={strings.play.sections}>
      <button type="button" className="back" aria-label={backLabel} title={backLabel} onClick={onBack}><Back /></button>
      {items.map((s) => {
        const Icon = icons[s.icon];
        return <button key={s.id} type="button" aria-label={s.label} title={s.label} aria-current={s.id === current ? "page" : undefined} onClick={() => onSelect(s.id)}><Icon /></button>;
      })}
    </nav>
  );
}

// Popup: su telefono sale dal basso («bottom sheet»), da 640px è una finestra modale al centro. Esc o tocco fuori chiudono.
// `titleAction` (opzionale): un interruttore con icona accanto al titolo, es. Homebrew / SRD
export function Dialog({ title, children, onClose, titleAction }: { title: string; children: ReactNode; onClose: () => void; titleAction?: { label: string; icon: IconName; pressed: boolean; onClick: () => void } }) {
  const ActionIcon = titleAction ? icons[titleAction.icon] : null;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // il focus entra nella finestra, resta dentro finché è aperta (Tab e Maiusc+Tab girano) e torna dov'era alla chiusura
    const before = document.activeElement as HTMLElement | null;
    const focusable = () => [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])].filter((e) => e.offsetParent !== null);
    (focusable()[0] ?? box.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusable();
      if (!f.length) { e.preventDefault(); return; }
      const [first, last] = [f[0]!, f[f.length - 1]!];
      if (e.shiftKey && (document.activeElement === first || !box.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !box.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, [onClose]);
  // in un portale sul body: sopra intestazione e barra in basso, qualunque sia il contenitore da cui si apre
  return createPortal(
    <div className="ui-overlay" onClick={onClose}>
      <div ref={box} tabIndex={-1} className="ui-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="ui-dialog-head">
          <span className="ui-dialog-name">{title}</span>
          {titleAction && ActionIcon && <button type="button" className="ui-icon-btn" aria-label={titleAction.label} title={titleAction.label} aria-pressed={titleAction.pressed} onClick={titleAction.onClick}><ActionIcon /></button>}
          <button type="button" className="ui-icon-btn" aria-label={strings.play.close} title={strings.play.close} onClick={onClose}><icons.close /></button>
        </header>
        <div className="ui-dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
export { icons };
export type { IconName };
