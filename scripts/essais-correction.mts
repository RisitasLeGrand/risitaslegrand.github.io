/**
 * Essais du socle de correction détaillée.
 *
 * Trois invariants, dont deux ne se voient jamais à l'usage s'ils sont faux —
 * et c'est précisément pour cela qu'ils sont ici.
 *
 *  1. **La trace conclut-elle à la bonne réponse ?** Une correction qui
 *     démontre autre chose que la réponse attendue est pire que pas de
 *     correction : elle enseigne le faux, avec l'autorité d'un corrigé. Le
 *     `Journal` rend la divergence structurellement impossible, encore faut-il
 *     le vérifier sur des items réels.
 *  2. **Les marqueurs se distinguent-ils autrement que par la couleur ?** Si
 *     deux marqueurs partageaient leur forme, la correction resterait
 *     parfaitement lisible pour qui voit les couleurs, et deviendrait muette
 *     pour les autres. Aucun écran ne le signalerait.
 *  3. **Les éléments utiles et inutiles sont-ils disjoints ?** Dire d'une
 *     prémisse qu'elle est distractrice alors qu'elle a servi fait chercher une
 *     erreur là où il n'y en a pas.
 */
import { MOTEURS } from '../src/features/relational-reasoning/moteurs/index';
import { SYSTEMES } from '../src/features/relational-reasoning/systemes/index';
import { accepte } from '../src/features/relational-reasoning/moteurs/types';
import { alea } from '../src/features/relational-reasoning/noyaux/aleatoire';
import {
  EXIGENCES,
  classer,
  exigenceManquante,
  proprietes,
} from '../src/features/relational-reasoning/noyaux/proprietes';
import {
  conclusionAttendue,
  defautsDeLaTrace,
  journal,
  memeConclusion,
  ref,
  type Conclusion,
} from '../src/features/correction/trace';
import {
  MARQUEURS,
  ORDRE_LEGENDE,
  alternative,
  legende,
  type Marqueur,
} from '../src/features/correction/vocabulaire';
import { EXERCICES_COG, aCorrectionDetaillee } from '../src/features/correction/registre';
import {
  annoter,
  marqueurDePhrase,
  marqueursEmployes,
  reponseJuste,
} from '../src/features/correction/annotations';
import { DIMENSIONS } from '../src/features/veridical-mapping/dimensions';
import {
  corrigerEssai,
  ecartEnMots,
  phraseDEcart,
} from '../src/features/veridical-mapping/correction';

/**
 * Les moteurs dont le solveur dépose déjà une trace.
 *
 * La liste est écrite à la main, et c'est voulu : elle force à la mettre à jour
 * quand un moteur est migré, ce qui rend l'avancement visible au lieu de le
 * laisser se deviner. L'essai échoue dans les deux sens — un moteur de la liste
 * qui ne trace pas, comme un moteur qui trace sans être inscrit.
 */
const MOTEURS_TRACES: string[] = [
  'chaine-conclusion',
  'chaine-syllogisme',
  'chaine-composee',
  'inferer-relation',
  'reseau-relationnel',
  'ensembles-possibles',
  'premisses-minimales',
  'contradiction',
  'premisse-manquante',
  'projection',
  'echange-axes',
  'cadres',
  'entre-deux',
  'completion-analogie',
  'recherche-motif',
  'isomorphisme-partiel',
  'sous-systeme-commun',
  'algebre-cachee',
  'analogie-intruse',
  'analogie-inter-systemes',
];

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
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

