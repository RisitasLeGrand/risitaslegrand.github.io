/**
 * L'archive des actualités : une période à la fois, et des cartes repliées.
 *
 * ## Ce que la critique reprochait
 *
 * « 109 articles répartis sur une quarantaine de semaines, aucune pagination,
 * aucun "Charger plus", aucun champ de recherche. […] 710 éléments
 * interactifs, dont 638 de moins de 44 px. Impossible de survoler, de
 * retrouver un article, ou de savoir où l'on en est. » 40 659 px sur
 * ordinateur, 85 314 px sur téléphone.
 *
 * Les contrôles mesurent les trois choses nommées : la hauteur, le nombre
 * d'éléments interactifs, et la possibilité de retrouver un article.
 *
 * ## Pourquoi cet essai a besoin de « actualites-data »
 *
 * Les actualités ne viennent pas du build : elles sont dans le dépôt,
 * chiffrées avec la clé publique de la rubrique, et le script de publication
 * les copie à côté du site. En local, « npm run actualites:dist » les y
 * place et reconstruit l'inventaire. Sans cela l'archive ne montre que
 * l'entrée de démonstration, et l'essai passerait au vert sur une page d'une
 * semaine — il s'arrête plutôt que de mesurer cela.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { nonMesurable } from './lib/non-mesurable.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(
      `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
    );
    rouges += 1;
  }
};
const mesure = (quoi, valeur) => console.log(`\x1b[36m·\x1b[0m ${quoi} : ${valeur}`);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({ viewport: { width: 1280, height: 800 } });
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

async function ouvrir(adresse = '/actualites/') {
  await page.goto(`${RACINE}${adresse}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForFunction(
    () => document.getElementById('chargement-actu')?.classList.contains('hidden'),
    undefined,
    { timeout: 40000 },
  );
  await page.waitForTimeout(900);
}

await ouvrir();

const etat = await page.evaluate(() => ({
  sections: document.querySelectorAll('#archive section').length,
  cartes: document.querySelectorAll('#archive article').length,
  interactifs: document.querySelectorAll('#archive a, #archive button, #archive summary, #archive select, #archive input')
    .length,
  hauteur: document.documentElement.scrollHeight,
  periodesChargees: document.getElementById('choix-periode')?.options.length
    || document.querySelectorAll('#archive section').length,
}));

if (etat.periodesChargees < 10) {
  /*
     CODE 3 ET NON 2, et la différence n'est pas cosmétique : la batterie
     compte ROUGE tout code non nul qui n'est pas 3. Cet essai sortait donc en
     rouge dans tout conteneur sans l'archive réelle — un rouge permanent, qui
     masque les vrais, alors que rien n'est cassé. C'est exactement le défaut
     que « nonMesurable » a été écrit pour corriger, et celui-ci lui avait
     échappé.

     Le navigateur se ferme AVANT l'appel : « nonMesurable » sort du processus
     sans revenir, et un Chromium laissé ouvert tiendrait son port.
  */
  const combien = etat.periodesChargees;
  await nav.close();
  nonMesurable(
    'l’archive réelle des actualités : au moins dix périodes servies',
    `${combien} ${combien >= 2 ? 'périodes' : 'période'} seulement — cet essai mesure la ` +
      'LONGUEUR de l’archive, et le corpus d’exemple ne la fournit pas',
    'npm run actualites:dist, puis reconstruisez',
  );
}

mesure('hauteur de page à 1280 px', `${etat.hauteur} px`);
mesure('sections de période affichées', etat.sections);
mesure('cartes affichées', etat.cartes);
mesure('éléments interactifs dans l’archive', etat.interactifs);

verifier('N1 — une seule période est affichée à l’ouverture', etat.sections, 1);

const barre = await page.evaluate(() => {
  const b = document.getElementById('barre-periode');
  const choix = document.getElementById('choix-periode');
  return {
    visible: !!b && !b.classList.contains('hidden'),
    periodes: choix ? choix.options.length : 0,
    suivanteDesactivee: document.getElementById('periode-suivante')?.disabled ?? null,
    precedenteDesactivee: document.getElementById('periode-precedente')?.disabled ?? null,
    position: document.getElementById('position-periode')?.textContent ?? '',
    titre: document.querySelector('#archive section h2')?.textContent ?? '',
  };
});
mesure('périodes disponibles', barre.periodes);
verifier('N2 — la barre de période est visible', barre.visible, true);
verifier('N2 — « Suivante » est désactivé sur la période la plus récente', barre.suivanteDesactivee, true);
verifier('N2 — « Précédente » est actif', barre.precedenteDesactivee, false);
verifier('N2 — la position est annoncée', /^1 sur \d+$/.test(barre.position), true);

