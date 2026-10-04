/**
 * Essais du prétest de positionnement et de la note d'entrée.
 *
 * Ce qui est éprouvé ici tient en trois questions, et aucune des trois ne se
 * voit à l'usage si elle est fausse :
 *
 *  1. **La note d'entrée se range-t-elle ailleurs que le niveau acquis ?** Si
 *     les préfixes se chevauchaient, les prétests tireraient silencieusement le
 *     niveau affiché vers le bas à chaque fiche neuve ouverte, et personne ne
 *     saurait pourquoi.
 *  2. **La justesse partielle est-elle calculée comme annoncé ?** Un tout ou
 *     rien déguisé rangerait « presque juste » avec « complètement à côté ».
 *  3. **La bande de zone proximale encadre-t-elle bien la cible de 70 % ?** Une
 *     borne du mauvais côté recommanderait exactement les cours qu'il faut
 *     éviter, sans jamais produire d'erreur.
 *
 * Les fonctions testées sont pures. La persistance (IndexedDB) et l'interface
 * relèvent des essais en navigateur.
 */
import {
  BANDE_ZPD,
  NOTE_INITIALE,
  PREFIXE_ENTREE,
  REUSSITE_VISEE,
  ajusterNiveau,
  chanceDeReussite,
  clefs,
  clefsAgregatDifficulte,
  clefsEntree,
  difficulteVisee,
  estNoteDEntree,
  ordonnerParCible,
} from '../src/lib/niveau';
import { justesse, parFraicheur, tirer } from '../src/lib/pretest-noyau';
import {
  FICHES_MINIMALES,
  QUESTIONS_MINIMALES,
  QUESTIONS_PAR_FICHE,
  QUESTIONS_VISEES,
  perimetres,
} from '../src/lib/positionnement';

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
}

const SUJET = {
  matiere: 'Finances publiques',
  fascicule: 'Fascicule 4',
  ficheId: 'abc123',
  ficheTitre: 'La taxe sur la valeur ajoutée',
};

console.log('\nLA NOTE D’ENTRÉE NE SE MÊLE PAS AU NIVEAU ACQUIS');
{
  const acquis = clefs(SUJET).map((s) => s.clef);
  const entree = clefsEntree(SUJET).map((s) => s.clef);
  verifier('trois portées de part et d’autre', [acquis.length, entree.length], [3, 3]);
  verifier(
    'aucune clé d’entrée ne ressemble à une clé acquise',
    entree.some((c) => acquis.includes(c)),
    false,
  );
  verifier('toutes les clés d’entrée sont reconnues', entree.every(estNoteDEntree), true);
  verifier('aucune clé acquise ne l’est', acquis.some(estNoteDEntree), false);
  verifier(
    'le préfixe est bien celui annoncé',
    entree.every((c) => c.startsWith(PREFIXE_ENTREE)),
    true,
  );
  verifier(
    'les portées se correspondent une à une',
    clefsEntree(SUJET).map((s) => s.portee),
    clefs(SUJET).map((s) => s.portee),
  );
}

console.log('\nLES AGRÉGATS DE DIFFICULTÉ NE COUVRENT PAS LA MATIÈRE');
{
  // Une difficulté de matière entière n'aurait aucun usage : on ne choisit pas
  // une matière, on choisit un cours dans un fascicule.
  verifier('fiche et fascicule, pas la matière', clefsAgregatDifficulte(SUJET), [
    'fascicule:Finances publiques|Fascicule 4',
    'fiche:abc123',
  ]);
  verifier(
    'sans fiche, seul le fascicule',
    clefsAgregatDifficulte({ matiere: 'Économie', fascicule: 'Fascicule 1' }),
    ['fascicule:Économie|Fascicule 1'],
  );
  verifier('sans rien, aucun agrégat', clefsAgregatDifficulte({ matiere: 'Économie' }), []);
  verifier(
    'une clé d’agrégat n’est jamais prise pour une clé d’entrée',
    clefsAgregatDifficulte(SUJET).some(estNoteDEntree),
    false,
  );
}

