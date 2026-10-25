/**
 * Les valeurs du profil, dites en français (P7 du prompt 56).
 *
 * ## Ce que l'écran affichait
 *
 * `insp`, `psyche`, `fr`, `2027-03-15`, `{"corps":3}`, en police à chasse
 * fixe. Ce sont des identifiants et des formats de stockage : la personne n'a
 * jamais vu `psyche` ailleurs, et une date ISO se lit mal là où elle compte le
 * plus — une épreuve. Dire « Psyché » et « 15 mars 2027 » ne coûte qu'une
 * table de libellés, qui existe déjà ailleurs dans le site.
 *
 * ## Pourquoi les libellés sont des paramètres
 *
 * Ce module reste **pur** : on lui passe les parcours et les domaines, il rend
 * du texte. Importer le registre des parcours ferait venir avec lui les thèmes,
 * les rotations et les référentiels — pour afficher « INSP ». Et un essai qui
 * doit construire un registre complet pour vérifier une mise en forme n'éprouve
 * plus la mise en forme.
 *
 * ## Un identifiant inconnu n'est pas remplacé
 *
 * Il est rendu tel quel. Un parcours retiré du registre laisse une réponse dans
 * le journal, et la montrer brute est honnête : inventer un libellé pour un
 * identifiant qu'on ne connaît plus reviendrait à prétendre savoir ce que la
 * personne avait choisi.
 */
/**
 * ## Ce module ne nomme aucun champ, et ce n'est pas un hasard
 *
 * Sa première version portait trois listes — « ces champs nomment des
 * parcours », « ceux-là ne se groupent pas », « ceux-là sont en heures ». Elle
 * nommait donc `naissanceAnnee`, et le contrôle du graphe d'imports l'a
 * refusée : hors de six fichiers, nommer un champ brut est le premier geste de
 * qui contourne la porte de l'âge. La règle avait raison, et ces trois listes
 * étaient de toute façon des propriétés des champs. Elles sont au catalogue,
 * et ce module ne lit que des déclarations.
 */
import {
  NON_REPONSE_INCONNU,
  NON_REPONSE_REFUS,
  champDeclare,
} from './noyau/profil';

export interface Libelles {
  parcours: readonly { id: string; libelle: string }[];
  domaines: readonly { id: string; libelle: string }[];
}

const table = (champ: string, libelles: Libelles): Map<string, string> | null => {
  const clefs = champDeclare(champ)?.clefs;
  if (clefs === 'parcours') return new Map(libelles.parcours.map((p) => [p.id, p.libelle]));
  if (clefs === 'domaines') return new Map(libelles.domaines.map((d) => [d.id, d.libelle]));
  return null;
};

const DATE_NUE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Une heure murale, dite comme on la dit : « 6 h 30 », « 7 h ».
 *
 * L'heure ronde ne porte pas ses minutes, et le zéro de tête disparaît : c'est
 * la règle du français, et « 06:30 » n'est la règle de personne.
 */
export function heureDite(valeur: string): string | null {
  const m = HEURE.exec(valeur);
  if (!m) return null;
  return m[2] === '00' ? `${Number(m[1])} h` : `${Number(m[1])} h ${m[2]}`;
}

