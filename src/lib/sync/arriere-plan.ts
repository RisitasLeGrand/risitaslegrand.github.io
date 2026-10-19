/**
 * La synchronisation sans geste, sur un ordinateur certifié.
 *
 * ## Ce que ce module promet, au mot près
 *
 * Pendant que Cyclades est **ouvert dans un onglet** de l'ordinateur certifié,
 * et que l'autre appareil est ouvert aussi, les deux se trouvent par le salon
 * d'appairage et échangent leurs paquets sans qu'on appuie sur rien. Onglet
 * fermé ou machine éteinte, rien ne se passe. Un site statique ne peut pas
 * tourner tout seul — `RTCPeerConnection` n'existe pas dans un *service
 * worker* — et il vaut mieux le dire que le laisser découvrir.
 *
 * ## Un seul onglet à la fois
 *
 * Deux onglets du même navigateur rejoindraient le même salon et se verraient
 * l'un l'autre comme des pairs : chacun fusionnerait le paquet de l'autre, donc
 * le sien. C'est idempotent, et donc sans dégât, mais c'est aussi deux
 * dérivations PBKDF2 de 600 000 itérations pour rien, et une horloge logique
 * qui avance sans raison. Le verrou de l'API Web Locks règle le cas proprement
 * : il est tenu tant que l'onglet vit et libéré par le navigateur quand il
 * meurt — ce qu'aucune marque posée dans `localStorage` ne sait faire.
 *
 * ## Ce qui l'arrête, et qui n'est pas une panne
 *
 * Trois conditions, et chacune est un état affichable plutôt qu'une erreur :
 * l'appareil n'est pas certifié, aucun appairage n'est mémorisé, ou le mot de
 * passe n'est pas en mémoire de session. Le dernier cas est le plus fréquent :
 * la clé de déchiffrement du contenu peut venir du stockage, et le mot de passe
 * lui-même n'est gardé qu'en mémoire — il est donc absent après un
 * rechargement où l'on n'a rien tapé. L'écran le dit et propose de le saisir,
 * au lieu de laisser croire que la synchronisation veille.
 *
 * ## Les déclencheurs, et pourquoi chacun est là
 *
 * La veille ne partait que du chargement de page, puis d'un battement de cinq
 * minutes. Quatre occasions manquaient, et chacune correspond à un moment où
 * la personne **attend** que ce soit déjà fait :
 *
 * | Occasion | Ce qui la rend utile |
 * |---|---|
 * | retour au premier plan | on revient de l'autre appareil, justement |
 * | retour du réseau | l'échange précédent a pu échouer pour cette raison |
 * | après une écriture, regroupée | une carte notée ne doit pas attendre cinq minutes |
 * | fermeture | voir plus bas : elle est déjà couverte, et autrement |
 *
 * **La fermeture est le cas intéressant.** On ne peut pas échanger pendant
 * `pagehide` : deux dérivations PBKDF2 de 600 000 itérations et une
 * négociation WebRTC ne tiennent pas dans le délai qu'un navigateur accorde à
 * une page qui s'en va, et une tentative à moitié faite ne vaut rien. Mais le
 * déclencheur de fermeture **existe déjà, par construction** : `echangeUtile`
 * compare l'empreinte locale à celle du dernier échange, et une page fermée
 * avec des écritures non échangées rouvre donc sur un échange immédiat.
 * `pagehide` sert à autre chose, et à une seule chose : quitter le salon
 * proprement, pour que l'appareil d'en face ne garde pas un pair fantôme.
 *
 * **Chaque déclencheur a son plancher.** Un échange coûte deux dérivations de
 * clé ; ce module refusait déjà de les dépenser toutes les cinq minutes pour
 * ne rien transporter, et il serait absurde de les dépenser à chaque bascule
 * d'onglet. Les planchers sont nommés ci-dessous, chacun avec sa raison.
 *
 * ## Jamais d'exception vers l'appelant
 *
 * Ce module tourne pour son compte, déclenché par le chargement d'une page. Une
 * promesse rejetée sans témoin est un avertissement dans la console et rien de
 * plus ; les états passent donc par `surEtat`, et les échecs d'échange ne font
 * pas tomber la veille — l'appareil d'en face peut très bien avoir fermé sa
 * page au milieu.
 */
