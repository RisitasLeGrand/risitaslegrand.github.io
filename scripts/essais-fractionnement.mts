/**
 * Essais de l'éditeur de parts — 3 bis, le fractionnement.
 *
 * Trois propriétés, et chacune a coûté un défaut ailleurs dans ce projet.
 *
 *   1. **Les parts somment au centime.** Pas « à l'arrondi près ». Un
 *      centime orphelin fait échouer le rapprochement de solde, et le
 *      message qu'on lit alors ne parle ni de centime ni de part.
 *   2. **Les parts portent le signe de leur opération.** Des parts positives
 *      sur une dépense la feraient compter en recette, et l'erreur serait
 *      silencieuse : les deux moitiés s'afficheraient au bon endroit avec le
 *      mauvais signe. C'est la même famille de défaut que le `abs(part)` de
 *      la phase 3, qui lisait un remboursement net comme une dépense.
 *   3. **Un geste de correction ne crée pas une erreur de plus.** Retirer
 *      une part ou en ajouter une laisse toujours un état réparable ; sinon
 *      l'écran répond à une correction par un reproche.
 */
import {
  PARTS_MAXIMALES,
  PARTS_MINIMALES,
  ajouterUnePart,
  controlerLeFractionnement,
  controlerLesParts,
  mettreLeResteSur,
  partsDeDepart,
  partEnPourcentage,
  phraseDuReste,
  repartirEnParts,
  resteARepartir,
  retirerUnePart,
} from '../src/lib/odyssee/fractionnement';
import { controlerPointage, type PartPointee, type Pointage } from '../src/lib/odyssee/pointage';
import { vueDesCategories } from '../src/lib/odyssee/categories-pointees';
import { categorieDuType } from '../src/lib/odyssee/taxonomie';
import type { OperationBancaire } from '../src/lib/odyssee/finances';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(
    titre,
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );

const operation = (centimes: number, bout: Partial<OperationBancaire> = {}): OperationBancaire =>
  ({
    id: 'op-1',
    compteId: 'c1',
    jour: '2026-10-02',
    libelle: 'CB SUPERMARCHE',
    centimes,
    devise: 'EUR',
    ...bout,
  }) as OperationBancaire;

const COURSES = operation(-12_000);

/* ══════════════════════════════════════════════════════════════════════════
   1. Le partage en parts égales boucle toujours
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LE PARTAGE EN PARTS ÉGALES');
{
  egal('1.1 cent vingt euros en deux', repartirEnParts(COURSES, 2, 'supermarche').map((p) => p.centimes),
    [-6_000, -6_000]);

  /*
     Le cas indivisible, celui qui fait tout échouer en silence : 100 € en
     trois parts. Le reste va sur la dernière, comme dans « diviser() ».
  */
  const trois = repartirEnParts(operation(-10_000), 3, 'supermarche');
  egal('1.2 cent euros en trois : le reste va sur la dernière',
    trois.map((p) => p.centimes), [-3_333, -3_333, -3_334]);
  egal('1.3 et la somme est exacte', resteARepartir(operation(-10_000), trois), 0);

  verifier('1.4 le plancher est respecté même si l’on demande moins',
    repartirEnParts(COURSES, 1, 'supermarche').length === PARTS_MINIMALES);
  verifier('1.5 le plafond aussi',
    repartirEnParts(COURSES, 99, 'supermarche').length === PARTS_MAXIMALES);

  egal('1.6 une recette se partage comme une dépense, en positif',
    repartirEnParts(operation(7_501), 2, 'virement-epargne').map((p) => p.centimes), [3_750, 3_751]);

  egal('1.7 le garde-fou ne trouve rien à redire', controlerLeFractionnement(), []);
}

