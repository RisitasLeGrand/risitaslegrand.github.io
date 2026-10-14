/**
 * Dans un « viewBox », une taille de police est une unité de dessin.
 *
 * C'est la phrase que ce contrôle protège. Les deux courbes tracées à la main
 * — le suivi de la force et la courbe de poids — déclarent leurs étiquettes en
 * unités du « viewBox », et ce que l'œil en reçoit dépend du facteur
 * d'échelle, c'est-à-dire du rapport entre la boîte rendue et le « viewBox ».
 *
 * Ce facteur était inférieur à 1 des deux côtés : hauteur figée contre un
 * dessin plus haut, largeur minimale plus étroite que le dessin. Des
 * étiquettes déclarées à 11 unités arrivaient à 6,8 et 7,8 px sur téléphone,
 * 10,6 et 10,8 px sur ordinateur — sous le plancher de 14 px que l'échelle
 * typographique du site s'est donné, et qu'aucune valeur de police n'aurait
 * permis d'atteindre tant que le facteur restait sous 1.
 *
 * L'invariant qui le règle tient en deux clauses :
 *
 *   — la largeur minimale du SVG vaut **au moins** la largeur du « viewBox »,
 *     donc le facteur horizontal ne descend pas sous 1 ;
 *   — la hauteur est libre (« h-auto »), donc elle ne vient pas écraser ce
 *     facteur par le bas, « preserveAspectRatio » retenant le plus petit des
 *     deux rapports.
 *
 * ## Pourquoi un contrôle de source, et ce qu'il ne prouve pas
 *
 * Les deux courbes ne se dessinent qu'avec des données réelles — des séances
 * de musculation, des pesées — qu'un essai de navigateur devrait semer pour
 * voir la moindre étiquette. Ce contrôle lit donc le code : il établit que
 * l'invariant est **écrit**, pas que le rendu le respecte. La mesure, elle, a
 * été faite au navigateur au moment de la correction, en injectant la même
 * géométrie dans le conteneur réel.
 *
 * C'est une division honnête du travail : la mesure dit ce qui est vrai
 * aujourd'hui, ce contrôle dit que la raison pour laquelle c'est vrai n'a pas
 * été retirée.
 */
import { readFileSync } from 'node:fs';

/** Les deux courbes, et le nom de la constante qui porte la largeur du dessin. */
const COURBES = [
  { fichier: 'src/pages/sport/force.astro', quoi: 'suivi de la force' },
  { fichier: 'src/pages/odyssee/corps.astro', quoi: 'courbe de poids' },
];

/** 1 rem = 16 px : la racine du site ne redéfinit pas la taille de base. */
const REM = 16;

let rouges = 0;
const verifier = (quoi, ok, detail) => {
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(`\x1b[31m✗\x1b[0m ${quoi}\n    ${detail}`);
    rouges += 1;
  }
};

for (const { fichier, quoi } of COURBES) {
  const source = readFileSync(fichier, 'utf8');

  const viewBox = source.match(/const L = (\d+);/);
  if (!viewBox) {
    verifier(`${quoi} — largeur du viewBox lisible`, false, `« const L = … » introuvable dans ${fichier}.`);
    continue;
  }
  const largeurDessin = Number(viewBox[1]);

  /*
     La classe du SVG est posée juste après le « viewBox », par
     « svg.setAttribute('class', '…') ». On lit la première qui suive, pour ne
     pas attraper celle d'un autre dessin de la même page.
  */
  const apresViewBox = source.slice(source.indexOf("svg.setAttribute('viewBox'"));
  const classe = apresViewBox.match(/svg\.setAttribute\('class', '([^']+)'\)/);
  if (!classe) {
    verifier(`${quoi} — classe du SVG lisible`, false, `Aucun « setAttribute('class', …) » après le viewBox dans ${fichier}.`);
    continue;
  }
  const classes = classe[1];

  const minW = classes.match(/min-w-\[([\d.]+)rem\]/);
  const largeurMini = minW ? Number(minW[1]) * REM : 0;
  verifier(
    `${quoi} — largeur minimale (${largeurMini || '—'} px) au moins égale au viewBox (${largeurDessin} px)`,
    largeurMini >= largeurDessin,
    `classe « ${classes} » : le facteur d'échelle descendrait à ${(largeurMini / largeurDessin).toFixed(2)}, ` +
      `et une étiquette de 14 unités arriverait à ${((14 * largeurMini) / largeurDessin).toFixed(1)} px.`,
  );

  verifier(
    `${quoi} — hauteur libre, elle n'écrase pas le facteur`,
    /\bh-auto\b/.test(classes) && !/\bh-\d/.test(classes) && !/\bh-\[/.test(classes),
    `classe « ${classes} » : une hauteur figée reprend la main sur l'échelle, ` +
      '« preserveAspectRatio » retenant le plus petit des deux rapports.',
  );

  const enDur = classes.match(/text-\[\d+px\]/);
  verifier(
    `${quoi} — pas de taille d'étiquette écrite hors de l'échelle`,
    !enDur,
    `classe « ${classes} » porte « ${enDur?.[0]} » : une taille en dur ne suit pas l'échelle typographique.`,
  );
}

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} constat(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
