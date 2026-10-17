/**
 * Afficher ou masquer le bandeau « Coffre ouvert ».
 *
 * ## Pourquoi ce module existe
 *
 * Le bandeau ambre prend **57 px**, mesurés, soit 7,7 % d'un écran de
 * 740 px — et il explique à lui seul l'écart entre 26 % et 34 % d'écran pris
 * par les éléments fixes sur téléphone. Alexis a demandé à pouvoir le
 * fermer, d'abord pour la session, puis « à perpétuelle demeure ».
 *
 * ## Les deux portées, et pourquoi elles sont différentes
 *
 * « Masquer » vaut pour **l'onglet**, et le bandeau revient à la prochaine
 * ouverture du coffre : c'est le geste de celui qui veut de la place
 * maintenant, pas celui qui change d'avis sur la conception.
 *
 * « Masquer indéfiniment » écrit une **préférence d'appareil**, qui survit au
 * rechargement comme à la réouverture du coffre. On la rétablit depuis les
 * paramètres ou depuis le menu du cadenas.
 *
 * ## Ce qui n'est pas négociable
 *
 * L'interdit 6 du prompt 35 veut « Fermer le coffre » atteignable **partout
 * où le coffre est ouvert**. Masquer le bandeau ne doit donc jamais faire
 * disparaître ce geste : c'est le cadenas compact de l'en-tête qui le porte,
 * et il est présent dans les deux cas. Ce module ne sait rien de cela — il
 * ne fait qu'un booléen — mais c'est la raison pour laquelle il n'en fait
 * pas plus.
 *
 * ## Où c'est rangé, et pourquoi en clair
 *
 * Dans le stockage local, à côté des autres réglages d'appareil (ceux des
 * notifications vivent déjà là). C'est une **préférence d'affichage** : elle
 * ne dit rien de ce que contient le coffre, seulement si l'on veut une bande
 * ambre en haut de l'écran. La mettre sous coffre la rendrait illisible au
 * moment précis où il faut la lire — avant d'ouvrir le coffre.
 *
 * Toute lecture et toute écriture sont protégées : en navigation privée, le
 * stockage peut lever à l'accès, et un bandeau masqué ne vaut pas qu'on
 * casse la page.
 */

/** La préférence d'appareil, durable. */
export const CLE_PERSISTANT = 'cyclades.affichage.bandeau-coffre';

/** Le masquage de l'onglet, oublié à sa fermeture. */
export const CLE_SESSION = 'cyclades.affichage.bandeau-coffre.session';

type Ecoutant = (voulu: boolean) => void;
const ecoutants = new Set<Ecoutant>();

const lire = (magasin: Storage | undefined, cle: string): string | null => {
  try {
    return magasin?.getItem(cle) ?? null;
  } catch {
    return null;
  }
};

const ecrire = (magasin: Storage | undefined, cle: string, valeur: string | null): void => {
  try {
    if (valeur === null) magasin?.removeItem(cle);
    else magasin?.setItem(cle, valeur);
  } catch {
    /* Navigation privée, stockage refusé : la préférence est perdue, pas la page. */
  }
};

const local = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage;
const session = (): Storage | undefined =>
  typeof sessionStorage === 'undefined' ? undefined : sessionStorage;

/**
 * Le bandeau est-il voulu ?
 *
 * Vrai par défaut : on ne masque un avertissement que sur demande expresse.
 */
export function bandeauVoulu(): boolean {
  if (lire(session(), CLE_SESSION) === 'masque') return false;
  if (lire(local(), CLE_PERSISTANT) === 'masque') return false;
  return true;
}

/** Le masquage est-il celui qui dure ? Sert à cocher le réglage. */
export function masqueIndefiniment(): boolean {
  return lire(local(), CLE_PERSISTANT) === 'masque';
}

const prevenir = (): void => {
  const voulu = bandeauVoulu();
  for (const e of ecoutants) e(voulu);
};

/** Masquer pour cet onglet. Le bandeau revient à la prochaine ouverture. */
export function masquerPourLaSession(): void {
  ecrire(session(), CLE_SESSION, 'masque');
  prevenir();
}

/** Masquer durablement, sur cet appareil. */
export function masquerIndefiniment(): void {
  ecrire(local(), CLE_PERSISTANT, 'masque');
  prevenir();
}

/**
 * Réafficher le bandeau.
 *
 * Lève **les deux** masquages, et c'est voulu : « Afficher le bandeau » ne
 * doit pas rendre un écran où le bandeau reste caché parce que l'autre
 * drapeau traînait. Un geste, un résultat visible.
 */
export function afficherLeBandeau(): void {
  ecrire(session(), CLE_SESSION, null);
  ecrire(local(), CLE_PERSISTANT, null);
  prevenir();
}

/**
 * S'abonner au choix d'affichage. Rend la fonction qui se désabonne.
 *
 * L'écoutant est appelé tout de suite, pour que l'appelant n'ait pas à
 * peindre une première fois lui-même — c'est l'oubli classique, et il laisse
 * un écran faux jusqu'au premier changement.
 */
export function surBandeau(ecoutant: Ecoutant): () => void {
  ecoutants.add(ecoutant);
  ecoutant(bandeauVoulu());
  return () => ecoutants.delete(ecoutant);
}
