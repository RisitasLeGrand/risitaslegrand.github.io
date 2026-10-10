/**
 * La fabrique de prompts : un contexte, une intention, un texte à copier.
 *
 * Fonction **pure**. Elle ne lit ni le réseau, ni IndexedDB, ni le DOM : on lui
 * donne un contexte déjà constitué et elle rend une chaîne. C'est ce qui la
 * rend vérifiable sans navigateur, et c'est aussi ce qui rend l'absence
 * d'appel réseau facile à prouver — il n'y a rien ici qui puisse en faire un.
 *
 * ## Six préréglages, parce que six questions reviennent
 *
 * Une case de texte libre devant une page blanche produit toujours la même
 * demande vague. Les six préréglages nomment ce qu'on veut réellement d'un
 * assistant quand on révise, et chacun porte une consigne écrite qui change la
 * forme de la réponse attendue — pas seulement son sujet.
 *
 * ## L'assistant est invité à contredire
 *
 * La consigne commune lui demande de dire explicitement si une correction ou
 * une réponse fournie lui paraît inexacte. Les corrections du site portent un
 * indicateur de confiance, et celles marquées « moyenne » sont précisément
 * celles établies sans corrigé officiel : le prompt les signale comme telles,
 * de sorte que l'assistant sache **où** il est permis de douter. C'est plus
 * honnête que de tout présenter avec la même assurance, et cela donne au
 * bouton une seconde utilité — relire les réponses incertaines de la banque.
 */
import type { Bloc, Contexte, Rang } from './contexte';
import { parcoursOuDefaut, type Parcours } from '../../lib/parcours/registre';

export const BUDGET = 8000;

/** Ce qu'on attend de l'assistant. */
export type Intention =
  | 'expliquer'
  | 'diagnostiquer'
  | 'illustrer'
  | 'interroger'
  | 'approfondir'
  | 'verifier';

export interface Preregage {
  id: Intention;
  /** Le libellé du bouton. */
  libelle: string;
  /** Ce que la personne lit avant de choisir. */
  description: string;
  /** La consigne envoyée, écrite à la première personne. */
  consigne: string;
}

export const PREREGLAGES: Preregage[] = [
  {
    id: 'expliquer',
    libelle: 'Explique-moi',
    description: 'Reprendre la notion depuis le début, simplement.',
    consigne:
      'Explique-moi cette notion depuis le début, en français simple, sans supposer que je ' +
      'connais déjà le vocabulaire technique. Définis les termes que tu emploies la première ' +
      'fois qu’ils apparaissent.',
  },
  {
    id: 'diagnostiquer',
    libelle: 'Pourquoi je me suis trompé',
    description: 'Nommer la confusion précise, pas seulement la bonne réponse.',
    consigne:
      'Dis-moi quelle confusion précise explique ma réponse. Ne te contente pas de redonner la ' +
      'bonne réponse : nomme la distinction que je n’ai pas faite, et donne-moi un moyen de ne ' +
      'plus la manquer.',
  },
  {
    id: 'illustrer',
    libelle: 'Donne-moi un exemple',
    description: 'Un cas concret, et un contre-exemple.',
    consigne:
      'Donne-moi un cas concret qui illustre cette notion, puis un contre-exemple proche qui ' +
      'n’en relève pas, et dis en une phrase ce qui les sépare.',
  },
  {
    id: 'interroger',
    libelle: 'Interroge-moi',
    description: 'Trois questions pour voir si j’ai compris.',
    consigne:
      'Pose-moi trois questions courtes sur ce point, de difficulté croissante, et attends mes ' +
      'réponses avant de corriger. Ne donne pas les réponses tout de suite.',
  },
  {
    id: 'approfondir',
    libelle: 'Approfondis',
    description: 'Ce qu’un bon copie-type ajouterait.',
    consigne:
      'Dis-moi ce qu’une très bonne copie ajouterait sur ce point au concours que je prépare : ' +
      'références précises, chiffres récents, débats en cours, et les nuances qui distinguent ' +
      'une réponse correcte d’une réponse remarquée.',
  },
  {
    id: 'verifier',
    libelle: 'Vérifie',
    description: 'Contrôler ce que le site affirme.',
    consigne:
      'Vérifie l’exactitude de ce que la correction ci-dessous affirme. Si quelque chose y est ' +
      'faux, daté ou imprécis, dis-le et donne la version juste avec sa source. Si tout est ' +
      'exact, dis-le aussi, brièvement.',
  },
];

