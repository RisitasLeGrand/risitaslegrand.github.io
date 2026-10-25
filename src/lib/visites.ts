/**
 * Le compteur de visites par écran — prompt 43, lot I, point 1.
 *
 * ## À quoi il sert, et à quoi il ne sert pas
 *
 * À choisir quoi améliorer d'abord. Un écran ouvert deux cents fois mérite
 * qu'on s'occupe de son bouton mal placé avant celui d'un écran ouvert trois
 * fois. C'est tout : il ne note aucun geste, aucun contenu, aucun instant.
 *
 * ## La frontière avec le journal d'usage, qui est le vrai sujet
 *
 * `odyssee/usage.ts` tient déjà un journal des sessions, et il REFUSE
 * nommément la route :
 *
 * > « Savoir que quelqu'un a ouvert Cyclades à 3 h est une information de
 * > rythme ; savoir qu'il a ouvert "Ma psyché" à 3 h est une information sur
 * > lui. »
 *
 * Ce module ne revient pas sur cette décision : il la respecte en se tenant
 * de l'autre côté de la ligne.
 *
 * - le journal d'usage garde **des heures, sans route**, en clair ;
 * - ce compteur garde **une route et un nombre, sans aucune date**, scellé.
 *
 * Aucun des deux ne dit « Psyché à 3 h ». Leur réunion non plus : il n'y a
 * rien à joindre, puisque ce compteur ne porte aucun instant. C'est la raison
 * pour laquelle aucune date n'est écrite ici, pas même scellée — ce qu'on
 * n'écrit pas ne fuit pas, et une date « pour plus tard » est précisément le
 * champ qu'on finit par joindre.
 *
 * ## Pourquoi la clé est tirée au hasard
 *
 * La tentation est d'indexer par la route, ou par son empreinte. Une route en
 * clair se lit sans rien ouvrir ; une empreinte de route se retrouve par
 * force brute, puisqu'il y a soixante routes et qu'elles sont publiques. La
 * clé ne porte donc RIEN : elle est tirée au hasard, et la route vit dans la
 * charge scellée.
 *
 * Le prix est qu'incrémenter demande d'ouvrir tous les enregistrements pour
 * retrouver le bon. Ils sont au plus soixante, cela se compte en
 * millisecondes, et c'est un prix qu'on paie une fois par visite.
 *
 * ## Il ne compte que coffre ouvert, et c'est dit à l'écran
 *
 * Écrire scellé demande la clé. Coffre fermé, la visite n'est pas comptée —
 * le compteur est donc un ÉCHANTILLON, et l'écran qui l'affiche l'écrit en
 * toutes lettres. Le journal d'usage a tranché l'inverse, en clair, pour la
 * même raison et en connaissance de cause ; ici, ce qui serait écrit est plus
 * parlant, donc on garde le sceau et l'on accepte de compter moins.
 *
 * ## Il ne voyage pas, et il n'entre dans aucune sauvegarde
 *
 * Pas d'opération au journal : deux appareils synchronisés ne doivent pas
 * échanger ce qu'ils regardent. Et pas de sauvegarde du tout — pas seulement
 * pas de sauvegarde en clair : une mesure de diagnostic qu'une restauration
 * ne rend pas ne manque à personne.
 */
import { db } from './db';
import { coffreOuvert, cleDuCoffre } from './coffre';

const MAGASIN = 'visites';

/** Une visite comptée : une route, un nombre, et rien d'autre. */
export interface Visite {
  /** Tiré au hasard. Il ne dit rien de la route — c'est tout son objet. */
  id: string;
  /** Le chemin de l'écran, sans paramètres ni ancre. */
  route: string;
  /** Combien de fois il a été ouvert, coffre ouvert. */
  compte: number;
}

/**
 * Les seuls champs qu'une visite a le droit de porter.
 *
 * **Le compteur porte une route sans instant ; le journal d'usage porte un
 * instant sans route ; et rien ne peut joindre les deux.** C'est la phrase
 * qui tient toute la discrétion de ce module, et elle ne tient que si aucun
 * des deux ne gagne le champ de l'autre.
 *
 * D'où cette liste blanche, calquée sur `CHAMPS_AUTORISES` d'`usage.ts` : la
 * règle vit dans des données qu'un essai peut lire, et non dans un
 * commentaire. Le jour où « juste une date, pour voir l'évolution »
 * paraîtra raisonnable, c'est ici qu'il faudra l'écrire — et l'essai
 * demandera pourquoi.
 */
export const CHAMPS_AUTORISES: readonly string[] = ['id', 'route', 'compte'];

