/**
 * L'export ICS des échéances — Finances, phase 4.
 *
 * Mettre les échéances dans l'agenda du téléphone, pour que le loyer du 5 se
 * voie sans ouvrir Cyclades. Le fichier se construit avec le même écrivain
 * que le reste d'Odyssée : un second, écrit pour l'occasion, finirait par
 * dériver sur le pliage des lignes ou les CRLF, et produirait des fichiers
 * qu'un agenda refuse pour des raisons invisibles.
 *
 * ## Trois décisions, et elles ne vont pas de soi
 *
 * **Une échéance est une journée entière.** Un prélèvement n'a pas d'heure :
 * la banque le passe quand elle veut, et lui en inventer une à 9 h ferait
 * sonner un rappel à une heure qui ne veut rien dire. En journée entière, il
 * apparaît en bandeau, ce qui est exactement ce qu'il est.
 *
 * **L'UID se dérive de l'occurrence, qui est elle-même déterministe.** Même
 * ligne, même période, même identifiant, sur deux appareils comme à deux
 * mois d'intervalle. C'est ce qui fait qu'un réexport **met à jour** l'agenda
 * au lieu d'y empiler douze loyers.
 *
 * **Le montant est dans le titre, et le reste dans la description.** Un
 * agenda n'affiche souvent que le titre dans sa vue mensuelle ; mettre le
 * montant dans la description le rendrait invisible là où on regarde.
 *
 * ## Ce que l'export ne met pas dans le fichier
 *
 * Aucun nom de compte, aucun numéro, aucun écart au budget, aucun solde. Un
 * fichier `.ics` part dans un agenda qui est, pour la plupart des gens,
 * synchronisé chez un tiers. Ce qu'on y écrit **quitte l'appareil**, et c'est
 * le seul export de Finances dont c'est vrai : il porte donc le strict
 * nécessaire à reconnaître l'échéance, et `controlerLExportDEcheances()`
 * refuse le reste.
 */
import { euros } from './finances';
import type { LigneBudget, Occurrence } from './budget';
import { versFichierIcs } from './ics';
import type { Evenement } from './modele';

/** Le préfixe des UID, pour qu'un réimport reconnaisse les siens. */
export const PREFIXE_UID = 'echeance';

export interface OptionsExport {
  /** Ne pas exporter les échéances antérieures à ce jour. */
  depuis: string;
  /** Ni postérieures à celui-là. */
  jusqua: string;
  /** Les ressources aussi, ou les charges seules. */
  ressourcesComprises: boolean;
}

export const OPTIONS_PAR_DEFAUT = (aujourdHui: string): OptionsExport => ({
  depuis: aujourdHui,
  jusqua: ajouterMois(aujourdHui, 12),
  ressourcesComprises: true,
});

function ajouterMois(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  const voulu = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(voulu, dernier));
  return d.toISOString().slice(0, 10);
}

/**
 * Le titre d'une échéance.
 *
 * Le signe est écrit, et il n'est pas décoratif : dans un agenda qui mêle
 * tout, « Loyer 780,00 € » et « Salaire 2 350,00 € » se ressemblent trop. Le
 * « − » et le « + » tranchent d'un coup d'œil.
 */
export function titreDeLEcheance(ligne: LigneBudget, occ: Occurrence): string {
  const signe = occ.signe === -1 ? '−' : '+';
  return `${ligne.libelle} ${signe}${euros(occ.montant).replace('-', '')}`;
}

export function evenementsDesEcheances(
  lignes: readonly LigneBudget[],
  occurrences: readonly Occurrence[],
  options: OptionsExport,
): Evenement[] {
  const parLigne = new Map(lignes.map((l) => [l.id, l]));
  return occurrences
    .filter((o) => o.jour >= options.depuis && o.jour <= options.jusqua)
    .filter((o) => options.ressourcesComprises || o.signe === -1)
    .filter((o) => parLigne.has(o.ligneId))
    .sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id))
    .map((o) => {
      const ligne = parLigne.get(o.ligneId)!;
      return {
        id: o.id,
        majLe: `${o.jour}T00:00:00.000Z`,
        titre: titreDeLEcheance(ligne, o),
        domaine: 'finances' as Evenement['domaine'],
        debut: `${o.jour}T00:00:00.000Z`,
        fin: `${o.jour}T00:00:00.000Z`,
        journeeEntiere: true,
        lieu: '',
        /*
           La fenêtre d'appariement, et rien d'autre. Elle sert à quelque
           chose de concret : voir « du 3 au 7 » dans l'agenda dit qu'un
           prélèvement du 6 n'est pas en retard.
        */
        note:
          o.du === o.au
            ? 'Échéance prévue.'
            : `Échéance prévue, attendue entre le ${o.du} et le ${o.au}.`,
        uidIcs: `${PREFIXE_UID}-${o.id}@cyclades`,
        realise: 'a-faire' as Evenement['realise'],
        releveLe: null,
        motif: null,
        motifLibre: '',
      } satisfies Evenement;
    });
}

