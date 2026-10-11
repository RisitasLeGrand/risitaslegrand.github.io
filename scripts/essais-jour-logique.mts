/**
 * Le jour logique, et surtout les deux jours de l'année où il devient piégeux.
 *
 * Un décalage de jour logique est une erreur **silencieuse** : la série de jours
 * se rompt sans raison visible, une séance compte pour le mauvais jour, une
 * moyenne horaire se trompe de 4 %. Rien ne plante, et personne ne s'en aperçoit
 * avant d'avoir cherché pourquoi un compteur a sauté.
 *
 * D'où le nombre de cas limites ici, et le soin mis aux changements d'heure.
 */
import {
  HEURE_BASCULE_PAR_DEFAUT,
  bornesDuJourLogique,
  debutDuJourLogique,
  decalerJourLogique,
  dureeDuJourLogique,
  ecartJoursLogiques,
  heureLocale,
  jourLogique,
} from '../src/lib/noyau/jour-logique';

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

/** Un instant depuis une heure murale de Paris, en passant par son décalage connu. */
const paris = (iso: string) => new Date(iso);

console.log('\nLA BASCULE À 4 H');

v('le défaut est quatre heures', HEURE_BASCULE_PAR_DEFAUT, 4);

// Heure d'hiver : Paris = UTC+1.
v(
  'minuit trente compte pour la veille',
  jourLogique(paris('2026-01-15T23:30:00Z')), // 00 h 30 le 16 à Paris
  '2026-01-15',
);
v(
  'trois heures cinquante-neuf compte encore pour la veille',
  jourLogique(paris('2026-01-16T02:59:00Z')), // 03 h 59 le 16
  '2026-01-15',
);
v(
  'quatre heures pile ouvre le jour',
  jourLogique(paris('2026-01-16T03:00:00Z')), // 04 h 00 le 16
  '2026-01-16',
);
v(
  'midi est sans surprise',
  jourLogique(paris('2026-01-16T11:00:00Z')),
  '2026-01-16',
);
v(
  'vingt-trois heures aussi',
  jourLogique(paris('2026-01-16T22:00:00Z')),
  '2026-01-16',
);

console.log('\nLES PASSAGES DE MOIS ET D’ANNÉE');

v(
  'le premier du mois à 2 h compte pour le dernier du mois précédent',
  jourLogique(paris('2026-02-01T01:00:00Z')), // 02 h 00 le 1er février
  '2026-01-31',
);
v(
  'le 1er mars à 2 h compte pour le 28 février',
  jourLogique(paris('2026-03-01T01:00:00Z')),
  '2026-02-28',
);
v(
  'et en année bissextile, pour le 29',
  jourLogique(paris('2024-03-01T01:00:00Z')),
  '2024-02-29',
);
v(
  'le 1er janvier à 2 h compte pour la Saint-Sylvestre',
  jourLogique(paris('2026-01-01T01:00:00Z')),
  '2025-12-31',
);

console.log('\nLE PASSAGE À L’HEURE D’ÉTÉ — L’HEURE QUI N’EXISTE PAS');

/*
 * Le 29 mars 2026, Paris passe de 2 h à 3 h : 02 h 30 n'existe pas. La bascule
 * par défaut à 4 h ne tombe pas dans cette fenêtre, et c'est une des raisons de
 * ce défaut.
 */
v(
  'à 01 h 30, avant le saut, on est encore la veille',
  jourLogique(paris('2026-03-29T00:30:00Z')), // 01 h 30 heure d'hiver
  '2026-03-28',
);
v(
  'à 03 h 30, juste après le saut, on est encore la veille',
  jourLogique(paris('2026-03-29T01:30:00Z')), // 03 h 30 heure d'été
  '2026-03-28',
);
v(
  'à 04 h 30, le jour a basculé',
  jourLogique(paris('2026-03-29T02:30:00Z')), // 04 h 30 heure d'été
  '2026-03-29',
);

{
  const debut = debutDuJourLogique('2026-03-29');
  v(
    'le jour du changement commence bien à 4 h murales',
    heureLocale(debut).heure,
    4,
  );
  v('et le 29 mars', heureLocale(debut).jour, 29);
  v(
    'la veille du changement dure 23 heures',
    dureeDuJourLogique('2026-03-28'),
    23,
  );
  v('et le jour même en dure 24', dureeDuJourLogique('2026-03-29'), 24);
}

{
  /*
   * Le cas pathologique : la bascule réglée dans l'heure sautée. Aucun instant
   * n'a 02 h 30 murales ce jour-là. La règle écrite est de prendre l'instant du
   * saut, et non de rendre null — un appelant qui oublierait de traiter null
   * casserait une fois par an, sans message.
   */
  const debut = debutDuJourLogique('2026-03-29', { heureBascule: 2 });
  const l = heureLocale(debut);
  v(
    'une bascule à 2 h le jour du saut prend l’instant du saut',
    `${l.heure}:${String(l.minute).padStart(2, '0')}`,
    '3:00',
  );
  v('et reste le bon jour', l.jour, 29);
}

console.log('\nLE RETOUR À L’HEURE D’HIVER — L’HEURE QUI EXISTE DEUX FOIS');

/*
 * Le 25 octobre 2026, Paris rejoue l'heure de 2 h à 3 h : 02 h 30 arrive deux
 * fois. Là encore, 4 h est hors de la fenêtre.
 */
