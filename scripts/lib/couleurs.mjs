/**
 * Les couleurs, en OKLCH — de quoi dériver une échelle et mesurer un
 * contraste.
 *
 * Pourquoi OKLCH et pas un simple éclaircissement en sRGB : éclaircir du
 * `#0B4F8A` en sRGB donne un bleu délavé qui vire au gris, parce que les
 * trois canaux ne portent pas la même part de luminosité perçue. OKLab est
 * construit pour que la distance dans l'espace corresponde à l'écart vu ;
 * une échelle qui s'y promène garde sa teinte du premier au dernier cran.
 *
 * Les formules sont celles de Björn Ottosson (oklab, 2020), avec la matrice
 * sRGB linéaire → LMS puis LMS^(1/3) → Lab. Rien n'est approché : ce sont
 * les mêmes constantes que la spécification CSS Color 4.
 */

/* ── sRGB ↔ linéaire ─────────────────────────────────────────────────────── */

const versLineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const versSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function versRvb(couleur) {
  const t = couleur.trim();
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const n = h.length === 3 ? [...h].map((x) => x + x).join('') : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(t);
  if (m)
    return m[1]
      .split(/[,\s/]+/)
      .slice(0, 3)
      .map((v) => Number(v) / 255);
  throw new Error(`Couleur non reconnue : ${couleur}`);
}

export const versHexa = ([r, v, b]) =>
  `#${[r, v, b]
    .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;

/* ── sRGB ↔ OKLab ────────────────────────────────────────────────────────── */

export function versOklab([r, v, b]) {
  const rl = versLineaire(r);
  const vl = versLineaire(v);
  const bl = versLineaire(b);
  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * vl + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * vl + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * vl + 0.6299787005 * bl);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function depuisOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    versSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    versSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    versSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function oklch(couleur) {
  const [L, a, b] = versOklab(versRvb(couleur));
  return { L, C: Math.hypot(a, b), H: (Math.atan2(b, a) * 180) / Math.PI };
}

/**
 * De l'OKLCH vers un hexa **dans le gamut sRGB**.
 *
 * Hors gamut, on réduit le chroma par dichotomie plutôt que d'écrêter les
 * canaux : l'écrêtage change la teinte, et une échelle dont la teinte dérive
 * au dernier cran se voit immédiatement.
 */
export function depuisOklch({ L, C, H }) {
  const rad = (H * Math.PI) / 180;
  const essai = (c) => depuisOklab([L, c * Math.cos(rad), c * Math.sin(rad)]);
  const dedans = (rvb) => rvb.every((v) => v >= -0.0005 && v <= 1.0005);
  if (dedans(essai(C))) return versHexa(essai(C));
  let bas = 0;
  let haut = C;
  for (let i = 0; i < 24; i += 1) {
    const milieu = (bas + haut) / 2;
    if (dedans(essai(milieu))) bas = milieu;
    else haut = milieu;
  }
  return versHexa(essai(bas));
}

/* ── Contraste WCAG ──────────────────────────────────────────────────────── */

export function luminance(couleur) {
  const [r, v, b] = versRvb(couleur).map(versLineaire);
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

export function contraste(avant, arriere) {
  const a = luminance(avant);
  const b = luminance(arriere);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Pousse une couleur, en clarté seulement, jusqu'à atteindre le rapport
 * demandé sur un fond. Rend la couleur d'origine si elle suffit déjà.
 *
 * Sert aux bordures de champ et aux icônes, que l'addendum veut à 3:1 : les
 * bordures décoratives de Papier et de Nuit de Délos n'y sont pas, et il faut
 * « dériver une teinte plus marquée, et dire laquelle ». C'est ici qu'on la
 * dérive, et le générateur l'imprime.
 */
export function renforcer(couleur, fond, rapport) {
  if (contraste(couleur, fond) >= rapport) return couleur;
  const base = oklch(couleur);
  const versLeSombre = luminance(fond) > 0.18;
  let meilleure = couleur;
  for (let i = 1; i <= 100; i += 1) {
    const L = versLeSombre ? base.L * (1 - i / 100) : base.L + (1 - base.L) * (i / 100);
    const essai = depuisOklch({ ...base, L });
    meilleure = essai;
    if (contraste(essai, fond) >= rapport) return essai;
  }
  return meilleure;
}
