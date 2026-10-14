/**
 * La session du coffre étendue à tous les onglets, sans passer par le disque.
 *
 * ## Ce qui circule, et ce qui ne circule pas
 *
 * **La clé ne traverse jamais le canal.** Ce qu'un onglet donneur envoie est
 * le *chiffré* que sa propre `sessionStorage` contient ; l'enveloppe qui
 * l'ouvre vit dans IndexedDB, partagée par l'origine. Les deux moitiés sont
 * donc séparées, et c'est ce qui rend la promesse du prompt tenable :
 *
 * - l'enveloppe seule, sur le disque, n'ouvre rien : il n'y a pas de chiffré
 *   à ouvrir tant qu'aucun onglet n'est vivant ;
 * - le chiffré seul n'ouvre rien non plus : l'enveloppe est non extractible ;
 * - un onglet neuf ne peut donc recevoir la clé **que d'un onglet déjà
 *   ouvert**, jamais du disque. C'est la formulation même de P1.
 *
 * Fermer tous les onglets vide toutes les `sessionStorage` : il ne reste que
 * l'enveloppe, inutile. La mémorisation sur l'appareil (P1 bis) est un
 * mécanisme distinct, avec sa propre enveloppe et son propre stockage.
 *
 * ## Les limites, établies par construction et non supposées
 *
 * - **Un onglet unique fermé puis rouvert n'a aucun donneur** : le mot de
 *   passe est redemandé. C'est le cas le plus fréquent sur téléphone, où l'on
 *   n'a souvent qu'un onglet ; le relais y apporte donc peu, et il vaut mieux
 *   l'écrire que de le laisser découvrir.
 * - **Fenêtre privée ou autre profil** : partition de stockage distincte,
 *   donc pas de donneur.
 * - **`BroadcastChannel` n'existait nulle part dans ce dépôt** avant ce
 *   module. Son absence est traitée comme une absence de relais, pas comme
 *   une erreur : le coffre retombe sur la portée d'un onglet.
 * - **Non vérifié** : le comportement exact sur Safari. Aucun numéro de
 *   version n'est avancé de mémoire ici.
 *
 * Sur la surface d'attaque, un point qui joue en faveur du relais : le canal
 * est de même origine, donc le seul demandeur possible est une page Cyclades
 * — ou un script injecté sur notre origine, qui lirait déjà `sessionStorage`
 * sans lui. Le relais **n'aggrave pas** cette exposition.
 */
import { coffreOuvert, fermerLeCoffre, reprendreLeCoffre, surCoffre } from './coffre';

const CANAL = 'cyclades.coffre.relais';
const CLEF_SESSION = 'cyclades.coffre';
/** Marque qu'on a accepté d'étendre la session aux autres onglets. */
const CLEF_MULTI = 'cyclades.coffre.multi';

type Message = { t: 'demande' } | { t: 'offre'; chiffre: string } | { t: 'ferme' };

let canal: BroadcastChannel | null = null;
/** Évite qu'un « ferme » reçu ne soit rediffusé en boucle. */
let fermetureRecue = false;

const lire = (clef: string): string | null => {
  try {
    return sessionStorage.getItem(clef);
  } catch {
    return null;
  }
};

/** L'utilisateur a-t-il accepté la session multi-onglets à l'ouverture ? */
export function sessionEtendue(): boolean {
  return lire(CLEF_MULTI) === '1';
}

export function marquerSessionEtendue(etendue: boolean): void {
  try {
    if (etendue) sessionStorage.setItem(CLEF_MULTI, '1');
    else sessionStorage.removeItem(CLEF_MULTI);
  } catch {
    // Stockage refusé : le relais sera simplement inactif.
  }
}

/**
 * Branche l'onglet courant sur le relais.
 *
 * Appelée par le témoin, qui est sur toutes les pages — donc une fois par
 * page, et jamais deux fois grâce au garde ci-dessous.
 */
export function demarrerLeRelais(): void {
  if (canal || typeof BroadcastChannel === 'undefined') return;
  canal = new BroadcastChannel(CANAL);

  canal.addEventListener('message', (evenement) => {
    const message = evenement.data as Message | null;
    if (!message || typeof message !== 'object') return;

    if (message.t === 'demande') {
      /* On ne répond que si l'on a de quoi, et que la session est étendue. */
      const chiffre = lire(CLEF_SESSION);
      if (chiffre && coffreOuvert() && sessionEtendue()) {
        canal?.postMessage({ t: 'offre', chiffre } satisfies Message);
      }
      return;
    }

    if (message.t === 'offre') {
      if (coffreOuvert() || typeof message.chiffre !== 'string') return;
      try {
        sessionStorage.setItem(CLEF_SESSION, message.chiffre);
        marquerSessionEtendue(true);
      } catch {
        return;
      }
      /* `reprendreLeCoffre` prévient les abonnés : le témoin se peint seul. */
      void reprendreLeCoffre();
      return;
    }

    if (message.t === 'ferme' && coffreOuvert()) {
      fermetureRecue = true;
      fermerLeCoffre();
      fermetureRecue = false;
    }
  });

  /*
     Une fermeture ici doit fermer partout : laisser un autre onglet ouvert
     après avoir cliqué « Fermer le coffre » serait le même mensonge que le
     bouton absent des six pages.
  */
  surCoffre((ouvert) => {
    if (!ouvert && !fermetureRecue) canal?.postMessage({ t: 'ferme' } satisfies Message);
  });

  /*
     Et si l'onglet arrive sans clé, il en demande une. Sans donneur, rien ne
     répond et le mot de passe est redemandé : l'absence de réponse est le
     comportement normal, pas une panne.
  */
  if (!lire(CLEF_SESSION)) canal.postMessage({ t: 'demande' } satisfies Message);
}
