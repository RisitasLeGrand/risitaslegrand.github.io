/**
 * B5 — l'onglet resté sur l'ancienne version le dit.
 *
 *   npm run essais:publication-onglet
 *
 * ## Le défaut, et pourquoi il fallait le provoquer pour le voir
 *
 * Cyclades est un site statique : toute navigation est un chargement complet,
 * qui rapporte le nouveau `cle.json`. Un onglet ne reste donc sur l'ancienne
 * publication que si l'on ne navigue pas — l'onglet laissé ouvert une nuit,
 * celui d'un téléphone qu'on rallume. Dans ce cas la page garde SA version
 * aussi longtemps qu'elle vit, et rien ne le disait à la personne : la seule
 * phrase du site à ce sujet, dans `contenu.ts`, n'arrive qu'au moment où un
 * contenu refuse de se déchiffrer, donc seulement si la republication a changé
 * le mot de passe ET qu'on a ouvert une fiche.
 *
 * ## Comment la republication est simulée, et pourquoi c'est fidèle
 *
 * On réécrit le champ `version` de `dist/data/cle.json`, que l'aperçu sert
 * depuis le disque. C'est **exactement** ce qu'une republication change pour
 * la page : `version = idStable(sel + date de génération)` dans
 * `build-content.mjs`, et c'est le seul champ que la page compare.
 *
 * Le sel et le témoin ne sont PAS touchés, ce qui a deux conséquences
 * voulues : le déverrouillage continue de marcher, et le rechargement de la
 * section 4 peut aller jusqu'au bout. Une vraie republication changerait tout
 * le contenu chiffré ; ce n'est pas ce que ce lot promet, et prétendre le
 * mesurer serait mentir.
 *
 * Le fichier est remis dans son état à la fin, **y compris si l'essai
 * meurt** : l'aperçu le sert aux autres essais, et un `cle.json` laissé
 * bricolé les enverrait tous sur l'écran du mot de passe.
 *
 * ## Ce qui n'est pas simulé
 *
 * L'événement. On n'appelle aucune fonction cachée : l'essai envoie un vrai
 * `visibilitychange`, que l'écouteur de `publication.ts` reçoit comme il
 * recevrait un retour sur l'onglet. Il a fallu le vérifier : dans ce
 * navigateur sans écran, une page répond toujours `visibilityState = "visible"`
 * (voir `docs/cyclades/cadence-des-essais.md`), donc le garde de l'écouteur
 * passe, et c'est bien le chemin réel qui est éprouvé.
 *
 * ## Ce que les trois sabotages ont montré
 *
 * Mesurés dans un arbre de travail séparé, l'arbre de travail restant propre
 * — la règle est au § 2 du document cité plus haut.
 *
 * **La surveillance retirée** de la mise en page : douze rouges, et aucune
 * panne. Les sept contrôles du bandeau rougissent, les deux sections qui
 * cliquent disent « la suite n'est pas mesurée » au lieu de mourir sur un
 * bouton absent, et les deux dernières sections tournent quand même — celle
 * du contraste, qui fabrique son bandeau elle-même, reste verte, ce qui est
 * juste.
 *
 * C'est ce sabotage qui a trouvé le défaut de cet essai : avant les gardes,
 * il mourait sur un « page.click: Timeout 30000ms exceeded » et emportait
 * trois sections avec lui, dont une qui n'avait rien à voir.
 *
 * **Le cri au loup** — le bandeau posé même quand la version n'a pas changé :
 * **exactement un rouge**, « au retour sur l'onglet non plus », l'assertion
 * de la section 1 qui n'existe que pour cela. Sans elle, un module qui
 * annoncerait une republication à chaque coup d'œil passerait pour une
 * détection.
 *
 * **La conclusion tirée hors ligne** — le bandeau posé quand la lecture
 * échoue : **exactement un rouge**, « aucun bandeau sur une lecture
 * impossible ».
 */
import { writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { chromium } from 'playwright-core';

import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const FICHIER_CLE = 'dist/data/cle.json';

let rouges = 0;
const v = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
const vrai = (quoi, obtenu) => v(quoi, Boolean(obtenu), true);

/* ── Le fichier servi, et sa remise en état quoi qu'il arrive ──────────── */

const original = await readFile(FICHIER_CLE, 'utf8');
const versionDOrigine = JSON.parse(original).version;
let remis = false;
const remettre = async () => {
  if (remis) return;
  remis = true;
  await writeFile(FICHIER_CLE, original);
};
const republier = async (version) => {
  const lu = JSON.parse(original);
  lu.version = version;
  await writeFile(FICHIER_CLE, `${JSON.stringify(lu, null, 2)}\n`);
};
process.on('exit', () => {
  /* Dernier recours SYNCHRONE : `exit` n'attend pas une promesse, et un
     « cle.json » laissé bricolé enverrait tous les autres essais sur l'écran
     du mot de passe. */
  if (!remis) writeFileSync(FICHIER_CLE, original);
});
process.on('uncaughtException', async (e) => {
  await remettre();
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', async (e) => {
  await remettre();
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Le bandeau, relevé en une fois : son texte et ses deux boutons. */
const bandeau = (page) =>
  page.evaluate(() => {
    const b = document.getElementById('bandeau-publication');
    if (!b) return { la: false, texte: '', boutons: [], role: null };
    return {
      la: true,
      texte: (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
      boutons: [...b.querySelectorAll('button')].map((x) => (x.textContent ?? '').trim()),
      role: b.getAttribute('role'),
    };
  });

/** Un onglet ouvert, déverrouillé, sur un écran quotidien. */
async function unOngletOuvert() {
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/odyssee/taches/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  return { ctx, page };
}

/** Le vrai chemin : on revient sur l'onglet. */
async function revenirSurLOnglet(page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(1500);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Rien ne change : aucun bandeau, et c'est la moitié qui compte
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nTANT QUE LA PUBLICATION NE CHANGE PAS, RIEN N’EST DIT');
{
  const { ctx, page } = await unOngletOuvert();
  vrai('prémisse : le fichier servi porte bien une version', Boolean(versionDOrigine));
  v('à l’ouverture, aucun bandeau', (await bandeau(page)).la, false);
  /*
     ET ON REVIENT SUR L'ONGLET SANS QUE RIEN N'AIT CHANGÉ. Sans ce contrôle,
     un bandeau posé à chaque retour passerait pour une détection — alors
     qu'il crierait au loup à longueur de journée.
  */
  await revenirSurLOnglet(page);
  v('au retour sur l’onglet non plus', (await bandeau(page)).la, false);
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Le site est republié : le bandeau paraît, et il dit quoi faire
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLE SITE EST REPUBLIÉ PENDANT QUE L’ONGLET EST OUVERT');
{
  const { ctx, page } = await unOngletOuvert();
  v('prémisse : rien avant la republication', (await bandeau(page)).la, false);

  await republier('b5essaipublication');
  await revenirSurLOnglet(page);

  const b = await bandeau(page);
  vrai('le bandeau paraît', b.la);
  console.log(`      texte : « ${b.texte.replace(/RechargerMasquer$/, '')} »`);
  vrai('il dit qu’une version plus récente est publiée', /version plus récente/i.test(b.texte));
  vrai('il dit que CET onglet montre l’ancienne', /cet onglet montre encore l’ancienne/i.test(b.texte));
  /*
     Et il ne promet pas plus que le vrai : ce qui est enregistré ne risque
     rien, ce qu'on tape n'est pas promis. C'est pour cela qu'on ne recharge
     pas à la place de la personne.
  */
  vrai('il dit ce qui ne risque rien', /déjà enregistré ne risque rien/i.test(b.texte));
  v('il porte « Recharger » et « Masquer »', b.boutons, ['Recharger', 'Masquer']);
  /* `status` et non `alert` : une nouvelle qui peut attendre la fin d'une phrase. */
  v('et c’est une information, pas une alerte', b.role, 'status');
  /*
     DIT UNE FOIS. Un second retour sur l'onglet ne doit pas empiler un
     deuxième bandeau : la nouvelle n'a pas changé, et la répéter l'apprend à
     ignorer.
  */
  await revenirSurLOnglet(page);
  v(
    'un second retour n’en pose pas un deuxième',
    await page.evaluate(() => document.querySelectorAll('#bandeau-publication').length),
    1,
  );
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   3. « Masquer » le fait taire, pour cet onglet
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n« MASQUER » LE FAIT TAIRE');
{
  const { ctx, page } = await unOngletOuvert();
  await republier('b5essaimasquer');
  await revenirSurLOnglet(page);
  const laPourMasquer = (await bandeau(page)).la;
  vrai('prémisse : le bandeau est là', laPourMasquer);
  /*
     ON S'ARRÊTE SI LA PRÉMISSE TOMBE, et c'est un sabotage qui l'a appris.

     La surveillance retirée, le bandeau ne paraît pas : `page.click` attendait
     alors trente secondes un bouton qui n'existait pas, puis l'essai MOURAIT
     sur un « Timeout 30000ms exceeded ». Une panne n'est pas un rouge — elle
     ne dit pas ce qui a cassé, et elle emporte les trois sections suivantes.

     C'est la troisième fois que je paie cette leçon dans ce chantier. La règle
     est désormais sans exception : un relevé d'abord, le geste ensuite, et un
     geste qui dépend d'un élément absent ne se tente pas.
  */
  if (!laPourMasquer) {
    console.log('\x1b[31m✗\x1b[0m la suite de cette section n’est pas mesurée : rien à masquer');
    rouges += 1;
  } else {
    await page.click('#bandeau-publication-masquer');
    await page.waitForTimeout(500);
    v('il part', (await bandeau(page)).la, false);
    /*
       Et il ne revient pas. Un bandeau qu'on écarte et qui reparaît au premier
       coup d'œil ailleurs serait pire que pas de bouton du tout.
    */
    await revenirSurLOnglet(page);
    v('et il ne revient pas au retour suivant', (await bandeau(page)).la, false);
  }
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   4. « Recharger » emmène sur la nouvelle version, et le bandeau s'en va
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n« RECHARGER » EMMÈNE SUR LA NOUVELLE VERSION');
{
  const { ctx, page } = await unOngletOuvert();
  await republier('b5essairecharger');
  await revenirSurLOnglet(page);
  const laPourRecharger = (await bandeau(page)).la;
  vrai('prémisse : le bandeau est là', laPourRecharger);
  /* Même garde : sans bandeau, il n'y a pas de bouton à cliquer. */
  if (!laPourRecharger) {
    console.log('\x1b[31m✗\x1b[0m la suite de cette section n’est pas mesurée : rien à recharger');
    rouges += 1;
    await ctx.close();
  } else {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(() => {}),
    page.click('#bandeau-publication .bandeau-publication-bouton'),
  ]);
  await page.waitForTimeout(4000);

  /*
     APRÈS LE RECHARGEMENT, TROIS CHOSES ENSEMBLE — et il faut les trois.
     Sans la session, « plus de bandeau » voudrait seulement dire que la page
     n'est jamais arrivée jusqu'à la surveillance ; sans la version, il
     voudrait dire qu'on a rechargé l'ancienne.
  */
  const apres = await page.evaluate(async () => {
    let publiee = null;
    try {
      const r = await fetch('/data/cle.json', { cache: 'no-store' });
      publiee = (await r.json()).version ?? null;
    } catch {
      publiee = null;
    }
    return {
      bandeau: Boolean(document.getElementById('bandeau-publication')),
      ouvert: document.documentElement.dataset.verrou === 'ouvert',
      publiee,
    };
  });
  v('plus de bandeau', apres.bandeau, false);
  vrai('la session est toujours ouverte', apres.ouvert);
  v('et c’est bien la nouvelle version qui est servie', apres.publiee, 'b5essairecharger');
  await ctx.close();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Hors ligne, on ne conclut rien
   ══════════════════════════════════════════════════════════════════════════ */

/*
   La même règle qu'`obtenirCle` depuis M8 : une lecture qui échoue ne dit pas
   que la version a changé, elle dit qu'on ne sait pas. Sans ce contrôle, un
   module qui poserait le bandeau sur un échec de lecture annoncerait une
   republication à chaque passage en mode avion.
*/
console.log('\nHORS LIGNE, ON NE CONCLUT RIEN');
{
  const { ctx, page } = await unOngletOuvert();
  await republier('b5essaihorsligne');
  await ctx.setOffline(true);
  await revenirSurLOnglet(page);
  v('aucun bandeau sur une lecture impossible', (await bandeau(page)).la, false);
  /*
     ET LE RÉSEAU REVENU, IL PARAÎT. C'est ce qui distingue « on se taît »
     de « on ne regarde plus » : sans ce second temps, un module qui aurait
     cessé de surveiller après un échec passerait aussi au vert.
  */
  await ctx.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.waitForTimeout(2000);
  vrai('et au retour du réseau, il paraît', (await bandeau(page)).la);
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Le bandeau est lisible, et dans les thèmes qui coûtent le plus
   ══════════════════════════════════════════════════════════════════════════ */

/*
   POURQUOI CETTE SECTION EXISTE, ET CE QU'ELLE A APPRIS EN CHEMIN.

   Le bandeau reprend les deux jetons du bandeau d'annulation —
   « --etat-texte-fort » en fond, « --etat-fond-eleve » en texte —, et ces
   jetons sont GÉNÉRÉS PAR THÈME : « bg-emerald-600 » n'est pas la même
   couleur en Égée et en « Contraste élevé ». C'est la leçon du lot 0.9, où
   mes premiers chiffres étaient faux pour avoir été calculés sur la palette
   d'origine de Tailwind au lieu des feuilles générées.

   Or `essais:contrastes-themes` ne mesure QUE des couples de la palette
   Tailwind : le couple « --etat-* » du bandeau d'annulation n'est mesuré par
   personne, et il vit en production depuis M6. Cette section le mesure donc
   pour les deux bandeaux à la fois, sur l'élément réellement rendu — la seule
   façon honnête, puisque le navigateur sait convertir « oklch() » et qu'une
   expression régulière ne le sait pas.
*/
console.log('\nLE BANDEAU EST LISIBLE DANS LES THÈMES QUI COÛTENT LE PLUS');

const MESURER_LE_BANDEAU = () => {
  const enRgba = (couleur) => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillStyle = couleur;
    const dessine = ctx.fillStyle;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = dessine;
    ctx.fillRect(0, 0, 1, 1);
    const [r, v, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, v, b, a / 255];
  };
  const sur = ([r, v, b, a], [fr, fv, fb]) => [
    Math.round(r * a + fr * (1 - a)),
    Math.round(v * a + fv * (1 - a)),
    Math.round(b * a + fb * (1 - a)),
    1,
  ];
  const luminance = ([r, v, b]) =>
    [r, v, b]
      .map((x) => x / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  const contraste = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const page = enRgba(getComputedStyle(document.body).backgroundColor);
  const bandeau = document.createElement('div');
  bandeau.className = 'bandeau-publication barre-sure';
  const texte = document.createElement('span');
  texte.className = 'bandeau-publication-texte';
  texte.textContent = 'Mesure';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bandeau-publication-bouton cible-tactile';
  bouton.textContent = 'Recharger';
  bandeau.append(texte, bouton);
  document.body.appendChild(bandeau);

  const style = getComputedStyle(bandeau);
  const fondBrut = enRgba(style.backgroundColor);
  const fond = sur(fondBrut, page);
  const styleTexte = getComputedStyle(texte);
  const styleBouton = getComputedStyle(bouton);
  const boite = bouton.getBoundingClientRect();
  const releve = {
    theme: document.documentElement.dataset.theme ?? null,
    fondEstPeint: fondBrut[3] > 0,
    texteSurFond: contraste(sur(enRgba(styleTexte.color), fond), fond),
    boutonSurFond: contraste(sur(enRgba(styleBouton.color), fond), fond),
    fondSurPage: contraste(fond, page),
    /* La cible du bouton : le plancher de 24 px du lot E8 vaut aussi ici. */
    cible: { largeur: Math.round(boite.width), hauteur: Math.round(boite.height) },
  };
  bandeau.remove();
  return releve;
};

const auMoins = (quoi, obtenu, plancher) => {
  const ok = typeof obtenu === 'number' && obtenu >= plancher;
  if (!ok) rouges += 1;
  console.log(
    `${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${quoi} — ${
      typeof obtenu === 'number' ? `${obtenu.toFixed(2)}:1` : obtenu
    } (plancher ${plancher}:1)`,
  );
};

for (const passage of [
  { titre: 'Égée, en clair', palette: 'egee', mode: 'clair' },
  { titre: 'Égée, en sombre', palette: 'egee', mode: 'sombre' },
  { titre: 'Contraste élevé, en sombre', palette: 'contraste', mode: 'sombre' },
]) {
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([palette, mode]) => {
      try {
        localStorage.setItem('revinsp.palette', palette);
        localStorage.setItem('revinsp.theme', mode);
        localStorage.setItem('revinsp.bascule-jour-nuit', 'non');
      } catch {
        /* La prémisse ci-dessous le dira. */
      }
    },
    [passage.palette, passage.mode],
  );
  /*
     L'écran de verrouillage suffit : un bandeau est de l'habillage, et
     déverrouiller pour mesurer une couleur donnerait à cette section une
     raison de rougir qui ne la concerne pas. C'est le choix du lot 0.9.
  */
  await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const r = await page.evaluate(MESURER_LE_BANDEAU);
  console.log(`\n  ${passage.titre}`);
  /* La prémisse : a-t-on bien le thème qu'on croit mesurer ? */
  v(`  le thème appliqué est « ${passage.mode} »`, r.theme, passage.mode);
  /*
     ET QUE LE FOND EST PEINT. Sans cela tout le reste se mesurerait sur un
     bandeau transparent, et les rapports seraient ceux de la page — souvent
     conformes, et sans aucun rapport avec le bandeau. Une classe mal
     orthographiée passerait ainsi au vert.
  */
  vrai('  son fond est peint', r.fondEstPeint);
  auMoins('  son texte sur son fond', r.texteSurFond, 4.5);
  auMoins('  son bouton sur son fond', r.boutonSurFond, 4.5);
  auMoins('  et il se détache de la page', r.fondSurPage, 3);
  v(
    `  la cible du bouton tient le plancher de 24 px (${r.cible.largeur}×${r.cible.hauteur})`,
    { largeur: r.cible.largeur >= 24, hauteur: r.cible.hauteur >= 24 },
    { largeur: true, hauteur: true },
  );
  await ctx.close();
}

await nav.close();
await remettre();
const remisEnEtat = JSON.parse(await readFile(FICHIER_CLE, 'utf8')).version;
v('le fichier servi est remis dans son état', remisEnEtat, versionDOrigine);

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m'
    : `\n\x1b[31m${rouges} rouge${rouges > 1 ? 's' : ''}.\x1b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
