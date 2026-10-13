/**
 * Essais du dossier surveillé et de l'export ICS — Finances, phase 4.
 *
 * Les deux ont le même point commun, et c'est pour cela qu'ils partagent un
 * fichier : ce sont les deux endroits de Finances où une donnée **sort** de
 * l'enceinte habituelle. Le dossier parce qu'un nom de fichier bancaire porte
 * souvent le numéro de compte et finirait enregistré ; l'export parce qu'un
 * `.ics` part dans un agenda qui est, pour la plupart des gens, synchronisé
 * chez un tiers.
 */
import {
  EMPREINTES_GARDEES,
  controlerLeDossierDeReleves,
  empreinteDuFichier,
  nouveaux,
  phraseDuBandeau,
  type ReleveDuDossier,
} from '../src/lib/odyssee/dossier-releves';
import {
  INTERDITS_DANS_LICS,
  OPTIONS_PAR_DEFAUT,
  PREFIXE_UID,
  controlerLExportDEcheances,
  echeancesEnIcs,
  evenementsDesEcheances,
  titreDeLEcheance,
  type OptionsExport,
} from '../src/lib/odyssee/echeances-ics';
import { TOLERANCE_PAR_DEFAUT, occurrences, type LigneBudget } from '../src/lib/odyssee/budget';
import { euros } from '../src/lib/odyssee/finances';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const releve = (p: Partial<ReleveDuDossier> = {}): ReleveDuDossier => ({
  nom: 'Releve.pdf', taille: 1000, modifieLe: 1_759_000_000_000,
  empreinte: 'a'.repeat(64), dejaVu: false, ...p,
});

console.log('\n1. L’EMPREINTE NE DIT PAS LE NOM');

{
  /*
     Les banques nomment leurs relevés avec le numéro de compte dedans. Une
     liste de fichiers déjà importés gardée en clair ferait entrer dans la
     base exactement ce que le reste du chantier refuse d’y mettre.
  */
  const nom = 'Releve_CCP_00055347_202609.pdf';
  const e = await empreinteDuFichier(nom, 182_344, 1_759_000_000_000);
  verifier('1.1 c’est un SHA-256 hexadécimal', /^[0-9a-f]{64}$/.test(e), e);
  verifier('1.2 le numéro de compte n’y est pas', !e.includes('00055347'));
  verifier('1.3 ni aucun morceau du nom', !e.toLowerCase().includes('releve'));
  verifier('1.4 ni la taille en clair', !e.includes('182344'));
}

{
  const a = await empreinteDuFichier('R.pdf', 100, 1);
  const encore = await empreinteDuFichier('R.pdf', 100, 1);
  egal('1.5 elle est déterministe', a, encore);
  verifier('1.6 un autre nom donne une autre empreinte',
    (await empreinteDuFichier('S.pdf', 100, 1)) !== a);
  verifier('1.7 une autre taille aussi',
    (await empreinteDuFichier('R.pdf', 101, 1)) !== a);
  verifier('1.8 et une autre date de modification',
    (await empreinteDuFichier('R.pdf', 100, 2)) !== a);
}

console.log('\n2. CE QUE LE BANDEAU DIT, ET CE QU’IL TAIT');

{
  /*
     Le bandeau s’affiche coffre **fermé**. Y écrire le nom d’un fichier
     montrerait un numéro de compte à quelqu’un qui n’a pas donné son mot de
     passe.
  */
  const contenu = [
    releve({ nom: 'Releve_CCP_00055347_202610.pdf', empreinte: 'b'.repeat(64) }),
    releve({ nom: 'Releve_CCP_00055347_202609.pdf', empreinte: 'c'.repeat(64), dejaVu: true }),
  ];
  const phrase = phraseDuBandeau(contenu)!;
  egal('2.1 un seul nouveau est annoncé', phrase, '1 nouveau relevé dans le dossier surveillé.');
  verifier('2.2 et aucun nom n’y figure', !phrase.includes('00055347'), phrase);
  egal('2.3 deux nouveaux se disent au pluriel',
    phraseDuBandeau([releve({ empreinte: 'd'.repeat(64) }), releve({ empreinte: 'e'.repeat(64) })]),
    '2 nouveaux relevés dans le dossier surveillé.');
  egal('2.4 rien de nouveau, pas de bandeau',
    phraseDuBandeau([releve({ dejaVu: true })]), null);
  egal('2.5 un dossier vide non plus', phraseDuBandeau([]), null);
}

