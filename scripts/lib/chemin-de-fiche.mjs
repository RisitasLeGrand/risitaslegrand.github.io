/**
 * RETROUVER LE CHEMIN D'UNE FICHE À PARTIR DE SON IDENTIFIANT PUBLIÉ.
 *
 * ## L'enjeu, qui n'est pas cosmétique
 *
 * `ficheId = idStable(cheminRelatif)` : l'identifiant d'une fiche est
 * l'empreinte SHA-256 de son chemin dans `content/`. Le chemin lui-même n'est
 * pas publié — il est dans `ECARTES_DU_CLIENT`.
 *
 * Or toute la progression enregistrée dans le navigateur — révisions,
 * répétition espacée, séances, favoris — est rangée **par identifiant de
 * fiche**. Une fiche replacée à son vrai chemin garde son identifiant au
 * prochain build, et la progression continue de tomber juste. Replacée
 * ailleurs, elle en reçoit un neuf, et tout ce qui la concernait devient
 * orphelin, sans un message. Retrouver le chemin, c'est donc sauver du
 * travail de révision, pas ranger joliment des fichiers.
 *
 * ## Une empreinte ne se renverse pas, mais elle se vérifie
 *
 * On ne déduit pas le chemin : on en **propose**, et on garde celui dont
 * l'empreinte tombe exactement sur l'identifiant publié. C'est ce qui rend
 * la générosité sans risque — une proposition fausse est rejetée, jamais
 * acceptée par ressemblance.
 *
 * ## Ce qui est dérivable, et ce qui ne l'est pas
 *
 * Le dossier l'est : il vient de `matiere` et `fascicule`. Le nom de fichier
 * ne l'est **pas** — c'est une abréviation choisie à la main. Mesuré sur les
 * chemins réels : « La hiérarchie des normes et le contrôle de
 * constitutionnalité » s'est écrit `fiche-01-hierarchie-des-normes.md`.
 *
 * Aucune règle ne produit ce nom. Mais il est un **préfixe de mots** du titre
 * débarrassé de ses articles, et un préfixe, ça s'énumère. C'est tout l'art
 * de ce module, et c'est pourquoi il réussit souvent sans jamais pouvoir
 * promettre de réussir toujours.
 */
import path from 'node:path';
import { createHash } from 'node:crypto';
import { idStable } from './crypto.mjs';
import { PARCOURS } from '../../src/lib/parcours/registre.ts';

