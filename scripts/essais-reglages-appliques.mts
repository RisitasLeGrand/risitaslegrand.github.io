/**
 * Ce que Cyclades en déduit **vraiment** (P4 du prompt 56).
 *
 *   npm run essais:reglages-appliques
 *
 * ## Le défaut, tel qu'il a été mesuré
 *
 * L'écran « Mon profil » affichait huit réglages sous « Ce que Cyclades en
 * déduit », chacun avec la réponse dont il découle. Cinq ne sont appliqués
 * nulle part : les jours de repos, les créneaux, les parcours ouverts, les
 * avis et l'objectif hebdomadaire. `reglagesLocaux()` n'a qu'un appelant,
 * l'écran lui-même ; les champs dont ils découlent — les jours de travail, le
 * style d'accompagnement, les concours, l'heure de rappel — ne sont nommés
 * nulle part ailleurs dans `src/`.
 *
 * L'un d'eux affirmait même « Un jour de repos ne casse pas votre série »,
 * alors que `gamification.ts` ne lit jamais les jours de travail.
 *
 * ## Ce que cet essai garde
 *
 * La déclaration `applique` confrontée au code, dans les deux sens. Un réglage
 * qui se dit appliqué nomme le fichier **et** le symbole par lequel il l'est,
 * et l'essai les retrouve. Un réglage déclaré non appliqué ne doit être nommé
 * par aucun module : le jour où quelqu'un s'en sert, l'essai le dit, et la
 * déclaration doit suivre.
 *
 * L'audit comptait six réglages non appliqués sur huit. Il y en a cinq : les
 * domaines, eux, sont bien appliqués — par `domainesActifs()`, que lisent
 * Quêtes, Tâches et Calendrier.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  controlerReglages,
  reglagesAppliques,
  reglagesDeduits,
} from '../src/lib/noyau/reglages.ts';
import { CHAMPS } from '../src/lib/noyau/profil.ts';

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi: string, condition: boolean) => v(quoi, condition, true);

const fichiers: string[] = [];
const parcourir = (dossier: string) => {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (/\.(ts|svelte|astro|mts)$/.test(entree)) fichiers.push(chemin.replace(/\\/g, '/'));
  }
};
parcourir('src');
const codeDe = (chemin: string) =>
  readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\*.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

/** Le réglage tel qu'il est déclaré, profil vide : la déclaration seule. */
const tous = reglagesDeduits(() => undefined);
const parId = new Map(tous.map((r) => [r.id, r]));

console.log('\n1. HUIT RÉGLAGES, TROIS APPLIQUÉS');

v('aucun problème de déclaration', controlerReglages(CHAMPS.map((c) => c.champ)), []);
v('huit réglages sont déduits', tous.length, 8);
v(
  'et trois seulement sont appliqués',
  reglagesAppliques(() => undefined).map((r) => r.id),
  ['bascule-du-jour', 'fuseau', 'domaines-affiches'],
);
v(
  'les cinq autres sont nommés, pour qu’on ne les rende pas visibles sans le vouloir',
  tous.filter((r) => r.applique === null).map((r) => r.id),
  ['jours-de-repos', 'creneaux', 'parcours-ouverts', 'avis-locaux', 'objectif-hebdomadaire'],
);

console.log('\n2. DÉCLARÉ APPLIQUÉ, DONC APPLIQUÉ');

for (const reglage of tous) {
  if (!reglage.applique) continue;
  for (const module of reglage.applique.modules) {
    vrai(`${reglage.id} : ${module} existe`, fichiers.includes(module));
    vrai(
      `${reglage.id} : ${module} nomme « ${reglage.applique.symbole} »`,
      fichiers.includes(module) && codeDe(module).includes(reglage.applique.symbole),
    );
  }
}

/*
   LE SYMBOLE EST UNE PORTE : ON COMPTE CEUX QUI L'OUVRENT.

   `reglagesJourLogique` ne vaut que par `reglagesJourLogiqueLocaux`, que les
   écrans importent. Un plancher plutôt qu'un compte exact : le nombre d'écrans
   changera, et figer vingt reviendrait à rougir au premier écran retiré. Mais
   zéro ou un voudrait dire que le réglage ne sort plus de son module, et ce
   serait un autre réglage que celui qu'on déclare appliqué.
*/
const compteDesFichiersQuiNomment = (symbole: string) =>
  fichiers.filter((chemin) => codeDe(chemin).includes(symbole)).length;

