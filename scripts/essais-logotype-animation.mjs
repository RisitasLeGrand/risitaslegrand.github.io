/**
 * LES GARDES DES TROIS ANIMATIONS D'ENTRÉE (prompt 65 ter).
 *
 *   npm run essais:logotype:animation
 *
 * Elles s'éprouvent AVANT le branchement, sur une page fabriquée ici qui charge
 * le dessin livré et la feuille des animations — les deux mêmes modules que la
 * planche. Attendre le branchement pour mesurer reviendrait à choisir sur des
 * promesses, et c'est ce que le prompt 65 a appris à ne pas faire.
 *
 * Les six règles du Pilote sont mesurées une à une. Celle qui compte le plus
 * est la dernière : l'état final doit être CELUI DU LOGO STATIQUE, sans quoi
 * `prefers-reduced-motion` ne pourrait pas se contenter de `animation: none`.
 */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const { svgLogotype, VARIANTE_EN_TETE } = await import(`${RACINE}/src/lib/logotype.ts`);
/*
   LA FEUILLE EST LUE SUR LE DISQUE, et non recopiée : c'est celle que le site
   charge, et une copie divergerait au premier retouchage. Même habitude que
   `planche-logotype.mjs`, qui lit `polices.css` de la même façon.
*/
const { readFileSync } = await import('node:fs');
const CSS_ANIMATION = readFileSync(resolve(RACINE, 'src/styles/logotype-anime.css'), 'utf8');
const ANIMATION = { id: 'maree', nom: 'La marée — l’animation retenue' };

const PLAFOND_MS = 1500;
let croix = 0;
const v = (titre, obtenu, attendu) => {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!bon) croix += 1;
  console.log(`  ${bon ? '✓' : '✗'} ${titre}`);
  if (!bon) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (titre, condition) => v(titre, Boolean(condition), true);

const statique = svgLogotype(VARIANTE_EN_TETE, '1.125rem');

/*
   LE MÊME DESSIN DES DEUX CÔTÉS, et c'est ce qui donne son sens à la
   comparaison : `logotype.ts` émet désormais ses `<tspan>` lui-même, donc
   l'élément animé et l'élément statique sont le MÊME balisage. Si l'état final
   de l'un diffère de l'autre, c'est l'animation qui en est la cause, et rien
   d'autre.
*/
const page = (anim) => `<!doctype html><html><head><meta charset="utf-8"><style>
${CSS_ANIMATION}
body { margin: 0; }
#statique, #anime { display: inline-block; }
</style></head><body>
<span id="anime" data-logo-anime="${anim}">${statique}</span>
<span id="statique">${statique}</span>
</body></html>`;

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

console.log('« LA MARÉE » — L’ANIMATION D’ENTRÉE DU LOGOTYPE\n');

