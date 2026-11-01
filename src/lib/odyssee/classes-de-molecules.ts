/**
 * LES CLASSES DE MOLÉCULES — le vocabulaire, et d'où chaque mot vient.
 *
 * ## Pourquoi ce module existe, et pourquoi il est si court
 *
 * `src/lib/notifications/filtre-cycle.ts` refuse un rappel de prise dont la
 * classe est inconnue : c'est l'option (a) arbitrée le 19 octobre, et elle
 * protège — une molécule dont la classe est inconnue PEUT être liée au cycle,
 * et le centre ne porte rien qui y touche.
 *
 * Mesuré le 31 octobre, cette règle écartait **tous** les rappels de prise,
 * parce qu'aucune molécule ne portait de classe : ni `EntreeRegistre`, ni
 * `Traitement`, ni le registre construit n'avaient cette notion. Le filtre le
 * disait lui-même dans son commentaire, et deux modules se contredisaient.
 *
 * Le pilote a tranché le 31 octobre : la classe est une donnée de **contenu**,
 * qui vient d'une source lue — un RCP, le Thésaurus. Elle a donc dès
 * maintenant son schéma, sa garde et son chemin, et son renseignement vient
 * plus tard, en phase C. C'est la règle d'Alexis du 25 octobre : préparer
 * l'infrastructure destinée à accueillir le contenu.
 *
 * ## Ce que ce vocabulaire n'est pas, et il faut le dire
 *
 * `controlerRegistre` refuse le champ `categorie`, et pour une raison écrite :
 * « un registre qui porterait une catégorie ne serait plus une liste de noms,
 * ce serait une partie de la base recopiée ». **Cette garde reste, et elle
 * doit rester.**
 *
 * Une classe n'est pas une catégorie. Une catégorie range une molécule dans
 * un rayon — « nootropiques », « stimulants » — selon une grille que personne
 * n'a publiée, et sa seule autorité est celle de qui l'a écrite. Une classe
 * pharmacologique est un fait d'une source officielle : le Thésaurus de
 * l'ANSM traite la testostérone sous la classe **androgènes**, p. 17, et c'est
 * sous ce nom qu'il la traite — `INTERACTIONS` dans `molecules.ts` le dit déjà.
 *
 * La différence se tient par deux choses, et non par la bonne foi : **le
 * vocabulaire est clos** — ce fichier en est la seule autorité —, et **chaque
 * classification porte sa source**, sans quoi la garde la refuse.
 *
 * ## Comment ce vocabulaire s'allonge
 *
 * Par une source, jamais par un raisonnement. Ajouter une valeur ici demande
 * de dire quel document la nomme ; une valeur qu'aucun document ne nomme est
 * une catégorie déguisée, et c'est précisément ce que la garde de
 * `controlerRegistre` refuse depuis le début.
 */

/** Une classe du vocabulaire, et le document qui la nomme. */
export interface ClasseDeclaree {
  /** L'identifiant, sans accent ni espace : ce que le registre écrit. */
  id: string;
  /** Le nom à l'écran, tel que la source l'écrit. */
  libelle: string;
  /** Le document qui emploie ce nom de classe. */
  source: string;
  /**
   * Cette classe touche-t-elle au cycle ?
   *
   * Déclaré ici plutôt que déduit : `filtre-cycle.ts` tient sa propre liste,
   * `CLASSES_DU_CYCLE`, et c'est lui l'autorité sur la sensibilité du cycle.
   * Ce champ-ci est une COPIE, et `essais:classes-de-molecules` vérifie que
   * les deux concordent dans les deux sens — une copie non gardée dérive, et
   * c'est la leçon des étiquettes de magasins.
   */
  duCycle: boolean;
}

/**
 * LE VOCABULAIRE CLOS.
 *
 * Trois valeurs au 31 octobre 2026. Deux viennent de `filtre-cycle.ts`, qui
 * les nommait déjà sans qu'aucune donnée ne puisse les porter ; la troisième
 * est la seule qu'une source de ce dépôt emploie réellement aujourd'hui.
 */
export const CLASSES_CONNUES: readonly ClasseDeclaree[] = [
  {
    id: 'androgenes',
    libelle: 'androgènes',
    source:
      'Thésaurus des interactions médicamenteuses de l’ANSM, p. 17 — la testostérone y est ' +
      'traitée sous cette classe, et non sous son nom propre.',
    duCycle: false,
  },
  {
    id: 'contraceptif',
    libelle: 'contraceptif',
    source:
      'Nommée par « src/lib/notifications/filtre-cycle.ts » (CLASSES_DU_CYCLE) à l’arbitrage ' +
      'du 19 octobre 2026. Aucune molécule du catalogue ne la porte à ce jour.',
    duCycle: true,
  },
  {
    id: 'hormone-sexuelle',
    libelle: 'hormone sexuelle',
    source:
      'Nommée par « src/lib/notifications/filtre-cycle.ts » (CLASSES_DU_CYCLE) à l’arbitrage ' +
      'du 19 octobre 2026. Aucune molécule du catalogue ne la porte à ce jour.',
    duCycle: true,
  },
];

/** Les identifiants admis, pour la garde du registre. */
export const IDENTIFIANTS_DE_CLASSE: readonly string[] = CLASSES_CONNUES.map((c) => c.id);

/** La classe déclarée sous cet identifiant, ou rien. */
export const classeDeclaree = (id: string | null | undefined): ClasseDeclaree | null =>
  CLASSES_CONNUES.find((c) => c.id === id) ?? null;
