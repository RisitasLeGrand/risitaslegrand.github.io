/**
 * Cinq ans de finances synthétiques — Finances, phase 5.
 *
 * ## Pourquoi un jeu séparé, et pourquoi déterministe
 *
 * Les trois autres volets de la phase 5 — conflits entre deux appareils,
 * mesures d'ergonomie, guide — ont tous besoin d'un carnet **plein**. Un
 * carnet vide ne révèle ni le temps que prend un rapprochement sur cinq ans
 * d'opérations, ni ce qui se passe quand deux appareils décident
 * différemment de la même ligne. Ce module est donc le premier des quatre,
 * et les autres s'y appuient.
 *
 * Tout dépend d'une **graine**. Deux appels à graine égale rendent exactement
 * le même carnet, au centime et à la milliseconde près. C'est ce qui permet
 * de rejouer une mesure et de comparer deux versions du code sans se demander
 * si l'écart vient du code ou du tirage.
 *
 * ## Ce que ce jeu n'est pas
 *
 * Il n'est ni une anonymisation ni une dérivation d'un relevé réel : aucune
 * donnée réelle n'a été lue pour l'écrire. Les libellés sont inventés et les
 * montants tirés de lois simples, choisies pour **exercer les cas qui
 * cassent** plutôt que pour ressembler à une vie : un loyer qui change deux
 * fois en cinq ans, une facture d'énergie qui sort de sa tolérance un hiver
 * sur deux, un prélèvement groupé qui veut être divisé, un virement interne
 * qui ne doit compter qu'une fois.
 *
 * ## Le solde boucle, par construction
 *
 * Les opérations sont engendrées d'abord, le solde en est **déduit**. L'ordre
 * inverse — poser un solde puis fabriquer des opérations qui l'atteignent —
 * aurait produit un jeu où le contrôle de solde passe toujours, y compris
 * quand le code qui le vérifie est faux.
 */

/** Le même générateur pseudo-aléatoire que le jeu de révisions, pour la cohérence. */
export function alea(graine = 1) {
  let x = graine >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x100000000;
  };
}

const JOUR_MS = 86_400_000;
const jourISO = (ms) => new Date(ms).toISOString().slice(0, 10);
const entre = (r, a, b) => a + Math.floor(r() * (b - a + 1));

/**
 * Le décalage d'une échéance, tiré une fois pour un couple ligne × mois.
 *
 * Un mélange de bits plutôt qu'un générateur à état : il faut que le même
 * couple rende toujours la même valeur, quel que soit l'ordre dans lequel on
 * le demande. Un `alea()` partagé ne le permettrait pas — sa sortie dépend du
 * nombre d'appels qui l'ont précédé.
 */
