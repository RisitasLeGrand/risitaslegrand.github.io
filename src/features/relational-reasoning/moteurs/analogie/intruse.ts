/**
 * Moteur « Analogie intruse » — catégorie Analogie.
 *
 * Quatre paires d'entités sont présentées. Trois entretiennent la **même**
 * relation ; une non. Il faut désigner l'intruse.
 *
 * L'exercice est le complément de Complétion d'analogie, et il est plus robuste
 * pour une raison technique qui vaut d'être notée : il **n'exige pas que la
 * relation soit fonctionnelle**. Complétion demande « A est à B ce que C est
 * à ? », question qui n'a de réponse unique que si une seule entité est dans la
 * relation cherchée avec C — d'où son refus de `line`, où « avant » vaut pour
 * plusieurs entités à la fois. Ici, on ne demande pas de produire un terme mais
 * de comparer quatre relations déjà données : aucune unicité n'est requise, et le
 * moteur tourne sur tous les systèmes munis d'une composition.
 *
 * **Le piège de la ressemblance de surface.** Les paires partageant la relation
 * sont tirées dans des régions différentes du modèle, et l'intruse est choisie
 * parmi les relations **voisines** — celles qui partagent une composante d'axe
 * avec la bonne, quand le système a des axes. Sans cela, l'intruse se repérerait
 * à l'œil sans identifier la relation commune, ce qui est exactement ce que
 * l'exercice cherche à empêcher.
 *
 * ## La trace relit les quatre paires, une par une
 *
 * Il n'y a pas de calcul à dérouler ici : il y a quatre lectures à faire dans la
 * situation montrée. La trace les fait donc toutes les quatre, en nommant la
 * relation de chaque paire — ce qui rend le verdict vérifiable sans qu'on ait à
 * croire la correction sur parole, et qui montre du même coup **en quoi**
 * l'intruse diffère : pas « elle n'est pas comme les autres », mais « les trois
 * sont ‹ au nord-est de ›, celle-ci est ‹ à l'est de › ».
 */
import { libelle, texte } from '../../noyaux/presentation';
import { journal, ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur, Option } from '../types';

const TIRAGES = 60;
const PAIRES = 4;

/** Combien de composantes d'axe deux n-uplets ont en commun. */
function proximite(a: string, b: string): number {
  if (a.length !== b.length) return 0;
  let communes = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) communes += 1;
  return communes;
}