/** Le chemin d'une fiche, en minuscules et en tirets. */
export function enTiret(texte) {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Le préfixe de dossier du parcours, lu dans le registre et non écrit en dur. */
export function racineDuParcours(parcours) {
  const p = PARCOURS.find((x) => x.id === parcours);
  const racine = p?.racineContenu ?? '';
  return racine ? `${racine}/` : '';
}

/*
   LES MOTS VIDES DU FRANÇAIS, TELS QUE LES NOMS DE FICHIER LES TRAITENT.

   Mesuré sur les chemins réels : « La hiérarchie des normes et le contrôle de
   constitutionnalité » donne `fiche-01-hierarchie-des-normes.md`, et
   « Pandémie et relations internationales » donne
   `fiche-01-pandemie-relations-internationales.md`. Le premier garde son
   « des » au milieu, le second perd son « et ». Les deux conventions
   cohabitent, et on ne devine pas laquelle une fiche a suivie : on propose
   donc les deux, et c'est l'empreinte qui tranche.
*/
const MOTS_VIDES = new Set([
  'la', 'le', 'les', 'l', 'un', 'une', 'de', 'du', 'des', 'd', 'et', 'ou',
  'au', 'aux', 'a', 'en', 'dans', 'sur', 'pour', 'par', 'the',
]);

/**
 * Les chemins que la fiche a pu occuper.
 *
 * ## Pourquoi cette liste est longue, et pourquoi ce n'est pas un problème
 *
 * Le nom de fichier n'est **pas** dérivable du titre. Il en est une
 * abréviation choisie à la main : « La hiérarchie des normes et le contrôle de
 * constitutionnalité » s'est écrit `fiche-01-hierarchie-des-normes.md`. Aucune
 * règle ne produit ce nom-là ; en revanche, il est un **préfixe de mots** du
 * titre débarrassé de ses articles, et ça, ça s'énumère.
 *
 * On propose donc large : tous les préfixes de mots, deux traitements des
 * mots vides, plusieurs formes de dossier et de numéro. C'est sans danger,
 * et il faut le dire clairement : un candidat n'est retenu que si son
 * SHA-256 **tombe exactement** sur l'identifiant publié. Une proposition
 * fausse est rejetée, jamais acceptée par ressemblance. Proposer davantage
 * ne peut donc qu'augmenter ce qui est récupéré, et une fiche replacée à son
 * vrai chemin garde son identifiant — donc toute la progression enregistrée
 * pour elle.
 */
export function cheminsCandidats(f) {
  const racine = racineDuParcours(f.parcours);
  const mots = enTiret(f.titre).split('-').filter(Boolean);

  /* Deux listes de mots : articles de tête retirés seulement, puis tous les
     mots vides retirés. Les deux conventions existent dans le corpus. */
  const sansTete = [...mots];
  while (sansTete.length > 1 && MOTS_VIDES.has(sansTete[0])) sansTete.shift();
  const sansVides = sansTete.filter((m) => !MOTS_VIDES.has(m));

  const bases = new Set();
  for (const liste of [sansTete, sansVides, mots]) {
    for (let n = 1; n <= liste.length; n++) bases.add(liste.slice(0, n).join('-'));
  }

  /* Le dossier de fascicule : « Fascicule 1 — Sources et contrôle » devient
     « fascicule-1 » dans les chemins réels, mais le dépôt n'en fait pas une
     règle écrite — on essaie donc aussi la forme longue et le numéro seul. */
  const numeroFascicule = /(\d+)/.exec(f.fascicule)?.[1] ?? '';
  const dossiersFascicule = new Set([enTiret(f.fascicule)]);
  if (numeroFascicule) {
    dossiersFascicule.add(`fascicule-${numeroFascicule}`);
    dossiersFascicule.add(numeroFascicule);
  }

  const numeros = new Set([
    String(f.ordre).padStart(2, '0'),
    String(f.ordre),
    String(f.ordre).padStart(3, '0'),
  ]);

  const candidats = [];
  const matiere = enTiret(f.matiere);
  for (const fasc of dossiersFascicule) {
    for (const dossier of [`${matiere}/${fasc}`, matiere]) {
      for (const base of bases) {
        for (const n of numeros) {
          candidats.push(`${racine}${dossier}/fiche-${n}-${base}.md`);
          candidats.push(`${racine}${dossier}/${n}-${base}.md`);
        }
        candidats.push(`${racine}${dossier}/fiche-${base}.md`);
        candidats.push(`${racine}${dossier}/${base}.md`);
      }
    }
  }
  return [...new Set(candidats)];
}

/**
 * La même empreinte que `idStable`, en synchrone.
 *
 * `idStable` passe par `crypto.subtle.digest`, qui est asynchrone : une
 * promesse par candidat, et la recherche exhaustive ci-dessous en essaie des
 * millions. `node:crypto` donne le même SHA-256 sans promesse, et l'essai
 * « essais:recuperation-corpus » vérifie que les deux coïncident — sans quoi
 * cette optimisation chercherait silencieusement la mauvaise empreinte.
 */
export function empreinteRapide(texte, longueur = 16) {
  return createHash('sha256').update(texte, 'utf8').digest('hex').slice(0, longueur);
}

/*
   LES FORMES OBSERVÉES, MESURÉES SUR 284 CHEMINS CERTIFIÉS.

   Les 284 chemins que l'empreinte a certifiés sur le corpus réel ont tous la
   même forme : dossier « matiere/fascicule-N », fichier « fiche-NN-… ». La
   recherche exhaustive se concentre donc là, et la recherche large garde les
   autres formes au cas où une fiche ancienne en suive une autre.
*/

/**
 * Toutes les sous-suites ordonnées d'une liste de mots, de la plus longue à
 * la plus courte.
 *
 * ## Pourquoi des sous-suites, et pas seulement des préfixes
 *
 * Mesuré sur les 284 chemins certifiés : 157 noms sont le titre entier, 30 un
 * préfixe exact, et **97 une sous-suite ordonnée** — des mots retirés au
 * milieu, pas seulement à la fin. L'abréviation est choisie à la main et ne
 * suit pas de règle ; ce qu'elle respecte, en revanche, c'est l'ordre des
 * mots du titre. Et ça, ça s'énumère.
 *
 * On les rend de la plus longue à la plus courte : un nom long est plus
 * probable, et surtout moins ambigu.
 */
function* sousSuites(mots) {
  const n = mots.length;
  const combinaisons = [];
  for (let masque = 1; masque < 1 << n; masque++) {
    let bits = 0;
    for (let m = masque; m; m >>= 1) bits += m & 1;
    combinaisons.push([masque, bits]);
  }
  combinaisons.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [masque] of combinaisons) {
    const choisis = [];
    for (let i = 0; i < n; i++) if (masque & (1 << i)) choisis.push(mots[i]);
    yield choisis.join('-');
  }
}