// N3 — « Précédente » recule dans le temps.
await page.click('#periode-precedente');
await page.waitForTimeout(500);
const apres = await page.evaluate(() => ({
  titre: document.querySelector('#archive section h2')?.textContent ?? '',
  position: document.getElementById('position-periode')?.textContent ?? '',
  suivanteDesactivee: document.getElementById('periode-suivante')?.disabled ?? null,
  adresse: location.search,
}));
verifier('N3 — « Précédente » change de période', apres.titre !== barre.titre, true);
verifier('N3 — et recule : la position passe à 2', apres.position, `2 sur ${barre.periodes}`);
verifier('N3 — « Suivante » redevient actif', apres.suivanteDesactivee, false);
verifier('N4 — l’adresse porte la période affichée', /periode=/.test(apres.adresse), true);

// N4 — l'adresse se recharge sur la même période.
await ouvrir(`/actualites/${apres.adresse}`);
verifier(
  'N4 — rouvrir cette adresse ramène la même période',
  await page.evaluate(() => document.querySelector('#archive section h2')?.textContent ?? ''),
  apres.titre,
);

// N5 — la recherche traverse les périodes.
await page.fill('#recherche-actu', 'budget');
await page.waitForTimeout(700);
const cherche = await page.evaluate(() => ({
  sections: document.querySelectorAll('#archive section').length,
  cartes: document.querySelectorAll('#archive article').length,
  compte: document.querySelector('#archive [role="status"]')?.textContent ?? '',
  barreCachee: document.getElementById('barre-periode')?.classList.contains('hidden') ?? null,
  adresse: location.search,
}));
mesure('recherche « budget »', `${cherche.cartes} carte(s) dans ${cherche.sections} période(s)`);
verifier('N5 — la recherche traverse plusieurs périodes', cherche.sections > 1, true);
verifier('N5 — elle annonce son compte', /r[ée]sultat/.test(cherche.compte), true);
verifier('N5 — la navigation période par période s’efface', cherche.barreCachee, true);
verifier('N5 — l’adresse porte la recherche', /q=budget/.test(cherche.adresse), true);

await page.fill('#recherche-actu', 'zzzzzzzz');
await page.waitForTimeout(700);
verifier(
  'N5 — une recherche sans réponse le dit',
  await page.evaluate(() => /Aucune actualité ne correspond/.test(document.getElementById('archive')?.textContent ?? '')),
  true,
);
await page.fill('#recherche-actu', '');
await page.waitForTimeout(700);

// N6 — les cartes sont repliées.
const repli = await page.evaluate(() => {
  const carte = document.querySelector('#archive article');
  return {
    resumeCoupe: !!carte?.querySelector('[data-resume].line-clamp-3'),
    depliants: document.querySelectorAll('#archive article details.depliant').length,
    cartes: document.querySelectorAll('#archive article').length,
    boutonsIa: [...document.querySelectorAll('#archive button')].filter((b) =>
      (b.textContent ?? '').includes('Préparer une question'),
    ).length,
    /*
       « checkVisibility » et non « offsetParent » : un « details » fermé
       masque son contenu par « content-visibility », qui n'est pas
       « display: none ». « offsetParent » restait donc non nul et l'essai
       comptait huit boutons visibles là où ni l'œil ni Playwright n'en
       voyaient un seul. C'est l'essai qui avait tort.
    */
    visiblesIa: [...document.querySelectorAll('#archive button')].filter(
      (b) =>
        (b.textContent ?? '').includes('Préparer une question') &&
        b.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true }),
    ).length,
  };
});
verifier('N6 — le résumé est coupé à trois lignes', repli.resumeCoupe, true);
verifier('N6 — chaque carte a son « Lire la suite »', repli.depliants, repli.cartes);
verifier('N6 — aucun bouton « Préparer une question » n’est visible tant que rien n’est déplié', repli.visiblesIa, 0);

