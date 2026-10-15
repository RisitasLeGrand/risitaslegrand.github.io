/**
 * La boîte aux lettres : déposer sans clé, relever avec — A-6, option D.
 *
 * ## Le problème que cela résout, et pourquoi le scellement ne suffisait pas
 *
 * Un geste fait **coffre fermé** doit être gardé pour être rejoué à
 * l'ouverture. Le magasin créé pour cela en phase 2 était scellé sous la clé
 * du coffre : écrire y exigeait donc le coffre ouvert, c'est-à-dire
 * exactement la condition qu'il devait contourner. Le desceller aurait laissé
 * la file lisible, ce que le scellement par branche a pour objet d'empêcher.
 *
 * La sortie est asymétrique, et elle est du Pilote. **Une paire de clés
 * engendrée à l'ouverture du coffre : la publique reste en clair, la privée
 * est scellée sous la clé du coffre.** Écrire ne demande que la publique,
 * donc rien ; lire demande la privée, donc le coffre. Une boîte aux lettres :
 * la fente est ouverte à tous, la porte ne s'ouvre qu'avec la clé.
 *
 * ## ECDH plutôt que RSA-OAEP, et pourquoi
 *
 * Les deux étaient proposés. ECDH P-256 avec AES-GCM est retenu pour deux
 * raisons mesurables, non par goût :
 *
 * - **RSA-OAEP plafonne la taille du message** — environ 190 octets pour une
 *   clé de 2048 bits. Un report tient probablement dedans aujourd'hui, et
 *   cesserait d'y tenir le jour où on lui ajoute un champ. Un format qui
 *   casse à l'ajout d'un champ est un piège posé pour plus tard ;
 * - la paire ECDH est **engendrée en quelques millisecondes**, là où une
 *   paire RSA de 2048 bits prend parfois plusieurs centaines. Cette paire est
 *   engendrée **à chaque ouverture du coffre** : le coût se paierait à chaque
 *   déverrouillage.
 *
 * Le schéma est celui d'ECIES : une paire **éphémère** par pli, un accord
 * ECDH entre sa privée et la publique de la boîte, une clé AES-GCM dérivée
 * par HKDF, et la publique éphémère jointe en clair au pli. Elle ne révèle
 * rien : c'est un point de courbe tiré au hasard, sans lien avec le contenu.
 *
 * ## Ce qui reste visible, et c'est à dire plutôt qu'à taire
 *
 * Le pli ne cache ni **qu'il existe**, ni **sa taille**. Quiconque lit le
 * magasin voit qu'un report attend. Il ne voit ni la tâche, ni la branche,
 * ni le jour, ni l'heure. Pour que la taille elle-même ne trahisse rien, le
 * contenu est **rembourré** à un multiple fixe avant chiffrement : deux
 * reports de longueurs différentes rendent des plis de même taille.
 */

/** La version du format, écrite dans chaque pli. Un pli d'une version inconnue n'est pas deviné. */
export const VERSION_PLI = 1;

/** Le rembourrage, en octets. Toute charge est portée au multiple supérieur. */
export const PALIER_DE_REMBOURRAGE = 256;

export interface Pli {
  /** Version du format. Un pli d'une autre version est refusé, jamais interprété. */
  v: number;
  /** La clé publique éphémère de ce pli, en base64. Ne révèle rien. */
  epk: string;
  /** Le vecteur d'initialisation AES-GCM, en base64. */
  iv: string;
  /** La charge chiffrée, en base64. */
  charge: string;
}

export interface PaireDeBoite {
  publique: CryptoKey;
  privee: CryptoKey;
}

const COURBE = { name: 'ECDH', namedCurve: 'P-256' } as const;
const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

const enB64 = (octets: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(octets)));

/*
   `Uint8Array<ArrayBuffer>` et non `Uint8Array` : depuis que le type est
   générique sur son tampon, WebCrypto n'accepte que la forme adossée à un
   `ArrayBuffer`. Sans l'annotation, TypeScript rend la forme large et refuse
   l'appel — une erreur de typage qui cache une vraie distinction.
*/
const deB64 = (texte: string): Uint8Array<ArrayBuffer> => {
  const brut = atob(texte);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
};

/**
 * Engendre la paire de la boîte.
 *
 * La privée est **extractible**, et il le faut : elle doit pouvoir être
 * exportée pour être scellée sous la clé du coffre. C'est une différence
 * assumée avec la clé d'encapsulation du coffre, non extractible — ici, ce
 * qui protège la privée n'est pas son inextractibilité mais le scellement
 * qui l'entoure.
 */
