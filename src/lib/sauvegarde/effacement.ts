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
import {
  CHAMP_DATE,
  GROUPES,
  clefVisee,
  dateDe,
  groupe,
  raisonDuRefusDeDecoupage,
  type ClefsVisees,
} from './groupes';
import { cibleDe, magasinJournalise } from '../noyau/enregistrements';

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

/**
 * Les clés visées dans un magasin, ou `null` quand c'est le magasin entier.
 *
 * B-3 du 58 : le groupe « Réglages et profil » ne désigne plus le magasin
 * `etat`, mais une liste blanche de ses clés. Un magasin reste entier dès
 * qu'un SEUL des groupes demandés le désigne entier : deux cibles qui se
 * recouvrent ne doivent pas se restreindre l'une l'autre.
 */
function viseesDe(cible: Cible, magasin: string): ClefsVisees | null {
  const exactes = new Set<string>();
  const prefixes = new Set<string>();
  for (const id of cible.groupes) {
    const g = groupe(id);
    if (!g || !g.magasins.includes(magasin)) continue;
    const visees = g.clefs?.[magasin];
    // Un seul groupe qui prend le magasin entier l'emporte : on ne peut pas
    // effacer « moins » que ce que la personne a demandé.
    if (!visees) return null;
    for (const clef of visees.exactes) exactes.add(clef);
    for (const prefixe of visees.prefixes ?? []) prefixes.add(prefixe);
  }
  return { exactes: [...exactes], prefixes: [...prefixes] };
}

/**
 * Les clés présentes dans le magasin que la cible désigne vraiment.
 *
 * Les préfixes obligent à passer par les clés réelles : `selection:nback` est
 * un réglage, et aucune liste de noms exacts ne peut l'énumérer d'avance.
 */
async function clefsPresentes(
  base: Awaited<ReturnType<typeof db>>,
  magasin: string,
  visees: ClefsVisees,
): Promise<string[]> {
  const toutes = (await base.getAllKeys(magasin as never)) as unknown as unknown[];
  return toutes
    .filter((clef): clef is string => typeof clef === 'string')
    .filter((clef) => clefVisee(clef, visees));
}

/**
 * Les magasins dont le découpage par période vit dans LEUR module.
 *
 * ## Pourquoi cette table existe
 *
 * Le découpage d'ici lit `CHAMP_DATE[magasin]` sur la ligne brute, telle que
 * `getAll` la rend — donc avant tout déchiffrement. Un magasin scellé dont la
 * date est à l'intérieur du scellé n'a aucune date lisible ici, et
 * `CHAMP_DATE` y vaut `null`. Le découpage reste possible, mais il demande la
 * clé du coffre, qui ne vit qu'en mémoire : il appartient donc au module.
 *
 * Deux refus étaient tentants, et tous deux coûtaient à la personne. Mettre
 * la date en clair pour se donner un index aurait rendu lisible sans coffre
 * exactement ce que le scellé protège. Laisser le magasin entier aurait
 * retiré le découpage à qui le demande. Cette table est le troisième chemin :
 * le mécanisme générique garde la décision et le compte, le module fournit le
 * geste.
 *
 * ## Ce qu'elle promet, et ce qu'elle ne promet pas
 *
 * Chaque entrée LÈVE quand le coffre est fermé — c'est `exigerLeCoffre` qui
 * lève, dans le module —, et l'appelant traduit ce refus en la phrase que
 * `raisonDuRefusDeDecoupage` porte. Une période demandée coffre fermé laisse
 * donc le magasin entier, et l'écran le dit ; elle n'efface jamais à moitié.
 *
 * L'import est dynamique, et à dessein : `sauvegarde/` ne doit pas dépendre
 * d'`odyssee/` au chargement. Il est aussi la raison pour laquelle le
 * garde-fou des orphelins ne voit pas ces fonctions — c'est ici, et dans
 * `essais:effacement`, qu'elles sont tenues.
 */
interface DecoupageDuModule {
  /** Compte les enregistrements de la période, sans rien toucher. */
  compter: (depuis?: string, jusqua?: string) => Promise<number>;
  /** Efface ceux de la période, et rend combien sont partis. */
  effacer: (depuis?: string, jusqua?: string) => Promise<number>;
}

