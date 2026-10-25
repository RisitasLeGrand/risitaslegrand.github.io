/**
 * Essais de la garde de clôture du contenu.
 *
 * La garde est éteinte sur le build, donc son essai est le seul endroit où
 * elle s'exerce avant le jour de la clôture. Il porte sur trois choses.
 *
 * 1. LA FONCTION PURE. Ce qu'elle refuse, ce qu'elle laisse passer, et le cas
 *    limite du périmètre vide — zéro sur zéro est une couverture complète, et
 *    non un manque.
 *
 * 2. LE DRAPEAU. Les valeurs reconnues, et le fait qu'une valeur inconnue
 *    retombe sur le défaut au lieu d'être devinée. Un drapeau mal orthographié
 *    qui éteindrait la garde en silence serait pire que pas de garde du tout.
 *
 * 3. LE VÉRIFICATEUR LUI-MÊME, par son CODE DE SORTIE, drapeau éteint puis
 *    allumé. L'assertion n'est pas « allumé, il échoue » — elle serait fausse
 *    le jour où la banque sera complète, et l'essai deviendrait une bombe à
 *    retardement. L'invariant éprouvé est le bon : drapeau allumé, le
 *    vérificateur échoue SI ET SEULEMENT SI la couverture est incomplète. Il
 *    tient aujourd'hui, où la couverture est partielle, et il tiendra après la
 *    clôture, où elle sera complète.
 *
 * 4. LES ÉCARTS DE VISUEL, qui suivent désormais la même règle : avertissement
 *    nommé tant que le contenu n'est pas clos, refus ensuite.
 *
 *    Celui-là ne peut pas s'éprouver sur la banque réelle. Elle est propre
 *    ici — les corrections sont faites —, et le corpus publié, lui, porte
 *    encore les écarts : l'essai dépendrait donc de la machine où il tourne,
 *    et serait vert chez l'un, rouge chez l'autre, pour la même version du
 *    code. Il pose donc SON corpus, deux fichiers dans un dossier temporaire,
 *    avec un écart délibéré : une légende qui annonce trois colonnes sur un
 *    tableau qui en porte deux. Les deux régimes y sont mesurés par le CODE DE
 *    SORTIE, et le témoin — un corpus sans écart — garantit que le refus vient
 *    bien de l'écart et non d'autre chose.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTENU_CLOS, contenuEstClos, manquesDeCouverture } from './lib/cloture-contenu.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let echecs = 0;
function verifier(titre, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) {
    echecs += 1;
    console.log(`\x1b[31m✗\x1b[0m ${titre}`);
    console.log(`    attendu : ${JSON.stringify(attendu)}`);
    console.log(`    obtenu  : ${JSON.stringify(obtenu)}`);
  } else {
    console.log(`\x1b[32m✓\x1b[0m ${titre}`);
  }
}

/* --- 1. La fonction pure ------------------------------------------------ */

verifier(
  'un périmètre complet ne produit aucun manque',
  manquesDeCouverture([['maths', { total: 134, corrigees: 134 }]]),
  [],
);

verifier(
  'un périmètre vide ne produit aucun manque',
  manquesDeCouverture([['rubrique-neuve', { total: 0, corrigees: 0 }]]),
  [],
);

verifier(
  'un périmètre incomplet produit un manque, et un seul',
  manquesDeCouverture([['maths', { total: 134, corrigees: 40 }]]).length,
  1,
);

verifier(
  'le manque nomme le périmètre et le nombre de questions découvertes',
  manquesDeCouverture([['maths', { total: 134, corrigees: 40 }]])[0],
  'maths : 94 question(s) sans correction sur 134 — ' +
    'le contenu est déclaré clos, donc la couverture doit être complète',
);

verifier(
  'une seule question manquante suffit à faire un manque',
  manquesDeCouverture([['anglais', { total: 5, corrigees: 4 }]]).length,
  1,
);

verifier(
  'chaque périmètre incomplet est signalé séparément',
  manquesDeCouverture([
    ['maths', { total: 134, corrigees: 40 }],
    ['francais', { total: 82, corrigees: 82 }],
    ['logique', { total: 64, corrigees: 10 }],
  ]).length,
  2,
);

/* Un compteur absent ne doit pas faire passer un périmètre pour complet par
   accident : sans total, il n'y a rien à exiger, et la garde se tait. */
