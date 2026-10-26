/**
 * Où la forme « jour(s) » se cache dans une source — G4 du 61.
 *
 * ## Pourquoi cette règle est partagée, et non recopiée
 *
 * C'est la leçon de `lib/sans-commentaires.mjs`, et elle vaut ici pour la
 * même raison : deux outils ont besoin de ce repérage — l'essai qui REFUSE la
 * forme, et l'inventaire qui la liste pour qu'on la corrige fichier par
 * fichier. Deux copies finiraient par diverger, et l'inventaire dirait alors
 * autre chose que le refus.
 *
 * ## Ce qu'il regarde, et ce qu'il laisse tranquille
 *
 * Le TEXTE seulement, hors commentaires. Un commentaire qui parle de la forme
 * interdite n'est pas une infraction, et `tableau.filter((s) => …)` n'est pas
 * une phrase. Un contrôle qui accuse à tort se fait désactiver, et c'est ainsi
 * qu'on perd un garde-fou.
 */
import { sansCommentaires } from './sans-commentaires.mjs';

/** Une lettre collée à « (s) » ou « (es) » : `jour(s)`, `écrit(es)`. */
export const COLLE = /\p{L}\((s|es)\)/gu;

/**
 * Une chaîne réduite à la forme interdite.
 *
 * Ce second motif ferme un contournement : `` `${mot}${n > 1 ? '(s)' : ''}` ``
 * assemble la forme à l'exécution, et le premier motif n'y verrait rien.
 */
export const SEULE = /^\s*\((s|es)\)\s*$/;

/**
 * Les morceaux de TEXTE d'une source, avec leur ligne.
 *
 * ## Un seul passage, et l'état traverse les lignes
 *
 * La première version lisait ligne à ligne, et deux contrôles de garde l'ont
 * prise en faute :
 *
 * - un gabarit sur PLUSIEURS lignes échappait entièrement. Le guillemet
 *   ouvrant est à la première ligne, les suivantes n'en portent aucun : le
 *   balayage n'y voyait donc pas de texte. Or ce sont les textes les plus
 *   longs, c'est-à-dire les plus lus ;
 * - une chaîne IMBRIQUÉE dans une interpolation passait aussi : tout ce qui
 *   suivait le premier accent grave était compté comme un seul bloc.
 *
 * D'où un passage unique, avec une pile : dans un gabarit, une interpolation
 * redevient du CODE, où un guillemet rouvre une chaîne à son tour.
 *
 * Ce n'est pas un analyseur de TypeScript et ça ne cherche pas à l'être : une
 * expression régulière portant un guillemet le tromperait. On ne lui demande
 * que de distinguer le texte du code, assez bien pour ne jamais accuser à
 * tort.
 */
function morceauxDeTexte(source) {
  const morceaux = [];
  const pile = [];
  let i = 0;
  let ligne = 1;
  let debutLigne = 1;
  let courant = '';

  const fermer = () => {
    if (courant) morceaux.push({ ligne: debutLigne, texte: courant });
    courant = '';
  };

  while (i < source.length) {
    const c = source[i];
    const dedans = pile[pile.length - 1];
    if (c === '\n') ligne += 1;

    if (dedans === "'" || dedans === '"' || dedans === '`') {
      if (c === '\\') {
        courant += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === dedans) {
        fermer();
        pile.pop();
        i += 1;
        continue;
      }
      if (dedans === '`' && source.slice(i, i + 2) === '${') {
        fermer();
        pile.push('$');
        i += 2;
        continue;
      }
      courant += c;
      i += 1;
      continue;
    }

    /* Ici l'on est dans du code : au premier niveau, ou dans une interpolation. */
    if (c === '}' && dedans === '$') {
      pile.pop();
      debutLigne = ligne;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      pile.push(c);
      debutLigne = ligne;
      courant = '';
      i += 1;
      continue;
    }
    i += 1;
  }
  fermer();
  return morceaux;
}

/** Les sites de la forme interdite, dans le TEXTE d'une source. */
export function sitesInterdits(source) {
  const sites = [];
  for (const { ligne, texte } of morceauxDeTexte(sansCommentaires(source).join('\n'))) {
    const combien = [...texte.matchAll(COLLE)].length + (SEULE.test(texte) ? 1 : 0);
    for (let k = 0; k < combien; k += 1) {
      sites.push({ ligne, texte: texte.replace(/\s+/g, ' ').trim().slice(0, 120) });
    }
  }
  return sites;
}