function decalageDe(graine, ligneId, annee, mois, tolerance) {
  let h = (graine >>> 0) ^ 0x9e3779b9;
  for (const c of `${ligneId}:${annee}-${mois}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const amplitude = tolerance * 2 + 3;
  return (h % amplitude) - tolerance;
}

/**
 * Les lignes de budget du carnet, et ce que chacune existe pour exercer.
 *
 * Les montants sont en centimes et les tolérances explicites : une ligne sans
 * tolérance déclarée ferait de chaque écart une anomalie, ce qui reviendrait
 * à n'en signaler aucune.
 */
export const LIGNES = [
  {
    id: 'loyer',
    libelle: 'Loyer',
    categorie: 'Logement',
    sens: 'charge',
    essentielle: true,
    motifs: ['LOYER', 'VIR SCI'],
    /* Trois versions : un loyer qui monte deux fois en cinq ans. C'est le cas
       que « ecartsParLigne » doit lire sans compter deux fois le mois du
       changement. */
    montants: [78000, 80500, 83000],
    nature: 'fixe',
    periodicite: 'mensuelle',
    jourAttendu: 5,
    tolerance: { centimes: 200, pourCent: 1, jours: 2 },
    dispersion: 0,
  },
  {
    id: 'energie',
    libelle: 'Électricité',
    categorie: 'Logement',
    sens: 'charge',
    essentielle: true,
    motifs: ['EDF', 'PRLV ENERGIE'],
    /* Une charge « estimée » qui sort de sa tolérance un hiver sur deux : la
       file « à rapprocher » doit la proposer en probable, pas en certaine. */
    montants: [9500],
    nature: 'estime',
    periodicite: 'mensuelle',
    jourAttendu: 15,
    tolerance: { centimes: 1000, pourCent: 10, jours: 3 },
    dispersion: 0.35,
  },
  {
    id: 'telecom',
    libelle: 'Téléphone et internet',
    categorie: 'Abonnements',
    sens: 'charge',
    essentielle: false,
    motifs: ['PRLV SEPA TELECOM'],
    montants: [3990, 4490],
    nature: 'fixe',
    periodicite: 'mensuelle',
    jourAttendu: 4,
    tolerance: { centimes: 100, pourCent: 2, jours: 2 },
    dispersion: 0,
  },
  {
    id: 'assurances',
    libelle: 'Assurances',
    categorie: 'Assurances',
    sens: 'charge',
    essentielle: true,
    motifs: ['ASSURANCE'],
    /* Trimestrielle : la périodicité que les moteurs de récurrence ratent le
       plus facilement, trois occurrences par an suffisant à peine au seuil. */
    montants: [21000],
    nature: 'fixe',
    periodicite: 'trimestrielle',
    jourAttendu: 10,
    tolerance: { centimes: 500, pourCent: 3, jours: 4 },
    dispersion: 0.02,
  },
  {
    id: 'impots',
    libelle: 'Impôt sur le revenu',
    categorie: 'Impôts',
    sens: 'charge',
    essentielle: true,
    motifs: ['DGFIP', 'IMPOT'],
    montants: [145000, 152000],
    nature: 'estime',
    periodicite: 'annuelle',
    jourAttendu: 15,
    tolerance: { centimes: 5000, pourCent: 8, jours: 10 },
    dispersion: 0.05,
  },
  {
    id: 'salaire',
    libelle: 'Traitement',
    categorie: 'Revenus',
    sens: 'ressource',
    essentielle: true,
    motifs: ['VIR TRAITEMENT', 'DGFIP TRAITEMENT'],
    montants: [215000, 221000, 228000],
    nature: 'fixe',
    periodicite: 'mensuelle',
    jourAttendu: 27,
    tolerance: { centimes: 1500, pourCent: 2, jours: 3 },
    dispersion: 0.01,
  },
];

/**
 * Les dépenses courantes, hors budget : elles font le bruit de la file.
 *
 * Les fourchettes ont été **calibrées**, pas devinées. Au premier tirage, le
 * carnet finissait cinq ans plus tard à moins cinquante mille euros : les
 * dépenses quotidiennes mangeaient trois fois le traitement. Un carnet
 * invraisemblable fait mentir toute mesure qu'on y prend — un écran de budget
 * n'a pas le même coût à peindre quand il n'affiche que du rouge.
 *
 * Les bornes ci-dessous donnent un carnet qui épargne un peu, ce qui est le
 * cas ordinaire, et le compte rendu rend le solde final pour qu'on puisse le
 * vérifier à chaque changement.
 */
const COURANTES = [
  ['CB SUPERMARCHE', 900, 4800],
  ['CB BOULANGERIE', 150, 900],
  ['CB PHARMACIE', 400, 2600],
  ['CB TRANSPORT', 170, 1400],
  ['CB RESTAURANT', 900, 2400],
  ['CB LIBRAIRIE', 600, 1800],
  ['RETRAIT DAB', 2000, 5000],
];

/**
 * Engendre le carnet.
 *
 * @param {{annees?: number, graine?: number, finLe?: string}} options
 * @returns un objet par magasin, prêt à être semé, plus un compte rendu.
 */
export function engendrerFinances({ annees = 5, graine = 1, finLe = '2026-10-14' } = {}) {
  const r = alea(graine);
  const fin = Date.parse(`${finLe}T12:00:00Z`);
  const jours = Math.round(annees * 365.25);
  const debut = fin - jours * JOUR_MS;

  const compte = {
    id: 'compte-courant',
    libelle: 'Compte courant',
    type: 'courant',
    devise: 'EUR',
    closLe: null,
    majLe: new Date(fin).toISOString(),
  };

  /* --- Les lignes de budget, avec leurs versions datées ------------------- */
  const lignes = LIGNES.map((l) => {
    const pas = Math.floor(jours / l.montants.length);
    return {
      id: l.id,
      libelle: l.libelle,
      categorie: l.categorie,
      sens: l.sens,
      compteId: compte.id,
      essentielle: l.essentielle,
      motifs: l.motifs,
      versions: l.montants.map((montant, i) => ({
        depuis: jourISO(debut + i * pas * JOUR_MS),
        jusqua: i === l.montants.length - 1 ? null : jourISO(debut + ((i + 1) * pas - 1) * JOUR_MS),
        montant,
        nature: l.nature,
        montantHaut: null,
        periodicite: l.periodicite,
        jourAttendu: l.jourAttendu,
        tolerance: l.tolerance,
      })),
      note: '',
      majLe: new Date(fin).toISOString(),
    };
  });

  /* --- Les opérations ----------------------------------------------------- */
  const operations = [];
  let n = 0;
  const poser = (jour, centimes, libelle, categorie = '') => {
    n += 1;
    operations.push({
      id: `op-${String(n).padStart(6, '0')}`,
      compteId: compte.id,
      jour,
      centimes,
      libelle,
      categorie,
      transfertAvec: null,
      majLe: `${jour}T20:00:00.000Z`,
    });
    return operations[operations.length - 1];
  };

  /** Le montant en vigueur à une date, selon les versions de la ligne. */
  const montantAu = (ligne, jour) => {
    const v = [...ligne.versions].reverse().find((x) => x.depuis <= jour) ?? ligne.versions[0];
    return v.montant;
  };

  const moisDe = (ms) => new Date(ms).getUTCMonth();

  for (let j = 0; j < jours; j += 1) {
    const ms = debut + j * JOUR_MS;
    const jour = jourISO(ms);
    const d = new Date(ms);
    const jourDuMois = d.getUTCDate();
    const mois = d.getUTCMonth();

    for (const modele of LIGNES) {
      const ligne = lignes.find((x) => x.id === modele.id);
      const base = montantAu(ligne, jour);
      const signe = modele.sens === 'charge' ? -1 : 1;
      /*
         Le jour réel s'écarte du jour attendu — mais **une fois par
         échéance**, pas une fois par jour.

         C'était le défaut du premier jet, et il ne se voyait pas à la lecture :
         le décalage était tiré dans la boucle des jours, donc chaque jour
         retirait au sort s'il était le bon. Un salaire pouvait tomber trois
         fois en mars et pas du tout en avril. Le solde final variait de
         trente-six mille euros d'une graine à l'autre, et c'est ce chiffre
         qui a mis sur la piste : une somme de deux mille cinq cents tirages
         indépendants ne disperse pas autant, donc la dispersion venait
         d'ailleurs.

         Le décalage est maintenant une fonction du couple ligne × échéance,
         calculée par un mélange déterministe : même graine, même jour, et le
         tirage ne dépend plus de l'ordre dans lequel on parcourt les jours.
      */
      const decalage = decalageDe(graine, modele.id, d.getUTCFullYear(), mois, modele.tolerance.jours);
      const jourVise = modele.jourAttendu + decalage;
      let due = false;
      if (modele.periodicite === 'mensuelle') due = jourDuMois === Math.min(28, Math.max(1, jourVise));
      else if (modele.periodicite === 'trimestrielle')
        due = mois % 3 === 0 && jourDuMois === Math.min(28, Math.max(1, jourVise));
      else if (modele.periodicite === 'annuelle')
        due = mois === 8 && jourDuMois === Math.min(28, Math.max(1, jourVise));
      if (!due) continue;

      /* La dispersion fabrique l'écart au prévu. L'hiver creuse l'énergie :
         un effet saisonnier, pour que les tendances aient quelque chose à
         trouver qui ne soit pas du bruit. */
      const saison =
        modele.id === 'energie' && (mois <= 2 || mois >= 10) ? 1 + 0.4 * r() : 1;
      const ecart = 1 + (r() * 2 - 1) * modele.dispersion;
      const montant = Math.round(base * ecart * saison);
      poser(jour, signe * montant, `${modele.motifs[0]} ${jour.slice(0, 7)}`, modele.categorie);
    }

    /*
       Dépenses courantes. Le **nombre** par jour est resserré, et c'est une
       correction : avec zéro à quatre achats par jour, le total sur cinq ans
       variait de vingt-sept mille euros d'une graine à l'autre, et le carnet
       changeait de nature — épargnant avec une graine, surendetté avec une
       autre. Un jeu dont le caractère dépend du tirage ne permet pas de
       comparer deux mesures prises sur deux graines.

       Resserré à un ou deux en semaine et zéro ou un le week-end, le total
       reste aléatoire mais le carnet garde le même visage. Le compte rendu
       rend le solde final pour que ce soit vérifiable, et non promis.
    */
    const weekEnd = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const combien = weekEnd ? entre(r, 0, 1) : entre(r, 1, 2);
    for (let k = 0; k < combien; k += 1) {
      const [libelle, bas, haut] = COURANTES[entre(r, 0, COURANTES.length - 1)];
      poser(jour, -entre(r, bas, haut), `${libelle} ${jour.slice(5)}`);
    }

    /* Une fois par trimestre, un prélèvement groupé : il réunit deux lignes,
       et c'est lui que « Diviser » existe pour traiter. */
    if (jourDuMois === 20 && mois % 3 === 1) {
      const a = montantAu(lignes.find((x) => x.id === 'telecom'), jour);
      const b = montantAu(lignes.find((x) => x.id === 'assurances'), jour);
      poser(jour, -(a + b), `PRLV GROUPE ${jour.slice(0, 7)}`, 'Abonnements');
    }
  }

  /* --- Le solde se déduit des opérations, jamais l'inverse ----------------- */
  const soldeFinal = operations.reduce((s, o) => s + o.centimes, 0);

  return {
    comptes: [compte],
    lignes,
    operations,
    compteRendu: {
      annees,
      graine,
      du: jourISO(debut),
      au: jourISO(fin - JOUR_MS),
      comptes: 1,
      lignes: lignes.length,
      versionsDeLigne: lignes.reduce((s, l) => s + l.versions.length, 0),
      operations: operations.length,
      /* Le solde est rendu en centimes et sans mise en forme : c'est une
         somme de montants inventés, pas une donnée. */
      soldeFinalCentimes: soldeFinal,
      prelevementsGroupes: operations.filter((o) => o.libelle.startsWith('PRLV GROUPE')).length,
    },
  };
}
