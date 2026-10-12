/**
 * Le schéma du corps, dessiné nativement.
 *
 * ## Pourquoi des formes déclarées et non une image
 *
 * Une image serait plus jolie et inutilisable : on ne peut pas donner un nom
 * accessible à une zone d'un PNG, ni la colorer selon le volume, ni la
 * parcourir au clavier. Les formes sont donc **des données** — un tableau de
 * primitives par muscle — que la page assemble en SVG. Un essai peut alors
 * vérifier que chaque muscle du modèle a bien une forme, ce qu'aucune image
 * ne permettrait.
 *
 * ## Le dessin est schématique, et il l'assume
 *
 * Des ellipses et des rectangles arrondis. Ce n'est pas une planche
 * d'anatomie : c'est une carte cliquable dont la seule exigence est qu'on
 * reconnaisse où l'on clique. Des contours anatomiques exacts coûteraient des
 * milliers de points de chemin pour une précision dont personne n'a besoin
 * pour cocher « pectoraux ».
 *
 * ## L'alternative en cases à cocher n'est pas un repli, c'est l'égal
 *
 * Le prompt l'exige, et la raison tient en une phrase : **un schéma cliquable
 * n'est pas utilisable au lecteur d'écran**, quoi qu'on fasse des rôles ARIA.
 * La liste de cases n'est donc pas un mode dégradé affiché en dernier
 * recours ; c'est la même donnée, toujours présente, et les deux restent
 * synchronisées. Qui navigue au clavier utilise les cases ; qui voit l'écran
 * utilise le schéma ; les deux écrivent la même chose.
 */
import { MUSCLES, type Face } from './modele';

/** Une primitive de dessin. Rien d'autre n'est permis : cela suffit. */
export type Forme =
  | { sorte: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotation?: number }
  | { sorte: 'rect'; x: number; y: number; largeur: number; hauteur: number; r?: number };

/** La boîte de dessin, identique pour les deux faces. */
export const LARGEUR = 200;
export const HAUTEUR = 420;

/**
 * Les formes de chaque muscle, par face.
 *
 * Un muscle n'apparaît que sur **sa** face : les pectoraux de face, les
 * dorsaux de dos. Les montrer des deux côtés doublerait les zones cliquables
 * et ferait croire à deux muscles distincts.
 */
export const FORMES: Record<string, Forme[]> = {
  /* --- Face avant ---------------------------------------------------------- */
  cou: [{ sorte: 'rect', x: 88, y: 44, largeur: 24, hauteur: 18, r: 6 }],
  pectoraux: [
    { sorte: 'ellipse', cx: 82, cy: 90, rx: 20, ry: 14 },
    { sorte: 'ellipse', cx: 118, cy: 90, rx: 20, ry: 14 },
  ],
  'deltoide-anterieur': [
    { sorte: 'ellipse', cx: 56, cy: 80, rx: 12, ry: 13 },
    { sorte: 'ellipse', cx: 144, cy: 80, rx: 12, ry: 13 },
  ],
  'deltoide-lateral': [
    { sorte: 'ellipse', cx: 47, cy: 92, rx: 9, ry: 12 },
    { sorte: 'ellipse', cx: 153, cy: 92, rx: 9, ry: 12 },
  ],
  biceps: [
    { sorte: 'ellipse', cx: 45, cy: 122, rx: 10, ry: 18 },
    { sorte: 'ellipse', cx: 155, cy: 122, rx: 10, ry: 18 },
  ],
  'avant-bras': [
    { sorte: 'ellipse', cx: 40, cy: 162, rx: 9, ry: 20 },
    { sorte: 'ellipse', cx: 160, cy: 162, rx: 9, ry: 20 },
  ],
  abdominaux: [{ sorte: 'rect', x: 85, y: 112, largeur: 30, hauteur: 46, r: 8 }],
  obliques: [
    { sorte: 'ellipse', cx: 74, cy: 136, rx: 8, ry: 22 },
    { sorte: 'ellipse', cx: 126, cy: 136, rx: 8, ry: 22 },
  ],
  quadriceps: [
    { sorte: 'ellipse', cx: 83, cy: 230, rx: 16, ry: 44 },
    { sorte: 'ellipse', cx: 117, cy: 230, rx: 16, ry: 44 },
  ],
  adducteurs: [
    { sorte: 'ellipse', cx: 94, cy: 212, rx: 7, ry: 26 },
    { sorte: 'ellipse', cx: 106, cy: 212, rx: 7, ry: 26 },
  ],

  /* --- Face arrière -------------------------------------------------------- */
  trapezes: [{ sorte: 'rect', x: 72, y: 62, largeur: 56, hauteur: 26, r: 10 }],
  'deltoide-posterieur': [
    { sorte: 'ellipse', cx: 55, cy: 84, rx: 12, ry: 13 },
    { sorte: 'ellipse', cx: 145, cy: 84, rx: 12, ry: 13 },
  ],
  dorsaux: [
    { sorte: 'ellipse', cx: 82, cy: 118, rx: 18, ry: 26 },
    { sorte: 'ellipse', cx: 118, cy: 118, rx: 18, ry: 26 },
  ],
  triceps: [
    { sorte: 'ellipse', cx: 45, cy: 124, rx: 10, ry: 19 },
    { sorte: 'ellipse', cx: 155, cy: 124, rx: 10, ry: 19 },
  ],
  lombaires: [{ sorte: 'rect', x: 84, y: 148, largeur: 32, hauteur: 26, r: 8 }],
  fessiers: [
    { sorte: 'ellipse', cx: 85, cy: 190, rx: 17, ry: 16 },
    { sorte: 'ellipse', cx: 115, cy: 190, rx: 17, ry: 16 },
  ],
  'ischio-jambiers': [
    { sorte: 'ellipse', cx: 84, cy: 244, rx: 15, ry: 40 },
    { sorte: 'ellipse', cx: 116, cy: 244, rx: 15, ry: 40 },
  ],
  mollets: [
    { sorte: 'ellipse', cx: 85, cy: 324, rx: 12, ry: 30 },
    { sorte: 'ellipse', cx: 115, cy: 324, rx: 12, ry: 30 },
  ],
};

