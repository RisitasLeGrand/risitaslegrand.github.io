/**
 * LES FORMULES MATHÉMATIQUES DES FICHES, RENDUES AU BUILD.
 *
 * ## Ce qui est rendu, et quand
 *
 * Le rendu se fait à la CONSTRUCTION, jamais dans le navigateur. Le site ne
 * reçoit donc pas les 268 Ko de JavaScript de KaTeX : il reçoit du MathML déjà
 * calculé, 28 Ko de feuille de style et les polices. C'est aussi ce qui rend le
 * hors-ligne gratuit — il n'y a rien à charger pour qu'une formule s'affiche.
 *
 * ## Pourquoi pas « remark-math », qui existe pourtant
 *
 * Deux raisons, et la seconde suffirait. D'abord il faudrait DEUX dépendances
 * de plus — « remark-math » et « rehype-katex » — alors que le chantier n'en
 * autorise qu'une, KaTeX. Ensuite « remark-math » impose « $…$ », et ce
 * délimiteur est inutilisable ici : le contenu porte 158 « $ » monétaires
 * — « 20 000 Md$ », « 710 M$ » —, qui s'apparieraient deux à deux à travers du
 * texte sans rapport. « dette 20 000 Md$ (2016) → 32 000 Md$ » donnerait une
 * « formule » contenant « (2016) → 32 000 Md ».
 *
 * ## Pourquoi pas « \(…\) » non plus, qui était le premier choix
 *
 * Parce que Markdown le MANGE. « \( » y est une échappée de caractère, et
 * « \(\sqrt{2}\) » arrive dans l'arbre sous la forme « (\sqrt{2}) » : les
 * antislashs des délimiteurs sont consommés, et une formule devient
 * indiscernable d'une parenthèse ordinaire. Mesuré avec le lecteur du projet
 * avant d'écrire une ligne. La même mécanique vaut pour « \[…\] », ce qui
 * explique au passage que les 100 ellipses de citation du contenu — « avenir
 * \[…\] la suite » — fonctionnent déjà exactement comme leur auteur le voulait.
 *
 * ## Les deux délimiteurs retenus, et ce qui les rend sûrs
 *
 * Les accents graves. Ce qu'ils entourent traverse Markdown VERBATIM, si bien
 * que « \frac{a}{b} \leq 1 » arrive intact là où toute syntaxe à antislash nu
 * se fait mordre. Zéro occurrence des deux formes dans le contenu actuel.
 *
 *   - en ligne : `math:\sqrt{2}` — un nœud « inlineCode » unique, donc une
 *     détection LOCALE. La convention de GitHub, « $`…`$ », marcherait aussi,
 *     mais elle oblige à inspecter le frère de gauche et celui de droite et à
 *     les amputer de leur « $ » : trois fois plus de surface où se tromper,
 *     pour le seul gain de s'afficher sur GitHub — où personne ne lira ces
 *     fiches, « content/ » n'étant jamais commité ;
 *   - hors ligne : un bloc ```math.
 *
 * ## Le HTML d'auteur reste détruit, et c'est vérifié
 *
 * Le pipeline emploie « remarkRehype » SANS « allowDangerousHtml », exprès :
 * un « <script> » écrit à la main dans une fiche doit mourir. Faire passer le
 * rendu de KaTeX demande « allowDangerousHtml », mais sur la SEULE sortie,
 * « rehypeStringify ». La garantie tient, et elle est éprouvée par
 * « essais:maths » : avec cette option, une balise script, un « onerror= », un
 * commentaire HTML et un « <b> » écrits dans le Markdown sont tous détruits
 * comme avant. La raison est que le HTML d'auteur meurt en AMONT, au passage
 * remark→rehype, et que seul ce qu'on fabrique soi-même en « hChildren »
 * survit jusqu'à la sortie.
 *
 * KaTeX tourne en outre avec « trust: false » — donc sans « \href », « \url »
 * ni « \includegraphics » — et « strict: 'error' », qui refuse les constructions
 * douteuses au lieu de les deviner.
 */
import katex from 'katex';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

/**
 * Le préfixe d'une formule en ligne.
 *
 * Une constante, et une seule, pour que le choix se change en un endroit.
 */
export const PREFIXE_EN_LIGNE = 'math:';

