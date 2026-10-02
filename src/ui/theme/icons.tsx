import type { ReactNode } from "react";

// Icone semplici disegnate per l'app (SVG originali)
const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const wrap = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>{children}</svg>
);
export const icons = {
  menu: () => wrap(<><path d="M4 6h16M4 12h16M4 18h16" /></>),
  characters: () => wrap(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>),
  sheet: () => wrap(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>),
  equip: () => wrap(<><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></>),
  magic: () => wrap(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" /></>),
  back: () => wrap(<><path d="M15 5l-7 7 7 7" /><path d="M8 12h12" /></>),
  heart: () => wrap(<><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></>),
  star: () => wrap(<><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>),
  chart: () => wrap(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  sword: () => wrap(<><path d="M14 4l6-1-1 6-9 9-3-3z" /><path d="M6 15l-3 3 3 3 3-3M9 12l3 3" /></>),
  alert: () => wrap(<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>),
  notes: () => wrap(<><path d="M6 3h9l4 4v14H6z" /><path d="M9 11h7M9 15h7M9 19h4" /></>),
  close: () => wrap(<><path d="M6 6l12 12M18 6L6 18" /></>),
  homebrew: () => wrap(<><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></>),
};
export type IconName = keyof typeof icons;
