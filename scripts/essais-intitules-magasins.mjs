/**
 * LES ÉTIQUETTES DES RUBRIQUES DE DONNÉES.
 *
 * ## Ce que cet essai garde
 *
 * L'écran Stockage affichait soixante-quinze noms techniques —
 * `odysseeEtapesCochees`, `vmSeuils`, `epreuveDgfipEnCours` — dans une table
 * dont le but est de décider quoi garder. `src/lib/intitules-magasins.ts` leur
 * donne un nom français, et le frontmatter de la page refuse la construction
 * quand il en manque un.
 *
 * Trois choses se défont sans bruit, et c'est ce que cet essai tient.
 *
 * 1. **Un magasin ajouté à `db.ts` sans étiquette.** Le refus à la
 *    construction l'attrape — mais seulement si le refus est encore là. Cet
 *    essai vérifie les deux : la couverture, et le fait que la page appelle
 *    toujours le contrôle dans son frontmatter.
 *
 * 2. **Une étiquette retirée du schéma et laissée ici.** Elle ne gêne
 *    personne, et c'est le problème : la liste grossit, et plus rien ne dit
 *    laquelle sert. Le contrôle va donc dans les DEUX sens.
 *
 * 3. **Une étiquette qui n'en est pas une.** Recopier le nom technique, ou
 *    écrire « Table odysseeNuits », satisferait la couverture sans rien
 *    corriger. L'essai refuse qu'une étiquette contienne son identifiant.
 *
 * ## Pourquoi il lit `db.ts` comme du texte
 *
 * `db.ts` ouvre IndexedDB : il ne s'importe pas dans Node. La liste des
 * magasins est donc lue dans le schéma, par son texte — et les commentaires
 * sont retirés AVANT, parce qu'une apostrophe française dans un commentaire
 * ouvre une fausse chaîne. La première version de cette lecture a rendu
 * quatre-vingt-neuf noms dont une quinzaine étaient des fragments de phrase.
 */
import { readFileSync } from 'node:fs';

const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

