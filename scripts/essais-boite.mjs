/**
 * M5 — les fenêtres deviennent des feuilles (et la section C du 43).
 *
 *   npm run essais:boite
 *
 * ## Le défaut visé
 *
 * Dix-neuf fenêtres du navigateur, relevées le 18 octobre : 13 `confirm()`,
 * 4 `alert()`, 2 `prompt()`. Elles ne sont pas « laides », elles sont
 * fausses : leur bouton dit « OK » là où il faudrait le verbe de l'action,
 * leur ordre est celui du système, elles ne se laissent ni annoncer ni fermer
 * par le retour arrière, et sur un téléphone elles surgissent en haut de
 * l'écran, à l'opposé du pouce.
 *
 * ## Les deux moitiés
 *
 * 1. **Au navigateur** : la feuille existe, elle monte du bas, elle porte un
 *    bouton de fermeture qu'on peut toucher, « Annuler » est à gauche et
 *    prend le focus, et une pression distraite sur Entrée n'efface rien.
 * 2. **Dans ce qui est livré** : aucune fenêtre native ne subsiste dans les
 *    scripts construits. Une sonde textuelle ne prouve jamais qu'un
 *    garde-fou agit — mais elle prouve très bien une **absence**, et c'est
 *    tout ce qu'on lui demande ici.
 *
 * La première moitié sans la seconde laisserait seize appels oubliés ; la
 * seconde sans la première laisserait une feuille qui ne s'ouvre pas.
 */
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

/**
 * La seule fenêtre native qui reste, et pourquoi.
 *
 * `coffre/bascule.astro` demande le mot de passe du site. L'interdit 1 du
 * prompt 43 défend de toucher au coffre dans ce lot : elle attend son tour,
 * elle est comptée, et le jour où elle part ce contrôle le dira.
 */
