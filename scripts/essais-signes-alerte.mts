/**
 * Chaque phrase affichée se retrouve dans sa source. Règle 7 du complément D2.
 *
 *   npm run essais:signes-alerte
 *
 * ## Pourquoi cet essai est le cœur du lot, et non son contrôle final
 *
 * Le lot entier repose sur une promesse : « aucune phrase de Cyclades, rien
 * que les citations ». Une promesse de ce genre ne se tient pas par la
 * relecture — j'ai recopié une trentaine de citations à la main, et une
 * faute de recopie est exactement le genre de chose qu'un œil ne voit pas
 * deux fois de suite. C'est cet essai qui la trouve.
 *
 * ## Ce que la comparaison tolère, et pourquoi la liste est si courte
 *
 * La règle 1 nomme deux écarts et deux seulement : la **typographie**
 * (apostrophes, espaces insécables) et la **correction du doublon « votre
 * votre »**.
 *
 * La typographie est normalisée des deux côtés : apostrophes ramenées à une
 * seule forme, espaces insécables et fines ramenées à l'espace ordinaire,
 * suites d'espaces réduites. **Aucun mot, aucune ponctuation, aucune casse.**
 * La collecte prévient elle-même que ses citations ont été recollées par
 * fragments et que les espaces insécables ne sont pas garanties — une
 * comparaison octet pour octet rougirait donc pour une raison qui n'a rien à
 * voir avec l'écran.
 *
 * La correction du doublon est traitée **explicitement**, par une liste
 * déclarée dans le module, et non en élargissant la normalisation. La
 * différence est tout l'intérêt : une normalisation qui tolérerait un mot
 * répété tolérerait aussi n'importe quel mot répété.
 *
 * ## Ce qu'il ne garde pas, et c'est écrit dans les décisions en attente
 *
 * Il garde la fidélité de l'écran **à la collecte**. Il ne garde pas la
 * fidélité de la collecte **aux pages** : celle-là demande la vérification
 * visuelle d'Alexis, qui reste à faire.
 */
import { readFileSync } from 'node:fs';
import {
  COLLECTE_LE,
  CORRECTIONS_PERMISES,
  controlerLesSignesDAlerte,
  NIVEAUX,
  PAGES_CITEES,
  SOURCE_ECARTEE,
  TOUTES_LES_CITATIONS,
} from '../src/lib/odyssee/cycle-signes-alerte';

const COLLECTE = 'docs/cyclades/collectes/D2-signes-alerte-regles-2026-10-19.md';
const COMPLEMENT = 'docs/cyclades/collectes/D2-complement-regles-2026-10-19.md';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

/**
 * La typographie normalisée, et rien d'autre.
 *
 * Les quatre familles d'apostrophe que les pages et la collecte mélangent,
 * les espaces insécables et fines, et les suites d'espaces — y compris
 * celles que la concaténation de chaînes TypeScript peut introduire. Les
 * mots, la ponctuation et la casse sont intacts.
 */
