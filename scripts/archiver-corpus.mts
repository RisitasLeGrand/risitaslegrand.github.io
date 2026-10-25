/**
 * ARCHIVER LE CORPUS, chiffré, pour qu'il ne dépende plus d'un seul conteneur.
 *
 *   MDP=… npm run archiver:corpus -- --depuis <dossier> --vers <dossier> --mot-de-passe-env MDP
 *   MDP=… npm run archiver:corpus -- --verifier <dossier> --vers <dossier> --mot-de-passe-env MDP
 *
 * Même schéma que le site : PBKDF2-SHA256 à 600 000 itérations, sel tiré au
 * sort, AES-GCM. L'archive est découpée en morceaux de moins de 50 Mo, et un
 * `MANIFEST-SHA256.txt` porte l'empreinte du clair ET de chaque morceau — sans
 * quoi une archive tronquée ne se distinguerait d'une archive intacte qu'au
 * moment de s'en servir, c'est-à-dire trop tard.
 *
 * ## Ce que cette archive protège, et ce qu'elle ne protège pas
 *
 * Elle protège contre la PERTE : un conteneur éphémère, un dossier effacé.
 * C'est pour cela qu'elle existe, et elle le fait bien.
 *
 * Elle ne protège pas contre la LECTURE par qui tient le fichier chiffré, si
 * le mot de passe est court. 600 000 itérations multiplient le coût d'un essai,
 * elles ne multiplient pas le nombre d'essais à faire : un mot de passe de cinq
 * caractères se retrouve en quelques heures de calcul, quelle que soit la
 * fonction de dérivation. Ranger cette archive dans un dépôt public revient
 * donc à publier le corpus en clair à échéance, et ce choix doit être fait en
 * le sachant. Le mode `--verifier` est là pour qu'on puisse au moins prouver
 * qu'une archive se rouvre avant de se fier à elle.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { deriverCle, selAleatoire, b64 } from './lib/crypto.mjs';
import { b64VersOctets } from './lib/secret.mjs';
import { estDansLeDepot } from './lib/fichier-de-secret.mjs';

/* La racine du dépôt, pour refuser un fichier de mot de passe situé dedans. */
const RACINE = path.resolve(import.meta.dirname, '..');

const ITERATIONS = 600_000;
const TAILLE_MORCEAU = 45 * 1024 * 1024;
const TAILLE_IV = 12;

const sha256 = (octets: Uint8Array) => createHash('sha256').update(octets).digest('hex');

function lireArguments(argv: string[]) {
  const o: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const suivant = argv[i + 1];
    if (suivant && !suivant.startsWith('--')) o[argv[i].slice(2)] = suivant;
    else o[argv[i].slice(2)] = true;
  }
  return o;
}

/**
 * Le mot de passe, par l'environnement ou par un fichier hors du dépôt.
 *
 * ## Deux voies, et ce qu'elles valent vraiment
 *
 * `--mot-de-passe-env` lit une variable d'environnement. `--mot-de-passe-fichier`
 * lit la première ligne d'un fichier, qui doit être **hors du dépôt** — l'outil
 * refuse un chemin situé dedans, pour qu'un secret ne puisse pas se retrouver
 * à un « git add . » de la publication.
 *
 * Les deux écartent le pire cas, l'argument de commande, que `ps` donne à
 * n'importe quel autre processus de la machine. Entre elles, la différence est
 * mince et il faut le dire plutôt que de laisser croire à un gain : un fichier
 * survit à la commande et demande d'être effacé, une variable disparaît avec le
 * shell mais se lit dans `/proc` le temps de l'exécution. Le fichier vaut mieux
 * quand la commande est tapée à la main, parce que rien du secret n'apparaît
 * dans la ligne ni dans l'historique du shell.
 */
function motDePasse(o: Record<string, string | boolean>): string {
  const chemin = o['mot-de-passe-fichier'];
  if (typeof chemin === 'string') {
    const abs = path.resolve(chemin);
    /* La règle vit dans `lib/fichier-de-secret.mjs` : l'outil de récupération
       la porte aussi, et une règle de sécurité recopiée finit par différer
       d'un outil à l'autre. `essais:recuperation-invariants` l'éprouve. */
    if (estDansLeDepot(abs)) {
      console.error(
        `« ${abs} » est dans le dépôt.\n` +
          '  Un fichier de mot de passe n’y a pas sa place : il serait à un « git add . »\n' +
          '  de devenir public. Rangez-le ailleurs.',
      );
      process.exit(2);
    }
    if (!existsSync(abs)) {
      console.error(`« ${abs} » n’existe pas.`);
      process.exit(2);
    }
    /* La première ligne, sans son retour : un éditeur en ajoute un, et un mot
       de passe avec un retour à la fin n'ouvre rien. */
    const valeur = readFileSync(abs, 'utf8').split(/\r?\n/)[0];
    if (!valeur) {
      console.error(`« ${abs} » est vide, ou sa première ligne l’est.`);
      process.exit(2);
    }
    return valeur;
  }

  const nomVariable = o['mot-de-passe-env'];
  if (typeof nomVariable !== 'string') {
    console.error(
      'Il manque --mot-de-passe-env <VARIABLE> ou --mot-de-passe-fichier <chemin hors dépôt>.\n' +
        '  Jamais en argument de commande : « ps » le donnerait à tout processus de la machine.',
    );
    process.exit(2);
  }
  const valeur = process.env[nomVariable];
  if (!valeur) {
    console.error(`La variable d’environnement « ${nomVariable} » est vide ou absente.`);
    process.exit(2);
  }
  return valeur;
}