let echecs = 0;
function verifier(quoi, vrai, detail = '') {
  if (vrai) console.log(`  ${vert('✓')} ${quoi}`);
  else {
    echecs += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Le texte d'un fichier, sans ses commentaires. */
function sansCommentaires(chemin) {
  return readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/* ── Les magasins du schéma ───────────────────────────────────────────── */

const db = sansCommentaires('src/lib/db.ts');
const debutSchema = db.indexOf('extends DBSchema');
const finSchema = db.indexOf('\n}\n', debutSchema);
const schema = db.slice(debutSchema, finSchema);
const MAGASINS = [...schema.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);

/* ── Les étiquettes ───────────────────────────────────────────────────── */

const source = sansCommentaires('src/lib/intitules-magasins.ts');
const debut = source.indexOf('INTITULES_DES_MAGASINS');
const fin = source.indexOf('};', debut);
const ETIQUETTES = new Map(
  [...source.slice(debut, fin).matchAll(/^ {2}(\w+): '((?:[^'\\]|\\.)*)',$/gm)].map((m) => [
    m[1],
    m[2].replace(/\\'/g, "'"),
  ]),
);

console.log(`\n${gras('1. LA LECTURE A ABOUTI')}\n`);
console.log(`  ${MAGASINS.length} magasins au schéma · ${ETIQUETTES.size} étiquettes`);
/*
   LE TÉMOIN. Une lecture cassée — un schéma renommé, une forme d'écriture
   changée — rendrait deux listes vides, et toutes les comparaisons d'après
   passeraient au vert sans avoir rien comparé.
*/
verifier('le schéma a été lu', MAGASINS.length >= 50);
verifier('les étiquettes ont été lues', ETIQUETTES.size >= 50);

/* ── 2. La couverture, dans les deux sens ─────────────────────────────── */

console.log(`\n${gras('2. CHAQUE MAGASIN A SON ÉTIQUETTE, ET RÉCIPROQUEMENT')}\n`);

const sansEtiquette = MAGASINS.filter((m) => !ETIQUETTES.has(m));
verifier(
  'aucun magasin du schéma n’est sans étiquette',
  sansEtiquette.length === 0,
  sansEtiquette.join(', '),
);

const orphelines = [...ETIQUETTES.keys()].filter((n) => !MAGASINS.includes(n));
verifier(
  'aucune étiquette ne désigne un magasin disparu',
  orphelines.length === 0,
  `${orphelines.join(', ')} — retirez-les`,
);

/* ── 3. Ce qu'une étiquette doit être ─────────────────────────────────── */

console.log(`\n${gras('3. CE QU’UNE ÉTIQUETTE DOIT ÊTRE')}\n`);

const vides = [...ETIQUETTES].filter(([, e]) => e.trim().length < 4).map(([n]) => n);
verifier('aucune étiquette vide ou d’un mot tronqué', vides.length === 0, vides.join(', '));

/*
   RECOPIER L'IDENTIFIANT satisferait la couverture sans rien corriger : c'est
   la façon la plus simple de faire passer cet essai en laissant le défaut
   entier.

   MA PREMIÈRE RÈGLE ÉTAIT FAUSSE, et elle a refusé quatre étiquettes justes :
   « contient son identifiant » écarte « Fiches lues et leur avancement » pour
   le magasin `fiches`, « Notes prises en séance » pour `notes`, « Résultats
   des quiz de cours » pour `quiz`. Le mot français EST l'identifiant, dans ces
   cas-là, et c'est normal : les premiers magasins ont été nommés en français.

   La règle juste tient en deux formes, et toutes deux sont du technique :
   l'étiquette est l'identifiant MOT POUR MOT, ou elle contient un identifiant
   en casse de chameau — « odysseeEtapesCochees » dans une phrase française ne
   peut être qu'un copier-coller.
*/
const estTechnique = (n, e) =>
  e.trim().toLowerCase() === n.toLowerCase() || (/[A-Z]/.test(n) && e.includes(n));

const techniques = [...ETIQUETTES]
  .filter(([n, e]) => estTechnique(n, e))
  .map(([n, e]) => `${n} → « ${e} »`);
verifier(
  'aucune étiquette ne recopie son identifiant technique',
  techniques.length === 0,
  techniques.join(' ; '),
);

/*
   LE TÉMOIN DE LA RÈGLE, sur des cas fabriqués. Une règle resserrée après un
   faux positif peut l'être trop : sans ces quatre lignes, « ne refuse plus
   rien » et « refuse ce qu'il faut » se ressembleraient au vert.
*/
verifier('la règle prend une étiquette recopiée', estTechnique('odysseeNuits', 'odysseeNuits'));
verifier(
  'elle prend un identifiant collé dans une phrase',
  estTechnique('odysseeNuits', 'Table odysseeNuits du corps'),
);
verifier('elle laisse passer le mot français', !estTechnique('notes', 'Notes prises en séance'));
verifier('et elle laisse passer une étiquette sans rapport', !estTechnique('etat', 'Réglages et préférences'));

/* Deux rubriques distinctes doivent se distinguer à l'écran. */
const parEtiquette = new Map();
for (const [n, e] of ETIQUETTES) {
  if (!parEtiquette.has(e)) parEtiquette.set(e, []);
  parEtiquette.get(e).push(n);
}
const doubles = [...parEtiquette].filter(([, ns]) => ns.length > 1);
verifier(
  'deux magasins n’ont pas la même étiquette',
  doubles.length === 0,
  doubles.map(([e, ns]) => `« ${e} » : ${ns.join(' et ')}`).join(' ; '),
);

/*
   FORMAT G. La parenthèse du pluriel est écartée partout, et ces étiquettes
   s'affichent telles quelles, sans compteur devant : « Pesées », jamais
   « Pesée(s) ».
*/
const pluriels = [...ETIQUETTES].filter(([, e]) => /\((?:s|e|x|es)\)/.test(e)).map(([n]) => n);
verifier('aucune parenthèse de pluriel', pluriels.length === 0, pluriels.join(', '));

/* ── 4. Le refus tient toujours ───────────────────────────────────────── */

console.log(`\n${gras('4. LE REFUS À LA CONSTRUCTION EST TOUJOURS EN PLACE')}\n`);

/*
   Celui-là est un contrôle de SOURCE, et il est assumé comme tel. Le refus
   vit dans le frontmatter de la page, donc il s'exerce à la construction ;
   un essai de Node ne peut pas le déclencher sans construire le site entier.
   Ce qu'on peut tenir ici, c'est qu'il n'a pas été retiré — et c'est la
   régression plausible : on corrige un magasin manquant en commentant le
   contrôle, et plus rien ne le redit.
*/
const page = readFileSync('src/pages/stockage.astro', 'utf8');
const frontmatter = page.slice(0, page.indexOf('\n---', 3));
verifier(
  'le frontmatter de Stockage appelle « magasinsSansIntitule »',
  /magasinsSansIntitule\(\s*MAGASINS_SAUVEGARDES\s*\)/.test(frontmatter),
);
verifier(
  'et il lève une erreur quand il en trouve',
  /sansIntitule\.length > 0[\s\S]{0,200}throw new Error/.test(frontmatter),
);
/*
   Et la ligne n'affiche plus l'identifiant. La forme fautive est écrite en
   clair ici pour qu'on la reconnaisse si elle revient.
*/
verifier(
  'la ligne du tableau n’affiche plus le nom technique',
  !/nom\.textContent\s*=\s*m\.nom/.test(page) && /intituleDuMagasin\(m\.nom\)/.test(page),
);

console.log(
  echecs ? `\n${rouge(`${echecs} essai(s) en échec.`)}\n` : `\n${vert('Tous les essais passent.')}\n`,
);
process.exit(echecs ? 1 : 0);
