/**
 * Le téléphone : pas de défilement latéral, et des cibles qu'un doigt atteint.
 *
 * ## M2 — la page ne doit pas être plus large que l'écran
 *
 * Un seul élément trop large élargit la page entière, et tout le texte se met
 * à défiler de côté. Le contrôle compare la largeur de défilement du document
 * à celle de la fenêtre, et, en cas d'écart, **nomme** les éléments qui
 * dépassent — sans quoi le constat est vrai et inutilisable.
 *
 * Un graphique plus large que l'écran n'est pas en cause s'il défile dans son
 * propre conteneur : c'est la page qui ne doit pas bouger, pas chaque boîte
 * qui doit rentrer.
 *
 * ## M3 — la hauteur des cibles
 *
 * WCAG 2.2 AA pose 24 px comme plancher ; l'usage tactile recommande 44. Le
 * contrôle **échoue** sous 24 px et se contente de compter ce qui est entre
 * 24 et 44 : transformer la recommandation en règle ferait échouer des écrans
 * que personne n'a décidé de reprendre, et un contrôle qu'on apprend à
 * ignorer ne contrôle plus rien.
 *
 * L'exception « en ligne » du critère est appliquée, et il faut dire
 * pourquoi : WCAG 2.5.8 exempte explicitement un lien **posé dans une phrase
 * ou un bloc de texte**. « INSEE » cité au fil d'une actualité fait 12 px de
 * haut parce que c'est la hauteur d'une ligne ; lui en imposer 24 écarterait
 * les lignes du paragraphe les unes des autres pour rien. Le contrôle écarte
 * donc les liens dont le bloc parent porte d'autre texte qu'eux, et ne
 * retient que les cibles isolées — boutons, dépliants, liens seuls dans leur
 * bloc.
 *
 * La condition « pointer: coarse » n'est vraie que si le contexte déclare
 * « hasTouch » : sans cela, les hauteurs minimales du site ne s'appliquent
 * pas et la mesure accuse à tort. C'est une erreur qui a déjà été commise
 * ici, et c'est pour cela qu'elle est écrite.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
const PLANCHER = 24;
const CONFORT = 44;

const ECRANS = [
  '/revisions/',
  '/statistiques/',
  '/bibliotheque/',
  '/glossaire/',
  '/actualites/',
  '/quiz/',
  '/quiz/dgfip/',
  '/progression/',
  '/profil/',
  '/odyssee/',
  '/odyssee/bibliographie/',
  '/sport/',
];

let rouges = 0;
const verifier = (quoi, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
  else {
    console.log(`\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`);
    rouges += 1;
  }
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const contexte = await nav.newContext({
  viewport: { width: 390, height: 844 },
  // Sans ces deux-là, « pointer: coarse » est faux et les hauteurs minimales
  // du site ne s'appliquent pas.
  hasTouch: true,
  isMobile: true,
});
const page = await contexte.newPage();
await franchirInitialisation(page, RACINE, MDP);

verifier(
  'le navigateur se déclare bien tactile',
  await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches),
  true,
);

/*
   M4 — un lien de phrase ne porte pas la classe des cibles tactiles (D-041).

   La classe impose 44 px de haut, ce qui fabrique une boîte plus haute que
   la ligne au milieu d'un paragraphe : le texte s'écarte autour, et le
   paragraphe perd son rythme. WCAG 2.5.8 exempte justement ces liens-là, et
   le contrôle M3 ci-dessous applique déjà l'exception — la classe ne sert
   donc à rien et coûte la mise en page.

   Le critère est le même que celui de M3, et c'est voulu : si l'exception
   s'applique, la classe est de trop.
*/
const liensDePhrase = [];

const debordent = [];
let souslePlancher = 0;
let entreLesDeux = 0;
let cibles = 0;

