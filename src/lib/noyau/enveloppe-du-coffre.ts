/**
 * La clé de données du coffre, et l'enveloppe qui la protège.
 *
 * ## Le défaut que ce module corrige
 *
 * Jusqu'ici, la clé du coffre était **dérivée du mot de passe du site**, et
 * vérifiée par une empreinte SHA-256 **sans sel** embarquée dans le paquet
 * livré (`site.config.mjs`). Trois conséquences, toutes lues dans le code
 * avant d'écrire une ligne ici :
 *
 * 1. Qui tient le paquet publié tient l'empreinte. Une empreinte SHA-256 sans
 *    sel se teste par dizaines de milliards par seconde sur une carte
 *    graphique ordinaire : pour un mot de passe court, c'est **instantané**.
 *    Les 310 000 itérations de PBKDF2 n'y changeaient rien, puisque
 *    l'attaquant ne passait plus par elles.
 * 2. Le coffre n'avait **pas d'autre vérification que cette empreinte**. La
 *    retirer aurait fait accepter n'importe quel mot de passe et dériver une
 *    clé fausse — « un coffre qui accepte n'importe quelle clé fabrique des
 *    données perdues », dit son propre commentaire.
 * 3. Le coffre s'ouvrait donc avec le **mot de passe du site**, celui qu'on
 *    tape plusieurs fois par jour et qu'on confie à son navigateur.
 *
 * ## Ce que ce module met à la place
 *
 * Deux clés, et non plus une.
 *
 * - La **clé de données** chiffre les enregistrements. Elle est tirée au sort,
 *   jamais dérivée d'un mot de passe, et ne quitte la mémoire que sous
 *   enveloppe.
 * - La **clé d'enveloppe** est dérivée du mot de passe **du coffre**, distinct
 *   de celui du site, à 600 000 itérations. Elle ne sert qu'à encapsuler la
 *   première.
 *
 * Deux propriétés en découlent, et ce sont elles qui justifient le détour :
 *
 * - **Changer le mot de passe ne touche à aucune donnée.** On réencapsule la
 *   clé de données, c'est tout. L'ancien schéma aurait exigé de tout
 *   rechiffrer, c'est-à-dire d'exposer des années de journal à une migration
 *   à chaque changement.
 * - **L'enveloppe est le témoin.** Un mot de passe faux ne produit pas une
 *   clé fausse : il produit un échec d'authentification d'AES-KW, et
 *   `unwrapKey` rejette. Aucune empreinte n'est publiée, et il n'y a pas de
 *   second témoin à tenir synchronisé avec la vraie clé — un témoin séparé
 *   peut diverger, l'enveloppe non : elle **est** ce qu'on cherche à ouvrir.
 *
 * ## AES-KW, et pas AES-GCM
 *
 * Même raison qu'à `coffre-cles.ts` : encapsuler une clé est précisément ce
 * pour quoi AES-KW existe. Il n'a pas de vecteur d'initialisation à tirer, à
 * ranger et à ne jamais réutiliser — trois occasions d'erreur en moins.
 *
 * ## Ce que ce module ne protège pas
 *
 * Il ne protège pas contre un script qui s'exécute dans la page pendant que le
 * coffre est ouvert : la clé de données est alors en mémoire, utilisable sans
 * être lisible. C'est la même limite qu'avant, et la dire ici évite de croire
 * qu'elle a disparu.
 */
import type { RangementDeLaBoite } from './boite-du-coffre';

/**
 * Le même port que la boîte aux lettres, et volontairement le même.
 *
 * Sa raison d'être vaut mot pour mot ici : « un module de clés testé seulement
 * à travers IndexedDB serait testé une fois, dans un navigateur, et jamais sur
 * le cas qui compte — le mot de passe changé ». En déclarer un second,
 * identique, obligerait `coffre.ts` à tenir deux câblages au lieu d'un, et le
 * jour où ils divergeraient, l'un des deux écrirait ailleurs sans le dire.
 */
export type RangementDesCles = RangementDeLaBoite;

/**
 * Le sel de la clé d'enveloppe. **Distinct** de `coffre.sel`, qui reste en
 * place pour relire l'ancien chiffrement pendant la migration.
 *
 * Deux sels pour deux clés : réutiliser le premier ferait dériver la clé
 * d'enveloppe et l'ancienne clé de données du même couple (sel, itérations)
 * dès lors que les deux mots de passe coïncideraient — et rien n'interdit de
 * choisir le même mot de passe pour les deux.
 */
export const CLEF_SEL_ENVELOPPE = 'coffre.sel-enveloppe';

/** L'enveloppe elle-même : la clé de données encapsulée, en base64. */
export const CLEF_ENVELOPPE = 'coffre.enveloppe';

/**
 * Le nombre d'itérations PBKDF2 de la clé d'enveloppe.
 *
 * 600 000, contre 310 000 pour l'ancienne dérivation. Il est payé **une fois
 * par ouverture** et jamais à la lecture : une fois la clé de données en
 * mémoire, ouvrir un enregistrement coûte un AES-GCM, c'est-à-dire rien.
 *
 * Le coût se mesure, il ne se suppose pas : l'essai le chronomètre.
 */
export const ITERATIONS_ENVELOPPE = 600_000;

const encodeur = new TextEncoder();

const enHexa = (octets: Uint8Array): string =>
  [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');

const depuisHexa = (hexa: string): Uint8Array<ArrayBuffer> => {
  const octets = new Uint8Array(new ArrayBuffer(hexa.length / 2));
  for (let i = 0; i < octets.length; i += 1) {
    octets[i] = Number.parseInt(hexa.slice(i * 2, i * 2 + 2), 16);
  }
  return octets;
};

const enB64 = (octets: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(octets)));

