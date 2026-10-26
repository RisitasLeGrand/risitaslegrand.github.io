/**
 * Où la forme « jour(s) » se cache dans une source — G4 du 61.
 *
 * ## Pourquoi cette règle est partagée, et non recopiée
 *
 * C'est la leçon de `lib/sans-commentaires.mjs`, et elle vaut ici pour la
 * même raison : deux outils ont besoin de ce repérage — l'essai qui REFUSE la
 * forme, et l'inventaire qui la liste pour qu'on la corrige fichier par
 * fichier. Deux copies finiraient par diverger, et l'inventaire dirait alors
 * autre chose que le refus.
 *
 * ## Ce qu'il regarde, et ce qu'il laisse tranquille
 *
 * Le TEXTE seulement, hors commentaires : les chaînes du code, et le texte
 * d'un balisage. Un commentaire qui parle de la forme interdite n'est pas une
 * infraction, et `tableau.filter((s) => …)` n'est pas une phrase. Un contrôle
 * qui accuse à tort se fait désactiver, et c'est ainsi qu'on perd un
 * garde-fou.
 *
 * ## Et ce qu'il fait quand il se perd — la leçon du 26 octobre
 *
 * La première version lisait tout fichier comme du JavaScript. Dans
 * `planification/index.astro`, l'apostrophe d'un « Aujourd'hui » de BALISAGE,
 * à la ligne 96, ouvrait donc une chaîne qui ne se fermait plus : les cent
 * lignes suivantes passaient pour du texte, et les suivantes pour du code.
 * `echelles.astro` en sortait à ZÉRO site alors qu'il en portait sept, dont
 * trois dans une phrase affichée.
 *
 * Deux enseignements, et le second compte plus que le premier :
 *
 * 1. un `.astro` n'est pas du JavaScript. Hors frontmatter et hors `<script>`,
 *    une apostrophe est une lettre ;
 * 2. **un balayage qui se perd doit le dire.** Le pire n'était pas l'erreur,
 *    c'était le silence : un fichier entier devenu invisible, et un compteur à
 *    zéro qui ressemblait à une bonne nouvelle. La machine rend donc ses
 *    DÉSYNCHRONISATIONS — pile non refermée, fermeture sans ouverture —, et
 *    l'essai les refuse au lieu de les compter vertes.
 */
import { AVANT_UNE_REGEX, finDUneRegex, regions, sansCommentaires } from './sans-commentaires.mjs';

/** Une lettre collée à « (s) » ou « (es) » : `jour(s)`, `écrit(es)`. */
export const COLLE = /\p{L}\((s|es)\)/gu;

/**
 * Une chaîne réduite à la forme interdite.
 *
 * Ce second motif ferme un contournement : `` `${mot}${n > 1 ? '(s)' : ''}` ``
 * assemble la forme à l'exécution, et le premier motif n'y verrait rien.
 */
export const SEULE = /^\s*\((s|es)\)\s*$/;

/* ══════════════════════════════════════════════════════════════════════════
   La machine : du texte, du code, et la frontière entre les deux
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les morceaux de TEXTE d'une région, avec leur ligne de départ.
 *
 * ## Un seul passage, et l'état traverse les lignes
 *
 * La version ligne à ligne s'est fait prendre deux fois : un gabarit sur
 * plusieurs lignes échappait entièrement — le guillemet ouvrant est à la
 * première ligne, les suivantes n'en portent aucun —, et une chaîne IMBRIQUÉE
 * dans une interpolation passait aussi. D'où un passage unique, avec une pile.
 *
 * ## Les états, et pourquoi il en faut deux pour le code
 *
 * - `texte` — du balisage affiché. Tout est texte ; `<` ouvre une balise, `{`
 *   une expression ;
 * - `balise` — entre `<` et `>`. Les valeurs d'attributs sont du texte LU PAR
 *   QUELQU'UN (`title`, `aria-label`), donc les guillemets y comptent ;
 * - `js` — du JavaScript franc. Ni `<` ni `>` ni `{` n'y veulent dire quoi que
 *   ce soit : `a < b` est une comparaison, et prendre son `<` pour une balise
 *   perdrait tout ce qui suit ;
 * - `expr` — du code DANS du balisage, entre `{` et `}`. Ici `<` peut rouvrir
 *   une balise : c'est ainsi que la phrase du PHQ-9 vit, sous un
 *   `{e.id === 'phq9' && (<fieldset>…)}` ;
 * - `'`, `"`, `` ` `` — une chaîne, où seule la clôture et l'échappement
 *   comptent, et où `${` rend la main au code.
 *
 * Ce n'est pas un analyseur de TypeScript et ça ne cherche pas à l'être. On ne
 * lui demande que de distinguer le texte du code — et, quand elle n'y arrive
 * plus, de le dire.
 */
