/**
 * Psyché : ce qui sort, ce qui ne sort pas, et ce qu'on refuse de dire.
 *
 * Quatre choses s'éprouvent ici.
 *
 * - **Le vocabulaire.** Un écran de suivi psychique qui emploie « dépression »,
 *   « anxieux » ou « sévère » rend un diagnostic sans en avoir les moyens.
 *   Le contrôle lit les phrases de l'écran, pas l'intention du rédacteur.
 * - **La ligne de base refuse de parler trop tôt.** Moins de trente jours
 *   *mesurés*, et l'écart vaut `null`. Trente jours de calendrier dont cinq
 *   notés ne font pas une moyenne.
 * - **La charge perçue est dérivée, et elle est la seule à sortir.** Elle vaut
 *   `null` si rien ne la nourrit — et non la moitié de l'échelle.
 * - **Le journal ne fuit pas.** La projection publie qu'une entrée existe et
 *   sa longueur ; un contrôle relit les faits produits et refuse tout texte.
 */
import {
  ECART_NOTABLE,
  ECHELLE,
  JOURS_DE_LIGNE_DE_BASE,
  MOTS_INTERDITS,
  chargePercue,
  controlerCheckin,
  controlerEntree,
  controlerHebdo,
  controlerPsyche,
  controlerVocabulairePsyche,
  ecartALaBase,
  joursRestants,
  RESSOURCES,
  type Checkin,
  type CheckinHebdo,
  type Entree,
} from '../src/lib/odyssee/psyche';
import {
  LONGUEUR_MAXIMALE_DUN_DETAIL,
  controlerFuite,
  projeterFaitsPsyche,
} from '../src/lib/odyssee/faits-psyche';
import { fusionner } from '../src/lib/odyssee/faits-branches';
import { CHAMPS_INTERDITS_EN_CLAIR, MAGASINS_SCELLES } from '../src/lib/noyau/coffre';
import { peutLire } from '../src/lib/noyau/permissions';

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

const jourDe = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);

const checkin = (p: Partial<Checkin> = {}): Checkin => ({
  id: '2026-10-12',
  jour: '2026-10-12',
  le: '2026-10-12T09:00:00.000Z',
  humeur: 6,
  energie: 5,
  stress: 4,
  motivation: 7,
  note: '',
  majLe: '2026-10-12T09:00:00.000Z',
  ...p,
});

/**
 * Une série de jours consécutifs, une dimension renseignée, les autres nulles.
 * `valeurs[i]` vaut `null` pour un jour **noté sans cette dimension**.
 */
const serie = (valeurs: readonly (number | null)[]): Checkin[] =>
  valeurs.map((valeur, i) =>
    checkin({
      id: jourDe(i),
      jour: jourDe(i),
      le: `${jourDe(i)}T09:00:00.000Z`,
      humeur: valeur,
      energie: null,
      stress: null,
      motivation: null,
    }),
  );

/* ════════════════════════════════════════════════════════════════════════
   1. Ce que l'écran n'a pas le droit de dire
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLE VOCABULAIRE');

{
  v('aucun mot interdit dans les textes du module', controlerPsyche(), []);

  vrai('« dépression » est refusé', controlerVocabulairePsyche(['Risque de dépression.']).length > 0);
  vrai(
    '« sévère » aussi, même au féminin',
    controlerVocabulairePsyche(['Une baisse sévère cette semaine.']).length > 0,
  );
  /*
     L'accent ne protège de rien : « depressif » sans accent doit tomber comme
     « dépressif ». C'est exactement la faute qu'un correcteur automatique
     introduit, et elle passerait une recherche littérale.
  */
  vrai(
    'et sans accent également',
    controlerVocabulairePsyche(['un episode depressif']).length > 0,
  );
  v(
    'une phrase neutre passe',
    controlerVocabulairePsyche(['Vous êtes au-dessus de votre moyenne.']),
    [],
  );
  /*
     « stress » est une des quatre dimensions : s'il était interdit, l'écran
     ne pourrait pas nommer sa propre glissière. Le contrôle doit donc
     distinguer la dimension du mot clinique, et ce cas le prouve.
     */
  v('« stress » reste disponible : c’est une dimension', controlerVocabulairePsyche(['Stress']), []);
  vrai('la liste des mots interdits n’est pas vide', MOTS_INTERDITS.length >= 15);
}

console.log('\nLES RESSOURCES');

{
  v('trois numéros, toujours les mêmes', RESSOURCES.map((r) => r.numero), ['3114', '15', '112']);
  vrai(
    'chacun dit quand appeler',
    RESSOURCES.every((r) => r.quand.trim().length > 10),
  );
  /*
     Aucun seuil nulle part dans le module : si un jour quelqu'un faisait
     apparaître le 3114 « quand l'humeur passe sous 3 », il devrait d'abord
     écrire ce 3 quelque part. Rien à tester de plus ici — la garde est que
     `RESSOURCES` ne porte aucun champ de déclenchement, et la forme du type
     l'impose.
  */
  v('aucune ressource ne porte de condition', Object.keys(RESSOURCES[0]), ['nom', 'numero', 'quand']);
}

