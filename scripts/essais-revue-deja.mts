/**
 * « Ce qui a déjà été servi n'est pas reposé » — phase 3 du prompt 36.
 *
 *   npm run essais:revue-deja
 *
 * **Le défaut que ces contrôles traquent est silencieux.** Un fait mal
 * reconnu ferait disparaître une question qu'il fallait poser, et rien à
 * l'écran ne le dirait. Les contrôles vont donc DANS LES DEUX SENS : le fait
 * présent ne doit pas être redemandé, et le fait **absent** doit l'être.
 * Vérifier seulement le premier sens laisserait passer exactement le défaut
 * qui fait mal.
 */
import { RECONNUS, dejaServi, pasEncoreServi } from '../src/lib/odyssee/deja-servi';
import type { Fait } from '../src/lib/noyau/faits';

let echecs = 0;
const v = (titre: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${titre}`);
  if (!ok) console.log(`      obtenu ${JSON.stringify(obtenu)?.slice(0, 200)} / attendu ${JSON.stringify(attendu)?.slice(0, 200)}`);
};

const JOUR = '2026-04-10';
const fait = (type: string, debut: string, jour = JOUR): Fait =>
  ({
    id: `${type}:${debut}`,
    branche: 'odyssee',
    proprietaire: 'odyssee',
    domaine: 'odyssee',
    type,
    debut,
    jourLogique: jour,
    source: 'manuel',
    fiabilite: 'confirme',
    version: 1,
    modifieLe: debut,
  }) as unknown as Fait;

console.log('\nCE QUI A DÉJÀ ÉTÉ SERVI');

console.log('\n  A — rien de fait : tout reste à demander');
v('aucune ligne « déjà fait »', dejaServi([], JOUR), []);
v(
  'et tous les types reconnus restent à servir',
  pasEncoreServi([], JOUR).length,
  RECONNUS.length,
);

console.log('\n  B — le sens évident : le fait présent n’est pas redemandé');
const avecSport = [fait('sport.seance', `${JOUR}T18:10:00.000Z`)];
const lignes = dejaServi(avecSport, JOUR);
v('une ligne, et une seule', lignes.length, 1);
v(
  'elle nomme la chose et son heure, comme le prompt l’écrit',
  lignes[0].libelle,
  'Séance de sport — enregistrée à 18 h 10',
);
v('la séance de sport ne reste pas à servir', pasEncoreServi(avecSport, JOUR).includes('sport.seance'), false);

console.log('\n  C — LE SENS QUI COMPTE : ce qui n’est pas là reste demandé');
/*
   Une séance de sport enregistrée ne doit PAS faire taire la question de
   l'humeur. C'est le défaut silencieux : un module trop large éteindrait
   tout dès qu'un fait quelconque existe.
*/
v('l’humeur reste à demander', pasEncoreServi(avecSport, JOUR).includes('odyssee.checkin'), true);
v('la nuit aussi', pasEncoreServi(avecSport, JOUR).includes('odyssee.sommeil'), true);
v(
  'et dix-huit types sur dix-neuf restent à servir',
  pasEncoreServi(avecSport, JOUR).length,
  RECONNUS.length - 1,
);

console.log('\n  D — un fait d’un AUTRE jour ne fait taire personne');
/*
   L'erreur la plus facile en mode matin, où le jour visé n'est pas le jour
   courant : prendre les faits de la mauvaise journée.
*/
const veille = [fait('sport.seance', '2026-04-09T18:10:00.000Z', '2026-04-09')];
v('aucune ligne pour le jour visé', dejaServi(veille, JOUR), []);
v('et la séance reste à demander', pasEncoreServi(veille, JOUR).includes('sport.seance'), true);
v('alors qu’elle est servie pour SON jour', dejaServi(veille, '2026-04-09').length, 1);

console.log('\n  E — plusieurs fois le même type');
const troisRepas = [
  fait('odyssee.repas', `${JOUR}T08:00:00.000Z`),
  fait('odyssee.repas', `${JOUR}T12:30:00.000Z`),
  fait('odyssee.repas', `${JOUR}T19:00:00.000Z`),
];
v('une seule ligne, comptée', dejaServi(troisRepas, JOUR).map((l) => l.libelle), ['Repas noté — 3 fois']);

console.log('\n  F — rien n’est reconnu par motif');
/*
   Un type inconnu ne doit RIEN produire. Reconnaître « tout ce qui commence
   par sport. » ferait entrer demain un type qu'on n'a pas examiné.
*/
v('un type inventé est ignoré', dejaServi([fait('sport.inconnu', `${JOUR}T10:00:00.000Z`)], JOUR), []);
v('un type de télémétrie aussi', dejaServi([fait('odyssee.usage', `${JOUR}T10:00:00.000Z`)], JOUR), []);
v(
  'et une opération bancaire n’est pas « servie » dans une revue',
  dejaServi([fait('odyssee.operation', `${JOUR}T10:00:00.000Z`)], JOUR),
  [],
);

console.log('\n  G — l’ordre d’affichage ne dépend pas de l’ordre des faits');
const melange = [
  fait('odyssee.tache', `${JOUR}T20:00:00.000Z`),
  fait('sport.seance', `${JOUR}T07:00:00.000Z`),
  fait('odyssee.checkin', `${JOUR}T09:00:00.000Z`),
];
const inverse = [...melange].reverse();
v(
  'deux ordres de faits donnent le même ordre de lignes',
  dejaServi(melange, JOUR).map((l) => l.type),
  dejaServi(inverse, JOUR).map((l) => l.type),
);

console.log('\n  H — les deux types du coffre sont déclarés');
v('les médicaments sont reconnus', RECONNUS.some((r) => r.type === 'odyssee.medicament'), true);
v('le statut hormonal aussi', RECONNUS.some((r) => r.type === 'odyssee.statut-hormonal'), true);
/*
   Coffre fermé, ces faits ne sont pas publiés du tout : ils n'arrivent donc
   jamais ici, et aucune question ne s'en trouve éteinte. On le vérifie en
   donnant une liste sans eux.
*/
v(
  'coffre fermé — donc faits absents —, ils restent à servir',
  pasEncoreServi(avecSport, JOUR).includes('odyssee.medicament'),
  true,
);

console.log('\n  I — la revue ne s’allonge pas (interdit 4)');
/*
   « Toujours moins de trente secondes, une seule réponse suffit. » Une phase
   qui ajoute un aperçu du jour et une ligne « déjà fait » peut l'allonger
   sans qu'on s'en aperçoive.
   
   CE CONTRÔLE EST STRUCTUREL, pas chronométré : il lit la source de l'écran.
   Il ne prouve donc pas « moins de trente secondes » — il prouve qu'aucune
   réponse n'est rendue obligatoire et que le bloc ajouté ne pose aucune
   question. Je préfère le dire que de laisser croire à une mesure.
*/
{
  const { readFileSync } = await import('node:fs');
  const ecran = readFileSync('src/pages/odyssee/revue.astro', 'utf8');
  const formulaire = ecran.slice(ecran.indexOf('<form id="questions"'), ecran.indexOf('</form>'));
  v('aucune réponse n’est obligatoire', /\brequired\b/.test(formulaire), false);

  const bloc = ecran.slice(ecran.indexOf('id="deja-servi"'), ecran.indexOf('id="rien-a-relever"'));
  v(
    'le bloc « Déjà fait » ne pose aucune question',
    /<input|<textarea|<select/.test(bloc),
    false,
  );
  v('et il est caché quand il n’y a rien à y mettre', /id="deja-servi"[^>]*hidden/.test(bloc), true);
}

console.log(`\n${echecs ? '\x1b[31m✗' : '\x1b[32m✓'} ${echecs} échec(s)\x1b[0m\n`);
process.exit(echecs ? 1 : 0);
