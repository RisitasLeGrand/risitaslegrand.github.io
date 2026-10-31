/**
 * La mémoire prospective : « dans X secondes, appuyez sur K ».
 *
 * La consigne paraît quelques secondes, puis DISPARAÎT. Rien n'est rappelé à
 * l'échéance : c'est tout l'exercice. Il faut tenir une intention pendant qu'on
 * fait autre chose, et la ressortir au bon moment sans qu'on vous y invite.
 *
 * ## Les quatre verdicts, et pourquoi cette partition-là
 *
 * La référence compte des « hits », « misses », « omissions » et « wrong » sans
 * dire ce qui sépare un « miss » d'une « omission ». La partition retenue ici
 * est la mienne, et chaque nom désigne un geste distinct de la personne :
 *
 *   juste    la touche demandée, dans la fenêtre ;
 *   fausse   une AUTRE touche, dans la fenêtre — on a pensé à agir, mais pas
 *            à quoi ;
 *   manquee  la touche demandée, mais après la fermeture de la fenêtre : on y
 *            a pensé trop tard ;
 *   omise    rien du tout.
 *
 * Une consigne encore en attente à la fin de la séance n'est PAS jugée : son
 * échéance n'est jamais venue, et la compter manquée reprocherait à la personne
 * le minuteur de la séance. Elle est rapportée à part.
 *
 * ## Le défaut à ne pas reproduire
 *
 * Quand plusieurs consignes sont échues en même temps, la bonne touche de l'une
 * compte « manquée » pour les autres dans la référence. Ici une frappe résout
 * la consigne échue dont la touche correspond, et UNE SEULE ; les autres
 * continuent d'attendre leur propre fenêtre. C'est la différence entre « j'ai
 * répondu à une consigne » et « j'ai répondu à toutes ».
 */
import type { Consigne, ConsigneJugee, VerdictConsigne } from './types';
import type { Reglages } from './reglages';
import type { Hasard } from './tirage';
import { entierEntre } from './tirage';

/** L'écart entre deux consignes, en millisecondes. */
export const ECART_MIN = 12000;
export const ECART_MAX = 35000;

/** Les touches tirables. Des lettres, pour ne pas heurter les touches du calcul. */
export const TOUCHES = ['K', 'L', 'M', 'P', 'Q', 'S', 'V', 'X'] as const;

export interface EtatProspective {
  /** Les consignes dont l'échéance n'est pas encore passée. */
  enAttente: Consigne[];
  /** Les consignes déjà jugées, dans l'ordre de leur échéance. */
  jugees: ConsigneJugee[];
  /** Combien ont été créées, pour numéroter. */
  creees: number;
}

export const prospectiveNeuve = (): EtatProspective => ({
  enAttente: [],
  jugees: [],
  creees: 0,
});

/**
 * Faut-il poser une nouvelle consigne, et laquelle ?
 *
 * Rend `null` quand il n'y a pas lieu : trop de consignes en attente, ou plus
 * assez de temps pour qu'une échéance ET sa fenêtre tiennent avant la fin.
 *
 * LE REFUS EST LOCAL, JAMAIS DÉFINITIF. La référence cesse de reprogrammer dès
 * que l'horizon tombe sous cinq secondes, et ne reprend jamais : une séance
 * longue perd alors toute sa mémoire prospective à cause d'un creux passager.
 * Ici la décision ne regarde que l'instant présent et le temps qui reste ; dès
 * qu'une place se libère, la consigne suivante est posée.
 */