{
  const contenu = [releve({ dejaVu: true }), releve({ empreinte: 'f'.repeat(64) })];
  egal('2.6 « nouveaux » ne garde que ce qui n’a pas été vu', nouveaux(contenu).length, 1);
  verifier('2.7 cinq cents empreintes couvrent cinq ans de quatre comptes',
    EMPREINTES_GARDEES >= 4 * 12 * 5, String(EMPREINTES_GARDEES));
}

console.log('\n3. LE GARDE-FOU DU DOSSIER');

egal('3.1 il ne trouve rien', await controlerLeDossierDeReleves(), []);

console.log('\n4. L’EXPORT ICS DES ÉCHÉANCES');

const ligne = (p: Partial<LigneBudget> = {}): LigneBudget => ({
  id: 'loyer', libelle: 'Loyer', categorie: 'Logement', sens: 'charge',
  compteId: 'c-compte-courant-00055347', essentielle: true, motifs: ['VIR M DUPONT LOYER'],
  versions: [{
    depuis: '2026-01-01', jusqua: null, montant: 78000, nature: 'fixe', montantHaut: null,
    periodicite: 'mensuelle', jourAttendu: 5, tolerance: TOLERANCE_PAR_DEFAUT,
  }],
  note: 'Prélevé sur le compte joint. IBAN FR76 1234 5678.',
  majLe: '2026-01-01T00:00:00.000Z', ...p,
});

const options: OptionsExport = {
  depuis: '2026-10-01', jusqua: '2026-12-31', ressourcesComprises: true,
};

{
  const l = ligne();
  const occ = occurrences(l, '2026-01-01', '2027-06-30');
  const evts = evenementsDesEcheances([l], occ, options);
  egal('4.1 trois échéances dans la fenêtre', evts.length, 3);
  egal('4.2 et pas une de plus', evts.map((e) => e.debut.slice(0, 10)),
    ['2026-10-05', '2026-11-05', '2026-12-05']);
  verifier('4.3 chacune est une journée entière', evts.every((e) => e.journeeEntiere));
  /*
     `euros()` sépare le nombre du symbole par une espace **insécable**, et
     l'attendu est construit avec lui plutôt que tapé à la main : une
     comparaison à une chaîne écrite au clavier échoue sur un caractère
     invisible, ce qui est le genre d'essai qu'on finit par désactiver.
  */
  egal('4.4 le titre porte le libellé et le montant signé',
    evts[0].titre, `Loyer −${euros(78000)}`);
  verifier('4.5 l’UID se dérive de l’occurrence',
    evts[0].uidIcs === `${PREFIXE_UID}-loyer:2026-10-05@cyclades`, String(evts[0].uidIcs));
  verifier('4.6 la note dit la fenêtre d’appariement',
    evts[0].note.includes('2026-10-03') && evts[0].note.includes('2026-10-07'), evts[0].note);
}

{
  /* Une ressource se distingue d'un coup d'œil, et peut être écartée. */
  const salaire = ligne({
    id: 'salaire', libelle: 'Salaire', categorie: 'Revenus', sens: 'ressource',
    versions: [{
      depuis: '2026-01-01', jusqua: null, montant: 235000, nature: 'fixe', montantHaut: null,
      periodicite: 'mensuelle', jourAttendu: 28, tolerance: TOLERANCE_PAR_DEFAUT,
    }],
  });
  const occ = occurrences(salaire, '2026-01-01', '2027-06-30');
  egal('4.7 une ressource porte un plus',
    titreDeLEcheance(salaire, occ.find((o) => o.jour === '2026-10-28')!),
    `Salaire +${euros(235000)}`);
  const sans = evenementsDesEcheances([salaire], occ, { ...options, ressourcesComprises: false });
  egal('4.8 et peut être écartée de l’export', sans.length, 0);
  const avec = evenementsDesEcheances([salaire], occ, options);
  egal('4.9 ou conservée', avec.length, 3);
}

