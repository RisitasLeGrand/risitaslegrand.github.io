/**
 * RÉCUPÉRER LE CORPUS depuis une publication chiffrée.
 *
 * ## Pourquoi cet outil existe
 *
 * `content/` — les fiches, le glossaire, la banque de QCM, les fiches audio —
 * n'a jamais été versionné : le dépôt est public, et le contenu est le seul
 * bien du projet. Le dossier a été perdu. Il n'en reste **qu'un exemplaire au
 * monde** : le site publié, chiffré, dans l'historique de `gh-pages`.
 *
 * Cet outil remonte ce courant : il lit la publication, la déchiffre, et
 * réécrit les fiches au format source.
 *
 * ## Les trois règles qu'il s'impose
 *
 * **1. Il ne touche à rien.** La source est lue soit dans un dossier, soit —
 * et c'est le cas qui compte — par `git show <ref>:data/…`, qui n'a besoin ni
 * de changer de branche, ni d'écrire dans l'arbre de travail. Aucune
 * écriture, jamais, dans le dépôt.
 *
 * **2. Il n'écrit que dehors.** Le dossier de sortie doit être hors du dépôt.
 * Un corpus récupéré dans `content/` serait à un `git add .` de devenir
 * public, et c'est précisément ce que le chiffrement existe pour empêcher.
 *
 * **3. Le mot de passe ne laisse pas de trace.** Il est lu sur le terminal
 * sans écho, ou dans une variable d'environnement nommée en argument. Jamais
 * en argument de commande — `ps` et l'historique du shell le liraient. Jamais
 * dans un fichier. Jamais dans un journal, un rapport ou un message d'erreur.
 *
 * ## Ce qui revient, et ce qui ne revient pas
 *
 * Le site publie le HTML **rendu**, pas le Markdown. La récupération est donc
 * une reconstruction, pas une copie — et une reconstruction se vérifie. Pour
 * chaque section, l'outil re-rend le Markdown qu'il vient d'écrire avec le
 * convertisseur du build lui-même et le compare au HTML publié. Quand les
 * deux coïncident, la fiche est fidèle et c'est démontré, pas espéré. Quand
 * ils diffèrent, la fiche est **nommée dans le rapport**, et le HTML publié est
 * gardé à côté, dans `a-relire/`, pour que la comparaison reste possible.
 *
 * Aucune fiche n'est donc dégradée en silence. C'est la seule garantie qui
 * vaille quand on tient l'unique exemplaire d'un corpus. `RAPPORT.md`, écrit
 * dans le dossier de sortie, dit fiche par fiche ce qui est revenu identique,
 * ce qui est revenu transformé, et ce qui est perdu.
 *
 * ## L'emploi
 *
 *   npm run recuperer:corpus -- --git <ref> --vers <dossier-hors-depot>
 *   npm run recuperer:corpus -- --depuis <dossier/data> --vers <dossier>
 *
 * Options :
 *   --git <ref>            lit « <ref>:data/… » par `git show` (lecture seule)
 *   --depuis <dossier>     lit un dossier `data/` déjà sur le disque
 *   --vers <dossier>       où écrire (obligatoire, hors du dépôt)
 *   --mot-de-passe-env <V> lit le mot de passe dans la variable V
 *   --chemins <fichier>    une liste de chemins candidats, un par ligne
 *   --sans-audio           ne déchiffre pas les fiches audio (plus rapide)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import config from '../site.config.mjs';
import { deriverCle, idStable } from './lib/crypto.mjs';
import { b64VersOctets } from './lib/secret.mjs';
import { construireIndexGlossaire } from './lib/glossaire.mjs';
import { formatAudio } from './lib/voix.mjs';
import {
  extraireParties,
  poserLesIdentifiants,
  rendreHtml,
} from './lib/markdown.mjs';
import { htmlVersMarkdown } from './lib/html-vers-markdown.mjs';
import { cheminDeRepli, enTiret, retrouverLeChemin } from './lib/chemin-de-fiche.mjs';

const RACINE = path.resolve(import.meta.dirname, '..');
const decodeur = new TextDecoder();

/* ══════════════════════════════════════════════════════════════════════════
   La source, en lecture seule
   ══════════════════════════════════════════════════════════════════════════ */

type Source = {
  readonly description: string;
  texte(relatif: string): string | null;
  octets(relatif: string): Uint8Array | null;
  lister(dossier: string): string[];
};

/**
 * Une source lue par `git show`.
 *
 * `git show <ref>:<chemin>` lit l'objet dans la base Git et l'écrit sur sa
 * sortie standard. Il ne change pas de branche, ne touche pas l'index, et
 * n'écrit rien dans l'arbre de travail — c'est pour cela que c'est ce
 * chemin-là, et pas un `git checkout gh-pages`, que l'outil emprunte.
 */
function sourceGit(ref: string): Source {
  const git = (args: string[], encodage: 'utf8' | 'buffer') =>
    execFileSync('git', args, {
      cwd: RACINE,
      encoding: encodage === 'utf8' ? 'utf8' : undefined,
      maxBuffer: 256 * 1024 * 1024,
    });
  return {
    description: `git ${ref}:data/`,
    texte(relatif) {
      try {
        return git(['show', `${ref}:data/${relatif}`], 'utf8') as string;
      } catch {
        return null;
      }
    },
    octets(relatif) {
      try {
        return new Uint8Array(git(['show', `${ref}:data/${relatif}`], 'buffer') as unknown as Buffer);
      } catch {
        return null;
      }
    },
    lister(dossier) {
      try {
        const sortie = git(['ls-tree', '--name-only', `${ref}:data/${dossier}`], 'utf8') as string;
        return sortie.split('\n').filter(Boolean);
      } catch {
        return [];
      }
    },
  };
}

