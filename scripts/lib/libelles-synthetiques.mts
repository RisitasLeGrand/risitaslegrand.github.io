/**
 * Un jeu de libellés bancaires **synthétiques**, pour éprouver la
 * reconnaissance de vendeur.
 *
 * ## Ce que ce jeu mesure, et ce qu'il ne mesure pas
 *
 * Il est écrit de la même main que le dictionnaire. Tout taux calculé
 * dessus mesure donc surtout la **cohérence entre les deux côtés de ma
 * propre main**, et ne dit rien de relevés réels. Il est publié avec cette
 * réserve, parce qu'une mesure dont on tait la limite est pire qu'aucune.
 *
 * Ce qu'il mesure vraiment, et qui vaut quelque chose : que les formes de
 * libellé — mentions de carte, dates collées, villes, références,
 * intermédiaires, troncatures — ne cassent pas la reconnaissance d'une
 * enseigne que le dictionnaire connaît. C'est un essai de **robustesse de
 * la normalisation**, pas une estimation de couverture.
 *
 * Aucun libellé réel n'entre ici, et aucun n'entrera : le prompt l'interdit,
 * et un échantillon réel dans un dépôt public serait exactement ce que tout
 * ce chantier cherche à éviter.
 */

export interface LibelleSynthetique {
  libelle: string;
  /** Le nom canonique attendu, ou `null` quand rien ne doit être reconnu. */
  attendu: string | null;
  /** Le type attendu, quand il y en a un. */
  type?: string;
  /** À quoi sert cette ligne, pour le rapport. */
  forme: string;
}

const L = (
  libelle: string,
  attendu: string | null,
  forme: string,
  type?: string,
): LibelleSynthetique => ({ libelle, attendu, forme, type });

