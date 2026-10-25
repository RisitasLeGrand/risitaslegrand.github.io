/**
 * Le compte à rebours vers les épreuves (décision 3 du prompt 56).
 *
 *   npm run essais:compte-a-rebours
 *
 * ## Ce que cet essai garde, et pourquoi il n'a pas besoin de navigateur
 *
 * Le calcul des jours. C'est la seule chose vraiment délicate de ce point, et
 * elle se trompe de la même façon dans tous les logiciels : en comptant des
 * millisecondes. La nuit du passage à l'heure d'hiver fait vingt-cinq heures,
 * celle du printemps vingt-trois ; une division par 86 400 000 rend alors
 * 2,04 ou 1,96 jour, et « dans 3 jours » devient « dans 2 jours » un dimanche
 * matin, sans que rien ne le signale.
 *
 * Les deux franchissements de 2026-2027 sont donc éprouvés nommément : le
 * 25 octobre 2026 et le 29 mars 2027.
 *
 * Le reste de la décision 3 — « aucun rouge, aucune urgence » — se garde ici
 * aussi, et autrement qu'en relisant : le module ne rend que du texte, et
 * l'essai vérifie qu'aucune phrase ne porte de pression.
 */
import {
  JOURS_AVANT_LES_SEMAINES,
  dateDite,
  echeanceDite,
  echeances,
  joursEntre,
} from '../src/lib/compte-a-rebours.ts';
import { REGLAGES } from '../src/lib/parametres/catalogue.ts';
import { REGLAGES_SESSION_PAR_DEFAUT } from '../src/lib/db.ts';

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

const PARCOURS = [
  { id: 'insp', libelle: 'INSP' },
  { id: 'dgfip-a', libelle: 'DGFiP A' },
  { id: 'dgfip-b', libelle: 'DGFiP B' },
];

console.log('\n1. LES JOURS SE COMPTENT SUR DES QUANTIÈMES');

v('le jour même fait zéro', joursEntre('2026-10-19', '2026-10-19'), 0);
v('le lendemain fait un', joursEntre('2026-10-19', '2026-10-20'), 1);
v('la veille fait moins un', joursEntre('2026-10-19', '2026-10-18'), -1);
v('un mois se traverse', joursEntre('2026-10-19', '2026-11-19'), 31);
v('une année bissextile aussi', joursEntre('2028-02-28', '2028-03-01'), 2);
v('et une année commune compte un jour de moins', joursEntre('2027-02-28', '2027-03-01'), 1);

/* ── Le changement d'heure, les deux sens ───────────────────────────────── */
console.log('\n2. LE CHANGEMENT D’HEURE NE DÉPLACE RIEN');

/* Nuit du 24 au 25 octobre 2026 : vingt-cinq heures en Europe/Paris. */
v('la nuit de vingt-cinq heures fait un jour', joursEntre('2026-10-24', '2026-10-25'), 1);
v('et deux jours autour d’elle en font deux', joursEntre('2026-10-24', '2026-10-26'), 2);
/* Nuit du 28 au 29 mars 2027 : vingt-trois heures. */
v('la nuit de vingt-trois heures fait un jour', joursEntre('2027-03-28', '2027-03-29'), 1);
v('et deux jours autour d’elle en font deux', joursEntre('2027-03-27', '2027-03-29'), 2);
/*
   La mesure qui montre l'écart : un compte en millisecondes sur des minuits
   LOCAUX rendrait 2,04 jour ici, et 1,96 au printemps. L'essai le dit en
   clair pour que personne ne « simplifie » le module plus tard.
*/
{
  /* Les deux minuits locaux encadrent le changement : le 24 octobre est à
     +02:00, le 26 à +01:00. C'est l'heure d'écart qui fait la fausse mesure. */
  const avant = new Date('2026-10-24T00:00:00+02:00').getTime();
  const apres = new Date('2026-10-26T00:00:00+01:00').getTime();
  const brut = (apres - avant) / 86_400_000;
  vrai('le compte naïf, lui, se tromperait : il rend 2,04', Math.abs(brut - 2.0416) < 0.001);
  vrai('et un plancher sur ce compte rendrait toujours 2', Math.floor(brut) === 2);
  /* Au printemps, le même compte passe SOUS la journée : 1,96, et un plancher
     rend alors 1. C'est ce cas-là qui transforme « dans 3 jours » en
     « dans 2 jours » un dimanche matin. */
  const mars27 = new Date('2027-03-27T00:00:00+01:00').getTime();
  const mars29 = new Date('2027-03-29T00:00:00+02:00').getTime();
  const brutPrintemps = (mars29 - mars27) / 86_400_000;
  vrai('au printemps il rend 1,96', Math.abs(brutPrintemps - 1.9583) < 0.001);
  v('et son plancher rendrait un jour de trop peu', Math.floor(brutPrintemps), 1);
  v('le nôtre rend deux, dans les deux sens', [
    joursEntre('2026-10-24', '2026-10-26'),
    joursEntre('2027-03-27', '2027-03-29'),
  ], [2, 2]);
}

