/**
 * La couche d'orchestration de la synchronisation : le signal d'écriture
 * regroupée et le verrou d'écran.
 *
 * Ces deux modules ont le même défaut possible : **marcher trop**. Un signal
 * qui ne regroupe pas déclenche un échange par frappe, c'est-à-dire deux
 * dérivations PBKDF2 de 600 000 itérations par frappe. Un verrou d'écran
 * qu'on ne rend pas vide la batterie en silence. Ni l'un ni l'autre ne
 * produit d'erreur : ils produisent de la chaleur.
 *
 * Les deux autres défauts possibles sont des absences. Un signal qui pose un
 * minuteur sans abonné retient le processus en Node et empile des réveils
 * dans un navigateur. Un verrou qui ne se reprend pas au retour au premier
 * plan laisse l'échange sans protection exactement quand elle compte, puisque
 * le navigateur relâche le verrou dès que la page se cache.
 *
 * Les quatre déclencheurs de `arriere-plan.ts` ne sont **pas** couverts ici :
 * `demarrer` lit la base, et il n'y a pas d'IndexedDB en Node. Ils sont donc
 * déclarés « lus dans le code » dans le rapport d'audit, à l'exception du
 * signal d'écriture, qui est celui-ci.
 */
import {
  oublierLesEcritures,
  REGROUPEMENT_MS,
  signalerEcriture,
  surEcritureRegroupee,
} from '../src/lib/sync/signal-ecriture';
import { garderLEcranAllume } from '../src/lib/sync/ecran-allume';

