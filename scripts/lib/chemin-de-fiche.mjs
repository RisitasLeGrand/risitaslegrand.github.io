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
 * Le chemin certifié d'une fiche, ou `null`.
 *
 * `fournis` est une liste de chemins connus par ailleurs — une sauvegarde, une
 * vieille sortie de `ls -R`. Elle est éprouvée d'abord : un chemin que
 * quelqu'un se rappelle vaut mieux qu'un chemin deviné, et il coûte une seule
 * empreinte.
 */
export async function retrouverLeChemin(id, fiche, fournis = new Map()) {
  const connu = fournis.get(id);
  if (connu) return { chemin: connu, certain: true, essais: 0 };
  const candidats = cheminsCandidats(fiche);
  let essais = 0;
  for (const candidat of candidats) {
    essais += 1;
    if ((await idStable(candidat)) === id) return { chemin: candidat, certain: true, essais };
  }
  return { chemin: null, certain: false, essais };
}

/** Le chemin de repli, lisible, quand aucun candidat ne tombe juste. */
export function cheminDeRepli(fiche) {
  return path.posix.join(
    racineDuParcours(fiche.parcours) + enTiret(fiche.matiere),
    enTiret(fiche.fascicule),
    `fiche-${String(fiche.ordre).padStart(2, '0')}-${enTiret(fiche.titre)}.md`,
  );
}
