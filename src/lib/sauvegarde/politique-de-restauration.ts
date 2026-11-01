/**
 * Que faire d'une sauvegarde selon la version de schéma qu'elle annonce.
 *
 * Module **pur** : il ne lit ni base, ni DOM, ni réseau, et n'écrit rien. On
 * lui donne ce qu'un en-tête annonce et la version locale, il rend un verdict.
 * C'est ce qui permet de l'éprouver sans navigateur, et surtout de relire la
 * décision sans avoir à suivre une restauration.
 *
 * ## Le défaut que ce module ferme
 *
 * `service.ts` l'écrivait noir sur blanc : « le champ est désormais JUSTE ; il
 * n'est toujours pas LU. Mesuré : aucun lecteur de ".schema" dans tout "src/",
 * alors que le type du format annonce "pour que la restauration sache
 * migrer" ». Une sauvegarde d'une version antérieure était donc restaurée
 * telle quelle, avec des enregistrements de l'ancienne forme, et plus rien
 * ensuite ne les transformait : les paliers de migration ne tournent qu'au
 * CHANGEMENT de version de la base, et une restauration n'en change pas.
 *
 * Le symptôme n'est pas une erreur mais un silence. Les écrans lisent des
 * champs absents, affichent des vides ou des zéros, et personne ne peut
 * remonter de là jusqu'à la version du fichier.
 *
 * ## Quatre cas, et le quatrième refuse
 *
 * | ce que le fichier annonce | ce qu'on fait |
 * |---|---|
 * | rien, ou 12 | on restaure, et on DIT que la version d'origine est inconnue |
 * | moins que la version locale | on restaure, puis on rejoue les paliers qui transforment les données |
 * | la version locale | restauration normale, rien à dire |
 * | plus que la version locale | **refus avant toute écriture** |
 *
 * Le refus est la seule réponse honnête au dernier cas : une version future a
 * pu changer le SENS d'un champ sans changer son nom, et deviner écrirait des
 * données fausses par-dessus des données justes. « Rechargez la page » est la
 * suite utile, parce que c'est exactement ce qui met à jour l'application.
 *
 * ## Pourquoi « 12 » est traité à part
 *
 * Ce n'est pas une version comme les autres : c'était une constante ÉCRITE À
 * LA MAIN qui est restée à 12 pendant que la base montait jusqu'à 43 (constat
 * G-7 du prompt 58). Tout fichier produit avant la correction annonce donc 12,
 * qu'il ait été écrit en version 12 ou en version 43.
 *
 * On ne peut donc rien en déduire, et surtout pas rejouer des paliers : les
 * rejouer sur des données DÉJÀ transformées est la façon la plus sûre de les
 * abîmer — le palier 12 crée des entrées de socle que rien ne dédoublonne, et
 * le bloc FSRS remet à neuf l'état de chaque carte. Un doute se dit ; il ne se
 * comble pas par un pari.
 */

/**
 * La valeur que les fichiers d'avant la correction G-7 annoncent tous.
 *
 * Elle ne vaut pas « version 12 » : elle vaut « on ne sait pas ». Un fichier
 * réellement écrit par une base en version 12 tombe dans le même cas, et c'est
 * le prix de l'ambiguïté — on préfère ne rien transformer plutôt que de
 * transformer à tort.
 */
export const SCHEMA_INDETERMINE = 12;

/**
 * Les paliers de `db.ts` qui TRANSFORMENT des enregistrements existants.
 *
 * Les trente-neuf autres ne créent que des magasins et des index : un magasin
 * absent d'une restauration est créé à l'ouverture de la base, et il n'y a
 * rien à rejouer pour lui.
 *
 * ## Comment cette liste a été établie, et ce qui m'a trompé d'abord
 *
 * En découpant le corps d'`upgrade()` bloc par bloc et en cherchant ce qui
 * touche à des enregistrements — `put`, `add`, `delete`, `openCursor`. Mon
 * premier relevé a compté le palier 42, à tort : son `openCursor` appartient
 * au bloc `ancienneVersion >= 1 && < 7` qui le SUIT, et qui n'est pas gardé
 * par `vers(n)`. Un découpage naïf par numéro rattache donc au palier 42 du
 * code qui n'est pas le sien. Le bloc FSRS est ici sous son vrai nom.
 *
 * ## L'idempotence, relevée palier par palier
 *
 * Elle décide de ce qu'on peut rejouer, et elle n'est pas uniforme :
 *
 * - **11** — les notes quittent la séance. Rejouable : une séance sans texte
 *   ne produit rien, et la seconde passe ne trouve plus de texte à déplacer.
 * - **12** — socle de révisions pour chaque carte. **PAS** rejouable : chaque
 *   passe tire des identifiants neufs, donc dédouble les socles.
 * - **13** — les clés auto-incrémentées deviennent des ULID. **PAS**
 *   rejouable : une seconde passe réécrirait des clés déjà stables.
 * - **14** — l'horloge logique des entrées de révision. Rejouable : le bloc
 *   est gardé par `if (!entree.hlc)`.
 * - **FSRS (1→7)** — l'état de modèle repart à neuf. **PAS** rejouable : une
 *   seconde passe effacerait la stabilité et la difficulté acquises.
 *
 * C'est pourquoi le rejeu n'est permis que sur une version CONNUE et
 * strictement inférieure : les enregistrements du fichier n'ont alors
 * traversé, par construction, aucun des paliers au-dessus d'elle. Ce n'est pas
 * une idempotence, c'est une garantie d'unicité — et elle est plus forte.
 */
export const PALIERS_QUI_TRANSFORMENT: readonly number[] = [11, 12, 13, 14];

