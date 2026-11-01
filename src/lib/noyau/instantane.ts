/**
 * L'instantané pris avant toute migration de schéma, et le retour arrière.
 *
 * Le plan appelle la phase 1 « la plus risquée du chantier », pour une raison
 * précise : c'est la première qui **réécrit** des données déjà saisies. Une
 * migration qui échoue à mi-course laisse une base incohérente, et il n'y a
 * personne pour la réparer à la main.
 *
 * ## Pourquoi pas une sauvegarde `.cyclades`
 *
 * Le format `.cyclades` est chiffré, donc il demande un mot de passe, donc il
 * demande un geste. Or la migration a lieu au chargement d'une page, avant tout
 * geste : une invite de mot de passe à cet instant serait incompréhensible, et
 * la refuser bloquerait l'application. L'instantané vit donc dans une base
 * IndexedDB voisine, en clair — exactement le même niveau de protection que la
 * base vivante, qui est elle aussi en clair. Il n'ajoute aucune exposition.
 *
 * ## Le piège qu'il fallait éviter
 *
 * Pour savoir s'il y a une migration à venir, il faut connaître la version
 * actuelle. La façon naturelle — ouvrir sans préciser de version — **crée** une
 * base vide en version 1 quand elle n'existait pas. On se retrouverait alors à
 * migrer « de 1 vers 12 » une base neuve, ce qui ferait sauter le bloc
 * `ancienneVersion < 1` et donc la création de la moitié des magasins. Le
 * mécanisme interroge donc `indexedDB.databases()` quand il existe, et sinon
 * détecte la base fantôme pour la supprimer avant d'aller plus loin.
 */

/** Le nom de la base voisine qui garde les instantanés. */
export const BASE_INSTANTANES = 'revinsp-instantanes';

/**
 * Combien d'instantanés on garde.
 *
 * Un seul suffirait à défaire la dernière migration, qui est le cas qu'on veut
 * couvrir. On en garde deux parce que la panne réelle n'est pas « la migration
 * a échoué » — elle échoue bruyamment — mais « la migration a réussi et quelque
 * chose cloche », constaté une ou deux versions plus tard. Au-delà de deux, on
 * paierait plusieurs fois le volume de la base pour défaire une migration que
 * le code ne sait plus produire.
 */
export const INSTANTANES_GARDES = 2;

export interface Instantane {
  /** Clé : l'instant ISO de la prise. */
  le: string;
  deVersion: number;
  versVersion: number;
  /** Les enregistrements, par magasin. Les clés hors-ligne sont gardées. */
  magasins: Record<string, { clef?: IDBValidKey; valeur: unknown }[]>;
  /** Taille sérialisée approximative, pour l'afficher sans la recalculer. */
  octets: number;
}

function ouvrirBrut(nom: string, version?: number): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const requete = version === undefined ? indexedDB.open(nom) : indexedDB.open(nom, version);
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(requete.error);
    requete.onblocked = () => ko(new Error(`Base « ${nom} » bloquée par un autre onglet.`));
  });
}

/**
 * Supprime une base, et **attend** vraiment qu'elle le soit.
 *
 * « onblocked » n'est pas une fin : il annonce qu'une autre connexion est
 * ouverte, et la suppression se fera quand elle se fermera. Le tenir pour un
 * succès — ce que faisait la première version de ce module — rend la main
 * pendant que la base existe encore, et la suite ouvre alors une base qu'on
 * croyait neuve. Le symptôme observé était un « object store already exists »
 * à la migration suivante, c'est-à-dire très loin de la cause.
 */
function supprimer(nom: string): Promise<void> {
  return new Promise((ok, ko) => {
    const requete = indexedDB.deleteDatabase(nom);
    requete.onsuccess = () => ok();
    requete.onerror = () => ko(requete.error ?? new Error(`Suppression de « ${nom} » refusée.`));
    requete.onblocked = () => {
      // On n'abandonne pas : la suppression aboutira quand l'autre connexion se
      // fermera, et « onsuccess » viendra. Mais on le dit, parce qu'un retour
      // arrière qui paraît figé vient presque toujours d'un second onglet.
      console.warn(
        `La base « ${nom} » est ouverte ailleurs — probablement un autre onglet. ` +
          'La suppression attend sa fermeture.',
      );
    };
  });
}

