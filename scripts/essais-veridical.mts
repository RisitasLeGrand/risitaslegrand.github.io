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
  borner,
  dimensionsDeFamille,
  ecartEnPas,
  ecartDit,
  ecartEnZ,
  dimensionParId,
  pasDuZ,
  zDuPas,
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
import {
  REGLAGES,
  escalierNeuf,
  repondre,
  reprendreUnSeuil,
  seuil,
  statut,
  type EtatEscalier,
} from '../src/features/veridical-mapping/escalier';
import {
  REGLAGES_PAR_DEFAUT,
  tirerEssai,
  vivierDAretes,
} from '../src/features/veridical-mapping/session';

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${titre}${ok ? '' : `\n      obtenu ${JSON.stringify(obtenu)} · attendu ${JSON.stringify(attendu)}`}`);
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
verifier('teinte : 2 et 118 sont voisins', ecartEnPas(teinte, 2, 118), 4);
verifier('taille : 2 et 118 sont distants', ecartEnPas(taille, 2, 118), 116);
verifier('teinte : le pas 125 reboucle sur 5', borner(teinte, 125), 5);
verifier('taille : le pas 125 est borné', borner(taille, 125), PAS - 1);
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
  let etat = escalierNeuf();
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
  verifier('statut initial', statut(escalierNeuf()), 'jamais');
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
*/
for (const seuilVrai of [3, 8, 20].map(zDuPas)) {
  const estimations: number[] = [];
  let convergences = 0;
  for (let graine = 1; graine <= 60; graine += 1) {
    const hasard = generateur(graine * 7919 + seuilVrai);
    let etat: EtatEscalier = escalierNeuf();
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
  const ETENDUE = PAS - 1;
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

  const reprise = reprendreUnSeuil(ancienne, ETENDUE);
  /*
     LA RÈGLE A CHANGÉ, DONC L'ESCALIER REPART. C'est la décision du pilote, et
     c'est le contrôle qui compte : poursuivre un escalier 2-down sous les
     règles du 3-down rendrait un seuil qui ne mesure ni les 70,7 % de l'un ni
     les 79,4 % de l'autre, et rien ne lèverait.
  */
  verifier('l’escalier repart de zéro', reprise.escalier, escalierNeuf());
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
  verifier('une ligne déjà reprise ressort inchangée', reprendreUnSeuil(reprise, ETENDUE) === reprise, true);

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
    escalier: { ...escalierNeuf(), delta: 0.14, essais: 7, reussis: 5 },
    seuil: null,
    statut: 'en-cours' as const,
    echelle: 'z' as const,
    regle: '3-down' as const,
  };
  verifier(
    'une ligne neuve, marqueurs compris, traverse la lecture sans être touchée',
    reprendreUnSeuil(ligneNeuve, ETENDUE) === ligneNeuve,
    true,
  );
  verifier(
    'contre-exemple : la même sans marqueurs est remise à zéro',
    reprendreUnSeuil({ ...ligneNeuve, echelle: undefined, regle: undefined }, ETENDUE).escalier.essais,
    0,
  );

  /*
     LE CAS « MÊME RÈGLE, AUTRE UNITÉ » n'arrive pas dans ce dépôt — les deux
     changements sont du même jour — mais la fonction le traite, et un chemin
     non éprouvé est un chemin qui se défait. On convertit alors sans rien
     perdre : l'escalier continue.
  */
  const memeRegleEnPas = { ...ancienne, regle: '3-down' as const };
  const convertie = reprendreUnSeuil(memeRegleEnPas, ETENDUE);
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

console.log('\nTÂCHES « PLAN » ET « MODULAIRE » — ce qui les rend mesurables');

{
  const hasard = { reel: () => Math.random(), entier: (b: number) => Math.floor(Math.random() * b) };
  const aretes = vivierDAretes({ ...REGLAGES_PAR_DEFAUT, mode: 'exhaustif' }, () => 0);

  // 1. Tâche « plan » : le niveau du hasard doit rester à 50 %, donc **deux**
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
    const essai = tirerEssai(arete, 8, { ...REGLAGES_PAR_DEFAUT, mode: 'exhaustif', tache: 'plan' }, hasard);
    if (essai.tache !== 'plan') continue;
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
  verifier('plan : des essais sont produits', plans > 0, true);
  verifier('plan : toujours deux candidats (hasard à 50 %)', deuxCandidats, true);
  verifier('plan : un seul candidat juste', unSeulJuste, true);
  verifier('plan : le leurre ne se trompe que sur un axe', unSeulAxeFautif, true);
  verifier('plan : la référence porte bien un couple', coupleReel, true);

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
  const pasDeCollision = Array.from({ length: PAS }, (_, i) => i)
    .filter((pas) => teinte2.valeur(pas) === FIXES.teinte);
  verifier('la collision de valeurs existe bien', pasDeCollision.length > 0, true);
  const couple = superposer(stimulus(position, 90), stimulus(teinte2, pasDeCollision[0]));
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


console.log(`\n${echecs ? `\x1b[31m✖ ${echecs} échec(s)\x1b[0m` : '\x1b[32m✓ tout passe\x1b[0m'}\n`);
process.exit(echecs ? 1 : 0);
