/**
 * Le schéma du corps, dessiné nativement — deux formes, des chemins déclarés.
 *
 * ## Pourquoi des formes déclarées et non une image
 *
 * Une image serait plus jolie et inutilisable : on ne peut pas donner un nom
 * accessible à une zone d'un PNG, ni la colorer selon le volume, ni la
 * parcourir au clavier. Les formes sont donc **des données** — un chemin par
 * muscle — que la page assemble en SVG. Un essai peut alors vérifier que
 * chaque muscle du modèle a bien une forme **dans les deux jeux**, ce
 * qu'aucune image ne permettrait.
 *
 * ## Deux jeux, et le défaut est le plus sobre
 *
 * Décision 6 du prompt 34, tranchée par Alexis : **simplifiée par défaut**,
 * partout, le choix restant mémorisé et réversible.
 *
 * - **simplifiée** : une forme lisse par muscle, aux mêmes emplacements
 *   qu'avant ce lot. C'est une carte cliquable dont la seule exigence est
 *   qu'on reconnaisse où l'on clique.
 * - **complète** : la même carte, avec le détail de contour qui fait lire un
 *   muscle plutôt qu'une tache — la fente sternale des pectoraux, les
 *   segments des abdominaux, la séparation des vastes du quadriceps, les deux
 *   chefs du mollet.
 *
 * Les deux jeux partagent **les mêmes ancrages**. Ce n'est pas de la paresse :
 * une zone cliquable qui se déplacerait d'une forme à l'autre ferait rater la
 * cible à qui change de réglage, et obligerait à re-prouver la couverture
 * deux fois.
 *
 * ## Un seul côté est écrit, l'autre est reflété
 *
 * Les muscles pairs sont déclarés **à gauche seulement**, puis reflétés par
 * `miroir()`. Écrire les deux côtés à la main, c'est 68 chemins au lieu de 40
 * et une asymétrie à la première correction oubliée d'un côté. Le reflet est
 * une fonction de vingt lignes sur une grammaire volontairement réduite, et
 * un contrôle établit que **refléter deux fois rend l'original** — ce qu'un
 * copier-coller symétrique ne permet pas de prouver.
 *
 * ## Le dessin reste schématique, et il l'assume
 *
 * Même en forme complète, ce n'est pas une planche d'anatomie. Des contours
 * exacts coûteraient des milliers de points pour une précision dont personne
 * n'a besoin pour cocher « pectoraux ». Le dessin est **original**, écrit
 * ici : aucune planche protégée n'a été reprise, et il n'y a donc aucune
 * attribution à porter.
 *
 * ## L'alternative en cases à cocher n'est pas un repli, c'est l'égal
 *
 * Le prompt l'exige, et la raison tient en une phrase : **un schéma cliquable
 * n'est pas utilisable au lecteur d'écran**, quoi qu'on fasse des rôles ARIA.
 * La liste de cases n'est donc pas un mode dégradé affiché en dernier
 * recours ; c'est la même donnée, toujours présente, et les deux restent
 * synchronisées. Qui navigue au clavier utilise les cases ; qui voit l'écran
 * utilise le schéma ; les deux écrivent la même chose. Cela vaut pour les
 * deux formes du schéma.
 */
import { MUSCLES, type Face } from './modele';

/** La boîte de dessin, identique pour les deux faces et les deux formes. */
export const LARGEUR = 200;
export const HAUTEUR = 420;

/** L'axe de symétrie : le milieu de la boîte. */
const AXE = LARGEUR / 2;

/**
 * Une forme : un chemin SVG et la boîte qui l'englobe.
 *
 * La boîte est **déclarée** plutôt que calculée. Mesurer les bornes d'un
 * chemin suppose d'évaluer ses courbes, ce qui n'a pas sa place dans un
 * module de données — et un contrôle vérifie de toute façon que les
 * coordonnées écrites tiennent dedans. Elle sert à deux choses : l'ordre de
 * tabulation, qui va de haut en bas, et le contrôle de débordement.
 */
export type Forme = {
  sorte: 'chemin';
  d: string;
  boite: { x: number; y: number; largeur: number; hauteur: number };
};

