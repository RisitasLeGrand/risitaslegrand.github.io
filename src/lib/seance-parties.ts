/**
 * Les séances par partie (prompt 46, P5) : ce qui se calcule sans écran.
 *
 * Une séance porte par défaut sur **toute la fiche**, et c'est le choix qui
 * reste par défaut (décision 3). Mais on peut n'en cocher qu'une ou plusieurs
 * parties, et la séance se restreint alors : la lecture, l'audio, les cartes
 * et les QCM.
 *
 * Ce fichier ne touche ni le DOM, ni la base, ni le contenu déchiffré — comme
 * `podcast-noyau.ts`, et pour la même raison : ce sont des règles, elles se
 * vérifient dans Node, et un essai ne devrait pas avoir à monter un
 * navigateur pour savoir ce qui arrive quand une partie n'a que deux cartes.
 */

/* ══════════════════════════════════════════════════════════════════════════
   LE SEUIL, et pourquoi c'est celui-là
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * En dessous de ce nombre de cartes retenues, on complète avec celles de la
 * fiche entière.
 *
 * Le prompt demande de « dire le seuil retenu », donc le voici, avec sa
 * raison. **Cinq** est le plus petit nombre qui fasse encore une révision :
 * en dessous, la séance est finie avant d'avoir commencé, et l'effet de la
 * répétition espacée — revoir plusieurs fois, à des moments différents — ne
 * joue pas. Trois cartes ne sont pas une séance courte, c'est un sondage.
 *
 * Le complément n'est jamais silencieux : l'écran dit « 3 cartes sur cette
 * partie, complétées par 2 de la fiche ». Taire le complément laisserait
 * croire à un ciblage qui n'a pas eu lieu, et fausserait le jugement qu'on
 * porte ensuite sur ce qu'on sait de cette partie.
 */
export const SEUIL_CARTES = 5;

/**
 * Même principe pour les questions, mais **trois**.
 *
 * Un QCM se juge sur une proportion de bonnes réponses : trois questions en
 * donnent déjà une lisible — deux sur trois se comprend —, là où deux n'offre
 * que « tout, la moitié, rien ». Et une question de QCM couvre plus de
 * matière qu'une carte, donc il en faut moins pour balayer une partie.
 */
export const SEUIL_QUESTIONS = 3;

/* ══════════════════════════════════════════════════════════════════════════
   Le couple (fiche, partie), et son aller-retour par l'adresse
   ══════════════════════════════════════════════════════════════════════════ */

export interface CouplePartie {
  fiche: string;
  partie: string;
}

/**
 * Encode une sélection de parties pour une adresse : « fiche:partie,… ».
 *
 * Le nom de la fiche est dans le couple, et il doit y être : une séance peut
 * porter sur des parties de DEUX fiches différentes, et deux fiches peuvent
 * très bien avoir une partie de même identifiant — les identifiants sont
 * dérivés des ancres, donc « i-introduction » existe probablement dix fois
 * dans le contenu. Sans la fiche, la sélection serait ambiguë.
 */
export function encoderParties(couples: readonly CouplePartie[]): string {
  return couples.map((c) => `${encodeURIComponent(c.fiche)}:${encodeURIComponent(c.partie)}`).join(',');
}

/**
 * Relit une sélection de parties depuis une adresse.
 *
 * Tolérante par construction : un morceau mal formé est ignoré plutôt que de
 * faire échouer la page. Une adresse bricolée à la main doit donner une
 * séance plus large, jamais un écran en panne.
 */
export function analyserParties(brut: string | null | undefined): CouplePartie[] {
  if (!brut) return [];
  const couples: CouplePartie[] = [];
  for (const morceau of brut.split(',')) {
    const separateur = morceau.lastIndexOf(':');
    if (separateur <= 0) continue;
    const fiche = decodeURIComponent(morceau.slice(0, separateur)).trim();
    const partie = decodeURIComponent(morceau.slice(separateur + 1)).trim();
    if (fiche && partie) couples.push({ fiche, partie });
  }
  return couples;
}

