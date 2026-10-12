/**
 * L'iCalendar : l'aller-retour, et ce qui est écarté plutôt que deviné.
 *
 * Deux choses se vérifient ici et nulle part ailleurs :
 *
 * - **l'aller-retour est fidèle** — ce qui sort et rentre est ce qui était là,
 *   y compris les titres à virgules, les notes à sauts de ligne et les accents
 *   qui font déborder le pliage à 75 octets ;
 * - **ce qui n'est pas compris est dit** — une date illisible écarte
 *   l'événement avec son motif, une règle de récurrence est nommée. Un import
 *   qui devine est pire qu'un import qui refuse, parce qu'on ne découvre la
 *   devinette que des mois plus tard.
 */
import {
  deplier,
  depuisIcs,
  desechapperIcs,
  echapperIcs,
  lireIcs,
  plier,
  rapprocher,
  versFichierIcs,
  versIcs,
} from '../src/lib/odyssee/ics';
import type { Evenement } from '../src/lib/odyssee/modele';

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
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);
const faux = (intitule: string, condition: boolean) => v(intitule, condition, false);

const evenement = (p: Partial<Evenement> = {}): Evenement => ({
  id: 'E1',
  titre: 'Rendez-vous',
  domaine: 'ordre',
  debut: '2026-10-12T09:00:00.000Z',
  fin: '2026-10-12T10:00:00.000Z',
  journeeEntiere: false,
  lieu: '',
  note: '',
  uidIcs: null,
  realise: 'inconnu',
  releveLe: null,
  majLe: '2026-10-01T09:00:00.000Z',
  ...p,
});

/* ════════════════════════════════════════════════════════════════════════
   1. L'échappement et le pliage
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’ÉCHAPPEMENT ET LE PLIAGE');

v(
  'la barre oblique est échappée en premier',
  echapperIcs('a\\b;c,d'),
  'a\\\\b\\;c\\,d',
);
v('le saut de ligne devient \\n', echapperIcs('deux\nlignes'), 'deux\\nlignes');
v('et l’aller-retour est fidèle', desechapperIcs(echapperIcs('a\\b;c,d\ne')), 'a\\b;c,d\ne');
/*
   Une barre finale seule : l'échappement n'en produit pas, mais un fichier
   étranger le peut. Elle doit rendre une barre, et non manger le caractère
   suivant — qui n'existe pas.
*/
v('une barre finale orpheline se lit comme une barre', desechapperIcs('fin\\'), 'fin\\');

{
  const courte = 'SUMMARY:Court';
  v('une ligne courte n’est pas pliée', plier(courte), courte);
}
{
  /*
     Le pliage compte en **octets** : un « é » en pèse deux. Quarante « é »
     font quatre-vingts octets pour quarante caractères, et un pliage au
     caractère laisserait passer une ligne trop longue.
  */
  const accents = `SUMMARY:${'é'.repeat(40)}`;
  const plie = plier(accents);
  vrai('une ligne d’accents est pliée', plie.includes('\r\n '));
  const morceaux = plie.split('\r\n ');
  const octets = (s: string) => new TextEncoder().encode(s).length;
  vrai(
    'et aucun morceau ne dépasse 75 octets',
    morceaux.every((m, i) => octets(m) + (i > 0 ? 1 : 0) <= 75),
  );
  v('déplier rend la ligne entière', deplier(plie).join(''), accents);
}

