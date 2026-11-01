/**
 * Le moteur de PCCT — L1, sans écran et sans navigateur.
 *
 *   npm run essais:pcct
 *
 * Sept gardes, et chacune vise un défaut que la référence porte ou qu'une
 * retouche ferait réapparaître sans bruit. Le rythme, lui, ne se vérifie pas à
 * la lecture : on le fait tourner contre un JOUEUR SIMULÉ dont la précision est
 * connue d'avance, et on regarde où l'intervalle s'arrête. C'est la seule façon
 * de distinguer un rythme juste d'un rythme qui converge sur autre chose.
 */
import {
  BORNES,
  DEFAUTS,
  reglagesParDefaut,
  valeurValide,
  type Reglages,
} from '../src/features/pcct/moteur/reglages';
import { resultatAttendu } from '../src/features/pcct/moteur/calcul';
import {
  accumuler,
  comptesInhibitionNeufs,
  compterInhibition,
  debutDeBloc,
  donneesNeuves,
  essaiComplet,
  jugerInhibition,
  operationDuRang,
  operationsCommutables,
  sensAttendu,
  sensEntre,
  type Evenement,
} from '../src/features/pcct/moteur/modules';
import { delaiDeGraceValide } from '../src/features/pcct/moteur/reglages';
import { diviseursAdmissibles, prochainNombre } from '../src/features/pcct/moteur/tirage';
import {
  AJUSTEMENT_MAX,
  BLOC,
  FENETRE_PRECISION,
  PAS_STANDARD,
  apresEssai,
  rythmeNeuf,
} from '../src/features/pcct/moteur/rythme';
import {
  ECART_MAX,
  ECART_MIN,
  consigneAPoser,
  consigneVisible,
  prospectiveNeuve,
  scoreProspective,
  surFrappe,
  surLeTemps,
} from '../src/features/pcct/moteur/prospective';
import { mediane, p90, scores } from '../src/features/pcct/moteur/notation';
import { DepotEnMemoire } from '../src/features/pcct/moteur/depot';
import {
  noter,
  noterLEssai,
  poserEssai,
  resumer,
  seanceNeuve,
} from '../src/features/pcct/moteur/seance';
import { attribuer } from '../src/features/pcct/moteur/grace';
import { melanger, paveDeLEssai, reponsesPossibles } from '../src/features/pcct/moteur/pave';
import { examinerLesVoix } from '../src/features/pcct/voix';

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(
    `${ok ? '  ✓' : '  ✗'} ${titre}` +
      (ok ? '' : `\n      obtenu ${JSON.stringify(obtenu)} · attendu ${JSON.stringify(attendu)}`),
  );
}

/** Un hasard reproductible : suite déterministe dans [0, 1[. */
function hasardFixe(graine: number) {
  let etat = graine;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}

const avec = (modifs: Partial<Reglages>): Reglages => ({ ...reglagesParDefaut(), ...modifs });

console.log('\nRÉGLAGES — une seule source, et une copie en profondeur');
verifier('les défauts sont ceux du moteur, pas ceux de l’écran', [DEFAUTS.duree, DEFAUTS.intervalleDepart], [15, 1500]);
{
  /*
     LA COPIE SE VÉRIFIE SUR UN SOUS-OBJET, ET NULLE PART AILLEURS.

     Mon premier essai modifiait `n`, un nombre : une copie superficielle et une
     copie profonde donnent alors le même résultat, et le sabotage qui rendait la
     copie superficielle passait au VERT. La garde ne tenait rien.

     Le défaut de la référence porte sur ses réglages IMBRIQUÉS : son jeu
     d'opérations commutées est partagé entre la table des défauts et chaque
     copie, de sorte que la première case décochée après un retour aux défauts
     corrompt les défauts eux-mêmes, définitivement.
  */
  const a = reglagesParDefaut();
  a.n = 5;
  const b = reglagesParDefaut();
  verifier('un nombre modifié ne touche pas les défauts', b.n, DEFAUTS.n);
  /*
     ON VÉRIFIE L'IDENTITÉ, ON NE MODIFIE PAS.

     Ma première écriture écrivait dans le sous-objet de la copie. Avec une copie
     superficielle, ce sous-objet EST celui des défauts, qui est gelé : l'essai
     levait un TypeError au lieu de rendre un rouge nommé. Il mordait donc, mais
     en plantant — et un plantage arrête tous les constats qui suivent, en plus
     de se lire mal.

     La propriété à tenir est que la copie ne PARTAGE pas le sous-objet. Elle se
     lit directement, sans rien casser.
  */
  verifier('la copie ne partage pas le sous-objet', a.operationsCommutees !== DEFAUTS.operationsCommutees, true);
  verifier('et la table est gelée en profondeur', Object.isFrozen(DEFAUTS.operationsCommutees), true);
}
verifier('une chaîne enregistrée retombe sur le défaut', valeurValide('beaucoup', BORNES.n, 1), 1);
verifier('null aussi, et non sur le minimum', valeurValide(null, BORNES.intervalleDepart, 1500), 1500);
verifier('une valeur hors bornes est ramenée', valeurValide(99, BORNES.n, 1), BORNES.n.max);
verifier('une valeur hors grille tombe sur le cran', valeurValide(1537, BORNES.intervalleDepart, 1500), 1550);

console.log('\nCALCUL — deux opérations sur quatre ne sont pas commutatives');
verifier('somme : 3 et 8', resultatAttendu('somme', 3, 8), 11);
verifier('différence : référence moins courant', resultatAttendu('difference', 3, 8), 5);
verifier('et non l’inverse', resultatAttendu('difference', 8, 3), -5);
verifier('produit : 3 et 8', resultatAttendu('produit', 3, 8), 24);
verifier('quotient : référence sur courant', resultatAttendu('quotient', 3, 9), 3);
verifier('un quotient non entier est refusé, pas arrondi', resultatAttendu('quotient', 4, 9), null);
verifier('un quotient par zéro est refusé', resultatAttendu('quotient', 0, 9), null);