/** Le dossier, en une archive tar gzippée, sans jamais passer par le disque. */
function empaqueter(dossier: string, exclure: string[]): Uint8Array {
  const parent = path.dirname(path.resolve(dossier));
  const nom = path.basename(path.resolve(dossier));
  const args = ['czf', '-', ...exclure.flatMap((e) => ['--exclude', e]), '-C', parent, nom];
  return new Uint8Array(
    execFileSync('tar', args, { maxBuffer: 2 * 1024 * 1024 * 1024 }) as unknown as Buffer,
  );
}

async function archiver(o: Record<string, string | boolean>) {
  const depuis = String(o.depuis);
  const vers = String(o.vers);
  if (!existsSync(depuis)) {
    console.error(`« ${depuis} » n’existe pas.`);
    process.exit(2);
  }
  const mdp = motDePasse(o);

  /* L'audio est DÉJÀ chiffré dans la publication : le réarchiver doublerait
     400 Mo pour rien. On le dit dans le manifeste plutôt que de le recopier. */
  const exclure = o['avec-audio'] ? [] : ['.audio'];

  console.error(`Empaquetage de ${depuis}${exclure.length ? ' (sans .audio)' : ''}…`);
  const clair = empaqueter(depuis, exclure);
  const empreinteClair = sha256(clair);
  console.error(`  ${(clair.byteLength / 1048576).toFixed(1)} Mo — sha256 ${empreinteClair}`);

  const sel = selAleatoire(16);
  const cle = await deriverCle(mdp, sel, ITERATIONS, 256);
  const iv = selAleatoire(TAILLE_IV);
  const chiffre = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, clair),
  );

  await mkdir(vers, { recursive: true });
  const morceaux: { nom: string; octets: number; sha256: string }[] = [];
  for (let i = 0, n = 0; i < chiffre.byteLength; i += TAILLE_MORCEAU, n++) {
    const bloc = chiffre.subarray(i, Math.min(i + TAILLE_MORCEAU, chiffre.byteLength));
    const nom = `corpus.aes.${String(n).padStart(3, '0')}`;
    await writeFile(path.join(vers, nom), bloc);
    morceaux.push({ nom, octets: bloc.byteLength, sha256: sha256(bloc) });
  }

  await writeFile(
    path.join(vers, 'ENTETE.json'),
    JSON.stringify(
      {
        v: 1,
        kdf: 'PBKDF2-SHA256',
        iterations: ITERATIONS,
        sel: b64(sel),
        chiffrement: 'AES-GCM',
        iv: b64(iv),
        contenu: 'tar.gz',
        octetsClair: clair.byteLength,
        sha256Clair: empreinteClair,
        morceaux: morceaux.map((m) => m.nom),
        audioInclus: Boolean(o['avec-audio']),
      },
      null,
      2,
    ) + '\n',
  );

  /*
     LE LISEZMOI, ET POURQUOI IL COMMENCE PAR CE QUE L'ARCHIVE NE FAIT PAS.

     Une archive chiffrée dans un dépôt public donne une impression de
     protection. Elle protège contre la PERTE, ce pour quoi elle existe, et
     c'est déjà beaucoup. Elle ne protège pas contre la LECTURE tant que le mot
     de passe est court, et quelqu'un qui ouvrira ce dossier dans un an doit
     lire cette phrase avant toute autre.
  */
  await writeFile(
    path.join(vers, 'LISEZMOI.md'),
    [
      '# Archive chiffrée du corpus Cyclades',
      '',
      `Produite le ${new Date().toISOString().slice(0, 10)}.`,
      '',
      '## Ce qu’elle protège, et ce qu’elle ne protège pas',
      '',
      'Elle protège contre la **perte** : un conteneur éphémère, un dossier effacé.',
      'C’est pour cela qu’elle existe, et elle le fait.',
      '',
      'Elle **ne protège pas contre la lecture** par qui tient ces fichiers, tant que',
      'le mot de passe du site reste court. PBKDF2 à 600 000 itérations multiplie le',
      'coût d’UN essai ; il ne multiplie pas le NOMBRE d’essais à faire. Un mot de',
      'passe de cinq caractères se retrouve en quelques heures de calcul, quelle que',
      'soit la fonction de dérivation. Ce dépôt étant public, cette archive doit donc',
      'être tenue pour **lisible à échéance** aussi longtemps que le mot de passe n’a',
      'pas changé — exactement comme le contenu déjà publié sur `gh-pages`, qui est',
      'chiffré avec le même secret.',
      '',
      '**À la fin du chantier, le mot de passe sera changé et cette archive devra être',
      'rechiffrée.** Tant que ce n’est pas fait, la phrase ci-dessus reste vraie.',
      '',
      '## Ce qu’elle contient',
      '',
      `- \`content/\` en entier : les fiches, le glossaire, les annexes déchiffrées.`,
      '- Le rapport de récupération, qui dit fiche par fiche ce qui est revenu',
      '  identique, transformé ou perdu.',
      '',
      '## Ce qu’elle ne contient pas, et comment le retrouver',
      '',
      ...(o['avec-audio']
        ? []
        : [
            '**Les fiches audio.** Elles sont déjà chiffrées dans la publication, sous',
            '`data/audio/<id>.enc`, et pèsent plus de 400 Mo : les recopier ici doublerait',
            'la même chose. Pour les reprendre :',
            '',
            '```',
            'npm run recuperer:corpus -- --git <ref> --vers <dossier hors dépôt>',
            '```',
            '',
            'Elles sont déposées dans `content/.audio/<id>.<format>`, où le build les',
            'cherche.',
            '',
          ]),
      '**`sources/`** — les documents de la collecte. Ils ne sont pas ici non plus :',
      'ils sont publiés dans un artefact que le propriétaire du projet détient, et',
      'cet artefact est leur copie durable. Les reconstituer demande de recoller les',
      'morceaux `.morceauN.pdf` dans l’ordre avec `cat`, puis de vérifier chaque',
      'archive contre son empreinte et chaque fichier contre le `MANIFEST-SHA256.txt`',
      'qu’elle contient.',
      '',
      '## Comment l’ouvrir',
      '',
      '```',
      'cat corpus.aes.* > corpus.aes',
      'MDP=… npm run archiver:corpus -- --verifier <ce dossier> --vers <contrôle> \\',
      '  --mot-de-passe-env MDP',
      '```',
      '',
      'Le mode `--verifier` recolle les morceaux, contrôle chaque empreinte, déchiffre,',
      'compare l’empreinte du clair, **puis déballe pour de vrai** et compte les fiches.',
      'Une archive qu’on n’a pas rouverte n’est pas une sauvegarde : c’est un fichier',
      'dont on espère quelque chose.',
      '',
      '## Les identifiants de fiche',
      '',
      'Quarante-neuf fiches portent un champ `id_publie` dans leur front-matter. Ce',
      'n’est pas décoratif : leur chemin d’origine n’a pas pu être certifié lors de la',
      'récupération, et sans ce champ elles recevraient un identifiant neuf au',
      'prochain build — orphelinant la progression enregistrée pour elles et leur',
      'fiche audio. Le build doit donc connaître ce champ ; il est documenté dans',
      '`scripts/lib/schema.mjs`.',
      '',
    ].join('\n'),
  );

  await writeFile(
    path.join(vers, 'MANIFEST-SHA256.txt'),
    [
      '# Empreintes de l’archive du corpus.',
      '#',
      '# Le CLAIR est l’archive tar.gz avant chiffrement : c’est lui qu’il faut',
      '# retrouver après déchiffrement. Les MORCEAUX se recollent dans l’ordre',
      '# (cat corpus.aes.* > corpus.aes) avant de déchiffrer.',
      '#',
      ...(o['avec-audio']
        ? []
        : [
            '# LES FICHES AUDIO NE SONT PAS DANS CETTE ARCHIVE. Elles sont déjà chiffrées',
            '# dans la publication, sous « data/audio/<id>.enc », et se reprennent avec :',
            '#   npm run recuperer:corpus -- --git <ref> --vers <dossier>',
            '# qui les déchiffre et les repose dans « content/.audio/<id>.<format> ».',
            '#',
          ]),
      `clair  ${empreinteClair}  ${clair.byteLength} octets`,
      ...morceaux.map((m) => `morceau ${m.sha256}  ${m.octets} octets  ${m.nom}`),
      '',
    ].join('\n'),
  );

  console.error(
    `\nArchive écrite dans ${vers} — ${morceaux.length} morceau(x).\n` +
      `  Vérifiez-la AVANT de vous y fier :\n` +
      /* Le rappel reprend la voie que l'appelant vient d'employer. La première
         version citait toujours la variable d'environnement, et affichait donc
         « undefined » — une commande à recopier qui ne marche pas. */
      (typeof o['mot-de-passe-fichier'] === 'string'
        ? `    npm run archiver:corpus -- --verifier ${vers} --vers <dossier-de-contrôle> ` +
          `--mot-de-passe-fichier ${o['mot-de-passe-fichier']}\n`
        : `    ${String(o['mot-de-passe-env'])}=… npm run archiver:corpus -- --verifier ${vers} ` +
          `--vers <dossier-de-contrôle> --mot-de-passe-env ${String(o['mot-de-passe-env'])}\n`),
  );
}

