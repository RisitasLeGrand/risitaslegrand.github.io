/**
 * LA DÉCLARATION DES TRENTE-DEUX DISCRÈTES CONTRE LA FICHE DE RÉFÉRENCE.
 *
 * Prompt 63, lot « plancher par dimension ». Décision du pilote du 1er
 * novembre : « Un essai vérifie que la déclaration et la fiche concordent pour
 * les 32 dimensions discrètes. »
 *
 * ## CE QUE CET ESSAI MESURE
 *
 * Trois concordances, et chacune ferme une panne distincte :
 *
 * 1. **La déclaration contre la fiche**, dans les DEUX sens. Une dimension de
 *    la fiche absente du code, et une dimension du code absente de la fiche,
 *    sont deux fautes différentes : la première laisse une dimension sans
 *    plancher, la seconde en invente une. Un seul sens n'en verrait qu'une.
 * 2. **Le grain contre la règle**, là où la règle s'applique. Sur une échelle
 *    régulière, le grain se déduit du nombre de niveaux ; sur une
 *    logarithmique, il ne se déduit pas, et l'essai exige alors qu'il soit
 *    PLUS GROSSIER que la règle régulière — sans quoi l'étoile de la fiche ne
 *    voudrait rien dire.
 * 3. **Le résumé contre les colonnes.** La fiche porte un tableau récapitulatif
 *    écrit à la main, et elle dit elle-même qu'« un résumé se périme, une
 *    colonne extraite non ». Cet essai lit les deux et les compare, ce qui
 *    transforme cet aveu en garde.
 *
 * ## CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE
 *
 * Les deux côtés descendent de la même fiche : une erreur DE LA FICHE passerait
 * des deux côtés. Cet essai attrape les fautes de transcription, pas les
 * fautes d'extraction. Ce qui attrapera celles-là est le rendu, quand il
 * existera — `desaccordDeNiveaux` tient ce contrôle et compare la déclaration à
 * ce que la dimension montre pour de vrai.
 *
 * ## ET LE REFUS, QUI EST LA PREMIÈRE ASSERTION
 *
 * Un analyseur qui ne lit rien rend zéro anomalie, et zéro est ce que rend un
 * dépôt propre. Si la fiche change de forme — un tableau renommé, une colonne
 * déplacée —, cet essai ne doit pas devenir vert : il doit REFUSER, code 2.
 */
import { readFileSync } from 'node:fs';
import {
  DIMENSIONS_DISCRETES,
  NIVEAUX_MINIMUM,
} from '../src/features/veridical-mapping/dimensions-discretes';
import { REGLAGES } from '../src/features/veridical-mapping/escalier';

const FICHE = 'docs/cyclades/p63-dimensions-reference.md';

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(
    `${ok ? '  ✓' : '  ✗'} ${titre}` +
      (ok ? '' : `\n      obtenu ${JSON.stringify(obtenu)} · attendu ${JSON.stringify(attendu)}`),
  );
}

function refuser(pourquoi: string): never {
  console.error(`\n\x1b[31mREFUS\x1b[0m ${pourquoi}`);
  console.error(
    'Cet essai ne peut pas conclure. Un vert ici voudrait dire « aucune\n' +
      'discordance », alors qu’il voudrait dire « rien n’a été lu ».',
  );
  process.exit(2);
}

const texte = readFileSync(FICHE, 'utf8');

/* ── CE QUE LA FICHE PORTE ─────────────────────────────────────────────── */

/**
 * Un pourcentage de la fiche — « 16,7 % », « 24 %* » — en part de l'unité.
 *
 * L'étoile marque un grain mesuré sur la plage et non déduit ; elle est
 * relevée à part, parce que c'est elle qui dit quelle règle s'applique.
 */
function part(cellule: string): { valeur: number; etoile: boolean } | null {
  const m = cellule.match(/^([0-9]+(?:,[0-9]+)?)\s*%\\?(\*?)$/);
  if (!m) return null;
  return { valeur: Number(m[1].replace(',', '.')) / 100, etoile: m[2] === '*' };
}

interface LigneDeFiche {
  id: string;
  echelle: string;
  niveaux: number | null;
  grain: { valeur: number; etoile: boolean } | null;
}

const lignes: LigneDeFiche[] = [];
for (const ligne of texte.split('\n')) {
  if (!/^\|\s*`(vision|audition)\./.test(ligne)) continue;
  const cellules = ligne.split('|').map((c) => c.trim());
  /* | canonique | nom | ce qui varie | éch. | plage | niveaux | grain | roving | */
  if (cellules.length < 9) {
    refuser(
      `La fiche porte une ligne de dimension à ${cellules.length} cellules :\n  ${ligne.slice(0, 90)}\n` +
        'Les colonnes attendues sont neuf. La forme de la fiche a changé.',
    );
  }
  const id = cellules[1].replace(/`/g, '');
  const niveaux = /^[0-9]+$/.test(cellules[6]) ? Number(cellules[6]) : null;
  lignes.push({ id, echelle: cellules[4], niveaux, grain: part(cellules[7]) });
}

