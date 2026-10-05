/**
 * Les neuf fournisseurs de contexte : ce que chaque écran sait dire de soi.
 *
 * Un fournisseur ne décide **ni de la forme du prompt ni de son budget** : il
 * rend des blocs rangés par importance, et `construirePrompt` se charge du
 * reste. Cette séparation a une conséquence pratique : ajouter un emplacement
 * ne demande ni de retoucher le gabarit, ni de refaire la troncature.
 *
 * ## Ce qui n'entre jamais dans un bloc
 *
 * Le mot de passe, la clé dérivée, le sel, les paramètres de dérivation. La
 * garantie n'est pas un filtre de chaînes — qui se contournerait au premier
 * champ ajouté — mais le fait que **ce fichier n'importe rien qui les
 * connaisse** : ni `lib/secret`, ni `lib/crypto`, ni `chargerParametresCle`.
 * L'essai « essais-assistant-reseau.mjs » le vérifie sur la clôture des
 * imports, et c'est ce qui rend la propriété durable.
 */
import {
  lireEntreeJournal,
  toutesLesCompetences,
  toutesLesSeances,
  type EntreeJournal,
} from '../../lib/db';
import { clefs, utilisable } from '../../lib/niveau';
import type { Correction, Fiche, Flashcard, QuestionDgfip, QuestionQuiz, TermeGlossaire } from '../../lib/contenu';
import {
  bloc,
  niveauEnMots,
  texteDuHtml,
  type Bloc,
  type Contexte,
  type OptionsDeContexte,
} from './contexte';

/** Les options, avec les blocs « moi » tous éteints. */
const RIEN: OptionsDeContexte = { monNiveau: false, mesErreurs: false, mesNotes: false };

// --- Les trois blocs « moi », communs à tous les emplacements ---------------

/**
 * Mon niveau sur ce sujet, en mots.
 *
 * Omis quand la note n'est pas fiable : trois observations ne font pas un
 * niveau, et l'annoncer ferait adapter l'explication à un chiffre qui ne
 * mesure rien. Mieux vaut que l'assistant ne sache pas que de croire savoir.
 */
async function blocNiveau(sujet: { matiere?: string; fascicule?: string }): Promise<Bloc[]> {
  if (!sujet.matiere) return [];
  const competences = await toutesLesCompetences();
  const voulues = new Set(
    clefs({ matiere: sujet.matiere, fascicule: sujet.fascicule }).map((c) => c.clef),
  );
  const retenues = competences.filter((c) => voulues.has(c.clef) && utilisable(c));
  if (!retenues.length) return [];
  const phrases = retenues.map((c) => `${c.libelle} : ${niveauEnMots(c.note)}`);
  return bloc(
    'Mon niveau sur ce sujet',
    `${phrases.join('\n')}\n\nAdapte ton explication à ce niveau.`,
    5,
  );
}

/** Ce que le journal d'erreurs sait de cet item précis. */
async function blocErreurs(itemId: string | undefined): Promise<Bloc[]> {
  if (!itemId) return [];
  const entree = await lireEntreeJournal(itemId);
  if (!entree) return [];
  return bloc('Mon historique sur cette question', phraseDuJournal(entree), 5);
}

export function phraseDuJournal(e: EntreeJournal): string {
  const rechutes =
    e.erreurs > 1 ? `Je l’ai ratée ${e.erreurs} fois` : 'Je l’ai ratée une fois';
  const depuis = `, la première le ${e.ouverteLe} et la dernière le ${e.derniereErreurLe}`;
  const acquis =
    e.reussites > 0
      ? ` Depuis, je l’ai réussie ${e.reussites} fois ; il m’en faut deux pour sortir du journal.`
      : ' Je ne l’ai pas encore réussie depuis.';
  return `${rechutes}${depuis}.${acquis}`;
}

/**
 * Mes notes de séance portant sur cette fiche.
 *
 * Remontée par identifiant de fiche : une séance enregistre les fiches qu'elle
 * a réellement couvertes, et c'est ce lien qui permet de retrouver ce que j'en
 * avais écrit. Depuis l'écran d'une séance, le fournisseur dédié fait mieux —
 * il a la note sous la main.
 */
async function blocNotes(ficheId: string | undefined): Promise<Bloc[]> {
  if (!ficheId) return [];
  const seances = (await toutesLesSeances()).filter(
    (s) => s.note.trim() && s.fiches?.includes(ficheId),
  );
  if (!seances.length) return [];
  const texte = seances
    .slice(-2)
    .map((s) => `Séance du ${s.jour} :\n${s.note.trim()}`)
    .join('\n\n');
  return bloc('Mes notes de séance sur cette fiche', texte, 5);
}

