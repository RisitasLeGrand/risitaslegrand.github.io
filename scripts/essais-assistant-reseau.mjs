/**
 * La preuve que le module d'assistance n'envoie rien, et ne sait rien.
 *
 * Deux invariants, et ni l'un ni l'autre ne se voit à l'usage : un module qui
 * enverrait discrètement un prompt à un service tiers fonctionnerait
 * exactement comme celui-ci, et un module qui laisserait fuir le mot de passe
 * dans un prompt n'échouerait sur aucun écran.
 *
 *  1. **Aucun appel réseau.** On parcourt la clôture des imports à partir des
 *     points d'entrée du module et l'on échoue sur `fetch(`,
 *     `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket` ou un
 *     `import()` d'URL. Le seul lien vers l'extérieur est une chaîne
 *     `https://claude.ai/new?q=…` **rendue** à l'interface, qui en fait un
 *     `href` : c'est le navigateur qui l'ouvre, sur un geste de la personne.
 *
 *  2. **Aucun accès au secret.** La garantie n'est pas un filtre de chaînes —
 *     qui se contournerait au premier champ ajouté — mais le fait que la
 *     clôture des imports ne contienne ni `lib/secret`, ni `lib/crypto`, ni
 *     `chargerParametresCle`. Le module ne peut pas atteindre le mot de passe,
 *     la clé dérivée, le sel ni les paramètres de dérivation : il n'en connaît
 *     pas le chemin.
 *
 * Le parcours s'arrête aux fichiers du dépôt : une dépendance de `node_modules`
 * n'est pas lue, et c'est assumé — `idb` ouvre IndexedDB, `svelte` rend des
 * composants, et aucune n'est atteinte depuis ce module autrement que par ces
 * usages, que la revue de code couvre et qu'un balayage de texte ne saurait
 * pas distinguer.
 */
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const racine = path.resolve(import.meta.dirname, '..');
const DEPARTS = [
  'src/features/assistant/prompt.ts',
  'src/features/assistant/contexte.ts',
  'src/features/assistant/fournisseurs.ts',
  'src/features/assistant/blocs-en-mots.ts',
  'src/features/assistant/livraison.ts',
  'src/features/assistant/reglages.ts',
  'src/features/assistant/monter.ts',
  'src/features/assistant/composants/DemanderALIA.svelte',
];

/** Les appels qui feraient du module un client réseau. */
const RESEAU = [
  { motif: /\bfetch\s*\(/, nom: 'fetch(' },
  { motif: /\bXMLHttpRequest\b/, nom: 'XMLHttpRequest' },
  { motif: /\bsendBeacon\s*\(/, nom: 'navigator.sendBeacon(' },
  { motif: /\bnew\s+EventSource\b/, nom: 'EventSource' },
  { motif: /\bnew\s+WebSocket\b/, nom: 'WebSocket' },
  { motif: /\bimport\s*\(\s*['"`]https?:/, nom: 'import() d’une URL' },
];

/** Les modules qui connaissent le secret, et qui doivent rester hors d'atteinte. */
const SECRETS = [
  'lib/secret',
  'lib/crypto',
  'chargerParametresCle',
  'deriverCle',
  'dechiffrer',
  'SITE_PASSWORD',
];

function resoudre(depuis, specificateur) {
  if (!specificateur.startsWith('.')) return null;
  const base = path.resolve(path.dirname(depuis), specificateur);
  const candidats = [
    base,
    `${base}.ts`,
    `${base}.svelte`,
    `${base}.mjs`,
    `${base}.js`,
    path.join(base, 'index.ts'),
  ];
  return (
    candidats.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
  );
}

/*
 * Les imports suivis sont ceux qui existent **à l'exécution**.
 *
 * `import type { Fiche } from '../../lib/contenu'` est effacé à la
 * compilation : le module n'en tire aucune ligne de code, et suivre cette
 * arête ferait croire qu'il atteint tout ce que `contenu.ts` atteint — c'est-
 * à-dire le déchiffrement, donc le secret. La distinction n'est pas une
 * commodité d'essai : c'est exactement ce qui fait que le module ne peut pas
 * atteindre le secret, puisqu'il n'en importe que la forme.
 */
const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;\n]*?from\s*['"]([^'"]+)['"]/g;

/**
 * Le code sans ses commentaires.
 *
 * Indispensable, et la première version l'avait oublié : ce fichier lui-même
 * explique qu'il cherche « XMLHttpRequest », et les modules d'assistance
 * expliquent dans leur en-tête qu'ils n'importent ni `lib/secret` ni
 * `lib/crypto`. Chercher dans le texte entier faisait donc échouer l'essai sur
 * les phrases écrites pour dire que la chose n'arrive pas — un faux positif
 * qui aurait fini par faire désactiver l'essai, c'est-à-dire par supprimer la
 * garantie plutôt que le bruit.
 */
function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

const vus = new Set();
const defauts = [];

async function parcourir(fichier) {
  if (vus.has(fichier)) return;
  vus.add(fichier);
  const brut = await readFile(fichier, 'utf8');
  const source = sansCommentaires(brut);
  const relatif = path.relative(racine, fichier);

  for (const { motif, nom } of RESEAU) {
    if (motif.test(source)) defauts.push(`${relatif} : appel réseau « ${nom} »`);
  }
  for (const mot of SECRETS) {
    if (source.includes(mot)) defauts.push(`${relatif} : atteint le secret par « ${mot} »`);
  }

  for (const trouve of source.matchAll(IMPORT)) {
    const cible = resoudre(fichier, trouve[1]);
    if (cible) await parcourir(cible);
  }
}

for (const depart of DEPARTS) await parcourir(path.join(racine, depart));

console.log(`\x1b[90m${vus.size} fichier(s) parcouru(s) depuis les points d'entrée du module.\x1b[0m`);

/*
 * Un garde-fou sur le garde-fou.
 *
 * Si la résolution des imports cessait de fonctionner — une extension
 * nouvelle, un alias —, le parcours s'arrêterait aux points de départ et
 * l'essai passerait en ne vérifiant presque rien. On exige donc qu'il ait
 * franchi au moins une frontière de dossier, et l'on nomme le fichier :
 * `src/lib/db.ts`, que le module atteint pour enregistrer une demande d'aide.
 * Un seuil en nombre de fichiers aurait été arbitraire, et aurait cassé au
 * premier module retiré.
 */
const TEMOIN = path.join(racine, 'src/lib/db.ts');
if (!vus.has(TEMOIN)) {
  defauts.push(
    'le parcours n\'a pas atteint « src/lib/db.ts » : la résolution des imports est cassée, ' +
      'et l\'essai ne vérifie plus rien',
  );
}

if (defauts.length) {
  console.log(`\x1b[31m✗ ${defauts.length} défaut(s) :\x1b[0m`);
  for (const d of defauts) console.log(`    ${d}`);
  process.exit(1);
}
console.log('\x1b[32m✓ Aucun appel réseau, aucun accès au secret.\x1b[0m\n');
