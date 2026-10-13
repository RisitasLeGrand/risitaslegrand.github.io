/**
 * Lire un relevé : les cas qui ont réellement mordu, et ceux qu'on redoute.
 *
 * **Les morceaux de ces essais sont fabriqués**, mais leur géométrie est
 * celle qui a été mesurée sur deux relevés CIC : en-tête « Débit » à 409 et
 * « Crédit » à 480, montants de débit vers 440 et de crédit vers 515, pages
 * paires décalées de dix points. Les relevés eux-mêmes ont été effacés ; ce
 * qu'il en reste est ici, sous une forme qui s'éprouve sans fichier.
 *
 * Quatre choses s'éprouvent, et la première est celle qui a coûté le plus
 * cher :
 *
 * - **le contrôle de solde attrape ce que la relecture ne voit pas.** Onze
 *   opérations perdues sur 278 produisent 267 lignes parfaitement plausibles ;
 * - **une colonne seule n'est pas deux colonnes.** Sans en-tête, un relevé
 *   sans crédit doit être refusé, et non découpé au hasard ;
 * - **l'en-tête se relit à chaque page**, puisque les pages alternent ;
 * - **cinq virements identiques le même jour restent cinq opérations.**
 */
import {
  ECART_MINIMAL_ENTRE_COLONNES,
  empreinteDeGabarit,
  empreintesDOperations,
  frontiereParEcart,
  indexDeLaDate,
  jourDe,
  lireReleve,
  reconstituerLignes,
  type Morceau,
} from '../src/lib/odyssee/releve';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);
const faux = (intitule: string, condition: boolean) => v(intitule, condition, false);

/* ── Fabrique de morceaux, à la géométrie mesurée ─────────────────────── */

const X_DEBIT = 440;
const X_CREDIT = 515;

let y = 700;
let page = 1;
const morceaux: Morceau[] = [];
const nouvellePage = (decalage = 0) => {
  page += 1;
  y = 700;
  return decalage;
};
const poser = (...bouts: [number, string][]) => {
  for (const [x, texte] of bouts) morceaux.push({ page, x, y, texte });
  y -= 12;
};
const entete = (decalage = 0) =>
  poser([63 + decalage, 'Date'], [98 + decalage, 'Date valeur'], [161 + decalage, 'Opération'],
        [409 + decalage, 'Débit EUROS'], [480 + decalage, 'Crédit EUROS']);
const operation = (jour: string, libelle: string, montant: string, debit: boolean, decalage = 0) =>
  poser([62 + decalage, jour], [98 + decalage, jour], [161 + decalage, libelle],
        [(debit ? X_DEBIT : X_CREDIT) + decalage, montant]);

/* ════════════════════════════════════════════════════════════════════════
   1. Les briques
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES BRIQUES');

{
  v('une date française devient un jour logique', jourDe('05/09/2026'), '2026-09-05');

  const lignes = reconstituerLignes([
    { page: 1, x: 440, y: 100, texte: '5,00' },
    { page: 1, x: 62, y: 101, texte: '05/09/2026' },
    { page: 1, x: 161, y: 100.5, texte: 'PAIEMENT' },
    { page: 1, x: 62, y: 200, texte: 'plus haut' },
  ]);
  v('les morceaux proches se regroupent en lignes', lignes.length, 2);
  v('et chaque ligne est ordonnée de gauche à droite', lignes[1].texte, '05/09/2026 PAIEMENT 5,00');
  v('la ligne du haut vient en premier', lignes[0].texte, 'plus haut');

  const avecMarge = reconstituerLignes([
    { page: 1, x: 55, y: 100, texte: 'X' },
    { page: 1, x: 62, y: 100, texte: '05/09/2026' },
    { page: 1, x: 440, y: 100, texte: '5,00' },
  ])[0];
  /*
     Le caractère de marge : onze lignes sur 278 en portaient un. Exiger la
     date en premier morceau les écartait en silence.
  */
  v('la date est trouvée derrière un caractère de marge', indexDeLaDate(avecMarge), 1);
  v(
    'mais pas au troisième morceau : ce serait une date citée',
    indexDeLaDate(
      reconstituerLignes([
        { page: 1, x: 50, y: 100, texte: 'A' },
        { page: 1, x: 55, y: 100, texte: 'B' },
        { page: 1, x: 62, y: 100, texte: '05/09/2026' },
      ])[0],
    ),
    -1,
  );
}

console.log('\nLA FRONTIÈRE PAR ÉCART, ET SON REFUS');