if (lignes.length === 0) {
  refuser(`Aucune ligne de dimension lue dans ${FICHE}.`);
}

const discretesDeLaFiche = lignes.filter((l) => l.niveaux !== null);

console.log('\nCE QUE LA FICHE PORTE');
verifier('cent vingt-trois dimensions en tout', lignes.length, 123);
verifier('trente-deux portent un nombre de niveaux', discretesDeLaFiche.length, 32);
verifier('et chacune de celles-là porte aussi un grain',
  discretesDeLaFiche.filter((l) => l.grain === null).map((l) => l.id), []);
verifier('trente-six échelles logarithmiques',
  lignes.filter((l) => l.echelle === 'log').length, 36);
verifier('vingt-quatre circulaires', lignes.filter((l) => l.echelle === 'circ').length, 24);
verifier('soixante-trois linéaires', lignes.filter((l) => l.echelle === 'lin').length, 63);

/* ── LA CONCORDANCE, DANS LES DEUX SENS ────────────────────────────────── */

console.log('\nLA DÉCLARATION CONTRE LA FICHE');
verifier('trente-deux dimensions déclarées', DIMENSIONS_DISCRETES.length, 32);

const parId = new Map(discretesDeLaFiche.map((l) => [l.id, l]));
const declares = new Set(DIMENSIONS_DISCRETES.map((d) => d.id));

verifier('aucune dimension déclarée n’est absente de la fiche',
  DIMENSIONS_DISCRETES.filter((d) => !parId.has(d.id)).map((d) => d.id), []);
verifier('aucune dimension discrète de la fiche n’est absente du code',
  discretesDeLaFiche.filter((l) => !declares.has(l.id)).map((l) => l.id), []);
verifier('aucun doublon dans les déclarations', declares.size, DIMENSIONS_DISCRETES.length);

/*
   LA TOLÉRANCE SUR LE GRAIN, et pourquoi elle vaut ce qu'elle vaut.

   La fiche imprime une décimale : « 16,7 % » pour 1/6, qui vaut 16,666…. La
   tolérance est donc la MOITIÉ du dernier chiffre imprimé, soit 0,0005, plus
   un epsilon pour le cas qui tombe pile dessus — 6,2 % pour 1/16 = 6,25 %.
   Plus serré rougirait sur un arrondi d'impression ; plus large laisserait
   passer l'écart de 17 % entre 1/n et 1/(n−1), qui est l'erreur à prendre.
*/
const TOLERANCE = 0.0005 + 1e-12;

for (const d of DIMENSIONS_DISCRETES) {
  const f = parId.get(d.id);
  if (f === undefined) continue;
  verifier(`« ${d.id} » — niveaux`, d.niveaux, f.niveaux);
  verifier(`« ${d.id} » — échelle`, d.echelle, f.echelle);
  verifier(`« ${d.id} » — rebouclage`, d.circulaire === true, f.echelle === 'circ');
  verifier(`« ${d.id} » — pire grain`,
    Math.abs(d.pireGrain - (f.grain?.valeur ?? -1)) <= TOLERANCE, true);
}

/* ── LE GRAIN CONTRE LA RÈGLE ──────────────────────────────────────────── */

console.log('\nLE GRAIN CONTRE LA RÈGLE');
for (const d of DIMENSIONS_DISCRETES) {
  const regle = d.circulaire ? 1 / d.niveaux : 1 / (d.niveaux - 1);
  if (d.echelle === 'log') {
    /*
       Sur une logarithmique, la règle régulière est un PLANCHER de la vérité,
       pas la vérité : le grain varie, et le pire est en bas de la plage. On
       exige donc strictement plus grossier, sans quoi l'étoile de la fiche ne
       signalerait rien.
    */
    verifier(`« ${d.id} » — logarithmique : le pire grain dépasse la règle régulière`,
      d.pireGrain > regle, true);
    verifier('  et la fiche marque bien ce grain d’une étoile',
      parId.get(d.id)?.grain?.etoile, true);
  } else {
    verifier(`« ${d.id} » — ${d.circulaire ? '1/n' : '1/(n−1)'} = ${regle.toFixed(4)}`,
      Math.abs(d.pireGrain - regle) <= TOLERANCE, true);
    verifier('  et la fiche ne la marque pas d’une étoile',
      parId.get(d.id)?.grain?.etoile, false);
  }
}

