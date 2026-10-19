/**
 * Les faits de **toutes** les branches, en une seule lecture.
 *
 * ## Pourquoi ce module existe
 *
 * Chaque branche publie les siens, et c'est bien ainsi : un propriétaire
 * unique par fait, et personne n'écrit chez le voisin. Mais tout ce qui lit
 * **en travers** — la roue d'équilibre, les indicateurs, les synthèses et
 * surtout les règles de désaccord — a besoin de l'ensemble, et chaque appelant
 * assemblait sa propre liste.
 *
 * Les conséquences n'étaient pas théoriques. Les règles de désaccord
 * `effort-sous-sante` et `chevauchement-exclusif` sont écrites depuis la phase
 * 3f pour opposer une séance de sport à une révision, ou à un empêchement
 * déclaré ; elles ne recevaient que les faits de Révisions, et n'avaient donc
 * **jamais rien eu à opposer**. Une règle qui ne peut pas se déclencher est
 * une règle fausse, et elle se tait exactement comme une règle satisfaite.
 *
 * ## Ce que l'agrégation ne change pas
 *
 * L'**XP**. Les règles d'XP n'écoutent que les types `revision.*` ; un fait de
 * Sport ou du Corps tombe dans `sansRegle`, qui dit en toutes lettres « compte
 * pour les indicateurs, pas pour l'XP ». C'est la décision 2 — l'XP se calcule
 * une seule fois, et elle reste ce qu'elle était — et c'est pour cela que
 * cette agrégation peut être branchée sans rien recalculer.
 */
import type { Fait } from '../noyau/faits';
import {
  publierFaitsRevisions,
  type Manque,
  type OptionsPublication,
  type Publication,
} from './faits-revisions';
import { publierFaitsOdyssee } from './faits-odyssee';
import { publierFaitsCorps } from './faits-corps';
import {
  MATRICE_PAR_DEFAUT,
  domainesNonAutorises,
  filtrerPourLecture,
  type DomaineNonAutorise,
  type Lectrice,
  type Matrice,
} from '../noyau/permissions';

/** Les branches publiables, dans l'ordre où elles sont assemblées. */
export type SourceDeFaits =
  | 'revisions'
  | 'odyssee'
  | 'corps'
  | 'sport'
  | 'psyche'
  | 'finances'
  /**
   * Traitements et statut hormonal — amendement signé le 16 octobre 2026.
   *
   * **Une source à part, et pas un morceau de `corps`.** L'export nomme
   * ses sources une par une, et `corps` y figure toujours ; les ranger
   * là-dedans les aurait fait sortir d'office, et seul le tamis de type
   * les aurait retenus. Une source distincte, que l'export ne nomme
   * jamais, met une seconde barrière devant la première.
   *
   * Les deux sont éprouvées **séparément** : le tamis dans
   * `essais:jamais-partage`, la séparation ici. Deux barrières l'une
   * derrière l'autre ne se testent pas en frappant sur la première — ce
   * prompt l'a appris trois fois.
   */
  | 'sensible';

export const SOURCES: readonly SourceDeFaits[] = [
  'revisions',
  'odyssee',
  'corps',
  'sport',
  'psyche',
  'finances',
  'sensible',
];

export interface OptionsToutesBranches extends OptionsPublication {
  /**
   * La branche qui lit. **Obligatoire**, et c'est tout le lot B.2.
   *
   * ## Ce qui n'allait pas, et qui n'allait pas depuis le début
   *
   * La matrice de lecture inter-branches (`noyau/permissions.ts`) existait,
   * complète, avec ses défauts de B.2 et ses garde-fous — et **aucun fichier
   * de `src/` ne l'importait**. Vérifié le 19 octobre : le module était même
   * déclaré orphelin depuis le 15. Tout ce qui lit en travers passait par ici,
   * et ici ne demandait pas qui lisait : le seul paramètre qui ressemblait à
   * une permission, `sources`, est **choisi par le lecteur**. Qui veut tout
   * n'écrit rien et reçoit tout. C'est l'inverse d'une permission.
   *
   * Rien n'était cassé pour autant : tous les appelants sont des surfaces
   * d'Odyssée, et B.2 dit « Odyssée lit tout ». La matrice n'était pas fausse,
   * elle n'était pas branchée — et la différence compte : il n'y avait rien à
   * corriger en urgence, et tout à brancher avant le premier lecteur.
   *
   * ## Pourquoi obligatoire et non facultatif
   *
   * Un paramètre facultatif garde le trou par défaut. Il suffirait d'un
   * appelant qui l'ignore pour que la promesse retombe, sans que rien ne
   * rougisse — et le prochain appelant à l'ignorer serait celui qui n'y aurait
   * pas pensé, c'est-à-dire celui dont on a le plus besoin qu'il y pense.
   * Obligatoire, le compilateur demande à chacun de se nommer.
   */
  lectrice: Lectrice;
  /** Restreindre l'assemblage. Par défaut, toutes. */
  sources?: readonly SourceDeFaits[];
  /** La matrice à appliquer. Celle de B.2 par défaut. */
  matrice?: Matrice;
}