console.log('\n1 bis. L’OUVERTURE DE L’ÉDITEUR');
{
  /*
     L'éditeur doit s'ouvrir sur un état **enregistrable**. La première
     version ouvrait sur deux parts du type courant, donc sur deux parts du
     même type, donc sur une erreur : l'écran accueillait par un reproche
     quelqu'un qui n'avait encore rien fait.
  */
  const depart = partsDeDepart(COURSES, 'supermarche');
  egal('1.8 deux parts égales à l’ouverture', depart.map((p) => p.centimes), [-6_000, -6_000]);
  egal('1.9 la première garde le type courant', depart[0].typeId, 'supermarche');
  egal('1.10 la seconde est « à identifier », pas un doublon', depart[1].typeId, 'a-identifier');
  egal('1.11 et l’état d’ouverture est valide', controlerLesParts(COURSES, depart), []);

  const sansType = partsDeDepart(COURSES, null);
  egal('1.12 sans type courant, l’ouverture reste valide',
    controlerLesParts(COURSES, sansType), []);
  verifier('1.13 et les deux types diffèrent', sansType[0].typeId !== sansType[1].typeId,
    JSON.stringify(sansType));
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Les gestes de l'éditeur
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. LES GESTES');
{
  let parts = repartirEnParts(COURSES, 2, 'supermarche');
  parts = [{ typeId: 'supermarche', centimes: -7_000 }, { typeId: 'travaux-bricolage', centimes: -5_000 }];
  egal('2.1 un partage saisi à la main peut boucler', resteARepartir(COURSES, parts), 0);

  // On diminue une part : il reste quelque chose, et la phrase le dit.
  const diminuee: PartPointee[] = [{ typeId: 'supermarche', centimes: -4_000 }, parts[1]];
  egal('2.2 le reste est signé comme l’opération', resteARepartir(COURSES, diminuee), -3_000);
  verifier('2.3 et la phrase le dit en euros',
    phraseDuReste(COURSES, diminuee).includes('Il reste') &&
      phraseDuReste(COURSES, diminuee).includes('30,00'),
    phraseDuReste(COURSES, diminuee));

  // Ajouter une part : elle prend le reste.
  const avecTroisieme = ajouterUnePart(COURSES, diminuee, 'restaurant');
  egal('2.4 la part ajoutée prend le reste',
    avecTroisieme.map((p) => p.centimes), [-4_000, -5_000, -3_000]);
  egal('2.5 et l’ensemble boucle aussitôt', resteARepartir(COURSES, avecTroisieme), 0);

  /*
     Ajouter une part alors que tout est déjà réparti : elle naîtrait à zéro,
     donc invalide, en réponse à un geste parfaitement raisonnable. Elle
     prend donc la moitié de la plus grosse.
  */
  const surUnTout = ajouterUnePart(COURSES, parts, 'restaurant');
  egal('2.6 sur un partage complet, la nouvelle part prend la moitié de la plus grosse',
    surUnTout.map((p) => p.centimes), [-3_500, -5_000, -3_500]);
  egal('2.7 et rien ne déborde', resteARepartir(COURSES, surUnTout), 0);

  // Retirer une part : son montant revient sur la plus grosse des restantes.
  const sansLaDeuxieme = retirerUnePart(avecTroisieme, 1);
  egal('2.8 retirer une part reverse son montant sur la plus grosse',
    sansLaDeuxieme.map((p) => [p.typeId, p.centimes]),
    [['supermarche', -9_000], ['restaurant', -3_000]]);
  egal('2.9 et l’ensemble boucle encore', resteARepartir(COURSES, sansLaDeuxieme), 0);

  // Poser le reste sur une part choisie.
  egal('2.10 le reste se pose où on le demande',
    mettreLeResteSur(COURSES, diminuee, 1).map((p) => p.centimes), [-4_000, -8_000]);

  egal('2.11 le pourcentage se lit sur l’opération',
    parts.map((p) => partEnPourcentage(p, COURSES)), [58.333333333333336, 41.66666666666667]);
  egal('2.12 une opération nulle n’a pas de pourcentage',
    partEnPourcentage({ typeId: 'supermarche', centimes: 0 }, operation(0)), null);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Le contrôle refuse ce qu'il doit refuser
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. CE QUI EST REFUSÉ');
{
  const bon: PartPointee[] = [
    { typeId: 'supermarche', centimes: -7_000 },
    { typeId: 'travaux-bricolage', centimes: -5_000 },
  ];
  egal('3.1 un partage juste passe', controlerLesParts(COURSES, bon), []);

  const incomplet = [bon[0], { ...bon[1], centimes: -4_999 }];
  verifier('3.2 un centime manquant est refusé, et chiffré',
    controlerLesParts(COURSES, incomplet).some((p) => p.includes('0,01')),
    JSON.stringify(controlerLesParts(COURSES, incomplet)));

  verifier('3.3 une seule part n’est pas un fractionnement',
    controlerLesParts(COURSES, [{ typeId: 'supermarche', centimes: -12_000 }])
      .some((p) => p.includes('au moins')));

  verifier('3.4 une part à zéro est refusée',
    controlerLesParts(COURSES, [...bon, { typeId: 'restaurant', centimes: 0 }])
      .some((p) => p.includes('zéro')));

  /*
     Le refus qui compte le plus : une part positive sur une dépense. Elle
     somme pourtant correctement, et c'est bien le piège — l'arithmétique
     passe, la lecture est fausse, et rien ne le dirait.
  */
  const signesMeles: PartPointee[] = [
    { typeId: 'supermarche', centimes: -15_000 },
    { typeId: 'travaux-bricolage', centimes: 3_000 },
  ];
  egal('3.5 des signes mêlés somment bien à l’opération', resteARepartir(COURSES, signesMeles), 0);
  verifier('3.6 et sont refusés quand même',
    controlerLesParts(COURSES, signesMeles).some((p) => p.includes('recette')),
    JSON.stringify(controlerLesParts(COURSES, signesMeles)));

  verifier('3.7 deux parts sur le même type sont refusées',
    controlerLesParts(COURSES, [
      { typeId: 'supermarche', centimes: -7_000 },
      { typeId: 'supermarche', centimes: -5_000 },
    ]).some((p) => p.includes('additionnez')));

  verifier('3.8 un type inconnu de la taxonomie est refusé',
    controlerLesParts(COURSES, [
      { typeId: 'supermarche', centimes: -7_000 },
      { typeId: 'licorne', centimes: -5_000 },
    ]).some((p) => p.includes('licorne')));

  verifier('3.9 une part sans type est refusée',
    controlerLesParts(COURSES, [
      { typeId: 'supermarche', centimes: -7_000 },
      { typeId: '', centimes: -5_000 },
    ]).some((p) => p.includes('sans type')));

  const trop = Array.from({ length: PARTS_MAXIMALES + 1 }, (_, i) => ({
    typeId: `t${i}`,
    centimes: -1_000,
  }));
  verifier('3.10 au-delà du plafond, c’est refusé et dit pourquoi',
    controlerLesParts(operation(-(PARTS_MAXIMALES + 1) * 1_000), trop)
      .some((p) => p.includes('ticket')));
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Les deux contrôles qui ferment toutes les voies d'écriture
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. LE POINTAGE SE DÉFEND SEUL');
{
  const pointage = (parts: PartPointee[]): Pointage => ({
    id: 'op-1',
    operationId: 'op-1',
    statut: 'pointee-par-moi',
    vendeurNom: 'SUPERMARCHE',
    typeId: 'supermarche',
    parts,
    auteur: 'moi',
    pourquoi: 'essai',
    versionDuDictionnaire: null,
    importId: null,
    precedent: null,
    appareil: 'essai',
    decideLe: '2026-10-13T10:00:00.000Z',
    majLe: '2026-10-13T10:00:00.000Z',
  });

  egal('4.1 un pointage fractionné correct passe',
    controlerPointage(pointage([
      { typeId: 'supermarche', centimes: -7_000 },
      { typeId: 'travaux-bricolage', centimes: -5_000 },
    ])), []);

  verifier('4.2 deux parts sur le même type sont refusées à l’écriture aussi',
    controlerPointage(pointage([
      { typeId: 'supermarche', centimes: -7_000 },
      { typeId: 'supermarche', centimes: -5_000 },
    ])).some((p) => p.includes('même type')));

  verifier('4.3 les signes mêlés aussi',
    controlerPointage(pointage([
      { typeId: 'supermarche', centimes: -15_000 },
      { typeId: 'travaux-bricolage', centimes: 3_000 },
    ])).some((p) => p.includes('signes contraires')));
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Et l'autre bout : ce que les catégories en font
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n5. CE QUE LES CATÉGORIES EN FONT');
{
  /*
     L'essai qui relie les deux moitiés. L'éditeur fabrique des parts, et
     c'est « vueDesCategories » qui les lit — écrites depuis la phase 3 bis
     sans que rien ne puisse les produire. Si les conventions de signe des
     deux côtés divergeaient, chacun passerait ses propres essais.
  */
  const op = operation(-12_000, { id: 'o1' });
  const parts = [
    { typeId: 'supermarche', centimes: -7_000 },
    { typeId: 'travaux-bricolage', centimes: -5_000 },
  ];
  const vue = vueDesCategories({
    operations: [op],
    pointages: [{
      id: 'o1', operationId: 'o1', statut: 'pointee-par-moi', vendeurNom: null,
      typeId: 'supermarche', parts, auteur: 'moi', pourquoi: '', versionDuDictionnaire: null,
      importId: null, precedent: null, appareil: 'e', decideLe: '', majLe: '',
    }],
    prevuParCategorie: {},
    modifications: [],
    du: '2026-10-01',
    au: '2026-10-31',
  });

  const lire = (categorie: string) => vue.lignes.find((l) => l.categorie === categorie)?.reel ?? 0;
  egal('5.1 chaque part va dans la catégorie de son type, en dépense',
    [lire(categorieDuType('supermarche', [])), lire(categorieDuType('travaux-bricolage', []))],
    [7_000, 5_000]);
  egal('5.2 et la somme des catégories fait l’opération',
    vue.lignes.reduce((s, l) => s + l.reel, 0), 12_000);
  egal('5.3 une opération fractionnée compte pour une, dans sa part principale',
    vue.lignes.filter((l) => l.operations > 0).map((l) => l.operations), [1]);
  egal('5.4 elle n’est ni « à pointer » ni « à revoir »',
    [vue.nonPointe.aPointer.operations, vue.nonPointe.aRevoir.operations], [0, 0]);
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