verifier(
  'un périmètre sans compteur ne provoque ni manque ni plantage',
  manquesDeCouverture([['inconnu', undefined]]),
  [],
);

/* --- 2. Le drapeau ------------------------------------------------------ */

const avecDrapeau = (valeur) => {
  const ancien = process.env.CYCLADES_CONTENU_CLOS;
  if (valeur === undefined) delete process.env.CYCLADES_CONTENU_CLOS;
  else process.env.CYCLADES_CONTENU_CLOS = valeur;
  try {
    return contenuEstClos();
  } finally {
    if (ancien === undefined) delete process.env.CYCLADES_CONTENU_CLOS;
    else process.env.CYCLADES_CONTENU_CLOS = ancien;
  }
};

verifier('sans drapeau, la garde suit la constante de clôture', avecDrapeau(undefined), CONTENU_CLOS);
verifier('le drapeau « 1 » allume la garde', avecDrapeau('1'), true);
verifier('le drapeau « oui » allume la garde', avecDrapeau('oui'), true);
verifier('le drapeau « 0 » éteint la garde', avecDrapeau('0'), false);
verifier('le drapeau « non » éteint la garde', avecDrapeau('non'), false);
verifier(
  'une valeur inconnue retombe sur le défaut au lieu d’être devinée',
  avecDrapeau('peut-etre'),
  CONTENU_CLOS,
);
verifier('une valeur vide retombe sur le défaut', avecDrapeau(''), CONTENU_CLOS);

/* --- 3. Le vérificateur, par son code de sortie ------------------------- */

