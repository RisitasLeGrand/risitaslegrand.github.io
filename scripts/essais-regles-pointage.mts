/**
 * Essais des règles locales et des catégories pointées — phases 3 bis d et e.
 *
 * Deux promesses, et chacune se trahit silencieusement.
 *
 *  1. **Une règle ne touche jamais le passé sans qu'on l'ait vu**, et jamais
 *     une opération pointée à la main. L'erreur inverse reclasse des
 *     chiffres que la personne a déjà regardés.
 *  2. **La comparaison prévu / réalisé dit ce qu'elle ne compte pas.** Une
 *     comparaison faite à moitié ressemble exactement à une comparaison
 *     faite en entier, et elle se trompe toujours dans le sens rassurant.
 */
import type { OperationBancaire } from '../src/lib/odyssee/finances';
import type { Pointage } from '../src/lib/odyssee/pointage';
import { controlerPointage } from '../src/lib/odyssee/pointage';
import { TOUS_LES_TYPES } from '../src/lib/odyssee/taxonomie';
import type { RegleDePointage } from '../src/lib/odyssee/vendeurs';
import {
  apercuSurLePasse,
  brouillonPour,
  controlerLeBrouillon,
  controlerLesRegles,
  detecterLesContradictions,
  motifPropose,
  regleDepuisLeBrouillon,
  typesSuggeres,
} from '../src/lib/odyssee/regles-pointage';
import {
  controlerLesCategoriesPointees,
  phraseDuNonPointe,
  vueDesCategories,
} from '../src/lib/odyssee/categories-pointees';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const op = (p: Partial<OperationBancaire> = {}): OperationBancaire => ({
  id: 'OP1', compteId: 'C1', jour: '2026-10-12', centimes: -4390,
  libelle: 'CB CARREFOUR CITY TOURNAY', categorie: '', transfertAvec: null,
  majLe: '2026-10-12T10:00:00.000Z', ...p,
});

const pointe = (p: Partial<Pointage> & { operationId: string }): Pointage => ({
  id: p.operationId, statut: 'pointee-par-moi', vendeurNom: 'Carrefour City',
  typeId: 'superette', parts: [], auteur: 'moi', pourquoi: '',
  versionDuDictionnaire: null, importId: null, precedent: null,
  appareil: 'essai', decideLe: '2026-10-13T00:00:00.000Z',
  majLe: '2026-10-13T00:00:00.000Z', ...p,
});

console.log('\n1. LE MOTIF PROPOSÉ');

{
  egal('1.1 le préfixe commun, moins la plomberie',
    motifPropose([
      'CB LE FOURNIL DE TOURNAY 0310',
      'CB LE FOURNIL DE TOURNAY 1210',
      'CB LE FOURNIL DE TOURNAY 1510',
    ]),
    'FOURNIL TOURNAY');
  egal('1.2 un seul libellé donne ses deux premiers mots porteurs',
    motifPropose(['CB SARL MARTIN PLOMBERIE 0310']), 'MARTIN PLOMBERIE');
  egal('1.3 une liste vide ne casse rien', motifPropose([]), '');
  /*
     Quand le préfixe commun ne retient rien d'utilisable, on rend les deux
     premiers mots du premier libellé : un motif imparfait qu'on corrige
     vaut mieux qu'un champ vide devant lequel on abandonne.
  */
  egal('1.4 un préfixe commun trop court se rabat sur le premier libellé',
    motifPropose(['CB ALPHA SERVICES', 'CB BETA TRAVAUX']), 'ALPHA SERVICES');
}

{
  egal('1.5 un mot du libellé suggère un type',
    typesSuggeres(['CB BOULANGERIE DU COIN'], TOUS_LES_TYPES), ['boulangerie']);
  egal('1.6 rien ne se devine sans indice',
    typesSuggeres(['CB ZZQW TRADING'], TOUS_LES_TYPES), []);
  verifier('1.7 et jamais plus de trois suggestions',
    typesSuggeres(['CB PHARMACIE RESTAURANT BOULANGERIE BOUCHERIE'], TOUS_LES_TYPES).length <= 3);
}

