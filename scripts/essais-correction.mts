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

/**
 * Les moteurs dont le solveur dépose déjà une trace.
 *
 * La liste est écrite à la main, et c'est voulu : elle force à la mettre à jour
 * quand un moteur est migré, ce qui rend l'avancement visible au lieu de le
 * laisser se deviner. L'essai échoue dans les deux sens — un moteur de la liste
 * qui ne trace pas, comme un moteur qui trace sans être inscrit.
 */
const MOTEURS_TRACES: string[] = ['chaine-conclusion'];

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

  for (const moteur of MOTEURS) {
    let aTrace = false;
    for (const systeme of SYSTEMES) {
      if (!accepte(moteur, systeme)) continue;
      for (let i = 0; i < TIRAGES; i += 1) {
        const item = moteur.engendrer(systeme, 1 + (i % 6), alea(i * 7919 + 13));
        if (!item) continue;
        itemsVus += 1;
        if (!item.trace) continue;
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