/* ════════════════════════════════════════════════════════════════════════
   2. Ce qui est refusé à la saisie
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA SAISIE');

{
  v('un check-in ordinaire passe', controlerCheckin(checkin()), []);
  v('les bornes de l’échelle passent', controlerCheckin(checkin({ humeur: ECHELLE.min, stress: ECHELLE.max })), []);
  vrai('hors de l’échelle, refusé', controlerCheckin(checkin({ humeur: 11 })).length > 0);
  vrai('un demi-point, refusé', controlerCheckin(checkin({ energie: 5.5 })).length > 0);
  /*
     Les quatre à `null` **et** aucune note : refusé, et il faut que ce le
     soit. L'identifiant d'un check-in est son jour ; enregistrer un vide
     écraserait donc le check-in réel du même jour par rien du tout. Le bouton
     « Enregistrer » pressé par inadvertance effacerait la matinée.
  */
  vrai(
    'un check-in entièrement vide est refusé',
    controlerCheckin(
      checkin({ humeur: null, energie: null, stress: null, motivation: null }),
    ).length > 0,
  );
  v(
    'mais une note seule suffit : écrire est une réponse',
    controlerCheckin(
      checkin({ humeur: null, energie: null, stress: null, motivation: null, note: 'Rien à dire.' }),
    ),
    [],
  );
  vrai(
    'un jour qui n’est pas celui de l’identifiant, refusé',
    controlerCheckin(checkin({ id: '2026-10-11' })).length > 0,
  );

  const hebdo: CheckinHebdo = {
    id: '2026-10-12',
    semaine: '2026-10-12',
    le: '2026-10-12T20:00:00.000Z',
    porte: 'Les séances du matin.',
    pese: '',
    besoin: '',
    majLe: '2026-10-12T20:00:00.000Z',
  };
  v('un point de semaine partiel passe', controlerHebdo(hebdo), []);
  vrai(
    'une semaine qui ne tombe pas un lundi, refusée',
    controlerHebdo({ ...hebdo, id: '2026-10-13', semaine: '2026-10-13' }).length > 0,
  );

  const entree: Entree = {
    id: 'E1',
    jour: '2026-10-12',
    le: '2026-10-12T21:00:00.000Z',
    texte: 'Journée longue.',
    majLe: '2026-10-12T21:00:00.000Z',
  };
  v('une entrée de journal passe', controlerEntree(entree), []);
  vrai('une entrée vide, refusée', controlerEntree({ ...entree, texte: '   ' }).length > 0);
}

/* ════════════════════════════════════════════════════════════════════════
   3. La charge perçue
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA CHARGE PERÇUE');

{
  /*
     Énergie 2, stress 8 : une journée difficile. (10 − 2 + 8) / 2 = 8.
     L'énergie est retournée parce qu'elle va dans l'autre sens — beaucoup
     d'énergie allège la charge, beaucoup de stress l'alourdit.
  */
  v('énergie basse et stress haut donnent une charge haute', chargePercue({ energie: 2, stress: 8 }), 8);
  v('l’inverse donne une charge basse', chargePercue({ energie: 8, stress: 2 }), 2);
  v('le stress seul suffit', chargePercue({ energie: null, stress: 7 }), 7);
  v('l’énergie seule aussi, retournée', chargePercue({ energie: 7, stress: null }), 3);
  /*
     Le cas qui compte : ni l'un ni l'autre. La moyenne d'une liste vide vaut
     NaN, et un `|| 0` en ferait une journée « sans charge » — c'est-à-dire
     une journée calme, inventée de toutes pièces.
  */
  v('sans énergie ni stress : null, et non zéro', chargePercue({ energie: null, stress: null }), null);
  v('zéro reste zéro', chargePercue({ energie: 10, stress: 0 }), 0);
}

