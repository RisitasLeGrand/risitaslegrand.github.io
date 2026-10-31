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
import { noter, poserEssai, resumer, seanceNeuve } from '../src/features/pcct/moteur/seance';
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

console.log(
  echecs === 0
    ? '\n\x1b[32mLe moteur de PCCT tient ses onze gardes.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