/** Une date nue, en toutes lettres : « 15 mars 2027 ». */
export function dateDite(valeur: string): string | null {
  const m = DATE_NUE.exec(valeur);
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const instant = Date.UTC(annee, mois - 1, jour);
  const controle = new Date(instant);
  if (
    controle.getUTCFullYear() !== annee ||
    controle.getUTCMonth() + 1 !== mois ||
    controle.getUTCDate() !== jour
  ) {
    return null;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(controle);
}

/**
 * Un nombre avec son unité, telle que le catalogue la déclare.
 *
 * `Intl` et non une concaténation : l'espace qui sépare les milliers est une
 * insécable fine, et c'est elle qu'attend le français. Une année, elle, ne se
 * groupe pas — le catalogue le dit champ par champ.
 *
 * L'unité est déclarée au singulier et au pluriel plutôt que déduite : « h »
 * ne s'accorde pas, « séance » s'accorde, et une règle qui devinerait l'un à
 * partir de l'autre se tromperait au premier contre-exemple.
 */
export function nombreDit(champ: string, valeur: number): string {
  const declare = champDeclare(champ);
  const nombre = new Intl.NumberFormat('fr-FR', {
    useGrouping: declare?.sansGroupement !== true,
  }).format(valeur);
  if (!declare?.unite) return nombre;
  return `${nombre} ${valeur > 1 ? declare.unite.plusieurs : declare.unite.un}`;
}

/** Une liste, avec les libellés connus, et les autres tels quels. */
function listeDite(champ: string, valeur: readonly unknown[], libelles: Libelles): string {
  const noms = table(champ, libelles);
  const dits = valeur
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((x) => noms?.get(x) ?? x);
  return dits.length ? dits.join(', ') : '—';
}

/** Une répartition : « INSP : 15 mars 2027 », « Corps : 3 h ». */
function repartitionDite(
  champ: string,
  valeur: Record<string, unknown>,
  libelles: Libelles,
): string {
  const noms = table(champ, libelles);
  const dits: string[] = [];
  for (const [cle, brut] of Object.entries(valeur)) {
    const nom = noms?.get(cle) ?? cle;
    if (typeof brut === 'string') {
      const date = dateDite(brut);
      dits.push(`${nom} : ${date ?? brut}`);
      continue;
    }
    if (typeof brut === 'number' && Number.isFinite(brut)) {
      dits.push(`${nom} : ${nombreDit(champ, brut)}`);
      continue;
    }
    /* Une valeur d'une forme qu'on ne sait pas dire n'est pas devinée. */
    dits.push(`${nom} : —`);
  }
  return dits.length ? dits.join(' · ') : '—';
}

/**
 * La valeur d'un champ, telle que l'écran la montre.
 *
 * Rend toujours une chaîne, et **jamais** `undefined` ni « [object Object] ».
 * Le tiret cadratin dit « rien » : il est muet pour un lecteur d'écran qui
 * l'annonce comme une ponctuation, là où une chaîne vide ne dirait rien du
 * tout — et l'écran ajoute « non renseigné » à côté, qui est le texte lu.
 */
export function valeurDite(champ: string, valeur: unknown, libelles: Libelles): string {
  if (valeur === null || valeur === undefined) return '—';
  /*
     LES DEUX NON-RÉPONSES SE DISENT EN MOTS, ET NON PAR LEUR CODE.

     Sans cela la carte afficherait « sans-reponse », ce qui ne veut rien dire
     pour qui lit, et « — », qui veut dire autre chose : « pas répondu ». Les
     trois états doivent se distinguer à l'œil — pas répondu, je ne sais pas,
     je préfère ne pas répondre —, sans quoi la personne ne sait pas ce qu'elle
     a fait de la question.
  */
  if (valeur === NON_REPONSE_INCONNU) return 'vous ne savez pas';
  if (valeur === NON_REPONSE_REFUS) return 'vous préférez ne pas répondre';
  if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non';
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? nombreDit(champ, valeur) : '—';
  if (Array.isArray(valeur)) return listeDite(champ, valeur, libelles);
  if (typeof valeur === 'object') {
    return repartitionDite(champ, valeur as Record<string, unknown>, libelles);
  }
  const texte = String(valeur).trim();
  if (!texte) return '—';
  return heureDite(texte) ?? dateDite(texte) ?? texte;
}

export interface Historique {
  source: 'declare' | 'observe' | 'confirme';
  version: number;
  appareil: string;
  /** L'appareil où l'on se trouve, pour dire « cet appareil ». */
  appareilCourant?: string;
}

const SOURCE_DITE: Record<Historique['source'], string> = {
  declare: 'déclaré',
  observe: 'observé, non confirmé',
  confirme: 'observé, puis confirmé',
};

/**
 * La provenance, la version et l'appareil, réunis en une phrase (P7).
 *
 * Ils tenaient trois lignes sous chaque carte — « observé, non confirmé ·
 * version 1 · posé sur R7APGVC6 » —, treize fois de suite. C'est utile le jour
 * où un réglage est faux, et encombrant les autres jours : la phrase va dans
 * un dépliant « Historique », et l'identifiant d'appareil devient « cet
 * appareil » quand c'est le sien.
 */
export function historiqueDit(h: Historique): string {
  const parties = [SOURCE_DITE[h.source]];
  if (h.version > 1) parties.push(`modifié ${h.version - 1} fois`);
  parties.push(
    h.appareilCourant && h.appareil === h.appareilCourant
      ? 'dernier appareil : celui-ci'
      : `dernier appareil : ${h.appareil}`,
  );
  return parties.join(', ');
}