/** Au-delà de ce nombre de mots, l'énumération exhaustive coûte trop. */
const MOTS_MAX = 18;

/**
 * Le nombre de candidats qu'on s'autorise par fiche.
 *
 * ## Pourquoi un plafond, et pourquoi il ne coûte presque rien
 *
 * Énumérer les sous-suites du DOSSIER et celles du NOM fait un produit : un
 * fascicule de dix mots et un titre de quatorze donnent cent cinquante
 * millions de candidats pour une seule fiche. Mesuré : la recherche ne rendait
 * plus la main.
 *
 * Et ce coût tombe entièrement sur les fiches qui vont échouer, puisqu'une
 * fiche qui se trouve se trouve tôt — les sous-suites sont rendues de la plus
 * longue à la plus courte, et le titre entier est la forme la plus fréquente.
 * Le plafond ne retire donc presque aucune trouvaille, et il rend la
 * récupération exécutable : une recherche parfaite qui n'aboutit pas ne
 * récupère rien du tout.
 */
const BUDGET_PAR_FICHE = 4_000_000;

/**
 * La recherche exhaustive, pour les fiches que la recherche large a manquées.
 *
 * ## Pourquoi c'est sans danger, même en forçant
 *
 * On éprouve beaucoup de candidats — jusqu'à 2^18 par fiche — mais on ne
 * RETIENT que celui dont le SHA-256 tombe exactement sur l'identifiant
 * publié. Le risque de faux positif est celui d'une collision sur 64 bits :
 * sur l'ordre du milliard de comparaisons que fait une récupération entière,
 * il est de l'ordre de 10^-11. C'est négligeable devant ce qu'on gagne — un
 * chemin certifié est la progression d'une fiche sauvée.
 */
