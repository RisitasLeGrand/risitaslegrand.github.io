/**
 * La feuille de réponse : chaque ligne du tableau C2, et rien de deviné.
 *
 *   npm run essais:copie-concours
 *
 * ## Pourquoi un essai par ligne du tableau
 *
 * La règle de lecture de la copie est un tableau de sept lignes, et c'est le
 * genre de règle dont une implémentation juste à six lignes sur sept passe
 * inaperçue : les six cas courants marchent, le septième coûte un demi-point
 * à quelqu'un, un jour, sans trace. Chaque ligne a donc son essai, nommée
 * comme dans le prompt.
 *
 * ## Les deux situations que le tableau ne tranchait pas
 *
 * Elles ont leur essai aussi, et leur raison est écrite dans
 * `src/lib/qcm-copie.ts`. Les éprouver, c'est empêcher qu'un futur passage
 * les « corrige » dans l'autre sens sans s'apercevoir qu'il tranche une
 * question qui a été tranchée.
 *
 * Tout est pur : ni aperçu, ni mot de passe, ni banque.
 */
import {
  LIBELLE_DU_MOTIF,
  PROPOSITIONS_PAR_ZONE,
  ZONES_DU_FORMULAIRE,
  cocher,
  cocherAnn,
  estPosableSurUneCopie,
  issueDeLaZone,
  lireLaZone,
  raisonDuRetrait,
  zoneEstVide,
  zoneVide,
  type MotifDeLecture,
  type Zone,
} from '../src/lib/qcm-copie';

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

/** Une zone décrite en deux temps : ce qu'on coche sur chaque ligne. */
const zone = (
  premiere: { cases?: number[]; ann?: boolean },
  seconde: { cases?: number[]; ann?: boolean } = {},
): Zone => {
  let z = zoneVide();
  for (const c of premiere.cases ?? []) z = cocher(z, 'premiere', c);
  if (premiere.ann) z = cocherAnn(z, 'premiere');
  for (const c of seconde.cases ?? []) z = cocher(z, 'seconde', c);
  if (seconde.ann) z = cocherAnn(z, 'seconde');
  return z;
};

