/**
 * Les notifications du système — prompt 32, phase 3.
 *
 * ## Un seul texte, pour toutes les sources
 *
 * Le § 1 n° 2 veut un libellé neutre « pour **toute** source », et n'admet
 * un texte détaillé que pour une liste fermée de sources déclarées non
 * sensibles. **Cette liste est vide** (décision 3). Il n'y a donc pas de
 * choix de libellé à faire : il y en a un, il est constant, et il ne dit
 * ni domaine, ni valeur, ni molécule, ni montant, ni nombre, ni date.
 *
 * C'est écrit comme une constante et non comme un paramètre, délibérément.
 * Un paramètre serait une invitation : la première source qui aurait « un
 * bon cas » le remplirait, et la liste fermée s'ouvrirait d'un appel. Pour
 * la rouvrir, il faudra changer ce fichier, ce qui se voit en revue.
 *
 * ## Désactivées par défaut, et source par source
 *
 * Le § 3.4 l'exige. Le réglage vit **sur l'appareil** (`localStorage`), et
 * pas dans le journal qui voyage : une notification est émise par un
 * appareil, et activer les rappels sur le téléphone ne doit pas faire
 * sonner l'ordinateur posé au bureau. C'est aussi ce que le § 3.4 décrit
 * quand il demande « l'état réel **par appareil** ».
 *
 * Conséquence assumée, et dite à l'écran : le réglage ne se synchronise
 * pas. On le refait sur chaque appareil, ce qui est le prix d'un réglage
 * qui ne surprend pas.
 *
 * ## La permission n'est demandée qu'au premier oui
 *
 * Jamais au chargement : un navigateur refuse une demande non sollicitée,
 * et certains la retiennent contre le site. `demanderPermission()` est
 * donc appelée depuis le geste qui active la première source, et une
 * permission refusée ou indisponible **ne casse rien** — elle rend un état
 * affichable, et le centre continue de fonctionner sans elle.
 *
 * ## Un seul émetteur par appareil
 *
 * Trois onglets ouverts, trois notifications identiques : le § 3.5 veut un
 * verrou entre onglets. On reprend l'API Web Locks, comme la veille de
 * synchronisation (section 6 du 23), sans importer son module : charger
 * `sync/arriere-plan` depuis une page qui ne porte qu'une cloche
 * entraînerait toute la machinerie de fusion avec lui.
 *
 * Sans l'API — vieux navigateur —, on n'émet pas plutôt que d'émettre en
 * triple. Rater une notification est un désagrément ; en recevoir trois
 * apprend à toutes les ignorer, y compris celle qui comptait.
 *
 * ## Et rien quand la page est regardée (0.8 du prompt 43)
 *
 * Même raisonnement, un cran plus loin : interrompre quelqu'un pour lui
 * annoncer ce que la cloche de l'en-tête lui montre déjà ne lui apprend
 * rien. Le refus est donc posé entre la permission et le plafond, et le
 * centre, lui, reçoit toujours — c'est le droit d'interrompre qui est
 * retenu, jamais l'élément. Voir `pageRegardee` pour la limite assumée.
 */
import { suitLaSensibiliteDuCycle } from './filtre-cycle';
import { peutNotifier } from './sources';
import { avertir, demanderPermission, etatPermission, type EtatPermission } from '../sync/notification';
import type { ElementDuCentre } from './modele';

/**
 * Le libellé, et il n'y en a qu'un.
 *
 * « Cyclades : un élément à voir » — § 1 n° 2, mot pour mot. Le corps dit
 * seulement où aller, parce qu'une notification sans suite est une alarme
 * sans porte.
 */
export const TITRE_NEUTRE = 'Cyclades : un élément à voir';
export const CORPS_NEUTRE = 'Ouvrez le centre de notifications.';

/** Le nom du verrou d'onglet. Un seul émetteur par appareil (§ 3.5). */
export const VERROU_EMISSION = 'cyclades:notifications';

/** La clé du réglage, par appareil. Le préfixe nomme l'appareil, pas le compte. */
const CLE_REGLAGE = 'cyclades.notifications.sources';

