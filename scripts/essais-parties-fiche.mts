/**
 * Les parties d'une fiche : identifiants stables, ancres, contrôles.
 *
 *   npm run essais:parties-fiche
 *
 * Le prompt 46 demande trois choses de P1, et les voici toutes les trois :
 *
 * 1. **« Un titre corrigé garde son identifiant »** — c'est la raison d'être
 *    de tout le prompt. Si l'identifiant suivait le texte du titre, une
 *    coquille corrigée détacherait un repère audio, une carte rattachée et
 *    une séance qui dit avoir vu la partie.
 * 2. **« Un identifiant en double fait échouer le build »**, et une carte
 *    qui cite une partie absente aussi.
 * 3. **Les anciennes ancres restent atteignables** : des liens vers elles
 *    sont déjà enregistrés.
 *
 * Les fiches sont de laboratoire : trois titres, deux cartes. Mesurer sur
 * les vraies prendrait une minute et ne dirait rien de plus — ce sont les
 * règles qu'on éprouve, pas le contenu.
 */
import {
  decouperSections,
  extraireParties,
  extraireSommaire,
  poserLesIdentifiants,
  rendreHtml,
} from './lib/markdown.mjs';
import { defautsDesParties, titresSansIdentifiant } from './lib/parties.mjs';

let rouges = 0;
const verifier = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`\x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  console.log(
    `\x1b[31m✗\x1b[0m ${quoi}\n    attendu : ${JSON.stringify(attendu)}\n    obtenu  : ${JSON.stringify(obtenu)}`,
  );
  rouges += 1;
};

const html = (markdown: string) => {
  const { markdown: propre, parties } = extraireParties(markdown);
  return { html: poserLesIdentifiants(rendreHtml(propre, new Map()), parties), parties };
};

/* ── 1. Le marqueur se lit, et ne se voit pas ────────────────────────────── */

console.log('\nLE MARQUEUR');
const COURS = `### Introduction {#intro}

Un paragraphe.

### I. Les contraintes {#contraintes}

#### 1. Un sous-titre sans identifiant

Un autre paragraphe.

\`\`\`
### Un titre dans un bloc de code {#piege}
\`\`\`
`;
const premier = html(COURS);
verifier(
  'les titres de niveau 2 et 3 deviennent des parties, pas ceux de niveau 4',
  premier.parties.map((p) => p.id),
  ['intro', 'contraintes'],
);
/*
   L'assertion porte sur les TITRES, pas sur le document : le bloc de code
   ci-dessus contient « {#piege} », et il doit le contenir encore — c'est du
   texte que l'auteur a écrit entre trois accents graves. La première version
   cherchait « {# » partout et accusait le rendu d'un marqueur qui n'était
   pas un marqueur.
*/
const titresRendus = [...premier.html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => m[1]);
verifier(
  'aucun titre rendu ne porte de marqueur',
  titresRendus.some((t) => t.includes('{#')),
  false,
);
verifier('et le bloc de code garde son texte, marqueur compris', premier.html.includes('{#piege}'), true);
verifier(
  'un titre dans un bloc de code n’est pas une partie',
  premier.parties.some((p) => p.id === 'piege'),
  false,
);
verifier(
  'l’identifiant déclaré est celui du titre rendu',
  extraireSommaire(premier.html).map((s) => s.id),
  ['intro', 'contraintes'],
);

/* ── 2. Un titre corrigé garde son identifiant ───────────────────────────── */

console.log('\nUN TITRE CORRIGÉ');
const CORRIGE = COURS.replace('### I. Les contraintes {#contraintes}', '### I. Les contraintes de l’adaptation {#contraintes}');
const apres = html(CORRIGE);
verifier(
  'l’identifiant ne bouge pas quand le titre change',
  extraireSommaire(apres.html).map((s) => s.id),
  ['intro', 'contraintes'],
);
verifier(
  'et le titre affiché, lui, est bien le nouveau',
  extraireSommaire(apres.html)[1].titre,
  'I. Les contraintes de l’adaptation',
);
verifier(
  'l’ancienne ancre du titre corrigé reste atteignable',
  /<span id="i-les-contraintes-de-ladaptation" class="ancre-ancienne"/.test(apres.html),
  true,
);

/*
   SANS IDENTIFIANT, LE DÉFAUT REVIENT — et c'est la mesure qui le prouve,
   pas la confiance : la même correction sur un titre sans marqueur change
   l'ancre, et tout ce qui s'y rattachait tombe à côté.
*/
const SANS = COURS.replace(' {#contraintes}', '');
const SANS_CORRIGE = CORRIGE.replace(' {#contraintes}', '');
verifier(
  'sans marqueur, la même correction CHANGE l’ancre (le défaut que P1 supprime)',
  extraireSommaire(html(SANS).html)[1].id !== extraireSommaire(html(SANS_CORRIGE).html)[1].id,
  true,
);
verifier(
  'un titre sans marqueur est compté comme non déclaré',
  titresSansIdentifiant(
    extraireSommaire(html(SANS).html).map((s, i) => ({
      ...s,
      declare: Boolean(html(SANS).parties[i]?.id),
    })),
  ),
  1,
);

/* ── 3. Les contrôles du build ───────────────────────────────────────────── */

console.log('\nLES CONTRÔLES');
const parties = [
  { id: 'intro', titre: 'Introduction', niveau: 3, declare: true },
  { id: 'contraintes', titre: 'I. Les contraintes', niveau: 3, declare: true },
];

verifier(
  'une fiche saine ne produit aucun défaut',
  defautsDesParties('fiche.md', parties, [['## Flashcards', [{ question: 'q', partie: 'intro' }]]]),
  [],
);

const double = [...parties, { id: 'intro', titre: 'Encore l’introduction', niveau: 3, declare: true }];
verifier(
  'deux parties du même identifiant : un défaut, qui les nomme toutes les deux',
  defautsDesParties('fiche.md', double, []).length,
  1,
);
verifier(
  'et le message dit lequel',
  defautsDesParties('fiche.md', double, [])[0].includes('« intro »'),
  true,
);

verifier(
  'une carte qui cite une partie absente : un défaut',
  defautsDesParties('fiche.md', parties, [
    ['## Flashcards', [{ question: 'Une question', partie: 'inconnue' }]],
  ]).length,
  1,
);
verifier(
  'une carte sans partie : aucun défaut — l’absence veut dire « la fiche entière »',
  defautsDesParties('fiche.md', parties, [['## Flashcards', [{ question: 'Une question' }]]]),
  [],
);

/* ── 4. Le découpage en sections ne change pas ───────────────────────────── */

console.log('\nLE RESTE NE BOUGE PAS');
const FICHE = `## Cours complet

### Un titre {#un-titre}

Du texte.

## Flashcards

- q: Une question ?
  r: Une réponse.
`;
const { sections } = decouperSections(FICHE);
verifier('le cours est toujours découpé comme avant', sections.cours.includes('### Un titre'), true);
verifier('et les flashcards aussi', sections.flashcards.includes('- q:'), true);

console.log(rouges === 0 ? '\n\x1b[32mTout est vert.\x1b[0m' : `\n\x1b[31m${rouges} rouge(s).\x1b[0m`);
process.exit(rouges === 0 ? 0 : 1);