console.log('\n\x1b[1mLE CARNET DU SOLVEUR\x1b[0m\n');
{
  const j = journal();
  let leve = false;
  try {
    j.sceller({ genre: 'unique', indice: 0 });
  } catch {
    leve = true;
  }
  verifier('sceller sans étape est refusé', leve, true);

  const k = journal();
  k.inutile(ref('premisse', '2'));
  k.etape({
    utilise: [ref('premisse', '0')],
    produit: 'A est avant B',
    legende: 'La prémisse 1 donne directement A avant B.',
    surbrillance: [ref('premisse', '0')],
  });
  k.etape({
    utilise: [ref('premisse', '1')],
    loi: 'transitivité',
    produit: 'A est avant C',
    legende: 'En enchaînant avec la prémisse 2, A précède C.',
    surbrillance: [ref('premisse', '0'), ref('premisse', '1')],
  });
  const trace = k.sceller({ genre: 'unique', indice: 1 });

  verifier('les rangs se suivent à partir de 1', trace.etapes.map((e) => e.rang), [1, 2]);
  verifier(
    'les éléments utilisés nourrissent les éléments utiles',
    trace.elementsUtiles.map((r) => r.clef).sort(),
    ['0', '1'],
  );
  verifier(
    'un distracteur reste inutile',
    trace.elementsInutiles.map((r) => r.clef),
    ['2'],
  );
  verifier('le rang courant est lisible pendant le calcul', k.rang, 2);

  // Ce qui a servi ne peut pas être déclaré distracteur.
  const m = journal();
  m.inutile(ref('premisse', '0'));
  m.etape({
    utilise: [ref('premisse', '0')],
    produit: 'A est avant B',
    legende: 'La prémisse 1 suffit.',
    surbrillance: [],
  });
  const traceM = m.sceller({ genre: 'unique', indice: 0 });
  verifier('un élément qui sert cesse d’être inutile', traceM.elementsInutiles, []);
}

console.log('\n\x1b[1mLA CONCLUSION EST LA RÉPONSE\x1b[0m\n');
{
  verifier(
    'réponse unique',
    conclusionAttendue({ genre: 'unique', bonne: 2 }),
    { genre: 'unique', indice: 2 },
  );
  verifier(
    'réponse multiple',
    conclusionAttendue({ genre: 'multiple', bonnes: [0, 3] }),
    { genre: 'multiple', indices: [0, 3] },
  );
  verifier(
    'appariement',
    conclusionAttendue({ genre: 'appariement', paires: { A: 'X' } }),
    { genre: 'appariement', paires: { A: 'X' } },
  );

  // L'ordre d'une réponse multiple ne doit pas compter : la personne coche dans
  // l'ordre qu'elle veut, et le solveur produit l'ordre qu'il veut.
  verifier(
    'une réponse multiple se compare sans égard à l’ordre',
    memeConclusion(
      { genre: 'multiple', indices: [3, 0] },
      { genre: 'multiple', indices: [0, 3] },
    ),
    true,
  );
  verifier(
    'mais pas sans égard au contenu',
    memeConclusion(
      { genre: 'multiple', indices: [3, 0] },
      { genre: 'multiple', indices: [0, 2] },
    ),
    false,
  );
  verifier(
    'deux genres différents ne se confondent pas',
    memeConclusion({ genre: 'unique', indice: 0 }, { genre: 'multiple', indices: [0] }),
    false,
  );
}

console.log('\n\x1b[1mLES DÉFAUTS QU’UNE TRACE PEUT AVOIR\x1b[0m\n');
{
  const bonne = journal();
  bonne.etape({
    utilise: [ref('premisse', '0')],
    produit: 'A est avant B',
    legende: 'La prémisse 1 le donne.',
    surbrillance: [],
  });
  const t = bonne.sceller({ genre: 'unique', indice: 1 });

  verifier(
    'une trace cohérente n’a aucun défaut',
    defautsDeLaTrace(t, { genre: 'unique', bonne: 1 }),
    [],
  );
  verifier(
    'une conclusion qui n’est pas la bonne réponse est signalée',
    defautsDeLaTrace(t, { genre: 'unique', bonne: 0 }).length,
    1,
  );

  // Une légende vide produit un panneau muet : c'est un défaut, pas un détail.
  const muette = journal();
  muette.etape({ utilise: [], produit: 'quelque chose', legende: '   ', surbrillance: [] });
  verifier(
    'une légende vide est signalée',
    defautsDeLaTrace(muette.sceller({ genre: 'unique', indice: 0 }), {
      genre: 'unique',
      bonne: 0,
    }).some((d) => d.includes('légende vide')),
    true,
  );

  // Un renvoi vers un élément que la trace ne déclare pas utile empêcherait le
  // schéma d'allumer quoi que ce soit.
  const orpheline = {
    etapes: [
      {
        rang: 1,
        utilise: [ref('premisse', '7')],
        produit: 'A est avant B',
        legende: 'La prémisse 8 le donne.',
        surbrillance: [],
      },
    ],
    elementsUtiles: [],
    elementsInutiles: [],
    conclusion: { genre: 'unique', indice: 0 } as Conclusion,
  };
  verifier(
    'une étape qui cite un élément non déclaré utile est signalée',
    defautsDeLaTrace(orpheline, { genre: 'unique', bonne: 0 }).some((d) =>
      d.includes('absent des éléments utiles'),
    ),
    true,
  );
}

