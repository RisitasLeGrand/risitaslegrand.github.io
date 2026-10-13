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
    const [{ demarrer }, { avertir }, { lien }] = await Promise.all([
      import('./arriere-plan'),
      import('./notification'),
      import('../ui'),
    ]);
    courante = await demarrer({
      surFusion: async (rapport) => {
        const recu = rapport.recu;
        if (!recu.recues && !recu.revisionsRecues) return;
        /*
           On n'avertit que d'une fusion qui a **apporté** quelque chose. Une
           notification « 0 opération reçue » apprendrait à ignorer les
           notifications, ce qui est le meilleur moyen de rater celle qui
           compte.
        */
        await avertir({
          titre: 'Synchronisé automatiquement',
          corps:
            `Reçu : ${recu.recues} opération(s) et ${recu.revisionsRecues} révision(s). ` +
            'Annulable pendant sept jours.',
          vers: lien('/appareils/'),
          marque: `fusion-${recu.lot}`,
        });
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
