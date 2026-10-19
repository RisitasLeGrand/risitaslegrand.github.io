/**
 * Les valeurs du profil, dites en français (P7 du prompt 56).
 *
 *   npm run essais:profil-lisible
 *
 * L'écran montrait `insp`, `psyche`, `2027-03-15`, `{"corps":3}`, en police à
 * chasse fixe. Ce sont des formats de stockage. Ce que cet essai garde, c'est
 * qu'ils deviennent du français — et qu'un identifiant inconnu reste tel quel
 * plutôt que d'être remplacé par une invention.
 */
import {
  dateDite,
  heureDite,
  historiqueDit,
  nombreDit,
  valeurDite,
} from '../src/lib/profil-lisible.ts';
import { CHAMPS, champDeclare } from '../src/lib/noyau/profil.ts';
import { BORNES } from '../src/lib/noyau/initialisation.ts';

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

const LIBELLES = {
  parcours: [
    { id: 'insp', libelle: 'INSP' },
    { id: 'dgfip-a', libelle: 'DGFiP A' },
  ],
  domaines: [
    { id: 'corps', libelle: 'Corps' },
    { id: 'psyche', libelle: 'Psyché' },
    { id: 'cognition', libelle: 'Cognition' },
  ],
};

console.log('\n1. LES HEURES');

v('l’heure ronde ne porte pas ses minutes', heureDite('07:00'), '7 h');
v('la demie, oui', heureDite('06:30'), '6 h 30');
v('le zéro de tête disparaît', heureDite('09:15'), '9 h 15');
v('minuit se dit zéro heure', heureDite('00:00'), '0 h');
v('vingt-trois heures aussi', heureDite('23:45'), '23 h 45');
v('et ce qui n’est pas une heure n’en devient pas une', heureDite('25:00'), null);
v('ni « bientôt »', heureDite('bientôt'), null);

console.log('\n2. LES DATES');

v('une date se dit en toutes lettres', dateDite('2027-03-15'), '15 mars 2027');
v('le premier du mois ne prend pas d’ordinal', dateDite('2027-01-01'), '1 janvier 2027');
v('un 29 février existant', dateDite('2028-02-29'), '29 février 2028');
v('un 29 février inexistant est refusé', dateDite('2027-02-29'), null);
v('et le 31 février ne devient pas le 3 mars', dateDite('2027-02-31'), null);

console.log('\n3. LES NOMBRES ET LEURS UNITÉS');

v('les heures par semaine', nombreDit('tempsParSemaine', 10), '10 h par semaine');
v('les heures de révision aussi', nombreDit('heuresRevision', 8), '8 h par semaine');
/* « h » ne s'accorde pas ; « séance » s'accorde. */
v('une séance reste au singulier', nombreDit('frequenceSouhaitee', 1), '1 séance par semaine');
v('trois séances prennent leur s', nombreDit('frequenceSouhaitee', 3), '3 séances par semaine');
/* Une année ne se groupe pas : « 1990 », et non « 1 990 ». Intl groupe par
   défaut, ce qui est juste pour une quantité et faux pour une année. */
v('une année ne prend pas de séparateur de milliers', nombreDit('naissanceAnnee', 1990), '1990');
/* La quantité, elle, se groupe — et avec l'insécable fine du français, non
   avec une espace ordinaire qui se couperait en bout de ligne. */
v(
  'une grande quantité se groupe, à l’insécable fine',
  nombreDit('tempsParSemaine', 1200),
  '1\u202f200 h par semaine',
);
v('les heures d’un domaine portent leur unité', nombreDit('tempsParDomaine', 3), '3 h');

console.log('\n4. LES LISTES');

v(
  'les domaines prennent leurs libellés',
  valeurDite('domainesActifs', ['corps', 'psyche'], LIBELLES),
  'Corps, Psyché',
);
v('les parcours aussi', valeurDite('concours', ['insp'], LIBELLES), 'INSP');
v(
  'un identifiant inconnu reste tel quel, et n’est pas inventé',
  valeurDite('domainesActifs', ['corps', 'un-domaine-retire'], LIBELLES),
  'Corps, un-domaine-retire',
);
v(
  'une liste sans table de libellés reste telle quelle',
  valeurDite('matieresFortes', ['Droit public', 'Économie'], LIBELLES),
  'Droit public, Économie',
);
v('une liste vide se dit par un tiret', valeurDite('domainesActifs', [], LIBELLES), '—');

console.log('\n5. LES RÉPARTITIONS');