console.log('\nGARDE 1 — LA DIVISION TOMBE JUSTE, À TOUTE PLAGE');
{
  /* Le défaut de la référence apparaît dès que le minimum dépasse 1. On balaie
     donc les plages, et pas seulement celle par défaut. */
  let entiers = 0;
  let total = 0;
  let videTrouve = false;
  for (let min = 0; min <= 9; min += 1) {
    for (let max = Math.max(1, min); max <= 12; max += 1) {
      if (min > 0 && diviseursAdmissibles(max, min, max).length === 0) videTrouve = true;
      const hasard = hasardFixe(min * 100 + max);
      for (let i = 0; i < 40; i += 1) {
        const reference = min + Math.floor(hasard() * (max - min + 1));
        const courant = prochainNombre(hasard, 'quotient', reference, min, max);
        const attendu = resultatAttendu('quotient', courant, reference);
        total += 1;
        if (attendu !== null && Number.isInteger(attendu)) entiers += 1;
      }
    }
  }
  /*
     UN BALAYAGE QUI N'A RIEN LU REND ZÉRO, COMME UN MOTEUR PARFAIT.

     `entiers === total` est vrai quand les deux valent zéro. Si les bornes de
     boucle changeaient, ou si le tirage levait, ce constat passerait au VERT en
     n'ayant rien mesuré. La prémisse pose donc un PLANCHER explicite : moins de
     trois mille essais balayés, et l'essai refuse de conclure. La règle vient
     d'A, qui l'a payée sur un analyseur de source.
  */
  verifier('prémisse — le balayage a bien lu des milliers de plages', total >= 3000, true);
  verifier(`${total} essais de quotient, tous entiers`, entiers, total);
  verifier('aucune plage ne laisse l’ensemble des diviseurs vide', videTrouve, false);
  verifier('zéro n’est jamais le diviseur', prochainNombre(hasardFixe(7), 'quotient', 6, 0, 6) !== 0, true);
}

console.log('\nGARDE 2 — L’ÉCHAUFFEMENT NE NOTE RIEN');
{
  for (const n of [1, 3, 5]) {
    const etat = seanceNeuve(avec({ n, operation: 'somme' }));
    const depot = new DepotEnMemoire();
    const hasard = hasardFixe(n);
    const sansReference: number[] = [];
    for (let i = 0; i < n + 4; i += 1) {
      const essai = poserEssai(etat, hasard);
      if (essai.attendu === null) sansReference.push(essai.rang);
      /* On répond n'importe quoi : un essai d'échauffement ne doit ni compter
         juste ni compter faux. */
      await noter(etat, { donne: 0, reaction: 300, aide: null }, depot);
    }
    verifier(`n=${n} : les ${n} premiers essais n’ont pas de référence`, sansReference, Array.from({ length: n }, (_, i) => i + 1));
    verifier(`n=${n} : seuls les 4 suivants sont notés`, etat.comptes.notes, 4);
    verifier(`n=${n} : le dépôt n’a reçu que ceux-là`, depot.essais.length, 4);
    verifier(`n=${n} : l’intervalle n’a pas bougé pendant l’échauffement`, etat.intervalles.length, 4);
  }
}

console.log('\nGARDE 3 — LE RYTHME RESTE DANS SES BORNES');
{
  for (const rythme of ['standard', 'douce', 'precision'] as const) {
    const reglages = avec({ rythme, intervalleMin: 50, intervalleMax: 6000, intervalleDepart: 1500 });
    /* Mille essais tous justes, puis mille tous faux : de quoi écraser les deux
       bornes si elles n'étaient pas tenues. */
    let etat = rythmeNeuf(reglages);
    for (let i = 0; i < 1000; i += 1) etat = apresEssai(etat, true, reglages);
    verifier(`${rythme} : mille réussites ne descendent pas sous le plancher`, etat.intervalle >= 50, true);
    for (let i = 0; i < 2000; i += 1) etat = apresEssai(etat, false, reglages);
    verifier(`${rythme} : deux mille échecs ne dépassent pas le plafond`, etat.intervalle <= 6000, true);
  }
}

console.log('\nGARDE 4 — LE BLOC STANDARD EXIGE QUATRE JUSTES SUR CINQ');
{
  const reglages = avec({ rythme: 'standard', intervalleDepart: 2000 });
  const jouer = (verdicts: boolean[]) => {
    let etat = rythmeNeuf(reglages);
    for (const juste of verdicts) etat = apresEssai(etat, juste, reglages);
    return etat;
  };
  verifier('rien ne bouge au milieu d’un bloc', jouer([true, true, true, true]).intervalle, 2000);
  verifier('5 justes sur 5 : on accélère', jouer([true, true, true, true, true]).intervalle, 2000 - PAS_STANDARD);
  verifier('4 sur 5 : on accélère aussi', jouer([true, true, true, true, false]).intervalle, 2000 - PAS_STANDARD);
  verifier('3 sur 5 : on ralentit', jouer([true, true, true, false, false]).intervalle, 2000 + PAS_STANDARD);
  verifier('0 sur 5 : on ralentit', jouer([false, false, false, false, false]).intervalle, 2000 + PAS_STANDARD);
  verifier('le bloc repart à zéro', jouer(Array(BLOC).fill(true)).dansLeBloc, 0);
}

