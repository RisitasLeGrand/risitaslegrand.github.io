/**
 * Pose, une fois pour toutes, l'identifiant de chaque partie de fiche.
 *
 *   npm run parties:identifiants           (écrit)
 *   npm run parties:identifiants -- --voir (montre, n'écrit rien)
 *
 * ## Ce qu'il fait, et pourquoi une seule fois
 *
 * Chaque titre de niveau 2 ou 3 du « Cours complet » devient une partie
 * (prompt 46, décision 2). Son identifiant est écrit **à côté du titre**,
 * sous la forme `{#identifiant}` :
 *
 *     ### I. Les contraintes de l'adaptation {#i-les-contraintes-de-l-adaptation}
 *
 * L'identifiant posé est **l'ancre actuelle** du titre, celle que le site
 * sert déjà. C'est le seul choix qui ne casse rien : tous les liens
 * existants — corrections de QCM, favoris, signets — continuent de tomber
 * au bon endroit, et le jour où le titre sera corrigé, l'identifiant, lui,
 * ne bougera plus.
 *
 * Le script est **idempotent** : un titre qui porte déjà un identifiant est
 * laissé tel quel. Il ne touche que `content/`, qui n'est jamais commité —
 * le contenu des fiches ne sort pas de la machine.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne renomme aucun identifiant déjà posé, et n'en invente pas de plus
 * jolis : un identifiant qui change est exactement le défaut que tout ceci
 * existe pour empêcher.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decouperSections, extraireParties, extraireSommaire, rendreHtml } from './lib/markdown.mjs';

const RACINE = 'content';
const SUFFIXE_SCRIPT = '.podcast.md';
const voir = process.argv.includes('--voir');

/** Toutes les fiches, scripts parlés exclus — comme le fait le build. */
async function fiches(dossier = RACINE) {
  const sortie = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) sortie.push(...(await fiches(chemin)));
    else if (entree.isFile() && entree.name.endsWith('.md') && !entree.name.endsWith(SUFFIXE_SCRIPT))
      sortie.push(chemin);
  }
  return sortie.sort();
}

let fichiersTouches = 0;
let titresPoses = 0;
let dejaPoses = 0;

for (const chemin of await fiches()) {
  const source = await readFile(chemin, 'utf8');
  const corps = source.replace(/^---\n[\s\S]*?\n---\n/, '');
  const { sections } = decouperSections(corps);
  if (!sections.cours?.trim()) continue;

  const { markdown: propre, parties } = extraireParties(sections.cours);
  if (parties.length === 0) continue;

  /* Les ancres telles que le site les sert aujourd'hui. On les relit dans le
     HTML rendu, parce que c'est lui qui fait foi : les reconstruire à la main
     reviendrait à réécrire `rehype-slug`, et à s'en écarter un jour. */
  const ancres = extraireSommaire(rendreHtml(propre, new Map())).map((s) => s.id);
  if (ancres.length !== parties.length) {
    console.error(
      `! ${chemin} : ${parties.length} titre(s) relevé(s) dans le Markdown mais ${ancres.length} ` +
        'dans le HTML rendu. Fichier laissé tel quel.',
    );
    continue;
  }

  let i = -1;
  let dansBlocCode = false;
  let change = false;
  const lignes = source.split(/\r?\n/);
  /* On ne numérote les titres que dans la section « Cours complet » : un
     titre de la fiche simplifiée n'est pas une partie. */
  let dansLeCours = false;

  const sortie = lignes.map((ligne) => {
    if (/^\s*(```|~~~)/.test(ligne)) dansBlocCode = !dansBlocCode;
    if (dansBlocCode) return ligne;
    const section = /^##\s+(.+?)\s*$/.exec(ligne);
    if (section) {
      const nom = section[1]
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
      if (nom === 'cours complet' || nom === 'cours') {
        dansLeCours = true;
        return ligne;
      }
      if (['fiche simplifiee', 'fiche de synthese', 'flashcards', 'quiz', 'qcm', 'pretest', 'pre-test'].includes(nom)) {
        dansLeCours = false;
        return ligne;
      }
    }
    if (!dansLeCours) return ligne;
    const titre = /^(#{2,3})\s+(.+?)\s*$/.exec(ligne);
    if (!titre) return ligne;
    i += 1;
    if (parties[i]?.id) {
      dejaPoses += 1;
      return ligne;
    }
    const ancre = ancres[i];
    if (!ancre) return ligne;
    titresPoses += 1;
    change = true;
    return `${titre[1]} ${titre[2]} {#${ancre}}`;
  });

  if (!change) continue;
  fichiersTouches += 1;
  if (!voir) await writeFile(chemin, sortie.join('\n'));
}

console.log(
  `${titresPoses} identifiant(s) posé(s) dans ${fichiersTouches} fiche(s)` +
    `${dejaPoses ? `, ${dejaPoses} déjà en place` : ''}` +
    `${voir ? ' — rien n’a été écrit (--voir).' : '.'}`,
);
