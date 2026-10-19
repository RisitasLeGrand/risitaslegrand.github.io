/**
 * La barre latérale de l'ordinateur, et ce qui la distingue d'un écran large.
 *
 * ## Le défaut visé
 *
 * Poser la latérale sur la seule largeur. Une tablette en paysage mesure
 * aussi 1024 pixels et se pilote au doigt : lui prendre sa barre du bas,
 * atteignable au pouce, pour une colonne haute et étroite serait une
 * régression — et précisément celle que le référentiel mobile interdit.
 *
 * L'essai mesure donc les trois cas, et le deuxième est le seul qui compte
 * vraiment : **la tablette large**. Les deux autres passeraient avec une
 * règle fausse.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';

const BASE = 'http://localhost:4321';
const MDP = process.env.SITE_PASSWORD;
if (!MDP) {
  console.error('SITE_PASSWORD manquant.');
  process.exit(1);
}

let echecs = 0;
const verifier = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
process.on('uncaughtException', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.log(`  \x1b[31m✗\x1b[0m PANNE — ${e?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });

const regarder = async (options) => {
  const ctx = await nav.newContext(options);
  const page = await ctx.newPage();
  await franchirInitialisation(page, BASE, MDP);
  await page.goto(`${BASE}/odyssee/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const vu = await page.evaluate(() => {
    const haut = (id) => {
      const e = document.getElementById(id);
      return Boolean(e) && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
    };
    const application = document.getElementById('application');
    return {
      pointeurFin: window.matchMedia('(pointer: fine)').matches,
      laterale: haut('barre-laterale'),
      ruban: haut('navigation-principale'),
      barreDuBas: haut('barre-du-bas'),
      decalage: application ? getComputedStyle(application).paddingLeft : null,
      ongletsDeLaLaterale: [...document.querySelectorAll('#barre-laterale a[data-onglet]')].length,
    };
  });
  await ctx.close();
  return vu;
};

console.log('\nL’ORDINATEUR : POINTEUR FIN, ÉCRAN LARGE');
{
  const vu = await regarder({ viewport: { width: 1280, height: 900 } });
  console.log(`      ${JSON.stringify(vu)}`);
  verifier('prémisse : le pointeur est fin', vu.pointeurFin, true);
  verifier('la latérale est là', vu.laterale, true);
  verifier('le ruban horizontal s’efface', vu.ruban, false);
  verifier('le contenu est décalé d’autant', vu.decalage, '240px');
  verifier('et la latérale porte des onglets', vu.ongletsDeLaLaterale > 0, true);
}

console.log('\nLA TABLETTE LARGE : MÊME LARGEUR, DOIGT — ET C’EST LE CAS QUI COMPTE');
{
  const vu = await regarder({
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  console.log(`      ${JSON.stringify(vu)}`);
  verifier('prémisse : le pointeur n’est PAS fin', vu.pointeurFin, false);
  verifier('la latérale reste cachée', vu.laterale, false);
  verifier('le ruban horizontal reste là', vu.ruban, true);
  verifier('et rien n’est décalé', vu.decalage, '0px');
}

console.log('\nLE TÉLÉPHONE : RIEN NE CHANGE');
{
  const vu = await regarder({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  console.log(`      ${JSON.stringify(vu)}`);
  verifier('la latérale est absente', vu.laterale, false);
  verifier('la barre du bas est là', vu.barreDuBas, true);
  verifier('et rien n’est décalé', vu.decalage, '0px');
}

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
