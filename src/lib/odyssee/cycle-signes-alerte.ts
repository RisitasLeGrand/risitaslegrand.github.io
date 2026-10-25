/**
 * Les signes d'alerte liés aux règles : rien que les citations, à leur niveau.
 *
 * ## Ce fichier ne contient aucune phrase de Cyclades
 *
 * Chaque texte affichable ci-dessous est une **citation**, reprise mot pour
 * mot de la collecte d'Alexis du 19 octobre 2026
 * (`docs/cyclades/collectes/D2-signes-alerte-regles-2026-10-19.md`), et le
 * complément qui la gouverne est à côté
 * (`D2-complement-regles-2026-10-19.md`). `essais:signes-alerte` compare
 * chaque citation à la collecte ; une faute de recopie rougit.
 *
 * Les seuls écarts permis sont ceux que la règle 1 du complément nomme : la
 * typographie, et la correction du doublon « votre votre ». Le second est
 * déclaré plus bas, avec son avant et son après, plutôt que caché dans la
 * normalisation — une correction qu'un essai ne voit pas est une
 * reformulation.
 *
 * ## Les trois niveaux, et pourquoi le premier porte la phrase de sa source
 *
 * La règle 2 du complément corrige le classement de la collecte, qui mettait
 * « en urgence » et « appeler le 15 » ensemble. Sept des douze lignes
 * rangées sous « Appeler le 15 » venaient de sources qui disent « en
 * urgence » et **ne citent pas le 15** — la collecte le note elle-même.
 * Afficher « appelez le 15 » au-dessus d'une citation qui ne le dit pas
 * serait une phrase vraie sous un titre qui ne l'est pas.
 *
 * D'où la différence de nature entre les intitulés, et elle est déclarée :
 * celui du premier niveau **est une citation** de la source 1 ; ceux des
 * deux autres sont la formulation du complément, et `sourceDeLIntitule` vaut
 * `null` pour le dire.
 *
 * ## Ce que cette liste ne fait jamais
 *
 * Elle ne se déclenche pas. La règle 5 est explicite : « pas de score, pas
 * de déduction à partir des données saisies. La liste ne se déclenche
 * **jamais** toute seule d'après le suivi : elle est consultable, et le
 * renvoi y mène. » Ce module n'expose donc **aucune fonction qui prenne une
 * saisie en paramètre** — ce n'est pas un oubli, c'est la forme que la règle
 * impose. Il n'y a pas de chemin discret vers un déclenchement.
 *
 * Et la règle 5 interdit aussi le rouge d'alarme : l'écran qui affichera
 * ceci n'emploiera pas la couleur d'erreur, et son essai le vérifiera quand
 * il existera.
 */
import type { Citation } from './chaines-du-suivi';

/* ══════════════════════════════════════════════════════════════════════════
   Les pages citées, avec leur date
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les quatre pages affichées, numérotées comme la collecte les numérote.
 *
 * La source 5 — le PNDS de la HAS — **n'est pas ici**, et c'est la règle 3 :
 * elle concerne une maladie hémorragique rare ou s'adresse aux
 * professionnels. L'écarter est un choix, pas un oubli, et c'est pourquoi
 * elle est nommée dans `SOURCE_ECARTEE` plutôt que simplement absente.
 */
export interface PageCitee {
  numero: number;
  /** Le site, tel qu'on le nomme à l'écran. */
  site: string;
  titre: string;
  adresse: string;
  /** La date de mise à jour affichée par la page, dans ses mots. */
  misAJourLe: string;
}