console.log('\nGARDE 5 — « PRECISION » BORNE SON AJUSTEMENT À ±80 ms');
{
  const reglages = avec({ rythme: 'precision', precisionCible: 85, intervalleDepart: 3000 });
  /* Fenêtre pleine de justes : la précision est de 100 %, l'écart de −0,15,
     l'ajustement voulu de −24 ms. Fenêtre pleine de faux : écart de +0,85, soit
     +136 ms voulus, qui doivent être ramenés à +80. */
  let tousJustes = rythmeNeuf(reglages);
  for (let i = 0; i < FENETRE_PRECISION; i += 1) tousJustes = apresEssai(tousJustes, true, reglages);
  verifier('fenêtre incomplète : rien ne bouge', (() => {
    let e = rythmeNeuf(reglages);
    for (let i = 0; i < FENETRE_PRECISION - 1; i += 1) e = apresEssai(e, true, reglages);
    return e.intervalle;
  })(), 3000);
  verifier('fenêtre pleine de justes : −24 ms, non bornés', tousJustes.intervalle, 3000 - 24);
  let tousFaux = rythmeNeuf(reglages);
  for (let i = 0; i < FENETRE_PRECISION; i += 1) tousFaux = apresEssai(tousFaux, false, reglages);
  verifier(`fenêtre pleine de faux : +${AJUSTEMENT_MAX} ms et pas 136`, tousFaux.intervalle, 3000 + AJUSTEMENT_MAX);
}

console.log('\nLE RYTHME CONTRE UN JOUEUR SIMULÉ');
{
  /* Un joueur dont la précision est fixée d'avance. « precision » doit faire
     converger l'intervalle là où l'écart s'annule : au-dessus de la cible, il
     accélère sans fin jusqu'au plancher ; en dessous, il ralentit jusqu'au
     plafond. C'est la signature qu'on vérifie, et non une valeur devinée. */
  const faireTourner = (precisionDuJoueur: number, cible: number) => {
    const reglages = avec({
      rythme: 'precision',
      precisionCible: cible,
      intervalleDepart: 3000,
      intervalleMin: 50,
      intervalleMax: 6000,
    });
    const hasard = hasardFixe(42);
    let etat = rythmeNeuf(reglages);
    for (let i = 0; i < 4000; i += 1) etat = apresEssai(etat, hasard() < precisionDuJoueur, reglages);
    return etat.intervalle;
  };
  verifier('un joueur à 98 % contre une cible de 85 : plancher atteint', faireTourner(0.98, 85), 50);
  verifier('un joueur à 40 % contre une cible de 85 : plafond atteint', faireTourner(0.4, 85), 6000);
}

console.log('\nGARDE 6 — UNE CONSIGNE ÉCHUE N’EN FAIT PAS MANQUER UNE AUTRE');
{
  const reglages = avec({ prospectiveFenetre: 3000, prospectiveEnAttente: 2 });
  const etat = prospectiveNeuve();
  /* Deux consignes échues en même temps, deux touches différentes. */
  etat.enAttente = [
    { id: 'pm-1', creeeA: 0, echeance: 10000, fenetre: 3000, touche: 'K' },
    { id: 'pm-2', creeeA: 100, echeance: 10000, fenetre: 3000, touche: 'L' },
  ];
  const premiere = surFrappe(etat, 'L', 10500);
  verifier('la frappe résout la consigne dont la touche correspond', [premiere?.id, premiere?.verdict], ['pm-2', 'juste']);
  verifier('l’autre attend encore sa propre fenêtre', etat.enAttente.map((c) => c.id), ['pm-1']);
  const seconde = surFrappe(etat, 'K', 11000);
  verifier('et elle se résout à son tour', [seconde?.id, seconde?.verdict], ['pm-1', 'juste']);
  verifier('deux justes, aucune manquée', scoreProspective(etat), 1);
}
{
  const etat = prospectiveNeuve();
  etat.enAttente = [{ id: 'pm-1', creeeA: 0, echeance: 10000, fenetre: 3000, touche: 'K' }];
  verifier('une touche hors fenêtre ne résout rien', surFrappe(etat, 'K', 9000), null);
  verifier('la mauvaise touche dans la fenêtre est une fausse', surFrappe(etat, 'Z', 11000)?.verdict, 'fausse');
}
{
  const etat = prospectiveNeuve();
  etat.enAttente = [
    { id: 'pm-1', creeeA: 0, echeance: 10000, fenetre: 3000, touche: 'K' },
    { id: 'pm-2', creeeA: 0, echeance: 10000, fenetre: 3000, touche: 'L' },
  ];
  const tardives = new Map([['pm-1', { touche: 'K', instant: 14000 }]]);
  const jugees = surLeTemps(etat, 14500, tardives);
  verifier('la bonne touche trop tard est « manquée »', jugees.find((c) => c.id === 'pm-1')?.verdict, 'manquee');
  verifier('rien du tout est « omise »', jugees.find((c) => c.id === 'pm-2')?.verdict, 'omise');
}

