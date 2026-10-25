/**
 * Essais des formules mathématiques — point e du 60.
 *
 * Trois choses comptent ici, et la deuxième est la plus importante.
 *
 * **Le rendu.** Une formule doit sortir en MathML, avec son LaTeX d'origine en
 * annotation, pour qu'un lecteur d'écran ait quelque chose à dire. Et une
 * formule fausse doit ARRÊTER la construction, en nommant la formule : un
 * « KaTeX parse error » tout seul ne sert à rien dans un corpus de plusieurs
 * milliers de textes.
 *
 * **La non-régression, qui est la vraie raison de ce fichier.** Le contenu
 * porte 158 « $ » monétaires et 100 ellipses de citation « \[…\] ». Les deux
 * délimiteurs que le prompt proposait auraient transformé ce texte juste en
 * formules, silencieusement. Les essais ci-dessous fixent le comportement :
 * ces écritures passent INCHANGÉES, et c'est vérifié sur les formes exactes
 * relevées dans le corpus.
 *
 * **La sécurité.** Le rendu de KaTeX ne peut traverser le pipeline qu'avec
 * « allowDangerousHtml » sur la sortie. On vérifie donc que le HTML écrit à la
 * main dans une fiche reste détruit : si cette garantie tombait, il faudrait
 * jeter la démarche entière, quel que soit le confort du rendu.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { rendreHtml } from './lib/markdown.mjs';
import { PREFIXE_EN_LIGNE, direLaFormule, formulesDe, rendreFormule } from './lib/maths.mjs';
import { ecrireScript } from './lib/podcast.mjs';

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
const rendre = (md) => rendreHtml(md, new Map());
const arbre = (md) => unified().use(remarkParse).use(remarkGfm).parse(md);

console.log('\n\x1b[1mLE RENDU, ET CE QU’IL DOIT PORTER\x1b[0m\n');
{
  const bloc = rendre('```math\n\\frac{a}{b}\n```');
  verifier('un bloc « math » sort du MathML', /<math/.test(bloc), true);
  verifier('et garde son LaTeX en annotation', /<annotation encoding="application\/x-tex">/.test(bloc), true);
  verifier('la partie visuelle est cachée aux lecteurs d’écran', /aria-hidden="true"/.test(bloc), true);
  /*
     Pas de « <pre> » autour : poser « hName » sur un nœud « code » laissait un
     « <pre><div> », qui est du HTML invalide et dont les règles d'espaces
     disloquaient la mise en forme. Le nœud est remplacé, pas rhabillé.
  */
  verifier('et il n’est pas enfermé dans un « pre »', /<pre/.test(bloc), false);
  verifier('le bloc est en mode « display »', /katex-display/.test(bloc), true);

  const enLigne = rendre('La racine vaut `math:\\sqrt{2}` environ.');
  verifier('une formule en ligne sort du MathML', /<math/.test(enLigne), true);
  verifier('dans un span, au fil du texte', /<span class="maths maths-en-ligne">/.test(enLigne), true);
  verifier('et PAS en mode « display »', /katex-display/.test(enLigne), false);
  verifier('le texte autour est conservé', /La racine vaut/.test(enLigne) && /environ\./.test(enLigne), true);
}

console.log('\n\x1b[1mUNE FORMULE FAUSSE ARRÊTE LA CONSTRUCTION\x1b[0m\n');
{
  let message = '';
  try {
    rendreFormule('\\frac{a}{');
  } catch (e) {
    message = e.message;
  }
  verifier('une formule qui ne compile pas est refusée', message !== '', true);
  verifier('et le message NOMME la formule fautive', message.includes('\\frac{a}{'), true);

  let parLePipeline = false;
  try {
    rendre('```math\n\\frac{a}{\n```');
  } catch {
    parLePipeline = true;
  }
  verifier('le refus remonte par le rendu de la fiche', parLePipeline, true);

  /* Une formule vide est une faute aussi : elle ne veut rien dire à l'écran. */
  let vide = false;
  try {
    rendreFormule('   ');
  } catch {
    vide = true;
  }
  verifier('une formule vide est refusée', vide, true);
}

