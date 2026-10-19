/**
 * Une copie de modèle est-elle un programme ordinaire, et rien de plus ?
 *
 *   npm run essais:copie-modele
 *
 * ## Les trois choses qui se vérifient ici
 *
 * 1. **Une copie est un `Programme` valide, modifiable et indépendante.** Si
 *    elle ne passait pas `controlerProgramme`, l'écriture échouerait devant la
 *    personne, sur un message qui ne lui apprendrait rien.
 * 2. **Rien n'écrit dans `sportSeances`.** C'est l'interdit n° 1 du prompt 48,
 *    et c'est une propriété **négative** : elle ne se constate pas en relisant
 *    son propre diff, elle se constate en cherchant et en échouant à trouver.
 * 3. **Les cibles sont celles du calcul, pas celles du dossier.** Le compte
 *    des écarts est épinglé ici : s'il bouge, soit la bibliothèque a changé,
 *    soit la transcription a glissé, et dans les deux cas le compte rendu de
 *    `docs/cyclades/sport/48-cibles-recalculees.md` ne dit plus le vrai.
 *
 * ## Ce qu'il ne vérifie pas
 *
 * Rien de l'écran : c'est l'affaire de l'essai de navigateur. Ici, tout est
 * pur, et tourne sans aperçu ni mot de passe.
 */
import { readFileSync } from 'node:fs';
import {
  BIBLIOTHEQUE,
} from '../src/lib/sport/donnees';
import {
  COEFFICIENT_SECONDAIRE,
  MUSCLES,
  identiteDeComparaison,
  type Exercice,
} from '../src/lib/sport/modele';
import { controlerProgramme, volumePrevu, type Programme } from '../src/lib/sport/programmes';
import { MODELES_DE_PROGRAMMES } from '../src/lib/sport/modeles-programmes';
import {
  ciblesDuModele,
  ecartsDeCibles,
  exercicesDuModele,
  noteDuBloc,
  nomDeLaCopie,
  preparerLaCopie,
  seancesDuModele,
} from '../src/lib/sport/copie-de-modele';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);
const faux = (intitule: string, condition: boolean) => v(intitule, condition, false);

/** La bibliothèque livrée, telle qu'elle existerait à la première ouverture. */
const livree = (): Exercice[] =>
  BIBLIOTHEQUE.map((livre, rang) => ({
    ...livre,
    id: `L${String(rang).padStart(2, '0')}`,
    fourni: true,
    majLe: '2026-10-19T00:00:00.000Z',
  }));

/* ══════════════════════════════════════════════════════════════════════════
   1. Les exercices se retrouvent tous, et sans doublon
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLES EXERCICES DU MODÈLE');

{
  const exercices = livree();
  for (const modele of MODELES_DE_PROGRAMMES) {
    const { manquants, orphelins, resolus } = exercicesDuModele(modele, exercices);
    v(`${modele.cle} : aucun libellé orphelin`, orphelins, []);
    v(
      `${modele.cle} : aucun exercice à créer sur la bibliothèque livrée`,
      manquants.map((m) => m.libelle),
      [],
    );
    /*
       Deux libellés résolus vers le même exercice compteraient deux fois dans
       le volume sans que rien ne le montre.
    */
    const ids = [...resolus.values()].map((e) => e.id);
    v(`${modele.cle} : un exercice par libellé`, ids.length - new Set(ids).size, 0);
  }
}

