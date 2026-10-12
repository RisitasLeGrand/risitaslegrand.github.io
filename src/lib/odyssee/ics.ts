/**
 * Lire et écrire de l'iCalendar, à la main.
 *
 * ## Pourquoi à la main, et pas une bibliothèque
 *
 * Les bibliothèques ICS sérieuses pèsent de 50 à 200 ko et implémentent des
 * récurrences, des fuseaux embarqués, des alarmes, des pièces jointes. Ce que
 * le calendrier d'Odyssée échange, c'est un titre, un début, une fin, un lieu
 * et une note. Le reste de la norme serait du code qu'aucun écran n'appelle, et
 * du poids ajouté à chaque chargement de page pour un import qu'on fait trois
 * fois par an.
 *
 * Le prix de ce choix est réel et il est dit ici plutôt que caché : **les
 * règles de récurrence ne sont pas comprises** (`RRULE`), et une série
 * d'événements est importée comme son seul premier terme. Les événements
 * concernés sont **comptés et nommés** dans le rapport d'import, de sorte que
 * la personne sache ce qui manque au lieu de le découvrir un mois plus tard.
 *
 * ## Ce que la norme impose et qu'on ne peut pas sauter
 *
 * | Règle | Pourquoi elle n'est pas négociable |
 * |---|---|
 * | Lignes terminées par `CRLF` | Un agenda qui ne reçoit que `LF` refuse le fichier entier |
 * | Pliage à 75 octets | Les lignes longues sont coupées, et une lecture naïve perdrait la suite |
 * | Échappement de `\\ ; , ` et du saut de ligne | Un titre contenant une virgule casserait le champ |
 * | `UID` stable | C'est lui qui fait d'un réimport une mise à jour et non un doublon |
 *
 * ## Le temps
 *
 * On écrit en **UTC** (`...Z`), toujours. Écrire une heure locale obligerait à
 * embarquer une définition de fuseau — une `VTIMEZONE` complète avec ses règles
 * de passage à l'heure d'été — et c'est là que les implémentations divergent le
 * plus. À la lecture, on accepte l'UTC, l'heure flottante (sans suffixe,
 * interprétée comme locale) et les dates seules (`VALUE=DATE`, journée
 * entière).
 */
import type { Evenement } from './modele';
import type { IdDomaine } from '../noyau/domaines';

export const PRODID = '-//Cyclades//Odyssee//FR';

/* ══════════════════════════════════════════════════════════════════════════
   Écriture
   ══════════════════════════════════════════════════════════════════════════ */