console.log('\nGARDE 7 — L’HORIZON COURT N’ARRÊTE PAS LA PROGRAMMATION');
{
  const reglages = avec({ prospectiveFenetre: 3000, prospectiveEnAttente: 2, prospectiveHorizon: 60000 });
  const hasard = hasardFixe(9);
  const etat = prospectiveNeuve();
  /* Fin de séance à 900 s. Une consigne doit se poser, et son échéance plus sa
     fenêtre doit tenir avant la fin. */
  const posee = consigneAPoser(etat, 0, 900000, reglages, hasard);
  verifier('une consigne est posée au début', posee !== null, true);
  verifier('son écart tient dans les bornes', posee !== null && posee.echeance >= ECART_MIN && posee.echeance <= ECART_MAX, true);
  /* Plus de place : l'échéance plus la fenêtre dépasseraient la fin. */
  verifier('aucune consigne quand il ne reste pas la place', consigneAPoser(prospectiveNeuve(), 899000, 900000, reglages, hasard), null);

  /*
     ET LE REFUS NE VERROUILLE RIEN — sur une SÉANCE ENTIÈRE.

     Mon premier essai comparait deux états NEUFS, ce qui ne prouvait rien : un
     garde-fou qui arrête définitivement la programmation passait au vert, parce
     qu'un état neuf ne porte pas la trace du refus précédent. On déroule donc
     une séance de quinze minutes seconde par seconde, en résolvant les consignes
     au passage, et on regarde QUAND la dernière a été posée.
  */
  {
    const etatLong = prospectiveNeuve();
    const fin = 900000;
    let derniereCreationA = -1;
    let creees = 0;
    for (let t = 0; t <= fin; t += 500) {
      const posee = consigneAPoser(etatLong, t, fin, reglages, hasard);
      if (posee) {
        etatLong.enAttente.push(posee);
        derniereCreationA = t;
        creees += 1;
      }
      /* On répond juste à tout ce qui est échu, pour libérer les places. */
      for (const c of [...etatLong.enAttente]) {
        if (t >= c.echeance && t <= c.echeance + c.fenetre) surFrappe(etatLong, c.touche, t);
      }
      surLeTemps(etatLong, t, new Map());
    }
    verifier('une séance de 15 min porte des dizaines de consignes', creees > 20, true);
    verifier('et la dernière est posée dans la dernière minute', derniereCreationA > fin - 60000, true);
    verifier('aucune ne reste en attente à la fin', etatLong.enAttente.length, 0);
  }
  /* Le plafond d'attente ne dépasse jamais l'horizon réglé. */
  const court = avec({ prospectiveHorizon: 13000 });
  const avecHorizonCourt = consigneAPoser(prospectiveNeuve(), 0, 900000, court, hasardFixe(3));
  verifier('l’horizon réglé plafonne l’attente', avecHorizonCourt !== null && avecHorizonCourt.echeance <= 13000, true);
}
{
  const reglages = avec({ prospectiveEnAttente: 2 });
  const etat = prospectiveNeuve();
  etat.enAttente = [
    { id: 'a', creeeA: 0, echeance: 20000, fenetre: 3000, touche: 'K' },
    { id: 'b', creeeA: 0, echeance: 25000, fenetre: 3000, touche: 'L' },
  ];
  verifier('deux en attente : pas de troisième', consigneAPoser(etat, 1000, 900000, reglages, hasardFixe(1)), null);
}
{
  const reglages = avec({ prospectiveAffichage: 6500 });
  const consigne = { id: 'x', creeeA: 1000, echeance: 20000, fenetre: 3000, touche: 'K' };
  verifier('la consigne est visible pendant son affichage', consigneVisible(consigne, 7000, reglages), true);
  verifier('et plus du tout ensuite', consigneVisible(consigne, 7501, reglages), false);
  verifier('RIEN n’est rappelé à l’échéance', consigneVisible(consigne, 20000, reglages), false);
}

console.log('\nLA SOMME DE RÉFÉRENCE EST L’ATTENDU PRÉCÉDENT, RÉUSSI OU NON');
{
  /*
     La décision du Pilote, et le défaut de la référence qu'elle écarte : celle-ci
     ne retient l'attendu que des essais RÉUSSIS, de sorte qu'après un essai
     manqué la comparaison porte sur une somme plus ancienne que la précédente.
     On joue donc une suite où l'essai du milieu est MANQUÉ, et on regarde à quoi
     l'essai suivant se réfère.
  */
  const etat = seanceNeuve(avec({ n: 1, operation: 'somme' }));
  const depot = new DepotEnMemoire();
  const hasard = hasardFixe(11);

  poserEssai(etat, hasard);
  verifier('prémisse — rien à comparer au premier essai', etat.attenduPrecedent, null);
  await noter(etat, { donne: 0, reaction: 200, aide: null }, depot);

  const deuxieme = poserEssai(etat, hasard);
  verifier('prémisse — le deuxième essai a bien un attendu', typeof deuxieme.attendu, 'number');
  /* ON LE MANQUE EXPRÈS. */
  const manque = await noter(etat, { donne: deuxieme.attendu! + 1, reaction: 250, aide: null }, depot);
  verifier('prémisse — il est bien compté manqué', manque?.juste, false);

  const troisieme = poserEssai(etat, hasard);
  verifier(
    'l’attendu de référence est celui de l’essai MANQUÉ, non d’un plus ancien',
    etat.attenduPrecedent,
    deuxieme.attendu,
  );
  verifier('et il diffère de l’attendu courant', etat.attenduPrecedent !== troisieme.attendu, true);

  /* Et il se décale encore après un essai réussi, pour que la garde ne soit pas
     vraie par accident sur une suite où rien ne bouge. */
  await noter(etat, { donne: troisieme.attendu, reaction: 250, aide: null }, depot);
  poserEssai(etat, hasard);
  verifier('après un essai réussi, la référence suit aussi', etat.attenduPrecedent, troisieme.attendu);
}

console.log('\nNOTATION — « null » n’est pas zéro');
verifier('aucun essai noté : pas de score arithmétique', scores({ notes: 0, justes: 0 }, null).arithmetique, null);
verifier('ni de global', scores({ notes: 0, justes: 0 }, null).global, null);
verifier('sans mémoire prospective, le global est l’arithmétique seule', scores({ notes: 10, justes: 8 }, null).global, 0.8);
verifier('avec les deux, c’est leur moyenne', scores({ notes: 10, justes: 8 }, 0.6).global, 0.7);
verifier('médiane d’une série paire', mediane([100, 200, 300, 400]), 250);
verifier('médiane d’une série impaire', mediane([300, 100, 200]), 200);
verifier('médiane d’une série vide', mediane([]), null);
verifier('le p90 de dix valeurs', p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 9);