/**
 * La silhouette, dessinée sous les muscles.
 *
 * Elle n'est **pas** cliquable et porte `aria-hidden` : c'est un repère
 * visuel, et l'exposer ajouterait au parcours clavier une étape qui ne mène
 * nulle part.
 */
export const SILHOUETTE: Forme[] = [
  { sorte: 'ellipse', cx: 100, cy: 30, rx: 20, ry: 24 }, // tête
  { sorte: 'rect', x: 70, y: 58, largeur: 60, hauteur: 110, r: 18 }, // tronc
  { sorte: 'rect', x: 76, y: 160, largeur: 48, hauteur: 40, r: 12 }, // bassin
  { sorte: 'rect', x: 34, y: 76, largeur: 18, hauteur: 110, r: 9 }, // bras gauche
  { sorte: 'rect', x: 148, y: 76, largeur: 18, hauteur: 110, r: 9 }, // bras droit
  { sorte: 'rect', x: 70, y: 190, largeur: 26, hauteur: 170, r: 13 }, // jambe gauche
  { sorte: 'rect', x: 104, y: 190, largeur: 26, hauteur: 170, r: 13 }, // jambe droite
];

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

/** Les muscles d'une face, dans l'ordre de parcours au clavier : de haut en bas. */
export function musclesDeLaFace(face: Face): string[] {
  return MUSCLES.filter((m) => m.face === face)
    .map((m) => m.id)
    .sort((a, b) => hauteurMoyenne(a) - hauteurMoyenne(b));
}

/** L'ordonnée moyenne des formes d'un muscle, pour l'ordre de tabulation. */
function hauteurMoyenne(id: string): number {
  const formes = FORMES[id] ?? [];
  if (!formes.length) return 0;
  const somme = formes.reduce(
    (total, f) => total + (f.sorte === 'ellipse' ? f.cy : f.y + f.hauteur / 2),
    0,
  );
  return somme / formes.length;
}

/* ══════════════════════════════════════════════════════════════════════════
   Le contrôle
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le schéma couvre-t-il le modèle ?
 *
 * Un muscle déclaré sans forme serait invisible sur le schéma tout en
 * existant dans les cases à cocher : les deux représentations cesseraient de
 * dire la même chose, ce qui est précisément ce que l'alternative accessible
 * doit empêcher.
 */
export function controlerSchema(): string[] {
  const problemes: string[] = [];
  for (const m of MUSCLES) {
    const formes = FORMES[m.id];
    if (!formes || !formes.length) {
      problemes.push(`Le muscle « ${m.id} » n’a aucune forme sur le schéma.`);
      continue;
    }
    for (const f of formes) {
      const dehors =
        f.sorte === 'ellipse'
          ? f.cx - f.rx < 0 || f.cx + f.rx > LARGEUR || f.cy - f.ry < 0 || f.cy + f.ry > HAUTEUR
          : f.x < 0 || f.x + f.largeur > LARGEUR || f.y < 0 || f.y + f.hauteur > HAUTEUR;
      if (dehors) problemes.push(`Une forme de « ${m.id} » déborde de la boîte.`);
    }
  }
  for (const id of Object.keys(FORMES)) {
    if (!MUSCLES.some((m) => m.id === id)) {
      problemes.push(`Le schéma dessine « ${id} », qui n’est pas un muscle déclaré.`);
    }
  }
  /*
     Les deux faces doivent porter des muscles : une face vide serait un
     onglet qui ne mène à rien, et l'on s'en apercevrait à l'usage plutôt
     qu'ici.
  */
  for (const face of ['avant', 'arriere'] as Face[]) {
    if (!musclesDeLaFace(face).length) problemes.push(`La face « ${face} » est vide.`);
  }
  return problemes;
}
