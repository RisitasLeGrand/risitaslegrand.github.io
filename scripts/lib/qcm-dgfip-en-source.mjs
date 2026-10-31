/**
 * Ramener la banque « QCM — DGFiP » PUBLIÉE vers sa SOURCE.
 *
 * ## Pourquoi cet outil existe
 *
 * La récupération du corpus rend les fiches au format source, mais pas la
 * banque de QCM : elle la dépose telle quelle, au format publié, dans
 * `annexes/qcm-dgfip.json`. Conséquence pratique, et c'est elle qui compte :
 * `content/qcm-dgfip/` est vide, donc le build ne voit pas la banque, donc
 * **540 questions échappent à tout contrôle** — le schéma ne les lit pas, les
 * corrections ne peuvent pas y être écrites, et les trois parcours DGFiP n'ont
 * rien à servir.
 *
 * Ce module fait le chemin inverse : du format publié vers le YAML par
 * rubrique que `content/qcm-dgfip/` attend.
 *
 * ## La seule garantie qui vaille : l'aller-retour à l'identique
 *
 * Une conversion de contenu se mesure, elle ne se promet pas. Le format publié
 * est le produit du schéma — `bonnes: [index]` au lieu de `reponse:`,
 * identifiants calculés, rubriques triées — et une réécriture approximative
 * passerait le build tout en changeant silencieusement une clef de réponse.
 *
 * D'où `differencesDeBanque`, employé par l'outil ET par l'essai : on réécrit
 * la source, on la recharge AVEC LE CHARGEUR DU BUILD, et on compare champ par
 * champ à la banque publiée. Tant que la comparaison n'est pas vide, rien
 * n'est écrit dans `content/`.
 *
 * Ce que l'identité protège concrètement : `id = idStable(rubrique | énoncé)`.
 * Un énoncé réécrit à une espace près reçoit un identifiant neuf, et
 * l'historique par question conservé dans le navigateur de la personne qui
 * révise devient orphelin. L'identité des identifiants n'est pas une élégance,
 * c'est la progression de quelqu'un.
 */
import YAML from 'yaml';

import { questionEnSource } from './fiche-en-source.mjs';

/**
 * Le nom de fichier d'une rubrique.
 *
 * ## L'ordre des fichiers n'est pas décoratif
 *
 * Le chargeur lit les fichiers par `readdir().sort()` et empile les questions
 * dans cet ordre : le nom de fichier décide donc de l'ordre du tableau publié.
 * Les accents sont retirés pour cette raison précise — un tri d'octets place
 * « Français » après « Logique », et la banque réécrite ne serait plus dans
 * l'ordre de celle qu'elle remplace.
 *
 * L'ordre, lui, n'entre dans AUCUN identifiant. Un nom de fichier différent ne
 * perdrait donc aucune progression ; il ferait seulement échouer la preuve
 * d'aller-retour, qui compare aussi l'ordre. C'est le bon partage : la preuve
 * est stricte, les conséquences d'un écart sont bénignes.
 */
export function nomDeFichier(rubrique) {
  const abrege = rubrique
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!abrege) throw new Error(`rubrique « ${rubrique} » : aucun nom de fichier n'en sort`);
  return `${abrege}.yml`;
}

/**
 * Une question de QCM DGFiP, ramenée au format source.
 *
 * Le noyau — énoncé, options, clef de réponse, explication — est délégué à
 * `questionEnSource`, qui le fait déjà pour les quiz de fiche et qui porte la
 * décision la plus délicate : la réponse revient **par son rang**, pas par son
 * texte, parce que la publication ne porte que le rang et que deux options au
 * texte identique rendraient le texte ambigu. La refaire ici, c'est se donner
 * rendez-vous avec le jour où les deux versions divergeront.
 *
 * Les champs propres à la banque viennent ensuite, dans l'ordre où ils se
 * relisent : d'où vient la question, pour quels parcours, à quelle date elle
 * est vraie, ce qu'elle a d'incertain, puis la correction détaillée — la plus
 * longue en dernier, pour que l'en-tête de la question reste lisible d'un coup
 * d'œil.
 */
export function questionDgfipEnSource(q) {
  const { correction, ...noyau } = questionEnSource(q);
  return {
    ...noyau,
    ...(q.source ? { source: q.source } : {}),
    categorie_origine: q.categorie_origine,
    ...(q.temporalite ? { temporalite: q.temporalite } : {}),
    ...(q.incertain ? { incertain: q.incertain } : {}),
    ...(correction ? { correction } : {}),
  };
}

