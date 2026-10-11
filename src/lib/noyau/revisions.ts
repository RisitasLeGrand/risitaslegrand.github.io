/**
 * Le journal de révisions : ce qui rend l'état FSRS recalculable.
 *
 * ## Pourquoi il n'existait pas, et pourquoi il doit exister
 *
 * Le magasin `cartes` ne garde que l'état **courant** d'une carte : stabilité,
 * difficulté, échéance. C'est tout ce qu'il faut pour réviser, et c'est pourquoi
 * l'absence de journal n'avait jamais gêné. Mais la règle de fusion retenue est
 * que les états dérivés ne sont jamais fusionnés : ils sont **recalculés à
 * partir des journaux fusionnés**. Sans journal de révisions, cette règle est
 * inapplicable à FSRS, et deux appareils ayant révisé la même carte n'auraient
 * aucun moyen de se mettre d'accord — l'un écraserait l'autre, et des révisions
 * réelles disparaîtraient.
 *
 * ## Le socle, qui est le vrai problème de cette migration
 *
 * Les cartes déjà révisées ont un état sans journal. Recalculer leur état est
 * impossible : l'information n'a jamais été écrite. Deux mauvaises réponses se
 * présentent. Jeter l'état et repartir de zéro perdrait des mois de révision.
 * Fabriquer un journal plausible inventerait des faits.
 *
 * La réponse retenue est un **socle** : une entrée de journal, une par carte
 * existante, qui porte l'état FSRS tel qu'il est aujourd'hui, marquée comme
 * socle et non comme révision. Le recalcul part du socle et applique les
 * révisions postérieures. L'état d'avant la migration n'est donc pas
 * recalculable — il est **repris**, ce qui est honnête — et tout ce qui vient
 * après l'est. Le socle est lui-même une opération journalisée, donc il se
 * synchronise, et deux appareils qui partent du même socle restent d'accord.
 *
 * Conséquence, à dire plutôt qu'à découvrir : si deux appareils migrent
 * **séparément** avant de s'appairer, ils produisent deux socles différents
 * pour la même carte. C'est l'une des raisons pour lesquelles la première
 * fusion exige un appareil de référence, et pour lesquelles fusionner deux
 * bases sans ancêtre commun est refusé.
 */
/*
   Types seulement : ce module ne doit rien importer de « db.ts » comme valeur.
   « db.ts » a besoin de « socleDe » pour sa migration, et deux imports de
   valeurs en sens inverse formeraient un cycle au chargement. Les ESM savent
   le tolérer quand il ne s'agit que de fonctions hoistées, mais c'est une
   propriété fragile du code appelé, pas une garantie : d'où l'injection de
   « neuve » et « appliquer » plutôt qu'un import.
*/
import type { CarteFsrs, EtatCarte, Note } from '../db';
import { SANS_LOT, type Journalisable } from './operations';

/** Une entrée du journal : soit un socle, soit une notation. */
export type EntreeRevision = EntreeSocle | EntreeNotation;

/**
 * Une entrée de journal de révision est **journalisable** au sens de
 * « noyau/operations.ts » : elle porte les quatre champs que la règle de fusion
 * connaît, et se fusionne donc exactement comme une opération.
 *
 * C'était une dette de la phase 1b, qui a construit ce journal avant que celui
 * des opérations n'existe. Deux journaux de formes différentes auraient voulu
 * dire deux règles de fusion, deux empreintes et deux politiques de rétention —
 * donc deux occasions de se tromper au lieu d'une. Le journal garde son index
 * par carte, qui rend le recalcul bon marché ; il ne garde pas son modèle à
 * part.
 */
interface Commun extends Journalisable {
  /** ULID : l'ordre lexicographique est l'ordre chronologique. */
  id: string;
  carteId: string;
  ficheId: string;
  matiere: string;
  /** Instant de l'événement, en ISO. Lisible par un humain, contrairement à `hlc`. */
  le: string;
  /** L'appareil qui l'a produit. */
  appareil: string;
  /** Horloge logique encodée : c'est elle qui ordonne entre appareils. */
  hlc: string;
  /** Le lot de fusion qui l'a intégrée, ou vide pour une saisie locale. */
  lot: string;
}