export const LIBELLES: readonly LibelleSynthetique[] = [
  /* ── Les formes ordinaires ────────────────────────────────────────── */
  L('CB CARREFOUR CITY TOURNAY 1210', 'Carrefour City', 'carte, ville, date collée'),
  L('PAIEMENT CB LIDL 0310', 'Lidl', 'carte, date collée'),
  L('CB MONOPRIX PARIS 11', 'Monoprix', 'carte, ville, arrondissement'),
  L('PRLV SEPA EDF CLIENTS PARTICULIERS', 'EDF', 'prélèvement SEPA'),
  L('PRLV FREE MOBILE', 'Free Mobile', 'prélèvement simple'),
  L('PRELEVEMENT SFR ABONNEMENT', 'SFR', 'prélèvement, mot parasite'),
  L('CB NETFLIX COM 1234 AMSTERDAM', 'Netflix', 'domaine, ville étrangère'),
  L('CB SPOTIFY P12A3B4C5', 'Spotify', 'référence collée'),
  L('PRLV ENGIE GAZ ELEC', 'Engie', 'prélèvement, mots parasites'),
  L('CB SNCF CONNECT INTERNET', 'SNCF', 'canal mentionné'),
  L('CB TOTAL ACCESS 0456 TOURNAY', 'Total Access', 'carburant, code, ville'),
  L('CB DECATHLON 1587 LILLE', 'Decathlon', 'numéro de magasin'),
  L('CB IKEA FRANCE SAS', 'IKEA', 'forme juridique'),
  L('PRLV ASSURANCE MAIF SOCIETAIRE', 'MAIF', 'assurance, mot parasite'),
  L('CB LEROY MERLIN 12/10', 'Leroy Merlin', 'date séparée'),
  L('CB AMAZON PAYMENTS REF : 1234567', 'Amazon', 'référence explicite'),
  L('CB FNAC DARTY PARTICIPATIONS', 'Fnac', 'raison sociale longue'),
  L('CB UBER EATS HELP UBER COM', 'Uber Eats', 'domaine d’aide'),
  L('CB BASIC FIT FRANCE', 'Basic-Fit', 'enseigne et pays'),
  L('PRLV HARMONIE MUTUELLE COTIS', 'Harmonie Mutuelle', 'mutuelle, abréviation'),

  /* ── Accents, casse et ponctuation ────────────────────────────────── */
  L('cb carrefour market tournay', 'Carrefour Market', 'minuscules'),
  L('CB Décathlon Tournay', 'Decathlon', 'accent et casse mêlés'),
  L('CB L.D.L.C. COM', 'LDLC', 'points dans le nom'),
  L('CB E.LECLERC DRIVE', 'E.Leclerc', 'point et service'),
  L('CB BRICO-DEPOT TOURNAY', 'Brico Dépôt', 'tiret'),

  /* ── Intermédiaires de paiement ───────────────────────────────────── */
  L('CB PAYPAL *DECATHLON', 'Decathlon', 'intermédiaire, vendeur lisible'),
  L('CB PAYPAL *SPOTIFY AB', 'Spotify', 'intermédiaire, suffixe'),
  L('CB SUMUP *LE FOURNIL', 'Fournil', 'intermédiaire, commerce local'),
  L('CB PAYPAL 4039035165', 'PAYPAL', 'intermédiaire sans vendeur lisible'),

  /* ── Motifs génériques ────────────────────────────────────────────── */
  L('RETRAIT DAB GARE DU NORD 12/10', 'Retrait au distributeur', 'retrait'),
  L('VIREMENT DE M ALEXIS POUSSET', 'Virement reçu', 'virement reçu'),
  L('COTISATION CARTE BANCAIRE', 'Cotisation carte', 'frais récurrents'),
  L('FRAIS DE TENUE DE COMPTE', 'Frais de tenue de compte', 'frais bancaires'),
  L('REMISE DE CHEQUE 004', 'Remise de chèque', 'chèque, numéro de bordereau'),
  L('ECHEANCE PRET IMMOBILIER', 'Échéance de prêt', 'crédit'),

  /* ── Administrations et revenus ───────────────────────────────────── */
  L('VIR DGFIP IMPOT REVENU', 'DGFiP', 'impôt'),
  L('PRLV TAXE FONCIERE 2026', 'Taxe foncière', 'taxe et millésime'),
  L('VIR URSSAF COTISATIONS', 'URSSAF', 'organisme social'),
  L('VIR FRANCE TRAVAIL ALLOCATION', 'France Travail', 'prestation'),
  L('VIR SALAIRE OCTOBRE 2026', 'Salaire', 'salaire, mois'),

  /* ── Ce qui ne doit **rien** reconnaître ──────────────────────────── */
  L('CB LE FOURNIL DE TOURNAY 0310', 'Fournil', 'commerce local, motif générique'),
  L('CB SARL MARTIN PLOMBERIE', null, 'artisan inconnu'),
  L('CB ETS DURAND ET FILS', null, 'entreprise inconnue'),
  L('CB BRASSERIE DU PORT', 'Brasserie', 'générique, pas une enseigne'),
  L('VIR M DUPONT LOYER', 'Loyer', 'particulier, motif générique'),
  L('CB LA CAVE A VINS 0912', null, 'commerce local inconnu'),
  L('CB ZZQW TRADING LTD', null, 'société inconnue'),

  /* ── Les pièges : un vendeur proche mais différent ────────────────── */
  L('CB BOULANGERIE PAUL ET MARIE', 'Boulangerie', 'ne doit pas être l’enseigne Boulanger'),
  L('CB CARREFOUR BANQUE', 'Carrefour', 'filiale, pas le supermarché'),
  L('CB FREE HAUT DEBIT', 'Free', 'distinguer Free de Free Mobile'),
  L('CB TOTALENERGIES PROXI', 'TotalEnergies', 'marque ombrelle'),
];

/** Les libellés dont on attend qu'aucun vendeur ne soit reconnu. */
export const SANS_VENDEUR = LIBELLES.filter((l) => l.attendu === null);