async function blocsMoi(
  options: OptionsDeContexte,
  sujet: { matiere?: string; fascicule?: string; ficheId?: string; itemId?: string },
): Promise<Bloc[]> {
  const blocs: Bloc[] = [];
  if (options.monNiveau) blocs.push(...(await blocNiveau(sujet)));
  if (options.mesErreurs) blocs.push(...(await blocErreurs(sujet.itemId)));
  if (options.mesNotes) blocs.push(...(await blocNotes(sujet.ficheId)));
  return blocs;
}

// --- Ce qui se répète d'un QCM à l'autre ------------------------------------

function blocQuestion(question: string, options: readonly string[], bonnes: readonly number[]): Bloc[] {
  const liste = options
    .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}${bonnes.includes(i) ? '  ← bonne réponse' : ''}`)
    .join('\n');
  return bloc('La question', `${question}\n\n${liste}`, 1);
}

function blocMaReponse(options: readonly string[], bonnes: readonly number[], choisies: readonly number[]): Bloc[] {
  if (!choisies.length) return bloc('Ma réponse', 'Je n’ai pas répondu.', 1);
  const miennes = choisies.map((i) => options[i]).join(' · ');
  const juste = choisies.length === bonnes.length && bonnes.every((i) => choisies.includes(i));
  return bloc(
    'Ma réponse',
    juste ? `J’ai répondu « ${miennes} », et c’était juste.` : `J’ai répondu « ${miennes} », et c’était faux.`,
    1,
  );
}

/**
 * La correction rédigée du site, telle quelle.
 *
 * Avec son indicateur de confiance : c'est ce qui dit à l'assistant **où** il
 * est permis de douter. Une correction « moyenne » a été établie sans corrigé
 * officiel, et le taire reviendrait à la présenter avec l'assurance des autres.
 */
function blocCorrection(correction: Correction | undefined, explication: string | undefined): Bloc[] {
  if (!correction) return bloc('La correction du site', explication, 2);
  const lignes = [correction.resume, '', correction.detail];
  if (correction.par_option.length) {
    lignes.push('', 'Option par option :');
    for (const o of correction.par_option) {
      lignes.push(`- ${o.verdict === 'juste' ? 'juste' : 'faux'} : ${o.pourquoi}`);
    }
  }
  if (correction.sources.length) {
    lignes.push('', `Sources invoquées : ${correction.sources.map((s) => s.nom).join(' ; ')}.`);
  }
  lignes.push(
    '',
    correction.confiance === 'moyenne'
      ? 'Confiance moyenne : cette correction a été établie sans corrigé officiel.'
      : 'Confiance haute.',
  );
  return bloc('La correction du site', lignes.join('\n'), 2);
}

/**
 * Un extrait du cours, pris autour du titre le plus proche.
 *
 * On ne colle pas la fiche entière : elle dépasse souvent le budget à elle
 * seule, et la troncature couperait alors ce qui compte. Le passage retenu est
 * le début du cours, qui porte la définition — c'est ce qu'on veut quand on
 * vient de rater une question dessus.
 */
function blocCours(fiche: Fiche | null | undefined, caracteres = 2500): Bloc[] {
  if (!fiche) return [];
  const texte = texteDuHtml(fiche.coursHtml || fiche.ficheHtml);
  return bloc('Extrait du cours', texte.slice(0, caracteres), 3);
}

// --- Les neuf fournisseurs --------------------------------------------------

export interface SujetQuiz {
  question: QuestionQuiz;
  choisies: readonly number[];
  fiche?: Fiche | null;
  matiere?: string;
  fascicule?: string;
  ficheTitre?: string;
}

export async function contexteQuizCours(
  sujet: SujetQuiz,
  options: OptionsDeContexte = RIEN,
): Promise<Contexte> {
  const { question, choisies, fiche } = sujet;
  return {
    provenance: 'quiz-cours',
    sujet: question.question,
    situation: [
      sujet.matiere ?? fiche?.matiere,
      sujet.fascicule ?? fiche?.fascicule,
      sujet.ficheTitre ?? fiche?.titre,
    ].filter((x): x is string => Boolean(x)),
    blocs: [
      ...blocQuestion(question.question, question.options, question.bonnes),
      ...blocMaReponse(question.options, question.bonnes, choisies),
      ...blocCorrection(question.correction, question.explication),
      ...blocCours(fiche),
      ...(await blocsMoi(options, {
        matiere: sujet.matiere ?? fiche?.matiere,
        fascicule: sujet.fascicule ?? fiche?.fascicule,
        ficheId: fiche?.id,
        itemId: question.id,
      })),
    ],
  };
}

export interface SujetDgfip {
  question: QuestionDgfip;
  choisies: readonly number[];
}

export async function contexteDgfip(
  sujet: SujetDgfip,
  options: OptionsDeContexte = RIEN,
): Promise<Contexte> {
  const { question, choisies } = sujet;
  const provenance = [
    question.source ? `Provenance : ${question.source}.` : null,
    question.categorie ? `Catégorie ${question.categorie} du concours.` : null,
    question.incertain ? `Réserve du site : ${question.incertain}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    provenance: 'qcm-dgfip',
    // Pas de fiche de cours ici, et ce n'est pas un manque : Français, Logique
    // et Maths ne correspondent à aucune fiche du programme de l'INSP.
    situation: ['QCM DGFiP', question.rubrique],
    sujet: question.question,
    blocs: [
      ...blocQuestion(question.question, question.options, question.bonnes),
      ...blocMaReponse(question.options, question.bonnes, choisies),
      ...blocCorrection(question.correction, question.explication),
      ...bloc('D’où vient cette question', provenance, 4),
      ...(await blocsMoi(options, { itemId: question.id })),
    ],
  };
}