export interface EntreeSocle extends Commun {
  genre: 'socle';
  /** L'état repris tel quel, faute de journal antérieur. */
  etat: CarteFsrs;
  /** Les compteurs propres au site, qui sont de l'histoire et non du calcul. */
  revisions: number;
  oublis: number;
}

export interface EntreeNotation extends Commun {
  genre: 'notation';
  note: Note;
}

export const estSocle = (e: EntreeRevision): e is EntreeSocle => e.genre === 'socle';

/**
 * L'état d'une carte, recalculé depuis son journal.
 *
 * `appliquer` est injecté — c'est `noter` de `srs.ts` — pour que ce module
 * reste sans dépendance à l'ordonnanceur et donc vérifiable seul. L'ordre est
 * celui des identifiants, qui est l'ordre du temps : on ne se fie pas à l'ordre
 * dans lequel le journal a été lu, ni à `le`, qui vient de l'horloge murale
 * d'un appareil et peut être faux.
 */
export interface Ordonnanceur {
  /** `noter` de « srs.ts ». */
  appliquer: (carte: EtatCarte, note: Note, instant: Date) => EtatCarte;
  /** `fsrsNeuf` de « db.ts » : l'état d'une carte jamais vue. */
  neuve: (instant: Date) => CarteFsrs;
}

export function recalculer(
  entrees: EntreeRevision[],
  ordonnanceur: Ordonnanceur,
): EtatCarte | null {
  const ordonnees = [...entrees].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!ordonnees.length) return null;

  const premiere = ordonnees[0];
  let carte: EtatCarte = estSocle(premiere)
    ? {
        id: premiere.carteId,
        ficheId: premiere.ficheId,
        matiere: premiere.matiere,
        du: premiere.etat.due.slice(0, 10),
        derniereRevision: premiere.etat.last_review ?? null,
        intervalle: premiere.etat.scheduled_days,
        revisions: premiere.revisions,
        oublis: premiere.oublis,
        fsrs: premiere.etat,
      }
    : {
        id: premiere.carteId,
        ficheId: premiere.ficheId,
        matiere: premiere.matiere,
        du: premiere.le.slice(0, 10),
        derniereRevision: null,
        intervalle: 0,
        revisions: 0,
        oublis: 0,
        fsrs: ordonnanceur.neuve(new Date(premiere.le)),
      };

  for (const entree of ordonnees) {
    if (estSocle(entree)) continue;
    // La fiche et la matière suivent la dernière entrée : une carte peut avoir
    // changé de fiche entre deux révisions, et c'est la valeur la plus récente
    // qui est juste.
    carte = ordonnanceur.appliquer(
      { ...carte, ficheId: entree.ficheId, matiere: entree.matiere },
      entree.note,
      new Date(entree.le),
    );
  }
  return carte;
}

/**
 * Le socle d'une carte existante, pour la migration.
 *
 * Il ne tire pas d'identifiant lui-même : l'appelant le fait, de sorte que la
 * migration puisse garantir que tous les socles d'une même base portent des
 * identifiants ordonnés et antérieurs à toute notation ultérieure.
 */
export function socleDe(
  carte: EtatCarte,
  id: string,
  appareil: string,
  hlc: string,
): EntreeSocle {
  return {
    id,
    genre: 'socle',
    hlc,
    lot: SANS_LOT,
    carteId: carte.id,
    ficheId: carte.ficheId,
    matiere: carte.matiere,
    le: carte.derniereRevision ?? carte.fsrs.last_review ?? carte.fsrs.due,
    appareil,
    etat: carte.fsrs,
    revisions: carte.revisions,
    oublis: carte.oublis,
  };
}