const deB64 = (texte: string): Uint8Array<ArrayBuffer> => {
  const brut = atob(texte);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
};

/**
 * Le sel de l'enveloppe, tiré au sort à la première pose et gardé ensuite.
 *
 * Un sel n'est pas un secret : il sert à ce que deux installations du même mot
 * de passe ne produisent pas la même clé, et à ce que le coût de dérivation ne
 * se mutualise pas entre elles.
 */
async function selDeLEnveloppe(rangement: RangementDesCles): Promise<Uint8Array<ArrayBuffer>> {
  const garde = await rangement.lire(CLEF_SEL_ENVELOPPE);
  if (typeof garde === 'string' && garde.length >= 32) return depuisHexa(garde);
  const neuf = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(neuf);
  await rangement.ecrire(CLEF_SEL_ENVELOPPE, enHexa(neuf));
  return neuf;
}

/**
 * Dérive la clé d'enveloppe depuis le mot de passe du coffre.
 *
 * Non extractible : elle ne sert qu'à encapsuler et à désencapsuler, et
 * `exportKey` échoue dessus. Ce n'est pas une protection contre un attaquant
 * qui exécute du code dans la page — il peut s'en servir sans la lire — mais
 * cela empêche la seule erreur qui comptait, celle de l'écrire quelque part
 * « pour éviter de la redemander ».
 */
async function deriverLEnveloppe(
  rangement: RangementDesCles,
  motDePasse: string,
): Promise<CryptoKey> {
  const materiel = await crypto.subtle.importKey(
    'raw',
    encodeur.encode(motDePasse) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: (await selDeLEnveloppe(rangement)) as BufferSource,
      iterations: ITERATIONS_ENVELOPPE,
      hash: 'SHA-256',
    },
    materiel,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/** L'enveloppe est-elle posée ? Faux tant que la migration n'a pas eu lieu. */
export async function enveloppePosee(rangement: RangementDesCles): Promise<boolean> {
  return typeof (await rangement.lire(CLEF_ENVELOPPE)) === 'string';
}

/**
 * Pose l'enveloppe autour d'une clé de données, neuve ou reprise.
 *
 * `cle` permet à la migration de **reprendre une clé existante** plutôt que
 * d'en tirer une autre. Ce choix lui appartient, pas à ce module : rechiffrer
 * ou non est une décision qui engage les données, et elle se prend là où on
 * voit les données.
 *
 * La clé rendue est extractible, et il faut dire pourquoi puisque le reste du
 * projet tient à l'inverse : `wrapKey` refuse d'encapsuler une clé qui ne
 * l'est pas, et sans cela changer de mot de passe redeviendrait impossible
 * sans tout rechiffrer. Le matériel ne sort pour autant jamais de la page : il
 * passe de `wrapKey` à l'enveloppe, sans détour par une variable.
 */
export async function poserLEnveloppe(
  rangement: RangementDesCles,
  motDePasseDuCoffre: string,
  cle?: CryptoKey,
): Promise<CryptoKey> {
  const donnees =
    cle ??
    (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]));
  const enveloppe = await deriverLEnveloppe(rangement, motDePasseDuCoffre);
  const encapsulee = await crypto.subtle.wrapKey('raw', donnees, enveloppe, 'AES-KW');
  await rangement.ecrire(CLEF_ENVELOPPE, enB64(encapsulee));
  return donnees;
}

/**
 * Ouvre l'enveloppe. Rend `null` si le mot de passe est faux.
 *
 * C'est ici que le témoin agit : AES-KW authentifie, donc un mot de passe faux
 * fait **rejeter** `unwrapKey` au lieu de produire une clé fausse. Le `catch`
 * ne masque pas une panne, il traduit un refus — et c'est la seule chose qu'il
 * doive traduire, raison pour laquelle l'absence d'enveloppe est traitée avant
 * lui, séparément.
 */
export async function ouvrirLEnveloppe(
  rangement: RangementDesCles,
  motDePasseDuCoffre: string,
): Promise<CryptoKey | null> {
  const garde = await rangement.lire(CLEF_ENVELOPPE);
  if (typeof garde !== 'string') return null;
  const enveloppe = await deriverLEnveloppe(rangement, motDePasseDuCoffre);
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      deB64(garde) as BufferSource,
      enveloppe,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

/**
 * Change le mot de passe du coffre. **Aucune donnée n'est touchée.**
 *
 * C'est tout l'intérêt des deux clés : la clé de données ne change pas, seule
 * son enveloppe est refaite. Un changement de mot de passe cesse donc d'être
 * une migration — et donc d'être une occasion de perdre quelque chose.
 *
 * Le sel est renouvelé en même temps : le garder laisserait deux enveloppes
 * dérivées du même sel, dont une ancienne qu'une sauvegarde peut encore
 * porter.
 *
 * L'ordre compte. On ouvre d'abord, on n'efface le sel qu'ensuite : effacer
 * avant rendrait l'ancienne enveloppe inouvrable si la suite échouait, et la
 * clé de données serait perdue — exactement ce que ce module existe pour
 * empêcher.
 */
export async function changerLeMotDePasseDuCoffre(
  rangement: RangementDesCles,
  ancien: string,
  nouveau: string,
): Promise<boolean> {
  const donnees = await ouvrirLEnveloppe(rangement, ancien);
  if (!donnees) return false;
  await rangement.effacer(CLEF_SEL_ENVELOPPE);
  await poserLEnveloppe(rangement, nouveau, donnees);
  return true;
}
