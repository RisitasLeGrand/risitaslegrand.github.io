/**
 * Contrôle du socle de Relational Reasoning.
 *
 *   npm run essais:relationnel
 *
 * Vérifie les tables de composition, la converse, la propagation, la détection
 * d'incohérence, puis passe mille instances de chaque système au crible : aucune
 * ne doit être incohérente, et la relation du modèle caché doit toujours figurer
 * parmi celles que l'énoncé laisse possibles. Cette dernière vérification est la
 * plus utile : elle attraperait un générateur qui énonce un fait faux.
 *
 * Le script s'exécute par « tsx », seule dépendance de développement ajoutée
 * pour lui : elle ne part jamais dans le navigateur, et elle évite d'imposer au
 * reste du dépôt la convention d'imports à extension explicite qu'exigerait le
 * dépouillement de types natif de Node.
 */
import { alea } from '../src/features/relational-reasoning/noyaux/aleatoire';
import { composerSession } from '../src/features/relational-reasoning/session';
import { eliminer, type Matrice } from '../src/features/relational-reasoning/noyaux/isomorphisme';
import { composerChemin, possibilites, coherent } from '../src/features/relational-reasoning/noyaux/algebre';
import { line } from '../src/features/relational-reasoning/systemes/line';
import { plane } from '../src/features/relational-reasoning/systemes/plane';
import { groups } from '../src/features/relational-reasoning/systemes/groups';
import type { Systeme } from '../src/features/relational-reasoning/systemes/types';
import { SYSTEMES } from '../src/features/relational-reasoning/systemes/index';
import { MOTEURS, couples } from '../src/features/relational-reasoning/moteurs/index';
import { algebresCompatibles, INTITULES } from '../src/features/relational-reasoning/noyaux/proprietes';
import { noter } from '../src/features/relational-reasoning/noyaux/notation';
import {
  PALIERS_SYSTEMES,
  couplesPourEntrainement,
  echelonDeMoteur,
  systemesSansPalier,
} from '../src/features/relational-reasoning/progression';
import { plusPetitSuffisant, type Contexte } from '../src/features/relational-reasoning/noyaux/mus';
import { poset } from '../src/features/relational-reasoning/systemes/poset';
import type { Fait } from '../src/features/relational-reasoning/systemes/types';