{
  const n = compteDesFichiersQuiNomment('reglagesJourLogiqueLocaux');
  vrai(`la porte du jour logique est ouverte par ${n} fichiers`, n >= 5);
}
{
  const n = compteDesFichiersQuiNomment('domainesActifs');
  vrai(`celle des domaines par ${n} fichiers`, n >= 3);
}

console.log('\n3. DÉCLARÉ NON APPLIQUÉ, DONC NOMMÉ PAR PERSONNE');

/*
   La ceinture : l'identifiant d'un réglage non appliqué ne doit apparaître
   dans aucun module. Il est construit dans `reglages.ts` et affiché
   généralement, sans que personne le nomme — c'est ce qui rend la déclaration
   vérifiable. Le jour où un écran nommera « jours-de-repos » pour en faire
   quelque chose, cet essai le dira.
*/
const DECLARATION = 'src/lib/noyau/reglages.ts';
for (const reglage of tous) {
  if (reglage.applique) continue;
  const nommeurs = fichiers.filter(
    (chemin) => chemin !== DECLARATION && codeDe(chemin).includes(`'${reglage.id}'`),
  );
  v(`personne ne nomme « ${reglage.id} »`, nommeurs, []);
}

console.log('\n4. LES PHRASES NE PROMETTENT PLUS CE QUI N’EST PAS FAIT');

const causes = tous.map((r) => r.cause);
vrai(
  'plus aucune cause ne parle de série',
  causes.every((c) => !/série/.test(c)),
);
v(
  'et la cause des jours de repos s’arrête à ce qui est vrai',
  reglagesDeduits((champ) => (champ === 'joursTravail' ? ['lundi', 'mardi'] : undefined)).find(
    (r) => r.id === 'jours-de-repos',
  )?.cause,
  'dimanche, mercredi, jeudi, vendredi, samedi — ce sont les jours où vous ne travaillez pas.',
);
/* Et les trois appliqués portent toujours la leur : retirer l'écran des cinq
   autres ne doit pas avoir emporté l'explication de ceux qui restent. */
for (const reglage of reglagesAppliques(() => undefined)) {
  vrai(`${reglage.id} dit toujours d’où il vient`, reglage.cause.trim().length > 15);
}

console.log('\n5. RIEN N’A ÉTÉ SUPPRIMÉ DU CALCUL');

/*
   P4 retire les cinq réglages de l'ÉCRAN, pas du code. C'est la différence
   entre une exigence baissée et une promesse retirée : la déduction reste
   calculée, reste juste, et `essais:adaptation` garde toutes ses assertions.
*/
const avecDesReponses = reglagesDeduits((champ) =>
  champ === 'joursTravail'
    ? ['lundi']
    : champ === 'styleAccompagnement'
      ? 'soutenu'
      : champ === 'concours'
        ? ['insp']
        : champ === 'heuresRevision'
          ? 8
          : undefined,
);
v('les huit sont toujours calculés', avecDesReponses.length, 8);
for (const id of ['jours-de-repos', 'avis-locaux', 'parcours-ouverts', 'objectif-hebdomadaire']) {
  vrai(
    `${id} se dit déduit quand la réponse existe`,
    avecDesReponses.find((r) => r.id === id)?.deduit === true,
  );
}
v(
  'et le plafond de séance est toujours calculé, même invisible',
  (avecDesReponses.find((r) => r.id === 'objectif-hebdomadaire')?.valeur as {
    plafondSeanceMinutes: number;
  }).plafondSeanceMinutes,
  120,
);
v('les identifiants n’ont pas bougé', tous.map((r) => r.id), [
  'bascule-du-jour',
  'fuseau',
  'jours-de-repos',
  'creneaux',
  'domaines-affiches',
  'parcours-ouverts',
  'avis-locaux',
  'objectif-hebdomadaire',
]);
vrai(
  'et chaque réglage nomme encore les champs dont il découle',
  tous.every((r) => r.depuis.length > 0 && r.depuis.every((c) => parId.has(r.id))),
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