console.log('\nGARDE 8 — LE DÉLAI DE GRÂCE RATTRAPE, ET NE SERT PAS DEUX FOIS');
{
  /*
     La référence porte une fenêtre de grâce qui ne sert JAMAIS : la branche qui
     note l'essai courant vient avant celle qui note la fenêtre, et consomme la
     frappe. L'ordre des cas est donc la règle, et le sabotage l'inverse.
  */
  const base = {
    delaiDeGrace: 150,
    courantEnAttente: true,
    precedentSansReponse: true,
  };
  verifier('dans la fenêtre, la frappe rattrape l’essai précédent', attribuer({ ...base, depuisLApparition: 100 }), 'precedent');
  verifier('à la limite exacte, elle rattrape encore', attribuer({ ...base, depuisLApparition: 150 }), 'precedent');
  verifier('un pas au-delà, elle va au courant', attribuer({ ...base, depuisLApparition: 151 }), 'courant');
  verifier(
    'si le précédent a été répondu, rien à rattraper : le courant',
    attribuer({ ...base, depuisLApparition: 50, precedentSansReponse: false }),
    'courant',
  );
  verifier(
    'l’aide éteinte ne rattrape rien',
    attribuer({ ...base, depuisLApparition: 50, delaiDeGrace: 0 }),
    'courant',
  );
  verifier(
    'le courant déjà noté, hors fenêtre : la frappe est perdue, non comptée deux fois',
    attribuer({ ...base, depuisLApparition: 500, courantEnAttente: false }),
    'perdue',
  );
  verifier(
    'mais dans la fenêtre, elle rattrape même si le courant est noté',
    attribuer({ ...base, depuisLApparition: 50, courantEnAttente: false }),
    'precedent',
  );

  /*
     ET LA FRAPPE RATTRAPÉE EST JUGÉE CONTRE LE PRÉCÉDENT, non contre le
     courant. Décider à quel essai elle appartient ne sert à rien si elle est
     ensuite comparée au mauvais nombre : l'aide produirait la faute qu'elle
     existe pour empêcher. D'où `noterLEssai`, qui prend l'essai dont on parle.
  */
  const reglages = avec({ n: 1, nombreMin: 1, nombreMax: 9, operation: 'somme' });
  const etat = seanceNeuve(reglages);
  const depot = new DepotEnMemoire();
  /* Un seul hasard pour les trois tirages : deux appels à une graine neuve
     rendraient le même nombre, et les deux attendus seraient égaux — la mesure
     qui suit ne séparerait alors plus rien. */
  const h = hasardFixe(4242);
  poserEssai(etat, h);                       /* échauffement : pas d'attendu */
  const precedent = poserEssai(etat, h);
  const courant = poserEssai(etat, h);
  verifier('prémisse — les deux essais ont un attendu', [precedent.attendu !== null, courant.attendu !== null], [true, true]);
  verifier('prémisse — et les deux attendus diffèrent', precedent.attendu === courant.attendu, false);

  const juge = await noterLEssai(
    etat,
    precedent,
    { donne: precedent.attendu, reaction: 120, aide: 'delai-de-grace' },
    depot,
  );
  verifier('la frappe rattrapée est juste contre l’attendu du PRÉCÉDENT', juge?.juste, true);
  verifier('et c’est bien l’essai précédent qui part au dépôt', depot.essais.at(-1)?.essai.rang, precedent.rang);

  /* Et la même valeur, comparée au courant, serait fausse : c'est ce qui rend
     la mesure concluante plutôt que tautologique. */
  const contreLeCourant = await noterLEssai(
    etat,
    courant,
    { donne: precedent.attendu, reaction: 120, aide: 'delai-de-grace' },
    depot,
  );
  verifier('la même valeur contre le courant serait fausse', contreLeCourant?.juste, false);
}

console.log('\nGARDE 9 — LA VOIX EST FRANÇAISE ET LOCALE, OU L’ÉCRAN LE DIT');
{
  const v = (nom: string, lang: string, localService: boolean) =>
    ({ name: nom, lang, localService, default: false, voiceURI: nom }) as SpeechSynthesisVoice;

  const aucune = examinerLesVoix([]);
  verifier('aucune voix : en visuel', [aucune.enVisuel, aucune.voix], [true, null]);
  verifier('et la raison est dite', aucune.raison.length > 20, true);

  const distante = examinerLesVoix([v('Céleste', 'fr-FR', false)]);
  verifier('une voix française DISTANTE est refusée', [distante.enVisuel, distante.voix], [true, null]);
  verifier('et la raison nomme le réseau', distante.raison.includes('réseau'), true);

  const anglaiseLocale = examinerLesVoix([v('Daniel', 'en-GB', true)]);
  verifier('une voix locale ANGLAISE est refusée', anglaiseLocale.enVisuel, true);
  verifier('et la raison ne parle pas de réseau', anglaiseLocale.raison.includes('réseau'), false);

  const bonne = examinerLesVoix([v('Daniel', 'en-GB', true), v('Thomas', 'fr-FR', true)]);
  verifier('une voix locale française est retenue', bonne.voix?.name, 'Thomas');
  verifier('et la séance n’est pas en visuel', bonne.enVisuel, false);
  verifier('et la raison la nomme', bonne.raison.includes('Thomas'), true);

  const canadienne = examinerLesVoix([v('Amélie', 'fr-CA', true)]);
  verifier('« fr-CA » est bien du français', canadienne.voix?.name, 'Amélie');
  verifier('mais « frison » ne l’est pas', examinerLesVoix([v('X', 'fry-NL', true)]).voix, null);
}

console.log('\nLE DÉPÔT — une séance ne se clôt qu’une fois');
{
  const reglages = avec({});
  const etat = seanceNeuve(reglages);
  const depot = new DepotEnMemoire();
  const premier = resumer(etat, '2026-10-31T18:00:00.000Z', 'standard', 900);
  await depot.cloreSeance(premier);
  await depot.cloreSeance({ ...premier, secondes: 1 });
  verifier('la seconde clôture est ignorée', depot.seance?.secondes, 900);
}

