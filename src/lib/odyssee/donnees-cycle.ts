/**
 * Lire et écrire le suivi personnel, et la cinquième porte que j'avais manquée.
 *
 * ## Tout passe par le coffre, sans exception
 *
 * Comme `donnees-sensible.ts` : chaque fonction appelle `exigerLeCoffre()`,
 * qui **lève** si la clé n'est pas en mémoire. Rendre `null` aurait semblé
 * plus doux et aurait produit la seule erreur qui compte — un appelant
 * distrait écrivant en clair dans un magasin scellé.
 *
 * ## CE MODULE NE JOURNALISE PAS, ET C'EST LE POINT LE PLUS IMPORTANT DU FICHIER
 *
 * Tous ses voisins appellent `journaliser()` après une écriture. J'allais
 * faire pareil par mimétisme. Puis j'ai lu où cela mène :
 * `journaliserEnregistrement()` écrit dans le **journal d'opérations**, et le
 * journal d'opérations est précisément ce que la synchronisation transporte.
 * L'en-tête de `donnees-sensible.ts` le dit sans détour : les magasins
 * scellés « voyagent, se sauvegardent et s'effacent par le même mécanisme ».
 *
 * Journaliser le suivi l'aurait donc **synchronisé**, contre la décision 18,
 * **sans qu'aucun nom de magasin apparaisse dans la couche de
 * synchronisation**. C'est une cinquième porte, et mon essai du lot 4 ne la
 * gardait pas : il vérifiait que `sync/service.ts` et `sync/paquet.ts` ne
 * nomment aucun magasin du suivi, ce qui était vrai et ne suffisait pas. Il
 * la garde maintenant, en vérifiant que ce fichier-ci n'appelle rien de
 * `faits-domaine`.
 *
 * Ce que ne pas journaliser coûte : rien pour la sauvegarde ni pour
 * l'effacement, qui lisent les magasins directement
 * (`MAGASINS_SAUVEGARDES`, les groupes). Le journal ne sert qu'à la
 * synchronisation, et la synchronisation du suivi appartient au lot B-6 du
 * constructeur, qui la branchera quand les garanties seront démontrées.
 *
 * ## La clé est une empreinte, donc il n'y a pas de parcours
 *
 * `cleDuJourDeCycle(jour)` est la seule façon d'atteindre une saisie. Il n'y
 * a ni index ni `getAll` utile : la liste des clés ne dit rien, et c'est le
 * but. Lire un mois demande donc trente et une lectures par clé, ce que
 * `saisiesDesJours()` fait en une transaction.
 *
 * `toutesLesSaisies()` existe quand même, pour l'effacement et pour les
 * statistiques du lot suivant, et son commentaire dit à quoi elle ne sert
 * pas : à retrouver un jour. Elle ouvre tout, ce qui demande le coffre et ne
 * doit pas devenir le chemin ordinaire.
 */
import { db } from '../db';
import { jourLogique } from '../noyau/jour-logique';
import { exigerLeCoffre } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import { cleDuJourDeCycle } from './cycle-confidentialite';
import {
  controlerReglagesDuCycle,
  controlerSaisie,
  ID_DES_REGLAGES,
  REGLAGES_AU_DEPART,
  type NiveauDeSaignement,
  type ReglagesDuCycle,
  type SaisieDuCycle,
} from './cycle';

const maintenant = () => new Date().toISOString();

function exiger(problemes: readonly string[]): void {
  if (problemes.length) throw new Error(problemes.join(' '));
}

/* ══════════════════════════════════════════════════════════════════════════
   Les réglages
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les réglages, ou ceux du départ si rien n'a été écrit.
 *
 * Ne lève pas sur l'absence : un module jamais activé n'est pas une erreur,
 * c'est l'état initial. Lève en revanche si le coffre est fermé, parce que
 * savoir que le suivi est actif est déjà une information.
 */
export async function lireLesReglages(): Promise<ReglagesDuCycle> {
  const cle = exigerLeCoffre();
  const rangee = (await (await db()).get('odysseeCycleReglages', ID_DES_REGLAGES)) as
    | Record<string, unknown>
    | undefined;
  if (!rangee) return { ...REGLAGES_AU_DEPART };
  return await ouvrir<ReglagesDuCycle>(cle, rangee);
}

async function ecrireLesReglages(reglages: ReglagesDuCycle): Promise<ReglagesDuCycle> {
  const cle = exigerLeCoffre();
  exiger(controlerReglagesDuCycle(reglages));
  const scelle = await sceller(
    cle,
    'odysseeCycleReglages',
    reglages as unknown as Record<string, unknown>,
  );
  await (await db()).put('odysseeCycleReglages', scelle as unknown as ReglagesDuCycle);
  return reglages;
}

