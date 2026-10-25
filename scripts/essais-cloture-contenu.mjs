/**
 * Essais de la garde de clôture du contenu.
 *
 * La garde est éteinte sur le build, donc son essai est le seul endroit où
 * elle s'exerce avant le jour de la clôture. Il porte sur trois choses.
 *
 * 1. LA FONCTION PURE. Ce qu'elle refuse, ce qu'elle laisse passer, et le cas
 *    limite du périmètre vide — zéro sur zéro est une couverture complète, et
 *    non un manque.
 *
 * 2. LE DRAPEAU. Les valeurs reconnues, et le fait qu'une valeur inconnue
 *    retombe sur le défaut au lieu d'être devinée. Un drapeau mal orthographié
 *    qui éteindrait la garde en silence serait pire que pas de garde du tout.
 *
 * 3. LE VÉRIFICATEUR LUI-MÊME, par son CODE DE SORTIE, drapeau éteint puis
 *    allumé. L'assertion n'est pas « allumé, il échoue » — elle serait fausse
 *    le jour où la banque sera complète, et l'essai deviendrait une bombe à
 *    retardement. L'invariant éprouvé est le bon : drapeau allumé, le
 *    vérificateur échoue SI ET SEULEMENT SI la couverture est incomplète. Il
 *    tient aujourd'hui, où la couverture est partielle, et il tiendra après la
 *    clôture, où elle sera complète.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTENU_CLOS, contenuEstClos, manquesDeCouverture } from './lib/cloture-contenu.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let echecs = 0;
function verifier(titre, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) {
    echecs += 1;
    console.log(`\x1b[31m✗\x1b[0m ${titre}`);
    console.log(`    attendu : ${JSON.stringify(attendu)}`);
    console.log(`    obtenu  : ${JSON.stringify(obtenu)}`);
  } else {
    console.log(`\x1b[32m✓\x1b[0m ${titre}`);
  }
}

/* --- 1. La fonction pure ------------------------------------------------ */

verifier(
  'un périmètre complet ne produit aucun manque',
  manquesDeCouverture([['maths', { total: 134, corrigees: 134 }]]),
  [],
);

verifier(
  'un périmètre vide ne produit aucun manque',
  manquesDeCouverture([['rubrique-neuve', { total: 0, corrigees: 0 }]]),
  [],
);

verifier(
  'un périmètre incomplet produit un manque, et un seul',
  manquesDeCouverture([['maths', { total: 134, corrigees: 40 }]]).length,
  1,
);

verifier(
  'le manque nomme le périmètre et le nombre de questions découvertes',
  manquesDeCouverture([['maths', { total: 134, corrigees: 40 }]])[0],
  'maths : 94 question(s) sans correction sur 134 — ' +
    'le contenu est déclaré clos, donc la couverture doit être complète',
);

verifier(
  'une seule question manquante suffit à faire un manque',
  manquesDeCouverture([['anglais', { total: 5, corrigees: 4 }]]).length,
  1,
);

verifier(
  'chaque périmètre incomplet est signalé séparément',
  manquesDeCouverture([
    ['maths', { total: 134, corrigees: 40 }],
    ['francais', { total: 82, corrigees: 82 }],
    ['logique', { total: 64, corrigees: 10 }],
  ]).length,
  2,
);

/* Un compteur absent ne doit pas faire passer un périmètre pour complet par
   accident : sans total, il n'y a rien à exiger, et la garde se tait. */
verifier(
  'un périmètre sans compteur ne provoque ni manque ni plantage',
  manquesDeCouverture([['inconnu', undefined]]),
  [],
);

/* --- 2. Le drapeau ------------------------------------------------------ */

const avecDrapeau = (valeur) => {
  const ancien = process.env.CYCLADES_CONTENU_CLOS;
  if (valeur === undefined) delete process.env.CYCLADES_CONTENU_CLOS;
  else process.env.CYCLADES_CONTENU_CLOS = valeur;
  try {
    return contenuEstClos();
  } finally {
    if (ancien === undefined) delete process.env.CYCLADES_CONTENU_CLOS;
    else process.env.CYCLADES_CONTENU_CLOS = ancien;
  }
};

verifier('sans drapeau, la garde suit la constante de clôture', avecDrapeau(undefined), CONTENU_CLOS);
verifier('le drapeau « 1 » allume la garde', avecDrapeau('1'), true);
verifier('le drapeau « oui » allume la garde', avecDrapeau('oui'), true);
verifier('le drapeau « 0 » éteint la garde', avecDrapeau('0'), false);
verifier('le drapeau « non » éteint la garde', avecDrapeau('non'), false);
verifier(
  'une valeur inconnue retombe sur le défaut au lieu d’être devinée',
  avecDrapeau('peut-etre'),
  CONTENU_CLOS,
);
verifier('une valeur vide retombe sur le défaut', avecDrapeau(''), CONTENU_CLOS);

