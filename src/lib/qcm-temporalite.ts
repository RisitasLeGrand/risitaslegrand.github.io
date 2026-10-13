/**
 * La temporalité du QCM : qui est périmé, et qui tire quoi.
 *
 * Module à part, et sans dépendance : « qcm.ts » importe « ./ui », qui lit
 * « import.meta.env » et n'existe donc que dans un navigateur. Ces
 * règles-ci sont pures, et doivent pouvoir être éprouvées en Node — en
 * avançant l'horloge, parce qu'un essai qui attendrait 2027 pour vérifier le
 * comportement de 2027 ne prouverait rien avant 2027.
 */
import type { BanqueDgfip, QuestionDgfip } from './contenu';

/**
 * Le jour, au format AAAA-MM-JJ.
 *
 * Volontairement **l'heure murale locale** et non le jour logique à 4 h : il
 * s'agit de savoir si une date d'échéance est passée, pas de rattacher une
 * activité à une journée de révision. Une question qui expire le 30 juin
 * expire dans la nuit du 30 au 1ᵉʳ, pas à 4 h du matin.
 */
function jourISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Une question expirée est-elle servie ? Non, et la vérification est **ici**,
 * pas seulement à la construction.
 *
 * Le site est statique. Entre deux `npm run deploy`, il peut se passer des
 * mois : le contrôle de construction, si bon soit-il, ne s'exécute pas
 * pendant ce temps. Une question « à venir » dont l'échéance tombe un mardi
 * continuerait d'être posée jusqu'à la prochaine reconstruction, et donnerait
 * pour vraie une réponse devenue fausse. C'est précisément le cas que le
 * prompt 20 (§ qcm.6) avait prévu, et la raison pour laquelle l'expiration
 * est vérifiée deux fois.
 *
 * Une question **sans temporalité** n'est pas expirée : l'étiquetage de la
 * banque se fait par lots, et traiter « non étiquetée » comme « périmée »
 * viderait l'épreuve avant que le premier lot soit écrit.
 */
export function estExpiree(question: QuestionDgfip, aujourdhui = jourISO()): boolean {
  const fin = question.temporalite?.expire_le;
  return fin !== undefined && fin < aujourdhui;
}

/** Les questions qu'une session peut poser aujourd'hui, dans ce parcours. */
export function questionsServables(
  banque: BanqueDgfip,
  parcours?: string,
  aujourdhui = jourISO(),
): QuestionDgfip[] {
  return banque.questions.filter(
    (q) => !estExpiree(q, aujourdhui) && origineAdmise(q.categorie_origine, parcours),
  );
}

/**
 * Quelles origines un parcours tire-t-il ?
 *
 * Le prompt 20 (§ par.11) pose la règle : « DGFiP B ne peut pas tirer dans
 * les questions B seules, ni A et A+ dans A et B ». Autrement dit, on ne
 * s'entraîne pas sur un sujet d'un autre concours que le sien — sauf vers le
 * bas, un candidat de catégorie A pouvant réviser sur des questions de
 * catégorie B.
 *
 * `maison` est admise partout : ces questions ne viennent d'aucune annale, et
 * les réserver à un parcours reviendrait à leur prêter une origine qu'elles
 * n'ont pas. Un parcours inconnu, ou l'INSP, tire dans tout : la banque lui
 * sert d'entraînement général, et rien dans le prompt ne l'en prive.
 */
function origineAdmise(origine: QuestionDgfip['categorie_origine'], parcours?: string): boolean {
  if (origine === 'maison') return true;
  if (parcours === 'dgfip-b') return origine === 'B';
  return true;
}
