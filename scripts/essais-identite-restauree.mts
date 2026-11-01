/**
 * QUI, DE L'APPAREIL OU DU FICHIER, DIT L'IDENTITÉ — B-7 du 58.
 *
 * ## Le défaut gardé
 *
 * Une restauration remplaçait le magasin `etat` en entier, identité comprise.
 * Mesuré de bout en bout par le constructeur sur un vrai fichier : `etat` y
 * voyageait avec `appareil`, `boite.privee`, `boite.publique`, `coffre.sel` et
 * `horloge`. Restaurer faisait donc prendre à l'appareil l'identité de celui qui
 * avait écrit la sauvegarde — deux appareils sous le même identifiant, celui qui
 * arbitre les horloges logiques égales.
 *
 * ## Pourquoi cet essai est hors navigateur
 *
 * Toute la décision est dans une fonction PURE : on lui donne l'état du fichier,
 * l'état local et le rôle, elle rend le troisième. Elle ne lit rien et n'écrit
 * rien. L'éprouver ici coûte une seconde et couvre les deux branches clé par
 * clé, ce qu'un essai de navigateur ne ferait qu'au prix de deux profils et de
 * plusieurs minutes.
 *
 * CE QUE CET ESSAI NE PROUVE PAS, et il faut le dire : que `restaurer()` passe
 * bien le résultat de cette fonction à l'écriture. C'est un fait de CÂBLAGE, pas
 * de décision. Il est garanti par le type — `role` est obligatoire, donc
 * `astro check` refuse tout appelant qui ne répond pas, ce qui est vérifié — et
 * il reste à éprouver de bout en bout sur le banc du constructeur. Je ne le
 * compte pas comme acquis.
 */
