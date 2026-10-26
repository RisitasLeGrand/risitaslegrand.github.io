/**
 * Le validateur d'une analyse importée : enveloppe tolérante, contenu strict.
 *
 * ## Pourquoi il est écrit à la main
 *
 * Une bibliothèque de validation JSON Schema générique pèserait plus que ce
 * qu'elle apporte pour un schéma fermé de cette taille, et surtout : les
 * messages d'erreur en français avec le chemin exact —
 * « constats[2].preuves[0].indicateur : identifiant inconnu » — sont
 * précisément ce qu'une bibliothèque rend mal. Or ces messages **sont** la
 * fonctionnalité : ils nourrissent le prompt de réparation, qui est la seule
 * façon de faire corriger une IA sans l'appeler.
 *
 * Il lit la même déclaration que le schéma servi à l'IA
 * (`noyau/schema-analyse.ts`). Un validateur écrit à côté du schéma divergerait
 * du fichier au premier champ ajouté, et l'import refuserait une réponse
 * pourtant conforme à ce qu'on avait demandé.
 *
 * ## Enveloppe tolérante, contenu strict
 *
 * Une IA entoure volontiers son JSON d'un bloc de code, d'un « Voici
 * l'analyse : » ou d'une virgule finale. Refuser pour cela serait refuser une
 * réponse juste pour une raison de forme — et obliger la personne à nettoyer à
 * la main ce qu'un programme sait retirer. **Le contenu, lui, ne se négocie
 * pas** : un champ inconnu, une énumération non respectée, un plafond dépassé
 * sont refusés, et rien n'est importé partiellement.
 *
 * ## Les références croisées, qui sont la moitié du travail
 *
 * Le schéma dit la forme ; il ne dit pas qu'un `lie_aux_constats` doit pointer
 * sur un constat qui existe, qu'un identifiant d'indicateur doit être au
 * catalogue, que les identifiants doivent être uniques et que les dates doivent
 * tomber dans la période. Ces quatre contrôles sont ceux qui attrapent une IA
 * qui a inventé — et c'est pour eux que la validation est faite.
 */
import { accorde, pluriel } from './accords';
import {
  FORMAT_ANALYSE,
  PLAFONDS,
  SCHEMA_ANALYSE,
  VERSION_ANALYSE,
  MOTIF_DATE,
  MOTIF_EMPREINTE,
  MOTIF_IDENTIFIANT,
  MOTIF_INDICATEUR,
  type Champ,
  type Forme,
} from './schema-analyse';

/* ══════════════════════════════════════════════════════════════════════════
   L'enveloppe
   ══════════════════════════════════════════════════════════════════════════ */

export interface Deballage {
  /** Le texte qu'on va tenter de lire comme du JSON. */
  json: string;
  /** Ce qui a été retiré, en français, pour que l'écran puisse le dire. */
  retire: string[];
}

/**
 * Retire l'enveloppe, et dit ce qu'elle était.
 *
 * L'ordre des retraits compte : le bloc de code d'abord, parce qu'il peut
 * contenir des accolades qui égareraient la recherche du premier objet ; la
 * prose ensuite ; la virgule finale en dernier, quand la forme est déjà
 * dégagée.
 */
/**
 * Ce qui entoure l'objet est-il une phrase, ou juste de la ponctuation ?
 *
 * La distinction compte pour le **message** : une virgule qui traîne après
 * l'accolade finale n'est pas « une phrase de conclusion », et le dire ferait
 * chercher à la personne une phrase qu'elle n'a pas écrite.
 */
const estPonctuation = (texte: string): boolean => /^[,;.\s]*$/.test(texte);

