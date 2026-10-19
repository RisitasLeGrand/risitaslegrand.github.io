/**
 * « Tout effacer sur cet appareil » doit effacer tout ce qui est sur cet
 * appareil — A7 et G-2 du 58.
 *
 * ## Ce que le bouton faisait, et ce qu'il promettait
 *
 * Il appelait `toutEffacer()`, qui vide les magasins de la base `revinsp` et
 * rien d'autre. Sonde réelle du 19 octobre, avec un témoin posé dans chacun
 * des trois autres endroits : `localStorage` intact, Cache Storage intact,
 * les autres bases IndexedDB intactes. Or la phrase de confirmation annonçait
 * que partaient « les réglages enregistrés dans ce navigateur ».
 *
 * Une promesse non tenue dans la phrase même qui demande une action
 * irréversible est plus grave que la portée : quelqu'un qui efface avant de
 * prêter son ordinateur croit avoir tout retiré.
 *
 * ## Les quatre endroits, et pourquoi chacun compte
 *
 * - **Les magasins de `revinsp`** : la progression, les séances, les notes,
 *   Odyssée, Sport, les journaux.
 * - **`localStorage` et `sessionStorage`** : le thème, la position de lecture
 *   d'une fiche audio — qui révèle les fiches écoutées —, les refus
 *   d'installation, l'état des bandeaux, et la clé de session du coffre.
 * - **Cache Storage** : la coquille hors ligne, et avec elle les pages
 *   visitées. Elles ne portent pas de progression, mais elles disent ce qui a
 *   été lu.
 * - **Les autres bases** : `revinsp-instantanes`, qui garde les instantanés
 *   d'avant migration — c'est-à-dire une copie complète de la base — et
 *   `cyclades-cles`, qui garde les clés d'encapsulation du coffre.
 *
 * ## Ce que ce module ne fait pas, et le dit à l'appelant
 *
 * Il ne délie pas l'appareil. C'est un geste distinct, et il doit le rester :
 * les autres appareils appairés gardent leurs données, et la première
 * synchronisation renverra ici ce qui vient d'être effacé. L'écran l'annonce
 * et propose « Délier cet appareil » à côté. Le confondre avec l'effacement
 * ferait perdre l'appairage à qui voulait seulement repartir de zéro ici.
 *
 * Il ne pose **aucune pierre tombale** : l'effacement total est local, par la
 * décision 4 du 15 octobre. C'est l'effacement **ciblé** qui se propage.
 */
import { MAGASINS_PROGRESSION, db } from '../db';

/**
 * Les préfixes des clés que ce site écrit dans `localStorage` et
 * `sessionStorage`.
 *
 * Un essai balaie les sources et vérifie qu'aucune clé n'échappe à ces deux
 * préfixes. Sans ce contrôle, une clé nouvelle survivrait à « tout effacer »
 * sans que personne s'en aperçoive — et c'est exactement le défaut qu'on
 * corrige ici.
 *
 * Pas de point final : une clé s'écrit `revinsp.theme` mais aussi
 * `revinsp:rr:tutoriels`, avec deux-points.
 */
export const PREFIXES_LOCAUX: readonly string[] = ['revinsp', 'cyclades'];

/** Le préfixe des caches de la coquille hors ligne (`public/sw.js`). */
export const PREFIXE_DES_CACHES = 'cyclades-';

/** Les autres bases IndexedDB que ce site crée, hors `revinsp`. */
export const AUTRES_BASES: readonly string[] = ['revinsp-instantanes', 'cyclades-cles'];

/** Ce qui a réellement été retiré, pour que l'écran le dise avec des nombres. */
export interface ReleveEffacementTotal {
  /** Enregistrements retirés des magasins de la base principale. */
  enregistrements: number;
  /** Clés retirées de `localStorage` et de `sessionStorage`. */
  clefsLocales: number;
  /** Caches nommés supprimés. */
  caches: number;
  /** Bases supprimées, nommées — celles qui existaient. */
  bases: string[];
}

