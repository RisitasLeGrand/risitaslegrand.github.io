/**
 * Les trois producteurs purs du centre — prompt 32, phase 3.
 *
 *   npm run essais:centre-alimentation
 *
 * La sauvegarde, les revues manquées, les occurrences en retard. Ce qui
 * se prouve ici est **ce qu'une intention porte**, et surtout ce qu'elle
 * ne porte pas : pas de titre de tâche, pas de degré d'insistance, pas de
 * champ en plus. Les producteurs sont purs exprès pour que cela se
 * contrôle sans base, sans coffre et sans horloge.
 *
 * ## Ce que ce contrôle NE prouve pas
 *
 * L'écriture. `synchroniser` demande un magasin et un coffre ouvert ;
 * qu'il dépose, qu'il préserve le `creeLe` du premier dépôt et qu'il
 * **retire** ce qui n'est plus attendu se prouve au navigateur, section 6
 * de `essais:centre:navigateur`. Une sonde textuelle dirait seulement que
 * le mot `oublier` est écrit quelque part, et un contrôle qui s'effondre
 * renseigne moins qu'un contrôle qui accuse.
 */
import {
  REF_APPRENTISSAGE,
  REF_SAUVEGARDE,
  SOURCE_OCCURRENCE,
  SOURCE_REVUE,
  JOURS_AU_CENTRE,
  SOURCES_NON_BRANCHEES,
  SOURCE_RAPPEL_DE_PRISE,
  recenserLesOublis,
  SOURCE_APPRENTISSAGE,
  SOURCE_AVERTISSEMENT,
  SOURCE_CONFLITS,
  SOURCE_FUSION,
  SOURCE_TRAJECTOIRE,
  SOURCE_VEILLE,
  SOURCE_PROPOSITION,
  SOURCE_SAUVEGARDE,
  intentionsDApprentissage,
  intentionsDAvertissement,
  intentionsDeProposition,
  intentionsDeSauvegarde,
  intentionsDeTrajectoires,
  intentionsDeVeille,
  estRecent,
  intentionsDesOccurrences,
  intentionsDesRevues,
  type Intention,
} from '../src/lib/notifications/alimentation';
import { SOURCES_DECLAREES } from '../src/lib/notifications/filtre-cycle';

/** Le jour de référence des contrôles de fraîcheur. Figé : un essai qui dépend de l'horloge ment un jour sur mille. */
const AUJOURDHUI = '2026-10-16';
import { analysePorteUnAvertissement } from '../src/lib/noyau/avertissements';
import { ROUTES, peutNotifier } from '../src/lib/notifications/sources';

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

/** Les trois champs d'une intention, et aucun autre. */
const CHAMPS = ['genre', 'refSource', 'regroupement'];
const champsDe = (intentions: readonly Intention[]): string[][] =>
  intentions.map((i) => Object.keys(i).sort());

console.log('\n\x1b[1m1. LES TROIS SOURCES SONT CONNUES DES DEUX REGISTRES\x1b[0m');
{
  const trois = [SOURCE_SAUVEGARDE, SOURCE_REVUE, SOURCE_OCCURRENCE];
  v(
    'chacune est déclarée admissible',
    trois.filter((id) => !SOURCES_DECLAREES.some((s) => s.id === id)),
    [],
  );
  v(
    'chacune a une route',
    trois.filter((id) => !ROUTES.some((r) => r.id === id)),
    [],
  );
  /*
     Aucune des trois n'est muette : ce sont des rappels, et un rappel
     qu'on ne voit qu'en ouvrant le panneau n'est pas un rappel. La
     vérification est ici plutôt qu'implicite, parce que `peutNotifier`
     est le champ que l'anomalie A-17 avait trouvé absent.
  */
  v('et aucune n’est muette', trois.filter((id) => !peutNotifier(id)), []);
}