/* ════════════════════════════════════════════════════════════════════════
   4. La ligne de base
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA LIGNE DE BASE');

{
  v('rien à dire sans aucun check-in', ecartALaBase([], 'humeur'), null);
  /*
     Le compte exact : `JOURS_DE_LIGNE_DE_BASE` pour la base, **plus** les sept
     jours de la fenêtre récente, puisque la base les exclut. Trente-six ne
     suffisent donc pas, trente-sept oui — et les deux cas sont éprouvés,
     parce qu'un seuil n'est juste que si l'on vérifie ses deux côtés.
  */
  const presque = serie(Array.from({ length: JOURS_DE_LIGNE_DE_BASE + 6 }, () => 5));
  v(`${JOURS_DE_LIGNE_DE_BASE + 6} jours ne suffisent pas`, ecartALaBase(presque, 'humeur'), null);
  v('et il en reste un', joursRestants(presque, 'humeur'), 1);
  vrai(
    `${JOURS_DE_LIGNE_DE_BASE + 7} suffisent`,
    ecartALaBase(serie(Array.from({ length: JOURS_DE_LIGNE_DE_BASE + 7 }, () => 5)), 'humeur') !==
      null,
  );

  /*
     Le piège : trente-cinq jours *présents*, dont dix seulement portent
     l'humeur. Compter les check-ins au lieu des mesures donnerait une
     moyenne calculée sur dix points en la présentant comme trente-cinq.
  */
  const trouee = serie([
    ...Array.from({ length: 10 }, () => 5 as number | null),
    ...Array.from({ length: 25 }, () => null),
  ]);
  v('trente-cinq jours dont dix mesurés ne suffisent pas', ecartALaBase(trouee, 'humeur'), null);
  v('il en manque vingt-sept', joursRestants(trouee, 'humeur'), JOURS_DE_LIGNE_DE_BASE + 7 - 10);

  /*
     Une série stable à 5, puis une semaine à 8. La base exclut la période
     récente — sinon la hausse se comparerait à elle-même et se diluerait.
  */
  const hausse = serie([...Array.from({ length: 30 }, () => 5), ...Array.from({ length: 7 }, () => 8)]);
  const ecart = ecartALaBase(hausse, 'humeur');
  vrai('avec assez de jours, un écart existe', ecart !== null);
  v('la tendance est au-dessus', ecart?.tendance, 'au-dessus');
  v('la base ignore la période récente', ecart?.base, 5);
  v('et elle est bien calculée sur trente jours', ecart?.jours, JOURS_DE_LIGNE_DE_BASE);
  v('le récent vaut 8', ecart?.recent, 8);
  v('l’écart vaut 3', ecart?.ecart, 3);
  vrai(`et 3 dépasse le seuil de ${ECART_NOTABLE}`, Math.abs(ecart!.ecart) >= ECART_NOTABLE);

  const plat = serie(Array.from({ length: JOURS_DE_LIGNE_DE_BASE + 7 }, () => 5));
  v('une série plate est dans la moyenne', ecartALaBase(plat, 'humeur')?.tendance, 'dans la moyenne');
}