console.log('\n\x1b[1mLE VOCABULAIRE VISUEL\x1b[0m\n');
{
  const marqueurs = Object.keys(MARQUEURS) as Marqueur[];

  // L'invariant d'accessibilité : deux marqueurs ne partagent jamais leur forme.
  const formes = marqueurs.map((m) => MARQUEURS[m].forme);
  verifier(
    'chaque marqueur a sa propre forme — la couleur ne porte rien seule',
    new Set(formes).size,
    marqueurs.length,
  );
  verifier(
    'chaque marqueur a son propre glyphe de repli',
    new Set(marqueurs.map((m) => MARQUEURS[m].glyphe)).size,
    marqueurs.length,
  );
  verifier(
    'toutes les couleurs passent par un token de thème',
    marqueurs.every((m) => MARQUEURS[m].couleur.startsWith('var(--etat-')),
    true,
  );
  verifier(
    'chaque marqueur dit son sens, pour l’alternative textuelle',
    marqueurs.every((m) => MARQUEURS[m].sens.trim().length > 0),
    true,
  );
  verifier('l’ordre de légende couvre tous les marqueurs', ORDRE_LEGENDE.length, marqueurs.length);

  verifier(
    'la légende ne liste que les marqueurs employés',
    legende(['exclu', 'utilise']).map((e) => e.marqueur),
    ['utilise', 'exclu'],
  );
  verifier(
    'un marqueur répété n’apparaît qu’une fois',
    legende(['utilise', 'utilise']).length,
    1,
  );

  verifier(
    'l’alternative textuelle d’un seul élément',
    alternative('Trois entités sur une ligne', [{ nom: 'A', marqueur: 'utilise' }]),
    'Trois entités sur une ligne : A (utilisé).',
  );
  verifier(
    'l’alternative de deux éléments emploie « et », non une virgule',
    alternative('Deux régions', [
      { nom: 'Zone 1', marqueur: 'possible' },
      { nom: 'Zone 2', marqueur: 'exclu' },
    ]),
    'Deux régions : Zone 1 (possible) et Zone 2 (exclu).',
  );
  verifier(
    'l’alternative de trois éléments vire la liste puis conclut par « et »',
    alternative('Trois nœuds', [
      { nom: 'A', marqueur: 'utilise' },
      { nom: 'B', marqueur: 'inutile' },
      { nom: 'C', marqueur: 'bonne-reponse' },
    ]),
    'Trois nœuds : A (utilisé), B (inutile) et C (bonne réponse).',
  );
  verifier(
    'sans élément, l’alternative reste le sujet seul',
    alternative('Un graphe vide', []),
    'Un graphe vide',
  );
}

