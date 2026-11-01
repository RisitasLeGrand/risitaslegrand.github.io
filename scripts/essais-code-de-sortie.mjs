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
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
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
   SANS « dist/index.html », CET ESSAI NE MESURE RIEN, et il le dit.

   Son aperçu factice en a besoin pour servir « / ». S'il manque, les trois cas
   ne tomberaient pas sur le code de sortie, qui est leur objet, mais sur le
   refus d'une batterie qui ne trouve pas de construction — trois croix qui
   accuseraient le code de sortie d'un défaut qu'il n'a pas. Non mesurable est
   la seule réponse vraie.
*/
if (!existsSync(path.join(racine, 'dist', 'index.html'))) {
  console.log(
    `${INTITULE_NON_MESURABLE} « dist/index.html » n’existe pas : l’aperçu factice\n` +
      '  n’a rien à servir sur « / ». Construisez avant de mesurer le code de sortie.',
  );
  process.exit(CODE_NON_MESURABLE);
}

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
/*
   ET IL SERT « / » AVEC LE VRAI « dist/index.html », parce que la batterie ne
   se contente plus d'un port qui répond : elle compare l'empreinte du fichier
   sur le disque à celle que l'aperçu rend, pour refuser de mesurer un site qui
   n'est pas celui de cet arbre.

   Quelques lignes de plus ici, et le décor redevient honnête. L'alternative
   était une échappatoire dans la batterie — une variable qui désarme le
   contrôle, que cet essai aurait posée — c'est-à-dire un chemin par lequel une
   vraie course peut passer au vert sans avoir rien mesuré. On ne désarme pas le
   contrôle qu'on garde : on donne au décor ce qui lui manquait.

   TROIS MODES, parce que les trois états que le contrôle distingue doivent
   exister pour qu'on puisse vérifier qu'il les distingue :

   - `fidele` sert la vraie page, et c'est le décor des trois cas d'origine ;
   - `etranger` sert une autre page dès le départ : l'aperçu d'un autre arbre ;
   - `change` sert la vraie page À LA PREMIÈRE demande de « / » et une autre
     ensuite. C'est l'arbre qui bascule EN COURS DE COURSE, c'est-à-dire la
     faute réelle, celle que le contrôle du départ seul ne peut pas voir ;
   - `meurt` sert la vraie page une fois, puis ferme. L'aperçu devient
     injoignable à l'arrivée sans que rien n'ait basculé — et c'est le cas qui a
     fait crier la garde à tort sur une course de dix-huit minutes entièrement
     verte, avant qu'elle ne distingue « injoignable » de « différent ».
*/
const PAGE = path.join(racine, 'dist', 'index.html');

