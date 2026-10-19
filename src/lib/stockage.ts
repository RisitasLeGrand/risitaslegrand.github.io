/**
 * Ce que l'espace de stockage contient, et ce qui le menace.
 *
 * ## Le danger n'est pas le quota
 *
 * Les mesures sont faites : cinq ans d'usage intensif occupent neuf mégaoctets,
 * et les quotas de navigateur se comptent en gigaoctets
 * (`docs/cyclades/budget-stockage.md`). Le quota ne sera pas le problème.
 *
 * Le problème est la **perte** : données de site effacées à la main ou par un
 * nettoyeur, changement d'appareil, éviction automatique. Cette page affiche donc
 * l'occupation parce qu'il faut bien la savoir, mais elle insiste sur la
 * sauvegarde, qui est la seule chose qui protège.
 */
import { MAGASINS_PROGRESSION,
  MAGASINS_SAUVEGARDES, exporterMagasins } from './db';

/* ══════════════════════════════════════════════════════════════════════════
   Occupation
   ══════════════════════════════════════════════════════════════════════════ */

export interface Occupation {
  /** Octets occupés d'après le navigateur, tous stockages confondus. */
  utilise: number | null;
  /** Quota estimé. Les navigateurs le donnent arrondi, parfois très large. */
  quota: number | null;
  /** Part du quota utilisée, de 0 à 1. `null` si le navigateur se taît. */
  part: number | null;
  /** `attention` au-delà de 70 %, `critique` au-delà de 90 %. */
  alerte: 'aucune' | 'attention' | 'critique';
}

const SEUIL_ATTENTION = 0.7;
const SEUIL_CRITIQUE = 0.9;

/**
 * L'occupation vue par le navigateur.
 *
 * `estimate()` manque dans quelques navigateurs et lève dans quelques contextes.
 * Ne pas savoir n'est pas une panne : la page le dit et continue.
 */
