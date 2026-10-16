/**
 * Les quatre conditions de l'amendement signé — 16 octobre 2026.
 *
 *   npm run essais:faits-sensible
 *
 * « Oui, maintenant : coffre ouvert seulement ; seulement dans les
 * indicateurs et les règles de désaccord, sans texte qui les nomme hors du
 * coffre ; jamais dans les exports, "Demander à l'IA" ni les
 * notifications ; le statut hormonal reste soumis au filtre du cycle. »
 *
 * Quatre conditions, quatre sections, et la plus importante est la
 * deuxième : **le fait voyage hors du coffre**. Il part au journal
 * d'opérations, qui se réplique et qu'une sauvegarde emporte. Un nom de
 * molécule qui s'y glisserait ne serait pas une fuite d'écran — ce serait
 * une fuite durable, recopiée sur chaque appareil.
 *
 * Le contrôle ne cherche donc pas le nom dans un champ connu : il **sérialise
 * le fait entier** et cherche le nom dedans. Une sonde qui regarderait
 * `valeur` et `details` laisserait passer un troisième champ ajouté plus
 * tard, et c'est précisément ainsi que ce genre de fuite arrive.
 *
 * Aucune donnée réelle : les noms sont des inventions, comme l'interdit
 * 1 n° 10 l'exige.
 */
import {
  NATURES_ECARTEES,
  VALEUR_DE_PRISE,
  projeterFaitsSensibles,
} from '../src/lib/odyssee/faits-sensible';
import { TYPES_JAMAIS_PARTAGES, retirerCeQuiNeSortPas } from '../src/lib/noyau/jamais-partage';
import type { Prise, StatutHormonal } from '../src/lib/odyssee/sensible';

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
const vrai = (t: string, c: boolean) => v(t, c, true);

/* Des noms inventés, et reconnaissables : s'ils apparaissent quelque part,
   on saura lequel. */
const MOLECULE = 'Zorbitrex';
const DOSE = '42 mg';
const MOTIF = 'motif-inventé-du-contrôle';
const INTITULE_STATUT = 'Protocole Flibustine';

const prise = (id: string, le: string): Prise => ({
  id,
  nom: MOLECULE,
  dose: DOSE,
  voie: 'orale',
  motif: MOTIF,
  le,
  jour: le.slice(0, 10),
  majLe: le,
});

const statut = (id: string, nature: StatutHormonal['nature'], debut: string): StatutHormonal => ({
  id,
  nature,
  intitule: INTITULE_STATUT,
  debut,
  fin: null,
  note: 'note-inventée',
  majLe: debut,
});

console.log('\n\x1b[1m1. Coffre fermé : rien, et on le DIT\x1b[0m');
{
  /*
     `publierFaitsSensibles` lit le coffre et n'est donc pas pure ; ce que
     l'on éprouve ici est ce que la projection rend quand on ne lui donne
     rien — le cas que le chemin coffre fermé produit.
  */
  const vide = projeterFaitsSensibles({ prises: [], statuts: [] });
  v('aucun fait', vide.faits.length, 0);
  v('et aucun manque inventé', vide.manques, []);
}

console.log(
  '\n\x1b[1m2. LE NOM NE SORT PAS — la garde centrale\x1b[0m' +
    '\n   \x1b[2mOn sérialise le fait entier : une sonde par champ raterait le champ suivant.\x1b[0m',
);
{
  const p = projeterFaitsSensibles({
    prises: [prise('p1', '2026-10-16T08:00:00.000Z')],
    statuts: [statut('s1', 'traitement', '2026-10-01T00:00:00.000Z')],
  });
  v('deux faits publiés', p.faits.length, 2);

  const serialise = JSON.stringify(p.faits);
  for (const secret of [MOLECULE, DOSE, MOTIF, INTITULE_STATUT, 'note-inventée']) {
    v(`« ${secret} » est absent du fait sérialisé`, serialise.includes(secret), false);
  }

  const medicament = p.faits.find((f) => f.type === 'odyssee.medicament')!;
  v('la prise dit seulement qu’il y a eu une prise', medicament.valeur, VALEUR_DE_PRISE);
  v('et ne porte aucun détail', medicament.details, undefined);

  /*
     La nature du statut, elle, sort — c'est une liste fermée de trois
     valeurs, et une règle de désaccord qui ne distinguerait pas un
     traitement d'une substance ne servirait à rien. L'intitulé, non.
  */
  const hormonal = p.faits.find((f) => f.type === 'odyssee.statut-hormonal')!;
  v('le statut publie sa nature', hormonal.valeur, 'traitement');
  v('et pas son intitulé', JSON.stringify(hormonal).includes(INTITULE_STATUT), false);
  v('un statut ouvert reste ouvert', hormonal.fin, undefined);
}

