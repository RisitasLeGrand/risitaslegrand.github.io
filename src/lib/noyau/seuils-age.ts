/**
 * Les seuils d'âge, déclarés une fois, avec leur fondement.
 *
 * ## Pourquoi un fichier, et pas un `18` dans le code
 *
 * Le prompt l'impose (2.4 : « **aucun seuil sans ligne dans ce fichier** ») et
 * la raison se voit mieux à l'envers. Un `age >= 18` écrit dans un écran est
 * invisible : on ne peut ni l'inventorier, ni dire d'où il vient, ni répondre à
 * « pourquoi cette fonction m'est-elle fermée ? » autrement qu'en relisant le
 * code. Déclaré ici, il porte son but, son fondement et sa date, et l'écran qui
 * ferme une fonction peut **citer la ligne** plutôt que d'affirmer.
 *
 * ## Règle de produit n'est pas un aveu de faiblesse
 *
 * Le prompt distingue deux fondements : une **source** vérifiée, ou une **règle
 * de produit** — un choix de conception, expliqué, sans prétention médicale. La
 * majorité à 18 ans relève de la seconde : ce n'est pas un fait physiologique
 * sourcé, c'est une décision de conception, prise par prudence. L'écrire ainsi
 * est plus honnête que de lui chercher une source qui n'existerait pas.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne calcule rien. Le franchissement d'un seuil, sa frontière et sa règle de
 * prudence sont dans `age.ts` : un fichier déclaratif qui calculerait aurait
 * deux raisons de changer.
 */

/** D'où vient un seuil. Il n'y a pas de troisième possibilité. */
export type FondementDeSeuil =
  | { readonly type: 'regle-de-produit'; pourquoi: string }
  | { readonly type: 'source'; nom: string; ou: string; le: string };

export interface SeuilDeclare {
  id: string;
  /** En années révolues. */
  valeur: number;
  /** À quoi il sert, en une phrase, telle que l'écran peut la citer. */
  but: string;
  fondement: FondementDeSeuil;
  /** Date de la dernière vérification, ISO court. */
  verifieLe: string;
}

/**
 * Les seuils utilisés aujourd'hui.
 *
 * Il n'y en a qu'un, et c'est un constat, pas un oubli : **Cyclades n'avait
 * jusqu'ici aucune logique d'âge**. Les règles que les prompts décrivaient
 * comme existantes — module substances fermé aux mineurs, échelles de psyché,
 * veille, menu des molécules — étaient annoncées, pas écrites. Celui-ci est le
 * premier, et les autres s'y rattachent au lieu de se répéter.
 *
 * Les seuils que des sources imposeront (repères de sommeil par tranche,
 * populations de validation des échelles, repères financiers liés à la
 * génération) ne sont pas ici : leurs sources sont hors de portée de cet
 * environnement, et « inconnu » plutôt qu'inventé.
 */
export const SEUILS: readonly SeuilDeclare[] = [
  {
    id: 'majorite',
    valeur: 18,
    but:
      'Fermer les fonctions que Cyclades ne propose pas à un mineur : substances, ' +
      'échelles de psyché, veille du rythme de vie, menu des molécules, et le suivi ' +
      'complet du cycle menstruel.',
    fondement: {
      type: 'regle-de-produit',
      pourquoi:
        'Choix de conception, par prudence, et non un fait physiologique sourcé. Les ' +
        'repères que ces fonctions afficheraient ont été établis pour des adultes ; ' +
        'leur validité chez une personne plus jeune n’a pas été vérifiée, et elle ne ' +
        's’obtient pas en extrapolant.',
    },
    verifieLe: '2026-10-14',
  },
];

const PAR_ID = new Map(SEUILS.map((s) => [s.id, s]));

export const seuil = (id: string): SeuilDeclare | undefined => PAR_ID.get(id);

/**
 * Les invariants du fichier, vérifiés plutôt que promis.
 *
 * Le troisième est le seul qui ait coûté une réflexion : une **règle de
 * produit sans explication** est pire qu'une valeur nue, parce qu'elle a l'air
 * fondée. L'écran cite `pourquoi` ; s'il est vide, il cite du vide.
 */
export function controlerSeuils(): string[] {
  const problemes: string[] = [];
  const vus = new Set<string>();
  for (const s of SEUILS) {
    if (vus.has(s.id)) problemes.push(`Le seuil « ${s.id} » est déclaré deux fois.`);
    vus.add(s.id);
    if (!Number.isInteger(s.valeur) || s.valeur <= 0 || s.valeur > 130) {
      problemes.push(`Le seuil « ${s.id} » a une valeur invraisemblable : ${s.valeur}.`);
    }
    if (s.but.trim().length < 20) {
      problemes.push(`Le seuil « ${s.id} » n’a pas de but lisible.`);
    }
    if (s.fondement.type === 'regle-de-produit' && s.fondement.pourquoi.trim().length < 20) {
      problemes.push(
        `Le seuil « ${s.id} » est une règle de produit sans explication : l’écran citerait du vide.`,
      );
    }
    if (s.fondement.type === 'source' && !s.fondement.ou.trim()) {
      problemes.push(`Le seuil « ${s.id} » dit avoir une source, sans dire où.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.verifieLe)) {
      problemes.push(`Le seuil « ${s.id} » n’a pas de date de vérification.`);
    }
  }
  return problemes;
}
