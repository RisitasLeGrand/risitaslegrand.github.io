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
  MINUTES_PAR_QUESTION,
  caseDeLOption,
  dureeEnClair,
  optionDeLaCase,
  secondesDuFormat,
  PROPOSITIONS_PAR_ZONE,
  ZONES_DU_FORMULAIRE,
  cocher,
  cocherAnn,
  estPosableSurUneCopie,
  issueDeLaZone,
  ligneRetenue,
  lireLaZone,
  raisonDuRetrait,
  zoneEstVide,
  zoneVide,
  type MotifDeLecture,
  type Zone,
} from '../src/lib/qcm-copie';
import {
  compositionAdaptee,
  compositionDeLaCopie,
  repartir,
  rubriquesEnManque,
} from '../src/lib/qcm-composition';
import type { RubriqueDgfip } from '../src/lib/contenu';

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

  /*
     TROIS MOTIFS, ET NON DEUX. Porter PLUS de propositions qu'une zone n'en
     tient est le format des sujets d'avant 2023-2024 — 198 questions de la
     banque réelle sont dans ce cas, et ce sont des annales fidèles. En porter
     MOINS serait une question incomplète, qui relève de la rédaction. Le
     motif unique « propositions » confondait les deux, et l'écran disait
     « n'ont pas quatre propositions », ce qui se lit comme un défaut à
     corriger dans la banque.
  */
  v('l’ancien format est nommé pour ce qu’il est', raisonDuRetrait(q(5, [2])), 'trop-de-propositions');
  v('six propositions aussi', raisonDuRetrait(q(6, [2])), 'trop-de-propositions');
  v('une question incomplète est un autre cas', raisonDuRetrait(q(3, [1])), 'pas-assez-de-propositions');
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


