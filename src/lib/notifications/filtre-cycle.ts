/**
 * Le filtre du cycle — phase 1 du prompt 32, et la première chose écrite.
 *
 * ## Pourquoi il vient avant tout le reste
 *
 * Le § 1 n° 3 l'exige « testé dès la phase 1, même si le module de cycle
 * n'est pas construit ». C'est écrit pour empêcher exactement ce qui serait
 * arrivé autrement : un centre qui marche, puis un filtre ajouté à la fin,
 * et un endroit où personne n'a pensé à le brancher. Un filtre de
 * confidentialité posé après coup est un filtre troué.
 *
 * Rien ne produit encore de signal de cycle. Le filtre n'en est pas moins
 * complet : il refuse ce qui n'existe pas encore, et il refusera de la même
 * façon le jour où cela existera.
 *
 * ## Le défaut est l'exclusion, et c'est le cœur du module
 *
 * Une source **inconnue du registre est exclue**. Ce n'est pas de la
 * prudence décorative : une source non enregistrée est une source que
 * personne n'a relue. Le jour où un lot ajoute un producteur de signal et
 * oublie de le déclarer, le centre ne l'affichera pas — c'est gênant, c'est
 * visible, et cela se corrige en une ligne. L'inverse — afficher par défaut
 * — ferait passer un signal du cycle dans le compteur sans que personne ne
 * s'en aperçoive, et cela ne se corrige pas après coup : c'est vu.
 *
 * La même logique que `ecritDansLaBranche()` au prompt 38 : le défaut d'une
 * politique est le refus, parce qu'un défaut permissif agit sur la foi
 * d'une chaîne de caractères.
 *
 * ## Ce que « suivre la sensibilité du cycle » veut dire
 *
 * Le prompt l'énumère (6.1 du 30), et la liste est plus large que « le
 * cycle » : le journal, les statuts, **les corrections qui en révèlent**,
 * les molécules de classe contraceptif ou hormone sexuelle, et les rappels
 * de prise de ces molécules. Une correction anodine qui porte sur une
 * donnée de cycle en révèle l'existence ; c'est pourquoi la sensibilité se
 * transmet par la source visée, et non par le genre du signal.
 */

/**
 * Les classes de molécules dont la seule mention renseigne sur le cycle.
 *
 * Déclarées ici parce qu'elles n'existent **nulle part ailleurs** : le
 * registre des molécules (`odyssee/molecules.ts`) ne porte aucune notion de
 * classe à ce jour. Le filtre ne peut donc pas les lire ; il les nomme, et
 * le module de cycle devra reprendre ces mêmes identifiants.
 */
export const CLASSES_DU_CYCLE: readonly string[] = ['contraceptif', 'hormone-sexuelle'];

export interface SourceDeclaree {
  /** L'identifiant de la source, tel que le centre le range. */
  id: string;
  /** Suit-elle la sensibilité du cycle ? */
  suitLeCycle: boolean;
  /**
   * Faut-il connaître la classe de la molécule pour admettre ce signal ?
   *
   * ## Le trou que ce champ ferme, et pourquoi il n'était pas visible
   *
   * `rappel-de-prise` est déclaré `suitLeCycle: false` — « admis, SAUF pour
   * une molécule de classe du cycle ». L'exception reposait sur
   * `classeMolecule`, et **aucune molécule ne porte de classe** : le registre
   * (`odyssee/molecules.ts`) n'a pas cette notion, et rien ne pourra la
   * renseigner avant qu'un RCP lu la fournisse.
   *
   * Donc la condition `signal.classeMolecule && CLASSES_DU_CYCLE.includes(…)`
   * ne se déclenchait jamais : un rappel de prise de contraceptif entrait au
   * centre, avec son libellé « Rappels de prise », et l'exception écrite
   * juste au-dessus ne protégeait rien. Le trou était **dans la donnée
   * manquante**, pas dans la logique, ce qui est la façon la plus sûre de ne
   * pas se faire voir.
   *
   * Quand ce champ est vrai, un signal sans classe connue est **écarté**.
   * C'est l'option (a) arbitrée par le pilote le 19 octobre à 12 h 46 : on
   * refuse en attendant de savoir, parce que l'autre défaut révèle, et qu'un
   * défaut qui révèle ne se corrige pas après coup.
   *
   * La conséquence est à dire à la personne, et non à cacher : **les rappels
   * de prise n'apparaissent pas au centre tant que la classe des molécules
   * n'est pas sourcée.** C'est une fonction en moins, visible, plutôt qu'une
   * fuite invisible.
   */
  exigeUneClasse?: boolean;
  /** Pourquoi, en une phrase affichable dans une revue de code. */
  pourquoi: string;
}

const S = (s: SourceDeclaree): SourceDeclaree => s;

/**
 * Les sources connues du centre, et leur rapport au cycle.
 *
 * La liste est **courte et explicite**, et elle grandira d'une ligne par
 * source à chaque phase 5. Une source absente d'ici est exclue : c'est le
 * mécanisme, pas un effet de bord.
 */
