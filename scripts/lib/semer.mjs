/**
 * Semer des révisions dans la base d'un appareil, par le chemin de la base.
 *
 * Partagé par les essais de transport (fichier) et de liaison (QR et WebRTC) :
 * les deux ont besoin de deux appareils aux histoires distinctes, et recopier
 * cette fonction aurait fait deux semis qui divergent — donc deux essais qui ne
 * comparent plus la même chose.
 */

export async function semer(appareil, cartes, depart) {
  return appareil.page.evaluate(
    async ([cartes, depart]) => {
      const base = await new Promise((ok, ko) => {
        const r = indexedDB.open('revinsp');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
      const appareilId = await new Promise((ok) => {
        const q = base.transaction('etat').objectStore('etat').get('appareil');
        q.onsuccess = () => ok(q.result);
      });

      const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      const encoderTemps = (ms) => {
        let reste = Math.floor(ms);
        let sortie = '';
        for (let i = 0; i < 10; i += 1) {
          sortie = ALPHABET[reste % 32] + sortie;
          reste = Math.floor(reste / 32);
        }
        return sortie;
      };
      let rang = 0;
      const ulid = (ms) =>
        encoderTemps(ms) +
        `${appareilId.slice(0, 8)}${String(rang++).padStart(8, '0')}`
          .toUpperCase()
          .replace(/[ILOU]/g, 'X')
          .slice(0, 16);
      const hlc = (ms, n) =>
        `${String(ms).padStart(15, '0')}-${n.toString(36).toUpperCase().padStart(4, '0')}`;

      const entrees = [];
      const etats = [];
      let instant = depart;
      let compteur = 0;
      for (const carte of cartes) {
        // Un socle, pour que la carte existe dans le journal, puis des
        // notations : exactement ce qu'une migration puis des révisions
        // produisent.
        instant += 3600_000;
        entrees.push({
          id: ulid(instant),
          genre: 'socle',
          carteId: carte,
          ficheId: `fiche-${carte}`,
          matiere: 'Économie',
          le: new Date(instant).toISOString(),
          appareil: appareilId,
          hlc: hlc(instant, compteur++),
          lot: '',
          etat: {
            due: new Date(instant).toISOString().slice(0, 10),
            stability: 1,
            difficulty: 5,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
          },
          revisions: 0,
          oublis: 0,
        });
        for (const note of ['correct', 'facile', 'difficile']) {
          instant += 86_400_000;
          entrees.push({
            id: ulid(instant),
            genre: 'notation',
            carteId: carte,
            ficheId: `fiche-${carte}`,
            matiere: 'Économie',
            le: new Date(instant).toISOString(),
            appareil: appareilId,
            hlc: hlc(instant, compteur++),
            lot: '',
            note,
          });
        }
        etats.push(carte);
      }

      // Et une opération ordinaire, pour que le journal des opérations ne soit
      // pas vide : la fusion doit traiter les deux.
      instant += 1000;
      const operation = {
        id: ulid(instant),
        appareil: appareilId,
        hlc: hlc(instant, compteur++),
        type: 'checkin',
        cible: `jour-${appareilId}`,
        lot: '',
        charge: { valeur: 3 },
      };

      await new Promise((ok, ko) => {
        const tx = base.transaction(['revisions', 'operations'], 'readwrite');
        for (const e of entrees) tx.objectStore('revisions').put(e);
        tx.objectStore('operations').put(operation);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
      base.close();
      return { revisions: entrees.length, operations: 1, appareil: appareilId };
    },
    [cartes, depart],
  );
}