/*
   LA CONTRE-ÉPREUVE DE LA TOLÉRANCE : elle doit séparer les deux règles.

   Sans cette ligne, une tolérance trop large rendrait toutes les assertions
   ci-dessus vertes quelle que soit la règle employée — la garde se mesurerait
   à elle-même. On vérifie donc sur le cas le plus serré, seize niveaux
   circulaires, que l'autre règle serait bien REFUSÉE.
*/
const serre = DIMENSIONS_DISCRETES.find((d) => d.id === 'vision.motif_rotation');
verifier('la tolérance sépare 1/n de 1/(n−1), même à seize niveaux',
  serre !== undefined && Math.abs(serre.pireGrain - 1 / (serre.niveaux - 1)) > TOLERANCE, true);

/* ── LES DEUX RÈGLES DU PILOTE ─────────────────────────────────────────── */

console.log('\nLES DEUX RÈGLES DU PILOTE');
verifier('aucune dimension sous trois niveaux',
  DIMENSIONS_DISCRETES.filter((d) => d.niveaux < NIVEAUX_MINIMUM).map((d) => d.id), []);
/*
   LE RÉSULTAT QUI DÉCIDE DU LOT : les trente-deux ont un grain supérieur à la
   borne basse de l'escalier. Si l'une passait dessous, son plancher vaudrait
   la borne globale et elle se mesurerait comme une continue — ce que ce lot
   entier existe pour empêcher.
*/
verifier('les trente-deux ont un grain supérieur à la borne basse de l’escalier',
  DIMENSIONS_DISCRETES.filter((d) => d.pireGrain <= REGLAGES.deltaMinimum).map((d) => d.id), []);

/* ── LE RÉSUMÉ CONTRE LES COLONNES ─────────────────────────────────────── */

console.log('\nLE RÉSUMÉ ÉCRIT À LA MAIN CONTRE LES COLONNES EXTRAITES');
/*
   La fiche porte un tableau « grain | dimensions » qui regroupe les trente-deux
   par grain. Elle avertit elle-même qu'un résumé se périme. On le relit donc :
   chaque grain annoncé doit se retrouver sur chaque dimension nommée en face.
*/
const resume: [number, string[]][] = [];
for (const ligne of texte.split('\n')) {
  /*
     L'ÉTOILE S'ÉCRIT DE DEUX FAÇONS DANS LA MÊME FICHE : nue dans les tableaux
     par groupe, échappée « \* » dans le résumé, où Markdown la prendrait
     sinon pour une emphase. La lecture tolère les deux, et c'est une mesure :
     sans le `\\?`, les deux dimensions logarithmiques manquaient au résumé et
     l'assertion de couverture les a nommées.
  */
  const m = ligne.match(/^\|\s*([0-9]+(?:,[0-9]+)?)\s*%\\?\*?\s*\|\s*(`[^|]+)\|/);
  if (!m) continue;
  const noms = [...m[2].matchAll(/`([a-z_.]+)`/g)].map((x) => x[1]);
  if (noms.length === 0) continue;
  resume.push([Number(m[1].replace(',', '.')) / 100, noms]);
}
if (resume.length === 0) {
  refuser('Le tableau récapitulatif « grain | dimensions » n’a pas été lu.');
}
/*
   LES NOMS DU RÉSUMÉ SONT COURTS, SAUF QUAND ILS NE PEUVENT PAS L'ÊTRE.

   « nesting_depth » désigne les deux homonymes, l'une en vision et l'autre en
   audition ; « audition.spectral_complexity » porte son nom entier, parce
   qu'elle n'a pas d'homonyme et que la fiche la nomme ainsi. Un nom court
   s'étend donc à toutes les dimensions qui le portent, un nom entier à elle
   seule — et dans le premier cas on exige le grain annoncé de CHACUNE : un
   résumé vrai pour l'une des deux et faux pour l'autre ne le dirait pas.

   Vingt libellés pour trente-deux dimensions : le compte des libellés ne vaut
   donc rien. Ce qui vaut est la COUVERTURE — aucune des trente-deux ne doit
   manquer au résumé, et c'est l'assertion qui suit la boucle.
*/
const couvertes = new Set<string>();
for (const [grain, noms] of resume) {
  for (const nom of noms) {
    const portant = nom.includes('.')
      ? DIMENSIONS_DISCRETES.filter((d) => d.id === nom)
      : DIMENSIONS_DISCRETES.filter((d) => d.id.endsWith(`.${nom}`));
    verifier(`« ${nom} » existe dans les déclarations`, portant.length > 0, true);
    for (const d of portant) {
      couvertes.add(d.id);
      verifier(`  « ${d.id} » : le résumé annonce ${(100 * grain).toFixed(1)} %`,
        Math.abs(d.pireGrain - grain) <= TOLERANCE, true);
    }
  }
}
verifier('le résumé ne laisse aucune des trente-deux de côté',
  DIMENSIONS_DISCRETES.filter((d) => !couvertes.has(d.id)).map((d) => d.id), []);

console.log(`\n${echecs ? `\x1b[31m✖ ${echecs} échec(s)\x1b[0m` : '\x1b[32m✓ tout concorde\x1b[0m'}\n`);
process.exit(echecs ? 1 : 0);
