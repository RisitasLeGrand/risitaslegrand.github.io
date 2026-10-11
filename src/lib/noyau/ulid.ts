/**
 * Identifiants d'opération : des ULID, et pourquoi pas des UUID.
 *
 * Un UUID v4 est aléatoire d'un bout à l'autre. Il identifie, et c'est tout.
 * Un ULID porte sur ses 48 premiers bits l'instant de sa création, en base 32,
 * de sorte que **l'ordre lexicographique des identifiants est l'ordre
 * chronologique**. Pour un journal d'opérations, c'est la différence entre
 * parcourir les opérations d'une période avec un simple intervalle de clés et
 * devoir tenir un index secondaire sur la date — et le journal de révisions
 * compte à lui seul de l'ordre de 60 000 entrées sur cinq ans.
 *
 * ## La monotonie, qui est tout le soin de ce module
 *
 * Deux opérations créées dans la même milliseconde — ce qui arrive dès qu'une
 * séance enregistre une rafale de révisions — tireraient deux aléas sans
 * relation d'ordre. L'ordre des identifiants cesserait alors d'être l'ordre de
 * création, et c'est exactement la propriété pour laquelle on les a choisis.
 *
 * La règle, celle de la spécification : à l'intérieur d'une même milliseconde,
 * on **incrémente l'aléa précédent** au lieu d'en tirer un nouveau. L'ordre est
 * conservé, et le débordement — 2^80 identifiants dans la même milliseconde —
 * n'arrivera pas ; s'il arrivait, on attend la milliseconde suivante plutôt que
 * de rendre un identifiant qui romprait l'ordre.
 *
 * ## L'horloge peut reculer
 *
 * Un changement d'heure système, une synchronisation NTP : `Date.now()` n'est
 * pas monotone. Si l'instant rendu est antérieur au dernier vu, on garde le
 * dernier et on incrémente l'aléa. Un identifiant légèrement en avance sur
 * l'horloge murale est sans conséquence ; un identifiant qui précède un
 * identifiant plus ancien casserait le journal.
 */

/** Alphabet de Crockford : ni I, ni L, ni O, ni U — pas de confusion à l'œil. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TAILLE_TEMPS = 10;
const TAILLE_ALEA = 16;
export const TAILLE_ULID = TAILLE_TEMPS + TAILLE_ALEA;

/** 2^48 − 1 : au-delà, l'instant ne tient plus sur dix signes. */
const INSTANT_MAX = 281474976710655;

function encoderTemps(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0 || ms > INSTANT_MAX) {
    throw new RangeError(`Instant hors des bornes d’un ULID : ${ms}`);
  }
  let reste = Math.floor(ms);
  let sortie = '';
  for (let i = 0; i < TAILLE_TEMPS; i += 1) {
    sortie = ALPHABET[reste % 32] + sortie;
    reste = Math.floor(reste / 32);
  }
  return sortie;
}

/** L'aléa, en 16 signes, tiré sur 10 octets de hasard cryptographique. */
function aleaNeuf(): number[] {
  const octets = new Uint8Array(10);
  crypto.getRandomValues(octets);
  // Dix octets donnent 80 bits, soit exactement 16 signes de 5 bits. On
  // travaille sur le tableau de chiffres base-32 plutôt que sur un entier :
  // 2^80 ne tient pas dans un « number », et un BigInt par identifiant
  // coûterait cher sur un journal de dizaines de milliers d'entrées.
  const chiffres: number[] = [];
  let accumulateur = 0;
  let bits = 0;
  for (const octet of octets) {
    accumulateur = (accumulateur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      chiffres.push((accumulateur >> bits) & 31);
      accumulateur &= (1 << bits) - 1;
    }
  }
  return chiffres;
}

/** Incrémente le tableau de chiffres ; rend faux en cas de débordement. */
function incrementer(chiffres: number[]): boolean {
  for (let i = chiffres.length - 1; i >= 0; i -= 1) {
    if (chiffres[i] < 31) {
      chiffres[i] += 1;
      return true;
    }
    chiffres[i] = 0;
  }
  return false;
}

export interface Fabrique {
  (): string;
  /** L'instant du dernier identifiant rendu, pour les essais. */
  dernierInstant(): number;
}

/**
 * Une fabrique d'ULID monotone.
 *
 * L'horloge est injectable pour que les essais puissent la figer, la faire
 * reculer et vérifier que l'ordre tient — ce qu'on ne saurait pas faire avec
 * `Date.now()` en dur.
 */
export function fabriqueUlid(horloge: () => number = Date.now): Fabrique {
  let dernier = -1;
  let chiffres = aleaNeuf();

  const rendre = (): string => {
    const maintenant = horloge();
    if (maintenant > dernier) {
      dernier = maintenant;
      chiffres = aleaNeuf();
    } else if (!incrementer(chiffres)) {
      // 2^80 identifiants dans la même milliseconde. Inatteignable, mais on
      // attend plutôt que de rendre un identifiant hors d'ordre.
      dernier += 1;
      chiffres = aleaNeuf();
    }
    return encoderTemps(dernier) + chiffres.map((c) => ALPHABET[c]).join('');
  };
  rendre.dernierInstant = () => dernier;
  return rendre as Fabrique;
}

const fabriqueParDefaut = fabriqueUlid();

/** Un ULID, monotone au sein du processus. */
export const ulid = (): string => fabriqueParDefaut();

/** L'instant porté par un ULID, en millisecondes depuis l'époque. */
export function instantDeUlid(id: string): number {
  if (!estUlid(id)) throw new TypeError(`Ce n’est pas un ULID : ${id}`);
  let ms = 0;
  for (let i = 0; i < TAILLE_TEMPS; i += 1) ms = ms * 32 + ALPHABET.indexOf(id[i]);
  return ms;
}

const MOTIF = new RegExp(`^[${ALPHABET}]{${TAILLE_ULID}}$`);

export const estUlid = (valeur: unknown): valeur is string =>
  typeof valeur === 'string' && MOTIF.test(valeur);
