/**
 * La bascule du coffre refuse de partir sans sauvegarde prouvée.
 *
 * ## Le défaut visé
 *
 * Rechiffrer est la seule opération de tout ce chantier qui touche aux
 * données, et Alexis l'a conditionnée : « après une sauvegarde confirmée et
 * sans perte de données ». Le défaut, c'est un bouton qui part quand même —
 * parce qu'on a coché une case en croyant avoir sauvegardé, ou parce que la
 * garde est écrite dans un commentaire et nulle part ailleurs.
 *
 * Cet essai ne lit donc pas la page : il **essaie de partir** sans preuve, et
 * vérifie que ça ne part pas.
 *
 * ## Ce qu'il ne fait pas, et c'est délibéré
 *
 * Il ne déclenche **aucune bascule réelle**. Rechiffrer les données d'Alexis
 * est son geste, pas le mien : il le fera sur son appareil, après sa
 * sauvegarde. L'essai s'arrête donc au seuil — il prouve que la porte est
 * fermée, pas qu'elle s'ouvre bien.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { cheminDuNavigateur } from './lib/chromium-essais.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const BASE = 'http://localhost:4321';
const MDP = motDePasseEssais();

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
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
await franchirInitialisation(page, BASE, MDP);
await page.goto(`${BASE}/coffre/bascule/`, { waitUntil: 'networkidle' });

const desactive = () => page.evaluate(() => document.getElementById('lancer-bascule')?.disabled);

/*
   ──────────────────────────────────────────────────────────────────────────
   LES ATTENTES DE CET ESSAI, ET POURQUOI AUCUNE N'EST UNE DURÉE

   `docs/cyclades/cadence-des-essais.md` § 3 et § 4. Quatre temporisations à
   l'aveugle devant quatre constats dont trois sont NÉGATIFS : « le bouton
   reste désactivé ». Un invariant négatif ne s'attend pas ; on attend le
   message du mot de passe, écrit à chaque frappe, qui est la trace POSITIVE
   que le réévaluateur du site est passé.
   ──────────────────────────────────────────────────────────────────────────
*/

/** La borne des attentes : elle rend un blocage lisible, elle ne mesure rien. */
const DELAI = 30_000;

/**
 * Attend le message du mot de passe — non vide, ou conforme à un motif.
 *
 * Sans motif, « non vide » suffit : le message est réécrit à chaque frappe et
 * part vide du serveur.
 */
const attendreLeMessageDuMotDePasse = (motif = null) =>
  page
    .waitForFunction(
      (source) => {
        const texte = (document.getElementById('message-mdp')?.textContent ?? '').trim();
        if (texte === '') return false;
        return source === null || new RegExp(source).test(texte);
      },
      motif === null ? null : motif.source,
      { timeout: DELAI },
    )
    .catch(() => {});

console.log('\nAU DÉPART, LA PORTE EST FERMÉE');

verifier('le bouton de bascule est désactivé', await desactive(), true);
verifier(
  'les champs de mot de passe sont désactivés',
  await page.evaluate(() => [
    document.getElementById('mdp-nouveau')?.disabled,
    document.getElementById('mdp-confirmation')?.disabled,
  ]),
  [true, true],
);

console.log('\nUN MOT DE PASSE SEUL NE SUFFIT PAS : LA SAUVEGARDE MANQUE');

{
  /*
     On force les champs actifs et on saisit un mot de passe valide, SANS
     fournir de sauvegarde. C'est exactement ce que ferait quelqu'un qui
     ouvre l'inspecteur pour « gagner du temps » — et c'est le cas où la
     garde doit tenir, puisque c'est le seul où elle sert.
  */
  const forces = await page.evaluate(() => {
    const etats = [];
    for (const id of ['mdp-nouveau', 'mdp-confirmation']) {
      const e = document.getElementById(id);
      if (e) {
        e.removeAttribute('disabled');
        e.disabled = false;
      }
      etats.push(e ? e.disabled : 'absent');
    }
    /*
       La section porte AUSSI « aria-disabled », et il faut l'ôter pour que
       la saisie passe. Ce n'est pas une gêne de l'essai : c'est une seconde
       barrière réelle, que les technologies d'assistance respectent autant
       que l'outil de pilotage. On la lève explicitement, parce qu'un
       sabotage doit nommer tout ce qu'il contourne.
    */
    document.getElementById('section-mot-de-passe')?.removeAttribute('aria-disabled');
    return etats;
  });
  verifier('on a bien forcé les champs actifs (prémisse du sabotage)', forces, [false, false]);
  const phrase = 'une phrase de plus de quinze signes';
  await page.fill('#mdp-nouveau', phrase);
  await page.fill('#mdp-confirmation', phrase);
  /*
     ──────────────────────────────────────────────────────────────────────
     CE CONSTAT EST NÉGATIF, ET IL N'A PAS DE POST-CONDITION PROPRE.

     « Le bouton reste désactivé » est vrai tout de suite, et le resterait si
     le bouton s'allumait une seconde plus tard. Ce qu'on attend est que le
     réévaluateur du site ait tourné — et il ne laisse aucune marque quand il
     ne change rien : la preuve manque, donc il n'écrit ni message ni état.

     On attend donc le MESSAGE du mot de passe, qui est écrit à chaque frappe
     et qui dit le compte de signes : c'est la trace que le réévaluateur est
     passé, et elle est positive. Les trois sections suivantes le lisent
     d'ailleurs directement.
     ──────────────────────────────────────────────────────────────────────
  */
  await attendreLeMessageDuMotDePasse();
  verifier('le bouton reste désactivé', await desactive(), true);
}