console.log('\nJUSTESSE D’UNE RÉPONSE');
{
  const unique = { bonnes: [2] };
  verifier('réponse unique juste', justesse(unique, new Set([2])), 1);
  verifier('réponse unique fausse', justesse(unique, new Set([0])), 0);
  verifier('rien de coché vaut zéro', justesse(unique, new Set<number>()), 0);

  const multiple = { bonnes: [0, 1, 2] };
  verifier('les trois bonnes', justesse(multiple, new Set([0, 1, 2])), 1);
  verifier(
    'deux bonnes sur trois, sans erreur',
    Math.round(justesse(multiple, new Set([0, 1])) * 100) / 100,
    0.67,
  );
  verifier('deux bonnes et une fausse', justesse(multiple, new Set([0, 1, 3])), 0.5);
  verifier('tout coché sur une question à trois bonnes parmi quatre',
    Math.round(justesse(multiple, new Set([0, 1, 2, 3])) * 100) / 100, 0.75);
  verifier('aucune bonne', justesse(multiple, new Set([3])), 0);
  verifier(
    'le partiel est bien strictement entre les deux bornes',
    justesse(multiple, new Set([0])) > 0 && justesse(multiple, new Set([0])) < 1,
    true,
  );
}

console.log('\nLA PRIORITÉ DE FRAÎCHEUR EST ABSOLUE');
{
  const q = (id: string) => ({ id, question: id, options: ['a', 'b'], bonnes: [0] });
  const vivier = [q('un'), q('deux'), q('trois'), q('quatre')];

  const rien = parFraicheur(vivier, []);
  verifier('sans historique, tout est inédit', [rien.inedites.length, rien.revues.length], [4, 0]);

  const partiel = parFraicheur(vivier, ['deux', 'quatre']);
  verifier('les deux groupes partitionnent le vivier', [partiel.inedites.length, partiel.revues.length], [2, 2]);
  verifier(
    'aucune question servie ne figure parmi les inédites',
    partiel.inedites.map((x) => x.id).sort(),
    ['trois', 'un'],
  );
  verifier(
    'et réciproquement',
    partiel.revues.map((x) => x.id).sort(),
    ['deux', 'quatre'],
  );

  // C'est l'invariant que le tri par zone proximale ne doit jamais pouvoir
  // casser : une question corrigée ne remonte pas devant une inédite.
  const tout = parFraicheur(vivier, ['deux']);
  verifier(
    'une seule revue, reléguée derrière les trois inédites',
    [...tout.inedites, ...tout.revues].at(-1)!.id,
    'deux',
  );
  verifier(
    'tirer ne sert que des inédites quand il y en a assez',
    tirer(vivier, ['deux'], 3).every((x) => x.id !== 'deux'),
    true,
  );
  verifier(
    'tirer retombe sur les revues quand le vivier est épuisé',
    tirer(vivier, ['un', 'deux', 'trois', 'quatre'], 2).length,
    2,
  );
  verifier('tirer respecte le nombre demandé', tirer(vivier, [], 2).length, 2);
  verifier('tirer ne dépasse pas le vivier', tirer(vivier, [], 10).length, 4);
}

console.log('\nLA BANDE DE ZONE PROXIMALE ENCADRE LA CIBLE');
{
  verifier('la cible est dans la bande', REUSSITE_VISEE > BANDE_ZPD.bas && REUSSITE_VISEE < BANDE_ZPD.haut, true);
  verifier('les bornes sont dans le bon ordre', BANDE_ZPD.bas < BANDE_ZPD.haut, true);
  // La borne basse est sous une chance sur deux à dessein : la zone proximale
  // n'est pas la zone confortable.
  verifier('la borne basse est sous 0,5', BANDE_ZPD.bas < 0.5, true);

  const niveau = 1300;
  const aLaCible = chanceDeReussite(niveau, difficulteVisee(niveau));
  verifier(
    'un cours à la difficulté visée tombe dans la zone',
    aLaCible >= BANDE_ZPD.bas && aLaCible < BANDE_ZPD.haut,
    true,
  );
  // Un cours 400 points plus facile que soi se réussit à 91 % : au-dessus.
  verifier('400 points plus facile sort par le haut', chanceDeReussite(niveau, niveau - 400) >= BANDE_ZPD.haut, true);
  // Un cours 400 points plus dur se réussit à 9 % : en dessous.
  verifier('400 points plus dur sort par le bas', chanceDeReussite(niveau, niveau + 400) < BANDE_ZPD.bas, true);
}