function machine(source, base, ligneDepart) {
  const morceaux = [];
  const anomalies = [];
  const pile = [base];
  /* La ligne où chaque état a été ouvert : sans elle, une désynchronisation
     ne se signale qu'à la fin de la région, et il faut la chercher à la main. */
  const ouvertures = [ligneDepart];
  let i = 0;
  let ligne = ligneDepart;
  let debutLigne = ligneDepart;
  let debutBalise = 0;
  let courant = '';

  const fermer = () => {
    if (courant.trim()) morceaux.push({ ligne: debutLigne, texte: courant });
    courant = '';
  };
  const empiler = (etat) => {
    pile.push(etat);
    ouvertures.push(ligne);
  };
  const depilerBrut = () => {
    ouvertures.pop();
    return pile.pop();
  };
  const depiler = (attendu, quoi) => {
    if (pile[pile.length - 1] !== attendu) {
      anomalies.push({ ligne, quoi });
      return false;
    }
    depilerBrut();
    return true;
  };

  while (i < source.length) {
    const c = source[i];
    const dedans = pile[pile.length - 1];
    if (c === '\n') ligne += 1;

    /* ---- Dans une chaîne ---- */
    if (dedans === "'" || dedans === '"' || dedans === '`') {
      if (c === '\\') {
        courant += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === dedans) {
        fermer();
        depilerBrut();
        i += 1;
        continue;
      }
      if (dedans === '`' && source.slice(i, i + 2) === '${') {
        fermer();
        empiler('js');
        i += 2;
        continue;
      }
      courant += c;
      i += 1;
      continue;
    }

    /* ---- Dans du texte de balisage ---- */
    if (dedans === 'texte') {
      if (c === '<' && /[A-Za-z/!]/.test(source[i + 1] ?? '')) {
        fermer();
        empiler('balise');
        debutBalise = i;
        i += 1;
        continue;
      }
      if (c === '{') {
        fermer();
        empiler('expr');
        i += 1;
        continue;
      }
      /*
         Un `}` ici referme l'expression qui a ouvert ce balisage : c'est la
         sortie d'un `{cond && (<p>…</p>)}`. S'il n'y a pas d'expression
         en dessous, c'est une accolade de texte, et elle reste du texte.
      */
      if (c === '}' && pile[pile.length - 2] === 'expr') {
        fermer();
        depilerBrut();
        depilerBrut();
        i += 1;
        continue;
      }
      if (!courant) debutLigne = ligne;
      courant += c;
      i += 1;
      continue;
    }

    /* ---- Entre `<` et `>` ---- */
    if (dedans === 'balise') {
      if (c === '>') {
        const balise = source.slice(debutBalise, i);
        depiler('balise', 'fermeture de balise');
        debutLigne = ligne;
        /*
           Une balise OUVRANTE rencontrée dans une expression fait reprendre le
           balisage : ses enfants sont du texte. Une balise fermante ou
           autoporteuse, non — on resterait sinon dans un texte qui n'existe
           pas.
        */
        const ouvrante = !balise.startsWith('</') && !balise.endsWith('/') && !balise.startsWith('<!');
        if (ouvrante && pile[pile.length - 1] === 'expr') empiler('texte');
        i += 1;
        continue;
      }
      if (c === '{') {
        empiler('expr');
        i += 1;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        empiler(c);
        debutLigne = ligne;
        courant = '';
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    /* ---- Du code : `js` franc, ou `expr` dans du balisage ---- */
    if (c === '}') {
      if (dedans === 'js' && pile.length > 1) {
        /* La fin d'une interpolation `${…}` : la chaîne reprend. */
        depilerBrut();
        debutLigne = ligne;
        i += 1;
        continue;
      }
      if (dedans === 'expr') {
        depiler('expr', 'fermeture d’expression');
        debutLigne = ligne;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === '{' && dedans === 'expr') {
      empiler('expr');
      i += 1;
      continue;
    }
    if (dedans === 'expr' && c === '<' && /[A-Za-z/]/.test(source[i + 1] ?? '')) {
      empiler('balise');
      debutBalise = i;
      i += 1;
      continue;
    }
    /*
       UN COMMENTAIRE DE JAVASCRIPT DANS DU BALISAGE, c'est-à-dire un
       `{/* … *\/}`. Le blanchiment ne passe pas par là — dans du balisage, un
       `//` est le plus souvent le milieu d'une adresse —, donc c'est ici que
       ces commentaires se sautent. Sans cela, le « n'est pas » de celui de
       `CentreNotifications.astro` ouvrait une chaîne pour le reste du fichier.
    */
    if (source.slice(i, i + 2) === '/*') {
      const bout = source.indexOf('*/', i + 2);
      const jusque = bout === -1 ? source.length : bout + 2;
      ligne += (source.slice(i, jusque).match(/\n/g)?.length ?? 0);
      i = jusque;
      continue;
    }
    if (source.slice(i, i + 2) === '//') {
      const saut = source.indexOf('\n', i);
      i = saut === -1 ? source.length : saut;
      continue;
    }

    /*
       UNE EXPRESSION RÉGULIÈRE N'EST PAS DU TEXTE, et c'est le détecteur de
       désynchronisation qui l'a établi : `.replace(/['’]/g, "'")` ouvrait une
       chaîne qui ne se fermait jamais, et `moteur-veille.ts`, `psyche.ts`,
       `export-lisible.ts` et onze autres se lisaient de travers à partir de
       là. On saute donc le littéral — en sachant qu'un `/` est tantôt une
       division : seul ce qui le PRÉCÈDE les distingue.
    */
    if (c === '/' && source[i + 1] !== '/' && source[i + 1] !== '*') {
      const avant = source.slice(Math.max(0, i - 24), i);
      if (AVANT_UNE_REGEX.test(avant)) {
        const fin = finDUneRegex(source, i);
        if (fin !== -1) {
          i = fin;
          continue;
        }
      }
    }
    if (c === "'" || c === '"' || c === '`') {
      empiler(c);
      debutLigne = ligne;
      courant = '';
      i += 1;
      continue;
    }
    i += 1;
  }
  fermer();
  if (pile.length !== 1 || pile[0] !== base) {
    const haut = pile.length - 1;
    anomalies.push({
      ligne: ouvertures[haut],
      quoi: `« ${pile[haut]} » ouvert ligne ${ouvertures[haut]} et jamais refermé (${pile.join(' > ')})`,
    });
  }
  return { morceaux, anomalies };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les exemptions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les textes exemptés, et pourquoi — un par un, jamais un fichier entier.
 *
 * ## Pourquoi par le TEXTE et non par le fichier
 *
 * Exempter « echelles.astro » aurait aussi caché ses trois phrases calculées
 * — « 3 réponse(s) manquante(s) » —, qui sont de vraies fautes et qui sont
 * corrigées. Une exemption de fichier dispense de regarder ; une exemption de
 * texte dit exactement ce qu'elle laisse passer.
 *
 * ## Ce qui est exempté, et la question que cela pose
 *
 * L'item de GÊNE du PHQ-9 : sa question et ses quatre réponses. Ce ne sont pas
 * des phrases du site : c'est le libellé d'un **instrument clinique validé**,
 * et le réécrire change l'instrument — ce qui n'est pas une correction de
 * typographie mais une décision de contenu, et elle n'est pas de mon ressort.
 *
 * LA QUESTION EST TRANCHÉE — Pilote, 26 octobre 2026 : la version française
 * de l'item de gêne porte bien la forme parenthésée, « ce(s) problème(s)
 * a-t-il (ont-ils) rendu… difficile(s) », et les réponses « Pas du tout
 * difficile(s) »… Le libellé d'un instrument validé reste MOT POUR MOT.
 * L'exemption est donc définitive, et ce n'est pas une tolérance qu'on aurait
 * oublié de lever : c'est la seule écriture juste de ces sept chaînes.
 *
 * Elle reste nommée par le TEXTE. Exempter le fichier aurait caché ses trois
 * phrases calculées — « 3 réponse(s) manquante(s) » —, qui sont de vraies
 * fautes, et qui sont corrigées.
 *
 * Les quatre réponses sont des chaînes entières, donc exemptées au mot près.
 * La question, elle, est du balisage sur trois lignes : on l'exempte par un
 * fragment qui ne vaut que pour elle.
 */
export const TEXTES_EXEMPTES = new Set([
  'Pas du tout difficile(s)',
  'Assez difficile(s)',
  'Très difficile(s)',
  'Extrêmement difficile(s)',
]);

/** Le même motif, pour un texte de balisage qui ne tient pas dans une chaîne. */
export const FRAGMENTS_EXEMPTES = [
  'à quel point ce(s)',
  'problème(s) a-t-il (ont-ils) rendu',
  'les autres difficile(s) ?',
];

/* ══════════════════════════════════════════════════════════════════════════
   L'entrée
   ══════════════════════════════════════════════════════════════════════════ */

/** Le numéro de ligne d'une position dans un morceau commencé à `debut`. */
const ligneDe = (texte, position, debut) => debut + (texte.slice(0, position).match(/\n/g)?.length ?? 0);

/**
 * Les sites de la forme interdite dans le TEXTE d'une source, et les endroits
 * où le balayage s'est perdu.
 *
 * Le nom du fichier décide de la lecture : `.astro` et `.svelte` sont du
 * balisage, le reste est du JavaScript. Sans nom, on lit du JavaScript — c'est
 * ce que font les contrôles de garde, qui éprouvent des bouts de code.
 */
export function sitesInterdits(source, fichier = '') {
  const morceaux = [];
  const anomalies = [];
  const retenir = (r) => {
    morceaux.push(...r.morceaux);
    anomalies.push(...r.anomalies);
  };

  if (/\.(astro|svelte)$/.test(fichier)) {
    /* Le blanchiment d'un balisage est une composition : elle vit chez lui. */
    const propre = sansCommentaires(source, 'astro').join('\n');
    for (const { genre, debut, fin } of regions(propre)) {
      if (genre === 'ignore') continue;
      const avant = propre.slice(0, debut).match(/\n/g)?.length ?? 0;
      retenir(machine(propre.slice(debut, fin), genre === 'js' ? 'js' : 'texte', avant + 1));
    }
  } else {
    retenir(machine(sansCommentaires(source, 'js').join('\n'), 'js', 1));
  }

  const sites = [];
  for (const { ligne, texte } of morceaux) {
    if (TEXTES_EXEMPTES.has(texte.trim())) continue;
    const resserre = texte.replace(/\s+/g, ' ').trim();
    if (FRAGMENTS_EXEMPTES.some((f) => resserre.includes(f))) continue;
    const apercu = resserre.slice(0, 120);
    for (const m of texte.matchAll(COLLE)) {
      sites.push({ ligne: ligneDe(texte, m.index ?? 0, ligne), texte: apercu });
    }
    if (SEULE.test(texte)) sites.push({ ligne, texte: apercu });
  }
  return { sites, anomalies };
}
