/**
 * Le point d'entrée de la veille, appelé par la mise en page.
 *
 * Il existe pour une raison étroite : `arriere-plan.ts` importe Trystero, le
 * moteur de fusion et le chiffrement. Les importer depuis la mise en page les
 * ferait charger sur **toutes** les pages du site, pour une fonction que la
 * plupart des appareils n'activeront jamais. Ce module-ci est donc minuscule,
 * teste la seule condition qui se teste sans rien charger, et n'importe le
 * reste que si elle est remplie.
 *
 * Il tient aussi la veille unique de l'onglet : deux appels — deux scripts, un
 * retour en arrière du navigateur — ne doivent pas ouvrir deux salons.
 */
import { appairageMemorise } from './appairage';
import { certificationEffective, certificationLocale } from './certification';
import { motDePasseRetenu } from './mot-de-passe-session';
import type { Veille } from './arriere-plan';

/**
 * L'événement par lequel l'état de la veille atteint l'écran.
 *
 * Nommé et exporté, parce que deux chaînes identiques écrites à deux endroits
 * divergent le jour où l'une des deux change — et que la divergence serait
 * SILENCIEUSE : un témoin qui n'écoute plus rien a exactement l'air d'une
 * synchronisation qui ne se passe rien.
 */
export const EVENEMENT_ETAT = 'revinsp:veille-etat';

let courante: Veille | null = null;
let enCours: Promise<Veille | null> | null = null;

/**
 * Démarre la veille si cet appareil est certifié. Sans bruit, sinon.
 *
 * La certification se lit **effective** depuis D-028 : la décision
 * enregistrée, ou, à défaut, le défaut d'un appareil apparié qui a le mot de
 * passe en mémoire. Les deux conditions du défaut se testent ici sans rien
 * charger de lourd — un `get` sur `etat` et une lecture de mémoire —, ce qui
 * est la raison d'être de ce module, et `arriere-plan.ts` les revérifie de
 * toute façon avant d'agir.
 *
 * L'oubli aurait été silencieux : « demarrer » aurait accepté le défaut,
 * mais personne ne l'aurait appelé.
 */
export async function veiller(): Promise<Veille | null> {
  if (courante) return courante;
  if (enCours) return enCours;
  enCours = (async () => {
    const { certifie } = certificationEffective(await certificationLocale(), {
      apparie: (await appairageMemorise()) !== null,
      motDePasseEnMemoire: motDePasseRetenu() !== null,
    });
    if (!certifie) return null;
    const { demarrer } = await import('./arriere-plan');
    courante = await demarrer({
      /*
         L'ÉTAT REMONTE À L'ÉCRAN, ET C'EST LE DÉFAUT QUE CE LOT A TROUVÉ.

         `surEtat` existait dans `OptionsVeille` depuis le début, et personne
         ne le passait. La mise en page lisait `veille.etat()` UNE FOIS, à
         l'ouverture du coffre, et ne le relisait jamais : le témoin portait
         donc l'état qu'avait la veille à cet instant, pour le reste de la
         vie de la page. « Synchronisation en cours » ne s'affichait que si
         l'ouverture du coffre tombait pendant un échange, et un échec
         survenu après restait invisible — alors que le témoin porte
         `aria-live="polite"`, c'est-à-dire la promesse d'être annoncé.

         Par un événement du document, et non par un appel direct : la veille
         peut tourner sans écran — un essai, un autre onglet —, et elle ne
         doit rien savoir de la mise en page. Le `document` est tout de même
         testé : ce module est chargé paresseusement par la mise en page, donc
         toujours dans un navigateur aujourd'hui, mais une veille lancée
         ailleurs ne doit pas se briser sur l'absence de DOM.
      */
      surEtat: (etat) => {
        if (typeof document === 'undefined') return;
        document.dispatchEvent(new CustomEvent(EVENEMENT_ETAT, { detail: { etat } }));
      },
      surFusion: async (rapport) => {
        const recu = rapport.recu;
        if (!recu.recues && !recu.revisionsRecues) return;
        /*
           On ne signale qu'une fusion qui a **apporté** quelque chose. Un
           avis « 0 opération reçue » apprendrait à ignorer les avis, ce qui
           est le meilleur moyen de rater celui qui compte.
        */
        /*
           UNE SEULE PORTE, ET CE N'EST PLUS CELLE-CI — 0.8 du prompt 43.

           Ce bloc appelait `avertir` directement, et c'était une seconde
           porte vers le système, à côté de `notifications/emettre`. Elle
           contournait tout ce que l'autre tient : le réglage par source du
           § 3.4 — donc une notification partait alors que la personne
           n'avait rien activé —, le plafond de cinq par jour, le verrou
           entre onglets — donc trois onglets ouverts sonnaient trois fois —
           et le libellé neutre de la décision 3, puisque celui-ci nommait
           la synchronisation.

           La fusion se contente donc de se DÉPOSER au centre, et c'est le
           dépôt qui décide d'interrompre ou non, par la porte unique. Deux
           conséquences, assumées et dites ici plutôt que découvertes :

           1. le réglage « Synchronisation » étant éteint par défaut, aucune
              notification du système ne part plus tant que personne ne l'a
              activé. C'est exactement ce que le § 3.4 demande, et le centre,
              lui, reçoit toujours ;
           2. le libellé neutre ne dit plus « Annulable pendant sept
              jours ». Le droit n'est pas perdu pour autant : l'écran des
              appareils le dit trois fois et donne la date limite de chaque
              lot, et c'est là que le centre mène.

           **La décision 5 est mieux tenue qu'avant**, et non contournée :
           elle exigeait qu'aucun nombre du rapport ne paraisse sur un écran
           verrouillé. Le libellé est maintenant une constante, et seul le
           numéro de lot — qui n'est pas un volume — traverse encore.
        */
        try {
          const { signalerUneFusion } = await import('../notifications/alimentation');
          await signalerUneFusion(recu.lot);
        } catch (erreur) {
          /*
             Dit, et non avalé. Le dépôt était déjà enveloppé ainsi quand il
             DOUBLAIT la notification ; il est seul désormais, et un coffre
             refermé entre-temps fait une fusion dont rien ne témoigne. La
             fusion, elle, reste faite : c'est pour cela qu'on n'échoue pas.
          */
          console.warn(
            'La fusion a réussi mais n’a pas pu être déposée au centre : rien ne la signalera.',
            erreur,
          );
        }
      },
    });
    return courante;
  })();
  try {
    return await enCours;
  } finally {
    enCours = null;
  }
}

/** Arrête la veille, s'il y en a une. Pour les essais et le retrait. */
export async function cesser(): Promise<void> {
  const veille = courante;
  courante = null;
  await veille?.arreter();
}

export const veilleCourante = (): Veille | null => courante;