/* ══════════════════════════════════════════════════════════════════════════
   6 bis. D'où vient la réponse retenue
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLA LIGNE RETENUE');

v('la 1ʳᵉ ligne quand la 2ᵉ est vide', ligneRetenue(zone({ cases: [1] })), 'premiere');
v('la 2ᵉ dès qu’elle est servie', ligneRetenue(zone({ cases: [1] }, { cases: [2] })), 'seconde');
v('même servie du seul « Ann »', ligneRetenue(zone({ cases: [1] }, { ann: true })), 'seconde');
v('la 1ʳᵉ sur une zone vide', ligneRetenue(zone({})), 'premiere');
{
  /*
     L'invariant qui compte : la ligne retenue et le motif ne peuvent pas se
     contredire. Si le motif dit « 2ᵉ ligne », la ligne retenue doit être la
     seconde, et réciproquement — sinon l'écran de fin montrerait les cases
     d'une ligne en annonçant l'autre.
  */
  const cas: Zone[] = [
    zone({ cases: [1] }),
    zone({ cases: [1] }, { cases: [2] }),
    zone({ ann: true }),
    zone({ cases: [1] }, { ann: true }),
    zone({ cases: [0, 2] }),
    zone({ cases: [1] }, { cases: [0, 3] }),
    zone({}),
  ];
  v(
    'le motif et la ligne retenue concordent toujours',
    cas.filter((z) => {
      const motif = lireLaZone(z).motif;
      const ligne = ligneRetenue(z);
      if (motif === 'premiere-ligne') return ligne !== 'premiere';
      if (motif === 'seconde-ligne') return ligne !== 'seconde';
      return false;
    }).length,
    0,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   7. Du numéro de case à l'indice d'option
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLES CASES ET LES OPTIONS');

{
  /*
     Les propositions sont mélangées à l'affichage. La case 1 ne désigne donc
     pas l'option 0, et confondre les deux fausserait la note sans rien
     casser de visible.
  */
  const ordre = [2, 0, 3, 1];
  v('la case 1 porte l’option 2', optionDeLaCase(ordre, 1), 2);
  v('la case 4 porte l’option 1', optionDeLaCase(ordre, 4), 1);
  v('et la case 5 n’existe pas', optionDeLaCase(ordre, 5), undefined);
  v('l’option 2 est imprimée sur la case 1', caseDeLOption(ordre, 2), 1);
  v('l’option 1 sur la case 4', caseDeLOption(ordre, 1), 4);
  v('une option absente ne donne aucune case', caseDeLOption(ordre, 9), 0);

  /* Aller-retour sur les quatre cases : c'est l'invariant qui compte. */
  v(
    'l’aller-retour est fidèle sur les quatre cases',
    [1, 2, 3, 4].filter((n) => caseDeLOption(ordre, optionDeLaCase(ordre, n)!) !== n),
    [],
  );
  /* Et sur un ordre non mélangé, la case n porte l'option n − 1. */
  const direct = [0, 1, 2, 3];
  v(
    'sans mélange, la case n porte l’option n − 1',
    [1, 2, 3, 4].map((n) => optionDeLaCase(direct, n)),
    [0, 1, 2, 3],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   8. La durée du compte à rebours
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLA DURÉE DU COMPTE À REBOURS');

{
  /*
     Aucun arrêté ne donne la durée du QCM seul : les deux heures de
     l'épreuve du contrôleur couvrent le QCM ET les QRC. On applique la règle
     du guide ENFiP — deux minutes par question au plus — plutôt que sa somme,
     ce qui donne une durée cohérente quel que soit le format.
  */
  v('deux minutes par question', MINUTES_PAR_QUESTION, 2);
  v('45 questions font une heure et demie', secondesDuFormat({ total: 45 }), 5400);
  v('30 questions font une heure', secondesDuFormat({ total: 30 }), 3600);
  /* Le repère du guide lui-même : 40 questions, 1 h 20. */
  v('et les 40 questions du guide font bien 1 h 20', dureeEnClair(secondesDuFormat({ total: 40 })), '1 h 20');

  v('une durée sous l’heure se dit en minutes', dureeEnClair(secondesDuFormat({ total: 12 })), '24 min');
  v('une heure juste se dit sans minutes', dureeEnClair(3600), '1 h');
  v('et les minutes se complètent à deux chiffres', dureeEnClair(3900), '1 h 05');
  v('54 questions font 1 h 48', dureeEnClair(secondesDuFormat({ total: 54 })), '1 h 48');
}


/* ══════════════════════════════════════════════════════════════════════════
   9. La composition : ce que la copie servira vraiment
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nLA COMPOSITION ANNONCÉE');

{
  /* Les quotas du sujet 2026, catégorie A. */
  const CAT_A = {
    total: 45,
    repartition: {
      'Environnement administratif et financier': 10,
      'Union européenne': 10,
      'Culture numérique': 10,
      Logique: 10,
      Anglais: 5,
    },
  };

  /** Une banque où chaque rubrique a le stock qu'on lui donne. */
  const banque = (stocks: Record<string, number>): RubriqueDgfip[] =>
    Object.entries(stocks).map(([nom, total], i) => ({
      id: `r${i}`,
      nom,
      ordre: i + 1,
      total,
    }));

  const ABONDANTE = banque({
    'Environnement administratif et financier': 40,
    'Union européenne': 40,
    'Culture numérique': 40,
    Logique: 40,
    Anglais: 40,
  });

  {
    /* STRUCTURE CONFORME : rien ne doit s'afficher. */
    const lignes = compositionDeLaCopie(ABONDANTE, CAT_A);
    v(
      'chaque rubrique sert ce que le sujet prévoit',
      lignes.map((l) => `${l.rubrique}:${l.servies}/${l.prevu}`),
      [
        'Environnement administratif et financier:10/10',
        'Union européenne:10/10',
        'Culture numérique:10/10',
        'Logique:10/10',
        'Anglais:5/5',
      ],
    );
    v('aucune rubrique en manque', rubriquesEnManque(lignes), []);
    faux('la composition n’est pas adaptée', compositionAdaptee(lignes));
    v(
      'et le total fait bien quarante-cinq',
      lignes.reduce((n, l) => n + l.servies, 0),
      45,
    );
  }

  {
    /*
       UNE RUBRIQUE SOUS SON QUOTA — le cas que le pilote demande d'éprouver.
       L'anglais n'a que trois questions conformes à la copie, là où le sujet
       en prévoit cinq.
    */
    const COURTE = banque({
      'Environnement administratif et financier': 40,
      'Union européenne': 40,
      'Culture numérique': 40,
      Logique: 40,
      Anglais: 3,
    });
    const lignes = compositionDeLaCopie(COURTE, CAT_A);
    vrai('la composition est adaptée', compositionAdaptee(lignes));
    v(
      'et c’est l’anglais qui manque, de deux',
      rubriquesEnManque(lignes).map((l) => `${l.rubrique} ${l.servies}/${l.prevu}`),
      ['Anglais 3/5'],
    );
    /*
       LA LONGUEUR EST PRÉSERVÉE : c'est le report de `repartir`, et c'est ce
       qui rend l'annonce nécessaire. Une épreuve qui garde ses quarante-cinq
       questions sans le dire laisse croire à une structure qu'elle n'a plus.
    */
    v(
      'la longueur de l’épreuve est préservée',
      lignes.reduce((n, l) => n + l.servies, 0),
      45,
    );
    vrai(
      'les deux manquantes sont prises sur les autres rubriques du format',
      lignes.filter((l) => l.servies > l.prevu).length > 0,
    );
  }

  {
    /* Une rubrique vide se dit aussi, et la longueur tient encore. */
    const SANS_ANGLAIS = banque({
      'Environnement administratif et financier': 40,
      'Union européenne': 40,
      'Culture numérique': 40,
      Logique: 40,
      Anglais: 0,
    });
    const lignes = compositionDeLaCopie(SANS_ANGLAIS, CAT_A);
    v(
      'une rubrique vide est annoncée',
      rubriquesEnManque(lignes).map((l) => `${l.rubrique} ${l.servies}/${l.prevu}`),
      ['Anglais 0/5'],
    );
    v('et la longueur tient', lignes.reduce((n, l) => n + l.servies, 0), 45);
  }

  {
    /*
       Un format SANS quota ne promet aucune structure : il n'y a rien à
       démentir, et afficher une composition serait du bruit.
    */
    v('un format sans quota n’annonce rien', compositionDeLaCopie(ABONDANTE, { total: 27 }), []);
  }

  {
    /*
       Le stock total ne suffit pas à juger : c'est tout le point de la
       réserve envoyée au pilote. Ici 123 questions conformes au total, bien
       plus que les 45 demandées, et la composition dérive quand même.
    */
    const DESEQUILIBREE = banque({
      'Environnement administratif et financier': 40,
      'Union européenne': 40,
      'Culture numérique': 40,
      Logique: 2,
      Anglais: 1,
    });
    const stock = DESEQUILIBREE.reduce((n, r) => n + r.total, 0);
    vrai('le stock total dépasse largement le format', stock > 45);
    vrai('et la composition dérive pourtant', compositionAdaptee(compositionDeLaCopie(DESEQUILIBREE, CAT_A)));
  }

  {
    /* La répartition sans quota reste celle d'avant le déménagement. */
    const quatre = banque({ a: 40, b: 40, c: 40, d: 40 });
    const quota = repartir(quatre, 54);
    v(
      'sans quota, 54 questions se répartissent en 14/14/13/13',
      [...quota.values()].sort((x, y) => y - x),
      [14, 14, 13, 13],
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
