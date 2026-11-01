/**
 * La pastille de la revue, sur l'onglet Odyssée — V4 / décision 2 du 36.
 *
 *   npm run essais:pastille:navigateur
 *
 * Le bandeau de l'accueil disait déjà « la revue vous attend » ; le relevé
 * des reliquats notait que la seconde moitié de la recommandation — un
 * badge sur l'onglet Odyssée — manquait. Elle est là, et cet essai la
 * regarde **dans les deux états**, parce qu'un témoin qui s'allume
 * toujours ne dit rien.
 *
 * ## Pourquoi un essai de navigateur, et pas un contrôle de module
 *
 * `revueASignaler` lit la base. Son verdict se prouverait en module avec
 * un faux magasin, mais ce qu'on veut savoir est autre chose : que le
 * verdict **atteint la barre**. C'est la classe de défaut A-16 — chaque
 * morceau juste, et personne qui les relie.
 */
import { chromium } from 'playwright-core';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

let echecs = 0;
const v = (titre, obtenu, attendu) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu  ${JSON.stringify(obtenu)}\n      attendu ${JSON.stringify(attendu)}`);
};
const vrai = (t, c) => v(t, c, true);

const contexte = await nav.newContext();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const aller = async (chemin) => {
  await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
  }
  await page.waitForSelector('#entete-principal', { timeout: 40000 }).catch(() => {});
};

/** La pastille est-elle visible, une fois la barre peinte ? */
const pastilleVisible = async () => {
  for (let i = 0; i < 30; i += 1) {
    if (await page.locator('#pastille-revue').isVisible().catch(() => false)) return true;
    await page.waitForTimeout(400);
  }
  return false;
};

await franchirInitialisation(page, RACINE, MDP);

console.log('\n\x1b[1m1. OÙ ELLE EST, ET OÙ ELLE N’EST PAS\x1b[0m');
await aller('/revisions/');
/*
   Une seule, et sur Odyssée. Une pastille par branche serait une
   décoration ; sur la mauvaise branche, un mensonge.
*/
v('il n’y en a qu’une dans la page', await page.locator('#pastille-revue').count(), 1);
vrai(
  'et elle est dans le lien de la branche Odyssée',
  await page.evaluate(() =>
    Boolean(document.getElementById('pastille-revue')?.closest('[data-branche="odyssee"]')),
  ),
);

console.log('\n\x1b[1m2. DES REVUES MANQUENT : ELLE S’ALLUME\x1b[0m');
/*
   Profil neuf : aucune revue n'a jamais été tenue, donc `revuesManquees`
   en trouve sept. La prémisse se lit — on la vérifie plus bas en la
   retirant — plutôt que de se deviner.
*/
vrai('la pastille est visible depuis une page de Révisions', await pastilleVisible());
/*
   Sonde faible, et dite telle : `textContent` lit aussi un élément
   caché. Sabotée — la barre ne peignant plus rien —, elle reste verte,
   et c'est la ligne au-dessus qui accuse. Elle garde la formulation, pas
   la visibilité, et les deux sont nécessaires : un point sans libellé
   accessible ne dit rien à qui ne voit pas la couleur.
*/
v(
  'et son libellé dit la chose en toutes lettres (sonde faible : le texte, pas l’affichage)',
  (await page.textContent('#pastille-revue'))?.trim(),
  'La revue vous attend.',
);

console.log('\n\x1b[1m3. TOUTES LES REVUES TENUES : ELLE S’ÉTEINT\x1b[0m');
/*
   On écrit les revues du soir des quinze derniers jours, directement dans
   le magasin — il n'est pas scellé. C'est le seul moyen d'éprouver
   l'extinction : sans lui, la section 2 serait un témoin qui s'allume
   toujours, et on ne saurait pas s'il sait s'éteindre.

   Quinze jours couvrent largement les sept jours rattrapables, et le jour
   courant y est : sans lui, la revue du jour resterait due dans sa
   fenêtre horaire, et l'essai serait rouge une partie de la journée
   seulement — le pire des essais, celui qui dépend de l'heure.
*/
await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  const jours = [];
  for (let i = 0; i <= 15; i += 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    jours.push(d.toISOString().slice(0, 10));
  }
  await new Promise((ok, ko) => {
    const tx = base.transaction('odysseeRevues', 'readwrite');
    for (const jour of jours) {
      tx.objectStore('odysseeRevues').put({
        id: `soir:${jour}`,
        type: 'soir',
        jour,
        reponses: {},
        majLe: new Date().toISOString(),
      });
    }
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
});

await aller('/revisions/');
/*
   SONDE FAIBLE, ET IL FAUT LA DIRE PLUS FAIBLE QU'ELLE N'ÉTAIT DITE.

   Le commentaire d'origine annonçait que « le témoin de synchronisation,
   peint dans le même passage, sert de repère ». Ce n'est pas vrai : le témoin
   de synchronisation est peint par un AUTRE `quandDeverrouille` de
   « Base.astro », pour une autre fonction. Rien ne lie son apparition à la
   décision de la pastille, et il n'était de toute façon pas attendu ici —
   seules quatre secondes l'étaient.

   Et la décision de la pastille n'a AUCUNE marque. Son passage fait :

       if (await revueASignaler()) pastille.classList.replace('hidden', …);

   Quand la réponse est « non », il ne fait rien. L'absence qu'on lit est donc
   exactement ce qu'on lirait si le passage n'avait pas encore tourné — et
   aucune attente, même juste, ne peut distinguer les deux. Ce n'est pas une
   temporisation à remplacer : c'est une post-condition qui MANQUE AU SITE.

   Le remède exact est la marque de fin de peinture posée sur le conteneur de
   la pastille, décidée après la bascule et non à l'intérieur — elle attend
   la fusion de `claude/b-marque-peinture`. Tant qu'elle n'est pas là, cette
   ligne reste une sonde faible et le dit.

   CE QUI LA REND MALGRÉ TOUT UTILE est la section 2 puis le retour
   ci-dessous : la section 2 a montré, sur ce même contexte, que la pastille
   SAIT s'allumer — donc un passage entièrement mort est déjà exclu. Et le
   retour montre qu'elle sait se rallumer quand la donnée revient, ce qui
   prouve que la chaîne tourne encore à ce moment de l'essai. L'absence lue
   ici est encadrée par deux mesures bruyantes, à défaut d'être elle-même
   bruyante.
*/
await page.waitForTimeout(4000);
v(
  'la pastille a disparu (sonde faible : une absence n’a pas de marque — voir ci-dessus)',
  await page.locator('#pastille-revue').isVisible(),
  false,
);

console.log('\n\x1b[1m4. LA DONNÉE REVIENT : ELLE SE RALLUME\x1b[0m');
/*
   LE RETOUR, QUI DONNE UN OBJET À L'EXTINCTION.

   Sans lui, la section 3 est une absence lue après une attente à l'aveugle,
   et elle resterait verte si la chaîne avait cessé de tourner entre-temps —
   par exemple si une erreur levée dans un `quandDeverrouille` antérieur avait
   interrompu la file. On vide donc les revues et l'on exige que la pastille
   REVIENNE : c'est la seule assertion de cette section qui rougisse d'elle-même,
   et elle mesure au passage quelque chose que l'essai ne mesurait pas — que
   l'extinction est réversible, et non un aller simple.
*/
await page.evaluate(async () => {
  const base = await new Promise((ok) => {
    const r = indexedDB.open('revinsp');
    r.onsuccess = () => ok(r.result);
  });
  await new Promise((ok, ko) => {
    const tx = base.transaction('odysseeRevues', 'readwrite');
    tx.objectStore('odysseeRevues').clear();
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
  base.close();
});
await aller('/revisions/');
vrai('la pastille est revenue, donc la chaîne tournait bien', await pastilleVisible());

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
