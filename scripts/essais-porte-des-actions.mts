/**
 * La porte des actions DIT que ça continue — et ne coupe rien (lot 9).
 *
 *   npm run essais:porte-des-actions
 *
 * ## Le défaut, mesuré le 26 octobre
 *
 * `agirPuisPeindre` attrapait une promesse qui ÉCHOUE. Elle ne disait rien
 * d'une promesse qui ne se règle NI dans un sens NI dans l'autre : `await`
 * ne revenait jamais, le `finally` de l'appelant ne rendait pas le bouton, et
 * rien ne paraissait. C'est le silence que `agir.ts` a été écrit pour finir,
 * revenu par une autre porte.
 *
 * Le seul plafond du site était celui de `chargement.ts` — 5 s au
 * déverrouillage, 56 écrans. La porte des ACTIONS n'en avait aucun.
 *
 * ## Ce que cet essai éprouve, et ce qu'il refuse d'éprouver
 *
 * La décision du Pilote est qu'il n'y a PAS de couperet : une action n'est
 * jamais interrompue par un délai, parce que couper un export de deux cents
 * mégaoctets remplacerait un bouton mort par une sauvegarde à moitié écrite.
 * Le contrôle central est donc double, et c'est le second qui compte le plus :
 *
 * 1. passé le délai, le message PARAÎT ;
 * 2. et l'action n'est PAS coupée — sa promesse est toujours en attente.
 *
 * Un essai qui ne tiendrait que le premier laisserait passer un couperet
 * ajouté par mégarde, et c'est la panne la plus coûteuse des deux.
 *
 * ## Pourquoi un double de DOM, et jusqu'où il va
 *
 * C'est la forme d'`essais:emission` : des doubles posés sur `globalThis`,
 * puis un import DYNAMIQUE du module, pour que les doubles existent avant que
 * le module ne s'évalue.
 *
 * Le double ne connaît qu'un sélecteur, `[data-texte]`, et il JETTE sur tout
 * autre. Un double qui répondrait n'importe quoi en silence serait pire que
 * pas de double : l'essai passerait au vert en mesurant autre chose.
 */

/* ── Le double de DOM ───────────────────────────────────────────────────── */

interface Noeud {
  tag: string;
  id: string;
  hidden: boolean;
  className: string;
  type: string;
  textContent: string;
  style: Record<string, string>;
  dataset: Record<string, string>;
  attributs: Record<string, string>;
  enfants: Noeud[];
  classes: Set<string>;
  classList: { add: (c: string) => void; remove: (c: string) => void };
  setAttribute: (nom: string, valeur: string) => void;
  getAttribute: (nom: string) => string | null;
  appendChild: (n: Noeud) => void;
  addEventListener: () => void;
  querySelector: (selecteur: string) => Noeud | null;
}

const creer = (tag: string): Noeud => {
  const n: Noeud = {
    tag,
    id: '',
    hidden: false,
    className: '',
    type: '',
    textContent: '',
    style: {},
    dataset: {},
    attributs: {},
    enfants: [],
    classes: new Set<string>(),
    classList: {
      add: (c: string) => n.classes.add(c),
      remove: (c: string) => n.classes.delete(c),
    },
    setAttribute: (nom, valeur) => {
      n.attributs[nom] = valeur;
    },
    getAttribute: (nom) => n.attributs[nom] ?? null,
    appendChild: (e) => {
      n.enfants.push(e);
    },
    addEventListener: () => {},
    querySelector: (selecteur) => {
      if (selecteur !== '[data-texte]') {
        throw new Error(`double de DOM : sélecteur « ${selecteur} » non connu`);
      }
      const chercher = (dans: Noeud): Noeud | null => {
        for (const enfant of dans.enfants) {
          if ('texte' in enfant.dataset) return enfant;
          const trouve = chercher(enfant);
          if (trouve) return trouve;
        }
        return null;
      };
      return chercher(n);
    },
  };
  return n;
};

const corps = creer('body');
const parId = (id: string): Noeud | null => {
  const chercher = (dans: Noeud): Noeud | null => {
    for (const enfant of dans.enfants) {
      if (enfant.id === id) return enfant;
      const trouve = chercher(enfant);
      if (trouve) return trouve;
    }
    return null;
  };
  return chercher(corps);
};

(globalThis as Record<string, unknown>).document = {
  body: corps,
  createElement: (tag: string) => creer(tag),
  getElementById: (id: string) => parId(id),
};

const { agirPuisPeindre, PHRASE_ATTENTE } = await import('../src/lib/agir');