/**
 * La version actuelle d'une base, ou 0 si elle n'existe pas — **sans la créer**.
 *
 * Le repli, quand `indexedDB.databases()` manque, ouvre sans version et
 * reconnaît la base qu'il vient lui-même de créer : version 1 et aucun magasin.
 * Elle est alors supprimée, de sorte que l'appelant reçoive bien 0 et que la
 * migration reparte du début.
 */
export async function versionActuelle(nom: string): Promise<number> {
  if (typeof indexedDB.databases === 'function') {
    const liste = await indexedDB.databases();
    return liste.find((d) => d.name === nom)?.version ?? 0;
  }
  const base = await ouvrirBrut(nom);
  const version = base.version;
  const vide = base.objectStoreNames.length === 0;
  base.close();
  if (version === 1 && vide) {
    await supprimer(nom);
    return 0;
  }
  return version;
}

/** Tous les enregistrements d'un magasin, avec leur clé quand elle est hors-ligne. */
function lireMagasin(
  base: IDBDatabase,
  nom: string,
): Promise<{ clef?: IDBValidKey; valeur: unknown }[]> {
  return new Promise((ok, ko) => {
    const magasin = base.transaction(nom, 'readonly').objectStore(nom);
    const horsLigne = magasin.keyPath === null;
    const valeurs = magasin.getAll();
    if (!horsLigne) {
      valeurs.onsuccess = () => ok(valeurs.result.map((valeur) => ({ valeur })));
      valeurs.onerror = () => ko(valeurs.error);
      return;
    }
    // Un magasin sans keyPath — « etat » — porte ses clés à l'extérieur des
    // valeurs : les lire séparément est la seule façon de pouvoir les rendre.
    const clefs = magasin.getAllKeys();
    let v: unknown[] | null = null;
    let c: IDBValidKey[] | null = null;
    const peutEtre = () => {
      if (v && c) ok(v.map((valeur, i) => ({ clef: c![i], valeur })));
    };
    valeurs.onsuccess = () => {
      v = valeurs.result;
      peutEtre();
    };
    clefs.onsuccess = () => {
      c = clefs.result;
      peutEtre();
    };
    valeurs.onerror = () => ko(valeurs.error);
    clefs.onerror = () => ko(clefs.error);
  });
}