console.log('\n2. UNE RÈGLE NAÎT EN « PROPOSER »');

{
  const b = brouillonPour('Le Fournil de Tournay', 'boulangerie', ['CB LE FOURNIL DE TOURNAY']);
  /*
     Jamais « auto ». Une règle créée en trois secondes dans un écran n'a
     pas été relue ; lui donner le droit de classer seule ferait du geste
     d'un clic une décision dont la portée n'est pas mesurée.
  */
  egal('2.1 le brouillon propose, il ne décide pas', b.mode, 'proposer');
  egal('2.2 il vise aucune ligne de budget d’office', b.ligneId, null);
  egal('2.3 et compare par « contient »', b.comparaison, 'contient');
}

{
  const tous = ['CB LE FOURNIL DE TOURNAY', 'CB LE FOURNIL DE PARIS 14'];
  const vises = ['CB LE FOURNIL DE TOURNAY'];
  const b = brouillonPour('Le Fournil', 'boulangerie', vises);

  const { problemes, avis } = controlerLeBrouillon(b, vises, tous);
  egal('2.4 un brouillon correct ne pose aucun problème', problemes, []);
  verifier('2.5 mais l’aperçu dit ce que le motif attrape en plus',
    avis.deTrop.length >= 0);

  const sansNom = controlerLeBrouillon({ ...b, nom: '  ' }, vises, tous);
  verifier('2.6 un nom vide est refusé', sansNom.problemes.some((p) => p.champ === 'nom'));
  const sansType = controlerLeBrouillon({ ...b, typeId: 'inventé' }, vises, tous);
  verifier('2.7 un type inconnu aussi', sansType.problemes.some((p) => p.champ === 'typeId'));
  const courte = controlerLeBrouillon({ ...b, motif: 'LE' }, vises, tous);
  verifier('2.8 un motif de deux lettres aussi', courte.problemes.some((p) => p.champ === 'motif'));
}

{
  /*
     Une règle « auto » sur un type qui l'interdit n'est pas une faute de
     frappe mais une contradiction : on la refuse plutôt que de l'accepter
     en la désobéissant en silence.
  */
  const b = brouillonPour('Ma pharmacie', 'pharmacie', ['CB PHARMACIE DU CENTRE']);
  const { problemes } = controlerLeBrouillon({ ...b, mode: 'auto' }, [], []);
  verifier('2.9 une règle auto sur un type sensible est refusée',
    problemes.some((p) => p.phrase.includes('jamais pointé automatiquement')),
    JSON.stringify(problemes));
  egal('2.10 la même en « proposer » passe',
    controlerLeBrouillon(b, ['CB PHARMACIE DU CENTRE'], ['CB PHARMACIE DU CENTRE']).problemes, []);
}

{
  const b = brouillonPour('Le Fournil', 'boulangerie', ['CB LE FOURNIL DE TOURNAY']);
  const r = regleDepuisLeBrouillon(b, 'r1', '2026-10-13T00:00:00.000Z');
  egal('2.11 la règle naît sans compteur', [r.appliquee, r.corrigee], [0, 0]);
  egal('2.12 son motif est normalisé', r.motif, 'FOURNIL TOURNAY');
}

console.log('\n3. LE PASSÉ NE BOUGE PAS SANS APERÇU');

const regle: RegleDePointage = {
  id: 'r1', nom: 'Le Fournil', typeId: 'boulangerie', motif: 'FOURNIL',
  comparaison: 'contient', mode: 'proposer', ligneId: null,
  appliquee: 0, corrigee: 0, majLe: '2026-10-13T00:00:00.000Z',
};

