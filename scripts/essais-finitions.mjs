/**
 * Les finitions A8 à A14 du prompt 37.
 *
 *   npm run essais:finitions
 *
 * Sept petites corrections, et un même fil : des chiffres écrits à la main là
 * où il y a des jetons, et des déclarations qui en écrasent d'autres sans que
 * personne l'ait voulu. Chacune se mesure, aucune ne se lit dans la feuille de
 * style — c'est l'erreur que ce lot entier corrige ailleurs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const secondes = (brut) => Math.max(...String(brut).split(',').map((x) => Number.parseFloat(x) || 0));

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)?.slice(0, 300)}`);
    console.log(`      attendu ${JSON.stringify(attendu)?.slice(0, 300)}`);
  }
};

console.log('\nFINITIONS (A8 à A14)');

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

const ouvrir = async (route) => {
  await page.goto(`${RACINE}${route}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(800);
  }
};

await ouvrir('/');

console.log('\n  A8 — la barre de chargement');
{
  /*
     ON ATTEND QUE LA BARRE AIT FINI SON TRAVAIL.

     Sans cette attente, le contrôle a échoué une fois sur plusieurs : la barre
     était encore en cours quand je lisais ses styles, et le composant
     réécrivait « data-etat » entre mes deux lectures. Un contrôle qui tombe
     une fois sur cinq ne dit plus rien de ce qu'il mesure.
  */
  await page
    .waitForFunction(
      () => document.getElementById('barre-progression')?.dataset.etat === 'inactif',
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
  const lu = await page.evaluate(() => {
    const j = document.getElementById('barre-progression-jauge');
    const b = document.getElementById('barre-progression');
    b.dataset.etat = 'termine';
    const cj = getComputedStyle(j);
    const cb = getComputedStyle(b);
    const releve = {
      jaugeDuree: cj.transitionDuration,
      jaugeProps: cj.transitionProperty,
      classes: j.className,
      sortie: cb.transitionDuration,
    };
    b.dataset.etat = 'inactif';
    return releve;
  });
  v(`le remplissage dure 200 ms, pas 300 (${lu.jaugeDuree})`, secondes(lu.jaugeDuree), 0.2);
  v('et ne transitionne que la transformation', lu.jaugeProps, 'transform');
  v('les classes Tailwind mortes ont disparu', /duration-200|ease-out/.test(lu.classes), false);
  v(`le fondu final tient dans les 300 ms (${lu.sortie})`, secondes(lu.sortie) <= 0.3, true);
}

console.log('\n  A9 — la pastille du menu de thème');
{
  const lu = await page.evaluate(() => {
    const p = document.querySelector('.pastille-theme');
    if (!p) return null;
    const c = getComputedStyle(p);
    return { props: c.transitionProperty, classes: p.className };
  });
  v('la pastille existe', lu !== null, true);
  if (lu) {
    v('elle n’anime plus « tout »', /\ball\b/.test(lu.props), false);
    v('aucune épaisseur de bordure n’est animée', /border-width/.test(lu.props), false);
    v('elle anime une ombre', /box-shadow/.test(lu.props), true);
  }
}

console.log('\n  A10 — plus aucun « transition: all » ni « transition-all »');
{
  const fichiers = [];
  const parcourir = (d) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c);
      else if (/\.(astro|svelte|css|ts)$/.test(e)) fichiers.push(c);
    }
  };
  parcourir('src');
  const fautifs = [];
  for (const f of fichiers) {
    /*
       LES COMMENTAIRES SONT NEUTRALISÉS, PAS IGNORÉS LIGNE À LIGNE.

       Ma première écriture écartait les lignes commençant par « * » ou « // ».
       Elle a dénoncé deux de mes propres commentaires — ceux qui EXPLIQUENT
       pourquoi « transition-all » est proscrit —, parce qu'une ligne du milieu
       d'un bloc ne commence pas forcément par une étoile. On remplace donc les
       blocs par des espaces, en gardant les retours à la ligne pour que les
       numéros de ligne restent justes.
    */
    const brut = readFileSync(f, 'utf8');
    const sansCommentaires = brut
      .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
      .replace(/^\s*\/\/.*$/gm, '');
    sansCommentaires.split('\n').forEach((l, i) => {
      if (/transition:\s*all\b/.test(l) || /\btransition-all\b/.test(l)) fautifs.push(`${f}:${i + 1}`);
    });
  }
  v('aucun fichier ne transitionne « all »', fautifs, []);
}

