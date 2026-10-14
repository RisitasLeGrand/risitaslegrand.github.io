/**
 * La passerelle vers la bibliothèque externe — et rien d'autre.
 *
 * ## Pourquoi ce fichier est aussi petit, et seul
 *
 * Il tient en quelques constantes parce que **c'est tout ce que Cyclades sait
 * de cette ressource** : une adresse, un avertissement, une mention. Pas un
 * composé, pas un lien, pas un titre, pas un témoignage. La bibliothèque est
 * une **donnée morte, en consultation seule** : elle ne nourrit aucune
 * analyse, aucune alerte, aucun calcul, aucun export, aucune synchronisation,
 * aucune recherche, aucun prompt d'IA.
 *
 * Sa petitesse est le contrôle : un fichier qui ne contient rien ne peut rien
 * faire fuir. Et un essai vérifie qu'aucun module d'analyse ne l'importe —
 * sans quoi la promesse ne tiendrait qu'à la relecture.
 *
 * ## Pourquoi aucun nom de molécule ne part dans l'adresse
 *
 * Le lien ouvre la **page d'accueil**, jamais une recherche pré-remplie. Ce
 * que quelqu'un consulte dans une bibliothèque de molécules est une donnée de
 * santé : la mettre dans une URL, c'est la confier au journal du navigateur,
 * à l'historique, et à qui regarde par-dessus l'épaule. Le nom passe par le
 * presse-papiers, qui ne voyage pas.
 *
 * ## Pourquoi pas de lien par indice
 *
 * La page numérote ses composés (`#c` suivi d'un nombre), et ces numéros
 * dépendent de la version publiée. Un lien qui ouvrirait un autre composé que
 * celui demandé serait pire que pas de lien du tout : il aurait l'air de
 * marcher.
 *
 * ## L'attribution, et d'où elle vient
 *
 * Le 14 octobre 2026, le propriétaire du dépôt a fait savoir — par
 * l'intermédiaire d'Alexis, qui le connaît — que la réutilisation ne pose pas
 * de difficulté **tant que NooTopics est cité**. C'est donc la seule
 * condition, et elle est tenue ici : le nom est une constante, il apparaît
 * partout où la ressource est nommée, et un essai le vérifie.
 *
 * Deux précisions que cette autorisation ne lève pas, et qu'il serait
 * malhonnête de laisser croire réglées :
 *
 *  - elle m'a été **rapportée**, elle n'est pas une licence écrite sur le
 *    dépôt. L'écran cite donc la source sans affirmer un accord que Cyclades
 *    ne peut pas produire. Ce qui en est su est écrit dans
 *    `docs/cyclades/message-proprietaire-bibliotheque.md`, daté ;
 *  - elle ne peut pas couvrir les **témoignages de tiers** que la
 *    bibliothèque rassemble, dont les auteurs ne sont pas le propriétaire du
 *    dépôt. Cyclades n'en reprend aucun, et c'est indépendant de tout accord.
 *
 * ## Ce qui n'a pas pu être vérifié
 *
 * Le 14 octobre 2026, depuis la machine de construction, le domaine de cette
 * bibliothèque est injoignable (le proxy de sortie refuse tout sauf GitHub et
 * les dépôts de paquets). **Que la page s'ouvre, qu'elle fonctionne sans
 * compte et que son champ de recherche accepte un nom collé n'a donc pas pu
 * être constaté.** C'est écrit ici plutôt que supposé ailleurs.
 */

/**
 * Le nom à citer, à un seul endroit.
 *
 * C'est la condition posée par le propriétaire, et une condition qui tient à
 * un mot se tient mieux dans une constante que recopiée dans six écrans.
 *
 * Orthographe : « NooTopics », telle qu'Alexis l'a transmise. Le chemin du
 * dépôt écrit « Nootopics », avec un t minuscule — un seul caractère d'écart,
 * et c'est ce fichier qu'il faut corriger si c'est l'autre qui fait foi.
 */
export const NOM_BIBLIOTHEQUE = 'NooTopics';

/** La ligne de crédit, affichée partout où la ressource sert. */
export const ATTRIBUTION = `Source : ${NOM_BIBLIOTHEQUE} — bibliothèque communautaire, citée à la demande de son auteur.`;

/** La page d'accueil, sans paramètre ni fragment. */
export const ADRESSE_BIBLIOTHEQUE =
  'https://nootropics123.github.io/Nootopics-Neuroscience-Library/';

/** La mention fixe, présente partout où la ressource est nommée (2.0). */
export const MENTION_DONNEE_MORTE = `Ressource de consultation (${NOM_BIBLIOTHEQUE}). Non vérifiée. Cyclades ne l’utilise dans aucune de ses analyses.`;

/** L'avertissement d'une ligne, avant l'ouverture (2.1, décision 2). */
export const AVERTISSEMENT_SORTANT =
  `${NOM_BIBLIOTHEQUE} est une ressource communautaire externe, non vérifiée par Cyclades. ` +
  'Elle rassemble des liens vers des publications et des ' +
  // Phrase gardée d'un seul tenant : « essais:bibliotheque » la cherche telle
  // quelle dans le source, et une coupure la lui rendrait introuvable.
  'témoignages de tiers, dont des doses rapportées' +
  ' : ce ne sont ni des sources de Cyclades ni des conseils.';

/** Ce que Cyclades ne sait pas, et le dit (2.1). */
export const COUVERTURE_INCONNUE = `Cyclades ne sait pas si ${NOM_BIBLIOTHEQUE} couvre cette molécule.`;

/** Le libellé du lien. Il dit « externe » et « nouvel onglet » (accessibilité). */
export const LIBELLE_LIEN = `Chercher dans ${NOM_BIBLIOTHEQUE}`;

/** La clef de la préférence « ne plus afficher ». Donnée ordinaire. */
export const CLEF_AVERTISSEMENT_VU = 'bibliotheque.avertissement.vu';
