/**
 * La politique du `.schema`, mesurée au navigateur — point 1 de la voie 58 p2.
 *
 *   npm run essais:schema:navigateur
 *
 * ## Ce que celui-ci prouve, et que le contrôle pur ne peut pas prouver
 *
 * `essais:politique-restauration` éprouve la DÉCISION, sans navigateur. Il ne
 * dit rien de deux propriétés qui ne vivent que dans l'exécution :
 *
 * 1. **le refus arrive AVANT toute écriture.** Une politique juste appliquée
 *    trop tard ne vaut rien : la base serait déjà remplacée quand le message
 *    paraît. On compte donc la base après le refus, et on exige qu'elle n'ait
 *    pas bougé d'un enregistrement ;
 * 2. **les paliers tournent vraiment.** Le dessin fait passer les données par
 *    une base temporaire ouverte à la version du fichier, puis rouverte à la
 *    version courante. C'est élégant sur le papier ; il faut le CONSTATER.
 *
 * ## Les fichiers sont forgés ici, et c'est ce qui rend l'essai possible
 *
 * `format.ts` est un module pur : il ne lit ni base, ni DOM, ni réseau. On
 * peut donc fabriquer dans Node une sauvegarde qui annonce la version qu'on
 * veut, ce qu'aucun geste d'écran ne permettrait.
 *
 * Le cas « version antérieure » est éprouvé avec le palier 14 et lui seul —
 * l'horloge logique des entrées de révision. C'est délibéré : il est gardé par
 * `if (!entree.hlc)`, donc le faire tourner sur des données qui portent déjà
 * leur horloge ne les abîme pas. Forger un fichier qui MENTIRAIT sur sa
 * version, en annonçant 10 avec des données d'aujourd'hui, ferait rejouer le
 * palier 12 et dédoublerait des socles : l'essai prouverait alors surtout
 * qu'on peut se faire du mal.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { franchirInitialisation } from './lib/franchir-initialisation.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';
import { devientVisible } from './lib/post-condition.mjs';
import { ecrire } from '../src/lib/sauvegarde/format';

const MDP = motDePasseEssais();
const RACINE = 'http://localhost:4321';
const S = process.env.DOSSIER_ESSAIS ?? '/tmp';

/**
 * Attend qu'une zone PARLE, et rend ce qu'elle dit.
 *
 * `annonceDe` existe dans `lib/post-condition.mjs`, mais sur la branche des
 * temporisations : elle n'est pas encore sur `main`, d'où part ce lot. La
 * recopier ici serait la faute que ce chantier corrige ; l'écrire comme une
 * boucle bornée qui RAPPORTE, en attendant que la branche soit fusionnée, ne
 * l'est pas — et la forme est la bonne : si la borne est atteinte sans
 * message, elle rend la chaîne vide et c'est l'assertion qui accuse, avec son
 * intitulé, au lieu d'une panne loin de la ligne en cause.
 */
const annonceDe = async (zone: string, delai = 30000) => {
  const fin = Date.now() + delai;
  for (;;) {
    const dit = ((await page.textContent(zone).catch(() => null)) ?? '').trim();
    if (dit !== '') return dit;
    if (Date.now() > fin) return '';
    await page.waitForTimeout(100);
  }
};

/**
 * Attend le message FINAL d'une zone qui annonce son travail.
 *
 * CET ÉCRAN CHANGE DE TEXTE DEUX FOIS. Il écrit d'abord « Déchiffrement et
 * restauration en cours… », puis le verdict. `annonceDe`, qui rend le premier
 * texte non vide, rendait donc l'annonce du travail et non son résultat — et
 * six assertions sont tombées en lisant « en cours… ».
 *
 * C'est la règle que j'ai écrite ce matin dans un autre fichier, et que je
 * viens de ne pas appliquer dans celui-ci : un écran qui annonce son travail
 * demande qu'on attende la SECONDE écriture, pas la première.
 */
const travailFini = async (zone: string, delai = 60000) => {
  const fin = Date.now() + delai;
  for (;;) {
    const dit = ((await page.textContent(zone).catch(() => null)) ?? '').trim();
    if (dit !== '' && !/en cours/i.test(dit)) return dit;
    if (Date.now() > fin) return dit;
    await page.waitForTimeout(100);
  }
};

