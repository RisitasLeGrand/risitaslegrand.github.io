/**
 * Ce qu'un prétest n'a pas le droit de demander.
 *
 * Un prétest ouvre la lecture d'un sujet ; il ne révise pas le mode d'emploi du
 * concours. Une question sur la durée de l'épreuve, son coefficient, le plan
 * attendu ou ce qu'en dit le jury n'oriente aucune lecture : elle occupe la
 * place d'une question qui, elle, l'aurait fait.
 *
 * Partagé par le build et par « npm run verifier:pretests », pour que les deux
 * disent la même chose.
 */

/**
 * La liste est volontairement étroite, et elle a rétréci.
 *
 * Le principe n'a pas changé : un terme n'y figure que s'il **ne peut guère
 * désigner autre chose** que l'exercice du concours. « Programme »,
 * « rédaction », « candidat » et « note » en ont toujours été absents — ils
 * servent aussi au fond, et un contrôle qui crie à tort finit par ne plus être
 * lu.
 *
 * ## Quatre mots sont partis, parce que le principe le commandait
 *
 * `devoir`, `chapitre`, `coefficient` et `copie` y figuraient, et chacun a un
 * sens plein **dans les matières mêmes de ce concours** :
 *
 * - le **devoir de vigilance**, le devoir de réserve, le devoir d'ingérence ;
 * - le **chapitre budgétaire**, en finances publiques ;
 * - le **coefficient multiplicateur**, le coefficient de Gini ;
 * - la **copie conforme**, la copie privée.
 *
 * Deux faux positifs ont été constatés en rédaction — « jury citoyen », puis
 * « devoir de vigilance » — et dans les deux cas la question a été
 * **reformulée pour contourner le filtre**. C'est le symptôme à ne pas laisser
 * passer : un filtre qu'on contourne ne protège plus rien, il déforme
 * seulement ce qu'on écrit.
 *
 * ## Ce qui les remplace
 *
 * Des expressions entières, qui ne laissent aucun doute. Elles attrapent moins
 * large — c'est le prix d'un contrôle auquel on peut se fier.
 *
 * Et la plupart des phrases visées restent prises par un autre mot : « Quel
 * est le coefficient de cette épreuve ? » tombe sur « épreuve », « Combien de
 * chapitres compte le fascicule ? » sur « fascicule ». Les retirer ne laisse
 * donc passer que ce que ces mots étaient seuls à prendre.
 */
export const MOTS_DE_L_EPREUVE = [
  'epreuve',
  'epreuves',
  'correcteur',
  'correcteurs',
  'jury',
  'jurys',
  'note operationnelle',
  'note de synthese',
  'note administrative',
  'fascicule',
  'fascicules',
  'corrige',
  'dissertation',
  'dissertations',
  'insp',
  /* Les expressions entières qui remplacent les quatre mots retirés. */
  'sujet du devoir',
  'devoir 1',
  'devoir 2',
  'devoir surveille',
  'rendre le devoir',
  'chapitre du fascicule',
  'chapitres du fascicule',
  'coefficient de l epreuve',
  'coefficient de cette epreuve',
  'copie du concours',
  'rendre sa copie',
  'rendre la copie',
];

/**
 * Les expressions où un mot interdit désigne tout autre chose.
 *
 * `jury` reste dans la liste, parce que le jury du concours est ce dont une
 * question de prétest parle neuf fois sur dix. Mais un **jury citoyen** est
 * une instance de participation tirée au sort, et c'est le fond d'une fiche de
 * cas pratique. Les autres faux positifs ont été réglés autrement, en retirant
 * le mot de la liste : ici ne reste que celui dont le sens « concours » domine
 * franchement, et dont l'exception est vraiment une exception.
 *
 * Elles sont retirées du texte **avant** la recherche, et non traitées en cas
 * particulier après : un mot interdit qui réapparaît ailleurs dans la même
 * question doit continuer de tomber.
 */
export const EXPRESSIONS_PERMISES = [
  'jury citoyen',
  'jurys citoyens',
  'jury populaire',
  'jurys populaires',
  'jury d assises',
  'jurys d assises',
];

export const normaliserQuestion = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Le terme de l'épreuve trouvé dans une question, s'il y en a un. */
export function motDeLEpreuve(question) {
  let entier = normaliserQuestion(question);
  for (const permise of EXPRESSIONS_PERMISES) entier = entier.split(permise).join(' ');
  entier = entier.replace(/\s{2,}/g, ' ').trim();
  const mots = entier.split(' ');
  return (
    MOTS_DE_L_EPREUVE.find((m) => (m.includes(' ') ? entier.includes(m) : mots.includes(m))) ?? null
  );
}