export function deballer(texte: string): Deballage {
  const retire: string[] = [];
  let travail = texte.trim();

  if (!travail) return { json: '', retire };

  /*
   * Un bloc de code, avec ou sans langage annoncé. La prose **autour** du bloc
   * est retirée avec lui, et il faut le dire : l'écran annonce ce qu'il a
   * enlevé, et taire un retrait ferait croire que le texte collé était propre.
   */
  const bloc = /```(?:json|jsonc|javascript)?\s*\n?([\s\S]*?)\n?```/i.exec(travail);
  if (bloc) {
    const avant = travail.slice(0, bloc.index).trim();
    const apres = travail.slice(bloc.index + bloc[0].length).trim();
    travail = bloc[1].trim();
    retire.push('un bloc de code');
    if (avant && !estPonctuation(avant)) retire.push('une phrase d’introduction');
    if (apres && !estPonctuation(apres)) retire.push('une phrase de conclusion');
  }

  /*
   * Une phrase avant ou après l'objet. On cherche la première accolade et la
   * dernière, plutôt que de deviner la phrase : une introduction peut contenir
   * n'importe quoi, et l'objet JSON, lui, a des bornes nettes.
   */
  const premiere = travail.indexOf('{');
  const derniere = travail.lastIndexOf('}');
  let ponctuationFinale = '';
  if (premiere > 0 || (derniere >= 0 && derniere < travail.length - 1)) {
    if (premiere >= 0 && derniere > premiere) {
      const avant = travail.slice(0, premiere).trim();
      const apres = travail.slice(derniere + 1).trim();
      travail = travail.slice(premiere, derniere + 1);
      if (avant && !estPonctuation(avant)) retire.push('une phrase d’introduction');
      if (apres && !estPonctuation(apres)) retire.push('une phrase de conclusion');
      if (apres && estPonctuation(apres)) ponctuationFinale = apres;
    }
  }

  /*
   * Les virgules finales, que JSON refuse et que les modèles écrivent — à
   * l'intérieur de l'objet, et après l'accolade de fermeture. Les deux sont la
   * même faute vue d'une personne, et elles tiennent donc une seule ligne dans
   * le message.
   */
  const sansVirgules = travail.replace(/,(\s*[}\]])/g, '$1');
  if (sansVirgules !== travail || ponctuationFinale.includes(',')) {
    travail = sansVirgules;
    retire.push('une ou plusieurs virgules finales');
  }

  return { json: travail, retire };
}

/* ══════════════════════════════════════════════════════════════════════════
   Les erreurs
   ══════════════════════════════════════════════════════════════════════════ */

export interface Erreur {
  /** Le chemin exact : `constats[2].preuves[0].indicateur`. */
  chemin: string;
  /** La raison, en français, sans jargon de schéma. */
  raison: string;
}

/** La forme qu'un écran affiche : « chemin : raison ». */
export const direErreur = (e: Erreur): string => `${e.chemin} : ${e.raison}`;

export interface Verdict {
  recevable: boolean;
  erreurs: Erreur[];
  /** L'analyse lue, seulement si elle est recevable. */
  analyse?: Record<string, unknown>;
  /** Ce que l'enveloppe portait. */
  retire: string[];
}

/* ══════════════════════════════════════════════════════════════════════════
   La forme
   ══════════════════════════════════════════════════════════════════════════ */

