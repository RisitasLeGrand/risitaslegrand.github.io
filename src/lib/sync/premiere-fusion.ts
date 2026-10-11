/**
 * La première fusion : ce qu'on peut réconcilier, et ce qu'on doit refuser.
 *
 * ## La décision validée, et pourquoi je la précise
 *
 * La décision 4 refuse « la fusion de deux bases sans ancêtre commun ». Je
 * l'avais recommandée sous cette forme, et elle est juste dans son intention —
 * mais prise littéralement, elle interdit un cas parfaitement légitime :
 * installer Cyclades sur deux appareils le même jour, saisir trois choses ici
 * et deux là, puis les apparier. Ces deux journaux n'ont aucun ancêtre commun
 * et leur fusion est pourtant **sans danger** : ce sont deux ensembles de faits
 * disjoints, et l'union de deux ensembles disjoints ne perd rien.
 *
 * Ce que la décision protège réellement, c'est autre chose. Le danger n'est pas
 * l'absence d'ancêtre, c'est l'existence de **deux histoires concurrentes pour
 * le même objet**. Concrètement : deux socles FSRS pour la même carte. Un socle
 * dit « l'état de cette carte, repris tel quel, faute de journal antérieur ».
 * Deux socles disent deux choses incompatibles de la même carte, et aucun
 * recalcul ne peut les réconcilier — le journal ne contient pas de quoi savoir
 * laquelle des deux histoires a eu lieu. C'est exactement le cas que j'avais
 * nommé à la phase 1b : deux appareils qui migrent séparément avant de
 * s'apparier.
 *
 * Le contrôle porte donc là, précisément, plutôt que sur l'absence d'ancêtre
 * commun qui n'en est que l'indice. Un refus trop large aurait été écarté par
 * l'usage — on aurait ajouté un bouton « fusionner quand même », et le garde-fou
 * n'aurait plus rien gardé.
 */
import type { EntreeRevision } from '../noyau/revisions';
import { estSocle } from '../noyau/revisions';
import type { Operation } from '../noyau/operations';

export interface CoteDeFusion {
  operations: readonly Operation[];
  revisions: readonly EntreeRevision[];
}

export type Verdict =
  /** Les deux journaux se recoupent : ils ont une histoire commune. */
  | 'histoire-commune'
  /** L'un des deux est vide : c'est le cas « ajouter un téléphone ». */
  | 'une-base-vide'
  /** Aucune histoire commune, mais aucun objet en double : l'union est sûre. */
  | 'disjointe'
  /** Deux histoires concurrentes du même objet : irréconciliable. */
  | 'irreconciliable';

export interface Diagnostic {
  verdict: Verdict;
  /** Opérations et révisions que les deux côtés ont déjà en commun. */
  partagees: number;
  /** Les cartes dont chaque côté porte un socle **différent**. */
  soclesConcurrents: string[];
  /** Ce qu'il faut en dire à la personne. */
  message: string;
}

function soclesParCarte(revisions: Iterable<EntreeRevision>): Map<string, Set<string>> {
  const sortie = new Map<string, Set<string>>();
  for (const entree of revisions) {
    if (!estSocle(entree)) continue;
    const vus = sortie.get(entree.carteId) ?? new Set<string>();
    vus.add(entree.id);
    sortie.set(entree.carteId, vus);
  }
  return sortie;
}