const RESTANTES = 1;

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};
process.on('uncaughtException', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

/* ---- 1. Ce qui est livré ---------------------------------------------- */

console.log('\nCE QUI EST LIVRÉ : PLUS DE FENÊTRES DU NAVIGATEUR');
{
  const dossier = 'dist/_astro';
  const scripts = readdirSync(dossier).filter((f) => f.endsWith('.js'));
  // Un essai qui parcourt zéro élément ne prouve rien.
  verifier('des scripts construits ont bien été trouvés', scripts.length > 0, true);
  const trouvees = [];
  for (const f of scripts) {
    const texte = readFileSync(join(dossier, f), 'utf8');
    for (const m of texte.matchAll(/(?:window\.)?\b(confirm|alert|prompt)\(/g)) {
      // `alert` existe aussi comme valeur de `role` ; on ne garde que l'appel.
      trouvees.push(m[0]);
    }
  }
  verifier(
    `il n’en reste que ${RESTANTES} (le mot de passe du site, interdit 1 du 43)`,
    trouvees.length,
    RESTANTES,
  );
  if (trouvees.length) console.log(`    restante(s) : ${[...new Set(trouvees)].join(', ')}`);
}

/* ---- 2. Au navigateur -------------------------------------------------- */

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/** Ouvre la confirmation destructrice de « Tout effacer », et la décrit. */
async function ouvrirLaBoite(page) {
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  /* La prémisse : si une fenêtre native était encore appelée, elle bloquerait
     le navigateur sans rien dire. On la compte plutôt que de l'ignorer. */
  await page.evaluate(() => {
    window.__natives = 0;
    const compter = () => {
      window.__natives += 1;
      return false;
    };
    window.confirm = compter;
    window.alert = compter;
    window.prompt = compter;
  });
  await page.locator('#reinitialiser').scrollIntoViewIfNeeded();
  await page.click('#reinitialiser');
  await page.waitForTimeout(500);
}

const decrire = () =>
  // eslint-disable-next-line no-undef
  ({
    natives: window.__natives,
    ouverte: !!document.querySelector('dialog.boite')?.open,
    ...(() => {
      const d = document.querySelector('dialog.boite');
      if (!d) return {};
      const f = d.querySelector('.boite-feuille').getBoundingClientRect();
      const fermer = d.querySelector('.boite-fermer');
      const rf = fermer.getBoundingClientRect();
      const boutons = [...d.querySelectorAll('.boite-bouton')].map((b) => ({
        texte: b.textContent,
        gauche: Math.round(b.getBoundingClientRect().left),
        soumission: b.type === 'submit',
        hauteur: Math.round(b.getBoundingClientRect().height),
      }));
      return {
        colleEnBas: Math.abs(f.bottom - window.innerHeight) <= 1,
        fermerLisible: rf.width >= 44 && rf.height >= 44 && !!fermer.getAttribute('aria-label'),
        boutons,
        focus: document.activeElement?.textContent ?? null,
        nomme: !!d.getAttribute('aria-labelledby') && !!d.getAttribute('aria-describedby'),
      };
    })(),
  });

console.log('\nLA FEUILLE, À 360 × 740');
{
  const ctx = await nav.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await ouvrirLaBoite(page);
  const vu = await page.evaluate(decrire);

  verifier('aucune fenêtre du navigateur n’a été appelée', vu.natives, 0);
  verifier('la feuille est ouverte', vu.ouverte, true);
  verifier('elle monte du bas et y reste collée', vu.colleEnBas, true);
  verifier('son bouton de fermeture se touche et se nomme', vu.fermerLisible, true);
  verifier('elle est annoncée : un nom et une description', vu.nomme, true);
  const [action, annuler] = [
    vu.boutons.find((b) => b.texte === 'Tout effacer'),
    vu.boutons.find((b) => b.texte === 'Annuler'),
  ];
  verifier('« Annuler » est à gauche de l’action', annuler.gauche < action.gauche, true);
  verifier('« Annuler » prend le focus', vu.focus, 'Annuler');
  verifier('les deux boutons tiennent le plancher de 44 px', [action.hauteur, annuler.hauteur], [44, 44]);
  /*
     La règle « Entrée ne déclenche jamais une action destructrice » tient
     parce que l'action n'est PAS un bouton de soumission : un formulaire
     soumet son premier bouton de soumission, et il n'y en a qu'un ici.
  */
  verifier('l’action destructrice n’est pas un bouton de soumission', action.soumission, false);

  /*
     Et au doigt, pas seulement dans l'attribut.

     **Ce qui protège aujourd'hui, c'est la place du focus**, et il faut le
     dire exactement. Une confirmation ne contient aucun champ : sans champ,
     la soumission implicite d'un formulaire ne part pas, et Entrée n'active
     jamais que le bouton qui a le focus. Le bouton qui a le focus est
     « Annuler » : une pression distraite referme donc, et n'efface rien.
     L'essai mesuré ci-dessous, blur compris, l'a montré dans les deux sens —
     Entrée sans focus sur un bouton ne fait rien du tout, pas même annuler.

     Le `type="button"` de l'action destructrice n'est donc pas ce qui tient
     la règle aujourd'hui : c'est une ceinture pour le jour où l'on ajoutera
     un champ à une confirmation, et où la soumission implicite deviendrait
     possible. Une vérification d'attribut suffit pour une ceinture ; la
     prétendre mesurée au doigt serait l'enjoliver.
  */
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  verifier(
    'Entrée, à l’ouverture, referme sans effacer',
    await page.evaluate(() => ({
      restante: !!document.querySelector('dialog.boite'),
      efface: !!document.body.textContent?.includes('Progression effacée'),
    })),
    { restante: false, efface: false },
  );

  await ouvrirLaBoite(page);
  await page.evaluate(() => {
    const e = document.activeElement;
    if (e instanceof HTMLElement) e.blur();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  verifier(
    'et sans focus sur un bouton, Entrée ne fait rien du tout',
    await page.evaluate(() => ({
      restante: !!document.querySelector('dialog.boite'),
      efface: !!document.body.textContent?.includes('Progression effacée'),
    })),
    { restante: true, efface: false },
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  /* Le retour arrière referme la feuille, et ne quitte pas l'écran (M5). */
  await ouvrirLaBoite(page);
  const avant = new URL(page.url()).pathname;
  await page.goBack();
  await page.waitForTimeout(500);
  verifier(
    'le retour arrière referme la feuille sans quitter l’écran',
    {
      boite: await page.evaluate(() => !!document.querySelector('dialog.boite')),
      chemin: new URL(page.url()).pathname,
    },
    { boite: false, chemin: avant },
  );

  /* Échap referme, et rend le focus à ce qui l'avait. */
  await ouvrirLaBoite(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  verifier(
    'Échap referme et rend le focus au bouton d’origine',
    await page.evaluate(() => ({
      boite: !!document.querySelector('dialog.boite'),
      focus: document.activeElement?.id ?? null,
    })),
    { boite: false, focus: 'reinitialiser' },
  );
  await ctx.close();
}

console.log('\nET SUR UN ÉCRAN LARGE, CE N’EST PLUS UNE FEUILLE MAIS UNE CARTE');
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await franchirInitialisation(page, RACINE, MDP);
  await ouvrirLaBoite(page);
  verifier(
    'la carte est centrée, et ne touche plus le bas',
    await page.evaluate(() => {
      const f = document.querySelector('.boite-feuille').getBoundingClientRect();
      const H = window.innerHeight;
      return { colle: Math.abs(f.bottom - H) <= 1, centree: Math.abs(f.top - (H - f.height) / 2) <= 2 };
    }),
    { colle: false, centree: true },
  );
  await ctx.close();
}

await nav.close();
process.exit(rouges === 0 ? 0 : 1);