{
  /*
     Le cas qui compte vraiment : une bibliothèque amputée. Quelqu'un qui a
     supprimé les pompes doit se les voir proposer à la création, et non
     recevoir un programme aux pectoraux à zéro.
  */
  const sansPompes = livree().filter((e) => e.nom !== 'Pompes');
  const maison = MODELES_DE_PROGRAMMES.find((m) => m.cle === 'M6')!;
  const { manquants } = exercicesDuModele(maison, sansPompes);
  v(
    'une bibliothèque amputée nomme ce qui manque',
    manquants.map((m) => `${m.identite.nom} (${m.identite.equipement})`),
    ['Pompes (sol)'],
  );
  const copie = preparerLaCopie(maison, sansPompes);
  faux('et la copie n’est pas déclarée prête', copie.pret);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Une copie est un programme ordinaire
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nUNE COPIE EST UN PROGRAMME ORDINAIRE');

const copies = new Map<string, Programme>();
{
  const exercices = livree();
  for (const modele of MODELES_DE_PROGRAMMES) {
    const copie = preparerLaCopie(modele, exercices);
    if (!copie.pret) {
      echecs += 1;
      console.log(`  \x1b[31m✗\x1b[0m ${modele.cle} : copie non prête sur la bibliothèque livrée`);
      continue;
    }
    const programme: Programme = {
      ...copie.programme,
      id: `copie-${modele.cle}`,
      majLe: '2026-10-19T00:00:00.000Z',
    };
    copies.set(modele.cle, programme);
    v(`${modele.cle} : la copie ne pose aucun problème`, controlerProgramme(programme), []);
    faux(`${modele.cle} : la copie n’est pas active`, programme.actif);
    v(`${modele.cle} : son nom porte « (copie) »`, programme.nom, nomDeLaCopie(modele));
    v(`${modele.cle} : autant de séances que le modèle`, programme.seances.length, modele.seances.length);
    v(
      `${modele.cle} : autant de blocs que le modèle`,
      programme.seances.reduce((n, s) => n + s.blocs.length, 0),
      modele.seances.reduce((n, s) => n + s.blocs.length, 0),
    );
    v(
      `${modele.cle} : les séances gardent l’ordre du dossier`,
      programme.seances.map((s) => s.nom),
      modele.seances.map((s) => s.nom),
    );
  }
  v('les sept modèles donnent une copie', copies.size, 7);
}

{
  /*
     L'indépendance : modifier une copie ne doit rien changer au catalogue,
     sans quoi le second usage d'un modèle hériterait des retouches du
     premier.
  */
  const avant = JSON.stringify(MODELES_DE_PROGRAMMES);
  const copie = copies.get('M1')!;
  copie.nom = 'Autre chose';
  copie.seances[0].blocs[0].series = 99;
  copie.seances.pop();
  v('modifier une copie ne touche pas le catalogue', JSON.stringify(MODELES_DE_PROGRAMMES), avant);

  const neuve = preparerLaCopie(MODELES_DE_PROGRAMMES[0], livree());
  vrai('et une copie neuve repart du modèle', neuve.pret);
  if (neuve.pret) {
    v('avec son nom d’origine', neuve.programme.nom, nomDeLaCopie(MODELES_DE_PROGRAMMES[0]));
    v(
      'et ses séances d’origine',
      neuve.programme.seances.length,
      MODELES_DE_PROGRAMMES[0].seances.length,
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Rien n'écrit dans sportSeances
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nRIEN N’ÉCRIT DANS SPORTSEANCES');

{
  /*
     Une propriété négative se cherche. Les deux modules du prompt 48 ne
     doivent connaître ni le magasin des séances, ni les fonctions qui
     l'ouvrent ou l'alimentent, ni la base elle-même.
  */
  const INTERDITS = ['sportSeances', 'ouvrirSeance', 'ajouterSerie', 'cloreSeance', "from '../db'", "from './db'"];
  for (const fichier of [
    'src/lib/sport/modeles-programmes.ts',
    'src/lib/sport/copie-de-modele.ts',
  ]) {
    const texte = readFileSync(fichier, 'utf8');
    /*
       Les commentaires sont retirés avant la recherche : l'en-tête de
       `copie-de-modele.ts` explique précisément qu'il ne touche pas
       `sportSeances`, et cette phrase ne doit pas faire rougir le contrôle
       qu'elle décrit.
    */
    const code = texte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    v(
      `${fichier} ne connaît pas les séances`,
      INTERDITS.filter((mot) => code.includes(mot)),
      [],
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Les cibles sont recalculées, et les écarts épinglés
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLES CIBLES SONT CELLES DU CALCUL');

{
  const exercices = livree();
  for (const modele of MODELES_DE_PROGRAMMES) {
    const { resolus } = exercicesDuModele(modele, exercices);
    const cibles = ciblesDuModele(modele, resolus, exercices);
    v(
      `${modele.cle} : les dix-huit muscles portent une cible`,
      Object.keys(cibles).length,
      MUSCLES.length,
    );

    /*
       La cible et le « prévu » de l'écran doivent sortir du même calcul,
       sinon la colonne « écart » mesure la divergence des deux formules.
    */
    const programme: Programme = {
      id: 'x',
      nom: modele.nom,
      description: '',
      seances: seancesDuModele(modele, resolus),
      parSemaine: modele.parSemaine,
      actif: false,
      ciblesParMuscle: {},
      majLe: '2026-10-19T00:00:00.000Z',
    };
    const prevu = volumePrevu(programme, exercices);
    const memes = MUSCLES.every((m) => (prevu.series[m.id] ?? 0) === cibles[m.id]);
    vrai(`${modele.cle} : la cible est le volume prévu, au même calcul`, memes);
  }
}

console.log('\nLES ÉCARTS AVEC LE DOSSIER, ÉPINGLÉS');
{
  const exercices = livree();
  const parModele = MODELES_DE_PROGRAMMES.map((modele) => {
    const { resolus } = exercicesDuModele(modele, exercices);
    return { cle: modele.cle, ecarts: ecartsDeCibles(modele, resolus, exercices) };
  });

  v(
    'le nombre de cibles qui changent, modèle par modèle',
    parModele.map((p) => `${p.cle}:${p.ecarts.length}`),
    ['M1:10', 'M2:11', 'M3:10', 'M4:10', 'M5:10', 'M6:5', 'M7:10'],
  );
  v(
    'soit soixante-six sur cent vingt-six',
    parModele.reduce((n, p) => n + p.ecarts.length, 0),
    66,
  );

  /*
     Le cas le plus lourd, et celui qui demande un arbitrage : les adducteurs
     tombent à zéro sur quatre modèles, parce que la bibliothèque ne les
     compte ni au squat, ni aux fentes, ni à la presse à cuisses.
  */
  const adducteursAZero = MODELES_DE_PROGRAMMES.filter((modele) => {
    const { resolus } = exercicesDuModele(modele, exercices);
    return ciblesDuModele(modele, resolus, exercices).adducteurs === 0;
  }).map((m) => m.cle);
  v('les adducteurs tombent à zéro sur quatre modèles', adducteursAZero, ['M1', 'M4', 'M5', 'M6']);

  /*
     La sensibilité que le dossier avait lui-même annoncée pour M1 : les
     fessiers passent de 9 à 12 — et non à 13,5, parce que sa note supposait
     aussi la presse à cuisses en muscle principal, ce que la bibliothèque ne
     fait pas. L'épingler, c'est garder la trace de la raison.
  */
  const m1 = MODELES_DE_PROGRAMMES.find((m) => m.cle === 'M1')!;
  const { resolus } = exercicesDuModele(m1, exercices);
  v('M1 : les fessiers du dossier', m1.ciblesDuDossier.fessiers, 9);
  v('M1 : les fessiers calculés', ciblesDuModele(m1, resolus, exercices).fessiers, 12);

  v('le coefficient employé reste celui du modèle', COEFFICIENT_SECONDAIRE, 0.5);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. La note du bloc : le RIR est une aide, le jargon s'en va
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLA NOTE DU BLOC');

{
  const note = (note: string, rir: string | null) =>
    noteDuBloc({
      exercice: 'x',
      series: 3,
      repetitionsMin: 8,
      repetitionsMax: 12,
      repos: 120,
      rir,
      deloadSeries: 2,
      deloadRir: '3-4',
      note,
    });

  v(
    'le RIR visé est posé comme une aide',
    note('', '1-2'),
    'Garder 1-2 répétitions en réserve, à titre indicatif.',
  );
  v(
    'la mention de chantier est retirée',
    note('Exercice à ajouter (R4).', null),
    '',
  );
  v(
    'la note du dossier est gardée, sans la mention',
    note('Une série = les deux côtés faits (compte pour 1 série). Exercice à ajouter (R4).', '1-2'),
    'Une série = les deux côtés faits (compte pour 1 série). Garder 1-2 répétitions en réserve, à titre indicatif.',
  );
  v('un maintien ne parle pas de réserve', note('Répétitions = secondes de maintien.', null), 'Répétitions = secondes de maintien.');

  /* Aucune note de copie ne doit porter le jargon de chantier. */
  const toutes = MODELES_DE_PROGRAMMES.flatMap((m) =>
    m.seances.flatMap((s) => s.blocs.map((b) => noteDuBloc(b))),
  );
  v('aucune note de copie ne parle de R4', toutes.filter((n) => /R4/.test(n)), []);
  v('aucune note de copie ne porte « (s) »', toutes.filter((n) => /\(s\)/.test(n)), []);
}

/* ══════════════════════════════════════════════════════════════════════════
   6. L'identité de comparaison est respectée
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nL’IDENTITÉ DE COMPARAISON');

{
  /*
     Les deux « hip thrust » et les deux « soulevé de terre jambes tendues »
     sont des exercices distincts : l'équipement fait partie de l'identité.
     Les confondre inventerait une progression au changement de matériel.
     C'est ce que le prompt appelle « un exercice par équipement ».
  */
  const identites = BIBLIOTHEQUE.map(identiteDeComparaison);
  v('aucun doublon dans la bibliothèque', identites.length - new Set(identites).size, 0);
  for (const nom of ['Hip thrust', 'Soulevé de terre jambes tendues']) {
    v(
      `« ${nom} » existe en deux équipements`,
      BIBLIOTHEQUE.filter((e) => e.nom === nom).map((e) => e.equipement).sort(),
      nom === 'Hip thrust' ? ['barre', 'haltère'] : ['barre', 'haltères'],
    );
  }
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
