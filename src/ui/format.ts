export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
export const formatDate = (t: number) => new Date(t).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