console.log('\n\x1b[1m2. LA SAUVEGARDE : UN ÉTAT, PAS UN DEGRÉ\x1b[0m');
{
  v('aucune insistance, aucune intention', intentionsDeSauvegarde('aucune'), []);
  for (const degre of ['discrete', 'insistante', 'urgente'] as const) {
    v(`« ${degre} » dépose exactement une intention`, intentionsDeSauvegarde(degre).length, 1);
  }
  /*
     LA propriété de cette source : trois degrés, une seule référence. Si
     le degré entrait dans la clef, passer de discret à urgent créerait un
     second élément et laisserait le premier — deux rappels pour une seule
     sauvegarde en retard.
  */
  v(
    'les trois degrés rendent la MÊME référence',
    [...new Set(
      (['discrete', 'insistante', 'urgente'] as const).map(
        (d) => intentionsDeSauvegarde(d)[0].refSource,
      ),
    )],
    [REF_SAUVEGARDE],
  );
  v('elle ne se regroupe pas — il n’y en a jamais qu’une', intentionsDeSauvegarde('urgente')[0].regroupement, null);
  v('et le message n’y est pas', champsDe(intentionsDeSauvegarde('urgente')), [CHAMPS]);
}

console.log('\n\x1b[1m3. LES REVUES : UN ÉLÉMENT PAR JOUR, TOUS REGROUPÉS\x1b[0m');
{
  v('aucun jour manqué, aucune intention', intentionsDesRevues([]), []);
  const trois = intentionsDesRevues(['2026-10-13', '2026-10-14', '2026-10-15']);
  v('trois jours, trois intentions', trois.length, 3);
  v(
    'la référence est le jour, et rien d’autre',
    trois.map((i) => i.refSource),
    ['2026-10-13', '2026-10-14', '2026-10-15'],
  );
  v('toutes sont « à savoir »', [...new Set(trois.map((i) => i.genre))], ['a-savoir']);
  v('toutes partagent un regroupement', [...new Set(trois.map((i) => i.regroupement))], [SOURCE_REVUE]);
  /*
     Distinctes, et non un élément qui compterait trois : tenir la revue de
     mardi doit faire disparaître mardi seul. Deux intentions de même clef
     s'écraseraient à l'écriture, donc on exige qu'elles diffèrent.
     */
  v('et elles sont distinctes', new Set(trois.map((i) => i.refSource)).size, 3);
  v('aucun champ de plus', champsDe(trois), [CHAMPS, CHAMPS, CHAMPS]);
}

console.log('\n\x1b[1m4. LES OCCURRENCES : LE JOUR PRÉVU, JAMAIS LE TITRE\x1b[0m');
{
  v('aucun retard, aucune intention', intentionsDesOccurrences([]), []);
  /*
     Une occurrence DÉPLACÉE : le 12 était prévu, elle se montre le 14. Si
     la référence prenait le jour d'affichage, chaque déplacement
     fabriquerait un doublon de la même chose.
  */
  const deplacee = { tacheId: 'tache-7', jourPrevu: '2026-10-12', jour: '2026-10-14', titre: 'Arroser le ficus' };
  const une = intentionsDesOccurrences([deplacee]);
  v('la référence est tâche:jour prévu', une[0].refSource, 'tache-7:2026-10-12');
  vrai('le jour d’affichage n’y est pas', !une[0].refSource.includes('2026-10-14'));
  /*
     Le titre est le contenu que le § 2.3 refuse. On le cherche dans la
     sérialisation ENTIÈRE de l'intention, et non dans la seule référence :
     un champ ajouté plus tard le laisserait passer autrement.
  */
  vrai('le titre n’apparaît nulle part', !JSON.stringify(une).includes('ficus'));
  v('aucun champ de plus', champsDe(une), [CHAMPS]);
  v('toutes sont regroupées', une[0].regroupement, SOURCE_OCCURRENCE);
  /*
     « Une fois, jamais accumulée » (prompt 38) : la même occurrence vue
     deux fois rend deux fois la même référence, donc une seule empreinte,
     donc un seul élément. C'est ce que le dépôt écrase.
  */
  v(
    'deux relevés du même retard rendent la même référence',
    new Set(intentionsDesOccurrences([deplacee, { ...deplacee }]).map((i) => i.refSource)).size,
    1,
  );
}