{
  const deux = frontiereParEcart([435, 440, 444, 510, 515, 520]);
  v('deux groupes nets sont séparés', deux.origine, 'écart');
  vrai('et la coupe tombe entre les deux', deux.x! > 444 && deux.x! < 510);

  /*
     Le cas qui manquait au premier jet : un relevé sans aucun crédit. Les
     abscisses forment un seul paquet, et couper au plus grand écart interne
     inventerait une colonne. Le refus vaut mieux qu'une lecture plausible.
  */
  const une = frontiereParEcart([435, 440, 444, 449]);
  v('une seule colonne est refusée', une.x, null);
  vrai('avec une raison lisible', une.raison.includes('même colonne'));
  v('un seul montant aussi', frontiereParEcart([440]).x, null);
  v(
    `l’écart minimal est de ${ECART_MINIMAL_ENTRE_COLONNES} points`,
    frontiereParEcart([440, 440 + ECART_MINIMAL_ENTRE_COLONNES - 1]).x,
    null,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2. Un relevé complet
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nUN RELEVÉ QUI BOUCLE');

{
  morceaux.length = 0;
  page = 1;
  y = 700;
  poser([57, 'C/C CONTRAT PERSONNEL PARCOURS.J+ N° 00055347 en euros (GD)']);
  entete();
  operation('01/09/2026', 'PAIEMENT PSC TOURNAY', '3,10', true);
  operation('03/09/2026', 'VIR DE M ALEXIS POUSSET', '225,00', false);
  operation('04/09/2026', 'PRLV SEPA PRIXTEL', '5,99', true);
  // Le solde d'ouverture est imprimé en bas de page, après les opérations.
  poser([57, 'SOLDE CREDITEUR AU 31/08/2026'], [515, '525,71']);

  nouvellePage(10);
  poser([67, 'C/C CONTRAT PERSONNEL PARCOURS.J+ N° 00055347 en euros (GD)']);
  entete(10);
  // Page paire : tout est décalé de dix points. L'en-tête de CETTE page sert.
  operation('10/09/2026', 'PAIEMENT CB PARIS', '22,94', true, 10);
  poser([67, 'Réf : 009 SOLDE CREDITEUR AU 30/09/2026'], [525, '718,68']);

  const lecture = lireReleve(morceaux, { producteur: 'UTM2_ps2pdf 0.24.290' });
  v('un seul compte', lecture.comptes.length, 1);
  v('quatre opérations', lecture.comptes[0].operations.length, 4);
  v(
    'signées par leur colonne',
    lecture.comptes[0].operations.map((o) => o.centimes),
    [-310, 22500, -599, -2294],
  );
  /*
     525,71 − 3,10 + 225,00 − 5,99 − 22,94 = 718,68. L'en-tête de la page
     paire, décalé de dix points, a bien servi : avec la frontière de la
     page 1 (480), le montant à 450 serait resté un débit — ce qui est juste
     ici par chance, mais un crédit à 525 serait tombé du mauvais côté.
  */
  v('le compte boucle', lecture.controles[0].verdict, 'boucle');
  v('et le calcul le dit', lecture.controles[0].calcule, 71868);
  vrai('le relevé est importable', lecture.importable);
  v('aucun refus', lecture.refus, null);
  vrai(
    'l’ouverture est le solde le plus ancien, même imprimé en dernier',
    lecture.comptes[0].ouverture?.jour === '2026-08-31',
  );
}

console.log('\nUNE OPÉRATION PERDUE, ET LE SOLDE QUI LA DÉNONCE');

{
  /*
     Le cas réel, en miniature : on retire une opération et rien, dans la
     liste, ne permet de s'en apercevoir. Trois lignes plausibles ressemblent
     exactement à quatre lignes plausibles.
  */
  const ampute = morceaux.filter((m) => !m.texte.includes('PRLV SEPA PRIXTEL') && m.texte !== '5,99');
  const lecture = lireReleve(ampute);
  v('trois opérations seulement', lecture.comptes[0].operations.length, 3);
  v('le compte ne boucle plus', lecture.controles[0].verdict, 'ecart');
  v('et l’écart vaut exactement l’opération manquante', lecture.controles[0].ecart, -599);
  faux('le relevé n’est pas importable', lecture.importable);
  vrai('le message dit quoi chercher', lecture.controles[0].message.includes('manque'));
}

console.log('\nUN CARACTÈRE DE MARGE NE FAIT PAS PERDRE L’OPÉRATION');

{
  morceaux.length = 0;
  page = 1;
  y = 700;
  poser([57, 'LIVRET A SUP N° 000553 en euros (GE)']);
  entete();
  poser([57, 'SOLDE CREDITEUR AU 01/09/2026'], [515, '410,00']);
  operation('05/09/2026', 'VIR C/C CONTRAT PERSONNEL', '105,00', true);
  // Celle-ci porte un « X » dans la marge, comme onze lignes du relevé réel.
  poser([55, 'X'], [62, '10/09/2026'], [98, '10/09/2026'], [161, 'VIR C/C CONTRAT PERSONNEL'], [X_DEBIT, '25,00']);
  poser([57, 'Réf : 047 SOLDE CREDITEUR AU 30/09/2026'], [515, '280,00']);

  const lecture = lireReleve(morceaux);
  v('les deux opérations sont lues', lecture.comptes[0].operations.length, 2);
  v('le compte boucle', lecture.controles[0].verdict, 'boucle');
  vrai('et le relevé est importable', lecture.importable);
}

console.log('\nUN RELEVÉ SANS SOLDE IMPRIMÉ EST INVÉRIFIABLE');

{
  morceaux.length = 0;
  page = 1;
  y = 700;
  poser([57, 'COMPTE COURANT N° 1234 en euros']);
  entete();
  operation('05/09/2026', 'PAIEMENT', '12,00', true);

  const lecture = lireReleve(morceaux);
  v('le verdict est explicite', lecture.controles[0].verdict, 'invérifiable');
  faux('et rien n’est importable', lecture.importable);
  vrai(
    'le message dit pourquoi',
    lecture.controles[0].message.includes('n’imprime pas ses soldes'),
  );
  /*
     L'opération est bien lue : ce n'est pas la lecture qui échoue, c'est la
     vérification. La distinction compte, parce que l'écran propose une
     dérogation explicite dans ce cas, et rien du tout dans l'autre.
  */
  v('mais l’opération est lue', lecture.comptes[0].operations.length, 1);
}

console.log('\nUN SOLDE DÉBITEUR EST NÉGATIF');

{
  morceaux.length = 0;
  page = 1;
  y = 700;
  poser([57, 'C/C DECOUVERT N° 9 en euros']);
  entete();
  poser([57, 'SOLDE DEBITEUR AU 01/09/2026'], [515, '120,00']);
  operation('05/09/2026', 'VIR DE SALAIRE', '200,00', false);
  poser([57, 'SOLDE CREDITEUR AU 30/09/2026'], [515, '80,00']);

  const lecture = lireReleve(morceaux);
  v('l’ouverture est négative', lecture.comptes[0].ouverture?.centimes, -12000);
  v('et le compte boucle quand même', lecture.controles[0].verdict, 'boucle');
}

/* ════════════════════════════════════════════════════════════════════════
   3. L'empreinte de gabarit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’EMPREINTE DÉCRIT UNE FORME, PAS UNE PERSONNE');

{
  const fabriquer = (pages: number, titulaire: string) => {
    morceaux.length = 0;
    page = 1;
    y = 700;
    for (let p = 1; p <= pages; p += 1) {
      poser([57, `C/C N° 00055347 en euros`]);
      poser([57, `TITULAIRE : ${titulaire}`]);
      entete();
      operation('05/09/2026', 'PAIEMENT', `${p},00`, true);
      if (p < pages) nouvellePage();
    }
    return reconstituerLignes([...morceaux]);
  };

  const a = empreinteDeGabarit(fabriquer(9, 'M ALEXIS POUSSET'), 'UTM2_ps2pdf 0.24.290');
  const b = empreinteDeGabarit(fabriquer(10, 'MME AUTRE PERSONNE'), 'UTM2_ps2pdf 0.24.290');
  v('deux relevés du même gabarit ont la même empreinte', a, b);
  faux('elle ne contient aucun nom', a.includes('POUSSET'));
  faux('ni aucun numéro de compte', a.includes('00055347'));
  faux('ni aucun montant', /\d,\d\d/.test(a));
  vrai('mais elle contient les colonnes', a.includes('Débit EUROS@409'));

  const refait = empreinteDeGabarit(
    reconstituerLignes([
      { page: 1, x: 70, y: 100, texte: 'Débit EUR' },
      { page: 1, x: 500, y: 100, texte: 'Crédit EUR' },
    ]),
    'AutrePDF 2.0',
  );
  vrai('une mise en page refaite donne une autre empreinte', refait !== a);
  vrai(
    'et un relevé sans en-tête le dit',
    empreinteDeGabarit([], 'X').includes('sans en-tête'),
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. Les doublons
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCINQ VIREMENTS IDENTIQUES RESTENT CINQ OPÉRATIONS');

{
  const cinq = Array.from({ length: 5 }, () => ({
    jour: '2026-09-03',
    libelle: 'VIR DE M ALEXIS POUSSET',
    centimes: 500,
    page: 1,
  }));
  const empreintes = empreintesDOperations('C1', cinq);
  v('cinq empreintes distinctes', new Set(empreintes).size, 5);
  vrai('le rang les distingue', empreintes[0].endsWith('|1') && empreintes[4].endsWith('|5'));

  /*
     Et deux imports du même relevé donnent les mêmes empreintes : c'est ce
     qui permet aux périodes qui se chevauchent de ne pas créer de doublons.
  */
  v('le même relevé relu donne les mêmes', empreintesDOperations('C1', cinq), empreintes);
  vrai(
    'un autre compte donne d’autres empreintes',
    empreintesDOperations('C2', cinq)[0] !== empreintes[0],
  );
  /*
     Le libellé est normalisé : la banque change parfois la casse ou les
     espaces d'un mois à l'autre, et cela ne doit pas créer de doublon.
  */
  v(
    'la casse et les espaces ne comptent pas',
    empreintesDOperations('C1', [{ ...cinq[0], libelle: '  vir de m  alexis pousset ' }])[0],
    empreintes[0],
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
