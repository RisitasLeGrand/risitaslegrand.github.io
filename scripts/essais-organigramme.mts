/**
 * Les deux lectures d'un organigramme, et son texte complet.
 *
 *   npm run essais:organigramme
 *
 * ## Ce que cet essai garde
 *
 * Un organigramme se lit de deux façons — le squelette et le détail — et les
 * deux viennent d'une seule déclaration, pour qu'ils ne puissent pas dériver.
 * Trois règles tiennent cette promesse, et chacune évite une faute précise :
 *
 * — Un lien ne survit au squelette que si **ses deux bouts** y sont. L'autre
 *   choix dessinerait un trait vers une boîte absente, c'est-à-dire un
 *   rattachement inventé.
 * — La bascule n'existe que s'il y a **deux dessins différents**. Un bouton qui
 *   mène au même dessin est un bouton qui mente, et c'est le genre de faute
 *   qu'une revue ne voit pas et qu'un essai attrape.
 * — Le texte est **engendré** depuis les données. Écrit à la main, il se
 *   périmerait au premier nœud ajouté — et personne ne s'en apercevrait, parce
 *   qu'un texte de remplacement n'est lu que par ceux qui ne voient pas le
 *   dessin.
 *
 * ## L'organigramme employé ici est factice, et c'est voulu
 *
 * Il porte un directeur, trois pôles, deux divisions et une mission rattachée :
 * la forme d'une direction locale, sans en être une. Un essai qui dépendrait
 * d'une fiche réelle rougirait le jour où le contenu change de main, pour une
 * raison qui n'aurait rien à voir avec le rendu.
 */
import { enTexte, lecture, offreDeuxLectures } from '../src/features/correction/visuels/organigramme.ts';
import type { DonneesSchema } from '../src/features/correction/visuels/types.ts';

/** Le même nœud, sans son marque d'essentiel : « sans squelette déclaré ». */
const sansEssentiel = (n: { id: string; libelle: string; niveau: number }) => ({
  id: n.id,
  libelle: n.libelle,
  niveau: n.niveau,
});

let rouges = 0;
function v(intitule: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`  ${ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m'} ${intitule}`);
  if (!ok) {
    rouges += 1;
    console.log(`      obtenu  ${JSON.stringify(obtenu)}`);
    console.log(`      attendu ${JSON.stringify(attendu)}`);
  }
}

/** Une direction factice : un directeur, trois pôles, deux divisions, une mission. */
const DIRECTION: DonneesSchema = {
  noeuds: [
    { id: 'dir', libelle: 'Directeur départemental', niveau: 0, essentiel: true },
    { id: 'mission', libelle: 'Mission risques et audit', niveau: 1, essentiel: true },
    { id: 'pgf', libelle: 'Pôle gestion fiscale', niveau: 1, essentiel: true },
    { id: 'pgp', libelle: 'Pôle gestion publique', niveau: 1, essentiel: true },
    { id: 'ppr', libelle: 'Pôle pilotage et ressources', niveau: 1, essentiel: true },
    { id: 'div-gf', libelle: 'Division gestion fiscale', niveau: 2 },
    { id: 'div-aj', libelle: 'Division affaires juridiques', niveau: 2 },
  ],
  liens: [
    { de: 'dir', a: 'mission', libelle: 'rattachement direct' },
    { de: 'dir', a: 'pgf' },
    { de: 'dir', a: 'pgp' },
    { de: 'dir', a: 'ppr' },
    { de: 'pgf', a: 'div-gf' },
    { de: 'pgf', a: 'div-aj' },
  ],
};

console.log('\nDEUX LECTURES D’UNE SEULE DÉCLARATION');

v('la direction factice offre bien deux lectures', offreDeuxLectures(DIRECTION), true);
v(
  'le détail garde tous les nœuds',
  lecture(DIRECTION, false).noeuds.map((n) => n.id),
  ['dir', 'mission', 'pgf', 'pgp', 'ppr', 'div-gf', 'div-aj'],
);
v(
  'le squelette garde les nœuds essentiels, et eux seuls',
  lecture(DIRECTION, true).noeuds.map((n) => n.id),
  ['dir', 'mission', 'pgf', 'pgp', 'ppr'],
);

console.log('\nUN LIEN NE SURVIT QUE SI SES DEUX BOUTS SURVIVENT');

v(
  'le détail garde les six rattachements',
  lecture(DIRECTION, false).liens.length,
  6,
);
v(
  'le squelette perd les deux qui mènent aux divisions',
  lecture(DIRECTION, true).liens.map((l) => `${l.de}→${l.a}`),
  ['dir→mission', 'dir→pgf', 'dir→pgp', 'dir→ppr'],
);
v(
  'et aucun lien ne pointe vers un nœud absent du dessin',
  (() => {
    const { noeuds, liens } = lecture(DIRECTION, true);
    const vus = new Set(noeuds.map((n) => n.id));
    return liens.filter((l) => !vus.has(l.de) || !vus.has(l.a)).length;
  })(),
  0,
);