/* ══════════════════════════════════════════════════════════════════════════
   Le reflet
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Reflète un chemin autour de l'axe vertical de la boîte.
 *
 * **La grammaire est volontairement réduite** — `M`, `L`, `Q`, `C`, `Z`, en
 * coordonnées absolues — et c'est ce qui rend la fonction sûre : il n'y a pas
 * d'arc, pas de commande relative, pas de forme raccourcie. Tout ce qui
 * pourrait être mal reflété est simplement interdit d'écriture, et le
 * contrôle le vérifie.
 *
 * Le reflet inverse le sens de parcours du contour. Sans conséquence ici :
 * les formes sont des contours fermés simples, sans trou, dont le remplissage
 * ne dépend pas du sens.
 */
export function miroir(d: string): string {
  return d
    .trim()
    .split(/(?=[MLQCZ])/)
    .map((bloc) => {
      const commande = bloc[0];
      if (commande === 'Z') return 'Z';
      const nombres = bloc
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      const reflechis = nombres.map((n, i) => (i % 2 === 0 ? AXE * 2 - n : n));
      return `${commande} ${reflechis.join(' ')}`;
    })
    .join(' ')
    .trim();
}

/** Reflète une forme entière, boîte comprise. */
const refleter = (f: Forme): Forme => ({
  sorte: 'chemin',
  d: miroir(f.d),
  boite: { ...f.boite, x: LARGEUR - f.boite.x - f.boite.largeur },
});

/** Une paire gauche/droite, à partir du seul côté gauche. */
const paire = (f: Forme): Forme[] => [f, refleter(f)];

/** Raccourci d'écriture : un chemin et sa boîte. */
const c = (d: string, x: number, y: number, largeur: number, hauteur: number): Forme => ({
  sorte: 'chemin',
  d,
  boite: { x, y, largeur, hauteur },
});

/* ══════════════════════════════════════════════════════════════════════════
   Forme simplifiée — le défaut (décision 6)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une forme lisse par muscle, aux emplacements éprouvés.
 *
 * Les muscles pairs sont écrits **à gauche** et reflétés. Les impairs — cou,
 * abdominaux, trapèzes, lombaires — sont centrés sur l'axe et s'écrivent une
 * fois.
 */
