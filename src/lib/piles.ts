/**
 * Une pile par onglet, et le second appui qui la rembobine.
 *
 * ## Le défaut visé
 *
 * La barre du bas mène toujours à la **racine** de l'onglet. Qui descend dans
 * une fiche, passe au tableau de bord pour vérifier une date, puis revient à
 * « Cours », retombe sur la liste et doit refaire tout le chemin. Les
 * applications natives ne font pas cela : chaque onglet garde sa position, et
 * un second appui sur l'onglet déjà actif remonte à sa racine.
 *
 * Deux gestes distincts, donc, sur le même bouton :
 *
 * - **onglet inactif** → on reprend là où on l'avait laissé ;
 * - **onglet actif** → on remonte à la racine.
 *
 * ## Pourquoi `sessionStorage` et non `localStorage`
 *
 * Une pile est un fil de pensée, pas une préférence. La retrouver trois jours
 * plus tard, ouverte sur une fiche qu'on ne lisait plus, désoriente au lieu
 * d'aider. L'onglet du navigateur fermé, la pile meurt avec lui — et deux
 * onglets du navigateur ont deux piles, ce qui est exactement ce qu'on veut.
 *
 * ## Ce module est pur
 *
 * Il ne touche ni au stockage ni au document : il prend une pile, rend une
 * pile. Le branchement est dans la mise en page, et les essais s'exécutent en
 * Node, sans navigateur.
 */
import { BRANCHES, type Onglet } from './branches';

/**
 * L'état retenu : pour chaque onglet, le dernier chemin visité dedans.
 *
 * La clé est la **racine de l'onglet**, et non son identifiant. Ce n'est pas
 * un détail de goût : deux branches portent un onglet « accueil », si bien
 * qu'une pile indexée par identifiant envoyait l'accueil d'Odyssée sur celui
 * de Révisions. Mesuré en navigateur, après que la version par identifiant a
 * paru juste en Node — où rien ne faisait cohabiter les deux branches.
 */
export type Piles = Record<string, string>;

/** Normalise « /x », « /x?a=1 » et « /x/index.html » en « /x/ ». */
export const normaliser = (chemin: string): string => {
  let c = chemin.split('?')[0].split('#')[0].replace(/index\.html$/, '');
  if (!c.startsWith('/')) c = `/${c}`;
  if (!c.endsWith('/')) c += '/';
  return c;
};

/**
 * Tous les onglets déclarés, du chemin le plus long au plus court.
 *
 * Le tri n'est pas décoratif : « /quiz/dgfip/ » commence par « /quiz/ », et
 * sans ce tri une page profonde serait attribuée à l'onglet le plus court qui
 * la préfixe — c'est-à-dire au mauvais.
 */
const ONGLETS: readonly Onglet[] = BRANCHES.flatMap((b) => [
  ...b.onglets,
  ...(b.annexes ?? []),
]).sort((a, b) => normaliser(b.chemin).length - normaliser(a.chemin).length);

/** L'onglet auquel ce chemin appartient, ou `null` s'il n'en a pas. */
export function ongletDuChemin(chemin: string): Onglet | null {
  const c = normaliser(chemin);
  return ONGLETS.find((o) => c.startsWith(normaliser(o.chemin))) ?? null;
}

/**
 * Note la position courante dans la pile de son onglet.
 *
 * La racine d'un onglet n'est pas notée, et c'est volontaire : la noter
 * écraserait la position profonde par la racine dès qu'on y passe, ce qui
 * reviendrait à n'avoir aucune pile.
 */
export function poser(piles: Piles, chemin: string): Piles {
  const onglet = ongletDuChemin(chemin);
  if (!onglet) return piles;
  const racine = normaliser(onglet.chemin);
  const c = normaliser(chemin);
  if (c === racine) {
    const { [racine]: _, ...reste } = piles;
    return reste;
  }
  return { ...piles, [racine]: c };
}

/**
 * Où mène un appui sur cet onglet, depuis ce chemin.
 *
 * C'est ici que vivent les deux gestes. L'ordre compte : on teste d'abord si
 * l'on est déjà **dans** l'onglet, parce que ce cas-là doit rembobiner même
 * quand une position est retenue — sans quoi le second appui ne ferait rien
 * d'autre que recharger la page où l'on se trouve.
 */
export function destination(piles: Piles, onglet: Onglet, chemin: string): string {
  const racine = normaliser(onglet.chemin);
  if (normaliser(ongletDuChemin(chemin)?.chemin ?? '/\u0000/') === racine) return racine;
  const retenue = piles[racine];
  return retenue && normaliser(retenue).startsWith(racine) ? normaliser(retenue) : racine;
}

/**
 * L'onglet déclaré dont la racine est ce chemin.
 *
 * Par la racine, et non par l'identifiant : « accueil » existe dans trois
 * branches, et le premier trouvé n'était pas le bon deux fois sur trois.
 */
export function ongletParRacine(racine: string): Onglet | null {
  const r = normaliser(racine);
  return ONGLETS.find((o) => normaliser(o.chemin) === r) ?? null;
}
