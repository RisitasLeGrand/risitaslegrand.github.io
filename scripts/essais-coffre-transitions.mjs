/**
 * Les pages sous coffre se déclarent — et la déclaration ne peut pas dériver.
 *
 *   npm run essais:coffre-transitions
 *
 * **Pourquoi ce contrôle existe.** Les transitions entre documents (prompt 34,
 * décision 1) capturent la page sortante pour la rejouer par-dessus la page
 * entrante. Sur un écran dont le coffre est ouvert, cette capture contient des
 * données chiffrées rendues en clair : l'interdit n° 2 l'exclut absolument.
 *
 * La parade retenue est de **ne pas émettre la règle `@view-transition` sur
 * ces pages**. Comme une transition entre documents exige que les **deux**
 * pages y consentent, une page sous coffre sans la règle n'est capturée ni en
 * partant ni en arrivant. Une ligne, et la propriété vaut dans les deux sens.
 *
 * Tout repose donc sur une chose : que chaque page sous coffre soit déclarée.
 * Une liste de routes recopiée à la main rouille à la première page ajoutée —
 * et son pourrissement est silencieux, puisque la page oubliée *fonctionne*,
 * elle fuit seulement. Ce contrôle compare donc deux ensembles établis depuis
 * la source, dans les deux sens :
 *
 *   • les pages qui portent le formulaire de coffre — par ses identifiants,
 *     ou par le composant « FormulaireCoffre » qui les porte désormais ;
 *   • les pages qui passent `coffre` au gabarit.
 *
 * Toute page présente dans l'un et absente de l'autre est une faute, quel que
 * soit le sens : un coffre non déclaré fuit, une déclaration sans coffre prive
 * la page d'une transition sans raison et dissimule la vraie liste.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = 'src/pages';

const pages = [];
const parcourir = (d) => {
  for (const e of readdirSync(d)) {
    const c = join(d, e);
    if (statSync(c).isDirectory()) parcourir(c);
    else if (e.endsWith('.astro')) pages.push(c);
  }
};
parcourir(RACINE);
pages.sort();

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) {
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
};

const avecCoffre = [];
const declarees = [];

for (const p of pages) {
  const source = readFileSync(p, 'utf8');
  const nom = relative(RACINE, p);
  // Le formulaire de déverrouillage : c'est lui qui atteste qu'un contenu
  // chiffré se rend sur cette page une fois le coffre ouvert.
  /*
     Trois marques, et la troisième a été ajoutée le 14 octobre : le
     formulaire est devenu le composant « FormulaireCoffre », de sorte que
     les deux identifiants ne figurent plus dans la source des pages. Ce
     contrôle est alors passé au rouge — à juste titre, puisqu'il ne voyait
     plus les coffres. C'est sa détection qui suit le code, pas l'inverse :
     l'invariant qu'il protège — une page qui se déclare « sous coffre » en
     porte bien un — n'a pas bougé d'un pouce.
  */
  if (
    source.includes('id="mdp-coffre"') ||
    source.includes('id="coffre-ferme"') ||
    source.includes('<FormulaireCoffre')
  ) {
    avecCoffre.push(nom);
  }
  /*
     La déclaration au gabarit — l'ATTRIBUT, et non le mot.

     Le motif précédent cherchait « coffre » n'importe où dans la balise
     ouvrante. Il accusait donc « coffre/bascule.astro », dont le titre est
     « Mot de passe du coffre » : la page ne déclarait rien du tout, et le
     contrôle la montrait du doigt. Un contrôle qui accuse à tort se fait
     désactiver par celui qui le lit, et il a raison de le faire.

     Ce motif exige qu'un blanc précède le mot et qu'un caractère d'attribut
     le suive — espace, « = », « > » ou « /> ». Un guillemet ne convient pas,
     ce qui écarte les titres et les descriptions.
  */
  if (/<Base\b[^>]*\scoffre\s*(=|\/?>|\s)/s.test(source)) declarees.push(nom);
}

console.log('\nCOFFRE ET TRANSITIONS ENTRE PAGES');
console.log(`\n  ${pages.length} pages examinées`);

v(
  'au moins une page porte un coffre (sinon le contrôle ne contrôle rien)',
  avecCoffre.length > 0,
  true,
);

const nonDeclarees = avecCoffre.filter((n) => !declarees.includes(n));
v('toute page à coffre déclare « coffre » au gabarit', nonDeclarees, []);

const declareesSansCoffre = declarees.filter((n) => !avecCoffre.includes(n));
v('aucune page ne déclare « coffre » sans en porter un', declareesSansCoffre, []);

console.log(`\n  ${avecCoffre.length} page(s) sous coffre :`);
for (const n of avecCoffre) console.log(`    ${n}`);

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
