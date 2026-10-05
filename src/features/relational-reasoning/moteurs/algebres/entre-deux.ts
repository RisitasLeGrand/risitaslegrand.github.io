/**
 * Moteur « Entre-deux » — catégorie New algebras.
 *
 * « B est entre A et C » est une relation **ternaire**, et symétrique par
 * miroir : elle ne dit pas dans quel sens on parcourt la ligne. C'est ce qui la
 * rend instructive — le réflexe d'y lire un ordre échoue, puisque « B entre A et
 * C » et « B entre C et A » sont le même énoncé.
 *
 * La question ne porte pas sur ce qui est vrai dans la disposition cachée, mais
 * sur ce que les énoncés **impliquent** : un énoncé peut être vrai dans la
 * disposition tirée tout en restant ouvert au vu des seuls faits donnés. La
 * classification se fait donc par énumération de toutes les dispositions
 * compatibles — au plus cinq mille quarante pour sept entités, ce qui est
 * immédiat et à l'abri d'une erreur de raisonnement.
 *
 * ## La trace est l'énumération elle-même
 *
 * Puisque la réponse se calcule en énumérant les dispositions compatibles, la
 * correction montre cette énumération **se resserrer** : chaque fait donné
 * élimine des dispositions, et l'on voit le compte descendre. Puis elle exhibe
 * des **témoins** — une disposition concrète qui vérifie l'énoncé, une qui ne le
 * vérifie pas. C'est ce qui rend le verdict « reste ouvert » vérifiable à l'œil
 * au lieu d'être affirmé : on peut lire les deux lignes et constater qu'elles
 * satisfont toutes deux les faits donnés.
 *
 * Restreint pour l'instant aux systèmes à un seul axe. Sur un plan ou dans
 * l'espace, l'entre-deux suppose la colinéarité et demande un autre générateur :
 * c'est prévu en phase 8c.
 */
import { texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 40;

/** Toutes les permutations d'une liste, au plus 5 040 pour sept entités. */
function* permutations<T>(liste: readonly T[]): Generator<T[]> {
  if (liste.length <= 1) {
    yield [...liste];
    return;
  }
  for (let i = 0; i < liste.length; i += 1) {
    const reste = [...liste.slice(0, i), ...liste.slice(i + 1)];
    for (const suite of permutations(reste)) yield [liste[i], ...suite];
  }
}

type Triplet = readonly [string, string, string];

/** « milieu » est-il entre « gauche » et « droite » dans cette disposition ? */
function entre(ordre: readonly string[], [gauche, milieu, droite]: Triplet): boolean {
  const g = ordre.indexOf(gauche);
  const m = ordre.indexOf(milieu);
  const d = ordre.indexOf(droite);
  return (g < m && m < d) || (d < m && m < g);
}

const INTITULES = [
  'il découle nécessairement des faits donnés',
  'il les contredit : aucune disposition compatible ne le vérifie',
  'il reste ouvert : certaines dispositions le vérifient, d’autres non',
];

export const entreDeux: Moteur = {
  id: 'entre-deux',
  nom: 'Entre-deux',
  categorie: 'algebres',
  resume: 'Une relation à trois termes, sans sens de parcours : que peut-on en déduire ?',
  regimes: ['algebre'],

  // Un axe unique, le temps que la version colinéaire du plan soit écrite.
  compatible: (systeme: Systeme) => systeme.axes?.length === 1,

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(4, Math.min(echelon + 2, 9)), alea);
      const entites = instance.entites;
      const coordonnees = instance.modele?.coordonnees;
      if (!coordonnees || entites.length < 4 || entites.length > 7) continue;

      const dispositionReelle = [...entites].sort(
        (x, y) => (coordonnees[x]?.[0] ?? 0) - (coordonnees[y]?.[0] ?? 0),
      );

      // Les faits donnés sont vrais dans la disposition tirée, ce qui garantit
      // qu'au moins une disposition les satisfait.
      const tousLesTriplets: Triplet[] = [];
      for (const g of entites) {
        for (const m of entites) {
          for (const d of entites) {
            // Le miroir est le même énoncé : on ne garde qu'un représentant.
            if (g === m || m === d || g === d || g > d) continue;
            tousLesTriplets.push([g, m, d]);
          }
        }
      }
      const vrais = tousLesTriplets.filter((t) => entre(dispositionReelle, t));
      if (vrais.length < 3) continue;

      const combien = Math.min(vrais.length - 1, 2 + Math.floor(echelon / 3));
      const donnes = alea.plusieurs(vrais, combien);

      // Énumérées une seule fois : la trace les reparcourt fait par fait plus
      // bas, et les réengendrer coûterait cinq mille permutations de plus par
      // tirage, dans la boucle de génération.
      const toutes = [...permutations(entites)];
      const compatibles = toutes.filter((ordre) => donnes.every((t) => entre(ordre, t)));
      if (compatibles.length < 2) continue;

      const restants = tousLesTriplets.filter(
        (t) => !donnes.some((d) => d[0] === t[0] && d[1] === t[1] && d[2] === t[2]),
      );
      if (!restants.length) continue;

      const question = alea.un(restants);
      const verifie = compatibles.filter((ordre) => entre(ordre, question)).length;
      const verdict = verifie === compatibles.length ? 0 : verifie === 0 ? 1 : 2;

      const options: Option[] = INTITULES.map((intitule) => ({ texte: intitule }));

      const phrase = (t: Triplet) => `${t[1]} est entre ${t[0]} et ${t[2]}.`;

      // ----- La trace : l'énumération qui se resserre, puis les témoins ---
      const carnet = journal();
      let restantes: readonly (readonly string[])[] = toutes;
      donnes.forEach((donne, indice) => {
        const avant = restantes.length;
        restantes = restantes.filter((ordre) => entre(ordre, donne));
        carnet.etape({
          utilise: [ref('premisse', indice)],
          loi: indice === 0 ? 'énumération' : 'élimination',
          produit: `${restantes.length} disposition${restantes.length > 1 ? 's' : ''} compatible${restantes.length > 1 ? 's' : ''}`,
          legende:
            `Le fait ${indice + 1} — ${phrase(donne).replace(/\.$/, '')} — élimine les ` +
            `dispositions où ${donne[1]} n’est pas entre ${donne[0]} et ${donne[2]} : il en ` +
            `reste ${restantes.length} sur ${avant}.`,
          surbrillance: [
            ref('premisse', indice),
            ...donne.map((entite) => ref('entite', entite)),
          ],
        });
      });

      const pour = compatibles.find((ordre) => entre(ordre, question));
      const contre = compatibles.find((ordre) => !entre(ordre, question));
      const enLigne = (ordre: readonly string[]) => ordre.join(' – ');
      carnet.etape({
        utilise: [ref('option', verdict)],
        produit: INTITULES[verdict],
        legende:
          `Parmi ces ${compatibles.length} dispositions, ${verifie} vérifie` +
          `${verifie > 1 ? 'nt' : ''} l’énoncé. ` +
          (verdict === 0
            ? `Toutes, donc : l’énoncé découle des faits. Par exemple ${enLigne(pour!)} les ` +
              'satisfait, et aucune disposition compatible ne le démentirait.'
            : verdict === 1
              ? `Aucune : l’énoncé les contredit. ${enLigne(contre!)} satisfait les faits ` +
                `donnés et pourtant ${question[1]} n’y est pas entre ${question[0]} et ` +
                `${question[2]}.`
              : `Voici les deux témoins : ${enLigne(pour!)} satisfait les faits et l’énoncé ; ` +
                `${enLigne(contre!)} satisfait les faits mais non l’énoncé. Les deux étant ` +
                'compatibles, les faits ne tranchent pas.'),
        surbrillance: [
          ref('option', verdict),
          ...question.map((entite) => ref('entite', entite)),
        ],
      });

      return {
        moteur: 'entre-deux',
        systeme: systeme.id,
        consigne: `Que vaut l’énoncé « ${phrase(question).replace(/\.$/, '')} » ?`,
        enonce: [
          texte(
            `${entites.length} entités sont rangées sur une ligne, dans un ordre qu’on ne ` +
              'vous donne pas. On sait seulement ceci — et « X est entre Y et Z » ne dit pas ' +
              'dans quel sens la ligne se parcourt :',
          ),
          { type: 'faits', phrases: donnes.map(phrase) },
        ],
        reponse: { genre: 'unique', options, bonne: verdict },
        explication:
          `Parmi les ${compatibles.length} dispositions compatibles avec les faits donnés, ` +
          `${verifie} vérifie${verifie > 1 ? 'nt' : ''} cet énoncé. ` +
          (verdict === 0
            ? 'Il découle donc nécessairement des faits.'
            : verdict === 1
              ? 'Aucune ne le vérifie : il les contredit.'
              : 'Il reste donc ouvert — vrai dans certaines dispositions, faux dans d’autres, ' +
                'et les faits donnés ne permettent pas de trancher.'),
        trace: carnet.sceller({ genre: 'unique', indice: verdict }),
      };
    }
    return null;
  },
};