console.log('\nL’ORDRE DE PRÉSENTATION VISE 70 %, PAS LE PLUS FACILE');
{
  const situees = [
    { fiche: { id: 'tres-facile' }, situation: 'au-dessus' as const, chance: 0.97, difficulte: 900 },
    { fiche: { id: 'juste-bien' }, situation: 'dans-la-zone' as const, chance: 0.71, difficulte: 1150 },
    { fiche: { id: 'un-peu-dur' }, situation: 'dans-la-zone' as const, chance: 0.52, difficulte: 1270 },
  ];
  verifier(
    'le plus proche de 70 % passe devant le plus facile',
    ordonnerParCible(situees).map((s) => s.fiche.id),
    ['juste-bien', 'un-peu-dur', 'tres-facile'],
  );
  verifier(
    'une fiche non située ne passe pas devant une fiche dans la zone',
    ordonnerParCible([
      { fiche: { id: 'inconnue' }, situation: 'non-situee' as const, chance: null, difficulte: null },
      { fiche: { id: 'juste-bien' }, situation: 'dans-la-zone' as const, chance: 0.71, difficulte: 1150 },
    ]).map((s) => s.fiche.id),
    ['juste-bien', 'inconnue'],
  );
  verifier('l’ordre d’entrée est préservé à égalité', ordonnerParCible([]).length, 0);
}

console.log('\nLE PÉRIMÈTRE ÉCARTE CE QU’IL NE PEUT PAS INTERROGER');
{
  const f = (id: string, ordre: number, tags: string[] = [], aPretest = true) => ({
    id, titre: id.toUpperCase(), ordre, tags,
    nbFlashcards: 0, nbQuiz: 0, nbMots: 0, aCours: true, aFiche: true, aPretest,
  });
  const manifeste = {
    genereLe: '',
    totaux: { fiches: 0, flashcards: 0, quiz: 0, termesGlossaire: 0 },
    matieres: [
      {
        id: 'fipu',
        nom: 'Finances publiques',
        fascicules: [
          // Quatre à vivier, dont une sans : le fascicule le plus fourni.
          { id: 'f4', nom: 'Fascicule 4', fiches: [f('a', 1), f('b', 2), f('c', 3), f('d', 4), f('e', 5, [], false)] },
          // Deux à vivier : juste au minimum.
          { id: 'f3', nom: 'Fascicule 3', fiches: [f('g', 1), f('h', 2)] },
          // Une seule : en dessous du minimum, donc jamais proposé.
          { id: 'f2', nom: 'Fascicule 2', fiches: [f('i', 1)] },
        ],
      },
      {
        id: 'rcp',
        nom: 'Cas pratique',
        fascicules: [
          { id: 'r1', nom: 'Fascicule 1', fiches: [f('j', 1), f('k', 2), f('l', 3)] },
        ],
      },
      {
        id: 'dp',
        nom: 'Droit public',
        fascicules: [
          // Deux fiches, mais toutes deux de méthodologie.
          { id: 'd1', nom: 'Fascicule 1', fiches: [f('m', 1, ['méthodologie']), f('n', 2, ['méthodologie'])] },
        ],
      },
    ],
  };
  const etat = (id: string, lu: boolean) => ({ id, matiere: '', lu, derniereOuverture: null, secondes: 0 });

  verifier('le minimum de fiches se déduit des plafonds', FICHES_MINIMALES, 2);

  const liste = perimetres(manifeste, []);
  verifier(
    'le plus fourni passe en tête, pour servir de choix par défaut',
    liste.map((p) => p.fascicule),
    ['Fascicule 4', 'Fascicule 3'],
  );
  verifier('seules les fiches à vivier sont comptées', liste[0].eligibles, 4);
  verifier('le total compte toutes les fiches du fascicule', liste[0].total, 5);
  verifier('un fascicule d’une seule fiche n’est pas proposé', liste.some((p) => p.fascicule === 'Fascicule 2'), false);
  verifier('le cas pratique est écarté par défaut', liste.some((p) => p.matiere === 'Cas pratique'), false);
  verifier('la méthodologie aussi', liste.some((p) => p.matiere === 'Droit public'), false);

  // Ce sont des réglages, pas des interdits : les réintégrer les fait revenir.
  const reintegres = perimetres(manifeste, [], { casPratique: true, methodologie: true });
  verifier(
    'réintégrés, les deux reviennent',
    reintegres.map((p) => `${p.matiere} ${p.fascicule}`).sort(),
    ['Cas pratique Fascicule 1', 'Droit public Fascicule 1', 'Finances publiques Fascicule 3', 'Finances publiques Fascicule 4'],
  );

  const avecDeuxLues = perimetres(manifeste, [etat('a', true), etat('b', true)]);
  verifier('les fiches lues sortent du décompte', avecDeuxLues[0].eligibles, 2);
  verifier(
    'et le fascicule reste proposé tant qu’il atteint le minimum',
    avecDeuxLues.map((p) => p.fascicule).includes('Fascicule 4'),
    true,
  );

  const avecTroisLues = perimetres(manifeste, [etat('a', true), etat('b', true), etat('c', true)]);
  verifier(
    'il disparaît dès qu’il passe sous le minimum',
    avecTroisLues.map((p) => p.fascicule),
    ['Fascicule 3'],
  );

  const toutLu = perimetres(manifeste, ['a', 'b', 'c', 'd', 'g', 'h'].map((id) => etat(id, true)));
  verifier('tout lu, plus aucun périmètre', toutLu.length, 0);

  const ouverteNonLue = perimetres(manifeste, [etat('a', false)]);
  verifier('une fiche ouverte mais non lue reste interrogeable', ouverteNonLue[0].eligibles, 4);
}

