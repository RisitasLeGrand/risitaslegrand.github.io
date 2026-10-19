/**
 * Médicaments et statut hormonal : le domaine Corps, sous coffre.
 *
 * Ces deux-là étaient les seuls objets de la phase 6 retenus par la décision
 * 3. Elle est prise : ils sont **chiffrés au repos**, et ce module les écrit
 * à travers le coffre.
 *
 * ## Enregistrement seul, et c'est la règle entière
 *
 * Le contrat de faits le dit pour `odyssee.medicament` : « Enregistrement
 * seul : nom, dose, heure, voie, motif. **Aucun conseil, aucune dose
 * proposée.** » Ce module n'a donc ni rappel de prise, ni vérification
 * d'interaction, ni suggestion d'horaire. Ce ne sont pas des fonctions
 * manquantes : chacune serait un acte médical rendu par un logiciel qui ne
 * sait rien de la personne, et aucune garantie de prudence dans la
 * formulation ne rattraperait cela.
 *
 * La seule chose que le module calcule est **ce qui a été pris**, à partir de
 * ce qui a été saisi. Jamais ce qu'il faudrait prendre.
 *
 * ## Le statut hormonal est une période, pas un événement
 *
 * Il dure, et Sport le lit pour **contextualiser** — jamais pour ajuster une
 * proposition. Une charge qui monterait « parce que » le statut a changé
 * serait une recommandation déguisée ; le garde-fou de Sport ne connaît qu'une
 * chose, la douleur déclarée.
 */

export type VoieDAdministration = 'orale' | 'cutanee' | 'injection' | 'inhalee' | 'autre';

export const VOIES: Record<VoieDAdministration, string> = {
  orale: 'Par la bouche',
  cutanee: 'Sur la peau',
  injection: 'Injection',
  inhalee: 'Inhalée',
  autre: 'Autre',
};

/**
 * Une prise, telle qu'elle a eu lieu.
 *
 * `prevu` n'existe pas : un médicament non pris n'est pas enregistré, et un
 * champ « prévu » transformerait l'enregistrement en plan de traitement —
 * c'est-à-dire en la chose que le contrat interdit.
 */
export interface Prise {
  id: string;
  jour: string;
  le: string;
  nom: string;
  /**
   * Le traitement déclaré auquel cette prise se rattache, s'il y en a un.
   *
   * Facultatif, et ajouté sans reprise des prises déjà saisies (phase 1 de
   * Santé, D-024) : un champ absent se lit « pas rattachée », ce qui est la
   * vérité pour toute prise antérieure aux traitements. Réécrire ces lignes
   * pour les rattacher à des traitements inexistants aurait été une
   * migration destructive sans contrepartie.
   */
  traitementId?: string | null;
  /** Libre : « 500 mg », « 2 bouffées », « une cuillère ». */
  dose: string;
  voie: VoieDAdministration;
  /** Pourquoi, selon la personne. Pas un diagnostic. */
  motif: string;
  note: string;
  majLe: string;
}

export function controlerPrise(p: Prise): string[] {
  const problemes: string[] = [];
  if (!p.nom.trim()) problemes.push('Une prise a besoin d’un nom.');
  if (!(p.voie in VOIES)) problemes.push(`Voie inconnue : « ${p.voie} ».`);
  if (!p.jour) problemes.push('Une prise appartient à un jour.');
  return problemes;
}

/**
 * Les natures de statut, et pourquoi la clé `cycle` n'a pas été renommée.
 *
 * `cycle` signifie **cure** : la période pendant laquelle on prend quelque
 * chose. C'est le sens du mot dans ce domaine, et le libellé affiché le dit
 * désormais — « Phase de cure ».
 *
 * ## Le second temps de la décision B n'a pas eu lieu, et c'est délibéré
 *
 * Le plan de phase 0 prévoyait de renommer **la clé** avec l'arrivée du
 * module de suivi, « qui impose de toute façon un changement de schéma : la
 * migration voyage avec lui ». La prémisse ne tient pas : `nature` est à
 * l'intérieur du scellé, la clé du coffre vit en mémoire, et le bloc
 * `upgrade` de `db.ts` ne l'a pas. **Une migration de schéma ne peut pas lire
 * ce champ, donc pas le réécrire.**
 *
 * Il aurait fallu une conversion paresseuse coffre ouvert — une seconde
 * opération qui touche des données de santé chiffrées, après
 * `migration-du-coffre.ts` qu'Alexis a conditionnée à une sauvegarde
 * confirmée — plus une période à deux clés, plus `NATURES_ECARTEES` à faire
 * fonctionner sur les deux noms puisque c'est un filtre de confidentialité
 * accroché à cette chaîne.
 *
 * Le coût était un mécanisme de réécriture de données chiffrées ; le
 * bénéfice, le confort d'un relecteur. Le pilote a tranché le 19 octobre :
 * **on ne renomme pas.** L'ambiguïté que la décision visait est levée par le
 * libellé, et le risque de collision est écarté autrement — les statuts que
 * le suivi ajoutera porteront `contraception`, `grossesse`, `allaitement` et
 * `menopause`, dont aucun ne ressemble à `cycle`.
 *
 * L'option de la conversion reste ouverte, et elle est inscrite dans
 * `docs/cyclades/decisions-en-attente-cycle-2026-10-19.md` : elle demanderait
 * une sauvegarde confirmée par Alexis.
 */