import { appairageMemorise } from './appairage';
import { certificationEffective, certificationLocale } from './certification';
import { echanger, type RapportDEchange } from './echange';
import { motDePasseRetenu } from './mot-de-passe-session';
import { garderLEcranAllume } from './ecran-allume';
import { rejoindre, type Salon } from './salon';
import { empreinteLocale } from './service';
import { reprendreLaFusion } from './reprise';
import { surEcritureRegroupee } from './signal-ecriture';
import { db } from '../db';

export type Etat =
  | 'non-certifie'
  | 'sans-appairage'
  | 'sans-mot-de-passe'
  | 'autre-onglet'
  | 'en-veille'
  | 'en-cours'
  | 'echec';

export interface Veille {
  /** L'état courant, pour l'écran. */
  etat: () => Etat;
  arreter: () => Promise<void>;
}

export interface OptionsVeille {
  surEtat?: (etat: Etat, precision?: string) => void;
  surFusion?: (rapport: RapportDEchange) => void | Promise<void>;
  nomAppareil?: string;
  /** Injectable pour les essais. */
  rejoindreSalon?: Parameters<typeof rejoindre>[0]['rejoindreSalon'];
  /** Le verrou d'onglet. Injectable pour les essais, et absent est toléré. */
  verrouiller?: Verrouiller;
  /** Le verrou d'écran. Injectable pour les essais ; absent, on n'en prend pas. */
  verrouDEcran?: Parameters<typeof garderLEcranAllume>[0];
}

/**
 * Un verrou d'onglet : on sait **tout de suite** si on l'a, et on le relâche
 * quand on a fini.
 *
 * La forme compte. L'API Web Locks tient le verrou pendant qu'une promesse est
 * en cours, de sorte qu'« attendre la demande » voudrait dire attendre la
 * libération — c'est-à-dire la fermeture de l'onglet. Il faut donc deux
 * poignées distinctes : une qui dit si c'est pris, une qui le rend.
 */
export interface Verrou {
  obtenu: Promise<boolean>;
  relacher: () => void;
}

export type Verrouiller = (nom: string) => Verrou;

/** Le nom du verrou d'onglet. */
export const VERROU = 'cyclades:arriere-plan';

/**
 * Le délai avant d'échanger avec un pair qui vient d'arriver.
 *
 * Les deux appareils voient l'autre arriver presque en même temps et
 * déclencheraient deux échanges croisés. L'échange est symétrique — chacun
 * envoie et chacun fusionne —, donc un seul suffit, et le second ne ferait que
 * rederiver la clé. Une attente courte, et le drapeau « en cours », suffisent à
 * n'en garder qu'un.
 */
export const DELAI_AVANT_ECHANGE_MS = 1200;

/**
 * À quelle fréquence reconsidérer un échange, un pair étant présent.
 *
 * Sans cela, la veille n'échangerait qu'à l'arrivée d'un pair : l'ordinateur
 * noterait des révisions toute la soirée, le téléphone resterait dans le salon,
 * et rien ne repartirait. Cinq minutes est un compromis assumé — ce n'est pas
 * du temps réel, et la synchronisation n'en a pas besoin.
 *
 * Mais on ne rééchange **que si l'empreinte locale a changé** depuis le dernier
 * échange. Un échange coûte deux dérivations PBKDF2 de 600 000 itérations ;
 * les dépenser toutes les cinq minutes pour ne rien transporter serait chauffer
 * la machine pour le principe.
 */
export const INTERVALLE_MS = 5 * 60 * 1000;

/**
 * Le plancher d'un échange déclenché par un **retour au premier plan**.
 *
 * Une bascule d'onglet ne dit rien de nouveau sur l'état local — l'empreinte
 * n'a pas bougé — mais elle dit quelque chose sur l'intention : on revient,
 * souvent de l'autre appareil. On échange donc même sans changement local,
 * ce que `echangeUtile` ne ferait pas, mais pas plus d'une fois par minute :
 * entre deux onglets, un aller-retour se compte en secondes.
 */
