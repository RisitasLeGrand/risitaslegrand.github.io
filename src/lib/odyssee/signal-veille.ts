/**
 * Le cycle de vie d'un repère — phase 3.
 *
 * Le moteur (`moteur-veille.ts`) dit si les données s'écartent. Ce module dit
 * si l'on en parle, quand, et combien de temps on se tait ensuite. Ce sont
 * deux questions distinctes, et les mélanger aurait produit un moteur dont le
 * verdict dépend de l'humeur de l'interface.
 *
 * ## Les quatre règles du silence
 *
 * 1. **Désactivée, rien ne tourne.** Pas d'évaluation, pas de rattrapage à la
 *    réactivation. Quelqu'un qui éteint la veille pendant trois mois et la
 *    rallume ne doit pas recevoir trois mois de repères d'un coup : ce serait
 *    punir le fait d'avoir éteint.
 * 2. **Un seul repère à la fois.** Tant qu'un repère est ouvert, aucun autre
 *    ne se lève. Sans cette règle, une dégradation qui touche six indicateurs
 *    produirait six cartes, et six cartes ne se lisent pas — elles se ferment.
 * 3. **Une évaluation par jour.** Ouvrir l'application quatre fois ne la fait
 *    pas réfléchir quatre fois.
 * 4. **Un silence après chaque réponse**, dont la durée dépend de la réponse.
 *    Sans lui, le même écart relèverait un repère le lendemain de sa
 *    fermeture, et le dispositif deviendrait un harcèlement poli.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne lit pas les auto-évaluations, et ne les transmet pas au moteur. La
 * lecture des check-ins arrive **à côté** de la carte, composée par l'appelant
 * et posée sous une règle qui dit que les deux peuvent être vrais. Si elle
 * entrait ici, elle finirait tôt ou tard par peser sur une décision.
 */
import { ulid } from '../noyau/ulid';
import type { DomaineVeille, Indicateur } from './veille';
import {
  CATALOGUE,
  type Mesure,
} from './veille';
import {
  REGLAGES,
  SENSIBILITE_PAR_DEFAUT,
  controlerFormulations,
  evaluer,
  formulerLEcart,
  formulerLeContexte,
  type Contexte,
  type MotifDeContexte,
  type Repere,
  type Sensibilite,
  type Verdict,
} from './moteur-veille';

/* ══════════════════════════════════════════════════════════════════════════
   Les réglages
   ══════════════════════════════════════════════════════════════════════════ */

export interface ReglagesVeille {
  /**
   * Faux par défaut, et c'est une décision.
   *
   * Un dispositif qui observe quelqu'un sans qu'il l'ait demandé n'a pas sa
   * place, quelle que soit son utilité. L'activation est un choix explicite,
   * dans un chapitre facultatif.
   */
  active: boolean;
  sensibilite: Sensibilite;
  /** Jour jusqu'auquel la veille se tait, inclus. */
  enPauseJusquau: string | null;
  /** Dernier jour évalué, pour ne pas recommencer à chaque page. */
  evalueeLe: string | null;
  majLe: string;
}

export const REGLAGES_PAR_DEFAUT: ReglagesVeille = {
  active: false,
  sensibilite: SENSIBILITE_PAR_DEFAUT,
  enPauseJusquau: null,
  evalueeLe: null,
  majLe: '',
};

/* ══════════════════════════════════════════════════════════════════════════
   Un repère enregistré
   ══════════════════════════════════════════════════════════════════════════ */

export type Reponse = 'vu' | 'explication' | 'pas-pertinent' | 'plus-tard';

export const LIBELLES_DE_REPONSE: Record<Reponse, string> = {
  vu: 'Je l’ai vu',
  explication: 'Il y a une explication',
  'pas-pertinent': 'Pas pertinent',
  'plus-tard': 'Plus tard',
};

/**
 * Combien de jours la veille se tait après chaque réponse.
 *
 * Les durées ne sont pas interchangeables, et chacune dit quelque chose.
 *
 * - **« Je l'ai vu »** : une fenêtre de persistance. Le temps qu'un vrai
 *   changement devienne visible, sans reposer la même question demain.
 * - **« Il y a une explication »** : le double. La personne a nommé une
 *   cause ; insister reviendrait à ne pas la croire. L'écran propose dans la
 *   foulée de déclarer un contexte, qui décotera les domaines concernés — ce
 *   qui est la bonne façon de tenir compte d'une explication, bien meilleure
 *   qu'un simple délai.
 * - **« Pas pertinent »** : une période de référence entière. C'est le
 *   jugement le plus fort que la personne puisse porter sur le dispositif, et
 *   il mérite d'être pris au mot.
 * - **« Plus tard »** : le repère **reste ouvert**. Il n'est pas clos, il est
 *   seulement remis à plus tard — et c'est pour cela que son délai est court.
 */