export const DECOUPAGES_DE_MODULE: Record<string, () => Promise<DecoupageDuModule>> = {
  /*
     Les créneaux marqués de Santé. Leur jour est scellé parce qu'un rythme de
     prises se lit sans rien comprendre d'autre ; le module le relit la clé en
     main. Les suppressions voyagent par `journaliserSuppressions`, que
     `oublier()` appelle là-bas — ce magasin n'est pas dans
     `MAGASINS_JOURNALISES`, donc le chemin générique n'en aurait produit
     aucune.
  */
  odysseeCreneaux: async () => {
    const module = await import('../odyssee/donnees-sante');
    return {
      compter: module.compterLesMarquesDeLaPeriode,
      effacer: module.effacerLesMarquesDeLaPeriode,
    };
  },
};

/** Un enregistrement tombe-t-il dans la période demandée ? */
function dansLaPeriode(magasin: string, enregistrement: unknown, cible: Cible): boolean {
  if (!cible.depuis && !cible.jusqua) return true;
  const jour = dateDe(magasin, enregistrement);
  if (!jour) return false;
  if (cible.depuis && jour < cible.depuis) return false;
  if (cible.jusqua && jour > cible.jusqua) return false;
  return true;
}

/** Ce qu'un groupe porte aujourd'hui. */
export interface CompteDeGroupe {
  id: string;
  libelle: string;
  /** Combien d'enregistrements ce groupe porte. */
  vises: number;
}

/**
 * Compte **tous** les groupes, un par un (G-5 et G-6 du 58).
 *
 * ## Le défaut
 *
 * Les deux confirmations — « Tout effacer sur cet appareil » et « Remplacer
 * toute la progression » — additionnaient trois magasins : les cartes, les
 * quiz et les journées. Ni Odyssée, ni Santé, ni Finances, ni le profil. Une
 * personne qui portait quatre mille enregistrements d'Odyssée lisait « 31 »,
 * et décidait là-dessus.
 *
 * ## Pourquoi ce compte-ci ne peut plus rien oublier
 *
 * Il part de `GROUPES`, qui est la même déclaration que l'effacement et
 * l'export lisible. Un magasin nouveau entre dans un groupe, donc dans ce
 * compte, sans qu'une ligne soit à ajouter ici. Un magasin qui n'entrerait
 * dans aucun groupe échapperait encore — c'est pourquoi un essai vérifie que
 * les deux listes se recouvrent exactement. Au 19 octobre : 68 magasins, 68
 * dans un groupe, aucun orphelin.
 *
 * Les groupes sont comptés **séparément**, et non en une cible unique : une
 * cible qui les porterait tous rendrait un total juste et muet sur la
 * répartition, alors que c'est la répartition qui fait décider — « Odyssée :
 * 4 128 » arrête une main que « 4 159 » n'arrête pas.
 */
export async function compterParGroupe(): Promise<CompteDeGroupe[]> {
  const sortie: CompteDeGroupe[] = [];
  for (const g of GROUPES) {
    const { vises } = await compter({ groupes: [g.id] });
    sortie.push({ id: g.id, libelle: g.libelle, vises });
  }
  return sortie;
}

/**
 * La phrase qui dit, rubrique par rubrique, ce que portent les groupes.
 *
 * Les groupes vides sont tus : « Sport : 0 » n'aide personne à décider, et
 * noyer douze lignes utiles dans vingt lignes à zéro revient à ne rien dire.
 * Le total, lui, est toujours écrit — c'est le seul nombre qu'on retient.
 */
