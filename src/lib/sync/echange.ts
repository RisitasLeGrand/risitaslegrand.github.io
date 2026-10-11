/**
 * L'échange : ce qui se passe une fois que les deux appareils se parlent.
 *
 * Un seul chemin pour les trois transports. Le mode A1 (salon et relais public),
 * le mode A2 (deux QR, aucun tiers) et, demain, le mode B rendent tous un
 * `Canal` ; à partir de là, tout est commun — fabriquer son paquet, l'envoyer,
 * attendre celui d'en face, le fusionner. C'est ce qui garantit que le refus de
 * première fusion, les conflits et l'annulation se comportent exactement
 * pareil quel que soit le tuyau. Un second chemin de fusion aurait été un
 * second endroit où se tromper.
 *
 * ## Symétrique, et pourquoi
 *
 * Les deux appareils font la même chose : chacun envoie et chacun fusionne. Il
 * n'y a pas de maître. C'est ce qui permet de terminer en **une** rencontre :
 * un échange à sens unique laisserait l'émetteur en retard, et il faudrait
 * recommencer dans l'autre sens — c'est exactement ce que le transfert de
 * fichier impose, et ce qu'une liaison vivante doit faire disparaître.
 *
 * ## L'attente est bornée
 *
 * Si l'appareil d'en face ne répond pas — il s'est verrouillé, la page a été
 * fermée, le mot de passe n'y est pas —, l'échange s'arrête en le disant. Une
 * promesse qui n'aboutit jamais laisse un écran à « synchronisation en cours… »
 * pour toujours, et c'est la pire des pannes : celle qui ne dit pas qu'elle en
 * est une.
 */
import type { Canal } from './liaison';
import type { Progression } from './morceaux';
import {
  empreinteLocale,
  fabriquerPaquet,
  fusionnerPaquet,
  FusionRefusee,
  type RapportDeFusion,
} from './service';
import { noterReussite } from './appairage';

export type Etape =
  | 'preparation'
  | 'envoi'
  | 'attente'
  | 'fusion'
  | 'termine'
  | 'refuse'
  | 'abandon';

export interface RapportDEchange {
  envoye: { operations: number; revisions: number; octets: number };
  recu: RapportDeFusion;
  /**
   * Les deux appareils portent-ils la même chose **après** l'échange ?
   *
   * `null` quand on n'a pas pu le savoir. Ce champ existe parce que
   * « rapport.recu.identiques » ne peut pas répondre à cette question : il
   * compare notre empreinte d'après-fusion à celle que le paquet annonçait,
   * laquelle a été calculée **avant** que l'autre appareil ne fusionne le
   * nôtre. Dans un échange simultané, cette comparaison est donc fausse par
   * construction — elle annonce « les empreintes diffèrent encore » alors que
   * les deux bases viennent de devenir identiques. L'essai de liaison l'a
   * montré, et c'est l'écran qui mentait, pas l'essai.
   *
   * On échange donc une dernière ligne, minuscule, après la fusion.
   */
  identiques: boolean | null;
}

export interface OptionsEchange {
  surEtape?: (etape: Etape) => void;
  surProgression?: (p: Progression, sens: 'envoi' | 'reception') => void;
  /** Délai d'attente du paquet d'en face. */
  delaiMs?: number;
  nomAppareil?: string;
}

export class EchangeInterrompu extends Error {
  constructor(readonly motif: 'delai' | 'canal-ferme') {
    super(
      motif === 'delai'
        ? 'L’autre appareil n’a rien envoyé : il s’est peut-être verrouillé, ou la page a été fermée.'
        : 'La liaison s’est fermée avant la fin de l’échange.',
    );
    this.name = 'EchangeInterrompu';
  }
}

/** Trente secondes : le temps d'un paquet de quelques mégaoctets, large. */
export const DELAI_PAR_DEFAUT_MS = 30_000;

/**
 * Le préfixe de la ligne d'empreinte.
 *
 * Elle passe par le même canal que les paquets, et s'en distingue par ses
 * premiers octets — un paquet commence par « CYCLADES-PAQUET ». Pas de second
 * canal, pas de second type de message dans le découpage : une ligne de texte
 * reconnaissable suffit, et elle reste lisible dans une trace.
 */