/**
 * Défait la résolution des renvois « rappel de cours » d'une correction.
 *
 * La source écrit un renvoi comme un CHEMIN de fiche ; le build le résout en
 * `{ id, titre }`, et c'est la forme résolue que la publication porte. Le
 * schéma **refuse** la forme résolue — explicitement, pour que la réécriture
 * ne puisse pas l'oublier.
 *
 * Un renvoi dont on ne sait pas refaire le chemin fait ÉCHOUER la conversion.
 * L'alternative était de le laisser tomber en silence : la question partirait
 * en correction sans son lien vers le cours, et personne ne saurait qu'il a
 * existé. Mieux vaut un outil qui s'arrête en nommant la question.
 *
 * @param {unknown} correction
 * @param {(id: string) => string | undefined} cheminDeLaFiche
 * @param {string} ou  De quoi parle-t-on, pour le message d'erreur.
 */
export function defaireLesRenvois(correction, cheminDeLaFiche, ou) {
  if (!correction || typeof correction !== 'object') return correction;
  const rappels = correction.rappel_de_cours;
  if (!Array.isArray(rappels)) return correction;
  const refaits = rappels.map((renvoi) => {
    if (typeof renvoi === 'string') return renvoi;
    const vise = renvoi?.id;
    const chemin = vise === undefined ? undefined : cheminDeLaFiche(vise);
    if (chemin === undefined) {
      throw new Error(
        `${ou} : le renvoi « rappel de cours » vers ` +
          `« ${renvoi?.titre ?? vise ?? '?'} » ne retrouve pas le chemin de sa fiche. ` +
          'Donnez la correspondance identifiant → chemin, ou retirez le renvoi : ' +
          'un chemin inventé ferait échouer le build sur un message qui ne dirait pas pourquoi.',
      );
    }
    return chemin.replace(/\.md$/, '');
  });
  return { ...correction, rappel_de_cours: refaits };
}

const ENTETE = [
  '# Banque « QCM — DGFiP », une rubrique par fichier.',
  '#',
  '# Fichier SOURCE : c\'est ici que les corrections s\'écrivent. Le build le lit,',
  '# le valide contre le schéma, et dérive l\'identifiant de chaque question de',
  '# son couple rubrique + énoncé — un énoncé retouché à une espace près reçoit',
  '# donc un identifiant neuf, et la progression enregistrée pour lui devient',
  '# orpheline. Corrigez la correction, pas l\'énoncé.',
  '',
].join('\n');

/**
 * La banque publiée, rendue en fichiers source — un par rubrique.
 *
 * @param {{rubriques: object[], questions: object[]}} banque  Telle que
 *   `annexes/qcm-dgfip.json` la porte.
 * @param {object} [options]
 * @param {(id: string) => string | undefined} [options.cheminDeLaFiche]  Pour
 *   défaire les renvois « rappel de cours ». Sans elle, un renvoi résolu fait
 *   échouer la conversion plutôt que de disparaître.
 * @returns {{nom: string, texte: string, rubrique: string, combien: number}[]}
 *   Dans l'ordre où le chargeur lira les fichiers.
 */
