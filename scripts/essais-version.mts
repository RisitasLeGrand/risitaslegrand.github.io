/**
 * La version de l'application dit la vérité — B4 du prompt 58.
 *
 *   npm run essais:version
 *
 * ## Le défaut, en trois endroits et une seule cause
 *
 * Le champ `versionApplication` existait partout et ne valait rien nulle part :
 *
 * - `sauvegarde/service.ts` le cherchait dans un champ `version` de
 *   `site.config.mjs` qui n'a jamais existé — donc « inconnue » dans toute
 *   sauvegarde ;
 * - `sync/service.ts` y écrivait la chaîne littérale `'cyclades'` : le nom du
 *   produit à la place d'une version ;
 * - `parametres.astro` l'affichait depuis `ParametresCle.version`, un champ
 *   que ce type ne porte pas — donc « Cyclades, publication inconnue » à
 *   chaque chargement, depuis le premier jour.
 *
 * Trois replis différents, et aucun ne disait qu'il était un repli. C'est la
 * forme la plus coûteuse d'un champ mort : il a l'air rempli.
 *
 * ## Ce que ce contrôle garde
 *
 * Il refuse que les placeholders reviennent, et il lit les trois sources là
 * où elles sont écrites. Un champ décoratif se répare une fois ; ce qui
 * l'empêche de le redevenir, c'est un essai qui accuse.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// @ts-expect-error — module JavaScript du dépôt, sans déclaration de types.
import { sansCommentaires } from './lib/sans-commentaires.mjs';
import {
  FORME_DEPOT,
  HORS_ASSEMBLAGE,
  INDETERMINEE,
  PLACEHOLDERS_REFUSES,
  estUneVraieVersion,
  versionDeLApplication,
} from '../src/lib/version';

let echecs = 0;
const v = (t: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${t}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${t}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (t: string, c: boolean) => v(t, c, true);
const faux = (t: string, c: boolean) => v(t, c, false);
const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');

console.log('\n\x1b[1mLA VERSION DE L’APPLICATION\x1b[0m');

console.log('\n  La garde refuse ce qui prétend être une version');
{
  for (const faute of PLACEHOLDERS_REFUSES) {
    faux(`« ${faute || '(chaîne vide)'} » est refusé`, estUneVraieVersion(faute));
  }
  faux('la casse ne sauve pas « Inconnue »', estUneVraieVersion('Inconnue'));
  faux('ni les espaces autour', estUneVraieVersion('  cyclades  '));
  faux('un non-texte est refusé', estUneVraieVersion(undefined));
  faux('un nombre aussi', estUneVraieVersion(43));
  /*
     ET `INDETERMINEE` PASSE, ce qui peut surprendre. Elle dit la vérité sur
     elle-même : « indéterminée (assemblage hors dépôt) » n'est pas une version
     qui se fait passer pour telle, c'est un aveu. Ce que la garde refuse, ce
     n'est pas l'ignorance — c'est l'ignorance déguisée.
  */
  vrai('mais « indéterminée » passe, parce qu’elle s’avoue', estUneVraieVersion(INDETERMINEE));
  vrai('et une empreinte de dépôt passe', estUneVraieVersion('g1a2b3c4 · 2026-10-31'));
}

console.log('\n  Hors assemblage, le module le dit');
{
  /*
     Cet essai tourne sous `tsx`, donc `vite.define` n'a rien remplacé. La
     valeur doit donc être la marque d'un hors-assemblage, et NON une vraie
     version : un module qui inventerait quelque chose ici rendrait l'essai
     incapable de distinguer les deux situations.
  */
  v('la valeur est la marque du hors-assemblage', versionDeLApplication(), HORS_ASSEMBLAGE);
  faux('et elle ne passe pas pour une vraie version', estUneVraieVersion(HORS_ASSEMBLAGE));
}