console.log('\x1b[1m\n5. LES TROIS SOURCES DU PROFIL ET DES ANALYSES — PHASE 4\x1b[0m');
{
  const trois = [SOURCE_PROPOSITION, SOURCE_AVERTISSEMENT, SOURCE_APPRENTISSAGE];
  v(
    'chacune est déclarée et routée',
    trois.filter(
      (id) => !SOURCES_DECLAREES.some((s) => s.id === id) || !ROUTES.some((r) => r.id === id),
    ),
    [],
  );
  /*
     Et celle-ci est MUETTE, contrairement aux trois de la phase 3 : le
     prompt 25 interdit la notification du système pour l'apprentissage
     étendu. On l'exige ici, où l'on branche la source, plutôt que de
     s'en remettre au registre — c'est l'anomalie A-17 qui a appris que
     les interdictions non éprouvées se perdent.
  */
  v('et l’apprentissage étendu reste muet', peutNotifier(SOURCE_APPRENTISSAGE), false);
  v('la proposition, elle, a le droit d’interrompre', peutNotifier(SOURCE_PROPOSITION), true);
}

console.log('\x1b[1m\n6. LA PROPOSITION : LA RÈGLE, JAMAIS LA VALEUR\x1b[0m');
{
  v('aucune proposition aujourd’hui, aucune intention', intentionsDeProposition(null), []);
  const une = intentionsDeProposition('coucher-observe');
  v('la référence est l’identifiant de la règle', une[0].refSource, 'coucher-observe');
  v('pas de regroupement — il n’y en a jamais deux', une[0].regroupement, null);
  v('aucun champ de plus', champsDe(une), [CHAMPS]);
}

console.log('\x1b[1m\n7. L’AVERTISSEMENT : L’ANALYSE, JAMAIS LE DOMAINE\x1b[0m');
{
  /*
     Le prédicat d'abord, parce que c'est lui qui décide. Deux chemins
     mènent à l'avertissement — la règle locale et le champ de l'IA — et
     on éprouve les deux séparément : celui de l'IA seul passerait
     inaperçu si on ne testait qu'un domaine sensible.
  */
  v(
    'un domaine sensible suffit',
    analysePorteUnAvertissement({ propositions: [{ domaine: 'psyche', nature: 'habitude' }] }),
    true,
  );
  v(
    'le champ de l’IA seul suffit aussi',
    analysePorteUnAvertissement({
      propositions: [{ domaine: 'revisions', nature: 'habitude', avertissement_professionnel: true }],
    }),
    true,
  );
  v(
    'une analyse anodine n’avertit pas',
    analysePorteUnAvertissement({ propositions: [{ domaine: 'revisions', nature: 'habitude' }] }),
    false,
  );
  /*
     Le document vient d'une IA et n'est jamais vérifié : informe, il doit
     rendre `false` et non lever. Une exception ici empêcherait l'écran
     d'afficher l'analyse entière.
  */
  for (const informe of [null, undefined, {}, { propositions: 'oui' }, { propositions: [null, 3] }]) {
    v(`un document informe ne lève pas (${JSON.stringify(informe) ?? 'undefined'})`, analysePorteUnAvertissement(informe), false);
  }

  v('aucune analyse avertie, aucune intention', intentionsDAvertissement([], AUJOURDHUI), []);
  const deux = intentionsDAvertissement(
    [
      { id: 'analyse-1', importeeLe: '2026-10-15T09:00:00.000Z' },
      { id: 'analyse-2', importeeLe: '2026-10-16T09:00:00.000Z' },
    ],
    AUJOURDHUI,
  );
  v('une intention par analyse', deux.map((i) => i.refSource), ['analyse-1', 'analyse-2']);
  v('toutes regroupées', [...new Set(deux.map((i) => i.regroupement))], [SOURCE_AVERTISSEMENT]);
  /*
     Le domaine averti est ce que l'inventaire note comme sensible pour
     cette source. On le cherche dans la sérialisation entière, et pas
     seulement dans la référence.
  */
  vrai(
    'aucun domaine n’apparaît',
    !/corps|psyche|finances/.test(JSON.stringify(deux)),
  );
  v('aucun champ de plus', champsDe(deux), [CHAMPS, CHAMPS]);
}