export function prereglage(id: Intention): Preregage {
  // Un identifiant inconnu ne doit pas vider le prompt de sa consigne : à
  // défaut, c'est l'explication qu'on demande, qui est la demande la plus
  // générale des six.
  return PREREGLAGES.find((p) => p.id === id) ?? PREREGLAGES[0];
}

/**
 * L'ouverture du prompt, qui nomme le concours préparé.
 *
 * C'était une chaîne littérale — « le concours externe de l'INSP » — et elle
 * portait deux erreurs à la fois : la voie, puisque le parcours par défaut est
 * le concours **interne**, et le concours lui-même dès qu'une question vient
 * d'une autre banque que celle de l'INSP. Le concours vient donc du registre
 * des parcours, qui est le seul endroit où il est déclaré.
 */
function enTete(p: Parcours): string {
  return `Tu m’aides à préparer ${p.concours.phrase}. Réponds en français.`;
}

const CONTRADICTION =
  'Si une correction ou une réponse reproduite ci-dessous te paraît inexacte, datée ou ' +
  'incomplète, dis-le explicitement : je préfère une contradiction argumentée à une ' +
  'confirmation. Les passages marqués « confiance moyenne » ont été établis sans corrigé ' +
  'officiel — c’est là qu’il faut d’abord regarder.';

export const MARQUE_TRONCATURE = '[extrait tronqué]';

export interface OptionsDePrompt {
  intention: Intention;
  /**
   * Le parcours préparé, dont le concours ouvre le prompt. Facultatif pour que
   * les essais restent lisibles : à défaut, c'est le parcours par défaut du
   * registre, et non une chaîne codée en dur.
   */
  parcours?: Parcours;
  /** Ce que la personne ajoute de sa main. Facultatif. */
  demande?: string;
  budget?: number;
}

export interface Resultat {
  texte: string;
  /** Les titres des blocs retirés faute de place, dans l'ordre du retrait. */
  retires: string[];
  /** Les titres des blocs conservés mais raccourcis. */
  tronques: string[];
  longueur: number;
}

/** Coupe un texte à la limite de paragraphe précédant `maximum`. */
export function couperAuxParagraphes(texte: string, maximum: number): string {
  if (texte.length <= maximum) return texte;
  const place = Math.max(0, maximum - MARQUE_TRONCATURE.length - 2);
  const debut = texte.slice(0, place);
  // On recule jusqu'à une fin de paragraphe, et à défaut jusqu'à une fin de
  // phrase : couper au milieu d'un mot donne un texte qui a l'air corrompu, et
  // couper au milieu d'une phrase fait dire au cours autre chose que ce qu'il
  // dit — une négation perdue suffit.
  const coupeParagraphe = debut.lastIndexOf('\n\n');
  const coupePhrase = Math.max(debut.lastIndexOf('. '), debut.lastIndexOf('.\n'));
  const coupe = coupeParagraphe > place * 0.4 ? coupeParagraphe : coupePhrase > 0 ? coupePhrase + 1 : place;
  return `${debut.slice(0, coupe).trimEnd()}\n${MARQUE_TRONCATURE}`;
}

function rendreBloc(b: Bloc): string {
  return `## ${b.titre}\n${b.texte}`;
}

function assembler(contexte: Contexte, blocs: Bloc[], options: OptionsDePrompt): string {
  const parts = [
    enTete(options.parcours ?? parcoursOuDefaut(null)),
    prereglage(options.intention).consigne,
    CONTRADICTION,
  ];
  if (contexte.situation.length) {
    parts.push(`## Où j’en suis\n${contexte.situation.join(' › ')}`);
  }
  for (const b of blocs) parts.push(rendreBloc(b));
  const demande = options.demande?.trim();
  if (demande) parts.push(`## Ma demande\n${demande}`);
  return parts.join('\n\n');
}

