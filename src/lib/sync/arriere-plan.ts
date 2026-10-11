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
 * ## Jamais d'exception vers l'appelant
 *
 * Ce module tourne pour son compte, déclenché par le chargement d'une page. Une
 * promesse rejetée sans témoin est un avertissement dans la console et rien de
 * plus ; les états passent donc par `surEtat`, et les échecs d'échange ne font
 * pas tomber la veille — l'appareil d'en face peut très bien avoir fermé sa
 * page au milieu.
 */
import { appairageMemorise } from './appairage';
import { estCertifie } from './certification';
import { echanger, type RapportDEchange } from './echange';
import { motDePasseRetenu } from './mot-de-passe-session';
import { rejoindre, type Salon } from './salon';
import { empreinteLocale } from './service';

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

export async function demarrer(options: OptionsVeille = {}): Promise<Veille | null> {
  const dire = (etat: Etat, precision?: string) => {
    courant = etat;
    options.surEtat?.(etat, precision);
  };
  let courant: Etat = 'non-certifie';

  if (!(await estCertifie())) {
    dire('non-certifie');
    return null;
  }
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

  let salon: Salon | null = null;
  let arrete = false;
  let enCours = false;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let battement: ReturnType<typeof setInterval> | null = null;
  /** L'empreinte au dernier échange : sans changement, rien à refaire. */
  let empreinteDuDernier: string | null = null;

  const echangerMaintenant = async () => {
    if (arrete || enCours || !salon) return;
    if (!salon.pairs().length) return;
    enCours = true;
    dire('en-cours');
    try {
      const rapport = await echanger(salon.canal, motDePasse, {
        nomAppareil: options.nomAppareil,
        automatique: true,
      });
      await options.surFusion?.(rapport);
      empreinteDuDernier = rapport.recu.empreinte;
      if (!arrete) dire('en-veille');
    } catch (erreur) {
      // L'autre appareil a pu fermer sa page au milieu : ce n'est pas une
      // panne de la veille, et elle continue.
      dire('echec', erreur instanceof Error ? erreur.message : String(erreur));
      if (!arrete) dire('en-veille');
    } finally {
      enCours = false;
    }
  };

  const ouvrirSalon = async () => {
    salon = await rejoindre({
      salon: appairage.salon,
      secret: appairage.secret,
      rejoindreSalon: options.rejoindreSalon,
    });
    const bientot = () => {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => void echangerMaintenant(), DELAI_AVANT_ECHANGE_MS);
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
        const { complete } = await empreinteLocale();
        if (empreinteDuDernier && complete === empreinteDuDernier) return;
        await echangerMaintenant();
      })();
    }, INTERVALLE_MS);

    dire('en-veille');
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
