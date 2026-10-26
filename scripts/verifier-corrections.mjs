/**
 * Contrôle des corrections détaillées de la banque de QCM.
 *
 * Deux régimes, pour une raison exposée dans « scripts/lib/corrections-migrees.mjs » :
 * une correction **malformée** est refusée partout, une correction **absente**
 * seulement dans un périmètre déjà migré. Le build échoue dans les deux cas,
 * jamais sur le simple fait que le rattrapage ne soit pas fini.
 *
 * Le rapport imprimé est celui du livrable de couverture : par matière et par
 * rubrique, combien de questions ont une correction, combien un visuel, et
 * combien un « aucun » justifié.
 *
 * Le prétest est hors périmètre, et ce n'est pas un oubli : il ne corrige rien
 * par construction — « rien n'est compté comme une erreur » —, de sorte qu'y
 * exiger une correction irait contre sa raison d'être.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import YAML from 'yaml';
import { decouperSections } from './lib/markdown.mjs';
import { quizSchema, banqueDgfipSchema } from './lib/schema.mjs';
import { estMatiereMigree, estRubriqueMigree, MATIERES_MIGREES, RUBRIQUES_MIGREES } from './lib/corrections-migrees.mjs';
import { contenuEstClos, manquesDeCouverture } from './lib/cloture-contenu.mjs';
import { ecartsDuVisuel } from './lib/decomptes-visuels.mjs';
import { fautesDeFormule } from './lib/maths.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Le corpus lu, et pourquoi il est paramétrable.
 *
 * Même raison que « CYCLADES_JOUR » juste en dessous : un essai qui veut
 * éprouver un REFUS doit disposer d'un contenu fautif. Le faire sur la banque
 * réelle demanderait d'y laisser la faute, où elle s'accumulerait et
 * finirait par être corrigée par quelqu'un qui ne sait pas qu'un essai en
 * dépend. Avec « CYCLADES_CONTENU », l'essai pose son propre corpus de deux
 * fichiers au lieu de salir celui du concours.
 */
const dossierContenu = process.env.CYCLADES_CONTENU
  ? path.resolve(process.env.CYCLADES_CONTENU)
  : path.join(racine, 'content');
const couleur = {
  rouge: (t) => `\x1b[31m${t}\x1b[0m`,
  vert: (t) => `\x1b[32m${t}\x1b[0m`,
  jaune: (t) => `\x1b[33m${t}\x1b[0m`,
  gras: (t) => `\x1b[1m${t}\x1b[0m`,
  faible: (t) => `\x1b[90m${t}\x1b[0m`,
};

const erreurs = [];
const alertes = [];
/**
 * LES ÉCARTS DE VISUEL, À PART — ET POURQUOI ILS N'ARRÊTENT PLUS TOUT.
 *
 * Ce contrôle refusait la construction, et il avait raison sur le fond : un
 * texte de remplacement qui contredit ses propres données est une faute, pas
 * une hypothèse. Mais il refusait AUSSI chez quiconque récupère le corpus
 * publié, qui porte encore les écarts, et dont les corrections ne sont pas au
 * dépôt — le contenu en clair n'y va jamais. Un contrôle juste qui bloque
 * tout le monde ne protège plus rien : il se contourne.
 *
 * Il suit donc la règle de la garde des 100 %, à la décision du Pilote :
 * avertissement fort et nommé tant que le contenu n'est pas clos, refus
 * ensuite. La différence n'est pas un assouplissement — l'écart est dit, en
 * entier, à chaque passage — mais un ordre : d'abord la construction qui
 * passe, puis la dette qu'on solde avant la clôture.
 */
const ecartsDeVisuel = [];
/**
 * Un écart de visuel refuse la construction une fois le contenu clos.
 *
 * Les écarts sont relevés dans « ecartsDeVisuel » DANS LES DEUX RÉGIMES, et
 * c'est seulement à l'heure du verdict qu'ils rejoignent les erreurs. La
 * première version les rangeait d'un côté ou de l'autre selon le drapeau : la
 * ligne de verdict annonçait alors « aucun écart » juste avant de refuser la
 * construction pour un écart. Un décompte ne doit pas dépendre de ce qu'on
 * fera du compte.
 */
const visuelRefuse = contenuEstClos();