export interface Contexte {
  /** Les identifiants d'indicateurs du catalogue. */
  indicateurs: readonly string[];
  /** La période de l'export, pour borner les dates. */
  periode?: { debut: string; fin: string };
  /** L'identifiant et l'empreinte de l'export, quand on les connaît. */
  exportId?: string;
  empreinte?: string;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function controlerForme(
  valeur: unknown,
  forme: Forme,
  chemin: string,
  contexte: Contexte,
): Erreur[] {
  const e = (raison: string): Erreur[] => [{ chemin, raison }];

  switch (forme.quoi) {
    case 'texte': {
      if (typeof valeur !== 'string') return e('un texte est attendu.');
      if (valeur.length > forme.max) {
        return e(`texte trop long : ${valeur.length} signes pour ${forme.max} au plus.`);
      }
      if (forme.min && valeur.trim().length < forme.min) {
        return e(`texte trop court : ${forme.min} signes au moins sont attendus.`);
      }
      /*
       * Le balisage est refusé ici, et pas seulement à l'affichage. Le prompt
       * le demande en texte brut, et un refus à la source évite d'avoir à se
       * demander, à chaque rendu, si tel champ a été nettoyé.
       */
      if (/<\/?[a-z][^>]*>/i.test(valeur)) {
        return e('le texte doit être du texte brut : ni HTML, ni balisage.');
      }
      /*
       * Les caractères de contrôle et les **inversions bidirectionnelles**.
       * U+202E retourne l'affichage d'une ligne sans changer ce qu'elle
       * contient : un énoncé peut alors se lire à l'écran autrement qu'il
       * n'est écrit, et c'est exactement le genre de piège qu'un rendu en
       * texte échappé n'arrête pas — l'échappement protège le HTML, pas la
       * lecture.
       */
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(valeur)) {
        return e('le texte contient des caractères de contrôle, qui ne s’affichent pas.');
      }
      if (/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/.test(valeur)) {
        return e(
          'le texte contient une marque de sens d’écriture, qui ferait lire autre chose que ce qui est écrit.',
        );
      }
      return [];
    }
    case 'entier':
      if (typeof valeur !== 'number' || !Number.isInteger(valeur)) {
        return e('un nombre entier est attendu.');
      }
      if (valeur < forme.min || valeur > forme.max) {
        return e(`valeur hors bornes : de ${forme.min} à ${forme.max} sont admis.`);
      }
      return [];
    case 'nombre':
      return typeof valeur === 'number' && Number.isFinite(valeur)
        ? []
        : e('un nombre est attendu.');
    case 'booleen':
      return typeof valeur === 'boolean' ? [] : e('« true » ou « false » est attendu.');
    case 'date':
      if (typeof valeur !== 'string' || !new RegExp(MOTIF_DATE).test(valeur)) {
        return e('une date au format AAAA-MM-JJ est attendue.');
      }
      if (!Number.isFinite(Date.parse(`${valeur}T00:00:00Z`))) {
        return e(`cette date n’existe pas : « ${valeur} ».`);
      }
      return [];
    case 'horodatage':
      return typeof valeur === 'string' && Number.isFinite(Date.parse(valeur))
        ? []
        : e('un horodatage ISO 8601 est attendu, fuseau compris.');
    case 'empreinte':
      return typeof valeur === 'string' && new RegExp(MOTIF_EMPREINTE).test(valeur)
        ? []
        : e('une empreinte de la forme « sha256:… » est attendue, reprise du manifeste.');
    case 'enumeration':
      if (typeof valeur !== 'string' || !forme.valeurs.includes(valeur)) {
        return e(
          `valeur hors de la liste admise. Admises : ${forme.valeurs.join(', ')}.`,
        );
      }
      return [];
    case 'litteral':
      return valeur === forme.valeur
        ? []
        : e(`doit valoir exactement ${JSON.stringify(forme.valeur)}.`);
    case 'identifiant':
      return typeof valeur === 'string' && new RegExp(MOTIF_IDENTIFIANT).test(valeur)
        ? []
        : e('identifiant mal formé : minuscules, chiffres et tirets, 32 signes au plus.');
    case 'indicateur': {
      if (typeof valeur !== 'string' || !new RegExp(MOTIF_INDICATEUR).test(valeur)) {
        return e('identifiant d’indicateur mal formé ; il s’écrit « domaine.nom ».');
      }
      if (!contexte.indicateurs.includes(valeur)) {
        return e(
          `identifiant inconnu : « ${valeur} » n’est pas au catalogue fourni dans indicateurs.json.`,
        );
      }
      return [];
    }
    case 'liste': {
      if (!Array.isArray(valeur)) return e('une liste est attendue.');
      if (valeur.length > forme.max) {
        return e(
          `liste trop longue : ${pluriel(valeur.length, 'entrée')} pour ${forme.max} au plus.`,
        );
      }
      if (forme.min && valeur.length < forme.min) {
        return e(
          `liste trop courte : ${pluriel(forme.min, 'entrée')} au moins ` +
            `${accorde(forme.min, 'est', 'sont')} ${accorde(forme.min, 'attendue')}.`,
        );
      }
      return valeur.flatMap((x, i) => controlerForme(x, forme.de, `${chemin}[${i}]`, contexte));
    }
    case 'objet':
      return controlerObjet(valeur, forme.champs, chemin, contexte);
  }
}

function controlerObjet(
  valeur: unknown,
  champs: Record<string, Champ>,
  chemin: string,
  contexte: Contexte,
): Erreur[] {
  if (!estObjet(valeur)) return [{ chemin, raison: 'un objet est attendu.' }];
  const erreurs: Erreur[] = [];

  /*
   * Les champs inconnus d'abord : c'est l'erreur la plus instructive pour une
   * IA, et celle qui tient les garde-fous. La signaler en tête fait qu'elle
   * survit à une troncature du prompt de réparation.
   */
  for (const nom of Object.keys(valeur)) {
    if (!(nom in champs)) {
      erreurs.push({
        chemin: chemin ? `${chemin}.${nom}` : nom,
        raison: `champ inconnu. Admis ici : ${Object.keys(champs).join(', ')}.`,
      });
    }
  }

  for (const [nom, champ] of Object.entries(champs)) {
    const sous = chemin ? `${chemin}.${nom}` : nom;
    const lu = valeur[nom];
    if (lu === undefined || lu === null) {
      if (champ.requis) erreurs.push({ chemin: sous, raison: `champ attendu. ${champ.libelle}` });
      continue;
    }
    erreurs.push(...controlerForme(lu, champ.forme, sous, contexte));
  }
  return erreurs;
}