export const PAGES_CITEES: readonly PageCitee[] = [
  {
    numero: 1,
    site: 'ameli',
    titre:
      'Saignements entre les règles ou règles très abondantes : quand consulter ?',
    adresse:
      'https://www.ameli.fr/assure/sante/themes/saignements-gynecologiques-anormaux/saignements-entre-les-regles-ou-regles-tres-abondantes-longues-le-bilan',
    misAJourLe: '25 juin 2026',
  },
  {
    numero: 2,
    site: 'ameli',
    titre: 'Douleurs pendant les règles : que faire pour être soulagée ?',
    adresse:
      'https://www.ameli.fr/assure/sante/themes/regles-douloureuses/que-faire-quand-consulter',
    misAJourLe: '25 juin 2025',
  },
  {
    numero: 3,
    site: 'ameli',
    titre: 'Protections périodiques et risque de choc toxique lors des règles',
    adresse:
      'https://www.ameli.fr/assure/sante/themes/regles-et-protections-intimes/protections-periodiques-et-risque-de-choc-toxique-lors-des-regles',
    misAJourLe: '29 septembre 2026',
  },
  {
    numero: 4,
    site: 'ameli',
    titre: 'Grossesse extra-utérine',
    adresse:
      'https://www.ameli.fr/assure/sante/devenir-parent/grossesse/difficultes-et-maladies-pendant-la-grossesse/grossesse-extra-uterine',
    misAJourLe: '08 décembre 2025',
  },
];

/** Le jour où Alexis a fait la collecte. Affiché sous la liste (règle 4). */
export const COLLECTE_LE = '19 octobre 2026';

/**
 * La source que le complément écarte, et la raison.
 *
 * Déclarée plutôt qu'absente : une source lue puis écartée et une source
 * jamais lue ne disent pas la même chose, et l'essai vérifie qu'elle
 * n'apparaît nulle part.
 */
export const SOURCE_ECARTEE = {
  numero: 5,
  nom: 'HAS, PNDS « Saignements Utérins Abondants »',
  pourquoi:
    'Elle concerne une maladie hémorragique rare ou s’adresse aux professionnels de santé. ' +
    'Règle 3 du complément D2.',
} as const;

/* ══════════════════════════════════════════════════════════════════════════
   La seule correction permise, déclarée
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le doublon de la source 2, corrigé parce que la règle 1 le permet.
 *
 * La page ameli écrit « sur votre votre vie quotidienne ». La collecte le
 * note. Le complément autorise nommément cette correction — et elle est
 * déclarée ici, avec son avant et son après, pour que l'essai puisse en
 * tenir compte **explicitement** au lieu de la laisser passer par une
 * normalisation qui tolérerait aussi toutes les autres.
 */
export const CORRECTIONS_PERMISES: readonly { avant: string; apres: string }[] = [
  { avant: 'votre votre vie quotidienne', apres: 'votre vie quotidienne' },
];

/* ══════════════════════════════════════════════════════════════════════════
   Les niveaux
   ══════════════════════════════════════════════════════════════════════════ */

const c = (texte: string, source: number, ou?: string): Citation => ({
  texte,
  source: `${source}`,
  ...(ou ? { ou } : {}),
});

/**
 * Un groupe de signes partageant la phrase d'introduction de leur source.
 *
 * Les sources écrivent ainsi : une phrase qui pose la condition, puis une
 * liste. Les séparer en autant de citations complètes aurait répété
 * l'introduction douze fois à l'écran ; les fondre en une seule aurait perdu
 * le fait que chaque item est une citation distincte.
 */
export interface GroupeDeSignes {
  /** La phrase qui introduit la liste, citée. `null` quand la source n'en a pas. */
  introduction: Citation | null;
  items: readonly Citation[];
}

export interface NiveauDAlerte {
  id: string;
  /** L'intitulé affiché. */
  intitule: string;
  /**
   * La source de l'intitulé, ou `null` s'il vient du complément.
   *
   * La distinction n'est pas cosmétique : le premier niveau cite sa source
   * mot pour mot, les deux autres portent la formulation du complément. Un
   * essai qui chercherait les trois dans la collecte échouerait sur deux, et
   * la tentation serait de les y faire entrer.
   */
  sourceDeLIntitule: string | null;
  groupes: readonly GroupeDeSignes[];
}

