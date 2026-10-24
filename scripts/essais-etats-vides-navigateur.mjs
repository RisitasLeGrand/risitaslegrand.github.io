/**
 * Les états vides : ce que montre un carnet où rien n'a encore été fait.
 *
 * ## Ce que la critique reprochait (L4 et L5)
 *
 * - **Programmes** : « un tableau de 18 lignes de tirets, avec "aucune cible"
 *   répété 18 fois, pour un utilisateur qui n'a aucun programme ».
 * - **Force** : « l'exercice présélectionné est "Adducteurs à la machine ·
 *   jamais pratiqué" ».
 * - **Statistiques** : « le graphique "Temps de révision par semaine" est une
 *   zone sombre vide, sans valeur ni message ».
 * - **Planification** : « la section "Les séances à venir…" commence au mardi
 *   6 octobre et marque au moins les 6 et 7 octobre comme "non tenue" » alors
 *   qu'on est le 13. « Pour un profil créé aujourd'hui, c'est culpabilisant et
 *   incohérent. »
 *
 * Ces quatre écrans ont en commun d'avoir **la forme** d'une information et
 * pas son contenu : un tableau rempli de tirets, une courbe sans point, un
 * reproche pour des jours antérieurs à l'ouverture du carnet. Les contrôles
 * ci-dessous se lancent donc sur un profil vierge, qui est précisément le cas
 * où ils échouaient.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

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
const contexte = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

async function ouvrir(chemin) {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForTimeout(1800);
}

console.log('\n\x1b[1mE1 — PROGRAMMES : LE TABLEAU DE TIRETS\x1b[0m\n');
await ouvrir('/sport/programmes/');
const programmes = await page.evaluate(() => {
  const visible = (id) => {
    const e = document.getElementById(id);
    return !!e && !e.classList.contains('hidden');
  };
  const corps = document.getElementById('volumes');
  return {
    tableauVisible: visible('volumes-tableau'),
    messageVisible: visible('volumes-vides'),
    lignes: corps ? corps.querySelectorAll('tr').length : 0,
    sansCibleAffiches: [...(corps?.querySelectorAll('td') ?? [])].filter(
      (td) => td.textContent === 'aucune cible' && td.checkVisibility(),
    ).length,
    action: document.getElementById('volumes-vides-action')?.textContent?.trim() ?? '',
    message: document.getElementById('volumes-vides-texte')?.textContent?.trim() ?? '',
  };
});
mesure('lignes construites dans le tableau', programmes.lignes);
verifier('E1 — le tableau de volumes est replié tant qu’il n’y a rien à comparer', programmes.tableauVisible, false);
verifier('E1 — « aucune cible » n’est plus affiché une seule fois', programmes.sansCibleAffiches, 0);
verifier('E1 — une phrase le remplace', programmes.message.length > 20, true);
verifier('E1 — avec une action', programmes.action, 'Créer un programme');

console.log('\n\x1b[1mE2 — FORCE : L’EXERCICE PRÉSÉLECTIONNÉ\x1b[0m\n');
await ouvrir('/sport/force/');
const force = await page.evaluate(() => {
  const select = document.getElementById('exercice');
  const choisi = select?.options[select.selectedIndex];
  return {
    valeur: select?.value ?? null,
    libelle: choisi?.textContent?.trim() ?? '',
    jamaisPratique: (choisi?.textContent ?? '').includes('jamais pratiqué'),
    analyseVisible: !document.getElementById('analyse')?.classList.contains('hidden'),
    invite: document.getElementById('invite-exercice')?.textContent?.trim() ?? '',
  };
});
mesure('exercice à l’ouverture', force.libelle || '(aucun)');
verifier('E2 — la page n’ouvre pas sur un exercice jamais pratiqué', force.jamaisPratique, false);
verifier('E2 — aucun exercice n’est choisi d’office sur un carnet vierge', force.valeur, '');
verifier('E2 — la courbe vide n’est pas affichée', force.analyseVisible, false);
verifier('E2 — une invite prend sa place', /Choisissez un exercice|Aucun exercice/.test(force.invite), true);

// Choisir un exercice rend l'analyse.
const unExercice = await page.evaluate(() => {
  const select = document.getElementById('exercice');
  const option = [...(select?.options ?? [])].find((o) => o.value);
  if (!option) return null;
  select.value = option.value;
  select.dispatchEvent(new Event('change'));
  return option.value;
});
if (unExercice) {
  await page.waitForTimeout(600);
  verifier(
    'E2 — choisir un exercice rend l’analyse',
    await page.evaluate(() => ({
      analyse: !document.getElementById('analyse')?.classList.contains('hidden'),
      invite: !document.getElementById('invite-exercice')?.classList.contains('hidden'),
    })),
    { analyse: true, invite: false },
  );
}

console.log('\n\x1b[1mE3 — STATISTIQUES : L’HISTOGRAMME VIDE\x1b[0m\n');
await ouvrir('/statistiques/');
const stats = await page.evaluate(() => {
  const vide = document.getElementById('histogramme-vide');
  const zone = document.getElementById('zone-histogramme');
  return {
    videVisible: !!vide && !vide.classList.contains('hidden'),
    zoneVisible: !!zone && !zone.classList.contains('hidden'),
    lien: document.getElementById('vers-planification')?.getAttribute('href') ?? '',
    etiquette: document.getElementById('histogramme')?.getAttribute('aria-label') ?? '',
    total: document.getElementById('total-histogramme')?.textContent?.trim() ?? '',
  };
});
/*
   Deux cas, et il faut les distinguer.

   La critique décrivait « 6 min au total : les barres sont invisibles » —
   un total **non nul** mais minuscule sur une échelle de dix heures. Le
   remplacement du graphique par une phrase ne vaut que pour le zéro absolu ;
   dans l'autre cas, ce qui manquait n'était pas le graphique mais le
   chiffre, et c'est le chiffre qui est maintenant écrit. L'essai vérifie
   donc la branche qui s'applique, et dit laquelle.
*/
mesure('total des douze semaines', stats.total || '(aucun)');
if (stats.videVisible) {
  verifier('E3 — sans aucun temps enregistré, le graphique laisse la place à une phrase', stats.videVisible, true);
  verifier('E3 — et le rectangle vide disparaît', stats.zoneVisible, false);
} else {
  verifier('E3 — avec du temps enregistré, le graphique reste', stats.zoneVisible, true);
  verifier(
    'E3 — et la valeur est écrite, pas seulement dessinée',
    /Douze semaines : .+ en tout/.test(stats.total),
    true,
  );
  verifier("E3 — l'échelle fixe est dite", /échelle est fixe à 10 h/i.test(stats.total), true);
}
verifier('E3 — la phrase mène à la planification', /\/planification\/$/.test(stats.lien), true);
verifier('E3 — le graphique porte un nom accessible qui énonce les douze semaines', /Temps de révision des douze/.test(stats.etiquette), true);

console.log('\n\x1b[1mE4 — PLANIFICATION : LES JOURS D’AVANT L’OUVERTURE\x1b[0m\n');
await ouvrir('/planification/');
const planning = await page.evaluate(() => {
  const cartes = [...document.querySelectorAll('#grille-planning article')];
  const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const attenduAujourdhui = majuscule(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date()),
  );
  return {
    cartes: cartes.length,
    premiere: cartes[0]?.querySelector('p')?.textContent?.trim() ?? '',
    attenduAujourdhui,
    nonTenues: cartes.filter((c) => (c.textContent ?? '').includes('non tenue')).length,
    marqueeAujourdhui: cartes.filter((c) => (c.textContent ?? '').includes("aujourd'hui")).length,
  };
});
mesure('jours affichés', planning.cartes);
mesure('premier jour affiché', planning.premiere);
verifier('E4 — aucun jour n’est marqué « non tenue » sur un carnet ouvert aujourd’hui', planning.nonTenues, 0);
verifier('E4 — le planning commence aujourd’hui', planning.premiere.toLowerCase(), planning.attenduAujourdhui.toLowerCase());
verifier('E4 — et « aujourd’hui » y est marqué une fois', planning.marqueeAujourdhui, 1);

await nav.close();
console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
