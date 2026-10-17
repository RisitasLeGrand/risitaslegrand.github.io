/**
 * La reprise du coffre sous une clé neuve : on ne perd jamais rien.
 *
 * C'est la seule étape du chantier du coffre qui touche aux données, et
 * Alexis l'a assortie d'une condition — « sans perte de données ». Ces essais
 * sont la façon de tenir cette condition autrement que par une promesse.
 *
 * L'invariant visé, et il est unique :
 *
 * > À tout instant, chaque enregistrement est lisible sous au moins une clé.
 *
 * On ne le vérifie pas en relisant le code : on **coupe le courant** au
 * milieu, à chaque pas possible, et on regarde ce qui reste.
 */
import {
  MAGASINS_SCELLES,
  ouvrir,
  sceller,
} from '../src/lib/noyau/coffre';
import {
  CLEF_JOURNAL,
  magasinsAReprendre,
  reprendreLeCoffre,
  type JournalDeMigration,
  type RangementDesMagasins,
} from '../src/lib/noyau/migration-du-coffre';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      obtenu  ${a}\n      attendu ${b}`);
};

const cleNeuve = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

/**
 * Une base en mémoire, qui sait aussi **tomber en panne** au n-ième écrit.
 *
 * C'est elle qui rend l'interruption éprouvable : sans elle, on ne saurait
 * tester que le cas où tout se passe bien, c'est-à-dire le seul cas qui n'a
 * pas besoin d'être testé.
 */
const base = (couperApres = Infinity) => {
  const magasins = new Map<string, Map<string, Record<string, unknown>>>();
  let journal: JournalDeMigration | undefined;
  let ecrits = 0;
  return {
    magasins,
    get ecrits() {
      return ecrits;
    },
    port: {
      lireTout: async (m: string) =>
        [...(magasins.get(m) ?? new Map()).entries()].map(([clef, valeur]) => ({ clef, valeur })),
      ecrire: async (m: string, clef: IDBValidKey, valeur: Record<string, unknown>) => {
        ecrits += 1;
        if (ecrits > couperApres) throw new Error('COUPURE');
        if (!magasins.has(m)) magasins.set(m, new Map());
        magasins.get(m)!.set(String(clef), valeur);
      },
      lireJournal: async () => journal,
      ecrireJournal: async (j: JournalDeMigration) => void (journal = j),
    } satisfies RangementDesMagasins,
    get journal() {
      return journal;
    },
  };
};

/** Trois magasins réellement déclarés, et de quoi les remplir. */
const TROIS = MAGASINS_SCELLES.slice(0, 3).map((m) => m.magasin);

const remplir = async (b: ReturnType<typeof base>, cle: CryptoKey, parMagasin = 4) => {
  for (const magasin of TROIS) {
    const decl = MAGASINS_SCELLES.find((m) => m.magasin === magasin)!;
    for (let i = 0; i < parMagasin; i += 1) {
      const enregistrement: Record<string, unknown> = { secret: `contenu ${magasin} ${i}` };
      // Les champs clairs déclarés doivent exister, sinon le scellé n'a rien
      // à laisser en clair et l'essai ne ressemble plus à la réalité.
      for (const champ of decl.clairs) enregistrement[champ] = `${champ}-${i}`;
      const range = await sceller(cle, magasin, enregistrement);
      if (!b.magasins.has(magasin)) b.magasins.set(magasin, new Map());
      b.magasins.get(magasin)!.set(String(i), range);
    }
  }
};

/** Tout ce qui est rangé est-il lisible sous l'une des deux clés ? */
const toutEstLisible = async (
  b: ReturnType<typeof base>,
  cles: CryptoKey[],
): Promise<string[]> => {
  const perdus: string[] = [];
  for (const [magasin, contenu] of b.magasins) {
    for (const [clef, valeur] of contenu) {
      let lu = false;
      for (const cle of cles) {
        for (const champ of ['scelle', 'scelle2']) {
          if (!valeur[champ]) continue;
          try {
            const o = await ouvrir<Record<string, unknown>>(cle, {
              ...valeur,
              scelle: valeur[champ],
            });
            if (typeof o.secret === 'string') lu = true;
          } catch {
            /* cette combinaison ne marche pas, on essaie la suivante */
          }
        }
      }
      if (!lu) perdus.push(`${magasin}/${clef}`);
    }
  }
  return perdus;
};

console.log('\nLA LISTE DES MAGASINS SE LIT DANS LE REGISTRE, ELLE N’EST PAS RECOPIÉE');

v(
  'autant de magasins à reprendre que le registre en déclare',
  magasinsAReprendre().length,
  MAGASINS_SCELLES.length,
);
v(
  'et ce sont exactement les mêmes',
  magasinsAReprendre().slice(0, 3),
  MAGASINS_SCELLES.slice(0, 3).map((m) => m.magasin),
);

console.log('\nUNE REPRISE COMPLÈTE REND TOUT LISIBLE SOUS LA CLÉ NEUVE, ET ELLE SEULE');

{
  const ancienne = await cleNeuve();
  const neuve = await cleNeuve();
  const b = base();
  await remplir(b, ancienne);

  const compte = await reprendreLeCoffre(b.port, ancienne, neuve);
  v('douze enregistrements repris', compte.enregistrements, 12);
  v('le journal dit que c’est fini', b.journal?.passe, 'fini');

  v('tout se lit sous la clé neuve', await toutEstLisible(b, [neuve]), []);
  /*
     Et plus sous l'ancienne : c'est le but même de l'opération. Si cet essai
     passait au vert avec l'ancienne clé, le coffre serait toujours ouvrable
     par le mot de passe du site, et tout ce travail n'aurait rien changé.
  */
  const sousLAncienne = await toutEstLisible(b, [ancienne]);
  v('et plus rien ne se lit sous l’ancienne', sousLAncienne.length, 12);

  let restes = 0;
  for (const [, contenu] of b.magasins) for (const [, val] of contenu) if (val.scelle2) restes += 1;
  v('aucune copie de travail ne traîne', restes, 0);
}

console.log('\nUNE COUPURE NE PERD JAMAIS RIEN, À AUCUN MOMENT');

{
  /*
     On coupe après 1, 2, 3… écritures, et à chaque fois on vérifie que tout
     reste lisible sous l'une des deux clés. C'est le défaut que la méthode
     vise : une migration qui écrase en place perdrait l'enregistrement en
     cours à la première coupure.
  */
  const ancienne = await cleNeuve();
  const neuve = await cleNeuve();
  const perdus: string[] = [];
  const reprises: string[] = [];

  for (let coupe = 1; coupe <= 30; coupe += 1) {
    const b = base(coupe);
    await remplir(b, ancienne);
    try {
      await reprendreLeCoffre(b.port, ancienne, neuve);
    } catch (e) {
      if ((e as Error).message !== 'COUPURE') throw e;
    }
    const p = await toutEstLisible(b, [ancienne, neuve]);
    if (p.length > 0) perdus.push(`coupure ${coupe} : ${p.join(', ')}`);

    /*
       Et la reprise doit aboutir. Une migration qu'on ne peut pas reprendre
       après une coupure laisse la personne devant une base à moitié
       convertie, sans geste pour en sortir.
    */
    const b2 = { ...b, port: { ...b.port } } as unknown as ReturnType<typeof base>;
    try {
      const sain = base();
      sain.magasins.clear();
      for (const [m, c] of b.magasins) sain.magasins.set(m, new Map(c));
      await reprendreLeCoffre(sain.port, ancienne, neuve);
      const apres = await toutEstLisible(sain, [neuve]);
      if (apres.length > 0) reprises.push(`coupure ${coupe} : ${apres.join(', ')}`);
    } catch (e) {
      reprises.push(`coupure ${coupe} : la reprise lève — ${(e as Error).message}`);
    }
    void b2;
  }
  v('trente coupures, aucun enregistrement illisible', perdus, []);
  v('et après chacune, la reprise aboutit', reprises, []);
}

console.log('\nUNE COPIE QUI SE CORROMPT APRÈS COUP ARRÊTE TOUT, AVANT LE MOINDRE EFFACEMENT');

{
  const ancienne = await cleNeuve();
  const neuve = await cleNeuve();
  const etrangere = await cleNeuve();
  const b = base();
  await remplir(b, ancienne);

  /*
     Le défaut visé, et il a fallu le recadrer : corrompre la copie AVANT la
     migration ne prouve rien, parce que la passe 1 réécrit toute copie
     existante depuis l'original — elle répare au lieu de laisser détecter, et
     c'est une bonne propriété. Le risque réel est ailleurs : une copie écrite
     correctement par la passe 1, puis abîmée avant que la passe 3 efface
     l'original. C'est exactement ce qu'on simule ici, en se greffant sur le
     passage au journal de la passe « relire ».

     Sans la deuxième passe, la troisième installerait ce scellé illisible et
     effacerait l'original : un enregistrement perdu, en silence.
  */
  /*
     On vise le DEUXIÈME magasin, pas le premier : le journal de la passe
     « relire » s'écrit à la fin de chaque magasin, donc au premier passage le
     magasin 0 est déjà relu et l'injection arriverait trop tard. L'essai
     passait alors au vert sans rien prouver.
  */
  const faux = await sceller(etrangere, TROIS[1], { secret: 'illisible' });
  const ecrireJournal = b.port.ecrireJournal;
  let corrompu = false;
  b.port.ecrireJournal = async (j) => {
    if (j.passe === 'relire' && !corrompu) {
      corrompu = true;
      const cible = b.magasins.get(TROIS[1])!;
      const [clef, valeur] = [...cible.entries()][0];
      cible.set(clef, { ...valeur, scelle2: faux.scelle });
    }
    return ecrireJournal(j);
  };

  let leve = '';
  try {
    await reprendreLeCoffre(b.port, ancienne, neuve);
  } catch (e) {
    leve = (e as Error).message;
  }
  v('la corruption a bien été injectée', corrompu, true);
  v('la reprise lève', leve.includes('écart'), true);
  v(
    'et rien n’a été effacé : tout se lit encore sous l’ancienne',
    (await toutEstLisible(b, [ancienne])).length,
    0,
  );
}

console.log('\nLE JOURNAL DIT OÙ L’ON EN EST');

{
  const ancienne = await cleNeuve();
  const neuve = await cleNeuve();
  const b = base(5);
  await remplir(b, ancienne);
  try {
    await reprendreLeCoffre(b.port, ancienne, neuve);
  } catch {
    /* coupure attendue */
  }
  v('la clé du journal est stable', CLEF_JOURNAL, 'coffre.migration');
  v('le journal nomme la passe en cours', b.journal?.passe, 'copier');
  v('et il porte une date de début', typeof b.journal?.commenceeLe, 'string');
}

console.log(echecs === 0 ? '\n\x1b[32m✓ tout est vert\x1b[0m\n' : `\n\x1b[31m✗ ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs === 0 ? 0 : 1);
