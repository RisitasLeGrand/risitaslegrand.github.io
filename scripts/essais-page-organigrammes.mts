/**
 * La section « ## Organigrammes » : rien sans date, rien sans source.
 *
 *   npm run essais:page-organigrammes
 *
 * ## Ce que cet essai garde
 *
 * Un organigramme de référence se consulte seul, des mois après avoir été
 * écrit, et l'organisation d'une administration bouge. Sans date il devient une
 * affirmation sans réserve ; sans source, une affirmation sans preuve. La
 * construction doit donc REFUSER les deux absences, et non les signaler : un
 * avertissement se lit une fois et s'oublie.
 *
 * Il garde aussi ce qui se perd le plus facilement — la cohérence du registre
 * des écrans. L'écran « Organigrammes » ne vaut que pour les trois parcours de
 * la DGFiP ; un identifiant de parcours mal orthographié ne se verrait nulle
 * part, sinon par un lien qui ne s'affiche jamais.
 */
import { organigrammeSchema } from '../scripts/lib/schema.mjs';
import { BRANCHES, controlerBranches } from '../src/lib/branches.ts';
import { PARCOURS } from '../src/lib/parcours/registre.ts';

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

/** Un organigramme factice complet, dont on retirera un champ à la fois. */
const COMPLET = {
  titre: 'La direction départementale type',
  alt: 'Un directeur, trois pôles et une mission rattachée.',
  legende: 'Trois pôles : la forme la plus fréquente, pas la seule.',
  source: 'Annonce MEF_2026-32583, DDFiP de la Haute-Saône',
  date: '2026-10',
  donnees: {
    noeuds: [
      { id: 'dir', libelle: 'Directeur départemental', niveau: 0, essentiel: true },
      { id: 'pgf', libelle: 'Pôle gestion fiscale', niveau: 1, essentiel: true },
      { id: 'pgp', libelle: 'Pôle gestion publique', niveau: 1, essentiel: true },
      { id: 'div', libelle: 'Division', niveau: 2 },
    ],
    liens: [
      { de: 'dir', a: 'pgf' },
      { de: 'dir', a: 'pgp' },
      { de: 'pgf', a: 'div' },
    ],
  },
};

const sans = (champ: string) => {
  const copie: Record<string, unknown> = { ...COMPLET };
  delete copie[champ];
  return copie;
};
const accepte = (objet: unknown) => organigrammeSchema.safeParse(objet).success;
const pourquoi = (objet: unknown) => {
  const r = organigrammeSchema.safeParse(objet);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

console.log('\nUN ORGANIGRAMME COMPLET PASSE');

v('l’organigramme factice est accepté', accepte(COMPLET), true);
v('et sa légende reste facultative', accepte(sans('legende')), true);

console.log('\nRIEN SANS DATE, RIEN SANS SOURCE');

v('sans source, refusé', accepte(sans('source')), false);
v(
  'et le refus dit pourquoi, plutôt que « champ requis »',
  pourquoi(sans('source')).some((m) => m.includes('affirmation sans preuve')),
  true,
);
v('sans date, refusé', accepte(sans('date')), false);
v('source vide, refusée comme absente', accepte({ ...COMPLET, source: '' }), false);
v('source faite d’espaces, refusée aussi', accepte({ ...COMPLET, source: '   ' }), false);

console.log('\nLA DATE S’ÉCRIT À L’ANNÉE ET AU MOIS AU MOINS');

for (const [date, attendu] of [
  ['2026-10', true],
  ['2025-07-15', true],
  ['2026', false],
  ['juillet 2025', false],
  ['2026-10-15-01', false],
  ['10-2026', false],
] as const) {
  v(`« ${date} » est ${attendu ? 'acceptée' : 'refusée'}`, accepte({ ...COMPLET, date }), attendu);
}

console.log('\nLE DESSIN EST VALIDÉ PAR LE MÊME CONTRÔLE QUE DANS UNE CORRECTION');

v(
  'un lien vers un nœud inconnu est refusé',
  accepte({
    ...COMPLET,
    donnees: { ...COMPLET.donnees, liens: [{ de: 'dir', a: 'fantome' }] },
  }),
  false,
);
v(
  'un schéma à un seul nœud est refusé',
  accepte({ ...COMPLET, donnees: { noeuds: [COMPLET.donnees.noeuds[0]] } }),
  false,
);
v(
  'deux nœuds sous le même identifiant sont refusés',
  accepte({
    ...COMPLET,
    donnees: {
      noeuds: [
        { id: 'dir', libelle: 'Un', niveau: 0 },
        { id: 'dir', libelle: 'Deux', niveau: 1 },
      ],
    },
  }),
  false,
);
v('un « alt » vide est refusé', accepte({ ...COMPLET, alt: '' }), false);

console.log('\nL’ÉCRAN EST DÉCLARÉ, ET POUR LES BONS PARCOURS');

const revisions = BRANCHES.find((b) => b.id === 'revisions');
const ecran = [...(revisions?.onglets ?? []), ...(revisions?.annexes ?? [])].find(
  (o) => o.id === 'organigrammes',
);
v('l’écran « organigrammes » est déclaré dans Révisions', Boolean(ecran), true);
v('en annexe, et non en onglet — la barre est un budget',
  (revisions?.annexes ?? []).some((o) => o.id === 'organigrammes'),
  true,
);
v('son chemin est celui de la page', ecran?.chemin, '/organigrammes/');
v(
  'il sert les trois parcours DGFiP, et eux seuls',
  [...(ecran?.parcours ?? [])].sort(),
  ['dgfip-a', 'dgfip-ap', 'dgfip-b'],
);
/*
   UN IDENTIFIANT DE PARCOURS MAL ORTHOGRAPHIÉ NE SE VOIT NULLE PART.

   Le lien serait simplement caché pour tout le monde — une fonction disparue
   sans message. On rapproche donc la liste du registre des parcours.
*/
v(
  'chaque parcours cité existe au registre des parcours',
  (ecran?.parcours ?? []).filter((id) => !PARCOURS.some((p) => p.id === id)),
  [],
);
v('et le registre des branches n’a rien à redire', controlerBranches(), []);

/*
   LA CARTE DES ÉCRANS BALAYE L'INSP PUIS « dgfip-a », ET CE COUPLE DOIT
   RESTER COMPLET.

   « essais:carte-ecrans » est un « .mjs » lancé par « node » : il ne peut pas
   importer ce registre, donc il ne peut pas vérifier lui-même que les deux
   parcours qu'il balaye voient bien tous les écrans déclarés. Le contrôle est
   ici. Le jour où un écran ne vaudrait que pour « dgfip-b » ou « dgfip-ap »,
   cette assertion rougira — et la carte devra balayer un parcours de plus,
   sans quoi elle déclarera cet écran orphelin.
*/
const PARCOURS_BALAYES = ['insp', 'dgfip-a'];
v(
  `aucun écran déclaré n’échappe aux parcours balayés par la carte (${PARCOURS_BALAYES.join(', ')})`,
  BRANCHES.flatMap((b) =>
    [...b.onglets, ...(b.annexes ?? [])]
      .filter((o) => o.parcours && !o.parcours.some((id) => PARCOURS_BALAYES.includes(id)))
      .map((o) => o.chemin),
  ),
  [],
);

console.log(
  rouges === 0 ? '\n\u001b[32m✓ tout est vert\u001b[0m' : `\n\u001b[31m✗ ${rouges} rouge${rouges > 1 ? 's' : ''}\u001b[0m`,
);
process.exit(rouges === 0 ? 0 : 1);
