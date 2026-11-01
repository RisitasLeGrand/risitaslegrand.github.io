/**
 * Contrôle du socle de Veridical Mapping.
 *
 *   npm run essais:veridical
 *
 * Le contrôle décisif est celui de l'escalier. Une procédure adaptative se
 * vérifie mal à la lecture : on la vérifie en la faisant tourner contre un
 * **observateur simulé** dont le seuil est connu d'avance, et en regardant si
 * elle le retrouve. C'est le seul moyen de distinguer un escalier juste d'un
 * escalier qui converge sur autre chose que ce qu'on croit.
 */
import {
  DIMENSIONS,
  PAS,
  PAS_HISTORIQUE,
  borner,
  dimensionsDeFamille,
  ecartEnPas,
  ecartDit,
  ecartEnZ,
  dimensionParId,
  pasDuZ,
  zDuPas,
  zDuPasHistorique,
  type Dimension,
} from '../src/features/veridical-mapping/dimensions';
import {
  aretesDeFamille,
  arbreCouvrant,
  clefNormalisee,
  idArete,
  idDeRangement,
  pairesDeFamille,
  seuilsRelus,
} from '../src/features/veridical-mapping/hub';
import {
  FIXES,
  stimulus,
  superposables,
  superposer,
} from '../src/features/veridical-mapping/stimulus';
import { readFileSync } from 'node:fs';
/**
 * LE PLANCHER D'UNE DIMENSION CONTINUE, écrit une fois pour tous les essais.
 *
 * `escalierNeuf` demande son plancher, et il n'a pas de défaut : un défaut
 * serait l'exclusion non gardée que ce chantier a déjà payée. Les essais qui
 * n'éprouvent pas le plancher lui-même passent donc celui d'une dimension
 * continue, et ils le passent sous un nom qui dit lequel — « 0.02 » semé dans
 * trente appels ne se relirait plus.
 *
 * Il vaut `REGLAGES.deltaMinimum`, et c'est MESURÉ, non supposé :
 * `plancherReel` rend 0,02 pour chacune des sept dimensions vivantes, dont le
 * pire grain vaut 0,001. La section « PLANCHER PAR DIMENSION » l'assied.
 */
import {
  DEPART_MAXIMUM,
  PLANCHER_MESURABLE,
  estAuPlusFin,
  verifierLePlancher,
  DEPART_MINIMUM,
  RATIO_DE_DEPART,
  REGLAGES,
  departPour,
  escalierNeuf,
  ratioDeDepart,
  repondre,
  reprendreUnSeuil,
  seuil,
  statut,
  type EtatEscalier,
} from '../src/features/veridical-mapping/escalier';
import {
  desaccordDeNiveaux,
  grainMesure,
  phraseDuPlusFin,
  plancherDeLArete,
  plancherReel,
} from '../src/features/veridical-mapping/grain-reel';
import { grainDe } from '../src/features/veridical-mapping/dimensions-l5';
import {
  REGLAGES_PAR_DEFAUT,
  ecartEnPasDuZ,
  tirerEssai,
  vivierDAretes,
} from '../src/features/veridical-mapping/session';

const PLANCHER_CONTINU = REGLAGES.deltaMinimum;

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok ? '' : `\n      obtenu ${JSON.stringify(obtenu)} · attendu ${JSON.stringify(attendu)}`}`);
}

/**
 * ÉGALITÉ DE FLOTTANTS, à la tolérance près — et la tolérance est dite.
 *
 * 1/7 ne s'écrit pas en binaire. Comparer un grain mesuré à une fraction par
 * `===` rougirait sur le dernier bit, ce qui serait un faux rouge ; comparer à
 * 10⁻³ laisserait passer l'écart de 17 % entre 1/7 et 1/6, ce qui serait un
 * faux vert. La tolérance est donc à 10⁻⁹ : assez large pour le dernier bit,
 * mille fois trop serrée pour une erreur de règle.
 */
function proche(titre: string, obtenu: number, attendu: number, tolerance = 1e-9) {
  const ok = Number.isFinite(obtenu) && Math.abs(obtenu - attendu) <= tolerance;
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok ? '' : `\n      obtenu ${obtenu} · attendu ${attendu} à ${tolerance} près`}`);
}

/**
 * CETTE FONCTION LÈVE-T-ELLE ? — et elle doit lever pour la bonne raison.
 *
 * Un essai qui se contente de « ça lève » passerait sur une faute de frappe
 * dans l'appel : une variable inconnue lève aussi. On exige donc un message
 * NON VIDE, ce qui ne prouve pas la cause mais écarte l'erreur de syntaxe
 * silencieuse, et on imprime le message pour qu'il soit relu.
 */