export function echeancesEnIcs(
  lignes: readonly LigneBudget[],
  occurrences: readonly Occurrence[],
  options: OptionsExport,
  maintenant = new Date(),
): string {
  return versFichierIcs(evenementsDesEcheances(lignes, occurrences, options), maintenant);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le garde-fou
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce qu'un fichier d'échéances n'a pas le droit de contenir.
 *
 * Le mot, pas le concept : on ne cherche pas à deviner un sens, on refuse des
 * chaînes précises qui ne devraient jamais être écrites dans un fichier qui
 * part chez un tiers.
 */
export const INTERDITS_DANS_LICS: readonly string[] = [
  'IBAN',
  'solde',
  'Solde',
  'hors tolérance',
  'écart',
  'Écart',
  'reste à vivre',
  'Reste à vivre',
];

export function controlerLExportDEcheances(): string[] {
  const problemes: string[] = [];
  const version = {
    depuis: '2026-01-01', jusqua: null, nature: 'fixe' as const, montantHaut: null,
    periodicite: 'mensuelle' as const, jourAttendu: 5,
    tolerance: { centimes: 200, pourCent: 2, jours: 2 },
  };
  const lignes: LigneBudget[] = [{
    id: 'loyer', libelle: 'Loyer', categorie: 'Logement', sens: 'charge',
    compteId: 'c-compte-courant-00055347', essentielle: true, motifs: ['VIR M DUPONT LOYER'],
    versions: [{ ...version, montant: 78000 }], note: 'IBAN FR76 1234',
    majLe: '2026-01-01T00:00:00.000Z',
  }];
  const occurrences: Occurrence[] = [{
    id: 'loyer:2026-11-05', ligneId: 'loyer', jour: '2026-11-05', montant: 78000,
    signe: -1, du: '2026-11-03', au: '2026-11-07', tolerance: 200,
  }];
  const options: OptionsExport = {
    depuis: '2026-01-01', jusqua: '2027-01-01', ressourcesComprises: true,
  };
  const fichier = echeancesEnIcs(lignes, occurrences, options, new Date('2026-10-15T10:00:00Z'));

  /*
     Ce que la ligne porte et que le fichier ne doit pas porter : le compte,
     le motif d'appariement, et une note de budget où traîne un IBAN. Aucun
     des trois n'est utile dans un agenda, et les trois quitteraient
     l'appareil.
  */
  for (const fuite of ['00055347', 'FR76', 'VIR M DUPONT LOYER']) {
    if (fichier.includes(fuite)) {
      problemes.push(
        `Le fichier d’échéances porte « ${fuite} ». Un .ics part dans un agenda synchronisé ` +
          'chez un tiers : il ne contient que ce qu’il faut pour reconnaître l’échéance.',
      );
    }
  }
  for (const mot of INTERDITS_DANS_LICS) {
    if (fichier.includes(mot)) {
      problemes.push(`Le fichier d’échéances porte le mot « ${mot} », qui n’a rien à y faire.`);
    }
  }
  if (!fichier.includes('DTSTART;VALUE=DATE:20261105')) {
    problemes.push('Une échéance n’est pas exportée en journée entière.');
  }
  if (!fichier.includes(`UID:${PREFIXE_UID}-loyer:2026-11-05@cyclades`)) {
    problemes.push(
      'L’UID d’une échéance ne se dérive pas de son occurrence : un réexport empilerait ' +
        'douze loyers au lieu d’en mettre à jour un.',
    );
  }
  if (!fichier.endsWith('\r\n')) {
    problemes.push('Un fichier .ics sans CRLF final est refusé par certains agendas.');
  }
  return problemes;
}