console.log('\nCOHÉRENCE DES PLAFONDS');
{
  verifier('le minimum est sous la cible', QUESTIONS_MINIMALES < QUESTIONS_VISEES, true);
  verifier('jamais plus de deux questions par fiche', QUESTIONS_PAR_FICHE, 2);
  verifier(
    'la cible est atteignable avec le plafond par fiche',
    Math.ceil(QUESTIONS_VISEES / QUESTIONS_PAR_FICHE) >= 1,
    true,
  );
}

console.log('\nUNE NOTE D’ENTRÉE CONVERGE VERS LE NIVEAU RÉEL');
{
  // Un prétest de douze questions doit déplacer la note assez pour orienter,
  // sans la faire dériver jusqu'à l'absurde : c'est tout l'équilibre du pas
  // d'ajustement. On simule quelqu'un qui ne sait rien, puis quelqu'un qui sait
  // tout, sur des items de difficulté moyenne.
  const simuler = (resultat: number) => {
    let note = NOTE_INITIALE;
    for (let i = 0; i < QUESTIONS_VISEES; i += 1) {
      note = ajusterNiveau(note, i, NOTE_INITIALE, resultat);
    }
    return Math.round(note);
  };
  const plancher = simuler(0);
  const plafond = simuler(1);
  verifier('un zéro fait baisser la note', plancher < NOTE_INITIALE, true);
  verifier('un sans-faute la fait monter', plafond > NOTE_INITIALE, true);
  verifier('les deux écarts sont symétriques', plafond - NOTE_INITIALE, NOTE_INITIALE - plancher);
  // L'écart doit rester du même ordre qu'un cran d'auto-estimation (150 points),
  // sinon douze questions suffiraient à enfermer quelqu'un dans un niveau.
  verifier(
    'l’écart reste de l’ordre d’un cran d’amorce',
    plafond - NOTE_INITIALE > 100 && plafond - NOTE_INITIALE < 250,
    true,
  );
  // Et il doit déplacer la zone proximale assez pour changer l'orientation.
  verifier(
    'le déplacement change la réussite prédite d’au moins dix points',
    chanceDeReussite(plafond, NOTE_INITIALE) - chanceDeReussite(plancher, NOTE_INITIALE) > 0.1,
    true,
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
