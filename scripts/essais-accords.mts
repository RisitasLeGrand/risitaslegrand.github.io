/**
 * G4 — jamais « jour(s) » à l'écran, et un outil pour l'éviter.
 *
 *   npm run essais:accords
 *
 * ## La règle, et pourquoi elle n'est pas une coquetterie
 *
 * « 3 jour(s) », « 2 carte(s) suivie(s) », « 1 base(s) annexe(s) » : la forme
 * parenthésée écrit les deux accords pour n'en choisir aucun. Elle demande à
 * la personne de faire le travail que le code refuse de faire, et elle le
 * demande au pire moment — dans une confirmation d'effacement, dans un relevé
 * de restauration, là où l'on compte ce qu'on va perdre.
 *
 * Le site a `pluriel()` depuis longtemps pour le nom. Il lui manquait le
 * compagnon pour ce qui SUIT le nom, et c'est pour cela que la forme
 * interdite survivait : faute d'`accorde()`, il fallait écrire six fois le
 * même ternaire à la main, ou céder.
 *
 * ## Deux moitiés, et la seconde est celle qui tient dans le temps
 *
 * D'abord les deux fonctions, **par exécution** : c'est la première fois
 * qu'elles sont éprouvées. `pluriel()` vivait dans `lib/ui.ts`, qui appelle
 * `zoneDesNotifications()` à l'import — donc jette hors navigateur —, et
 * personne ne pouvait l'importer ici. Elle est passée dans
 * `noyau/accords.ts`, et `ui.ts` la réexporte.
 *
 * Ensuite le BALAYAGE. La relecture ne tient rien : 229 occurrences vivaient
 * dans 41 fichiers au 26 octobre, et la deux-cent-trentième s'écrirait un
 * jour sans que personne y pense.
 *
 * ## Ce que le balayage regarde, et ce qu'il laisse tranquille
 *
 * Il ne regarde que les **chaînes de caractères**, hors commentaires :
 *
 * - un commentaire qui PARLE de la forme interdite — comme celui-ci — n'est
 *   pas une infraction. C'est la leçon de `essais:erreurs-dites`, et la règle
 *   de blanchiment vit une fois dans `lib/sans-commentaires.mjs` ;
 * - du code n'est pas du texte. `tableau.filter((s) => …)` porte « (s) » et
 *   ne dit rien à personne. Exiger du balayage qu'il comprenne la différence
 *   par le contexte l'aurait fait crier au loup, et un contrôle qui accuse à
 *   tort se fait désactiver — c'est ainsi qu'on perd un garde-fou.
 *
 * Deux motifs, et le second ferme un contournement :
 *
 * 1. une lettre suivie de « (s) » ou « (es) » : `jour(s)`, `écrit(es)` ;
 * 2. une chaîne qui ne contient QUE « (s) » ou « (es) ». Sans elle,
 *    `` `${mot}${plusieurs ? '(s)' : ''}` `` passerait : la forme interdite
 *    serait assemblée à l'exécution, et le premier motif ne verrait rien.
 *
 * ## Et la troisième moitié : ce que le balayage fait quand il se perd
 *
 * Elle est née d'une anomalie de L'INVENTAIRE, pas d'un rouge :
 * `planification/index.astro` déclarait un site à la ligne 211, où il n'y
 * avait rien ; la faute était quatre lignes plus bas. En tirant ce fil :
 * l'apostrophe d'un « Aujourd'hui » de BALISAGE, ligne 96, ouvrait une chaîne
 * qui ne se refermait plus, et le fichier se lisait de travers à partir de là.
 *
 * Le vrai dégât n'était pas la ligne fausse. `echelles.astro` sortait à ZÉRO
 * site alors qu'il en portait sept, dont trois dans une phrase affichée : un
 * fichier entier devenu invisible, et un compteur à zéro qui ressemblait à une
 * bonne nouvelle. Un balayage qui se perd en silence est pire qu'un balayage
 * absent, parce qu'on lui fait confiance.
 *
 * Trois causes, toutes de la même famille — lire du balisage comme du
 * JavaScript : l'apostrophe du balisage ; `/['’]/g`, qui porte un guillemet
 * dans un motif ; `{/* … *\/}`, dont le commentaire n'était pas blanchi. Et
 * une quatrième, de découpage : `<style … />` autoporteur, pris pour
 * l'ouverture d'une feuille de style.
 *
 * Toutes corrigées. Mais la correction qui tient dans le temps, c'est la
 * dernière : la machine rend ses DÉSYNCHRONISATIONS, et cet essai REFUSE de
 * mesurer quand il y en a une. Il ne peut plus affirmer « aucune forme
 * parenthésée » sur un fichier qu'il n'a pas lu en entier.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { accorde, nombreFr, pluriel } from '../src/lib/noyau/accords.ts';
import { sitesInterdits } from './lib/accords-balayage.mjs';
import { nonMesurable } from './lib/non-mesurable.mjs';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Les deux fonctions, par exécution
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\u001b[1mLE NOMBRE ET SON NOM\u001b[0m');
v('zéro prend le singulier, comme en français', pluriel(0, 'jour'), '0 jour');
v('un aussi', pluriel(1, 'jour'), '1 jour');
v('deux prend le pluriel', pluriel(2, 'jour'), '2 jours');
v('et la forme irrégulière se donne', pluriel(3, 'principal', 'principaux'), '3 principaux');
/*
   LE DÉCIMAL, et c'est lui qui a corrigé le seuil. « pluriel » s'écrivait
   « n > 1 », donc mettait au pluriel dès 1,0001. Trouvé en accordant
   « 1,25 sortie(s) par jour » sur l'écran du budget : une cadence est un
   décimal, et le français garde le singulier jusqu'à deux exclu.
*/
v('un décimal sous deux reste au singulier', pluriel(1.25, 'sortie'), '1.25 sortie');
v('et à deux il passe au pluriel', pluriel(2, 'sortie'), '2 sorties');
v('accorde suit le même seuil', accorde(1.25, 'sortie'), 'sortie');