const SIMPLIFIEE: Record<string, Forme[]> = {
  /* --- Face avant --------------------------------------------------------- */
  cou: [c('M 92 44 L 108 44 Q 112 46 112 52 L 112 57 Q 110 62 104 62 L 96 62 Q 90 62 88 57 L 88 52 Q 88 46 92 44 Z', 88, 44, 24, 18)],
  pectoraux: paire(c('M 63 80 Q 68 75 80 74 Q 94 76 99 86 Q 99 98 88 103 Q 70 104 64 95 Q 62 88 63 80 Z', 62, 74, 37, 30)),
  'deltoide-anterieur': paire(c('M 44 82 Q 45 70 56 67 Q 66 69 68 80 Q 68 90 60 93 Q 48 93 44 82 Z', 44, 67, 24, 26)),
  'deltoide-lateral': paire(c('M 38 92 Q 38 82 46 80 Q 55 82 56 92 Q 56 102 47 104 Q 39 102 38 92 Z', 38, 80, 18, 24)),
  biceps: paire(c('M 37 112 Q 38 105 46 104 Q 54 106 55 116 Q 54 132 48 140 Q 40 139 38 128 Z', 36, 104, 19, 36)),
  'avant-bras': paire(c('M 33 152 Q 33 144 40 142 Q 48 144 49 154 Q 48 174 43 182 Q 35 180 33 168 Z', 32, 142, 17, 40)),
  abdominaux: [c('M 85 118 Q 86 112 92 112 L 108 112 Q 114 112 115 118 L 115 150 Q 113 158 106 158 L 94 158 Q 87 158 85 150 Z', 85, 112, 30, 46)],
  obliques: paire(c('M 66 122 Q 67 115 73 114 Q 81 117 82 128 L 82 148 Q 80 157 73 158 Q 67 154 66 144 Z', 66, 114, 16, 44)),
  quadriceps: paire(c('M 67 200 Q 68 189 83 186 Q 97 189 99 202 L 97 254 Q 93 272 83 274 Q 72 271 69 254 Z', 67, 186, 32, 88)),
  adducteurs: paire(c('M 87 196 Q 88 188 94 186 Q 100 189 101 198 L 101 228 Q 99 237 94 238 Q 88 235 87 226 Z', 87, 186, 14, 52)),

  /* --- Face arrière ------------------------------------------------------- */
  trapezes: [c('M 100 62 Q 116 64 127 70 Q 129 80 121 88 L 79 88 Q 71 80 73 70 Q 84 64 100 62 Z', 71, 62, 58, 26)],
  'deltoide-posterieur': paire(c('M 43 86 Q 44 74 55 71 Q 65 73 67 84 Q 67 94 59 97 Q 47 97 43 86 Z', 43, 71, 24, 26)),
  dorsaux: paire(c('M 64 102 Q 66 93 78 92 Q 92 96 99 104 L 99 132 Q 88 142 75 140 Q 66 132 64 116 Z', 64, 92, 35, 50)),
  triceps: paire(c('M 37 114 Q 38 106 46 105 Q 54 107 55 117 Q 54 134 48 143 Q 40 141 38 130 Z', 36, 105, 19, 38)),
  lombaires: [c('M 84 154 Q 85 148 91 148 L 109 148 Q 115 148 116 154 L 116 168 Q 114 174 108 174 L 92 174 Q 85 174 84 168 Z', 84, 148, 32, 26)],
  fessiers: paire(c('M 68 188 Q 69 176 84 174 Q 97 177 100 189 Q 100 202 87 206 Q 71 203 68 192 Z', 68, 174, 32, 32)),
  'ischio-jambiers': paire(c('M 69 216 Q 70 207 84 204 Q 97 208 99 218 L 97 266 Q 93 282 84 284 Q 74 281 71 266 Z', 69, 204, 30, 80)),
  mollets: paire(c('M 73 308 Q 74 297 85 294 Q 95 298 97 308 L 95 338 Q 91 352 85 354 Q 77 351 74 336 Z', 73, 294, 24, 60)),
};

/* ══════════════════════════════════════════════════════════════════════════
   Forme complète
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les mêmes muscles, avec le détail de contour qui les fait lire.
 *
 * Trois partis pris, et ils sont assumés.
 *
 * **Les ancrages ne bougent pas.** Une zone cliquable qui se déplacerait
 * d'une forme à l'autre ferait rater la cible à qui change de réglage. Le
 * détail s'ajoute à l'intérieur de la même empreinte.
 *
 * **Le détail passe par des sous-chemins, pas par des traits.** Les six
 * segments des abdominaux, les deux chefs du mollet, les deux vastes du
 * quadriceps sont des contours fermés distincts dans un même `d`. Un trait
 * séparateur demanderait un `stroke` que la coloration par volume écraserait ;
 * des blocs restent lisibles quelle que soit la couleur.
 *
 * **Ce n'est toujours pas une planche d'anatomie.** Les proportions sont
 * usuelles, les contours plausibles, et c'est tout ce que la fonction
 * demande : reconnaître où l'on clique, et voir ce qui a travaillé.
 */
