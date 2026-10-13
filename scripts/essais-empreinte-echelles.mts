/**
 * L'empreinte des échelles : ce que ce contrôle prouve, et ce qu'il ne prouve
 * pas.
 *
 * ## Ce qu'il prouve
 *
 * Que le texte des trois échelles — titre, consigne, items, options, valeurs,
 * attribution, réserve — **n'a pas bougé** depuis le 13 octobre 2026. Toute
 * modification, même d'une apostrophe, fait échouer cet essai en nommant
 * l'échelle concernée.
 *
 * C'est exactement le risque que l'en-tête de `echelles.ts` nomme :
 * « **Rien ici ne doit être réécrit de mémoire.** » Trois relevés confiés à
 * des modèles externes ont été rejetés avant celui qui a servi, et l'un
 * donnait huit items faux sur neuf tout en ayant l'air parfaitement
 * plausible. Un texte d'échelle ne se relit pas : il se compare. Jusqu'ici,
 * `controlerEchelles()` vérifiait les comptes et les valeurs et le disait
 * lui-même — « il ne peut pas vérifier les mots ». Celui-ci les vérifie.
 *
 * ## Ce qu'il ne prouve pas, et c'est important
 *
 * **Il n'établit pas que le texte est conforme aux documents des ayants
 * droit.** Il ne le peut pas : `who.int` et `phqscreeners.com` n'étaient pas
 * joignables, les transcriptions disponibles viennent d'une extraction OCR, et
 * le relevé de provenance a conclu que sous OCR chaque caractère est suspect
 * individuellement. Comparer à une empreinte de ces transcriptions
 * reviendrait à certifier une copie par elle-même.
 *
 * L'empreinte gelée ici est donc celle du **texte retenu**, pas celle d'un
 * document authentifié. Elle garde contre la dérive, pas contre l'erreur
 * d'origine. Dire l'un pour l'autre serait le genre de confusion que ce
 * projet a déjà retiré une fois par écrit.
 *
 * ## Pourquoi l'empreinte est dans cet essai et non dans le module
 *
 * Une empreinte rangée à côté du texte qu'elle garde se met à jour en même
 * temps que lui, sans que personne s'en aperçoive. Ici, modifier le texte
 * oblige à venir modifier **un second fichier**, dont le seul objet est de
 * dire « ceci a changé ». C'est la friction qui fait le garde-fou.
 */
import { createHash } from 'node:crypto';
import { ECHELLES, controlerEchelles, type Echelle } from '../src/lib/odyssee/echelles';

/**
 * Les empreintes gelées le 13 octobre 2026.
 *
 * Pour les mettre à jour après une correction **voulue** du texte :
 * `npx tsx scripts/essais-empreinte-echelles.mts --empreintes`, puis recopier.
 * Et n'y recopier que ce qu'on a relu caractère par caractère.
 */
const EMPREINTES: Record<string, string> = {
  who5: '3ffa968c72112004985cbd802497bbd29f51fbd0b99c5e28495e68034d317cbc',
  phq9: '57539c85b89de4dc9fa4d55b5541dd0fb9de4d26c0b5822be5e98df2b3fe212e',
  gad7: '6418a561010daeae28533532f62a30b7467f6f236d2bd62eee5ccb7376794787',
};

/**
 * Ce qui entre dans l'empreinte : tout ce qui est **cité** d'un document.
 *
 * Pas les identifiants ni les classes d'affichage : ce sont des choix du
 * site, qu'on doit pouvoir remanier. Les valeurs chiffrées des options en
 * sont, elles : une option dont le libellé est juste et la valeur fausse
 * donne un score faux en silence.
 */
function texteCite(e: Echelle): string {
  return JSON.stringify([
    e.titre,
    e.consigne ?? null,
    e.items,
    e.options.map((o) => [o.libelle, o.valeur]),
    e.maximum,
    e.facteur,
    e.paliers.map((p) => [p.de, p.a, p.etiquette]),
    e.origineDesPaliers,
    e.attribution,
    e.reserve,
  ]);
}

const empreinte = (e: Echelle) => createHash('sha256').update(texteCite(e), 'utf8').digest('hex');

if (process.argv.includes('--empreintes')) {
  for (const e of ECHELLES) console.log(`  ${e.id}: '${empreinte(e)}',`);
  process.exit(0);
}

let echecs = 0;
const verifier = (nom: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${nom}`);
  else {
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? `\n      ${detail}` : ''}`);
  }
};

console.log('\nLES TROIS ÉCHELLES SONT AU CARACTÈRE PRÈS CELLES DU 13 OCTOBRE');
for (const e of ECHELLES) {
  const obtenue = empreinte(e);
  const attendue = EMPREINTES[e.id];
  verifier(
    `${e.id} — ${e.items.length} items, texte inchangé`,
    obtenue === attendue,
    `attendue ${attendue}\n      obtenue ${obtenue}\n      ` +
      'Si la correction est voulue et relue : npx tsx scripts/essais-empreinte-echelles.mts --empreintes',
  );
}

console.log('\nET LES CONTRÔLES DE STRUCTURE TIENNENT TOUJOURS');
const problemes = controlerEchelles();
verifier('controlerEchelles() ne relève rien', problemes.length === 0, problemes.join('\n      '));

verifier(
  'aucune échelle n’emploie l’apostrophe droite',
  !ECHELLES.some((e) => texteCite(e).includes("'")),
  'les documents n’emploient que l’apostrophe typographique U+2019',
);

console.log(
  echecs === 0
    ? '\n\x1b[32m✓ Les échelles n’ont pas dérivé.\x1b[0m\n'
    : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
