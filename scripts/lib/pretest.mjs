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
 * La liste est volontairement étroite : chaque terme y figure parce qu'il ne
 * peut guère désigner autre chose que l'exercice du concours. « Programme »,
 * « rédaction », « candidat » et « note » en sont absents — ils servent aussi
 * au fond (programme de clémence, responsable de programme, candidat à un
 * emploi public, note souveraine), et un contrôle qui crie à tort finit par ne
 * plus être lu. C'est donc un filet, pas une preuve : la règle tient d'abord à
 * ce qu'on écrit.
 */
export const MOTS_DE_L_EPREUVE = [
  'epreuve',
  'epreuves',
  'copie',
  'copies',
  'correcteur',
  'correcteurs',
  'jury',
  'jurys',
  'coefficient',
  'note operationnelle',
  'note de synthese',
  'note administrative',
  'fascicule',
  'fascicules',
  'chapitre',
  'chapitres',
  'devoir',
  'corrige',
  'dissertation',
  'dissertations',
  'insp',
];

/**
 * Les expressions où un mot interdit désigne tout autre chose.
 *
 * L'en-tête ci-dessus affirme que chaque terme de la liste « ne peut guère
 * désigner autre chose que l'exercice du concours ». Un **jury citoyen** est
 * le contre-exemple : une instance de participation tirée au sort, qui est
 * précisément le fond d'une fiche de cas pratique sur l'association des
 * citoyens aux politiques publiques. La question a été refusée à tort, et
 * reformulée pour contourner le filtre — ce qui est le signe qu'un filtre a
 * tort, pas qu'il a bien travaillé.
 *
 * Les exceptions sont retirées du texte **avant** la recherche, et non
 * ajoutées comme cas particuliers après : un mot interdit qui réapparaît
 * ailleurs dans la même question doit continuer de tomber.
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
