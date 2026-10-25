/**
 * Le défilement respecte le mouvement réduit (H2 du prompt 43).
 *
 *   npm run essais:defilement
 *
 * Deux choses, et la seconde compte autant que la première : que la règle
 * soit juste, et qu'aucun écran ne la contourne. Six défilements `smooth`
 * vivaient à six endroits sans jamais consulter `prefers-reduced-motion` —
 * c'est la forme qu'on recopie en ajoutant un écran, et c'est pourquoi le
 * relevé vaut autant que la fonction.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { allureDuDefilement, mouvementReduit } from '../src/lib/defilement.ts';

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi: string, condition: boolean) => v(quoi, condition, true);

/**
 * Pose les DEUX réglages d'essai, et rend de quoi les retirer.
 *
 * Le système (`prefers-reduced-motion`) et celui de l'application
 * (`data-animations` sur `<html>`). Le second a été oublié à ma première
 * écriture, et c'est `essais:mouvement-reduit` qui l'a vu.
 */
function avecPreference(
  reduit: boolean | 'absent',
  application: 'reduites' | null = null,
): () => void {
  const global = globalThis as { window?: unknown; document?: unknown };
  const avant = [global.window, global.document] as const;
  global.window =
    reduit === 'absent'
      ? {}
      : {
          matchMedia: (requete: string) => ({
            matches: requete.includes('prefers-reduced-motion') && reduit,
          }),
        };
  global.document = {
    documentElement: { getAttribute: (nom: string) => (nom === 'data-animations' ? application : null) },
  };
  return () => {
    [global.window, global.document] = avant as [unknown, unknown];
  };
}

console.log('\n1. LA RÈGLE');

{
  const rendre = avecPreference(true);
  v('sous mouvement réduit, le défilement est instantané', allureDuDefilement(), 'auto');
  vrai('et la préférence est vue', mouvementReduit());
  rendre();
}
{
  const rendre = avecPreference(false);
  v('sans la préférence, il glisse comme avant', allureDuDefilement(), 'smooth');
  rendre();
}
{
  /*
     Pas de `matchMedia` : on ne sait pas, et on ne PRÉSUME pas d'une
     préférence qui protège quelqu'un — présumer qu'elle est posée
     supprimerait le mouvement pour tout le monde sur un navigateur ancien.
  */
  const rendre = avecPreference('absent');
  v('sans « matchMedia », on glisse, sans se tromper au nom de personne', allureDuDefilement(), 'smooth');
  rendre();
}
{
  /*
     LE RÉGLAGE DE L'APPLICATION SEUL, et c'est le cas qui manquait.

     Quelqu'un qui coupe les animations dans Cyclades sans pouvoir le faire
     dans son système — un ordinateur partagé, un téléphone de service —
     voyait l'écran glisser quand même. Le réglage n'était vrai qu'à moitié.
  */
  const rendre = avecPreference(false, 'reduites');
  v('le réglage de l’application suffit', allureDuDefilement(), 'auto');
  vrai('et il est vu comme le réglage du système', mouvementReduit());
  rendre();
}
{
  const rendre = avecPreference('absent', 'reduites');
  v('même sans « matchMedia », le réglage de l’application tient', allureDuDefilement(), 'auto');
  rendre();
}

console.log('\n2. AUCUN ÉCRAN NE CONTOURNE LA RÈGLE');

function fichiers(racine: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(astro|ts|svelte)$/.test(entree)) sortie.push(chemin);
  }
  return sortie;
}

/* La forme recherchée est l'APPEL, pas le mot : le module lui-même nomme
   « smooth » dans son commentaire et dans la valeur qu'il rend. */
const APPEL_SMOOTH = /behavior:\s*['"]smooth['"]/;
const coupables = fichiers('src')
  .filter((f) => f !== 'src/lib/defilement.ts')
  .filter((f) => APPEL_SMOOTH.test(readFileSync(f, 'utf8')));
v('aucun défilement « smooth » hors du module', coupables, []);

/* Et les six appels d'origine passent bien par la fonction : un fichier qui
   aurait simplement SUPPRIMÉ son défilement passerait le contrôle ci-dessus
   sans rien amener à personne. */
for (const [fichier, quoi] of [
  ['src/pages/positionnement.astro', 'le positionnement'],
  ['src/pages/glossaire.astro', 'le glossaire'],
  ['src/pages/odyssee/tendances.astro', 'les tendances'],
  ['src/pages/odyssee/veille.astro', 'la veille'],
  ['src/pages/odyssee/rapprocher.astro', 'le rapprochement'],
] as const) {
  vrai(`${quoi} défile par le module`, /defiler(Vers|EnHaut)\(/.test(readFileSync(fichier, 'utf8')));
}

console.log('\n3. LA ROTATION 3D EST PRÉVENUE, ET COUPÉE');

const grille = readFileSync('src/features/quad-n-back/composants/Grille.svelte', 'utf8');
vrai(
  'la rotation est coupée sous mouvement réduit',
  /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.tourne\s*\{[^}]*animation:\s*none/.test(
    grille,
  ),
);
const ecran = readFileSync('src/features/quad-n-back/composants/QuadNBack.svelte', 'utf8');
vrai(
  'et elle est annoncée AVANT la partie',
  /id="avertissement-rotation"/.test(ecran) && /tourne lentement pendant la partie/.test(ecran),
);
vrai(
  'l’avertissement est relié à la case qui l’allume',
  /aria-describedby="avertissement-rotation"/.test(ecran),
);
vrai(
  'et il dit ce que le système fait tout seul',
  /mouvement réduit[^<]*elle reste immobile|immobile/.test(ecran),
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