console.log('\n\x1b[1mLES ANNOTATIONS DE L’ÉNONCÉ\x1b[0m\n');
{
  const trace = (() => {
    const carnet = journal();
    carnet.inutile(ref('premisse', 2));
    carnet.etape({
      utilise: [ref('premisse', 0)],
      produit: 'A avant B',
      legende: 'première',
      surbrillance: [ref('entite', 'A')],
    });
    carnet.etape({
      utilise: [ref('premisse', 1)],
      produit: 'A avant C',
      legende: 'seconde',
      surbrillance: [ref('entite', 'C')],
    });
    return carnet.sceller({ genre: 'unique', indice: 1 });
  })();
  const reponse = {
    genre: 'unique' as const,
    options: [{ texte: 'non' }, { texte: 'oui' }, { texte: 'peut-être' }],
    bonne: 1,
  };

  const a1 = annoter(trace, reponse, { genre: 'unique', choix: 0 }, 1);
  verifier('à l’étape 1, la prémisse de l’étape 1 est utilisée', a1.premisses.get('0'), 'utilise');
  verifier('celle de l’étape 2 n’est pas encore marquée', a1.premisses.get('1'), undefined);
  verifier('et l’inutile l’est dès le départ', a1.premisses.get('2'), 'inutile');

  const a2 = annoter(trace, reponse, { genre: 'unique', choix: 0 }, 2);
  verifier('à l’étape 2, les deux prémisses sont utilisées', [a2.premisses.get('0'), a2.premisses.get('1')], ['utilise', 'utilise']);
  verifier('les entités surlignées suivent les étapes', [...a2.elements.keys()].sort(), ['A', 'C']);

  verifier('la réponse donnée est marquée', a2.options.get(0), 'ta-reponse');
  verifier('et la bonne aussi', a2.options.get(1), 'bonne-reponse');

  /**
   * Quand la réponse est juste, c'est `bonne-reponse` qui doit rester : afficher
   * « votre réponse » sur une réponse juste, sans dire qu'elle l'était, serait
   * le contraire de ce que la personne attend.
   */
  const juste = annoter(trace, reponse, { genre: 'unique', choix: 1 }, 2);
  verifier('une réponse juste porte le marqueur de la bonne réponse', juste.options.get(1), 'bonne-reponse');
  verifier('et `reponseJuste` le confirme', reponseJuste(reponse, { genre: 'unique', choix: 1 }), true);
  verifier('tandis qu’une fausse est reconnue comme telle', reponseJuste(reponse, { genre: 'unique', choix: 0 }), false);

  /**
   * Le garde-fou des clefs d'option : une clef qui n'est pas un rang est
   * ignorée. Sans lui, un `NaN` entrait dans la table, ne s'affichait nulle part
   * et faisait pourtant apparaître son marqueur dans la légende.
   */
  const bancal = (() => {
    const carnet = journal();
    carnet.inutile(ref('option', 'est au nord de'));
    carnet.etape({ utilise: [ref('premisse', 0)], produit: 'x', legende: 'y', surbrillance: [] });
    return carnet.sceller({ genre: 'unique', indice: 1 });
  })();
  const ignore = annoter(bancal, reponse, null, 1);
  verifier(
    'une clef d’option non numérique est ignorée',
    [...ignore.options.keys()].every((k) => Number.isInteger(k)),
    true,
  );
  verifier(
    'et la légende ne liste que des marqueurs présents',
    marqueursEmployes(ignore).includes('inutile'),
    false,
  );

  // Les deux conventions de clef de prémisse, acceptées à l'affichage seul.
  const parTexte = (() => {
    const carnet = journal();
    carnet.etape({
      utilise: [ref('premisse', 'A  ★  B')],
      produit: 'x',
      legende: 'y',
      surbrillance: [],
    });
    return carnet.sceller({ genre: 'unique', indice: 1 });
  })();
  const t2 = annoter(parTexte, reponse, null, 1);
  verifier('une prémisse désignée par son texte est retrouvée', marqueurDePhrase(t2, 'A  ★  B', 7), 'utilise');
  verifier('une prémisse désignée par son rang aussi', marqueurDePhrase(a1, 'peu importe', 0), 'utilise');
  verifier('et une phrase sans marqueur n’en reçoit pas', marqueurDePhrase(a1, 'rien', 5), undefined);

  // L'appariement : juste seulement si toutes les paires attendues y sont.
  const appariement = {
    genre: 'appariement' as const,
    gauche: ['★', '◆'],
    droite: ['a', 'b'],
    paires: { '★': 'a', '◆': 'b' },
  };
  verifier(
    'un appariement complet est juste',
    reponseJuste(appariement, { genre: 'appariement', paires: { '★': 'a', '◆': 'b' } }),
    true,
  );
  verifier(
    'un appariement partiel ne l’est pas',
    reponseJuste(appariement, { genre: 'appariement', paires: { '★': 'a' } }),
    false,
  );
}

