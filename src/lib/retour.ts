/**
 * Revenir en arrière, comme dans une application.
 *
 * ## La demande
 *
 * « Je souhaite — COMME DANS LES APPLICATIONS MOBILE — une flèche pour
 * revenir sur la page précédente, et ce depuis n'importe quelle page. »
 *
 * ## Les deux retours, et pourquoi il en faut deux
 *
 * Une application mobile distingue le retour **d'historique** — l'écran d'où
 * l'on vient — et le retour **hiérarchique** — l'écran au-dessus. Les deux se
 * confondent tant qu'on navigue de proche en proche, et divergent dès qu'on
 * arrive par une notification, un lien ou au lancement : il n'y a alors pas
 * d'écran précédent, et `history.back()` ferait sortir du site.
 *
 * La règle est donc : l'historique s'il mène quelque part **dans Cyclades**,
 * le parent logique sinon. Et jamais, dans aucun cas, une sortie.
 *
 * ## Comment on sait d'où l'on vient
 *
 * Par le référent, et non par `history.length`, qui compte les entrées de tout
 * l'onglet — y compris celles d'un autre site visité avant. Un onglet ouvert
 * sur Cyclades depuis un courriel a un `history.length` de 2 et aucune page de
 * Cyclades derrière lui.
 *
 * ## Les chemins sont **sans la base**, et c'est l'appelant qui la retire
 *
 * Le site est servi sous une base — sur GitHub Pages, le nom du dépôt. Ce
 * module pourrait la lire dans `import.meta.env`, mais il cesserait alors
 * d'être vérifiable hors d'un empaqueteur : `import.meta.env` n'existe pas
 * sous `tsx`, et un `try/catch` autour aurait rendu silencieuse une panne
 * réelle. La mise en page connaît la base ; elle la retire avant d'appeler.
 */
import { BRANCHES, ECRANS_COMMUNS, brancheDUnOnglet, brancheDuChemin } from './branches';

/** Normalise « /x », « /x?a=1 » et « /x/index.html » en « /x/ ». */
export const normaliser = (chemin: string): string => {
  let c = chemin.split('?')[0].split('#')[0].replace(/index\.html$/, '');
  if (!c.startsWith('/')) c = `/${c}`;
  if (!c.endsWith('/')) c += '/';
  return c;
};

/**
 * Tous les écrans que le registre déclare, du plus long chemin au plus court.
 *
 * Les racines de branche y figurent au même titre que les onglets : la racine
 * d'Odyssée est le parent de « Santé », qui n'est l'onglet de personne.
 *
 * Le tri est une **prévention, pas une règle éprouvée** : aucun écran déclaré
 * n'a aujourd'hui deux ancêtres déclarés imbriqués, et l'inverser ne fait
 * rougir aucun essai. Il existe pour que le premier écran imbriqué reçoive son
 * parent immédiat et non son grand-parent. Un essai surveille cet angle mort
 * et passera au rouge le jour où un tel écran apparaîtra.
 */
const ECRANS_DECLARES: readonly string[] = [
  ...BRANCHES.flatMap((b) => [
    normaliser(b.racine),
    ...[...b.onglets, ...(b.annexes ?? [])].map((o) => normaliser(o.chemin)),
  ]),
  ...ECRANS_COMMUNS.map((o) => normaliser(o.chemin)),
].sort((a, b) => b.length - a.length);

/**
 * L'écran au-dessus de celui-ci. `null` pour le menu, qui n'en a pas.
 *
 * Rendre « / » pour « / » fabriquerait une flèche qui ne va nulle part, ce qui
 * est pire qu'une flèche absente : c'est ce `null` qui la retire de l'accueil.
 *
 * ## Pourquoi chercher l'écran englobant avant la branche
 *
 * Parce que `brancheDuChemin` répond **par préfixe, et Révisions par défaut** :
 * `/syntheses/` est déclaré onglet d'Odyssée mais ne vit pas sous `/odyssee/`,
 * donc il lui tombe dans Révisions. Demander d'abord la branche ferait remonter
 * une page d'Odyssée au tableau de bord des Révisions. Chercher d'abord le plus
 * long écran déclaré qui préfixe celui-ci ne dépend d'aucune branche, et ne se
 * trompe donc pas sur les écrans dispersés.
 */
export function parentLogique(chemin: string): string | null {
  const c = normaliser(chemin);
  if (c === '/') return null;

  /*
     Les deux écrans qui n'appartiennent à aucune branche et ne figurent à
     aucun menu : une adresse inconnue, et la page servie hors ligne. Ils ne
     sont pas déclarés au registre — les y mettre les ferait paraître dans la
     navigation, où ils n'ont rien à faire —, donc le repli par préfixe les
     rangerait dans Révisions et la flèche dirait « Revenir à Révisions »
     depuis une adresse qui n'en fait pas partie. Leur parent est l'accueil.
  */
  if (c === '/404/' || c === '/hors-ligne/') return '/';

  // Un écran commun — profil, appareils, stockage… — remonte au menu : il
  // n'appartient à aucune branche, c'est sa définition.
  if (ECRANS_COMMUNS.some((o) => normaliser(o.chemin) === c)) return '/';

  // Une racine de branche remonte au menu, pas à elle-même.
  if (BRANCHES.some((b) => normaliser(b.racine) === c)) return '/';

  /*
     Le plus long écran déclaré qui préfixe celui-ci, strictement.

     « /odyssee/calendrier/occurrence/ » remonte à « /odyssee/calendrier/ » et
     non à « /odyssee/ » : c'est l'écran d'où l'on vient quand on suit le chemin
     normal, et sauter un cran ferait perdre le contexte.
  */
  const englobant = ECRANS_DECLARES.find((e) => e !== c && e !== '/' && c.startsWith(e));
  if (englobant) return englobant;

  // Sinon la racine de sa branche — par déclaration d'abord, par préfixe
  // ensuite, pour la raison dite plus haut.
  return normaliser((brancheDUnOnglet(c) ?? brancheDuChemin(c)).racine);
}

