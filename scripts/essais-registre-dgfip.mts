/**
 * Le registre des parcours DGFiP contre le document des programmes officiels.
 *
 *   npm run essais:registre-dgfip
 *
 * ## Pourquoi ce contrôle existe
 *
 * Les programmes des concours de la DGFiP ne doivent jamais être inventés :
 * `registre.ts` le dit en tête, et la raison est concrète — un programme faux
 * produit des mois de révision à côté du sujet. Jusqu'au 25 octobre, la garantie
 * tenait à une phrase de commentaire, que rien ne mesurait. DGFiP A et A+
 * portaient `themes: []` justement parce que personne n'avait relu l'arrêté ;
 * maintenant qu'ils portent des thèmes, l'engagement doit devenir vérifiable.
 *
 * Ce script rapproche donc deux fichiers que rien ne reliait : les thèmes
 * déclarés dans `src/lib/parcours/registre.ts`, et `docs/cyclades/programmes-dgfip.md`,
 * qui est la **seule** source autorisée pour les renseigner.
 *
 * ## Ce qu'il mesure, et ce qu'il ne peut pas mesurer
 *
 * Il mesure que chaque intitulé de thème se retrouve **dans le document**, et
 * dans quelle section : celle du concours concerné, ou le § 5, qui est la
 * proposition que le document fait au registre. Un thème introuvable dans les
 * deux est un thème inventé, et il rougit.
 *
 * Il ne mesure PAS que le document dit vrai. Celui-ci se présente comme lu dans
 * les arrêtés au 14 octobre 2026, et il nomme lui-même, à son § 6, ce qu'il
 * n'a pas pu vérifier — dont la page Légifrance, refusée par le proxy sortant.
 * Ce contrôle garde la chaîne « registre → document » ; la chaîne
 * « document → arrêté » est tenue par la méthode du document, pas par du code.
 *
 * Il ne mesure pas non plus les `matieres` d'un thème avec la même force. Un
 * intitulé comme « Droit » ou « SES » se retrouve dans un document de
 * trente-cinq kilo-octets sans rien prouver, et exiger qu'il soit nommé sur une
 * ligne de sa section ne distingue plus une matière du programme d'un mot
 * employé en passant. Les matières sont donc contrôlées plus faiblement — leur
 * présence quelque part dans le document —, et le dire vaut mieux que de
 * laisser croire à une garantie plus forte.
 */
import { readFileSync } from 'node:fs';
import { PARCOURS, planifiable } from '../src/lib/parcours/registre';

const DOCUMENT = 'docs/cyclades/programmes-dgfip.md';
const SOURCE = readFileSync(DOCUMENT, 'utf8');

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

