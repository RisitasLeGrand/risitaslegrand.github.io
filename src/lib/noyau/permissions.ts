/**
 * Qui lit quoi : la matrice de lecture inter-branches.
 *
 * ## Ce que la matrice protège
 *
 * Elle existe pour une raison concrète, et elle vaut mieux qu'une discipline.
 * Sport a besoin de la fatigue pour nuancer ses propositions ; une fatigue se
 * déduit d'un sommeil court et d'un stress élevé ; le stress est dans les
 * check-ins psychiques, qui contiennent aussi des notes de journal. Sans
 * matrice, le chemin le plus court pour « lire la fatigue » est d'ouvrir la
 * table des check-ins, et le journal part avec.
 *
 * La matrice coupe ce chemin : une branche ne lit que des **types** nommément
 * autorisés. Rien ne se déduit, rien ne s'étend par inadvertance, et un ajout
 * d'autorisation se voit dans un diff.
 *
 * ## Les défauts viennent du prompt, et le refus est le défaut du défaut
 *
 * B.2 les fixe : « Odyssée lit tout ; Sport lit de la diète, du sommeil, du
 * poids, de l'état de santé général et d'une mesure de stress/fatigue agrégée
 * (pas les notes de journal) ; Révisions lit peu (sommeil, énergie, pour
 * contextualiser). Aucune branche n'écrit chez une autre. »
 *
 * Tout ce qui n'est pas listé est **refusé**. C'est l'inverse d'une liste noire,
 * et c'est la seule orientation sûre : un type de fait ajouté demain est refusé
 * jusqu'à ce que quelqu'un décide de l'autoriser, et non autorisé jusqu'à ce que
 * quelqu'un s'aperçoive qu'il ne devait pas l'être.
 *
 * ## La « mesure agrégée », et pourquoi elle est un type à part
 *
 * Sport doit connaître la fatigue sans lire les check-ins. La solution n'est pas
 * une permission partielle sur un type sensible — ça n'existe pas, un type est
 * lu ou ne l'est pas — mais un **type dérivé** qu'Odyssée publie exprès :
 * `odyssee.charge-percue`, un nombre, sans texte, sans détail. Sport lit
 * celui-là. Les check-ins restent hors de sa portée, et le resteront même si
 * quelqu'un ajoute un champ aux check-ins.
 */
import { TYPES, typeDeFait, type TypeDeFait } from './faits';

/**
 * Le type dérivé qu'Odyssée publie pour que Sport n'ait pas à lire la psyché.
 *
 * Déclaré dans le catalogue comme tout autre type : le nommer ici n'est qu'une
 * commodité de lecture pour la matrice.
 */
export const TYPE_CHARGE_PERCUE = 'odyssee.charge-percue';

/**
 * Les noms de branches lectrices, déclarés une fois.
 *
 * Trois appelants passaient la même chaîne littérale, et une chaîne recopiée
 * trois fois se faute une fois. Surtout : une lectrice inconnue de la matrice
 * reçoit `matrice[lectrice] ?? []`, donc **tout est refusé sauf ses propres
 * types** — le bon sens de l'erreur, mais une faute de frappe se verrait
 * seulement à l'écran, sous la forme d'un domaine soudain non autorisé.
 * `essais:permissions` vérifie que chaque lectrice nommée dans `src/` est une
 * clé de la matrice.
 */
export const LECTRICES = {
  odyssee: 'odyssee',
  sport: 'sport',
  revisions: 'revisions',
} as const;

/**
 * Le type d'une lectrice, et pourquoi ce n'est pas `string`.
 *
 * J'avais typé `lectrice: string`, et écrit dans l'essai qu'il garderait « un
 * appel qui passerait une lectrice variable venue d'ailleurs ». Le sabotage l'a
 * démenti : `lectrice: inconnue` contient le mot « lectrice », donc le
 * balayage de source passait, et `string` accepte tout.
 *
 * Une union fermée le refuse au compilateur, ce qui est plus fort que
 * n'importe quel balayage : un appelant doit se nommer avec une des trois
 * constantes, et une quatrième branche devra être déclarée ici — donc relue.
 */
export type Lectrice = (typeof LECTRICES)[keyof typeof LECTRICES];

/**
 * La matrice : pour chaque branche lectrice, les types qu'elle peut lire chez
 * les autres. Une branche lit toujours ses propres types, sans avoir à le dire.
 */
export type Matrice = Record<string, readonly string[]>;