async function ecrireInstantane(instantane: Instantane): Promise<void> {
  const base = await new Promise<IDBDatabase>((ok, ko) => {
    const requete = indexedDB.open(BASE_INSTANTANES, 1);
    requete.onupgradeneeded = () => {
      requete.result.createObjectStore('instantanes', { keyPath: 'le' });
    };
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(requete.error);
  });
  await new Promise<void>((ok, ko) => {
    const tx = base.transaction('instantanes', 'readwrite');
    tx.objectStore('instantanes').put(instantane);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  // Élagage : on garde les plus récents, et on supprime le reste dans la même
  // transaction pour ne pas laisser la base enfler si l'onglet se ferme ici.
  await new Promise<void>((ok, ko) => {
    const tx = base.transaction('instantanes', 'readwrite');
    const magasin = tx.objectStore('instantanes');
    const clefs = magasin.getAllKeys();
    clefs.onsuccess = () => {
      const trop = (clefs.result as string[]).sort().slice(0, -INSTANTANES_GARDES);
      for (const clef of trop) magasin.delete(clef);
    };
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
}

export async function instantanes(): Promise<Instantane[]> {
  if ((await versionActuelle(BASE_INSTANTANES)) === 0) return [];
  const base = await ouvrirBrut(BASE_INSTANTANES);
  if (!base.objectStoreNames.contains('instantanes')) {
    base.close();
    return [];
  }
  const tout = await new Promise<Instantane[]>((ok, ko) => {
    const requete = base.transaction('instantanes').objectStore('instantanes').getAll();
    requete.onsuccess = () => ok(requete.result as Instantane[]);
    requete.onerror = () => ko(requete.error);
  });
  base.close();
  return tout.sort((a, b) => b.le.localeCompare(a.le));
}

export interface ResultatInstantane {
  /** `null` quand il n'y avait rien à migrer : c'est le cas courant. */
  instantane: Instantane | null;
  deVersion: number;
}

/**
 * Prend un instantané si une migration est en attente, et seulement alors.
 *
 * Appelée avant chaque ouverture de la base. Au chargement ordinaire, elle
 * coûte une interrogation de `indexedDB.databases()` et rend `null`.
 *
 * **Elle ne lève pas.** Un instantané est une précaution ; si elle échoue —
 * quota atteint, autre onglet qui bloque —, empêcher l'application de démarrer
 * serait transformer une précaution en panne. Le motif est rendu à l'appelant,
 * à qui il revient d'en informer et de décider.
 */
export async function instantanerSiMigration(
  nom: string,
  versionCible: number,
): Promise<ResultatInstantane & { echec?: string }> {
  const deVersion = await versionActuelle(nom);
  if (deVersion === 0 || deVersion >= versionCible) return { instantane: null, deVersion };

  try {
    const base = await ouvrirBrut(nom);
    const noms = [...base.objectStoreNames];
    const magasins: Instantane['magasins'] = {};
    for (const magasin of noms) magasins[magasin] = await lireMagasin(base, magasin);
    base.close();

    const instantane: Instantane = {
      le: new Date().toISOString(),
      deVersion,
      versVersion: versionCible,
      magasins,
      octets: JSON.stringify(magasins).length,
    };
    await ecrireInstantane(instantane);
    return { instantane, deVersion };
  } catch (erreur) {
    return {
      instantane: null,
      deVersion,
      echec: erreur instanceof Error ? erreur.message : String(erreur),
    };
  }
}

/**
 * Remet la base dans l'état d'un instantané.
 *
 * `preparerSchema` est la fonction d'ouverture de l'application, à qui on
 * demande d'ouvrir à la **version de l'instantané** : les blocs de migration
 * sont écrits pour s'appliquer aussi bien à une base neuve, donc ouvrir une
 * base supprimée à la version 11 recrée exactement les magasins de la
 * version 11. C'est ce qui permet le retour arrière sans conserver nulle part
 * la description des anciens schémas.
 *
 * Le retour arrière **supprime** la base courante. C'est une opération que
 * l'utilisateur confirme, jamais une réparation silencieuse : une migration
 * défaite sans qu'on le sache ferait disparaître tout ce qui a été saisi
 * depuis, sans trace.
 */
export async function revenirA(
  nom: string,
  instantane: Instantane,
  preparerSchema: (nom: string, version: number) => Promise<void>,
): Promise<void> {
  await supprimer(nom);
  // « preparerSchema » crée les magasins puis referme : ce module n'a pas à
  // connaître la bibliothèque dont l'application se sert pour ouvrir sa base,
  // et c'est pourquoi il ne reçoit pas de poignée. Il ouvre ensuite lui-même,
  // sans version — la base existe désormais, donc aucun risque d'en créer une
  // vide par mégarde.
  await preparerSchema(nom, instantane.deVersion);
  const base = await ouvrirBrut(nom);
  const noms = Object.keys(instantane.magasins).filter((m) => base.objectStoreNames.contains(m));
  if (noms.length) {
    await new Promise<void>((ok, ko) => {
      const tx = base.transaction(noms, 'readwrite');
      for (const nomMagasin of noms) {
        const magasin = tx.objectStore(nomMagasin);
        for (const { clef, valeur } of instantane.magasins[nomMagasin]) {
          if (clef === undefined) magasin.put(valeur);
          else magasin.put(valeur, clef);
        }
      }
      tx.oncomplete = () => ok();
      tx.onerror = () => ko(tx.error);
    });
  }
  base.close();
}
