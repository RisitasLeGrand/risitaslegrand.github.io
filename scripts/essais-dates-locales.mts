/**
 * « Aujourd'hui » se lit sur l'horloge de la personne — D7 du prompt 43.
 *
 *   npm run essais:dates-locales
 *
 * Le défaut était simple et invisible : `new Date().toISOString().slice(0, 10)`
 * rend le jour **à Greenwich**. Paris est en avance sur Greenwich — deux heures
 * en été, une en hiver —, donc **entre minuit et deux heures du matin, le
 * calcul naïf rend la veille**. Six écrans datalent ainsi « aujourd'hui », dont
 * la fiche de blessure, la première prise d'une molécule et le début d'une
 * phase de Sport : une blessure déclarée à minuit et demi portait la date de
 * la veille.
 *
 * **Je l'avais d'abord écrit à l'envers** — « après 22 h, il donne demain » —
 * et le premier essai, bâti sur cette erreur, passait au vert sans le
 * correctif : à 22 h 30 à Paris, Greenwich est encore le même jour, et les
 * deux calculs s'accordent. Un contrôle qui ne distingue pas les deux ne
 * contrôle rien. Les instants ci-dessous sont donc choisis là où les deux
 * calculs **divergent**.
 *
 * Six instants sont mesurés, dans un vrai navigateur, **sous un fuseau et une
 * horloge imposés**, tous calculés et non supposés :
 *
 * 1. 0 h 30 le 21 juillet à Paris, où Greenwich est encore le 20 ;
 * 2. 0 h 30 le 25 octobre, dernière nuit en heure d'été ;
 * 3. 0 h 30 le 26 octobre, première nuit en heure d'hiver — en 2026, le
 *    changement a lieu le dimanche 25 à 1 h UTC, et non dans la nuit du 25 au
 *    26 comme je l'avais d'abord cru ;
 * 4 et 5. les deux occurrences de 2 h 30 le 25 octobre, l'heure qui existe
 *    deux fois ;
 * 6. midi le 14 mars, où rien ne doit bouger.
 *
 * Le pilote a nommé le 25 octobre, et il avait raison de le nommer.
 *
 * ## Ce que l'essai ne fait pas
 *
 * Il ne relit pas le code pour y chercher `toISOString` — c'est le travail
 * d'un contrôle de style, et un contrôle de style se contourne. Il regarde la
 * valeur que l'écran propose, qui est ce que la personne voit.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
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
  console.log(`\x1b[31m✗\x1b[0m PANNE — ${(e as Error)?.message ?? e}`);
  process.exit(1);
});

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/**
 * Une page dont l'horloge est figée à un instant donné, en heure de Paris.
 *
 * `Date` est remplacé avant tout script de la page : le constructeur sans
 * argument rend l'instant voulu, `Date.now()` aussi, et tout le reste de la
 * classe est conservé. Le fuseau, lui, est imposé par le contexte, donc
 * `getTimezoneOffset` et `Intl` disent vraiment Paris — y compris son
 * changement d'heure.
 */
const aLHeureDe = async (instantUtc: string) => {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    timezoneId: 'Europe/Paris',
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  await page.addInitScript(`
    (() => {
      const fige = new Date('${instantUtc}').getTime();
      const Vrai = Date;
      const Faux = function (...args) {
        return args.length === 0 ? new Vrai(fige) : new Vrai(...args);
      };
      Faux.prototype = Vrai.prototype;
      Faux.now = () => fige;
      Faux.parse = Vrai.parse;
      Faux.UTC = Vrai.UTC;
      window.Date = Faux;
    })();
  `);
  return { ctx, page };
};

const jourPropose = async (instantUtc: string) => {
  const { ctx, page } = await aLHeureDe(instantUtc);
  await franchirInitialisation(page, RACINE, MDP);
  await page.goto(`${RACINE}/sport/corps/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const valeur = await page.locator('#debut-blessure').inputValue();
  await ctx.close();
  return valeur;
};

/* ── 1. Après minuit, en été : le défaut se voyait là ────────────────────── */

console.log('\nAPRÈS MINUIT, EN ÉTÉ (Paris = UTC+2)');
verifier(
  '0 h 30 le 21 juillet : l’écran propose le 21, et non la veille',
  await jourPropose('2026-07-20T22:30:00Z'),
  '2026-07-21',
);

/* ── 2. Les deux nuits qui encadrent le changement d'heure ───────────────── */

/*
   En 2026, l'heure d'hiver arrive le **dimanche 25 octobre à 1 h UTC** : Paris
   passe de UTC+2 à UTC+1, et 2 h 30 locale existe deux fois.

   Mes deux premières versions de cet essai se sont trompées d'instant, et il
   faut le dire : la première a pris « 22 h 30 à Paris », où Greenwich est
   encore le même jour — les deux calculs s'y accordent, et l'essai passait au
   vert sans le correctif. La seconde a pris « 0 h 30 le 26 octobre » en
   croyant être avant le changement, alors qu'il avait eu lieu la nuit
   précédente. Les instants sont désormais calculés, pas supposés.
*/
console.log('\nLES DEUX NUITS DU CHANGEMENT D’HEURE');
verifier(
  '0 h 30 le 25 octobre, encore en heure d’été : le 25',
  await jourPropose('2026-10-24T22:30:00Z'),
  '2026-10-25',
);
verifier(
  '0 h 30 le 26 octobre, déjà en heure d’hiver : le 26',
  await jourPropose('2026-10-25T23:30:00Z'),
  '2026-10-26',
);

/* ── 3. L'heure qui existe deux fois ─────────────────────────────────────── */

console.log('\nL’HEURE QUI EXISTE DEUX FOIS');
verifier(
  '2 h 30 le 25 octobre, première occurrence : le 25',
  await jourPropose('2026-10-25T00:30:00Z'),
  '2026-10-25',
);
verifier(
  '2 h 30 le 25 octobre, seconde occurrence : le 25 encore',
  await jourPropose('2026-10-25T01:30:00Z'),
  '2026-10-25',
);

/* ── 4. Et le plein jour, qui ne doit pas avoir bougé ────────────────────── */

console.log('\nEN PLEIN JOUR, RIEN NE CHANGE');
verifier('midi le 14 mars : le 14', await jourPropose('2026-03-14T11:00:00Z'), '2026-03-14');

await nav.close();
console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