export async function occupation(): Promise<Occupation> {
  try {
    const e = await navigator.storage?.estimate?.();
    const utilise = e?.usage ?? null;
    const quota = e?.quota ?? null;
    const part = utilise !== null && quota ? utilise / quota : null;
    return {
      utilise,
      quota,
      part,
      alerte:
        part === null
          ? 'aucune'
          : part >= SEUIL_CRITIQUE
            ? 'critique'
            : part >= SEUIL_ATTENTION
              ? 'attention'
              : 'aucune',
    };
  } catch {
    return { utilise: null, quota: null, part: null, alerte: 'aucune' };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Persistance
   ══════════════════════════════════════════════════════════════════════════ */

export interface Persistance {
  /** Le navigateur sait-il répondre ? */
  disponible: boolean;
  /** Le stockage est-il déjà marqué persistant ? */
  accorde: boolean;
}

export async function lirePersistance(): Promise<Persistance> {
  try {
    if (!navigator.storage?.persisted) return { disponible: false, accorde: false };
    return { disponible: true, accorde: await navigator.storage.persisted() };
  } catch {
    return { disponible: false, accorde: false };
  }
}

/**
 * Demande le stockage persistant.
 *
 * Un refus est un cas ordinaire, pas une erreur : Chromium l'accorde sur des
 * signaux d'engagement, Safari sur des heuristiques qu'il ne documente pas. Rien
 * ne doit être bloqué par un refus, et surtout rien ne doit laisser croire
 * qu'un accord met les données à l'abri — il réduit le risque d'éviction
 * automatique, il n'empêche ni un effacement à la main ni un changement
 * d'appareil.
 */
export async function demanderPersistance(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * La clé qui retient la date de la dernière demande.
 *
 * Dans `localStorage` et non en base : la demande concerne CE navigateur sur
 * CET appareil, et ne doit pas voyager dans une sauvegarde ni se
 * synchroniser. Un appareil qui a refusé n'apprend rien à un autre.
 */
export const CLE_PERSISTANCE_DEMANDEE = 'revinsp.persistance-demandee-le';

/**
 * Une semaine entre deux demandes.
 *
 * Pourquoi réitérer du tout : Chromium accorde la persistance sur des
 * signaux d'engagement qui s'accumulent — visites répétées, installation sur
 * l'écran d'accueil, notifications acceptées. Un refus aujourd'hui n'est pas
 * un refus définitif, et ne jamais redemander condamne à vivre avec le
 * premier non.
 *
 * Pourquoi ne pas redemander à chaque fois : l'appel n'est pas gratuit pour
 * le navigateur, et sur Safari il peut afficher une invite. Une fois par
 * semaine suffit à suivre l'engagement sans harceler.
 */
export const DELAI_ENTRE_DEMANDES_MS = 7 * 86_400_000;

export interface SuiteDeDemande extends Persistance {
  /** La demande a-t-elle été faite maintenant ? */
  demandee: boolean;
  /** Pourquoi elle ne l'a pas été, quand elle ne l'a pas été. */
  raison: 'accorde-deja' | 'indisponible' | 'trop-recent' | 'demandee';
}

/**
 * Demande la persistance **de lui-même**, au bon moment (A4 du prompt 43).
 *
 * ## Pourquoi cette fonction existe
 *
 * `demanderPersistance()` existait, et un seul bouton l'appelait, sur la page
 * Stockage. Personne n'allant sur cette page, personne ne demandait : la
 * permission qui empêche le navigateur d'effacer les données pour faire de la
 * place n'était, en pratique, jamais demandée.
 *
 * ## Pourquoi APRÈS une sauvegarde confirmée, et pas au démarrage
 *
 * Les navigateurs accordent la persistance sur l'engagement. Demander à la
 * première ouverture, quand rien n'a encore été fait, c'est demander au
 * moment où le refus est le plus probable — et un refus coûte la semaine de
 * délai. Juste après qu'une sauvegarde a été faite ET retrouvée, la personne
 * vient de poser un geste délibéré : c'est le meilleur moment, et c'est aussi
 * celui où la promesse est la plus honnête, puisque la vraie protection
 * (le fichier hors de l'appareil) existe désormais.
 *
 * ## Ce qu'un accord ne fait pas, et il faut le redire
 *
 * Il réduit le risque d'éviction automatique. Il n'empêche ni un effacement
 * à la main, ni un changement d'appareil, ni une perte du mot de passe. La
 * sauvegarde reste la seule protection réelle.
 */
export async function assurerLaPersistance(
  maintenant = Date.now(),
): Promise<SuiteDeDemande> {
  const etat = await lirePersistance();
  if (!etat.disponible) return { ...etat, demandee: false, raison: 'indisponible' };
  if (etat.accorde) return { ...etat, demandee: false, raison: 'accorde-deja' };

  /*
     `localStorage` peut jeter — fenêtre privée, données de site bloquées. Un
     stockage illisible ne doit pas empêcher la demande : au pire on
     redemandera plus souvent que prévu, ce qui est moins grave que de ne
     jamais demander.
  */
  let dernier = 0;
  try {
    dernier = Number(localStorage.getItem(CLE_PERSISTANCE_DEMANDEE)) || 0;
  } catch {
    dernier = 0;
  }
  if (dernier && maintenant - dernier < DELAI_ENTRE_DEMANDES_MS) {
    return { ...etat, demandee: false, raison: 'trop-recent' };
  }

  const accorde = await demanderPersistance();
  try {
    localStorage.setItem(CLE_PERSISTANCE_DEMANDEE, String(maintenant));
  } catch {
    /* rien : la demande a eu lieu, c'est seulement sa date qu'on perd */
  }
  return { disponible: true, accorde, demandee: true, raison: 'demandee' };
}

/* ══════════════════════════════════════════════════════════════════════════
   Détail par magasin
   ══════════════════════════════════════════════════════════════════════════ */

export interface PoidsDeMagasin {
  nom: string;
  enregistrements: number;
  /** Taille du magasin sérialisé en JSON, en octets. Voir l'avertissement. */
  serialise: number;
}

export interface DetailStockage {
  magasins: PoidsDeMagasin[];
  serialiseTotal: number;
  enregistrementsTotal: number;
  /**
   * Rapport entre l'occupation réelle et la somme des tailles sérialisées.
   *
   * Nettement inférieur à 1 en pratique : les navigateurs compriment les valeurs
   * d'IndexedDB pour leur propre compte. C'est une information utile et
   * contre-intuitive, donc affichée plutôt que cachée.
   */
  rapportReel: number | null;
}

/**
 * Pèse chaque magasin.
 *
 * ## Pourquoi c'est une estimation, et pourquoi c'est dit
 *
 * IndexedDB ne donne pas la taille d'un magasin. La seule mesure possible est
 * de relire son contenu et de le sérialiser — ce qui donne la taille du
 * **modèle de données**, et non l'occupation sur le disque. L'écart est grand,
 * et dans le bon sens : le navigateur comprime.
 *
 * L'opération relit toute la base. C'est pour cela qu'elle est déclenchée par
 * un geste et non au chargement de la page.
 */
export async function detailStockage(reel: number | null): Promise<DetailStockage> {
  const magasins = await exporterMagasins(MAGASINS_SAUVEGARDES);
  const poids = Object.entries(magasins)
    .map(([nom, enregistrements]) => ({
      nom,
      enregistrements: enregistrements.length,
      serialise: enregistrements.reduce(
        (somme: number, e) => somme + JSON.stringify(e).length + 1,
        0,
      ),
    }))
    .sort((a, b) => b.serialise - a.serialise);
  const serialiseTotal = poids.reduce((s, m) => s + m.serialise, 0);
  return {
    magasins: poids,
    serialiseTotal,
    enregistrementsTotal: poids.reduce((s, m) => s + m.enregistrements, 0),
    rapportReel: reel !== null && serialiseTotal ? reel / serialiseTotal : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Intégrité
   ══════════════════════════════════════════════════════════════════════════ */

export interface Anomalie {
  magasin: string;
  /** Ce qui ne va pas, en une phrase affichable. */
  quoi: string;
  /** Combien d'enregistrements sont concernés. */
  combien: number;
}

/**
 * Un contrôle léger, au geste de la personne.
 *
 * Il ne vérifie pas des sommes de contrôle — il n'y a pas de segment compressé à
 * contrôler — mais les liens que le modèle suppose et que rien n'empêche de
 * rompre : une note sans séance, une séance sans thème, une carte sans fiche.
 *
 * **Il ne répare rien et n'efface rien.** Il nomme, et c'est tout : une
 * réparation automatique sur une base qu'on ne comprend pas est le meilleur
 * moyen de transformer une anomalie bénigne en perte.
 */
export async function controlerIntegrite(): Promise<Anomalie[]> {
  const magasins = await exporterMagasins(['seances', 'notes', 'cartes', 'fiches', 'journal']);
  const anomalies: Anomalie[] = [];

  const idsSeances = new Set(
    (magasins.seances as { id?: string }[]).map((s) => s.id).filter((id) => id !== undefined),
  );
  const notesOrphelines = (magasins.notes as { seanceId: string }[]).filter(
    (n) => !idsSeances.has(n.seanceId),
  );
  if (notesOrphelines.length) {
    anomalies.push({
      magasin: 'notes',
      quoi: 'des notes de séance ne se rattachent à aucune séance',
      combien: notesOrphelines.length,
    });
  }

  const sansTheme = (magasins.seances as { theme?: string }[]).filter((s) => !s.theme?.trim());
  if (sansTheme.length) {
    anomalies.push({
      magasin: 'seances',
      quoi: 'des séances n’ont pas de thème',
      combien: sansTheme.length,
    });
  }

  const idsFiches = new Set((magasins.fiches as { id: string }[]).map((f) => f.id));
  // Une carte peut légitimement précéder l'état de sa fiche : seules les
  // cartes dont la fiche n'est pas connue du tout sont signalées.
  const cartesOrphelines = (magasins.cartes as { ficheId?: string }[]).filter(
    (c) => c.ficheId && idsFiches.size > 0 && !idsFiches.has(c.ficheId),
  );
  if (cartesOrphelines.length) {
    anomalies.push({
      magasin: 'cartes',
      quoi: 'des flashcards désignent une fiche inconnue — souvent le signe d’un contenu renommé',
      combien: cartesOrphelines.length,
    });
  }

  const journalSansMatiere = (magasins.journal as { matiere?: string }[]).filter(
    (e) => !e.matiere?.trim(),
  );
  if (journalSansMatiere.length) {
    anomalies.push({
      magasin: 'journal',
      quoi: 'des entrées du journal d’erreurs n’ont pas de matière',
      combien: journalSansMatiere.length,
    });
  }

  return anomalies;
}