export function banqueEnSource(banque, { cheminDeLaFiche = () => undefined } = {}) {
  const ordreDeLaRubrique = new Map();
  for (const r of banque.rubriques ?? []) ordreDeLaRubrique.set(r.nom, r.ordre);

  /* Le regroupement suit l'ordre d'apparition des questions, et non l'ordre du
     tableau des rubriques : celui-ci est TRIÉ par le chargeur (par rang, puis
     par nom), alors que les questions restent dans l'ordre des fichiers lus.
     Grouper d'après le tableau trié retournerait une banque dont les questions
     ne seraient plus dans le même ordre que celles qu'elle remplace. */
  const parRubrique = new Map();
  for (const q of banque.questions ?? []) {
    if (!parRubrique.has(q.rubrique)) parRubrique.set(q.rubrique, []);
    parRubrique.get(q.rubrique).push(q);
  }

  const fichiers = [];
  const nomsVus = new Map();
  for (const [rubrique, questions] of parRubrique) {
    const nom = nomDeFichier(rubrique);
    const deja = nomsVus.get(nom);
    if (deja !== undefined) {
      /* Deux rubriques dans un même fichier : la seconde écraserait la
         première, et la banque perdrait une rubrique entière sans un mot. */
      throw new Error(
        `les rubriques « ${deja} » et « ${rubrique} » donnent le même nom de ` +
          `fichier (« ${nom} ») : renommez-en une.`,
      );
    }
    nomsVus.set(nom, rubrique);

    const corps = {
      rubrique,
      /* Le rang décide de la place de la rubrique sur la page d'accueil. Le
         chargeur lui donne 999 par défaut ; l'écrire explicitement évite qu'une
         rubrique publiée au rang 3 reparte à la fin sans qu'on l'ait voulu. */
      ordre: ordreDeLaRubrique.get(rubrique) ?? 999,
      questions: questions.map((q) =>
        questionDgfipEnSource({
          ...q,
          correction: defaireLesRenvois(
            q.correction,
            cheminDeLaFiche,
            `rubrique « ${rubrique} », question « ${String(q.question).slice(0, 60)}… »`,
          ),
        }),
      ),
    };

    fichiers.push({
      nom,
      rubrique,
      combien: questions.length,
      /* `lineWidth: 0` désactive le repliement : replié, un énoncé long reste
         lisible par l'analyseur mais devient pénible à relire et à corriger, et
         ces fichiers sont faits pour être corrigés à la main. */
      texte: `${ENTETE}${YAML.stringify(corps, { lineWidth: 0 })}`,
    });
  }
  /* Le chargeur lira par ordre de nom : rendre les fichiers dans cet ordre-là
     rend la liste directement comparable à ce qu'il produira. */
  fichiers.sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0));
  return fichiers;
}

/* --- La comparaison qui tranche ----------------------------------------- */

/**
 * Forme comparable d'une valeur : celle qu'un aller-retour JSON en laisse.
 *
 * La banque publiée a traversé `JSON.stringify`, qui efface les clefs valant
 * `undefined`. Le chargeur, lui, rend `source: undefined` pour une question
 * sans source. Comparer sans ce passage ferait voir une différence là où le
 * fichier publié et l'objet rechargé disent la même chose — et une preuve qui
 * crie au loup est une preuve qu'on finit par ne plus lire.
 */
const comparable = (v) => JSON.parse(JSON.stringify(v ?? null));

/**
 * Ramène les renvois « rappel de cours » des deux côtés à des IDENTIFIANTS.
 *
 * ## Le seul champ que l'aller-retour ne peut pas rendre tel quel
 *
 * La publication porte un renvoi résolu — `{ id, titre }` — là où la source
 * écrit un CHEMIN de fiche. Ce n'est pas le convertisseur qui transforme :
 * c'est le build, dans une passe postérieure au chargeur, et le chargeur rend
 * donc des chemins quand la publication porte des objets.
 *
 * Comparer les deux formes directement signalerait un écart sur toute question
 * portant un renvoi, alors que la conversion serait juste. Comparer en
 * ignorant le champ laisserait passer l'inverse : un renvoi perdu, ou pointant
 * vers la mauvaise fiche. On ramène donc les deux côtés à ce qu'ils désignent
 * — l'identifiant de la fiche visée — ce qui signale un renvoi perdu, un
 * renvoi en trop et un renvoi dévié, et rien d'autre.
 *
 * Un chemin dont on ne connaît pas l'identifiant est laissé tel quel : il
 * paraîtra alors comme un écart, ce qui est exactement ce qu'il faut — la
 * conversion s'est appuyée sur une correspondance que la comparaison n'a pas.
 */
function renvoisEnIdentifiants(correction, idParChemin) {
  if (!correction || typeof correction !== 'object') return correction;
  const rappels = correction.rappel_de_cours;
  if (!Array.isArray(rappels)) return correction;
  return {
    ...correction,
    rappel_de_cours: rappels.map((renvoi) => {
      if (renvoi && typeof renvoi === 'object') return renvoi.id ?? renvoi;
      const chemin = String(renvoi).replace(/\.md$/, '');
      return idParChemin.get(chemin) ?? renvoi;
    }),
  };
}

const banqueComparable = (banque, idParChemin) => ({
  rubriques: comparable(banque.rubriques ?? []),
  questions: comparable(banque.questions ?? []).map((q) =>
    q.correction
      ? { ...q, correction: renvoisEnIdentifiants(q.correction, idParChemin) }
      : q,
  ),
});