export function direLesGroupes(comptes: readonly CompteDeGroupe[]): string {
  const pleins = comptes.filter((c) => c.vises > 0);
  const total = comptes.reduce((somme, c) => somme + c.vises, 0);
  if (!pleins.length) return 'aucun enregistrement';
  return (
    pleins.map((c) => `${c.libelle} ${c.vises.toLocaleString('fr-FR')}`).join(', ') +
    ` — soit ${total.toLocaleString('fr-FR')} enregistrement(s) en tout`
  );
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
    const visees = viseesDe(cible, nom);
    /*
       Quand le groupe ne désigne que des clés (B-3), on compte les clés
       visées **présentes**, et le total reste celui du magasin : annoncer
       « 14 sur 14 » pour un magasin dont on n'effacera que deux entrées
       serait exactement le mensonge que ce correctif retire, et annoncer
       « 2 sur 2 » en serait un autre.

       La période garde la main : `etat` porte un état courant et non un
       historique, donc une période ne le découpe pas, et le magasin tombe
       dans le refus ci-dessous — comme avant la B-3. Restreindre aux clés
       sans regarder la période aurait effacé TOUS les réglages sous
       prétexte qu'on en demandait une tranche.
    */
    if (visees && !(avecPeriode && CHAMP_DATE[nom] === null)) {
      const presentes = await clefsPresentes(base, nom, visees);
      const total = (await base.getAllKeys(magasin)).length;
      sortie.parMagasin.push({ magasin: nom, vises: presentes.length, total });
      sortie.vises += presentes.length;
      continue;
    }
    const tous = await base.getAll(magasin);
    const total = tous.length;

    if (avecPeriode && CHAMP_DATE[nom] === null) {
      /*
         Le module d'abord, s'il en a un : lui seul peut lire la date d'un
         magasin scellé. S'il lève — coffre fermé —, on retombe sur le refus,
         qui dit pourquoi.
      */
      const decoupage = DECOUPAGES_DE_MODULE[nom];
      if (decoupage) {
        try {
          const vises = await (await decoupage()).compter(cible.depuis, cible.jusqua);
          sortie.parMagasin.push({ magasin: nom, vises, total });
          sortie.vises += vises;
          continue;
        } catch {
          // Coffre fermé, ou module indisponible : le refus ci-dessous le dit.
        }
      }
      const refus: CompteParMagasin = {
        magasin: nom,
        vises: 0,
        total,
        refus: raisonDuRefusDeDecoupage(nom),
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
  /**
   * Les suppressions entrées au journal, pour que l'effacement voyage.
   *
   * Zéro ne veut pas dire « raté » : seuls les magasins journalisés en
   * produisent. Un écart avec `total` est donc normal.
   */
  suppressionsJournalisees?: number;
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

  /*
     Les cibles journalisées qui disparaissent doivent **le dire**. Un
     effacement qui ne journalise rien serait défait par la première
     synchronisation : l'autre appareil porte encore l'opération d'écriture, et
     la matérialisation réécrirait l'enregistrement. Une suppression est une
     opération, pas une absence.
  */
  const supprimees: string[] = [];

  /*
     Les réglages effacés doivent aussi quitter le registre versionné
     (`etat/reglagesSync`), qui garde une copie horodatée de chaque réglage
     synchronisé. Le registre n'est pas un réglage : c'est la machinerie qui
     les fait converger, et le jeter casserait la convergence. Mais le laisser
     intact aurait fait revenir le profil effacé à la première synchronisation,
     avec sa valeur et son horloge — un effacement qui se défait tout seul.
  */
  const registreARetirer: string[] = [];

  for (const nom of noms) {
    const magasin = nom as (typeof MAGASINS_PROGRESSION)[number];
    const journalise = magasinJournalise(nom);
    const visees = viseesDe(cible, nom);

    /*
       B-3 du 58 : clé par clé, jamais `clear()`. Le magasin `etat` porte
       l'identité de l'appareil, son horloge logique et l'enveloppe de la clé
       du coffre ; les vider rendait le coffre illisible avec le bon mot de
       passe, sous un libellé qui annonçait des réglages.
    */
    if (visees && !(avecPeriode && CHAMP_DATE[nom] === null)) {
      const presentes = await clefsPresentes(base, nom, visees);
      for (const clef of presentes) await base.delete(magasin, clef as never);
      effaces[nom] = presentes.length;
      total += presentes.length;
      if (nom === 'etat') registreARetirer.push(...presentes);
      continue;
    }

    if (avecPeriode && CHAMP_DATE[nom] === null) {
      const decoupage = DECOUPAGES_DE_MODULE[nom];
      if (decoupage) {
        try {
          const partis = await (await decoupage()).effacer(cible.depuis, cible.jusqua);
          effaces[nom] = partis;
          total += partis;
          continue;
        } catch {
          // Coffre fermé : rien n'est effacé, et le refus ci-dessous le dit.
        }
      }
      refuses.push({
        magasin: nom,
        vises: 0,
        total: (await base.getAll(magasin)).length,
        refus: raisonDuRefusDeDecoupage(nom),
      });
      continue;
    }

    if (!avecPeriode) {
      const tous = (await base.getAll(magasin)) as unknown as Record<string, unknown>[];
      if (journalise) {
        for (const enregistrement of tous) {
          const clef = enregistrement[journalise.clef];
          if (typeof clef === 'string' && clef) supprimees.push(cibleDe(nom, clef));
        }
      }
      await base.clear(magasin);
      effaces[nom] = tous.length;
      total += tous.length;
      continue;
    }

    const tx = base.transaction(magasin, 'readwrite');
    const store = tx.objectStore(magasin);
    let curseur = await store.openCursor();
    let combien = 0;
    while (curseur) {
      if (dansLaPeriode(nom, curseur.value, cible)) {
        if (journalise) {
          const clef = (curseur.value as Record<string, unknown>)[journalise.clef];
          if (typeof clef === 'string' && clef) supprimees.push(cibleDe(nom, clef));
        }
        await curseur.delete();
        combien += 1;
      }
      curseur = await curseur.continue();
    }
    await tx.done;
    effaces[nom] = combien;
    total += combien;
  }

  /*
     Le registre versionné reçoit une PIERRE TOMBALE par réglage effacé — A7.

     Le registre garde une copie horodatée de chaque réglage synchronisé.
     Retirer l'entrée ne suffisait pas : le registre est fusionné champ par
     champ, et un champ absent chez l'un se prend simplement chez l'autre. Le
     profil effacé revenait donc à la première synchronisation, avec sa valeur
     et son horloge — un effacement qui se défait tout seul.

     La marque est horodatée comme une écriture, donc elle gagne par l'horloge,
     et l'autre appareil supprime la clé à son tour. C'est ce que veut dire
     « l'effacement ciblé se propage », et c'est ce que l'écran annonce.

     On réécrit le registre une fois, après la boucle : c'est une seule valeur
     dans `etat`, et la réécrire vingt fois n'aurait servi qu'à multiplier les
     occasions de la perdre à moitié.
  */
  if (registreARetirer.length) {
    const registre = (await base.get('etat', 'reglagesSync')) as
      | Record<string, { valeur: unknown; hlc: string; appareil: string; efface?: true }>
      | undefined;
    if (registre) {
      const concernees = registreARetirer.filter((clef) => clef in registre);
      if (concernees.length) {
        const { prochaineHlc } = await import('../sync/horloge-locale');
        const { lireAppareil } = await import('../db');
        const appareil = await lireAppareil();
        for (const clef of concernees) {
          registre[clef] = { valeur: null, hlc: await prochaineHlc(), appareil, efface: true };
        }
        /*
           LA CLÉ RESTE UN LITTÉRAL NU, SANS TRANSTYPAGE.

           `essais:reglages-orphelins` relève les clés d'état en lisant le
           code : un littéral enveloppé dans un `as never` lui devient une
           « clé variable », donc une clé inconnue du catalogue — et il rougit,
           alors que `reglagesSync` y est déclaré depuis toujours. Le
           transtypage portait sur la valeur, pas sur la clé : il n'avait
           aucune raison d'être là.
        */
        await base.put('etat', registre as never, 'reglagesSync');
      }
    }
  }

  /*
     L'import est dynamique pour la même raison qu'ailleurs : le journalisateur
     a besoin de l'horloge logique, qui a besoin de cette base.
  */
  let suppressionsJournalisees = 0;
  if (supprimees.length) {
    try {
      const { journaliserSuppressions } = await import('../sync/faits-domaine');
      suppressionsJournalisees = await journaliserSuppressions(supprimees);
    } catch {
      // L'effacement a eu lieu ; la suppression non journalisée se rattrape à
      // la réparation, et l'écran annonce le compte.
    }
  }

  return { effaces, total, refuses, suppressionsJournalisees };
}