console.log('\n  A11 — liens et boutons au même rythme');
{
  /*
     ON INTERROGE TOUS LES LIENS, PAS LE PREMIER.

     Cette assertion lisait `document.querySelector('a.cible-tactile')` — le
     premier lien tactile du document. Elle est passée au rouge quand ce
     premier-là s'est trouvé être « Mot de passe perdu ? », le seul des
     vingt-et-un liens de l'accueil à ne pas porter la classe « transition » :
     il changeait de couleur d'un coup là où ses vingt voisins fondaient. Les
     deux avaient tort. Le site, parce qu'un lien était hors du rythme — c'est
     exactement ce que A11 voulait finir. Et l'essai, parce qu'une règle
     d'uniformité ne se vérifie pas sur l'élément qui se présente le premier :
     elle se vérifie sur tous. Il relève donc maintenant les liens **hors du
     compte**, et les nomme.
  */
  const lu = await page.evaluate(() => {
    const liens = [...document.querySelectorAll('a.cible-tactile')];
    const b = document.querySelector('button:not(:disabled)');
    const cb = getComputedStyle(b);
    const horsDuRythme = liens
      .filter((a) => getComputedStyle(a).transitionDuration !== '0.12s')
      .map((a) => `${(a.textContent ?? '').trim().slice(0, 30)} → ${getComputedStyle(a).transitionDuration}`);
    const premier = liens[0] ? getComputedStyle(liens[0]) : null;
    return {
      combien: liens.length,
      horsDuRythme,
      lienDuree: premier ? premier.transitionDuration : 'aucun lien',
      lienCourbe: premier ? premier.transitionTimingFunction : '',
      boutonDuree: cb.transitionDuration,
      boutonCourbe: cb.transitionTimingFunction,
      boutonProps: cb.transitionProperty,
    };
  });
  v(`les ${lu.combien} liens tactiles suivent tous le jeton court`, lu.horsDuRythme, []);
  v(`le lien suit le jeton court (${lu.lienDuree})`, secondes(lu.lienDuree), 0.12);
  v(`le bouton aussi (${lu.boutonDuree})`, secondes(lu.boutonDuree), 0.12);
  v('et la même courbe', lu.lienCourbe.split(',')[0].trim(), lu.boutonCourbe.split(',')[0].trim());
  v('le bouton a retrouvé le fondu de fond', /background-color/.test(lu.boutonProps), true);
  v('sans perdre le retour de pression', /transform/.test(lu.boutonProps), true);
}

console.log('\n  A13 — les écarts du socle');
{
  const socle = readFileSync('src/styles/global.css', 'utf8');
  v('la classe « .jauge » n’existe plus', /^\.jauge\s*\{/m.test(socle), false);
  v(
    '« --duree-succes » est marquée réservée',
    /RÉSERVÉE, INUTILISÉE À DESSEIN/.test(socle),
    true,
  );
  /* Et elle l'est vraiment : personne ne l'emploie. */
  const emplois = [];
  const parcourir = (d) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c);
      else if (/\.(astro|svelte|css|ts)$/.test(e)) {
        const t = readFileSync(c, 'utf8');
        if (/var\(--duree-succes/.test(t)) emplois.push(c);
      }
    }
  };
  parcourir('src');
  v('et personne ne l’emploie', emplois, []);

  const lu = await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<details class="depliant" open><summary>x</summary><p>y</p></details>';
    document.body.append(d);
    const apres = getComputedStyle(d.querySelector('summary'), '::after');
    const contenu = getComputedStyle(d.querySelector('p'));
    const r = { chevron: apres.transitionDuration, ouverture: contenu.animationDuration };
    d.remove();
    return r;
  });
  v(`le chevron suit le jeton court (${lu.chevron})`, secondes(lu.chevron), 0.12);
  v(`ce qui arrive dure 200 ms (${lu.ouverture})`, secondes(lu.ouverture), 0.2);
}

console.log('\n  A14 — la bulle ne couvre plus la barre d’onglets');
{
  /* Sur une page QUI PORTE la barre : l'accueil ne l'a pas, et y mesurer
     aurait donné un vert sans objet. */
  await ouvrir('/odyssee/taches/');

  /*
     LA CLASSE VIENT DE « ui.ts », PAS DE CET ESSAI — et c'est une correction.

     Ma première écriture écrivait elle-même la classe corrigée dans la page,
     puis mesurait sa géométrie. Elle mesurait donc son propre texte : mise à
     l'épreuve sur la version fautive, elle est passée VERTE pendant que les
     onze autres contrôles échouaient. Un contrôle qui porte sa propre réponse
     ne contrôle rien.

     On extrait maintenant la classe du code source de « notifier() ». Le
     contrôle mesure ce que l'application poserait vraiment.
  */
  const source = readFileSync('src/lib/ui.ts', 'utf8');
  const trouve = /zone\.className\s*=\s*\n?\s*'([^']+)'/.exec(source);
  v('la classe de la zone de notification est lisible dans ui.ts', Boolean(trouve), true);
  const classeDeLaZone = trouve ? trouve[1] : '';

  const lu = await page.evaluate((classe) => {
    const barre = document.getElementById('barre-du-bas');
    if (!barre) return { sansBarre: true };
    const z = document.createElement('div');
    z.className = classe;
    z.innerHTML = '<div class="bulle-notification parue rounded-full px-4 py-2">essai</div>';
    document.body.append(z);
    const rb = z.querySelector('div').getBoundingClientRect();
    const rbarre = barre.getBoundingClientRect();
    z.remove();
    return {
      sansBarre: false,
      bulleBas: Math.round(rb.bottom),
      barreHaut: Math.round(rbarre.top),
      chevauche: rb.bottom > rbarre.top,
    };
  }, classeDeLaZone);
  v('la barre d’onglets est bien là à cette largeur', lu.sansBarre, false);
  if (!lu.sansBarre) {
    v(
      `la bulle s’arrête au-dessus (bulle ${lu.bulleBas}, barre à ${lu.barreHaut})`,
      lu.chevauche,
      false,
    );
  }
}

await nav.close();
console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