console.log('\nGARDE 10 — LE PAVÉ OFFRE ZÉRO ET LES NÉGATIFS QUAND ILS SONT POSSIBLES');
{
  /*
     La référence bâtit sa grille sur une plage devinée : ni zéro ni négatifs,
     alors qu'une différence en produit dès que le courant dépasse la référence.
     Une réponse juste devient alors intapable au doigt.
  */
  const diff = reponsesPossibles('difference', 1, 9);
  verifier('prémisse — l’ensemble des différences n’est pas vide', diff.length > 10, true);
  verifier('la différence offre zéro', diff.includes(0), true);
  verifier('et des négatifs', diff.some((x) => x < 0), true);
  verifier('et son plus petit est min − max', Math.min(...diff), 1 - 9);
  verifier('et son plus grand est max − min', Math.max(...diff), 9 - 1);

  const somme = reponsesPossibles('somme', 1, 9);
  verifier('la somme n’offre aucun négatif', somme.some((x) => x < 0), false);
  verifier('et va de 2 à 18', [Math.min(...somme), Math.max(...somme)], [2, 18]);

  /*
     Le quotient est ÉNUMÉRÉ et non borné, et c'est le SABOTAGE qui a imposé la
     plage de cet essai. Sur 1 à 9, l'ensemble énuméré des quotients se trouve
     être exactement 1 à 9 — tout entier s'y divise par 1 — si bien qu'un pavé
     bâti sur l'intervalle entier y passait pour juste. Mesuré sur 2 à 9, les
     deux se séparent : seuls 1, 2, 3 et 4 sont atteignables, et 5 à 9 sont des
     réponses que l'exercice ne demande jamais.
  */
  const quot = reponsesPossibles('quotient', 2, 9);
  verifier('les quotients de 2 à 9 sont exactement ceux-là', quot, [1, 2, 3, 4]);
  verifier('aucun quotient n’est à virgule', quot.every(Number.isInteger), true);
  /* Et 1 y est, bien qu'il soit SOUS le minimum : une référence divisée par
     elle-même fait 1, et un pavé qui refuserait les valeurs hors plage le
     perdrait. */
  verifier('le quotient 1 est offert même sous le minimum', quot.includes(1), true);

  /* Une plage trop large rend une liste VIDE : l'écran passe alors au clavier,
     plutôt que d'afficher deux cents touches qui ne sont pas une aide. */
  verifier('une plage trop large n’a pas de pavé', reponsesPossibles('produit', 1, 99), []);
}

console.log('\nGARDE 11 — LE PAVÉ SE REMÉLANGE À CHAQUE ESSAI');
{
  const reponses = reponsesPossibles('somme', 1, 9);
  verifier('prémisse — il y a de quoi mélanger', reponses.length >= 10, true);

  verifier('croissant ne touche à rien', paveDeLEssai(reponses, 'croissant', 7), [...reponses]);
  verifier('décroissant renverse', paveDeLEssai(reponses, 'decroissant', 7), [...reponses].reverse());

  const essai3 = paveDeLEssai(reponses, 'melange', 3);
  const essai4 = paveDeLEssai(reponses, 'melange', 4);
  verifier('mélangé, l’ordre change d’un essai à l’autre', JSON.stringify(essai3) === JSON.stringify(essai4), false);
  verifier('et le même essai rend le même ordre', paveDeLEssai(reponses, 'melange', 3), essai3);
  verifier('aucune réponse perdue au mélange', [...essai3].sort((a, b) => a - b), [...reponses]);
  verifier('ni dupliquée', new Set(essai3).size, reponses.length);

  /* Et sur vingt essais, aucun ordre ne se répète : un mélange qui retomberait
     deux fois sur la même grille se laisserait apprendre. */
  const ordres = new Set(
    Array.from({ length: 20 }, (_, i) => JSON.stringify(paveDeLEssai(reponses, 'melange', i + 1))),
  );
  verifier('vingt essais, vingt ordres distincts', ordres.size, 20);

  /* Le mélange seul, éprouvé sur une liste dont on connaît le contenu. */
  verifier('mélanger une liste d’un élément la rend telle quelle', melanger([42], 9), [42]);
  verifier('mélanger une liste vide la rend vide', melanger([], 9), []);
}

/* ══════════════════════════════════════════════════════════════════════════
   L3 — LES QUATRE MODULES
   ══════════════════════════════════════════════════════════════════════════ */