const COMPLETE: Record<string, Forme[]> = {
  /* --- Face avant --------------------------------------------------------- */
  cou: [c('M 92 44 L 108 44 Q 113 47 112 54 Q 110 60 104 62 L 96 62 Q 90 60 88 54 Q 87 47 92 44 Z', 87, 44, 26, 18)],

  // Bord claviculaire droit en haut, fente sternale marquée au bord interne,
  // attache basse plus fuyante : trois traits qui suffisent à lire un pectoral.
  pectoraux: paire(c('M 63 78 L 86 75 Q 96 78 99 87 Q 99 94 96 99 Q 88 104 78 102 Q 68 99 64 93 Q 61 85 63 78 Z M 97 88 Q 93 92 90 97', 61, 75, 38, 29)),

  // Trois chefs suggérés par deux renflements du bord externe.
  'deltoide-anterieur': paire(c('M 44 83 Q 44 73 51 68 Q 60 65 66 72 Q 69 78 68 85 Q 66 92 59 93 Q 49 92 44 83 Z', 44, 65, 25, 28)),
  'deltoide-lateral': paire(c('M 38 93 Q 37 83 44 79 Q 52 79 56 87 Q 57 96 54 102 Q 46 105 41 100 Q 38 97 38 93 Z', 37, 79, 20, 26)),

  // Le ventre du biceps est haut et court, le tendon s'étire vers le coude.
  biceps: paire(c('M 37 113 Q 38 104 46 103 Q 54 105 56 115 Q 55 126 51 133 L 48 141 Q 43 141 41 135 Q 38 125 37 113 Z', 37, 103, 19, 38)),
  'avant-bras': paire(c('M 33 151 Q 34 143 41 141 Q 49 144 50 155 Q 49 166 46 174 L 43 183 Q 37 182 35 174 Q 33 162 33 151 Z', 33, 141, 17, 42)),

  // Six segments et la ligne blanche : l'abdomen se lit d'un coup d'œil.
  abdominaux: [c(
    'M 87 114 L 98 114 L 98 127 L 87 127 Z M 102 114 L 113 114 L 113 127 L 102 127 Z ' +
      'M 87 130 L 98 130 L 98 143 L 87 143 Z M 102 130 L 113 130 L 113 143 L 102 143 Z ' +
      'M 88 146 L 98 146 Q 98 157 93 158 Q 88 156 88 146 Z ' +
      'M 102 146 L 112 146 Q 112 156 107 158 Q 102 157 102 146 Z',
    87, 114, 26, 44,
  )],
  obliques: paire(c('M 66 121 Q 68 114 74 114 Q 81 118 82 129 L 82 146 Q 81 156 74 158 Q 68 155 66 146 Q 65 133 66 121 Z', 65, 114, 17, 44)),

  // Deux vastes séparés : le latéral large et bombé, le médial descendant bas
  // vers le genou — c'est la paire qui fait reconnaître une cuisse.
  quadriceps: paire(c(
    'M 67 201 Q 68 190 78 187 Q 85 189 86 200 L 85 250 Q 82 266 75 270 Q 69 266 68 250 Z ' +
      'M 89 192 Q 96 192 99 203 L 98 252 Q 95 271 88 274 Q 84 269 85 254 Z',
    67, 187, 32, 87,
  )),
  adducteurs: paire(c('M 88 195 Q 89 187 95 186 Q 100 190 101 199 L 101 226 Q 99 236 94 238 Q 89 234 88 224 Z', 88, 186, 13, 52)),

  /* --- Face arrière ------------------------------------------------------- */

  // Le trapèze en losange : pointe haute à la nuque, deux angles aux épaules,
  // pointe basse entre les omoplates.
  trapezes: [c('M 100 61 Q 116 63 128 70 Q 127 79 118 86 L 100 92 L 82 86 Q 73 79 72 70 Q 84 63 100 61 Z', 72, 61, 56, 31)],
  'deltoide-posterieur': paire(c('M 43 87 Q 43 76 50 71 Q 59 68 65 76 Q 68 82 67 89 Q 65 96 58 97 Q 48 95 43 87 Z', 43, 68, 25, 29)),

  // Le grand dorsal en V : large sous l'aisselle, pincé vers la taille.
  dorsaux: paire(c('M 63 100 Q 68 92 80 92 Q 93 97 99 106 L 99 128 Q 90 139 80 141 Q 71 136 67 125 Q 63 112 63 100 Z', 63, 92, 36, 49)),
  triceps: paire(c('M 37 115 Q 38 106 46 104 Q 55 107 56 118 Q 55 128 52 135 L 48 144 Q 43 143 41 136 Q 38 126 37 115 Z', 37, 104, 19, 40)),
  lombaires: [c('M 85 152 Q 88 147 94 148 L 106 148 Q 112 147 115 152 Q 117 161 115 169 Q 112 174 106 174 L 94 174 Q 88 174 85 169 Q 83 161 85 152 Z', 83, 147, 34, 27)],
  fessiers: paire(c('M 68 189 Q 68 177 81 174 Q 94 175 100 186 Q 102 197 96 204 Q 84 209 74 203 Q 68 197 68 189 Z', 68, 174, 34, 35)),

  // Deux faisceaux, séparés jusqu'au creux poplité.
  'ischio-jambiers': paire(c(
    'M 70 217 Q 71 207 80 205 Q 86 208 87 218 L 86 262 Q 83 280 78 284 Q 73 279 71 262 Z ' +
      'M 90 208 Q 97 210 99 220 L 97 262 Q 94 280 88 283 Q 85 276 86 262 Z',
    70, 205, 29, 79,
  )),

  // Les deux chefs du gastrocnémien, inégaux comme ils le sont.
  mollets: paire(c(
    'M 74 309 Q 75 298 83 295 Q 88 299 88 310 L 87 334 Q 85 348 82 353 Q 77 349 75 334 Z ' +
      'M 90 299 Q 96 301 97 310 L 95 332 Q 93 346 88 351 Q 86 344 87 332 Z',
    74, 295, 23, 58,
  )),
};

