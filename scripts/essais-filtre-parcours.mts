/**
 * La bibliothèque ne montre que les fiches du parcours ouvert.
 *
 *   npm run essais:filtre-parcours
 *
 * ## Le défaut que ce filtre corrige, et que cet essai garde fermé
 *
 * Le build inscrit au manifeste la racine de chaque fiche et les parcours
 * qu'elle sert. Jusqu'au 25 octobre, **rien ne lisait ces champs** : le type
 * `FicheResume` ne les déclarait même pas. Les quatre fiches d'« Organisation
 * de la DGFiP », rangées sous la racine commune des trois parcours DGFiP,
 * apparaissaient donc aussi dans l'arbre de l'INSP, qui ne les sert pas — et
 * réciproquement, les 427 fiches de l'INSP s'affichaient à qui prépare la
 * DGFiP.
 *
 * ## Ce qu'il mesure
 *
 * Les deux sens du filtre, parce qu'un filtre qui ne garde rien est aussi faux
 * qu'un filtre qui ne retire rien : ce que l'INSP ne doit plus voir, et ce que
 * chacun des trois parcours DGFiP doit voir — une fois, et une seule.
 *
 * Il mesure aussi les deux refus de trancher : une fiche sans
 * `parcoursServis` mais avec une racine est jugée par le registre ; une fiche
 * sans l'un ni l'autre est GARDÉE. Un manifeste publié avant le partage des
 * matières ne porte pas ces champs, et il doit continuer de remplir une
 * bibliothèque plutôt que de la vider.
 *
 * Et les totaux, enfin, parce qu'un manifeste filtré qui garderait les totaux
 * d'origine annoncerait « 427 fiches » à qui n'en voit que quatre, et
 * l'estimation de niveau se calculerait sur un dénominateur faux.
 */
import {
  ficheServieAu,
  manifestePourLeParcours,
} from '../src/lib/parcours/filtre-du-manifeste.ts';
import { RACINE_COMMUNE, parcoursServisParLaRacine } from '../src/lib/parcours/registre.ts';
import type { Manifeste } from '../src/lib/contenu.ts';

let rouges = 0;
function v(intitule: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`  ${ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m'} ${intitule}`);
  if (!ok) {
    rouges += 1;
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
}

const fiche = (
  id: string,
  champs: Partial<{ racine: string; parcoursServis: string[]; nbFlashcards: number; nbQuiz: number }>,
) =>
  ({
    id,
    titre: `Fiche ${id}`,
    ordre: 1,
    tags: [],
    nbFlashcards: champs.nbFlashcards ?? 0,
    nbQuiz: champs.nbQuiz ?? 0,
    nbMots: 1000,
    aCours: true,
    aFiche: true,
    aPodcast: false,
    aPretest: false,
    nbParties: 0,
    ...(champs.racine === undefined ? {} : { racine: champs.racine }),
    ...(champs.parcoursServis === undefined ? {} : { parcoursServis: champs.parcoursServis }),
  }) as Manifeste['matieres'][number]['fascicules'][number]['fiches'][number];

const DGFIP = parcoursServisParLaRacine(RACINE_COMMUNE);

const manifeste: Manifeste = {
  genereLe: '2026-10-25T00:00:00.000Z',
  matieres: [
    {
      id: 'm-insp',
      nom: 'Droit public',
      fascicules: [
        {
          id: 'f-insp',
          nom: 'Fascicule 1',
          fiches: [
            fiche('insp-1', { racine: '', parcoursServis: ['insp'], nbFlashcards: 5, nbQuiz: 2 }),
            fiche('insp-2', { racine: '', parcoursServis: ['insp'], nbFlashcards: 3, nbQuiz: 1 }),
          ],
        },
      ],
    },
    {
      id: 'm-commun',
      nom: 'Organisation de la DGFiP',
      fascicules: [
        {
          id: 'f-commun',
          nom: 'Fascicule 2 — Les directions locales',
          fiches: [
            fiche('commun-1', { racine: RACINE_COMMUNE, parcoursServis: DGFIP, nbFlashcards: 20, nbQuiz: 8 }),
            /* Sans la liste, mais avec la racine : c'est au registre de juger. */
            fiche('commun-2', { racine: RACINE_COMMUNE, nbFlashcards: 18, nbQuiz: 8 }),
          ],
        },
      ],
    },
    {
      id: 'm-ancienne',
      nom: 'Matière d’un manifeste ancien',
      fascicules: [
        { id: 'f-ancienne', nom: 'Fascicule sans champ', fiches: [fiche('vieille-1', {})] },
      ],
    },
  ],
  totaux: { fiches: 5, flashcards: 46, quiz: 19, termesGlossaire: 560, podcasts: 0, qcmDgfip: 540 },
};

const nomsVus = (m: Manifeste) => m.matieres.map((x) => x.nom);
const idsVus = (m: Manifeste) =>
  m.matieres.flatMap((x) => x.fascicules.flatMap((f) => f.fiches.map((fi) => fi.id)));