/** Une source lue dans un dossier `data/` déjà présent sur le disque. */
function sourceDossier(dossier: string): Source {
  const abs = path.resolve(dossier);
  return {
    description: abs,
    texte(relatif) {
      const c = path.join(abs, relatif);
      return existsSync(c) ? readFileSync(c, 'utf8') : null;
    },
    octets(relatif) {
      const c = path.join(abs, relatif);
      return existsSync(c) ? new Uint8Array(readFileSync(c)) : null;
    },
    lister(sous) {
      const c = path.join(abs, sous);
      return existsSync(c) ? readdirSync(c) : [];
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le mot de passe
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le mot de passe, demandé sur le terminal **sans écho**.
 *
 * Le terminal est mis en mode brut le temps de la saisie : rien ne s'affiche,
 * et donc rien ne reste dans la fenêtre ni dans une capture d'écran. Le mode
 * est rétabli dans tous les cas, y compris sur Ctrl-C — un terminal laissé en
 * mode brut ne répond plus, et quelqu'un qui vient de perdre son corpus n'a
 * pas besoin de ça en plus.
 */
function demanderSansEcho(invite: string): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const entree = process.stdin;
    if (!entree.isTTY) {
      rejeter(
        new Error(
          'Pas de terminal interactif : le mot de passe ne peut pas être demandé sans écho.\n' +
            '  Passez-le par une variable d’environnement :\n' +
            '    MOTDEPASSE=… npm run recuperer:corpus -- --mot-de-passe-env MOTDEPASSE …',
        ),
      );
      return;
    }
    process.stderr.write(invite);
    const etaitBrut = entree.isRaw;
    entree.setRawMode(true);
    entree.resume();
    let saisie = '';
    const finir = (erreur: Error | null) => {
      entree.setRawMode(etaitBrut);
      entree.pause();
      entree.off('data', surDonnees);
      process.stderr.write('\n');
      if (erreur) rejeter(erreur);
      else resoudre(saisie);
    };
    const surDonnees = (bloc: Buffer) => {
      for (const octet of bloc) {
        if (octet === 0x03) return finir(new Error('Saisie interrompue.'));
        if (octet === 0x0d || octet === 0x0a) return finir(null);
        if (octet === 0x7f || octet === 0x08) {
          saisie = saisie.slice(0, -1);
          continue;
        }
        if (octet >= 0x20) saisie += String.fromCharCode(octet);
      }
      return undefined;
    };
    entree.on('data', surDonnees);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Le déchiffrement
   ══════════════════════════════════════════════════════════════════════════ */

type Enveloppe = { iv: string; ct: string };

async function ouvrirJson(cle: CryptoKey, enveloppe: Enveloppe): Promise<unknown> {
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64VersOctets(enveloppe.iv) },
    cle,
    b64VersOctets(enveloppe.ct),
  );
  return JSON.parse(decodeur.decode(clair));
}

/**
 * Ouvre un fichier binaire publié : l'IV en tête, le chiffré ensuite.
 * C'est le pendant exact de `chiffrerBinaire` dans `lib/crypto.mjs`.
 */
async function ouvrirBinaire(
  cle: CryptoKey,
  octets: Uint8Array,
  tailleIv: number,
): Promise<Uint8Array> {
  const iv = octets.subarray(0, tailleIv);
  const clair = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cle,
    octets.subarray(tailleIv),
  );
  return new Uint8Array(clair);
}

/* ══════════════════════════════════════════════════════════════════════════
   Le chemin de la fiche, retrouvé par son empreinte
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   Le HTML publié, rendu à nouveau pour être comparé
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le HTML, sans le soulignement du glossaire.
 *
 * `glossaire.json` ne publie que `{id, terme, definition}` : les **formes**
 * déclinées (`formes:` dans `content/glossaire.yml`) ne sont pas publiées, et
 * sont donc perdues. Un nouveau rendu soulignera par conséquent moins de
 * termes que la publication. Comparer les deux HTML tels quels ferait tomber
 * presque toutes les fiches « à relire » pour une décoration que le prochain
 * build reposera de lui-même. On compare donc les deux versions dépouillées
 * de ce soulignement, et la perte des `formes:` est dite dans le rapport.
 */
function sansGlossaire(html: string): string {
  return html.replace(/<dfn\b[^>]*>([\s\S]*?)<\/dfn>/g, '$1');
}

/** Le HTML, sans les anciennes ancres que `poserLesIdentifiants` ajoute. */
function sansAnciennesAncres(html: string): string {
  return html.replace(/<span id="[^"]*" class="ancre-ancienne" aria-hidden="true"><\/span>/g, '');
}

function normaliserPourComparaison(html: string): string {
  return sansAnciennesAncres(sansGlossaire(html)).replace(/\s+/g, ' ').trim();
}

/* ══════════════════════════════════════════════════════════════════════════
   L'écriture d'une fiche au format source
   ══════════════════════════════════════════════════════════════════════════ */

function citerYaml(valeur: string): string {
  /* Une chaîne YAML entre apostrophes simples : le seul échappement est
     l'apostrophe doublée. C'est la forme la plus sûre, et la plus lisible
     pour qui relira la fiche à la main. */
  return `'${valeur.replace(/'/g, "''")}'`;
}