console.log('\n\u001b[1mLE MOT QUI SUIT LE NOM\u001b[0m');
/*
   Le cas qui a fait naître la fonction : un nombre mis en forme à la
   française ne peut pas passer par `pluriel`, qui rend le nombre brut — et
   « 4 128 » arrête une main que « 4128 » n'arrête pas. Son nom doit pourtant
   s'accorder.
*/
v('accorde ne rend que le mot, sans le nombre', accorde(2, 'suivie'), 'suivies');
v('au singulier aussi', accorde(1, 'suivie'), 'suivie');
v('zéro reste au singulier', accorde(0, 'suivie'), 'suivie');
v('et la forme irrégulière se donne', accorde(2, 'principal', 'principaux'), 'principaux');
v(
  'les deux se composent, et c’est l’usage visé',
  `${pluriel(2, 'carte')} ${accorde(2, 'suivie')}`,
  '2 cartes suivies',
);
/*
   L'ESPACE DES MILLIERS N'EST PAS UNE ESPACE ORDINAIRE, et c'est l'assertion
   elle-même qui me l'a appris : « obtenu "4 128 enregistrements", attendu
   "4 128 enregistrements" », deux chaînes identiques à l'œil. Le moteur rend
   une espace fine insécable et non une insécable ordinaire. On normalise donc
   tous les blancs plutôt que d'en nommer un.
*/
v(
  'y compris avec un nombre mis en forme',
  `${(4128).toLocaleString('fr-FR')} ${accorde(4128, 'enregistrement')}`.replace(/\s/g, ' '),
  '4 128 enregistrements',
);

console.log('\n\u001b[1mLE NOMBRE ÉCRIT EN FRANÇAIS\u001b[0m');
/*
   `nombreFr` remplace des `toFixed`, et c'est pour cela que les décimales
   sont EXACTES et non maximales : « 12,50 € » ne doit pas devenir « 12,5 € ».
   Les blancs sont normalisés dans chaque comparaison — l'espace des milliers
   rendue par `Intl` est une espace fine insécable, et deux chaînes identiques
   à l'œil ne le sont pas pour « === ».
*/
const sansBlancs = (t: string) => t.replace(/\s/g, ' ');
v('les milliers prennent une espace', sansBlancs(nombreFr(4128)), '4 128');
v('un entier n’invente pas de décimale', sansBlancs(nombreFr(12)), '12');
v('la décimale est une virgule, jamais un point', sansBlancs(nombreFr(1234.5, 1)), '1 234,5');
v('et la décimale muette est gardée', sansBlancs(nombreFr(12.5, 2)), '12,50');
v('aucun point décimal ne sort d’ici', nombreFr(12.5, 2).includes('.'), false);
/*
   LE CAS QUI A FAIT NAÎTRE LA FONCTION : le dépôt écrivait
   « toFixed(2).replace('.', ',') », qui met la virgule et laisse les milliers
   collés — à moitié faux, donc plus difficile à voir qu'une faute franche.
*/
v(
  'le contournement « toFixed puis replace » laissait les milliers collés',
  sansBlancs(nombreFr(4128.5, 2)) === (4128.5).toFixed(2).replace('.', ','),
  false,
);

/* ══════════════════════════════════════════════════════════════════════════
   2. Le balayage se trompe-t-il ? Les deux sens
   ══════════════════════════════════════════════════════════════════════════ */

