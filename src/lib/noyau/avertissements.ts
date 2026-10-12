/**
 * L'avertissement professionnel, décidé **localement** et non par l'IA.
 *
 * ## Pourquoi un champ ne suffit pas
 *
 * Le format d'analyse porte `avertissement_professionnel`, un booléen que l'IA
 * remplit. C'est utile — elle sait parfois mieux que nous qu'une proposition
 * touche à un sujet délicat — et ce n'est **pas fiable** : le champ est rempli
 * par la partie dont on se méfie. Une IA qui oublie de le cocher, ou qui le
 * coche à tort, laisserait passer exactement ce que le garde-fou doit arrêter.
 *
 * La règle est donc **ou** : l'avertissement s'affiche si l'IA l'a demandé
 * **ou** si le domaine et la nature de la proposition le commandent. Les deux
 * sources se cumulent, et aucune n'a le dernier mot sur l'autre — la seule
 * façon de ne pas dépendre de la prudence d'un modèle est de ne pas la
 * consulter pour décider.
 *
 * ## Pourquoi la règle locale est large
 *
 * Elle couvre trois domaines entiers plutôt que de chercher des mots-clés dans
 * un texte libre. Un filtre par mots-clés se contourne sans le vouloir — « 20
 * minutes de marche » ne contient aucun mot suspect et touche pourtant au corps
 * —, et un faux positif ne coûte qu'une phrase de prudence en trop.
 */

/** Les domaines dont toute proposition porte un avertissement. */
export const DOMAINES_A_AVERTISSEMENT: readonly string[] = ['corps', 'psyche', 'finances'];

/**
 * Les natures qui, même hors de ces domaines, demandent un avertissement.
 *
 * `mesure` est là parce qu'une proposition de mesurer quelque chose du corps —
 * se peser tous les jours, compter ses calories — est précisément ce que E.3
 * demande de ne pas encourager sans précaution.
 */
export const NATURES_A_AVERTISSEMENT: readonly string[] = ['mesure'];

export interface Proposition {
  domaine: string;
  nature: string;
  /** Ce que l'IA a déclaré. Pris en compte, jamais cru sur parole. */
  avertissementDeclare?: boolean;
}

export interface Avertissement {
  /** Faut-il afficher l'avertissement ? */
  afficher: boolean;
  /** D'où vient la décision : l'IA, la règle locale, ou les deux. */
  origine: 'ia' | 'regle' | 'les-deux' | 'aucune';
  /** La phrase à afficher, ou vide. */
  phrase: string;
}

const PHRASE_CORPS =
  'Cette proposition touche au corps ou à la santé. Cyclades n’est pas un professionnel de santé : ' +
  'parlez-en à un médecin avant d’y donner suite.';
const PHRASE_PSYCHE =
  'Cette proposition touche à votre état psychique. Si quelque chose vous inquiète, parlez-en à un ' +
  'professionnel — un logiciel ne remplace pas un entretien.';
const PHRASE_FINANCES =
  'Cette proposition touche à vos finances. Cyclades ne donne aucun conseil en placement : ' +
  'adressez-vous à un professionnel avant toute décision.';
const PHRASE_GENERALE =
  'L’IA a signalé que cette proposition demande l’avis d’un professionnel. Suivez cet avis avant ' +
  'd’y donner suite.';

const PHRASES: Record<string, string> = {
  corps: PHRASE_CORPS,
  psyche: PHRASE_PSYCHE,
  finances: PHRASE_FINANCES,
};

/**
 * L'avertissement d'une proposition.
 *
 * Rend l'origine en plus de la décision : l'écran n'en a pas besoin, mais un
 * essai, si. Savoir que l'avertissement vient de la règle locale **et pas** du
 * champ de l'IA est précisément ce qu'il faut pouvoir vérifier.
 */
export function avertissement(proposition: Proposition): Avertissement {
  const parLaRegle =
    DOMAINES_A_AVERTISSEMENT.includes(proposition.domaine) ||
    NATURES_A_AVERTISSEMENT.includes(proposition.nature);
  const parLIa = proposition.avertissementDeclare === true;

  if (!parLaRegle && !parLIa) return { afficher: false, origine: 'aucune', phrase: '' };

  const origine = parLaRegle && parLIa ? 'les-deux' : parLaRegle ? 'regle' : 'ia';
  const phrase = PHRASES[proposition.domaine] ?? PHRASE_GENERALE;
  return { afficher: true, origine, phrase };
}

/* ══════════════════════════════════════════════════════════════════════════
   La bannière permanente
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'une analyse importée porte **toujours**, sur chaque écran qui la montre.
 *
 * Déclarée ici et non recopiée écran par écran : une bannière recopiée finit
 * par différer d'un écran à l'autre, et c'est l'écran où elle manque qu'on
 * consultera le jour où elle comptait.
 */
export const BANNIERE_ANALYSE =
  'Analyse externe produite par une IA, non vérifiée. Elle ne modifie aucune de vos données ' +
  'd’elle-même, et ses chiffres ont été recalculés quand c’était possible.';

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/** Vérifie que chaque domaine à avertissement a sa phrase, et qu'elle est utile. */
export function controlerAvertissements(): string[] {
  const problemes: string[] = [];
  for (const domaine of DOMAINES_A_AVERTISSEMENT) {
    const phrase = PHRASES[domaine];
    if (!phrase) {
      problemes.push(`Le domaine « ${domaine} » demande un avertissement mais n’a pas de phrase.`);
      continue;
    }
    if (!/professionnel|médecin/.test(phrase)) {
      problemes.push(`La phrase de « ${domaine} » ne renvoie à aucun professionnel.`);
    }
  }
  if (BANNIERE_ANALYSE.length < 50 || !BANNIERE_ANALYSE.includes('non vérifiée')) {
    problemes.push('La bannière doit dire que l’analyse est produite par une IA et non vérifiée.');
  }
  return problemes;
}