/* ══════════════════════════════════════════════════════════════════════════
   La silhouette
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le corps sous les muscles : tête, tronc, bras, jambes.
 *
 * Elle n'est **pas** cliquable et ne porte aucun nom accessible. Ce n'est pas
 * un oubli : elle ne désigne aucun muscle, elle sert d'appui visuel, et
 * l'exposer ajouterait au parcours clavier une étape qui ne mène nulle part.
 *
 * Deux versions, comme les muscles. La simplifiée garde des membres droits ;
 * la complète galbe les cuisses, creuse la taille et marque les chevilles —
 * ce qui fait la différence entre un bonhomme et une silhouette.
 */
const SILHOUETTE_SIMPLIFIEE: Forme[] = [
  c('M 100 7 Q 119 7 120 29 Q 119 51 100 53 Q 81 51 80 29 Q 81 7 100 7 Z', 80, 7, 40, 46),
  c('M 86 53 L 114 53 L 114 61 Q 133 67 136 88 L 131 152 Q 129 172 126 192 L 74 192 Q 71 172 69 152 L 64 88 Q 67 67 86 61 Z', 64, 53, 72, 139),
  ...paire(c('M 64 76 Q 48 82 44 102 Q 40 124 36 146 Q 33 166 31 184 Q 36 192 48 189 Q 50 168 53 148 Q 56 126 59 104 Q 62 88 68 80 Z', 31, 76, 37, 116)),
  ...paire(c('M 69 194 Q 68 230 73 262 Q 76 290 77 316 Q 78 340 79 357 Q 86 362 93 357 Q 94 340 95 316 Q 96 290 98 262 Q 101 230 100 194 Z', 68, 194, 33, 168)),
];

const SILHOUETTE_COMPLETE: Forme[] = [
  c('M 100 7 Q 118 8 120 28 Q 120 44 110 51 L 110 58 L 90 58 L 90 51 Q 80 44 80 28 Q 82 8 100 7 Z', 80, 7, 40, 51),
  // Taille creusée, épaules élargies, bassin repris : c'est ce galbe, et non
  // le détail des muscles, qui fait lire une silhouette plutôt qu'un gabarit.
  c('M 88 58 L 112 58 Q 132 64 137 88 L 134 118 Q 130 138 127 152 Q 130 172 127 192 L 73 192 Q 70 172 73 152 Q 70 138 66 118 L 63 88 Q 68 64 88 58 Z', 63, 58, 74, 134),
  ...paire(c('M 65 74 Q 47 80 43 102 Q 39 126 35 148 Q 32 168 30 185 Q 36 193 48 190 Q 50 170 53 150 Q 56 128 59 106 Q 62 88 69 79 Z', 30, 74, 39, 119)),
  ...paire(c('M 68 194 Q 67 228 72 258 Q 76 284 77 310 Q 79 334 80 357 Q 86 362 93 357 Q 95 334 96 310 Q 97 284 99 258 Q 102 228 101 194 Z', 67, 194, 35, 168)),
];