export const NIVEAUX: readonly NiveauDAlerte[] = [
  {
    id: 'urgence-15',
    intitule: 'Je consulte un médecin gynécologue en urgence ou j’appelle le 15 si :',
    sourceDeLIntitule: '1',
    groupes: [
      {
        introduction: null,
        items: [
          c(
            'je suis en âge d’avoir des enfants, et après un retard de règles, je saigne et j’ai ' +
              'des douleurs pelviennes (bas du ventre) associées pouvant faire craindre une ' +
              'grossesse extra-utérine ou une fausse couche ;',
            1,
          ),
          c(
            'je saigne abondamment et je me sens mal : je fais un malaise ou je me sens très ' +
              'faible ;',
            1,
          ),
          c('je saigne et j’ai de la fièvre.', 1),
        ],
      },
    ],
  },
  {
    id: 'urgence-sans-15',
    intitule: 'Consulter en urgence',
    sourceDeLIntitule: null,
    groupes: [
      {
        introduction: c(
          'Dès l’apparition des premiers symptômes, enlevez le tampon ou la coupe et consultez ' +
            'en urgence.',
          3,
        ),
        items: [
          c(
            'Le choc toxique survient de façon soudaine, pendant les règles ou peu de temps après.',
            3,
          ),
          c('Il se manifeste par une forte fièvre (supérieure à 38,9 °C)', 3),
          c(
            'des symptômes qui rappellent ceux de la grippe (douleurs musculaires, mal de gorge)',
            3,
          ),
          c(
            'ou de la gastro-entérite (nausées, vomissements, diarrhée, douleurs abdominales)',
            3,
          ),
          c(
            'Une éruption cutanée généralisée (comme un coup de soleil) apparait dans les ' +
              '2 premiers jours',
            3,
          ),
          c(
            'Mais dans les cas les plus extrêmes, très rares heureusement, le choc toxique est ' +
              'plus fort avec une hypotension, un malaise, une défaillance des principaux ' +
              'organes (cœur, reins, poumons…)',
            3,
          ),
        ],
      },
      {
        introduction: c(
          'Vous avez un retard de règles (en rapport avec un début de grossesse), vous pensez ' +
            'être enceinte ou vous ne savez pas si vous l’êtes, n’hésitez pas à consulter un ' +
            'médecin en urgence si vous présentez :',
          4,
        ),
        items: [
          c(
            'des douleurs dans le bas-ventre, souvent d’un seul côté, souvent sourdes avec des ' +
              'accès plus intenses. Ces douleurs sont parfois absentes ;',
            4,
          ),
          c('des saignements vaginaux peu abondants de couleur noirâtre.', 4),
          c(
            'En présence de ces symptômes, consultez très rapidement car, le danger, en ' +
              'l’absence de traitement précoce, est la survenue d’une rupture de la trompe ' +
              'utérine avec hémorragie interne intrapéritonéale.',
            4,
          ),
        ],
      },
    ],
  },
  {
    id: 'rendez-vous',
    intitule: 'Prendre rendez-vous',
    sourceDeLIntitule: null,
    groupes: [
      {
        introduction: null,
        items: [
          c(
            'Dans les situations autres que celles-ci, je prends rendez-vous chez mon médecin ' +
              'traitant ou la sage-femme qui me suit.',
            1,
          ),
          c(
            'Cependant, dans certaines situations (douleurs non calmées par le traitement...), ' +
              'un avis médical est nécessaire.',
            2,
          ),
        ],
      },
      {
        introduction: c('Consultez votre médecin si les douleurs lors des règles :', 2),
        items: [
          c(
            'ne sont pas soulagées par les médicaments anti-inflammatoires non stéroïdiens ' +
              '(AINS) ;',
            2,
          ),
          c('apparaissent à l’âge adulte (jusque-là, vos règles étaient peu douloureuses) ;', 2),
          c('s’aggravent anormalement ;', 2),
          c('durent plusieurs jours, avant et après les règles ;', 2),
          c(
            'ont un retentissement important sur votre vie quotidienne (absentéisme scolaire ou ' +
              'professionnel).',
            2,
          ),
        ],
      },
      {
        introduction: c('Consultez également si vous avez des symptômes associés à la douleur :', 2),
        items: [
          c('fièvre ;', 2),
          c('pertes vaginales (écoulement vaginal anormal) ;', 2),
          c('saignements entre les règles (métrorragies) ;', 2),
          c('règles anormalement abondantes (ménorragies) ;', 2),
          c('douleurs lors des rapports sexuels ;', 2),
          c('syndrome de l’intestin irritable.', 2),
        ],
      },
    ],
  },
];