console.log('\nUN MOT DE PASSE TROP COURT NE PASSE PAS NON PLUS');

{
  await page.fill('#mdp-nouveau', 'court');
  await page.fill('#mdp-confirmation', 'court');
  await attendreLeMessageDuMotDePasse(/5 signes sur 15/);
  const message = await page.evaluate(
    () => document.getElementById('message-mdp')?.textContent ?? '',
  );
  verifier('le compte de signes est dit', /5 signes sur 15/.test(message), true);
  verifier('et le bouton reste désactivé', await desactive(), true);
}

console.log('\nDEUX SAISIES QUI DIFFÈRENT SONT SIGNALÉES');

{
  await page.fill('#mdp-nouveau', 'une phrase de plus de quinze signes');
  await page.fill('#mdp-confirmation', 'une phrase de plus de quinze signe');
  await attendreLeMessageDuMotDePasse(/diffèrent/);
  const message = await page.evaluate(
    () => document.getElementById('message-mdp')?.textContent ?? '',
  );
  verifier('la différence est dite', /diffèrent/.test(message), true);
  verifier('et le bouton reste désactivé', await desactive(), true);
}

console.log('\nUN FICHIER QUI N’EST PAS UNE SAUVEGARDE EST REFUSÉ');

{
  /*
     La preuve doit être une VRAIE lecture. On donne un fichier quelconque :
     s'il passait, la garde ne vaudrait rien — il suffirait de déposer
     n'importe quoi pour ouvrir la suite.
  */
  await page.setInputFiles('#fichier-preuve', {
    name: 'pas-une-sauvegarde.cyclades',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('ceci n’est pas une sauvegarde Cyclades'),
  });
  /*
     LA PREUVE EST LUE PUIS REFUSÉE : l'écran annonce d'abord « Ouverture du
     fichier… », donc attendre un texte non vide rendrait la main sur
     l'annonce. On attend un texte qui n'est pas l'annonce — vrai pour les
     deux issues, et indépendant du motif que le constat cherche.
  */
  await page
    .waitForFunction(
      () => {
        const texte = (document.getElementById('message-preuve')?.textContent ?? '').trim();
        return texte !== '' && !texte.startsWith('Ouverture du fichier');
      },
      undefined,
      { timeout: DELAI },
    )
    .catch(() => {});
  const message = await page.evaluate(
    () => document.getElementById('message-preuve')?.textContent ?? '',
  );
  verifier('le refus est dit', /n’a pas pu être lu|pas être lu/.test(message), true);
  verifier('et le bouton reste désactivé', await desactive(), true);
}

console.log('\nL’AVERTISSEMENT SUR LA PERTE EST VISIBLE, PAS EN NOTE DE BAS DE PAGE');

{
  const avertissement = await page.evaluate(() => {
    const t = document.body.textContent ?? '';
    return {
      perte: /définitivement illisibles/.test(t),
      secours: /seule porte de secours/.test(t),
      avantLeChamp: (() => {
        const champ = document.getElementById('mdp-nouveau');
        const alerte = [...document.querySelectorAll('div')].find((d) =>
          /ne se retrouve pas/.test(d.textContent ?? ''),
        );
        if (!champ || !alerte) return false;
        // L'avertissement doit précéder le champ dans le document.
        return Boolean(
          alerte.compareDocumentPosition(champ) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      })(),
    };
  });
  verifier('la perte définitive est annoncée', avertissement.perte, true);
  verifier('la porte de secours est nommée', avertissement.secours, true);
  verifier('et l’avertissement précède le champ', avertissement.avantLeChamp, true);
}

await nav.close();
console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