export const MATRICE_PAR_DEFAUT: Matrice = {
  /*
   * Odyssée lit tout : elle est l'application centrale, elle calcule l'XP, la
   * roue d'équilibre et les tendances. Lui refuser un type, c'est trouer une
   * analyse dont elle est seule responsable.
   */
  odyssee: TYPES.map((t) => t.id),

  /*
   * Sport lit ce qui contextualise une performance, et rien de plus. Le poids
   * et le statut hormonal, dont Odyssée est le propriétaire et que Sport porte
   * sur ses courbes en bandes datées (D.5). La diète et le sommeil, qui
   * expliquent une mauvaise séance. La santé générale, qui lui interdit de
   * proposer de progresser (D.7).
   *
   * Pas les check-ins, pas le journal, pas les finances.
   */
  sport: [
    'odyssee.poids',
    'odyssee.mesure',
    'odyssee.sommeil',
    'odyssee.repas',
    'odyssee.hydratation',
    'odyssee.sante',
    /*
       `odyssee.statut-hormonal` A ÉTÉ RETIRÉ ICI, et c'est un resserrement, pas
       un élargissement.

       La citation de B.2 en tête de ce module ne le donne pas à Sport : « Sport
       lit de la diète, du sommeil, du poids, de l'état de santé général et
       d'une mesure de stress/fatigue agrégée ». Le statut y avait été ajouté au
       titre de D.5, qui parle de bandes datées sur les courbes de Sport.

       Mais le § 4.7 est explicite dans l'autre sens : « Sport ne lit **que les
       fenêtres passées** du cycle ; aucun statut, aucun bilan hormonal sexuel,
       aucune molécule contraceptive. » Et le plan de phase 0 tranche la tension
       entre les deux, ligne 143 : « le statut hormonal à quatre valeurs est
       trop grossier et trahirait le suivi ». Quatre valeurs dont une est
       « cycle » : le lire, c'est apprendre qu'un suivi existe.

       Ce que D.5 veut — du contexte sur les courbes — est donc rendu par
       `odyssee.fenetre-de-cycle`, qui dit des jours et rien de plus.

       Rien ne casse : vérifié le 19 octobre, aucun module de `src/lib/sport/`
       ne lit de fait d'Odyssée. La permission n'était utilisée par personne.
    */
    'odyssee.fenetre-de-cycle',
    TYPE_CHARGE_PERCUE,
  ],

  /*
   * Révisions lit peu, et c'est voulu : elle n'a pas de décision à prendre qui
   * dépende du corps. Le sommeil et la charge perçue servent à expliquer une
   * séance difficile, pas à programmer quoi que ce soit.
   */
  revisions: ['odyssee.sommeil', TYPE_CHARGE_PERCUE],
};

/* ══════════════════════════════════════════════════════════════════════════
   Décision
   ══════════════════════════════════════════════════════════════════════════ */

export interface Decision {
  autorise: boolean;
  /** Pourquoi, en une phrase affichable et journalisable. */
  raison: string;
}

/**
 * Une branche peut-elle lire un type de fait ?
 *
 * Trois cas, et le troisième est celui qui compte : un type inconnu est refusé.
 * Autoriser par défaut un type que personne n'a déclaré serait ouvrir la porte
 * à tout ce qui sera ajouté sans relecture.
 */
export function peutLire(
  lectrice: string,
  typeId: string,
  matrice: Matrice = MATRICE_PAR_DEFAUT,
): Decision {
  const t = typeDeFait(typeId);
  if (!t) {
    return {
      autorise: false,
      raison: `Type inconnu : « ${typeId} ». Un type doit être déclaré avant d’être lisible.`,
    };
  }
  if (t.proprietaire === lectrice) {
    return { autorise: true, raison: 'Une branche lit toujours ses propres faits.' };
  }
  const permis = matrice[lectrice] ?? [];
  if (permis.includes(typeId)) {
    return { autorise: true, raison: `La matrice autorise ${lectrice} à lire « ${typeId} ».` };
  }
  return {
    autorise: false,
    raison:
      `La matrice n’autorise pas ${lectrice} à lire « ${typeId} »` +
      (t.sensible ? ' — et ce type porte une donnée sensible.' : '.'),
  };
}

/** Les types qu'une branche peut effectivement lire, les siens compris. */
export function typesLisibles(
  lectrice: string,
  matrice: Matrice = MATRICE_PAR_DEFAUT,
): TypeDeFait[] {
  return TYPES.filter((t) => peutLire(lectrice, t.id, matrice).autorise);
}

/**
 * Filtre une liste de faits selon ce qu'une branche peut lire.
 *
 * C'est la seule porte par laquelle une branche reçoit les faits d'une autre.
 * Rendre les faits refusés sous une forme masquée aurait été plus « informatif »
 * et aurait fui : il suffit de compter les masqués pour apprendre qu'il y a eu
 * un check-in ce jour-là.
 */
export function filtrerPourLecture<T extends { type: string }>(
  lectrice: string,
  faits: readonly T[],
  matrice: Matrice = MATRICE_PAR_DEFAUT,
): T[] {
  return faits.filter((f) => peutLire(lectrice, f.type, matrice).autorise);
}

/* ══════════════════════════════════════════════════════════════════════════
   Dire ce qui est refusé, sans dire ce qu'il contient
   ══════════════════════════════════════════════════════════════════════════ */

export interface DomaineNonAutorise {
  domaine: string;
  /** Combien de types de ce domaine la lectrice ne peut pas lire. */
  typesRefuses: number;
  /** Combien ce domaine compte de types en tout. */
  typesEnTout: number;
}

