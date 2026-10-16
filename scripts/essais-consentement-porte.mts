/**
 * La porte du consentement est unique, et rien ne la contourne — A-13.
 *
 *   npm run essais:consentement-porte
 *
 * Le pilote a demandé « un essai qu'aucune entrée ne lit un fait sans
 * consentement ». Celui-ci est **structurel** : il lit les sources, pas la
 * base. C'est volontaire — ce qu'il faut garantir n'est pas qu'un parcours
 * donné se taise, mais qu'**aucun chemin n'existe**, y compris un chemin
 * que personne n'a encore écrit.
 *
 * Trois propriétés, et chacune est une façon dont la porte pourrait être
 * contournée demain :
 *
 * 1. **`observer()` et `deduire()` ne sont appelés que depuis
 *    `observerUsage()`.** Ce sont les deux fonctions qui transforment des
 *    faits en observation de l'usage ; les atteindre ailleurs serait
 *    observer sans passer par la porte ;
 * 2. **la garde précède toute lecture de faits dans `observerUsage()`.**
 *    Une garde posée après la publication protégerait l'affichage, pas la
 *    lecture — et c'est la lecture qui est en cause ;
 * 3. **la garde lit le consentement, et ne le suppose pas.** Un défaut à
 *    `true` quelque part rendrait les deux premières inutiles.
 *
 * Ce qu'il ne couvre pas, et qu'il faut dire : les écrans qui publient les
 * faits de révision pour **montrer à la personne ses propres données**
 * (statistiques, tableau de bord, faits du jour). Ils ne sont pas de
 * l'apprentissage étendu, et les soumettre à ce consentement reviendrait à
 * faire payer au reste de Cyclades une fonction dont le texte promet
 * justement qu'elle est facultative.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (t: string, c: boolean) => v(t, c, true);

/** Tous les fichiers de `src/`, sources comprises. */
function sources(racine = 'src'): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...sources(chemin));
    else if (/\.(ts|astro|mts)$/.test(entree)) sortie.push(chemin);
  }
  return sortie;
}

/** Le texte, sans ses commentaires — une mention en prose n'est pas un appel. */
const sansCommentaires = (texte: string) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');

const fichiers = sources();
const LA_PORTE = 'src/lib/initialisation.ts';

console.log('\n\x1b[1m1. Observer l’usage ne se fait qu’à un endroit\x1b[0m');
{
  for (const appel of ['observer(', 'deduire(']) {
    const ailleurs = fichiers.filter((f) => {
      if (f === LA_PORTE) return false;
      const texte = sansCommentaires(readFileSync(f, 'utf8'));
      /* On ignore la déclaration elle-même, dans le noyau. */
      if (/export (async )?function (observer|deduire)\b/.test(texte)) return false;
      return new RegExp(`(^|[^\\w.])${appel.replace('(', '\\(')}`, 'm').test(texte);
    });
    v(`« ${appel} » n’est appelé que dans la porte`, ailleurs, []);
  }
}

console.log('\n\x1b[1m2. La garde précède toute lecture de faits\x1b[0m');
{
  const texte = readFileSync(LA_PORTE, 'utf8');
  const corps = texte.slice(texte.indexOf('export async function observerUsage'));
  const garde = corps.indexOf('consentementLocal');
  const publication = corps.indexOf('publierFaitsRevisions(');
  const observation = corps.indexOf('observer(faits');

  vrai('la garde est dans `observerUsage`', garde >= 0);
  vrai('la publication des faits aussi', publication >= 0);
  vrai('et la garde vient AVANT la publication', garde < publication);
  vrai('comme avant l’observation', garde < observation);

  /*
     Le `return` doit se trouver ENTRE la garde et la publication : une
     garde qui se contenterait de calculer un drapeau laisserait le code
     continuer, et lire les faits quand même.
  */
  const sortie = corps.indexOf('return {', garde);
  vrai('un retour sépare la garde de la publication', sortie > garde && sortie < publication);
}

console.log('\n\x1b[1m3. La garde lit, elle ne suppose pas\x1b[0m');
{
  const etat = readFileSync('src/lib/odyssee/consentement-etat.ts', 'utf8');
  const sansC = sansCommentaires(etat);
  vrai(
    'l’état vierge n’accorde rien',
    /CONSENTEMENT_VIERGE[\s\S]{0,120}accorde:\s*false/.test(sansC),
  );
  vrai(
    'et une lecture impossible n’accorde rien non plus',
    sansCommentaires(readFileSync('src/lib/consentement-apprentissage.ts', 'utf8')).includes(
      'return CONSENTEMENT_VIERGE',
    ),
  );
  v(
    'aucun « accorde: true » en dur hors de la résolution',
    [...sansC.matchAll(/accorde:\s*true/g)].length,
    2,
  );
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent — la porte est unique.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
