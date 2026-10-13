/**
 * Les insécables : ce qu'elles posent, et ce qu'elles laissent tranquille.
 *
 * Le second groupe compte autant que le premier. Une règle typographique qui
 * déborde abîme des URL, de l'anglais et du code cité, et le fait en silence.
 */
import { insecables } from '../src/lib/typographie';

const FINE = ' ';
const NBSP = ' ';

const CAS: [string, string, string][] = [
  ['pose la fine devant le point d’interrogation', 'Quoi ?', `Quoi${FINE}?`],
  ['pose la fine devant le point d’exclamation', 'Ah !', `Ah${FINE}!`],
  ['pose la fine devant le point-virgule', 'un ; deux', `un${FINE}; deux`],
  ['pose l’insécable devant les deux-points', 'Note : ceci', `Note${NBSP}: ceci`],
  ['serre les guillemets français', 'dit « oui » ici', `dit «${NBSP}oui${NBSP}» ici`],
  ['réduit plusieurs espaces à une insécable', 'Quoi   ?', `Quoi${FINE}?`],
  ['laisse une URL intacte', 'voir https://exemple.fr/a', 'voir https://exemple.fr/a'],
  ['n’ajoute rien devant un signe collé', 'Really?', 'Really?'],
  ['laisse un deux-points collé', 'ratio 3:1', 'ratio 3:1'],
  ['ne touche pas un saut de ligne', 'fin\n?', 'fin\n?'],
  ['est idempotente', `Quoi${FINE}?`, `Quoi${FINE}?`],
];

let rouges = 0;
for (const [quoi, entree, attendu] of CAS) {
  const obtenu = insecables(entree);
  if (obtenu === attendu) console.log(`✓ ${quoi}`);
  else {
    console.log(`✗ ${quoi}\n    attendu ${JSON.stringify(attendu)}\n    obtenu  ${JSON.stringify(obtenu)}`);
    rouges += 1;
  }
}

if (rouges > 0) {
  console.log(`\n${rouges} cas rouge(s) sur ${CAS.length}.`);
  process.exit(1);
}
console.log(`\n✓ ${CAS.length} cas verts.`);