v(
  'les dates d’épreuves nomment le parcours et la date',
  valeurDite('datesEpreuves', { insp: '2027-03-15' }, LIBELLES),
  'INSP : 15 mars 2027',
);
v(
  'deux parcours sont séparés lisiblement',
  valeurDite('datesEpreuves', { insp: '2027-03-15', 'dgfip-a': '2027-05-02' }, LIBELLES),
  'INSP : 15 mars 2027 · DGFiP A : 2 mai 2027',
);
v(
  'le temps par domaine porte son unité',
  valeurDite('tempsParDomaine', { corps: 3, cognition: 5 }, LIBELLES),
  'Corps : 3 h · Cognition : 5 h',
);
v(
  'une valeur d’une forme inconnue n’est pas devinée',
  valeurDite('tempsParDomaine', { corps: null }, LIBELLES),
  'Corps : —',
);
v('une répartition vide se dit par un tiret', valeurDite('tempsParDomaine', {}, LIBELLES), '—');

console.log('\n6. LE RESTE, ET CE QUI N’EST PAS LÀ');

v('un oui', valeurDite('majeurDeclare', true, LIBELLES), 'oui');
v('un non', valeurDite('suiviFinances', false, LIBELLES), 'non');
v('une heure, reconnue dans un texte', valeurDite('lever', '06:30', LIBELLES), '6 h 30');
v('une date, reconnue dans un texte', valeurDite('datesEpreuves', '2027-03-15', LIBELLES), '15 mars 2027');
v('un texte libre reste intact', valeurDite('activite', 'en reconversion', LIBELLES), 'en reconversion');
v('rien du tout se dit par un tiret', valeurDite('prenom', undefined, LIBELLES), '—');
v('et null aussi', valeurDite('prenom', null, LIBELLES), '—');
v('une chaîne vide également', valeurDite('prenom', '   ', LIBELLES), '—');
/* Jamais « [object Object] » ni « NaN » : les deux fautes classiques. */
vrai(
  'aucune sortie ne laisse passer un objet brut',
  !valeurDite('tempsParDomaine', { corps: {} }, LIBELLES).includes('object'),
);
v('un nombre impossible ne s’affiche pas', valeurDite('tempsParSemaine', Number.NaN, LIBELLES), '—');

console.log('\n7. L’HISTORIQUE, EN UNE PHRASE');

v(
  'une déclaration jamais modifiée',
  historiqueDit({ source: 'declare', version: 1, appareil: 'R7APGVC6' }),
  'déclaré, dernier appareil : R7APGVC6',
);
v(
  'une déclaration modifiée trois fois',
  historiqueDit({ source: 'declare', version: 4, appareil: 'R7APGVC6' }),
  'déclaré, modifié 3 fois, dernier appareil : R7APGVC6',
);
v(
  'l’appareil où l’on se trouve se dit « celui-ci »',
  historiqueDit({ source: 'confirme', version: 2, appareil: 'R7APGVC6', appareilCourant: 'R7APGVC6' }),
  'observé, puis confirmé, modifié 1 fois, dernier appareil : celui-ci',
);
v(
  'et un autre appareil garde son nom',
  historiqueDit({ source: 'observe', version: 1, appareil: 'ABCD1234', appareilCourant: 'R7APGVC6' }),
  'observé, non confirmé, dernier appareil : ABCD1234',
);

console.log('\n8. LES DEUX UNITÉS NE SE CONTREDISENT PAS');

/*
   Deux déclarations, deux rôles : `BORNES.unite` est l'unité du curseur
   — « 10 h » sous le pouce —, et `unite` au catalogue est celle de la phrase
   — « 10 h par semaine ». Elles ne peuvent pas être fondues sans décider que
   la phrase et le curseur disent la même chose, ce qui est faux. Elles peuvent
   en revanche diverger en silence, et c'est ce que cet essai empêche.
*/
for (const [champ, bornes] of Object.entries(BORNES)) {
  const unite = champDeclare(champ)?.unite;
  vrai(`« ${champ} » porte une unité de phrase`, Boolean(unite));
  vrai(
    `et elle commence par celle du curseur (« ${bornes.unite} »)`,
    (unite?.un ?? '').startsWith(bornes.unite),
  );
}

/*
   Et ce que le module attend du catalogue, le catalogue le porte : sans
   `clefs`, un identifiant de domaine s'afficherait brut, et l'essai des
   listes ne le verrait pas — il passe ses propres libellés.
*/
v(
  'les champs dont les clés nomment un parcours',
  CHAMPS.filter((c) => c.clefs === 'parcours').map((c) => c.champ),
  ['concours', 'datesEpreuves'],
);
v(
  'et ceux dont les clés nomment un domaine',
  CHAMPS.filter((c) => c.clefs === 'domaines').map((c) => c.champ),
  ['domainesActifs', 'tempsParDomaine', 'ciblesEquilibre'],
);
v(
  'les deux champs qui ne se groupent pas sont les deux champs de naissance',
  CHAMPS.filter((c) => c.sansGroupement).length,
  2,
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