async function apercuFactice(mode) {
  const serveur = spawn(
    process.execPath,
    [
      '-e',
      "const{createServer}=require('node:http');const{readFileSync}=require('node:fs');" +
        "const page=readFileSync(process.argv[1]);const mode=process.argv[2];let vues=0;" +
        "const autre=Buffer.from('<!doctype html><title>un autre arbre</title>');" +
        "const s=createServer((q,r)=>{" +
        "if(q.url==='/'){vues+=1;" +
        "const corps=mode==='etranger'||(mode==='change'&&vues>1)?autre:page;" +
        "r.writeHead(200,{'content-type':'text/html'});r.end(corps);" +
        "if(mode==='meurt'&&vues===1)setTimeout(()=>{try{s.closeAllConnections()}catch(e){}s.close()},50);" +
        "return}" +
        "r.writeHead(200,{'content-type':'text/plain'});r.end('User-agent: *\\n')});" +
        "s.listen(0,'127.0.0.1',()=>console.log(s.address().port))",
      PAGE,
      mode,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  process.once('exit', () => serveur.kill());

  const port = await new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(
      () => rejeter(new Error(`l’aperçu factice « ${mode} » n’a pas annoncé son port`)),
      20_000,
    );
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
  return `http://127.0.0.1:${port}`;
}

const adresse = await apercuFactice('fidele');

/* Et on vérifie qu'il répond VRAIMENT, avant d'en déduire quoi que ce soit. */
const repond = await fetch(`${adresse}/robots.txt`, { signal: AbortSignal.timeout(10_000) })
  .then((r) => r.ok)
  .catch(() => false);
verifier('l’aperçu factice répond avant la mesure', repond, true);

/**
 * Fait tourner la batterie contre un faux `npm` qui écrit `sortie` et rend
 * `code`, et renvoie le code que la BATTERIE rend.
 */
function batterieAvec(sortie, code, ou = adresse) {
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
      RACINE: ou,
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
  /socle : \d+ verts? ; \d+ rouges?/.test(croixAvecZero.texte),
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
  /socle : 0 vert ; 0 rouge ; \d+ non mesurables?/.test(nonMesurable.texte),
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

/*
   ── L'APERÇU DOIT SERVIR CET ARBRE-CI ─────────────────────────────────────

   Le refus ci-dessus garde « on a oublié de servir ». Il ne gardait pas « on
   sert, mais autre chose », qui est la faute coûteuse : elle laisse la batterie
   aller au bout et rendre un verdict d'apparence normale.

   Elle s'est produite. Un socle de treize minutes, l'arbre de travail passé sur
   une autre branche et « dist/ » reconstruit pendant la course : trente-huit
   essais sur le bon arbre, cinq sur un autre, et « cinq rouges » au
   récapitulatif, sans rien qui distingue les deux. Les cinq se lisaient comme
   des défauts du lot mesuré ; ils étaient mes propres ruines.
*/

const etranger = await apercuFactice('etranger');
const autreArbre = batterieAvec('  tout va bien', 0, etranger);
verifier('un aperçu qui sert un AUTRE arbre : la batterie refuse', autreArbre.code, 1);
verifier(
  'et elle dit lequel des deux manque',
  /ne sert pas le « dist\/ » de cet arbre/.test(autreArbre.texte),
  true,
);
/*
   ET ELLE REFUSE AVANT DE MESURER, ce qui est le but : un refus qui arrive
   après vingt minutes a déjà coûté les vingt minutes. Le récapitulatif est la
   preuve qu'une course a eu lieu — son absence, la preuve qu'il n'y en a pas eu.
*/
verifier(
  'et elle refuse AVANT de mesurer quoi que ce soit',
  /socle : \d+ verts?/.test(autreArbre.texte),
  false,
);

/*
   ET LA BASCULE EN COURS DE COURSE, qui est celle qui est arrivée. Le contrôle
   du départ ne peut pas la voir : au départ, tout était juste. Seule la reprise
   à l'arrivée la voit — et ce qu'elle doit produire n'est pas un rouge de plus,
   c'est l'annulation du verdict.
*/
const bascule = batterieAvec('  tout va bien', 0, await apercuFactice('change'));
verifier('l’arbre bascule en cours de course : la batterie rend un', bascule.code, 1);
verifier(
  'et elle annule la mesure au lieu de la rapporter',
  /MESURE NULLE/.test(bascule.texte),
  true,
);
/*
   LE CONTRÔLE QUI COMPTE VRAIMENT. Tout était vert : sans la reprise, cette
   course rendait zéro, et un « npm run socle && git push » poussait sur une
   mesure qui ne valait rien. C'est le même défaut que celui de ce fichier, un
   cran plus loin — un passage qui ne peut pas dire non ne garde rien.
*/
verifier('et sans elle, cette course rendait zéro', bascule.code !== 0, true);

/*
   ET LE CAS INVERSE, QUI EST CELUI QUI A COÛTÉ UNE COURSE : l'aperçu devient
   injoignable à l'arrivée, mais rien n'a basculé.

   La première version de la garde rendait `null` à la moindre défaillance, et
   un `null` ne vaut pas l'empreinte attendue : un seul `fetch` manqué annulait
   donc dix-huit minutes et 43 essais verts. Vérifié après coup — le disque
   inchangé depuis le début, le processus de l'aperçu vivant sans interruption,
   les deux côtés identiques à l'arrivée. Rien n'avait bougé.

   Une absence de preuve n'est pas une preuve du contraire. La garde le dit
   maintenant — FIN NON CONFIRMÉE — et laisse le verdict debout, parce que les
   essais, eux, ont bien tourné. C'est la distinction que ces trois contrôles
   gardent.
*/
const finMuette = batterieAvec('  tout va bien', 0, await apercuFactice('meurt'));
verifier('un aperçu injoignable à l’arrivée n’annule PAS la mesure', finMuette.code, 0);
verifier(
  'et la course est déclarée non confirmée, non pas nulle',
  /FIN NON CONFIRMÉE/.test(finMuette.texte),
  true,
);
verifier(
  'et surtout : elle ne se dit pas nulle',
  /MESURE NULLE/.test(finMuette.texte),
  false,
);

/*
   ENFIN : un verdict nul ne renvoie PAS au tableau des anomalies. Y envoyer
   quelqu'un avec des croix qui ne sont pas des rouges, c'est lui faire chercher
   des défauts qui n'existent pas, ou pire, en inscrire au tableau.
*/
const basculeAvecRouge = batterieAvec('✗ un essai qui échoue', 1, await apercuFactice('change'));
/*
   Et ce contrôle porte sur LES MOTS DU CONSEIL, non sur « tableau des
   anomalies » : le message de mesure nulle contient lui-même ces trois mots,
   pour dire de ne pas y aller. Première écriture, il les cherchait — il comptait
   donc ce qu'il décrivait, et tombait sur la phrase qui lui donne raison.
*/
verifier(
  'un verdict nul ne conseille pas de comparer au tableau',
  /un rouge NOUVEAU/.test(basculeAvecRouge.texte),
  false,
);
verifier(
  'et il dit à la place de ne rien y comparer',
  /Ne comparez rien au tableau des anomalies/.test(basculeAvecRouge.texte),
  true,
);


console.log(
  rouges === 0
    ? `\n${vert('✓')} le code de sortie de la batterie juge, et le récapitulatif reste entier.\n`
    : `\n${rouge('✗')} ${rouges} ${rouges === 1 ? 'contrôle' : 'contrôles'} en échec.\n`,
);
process.exit(rouges > 0 ? 1 : 0);
