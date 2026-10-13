/**
 * L'adaptation, côté base : proposer, répondre, et tout défaire.
 *
 * `noyau/adaptation.ts` tient les règles et le plafond hebdomadaire ;
 * `noyau/reglages.ts` tient les réglages déduits et leurs causes. Ce module leur
 * donne la base, l'horloge logique et les faits publiés.
 */
import { db, lireAppareil, toutesLesOperations } from './db';
import { signalerEcriture } from './sync/signal-ecriture';
import { prochaineHlc } from './sync/horloge-locale';
import { decoderHlc } from './noyau/hlc';
import { operation, SANS_LOT } from './noyau/operations';
import { ulid } from './noyau/ulid';
import { jourLogique } from './noyau/jour-logique';
import { lireProfil } from './noyau/profil';
import {
  TYPE_DECISION,
  cibleDeLaRegle,
  lireDecisions,
  proposer,
  reinitialisation,
  type Choix,
  type ChargeDecision,
  type Decision,
  type Issue,
  type Proposition,
} from './noyau/adaptation';
import { lectureDe, reglagesDeduits, reglagesJourLogique, type Reglage } from './noyau/reglages';
import { ecrireChamp, supprimerChamp } from './profil';
import { observerUsage } from './initialisation';

async function journaliser(cible: string, type: string, charge: unknown) {
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

/* ══════════════════════════════════════════════════════════════════════════
   Les réglages déduits
   ══════════════════════════════════════════════════════════════════════════ */

export async function reglagesLocaux(): Promise<Reglage[]> {
  return reglagesDeduits(lectureDe(lireProfil(await toutesLesOperations())));
}

/**
 * Les réglages du jour logique tels que le profil les pose.
 *
 * C'est le réglage déduit le plus lourd de conséquences : il décide de la date
 * à laquelle une séance compte, donc des séries, donc des indicateurs. Faute de
 * réponse, il reste à 4 h — le défaut de `jour-logique.ts`, inchangé.
 */
export async function reglagesJourLogiqueLocaux(): Promise<{ heureBascule: number; fuseau: string }> {
  return reglagesJourLogique(lectureDe(lireProfil(await toutesLesOperations())));
}

/* ══════════════════════════════════════════════════════════════════════════
   La proposition du jour
   ══════════════════════════════════════════════════════════════════════════ */

export async function decisionsLocales(): Promise<Map<string, Decision>> {
  return lireDecisions(await toutesLesOperations());
}

/**
 * La proposition du jour, ou le silence et sa raison.
 *
 * Elle publie les faits pour observer l'usage, ce qui n'est pas gratuit : les
 * écrans l'appellent **après** avoir fini de s'afficher, jamais avant. Une
 * proposition qui retarderait l'ouverture d'une page serait bloquante par
 * accident, ce que A.8 interdit par principe.
 */
export async function propositionLocale(): Promise<Choix> {
  const operations = await toutesLesOperations();
  const profil = lireProfil(operations);
  const lire = lectureDe(profil);
  const { observation } = await observerUsage();
  return proposer({
    observation,
    lire,
    jour: jourLogique(new Date(), reglagesJourLogique(lire)),
    decisions: lireDecisions(operations),
  });
}

async function decider(regle: string, issue: Issue, valeurProposee?: unknown): Promise<void> {
  await journaliser(cibleDeLaRegle(regle), TYPE_DECISION, {
    issue,
    le: new Date().toISOString(),
    ...(valeurProposee !== undefined ? { valeurProposee } : {}),
  } satisfies ChargeDecision);
}

/**
 * Accepter : le champ est réécrit, et la décision journalisée.
 *
 * La valeur est écrite `confirme` et non `declare` : elle vient d'une
 * observation que la personne a validée, et c'est exactement le troisième état
 * d'A.3. L'écrire « déclarée » ferait disparaître, dans six mois, la seule
 * information utile si le réglage se révèle faux.
 *
 * L'ordre compte : le champ d'abord, la décision ensuite. Si l'écriture du champ
 * échoue, aucune décision ne prétend qu'elle a eu lieu.
 */
export async function accepter(proposition: Proposition): Promise<void> {
  await ecrireChamp(proposition.champ, proposition.valeurProposee, { source: 'confirme' });
  await decider(proposition.regle, 'acceptee', proposition.valeurProposee);
}

/** Reporter : la proposition reviendra après le délai de report. */
export async function reporterProposition(proposition: Proposition): Promise<void> {
  await decider(proposition.regle, 'reportee', proposition.valeurProposee);
}

/** Refuser : la règle ne reviendra jamais. */
export async function refuser(proposition: Proposition): Promise<void> {
  await decider(proposition.regle, 'refusee', proposition.valeurProposee);
}

/* ══════════════════════════════════════════════════════════════════════════
   « Réinitialiser l'adaptation »
   ══════════════════════════════════════════════════════════════════════════ */

export interface Remise {
  /** Les champs remis à leur valeur déclarée. */
  retablis: { champ: string; valeur: unknown }[];
  /** Les champs supprimés, faute d'avoir eu une valeur avant l'adaptation. */
  supprimes: string[];
}

/**
 * Remet tous les réglages adaptatifs à leur valeur déclarée.
 *
 * Et non à leur valeur par défaut : la déclaration est retrouvée dans le
 * journal, version par version. Les règles acceptées redeviennent proposables —
 * ce qui est voulu : si l'écart est toujours là, la question est toujours
 * bonne. Un refus, lui, n'est pas défait par cette remise : refuser n'est pas
 * une adaptation, c'est son contraire.
 */
export async function reinitialiserAdaptation(): Promise<Remise> {
  const retours = reinitialisation(await toutesLesOperations());
  const remise: Remise = { retablis: [], supprimes: [] };
  for (const retour of retours) {
    if (retour.supprimer) {
      await supprimerChamp(retour.champ);
      remise.supprimes.push(retour.champ);
    } else {
      await ecrireChamp(retour.champ, retour.valeur, { source: retour.source ?? 'declare' });
      remise.retablis.push({ champ: retour.champ, valeur: retour.valeur });
    }
    await decider(retour.regle, 'remise');
  }
  return remise;
}