let echecs = 0;
const verifier = (nom: string, condition: boolean, detail = '') => {
  if (condition) console.log(`  ✓ ${nom}`);
  else {
    echecs += 1;
    console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`);
  }
};

/* ── Une horloge de minuteurs que l'essai avance lui-même ─────────────────
   Attendre vingt secondes réelles pour vérifier un regroupement de vingt
   secondes serait un essai de vingt secondes. On remplace setTimeout. */
type Prevu = { quand: number; quoi: () => void; id: number };
let maintenant = 0;
let prevus: Prevu[] = [];
let prochainId = 1;
const vraiSetTimeout = globalThis.setTimeout;
const vraiClearTimeout = globalThis.clearTimeout;

function installerHorloge() {
  maintenant = 0;
  prevus = [];
  globalThis.setTimeout = ((quoi: () => void, delai = 0) => {
    const id = prochainId++;
    prevus.push({ quand: maintenant + delai, quoi, id });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: unknown) => {
    prevus = prevus.filter((p) => (p.id as unknown) !== id);
  }) as typeof clearTimeout;
}

function rendreLHorloge() {
  globalThis.setTimeout = vraiSetTimeout;
  globalThis.clearTimeout = vraiClearTimeout;
}

function avancer(ms: number) {
  maintenant += ms;
  const murs = prevus.filter((p) => p.quand <= maintenant).sort((a, b) => a.quand - b.quand);
  prevus = prevus.filter((p) => p.quand > maintenant);
  for (const p of murs) p.quoi();
}

console.log('\nSignal d’écriture regroupée');
installerHorloge();
{
  // 1. Sans abonné, aucun minuteur : le module est inerte sur 48 pages sur 50.
  signalerEcriture();
  verifier('sans abonné, aucun minuteur posé', prevus.length === 0, `${prevus.length} en attente`);

  // 2. Une rafale de vingt écritures ne vaut qu'une notification.
  let vues = 0;
  const detacher = surEcritureRegroupee(() => {
    vues += 1;
  });
  for (let i = 0; i < 20; i += 1) {
    signalerEcriture();
    avancer(1000); // une écriture par seconde, pendant vingt secondes
  }
  verifier('pendant la rafale, rien n’est notifié', vues === 0, `${vues} notification(s)`);
  avancer(REGROUPEMENT_MS);
  verifier('une seule notification après le silence', vues === 1, `${vues} notification(s)`);

  // 3. Le silence est bien celui qui compte : le minuteur repart à chaque
  //    écriture, il ne se déclenche pas au bout d'un délai fixe.
  vues = 0;
  signalerEcriture();
  avancer(REGROUPEMENT_MS - 1000);
  signalerEcriture();
  avancer(REGROUPEMENT_MS - 1000);
  verifier('une écriture repousse l’échéance', vues === 0, `${vues} notification(s)`);
  avancer(1000);
  verifier('et la notification suit le dernier silence', vues === 1, `${vues} notification(s)`);

  // 4. Un abonné qui lève n'empêche pas les autres d'être prévenus.
  let secondVu = 0;
  const detacherFautif = surEcritureRegroupee(() => {
    throw new Error('je tombe');
  });
  const detacherSecond = surEcritureRegroupee(() => {
    secondVu += 1;
  });
  vues = 0;
  signalerEcriture();
  avancer(REGROUPEMENT_MS);
  verifier('un abonné qui lève n’emporte pas les autres', secondVu === 1 && vues === 1);
  detacherFautif();
  detacherSecond();

  // 5. Le désabonnement rend le module inerte à nouveau.
  detacher();
  oublierLesEcritures();
  signalerEcriture();
  verifier('désabonné, plus aucun minuteur', prevus.length === 0, `${prevus.length} en attente`);
}
rendreLHorloge();

console.log('\nVerrou d’écran');
{
  // 1. Le cas normal : pris, puis rendu.
  let rendus = 0;
  const verrou = await garderLEcranAllume(async () => ({
    release: async () => {
      rendus += 1;
    },
  }));
  verifier('le verrou est tenu quand le navigateur l’accorde', verrou.tenu());
  await verrou.rendre();
  verifier('et rendu exactement une fois', rendus === 1, `${rendus} fois`);

  // 2. Rendre deux fois ne rend pas deux fois : un appelant prudent peut le
  //    faire dans un « finally » et dans un gestionnaire d'arrêt.
  await verrou.rendre();
  verifier('rendre deux fois ne relâche qu’une fois', rendus === 1, `${rendus} fois`);

  // 3. Navigateur sans l'API : jeton inerte, et surtout aucune exception. Une
  //    synchronisation ne doit pas tomber faute de verrou d'écran.
  const sansApi = await garderLEcranAllume(null);
  verifier('sans l’API, le jeton est inerte', !sansApi.tenu());
  await sansApi.rendre();
  verifier('et le rendre ne lève pas', true);

  // 4. Refus du navigateur — batterie faible, onglet caché.
  const refuse = await garderLEcranAllume(async () => {
    throw new Error('refusé');
  });
  verifier('un refus donne un jeton non tenu, sans lever', !refuse.tenu());
  await refuse.rendre();

  // 5. Reprise au retour au premier plan. Le navigateur relâche le verrou
  //    quand la page se cache ; personne ne le redemande à notre place.
  const ecouteurs: Array<() => void> = [];
  let visibilite = 'visible';
  let demandes = 0;
  (globalThis as { document?: unknown }).document = {
    get visibilityState() {
      return visibilite;
    },
    addEventListener: (_nom: string, f: () => void) => ecouteurs.push(f),
    removeEventListener: (_nom: string, f: () => void) => {
      const i = ecouteurs.indexOf(f);
      if (i >= 0) ecouteurs.splice(i, 1);
    },
  };
  const repris = await garderLEcranAllume(async () => {
    demandes += 1;
    return { release: async () => {} };
  });
  verifier('une demande à la prise', demandes === 1, `${demandes}`);
  visibilite = 'hidden';
  for (const f of [...ecouteurs]) f();
  verifier('page cachée : on ne redemande pas', demandes === 1, `${demandes}`);
  visibilite = 'visible';
  for (const f of [...ecouteurs]) f();
  await new Promise((ok) => vraiSetTimeout(ok, 0));
  verifier('page revenue : on redemande', demandes === 2, `${demandes}`);
  await repris.rendre();
  verifier('et l’écouteur est détaché à la restitution', ecouteurs.length === 0, `${ecouteurs.length}`);
  visibilite = 'visible';
  for (const f of [...ecouteurs]) f();
  verifier('rendu, un retour au premier plan ne reprend rien', demandes === 2, `${demandes}`);
  delete (globalThis as { document?: unknown }).document;
}

console.log(echecs === 0 ? '\n✓ Orchestration : tout passe' : `\n✗ ${echecs} échec(s)`);
process.exit(echecs === 0 ? 0 : 1);