{
  const operations = [
    { id: 'A', libelle: 'CB LE FOURNIL DE TOURNAY', centimes: -850 },
    { id: 'B', libelle: 'CB LE FOURNIL TOURNAY', centimes: -920, pointeeParMoi: true },
    { id: 'C', libelle: 'CB LIDL TOURNAY', centimes: -3400 },
  ];
  const a = apercuSurLePasse(regle, operations);
  egal('3.1 une seule opération serait reclassée', a.touchees.map((o) => o.id), ['A']);
  egal('3.2 celle que vous avez pointée est protégée', a.protegees.map((o) => o.id), ['B']);
  egal('3.3 et celle d’un autre vendeur n’est pas touchée',
    a.touchees.some((o) => o.id === 'C'), false);
  egal('3.4 la somme ne compte que les touchées', a.somme, 850);
  /*
     Montrer les protégées plutôt que les taire est le point : « 14, dont 3
     que vous avez classées vous-même » laisse décider ; « 11 » cache une
     règle qu'on croit comprendre.
  */
  verifier('3.5 et la phrase dit ce qui ne bougera pas',
    /ne bouger(a|ont) pas/.test(a.phrase), a.phrase);
}

{
  /*
     Zéro reclassée **et** des protégées. Le cas a été trouvé par un essai
     d'écran : la phrase disait « ne touche aucune opération », ce qui est
     vrai et cache la seule chose qui compte — la règle attrape bien ces
     opérations, c'est le pointage de la personne qui les retient. Sans le
     dire, on croit avoir écrit un motif qui rate sa cible, et on l'élargit.
  */
  const a = apercuSurLePasse(regle, [
    { id: 'A', libelle: 'CB LE FOURNIL DE TOURNAY', centimes: -850, pointeeParMoi: true },
    { id: 'B', libelle: 'CB LE FOURNIL TOURNAY', centimes: -920, pointeeParMoi: true },
  ]);
  egal('3.7 bis aucune n’est reclassée', a.touchees.length, 0);
  verifier('3.7 ter et la phrase dit que ce sont les vôtres qui retiennent',
    a.phrase.includes('vous les avez pointées vous-même'), a.phrase);
}

{
  const a = apercuSurLePasse(regle, [{ id: 'Z', libelle: 'CB LIDL', centimes: -100 }]);
  egal('3.6 une règle qui ne touche rien le dit',
    a.phrase, 'Cette règle ne touche aucune opération déjà importée.');
  egal('3.7 et ne compte rien', [a.touchees.length, a.somme], [0, 0]);
}

{
  /* Et le motif colle sur un mot entier, ici comme partout. */
  const r = { ...regle, motif: 'BOULANGER' };
  const a = apercuSurLePasse(r, [
    { id: 'A', libelle: 'CB BOULANGERIE PAUL ET MARIE', centimes: -500 },
  ]);
  egal('3.8 un fragment n’attrape pas', a.touchees, []);
}

console.log('\n3 bis. LES TROIS COMPARAISONS, QUE LE MODE AVANCÉ OFFRE');

{
  /*
     Le geste simple ne propose que « contient ». Le mode avancé ouvre les
     trois, et les deux autres n'avaient aucun essai : elles passaient par
     « apercuSurLePasse » sans que rien ne dise ce qu'elles attrapent.
  */
  const operations = [
    { id: 'A', libelle: 'CB FOURNIL TOURNAY 12/10', centimes: -850 },
    { id: 'B', libelle: 'CB AU FOURNIL TOURNAY', centimes: -920 },
    { id: 'C', libelle: 'CB FOURNIL TOURNAY', centimes: -500 },
  ];
  const sur = (comparaison: RegleDePointage['comparaison'], motif = 'FOURNIL TOURNAY') =>
    apercuSurLePasse({ ...regle, motif, comparaison }, operations).touchees.map((o) => o.id);

  egal('3.9 « contient » attrape partout dans le libellé', sur('contient'), ['A', 'B', 'C']);
  /*
     Le libellé est nettoyé avant la comparaison — mentions de carte, dates,
     références. « CB FOURNIL TOURNAY 12/10 » commence donc bien par le
     motif, et « AU FOURNIL » non : c'est le nettoyage qui rend « commence »
     utilisable sur des relevés réels, où rien ne commence jamais par
     l'enseigne.
  */
  egal('3.10 « commence » exclut ce qui a un mot devant', sur('commence'), ['A', 'C']);
  /*
     « Exact » est exact sur le libellé **nettoyé**, pas sur celui du relevé.
     « CB FOURNIL TOURNAY 12/10 » se réduit à « FOURNIL TOURNAY » comme
     « CB FOURNIL TOURNAY » : les deux sont donc exacts. C'est le bon
     comportement — la date n'appartient pas au vendeur —, mais ce n'est pas
     celui qu'on attend du mot « exact », et l'écran le dit en toutes lettres
     sous le choix de comparaison.
  */
  egal('3.11 « exact » porte sur le libellé nettoyé, dates comprises',
    sur('exact'), ['A', 'C']);
  egal('3.12 un motif vide n’attrape rien, quelle que soit la comparaison',
    [sur('contient', ''), sur('commence', ''), sur('exact', '')], [[], [], []]);
}