/*
   ON ÉPROUVE L'INSTRUMENT AVANT DE S'EN SERVIR, et dans les deux sens : un
   balayage qui accuse à tort se fait désactiver, un balayage qui se taît à
   tort fait croire que c'est propre. Les sources sont fabriquées ici ; le nom
   du fichier décide de la lecture, donc il fait partie du contrôle.
*/
const combien = (source: string, fichier = '') => sitesInterdits(source, fichier).sites.length;
const perdu = (source: string, fichier = '') => sitesInterdits(source, fichier).anomalies.length;

console.log('\n\u001b[1mLE BALAYAGE SE TROMPE-T-IL ? — DU JAVASCRIPT\u001b[0m');
v(
  'un commentaire qui PARLE de la forme interdite n’est pas une infraction',
  combien('/* on n’écrit jamais « jour(s) » ici */\nconst n = 1;'),
  0,
);
v('du code n’est pas du texte : « .filter((s) => … ) » passe', combien('const a = b.filter((s) => s.length);'), 0);
v('mais une chaîne fautive est bien vue', combien("const t = 'il reste 3 jour(s)';"), 1);
v('y compris dans un gabarit sur plusieurs lignes', combien('const t = `voici\n  3 jour(s) de plus`;'), 1);
v('et la forme assemblée à l’exécution ne passe pas', combien("const t = `${mot}${plusieurs ? '(s)' : ''}`;"), 1);
v(
  'du vrai code après la fermeture d’un commentaire est bien vu',
  combien("/* un commentaire */ const t = 'reste 2 jour(s)';"),
  1,
);
/*
   LA LIGNE RENDUE EST CELLE DE LA FAUTE. C'est l'anomalie qui a tout ouvert :
   l'inventaire désignait la ligne où le MORCEAU commençait, et l'on allait
   chercher quatre lignes trop haut un « (s) » qui n'y était pas.
*/
v(
  'la ligne rendue est celle de la faute, non celle du début du morceau',
  sitesInterdits('const t = `voici\n  une phrase\n  et 3 jour(s) au bout`;').sites[0]?.ligne,
  3,
);
/*
   UNE EXPRESSION RÉGULIÈRE PORTANT UN GUILLEMET : le cas de `moteur-veille.ts`
   et de treize autres. La chaîne qui SUIT doit encore être vue — c'est elle
   qui dit que la machine ne s'est pas perdue en route.
*/
v(
  'une expression régulière portant un guillemet ne désynchronise rien',
  perdu(`const a = x.replace(/['’]/g, "'");\nconst t = 'reste 2 jour(s)';`),
  0,
);
v(
  'et la chaîne qui la suit est toujours vue',
  combien(`const a = x.replace(/['’]/g, "'");\nconst t = 'reste 2 jour(s)';`),
  1,
);

console.log('\n\u001b[1mLE BALAYAGE SE TROMPE-T-IL ? — DU BALISAGE\u001b[0m');
/*
   LE CAS FONDATEUR : dans un `.astro`, hors frontmatter et hors `<script>`,
   l'apostrophe est une lettre. Lue comme un guillemet, elle emportait le reste
   du fichier — et avec lui les sites qu'il portait.
*/
v(
  'l’apostrophe du balisage n’ouvre aucune chaîne',
  perdu("<p>Aujourd'hui</p>\n<p>Rien</p>", 'x.astro'),
  0,
);
v(
  'et un site qui vient après elle est toujours vu',
  combien("<p>Aujourd'hui</p>\n<p>il reste 3 jour(s)</p>", 'x.astro'),
  1,
);
v('le texte du balisage est du texte', combien('<p>il reste 3 jour(s)</p>', 'x.astro'), 1);
/*
   UNE VALEUR D'ATTRIBUT EST LUE PAR QUELQU'UN : `title`, `aria-label`,
   `placeholder`. La faute y est aussi visible qu'ailleurs.
*/
v('une valeur d’attribut est du texte', combien('<p title="3 jour(s)">x</p>', 'x.astro'), 1);
v(
  'le code d’une expression n’est pas du texte',
  combien('<p>{liste.filter((s) => s.length)}</p>', 'x.astro'),
  0,
);
/*
   DU BALISAGE DANS UNE EXPRESSION : c'est ainsi que vit la phrase du PHQ-9,
   sous un `{e.id === 'phq9' && (<fieldset>…)}`. La traiter comme du pur code
   était la raison du « zéro site » d'`echelles.astro`.
*/
v(
  'du balisage dans une expression redevient du texte',
  combien("{ok && (<p>il reste 3 jour(s)</p>)}", 'x.astro'),
  1,
);
v(
  'un commentaire de JavaScript dans du balisage ne désynchronise rien',
  perdu("{/* ce qui suit n'est pas affiché */}\n<p>Rien</p>", 'x.astro'),
  0,
);
v(
  'et il ne cache pas le site qui le suit',
  combien("{/* ce qui suit n'est pas affiché */}\n<p>il reste 3 jour(s)</p>", 'x.astro'),
  1,
);
/*
   UN ÉLÉMENT AUTOPORTEUR : `<style is:inline set:html={…} />` de `Base.astro`.
   Pris pour l'ouverture d'une feuille de style, il faisait classer « à
   ignorer » tout ce qui suivait.
*/
v(
  'un élément autoporteur n’avale pas ce qui le suit',
  combien('<style is:inline set:html={CSS} />\n<p>il reste 3 jour(s)</p>', 'x.astro'),
  1,
);
v('une feuille de style, en revanche, est ignorée', combien('<style>.a::after { content: "3 jour(s)"; }</style>', 'x.astro'), 0);
/*
   LE `<script>` D'UN `.astro` EST DU JAVASCRIPT FRANC. Y voir du balisage
   prendrait ses `a < b` pour des balises, et son `.filter((s) =>` pour une
   phrase.
*/
v(
  'le script d’un .astro se lit comme du JavaScript',
  combien('<p>Rien</p>\n<script>\n  const a = b.filter((s) => s.length);\n</script>', 'x.astro'),
  0,
);
/*
   ET LE CONTRÔLE DU CONTRÔLE : une pile qui ne se referme pas doit être DITE.
   Sans ce dernier, les quatre corrections ci-dessus ne protègeraient que des
   quatre causes connues, et la cinquième se ferait de nouveau en silence.
*/
v(
  'une expression jamais refermée est signalée, non avalée',
  perdu('<p>{ok && (<span>texte</span>)</p>', 'x.astro') > 0,
  true,
);