console.log('\n\x1b[1mL’ÉNONCÉ DIT-IL CE QUE LE SOLVEUR CALCULE ?\x1b[0m\n');
{
  /**
   * Le garde-fou d'un défaut trouvé au lot B2 : « Sous-système commun »
   * calculait le plus grand motif commun **portant au moins k − 1 relations**,
   * mais son énoncé définissait « commun » sans ce seuil. Mesuré sur neuf cents
   * tirages, deux rendaient alors une réponse que le solveur comptait juste
   * alors que la définition affichée en rendait une autre vraie.
   *
   * Sans ce seuil il n'y a plus d'exercice — un groupe sans relation se
   * retrouve partout, et la réponse serait toujours la taille du plus petit
   * réseau. C'est donc l'énoncé qui a été aligné, et cette assertion empêche
   * qu'une reformulation le désaligne à nouveau.
   */
  const moteur = MOTEURS.find((m) => m.id === 'sous-systeme-commun');
  let enonce = '';
  for (const systeme of SYSTEMES) {
    if (!moteur || !accepte(moteur, systeme, SYSTEMES) || enonce) continue;
    for (let i = 0; i < 40 && !enonce; i += 1) {
      const item = moteur.engendrer(systeme, 1 + (i % 6), alea(i * 7919 + 13), SYSTEMES);
      const bloc = item?.enonce.find((b) => b.type === 'texte');
      if (bloc && bloc.type === 'texte') enonce = bloc.texte;
    }
  }
  verifier('un énoncé a bien été produit', enonce.length > 0, true);
  verifier(
    'il énonce le seuil de relations que le solveur applique',
    enonce.includes('au moins une relation de moins'),
    true,
  );
}

console.log('\n\x1b[1mLES EXIGENCES DES ALGÈBRES\x1b[0m\n');
{
  /**
   * Les prédicats de classification sont dérivés d'`EXIGENCES`, pour que la
   * correction puisse dire *pourquoi* une algèbre est écartée sans qu'une
   * seconde liste divergente s'installe. Ces assertions tiennent la dérivation.
   */
  const motifOrdre: [string, string][] = [
    ['A', 'B'],
    ['B', 'C'],
    ['A', 'C'],
  ];
  verifier('une chaîne transitive de trois entités est un ordre', classer(['A', 'B', 'C'], motifOrdre), 'ordre');
  const p = proprietes(['A', 'B', 'C'], motifOrdre);
  verifier(
    'et une équivalence y échoue sur la symétrie',
    exigenceManquante('equivalence', p)?.cle,
    'symetrique',
  );
  verifier(
    'tandis que l’ordre ne manque d’aucune exigence',
    exigenceManquante('ordre', p),
    null,
  );
  verifier(
    'chaque algèbre déclare au moins deux exigences',
    (Object.keys(EXIGENCES) as (keyof typeof EXIGENCES)[]).filter((k) => EXIGENCES[k].length < 2),
    [],
  );
  verifier(
    'et chaque exigence porte un mot pour la correction',
    Object.values(EXIGENCES)
      .flat()
      .filter((e) => !e.mot.trim()),
    [],
  );
}

