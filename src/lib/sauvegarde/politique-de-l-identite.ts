/**
 * QUI, DE L'APPAREIL OU DU FICHIER, DIT L'IDENTITÉ — B-7 du 58.
 *
 * ## Le défaut
 *
 * Une restauration remplace le magasin `etat` en entier. Or `etat` ne porte pas
 * que des réglages : il porte l'identité de cet appareil, son horloge logique,
 * la liste des appareils qu'il a vus, l'état de son appairage et la paire de
 * clés de sa boîte aux lettres. Mesuré de bout en bout par le constructeur sur
 * un vrai fichier : `etat` y voyage avec `appareil`, `boite.privee`,
 * `boite.publique`, `coffre.sel` et `horloge`.
 *
 * Restaurer une sauvegarde faisait donc prendre à l'appareil l'identité de
 * celui qui l'avait écrite. Deux appareils se retrouvaient avec le même
 * identifiant — celui qui arbitre les horloges logiques égales — et leurs
 * opérations cessaient d'avoir un ordre de fusion cohérent.
 *
 * Et l'écran promettait le contraire : la description du groupe « Réglages et
 * profil » dit que « l'identité de cet appareil, son appairage et la clé de
 * votre coffre ne sont pas touchés ». C'était vrai de l'effacement à la carte,
 * que gouverne `estTechnique` de `groupes.ts`, et FAUX de la restauration
 * complète, qui ne passe pas par là.
 *
 * ## Pourquoi deux branches et non une règle
 *
 * La tentation était de ne jamais rien reprendre du fichier. Le pilote l'a
 * écartée : cela vide la question qu'Alexis a voulue (décision 3 — la poser à
 * chaque restauration), et surtout cela casse le cas le plus courant.
 *
 * Quelqu'un dont le téléphone est tombé dans l'eau restaure sa sauvegarde sur
 * le neuf. Cet appareil REMPLACE l'ancien : s'il prend une identité neuve, ses
 * pairs ne le reconnaissent pas, et toutes les opérations déjà écrites sous
 * l'ancienne identité deviennent orphelines.
 *
 * Quelqu'un qui installe Cyclades sur une tablette À CÔTÉ de son téléphone
 * restaure la même sauvegarde. Cet appareil S'AJOUTE : s'il prend l'identité du
 * téléphone, les deux se confondent, et le dépôt a déjà payé ce défaut une fois
 * — c'est celui du palier 12, où une base de passage forgeait une identité.
 *
 * Le même fichier, le même geste, deux réponses justes. Seule la personne sait
 * laquelle, donc on la lui demande.
 *
 * ## Ce qui ne se reprend JAMAIS, dans les deux cas
 *
 * Les clés de la boîte aux lettres. `boite.privee` est scellée sous la clé du
 * coffre et ne vaut que pour l'appareil qui l'a créée ; la reprendre ne
 * donnerait pas une boîte qui marche, elle donnerait une boîte qui a l'air de
 * marcher. L'appairage se refait donc toujours, et l'écran le dit plutôt que de
 * laisser la personne le découvrir au premier pli perdu.
 *
 * ## Le classement est explicite, et l'oubli est bruyant
 *
 * Aucune clé TECHNIQUE ne reçoit de valeur par défaut. `source()` rend
 * `non-classee`, et un essai balaie les sources pour vérifier qu'aucune clé
 * écrite par le code n'y tombe — le même procédé que `groupes.ts`, qui a trouvé
 * `derniereSauvegarde` oubliée de ses deux listes.
 *
 * Un défaut aurait été commode et faux dans les deux sens. « Local » par défaut
 * perdrait silencieusement un réglage le jour où quelqu'un en ajoute un ;
 * « fichier » par défaut ferait voyager silencieusement la prochaine clé
 * d'identité. Une clé nouvelle doit faire échouer la batterie, pas choisir à
 * notre place.
 *
 * Le PRÉFIXE ne suffit pas, et c'est le piège de ce lot : `groupes.ts` range
 * tout `coffre.` ensemble parce que, pour l'effacement, tout `coffre.` est
 * également intouchable. Pour la restauration, non — `coffre.sel` DOIT voyager,
 * puisque la clé des données en dérive ; `coffre.enveloppe` ne doit PAS, parce
 * qu'elle n'emballe la clé que pour cette session et cet appareil ; et le délai
 * de verrouillage automatique est un réglage comme un autre. Trois réponses
 * sous un seul préfixe.
 */

