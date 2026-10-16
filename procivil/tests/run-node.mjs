// Exécution des tests en ligne de commande : node tests/run-node.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { executerTests } from './cas.js';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => JSON.parse(readFileSync(join(racine, 'data', f), 'utf8'));
const regles = { catalogue: lire('delais.json'), feries: lire('feries.json'), distance: lire('distance.json'), competence: lire('competence.json'), juridictions: lire('juridictions/echantillon.json') };

const res = executerTests(regles);
let groupe = '';
for (const r of res) {
  if (r.groupe !== groupe) { groupe = r.groupe; console.log(`\n## ${groupe}`); }
  console.log(`${r.ok ? '  ✔' : '  ✘'} ${r.titre}${r.ok ? '' : `\n      → ${r.detail}`}`);
}
const ko = res.filter((r) => !r.ok).length;
console.log(`\n${res.length - ko}/${res.length} tests réussis`);
process.exit(ko ? 1 : 0);