export interface SujetSeance {
  seance: { jour: string; theme: string; note: string; restitutions?: Record<string, string> };
  /** Le rappel en cours, quand la demande part d'une question de rappel. */
  rappel?: SujetQuiz;
}

export async function contexteSeance(
  sujet: SujetSeance,
  options: OptionsDeContexte = RIEN,
): Promise<Contexte> {
  const { seance, rappel } = sujet;
  const interne = rappel ? await contexteQuizCours(rappel, options) : null;
  const restitutions = Object.values(seance.restitutions ?? {})
    .filter((r) => r.trim())
    .join('\n\n');
  return {
    provenance: 'seance',
    sujet: rappel?.question.question ?? `Séance du ${seance.jour}`,
    situation: [`Séance du ${seance.jour}`, seance.theme, ...(interne?.situation ?? [])],
    blocs: [
      ...(interne?.blocs ?? []),
      // La note de séance est la restitution d'une à deux pages écrite de ma
      // main : c'est le contexte le plus personnel du site, et le seul qui
      // dise ce que j'ai cru comprendre, plutôt que ce que le cours dit.
      ...bloc('Ma note de séance', seance.note, 4),
      ...bloc('Mes restitutions à blanc', restitutions, 5),
    ],
  };
}

export interface SujetJournal {
  entree: EntreeJournal;
  /** Le contexte de la provenance, déjà construit par le fournisseur idoine. */
  interne: Contexte;
}

export async function contexteJournal(sujet: SujetJournal): Promise<Contexte> {
  const { entree, interne } = sujet;
  return {
    ...interne,
    provenance: 'journal',
    situation: ['Journal d’erreurs', ...interne.situation],
    blocs: [
      ...interne.blocs,
      ...bloc('Pourquoi cette question est au journal', phraseDuJournal(entree), 2),
    ],
  };
}

export interface SujetFlashcard {
  carte: Flashcard;
  fiche?: Fiche | null;
  /** Oublis comptés par FSRS sur cette carte. */
  oublis?: number;
}

export async function contexteFlashcard(
  sujet: SujetFlashcard,
  options: OptionsDeContexte = RIEN,
): Promise<Contexte> {
  const { carte, fiche, oublis } = sujet;
  return {
    provenance: 'flashcard',
    sujet: carte.question,
    situation: [fiche?.matiere, fiche?.fascicule, fiche?.titre].filter((x): x is string => Boolean(x)),
    blocs: [
      ...bloc('La carte', `Recto : ${carte.question}\nVerso : ${carte.reponse}`, 1),
      ...bloc(
        'Combien de fois je l’ai oubliée',
        oublis ? `Je l’ai oubliée ${oublis} fois depuis que je la révise.` : null,
        4,
      ),
      ...blocCours(fiche, 1800),
      ...(await blocsMoi(options, {
        matiere: fiche?.matiere,
        fascicule: fiche?.fascicule,
        ficheId: fiche?.id,
        itemId: carte.id,
      })),
    ],
  };
}

export interface SujetFiche {
  fiche: Fiche;
  /** Le passage sélectionné, ou la section ouverte. */
  passage?: string;
  section?: { titre: string; rang: number; total: number };
  /** Les termes du glossaire présents dans le passage. */
  definitions?: TermeGlossaire[];
  /** Les titres des fiches voisines du même fascicule. */
  voisines?: string[];
}