console.log('\n\x1b[1mLA CORRECTION PERCEPTIVE (VERIDICAL MAPPING)\x1b[0m\n');
{
  const taille = DIMENSIONS.find((d) => d.id === 'taille')!;
  const teinte = DIMENSIONS.find((d) => d.id === 'teinte')!;

  verifier('un écart nul se dit comme tel', ecartEnMots(taille, 40, 40), 'aucun écart');
  verifier(
    'un écart se dit en pas et dans l’unité',
    /^3 pas, soit [\d,]+ px$/.test(ecartEnMots(taille, 40, 43)),
    true,
  );
  /**
   * Sur la teinte, qui reboucle, les pas 2 et 118 sont **voisins**. Un écart
   * calculé sans le rebouclage dirait 116 et ferait croire à une erreur
   * énorme là où il y en a une minuscule.
   */
  verifier(
    'et il tient compte du rebouclage',
    ecartEnMots(teinte, 2, 118).startsWith('4 pas'),
    true,
  );

  // Un essai de tâche « point », corrigé dans les deux cas.
  const arete = { de: taille, vers: DIMENSIONS.find((d) => d.id === 'luminosite')! };
  const essai = {
    arete,
    delta: 5,
    tache: 'point' as const,
    partiel: false,
    sousEssais: [
      {
        pasReference: 60,
        reference: {} as never,
        candidats: [
          { pas: 60, stimulus: {} as never, juste: true },
          { pas: 65, stimulus: {} as never, juste: false },
        ],
      },
    ],
  };

  const rate = corrigerEssai(essai, [1]);
  verifier('un essai raté est corrigé comme tel', rate[0].juste, false);
  verifier('et l’écart vaut le delta de l’escalier', rate[0].axes[0].ecart, 5);
  verifier(
    'la phrase nomme l’écart sans prétendre expliquer la bonne réponse',
    phraseDEcart(rate[0]).includes('5 pas'),
    true,
  );

  const reussi = corrigerEssai(essai, [0]);
  verifier('un essai réussi est corrigé comme tel', reussi[0].juste, true);
  verifier('et sans écart entre la réponse et l’attendu', reussi[0].axes[0].ecart, 0);
  /**
   * L'écart **entre les deux candidats** vaut dans les deux cas, et c'est la
   * seule grandeur que l'exercice mesure. Une version antérieure affichait la
   * largeur d'un pas sur un essai réussi — « 1 pas » là où l'en-tête annonçait
   * trente-six.
   */
  verifier('mais l’écart entre candidats reste celui de l’escalier', reussi[0].ecartEntreCandidats, 5);
  verifier(
    'et la phrase du succès l’annonce',
    phraseDEcart(reussi[0]).includes('5 pas'),
    true,
  );

  /**
   * Le sous-essai sans réponse n'est pas une erreur : la correction le dit
   * plutôt que de le compter comme un choix faux, ce qui laisserait croire
   * qu'on s'est trompé.
   */
  const muet = corrigerEssai(essai, [null]);
  verifier('un sous-essai sans réponse est distingué', muet[0].axes[0].pasDonne, null);
  verifier('et sa phrase le dit', phraseDEcart(muet[0]).includes('Aucune réponse'), true);

  // La tâche « plan » doit nommer l'axe fautif — c'est ce qu'elle enseigne.
  const seconde = {
    de: DIMENSIONS.find((d) => d.id === 'duree')!,
    vers: DIMENSIONS.find((d) => d.id === 'hauteur')!,
  };
  const plan = {
    arete,
    delta: 4,
    tache: 'plan' as const,
    partiel: false,
    secondaire: { de: seconde.de.id, vers: seconde.vers.id },
    secondaireDimensions: seconde,
    sousEssais: [
      {
        pasReference: 50,
        pasReferenceSecondaire: 70,
        reference: {} as never,
        candidats: [
          { pas: 50, pasSecondaire: 70, stimulus: {} as never, juste: true },
          // Le leurre ne se trompe que sur le **second** axe.
          { pas: 50, pasSecondaire: 74, stimulus: {} as never, juste: false },
        ],
      },
    ],
  };
  const corrigePlan = corrigerEssai(plan, [1]);
  verifier('la tâche « plan » corrige deux axes', corrigePlan[0].axes.length, 2);
  verifier('et nomme celui qui était fautif', corrigePlan[0].axeFautif, seconde.vers.nom);
  verifier(
    'l’axe juste ne porte aucun écart',
    corrigePlan[0].axes[0].ecart,
    0,
  );
  verifier('tandis que le fautif en porte un', corrigePlan[0].axes[1].ecart, 4);
  verifier(
    'l’écart entre candidats se mesure sur l’axe fautif',
    corrigePlan[0].ecartEntreCandidats,
    4,
  );

  // La tâche modulaire compare des intervalles, jamais des positions.
  const modulaire = {
    arete: { de: taille, vers: teinte },
    delta: 6,
    tache: 'modulaire' as const,
    partiel: false,
    intervalle: 30,
    sousEssais: [
      {
        pasReference: 10,
        pasReference2: 40,
        reference: {} as never,
        reference2: {} as never,
        candidats: [
          { pas: 100, ancre: 70, stimulus: {} as never, juste: true },
          { pas: 106, ancre: 70, stimulus: {} as never, juste: false },
        ],
      },
    ],
  };
  const corrigeModulaire = corrigerEssai(modulaire, [1]);
  verifier(
    'la tâche modulaire compare les intervalles',
    corrigeModulaire[0].intervalles?.reference,
    30,
  );
  verifier('et celui qui a été choisi', corrigeModulaire[0].intervalles?.donne, 36);
  verifier(
    'sa phrase parle d’écart, non de position',
    phraseDEcart(corrigeModulaire[0]).includes('c’est l’écart qui se transporte'),
    true,
  );
}