export function consigneAPoser(
  etat: EtatProspective,
  maintenant: number,
  finDeSeance: number,
  reglages: Reglages,
  hasard: Hasard,
): Consigne | null {
  if (!reglages.prospectiveActive) return null;
  if (etat.enAttente.length >= reglages.prospectiveEnAttente) return null;

  /* L'écart voulu, puis ce que le temps restant permet. L'horizon de réglage
     plafonne l'attente ; la fin de séance, elle, l'interdit. */
  const voulu = entierEntre(hasard, ECART_MIN, ECART_MAX);
  const plafond = Math.min(voulu, reglages.prospectiveHorizon);
  const echeance = maintenant + plafond;
  if (echeance + reglages.prospectiveFenetre > finDeSeance) return null;

  etat.creees += 1;
  return {
    id: `pm-${etat.creees}`,
    creeeA: maintenant,
    echeance,
    fenetre: reglages.prospectiveFenetre,
    touche: TOUCHES[Math.floor(hasard() * TOUCHES.length)],
  };
}

/** La consigne est-elle encore à l'écran ? Son affichage dure, son rappel non. */
export function consigneVisible(
  consigne: Consigne,
  maintenant: number,
  reglages: Reglages,
): boolean {
  return maintenant < consigne.creeeA + reglages.prospectiveAffichage;
}

/** Une frappe est-elle dans la fenêtre d'une consigne ? */
const dansLaFenetre = (consigne: Consigne, instant: number) =>
  instant >= consigne.echeance && instant <= consigne.echeance + consigne.fenetre;

/**
 * Une touche a été pressée. Rend la consigne résolue, s'il y en a une.
 *
 * L'ordre compte : on cherche d'abord une consigne échue dont la touche
 * correspond — c'est le cas juste — et seulement à défaut une consigne échue
 * quelconque, qui recueille alors la fausse touche. Sans cet ordre, deux
 * consignes échues en même temps feraient compter une fausse alarme sur la
 * première alors que la frappe était la bonne réponse à la seconde.
 */
export function surFrappe(
  etat: EtatProspective,
  touche: string,
  instant: number,
): ConsigneJugee | null {
  const echues = etat.enAttente.filter((c) => dansLaFenetre(c, instant));
  if (!echues.length) return null;
  const visee = echues.find((c) => c.touche === touche) ?? echues[0];
  const verdict: VerdictConsigne = visee.touche === touche ? 'juste' : 'fausse';
  return resoudre(etat, visee, verdict, touche, instant);
}

/**
 * Le temps a passé : juge les consignes dont la fenêtre est fermée.
 *
 * `frappesTardives` porte les touches reçues après la fermeture d'une fenêtre,
 * par consigne : c'est ce qui distingue « manquée » — on y a pensé trop tard —
 * d'« omise », où rien n'est venu.
 */
export function surLeTemps(
  etat: EtatProspective,
  maintenant: number,
  frappesTardives: ReadonlyMap<string, { touche: string; instant: number }>,
): ConsigneJugee[] {
  const closes = etat.enAttente.filter((c) => maintenant > c.echeance + c.fenetre);
  const rendus: ConsigneJugee[] = [];
  for (const consigne of closes) {
    const tardive = frappesTardives.get(consigne.id);
    const juste = tardive?.touche === consigne.touche;
    rendus.push(
      resoudre(
        etat,
        consigne,
        juste ? 'manquee' : tardive ? 'fausse' : 'omise',
        tardive?.touche ?? null,
        tardive?.instant ?? null,
      ),
    );
  }
  return rendus;
}

function resoudre(
  etat: EtatProspective,
  consigne: Consigne,
  verdict: VerdictConsigne,
  presse: string | null,
  presseA: number | null,
): ConsigneJugee {
  etat.enAttente = etat.enAttente.filter((c) => c.id !== consigne.id);
  const jugee: ConsigneJugee = { ...consigne, verdict, presse, presseA };
  etat.jugees.push(jugee);
  return jugee;
}

/** Le score de mémoire prospective, ou `null` si aucune consigne n'a été jugée. */
export function scoreProspective(etat: EtatProspective): number | null {
  if (!etat.jugees.length) return null;
  const justes = etat.jugees.filter((c) => c.verdict === 'juste').length;
  return justes / etat.jugees.length;
}