export const PLANCHER_RETOUR_MS = 60 * 1000;

/**
 * Le plancher d'un échange déclenché par le **retour du réseau**.
 *
 * Plus court, parce que l'événement est rare et qu'il signale précisément la
 * levée de ce qui faisait échouer l'échange précédent.
 */
export const PLANCHER_RESEAU_MS = 30 * 1000;

/**
 * Le plancher d'un échange déclenché par une **écriture**.
 *
 * Le signal d'écriture est déjà regroupé — vingt secondes de silence. Mais
 * une séance de flashcards fait des rafales séparées par des pauses, et
 * chaque pause vaudrait un échange : deux minutes d'écart est ce qui ramène
 * le coût sous celui du battement tout en divisant l'attente par deux et
 * demi.
 */
export const PLANCHER_ECRITURE_MS = 2 * 60 * 1000;

/**
 * La clef où l'on note le dernier échange de la veille.
 *
 * Elle est **persistée**, et c'est le détail qui rend la veille utilisable sur
 * un site multi-pages. Le marqueur en mémoire disparaissait à chaque
 * navigation : parcourir six pages en une minute valait six échanges, donc
 * douze dérivations PBKDF2 de 600 000 itérations pour ne rien transporter. En
 * base, la veille sait ce que la page précédente a déjà fait.
 *
 * C'est une **observation locale**, comme le reste de ce que cet appareil sait
 * de lui-même : elle n'est jamais transportée.
 */
const CLEF_DERNIER = 'derniereVeille';

interface DernierEchange {
  empreinte: string;
  le: string;
}

async function dernierEchange(): Promise<DernierEchange | null> {
  return ((await (await db()).get('etat', CLEF_DERNIER)) as DernierEchange | undefined) ?? null;
}

async function noterEchange(empreinte: string): Promise<void> {
  await (await db()).put('etat', { empreinte, le: new Date().toISOString() }, CLEF_DERNIER);
}

/**
 * Y a-t-il quelque chose à aller chercher ?
 *
 * Trois raisons de dire oui, et aucune n'est « on vient d'ouvrir une page » :
 * on n'a jamais échangé, l'empreinte locale a changé depuis, ou l'intervalle
 * est écoulé — l'autre appareil, lui, a pu changer sans qu'on le sache.
 */
async function echangeUtile(maintenant = Date.now()): Promise<boolean> {
  const dernier = await dernierEchange();
  if (!dernier) return true;
  if (maintenant - Date.parse(dernier.le) >= INTERVALLE_MS) return true;
  const { complete } = await empreinteLocale();
  return complete !== dernier.empreinte;
}

