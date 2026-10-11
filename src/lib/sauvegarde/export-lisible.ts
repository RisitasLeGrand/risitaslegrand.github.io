/**
 * L'export lisible : du CSV et du JSON qu'un tableur ou un éditeur ouvre.
 *
 * ## Pourquoi il existe à côté de la sauvegarde `.cyclades`
 *
 * Ils ne servent pas à la même chose, et les confondre serait rendre les deux
 * mauvais.
 *
 * La sauvegarde `.cyclades` sert à **revenir en arrière** : elle est chiffrée,
 * compressée, exhaustive, et illisible par tout ce qui n'est pas Cyclades.
 * C'est exactement ce qu'on veut d'une archive.
 *
 * L'export lisible sert à **partir** : emporter ses données ailleurs, les
 * regarder dans un tableur, les donner à un autre outil. Il est donc en clair,
 * partiel, et ne sait pas se réimporter. C'est la portabilité, pas la
 * sauvegarde — et l'interface doit le dire, parce que confondre les deux, c'est
 * croire qu'on a sauvegardé.
 *
 * ## Les conventions françaises, et pourquoi elles ne sont pas un détail
 *
 * Un CSV séparé par des virgules, avec des points décimaux et sans BOM,
 * s'ouvre dans Excel en français comme **une seule colonne de texte**. Le
 * fichier est juste et inutilisable. Les conventions retenues sont donc celles
 * que la machine de la personne attend :
 *
 * - séparateur **point-virgule** ;
 * - virgule décimale ;
 * - **BOM UTF-8**, sans quoi les accents arrivent abîmés ;
 * - fins de ligne CRLF, comme la norme CSV le demande ;
 * - dates laissées en ISO (`AAAA-MM-JJ`), qui se trient correctement partout.
 */
import { exporterMagasins } from '../db';
import { GROUPES, groupe, type GroupeDeMagasins } from './groupes';

/* ══════════════════════════════════════════════════════════════════════════
   Aplatissement
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Aplatit un enregistrement en colonnes.
 *
 * Les objets imbriqués deviennent `parent.enfant` — l'état FSRS d'une carte
 * donne `fsrs.stability`, `fsrs.difficulty`. Les tableaux et les dictionnaires
 * de texte libre sont rendus en JSON dans une seule cellule : les étaler en
 * colonnes donnerait un tableau dont la largeur dépend de la ligne la plus
 * bavarde, ce qu'aucun tableur ne sait lire.
 */
export function aplatir(valeur: unknown, prefixe = ''): Record<string, string> {
  const sortie: Record<string, string> = {};
  if (valeur === null || valeur === undefined) {
    if (prefixe) sortie[prefixe] = '';
    return sortie;
  }
  if (Array.isArray(valeur)) {
    sortie[prefixe] = JSON.stringify(valeur);
    return sortie;
  }
  if (typeof valeur === 'object') {
    const entrees = Object.entries(valeur as Record<string, unknown>);
    // Un dictionnaire dont les valeurs sont du texte libre — les restitutions
    // d'une séance — n'a pas de colonnes stables : il reste un bloc.
    const estTexteLibre =
      entrees.length > 0 && entrees.every(([, v]) => typeof v === 'string' && v.length > 120);
    if (estTexteLibre) {
      sortie[prefixe] = JSON.stringify(valeur);
      return sortie;
    }
    for (const [clef, v] of entrees) {
      Object.assign(sortie, aplatir(v, prefixe ? `${prefixe}.${clef}` : clef));
    }
    return sortie;
  }
  sortie[prefixe] = String(valeur);
  return sortie;
}

/* ══════════════════════════════════════════════════════════════════════════
   CSV
   ══════════════════════════════════════════════════════════════════════════ */

const SEPARATEUR = ';';
const FIN_DE_LIGNE = '\r\n';
export const BOM = '﻿';

