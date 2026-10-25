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