/*
   La comparaison écrase les accents, la casse, les deux sortes d'apostrophe et
   **les blancs**. Ce dernier point n'est pas une commodité : le document est à
   retour forcé à quatre-vingts colonnes, et « raisonnement logique » y est
   coupé en deux lignes. Sans cet écrasement, le contrôle aurait déclaré
   introuvable un intitulé qui y est, c'est-à-dire rougi sur sa propre
   maladresse — mesuré avant d'écrire cette ligne, pas supposé.
*/
const normaliser = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Le document découpé par ses titres de premier niveau (« ## N. »). */
function sections(markdown: string): Map<string, string> {
  const parties = new Map<string, string[]>();
  let courante = '0';
  for (const ligne of markdown.split('\n')) {
    const titre = /^## (\d+)\./.exec(ligne);
    if (titre) courante = titre[1];
    const accumulee = parties.get(courante) ?? [];
    accumulee.push(ligne);
    parties.set(courante, accumulee);
  }
  return new Map([...parties].map(([numero, lignes]) => [numero, normaliser(lignes.join(' '))]));
}

const SECTIONS = sections(SOURCE);
const TOUT = normaliser(SOURCE);

/**
 * La section du document qui traite chaque parcours.
 *
 * Déclarée et non déduite : rien dans le registre ne dit « DGFiP A est au
 * § 3 ». Un parcours DGFiP nouveau fera rougir la ligne ci-dessous tant que sa
 * section ne sera pas nommée, et c'est le bon moment pour se demander si le
 * document le couvre.
 */
const SECTION_DU_PARCOURS: Record<string, string> = {
  'dgfip-b': '2',
  'dgfip-a': '3',
  'dgfip-ap': '4',
};

/** La section 5 est la proposition que le document fait au registre. */
const SECTION_DE_LA_PROPOSITION = '5';

const DGFIP = PARCOURS.filter((p) => p.id.startsWith('dgfip'));

console.log('\nLE DOCUMENT DES PROGRAMMES EST LÀ, ET IL EST DÉCOUPABLE');

v('le document se lit', SOURCE.length > 1000, true);
v(
  'ses sections se retrouvent',
  ['1', '2', '3', '4', '5'].filter((n) => !SECTIONS.has(n)),
  [],
);
v(
  'et il se présente comme lu dans les arrêtés',
  /lus dans les arrêtés/.test(SOURCE),
  true,
);

console.log('\nCHAQUE PARCOURS DGFiP A SA SECTION DANS LE DOCUMENT');

v(
  'aucun parcours DGFiP n’est sans section déclarée',
  DGFIP.filter((p) => !SECTION_DU_PARCOURS[p.id]).map((p) => p.id),
  [],
);

console.log('\nCHAQUE THÈME RENVOIE À UNE LIGNE DU DOCUMENT');

for (const p of DGFIP) {
  for (const theme of p.themes) {
    const dansSaSection = SECTIONS.get(SECTION_DU_PARCOURS[p.id])?.includes(
      normaliser(theme.nom),
    );
    const dansLaProposition = SECTIONS.get(SECTION_DE_LA_PROPOSITION)?.includes(
      normaliser(theme.nom),
    );
    const ou = dansSaSection
      ? `§ ${SECTION_DU_PARCOURS[p.id]}`
      : dansLaProposition
        ? `§ ${SECTION_DE_LA_PROPOSITION}`
        : 'INTROUVABLE';
    v(
      `${p.libelle} · ${theme.nom} — ${ou}`,
      Boolean(dansSaSection || dansLaProposition),
      true,
    );
  }
}

console.log('\nET CHAQUE MATIÈRE EST NOMMÉE QUELQUE PART DANS LE DOCUMENT');

/*
   Contrôle plus faible, et assumé comme tel : voir l'en-tête. Il attrape la
   matière franchement inventée — « Comptabilité analytique approfondie » —, pas
   le mot générique employé ailleurs.
*/
for (const p of DGFIP) {
  const introuvables = p.themes
    .flatMap((t) => t.matieres)
    .filter((m) => !TOUT.includes(normaliser(m)));
  v(`${p.libelle} : aucune matière introuvable dans le document`, introuvables, []);
}

console.log('\nCE QUI EST ÉTABLI LE DIT, ET CE QUI NE L’EST PAS AUSSI');

for (const p of DGFIP) {
  /*
     Un référentiel établi doit nommer son arrêté ET son NOR. C'est ce qui rend
     la source retrouvable par quelqu'un qui n'a pas le document sous les yeux,
     et c'est la demande explicite du lot. Un numéro de NOR est fait de quatre
     lettres, sept chiffres et une lettre.
  */
  if (p.referentiel.origine === 'officiel') {
    const source = p.referentiel.source ?? '';
    v(`${p.libelle} : sa source nomme un arrêté`, /[Aa]rrêté du/.test(source), true);
    v(`${p.libelle} : et son NOR`, /NOR [A-Z]{4}\d{7}[A-Z]/.test(source), true);
    v(
      `${p.libelle} : et renvoie au document qui l’a relevé`,
      source.includes('programmes-dgfip.md'),
      true,
    );
  }
}

/*
   LE CAS LE PLUS DÉLICAT DES TROIS : DES THÈMES SANS PROGRAMME.

   DGFiP A+ a un référentiel officiel, et son programme ANNEXÉ est abrogé depuis
   le 6 septembre 2025. Il a pourtant des thèmes depuis le 25 octobre, tirés du
   seul article 1er, qui délimite encore les épreuves. Les deux faits tiennent
   ensemble et c'est tout l'objet de ce bloc : des thèmes qui décrivent des
   épreuves, pas un programme de connaissances, et une personne avertie que
   chercher « le programme de l'IPFiP » mène à un texte retiré.

   Si le document était corrigé un jour sans que le registre suive — ou
   l'inverse —, c'est ici que l'écart se verrait. C'est exactement le genre
   d'écart qui se creuse en silence.
*/
const ap = PARCOURS.find((p) => p.id === 'dgfip-ap');
v('DGFiP A+ existe', Boolean(ap), true);
if (ap) {
  v('son référentiel est officiel', ap.referentiel.origine, 'officiel');
  v('il porte les quatre épreuves de l’article 1er', ap.themes.length, 4);
  v('il se planifie donc', planifiable(ap), true);
  /*
     Quatre thèmes et sept jours : trois jours sans proposition. Le contrôle
     tient le chiffre parce qu'il est une conséquence du texte, non un choix de
     calendrier — en étaler quatre sur sept aurait désigné les matières qui
     comptent double.
  */
  v('sa rotation ne propose que quatre jours', ap.rotationParDefaut.length, 4);
  v('sa source nomme l’article 1er et sa version', /article 1er, version du 22\/12\/2025/.test(ap.referentiel.source ?? ''), true);
  v(
    'et l’absence de programme, datée du 24/06/2015',
    /aucun programme annexé depuis le 24\/06\/2015/.test(ap.referentiel.source ?? ''),
    true,
  );
  v('le document dit la même abrogation', /abrogé les dispositions suivantes/.test(SOURCE), true);
  /*
     L'AVERTISSEMENT EST LA PIÈCE QUI REND CE PARCOURS HONNÊTE. Sans lui, des
     thèmes tirés de l'article 1er passeraient pour un programme. Il doit donc
     dire l'absence de programme ET d'où viennent les thèmes.

     LES TROIS CONTRÔLES QUI SUIVENT TIENNENT UNE DATE QUI A ÉTÉ FAUSSE.

     L'avertissement a dit « abrogé le 6 septembre 2025 ». C'était la date d'une
     abrogation réelle, mais qui ne portait pas sur un programme. Un contrôle sur
     /abrog/i passait au vert devant cette erreur, parce qu'il ne mesurait qu'un
     mot. Ils nomment donc désormais le fait : la date de 2015, ce que l'annexe
     de 2025 contenait encore, et l'épreuve n° 1 qui n'a jamais eu de programme.
  */
  v(
    'son avertissement date l’absence de programme de 2015',
    /aucun programme annexé depuis le 24 juin 2015/.test(ap.avertissementDuProgramme ?? ''),
    true,
  );
  v(
    'et dit ce que l’annexe de 2025 contenait encore',
    /modèle de dossier de présentation/.test(ap.avertissementDuProgramme ?? ''),
    true,
  );
  v(
    'et que l’épreuve n° 1 n’en a jamais eu',
    /épreuve n° 1.*jamais eu de programme/s.test(ap.avertissementDuProgramme ?? ''),
    true,
  );
  v(
    'et d’où viennent ses thèmes',
    /article 1er/.test(ap.avertissementDuProgramme ?? ''),
    true,
  );
  v(
    'et que trois jours restent sans proposition',
    /sans proposition/.test(ap.avertissementDuProgramme ?? ''),
    true,
  );
  /*
     Aucun autre parcours ne porte cet avertissement : B et A ont un programme
     en vigueur, et leur en coller un affaiblirait celui qui compte.
  */
  v(
    'et lui seul porte un avertissement',
    PARCOURS.filter((p) => p.avertissementDuProgramme).map((p) => p.id),
    ['dgfip-ap'],
  );
}

/*
   LE THÈME PARTAGÉ, REPÉRÉ MAIS PAS ENCORE PARTAGÉ.

   `environnement-dgfip` existe chez DGFiP B et chez DGFiP A, avec le même
   identifiant et le même intitulé : c'est la même matière, portée chez B par
   l'oral et l'option 10 de l'interne, et chez A par le thème I du QCM et
   l'option 5 de l'interne. Les deux déclarations sont donc VOULUES identiques,
   et ce contrôle les y tient — une divergence d'intitulé rendrait le partage à
   venir plus coûteux qu'il ne doit l'être.

   Le partage réel — une fiche, un identifiant, un historique — est un lot à
   part, et il n'est pas fait ici.
*/
{
  const porteurs = PARCOURS.filter((p) => p.themes.some((t) => t.id === 'environnement-dgfip'));
  v(
    'l’organisation de la DGFiP est déclarée chez B et chez A',
    porteurs.map((p) => p.id).sort(),
    ['dgfip-a', 'dgfip-b'],
  );
  const intitules = new Set(
    porteurs.flatMap((p) => p.themes.filter((t) => t.id === 'environnement-dgfip').map((t) => t.nom)),
  );
  v('et des deux côtés sous le même intitulé', [...intitules], [
    'Environnement et organisation de la DGFiP',
  ]);
}

console.log('\nLÀ OÙ L’ARRÊTÉ LAISSE UN CHOIX, LE REGISTRE NE TRANCHE PAS');

/*
   Les trois parcours DGFiP gardent `voie: 'a-preciser'`, et ce n'est pas un
   oubli : l'arrêté du 19 mai 2011 régit trois voies — externe, interne,
   interne spécial —, celui du 2 mars 2011 deux concours et un examen
   professionnel, et l'A+ trois voies dont deux examens. Trancher ici
   annoncerait à la personne une voie qu'elle n'a pas choisie, ce que le
   commentaire du type `Voie` désigne comme l'erreur déjà commise une fois.
*/
for (const p of DGFIP) {
  v(`${p.libelle} : sa voie reste à préciser`, p.concours.voie, 'a-preciser');
}

/*
   Et le thème d'option porte l'épreuve, non la matière choisie. Même raison :
   le concours externe d'inspecteur offre NEUF matières de QRC au choix, et en
   retenir une serait choisir à la place de la personne. Le thème en porte donc
   plusieurs, et cet essai le tient — un thème d'option ramené à une seule
   matière serait un choix déguisé en programme.
*/
/*
   Les deux formes d'option : `option-qrc` chez le contrôleur et l'inspecteur,
   `option-metier` chez l'inspecteur principal, dont les six choix sont des
   métiers. Le contrôle couvre les deux : n'en nommer qu'une aurait laissé
   l'autre se réduire à une seule matière sans que rien ne le dise.
*/
for (const p of DGFIP) {
  for (const option of p.themes.filter((t) => t.id.startsWith('option-'))) {
    v(
      `${p.libelle} · ${option.id} : le choix reste ouvert entre plusieurs matières`,
      option.matieres.length > 1,
      true,
    );
  }
}

v(
  'et chaque parcours DGFiP porte bien une épreuve à option',
  DGFIP.filter((p) => !p.themes.some((t) => t.id.startsWith('option-'))).map((p) => p.id),
  [],
);

console.log(
  echecs === 0
    ? `\n\x1b[32mLes ${DGFIP.reduce((n, p) => n + p.themes.length, 0)} thèmes DGFiP renvoient au document.\x1b[0m\n`
    : `\n\x1b[31m${echecs} en échec.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
