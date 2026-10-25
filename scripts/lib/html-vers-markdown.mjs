/**
 * Reconvertir en Markdown le HTML d'une fiche publiée.
 *
 * ## Pourquoi ce module existe, et pourquoi il est modeste
 *
 * Le site ne publie pas les sources : il publie le HTML rendu. Récupérer le
 * corpus depuis une publication, c'est donc remonter le courant — et remonter
 * un courant ne rend jamais exactement l'eau de départ.
 *
 * Ce module fait donc le chemin inverse pour le **vocabulaire que le build
 * produit** (remark-gfm), et pas davantage. Tout ce qu'il ne sait pas traduire
 * est **recopié tel quel**, en HTML, au lieu d'être deviné : du HTML dans un
 * Markdown reste du HTML après un nouveau rendu, donc la page reste juste.
 * Une traduction approximative, elle, abîmerait le texte de quelqu'un.
 *
 * ## Ce qui le rend sûr
 *
 * Il n'est jamais cru sur parole. `recuperer-corpus.mts` **re-rend** le
 * Markdown qu'il produit avec le convertisseur du build, et compare au HTML
 * publié. Quand les deux ne coïncident pas, la fiche est écrite en HTML brut
 * et comptée comme telle dans le rapport. Aucune fiche n'est dégradée en
 * silence : c'est la seule garantie qui vaille quand on tient l'unique
 * exemplaire d'un corpus.
 *
 * Aucune dépendance nouvelle : le dépôt n'a pas de chemin HTML → Markdown
 * installé (`rehype-parse` et `hast-util-to-mdast` sont absents), et en
 * ajouter un est interdit.
 */

/** Les entités que le rendu produit, et leur caractère. */
const ENTITES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

export function decoderEntites(texte) {
  return texte
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (e) => ENTITES[e] ?? e);
}

/**
 * Un paragraphe qui commencerait comme un bloc.
 *
 * « 1965. L'arrêt… » est un paragraphe dans la source ; relu en Markdown,
 * c'est le premier item d'une liste numérotée. Le même piège vaut pour une
 * ligne ouverte par « # », « - », « > » ou « | ». On échappe le seul
 * caractère fautif, celui du début.
 */