console.log('\n\x1b[1mLA NON-RÉGRESSION — CE QUI NE DOIT SURTOUT PAS CHANGER\x1b[0m\n');
{
  /*
     Les formes exactes relevées dans le corpus. 158 « $ » monétaires, et pas
     un seul LaTeX. Si un jour « $…$ » devenait un délimiteur, ces lignes
     rougiraient — et c'est précisément leur raison d'être.
  */
  for (const [quoi, source, attendu] of [
    ['deux montants en dollars dans une phrase', 'dette 20 000 Md$ (2016) → 32 000 Md$ ensuite', '20 000 Md$ (2016) → 32 000 Md$'],
    ['un montant en millions', 'des 710 M$ alloués et 520 M$ dépensés', '710 M$ alloués et 520 M$ dépensés'],
    ['un montant décimal', 'le fascicule écrit 4,9 Md$ par erreur', '4,9 Md$ par erreur'],
  ]) {
    const html = rendre(source);
    verifier(`${quoi} : le texte traverse intact`, html.includes(attendu), true);
    verifier(`${quoi} : aucune formule n’est fabriquée`, /<math/.test(html), false);
  }

  /*
     L'ellipse de citation, échappée pour que Markdown n'y voie pas un lien.
     Markdown consomme l'antislash et rend « […] » — ce qui est exactement ce
     que son auteur voulait, et ce qui condamnait « \[…\] » comme délimiteur.
  */
  for (const [quoi, source] of [
    ['au milieu d’une citation', 'assure notre avenir \\[…\\] c’est la référence'],
    ['après un verbe', 'L’octroi \\[…\\] de toute assistance'],
  ]) {
    const html = rendre(source);
    verifier(`l’ellipse ${quoi} rend « […] »`, html.includes('[…]'), true);
    verifier(`l’ellipse ${quoi} ne fabrique aucune formule`, /<math/.test(html), false);
  }
}