/**
 * Ce qu'une lecture rend : les faits permis, ce qui manque, ce qui est refusé.
 *
 * **Trois états, et non deux.** La maquette 8.3 impose de distinguer « domaine
 * non autorisé » de « non mesuré », et avant ce lot il n'y avait que des
 * `manques` — qui disent « je n'ai pas pu lire », typiquement un coffre fermé.
 * Rien ne disait « je n'avais pas le droit ». Les confondre laisserait croire
 * qu'un domaine coupé est un domaine vide.
 *
 * - `faits` : mesuré, et lisible ;
 * - `manques` : non mesuré, ou illisible pour une raison de circonstance ;
 * - `nonAutorises` : refusé par la matrice, quoi qu'il y ait dedans.
 */
export interface PublicationLue extends Publication {
  nonAutorises: DomaineNonAutorise[];
}

/**
 * Assemble les publications demandées.
 *
 * Sport est importée **à la demande** : une page d'Odyssée qui ne regarde pas
 * le sport n'a pas à charger la bibliothèque d'exercices pour s'en apercevoir.
 */
export async function publierTousLesFaits(
  options: OptionsToutesBranches,
): Promise<PublicationLue> {
  const { lectrice, sources = SOURCES, matrice = MATRICE_PAR_DEFAUT, ...reste } = options;
  const travaux: Promise<Publication>[] = [];

  if (sources.includes('revisions')) travaux.push(publierFaitsRevisions(reste));
  if (sources.includes('odyssee')) travaux.push(publierFaitsOdyssee(reste));
  if (sources.includes('corps')) travaux.push(publierFaitsCorps(reste));
  if (sources.includes('sport')) {
    travaux.push(
      import('../sport/faits-sport').then(({ publierFaitsSport }) => publierFaitsSport(reste)),
    );
  }
  if (sources.includes('psyche')) travaux.push(publierPsycheOuLeDire(reste));
  if (sources.includes('finances')) travaux.push(publierFinancesOuLeDire(reste));
  /*
     Les traitements et le statut hormonal. `publierFaitsSensibles` rend
     une publication vide et un manque nommé quand le coffre est fermé,
     donc il n'y a rien à rattraper ici — contrairement à Psyché et
     Finances, dont la lecture lève.
  */
  if (sources.includes('sensible')) {
    travaux.push(
      import('./faits-sensible').then(({ publierFaitsSensibles }) =>
        publierFaitsSensibles(reste),
      ),
    );
  }

  const assemble = fusionner(await Promise.all(travaux));
  /*
     LE FILTRE EST APPLIQUÉ ICI, ET UNE LIMITE EST À DIRE.

     `filtrerPourLecture` écarte les faits dont le type n'est pas permis à la
     lectrice. Il les écarte **après la lecture** : les publieurs ont déjà
     lu, donc une lectrice qui n'a pas le droit de voir Psyché provoque quand
     même la lecture de Psyché, dont le résultat est jeté. Rien ne sort de
     cette fonction, mais le chemin existe — et la matrice est là justement
     pour que le chemin n'existe pas.

     Aller plus loin demanderait que chaque publieur **déclare les types qu'il
     émet**, pour qu'on puisse ne pas l'appeler du tout. Les sept publieurs ne
     correspondent pas aux trois propriétaires (`corps`, `psyche`, `finances`
     et `sensible` publient tous des types d'Odyssée, découpés par domaine
     mais pas strictement), donc la correspondance ne se déduit pas : il
     faudrait la déclarer, et une déclaration de plus peut dériver. C'est un
     changement à proposer, pas à décider ici ; il est inscrit aux décisions
     en attente.
  */
  return {
    ...assemble,
    faits: filtrerPourLecture(lectrice, assemble.faits, matrice),
    nonAutorises: domainesNonAutorises(lectrice, matrice),
  };
}