/**
 * Répond « Remplacer » à la confirmation destructrice.
 *
 * ON ATTEND LA BOÎTE, ON NE LA TESTE PAS. Ma première version demandait
 * `isVisible()` juste après le clic : la boîte n'était pas encore ouverte, la
 * réponse était « non », et `appliquer` sortait sur son `if (!remplacer)
 * return`. L'écran ne disait donc rien du tout, et six assertions tombaient en
 * accusant la politique du `.schema` — qui n'y était pour rien. C'est le défaut
 * même que je corrige dans les essais depuis ce matin, écrit de ma main dans un
 * essai neuf.
 */
const repondreALaConfirmation = async () => {
  const bouton = page.locator('dialog[open] button', { hasText: /^Remplacer$/ }).first();
  await bouton.waitFor({ state: 'visible', timeout: 30000 });
  await bouton.click();
};

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${titre}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${titre}\n      obtenu  ${a}\n      attendu ${b}`);
};
const vrai = (t: string, c: boolean) => v(t, c, true);

/* La version locale, lue à la source — jamais recopiée. */
const SOURCE_DB = readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
const TROUVE = /^export const VERSION = (\d+);$/m.exec(SOURCE_DB);
if (!TROUVE) {
  console.log('  \x1b[31m✗\x1b[0m NON MESURABLE — « export const VERSION » introuvable');
  process.exit(3);
}
const VERSION = Number(TROUVE[1]);

/** Forge une sauvegarde qui annonce la version voulue. */
async function forger(schema: number, magasins: Record<string, unknown[]>) {
  /*
     TOUS LES CHAMPS SONT RENSEIGNÉS, et j'ai dû m'y reprendre : ma première
     version passait l'objet avec un `as never` pour faire taire le type, et
     oubliait `portee`. Le fichier s'écrivait, l'aperçu le refusait pour une
     raison qui n'avait rien à voir avec le `.schema`, et l'essai accusait la
     politique. Faire taire un type, c'est se priver du seul relecteur qui
     lisait vraiment.
  */
  const { octets } = await ecrire({
    magasins,
    branches: [{ id: 'revisions', schema, magasins: Object.keys(magasins) }],
    versionApplication: 'essai',
    portee: { branches: ['revisions'] },
    motDePasse: MDP,
  });
  return octets;
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await nav.newContext({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 160)));

const compter = (magasin: string) =>
  page.evaluate(async (nom) => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    if (![...base.objectStoreNames].includes(nom)) {
      base.close();
      return -1;
    }
    const n: number = await new Promise((ok) => {
      const q = base.transaction(nom).objectStore(nom).count();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return n;
  }, magasin);

const revisionsEnBase = () =>
  page.evaluate(async () => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const tout: unknown[] = await new Promise((ok) => {
      const q = base.transaction('revisions').objectStore('revisions').getAll();
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return tout as { id: string; hlc?: string; lot?: string }[];
  });

const allerAProgression = async () => {
  await page.goto(`${RACINE}/progression/`, { waitUntil: 'networkidle' });
  if (await page.locator('#champ-mdp').isVisible().catch(() => false)) {
    await page.fill('#champ-mdp', MDP);
    await page.click('#bouton-verrou');
    await devientVisible(page, '#champ-mdp', false, { delai: 30000 });
  }
  await page.locator('#fichier-cyclades').waitFor({ state: 'visible', timeout: 30000 });
};

/**
 * Donne le mot de passe DU FICHIER, qui n'est pas celui du site.
 *
 * Les fichiers forgés ici sont chiffrés, comme l'est une sauvegarde normale, et
 * l'écran demande donc leur mot de passe — « son mot de passe est nécessaire ».
 * Je l'avais oublié, et l'essai a d'abord accusé la politique du `.schema` pour
 * un refus qui disait exactement ce qu'il fallait : un message juste, lu par un
 * essai qui cherchait le mauvais.
 */
const donnerLeMotDePasseDuFichier = async () => {
  const champ = page.locator('#mdp-restauration');
  await champ.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await champ.isVisible().catch(() => false)) await champ.fill(MDP);
};

await franchirInitialisation(page, RACINE, MDP);
await allerAProgression();

console.log('\n\x1b[1m1. UNE SAUVEGARDE PLUS RÉCENTE EST REFUSÉE, ET RIEN N’EST ÉCRIT\x1b[0m');
{
  /*
     On sème d'abord, pour qu'il y ait quelque chose à perdre. Un refus sur une
     base vide ne prouverait rien : « rien n'a été écrasé » est trivialement
     vrai quand il n'y avait rien.
  */
  await page.evaluate(async () => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    await new Promise<void>((ok, non) => {
      const t = base.transaction('fiches', 'readwrite');
      t.objectStore('fiches').put({ id: 'fiche-temoin-du-refus', titre: 'Témoin' });
      t.oncomplete = () => ok();
      t.onerror = () => non(t.error);
    });
    base.close();
  });
  const avant = await compter('fiches');
  vrai('prémisse : la base porte quelque chose à perdre', avant > 0);

  const chemin = `${S}/trop-recent.cyclades`;
  writeFileSync(chemin, await forger(VERSION + 1, { fiches: [{ id: 'venue-du-futur' }] }));

  await page.setInputFiles('#fichier-cyclades', chemin);
  await annonceDe('#message-cyclades');
  /* L'aperçu s'ouvre, puis on applique : c'est « appliquer » qui doit refuser. */
  const appliquer = page.locator('#appliquer-cyclades');
  await donnerLeMotDePasseDuFichier();
  await appliquer.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await appliquer.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const e = document.getElementById('message-cyclades');
      if (e) e.textContent = '';
    });
    await appliquer.click();
    await repondreALaConfirmation();
    await travailFini('#message-cyclades');
  }

  const dit = (await page.textContent('#message-cyclades')) ?? '';
  console.log(`      l’écran dit : « ${dit.slice(0, 150)} »`);
  vrai('le message dit que rien n’a été touché', /[Rr]ien n’a été touché/.test(dit));
  vrai('et dit quoi faire : recharger', /[Rr]echargez/.test(dit));
  /*
     LA PROPRIÉTÉ QUI COMPTE. Le reste est du texte ; ceci est la garantie.
  */
  v('et la base n’a pas bougé d’un enregistrement', await compter('fiches'), avant);
  vrai(
    'le témoin semé est toujours là',
    (await page.evaluate(async () => {
      const base: IDBDatabase = await new Promise((ok) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
      });
      const vu: unknown = await new Promise((ok) => {
        const q = base.transaction('fiches').objectStore('fiches').get('fiche-temoin-du-refus');
        q.onsuccess = () => ok(q.result);
      });
      base.close();
      return Boolean(vu);
    })),
  );
}

console.log('\n\x1b[1m2. UNE SAUVEGARDE PLUS ANCIENNE TRAVERSE LES PALIERS\x1b[0m');
{
  /*
     Une entrée de journal de révision SANS horloge logique, telle qu'en
     écrivait la version 13. Le palier 14 doit lui en donner une, dérivée de sa
     propre date — « une entrée de l'an dernier doit porter l'instant logique
     de l'an dernier, sans quoi elle se rangerait après des révisions qu'elle a
     précédées ».
  */
  /*
     L'IDENTITÉ DE L'APPAREIL, RELEVÉE AVANT. C'est l'assertion qui a trouvé un
     vrai défaut : la base de passage, créée vide à la version du fichier,
     exécute le palier 12 et s'écrit un `etat.appareil` tiré au hasard. Cet
     identifiant entrait dans les données restaurées et écrasait celui de
     l'appareil réel — qui départage deux horloges logiques égales et fonde
     l'ordre de fusion. Un appareil devenu inconnu de ses pairs, sans un mot.
  */
  const appareilAvant = await page.evaluate(async () => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const vu: unknown = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('appareil');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return (vu as string) ?? null;
  });
  vrai('prémisse : cet appareil a une identité', typeof appareilAvant === 'string' && appareilAvant.length > 0);

  const LE = '2025-03-04T10:00:00.000Z';
  const chemin = `${S}/ancienne.cyclades`;
  writeFileSync(
    chemin,
    await forger(13, {
      revisions: [
        { id: 'entree-sans-horloge', carteId: 'c1', le: LE, genre: 'notation', appareil: 'essai' },
      ],
    }),
  );

  await allerAProgression();
  await page.setInputFiles('#fichier-cyclades', chemin);
  await annonceDe('#message-cyclades');
  const appliquer = page.locator('#appliquer-cyclades');
  await appliquer.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  vrai('l’aperçu s’ouvre et propose d’appliquer', await appliquer.isVisible().catch(() => false));
  await donnerLeMotDePasseDuFichier();
  if (await appliquer.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const e = document.getElementById('message-cyclades');
      if (e) e.textContent = '';
    });
    await appliquer.click();
    await repondreALaConfirmation();
    await travailFini('#message-cyclades');
  }

  const dit = (await page.textContent('#message-cyclades')) ?? '';
  console.log(`      l’écran dit : « ${dit.slice(0, 220)} »`);
  vrai('la restauration est annoncée faite', /[Rr]estauration faite/.test(dit));
  vrai(
    'et la phrase dit que les données ont été mises à la forme actuelle',
    /mises à la forme actuelle/.test(dit),
  );

  const entrees = await revisionsEnBase();
  v('l’entrée est bien en base', entrees.length, 1);
  /*
     LA MESURE. Le fichier portait une entrée SANS horloge ; la base en porte
     une AVEC. Rien dans la restauration ne l'a écrite : c'est le palier 14 qui
     a tourné, dans sa vraie forme, parce que les données ont traversé une base
     ouverte à la version 13 puis rouverte à la version courante.
  */
  vrai('et elle a reçu une horloge logique qu’elle n’avait pas', Boolean(entrees[0]?.hlc));
  vrai('un lot, même vide, lui a été donné', typeof entrees[0]?.lot === 'string');
  /*
     ET L'HORLOGE EST DÉRIVÉE DE SA PROPRE DATE, non de l'heure du rejeu. Un
     palier qui prendrait l'horloge vivante rangerait une entrée de l'an
     dernier après des révisions qu'elle a précédées, et le recalcul FSRS en
     sortirait faux. L'horloge commence par la date en millisecondes.
  */
  v(
    'dérivée de la date de l’entrée, et non de l’heure du rejeu',
    entrees[0]?.hlc?.startsWith(String(Date.parse(LE)).padStart(15, '0')),
    true,
  );

  /*
     ET L'IDENTITÉ N'A PAS BOUGÉ. Le fichier ne portait aucun `etat` ; la base
     de passage, elle, s'en est forgé un. Si cette assertion tombait, cela
     voudrait dire qu'une restauration d'une version antérieure change
     l'identité de l'appareil — ce que personne ne demande et que rien
     n'annoncerait.
  */
  const appareilApres = await page.evaluate(async () => {
    const base: IDBDatabase = await new Promise((ok) => {
      const r = indexedDB.open('revinsp');
      r.onsuccess = () => ok(r.result);
    });
    const vu: unknown = await new Promise((ok) => {
      const q = base.transaction('etat').objectStore('etat').get('appareil');
      q.onsuccess = () => ok(q.result);
    });
    base.close();
    return (vu as string) ?? null;
  });
  /*
     CE QUE CETTE ASSERTION DIT, ET CE QU'ELLE NE DIT PAS — et j'ai dû la
     corriger après l'avoir vue tomber.

     J'avais écrit « l'identité n'a pas bougé », et elle est tombée : `null`
     au lieu de l'identifiant d'avant. La cause n'est pas la migration mais
     « Remplacer », qui vide TOUS les magasins connus avant de réécrire ceux
     que le fichier porte. Mon fichier forgé ne porte que `revisions`, donc
     `etat` finit vide. Une sauvegarde réelle porte `etat`, et le cas ne se
     présente pas ; ici, il se présente parce que le fichier est artificiel.

     Préserver l'identité au travers d'une restauration est l'objet de B-7 —
     « s'il s'y ajoute : on garde appareil, horloge, appairage, lotsRecus et
     appareilsVus » — et c'est le point 3 de cette voie, pas celui-ci.

     Ce que le point 1 peut affirmer, et qui est la raison d'être de cette
     assertion : la migration n'INVENTE pas d'identité. L'identifiant d'après
     est donc celui du fichier, ou rien — jamais un troisième, tiré au hasard
     pour une base jetable. C'est ce défaut-là qu'elle garde, et elle le garde
     vraiment : avant la correction, elle aurait lu une valeur inconnue.
  */
  vrai(
    'la migration n’invente aucune identité : celle du fichier, ou rien',
    appareilApres === null || appareilApres === appareilAvant,
  );
}

await nav.close();
console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec${echecs > 1 ? 's' : ''}.\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
