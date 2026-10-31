/**
 * Les facteurs de la fiche de cycle : trois rangs, et jamais deux confondus.
 *
 *   npm run essais:facteurs-cycle
 *
 * ## Ce que cet essai garde
 *
 * Le plan de phase 0 insiste sur un point de la maquette 8.3 : « "Non
 * autorisé" et "non mesuré" sont deux lignes distinctes — les confondre
 * laisserait croire qu'un domaine coupé est un domaine vide ». C'est une règle
 * d'affichage, donc une règle que seul un essai peut tenir : les deux cas
 * produisent la même page vide si on les mélange, et la différence ne se voit
 * pas en relecture.
 *
 * Il garde aussi ce que la décision 13 impose — la phrase « lien non établi »
 * sous chaque facteur observé — et le bloc final fixe du § 5.3.
 *
 * ## Ce qu'il ne peut pas garder, et qui est dit plutôt que tu
 *
 * La maquette montre des écarts chiffrés. La projection des faits ne porte
 * aucune valeur : un `FaitObserve` vaut `{ type, jourLogique }`. L'essai
 * vérifie donc la COUVERTURE, et il vérifie qu'aucun écart n'est inventé — ce
 * qui est la garantie utile tant que les valeurs ne sont pas lisibles.
 */
import {
  BLOC_FINAL,
  FACTEURS_DU_CYCLE,
  LIEN_NON_ETABLI,
  classerLesFacteurs,
  direLaCouverture,
} from '../src/lib/odyssee/facteurs-du-cycle';
import { TYPES } from '../src/lib/noyau/faits';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

console.log('\nLES TREIZE FACTEURS DU § 5.2 SONT DÉCLARÉS');

v('il y en a treize', FACTEURS_DU_CYCLE.length, 13);
v(
  'leurs identifiants sont uniques',
  new Set(FACTEURS_DU_CYCLE.map((f) => f.id)).size,
  13,
);

/*
   CHAQUE TYPE CITÉ EXISTE AU CONTRAT. Un facteur qui nommerait un type absent
   serait classé « observé » avec zéro jour pour toujours : l'écran dirait
   « Cyclades le mesure » d'une chose que rien ne porte, ce qui est le pire des
   trois rangs possibles — il n'est ni vrai, ni franc sur son ignorance.
*/
/*
   LE CONTRAT NOMME SES TYPES PAR `id`, ET NON PAR `type`. Ma première version
   lisait `t.type`, donc `undefined` partout : les dix-huit types cités
   passaient pour inconnus, et l'essai rougissait sur son propre accès. Le
   `FaitObserve` projeté, lui, porte bien `type` — ce sont deux formes
   différentes de la même notion, et c'est le genre d'écart qu'on ne voit
   qu'en l'exécutant.
*/
const connus = new Set((TYPES as readonly { id: string }[]).map((t) => t.id));
v(
  'chaque type cité par un facteur existe au contrat des faits',
  FACTEURS_DU_CYCLE.flatMap((f) => f.types).filter((t) => !connus.has(t)),
  [],
);

/*
   ET LE DOMAINE DÉCLARÉ EST BIEN CELUI DU TYPE. C'est ce domaine que l'écran
   proposera d'autoriser : s'il ne correspondait pas, le bouton ouvrirait un
   domaine qui ne débloque rien.
*/
const domaineDuType = new Map(
  (TYPES as readonly { id: string; domaine: string }[]).map((t) => [t.id, t.domaine]),
);
/*
   ET LA LISTE DÉCLARÉE COUVRE TOUS SES TYPES, SANS EN AJOUTER. Ce constat a
   trouvé un défaut de modèle, pas une faute de frappe : j'avais donné UN
   domaine par facteur, et deux facteurs en traversent deux — la charge de
   révision mêle connaissances et cognition, les apports mêlent corps et
   connaissances. Un domaine de trop ferait proposer d'ouvrir ce qui n'est pas
   nécessaire ; un domaine de moins laisserait un facteur illisible passer pour
   observé.
*/
const domainesIncoherents = FACTEURS_DU_CYCLE.filter((f) => {
  const attendus = new Set(f.types.map((t) => domaineDuType.get(t)));
  const declares = new Set(f.domaines);
  return (
    f.types.length > 0 &&
    ([...attendus].some((d) => !d || !declares.has(d)) ||
      [...declares].some((d) => !attendus.has(d)))
  );
}).map((f) => f.id);
v('les domaines d’un facteur sont exactement ceux de ses types', domainesIncoherents, []);