console.log('\n3. UNE DATE IMPOSSIBLE EST REFUSÉE, PAS REPORTÉE');

v('le 31 février n’existe pas', joursEntre('2026-10-19', '2026-02-31'), null);
v('le mois 13 non plus', joursEntre('2026-10-19', '2026-13-01'), null);
v('ni une date à l’envers', joursEntre('2026-10-19', '15/03/2027'), null);
v('ni une date avec une heure', joursEntre('2026-10-19', '2027-03-15T09:00'), null);
v('le 29 février 2028 existe, lui', joursEntre('2028-02-29', '2028-03-01'), 1);
v('mais pas le 29 février 2027', joursEntre('2027-02-28', '2027-02-29'), null);

console.log('\n4. L’ÉCHÉANCE SE DIT COMME ON LA DIT');

v('le jour même', echeanceDite(0), 'aujourd’hui');
v('la veille au soir', echeanceDite(1), 'demain');
v('deux jours', echeanceDite(2), 'dans 2 jours');
v('huit semaines pile restent en jours', echeanceDite(JOURS_AVANT_LES_SEMAINES), 'dans 56 jours');
v('un jour de plus passe aux semaines', echeanceDite(57), 'dans 8 semaines');
v('l’exemple du prompt : 147 jours', echeanceDite(147), 'dans 21 semaines');
v('et la semaine s’arrondit au plus proche', echeanceDite(150), 'dans 21 semaines');

v('la date se dit en toutes lettres', dateDite('2027-03-15'), '15 mars 2027');
v('y compris le premier du mois', dateDite('2027-01-01'), '1 janvier 2027');
v('et une date impossible ne se dit pas', dateDite('2027-02-30'), null);

console.log('\n5. LES LIGNES, DEPUIS LE CHAMP TEL QU’IL EST ÉCRIT');

{
  const sortie = echeances('2026-10-19', { insp: '2027-03-15' }, PARCOURS);
  v('une épreuve donne une ligne', sortie.etat, 'lignes');
  if (sortie.etat === 'lignes') {
    v('la phrase est celle du prompt', sortie.lignes[0].texte, 'INSP : 15 mars 2027, dans 21 semaines');
    v('et elle porte son parcours', sortie.lignes[0].parcours, 'insp');
  }
}
{
  const sortie = echeances(
    '2026-10-19',
    { insp: '2027-03-15', 'dgfip-b': '2026-11-02', 'dgfip-a': '2026-10-19' },
    PARCOURS,
  );
  v('trois épreuves donnent trois lignes', sortie.etat === 'lignes' && sortie.lignes.length, 3);
  if (sortie.etat === 'lignes') {
    v(
      'de la plus proche à la plus lointaine',
      sortie.lignes.map((l) => l.parcours),
      ['dgfip-a', 'dgfip-b', 'insp'],
    );
    v('le jour même se dit « aujourd’hui »', sortie.lignes[0].texte, 'DGFiP A : 19 octobre 2026, aujourd’hui');
  }
}
{
  v(
    'une épreuve passée ne figure pas',
    echeances('2026-10-19', { insp: '2026-03-15' }, PARCOURS),
    { etat: 'toutes-passees' },
  );
  v(
    'mais celle du jour, oui',
    echeances('2026-10-19', { insp: '2026-10-19' }, PARCOURS).etat,
    'lignes',
  );
}