/**
 * Psyché, ou la raison de son absence.
 *
 * Sa lecture **lève** quand le coffre est fermé : c'est voulu, et c'est le cas
 * le plus courant — le coffre ne s'ouvre que sur demande. Laisser l'exception
 * remonter ferait échouer l'agrégat entier, et une roue d'équilibre vide
 * remplacerait quatre branches lisibles parce que la cinquième est verrouillée.
 *
 * L'absence est donc **déclarée** plutôt que rattrapée en silence : un manque
 * nommé se lit à l'écran, et distingue « le coffre est fermé » de « il n'y a
 * rien à montrer » — qui s'affichent autrement de la même façon.
 */
async function publierPsycheOuLeDire(options: OptionsPublication): Promise<Publication> {
  try {
    const { publierFaitsPsyche } = await import('./faits-psyche');
    return await publierFaitsPsyche(options);
  } catch {
    return {
      faits: [],
      refuses: [],
      manques: [
        {
          quoi: 'Psyché, coffre fermé',
          combien: 1,
          consequence:
            'Rien de la psyché n’entre dans ce calcul, pas même la charge perçue. ' +
            'Ouvrez le coffre depuis « Ma psyché » pour l’y faire entrer.',
        },
      ],
    };
  }
}

/**
 * Finances, ou la raison de son absence.
 *
 * Même mécanique que Psyché, et pour la même raison : sa lecture lève quand
 * le coffre est fermé, et laisser l'exception remonter ferait échouer
 * l'agrégat entier. L'absence est donc nommée plutôt que rattrapée en
 * silence — « le coffre est fermé » et « il n'y a rien à montrer » ne doivent
 * pas s'afficher de la même façon.
 */
async function publierFinancesOuLeDire(options: OptionsPublication): Promise<Publication> {
  try {
    const { publierFaitsFinances } = await import('./faits-finances');
    return await publierFaitsFinances(options);
  } catch {
    return {
      faits: [],
      refuses: [],
      manques: [
        {
          quoi: 'Finances, coffre fermé',
          combien: 1,
          consequence:
            'Ni opération ni valorisation n’entre dans ce calcul. ' +
            'Ouvrez le coffre depuis « Mes finances » pour les y faire entrer.',
        },
      ],
    };
  }
}

/**
 * Assemble des publications déjà obtenues.
 *
 * Séparée de la lecture, comme partout : c'est elle qui porte les deux règles
 * d'assemblage, et elle s'éprouve sans base de données.
 */
export function fusionner(publications: readonly Publication[]): Publication {
  const faits: Fait[] = [];
  const refuses: Publication['refuses'] = [];
  const manques: Manque[] = [];

  for (const p of publications) {
    faits.push(...p.faits);
    refuses.push(...p.refuses);
    for (const manque of p.manques) {
      /*
         Les manques de même intitulé s'**additionnent** au lieu de se
         juxtaposer. Deux branches peuvent déclarer « Séances encore en
         cours », et afficher la ligne deux fois avec deux comptes laisserait
         la personne faire l'addition — ou croire à un doublon.
      */
      const dejaLa = manques.find((m) => m.quoi === manque.quoi);
      if (dejaLa) dejaLa.combien += manque.combien;
      else manques.push({ ...manque });
    }
  }

  /*
     Tri par jour puis par identifiant, le même qu'à l'intérieur de chaque
     publication. Sans lui, les faits arriveraient par paquets de branche, et
     toute lecture qui suppose l'ordre chronologique — une frise, une courbe,
     la détection d'un chevauchement — se tromperait en silence.
  */
  faits.sort((a, b) =>
    a.jourLogique !== b.jourLogique
      ? a.jourLogique < b.jourLogique
        ? -1
        : 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0,
  );
  return { faits, manques, refuses };
}
