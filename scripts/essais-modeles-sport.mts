/**
 * La transcription des sept modèles est-elle conforme au dossier ?
 *
 *   npm run essais:modeles-sport
 *
 * ## Pourquoi cet essai, et pourquoi il relit le dossier
 *
 * `src/lib/sport/modeles-programmes.ts` est une **copie** de
 * `docs/cyclades/sport/03-modeles.md`. Une copie ne se relit pas : on relit ce
 * qui y est, jamais ce qui a glissé — un 3 devenu 2, une fourchette inversée,
 * un repos de 90 s écrit 60. Ces fautes-là produisent des valeurs plausibles,
 * et c'est exactement ce qui les rend invisibles.
 *
 * L'essai reparse donc le tableau source à chaque passage et compare valeur
 * par valeur. Le dossier est versionné : la comparaison est reproductible, et
 * elle n'a pas besoin du réseau.
 *
 * ## Ce qu'il vérifie en plus
 *
 * - **la cohérence interne du dossier** : la somme des séries de chaque séance
 *   contre le nombre annoncé en titre, et le total hebdomadaire contre la
 *   fiche. Si le dossier se contredit, la transcription ne peut pas être
 *   juste, et il vaut mieux le savoir avant d'accuser le code ;
 * - **que chaque exercice employé est rattaché** à une identité de
 *   bibliothèque. Un libellé non rattaché ferait créer un exercice en double
 *   à la première copie, et couperait une progression en deux ;
 * - **que la table des muscles correspond à `MUSCLES`**, puisque les cibles du
 *   dossier sont clefées par identifiant.
 *
 * ## Ce qu'il ne vérifie pas
 *
 * Il ne dit rien de la **justesse** des valeurs du dossier : ce sont des
 * énoncés à tester, pas des vérités, et le dossier le dit lui-même. Il dit
 * seulement que le code porte ce que le dossier porte.
 */
import { existsSync, readFileSync } from 'node:fs';
import { MUSCLES } from '../src/lib/sport/modele';
import {
  MODELES_DE_PROGRAMMES,
  identiteDeLExercice,
  type BlocDeModele,
} from '../src/lib/sport/modeles-programmes';

const SOURCE = 'docs/cyclades/sport/03-modeles.md';

/*
   Le refus plutôt qu'un vert trompeur : sans le dossier, l'essai n'a rien à
   comparer, et rendre « tout passe » serait mentir sur ce qui a été mesuré.
*/
if (!existsSync(SOURCE)) {
  console.error(
    `✗ REFUS — « ${SOURCE} » est introuvable.\n` +
      '  Cet essai compare la transcription à son dossier source ; sans lui, il\n' +
      '  ne mesure rien. Le dossier est versionné : vérifiez votre copie de travail.',
  );
  process.exit(1);
}

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) return;
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

/* ══════════════════════════════════════════════════════════════════════════
   La lecture du dossier
   ══════════════════════════════════════════════════════════════════════════ */

const lignes = readFileSync(SOURCE, 'utf8').split('\n');
const cellules = (l: string) =>
  l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
const estTableau = (l: string) => /^\s*\|/.test(l);

/**
 * Les trois normalisations que la transcription s'autorise, et elles seules.
 *
 * Elles sont appliquées **des deux côtés** de la comparaison : le dossier est
 * du Markdown, le module est de la prose affichée telle quelle. Sans cela,
 * l'essai rougirait sur chaque apostrophe au lieu de mesurer les valeurs.
 */
const net = (t: string) =>
  t
    .replace(/'/g, '’')
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '« $1 »')
    .replace(/\s+/g, ' ')
    .trim();

interface BlocDuDossier extends BlocDeModele {}

interface SeanceDuDossier {
  nom: string;
  seriesAnnoncees: number;
  minutes: number;
  blocs: BlocDuDossier[];
}

interface ModeleDuDossier {
  cle: string;
  fiche: Record<string, string>;
  seances: SeanceDuDossier[];
  cibles: Record<string, number>;
  sources?: string;
  limites?: string;
  sensibilite?: string;
}

/** Libellé du dossier → identifiant de `MUSCLES`. */
const MUSCLE_PAR_LIBELLE: Record<string, string> = Object.fromEntries(
  MUSCLES.map((m) => [m.libelle.toLowerCase(), m.id]),
);