/**
 * Le plafond quotidien d'émissions (§ 3.3, règle de produit).
 *
 * Cinq. Le chiffre se justifie, et il se justifie par le bas : au-delà de
 * cinq interruptions dans une journée, une notification cesse d'être un
 * signal et devient un bruit de fond — et un bruit de fond se coupe en
 * entier, ce qui emporte les cinq premières avec les suivantes. Mieux vaut
 * cinq lues que quinze ignorées.
 *
 * Le plafond porte sur les **notifications du système**, jamais sur le
 * centre : rien n'est caché, tout reste dans le panneau. Ce qui est
 * plafonné, c'est le droit d'interrompre.
 */
export const PLAFOND_PAR_JOUR = 5;

const CLE_COMPTE = 'cyclades.notifications.jour';

/* ── Le réglage par source ──────────────────────────────────────────── */

/**
 * Lit les sources activées sur cet appareil.
 *
 * Ne lève jamais : `localStorage` jette en navigation privée sur certains
 * navigateurs, et une cloche qui plante emporterait l'en-tête de toutes
 * les pages. Illisible vaut **aucune source activée**, ce qui est le
 * défaut voulu.
 */
export function sourcesActivees(): string[] {
  try {
    const brut = localStorage.getItem(CLE_REGLAGE);
    if (!brut) return [];
    const lu: unknown = JSON.parse(brut);
    return Array.isArray(lu) ? lu.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const sourceActivee = (source: string): boolean => sourcesActivees().includes(source);

/**
 * Active ou désactive une source, et demande la permission **au premier
 * oui seulement**.
 *
 * Rend l'état de la permission, pour que l'écran dise la vérité plutôt que
 * de supposer. Une activation sur un appareil où la permission est refusée
 * reste enregistrée : le refus se révoque dans les réglages du navigateur,
 * et effacer le choix obligerait à le refaire sans que personne ne
 * comprenne pourquoi il a disparu.
 */
export async function reglerLaSource(
  source: string,
  activee: boolean,
): Promise<{ etat: EtatPermission; sources: string[] }> {
  const avant = sourcesActivees();
  const premiere = activee && avant.length === 0;
  const apres = activee
    ? [...new Set([...avant, source])]
    : avant.filter((s) => s !== source);
  try {
    localStorage.setItem(CLE_REGLAGE, JSON.stringify(apres));
  } catch {
    /* Stockage refusé : le réglage ne survivra pas au rechargement, et
       l'écran le dira en relisant. On n'invente pas une réussite. */
  }
  const etat = premiere ? await demanderPermission() : etatPermission();
  return { etat, sources: sourcesActivees() };
}

/* ── Le plafond du jour ─────────────────────────────────────────────── */

interface CompteDuJour {
  jour: string;
  emises: number;
}

function compteDuJour(jour: string): CompteDuJour {
  try {
    const brut = localStorage.getItem(CLE_COMPTE);
    const lu = brut ? (JSON.parse(brut) as Partial<CompteDuJour>) : null;
    if (lu && lu.jour === jour && typeof lu.emises === 'number') return { jour, emises: lu.emises };
  } catch {
    /* Illisible : on repart de zéro pour aujourd'hui. */
  }
  return { jour, emises: 0 };
}

function noterUneEmission(jour: string): void {
  const compte = compteDuJour(jour);
  try {
    localStorage.setItem(CLE_COMPTE, JSON.stringify({ jour, emises: compte.emises + 1 }));
  } catch {
    /* Sans stockage, pas de plafond : voir `emettre`, qui refuse alors. */
  }
}

/* ── Le verrou d'onglet ─────────────────────────────────────────────── */

interface Verrou {
  obtenu: Promise<boolean>;
  relacher: () => void;
}

/**
 * Prend le verrou d'émission, ou dit qu'un autre onglet le tient.
 *
 * La forme a son importance, et elle est reprise de la veille : l'API tient
 * le verrou tant qu'une promesse est en cours, donc « attendre la demande »
 * reviendrait à attendre la fermeture de l'onglet. Il faut deux poignées —
 * une qui dit si c'est pris, une qui rend.
 */
function prendreLeVerrou(nom: string): Verrou | null {
  const locks = (globalThis.navigator as Navigator & { locks?: LockManager })?.locks;
  if (!locks) return null;
  let rendre = (): void => {};
  let dire = (_: boolean): void => {};
  const obtenu = new Promise<boolean>((ok) => {
    dire = ok;
  });
  void locks
    .request(nom, { ifAvailable: true }, (verrou) => {
      if (!verrou) {
        dire(false);
        return Promise.resolve();
      }
      dire(true);
      return new Promise<void>((fini) => {
        rendre = fini;
      });
    })
    .catch(() => dire(false));
  return { obtenu, relacher: () => rendre() };
}

/* ── L'émission ─────────────────────────────────────────────────────── */

export type RefusDEmission =
  /** La source n'a pas le droit d'interrompre, quoi qu'on règle. */
  | 'source-muette'
  | 'source-inactive'
  | 'cycle'
  /** La page est sous les yeux de la personne : la cloche suffit. */
  | 'page-regardee'
  | 'permission'
  | 'plafond'
  | 'autre-onglet'
  | 'sans-verrou';

/**
 * La page est-elle sous les yeux de la personne ?
 *
 * ## Pourquoi ce refus existe (0.8 du prompt 43)
 *
 * Une notification du système est une INTERRUPTION. Interrompre quelqu'un
 * pour lui annoncer ce qu'il a déjà sous les yeux — la cloche de l'en-tête,
 * qui compte en direct, et le centre qui s'ouvre d'un clic — ne lui apprend
 * rien et lui apprend à les couper. C'est le même raisonnement que le
 * plafond du jour, un cran plus tôt : ce qui est plafonné, c'est le droit
 * d'interrompre, jamais le centre.
 *
 * ## La limite, et elle est assumée
 *
 * `visibilityState` dit que cet onglet est celui que sa fenêtre affiche —
 * pas que cette fenêtre est devant les autres sur l'écran. Une fenêtre de
 * Cyclades posée derrière un traitement de texte se dit donc « visible », et
 * aucune notification n'en partira. `document.hasFocus()` ferait la
 * différence —
 * et le choix est délibérément celui-là, parce que le coût des deux erreurs
 * n'est pas le même : un avis manqué reste au centre, qui attend, et la
 * personne le trouve en ouvrant Cyclades ; une interruption en trop
 * s'apprend et se coupe en entier, et emporte avec elle celles qui
 * comptaient.
 *
 * ## Hors d'une page
 *
 * Sans `document` — un *service worker* réveillé, un essai pur —, la
 * réponse est « non regardée » : il n'y a alors aucun écran où la cloche
 * pourrait se voir, et c'est précisément le cas où la notification est
 * utile.
 */
function pageRegardee(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}

export type Emission = { quoi: 'emise' } | { quoi: 'refusee'; pourquoi: RefusDEmission };

/**
 * Émet la notification d'un élément, ou dit précisément pourquoi non.
 *
 * Sept raisons de refuser, et **chacune est une valeur, pas une exception** :
 * un appelant qui doit envelopper chaque émission dans un `try` finit par
 * l'envelopper dans un `catch` vide, et c'est là que les refus deviennent
 * invisibles.
 *
 * Le filtre du cycle est reconsulté ici, bien que `deposer` l'ait déjà fait.
 * Ce n'est pas une redite : le § 1 n° 3 nomme **trois** portes — le centre,
 * le compteur et la notification — et demande que les trois passent par la
 * même fonction. Une notification émise par un chemin qui ne passerait pas
 * par le magasin contournerait le premier filtre sans que rien ne le dise.
 *
 * L'étiquette est l'**identifiant de l'élément** (§ 3.5) : c'est ce qui
 * permettra de refermer exactement celle-ci, et pas une autre, quand la
 * question sera tranchée.
 */
export async function emettre(element: ElementDuCentre, jour: string): Promise<Emission> {
  if (suitLaSensibiliteDuCycle({ source: element.source, refSource: element.refSource })) {
    return { quoi: 'refusee', pourquoi: 'cycle' };
  }
  /*
     Puis le droit d'interrompre, **avant le réglage** : deux sources sont
     admises au centre et interdites de notification — la veille du rythme
     (le 27) et l'apprentissage étendu (le 25). Les tester après
     l'activation laisserait croire qu'un réglage peut les délier, et un
     écran finirait par les proposer. C'est exactement ce qui est arrivé :
     l'écran du § 3.4 les offrait toutes les douze.

     L'ordre entre les deux n'est pas indifférent, bien que les deux
     refusent. Le cycle passe **en premier** parce que c'est l'interdiction
     qui doit tenir seule : si `peutNotifier` repassait un jour à un défaut
     permissif, le § 1 n° 3 attraperait encore, et le contrôle dirait
     toujours « cycle » plutôt que de changer de raison sans qu'on le voie.
  */
  if (!peutNotifier(element.source)) return { quoi: 'refusee', pourquoi: 'source-muette' };
  /*
     Le réglage ne vient qu'après les deux interdictions. Une source
     interdite reste interdite activée ; l'inverse — tester le réglage
     d'abord — ferait dépendre une règle de confidentialité d'une case à
     cocher.
  */
  if (!sourceActivee(element.source)) return { quoi: 'refusee', pourquoi: 'source-inactive' };
  if (etatPermission() !== 'accordee') return { quoi: 'refusee', pourquoi: 'permission' };
  /*
     Puis la page elle-même, et AVANT le plafond : une émission retenue
     parce qu'on regardait l'écran n'est pas une interruption, et ne doit
     donc pas consommer une des cinq du jour. Cinq coups d'œil au site le
     matin feraient taire les cinq vraies notifications de la journée.

     C'est l'ORDRE qui le garantit, et il est mesuré. On pourrait s'en
     remettre à `noterUneEmission`, qui ne compte qu'une émission faite —
     mais ce serait faire tenir une règle de produit par un détail du
     compteur, que la prochaine réécriture déplacerait sans savoir ce
     qu'elle emporte.
  */
  if (pageRegardee()) return { quoi: 'refusee', pourquoi: 'page-regardee' };
  if (compteDuJour(jour).emises >= PLAFOND_PAR_JOUR) {
    return { quoi: 'refusee', pourquoi: 'plafond' };
  }

  const verrou = prendreLeVerrou(VERROU_EMISSION);
  /*
     Pas de verrou disponible : on n'émet pas. Trois onglets qui sonnent
     ensemble apprennent à couper les notifications en entier.
  */
  if (!verrou) return { quoi: 'refusee', pourquoi: 'sans-verrou' };
  try {
    if (!(await verrou.obtenu)) return { quoi: 'refusee', pourquoi: 'autre-onglet' };
    const affichee = await avertir({
      titre: TITRE_NEUTRE,
      corps: CORPS_NEUTRE,
      /*
         Le clic mène au centre, pas à l'écran d'origine. Celui-ci peut
         demander le coffre, et une notification qui ouvre un formulaire de
         mot de passe sans contexte est une notification qu'on referme.
      */
      vers: '/',
      marque: element.id,
    });
    if (!affichee) return { quoi: 'refusee', pourquoi: 'permission' };
    noterUneEmission(jour);
    return { quoi: 'emise' };
  } finally {
    verrou.relacher();
  }
}

/**
 * Ce qu'on referme.
 *
 * Un seul critère, trois formes, parce que deux fonctions qui ne
 * diffèrent que par un filtre finissent par diverger sur le reste —
 * l'une apprendrait à traverser le *service worker* absent, l'autre non.
 */
export type ARefermer =
  /** Tout : c'est le verrouillage de Cyclades. */
  | { toutes: true }
  /** Celles-ci précisément. */
  | { ces: readonly string[] }
  /** Toutes sauf celles-ci : les questions encore ouvertes restent. */
  | { saufCes: readonly string[] };

/**
 * Referme les notifications déjà affichées sur **cet** appareil.
 *
 * Le § 3.5 pose la contrainte et sa limite : une notification affichée ne
 * peut être retirée que par une page ouverte sur l'appareil qui l'affiche.
 * Cyclades les referme donc à la prochaine ouverture — celles dont la
 * question est tranchée — et **toutes** au verrouillage.
 *
 * Pourquoi le verrouillage ferme tout : une notification survit à la
 * fermeture de l'onglet, et elle porte l'identifiant d'un élément. La
 * laisser sur l'écran après qu'on a verrouillé reviendrait à laisser une
 * trace de ce qu'on vient précisément de mettre à l'abri.
 *
 * Rend le nombre fermé, et ne lève jamais : sans *service worker*, il n'y
 * a rien d'affiché à retirer, et ce n'est pas une panne.
 */
export async function refermer(critere: ARefermer): Promise<number> {
  try {
    const enregistrement = await navigator.serviceWorker?.getRegistration();
    if (!enregistrement) return 0;
    const affichees = await enregistrement.getNotifications();
    let fermees = 0;
    for (const notification of affichees) {
      if ('ces' in critere && !critere.ces.includes(notification.tag)) continue;
      if ('saufCes' in critere && critere.saufCes.includes(notification.tag)) continue;
      notification.close();
      fermees += 1;
    }
    return fermees;
  } catch {
    return 0;
  }
}