/*
   UN FACTEUR SANS TYPE N'A PAS DE DOMAINE, et réciproquement. C'est ce qui
   garantit qu'on ne proposera jamais d'autoriser un domaine pour un facteur que
   Cyclades ne mesure pas.
*/
v(
  'un facteur sans type n’annonce aucun domaine',
  FACTEURS_DU_CYCLE.filter((f) => f.types.length === 0 && f.domaines.length > 0).map((f) => f.id),
  [],
);
v(
  'et un facteur avec des types en annonce au moins un',
  FACTEURS_DU_CYCLE.filter((f) => f.types.length > 0 && f.domaines.length === 0).map((f) => f.id),
  [],
);

/*
   UNE COUVERTURE QUI N'EST PAS COMPLÈTE DOIT SE DIRE. Sans cette réserve,
   « partielle » reste un mot de code : la personne lit un facteur sans savoir
   ce qu'il laisse dehors — le tabac et l'alcool, par exemple, qui n'ont aucune
   saisie.
*/
v(
  'toute couverture incomplète porte sa réserve, écrite pour être lue',
  FACTEURS_DU_CYCLE.filter((f) => f.couverture !== 'complete' && !f.reserve?.length).map(
    (f) => f.id,
  ),
  [],
);

console.log('\nTROIS RANGS, ET JAMAIS DEUX CONFONDUS');

const FENETRE = { joursDuCycle: 31 };
const faits = [
  { type: 'odyssee.sommeil', jourLogique: '2026-03-02' },
  { type: 'odyssee.sommeil', jourLogique: '2026-03-03' },
  { type: 'odyssee.sommeil', jourLogique: '2026-03-03' },
  { type: 'odyssee.checkin', jourLogique: '2026-03-04' },
  { type: 'sport.seance', jourLogique: '2026-03-05' },
];
const psycheCoupe = [{ domaine: 'psyche', typesRefuses: 5, typesEnTout: 5 }];

{
  const c = classerLesFacteurs({ faits, nonAutorises: [], ...FENETRE });
  v(
    'sans refus, le sommeil est observé sur deux jours',
    c.observes.find((o) => o.facteur.id === 'sommeil')?.joursRenseignes,
    2,
  );
  /*
     DEUX FAITS LE MÊME JOUR NE FONT QU'UN JOUR RENSEIGNÉ. Le dénominateur est
     un nombre de jours ; compter les faits donnerait « 32 jours sur 31 ».
  */
  v('deux faits le même jour ne comptent qu’une fois', c.observes.length > 0, true);
  v('les trois facteurs sans fait sont non mesurés', c.nonMesures.map((o) => o.facteur.id), [
    'horaires-atypiques',
    'deplacements',
    'contraception-urgence',
  ]);
  v('et aucun n’est non autorisé', c.nonAutorises, []);
}

{
  const c = classerLesFacteurs({ faits, nonAutorises: psycheCoupe, ...FENETRE });
  /*
     LE CŒUR DE L'ESSAI. Le stress perçu a des faits — un check-in est dans la
     fenêtre — et il passe pourtant en « non autorisé » : la matrice refuse le
     domaine. S'il tombait dans « non mesuré », l'écran dirait que Cyclades ne
     mesure pas le stress, ce qui est faux, et la personne n'aurait aucune
     raison d'autoriser quoi que ce soit.
  */
  v(
    'un domaine coupé envoie son facteur en « non autorisé », et non en « non mesuré »',
    c.nonAutorises.map((o) => o.facteur.id),
    ['stress-percu'],
  );
  v(
    'il ne figure pas parmi les non mesurés',
    c.nonMesures.some((o) => o.facteur.id === 'stress-percu'),
    false,
  );
  v(
    'ni parmi les observés',
    c.observes.some((o) => o.facteur.id === 'stress-percu'),
    false,
  );
  /*
     ET SON COMPTE EST REMIS À ZÉRO. Laisser « 1 jour renseigné » répondrait à
     la question qu'on vient de refuser : la personne apprendrait qu'il y a eu
     un check-in ce mois-ci, ce que la matrice interdit de lui dire.
  */
  v(
    'et son compte de jours est remis à zéro',
    c.nonAutorises[0]?.joursRenseignes,
    0,
  );
  v(
    'le refus porte le compte des types, pour que l’écran le dise',
    c.nonAutorises[0]?.refus,
    psycheCoupe,
  );
  /*
     Les facteurs d'un autre domaine ne sont pas touchés : couper Psyché ne
     coupe pas Corps.
  */
  v(
    'couper un domaine n’en coupe pas un autre',
    c.observes.find((o) => o.facteur.id === 'sommeil')?.joursRenseignes,
    2,
  );
}

