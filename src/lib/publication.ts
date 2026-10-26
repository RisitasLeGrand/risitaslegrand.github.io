/**
 * L'onglet resté sur l'ancienne version — B5 du prompt 43.
 *
 * ## Le défaut, et pourquoi il ne se voyait pas
 *
 * Cyclades est un site statique : **toute navigation est un chargement
 * complet**, qui rapporte le nouveau HTML et le nouveau `cle.json`. Un onglet
 * ne reste donc sur l'ancienne publication que dans un cas précis — celui où
 * l'on ne navigue pas. L'onglet laissé ouvert une nuit, celui d'un téléphone
 * qu'on rallume, celui qu'on garde sur l'écran du jour pendant qu'on travaille
 * ailleurs.
 *
 * Dans ce cas, `chargerParametresCle()` a mémorisé sa promesse : la page garde
 * **sa** version de publication aussi longtemps qu'elle vit. Et rien, nulle
 * part, ne le disait à la personne. Le site avait bien une phrase pour cela —
 * « Le site a été republié entre-temps : rechargez la page » dans
 * `contenu.ts` —, mais elle n'arrive qu'au moment où un contenu refuse de se
 * déchiffrer, c'est-à-dire seulement si la republication a changé le mot de
 * passe ET qu'on a ouvert une fiche. Un onglet qui ne lit rien ne voit rien.
 *
 * ## Ce que ce module fait, et ce qu'il se garde de faire
 *
 * Il compare la version avec laquelle la page a démarré à celle que le site
 * publie **maintenant**, et pose un bandeau quand les deux diffèrent. Il ne
 * recharge jamais de lui-même : une page rechargée sous les doigts de
 * quelqu'un perd ce qu'il tapait, et le choix du moment lui appartient.
 *
 * ## Quand il regarde, et pourquoi pas en boucle
 *
 * Au retour sur l'onglet (`visibilitychange`) et au retour du réseau
 * (`online`). Ce sont les deux instants où l'information a une chance d'avoir
 * changé ET où la personne est là pour la lire.
 *
 * Pas de minuteur, délibérément. Un onglet d'arrière-plan qui interroge le
 * serveur toutes les dix minutes dépense de la batterie pour une nouvelle que
 * personne ne lira avant d'être revenu — et quand on revient,
 * `visibilitychange` part. Le seul cas non couvert est l'onglet resté au
 * premier plan, sans réseau coupé, pendant des heures : il apprendra la
 * nouvelle au prochain coup d'œil ailleurs puis retour, ce qui arrive bien
 * avant qu'une publication de plus ne soit faite.
 *
 * ## Hors ligne, on ne conclut rien
 *
 * C'est la même règle qu'`obtenirCle` depuis M8 : une lecture qui échoue ne
 * dit pas que la version a changé, elle dit qu'on ne sait pas. On se taît, et
 * `online` réessaiera.
 */
import { urlData } from './contenu';

/** L'identifiant du bandeau, pour ne pas en poser deux. */
const ID = 'bandeau-publication';

/** Posé une fois : deux écouteurs sur la même page n'ont aucun intérêt. */
let attache = false;
/** Dit une fois : la nouvelle ne change pas, et la répéter la ferait ignorer. */
let dit = false;

/**
 * La version que le site publie maintenant, ou `null` si on ne sait pas.
 *
 * `cache: 'no-store'` et non `'no-cache'` : on ne veut pas revalider une
 * entrée, on veut la vérité du serveur. Une revalidation qui rendrait 304
 * servirait la réponse mémorisée, c'est-à-dire **exactement** l'ancienne
 * version qu'on cherche à détecter.
 */
export async function versionPubliee(): Promise<string | null> {
  try {
    const reponse = await fetch(urlData('cle.json'), { cache: 'no-store' });
    if (!reponse.ok) return null;
    const lu: unknown = await reponse.json();
    const version = (lu as { version?: unknown } | null)?.version;
    return typeof version === 'string' && version ? version : null;
  } catch {
    /* Hors ligne, serveur muet : on ne conclut rien. */
    return null;
  }
}

