/**
 * Lecture d'une fiche Markdown : front-matter, découpage en sections,
 * rendu HTML (avec soulignement du glossaire) et extraction du texte brut.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { remarkGlossaire, normaliser } from './glossaire.mjs';

/** Titres de section reconnus -> clé interne. */
const SECTIONS = new Map([
  ['cours complet', 'cours'],
  ['cours', 'cours'],
  ['fiche simplifiee', 'fiche'],
  ['fiche de synthese', 'fiche'],
  ['fiche simplifie', 'fiche'],
  ['flashcards', 'flashcards'],
  ['flashcard', 'flashcards'],
  ['quiz', 'quiz'],
  ['qcm', 'quiz'],
  ['pretest', 'pretest'],
  ['pre-test', 'pretest'],
  ['pre test', 'pretest'],
  ['auto-questionnement', 'pretest'],
  /*
     « ## Organigrammes » — une section et non un visuel de correction.

     Un organigramme de référence ne doit pas s'atteindre en répondant à une
     question. Jusqu'ici un schéma ne vivait que dans la correction d'un QCM :
     pour le consulter, il fallait tomber sur la bonne question et se tromper.
     La section le sort de là et le rend consultable, sans rien changer au
     rendu — c'est le même visuel « schema », avec ses deux lectures.
  */
  ['organigrammes', 'organigrammes'],
  ['organigramme', 'organigrammes'],
]);

/**
 * Découpe le corps Markdown en sections de niveau « ## ».
 * Un « ## » non reconnu est rattaché à la section en cours (il s'agit alors
 * d'un sous-titre du cours), et signalé à l'appelant.
 */
