/**
 * La persistance se demande d'elle-même, au bon moment (A4 du prompt 43).
 *
 *   npm run essais:persistance
 *
 * ## Le défaut
 *
 * `demanderPersistance()` existait depuis longtemps, et UN SEUL bouton
 * l'appelait, sur la page Stockage. Personne n'allant sur cette page, la
 * permission qui empêche le navigateur d'effacer les données pour faire de la
 * place n'était, en pratique, jamais demandée. Le code était là ; la demande
 * n'avait pas lieu.
 *
 * ## Ce que cet essai éprouve, et comment
 *
 * `assurerLaPersistance()` est une fonction qui lit `navigator.storage` et
 * `localStorage`. Les deux sont remplacés ici par des doubles sous contrôle :
 * on choisit ce que le navigateur répond, et on observe ce que la fonction
 * fait. Pas de navigateur, donc pas de hasard, et les cinq situations sont
 * toutes jouables — y compris celle qu'un vrai navigateur ne produit presque
 * jamais à la demande, un `localStorage` qui jette.
 *
 * Les quatre réponses attendues :
 * - déjà accordé → ne redemande pas ;
 * - indisponible → ne demande pas, et ne casse pas ;
 * - demandé il y a moins d'une semaine → attend ;
 * - demandé il y a plus d'une semaine, ou jamais → redemande, et note la date.
 */
import {
  assurerLaPersistance,
  CLE_PERSISTANCE_DEMANDEE,
  DELAI_ENTRE_DEMANDES_MS,
} from '../src/lib/stockage.ts';

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

const MAINTENANT = Date.UTC(2026, 9, 19, 10, 0, 0);

interface Double {
  appels: number;
  ecrit: string | null;
}

/** Monte un navigateur de papier, et rend de quoi l'observer. */
function monter(options: {
  disponible?: boolean;
  deja?: boolean;
  accorde?: boolean;
  dernier?: number | null;
  stockageCasse?: boolean;
}): Double {
  const double: Double = { appels: 0, ecrit: null };
  const g = globalThis as unknown as Record<string, unknown>;

  /*
     `globalThis.navigator` n'est pas assignable sous Node 22 : il n'a qu'un
     accesseur en lecture. On le REDÉFINIT donc, ce qui est permis, au lieu de
     l'affecter. Trouvé en lançant l'essai, pas en le relisant.
  */
  const poserGlobal = (nom: string, valeur: unknown) => {
    Object.defineProperty(g, nom, { value: valeur, configurable: true, writable: true });
  };

  poserGlobal(
    'navigator',
    options.disponible === false
      ? {}
      : {
          storage: {
            persisted: async () => Boolean(options.deja),
            persist: async () => {
              double.appels += 1;
              return Boolean(options.accorde);
            },
          },
        },
  );

  poserGlobal('localStorage', {
    getItem: (cle: string) => {
      if (options.stockageCasse) throw new Error('Données de site bloquées.');
      return cle === CLE_PERSISTANCE_DEMANDEE && options.dernier
        ? String(options.dernier)
        : null;
    },
    setItem: (cle: string, valeur: string) => {
      if (options.stockageCasse) throw new Error('Données de site bloquées.');
      if (cle === CLE_PERSISTANCE_DEMANDEE) double.ecrit = valeur;
    },
    removeItem: () => {},
  });
  return double;
}

console.log('\n\x1b[1mQUAND LA PERSISTANCE EST DEMANDÉE, ET QUAND ELLE NE L’EST PAS\x1b[0m\n');

{
  const d = monter({ deja: true });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('déjà accordée : on ne redemande pas', [suite.raison, d.appels], ['accorde-deja', 0]);
  v('et on le dit accordé', suite.accorde, true);
}

{
  const d = monter({ disponible: false });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('navigateur sans l’API : rien n’est demandé', [suite.raison, d.appels], ['indisponible', 0]);
  v('et rien n’est cassé', suite.disponible, false);
}

{
  const d = monter({ dernier: MAINTENANT - 1000, accorde: true });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('demandée il y a une seconde : on attend', [suite.raison, d.appels], ['trop-recent', 0]);
}

{
  const d = monter({ dernier: MAINTENANT - (DELAI_ENTRE_DEMANDES_MS - 1), accorde: true });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('une seconde avant le délai : on attend encore', [suite.raison, d.appels], ['trop-recent', 0]);
}

{
  const d = monter({ dernier: MAINTENANT - DELAI_ENTRE_DEMANDES_MS, accorde: true });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('le délai écoulé : on redemande', [suite.raison, d.appels], ['demandee', 1]);
  v('et la date est notée', d.ecrit, String(MAINTENANT));
  v('un accord est rapporté', suite.accorde, true);
}

{
  const d = monter({ dernier: null, accorde: false });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('jamais demandée : on demande', [suite.raison, d.appels], ['demandee', 1]);
  v('un refus est rapporté sans drame', suite.accorde, false);
  v('et la date est notée quand même, pour tenir le délai', d.ecrit, String(MAINTENANT));
}

{
  /*
     Le cas qui n'arrive qu'en fenêtre privée, et qui a sa raison d'être
     éprouvé : un `localStorage` qui jette ne doit pas empêcher la demande.
     Au pire on redemande plus souvent que prévu — moins grave que de ne
     jamais demander.
  */
  const d = monter({ stockageCasse: true, accorde: true });
  const suite = await assurerLaPersistance(MAINTENANT);
  v('un stockage illisible n’empêche pas la demande', [suite.raison, d.appels], ['demandee', 1]);
  v('et la fonction ne jette pas', suite.accorde, true);
}

console.log('\n\x1b[1mCE QUI APPELLE CETTE FONCTION\x1b[0m\n');

{
  /*
     La demande doit partir d'un endroit, sinon tout ce qui précède ne garde
     rien — c'était exactement le défaut d'origine : une fonction juste que
     personne n'appelait.
  */
  const { readFileSync } = await import('node:fs');
  const progression = readFileSync('src/pages/progression.astro', 'utf8');
  v(
    'l’écran de progression la demande après une sauvegarde confirmée',
    /assurerLaPersistance/.test(progression),
    true,
  );
  v(
    'et elle est demandée dans la suite de « J’ai retrouvé le fichier »',
    /sauvegarde-retrouvee[\s\S]{0,2000}assurerLaPersistance/.test(progression),
    true,
  );
}

console.log(
  rouges === 0
    ? '\n\x1b[32mTout est vert.\x1b[0m\n'
    : `\n\x1b[31m${rouges} essai(s) en échec.\x1b[0m\n`,
);
process.exit(rouges === 0 ? 0 : 1);