console.log('\n\x1b[1mLE REGISTRE DES EXERCICES\x1b[0m\n');
{
  verifier('Quad N-Back est exclu', aCorrectionDetaillee('quad-n-back'), false);
  verifier('et il dit pourquoi', 
    Boolean(EXERCICES_COG.find((e) => e.id === 'quad-n-back')?.raisonExclusion),
    true,
  );
  verifier('Relational Reasoning est inclus', aCorrectionDetaillee('relational-reasoning'), true);
  verifier('Veridical Mapping est inclus', aCorrectionDetaillee('veridical-mapping'), true);
  // Le défaut est l'inclusion : un exercice nouveau est couvert avant d'être déclaré.
  verifier('un exercice inconnu est inclus par défaut', aCorrectionDetaillee('à-venir'), true);
  verifier(
    'seul Quad N-Back porte une raison d’exclusion',
    EXERCICES_COG.filter((e) => !e.correctionDetaillee).map((e) => e.id),
    ['quad-n-back'],
  );
}

console.log('\n\x1b[1mLES MOTEURS, ITEM PAR ITEM\x1b[0m\n');
{
  const TIRAGES = 40;
  const tracent: string[] = [];
  const sans: string[] = [];
  let defautsTotal = 0;
  let itemsVus = 0;

  /**
   * La couverture par moteur : combien de ses items portent une trace.
   *
   * Elle n'est pas toujours de 100 %, et c'est assumé — deux moteurs
   * d'incomplétude rendent l'item sans trace quand aucune chaîne unique ne
   * justifie la réponse, plutôt que de supprimer l'exercice ou de raconter un
   * calcul qu'ils n'ont pas fait. Mais une couverture qui s'effondrerait en
   * silence serait un défaut, d'où le plancher vérifié plus bas.
   */
  const couverture = new Map<string, { items: number; traces: number }>();

  for (const moteur of MOTEURS) {
    let aTrace = false;
    const compte = { items: 0, traces: 0 };
    couverture.set(moteur.id, compte);
    for (const systeme of SYSTEMES) {
      if (!accepte(moteur, systeme, SYSTEMES)) continue;
      for (let i = 0; i < TIRAGES; i += 1) {
        const item = moteur.engendrer(systeme, 1 + (i % 6), alea(i * 7919 + 13), SYSTEMES);
        if (!item) continue;
        itemsVus += 1;
        compte.items += 1;
        if (!item.trace) continue;
        compte.traces += 1;
        aTrace = true;
        const defauts = defautsDeLaTrace(item.trace, item.reponse);
        if (defauts.length > 0) {
          defautsTotal += 1;
          if (defautsTotal <= 3) {
            console.log(`    ${moteur.id} × ${systeme.id} : ${defauts.join(' ; ')}`);
          }
        }
      }
    }
    (aTrace ? tracent : sans).push(moteur.id);
    verifier(
      `${moteur.id} offre la correction détaillée`,
      moteur.correctionDetaillee ?? true,
      true,
    );
  }

  verifier('des items ont bien été engendrés', itemsVus > 500, true);
  verifier('aucune trace ne contredit sa réponse', defautsTotal, 0);
  verifier(
    'les moteurs qui tracent sont ceux déclarés',
    tracent.sort(),
    [...MOTEURS_TRACES].sort(),
  );

  // Le plancher : un moteur déclaré traçant doit tracer la moitié de ses items
  // au moins. Il attrape l'effondrement silencieux, que la seule présence d'une
  // trace sur un item ne verrait pas.
  const PLANCHER = 50;
  const faibles = MOTEURS_TRACES.map((id) => {
    const c = couverture.get(id) ?? { items: 0, traces: 0 };
    return { id, part: c.items ? Math.round((c.traces / c.items) * 100) : 0 };
  }).filter((x) => x.part < PLANCHER);
  verifier(
    `chaque moteur déclaré trace au moins ${PLANCHER} % de ses items`,
    faibles.map((x) => `${x.id} (${x.part} %)`),
    [],
  );

  console.log('\n  Couverture des traces, moteur par moteur :');
  for (const id of MOTEURS_TRACES) {
    const c = couverture.get(id) ?? { items: 0, traces: 0 };
    const part = c.items ? Math.round((c.traces / c.items) * 100) : 0;
    console.log(`    ${id.padEnd(22)} ${String(part).padStart(3)} %  (${c.traces}/${c.items})`);
  }

  if (sans.length > 0) {
    console.log(
      `\n\x1b[33mReste à migrer (lot B2) : ${sans.length} moteur(s) sans trace —\x1b[0m\n    ${sans.join(', ')}`,
    );
  }
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