export const SOURCES_DECLAREES: readonly SourceDeclaree[] = [
  S({ id: 'question-a-trancher', suitLeCycle: false, pourquoi: 'Corrections et conflits de synchronisation, hors de ceux qui visent une donnée de cycle — voir `viseLeCycle`.' }),
  S({ id: 'avis-de-fusion', suitLeCycle: false, pourquoi: 'Ne nomme aucune branche ni aucun nombre (décision 5).' }),
  S({ id: 'proposition', suitLeCycle: false, pourquoi: 'Adaptation, question de profil, habitude. Aucune ne porte sur le cycle dans ce lot.' }),
  S({ id: 'avertissement-avant-analyse', suitLeCycle: false, pourquoi: 'Source relevée dans le code et absente du tableau 2.2 du prompt ; portée aux trois domaines déclarés, cycle non compris.' }),
  S({ id: 'rappel-de-prise', suitLeCycle: false, exigeUneClasse: true, pourquoi: 'Admis SEULEMENT si la classe de la molécule est connue et hors cycle. Aucune molécule n’a de classe à ce jour, donc aucun rappel de prise n’entre au centre : option (a), 19 octobre.' }),
  S({ id: 'veille-du-rythme', suitLeCycle: false, pourquoi: 'Titre neutre hors de Psyché, et jamais de notification du système — le 27 l’interdit.' }),
  S({ id: 'rappel-de-sauvegarde', suitLeCycle: false, pourquoi: 'Ne porte sur aucune donnée.' }),
  S({ id: 'revue-manquee', suitLeCycle: false, pourquoi: 'Compte des revues en attente, aucun contenu (prompt 36).' }),
  S({ id: 'occurrence-manquee', suitLeCycle: false, pourquoi: 'Signalée une fois, jamais accumulée (prompt 38).' }),
  S({ id: 'pointage-a-reporter', suitLeCycle: false, pourquoi: 'Un nombre, et rien d’autre : le contenu est chiffré (A-6 option D).' }),
  S({ id: 'apprentissage-etendu', suitLeCycle: false, pourquoi: 'Jamais par notification du système (le 25).' }),
  S({ id: 'trajectoire', suitLeCycle: false, pourquoi: 'Portée aux domaines déclarés ; aucune trajectoire de cycle n’existe.' }),
  S({ id: 'journal-du-cycle', suitLeCycle: true, pourquoi: '6.1 du 30. Le module n’existe pas ; la ligne existe pour que le jour où il naîtra, rien ne soit à ajouter ici.' }),
  S({ id: 'statut-du-cycle', suitLeCycle: true, pourquoi: '4.2 du 30, même raison.' }),
];

const PAR_ID = new Map(SOURCES_DECLAREES.map((s) => [s.id, s]));

export const sourceDeclaree = (id: string): SourceDeclaree | undefined => PAR_ID.get(id);

/** Ce qu'un appelant soumet au filtre. Volontairement pauvre : un signal, pas un contenu. */
export interface SignalAFiltrer {
  source: string;
  /** La référence vers la source. Le filtre ne l'ouvre jamais ; il peut la comparer. */
  refSource?: string;
  /**
   * La classe de la molécule concernée, quand le signal en vise une.
   *
   * Séparée de la source parce qu'un rappel de prise est admis en général et
   * refusé pour certaines molécules : la sensibilité vient de l'objet, pas
   * du type de signal.
   */
  classeMolecule?: string | null;
  /**
   * La source que ce signal VISE, quand il en vise une.
   *
   * C'est ce qui attrape « une correction qui révèle une donnée de cycle » :
   * la correction est une source anodine, mais ce qu'elle corrige ne l'est
   * pas, et la sensibilité se transmet.
   */
  viseLaSource?: string | null;
}

/**
 * Ce signal suit-il la sensibilité du cycle, et doit-il donc être écarté ?
 *
 * Cinq raisons d'exclure, et deux sont des formes de la même : l'ignorance.
 * Une source inconnue est exclue ; une molécule dont la classe est inconnue
 * l'est aussi, pour une source qui exige de la connaître. C'est ce qui
 * protège le plus, parce que c'est ce qui vaut avant que quoi que ce soit
 * existe.
 */
export function suitLaSensibiliteDuCycle(signal: SignalAFiltrer): boolean {
  const declaree = PAR_ID.get(signal.source);
  if (!declaree) return true; // Source inconnue : exclue, par construction.
  if (declaree.suitLeCycle) return true;
  /*
     L'IGNORANCE EXCLUT, et c'est l'ordre qui compte : ce contrôle vient AVANT
     celui de la classe. Une classe inconnue n'est pas une classe hors cycle.
  */
  if (declaree.exigeUneClasse && !signal.classeMolecule) return true;
  if (signal.classeMolecule && CLASSES_DU_CYCLE.includes(signal.classeMolecule)) return true;
  if (signal.viseLaSource) {
    const visee = PAR_ID.get(signal.viseLaSource);
    // Une source visée inconnue est, elle aussi, traitée comme sensible.
    if (!visee || visee.suitLeCycle) return true;
  }
  return false;
}

/** Ce qui entre au centre. Tout le reste est écarté, silencieusement et sans trace. */
export const admis = <T extends SignalAFiltrer>(signaux: readonly T[]): T[] =>
  signaux.filter((s) => !suitLaSensibiliteDuCycle(s));

/**
 * Les trois portes que le filtre garde, nommées pour qu'on ne puisse pas en
 * oublier une.
 *
 * Le § 1 n° 3 dit « hors du centre, hors du compteur, hors de toute
 * notification du système ». Trois endroits, donc trois appels — et un essai
 * qui vérifie que les trois passent par la même fonction, parce que trois
 * filtres écrits séparément finissent par diverger.
 */
export const PORTES_GARDEES: readonly string[] = ['centre', 'compteur', 'notification'];
