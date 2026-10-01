// Valida data/srd/<lingua>/: schema Zod, id duplicati, riferimenti incrociati e parità degli id tra IT e EN.
import { brokenReferences, idsByKind, loadSrd, SRD_LANGS } from "../src/data/srdIntegrity";

const problems: string[] = [];
for (const l of SRD_LANGS) {
  const rs = loadSrd(l);
  problems.push(...rs.errors.map((e) => `[${l}] ${e}`), ...brokenReferences(rs).map((e) => `[${l}] ${e}`));
}
const [a, b] = [idsByKind("it"), idsByKind("en")];
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const [x, y] = [a[k] ?? [], b[k] ?? []];
  for (const id of x) if (!y.includes(id)) problems.push(`${k}/${id}: solo in IT`);
  for (const id of y) if (!x.includes(id)) problems.push(`${k}/${id}: solo in EN`);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`ok: ${Object.entries(a).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
