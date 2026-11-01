/**
 * L'IDENTITÉ DE L'APPAREIL, MESURÉE DE BOUT EN BOUT — B-7 du 58.
 *
 * ## Ce que cet essai prouve, et que l'autre ne prouve pas
 *
 * `essais:identite-restauree` éprouve la DÉCISION : une fonction pure reçoit
 * l'état du fichier, l'état local et le rôle, et rend le troisième. Trente
 * contrôles, une seconde, les deux branches clé par clé.
 *
 * Il ne prouve pas que `restaurer()` passe ce résultat à l'écriture. C'est un
 * fait de CÂBLAGE, et je l'avais écrit noir sur blanc dans son en-tête plutôt
 * que de le laisser croire acquis. Celui-ci le mesure : un profil neuf, un
 * vrai fichier, l'écran réel, et l'on relève `etat` AVANT et APRÈS.
 *
 * ## Pourquoi un profil neuf et un vrai fichier
 *
 * Le défaut que B-7 corrige ne se voit qu'entre deux appareils : une
 * restauration faisait prendre à celui qui restaure l'identité de celui qui
 * avait écrit la sauvegarde. Le mesurer demande donc deux profils de
 * navigateur distincts — un qui écrit, un qui lit — et c'est ce que le banc du
 * constructeur a établi avant moi, en observant plutôt qu'en prédisant.
 *
 * ## Les deux pièges du banc, qui lui ont coûté une nuit
 *
 * `#restaurer` est la SECTION, pas le bouton ; le bouton est
 * `#appliquer-cyclades`. Et l'application passe par la boîte commune, qui rend
 * la main si personne ne répond. Les deux sont dans `lib/sauvegarde-essais.mjs`,
 * qui fait ce chemin correctement — on s'en sert plutôt que de le refaire.
 *
 * ## Et pourquoi ce fichier est en `.mjs`
 *
 * Première écriture en `.mts`, et il est mort sur « __name is not defined ».
 * Aucune fonction NOMMÉE ne franchit la frontière du navigateur depuis un
 * `.mts` : le transpileur garde les noms et injecte `__name(…)`, qui n'existe
 * que du côté de Node. Le helper d'empreinte, déclaré dans le `evaluate`, en
 * était une.
 *
 * On pourrait n'employer que des lambdas anonymes ; le dépôt a tranché
 * autrement, et tous ses essais de navigateur sont en `.mjs` — pas de
 * transpilation, donc pas de piège. Les types ne manquent pas ici : ce fichier
 * ne manipule que des chaînes et des booléens, et c'est l'écran qu'il éprouve.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import {
  fabriquerUneSauvegarde,
  restaurerDepuis,
  unProfilNeuf,
} from './lib/sauvegarde-essais.mjs';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';
const MDP = motDePasseEssais();
/* Le mot de passe du FICHIER, distinct de celui du site : voir la fixture. */
const MDP_FICHIER = 'mot-de-passe-du-fichier-b7';