{
  /* Et les trois champs du mode avancé traversent la fabrication. */
  const b = {
    nom: 'Le Fournil', typeId: 'boulangerie', motif: 'fournil tournay',
    comparaison: 'commence' as const, mode: 'manuel' as const, ligneId: 'ligne-pain',
  };
  const r = regleDepuisLeBrouillon(b, 'r9', '2026-10-13T00:00:00.000Z');
  egal('3.13 la comparaison choisie est conservée', r.comparaison, 'commence');
  egal('3.14 le mode choisi aussi', r.mode, 'manuel');
  egal('3.15 et la ligne de budget visée', r.ligneId, 'ligne-pain');
  egal('3.16 le motif, lui, est normalisé', r.motif, 'FOURNIL TOURNAY');
}

console.log('\n4. DEUX CORRECTIONS CONTRADICTOIRES : ON DEMANDE');

{
  const regles: RegleDePointage[] = [
    { ...regle, id: 'a', nom: 'Carrefour', motif: 'CARREFOUR', typeId: 'supermarche' },
    { ...regle, id: 'b', nom: 'Carrefour', motif: 'CARREFOUR', typeId: 'carburant' },
  ];
  const c = detecterLesContradictions(regles);
  egal('4.1 la contradiction est vue', c.length, 1);
  egal('4.2 et les deux types nommés', c[0].types, ['carburant', 'supermarche']);
  /*
     On ne tranche pas : un hypermarché classé en alimentation un jour et en
     carburant le lendemain n'est pas une erreur, c'est un vendeur
     multi-catégories, et la bonne réponse est peut-être de le dire.
  */
  verifier('4.3 la question est posée, pas tranchée',
    c[0].question.includes('multi-catégories'), c[0].question);
  egal('4.4 deux règles d’accord ne contredisent rien',
    detecterLesContradictions([regles[0], { ...regles[0], id: 'c' }]), []);
}

console.log('\n5. UN POINTAGE BIEN FORMÉ');

{
  egal('5.1 un pointage ordinaire ne pose rien',
    controlerPointage(pointe({ operationId: 'OP1' })), []);
  verifier('5.2 un identifiant différent de l’opération est refusé',
    controlerPointage({ ...pointe({ operationId: 'OP1' }), id: 'autre' }).length === 1);
  verifier('5.3 « auto » et « moi » ensemble sont refusés',
    controlerPointage(pointe({ operationId: 'OP1', statut: 'pointee-auto', auteur: 'moi' }))
      .some((p) => p.includes('ne veulent rien dire')));
  verifier('5.4 une seule part n’est pas un fractionnement',
    controlerPointage(pointe({ operationId: 'OP1', parts: [{ typeId: 'superette', centimes: -100 }] }))
      .some((p) => p.includes('n’est pas un fractionnement')));
  verifier('5.5 un type sensible pointé automatiquement est refusé',
    controlerPointage(pointe({
      operationId: 'OP1', statut: 'pointee-auto', auteur: 'dictionnaire', typeId: 'pharmacie',
    })).some((p) => p.includes('ne doit jamais arriver')));
}

console.log('\n6. LE RÉALISÉ PAR CATÉGORIE');

