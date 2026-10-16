/**
 * Le catalogue des molécules dit-il la vérité ? — phase 2, prompt 25.
 *
 *   npm run essais:catalogue-molecules
 *
 * ## Ce que ce contrôle cherche
 *
 * Pas des erreurs de frappe : **des valeurs inventées**. C'est le défaut
 * propre à ce catalogue, et le seul qui compte. Une demi-vie plausible,
 * bien formée, citant un RCP qui existe — et fausse — passerait tous les
 * contrôles de forme du monde.
 *
 * Il va donc chercher le fichier cité, vérifie son empreinte, en extrait
 * le texte, et **retrouve la phrase dans le document**. Une valeur qui
 * n'est pas dans sa source est signalée, quelle que soit sa vraisemblance.
 *
 * Et dans l'autre sens, qui est le plus facile à oublier : une demi-vie
 * déclarée *inconnue* doit l'être pour une raison vraie. Celle de la
 * N-acétylcystéine dit que son RCP n'en parle pas — on vérifie donc que
 * le mot est bien absent du document. Un « inconnu » commode est un
 * mensonge aussi sûrement qu'un chiffre inventé.
 *
 * ## Quand la collecte n'est pas là
 *
 * `sources/` est hors du dépôt. Sur un clone neuf, les fichiers cités
 * n'existent pas, et ce n'est pas un défaut : c'est l'état normal d'une
 * machine qui n'a pas reçu la collecte. Les sondes de forme tournent
 * quand même ; les sondes de document se disent **non exécutées**, en
 * jaune, plutôt que de passer au vert à vide.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { CATALOGUE, controlerFiche } from '../src/lib/odyssee/sante';
import {
  ABSENTES_DU_THESAURUS,
  INTERACTIONS,
  NIVEAUX_ANSM,
  controlerPaire,
} from '../src/lib/odyssee/molecules';

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
const vrai = (t: string, c: boolean) => v(t, c, true);
const nonExecute = (t: string) => console.log(`  \x1b[33m!\x1b[0m ${t}`);

/** L'empreinte et le texte d'un PDF, par un court passage en Python. */
function lirePdf(chemin: string): { empreinte: string; texte: string } {
  const sortie = execFileSync(
    'python3',
    [
      '-I',
      '-c',
      `import sys,hashlib,json,pypdf
p=sys.argv[1]
o=open(p,'rb').read()
t="\\n".join(pg.extract_text() or '' for pg in pypdf.PdfReader(p).pages)
print(json.dumps({"empreinte":hashlib.sha256(o).hexdigest(),"texte":t}))`,
      chemin,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(sortie) as { empreinte: string; texte: string };
}

/**
 * Les couples **nombre + unité** d'une valeur : « 15 heures », « 4,5 jours ».
 *
 * **Et non les chiffres nus, qui ne prouvaient rien.** Première version de
 * cette sonde : chercher chaque nombre dans le texte du PDF. Sabotée en
 * remplaçant « environ 15 heures » par « 12 heures », elle est restée
 * VERTE — « 12 » se trouve ailleurs dans un RCP de dix-huit pages, en
 * numéro de section ou en dosage. Un contrôle qui ne sait pas distinguer
 * une demi-vie d'un numéro de page ne contrôle rien.
 *
 * Le couple, lui, est spécifique : « 12 heures » n'est pas dans le RCP du
 * modafinil, « 15 heures » y est.
 */
const couplesDe = (texte: string): string[] =>
  [...texte.matchAll(/(\d+(?:[,.]\d+)?)\s*(jours?|heures?|minutes?|semaines?|mois|ans?)/gi)].map(
    (m) => `${m[1]} ${m[2]}`.toLowerCase(),
  );

/** Le texte d'un PDF, **page par page**, pour vérifier une citation de page. */
const cachePages = new Map<string, string[]>();
function pageDuPdf(chemin: string): string[] {
  if (!cachePages.has(chemin)) {
    const sortie = execFileSync(
      'python3',
      [
        '-I',
        '-c',
        `import sys,json,pypdf
print(json.dumps([pg.extract_text() or '' for pg in pypdf.PdfReader(sys.argv[1]).pages]))`,
        chemin,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    cachePages.set(chemin, JSON.parse(sortie) as string[]);
  }
  return cachePages.get(chemin)!;
}

/** Le document, lu une fois par fichier. */
const cache = new Map<string, { empreinte: string; texte: string }>();
const document = (chemin: string) => {
  if (!cache.has(chemin)) cache.set(chemin, lirePdf(chemin));
  return cache.get(chemin)!;
};

console.log('\n\x1b[1m1. LA FORME — AUCUNE VALEUR SANS SOURCE, AUCUNE IGNORANCE SANS MOTIF\x1b[0m');
{
  vrai(`le catalogue n’est pas vide (${CATALOGUE.length} fiche(s))`, CATALOGUE.length > 0);
  v(
    'chaque fiche passe son propre contrôle',
    CATALOGUE.flatMap((f) => controlerFiche(f).map((p) => `${f.id} : ${p}`)),
    [],
  );
  v(
    'les identifiants sont uniques',
    new Set(CATALOGUE.map((f) => f.id)).size,
    CATALOGUE.length,
  );
  /*
     Un motif d'ignorance doit dire quelque chose. « inconnue » tout court
     passerait `controlerFiche`, qui ne regarde que la longueur après
     `trim` ; on exige ici une phrase, parce que c'est elle que l'écran
     affiche à la place de la valeur.
  */
  const motifsCourts = CATALOGUE.flatMap((f) =>
    [f.demiVie, f.maturite, f.donneesHumaines, f.antidopage]
      .filter((x) => !x.connue)
      .map((x) => (x as { pourquoi: string }).pourquoi)
      .filter((m) => m.length < 40)
      .map((m) => `${f.id} : « ${m} »`),
  );
  v('et chaque motif d’ignorance est une phrase, pas un mot', motifsCourts, []);
}

console.log('\n\x1b[1m2. LA SOURCE EXISTE, ET C’EST LA BONNE\x1b[0m');
const sources = CATALOGUE.flatMap((f) =>
  [f.demiVie, f.maturite, f.donneesHumaines, f.antidopage]
    .filter((x) => x.connue)
    .map((x) => (x as { source: { ou: string; empreinte?: string } }).source),
);
const manquants = [...new Set(sources.map((s) => s.ou))].filter((o) => !existsSync(o));

if (manquants.length === [...new Set(sources.map((s) => s.ou))].length && manquants.length > 0) {
  nonExecute(
    `la collecte n’est pas sur cette machine (${manquants.length} fichier(s) cité(s), aucun présent) :`,
  );
  nonExecute('  les sondes de document ne sont PAS exécutées — ni vertes, ni rouges.');
} else {
  v('tous les fichiers cités existent', manquants, []);
  for (const s of [...new Map(sources.map((s) => [s.ou, s])).values()]) {
    if (!existsSync(s.ou)) continue;
    const doc = document(s.ou);
    v(`l’empreinte de « ${s.ou.split('/').pop()} » est celle citée`, doc.empreinte, s.empreinte);
  }

  console.log('\n\x1b[1m3. LA VALEUR EST DANS SON DOCUMENT\x1b[0m');
  /*
     La sonde qui compte. Chaque « nombre + unité » de la demi-vie doit se
     retrouver tel quel dans le texte du RCP : une durée absente du
     document est une durée que quelqu'un a écrite de mémoire.

     **Ce qu'elle ne couvre pas, et c'est dit :** un nombre sans unité
     collée — le « 90 » de « 90 ± 40 jours », le « 36 » de « de 36 à 144
     heures ». Les borner demanderait de reconnaître les fourchettes, et
     une sonde qui devine la grammaire des durées se trompera un jour sur
     un cas que personne n'avait prévu. Le couple le plus à droite est
     vérifié dans les deux cas, et c'est lui qui porte l'unité.
  */
  for (const f of CATALOGUE) {
    if (!f.demiVie.connue) continue;
    const doc = document(f.demiVie.source.ou);
    const texte = doc.texte.replace(/\s+/g, ' ').toLowerCase();
    const couples = couplesDe(f.demiVie.valeur);
    vrai(`« ${f.nom} » : sa demi-vie porte au moins une durée nommée`, couples.length > 0);
    const absentes = couples.filter(
      (c) => !texte.includes(c) && !texte.includes(c.replace(',', '.')),
    );
    v(`« ${f.nom} » : chaque durée de sa demi-vie figure dans le RCP`, absentes, []);
  }

  console.log('\n\x1b[1m4. UNE IGNORANCE DÉCLARÉE EST UNE IGNORANCE VRAIE\x1b[0m');
  /*
     L'autre sens, celui qu'on oublie. La N-acétylcystéine dit que son RCP
     ne mentionne pas de demi-vie : on vérifie que le mot en est absent.
     Si une version ultérieure du RCP en portait une, cette ligne
     deviendrait rouge — et c'est exactement ce qu'on veut, parce que la
     fiche mentirait alors par omission.
  */
  const nac = CATALOGUE.find((f) => f.id === 'n-acetylcysteine');
  vrai('la fiche de la N-acétylcystéine existe', Boolean(nac));
  if (nac && !nac.demiVie.connue && nac.maturite.connue) {
    const doc = document(nac.maturite.source.ou);
    v(
      'et son RCP ne mentionne effectivement aucune demi-vie',
      /demi[-\s]vie/i.test(doc.texte),
      false,
    );
  }
}


console.log('\x1b[1m\n5. LES INTERACTIONS — LE NIVEAU, ET RIEN DU TEXTE\x1b[0m');
{
  vrai(`il y en a (${INTERACTIONS.length})`, INTERACTIONS.length > 0);
  v(
    'chaque paire passe son propre contrôle',
    INTERACTIONS.flatMap((p) => controlerPaire(p)),
    [],
  );
  /*
     Décision 8 : le dépôt public ne porte que des faits dérivés. Le
     niveau est un fait — quatre valeurs possibles —, le mécanisme et la
     conduite à tenir sont le TEXTE du Thésaurus, et ils n'ont rien à
     faire ici. On exige donc que chaque gravité soit exactement l'un des
     quatre niveaux, et pas une phrase.
  */
  const niveaux = Object.values(NIVEAUX_ANSM) as string[];
  v(
    'chaque gravité est exactement un des quatre niveaux de l’ANSM',
    INTERACTIONS.filter((p) => !(p.gravite?.connue && niveaux.includes(p.gravite.valeur))).map(
      (p) => `${p.a} × ${p.b}`,
    ),
    [],
  );
  /*
     La sonde qui garde la décision 8 : aucun mot du Thésaurus ne doit
     avoir glissé dans le dépôt. On cherche les tournures propres à ses
     paragraphes de conduite — « surveillance clinique », « risque de »,
     « par augmentation de » — dans TOUT ce que les paires portent.
     Trouvée verte, elle ne prouve pas l'absence de toute recopie ; elle
     attrape celle qu'on fait sans y penser, en collant une ligne de plus
     « pour que ce soit plus clair ».
  */
  const texteDesPaires = JSON.stringify(INTERACTIONS).toLowerCase();
  const tournures = [
    'surveillance clinique',
    'adaptation éventuelle',
    'risque de',
    'par augmentation',
    'par diminution',
    'métabolisme hépatique',
  ].filter((t) => texteDesPaires.includes(t));
  v('aucune tournure du Thésaurus n’a glissé dans les paires', tournures, []);

  /*
     Les deux sens, encore. Une molécule déclarée absente du Thésaurus ne
     doit porter aucune paire : si elle en portait une, c'est que l'une
     des deux affirmations est fausse, et on ne saurait pas laquelle.
  */
  v(
    'une molécule déclarée absente du Thésaurus ne porte aucune paire',
    INTERACTIONS.filter((p) =>
      ABSENTES_DU_THESAURUS.some((m) => p.a.includes(m) || p.b.includes(m)),
    ).map((p) => `${p.a} × ${p.b}`),
    [],
  );
  /*
     Et l'absence se vérifie dans le document : la N-acétylcystéine ne
     doit pas figurer à l'index des substances. Sans cette ligne,
     `ABSENTES_DU_THESAURUS` serait une affirmation que rien ne contrôle.
  */
  const index =
    'sources/collecte-pilote-2026-10-14/documents/' +
    'collecte-01-sante-D2-D8-D9-E1-E2-E3-G1-G2/E2-ansm-thesaurus-septembre-2023-index-substances.pdf';
  if (existsSync(index)) {
    const texte = document(index).texte.toLowerCase();
    v(
      'et l’index des substances ne la mentionne effectivement pas',
      /ac[ée]tylcyst[ée]ine/.test(texte),
      false,
    );
  } else {
    nonExecute('l’index des substances n’est pas là : l’absence n’est pas vérifiée');
  }
}

console.log('\x1b[1m\n6. LES PAGES CITÉES PORTENT BIEN CE QU’ON LEUR FAIT DIRE\x1b[0m');
{
  const thesaurus = INTERACTIONS[0]?.gravite;
  if (!thesaurus?.connue || !existsSync(thesaurus.source.ou)) {
    nonExecute('le Thésaurus n’est pas sur cette machine : sondes de page non exécutées.');
  } else {
    /*
       La sonde la plus forte du lot, et celle qui a coûté le plus à
       écrire. Pour chaque paire, on ouvre LA PAGE citée et on y cherche
       les deux substances. Une page fausse — un copier-coller de numéro,
       une entrée déplacée d'une version à l'autre — devient rouge, et
       c'est exactement le défaut qu'une relecture humaine ne voit pas.
    */
    const parPage = new Map<number, string[]>();
    for (const p of INTERACTIONS) {
      if (!p.gravite?.connue) continue;
      const m = /p\. (\d+)$/.exec(p.gravite.source.nom);
      if (!m) {
        v(`la source de ${p.a} × ${p.b} cite une page`, p.gravite.source.nom, 'une page');
        continue;
      }
      const page = Number(m[1]);
      parPage.set(page, [...(parPage.get(page) ?? []), p.a, p.b]);
    }
    const texteDuPdf = pageDuPdf(thesaurus.source.ou);
    for (const [page, substances] of [...parPage].sort((x, y) => x[0] - y[0])) {
      const t = (texteDuPdf[page - 1] ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
      const absentes = [...new Set(substances)].filter(
        (s) => !t.includes(s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')),
      );
      v(`page ${page} : toutes les substances citées y figurent`, absentes, []);
    }
  }
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