const sansCouleur = (t) => t.replace(/\x1b\[[0-9;]*m/g, '');

function lancerVerificateur(clos, corpus) {
  const r = spawnSync(process.execPath, [path.join(racine, 'scripts', 'verifier-corrections.mjs')], {
    cwd: racine,
    encoding: 'utf8',
    env: {
      ...process.env,
      CYCLADES_CONTENU_CLOS: clos ? '1' : '0',
      ...(corpus ? { CYCLADES_CONTENU: corpus } : {}),
    },
  });
  const sortie = sansCouleur(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  const m = sortie.match(/Couverture\s*:\s*(\d+)\s*\/\s*(\d+)/);
  return {
    code: r.status,
    corrigees: m ? Number(m[1]) : null,
    total: m ? Number(m[2]) : null,
    sortie,
  };
}

const eteint = lancerVerificateur(false);
verifier('drapeau éteint, le vérificateur passe', eteint.code, 0);
verifier('le vérificateur imprime bien sa couverture', eteint.total !== null, true);

const allume = lancerVerificateur(true);
const couvertureComplete = allume.total !== null && allume.corrigees >= allume.total;

/*
 * L'invariant, et c'est lui qui vaut l'essai : drapeau allumé, le code de
 * sortie dit exactement si la couverture est complète. On lit le code, pas une
 * ligne filtrée.
 */
verifier(
  `drapeau allumé, le code de sortie suit la couverture (${allume.corrigees} / ${allume.total})`,
  allume.code === 0,
  couvertureComplete,
);

/*
 * Et la garde se dit à voix haute dans les deux cas. Sans cela, le jour de la
 * clôture, rien ne distinguerait un build vert parce que la garde est
 * satisfaite d'un build vert parce qu'elle ne s'est pas exécutée.
 */
verifier(
  'drapeau allumé, la garde annonce son verdict',
  /Contenu déclaré clos/.test(allume.sortie),
  true,
);
verifier(
  'drapeau éteint, la garde reste muette',
  /Contenu déclaré clos/.test(eteint.sortie),
  false,
);

if (!couvertureComplete) {
  verifier(
    'drapeau allumé sur une banque incomplète, le manque est nommé',
    /question\(s\) sans correction sur/.test(allume.sortie),
    true,
  );
}

/* --- 4. Les écarts de visuel, sur un corpus posé par l'essai ----------- */

/**
 * Une fiche d'une seule question, dont le visuel s'accorde ou non avec sa
 * prose. Le contenu est synthétique de bout en bout : aucune donnée du
 * concours n'entre dans un essai.
 */
function fiche({ colonnesAnnoncees }) {
  return `---
titre: Fiche de laboratoire
---

## Cours

Un paragraphe, pour que la fiche en ait un.

## Quiz

\`\`\`yaml
- question: Combien de colonnes ce tableau porte-t-il ?
  options:
    - Deux
    - Trois
  reponse: Deux
  correction:
    resume: Le tableau porte deux colonnes.
    par_option:
      - verdict: juste
        pourquoi: Le tableau porte bien deux colonnes.
      - verdict: faux
        pourquoi: Il en porterait trois si une troisième existait.
    detail: La prose du visuel doit dire ce que les données portent.
    confiance: haute
    visuel:
      type: tableau
      alt: Tableau à ${colonnesAnnoncees} colonnes, l’une après l’autre.
      legende: Les colonnes du laboratoire
      donnees:
        entetes:
          - Première
          - Seconde
        lignes:
          - - une
            - deux
\`\`\`
`;
}

/** Pose un corpus d'un fichier et rend son chemin. */
function poserCorpus(racineTemporaire, options) {
  const dossier = path.join(racineTemporaire, 'laboratoire');
  mkdirSync(dossier, { recursive: true });
  writeFileSync(path.join(dossier, 'une-fiche.md'), fiche(options), 'utf8');
  return racineTemporaire;
}

const bac = mkdtempSync(path.join(tmpdir(), 'cyclades-visuels-'));
try {
  /*
     LE TÉMOIN D'ABORD. Un corpus dont la prose s'accorde avec ses données doit
     passer dans les DEUX régimes. Sans lui, un refus observé plus bas pourrait
     venir de n'importe quoi — un schéma mal rempli, une option manquante — et
     l'essai croirait mesurer la bascule.
  */
  const sain = poserCorpus(path.join(bac, 'sain'), { colonnesAnnoncees: 'deux' });
  const sainOuvert = lancerVerificateur(false, sain);
  const sainClos = lancerVerificateur(true, sain);
  verifier('corpus sans écart, contenu non clos : la construction passe', sainOuvert.code, 0);
  verifier('corpus sans écart, contenu clos : la construction passe aussi', sainClos.code, 0);
  verifier(
    'et le verdict des visuels est dit dans les deux cas',
    [/Visuels : aucun écart/.test(sainOuvert.sortie), /Visuels : aucun écart/.test(sainClos.sortie)],
    [true, true],
  );

  /* L'ÉCART : la légende annonce trois colonnes, le tableau en porte deux. */
  const fautif = poserCorpus(path.join(bac, 'fautif'), { colonnesAnnoncees: 'trois' });
  const fautifOuvert = lancerVerificateur(false, fautif);
  const fautifClos = lancerVerificateur(true, fautif);

  /*
     L'INVARIANT, et c'est lui qui vaut l'essai : contenu non clos, l'écart
     avertit et la construction passe ; contenu clos, le MÊME corpus la refuse.
     Deux codes de sortie opposés pour un seul contenu, la bascule étant la
     seule différence.
  */
  verifier('corpus avec écart, contenu non clos : la construction passe', fautifOuvert.code, 0);
  verifier('corpus avec écart, contenu clos : la construction est refusée', fautifClos.code, 1);
  verifier(
    'l’écart est NOMMÉ dans l’avertissement, pas seulement compté',
    /Visuels : 1 écart /.test(fautifOuvert.sortie) &&
      /annonce 3 colonne\(s\) et le tableau en porte 2/.test(fautifOuvert.sortie),
    true,
  );
  verifier(
    'et l’avertissement dit qu’il refusera à la clôture',
    /REFUSERONT la construction/.test(fautifOuvert.sortie),
    true,
  );
  verifier(
    'une fois clos, le même écart est compté parmi les problèmes',
    /visuel : la prose annonce 3 colonne\(s\)/.test(fautifClos.sortie),
    true,
  );
  /*
     Et le DÉCOMPTE est le même des deux côtés. La première version rangeait
     l'écart dans un seau ou dans l'autre selon le drapeau : la ligne de
     verdict annonçait « aucun écart » juste avant de refuser pour un écart.
  */
  verifier(
    'le décompte des visuels ne dépend pas du régime',
    [/Visuels : 1 écart /.test(fautifOuvert.sortie), /Visuels : 1 écart /.test(fautifClos.sortie)],
    [true, true],
  );
} finally {
  rmSync(bac, { recursive: true, force: true });
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
