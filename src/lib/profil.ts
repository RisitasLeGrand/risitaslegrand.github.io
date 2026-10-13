/**
 * Le profil commun, côté base : lire, écrire, restreindre, supprimer.
 *
 * `noyau/profil.ts` tient les règles et ne touche à rien ; ce module leur donne
 * IndexedDB et l'horloge logique. La frontière est la même que partout dans ce
 * projet, et pour la même raison : les règles sont éprouvables sans navigateur,
 * et ce qui est ici — lecture, écriture, concurrence — ne l'est pas.
 *
 * ## Pourquoi il n'écrit pas par `enregistrerFait`
 *
 * `sync/service.ts` offre déjà cette porte, mais l'importer ferait venir avec
 * elle le chiffrement, les paquets, les transports et la compaction — pour
 * écrire trente octets. L'écran « Mon profil » n'a pas besoin de tout cela, et
 * le menu encore moins : il ne lit qu'un prénom.
 */
import { db, lireAppareil, toutesLesOperations } from './db';
import { signalerEcriture } from './sync/signal-ecriture';
import { prochaineHlc } from './sync/horloge-locale';
import { decoderHlc } from './noyau/hlc';
import { operation, SANS_LOT, type Operation } from './noyau/operations';
import { ulid } from './noyau/ulid';
import { BRANCHES } from './branches';
import {
  CIBLE_INITIALISATION,
  TYPE_CHAMP_PROFIL,
  TYPE_INITIALISATION,
  avancement,
  cibleDuChamp,
  divergences,
  lireInitialisation,
  lireProfil,
  pourBranche,
  valider,
  type Avancement,
  type ChargeChamp,
  type Divergence,
  type Initialisation,
  type Portee,
  type Profil,
  type Source,
  type ValeurDeChamp,
} from './noyau/profil';

/** Écrit une opération de profil. Rendue pour que l'appelant puisse la dater. */
async function journaliser(cible: string, type: string, charge: unknown): Promise<Operation> {
  const op = operation({
    id: ulid(),
    appareil: await lireAppareil(),
    hlc: decoderHlc(await prochaineHlc()),
    type,
    cible,
    lot: SANS_LOT,
    charge,
  });
  await (await db()).put('operations', op);
  signalerEcriture();
  return op;
}

export async function profilLocal(): Promise<Profil> {
  return lireProfil(await toutesLesOperations());
}

/** Ce qu'une branche lit du profil : les champs dont la portée l'inclut. */
export async function profilDeBranche(branche: string): Promise<Map<string, unknown>> {
  return pourBranche(await profilLocal(), branche);
}

/** Un champ, ou `null`. Le raccourci que les écrans utilisent le plus. */
export async function champ(nom: string): Promise<ValeurDeChamp | null> {
  return (await profilLocal()).get(nom) ?? null;
}

/**
 * Le prénom, pour la salutation du menu.
 *
 * Rendu `null` plutôt que vide : le menu doit pouvoir distinguer « pas encore
 * dit » de « dit, et c'est une chaîne vide », et ne saluer que dans le premier
 * cas.
 */
export async function prenom(): Promise<string | null> {
  const valeur = await champ('prenom');
  return typeof valeur?.valeur === 'string' && valeur.valeur.trim() ? valeur.valeur.trim() : null;
}

export class ChampRefuse extends Error {}

export interface OptionsEcriture {
  source?: Source;
  portee?: Portee;
}

/**
 * Pose ou change un champ.
 *
 * Lève sur une valeur mal formée plutôt que de l'écrire : un champ de profil est
 * lu par les branches, et une heure qui n'est pas une heure casserait un réglage
 * loin de l'écran qui l'a saisie.
 */
export async function ecrireChamp(
  nom: string,
  valeur: unknown,
  options: OptionsEcriture = {},
): Promise<void> {
  const verdict = valider(nom, valeur);
  if (!verdict.recevable) throw new ChampRefuse(verdict.motif ?? 'Valeur refusée.');
  const charge: ChargeChamp = {
    valeur,
    source: options.source ?? 'declare',
    ...(options.portee !== undefined ? { portee: options.portee } : {}),
  };
  await journaliser(cibleDuChamp(nom), TYPE_CHAMP_PROFIL, charge);
}

/**
 * Change la portée d'un champ, sans toucher à sa valeur.
 *
 * La valeur est réécrite avec elle, et ce n'est pas un détail : la portée vit
 * dans la charge de l'opération, donc la changer veut dire écrire une nouvelle
 * version du champ. L'alternative — une opération « portée » séparée — aurait
 * demandé de fusionner deux dimensions du même champ indépendamment, ce qui
 * ouvre la porte à un champ dont la valeur vient d'un appareil et la portée d'un
 * autre.
 */
export async function restreindre(nom: string, portee: Portee): Promise<void> {
  const actuel = await champ(nom);
  if (!actuel) throw new ChampRefuse(`Le champ « ${nom} » n’est pas renseigné.`);
  await ecrireChamp(nom, actuel.valeur, { source: actuel.source, portee });
}

/**
 * Supprime un champ. A.5 : « je peux supprimer un champ ou tout le profil ».
 *
 * La suppression est une **opération**, comme ailleurs : sans elle, le champ
 * reviendrait du premier appareil qui n'a pas vu l'effacement.
 */
export async function supprimerChamp(nom: string): Promise<void> {
  await journaliser(cibleDuChamp(nom), TYPE_CHAMP_PROFIL, { supprime: true } satisfies ChargeChamp);
}

/** Supprime tout le profil, champ par champ, pour la même raison. */
export async function supprimerProfil(): Promise<number> {
  const profil = await profilLocal();
  for (const nom of profil.keys()) await supprimerChamp(nom);
  return profil.size;
}

export async function divergencesLocales(): Promise<Divergence[]> {
  return divergences(await toutesLesOperations());
}

export async function avancementLocal(): Promise<Avancement> {
  return avancement(await toutesLesOperations());
}

export async function initialisationLocale(): Promise<Initialisation | null> {
  return lireInitialisation(await toutesLesOperations());
}

/** Marque l'initialisation comme vue. Idempotente : la première marque vaut. */
export async function marquerInitialisation(allegee: boolean): Promise<Initialisation> {
  const deja = await initialisationLocale();
  if (deja) return deja;
  await journaliser(CIBLE_INITIALISATION, TYPE_INITIALISATION, {
    termineeLe: new Date().toISOString(),
    allegee,
  });
  return (await initialisationLocale())!;
}

/** Les identifiants des branches déclarées, pour l'écran « Mon profil ». */
export const branchesConnues = (): string[] => BRANCHES.map((b) => b.id);