console.log('\n\x1b[1m3. Jamais dans les exports ni les prompts d’IA\x1b[0m');
{
  const p = projeterFaitsSensibles({
    prises: [prise('p1', '2026-10-16T08:00:00.000Z')],
    statuts: [statut('s1', 'traitement', '2026-10-01T00:00:00.000Z')],
  });
  /*
     La garde vit ailleurs — au point de sortie — et c'est voulu. Ce
     contrôle vérifie la RENCONTRE : les types que ce module produit sont
     bien ceux que la garde retient. Deux modules justes séparément peuvent
     ne pas se rencontrer, et c'est la faute qu'on cherche.
  */
  v('les deux types produits sont nommés par la garde',
    [...new Set(p.faits.map((f) => f.type))].sort(),
    [...TYPES_JAMAIS_PARTAGES].sort(),
  );
  v('et le tamis de sortie les retire tous', retirerCeQuiNeSortPas(p.faits), []);
}

console.log('\n\x1b[1m4. Le filtre du cycle s’applique au statut hormonal\x1b[0m');
{
  const p = projeterFaitsSensibles({
    prises: [],
    statuts: [
      statut('s1', 'cycle', '2026-10-01T00:00:00.000Z'),
      statut('s2', 'traitement', '2026-10-02T00:00:00.000Z'),
      statut('s3', 'substance', '2026-10-03T00:00:00.000Z'),
    ],
  });
  v('seuls deux statuts entrent', p.faits.map((f) => f.valeur).sort(), ['substance', 'traitement']);
  v('aucun fait de nature cycle', p.faits.some((f) => f.valeur === 'cycle'), false);
  /*
     Et l'écart est DIT. Une couverture qui tomberait sans explication se
     lirait comme un domaine négligé, ce qui est l'inverse de la vérité.
  */
  const manque = p.manques.find((m) => m.quoi === 'odyssee.statut-hormonal');
  vrai('l’écart est signalé comme un manque', manque !== undefined);
  v('et il en compte un', manque?.combien, 1);
  vrai('en nommant le filtre du cycle', manque?.consequence.includes('cycle') === true);

  /* Sans statut de cycle, aucun manque inventé. */
  const sans = projeterFaitsSensibles({ prises: [], statuts: [statut('s9', 'autre', '2026-10-01T00:00:00.000Z')] });
  v('aucun manque quand rien n’est écarté', sans.manques, []);
  v('et la nature « cycle » est bien la seule écartée', [...NATURES_ECARTEES], ['cycle']);
}

console.log('\n\x1b[1m5. Les identifiants sont déterministes\x1b[0m');
{
  const deux = [0, 1].map(() =>
    projeterFaitsSensibles({ prises: [prise('p1', '2026-10-16T08:00:00.000Z')], statuts: [] }),
  );
  v(
    'deux projections rendent les mêmes identifiants',
    deux[0].faits.map((f) => f.id),
    deux[1].faits.map((f) => f.id),
  );
  v('et l’identifiant ne porte pas le nom', deux[0].faits[0].id, 'odyssee.medicament:p1');
}

console.log(
  echecs === 0
    ? '\n\x1b[32mTous les essais passent.\x1b[0m\n'
    : `\n\x1b[31m${echecs} échec(s).\x1b[0m\n`,
);
process.exit(echecs === 0 ? 0 : 1);