/**
 * Le jour de la construction, et pourquoi il est paramétrable.
 *
 * Les contrôles de temporalité comparent des dates à « aujourd'hui ». Un essai
 * qui vérifierait qu'une question expirée fait échouer le build devrait donc
 * inscrire une date passée dans le contenu, et la laisser s'accumuler. Avec
 * « CYCLADES_JOUR », l'essai avance l'horloge au lieu de salir la banque.
 */
const JOUR =
  process.env.CYCLADES_JOUR && /^\d{4}-\d{2}-\d{2}$/.test(process.env.CYCLADES_JOUR)
    ? process.env.CYCLADES_JOUR
    : new Date().toISOString().slice(0, 10);

/** Couverture de l'étiquetage de temporalité, par nature. */
const parNature = new Map();
/*
 * L'échéance passée se compte, et ne se lit pas seulement dans le flot des
 * alertes. Une alerte dit « celle-ci » ; un décompte dit « combien », et c'est
 * le second qui permet de voir une dette grossir d'un passage au suivant. Les
 * vingt premières alertes seules sont affichées — sans ce décompte, une dette
 * de cent questions se lirait comme une dette de vingt.
 */
const echeances = { expirees: 0, aRevoir: 0 };

/** Un compteur de couverture par périmètre. */
function compteur() {
  return { total: 0, corrigees: 0, avecVisuel: 0, aucunJustifie: 0, confianceMoyenne: 0 };
}

function compter(stats, question) {
  stats.total += 1;
  const c = question.correction;
  if (!c) return;
  stats.corrigees += 1;
  if (c.visuel.type === 'aucun') stats.aucunJustifie += 1;
  else stats.avecVisuel += 1;
  if (c.confiance === 'moyenne') stats.confianceMoyenne += 1;
}

async function listerFiches(dossier, base = dossier) {
  const entrees = await readdir(dossier, { withFileTypes: true });
  const fichiers = [];
  for (const entree of entrees) {
    if (entree.name.startsWith('.')) continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) fichiers.push(...(await listerFiches(complet, base)));
    else if (entree.isFile() && entree.name.endsWith('.md') && !entree.name.endsWith('.podcast.md')) {
      fichiers.push(path.relative(base, complet));
    }
  }
  return fichiers.sort();
}

