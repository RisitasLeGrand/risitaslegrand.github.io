/**
 * Lire et écrire les exceptions des séries — complément de la phase 2.
 *
 * Quatre magasins, deux en clair et deux scellés, posés par la phase 2 :
 * `odysseeOccurrences`, `odysseeEtapesCochees`, `odysseeExceptionsScellees`
 * et `odysseeReports`. Ce module est la seule porte d'entrée vers eux.
 *
 * ## Ce que ce module fait, et ce qu'il laisse à la phase 5
 *
 * Il sait **ranger** une exception en clair ou sous scellé. Il ne sait pas
 * **décider** laquelle des deux : cela demande de savoir si la branche liée à
 * la tâche est sous coffre, et ce vocabulaire des branches n'existe pas
 * encore — c'est la phase 5 qui le pose. L'inventer ici reviendrait à figer,
 * dans la couche de stockage, une liste de branches que personne n'a encore
 * arrêtée, et qu'il faudrait ensuite défaire.
 *
 * L'appelant dit donc où il range. C'est un manque assumé et daté, pas un
 * oubli : tant que la phase 5 n'est pas écrite, aucun écran n'appelle ces
 * fonctions-là.
 *
 * ## Le coffre
 *
 * Les deux fonctions scellées appellent `exigerLeCoffre()`, qui **lève** si
 * la clé n'est pas en mémoire. Aucune n'écrit « à moitié » : soit le coffre
 * est ouvert et l'écriture est scellée, soit rien n'est écrit. Retenir un
 * pointage coffre fermé est l'objet des reports, et c'est la phase 7.
 */
import { db } from '../db';
import { exigerLeCoffre, rangementDeLaBoite } from '../coffre';
import { ouvrir, sceller } from '../noyau/coffre';
import {
  controlerEtapeCochee,
  controlerOccurrence,
  idEtapeCochee,
  idOccurrence,
  type EtapeCochee,
  type ExceptionScellee,
  type Occurrence,
  type ContenuDuReport,
  type ReportEnAttente,
} from './modele';

type MagasinOccurrence =
  | 'odysseeOccurrences'
  | 'odysseeEtapesCochees'
  | 'odysseeExceptionsScellees'
  | 'odysseeReports';

/*
   Journalisation silencieuse, comme dans le reste d'Odyssée : une
   synchronisation indisponible ne doit pas empêcher d'écrire chez soi.
*/
async function journaliser(magasin: MagasinOccurrence, enregistrement: unknown): Promise<void> {
  try {
    const { journaliserEnregistrement } = await import('../sync/faits-domaine');
    await journaliserEnregistrement(magasin, enregistrement as Record<string, unknown>);
  } catch {
    /* Volontairement muet. */
  }
}

async function journaliserSuppression(cibles: readonly string[]): Promise<void> {
  try {
    const { journaliserSuppressions } = await import('../sync/faits-domaine');
    await journaliserSuppressions(cibles);
  } catch {
    /* Volontairement muet. */
  }
}

const maintenant = () => new Date().toISOString();

const exiger = (problemes: readonly string[]) => {
  if (problemes.length) throw new Error(problemes.join(' '));
};

/* ══════════════════════════════════════════════════════════════════════════
   Les occurrences, en clair
   ══════════════════════════════════════════════════════════════════════════ */

/** Les exceptions d'une tâche. Par l'index : une tâche en a peu, la base en a beaucoup. */
export async function occurrencesDeLaTache(tacheId: string): Promise<Occurrence[]> {
  return (await db()).getAllFromIndex('odysseeOccurrences', 'tacheId', tacheId);
}

/**
 * Toutes les exceptions **en clair**, sans toucher au magasin scellé.
 *
 * C'est ce que lit la projection des faits : elle n'a pas besoin du coffre,
 * et ne doit pas le réclamer. Une exception qui manque ici est scellée, donc
 * liée à une branche sous coffre — la projection le compte en manque.
 */
export async function occurrencesDuMagasinClair(): Promise<Occurrence[]> {
  return (await db()).getAll('odysseeOccurrences');
}

/** Les exceptions d'un jour logique, toutes tâches confondues. */
export async function occurrencesDuJour(jourPrevu: string): Promise<Occurrence[]> {
  return (await db()).getAllFromIndex('odysseeOccurrences', 'jourPrevu', jourPrevu);
}

/**
 * Écrit une exception en clair.
 *
 * L'identifiant n'est pas un paramètre : il se **calcule** à partir de la
 * tâche et du jour. C'est la clé de fusion, et un appelant qui la poserait à
 * côté ferait silencieusement deux lignes pour un seul geste. Le type le dit
 * — `Omit<Occurrence, 'id' | 'majLe'>` — plutôt que de l'accepter puis de
 * l'écraser en silence, ce qui aurait obligé les appelants à inventer une
 * valeur factice.
 */