/* ══════════════════════════════════════════════════════════════════════════
   Les références croisées
   ══════════════════════════════════════════════════════════════════════════ */

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function controlerReferences(analyse: Record<string, unknown>, contexte: Contexte): Erreur[] {
  const erreurs: Erreur[] = [];

  const constats = Array.isArray(analyse.constats) ? analyse.constats : [];
  const propositions = Array.isArray(analyse.propositions) ? analyse.propositions : [];
  const questions = Array.isArray(analyse.questions_a_clarifier)
    ? analyse.questions_a_clarifier
    : [];

  /* Les identifiants, uniques **par liste** et jamais réutilisés entre listes. */
  const vus = new Map<string, string>();
  const nommer = (liste: unknown[], nomListe: string) => {
    liste.forEach((entree, i) => {
      if (!estObjet(entree) || typeof entree.id !== 'string') return;
      const ou = `${nomListe}[${i}].id`;
      const deja = vus.get(entree.id);
      if (deja) {
        erreurs.push({
          chemin: ou,
          raison: `identifiant « ${entree.id} » déjà employé en ${deja}. Les identifiants sont uniques dans toute l’analyse.`,
        });
        return;
      }
      vus.set(entree.id, ou);
    });
  };
  nommer(constats, 'constats');
  nommer(propositions, 'propositions');
  nommer(questions, 'questions_a_clarifier');

  const idsDeConstat = new Set(
    constats.filter(estObjet).map((c) => (typeof c.id === 'string' ? c.id : '')),
  );

  /* Chaque proposition pointe sur des constats qui existent. */
  propositions.forEach((proposition, i) => {
    if (!estObjet(proposition)) return;
    const liens = Array.isArray(proposition.lie_aux_constats) ? proposition.lie_aux_constats : [];
    liens.forEach((lien, j) => {
      if (typeof lien !== 'string') return;
      if (!idsDeConstat.has(lien)) {
        erreurs.push({
          chemin: `propositions[${i}].lie_aux_constats[${j}]`,
          raison: `aucun constat ne porte l’identifiant « ${lien} ».`,
        });
      }
    });
  });

  /* Les dates tombent dans la période, et le début précède la fin. */
  const dansLaPeriode = (chemin: string, debut: unknown, fin: unknown) => {
    if (typeof debut !== 'string' || typeof fin !== 'string') return;
    if (!JOUR.test(debut) || !JOUR.test(fin)) return;
    if (debut > fin) {
      erreurs.push({ chemin, raison: `le début (${debut}) est postérieur à la fin (${fin}).` });
      return;
    }
    if (!contexte.periode) return;
    if (debut < contexte.periode.debut || fin > contexte.periode.fin) {
      erreurs.push({
        chemin,
        raison:
          `hors de la période analysée (${contexte.periode.debut} → ${contexte.periode.fin}). ` +
          'Une preuve doit porter sur la période de l’export.',
      });
    }
  };

  if (estObjet(analyse.periode)) {
    const p = analyse.periode;
    if (contexte.periode) {
      if (p.debut !== contexte.periode.debut || p.fin !== contexte.periode.fin) {
        erreurs.push({
          chemin: 'periode',
          raison:
            `doit reprendre la période du manifeste : ${contexte.periode.debut} → ${contexte.periode.fin}.`,
        });
      }
    } else {
      dansLaPeriode('periode', p.debut, p.fin);
    }
  }

  constats.forEach((constat, i) => {
    if (!estObjet(constat)) return;
    const preuves = Array.isArray(constat.preuves) ? constat.preuves : [];
    preuves.forEach((preuve, j) => {
      if (!estObjet(preuve) || !estObjet(preuve.periode)) return;
      dansLaPeriode(
        `constats[${i}].preuves[${j}].periode`,
        preuve.periode.debut,
        preuve.periode.fin,
      );
    });
  });

  /* L'export cité est bien celui qu'on a produit, quand on le sait. */
  if (contexte.exportId && analyse.export_id !== contexte.exportId) {
    erreurs.push({
      chemin: 'export_id',
      raison: `doit reprendre l’identifiant du manifeste : « ${contexte.exportId} ».`,
    });
  }
  if (contexte.empreinte && analyse.export_empreinte !== contexte.empreinte) {
    erreurs.push({
      chemin: 'export_empreinte',
      raison: 'doit reprendre l’empreinte du manifeste, sans la modifier.',
    });
  }

  return erreurs;
}

/* ══════════════════════════════════════════════════════════════════════════
   Valider
   ══════════════════════════════════════════════════════════════════════════ */

/** Combien d'erreurs sont rendues au plus. Au-delà, la liste est illisible. */
export const ERREURS_AFFICHEES = 40;

/**
 * Valide un texte : déballage, lecture, forme, références.
 *
 * **Rien n'est importé partiellement.** La fonction rend soit une analyse
 * entière, soit une liste d'erreurs : un import à moitié fait laisserait des
 * constats sans leurs propositions, et personne ne saurait lesquels.
 */