/**
 * Le prompt, ramené sous le budget.
 *
 * L'ordre de la coupe est celui des rangs : on retire d'abord les blocs de
 * rang 5, puis 4, puis 3, puis 2 ; les blocs de rang 1 ne sont jamais retirés.
 * Si le rang 1 seul dépasse encore — un passage de cours très long sélectionné
 * à la main —, c'est lui qu'on raccourcit, aux limites de paragraphe, avec sa
 * marque. Mieux vaut un extrait signalé comme tronqué qu'un prompt refusé.
 */
export function construirePrompt(contexte: Contexte, options: OptionsDePrompt): Resultat {
  const budget = options.budget ?? BUDGET;
  const retires: string[] = [];
  const tronques: string[] = [];
  let blocs = [...contexte.blocs].sort((a, b) => a.rang - b.rang);

  let texte = assembler(contexte, blocs, options);
  for (const rang of [5, 4, 3, 2] as Rang[]) {
    if (texte.length <= budget) break;
    const restants = blocs.filter((b) => b.rang !== rang);
    if (restants.length === blocs.length) continue;
    for (const b of blocs.filter((b) => b.rang === rang)) retires.push(b.titre);
    blocs = restants;
    texte = assembler(contexte, blocs, options);
  }

  if (texte.length > budget) {
    // Il ne reste que du rang 1. On raccourcit le plus long, puis le suivant,
    // jusqu'à tenir — raccourcir tout le monde d'un coup abîmerait aussi les
    // blocs courts, qui ne coûtent rien.
    const ordre = [...blocs].sort((a, b) => b.texte.length - a.texte.length);
    for (const b of ordre) {
      if (texte.length <= budget) break;
      const trop = texte.length - budget;
      const cible = Math.max(120, b.texte.length - trop - MARQUE_TRONCATURE.length - 2);
      const coupe = couperAuxParagraphes(b.texte, cible);
      if (coupe === b.texte) continue;
      blocs = blocs.map((x) => (x === b ? { ...x, texte: coupe } : x));
      tronques.push(b.titre);
      texte = assembler(contexte, blocs, options);
    }
  }

  return { texte, retires, tronques, longueur: texte.length };
}

/**
 * Le lien « Ouvrir dans Claude », ou `null` si le prompt est trop long.
 *
 * Vérifié : `https://claude.ai/new?q=…` ouvre une conversation neuve avec le
 * prompt prérempli. Mais le transport par URL casse bien avant la fenêtre de
 * contexte du modèle, et l'encodage gonfle le texte — un retour à la ligne
 * devient `%0A`, chaque accent six caractères. Le lien n'est donc offert que
 * s'il tient, et sinon la fenêtre dit pourquoi : « Copier » reste le chemin
 * garanti, et c'est l'action principale.
 *
 * ## Pourquoi 6 000 et non 2 000
 *
 * Le plan retenait 2 000, d'après une recommandation d'usage courante. Mesure
 * faite sur le site : le **plus court** prompt que ce module sache produire —
 * un terme de glossaire, sa définition, la phrase où on l'a rencontré — pèse
 * 1 300 caractères et en fait près de 2 700 une fois encodé, le français étant
 * accentué et le prompt structuré en paragraphes. À 2 000, le lien n'aurait
 * donc **jamais** été offert, pas même dans le cas pour lequel il avait été
 * prévu : un bouton mort, et un motif affiché à chaque ouverture.
 *
 * 6 000 reste très en deçà de ce qu'un navigateur transporte (de l'ordre de
 * 32 000 caractères), et laisse passer le glossaire, une flashcard courte et
 * les items de Cog-Training, tout en écartant les prompts de quiz et de fiche,
 * qui dépassent les 10 000 une fois encodés. Ce qui n'est pas vérifié, et que
 * la fenêtre assume, c'est ce que `claude.ai` accepte exactement : d'où le
 * repli, qui n'est pas un repli mais l'action principale — « Copier ».
 */
export const PLAFOND_URL = 6000;

export function lienClaude(texte: string, plafond = PLAFOND_URL): string | null {
  const encode = encodeURIComponent(texte);
  if (encode.length > plafond) return null;
  return `https://claude.ai/new?q=${encode}`;
}