/* ════════════════════════════════════════════════════════════════════════
   5. Ce que la projection laisse sortir
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLA PROJECTION');

{
  const contenu = {
    checkins: [
      checkin({ id: '2026-10-12', jour: '2026-10-12', energie: 2, stress: 8 }),
      checkin({
        id: '2026-10-13',
        jour: '2026-10-13',
        le: '2026-10-13T09:00:00.000Z',
        humeur: 4,
        energie: null,
        stress: null,
        motivation: null,
      }),
    ],
    hebdos: [
      {
        id: '2026-10-12',
        semaine: '2026-10-12',
        le: '2026-10-12T20:00:00.000Z',
        porte: 'Les séances du matin, et deux soirées sans écran.',
        pese: 'Le dossier de candidature.',
        besoin: '',
        majLe: '2026-10-12T20:00:00.000Z',
      },
    ],
    journal: [
      {
        id: 'E1',
        jour: '2026-10-12',
        le: '2026-10-12T21:00:00.000Z',
        texte:
          'Une entrée volontairement longue, qui contient des choses que personne d’autre ' +
          'n’a à lire, et dont pas un mot ne doit se retrouver dans un fait publié.',
        majLe: '2026-10-12T21:00:00.000Z',
      },
    ],
  };

  const publication = projeterFaitsPsyche(contenu);
  const parType = (t: string) => publication.faits.filter((f) => f.type === t);

  v('aucun fait refusé', publication.refuses, []);
  v('quatre dimensions le 12, une le 13, plus le point de semaine', parType('odyssee.checkin').length, 6);
  v('une charge perçue, et une seule', parType('odyssee.charge-percue').length, 1);
  v('elle vaut 8', parType('odyssee.charge-percue')[0].valeur, 8);
  v('elle est dérivée, pas mesurée', parType('odyssee.charge-percue')[0].source, 'derive');

  /*
     Le point central de tout ce fichier : la charge perçue est **hors** du
     domaine psyché. C'est ce qui la rend lisible par Sport sans lui ouvrir
     quoi que ce soit d'autre.
  */
  v('la charge perçue est dans le domaine corps', parType('odyssee.charge-percue')[0].domaine, 'corps');
  vrai(
    'tout le reste est dans le domaine psyché',
    publication.faits
      .filter((f) => f.type !== 'odyssee.charge-percue')
      .every((f) => f.domaine === 'psyche'),
  );
  /*
     Et elle dit d'où elle vient **sans donner les chiffres** : savoir que
     l'énergie a servi est utile ; savoir qu'elle valait 2 rendrait la psyché
     déductible depuis un fait non sensible.
  */
  v(
    'elle nomme ses sources sans les chiffrer',
    parType('odyssee.charge-percue')[0].details,
    { depuis: ['energie', 'stress'] },
  );

  v(
    'le jour sans énergie ni stress est déclaré en manque',
    publication.manques.map((m) => [m.quoi, m.combien]),
    [['Check-ins sans énergie ni stress', 1]],
  );

  console.log('\nLE JOURNAL NE FUIT PAS');

  const entree = parType('odyssee.journal')[0];
  v('une entrée publiée', parType('odyssee.journal').length, 1);
  v('elle porte sa longueur', entree.details?.caracteres, contenu.journal[0].texte.length);
  faux(
    'et pas son texte',
    JSON.stringify(entree).includes('personne d’autre'),
  );
  v('le contrôle de fuite ne trouve rien', controlerFuite(publication.faits), []);

  /*
     Le contrôle doit *attraper* une fuite, sinon il ne prouve rien. On en
     fabrique une, telle qu'elle arriverait : quelqu'un ajoute un « extrait »
     pour rendre la liste lisible.
  */
  const fuite = publication.faits.map((f) =>
    f.type === 'odyssee.journal'
      ? { ...f, details: { ...f.details, extrait: contenu.journal[0].texte.slice(0, 80) } }
      : f,
  );
  v('un extrait ajouté est attrapé', controlerFuite(fuite).length, 1);
  vrai(
    'et le message nomme le fait en cause',
    controlerFuite(fuite)[0].includes('odyssee.journal:E1'),
  );
  vrai(
    `un détail court reste permis (${LONGUEUR_MAXIMALE_DUN_DETAIL} caractères)`,
    controlerFuite(
      publication.faits.map((f) =>
        f.type === 'odyssee.journal' ? { ...f, details: { ...f.details, humeur: 'calme' } } : f,
      ),
    ).length === 0,
  );

  console.log('\nLE POINT DE SEMAINE NE FUIT PAS NON PLUS');
  const semaine = publication.faits.find((f) => f.id.endsWith(':hebdo'))!;
  v('il compte les questions répondues', semaine.valeur, 2);
  faux('sans publier un mot de ce qui a été écrit', JSON.stringify(semaine).includes('candidature'));
}

/* ════════════════════════════════════════════════════════════════════════
   6. Ce que les autres branches peuvent lire
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nLES PERMISSIONS');

{
  /*
     La vérification qui compte : Sport lit la charge perçue, et rien de la
     psyché. Les deux lignes doivent diverger — si elles donnaient le même
     verdict, la séparation ne tiendrait qu'au nom des champs.
  */
  vrai(
    'Sport peut lire la charge perçue',
    peutLire('sport', 'odyssee.charge-percue').autorise,
  );
  faux('mais pas un check-in', peutLire('sport', 'odyssee.checkin').autorise);
  faux('ni le journal', peutLire('sport', 'odyssee.journal').autorise);
  faux('Révisions non plus', peutLire('revisions', 'odyssee.journal').autorise);
}

console.log('\nLE COFFRE');

{
  const scelles = MAGASINS_SCELLES.map((m) => m.magasin);
  vrai('les check-ins sont scellés', scelles.includes('odysseeCheckins'));
  vrai('les points de semaine aussi', scelles.includes('odysseeHebdos'));
  vrai('et le journal', scelles.includes('odysseeJournal'));
  vrai(
    'le texte du journal est interdit en clair',
    CHAMPS_INTERDITS_EN_CLAIR.includes('texte'),
  );
  vrai('les quatre dimensions aussi', ['humeur', 'energie', 'stress', 'motivation'].every((c) => CHAMPS_INTERDITS_EN_CLAIR.includes(c)));
}

console.log('\nL’AGRÉGAT QUAND LE COFFRE EST FERMÉ');

{
  /*
     L'agrégat ne doit pas échouer parce que Psyché est verrouillée, et il ne
     doit pas se taire non plus : il déclare le manque. On simule ici la
     publication de repli — la fonction qui l'émet est privée, et c'est son
     résultat qui compte.
  */
  const ferme = {
    faits: [],
    refuses: [],
    manques: [{ quoi: 'Psyché, coffre fermé', combien: 1, consequence: 'Rien n’entre.' }],
  };
  const ensemble = fusionner([projeterFaitsPsyche({ checkins: [], hebdos: [], journal: [] }), ferme]);
  v('l’assemblage tient', ensemble.faits, []);
  v('et le manque se voit', ensemble.manques.map((m) => m.quoi), ['Psyché, coffre fermé']);
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32m✓ tout passe\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
