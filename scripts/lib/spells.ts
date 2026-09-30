import { readKind } from "./equipment";

// id → livello degli incantesimi estratti (npm run extract:data li genera prima degli altri dati)
export const spellLevels = () => new Map<string, number>(readKind("spells").map((s) => [s.id as string, s.level as number]));

// Visita ricorsivamente i dati e allinea i grantSpell ai livelli veri: un trucchetto è sempre `cantrip`
// (a volontà, niente lancio gratuito), un incantesimo di livello 1+ non può esserlo. Un id sconosciuto ferma l'estrazione.
export function fixSpellModes(data: unknown, ctx: string, levels = spellLevels()): number {
  let fixed = 0;
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, any>;
    if (o.op === "grantSpell") {
      const lv = levels.get(o.spell);
      if (lv === undefined) throw new Error(`${ctx}${path}: incantesimo sconosciuto "${o.spell}"`);
      if (lv === 0 && o.mode !== "cantrip") { o.mode = "cantrip"; delete o.freeCast; fixed++; }
      else if (lv > 0 && o.mode === "cantrip") throw new Error(`${ctx}${path}: "${o.spell}" è di livello ${lv}, non un trucchetto`);
    }
    for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`);
  };
  walk(data, "");
  return fixed;
}
