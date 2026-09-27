/**
 * Contrôle du socle de Relational Reasoning.
 *
 *   npm run essais:relationnel
 *
 * Vérifie les tables de composition, la converse, la propagation, la détection
 * d'incohérence, puis passe mille instances de chaque système au crible : aucune
 * ne doit être incohérente, et la relation du modèle caché doit toujours figurer
 * parmi celles que l'énoncé laisse possibles. Cette dernière vérification est la
 * plus utile : elle attraperait un générateur qui énonce un fait faux.
 *
 * Le script s'exécute par « tsx », seule dépendance de développement ajoutée
 * pour lui : elle ne part jamais dans le navigateur, et elle évite d'imposer au
 * reste du dépôt la convention d'imports à extension explicite qu'exigerait le
 * dépouillement de types natif de Node.
 */
import { alea } from '../src/features/relational-reasoning/noyaux/aleatoire';
import { composerChemin, possibilites, coherent } from '../src/features/relational-reasoning/noyaux/algebre';
import { line } from '../src/features/relational-reasoning/systemes/line';
import { plane } from '../src/features/relational-reasoning/systemes/plane';
import { groups } from '../src/features/relational-reasoning/systemes/groups';
import type { Systeme } from '../src/features/relational-reasoning/systemes/types';

function algebreDe(s: Systeme) {
  return { relations: s.relations.map((r) => r.id), converse: s.converse, composer: s.composer! };
}
const nom = (s: Systeme, id: string) => s.relations.find((r) => r.id === id)!.libelle;

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok ? '' : `\n      obtenu  ${a}\n      attendu ${b}`}`);
}
const tri = (e: Set<string>) => [...e].sort();

console.log('\nALGÈBRE DE POINTS — line (axe strict, pas d\'égalité)');
const al = algebreDe(line);
verifier('vocabulaire', line.relations.map((r) => r.id).sort(), ['a', 'p']);
verifier('avant ∘ avant = avant', tri(al.composer('a', 'a')), ['a']);
verifier('avant ∘ après indéterminé', tri(al.composer('a', 'p')), ['a', 'p']);
verifier('converse involutive', al.converse(al.converse('a')), 'a');

console.log('\nPRODUIT — plane (« nord » ∘ « est » = « nord-est »)');
const ap = algebreDe(plane);
verifier('nord ∘ est = nord-est', tri(ap.composer('ep', 'pe')), ['pp']);
verifier('libellé de pp', nom(plane, 'pp'), 'est au nord-est de');
verifier('nord ∘ sud laisse la colonne', tri(ap.composer('ep', 'ea')), ['ea', 'ee', 'ep']);
verifier('nord-est ∘ sud-ouest : neuf cas', ap.composer('pp', 'aa').size, 9);
verifier('converse de nord-est = sud-ouest', ap.converse('pp'), 'aa');
verifier('vocabulaire de plane', plane.relations.length, 9);

console.log('\nÉQUILIBRE STRUCTUREL — groups (Z₂)');
const ag = algebreDe(groups);
verifier('allié ∘ allié = allié', tri(ag.composer('allie', 'allie')), ['allie']);
verifier('allié ∘ rival = rival', tri(ag.composer('allie', 'rival')), ['rival']);
verifier('rival ∘ rival = allié', tri(ag.composer('rival', 'rival')), ['allie']);

console.log('\nCHAÎNE');
verifier('trois pas vers l\'est', tri(composerChemin(ap, ['pe', 'pe', 'pe'])), ['pe']);
verifier('est puis nord', tri(composerChemin(ap, ['pe', 'ep'])), ['pp']);

console.log('\nINDÉTERMINATION — ce dont vivent les moteurs de la catégorie C');
const faits = [
  { sujet: 'A', relation: 'a', objet: 'B' },
  { sujet: 'C', relation: 'a', objet: 'B' },
];
verifier(
  'A avant B, C avant B → A vs C ouvert',
  tri(possibilites(al, line.cheminComplet, ['A', 'B', 'C'], faits, 'A', 'C')),
  ['a', 'p'],
);
const chaine = [
  { sujet: 'A', relation: 'a', objet: 'B' },
  { sujet: 'B', relation: 'a', objet: 'C' },
];
verifier(
  'A avant B avant C → A avant C, fermé',
  tri(possibilites(al, line.cheminComplet, ['A', 'B', 'C'], chaine, 'A', 'C')),
  ['a'],
);

console.log('\nINCOHÉRENCE — ce que détecte le moteur Contradiction');
const cycle = [
  { sujet: 'A', relation: 'a', objet: 'B' },
  { sujet: 'B', relation: 'a', objet: 'C' },
  { sujet: 'C', relation: 'a', objet: 'A' },
];
verifier('cycle avant-avant-avant impossible', coherent(al, line.cheminComplet, ['A', 'B', 'C'], cycle), false);
const triangleDesequilibre = [
  { sujet: 'X', relation: 'allie', objet: 'Y' },
  { sujet: 'Y', relation: 'allie', objet: 'Z' },
  { sujet: 'X', relation: 'rival', objet: 'Z' },
];
verifier('triangle déséquilibré impossible', coherent(ag, groups.cheminComplet, ['X', 'Y', 'Z'], triangleDesequilibre), false);

console.log('\nGÉNÉRATEURS — cohérence de mille instances, tous paliers');
for (const systeme of [line, plane, groups]) {
  const a = algebreDe(systeme);
  let mauvaises = 0;
  let desaccords = 0;
  for (let graine = 1; graine <= 1000; graine += 1) {
    const hasard = alea(graine);
    const difficulte = 1 + (graine % 10);
    const instance = systeme.engendrer(difficulte, hasard);
    if (!coherent(a, systeme.cheminComplet, instance.entites, instance.faits)) mauvaises += 1;
    // La relation du modèle doit toujours figurer parmi les possibles.
    for (const x of instance.entites) {
      for (const y of instance.entites) {
        if (x === y) continue;
        const vraie = systeme.relationDansModele(instance.modele!, x, y);
        const ouvertes = possibilites(a, systeme.cheminComplet, instance.entites, instance.faits, x, y);
        if (!ouvertes.has(vraie)) desaccords += 1;
      }
    }
  }
  verifier(`${systeme.id} : instances incohérentes`, mauvaises, 0);
  verifier(`${systeme.id} : modèle exclu des possibles`, desaccords, 0);
}

console.log(`\n${echecs ? `\x1b[31m✖ ${echecs} échec(s)\x1b[0m` : '\x1b[32m✓ tout passe\x1b[0m'}\n`);
process.exit(echecs ? 1 : 0);