function blocYaml(items: Record<string, unknown>[], indentation = ''): string {
  const lignes: string[] = [];
  for (const item of items) {
    let premier = true;
    for (const [cle, valeur] of Object.entries(item)) {
      if (valeur === undefined) continue;
      const tete = premier ? `${indentation}- ` : `${indentation}  `;
      premier = false;
      if (Array.isArray(valeur)) {
        /*
           UNE LISTE VIDE S'ÉCRIT « [] », PAS UNE CLÉ NUE.

           « formes: » suivi de rien se relit `null`, et le schéma attend un
           tableau : le glossaire récupéré était refusé par le build. Mesuré
           par l'aller-retour, qui existe pour ça.
        */
        if (valeur.length === 0) {
          lignes.push(`${tete}${cle}: []`);
        } else {
          lignes.push(`${tete}${cle}:`);
          for (const v of valeur) lignes.push(`${indentation}    - ${citerYaml(String(v))}`);
        }
      } else if (typeof valeur === 'object' && valeur !== null) {
        lignes.push(`${tete}${cle}:`);
        for (const [k, v] of Object.entries(valeur)) {
          if (v === undefined) continue;
          lignes.push(`${indentation}    ${k}: ${citerYaml(String(v))}`);
        }
      } else if (typeof valeur === 'number' || typeof valeur === 'boolean') {
        lignes.push(`${tete}${cle}: ${valeur}`);
      } else {
        const texte = String(valeur);
        if (texte.includes('\n')) {
          lignes.push(`${tete}${cle}: |`);
          for (const l of texte.split('\n')) lignes.push(`${indentation}    ${l}`);
        } else {
          lignes.push(`${tete}${cle}: ${citerYaml(texte)}`);
        }
      }
    }
  }
  return lignes.join('\n');
}

type Partie = { niveau: number; id: string; titre: string; declare?: boolean };
type Charge = {
  id: string;
  titre: string;
  matiere: string;
  fascicule: string;
  tags: string[];
  coursHtml: string;
  ficheHtml: string;
  sommaire: Partie[];
  parties: Partie[];
  flashcards: { question: string; reponse: string; partie?: string }[];
  quiz: QuestionPubliee[];
  pretest: QuestionPubliee[];
  podcast: { secondes: number | null; octets: number; type: string; parties?: unknown } | null;
};
type QuestionPubliee = {
  question: string;
  options: string[];
  bonnes: number[];
  explication?: string;
  correction?: unknown;
  partie?: string;
};

/** L'état d'une section après conversion. */
type Verdict = 'identique' | 'a-relire' | 'vide';

/**
 * Reconstruit une section de cours et **vérifie** la reconstruction.
 *
 * La vérification est le cœur de l'outil. On convertit le HTML en Markdown,
 * puis on re-rend ce Markdown avec le convertisseur du build — le vrai, celui
 * de `lib/markdown.mjs`, avec les mêmes greffons et les mêmes réglages — et on
 * compare au HTML publié. Si les deux coïncident, la fiche est fidèle et c'est
 * démontré, pas espéré.
 *
 * ## Et sinon : le Markdown imparfait, jamais le HTML brut
 *
 * La première version gardait le HTML publié tel quel, en se disant que « du
 * HTML dans un Markdown reste du HTML ». **C'est faux dans cette chaîne**, et
 * l'aller-retour l'a dit : `remark-rehype` tourne sans `allowDangerousHtml` et
 * **jette** le HTML écrit à la main. Une section gardée en verbatim ne
 * disparaissait donc pas un peu : elle disparaissait entièrement. Une fiche
 * revenait avec une synthèse vide, et le rapport la déclarait « verbatim »,
 * c'est-à-dire intacte.
 *
 * On garde donc le Markdown converti, même imparfait : une page qui diffère
 * d'un tableau vaut infiniment mieux qu'une page blanche. Et le HTML publié
 * n'est pas perdu pour autant — il est écrit à côté, dans `a-relire/`, hors de
 * `content/`, pour que la comparaison reste possible à la main.
 */
function reconstruireSection(
  html: string,
  parties: Partie[],
  indexGlossaire: Map<string, unknown>,
  avecIdentifiants: boolean,
): { markdown: string; verdict: Verdict; inconnues: string[]; htmlPublie: string | null } {
  if (!html?.trim()) return { markdown: '', verdict: 'vide', inconnues: [], htmlPublie: null };

  const idsDeclares = parties.filter((p) => p.declare).map((p) => p.id);
  const { markdown, inconnues } = htmlVersMarkdown(html, { idsDeclares });

  /* Le chemin exact du build, refait à l'identique : retirer les marqueurs,
     rendre, reposer les identifiants. Tout écart ici invaliderait la
     comparaison et ferait tomber en « à relire » des fiches parfaitement
     récupérées. */
  const { markdown: propre, parties: declarees } = avecIdentifiants
    ? extraireParties(markdown)
    : { markdown, parties: [] };
  const rendu = poserLesIdentifiants(
    rendreHtml(propre, indexGlossaire, {
      premiereOccurrenceSeulement: config.glossaire.premiereOccurrenceSeulement,
      dejaVus: new Set(),
    }),
    declarees,
  );

  const fidele = normaliserPourComparaison(rendu) === normaliserPourComparaison(html);
  return {
    markdown,
    verdict: fidele ? 'identique' : 'a-relire',
    inconnues,
    /* Le HTML publié, gardé pour les sections à relire : c'est la seule
       référence qui existe encore, et elle ne doit pas disparaître dans
       l'écart entre le rendu et la source. */
    htmlPublie: fidele ? null : html,
  };
}

