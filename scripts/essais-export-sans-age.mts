/**
 * L'âge ne sort pas (U1 du prompt 43).
 *
 *   npm run essais:export-sans-age
 *
 * ## Le défaut, tel qu'il a été constaté
 *
 * Le registre des usages promet, mot pour mot, pour l'export d'une tranche
 * d'âge : « Une case décochée dans l'aperçu d'export. **L'année n'y figure
 * jamais.** » Or `lireProfilPourExport` n'écartait que le prénom et le nom.
 * L'année de naissance, le mois et la majorité déclarée sortaient dès que la
 * case « Profil » était cochée.
 *
 * Et la case, elle, s'intitulait « Profil (hors prénom et nom) » : exacte au
 * mot, muette sur le reste. Sur une case qui fait sortir des données vers un
 * tiers, taire et mentir se valent.
 *
 * ## Ce que cet essai garde, et pourquoi il est pur
 *
 * La règle qui décide ce qui sort est une fonction pure du noyau,
 * `repartirProfilPourExport` : on lui passe des champs et des cases cochées,
 * elle rend deux objets. Aucune base, aucun coffre, aucun navigateur — donc
 * aucune raison de ne pas la lancer à chaque fois.
 *
 * On éprouve les quatre combinaisons de cases, parce qu'une interdiction qui
 * ne tiendrait que dans un cas n'est pas une interdiction.
 *
 * ## Ce qu'il ne peut pas garder
 *
 * Que le module d'export appelle bien cette fonction. Ça se lit dans
 * `src/lib/export-ia.ts`, et c'est l'essai de l'export dans un navigateur
 * qui le constate de bout en bout. Le dire plutôt que le laisser croire.
 */
import { readFileSync } from 'node:fs';
import {
  CHAMPS,
  CHAMPS_JAMAIS_EXPORTES,
  CHAMPS_OBJECTIF,
  repartirProfilPourExport,
} from '../src/lib/noyau/profil.ts';
import { CATEGORIES } from '../src/lib/odyssee/export-ia.ts';

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

/** Les trois déclarations qui disent l'âge, et les deux qui disent le nom. */
const AGE = ['naissanceAnnee', 'naissanceMois', 'majeurDeclare'];
const IDENTITE = ['prenom', 'nom'];

/* ── 1. Les cinq champs sont déclarés comme ne sortant jamais ───────────── */

console.log('\n\x1b[1mCE QUI EST DÉCLARÉ COMME NE SORTANT JAMAIS\x1b[0m\n');

for (const nom of [...IDENTITE, ...AGE]) {
  v(`« ${nom} » porte le drapeau`, CHAMPS_JAMAIS_EXPORTES.includes(nom), true);
  v(
    `  … et il est bien déclaré au catalogue`,
    CHAMPS.some((c) => c.champ === nom && c.jamaisExporte === true),
    true,
  );
}
v(
  'la liste n’en contient pas d’autres, et n’a pas grossi en silence',
  [...CHAMPS_JAMAIS_EXPORTES].sort(),
  [...IDENTITE, ...AGE].sort(),
);

/* ── 2. La règle, dans les quatre combinaisons de cases ─────────────────── */

console.log('\n\x1b[1mL’ÂGE NE SORT DANS AUCUNE COMBINAISON DE CASES\x1b[0m\n');

/*
   Un profil d'essai complet : les cinq interdits, un champ ordinaire, et un
   champ d'objectif. Les valeurs sont fabriquées — aucune donnée réelle n'est
   lue par cet essai.
*/
const PROFIL_ESSAI: readonly (readonly [string, unknown])[] = [
  ['prenom', 'Prénom d’essai'],
  ['nom', 'Nom d’essai'],
  ['naissanceAnnee', 1990],
  ['naissanceMois', 3],
  ['majeurDeclare', true],
  ['reveil', '07:00'],
  ['objectifsAnnee', 'Réussir le concours'],
];

for (const cases of [[], ['profil'], ['objectifs'], ['profil', 'objectifs']]) {
  const { profil, objectifs } = repartirProfilPourExport(PROFIL_ESSAI, cases);
  const sortis = [...Object.keys(profil), ...Object.keys(objectifs)];
  const etiquette = cases.length ? cases.join(' + ') : 'aucune case';
  v(
    `${etiquette} — aucun des trois champs d’âge ne sort`,
    sortis.filter((n) => AGE.includes(n)),
    [],
  );
  v(
    `${etiquette} — ni le prénom ni le nom`,
    sortis.filter((n) => IDENTITE.includes(n)),
    [],
  );
}

/* ── 3. Et ce qui doit sortir sort bien ─────────────────────────────────── */

console.log('\n\x1b[1mCE QUI DOIT SORTIR SORT, SINON LA CASE NE SERT À RIEN\x1b[0m\n');

{
  const rien = repartirProfilPourExport(PROFIL_ESSAI, []);
  v('aucune case : rien ne sort du tout', [Object.keys(rien.profil).length, Object.keys(rien.objectifs).length], [0, 0]);

  const p = repartirProfilPourExport(PROFIL_ESSAI, ['profil']);
  v('case « profil » : le champ ordinaire sort', p.profil.reveil, '07:00');
  v('et l’objectif reste dedans', Object.keys(p.objectifs), []);

  const o = repartirProfilPourExport(PROFIL_ESSAI, ['objectifs']);
  v('case « objectifs » : l’objectif sort', o.objectifs.objectifsAnnee, 'Réussir le concours');
  v('et le champ ordinaire reste dedans', Object.keys(o.profil), []);

  v('les champs d’objectif sont déclarés au noyau', CHAMPS_OBJECTIF.includes('objectifsAnnee'), true);
  v(
    'et aucun champ d’objectif ne porte le drapeau d’interdiction',
    CHAMPS_OBJECTIF.filter((n) => CHAMPS_JAMAIS_EXPORTES.includes(n)),
    [],
  );
}

/* ── 4. La case le dit, et le registre dit vrai ─────────────────────────── */

console.log('\n\x1b[1mLA CASE LE DIT, ET LE REGISTRE DIT VRAI\x1b[0m\n');

{
  const profil = CATEGORIES.find((c) => c.id === 'profil');
  v('la catégorie « profil » existe', Boolean(profil), true);
  const dit = `${profil?.libelle ?? ''} ${profil?.description ?? ''}`;
  v('son libellé annonce l’exclusion de l’identité', /identité/i.test(dit), true);
  v('et celle de l’âge', /âge/i.test(dit), true);
  v(
    'elle ne promet plus seulement « hors prénom et nom »',
    /hors prénom et nom/i.test(dit),
    false,
  );
  v('elle reste décochée par défaut', profil?.parDefaut, false);

  /*
     La promesse du registre et le code doivent dire la même chose. L'essai
     lit la phrase dans le fichier plutôt que d'importer le registre : c'est
     la phrase LUE PAR LA PERSONNE à l'écran qui engage, et c'est elle qui
     doit rester vraie.
  */
  const registre = readFileSync('src/lib/noyau/registre-usages.ts', 'utf8');
  v(
    'le registre promet toujours que l’année n’y figure jamais',
    /L’année n’y figure jamais/.test(registre),
    true,
  );
}

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