export async function demarrer(options: OptionsVeille = {}): Promise<Veille | null> {
  const dire = (etat: Etat, precision?: string) => {
    courant = etat;
    options.surEtat?.(etat, precision);
  };
  let courant: Etat = 'non-certifie';

  /*
     L'ordre des trois conditions est renversé depuis D-028, et c'est la
     seule conséquence visible du défaut de certification : l'appairage et
     le mot de passe se constatent **avant** la certification, parce que la
     certification tacite se déduit d'eux. Les trois états affichables sont
     les mêmes, et « non-certifie » ne reste dit que d'un appareil qui a été
     décertifié à la main alors qu'il remplissait les conditions.
  */
  const appairage = await appairageMemorise();
  if (!appairage) {
    dire('sans-appairage');
    return null;
  }
  const motDePasse = motDePasseRetenu();
  if (!motDePasse) {
    dire('sans-mot-de-passe');
    return null;
  }
  const { certifie } = certificationEffective(await certificationLocale(), {
    apparie: true,
    motDePasseEnMemoire: true,
  });
  if (!certifie) {
    dire('non-certifie');
    return null;
  }

  /*
     B-4 DU 58 — LE REJEU AU DÉMARRAGE.

     C'est le bon endroit, et il n'y en a pas de meilleur : on vient de
     constater un appairage mémorisé ET un mot de passe en mémoire, donc le
     coffre est ouvert — ce dont la matérialisation a besoin pour les magasins
     scellés. Une fusion interrompue se finit donc ici, sans rien demander.

     L'échec est avalé, et c'est voulu : la marque reste posée, la bannière de
     `/appareils/` continue de le dire, et le bouton « Reconstruire » reste
     utilisable. Faire échouer le démarrage de la veille, à l'inverse,
     priverait la personne de la synchronisation ET de la réparation.
  */
  try {
    await reprendreLaFusion();
  } catch {
    /* La marque survit : la réparation reste proposée à l'écran. */
  }

  let salon: Salon | null = null;
  let arrete = false;
  let enCours = false;
  /*
     L'heure du dernier échange **de cette page**, en mémoire.

     Distincte de `derniereVeille`, qui est persistée et porte une empreinte :
     celle-là sert à savoir s'il y a quelque chose à envoyer, celle-ci à ne
     pas rouvrir une liaison toutes les dix secondes. Un plancher doit être
     local à l'onglet : c'est lui qui vient de payer les deux dérivations.
  */
  let dernierEchangeMs = 0;
  const detacher: Array<() => void> = [];
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let battement: ReturnType<typeof setInterval> | null = null;

  const echangerMaintenant = async () => {
    if (arrete || enCours || !salon) return;
    if (!salon.pairs().length) return;
    enCours = true;
    dire('en-cours');
    /*
       L'écran reste allumé pendant l'échange, et pas une seconde de plus.
       Sur un téléphone, l'écran qui s'éteint suspend la page au milieu de la
       négociation : rien n'est corrompu — la fusion est idempotente —, mais
       la synchronisation ne se fait jamais quand on ne la regarde pas, ce
       qui est exactement ce qu'elle ne doit pas être.
    */
    const ecran = await garderLEcranAllume(options.verrouDEcran);
    try {
      const rapport = await echanger(salon.canal, motDePasse, {
        nomAppareil: options.nomAppareil,
        automatique: true,
      });
      await options.surFusion?.(rapport);
      await noterEchange(rapport.recu.empreinte);
      dernierEchangeMs = Date.now();
      if (!arrete) dire('en-veille');
    } catch (erreur) {
      // L'autre appareil a pu fermer sa page au milieu : ce n'est pas une
      // panne de la veille, et elle continue.
      dernierEchangeMs = Date.now();
      dire('echec', erreur instanceof Error ? erreur.message : String(erreur));
      if (!arrete) dire('en-veille');
    } finally {
      enCours = false;
      await ecran.rendre();
    }
  };

  /*
     Un échange déclenché par une occasion plutôt que par un changement.

     `echangeUtile` répond « non » quand l'empreinte locale n'a pas bougé, et
     c'est juste pour le battement : rien à envoyer. Mais au retour au premier
     plan ou au retour du réseau, ce qui a pu changer est **chez l'autre**, et
     l'empreinte locale ne le dira jamais. D'où ce chemin parallèle, borné par
     un plancher propre à chaque occasion.
  */
  const echangerSiPlancherPasse = async (plancher: number) => {
    if (arrete || enCours || !salon?.pairs().length) return;
    if (Date.now() - dernierEchangeMs < plancher) return;
    await echangerMaintenant();
  };

  const ouvrirSalon = async () => {
    salon = await rejoindre({
      salon: appairage.salon,
      secret: appairage.secret,
      rejoindreSalon: options.rejoindreSalon,
    });
    const bientot = () => {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        void (async () => {
          if (await echangeUtile()) await echangerMaintenant();
          else dire('en-veille');
        })();
      }, DELAI_AVANT_ECHANGE_MS);
    };
    salon.surPair(bientot);
    /*
       Un pair peut être **déjà là** : le téléphone est entré le premier. On
       programme donc un premier échange sans attendre que quelqu'un arrive, et
       le garde du « en cours » empêche le doublon si les deux se déclenchent.
    */
    bientot();

    battement = setInterval(() => {
      void (async () => {
        if (arrete || enCours || !salon?.pairs().length) return;
        if (await echangeUtile()) await echangerMaintenant();
      })();
    }, INTERVALLE_MS);

    brancherLesDeclencheurs();
    dire('en-veille');
  };

  /**
   * Les quatre occasions, branchées une fois le salon ouvert.
   *
   * Chacune se détache à l'arrêt : la veille vit dans la mise en page, et une
   * mise en page qui laisserait des écouteurs derrière elle en empilerait un
   * jeu par navigation.
   */
  const brancherLesDeclencheurs = () => {
    const doc = globalThis.document;
    const fenetre = globalThis.window;

    if (doc?.addEventListener) {
      // Retour au premier plan : on revient souvent de l'autre appareil.
      const auRetour = () => {
        if (doc.visibilityState === 'visible') void echangerSiPlancherPasse(PLANCHER_RETOUR_MS);
      };
      doc.addEventListener('visibilitychange', auRetour);
      detacher.push(() => doc.removeEventListener('visibilitychange', auRetour));
    }

    if (fenetre?.addEventListener) {
      // Retour du réseau : c'est précisément ce qui faisait échouer l'échange.
      const auReseau = () => void echangerSiPlancherPasse(PLANCHER_RESEAU_MS);
      fenetre.addEventListener('online', auReseau);
      detacher.push(() => fenetre.removeEventListener('online', auReseau));

      /*
         Fermeture. On n'échange pas ici — voir l'en-tête du module : le
         délai accordé à une page qui s'en va ne couvre pas deux dérivations
         PBKDF2 et une négociation WebRTC, et une tentative à moitié faite ne
         vaut rien. On quitte le salon, pour que l'appareil d'en face ne
         garde pas un pair fantôme qu'il attendrait en vain. Ce que la
         fermeture devait déclencher, la réouverture le fait : `echangeUtile`
         voit l'empreinte changée et échange sans attendre le battement.
      */
      const aLaFermeture = () => {
        void salon?.quitter();
      };
      fenetre.addEventListener('pagehide', aLaFermeture);
      detacher.push(() => fenetre.removeEventListener('pagehide', aLaFermeture));
    }

    // Après une écriture, regroupée — le signal attend vingt secondes de
    // silence, et le plancher deux minutes depuis le dernier échange.
    detacher.push(
      surEcritureRegroupee(() => void echangerSiPlancherPasse(PLANCHER_ECRITURE_MS)),
    );
  };

  const verrouiller = options.verrouiller ?? verrouDuNavigateur();
  let verrou: Verrou | null = null;
  if (!verrouiller) {
    // Pas de verrou disponible : on veille quand même. Le pire cas est deux
    // onglets qui échangent, ce qui est idempotent — donc sans dégât, mais
    // avec deux dérivations de clé pour rien.
    await ouvrirSalon();
  } else {
    verrou = verrouiller(VERROU);
    if (!(await verrou.obtenu)) {
      dire('autre-onglet');
      return { etat: () => courant, arreter: async () => void verrou?.relacher() };
    }
    await ouvrirSalon();
  }

  return {
    etat: () => courant,
    arreter: async () => {
      arrete = true;
      if (minuteur) clearTimeout(minuteur);
      if (battement) clearInterval(battement);
      for (const detacherUn of detacher.splice(0)) detacherUn();
      verrou?.relacher();
      await salon?.quitter();
      salon = null;
    },
  };
}

/**
 * Le verrou de l'API Web Locks, quand le navigateur en a un.
 *
 * `ifAvailable` est la clé : sans lui, la demande **attend** son tour, et un
 * second onglet se mettrait en file au lieu de s'effacer — il prendrait la main
 * à la fermeture du premier, ce qui est une surprise plutôt qu'un service.
 */
function verrouDuNavigateur(): Verrouiller | null {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return null;
  return (nom) => {
    let direObtenu: (obtenu: boolean) => void = () => {};
    const obtenu = new Promise<boolean>((ok) => {
      direObtenu = ok;
    });
    let relacher: () => void = () => {};
    locks
      .request(nom, { mode: 'exclusive', ifAvailable: true }, async (verrou) => {
        if (!verrou) {
          direObtenu(false);
          return;
        }
        direObtenu(true);
        await new Promise<void>((ok) => {
          relacher = ok;
        });
      })
      .catch(() => direObtenu(false));
    return { obtenu, relacher: () => relacher() };
  };
}
