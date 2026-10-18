#!/usr/bin/env node
/**
 * L'icône de Cyclades, et les fichiers que l'installation réclame.
 *
 * ## Le dessin, et pourquoi celui-là
 *
 * Les Cyclades sont l'archipel qui **encercle Délos**. L'icône est cette
 * figure et rien d'autre : un disque au centre, un anneau ouvert autour. Elle
 * dit aussi le cycle de la révision, ce qui tombe bien, mais ce n'est pas le
 * point de départ — une icône qui illustre une métaphore se dessine toujours
 * moins bien qu'une qui dessine une forme.
 *
 * Trois variantes ont été rendues et regardées côte à côte, à 512 et à 48
 * pixels. C'est la **seconde taille** qui a tranché, parce que c'est celle
 * d'un écran d'accueil de téléphone :
 *
 * - « l'archipel » (sept îles autour de Délos) : juste à 512, brouillon à 48,
 *   les petites îles se confondent ;
 * - « l'orbite » (celle-ci) : lisible aux deux tailles sans rien perdre ;
 * - « la houle » (un relief sur trois vagues) : les vagues fondent en une
 *   tache grise à 48.
 *
 * Les deux écartées sont gardées dans `docs/cyclades/icone/`, avec cette
 * note, pour qu'un choix ultérieur reparte de ce qui a été vu et non de zéro.
 *
 * ## La zone sûre, qui n'est pas une préférence de goût
 *
 * Android rogne une icône `maskable` à la forme qu'il veut — cercle, goutte,
 * carré arrondi — et ne garantit que le **disque central de 80 %**. Tout ce
 * qui compte est donc dessiné à l'intérieur : ici le plus grand rayon utile
 * vaut 0,2875 × la largeur, contre 0,4 autorisé. Ce qui déborde, c'est le
 * fond, et c'est son rôle.
 *
 * Reproduire : « node scripts/icones.mjs ». Les fichiers produits sont
 * commités — un dépôt qui exige une commande pour redevenir publiable est un
 * dépôt qu'on ne peut pas publier depuis un autre ordinateur.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(racine, 'public');
const DOCS = path.join(racine, 'docs', 'cyclades', 'icone');

/** L'indigo du site — le même que `--couleur-accent`, pas un voisin. */
const INDIGO = '#4f46e5';
const BLANC = '#ffffff';

/**
 * L'orbite, à une taille donnée.
 *
 * `proportion` resserre le dessin sans toucher au fond : 1 pour l'icône
 * ordinaire, un peu moins pour la version `maskable`, qui a tout intérêt à
 * garder de la marge sous le rognage le plus agressif.
 */
export function orbite(taille = 512, proportion = 1) {
  const c = taille / 2;
  const r = taille * 0.26 * proportion;
  const epaisseur = taille * 0.055 * proportion;
  const centre = taille * 0.115 * proportion;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" fill="${INDIGO}"/>
  <circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="${BLANC}"
          stroke-width="${epaisseur.toFixed(1)}" stroke-linecap="round"
          stroke-dasharray="${(r * 1.5).toFixed(1)} ${(r * 0.55).toFixed(1)}"
          transform="rotate(-50 ${c} ${c})"/>
  <circle cx="${c}" cy="${c}" r="${centre.toFixed(1)}" fill="${BLANC}"/>
</svg>`;
}

/** L'archipel : sept îles autour de Délos. Écartée, gardée. */
export function archipel(taille = 512) {
  const c = taille / 2;
  const r = taille * 0.255;
  const iles = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
    const rayon = taille * (i % 2 === 0 ? 0.05 : 0.038);
    iles.push(
      `<circle cx="${(c + r * Math.cos(angle)).toFixed(1)}" cy="${(c + r * Math.sin(angle)).toFixed(1)}" r="${rayon.toFixed(1)}" fill="${BLANC}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" fill="${INDIGO}"/>
  <circle cx="${c}" cy="${c}" r="${(taille * 0.105).toFixed(1)}" fill="${BLANC}"/>
  ${iles.join('\n  ')}
</svg>`;
}

/** La houle : un relief sur trois vagues. Écartée, gardée. */
export function houle(taille = 512) {
  const c = taille / 2;
  const u = taille / 512;
  const vagues = [0, 1, 2]
    .map((i) => {
      const y = c + 58 * u + i * 46 * u;
      const amp = 16 * u;
      const demi = 150 * u - i * 10 * u;
      return `<path d="M ${c - demi} ${y} q ${demi / 2} ${-amp} ${demi} 0 q ${demi / 2} ${amp} ${demi} 0" fill="none" stroke="${BLANC}" stroke-width="${(20 * u).toFixed(1)}" stroke-linecap="round" opacity="${(1 - i * 0.22).toFixed(2)}"/>`;
    })
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" fill="#3730a3"/>
  <path d="M ${c - 130 * u} ${c + 30 * u} L ${c - 20 * u} ${c - 130 * u} L ${c + 50 * u} ${c - 30 * u} L ${c + 95 * u} ${c - 80 * u} L ${c + 150 * u} ${c + 30 * u} Z" fill="${BLANC}"/>
  ${vagues}
</svg>`;
}