console.log('\nCE QUE L’INSP NE VOIT PLUS, ET CE QU’IL VOIT ENCORE');

const pourInsp = manifestePourLeParcours(manifeste, 'insp');
v('la matière commune disparaît entièrement de l’arbre de l’INSP', nomsVus(pourInsp), [
  'Droit public',
  'Matière d’un manifeste ancien',
]);
v('aucune fiche de la racine commune ne subsiste', idsVus(pourInsp), ['insp-1', 'insp-2', 'vieille-1']);
v(
  'et ses propres fiches sont toutes là',
  idsVus(pourInsp).filter((id) => id.startsWith('insp-')),
  ['insp-1', 'insp-2'],
);

console.log('\nCE QUE CHAQUE PARCOURS DGFIP VOIT — UNE FOIS, ET UNE SEULE');

for (const id of DGFIP) {
  const vu = manifestePourLeParcours(manifeste, id);
  v(`${id} : voit les deux fiches de la racine commune`, idsVus(vu).filter((x) => x.startsWith('commun-')), [
    'commun-1',
    'commun-2',
  ]);
  v(
    `${id} : chaque fiche une seule fois`,
    idsVus(vu).length - new Set(idsVus(vu)).size,
    0,
  );
  v(`${id} : ne voit pas les fiches de l’INSP`, idsVus(vu).filter((x) => x.startsWith('insp-')), []);
}

console.log('\nCE QU’ON NE SAIT PAS NE VIDE PAS LA BIBLIOTHÈQUE');

v(
  'une fiche sans « parcoursServis » mais avec une racine est jugée par le registre',
  ficheServieAu(fiche('x', { racine: RACINE_COMMUNE }), 'insp'),
  false,
);
v(
  'et elle est servie aux parcours que cette racine sert',
  DGFIP.map((id) => ficheServieAu(fiche('x', { racine: RACINE_COMMUNE }), id)),
  DGFIP.map(() => true),
);
v(
  'une fiche sans racine ni liste est gardée pour tous les parcours',
  ['insp', ...DGFIP].map((id) => ficheServieAu(fiche('x', {}), id)),
  ['insp', ...DGFIP].map(() => true),
);
v(
  'une liste vide ne vaut pas « personne » : la fiche est gardée',
  ficheServieAu(fiche('x', { parcoursServis: [] }), 'insp'),
  true,
);

console.log('\nLES TOTAUX SUIVENT, SINON ILS MENTENT');

v('INSP : trois fiches retenues', pourInsp.totaux.fiches, 3);
v('INSP : les cartes des seules fiches retenues', pourInsp.totaux.flashcards, 8);
v('INSP : les questions des seules fiches retenues', pourInsp.totaux.quiz, 3);
v('INSP : le glossaire n’est pas rangé par parcours, il ne bouge pas', pourInsp.totaux.termesGlossaire, 560);
v('INSP : la banque de QCM non plus', pourInsp.totaux.qcmDgfip, 540);

const pourB = manifestePourLeParcours(manifeste, 'dgfip-b');
v('DGFiP B : trois fiches — les deux communes et celle du manifeste ancien', pourB.totaux.fiches, 3);
v('DGFiP B : 38 cartes, celles des deux fiches communes, la vieille n’en portant aucune', pourB.totaux.flashcards, 38);

console.log('\nUN FASCICULE OU UNE MATIÈRE LAISSÉS VIDES DISPARAISSENT');

const vide: Manifeste = {
  ...manifeste,
  matieres: [
    {
      id: 'm',
      nom: 'Matière',
      fascicules: [
        { id: 'f1', nom: 'Fascicule vidé', fiches: [fiche('a', { racine: RACINE_COMMUNE })] },
        { id: 'f2', nom: 'Fascicule gardé', fiches: [fiche('b', { racine: '' })] },
      ],
    },
  ],
};
const videPourInsp = manifestePourLeParcours(vide, 'insp');
v(
  'le fascicule dont toutes les fiches sont écartées n’apparaît plus',
  videPourInsp.matieres[0]?.fascicules.map((f) => f.nom),
  ['Fascicule gardé'],
);
v(
  'et la matière dont tous les fascicules sont vidés non plus',
  manifestePourLeParcours(
    { ...vide, matieres: [{ ...vide.matieres[0], fascicules: [vide.matieres[0].fascicules[0]] }] },
    'insp',
  ).matieres.length,
  0,
);

console.log('\nLE MANIFESTE D’ORIGINE N’EST PAS TOUCHÉ');

v('la matière commune est toujours dans le manifeste de départ', nomsVus(manifeste).length, 3);
v('et ses fiches aussi', idsVus(manifeste).length, 5);

console.log(
  rouges === 0 ? '\n\u001b[32m✓ tout est vert\u001b[0m' : `\n\u001b[31m✗ ${rouges} rouge${rouges > 1 ? 's' : ''}\u001b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