export function controlerVisite(v: Visite): string[] {
  const problemes: string[] = [];
  for (const champ of Object.keys(v)) {
    if (!CHAMPS_AUTORISES.includes(champ)) {
      problemes.push(`« ${champ} » n’est pas un champ autorisé d’une visite.`);
    }
  }
  if (typeof v.route !== 'string' || !v.route.startsWith('/')) {
    problemes.push('La route doit être un chemin.');
  }
  if (!Number.isInteger(v.compte) || v.compte < 1) {
    problemes.push('Le compte doit être un entier positif.');
  }
  return problemes;
}

/**
 * La route d'une adresse, réduite à ce qui nomme un écran.
 *
 * Les paramètres sont retirés, et ce n'est pas de la cosmétique :
 * « /fiche/?id=8f66… » dirait QUELLE fiche a été lue, c'est-à-dire un
 * contenu. Seul le gabarit de l'écran est compté.
 */
export function routeDe(url: string, base = ''): string {
  try {
    const chemin = new URL(url, 'http://local').pathname;
    /* Le préfixe du site est retiré quand il en a un : « /cyclades/revisions »
       et « /revisions » sont le même écran, et deux lignes pour un écran
       fausseraient le classement que ce compteur sert à établir. Un préfixe
       vide ou réduit à « / » ne retire rien. */
    const prefixe = base.replace(/\/+$/, '');
    const sansBase = prefixe && chemin.startsWith(prefixe) ? chemin.slice(prefixe.length) : chemin;
    const propre = sansBase.replace(/\/+$/, '');
    return propre.startsWith('/') ? propre : `/${propre}`;
  } catch {
    return '/';
  }
}

/** Compte une visite. Ne lève jamais : un compteur ne casse pas un écran. */
export async function compterLaVisite(route: string): Promise<void> {
  try {
    if (!coffreOuvert()) return;
    const cle = cleDuCoffre();
    if (!cle) return;
    const { ouvrir, sceller } = await import('./noyau/coffre');
    const base = await db();
    const rangees = (await base.getAll(MAGASIN)) as unknown as Record<string, unknown>[];
    for (const rangee of rangees) {
      /* Même raison qu'à la lecture : un enregistrement d'une clé précédente
         ne doit pas empêcher de compter la visite d'aujourd'hui. */
      const visite = await ouvrir<Visite>(cle, rangee).catch(() => null);
      if (!visite || visite.route !== route) continue;
      const suivante: Visite = { id: visite.id, route: visite.route, compte: visite.compte + 1 };
      /* Le contrôle est sur le CHEMIN D'ÉCRITURE, et pas seulement dans un
         essai : un enregistrement lu d'une version future, qui porterait un
         champ de plus, ne doit pas être réécrit tel quel. */
      if (controlerVisite(suivante).length) return;
      const scellee = await sceller(
        cle,
        MAGASIN,
        suivante as unknown as Record<string, unknown>,
      );
      await base.put(MAGASIN, scellee as unknown as Visite);
      return;
    }
    const premiere: Visite = { id: crypto.randomUUID(), route, compte: 1 };
    if (controlerVisite(premiere).length) return;
    const neuve = await sceller(cle, MAGASIN, premiere as unknown as Record<string, unknown>);
    await base.put(MAGASIN, neuve as unknown as Visite);
  } catch {
    /*
       Une base pleine, un coffre refermé entre-temps, un magasin absent sur
       une version plus ancienne : rien de tout cela ne justifie d'abîmer la
       page qu'on vient d'ouvrir. La visite n'est pas comptée, et c'est tout.
    */
  }
}

/** Les visites comptées, de la plus fréquente à la moins. */
export async function visitesComptees(): Promise<Visite[]> {
  if (!coffreOuvert()) return [];
  const cle = cleDuCoffre();
  if (!cle) return [];
  const { ouvrir } = await import('./noyau/coffre');
  const base = await db();
  const rangees = (await base.getAll(MAGASIN)) as unknown as Record<string, unknown>[];
  /*
     UN ENREGISTREMENT ILLISIBLE NE DOIT PAS EMPORTER L'ÉCRAN.

     « Promise.all » rejette au premier refus, et un refus est possible : un
     enregistrement scellé sous une clé précédente — mot de passe changé,
     coffre refait — ne s'ouvrira plus jamais. Avec « all », la section
     entière tombait, et avec elle la page qui l'affiche, pour un compteur de
     diagnostic. On écarte ce qu'on ne sait pas lire, et le reste s'affiche.
  */
  const lues = await Promise.all(
    rangees.map((r) => ouvrir<Visite>(cle, r).catch(() => null)),
  );
  const visites = lues.filter((v): v is Visite => v !== null);
  return visites.sort((a, b) => b.compte - a.compte || a.route.localeCompare(b.route));
}

/** Efface tout le compteur. L'effacement par groupe passe, lui, par `groupes.ts`. */
export async function oublierLesVisites(): Promise<void> {
  await (await db()).clear(MAGASIN);
}
