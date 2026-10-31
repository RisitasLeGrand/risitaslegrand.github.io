/**
 * LE CODE DE SORTIE DE LA BATTERIE, ÉPROUVÉ PAR SABOTAGE.
 *
 * ## Le défaut qu'il garde
 *
 * `scripts/batterie.mjs` se terminait par `process.exit(0)`, et son
 * commentaire l'assumait : « la batterie rapporte, l'humain tranche ». La
 * conséquence est qu'un `npm run socle && git push` poussait sur une batterie
 * rouge, et que trois agents ont lu ce zéro comme un verdict. Le défaut est
 * consigné au README, ligne 721.
 *
 * ## Pourquoi par sabotage, et non par lecture
 *
 * Un contrôle qui chercherait `process.exit(1)` dans la source passerait au
 * vert le jour où le un reste écrit mais ne s'atteint plus. Ce qui compte
 * n'est pas le texte : c'est le code que le processus rend. On fait donc
 * tourner la batterie POUR DE VRAI, trois fois, et on lit son code.
 *
 * Pour qu'elle tourne en trois secondes et sans site, deux substitutions, et
 * aucune concession dans la batterie elle-même :
 *
 * - un faux `npm`, premier dans `PATH`, qui rend ce qu'on lui demande de
 *   rendre. La batterie appelle `execFileSync('npm', ['run', …])` : elle
 *   appelle donc le nôtre, et ses vingt-trois essais du socle reviennent
 *   instantanément ;
 * - un serveur de trois lignes qui répond `robots.txt`, parce que la batterie
 *   REFUSE de commencer sans aperçu — et c'est bien ainsi. Son adresse se
 *   donne par `RACINE`, qui existe déjà.
 *
 * Le mot de passe donné est factice : le faux `npm` ne déverrouille rien.
 *
 * ## Les trois cas
 *
 * 1. tout vert → code 0. Sans celui-ci, un `exit(1)` inconditionnel passerait.
 * 2. code non nul → code non nul. Le juge évident.
 * 3. **code nul AVEC une croix** → code non nul. Celui-ci est le cœur : c'est
 *    exactement la forme qui a trompé, et la batterie a deux juges pour elle.
 */
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CODE_NON_MESURABLE, INTITULE_NON_MESURABLE } from './lib/non-mesurable.mjs';

const racine = path.resolve(import.meta.dirname, '..');
const vert = (t) => `\u001b[32m${t}\u001b[0m`;
const rouge = (t) => `\u001b[31m${t}\u001b[0m`;

let rouges = 0;
function verifier(quoi, obtenu, attendu) {
  if (obtenu === attendu) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    rouges += 1;
    console.log(`  ${rouge('✗')} ${quoi} — attendu ${attendu}, obtenu ${obtenu}`);
  }
}

console.log('\nLE CODE DE SORTIE DE LA BATTERIE\n');

