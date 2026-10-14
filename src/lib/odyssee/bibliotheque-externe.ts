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
 * ## Ce qui n'a pas pu être vérifié
 *
 * Le 14 octobre 2026, depuis la machine de construction, le domaine de cette
 * bibliothèque est injoignable (le proxy de sortie refuse tout sauf GitHub et
 * les dépôts de paquets). **Que la page s'ouvre, qu'elle fonctionne sans
 * compte et que son champ de recherche accepte un nom collé n'a donc pas pu
 * être constaté.** C'est écrit ici plutôt que supposé ailleurs.
 */

/** La page d'accueil, sans paramètre ni fragment. */
export const ADRESSE_BIBLIOTHEQUE =
  'https://nootropics123.github.io/Nootopics-Neuroscience-Library/';

/** La mention fixe, présente partout où la ressource est nommée (2.0). */
export const MENTION_DONNEE_MORTE =
  'Ressource de consultation. Non vérifiée. Cyclades ne l’utilise dans aucune de ses analyses.';

/** L'avertissement d'une ligne, avant l'ouverture (2.1, décision 2). */
export const AVERTISSEMENT_SORTANT =
  'Ressource communautaire externe, non vérifiée par Cyclades. Elle rassemble des liens ' +
  'vers des publications et des témoignages de tiers, dont des doses rapportées : ce ne ' +
  'sont ni des sources de Cyclades ni des conseils.';

/** Ce que Cyclades ne sait pas, et le dit (2.1). */
export const COUVERTURE_INCONNUE =
  'Cyclades ne sait pas si cette ressource couvre cette molécule.';

/** Le libellé du lien. Il dit « externe » et « nouvel onglet » (accessibilité). */
export const LIBELLE_LIEN = 'Chercher dans la bibliothèque externe';

/** La clef de la préférence « ne plus afficher ». Donnée ordinaire. */
export const CLEF_AVERTISSEMENT_VU = 'bibliotheque.avertissement.vu';