export function chercherParSousSuites(id, fiche) {
  const mots = enTiret(fiche.titre).split('-').filter(Boolean);
  if (mots.length > MOTS_MAX) return null;

  const racine = racineDuParcours(fiche.parcours);
  const matiere = enTiret(fiche.matiere);
  const numeros = [
    String(fiche.ordre).padStart(2, '0'),
    String(fiche.ordre),
    String(fiche.ordre).padStart(3, '0'),
  ];

  /*
     LE DOSSIER EST ABRÉGÉ À LA MAIN, LUI AUSSI.

     Mesuré : « dgfip-a/organisation-dgfip/ » pour un fascicule intitulé
     « Organisation de la DGFiP ». Pas de « fascicule-N » du tout, et
     « organisation-dgfip » est une sous-suite du titre du fascicule — les
     mots du milieu retirés, exactement comme pour les noms de fiche.

     Ces deux chemins-là ont été retrouvés dans l'historique Git, pas
     dérivés ; c'est en les lisant qu'on a vu la règle. On énumère donc les
     deux côtés, et le produit reste petit parce qu'on essaie les sous-suites
     les plus longues d'abord.
  */
  const motsFascicule = enTiret(fiche.fascicule)
    .split('-')
    .filter((m) => m && m !== 'fascicule' && !/^\d+$/.test(m));
  const numeroFascicule = /(\d+)/.exec(fiche.fascicule)?.[1] ?? '';

  /*
     LE SEGMENT DE MATIÈRE N'EXISTE PAS TOUJOURS.

     Mesuré sur « dgfip-a/organisation-dgfip/fiche-01-… » : trois segments, et
     aucun pour la matière. La racine du parcours (« dgfip-a/ ») tient déjà ce
     rôle, et répéter la matière derrière elle donnerait
     « dgfip-a/dgfip-a/… », qui n'existe pas. On essaie donc les trois
     préfixes possibles — racine et matière, racine seule, matière seule — sans
     présumer lequel ce corpus a retenu.
  */
  const prefixes = [
    ...new Set(
      [`${racine}${matiere}`, racine.replace(/\/$/, ''), matiere].filter(Boolean),
    ),
  ];

  /* Les formes du dossier de fascicule, « aucun dossier » comprise. */
  const formesFascicule = [];
  if (numeroFascicule) {
    formesFascicule.push(`fascicule-${numeroFascicule}`, numeroFascicule);
  }
  if (motsFascicule.length && motsFascicule.length <= MOTS_MAX) {
    for (const abrege of sousSuites(motsFascicule)) {
      formesFascicule.push(abrege);
      if (numeroFascicule) formesFascicule.push(`fascicule-${numeroFascicule}-${abrege}`);
    }
  }
  formesFascicule.push('');

  const dossiers = [];
  for (const prefixe of prefixes) {
    for (const forme of formesFascicule) {
      dossiers.push(forme ? `${prefixe}/${forme}` : prefixe);
    }
  }

  let budget = BUDGET_PAR_FICHE;
  for (const dossier of [...new Set(dossiers)]) {
    for (const base of sousSuites(mots)) {
      for (const n of numeros) {
        if (budget-- <= 0) return null;
        const candidat = `${dossier}/fiche-${n}-${base}.md`;
        if (empreinteRapide(candidat) === id) return candidat;
      }
    }
  }
  return null;
}

/**
 * Le chemin certifié d'une fiche, ou `null`.
 *
 * Trois temps, du moins coûteux au plus coûteux :
 *
 *   1. la liste fournie par quelqu'un — une seule empreinte, et un chemin
 *      dont on se souvient vaut mieux qu'un chemin deviné ;
 *   2. les formes dérivables, quelques centaines de candidats ;
 *   3. l'énumération des sous-suites du titre, quand rien d'autre n'a pris.
 */
export async function retrouverLeChemin(id, fiche, fournis = new Map()) {
  const connu = fournis.get(id);
  if (connu) return { chemin: connu, certain: true, par: 'liste fournie' };

  for (const candidat of cheminsCandidats(fiche)) {
    if ((await idStable(candidat)) === id) return { chemin: candidat, certain: true, par: 'forme dérivée' };
  }

  const trouve = chercherParSousSuites(id, fiche);
  if (trouve) return { chemin: trouve, certain: true, par: 'sous-suite du titre' };

  return { chemin: null, certain: false, par: null };
}

/** Le chemin de repli, lisible, quand aucun candidat ne tombe juste. */
export function cheminDeRepli(fiche) {
  return path.posix.join(
    racineDuParcours(fiche.parcours) + enTiret(fiche.matiere),
    enTiret(fiche.fascicule),
    `fiche-${String(fiche.ordre).padStart(2, '0')}-${enTiret(fiche.titre)}.md`,
  );
}