const png = (svg, taille, chemin) =>
  sharp(Buffer.from(svg)).resize(taille, taille).png({ compressionLevel: 9 }).toFile(chemin);

if (process.argv[1] && process.argv[1].endsWith('icones.mjs')) {
  mkdirSync(DOCS, { recursive: true });

  /*
     Le favicon reste en SVG : il se redimensionne sans perte, et un onglet de
     navigateur l'affiche aussi bien à 16 qu'à 32 pixels.
  */
  writeFileSync(path.join(PUBLIC, 'favicon.svg'), `${orbite(32)}\n`);

  await png(orbite(512), 192, path.join(PUBLIC, 'icone-192.png'));
  await png(orbite(512), 512, path.join(PUBLIC, 'icone-512.png'));
  await png(orbite(512, 0.82), 512, path.join(PUBLIC, 'icone-maskable-512.png'));
  /*
     iOS ne lit pas le manifeste pour l'icône de l'écran d'accueil : il prend
     `apple-touch-icon`, et il n'aime ni la transparence ni les coins qu'il
     arrondit lui-même. 180 px est la taille qu'il réclame.
  */
  await png(orbite(512), 180, path.join(PUBLIC, 'apple-touch-icon.png'));

  for (const [nom, dessin] of [
    ['archipel', archipel],
    ['houle', houle],
  ]) {
    writeFileSync(path.join(DOCS, `${nom}.svg`), `${dessin(512)}\n`);
    await png(dessin(512), 256, path.join(DOCS, `${nom}-256.png`));
  }
  writeFileSync(path.join(DOCS, 'orbite.svg'), `${orbite(512)}\n`);
  await png(orbite(512), 256, path.join(DOCS, 'orbite-256.png'));

  /*
     La planche de comparaison, et c'est elle qui porte l'argument : chaque
     variante en grand ET en petit, le petit agrandi au plus proche voisin
     pour qu'on voie ce que l'écran d'accueil en fera. Regarder trois icônes
     à 512 pixels ne dit rien du choix ; les regarder à 48 le dit en entier.
  */
  const COTE = 256;
  const PETIT = 160;
  const MARGE = 24;
  const largeur = MARGE + 3 * (COTE + MARGE);
  const hauteur = MARGE * 3 + COTE + PETIT;
  const calques = [];
  let x = MARGE;
  for (const dessin of [orbite, archipel, houle]) {
    const svg = dessin(512);
    calques.push({ input: await sharp(Buffer.from(svg)).resize(COTE, COTE).png().toBuffer(), left: x, top: MARGE });
    const minuscule = await sharp(Buffer.from(svg)).resize(48, 48).png().toBuffer();
    calques.push({
      input: await sharp(minuscule).resize(PETIT, PETIT, { kernel: 'nearest' }).png().toBuffer(),
      left: x + (COTE - PETIT) / 2,
      top: MARGE * 2 + COTE,
    });
    x += COTE + MARGE;
  }
  await sharp({ create: { width: largeur, height: hauteur, channels: 4, background: '#e2e8f0' } })
    .composite(calques)
    .png()
    .toFile(path.join(DOCS, 'planche.png'));

  console.log('Icônes écrites : public/ (retenue), docs/cyclades/icone/ (les trois + la planche).');
}