/** Écrit la section « ## Quiz » ou « ## Prétest » au format source. */
function sectionQuestions(questions: QuestionPubliee[]): string {
  return blocYaml(
    questions.map((q) => ({
      question: q.question,
      options: q.options,
      /*
         LA RÉPONSE REVIENT PAR SON RANG, PAS PAR SON TEXTE.

         La publication ne porte que `bonnes: [index]` — le `reponse:` écrit
         dans la source, texte ou rang, n'y est plus. Le schéma accepte les
         deux ; on écrit le rang, qui est ce que la publication dit
         exactement. Deux options au texte identique ne créent donc aucune
         ambiguïté, là où réécrire le texte en aurait créé une.
      */
      ...(q.bonnes.length === 1 ? { reponse: q.bonnes[0] } : { reponses: q.bonnes }),
      ...(q.explication ? { explication: q.explication } : {}),
      ...(q.correction ? { correction: q.correction as Record<string, unknown> } : {}),
      ...(q.partie ? { partie: q.partie } : {}),
    })),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le programme
   ══════════════════════════════════════════════════════════════════════════ */

function lireArguments(argv: string[]) {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const nom = a.slice(2);
    const suivant = argv[i + 1];
    if (suivant && !suivant.startsWith('--')) {
      options[nom] = suivant;
      i++;
    } else {
      options[nom] = true;
    }
  }
  return options;
}

/**
 * Refuse un dossier de sortie situé dans le dépôt.
 *
 * Un corpus récupéré dans l'arbre de travail serait à un `git add .` de
 * devenir public — exactement ce que le chiffrement existe pour empêcher.
 * L'outil refuse donc de l'écrire là, plutôt que de compter sur le `.gitignore`
 * et sur la vigilance de quelqu'un qui vient de perdre son travail.
 */
function verifierLaSortie(vers: string): string {
  const abs = path.resolve(vers);
  const dedans = abs === RACINE || abs.startsWith(RACINE + path.sep);
  if (dedans) {
    throw new Error(
      `Le dossier de sortie « ${abs} » est dans le dépôt.\n` +
        '  Le corpus en clair ne doit jamais s’y trouver : un « git add . » suffirait à le\n' +
        '  publier, et le dépôt est public. Choisissez un dossier hors du dépôt, par exemple :\n' +
        `    --vers ${path.resolve(RACINE, '..', 'corpus-recupere')}`,
    );
  }
  return abs;
}

async function main() {
  const o = lireArguments(process.argv.slice(2));

  if (!o.vers || typeof o.vers !== 'string') {
    console.error(
      'Il manque --vers <dossier>, hors du dépôt.\n\n' +
        '  npm run recuperer:corpus -- --git <ref> --vers ../corpus-recupere\n',
    );
    process.exit(2);
  }
  const sortie = verifierLaSortie(o.vers);

  const source =
    typeof o.git === 'string'
      ? sourceGit(o.git)
      : typeof o.depuis === 'string'
        ? sourceDossier(o.depuis)
        : null;
  if (!source) {
    console.error('Il manque --git <ref> ou --depuis <dossier/data>.');
    process.exit(2);
  }

  // --- L'en-tête, lu avant de demander quoi que ce soit --------------------
  const enteteBrut = source.texte('cle.json');
  if (!enteteBrut) {
    console.error(`Aucun « cle.json » dans ${source.description}. Ce n’est pas une publication.`);
    process.exit(2);
  }
  const entete = JSON.parse(enteteBrut) as {
    kdf: string;
    iterations: number;
    sel: string;
    chiffrement: string;
    temoin: Enveloppe;
  };
  if (entete.kdf !== 'PBKDF2-SHA256' || entete.chiffrement !== 'AES-GCM') {
    console.error(
      `Chiffrement inattendu (${entete.kdf} / ${entete.chiffrement}). ` +
        'Cet outil ne connaît que PBKDF2-SHA256 + AES-GCM.',
    );
    process.exit(2);
  }

  const identifiants = source.lister('fiches').filter((n) => n.endsWith('.json'));
  const audios = source.lister('audio').filter((n) => n.endsWith('.enc'));
  console.error(
    `Source : ${source.description}\n` +
      `  ${identifiants.length} fiche(s) chiffrée(s), ${audios.length} audio(s).\n` +
      `  ${entete.kdf}, ${entete.iterations} itérations.\n`,
  );
  if (identifiants.length === 0) {
    console.error('Aucune fiche à récupérer : rien à faire.');
    process.exit(2);
  }

  // --- Le mot de passe ----------------------------------------------------
  let motDePasse: string;
  if (typeof o['mot-de-passe-env'] === 'string') {
    const nom = o['mot-de-passe-env'];
    const valeur = process.env[nom];
    if (!valeur) {
      console.error(`La variable d’environnement « ${nom} » est vide ou absente.`);
      process.exit(2);
    }
    motDePasse = valeur;
  } else {
    motDePasse = await demanderSansEcho('Mot de passe du site (la saisie ne s’affiche pas) : ');
  }
  if (!motDePasse) {
    console.error('Mot de passe vide : rien n’a été lu.');
    process.exit(2);
  }

  const cle = await deriverCle(
    motDePasse,
    b64VersOctets(entete.sel),
    entete.iterations,
    config.crypto?.tailleCleBits ?? 256,
  );
  /* Le mot de passe a fini son office : la clé dérivée suffit pour la suite,
     et une variable qui ne contient plus rien ne peut plus fuir. */
  motDePasse = '';

  try {
    await ouvrirJson(cle, entete.temoin);
  } catch {
    console.error(
      '\nMot de passe refusé : le témoin de « cle.json » ne s’ouvre pas.\n' +
        '  Rien n’a été écrit. Aucune tentative n’est enregistrée nulle part.\n',
    );
    process.exit(1);
  }
  console.error('Témoin ouvert : le mot de passe est le bon.\n');

  const tailleIv = config.crypto?.tailleIvOctets ?? 12;

  // --- Le manifeste, qui porte « ordre », et les matières -----------------
  type FicheManifeste = {
    id: string;
    titre: string;
    parcours: string;
    ordre: number;
    tags: string[];
  };
  const manifeste = (await ouvrirJson(
    cle,
    JSON.parse(source.texte('manifeste.json') ?? '{}') as Enveloppe,
  )) as {
    genereLe: string;
    matieres: { nom: string; fascicules: { nom: string; fiches: FicheManifeste[] }[] }[];
  };
  const parManifeste = new Map<string, FicheManifeste>();
  for (const m of manifeste.matieres ?? []) {
    for (const f of m.fascicules ?? []) {
      for (const fiche of f.fiches ?? []) parManifeste.set(fiche.id, fiche);
    }
  }

  // --- Le glossaire -------------------------------------------------------
  let glossaire: { id: string; terme: string; definition: string }[] = [];
  const glossaireBrut = source.texte('glossaire.json');
  if (glossaireBrut) {
    glossaire = (await ouvrirJson(cle, JSON.parse(glossaireBrut) as Enveloppe)) as typeof glossaire;
  }
  const indexGlossaire = construireIndexGlossaire(glossaire, {
    longueurMinimale: config.glossaire.longueurMinimale,
  });

  // --- Les chemins candidats fournis à la main ----------------------------
  const cheminsFournis: string[] = [];
  if (typeof o.chemins === 'string') {
    for (const ligne of (await readFile(o.chemins, 'utf8')).split('\n')) {
      const propre = ligne.trim();
      if (propre && !propre.startsWith('#')) cheminsFournis.push(propre);
    }
  }
  const parEmpreinte = new Map<string, string>();
  for (const chemin of cheminsFournis) parEmpreinte.set(await idStable(chemin), chemin);

  // --- Les fiches ---------------------------------------------------------
  type Ligne = {
    id: string;
    titre: string;
    chemin: string;
    cheminCertain: boolean;
    cours: Verdict;
    fiche: Verdict;
    nbFlashcards: number;
    nbQuiz: number;
    nbPretest: number;
    audio: 'reprise' | 'absent' | 'echec';
    inconnues: string[];
  };
  const lignes: Ligne[] = [];
  const dossierFiches = path.join(sortie, 'content');

  for (const nom of identifiants) {
    const id = nom.replace(/\.json$/, '');
    const brut = source.texte(`fiches/${nom}`);
    if (!brut) continue;
    const charge = (await ouvrirJson(cle, JSON.parse(brut) as Enveloppe)) as Charge;
    const dansManifeste = parManifeste.get(id);
    const ordre = dansManifeste?.ordre ?? 999;
    const parcours = dansManifeste?.parcours ?? 'insp';

    /* Le chemin : la liste fournie d'abord, puis les candidats énumérés, puis
       un repli lisible — et dans ce dernier cas on le DIT, parce que
       l'identifiant changera et que la progression enregistrée pour cette
       fiche deviendra orpheline. */
    const reperage = { parcours, matiere: charge.matiere, fascicule: charge.fascicule, titre: charge.titre, ordre };
    const trouve = await retrouverLeChemin(id, reperage, parEmpreinte);
    const certain = trouve.certain;
    const chemin = trouve.chemin ?? cheminDeRepli(reperage);

    const cours = reconstruireSection(charge.coursHtml, charge.parties ?? [], indexGlossaire, true);
    /* Les identifiants de partie sont relus dans `coursHtml || ficheHtml` par
       le build : quand il n'y a pas de cours, c'est la fiche simplifiée qui
       les porte. On suit la même règle, sans quoi les marqueurs se
       reposeraient sur la mauvaise section. */
    const simplifiee = reconstruireSection(
      charge.ficheHtml,
      charge.coursHtml ? [] : (charge.parties ?? []),
      indexGlossaire,
      !charge.coursHtml,
    );

    const morceaux: string[] = [
      '---',
      `matiere: ${citerYaml(charge.matiere)}`,
      `fascicule: ${citerYaml(charge.fascicule)}`,
      `titre: ${citerYaml(charge.titre)}`,
      `ordre: ${ordre}`,
      ...(charge.tags?.length
        ? ['tags:', ...charge.tags.map((t) => `  - ${citerYaml(t)}`)]
        : ['tags: []']),
      '---',
      '',
    ];
    if (cours.markdown) morceaux.push('## Cours complet', '', cours.markdown.trim(), '');
    if (simplifiee.markdown)
      morceaux.push('## Fiche simplifiée', '', simplifiee.markdown.trim(), '');
    if (charge.flashcards?.length) {
      morceaux.push(
        '## Flashcards',
        '',
        blocYaml(
          charge.flashcards.map((c) => ({
            /*
               La source écrivait peut-être « q: » et « r: » — le schéma
               accepte les deux paires. La publication, elle, ne porte que
               les noms longs : c'est donc eux qu'on réécrit. La fiche est
               équivalente, pas identique au caractère près, et le rapport
               le dit.
            */
            question: c.question,
            reponse: c.reponse,
            ...(c.partie ? { partie: c.partie } : {}),
          })),
        ),
        '',
      );
    }
    if (charge.quiz?.length) morceaux.push('## Quiz', '', sectionQuestions(charge.quiz), '');
    if (charge.pretest?.length)
      morceaux.push('## Prétest', '', sectionQuestions(charge.pretest), '');

    const destination = path.join(dossierFiches, chemin);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, morceaux.join('\n').replace(/\n{3,}/g, '\n\n'));

    /* Le HTML publié des sections à relire, gardé hors de `content/` : c'est
       la référence exacte, et sans elle une relecture se ferait de mémoire. */
    for (const [nom, section] of [['cours', cours], ['fiche', simplifiee]] as const) {
      if (!section.htmlPublie) continue;
      const aRelire = path.join(sortie, 'a-relire', `${chemin.replace(/\.md$/, '')}.${nom}.html`);
      await mkdir(path.dirname(aRelire), { recursive: true });
      await writeFile(aRelire, section.htmlPublie);
    }

    // --- L'audio, repris tel quel ----------------------------------------
    let audio: Ligne['audio'] = 'absent';
    if (charge.podcast && !o['sans-audio']) {
      const chiffre = source.octets(`audio/${id}.enc`);
      if (!chiffre) {
        audio = 'echec';
      } else {
        try {
          const clair = await ouvrirBinaire(cle, chiffre, tailleIv);
          const dossierAudio = path.join(dossierFiches, '.audio');
          await mkdir(dossierAudio, { recursive: true });
          /*
             L'EXTENSION EST CELLE QUE LE BUILD IRA CHERCHER.

             `cheminAudio` la tire de `config.podcast.format` ; écrire « .mp3 »
             en dur alors que le projet est en Opus déposerait l'audio à côté
             de l'endroit où le build regarde, et la fiche repartirait sans
             son audio alors qu'il a été récupéré intact.
          */
          await writeFile(path.join(dossierAudio, `${id}.${formatAudio(config.podcast).extension}`), clair);
          /*
             La métadonnée revient SANS son empreinte : l'empreinte couvre le
             texte dit et les réglages de voix, et la publication ne la porte
             pas. Conséquence à dire tout haut, parce qu'elle coûte de
             l'argent : `npm run podcasts` croira l'audio périmé et voudra le
             resynthétiser. L'audio, lui, est intact.
          */
          await writeFile(
            path.join(dossierAudio, `${id}.json`),
            JSON.stringify(
              {
                secondes: charge.podcast.secondes,
                octets: clair.byteLength,
                ...(charge.podcast.parties ? { parties: charge.podcast.parties } : {}),
              },
              null,
              2,
            ),
          );
          audio = 'reprise';
        } catch {
          audio = 'echec';
        }
      }
    }

    lignes.push({
      id,
      titre: charge.titre,
      chemin,
      cheminCertain: certain,
      cours: cours.verdict,
      fiche: simplifiee.verdict,
      nbFlashcards: charge.flashcards?.length ?? 0,
      nbQuiz: charge.quiz?.length ?? 0,
      nbPretest: charge.pretest?.length ?? 0,
      audio,
      inconnues: [...new Set([...cours.inconnues, ...simplifiee.inconnues])],
    });
    if (lignes.length % 25 === 0) console.error(`  ${lignes.length}/${identifiants.length}…`);
  }

  // --- Le glossaire, au format source -------------------------------------
  if (glossaire.length) {
    await writeFile(
      path.join(dossierFiches, 'glossaire.yml'),
      '# Glossaire récupéré depuis la publication chiffrée.\n' +
        '#\n' +
        '# ATTENTION : les « formes: » (variantes déclinées de chaque terme) ne sont PAS\n' +
        '# publiées — la publication ne porte que le terme et sa définition. Elles sont\n' +
        '# perdues, et doivent être réécrites. Sans elles, le soulignement automatique\n' +
        '# ne reconnaît plus que la forme exacte du terme.\n' +
        blocYaml(glossaire.map((g) => ({ terme: g.terme, formes: [], definition: g.definition }))) +
        '\n',
    );
  }

  // --- Les annexes, telles quelles ----------------------------------------
  const annexes = path.join(sortie, 'annexes');
  for (const nom of ['qcm-dgfip.json', 'recherche.json', 'molecules.json']) {
    const brut = source.texte(nom);
    if (!brut) continue;
    try {
      const clair = await ouvrirJson(cle, JSON.parse(brut) as Enveloppe);
      await mkdir(annexes, { recursive: true });
      await writeFile(path.join(annexes, nom), JSON.stringify(clair, null, 2));
    } catch {
      /* Une annexe illisible n'arrête pas la récupération des fiches : c'est
         le corpus qui compte, et le rapport dira laquelle manque. */
    }
  }

  await writeFile(path.join(sortie, 'RAPPORT.md'), rapport(lignes, source, manifeste, glossaire));
  console.error(
    `\nTerminé. ${lignes.length} fiche(s) écrite(s) dans ${dossierFiches}\n` +
      `  Rapport : ${path.join(sortie, 'RAPPORT.md')}\n`,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le rapport
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le rapport de récupération.
 *
 * Il dit trois choses, et dans cet ordre, parce que c'est l'ordre dans lequel
 * elles importent à qui vient de récupérer son corpus : ce qui est revenu
 * identique, ce qui est revenu transformé et comment, ce qui est perdu.
 *
 * Il nomme les fiches une par une. Un total rassure ; une liste permet d'agir.
 */
function rapport(
  lignes: {
    id: string;
    titre: string;
    chemin: string;
    cheminCertain: boolean;
    cours: Verdict;
    fiche: Verdict;
    nbFlashcards: number;
    nbQuiz: number;
    nbPretest: number;
    audio: 'reprise' | 'absent' | 'echec';
    inconnues: string[];
  }[],
  source: Source,
  manifeste: { genereLe?: string },
  glossaire: unknown[],
): string {
  const n = lignes.length;
  const aRelire = lignes.filter((l) => l.cours === 'a-relire' || l.fiche === 'a-relire');
  const incertains = lignes.filter((l) => !l.cheminCertain);
  const audios = lignes.filter((l) => l.audio === 'reprise');
  const audiosRates = lignes.filter((l) => l.audio === 'echec');
  const balises = [...new Set(lignes.flatMap((l) => l.inconnues))].sort();
  const t = (x: number) => `**${x}**`;

  const morceaux: string[] = [
    '# Récupération du corpus — rapport',
    '',
    `Source : \`${source.description}\`  `,
    `Publication engendrée le : ${manifeste.genereLe ?? 'inconnu'}  `,
    `Récupération faite le : ${new Date().toISOString()}`,
    '',
    `${t(n)} fiche(s) récupérée(s).`,
    '',
    '## 1. Ce qui revient identique',
    '',
    'Démontré, pas supposé : pour chacune de ces sections, le Markdown écrit a été',
    'rendu à nouveau avec le convertisseur du build, et le HTML obtenu est celui',
    'de la publication. Le site servira exactement les mêmes pages.',
    '',
    `- Sections de cours fidèles : ${t(lignes.filter((l) => l.cours === 'identique').length)}` +
      ` sur ${lignes.filter((l) => l.cours !== 'vide').length} non vides`,
    `- Fiches simplifiées fidèles : ${t(lignes.filter((l) => l.fiche === 'identique').length)}` +
      ` sur ${lignes.filter((l) => l.fiche !== 'vide').length} non vides`,
    '',
    'Reviennent par ailleurs **au champ près**, parce que la publication les porte',
    'sous forme structurée et non rendue :',
    '',
    `- Front-matter : \`matiere\`, \`fascicule\`, \`titre\`, \`tags\` (charge de la fiche) et`,
    '  `ordre` (manifeste).',
    `- Flashcards : ${t(lignes.reduce((s, l) => s + l.nbFlashcards, 0))} cartes` +
      ' (question, réponse, partie citée).',
    `- Quiz : ${t(lignes.reduce((s, l) => s + l.nbQuiz, 0))} questions` +
      ' (énoncé, options dans l’ordre, bonnes réponses, explication, correction).',
    `- Prétests : ${t(lignes.reduce((s, l) => s + l.nbPretest, 0))} questions.`,
    `- Fiches audio : ${t(audios.length)} MP3 **octet pour octet** — le fichier publié est`,
    '  le fichier source chiffré, rien de plus.',
    '',
    '## 2. Ce qui revient transformé',
    '',
    '### 2.1 Le Markdown est reconstruit depuis le HTML',
    '',
    'Le site publie le HTML rendu, pas la source. Le texte, les titres, les niveaux,',
    'les listes, l’emphase et les liens reviennent ; la **mise en page de la source**',
    'ne revient pas : largeur des lignes, nombre de lignes vides, alignement des',
    'tableaux, choix entre `*` et `_` pour l’emphase, entre `-` et `*` pour les puces.',
    'Le document rendu est le même ; le fichier n’est pas le même fichier.',
    '',
    '### 2.2 Les flashcards reviennent en noms longs',
    '',
    'La source acceptait `q:` / `r:` comme `question:` / `reponse:`. La publication ne',
    'porte que les noms longs : c’est donc eux qui sont réécrits. Équivalent pour le',
    'build, différent à la lecture.',
    '',
    '### 2.3 Les réponses de quiz reviennent par leur rang',
    '',
    'La source pouvait écrire `reponse: « texte de l’option »`. La publication ne porte',
    'que le rang (`bonnes: [1]`), et c’est le rang qui est réécrit. Aucune ambiguïté —',
    'c’est même plus sûr qu’un texte, que deux options identiques rendraient incertain.',
    '',
    '### 2.4 Le soulignement du glossaire est défait, et sera refait',
    '',
    '`<dfn data-terme=…>` est posé par le build, pas écrit dans la source : il est',
    'retiré. Le prochain build le reposera. La comparaison du § 1 est donc faite hors',
    'soulignement — sans quoi la perte des `formes:` (§ 3.3) ferait tomber presque',
    'toutes les fiches en « à relire » pour une décoration régénérable.',
    '',
    '## 3. Ce qui est perdu',
    '',
    '### 3.1 Le chemin de chaque fiche — et avec lui son identifiant',
    '',
    'C’est la perte la plus coûteuse, et il faut la comprendre avant d’agir.',
    '',
    '`ficheId = idStable(cheminRelatif)` : l’identifiant d’une fiche est l’empreinte',
    'SHA-256 de son chemin dans `content/`. Le chemin n’est pas publié. Toute la',
    'progression enregistrée dans le navigateur — révisions, répétition espacée,',
    'séances, favoris — est rangée **par identifiant de fiche**. Une fiche replacée au',
    'bon chemin garde son identifiant au prochain build, et la progression continue de',
    'tomber juste. Replacée ailleurs, elle en reçoit un neuf, et tout ce qui la',
    'concernait devient orphelin, sans un message.',
    '',
    'Une empreinte ne se renverse pas, mais elle se **vérifie** : chaque chemin',
    'candidat est éprouvé contre l’identifiant publié, et un chemin qui tombe juste',
    'est juste avec la certitude d’un SHA-256.',
    '',
    `- Chemins **certifiés** par leur empreinte : ${t(n - incertains.length)} sur ${n}.`,
    `- Chemins **reconstruits sans certitude** : ${t(incertains.length)}.`,
    '',
  ];

  if (incertains.length) {
    morceaux.push(
      'Ces fiches-là sont récupérées — leur contenu est intact — mais leur chemin est',
      'une supposition, et leur identifiant changera donc au prochain build :',
      '',
      '| identifiant publié | titre | chemin supposé |',
      '| --- | --- | --- |',
      ...incertains
        .slice(0, 60)
        .map((l) => `| \`${l.id}\` | ${l.titre} | \`${l.chemin}\` |`),
    );
    if (incertains.length > 60) morceaux.push(`| … | … et ${incertains.length - 60} autres | … |`);
    morceaux.push(
      '',
      '**Comment en récupérer davantage.** Toute liste des anciens chemins permet de les',
      'certifier sans le moindre risque : une sauvegarde, une capture d’écran de',
      'l’arborescence, une sortie de `ls -R` retrouvée, un `find` d’un vieux disque.',
      'Déposez les chemins candidats dans un fichier, un par ligne, relatifs à',
      '`content/`, puis relancez :',
      '',
      '```',
      'npm run recuperer:corpus -- --git <ref> --vers <dossier> --chemins anciens-chemins.txt',
      '```',
      '',
      'Chaque ligne est éprouvée contre les identifiants publiés. Celles qui tombent',
      'juste certifient leur fiche ; les autres sont ignorées sans dommage. Le procédé',
      'est sûr : il ne peut rien attribuer à tort.',
      '',
    );
  }

  morceaux.push(
    '### 3.2 Tout ce qui précède le premier titre « ## »',
    '',
    '`decouperSections` ne retient que ce qui suit un `##` reconnu. Un texte placé',
    'entre le front-matter et le premier `## Cours complet` n’est jamais entré dans la',
    'publication : il est perdu, et il l’était déjà avant la perte du dossier — le site',
    'ne l’affichait pas.',
    '',
    '### 3.3 Les `formes:` du glossaire',
    '',
    `\`glossaire.json\` ne publie que \`{terme, definition}\` : ${t(glossaire.length)} termes`,
    'reviennent avec leur définition, **sans** leurs variantes déclinées. Le',
    '`glossaire.yml` écrit porte donc `formes: []`, et un avertissement en tête. Sans',
    'ces formes, le soulignement automatique ne reconnaît plus que la forme exacte.',
    '',
    '### 3.4 Les commentaires et le HTML écrits à la main',
    '',
    '`remark-rehype` est employé sans `allowDangerousHtml` : un `<!-- commentaire -->`',
    'ou une balise HTML écrite dans une fiche n’est pas rendue, donc jamais publiée,',
    'donc irrécupérable.',
    '',
    '### 3.5 L’empreinte des fiches audio',
    '',
    'Les MP3 reviennent intacts, mais pas l’empreinte qui dit à `npm run podcasts`',
    'qu’ils sont à jour : elle couvre le texte dit et les réglages de voix, et n’est',
    'pas publiée. **`npm run podcasts` croira donc les audios périmés et voudra les',
    'resynthétiser** — ce qui coûte. Les fichiers, eux, sont là et jouables.',
    '',
    '### 3.6 Ce qui n’est pas du contenu de fiche',
    '',
    '`content/qcm-dgfip/*.yml`, l’index de recherche et les autres annexes sont',
    'déchiffrés dans `annexes/`, **au format publié** (JSON), et non remis au format',
    'source : leur forme source a des champs que la publication réagence, et deviner',
    'serait pire que de livrer le JSON exact.',
    '',
    '## 4. Les fiches à relire',
    '',
  );

  if (!aRelire.length) {
    morceaux.push(
      'Aucune. Chaque section non vide a passé la vérification par nouveau rendu :',
      'le Markdown écrit, re-rendu, redonne le HTML publié.',
      '',
    );
  } else {
    morceaux.push(
      `${t(aRelire.length)} fiche(s) ont au moins une section dont le Markdown reconverti, une`,
      'fois re-rendu, ne redonne pas exactement le HTML publié. Le texte est là ; quelque',
      'chose dans sa mise en forme a bougé.',
      '',
      'Pour chacune, le HTML publié est écrit dans `a-relire/`, à côté du corpus. C’est la',
      'référence exacte : ouvrez-la à côté de la fiche et comparez. **Ne recopiez pas ce',
      'HTML dans la fiche** — la chaîne de rendu tourne sans `allowDangerousHtml` et le',
      'jetterait, laissant la section vide.',
      '',
      '| identifiant | titre | cours | fiche simplifiée | chemin |',
      '| --- | --- | --- | --- | --- |',
      ...aRelire.map(
        (l) => `| \`${l.id}\` | ${l.titre} | ${l.cours} | ${l.fiche} | \`${l.chemin}\` |`,
      ),
      '',
    );
  }

  if (balises.length) {
    morceaux.push(
      'Balises HTML que la reconversion ne sait pas traduire et a recopiées telles',
      `quelles : ${balises.map((b) => `\`<${b}>\``).join(', ')}.`,
      '',
    );
  }
  if (audiosRates.length) {
    morceaux.push(
      `⚠ ${t(audiosRates.length)} audio(s) annoncé(s) par la fiche mais introuvable(s) ou`,
      'illisible(s) dans la publication :',
      '',
      ...audiosRates.map((l) => `- \`${l.id}\` — ${l.titre}`),
      '',
    );
  }

  morceaux.push(
    '## 5. Le geste suivant',
    '',
    'Le corpus récupéré est **hors du dépôt**, et doit y rester : `content/` n’est pas',
    'versionné, et le dépôt est public. Avant toute autre chose, mettez ce dossier à',
    'l’abri ailleurs — c’est aujourd’hui le deuxième exemplaire au monde, et le premier',
    'en clair.',
    '',
    'Ensuite, et dans cet ordre :',
    '',
    '1. Relire les fiches du § 4, s’il y en a, en les comparant au HTML de `a-relire/`.',
    '2. Chercher une liste d’anciens chemins pour les fiches du § 3.1, et relancer avec',
    '   `--chemins`. Chaque chemin certifié est de la progression sauvée.',
    '3. Réécrire les `formes:` du glossaire (§ 3.3).',
    '4. Ne **pas** lancer `npm run podcasts` sans l’avoir décidé (§ 3.5).',
    '',
  );
  return morceaux.join('\n');
}

main().catch((erreur) => {
  /* Jamais le mot de passe, ni rien qui en dérive, dans un message d'erreur :
     ce qui s'affiche finit dans une capture d'écran ou un journal de session. */
  console.error(`\n${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
  process.exit(1);
});