/* --- 3. Le vérificateur, par son code de sortie ------------------------- */

const sansCouleur = (t) => t.replace(/\x1b\[[0-9;]*m/g, '');

function lancerVerificateur(clos) {
  const r = spawnSync(process.execPath, [path.join(racine, 'scripts', 'verifier-corrections.mjs')], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, CYCLADES_CONTENU_CLOS: clos ? '1' : '0' },
  });
  const sortie = sansCouleur(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  const m = sortie.match(/Couverture\s*:\s*(\d+)\s*\/\s*(\d+)/);
  return {
    code: r.status,
    corrigees: m ? Number(m[1]) : null,
    total: m ? Number(m[2]) : null,
    sortie,
  };
}

const eteint = lancerVerificateur(false);

/*
   CE CONTRÔLE GELAIT « LE CORPUS N'A AUCUNE INCOHÉRENCE », ET LE CORPUS RÉEL
   L'A DÉMENTI.

   Il affirmait « drapeau éteint, le vérificateur passe », c'est-à-dire code 0.
   Or le vérificateur sort en 1 dès qu'il y a UNE erreur, quel que soit le
   drapeau — et c'est juste : une correction dont la prose annonce « 2
   niveaux » au-dessus d'un schéma qui en porte 4 est fausse, que le contenu
   soit déclaré clos ou non. Le drapeau ne gouverne que la COUVERTURE.

   Sur le corpus réel, le contrôle des visuels que cette branche apporte
   trouve DOUZE écarts de ce genre. C'est son office, et c'est une bonne
   nouvelle : il travaille. Mais il rendait cet essai rouge pour une raison
   qui n'est pas la sienne.

   Pourquoi A ne pouvait pas le voir : un arbre de travail séparé ne porte
   pas « content/ », qui est ignoré par Git. Sans corpus, aucun écart, et le
   contrôle passait. C'est la quatrième fois aujourd'hui que le corpus réel
   voit ce que l'absence de corpus cachait.

   Ce que ce contrôle VEUT dire, et qui ne dépend d'aucun corpus : drapeau
   éteint, le vérificateur ne refuse pas POUR LA COUVERTURE. On le mesure
   donc sur ce qu'il dit de la couverture, et non sur son code de sortie, que
   d'autres causes légitimes font varier.
*/
verifier(
  'drapeau éteint, le vérificateur ne refuse pas pour la couverture',
  !eteint.sortie.includes('périmètre(s) incomplet(s)'),
  true,
);
verifier(
  'et il ne prétend pas non plus que le contenu est clos',
  !eteint.sortie.includes('Contenu déclaré clos'),
  true,
);
/*
   Et s'il refuse, qu'il le dise. Un code non nul sans problème nommé serait
   le pire des deux mondes : un refus muet.
*/
if (eteint.code !== 0) {
  verifier(
    'et s’il refuse quand même, c’est en nommant des problèmes',
    /\d+ problème\(s\) :/.test(eteint.sortie),
    true,
  );
  const combien = /(\d+) problème\(s\) :/.exec(eteint.sortie)?.[1] ?? '?';
  console.log(
    `  \x1b[33m⚠\x1b[0m le corpus servi porte ${combien} problème(s) de correction. ` +
      'Ils ne relèvent pas de la clôture : ils sont nommés fiche par fiche par ' +
      '« npm run essais:corrections ».',
  );
}
verifier('le vérificateur imprime bien sa couverture', eteint.total !== null, true);

const allume = lancerVerificateur(true);
const couvertureComplete = allume.total !== null && allume.corrigees >= allume.total;

/*
 * L'invariant, et c'est lui qui vaut l'essai : drapeau allumé, le code de
 * sortie dit exactement si la couverture est complète. On lit le code, pas une
 * ligne filtrée.
 */
verifier(
  `drapeau allumé, le code de sortie suit la couverture (${allume.corrigees} / ${allume.total})`,
  allume.code === 0,
  couvertureComplete,
);

/*
 * Et la garde se dit à voix haute dans les deux cas. Sans cela, le jour de la
 * clôture, rien ne distinguerait un build vert parce que la garde est
 * satisfaite d'un build vert parce qu'elle ne s'est pas exécutée.
 */
verifier(
  'drapeau allumé, la garde annonce son verdict',
  /Contenu déclaré clos/.test(allume.sortie),
  true,
);
verifier(
  'drapeau éteint, la garde reste muette',
  /Contenu déclaré clos/.test(eteint.sortie),
  false,
);

if (!couvertureComplete) {
  verifier(
    'drapeau allumé sur une banque incomplète, le manque est nommé',
    /question\(s\) sans correction sur/.test(allume.sortie),
    true,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
