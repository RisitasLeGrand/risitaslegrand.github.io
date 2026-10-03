#!/usr/bin/env node
/**
 * Essais de la publication de la rubrique Actualités.
 *
 *   npm run essais:publication
 *
 * Ces essais portent sur le garde-fou : ce qui empêche une actualité de partir
 * en clair sur GitHub Pages. Il sert maintenant deux appelants — « deploy.mjs »
 * et « publier-actualites.mjs » — et c'est la seule barrière entre un fichier
 * mal chiffré et sa mise en ligne. Elle mérite d'être éprouvée directement.
 *
 * Aucun accès au réseau, aucun mot de passe : tout se joue sur un dossier
 * temporaire et une paire de clés jetable.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { genererPaireActualites, chiffrerPourActualites, importerPubliqueActualites } from './lib/crypto.mjs';
import {
  ecrireInventaire,
  nomFichierInventaire,
  verifierActualitesChiffrees,
} from './lib/actualites-publication.mjs';

let reussis = 0;
let echoues = 0;
const muet = () => {};

function verifier(intitule, condition, detail = '') {
  if (condition) {
    reussis++;
    console.log(`  ✓ ${intitule}`);
  } else {
    echoues++;
    console.log(`  ✗ ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Attend que « bloc » lève une erreur dont le message contient « extrait ». */
async function verifierRefus(intitule, bloc, extrait) {
  try {
    await bloc();
    verifier(intitule, false, 'aucune erreur levée');
  } catch (erreur) {
    const message = String(erreur.message ?? erreur);
    verifier(intitule, message.includes(extrait), `message inattendu : ${message.split('\n')[0]}`);
  }
}

const paire = await genererPaireActualites();
const clePublique = await importerPubliqueActualites(paire.publique);

/** Prépare un dossier d'actualités jetable, avec sa clé publique. */
async function dossierJetable(entrees = {}) {
  const base = await mkdtemp(path.join(tmpdir(), 'essais-actualites-'));
  await writeFile(path.join(base, 'cle-publique.json'), JSON.stringify({ jwk: paire.publique }));
  for (const [chemin, contenu] of Object.entries(entrees)) {
    const complet = path.join(base, chemin);
    await mkdir(path.dirname(complet), { recursive: true });
    await writeFile(complet, contenu);
  }
  return base;
}

const chiffre = async (valeur) => JSON.stringify(await chiffrerPourActualites(clePublique, valeur));

console.log('\nGarde-fou : ce qui est refusé');

{
  const base = await dossierJetable({
    'semaines/abc123.json': JSON.stringify({ titre: 'Une actualité en clair' }),
  });
  await verifierRefus(
    'une entrée en clair est refusée',
    () => verifierActualitesChiffrees(base, muet),
    "n'est pas chiffré",
  );
  await rm(base, { recursive: true, force: true });
}

{
  const base = await dossierJetable({ 'semaines/abc123.json': 'ceci n’est pas du JSON' });
  await verifierRefus(
    'une entrée illisible est refusée',
    () => verifierActualitesChiffrees(base, muet),
    "n'est pas un JSON valide",
  );
  await rm(base, { recursive: true, force: true });
}

{
  // Une enveloppe amputée de sa clé : le cas d'un chiffrement interrompu.
  const enveloppe = JSON.parse(await chiffre({ titre: 'x' }));
  delete enveloppe.cle;
  const base = await dossierJetable({ 'semaines/abc123.json': JSON.stringify(enveloppe) });
  await verifierRefus(
    'une enveloppe incomplète est refusée',
    () => verifierActualitesChiffrees(base, muet),
    "n'est pas chiffré",
  );
  await rm(base, { recursive: true, force: true });
}

console.log('\nGarde-fou : ce qui est accepté');

{
  const base = await dossierJetable({
    'semaines/aaa.json': await chiffre({ titre: 'Semaine' }),
    'semaines/bbb.json': await chiffre({ titre: 'Autre semaine' }),
    'mois/ccc.json': await chiffre({ titre: 'Mois' }),
  });
  const inventaire = await verifierActualitesChiffrees(base, muet);
  verifier('les trois entrées chiffrées passent', inventaire !== null);
  verifier(
    'l\'inventaire recense les semaines',
    JSON.stringify(inventaire?.semaines?.slice().sort()) === JSON.stringify(['aaa', 'bbb']),
    JSON.stringify(inventaire?.semaines),
  );
  verifier(
    'l\'inventaire recense les mois',
    JSON.stringify(inventaire?.mois) === JSON.stringify(['ccc']),
    JSON.stringify(inventaire?.mois),
  );
  verifier(
    'la clé publique n\'est pas comptée comme une entrée',
    !Object.values(inventaire ?? {}).flat().includes('cle-publique'),
  );
  await rm(base, { recursive: true, force: true });
}

{
  const base = await mkdtemp(path.join(tmpdir(), 'essais-actualites-'));
  verifier('un dossier absent ne lève pas', (await verifierActualitesChiffrees(path.join(base, 'nulle-part'), muet)) === null);
  await rm(base, { recursive: true, force: true });
}

console.log('\nInventaire');

{
  const nom = await nomFichierInventaire();
  verifier('le nom de l\'inventaire est stable', nom === (await nomFichierInventaire()));
  verifier('le nom de l\'inventaire est une empreinte, pas un mot', /^[0-9a-f]{16}\.json$/.test(nom), nom);
}

{
  const base = await dossierJetable({ 'semaines/aaa.json': await chiffre({ titre: 'Semaine' }) });
  const inventaire = await verifierActualitesChiffrees(base, muet);
  await ecrireInventaire(base, inventaire, muet);

  const ecrit = JSON.parse(await readFile(path.join(base, await nomFichierInventaire()), 'utf8'));
  verifier(
    'l\'inventaire écrit est une enveloppe chiffrée',
    Boolean(ecrit.ct && ecrit.cle && ecrit.iv),
  );
  verifier(
    'l\'inventaire ne laisse voir aucun identifiant de période',
    !JSON.stringify(ecrit).includes('semaines'),
  );

  // Propriété qui compte : l'inventaire étant posé dans le dossier publié, il
  // doit lui-même passer le garde-fou. Sinon « deploy.mjs » publierait un
  // fichier que sa propre vérification refuserait.
  const second = await verifierActualitesChiffrees(base, muet);
  verifier('l\'inventaire écrit passe lui-même la vérification', second !== null);

  await rm(base, { recursive: true, force: true });
}

{
  const base = await mkdtemp(path.join(tmpdir(), 'essais-actualites-'));
  await mkdir(path.join(base, 'semaines'), { recursive: true });
  await writeFile(path.join(base, 'semaines/aaa.json'), await chiffre({ titre: 'Semaine' }));
  const inventaire = await verifierActualitesChiffrees(base, muet);
  await ecrireInventaire(base, inventaire, muet);
  verifier(
    'sans clé publique, aucun inventaire n\'est écrit',
    !(await readFile(path.join(base, await nomFichierInventaire()), 'utf8').catch(() => null)),
  );
  await rm(base, { recursive: true, force: true });
}

console.log(`\n${echoues ? '✗' : '✓'} ${reussis} essai(s) réussi(s), ${echoues} échec(s)\n`);
process.exit(echoues ? 1 : 0);