function algebreDe(s: Systeme) {
  return { relations: s.relations.map((r) => r.id), converse: s.converse, composer: s.composer! };
}
const nom = (s: Systeme, id: string) => s.relations.find((r) => r.id === id)!.libelle;

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  const ok = a === b;
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok ? '' : `\n      obtenu  ${a}\n      attendu ${b}`}`);
}
const tri = (e: Set<string>) => [...e].sort();

console.log('\nALGÈBRE DE POINTS — line (axe strict, pas d\'égalité)');
const al = algebreDe(line);
verifier('vocabulaire', line.relations.map((r) => r.id).sort(), ['a', 'p']);
verifier('avant ∘ avant = avant', tri(al.composer('a', 'a')), ['a']);
verifier('avant ∘ après indéterminé', tri(al.composer('a', 'p')), ['a', 'p']);
verifier('converse involutive', al.converse(al.converse('a')), 'a');

console.log('\nPRODUIT — plane (« nord » ∘ « est » = « nord-est »)');
const ap = algebreDe(plane);
verifier('nord ∘ est = nord-est', tri(ap.composer('ep', 'pe')), ['pp']);
verifier('libellé de pp', nom(plane, 'pp'), 'est au nord-est de');
verifier('nord ∘ sud laisse la colonne', tri(ap.composer('ep', 'ea')), ['ea', 'ee', 'ep']);
verifier('nord-est ∘ sud-ouest : neuf cas', ap.composer('pp', 'aa').size, 9);
verifier('converse de nord-est = sud-ouest', ap.converse('pp'), 'aa');
verifier('vocabulaire de plane', plane.relations.length, 9);

console.log('\nÉQUILIBRE STRUCTUREL — groups (Z₂)');
const ag = algebreDe(groups);
verifier('allié ∘ allié = allié', tri(ag.composer('allie', 'allie')), ['allie']);
verifier('allié ∘ rival = rival', tri(ag.composer('allie', 'rival')), ['rival']);
verifier('rival ∘ rival = allié', tri(ag.composer('rival', 'rival')), ['allie']);

console.log('\nCHAÎNE');
verifier('trois pas vers l\'est', tri(composerChemin(ap, ['pe', 'pe', 'pe'])), ['pe']);
verifier('est puis nord', tri(composerChemin(ap, ['pe', 'ep'])), ['pp']);

console.log('\nINDÉTERMINATION — ce dont vivent les moteurs de la catégorie C');
const faits = [
  { sujet: 'A', relation: 'a', objet: 'B' },
  { sujet: 'C', relation: 'a', objet: 'B' },
];
verifier(
  'A avant B, C avant B → A vs C ouvert',
  tri(possibilites(al, line.cheminComplet, ['A', 'B', 'C'], faits, 'A', 'C')),
  ['a', 'p'],
);
const chaine = [
  { sujet: 'A', relation: 'a', objet: 'B' },
  { sujet: 'B', relation: 'a', objet: 'C' },
];
verifier(
  'A avant B avant C → A avant C, fermé',
  tri(possibilites(al, line.cheminComplet, ['A', 'B', 'C'], chaine, 'A', 'C')),
  ['a'],
);

console.log('\nINCOHÉRENCE — ce que détecte le moteur Contradiction');
const cycle = [
  { sujet: 'A', relation: 'a', objet: 'B' },
  { sujet: 'B', relation: 'a', objet: 'C' },
  { sujet: 'C', relation: 'a', objet: 'A' },
];
verifier('cycle avant-avant-avant impossible', coherent(al, line.cheminComplet, ['A', 'B', 'C'], cycle), false);
const triangleDesequilibre = [
  { sujet: 'X', relation: 'allie', objet: 'Y' },
  { sujet: 'Y', relation: 'allie', objet: 'Z' },
  { sujet: 'X', relation: 'rival', objet: 'Z' },
];
verifier('triangle déséquilibré impossible', coherent(ag, groups.cheminComplet, ['X', 'Y', 'Z'], triangleDesequilibre), false);

console.log('\nGÉNÉRATEURS — cohérence de mille instances, tous paliers');
/**
 * Tous les systèmes y passent, et non trois d'entre eux.
 *
 * C'est la vérification la plus utile du script — elle attraperait un
 * générateur qui énonce un fait faux, ce dont rien d'autre ne rend compte — et
 * il n'y avait pas de raison de la réserver à `line`, `plane` et `groups`. Les
 * systèmes du régime clos n'ont pas de table de composition et sont donc
 * écartés : la question « cette relation reste-t-elle possible » ne s'y pose
 * pas, l'absence d'arête y étant une négation.
 */
for (const systeme of SYSTEMES.filter((s) => s.composer)) {
  const a = algebreDe(systeme);
  let mauvaises = 0;
  let desaccords = 0;
  /**
   * Mille instances là où la lecture d'une paire est une propagation, quarante
   * là où elle est une énumération de scénarios.
   *
   * Le calibrage n'est pas une complaisance : pour `allen`, lire toutes les
   * paires d'une instance coûte près d'une seconde, et mille instances
   * demanderaient un quart d'heure. Un essai qu'on n'attend pas est un essai
   * qu'on finit par ne plus lancer, ce qui le rend inutile. Quarante instances
   * sur un système qui déclare `cheminComplet: false` attrapent déjà un
   * générateur qui énonce un fait faux — le défaut visé —, puisqu'un tel
   * générateur se trompe sur une bonne part de ses tirages, pas sur un sur mille.
   */
  const tirages = systeme.cheminComplet ? 1000 : 40;
  for (let graine = 1; graine <= tirages; graine += 1) {
    const hasard = alea(graine);
    const difficulte = 1 + (graine % 10);
    const instance = systeme.engendrer(difficulte, hasard);
    if (!coherent(a, systeme.cheminComplet, instance.entites, instance.faits)) mauvaises += 1;
    // La relation du modèle doit toujours figurer parmi les possibles.
    for (const x of instance.entites) {
      for (const y of instance.entites) {
        if (x === y) continue;
        const vraie = systeme.relationDansModele(instance.modele!, x, y);
        const ouvertes = possibilites(a, systeme.cheminComplet, instance.entites, instance.faits, x, y);
        if (!ouvertes.has(vraie)) desaccords += 1;
      }
    }
  }
  verifier(`${systeme.id} : instances incohérentes (${tirages} tirages)`, mauvaises, 0);
  verifier(`${systeme.id} : modèle exclu des possibles`, desaccords, 0);
}


console.log('\nPALIERS — aucun système ne doit rester injouable');
{
  // Un système absent de PALIERS_SYSTEMES n'est jamais rendu par
  // systemesOuverts : il reste du code mort, et rien ne le signale. C'est
  // arrivé aux cinq systèmes ajoutés après le premier jet.
  verifier('tous les systèmes ont un palier', systemesSansPalier(), []);
  const places = PALIERS_SYSTEMES.flatMap((p) => p.systemes);
  verifier('et aucun n’est placé deux fois', places.length, new Set(places).size);
  verifier(
    'tous les systèmes placés existent',
    places.filter((id) => !SYSTEMES.some((s) => s.id === id)),
    [],
  );
}

console.log('\nÉCHELLE À FENÊTRE — ce que le hasard ne doit pas rapporter');
{
  const regle = MOTEURS.find((m) => m.id === 'chaine-conclusion')!.echelle!;
  verifier('la règle est déclarée', [regle.reussites, regle.fenetre, regle.descente], [7, 8, 4]);

  const trace = (note: number) => ({ moteur: 'chaine-conclusion', systeme: 'line', note });
  const suite = (notes: number[]) => notes.map(trace);

  // Trois réussites d'affilée suffisent sous la règle commune ; elles ne
  // doivent rien donner ici, car à deux options elles arrivent une fois sur
  // huit par pur hasard.
  verifier(
    'trois réussites d’affilée ne font pas monter',
    echelonDeMoteur(suite([1, 1, 1]), 'chaine-conclusion'),
    1,
  );
  verifier(
    'sept réussites sur huit font monter d’un cran',
    echelonDeMoteur(suite([1, 1, 1, 0, 1, 1, 1, 1]), 'chaine-conclusion'),
    2,
  );
  verifier(
    'six sur huit ne suffisent pas',
    echelonDeMoteur(suite([1, 1, 0, 0, 1, 1, 1, 1]), 'chaine-conclusion'),
    1,
  );
  // La fenêtre se vide après une montée : seize réussites valent deux crans,
  // et non quatorze.
  verifier(
    'seize réussites valent deux crans',
    echelonDeMoteur(suite(Array(16).fill(1)), 'chaine-conclusion'),
    3,
  );
  // Quatre réussites ou moins sur huit font redescendre — sauf qu'on est déjà
  // au plancher, d'où le besoin de monter d'abord.
  verifier(
    'quatre sur huit font redescendre après une montée',
    echelonDeMoteur(
      suite([...Array(8).fill(1), 1, 1, 1, 1, 0, 0, 0, 0]),
      'chaine-conclusion',
    ),
    1,
  );
  // Deux fautes de suite, qui suffiraient sous la règle commune, ne doivent
  // rien faire : à deux options elles arrivent une fois sur quatre.
  verifier(
    'deux fautes de suite ne font pas redescendre',
    echelonDeMoteur(
      suite([...Array(8).fill(1), 0, 0]),
      'chaine-conclusion',
    ),
    2,
  );
}

console.log('\nÉLIMINATION — l’appariement doit se trouver sans fouiller les permutations');
{
  // Un ordre total sur quatre éléments : chaque sommet a un rang distinct, donc
  // un profil distinct. Tout doit tomber au premier tour.
  const ordre: Matrice = [
    ['', 'a', 'a', 'a'],
    ['b', '', 'a', 'a'],
    ['b', 'b', '', 'a'],
    ['b', 'b', 'b', ''],
  ];
  // La même structure, sommets permutés : 0→3, 1→2, 2→1, 3→0.
  const pi = [3, 2, 1, 0];
  const permutee: Matrice = ordre.map((_, i) => ordre.map((_, j) => ordre[pi.indexOf(i)][pi.indexOf(j)]));

  const epinglages = eliminer(ordre, permutee);
  verifier('tout est épinglé sur un ordre total', epinglages?.length, 4);
  verifier(
    'et sur les seuls profils, sans appui',
    epinglages?.every((e) => e.motif === 'profil'),
    true,
  );
  verifier(
    'l’appariement trouvé est celui de la permutation',
    epinglages?.map((e) => [e.gauche, e.droite]).sort((a, b) => a[0] - b[0]),
    [0, 1, 2, 3].map((i) => [i, pi[i]]),
  );

  /**
   * Le point qui justifie la fonction : l'appariement **transporte** la
   * structure. Un appariement qui ne la transporte pas serait faux, et la trace
   * de correction affirmerait alors une bêtise à chaque étape.
   */
  const image = new Map(epinglages?.map((e) => [e.gauche, e.droite]));
  let transporte = true;
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      if (ordre[i][j] !== permutee[image.get(i)!][image.get(j)!]) transporte = false;
    }
  }
  verifier('et il transporte toutes les relations', transporte, true);

  /**
   * Une structure symétrique : les deux premiers sommets sont interchangeables.
   * L'élimination doit **caler** plutôt que trancher au hasard — deux
   * appariements sont corrects, et en désigner un seul serait une faute.
   */
  const symetrique: Matrice = [
    ['', 'a', 'a'],
    ['a', '', 'a'],
    ['a', 'a', ''],
  ];
  verifier('l’élimination cale sur une structure symétrique', eliminer(symetrique, symetrique), null);

  // Deux tailles différentes : rien à apparier.
  verifier('et refuse deux structures de tailles différentes', eliminer(ordre, symetrique), null);
}

console.log('\nMON ENTRAÎNEMENT — la session ne tire que ce qui est coché');
{
  // Un historique qui débloque tout : 200 items réussis sur des moteurs
  // d'ouverture, ce qui ouvre les familles et tous les paliers de systèmes.
  const historique: Trace[] = [];
  for (const moteur of ['algebre-cachee', 'completion-analogie', 'ensembles-possibles', 'entre-deux', 'chaine-conclusion']) {
    for (let i = 0; i < 40; i += 1) historique.push({ moteur, systeme: 'line', note: 1 });
  }

  const tous = couplesPourEntrainement(historique);
  const libre = couplesPourEntrainement(historique, { modeLibre: true });
  verifier('le mode libre ouvre au moins autant de couples', libre.length >= tous.length, true);
  verifier(
    'un couple ouvert par le mode libre démarre à l’échelon 1',
    libre.filter((c) => !c.debloque).every((c) => c.echelon === 1),
    true,
  );
  verifier(
    'et un couple déjà débloqué garde son échelon gagné',
    libre
      .filter((c) => c.debloque)
      .every((c) => c.echelon === tous.find((x) => x.moteur.id === c.moteur.id && x.systeme.id === c.systeme.id)?.echelon),
    true,
  );

  // Le filtre par moteur.
  const choisis = ['chaine-conclusion', 'algebre-cachee'];
  const session = composerSession(historique, 12, 4242, { moteurs: choisis });
  verifier('la session rend des items', session.items.length > 0, true);
  verifier(
    'et seulement sur les moteurs cochés',
    [...new Set(session.items.map((i) => i.moteur))].sort(),
    [...choisis].sort(),
  );

  /**
   * Le point qu'il fallait éprouver : une sélection qui ne laisse aucun couple
   * praticable rend une session **vide**.
   *
   * Un repli silencieux sur tous les moteurs serait le pire comportement
   * possible — la personne croirait travailler ce qu'elle a coché, et
   * s'entraînerait ailleurs sans le savoir.
   */
  const vide = composerSession(historique, 12, 4242, { moteurs: ['moteur-qui-n-existe-pas'] });
  verifier('une sélection sans couple praticable rend une session vide', vide.items.length, 0);

  // Une sélection absente ou vide laisse jouer tous les moteurs accessibles :
  // c'est le comportement d'avant, et l'interface amorce la sélection pour que
  // le cas ne se présente pas à l'usage.
  const sansFiltre = composerSession(historique, 8, 4242);
  verifier('sans sélection, la session tire largement', sansFiltre.items.length > 0, true);

  // L'ordre groupé.
  const groupee = composerSession(historique, 12, 777, {
    moteurs: choisis,
    ordre: 'par-unite',
  });
  const moteursEnOrdre = groupee.items.map((i) => i.moteur);
  const blocs = moteursEnOrdre.filter((m, i) => i === 0 || m !== moteursEnOrdre[i - 1]).length;
  verifier(
    'l’ordre groupé ne laisse qu’un bloc par moteur',
    blocs,
    new Set(moteursEnOrdre).size,
  );
  const entrelacee = composerSession(historique, 12, 777, { moteurs: choisis });
  verifier(
    'et l’ordre entrelacé garde les mêmes items',
    [...entrelacee.items.map((i) => i.moteur)].sort(),
    [...moteursEnOrdre].sort(),
  );

  // Le mode libre doit rendre jouable un moteur qu'un historique vide verrouille.
  const verrouille = composerSession([], 6, 99, { moteurs: ['recherche-motif'] });
  const deverrouille = composerSession([], 6, 99, {
    moteurs: ['recherche-motif'],
    modeLibre: true,
  });
  verifier('sans mode libre, un moteur verrouillé ne joue pas', verrouille.items.length, 0);
  verifier('avec le mode libre, il joue', deverrouille.items.length > 0, true);
  verifier(
    'et la progression n’en est pas modifiée — elle se recalcule depuis l’historique',
    echelonDeMoteur([], 'recherche-motif'),
    1,
  );
}

console.log('\nBARÈME — il doit décourager la devinette');
{
  const reponse = {
    genre: 'multiple' as const,
    options: [{ texte: 'a' }, { texte: 'b' }, { texte: 'c' }, { texte: 'd' }],
    bonnes: [0, 1],
  };
  verifier('réponse exacte', noter(reponse, { genre: 'multiple', choix: [0, 1] }), 1);
  verifier('tout cocher', noter(reponse, { genre: 'multiple', choix: [0, 1, 2, 3] }), 0);
  verifier('une bonne sur deux, sans faute', noter(reponse, { genre: 'multiple', choix: [0] }), 0.5);
  verifier('une bonne et une fausse', noter(reponse, { genre: 'multiple', choix: [0, 2] }), 0);
  verifier('rien de coché', noter(reponse, { genre: 'multiple', choix: [] }), 0);
  const partielle = noter(reponse, { genre: 'multiple', choix: [0] });
  const fausse = noter(reponse, { genre: 'multiple', choix: [2, 3] });
  verifier('partielle > fausse', partielle > fausse, true);
  verifier('partielle < exacte', partielle < 1, true);
}

console.log("\nÉCHELLE — chaque moteur monte pour son propre compte");
{
  const t = (moteur: string, note: number) => ({ moteur, systeme: 'line', note });
  verifier('historique vide', echelonDeMoteur([], 'x'), 1);
  verifier(
    'trois réussites font monter d\'un cran',
    echelonDeMoteur([t('x', 1), t('x', 1), t('x', 1)], 'x'),
    2,
  );
  verifier(
    'les réussites d\'un autre moteur ne comptent pas',
    echelonDeMoteur([t('y', 1), t('y', 1), t('y', 1)], 'x'),
    1,
  );
  verifier(
    'deux fautes de suite font redescendre',
    echelonDeMoteur([t('x', 1), t('x', 1), t('x', 1), t('x', 0), t('x', 0)], 'x'),
    1,
  );
  verifier(
    'une réponse partielle maintient',
    echelonDeMoteur([t('x', 1), t('x', 1), t('x', 1), t('x', 0.5), t('x', 0.5)], 'x'),
    2,
  );
}

console.log('\nPRÉMISSES MINIMALES — la caractérisation linéaire égale l’énumération');
// Le noyau ne cherche plus le plus petit sous-ensemble suffisant en parcourant
// les 2^n sous-ensembles : il retient les faits *nécessaires* — ceux dont le
// retrait à lui seul fait perdre la conclusion — et vérifie qu'ils suffisent
// (la preuve est en tête de noyaux/mus.ts). Le nombre de tests passe de 4 096 à
// treize ; encore faut-il que la réponse soit la même. On la compare donc à
// l'énumération exhaustive, sur des ensembles assez petits pour qu'elle reste
// abordable.
// La référence n'appelle pas `entraine` : celui-ci prend trois raccourcis par
// la cohérence par chemin, et une erreur commune aux deux passerait inaperçue.
// Elle énumère les possibles sans aucun seuil d'arrêt.
function suffitSansRaccourci(
  contexte: Contexte,
  faits: readonly Fait[],
  a: string,
  b: string,
  relation: string,
): boolean {
  const restantes = possibilites(
    contexte.algebre,
    contexte.cheminComplet,
    contexte.entites,
    faits,
    a,
    b,
  );
  return restantes.size === 1 && restantes.has(relation);
}

function minimauxSuffisants(
  contexte: Contexte,
  faits: readonly Fait[],
  a: string,
  b: string,
  relation: string,
): Fait[][] {
  const n = faits.length;
  const suffisants: number[] = [];
  for (let masque = 1; masque < 1 << n; masque += 1) {
    const sous = faits.filter((_, i) => masque & (1 << i));
    if (suffitSansRaccourci(contexte, sous, a, b, relation)) suffisants.push(masque);
  }
  return suffisants
    .filter((m) => !suffisants.some((autre) => autre !== m && (autre & m) === autre))
    .map((m) => faits.filter((_, i) => m & (1 << i)));
}

{
  const MAXIMUM_FAITS = 8; // 256 sous-ensembles à énumérer, pas davantage
  let compares = 0;
  let desaccords = 0;
  let uniques = 0;
  for (const systeme of [line, plane, poset]) {
    const contexteAlgebre = algebreDe(systeme);
    for (let graine = 1; graine <= 120; graine += 1) {
      const hasard = alea(7000 + graine);
      const instance = systeme.engendrer(5, hasard);
      if (!instance.modele) continue;
      const entites = instance.entites;
      if (entites.length < 4) continue;
      const contexte: Contexte = {
        algebre: contexteAlgebre,
        cheminComplet: systeme.cheminComplet,
        entites,
      };
      // Un vivier de faits vrais tirés du modèle, indépendant du moteur : on
      // veut éprouver le noyau, pas reproduire la façon dont un moteur l'appelle.
      const vivier: Fait[] = [];
      for (let i = 0; i < entites.length; i += 1) {
        for (let j = i + 1; j < entites.length; j += 1) {
          vivier.push({
            sujet: entites[i],
            relation: systeme.relationDansModele(instance.modele, entites[i], entites[j]),
            objet: entites[j],
          });
        }
      }
      const [a, b] = hasard.plusieurs(entites, 2);
      const faitsTires = hasard
        .melanger(vivier.filter((f) => !((f.sujet === a && f.objet === b) || (f.sujet === b && f.objet === a))))
        .slice(0, MAXIMUM_FAITS);
      if (faitsTires.length < 3) continue;
      const conclusion = systeme.relationDansModele(instance.modele, a, b);
      if (!suffitSansRaccourci(contexte, faitsTires, a, b, conclusion)) continue;

      const obtenu = plusPetitSuffisant(contexte, faitsTires, a, b, conclusion);
      const references = minimauxSuffisants(contexte, faitsTires, a, b, conclusion);
      compares += 1;
      const attenduUnique = references.length === 1;
      if (attenduUnique) uniques += 1;
      if (!obtenu || obtenu.unique !== attenduUnique) {
        desaccords += 1;
        continue;
      }
      // Le sous-ensemble rendu doit être minimal, et le plus petit quand il est unique.
      const rendu = new Set(obtenu.faits);
      const estMinimal = references.some(
        (r) => r.length === rendu.size && r.every((f) => rendu.has(f)),
      );
      if (!estMinimal) desaccords += 1;
      else if (attenduUnique && obtenu.faits.length !== Math.min(...references.map((r) => r.length))) {
        desaccords += 1;
      }
    }
  }
  verifier('accord avec l’énumération exhaustive', desaccords, 0);
  verifier('des cas à réponse unique ont été rencontrés', uniques > 0, true);
  verifier('des cas à plusieurs minimaux aussi', compares - uniques > 0, true);
}

console.log('\nNÉGATION DE SURFACE — un système à deux relations doit être exhaustif');
/*
 * `negationUnivoque` tient pour acquis qu'un vocabulaire de deux relations est
 * exclusif **et exhaustif** : c'est ce qui permet d'énoncer « A n'est pas après
 * B » et d'en déduire « A est avant B ». La déclaration d'un système ne le dit
 * pas ; seul son modèle le sait. Un système à deux relations qui admettrait un
 * troisième état — une paire qu'aucune des deux ne relie — rendrait toutes les
 * prémisses niées ambiguës, et rien ne le signalerait avant la séance.
 */
{
  const deuxRelations = SYSTEMES.filter((systeme) => systeme.relations.length === 2);
  verifier('des systèmes à deux relations existent', deuxRelations.length > 0, true);
  for (const systeme of deuxRelations) {
    let orphelines = 0;
    for (let graine = 1; graine <= 60; graine += 1) {
      const instance = systeme.engendrer(5, alea(graine * 104_729));
      const modele = instance.modele;
      if (!modele) {
        orphelines += 1;
        continue;
      }
      for (const x of instance.entites) {
        for (const y of instance.entites) {
          if (x === y) continue;
          const relation = systeme.relationDansModele(modele, x, y);
          if (!systeme.relations.some((candidate) => candidate.id === relation)) orphelines += 1;
        }
      }
    }
    verifier(`${systeme.id} : toute paire porte l’une des deux relations`, orphelines, 0);
  }
}

console.log('\nCOÛT — un item ne doit pas figer l’interface');
// Un moteur qui met vingt secondes à rendre un item est un défaut, même si
// l'item est juste : la session se fige au tirage, et rien dans les essais ne
// le disait. C'est arrivé — « Prémisses minimales » sur RCC8 demandait 18,9 s,
// parce qu'un test d'entraînement y coûte une énumération de scénarios et que
// le noyau en faisait 4 096. Le budget est désormais gardé.
{
  const BUDGET_MS = 1500;
  let pire = { couple: '—', ms: 0 };
  for (const { moteur, systeme } of couples(MOTEURS, SYSTEMES)) {
    const debut = Date.now();
    for (let i = 0; i < 3; i += 1) moteur.engendrer(systeme, 6, alea(4000 + i), SYSTEMES);
    const ms = (Date.now() - debut) / 3;
    if (ms > pire.ms) pire = { couple: `${moteur.id} × ${systeme.id}`, ms };
    if (ms > BUDGET_MS) {
      echecs += 1;
      console.log(`  ✗ ${moteur.id} × ${systeme.id} — ${Math.round(ms)} ms par item`);
    }
  }
  console.log(`  ✓ le plus lent : ${pire.couple} — ${Math.round(pire.ms)} ms par item`);
}

/**
 * Graines par couple, et le temps qu'on accepte d'y mettre.
 *
 * Deux cents graines par couple était un compte sans budget, et le compte a
 * fini par coûter plus que la suite ne peut tenir : mesuré sur les 215 couples,
 * trois moteurs en consommaient 83 % — `premisse-manquante` 36 %,
 * `isomorphisme-partiel` 29 %, `ensembles-possibles` 18 % —, et le pire couple,
 * `premisse-manquante × rcc8`, demandait 95 s à lui seul. La suite dépassait le
 * plafond de trente minutes du conteneur, c'est-à-dire qu'elle ne rendait plus
 * de verdict du tout : une suite qu'on ne peut pas attendre ne protège rien.
 *
 * Le compte est donc doublé d'un **budget de temps**. Les couples bon marché —
 * la très grande majorité — gardent leurs deux cents graines ; les couples
 * coûteux s'arrêtent au budget, et le nombre de graines réellement tirées est
 * **affiché**. Une couverture réduite doit se voir : la taire donnerait
 * l'illusion d'un contrôle à deux cents items là où il n'y en a eu que trente.
 *
 * Deux planchers, et le second a été ajouté après avoir vu ce que le premier
 * laissait passer. Un plancher de graines ne garantit rien sur un couple à
 * faible rendement : `isomorphisme-partiel × digraph` retient 3 % de ses
 * tirages, de sorte que trente graines n'y donnaient **qu'un seul item** —
 * affiché « ✓ » comme les autres. Le budget s'efface donc aussi devant un
 * plancher d'**items** : on continue de tirer tant qu'on n'en a pas obtenu
 * `ITEMS_MINIMUM`, dans la limite des deux cents graines.
 *
 * C'est la section COÛT, et non celle-ci, qui refuse un item trop lent.
 */
const GRAINES = 200;
const GRAINES_MINIMUM = 30;
const ITEMS_MINIMUM = 10;
const BUDGET_COUPLE_MS = 2_000;

console.log(
  `\nMOTEURS — jusqu’à ${GRAINES} items par couple moteur × système, ` +
    `${BUDGET_COUPLE_MS / 1000} s au plus`,
);

/**
 * Chaque item est validé **tel que la personne le voit** : on reparse l'énoncé
 * affiché plutôt que de faire confiance aux étiquettes internes du générateur.
 * Un moteur qui afficherait un motif ne portant pas sa réponse serait pris ici,
 * et nulle part ailleurs.
 */
for (const { moteur, systeme } of couples(MOTEURS, SYSTEMES)) {
  let nuls = 0;
  let tirees = 0;
  const griefs: string[] = [];
  const departDuCouple = Date.now();

  for (let graine = 1; graine <= GRAINES; graine += 1) {
    const assezTire = graine > GRAINES_MINIMUM;
    const assezDItems = tirees - nuls >= ITEMS_MINIMUM;
    if (assezTire && assezDItems && Date.now() - departDuCouple > BUDGET_COUPLE_MS) break;
    tirees += 1;
    const item = moteur.engendrer(systeme, 1 + (graine % 10), alea(graine * 7919), SYSTEMES);
    if (!item) {
      nuls += 1;
      continue;
    }

    // Invariants communs à tous les moteurs.
    if (item.reponse.genre === 'unique') {
      const { options, bonne } = item.reponse;
      if (bonne < 0 || bonne >= options.length) griefs.push(`graine ${graine} : index de bonne réponse hors bornes`);
      // On compare l'option entière, texte **et** dessin. Ne comparer que le
      // texte laisserait passer deux dessins identiques — et signalerait à
      // tort comme doublons quatre options purement graphiques, dont le texte
      // est vide par construction.
      const empreintes = options.map((o) => JSON.stringify([o.texte ?? '', o.blocs ?? null]));
      if (new Set(empreintes).size !== empreintes.length) griefs.push(`graine ${graine} : options en doublon`);
      if (options.length < 2) griefs.push(`graine ${graine} : moins de deux options`);
    }
    if (item.reponse.genre === 'appariement') {
      const { gauche, droite, paires } = item.reponse;
      if (Object.keys(paires).length !== gauche.length) griefs.push(`graine ${graine} : appariement incomplet`);
      for (const [clef, valeur] of Object.entries(paires)) {
        if (!gauche.includes(clef)) griefs.push(`graine ${graine} : clé « ${clef} » absente de gauche`);
        if (!droite.includes(valeur)) griefs.push(`graine ${graine} : valeur « ${valeur} » absente de droite`);
      }
      if (new Set(Object.values(paires)).size !== Object.values(paires).length) {
        griefs.push(`graine ${graine} : deux entités appariées à la même`);
      }
    }
    if (item.reponse.genre === 'multiple') {
      const { options, bonnes } = item.reponse;
      if (!bonnes.length) griefs.push(`graine ${graine} : aucune bonne réponse`);
      if (bonnes.some((i) => i < 0 || i >= options.length)) {
        griefs.push(`graine ${graine} : index de bonne réponse hors bornes`);
      }
      if (new Set(bonnes).size !== bonnes.length) griefs.push(`graine ${graine} : bonne réponse en double`);
      // L'invariant anti-devinette : autant de leurres que de bonnes réponses au
      // moins, sans quoi tout cocher rapporterait des points.
      const leurres = options.length - bonnes.length;
      if (leurres < bonnes.length) {
        griefs.push(`graine ${graine} : ${leurres} leurre(s) pour ${bonnes.length} bonne(s) réponse(s)`);
      }
      const toutCocher = noter(item.reponse, {
        genre: 'multiple',
        choix: options.map((_, i) => i),
      });
      if (toutCocher > 0) griefs.push(`graine ${graine} : tout cocher rapporte ${toutCocher}`);
      const exact = noter(item.reponse, { genre: 'multiple', choix: bonnes });
      if (exact !== 1) griefs.push(`graine ${graine} : la réponse exacte ne vaut pas 1`);
    }
    if (!item.explication.trim()) griefs.push(`graine ${graine} : explication vide`);

    // Contrôle propre à « Algèbre cachée » : les paires affichées doivent
    // n'admettre qu'une seule algèbre, et ce doit être celle cochée.
    if (moteur.id === 'algebre-cachee' && item.reponse.genre === 'unique') {
      const bloc = item.enonce.find((b) => b.type === 'faits');
      const lignes = bloc && bloc.type === 'faits' ? bloc.phrases : [];
      const paires = lignes
        .map((ligne) => ligne.replace(/\.$/, '').split(/\s+/))
        .filter((morceaux) => morceaux.length === 3)
        .map(([a, , b]) => [a, b] as [string, string]);
      const entites = [...new Set(paires.flat())];
      const symetrique = paires.every(([a, b]) => paires.some(([c, d]) => c === b && d === a));
      const completes = symetrique ? paires : paires;
      const compatibles = algebresCompatibles(entites, completes);
      if (compatibles.length !== 1) {
        griefs.push(`graine ${graine} : ${compatibles.length} algèbres compatibles avec le motif affiché`);
      } else if (INTITULES[compatibles[0]] !== item.reponse.options[item.reponse.bonne].texte) {
        griefs.push(`graine ${graine} : l'algèbre cochée n'est pas celle du motif affiché`);
      }
    }

    // Contrôle propre à « Réseau relationnel » : l'appariement annoncé doit
    // transporter la première matrice sur la seconde, et être le seul à le
    // faire.
    if (moteur.id === 'reseau-relationnel' && item.reponse.genre === 'appariement') {
      const tableaux = item.enonce.filter((b) => b.type === 'tableau');
      if (tableaux.length !== 2) {
        griefs.push(`graine ${graine} : ${tableaux.length} matrice(s) au lieu de deux`);
      } else {
        const lire = (bloc: typeof tableaux[0]) => {
          if (bloc.type !== 'tableau') return { noms: [] as string[], cases: {} as Record<string, string> };
          const noms = bloc.entetes.slice(1);
          const cases: Record<string, string> = {};
          bloc.lignes.forEach((ligne) => {
            ligne.slice(1).forEach((valeur, j) => {
              cases[`${ligne[0]}|${noms[j]}`] = valeur;
            });
          });
          return { noms, cases };
        };
        const un = lire(tableaux[0]);
        const deux = lire(tableaux[1]);
        const pi = item.reponse.paires;
        let transporte = true;
        for (const a of un.noms) {
          for (const b of un.noms) {
            if (a === b) continue;
            if (un.cases[`${a}|${b}`] !== deux.cases[`${pi[a]}|${pi[b]}`]) transporte = false;
          }
        }
        if (!transporte) griefs.push(`graine ${graine} : l'appariement ne transporte pas la structure`);
      }
    }
  }

  const rendement = ((tirees - nuls) / Math.max(tirees, 1)) * 100;
  const etiquette = `${moteur.id} × ${systeme.id}`;
  // La couverture réduite se dit, pour qu'un « ✓ » ne laisse pas croire à deux
  // cents items quand le budget en a arrêté trente.
  const sur =
    tirees < GRAINES
      ? ` (sur ${tirees} graines et ${tirees - nuls} item(s), budget atteint)`
      : '';
  if (griefs.length) {
    echecs += 1;
    console.log(`  ✗ ${etiquette} — ${griefs.length} grief(s)${sur}`);
    for (const grief of griefs.slice(0, 3)) console.log(`      ${grief}`);
  } else if (nuls === tirees) {
    // Un rendement nul n'est pas un défaut si le moteur a de bonnes raisons de
    // refuser ce système : « groups » n'est presque jamais rigide, faute de quoi
    // l'appariement aurait plusieurs réponses. On le signale sans échouer.
    console.log(`  – ${etiquette} — aucun item : le moteur refuse ce système`);
  } else {
    console.log(`  ✓ ${etiquette} — ${rendement.toFixed(0)} % de tirages retenus${sur}`);
  }
}

console.log(`\n${echecs ? `\x1b[31m✖ ${echecs} échec(s)\x1b[0m` : '\x1b[32m✓ tout passe\x1b[0m'}\n`);
process.exit(echecs ? 1 : 0);