const lecture = (z: Zone): [number | null, MotifDeLecture] => {
  const l = lireLaZone(z);
  return [l.retenue, l.motif];
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Le tableau C2, ligne par ligne
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLE TABLEAU DE LECTURE, LIGNE PAR LIGNE');

v('une case / vide → cette case', lecture(zone({ cases: [2] })), [2, 'premiere-ligne']);

v(
  'une case / une case → la 2ᵉ ligne (directive 6)',
  lecture(zone({ cases: [2] }, { cases: [0] })),
  [0, 'seconde-ligne'],
);

v(
  '« Ann » cochée seule / vide → abstention',
  lecture(zone({ ann: true })),
  [null, 'annulee'],
);
v(
  '« Ann » cochée avec une case / vide → abstention',
  lecture(zone({ cases: [1], ann: true })),
  [null, 'annulee'],
);

v(
  'une case / « Ann » → abstention',
  lecture(zone({ cases: [3] }, { ann: true })),
  [null, 'annulee'],
);
v(
  '« Ann » / « Ann » → abstention',
  lecture(zone({ ann: true }, { ann: true })),
  [null, 'annulee'],
);

v(
  'quelconque / plusieurs cases → réponse inexacte (directive 4)',
  lecture(zone({ cases: [1] }, { cases: [0, 2] })),
  [null, 'reponse-multiple'],
);
v(
  'vide / plusieurs cases → réponse inexacte',
  lecture(zone({}, { cases: [0, 1, 2, 3] })),
  [null, 'reponse-multiple'],
);

v(
  'plusieurs cases / vide → réponse inexacte',
  lecture(zone({ cases: [0, 3] })),
  [null, 'reponse-multiple'],
);

v('vide / vide → abstention', lecture(zone({})), [null, 'sans-reponse']);

/* ══════════════════════════════════════════════════════════════════════════
   2. Les deux situations hors tableau, tranchées et dites
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLES DEUX SITUATIONS QUE LE TABLEAU NE NOMMAIT PAS');

/*
   « Ann » avec plusieurs cases : l'annulation l'emporte. La directive 7 fait
   de « Ann » un geste d'annulation, et le tableau a déjà tranché « Ann + une
   case » en faveur de l'abstention.
*/
v(
  '« Ann » avec plusieurs cases → abstention, et non réponse inexacte',
  lecture(zone({ cases: [0, 2], ann: true })),
  [null, 'annulee'],
);
v(
  'de même sur la 2ᵉ ligne',
  lecture(zone({ cases: [1] }, { cases: [0, 3], ann: true })),
  [null, 'annulee'],
);

/*
   Première ligne vide, seconde servie d'une seule case : la seconde a le
   dernier mot, comme dès qu'elle est servie.
*/
v(
  'vide / une case → la 2ᵉ ligne',
  lecture(zone({}, { cases: [2] })),
  [2, 'seconde-ligne'],
);

/* ══════════════════════════════════════════════════════════════════════════
   3. On ne rature pas : une case cochée ne se décoche pas
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nON NE RATURE PAS');

{
  let z = zoneVide();
  vrai('une zone neuve est vide', zoneEstVide(z));
  z = cocher(z, 'premiere', 1);
  faux('cochée, elle ne l’est plus', zoneEstVide(z));

  /* Cocher deux fois la même case est sans effet, comme un second passage de stylo. */
  const encore = cocher(z, 'premiere', 1);
  v('cocher deux fois la même case ne change rien', encore.premiere.cases, [1]);
  vrai('et rend la même zone, sans copie inutile', encore === z);

  /* Il n'existe aucun chemin pour retirer une case : seulement pour en ajouter. */
  const deux = cocher(z, 'premiere', 3);
  v('cocher une autre case les garde toutes deux', deux.premiere.cases, [1, 3]);
  v('et la lecture y voit une réponse multiple', lecture(deux), [null, 'reponse-multiple']);

  const avecAnn = cocherAnn(deux, 'premiere');
  vrai('« Ann » est le seul recours', avecAnn.premiere.ann);
  vrai('et cocher « Ann » deux fois ne change rien', cocherAnn(avecAnn, 'premiere') === avecAnn);

  /* Les cases restent triées : la feuille se lit de gauche à droite. */
  let desordre = zoneVide();
  for (const c of [3, 0, 2]) desordre = cocher(desordre, 'seconde', c);
  v('les cases cochées restent dans l’ordre de la feuille', desordre.seconde.cases, [0, 2, 3]);

  /* Les deux lignes sont indépendantes. */
  const surLaSeconde = cocher(zoneVide(), 'seconde', 0);
  v('cocher la 2ᵉ ligne ne touche pas la 1ʳᵉ', surLaSeconde.premiere, { cases: [], ann: false });
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Le barème : ce que vaut chaque lecture
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLE BARÈME DU CONCOURS');

{
  const BONNES = [2];
  const issue = (z: Zone) => issueDeLaZone(lireLaZone(z), BONNES);

  v('la bonne case vaut une bonne réponse', issue(zone({ cases: [2] })), 'bonne');
  v('une autre case vaut une erreur', issue(zone({ cases: [0] })), 'mauvaise');
  v('rien coché vaut une abstention', issue(zone({})), 'abstention');
  v('« Ann » vaut une abstention', issue(zone({ ann: true })), 'abstention');
  v(
    'la bonne case annulée vaut quand même une abstention',
    issue(zone({ cases: [2], ann: true })),
    'abstention',
  );
  v(
    'la 2ᵉ ligne corrige une 1ʳᵉ fausse',
    issue(zone({ cases: [0] }, { cases: [2] })),
    'bonne',
  );
  v(
    'et peut aussi gâcher une 1ʳᵉ juste',
    issue(zone({ cases: [2] }, { cases: [1] })),
    'mauvaise',
  );

  /*
     LE POINT QUI COMPTE : une réponse multiple est une ERREUR, pas une
     abstention. Les confondre rendrait le remplissage au hasard gratuit —
     cocher les quatre cases garantirait d'inclure la bonne —, ce que le
     barème existe précisément pour empêcher.
  */
  v(
    'cocher la bonne case et une autre vaut une erreur',
    issue(zone({ cases: [1, 2] })),
    'mauvaise',
  );
  v(
    'cocher les quatre cases vaut une erreur, et non un point',
    issue(zone({ cases: [0, 1, 2, 3] })),
    'mauvaise',
  );

  /*
     Une question dont la clef porte deux bonnes réponses ne peut pas être
     réussie sur une copie. C'est pourquoi le format ne la pose pas — mais si
     elle arrivait là, elle ne doit surtout pas compter juste par hasard.
     « bonnes.length === 1 » dans « issueDeLaZone » tient cette porte.
  */
  v(
    'une question à deux bonnes réponses ne se réussit pas sur une copie',
    issueDeLaZone(lireLaZone(zone({ cases: [1] })), [1, 3]),
    'mauvaise',
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Les questions qu'une copie peut porter
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nCE QU’UNE ZONE PEUT PORTER');

{
  const q = (options: number, bonnes: number[]) => ({
    options: Array.from({ length: options }, (_, i) => `option ${i}`),
    bonnes,
  });

  v('quatre propositions par zone', PROPOSITIONS_PAR_ZONE, 4);
  v('soixante zones au formulaire', ZONES_DU_FORMULAIRE, 60);

  vrai('quatre propositions, une réponse : posable', estPosableSurUneCopie(q(4, [2])));
  faux('cinq propositions : non posable', estPosableSurUneCopie(q(5, [2])));
  faux('trois propositions : non posable', estPosableSurUneCopie(q(3, [1])));
  faux('deux bonnes réponses : non posable', estPosableSurUneCopie(q(4, [1, 3])));
  faux('aucune bonne réponse : non posable', estPosableSurUneCopie(q(4, [])));

  v('et la raison est dite', raisonDuRetrait(q(5, [2])), 'propositions');
  v('pour chaque cas', raisonDuRetrait(q(4, [1, 3])), 'reponses-multiples');
  v('et rien quand la question convient', raisonDuRetrait(q(4, [0])), null);
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Ce que l'écran de fin écrit en marge
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLES LIBELLÉS DE MOTIF');

{
  const motifs: MotifDeLecture[] = [
    'premiere-ligne',
    'seconde-ligne',
    'annulee',
    'reponse-multiple',
    'sans-reponse',
  ];
  v(
    'chaque motif a son libellé',
    motifs.filter((m) => !LIBELLE_DU_MOTIF[m]),
    [],
  );
  /* Les trois que le prompt nomme mot pour mot. */
  v('« 2ᵉ ligne »', LIBELLE_DU_MOTIF['seconde-ligne'], '2ᵉ ligne');
  v('« Annulée »', LIBELLE_DU_MOTIF.annulee, 'Annulée');
  v('« Réponse multiple »', LIBELLE_DU_MOTIF['reponse-multiple'], 'Réponse multiple');
  /* Section G : pas de « (s) », pas de jargon. */
  v(
    'aucun libellé ne porte « (s) »',
    Object.values(LIBELLE_DU_MOTIF).filter((t) => /\(s\)/.test(t)),
    [],
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