function poserLeBandeau(): void {
  if (document.getElementById(ID)) return;

  const bandeau = document.createElement('div');
  bandeau.id = ID;
  bandeau.className = 'bandeau-publication barre-sure';
  /*
     `status` et non `alert` : c'est une information sur le site, pas une
     erreur, et `alert` interromprait la lecture en cours d'un lecteur
     d'écran — pour une nouvelle qui peut attendre la fin de la phrase.
  */
  bandeau.setAttribute('role', 'status');

  const texte = document.createElement('span');
  texte.className = 'bandeau-publication-texte';
  /*
     CE QUE LA PHRASE DIT, ET CE QU'ELLE SE GARDE DE PROMETTRE.

     Elle dit l'état — cet onglet montre l'ancienne version —, elle laisse le
     moment à la personne, et elle ne promet que ce qui est vrai : ce qui est
     **déjà enregistré** ne risque rien, parce que chaque geste s'écrit en
     base. Ce qu'on est en train de taper, lui, serait perdu, et c'est
     précisément pour cela qu'on ne recharge pas à sa place.
  */
  texte.textContent =
    'Une version plus récente de Cyclades est publiée, et cet onglet montre encore ' +
    'l’ancienne. Rechargez quand vous aurez fini : ce qui est déjà enregistré ne ' +
    'risque rien.';

  const recharger = document.createElement('button');
  recharger.type = 'button';
  recharger.className = 'bandeau-publication-bouton cible-tactile';
  recharger.textContent = 'Recharger';
  recharger.addEventListener('click', () => location.reload());

  /*
     ET UN MOYEN DE LE FAIRE TAIRE. Un bandeau qu'on ne peut pas écarter se
     fait ignorer, et c'est alors tous les bandeaux qu'on apprend à ignorer —
     le même raisonnement que le plafond des notifications. Masquer ne vaut
     que pour cet onglet et cette page : la version, elle, n'a pas changé, et
     le prochain chargement rapportera la nouvelle de toute façon.
  */
  const masquer = document.createElement('button');
  masquer.type = 'button';
  masquer.className = 'bandeau-publication-bouton cible-tactile';
  masquer.id = 'bandeau-publication-masquer';
  masquer.textContent = 'Masquer';
  masquer.addEventListener('click', () => bandeau.remove());

  bandeau.append(texte, recharger, masquer);
  document.body.append(bandeau);
}

async function regarder(versionDuChargement: string): Promise<void> {
  if (dit) return;
  const publiee = await versionPubliee();
  if (!publiee || publiee === versionDuChargement) return;
  dit = true;
  poserLeBandeau();
}

/**
 * Surveille la publication, et prévient une fois si elle a changé.
 *
 * `versionDuChargement` est celle que la mise en page vient de lire dans
 * `cle.json` — on ne la relit pas ici, parce que `chargerParametresCle()` la
 * mémorise : la relire rendrait la même valeur, et la comparaison serait
 * toujours vraie. C'est le piège de ce module, et il est écrit ici pour
 * qu'on ne le retrouve pas par l'expérience.
 */
export function surveillerLaPublication(versionDuChargement: string): void {
  if (!versionDuChargement || attache) return;
  if (typeof document === 'undefined') return;
  attache = true;

  const verifier = (): void => {
    void regarder(versionDuChargement);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verifier();
  });
  addEventListener('online', verifier);
}

/*
   PAS DE PORTE DE SERVICE POUR LES ESSAIS.

   Une fonction exportée ici pour les seuls essais serait du code mort dans
   la page — les modules ne sont pas globaux, rien ne pourrait l'appeler — et
   surtout elle ferait mesurer un chemin que personne n'emprunte. L'essai
   déclenche donc le vrai : `document.dispatchEvent(new Event('visibilitychange'))`,
   que l'écouteur ci-dessus reçoit comme il recevrait un retour sur l'onglet.
*/