await page.click('#archive article details.depliant summary');
await page.waitForTimeout(400);
const deplie = await page.evaluate(() => {
  const carte = document.querySelector('#archive article');
  return {
    resumeCoupe: !!carte?.querySelector('[data-resume].line-clamp-3'),
    iaVisible: [...(carte?.querySelectorAll('button') ?? [])].some(
      (b) =>
        (b.textContent ?? '').includes('Préparer une question') &&
        b.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true }),
    ),
  };
});
verifier('N6 — déplier rend le résumé entier', deplie.resumeCoupe, false);
verifier('N6 — et montre le bouton « Préparer une question »', deplie.iaVisible, true);

/* ── D-039 : le marqueur « lu / non lu » ──────────────────────────────── */
await ouvrir('/actualites/');
const avantLecture = await page.evaluate(() => ({
  cartes: document.querySelectorAll('#archive article').length,
  lues: document.querySelectorAll('#archive article[data-lu="true"]').length,
  boutons: [...document.querySelectorAll('#archive [data-bascule-lu]')].map((b) => b.textContent),
}));
verifier('L1 — rien n’est lu au départ', avantLecture.lues, 0);
verifier(
  'L1 — chaque carte porte sa bascule, et son libellé dit l’action',
  {
    boutons: avantLecture.boutons.length,
    cartes: avantLecture.cartes,
    tous: avantLecture.boutons.every((t) => t === 'Marquer comme lu'),
  },
  { boutons: avantLecture.cartes, cartes: avantLecture.cartes, tous: true },
);

const titreLu = await page.evaluate(
  () => document.querySelector('#archive article h3')?.textContent ?? '',
);
await page.click('#archive article [data-bascule-lu]');
await page.waitForTimeout(400);
verifier(
  'L2 — la carte marquée le dit, et la bascule propose l’inverse',
  await page.evaluate(() => {
    const carte = document.querySelector('#archive article');
    return {
      lu: carte?.dataset.lu ?? null,
      marque: carte?.querySelector('[data-marque-lu]')?.textContent ?? '',
      bouton: carte?.querySelector('[data-bascule-lu]')?.textContent ?? '',
      autres: document.querySelectorAll('#archive article[data-lu="true"]').length,
    };
  }),
  { lu: 'true', marque: 'Lu', bouton: 'Marquer comme non lu', autres: 1 },
);

/*
   Le point de l'affaire : le marqueur doit survivre au rechargement. Un
   « lu » qui vit en mémoire ne répond pas à « savoir où l'on en est », qui
   est la question posée une semaine plus tard.
*/
await ouvrir('/actualites/');
verifier(
  'L3 — le marqueur survit au rechargement, sur la même actualité',
  await page.evaluate((titre) => {
    const carte = [...document.querySelectorAll('#archive article')].find(
      (a) => a.querySelector('h3')?.textContent === titre,
    );
    return { trouvee: !!carte, lu: carte?.dataset.lu ?? null };
  }, titreLu),
  { trouvee: true, lu: 'true' },
);

/*
   Le libellé a changé de forme avec D-043 — « 5 à lire sur 12 » au lieu de
   « 12 actualités, 5 non lues », pour tenir dans la largeur d'un téléphone.
   Ce que le contrôle vérifie n'a pas changé : le menu dit ce qui reste.
   L'attente est seulement devenue plus précise, puisqu'elle exige les deux
   nombres et leur rapport.
*/
verifier(
  'L4 — le sélecteur de période annonce ce qui reste à lire',
  await page.evaluate(() =>
    /\d+ à lire sur \d+/.test(document.getElementById('choix-periode')?.options[0]?.textContent ?? ''),
  ),
  true,
);

await page.check('#non-lues');
await page.waitForTimeout(500);
verifier(
  'L4 — « Non lues seulement » retire la carte lue',
  await page.evaluate((titre) => ({
    luesAffichees: document.querySelectorAll('#archive article[data-lu="true"]').length,
    laCarte: [...document.querySelectorAll('#archive article h3')].some((h) => h.textContent === titre),
  }), titreLu),
  { luesAffichees: 0, laCarte: false },
);
await page.uncheck('#non-lues');
await page.waitForTimeout(500);