/* ══════════════════════════════════════════════════════════════════════════
   Le choix de la forme
   ══════════════════════════════════════════════════════════════════════════ */

export type FormeDuCorps = 'simplifiee' | 'complete';

/** Décision 6 d'Alexis, 14 octobre 2026 : simplifiée partout par défaut. */
export const FORME_PAR_DEFAUT: FormeDuCorps = 'simplifiee';

export const LIBELLE_FORME: Record<FormeDuCorps, string> = {
  simplifiee: 'Simplifiée',
  complete: 'Complète',
};

/** Les formes des muscles, pour la forme demandée. */
export function formesDuCorps(forme: FormeDuCorps = FORME_PAR_DEFAUT): Record<string, Forme[]> {
  return forme === 'complete' ? COMPLETE : SIMPLIFIEE;
}

/** La silhouette, pour la forme demandée. */
export function silhouetteDuCorps(forme: FormeDuCorps = FORME_PAR_DEFAUT): Forme[] {
  return forme === 'complete' ? SILHOUETTE_COMPLETE : SILHOUETTE_SIMPLIFIEE;
}

/**
 * Les formes par défaut, pour tout ce qui n'a pas à connaître le réglage.
 * Conservé sous son nom d'origine : les appelants qui ne choisissent pas
 * continuent de fonctionner, et obtiennent la forme par défaut.
 */
export const FORMES: Record<string, Forme[]> = SIMPLIFIEE;
export const SILHOUETTE: Forme[] = SILHOUETTE_SIMPLIFIEE;

/* ══════════════════════════════════════════════════════════════════════════
   Les trois états
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Trois états par clic, et le cycle revient à son point de départ.
 *
 * Le troisième état n'est pas un luxe : sans lui, désigner un muscle
 * **secondaire** demanderait un second contrôle à côté du schéma, et l'on
 * aurait deux façons de dire la même chose. Avec trois états, un clic suffit
 * à parcourir « rien → principal → secondaire → rien », et la case à cocher
 * correspondante fait exactement la même chose au clavier.
 */
export type EtatMuscle = 'aucun' | 'principal' | 'secondaire';

export const ETATS: readonly EtatMuscle[] = ['aucun', 'principal', 'secondaire'];

export const LIBELLE_ETAT: Record<EtatMuscle, string> = {
  aucun: 'non sollicité',
  principal: 'principal',
  secondaire: 'secondaire',
};

/** L'état suivant dans le cycle. */
export const etatSuivant = (etat: EtatMuscle): EtatMuscle =>
  ETATS[(ETATS.indexOf(etat) + 1) % ETATS.length];

/**
 * Les muscles d'une face, dans l'ordre de parcours au clavier : de haut en bas.
 *
 * L'ordre se lit sur la forme **simplifiée**, et c'est voulu : les deux jeux
 * partagent leurs ancrages, mais faire dépendre l'ordre de tabulation d'un
 * réglage d'affichage déplacerait le focus sous le doigt de qui change de
 * forme.
 */
export function musclesDeLaFace(face: Face): string[] {
  return MUSCLES.filter((m) => m.face === face)
    .map((m) => m.id)
    .sort((a, b) => hauteurMoyenne(a) - hauteurMoyenne(b));
}

/** L'ordonnée moyenne des formes d'un muscle, pour l'ordre de tabulation. */
function hauteurMoyenne(id: string): number {
  const formes = SIMPLIFIEE[id] ?? [];
  if (!formes.length) return 0;
  return formes.reduce((t, f) => t + f.boite.y + f.boite.hauteur / 2, 0) / formes.length;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/** Les coordonnées écrites dans un chemin, en paires (x, y). */
function pointsDuChemin(d: string): Array<[number, number]> {
  const nombres = d
    .replace(/[MLQCZ]/g, ' ')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const points: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nombres.length; i += 2) points.push([nombres[i], nombres[i + 1]]);
  return points;
}