/**
 * Rouvre une archive et prouve qu'elle redonne le clair annoncé.
 *
 * Une archive qu'on n'a pas rouverte n'est pas une sauvegarde : c'est un
 * fichier dont on espère quelque chose. Ce mode recolle les morceaux, vérifie
 * chaque empreinte, déchiffre, compare l'empreinte du clair, puis déballe
 * réellement et compte les fiches.
 */
async function verifier(o: Record<string, string | boolean>) {
  const dossier = String(o.verifier);
  const vers = String(o.vers);
  const mdp = motDePasse(o);

  const entete = JSON.parse(readFileSync(path.join(dossier, 'ENTETE.json'), 'utf8'));
  let rouges = 0;
  const v = (quoi: string, vrai: boolean, detail = '') => {
    console.error(`  ${vrai ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${quoi}${detail ? ` — ${detail}` : ''}`);
    if (!vrai) rouges += 1;
  };

  const attendus: Map<string, string> = new Map();
  for (const ligne of readFileSync(path.join(dossier, 'MANIFEST-SHA256.txt'), 'utf8').split('\n')) {
    const m = /^morceau ([0-9a-f]{64})\s+\d+ octets\s+(\S+)$/.exec(ligne.trim());
    if (m) attendus.set(m[2], m[1]);
  }

  const blocs: Uint8Array[] = [];
  for (const nom of entete.morceaux as string[]) {
    const octets = new Uint8Array(readFileSync(path.join(dossier, nom)));
    v(`morceau ${nom} conforme au manifeste`, sha256(octets) === attendus.get(nom));
    blocs.push(octets);
  }

  const chiffre = new Uint8Array(blocs.reduce((n, b) => n + b.byteLength, 0));
  let pos = 0;
  for (const b of blocs) {
    chiffre.set(b, pos);
    pos += b.byteLength;
  }

  const cle = await deriverCle(mdp, b64VersOctets(entete.sel), entete.iterations, 256);
  let clair: Uint8Array;
  try {
    clair = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64VersOctets(entete.iv) },
        cle,
        chiffre,
      ),
    );
  } catch {
    console.error('\n\x1b[31mL’archive ne s’ouvre pas : mot de passe refusé ou archive abîmée.\x1b[0m\n');
    process.exit(1);
  }
  v('l’archive s’ouvre', true);
  v(
    'le clair a l’empreinte annoncée',
    sha256(clair) === entete.sha256Clair,
    `${sha256(clair).slice(0, 16)}… contre ${String(entete.sha256Clair).slice(0, 16)}…`,
  );
  v('et la taille annoncée', clair.byteLength === entete.octetsClair);

  /* Déballer pour de vrai : une empreinte juste sur une archive tar illisible
     se verrait au pire moment, celui où on en a besoin. */
  await mkdir(vers, { recursive: true });
  const tar = path.join(vers, 'corpus.tar.gz');
  await writeFile(tar, clair);
  execFileSync('tar', ['xzf', tar, '-C', vers]);
  const compter = (d: string): number =>
    readdirSync(d, { withFileTypes: true }).reduce(
      (n, e) =>
        n +
        (e.isDirectory()
          ? compter(path.join(d, e.name))
          : e.name.endsWith('.md') && !e.name.endsWith('.podcast.md')
            ? 1
            : 0),
      0,
    );
  const fiches = compter(vers);
  v(`le déballage rend des fiches`, fiches > 0, `${fiches} fiche(s)`);
  console.error(
    rouges === 0
      ? `\n\x1b[32mArchive vérifiée : ${fiches} fiches rouvertes depuis le chiffré.\x1b[0m\n`
      : `\n\x1b[31m${rouges} contrôle(s) en échec.\x1b[0m\n`,
  );
  process.exit(rouges === 0 ? 0 : 1);
}

const o = lireArguments(process.argv.slice(2));
if (o.verifier) await verifier(o);
else if (o.depuis && o.vers) await archiver(o);
else {
  console.error(
    'Emploi :\n' +
      '  MDP=… npm run archiver:corpus -- --depuis <dossier> --vers <dossier> --mot-de-passe-env MDP\n' +
      '  MDP=… npm run archiver:corpus -- --verifier <dossier> --vers <contrôle> --mot-de-passe-env MDP\n',
  );
  process.exit(2);
}
