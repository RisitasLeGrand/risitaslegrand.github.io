/**
 * La voix de PCCT : française, et LOCALE seulement.
 *
 * ## Pourquoi « locale seulement », et non « française de préférence »
 *
 * `speechSynthesis` expose deux sortes de voix. Les LOCALES sont installées sur
 * l'appareil et parlent sans rien demander au réseau. Les autres sont servies
 * par le navigateur depuis un serveur distant : chaque nombre prononcé est alors
 * une requête sortante, et le texte prononcé part avec elle.
 *
 * Cyclades ne sort pas sur le réseau pour son contenu, et ce n'est pas un détail
 * d'architecture : c'est la raison pour laquelle le site existe sous cette forme.
 * Un exercice qui enverrait la suite des nombres d'une séance à un tiers pour
 * les faire dire romprait cette règle pour un confort.
 *
 * D'où `voice.localService`, et rien d'autre. Sans voix locale française, la
 * séance se joue EN VISUEL — et l'écran le dit, plutôt que de rester muet et de
 * laisser croire à une panne.
 *
 * ## Ce module ne parle pas tout seul
 *
 * Il rend ce qu'il a trouvé et une fonction pour dire un nombre. La décision de
 * passer au visuel appartient à l'écran, qui doit aussi l'annoncer : un module
 * qui choisirait en silence priverait l'écran de ce qu'il a à dire.
 */

/** Ce que l'appareil offre, après examen. */
export interface EtatDeLaVoix {
  /** La voix retenue, ou `null` si aucune ne convient. */
  voix: SpeechSynthesisVoice | null;
  /**
   * Pourquoi, en français, et destiné à l'écran.
   *
   * Jamais vide : même le cas favorable a sa phrase, pour que l'écran puisse
   * dire à qui cherche POURQUOI il entend une voix, et laquelle.
   */
  raison: string;
  /** Faut-il présenter les nombres à l'écran faute de voix ? */
  enVisuel: boolean;
}

const FRANCAIS = /^fr(-|$)/i;

/**
 * Examine les voix de l'appareil et retient la première voix LOCALE française.
 *
 * La liste est passée en paramètre plutôt que lue ici : `getVoices()` rend
 * souvent une liste vide au premier appel et se remplit après l'événement
 * `voiceschanged`, et un module qui lirait lui-même se tromperait une fois sur
 * deux au chargement. L'écran attend l'événement, puis demande.
 */
export function examinerLesVoix(voix: readonly SpeechSynthesisVoice[]): EtatDeLaVoix {
  if (!voix.length) {
    return {
      voix: null,
      raison:
        'Aucune voix de synthèse n’a été trouvée sur cet appareil : les nombres sont présentés à l’écran.',
      enVisuel: true,
    };
  }
  const locales = voix.filter((v) => v.localService && FRANCAIS.test(v.lang));
  if (locales.length) {
    return {
      voix: locales[0],
      raison: `Les nombres sont dits par la voix « ${locales[0].name} », installée sur cet appareil.`,
      enVisuel: false,
    };
  }
  /*
     Il y a des voix, mais aucune qui convienne. On distingue les deux cas, parce
     que la marche à suivre n'est pas la même : installer une voix française, ou
     en installer une qui ne passe pas par le réseau.
  */
  const francaisesDistantes = voix.some((v) => FRANCAIS.test(v.lang));
  return {
    voix: null,
    raison: francaisesDistantes
      ? 'Les voix françaises de cet appareil passent par le réseau. Cyclades ne s’en sert pas : ' +
        'les nombres sont présentés à l’écran. Installer une voix française hors ligne les ferait entendre.'
      : 'Aucune voix française n’est installée sur cet appareil : les nombres sont présentés à l’écran.',
    enVisuel: true,
  };
}

/**
 * Dit un nombre, et rend `false` si rien n'a pu être dit.
 *
 * `cancel()` avant de parler : à cadence rapide — l'intervalle descend à 50 ms —
 * les énoncés s'empileraient et la voix prendrait du retard sur l'exercice
 * jusqu'à dire un nombre qui n'est plus à l'écran.
 */
export function direLeNombre(
  synthese: SpeechSynthesis,
  etat: EtatDeLaVoix,
  nombre: number,
  debit = 1.5,
): boolean {
  if (!etat.voix) return false;
  try {
    synthese.cancel();
    const enonce = new SpeechSynthesisUtterance(String(nombre));
    enonce.voice = etat.voix;
    enonce.lang = etat.voix.lang;
    enonce.rate = debit;
    synthese.speak(enonce);
    return true;
  } catch {
    /* Une synthèse qui refuse de parler ne doit pas arrêter la séance : l'écran
       a de quoi présenter le nombre, et c'est ce qu'il fera. */
    return false;
  }
}