console.log('\n\x1b[1mLE HTML D’AUTEUR RESTE DÉTRUIT\x1b[0m\n');
{
  /*
     La garantie décisive. « allowDangerousHtml » est posé sur la SEULE sortie,
     et le HTML d'auteur meurt en amont, au passage remark→rehype. Si l'un de
     ces essais rougissait, il faudrait retirer l'option et renoncer au rendu
     plutôt que de laisser passer une balise.
  */
  for (const [quoi, source, interdit] of [
    ['une balise script', 'Avant <script>alert(1)</script> après.', /<script/],
    ['un attribut d’événement', 'Avant <img src=x onerror="alert(1)"> après.', /onerror/],
    ['un commentaire HTML', 'Avant <!-- caché --> après.', /<!--/],
    ['du gras écrit à la main', 'Un <b>gras</b> à la main.', /<b>/],
    ['une iframe', 'Avant <iframe src="https://example.invalid"></iframe> après.', /<iframe/],
  ]) {
    verifier(`${quoi} est détruit`, interdit.test(rendre(source)), false);
  }
  /* Et la même chose dans la même fiche qu'une formule : le voisinage d'un
     nœud brut légitime ne doit rien autoriser. */
  const melange = rendre('Une formule `math:\\sqrt{2}` et <script>alert(1)</script> ensuite.');
  verifier('voisine d’une formule, la balise est détruite quand même', /<script/.test(melange), false);
  verifier('et la formule, elle, est bien rendue', /<math/.test(melange), true);

  /*
     KaTeX tourne avec « trust: false » : « \href » ne doit produire aucun lien.
     C'est la seule voie par laquelle du LaTeX pourrait fabriquer du HTML actif.
  */
  let href = '';
  try {
    href = rendreFormule('\\href{javascript:alert(1)}{cliquez}');
  } catch (e) {
    href = `refusé : ${e.message}`;
  }
  verifier('« \\href » ne fabrique aucun lien', /<a\s|href="javascript/.test(href), false);
}

console.log('\n\x1b[1mCE QUI N’EST PAS UNE FORMULE RESTE DU CODE\x1b[0m\n');
{
  const autre = rendre('```js\nconst a = 1;\n```');
  verifier('un bloc d’un autre langage reste du code', /<pre/.test(autre), true);
  verifier('et ne passe pas par KaTeX', /<math/.test(autre), false);

  const codeOrdinaire = rendre('Appelez `maths()` ici.');
  verifier('un code en ligne sans le préfixe reste du code', /<code>maths\(\)<\/code>/.test(codeOrdinaire), true);
  verifier('et ne fabrique aucune formule', /<math/.test(codeOrdinaire), false);

  verifier(
    'le préfixe est bien celui qu’on croit',
    PREFIXE_EN_LIGNE,
    'math:',
  );
}

console.log('\n\x1b[1mLE RELEVÉ DES FORMULES, SANS RENDU\x1b[0m\n');
{
  const trouvees = formulesDe(arbre('Du texte `math:a^2` puis\n\n```math\n\\sqrt{b}\n```\n\net `code` ordinaire.'));
  verifier('les deux formules sont relevées', trouvees.length, 2);
  verifier('la première est en ligne', trouvees[0], { tex: 'a^2', bloc: false });
  verifier('la seconde est un bloc', trouvees[1], { tex: '\\sqrt{b}', bloc: true });
}

console.log('\n\x1b[1mUNE VOIX NE LIT JAMAIS DU LATEX BRUT\x1b[0m\n');
{
  /*
     Le générateur de fiches audio doit savoir dire une formule, ou la retirer
     EN LE SIGNALANT. « backslash frac ouvrez l'accolade » n'apprend rien.
  */
  verifier('une fraction se dit', direLaFormule('\\frac{a}{b}'), { dit: 'a sur b' });
  verifier('une racine se dit', direLaFormule('\\sqrt{2}'), { dit: 'racine carrée de 2' });
  verifier('un carré se dit', direLaFormule('a^2'), { dit: 'a au carré' });
  verifier('une comparaison se dit', direLaFormule('a \\leq b'), { dit: 'a inférieur ou égal à b' });
  verifier('une multiplication se dit', direLaFormule('12 \\times 6'), { dit: '12 fois 6' });

  /*
     Et l'aveu, qui est le point important : une construction inconnue est
     retirée et SIGNALÉE, jamais lue de travers.
  */
  const inconnue = direLaFormule('\\oint_{\\partial \\Omega} \\mathbf{F}');
  verifier('une construction inconnue est retirée', inconnue.retiree, true);
  verifier('et la raison nomme la formule', (inconnue.raison ?? '').includes('oint'), true);
  verifier('rien n’est « dit » dans ce cas', inconnue.dit, undefined);
  /* Aucune sortie ne doit contenir d'antislash : c'est l'invariant. */
  for (const tex of ['\\frac{a}{b}', '\\sqrt{2}', 'a^2 + b^2', '12 \\times 6', '\\neq']) {
    const r = direLaFormule(tex);
    verifier(`« ${tex} » ne laisse aucun antislash à la voix`, /\\/.test(r.dit ?? ''), false);
  }
}

console.log('\n\x1b[1mLE SCRIPT PARLÉ NE PRONONCE JAMAIS DU LATEX\x1b[0m\n');
{
  /*
     Le bout en bout, et c'est lui qui compte : « direLaFormule » peut être
     juste et le générateur l'ignorer. Avant ce branchement, une formule en
     ligne arrivait dans le script sous la forme « math:\sqrt{2} » — du LaTeX
     lu à voix haute —, et un bloc disparaissait sans un mot.
  */
  const dire = (cours) => {
    const s = ecrireScript({ titre: 'Essai', matiere: 'Maths', fascicule: 'F1', cours, glossaire: [], flashcards: [] });
    return (s?.paragraphes ?? []).map((p) => p.texte ?? p).join(' ');
  };

  const enLigneDisible = dire('Le gain vaut `math:\\frac{a}{b}` ici.');
  verifier('une formule en ligne est DITE', /a sur b/i.test(enLigneDisible), true);
  verifier('et le préfixe n’est pas prononcé', /math:/.test(enLigneDisible), false);

  const blocDisible = dire('Avant.\n\n```math\n\\sqrt{2}\n```\n\nAprès.');
  verifier('un bloc est DIT', /racine carr/i.test(blocDisible), true);

  const enLigneExotique = dire('Le gain vaut `math:\\oint_{\\partial}\\mathbf{F}` ici.');
  verifier('une formule en ligne qu’on ne sait pas dire est SIGNALÉE', /porte ici une formule/.test(enLigneExotique), true);

  const blocExotique = dire('Avant.\n\n```math\n\\oint_{\\partial}\\mathbf{F}\n```');
  verifier('un bloc qu’on ne sait pas dire est SIGNALÉ', /porte ici une formule/.test(blocExotique), true);

  /*
     L'invariant qui résume tout : aucun antislash, aucune accolade, aucun
     accent circonflexe ne doit atteindre une voix, dans aucun des quatre cas.
  */
  for (const [quoi, cours] of [
    ['en ligne disible', 'Le gain vaut `math:\\frac{a}{b}` ici.'],
    ['en ligne exotique', 'Le gain vaut `math:\\oint_{\\partial}\\mathbf{F}` ici.'],
    ['bloc disible', 'Avant.\n\n```math\n\\sqrt{2}\n```'],
    ['bloc exotique', 'Avant.\n\n```math\n\\oint_{\\partial}\\mathbf{F}\n```'],
  ]) {
    verifier(`${quoi} : aucun signe de LaTeX dans le script`, /[\\{}^_]/.test(dire(cours)), false);
  }
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