function proteger(texte) {
  /*
     CHAQUE LIGNE, ET PAS SEULEMENT LA PREMIÈRE.

     Un paragraphe publié peut contenir des retours à la ligne : « PIB = … +
     formation brute de capital fixe + variation de stock ». Protégé sur sa
     seule première ligne, il repartait en liste à puces au rendu suivant,
     parce que « + » ouvre un item. Mesuré sur le corpus réel.
  */
  return texte
    .split('\n')
    .map((ligne) =>
      ligne
        /*
           « \\1997) » NE S'ÉCRIT PAS : en CommonMark, le contre-oblique
           n'échappe que la ponctuation ASCII. Devant un chiffre il reste
           littéral, et c'est un contre-oblique VISIBLE qui s'ajoutait au
           texte de la fiche. On échappe donc le point ou la parenthèse, qui
           est bien de la ponctuation, et le marqueur ne vaut plus marqueur.
           Mesuré sur le corpus réel.
        */
        .replace(/^(\s*)(\d+)([.)])(\s)/, (_, blanc, chiffres, ponctuation, apres) =>
          `${blanc}${chiffres}\\${ponctuation}${apres}`)
        .replace(/^(\s*)(#{1,6}\s|[-+*>]\s|\|)/, (_, blanc, d) => `${blanc}\\${d}`))
    .join('\n');
}

/** Les caractères qu'un Markdown doit protéger pour se relire à l'identique. */
function echapper(texte) {
  return texte.replace(/([\\`*_[\]])/g, '\\$1');
}

/* ══════════════════════════════════════════════════════════════════════════
   Un arbre, et rien de plus
   ══════════════════════════════════════════════════════════════════════════ */

const AUTOFERMANTES = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

/**
 * Découpe le HTML en arbre.
 *
 * Volontairement naïf : le HTML traité vient d'un générateur, pas du web. Il
 * est bien formé, sans attribut non cité ni balise non fermée. Un analyseur
 * complet serait une dépendance ; celui-ci tient en trente lignes et ce qu'il
 * ne comprend pas finit en HTML brut, ce qui est le comportement voulu.
 */
export function analyser(html) {
  const racine = { tag: null, enfants: [] };
  const pile = [racine];
  const jetons = html.matchAll(/<\/?([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*?)\/?>|([^<]+)/gi);
  for (const jeton of jetons) {
    const [brut, tag, attributs, texte] = jeton;
    const sommet = pile[pile.length - 1];
    if (texte !== undefined) {
      sommet.enfants.push({ texte });
      continue;
    }
    if (brut.startsWith('</')) {
      const nom = tag.toLowerCase();
      /* On ne dépile que si la balise correspond : un HTML mal formé ne doit
         pas faire remonter l'arbre au-dessus de sa racine. */
      for (let i = pile.length - 1; i > 0; i--) {
        if (pile[i].tag === nom) {
          pile.length = i;
          break;
        }
      }
      continue;
    }
    const nom = tag.toLowerCase();
    const nœud = { tag: nom, attributs: lireAttributs(attributs ?? ''), enfants: [], brut };
    sommet.enfants.push(nœud);
    if (!AUTOFERMANTES.has(nom) && !brut.endsWith('/>')) pile.push(nœud);
  }
  return racine;
}

function lireAttributs(source) {
  const sortie = {};
  for (const [, nom, valeur] of source.matchAll(/([a-z-]+)\s*=\s*"([^"]*)"/gi)) {
    sortie[nom.toLowerCase()] = decoderEntites(valeur);
  }
  return sortie;
}

/* ══════════════════════════════════════════════════════════════════════════
   L'arbre, rendu en Markdown
   ══════════════════════════════════════════════════════════════════════════ */

/** Les balises qui font un bloc à l'intérieur d'un item de liste. */
const EN_BLOC = new Set([
  'p', 'ul', 'ol', 'blockquote', 'table', 'pre', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

/** Les balises dont ce module sait rendre l'équivalent Markdown. */
const CONNUES = new Set([
  'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i',
  'code', 'pre', 'blockquote', 'a', 'br', 'hr', 'del', 's',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'dfn', 'span',
]);

/** Ce que ce module n'a pas su traduire, pour le rapport. */
export const inconnuesRencontrees = new Set();

/**
 * Les identifiants de partie que la source déclarait.
 *
 * Le build les retire du Markdown avant le rendu et les repose sur le HTML ;
 * rien, dans le HTML seul, ne distingue un identifiant écrit à la main d'une
 * ancre calculée depuis le titre. La charge utile de la fiche, elle, le dit :
 * son champ `parties` porte `declare: true`. L'appelant nous passe donc la
 * liste, et nous ne réécrivons « {#…} » que là où la source l'avait.
 */
let idsDeclares = new Set();

/**
 * Comment rendre les listes : « auto », « toujours » ou « jamais » espacées.
 *
 * Une liste publiée peut être MIXTE — certains items en `<li>texte</li>`,
 * d'autres en `<li><p>texte</p></li>` — et aucune écriture Markdown uniforme
 * ne redonne ce mélange. Plutôt que de deviner la règle de `remark`, on
 * propose les trois écritures et c'est la vérification par nouveau rendu qui
 * tranche : celle qui redonne le HTML publié est la bonne, par construction.
 */
let listesEspacees = 'auto';

/** L'unique enfant signifiant d'un nœud, ou `null` : le blanc ne compte pas. */
function enfantUnique(n) {
  const signifiants = (n.enfants ?? []).filter(
    (e) => e.tag !== undefined || (e.texte ?? '').trim() !== '',
  );
  return signifiants.length === 1 ? signifiants[0] : null;
}

function enLigne(nœuds) {
  return nœuds.map((n) => rendreEnLigne(n)).join('');
}

function rendreEnLigne(n) {
  if (n.texte !== undefined) return echapper(decoderEntites(n.texte));
  switch (n.tag) {
    /*
       L'ORDRE D'IMBRICATION DE L'EMPHASE, ET POURQUOI « _ » APPARAÎT ICI.

       Mesuré sur le corpus réel : 81 sections sur 87 divergeaient pour cette
       seule raison. `<strong><em>X</em></strong>` donnait `***X***`, et
       `remark` relit `***X***` comme `<em><strong>X</strong></em>` —
       l'imbrication s'inverse. Le texte rendu se ressemble, l'arbre non, et
       la vérification par nouveau rendu le refusait à juste titre.

       Deux délimiteurs distincts lèvent l'ambiguïté : `**_X_**` se relit
       strong-dans-em, `_**X**_` l'inverse. On ne se sert de « _ » QUE dans ce
       cas d'imbrication — en CommonMark, « _ » ne marque pas l'emphase au
       milieu d'un mot, et l'employer partout casserait « d'_un_ ».
    */
    case 'strong':
    case 'b': {
      const seul = enfantUnique(n);
      if (seul && (seul.tag === 'em' || seul.tag === 'i')) {
        return `**_${enLigne(seul.enfants)}_**`;
      }
      return `**${enLigne(n.enfants)}**`;
    }
    case 'em':
    case 'i': {
      const seul = enfantUnique(n);
      if (seul && (seul.tag === 'strong' || seul.tag === 'b')) {
        return `_**${enLigne(seul.enfants)}**_`;
      }
      return `*${enLigne(n.enfants)}*`;
    }
    case 'del':
    case 's':
      return `~~${enLigne(n.enfants)}~~`;
    case 'code':
      return `\`${texteNu(n)}\``;
    case 'br':
      return '\n';
    case 'a':
      return `[${enLigne(n.enfants)}](${n.attributs.href ?? ''})`;
    /*
       LE SOULIGNEMENT DU GLOSSAIRE EST DÉFAIT, PAS TRADUIT.

       `<dfn data-terme="…">` n'existe pas dans la source : c'est le greffon
       `remarkGlossaire` qui l'ajoute au rendu, terme par terme, et il le
       rajoutera au prochain build. Le garder dans le Markdown récupéré
       écrirait dans la fiche une décoration que la fiche n'a jamais portée —
       et au build suivant, le greffon soulignerait à l'intérieur de son
       propre soulignement.
    */
    case 'dfn':
      return enLigne(n.enfants);
    default:
      inconnuesRencontrees.add(n.tag);
      return rendreBrut(n);
  }
}

/** Le texte nu d'un nœud, entités décodées, sans aucun balisage. */
export function texteNu(n) {
  if (n.texte !== undefined) return decoderEntites(n.texte);
  return n.enfants.map(texteNu).join('');
}

/** Le HTML d'origine d'un nœud, recopié sans y toucher. */
function rendreBrut(n) {
  if (n.texte !== undefined) return n.texte;
  const dedans = n.enfants.map(rendreBrut).join('');
  if (AUTOFERMANTES.has(n.tag)) return n.brut;
  return `${n.brut}${dedans}</${n.tag}>`;
}

function rendreBloc(n, profondeur = 0) {
  if (n.texte !== undefined) {
    const nu = decoderEntites(n.texte).trim();
    return nu ? echapper(nu) : '';
  }
  switch (n.tag) {
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const niveau = '#'.repeat(Number(n.tag[1]));
      /*
         L'identifiant revient dans le Markdown, sous la forme « {#…} » que le
         build y lit. Sans lui, un nouveau rendu en calculerait un autre, et
         tous les liens d'ancre — le sommaire, les repères audio — pointeraient
         à côté.
      */
      const ancre = idsDeclares.has(n.attributs.id) ? ` {#${n.attributs.id}}` : '';
      return `${niveau} ${enLigne(n.enfants).trim()}${ancre}`;
    }
    case 'p':
      return proteger(enLigne(n.enfants).trim());
    case 'blockquote':
      return n.enfants
        .map((e) => rendreBloc(e, profondeur))
        .filter(Boolean)
        .join('\n\n')
        .split('\n')
        .map((l) => `> ${l}`.trimEnd())
        .join('\n');
    case 'ul':
    case 'ol': {
      const ordonnee = n.tag === 'ol';
      const items = n.enfants.filter((e) => e.tag === 'li');
      /*
         `start` EST UNE INFORMATION, PAS UNE DÉCORATION.

         Une énumération qui reprend à 3 — parce qu'un paragraphe l'a
         interrompue — se republiait en repartant de 1. Le lecteur y perdait
         le fil d'un plan en six points, et le nouveau rendu le signalait.
      */
      const depart = Number(n.attributs.start ?? 1) || 1;
      /*
         LISTE « ESPACÉE » OU « SERRÉE », ET LA LIGNE VIDE QUI LES SÉPARE.

         `remark` rend `- a\n- b` en `<li>a</li>`, et `- a\n\n- b` en
         `<li><p>a</p></li>`. La publication dit donc laquelle était écrite :
         un `<p>` dans un item signifie liste espacée. Sans cette ligne vide,
         une liste espacée se republiait serrée — même texte, arbre différent,
         et la vérification refusait la section.
      */
      const espacee =
        listesEspacees === 'toujours'
          ? true
          : listesEspacees === 'jamais'
            ? false
            : items.some((i) => i.enfants.some((e) => e.tag === 'p'));
      return items
        .map((item, rang) => {
          const puce = ordonnee ? `${rang + depart}.` : '-';
          const marge = ' '.repeat(puce.length + 1);
          /*
             UN ITEM PEUT CONTENIR DES BLOCS, ET PAS SEULEMENT DU TEXTE.

             `remark-gfm` rend une liste « espacée » en `<li><p>…</p></li>`, et
             un item peut porter une citation, un tableau, plusieurs
             paragraphes. Traités en ligne, ils passaient en HTML brut — donc
             jetés au rendu suivant, laissant des `<li></li>` vides. Mesuré sur
             le corpus réel.
          */
          const blocs = [];
          let enCours = [];
          const viderEnCours = () => {
            const texte = enLigne(enCours).trim();
            enCours = [];
            if (texte) blocs.push(texte);
          };
          for (const enfant of item.enfants) {
            if (enfant.tag && EN_BLOC.has(enfant.tag)) {
              viderEnCours();
              const rendu = rendreBloc(enfant, profondeur + 1).trim();
              if (rendu) blocs.push(rendu);
            } else {
              enCours.push(enfant);
            }
          }
          viderEnCours();
          const corps = blocs.join('\n\n') || '';
          /* La marge ne se pose pas sur une ligne vide : elle y laisserait des
             blancs en fin de ligne, que certains outils retirent et d'autres
             non — une différence invisible qui fait diverger un essai. */
          const indente = corps
            .split('\n')
            .map((l, i) => (i === 0 || l === '' ? l : marge + l))
            .join('\n');
          return `${puce} ${indente}`;
        })
        .join(espacee ? '\n\n' : '\n');
    }
    case 'pre': {
      const code = n.enfants.find((e) => e.tag === 'code') ?? n;
      const langue = (code.attributs?.class ?? '').replace(/^language-/, '');
      return `\`\`\`${langue}\n${texteNu(code).replace(/\n$/, '')}\n\`\`\``;
    }
    /*
       LES TABLEAUX GFM.

       Oubliés d'abord, et c'est l'aller-retour qui l'a dit : une fiche dont
       la synthèse tenait dans un tableau comparatif revenait avec le tableau
       recopié en HTML brut — donc, après un nouveau rendu, SANS le tableau,
       parce que `remark-rehype` tourne sans `allowDangerousHtml` et jette le
       HTML écrit à la main. La section entière disparaissait de la page.

       `remark-gfm` est dans la chaîne de rendu : un tableau en pipes se
       retraduit donc exactement.
    */
    case 'table':
      return rendreTableau(n);
    case 'hr':
      return '---';
    /*
       L'ancienne ancre est jetée. `poserLesIdentifiants` la pose à côté du
       titre pour que les liens d'hier tombent encore juste ; elle se déduit
       du texte du titre, et le prochain build la reposera à l'identique.
       La recopier dans la source la figerait, et un titre corrigé se
       retrouverait avec deux ancres mortes au lieu d'une vivante.
    */
    case 'span':
      if ((n.attributs.class ?? '').includes('ancre-ancienne')) return '';
      inconnuesRencontrees.add('span');
      return rendreBrut(n);
    default:
      if (!CONNUES.has(n.tag)) inconnuesRencontrees.add(n.tag);
      return rendreBrut(n);
  }
}

/**
 * Un tableau GFM, reconstruit en pipes.
 *
 * L'alignement déclaré (`style="text-align:…"`, ce que `remark-gfm` pose) est
 * rendu dans la ligne de séparation. Sans lui, un tableau de chiffres alignés
 * à droite reviendrait aligné à gauche : la page reste juste, mais elle ne se
 * relit plus de la même façon, et c'est une information que quelqu'un avait
 * écrite exprès.
 */
function rendreTableau(n) {
  const lignes = [];
  const alignements = [];
  const parcourir = (nœud) => {
    for (const enfant of nœud.enfants ?? []) {
      if (enfant.tag === 'tr') {
        const cellules = enfant.enfants.filter((c) => c.tag === 'th' || c.tag === 'td');
        if (!lignes.length) {
          for (const c of cellules) {
            const style = c.attributs?.style ?? '';
            alignements.push(
              /text-align:\s*center/.test(style)
                ? ':---:'
                : /text-align:\s*right/.test(style)
                  ? '---:'
                  : /text-align:\s*left/.test(style)
                    ? ':---'
                    : '---',
            );
          }
        }
        /* Une barre verticale DANS une cellule couperait la cellule en deux :
           elle s'échappe, et c'est le seul échappement propre aux tableaux. */
        lignes.push(cellules.map((c) => enLigne(c.enfants).trim().replace(/\|/g, '\\|')));
      } else if (enfant.tag === 'thead' || enfant.tag === 'tbody') {
        parcourir(enfant);
      }
    }
  };
  parcourir(n);
  if (!lignes.length) return '';
  const [entete, ...corps] = lignes;
  return [
    `| ${entete.join(' | ')} |`,
    `| ${alignements.join(' | ')} |`,
    ...corps.map((l) => `| ${l.join(' | ')} |`),
  ].join('\n');
}

/** Rend en Markdown le HTML d'une section de fiche. */
export function htmlVersMarkdown(html, options = {}) {
  inconnuesRencontrees.clear();
  idsDeclares = new Set(options.idsDeclares ?? []);
  listesEspacees = options.listesEspacees ?? 'auto';
  const arbre = analyser(html);
  const blocs = arbre.enfants
    .map((n) => rendreBloc(n))
    .map((b) => b.trim())
    .filter(Boolean);
  return { markdown: blocs.join('\n\n') + '\n', inconnues: [...inconnuesRencontrees] };
}