console.log('\nLA BASCULE N’EST OFFERTE QUE S’IL Y A DEUX DESSINS');

v(
  'un schéma sans aucun nœud essentiel n’offre pas de bascule',
  offreDeuxLectures({ noeuds: DIRECTION.noeuds.map(sansEssentiel) }),
  false,
);
v(
  'un schéma dont TOUS les nœuds sont essentiels non plus',
  offreDeuxLectures({ noeuds: DIRECTION.noeuds.map((n) => ({ ...n, essentiel: true })) }),
  false,
);
v(
  'un seul nœud essentiel ne fait pas une lecture',
  offreDeuxLectures({
    noeuds: [
      { id: 'a', libelle: 'A', niveau: 0, essentiel: true },
      { id: 'b', libelle: 'B', niveau: 1 },
    ],
  }),
  false,
);
v(
  'et demander le squelette d’un schéma qui n’en a pas rend le détail, non le vide',
  lecture({ noeuds: DIRECTION.noeuds.map(sansEssentiel) }, true).noeuds.length,
  7,
);

console.log('\nLE TEXTE COMPLET EST ENGENDRÉ, RANG PAR RANG');

v(
  'le détail dit les trois rangs',
  enTexte(DIRECTION, false).rangs.map((r) => `${r.niveau}:${r.libelles.length}`),
  ['0:1', '1:4', '2:2'],
);
v(
  'le squelette n’en dit plus que deux',
  enTexte(DIRECTION, true).rangs.map((r) => `${r.niveau}:${r.libelles.length}`),
  ['0:1', '1:4'],
);
v(
  'chaque rattachement est une phrase, et le libellé du lien y figure',
  enTexte(DIRECTION, true).liens[0],
  'De « Directeur départemental » à « Mission risques et audit » : rattachement direct.',
);
v(
  'un rattachement sans libellé reste une phrase complète',
  enTexte(DIRECTION, true).liens[1],
  'De « Directeur départemental » à « Pôle gestion fiscale ».',
);
v(
  'le texte nomme les nœuds par leur libellé, jamais par leur identifiant',
  enTexte(DIRECTION, false)
    .liens.filter((p) => /« (dir|pgf|pgp|ppr|div-gf|div-aj|mission) »/.test(p))
    .length,
  0,
);
v(
  'et le texte du détail porte autant de phrases que le dessin a de liens',
  enTexte(DIRECTION, false).liens.length,
  lecture(DIRECTION, false).liens.length,
);

console.log('\nCE QUE LE TEXTE FAIT D’UN SCHÉMA SANS LIEN, ET D’UN LIEN CASSÉ');

v(
  'un schéma sans lien rend un texte sans rattachement, et non une erreur',
  enTexte({ noeuds: [
    { id: 'a', libelle: 'A', niveau: 0 },
    { id: 'b', libelle: 'B', niveau: 1 },
  ] }, false).liens,
  [],
);
/*
   UN LIEN VERS UN NŒUD INCONNU EST ÉCARTÉ, DU DESSIN COMME DU TEXTE.

   C'est « lecture » qui l'écarte, parce qu'un trait vers une boîte absente est
   un rattachement inventé — et le texte, qui vient de la même fonction, ne le
   porte donc pas davantage. Le contrôle de contenu refuse déjà ce cas au
   build ; cette assertion dit ce que le rendu ferait s'il y arrivait tout de
   même, plutôt que de laisser la question ouverte.
*/
v(
  'un lien vers un identifiant inconnu est écarté du dessin',
  lecture(
    {
      noeuds: [
        { id: 'a', libelle: 'A', niveau: 0 },
        { id: 'b', libelle: 'B', niveau: 1 },
      ],
      liens: [
        { de: 'a', a: 'b' },
        { de: 'a', a: 'fantome' },
      ],
    },
    false,
  ).liens.map((l) => `${l.de}→${l.a}`),
  ['a→b'],
);
v(
  'et du texte, puisque les deux viennent de la même fonction',
  enTexte(
    {
      noeuds: [
        { id: 'a', libelle: 'A', niveau: 0 },
        { id: 'b', libelle: 'B', niveau: 1 },
      ],
      liens: [
        { de: 'a', a: 'b' },
        { de: 'a', a: 'fantome' },
      ],
    },
    false,
  ).liens,
  ['De « A » à « B ».'],
);

console.log(
  rouges === 0 ? '\n\u001b[32m✓ tout est vert\u001b[0m' : `\n\u001b[31m✗ ${rouges} rouge${rouges > 1 ? 's' : ''}\u001b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