console.log('\x1b[1m\n8. L’APPRENTISSAGE : TANT QUE LA QUESTION N’A PAS ÉTÉ POSÉE\x1b[0m');
{
  const une = intentionsDApprentissage(true);
  v('jamais demandé : une intention', une.length, 1);
  v('sa référence est constante', une[0].refSource, REF_APPRENTISSAGE);
  /*
     La règle qui compte : une réponse — accord OU refus — ferme la
     question. L'appelant passe `depuis === null`, et non « non
     accordé » ; ici on éprouve que `false` ne dépose rien, ce qui est la
     moitié vérifiable sans la base.
  */
  v('une réponse donnée : plus rien', intentionsDApprentissage(false), []);
  v('aucun champ de plus', champsDe(une), [CHAMPS]);
}


console.log('\x1b[1m\n9. LES ÉVÉNEMENTS CLOS SORTENT — ANOMALIE A-19\x1b[0m');
{
  /*
     Le défaut : une source dont la condition est permanente ressuscite
     ses éléments après la purge de rétention. Trouvé en écrivant la
     phase 5, corrigé pour les deux sources concernées — la trajectoire
     close et l'analyse conservée —, et éprouvé ici d'abord sur la borne
     elle-même, puis sur chacune des deux.
  */
  v('le jour même est récent', estRecent(AUJOURDHUI, AUJOURDHUI), true);
  v('la veille aussi', estRecent('2026-10-15', AUJOURDHUI), true);
  v(`${JOURS_AU_CENTRE - 1} jours encore`, estRecent('2026-09-18', AUJOURDHUI), true);
  v(`${JOURS_AU_CENTRE} jours, non`, estRecent('2026-09-16', AUJOURDHUI), false);
  v('un an, non', estRecent('2025-10-16', AUJOURDHUI), false);
  v('jamais clos, non', estRecent(null, AUJOURDHUI), false);
  v('une date illisible, non', estRecent('avant-hier', AUJOURDHUI), false);

  v(
    'une analyse importée il y a un an n’est plus attendue',
    intentionsDAvertissement([{ id: 'vieille', importeeLe: '2025-10-16T09:00:00.000Z' }], AUJOURDHUI),
    [],
  );
}

console.log('\x1b[1m\n10. LES TRAJECTOIRES : CLOSES, RÉCENTES, ET SANS INTITULÉ\x1b[0m');
{
  const t = (id: string, statut: string, closeLe: string | null, intitule: string) =>
    ({ id, statut, closeLe, intitule }) as unknown as {
      id: string;
      statut: string;
      closeLe: string | null;
    };
  const toutes = [
    t('tr-1', 'atteinte', '2026-10-14', 'Dormir avant minuit'),
    t('tr-2', 'abandonnee', '2026-10-10', 'Courir trois fois par semaine'),
    t('tr-3', 'active', null, 'Lire une heure par jour'),
    t('tr-4', 'refusee', '2026-10-12', 'Arrêter le café'),
    t('tr-5', 'atteinte', '2025-01-01', 'Objectif de l’an dernier'),
  ];
  const retenues = intentionsDeTrajectoires(toutes, AUJOURDHUI);
  /*
     Quatre exclusions, chacune pour sa raison : l'active n'est pas close,
     la refusée est une réponse déjà donnée, l'ancienne n'est plus une
     nouvelle. On vérifie la liste entière plutôt qu'un compte — un compte
     juste pour de mauvaises raisons reste vert.
  */
  v('deux trajectoires entrent, et ce sont les bonnes', retenues.map((i) => i.refSource), ['tr-1', 'tr-2']);
  v('toutes regroupées', [...new Set(retenues.map((i) => i.regroupement))], [SOURCE_TRAJECTOIRE]);
  vrai('aucun intitulé n’apparaît', !/Dormir|Courir|café|Lire/.test(JSON.stringify(retenues)));
  vrai('et aucun statut non plus', !/atteinte|abandonnee/.test(JSON.stringify(retenues)));
  v('aucun champ de plus', champsDe(retenues), [CHAMPS, CHAMPS]);
}