export async function engendrerLaPaire(): Promise<PaireDeBoite> {
  const paire = await crypto.subtle.generateKey(COURBE, true, ['deriveKey']);
  return { publique: paire.publicKey, privee: paire.privateKey };
}

/** Exporte la publique pour la garder en clair, et la privée pour la sceller. */
export const exporterLaPublique = async (cle: CryptoKey): Promise<string> =>
  enB64(await crypto.subtle.exportKey('spki', cle));

export const exporterLaPrivee = async (cle: CryptoKey): Promise<string> =>
  enB64(await crypto.subtle.exportKey('pkcs8', cle));

export const importerLaPublique = (brut: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('spki', deB64(brut), COURBE, true, []);

export const importerLaPrivee = (brut: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('pkcs8', deB64(brut), COURBE, true, ['deriveKey']);

/** La clé AES d'un pli, dérivée de l'accord entre une privée et une publique. */
const cleDuPli = (privee: CryptoKey, publique: CryptoKey): Promise<CryptoKey> =>
  crypto.subtle.deriveKey(
    { name: 'ECDH', public: publique },
    privee,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

/**
 * Rembourre une charge pour que sa longueur ne dise rien.
 *
 * Le format est `<longueur sur 4 octets><contenu><zéros>`. Sans la longueur,
 * on ne saurait pas où s'arrête le contenu ; avec elle, le rembourrage est
 * réversible sans ambiguïté, y compris si le contenu finit par un zéro.
 */
function rembourrer(texte: string): Uint8Array<ArrayBuffer> {
  const brut = encodeur.encode(texte);
  const total = Math.ceil((brut.length + 4) / PALIER_DE_REMBOURRAGE) * PALIER_DE_REMBOURRAGE;
  const sortie = new Uint8Array(new ArrayBuffer(total));
  new DataView(sortie.buffer).setUint32(0, brut.length);
  sortie.set(brut, 4);
  return sortie;
}

function deRembourrer(octets: Uint8Array): string {
  const longueur = new DataView(octets.buffer, octets.byteOffset).getUint32(0);
  if (longueur > octets.length - 4) throw new Error('Pli corrompu : longueur hors limites.');
  return decodeur.decode(octets.subarray(4, 4 + longueur));
}

/**
 * Dépose un objet dans la boîte. **N'exige pas le coffre.**
 *
 * L'objet entier est chiffré — tâche, branche, jour, instant compris. Rien
 * n'en sort en clair, pas même un identifiant : c'est l'appelant qui doit
 * donner au pli une clé de rangement opaque.
 */
export async function deposer(
  publique: CryptoKey,
  objet: Record<string, unknown>,
): Promise<Pli> {
  const ephemere = await crypto.subtle.generateKey(COURBE, true, ['deriveKey']);
  const cle = await cleDuPli(ephemere.privateKey, publique);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const charge = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cle,
    rembourrer(JSON.stringify(objet)),
  );
  return {
    v: VERSION_PLI,
    epk: await exporterLaPublique(ephemere.publicKey),
    iv: enB64(iv.buffer),
    charge: enB64(charge),
  };
}

/**
 * Relève un pli. **Exige la privée, donc le coffre.**
 *
 * Lève sur une version inconnue plutôt que de tenter une lecture : un pli
 * d'un format futur mal interprété rendrait un objet faux, ce qui est pire
 * qu'un refus.
 */
export async function relever<T = Record<string, unknown>>(
  privee: CryptoKey,
  pli: Pli,
): Promise<T> {
  if (pli.v !== VERSION_PLI) {
    throw new Error(`Pli de version ${pli.v}, inconnue de cette installation.`);
  }
  const cle = await cleDuPli(privee, await importerLaPublique(pli.epk));
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: deB64(pli.iv) },
    cle,
    deB64(pli.charge),
  );
  return JSON.parse(deRembourrer(new Uint8Array(clair))) as T;
}

/**
 * Une clé de rangement opaque, sans lien avec ce qu'elle range.
 *
 * L'identifiant déterministe `tâche/jour` du reste du lot est ici
 * **interdit** : il dirait tout avant même qu'on déchiffre. On perd la
 * convergence de fusion sur ce magasin — deux appareils pointant la même
 * occurrence hors ligne déposeront deux plis — et c'est au report de
 * retrouver l'idempotence, la clé métier réapparaissant une fois relevée.
 */
export const cleOpaque = (): string => enB64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))).buffer).replace(/[+/=]/g, '');