/** Échappe un texte pour un champ ICS. L'ordre compte : la barre d'abord. */
export function echapperIcs(texte: string): string {
  return texte
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Plie une ligne à 75 **octets**, et non à 75 caractères.
 *
 * La norme compte en octets, et un « é » en pèse deux : plier au caractère
 * produirait des lignes trop longues pour les lecteurs stricts. Et la coupe ne
 * doit jamais tomber au milieu d'un caractère multi-octets, sans quoi le
 * fichier devient illisible — d'où la découpe par points de code, avec un
 * budget d'octets.
 */
export function plier(ligne: string): string {
  const octets = (s: string) => new TextEncoder().encode(s).length;
  if (octets(ligne) <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = '';
  let budget = 75;
  for (const caractere of ligne) {
    if (octets(courant) + octets(caractere) > budget) {
      morceaux.push(courant);
      // Les lignes de continuation commencent par une espace, qui compte.
      courant = caractere;
      budget = 74;
    } else {
      courant += caractere;
    }
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

/** Un instant ISO vers la forme ICS en UTC : `20261012T090000Z`. */
export function versIcs(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Un jour logique vers la forme ICS de date seule : `20261012`. */
export const jourVersIcs = (jour: string) => jour.replace(/-/g, '');

/**
 * Le fichier `.ics` d'une liste d'événements.
 *
 * `DTSTAMP` est l'instant de l'export, `UID` l'identité de l'événement.
 * Réexporter puis réimporter doit **mettre à jour** et non dupliquer : c'est
 * l'`UID` qui le permet, et c'est pourquoi un événement saisi dans Cyclades
 * reçoit un UID dérivé de son identifiant plutôt qu'un tirage.
 */
export function versFichierIcs(evenements: readonly Evenement[], maintenant = new Date()): string {
  const lignes: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
  ];
  const horodatage = versIcs(maintenant.toISOString());

  for (const e of evenements) {
    lignes.push('BEGIN:VEVENT');
    lignes.push(`UID:${e.uidIcs ?? `${e.id}@cyclades`}`);
    lignes.push(`DTSTAMP:${horodatage}`);
    if (e.journeeEntiere) {
      /*
         Une journée entière s'écrit en dates seules, et `DTEND` est le jour
         **suivant** : la norme le veut exclusif. Écrire le même jour des deux
         côtés produit un événement de durée nulle, que certains agendas
         n'affichent pas du tout.
      */
      const debut = e.debut.slice(0, 10);
      const lendemain = new Date(Date.parse(`${debut}T00:00:00.000Z`) + 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      lignes.push(`DTSTART;VALUE=DATE:${jourVersIcs(debut)}`);
      lignes.push(`DTEND;VALUE=DATE:${jourVersIcs(lendemain)}`);
    } else {
      lignes.push(`DTSTART:${versIcs(e.debut)}`);
      lignes.push(`DTEND:${versIcs(e.fin)}`);
    }
    lignes.push(`SUMMARY:${echapperIcs(e.titre)}`);
    if (e.lieu) lignes.push(`LOCATION:${echapperIcs(e.lieu)}`);
    if (e.note) lignes.push(`DESCRIPTION:${echapperIcs(e.note)}`);
    /*
       Le domaine voyage dans une propriété **privée** (préfixe `X-`), qui est
       le mécanisme que la norme prévoit pour cela. Un agenda étranger
       l'ignorera ; Cyclades, en se réimportant lui-même, le retrouvera. Le
       mettre dans les catégories aurait pollué un champ que les autres
       agendas affichent.
    */
    lignes.push(`X-CYCLADES-DOMAINE:${e.domaine}`);
    lignes.push('END:VEVENT');
  }

  lignes.push('END:VCALENDAR');
  // CRLF partout, y compris à la fin : un fichier sans CRLF final est refusé.
  return lignes.map(plier).join('\r\n') + '\r\n';
}

/* ══════════════════════════════════════════════════════════════════════════
   Lecture
   ══════════════════════════════════════════════════════════════════════════ */

/** Déplie les lignes de continuation, qui commencent par une espace ou une tabulation. */
export function deplier(texte: string): string[] {
  const brutes = texte.split(/\r\n|\n|\r/);
  const lignes: string[] = [];
  for (const ligne of brutes) {
    if ((ligne.startsWith(' ') || ligne.startsWith('\t')) && lignes.length) {
      lignes[lignes.length - 1] += ligne.slice(1);
    } else {
      lignes.push(ligne);
    }
  }
  return lignes;
}

/** Défait l'échappement d'un champ. L'ordre est l'inverse de l'échappement. */
export function desechapperIcs(texte: string): string {
  let resultat = '';
  for (let i = 0; i < texte.length; i += 1) {
    if (texte[i] !== '\\') {
      resultat += texte[i];
      continue;
    }
    const suivant = texte[i + 1];
    if (suivant === 'n' || suivant === 'N') resultat += '\n';
    else if (suivant === undefined) resultat += '\\';
    else resultat += suivant;
    i += 1;
  }
  return resultat;
}

/**
 * Une valeur de date ICS vers un instant ISO.
 *
 * Trois formes acceptées : `20261012T090000Z` (UTC), `20261012T090000` (heure
 * flottante, prise pour locale) et `20261012` (date seule). Rend `null` sur
 * tout le reste plutôt que de deviner : un `null` est signalé à l'import, une
 * devinette passe inaperçue.
 */
export function depuisIcs(valeur: string): { iso: string; dateSeule: boolean } | null {
  const propre = valeur.trim();
  const dateSeule = /^(\d{4})(\d{2})(\d{2})$/.exec(propre);
  if (dateSeule) {
    const [, a, m, j] = dateSeule;
    return { iso: `${a}-${m}-${j}T00:00:00.000Z`, dateSeule: true };
  }
  const complet = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(propre);
  if (!complet) return null;
  const [, a, m, j, h, mi, s, z] = complet;
  if (z === 'Z') {
    return { iso: `${a}-${m}-${j}T${h}:${mi}:${s}.000Z`, dateSeule: false };
  }
  /*
     Heure flottante : la norme dit « l'heure locale du lecteur ». On la
     construit donc avec le constructeur local, puis on la rend en ISO — ce
     qui la fige à l'instant absolu correspondant, dans le fuseau de la
     machine qui importe. C'est la seule interprétation conforme, et elle
     dépend du lieu : c'est pourquoi l'export, lui, écrit toujours en UTC.
  */
  const local = new Date(Number(a), Number(m) - 1, Number(j), Number(h), Number(mi), Number(s));
  return { iso: local.toISOString(), dateSeule: false };
}

export interface EvenementImporte {
  uid: string;
  titre: string;
  debut: string;
  fin: string;
  journeeEntiere: boolean;
  lieu: string;
  note: string;
  /** Le domaine, s'il vient d'un export Cyclades. */
  domaine: IdDomaine | null;
}

export interface RapportImport {
  evenements: EvenementImporte[];
  /** Ce qui a été écarté, et pourquoi — jamais en silence. */
  ecartes: { quoi: string; pourquoi: string }[];
  /** Les séries dont seul le premier terme est importé. */
  recurrents: string[];
}

/**
 * Lit un fichier `.ics`.
 *
 * Tolérant sur la forme, strict sur le contenu : les lignes inconnues sont
 * ignorées sans bruit — la norme en prévoit des dizaines —, mais un événement
 * sans date exploitable est **écarté et dit**, pas importé avec une date
 * inventée.
 */
export function lireIcs(texte: string): RapportImport {
  const lignes = deplier(texte);
  const evenements: EvenementImporte[] = [];
  const ecartes: RapportImport['ecartes'] = [];
  const recurrents: string[] = [];

  let courant: Record<string, { valeur: string; parametres: string }> | null = null;

  for (const ligne of lignes) {
    const nue = ligne.trim();
    if (nue === 'BEGIN:VEVENT') {
      courant = {};
      continue;
    }
    if (nue === 'END:VEVENT') {
      if (courant) finir(courant);
      courant = null;
      continue;
    }
    if (!courant) continue;

    const separateur = ligne.indexOf(':');
    if (separateur < 0) continue;
    const gauche = ligne.slice(0, separateur);
    const valeur = ligne.slice(separateur + 1);
    const pointVirgule = gauche.indexOf(';');
    const nom = (pointVirgule < 0 ? gauche : gauche.slice(0, pointVirgule)).toUpperCase();
    const parametres = pointVirgule < 0 ? '' : gauche.slice(pointVirgule + 1).toUpperCase();
    courant[nom] = { valeur, parametres };
  }

  function finir(champs: Record<string, { valeur: string; parametres: string }>) {
    const titre = desechapperIcs(champs.SUMMARY?.valeur ?? '').trim();
    const nom = titre || '(sans titre)';

    const debutBrut = champs.DTSTART;
    if (!debutBrut) {
      ecartes.push({ quoi: nom, pourquoi: 'Aucune date de début.' });
      return;
    }
    const debut = depuisIcs(debutBrut.valeur);
    if (!debut) {
      ecartes.push({ quoi: nom, pourquoi: `Date de début illisible : « ${debutBrut.valeur} ».` });
      return;
    }
    const journeeEntiere = debut.dateSeule || debutBrut.parametres.includes('VALUE=DATE');

    /*
       Pas de `DTEND` ? La norme autorise `DURATION`, et à défaut un événement
       ponctuel. On ne lit pas `DURATION` — même raison que pour `RRULE` — et
       l'on pose alors une fin égale au début : un jalon, ce que `modele.ts`
       accepte explicitement.
    */
    let fin = debut.iso;
    const finBrute = champs.DTEND;
    if (finBrute) {
      const lue = depuisIcs(finBrute.valeur);
      if (!lue) {
        ecartes.push({ quoi: nom, pourquoi: `Date de fin illisible : « ${finBrute.valeur} ».` });
        return;
      }
      fin = lue.iso;
      /*
         `DTEND` d'une journée entière est **exclusif** : le ramener d'un jour
         rend la fin inclusive, qui est la convention interne. Sans cela, un
         événement d'une journée en occuperait deux.
      */
      if (journeeEntiere && lue.dateSeule) {
        fin = new Date(Date.parse(lue.iso) - 24 * 3600 * 1000).toISOString();
      }
    }

    if (Date.parse(fin) < Date.parse(debut.iso)) {
      ecartes.push({ quoi: nom, pourquoi: 'La fin précède le début.' });
      return;
    }

    if (champs.RRULE) recurrents.push(nom);

    const domaine = champs['X-CYCLADES-DOMAINE']?.valeur?.trim() || null;
    evenements.push({
      uid: champs.UID?.valeur?.trim() || '',
      titre: nom,
      debut: debut.iso,
      fin,
      journeeEntiere,
      lieu: desechapperIcs(champs.LOCATION?.valeur ?? '').trim(),
      note: desechapperIcs(champs.DESCRIPTION?.valeur ?? '').trim(),
      domaine,
    });
  }

  return { evenements, ecartes, recurrents };
}

/* ══════════════════════════════════════════════════════════════════════════
   Le rapprochement
   ══════════════════════════════════════════════════════════════════════════ */

export interface Rapprochement {
  /** Événements à écrire, déjà fusionnés avec l'existant quand l'UID correspond. */
  aEcrire: (Omit<Evenement, 'majLe'> & { id: string })[];
  nouveaux: number;
  misAJour: number;
  /** Importés sans domaine, placés dans le domaine de repli. */
  sansDomaine: number;
}

/**
 * Rapproche un import de ce qui est déjà en base.
 *
 * **L'`UID` fait l'identité.** Réimporter le même agenda met à jour les
 * événements connus au lieu de les dupliquer — c'est la seule propriété qui
 * rende l'import utilisable plus d'une fois. Un événement **saisi à la main**
 * n'a pas d'`uidIcs` : il ne peut donc jamais être écrasé par un import, ce
 * qui le protège exactement comme il faut.
 *
 * Un import sans domaine tombe dans `domaineParDefaut` : un événement sans
 * domaine ne compterait dans aucune roue, et serait perdu de vue.
 */
export function rapprocher(
  importes: readonly EvenementImporte[],
  existants: readonly Evenement[],
  options: { domaineParDefaut: IdDomaine; nouvelId: () => string },
): Rapprochement {
  const parUid = new Map<string, Evenement>();
  for (const e of existants) {
    if (e.uidIcs) parUid.set(e.uidIcs, e);
  }

  const aEcrire: Rapprochement['aEcrire'] = [];
  let nouveaux = 0;
  let misAJour = 0;
  let sansDomaine = 0;

  for (const importe of importes) {
    const connu = importe.uid ? parUid.get(importe.uid) : undefined;
    if (!importe.domaine) sansDomaine += 1;
    /*
       Le domaine d'un événement déjà connu **n'est pas écrasé** par l'import :
       la personne a pu le reclasser à la main, et un réimport annuel ne doit
       pas défaire ce travail. L'import n'impose son domaine que s'il en porte
       un explicitement.
    */
    const domaine = importe.domaine ?? connu?.domaine ?? options.domaineParDefaut;
    aEcrire.push({
      id: connu?.id ?? options.nouvelId(),
      titre: importe.titre,
      domaine,
      debut: importe.debut,
      fin: importe.fin,
      journeeEntiere: importe.journeeEntiere,
      lieu: importe.lieu,
      note: importe.note,
      uidIcs: importe.uid || null,
      /*
         Un import ne relève jamais : il dit ce qui était prévu, pas ce qui a
         eu lieu. Un événement déjà relevé garde sa réponse — réimporter son
         agenda ne doit pas effacer ce qu'on a pris la peine de dire.
      */
      realise: connu?.realise ?? 'inconnu',
      releveLe: connu?.releveLe ?? null,
      motif: connu?.motif ?? null,
      motifLibre: connu?.motifLibre ?? '',
    });
    if (connu) misAJour += 1;
    else nouveaux += 1;
  }

  return { aEcrire, nouveaux, misAJour, sansDomaine };
}