/* ════════════════════════════════════════════════════════════════════════
   2. Les dates
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES DATES, ET CELLES QU’ON REFUSE DE DEVINER');

v('un instant UTC', depuisIcs('20261012T090000Z'), {
  iso: '2026-10-12T09:00:00.000Z',
  dateSeule: false,
});
v('une date seule', depuisIcs('20261012'), {
  iso: '2026-10-12T00:00:00.000Z',
  dateSeule: true,
});
v('une forme inconnue n’est pas devinée', depuisIcs('12 octobre 2026'), null);
v('ni une date tronquée', depuisIcs('202610'), null);
v('l’aller-retour UTC est exact', versIcs('2026-10-12T09:00:00.000Z'), '20261012T090000Z');

/* ════════════════════════════════════════════════════════════════════════
   3. L'aller-retour complet
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nL’ALLER-RETOUR NE PERD RIEN');

{
  const source = [
    evenement({
      id: 'A',
      titre: 'Déjeuner, puis réunion',
      lieu: 'Bureau ; étage 3',
      note: 'Première ligne\nSeconde ligne',
      domaine: 'lien',
    }),
    evenement({
      id: 'B',
      titre: 'Congé',
      journeeEntiere: true,
      debut: '2026-10-20T00:00:00.000Z',
      fin: '2026-10-20T23:59:59.999Z',
      domaine: 'corps',
    }),
  ];
  const fichier = versFichierIcs(source, new Date('2026-10-12T08:00:00.000Z'));

  vrai('le fichier est en CRLF', fichier.includes('\r\n') && !/[^\r]\n/.test(fichier));
  vrai('il se termine par CRLF', fichier.endsWith('\r\n'));
  vrai('il s’ouvre et se ferme', fichier.startsWith('BEGIN:VCALENDAR') && fichier.includes('END:VCALENDAR'));

  const { evenements, ecartes, recurrents } = lireIcs(fichier);
  v('rien n’est écarté', ecartes, []);
  v('aucune récurrence', recurrents, []);
  v('les deux événements reviennent', evenements.length, 2);

  const a = evenements.find((e) => e.titre.startsWith('Déjeuner'))!;
  v('la virgule du titre survit', a.titre, 'Déjeuner, puis réunion');
  v('le point-virgule du lieu aussi', a.lieu, 'Bureau ; étage 3');
  v('et le saut de ligne de la note', a.note, 'Première ligne\nSeconde ligne');
  v('les heures sont rendues à l’identique', [a.debut, a.fin], [
    '2026-10-12T09:00:00.000Z',
    '2026-10-12T10:00:00.000Z',
  ]);
  // Le domaine voyage dans une propriété privée : un agenda étranger l'ignore,
  // Cyclades le retrouve.
  v('le domaine revient', a.domaine, 'lien');
  v('et l’UID est dérivé de l’identifiant', a.uid, 'A@cyclades');

  const b = evenements.find((e) => e.titre === 'Congé')!;
  vrai('la journée entière est reconnue', b.journeeEntiere);
  /*
     DTEND d'une journée entière est exclusif dans la norme : il est écrit au
     lendemain et relu au jour même. Sans ce décalage, un congé d'un jour en
     occuperait deux.
  */
  v('et elle n’occupe qu’un jour', b.fin.slice(0, 10), '2026-10-20');
}

/* ════════════════════════════════════════════════════════════════════════
   4. Ce qui est écarté est dit
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nCE QUI N’EST PAS COMPRIS EST DIT, JAMAIS DEVINÉ');

{
  const fichier = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:sans-date@ailleurs',
    'SUMMARY:Sans date',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:illisible@ailleurs',
    'SUMMARY:Date illisible',
    'DTSTART:pas-une-date',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:inverse@ailleurs',
    'SUMMARY:Fin avant début',
    'DTSTART:20261012T100000Z',
    'DTEND:20261012T090000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:serie@ailleurs',
    'SUMMARY:Réunion hebdomadaire',
    'DTSTART:20261012T090000Z',
    'DTEND:20261012T100000Z',
    'RRULE:FREQ=WEEKLY;COUNT=10',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:jalon@ailleurs',
    'SUMMARY:Jalon sans fin',
    'DTSTART:20261013T090000Z',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const { evenements, ecartes, recurrents } = lireIcs(fichier);
  v(
    'les trois malformés sont écartés, nommés',
    ecartes.map((e) => e.quoi),
    ['Sans date', 'Date illisible', 'Fin avant début'],
  );
  vrai('et chacun porte son motif', ecartes.every((e) => e.pourquoi.length > 10));
  /*
     La récurrence n'est pas comprise : l'événement est importé comme son seul
     premier terme, et la série est **nommée** pour que la personne sache ce
     qui manque au lieu de le découvrir un mois plus tard.
  */
  v('la série est signalée', recurrents, ['Réunion hebdomadaire']);
  v('mais son premier terme est importé', evenements.length, 2);
  const jalon = evenements.find((e) => e.titre === 'Jalon sans fin')!;
  v('un événement sans fin devient un jalon', jalon.fin, jalon.debut);
}

