/**
 * Les deux histogrammes des statistiques (H5 du prompt 43).
 *
 *   npm run essais:graphiques
 *
 * ## Ce qu'un graphique doit à qui ne le voit pas, ou mal
 *
 * Quatre choses, et elles se contrôlent sans navigateur parce qu'elles sont
 * dans le balisage, dans le script ou dans les couleurs :
 *
 * 1. **La promesse tenue** — une ligne annoncée est une ligne tracée. Le texte
 *    disait « ligne pointillée à 10 h » et aucun trait n'existait. C'est le
 *    défaut que ce lot a appris à chercher : une phrase affichée que le code
 *    ne tient pas.
 * 2. **Les données en toutes lettres** — un tableau, avec sa légende, et pas
 *    seulement un `title` que le doigt n'atteint jamais.
 * 3. **La couleur n'est pas seule à parler** — ce qu'elle dit se relit
 *    ailleurs.
 * 4. **Les marques se voient** — 3:1 au moins sur leur fond, dans les deux
 *    modes, et c'est MESURÉ ici, pas supposé.
 */
import { readFileSync } from 'node:fs';
import { contraste } from './lib/couleurs.mjs';

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

const ecran = readFileSync('src/pages/statistiques.astro', 'utf8');

console.log('\n1. LA LIGNE ANNONCÉE EST TRACÉE (T27-07)');

vrai(
  'le texte annonce toujours la ligne pointillée',
  /ligne pointillée à 10\s?h/.test(ecran),
);
vrai('et le trait existe dans le balisage', /id="ligne-objectif"/.test(ecran));
vrai('en pointillés', /id="ligne-objectif"[\s\S]{0,400}?border-dashed/.test(ecran));
vrai(
  'posé à la hauteur que dix heures occupent sur l’échelle',
  /ligneObjectif\.style\.bottom\s*=\s*`\$\{\(\(10 \* 3600\) \/ maxSecondes\) \* 100\}%`/.test(ecran),
);
/* Le trait est décoratif : il double une information écrite. L'annoncer une
   seconde fois ferait répéter « dix heures » à un lecteur d'écran. */
vrai(
  'et il est masqué aux lecteurs d’écran, qui lisent déjà la phrase',
  /id="ligne-objectif"[\s\S]{0,200}?aria-hidden="true"/.test(ecran),
);

console.log('\n2. LES DONNÉES EN TOUTES LETTRES (T27-15, T27-16)');

for (const [quoi, id] of [
  ['l’histogramme hebdomadaire', 'tableau-histogramme'],
  ['l’échéancier', 'tableau-echeancier'],
] as const) {
  vrai(`${quoi} a un tableau de données`, new RegExp(`id="${id}"`).test(ecran));
  vrai(`${quoi} le remplit`, new RegExp(`\\$\\('${id}'\\)`).test(ecran));
}
v(
  'deux tableaux repliables, un par graphique',
  (ecran.match(/Voir les données du graphique/g) ?? []).length,
  2,
);
/* La légende dit ce que le tableau contient : sans elle, un lecteur d'écran
   annonce « tableau, trois colonnes » et rien d'autre. */
v('chacun porte sa légende', (ecran.match(/<caption/g) ?? []).length >= 2, true);
vrai(
  'l’échéancier a enfin un nom accessible',
  /id="echeancier"[^>]*role="img"/.test(ecran) && /echeancier\.setAttribute\(\s*'aria-label'/.test(ecran),
);
/*
   Le nom accessible ANNONCE, il ne récite pas : il disait les douze semaines
   d'une traite, ce qu'on ne peut ni relire ni comparer. Le tableau est fait
   pour cela.
*/
vrai(
  'et le nom de l’histogramme renvoie au tableau plutôt que de tout réciter',
  /Les valeurs sont dans le tableau sous le graphique/.test(ecran),
);

console.log('\n3. UN ÉTAT VIDE AVEC UNE ACTION (T27-15)');

for (const [quoi, id, lien] of [
  ['l’histogramme hebdomadaire', 'histogramme-vide', 'vers-planification'],
  ['l’échéancier', 'echeancier-vide', 'vers-flashcards'],
] as const) {
  vrai(`${quoi} dit quand il n’a rien à montrer`, new RegExp(`id="${id}"`).test(ecran));
  vrai(`${quoi} propose une suite`, new RegExp(`id="${lien}"`).test(ecran));
  vrai(
    `${quoi} mène quelque part`,
    new RegExp(`\\$\\('${lien}'\\)\\.setAttribute\\('href'`).test(ecran),
  );
}

console.log('\n4. LA COULEUR N’EST PAS LE SEUL CANAL (T27-11)');

/* Ce que la couleur dit des tranches, la colonne « Objectif » l'écrit. */
vrai(
  'la tranche de chaque semaine est écrite dans le tableau',
  /atteint/.test(ecran) && /à mi-chemin/.test(ecran) && /en deçà/.test(ecran),
);
vrai(
  'et « aujourd’hui » est nommé dans l’échéancier, pas seulement coloré',
  /'Aujourd’hui'/.test(ecran),
);

console.log('\n5. LES MARQUES SE VOIENT : 3:1 DANS LES DEUX MODES (T27-10)');

/*
   Les fonds sont ceux des cartes qui portent les graphiques : blanc en clair,
   « slate-900 » en sombre — c'est ce que `bg-white dark:bg-slate-900` pose sur
   les deux sections.
*/
const FOND_CLAIR = '#ffffff';
const FOND_SOMBRE = '#0f172a';
const TEINTES: Readonly<Record<string, string>> = {
  'emerald-400': '#34d399',
  'emerald-600': '#059669',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'amber-400': '#fbbf24',
  'amber-600': '#d97706',
};
const MARQUES: readonly [string, string, string][] = [
  ['objectif atteint', 'emerald-600', 'emerald-400'],
  ['à mi-chemin', 'indigo-500', 'indigo-400'],
  ['en deçà', 'slate-500', 'slate-400'],
  ['échéancier, aujourd’hui', 'amber-600', 'amber-400'],
  ['échéancier, autres jours', 'indigo-500', 'indigo-400'],
  ['la ligne d’objectif', 'slate-500', 'slate-400'],
];
for (const [quoi, clair, sombre] of MARQUES) {
  const enClair = contraste(TEINTES[clair], FOND_CLAIR);
  const enSombre = contraste(TEINTES[sombre], FOND_SOMBRE);
  vrai(
    `${quoi} : ${enClair.toFixed(2)}:1 en clair, ${enSombre.toFixed(2)}:1 en sombre`,
    enClair >= 3 && enSombre >= 3,
  );
}

/* Et les teintes mesurées sont bien celles que l'écran emploie : une mesure
   sur une table que le code n'utilise plus ne mesurerait rien. */
for (const [quoi, clair, sombre] of MARQUES) {
  if (quoi === 'la ligne d’objectif') continue;
  vrai(
    `${quoi} : l’écran emploie bien ces deux teintes`,
    ecran.includes(`bg-${clair} dark:bg-${sombre}`),
  );
}
vrai(
  'la ligne d’objectif aussi',
  /border-slate-500 dark:border-slate-400/.test(ecran),
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