import {
  JAMAIS_DU_FICHIER,
  SELON_LE_ROLE,
  TOUJOURS_DU_FICHIER,
  ceQueLEcranDoitDire,
  clefsNonClassees,
  etatARestaurer,
  source,
  type EntreeDEtat,
} from '../src/lib/sauvegarde/politique-de-l-identite';
import { CLEFS_TECHNIQUES_ETAT, estTechnique } from '../src/lib/sauvegarde/groupes';
import { plusRecent } from '../src/lib/noyau/fusion';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
  } else {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${intitule}`);
    console.log(`      obtenu  ${a}`);
    console.log(`      attendu ${b}`);
  }
};

/* Deux états qui se ressemblent assez pour que la confusion soit possible. */
const DU_FICHIER: EntreeDEtat[] = [
  { clef: 'appareil', valeur: 'du-fichier' },
  { clef: 'horloge', valeur: { hlc: '2026-10-30T00:00:00.000Z-0001' } },
  { clef: 'appareilsVus', valeur: { 'un-pair': { vuLe: '2026-10-30' } } },
  { clef: 'derniereSauvegarde', valeur: '2026-10-30T00:00:00.000Z' },
  { clef: 'boite.privee', valeur: 'scellee-ailleurs' },
  { clef: 'boite.publique', valeur: 'publique-d-ailleurs' },
  { clef: 'appairage', valeur: 'secret-d-ailleurs' },
  { clef: 'lotsRecus', valeur: ['lot-d-ailleurs'] },
  { clef: 'coffre.sel', valeur: 'le-sel-qui-ouvre-les-donnees' },
  { clef: 'coffre.enveloppe', valeur: 'enveloppe-d-ailleurs' },
  { clef: 'coffre.verrou-automatique.delai', valeur: 900 },
  { clef: 'reglagesSync', valeur: { taille: { hlc: 'x', appareil: 'du-fichier', valeur: 30 } } },
  { clef: 'profil', valeur: { genre: 'feminin' } },
];

const EN_LOCAL: EntreeDEtat[] = [
  { clef: 'appareil', valeur: 'celui-d-ici' },
  { clef: 'horloge', valeur: { hlc: '2026-10-31T00:00:00.000Z-0007' } },
  { clef: 'appareilsVus', valeur: { 'autre-pair': { vuLe: '2026-10-31' } } },
  { clef: 'derniereSauvegarde', valeur: '2026-10-31T00:00:00.000Z' },
  { clef: 'boite.privee', valeur: 'la-mienne-scellee' },
  { clef: 'boite.publique', valeur: 'la-mienne-publique' },
  { clef: 'appairage', valeur: 'mon-secret' },
  { clef: 'lotsRecus', valeur: ['mon-lot'] },
  { clef: 'coffre.enveloppe', valeur: 'mon-enveloppe' },
  { clef: 'fusionEnCours', valeur: ['ma-cible-en-attente'] },
];

const valeurDe = (etat: readonly EntreeDEtat[], clef: string) =>
  etat.find((e) => e.clef === clef)?.valeur;
const porte = (etat: readonly EntreeDEtat[], clef: string) =>
  etat.some((e) => e.clef === clef);

console.log('\n\x1b[1mL’APPAREIL REMPLACE L’ANCIEN : IL EN REPREND L’IDENTITÉ\x1b[0m');
{
  const r = etatARestaurer(DU_FICHIER, EN_LOCAL, 'remplace-l-ancien', estTechnique);

  v('l’identité vient du fichier', valeurDe(r.etat, 'appareil'), 'du-fichier');
  v('l’horloge aussi, et seulement avec elle', valeurDe(r.etat, 'horloge'), {
    hlc: '2026-10-30T00:00:00.000Z-0001',
  });
  /*
     ET LE CARNET D'ADRESSES AVEC. C'est contre-intuitif, et je m'étais trompé :
     j'avais rangé `appareilsVus` parmi les clés qui ne voyagent jamais, en me
     disant que ce sont des constats. Le pilote l'a tranché autrement — un
     appareil qui reprend un nom sans son carnet redemande à chacun tout depuis
     le début.
  */
  v('et la liste des pairs vus, qui va avec l’identité', valeurDe(r.etat, 'appareilsVus'), {
    'un-pair': { vuLe: '2026-10-30' },
  });
  v(
    'et la date de dernière sauvegarde, puisqu’il hérite de cet historique',
    valeurDe(r.etat, 'derniereSauvegarde'),
    '2026-10-30T00:00:00.000Z',
  );

  /*
     MAIS PAS LES CLÉS DE LA BOÎTE, et c'est la règle qui ne plie dans aucun des
     deux cas. `boite.privee` est scellée sous la clé du coffre de l'appareil qui
     l'a créée : la reprendre ne donnerait pas une boîte qui marche, elle
     donnerait une boîte qui en a l'air — et la panne se découvrirait au premier
     pli perdu.
  */
  v('la clé privée de la boîte reste celle d’ici', valeurDe(r.etat, 'boite.privee'), 'la-mienne-scellee');
  v('la publique aussi', valeurDe(r.etat, 'boite.publique'), 'la-mienne-publique');
  v('le secret d’appairage reste local', valeurDe(r.etat, 'appairage'), 'mon-secret');
  v('la comptabilité des lots reçus reste locale', valeurDe(r.etat, 'lotsRecus'), ['mon-lot']);

  v(
    'le sel des données vient du fichier — sans lui, la sauvegarde serait illisible',
    valeurDe(r.etat, 'coffre.sel'),
    'le-sel-qui-ouvre-les-donnees',
  );
  v(
    'mais l’enveloppe reste celle d’ici, qui n’emballe la clé que pour cet appareil',
    valeurDe(r.etat, 'coffre.enveloppe'),
    'mon-enveloppe',
  );
  v(
    'le délai de verrouillage voyage : technique par son préfixe, réglage par sa nature',
    valeurDe(r.etat, 'coffre.verrou-automatique.delai'),
    900,
  );
  v('et le profil voyage, comme toute donnée de la personne', valeurDe(r.etat, 'profil'), {
    genre: 'feminin',
  });
  v(
    'le travail d’une fusion interrompue ICI reste ici',
    valeurDe(r.etat, 'fusionEnCours'),
    ['ma-cible-en-attente'],
  );
  v('aucune clé n’échappe au classement', r.nonClassees, []);
}

console.log('\n\x1b[1mL’APPAREIL S’AJOUTE : IL GARDE LA SIENNE\x1b[0m');
{
  const r = etatARestaurer(DU_FICHIER, EN_LOCAL, 's-ajoute', estTechnique);

  v('l’identité reste celle d’ici', valeurDe(r.etat, 'appareil'), 'celui-d-ici');
  v('l’horloge reste celle d’ici', valeurDe(r.etat, 'horloge'), {
    hlc: '2026-10-31T00:00:00.000Z-0007',
  });
  v('la liste des pairs vus reste celle d’ici', valeurDe(r.etat, 'appareilsVus'), {
    'autre-pair': { vuLe: '2026-10-31' },
  });
  /*
     ET LA DATE DE DERNIÈRE SAUVEGARDE RESTE LOCALE. Le pilote ne l'avait pas
     nommée ; c'est ma lecture, et je la lui signale. Un appareil qui s'ajoute
     n'a JAMAIS sauvegardé : lui donner la date du fichier tairait le rappel au
     moment précis où il faudrait l'entendre.
  */
  v(
    'et la date de dernière sauvegarde reste locale : cet appareil n’a rien sauvegardé',
    valeurDe(r.etat, 'derniereSauvegarde'),
    '2026-10-31T00:00:00.000Z',
  );

  v('les clés de la boîte restent celles d’ici, comme dans l’autre cas', valeurDe(r.etat, 'boite.privee'), 'la-mienne-scellee');
  v(
    'et le sel des données vient du fichier, comme dans l’autre cas',
    valeurDe(r.etat, 'coffre.sel'),
    'le-sel-qui-ouvre-les-donnees',
  );
  v('aucune clé n’échappe au classement', r.nonClassees, []);

  /*
     LES DEUX BRANCHES SE CONFRONTENT, plutôt que de s'éprouver séparément. Une
     branche qui rendrait exactement l'autre passerait toutes les assertions
     ci-dessus prises une à une ; ce qui prouve qu'il y a bien DEUX branches,
     c'est qu'elles diffèrent, et sur quoi.
  */
  const remplace = etatARestaurer(DU_FICHIER, EN_LOCAL, 'remplace-l-ancien', estTechnique);
  const differences = r.etat
    .filter((e) => JSON.stringify(valeurDe(remplace.etat, e.clef)) !== JSON.stringify(e.valeur))
    .map((e) => e.clef)
    .sort();
  v(
    'et les deux branches ne diffèrent QUE sur ce qui relève du rôle',
    differences,
    ['appareil', 'appareilsVus', 'derniereSauvegarde', 'horloge'],
  );
}

console.log('\n\x1b[1mCE QUE LE FICHIER N’A PAS, ON NE L’INVENTE PAS\x1b[0m');
{
  /*
     La sémantique est celle du REMPLACEMENT, des deux côtés. Une clé qui vient
     du fichier et que le fichier ne porte pas disparaît : si la personne n'avait
     pas ce réglage, elle ne l'a pas après. Et une clé qui reste locale et que
     l'appareil ne porte pas ne s'invente pas.
  */
  const r = etatARestaurer(
    [{ clef: 'appareil', valeur: 'du-fichier' }],
    [{ clef: 'profil', valeur: { genre: 'masculin' } }],
    'remplace-l-ancien',
    estTechnique,
  );
  v(
    'un réglage que le fichier ne porte pas disparaît — c’est « Remplacer »',
    porte(r.etat, 'profil'),
    false,
  );
  v('et l’identité reprise est bien là', valeurDe(r.etat, 'appareil'), 'du-fichier');

  const neuf = etatARestaurer(
    [{ clef: 'boite.privee', valeur: 'scellee-ailleurs' }],
    [],
    'remplace-l-ancien',
    estTechnique,
  );
  /*
     LE CAS DU PROFIL NEUF, qui est le plus dangereux : l'appareil n'a PAS de
     clé de boîte, et le fichier en porte une. La règle ne doit pas se relâcher
     parce qu'il n'y a rien à protéger localement — sinon elle ne tient que
     lorsqu'elle est inutile.
  */
  v(
    'sur un profil neuf, la clé de boîte du fichier n’est pas reprise non plus',
    porte(neuf.etat, 'boite.privee'),
    false,
  );
  v('et elle est comptée comme gardée locale', neuf.gardeesLocales, ['boite.privee']);
}

console.log('\n\x1b[1mLA PESÉE TIENT ENCORE APRÈS « S’Y AJOUTE »\x1b[0m');
{
  /*
     CE QUE LE PILOTE DEMANDE, ET POURQUOI C'EST ICI QUE ÇA SE JOUE.

     `plusRecent` départage par l'horloge, puis PAR L'APPAREIL, puis par la
     valeur. L'arbitrage par l'appareil n'a de sens que si les deux appareils
     portent des noms différents.

     Après « s'y ajoute », l'identité locale est conservée : le départage garde
     donc ses deux noms distincts, et un conflit d'horloges égales se tranche de
     la même façon des deux côtés. Si la politique avait repris l'identité du
     fichier, les deux appareils s'appelleraient pareil, et l'arbitrage
     tomberait d'un cran — sur la valeur sérialisée, qui converge encore mais ne
     dit plus QUI a écrit en dernier.
  */
  const r = etatARestaurer(DU_FICHIER, EN_LOCAL, 's-ajoute', estTechnique);
  const identiteLocale = valeurDe(r.etat, 'appareil') as string;
  v('l’appareil garde un nom distinct de celui du fichier', identiteLocale !== 'du-fichier', true);

  const ecritIci = { hlc: 'egale', appareil: identiteLocale, valeur: 30 };
  const ecritLaBas = { hlc: 'egale', appareil: 'du-fichier', valeur: 20 };
  const gagnant = plusRecent(ecritIci, ecritLaBas);
  const inverse = plusRecent(ecritLaBas, ecritIci);
  v(
    'à horloge égale, la pesée départage encore par l’appareil',
    gagnant.appareil === inverse.appareil,
    true,
  );
  v(
    'et elle rend le même gagnant dans les deux sens — aucune divergence',
    JSON.stringify(gagnant) === JSON.stringify(inverse),
    true,
  );
  /*
     ET LE CONTRE-ÉPREUVE, sans laquelle les deux précédentes ne diraient rien :
     si les deux appareils portaient le MÊME nom, l'arbitrage ne pourrait plus se
     faire sur l'appareil. Il converge quand même — le dépôt a corrigé cela — mais
     par la valeur, c'est-à-dire en perdant la trace de qui a écrit en dernier.
  */
  const commeSiRepris = plusRecent(
    { hlc: 'egale', appareil: 'du-fichier', valeur: 30 },
    { hlc: 'egale', appareil: 'du-fichier', valeur: 20 },
  );
  v(
    'tandis qu’une identité reprise à tort ferait tomber l’arbitrage sur la valeur',
    commeSiRepris.valeur,
    30,
  );
  v(
    'et le registre des réglages vient du fichier, pour que la pesée ait de quoi peser',
    valeurDe(r.etat, 'reglagesSync'),
    { taille: { hlc: 'x', appareil: 'du-fichier', valeur: 30 } },
  );
}

console.log('\n\x1b[1mAUCUNE CLÉ TECHNIQUE N’ÉCHAPPE AU CLASSEMENT\x1b[0m');
{
  v('les clés techniques déclarées du dépôt sont toutes classées', clefsNonClassees(CLEFS_TECHNIQUES_ETAT), []);

  /*
     ET LE BALAYAGE DES SOURCES, le même procédé que celui qui a trouvé
     `derniereSauvegarde` oubliée des deux listes de `groupes.ts`. Une clé
     nommée par une constante lui échappe, et c'est dit : celles-là sont
     couvertes par la liste déclarée ci-dessus. Les deux se complètent ; aucun
     ne suffit seul.
  */
  const { readFileSync, globSync } = await import('node:fs');
  const litterales = new Set<string>();
  for (const chemin of globSync('src/**/*.{ts,astro}')) {
    for (const m of readFileSync(chemin, 'utf8').matchAll(
      /\b(?:get|put|delete)\(\s*'etat'\s*,[^;]*?'([A-Za-z][\w.:-]*)'\s*\)/g,
    )) {
      litterales.add(m[1]);
    }
  }
  v('le balayage trouve bien des clés', litterales.size > 0, true);
  v(
    'et chaque clé technique écrite en toutes lettres est classée',
    [...litterales].filter((clef) => source(clef, 'remplace-l-ancien', estTechnique) === 'non-classee').sort(),
    [],
  );
  v(
    'aucune clé n’est rangée dans deux listes à la fois',
    Object.keys(JAMAIS_DU_FICHIER).filter(
      (c) => c in SELON_LE_ROLE || c in TOUJOURS_DU_FICHIER,
    ),
    [],
  );
  v(
    'ni entre les deux autres',
    Object.keys(SELON_LE_ROLE).filter((c) => c in TOUJOURS_DU_FICHIER),
    [],
  );
}

console.log('\n\x1b[1mLE FILET DES CLÉS NON CLASSÉES\x1b[0m');
{
  /*
     Le filet ne se laisse pas atteindre avec le vrai `estTechnique` — et c'est
     le but : aucune clé réelle n'y tombe. On lui donne donc un critère de notre
     choix, ce que le paramètre permet justement, pour éprouver ce qui arrive le
     jour où quelqu'un ajoute une clé technique sans la classer.
  */
  const toutEstTechnique = () => true;
  const r = etatARestaurer(
    [{ clef: 'inventee', valeur: 'du-fichier' }],
    [{ clef: 'inventee', valeur: 'locale' }],
    'remplace-l-ancien',
    toutEstTechnique,
  );
  v('une clé technique non classée est nommée', r.nonClassees, ['inventee']);
  v(
    'et elle reste LOCALE, qui est le choix conservateur',
    valeurDe(r.etat, 'inventee'),
    'locale',
  );
  v(
    'et la restauration n’est pas refusée pour autant',
    r.etat.length,
    1,
  );
  /* Et avec le vrai critère, la même clé est une donnée de la personne. */
  v(
    'tandis qu’une clé NON technique du même nom vient du fichier',
    valeurDe(
      etatARestaurer(
        [{ clef: 'inventee', valeur: 'du-fichier' }],
        [{ clef: 'inventee', valeur: 'locale' }],
        'remplace-l-ancien',
        estTechnique,
      ).etat,
      'inventee',
    ),
    'du-fichier',
  );
}

console.log('\n\x1b[1mCE QUE L’ÉCRAN DOIT DIRE\x1b[0m');
{
  const remplace = ceQueLEcranDoitDire('remplace-l-ancien');
  const ajoute = ceQueLEcranDoitDire('s-ajoute');

  v(
    'dans les deux cas, l’appairage est annoncé comme à refaire',
    [remplace, ajoute].every((phrases) =>
      phrases.some(({ phrase }) => /appairage|boîte aux lettres/.test(phrase)),
    ),
    true,
  );
  v(
    'et seul le cas « remplace » dit de délier l’ancien appareil',
    [
      remplace.some(({ phrase }) => /[Dd]élier/.test(phrase)),
      ajoute.some(({ phrase }) => /[Dd]élier/.test(phrase)),
    ],
    [true, false],
  );
  v(
    'le cas « remplace » annonce une identité REPRISE',
    remplace[0].phrase.startsWith('Reprise'),
    true,
  );
  v('et le cas « s’ajoute » une identité GARDÉE', ajoute[0].phrase.startsWith('Gardée'), true);
  /*
     Et chaque phrase porte un intitulé : un `dt` vide dans une liste de
     définitions est du mauvais balisage, et l'intitulé appartient à la phrase
     plutôt qu'à l'écran qui l'affiche.
  */
  v(
    'et chaque phrase est intitulée',
    [...remplace, ...ajoute].every(({ intitule }) => intitule.length > 0),
    true,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} en échec.\x1b[0m\n`
    : '\n\x1b[32mTout est vert : l’identité ne se restaure que si on le demande.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
