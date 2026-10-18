/**
 * L'inventaire des réglages, en tableau — P1 du prompt 42.
 *
 *   npm run inventaire:reglages            (affiche)
 *   npm run inventaire:reglages -- <fichier>   (écrit aussi le Markdown)
 *
 * Le relevé lui-même est dans `scripts/lib/inventaire-reglages.mjs`, parce
 * que l'essai des orphelins s'en sert aussi : un inventaire qui sert à
 * contrôler ne peut pas être une sortie d'écran qu'on relit à la main.
 */
import { writeFileSync } from 'node:fs';
import { inventaire } from './lib/inventaire-reglages.mjs';

const i = inventaire();
const lignes = [];
const dire = (texte = '') => lignes.push(texte);

dire('# Inventaire des réglages (P1 du 42)');
dire();
dire(`Relevé mécanique du ${new Date().toISOString().slice(0, 10)}, par`);
dire('`npm run inventaire:reglages`. Les écritures d’abord, jamais les titres.');
dire();
dire('## Les règles de portée');
dire();
for (const [nom, regle] of Object.entries(i.regles)) dire(`- **${nom}** — ${regle}`);
dire();
dire('### Les exceptions nommées');
dire();
dire(
  'La première règle se lit **au module** : c’est trop large d’un cran. Chaque',
);
dire(
  'faux positif connu est nommé ici, avec sa raison, et `essais:reglages-orphelins`',
);
dire('échoue si une autre clé en clair paraît dans un module qui scelle.');
dire();
const exceptions = Object.entries(i.exceptions);
if (exceptions.length === 0) dire('Aucune.');
else
  for (const [id, e] of exceptions) dire(`- \`${id}\` → **${e.portee}**. ${e.raison}`);
dire();
dire(`## Les ${i.cles.length} clés de réglage`);
dire();
dire('| Stockage | Clé | Portée | Écrit par | Lu par |');
dire('|---|---|---|---|---|');
for (const c of i.cles) {
  const court = (liste) =>
    liste.length === 0 ? '—' : liste.map((f) => `\`${f.replace('src/', '')}\``).join('<br>');
  dire(
    `| ${c.stockage} | \`${c.cle}\`${c.sure ? '' : ' ⚠️'} | ${c.portee} | ${court(c.ecrivains)} | ${court(c.lecteurs)} |`,
  );
}
dire();
dire('⚠️ = clé non littérale (gabarit ou variable) : relevée telle quelle.');
dire();
dire(`## Les ${i.formes.length} formes de réglage et leurs valeurs par défaut`);
dire();
for (const f of i.formes) {
  dire(`### \`${f.nom}\` — \`${f.fichier}\``);
  dire();
  if (!f.defauts) dire('Aucun littéral `…PAR_DEFAUT` trouvé dans le fichier.');
  else {
    dire('| Champ | Type | Défaut |');
    dire('|---|---|---|');
    for (const champ of f.champs)
      dire(`| \`${champ.nom}\` | \`${champ.type}\` | ${f.defauts[champ.nom] ?? '—'} |`);
  }
  dire();
}
dire(`## Les ${i.ecrans.length} fonctions d’écriture appelées depuis un écran`);
dire();
dire('| Fonction | Module | Écrans |');
dire('|---|---|---|');
for (const e of i.ecrans)
  dire(
    `| \`${e.fonction}\` | \`${e.module.replace('src/', '')}\` | ${e.ecrans
      .map((f) => `\`${f.replace('src/', '')}\``)
      .join('<br>')} |`,
  );
dire();
dire('## Doubles');
dire();
const doubles = i.cles.filter((c) => c.ecrivains.length > 1);
if (doubles.length === 0) dire('Aucune clé écrite depuis deux modules.');
for (const c of doubles)
  dire(`- \`${c.stockage}::${c.cle}\` — écrite par ${c.ecrivains.length} modules.`);
dire();
dire(
  `## Hors inventaire : ${i.donnees.length} clés de **donnée** (pesées, séances, tâches…), qui ne se règlent pas.`,
);

const texte = lignes.join('\n');
const cible = process.argv[2];
if (cible) {
  writeFileSync(cible, `${texte}\n`);
  console.log(`Écrit : ${cible}`);
}
console.log(texte);
