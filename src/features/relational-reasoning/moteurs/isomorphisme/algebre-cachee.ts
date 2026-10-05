/**
 * Moteur « Algèbre cachée » — catégorie Isomorphism.
 *
 * Un verbe inventé relie quelques entités. La personne dit, du seul motif des
 * arêtes, quelle algèbre abstraite ce verbe instancie ; puis, sous l'algèbre
 * ainsi identifiée, prédit une relation qui ne lui a pas été montrée.
 *
 * Deux difficultés ont décidé de la forme de l'énoncé.
 *
 * **Un diagramme de flèches ne suffit pas.** Une chaîne « a → b → c » est
 * compatible avec un ordre comme avec une succession : la première est
 * transitive, la seconde non, et l'absence de la flèche « a → c » ne se lit pas
 * sur un dessin où l'on ne montre que ce qui est vrai. L'énoncé déclare donc
 * explicitement que les paires listées sont les seules — un monde clos sur la
 * relation montrée — ce qui rend la transitivité lisible.
 *
 * **L'étiquette déclarée par le système ne fait pas foi.** Rien ne garantit
 * qu'un tirage exhibe le motif de l'algèbre annoncée : trois paires d'un ordre
 * total peuvent ne montrer qu'une arborescence. Le moteur classe donc ce qui est
 * réellement montré, exige qu'une seule algèbre le décrive, et rejette le
 * tirage si la classification s'écarte de l'algèbre déclarée.
 *
 * ## La trace : deux propriétés, leurs témoins, puis l'élimination
 *
 * On ne classe pas un motif en le reconnaissant, on le classe en testant des
 * propriétés. La trace fait donc exactement cela : elle teste la **symétrie**,
 * puis la **transitivité**, en nommant chaque fois la paire ou l'enchaînement
 * qui tranche — « Calix gorpe Brume est listé, Brume gorpe Calix ne l'est pas ».
 * Un verdict qui se vérifie en relisant deux lignes de l'énoncé.
 *
 * Puis elle écarte les six autres algèbres, chacune par **l'exigence qu'elle ne
 * satisfait pas**. Les exigences sont déclarées dans `noyaux/proprietes.ts`, et
 * les prédicats de classification en sont dérivés : une seconde liste écrite à
 * côté aurait fini par ne plus concorder, et la correction aurait alors expliqué
 * un classement que le solveur ne faisait pas.
 *
 * Le second temps — la prédiction sous l'algèbre identifiée — n'a pas de trace :
 * le type `suite` n'en porte pas, et l'écran de correction n'existe pas encore.
 * C'est noté comme tel plutôt que tu.
 *
 * Le second temps n'est posé que pour les algèbres **transitives**, où ce qui
 * découle d'un fait nouveau se calcule par simple clôture. Pour une opposition,
 * l'implication passe par la relation complémentaire et sortirait du verbe
 * montré : mieux vaut ne pas poser la question que la poser mal.
 */