/** Le nom de l'écran visé, pour le dire au lecteur d'écran. */
export function nomDuParent(chemin: string): string {
  const parent = parentLogique(chemin);
  if (parent === null) return '';
  if (parent === '/') return 'l’accueil';
  for (const b of BRANCHES) {
    if (normaliser(b.racine) === parent) return b.libelle;
    for (const o of [...b.onglets, ...(b.annexes ?? [])]) {
      if (normaliser(o.chemin) === parent) return o.nom;
    }
  }
  for (const o of ECRANS_COMMUNS) if (normaliser(o.chemin) === parent) return o.nom;
  return 'l’écran précédent';
}

/**
 * La clé de session qui retient la profondeur de la dernière entrée vue.
 *
 * Portée onglet, origine comprise : c'est exactement la portée de l'historique
 * qu'on cherche à mesurer. Elle ne quitte jamais l'appareil.
 */
const CLE_PROFONDEUR = 'cyclades.retour.profondeur';

/**
 * À quelle profondeur d'historique se trouve l'entrée courante, dans cet
 * onglet. 1 veut dire : rien de Cyclades derrière, le retour doit être
 * hiérarchique.
 *
 * ## Pourquoi pas le référent
 *
 * Parce qu'il n'y en a jamais : la mise en page pose
 * `<meta name="referrer" content="no-referrer">`, et c'est une protection
 * délibérée — sans elle, chaque lien sortant emporterait l'adresse de la page
 * d'où il part, qui peut nommer une fiche, un traitement ou une molécule. Un
 * mécanisme de retour bâti sur `document.referrer` ne se serait donc **jamais**
 * déclenché, tout en ayant l'air écrit. Affaiblir cette protection pour
 * conforter une flèche serait un mauvais échange.
 *
 * ## Pourquoi pas `history.length`
 *
 * Parce qu'il compte les entrées de tout l'onglet, y compris celles d'un autre
 * site visité avant : un onglet ouvert sur Cyclades depuis un courriel a un
 * `history.length` de 2 et aucune page de Cyclades derrière lui. Reculer là
 * ferait sortir du site.
 *
 * ## Pourquoi `history.state`
 *
 * Parce que c'est le seul endroit attaché à **l'entrée d'historique** et non à
 * l'onglet : il revient tel quel quand on recule, y compris depuis le cache de
 * page, où aucun script ne se rejoue. Un compteur tenu en `sessionStorage`
 * seul se serait décalé au premier retour.
 *
 * La valeur de session ne sert qu'à numéroter la **prochaine** entrée ; c'est
 * l'état d'historique qui fait foi pour celle-ci.
 */
export function profondeurDeLEntree(): number {
  if (typeof history === 'undefined') return 1;
  try {
    const etat = history.state as { cycladesProfondeur?: number } | null;
    if (typeof etat?.cycladesProfondeur === 'number' && etat.cycladesProfondeur > 0) {
      sessionStorage.setItem(CLE_PROFONDEUR, String(etat.cycladesProfondeur));
      return etat.cycladesProfondeur;
    }
    const lue = Number.parseInt(sessionStorage.getItem(CLE_PROFONDEUR) ?? '', 10);
    const profondeur = (Number.isFinite(lue) && lue > 0 ? lue : 0) + 1;
    history.replaceState({ ...(etat ?? {}), cycladesProfondeur: profondeur }, '');
    sessionStorage.setItem(CLE_PROFONDEUR, String(profondeur));
    return profondeur;
  } catch {
    /*
       Navigation privée, stockage refusé : on rend 1, donc retour
       hiérarchique. C'est le repli sûr — il mène toujours quelque part dans
       Cyclades, là où un `history.back()` hasardeux pourrait faire sortir.
    */
    return 1;
  }
}

/**
 * Revenir. L'historique s'il mène dans Cyclades, le parent logique sinon.
 *
 * Ne sort jamais du site : c'est la seule promesse que cette fonction doit
 * tenir sans condition, et c'est pourquoi le repli existe.
 */
export function revenir(base: string, cheminSansBase: string): void {
  const profondeur = profondeurDeLEntree();
  if (profondeur > 1) {
    history.back();
    return;
  }

  /*
     Le saut hiérarchique **remplace** l'entrée, il n'en empile pas.

     Empiler paraissait anodin et faisait rebondir : depuis « QCM — DGFiP »
     ouvert seul dans un onglet, la flèche menait à « Quiz » en profondeur 2,
     où le clic suivant reculait vers « QCM — DGFiP », d'où il remontait à
     « Quiz »… Mesuré : « /quiz/, /quiz/dgfip/, /quiz/, /quiz/dgfip/ ». Une
     flèche d'application ne rebondit pas, elle remonte jusqu'à l'accueil.

     Et l'on redescend le compteur de session d'un cran, sans quoi l'écran
     d'arrivée se numéroterait 2 et le clic suivant croirait pouvoir reculer :
     le remplacement n'ajoute rien à l'historique, la numérotation doit le
     refléter.
  */
  try {
    sessionStorage.setItem(CLE_PROFONDEUR, String(Math.max(profondeur - 1, 0)));
  } catch {
    // Stockage refusé : l'écran d'arrivée repartira de 1, ce qui est le repli
    // sûr — il remontera encore plutôt que de reculer à l'aveugle.
  }
  location.replace(`${base}${parentLogique(cheminSansBase) ?? '/'}`);
}