{
  // Un fichier vide, ou qui n'est pas de l'ICS du tout : rien, et pas d'erreur.
  v('un texte quelconque ne rend rien', lireIcs('bonjour').evenements, []);
  v('et ne lève rien', lireIcs('').ecartes, []);
}

/* ════════════════════════════════════════════════════════════════════════
   5. Le rapprochement : réimporter met à jour
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nRÉIMPORTER MET À JOUR, ET NE DUPLIQUE PAS');

{
  let compteur = 0;
  const nouvelId = () => `NEUF-${(compteur += 1)}`;
  const existants = [
    evenement({ id: 'DEJA', uidIcs: 'connu@ailleurs', titre: 'Ancien titre', domaine: 'oeuvre' }),
    evenement({ id: 'MAIN', uidIcs: null, titre: 'Saisi à la main' }),
  ];
  const importes = [
    {
      uid: 'connu@ailleurs',
      titre: 'Titre corrigé',
      debut: '2026-10-12T09:00:00.000Z',
      fin: '2026-10-12T11:00:00.000Z',
      journeeEntiere: false,
      lieu: '',
      note: '',
      domaine: null,
    },
    {
      uid: 'neuf@ailleurs',
      titre: 'Nouveau',
      debut: '2026-10-13T09:00:00.000Z',
      fin: '2026-10-13T10:00:00.000Z',
      journeeEntiere: false,
      lieu: '',
      note: '',
      domaine: null,
    },
  ];
  const r = rapprocher(importes, existants, { domaineParDefaut: 'ordre', nouvelId });

  v('un UID connu met à jour', r.misAJour, 1);
  v('un UID inconnu crée', r.nouveaux, 1);
  v(
    'et l’événement mis à jour garde son identifiant',
    r.aEcrire.find((e) => e.uidIcs === 'connu@ailleurs')?.id,
    'DEJA',
  );
  /*
     Le domaine d'un événement déjà connu n'est pas écrasé : la personne a pu
     le reclasser à la main, et un réimport annuel ne doit pas défaire ce
     travail.
  */
  v(
    'son domaine est conservé, pas remis par défaut',
    r.aEcrire.find((e) => e.uidIcs === 'connu@ailleurs')?.domaine,
    'oeuvre',
  );
  v(
    'un nouvel import sans domaine tombe dans le domaine de repli',
    r.aEcrire.find((e) => e.uidIcs === 'neuf@ailleurs')?.domaine,
    'ordre',
  );
  v('et les deux sans domaine sont comptés', r.sansDomaine, 2);
  /*
     L'événement saisi à la main n'a pas d'UID : aucun import ne peut
     l'écraser, et c'est précisément ce qui le protège.
  */
  faux(
    'l’événement saisi à la main n’est pas touché',
    r.aEcrire.some((e) => e.id === 'MAIN'),
  );

  // Rejouer le même import une seconde fois ne crée rien de plus.
  const apres = existants.concat(
    r.aEcrire
      .filter((e) => e.id.startsWith('NEUF'))
      .map((e) => ({ ...e, majLe: '2026-10-12T12:00:00.000Z' })),
  );
  const encore = rapprocher(importes, apres, { domaineParDefaut: 'ordre', nouvelId });
  v('un second import ne crée rien', encore.nouveaux, 0);
  v('et met tout à jour', encore.misAJour, 2);
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