const modeles: ModeleDuDossier[] = [];
{
  let courant: ModeleDuDossier | null = null;
  let section: 'fiche' | 'seance' | 'cibles' | null = null;
  let commence = false;

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i];

    const titre = /^### (M[1-7]) — (.+)$/.exec(ligne);
    if (titre) {
      courant = { cle: titre[1], fiche: {}, seances: [], cibles: {} };
      modeles.push(courant);
      section = 'fiche';
      commence = false;
      continue;
    }
    if (!courant) continue;

    const seance = /^#### Séance « (.+?) » \((\d+) séries, environ (\d+) min/.exec(ligne);
    if (seance) {
      courant.seances.push({
        nom: seance[1],
        seriesAnnoncees: Number(seance[2]),
        minutes: Number(seance[3]),
        blocs: [],
      });
      section = 'seance';
      commence = false;
      continue;
    }
    if (/^#### Cibles hebdomadaires/.test(ligne)) {
      section = 'cibles';
      commence = false;
      continue;
    }
    if (/^#{2,4} /.test(ligne)) {
      section = null;
      continue;
    }

    /*
       Les trois paragraphes en gras du modèle. Ils courent sur plusieurs
       lignes et s'arrêtent à la première ligne vide ou au premier tableau.
    */
    const gras =
      /^\*\*(Ce que disent les sources de ce découpage|Limites|Sensibilité à la convention de muscles)\.?\*\*\s*(.*)$/.exec(
        ligne,
      );
    if (gras) {
      const clef = (
        {
          'Ce que disent les sources de ce découpage': 'sources',
          Limites: 'limites',
          'Sensibilité à la convention de muscles': 'sensibilite',
        } as const
      )[gras[1] as 'Limites'];
      let texte = gras[2];
      for (let j = i + 1; j < lignes.length && lignes[j].trim() !== '' && !estTableau(lignes[j]); j += 1) {
        texte += ` ${lignes[j].trim()}`;
      }
      courant[clef] = net(texte);
      continue;
    }

    if (!section) continue;
    /*
       Le tableau fini, la section est finie. « Ce qui sort des fourchettes du
       dossier » est un tableau ordinaire introduit par un paragraphe en gras,
       et non par un titre : sans cette borne, il serait lu comme la suite des
       cibles, et l'essai chercherait un muscle nommé « Critère ».
    */
    if (!estTableau(ligne)) {
      if (commence) {
        section = null;
        commence = false;
      }
      continue;
    }
    const c = cellules(ligne);
    if (/^[-: ]+$/.test(c[0])) continue;
    commence = true;

    if (section === 'fiche') {
      if (c[0] === 'Rubrique') continue;
      courant.fiche[c[0]] = c[1];
    } else if (section === 'seance') {
      if (c[0] === '#') continue;
      const deload = /^(\d+)/.exec(c[7]);
      const deloadRir = /RIR (—|[\d-]+)/.exec(c[7]);
      if (!deload || !deloadRir) {
        echecs += 1;
        console.log(`  \x1b[31m✗\x1b[0m ${courant.cle} : colonne « Déload » illisible — ${c[7]}`);
        continue;
      }
      courant.seances.at(-1)!.blocs.push({
        exercice: net(c[1]),
        series: Number(c[2]),
        repetitionsMin: Number(c[3]),
        repetitionsMax: Number(c[4]),
        repos: c[5] === '—' ? null : Number(c[5]),
        rir: c[6] === '—' ? null : net(c[6]),
        deloadSeries: Number(deload[1]),
        deloadRir: deloadRir[1] === '—' ? null : net(deloadRir[1]),
        note: net(c[9] ?? ''),
      });
    } else {
      if (c[0] === 'Muscle') continue;
      const id = MUSCLE_PAR_LIBELLE[c[0].toLowerCase()];
      if (!id) {
        echecs += 1;
        console.log(`  \x1b[31m✗\x1b[0m ${courant.cle} : muscle inconnu dans le dossier — « ${c[0]} »`);
        continue;
      }
      courant.cibles[id] = Number(c[2].replace(',', '.'));
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   1. La cohérence interne du dossier
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nLa cohérence interne du dossier');
v('sept modèles dans le dossier', modeles.length, 7);
for (const m of modeles) {
  let total = 0;
  for (const s of m.seances) {
    const somme = s.blocs.reduce((n, b) => n + b.series, 0);
    total += somme;
    v(`${m.cle} / « ${s.nom} » : séries annoncées`, somme, s.seriesAnnoncees);
  }
  v(`${m.cle} : séries de travail par semaine`, total, Number(m.fiche['Séries de travail par semaine']));
}

/* ══════════════════════════════════════════════════════════════════════════
   2. La transcription, valeur par valeur
   ══════════════════════════════════════════════════════════════════════════ */

console.log('La transcription contre le dossier');
v(
  'les clefs des modèles transcrits',
  MODELES_DE_PROGRAMMES.map((m) => m.cle),
  modeles.map((m) => m.cle),
);

for (const attendu of modeles) {
  const obtenu = MODELES_DE_PROGRAMMES.find((m) => m.cle === attendu.cle);
  if (!obtenu) {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${attendu.cle} : absent de la transcription`);
    continue;
  }
  const f = attendu.fiche;
  const ou = attendu.cle;

  v(`${ou} : nom`, obtenu.nom, net(f['Nom']));
  v(`${ou} : description`, obtenu.description, net(f['Description']));
  v(`${ou} : public`, obtenu.pourQui, net(f['Public']));
  v(`${ou} : parSemaine`, obtenu.parSemaine, Number(f['Séances par semaine (`parSemaine`)']));
  v(`${ou} : séries par semaine`, obtenu.seriesParSemaine, Number(f['Séries de travail par semaine']));
  v(`${ou} : équipement en détail`, obtenu.equipementDetail, net(f['Équipement']));
  v(
    `${ou} : équipement`,
    obtenu.equipement,
    f['Équipement'].startsWith('maison') ? 'maison' : 'salle',
  );
  v(`${ou} : découpage`, obtenu.decoupage, net(f['Découpage documenté dans']));
  v(`${ou} : ce que disent les sources`, obtenu.sources, attendu.sources);
  v(`${ou} : limites`, obtenu.limites, attendu.limites);
  v(`${ou} : sensibilité`, obtenu.sensibilite, attendu.sensibilite);

  /*
     Les durées sont au titre de la séance, et non dans la fiche : la fiche
     les donne agrégées (« 54 / 50 / 63 min »). On vérifie les deux, parce
     qu'une séance dont le titre et la fiche se contredisent est un écart du
     dossier, pas de la transcription.
  */
  v(
    `${ou} : durées par séance`,
    obtenu.seances.map((s) => s.minutes),
    attendu.seances.map((s) => s.minutes),
  );
  v(
    `${ou} : durées de la fiche`,
    obtenu.seances.map((s) => s.minutes).join(' / '),
    f['Durée estimée par séance (hors échauffement ; calcul simple : 40 s par série plus repos)']
      .replace(/\s*min$/, '')
      .trim(),
  );

  v(
    `${ou} : noms des séances`,
    obtenu.seances.map((s) => s.nom),
    attendu.seances.map((s) => net(s.nom)),
  );

  for (const [rang, seanceAttendue] of attendu.seances.entries()) {
    const seanceObtenue = obtenu.seances[rang];
    if (!seanceObtenue) continue;
    const ouS = `${ou} / « ${seanceAttendue.nom} »`;
    v(
      `${ouS} : nombre de blocs`,
      seanceObtenue.blocs.length,
      seanceAttendue.blocs.length,
    );
    for (const [i, b] of seanceAttendue.blocs.entries()) {
      const o = seanceObtenue.blocs[i];
      if (!o) continue;
      v(`${ouS}, bloc ${i + 1}`, o, b);
    }
  }

  v(`${ou} : cibles du dossier`, obtenu.ciblesDuDossier, attendu.cibles);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Les rattachements
   ══════════════════════════════════════════════════════════════════════════ */

console.log('Les rattachements');
{
  const employes = new Set<string>();
  for (const m of MODELES_DE_PROGRAMMES) {
    for (const s of m.seances) for (const b of s.blocs) employes.add(b.exercice);
  }
  const orphelins = [...employes].filter((e) => identiteDeLExercice(e) === undefined);
  v('tout exercice employé est rattaché à une identité', orphelins, []);

  /*
     Deux libellés qui se rattacheraient à la même identité créeraient deux
     blocs pointant sur le même exercice sans qu'on le voie — et un volume
     compté deux fois.
  */
  const parIdentite = new Map<string, string[]>();
  for (const e of employes) {
    const id = identiteDeLExercice(e);
    if (!id) continue;
    const clef = `${id.nom}|${id.equipement}|${id.variante}`;
    parIdentite.set(clef, [...(parIdentite.get(clef) ?? []), e]);
  }
  v(
    'aucune identité partagée par deux libellés',
    [...parIdentite.entries()].filter(([, noms]) => noms.length > 1),
    [],
  );
}

console.log('Les muscles');
v(
  'les cibles du dossier ne nomment que des muscles connus',
  MODELES_DE_PROGRAMMES.flatMap((m) =>
    Object.keys(m.ciblesDuDossier).filter((id) => !MUSCLES.some((mu) => mu.id === id)),
  ),
  [],
);
vrai(
  'les dix-huit muscles sont cibles dans chaque modèle',
  MODELES_DE_PROGRAMMES.every((m) => Object.keys(m.ciblesDuDossier).length === MUSCLES.length),
);

/* ══════════════════════════════════════════════════════════════════════════
   4. Ce que le prompt 48 ajoute
   ══════════════════════════════════════════════════════════════════════════ */

console.log('Les avertissements et les mentions');
{
  const parCle = (cle: string) => MODELES_DE_PROGRAMMES.find((m) => m.cle === cle)!;
  v(
    'M1 avertit du passage unique par semaine',
    parCle('M1').avertissements,
    ['chaque muscle une fois par semaine, sous le repère de deux'],
  );
  v(
    'M2 avertit de la récupération non mesurée',
    parCle('M2').avertissements,
    ['au-delà de la fréquence conseillée, récupération non mesurée'],
  );
  v(
    'M5 avertit des petits muscles peu travaillés',
    parCle('M5').avertissements,
    ['petits muscles peu travaillés'],
  );
  v(
    'seuls ces trois modèles portent un avertissement',
    MODELES_DE_PROGRAMMES.filter((m) => m.avertissements.length).map((m) => m.cle),
    ['M1', 'M2', 'M5'],
  );
  v('M4 est proposé pour débuter', parCle('M4').propose, 'Proposé pour débuter');
  v(
    'M3 est proposé pour un niveau intermédiaire',
    parCle('M3').propose,
    'Proposé pour un niveau intermédiaire',
  );
  v(
    'aucun autre modèle n’est proposé',
    MODELES_DE_PROGRAMMES.filter((m) => m.propose !== null).map((m) => m.cle),
    ['M3', 'M4'],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. La forme des textes affichés
   ══════════════════════════════════════════════════════════════════════════ */

console.log('La forme des textes');
{
  const textes: [string, string][] = [];
  for (const m of MODELES_DE_PROGRAMMES) {
    textes.push(
      [`${m.cle}.nom`, m.nom],
      [`${m.cle}.description`, m.description],
      [`${m.cle}.pourQui`, m.pourQui],
      [`${m.cle}.equipementDetail`, m.equipementDetail],
      [`${m.cle}.sources`, m.sources],
      [`${m.cle}.limites`, m.limites],
      [`${m.cle}.sensibilite`, m.sensibilite],
      ...m.avertissements.map((a, i): [string, string] => [`${m.cle}.avertissement ${i + 1}`, a]),
      ...m.seances.flatMap((s): [string, string][] => [
        [`${m.cle}/${s.nom}.nom`, s.nom],
        ...s.blocs.map((b, i): [string, string] => [`${m.cle}/${s.nom}.bloc ${i + 1}.note`, b.note]),
      ]),
    );
  }

  /*
     La section G du prompt 43 : pas de « (s) », pas de Markdown, apostrophe
     typographique. Ces textes vont à l'écran tels quels.
  */
  v(
    'aucun « (s) » : les pluriels sont accordés',
    textes.filter(([, t]) => /\(s\)/.test(t)).map(([ou]) => ou),
    [],
  );
  v(
    'aucune apostrophe droite',
    textes.filter(([, t]) => /'/.test(t)).map(([ou]) => ou),
    [],
  );
  v(
    'aucune marque Markdown',
    textes.filter(([, t]) => /\*\*|`/.test(t)).map(([ou]) => ou),
    [],
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
const compte =
  MODELES_DE_PROGRAMMES.length +
  MODELES_DE_PROGRAMMES.reduce(
    (n, m) => n + m.seances.length + m.seances.reduce((k, s) => k + s.blocs.length, 0),
    0,
  );
console.log(
  echecs
    ? `\n\x1b[31m${echecs} écart(s) entre la transcription et le dossier.\x1b[0m\n`
    : `\n\x1b[32m✓ transcription conforme\x1b[0m — ${MODELES_DE_PROGRAMMES.length} modèles, ` +
        `${MODELES_DE_PROGRAMMES.reduce((n, m) => n + m.seances.length, 0)} séances, ` +
        `${MODELES_DE_PROGRAMMES.reduce((n, m) => n + m.seances.reduce((k, s) => k + s.blocs.length, 0), 0)} blocs ` +
        `(${compte} objets comparés).\n`,
);
process.exit(echecs ? 1 : 0);