{
  const { id, nom } = ANIMATION;
  console.log(`${nom}`);

  /* ── Mouvement normal ────────────────────────────────────────────────── */
  const ctx = await nav.newContext({ reducedMotion: 'no-preference' });
  const p = await ctx.newPage();
  await p.setContent(page(id));

  const vues = await p.evaluate(() => {
    const a = document.getElementById('anime');
    return a.getAnimations({ subtree: true }).map((an) => ({
      duree: an.effect.getTiming().duration,
      repetitions: an.effect.getTiming().iterations,
      remplissage: an.effect.getTiming().fill,
      retard: an.effect.getTiming().delay,
    }));
  });

  vrai(`${id} : une animation est bien posée`, vues.length > 0);
  vrai(
    `${id} : elle ne se répète jamais`,
    vues.every((x) => x.repetitions === 1),
  );
  const finMax = Math.max(...vues.map((x) => (x.retard ?? 0) + x.duree));
  vrai(`${id} : ${Math.round(finMax)} ms au total, sous le plafond de ${PLAFOND_MS}`, finMax <= PLAFOND_MS);

  /*
     ELLE PART D'AILLEURS, et c'est la prémisse sans laquelle tout le reste est
     vide : une animation dont l'état initial serait déjà l'état final ne
     s'anime pas, et toutes les gardes ci-dessous resteraient vertes.
  */
  const depart = await p.evaluate(() => {
    const a = document.getElementById('anime');
    for (const an of a.getAnimations({ subtree: true })) {
      an.pause();
      an.currentTime = 0;
    }
    const cible = a.querySelector('tspan') ?? a.querySelector('svg');
    const s = getComputedStyle(cible);
    return { opacite: s.opacity, transform: s.transform, decoupe: s.clipPath };
  });
  const arrivee = await p.evaluate(() => {
    const a = document.getElementById('anime');
    for (const an of a.getAnimations({ subtree: true })) an.finish();
    const cible = a.querySelector('tspan') ?? a.querySelector('svg');
    const s = getComputedStyle(cible);
    return { opacite: s.opacity, transform: s.transform, decoupe: s.clipPath };
  });
  vrai(
    `${id} : prémisse — l’état de départ diffère de l’état d’arrivée`,
    JSON.stringify(depart) !== JSON.stringify(arrivee),
  );

  /*
     ET LA PLACE NE BOUGE PAS. On relève la boîte du porteur au début, au
     milieu et à la fin : `opacity`, `transform` et `clip-path` ne participent
     pas à la mise en page, et le `viewBox` réserve de toute façon la place —
     mais c'est exactement le genre de chose qu'on croit savoir.
  */
  const boites = await p.evaluate(() => {
    const a = document.getElementById('anime');
    const prises = [];
    for (const t of [0, 0.5, 1]) {
      for (const an of a.getAnimations({ subtree: true })) {
        an.pause();
        an.currentTime = t * (an.effect.getTiming().duration + (an.effect.getTiming().delay ?? 0));
      }
      const r = a.getBoundingClientRect();
      prises.push(`${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return prises;
  });
  v(`${id} : la place ne bouge pas pendant l’animation`, new Set(boites).size, 1);

  /*
     L'ÉTAT FINAL EST CELUI DU LOGO STATIQUE. C'est la garde qui permet à
     `prefers-reduced-motion` de ne rien faire d'autre que supprimer
     l'animation : si l'état final était posé par une règle, le retirer
     laisserait le logo dans son état de DÉPART.
  */
  const compare = await p.evaluate(() => {
    const a = document.getElementById('anime');
    for (const an of a.getAnimations({ subtree: true })) an.finish();
    const s = document.getElementById('statique');
    const ra = a.getBoundingClientRect();
    const rs = s.getBoundingClientRect();
    /*
       ON COMPARE L'ÉLÉMENT ANIMÉ, et non toujours la `<svg>`.

       « marée » anime les `<tspan>` et laisse la `<svg>` intacte : une sonde
       qui regarde la `<svg>` déclarait donc « identique au statique » sans
       rien avoir mesuré, et cette garde était vide pour la seule des trois
       propositions qui n'anime pas la racine. Elle est passée au vert pendant
       que les deux autres rougissaient, ce qui aurait dû me mettre la puce à
       l'oreille plus tôt.
    */
    const quoi = (n) => n.querySelector('tspan') ?? n.querySelector('svg');
    const ca = getComputedStyle(quoi(a));
    const cs = getComputedStyle(quoi(s));
    return {
      memeBoite: Math.abs(ra.width - rs.width) < 0.5 && Math.abs(ra.height - rs.height) < 0.5,
      memeOpacite: ca.opacity === cs.opacity,
      memeTransform: ca.transform === cs.transform,
      memeDecoupe: ca.clipPath === cs.clipPath,
    };
  });
  v(`${id} : à la fin, il est identique au logo statique`, compare, {
    memeBoite: true,
    memeOpacite: true,
    memeTransform: true,
    memeDecoupe: true,
  });

  /*
     RIEN NE CHANGE DE CE QUI EST LU, ni de ce qui prend le focus. L'animation
     ne porte que sur des propriétés de peinture — mais une version qui
     ajouterait un calque par-dessus, ou un élément focusable, passerait toutes
     les gardes ci-dessus.
  */
  const accessible = await p.evaluate(() => {
    const a = document.getElementById('anime');
    const svg = a.querySelector('svg');
    return {
      labels: (a.innerHTML.match(/aria-label="Cyclades"/g) ?? []).length,
      role: svg.getAttribute('role'),
      focusables: a.querySelectorAll('[tabindex], a, button, input').length,
      enTrop: a.children.length,
    };
  });
  v(`${id} : le nom, le rôle, et rien de focusable`, accessible, {
    labels: 1,
    role: 'img',
    focusables: 0,
    enTrop: 1,
  });
  await ctx.close();

  /* ── Mouvement réduit ────────────────────────────────────────────────── */
  const ctxR = await nav.newContext({ reducedMotion: 'reduce' });
  const pr = await ctxR.newPage();
  await pr.setContent(page(id));
  const reduit = await pr.evaluate(() => {
    const a = document.getElementById('anime');
    const s = document.getElementById('statique');
    const ra = a.getBoundingClientRect();
    const rs = s.getBoundingClientRect();
    const quoi = (n) => n.querySelector('tspan') ?? n.querySelector('svg');
    const ca = getComputedStyle(quoi(a));
    const cs = getComputedStyle(quoi(s));
    return {
      animations: a.getAnimations({ subtree: true }).length,
      memeBoite: Math.abs(ra.width - rs.width) < 0.5 && Math.abs(ra.height - rs.height) < 0.5,
      memeOpacite: ca.opacity === cs.opacity,
      memeTransform: ca.transform === cs.transform,
      memeDecoupe: ca.clipPath === cs.clipPath,
    };
  });
  v(`${id} : en mouvement réduit, AUCUNE animation et le logo final direct`, reduit, {
    animations: 0,
    memeBoite: true,
    memeOpacite: true,
    memeTransform: true,
    memeDecoupe: true,
  });
  await ctxR.close();
  console.log('');
}

/*
   AUCUN SCRIPT, ET AUCUNE COULEUR. La feuille est posée par un attribut ; elle
   ne doit rien demander de neuf à la politique de sécurité du site, et ne doit
   pas peindre — les couleurs viennent des jetons, du dessin, et de nulle part
   ailleurs.
*/
console.log('LA FEUILLE NE DEMANDE RIEN DE NEUF');
vrai('aucun script dans la feuille', !/<script|javascript:|expression\(/i.test(CSS_ANIMATION));
vrai('aucune URL dans la feuille', !/url\(/i.test(CSS_ANIMATION));
vrai(
  'aucune couleur posée par l’animation',
  !/(^|[^-])(color|fill|background)\s*:/i.test(CSS_ANIMATION),
);
vrai(
  'le mouvement réduit est bien prévu',
  /prefers-reduced-motion:\s*reduce/.test(CSS_ANIMATION),
);

await nav.close();
console.log(croix === 0 ? '\n« La marée » tient les six règles.' : `\n${croix} croix.`);
process.exit(croix === 0 ? 0 : 1);
