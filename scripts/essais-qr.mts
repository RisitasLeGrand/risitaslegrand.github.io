/**
 * Les QR : ce qu'on y met en ressort, et à la bonne taille.
 *
 * L'essai ne vérifie pas l'encodeur de la bibliothèque — ce n'est pas mon code
 * — mais ce qui est à moi et peut casser : la trame, le compactage, le rendu, et
 * surtout le fait que les deux bibliothèques se comprennent. Un encodeur juste
 * et un décodeur juste peuvent ne pas se parler : il suffit que le rendu
 * intermédiaire soit faux d'un pixel ou que la zone de silence manque.
 *
 * Le décodeur sert donc d'oracle au rendu. C'est une vérification croisée par
 * deux implémentations indépendantes, et c'est la seule qui vaille ici.
 */
import {
  compacter,
  decompacter,
  decoder,
  encoderCharge,
  enSvg,
  lireCharge,
  matrice,
  PREFIXE,
  type Matrice,
} from '../src/lib/sync/qr';

const encodeur = new TextEncoder();
const enTexte = (octets: Uint8Array) => new TextDecoder().decode(octets);

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ✓ ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  ✗ ${intitule}\n      attendu ${b}\n      obtenu  ${a}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

/**
 * Rend la matrice en image, comme un décodeur la verra.
 *
 * Quatre pixels par module et une zone de silence : moins, et jsQR échoue — ce
 * qui est sa manière de dire qu'un vrai téléphone échouerait aussi.
 */
function enImage(m: Matrice, echelle = 4, silence = 4) {
  const total = (m.cote + silence * 2) * echelle;
  const donnees = new Uint8ClampedArray(total * total * 4).fill(255);
  for (let ligne = 0; ligne < m.cote; ligne += 1) {
    for (let colonne = 0; colonne < m.cote; colonne += 1) {
      if (!m.modules[ligne][colonne]) continue;
      for (let dy = 0; dy < echelle; dy += 1) {
        for (let dx = 0; dx < echelle; dx += 1) {
          const y = (ligne + silence) * echelle + dy;
          const x = (colonne + silence) * echelle + dx;
          const i = (y * total + x) * 4;
          donnees[i] = 0;
          donnees[i + 1] = 0;
          donnees[i + 2] = 0;
        }
      }
    }
  }
  return { donnees, cote: total };
}

const allerRetour = async (contenu: Uint8Array | string, correction: 'L' | 'M' = 'M') => {
  const m = await matrice(contenu, correction);
  const image = enImage(m);
  const lecture = await decoder(image.donnees, image.cote, image.cote);
  return { lecture, version: m.version };
};

console.log('\nAller-retour : ce qui est encodé est relu');

for (const [nom, texte] of [
  ['un texte court', 'CYC1:salon:abc'],
  ['des accents, qui survivent depuis qu’on passe les octets', 'CYC1:salon:Économie — été'],
  ['une URL, comme en lit un appareil photo', 'https://exemple.fr/appareils/#c=AB-cd_1'],
] as [string, string][]) {
  const { lecture } = await allerRetour(texte);
  v(nom, lecture?.texte, texte);
}

{
  /* Les octets arbitraires sont rendus tels quels : c'est ce qui permet à la
     charge de voyager sans base64, donc au QR d'être plus petit. */
  const octets = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) octets[i] = i;
  const { lecture } = await allerRetour(octets);
  v('les 256 valeurs d’octet font l’aller-retour', [...(lecture?.octets ?? [])], [...octets]);
}

console.log('\nUne description de session WebRTC tient dans un QR');

/* Une vraie description, mesurée dans Chromium : c'est la charge que le QR doit
   porter en pratique, et la seule qui prouve quelque chose. */
const SDP = [
  'v=0',
  'o=- 7170037316838541787 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:2570655246 1 udp 2113937151 53d5fcb5-2ac3-4f16-8f9e-b8c6561421c2.local 40859 typ host generation 0 network-cost 999',
  'a=ice-ufrag:oqvX',
  'a=ice-pwd:aGcd9EQfi7waZOb+SBC2uviX',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 47:5B:46:22:A9:0E:9B:1E:BD:2A:AE:91:B4:01:93:FF:97:CC:D9:0E:2D:CC:8C:1D:64:AE:9F:15:BD:50:D5:41',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

const compact = await compacter(SDP);
v('le compactage est réversible', await decompacter(compact), SDP);
vrai(
  `le compactage réduit la description (${SDP.length} → ${compact.length} octets)`,
  compact.length < encodeur.encode(SDP).length,
);

const charge = encoderCharge({ genre: 'offre', donnees: compact });
const { lecture, version } = await allerRetour(charge, 'L');
v('la description passe par le QR sans perte', [...(lecture?.octets ?? [])], [...charge]);
vrai(`et le QR reste visable (version ${version} sur 40, ${17 + 4 * version} modules)`, version <= 15);
const relue = lireCharge(lecture!.octets);
v('la trame est relue', relue?.genre, 'offre');
v('et la charge rendue est celle de départ', await decompacter(relue!.donnees), SDP);

/* Deux candidats de plus — ce qu'ajoute un serveur STUN — et le QR doit encore
   tenir. C'est la marge qu'il faut avoir mesurée avant d'en dépendre. */
const avecStun = SDP.replace(
  'a=ice-ufrag:oqvX',
  [
    'a=candidate:842163049 1 udp 1677729535 86.212.14.3 55342 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999',
    'a=candidate:842163050 1 udp 1677729534 86.212.14.3 55343 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999',
    'a=ice-ufrag:oqvX',
  ].join('\r\n'),
);
const avecStunCompact = encoderCharge({ genre: 'offre', donnees: await compacter(avecStun) });
const resultatStun = await allerRetour(avecStunCompact, 'L');
v(
  'une description avec candidats STUN passe aussi',
  [...(resultatStun.lecture?.octets ?? [])],
  [...avecStunCompact],
);
vrai(`et sa version reste visable (${resultatStun.version})`, resultatStun.version <= 18);

console.log('\nLa trame refuse ce qui n’est pas à elle');

const octetsDe = (texte: string) => encodeur.encode(texte);
v('un texte quelconque', lireCharge(octetsDe('https://exemple.fr')), null);
v('un préfixe voisin', lireCharge(octetsDe('CYC2:offre:abc')), null);
v('un genre inconnu', lireCharge(octetsDe('CYC1:bonjour:abc')), null);
v('une trame tronquée', lireCharge(octetsDe('CYC1:offre')), null);
v('des octets vides', lireCharge(new Uint8Array(0)), null);
v(
  'une charge qui contient le séparateur est recollée',
  enTexte(lireCharge(octetsDe('CYC1:offre:a:b:c'))!.donnees),
  'a:b:c',
);

console.log('\nLe rendu SVG');

const m = await matrice('CYC1:salon:test');
const svg = enSvg(m, { titre: 'Appairage' });
vrai('le fond est explicitement blanc', svg.includes('fill="#ffffff"'));
vrai('les modules sont en un seul chemin', svg.split('<path').length === 2);
vrai('la zone de silence est comprise dans la boîte', svg.includes(`0 0 ${m.cote + 8} ${m.cote + 8}`));
vrai('le titre est accessible', svg.includes('<title>Appairage</title>') && svg.includes('role="img"'));
vrai('le rendu est net', svg.includes('shape-rendering="crispEdges"'));

console.log('\nUn QR illisible ne fait pas tomber la lecture');

const bruit = new Uint8ClampedArray(64 * 64 * 4).fill(255);
v('une image blanche ne décode rien', await decoder(bruit, 64, 64), null);

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