console.log('\n6. CE QUI VIENT DU JOURNAL EST TRAITÉ COMME INCONNU');

v('aucun champ : rien à dire', echeances('2026-10-19', undefined, PARCOURS), { etat: 'sans-date' });
v('un objet vide non plus', echeances('2026-10-19', {}, PARCOURS), { etat: 'sans-date' });
v('un tableau est écarté', echeances('2026-10-19', ['2027-03-15'], PARCOURS), { etat: 'sans-date' });
v('un texte aussi', echeances('2026-10-19', '2027-03-15', PARCOURS), { etat: 'sans-date' });
v(
  'un parcours inconnu est écarté : on ne sait pas le nommer',
  echeances('2026-10-19', { 'un-concours-inconnu': '2027-03-15' }, PARCOURS),
  { etat: 'sans-date' },
);
v(
  'une valeur qui n’est pas une date est écartée',
  echeances('2026-10-19', { insp: 42 }, PARCOURS),
  { etat: 'sans-date' },
);
v(
  'une date impossible est écartée, et non affichée en « Invalid Date »',
  echeances('2026-10-19', { insp: '2027-02-30' }, PARCOURS),
  { etat: 'sans-date' },
);
{
  const sortie = echeances('2026-10-19', { insp: '2027-03-15', 'dgfip-b': 'bientôt' }, PARCOURS);
  v('le bon voisine avec le mauvais sans en souffrir', sortie.etat === 'lignes' && sortie.lignes.length, 1);
}

console.log('\n7. AUCUN ROUGE, AUCUNE URGENCE, AUCUN REPROCHE');

{
  const sortie = echeances(
    '2026-10-19',
    { insp: '2026-10-19', 'dgfip-b': '2026-10-20', 'dgfip-a': '2027-03-15' },
    PARCOURS,
  );
  const textes = sortie.etat === 'lignes' ? sortie.lignes.map((l) => l.texte) : [];
  v('trois phrases à juger', textes.length, 3);
  const INTERDITS = [
    'plus que',
    'urgent',
    'reste',
    'vite',
    'attention',
    'retard',
    '!',
    'rouge',
    'danger',
  ];
  for (const mot of INTERDITS) {
    vrai(
      `aucune phrase ne dit « ${mot} »`,
      textes.every((t) => !t.toLowerCase().includes(mot)),
    );
  }
  vrai(
    'et aucune ne porte de classe ni de couleur',
    textes.every((t) => !/class|text-|bg-|#[0-9a-f]{3}/i.test(t)),
  );
}

console.log('\n8. L’INTERRUPTEUR, ET CE QUI SE PASSE SANS LUI');

/*
   Décision 3 : « Oui, sur l'accueil de Révisions », donc allumé par défaut, et
   désactivable depuis Paramètres > Révisions. Le réglage vit dans l'objet
   `reglagesSession`, sous une clé du magasin `etat` : y ajouter un champ ne
   change pas le schéma de la base, et l'interdit 1 du 56 exclut toute
   migration. Une base écrite par une version antérieure rend le défaut.
*/
const reglage = REGLAGES.find((r) => r.id === 'compte-a-rebours');
vrai('le réglage est sur la page centrale', Boolean(reglage));
v('dans la section Révisions', reglage?.section, 'revisions');
v('c’est un interrupteur', reglage?.nature.genre, 'interrupteur');
v('allumé par défaut', reglage?.defaut, true);
v('il vaut sur tous les appareils', reglage?.portee, 'tous');
v('et il dit où il agit', reglage?.ecran, '/revisions/');
v('le défaut du magasin dit la même chose', REGLAGES_SESSION_PAR_DEFAUT.compteARebours, true);
/* Et il ne peut pas devenir indécidable : seul `false` l'éteint. */
v('seul un faux l’éteint', REGLAGES_SESSION_PAR_DEFAUT.compteARebours !== false, true);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