export function diagnostiquer(local: CoteDeFusion, distant: CoteDeFusion): Diagnostic {
  const idsLocaux = new Set<string>([
    ...local.operations.map((o) => o.id),
    ...local.revisions.map((r) => r.id),
  ]);
  const partagees = [...distant.operations, ...distant.revisions].filter((e) =>
    idsLocaux.has(e.id),
  ).length;

  const vide =
    (!local.operations.length && !local.revisions.length) ||
    (!distant.operations.length && !distant.revisions.length);

  /*
     Les socles concurrents sont cherchés **dans tous les cas**, et pas seulement
     en l'absence d'ancêtre commun. Deux appareils peuvent avoir une histoire
     commune — s'être synchronisés une fois — et avoir migré séparément avant :
     ils porteraient alors des socles concurrents malgré leur ancêtre commun.
     Chercher le danger là où il est, plutôt que là où son indice se trouve
     d'ordinaire.

     Le critère porte sur **l'état fusionné**, et non sur ce que le distant
     apporte de plus. J'avais écrit l'inverse, et une propriété engendrée l'a
     démenti : un côté portant {S-1, S-2} pour une carte et l'autre {S-1} était
     déclaré sain dans un sens et irréconciliable dans l'autre. Or le verdict ne
     peut pas dépendre de qui tient le fichier — c'est la même fusion.

     Conséquence assumée : une base qui porte **déjà** deux socles pour la même
     carte est refusée même face à elle-même. Ce n'est pas un faux positif. Un
     appareil ne fabrique qu'un socle par carte, à sa migration ; en porter deux
     signifie qu'il est déjà dans l'état que le refus décrit, et la marche à
     suivre est exactement son remède.
  */
  const parCarte = soclesParCarte([...local.revisions, ...distant.revisions]);
  const soclesConcurrents = [...parCarte]
    .filter(([, socles]) => socles.size > 1)
    .map(([carte]) => carte)
    .sort();

  if (soclesConcurrents.length) {
    const combien = soclesConcurrents.length;
    const s = combien > 1 ? 's' : '';
    /* Un seul côté porte-t-il déjà la duplication ? Le remède est le même, mais
       le dire autrement évite d'accuser l'autre appareil à tort. */
    const soclesLocaux = soclesParCarte(local.revisions);
    const dejaIci = soclesConcurrents.every(
      (carte) => (soclesLocaux.get(carte)?.size ?? 0) > 1,
    );
    return {
      verdict: 'irreconciliable',
      partagees,
      soclesConcurrents,
      message: dejaIci
        ? `Cet appareil porte déjà deux états de départ pour ${combien} flashcard${s} : ` +
          `sa progression a été reconstituée deux fois, et rien dans le journal ne permet de ` +
          `savoir laquelle des deux a eu lieu. Fusionner par-dessus n'y changerait rien. ` +
          `La marche à suivre est plus bas : repartir d'un appareil de référence.`
        : `Ces deux appareils portent chacun leur propre histoire de ${combien} ` +
          `flashcard${s} : chacun a reconstitué son état de départ de son côté, et rien dans ` +
          `les journaux ne permet de savoir laquelle des deux a eu lieu. Les fusionner ` +
          `mélangerait deux passés différents. ` +
          `La marche à suivre est plus bas : choisir un appareil de référence.`,
    };
  }

  if (vide) {
    return {
      verdict: 'une-base-vide',
      partagees,
      soclesConcurrents,
      message:
        'L’un des deux appareils n’a encore rien enregistré : la fusion est une simple ' +
        'copie, sans risque.',
    };
  }

  if (partagees > 0) {
    return {
      verdict: 'histoire-commune',
      partagees,
      soclesConcurrents,
      message:
        `Ces deux appareils ont ${partagees} enregistrement${partagees > 1 ? 's' : ''} en ` +
        'commun : ils se sont déjà parlé, et la fusion reprend où ils en étaient.',
    };
  }

  return {
    verdict: 'disjointe',
    partagees,
    soclesConcurrents,
    message:
      'Ces deux appareils ne se sont jamais parlé, mais ils n’ont aucune histoire ' +
      'concurrente : ce sont deux ensembles de faits distincts, et les réunir n’en perd ' +
      'aucun. C’est le cas de deux appareils installés séparément.',
  };
}

export const fusionnable = (diagnostic: Diagnostic): boolean =>
  diagnostic.verdict !== 'irreconciliable';

/**
 * La marche à suivre quand la fusion est refusée.
 *
 * Elle est écrite ici, à côté du refus, plutôt que dans l'écran : un refus qui
 * ne dit pas quoi faire n'est pas un garde-fou, c'est un mur. Et les trois
 * étapes doivent être dans cet ordre — la sauvegarde **avant** l'effacement,
 * toujours.
 */
export const MARCHE_A_SUIVRE: readonly string[] = [
  'Choisissez l’appareil dont les données sont les plus complètes : ce sera la référence.',
  'Sur l’autre appareil, faites une sauvegarde et gardez-la — elle contient ce que vous ' +
    'allez remplacer, et c’est votre seul recours si vous changez d’avis.',
  'Toujours sur l’autre appareil, effacez la progression, puis restaurez la sauvegarde de ' +
    'l’appareil de référence. Les deux repartent alors de la même histoire, et toutes les ' +
    'synchronisations suivantes fonctionneront normalement.',
];