/** Les parties retenues pour une fiche donnée. Vide = la fiche entière. */
export function partiesDeLaFiche(couples: readonly CouplePartie[], fiche: string): Set<string> {
  return new Set(couples.filter((c) => c.fiche === fiche).map((c) => c.partie));
}

/* ══════════════════════════════════════════════════════════════════════════
   Le choix des cartes et des questions
   ══════════════════════════════════════════════════════════════════════════ */

export interface Restriction<T> {
  /** Ce que la séance propose, dans l'ordre : les ciblées puis le complément. */
  retenus: T[];
  /** Combien viennent vraiment des parties cochées. */
  cibles: number;
  /** Combien ont été ajoutés depuis le reste de la fiche pour atteindre le seuil. */
  complement: number;
}

/**
 * Restreint une liste d'items (cartes, questions) aux parties cochées, et
 * complète si le seuil n'est pas atteint.
 *
 * Deux propriétés, et ce sont elles que l'essai éprouve :
 *
 * - **aucune partie cochée ⇒ rien n'est restreint.** C'est le cas par défaut
 *   d'une séance, et il doit rendre la liste telle quelle, sans complément
 *   déclaré : « toute la fiche » n'est pas « la fiche entière en complément
 *   d'un ciblage vide ».
 * - **le complément ne reprend jamais un item déjà retenu.** Il vient du
 *   RESTE de la fiche, dans l'ordre, et s'arrête au seuil.
 *
 * Un item sans `partie` n'appartient à aucune partie : il n'est jamais ciblé,
 * et ne sert qu'au complément. C'est le sens du champ facultatif de P4 — en
 * cas de doute, la carte reste à la fiche.
 */
export function restreindreAuxParties<T extends { partie?: string }>(
  items: readonly T[],
  parties: ReadonlySet<string>,
  seuil: number,
): Restriction<T> {
  if (!parties.size) return { retenus: [...items], cibles: items.length, complement: 0 };

  const cibles = items.filter((i) => i.partie && parties.has(i.partie));
  if (cibles.length >= seuil) return { retenus: cibles, cibles: cibles.length, complement: 0 };

  const dejaPris = new Set(cibles);
  const reste = items.filter((i) => !dejaPris.has(i));
  const complement = reste.slice(0, Math.max(0, seuil - cibles.length));
  return {
    retenus: [...cibles, ...complement],
    cibles: cibles.length,
    complement: complement.length,
  };
}

/**
 * Ce que l'écran dit du ciblage, en français et sans « (s) ».
 *
 * Rend une chaîne vide quand il n'y a rien à dire — séance sur toute la
 * fiche, ou ciblage qui s'est suffi à lui-même sans complément.
 */