export function decouperSections(corps) {
  const lignes = corps.split(/\r?\n/);
  const sections = { cours: [], fiche: [], flashcards: [], quiz: [], pretest: [], organigrammes: [] };
  const inconnues = [];
  let courante = null;
  let dansBlocCode = false;

  for (const ligne of lignes) {
    if (/^\s*(```|~~~)/.test(ligne)) dansBlocCode = !dansBlocCode;

    const titre = !dansBlocCode && /^##\s+(.+?)\s*$/.exec(ligne);
    if (titre) {
      const cle = SECTIONS.get(normaliser(titre[1]));
      if (cle) {
        courante = cle;
        continue;
      }
      if (courante) inconnues.push(titre[1]);
    }
    if (courante) sections[courante].push(ligne);
  }

  return {
    sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join('\n').trim()])),
    inconnues,
  };
}

/** Convertit un Markdown en HTML, en soulignant les termes du glossaire. */
export function rendreHtml(markdown, indexGlossaire, options = {}) {
  if (!markdown?.trim()) return '';
  const processeur = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkGlossaire, {
      index: indexGlossaire,
      premiereOccurrenceSeulement: options.premiereOccurrenceSeulement ?? false,
      dejaVus: options.dejaVus ?? new Set(),
    })
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeStringify);
  return String(processeur.processSync(markdown));
}

/** Texte brut d'un Markdown : sert à l'index de recherche. */
export function texteBrut(markdown) {
  if (!markdown?.trim()) return '';
  const arbre = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const morceaux = [];
  visit(arbre, (noeud) => {
    if (noeud.type === 'text' || noeud.type === 'inlineCode') morceaux.push(noeud.value);
  });
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
}

/** Extrait la table des matières (titres ### et ####) pour la navigation interne. */
export function extraireSommaire(html) {
  const sommaire = [];
  const regex = /<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    sommaire.push({
      niveau: Number(m[1]),
      id: m[2],
      titre: m[3].replace(/<[^>]+>/g, '').trim(),
    });
  }
  return sommaire;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les parties d'une fiche (prompt 46, P1)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'identifiant d'une partie, écrit à côté de son titre.
 *
 * ## Pourquoi un identifiant écrit, et pas l'ancre
 *
 * L'ancre d'un titre est fabriquée à partir de son texte. Corriger une
 * faute dans « Contraintes de s'adapter » change donc l'ancre, et avec elle
 * tout ce qui s'y rattache : un repère audio, une carte rattachée à la
 * partie, une séance qui dit l'avoir vue. L'identifiant, lui, est écrit une
 * fois et ne bouge plus — c'est la condition de tout le reste du prompt 46.
 *
 * ## Pourquoi cette syntaxe, et pas `{#id}` de Markdown étendu
 *
 * `{#id}` est la syntaxe des attributs de titre, mais `remark` ne la connaît
 * pas sans greffon, et l'interdit 5 défend d'ajouter une dépendance. Le
 * marqueur est donc retiré **avant** le rendu, par cette fonction, et
 * l'identifiant reposé **après** sur le bon titre. Le rendu ne voit jamais
 * la syntaxe, et personne n'a à l'apprendre à `remark`.
 */
/*
   Les lettres accentuées sont admises, et ce n'est pas une largesse : les
   ancres actuelles en portent — « …françaises… », « …connaît… » —, et
   l'identifiant posé par `npm run parties:identifiants` EST l'ancre
   actuelle, pour que les liens déjà enregistrés continuent de tomber juste.
   Une expression restreinte à l'ASCII ne reconnaissait pas ces marqueurs :
   le premier passage les écrivait, le second les réécrivait par-dessus, et
   le rendu affichait « {#…} » dans le titre. Mesuré sur 423 fiches.
*/
const MARQUEUR = /\s*\{#([\p{L}\p{N}][\p{L}\p{N}_-]*)\}\s*$/u;

/**
 * Sépare le texte d'un titre de l'identifiant écrit à côté de lui.
 *
 * Exportée parce que deux chaînes lisent les mêmes titres : celle du site,
 * qui rend le HTML, et celle des fiches audio, qui en fait des relances
 * parlées (prompt 46, P2). La seconde a besoin des deux morceaux au même
 * endroit — l'identifiant pour poser le repère, le texte pour le dire — et
 * recopier l'expression du marqueur là-bas aurait suffi à ce qu'un jour
 * l'une des deux copies reconnaisse ce que l'autre laisse passer.
 */
export function separerIdentifiant(titre) {
  const brut = titre ?? '';
  const marque = MARQUEUR.exec(brut);
  return marque
    ? { texte: brut.replace(MARQUEUR, '').trim(), id: marque[1] }
    : { texte: brut.trim(), id: null };
}

/**
 * Sépare le Markdown d'un cours de ses identifiants de partie.
 *
 * Rend le Markdown **sans les marqueurs** — c'est lui qu'on rend en HTML —
 * et la liste des parties dans l'ordre des titres, avec, pour chacune, le
 * niveau, le titre nettoyé, et l'identifiant déclaré ou `null`.
 *
 * Un titre de niveau 4 n'est pas une partie : la décision 2 du prompt le
 * dit, « le niveau 4 reste à l'intérieur de sa partie ».
 */
export function extraireParties(markdown) {
  if (!markdown?.trim()) return { markdown: markdown ?? '', parties: [] };
  const lignes = markdown.split(/\r?\n/);
  const parties = [];
  let dansBlocCode = false;

  const propres = lignes.map((ligne) => {
    if (/^\s*(```|~~~)/.test(ligne)) dansBlocCode = !dansBlocCode;
    if (dansBlocCode) return ligne;
    const titre = /^(#{2,3})\s+(.+?)\s*$/.exec(ligne);
    if (!titre) return ligne;
    const { texte, id } = separerIdentifiant(titre[2]);
    parties.push({ niveau: titre[1].length, titre: texte, id });
    return `${titre[1]} ${texte}`;
  });

  return { markdown: propres.join('\n'), parties };
}

/**
 * Pose les identifiants déclarés sur les titres du HTML rendu.
 *
 * L'ancienne ancre — celle que `rehype-slug` fabrique depuis le texte —
 * reste atteignable : elle est posée sur une balise vide juste avant le
 * titre. Le prompt l'exige, et pour une raison concrète : des liens vers
 * ces ancres sont déjà enregistrés, dans des corrections de QCM comme dans
 * les favoris de qui révise. Un identifiant stable ne vaut rien s'il casse
 * ce qui pointait vers l'ancien.
 */
export function poserLesIdentifiants(html, parties) {
  let i = 0;
  return html.replace(/<h([23])\s+id="([^"]+)"([^>]*)>/g, (entier, niveau, ancre, reste) => {
    const partie = parties[i];
    i += 1;
    if (!partie?.id || partie.id === ancre) return entier;
    return (
      `<span id="${ancre}" class="ancre-ancienne" aria-hidden="true"></span>` +
      `<h${niveau} id="${partie.id}"${reste}>`
    );
  });
}