function differences(attendu, obtenu, ou, dans) {
  if (Array.isArray(attendu) || Array.isArray(obtenu)) {
    if (!Array.isArray(attendu) || !Array.isArray(obtenu)) {
      dans.push(`${ou} : ${Array.isArray(attendu) ? 'liste attendue' : 'liste inattendue'}`);
      return;
    }
    if (attendu.length !== obtenu.length) {
      dans.push(`${ou} : ${attendu.length} entrée(s) attendue(s), ${obtenu.length} obtenue(s)`);
      return;
    }
    attendu.forEach((a, i) => differences(a, obtenu[i], `${ou}[${i}]`, dans));
    return;
  }
  if (attendu && obtenu && typeof attendu === 'object' && typeof obtenu === 'object') {
    const clefs = [...new Set([...Object.keys(attendu), ...Object.keys(obtenu)])].sort();
    for (const c of clefs) {
      if (!(c in attendu)) {
        dans.push(`${ou}.${c} : champ en trop (${JSON.stringify(obtenu[c]).slice(0, 80)})`);
        continue;
      }
      if (!(c in obtenu)) {
        dans.push(`${ou}.${c} : champ perdu (${JSON.stringify(attendu[c]).slice(0, 80)})`);
        continue;
      }
      differences(attendu[c], obtenu[c], `${ou}.${c}`, dans);
    }
    return;
  }
  if (attendu !== obtenu) {
    dans.push(
      `${ou} : attendu ${JSON.stringify(attendu)?.slice(0, 120)}, ` +
        `obtenu ${JSON.stringify(obtenu)?.slice(0, 120)}`,
    );
  }
}

/**
 * En quoi la banque rechargée diffère-t-elle de la banque publiée ?
 *
 * Renvoie la liste des écarts, vide quand l'aller-retour est à l'identique.
 * Les identifiants sont comparés les premiers et à part : c'est le seul écart
 * dont la conséquence est irréparable — une progression orpheline ne se
 * retrouve pas — et le dire d'abord évite de le chercher au milieu de deux
 * cents lignes de prose.
 *
 * @param {{rubriques: object[], questions: object[]}} publiee
 * @param {{rubriques: object[], questions: object[]}} rechargee
 * @param {object} [options]
 * @param {Map<string, string>} [options.cheminParId]  La correspondance
 *   identifiant → chemin employée pour défaire les renvois « rappel de
 *   cours ». Sans elle, une question portant un renvoi paraît comme un écart,
 *   et c'est le bon comportement : la comparaison ne sait pas dire si le
 *   chemin réécrit désigne la bonne fiche.
 * @returns {string[]}
 */
export function differencesDeBanque(publiee, rechargee, { cheminParId = new Map() } = {}) {
  const idParChemin = new Map();
  for (const [id, chemin] of cheminParId) idParChemin.set(chemin.replace(/\.md$/, ''), id);
  const a = banqueComparable(publiee, idParChemin);
  const b = banqueComparable(rechargee, idParChemin);
  const ecarts = [];

  const idsA = (a.questions ?? []).map((q) => q.id);
  const idsB = (b.questions ?? []).map((q) => q.id);
  if (idsA.length !== idsB.length) {
    ecarts.push(
      `IDENTIFIANTS : ${idsA.length} question(s) publiée(s), ${idsB.length} rechargée(s)`,
    );
  }
  const manquants = idsA.filter((id) => !idsB.includes(id));
  const surnumeraires = idsB.filter((id) => !idsA.includes(id));
  if (manquants.length) {
    ecarts.push(`IDENTIFIANTS perdus (${manquants.length}) : ${manquants.slice(0, 5).join(', ')}`);
  }
  if (surnumeraires.length) {
    ecarts.push(
      `IDENTIFIANTS inconnus de la publication (${surnumeraires.length}) : ` +
        surnumeraires.slice(0, 5).join(', '),
    );
  }
  if (!manquants.length && !surnumeraires.length && idsA.join('|') !== idsB.join('|')) {
    ecarts.push(
      'ORDRE : les mêmes questions, dans un autre ordre. Les identifiants sont ' +
        'sauvés ; le nom des fichiers ne reproduit pas l\'ordre de lecture d\'origine.',
    );
  }

  differences(a.rubriques ?? [], b.rubriques ?? [], 'rubriques', ecarts);
  differences(a.questions ?? [], b.questions ?? [], 'questions', ecarts);
  return ecarts;
}