export type NatureDuStatut = 'traitement' | 'cycle' | 'substance' | 'autre';

/**
 * Les libellés affichés, et pourquoi `cycle` ne dit plus « Phase du cycle ».
 *
 * Dans une liste qui porte par ailleurs « Traitement hormonal » et
 * « Substance », « cycle » désigne une **cure** — la période pendant
 * laquelle on prend quelque chose. C'est le sens du mot dans ce domaine, et
 * c'était clair tant qu'aucun autre cycle n'existait dans Cyclades.
 *
 * Le suivi menstruel arrive. « Phase du cycle » désignerait alors deux
 * choses dans la même application, et l'écran n'aurait aucun moyen de les
 * départager. Décision B du plan de phase 0, premier temps : le **libellé**
 * change, la **clé stockée ne bouge pas**, aucune migration, aucune donnée
 * touchée. Le renommage de la clé viendra avec le module, qui impose de
 * toute façon un changement de schéma.
 *
 * ## Deux choses que ce renommage ne règle pas, et qu'il ne faut pas croire réglées
 *
 * Les statuts **déjà saisis** sous cette nature changent d'étiquette à
 * l'écran. Si l'un d'eux notait une phase menstruelle — ce que le libellé
 * d'origine autorisait à lire ainsi — il s'affiche désormais comme une cure.
 * Rien dans le code ne permet de savoir lequel des deux sens a été employé,
 * et la donnée est sous coffre : c'est à la personne de le relire.
 *
 * Et `NATURES_ECARTEES` (`faits-sensible.ts`) écarte toujours `'cycle'` de
 * l'analyse, au titre du filtre du cycle. La clé n'ayant pas changé, le
 * filtre continue de fonctionner. Il est **plus large que nécessaire** — il
 * écarte des cures de substances au nom du cycle menstruel —, et c'est le
 * bon sens de l'erreur : un filtre de confidentialité trop large retient ce
 * qu'il n'avait pas à retenir, un filtre trop étroit laisse passer ce qu'il
 * devait garder. Il sera resserré avec le renommage de la clé.
 */
export const NATURES: Record<NatureDuStatut, string> = {
  traitement: 'Traitement hormonal',
  cycle: 'Phase de cure',
  substance: 'Substance',
  autre: 'Autre',
};

export interface StatutHormonal {
  id: string;
  nature: NatureDuStatut;
  intitule: string;
  debut: string;
  /** `null` tant que cela dure. */
  fin: string | null;
  note: string;
  majLe: string;
}

export function controlerStatut(s: StatutHormonal): string[] {
  const problemes: string[] = [];
  if (!s.intitule.trim()) problemes.push('Un statut a besoin d’un intitulé.');
  if (!(s.nature in NATURES)) problemes.push(`Nature inconnue : « ${s.nature} ».`);
  if (s.fin !== null && s.fin < s.debut) problemes.push('La fin est avant le début.');
  return problemes;
}

/** Les statuts en cours à un instant donné. */
export function statutsEnCours(
  statuts: readonly StatutHormonal[],
  maintenant = new Date(),
): StatutHormonal[] {
  const instant = maintenant.toISOString();
  return statuts.filter((s) => s.debut <= instant && (s.fin === null || s.fin >= instant));
}

/**
 * Ce qui a été pris un jour donné, groupé par nom.
 *
 * Un **constat**, et rien d'autre : combien de fois, à quelles heures. Aucune
 * comparaison à une posologie, aucune alerte d'oubli — le module ne sait pas
 * ce qui était prévu, et c'est délibéré.
 */
export function prisesDuJour(
  prises: readonly Prise[],
  jour: string,
): { nom: string; fois: number; heures: string[] }[] {
  const parNom = new Map<string, string[]>();
  for (const p of prises) {
    if (p.jour !== jour) continue;
    const heures = parNom.get(p.nom) ?? [];
    heures.push(p.le);
    parNom.set(p.nom, heures);
  }
  return [...parNom.entries()]
    .map(([nom, heures]) => ({ nom, fois: heures.length, heures: heures.sort() }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