export function direLeCiblage(restriction: Restriction<unknown>, nom: 'carte' | 'question'): string {
  if (!restriction.complement) return '';
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  return (
    `${pluriel(restriction.cibles, nom)} sur cette sélection, ` +
    `complétée${restriction.cibles > 1 ? 's' : ''} par ${restriction.complement} de la fiche.`
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Ce qui a été vu, et ce qui reste
   ══════════════════════════════════════════════════════════════════════════ */

/** La forme minimale d'une séance pour ce calcul. */
export interface SeanceLue {
  fiches?: string[];
  parties?: { fiche: string; partie: string }[];
  statut?: 'prevue' | 'terminee';
}

export interface SuiviDesParties {
  /** Les parties dont une séance ou une écoute dit qu'elles ont été vues. */
  vues: Set<string>;
  /**
   * Vrai si une séance a porté sur la fiche ENTIÈRE : toutes ses parties sont
   * alors vues, y compris celles qui ne sont dans aucun champ `parties`.
   */
  ficheEntiere: boolean;
}

/**
 * Les parties d'une fiche qu'on a déjà vues, d'après les séances.
 *
 * LE POINT QUI FAIT TENIR LA COMPATIBILITÉ. Une séance ancienne porte la
 * fiche dans `fiches` et n'a pas de champ `parties` : elle vaut pour la fiche
 * entière, et c'est la vérité — les séances par partie n'existaient pas. Une
 * séance récente qui a coché la fiche SANS cocher de partie vaut elle aussi
 * pour la fiche entière, pour la même raison.
 *
 * Seule une séance qui nomme des parties de cette fiche restreint ce qu'elle
 * prouve. Lire l'absence de `parties` comme « aucune partie vue » aurait
 * effacé d'un coup tout l'historique de progression.
 */
export function suiviDesParties(
  seances: readonly SeanceLue[],
  fiche: string,
): SuiviDesParties {
  const vues = new Set<string>();
  let ficheEntiere = false;
  for (const seance of seances) {
    if (!(seance.fiches ?? []).includes(fiche)) continue;
    const nommees = (seance.parties ?? []).filter((p) => p.fiche === fiche);
    if (!nommees.length) ficheEntiere = true;
    else for (const p of nommees) vues.add(p.partie);
  }
  return { vues, ficheEntiere };
}

/* ══════════════════════════════════════════════════════════════════════════
   La durée d'une partie (prompt 46, P5, pour la planification du 42)
   ══════════════════════════════════════════════════════════════════════════ */

/** Mots lus par minute, pour une lecture attentive de cours. */
const MOTS_PAR_MINUTE_LECTURE = 180;

/**
 * Estime la durée d'une partie, en secondes.
 *
 * Deux sources, dans cet ordre de confiance :
 *
 * 1. **le repère audio**, quand la partie suivante en a un aussi : la
 *    différence des deux est une durée MESURÉE sur l'onde, pas estimée ;
 * 2. **le nombre de mots**, sinon — pour la dernière partie, ou pour une
 *    fiche audio sans repères.
 *
 * Préférer le repère n'est pas un détail : la durée dite d'une partie décide
 * du découpage d'une longue fiche en plusieurs séances, et un découpage fondé
 * sur un débit moyen se trompe précisément là où les parties sont inégales,
 * c'est-à-dire là où le découpage sert à quelque chose.
 */
/**
 * Les parties à proposer pour la prochaine séance d'une longue fiche
 * (prompt 46, P5, réglage « Répartir une longue fiche sur plusieurs
 * séances »).
 *
 * On reprend **là où l'on s'était arrêté** : les parties déjà vues sont
 * sautées, et l'on prend les suivantes dans l'ordre du cours jusqu'à remplir
 * la durée visée. Dans l'ORDRE, et non les plus courtes d'abord : un cours se
 * suit, et proposer la partie III avant la II pour gagner trois minutes
 * ferait lire la conclusion avant l'argument.
 *
 * Rend un tableau vide quand il n'y a rien à découper — fiche courte, ou
 * toutes les parties déjà vues. L'appelant comprend alors « propose la fiche
 * entière, comme avant », qui est le comportement par défaut.
 *
 * La première partie non vue est TOUJOURS retenue, même si elle dépasse à
 * elle seule la durée visée : sinon une partie plus longue que la séance ne
 * serait jamais proposée, et la fiche resterait bloquée là pour toujours.
 */
export function partiesAProposer(
  parties: readonly { id: string; secondes: number }[],
  dejaVues: ReadonlySet<string>,
  secondesCible: number,
): string[] {
  const restantes = parties.filter((p) => !dejaVues.has(p.id));
  if (!restantes.length) return [];
  const retenues: string[] = [];
  let cumul = 0;
  for (const partie of restantes) {
    if (retenues.length && cumul + partie.secondes > secondesCible) break;
    retenues.push(partie.id);
    cumul += partie.secondes;
  }
  /* Tout tient dans une séance : il n'y a rien à découper. */
  return retenues.length === parties.length ? [] : retenues;
}

export function dureeEstimeeDeLaPartie(options: {
  mots: number;
  debut?: number | null;
  debutSuivante?: number | null;
  dureeTotale?: number | null;
}): number {
  const { mots, debut, debutSuivante, dureeTotale } = options;
  if (typeof debut === 'number') {
    const fin = typeof debutSuivante === 'number' ? debutSuivante : dureeTotale;
    if (typeof fin === 'number' && fin > debut) return Math.round(fin - debut);
  }
  return Math.round((mots / MOTS_PAR_MINUTE_LECTURE) * 60);
}