/* ── Les assertions ─────────────────────────────────────────────────────── */

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
/** Le délai d'annonce des essais : court, pour ne pas faire attendre la batterie. */
const DELAI = 20;

const attente = () => parId('attente-de-page');
const texteDeLAttente = (): string | null => {
  const zone = attente();
  if (!zone || zone.hidden) return null;
  return zone.querySelector('[data-texte]')?.textContent ?? null;
};

/* ══════════════════════════════════════════════════════════════════════════
   1. Une action brève ne dit rien
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\u001b[1mUNE ACTION BRÈVE NE DIT RIEN\u001b[0m');
/*
   Le premier devoir de cette annonce est de ne pas exister. Si elle paraissait
   à chaque enregistrement de ligne, on apprendrait à ne plus la lire, et le
   jour où elle dirait quelque chose personne ne la verrait.
*/
v('aucune région d’attente avant tout appel', attente(), null);
await agirPuisPeindre(async () => {}, { delaiAvertissement: DELAI });
v('une action instantanée n’annonce rien', texteDeLAttente(), null);

/* ══════════════════════════════════════════════════════════════════════════
   2. Une action qui ne se règle jamais : le message paraît, RIEN n'est coupé
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\u001b[1mUNE ACTION QUI NE SE RÈGLE JAMAIS\u001b[0m');
{
  let regler: () => void = () => {};
  let rendue = false;
  const porte = agirPuisPeindre(() => new Promise<void>((ok) => { regler = ok; }), {
    delaiAvertissement: DELAI,
  });
  void porte.then(() => {
    rendue = true;
  });

  await pause(DELAI / 2);
  v('avant le délai, rien n’est dit', texteDeLAttente(), null);

  await pause(DELAI * 3);
  v('passé le délai, la porte dit que ça continue', texteDeLAttente(), PHRASE_ATTENTE);
  v('la région est annoncée poliment, et non en alerte', attente()?.getAttribute('role'), 'status');
  v('la phrase entière est relue quand elle change', attente()?.getAttribute('aria-atomic'), 'true');
  /*
     LE CONTRÔLE QUI COMPTE LE PLUS. Cinq fois le délai écoulés, l'action n'est
     ni coupée ni abandonnée : la porte n'a pas rendu, donc le bouton de
     l'appelant reste occupé — ce qui est la vérité, l'action tourne encore.
  */
  await pause(DELAI * 5);
  v('et l’action n’est PAS coupée : la porte n’a pas rendu', rendue, false);
  v('le message est toujours là, car l’attente dure toujours', texteDeLAttente(), PHRASE_ATTENTE);

  /* Et au règlement, le message s'en va de lui-même : il n'a aucun bouton. */
  regler();
  v('la porte rend enfin', await porte, true);
  v('et le message s’en va au règlement', texteDeLAttente(), null);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. L'échec, et le repeint
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\u001b[1mL’ÉCHEC ET LE REPEINT\u001b[0m');
/*
   Un message d'attente qui survivrait à l'action serait un mensonge affiché.
   Il y a trois sorties — succès, échec de l'action, échec du repeint — et
   `retirer()` est appelé dans un `finally` pour les couvrir toutes les trois.
*/
{
  const rendu = await agirPuisPeindre(
    async () => {
      await pause(DELAI * 3);
      throw new Error('Ce fichier n’est pas une sauvegarde valide.');
    },
    { delaiAvertissement: DELAI },
  );
  v('une action qui échoue rend false', rendu, false);
  v('et le message d’attente ne survit pas à l’échec', texteDeLAttente(), null);
  v(
    'l’échec, lui, est dit',
    parId('echec-de-page')?.querySelector('[data-texte]')?.textContent,
    'Ce fichier n’est pas une sauvegarde valide.',
  );
}
/*
   L'ANNONCE COUVRE LE REPEINT : une lecture qui remet la liste debout peut
   être aussi longue que l'écriture. L'action est brève ici, le repeint non.
*/
{
  let vuPendantLeRepeint: string | null = null;
  await agirPuisPeindre(async () => {}, {
    delaiAvertissement: DELAI,
    peindre: async () => {
      await pause(DELAI * 3);
      vuPendantLeRepeint = texteDeLAttente();
    },
  });
  v('un repeint lent est annoncé lui aussi', vuPendantLeRepeint, PHRASE_ATTENTE);
  v('et le message s’en va après le repeint', texteDeLAttente(), null);
}

/* ══════════════════════════════════════════════════════════════════════════
   4. La progression, pour une action longue par nature
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\u001b[1mLA PROGRESSION REMPLACE LA PHRASE GÉNÉRIQUE\u001b[0m');
/*
   « 1 240 enregistrements sur 4 128 » vaut mieux que « ça continue », et pour
   la raison que `chargement.ts` donne déjà : une attente chiffrée se termine,
   une attente vague se répète.
*/
{
  let ecrits = 0;
  const vus: (string | null)[] = [];
  await agirPuisPeindre(
    async () => {
      /* D'abord l'annonce, alors que l'action ne sait encore rien. */
      await pause(DELAI * 2);
      vus.push(texteDeLAttente());
      /* Puis elle avance, et le rafraîchissement doit le reprendre. */
      ecrits = 1240;
      await pause(DELAI * 3);
      vus.push(texteDeLAttente());
      ecrits = 4128;
      await pause(DELAI * 3);
      vus.push(texteDeLAttente());
    },
    {
      delaiAvertissement: DELAI,
      progression: () => (ecrits ? `${ecrits} enregistrements écrits` : null),
    },
  );
  /*
     TROIS LECTURES, et c'est la SUITE qui prouve quelque chose : la première
     montre le repli générique, les deux autres que le rafraîchissement
     reprend la progression à mesure qu'elle change. Mon assertion précédente
     ne regardait qu'une variable posée par l'action : verte, et vide.
  */
  v('la progression paraît, et se reprend à mesure', vus, [
    PHRASE_ATTENTE,
    '1240 enregistrements écrits',
    '4128 enregistrements écrits',
  ]);
  v('et elle s’en va au règlement comme l’autre', texteDeLAttente(), null);
}
{
  /* Une action qui ne sait pas encore où elle en est ne se taît pas pour autant. */
  let vu: string | null = null;
  await agirPuisPeindre(
    async () => {
      await pause(DELAI * 3);
      vu = texteDeLAttente();
    },
    { delaiAvertissement: DELAI, progression: () => null },
  );
  v('une progression qui ne sait rien retombe sur la phrase générique', vu, PHRASE_ATTENTE);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Les sabotages
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n\u001b[1mLES SABOTAGES\u001b[0m');
/*
   PREMIER SABOTAGE — l'annonce vient-elle vraiment du DÉLAI ? Si elle venait
   de l'appel lui-même, le contrôle n°2 passerait au vert sans rien garder : il
   suffirait qu'une action soit longue pour que le message paraisse, délai ou
   pas. On règle donc le délai à zéro, et une action qui ne se règle JAMAIS
   doit rester muette.
*/
{
  let regler: () => void = () => {};
  const porte = agirPuisPeindre(() => new Promise<void>((ok) => { regler = ok; }), {
    delaiAvertissement: 0,
  });
  await pause(DELAI * 5);
  v('délai à zéro : même une action sans fin reste muette', texteDeLAttente(), null);
  regler();
  await porte;
}
/*
   SECOND SABOTAGE — le message s'efface-t-il parce que l'action s'est réglée,
   ou simplement parce que du temps a passé ? On laisse l'attente paraître, on
   attend longtemps SANS régler, et le message doit toujours être là. Sans ce
   contrôle, un `effacerLAttente()` posé par erreur dans le minuteur
   lui-même passerait inaperçu, et l'annonce ne durerait qu'un battement.
*/
{
  let regler: () => void = () => {};
  const porte = agirPuisPeindre(() => new Promise<void>((ok) => { regler = ok; }), {
    delaiAvertissement: DELAI,
  });
  await pause(DELAI * 10);
  v('le message dure autant que l’attente, et ne clignote pas', texteDeLAttente(), PHRASE_ATTENTE);
  regler();
  await porte;
  v('il ne s’efface qu’au règlement', texteDeLAttente(), null);
}
/*
   TROISIÈME SABOTAGE — les deux régions sont-elles bien distinctes ? Si
   l'attente empruntait la région des échecs, elle serait annoncée en ALERTE
   — elle crierait pour dire que tout va bien —, et le message d'échec
   l'écraserait.
*/
v(
  'la région d’attente n’est pas celle des échecs',
  parId('attente-de-page') === parId('echec-de-page'),
  false,
);
v('celle des échecs reste une alerte', parId('echec-de-page')?.getAttribute('role'), 'alert');

console.log(
  echecs === 0 ? '\n\u001b[32m✓ tout passe\u001b[0m\n' : `\n\u001b[31m✗ ${echecs} échecs\u001b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