console.log('\n  Les trois sources sont branchées, et aucune ne garde son repli');
{
  const sauvegarde = lire('src/lib/sauvegarde/service.ts');
  vrai(
    'la sauvegarde appelle la version injectée',
    /versionApplication: versionDeLApplication\(\)/.test(sauvegarde),
  );
  faux('et ne cherche plus un champ qui n’existe pas', /config as \{ version\?: string \}/.test(sauvegarde));

  const sync = lire('src/lib/sync/service.ts');
  vrai(
    'le paquet de synchronisation aussi',
    /versionApplication: versionDeLApplication\(\)/.test(sync),
  );
  faux('et n’écrit plus le nom du produit', /versionApplication: 'cyclades'/.test(sync));

  const ecran = lire('src/pages/parametres.astro');
  vrai('l’écran affiche la version injectée', /version-publication'\)!\.textContent = versionDeLApplication\(\)/.test(ecran));
  faux('et ne la cherche plus dans les paramètres de clé', /p\.version \?\? 'inconnue'/.test(ecran));
}

console.log('\n  L’assemblage sait la déterminer');
{
  const config = lire('astro.config.mjs');
  vrai('la configuration la détermine', /function versionDeLAssemblage\(\)/.test(config));
  vrai('et l’injecte', /__VERSION_CYCLADES__: JSON\.stringify\(versionDeLAssemblage\(\)\)/.test(config));
  vrai(
    'une variable d’assemblage peut l’imposer',
    /process\.env\.CYCLADES_VERSION/.test(config),
  );
  /*
     ET ELLE NE LÈVE PAS. Un assemblage hors dépôt est légitime — une archive,
     un conteneur sans git — et faire échouer la construction pour un champ
     d'en-tête serait disproportionné. La garde est ici, pas là-bas : un
     contrôle qui casse les cas légitimes finit désactivé.
  */
  faux('et elle ne fait pas échouer la construction', /throw new Error/.test(config.slice(config.indexOf('function versionDeLAssemblage'), config.indexOf('export default'))));
  /*
     ET ELLE N'EMPLOIE PAS `require`, qui n'existe pas dans un module ESM.

     Cette assertion garde un défaut que j'ai commis et que la mesure seule a
     révélé : ma première version appelait `require('node:child_process')`, le
     `catch` avalait « require is not defined », et la configuration rendait
     « indéterminée (assemblage hors dépôt) » sur une machine portant un dépôt
     sain. L'écran affichait « Cyclades, publication indéterminée » et rien
     d'autre ne le disait. Un repli qui ne distingue pas « je ne peux pas
     savoir » de « je me suis trompé » transforme un défaut en situation
     normale — la faute même que B4 corrige, commise dans son correctif.
  */
  /*
     ON BLANCHIT LES COMMENTAIRES AVANT DE CHERCHER, et j'ai dû m'y reprendre.
     Ma première version cherchait `require(` dans la source entière — et le
     trouvait dans le commentaire qui RACONTE ce défaut, juste au-dessus de la
     fonction. Un relevé qui compte ce qu'il décrit n'est pas un relevé ; c'est
     le piège que `lib/sans-commentaires.mjs` existe pour fermer, et je ne
     m'en étais pas servi.
  */
  faux(
    'et elle n’emploie pas `require`, absent des modules ESM',
    /\brequire\(/.test(sansCommentaires(config)),
  );
  vrai('elle importe donc en tête, où une faute casse l’assemblage', /^import \{ execFileSync \} from 'node:child_process';$/m.test(config));
}

console.log('\n  \x1b[1mLE DÉPÔT EST LÀ : la forme attendue est exigée\x1b[0m');
{
  let empreinte: string | null = null;
  try {
    empreinte = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    empreinte = null;
  }
  if (empreinte === null) {
    console.log('  — pas de dépôt ici : la forme du dépôt n’est pas mesurée (et c’est dit)');
  } else {
    /*
       ON REFAIT LE CALCUL DE LA CONFIGURATION, parce qu'on ne peut pas
       l'importer : `astro.config.mjs` est un module de configuration, et
       l'importer ici exécuterait ses greffons. On reconstruit donc la forme
       attendue, et l'on vérifie que la CONFIGURATION produit bien celle-là —
       en lisant son code, à défaut de pouvoir l'exécuter. La limite est dite
       plutôt que masquée.
    */
    /*
       ON REFAIT LE CALCUL EXACT DE LA CONFIGURATION, suffixe compris.

       Ma première version reconstruisait `g${empreinte} · <jour>` SANS le
       suffixe `-modifie`, et confrontait la forme déclarée à cette
       reconstruction. L'assertion passait, et la forme refusait pourtant ce
       que la configuration produit réellement sur un arbre modifié — c'est-à-
       dire le cas le plus courant pendant le développement. Une forme déclarée
       confrontée à sa propre reconstruction ne décrit qu'une intention.
    */
    const modifie =
      execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== ''
        ? '-modifie'
        : '';
    const jour = new Date().toISOString().slice(0, 10);
    const produite = `g${empreinte}${modifie} · ${jour}`;
    console.log(`      la configuration produirait : « ${produite} »`);
    vrai('l’empreinte courte a la forme attendue', /^[0-9a-f]{8}$/.test(empreinte));
    vrai(
      'la configuration préfixe bien d’un « g »',
      /return `g\$\{empreinte\}\$\{modifie\} · \$\{jour\}`/.test(lire('astro.config.mjs')),
    );
    vrai('et la forme déclarée accepte ce qu’elle produit vraiment', FORME_DEPOT.test(produite));
    vrai('cette valeur passe la garde', estUneVraieVersion(produite));
    faux(
      'tandis que la forme refuse une version sans empreinte',
      FORME_DEPOT.test('1.0.0 · 2026-10-31'),
    );
  }
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