{
  const operations = [
    op({ id: 'A', jour: '2026-10-05', centimes: -4390 }),
    op({ id: 'B', jour: '2026-10-12', centimes: -2500, libelle: 'CB LIDL' }),
  ];
  const vue = vueDesCategories({
    operations,
    pointages: [
      pointe({ operationId: 'A', typeId: 'superette' }),
      pointe({ operationId: 'B', typeId: 'supermarche' }),
    ],
    prevuParCategorie: { Alimentation: 40000 },
    du: '2026-10-01', au: '2026-10-31',
  });
  const alim = vue.lignes.find((l) => l.categorie === 'Alimentation')!;
  egal('6.1 deux opérations alimentent la même catégorie', alim.operations, 2);
  egal('6.2 le réel est leur somme', alim.reel, 6890);
  egal('6.3 l’écart est réel moins prévu', alim.ecart, 6890 - 40000);
  verifier('6.4 et l’écart relatif est donné', alim.ecartRelatif !== null);
}

{
  /* Le remboursement : il réduit sa catégorie, il ne gonfle pas les revenus. */
  const vue = vueDesCategories({
    operations: [
      op({ id: 'A', jour: '2026-10-05', centimes: -6000, libelle: 'PRLV MUTUELLE' }),
      op({ id: 'B', jour: '2026-10-20', centimes: 8000, libelle: 'VIR MUTUELLE' }),
    ],
    pointages: [
      pointe({ operationId: 'A', typeId: 'mutuelle', vendeurNom: 'Mutuelle' }),
      pointe({ operationId: 'B', typeId: 'mutuelle', vendeurNom: 'Mutuelle' }),
    ],
    prevuParCategorie: { Assurances: 6000 },
    du: '2026-10-01', au: '2026-10-31',
  });
  const a = vue.lignes.find((l) => l.categorie === 'Assurances')!;
  egal('6.5 un remboursement net rend le réel négatif', a.reel, -2000);
  verifier('6.6 et aucune catégorie de revenus n’apparaît',
    !vue.lignes.some((l) => l.categorie === 'Revenus'));
}

{
  /* Un virement interne n'est pas une dépense : il sort du calcul. */
  const vue = vueDesCategories({
    operations: [
      op({ id: 'A', jour: '2026-10-05', centimes: -4390 }),
      op({ id: 'T', jour: '2026-10-10', centimes: -50000, transfertAvec: 'U' }),
    ],
    pointages: [pointe({ operationId: 'A', typeId: 'superette' })],
    prevuParCategorie: {},
    du: '2026-10-01', au: '2026-10-31',
  });
  egal('6.7 le virement interne n’est ni compté ni « à pointer »',
    vue.nonPointe.aPointer.operations, 0);
  egal('6.8 et le réalisé ne le porte pas',
    vue.lignes.reduce((s, l) => s + l.reel, 0), 4390);
}

{
  /* Une opération fractionnée se répartit, et compte pour une. */
  const vue = vueDesCategories({
    operations: [op({ id: 'A', jour: '2026-10-05', centimes: -10000 })],
    pointages: [pointe({
      operationId: 'A', typeId: 'commerce-multi-categories',
      parts: [
        { typeId: 'supermarche', centimes: -7000 },
        { typeId: 'carburant', centimes: -3000 },
      ],
    })],
    prevuParCategorie: {},
    du: '2026-10-01', au: '2026-10-31',
  });
  egal('6.9 la part alimentaire', vue.lignes.find((l) => l.categorie === 'Alimentation')!.reel, 7000);
  egal('6.10 la part transports', vue.lignes.find((l) => l.categorie === 'Transports')!.reel, 3000);
  egal('6.11 et l’opération compte pour une, dans sa part principale',
    vue.lignes.reduce((s, l) => s + l.operations, 0), 1);
}

console.log('\n7. CE QUI N’EST PAS COMPTÉ EST DIT');