/**
 * Le bloc FSRS n'est pas un palier numéroté : il s'applique aux bases ouvertes
 * entre la version 1 et la version 7. On le désigne par sa borne haute, qui est
 * la version à partir de laquelle une base l'a forcément déjà traversé.
 */
export const PALIER_FSRS = 7;

export type Verdict =
  | {
      quoi: 'refus';
      motif: 'schema-trop-recent';
      /** Ce que l'écran affiche, à la première personne du pluriel. */
      dire: string;
    }
  | {
      quoi: 'restaure';
      /** Les paliers à rejouer sur les données restaurées, en ordre croissant. */
      paliers: readonly number[];
      /** Une phrase à afficher, ou `null` quand il n'y a rien à signaler. */
      dire: string | null;
    };

/**
 * Les paliers à rejouer pour amener des données de la version `depuis` à la
 * version `jusqu_a`.
 *
 * Strictement au-dessus de `depuis` : un fichier écrit en version N a déjà
 * traversé le palier N. Et jusqu'à `jusqu_a` inclus, qui est la version que
 * cette application sait lire.
 */
export function paliersARejouer(depuis: number, jusqu_a: number): number[] {
  const liste = [...PALIERS_QUI_TRANSFORMENT];
  if (depuis < PALIER_FSRS) liste.push(PALIER_FSRS);
  return liste.filter((n) => n > depuis && n <= jusqu_a).sort((a, b) => a - b);
}

/**
 * Le verdict, pour UNE version annoncée.
 *
 * `schemaDuFichier` vaut `null` quand l'en-tête n'annonce rien : les tout
 * premiers fichiers du format, et ceux dont la branche n'a pas été déclarée.
 */
export function verdictPourUneVersion(
  schemaDuFichier: number | null,
  versionLocale: number,
): Verdict {
  if (schemaDuFichier === null || schemaDuFichier === SCHEMA_INDETERMINE) {
    return {
      quoi: 'restaure',
      paliers: [],
      dire:
        'Ce fichier ne dit pas de quelle version de Cyclades il vient. Il est ' +
        'restauré tel quel, sans transformation : si un écran paraît incomplet ' +
        'après la restauration, c’est de là que cela vient, et refaire une ' +
        'sauvegarde depuis cette version-ci suffit à repartir sur du net.',
    };
  }
  if (schemaDuFichier > versionLocale) {
    return {
      quoi: 'refus',
      motif: 'schema-trop-recent',
      dire:
        'Ce fichier vient d’une version plus récente de Cyclades que celle qui ' +
        'tourne ici. Rien n’a été touché : restaurer demanderait de devenir ce ' +
        'que nous ne savons pas encore lire. Rechargez la page pour mettre ' +
        'l’application à jour, puis réessayez.',
    };
  }
  if (schemaDuFichier === versionLocale) {
    return { quoi: 'restaure', paliers: [], dire: null };
  }
  const paliers = paliersARejouer(schemaDuFichier, versionLocale);
  return {
    quoi: 'restaure',
    paliers,
    dire:
      paliers.length === 0
        ? 'Ce fichier vient d’une version antérieure, mais rien n’a changé de ' +
          'forme entre-temps : il est restauré tel quel.'
        : 'Ce fichier vient d’une version antérieure. Les données restaurées ' +
          'sont mises à la forme actuelle avant d’être écrites.',
  };
}

/**
 * Le verdict pour un fichier ENTIER, qui peut déclarer plusieurs branches.
 *
 * ## Pourquoi ce n'est pas une simple boucle
 *
 * Une sauvegarde déclare une branche par domaine, chacune avec sa version de
 * schéma. Les combiner demande deux décisions, et elles ne vont pas dans le
 * même sens :
 *
 * - **le refus est contagieux.** UNE branche plus récente que ce qu'on sait
 *   lire suffit à refuser le fichier entier. Restaurer les autres et laisser
 *   celle-là de côté produirait une base à moitié d'une version et à moitié
 *   d'une autre, ce qui est pire que ne rien restaurer ;
 * - **le rejeu est l'union.** Chaque branche apporte ses propres
 *   enregistrements ; les paliers à rejouer sont donc tous ceux dont au moins
 *   une branche a besoin.
 *
 * Et l'indétermination gagne sur le reste : si une seule branche annonce une
 * version dont on ne peut rien déduire, on ne rejoue RIEN. Transformer les
 * magasins d'une branche sûre tout en laissant ceux d'une branche douteuse
 * intacts donnerait une base dont nul ne saurait plus dire la forme.
 */
export function verdictDUnFichier(
  schemas: readonly (number | null)[],
  versionLocale: number,
): Verdict {
  if (schemas.length === 0) return verdictPourUneVersion(null, versionLocale);

  const verdicts = schemas.map((s) => verdictPourUneVersion(s, versionLocale));
  const refus = verdicts.find((v) => v.quoi === 'refus');
  if (refus) return refus;

  const douteuse = schemas.some((s) => s === null || s === SCHEMA_INDETERMINE);
  if (douteuse) return verdictPourUneVersion(null, versionLocale);

  const tous = new Set<number>();
  for (const v of verdicts) {
    if (v.quoi === 'restaure') for (const n of v.paliers) tous.add(n);
  }
  const paliers = [...tous].sort((a, b) => a - b);
  if (paliers.length === 0) {
    const toutesAJour = schemas.every((s) => s === versionLocale);
    return {
      quoi: 'restaure',
      paliers: [],
      dire: toutesAJour
        ? null
        : 'Ce fichier vient d’une version antérieure, mais rien n’a changé de ' +
          'forme entre-temps : il est restauré tel quel.',
    };
  }
  return {
    quoi: 'restaure',
    paliers,
    dire:
      'Ce fichier vient d’une version antérieure. Les données restaurées sont ' +
      'mises à la forme actuelle avant d’être écrites.',
  };
}
