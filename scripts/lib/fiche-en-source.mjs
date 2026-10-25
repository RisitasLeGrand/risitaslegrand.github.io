/**
 * Réécrire une fiche au format source, depuis ce que la publication en porte.
 *
 * ## Pourquoi ce module existe à part, et pourquoi il ne bricole plus de YAML
 *
 * La première version de la récupération fabriquait le YAML à la main, clé par
 * clé. Elle marchait sur les trois fiches d'exemple — qui n'ont pas de champ
 * `correction` — et **cassait sur le corpus réel**, où la correction d'un QCM
 * porte des structures imbriquées : `par_option` est une liste d'objets,
 * `sources` et `visuel` en sont. Un `String(valeur)` les écrivait
 * `'[object Object]'`, et le build refusait le corpus récupéré en bloc :
 * « expected array, received string ».
 *
 * Le défaut est passé pour une seule raison : l'aller-retour ne portait que
 * sur `content-exemple/`, et l'exemple ne couvrait pas ce champ. Un corpus
 * d'exemple est un échantillon, pas une garantie — c'est la leçon, et elle
 * vaut pour le prochain outil autant que pour celui-ci.
 *
 * Ce module emploie donc `yaml`, déjà dans les dépendances de développement du
 * dépôt, et qui sait sérialiser n'importe quelle profondeur. Écrire soi-même
 * un sérialiseur YAML, c'est se donner rendez-vous avec le cas qu'on n'a pas
 * prévu — ici, le rendez-vous a eu lieu.
 */
import YAML from 'yaml';

/**
 * Une liste d'items YAML, telle qu'une section de fiche l'écrit.
 *
 * `lineWidth: 0` désactive le repliement des lignes longues. Replié, le texte
 * resterait lisible par l'analyseur mais deviendrait pénible à relire et à
 * corriger à la main — et une fiche récupérée est faite pour être relue.
 */
export function blocYaml(items) {
  if (!items?.length) return '';
  return YAML.stringify(items, { lineWidth: 0 }).trimEnd();
}

/**
 * Le front-matter d'une fiche, dans l'ordre où le dépôt l'écrit.
 *
 * L'ordre est tenu parce qu'il se relit : matière, fascicule, titre, rang,
 * étiquettes. `yaml` respecte l'ordre d'insertion d'un objet, il suffit donc
 * de le construire dans le bon.
 */
export function frontMatter({ matiere, fascicule, titre, ordre, tags }) {
  return YAML.stringify(
    { matiere, fascicule, titre, ordre, tags: tags ?? [] },
    { lineWidth: 0 },
  ).trimEnd();
}

/**
 * Une question de QCM, ramenée au format source.
 *
 * ## La réponse revient par son rang, pas par son texte
 *
 * La publication ne porte que `bonnes: [index]` — le `reponse:` écrit dans la
 * source, texte ou rang, n'y est plus. Le schéma accepte les deux ; on écrit
 * le rang, qui est exactement ce que la publication dit. Deux options au texte
 * identique ne créent donc aucune ambiguïté, là où réécrire le texte en aurait
 * créé une.
 */
export function questionEnSource(q) {
  return {
    question: q.question,
    options: q.options,
    ...(q.bonnes?.length === 1 ? { reponse: q.bonnes[0] } : { reponses: q.bonnes }),
    ...(q.explication ? { explication: q.explication } : {}),
    ...(q.correction ? { correction: q.correction } : {}),
    ...(q.partie ? { partie: q.partie } : {}),
  };
}

/**
 * Une carte, ramenée au format source.
 *
 * La source acceptait `q:`/`r:` comme `question:`/`reponse:`. La publication ne
 * porte que les noms longs : c'est donc eux qu'on réécrit. La fiche est
 * équivalente pour le build, différente à la lecture, et le rapport le dit.
 */
export function carteEnSource(c) {
  return {
    question: c.question,
    reponse: c.reponse,
    ...(c.partie ? { partie: c.partie } : {}),
  };
}

/** Assemble le fichier source complet d'une fiche. */
export function ficheEnSource({ entete, cours, fiche, flashcards, quiz, pretest }) {
  const morceaux = ['---', frontMatter(entete), '---', ''];
  const section = (titre, corps) => {
    if (!corps) return;
    morceaux.push(titre, '', corps.trim(), '');
  };
  section('## Cours complet', cours);
  section('## Fiche simplifiée', fiche);
  section('## Flashcards', blocYaml((flashcards ?? []).map(carteEnSource)));
  section('## Quiz', blocYaml((quiz ?? []).map(questionEnSource)));
  section('## Prétest', blocYaml((pretest ?? []).map(questionEnSource)));
  return morceaux.join('\n').replace(/\n{3,}/g, '\n\n');
}
