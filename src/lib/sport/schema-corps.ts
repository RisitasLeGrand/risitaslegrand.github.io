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
 * Une seule version, depuis la décision 1 du 14 octobre : membres droits,
 * contours sobres. La forme dite « complète » a été retirée — à la taille
 * affichée elle ne se distinguait presque pas de celle-ci, et ses contours
 * n'étaient pas anatomiquement crédibles. Une forme complète digne de ce nom
 * pourra faire l'objet d'un lot à part, d'après une source légitime.
 */
const SILHOUETTE_SIMPLIFIEE: Forme[] = [
  c('M 100 7 Q 119 7 120 29 Q 119 51 100 53 Q 81 51 80 29 Q 81 7 100 7 Z', 80, 7, 40, 46),
  c('M 86 53 L 114 53 L 114 61 Q 133 67 136 88 L 131 152 Q 129 172 126 192 L 74 192 Q 71 172 69 152 L 64 88 Q 67 67 86 61 Z', 64, 53, 72, 139),
  ...paire(c('M 64 76 Q 48 82 44 102 Q 40 124 36 146 Q 33 166 31 184 Q 36 192 48 189 Q 50 168 53 148 Q 56 126 59 104 Q 62 88 68 80 Z', 31, 76, 37, 116)),
  ...paire(c('M 69 194 Q 68 230 73 262 Q 76 290 77 316 Q 78 340 79 357 Q 86 362 93 357 Q 94 340 95 316 Q 96 290 98 262 Q 101 230 100 194 Z', 68, 194, 33, 168)),
];


/* ══════════════════════════════════════════════════════════════════════════
   Les formes publiées
   ══════════════════════════════════════════════════════════════════════════ */

/*
   UNE SEULE FORME, depuis la décision 1 du 14 octobre 2026.

   Il y en avait deux, et un sélecteur pour en changer. À la taille réellement
   affichée, la forme « complète » se distinguait à peine de la simplifiée, et
   ses contours ne tenaient pas comme anatomie. Un réglage qui ne change rien
   de perceptible est une question posée pour rien.

   Ont disparu avec elle : le type « FormeDuCorps », « FORME_PAR_DEFAUT »,
   « LIBELLE_FORME », « formesDuCorps », « silhouetteDuCorps », les tracés
   « COMPLETE » et « SILHOUETTE_COMPLETE », et le sélecteur de l'écran des
   exercices. Les deux exports ci-dessous gardent leur nom : les appelants qui
   ne choisissaient pas continuent de fonctionner sans rien changer.
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
 * doit empêcher.
 */
export function controlerSchema(): string[] {
  const problemes: string[] = [];

  for (const [nom, jeu] of [['simplifiée', SIMPLIFIEE]] as const) {
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

  /*
     TROIS CONTRÔLES ONT DISPARU AVEC LA FORME COMPLÈTE, et c'est normal, pas
     un allègement : ils comparaient les deux jeux entre eux — mêmes muscles,
     même nombre de chemins par muscle, même nombre de pièces de silhouette.
     Avec un seul jeu, ils n'ont plus rien à comparer. Tout ce qui portait sur
     la justesse d'un jeu pris isolément est conservé.
  */

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
  for (const jeu of [SIMPLIFIEE]) {
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