/** Une cellule, échappée selon la norme CSV. */
function cellule(brut: string): string {
  // La virgule décimale est la convention française ; elle oblige à citer,
  // puisque le séparateur est le point-virgule mais que la virgule reste un
  // signe que certains tableurs traitent à part.
  const valeur = /^-?\d+\.\d+$/.test(brut) ? brut.replace('.', ',') : brut;
  if (!/[";\r\n,]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/**
 * Un magasin en CSV.
 *
 * Les colonnes sont l'union de toutes les clés rencontrées, dans l'ordre de
 * première apparition. Prendre celles du premier enregistrement serait plus
 * simple et perdrait les champs optionnels — `pretesteeLe` n'existe que sur les
 * fiches prétestées, et une fiche non prétestée en tête de liste suffirait à
 * faire disparaître la colonne pour tout le monde.
 */
export function versCsv(enregistrements: readonly unknown[]): string {
  if (!enregistrements.length) return '';
  const lignes = enregistrements.map((e) => aplatir(e));
  const colonnes: string[] = [];
  for (const ligne of lignes) {
    for (const clef of Object.keys(ligne)) if (!colonnes.includes(clef)) colonnes.push(clef);
  }
  const entete = colonnes.map(cellule).join(SEPARATEUR);
  const corps = lignes.map((ligne) =>
    colonnes.map((c) => cellule(ligne[c] ?? '')).join(SEPARATEUR),
  );
  return BOM + [entete, ...corps].join(FIN_DE_LIGNE) + FIN_DE_LIGNE;
}

/* ══════════════════════════════════════════════════════════════════════════
   Export d'un groupe
   ══════════════════════════════════════════════════════════════════════════ */

export interface FichierExporte {
  nom: string;
  type: string;
  contenu: string;
  enregistrements: number;
}

const horodatageDeNom = (quand: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${quand.getFullYear()}-${p(quand.getMonth() + 1)}-${p(quand.getDate())}-${p(quand.getHours())}${p(quand.getMinutes())}`;
};

/**
 * Exporte un groupe en CSV : un fichier par magasin.
 *
 * Un seul fichier pour tout le groupe demanderait de mélanger des lignes qui
 * n'ont pas les mêmes colonnes, ce qui donne un tableau illisible. Un magasin
 * vide ne produit pas de fichier.
 */
export async function exporterGroupeCsv(
  idGroupe: string,
  quand = new Date(),
): Promise<FichierExporte[]> {
  const g = groupe(idGroupe);
  if (!g) throw new Error(`Groupe inconnu : ${idGroupe}`);
  const magasins = await exporterMagasins(g.magasins);
  const date = horodatageDeNom(quand);
  return Object.entries(magasins)
    .filter(([, enregistrements]) => enregistrements.length > 0)
    .map(([nom, enregistrements]) => ({
      nom: `cyclades-${g.id}-${nom}-${date}.csv`,
      type: 'text/csv;charset=utf-8',
      contenu: versCsv(enregistrements),
      enregistrements: enregistrements.length,
    }));
}

/**
 * Exporte un groupe en JSON lisible.
 *
 * Un seul fichier, indenté, avec un en-tête qui dit ce qu'il contient et quand
 * il a été fait — un export sans sa date ne vaut rien six mois plus tard.
 */
export async function exporterGroupeJson(
  idGroupe: string,
  quand = new Date(),
): Promise<FichierExporte> {
  const g = groupe(idGroupe);
  if (!g) throw new Error(`Groupe inconnu : ${idGroupe}`);
  const magasins = await exporterMagasins(g.magasins);
  const total = Object.values(magasins).reduce((s, v) => s + v.length, 0);
  const contenu = JSON.stringify(
    {
      format: 'cyclades-export-lisible',
      version: 1,
      avertissement:
        'Export de portabilité, en clair et non réimportable. Pour restaurer, utilisez une sauvegarde .cyclades.',
      groupe: g.id,
      libelle: g.libelle,
      exporteLe: quand.toISOString(),
      magasins,
    },
    null,
    2,
  );
  return {
    nom: `cyclades-${g.id}-${horodatageDeNom(quand)}.json`,
    type: 'application/json;charset=utf-8',
    contenu,
    enregistrements: total,
  };
}

/** Le compte d'enregistrements par groupe, pour l'écran de choix. */
export async function comptesParGroupe(): Promise<Map<string, number>> {
  const sortie = new Map<string, number>();
  for (const g of GROUPES) {
    const magasins = await exporterMagasins(g.magasins);
    sortie.set(
      g.id,
      Object.values(magasins).reduce((s, v) => s + v.length, 0),
    );
  }
  return sortie;
}

export type { GroupeDeMagasins };