/**
 * Le schéma couvre-t-il le modèle, dans les deux formes ?
 *
 * Un muscle déclaré sans forme serait invisible sur le schéma tout en
 * existant dans les cases à cocher : les deux représentations cesseraient de
 * dire la même chose, ce qui est précisément ce que l'alternative accessible
 * doit empêcher. Et un muscle présent dans une seule des deux formes ne se
 * verrait qu'au changement de réglage, c'est-à-dire trop tard.
 */
export function controlerSchema(): string[] {
  const problemes: string[] = [];

  for (const [nom, jeu] of [
    ['simplifiée', SIMPLIFIEE],
    ['complète', COMPLETE],
  ] as const) {
    for (const m of MUSCLES) {
      const formes = jeu[m.id];
      if (!formes || !formes.length) {
        problemes.push(`Forme ${nom} : le muscle « ${m.id} » n’a aucune forme.`);
        continue;
      }
      for (const f of formes) {
        const { x, y, largeur, hauteur } = f.boite;
        if (x < 0 || y < 0 || x + largeur > LARGEUR || y + hauteur > HAUTEUR) {
          problemes.push(`Forme ${nom} : une boîte de « ${m.id} » déborde du cadre.`);
        }
        // La boîte est déclarée : on vérifie qu'elle dit vrai, sinon l'ordre de
        // tabulation et le contrôle de débordement porteraient sur une fiction.
        for (const [px, py] of pointsDuChemin(f.d)) {
          if (px < x - 0.5 || px > x + largeur + 0.5 || py < y - 0.5 || py > y + hauteur + 0.5) {
            problemes.push(
              `Forme ${nom} : un point de « ${m.id} » (${px}, ${py}) sort de sa boîte déclarée.`,
            );
            break;
          }
        }
      }
    }
    for (const id of Object.keys(jeu)) {
      if (!MUSCLES.some((m) => m.id === id)) {
        problemes.push(`Forme ${nom} : « ${id} » est dessiné sans être un muscle déclaré.`);
      }
    }
  }

  // Les deux jeux doivent couvrir exactement les mêmes muscles : sans cela,
  // changer de forme ferait disparaître une zone cliquable.
  const aSimplifiee = Object.keys(SIMPLIFIEE).sort().join('|');
  const aComplete = Object.keys(COMPLETE).sort().join('|');
  if (aSimplifiee !== aComplete) {
    problemes.push('Les deux formes ne couvrent pas les mêmes muscles.');
  }

  /*
     Et le même NOMBRE de chemins par muscle. La page rend un seul jeu de
     balises et change le `d` au changement de réglage : si un muscle avait
     deux chemins d'un côté et un seul de l'autre, la bascule laisserait une
     forme orpheline à l'écran. C'est le genre de défaut qu'on ne voit qu'en
     basculant, c'est-à-dire rarement.
  */
  for (const m of MUSCLES) {
    const a = SIMPLIFIEE[m.id]?.length ?? 0;
    const b = COMPLETE[m.id]?.length ?? 0;
    if (a !== b) {
      problemes.push(`« ${m.id} » a ${a} chemin(s) en simplifiée et ${b} en complète.`);
    }
  }
  if (SILHOUETTE_SIMPLIFIEE.length !== SILHOUETTE_COMPLETE.length) {
    problemes.push('Les deux silhouettes n’ont pas le même nombre de pièces.');
  }

  /*
     Les deux faces doivent porter des muscles : une face vide serait un
     onglet qui ne mène à rien, et l'on s'en apercevrait à l'usage plutôt
     qu'ici.
  */
  for (const face of ['avant', 'arriere'] as Face[]) {
    if (!musclesDeLaFace(face).length) problemes.push(`La face « ${face} » est vide.`);
  }

  // Le reflet doit être sa propre réciproque : sans cela, un côté dériverait
  // de l'autre sans que rien ne le signale.
  for (const jeu of [SIMPLIFIEE, COMPLETE]) {
    for (const [id, formes] of Object.entries(jeu)) {
      for (const f of formes) {
        if (miroir(miroir(f.d)).replace(/\s+/g, ' ') !== f.d.replace(/\s+/g, ' ')) {
          problemes.push(`Le reflet de « ${id} » n’est pas sa propre réciproque.`);
          break;
        }
      }
    }
  }

  return problemes;
}
