/**
 * La matière commune est-elle vraiment proposée en séance, dans les trois
 * parcours DGFiP ?
 *
 *   npm run essais:matiere-commune
 *
 * ## Le défaut que cet essai existe pour empêcher
 *
 * Une fiche rangée sous la racine commune est servie à plusieurs parcours : le
 * registre le déclare par `racinesPartagees`, et `essais:parcours-des-fiches`
 * le vérifie jusqu'au manifeste. Mais être SERVIE à un parcours et être
 * PROPOSÉE par une séance sont deux choses, et rien ne les reliait.
 *
 * La séance passe par `fichesDuTheme`, qui rapproche une fiche de son thème
 * **par le nom exact de la matière**, à la casse près. Il suffit donc qu'aucun
 * thème du parcours ne porte ce nom pour que la fiche existe dans l'arbre,
 * compte dans les totaux, et ne soit jamais proposée. C'est exactement l'état
 * dans lequel se trouvait le concours A+ le 25 octobre : il servait la racine
 * commune, et aucun de ses quatre thèmes ne nommait « Organisation de la
 * DGFiP ». Le contenu aurait été livré pour personne.
 *
 * Ce défaut ne se voit ni à l'écran — il n'affiche rien plutôt qu'une erreur —,
 * ni dans `essais:parcours-des-fiches`, qui s'arrête au manifeste, ni dans
 * `essais:registre-dgfip`, qui rapproche les intitulés du document des
 * programmes sans jamais regarder une fiche.
 *
 * ## Ce qu'il mesure
 *
 * Pour chacun des trois parcours DGFiP : qu'un thème porte la matière commune,
 * que ce thème soit dans la rotation par défaut — sinon la séance ne le
 * proposerait qu'à qui va le chercher —, et que `fichesDuTheme`, la fonction
 * réelle de la planification, rende bien une fiche de cette matière quand le
 * parcours courant est celui-là.
 *
 * Et, de l'autre côté : que l'INSP ne porte pas la matière et ne serve pas la
 * racine commune. Une matière servie à tout le monde n'aurait plus besoin
 * d'être partagée.
 *
 * ## Ce qu'il ne mesure pas
 *
 * Il ne mesure pas que la bibliothèque FILTRE par parcours — elle ne le fait
 * pas encore, rien dans `src/` ne lit `parcoursServis`, et c'est écrit en toutes
 * lettres dans `build-content.mjs`. Les fiches de la racine commune
 * apparaissent donc aussi dans l'arbre de l'INSP. Cet essai ne fixe pas cet
 * état : il ne parle que de ce que la séance propose.
 */
import { PARCOURS, RACINE_COMMUNE, racinesDuParcours } from '../src/lib/parcours/registre.ts';
import { fichesDuTheme } from '../src/lib/planification.ts';

const MATIERE = 'Organisation de la DGFiP';
const PARCOURS_DGFIP = ['dgfip-b', 'dgfip-a', 'dgfip-ap'];

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

/*
   LE PARCOURS COURANT SE LIT DANS « localStorage », ET IL N'Y EN A PAS ICI.

   `parcoursCourant()` lit la préférence dans `localStorage` et retombe sur
   l'INSP quand la lecture jette — ce qui est le cas sous Node. Sans ce
   faux-semblant, `fichesDuTheme` résoudrait donc TOUJOURS les thèmes de
   l'INSP, et l'essai ne mesurerait pas ce qu'il annonce.

   On pose donc un « localStorage » minimal, dont la valeur change à chaque
   parcours examiné. C'est la seule façon d'appeler la vraie fonction de la
   planification plutôt que d'en réécrire la règle ici : une règle réécrite
   resterait verte le jour où la vraie changerait.
*/
let parcoursOuvert = '';
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (cle: string) => (cle === 'revinsp.parcours' ? parcoursOuvert : null),
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage;