export async function contexteFiche(
  sujet: SujetFiche,
  options: OptionsDeContexte = RIEN,
): Promise<Contexte> {
  const { fiche, passage, section, definitions, voisines } = sujet;
  const defs = (definitions ?? []).map((d) => `- ${d.terme} : ${d.definition}`).join('\n');
  return {
    provenance: 'fiche',
    sujet: passage?.slice(0, 120) ?? section?.titre ?? fiche.titre,
    situation: [
      fiche.matiere,
      fiche.fascicule,
      fiche.titre,
      section ? `${section.titre} (section ${section.rang} sur ${section.total})` : null,
    ].filter((x): x is string => Boolean(x)),
    blocs: [
      // Le passage sélectionné prime sur le cours entier : c'est lui qu'on
      // montre du doigt, et le reste n'est là que pour l'éclairer.
      ...bloc('Le passage', passage, 1),
      ...(passage ? [] : blocCours(fiche)),
      ...(passage ? blocCours(fiche, 1500) : []),
      ...bloc('Définitions du glossaire', defs, 4),
      ...bloc(
        'Les fiches voisines du fascicule',
        voisines?.length ? voisines.map((v) => `- ${v}`).join('\n') : null,
        5,
      ),
      ...(await blocsMoi(options, {
        matiere: fiche.matiere,
        fascicule: fiche.fascicule,
        ficheId: fiche.id,
      })),
    ],
  };
}

export interface SujetCog {
  exercice: string;
  /** Le nom du moteur ou de la tâche, et ce qu'il demande. */
  moteur?: { nom: string; resume: string; famille?: string };
  enonce: string;
  consigne: string;
  maReponse: string;
  bonneReponse: string;
  /** La trace du solveur, étape par étape, déjà en français. */
  trace?: string;
  reglages?: string;
}

export async function contexteCogTraining(sujet: SujetCog): Promise<Contexte> {
  return {
    provenance: 'cog-training',
    sujet: sujet.consigne,
    situation: ['Cog-Training', sujet.exercice, sujet.moteur?.nom].filter(
      (x): x is string => Boolean(x),
    ),
    blocs: [
      ...bloc('L’exercice', sujet.enonce ? `${sujet.consigne}\n\n${sujet.enonce}` : sujet.consigne, 1),
      ...bloc(
        'Ma réponse',
        `J’ai répondu : ${sujet.maReponse}\nLa bonne réponse était : ${sujet.bonneReponse}`,
        1,
      ),
      ...bloc('Le raisonnement attendu', sujet.trace, 2),
      ...bloc(
        'Ce que cet exercice entraîne',
        sujet.moteur ? `${sujet.moteur.nom} — ${sujet.moteur.resume}` : null,
        3,
      ),
      ...bloc('Mes réglages de session', sujet.reglages, 5),
    ],
  };
}

export interface SujetActualite {
  titre: string;
  resume: string;
  date: string;
  domaine: string;
  sources: { nom: string; url?: string }[];
  lienCours?: string;
  motsCles?: string[];
}

export async function contexteActualite(sujet: SujetActualite): Promise<Contexte> {
  return {
    provenance: 'actualite',
    sujet: sujet.titre,
    situation: ['Actualités', sujet.domaine, sujet.date],
    blocs: [
      ...bloc('L’actualité', `${sujet.titre}\n\n${sujet.resume}`, 1),
      ...bloc('Son lien avec le cours', sujet.lienCours, 2),
      ...bloc(
        'Sources',
        sujet.sources.map((s) => `- ${s.nom}${s.url ? ` (${s.url})` : ''}`).join('\n'),
        3,
      ),
      ...bloc('Mots-clefs', sujet.motsCles?.join(', ') ?? null, 5),
    ],
  };
}

export interface SujetGlossaire {
  terme: TermeGlossaire;
  /** La phrase où le mot apparaissait, prise dans le DOM. */
  phrase?: string;
  situation?: string[];
}

export async function contexteGlossaire(sujet: SujetGlossaire): Promise<Contexte> {
  return {
    provenance: 'glossaire',
    sujet: sujet.terme.terme,
    situation: sujet.situation ?? ['Glossaire'],
    blocs: [
      ...bloc('Le terme', `${sujet.terme.terme} : ${sujet.terme.definition}`, 1),
      ...bloc('La phrase où je l’ai rencontré', sujet.phrase, 2),
    ],
  };
}