export async function ecrireOccurrence(
  o: Omit<Occurrence, 'id' | 'majLe'>,
): Promise<Occurrence> {
  const avec = { ...o, id: idOccurrence(o.tacheId, o.jourPrevu), majLe: maintenant() };
  exiger(controlerOccurrence(avec));
  await (await db()).put('odysseeOccurrences', avec);
  await journaliser('odysseeOccurrences', avec);
  return avec;
}

/** Retire une exception : l'occurrence redevient ce que la règle en dit. */
export async function oublierOccurrence(tacheId: string, jourPrevu: string): Promise<void> {
  const id = idOccurrence(tacheId, jourPrevu);
  await (await db()).delete('odysseeOccurrences', id);
  await journaliserSuppression([`odysseeOccurrences:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les étapes cochées, en clair
   ══════════════════════════════════════════════════════════════════════════ */

export async function cochagesDeLaTache(tacheId: string): Promise<EtapeCochee[]> {
  return (await db()).getAllFromIndex('odysseeEtapesCochees', 'tacheId', tacheId);
}

export async function cochagesDuJour(jourPrevu: string): Promise<EtapeCochee[]> {
  return (await db()).getAllFromIndex('odysseeEtapesCochees', 'jourPrevu', jourPrevu);
}

/**
 * Coche une étape pour une occurrence.
 *
 * Idempotent par construction : la clé est déterministe, donc cocher deux
 * fois réécrit la même ligne. C'est voulu — un double clic, ou deux appareils
 * qui cochent la même chose, ne doivent pas faire deux cochages.
 */
export async function cocherEtape(
  tacheId: string,
  jourPrevu: string,
  etapeId: string,
  le = new Date(),
): Promise<EtapeCochee> {
  const cochage: EtapeCochee = {
    id: idEtapeCochee(tacheId, jourPrevu, etapeId),
    tacheId,
    jourPrevu,
    etapeId,
    le: le.toISOString(),
    majLe: maintenant(),
  };
  exiger(controlerEtapeCochee(cochage));
  await (await db()).put('odysseeEtapesCochees', cochage);
  await journaliser('odysseeEtapesCochees', cochage);
  return cochage;
}

/** Décoche : le cochage disparaît, et l'absence se lit « pas faite ». */
export async function decocherEtape(
  tacheId: string,
  jourPrevu: string,
  etapeId: string,
): Promise<void> {
  const id = idEtapeCochee(tacheId, jourPrevu, etapeId);
  await (await db()).delete('odysseeEtapesCochees', id);
  await journaliserSuppression([`odysseeEtapesCochees:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les exceptions scellées
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Toutes les exceptions scellées, ouvertes. **Lève si le coffre est fermé.**
 *
 * Pas d'index, donc pas de lecture par jour : le jour est dans le chiffré,
 * et c'est exactement ce qu'on protège. Ce magasin ne porte que les
 * exceptions des tâches sensibles ; il reste petit, et un parcours complet y
 * coûte moins qu'une fuite.
 */
export async function exceptionsScellees(): Promise<ExceptionScellee[]> {
  const cle = exigerLeCoffre();
  const rangees = (await (await db()).getAll('odysseeExceptionsScellees')) as unknown as Record<
    string,
    unknown
  >[];
  return Promise.all(rangees.map((r) => ouvrir<ExceptionScellee>(cle, r)));
}

/** Écrit une exception sous scellé. **Lève si le coffre est fermé.** */
export async function ecrireExceptionScellee(e: ExceptionScellee): Promise<ExceptionScellee> {
  const cle = exigerLeCoffre();
  const id =
    e.genre === 'occurrence'
      ? idOccurrence(e.tacheId, e.jourPrevu)
      : idEtapeCochee(e.tacheId, e.jourPrevu, e.etapeId);
  const avec = { ...e, id, majLe: maintenant() } as ExceptionScellee;
  exiger(
    avec.genre === 'occurrence' ? controlerOccurrence(avec) : controlerEtapeCochee(avec),
  );
  const scelle = await sceller(
    cle,
    'odysseeExceptionsScellees',
    avec as unknown as Record<string, unknown>,
  );
  await (await db()).put('odysseeExceptionsScellees', scelle as unknown as ExceptionScellee);
  await journaliser('odysseeExceptionsScellees', scelle);
  return avec;
}

/** Retire une exception scellée. N'exige pas le coffre : effacer n'est pas lire. */
export async function oublierExceptionScellee(id: string): Promise<void> {
  await (await db()).delete('odysseeExceptionsScellees', id);
  await journaliserSuppression([`odysseeExceptionsScellees:${id}`]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Les reports en attente
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   Les reports en attente — A-6, option D
   ══════════════════════════════════════════════════════════════════════════

   Trois fonctions, et la première est celle qui donne son sens au lot :
   **déposer n'exige pas le coffre**. C'était impossible tant que le magasin
   était scellé ; la boîte aux lettres le permet.
*/

/**
 * Dépose un geste pour plus tard. **N'exige pas le coffre.**
 *
 * Rend `false` s'il n'y a pas de boîte sur cet appareil — le coffre n'y a
 * jamais été ouvert, donc aucune paire n'a pu naître. L'écran doit le dire
 * plutôt que de laisser croire que le geste est gardé.
 */
export async function deposerUnReport(contenu: ContenuDuReport): Promise<boolean> {
  const { publiqueDeLaBoite } = await import('../noyau/boite-du-coffre');
  const { cleOpaque, deposer } = await import('../noyau/boite-aux-lettres');
  const publique = await publiqueDeLaBoite(rangementDeLaBoite());
  if (!publique) return false;
  const report: ReportEnAttente = {
    id: cleOpaque(),
    pli: await deposer(publique, contenu as unknown as Record<string, unknown>),
  };
  await (await db()).put('odysseeReports', report);
  /*
     PAS DE `journaliser()` ICI, et c'est délibéré. Le journal des opérations
     porte le nom du magasin et l'identifiant de la ligne en clair ; il
     n'ajouterait rien à ce que le magasin montre déjà — un pli existe — mais
     il le ferait voyager dans les paquets de synchronisation, où un pli
     illisible par l'autre appareil n'a rien à faire. Un report est local au
     coffre qui pourra l'ouvrir.
  */
  return true;
}

/** Combien de plis attendent. Lisible **coffre fermé** : seul le nombre sort. */
export async function combienDeReports(): Promise<number> {
  return (await db()).count('odysseeReports');
}

/**
 * Relève tout ce qui peut l'être. **Exige le coffre.**
 *
 * Rend les contenus relevés ET le nombre de plis illisibles. Ces derniers
 * sont ceux d'une boîte périmée — mot de passe changé — et ils ne sont
 * **pas supprimés** : un geste perdu sans trace est pire qu'un geste refusé.
 */
export async function releverLesReports(): Promise<{
  contenus: { id: string; contenu: ContenuDuReport }[];
  illisibles: number;
}> {
  const cle = exigerLeCoffre();
  const { priveeDeLaBoite } = await import('../noyau/boite-du-coffre');
  const { relever } = await import('../noyau/boite-aux-lettres');
  const privee = await priveeDeLaBoite(rangementDeLaBoite(), cle);
  const plis = await (await db()).getAll('odysseeReports');
  if (!privee) return { contenus: [], illisibles: plis.length };

  const contenus: { id: string; contenu: ContenuDuReport }[] = [];
  let illisibles = 0;
  for (const report of plis) {
    try {
      contenus.push({ id: report.id, contenu: await relever<ContenuDuReport>(privee, report.pli) });
    } catch {
      illisibles += 1;
    }
  }
  return { contenus, illisibles };
}

/** Supprime un pli une fois son geste rejoué. N'exige pas le coffre : effacer n'est pas lire. */
export async function oublierUnReport(id: string): Promise<void> {
  await (await db()).delete('odysseeReports', id);
}


/**
 * Rejoue les plis à l'ouverture du coffre — le dernier geste de l'option D.
 *
 * Chaque contenu relevé devient l'exception scellée qu'il aurait été si le
 * coffre avait été ouvert au moment du geste, **avec son instant d'origine**
 * — c'est tout l'objet de la décision 5 : le geste est gardé, pas reconstruit
 * à l'heure du rejeu.
 *
 * ## Trois façons de finir, et aucune n'est silencieuse
 *
 * - `rejoues` : les plis écrits puis supprimés ;
 * - `illisibles` : ceux d'une boîte périmée. **Ils ne sont pas supprimés.**
 *   Le mot de passe a changé, leur contenu est perdu, mais leur existence
 *   est rendue pour que l'écran puisse le dire — et qu'Alexis décide de les
 *   jeter lui-même ;
 * - `echecs` : relevés mais refusés à l'écriture, par exemple une tâche
 *   supprimée depuis. Conservés aussi, pour la même raison.
 *
 * ## L'idempotence, retrouvée ici et pas avant
 *
 * Les plis n'ont pas de clé métier : deux appareils hors ligne peuvent avoir
 * déposé le même geste. C'est à l'écriture que cela se résout — l'exception
 * porte, elle, la clé déterministe `tâche/jour`, donc deux plis du même
 * geste écrivent la même ligne, et la seconde écriture ne fait que la
 * réécrire à l'identique.
 */
export async function rejouerLesReports(): Promise<{
  rejoues: number;
  illisibles: number;
  echecs: number;
}> {
  const { contenus, illisibles } = await releverLesReports();
  let rejoues = 0;
  let echecs = 0;
  for (const { id, contenu } of contenus) {
    try {
      await ecrireExceptionScellee({
        genre: 'occurrence',
        id: '',
        majLe: '',
        tacheId: contenu.tacheId,
        jourPrevu: contenu.jourPrevu,
        etat: 'pointee',
        jourPorte: null,
        heure: null,
        le: contenu.le,
        motifAbandon: null,
      });
      await oublierUnReport(id);
      rejoues += 1;
    } catch {
      echecs += 1;
    }
  }
  return { rejoues, illisibles, echecs };
}