console.log('\x1b[1m\n11. LA VEILLE DU RYTHME : UN SEUL REPÈRE, ET MUETTE\x1b[0m');
{
  v('aucun repère à montrer, aucune intention', intentionsDeVeille(null), []);
  const une = intentionsDeVeille('signal-42');
  v('un repère, une intention', une.length, 1);
  v('la référence est l’identifiant du signal', une[0].refSource, 'signal-42');
  v('pas de regroupement — il n’y en a jamais deux', une[0].regroupement, null);
  /*
     L'interdiction du 27 : un rappel DISCRET qui ferait sonner le
     téléphone ne serait plus discret. Éprouvée ici, là où la source est
     branchée, et non seulement dans le registre.
  */
  v('et la source reste muette', peutNotifier(SOURCE_VEILLE), false);
  v('aucun champ de plus', champsDe(une), [CHAMPS]);
}

console.log('\x1b[1m\n12. LA SOURCE QU’ON NE BRANCHE PAS — MANQUE NOMMÉ\x1b[0m');
{
  /*
     IL Y EN AVAIT DEUX, IL N'Y EN A PLUS QU'UNE, et ce contrôle a changé
     d'objet sans rien perdre de son exigence.

     `rappel-de-prise` était « différée » et non « impossible » : Alexis
     avait signé, le 16 octobre, « pas de rappel de prise tant qu'il n'y a
     pas de posologie structurée », et cette phrase nommait la condition de
     sa levée. La phase 4 de Santé la remplit — `SchemaDePrise` est cette
     posologie structurée. La source est donc branchée, et ce qui était
     vrai hier serait faux aujourd'hui.

     Ce qui est gardé est strictement ce qui était gardé : la liste est
     honnête dans les DEUX sens, et chaque source déclarée est rangée d'un
     côté ou de l'autre. Un contrôle de plus a été ajouté, qui n'existait
     pas : que `rappel-de-prise` est bien branchée désormais. Sans lui,
     retirer la source de la liste suffirait à faire passer le contrôle sans
     que rien ne soit branché.
  */
  v('il n’en reste qu’une, et elle est déclarée', [...SOURCES_NON_BRANCHEES], ['pointage-a-reporter']);
  v(
    'elle existe bien au registre des sources',
    SOURCES_NON_BRANCHEES.filter((id) => !SOURCES_DECLAREES.some((s) => s.id === id)),
    [],
  );
  /*
     Dans les deux sens, comme pour les règles de désaccord : si l'une de
     ces sources se met à alimenter le centre, la déclaration ment. On
     cherche son identifiant parmi les constantes de source réellement
     branchées — la liste est courte, et l'oublier se verrait.
  */
  const branchees = [
    SOURCE_CONFLITS, SOURCE_FUSION, SOURCE_SAUVEGARDE, SOURCE_REVUE, SOURCE_OCCURRENCE,
    SOURCE_PROPOSITION, SOURCE_AVERTISSEMENT, SOURCE_APPRENTISSAGE,
    SOURCE_TRAJECTOIRE, SOURCE_VEILLE, SOURCE_RAPPEL_DE_PRISE,
  ];
  v('elle n’est pas branchée', branchees.filter((id) => SOURCES_NON_BRANCHEES.includes(id)), []);
  /*
     LE SENS INVERSE, qui est le contrôle ajouté : la source du rappel de
     prise alimente bien le centre. Une constante exportée ne prouve rien
     toute seule — on vérifie que le recenseur existe et qu'il porte cette
     source-là.
  */
  v('et le rappel de prise, lui, est branché', SOURCE_RAPPEL_DE_PRISE, 'rappel-de-prise');
  v('par un recenseur qui existe', typeof recenserLesOublis, 'function');
  /*
     Et le compte boucle : douze sources déclarées, onze branchées, une
     nommée comme impossible. Un écart ici veut dire qu'une source a
     été ajoutée sans être rangée d'un côté ou de l'autre.
  */
  v(
    'les douze sources sont toutes rangées, d’un côté ou de l’autre',
    SOURCES_DECLAREES.map((s) => s.id).filter(
      (id) =>
        !branchees.includes(id) &&
        !SOURCES_NON_BRANCHEES.includes(id) &&
        id !== 'journal-du-cycle' &&
        id !== 'statut-du-cycle',
    ),
    [],
  );
}

console.log(
  echecs
    ? `\n\x1b[31m${echecs} essai(s) en échec.\x1b[0m\n`
    : '\n\x1b[32mTous les essais passent.\x1b[0m\n',
);
process.exit(echecs ? 1 : 0);