/** Un manifeste minimal portant une seule fiche, dans la matière commune. */
const manifesteAvecLaMatiereCommune = (nomMatiere: string) =>
  ({
    genereLe: new Date().toISOString(),
    matieres: [
      {
        id: 'mat',
        nom: nomMatiere,
        fascicules: [
          {
            id: 'fas',
            nom: 'Fascicule 2 — Les directions locales',
            fiches: [
              {
                id: 'fiche-temoin',
                titre: 'La direction départementale',
                ordre: 1,
                tags: [],
                nbFlashcards: 0,
                nbQuiz: 0,
                nbMots: 1200,
                aCours: true,
                aFiche: true,
                aPodcast: false,
                aPretest: true,
                nbParties: 7,
              },
            ],
          },
        ],
      },
    ],
    totaux: { fiches: 1, flashcards: 0, quiz: 0, termesGlossaire: 0, podcasts: 0, qcmDgfip: 0 },
    rubriquesDgfip: [],
  }) as unknown as Parameters<typeof fichesDuTheme>[0];

const parcoursPar = (id: string) => PARCOURS.find((p) => p.id === id);

console.log('\nLA MATIÈRE COMMUNE EST PORTÉE PAR UN THÈME, DANS LES TROIS PARCOURS DGFIP');

for (const id of PARCOURS_DGFIP) {
  const p = parcoursPar(id);
  v(`${id} : le parcours existe au registre`, Boolean(p), true);
  if (!p) continue;

  const porteurs = p.themes.filter((t) => t.matieres.includes(MATIERE));
  v(
    `${id} : un thème porte « ${MATIERE} » — ${porteurs.map((t) => t.id).join(', ') || 'aucun'}`,
    porteurs.length >= 1,
    true,
  );
  if (porteurs.length === 0) continue;

  v(
    `${id} : ce thème est dans la rotation par défaut`,
    porteurs.filter((t) => p.rotationParDefaut.includes(t.id)).map((t) => t.id),
    porteurs.map((t) => t.id),
  );

  v(`${id} : il sert la racine commune`, racinesDuParcours(p).includes(RACINE_COMMUNE), true);

  /* La fonction réelle de la séance, avec ce parcours pour parcours courant. */
  parcoursOuvert = id;
  for (const t of porteurs) {
    const proposees = fichesDuTheme(manifesteAvecLaMatiereCommune(MATIERE), t.id);
    v(
      `${id} : « ${t.id} » propose en séance la fiche de la matière commune`,
      proposees.map((f) => f.id),
      ['fiche-temoin'],
    );
  }
}

console.log('\nET L’INSP NE LA PORTE PAS, SINON IL N’Y AURAIT RIEN À PARTAGER');

const insp = parcoursPar('insp');
v('insp : le parcours existe au registre', Boolean(insp), true);
if (insp) {
  v(
    'insp : aucun thème ne porte la matière commune',
    insp.themes.filter((t) => t.matieres.includes(MATIERE)).map((t) => t.id),
    [],
  );
  v('insp : il ne sert pas la racine commune', racinesDuParcours(insp).includes(RACINE_COMMUNE), false);
  parcoursOuvert = 'insp';
  const porteursDgfip = parcoursPar('dgfip-a')!.themes.filter((t) => t.matieres.includes(MATIERE));
  v(
    'insp : le thème DGFiP qui porte la matière ne lui est pas résolu',
    porteursDgfip.flatMap((t) =>
      fichesDuTheme(manifesteAvecLaMatiereCommune(MATIERE), t.id).map((f) => f.id),
    ),
    [],
  );
}

console.log('\nET LE RAPPROCHEMENT SE FAIT SUR LE NOM EXACT, CE QUI EST FRAGILE ET DOIT ÊTRE DIT');

parcoursOuvert = 'dgfip-a';
const theme1 = parcoursPar('dgfip-a')!.themes.find((t) => t.matieres.includes(MATIERE))!;
v(
  'un nom de matière voisin n’est pas rapproché — « Organisation de la DGFIP » n’est pas servi',
  fichesDuTheme(manifesteAvecLaMatiereCommune('Organisation de la DGFiP de 2026'), theme1.id).map(
    (f) => f.id,
  ),
  [],
);
v(
  'mais la casse seule ne fait pas échouer le rapprochement',
  fichesDuTheme(manifesteAvecLaMatiereCommune('organisation de la dgfip'), theme1.id).map(
    (f) => f.id,
  ),
  ['fiche-temoin'],
);

console.log(
  rouges === 0 ? '\n\u001b[32m✓ tout est vert\u001b[0m' : `\n\u001b[31m✗ ${rouges} rouge${rouges > 1 ? 's' : ''}\u001b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