await page.evaluate((titre) => {
  const carte = [...document.querySelectorAll('#archive article')].find(
    (a) => a.querySelector('h3')?.textContent === titre,
  );
  carte?.querySelector('[data-bascule-lu]')?.click();
}, titreLu);
await page.waitForTimeout(500);
await ouvrir('/actualites/');
verifier(
  'L5 — démarquer efface vraiment la ligne, rechargement compris',
  await page.evaluate(() => document.querySelectorAll('#archive article[data-lu="true"]').length),
  0,
);

// Mesure téléphone.
await contexte.close();
const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const pageTel = await tel.newPage();
await franchirInitialisation(pageTel, RACINE, MDP);
await pageTel.goto(`${RACINE}/actualites/`, { waitUntil: 'networkidle' });
if (await pageTel.locator('#champ-mdp').isVisible().catch(() => false)) {
  await pageTel.fill('#champ-mdp', MDP);
  await pageTel.click('#bouton-verrou');
}
await pageTel
  .waitForFunction(() => document.getElementById('chargement-actu')?.classList.contains('hidden'), undefined, {
    timeout: 40000,
  })
  .catch(() => {});
await pageTel.waitForTimeout(900);
const surTel = await pageTel.evaluate(() => ({
  hauteur: document.documentElement.scrollHeight,
  large: document.documentElement.scrollWidth,
  fenetre: document.documentElement.clientWidth,
}));
mesure('hauteur de page à 390 px', `${surTel.hauteur} px`);
verifier('N7 — pas de défilement latéral sur téléphone', surTel.large <= surTel.fenetre + 1, true);

/*
   N8 — le menu de période se lit en entier sur l'écran le plus étroit.

   Un « option » ne se replie pas, ne s'abrège pas et n'avertit pas : ce qui
   dépasse disparaît, et rien ne dit à la personne qu'elle lit un libellé
   tronqué. C'était le cas — 69 px de large pour un libellé qui en demandait
   414 : on lisait « 202 ». Deux causes, deux corrections (D-043), et donc un
   contrôle qui mesure la seule chose qui compte, le rapport entre la place et
   le besoin.

   Mesuré à 360 px, la largeur que « docs/ajouter-une-branche.md » retient
   comme écran le plus étroit, et sur toutes les options — pas seulement celle
   qui se trouve choisie au moment du passage.
*/
const etroit = await nav.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
const pageEtroite = await etroit.newPage();
await franchirInitialisation(pageEtroite, RACINE, MDP);
await pageEtroite.goto(`${RACINE}/actualites/`, { waitUntil: 'networkidle' });
if (await pageEtroite.locator('#champ-mdp').isVisible().catch(() => false)) {
  await pageEtroite.fill('#champ-mdp', MDP);
  await pageEtroite.click('#bouton-verrou');
}
await pageEtroite.waitForTimeout(1500);
const menu = await pageEtroite.evaluate(() => {
  const choix = document.getElementById('choix-periode');
  if (!choix || !choix.options.length) return null;
  const style = getComputedStyle(choix);
  /* La flèche du menu et les marges internes mangent de la place : on les
     retire du budget plutôt que de mesurer une largeur que le texte n'a pas. */
  const place =
    choix.getBoundingClientRect().width -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight) -
    16;
  const sonde = document.createElement('span');
  sonde.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font}`;
  document.body.appendChild(sonde);
  const trop = [];
  let pire = 0;
  for (const option of choix.options) {
    sonde.textContent = option.text;
    const besoin = Math.ceil(sonde.getBoundingClientRect().width);
    pire = Math.max(pire, besoin);
    if (besoin > place) trop.push(`« ${option.text} » : ${besoin} px pour ${Math.round(place)}`);
  }
  sonde.remove();
  return { trop, pire: Math.round(pire), place: Math.round(place), options: choix.options.length };
});
await etroit.close();
if (!menu) {
  verifier('N8 — le menu de période porte des options', false, true);
} else {
  mesure('menu de période à 360 px', `${menu.options} options, la plus longue ${menu.pire} px pour ${menu.place} disponibles`);
  verifier('N8 — aucun libellé de période n’est rogné à 360 px', menu.trop, []);
}

await nav.close();
console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
