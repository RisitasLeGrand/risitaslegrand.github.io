/**
 * L'horloge logique de cet appareil, persistée entre deux ouvertures.
 *
 * `noyau/hlc.ts` tient l'algorithme et ne touche à rien ; ce module lui donne
 * sa mémoire. La distinction compte : l'algorithme est éprouvé par 13 essais
 * sans navigateur, et ce qui est ici — lecture, écriture, concurrence — est
 * exactement ce qu'un essai pur ne saurait pas couvrir.
 *
 * ## Pourquoi une file d'attente
 *
 * Deux émissions concurrentes qui liraient l'état avant que l'autre ne l'ait
 * écrit obtiendraient **la même horloge**. Deux opérations porteraient alors le
 * même instant logique et le même appareil, et ne seraient plus départagées que
 * par leur identifiant — ce qui marche, mais perd l'ordre de causalité qui est
 * toute la raison d'avoir une horloge logique. Or une séance enregistre des
 * rafales de révisions, souvent sans attendre : le cas est la règle, pas
 * l'exception.
 *
 * Les appels sont donc enchaînés sur une promesse unique. C'est une file, pas
 * un verrou : rien ne peut rester bloqué, et l'ordre d'arrivée est l'ordre
 * d'émission.
 */
import { db } from '../db';
import {
  decoderHlc,
  encoderHlc,
  HLC_ZERO,
  Horloge,
  type Hlc,
} from '../noyau/hlc';

const CLEF = 'horloge';

let horloge: Horloge | null = null;
/** La file : chaque appel attend le précédent. */
let file: Promise<unknown> = Promise.resolve();

async function charger(): Promise<Horloge> {
  if (horloge) return horloge;
  const base = await db();
  const stocke = (await base.get('etat', CLEF)) as Hlc | undefined;
  horloge = new Horloge(Date.now, stocke ?? HLC_ZERO);
  return horloge;
}

async function persister(valeur: Hlc): Promise<void> {
  await (await db()).put('etat', valeur, CLEF);
}

/** Enchaîne une opération sur la file, et rend son résultat. */
function enFile<T>(action: () => Promise<T>): Promise<T> {
  const resultat = file.then(action, action);
  // La file ne doit jamais rester rompue : un échec d'écriture ne doit pas
  // empêcher les émissions suivantes, sans quoi une erreur passagère
  // immobiliserait l'horloge pour toute la session.
  file = resultat.then(
    () => undefined,
    () => undefined,
  );
  return resultat;
}

/** La prochaine horloge à poser sur une opération, encodée. */
export function prochaineHlc(): Promise<string> {
  return enFile(async () => {
    const h = await charger();
    const valeur = h.emettre();
    await persister(valeur);
    return encoderHlc(valeur);
  });
}

/**
 * Absorbe l'horloge d'une opération reçue.
 *
 * À appeler pour **chaque** opération d'un paquet, avant d'émettre quoi que ce
 * soit ensuite : c'est ce qui garantit que les prochaines émissions de cet
 * appareil seront postérieures à ce qu'il vient de voir, même si son horloge
 * murale est en retard.
 *
 * Une horloge trop en avance lève — voir `HlcRefusee`. On ne l'absorbe pas : la
 * faute de l'autre appareil se propagerait à tout le journal, sans retour.
 */
export function absorberHlc(recue: string): Promise<void> {
  return enFile(async () => {
    const h = await charger();
    const valeur = h.recevoir(decoderHlc(recue));
    await persister(valeur);
  });
}

/** L'horloge courante, sans l'avancer. Pour afficher, pas pour émettre. */
export function horlogeCourante(): Promise<string> {
  return enFile(async () => encoderHlc((await charger()).valeur));
}

/** Pour les essais : oublie l'horloge chargée, afin de la relire du disque. */
export function oublierHorloge(): void {
  horloge = null;
}
