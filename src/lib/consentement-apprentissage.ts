/**
 * Le consentement à l'apprentissage étendu, lu et écrit — anomalie A-13.
 *
 * ## Pourquoi le journal d'opérations, et pas un champ de profil
 *
 * Un champ de profil se résout par « dernier écrivain gagne ». Appliqué à
 * un consentement, cela produit la panne que `consentement-etat.ts`
 * décrit : une révocation faite sur un appareil est effacée par l'accord
 * qu'un autre, resté hors ligne, réécrit plus tard.
 *
 * Le journal d'opérations, lui, est **ajout seul** et répliqué. Les gestes
 * y restent tous, et c'est la règle d'absorption qui conclut — pas l'ordre
 * d'arrivée des paquets. Le consentement a besoin de son histoire, pas de
 * son dernier état.
 *
 * ## Ce module ne décide rien
 *
 * Il lit le journal, passe les entrées à `resoudreConsentement`, et écrit
 * ce que `accorder` ou `revoquer` lui rendent. La règle vit dans le module
 * pur, où elle s'éprouve sans base.
 */
import { db, lireAppareil, toutesLesOperations } from './db';
import { operation, SANS_LOT, type Operation } from './noyau/operations';
import { ulid } from './noyau/ulid';
import { decoderHlc } from './noyau/hlc';
import { prochaineHlc } from './sync/horloge-locale';
import { signalerEcriture } from './sync/signal-ecriture';
import {
  CONSENTEMENT_VIERGE,
  accorder,
  resoudreConsentement,
  revoquer,
  type EntreeDeConsentement,
  type EtatDuConsentement,
} from './odyssee/consentement-etat';

/** Le type d'opération. Une seule cible : ce consentement n'a qu'un objet. */
export const TYPE_CONSENTEMENT = 'consentement.apprentissage-etendu';
const CIBLE = 'consentement:apprentissage-etendu';

/** Les entrées, telles que le journal les porte. */
function entreesDe(operations: readonly Operation[]): EntreeDeConsentement[] {
  const entrees: EntreeDeConsentement[] = [];
  for (const op of operations) {
    if (op.type !== TYPE_CONSENTEMENT) continue;
    const charge = op.charge as Partial<EntreeDeConsentement> | undefined;
    if (charge?.type !== 'accord' && charge?.type !== 'revocation') continue;
    if (typeof charge.le !== 'string' || !charge.le) continue;
    entrees.push({
      type: charge.type,
      le: charge.le,
      ...(typeof charge.remplace === 'string' ? { remplace: charge.remplace } : {}),
    });
  }
  return entrees;
}

/** L'état du consentement sur cet appareil, histoire comprise. */
export async function consentementLocal(): Promise<EtatDuConsentement> {
  try {
    return resoudreConsentement(entreesDe(await toutesLesOperations()));
  } catch {
    /*
       Une lecture impossible n'accorde rien. C'est le seul repli acceptable :
       un consentement qu'on suppose en cas de panne n'en est pas un.
    */
    return CONSENTEMENT_VIERGE;
  }
}

async function journaliser(entree: EntreeDeConsentement): Promise<void> {
  const op = operation({
    id: ulid(),
    appareil: await lireAppareil(),
    hlc: decoderHlc(await prochaineHlc()),
    type: TYPE_CONSENTEMENT,
    cible: CIBLE,
    lot: SANS_LOT,
    charge: entree,
  });
  await (await db()).put('operations', op);
  signalerEcriture();
}

/**
 * Accorder, en nommant la révocation que l'on lève s'il y en a une.
 *
 * L'état est **relu ici**, et non passé par l'appelant : un écran qui
 * garderait un état périmé écrirait un accord qui ne lèverait rien, et la
 * personne croirait avoir réautorisé.
 */
export async function accorderLApprentissage(le = new Date()): Promise<EtatDuConsentement> {
  await journaliser(accorder(await consentementLocal(), le.toISOString()));
  return consentementLocal();
}

/** Révoquer. L'entrée ne nomme rien : elle absorbe. */
export async function revoquerLApprentissage(le = new Date()): Promise<EtatDuConsentement> {
  await journaliser(revoquer(le.toISOString()));
  return consentementLocal();
}