function parserListe(texte) {
  if (!texte?.trim()) return [];
  const nettoye = texte.replace(/^\s*```(?:ya?ml)?\s*$/gim, '').trim();
  if (!nettoye) return [];
  const donnees = YAML.parse(nettoye);
  return Array.isArray(donnees) ? donnees : [];
}

/** Les quiz de cours, matière par matière. */
async function verifierCours() {
  const parMatiere = new Map();
  if (!existsSync(dossierContenu)) return parMatiere;

  for (const relatif of await listerFiches(dossierContenu)) {
    const matiere = relatif.split(path.sep)[0];
    if (matiere === 'qcm-dgfip') continue;
    const brut = await readFile(path.join(dossierContenu, relatif), 'utf8');
    const { content } = matter(brut);

    /*
       Les formules, sur le corps ENTIER de la fiche et non sur la seule
       section de quiz.

       Une formule qui ne compile pas doit arrêter la construction : KaTeX
       refuse, et une correction qui s'afficherait en rouge sur l'écran d'une
       personne qui révise est pire qu'une absence de formule. Le contrôle est
       ici pour que la faute se voie en quelques secondes, et non au bout d'un
       build complet — « build-content » la refuserait de toute façon, mais
       bien plus tard.
    */
    for (const faute of fautesDeFormule(content)) {
      erreurs.push(`${relatif} : ${faute}`);
    }

    const { sections } = decouperSections(content);

    let liste;
    try {
      liste = parserListe(sections.quiz);
    } catch (e) {
      erreurs.push(`${relatif} (## Quiz) : YAML invalide — ${e.message.split('\n')[0]}`);
      continue;
    }

    const stats = parMatiere.get(matiere) ?? compteur();
    parMatiere.set(matiere, stats);

    for (const item of liste) {
      const r = quizSchema.safeParse(item);
      if (!r.success) {
        // Une correction malformée est refusée quel que soit le périmètre.
        erreurs.push(`${relatif} (## Quiz) : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
        stats.total += 1;
        continue;
      }
      compter(stats, r.data);
      /* Un texte de remplacement qui contredit ses propres données est une
         faute, pas une hypothèse — mais elle n'arrête la construction qu'une
         fois le contenu clos. Voir « ecartsDeVisuel » en tête. */
      for (const ecart of ecartsDuVisuel(r.data.correction?.visuel)) {
        ecartsDeVisuel.push(`${relatif} (## Quiz) : « ${r.data.question} » — visuel : ${ecart}`);
      }
      if (!r.data.correction && estMatiereMigree(matiere)) {
        erreurs.push(
          `${relatif} (## Quiz) : « ${r.data.question} » sans bloc « correction » — la matière ${matiere} est déclarée migrée`,
        );
      }
    }
  }
  return parMatiere;
}

/** La banque « QCM - DGFiP », rubrique par rubrique. */
async function verifierDgfip() {
  const parRubrique = new Map();
  const dossier = path.join(dossierContenu, 'qcm-dgfip');
  if (!existsSync(dossier)) return parRubrique;

  for (const nom of (await readdir(dossier)).sort()) {
    if (!/\.ya?ml$/.test(nom)) continue;
    const brut = await readFile(path.join(dossier, nom), 'utf8');
    let donnees;
    try {
      donnees = YAML.parse(brut);
    } catch (e) {
      erreurs.push(`qcm-dgfip/${nom} : YAML invalide — ${e.message.split('\n')[0]}`);
      continue;
    }
    const r = banqueDgfipSchema.safeParse(donnees);
    if (!r.success) {
      erreurs.push(`qcm-dgfip/${nom} : ${r.error.issues.map((i) => i.message).join(' ; ')}`);
      continue;
    }

    const id = path.basename(nom).replace(/\.ya?ml$/, '');
    const stats = compteur();
    parRubrique.set(id, stats);
    for (const question of r.data.questions) {
      compter(stats, question);
      for (const ecart of ecartsDuVisuel(question.correction?.visuel)) {
        ecartsDeVisuel.push(`qcm-dgfip/${nom} : « ${question.question} » — visuel : ${ecart}`);
      }
      if (!question.correction && estRubriqueMigree(id)) {
        erreurs.push(
          `qcm-dgfip/${nom} : « ${question.question} » sans bloc « correction » — la rubrique ${id} est déclarée migrée`,
        );
      }
      controlerLaTemporalite(nom, question);
    }
  }
  return parRubrique;
}

/**
 * Les deux règles de temporalité du prompt 20 (§ qcm.5), et leur asymétrie.
 *
 * **« à venir » expirée : échec.** C'est la lettre de p20.qcm.5, et elle est
 * juste : une question « à venir » dont l'échéance est passée annonce comme
 * futur un fait qui a eu lieu — ou qui n'a pas eu lieu, et c'est pire.
 * Personne ne l'a relue, et le site republierait sciemment du faux.
 *
 * **« passée non historique » expirée : avertissement, pas échec.** Elle est
 * **déjà retirée du tirage** par « estExpiree » : elle n'est plus servie, et
 * le danger est donc écarté sans arrêter la construction. L'étiqueter
 * ainsi, c'est précisément l'acte par lequel on la neutralise ; faire
 * échouer le build sur ce geste punirait celui qui range. Le prompt demande
 * de la remplacer à rubrique et compétence constantes, ce qui est un travail
 * de contenu, pas une urgence de publication.
 *
 * **Revérification : avertissement.** « a_reverifier_le » dit « rouvre le
 * dossier », pas « ceci est faux ». Faire échouer le build là-dessus
 * apprendrait à contourner le contrôle, ce qui est la seule façon certaine de
 * le rendre inutile.
 *
 * Une question **sans bloc de temporalité** n'est ni en erreur ni en alerte :
 * l'étiquetage se fait par lots, et le compte des non étiquetées est au
 * tableau de couverture plutôt que dans le flot des problèmes.
 */
function controlerLaTemporalite(nom, question) {
  const t = question.temporalite;
  const clef = t?.nature ?? 'non étiquetée';
  parNature.set(clef, (parNature.get(clef) ?? 0) + 1);
  if (!t) return;

  const titre = question.question.slice(0, 60);
  if (t.expire_le && t.expire_le < JOUR) {
    const message =
      `qcm-dgfip/${nom} : « ${titre} » a expiré le ${t.expire_le} (nature « ${t.nature} »)`;
    echeances.expirees += 1;
    if (t.nature === 'a-venir') {
      erreurs.push(`${message} — une échéance annoncée comme future est passée, et nul ne l'a relue`);
    } else {
      alertes.push(`${message} — retirée du tirage ; à remplacer à rubrique et compétence constantes`);
    }
  }
  if (t.a_reverifier_le && t.a_reverifier_le < JOUR) {
    echeances.aRevoir += 1;
    alertes.push(
      `qcm-dgfip/${nom} : « ${titre} » était à revérifier le ${t.a_reverifier_le}`,
    );
  }
}

function tableau(titre, entrees, migrees) {
  if (entrees.size === 0) return;
  console.log(`\n${couleur.gras(titre)}\n`);
  const nom = Math.max(titre.length, ...[...entrees.keys()].map((k) => k.length)) + 2;
  console.log(
    `  ${'périmètre'.padEnd(nom)}${'total'.padStart(7)}${'corrigées'.padStart(11)}` +
      `${'visuel'.padStart(8)}${'aucun'.padStart(7)}${'moyenne'.padStart(9)}  état`,
  );
  const cumul = compteur();
  for (const [clef, s] of [...entrees].sort((a, b) => b[1].total - a[1].total)) {
    cumul.total += s.total;
    cumul.corrigees += s.corrigees;
    cumul.avecVisuel += s.avecVisuel;
    cumul.aucunJustifie += s.aucunJustifie;
    cumul.confianceMoyenne += s.confianceMoyenne;
    const migre = migrees.includes(clef);
    const etat = migre
      ? s.corrigees === s.total
        ? couleur.vert('migré')
        : couleur.rouge('migré, incomplet')
      : couleur.faible('inventaire');
    console.log(
      `  ${clef.padEnd(nom)}${String(s.total).padStart(7)}${String(s.corrigees).padStart(11)}` +
        `${String(s.avecVisuel).padStart(8)}${String(s.aucunJustifie).padStart(7)}` +
        `${String(s.confianceMoyenne).padStart(9)}  ${etat}`,
    );
  }
  console.log(
    `  ${couleur.gras('ensemble'.padEnd(nom))}${String(cumul.total).padStart(7)}` +
      `${String(cumul.corrigees).padStart(11)}${String(cumul.avecVisuel).padStart(8)}` +
      `${String(cumul.aucunJustifie).padStart(7)}${String(cumul.confianceMoyenne).padStart(9)}`,
  );
  return cumul;
}

const cours = await verifierCours();
const dgfip = await verifierDgfip();

const cumulCours = tableau('QUIZ DE COURS, PAR MATIÈRE', cours, MATIERES_MIGREES) ?? compteur();
const cumulDgfip = tableau('QCM - DGFIP, PAR RUBRIQUE', dgfip, RUBRIQUES_MIGREES) ?? compteur();

const total = cumulCours.total + cumulDgfip.total;
const corrigees = cumulCours.corrigees + cumulDgfip.corrigees;
const part = total ? Math.round((corrigees / total) * 1000) / 10 : 0;
console.log(
  `\n${couleur.gras('Couverture')} : ${corrigees} / ${total} question(s) corrigée(s) (${part} %).`,
);
const restant = total - corrigees;
if (restant > 0) {
  console.log(
    couleur.jaune(
      `Reste à rédiger : ${restant} correction(s). Régime d'inventaire sur les périmètres non migrés.`,
    ),
  );
}

/*
 * La garde de clôture, éteinte par un drapeau jusqu'à la fin du contenu.
 *
 * Elle lit les mêmes compteurs que le tableau imprimé ci-dessus, et non un
 * recomptage parallèle : une garde qui compterait de son côté pourrait refuser
 * une banque que le rapport déclare complète, ou l'inverse.
 */
if (contenuEstClos()) {
  const manques = manquesDeCouverture([
    ...[...cours].map(([nom, s]) => [`quiz de cours · ${nom}`, s]),
    ...[...dgfip].map(([nom, s]) => [`QCM — DGFiP · ${nom}`, s]),
  ]);
  for (const m of manques) erreurs.push(m);
  console.log(
    manques.length === 0
      ? couleur.vert('Contenu déclaré clos : la couverture est complète.')
      : couleur.rouge(
          `Contenu déclaré clos : ${manques.length} périmètre(s) incomplet(s).`,
        ),
  );
}

/* --- Couverture de l'étiquetage de temporalité (prompt 20, § qcm.8) ------ */
if (parNature.size) {
  const ordre = [
    'intemporelle',
    'historique',
    'actuelle',
    'passee-non-historique',
    'a-venir',
    'non étiquetée',
  ];
  const totalQ = [...parNature.values()].reduce((n, v) => n + v, 0);
  console.log(`\n${couleur.gras('QCM — COUVERTURE DE LA TEMPORALITÉ')}\n`);
  for (const nature of ordre) {
    const n = parNature.get(nature);
    if (!n) continue;
    const part = Math.round((n / totalQ) * 1000) / 10;
    const ligne = `  ${nature.padEnd(24)}${String(n).padStart(5)}${`${part} %`.padStart(9)}`;
    console.log(nature === 'non étiquetée' ? couleur.jaune(ligne) : ligne);
  }
  const etiquetees = totalQ - (parNature.get('non étiquetée') ?? 0);
  console.log(
    couleur.faible(`  ${'étiquetées'.padEnd(24)}${String(etiquetees).padStart(5)} sur ${totalQ}`),
  );

  /*
   * Les deux échéances passées, en regard de l'étiquetage. Elles ne font pas
   * échouer la construction — l'expirée est déjà retirée du tirage, et
   * « à revérifier » dit « rouvre le dossier », pas « ceci est faux ». Mais
   * elles se comptent, parce qu'une dette qu'on ne mesure pas ne se résorbe
   * pas, et parce que la liste des alertes est tronquée à vingt.
   *
   * Les deux lignes s'affichent même à zéro, contrairement aux natures
   * au-dessus qui se taisent quand elles sont vides. Une nature absente ne dit
   * rien ; une dette à zéro dit que le contrôle a tourné et n'a rien trouvé.
   * Se taire laisserait le lecteur sans moyen de distinguer « aucune échéance
   * passée » de « personne ne regarde les échéances ».
   */
  console.log('');
  for (const [quoi, n] of [
    ['expirées, hors tirage', echeances.expirees],
    ['échéance de revue passée', echeances.aRevoir],
  ]) {
    const ligne = `  ${quoi.padEnd(24)}${String(n).padStart(5)}`;
    console.log(n > 0 ? couleur.jaune(ligne) : couleur.faible(ligne));
  }
}

/*
 * LE VERDICT DES VISUELS, DIT À CHAQUE PASSAGE, DANS LES DEUX RÉGIMES.
 *
 * Sans cette ligne, un build vert ne distinguerait pas « aucun écart » de
 * « des écarts, mais le contenu n'est pas clos ». La liste est donnée EN
 * ENTIER, et non tronquée comme le flot des alertes : il y en a douze sur
 * 555 visuels, et c'est une dette qu'on solde, pas un bruit qu'on surveille.
 */
console.log(
  `\n${couleur.gras('Visuels')} : ${
    ecartsDeVisuel.length === 0
      ? 'aucun écart'
      : `${ecartsDeVisuel.length} écart${ecartsDeVisuel.length > 1 ? 's' : ''}`
  }` +
    ` — régime ${visuelRefuse ? 'de refus (contenu clos)' : 'd’avertissement (contenu non clos)'}.`,
);
if (ecartsDeVisuel.length > 0) {
  if (visuelRefuse) {
    for (const e of ecartsDeVisuel) erreurs.push(e);
  } else {
    for (const e of ecartsDeVisuel) console.log(couleur.jaune(`  ! ${e}`));
    console.log(
      couleur.jaune(
        '  Ces écarts REFUSERONT la construction à la clôture du contenu. Le texte de',
      ),
    );
    console.log(
      couleur.jaune('  remplacement contredit les données du visuel : c’est l’un des deux qui a tort.'),
    );
  }
}

if (alertes.length > 0) {
  console.log(`\n${couleur.jaune(`${alertes.length} question(s) à revérifier :`)}`);
  for (const a of alertes.slice(0, 20)) console.log(couleur.jaune(`  ! ${a}`));
  if (alertes.length > 20) {
    console.log(couleur.faible(`  … et ${alertes.length - 20} autre(s).`));
  }
}

if (erreurs.length > 0) {
  console.log(`\n${couleur.rouge(`${erreurs.length} problème(s) :`)}`);
  for (const e of erreurs.slice(0, 40)) console.log(`  ✗ ${e}`);
  if (erreurs.length > 40) console.log(couleur.faible(`  … et ${erreurs.length - 40} autre(s).`));
  console.log('');
  process.exit(1);
}
console.log(couleur.vert('\nAucun problème de correction.\n'));