const typographieNormalisee = (texte: string) =>
  texte
    .replace(/[’‘`´]/g, "'")
    .replace(/[    ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const collecte = typographieNormalisee(readFileSync(COLLECTE, 'utf8'));
const complement = typographieNormalisee(readFileSync(COMPLEMENT, 'utf8'));

/** Le texte tel qu'il faut le chercher dans la collecte : corrections défaites. */
const commeDansLaCollecte = (texte: string) => {
  let brut = texte;
  for (const { avant, apres } of CORRECTIONS_PERMISES) {
    brut = brut.replace(typographieNormalisee(apres), typographieNormalisee(avant));
  }
  return brut;
};

/* ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LES DEUX DOCUMENTS SONT LÀ');

v('la collecte est lisible', collecte.length > 3000, true);
v('le complément est lisible', complement.length > 1000, true);
v('et le complément porte bien huit règles', /8\.\s\*\*Mention dans le compte rendu/.test(complement), true);

console.log('\n2. CHAQUE CITATION SE RETROUVE DANS LA COLLECTE (RÈGLE 7)');

const introuvables = TOUTES_LES_CITATIONS.filter(
  (c) => !collecte.includes(commeDansLaCollecte(typographieNormalisee(c.texte))),
).map((c) => `[source ${c.source}] ${c.texte.slice(0, 70)}…`);
v(`les ${TOUTES_LES_CITATIONS.length} citations sont dans la collecte`, introuvables, []);

/*
   ET L'INTITULÉ DU PREMIER NIVEAU AUSSI, parce qu'il EST une citation. Les
   deux autres ne le sont pas, et c'est déclaré : les chercher dans la
   collecte échouerait, et la tentation serait de les y faire entrer.
*/
const premier = NIVEAUX[0];
v('le premier niveau se déclare cité', premier.sourceDeLIntitule, '1');
v(
  'et son intitulé est dans la collecte',
  collecte.includes(typographieNormalisee(premier.intitule)),
  true,
);
for (const niveau of NIVEAUX.slice(1)) {
  v(
    `« ${niveau.intitule} » se déclare comme formulation du complément`,
    niveau.sourceDeLIntitule,
    null,
  );
  v(
    `et « ${niveau.intitule} » est bien dans le complément`,
    complement.includes(typographieNormalisee(niveau.intitule)),
    true,
  );
}

console.log('\n3. LA SEULE CORRECTION PERMISE EST DÉCLARÉE, ET ELLE SERT');

v('une seule correction est déclarée', CORRECTIONS_PERMISES.length, 1);
const doublon = CORRECTIONS_PERMISES[0];
/*
   LES DEUX SENS. La collecte porte le doublon — sinon la correction serait
   une invention. Et le module ne le porte pas — sinon elle n'aurait pas été
   appliquée.
*/
v('la collecte porte bien le doublon', collecte.includes(typographieNormalisee(doublon.avant)), true);
v(
  'et aucune citation du module ne le porte',
  TOUTES_LES_CITATIONS.filter((c) => typographieNormalisee(c.texte).includes(typographieNormalisee(doublon.avant))),
  [],
);
v(
  'une citation porte la version corrigée',
  TOUTES_LES_CITATIONS.filter((c) => typographieNormalisee(c.texte).includes(typographieNormalisee(doublon.apres))).length,
  1,
);

console.log('\n4. LE 15 N’EST QU’AU PREMIER NIVEAU (RÈGLE 2)');

v('le module ne relève aucun problème', controlerLesSignesDAlerte(), []);
v('le premier niveau nomme le 15', /(?<![\d,.])15(?![\d,.])/.test(premier.intitule), true);
const textesDesAutres = NIVEAUX.slice(1).flatMap((n) => [
  n.intitule,
  ...n.groupes.flatMap((g) => [
    ...(g.introduction ? [g.introduction.texte] : []),
    ...g.items.map((i) => i.texte),
  ]),
]);
v(
  'et aucun des deux autres ne le nomme',
  textesDesAutres.filter((t) => /(?<![\d,.])15(?![\d,.])/.test(t)),
  [],
);

console.log('\n5. LA SOURCE 5 N’APPARAÎT PAS (RÈGLE 3)');

v('elle est déclarée écartée, avec sa raison', SOURCE_ECARTEE.pourquoi.length > 40, true);
v(
  'aucune page citée ne porte son numéro',
  PAGES_CITEES.filter((p) => p.numero === SOURCE_ECARTEE.numero),
  [],
);
v(
  'aucune citation ne la nomme',
  TOUTES_LES_CITATIONS.filter((c) => c.source === `${SOURCE_ECARTEE.numero}`),
  [],
);
/*
   ET AUCUNE DE SES PHRASES N'A ÉTÉ REPRISE SANS SON NUMÉRO. Vérifier le
   numéro ne suffit pas : une citation de la source 5 étiquetée « 2 » aurait
   passé les trois assertions précédentes. On cherche donc ses mots.
*/
const motsDeLaSourceCinq = [
  'La jeune fille apprendra à quantifier',
  'des changes de moins de 2 heures',
  'Le bilan biologique peut être réalisé',
  'anémie mal tolérée',
];
v(
  'et aucune de ses phrases n’est reprise, même sous un autre numéro',
  motsDeLaSourceCinq.filter((mot) =>
    TOUTES_LES_CITATIONS.some((c) => typographieNormalisee(c.texte).includes(typographieNormalisee(mot))),
  ),
  [],
);

console.log('\n6. LES SOURCES ET LEURS DATES SONT AFFICHABLES (RÈGLE 4)');

v('quatre pages sont citées', PAGES_CITEES.length, 4);
v(
  'chacune porte sa date de mise à jour',
  PAGES_CITEES.filter((p) => !p.misAJourLe.trim()),
  [],
);
v(
  'et chaque date est celle que la collecte relève',
  PAGES_CITEES.filter((p) => !collecte.includes(typographieNormalisee(p.misAJourLe))),
  [],
);
v(
  'chaque adresse est celle de la collecte',
  PAGES_CITEES.filter((p) => !collecte.includes(p.adresse)),
  [],
);
v('la date de collecte est affichable', COLLECTE_LE, '19 octobre 2026');

console.log('\n7. RIEN NE SE DÉCLENCHE DEPUIS UNE SAISIE (RÈGLE 5)');

/*
   LA RÈGLE 5 SE VÉRIFIE SUR LA FORME DU MODULE, et c'est ce qui la rend
   tenable : aucune fonction exportée ne prend de saisie, de jour ou de
   niveau de saignement en paramètre. Il n'y a donc pas de chemin par lequel
   la liste pourrait se déclencher d'après le suivi — pas même un chemin
   qu'on aurait oublié de ne pas emprunter.
*/
const module = readFileSync('src/lib/odyssee/cycle-signes-alerte.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
v(
  'aucune fonction du module ne reçoit une saisie',
  /export function \w+\([^)]*(Saisie|saisie|niveau|jour|Niveau)/.test(module),
  false,
);
v(
  'et le module n’importe rien du journal',
  /from '\.\/cycle'|donnees-cycle|coffre/.test(module),
  false,
);

console.log(
  echecs === 0
    ? `\n\x1b[32m${TOUTES_LES_CITATIONS.length} citations, ${NIVEAUX.length} niveaux, ` +
        `${PAGES_CITEES.length} pages datées. Toutes retrouvées dans la collecte.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
