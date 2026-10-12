/**
 * Les huit domaines d'Odyssée, et les cinq qui sont allumés au départ.
 *
 * ## Pourquoi ce registre existe maintenant
 *
 * Le contrat de faits (`faits.ts`) nomme déjà sept domaines, un par type de
 * fait, chacun écrit à la main dans sa déclaration. Tant qu'il n'y avait pas
 * d'écran pour les lister, cela suffisait. La question 12 de l'initialisation —
 * « lesquels de ces domaines voulez-vous suivre ? » — demande huit boutons avec
 * leurs libellés, et la roue d'équilibre les demandera aussi : il faut une
 * liste, et une seule, sans quoi un domaine s'appellera « Psyché » ici et
 * « psyche » là.
 *
 * ## Les cinq par défaut, et la raison
 *
 * Décision 1 de la phase 0 d'Odyssée, validée : les huit existent, **Lien,
 * Ordre et Œuvre sont éteints au départ**. Non parce qu'ils compteraient moins,
 * mais parce qu'ils reposent entièrement sur de la saisie manuelle, et qu'un
 * domaine allumé sans source affiche un zéro permanent — ce que le garde-fou
 * E.3 interdit, parce qu'un zéro permanent est un reproche permanent.
 *
 * `Œuvre` n'a pas encore de type de fait déclaré : il est ici parce que la
 * décision l'a retenu, et il attend sa branche. Un domaine sans fait affiche
 * « pas de donnée », jamais zéro.
 */

/**
 * L'identifiant d'un domaine, tel que les faits le portent.
 *
 * C'est un `string`, et l'alias n'ajoute aucune vérification. Il ajoute ce qui
 * manquait : la différence, lisible à la déclaration, entre un champ qui porte
 * « corps » et un champ qui porte un titre de tâche. `Domaine` est le
 * descriptif, `IdDomaine` est la clef — les confondre est l'erreur qu'on fait
 * une fois par fichier.
 */
export type IdDomaine = string;

export interface Domaine {
  /** Identifiant stable, sans accent : celui que les faits portent. */
  id: string;
  libelle: string;
  /** Ce qu'il porte, en une ligne — l'info-bulle de la question 12. */
  description: string;
  /** Allumé à la première installation ? */
  actifParDefaut: boolean;
}

export const DOMAINES: readonly Domaine[] = [
  {
    id: 'corps',
    libelle: 'Corps',
    description: 'Poids et mesures, sommeil, nutrition, santé générale.',
    actifParDefaut: true,
  },
  {
    id: 'cognition',
    libelle: 'Cognition',
    description: 'Temps de concentration, Cog-Training, rétention.',
    actifParDefaut: true,
  },
  {
    id: 'connaissances',
    libelle: 'Connaissances',
    description: 'Couverture du programme, niveau estimé, lectures.',
    actifParDefaut: true,
  },
  {
    id: 'psyche',
    libelle: 'Psyché',
    description: 'Check-ins, journal, humeur.',
    actifParDefaut: true,
  },
  {
    id: 'finances',
    libelle: 'Finances',
    description: 'Comptes, budget, patrimoine.',
    actifParDefaut: true,
  },
  {
    id: 'lien',
    libelle: 'Lien',
    description: 'Relations : temps passé avec des proches, contacts entretenus.',
    actifParDefaut: false,
  },
  {
    id: 'ordre',
    libelle: 'Ordre',
    description: 'Foyer, démarches administratives, organisation.',
    actifParDefaut: false,
  },
  {
    id: 'oeuvre',
    libelle: 'Œuvre',
    description: 'Travail, projets, créations.',
    actifParDefaut: false,
  },
];

const PAR_ID = new Map(DOMAINES.map((d) => [d.id, d]));

export const domaine = (id: string): Domaine | undefined => PAR_ID.get(id);

/** Le libellé d'un domaine, ou son identifiant si on ne le connaît pas. */
export const libelleDuDomaine = (id: string): string => PAR_ID.get(id)?.libelle ?? id;

export const DOMAINES_ACTIFS_PAR_DEFAUT: readonly string[] = DOMAINES.filter(
  (d) => d.actifParDefaut,
).map((d) => d.id);
