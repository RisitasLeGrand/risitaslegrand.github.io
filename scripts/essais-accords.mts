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
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { accorde, pluriel } from '../src/lib/noyau/accords.ts';
import { sitesInterdits } from './lib/accords-balayage.mjs';

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

/* ══════════════════════════════════════════════════════════════════════════
   2. Le balayage des sources
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
  for (const fichier of fichiersDe('src')) {
    for (const s of sitesInterdits(readFileSync(fichier, 'utf8'))) {
      trouves.push({ fichier, ...s });
    }
  }
  const parFichier = new Map<string, number>();
  for (const t of trouves) parFichier.set(t.fichier, (parFichier.get(t.fichier) ?? 0) + 1);

  v(`aucune forme parenthésée dans une chaîne de « src/ »`, trouves.length, 0);
  if (trouves.length) {
    console.log(
      `      ${trouves.length} ${accorde(trouves.length, 'site')} dans ` +
        `${pluriel(parFichier.size, 'fichier')} :`,
    );
    for (const [f, n] of [...parFichier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`      ${String(n).padStart(3)}  ${f}`);
    }
    console.log(
      `      Le remède : « pluriel(n, 'jour') » pour le nom, « accorde(n, 'suivie') »\n` +
        `      pour ce qui le suit, tous deux dans « lib/noyau/accords.ts ».`,
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Le balayage se trompe-t-il ? Les deux sens
   ══════════════════════════════════════════════════════════════════════════ */

/*
   Un balayage qui accuse à tort se fait désactiver, et c'est ainsi qu'on perd
   un garde-fou. On éprouve donc les deux erreurs possibles, sur des textes
   fabriqués ici.
*/
console.log('\n\u001b[1mLE BALAYAGE SE TROMPE-T-IL ?\u001b[0m');
v(
  'un commentaire qui PARLE de la forme interdite n’est pas une infraction',
  sitesInterdits('/* on n’écrit jamais « jour(s) » ici */\nconst n = 1;').length,
  0,
);
v(
  'du code n’est pas du texte : « .filter((s) => … ) » passe',
  sitesInterdits('const a = b.filter((s) => s.length);').length,
  0,
);
v(
  'mais une chaîne fautive est bien vue',
  sitesInterdits("const t = 'il reste 3 jour(s)';").length,
  1,
);
v(
  'y compris dans un gabarit sur plusieurs lignes',
  sitesInterdits('const t = `voici\n  3 jour(s) de plus`;').length,
  1,
);
v(
  'et la forme assemblée à l’exécution ne passe pas',
  sitesInterdits("const t = `${mot}${plusieurs ? '(s)' : ''}`;").length,
  1,
);
v(
  'du vrai code après la fermeture d’un commentaire est bien vu',
  sitesInterdits("/* un commentaire */ const t = 'reste 2 jour(s)';").length,
  1,
);

console.log(
  echecs === 0 ? '\n\u001b[32m✓ tout passe\u001b[0m\n' : `\n\u001b[31m✗ ${echecs} échecs\u001b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