export const SILENCE_APRES: Record<Reponse, number> = {
  vu: 14,
  explication: 28,
  'pas-pertinent': 56,
  'plus-tard': 3,
};

export interface SignalEnregistre {
  id: string;
  /** Jour de levée. */
  jour: string;
  depuis: string;
  sensibilite: Sensibilite;
  indicateurs: readonly string[];
  domaines: readonly DomaineVeille[];
  appuis: readonly string[];
  contextes: readonly MotifDeContexte[];
  baseArreteeAu: string;
  /** Null tant qu'il est ouvert. */
  closLe: string | null;
  reponse: Reponse | null;
  /** Jour du dernier affichage, pour « Plus tard ». */
  montreLe: string;
  majLe: string;
}

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(`${jour}T12:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);

/* ══════════════════════════════════════════════════════════════════════════
   La décision : faut-il évaluer, et faut-il montrer ?
   ══════════════════════════════════════════════════════════════════════════ */

export interface EtatVeille {
  reglages: ReglagesVeille;
  /** Le repère ouvert, s'il y en a un. */
  ouvert: SignalEnregistre | null;
  /** Le dernier repère clos, pour le silence qui suit. */
  dernierClos: SignalEnregistre | null;
}

export type Decision =
  | { quoi: 'desactivee' }
  | { quoi: 'en-pause'; jusquau: string }
  | { quoi: 'deja-evaluee'; le: string }
  | { quoi: 'montrer'; signal: SignalEnregistre }
  | { quoi: 'attendre'; signal: SignalEnregistre; jusquau: string }
  | { quoi: 'silence'; jusquau: string; reponse: Reponse }
  | { quoi: 'evaluer' };

/**
 * Que faire aujourd'hui.
 *
 * L'ordre des cas est l'ordre de priorité, et il n'est pas indifférent : la
 * désactivation passe avant la pause, la pause avant un repère ouvert. Une
 * personne qui éteint la veille ne doit pas voir resurgir une carte restée
 * ouverte.
 */
export function decider(etat: EtatVeille, jour: string): Decision {
  const { reglages, ouvert, dernierClos } = etat;

  if (!reglages.active) return { quoi: 'desactivee' };
  if (reglages.enPauseJusquau && jour <= reglages.enPauseJusquau) {
    return { quoi: 'en-pause', jusquau: reglages.enPauseJusquau };
  }

  if (ouvert) {
    /*
       Un repère ouvert et déjà répondu « Plus tard » se tait jusqu'à son
       échéance. Les trois autres réponses le ferment, il ne peut donc pas
       être ouvert et porter l'une d'elles.
    */
    if (ouvert.reponse === 'plus-tard') {
      const echeance = ajouterJours(ouvert.montreLe, SILENCE_APRES['plus-tard']);
      if (jour < echeance) return { quoi: 'attendre', signal: ouvert, jusquau: echeance };
    }
    return { quoi: 'montrer', signal: ouvert };
  }

  if (dernierClos?.closLe && dernierClos.reponse) {
    const jusquau = ajouterJours(dernierClos.closLe, SILENCE_APRES[dernierClos.reponse]);
    if (jour < jusquau) return { quoi: 'silence', jusquau, reponse: dernierClos.reponse };
  }

  if (reglages.evalueeLe === jour) return { quoi: 'deja-evaluee', le: jour };
  return { quoi: 'evaluer' };
}

/** Transforme un repère du moteur en repère enregistrable. */
export function enregistrer(repere: Repere, le: string): SignalEnregistre {
  return {
    id: ulid(),
    jour: repere.jour,
    depuis: repere.depuis,
    sensibilite: repere.sensibilite,
    indicateurs: repere.deviations.map((d) => d.indicateur),
    domaines: [...repere.domaines],
    appuis: repere.appuis.map((d) => d.indicateur),
    contextes: [...repere.contextes],
    baseArreteeAu: repere.baseArreteeAu,
    closLe: null,
    reponse: null,
    montreLe: le,
    majLe: le,
  };
}

/** Applique une réponse. « Plus tard » ne ferme pas. */
export function repondre(
  signal: SignalEnregistre,
  reponse: Reponse,
  le: string,
): SignalEnregistre {
  if (reponse === 'plus-tard') {
    return { ...signal, reponse, montreLe: le, majLe: le };
  }
  return { ...signal, reponse, closLe: le, majLe: le };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le tour complet
   ══════════════════════════════════════════════════════════════════════════ */

export interface Tour {
  decision: Decision;
  /** Le verdict du moteur, si l'évaluation a eu lieu. */
  verdict: Verdict | null;
  /** Le repère levé par ce tour, s'il y en a un. */
  leve: SignalEnregistre | null;
  /** Les réglages après le tour — `evalueeLe` est à jour. */
  reglages: ReglagesVeille;
}

export interface EntreeDeTour {
  jour: string;
  etat: EtatVeille;
  mesures: Readonly<Record<string, readonly Mesure[]>>;
  contextes?: readonly Contexte[];
  catalogue?: readonly Indicateur[];
}

/**
 * Un tour de veille : décider, évaluer s'il y a lieu, lever s'il y a lieu.
 *
 * La **base gelée** passe par ici : le jour de début du repère ouvert est
 * transmis au moteur, qui arrête la ligne de base la veille. C'est le seul
 * endroit où les deux morceaux se rencontrent, et c'est pour cela qu'il est
 * court.
 */
export function tourDeVeille(entree: EntreeDeTour): Tour {
  const { jour, etat } = entree;
  const decision = decider(etat, jour);
  const inchange: Tour = { decision, verdict: null, leve: null, reglages: etat.reglages };
  if (decision.quoi !== 'evaluer') return inchange;

  const verdict = evaluer({
    jour,
    mesures: entree.mesures,
    ...(entree.contextes ? { contextes: entree.contextes } : {}),
    sensibilite: etat.reglages.sensibilite,
    signalActifDepuis: etat.ouvert?.jour ?? null,
    ...(entree.catalogue ? { catalogue: entree.catalogue } : {}),
  });

  const reglages: ReglagesVeille = { ...etat.reglages, evalueeLe: jour, majLe: jour };
  if (verdict.quoi !== 'repere') return { decision, verdict, leve: null, reglages };
  return { decision, verdict, leve: enregistrer(verdict.repere, jour), reglages };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le statut, qui ne se tait jamais
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce que l'écran affiche en permanence, repère ou pas.
 *
 * Un écran vide se lit « tout va bien ». Le statut est donc toujours là, et
 * toujours formulé — c'est la contrepartie de la mention « l'absence de
 * repère ne signifie pas que tout va bien », qui ne vaudrait rien si l'on ne
 * disait jamais dans quel état se trouve le dispositif.
 */
export function formulerLeStatut(tour: Tour, etat: EtatVeille): string {
  switch (tour.decision.quoi) {
    case 'desactivee':
      return 'La veille est désactivée. Rien n’est observé, rien n’est calculé.';
    case 'en-pause':
      return `La veille est en pause jusqu’au ${tour.decision.jusquau}.`;
    case 'attendre':
      return 'Un repère est en attente ; il vous sera reproposé prochainement.';
    case 'montrer':
      return 'Un repère est ouvert, ci-dessous.';
    case 'silence':
      return (
        `Vous avez répondu « ${LIBELLES_DE_REPONSE[tour.decision.reponse]} ». La veille ` +
        `observe, et ne reproposera rien avant le ${tour.decision.jusquau}.`
      );
    case 'deja-evaluee':
      return 'La veille a déjà regardé aujourd’hui. Rien à signaler.';
    default:
      break;
  }
  if (tour.verdict?.quoi === 'donnees-insuffisantes') {
    return (
      'Données insuffisantes : la veille ne peut pas se prononcer. ' +
      tour.verdict.suffisance.manques.slice(0, 3).join(' ')
    );
  }
  if (tour.leve) return 'Un repère est ouvert, ci-dessous.';
  const nom = REGLAGES[etat.reglages.sensibilite].libelle.toLowerCase();
  return `La veille observe, en sensibilité ${nom}. Rien ne s’écarte de votre habitude.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   La carte
   ══════════════════════════════════════════════════════════════════════════ */

export interface Carte {
  titre: string;
  introduction: string;
  /** Une puce par repère, en langage courant, sans chiffre. */
  puces: readonly string[];
  reserve: string;
  contexte: string;
  /** La lecture des auto-évaluations, posée à côté. */
  checkins: string | null;
  invitation: string;
  mention: string;
}

const DUREES = [
  { jours: 10, mot: 'une dizaine de jours' },
  { jours: 14, mot: 'deux semaines' },
  { jours: 21, mot: 'trois semaines' },
  { jours: 28, mot: 'quatre semaines' },
];

const direLaDuree = (jours: number) =>
  DUREES.find((d) => d.jours === jours)?.mot ?? 'quelques semaines';

/**
 * Compose la carte, sans un chiffre.
 *
 * Les ressources d'urgence — les trois numéros — ne passent **pas** par ici :
 * elles vivent dans le gabarit de la page, hors du coffre et hors de tout
 * seuil, et elles portent des chiffres que le contrôle refuserait à juste
 * titre partout ailleurs. Les mêmes chiffres n'ont pas le même statut selon
 * qu'ils mesurent quelqu'un ou qu'ils lui donnent un numéro à appeler.
 */
export function composerLaCarte(
  repere: Repere,
  lectureDesCheckins: string | null = null,
  catalogue: readonly Indicateur[] = CATALOGUE,
): Carte {
  const parId = new Map(catalogue.map((i) => [i.id, i]));
  const puces = repere.deviations
    .map((d) => {
      const i = parId.get(d.indicateur);
      return i ? formulerLEcart(d, i) : null;
    })
    .filter((p): p is string => p !== null);

  return {
    titre: 'Un repère à examiner',
    introduction:
      `Depuis environ ${direLaDuree(REGLAGES[repere.sensibilite].persistance)}, plusieurs ` +
      'repères que vous avez enregistrés s’écartent de votre habitude :',
    puces,
    reserve:
      'Ces repères ne disent pas ce qui se passe, et vous êtes le mieux placé pour le savoir.',
    contexte: formulerLeContexte(repere),
    checkins: lectureDesCheckins,
    invitation:
      'Si vous vous reconnaissez là-dedans, en parler à un proche ou à votre médecin peut être utile.',
    mention:
      'Ce repère ne remplace pas un avis médical. L’absence de repère ne signifie pas que tout va bien.',
  };
}

/** Toutes les phrases de la carte, pour le contrôle. */
export const phrasesDeLaCarte = (c: Carte): string[] =>
  [c.titre, c.introduction, ...c.puces, c.reserve, c.contexte, c.checkins, c.invitation, c.mention]
    .filter((p): p is string => typeof p === 'string');

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

export function controlerCycle(): string[] {
  const problemes: string[] = [];
  if (REGLAGES_PAR_DEFAUT.active) {
    problemes.push(
      'La veille serait active par défaut. Un dispositif qui observe quelqu’un sans qu’il ' +
        'l’ait demandé n’a pas sa place, quelle que soit son utilité.',
    );
  }
  for (const [reponse, jours] of Object.entries(SILENCE_APRES)) {
    if (jours <= 0) problemes.push(`« ${reponse} » n’ouvre aucun silence : le repère reviendrait demain.`);
  }
  if (SILENCE_APRES['pas-pertinent'] <= SILENCE_APRES.vu) {
    problemes.push(
      '« Pas pertinent » se tait moins longtemps que « Je l’ai vu ». C’est le jugement le plus ' +
        'fort que la personne puisse porter sur le dispositif : il mérite le plus long silence.',
    );
  }
  if (SILENCE_APRES['plus-tard'] >= SILENCE_APRES.vu) {
    problemes.push('« Plus tard » n’est pas une fermeture : son délai doit rester court.');
  }
  /*
     Le contrôle des mots porte sur une carte **fabriquée**, et non sur les
     constantes : c'est l'assemblage qui pourrait introduire un chiffre, pas
     les morceaux pris séparément.
  */
  const carte = composerLaCarte({
    jour: '2026-10-13',
    depuis: '2026-09-30',
    sensibilite: 'standard',
    deviations: [],
    domaines: [],
    appuis: [],
    contextes: [],
    baseArreteeAu: '2026-09-29',
  });
  problemes.push(...controlerFormulations(phrasesDeLaCarte(carte)));
  return problemes;
}