export function validerTexte(texte: string, contexte: Contexte): Verdict {
  const { json, retire } = deballer(texte);
  if (!json) {
    return {
      recevable: false,
      retire,
      erreurs: [{ chemin: 'analyse', raison: 'le texte est vide.' }],
    };
  }
  if (new TextEncoder().encode(texte).length > PLAFONDS.octets) {
    return {
      recevable: false,
      retire,
      erreurs: [
        {
          chemin: 'analyse',
          raison: `document trop gros : ${PLAFONDS.octets} octets au plus sont acceptés.`,
        },
      ],
    };
  }

  let lu: unknown;
  try {
    lu = JSON.parse(json);
  } catch (erreur) {
    return {
      recevable: false,
      retire,
      erreurs: [
        {
          chemin: 'analyse',
          raison: `ce n’est pas du JSON valide : ${(erreur as Error).message}`,
        },
      ],
    };
  }

  const erreurs = controlerObjet(lu, SCHEMA_ANALYSE, '', contexte);
  /*
   * Les références ne sont contrôlées que si la forme tient : chercher un
   * `lie_aux_constats` dans un objet dont `constats` n'est pas une liste
   * produirait des messages qui parlent d'un problème différent du vrai.
   */
  if (!erreurs.length && estObjet(lu)) erreurs.push(...controlerReferences(lu, contexte));

  if (erreurs.length) {
    return { recevable: false, retire, erreurs: erreurs.slice(0, ERREURS_AFFICHEES) };
  }
  return { recevable: true, retire, erreurs: [], analyse: lu as Record<string, unknown> };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le prompt de réparation
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le texte à copier pour faire corriger l'IA. Engendré localement.
 *
 * Il ne redonne pas le schéma entier — il pèserait dix kilo-octets et noierait
 * les trois lignes qui comptent. Il donne les erreurs **avec leur chemin**, le
 * rappel des règles qui ont été enfreintes, et rien d'autre. Aucun appel à un
 * modèle n'est fait : c'est la personne qui colle ce texte où elle veut.
 */
export function promptDeReparation(erreurs: readonly Erreur[]): string {
  const rappels = new Set<string>();
  for (const e of erreurs) {
    if (e.raison.includes('champ inconnu')) {
      rappels.add(
        'Aucun champ hors du schéma n’est admis : retirez ceux que le schéma ne déclare pas.',
      );
    }
    if (e.raison.includes('hors de la liste admise')) {
      rappels.add('Les énumérations sont fermées : employez exactement l’une des valeurs listées.');
    }
    if (e.raison.includes('identifiant inconnu')) {
      rappels.add(
        'Chaque preuve cite un identifiant d’indicateur pris dans indicateurs.json, sans l’inventer.',
      );
    }
    if (e.raison.includes('aucun constat ne porte')) {
      rappels.add('Chaque proposition se rattache à un constat que l’analyse contient.');
    }
    if (e.raison.includes('hors de la période')) {
      rappels.add('Les périodes des preuves tombent dans la période de l’export.');
    }
    if (e.raison.includes('trop longue') || e.raison.includes('trop long')) {
      rappels.add(
        `Les plafonds sont fermes : ${PLAFONDS.constats} constats, ${PLAFONDS.propositions} propositions, ${PLAFONDS.questions} questions.`,
      );
    }
    if (e.raison.includes('texte brut')) {
      rappels.add('Les textes sont en texte brut : ni HTML, ni balisage.');
    }
    if (e.raison.includes('caractères de contrôle') || e.raison.includes('sens d’écriture')) {
      rappels.add(
        'Les textes ne portent que des caractères imprimables : ni caractère de contrôle, ni marque de sens d’écriture.',
      );
    }
    if (e.raison.includes('JSON valide')) {
      rappels.add(
        'Répondez par un seul objet JSON, sans bloc de code, sans phrase autour et sans virgule finale.',
      );
    }
  }

  return [
    'Votre réponse précédente a été refusée à l’import. Voici les erreurs, avec leur emplacement',
    `exact dans le document. Corrigez-les et renvoyez **l’objet JSON entier** au format`,
    `« ${FORMAT_ANALYSE} » version ${VERSION_ANALYSE}, sans texte autour.`,
    '',
    ...erreurs.map((e) => `- \`${e.chemin}\` : ${e.raison}`),
    '',
    ...(rappels.size ? ['Rappels :', ...[...rappels].map((r) => `- ${r}`), ''] : []),
    'Ne renvoyez pas seulement les parties corrigées : l’import est entier ou nul.',
  ].join('\n');
}