/*
   L'APERÇU FACTICE VIT DANS UN PROCESSUS À LUI, ET IL LE FAUT.

   Première version : un `createServer` dans CE processus. Les trois contrôles
   passaient au rouge, et pour une seule raison — `spawnSync` bloque la boucle
   d'événements. Le serveur était bien ouvert, le port bien pris, et il ne
   répondait à rien pendant que la batterie tournait : elle refusait donc de
   commencer, et rendait un. Deux des trois contrôles passaient alors au vert
   PAR COÏNCIDENCE, puisqu'ils attendaient justement un.

   C'est le contrôle du récapitulatif qui l'a dit : trois rouges, aucun
   récapitulatif, donc aucune batterie n'était allée au bout. Sans lui, ce
   fichier se serait déclaré vert en ne mesurant rien.

   Le serveur est donc un enfant, qui annonce son port sur sa sortie. Port
   zéro : le système choisit, et on ne se dispute pas le 4321 avec l'aperçu
   réel qui tourne peut-être à côté.
*/
const serveur = spawn(
  process.execPath,
  [
    '-e',
    "const{createServer}=require('node:http');" +
      "const s=createServer((_,r)=>{r.writeHead(200,{'content-type':'text/plain'});r.end('User-agent: *\\n')});" +
      "s.listen(0,'127.0.0.1',()=>console.log(s.address().port))",
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
process.once('exit', () => serveur.kill());

const port = await new Promise((resoudre, rejeter) => {
  const minuteur = setTimeout(() => rejeter(new Error('l’aperçu factice n’a pas annoncé son port')), 20_000);
  let vu = '';
  serveur.stdout.on('data', (morceau) => {
    vu += morceau;
    const ligne = /^(\d+)\s*$/m.exec(vu);
    if (ligne) {
      clearTimeout(minuteur);
      resoudre(Number(ligne[1]));
    }
  });
});
const adresse = `http://127.0.0.1:${port}`;

/* Et on vérifie qu'il répond VRAIMENT, avant d'en déduire quoi que ce soit. */
const repond = await fetch(`${adresse}/robots.txt`, { signal: AbortSignal.timeout(10_000) })
  .then((r) => r.ok)
  .catch(() => false);
verifier('l’aperçu factice répond avant la mesure', repond, true);

/**
 * Fait tourner la batterie contre un faux `npm` qui écrit `sortie` et rend
 * `code`, et renvoie le code que la BATTERIE rend.
 */
function batterieAvec(sortie, code) {
  const bac = mkdtempSync(path.join(tmpdir(), 'faux-npm-'));
  const faux = path.join(bac, 'npm');
  writeFileSync(
    faux,
    `#!/bin/sh\n${sortie ? `printf '%s\\n' ${JSON.stringify(sortie)}\n` : ''}exit ${code}\n`,
  );
  chmodSync(faux, 0o755);
  const resultat = spawnSync(process.execPath, [path.join(racine, 'scripts', 'batterie.mjs'), '--socle'], {
    cwd: racine,
    encoding: 'utf8',
    timeout: 120_000,
    env: {
      ...process.env,
      PATH: `${bac}:${process.env.PATH}`,
      RACINE: adresse,
      SITE_PASSWORD: 'mot-de-passe-factice-du-faux-npm',
      /* Un journal neuf à chaque fois : sinon la reprise relirait un verdict. */
      BATTERIE_JOURNAL: mkdtempSync(path.join(tmpdir(), 'journal-faux-')),
    },
  });
  if (resultat.error) throw resultat.error;
  return { code: resultat.status, texte: `${resultat.stdout}${resultat.stderr}` };
}

const toutVert = batterieAvec('  tout va bien', 0);
verifier('tout vert : la batterie rend zéro', toutVert.code, 0);

const codeNonNul = batterieAvec('✗ un essai qui échoue franchement', 1);
verifier('un essai rend un : la batterie rend un', codeNonNul.code, 1);

/*
   LE CAS QUI A TROMPÉ. Un essai qui écrit sa croix et rend zéro quand même.
   La batterie a un second juge pour cela — la croix en tête de ligne — et ce
   second juge doit atteindre le code de sortie, pas seulement l'affichage.
*/
const croixAvecZero = batterieAvec('✗ une croix, et pourtant un code nul', 0);
verifier('une croix avec un code nul : la batterie rend un', croixAvecZero.code, 1);

/*
   Et le récapitulatif reste entier : le code de sortie ne le remplace pas.
   Sans ce contrôle, un `exit(1)` posé AVANT l'affichage passerait les trois
   précédents en laissant la batterie muette.
*/
verifier(
  'le récapitulatif s’affiche malgré le rouge',
  /socle : \d+ verts ; \d+ rouges/.test(croixAvecZero.texte),
  true,
);
verifier('la liste des rouges est nommée', croixAvecZero.texte.includes('rouges : essais:'), true);

/*
   LE QUATRIÈME CAS : « NON MESURABLE », QUI N'EST NI VERT NI ROUGE.

   Deux essais du dépôt ne peuvent rien dire sans le corpus réel. Ils sortent
   avec `CODE_NON_MESURABLE` et sans croix, et la batterie les compte dans un
   troisième seau — voir `scripts/lib/non-mesurable.mjs`.

   Ce qui est gardé ici est la condition qu'Alexis a posée, et elle ne se lit
   pas dans la source : **un refus ne doit jamais grossir le compte des
   verts.** On fait donc tourner la batterie avec un faux `npm` qui rend ce
   code, et on lit ses trois nombres. Le socle de ce dépôt compte vingt-six
   essais, qui tous passent par le même faux `npm` : les vingt-six doivent
   donc se retrouver dans « non mesurables », et ZÉRO dans « verts ».

   Si quelqu'un ramenait `CODE_NON_MESURABLE` à zéro, les vingt-six
   deviendraient verts et la ligne « non mesurables » disparaîtrait : les deux
   contrôles ci-dessous rougiraient ensemble.

   LE CODE DE SORTIE EST ZÉRO, ET C'EST UN CHOIX. Rien n'est cassé : il n'y a
   pas de quoi arrêter une poussée, et faire rendre un à la batterie
   interdirait de pousser depuis tout conteneur sans corpus réel — c'est-à-dire
   presque toujours. Ce qui compte est que le verdict le DISE, fort, et il le
   dit : le compte à part, la liste nommée, et la phrase qui rappelle que
   ceux-là n'ont rien mesuré.
*/
/*
   LE CODE EST IMPORTÉ, ET NON RECOPIÉ — et la première version de ce bloc
   l'écrivait en dur. Le sabotage l'a dit : ramener `CODE_NON_MESURABLE` à zéro
   faisait rougir ces contrôles, mais pour la mauvaise raison — le faux « npm »
   rendait toujours 3, et c'était la batterie qui ne le reconnaissait plus. On
   éprouvait donc la batterie seule, jamais l'ACCORD entre elle et la constante
   dont les essais se servent. Importé, le zéro traverse les deux côtés, et le
   refus redevient vraiment un vert — ce qu'il ne doit jamais être.
*/
verifier(
  'le code du refus n’est ni celui du vert ni celui du rouge',
  CODE_NON_MESURABLE !== 0 && CODE_NON_MESURABLE !== 1,
  true,
);

const RAISON = 'le corpus réel : trois fiches au manifeste servi';
const nonMesurable = batterieAvec(`${INTITULE_NON_MESURABLE} ${RAISON}`, CODE_NON_MESURABLE);
verifier('un essai non mesurable : la batterie rend zéro', nonMesurable.code, 0);
verifier(
  'et le verdict les compte à part',
  /socle : 0 verts ; 0 rouges ; \d+ non mesurables/.test(nonMesurable.texte),
  true,
);
verifier(
  'et il les nomme',
  nonMesurable.texte.includes('non mesurables : essais:'),
  true,
);
verifier(
  'et il dit qu’ils n’ont rien mesuré',
  nonMesurable.texte.includes('n’ont RIEN mesuré'),
  true,
);
/*
   LA RAISON EST DITE DANS LE RÉCAPITULATIF, et non seulement le nom. Un nom
   oblige à ouvrir un journal ; une raison se lit sur place.
*/
verifier('et le récapitulatif porte la raison', nonMesurable.texte.includes(RAISON), true);

/*
   UN CODE 3 SANS LA LIGNE DE MARQUE COMPTE ROUGE.

   C'est la pièce qui empêche la convention de devenir une échappatoire : sans
   elle, un essai qui rendrait 3 par accident — un `process.exit` mal choisi, un
   outil tiers qui sort à 3 — disparaîtrait du compte en silence, et personne ne
   verrait qu'il ne mesure plus rien.
*/
const troisSansMarque = batterieAvec('  je rends trois sans rien annoncer', CODE_NON_MESURABLE);
verifier('un code 3 sans la ligne de marque : la batterie rend un', troisSansMarque.code, 1);
verifier(
  'et il n’est pas rangé parmi les non mesurables',
  /; \d+ non mesurables/.test(troisSansMarque.texte),
  false,
);

/*
   ET LA CROIX L'EMPORTE TOUJOURS. Un essai qui renonce ET affiche une croix a
   mesuré quelque chose qui cloche avant de renoncer : c'est un rouge, et le
   code 3 ne doit pas lui servir d'échappatoire.
*/
const refusAvecCroix = batterieAvec(
  `✗ quelque chose cloche\n${INTITULE_NON_MESURABLE} et en plus je renonce`,
  CODE_NON_MESURABLE,
);
verifier('un refus AVEC une croix reste un rouge', refusAvecCroix.code, 1);

/*
   LE REFUS AUSSI REND UN. Sans aperçu, la batterie refuse de commencer ; ce
   refus rendait déjà un avant ce travail, et il doit continuer — c'est le seul
   garde-fou de « on a construit, mais on a oublié de servir ».
*/
const sansApercu = (() => {
  const bac = mkdtempSync(path.join(tmpdir(), 'faux-npm-'));
  const faux = path.join(bac, 'npm');
  writeFileSync(faux, '#!/bin/sh\nexit 0\n');
  chmodSync(faux, 0o755);
  return spawnSync(process.execPath, [path.join(racine, 'scripts', 'batterie.mjs'), '--socle'], {
    cwd: racine,
    encoding: 'utf8',
    timeout: 120_000,
    env: {
      ...process.env,
      PATH: `${bac}:${process.env.PATH}`,
      /* Un port qui ne sert rien : 1 est réservé et ne répondra pas. */
      RACINE: 'http://127.0.0.1:1',
      SITE_PASSWORD: 'mot-de-passe-factice-du-faux-npm',
      BATTERIE_JOURNAL: mkdtempSync(path.join(tmpdir(), 'journal-faux-')),
    },
  });
})();
verifier('sans aperçu, le refus rend un', sansApercu.status, 1);

serveur.kill();

console.log(
  rouges === 0
    ? `\n${vert('✓')} le code de sortie de la batterie juge, et le récapitulatif reste entier.\n`
    : `\n${rouge('✗')} ${rouges} ${rouges === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(rouges > 0 ? 1 : 0);