/**
 * Les domaines qu'une branche ne peut pas lire entièrement, **calculés sur la
 * matrice et non sur les faits observés**.
 *
 * ## Pourquoi pas sur les faits
 *
 * C'est le point de la maquette 8.3, qui impose de distinguer « domaine non
 * autorisé » de « non mesuré ». Si on déduisait le refus des faits écartés, un
 * domaine interdit dont la fenêtre ne contient rien se tairait — exactement
 * comme un domaine autorisé et vide. La distinction disparaîtrait au moment
 * précis où elle compte : quand il n'y a rien à montrer.
 *
 * La réponse ne dépend donc pas des données : elle dépend des permissions, et
 * elle est la même pour une fenêtre pleine et pour une fenêtre vide.
 *
 * ## Ce qui est rendu, et ce qui ne l'est pas
 *
 * Le nom du domaine et **deux comptes de types** — pas un seul fait, pas un
 * identifiant de type refusé, pas une date. Un écran peut dire « Psyché : non
 * autorisé » sans rien apprendre de ce que Psyché contient. Rendre la liste
 * des types refusés aurait été plus commode et aurait fui : savoir qu'un type
 * « check-in » est refusé n'apprend rien, mais savoir lesquels le sont pour
 * cette personne-là, un jour donné, en apprendrait.
 *
 * Un domaine dont **aucun** type n'est refusé est absent de la liste : il n'y
 * a rien à dire d'un domaine entièrement lisible.
 */
export function domainesNonAutorises(
  lectrice: string,
  matrice: Matrice = MATRICE_PAR_DEFAUT,
): DomaineNonAutorise[] {
  const parDomaine = new Map<string, { refuses: number; total: number }>();
  for (const t of TYPES) {
    const compte = parDomaine.get(t.domaine) ?? { refuses: 0, total: 0 };
    compte.total += 1;
    if (!peutLire(lectrice, t.id, matrice).autorise) compte.refuses += 1;
    parDomaine.set(t.domaine, compte);
  }
  return [...parDomaine.entries()]
    .filter(([, c]) => c.refuses > 0)
    .map(([domaine, c]) => ({
      domaine,
      typesRefuses: c.refuses,
      typesEnTout: c.total,
    }))
    .sort((a, b) => a.domaine.localeCompare(b.domaine, 'fr'));
}

/* ══════════════════════════════════════════════════════════════════════════
   Garde-fous sur la matrice elle-même
   ══════════════════════════════════════════════════════════════════════════ */

export interface ProblemeDeMatrice {
  gravite: 'refus' | 'avertissement';
  message: string;
}

/**
 * Contrôle une matrice modifiée par la personne.
 *
 * Les réglages permettent d'élargir les permissions, et c'est voulu : c'est sa
 * machine et ses données. Mais deux choses sont refusées, et une est signalée.
 *
 * **Refusé** : nommer un type inconnu, ce qui ne veut rien dire ; et nommer une
 * branche inconnue, ce qui laisserait une ligne morte dans les réglages.
 *
 * **Signalé** : ouvrir à une branche un type sensible qui ne lui est pas donné
 * par défaut. Ce n'est pas interdit — le journal de la personne lui appartient —
 * mais cela mérite d'être vu, parce qu'une permission élargie un jour ne se
 * remarque plus jamais.
 */
export function controlerMatrice(matrice: Matrice): ProblemeDeMatrice[] {
  const problemes: ProblemeDeMatrice[] = [];
  const branchesConnues = new Set(TYPES.map((t) => t.proprietaire));

  for (const [lectrice, types] of Object.entries(matrice)) {
    if (!branchesConnues.has(lectrice)) {
      problemes.push({
        gravite: 'refus',
        message: `Branche inconnue dans la matrice : « ${lectrice} ».`,
      });
      /*
       * Et on s'arrête là pour cette ligne. Signaler en plus que cette branche
       * fantôme lirait une donnée sensible serait du bruit : il n'y a pas de
       * branche pour la lire, et le refus ci-dessus dit déjà tout. Un contrôle
       * qui rend deux problèmes pour une seule faute apprend à ignorer les
       * avertissements.
       */
      continue;
    }
    for (const id of types) {
      const t = typeDeFait(id);
      if (!t) {
        problemes.push({
          gravite: 'refus',
          message: `Type inconnu dans la matrice de ${lectrice} : « ${id} ».`,
        });
        continue;
      }
      const parDefaut = MATRICE_PAR_DEFAUT[lectrice] ?? [];
      if (t.sensible && t.proprietaire !== lectrice && !parDefaut.includes(id)) {
        problemes.push({
          gravite: 'avertissement',
          message:
            `${lectrice} peut lire « ${t.libelle} », une donnée sensible qui ne lui est ` +
            `pas ouverte par défaut. C’est votre choix ; il est noté ici pour qu’il reste visible.`,
        });
      }
    }
  }
  return problemes;
}
