/**
 * La garde qui empêche le mot de passe du site de retourner dans le dépôt.
 *
 * ## Ce qui s'est passé
 *
 * Huit scripts d'essai portaient le mot de passe en clair, et ils étaient suivis
 * par Git. Le dépôt est public — un compte gratuit l'exige pour servir GitHub
 * Pages. Le mot de passe, qui est la seule chose protégeant le contenu chiffré
 * du site, était donc publiquement lisible.
 *
 * Le retirer ne suffit pas : ce qui a été commis une fois revient facilement,
 * au prochain essai de navigateur qu'on écrira dans l'urgence. D'où cette garde.
 *
 * ## Deux contrôles, dont un qui tourne toujours
 *
 *  1. **Structurel, sans secret.** Aucun fichier suivi ne doit remplir le champ
 *     de mot de passe avec une chaîne littérale. C'est la forme exacte qu'avait
 *     la fuite, et le contrôle ne demande de connaître aucun secret : il tourne
 *     donc partout, tout le temps.
 *
 *  2. **Exact, quand le mot de passe est disponible.** Si `SITE_PASSWORD` est
 *     dans l'environnement (ou dans `.env.local`), aucun fichier suivi ne doit
 *     le contenir, sous aucune forme.
 *
 * Le second contrôle est le plus sûr, mais il ne peut pas tourner sans le
 * secret. Le premier est plus faible et ne dépend de rien. Les deux ensemble
 * couvrent le cas réel.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..');

let echecs = 0;
const verifier = (titre, ok, detail = '') => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok && detail) console.log(detail);
};

/** Les fichiers suivis par Git, qui sont exactement ceux qui partent au dépôt. */
const suivis = execFileSync('git', ['ls-files', '-z'], { cwd: RACINE, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

/** Contenu d'un fichier suivi, ou null s'il n'est pas lisible comme du texte. */
function lire(relatif) {
  try {
    const brut = readFileSync(path.join(RACINE, relatif));
    // Un binaire porte des octets nuls ; inutile d'y chercher du texte.
    if (brut.includes(0)) return null;
    return brut.toString('utf8');
  } catch {
    return null;
  }
}

console.log('\nAUCUNE CHAÎNE LITTÉRALE DANS LE CHAMP DE MOT DE PASSE');

/*
 * `fill('#champ-mdp', 'quelque chose')` est la forme qu'avait la fuite. Une
 * variable est acceptée — c'est ce que fait désormais le module partagé.
 */
const LITTERAL = /#champ-mdp\s*['"]\s*,\s*['"`]/;
const coupables = suivis.filter((f) => {
  const t = lire(f);
  return t ? LITTERAL.test(t) : false;
});
verifier(
  'aucun fichier suivi ne remplit le champ avec une chaîne écrite sur place',
  coupables.length === 0,
  coupables.map((f) => `      ${f}`).join('\n'),
);

console.log('\nLE MOT DE PASSE N’APPARAÎT DANS AUCUN FICHIER SUIVI');

function motDePasse() {
  if (process.env.SITE_PASSWORD) return process.env.SITE_PASSWORD;
  const chemin = path.join(RACINE, '.env.local');
  if (!existsSync(chemin)) return null;
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const m = /^\s*SITE_PASSWORD\s*=\s*(.*)\s*$/.exec(ligne);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

const mdp = motDePasse();
if (!mdp) {
  console.log(
    '  \x1b[33m⚠\x1b[0m contrôle exact non exécuté : SITE_PASSWORD n’est pas disponible.\n' +
      '      Le contrôle structurel ci-dessus a tourné. Pour le contrôle exact :\n' +
      '      SITE_PASSWORD=… npm run essais:secret',
  );
} else if (mdp.length < 4) {
  // Un secret trop court produirait des coïncidences dans n'importe quel texte.
  console.log('  \x1b[33m⚠\x1b[0m mot de passe trop court pour être cherché sans faux positifs.');
} else {
  const porteurs = suivis.filter((f) => {
    const t = lire(f);
    return t ? t.includes(mdp) : false;
  });
  verifier(
    'aucun fichier suivi ne contient le mot de passe',
    porteurs.length === 0,
    porteurs.map((f) => `      ${f}`).join('\n'),
  );
}

console.log('\nLE FICHIER DE SECRET RESTE IGNORÉ PAR GIT');

verifier('.env.local n’est pas suivi', !suivis.includes('.env.local'));
verifier(
  '.gitignore l’ignore explicitement',
  /^\.env\.local$/m.test(lire('.gitignore') ?? ''),
);
verifier('content/ n’est pas suivi', !suivis.some((f) => f.startsWith('content/')));

console.log(
  echecs
    ? `\n\x1b[31m${echecs} contrôle(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mAucun secret dans les fichiers suivis.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
