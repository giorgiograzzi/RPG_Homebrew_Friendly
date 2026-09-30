import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { icons, type IconName } from "./icons";
import "./xp.css";

export function Button({ variant, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" }) {
  return <button type="button" {...rest} className={`xp-btn ${variant ?? ""} ${className}`} />;
}

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="xp-field">
      <span className="xp-label">{label}</span>
      {help && <span className="xp-help">{help}</span>}
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="xp-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="xp-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export interface TabDef { id: string; label: string; icon: IconName; disabled?: boolean }
export function TabBar({ tabs, current, onSelect }: { tabs: TabDef[]; current: string; onSelect: (id: string) => void }) {
  return (
    <nav className="xp-tabs" role="tablist">
      {tabs.map((t) => {
        const Icon = icons[t.icon];
        return (
          <button key={t.id} type="button" role="tab" className="xp-tab" aria-selected={t.id === current} disabled={t.disabled} onClick={() => onSelect(t.id)}>
            <Icon /><span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Popup: finestra "Prompt di MS-DOS" di Windows 95 (barra blu con _ □ ×; solo × funziona). Esc chiude.
// Barra in basso della scheda: al posto delle tab principali, con "Indietro" per tornare al menu principale
// Solo icone per risparmiare spazio (il nome è in aria-label e title)
export function SectionBar({ items, current, onSelect, onBack, backLabel }: { items: { id: string; label: string; icon: IconName }[]; current: string; onSelect: (id: string) => void; onBack: () => void; backLabel: string }) {
  const Back = icons.back;
  return (
    <nav className="xp-sections" aria-label="Sezioni della scheda">
      <button type="button" className="back" aria-label={backLabel} title={backLabel} onClick={onBack}><Back /></button>
      {items.map((s) => {
        const Icon = icons[s.icon];
        return <button key={s.id} type="button" aria-label={s.label} title={s.label} aria-current={s.id === current ? "page" : undefined} onClick={() => onSelect(s.id)}><Icon /></button>;
      })}
    </nav>
  );
}

// Popup: finestra "Prompt di MS-DOS" di Windows 95 (barra blu con _ □ ×; solo × funziona). Esc chiude.
// `titleAction` (opzionale) prende il posto del pulsante "_" nella barra: un interruttore con simbolo, es. Homebrew / Manuale
export function Dialog({ title, children, onClose, titleAction }: { title: string; children: ReactNode; onClose: () => void; titleAction?: { label: string; icon: IconName; pressed: boolean; onClick: () => void } }) {
  const ActionIcon = titleAction ? icons[titleAction.icon] : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // in un portale sul body: sopra intestazione e barra in basso, qualunque sia il contenitore da cui si apre
  return createPortal(
    <div className="xp-overlay" onClick={onClose}>
      <div className="xp-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="dos-title">
          <span className="dos-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" fill="#000" stroke="#c0c0c0" strokeWidth="2" /><path d="M5 9l3 3-3 3M10 15h5" fill="none" stroke="#c0c0c0" strokeWidth="1.6" /></svg>
          </span>
          <span className="dos-name">{title}</span>
          {titleAction && ActionIcon
            ? <button type="button" className="dos-btn action" aria-label={titleAction.label} title={titleAction.label} aria-pressed={titleAction.pressed} onClick={titleAction.onClick}><ActionIcon /></button>
            : <span className="dos-btn" aria-hidden="true">_</span>}
          <span className="dos-btn" aria-hidden="true">□</span>
          <button type="button" className="dos-btn close" aria-label="Chiudi" onClick={onClose}>×</button>
        </header>
        <div className="xp-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
export { icons };
export type { IconName };