/** Le langage d'un bloc hors ligne. */
export const LANGAGE_BLOC = 'math';

/*
   Les options de rendu, identiques partout.

   « throwOnError » est le cœur du contrôle : une formule qui ne compile pas
   doit arrêter la construction, et non s'afficher en rouge sur l'écran d'une
   personne qui révise. « output: htmlAndMathml » donne les deux — le MathML
   pour les lecteurs d'écran et les navigateurs qui le rendent, le HTML pour la
   mise en forme fine —, et KaTeX marque lui-même la partie visuelle
   « aria-hidden » afin qu'elle ne soit pas lue deux fois.
*/
const OPTIONS = {
  output: 'htmlAndMathml',
  throwOnError: true,
  trust: false,
  strict: 'error',
};

/**
 * Rend une formule, ou lève une erreur qui nomme la formule fautive.
 *
 * Le message de KaTeX seul — « Unexpected end of input in a macro argument » —
 * ne dit pas QUELLE formule, et c'est insuffisant dans un corpus de plusieurs
 * milliers de textes. On le rhabille.
 */
export function rendreFormule(tex, { bloc = false } = {}) {
  const source = String(tex ?? '').trim();
  if (!source) throw new Error('formule vide');
  try {
    return katex.renderToString(source, { ...OPTIONS, displayMode: bloc });
  } catch (erreur) {
    const quoi = erreur?.message ?? String(erreur);
    throw new Error(`« ${source.slice(0, 90)} » ne compile pas — ${quoi}`);
  }
}

/**
 * Le greffon remark qui remplace les formules par leur rendu.
 *
 * Le rendu part en « data.hChildren » sous forme de nœud brut : c'est le seul
 * chemin qui traverse « remarkRehype » sans qu'on ait à y ouvrir la porte au
 * HTML d'auteur.
 */
export function remarkMaths() {
  return (arbre) => {
    /*
       Hors ligne : un bloc de code dont le langage est « math ».

       Le nœud est REMPLACÉ, et non rhabillé. Poser « hName » sur un nœud
       « code » ne suffit pas : la conversion vers hast fabrique un
       « <pre><code> », et l'on obtenait « <pre><div class="maths"> » — du HTML
       invalide, dans lequel les règles d'espaces de « pre » auraient de plus
       disloqué la mise en forme de KaTeX. Un type de nœud inconnu portant
       « hName » et « hChildren » produit l'élément unique qu'on veut.
    */
    visit(arbre, 'code', (noeud, i, parent) => {
      if (noeud.lang !== LANGAGE_BLOC) return;
      if (!parent || typeof i !== 'number') return;
      const html = rendreFormule(noeud.value, { bloc: true });
      parent.children[i] = {
        type: 'mathsCyclades',
        data: {
          hName: 'div',
          hProperties: { className: ['maths', 'maths-bloc'] },
          hChildren: [{ type: 'raw', value: html }],
        },
      };
    });

    /* En ligne : un code dont la valeur commence par le préfixe. */
    visit(arbre, 'inlineCode', (noeud) => {
      if (!noeud.value.startsWith(PREFIXE_EN_LIGNE)) return;
      const html = rendreFormule(noeud.value.slice(PREFIXE_EN_LIGNE.length), { bloc: false });
      noeud.data = {
        ...(noeud.data ?? {}),
        hName: 'span',
        hProperties: { className: ['maths', 'maths-en-ligne'] },
        hChildren: [{ type: 'raw', value: html }],
      };
    });
  };
}

/**
 * Les formules d'un Markdown, sans le rendre.
 *
 * Sert au contrôle de contenu, qui doit pouvoir nommer une formule fautive
 * sans avoir à construire le site, et au script parlé, qui doit savoir qu'il
 * en rencontre une.
 */
export function formulesDe(arbre) {
  const trouvees = [];
  /*
     Un seul parcours, pour rendre les formules dans l'ORDRE DU TEXTE.

     Deux parcours successifs — les blocs puis les formules en ligne — les
     rendaient groupées par type, ce qui est inutilisable pour les deux
     appelants : un message de contrôle doit pouvoir dire « la troisième
     formule de la fiche », et une voix doit les rencontrer dans l'ordre où
     elle lit.
  */
  visit(arbre, (n) => {
    if (n.type === 'code' && n.lang === LANGAGE_BLOC) {
      trouvees.push({ tex: n.value.trim(), bloc: true });
    } else if (n.type === 'inlineCode' && n.value.startsWith(PREFIXE_EN_LIGNE)) {
      trouvees.push({ tex: n.value.slice(PREFIXE_EN_LIGNE.length).trim(), bloc: false });
    }
  });
  return trouvees;
}