{
  /* Une occurrence dont la ligne a disparu ne produit pas un titre vide. */
  const l = ligne();
  const occ = occurrences(l, '2026-01-01', '2027-06-30');
  egal('4.10 une occurrence orpheline est écartée',
    evenementsDesEcheances([], occ, options).length, 0);
}

console.log('\n5. CE QUI NE DOIT PAS PARTIR DANS UN AGENDA');

{
  const l = ligne();
  const occ = occurrences(l, '2026-01-01', '2027-06-30');
  const ics = echeancesEnIcs([l], occ, options, new Date('2026-10-15T10:00:00Z'));

  verifier('5.1 le numéro de compte n’y est pas', !ics.includes('00055347'));
  verifier('5.2 l’IBAN de la note non plus', !ics.includes('FR76'));
  verifier('5.3 ni le motif d’appariement', !ics.includes('VIR M DUPONT LOYER'));
  for (const mot of INTERDITS_DANS_LICS) {
    verifier(`5.x le mot « ${mot} » n’y est pas`, !ics.includes(mot));
  }
  /*
     Le montant y est — c'est tout l'objet de l'export —, et la virgule est
     **échappée** : la norme ICS en fait un séparateur de valeurs, et une
     virgule nue couperait le titre en deux dans certains agendas.
  */
  verifier('5.4 le montant est dans le titre, virgule échappée',
    ics.includes(`SUMMARY:Loyer −780\\,00`), ics.slice(0, 320));
}

{
  const l = ligne();
  const occ = occurrences(l, '2026-01-01', '2027-06-30');
  const ics = echeancesEnIcs([l], occ, options, new Date('2026-10-15T10:00:00Z'));
  verifier('5.5 le fichier est un VCALENDAR', ics.startsWith('BEGIN:VCALENDAR\r\n'));
  verifier('5.6 il se termine par un CRLF', ics.endsWith('\r\n'));
  egal('5.7 il porte trois événements', ics.split('BEGIN:VEVENT').length - 1, 3);
  verifier('5.8 les dates sont des dates seules',
    ics.includes('DTSTART;VALUE=DATE:20261005'), 'DTSTART manquant');
  /*
     DTEND est le **lendemain** : la norme le veut exclusif, et un même jour
     des deux côtés donne un événement de durée nulle que certains agendas
     n'affichent pas du tout.
  */
  verifier('5.9 et DTEND est le lendemain', ics.includes('DTEND;VALUE=DATE:20261006'));
}

{
  /* Réexporter ne doit pas empiler : c'est l'UID stable qui le garantit. */
  const l = ligne();
  const occ = occurrences(l, '2026-01-01', '2027-06-30');
  const a = echeancesEnIcs([l], occ, options, new Date('2026-10-15T10:00:00Z'));
  const b = echeancesEnIcs([l], occ, options, new Date('2026-11-20T18:30:00Z'));
  const uids = (t: string) => t.split('\r\n').filter((x) => x.startsWith('UID:'));
  egal('5.10 deux exports portent les mêmes UID', uids(a), uids(b));
  verifier('5.11 et seul l’horodatage change', a !== b);
}

{
  const defaut = OPTIONS_PAR_DEFAUT('2026-10-15');
  egal('5.12 par défaut, l’export part d’aujourd’hui', defaut.depuis, '2026-10-15');
  egal('5.13 et couvre douze mois', defaut.jusqua, '2027-10-15');
  verifier('5.14 ressources comprises', defaut.ressourcesComprises);
  egal('5.15 un 31 devient le 30 du mois court', OPTIONS_PAR_DEFAUT('2026-10-31').jusqua,
    '2027-10-31');
  egal('5.16 et un 29 février non bissextile tombe le 28',
    OPTIONS_PAR_DEFAUT('2027-08-29').jusqua, '2028-08-29');
}

console.log('\n6. LE GARDE-FOU DE L’EXPORT');

egal('6.1 il ne trouve rien', controlerLExportDEcheances(), []);

console.log(
  echecs.length
    ? `\n\x1b[31m${reussis} essais réussis, ${echecs.length} échec(s).\x1b[0m\n` +
        echecs.map((e) => `  ✗ ${e}`).join('\n') + '\n'
    : `\n\x1b[32m${reussis} essais réussis, 0 échec.\x1b[0m\n`,
);
process.exit(echecs.length ? 1 : 0);