v(
  'à 02 h 30 heure d’été, on est la veille',
  jourLogique(paris('2026-10-25T00:30:00Z')),
  '2026-10-24',
);
v(
  'à 02 h 30 heure d’hiver — la seconde fois —, toujours la veille',
  jourLogique(paris('2026-10-25T01:30:00Z')),
  '2026-10-24',
);
v(
  'à 04 h 30, le jour a basculé',
  jourLogique(paris('2026-10-25T03:30:00Z')),
  '2026-10-25',
);

{
  v(
    'la veille du retour à l’heure d’hiver dure 25 heures',
    dureeDuJourLogique('2026-10-24'),
    25,
  );
  v('et le jour même en dure 24', dureeDuJourLogique('2026-10-25'), 24);

  // Bascule à 2 h : l'heure existe deux fois, on prend la première.
  const debut = debutDuJourLogique('2026-10-25', { heureBascule: 2 });
  v(
    'une bascule à 2 h prend la première occurrence',
    debut.toISOString(),
    '2026-10-25T00:00:00.000Z',
  );
  /*
   * Et voici pourquoi la première, et pas la seconde. Le premier 02 h 30
   * appartient au jour logique du 25 — son heure murale est au-dessus du seuil.
   * Si le jour commençait à la seconde occurrence, cet instant précéderait le
   * début de son propre jour.
   */
  const premierDesDeux = new Date('2026-10-25T00:30:00Z');
  v(
    'le premier 02 h 30 est bien dans le jour du 25',
    jourLogique(premierDesDeux, { heureBascule: 2 }),
    '2026-10-25',
  );
  v(
    'et il ne précède pas le début de ce jour',
    premierDesDeux >= debut,
    true,
  );
}

console.log('\nLES BORNES NE SE CHEVAUCHENT PAS ET NE LAISSENT PAS DE TROU');

for (const jour of ['2026-01-15', '2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25']) {
  const { fin } = bornesDuJourLogique(jour);
  const { debut: debutSuivant } = bornesDuJourLogique(decalerJourLogique(jour, 1));
  v(
    `${jour} : la fin est exactement le début du lendemain`,
    fin.getTime(),
    debutSuivant.getTime(),
  );
}

{
  /*
   * L'invariant qui résume tout : un instant tiré au hasard appartient au jour
   * logique dont il est dans les bornes, et à un seul. Vérifié sur toute l'année
   * 2026, heure par heure — 8 760 instants, y compris les deux changements.
   */
  let fautes = 0;
  let verifies = 0;
  const depart = Date.UTC(2026, 0, 1);
  for (let h = 0; h < 8760; h += 1) {
    const instant = new Date(depart + h * 3_600_000);
    const jour = jourLogique(instant);
    const { debut, fin } = bornesDuJourLogique(jour);
    if (instant < debut || instant >= fin) fautes += 1;
    verifies += 1;
  }
  v(`chacun des ${verifies} instants de 2026 tombe dans ses bornes`, fautes, 0);
}

{
  /*
   * Le même balayage, mais avec la bascule posée dans l'heure pathologique.
   * C'est le réglage que personne ne choisira, et c'est précisément celui qui
   * révélerait une incohérence si la règle des occurrences était fausse.
   */
  let fautes = 0;
  const depart = Date.UTC(2026, 2, 20);
  for (let h = 0; h < 24 * 230; h += 1) {
    const instant = new Date(depart + h * 3_600_000);
    const jour = jourLogique(instant, { heureBascule: 2 });
    const { debut, fin } = bornesDuJourLogique(jour, { heureBascule: 2 });
    if (instant < debut || instant >= fin) fautes += 1;
  }
  v('et avec une bascule à 2 h, de mars à octobre, toujours aucune faute', fautes, 0);
}

console.log('\nUNE BASCULE À MINUIT REVIENT AU CALENDRIER');

v(
  'à minuit trente, le jour est déjà celui du calendrier',
  jourLogique(paris('2026-01-15T23:30:00Z'), { heureBascule: 0 }),
  '2026-01-16',
);

console.log('\nARITHMÉTIQUE DES JOURS');

v('un jour plus tard', decalerJourLogique('2026-01-31', 1), '2026-02-01');
v('un jour plus tôt', decalerJourLogique('2026-03-01', -1), '2026-02-28');
v('en bissextile', decalerJourLogique('2024-03-01', -1), '2024-02-29');
v('un an plus tard', decalerJourLogique('2026-12-31', 1), '2027-01-01');
v('l’écart compte les jours', ecartJoursLogiques('2026-01-01', '2026-01-15'), 14);
v('et il est signé', ecartJoursLogiques('2026-01-15', '2026-01-01'), -14);
v(
  'un écart à travers un changement d’heure reste juste',
  ecartJoursLogiques('2026-03-28', '2026-03-30'),
  2,
);
v('un écart nul', ecartJoursLogiques('2026-05-05', '2026-05-05'), 0);

console.log('\nUN AUTRE FUSEAU RESTE POSSIBLE');

v(
  'à Nouméa, le même instant tombe un autre jour',
  jourLogique(paris('2026-01-15T20:00:00Z'), { fuseau: 'Pacific/Noumea' }), // 07 h le 16
  '2026-01-16',
);
v(
  'alors qu’à Paris il est encore le 15',
  jourLogique(paris('2026-01-15T20:00:00Z')),
  '2026-01-15',
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