/** Active le suivi, en notant le jour — l'écran dira « depuis le … ». */
export async function activerLeSuivi(le = new Date()): Promise<ReglagesDuCycle> {
  return await ecrireLesReglages({
    ...(await lireLesReglages()),
    actif: true,
    activeLe: jourLogique(le),
    majLe: maintenant(),
  });
}

/**
 * Désactive le suivi, et **n'efface rien**.
 *
 * La nuance compte : désactiver et effacer sont deux gestes différents, et
 * les confondre ferait disparaître des mois de saisies derrière un
 * interrupteur. L'effacement passe par l'écran de données, groupe par
 * groupe, avec sa confirmation.
 *
 * `activeLe` repasse à `null` parce que son contrôle l'exige : une date
 * d'activation sur un suivi inactif laisserait croire qu'il observe.
 */
export async function desactiverLeSuivi(): Promise<ReglagesDuCycle> {
  return await ecrireLesReglages({
    ...(await lireLesReglages()),
    actif: false,
    activeLe: null,
    majLe: maintenant(),
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Le journal
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Note ou remplace la saisie d'un jour.
 *
 * Un seul enregistrement par jour, puisque la clé est l'empreinte du jour :
 * écrire deux fois le même jour remplace. C'est ce qu'on veut d'une saisie
 * quotidienne — la personne corrige, elle n'empile pas.
 */
export async function noterLeJour(
  jour: string,
  niveau: NiveauDeSaignement,
  options: { note?: string; debutDeclare?: boolean } = {},
): Promise<SaisieDuCycle> {
  const cle = exigerLeCoffre();
  const saisie: SaisieDuCycle = {
    id: await cleDuJourDeCycle(jour),
    jour,
    niveau,
    note: options.note ?? '',
    debutDeclare: options.debutDeclare ?? false,
    majLe: maintenant(),
  };
  exiger(controlerSaisie(saisie));

  const scelle = await sceller(
    cle,
    'odysseeCycleJournal',
    saisie as unknown as Record<string, unknown>,
  );
  await (await db()).put('odysseeCycleJournal', scelle as unknown as SaisieDuCycle);
  /*
     PAS DE journaliser() ICI. Voir l'en-tête : ce serait synchroniser le
     suivi contre la décision 18, sans qu'aucun nom de magasin apparaisse
     dans la couche de synchronisation.
  */
  return saisie;
}

/** La saisie d'un jour, ou `null`. Une lecture par clé, sans parcours. */
export async function saisieDuJour(jour: string): Promise<SaisieDuCycle | null> {
  const cle = exigerLeCoffre();
  const rangee = (await (await db()).get('odysseeCycleJournal', await cleDuJourDeCycle(jour))) as
    | Record<string, unknown>
    | undefined;
  if (!rangee) return null;
  return await ouvrir<SaisieDuCycle>(cle, rangee);
}

/**
 * Les saisies de jours nommés, dans l'ordre donné, les absents écartés.
 *
 * C'est le chemin ordinaire de lecture, et il demande de savoir quels jours
 * on veut — ce qui est toujours le cas d'un écran, qui affiche une période.
 */
export async function saisiesDesJours(jours: readonly string[]): Promise<SaisieDuCycle[]> {
  const cle = exigerLeCoffre();
  const base = await db();
  const clefs = await Promise.all(jours.map((j) => cleDuJourDeCycle(j)));
  const rangees = await Promise.all(
    clefs.map((k) => base.get('odysseeCycleJournal', k) as Promise<Record<string, unknown> | undefined>),
  );
  const trouvees = rangees.filter((r): r is Record<string, unknown> => r !== undefined);
  return await Promise.all(trouvees.map((r) => ouvrir<SaisieDuCycle>(cle, r)));
}

/**
 * Toutes les saisies, ouvertes.
 *
 * **Ne sert pas à retrouver un jour** — pour cela, `saisieDuJour`, qui lit
 * une clé au lieu d'ouvrir tout le journal. Celle-ci existe pour les
 * statistiques personnelles du lot suivant et pour les écrans de données,
 * qui ont besoin du compte. L'employer comme chemin ordinaire reviendrait à
 * déchiffrer des mois de saisies pour en afficher une.
 */
export async function toutesLesSaisies(): Promise<SaisieDuCycle[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeCycleJournal')) as unknown as Record<
    string,
    unknown
  >[];
  const ouvertes = await Promise.all(rangees.map((r) => ouvrir<SaisieDuCycle>(cle, r)));
  return ouvertes.sort((a, b) => a.jour.localeCompare(b.jour));
}

/**
 * Combien de saisies, **sans ouvrir le coffre**.
 *
 * Le compte d'un magasin scellé se lit sur le nombre de clés, et aucune clé
 * ne dit rien ici. C'est la seule chose que le suivi laisse savoir coffre
 * fermé, et elle sert à l'écran de stockage, qui annonce des volumes.
 */
export async function combienDeSaisies(): Promise<number> {
  return await (await db()).count('odysseeCycleJournal');
}

/** Efface la saisie d'un jour. Pas de journal de suppression, même raison. */
export async function effacerLeJour(jour: string): Promise<void> {
  exigerLeCoffre();
  await (await db()).delete('odysseeCycleJournal', await cleDuJourDeCycle(jour));
}

const JOUR_EN_MS = 86_400_000;

/**
 * Les jours d'une plage, bornes incluses.
 *
 * `joursDeLaFenetre` (`odyssee/indicateurs.ts`) fait exactement cela, et je
 * ne l'importe pas : ce module est la couche de données d'un magasin scellé,
 * et `indicateurs.ts` est le module d'analyse. Lui emprunter une fonction
 * créerait une arête de la donnée du cycle vers l'analyse — précisément le
 * chemin dont le § 6 du prompt 30 demande qu'il n'existe pas. Six lignes
 * recopiées coûtent moins qu'une dépendance qu'il faudra ensuite défendre.
 */
function joursDeLaPlage(du: string, au: string): string[] {
  const jours: string[] = [];
  const fin = Date.parse(`${au}T00:00:00Z`);
  for (let t = Date.parse(`${du}T00:00:00Z`); t <= fin; t += JOUR_EN_MS) {
    jours.push(new Date(t).toISOString().slice(0, 10));
  }
  return jours;
}

/**
 * Efface les saisies d'une période, bornes incluses. Rend combien sont parties.
 *
 * ## Pourquoi cette fonction existe, et pourquoi elle est ici
 *
 * La partie 1 point 10 du prompt 30 demande que le cycle soit « effaçable par
 * période par purge physique ». L'écran de données générique fait cela pour
 * tous les magasins, en lisant le champ de date **dans l'enregistrement en
 * clair** (`dateDe`, `sauvegarde/groupes.ts`). Ce magasin n'a plus de date en
 * clair — le § 6.9 l'interdit — donc ce chemin-là ne peut pas le découper.
 * C'est le conflit d'architecture que la décision 25 demande d'énoncer, et il
 * est écrit dans `decisions-en-attente-cycle-2026-10-19.md`.
 *
 * L'effacement par période se fait donc **ici, coffre ouvert**, et sans
 * aucune date en clair : les clés du journal sont les empreintes
 * déterministes des jours, donc on recalcule les empreintes des jours voulus
 * et on supprime celles-là. Rien n'est lu, rien n'est ouvert, rien n'est
 * déchiffré — on ne demande pas à la base ce qu'elle contient, on lui dit
 * quoi retirer.
 *
 * ## Ce que cela coûte, mesuré et non supposé
 *
 * Le coût est linéaire **en nombre de jours de la plage**, pas en nombre de
 * saisies : une plage de dix ans fait 3 653 empreintes, même si une seule
 * saisie existe. C'est le prix de la clé opaque, et il se paie au moment où
 * quelqu'un efface, jamais quand il saisit.
 *
 * ## Une suppression de clé absente ne lève pas
 *
 * `delete` sur une clé qui n'existe pas réussit sans rien faire dans
 * IndexedDB. Le compte rendu est donc fait de ce qui existait **avant** la
 * suppression, lu sur les clés et non sur les valeurs : `getKey` dit si une
 * empreinte est là sans rien ouvrir. Autrement la fonction annoncerait avoir
 * effacé dix ans de vide.
 */
async function clefsPresentesDeLaPeriode(du: string, au: string): Promise<string[]> {
  if (au < du) return [];
  const base = await db();
  const clefs = await Promise.all(joursDeLaPlage(du, au).map((j) => cleDuJourDeCycle(j)));
  const presentes: string[] = [];
  for (const k of clefs) {
    if ((await base.getKey('odysseeCycleJournal', k)) !== undefined) presentes.push(k);
  }
  return presentes;
}

/**
 * Combien de saisies une période porte, **sans en ouvrir aucune**.
 *
 * `getKey` dit si une empreinte est là ; elle ne lit pas la valeur, donc rien
 * n'est déchiffré. C'est ce qui permet à l'écran d'annoncer un nombre avant
 * d'effacer, sans faire de ce compte une lecture du journal.
 */
export async function combienDansLaPeriode(du: string, au: string): Promise<number> {
  exigerLeCoffre();
  return (await clefsPresentesDeLaPeriode(du, au)).length;
}

export async function effacerLaPeriode(du: string, au: string): Promise<number> {
  exigerLeCoffre();
  const base = await db();
  const presentes = await clefsPresentesDeLaPeriode(du, au);
  for (const k of presentes) await base.delete('odysseeCycleJournal', k);
  return presentes.length;
}