/**
 * Les fautes de formule d'un Markdown, sans rien rendre.
 *
 * Pour « check-content », qui doit nommer la formule ET le fichier sans avoir
 * à construire le site. Rend une liste de phrases de reproche, vide si tout
 * compile. Ne lève pas : un contrôle qui s'interrompt à la première faute
 * oblige à vingt passages pour corriger vingt fiches.
 */
export function fautesDeFormule(markdown) {
  if (!markdown?.trim()) return [];
  let arbre;
  try {
    arbre = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  } catch (e) {
    return [`Markdown illisible — ${e?.message ?? e}`];
  }
  const fautes = [];
  formulesDe(arbre).forEach(({ tex, bloc }, rang) => {
    try {
      rendreFormule(tex, { bloc });
    } catch (e) {
      fautes.push(`formule ${rang + 1} (${bloc ? 'bloc' : 'en ligne'}) : ${e.message}`);
    }
  });
  return fautes;
}

/*
   CE QU'UNE VOIX DOIT DIRE D'UNE FORMULE.

   Un script parlé ne doit JAMAIS lire du LaTeX brut : « backslash frac
   ouvrez l'accolade a fermez l'accolade » n'apprend rien et perd l'auditeur.

   La table ci-dessous couvre ce que les fiches emploient réellement. Elle est
   volontairement courte : une formule qu'on ne sait pas dire est RETIRÉE et
   SIGNALÉE, ce qui est honnête, plutôt que lue de travers. Mieux vaut « une
   formule est écrite ici, à lire à l'écran » qu'une suite de sons faux.
*/
const MOTS = [
  [/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1 sur $2'],
  [/\\dfrac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1 sur $2'],
  [/\\sqrt\s*\{([^{}]+)\}/g, 'racine carrée de $1'],
  [/\\times/g, 'fois'],
  [/\\div/g, 'divisé par'],
  [/\\leq/g, 'inférieur ou égal à'],
  [/\\geq/g, 'supérieur ou égal à'],
  [/\\neq/g, 'différent de'],
  [/\\approx/g, 'environ égal à'],
  [/\\pm/g, 'plus ou moins'],
  [/\\%|\\?%/g, 'pour cent'],
  [/\^\s*\{?2\}?/g, ' au carré'],
  [/\^\s*\{?3\}?/g, ' au cube'],
  [/\^\s*\{?([^{}\s]+)\}?/g, ' puissance $1'],
  [/_\s*\{?([^{}\s]+)\}?/g, ' indice $1'],
  [/\\sum/g, 'somme'],
  [/\\cdot/g, 'fois'],
  [/\\left|\\right/g, ''],
];

/**
 * La formule, dite en français — ou le constat qu'on ne sait pas la dire.
 *
 * Rend `{ dit }` quand la traduction est complète, et `{ retiree, raison }`
 * quand il reste du LaTeX après passage : dans ce cas l'appelant doit retirer
 * la formule du script et le DIRE, jamais la lire telle quelle.
 */
export function direLaFormule(tex) {
  let phrase = String(tex ?? '').trim();
  if (!phrase) return { retiree: true, raison: 'formule vide' };
  for (const [motif, remplacement] of MOTS) phrase = phrase.replace(motif, remplacement);
  phrase = phrase
    .replace(/[{}]/g, ' ')
    .replace(/\s*=\s*/g, ' égale ')
    .replace(/\s*\+\s*/g, ' plus ')
    .replace(/\s+/g, ' ')
    .trim();
  /*
     Le contrôle décisif : s'il reste un antislash ou un accent circonflexe,
     c'est qu'une construction nous a échappé. On préfère l'avouer.
  */
  if (/[\\^_]/.test(phrase)) {
    return {
      retiree: true,
      raison: `construction non lue dans « ${String(tex).slice(0, 60)} »`,
    };
  }
  return { dit: phrase };
}
