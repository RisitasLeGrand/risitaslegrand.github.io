/**
 * Le dossier partagé, éprouvé sans dossier.
 *
 * L'API de fichiers du navigateur n'existe pas en ligne de commande, et elle
 * n'est pas ce qui peut se tromper : ce qui peut se tromper, c'est la lecture
 * d'un nom de fichier, l'exclusion de ses propres paquets et la rétention. Un
 * dossier simulé suffit à éprouver les trois, et permet de poser les cas
 * tordus — un appareil qui synchronise une fois par mois, un fichier étranger
 * déposé là par quelqu'un d'autre.
 */
import {
  appareilDuNom,
  nettoyer,
  paquetsDisponibles,
  PAQUETS_GARDES,
} from '../src/lib/sync/dossier';

let echecs = 0;
const v = (intitule: string, obtenu: unknown, attendu: unknown) => {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ✓ ${intitule}`);
    return;
  }
  echecs += 1;
  console.error(`  ✗ ${intitule}\n      attendu ${b}\n      obtenu  ${a}`);
};
const vrai = (intitule: string, condition: boolean) => v(intitule, condition, true);

/** Un dossier simulé : des noms, des dates, et de quoi retirer une entrée. */
function dossier(fichiers: { nom: string; modifie: number; taille?: number }[]) {
  const contenu = new Map(fichiers.map((f) => [f.nom, f]));
  const retires: string[] = [];
  const poignee = {
    kind: 'directory' as const,
    name: 'Cyclades',
    queryPermission: async () => 'granted' as PermissionState,
    getFileHandle: async (nom: string) => ({
      kind: 'file' as const,
      name: nom,
      getFile: async () => ({
        lastModified: contenu.get(nom)!.modifie,
        size: contenu.get(nom)!.taille ?? 1000,
      }),
    }),
    removeEntry: async (nom: string) => {
      contenu.delete(nom);
      retires.push(nom);
    },
    entries: async function* () {
      for (const [nom, f] of contenu) {
        yield [
          nom,
          {
            kind: 'file' as const,
            name: nom,
            getFile: async () => ({ lastModified: f.modifie, size: f.taille ?? 1000 }),
          },
        ] as never;
      }
    },
  };
  return { poignee: poignee as never, retires, contenu };
}

const JOUR = 86_400_000;
const T = Date.parse('2026-10-01T08:00:00Z');

console.log('\nL’appareil se lit dans le nom du fichier');

v('un nom ordinaire', appareilDuNom('cyclades-01hab2-2026-10-11-14h32.paquet'), '01hab2');
v('une sauvegarde n’est pas un paquet', appareilDuNom('cyclades-01hab2-2026-10-11-14h32.cyclades'), null);
v('un fichier étranger', appareilDuNom('notes.paquet'), null);
v('un nom tronqué', appareilDuNom('cyclades-01hab2.paquet'), null);
v(
  'un identifiant qui contiendrait un tiret est tout de même lu',
  appareilDuNom('cyclades-ab-cd-2026-10-11-14h32.paquet'),
  'ab-cd',
);

console.log('\nOn ne se fusionne pas soi-même');

{
  const { poignee } = dossier([
    { nom: 'cyclades-moi-2026-10-11-14h32.paquet', modifie: T },
    { nom: 'cyclades-autre-2026-10-10-09h00.paquet', modifie: T - JOUR },
    { nom: 'photo.jpg', modifie: T },
  ]);
  const vus = await paquetsDisponibles(poignee, 'MOI');
  v('seul le paquet de l’autre appareil est proposé', vus.map((p) => p.appareil), ['autre']);
  v('et son nom est rendu tel quel', vus[0].nom, 'cyclades-autre-2026-10-10-09h00.paquet');
  vrai('avec sa taille', vus[0].taille > 0);
}

{
  /* La casse : le nom du fichier est en minuscules, l'identifiant d'appareil
     ne l'est pas forcément. Comparer sans normaliser ferait fusionner ses
     propres paquets — et le lot vide qui va avec. */
  const { poignee } = dossier([{ nom: 'cyclades-01hab2-2026-10-11-14h32.paquet', modifie: T }]);
  v('la comparaison ignore la casse', (await paquetsDisponibles(poignee, '01HAB2')).length, 0);
}

console.log('\nLes paquets sont rendus du plus récent au plus ancien');

{
  const { poignee } = dossier([
    { nom: 'cyclades-a-2026-10-01-08h00.paquet', modifie: T },
    { nom: 'cyclades-a-2026-10-03-08h00.paquet', modifie: T + 2 * JOUR },
    { nom: 'cyclades-a-2026-10-02-08h00.paquet', modifie: T + JOUR },
  ]);
  v(
    'le plus récent d’abord',
    (await paquetsDisponibles(poignee, 'moi')).map((p) => p.modifie),
    [T + 2 * JOUR, T + JOUR, T],
  );
}

console.log('\nLa rétention garde les derniers de chaque appareil');

{
  const fichiers = [];
  for (let i = 0; i < 6; i += 1) {
    fichiers.push({ nom: `cyclades-a-2026-10-0${i + 1}-08h00.paquet`, modifie: T + i * JOUR });
  }
  /* Un appareil qui ne synchronise qu'une fois : son unique paquet doit
     survivre. Une rétention « les trois plus récents du dossier » l'aurait
     effacé, et c'est précisément celui qu'il faut garder. */
  fichiers.push({ nom: 'cyclades-rare-2026-01-01-08h00.paquet', modifie: T - 300 * JOUR });
  const { poignee, retires, contenu } = dossier(fichiers);

  const sortis = await nettoyer(poignee);
  v('trois paquets gardés par appareil', PAQUETS_GARDES, 3);
  v('les trois plus anciens de A sont retirés', retires.length, 3);
  vrai(
    'et ce sont bien les plus anciens',
    sortis.every((nom) => ['01', '02', '03'].some((j) => nom.includes(`-2026-10-${j}-`))),
  );
  vrai(
    'le paquet de l’appareil rare est intact',
    contenu.has('cyclades-rare-2026-01-01-08h00.paquet'),
  );
  v('il reste quatre fichiers', contenu.size, 4);
}

{
  /* Un fichier étranger ne doit jamais être supprimé : le dossier est celui de
     l'utilisateur, pas celui de Cyclades. */
  const { poignee, contenu } = dossier([
    { nom: 'impots-2025.pdf', modifie: T },
    { nom: 'cyclades-a-2026-10-01-08h00.paquet', modifie: T },
  ]);
  await nettoyer(poignee, 0);
  vrai('un fichier qui n’est pas à nous est laissé', contenu.has('impots-2025.pdf'));
  vrai('le paquet, lui, est bien retiré', !contenu.has('cyclades-a-2026-10-01-08h00.paquet'));
}

console.log('\nSans autorisation, rien n’est écrit ni retiré');

{
  const { poignee, contenu } = dossier([{ nom: 'cyclades-a-2026-10-01-08h00.paquet', modifie: T }]);
  (poignee as unknown as { queryPermission: () => Promise<string> }).queryPermission = async () =>
    'prompt';
  let motif = '';
  try {
    await nettoyer(poignee);
  } catch (erreur) {
    motif = (erreur as { motif?: string }).motif ?? 'autre';
  }
  v('le nettoyage est refusé', motif, 'permission');
  v('et rien n’a été retiré', contenu.size, 1);
}

console.log(echecs === 0 ? '\nTous les essais passent.' : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