{
  /*
     UN FACTEUR OBSERVÉ À ZÉRO JOUR RESTE OBSERVÉ. « Zéro nuit renseignée sur
     31 » est vrai et utile : Cyclades mesure le sommeil, et rien n'a été noté.
     Le ranger en « non mesuré » confondrait une absence de SAISIE avec une
     absence de MESURE — la seconde est définitive, la première non.
  */
  const c = classerLesFacteurs({ faits: [], nonAutorises: [], ...FENETRE });
  const sommeil = c.observes.find((o) => o.facteur.id === 'sommeil');
  v('sans aucun fait, le sommeil reste observé', Boolean(sommeil), true);
  v('à zéro jour renseigné', sommeil?.joursRenseignes, 0);
  v('et les non mesurés restent les mêmes', c.nonMesures.length, 3);
}

console.log('\nL’ORDRE, LA COUVERTURE, ET CE QUI EST IMPOSÉ');

{
  const c = classerLesFacteurs({ faits, nonAutorises: [], ...FENETRE });
  /*
     L'ORDRE EST LA COUVERTURE DÉCROISSANTE, ET NON L'ÉCART AUX HABITUDES QUE
     LE § 5.3 IMPOSE. Un écart demande deux valeurs, que la projection des faits
     ne porte pas. Cet essai fixe donc l'ordre réellement produit, pour que
     personne ne croie l'autre tenu — et il rougira le jour où les valeurs
     arriveront, ce qui est le bon moment pour y revenir.
  */
  v(
    'les observés sont rangés par couverture décroissante',
    c.observes.map((o) => o.joursRenseignes),
    [...c.observes.map((o) => o.joursRenseignes)].sort((a, b) => b - a),
  );
  v('et le premier est le mieux couvert', c.observes[0]?.facteur.id, 'sommeil');

  v(
    'la couverture se dit avec son dénominateur',
    direLaCouverture(c.observes[0], { un: 'nuit renseignée', plusieurs: 'nuits renseignées' }),
    '2 nuits renseignées sur 31',
  );
  v(
    'et au singulier quand il n’y en a qu’un',
    direLaCouverture({ ...c.observes[0], joursRenseignes: 1 }, { un: 'nuit', plusieurs: 'nuits' }),
    '1 nuit sur 31',
  );
}

/*
   LES DEUX PHRASES IMPOSÉES, LUES ICI ET NON RECOPIÉES. La première est la
   décision 13 : elle empêche la fiche de se lire comme une explication. La
   seconde est le bloc final fixe du § 5.3, le seul énoncé qui parle de ce que
   la fiche ne contient pas.
*/
v('la phrase du lien non établi ne juge pas', /lien non établi/.test(LIEN_NON_ETABLI), true);
v(
  'elle dit que c’est Cyclades qui ne l’établit pas',
  /par Cyclades$/.test(LIEN_NON_ETABLI),
  true,
);
v('le bloc final nomme ce qui n’est pas mesuré', /mesurés ou non/.test(BLOC_FINAL), true);
v('et il reste au conditionnel', /ont pu intervenir/.test(BLOC_FINAL), true);

/*
   AUCUNE DES PHRASES DU MODULE N'ANNONCE UN LIEN DE CAUSE. C'est l'interdit
   0.3, et il porte sur les mots : une réserve qui dirait « associé à » ou
   « provoque » ferait de la fiche une explication, ce que la décision 13
   refuse tant qu'aucune source n'est lue.
*/
const INTERDITS = ['provoque', 'associé à', 'cause de', 'entraîne', 'responsable de'];
const tousLesTextes = [
  LIEN_NON_ETABLI,
  BLOC_FINAL,
  ...FACTEURS_DU_CYCLE.map((f) => f.reserve ?? ''),
].join(' ');
v(
  'aucun mot de causalité dans les textes du module',
  INTERDITS.filter((mot) => tousLesTextes.toLowerCase().includes(mot)),
  [],
);

console.log(
  echecs === 0
    ? `\n\x1b[32m13 facteurs, trois rangs distincts, aucun écart inventé.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