export const analogieIntruse: Moteur = {
  id: 'analogie-intruse',
  nom: 'Analogie intruse',
  categorie: 'analogie',
  resume: 'Trois paires partagent la même relation, une non : laquelle ?',
  regimes: ['algebre', 'clos'],

  engendrer(systeme: Systeme, echelon: number, alea: Alea): Item | null {
    for (let essai = 0; essai < TIRAGES; essai += 1) {
      // Une instance assez large pour fournir quatre paires distinctes.
      const instance = systeme.engendrer(Math.max(4, Math.min(echelon + 3, 9)), alea);
      const modele = instance.modele;
      if (!modele || instance.entites.length < 4) continue;

      // Toutes les paires ordonnées, avec leur relation.
      const paires: { a: string; b: string; relation: string }[] = [];
      for (const a of instance.entites) {
        for (const b of instance.entites) {
          if (a === b) continue;
          const relation = systeme.relationDansModele(modele, a, b);
          if (relation) paires.push({ a, b, relation });
        }
      }
      if (paires.length < 8) continue;

      // Regroupées par relation : il faut une relation portée par au moins trois
      // paires **sans entité commune répétée**, pour que la ressemblance ne se
      // lise pas sur les noms.
      const parRelation = new Map<string, typeof paires>();
      for (const paire of paires) {
        const liste = parRelation.get(paire.relation) ?? [];
        liste.push(paire);
        parRelation.set(paire.relation, liste);
      }

      const candidates = [...parRelation.entries()].filter(([, liste]) => liste.length >= 3);
      if (!candidates.length) continue;
      const [commune, disponibles] = alea.un(candidates);

      const trois = alea.plusieurs(disponibles, 3);
      // Deux paires partageant une entité rendent la relation commune trop
      // visible : on exige des paires disjointes autant que l'instance le permet.
      const entitesVues = new Set<string>();
      let chevauchement = 0;
      for (const paire of trois) {
        if (entitesVues.has(paire.a) || entitesVues.has(paire.b)) chevauchement += 1;
        entitesVues.add(paire.a);
        entitesVues.add(paire.b);
      }
      if (chevauchement > 1) continue;

      // L'intruse : une paire dont la relation est la plus **proche** possible de
      // la commune sans l'être. Sur un système à axes, « proche » veut dire
      // « partageant une composante » ; ailleurs, n'importe quelle autre relation.
      const autres = paires.filter((p) => p.relation !== commune);
      if (!autres.length) continue;
      const meilleure = Math.max(...autres.map((p) => proximite(p.relation, commune)));
      const prochesDuBut = autres.filter((p) => proximite(p.relation, commune) === meilleure);
      const intruse = alea.un(prochesDuBut);
      if (entitesVues.has(intruse.a) && entitesVues.has(intruse.b)) continue;

      const melange = alea.melanger([
        ...trois.map((p) => ({ ...p, coupable: false })),
        { ...intruse, coupable: true },
      ]);
      if (melange.length !== PAIRES) continue;

      const bonne = melange.findIndex((p) => p.coupable);

      /*
       * Les trois paires conformes ne sont pas de simples erreurs : ce sont
       * celles qui portent la relation commune. L'étiquette `leurre-de-surface`
       * leur irait mal — c'est l'intruse qui ressemble aux autres, pas
       * l'inverse. On n'étiquette donc rien ici : l'erreur consiste à n'avoir
       * pas lu la relation, et la trace la montre en la lisant.
       */
      const options: Option[] = melange.map((p) => ({ texte: `${p.a} et ${p.b}` }));

      // ----- La trace : les quatre lectures, puis le verdict -------------
      const carnet = journal();
      melange.forEach((paire, indice) => {
        carnet.etape({
          utilise: [ref('option', indice), ref('entite', paire.a), ref('entite', paire.b)],
          loi: 'lecture dans la situation',
          produit: `${paire.a} ${libelle(systeme, paire.relation)} ${paire.b}`,
          legende:
            `Paire ${indice + 1} : dans la situation montrée, ${paire.a} ` +
            `${libelle(systeme, paire.relation)} ${paire.b}.`,
          surbrillance: [ref('entite', paire.a), ref('entite', paire.b), ref('option', indice)],
        });
      });

      carnet.etape({
        utilise: [ref('option', bonne)],
        loi: 'comparaison',
        produit: `${intruse.a} et ${intruse.b}`,
        legende:
          `Trois paires portent la même relation, « ${libelle(systeme, commune)} ». La ` +
          `quatrième — ${intruse.a} et ${intruse.b} — porte ` +
          `« ${libelle(systeme, intruse.relation)} »` +
          (meilleure > 0
            ? ', qui partage une partie de sa description avec la relation commune. C’est ce ' +
              'qui la rend difficile à écarter, et c’est tout l’exercice : la ressemblance de ' +
              'surface n’est pas l’identité de relation.'
            : '.'),
        surbrillance: [ref('option', bonne), ref('entite', intruse.a), ref('entite', intruse.b)],
      });

      return {
        moteur: 'analogie-intruse',
        systeme: systeme.id,
        consigne: 'Quelle paire n’entretient pas la même relation que les trois autres ?',
        enonce: [
          texte(
            `${systeme.resume} Les quatre paires ci-dessous ne sont pas décrites : c’est à vous ` +
              'de retrouver, dans la situation, la relation que trois d’entre elles partagent. ' +
              'La quatrième en diffère.',
          ),
          ...(systeme.rendu === 'grille'
            ? [
                {
                  type: 'grille' as const,
                  axes: systeme.axes ?? [],
                  points: instance.entites.map((entite) => ({
                    etiquette: entite,
                    coord: modele.coordonnees?.[entite] ?? [],
                  })),
                },
              ]
            : [
                {
                  type: 'faits' as const,
                  phrases: instance.entites.flatMap((a) =>
                    instance.entites
                      .filter((b) => b > a)
                      .map(
                        (b) =>
                          `${a} ${libelle(systeme, systeme.relationDansModele(modele, a, b))} ${b}`,
                      ),
                  ),
                },
              ]),
        ],
        reponse: { genre: 'unique', options, bonne },
        explication:
          `Les trois autres paires — ${trois.map((p) => `${p.a} et ${p.b}`).join(', ')} — sont ` +
          `toutes dans la relation « ${libelle(systeme, commune)} ». La paire ${intruse.a} et ` +
          `${intruse.b} est dans la relation « ${libelle(systeme, intruse.relation)} »` +
          (meilleure > 0
            ? ', qui partage une partie de sa description avec la relation commune — c’est ce ' +
              'qui la rend difficile à écarter : la ressemblance de surface n’est pas ' +
              'l’identité de relation.'
            : '.'),
        trace: carnet.sceller({ genre: 'unique', indice: bonne }),
      };
    }
    return null;
  },
};
