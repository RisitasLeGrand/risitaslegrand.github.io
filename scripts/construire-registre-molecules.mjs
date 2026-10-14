/**
 * Construit `content/sante/molecules.json` — le registre des noms du menu.
 *
 * ## Pourquoi ce script existe, et pourquoi il n'est pas lancé par le build
 *
 * La contrainte est explicite : « la liste de molécules présentée supra doit
 * apparaître dans le menu des molécules consommées ». Le reste du prompt
 * l'est tout autant : aucune partie de cette base n'est copiée dans le dépôt
 * public.
 *
 * Les deux tiennent ensemble parce que le registre est un fichier de
 * `content/`, que Git ignore comme tout le contenu, et que le build chiffre
 * dans le paquet publié. Les noms existent donc sur la machine de la personne
 * et dans un paquet chiffré qu'elle seule déchiffre — jamais en clair dans un
 * dépôt public.
 *
 * Ce script ne tourne pas tout seul, et c'est la seconde moitié de la même
 * idée : l'extraction est un geste, pas un effet de bord. Le build fonctionne
 * sans lui, le menu retombe sur le catalogue de Cyclades et le dit.
 *
 * ## Ce qu'il reprend, et ce qu'il jette
 *
 * **Les noms. Rien d'autre.** Ni catégorie, ni thème, ni lien, ni titre, ni
 * témoignage, ni pseudonyme, ni dose, ni compteur, ni l'ordre d'origine, ni
 * même l'information qu'un nom vient de là. Le tri est alphabétique, établi
 * ici : l'ordre de la source est lui-même une donnée, et un classement par
 * nombre de mentions serait une liste de popularité.
 *
 * ## Ce qu'il ne peut pas faire
 *
 * Confronter chaque nom à une nomenclature de référence. Le prompt le
 * demande, et c'est la bonne règle : la bibliothèque est une liste de
 * couverture, pas une source d'identité. Mais aucune nomenclature n'est
 * atteignable depuis une machine sans accès réseau sortant. Toute entrée naît
 * donc `identiteVerifiee: false`, le menu l'étiquette « identité non
 * vérifiée », et le compte est rendu à la fin. C'est une limite, pas un
 * oubli : quand une nomenclature sera accessible, ce script la branchera ici.
 *
 * ## Usage
 *
 *     node scripts/construire-registre-molecules.mjs <chemin-du-fichier-source>
 *
 * Le fichier source est la page de la bibliothèque, téléchargée **hors du
 * dépôt**, dans un dossier temporaire, et supprimée ensuite. Ce script ne
 * télécharge rien : lui donner l'adresse serait en faire un aspirateur, ce
 * que le prompt interdit.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error(
    'Usage : node scripts/construire-registre-molecules.mjs <chemin-du-fichier-source>\n\n' +
      'Le fichier source est la page de la bibliothèque, téléchargée à la main dans un\n' +
      'dossier temporaire hors du dépôt. Ce script ne télécharge rien.',
  );
  process.exit(2);
}
if (path.resolve(source).startsWith(path.resolve('.') + path.sep)) {
  console.error(
    `✗ « ${source} » est dans le dépôt. Le fichier source se lit hors du dépôt, et ne s’y\n` +
      '  copie jamais. Mets-le dans un dossier temporaire.',
  );
  process.exit(1);
}

const brut = await readFile(source, 'utf8');
const debut = brut.indexOf('<script type="application/json" id="data">');
if (debut === -1) {
  console.error('✗ Aucun bloc de données trouvé : le format de la page a changé.');
  process.exit(1);
}
const donnees = JSON.parse(brut.slice(brut.indexOf('>', debut) + 1, brut.indexOf('</script>', debut)));

const composes = donnees.compounds;
if (!Array.isArray(composes)) {
  console.error('✗ Le champ des composés a changé de forme : rien n’est écrit.');
  process.exit(1);
}

/** Le nom, et strictement le nom : le premier champ de chaque composé. */
const noms = composes
  .map((c) => (Array.isArray(c) ? c[0] : c?.name))
  .filter((n) => typeof n === 'string' && n.trim())
  .map((n) => n.trim());

/** Identifiant stable, dérivé du seul nom replié. Aucun indice d'origine. */
const idDe = (nom) =>
  nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const parId = new Map();
for (const nom of noms) {
  const id = idDe(nom);
  if (!id || parId.has(id)) continue;
  parId.set(id, {
    id,
    nom,
    alias: [],
    nomenclature: null,
    fiche: false,
    identiteVerifiee: false,
  });
}

const registre = [...parId.values()].sort((a, b) =>
  a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }),
);

const dossier = path.join('content', 'sante');
await mkdir(dossier, { recursive: true });
await writeFile(path.join(dossier, 'molecules.json'), JSON.stringify(registre, null, 2) + '\n');

console.log(`✓ content/sante/molecules.json écrit.

  noms lus dans la source        ${noms.length}
  entrées retenues (distinctes)  ${registre.length}
  identité vérifiée              0
  identité non vérifiée          ${registre.length}

Aucune nomenclature n’est atteignable depuis cette machine : toutes les entrées
sont étiquetées « identité non vérifiée » dans le menu. Ce n’est pas un défaut
du registre, c’est l’état de ce qui a pu être confronté.

Le fichier est ignoré par Git, comme tout « content/ ». Il sera chiffré dans le
paquet publié au prochain « npm run build ». Pense à supprimer le fichier source
temporaire.`);
