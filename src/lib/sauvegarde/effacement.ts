/**
 * L'effacement ciblé : savoir d'abord, effacer ensuite.
 *
 * ## Le principe, et il n'est pas négociable
 *
 * Aucune fonction de ce module n'efface sans qu'on ait pu compter d'abord.
 * `compter()` dit exactement ce qui partirait ; `effacer()` prend le même
 * argument et le fait. Deux appels, le même filtre, et c'est l'appelant qui
 * décide entre les deux.
 *
 * La raison est qu'un effacement est la seule opération du site qui soit
 * **définitive sans recours**, sauvegarde mise à part. Une restauration se
 * défait en restaurant autre chose ; un effacement ne se défait pas. Afficher
 * « 1 470 séances et 1 495 notes vont être effacées » avant de demander
 * confirmation n'est donc pas une politesse, c'est la seule protection qui
 * reste quand la personne s'est trompée de groupe.
 */
import { MAGASINS_PROGRESSION, db } from '../db';
import { CHAMP_DATE, dateDe, groupe } from './groupes';

/** Le filtre d'un effacement. Un groupe, et éventuellement une période. */
export interface Cible {
  /** Identifiants de groupes (`groupes.ts`). */
  groupes: readonly string[];
  /** Bornes incluses, au format `AAAA-MM-JJ`. Absentes = tout l'historique. */
  depuis?: string;
  jusqua?: string;
}

export interface CompteParMagasin {
  magasin: string;
  /** Combien d'enregistrements la cible désigne. */
  vises: number;
  /** Combien le magasin en porte en tout. */
  total: number;
  /**
   * Renseigné quand une période est demandée sur un magasin qui n'en a pas.
   *
   * Le magasin est alors **laissé entier**, et l'appelant doit le dire : un
   * magasin épargné en silence ferait croire à un effacement complet qui n'a pas
   * eu lieu.
   */
  refus?: string;
}

export interface Decompte {
  parMagasin: CompteParMagasin[];
  vises: number;
  /** Magasins écartés parce qu'une période leur a été demandée en vain. */
  refuses: CompteParMagasin[];
}

const vide = (): Decompte => ({ parMagasin: [], vises: 0, refuses: [] });

/** Les magasins désignés par une cible, dédoublonnés et dans l'ordre du schéma. */
function magasinsDe(cible: Cible): string[] {
  const voulus = new Set<string>();
  for (const id of cible.groupes) {
    for (const nom of groupe(id)?.magasins ?? []) voulus.add(nom);
  }
  return MAGASINS_PROGRESSION.filter((nom) => voulus.has(nom));
}

/** Un enregistrement tombe-t-il dans la période demandée ? */
function dansLaPeriode(magasin: string, enregistrement: unknown, cible: Cible): boolean {
  if (!cible.depuis && !cible.jusqua) return true;
  const jour = dateDe(magasin, enregistrement);
  if (!jour) return false;
  if (cible.depuis && jour < cible.depuis) return false;
  if (cible.jusqua && jour > cible.jusqua) return false;
  return true;
}

/**
 * Compte sans rien toucher.
 *
 * C'est l'essai à blanc. Il lit les magasins visés, applique le filtre, et rend
 * les comptes — y compris ceux qu'il refuse de découper.
 */
export async function compter(cible: Cible): Promise<Decompte> {
  const noms = magasinsDe(cible);
  if (!noms.length) return vide();
  const avecPeriode = Boolean(cible.depuis || cible.jusqua);
  const base = await db();
  const sortie = vide();

  for (const nom of noms) {
    const magasin = nom as (typeof MAGASINS_PROGRESSION)[number];
    const tous = await base.getAll(magasin);
    const total = tous.length;

    if (avecPeriode && CHAMP_DATE[nom] === null) {
      const refus: CompteParMagasin = {
        magasin: nom,
        vises: 0,
        total,
        refus:
          'ce magasin porte un état courant et non un historique : une période ne le découpe pas',
      };
      sortie.parMagasin.push(refus);
      sortie.refuses.push(refus);
      continue;
    }

    const vises = avecPeriode
      ? tous.filter((e) => dansLaPeriode(nom, e, cible)).length
      : total;
    sortie.parMagasin.push({ magasin: nom, vises, total });
    sortie.vises += vises;
  }
  return sortie;
}

export interface ResultatEffacement {
  /** Ce qui a réellement été effacé, magasin par magasin. */
  effaces: Record<string, number>;
  total: number;
  /** Magasins laissés entiers, avec la raison. */
  refuses: CompteParMagasin[];
}

/**
 * Efface ce que la cible désigne.
 *
 * Sans période, le magasin est vidé en une opération. Avec une période, chaque
 * enregistrement est examiné et supprimé par sa clé — plus lent, et c'est le
 * prix d'un effacement qui ne déborde pas.
 *
 * L'appelant est **tenu** d'avoir proposé une sauvegarde avant d'arriver ici.
 * Ce module ne peut pas l'imposer ; l'écran, lui, ne démarre pas sans un choix
 * explicite entre « sauvegarder d'abord » et « continuer sans ».
 */
export async function effacer(cible: Cible): Promise<ResultatEffacement> {
  const noms = magasinsDe(cible);
  const avecPeriode = Boolean(cible.depuis || cible.jusqua);
  const base = await db();
  const effaces: Record<string, number> = {};
  const refuses: CompteParMagasin[] = [];
  let total = 0;

  for (const nom of noms) {
    const magasin = nom as (typeof MAGASINS_PROGRESSION)[number];

    if (avecPeriode && CHAMP_DATE[nom] === null) {
      refuses.push({
        magasin: nom,
        vises: 0,
        total: (await base.getAll(magasin)).length,
        refus:
          'ce magasin porte un état courant et non un historique : une période ne le découpe pas',
      });
      continue;
    }

    if (!avecPeriode) {
      const combien = (await base.getAll(magasin)).length;
      await base.clear(magasin);
      effaces[nom] = combien;
      total += combien;
      continue;
    }

    const tx = base.transaction(magasin, 'readwrite');
    const store = tx.objectStore(magasin);
    let curseur = await store.openCursor();
    let combien = 0;
    while (curseur) {
      if (dansLaPeriode(nom, curseur.value, cible)) {
        await curseur.delete();
        combien += 1;
      }
      curseur = await curseur.continue();
    }
    await tx.done;
    effaces[nom] = combien;
    total += combien;
  }

  return { effaces, total, refuses };
}