/** Ce que la personne répond à « cet appareil remplace-t-il l'ancien ? ». */
export type RoleDeLAppareil = 'remplace-l-ancien' | 's-ajoute';

/** Qui l'emporte, pour une clé donnée. */
export type Source = 'fichier' | 'local' | 'non-classee';

/**
 * Les clés que le fichier ne donne jamais, quel que soit le rôle.
 *
 * La raison est écrite à côté de chacune : une liste de clés sans ses raisons
 * se fait élaguer par le premier qui la trouve trop longue.
 */
export const JAMAIS_DU_FICHIER: Readonly<Record<string, string>> = {
  'boite.privee':
    'la clé privée de la boîte aux lettres, scellée sous la clé du coffre et ' +
    'propre à l’appareil qui l’a créée. La reprendre donnerait une boîte qui a ' +
    'l’air de marcher.',
  'boite.publique':
    'sa clé publique. Sans la privée correspondante, la reprendre ferait ' +
    'annoncer aux pairs une boîte dont cet appareil ne peut rien lire.',
  appairage:
    'le secret partagé de l’appairage. G-8 du 58 : il ne doit même pas sortir ' +
    'dans un export, et l’appairage se refait toujours.',
  certification: 'la certification de l’appairage, qui ne vaut que pour la paire de clés d’ici.',
  'dossier-partage':
    'le dossier d’échange choisi sur CET appareil. Celui d’un autre ne désigne ' +
    'rien ici, et le proposer ferait chercher un dossier qui n’existe pas.',
  lotsRecus: 'la comptabilité des lots déjà reçus ici. Celle d’un autre ferait sauter des lots.',
  derniereVeille: 'la dernière veille de cet appareil, qui ne dit rien du fichier.',
  fusionEnCours:
    'le travail qu’une fusion interrompue a laissé en chemin ICI. La liste d’un ' +
    'autre appareil désignerait des cibles absentes d’ici.',
  'coffre.sel-enveloppe':
    'le sel de la clé d’ENVELOPPE, qui n’emballe la clé que pour cette session ' +
    'et cet appareil. Mesuré par le constructeur : il ne voyage pas, et c’est ' +
    'pour cela que deux appareils du même mot de passe ont des enveloppes ' +
    'différentes.',
  'coffre.enveloppe': 'la clé emballée elle-même, qui ne vaut que sous le sel d’enveloppe d’ici.',
  'coffre.migration': 'l’état de migration du coffre de cet appareil.',
};

/**
 * Les clés que le fichier donne SEULEMENT quand cet appareil remplace l'ancien.
 *
 * C'est le cœur de la décision, et la raison pour laquelle la question est
 * posée à la personne.
 */
export const SELON_LE_ROLE: Readonly<Record<string, string>> = {
  appareil:
    'l’identité qui arbitre les horloges logiques égales. Reprise quand ' +
    'l’appareil remplace l’ancien, pour que les pairs le reconnaissent et que ' +
    'les opérations déjà écrites gardent un ordre ; locale quand il s’ajoute, ' +
    'sans quoi deux appareils se confondent.',
  horloge:
    'l’horloge logique hybride, qui ne doit jamais reculer. Reprise avec ' +
    'l’identité, et seulement avec elle : une horloge d’un autre appareil sous ' +
    'une identité locale ferait reculer la nôtre ou la projetterait en avant.',
  appareilsVus:
    'ce que l’appareil a observé de ses pairs — vu le, reçu jusqu’à, envoyé ' +
    'jusqu’à. Reprise quand l’appareil REMPLACE l’ancien, et c’est contre-' +
    'intuitif : j’avais d’abord rangé cette clé parmi celles qui ne voyagent ' +
    'jamais, en me disant que ce sont des constats et non des données. Le pilote ' +
    'l’a tranché autrement, et il a raison — un appareil qui reprend l’identité ' +
    'de l’ancien doit aussi savoir QUI sont ses pairs, sinon il reprend un nom ' +
    'sans reprendre son carnet d’adresses, et il redemande à chacun tout depuis ' +
    'le début. Locale quand il s’ajoute, puisqu’il n’a encore rien observé.',
  derniereSauvegarde:
    'la date de la dernière sauvegarde réussie. Un appareil qui REMPLACE hérite ' +
    'de l’historique de la personne ; un appareil qui S’AJOUTE n’a, lui, jamais ' +
    'sauvegardé — lui donner cette date tairait le rappel au moment précis où il ' +
    'faudrait l’entendre. Le pilote ne l’a pas nommée : c’est ma lecture, et je ' +
    'la lui signale.',
};