for (const ecran of ECRANS) {
  await page.goto(`${RACINE}${ecran}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(800);

  liensDePhrase.push(
    ...(await page.evaluate((ecran) => {
      const dansUnePhrase = (a) => {
        const bloc = a.closest('p, li, td, dd');
        if (!bloc) return false;
        const reste = (bloc.textContent ?? '').replace(a.textContent ?? '', '').trim();
        return reste.length > 10;
      };
      return [...document.querySelectorAll('#contenu-principal a')]
        .filter((a) => a.classList.contains('cible-tactile') && dansUnePhrase(a) && a.checkVisibility())
        .map((a) => `${ecran} « ${(a.textContent ?? '').trim().slice(0, 40)} »`);
    }, ecran)),
  );

  const m = await page.evaluate(
    ([plancher, confort]) => {
      const racine = document.documentElement;
      const coupables = [...document.querySelectorAll('body *')]
        .filter((x) => x.getBoundingClientRect().right > racine.clientWidth + 1)
        // Un élément qui défile dans un conteneur prévu pour n'élargit rien.
        .filter((x) => !x.closest('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]'))
        .slice(0, 4)
        .map((x) => `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''}`);

      /** Vrai pour un lien posé au fil d'une phrase : exempté par 2.5.8. */
      const enLigne = (x) => {
        if (x.tagName !== 'A') return false;
        const bloc = x.parentElement;
        if (!bloc) return false;
        const sans = (bloc.textContent ?? '').replace(x.textContent ?? '', '').trim();
        return sans.length > 0;
      };

      const isolees = [...document.querySelectorAll('a[href], button:not([disabled]), summary')]
        .filter((x) => x.getClientRects().length > 0 && !x.closest('#ecran-verrou'))
        .filter((x) => !enLigne(x));
      const hauteurs = isolees.map((x) => Math.round(x.getBoundingClientRect().height));
      const fautives = isolees
        .filter((x) => x.getBoundingClientRect().height < plancher)
        .map((x) => `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''} « ${(x.textContent ?? '').trim().slice(0, 30)} » ${Math.round(x.getBoundingClientRect().height)}px`);

      return {
        large: racine.scrollWidth > racine.clientWidth,
        largeur: racine.scrollWidth,
        fenetre: racine.clientWidth,
        coupables,
        petites: hauteurs.filter((h) => h < plancher).length,
        fautives,
        moyennes: hauteurs.filter((h) => h >= plancher && h < confort).length,
        total: hauteurs.length,
      };
    },
    [PLANCHER, CONFORT],
  );

  if (m.large) debordent.push(`${ecran} ${m.largeur}/${m.fenetre} px${m.coupables.length ? ' (' + m.coupables.join(', ') + ')' : ''}`);
  souslePlancher += m.petites;
  entreLesDeux += m.moyennes;
  cibles += m.total;
  for (const f of m.fautives) console.log(`  ${ecran} ${f}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   M5 — la largeur ET les cibles, sur TOUTES les routes, aux trois tailles,
   coffre réellement ouvert
   ══════════════════════════════════════════════════════════════════════════

   M2 couvre les douze écrans que la liste nomme, à une seule largeur. M5
   couvre le site entier, à 360, 390 et 430 px.

   LE COFFRE, ET L'AVEU QUI VA AVEC. Ce bloc portait depuis le 14 octobre un
   commentaire affirmant « il ouvre le coffre — sans quoi il ne mesurerait
   rien », avec le récit de la leçon : un balayage coffre fermé avait rendu
   « aucun débordement » sur deux pages qui débordaient, parce qu'elles
   étaient vides. Le commentaire était juste et **le code ne l'a jamais
   fait** : le fichier ne contenait pas une seule occurrence de
   « mdp-coffre ». Les branches scellées — Corps, Psyché, Finances, Santé —
   n'ont donc jamais été mesurées autrement que vides. Une sonde textuelle
   prouve qu'un garde-fou est cité, jamais qu'il agit, et c'était ici le
   commentaire qui citait. Le coffre est maintenant ouvert, et la prémisse
   est affirmée avant la première mesure plutôt que supposée.

   LE PLANCHER EST À 44 px, et non plus 24 (décision 4 du prompt 41). Le
   seuil de 24 ne venait d'aucune décision d'Alexis : il venait d'un
   commentaire de ce fichier citant WCAG 2.2 AA. Deux exemptions, et deux
   seulement :

   — le lien posé au fil d'une phrase, que WCAG 2.5.8 exempte explicitement ;
   — ce qui porte « cible-minimale », qui est la liste d'exceptions motivées
     que la décision réclame. Elle existait déjà, avec sa raison écrite dans
     la feuille de style : la mention de source sous un indicateur, qu'on
     suit une fois par mois, et à qui 44 px coûteraient trente pixels sur
     chaque tuile d'un tableau de bord qui en compte dix.

   POURQUOI LES TROIS TAILLES. À 360 px, le libellé de plusieurs dépliants
   s'enroule sur deux lignes et la boîte dépasse 44 px par accident ; à 430
   il tient sur une ligne et retombe à 23. Mesurer à une seule largeur
   déclare conformes des cibles qui ne le sont pas.