import {
  classer,
  exigenceManquante,
  INTITULES,
  proprietes,
  temoinAsymetrie,
  temoinIntransitivite,
} from '../../noyaux/proprietes';
import { texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Alea, AlgebreAbstraite, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const VERBES = ['gorpe', 'zilme', 'traque', 'vandre', 'norfe', 'quibe'];

const TIRAGES = 60;

/** Clôture transitive, et symétrique quand la relation l'est. */
function cloture(paires: [string, string][], symetrique: boolean): Set<string> {
  const presentes = new Set(paires.map(([a, b]) => `${a}|${b}`));
  let change = true;
  while (change) {
    change = false;
    for (const clef of [...presentes]) {
      const [a, b] = clef.split('|');
      if (symetrique && !presentes.has(`${b}|${a}`)) {
        presentes.add(`${b}|${a}`);
        change = true;
      }
      for (const autre of [...presentes]) {
        const [c, d] = autre.split('|');
        if (b !== c || a === d) continue;
        if (!presentes.has(`${a}|${d}`)) {
          presentes.add(`${a}|${d}`);
          change = true;
        }
      }
    }
  }
  return presentes;
}

const TRANSITIVES: AlgebreAbstraite[] = ['ordre', 'equivalence', 'ascendance'];

export const algebreCachee: Moteur = {
  id: 'algebre-cachee',
  nom: 'Algèbre cachée',
  categorie: 'isomorphisme',
  resume: "Un verbe inventé relie des entités : dites quelle algèbre il instancie.",
  regimes: ['algebre', 'clos'],

  engendrer(systeme: Systeme, difficulte: number, alea: Alea): Item | null {
    const candidates = systeme.relations.filter((r) => r.algebre);
    if (!candidates.length) return null;

    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(4, difficulte + 3), alea);
      const modele = instance.modele;
      if (!modele || instance.entites.length < 4) continue;

      // Une entité est mise de côté : elle servira au second temps, et ne doit
      // donc apparaître dans aucune paire du premier.
      const reserve = instance.entites[instance.entites.length - 1];
      const montrees = instance.entites.slice(0, -1);

      const relation = alea.un(candidates);
      const symetrique = systeme.converse(relation.id) === relation.id;

      // **Les deux sens sont listés pour une relation symétrique.** La symétrie
      // n'est pas une information à cacher : c'est elle qui distingue une
      // équivalence d'un ordre, et sans elle l'énoncé ne porterait pas sa
      // réponse. Un premier jet n'affichait qu'un sens, et une équivalence s'y
      // lisait comme un ordre total — c'est ce que « npm run
      // essais:relationnel » a pris au vol, en reclassant le motif affiché.
      const paires: [string, string][] = [];
      for (const a of montrees) {
        for (const b of montrees) {
          if (a === b) continue;
          if (systeme.relationDansModele(modele, a, b) !== relation.id) continue;
          paires.push([a, b]);
        }
      }

      // On ne parle que des entités effectivement reliées : une entité citée
      // sans qu'aucune paire la concerne changerait la lecture de la totalité et
      // de la bipartition, sans rien apporter à l'énoncé.
      const enJeu = [...new Set(paires.flat())];
      if (enJeu.length < 3) continue;

      const exhibee = classer(enJeu, paires);
      if (!exhibee || exhibee !== relation.algebre) continue;

      const verbe = alea.un(VERBES);
      const lignes = paires.map(([a, b]) => `${a} ${verbe} ${b}.`);

      const options: Option[] = alea.melanger(
        (Object.keys(INTITULES) as AlgebreAbstraite[]).map((nom) => ({ texte: INTITULES[nom] })),
      );
      const bonne = options.findIndex((option) => option.texte === INTITULES[exhibee]);

      // ----- La trace : les propriétés, puis l'élimination ---------------
      const p = proprietes(enJeu, paires);
      const carnet = journal();
      const rang = (a: string, b: string) =>
        paires.findIndex(([x, y]) => x === a && y === b);

      const asym = temoinAsymetrie(paires);
      carnet.etape({
        utilise: asym
          ? [ref('premisse', rang(asym[0], asym[1]))]
          : paires.slice(0, 2).map((_, i) => ref('premisse', i)),
        loi: 'symétrie',
        produit: p.symetrique ? 'symétrique' : 'asymétrique',
        legende: asym
          ? `« ${asym[0]} ${verbe} ${asym[1]} » est listé, et « ${asym[1]} ${verbe} ` +
            `${asym[0]} » ne l’est pas. Comme les paires listées sont les seules, la relation ` +
            'ne joue que dans un sens : toutes les algèbres symétriques sont écartées.'
          : `Chaque paire listée figure dans les deux sens — « ${paires[0][0]} ${verbe} ` +
            `${paires[0][1]} » comme « ${paires[0][1]} ${verbe} ${paires[0][0]} ». La relation ` +
            'est symétrique, ce qui écarte toutes les algèbres orientées.',
        surbrillance: (asym ?? paires[0]).map((e) => ref('entite', e)),
      });

      const intrans = temoinIntransitivite(paires);
      carnet.etape({
        utilise: intrans
          ? [ref('premisse', rang(intrans.x, intrans.y)), ref('premisse', rang(intrans.y, intrans.z))]
          : paires.map((_, i) => ref('premisse', i)),
        loi: 'transitivité',
        produit: p.transitive ? 'transitive' : 'non transitive',
        legende: intrans
          ? `« ${intrans.x} ${verbe} ${intrans.y} » et « ${intrans.y} ${verbe} ${intrans.z} » ` +
            `s’enchaînent, et pourtant « ${intrans.x} ${verbe} ${intrans.z} » n’est pas listé. ` +
            'La relation n’est donc pas transitive — et c’est bien lisible ici, puisque les ' +
            'paires listées sont les seules.'
          : 'Chaque fois que deux paires s’enchaînent, la paire directe figure aussi dans la ' +
            'liste : la relation est transitive.',
        surbrillance: intrans
          ? [intrans.x, intrans.y, intrans.z].map((e) => ref('entite', e))
          : paires[0].map((e) => ref('entite', e)),
      });

      /*
       * L'élimination, algèbre par algèbre, chacune par l'exigence qui lui
       * manque. On ne dit pas « ce n'est pas une équivalence » mais « une
       * équivalence exige d'être symétrique, et ce motif ne l'est pas » : la
       * seconde se vérifie, la première s'accepte ou se refuse.
       */
      const ecartees = (Object.keys(INTITULES) as AlgebreAbstraite[])
        .filter((nom) => nom !== exhibee)
        .map((nom) => ({ nom, manque: exigenceManquante(nom, p) }))
        .filter((x) => x.manque !== null);

      carnet.etape({
        utilise: [ref('option', bonne)],
        loi: 'élimination',
        produit: INTITULES[exhibee],
        legende:
          `Ces deux propriétés, avec la forme du motif, ne laissent qu’une algèbre : ` +
          `${INTITULES[exhibee]}. Les autres tombent chacune sur une exigence — ` +
          ecartees
            .map(
              ({ nom, manque }) =>
                `${INTITULES[nom].split(' —')[0]} exige ` +
                `${manque!.attendu ? 'd’être' : 'de ne pas être'} ${manque!.mot}`,
            )
            .join(' ; ') +
          '.',
        surbrillance: [ref('option', bonne)],
      });

      const item: Item = {
        moteur: 'algebre-cachee',
        systeme: systeme.id,
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
        consigne: `Quelle algèbre le verbe « ${verbe} » instancie-t-il ?`,
        enonce: [
          texte(
            `Voici tout ce que l’on sait de « ${verbe} » entre ${enJeu.join(', ')}. ` +
              'Les paires listées sont les seules : toute paire absente de la liste n’est ' +
              'pas dans la relation.',
          ),
          { type: 'faits', phrases: lignes },
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `Le motif est ${INTITULES[exhibee]}. ` +
          (symetrique
            ? 'La relation joue dans les deux sens, ce qui écarte toutes les algèbres orientées. '
            : 'La relation ne joue que dans un sens, ce qui écarte les algèbres symétriques. ') +
          (TRANSITIVES.includes(exhibee)
            ? 'Et elle est transitive : chaque fois que deux paires s’enchaînent, la paire ' +
              'directe figure aussi dans la liste.'
            : 'Et elle n’est pas transitive : deux paires s’enchaînent sans que la ' +
              'paire directe figure dans la liste.'),
      };

      // Second temps, réservé aux algèbres transitives : ce qui découle d'un
      // fait nouveau s'y calcule par clôture, sans sortir du verbe montré.
      if (TRANSITIVES.includes(exhibee)) {
        const point = alea.un(enJeu);
        const avec: [string, string][] = [...paires, [reserve, point]];
        const fermee = cloture(avec, symetrique);
        const enonces = new Set(avec.map(([a, b]) => `${a}|${b}`));

        const decoulent = enJeu.filter(
          (cible) => cible !== point && fermee.has(`${reserve}|${cible}`) && !enonces.has(`${reserve}|${cible}`),
        );
        const necoulentPas = enJeu.filter(
          (cible) => cible !== point && !fermee.has(`${reserve}|${cible}`),
        );

        if (decoulent.length >= 1 && necoulentPas.length >= 2) {
          const vraie = alea.un(decoulent);
          const fausses = alea.plusieurs(necoulentPas, Math.min(3, necoulentPas.length));
          const choix: Option[] = alea.melanger([
            { texte: `${reserve} ${verbe} ${vraie}` },
            ...fausses.map((cible) => ({ texte: `${reserve} ${verbe} ${cible}` })),
          ]);
          item.suite = {
            consigne: 'Sous cette algèbre, quel énoncé découle nécessairement ?',
            enonce: [
              texte(
                `On apprend que ${reserve} ${verbe} ${point}. Les paires du premier temps ` +
                  'restent valables.',
              ),
            ],
            reponse: {
              genre: 'unique',
              options: choix,
              bonne: choix.findIndex((option) => option.texte === `${reserve} ${verbe} ${vraie}`),
            },
            explication:
              `${reserve} ${verbe} ${point}, et ${point} ${verbe} ${vraie} découle du premier ` +
              `temps : la transitivité donne ${reserve} ${verbe} ${vraie}. Les autres énoncés ne ` +
              'se déduisent d’aucun enchaînement.',
          };
        }
      }

      return item;
    }
    return null;
  },
};