let echecs = 0;
const v = (intitule, obtenu, attendu) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
  } else {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${intitule}`);
    console.log(`      obtenu  ${a}`);
    console.log(`      attendu ${b}`);
  }
};

const CLEFS = ['appareil', 'horloge', 'boite.publique', 'boite.privee', 'coffre.sel'];

/**
 * Ouvre le coffre, parce que c'est LUI qui crée les clés de la boîte.
 *
 * Première version de cet essai : aucun profil n'ouvrait son coffre, donc
 * aucun ne portait de « boite.publique », et les contrôles comparaient deux
 * ABSENCES en concluant qu'elles étaient la même clé. Un contrôle qui porte sur
 * rien passe ou tombe au hasard de sa formulation — celui-ci tombait, et il
 * avait raison de tomber.
 *
 * `assurerLaBoite()` est appelée à l'ouverture du coffre (`coffre.ts`, vers la
 * ligne 652) : sans ouverture, pas de boîte. C'est pourquoi le banc du
 * constructeur en portait, lui — il faisait un check-in de psyché coffre
 * ouvert — et pourquoi la règle « boite.* ne voyage jamais » n'était pas
 * éprouvée ici du tout.
 */
const ouvrirLeCoffre = async (page) => {
  await page.goto(`${RACINE}/odyssee/psyche/`, { waitUntil: 'networkidle', timeout: 45000 });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  const ferme = await page
    .waitForSelector('#coffre-ferme', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!ferme) return false;
  await page.fill('#mdp-coffre', MDP);
  await page.click('#ouvrir-coffre');
  return page
    .waitForSelector('#coffre-ouvert:not(.hidden)', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
};

/**
 * Relève `etat` sous forme d'EMPREINTES, et non de valeurs.
 *
 * Deux raisons, et la seconde est la vraie. Les valeurs ne sont pas toutes
 * sérialisables — une clé de boîte peut être un objet que `postMessage` refuse
 * — et surtout, ce qu'on compare ici n'est pas ce qu'une clé CONTIENT mais si
 * elle a CHANGÉ. Une empreinte courte répond à la question posée et ne fait
 * pas sortir de secret dans un journal d'essai.
 */
const releverEtat = (page) =>
  page.evaluate((clefs) => {
    const empreinte = (valeur) => {
      if (valeur === undefined || valeur === null) return '(absente)';
      let texte;
      try {
        texte = typeof valeur === 'string' ? valeur : JSON.stringify(valeur);
      } catch {
        return `(${typeof valeur}, illisible)`;
      }
      if (texte === undefined) return `(${typeof valeur})`;
      let somme = 0;
      for (let i = 0; i < texte.length; i += 1) somme = (somme * 31 + texte.charCodeAt(i)) >>> 0;
      return `${texte.length}:${somme.toString(16)}`;
    };
    return new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = async () => {
        const base = r.result;
        const sortie = {};
        for (const clef of clefs) {
          sortie[clef] = await new Promise((fini) => {
            if (!base.objectStoreNames.contains('etat')) return fini('(pas de magasin)');
            const q = base.transaction('etat', 'readonly').objectStore('etat').get(clef);
            q.onsuccess = () => fini(empreinte(q.result));
            q.onerror = () => fini('(illisible)');
          });
        }
        base.close();
        ok(sortie);
      };
      r.onerror = () => ok({});
    });
  }, CLEFS);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const dossier = mkdtempSync(path.join(tmpdir(), 'b7-'));

try {
  console.log('\n\x1b[1mUN APPAREIL A ÉCRIT LA SAUVEGARDE\x1b[0m');

  /*
     On relève l'identité de A au moment où il sauvegarde : c'est elle qui ne
     doit PAS franchir la restauration en « s'ajoute », et qui doit la franchir
     en « remplace ».
  */
  let identiteDeA = {};
  let coffreDeAOuvert = false;
  const fichier = await fabriquerUneSauvegarde(nav, {
    racine: RACINE,
    motDePasseDuSite: MDP,
    motDePasseDuFichier: MDP_FICHIER,
    dossier,
    nom: 'identite.cyclades',
    poser: async (page) => {
      coffreDeAOuvert = await ouvrirLeCoffre(page);
      identiteDeA = await releverEtat(page);
    },
  });
  v('l’appareil qui sauvegarde a une identité', identiteDeA.appareil !== '(absente)', true);
  v('son coffre s’est ouvert', coffreDeAOuvert, true);
  /*
     ET IL PORTE DONC UNE BOÎTE. Sans ce contrôle, tous ceux qui suivent sur
     « boite.* » compareraient des absences : le fichier n'aurait aucune clé à
     ne pas transmettre, et la règle qu'ils gardent ne serait pas éprouvée.
  */
  v('et il porte donc des clés de boîte, que le fichier emporte', [
    identiteDeA['boite.publique'] !== '(absente)',
    identiteDeA['boite.privee'] !== '(absente)',
  ], [true, true]);
  console.log(`      A : appareil=${identiteDeA.appareil} · boîte=${identiteDeA['boite.publique']}`);

  /* ── Branche 1 : il s'ajoute ─────────────────────────────────────────── */
  console.log('\n\x1b[1mUN APPAREIL QUI S’AJOUTE GARDE LA SIENNE\x1b[0m');
  {
    const { ctx, page } = await unProfilNeuf(nav);
    await franchirInitialisation(page, RACINE, MDP);
    /*
       Cet appareil ouvre SON coffre avant de restaurer : il a donc ses propres
       clés de boîte, et « elles n'ont pas changé » porte sur quelque chose.
    */
    v('cet appareil ouvre son coffre', await ouvrirLeCoffre(page), true);
    const avant = await releverEtat(page);
    console.log(`      avant : appareil=${avant.appareil} · boîte=${avant['boite.publique']}`);

    const issue = await restaurerDepuis(page, {
      racine: RACINE,
      chemin: fichier,
      motDePasseDuSite: MDP,
      motDePasseDuFichier: MDP_FICHIER,
      role: 's-ajoute',
    });
    v('le fichier est accepté', issue.verifie, true);
    const apres = await releverEtat(page);
    console.log(`      après : appareil=${apres.appareil} · boîte=${apres['boite.publique']}`);

    v('l’identité de cet appareil n’a pas changé', apres.appareil, avant.appareil);
    v('et ce n’est pas celle du fichier', apres.appareil === identiteDeA.appareil, false);
    v('son horloge non plus n’a pas été reprise', apres.horloge === identiteDeA.horloge, false);
    v('la clé publique de sa boîte n’a pas changé', apres['boite.publique'], avant['boite.publique']);
    v('ni la privée', apres['boite.privee'], avant['boite.privee']);
    /*
       ET LE SEL DU COFFRE, LUI, A VOYAGÉ. C'est le contre-contrôle : une
       politique qui ne restaurerait RIEN passerait tous les contrôles
       ci-dessus et rendrait la sauvegarde illisible avec le bon mot de passe.
    */
    v('mais le sel du coffre vient du fichier', apres['coffre.sel'], identiteDeA['coffre.sel']);
    await ctx.close();
  }

  /* ── Branche 2 : il remplace l'ancien ────────────────────────────────── */
  console.log('\n\x1b[1mUN APPAREIL QUI REMPLACE L’ANCIEN EN REPREND L’IDENTITÉ\x1b[0m');
  {
    const { ctx, page } = await unProfilNeuf(nav);
    await franchirInitialisation(page, RACINE, MDP);
    /*
       Cet appareil ouvre SON coffre avant de restaurer : il a donc ses propres
       clés de boîte, et « elles n'ont pas changé » porte sur quelque chose.
    */
    v('cet appareil ouvre son coffre', await ouvrirLeCoffre(page), true);
    const avant = await releverEtat(page);
    console.log(`      avant : appareil=${avant.appareil} · boîte=${avant['boite.publique']}`);

    const issue = await restaurerDepuis(page, {
      racine: RACINE,
      chemin: fichier,
      motDePasseDuSite: MDP,
      motDePasseDuFichier: MDP_FICHIER,
      role: 'remplace-l-ancien',
    });
    v('le fichier est accepté', issue.verifie, true);
    const apres = await releverEtat(page);
    console.log(`      après : appareil=${apres.appareil} · boîte=${apres['boite.publique']}`);

    v('l’identité est celle du fichier', apres.appareil, identiteDeA.appareil);
    v('et ce n’est plus celle d’avant', apres.appareil === avant.appareil, false);
    v('l’horloge aussi vient du fichier', apres.horloge, identiteDeA.horloge);
    /*
       ET LES CLÉS DE BOÎTE NE SUIVENT PAS, dans cette branche-ci non plus.
       C'est la règle qui ne plie dans aucun des deux cas : « boite.privee » est
       scellée sous la clé du coffre de l'appareil qui l'a créée, et la
       reprendre donnerait une boîte qui a l'air de marcher.
    */
    v('mais la clé publique de la boîte reste celle d’ici', apres['boite.publique'], avant['boite.publique']);
    /*
     ET CE N'EST PAS CELLE DU FICHIER. Ce contrôle a été le seul rouge de la
     première course, et il avait RAISON : les deux valeurs étaient
     « (absente) », donc égales, parce qu'aucun profil n'ouvrait son coffre.
     Il ne mesurait rien et le disait. On lui a donné son objet en ouvrant les
     coffres plutôt qu'en l'assouplissant.
  */
  v('et ce n’est pas celle du fichier', apres['boite.publique'] === identiteDeA['boite.publique'], false);
  v('ni une absence des deux côtés, qui ne prouverait rien', apres['boite.publique'], avant['boite.publique']);
    v('la privée non plus', apres['boite.privee'], avant['boite.privee']);
    v('et le sel du coffre vient du fichier, comme dans l’autre branche', apres['coffre.sel'], identiteDeA['coffre.sel']);
    await ctx.close();
  }
} finally {
  await nav.close();
  rmSync(dossier, { recursive: true, force: true });
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} contrôle${echecs > 1 ? 's' : ''} en échec.\x1b[0m\n`
    : '\n\x1b[32mTout est vert : la décision est bien celle qui est écrite.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
