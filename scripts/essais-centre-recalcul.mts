/**
 * Le recalcul du texte depuis la source, et la règle de prudence.
 *
 *   npm run essais:centre-recalcul
 *
 * Ce que ces essais protègent, dans l'ordre où le mécanisme peut céder :
 *
 * - **une source inconnue ne s'affiche jamais**, coffre ouvert compris. Le
 *   repli silencieux — un libellé générique, « notification » — serait la
 *   fuite la plus facile à écrire et la plus difficile à voir ;
 * - **coffre fermé, c'est la politique déclarée qui parle**, et le
 *   résolveur n'est pas même appelé quand elle vaut `rien` ou `mention`.
 *   Un essai compte les appels : ne pas lire est la preuve ;
 * - **`null` n'est pas une chaîne vide.** La source qui ne reconnaît plus
 *   une référence rend `null` et l'élément part ; celle qui rend `''` a un
 *   défaut, et le défaut lève au lieu de passer pour un rendu ;
 * - **la mention ne dérive pas** de celle du prompt 38.
 */
import { MENTION_ETAT_SCELLE } from '../src/lib/odyssee/coffre-ferme';
import {
  MENTION_COFFRE,
  aSupprimer,
  registre,
  rendre,
  sAffiche,
  type Resolveur,
} from '../src/lib/notifications/recalcul';

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
const leve = async (intitule: string, f: () => Promise<unknown>, motif: RegExp) => {
  try {
    await f();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (motif.test(m)) {
      console.log(`  \x1b[32m✓\x1b[0m ${intitule}`);
      return;
    }
    echecs += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      levé mais : ${m}`);
    return;
  }
  echecs += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${intitule}\n      rien n’a été levé`);
};

/** Un résolveur d'essai qui compte ses appels : « a-t-il lu ? » est la question. */
const temoin = (
  source: string,
  coffreFerme: Resolveur['coffreFerme'],
  table: Record<string, string | null>,
) => {
  const etat = { appels: 0 };
  const r: Resolveur = {
    source,
    coffreFerme,
    async texte(ref) {
      etat.appels += 1;
      return ref in table ? table[ref] : null;
    },
  };
  return { r, etat };
};

console.log('\n\x1b[1mLa source inconnue\x1b[0m');
{
  const vide = registre([]);
  v(
    'coffre ouvert, elle ne s’affiche pas',
    await rendre({ source: 'inventee', refSource: 'r1' }, { coffreOuvert: true, resolveurs: vide }),
    { etat: 'inconnu' },
  );
  v(
    'coffre fermé non plus',
    await rendre({ source: 'inventee', refSource: 'r1' }, { coffreOuvert: false, resolveurs: vide }),
    { etat: 'inconnu' },
  );
  v('et « inconnu » ne produit pas de ligne', sAffiche({ etat: 'inconnu' }), false);
  v('ni une suppression : la source peut revenir', aSupprimer({ etat: 'inconnu' }), false);
}

console.log('\n\x1b[1mCoffre fermé : la politique déclarée, et rien d’autre\x1b[0m');
{
  const a = temoin('source-muette', 'rien', { r1: 'un texte' });
  const b = temoin('source-mention', 'mention', { r1: 'un texte' });
  const c = temoin('source-claire', 'texte', { r1: 'Sauvegarde conseillée' });
  const reg = registre([a.r, b.r, c.r]);
  const ferme = { coffreOuvert: false, resolveurs: reg };

  v('« rien » masque l’élément', await rendre({ source: 'source-muette', refSource: 'r1' }, ferme), {
    etat: 'masque',
  });
  v('et la source n’a pas été lue', a.etat.appels, 0);
  v(
    '« mention » rend la mention',
    await rendre({ source: 'source-mention', refSource: 'r1' }, ferme),
    { etat: 'illisible', texte: MENTION_COFFRE },
  );
  v('et la source n’a pas été lue non plus', b.etat.appels, 0);
  v(
    '« texte » rend le texte, parce que ses données ne sont pas scellées',
    await rendre({ source: 'source-claire', refSource: 'r1' }, ferme),
    { etat: 'lisible', texte: 'Sauvegarde conseillée' },
  );
  v('et celle-là, oui, a été lue', c.etat.appels, 1);
  v('une ligne « illisible » s’affiche quand même', sAffiche({ etat: 'illisible', texte: MENTION_COFFRE }), true);
  v('une ligne « masquée », non', sAffiche({ etat: 'masque' }), false);
}

console.log('\n\x1b[1mCoffre ouvert : le texte vient de la source\x1b[0m');
{
  const a = temoin('source-muette', 'rien', { r1: 'le vrai titre' });
  const ouvert = { coffreOuvert: true, resolveurs: registre([a.r]) };
  v(
    'même une source « rien » parle une fois le coffre ouvert',
    await rendre({ source: 'source-muette', refSource: 'r1' }, ouvert),
    { etat: 'lisible', texte: 'le vrai titre' },
  );
  v('et elle a été lue', a.etat.appels, 1);
}

console.log('\n\x1b[1m`null` n’est pas une chaîne vide\x1b[0m');
{
  const a = temoin('s', 'texte', { connue: 'un texte', vide: '', blanc: '   ' });
  const reg = registre([a.r]);
  const ouvert = { coffreOuvert: true, resolveurs: reg };

  v('une référence absente rend l’élément orphelin', await rendre({ source: 's', refSource: 'partie' }, ouvert), {
    etat: 'orphelin',
  });
  v('et un orphelin se supprime', aSupprimer({ etat: 'orphelin' }), true);
  v('sans s’afficher au passage', sAffiche({ etat: 'orphelin' }), false);
  await leve(
    'une chaîne vide lève au lieu de passer pour un rendu',
    () => rendre({ source: 's', refSource: 'vide' }, ouvert),
    /texte vide/,
  );
  await leve(
    'une chaîne d’espaces aussi',
    () => rendre({ source: 's', refSource: 'blanc' }, ouvert),
    /texte vide/,
  );
}

console.log('\n\x1b[1mLe registre\x1b[0m');
{
  const a = temoin('双', 'texte', {});
  const b = temoin('双', 'rien', {});
  await leve('deux résolveurs pour une source, c’est une erreur', async () => registre([a.r, b.r]), /Deux résolveurs/);
}

console.log('\n\x1b[1mLa mention ne dérive pas\x1b[0m');
v('même formulation qu’au prompt 38', MENTION_COFFRE, MENTION_ETAT_SCELLE);

console.log(
  echecs === 0 ? '\n\x1b[32mTous les essais passent.\x1b[0m\n' : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