export const LIGNE_EMPREINTE = 'CYCLADES-EMPREINTE ';

/** Trois secondes : on n'attend pas une confirmation de confort. */
export const DELAI_EMPREINTE_MS = 3_000;

export async function echanger(
  canal: Canal,
  motDePasse: string,
  options: OptionsEchange = {},
): Promise<RapportDEchange> {
  const dire = (etape: Etape) => options.surEtape?.(etape);

  /*
     On s'abonne **avant** d'envoyer. Le paquet d'en face peut arriver pendant
     notre propre envoi — les deux appareils démarrent en même temps — et un
     abonnement posé après l'envoi perdrait un paquet déjà reçu, ce qui se
     manifesterait par une attente de trente secondes suivie d'un échec
     incompréhensible.
  */
  let resoudre: ((paquet: Uint8Array) => void) | null = null;
  let rejeter: ((erreur: Error) => void) | null = null;
  let dejaRecu: Uint8Array | null = null;
  let regle = false;

  let resoudreEmpreinte: ((empreinte: string) => void) | null = null;
  let empreinteRecue: string | null = null;

  canal.surPaquet((paquet) => {
    /*
       Une ligne d'empreinte peut arriver avant notre propre fusion : l'autre
       appareil va parfois plus vite. On la garde donc, au lieu de l'ignorer.
    */
    const debut = new TextDecoder().decode(paquet.subarray(0, LIGNE_EMPREINTE.length));
    if (debut === LIGNE_EMPREINTE) {
      const valeur = new TextDecoder().decode(paquet.subarray(LIGNE_EMPREINTE.length));
      if (resoudreEmpreinte) resoudreEmpreinte(valeur);
      else empreinteRecue = valeur;
      return;
    }
    if (regle) return;
    if (resoudre) {
      regle = true;
      resoudre(paquet);
    } else {
      dejaRecu = paquet;
    }
  });
  canal.surFermeture(() => {
    if (regle) return;
    regle = true;
    rejeter?.(new EchangeInterrompu('canal-ferme'));
  });
  canal.surProgression((p) => options.surProgression?.(p, 'reception'));

  dire('preparation');
  const paquet = await fabriquerPaquet(motDePasse, { nomAppareil: options.nomAppareil });

  dire('envoi');
  await canal.envoyer(paquet.octets, (p) => options.surProgression?.(p, 'envoi'));

  dire('attente');
  const recu = await new Promise<Uint8Array>((ok, ko) => {
    if (dejaRecu) {
      regle = true;
      return ok(dejaRecu);
    }
    const minuteur = setTimeout(() => {
      if (regle) return;
      regle = true;
      ko(new EchangeInterrompu('delai'));
    }, options.delaiMs ?? DELAI_PAR_DEFAUT_MS);
    resoudre = (p) => {
      clearTimeout(minuteur);
      ok(p);
    };
    rejeter = (e) => {
      clearTimeout(minuteur);
      ko(e);
    };
  });

  dire('fusion');
  try {
    const rapport = await fusionnerPaquet(recu, motDePasse);
    await noterReussite(rapport.appareilDistant);

    /*
       La dernière ligne : chacun annonce l'empreinte qu'il porte **après** avoir
       fusionné. C'est la seule façon de répondre honnêtement à « est-ce que nos
       deux appareils portent la même chose ? » en une seule rencontre.
    */
    const { complete } = await empreinteLocale();
    const encodeur = new TextEncoder();
    await canal.envoyer(encodeur.encode(LIGNE_EMPREINTE + complete));
    const distante = await new Promise<string | null>((ok) => {
      if (empreinteRecue) return ok(empreinteRecue);
      const minuteur = setTimeout(() => ok(null), DELAI_EMPREINTE_MS);
      resoudreEmpreinte = (valeur) => {
        clearTimeout(minuteur);
        ok(valeur);
      };
    });

    dire('termine');
    return {
      envoye: {
        operations: paquet.operations,
        revisions: paquet.revisions,
        octets: paquet.octets.length,
      },
      recu: rapport,
      identiques: distante === null ? null : distante === complete,
    };
  } catch (erreur) {
    dire(erreur instanceof FusionRefusee ? 'refuse' : 'abandon');
    throw erreur;
  }
}