{
  console.log('\nL3 — L’INHIBITION SE RÉPOND, ET LES FAUSSES ALARMES SE COMPTENT');

  /*
     LES CINQ CAS, ET POURQUOI IL EN FAUT CINQ.

     La référence n'en mesure AUCUN : son champ est désactivé sur un essai
     d'inhibition, et les touches ne sont écoutées que sur ce champ. Personne ne
     peut donc signaler qu'il retient, et une fausse alarme ne peut pas exister
     non plus — le module ne mesure ni ce qu'il annonce, ni son contraire.

     On distingue ici `retenu` de `omis` parce que ne rien faire n'est pas
     retenir, et `rate` l'emporte sur `retenu` parce que qui a répondu n'a pas
     retenu, fût-ce en pressant le bouton ensuite.
  */
  verifier('signal + Retenir, sans réponse → retenu', jugerInhibition(true, true, false), 'retenu');
  verifier('signal + réponse → raté, même si Retenir a suivi', jugerInhibition(true, true, true), 'rate');
  verifier('signal + réponse seule → raté', jugerInhibition(true, false, true), 'rate');
  verifier('signal + rien → omis, et non retenu', jugerInhibition(true, false, false), 'omis');
  verifier('pas de signal + Retenir → FAUSSE ALARME', jugerInhibition(false, true, false), 'fausse-alarme');
  verifier('pas de signal + rien → sans objet', jugerInhibition(false, false, false), 'sans-objet');

  /* Les comptes, et leurs deux dénominateurs : les essais SIGNALÉS portent la
     retenue, les essais ORDINAIRES portent les fausses alarmes. Les mêler
     donnerait un taux de fausses alarmes dilué par des essais où elles étaient
     impossibles. */
  let c = comptesInhibitionNeufs();
  for (const v of ['retenu', 'rate', 'omis', 'fausse-alarme', 'sans-objet', 'sans-objet'] as const) {
    c = compterInhibition(c, v);
  }
  verifier('les essais signalés sont comptés à part', { signales: c.signales, ordinaires: c.ordinaires }, { signales: 3, ordinaires: 3 });
  verifier('et chaque verdict est compté une fois', { retenus: c.retenus, rates: c.rates, omis: c.omis, fa: c.faussesAlarmes }, { retenus: 1, rates: 1, omis: 1, fa: 1 });

  console.log('\nL3 — LA FLÈCHE COMPTE AVANT COMME APRÈS LE NOMBRE');

  /*
     LE DÉFAUT N° 2 DE LA RÉFÉRENCE, et la seule garde qui l'attrape.

     Sa validation automatique note l'essai dès que le nombre est complet : une
     flèche donnée APRÈS arrive sur un essai clos. Deux personnes font le même
     geste, l'une est notée juste et l'autre fausse, selon l'ordre.

     On joue donc les DEUX ORDRES et l'on exige le même état. Une version qui
     refuserait un sens déjà suivi d'un nombre rendrait ici deux états
     différents.
  */
  const exigences = { nombre: true, sens: true };
  const flechePuisNombre = [
    { quoi: 'sens', valeur: 'plus-grand' },
    { quoi: 'nombre', valeur: 7 },
  ] as const;
  const nombrePuisFleche = [
    { quoi: 'nombre', valeur: 7 },
    { quoi: 'sens', valeur: 'plus-grand' },
  ] as const;
  const jouer = (evts: readonly Evenement[]) => evts.reduce(accumuler, donneesNeuves());
  verifier(
    'les deux ordres donnent le MÊME état',
    jouer(flechePuisNombre),
    jouer(nombrePuisFleche),
  );
  verifier('et l’essai est complet dans les deux cas', [essaiComplet(exigences, jouer(flechePuisNombre)), essaiComplet(exigences, jouer(nombrePuisFleche))], [true, true]);
  verifier(
    'le nombre seul ne suffit pas quand un sens est demandé',
    essaiComplet(exigences, jouer([{ quoi: 'nombre', valeur: 7 }])),
    false,
  );
  verifier(
    'ni le sens seul',
    essaiComplet(exigences, jouer([{ quoi: 'sens', valeur: 'egal' }])),
    false,
  );
  /* Et sur un essai d'inhibition, le nombre n'est pas demandé : l'essai est
     complet sans lui, sans quoi retenir correctement bloquerait la séance. */
  verifier(
    'un essai d’inhibition est complet sans nombre',
    essaiComplet({ nombre: false, sens: false }, jouer([{ quoi: 'retenir' }])),
    true,
  );

  console.log('\nL3 — SDM NOMME LA SOMME À LAQUELLE IL COMPARE');

  /*
     LE DÉFAUT N° 3. La référence compare à la dernière somme JUSTE : sa
     variable n'est réécrite que dans la branche des essais réussis. Après un
     essai manqué, la comparaison porte donc sur une somme plus ancienne que la
     précédente, et rien à l'écran ne dit laquelle.

     Ici la référence est le résultat attendu de l'essai PRÉCÉDENT, réussi ou
     non — et c'est `poserEssai` qui l'avance, à chaque essai, précisément parce
     que `noter` ne court pas pour tous.

     La garde se joue donc sur une SÉANCE, avec un essai manqué au milieu : si
     la référence sautait les essais manqués, le sens attendu changerait.
  */
  verifier('sens d’un plus grand', sensEntre(9, 4), 'plus-grand');
  verifier('sens d’un plus petit', sensEntre(4, 9), 'plus-petit');
  verifier('sens d’un égal', sensEntre(7, 7), 'egal');
  verifier('pas de référence → pas de sens, et non « égal »', sensAttendu(5, null), null);

  /*
     ET LA GARDE QUI ATTRAPE VRAIMENT LE DÉFAUT : une SÉANCE, avec un essai
     manqué au milieu.

     Les trois lignes ci-dessus mesurent la comparaison, qui n'était pas en
     cause. Le défaut de la référence est AILLEURS : sa référence n'avance que
     sur les essais réussis. Pour le prendre, il faut donc jouer plusieurs
     essais, en manquer un, et regarder à quoi le suivant se compare.

     `poserEssai` avance `attenduPrecedent` à CHAQUE essai, sans consulter la
     notation — c'est la forme qui tient l'invariant, et c'est elle qu'on
     mesure ici.
  */
  const etatSdm = seanceNeuve({ ...reglagesParDefaut(), n: 1, nombreMin: 1, nombreMax: 9 });
  const hasardSdm = hasardFixe(7);
  const attendus: (number | null)[] = [];
  const references: (number | null)[] = [];
  for (let i = 0; i < 6; i += 1) {
    const essai = poserEssai(etatSdm, hasardSdm);
    attendus.push(essai.attendu);
    /*
       RELEVÉ APRÈS L'APPEL, et c'est l'essai qui m'a corrigé.

       Je l'avais d'abord relevé AVANT, et la garde a rougi d'un cran :
       `[null,null,12,15,15]` contre `[null,12,15,15,10]`. Le code avait raison.
       `poserEssai` avance la référence EN TÊTE de l'appel, depuis l'essai qui
       s'achève : après l'appel i, elle porte donc l'attendu de l'essai i−1,
       qui est exactement ce à quoi l'essai i doit se comparer. Avant l'appel,
       elle portait encore celui de i−2.
    */
    references.push(etatSdm.attenduPrecedent);
  }
  /* La référence de chaque essai est l'attendu du PRÉCÉDENT, et aucun essai
     n'est sauté. On ne note rien du tout : si la référence dépendait de la
     notation — le défaut de la référence —, elle resterait figée. */
  verifier(
    'la référence de SDM suit l’attendu précédent, essai par essai',
    references.slice(1),
    attendus.slice(0, -1),
  );
  verifier(
    'et elle avance même quand RIEN n’est noté',
    references.slice(1).some((r) => r !== null) && new Set(references.slice(1)).size > 1,
    true,
  );
  /* Le NOMBRE précédent est une autre chose que l'attendu précédent : NDM se
     compare à l'un, SDM à l'autre. Les confondre ferait un module qui vise
     juste seulement quand l'opération est l'identité. */
  verifier(
    'NDM et SDM n’ont pas la même référence',
    etatSdm.nombrePrecedent !== etatSdm.attenduPrecedent ||
      etatSdm.reglages.operation === 'somme',
    true,
  );

  console.log('\nL3 — LE CHARGEMENT NE PLANTE PAS QUAND LE CHANGEMENT DE RÈGLE EST ENREGISTRÉ');

  /*
     LE CINQUIÈME DÉFAUT DE LA RÉFÉRENCE, et il est d'une autre nature : ce
     n'est pas une règle fausse mais un CHARGEMENT qui lève. Chez elle, `synth`
     et `SHARE_KEYS` sont employés avant leur déclaration — zone morte d'un
     `const` —, et l'appel qui arrive pendant le chargement emporte la page.

     Ici le risque équivalent est qu'un réglage de module enregistré ne se
     relise pas : un sous-objet manquant, un champ d'un type inattendu. On joue
     donc le pire — un objet partiel, des types faux — et l'on exige que la
     lecture RENDE des réglages utilisables plutôt que de lever.
  */
  const copie = reglagesParDefaut();
  copie.changementDeRegleActif = true;
  copie.changementDeRegleBloc = 4;
  copie.operationsCommutees = { somme: true, difference: false, produit: true, quotient: false };
  const relus = JSON.parse(JSON.stringify(copie)) as Reglages;
  verifier(
    'un réglage de changement de règle survit à l’aller-retour',
    [relus.changementDeRegleActif, relus.changementDeRegleBloc, relus.operationsCommutees.produit],
    [true, 4, true],
  );
  /* Et une séance se monte dessus sans lever, en employant bien les opérations
     commutées : c'est le chemin qui emporte la page chez la référence. */
  let leve: string | null = null;
  let operationsVues: string[] = [];
  try {
    const etatCr = seanceNeuve(relus);
    const h = hasardFixe(3);
    for (let i = 0; i < 9; i += 1) operationsVues.push(poserEssai(etatCr, h).operation);
  } catch (e) {
    leve = String(e);
  }
  verifier('monter une séance avec le module ne lève pas', leve, null);
  verifier(
    'et elle alterne bien entre les opérations commutées',
    [...new Set(operationsVues)].sort(),
    ['produit', 'somme'],
  );
  /* La copie en profondeur tient aussi avec le sous-objet des modules : écrire
     dans la copie ne doit pas toucher les défauts. */
  const a = reglagesParDefaut();
  a.operationsCommutees.quotient = true;
  verifier('écrire dans une copie ne touche pas les défauts', DEFAUTS.operationsCommutees.quotient, false);

  console.log('\nL3 — LE DÉLAI DE GRÂCE : ZÉRO ÉTEINT, SINON DE 100 À 2 000');

  /*
     LA PLAGE N'EST PAS D'UN SEUL TENANT, et c'est pourquoi `valeurValide` ne
     suffit pas : elle borne sur un intervalle continu et ramènerait un zéro au
     minimum — donc RALLUMERAIT une aide qu'on vient d'éteindre, en silence.
  */
  verifier('zéro survit, et éteint l’aide', delaiDeGraceValide(0), 0);
  verifier('une valeur dans la plage est gardée', delaiDeGraceValide(300), 300);
  verifier('au-dessus du plafond, on redescend à 2 000', delaiDeGraceValide(5000), 2000);
  verifier('entre 1 et 99, on monte à 100 — « un peu » n’est pas « pas du tout »', delaiDeGraceValide(40), 100);
  verifier('un négatif éteint', delaiDeGraceValide(-10), 0);
  verifier('ce qui n’est pas un nombre retrouve le défaut', delaiDeGraceValide('300'), DEFAUTS.delaiDeGrace);
  verifier('et le défaut est dans la plage', DEFAUTS.delaiDeGrace === 0 || (DEFAUTS.delaiDeGrace >= 100 && DEFAUTS.delaiDeGrace <= 2000), true);

  console.log('\nL3 — LE CHANGEMENT DE RÈGLE ALTERNE PAR BLOCS');

  const deux = operationsCommutables({ somme: true, difference: true, produit: false, quotient: false });
  verifier('deux opérations commutées donnent deux règles', deux, ['somme', 'difference']);
  /* Une seule opération commutée n'est pas un changement : on rend une liste
     vide plutôt qu'une liste d'un, qui ferait un module allumé qui ne change
     jamais — annoncé par une couleur immobile, donc pire qu'éteint. */
  verifier(
    'une seule opération commutée ne fait pas un changement',
    operationsCommutables({ somme: true, difference: false, produit: false, quotient: false }),
    [],
  );
  verifier(
    'les cinq premiers rangs d’un bloc de 3 alternent par bloc',
    [1, 2, 3, 4, 5, 6, 7].map((r) => operationDuRang(r, deux, 3, 'produit')),
    ['somme', 'somme', 'somme', 'difference', 'difference', 'difference', 'somme'],
  );
  verifier(
    'sans commutables, l’opération des réglages est gardée',
    operationDuRang(4, [], 3, 'quotient'),
    'quotient',
  );
  verifier('le début de bloc est annoncé', [1, 2, 3, 4].map((r) => debutDeBloc(r, 3)), [true, false, false, true]);
}

console.log(
  echecs === 0
    ? '\n\x1b[32mLe moteur de PCCT tient ses gardes, modules compris.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