const estANous = (clef: string): boolean =>
  PREFIXES_LOCAUX.some((prefixe) => clef.startsWith(prefixe));

/** Les clés de ce site dans un stockage, relevées sans rien toucher. */
function clefsDeCeSite(stockage: Storage): string[] {
  const clefs: string[] = [];
  for (let i = 0; i < stockage.length; i += 1) {
    const clef = stockage.key(i);
    if (typeof clef === 'string' && estANous(clef)) clefs.push(clef);
  }
  return clefs;
}

/**
 * Efface les quatre endroits, et rend le compte de ce qui est parti.
 *
 * L'ordre n'est pas indifférent. Les magasins partent d'abord, parce que c'est
 * l'opération qui peut échouer — une base verrouillée par un autre onglet. Les
 * clés locales et les caches suivent, puis les autres bases. Ainsi, un échec
 * laisse l'appareil dans un état qu'on sait décrire, et le relevé dit ce qui
 * est parti avant.
 */
export async function toutEffacerSurCetAppareil(): Promise<ReleveEffacementTotal> {
  const releve: ReleveEffacementTotal = {
    enregistrements: 0,
    clefsLocales: 0,
    caches: 0,
    bases: [],
  };

  /* 1. Les magasins. On compte avant de vider, pour pouvoir le dire. */
  const base = await db();
  const tx = base.transaction(MAGASINS_PROGRESSION, 'readwrite');
  for (const nom of MAGASINS_PROGRESSION) {
    const magasin = tx.objectStore(nom);
    releve.enregistrements += await magasin.count();
    await magasin.clear();
  }
  await tx.done;
  // La base reste ouverte par cet onglet : la fermer ici empêcherait les
  // écrans de se repeindre après l'effacement.

  /* 2. Les deux stockages de l'onglet. */
  for (const stockage of [localStorage, sessionStorage]) {
    try {
      for (const clef of clefsDeCeSite(stockage)) {
        stockage.removeItem(clef);
        releve.clefsLocales += 1;
      }
    } catch {
      // Un navigateur en navigation privée peut refuser l'accès. L'écran
      // annoncera alors moins de clés que la réalité, ce qui est préférable à
      // un effacement interrompu.
    }
  }

  /* 3. Les caches de la coquille hors ligne. */
  if ('caches' in globalThis) {
    try {
      for (const nom of await caches.keys()) {
        if (!nom.startsWith(PREFIXE_DES_CACHES)) continue;
        if (await caches.delete(nom)) releve.caches += 1;
      }
    } catch {
      // Idem : pas de cache accessible, rien à retirer.
    }
  }

  /* 4. Les autres bases. */
  for (const nom of AUTRES_BASES) {
    const existait = await supprimerLaBase(nom);
    if (existait) releve.bases.push(nom);
  }

  return releve;
}

/**
 * Supprime une base, et dit si elle existait.
 *
 * `deleteDatabase` réussit sur une base absente, sans le dire. On demande donc
 * la liste des bases avant — quand le navigateur l'offre — pour que le relevé
 * ne nomme que ce qui est vraiment parti.
 *
 * `onblocked` se résout comme une réussite : un autre onglet tient la base, la
 * suppression aura lieu à sa fermeture. Attendre indéfiniment bloquerait
 * l'écran sur une promesse que l'autre onglet ne tiendra peut-être jamais.
 */
async function supprimerLaBase(nom: string): Promise<boolean> {
  let existait = true;
  if (typeof indexedDB.databases === 'function') {
    try {
      const connues = await indexedDB.databases();
      existait = connues.some((b) => b.name === nom);
    } catch {
      existait = true;
    }
  }
  if (!existait) return false;
  await new Promise<void>((ok) => {
    const demande = indexedDB.deleteDatabase(nom);
    demande.onsuccess = () => ok();
    demande.onerror = () => ok();
    demande.onblocked = () => ok();
  });
  return true;
}