/* ══════════════════════════════════════════════════════════════════════════
   3. Le balayage des sources
   ══════════════════════════════════════════════════════════════════════════ */

/** Les sources du site, récursivement. */
const fichiersDe = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fichiersDe(join(dossier, e.name))
      : /\.(ts|astro|svelte)$/.test(e.name)
        ? [join(dossier, e.name)]
        : [],
  );

console.log('\n\u001b[1mLE BALAYAGE DES SOURCES\u001b[0m');
{
  const trouves: { fichier: string; ligne: number; texte: string }[] = [];
  const perdus: { fichier: string; ligne: number; quoi: string }[] = [];
  for (const fichier of fichiersDe('src')) {
    const { sites, anomalies } = sitesInterdits(readFileSync(fichier, 'utf8'), fichier);
    for (const s of sites) trouves.push({ fichier, ...s });
    for (const a of anomalies) perdus.push({ fichier, ...a });
  }

  const parFichier = new Map<string, number>();
  for (const t of trouves) parFichier.set(t.fichier, (parFichier.get(t.fichier) ?? 0) + 1);
  const tableau = () => {
    console.log(
      `      ${trouves.length} ${accorde(trouves.length, 'site')} dans ` +
        `${pluriel(parFichier.size, 'fichier')} :`,
    );
    for (const [f, n] of [...parFichier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`      ${String(n).padStart(3)}  ${f}`);
    }
  };

  /*
     D'ABORD : le balayage s'est-il perdu ? Si oui, le compte qui suit ne vaut
     rien, et le dire vert serait un mensonge — même à zéro, surtout à zéro.
  */
  if (perdus.length) {
    if (trouves.length) tableau();
    console.log(`      ${pluriel(perdus.length, 'endroit')} où la lecture a décroché :`);
    for (const p of perdus.slice(0, 12)) console.log(`      ${p.fichier}:${p.ligne}  ${p.quoi}`);
    nonMesurable(
      'une lecture de source qui se referme : ' +
        `${pluriel(perdus.length, 'désynchronisation')} ${accorde(perdus.length, 'relevée')}`,
      'un fichier lu de travers peut rendre ZÉRO site en en portant sept — ' +
        'c’était le cas d’« echelles.astro » le 26 octobre',
      'corrigez la machine de « scripts/lib/accords-balayage.mjs » — le libellé ci-dessus ' +
        'donne le fichier et la ligne où l’état est resté ouvert',
    );
  }

  v(`aucune forme parenthésée dans une chaîne de « src/ »`, trouves.length, 0);
  if (trouves.length) {
    tableau();
    console.log(
      `      Le remède : « pluriel(n, 'jour') » pour le nom, « accorde(n, 'suivie') »\n` +
        `      pour ce qui le suit, tous deux dans « lib/noyau/accords.ts ».`,
    );
  }
}

console.log(
  echecs === 0 ? '\n\u001b[32m✓ tout passe\u001b[0m\n' : `\n\u001b[31m✗ ${echecs} échecs\u001b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
