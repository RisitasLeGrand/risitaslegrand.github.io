/**
 * « Afficher » : aucun champ de mot de passe sans son œil (D3 du prompt 43).
 *
 *   npm run essais:mot-de-passe-visible
 *
 * ## Ce que cet essai garde, et que l'essai de navigateur ne peut pas garder
 *
 * L'essai de navigateur visite les écrans qu'on lui nomme. Celui-ci part de
 * l'autre bout : il relève **tous** les champs de mot de passe de `src/`, et
 * exige que le fichier qui les porte équipe ses champs — ou qu'il figure dans
 * la table des exceptions, avec sa raison écrite.
 *
 * Sans ce relevé, un neuvième écran ajouté demain porterait un champ nu, et
 * aucun essai ne le dirait : le navigateur ne visite que ce qu'on lui a appris
 * à visiter. C'est la même forme de ceinture que « Lu par » du 56.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

/**
 * Les fichiers qui portent un champ de mot de passe sans l'équiper, et
 * pourquoi.
 *
 * Une seule entrée, et elle n'est pas un choix de conception : le pilote a
 * réservé `appareils.astro` au constructeur pour toute la durée du 43, avec la
 * synchronisation. Ses trois champs restent donc nus, et cette ligne est là
 * pour que personne — moi compris — ne croie que D3 est complet.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  'src/pages/appareils.astro':
    'réservé au constructeur pour la durée du 43 (synchronisation) : ses trois champs attendent.',
};

/** Le module qui pose le bouton, et les deux façons de l'appeler. */
const POSE = /\bposer(LesYeux|Loeil)\s*\(/;
/** Un champ de mot de passe, dans le balisage ou fabriqué au vol. */
const CHAMP = [/type\s*=\s*["']password["']/, /\.type\s*=\s*['"]password['"]/];

function fichiers(racine: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(astro|ts|svelte)$/.test(entree)) sortie.push(chemin);
  }
  return sortie;
}

console.log('\n1. TOUT CHAMP DE MOT DE PASSE EST ÉQUIPÉ, OU DÉCLARÉ');

const porteurs = fichiers('src')
  .filter((f) => f !== 'src/lib/mot-de-passe-visible.ts')
  .map((f) => [f, readFileSync(f, 'utf8')] as const)
  .filter(([, texte]) => CHAMP.some((r) => r.test(texte)));

vrai('des champs de mot de passe existent, et le relevé les trouve', porteurs.length > 0);

const nus = porteurs
  .filter(([, texte]) => !POSE.test(texte))
  .map(([f]) => f)
  .filter((f) => !(f in EXCEPTIONS));
v('aucun fichier ne porte un champ sans son bouton', nus, []);

for (const [fichier, raison] of Object.entries(EXCEPTIONS)) {
  vrai(`l’exception « ${fichier} » dit pourquoi`, raison.length >= 30);
  vrai(
    `et elle porte bien un champ : une exception périmée se verrait`,
    porteurs.some(([f]) => f === fichier),
  );
}

console.log('\n2. LE BOUTON EST CE QUE LA DÉCISION DEMANDE');

const module = readFileSync('src/lib/mot-de-passe-visible.ts', 'utf8');
vrai('il est de type « button », et ne soumet donc aucun formulaire', /bouton\.type = 'button'/.test(module));
vrai('il porte « aria-pressed »', /aria-pressed/.test(module));
vrai('son libellé prévient que le texte sera lisible', /lisible à l’écran/.test(module));
vrai('il atteint 44 px par la classe des boutons à icône', /cible-tactile-pleine/.test(module));
vrai('il ne lit jamais la valeur du champ', !/champ\.value(?!\.length)/.test(module));
vrai(
  'et il ne garde rien entre deux pages',
  !/localStorage|sessionStorage|indexedDB/.test(module),
);

console.log(rouges ? `\n\x1b[31m${rouges} rouge(s).\x1b[0m` : '\n\x1b[32mTout est vert.\x1b[0m');
process.exit(rouges ? 1 : 0);