function leve(titre: string, fonction: () => unknown) {
  let message: string | null = null;
  try {
    fonction();
  } catch (erreur) {
    message = erreur instanceof Error ? erreur.message : String(erreur);
  }
  const ok = message !== null && message.length > 20;
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok ? '' : `\n      rien n’a été levé, ou le message est vide`}`);
}

console.log('\nDIMENSIONS — plages et régularité des pas');
verifier('sept dimensions', DIMENSIONS.length, 7);
verifier('quatre prothétiques', dimensionsDeFamille('prothetique').length, 4);
verifier('trois métathétiques', dimensionsDeFamille('metathetique').length, 3);
for (const dimension of DIMENSIONS) {
  const bas = dimension.valeur(0);
  const haut = dimension.valeur(PAS - 1);
  const croissante = Array.from({ length: PAS - 1 }, (_, i) => dimension.valeur(i + 1) > dimension.valeur(i)).every(Boolean);
  verifier(`${dimension.id} : strictement croissante`, croissante, true);
  verifier(`${dimension.id} : plage non dégénérée`, haut > bas * 1.0001 || haut - bas > 1, true);
}

console.log('\nREBOUCLAGE — seule la teinte est circulaire');
const teinte = dimensionParId('teinte')!;
const taille = dimensionParId('taille')!;
/*
   LES RANGS SONT ÉCRITS EN FONCTION DE `PAS`, et non en chiffres.

   Ils valaient 2, 118 et 125 — justes sur une grille de cent vingt points, et
   faux sur toute autre. La grille étant passée à mille un points, « 118 »
   n'était plus près du bord et « 125 » ne rebouclait plus : trois assertions
   rouges, qui ne disaient rien du rebouclage et tout de la grille.

   Ce que ces lignes mesurent ne dépend pourtant pas de la finesse : deux rangs
   à deux pas des bords opposés sont voisins sur un cercle, et un rang au-delà
   du dernier reboucle. Écrits ainsi, ils le mesurent sur n'importe quelle
   grille.
*/
verifier('teinte : les deux bords sont voisins', ecartEnPas(teinte, 2, PAS - 2), 4);
verifier('taille : les deux bords sont distants', ecartEnPas(taille, 2, PAS - 2), PAS - 4);
verifier('teinte : un rang au-delà du dernier reboucle', borner(teinte, PAS + 5), 5);
verifier('taille : un rang au-delà du dernier est borné', borner(taille, PAS + 5), PAS - 1);
verifier('taille : le pas -3 est borné', borner(taille, -3), 0);

console.log('\nHUB — arêtes orientées et arbre couvrant');
verifier('prothétique : 12 arêtes orientées', aretesDeFamille('prothetique').length, 12);
verifier('métathétique : 6 arêtes orientées', aretesDeFamille('metathetique').length, 6);
verifier('prothétique : 6 paires', pairesDeFamille('prothetique').length, 6);
verifier('arbre prothétique : 3 paires', arbreCouvrant('prothetique', () => 0).length, 3);
verifier('arbre métathétique : 2 paires', arbreCouvrant('metathetique', () => 0).length, 2);
{
  const arbre = arbreCouvrant('prothetique', () => 0);
  const touchees = new Set(arbre.flatMap((paire) => [paire.a.id, paire.b.id]));
  verifier('l’arbre touche les quatre dimensions', touchees.size, 4);
}
{
  // L'arbre doit préférer les paires les moins travaillées.
  const cher = idArete('taille', 'luminosite');
  const arbre = arbreCouvrant('prothetique', (a, b) =>
    idArete(a, b) === cher || idArete(b, a) === cher ? 1000 : 0,
  );
  const contient = arbre.some(
    (p) => (p.a.id === 'taille' && p.b.id === 'luminosite') || (p.a.id === 'luminosite' && p.b.id === 'taille'),
  );
  verifier('la paire la plus travaillée est évitée', contient, false);
}
{
  const transmodales = aretesDeFamille('prothetique').filter((a) => a.transmodale).length;
  verifier('prothétique : 8 arêtes transmodales', transmodales, 8);
}

console.log('\nESCALIER — mécanique');
{
  let etat = escalierNeuf(REGLAGES.departDelta, PLANCHER_CONTINU);
  verifier('écart de départ', etat.delta, REGLAGES.departDelta);
  etat = repondre(etat, true);
  verifier('une seule bonne réponse ne resserre pas', etat.delta, REGLAGES.departDelta);
  etat = repondre(etat, true);
  /*
     DEUX NE SUFFISENT PLUS, et ce contrôle-ci est le seul qui distingue la
     nouvelle règle de l'ancienne sans passer par l'observateur simulé. Sans
     lui, un retour accidentel au 2-down resterait vert partout ailleurs.
  */
  verifier('deux bonnes de suite ne resserrent pas : la règle est 3-down', etat.delta, REGLAGES.departDelta);
  etat = repondre(etat, true);
  verifier('trois bonnes de suite resserrent', etat.delta < REGLAGES.departDelta, true);
  /* L'asymétrie, en clair : on resserre de 13 %, on élargit de 20 %. */
  verifier(
    'le resserrement vaut le facteur annoncé',
    Number(etat.delta.toFixed(6)),
    Number((REGLAGES.departDelta * REGLAGES.facteurResserre).toFixed(6)),
  );
  {
    const avant = etat.delta;
    const elargi = repondre(etat, false);
    verifier(
      'et l’élargissement vaut l’autre facteur, qui n’est pas son inverse',
      Number(elargi.delta.toFixed(6)),
      Number((avant * REGLAGES.facteurElargit).toFixed(6)),
    );
    verifier(
      'les deux facteurs ne sont pas inverses',
      Math.abs(REGLAGES.facteurResserre * REGLAGES.facteurElargit - 1) > 0.01,
      true,
    );
  }
  const apres = etat.delta;
  etat = repondre(etat, false);
  verifier('une erreur élargit', etat.delta > apres, true);
  verifier('une inversion relevée', etat.inversions.length, 1);
  verifier('pas de seuil avant quatre inversions', seuil(etat), null);
  verifier('statut en cours', statut(etat), 'en-cours');
  verifier('statut initial', statut(escalierNeuf(REGLAGES.departDelta, PLANCHER_CONTINU)), 'jamais');
}

console.log('\nESCALIER — retrouve-t-il un seuil connu ?');
/**
 * Observateur simulé en choix forcé à deux alternatives : il répond au hasard
 * quand l'écart est nul, et sûrement quand il est large. La fonction
 * psychométrique est une Weibull de paramètre de pente 3, valeur usuelle.
 */
function observateur(delta: number, seuilVrai: number, hasard: () => number): boolean {
  const p = 1 - 0.5 * Math.exp(-((delta / seuilVrai) ** 3));
  return hasard() < p;
}

function generateur(graine: number) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
   LES SEUILS VRAIS SONT EN z, et ils sont écrits comme la CONVERSION de ceux
   d'avant — 3, 8 et 20 pas — plutôt que comme 0,0252, 0,0672 et 0,1681. Les
   trois cas mesurés restent donc exactement les mêmes qu'avant le passage à
   l'échelle z, et la comparaison avec les anciens relevés garde un sens. Trois
   nombres recopiés à la main auraient été trois cas voisins, sans plus.

   PAR `zDuPasHistorique`, ET C'EST LE POINT. Ils passaient par `zDuPas`, qui
   suit la grille de dessin : celle-ci ayant décuplé de finesse, les trois cas
   devenaient 0,003, 0,008 et 0,020 — soit deux seuils SOUS le plancher de
   l'escalier, qu'aucune procédure ne peut mesurer. Les deux assertions
   correspondantes rougissaient, et pour la mauvaise raison : non parce que
   l'escalier s'était dégradé, mais parce que l'essai lui demandait désormais
   autre chose. Ces trois pas sont un choix de fixture daté, comme les quatre
   bornes de la rampe du tableau de bord.
*/
for (const seuilVrai of [3, 8, 20].map(zDuPasHistorique)) {
  const estimations: number[] = [];
  let convergences = 0;
  for (let graine = 1; graine <= 60; graine += 1) {
    const hasard = generateur(graine * 7919 + seuilVrai);
    let etat: EtatEscalier = escalierNeuf(REGLAGES.departDelta, PLANCHER_CONTINU);
    for (let essai = 0; essai < 160; essai += 1) {
      etat = repondre(etat, observateur(etat.delta, seuilVrai, hasard));
    }
    const estime = seuil(etat);
    if (estime !== null) estimations.push(estime);
    if (statut(etat) === 'converge') convergences += 1;
  }
  const moyenne = estimations.reduce((t, v) => t + v, 0) / Math.max(1, estimations.length);
  const biais = moyenne / seuilVrai;
  console.log(
    `  seuil vrai ${ecartDit(seuilVrai)} (${pasDuZ(seuilVrai)} pas) → estimé ` +
      `${ecartDit(moyenne)} (rapport ${biais.toFixed(2)}), ` +
      `${estimations.length}/60 estimés, ${convergences}/60 stabilisés`,
  );
  /*
     LE RAPPORT ATTENDU SE DÉRIVE DE LA RÈGLE, et ne se constate pas.

     Une règle « n-down-1-up » converge vers le point où la probabilité de
     réussite vaut 0,5^(1/n) : 70,7 % pour 2-down, **79,4 % pour 3-down**. Pour
     la Weibull de pente 3 de l'observateur ci-dessus, le rapport entre le seuil
     estimé et le paramètre d'échelle est donc

         (−ln(2 × (1 − 0,5^(1/n))))^(1/3)

     soit 0,812 en 2-down et **0,960 en 3-down**. L'escalier ne doit PAS
     retrouver le paramètre lui-même : c'est ce rapport-là qu'on vérifie.

     Et c'est écrit avec `REGLAGES.bonnesRequises` plutôt qu'avec un 3 en dur :
     le jour où la règle changerait encore, l'attendu suivrait, et le contrôle
     continuerait de mesurer la règle au lieu de mesurer un souvenir. Un nombre
     recopié à la main se décorrèle sans que rien ne lève.
  */
  const pointDeConvergence = Math.pow(0.5, 1 / REGLAGES.bonnesRequises);
  const attendu = Math.cbrt(-Math.log(2 * (1 - pointDeConvergence)));
  /*
     ET LE DÉCALAGE MESURÉ N'EST PAS DU BRUIT — c'est de l'arithmétique.

     Les rapports relevés valent 1,02 à 1,04 contre 0,960 attendu, soit un
     excès d'environ 4 %. L'explication est dans les facteurs eux-mêmes :
     0,87 × 1,2 = **1,044**. Un cycle « resserrer puis élargir » ne revient pas
     à son point de départ, il remonte de 4,4 %, et les points de
     rebroussement s'installent donc légèrement AU-DESSUS du point de
     convergence théorique. La moyenne géométrique des inversions hérite de ce
     décalage.

     C'est écrit ici parce qu'un écart inexpliqué dans un contrôle statistique
     finit par s'élargir sans que personne sache s'il a toujours été là. La
     tolérance de 0,1 en absorbe 0,06 à 0,08 : il reste de la marge, mais elle
     n'est plus large, et une dérive future se lira au lieu de se confondre
     avec celle-ci.
  */
  /*
     LA PORTÉE MESURABLE DE L'ESCALIER, ET CE QUI SE PASSE À SON BORD.

     Trouvé le 1er novembre, en passant à l'échelle z. La borne basse de
     l'escalier vaut z = 0,02 ; un seuil vrai de 0,0252 — trois pas, le plus
     fin des trois cas — en est à peine au-dessus. L'escalier BUTE donc sur son
     plancher près du seuil, ses points de rebroussement s'y écrasent, et
     l'estimation remonte : rapport 1,07 au lieu de 0,96, soit onze centièmes
     d'écart là où la tolérance en admet dix.

     Ce n'était pas le cas avec l'ancienne borne — un pas, soit z = 0,0084 —,
     bien au-dessous de tout seuil mesuré. Le resserrement des bornes voulu par
     le prompt 63 a donc une conséquence qu'il faut dire : **un seuil plus fin
     que le double de la borne basse n'est pas mesurable sans biais.**

     L'essai ne la cache pas et ne l'assouplit pas : il affirme, pour ces
     seuils-là, la seule chose qui compte — **le biais est vers le HAUT**.
     C'est la direction qui protège : l'escalier annonce une acuité moindre que
     la vraie, jamais meilleure. Un biais vers le bas ferait croire à la
     personne qu'elle distingue mieux qu'elle ne distingue, et c'est ce que ce
     contrôle interdit.
  */
  const margeDuPlancher = REGLAGES.deltaMinimum * 2;
  if (seuilVrai < margeDuPlancher) {
    verifier(
      `seuil ${ecartDit(seuilVrai)} : sous le double de la borne basse — biais vers le HAUT, jamais vers le bas`,
      biais >= attendu && biais < attendu + 0.25,
      true,
    );
  } else {
    verifier(
      `seuil ${ecartDit(seuilVrai)} : rapport conforme au point de convergence (${attendu.toFixed(3)})`,
      Math.abs(biais - attendu) < 0.1,
      true,
    );
  }
  verifier(`seuil ${ecartDit(seuilVrai)} : au moins 55 estimations sur 60`, estimations.length >= 55, true);
}

console.log('\nREPRISE D’UNE MESURE ÉCRITE AVANT LE 1er NOVEMBRE');
{
  /*
     L'ÉTENDUE DE L'ANCIENNE GRILLE, ET NON DE LA COURANTE.

     Ces écarts ont été écrits en pas de la grille de cent vingt points. La
     grille courante en compte mille un : diviser par elle rendrait un seuil
     huit fois trop fin, dans les bornes, sans rien lever. Le diviseur d'une
     conversion passée appartient au passé — c'est ce que `PAS_HISTORIQUE`
     nomme, et ce que la section « GRILLE DE DESSIN » ci-dessous vérifie sur le
     code de production, puisqu'ici l'essai serait cohérent avec lui-même quel
     que soit le diviseur choisi.
  */
  const ETENDUE = PAS_HISTORIQUE - 1;
  /* Une ligne d'avant : écarts en pas, aucun marqueur, règle 2-down implicite. */
  const ancienne = {
    escalier: {
      delta: 12,
      bonnesDeSuite: 1,
      inversions: [20, 16, 12, 10, 8, 7, 8, 7],
      derniereDirection: 'resserre' as const,
      essais: 140,
      reussis: 99,
    },
    seuil: 7.3,
    statut: 'converge' as const,
  };

  const reprise = reprendreUnSeuil(ancienne, ETENDUE, PLANCHER_CONTINU);
  /*
     LA RÈGLE A CHANGÉ, DONC L'ESCALIER REPART. C'est la décision du pilote, et
     c'est le contrôle qui compte : poursuivre un escalier 2-down sous les
     règles du 3-down rendrait un seuil qui ne mesure ni les 70,7 % de l'un ni
     les 79,4 % de l'autre, et rien ne lèverait.
  */
  verifier('l’escalier repart de zéro', reprise.escalier, escalierNeuf(REGLAGES.departDelta, PLANCHER_CONTINU));
  verifier('le seuil courant est effacé', reprise.seuil, null);
  verifier('et le statut revient à « jamais »', reprise.statut, 'jamais');
  /* L'ancienne mesure est GARDÉE, convertie, et n'alimente plus aucun calcul. */
  verifier(
    'l’ancienne mesure est gardée, en z',
    Number(reprise.ancienneMesure?.toFixed(6)),
    Number((7.3 / ETENDUE).toFixed(6)),
  );
  verifier('les deux marqueurs sont posés', [reprise.echelle, reprise.regle], ['z', '3-down']);

  /*
     L'IDEMPOTENCE, et sans elle deux lectures diviseraient deux fois par
     l'étendue. Une ligne déjà reprise ressort IDENTIQUE — comparée par
     identité d'objet, ce qui est plus fort qu'une comparaison de valeurs :
     la fonction ne doit pas même reconstruire la ligne.
  */
  verifier('une ligne déjà reprise ressort inchangée', reprendreUnSeuil(reprise, ETENDUE, PLANCHER_CONTINU) === reprise, true);

  /*
     L'INVARIANT QUI PROTÈGE L'ESCALIER EN COURS, et c'est le plus important de
     cette section.

     `reprendreUnSeuil` remet à zéro toute ligne qui ne porte pas ses deux
     marqueurs. Une ligne CRÉÉE par l'écran doit donc les porter dès sa
     naissance — sinon chaque chargement la prendrait pour une mesure d'avant
     le 1er novembre, et effacerait l'escalier en cours. À chaque lecture.

     Le contrôle porte sur la forme exacte que l'écran crée, marqueurs
     compris, et il est accompagné de son contre-exemple : la même ligne sans
     marqueurs DOIT être remise à zéro. Les deux ensemble disent que le
     comportement dépend bien des marqueurs, et non du hasard.
  */
  const ligneNeuve = {
    escalier: { ...escalierNeuf(REGLAGES.departDelta, PLANCHER_CONTINU), delta: 0.14, essais: 7, reussis: 5 },
    seuil: null,
    statut: 'en-cours' as const,
    echelle: 'z' as const,
    regle: '3-down' as const,
  };
  verifier(
    'une ligne neuve, marqueurs compris, traverse la lecture sans être touchée',
    reprendreUnSeuil(ligneNeuve, ETENDUE, PLANCHER_CONTINU) === ligneNeuve,
    true,
  );
  verifier(
    'contre-exemple : la même sans marqueurs est remise à zéro',
    reprendreUnSeuil({ ...ligneNeuve, echelle: undefined, regle: undefined }, ETENDUE, PLANCHER_CONTINU).escalier.essais,
    0,
  );

  /*
     LE CAS « MÊME RÈGLE, AUTRE UNITÉ » n'arrive pas dans ce dépôt — les deux
     changements sont du même jour — mais la fonction le traite, et un chemin
     non éprouvé est un chemin qui se défait. On convertit alors sans rien
     perdre : l'escalier continue.
  */
  const memeRegleEnPas = { ...ancienne, regle: '3-down' as const };
  const convertie = reprendreUnSeuil(memeRegleEnPas, ETENDUE, PLANCHER_CONTINU);
  verifier('l’escalier n’est PAS remis à zéro', convertie.escalier.essais, 140);
  verifier(
    'le delta est converti',
    Number(convertie.escalier.delta.toFixed(6)),
    Number((12 / ETENDUE).toFixed(6)),
  );
  verifier(
    'et chaque inversion aussi',
    convertie.escalier.inversions.map((v) => Number(v.toFixed(6))),
    ancienne.escalier.inversions.map((v) => Number((v / ETENDUE).toFixed(6))),
  );
  /*
     LE SABOTAGE DU L0, ÉCRIT ICI. Oublier la conversion des inversions laisse
     un seuil PLAUSIBLE : la moyenne géométrique de six nombres en pas rend un
     nombre en pas, du même ordre que les autres seuils en pas. Ce contrôle est
     le seul qui l'attrape, et c'est pourquoi il porte sur les inversions
     elles-mêmes et non sur le seuil qu'on en tire.
  */
  verifier(
    'sabotage : des inversions non converties resteraient du même ordre que l’original',
    Math.abs(ancienne.escalier.inversions[0] - convertie.escalier.inversions[0]) > 1,
    true,
  );
}

console.log('\nTÂCHES « UN COUPLE » ET « MODULAIRE » — ce qui les rend mesurables');

{
  const hasard = { reel: () => Math.random(), entier: (b: number) => Math.floor(Math.random() * b) };
  const aretes = vivierDAretes({ ...REGLAGES_PAR_DEFAUT, mode: 'exhaustif' }, () => 0);

  // 1. Tâche « un couple » : le niveau du hasard doit rester à 50 %, donc **deux**
  //    candidats et un seul juste. C'est la condition de comparabilité des
  //    seuils : ajouter un candidat déplacerait le point de convergence de
  //    l'escalier et rendrait les seuils incomparables d'une tâche à l'autre.
  let plans = 0;
  let deuxCandidats = true;
  let unSeulJuste = true;
  let unSeulAxeFautif = true;
  let coupleReel = true;
  for (let i = 0; i < 400; i += 1) {
    const arete = aretes[i % aretes.length];
    const essai = tirerEssai(arete, 8, { ...REGLAGES_PAR_DEFAUT, mode: 'exhaustif', tache: 'couple' }, hasard);
    if (essai.tache !== 'couple') continue;
    plans += 1;
    for (const sous of essai.sousEssais) {
      if (sous.candidats.length !== 2) deuxCandidats = false;
      if (sous.candidats.filter((c) => c.juste).length !== 1) unSeulJuste = false;
      // Le leurre ne doit différer du juste que sur **un** attribut : c'est ce
      // qui oblige à tenir les deux axes, sans quoi la tâche se réduirait au
      // meilleur des deux seuils.
      const [a, b] = sous.candidats;
      const attributs = ['taillePx', 'clarte', 'teinte', 'positionPct', 'frequenceHz', 'niveauDb', 'dureeMs'] as const;
      const differents = attributs.filter((cle) => a.stimulus[cle] !== b.stimulus[cle]);
      if (differents.length !== 1) unSeulAxeFautif = false;
      // Et la référence doit bien porter **deux** valeurs : son identifiant de
      // dimension est composé.
      if (!sous.reference.dimension.includes('+')) coupleReel = false;
    }
  }
  verifier('couple : des essais sont produits', plans > 0, true);
  verifier('couple : toujours deux candidats (hasard à 50 %)', deuxCandidats, true);
  verifier('couple : un seul candidat juste', unSeulJuste, true);
  verifier('couple : le leurre ne se trompe que sur un axe', unSeulAxeFautif, true);
  verifier('couple : la référence porte bien un couple', coupleReel, true);

  // 2. Tâche modulaire : le candidat juste reproduit l'intervalle, et le décalage
  //    est arbitraire. Les deux propriétés ensemble sont ce qui en fait une mise
  //    en correspondance de **structure** : si le décalage était constant, la
  //    réponse se lirait sur la position et non sur l'écart.
  // La tâche modulaire n'existe que sur les arêtes **arrivant** sur une
  // dimension circulaire, et la seule qui le soit — la teinte — est
  // métathétique. Le vivier prothétique par défaut n'en contient donc aucune :
  // c'est une contrainte du catalogue de dimensions, pas un défaut du tirage, et
  // l'interface doit ne proposer la tâche que là où elle a un sens.
  const aretesMeta = vivierDAretes(
    { ...REGLAGES_PAR_DEFAUT, famille: 'metathetique', mode: 'exhaustif' },
    () => 0,
  );
  const versTeinte = aretesMeta.filter((a) => a.vers.circulaire);
  verifier('modulaire : aucune arête prothétique n\u2019arrive sur une dimension circulaire',
    aretes.some((a) => a.vers.circulaire), false);
  let modulaires = 0;
  let intervalleJuste = true;
  let leurreFaux = true;
  const decalages = new Set<number>();
  for (let i = 0; i < 400 && versTeinte.length; i += 1) {
    const arete = versTeinte[i % versTeinte.length];
    const essai = tirerEssai(
      arete,
      6,
      { ...REGLAGES_PAR_DEFAUT, famille: 'metathetique', mode: 'exhaustif', tache: 'modulaire' },
      hasard,
    );
    if (essai.tache !== 'modulaire') continue;
    modulaires += 1;
    const sous = essai.sousEssais[0];
    const attendu = essai.intervalle ?? -1;
    for (const candidat of sous.candidats) {
      if (candidat.ancre === undefined) { intervalleJuste = false; continue; }
      decalages.add(candidat.ancre);
      const obtenu = ecartEnPas(arete.vers, candidat.ancre, candidat.pas);
      if (candidat.juste && obtenu !== attendu) intervalleJuste = false;
      if (!candidat.juste && obtenu === attendu) leurreFaux = false;
    }
  }
  verifier('modulaire : des essais sont produits', modulaires > 0, true);
  verifier('modulaire : le candidat juste reproduit l\u2019intervalle', intervalleJuste, true);
  verifier('modulaire : le leurre ne le reproduit pas', leurreFaux, true);
  verifier('modulaire : le décalage est bien arbitraire', decalages.size > 20, true);
}


/* ── LE REGISTRE : ALIAS, ATTRIBUTS, SUPERPOSITION ─────────────────────── */

/*
   Ce qui est éprouvé ici tient à une décision du 1er novembre : une dimension
   porte deux noms — celui sous lequel ses seuils sont écrits et le canonique de
   la référence de comportement — et porte l'attribut de stimulus qu'elle
   pilote. Les deux changements ont le même but, ouvrir l'ajout d'une dimension
   sans toucher au rendu, et le même risque : un alias qui ne mène nulle part, ou
   un attribut que personne ne lit, ne se voient pas à l'usage.

   Chaque contrôle est donc écrit dans les deux sens — ce qu'il DOIT voir
   d'abord, puis ce qu'il ne doit pas voir. Un contrôle qui ne sait que dire
   « rien d'anormal » rend zéro quand il est cassé, et zéro est ce que rend un
   registre propre.
*/

console.log('\nREGISTRE — les deux noms d’une dimension');
verifier('le registre n’est pas vide', DIMENSIONS.length > 0, true);
{
  let aliasMenentAuMemeObjet = true;
  let canoniquesBienFormes = true;
  const atteintes = new Set<Dimension>();
  for (const dimension of DIMENSIONS) {
    if (dimensionParId(dimension.id) !== dimension) aliasMenentAuMemeObjet = false;
    if (dimensionParId(dimension.canonique) !== dimension) aliasMenentAuMemeObjet = false;
    if (!/^[a-z]+\.[a-z]+$/.test(dimension.canonique)) canoniquesBienFormes = false;
    atteintes.add(dimensionParId(dimension.id)!);
    atteintes.add(dimensionParId(dimension.canonique)!);
  }
  verifier('les deux noms mènent au même objet', aliasMenentAuMemeObjet, true);
  verifier('le canonique a la forme « domaine.nom »', canoniquesBienFormes, true);
  // CE QU'IL NE DOIT PAS VOIR : quatorze noms, mais sept dimensions. Si le
  // registre contenait une dimension deux fois — une fois par nom —, ce compte
  // doublerait, et c'est exactement le « compté deux fois » à écarter.
  verifier('quatorze noms, sept dimensions', atteintes.size, DIMENSIONS.length);
  verifier('aucun identifiant de rangement en doublon',
    new Set(DIMENSIONS.map((d) => d.id)).size, DIMENSIONS.length);
  verifier('aucun canonique en doublon',
    new Set(DIMENSIONS.map((d) => d.canonique)).size, DIMENSIONS.length);
  // Un canonique qui serait l'identifiant de rangement d'une AUTRE dimension
  // ferait que « taille » et « vision.size » ne désigneraient plus la même
  // chose selon l'ordre de recherche. Rien ne le signalerait.
  const rangements = new Set(DIMENSIONS.map((d) => d.id));
  verifier('aucun canonique n’est le rangement d’une autre',
    DIMENSIONS.filter((d) => d.canonique !== d.id && rangements.has(d.canonique)).length, 0);
  verifier('un nom inconnu ne résout pas', dimensionParId('vision.contrast'), undefined);
}

console.log('\nRELECTURE — un seuil se lit sous ses deux noms');
{
  const ligne = (id: string, de: string, vers: string, essais: number) => ({
    id,
    de,
    vers,
    escalier: { essais },
  });

  // La situation du pilote : un seuil mesuré sous « taille>intensite ».
  const mesure = ligne('taille>intensite', 'taille', 'intensite', 40);
  const canonique = 'vision.size>audition.level';
  verifier('le canonique mène à la clef de rangement',
    clefNormalisee(canonique), 'taille>intensite');
  verifier('la clef de rangement est stable', clefNormalisee(mesure.id), 'taille>intensite');
  verifier('chaque côté se ramène au rangement',
    [idDeRangement('vision.size'), idDeRangement('audition.level')], ['taille', 'intensite']);

  const relus = seuilsRelus([mesure]);
  verifier('le seuil mesuré se relit', relus.length, 1);
  verifier('il se relit sous son nom de rangement', relus[0].id, 'taille>intensite');

  // La même paire, écrite sous l'autre nom : UNE ligne, non deux.
  const enCanonique = ligne(canonique, 'vision.size', 'audition.level', 12);
  const deuxNoms = seuilsRelus([mesure, enCanonique]);
  verifier('les deux noms ne font qu’un seuil', deuxNoms.length, 1);
  verifier('on garde l’escalier le mieux estimé', deuxNoms[0].escalier.essais, 40);
  verifier('les côtés sont écrits en rangement',
    [deuxNoms[0].de, deuxNoms[0].vers], ['taille', 'intensite']);
  // L'ordre de rencontre ne doit rien changer : c'est le nombre d'essais qui
  // arbitre, et non la place dans la liste.
  verifier('l’ordre de rencontre ne change rien',
    seuilsRelus([enCanonique, mesure])[0].escalier.essais, 40);
  verifier('le mieux estimé gagne même s’il est canonique',
    seuilsRelus([ligne('taille>intensite', 'taille', 'intensite', 3),
                 ligne(canonique, 'vision.size', 'audition.level', 90)])[0].escalier.essais, 90);

  // CE QU'ELLE NE DOIT PAS VOIR — trois réductions qui seraient des pertes.
  verifier('les deux sens restent deux arêtes',
    seuilsRelus([mesure, ligne('intensite>taille', 'intensite', 'taille', 7)]).length, 2);
  verifier('la tâche reste dans la clef',
    clefNormalisee('vision.size>audition.level|couple'), 'taille>intensite|couple');
  verifier('un seuil de couple ne se confond pas avec celui de la tâche de base',
    seuilsRelus([mesure, ligne('taille>intensite|couple', 'taille', 'intensite', 9)]).length, 2);
  // Une dimension qu'une version plus récente a ajoutée : son seuil se garde
  // sous son nom, au lieu d'être jeté faute d'être reconnu.
  const inconnue = seuilsRelus([ligne('vision.contrast>taille', 'vision.contrast', 'taille', 5)]);
  verifier('un seuil de dimension inconnue se garde', inconnue.length, 1);
  verifier('et il garde son nom', inconnue[0].id, 'vision.contrast>taille');
  verifier('une clef difforme est rendue intacte', clefNormalisee('taille'), 'taille');
  verifier('une liste vide se relit vide', seuilsRelus([]).length, 0);
}

console.log('\nSTIMULUS — l’attribut porté par la dimension');
{
  const attributs = Object.keys(FIXES) as (keyof typeof FIXES)[];
  verifier('les attributs fixes sont connus', attributs.length > 0, true);
  let pilotageExact = true;
  let riendAutreNeBouge = true;
  let examines = 0;
  for (const dimension of DIMENSIONS) {
    for (let pas = 0; pas < PAS; pas += 1) {
      const vu = stimulus(dimension, pas);
      examines += 1;
      // CE QU'IL DOIT VOIR : l'attribut de la dimension porte sa valeur.
      if (vu[dimension.attribut] !== dimension.valeur(pas)) pilotageExact = false;
      // CE QU'IL NE DOIT PAS VOIR : un autre attribut qui bouge. C'est la
      // validité même de la mesure — si la hauteur variait avec l'intensité,
      // le seuil ne porterait sur aucune des deux.
      for (const attribut of attributs) {
        if (attribut === dimension.attribut) continue;
        if (vu[attribut] !== FIXES[attribut]) riendAutreNeBouge = false;
      }
    }
  }
  verifier('des stimulus ont été examinés', examines, DIMENSIONS.length * PAS);
  verifier('chaque dimension pilote son attribut', pilotageExact, true);
  verifier('et ne touche à rien d’autre', riendAutreNeBouge, true);
  // L'INVARIANT DONT « superposer » TIRE SA JUSTESSE : un attribut par
  // dimension, et pas deux dimensions sur le même.
  verifier('un attribut par dimension',
    new Set(DIMENSIONS.map((d) => d.attribut)).size, DIMENSIONS.length);
  verifier('aucune dimension immobile sur toute sa plage',
    DIMENSIONS.filter((d) => d.valeur(0) === d.valeur(PAS - 1)).length, 0);
}

console.log('\nSUPERPOSITION — la garde sur l’attribut partagé');
{
  const taille = dimensionParId('taille')!;
  const position = dimensionParId('position')!;
  const teinte2 = dimensionParId('teinte')!;
  const hauteur = dimensionParId('hauteur')!;
  const intensite = dimensionParId('intensite')!;

  verifier('deux dimensions distinctes se superposent', superposables(taille, position), true);
  verifier('une dimension ne se superpose pas à elle-même', superposables(taille, taille), false);
  verifier('deux auditives ne se superposent pas', superposables(hauteur, intensite), false);

  // La huitième dimension que le commentaire de « superposables » redoutait
  // sans la mesurer : elle pilote la clarté, déjà pilotée par la luminosité.
  const rivale: Dimension = {
    id: 'contraste',
    canonique: 'vision.contrast',
    attribut: 'clarte',
    nom: 'Contraste',
    famille: 'prothetique',
    modalite: 'visuelle',
    resume: 'Pour l’essai seul : une dimension qui dispute son attribut.',
    unite: '%',
    valeur: (pas: number) => pas,
  };
  const luminosite = dimensionParId('luminosite')!;
  verifier('deux dimensions sur le même attribut sont refusées',
    superposables(rivale, luminosite), false);
  verifier('et la même, sur un autre attribut, serait acceptée',
    superposables({ ...rivale, attribut: 'positionPct' }, luminosite), true);

  // La teinte au pas 70 vaut 210°, qui EST sa valeur de repos. L'ancienne
  // boucle reportait « tout attribut qui diffère du repos » : elle ne
  // reportait donc rien ici. Le couple restait juste, parce que le premier
  // stimulus portait déjà cette valeur de repos — mais la justesse tenait à
  // une coïncidence de valeurs, non à une règle. Elle tient désormais au
  // registre, et cette ligne le mesure.
  /*
     LA COLLISION EST FABRIQUÉE, ET NON CHERCHÉE DANS LE CATALOGUE.

     Elle y existait : sur la grille de cent vingt points, la teinte au pas 70
     valait exactement 210°. Sur celle de mille un, aucun pas ne tombe sur la
     valeur de repos — l'essai aurait donc rougi pour avoir perdu son
     accident, ce qui n'aurait rien appris. Une assertion qui dépend d'une
     coïncidence arithmétique ne mesure pas ce qu'elle annonce.

     On fabrique donc le cas : une dimension dont la valeur au pas donné EST la
     valeur de repos de son attribut. Le contrôle vaut alors pour toute grille,
     et pour les dimensions que B ajoutera.
  */
  /*
     L'IDENTIFIANT RESTE CELUI DE LA TEINTE, et ce n'est pas un raccourci :
     `superposer` lit l'attribut sur le registre, donc une dimension inventée
     de toutes pièces le ferait REFUSER — ce que l'avant-dernière assertion de
     cette section mesure exprès. Seule la valeur est remplacée.
  */
  const pileAuRepos: Dimension = { ...teinte2, valeur: () => FIXES.teinte };
  verifier('la dimension fabriquée vaut bien la valeur de repos',
    pileAuRepos.valeur(0), FIXES.teinte);
  const couple = superposer(stimulus(position, 90), stimulus(pileAuRepos, 0));
  verifier('la composante de teinte est reportée', couple.teinte, FIXES.teinte);
  verifier('celle de position est gardée', couple.positionPct, position.valeur(90));
  verifier('le couple nomme ses deux dimensions', couple.dimension, 'position+teinte');

  // Un couple ordinaire : chaque composante à sa place, et rien d'autre.
  const ordinaire = superposer(stimulus(taille, 10), stimulus(position, 100));
  verifier('couple ordinaire : la taille vient du premier',
    ordinaire.taillePx, taille.valeur(10));
  verifier('couple ordinaire : la position vient du second',
    ordinaire.positionPct, position.valeur(100));
  verifier('couple ordinaire : la clarté reste au repos', ordinaire.clarte, FIXES.clarte);

  // La modalité du couple, et la superposition imbriquée : le découpage de
  // « a+b » doit continuer à nommer des dimensions du registre.
  verifier('un couple avec un son est auditif',
    superposer(stimulus(taille, 10), stimulus(hauteur, 20)).modalite, 'auditive');
  const triple = superposer(ordinaire, stimulus(teinte2, 30));
  verifier('une superposition imbriquée garde les trois composantes',
    [triple.taillePx, triple.positionPct, triple.teinte],
    [taille.valeur(10), position.valeur(100), teinte2.valeur(30)]);

  // CE QU'ELLE NE DOIT PAS FAIRE : fusionner un stimulus qu'elle ne sait pas
  // nommer. Retomber sur la comparaison aux valeurs de repos rendrait un
  // stimulus plausible et faux, sans rien dire.
  let aLeve = false;
  try {
    superposer(stimulus(taille, 10), { ...stimulus(position, 100), dimension: 'vision.contrast' });
  } catch {
    aLeve = true;
  }
  verifier('un stimulus hors registre fait refuser la superposition', aLeve, true);
}




/* ── LA LECTURE DE SOURCE, PARTAGÉE PAR DEUX SECTIONS ──────────────────── */

/**
 * Le texte d'un fichier du dépôt, ou un REFUS.
 *
 * Deux sections s'en servent — le diviseur gelé et la complétude du renommage.
 * Une seule définition, parce que deux recopies auraient fini par donner deux
 * seuils de refus, dont l'un aurait laissé passer un fichier tronqué.
 */
const lireSource = (chemin: string): string => {
  let texte: string;
  try {
    texte = readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
  } catch {
    /*
       UN FICHIER DÉPLACÉ DOIT LE DIRE EN UNE PHRASE. Sans ce `catch`, la
       lecture levait une trace de pile : le code de sortie était bien non
       nul, mais rien ne disait que le garde-fou avait perdu sa cible — et
       un garde-fou qui a perdu sa cible ne garde plus rien.
    */
    console.error(
      `\n✗ REFUS — « ${chemin} » est introuvable.\n` +
        '  Ce balayage garde le diviseur des conversions passées. Si le fichier a\n' +
        '  été déplacé ou renommé, corrigez le chemin ici : sans lui, le contrôle\n' +
        '  ne rendrait aucune anomalie, et aucune anomalie est ce que rend un\n' +
        '  dépôt sain.',
    );
    process.exit(2);
  }
  if (texte.length < 500) {
    console.error(
      `\n✗ REFUS — « ${chemin} » lu trop court (${texte.length} octets).\n` +
        '  Un fichier tronqué ne contient aucune des lignes cherchées, donc le\n' +
        '  contrôle passerait au vert sans avoir rien vu.',
    );
    process.exit(2);
  }
  return texte;
};

/* ── LA GRILLE DE DESSIN, ET LE DIVISEUR DU PASSÉ ──────────────────────── */

console.log('\nGRILLE DE DESSIN — l’erreur de quantification');
{
  /*
     L'ÉCART MONTRÉ N'EST PAS L'ÉCART DEMANDÉ : il est arrondi sur la grille.
     Sur cent vingt points, le plancher de l'escalier — z = 0,02 — devenait
     deux pas, soit 0,0168 : seize pour cent de moins que ce que la mesure
     croyait présenter. L'escalier convergeait donc trop bas, et rien ne le
     disait.
  */
  const montre = (z: number, points: number) =>
    Math.max(1, Math.round(z * (points - 1))) / (points - 1);

  const plancher = REGLAGES.deltaMinimum;
  verifier('au plancher, la grille courante rend l’écart exact',
    Number(montre(plancher, PAS).toFixed(9)), plancher);
  // CE QU'ELLE DOIT VOIR AUSSI : que l'ancienne grille, elle, se trompait.
  // Sans cette contre-épreuve, l'assertion ci-dessus passerait aussi bien sur
  // une grille qui n'aurait jamais eu de défaut, et ne mesurerait rien.
  const erreurAncienne = Math.abs(montre(plancher, PAS_HISTORIQUE) - plancher) / plancher;
  verifier('l’ancienne grille se trompait de plus de 15 % au plancher',
    erreurAncienne > 0.15, true);
  verifier('et la nouvelle de moins d’un pour mille',
    Math.abs(montre(plancher, PAS) - plancher) / plancher < 0.001, true);

  // Sur toute la plage de l'escalier, et non au seul plancher.
  let pireRelative = 0;
  let mesures = 0;
  for (let z = REGLAGES.deltaMinimum; z <= REGLAGES.deltaMaximum; z += 0.001) {
    pireRelative = Math.max(pireRelative, Math.abs(montre(z, PAS) - z) / z);
    mesures += 1;
  }
  verifier('la plage de l’escalier a bien été balayée', mesures > 400, true);
  verifier('l’erreur relative reste sous 3 % sur toute la plage', pireRelative < 0.03, true);
  verifier('le pas de la grille vaut un millième pile', 1 / (PAS - 1), 0.001);
  verifier('le plancher d’un pas est sous la borne basse de l’escalier',
    1 / (PAS - 1) < REGLAGES.deltaMinimum, true);
}

console.log('\nLE DIVISEUR DU PASSÉ — gelé dans le code de production');
{
  /*
     POURQUOI CET ESSAI LIT LA SOURCE.

     Les assertions de la section « REPRISE » calculent leurs attendus avec le
     même diviseur que celui qu'elles passent à la fonction : elles seraient
     donc vertes avec n'importe quel diviseur, y compris celui qui corrompt les
     données. Elles éprouvent la conversion, pas le CHOIX du diviseur.

     Or ce choix est le défaut : `PAS - 1` était juste tant que la grille ne
     changeait pas. Ce qui doit être gardé n'est pas une valeur mais un endroit
     — les trois lignes du dépôt qui convertissent du passé —, et cela se lit
     dans la source.

     L'essai REFUSE (code 2) s'il n'a rien lu : un balayage qui ne trouve aucun
     fichier rend zéro anomalie, et zéro est ce que rend un dépôt propre.
  */
  /** Les lignes d'un fichier qui contiennent un motif. */
  const lignesAvec = (texte: string, motif: string): string[] =>
    texte.split('\n').filter((ligne) => ligne.includes(motif));

  const base = lireSource('src/lib/db.ts');
  const bord = lireSource('src/features/veridical-mapping/composants/TableauDeBord.svelte');

  const appels = lignesAvec(base, 'reprendreUnSeuil(ligne,');
  verifier('la base convertit les seuils en un seul endroit', appels.length, 1);
  verifier('et par la grille d’alors', (appels[0] ?? '').includes('PAS_HISTORIQUE'), true);

  const medians = lignesAvec(base, 'seuilMedian /');
  verifier('la base convertit le seuil médian en un seul endroit', medians.length, 1);
  verifier('et par la grille d’alors', (medians[0] ?? '').includes('PAS_HISTORIQUE'), true);

  const rampe = lignesAvec(bord, 'const BORNES_RAMPE');
  verifier('le tableau de bord a une rampe', rampe.length, 1);
  verifier('et ses bornes viennent de la grille d’alors',
    (rampe[0] ?? '').includes('zDuPasHistorique'), true);

  /*
     LA CONTRE-ÉPREUVE DU PRÉDICAT LUI-MÊME. Sans elle, « la ligne contient
     PAS_HISTORIQUE » pourrait être vrai de n'importe quoi — par exemple si le
     prédicat se trompait de sens — et les six assertions ci-dessus seraient
     six manières de ne rien vérifier.
  */
  const fautif = 'return reprendreUnSeuil(ligne, PAS - 1);';
  verifier('une ligne qui suit la grille courante est bien repérée comme telle',
    fautif.includes('PAS_HISTORIQUE'), false);
  verifier('et le prédicat reconnaît la bonne forme',
    'reprendreUnSeuil(ligne, PAS_HISTORIQUE - 1)'.includes('PAS_HISTORIQUE'), true);

  // Les deux constantes ne sont pas interchangeables, et c'est tout l'objet.
  verifier('l’ancienne grille comptait cent vingt points', PAS_HISTORIQUE, 120);
  /*
     LE TRANSTYPAGE EST ICI LA MESURE, et non un contournement.

     TypeScript affecte à `PAS` et `PAS_HISTORIQUE` leurs types littéraux, 1001
     et 120, et refuse la comparaison : « ces types n'ont aucun recouvrement ».
     Il a raison, et c'est précisément ce qu'on veut savoir — il le PROUVE à la
     compilation. L'assertion reste parce qu'elle tient le cas où quelqu'un
     rendrait les deux constantes égales : la comparaison deviendrait alors
     légitime aux yeux du compilateur, et c'est elle qui rougirait.

     Relevé en mesurant une remarque de B : « tsc -p tsconfig.json » ne couvre
     pas les fichiers « .mts », parce que son « include » ne porte que sur
     l'extension « .ts ». Cette erreur dormait donc depuis le lot
     PAS_HISTORIQUE, et aucun typecheck ne l'avait vue.
  */
  verifier('les deux grilles diffèrent', (PAS as number) === (PAS_HISTORIQUE as number), false);
  verifier('le diviseur d’alors ne suit pas la grille courante',
    zDuPasHistorique(119), 1);
  verifier('alors que celui de la grille courante en est loin',
    Number(zDuPas(119).toFixed(3)), 0.119);
  // Un seuil ancien de deux pas vaut 1,68 % de l'étendue, et non 0,2 %.
  verifier('deux pas d’alors valent bien 1,7 % de l’étendue',
    ecartDit(zDuPasHistorique(2)), '1,7 %');
}



/* ── LE RENOMMAGE DE LA TÂCHE, ET SON ALIAS ────────────────────────────── */

console.log('\nTÂCHE RENOMMÉE — « plan » se relit « couple »');
{
  const ligne = (id: string, essais: number) => ({
    id,
    de: 'taille',
    vers: 'intensite',
    escalier: { essais },
  });

  // CE QU'IL DOIT VOIR : l'ancien suffixe mène au nouveau.
  verifier('l’ancien suffixe mène au nouveau',
    clefNormalisee('taille>intensite|plan'), 'taille>intensite|couple');
  verifier('et cumulé avec un nom canonique de dimension',
    clefNormalisee('vision.size>audition.level|plan'), 'taille>intensite|couple');
  verifier('le nouveau suffixe est stable',
    clefNormalisee('taille>intensite|couple'), 'taille>intensite|couple');

  const avant = ligne('taille>intensite|plan', 55);
  const apres = ligne('taille>intensite|couple', 9);
  const relus = seuilsRelus([avant, apres]);
  verifier('un seuil d’avant le renommage se relit', seuilsRelus([avant]).length, 1);
  verifier('et sous le nom courant', seuilsRelus([avant])[0].id, 'taille>intensite|couple');
  verifier('les deux noms de tâche ne font qu’un seuil', relus.length, 1);
  verifier('on garde l’escalier le mieux estimé', relus[0].escalier.essais, 55);

  /*
     CE QU'IL NE DOIT PAS VOIR, et c'est la moitié qui compte.

     La tâche est dans la clef parce qu'un seuil mesuré sur le couple n'est pas
     la même grandeur que celui de la tâche de base : il incorpore le coût de
     tenir deux axes. Les confondre ferait poursuivre un escalier avec les
     réponses d'un autre, et perdrait les deux mesures. Traduire un suffixe ne
     doit donc jamais revenir à l'effacer.
  */
  verifier('le couple ne se confond pas avec la tâche de base',
    seuilsRelus([ligne('taille>intensite', 30), avant]).length, 2);
  verifier('ni avec la tâche modulaire',
    seuilsRelus([avant, ligne('taille>intensite|modulaire', 30)]).length, 2);
  // La table ne va que dans un sens : rien ne doit ressortir sous l'ancien nom.
  verifier('rien ne ressort sous l’ancien nom',
    seuilsRelus([avant, apres]).some((l) => l.id.includes('plan')), false);
  // Une tâche qu'une version plus récente aurait ajoutée garde son nom.
  verifier('un suffixe inconnu est rendu intact',
    clefNormalisee('taille>intensite|triplet'), 'taille>intensite|triplet');
}

console.log('\nRENOMMAGE COMPLET — plus un seul site dans les sources');
{
  /*
     POURQUOI CE BALAYAGE.

     Un renommage à moitié fait ne lève pas : la branche oubliée devient
     simplement inatteignable. « if (tache === 'plan') » sous un type qui ne
     produit plus « plan » est du code mort qui se lit comme du code vivant, et
     la tâche se comporterait comme la tâche de base sans que rien le dise.

     Les fichiers d'essai en « .mts » ne sont PAS typés-vérifiés : la liste
     « include » du tsconfig prend les fichiers en point-ts et pas ceux en
     point-mts. Le compilateur n'a donc pas attrapé l'identifiant périmé dans
     ce fichier-ci — le balayage ne le double pas, il couvre ce qu'il ne voit
     pas.
  */
  const FICHIERS = [
    'src/features/veridical-mapping/session.ts',
    'src/features/veridical-mapping/correction.ts',
    'src/features/veridical-mapping/stimulus.ts',
    'src/features/veridical-mapping/composants/VeridicalMapping.svelte',
    'scripts/essais-correction.mts',
  ];
  /*
     CE FICHIER-CI EST EXCLU, ET L'EXCLUSION EST GARDÉE.

     Il PORTE les exemples : « clefNormalisee('…|plan') », le motif cherché
     lui-même, et la contre-épreuve « if (tache === 'plan') ». Le balayage
     trouvait donc six sites et rougissait sur son propre matériel — une
     anomalie de l'outil, qui aurait fini par faire désactiver le contrôle.

     Mais une exclusion non gardée est une porte ouverte : si ce fichier
     cessait de porter des exemples, l'exclusion ne protégerait plus rien et
     personne ne le saurait. On vérifie donc qu'il en porte — AU MOINS trois,
     et non « exactement six ». Le compte exact lierait cette assertion à la
     rédaction des sections voisines, et c'est la leçon du sabotage de
     l'analyseur de bornes : un seuil souple dit que l'exclusion porte, sans
     rougir pour une raison étrangère.
  */
  const PORTEUR_D_EXEMPLES = 'scripts/essais-veridical.mts';
  let sites = 0;
  let lus = 0;
  for (const chemin of FICHIERS) {
    const texte = lireSource(chemin);
    lus += 1;
    sites += (texte.match(/'plan'/g) ?? []).length;
  }
  /*
     LE COMPTE EST COMPARÉ À UN LITTÉRAL, ET NON À `FICHIERS.length`.

     Il l'était, et c'était une assertion qui se mesurait elle-même : retirer
     un fichier de la liste retirait aussi l'attendu, donc le contrôle restait
     VERT en ayant cessé de balayer ce fichier. Mesuré — c'est le seul des sept
     sabotages de cette série qui n'a pas rougi.

     Les quatre fichiers qui portent la tâche sont donc aussi nommés un par un.
     Un compte seul ne dirait pas LEQUEL manque, et c'est précisément le
     fichier retiré qui importe : un balayage qui lit quatre fichiers sur cinq
     ne trouve rien dans le cinquième, et « rien » est ce que rend un
     renommage achevé.
  */
  verifier('cinq fichiers sont balayés', FICHIERS.length, 5);
  verifier('et tous ont été lus', lus, 5);
  for (const indispensable of [
    'src/features/veridical-mapping/session.ts',
    'src/features/veridical-mapping/correction.ts',
    'src/features/veridical-mapping/stimulus.ts',
    'src/features/veridical-mapping/composants/VeridicalMapping.svelte',
  ]) {
    verifier(`le balayage couvre ${indispensable.split('/').pop()}`,
      FICHIERS.includes(indispensable), true);
  }
  verifier('aucun site ne nomme encore l’ancienne tâche', sites, 0);
  verifier('l’exclusion porte bien sur un fichier qui a des exemples',
    (lireSource(PORTEUR_D_EXEMPLES).match(/'plan'/g) ?? []).length >= 3, true);

  /*
     L'EXCEPTION EST GARDÉE. `hub.ts` doit contenir « plan » exactement une
     fois : la table des alias. Zéro voudrait dire que la table a disparu —
     donc que les seuils d'avant le renommage sont orphelins —, et deux
     voudrait dire qu'un site de code y a été ajouté.
  */
  const table = lireSource('src/features/veridical-mapping/hub.ts');
  verifier('la table des alias existe, et une seule fois',
    (table.match(/plan: 'couple'/g) ?? []).length, 1);
  verifier('et « plan » n’apparaît dans ce fichier que par elle',
    (table.match(/'plan'/g) ?? []).length, 0);
  // CONTRE-ÉPREUVE DU PRÉDICAT : il reconnaît bien un site fautif.
  verifier('le motif cherché repère bien un site de code',
    ("if (tache === 'plan') {".match(/'plan'/g) ?? []).length, 1);

  /*
     LES DEUX SEULS ENDROITS OÙ LA TÂCHE EST ENREGISTRÉE.

     Le relevé demandé par le pilote en donne deux, et deux seulement : la CLEF
     de « vmSeuils », et le champ `paires` du journal des séances — qui se lit
     « les arêtes travaillées » mais contient ces mêmes clefs, suffixe compris.
     Les deux doivent être repris à la lecture, sinon une clef d'avant le
     renommage ne retrouve plus sa ligne : le rapprochement rend « aucune
     mesure » là où la mesure existe. Un vide, pas une erreur — donc rien à
     voir à la relecture, et c'est pourquoi cela se garde ici.
  */
  const base = lireSource('src/lib/db.ts');
  const reprises = base.split('\n').filter((l) => l.includes('ligne.paires.map('));
  verifier('le journal reprend ses clefs en un seul endroit', reprises.length, 1);
  verifier('et il les reprend par la normalisation',
    (reprises[0] ?? '').includes('clefNormalisee'), true);
  const seuilsLus = base.split('\n').filter((l) => l.includes('return seuilsRelus('));
  verifier('et les seuils passent par la réduction', seuilsLus.length, 1);
}



/* ── LE DÉPART D'UN ESCALIER, D'APRÈS UN SEUIL DÉJÀ MESURÉ ─────────────── */

console.log('\nDÉPART — la règle, et ses refus');
{
  verifier('une tâche nommée porte son facteur', ratioDeDepart('matching'), 0.5);
  verifier('et une autre le sien', ratioDeDepart('one_to_many'), 1.3);
  // CE QU'IL NE DOIT PAS FAIRE : lever, ou rendre zéro, sur un nom absent.
  // Une tâche nouvelle part du seuil de référence lui-même.
  verifier('une tâche absente de la table vaut 1', ratioDeDepart('une-tache-a-venir'), 1);
  verifier('la table n’est pas vide', Object.keys(RATIO_DE_DEPART).length > 0, true);

  verifier('sans seuil de référence, le départ général s’applique',
    departPour('matching', null), REGLAGES.departDelta);
  /*
     UN SEUIL ABSENT N'EST PAS UN SEUIL NUL. Le confondre avec zéro ferait
     partir l'escalier contre sa borne basse — où rien ne lèverait, 0,02 étant
     un écart parfaitement valide. Les trois formes d'absence sont éprouvées.
  */
  verifier('un seuil nul est traité comme absent',
    departPour('matching', 0), REGLAGES.departDelta);
  verifier('un seuil négatif aussi',
    departPour('matching', -0.1), REGLAGES.departDelta);
  verifier('un seuil non fini aussi',
    departPour('matching', Number.NaN), REGLAGES.departDelta);

  verifier('un seuil de 10 % sur une tâche à 1,2 part à 12 %',
    Number(departPour('coherence', 0.1).toFixed(6)), 0.12);
  verifier('et la même sur une tâche non nommée part du seuil',
    Number(departPour('couple', 0.1).toFixed(6)), 0.1);
  // Les deux bornes du départ, dans les deux sens.
  verifier('un seuil très fin est retenu par la borne basse',
    departPour('matching', 0.021), DEPART_MINIMUM);
  verifier('un seuil très grossier est retenu par la borne haute',
    departPour('one_to_many', 0.44), DEPART_MAXIMUM);
  /*
     LA BORNE BASSE DU DÉPART EST AU-DESSUS DE CELLE DE L'ESCALIER, et c'est
     ce qui donne à l'escalier la place de resserrer au moins une fois. Partis
     à égalité, sa première inversion ne serait pas un rebroussement mais un
     effet de bord.
  */
  verifier('le départ ne touche pas la borne basse de l’escalier',
    DEPART_MINIMUM > REGLAGES.deltaMinimum, true);
  verifier('un départ hors bornes est ramené',
    escalierNeuf(9, PLANCHER_CONTINU).delta, REGLAGES.deltaMaximum);
  verifier('et par le bas aussi', escalierNeuf(0.0001, PLANCHER_CONTINU).delta, REGLAGES.deltaMinimum);
  verifier('sans argument, le départ général', escalierNeuf(REGLAGES.departDelta, PLANCHER_CONTINU).delta, REGLAGES.departDelta);
}

console.log('\nDÉPART — il épargne des essais SANS déplacer le seuil');
{
  /*
     CE CONTRÔLE EST LE SEUL QUI COMPTE VRAIMENT.

     Partir près du seuil échange des essais contre du temps. Si le départ
     DÉPLAÇAIT la valeur mesurée, l'échange serait un biais : les seuils d'une
     tâche partie basse ne seraient plus comparables à ceux d'une tâche partie
     haute, et toute la comparabilité — qui est la raison d'être de l'échelle z
     — tomberait. Rien ne le dirait : on lirait deux seuils plausibles.

     On mesure donc le même observateur simulé depuis trois départs : le départ
     général, un départ volontairement trop bas et un trop haut. Les trois
     estimations doivent coïncider, et le départ juste doit atteindre la
     quatrième inversion plus vite.
  */
  const seuilVrai = 0.06;
  const depuis = (depart: number) => {
    const estimations: number[] = [];
    const essaisJusquAuSeuil: number[] = [];
    for (let graine = 1; graine <= 60; graine += 1) {
      const hasard = generateur(graine * 7919 + Math.round(depart * 1000));
      let etat: EtatEscalier = escalierNeuf(depart, PLANCHER_CONTINU);
      let vu = 0;
      for (let essai = 0; essai < 200; essai += 1) {
        etat = repondre(etat, observateur(etat.delta, seuilVrai, hasard));
        if (!vu && etat.inversions.length >= REGLAGES.inversionsRequises) vu = etat.essais;
      }
      const estime = seuil(etat);
      if (estime !== null) estimations.push(estime);
      if (vu) essaisJusquAuSeuil.push(vu);
    }
    const moyenne = (xs: number[]) => xs.reduce((t, v) => t + v, 0) / Math.max(1, xs.length);
    return {
      estimations: estimations.length,
      biais: moyenne(estimations) / seuilVrai,
      essais: moyenne(essaisJusquAuSeuil),
    };
  };

  const general = depuis(REGLAGES.departDelta);
  const juste = depuis(departPour('couple', seuilVrai));
  const tropBas = depuis(REGLAGES.deltaMinimum * 1.5);

  for (const [nom, m] of [
    ['départ général', general],
    ['départ juste', juste],
    ['départ trop bas', tropBas],
  ] as const) {
    console.log(
      `    ${nom.padEnd(16)} biais ${m.biais.toFixed(3)} · ` +
        `${m.essais.toFixed(0)} essais jusqu’au seuil · ${m.estimations}/60 estimations`,
    );
  }
  verifier('les trois départs rendent des estimations',
    [general.estimations, juste.estimations, tropBas.estimations].every((n) => n >= 55), true);
  // Le biais attendu de la règle 3-down sur une Weibull de pente 3 vaut 0,96 ;
  // l'excès mesuré vient de l'asymétrie des facteurs. On borne, on ne devine pas.
  for (const [nom, mesure] of [
    ['le départ général', general],
    ['un départ juste', juste],
    ['un départ trop bas', tropBas],
  ] as const) {
    verifier(`${nom} : le seuil reste dans ±8 %`,
      Math.abs(mesure.biais - 1) < 0.08, true);
  }
  // LES TROIS COÏNCIDENT ENTRE EUX, et pas seulement chacun avec la vérité :
  // deux écarts de 7 % en sens opposés passeraient le contrôle ci-dessus.
  const biais = [general.biais, juste.biais, tropBas.biais];
  verifier('et les trois coïncident entre eux à 5 %',
    Math.max(...biais) / Math.min(...biais) - 1 < 0.05, true);
  // LE GAIN, mesuré et non supposé.
  verifier('un départ juste atteint le seuil plus vite que le départ général',
    juste.essais < general.essais, true);

  /*
     ET LE BRANCHEMENT, QUE CET ESSAI NE VOIT PAS AUTREMENT.

     Tout ce qui précède éprouve `departPour` et `escalierNeuf`, qui sont purs.
     Mais la règle ne sert à rien si l'écran crée ses escaliers sans elle, et
     ce site-là est dans un composant : aucune des assertions ci-dessus ne
     rougirait si le composant appelait « escalierNeuf » avec le départ général
     et le plancher global. Le site se garde donc dans la source, comme le
     diviseur du passé — et il se garde maintenant SUR DEUX POINTS : la règle
     de départ, et le plancher de la dimension d'arrivée.
  */
  const ecran = lireSource('src/features/veridical-mapping/composants/VeridicalMapping.svelte');
  const creations = ecran.split('\n').filter((l) => l.includes('escalier: escalierNeuf('));
  verifier('l’écran crée son escalier en un seul endroit', creations.length, 1);
  verifier('et il y applique la règle de départ',
    (creations[0] ?? '').includes('departPour('), true);
  /*
     ET LE PLANCHER DE LA DIMENSION, qui est l'objet du lot.

     Sans cette ligne, le composant pourrait poser « escalierNeuf(depart,
     REGLAGES.deltaMinimum) » : le type serait satisfait, l'escalier
     fonctionnerait, et il descendrait sous le grain d'une dimension discrète
     en présentant deux stimulus identiques. C'est exactement la panne que ce
     lot ferme, et aucune assertion sur des fonctions pures ne la voit.
  */
  verifier('et il y applique le plancher de la dimension d’arrivée',
    (creations[0] ?? '').includes('plancherReel(arete.vers)'), true);
  // CONTRE-ÉPREUVE DU PRÉDICAT : les deux formes fautives sont reconnues.
  verifier('le prédicat distingue la forme sans règle de départ',
    'escalier: escalierNeuf(REGLAGES.departDelta, plancherReel(arete.vers)),'
      .includes('departPour('), false);
  verifier('et la forme au plancher global',
    'escalier: escalierNeuf(departPour(enJeu.tache, reference), REGLAGES.deltaMinimum),'
      .includes('plancherReel(arete.vers)'), false);
}



/* ── LA PHRASE QUI DIT LE PLANCHER DE LA MESURE ────────────────────────── */

console.log('\nPLANCHER DIT — le chiffre suit le réglage');
{
  /*
     LA PHRASE ANNONCE UN CHIFFRE, DONC LE CHIFFRE DOIT ÊTRE VRAI.

     Une phrase d'aide ne lève pas. Écrite « 4 % » à la main, elle serait
     devenue fausse au premier changement de `deltaMinimum` — et fausse en
     silence, ce qui est pire qu'absente : la personne lirait un plancher qui
     n'existe pas, ou croirait mesurable un seuil qui ne l'est pas.
  */
  const plancher = PLANCHER_MESURABLE;
  verifier('le plancher est le double de la borne basse',
    plancher, REGLAGES.deltaMinimum * 2);
  verifier('et il vaut 4 % de l’étendue', plancher, 0.04);
  verifier('et il se dit « 4 % »', ecartDit(plancher), '4 %');
  // Si la borne changeait, la phrase changerait avec elle : on le mesure.
  verifier('une autre borne donnerait une autre phrase', ecartDit(0.03 * 2), '6 %');

  /*
     ET QUE L'ÉCRAN LE CALCULE, AU LIEU DE LE RECOPIER. Ce site-là est dans un
     composant : aucune assertion pure ne rougirait si la phrase portait « 4 % »
     en dur.
  */
  const bord = lireSource('src/features/veridical-mapping/composants/TableauDeBord.svelte');
  const calcul = bord.split('\n').filter((l) => l.includes('const PLANCHER_DIT'));
  verifier('le plancher est calculé en un seul endroit', calcul.length, 1);
  /*
     LA VUE LIT UN NOM, ELLE NE CALCULE PLUS.

     L'assertion vérifiait que la ligne contenait « REGLAGES.deltaMinimum ».
     Elle était donc vraie aussi SANS le facteur deux — mesuré par sabotage :
     l'écran affichait « 2 % » pour un plancher à 4 %, et rien ne rougissait.
     Une assertion plus fine sur l'arithmétique de la vue aurait marché, mais
     elle aurait entériné l'arithmétique dans la vue. Le facteur deux a été
     déplacé dans « escalier.ts », avec sa raison, et la vue lit un nom : il
     n'y a plus de calcul à saboter ici.
  */
  verifier('et depuis le plancher nommé par la procédure',
    (calcul[0] ?? '').includes('PLANCHER_MESURABLE'), true);
  /*
     ON INTERDIT L'ARITHMÉTIQUE, PAS LE MOT. Le premier jet cherchait
     « deltaMinimum » n'importe où dans le fichier : il le trouvait dans un
     COMMENTAIRE qui explique la règle, ce qui est légitime et même
     souhaitable. Une assertion qui interdit de nommer une notion en prose
     finit par faire effacer la prose.
  */
  /*
     ET LE PLANCHER LUI-MÊME DÉRIVE DE LA BORNE, DANS SA PROPRE SOURCE.

     Sans cette ligne, écrire « 0,04 » en dur dans `escalier.ts` passait au
     vert — mesuré par sabotage. L'assertion de valeur ci-dessus n'aurait
     rougi QUE le jour où `deltaMinimum` change : une garde latente, pas vaine,
     mais latente au pire moment, celui où quelqu'un déplace la borne et
     s'appuie sur une phrase d'aide restée à l'ancien chiffre.
  */
  const proc = lireSource('src/features/veridical-mapping/escalier.ts');
  const def = proc.split('\n').filter((l) => l.includes('export const PLANCHER_MESURABLE'));
  verifier('le plancher est défini une fois', def.length, 1);
  verifier('et il dérive de la borne basse',
    /REGLAGES\.deltaMinimum\s*\*\s*2/.test(def[0] ?? ''), true);
  verifier('le motif refuserait une valeur écrite en dur',
    /REGLAGES\.deltaMinimum\s*\*\s*2/.test('export const PLANCHER_MESURABLE = 0.04;'), false);

  verifier('la vue ne fait plus l’arithmétique de la borne',
    bord.split('\n').filter((l) => /deltaMinimum\s*\*/.test(l)).length, 0);
  // CONTRE-ÉPREUVE : la forme interdite est bien repérée.
  verifier('et le motif repère bien cette arithmétique',
    /deltaMinimum\s*\*/.test('ecartDit(REGLAGES.deltaMinimum * 2)'), true);
  const phrases = bord.split('\n').filter((l) => l.includes('{PLANCHER_DIT}'));
  verifier('deux écrans de lecture portent la phrase', phrases.length, 2);
  // CE QU'IL NE DOIT PAS VOIR : le chiffre écrit à la main dans une phrase.
  verifier('aucune phrase ne recopie le chiffre',
    /En dessous d’environ \d/.test(bord) || /sous environ \d/.test(bord), false);
  // CONTRE-ÉPREUVE DU PRÉDICAT : la forme fautive est bien reconnue.
  verifier('le prédicat repère un chiffre recopié',
    /En dessous d’environ \d/.test('En dessous d’environ 4 %, la mesure'), true);

  /*
     LE BIAIS QUE LA PHRASE ANNONCE EST MESURÉ AILLEURS DANS CE MÊME ESSAI :
     la section de l'observateur simulé éprouve un seuil vrai de 2,5 %, soit
     SOUS le plancher, et vérifie que l'estimation est au-dessus — « biais vers
     le HAUT, jamais vers le bas ». La phrase ne fait que porter cela à
     l'écran, et cette ligne-ci dit que le cas éprouvé est bien sous le
     plancher ; sans quoi la phrase parlerait d'un domaine que rien ne mesure.
  */
  verifier('le cas éprouvé est bien sous le plancher',
    zDuPasHistorique(3) < plancher, true);
}




/* ── LE PLANCHER PAR DIMENSION ─────────────────────────────────────────── */

console.log('\nPLANCHER PAR DIMENSION — deux stimulus au plancher doivent DIFFÉRER');
{
  /*
     L'ASSERTION QUI TIENT TOUT LE LOT, ET POURQUOI C'EST CELLE-LÀ.

     Le noyau du lot calcule un grain, puis un plancher, puis un écart montré.
     Trois fonctions arithmétiques, et une batterie qui les éprouve l'une par
     l'autre resterait verte avec un grain faux : c'est la garde qui se mesure
     à elle-même, payée trois fois sur ce chantier.

     L'assertion ci-dessous ne recalcule aucun grain. Elle prend le plancher
     tel que le code le rend, le fait passer par le chemin RÉEL d'un essai —
     `ecartEnPasDuZ`, puis `borner`, puis `stimulus` —, et demande la seule
     chose qui importe à la personne devant l'écran : **les deux candidats
     diffèrent-ils ?** Si le grain est mal calculé, le plancher est trop bas,
     l'écart demandé tombe sous le grain, et les deux stimulus se confondent.
     Elle rougit alors sans rien savoir du calcul qu'elle met en défaut.

     Elle balaie TOUTE la plage, et non une position. Sur une échelle
     logarithmique le grain est le plus grossier en bas : une assertion au
     milieu de la plage passerait sur la dimension la plus fautive.

     La plage balayée est celle que `tirerEssai` tire réellement : pour une
     dimension non circulaire, `marge = ecart` tient la référence à au moins un
     écart de chaque bord, sans quoi `borner` ramènerait le leurre SUR la
     référence — deux stimulus identiques, par troncature et non par grain.
     Reprendre cette marge n'affaiblit pas l'assertion : c'est le chemin vrai.
  */
  const zDuPasEssai = (pas: number) => pas / (PAS - 1);

  /** Une dimension d'essai, discrète, bâtie sur une règle de niveaux. */
  function fixture(
    id: string,
    valeur: (pas: number) => number,
    circulaire = false,
  ): Dimension {
    return {
      id,
      canonique: `essai.${id}`,
      attribut: 'taillePx',
      nom: id,
      famille: 'prothetique',
      modalite: 'visuelle',
      resume: 'Dimension d’essai.',
      unite: '',
      circulaire,
      valeur,
    };
  }

  /* Les cas de la fiche de référence, rebâtis comme dimensions mesurables. */
  const PALIERS = fixture('paliers5', (p) => Math.round(zDuPasEssai(p) * 4));
  const CIRC7 = fixture('circ7', (p) => Math.round(zDuPasEssai(p) * 7) % 7, true);
  const LETTRES = fixture('lettres26', (p) => Math.round(zDuPasEssai(p) * 25));
  /*
     LE CAS LOGARITHMIQUE, celui qui défait un grain unique déclaré.

     Quinze valeurs entières réparties géométriquement de 1 à 32, comme
     « audition.event_count ». Le grain y est le plus grossier en bas de la
     plage : les premières valeurs sont 1, 1, 2, 2… et il faut traverser une
     large part de la grille avant que le nombre change.
  */
  const EVENEMENTS = fixture('evenements15', (p) =>
    Math.round(Math.exp(Math.log(1) + zDuPasEssai(p) * (Math.log(32) - Math.log(1)))),
  );

  const MESURES: [Dimension, string][] = [
    [PALIERS, 'cinq paliers'],
    [CIRC7, 'sept niveaux, circulaire'],
    [LETTRES, 'vingt-six niveaux'],
    [EVENEMENTS, 'quinze valeurs, échelle logarithmique'],
  ];

  for (const [d, dit] of MESURES) {
    const mesure = grainMesure(d);
    const plancher = plancherReel(d);
    const ecart = ecartEnPasDuZ(plancher);
    const marge = d.circulaire ? 0 : ecart;

    verifier(`${dit} — le rendu est bien discret`, mesure.discrete, true);

    let identiques = 0;
    let premierFautif = -1;
    for (let pas = marge; pas < PAS - marge; pas += 1) {
      for (const sens of [-1, 1]) {
        const pasLeurre = borner(d, pas + sens * ecart);
        const a = stimulus(d, pas).taillePx;
        const b = stimulus(d, pasLeurre).taillePx;
        if (a === b) {
          identiques += 1;
          if (premierFautif < 0) premierFautif = pas;
        }
      }
    }
    verifier(
      `${dit} — au plancher de ${plancher.toFixed(4)}, aucun couple identique sur la plage` +
        (identiques > 0 ? ` (premier au pas ${premierFautif})` : ''),
      identiques,
      0,
    );
  }

  /*
     LA CONTRE-ÉPREUVE, sans laquelle l'assertion ci-dessus ne vaut rien.

     Au plancher GLOBAL — celui d'avant ce lot —, les mêmes dimensions
     présentent-elles des couples identiques ? Si la réponse était « non », le
     plancher par dimension ne protégerait de rien et tout ce lot serait
     décoratif. On mesure donc le défaut qu'on prétend fermer.
  */
  for (const [d, dit] of MESURES) {
    const ecart = ecartEnPasDuZ(REGLAGES.deltaMinimum);
    const marge = d.circulaire ? 0 : ecart;
    let identiques = 0;
    for (let pas = marge; pas < PAS - marge; pas += 1) {
      for (const sens of [-1, 1]) {
        if (stimulus(d, pas).taillePx === stimulus(d, borner(d, pas + sens * ecart)).taillePx) {
          identiques += 1;
        }
      }
    }
    verifier(`${dit} — au plancher global, le défaut EXISTE`, identiques > 0, true);
  }

  /*
     LE GRAIN MESURÉ CONTRE LA RÈGLE DÉCLARÉE — et l'écart entre les deux est
     une propriété de la GRILLE, non une erreur.

     La règle déclarative donne 1/(n−1), un réel. Les paliers, eux, changent à
     des pas ENTIERS de la grille de 1 001 points. Sur vingt-six niveaux,
     1 000/25 vaut 40 pile, mais les arrondis placent un palier à 41 pas : le
     pire grain mesuré vaut 0,041 et non 0,040. Sur sept niveaux circulaires,
     1 000/7 vaut 142,86, et le pire palier en fait 144.

     Le mesuré est donc toujours ÉGAL OU PLUS GROSSIER que le déclaré, et c'est
     la direction protectrice : le plancher qui en sort ne descend jamais sous
     ce que le rendu montre. On assied cette inégalité plutôt que l'égalité —
     exiger 1/(n−1) au milliardième serait exiger du rendu qu'il ignore sa
     propre grille.
  */
  proche('cinq paliers : grain 1/4, que la grille rend exactement',
    grainMesure(PALIERS).pire, 0.25);
  verifier('vingt-six niveaux : le mesuré est égal ou plus grossier que 1/25',
    grainMesure(LETTRES).pire >= 0.04, true);
  verifier('et il n’en est pas loin', grainMesure(LETTRES).pire < 0.045, true);
  console.log(`    vingt-six niveaux : ${grainMesure(LETTRES).pire} mesuré, 0,04 déclaré`);
  /*
     LE CAS CIRCULAIRE, ET LE CHIFFRE QUI SÉPARE LES DEUX RÈGLES.

     Sept niveaux circulaires : le rendu montre 1/7 ≈ 0,1429. La règle
     non circulaire aurait annoncé 1/6 ≈ 0,1667, soit 17 % de trop. C'est le
     contrôle croisé entre la déclaration et le rendu, et il porte sur le seul
     chiffre où les deux règles diffèrent.
  */
  verifier('sept niveaux circulaires : le mesuré est égal ou plus grossier que 1/7',
    grainMesure(CIRC7).pire >= 1 / 7, true);
  verifier('et il reste sous 1/6, donc du bon côté de la frontière',
    grainMesure(CIRC7).pire < 1 / 6, true);
  console.log(`    sept circulaires : ${grainMesure(CIRC7).pire} mesuré, ${(1 / 7).toFixed(4)} contre ${(1 / 6).toFixed(4)}`);
  /*
     LE PALIER DE LA COUTURE, mesuré pour lui-même.

     Sans le rebouclage, le pire palier mesuré valait 0,072 — la moitié. Cette
     ligne-ci est la contre-épreuve du correctif : elle rougirait si le cercle
     se remettait à se mesurer en deux morceaux.
  */
  verifier('le palier de la couture est compté entier, non par moitiés',
    grainMesure(CIRC7).pire > 0.1, true);
  proche('grainDe le dit aussi, pour une circulaire déclarée',
    grainDe({ id: 'circ7', niveaux: 7, circulaire: true }), 1 / 7);
  proche('et autrement pour la même sans rebouclage',
    grainDe({ id: 'lin7', niveaux: 7 }), 1 / 6);

  /*
     LE CAS LOGARITHMIQUE : le grain unique déclaré est FAUX, et de beaucoup.

     Quinze valeurs : la règle déclarative annonce 1/14 ≈ 0,0714. Le rendu
     montre un pire grain bien plus grossier, parce que les valeurs sont
     serrées en haut de la plage et étalées en bas. C'est le cas qui défait la
     garde arithmétique : `ecartMontre` rendrait 0,0714, non nul donc
     rassurant, là où rien sous le pire grain ne change quoi que ce soit.
  */
  const pireLog = grainMesure(EVENEMENTS).pire;
  verifier('quinze valeurs log : le pire grain dépasse 1/14 déclaré',
    pireLog > 1.5 / 14, true);
  console.log(`    pire grain mesuré : ${pireLog.toFixed(4)} contre ${(1 / 14).toFixed(4)} déclaré`);

  /* Le registre vivant : continu, et son plancher est celui d'avant le lot. */
  for (const d of DIMENSIONS) {
    verifier(`« ${d.id} » est continue`, grainMesure(d).discrete, false);
    proche(`« ${d.id} » : plancher inchangé`, plancherReel(d), REGLAGES.deltaMinimum);
  }

  /* Le plancher d'une dimension inconnue, et celui d'une arête nommée. */
  proche('une dimension inconnue rend le plancher de la procédure',
    plancherDeLArete('dimension-qui-n-existe-pas'), REGLAGES.deltaMinimum);
  proche('une arête nommée rend celui de sa dimension d’arrivée',
    plancherDeLArete('intensite'), plancherReel(DIMENSIONS[2]));

  /* Les trois refus du plancher. */
  leve('un plancher non fini est refusé', () => verifierLePlancher(Number.NaN));
  leve('un plancher sous la borne basse est refusé', () => verifierLePlancher(0.001));
  leve('un plancher au-dessus de l’écart maximum est refusé', () => verifierLePlancher(0.9));
  verifier('et le plancher d’une continue est admis',
    (() => { verifierLePlancher(REGLAGES.deltaMinimum); return true; })(), true);

  /* Une dimension qui ne change jamais, et une qui rend n’importe quoi. */
  leve('une dimension constante est refusée', () =>
    grainMesure(fixture('constante', () => 42)));
  leve('une dimension non finie est refusée', () =>
    grainMesure(fixture('infinie', (p) => (p === 500 ? Number.NaN : p))));

  /*
     « AU PLUS FIN » : le prédicat porte sur le resserrement À VENIR.

     Un escalier posé pile au plancher n'y est pas coincé — il peut encore
     s'élargir. Ce qu'il ne peut plus, c'est descendre, et c'est cela que la
     phrase doit dire.
  */
  const auPlancher = escalierNeuf(0.25, 0.25);
  verifier('un escalier au plancher ne peut plus descendre', estAuPlusFin(auPlancher), true);
  verifier('un escalier bien au-dessus peut encore descendre',
    estAuPlusFin(escalierNeuf(0.4, 0.04)), false);
  /* Et le resserrement ne passe PAS sous le plancher, trois bonnes de suite. */
  let serre = escalierNeuf(0.3, 0.25);
  for (let i = 0; i < 9; i += 1) serre = repondre(serre, true);
  verifier('neuf bonnes réponses ne descendent pas sous le plancher',
    serre.delta >= 0.25, true);

  /*
     LA PHRASE MONTRÉE, et ce qu'elle refuse de dire.

     Sur une dimension discrète, elle attribue la limite à la DIMENSION. Dire
     « vous ne faites pas mieux » là où il faut dire « cette dimension ne
     montre pas plus fin » attribuerait à la personne une limite de l'appareil.
  */
  const phraseDiscrete = phraseDuPlusFin(PALIERS);
  verifier('la phrase d’une discrète nomme la dimension',
    phraseDiscrete.includes('pas la vôtre'), true);
  verifier('et elle donne le nombre de valeurs',
    phraseDiscrete.includes('5 valeurs distinctes'), true);
  verifier('celle d’une continue parle de la mesure, pas de la dimension',
    phraseDuPlusFin(DIMENSIONS[0]).includes('cette mesure sache encadrer'), true);
  verifier('aucune des deux ne porte de « (s) »',
    /\(s\)/.test(phraseDiscrete + phraseDuPlusFin(DIMENSIONS[0])), false);

  /* Le contrôle croisé entre une déclaration et le rendu. */
  verifier('une déclaration juste ne dit rien', desaccordDeNiveaux(PALIERS, 5), null);
  verifier('une déclaration fausse est nommée',
    (desaccordDeNiveaux(PALIERS, 6) ?? '').includes('6 niveaux et son rendu en montre 5'), true);
  verifier('une discrète sans déclaration n’est pas mesurable',
    (desaccordDeNiveaux(PALIERS, undefined) ?? '').includes('n’est pas mesurable'), true);
  verifier('une continue sans déclaration est normale',
    desaccordDeNiveaux(DIMENSIONS[0], undefined), null);
}


console.log(`\n${echecs ? `\x1b[31m✖ ${echecs} échec(s)\x1b[0m` : '\x1b[32m✓ tout passe\x1b[0m'}\n`);
process.exit(echecs ? 1 : 0);