/** Toutes les citations, dans l'ordre d'affichage. */
export const TOUTES_LES_CITATIONS: readonly Citation[] = NIVEAUX.flatMap((n) =>
  n.groupes.flatMap((g) => (g.introduction ? [g.introduction, ...g.items] : [...g.items])),
);

/* ══════════════════════════════════════════════════════════════════════════
   Contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les invariants que ce module peut vérifier seul.
 *
 * La fidélité à la collecte ne s'en déduit pas : elle demande de lire le
 * fichier de collecte, ce que seul l'essai fait. Ici on garde la forme — et
 * la règle 2, qui est la plus facile à perdre : le 15 ne doit apparaître
 * qu'au premier niveau.
 */
export function controlerLesSignesDAlerte(): string[] {
  const problemes: string[] = [];

  if (NIVEAUX.length !== 3) {
    problemes.push(`Trois niveaux sont attendus (règle 2), il y en a ${NIVEAUX.length}.`);
  }

  for (const niveau of NIVEAUX) {
    if (!niveau.intitule.trim()) problemes.push(`Le niveau « ${niveau.id} » n’a pas d’intitulé.`);
    if (!niveau.groupes.length) problemes.push(`Le niveau « ${niveau.id} » ne porte aucun signe.`);
    for (const groupe of niveau.groupes) {
      if (!groupe.items.length) {
        problemes.push(`Un groupe du niveau « ${niveau.id} » ne porte aucun signe.`);
      }
      for (const item of [...(groupe.introduction ? [groupe.introduction] : []), ...groupe.items]) {
        if (!item.texte.trim()) problemes.push(`Une citation vide dans « ${niveau.id} ».`);
        if (item.source === `${SOURCE_ECARTEE.numero}`) {
          problemes.push(
            `« ${niveau.id} » cite la source ${SOURCE_ECARTEE.numero}, que la règle 3 écarte.`,
          );
        }
        if (!PAGES_CITEES.some((p) => `${p.numero}` === item.source)) {
          problemes.push(`Une citation de « ${niveau.id} » nomme une source non déclarée.`);
        }
      }
    }
  }

  /*
     LE 15 N'APPARAÎT QU'AU PREMIER NIVEAU, et c'est la règle 2. Le balayage
     cherche le nombre entouré de limites de mot : « 15 » dans « 15 jours »
     ne compte pas, et aucune citation n'en porte aujourd'hui — mais la
     prochaine pourrait.
  */
  for (const niveau of NIVEAUX) {
    if (niveau.id === 'urgence-15') continue;
    const textes = [
      niveau.intitule,
      ...niveau.groupes.flatMap((g) => [
        ...(g.introduction ? [g.introduction.texte] : []),
        ...g.items.map((i) => i.texte),
      ]),
    ];
    for (const texte of textes) {
      if (/(?<![\d,.])15(?![\d,.])/.test(texte)) {
        problemes.push(
          `« ${niveau.id} » mentionne le 15, que la règle 2 réserve au premier niveau.`,
        );
      }
    }
  }

  for (const page of PAGES_CITEES) {
    if (!page.misAJourLe.trim()) {
      problemes.push(`La source ${page.numero} n’affiche pas sa date de mise à jour (règle 4).`);
    }
    if (!page.adresse.startsWith('https://')) {
      problemes.push(`La source ${page.numero} ne porte pas une adresse vérifiable.`);
    }
  }

  return problemes;
}