/**
 * Les clés que le fichier donne toujours, bien qu'elles soient techniques.
 *
 * Deux seulement, et chacune pour une raison qui tient à la restauration
 * elle-même.
 */
export const TOUJOURS_DU_FICHIER: Readonly<Record<string, string>> = {
  'coffre.sel':
    'le sel de la clé des DONNÉES. Sans lui, la bonne personne avec le bon mot ' +
    'de passe n’ouvre pas ses propres enregistrements scellés : la sauvegarde ' +
    'serait restaurée et illisible. Décision du 26/10, et c’est ce qui fait ' +
    'qu’une sauvegarde restaurée sur un profil neuf s’ouvre.',
  'coffre.verrou-automatique.delai':
    'le délai avant verrouillage automatique. Technique par son PRÉFIXE, réglage ' +
    'par sa nature — il est au catalogue des réglages — et c’est cette clé-là ' +
    'qui a fait échouer mon classement au premier essai, comme il devait. Elle ' +
    'voyage comme un réglage : quelqu’un qui restaure sur un appareil neuf veut ' +
    'y retrouver le délai qu’il avait choisi, pas celui d’usine.',
  reglagesSync:
    'le registre versionné des réglages. Ce n’est pas un réglage, c’est la ' +
    'machinerie qui les fait converger — et restaurer des réglages sans leur ' +
    'registre les laisserait écraser par les entrées plus anciennes des pairs. ' +
    'La pesée doit continuer de fonctionner après une restauration, pas repartir ' +
    'de zéro.',
};

/**
 * Qui l'emporte pour cette clé d'`etat`.
 *
 * Une clé qui n'est dans aucune des trois listes rend `non-classee` si elle est
 * technique, et `fichier` sinon : restaurer les données de la personne est le
 * but du geste, et une clé qui n'est pas technique EST une donnée de la
 * personne. Le classement des techniques, lui, ne se devine pas.
 */
export function source(
  clef: string,
  role: RoleDeLAppareil,
  estTechnique: (clef: string) => boolean,
): Source {
  if (clef in JAMAIS_DU_FICHIER) return 'local';
  if (clef in TOUJOURS_DU_FICHIER) return 'fichier';
  if (clef in SELON_LE_ROLE) return role === 'remplace-l-ancien' ? 'fichier' : 'local';
  return estTechnique(clef) ? 'non-classee' : 'fichier';
}

/**
 * Les clés techniques que ce module ne classe pas.
 *
 * Rendue plutôt que jetée : un essai la confronte à la liste du dépôt et au
 * balayage des sources, et c'est là que l'oubli doit faire du bruit — pas à
 * l'exécution, chez la personne qui restaure.
 */
export function clefsNonClassees(clefs: readonly string[]): string[] {
  return clefs
    .filter(
      (clef) =>
        !(clef in JAMAIS_DU_FICHIER) &&
        !(clef in TOUJOURS_DU_FICHIER) &&
        !(clef in SELON_LE_ROLE),
    )
    .sort();
}

/**
 * Ce que l'écran doit dire, et qui n'est pas une politesse.
 *
 * Dans les deux cas l'appairage est à refaire, parce que les clés de boîte ne
 * se reprennent jamais. Le taire ferait découvrir la panne au premier pli
 * perdu, c'est-à-dire au moment où la personne croit que tout est revenu.
 */
export function ceQueLEcranDoitDire(role: RoleDeLAppareil): readonly string[] {
  const commun = [
    'L’appairage avec vos autres appareils est à refaire : les clés de votre ' +
      'boîte aux lettres ne sont jamais reprises d’une sauvegarde.',
  ];
  return role === 'remplace-l-ancien'
    ? [
        'Cet appareil reprend l’identité de celui qui a écrit la sauvegarde, pour ' +
          'que vos autres appareils le reconnaissent.',
        ...commun,
        'Pensez à délier l’ancien appareil, qui porte encore la même identité.',
      ]
    : [
        'Cet appareil garde sa propre identité : vos autres appareils continuent ' +
          'de le distinguer de celui qui a écrit la sauvegarde.',
        ...commun,
      ];
}
