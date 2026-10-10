/**
 * Essais du module « Demander à l'IA ».
 *
 * Trois familles d'invariants, et aucune ne se voit à l'usage si elle est
 * fausse — on verrait seulement un prompt un peu plus court, ou un peu plus
 * bavard, sans savoir ce qui a été perdu.
 *
 *  1. **L'ordre de la coupe.** Le budget tient en 8 000 caractères, et ce qui
 *     part en premier est une décision pédagogique : d'abord ce qui parle de
 *     moi, ensuite ce qui parle du cours, jamais la question ni ma réponse. Un
 *     prompt qui aurait sacrifié l'énoncé poserait une question sans objet, et
 *     l'assistant répondrait quand même — à côté.
 *  2. **La non-fuite.** Rien de ce qui touche au mot de passe, à la clé, au sel
 *     ou aux paramètres de dérivation ne doit pouvoir entrer dans un prompt.
 *     On le vérifie ici sur des contextes d'exemple ; la garantie de fond est
 *     structurelle et vit dans « essais-assistant-reseau.mjs », qui montre que
 *     le module n'importe même pas de quoi les atteindre.
 *  3. **Le lien « Ouvrir dans Claude ».** Il n'est offert que si l'URL encodée
 *     tient sous le plafond. Un lien tronqué par le navigateur ouvrirait une
 *     conversation avec un prompt coupé au milieu, sans que rien ne le dise.
 */
import {
  BUDGET,
  MARQUE_TRONCATURE,
  PLAFOND_URL,
  PREREGLAGES,
  construirePrompt,
  couperAuxParagraphes,
  lienClaude,
  prereglage,
  type Intention,
} from '../src/features/assistant/prompt';
import { niveauEnMots, texteDuHtml, type Contexte } from '../src/features/assistant/contexte';
import { PARCOURS, parcoursOuDefaut } from '../src/lib/parcours/registre';