*/
{
  const { readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const routes = [];
  const parcourir = (d, prefixe) => {
    for (const e of readdirSync(d)) {
      const c = join(d, e);
      if (statSync(c).isDirectory()) parcourir(c, `${prefixe}${e}/`);
      else if (e === 'index.html') routes.push(prefixe);
    }
  };
  parcourir('dist', '/');
  routes.sort();

  for (const largeur of [360, 390, 430]) {
    const ctx = await nav.newContext({
      viewport: { width: largeur, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const p = await ctx.newPage();
    await franchirInitialisation(p, RACINE, MDP);

    await p.goto(`${RACINE}/odyssee/corps/`, { waitUntil: 'networkidle' });
    if (await p.locator('#mdp-coffre').isVisible().catch(() => false)) {
      await p.fill('#mdp-coffre', MDP);
      await p.click('#ouvrir-coffre');
    }
    await p.waitForSelector('#temoin-coffre:not(.hidden)', { timeout: 40000 }).catch(() => {});
    verifier(
      `${largeur} px — le coffre est ouvert avant la première mesure`,
      await p.evaluate(
        () => !document.getElementById('temoin-coffre')?.classList.contains('hidden'),
      ),
      true,
    );

    const larges = [];
    const petites = [];
    const champsPetits = [];
    const champsSansClavier = [];
    let mesurees = 0;
    let champsMesures = 0;
    for (const r of routes) {
      await p.goto(`${RACINE}${r}`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
      if (await p.locator('#champ-mdp').isVisible().catch(() => false)) {
        await p.fill('#champ-mdp', MDP);
        await p.click('#bouton-verrou');
        await p.waitForTimeout(900);
      }
      await p.waitForTimeout(400);
      const m = await p.evaluate((confort) => {
        const racine = document.documentElement;
        const coupables = [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > racine.clientWidth + 1)
          .filter((e) => !e.closest('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]'))
          .slice(0, 2)
          .map((e) => `${e.tagName}.${(e.className || '').toString().slice(0, 30)}`);

        /** Le lien posé au fil d'une phrase : exempté par WCAG 2.5.8. */
        const enLigne = (x) => {
          if (x.tagName !== 'A') return false;
          const bloc = x.parentElement;
          if (!bloc) return false;
          return ((bloc.textContent ?? '').replace(x.textContent ?? '', '').trim()).length > 0;
        };

        const isolees = [...document.querySelectorAll('a[href], button:not([disabled]), summary')]
          .filter((x) => x.getClientRects().length > 0 && !x.closest('#ecran-verrou'))
          .filter((x) => !enLigne(x))
          // L'exception motivée, portée par la cible elle-même.
          .filter((x) => !x.classList.contains('cible-minimale'));

        /* M7 et M8 — la saisie. Sous 16 px, iOS zoome la page à la mise au
           point ; sans « inputmode », un champ numérique ouvre le clavier
           alphabétique.

           ON NE RETIENT QUE CE QUI SE SAISIT. Une première version prenait
           tous les « input » : elle accusait soixante-douze boutons radio de
           `/planification/seance/`, à 14 px. Or un radio ne porte pas de
           texte et ne déclenche aucun zoom — c'est la mise au point d'un
           champ de **saisie** qui zoome. Les grossir n'aurait rien corrigé
           et aurait décalé l'alignement de leurs étiquettes, pour satisfaire
           un contrôle qui accusait à tort. Le périmètre est donc le même que
           celui de la règle de la feuille de style, et c'est voulu : un
           contrôle et la règle qu'il surveille se lisent ensemble. */
        const SANS_SAISIE = ['checkbox', 'radio', 'range', 'color', 'file',
          'button', 'submit', 'reset', 'image'];
        const champs = [...document.querySelectorAll(
          'input:not([type=hidden]), select, textarea',
        )]
          .filter((x) => x.getClientRects().length > 0)
          .filter((x) => x.tagName !== 'INPUT' || !SANS_SAISIE.includes(x.type));
        const nom = (x) =>
          `${x.tagName.toLowerCase()}${x.tagName === 'INPUT' ? `[${x.type}]` : ''}` +
          `#${x.id || '(sans id)'}`;

        return {
          large: racine.scrollWidth > racine.clientWidth,
          largeur: racine.scrollWidth,
          fenetre: racine.clientWidth,
          coupables,
          total: isolees.length,
          champs: champs.length,
          petits: champs
            .filter((x) => parseFloat(getComputedStyle(x).fontSize) < 16)
            .map((x) => `${nom(x)} ${getComputedStyle(x).fontSize}`),
          sansClavier: champs
            .filter(
              (x) =>
                x.tagName === 'INPUT' &&
                x.type === 'number' &&
                !x.getAttribute('inputmode'),
            )
            .map(nom),
          fautives: isolees
            .filter((x) => x.getBoundingClientRect().height < confort)
            .map(
              (x) =>
                `${x.tagName.toLowerCase()} « ${(x.textContent ?? '').trim().slice(0, 26)} » ` +
                `${Math.round(x.getBoundingClientRect().height)}px`,
            ),
        };
      }, CONFORT);

      mesurees += m.total;
      champsMesures += m.champs;
      for (const c of m.petits) champsPetits.push(`${r} ${c}`);
      for (const c of m.sansClavier) champsSansClavier.push(`${r} ${c}`);
      if (m.large) {
        larges.push(`${r} ${m.largeur}/${m.fenetre} px (${m.coupables.join(', ')})`);
      }
      for (const f of m.fautives) petites.push(`${r} ${f}`);
    }

    /* ════════════════════════════════════════════════════════════════════
       M9 — l'encoche et la poignée d'accueil
       ════════════════════════════════════════════════════════════════════

       Un essai ne peut pas donner une encoche à un navigateur sans écran.
       C'est pourquoi les quatre bandes réservées passent par des variables
       (`--sur-haut`, `--sur-bas`, `--sur-gauche`, `--sur-droite`) plutôt que
       par `env()` écrit en vingt endroits : ici on leur donne une valeur et
       on **mesure** ce qui bouge.

       Relire le texte des règles prouverait qu'elles sont écrites, jamais
       qu'elles agissent — et c'est exactement l'erreur trouvée hier dans ce
       fichier, où un commentaire affirmait ouvrir le coffre sans le faire.

       Les valeurs sont celles d'un iPhone à encoche en portrait : 47 px en
       haut, 34 px pour la poignée. */
    {
      await p.goto(`${RACINE}/odyssee/`, { waitUntil: 'networkidle' }).catch(() => {});
      if (await p.locator('#champ-mdp').isVisible().catch(() => false)) {
        await p.fill('#champ-mdp', MDP);
        await p.click('#bouton-verrou');
        await p.waitForTimeout(900);
      }
      await p.waitForTimeout(400);

      const avant = await p.evaluate(() => {
        const barre = document.getElementById('barre-du-bas');
        return barre ? Math.round(parseFloat(getComputedStyle(barre).paddingBottom)) : null;
      });
      verifier(
        `${largeur} px — sans encoche, la barre du bas ne s'écarte de rien`,
        avant,
        0,
      );

      const apres = await p.evaluate(() => {
        const style = document.createElement('style');
        style.id = 'encoche-simulee';
        style.textContent =
          ':root{--sur-haut:47px;--sur-bas:34px;--sur-gauche:0px;--sur-droite:0px}';
        document.head.appendChild(style);
        const barre = document.getElementById('barre-du-bas');
        const entete = document.querySelector('.entete-sur');
        const principal = document.getElementById('contenu-principal');
        const r = barre?.getBoundingClientRect();
        const premier = barre?.querySelector('a');
        const rp = premier?.getBoundingClientRect();
        return {
          rembourrageBarre: barre
            ? Math.round(parseFloat(getComputedStyle(barre).paddingBottom))
            : null,
          // Le fond de la barre touche toujours le bas de l'écran…
          basDeLaBarre: r ? Math.round(r.bottom) : null,
          hauteurFenetre: Math.round(document.documentElement.clientHeight),
          // …mais son premier bouton s'arrête au-dessus de la poignée.
          basDuBouton: rp ? Math.round(rp.bottom) : null,
          hautEntete: entete ? Math.round(parseFloat(getComputedStyle(entete).top)) : null,
          basContenu: principal
            ? Math.round(parseFloat(getComputedStyle(principal).paddingBottom))
            : null,
        };
      });

      verifier(
        `${largeur} px — la barre du bas écarte ses boutons de la poignée`,
        apres.rembourrageBarre,
        34,
      );
      verifier(
        `${largeur} px — son fond touche quand même le bord de l'écran`,
        apres.basDeLaBarre,
        apres.hauteurFenetre,
      );
      verifier(
        `${largeur} px — aucun bouton de la barre sous la poignée`,
        apres.basDuBouton !== null && apres.basDuBouton <= apres.hauteurFenetre - 34,
        true,
      );
      verifier(
        `${largeur} px — l'en-tête collant se colle sous la barre d'état`,
        apres.hautEntete,
        47,
      );
      verifier(
        `${largeur} px — le contenu dégage la barre ET la poignée`,
        apres.basContenu,
        96 + 34,
      );

      await p.evaluate(() => document.getElementById('encoche-simulee')?.remove());
    }

    verifier(`M5 — ${largeur} px : aucune des ${routes.length} routes ne déborde`, larges, []);
    verifier(`M6 — ${largeur} px : aucune cible isolée sous ${CONFORT} px`, petites, []);
    verifier(`M7 — ${largeur} px : aucun champ sous 16 px (iOS zoomerait)`, champsPetits, []);
    verifier(
      `M8 — ${largeur} px : tout champ « number » déclare son clavier`,
      champsSansClavier,
      [],
    );
    console.log(
      `  (${mesurees} cibles isolées et ${champsMesures} champs mesurés à ${largeur} px)`,
    );
    await ctx.close();
  }
}

await contexte.close();
await nav.close();

verifier(`M2 — aucun des ${ECRANS.length} écrans ne défile latéralement`, debordent, []);
verifier(`M3 — aucune cible sous ${PLANCHER} px (plancher WCAG 2.2 AA)`, souslePlancher, 0);
console.log(
  `  (${cibles} cibles mesurées ; ${entreLesDeux} entre ${PLANCHER} et ${CONFORT} px, ` +
    `au-dessus du plancher mais sous le confort tactile)`,
);
verifier('M4 — aucun lien de phrase ne porte « cible-tactile » (D-041)', liensDePhrase, []);

if (rouges > 0) {
  console.log(`\n\x1b[31m${rouges} constat(s) en échec.\x1b[0m`);
  process.exit(1);
}
console.log('\n\x1b[32mTous les essais passent.\x1b[0m');
