/**
 * Les invariants du registre des parcours, et de la rotation qui le lit.
 *
 * Deux choses sont vérifiées ici, et aucune ne se voit à l'usage tant qu'un
 * second parcours n'a pas de contenu :
 *
 *  1. **Le registre est cohérent.** Une rotation qui nomme un thème absent du
 *     parcours, un référentiel qui se dit officiel sans source, deux parcours de
 *     même identifiant : autant de fautes qui ne produiraient qu'une case vide
 *     dans un calendrier, des mois après avoir été commises.
 *
 *  2. **Un parcours sans référentiel ne plante pas.** C'est l'état de DGFiP A et
 *     A+ aujourd'hui, et il doit rester un état normal — sept jours sans thème,
 *     une raison affichable, et surtout pas sept jours de repos : se reposer est
 *     une décision, ne pas avoir de programme est une attente, et les confondre
 *     protégerait une série que rien ne protège.
 */
import {
  ID_PARCOURS_PAR_DEFAUT,
  PARCOURS,
  parcours,
  parcoursOuDefaut,
  planifiable,
  raisonNonPlanifiable,
} from '../src/lib/parcours/registre';
import {
  REPOS,
  SANS_THEME,
  estRepos,
  rotationParDefaut,
  rotationsStockees,
  theme,
  themes,
  themesAssignables,
} from '../src/lib/rotation';

let echecs = 0;

function verifier(intitule: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`\x1b[32m✓\x1b[0m ${intitule}`);
    return;
  }
  echecs += 1;
  console.log(`\x1b[31m✗\x1b[0m ${intitule}\n    obtenu  ${a}\n    attendu ${b}`);
}

// --- 1. Cohérence du registre ---------------------------------------------

verifier(
  'les identifiants de parcours sont uniques',
  new Set(PARCOURS.map((p) => p.id)).size,
  PARCOURS.length,
);

verifier(
  'le parcours par défaut existe',
  parcours(ID_PARCOURS_PAR_DEFAUT)?.id,
  ID_PARCOURS_PAR_DEFAUT,
);

for (const p of PARCOURS) {
  verifier(
    `${p.libelle} : les identifiants de thèmes sont uniques`,
    new Set(p.themes.map((t) => t.id)).size,
    p.themes.length,
  );

  verifier(
    `${p.libelle} : aucun thème n’usurpe l’identifiant du repos`,
    p.themes.some((t) => t.id === REPOS.id),
    false,
  );

  const connus = new Set(p.themes.map((t) => t.id));
  verifier(
    `${p.libelle} : la rotation par défaut ne nomme que ses propres thèmes`,
    p.rotationParDefaut.filter((id) => !connus.has(id)),
    [],
  );

  verifier(
    `${p.libelle} : la rotation lue fait sept jours`,
    rotationParDefaut(p).length,
    7,
  );

  // Un référentiel qui se dit établi doit dire sur quoi, et depuis quand.
  if (p.referentiel.origine !== 'a-etablir') {
    verifier(
      `${p.libelle} : son référentiel porte sa source et sa date`,
      Boolean(p.referentiel.source) && /^\d{4}-\d{2}-\d{2}$/.test(p.referentiel.verifieLe ?? ''),
      true,
    );
  }

  verifier(
    `${p.libelle} : « planifiable » et « a des thèmes » disent la même chose`,
    planifiable(p),
    p.themes.length > 0,
  );

  verifier(
    `${p.libelle} : le repos reste assignable`,
    themesAssignables(p).some((t) => t.id === REPOS.id),
    true,
  );

  verifier(
    `${p.libelle} : « themes » ne comprend pas le repos`,
    themes(p).some((t) => t.id === REPOS.id),
    false,
  );
}

verifier(
  'seul le parcours historique est à la racine du contenu',
  PARCOURS.filter((p) => p.racineContenu === '').map((p) => p.id),
  [ID_PARCOURS_PAR_DEFAUT],
);

// --- 2. Un parcours sans référentiel ne plante pas ------------------------

const sansReferentiel = PARCOURS.filter((p) => !planifiable(p));

verifier(
  'des parcours attendent encore leur référentiel officiel',
  sansReferentiel.length > 0,
  true,
);

for (const p of sansReferentiel) {
  verifier(
    `${p.libelle} : sept jours sans thème`,
    rotationParDefaut(p),
    Array(7).fill(SANS_THEME),
  );
  verifier(
    `${p.libelle} : aucun de ces jours n’est un jour de repos`,
    rotationParDefaut(p).some((id) => estRepos(id)),
    false,
  );
  verifier(
    `${p.libelle} : la raison est affichable`,
    Boolean(raisonNonPlanifiable(p)?.length),
    true,
  );
  verifier(
    `${p.libelle} : aucun thème ne se résout`,
    theme(SANS_THEME, p),
    undefined,
  );
}

for (const p of PARCOURS.filter(planifiable)) {
  verifier(`${p.libelle} : sa raison de non-planification est nulle`, raisonNonPlanifiable(p), null);
}

// --- 3. Un identifiant inconnu ramène au parcours par défaut --------------

for (const brut of [null, undefined, '', 'inconnu', 'INSP', '../insp']) {
  verifier(
    `« ${String(brut)} » ramène au parcours par défaut`,
    parcoursOuDefaut(brut).id,
    ID_PARCOURS_PAR_DEFAUT,
  );
}

// --- 4. La migration de la rotation unique --------------------------------

/*
 * La forme antérieure des réglages ne portait qu'une rotation, du temps où le
 * site ne connaissait que l'INSP. Une personne qui avait réglé sa semaine à la
 * main doit la retrouver : la perdre serait un défaut silencieux, puisque la
 * rotation par défaut est plausible et que rien ne signalerait la substitution.
 */
const ancienne = ['repos', 'droit-public', 'economie', 'repos', 'cas-pratique', 'repos', 'repos'];

verifier(
  'une rotation unique devient celle du parcours historique',
  rotationsStockees({ rotation: ancienne, trimestreEcarte: null }),
  { [ID_PARCOURS_PAR_DEFAUT]: ancienne },
);

verifier(
  'la forme par parcours est lue telle quelle',
  rotationsStockees({ rotations: { 'dgfip-b': ancienne }, trimestreEcarte: null }),
  { 'dgfip-b': ancienne },
);

verifier(
  'la forme par parcours a la priorité sur la forme antérieure',
  rotationsStockees({
    rotation: ancienne,
    rotations: { 'dgfip-b': [] },
    trimestreEcarte: null,
  }),
  { 'dgfip-b': [] },
);

verifier('aucun réglage stocké ne donne rien', rotationsStockees(null), {});

verifier(
  'une rotation vide n’est pas migrée comme une rotation',
  rotationsStockees({ rotation: [], trimestreEcarte: null }),
  {},
);

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