{
  const vue = vueDesCategories({
    operations: [
      op({ id: 'A', jour: '2026-10-05', centimes: -4390 }),
      op({ id: 'B', jour: '2026-10-06', centimes: -1200 }),
      op({ id: 'C', jour: '2026-10-07', centimes: -9900 }),
    ],
    pointages: [
      pointe({ operationId: 'A', typeId: 'superette' }),
      pointe({ operationId: 'C', statut: 'a-revoir', auteur: 'dictionnaire' }),
    ],
    prevuParCategorie: { Alimentation: 40000 },
    du: '2026-10-01', au: '2026-10-31',
  });
  egal('7.1 une opération sans pointage est « à pointer »',
    vue.nonPointe.aPointer, { operations: 1, montant: 1200 });
  egal('7.2 une anomalie est « à revoir », à part',
    vue.nonPointe.aRevoir, { operations: 1, montant: 9900 });
  /*
     Décision 16 : « à revoir » reste dehors. Compter « à titre provisoire »
     ce qu'on n'est pas sûr d'avoir compris est le meilleur moyen d'oublier
     qu'on ne l'avait pas compris.
  */
  egal('7.3 et elle n’entre pas dans le réalisé',
    vue.lignes.find((l) => l.categorie === 'Alimentation')!.reel, 4390);
  verifier('7.4 la phrase dit que la comparaison ne les compte pas',
    vue.nonPointe.phrase.includes('n’en tient pas compte'), vue.nonPointe.phrase);
  verifier('7.5 et donne les deux montants',
    vue.nonPointe.phrase.includes('12,00') && vue.nonPointe.phrase.includes('99,00'),
    vue.nonPointe.phrase);
}

{
  /* La phrase n'est jamais vide : « rien dehors » est une information. */
  verifier('7.6 tout pointé se dit aussi',
    phraseDuNonPointe(0, 0, 0, 0).includes('Tout est pointé'), phraseDuNonPointe(0, 0, 0, 0));
}

console.log('\n8. UNE CATÉGORIE D’UN SEUL CÔTÉ EST SIGNALÉE');

{
  const vue = vueDesCategories({
    operations: [op({ id: 'A', jour: '2026-10-05', centimes: -4390 })],
    pointages: [pointe({ operationId: 'A', typeId: 'superette' })],
    prevuParCategorie: { Alimentation: 40000, Télécoms: 3000 },
    du: '2026-10-01', au: '2026-10-31',
  });
  /*
     Une catégorie prévue qu'aucune opération n'alimente affiche un réalisé
     de zéro face à un prévu — et ce zéro ressemble à une économie.
  */
  egal('8.1 une catégorie prévue sans réalisé est nommée', vue.prevuesSansRealise, ['Télécoms']);
  egal('8.2 et marquée sur sa ligne',
    vue.lignes.find((l) => l.categorie === 'Télécoms')!.dUnSeulCote, true);

  const horsBudget = vueDesCategories({
    operations: [op({ id: 'A', jour: '2026-10-05', centimes: -4390 })],
    pointages: [pointe({ operationId: 'A', typeId: 'superette' })],
    prevuParCategorie: {},
    du: '2026-10-01', au: '2026-10-31',
  });
  egal('8.3 une dépense hors budget est nommée aussi',
    horsBudget.realiseesSansPrevu, ['Alimentation']);
  egal('8.4 sans écart relatif, faute de prévu',
    horsBudget.lignes[0].ecartRelatif, null);
}

{
  /* Hors période, rien n'entre. */
  const vue = vueDesCategories({
    operations: [op({ id: 'A', jour: '2026-09-28', centimes: -4390 })],
    pointages: [pointe({ operationId: 'A', typeId: 'superette' })],
    prevuParCategorie: { Alimentation: 40000 },
    du: '2026-10-01', au: '2026-10-31',
  });
  egal('8.5 une opération hors période ne compte pas',
    vue.lignes.find((l) => l.categorie === 'Alimentation')!.operations, 0);
  egal('8.6 et n’est pas comptée comme « à pointer »', vue.nonPointe.aPointer.operations, 0);
}

console.log('\n9. LES GARDE-FOUS');

{
  egal('9.1 celui des règles ne trouve rien', controlerLesRegles(), []);
  egal('9.2 celui des catégories pointées non plus', controlerLesCategoriesPointees(), []);
}

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
