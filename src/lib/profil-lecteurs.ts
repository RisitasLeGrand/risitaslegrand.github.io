/**
 * Qui lit un champ de profil, dit en français — les deux sources réunies.
 *
 * ## Pourquoi deux sources, et une seule ligne
 *
 * L'âge avait déjà sa table de lecteurs, et elle est ailleurs :
 * `noyau/registre-usages.ts` nomme chaque usage, ce qu'il lit, à quoi il sert
 * et ce qu'il fait quand il ne sait pas. C'est ce que montre l'écran « Qui
 * utilise mon âge », et c'est le fichier de qui construit le cycle. En écrire
 * une seconde au catalogue aurait fait deux vérités du même fait.
 *
 * Les autres champs n'en avaient aucune, et la portée « Lisible par » qui en
 * tenait lieu ne restreignait rien : leur table est au catalogue, champ par
 * champ, avec son essai à double sens.
 *
 * Ce module réunit les deux pour l'écran, et ne décide de rien : il ne nomme
 * aucun champ, il lit des déclarations. C'est aussi ce qui lui permet de vivre
 * hors des six fichiers autorisés à nommer les champs de naissance.
 *
 * ## Ce qu'il ne montre pas
 *
 * Les usages marqués sensibles. 2.6 du prompt de l'âge le demande : l'écran ne
 * révèle pas l'existence d'un suivi du cycle à quelqu'un qui regarde
 * par-dessus l'épaule. Aucun usage ne lit ces clés aujourd'hui, et la règle
 * s'écrit maintenant pour que le premier qui arrivera soit couvert sans que
 * personne ait à y penser.
 */
import type { ChampDeclare } from './noyau/profil';
import { estSensible, usagesLisant } from './noyau/registre-usages';

/** « Profil, Santé et Psyché » : l'énumération française, avec son « et ». */
export function enumerer(mots: readonly string[]): string {
  if (mots.length <= 1) return mots[0] ?? '';
  return `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}`;
}

export interface LecteursDuRegistre {
  /** Les rubriques dont l'usage marche aujourd'hui. */
  livrables: string[];
  /** Combien attendent une source qu'on ne sait pas encore atteindre. */
  enAttente: number;
}

/**
 * Les rubriques du registre qui lisent les clés d'un champ.
 *
 * ## Les livrables et celles qui attendent, séparées
 *
 * Six usages sur treize reposent sur une source que cet environnement ne sait
 * pas atteindre, et le registre le déclare — `fondement: 'source-a-obtenir'`.
 * Les compter avec les autres ferait dire à la ligne « Lu par » que sept
 * rubriques lisent votre âge, alors que cinq le font. La différence est la
 * seule chose qui compte ici : une liste de ce que Cyclades **fait**, et non de
 * ce qu'il **pourrait** faire.
 *
 * Les rubriques sortent dans l'ordre du registre, sans doublon : deux usages de
 * la même rubrique ne font qu'une mention, parce que la personne cherche un
 * endroit de Cyclades et non un identifiant d'usage.
 */
export function rubriquesDuRegistre(cles: readonly string[]): LecteursDuRegistre {
  const livrables: string[] = [];
  let enAttente = 0;
  const vus = new Set<string>();
  for (const cle of cles) {
    for (const u of usagesLisant(cle as never)) {
      if (estSensible(u) || vus.has(u.id)) continue;
      vus.add(u.id);
      if (u.fondement.type === 'source-a-obtenir') {
        enAttente += 1;
        continue;
      }
      for (const rubrique of u.rubrique.split(',').map((r) => r.trim())) {
        if (rubrique && !livrables.includes(rubrique)) livrables.push(rubrique);
      }
    }
  }
  return { livrables, enAttente };
}

/**
 * Ce que l'écran affiche après « Lu par : », ou rien.
 *
 * Rien, et non « personne » : un champ que rien ne lit n'affiche pas de ligne
 * (P3). La mention de l'export n'est pas ici — elle est dite une fois, au
 * paragraphe Confidentialité, et par champ sous une autre forme : l'y répéter
 * sur trente champs noierait les lecteurs réels.
 */
export function lecteursDuChamp(declare: ChampDeclare): string[] {
  if (declare.clesDuRegistre?.length) {
    const { livrables, enAttente } = rubriquesDuRegistre(declare.clesDuRegistre);
    const attente =
      enAttente === 0
        ? ''
        : enAttente === 1
          ? ', et un autre qui attend une source'
          : `, et ${enAttente} autres qui attendent une source`;
    if (!livrables.length) {
      return enAttente
        ? ['des usages de votre âge qui attendent une source, listés dans Qui utilise mon âge']
        : [];
    }
    return [
      `les usages de votre âge dans ${enumerer(livrables)}${attente}` +
        (attente ? ' — tous listés dans Qui utilise mon âge' : ', listés dans Qui utilise mon âge'),
    ];
  }
  return [...new Set((declare.luPar ?? []).map((l) => l.libelle))];
}
