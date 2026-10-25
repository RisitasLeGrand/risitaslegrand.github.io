/**
 * « Ma journée » : une seule source, et aucun faux défaut.
 *
 *   npm run essais:ma-journee
 *
 * Décisions 4 et 5 du prompt 56, et P10. Ce que cet essai garde :
 *
 * - **une seule source.** Le lever, le coucher et le moment de la revue sont
 *   des champs de profil, et les trois écrans qui les montrent les lisent et
 *   les écrivent par les fonctions du profil. Il n'existe pas de copie qui
 *   puisse diverger — sauf une, nommée ci-dessous, qui est locale à l'appareil
 *   et que le vide rend à « Ma journée ».
 * - **aucun faux défaut.** Le catalogue déclarait 07:00 et 21:00 comme valeurs
 *   par défaut, et la page centrale les affichait dans un champ modifiable :
 *   on ne pouvait pas distinguer « sept heures » de « rien dit », et
 *   « Rétablir » écrivait 7 h au journal. Le défaut déclaré est maintenant le
 *   vide, et une phrase dit ce que Cyclades fait à défaut de réponse.
 * - **deux moments, deux noms.** « Moment de ma revue » et « Moment de
 *   révision préféré » se ressemblaient assez pour qu'on les confonde ;
 *   Alexis a demandé de les garder séparés, mieux nommés.
 * - **un choix fermé sur les valeurs réellement lues** : la revue ne reconnaît
 *   que « matin » et « soir », et la question ne propose donc que ces deux
 *   réponses. Elle se posait en texte libre, et « le soir » — avec l'article —
 *   était silencieusement ignoré.
 */
import { REGLAGES } from '../src/lib/parametres/catalogue.ts';
import { CHAMPS, champDeclare } from '../src/lib/noyau/profil.ts';
import { CHOIX } from '../src/lib/noyau/initialisation.ts';
import { MOMENT_PAR_DEFAUT, lireMoment } from '../src/lib/odyssee/moment-revue.ts';
import { LEVER_PAR_DEFAUT, COUCHER_PAR_DEFAUT } from '../src/lib/themes.ts';

let rouges = 0;
const v = (quoi: string, obtenu: unknown, attendu: unknown) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) {
    console.log(`  \x1b[32m✓\x1b[0m ${quoi}`);
    return;
  }
  rouges += 1;
  console.log(
    `  \x1b[31m✗\x1b[0m ${quoi}\n      obtenu  ${JSON.stringify(obtenu)}` +
      `\n      attendu ${JSON.stringify(attendu)}`,
  );
};
const vrai = (quoi: string, condition: boolean) => v(quoi, condition, true);

const reglage = (id: string) => REGLAGES.find((r) => r.id === id);

console.log('\n1. UNE SEULE SOURCE : LE PROFIL');

for (const id of ['lever', 'coucher', 'moment-revue']) {
  const r = reglage(id);
  vrai(`« ${id} » est sur la page centrale`, Boolean(r));
  v(`et il est rangé dans Ma journée`, r?.section, 'journee');
  /* `IndexedDB/etat::profil` est l'identifiant que l'inventaire rend pour le
     journal du profil : c'est la preuve, dans le catalogue, que ce réglage
     n'a pas de magasin à lui. */
  v(`et il dit stocker dans le profil`, r?.stockage, 'IndexedDB/etat::profil');
  v(`et valoir sur tous les appareils`, r?.portee, 'tous');
  vrai(`et c'est bien un champ de profil déclaré`, Boolean(champDeclare(id)));
}

console.log('\n2. LA SEULE COPIE QUI RESTE EST LOCALE, ET LE VIDE LA REND');

for (const id of ['heure-clair', 'heure-sombre']) {
  const r = reglage(id);
  v(`« ${id} » ne vaut que sur cet appareil`, r?.portee, 'appareil');
  v(
    `et il vit dans la clé locale de la bascule`,
    r?.stockage,
    'localStorage::revinsp.heures-bascule',
  );
  /* Le défaut est le vide : « Rétablir » rend la main à « Ma journée » au lieu
     d'inscrire une heure sur cet appareil. */
  v(`son défaut est le vide`, r?.defaut, '');
  vrai(`et une phrase dit ce que le vide veut dire`, (r?.siVide ?? '').length > 20);
  vrai(
    `qui renvoie à Ma journée`,
    /Ma journée|heure de (lever|coucher)/.test(r?.siVide ?? '') ||
      /Ma journée/.test(r?.aQuoiCaSert ?? ''),
  );
}