let echecs = 0;
function verifier(titre: string, obtenu: unknown, attendu: unknown) {
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

/** Un texte de longueur exacte, en paragraphes, pour éprouver les coupes. */
function remplissage(n: number): string {
  let texte = '';
  for (let i = 0; texte.length < n; i += 1) texte += `Paragraphe numéro ${i} de remplissage.\n\n`;
  return texte.slice(0, n).trimEnd();
}

const contexte = (): Contexte => ({
  provenance: 'quiz-cours',
  sujet: 'Le contrôle de conventionnalité',
  situation: ['Droit public', 'Fascicule 2', 'Le contrôle de conventionnalité'],
  blocs: [
    { titre: 'La question', texte: 'Semoule refusait quoi ?\n- A\n- B', rang: 1 },
    { titre: 'Ma réponse', texte: 'J’ai répondu A, la bonne était B.', rang: 1 },
    { titre: 'La correction du site', texte: remplissage(1000), rang: 2 },
    { titre: 'Extrait du cours', texte: remplissage(2000), rang: 3 },
    { titre: 'Définitions', texte: remplissage(600), rang: 4 },
    { titre: 'Mon niveau', texte: 'J’ai un niveau moyen en droit public.', rang: 5 },
  ],
});

// --- 1. L'ordre de la coupe ------------------------------------------------

{
  const r = construirePrompt(contexte(), { intention: 'expliquer' });
  verifier('sans dépassement, rien n’est retiré', [r.retires, r.tronques], [[], []]);
  verifier('et le prompt tient sous le budget', r.longueur <= BUDGET, true);
}

{
  /*
   * Un budget serré force la coupe, et elle doit commencer par le rang 5. Le
   * budget se calcule à partir du prompt complet plutôt que de s'écrire en
   * dur : une retouche de l'en-tête ou d'une consigne déplacerait sinon le
   * seuil, et l'essai se mettrait à mesurer la longueur des gabarits au lieu
   * de l'ordre de la coupe.
   */
  const plein = construirePrompt(contexte(), { intention: 'expliquer' }).longueur;
  const r = construirePrompt(contexte(), { intention: 'expliquer', budget: plein - 10 });
  verifier('le bloc de rang 5 part en premier, et lui seul', r.retires, ['Mon niveau']);
  verifier('et le prompt revient sous le budget', r.longueur <= plein - 10, true);
}

{
  const r = construirePrompt(contexte(), { intention: 'expliquer', budget: 2500 });
  verifier(
    'puis le rang 4, puis le rang 3, dans cet ordre',
    r.retires,
    ['Mon niveau', 'Définitions', 'Extrait du cours'],
  );
  verifier('la question est toujours là', r.texte.includes('Semoule refusait quoi ?'), true);
  verifier('ma réponse aussi', r.texte.includes('J’ai répondu A'), true);
}

{
  // Budget si étroit qu'il ne reste que le rang 1 : on tronque, on ne retire pas.
  const etroit = construirePrompt(contexte(), { intention: 'expliquer', budget: 900 });
  verifier(
    'les blocs de rang 1 ne sont jamais retirés',
    etroit.retires.includes('La question') || etroit.retires.includes('Ma réponse'),
    false,
  );
  verifier('la question reste lisible', etroit.texte.includes('Semoule refusait quoi ?'), true);
}

{
  // Un énoncé à lui seul plus long que le budget : il est tronqué, et marqué.
  const enorme: Contexte = {
    provenance: 'fiche',
    sujet: 'Un long passage',
    situation: ['Droit public'],
    blocs: [{ titre: 'Le passage', texte: remplissage(12000), rang: 1 }],
  };
  const r = construirePrompt(enorme, { intention: 'expliquer' });
  verifier('un bloc de rang 1 trop long est tronqué', r.tronques, ['Le passage']);
  verifier('et la troncature est signalée', r.texte.includes(MARQUE_TRONCATURE), true);
  verifier('le prompt tient sous le budget', r.longueur <= BUDGET, true);
}

verifier(
  'la coupe tombe à une limite de paragraphe',
  couperAuxParagraphes('Un.\n\nDeux.\n\nTrois longue phrase qui dépasse.', 24).endsWith(
    MARQUE_TRONCATURE,
  ),
  true,
);
verifier(
  'un texte plus court que le maximum n’est pas touché',
  couperAuxParagraphes('Court.', 100),
  'Court.',
);

// --- 2. La non-fuite -------------------------------------------------------

{
  /*
   * Les mots qui ne doivent jamais figurer dans un prompt. On ne cherche pas le
   * mot de passe lui-même — il n'est nulle part dans le dépôt, et c'est bien
   * ainsi : on cherche les **noms** des champs qui le porteraient, parce que
   * c'est par là qu'une fuite arriverait, en recopiant un objet entier.
   */
  const interdits = [
    'SITE_PASSWORD',
    'motDePasse',
    'derivation',
    'iterations',
    '"sel"',
    'cleDerivee',
    'PBKDF2',
  ];
  const tous = PREREGLAGES.map((p) => p.id);
  const fuites: string[] = [];
  for (const intention of tous) {
    const r = construirePrompt(contexte(), { intention, demande: 'Une question de ma part.' });
    for (const mot of interdits) if (r.texte.includes(mot)) fuites.push(`${intention}/${mot}`);
  }
  verifier('aucun préréglage ne fait fuiter un nom de champ sensible', fuites, []);
}

verifier(
  'le niveau est dit en mots, jamais en nombre',
  [niveauEnMots(900), niveauEnMots(1300), niveauEnMots(1800)].some((m) => /\d/.test(m)),
  false,
);

// --- 3. La forme du prompt -------------------------------------------------

{
  const r = construirePrompt(contexte(), { intention: 'verifier', demande: 'Et la CEDH ?' });
  verifier(
    'la consigne du préréglage est présente',
    r.texte.includes(prereglage('verifier').consigne),
    true,
  );
  verifier(
    'l’invitation à contredire aussi',
    r.texte.includes('je préfère une contradiction argumentée'),
    true,
  );
  verifier('la demande libre est reprise', r.texte.includes('Et la CEDH ?'), true);
  verifier(
    'la situation est rendue du plus large au plus étroit',
    r.texte.includes('Droit public › Fascicule 2 › Le contrôle de conventionnalité'),
    true,
  );
}

{
  const sansDemande = construirePrompt(contexte(), { intention: 'expliquer' });
  verifier(
    'sans demande libre, la section « Ma demande » n’apparaît pas',
    sansDemande.texte.includes('## Ma demande'),
    false,
  );
}

verifier(
  'un préréglage inconnu retombe sur l’explication',
  prereglage('n’existe pas' as Intention).id,
  'expliquer',
);

// --- 4. « Ouvrir dans Claude » ---------------------------------------------

verifier('un prompt court donne un lien', typeof lienClaude('Bonjour'), 'string');
verifier('un prompt long n’en donne pas', lienClaude(remplissage(20000)), null);
{
  // L'encodage gonfle : un texte tout en accents dépasse le plafond bien avant
  // sa longueur brute, et c'est la longueur encodée qui décide.
  const accents = 'é'.repeat(1500);
  verifier(
    'c’est la longueur encodée qui décide, non la longueur brute',
    [accents.length < PLAFOND_URL, lienClaude(accents)],
    [true, null],
  );
}
{
  /*
   * Le cas pour lequel le lien existe : le prompt le plus court du site, celui
   * d'un terme de glossaire. À 2 000, il ne passait pas — le plafond avait été
   * fixé sans mesure, et le bouton n'aurait jamais servi.
   */
  const glossaire: Contexte = {
    provenance: 'glossaire',
    sujet: 'subsidiarité',
    situation: ['Glossaire', 'subsidiarité'],
    blocs: [
      {
        titre: 'Le terme',
        texte:
          'subsidiarité : principe selon lequel l’Union n’intervient, hors de ses compétences ' +
          'exclusives, que si les objectifs ne peuvent être atteints de manière suffisante par ' +
          'les États membres.',
        rang: 1,
      },
      {
        titre: 'La phrase où je l’ai rencontré',
        texte: 'Le contrôle de subsidiarité est confié aux parlements nationaux.',
        rang: 2,
      },
    ],
  };
  const court = construirePrompt(glossaire, { intention: 'expliquer' });
  verifier(
    'le prompt le plus court du site tient dans un lien',
    typeof lienClaude(court.texte),
    'string',
  );
}

// --- 5. Le HTML des fiches devient du texte --------------------------------

verifier(
  'les titres gardent leur niveau',
  texteDuHtml('<h2>Titre</h2><p>Un texte.</p>'),
  '## Titre\nUn texte.',
);
verifier(
  'les listes gardent leurs tirets',
  texteDuHtml('<ul><li>Un</li><li>Deux</li></ul>'),
  '- Un\n- Deux',
);
verifier(
  'les entités sont rendues',
  texteDuHtml('<p>l&#39;article&nbsp;55 &amp; suivants</p>'),
  "l'article 55 & suivants",
);

// --- 8. L'en-tête nomme le concours du parcours, et pas un autre ----------

/*
 * Le défaut corrigé ici était en production : l'ouverture du prompt annonçait
 * « le concours externe de l'INSP » quel que soit le parcours **et** quelle que
 * soit la voie, alors que le parcours par défaut est le concours interne. Deux
 * erreurs dans une phrase, dont la seconde est celle qu'on remarque le moins.
 *
 * L'essai interroge le registre plutôt que d'écrire les intitulés en dur : un
 * essai qui recopierait la chaîne attendue ne vérifierait que lui-même.
 */
for (const p of PARCOURS) {
  const r = construirePrompt(contexte(), { intention: 'expliquer', parcours: p });
  verifier(
    `l’en-tête de ${p.libelle} nomme son concours`,
    r.texte.startsWith(`Tu m’aides à préparer ${p.concours.phrase}.`),
    true,
  );
}

{
  const defaut = construirePrompt(contexte(), { intention: 'expliquer' });
  verifier(
    'sans parcours, c’est le parcours par défaut qui nomme le concours',
    defaut.texte.startsWith(
      `Tu m’aides à préparer ${parcoursOuDefaut(null).concours.phrase}.`,
    ),
    true,
  );
  verifier(
    'et le concours interne n’est plus annoncé comme externe',
    /concours externe/.test(defaut.texte),
    false,
  );
}

{
  /*
   * Plus aucune consigne ne nomme un concours : l'en-tête le fait, et le dire
   * deux fois, c'était se condamner à ce que les deux divergent.
   */
  const nommant = PREREGLAGES.filter((pre) => /INSP|DGFiP/.test(pre.consigne));
  verifier('aucun préréglage ne nomme un concours', nommant.map((pre) => pre.id), []);
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
