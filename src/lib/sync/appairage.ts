/**
 * L'appairage : un scan, et les appareils se reconnaissent ensuite.
 *
 * C'est le cœur du mode A1 de la décision 1, et le parcours que la maquette
 * décrit : l'ordinateur affiche un QR, le téléphone le vise avec son appareil
 * photo, et c'est tout. Les synchronisations suivantes ne demandent plus qu'un
 * bouton, parce que l'appairage est **mémorisé**.
 *
 * ## Ce que le QR contient, et pourquoi c'est une URL
 *
 * Une URL, et non une charge binaire : c'est ce qui permet à l'appareil photo du
 * téléphone — celui du système, pas un lecteur à installer — d'ouvrir
 * directement Cyclades sur la bonne page. Le parcours tient alors en deux
 * gestes au lieu de cinq. Cyclades embarque aussi son propre lecteur de QR, pour
 * le cas où l'appareil photo du système ne propose pas d'ouvrir le lien, et
 * pour le repli A2 où c'est l'ordinateur qui doit lire.
 *
 * Le fragment (`#`) plutôt que la requête (`?`) : un fragment n'est **jamais
 * envoyé au serveur**. GitHub Pages ne voit donc passer ni le salon ni le
 * secret, et ils ne figurent dans aucun journal d'accès. Ce n'est pas un détail
 * de forme : c'est la différence entre un secret qui reste chez soi et un secret
 * qui traverse un tiers.
 *
 * ## Le salon et le secret
 *
 * Deux valeurs distinctes, et il faut qu'elles le soient. Le **salon** est
 * public pour le relais : c'est le nom du point de rendez-vous, et le relais le
 * voit forcément. Le **secret** ne le quitte jamais : il chiffre la
 * signalisation, de sorte que le relais ne voie passer que de l'illisible.
 * Dériver l'un de l'autre aurait donné au relais de quoi déchiffrer ce qu'il
 * relaie.
 */
import { aleatoire, octetsVersBase64Url } from '../noyau/octets';
import { db } from '../db';

export const CLEF_APPAIRAGE = 'appairage';

export interface Appairage {
  /** Le point de rendez-vous, connu du relais. */
  salon: string;
  /** Le secret qui chiffre la signalisation, jamais transmis au relais. */
  secret: string;
  /** Quand l'appairage a été créé, pour pouvoir le dire à l'écran. */
  cree: string;
  /** L'appareil d'en face, une fois qu'on le connaît. */
  appareilDistant?: string;
  /** La dernière fois qu'une synchronisation a abouti par ce lien. */
  derniereReussite?: string;
}

/**
 * Un appairage neuf.
 *
 * 10 octets pour le salon, 24 pour le secret. Le salon n'a besoin que d'être
 * unique — une collision ferait se rencontrer deux inconnus, qui ne pourraient
 * rien lire l'un de l'autre, mais le simple fait de se rencontrer serait déjà
 * une anomalie. Le secret, lui, doit résister à qui écoute le relais : 192 bits.
 */
export function fabriquerAppairage(maintenant = new Date()): Appairage {
  return {
    salon: octetsVersBase64Url(aleatoire(10)),
    secret: octetsVersBase64Url(aleatoire(24)),
    cree: maintenant.toISOString(),
  };
}

/**
 * L'URL à mettre dans le QR.
 *
 * Elle pointe sur « /apparier/ », la page qui sait lire le fragment. Je l'avais
 * d'abord écrite vers « /appareils/ », et l'essai de liaison l'a attrapée : le
 * QR menait à une page qui ignorait le secret, donc à un appairage qui ne se
 * faisait jamais — en silence, puisque rien n'échoue quand une page ignore un
 * fragment.
 */
export const CHEMIN = '/apparier/';

export const urlDAppairage = (appairage: Appairage, racine: string): string =>
  `${racine.replace(/\/+$/, '')}${CHEMIN}#c=${appairage.salon}.${appairage.secret}`;

/**
 * Relit un fragment d'URL.
 *
 * Tolérant sur la forme — avec ou sans « # », avec d'autres paramètres autour —
 * et strict sur le fond : deux morceaux non vides séparés par un point, et rien
 * qui ressemble à du remplissage. Un fragment mal formé rend `null` plutôt que
 * de lever : il arrive par l'URL, donc de l'extérieur, et un écran blanc sur une
 * URL tordue serait une panne offerte à qui la fabrique.
 */
export function lireFragment(fragment: string): { salon: string; secret: string } | null {
  const nu = fragment.replace(/^#/, '');
  const champ = nu
    .split('&')
    .map((part) => part.trim())
    .find((part) => part.startsWith('c='));
  if (!champ) return null;
  const [salon, secret, ...reste] = champ.slice(2).split('.');
  if (reste.length || !salon || !secret) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(salon) || !/^[A-Za-z0-9_-]+$/.test(secret)) return null;
  return { salon, secret };
}

/* ══════════════════════════════════════════════════════════════════════════
   Mémoire locale
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'appairage est **local**, et ne voyage pas.
 *
 * Il n'est pas une opération : il ne figure donc dans aucun journal, et aucune
 * fusion ne le transporte. C'est voulu — un appairage est une relation entre
 * deux appareils précis, et la copier sur un troisième n'aurait aucun sens.
 */
export async function memoriserAppairage(appairage: Appairage): Promise<void> {
  await (await db()).put('etat', appairage, CLEF_APPAIRAGE);
}

export async function appairageMemorise(): Promise<Appairage | null> {
  return ((await (await db()).get('etat', CLEF_APPAIRAGE)) as Appairage | undefined) ?? null;
}

export async function oublierAppairage(): Promise<void> {
  await (await db()).delete('etat', CLEF_APPAIRAGE);
}

/** Note qu'une synchronisation a abouti, pour l'afficher et pour rassurer. */
export async function noterReussite(
  appareilDistant?: string,
  maintenant = new Date(),
): Promise<void> {
  const courant = await appairageMemorise();
  if (!courant) return;
  await memoriserAppairage({
    ...courant,
    appareilDistant: appareilDistant ?? courant.appareilDistant,
    derniereReussite: maintenant.toISOString(),
  });
}