console.log('\n3. AUCUN FAUX DÉFAUT (P10)');

for (const id of ['lever', 'coucher']) {
  const r = reglage(id);
  v(`« ${id} » ne déclare plus d'heure par défaut`, r?.defaut, '');
  vrai(`mais dit ce qu'il se passe sans réponse`, (r?.siVide ?? '').includes('Non renseigné'));
}
v(
  'et la phrase du lever nomme l’heure d’usine, en toutes lettres',
  reglage('lever')?.siVide,
  'Non renseigné : 7 h par défaut.',
);
v('celle du coucher aussi', reglage('coucher')?.siVide, 'Non renseigné : 21 h par défaut.');
/* Les heures d'usine, elles, n'ont pas bougé : c'est le repli du thème, et le
   prompt ne demande pas de le changer — seulement de ne plus le faire passer
   pour un choix. */
v('les heures d’usine restent celles du thème', [LEVER_PAR_DEFAUT, COUCHER_PAR_DEFAUT], [
  '07:00',
  '21:00',
]);
/* Et aucun réglage de nature « heure » ne garde un défaut sans dire ce que le
   vide veut dire : la règle vaut pour les suivants, pas seulement pour ces
   quatre-là. */
for (const r of REGLAGES) {
  if (r.nature.genre !== 'heure') continue;
  vrai(`« ${r.id} » : nature heure, et le vide est expliqué`, Boolean(r.siVide));
}

console.log('\n4. DEUX MOMENTS, DEUX NOMS (DÉCISION 4)');

const revue = champDeclare('moment-revue');
const revision = champDeclare('momentRevision');
v('le moment de la revue dit la branche dont il vient', revue?.libelle, 'Moment de ma revue (Odyssée)');
v('celui de la révision dit qu’il parle d’heure', revision?.libelle, 'Heure préférée pour réviser');
vrai('les deux libellés ne se confondent plus', revue?.libelle !== revision?.libelle);
vrai(
  'la question de la revue dit ce que le choix change',
  /veille/.test(revue?.question ?? '') && /journée/.test(revue?.question ?? ''),
);
vrai(
  'et celle de la révision ne parle plus de « travailler »',
  !/travailler/.test(revision?.question ?? ''),
);
v(
  'Paramètres nomme la revue comme le profil',
  reglage('moment-revue')?.libelle,
  revue?.libelle,
);

console.log('\n5. LE CHOIX EST FERMÉ SUR CE QUI EST LU (G6)');

const options = CHOIX['moment-revue'] ?? [];
v('deux réponses, et deux seulement', options.length, 2);
v(
  'et ce sont celles que la revue sait lire',
  options.map((o) => o.valeur),
  ['matin', 'soir'],
);
for (const option of options) {
  v(
    `« ${String(option.valeur)} » est reconnue telle quelle`,
    lireMoment(option.valeur),
    option.valeur,
  );
  vrai(`et elle porte une aide qui dit sur quoi la revue porte`, (option.aide ?? '').length > 20);
}
/* La preuve du défaut corrigé : une saisie libre plausible n'était pas lue. */
v('« le soir », avec l’article, n’a jamais été lu', lireMoment('le soir'), MOMENT_PAR_DEFAUT);
v('ni « Matin » avec sa majuscule', lireMoment('Matin'), MOMENT_PAR_DEFAUT);
vrai(
  'aucune des deux réponses proposées ne tombe dans ce repli par hasard',
  options.every((o) => lireMoment(o.valeur) === o.valeur),
);
v(
  'Paramètres propose les mêmes mots que l’initialisation',
  reglage('moment-revue')?.nature.genre === 'choix'
    ? (reglage('moment-revue')!.nature as { options: { libelle: string }[] }).options.map(
        (o) => o.libelle,
      )
    : [],
  options.map((o) => o.libelle),
);

console.log('\n6. M4 : L’AIDE DU LEVER DIT CE QUE LE CODE FAIT');

const aideDuLever = reglage('lever')?.aQuoiCaSert ?? '';
vrai('elle dit « une heure avant »', aideDuLever.includes('une heure avant'));
vrai('et nomme les bornes, 2 h et 6 h', /2 h et 6 h/.test(aideDuLever));
vrai(
  'et le champ de profil ne promet plus la bascule à l’heure du lever',
  !/journée change de date —/.test(CHAMPS.find((c) => c.champ === 'lever')?.regle ?? ''),
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
