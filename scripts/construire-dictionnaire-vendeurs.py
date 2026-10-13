#!/usr/bin/env python3
"""Fabrique `src/donnees/vendeurs.json`, en refusant ce qui ne doit pas y entrer.

Le dictionnaire est écrit **à la main**, sans reprise d'aucune liste tierce.
Il repose sur la connaissance des enseignes et des formats de libellés
français, et **n'a pas été vérifié sur des relevés réels** : sa couverture ne
se connaîtra qu'à l'usage.

Ce script existe pour que les contraintes du plan soient tenues par une
machine plutôt que par l'attention : un motif trop court, un motif trop
courant, ou deux entrées qui se disputent le même motif font échouer la
construction.
"""
import json
import re
import sys
import unicodedata


def norm(t: str) -> str:
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = re.sub(r'[^A-Z0-9 ]+', ' ', t.upper())
    return re.sub(r'\s+', ' ', t).strip()


# Les sigles de trois lettres admis, un par un et pour la même raison : ils ne
# sont ni un mot français, ni de la plomberie bancaire, et ils désignent une
# seule enseigne. « BUT », « NOZ », « DON » et « CAF » ont été écartés
# justement parce qu'ils sont aussi des mots courants.
COURTES_ADMISES = {'EDF', 'SFR', 'AXA', 'KFC', 'GMF', 'OVH'}

# Le dictionnaire a une liste d'interdits **plus courte** que celle des règles
# écrites à la main, et c'est délibéré : `RETRAIT`, `VIREMENT`, `COTISATION`,
# `CHEQUE` sont précisément les motifs génériques que le plan veut embarquer,
# et ils sont relus ici un par un. Une règle tapée en trois secondes dans un
# écran n'a pas cette relecture.
INTERDITS = {
    'CB', 'PAIEMENT', 'ACHAT', 'FACT', 'PRLV', 'PRELEVEMENT', 'PRELV', 'SEPA',
    'TIP', 'ECH', 'DEBIT', 'VIR', 'CARTE',
    'FRANCE', 'PARIS', 'SARL', 'SAS', 'EURL', 'SCI', 'SOCIETE', 'MAGASIN',
    'BOUTIQUE', 'CENTRE', 'SERVICE', 'SERVICES', 'GROUPE',
}

E: list[dict] = []


def e(motifs, nom, type_id, statut, generique=False):
    """Ajoute une entrée.

    `generique` marque les motifs qui ne nomment aucune enseigne — RETRAIT,
    COTISATION, ABONNEMENT. Ils sont un **filet**, jamais un concurrent :
    sans ce drapeau, « PRELEVEMENT SFR ABONNEMENT » se classe en
    « Abonnement » parce que le mot est plus long que « SFR ». La mesure l'a
    montré sur quatre libellés du jeu synthétique.
    """
    E.append({'motifs': [norm(m) for m in motifs], 'nom': nom,
              'type': type_id, 'statut': statut, 'generique': generique})


# ── Alimentation ─────────────────────────────────────────────────────────
e(['CARREFOUR CITY'], 'Carrefour City', 'superette', 'sur')
e(['CARREFOUR CONTACT'], 'Carrefour Contact', 'superette', 'sur')
e(['CARREFOUR EXPRESS'], 'Carrefour Express', 'superette', 'sur')
e(['CARREFOUR MARKET'], 'Carrefour Market', 'supermarche', 'sur')
e(['CARREFOUR'], 'Carrefour', 'commerce-multi-categories', 'ambigu')
e(['E LECLERC', 'ELECLERC', 'LECLERC'], 'E.Leclerc', 'commerce-multi-categories', 'ambigu')
e(['INTERMARCHE'], 'Intermarché', 'commerce-multi-categories', 'ambigu')
e(['SUPER U', 'HYPER U', 'MAGASINS U', 'U EXPRESS'], 'Système U', 'commerce-multi-categories', 'ambigu')
e(['AUCHAN'], 'Auchan', 'commerce-multi-categories', 'ambigu')
e(['CASINO SUPERMARCHE', 'GEANT CASINO'], 'Casino', 'commerce-multi-categories', 'ambigu')
e(['MONOPRIX'], 'Monoprix', 'supermarche', 'sur')
e(['FRANPRIX'], 'Franprix', 'superette', 'sur')
e(['LIDL'], 'Lidl', 'supermarche', 'sur')
e(['ALDI'], 'Aldi', 'supermarche', 'sur')
e(['NETTO'], 'Netto', 'supermarche', 'sur')
e(['CORA'], 'Cora', 'commerce-multi-categories', 'ambigu')
e(['GRAND FRAIS'], 'Grand Frais', 'primeur', 'sur')
e(['BIOCOOP'], 'Biocoop', 'epicerie-specialisee', 'sur')
e(['NATURALIA'], 'Naturalia', 'epicerie-specialisee', 'sur')
e(['LA VIE CLAIRE'], 'La Vie Claire', 'epicerie-specialisee', 'sur')
# « Picard » est aussi un nom de famille : « VIR M PICARD » classerait un
# virement à une personne en surgelés. Le statut « ambigu » suffit à en faire
# une proposition plutôt qu'un pointage.
e(['PICARD'], 'Picard', 'epicerie-specialisee', 'ambigu')
e(['THIRIET'], 'Thiriet', 'epicerie-specialisee', 'sur')
e(['BOULANGERIE'], 'Boulangerie', 'boulangerie', 'ambigu', generique=True)
e(['FOURNIL'], 'Fournil', 'boulangerie', 'ambigu', generique=True)
e(['BOUCHERIE'], 'Boucherie', 'boucherie', 'ambigu', generique=True)
e(['PRIMEUR'], 'Primeur', 'primeur', 'ambigu', generique=True)
e(['MARCHE COUVERT'], 'Marché couvert', 'marche', 'ambigu', generique=True)
e(['DELIVEROO'], 'Deliveroo', 'livraison-repas', 'sur')
e(['UBER EATS', 'UBEREATS'], 'Uber Eats', 'livraison-repas', 'sur')
e(['JUST EAT'], 'Just Eat', 'livraison-repas', 'sur')
e(['FRICHTI'], 'Frichti', 'livraison-repas', 'sur')
e(['HELLOFRESH'], 'HelloFresh', 'livraison-repas', 'sur')
e(['NESPRESSO'], 'Nespresso', 'epicerie-specialisee', 'sur')

# ── Restauration ─────────────────────────────────────────────────────────
e(['MCDONALD', 'MC DONALD'], "McDonald's", 'restauration-rapide', 'sur')
e(['BURGER KING'], 'Burger King', 'restauration-rapide', 'sur')
e(['KFC'], 'KFC', 'restauration-rapide', 'sur')
e(['SUBWAY'], 'Subway', 'restauration-rapide', 'sur')
e(['DOMINO S PIZZA', 'DOMINOS PIZZA'], "Domino's Pizza", 'restauration-rapide', 'sur')
e(['PIZZA HUT'], 'Pizza Hut', 'restauration-rapide', 'sur')
e(['BRIOCHE DOREE'], 'Brioche Dorée', 'restauration-rapide', 'sur')
e(['STARBUCKS'], 'Starbucks', 'cafe-bar', 'sur')
e(['COLUMBUS CAFE'], 'Columbus Café', 'cafe-bar', 'sur')
e(['FLUNCH'], 'Flunch', 'restaurant', 'sur')
e(['BUFFALO GRILL'], 'Buffalo Grill', 'restaurant', 'sur')
e(['HIPPOPOTAMUS'], 'Hippopotamus', 'restaurant', 'sur')
e(['COURTEPAILLE'], 'Courtepaille', 'restaurant', 'sur')
e(['LA BOUCHERIE'], 'La Boucherie', 'restaurant', 'ambigu')
e(['CROUS'], 'CROUS', 'cantine', 'sur')
e(['SODEXO'], 'Sodexo', 'cantine', 'sur')
e(['ELIOR'], 'Elior', 'cantine', 'sur')
e(['RESTAURANT'], 'Restaurant', 'restaurant', 'ambigu', generique=True)
e(['BRASSERIE'], 'Brasserie', 'restaurant', 'ambigu', generique=True)
e(['PIZZERIA'], 'Pizzeria', 'restaurant', 'ambigu', generique=True)

# ── Transports ───────────────────────────────────────────────────────────
e(['TOTALENERGIES', 'TOTAL ENERGIES'], 'TotalEnergies', 'carburant', 'ambigu')
e(['TOTAL ACCESS'], 'Total Access', 'carburant', 'sur')
e(['ESSO'], 'Esso', 'carburant', 'sur')
e(['BP FRANCE'], 'BP', 'carburant', 'sur')
e(['SHELL'], 'Shell', 'carburant', 'sur')
e(['STATION SERVICE'], 'Station-service', 'carburant', 'ambigu', generique=True)
e(['VINCI AUTOROUTES'], 'Vinci Autoroutes', 'peage', 'sur')
e(['APRR'], 'APRR', 'peage', 'sur')
e(['SANEF'], 'Sanef', 'peage', 'sur')
e(['ESCOTA'], 'Escota', 'peage', 'sur')
e(['ULYS'], 'Ulys', 'peage', 'sur')
e(['BIP AND GO', 'BIPANDGO'], 'Bip&Go', 'peage', 'sur')
e(['INDIGO PARK', 'PARKING INDIGO'], 'Indigo', 'stationnement', 'sur')
e(['EFFIA'], 'Effia', 'stationnement', 'sur')
e(['PAYBYPHONE'], 'PayByPhone', 'stationnement', 'sur')
e(['ONEPARK'], 'OnePark', 'stationnement', 'sur')
e(['HORODATEUR'], 'Horodateur', 'stationnement', 'ambigu', generique=True)
e(['SNCF CONNECT', 'SNCF VOYAGEURS', 'SNCF'], 'SNCF', 'train', 'sur')
e(['OUIGO'], 'OUIGO', 'train', 'sur')
e(['TRAINLINE'], 'Trainline', 'train', 'sur')
e(['RATP'], 'RATP', 'transport-public', 'sur')
e(['NAVIGO'], 'Navigo', 'transport-public', 'sur')
e(['TRANSDEV'], 'Transdev', 'transport-public', 'sur')
e(['KEOLIS'], 'Keolis', 'transport-public', 'sur')
e(['BLABLACAR'], 'BlaBlaCar', 'transport-public', 'sur')
e(['FLIXBUS'], 'FlixBus', 'transport-public', 'sur')
e(['AIR FRANCE'], 'Air France', 'avion', 'sur')
e(['EASYJET'], 'easyJet', 'avion', 'sur')
e(['RYANAIR'], 'Ryanair', 'avion', 'sur')
e(['TRANSAVIA'], 'Transavia', 'avion', 'sur')
e(['UBER TRIP', 'UBER BV'], 'Uber', 'taxi-vtc', 'sur')
e(['BOLT EU'], 'Bolt', 'taxi-vtc', 'sur')
e(['TAXIS G7', 'G7 TAXI'], 'G7', 'taxi-vtc', 'sur')
e(['EUROPCAR'], 'Europcar', 'location-vehicule', 'sur')
e(['HERTZ'], 'Hertz', 'location-vehicule', 'sur')
e(['AVIS LOCATION'], 'Avis', 'location-vehicule', 'sur')
e(['SIXT'], 'Sixt', 'location-vehicule', 'sur')
e(['GETAROUND'], 'Getaround', 'location-vehicule', 'sur')
e(['NORAUTO'], 'Norauto', 'entretien-auto', 'sur')
e(['FEU VERT'], 'Feu Vert', 'entretien-auto', 'sur')
e(['MIDAS'], 'Midas', 'entretien-auto', 'sur')
e(['SPEEDY'], 'Speedy', 'entretien-auto', 'sur')
e(['ROADY'], 'Roady', 'entretien-auto', 'sur')
e(['CONTROLE TECHNIQUE'], 'Contrôle technique', 'entretien-auto', 'ambigu', generique=True)
e(['GARAGE'], 'Garage', 'entretien-auto', 'ambigu', generique=True)

# ── Logement ─────────────────────────────────────────────────────────────
e(['LEROY MERLIN'], 'Leroy Merlin', 'travaux-bricolage', 'sur')
e(['CASTORAMA'], 'Castorama', 'travaux-bricolage', 'sur')
e(['BRICORAMA'], 'Bricorama', 'travaux-bricolage', 'sur')
e(['BRICO DEPOT'], 'Brico Dépôt', 'travaux-bricolage', 'sur')
e(['MR BRICOLAGE'], 'Mr.Bricolage', 'travaux-bricolage', 'sur')
e(['POINT P'], 'Point.P', 'travaux-bricolage', 'sur')
e(['IKEA'], 'IKEA', 'ameublement', 'sur')
e(['CONFORAMA'], 'Conforama', 'ameublement', 'sur')
e(['MAISONS DU MONDE'], 'Maisons du Monde', 'ameublement', 'sur')
e(['ALINEA'], 'Alinéa', 'ameublement', 'sur')
e(['FONCIA'], 'Foncia', 'charges-copropriete', 'sur')
e(['NEXITY'], 'Nexity', 'charges-copropriete', 'sur')
e(['CITYA'], 'Citya', 'charges-copropriete', 'sur')
e(['SERGIC'], 'Sergic', 'charges-copropriete', 'sur')
e(['SYNDIC'], 'Syndic', 'charges-copropriete', 'ambigu', generique=True)
e(['LOYER'], 'Loyer', 'loyer', 'ambigu', generique=True)
e(['QUITTANCE'], 'Quittance de loyer', 'loyer', 'ambigu', generique=True)

# ── Énergie et eau ───────────────────────────────────────────────────────
e(['EDF'], 'EDF', 'electricite-gaz', 'sur')
e(['ENGIE'], 'Engie', 'electricite-gaz', 'sur')
e(['ENI GAS', 'ENI FRANCE'], 'Eni', 'electricite-gaz', 'sur')
e(['EKWATEUR'], 'ekWateur', 'electricite-gaz', 'sur')
e(['ENERCOOP'], 'Enercoop', 'electricite-gaz', 'sur')
e(['PLANETE OUI'], 'Planète Oui', 'electricite-gaz', 'sur')
e(['MINT ENERGIE'], 'Mint Énergie', 'electricite-gaz', 'sur')
e(['ENEDIS'], 'Enedis', 'electricite-gaz', 'sur')
e(['GRDF'], 'GRDF', 'electricite-gaz', 'sur')
e(['VEOLIA'], 'Veolia', 'eau', 'sur')
e(['SUEZ'], 'Suez', 'eau', 'sur')
e(['SAUR'], 'Saur', 'eau', 'sur')
e(['SYNDICAT DES EAUX'], 'Syndicat des eaux', 'eau', 'ambigu', generique=True)
e(['FIOUL'], 'Fioul', 'combustibles', 'ambigu', generique=True)
e(['BUTAGAZ'], 'Butagaz', 'combustibles', 'sur')
e(['ANTARGAZ'], 'Antargaz', 'combustibles', 'sur')

# ── Télécoms ─────────────────────────────────────────────────────────────
e(['ORANGE FRANCE', 'ORANGE SA', 'ORANGE'], 'Orange', 'operateur-mobile', 'ambigu')
e(['SFR'], 'SFR', 'operateur-mobile', 'sur')
e(['BOUYGUES TELECOM'], 'Bouygues Telecom', 'operateur-mobile', 'sur')
e(['FREE MOBILE'], 'Free Mobile', 'operateur-mobile', 'sur')
e(['FREE HAUT DEBIT', 'FREE SAS'], 'Free', 'acces-internet', 'sur')
e(['SOSH'], 'Sosh', 'operateur-mobile', 'sur')
e(['RED BY SFR'], 'RED by SFR', 'operateur-mobile', 'sur')
e(['PRIXTEL'], 'Prixtel', 'operateur-mobile', 'sur')
e(['LA POSTE MOBILE'], 'La Poste Mobile', 'operateur-mobile', 'sur')
e(['SYMA MOBILE'], 'Syma Mobile', 'operateur-mobile', 'sur')
e(['NRJ MOBILE'], 'NRJ Mobile', 'operateur-mobile', 'sur')
e(['CORIOLIS'], 'Coriolis', 'operateur-mobile', 'sur')

# ── Assurances et santé ──────────────────────────────────────────────────
e(['MAIF'], 'MAIF', 'assurance', 'sur')
e(['MACIF'], 'MACIF', 'assurance', 'sur')
e(['MATMUT'], 'Matmut', 'assurance', 'sur')
e(['GMF'], 'GMF', 'assurance', 'sur')
e(['AXA'], 'AXA', 'assurance', 'ambigu')
e(['ALLIANZ'], 'Allianz', 'assurance', 'ambigu')
e(['GROUPAMA'], 'Groupama', 'assurance', 'ambigu')
e(['MAAF'], 'MAAF', 'assurance', 'sur')
e(['DIRECT ASSURANCE'], 'Direct Assurance', 'assurance', 'sur')
e(['LUKO'], 'Luko', 'assurance', 'sur')
e(['LOVYS'], 'Lovys', 'assurance', 'sur')
e(['ASSURANCE'], 'Assurance', 'assurance', 'ambigu', generique=True)
e(['HARMONIE MUTUELLE'], 'Harmonie Mutuelle', 'mutuelle', 'sur')
e(['MGEN'], 'MGEN', 'mutuelle', 'sur')
e(['MUTUELLE'], 'Mutuelle', 'mutuelle', 'ambigu', generique=True)
e(['ALAN SA'], 'Alan', 'mutuelle', 'sur')
e(['PHARMACIE'], 'Pharmacie', 'pharmacie', 'ambigu', generique=True)
e(['LABORATOIRE'], 'Laboratoire', 'laboratoire', 'ambigu', generique=True)
e(['BIOGROUP'], 'Biogroup', 'laboratoire', 'sur')
e(['CERBALLIANCE'], 'Cerballiance', 'laboratoire', 'sur')
e(['DOCTOLIB'], 'Doctolib', 'praticien', 'sur')
e(['CABINET MEDICAL'], 'Cabinet médical', 'praticien', 'ambigu', generique=True)
e(['CENTRE HOSPITALIER'], 'Centre hospitalier', 'hopital', 'ambigu', generique=True)
e(['OPTIC 2000'], 'Optic 2000', 'praticien', 'sur')
e(['KRYS'], 'Krys', 'praticien', 'sur')
e(['ALAIN AFFLELOU'], 'Alain Afflelou', 'praticien', 'sur')
e(['GRAND OPTICAL'], 'Grand Optical', 'praticien', 'sur')

# ── Abonnements ──────────────────────────────────────────────────────────
e(['NETFLIX'], 'Netflix', 'streaming-video', 'sur')
e(['DISNEY PLUS', 'DISNEYPLUS'], 'Disney+', 'streaming-video', 'sur')
e(['CANAL PLUS', 'CANALPLUS'], 'Canal+', 'streaming-video', 'sur')
e(['PRIME VIDEO'], 'Prime Video', 'streaming-video', 'sur')
e(['PARAMOUNT PLUS'], 'Paramount+', 'streaming-video', 'sur')
e(['MOLOTOV'], 'Molotov', 'streaming-video', 'sur')
e(['SPOTIFY'], 'Spotify', 'musique', 'sur')
e(['DEEZER'], 'Deezer', 'musique', 'sur')
e(['APPLE MUSIC'], 'Apple Music', 'musique', 'sur')
e(['YOUTUBE PREMIUM'], 'YouTube Premium', 'musique', 'sur')
e(['LE MONDE'], 'Le Monde', 'presse', 'sur')
e(['MEDIAPART'], 'Mediapart', 'presse', 'sur')
e(['LIBERATION'], 'Libération', 'presse', 'sur')
e(['LE FIGARO'], 'Le Figaro', 'presse', 'sur')
e(['LES ECHOS'], 'Les Échos', 'presse', 'sur')
e(['TELERAMA'], 'Télérama', 'presse', 'sur')
e(['ADOBE'], 'Adobe', 'logiciel', 'sur')
e(['MICROSOFT'], 'Microsoft', 'logiciel', 'ambigu')
e(['GOOGLE ONE'], 'Google One', 'logiciel', 'sur')
e(['ICLOUD', 'APPLE COM BILL'], 'Apple', 'logiciel', 'ambigu')
e(['DROPBOX'], 'Dropbox', 'logiciel', 'sur')
e(['OVH'], 'OVH', 'logiciel', 'sur')
e(['BASIC FIT', 'BASICFIT'], 'Basic-Fit', 'salle-de-sport', 'sur')
e(['FITNESS PARK'], 'Fitness Park', 'salle-de-sport', 'sur')
e(['NEONESS'], 'Neoness', 'salle-de-sport', 'sur')
e(['KEEP COOL'], 'Keep Cool', 'salle-de-sport', 'sur')

# ── Commerce ─────────────────────────────────────────────────────────────
e(['AMAZON'], 'Amazon', 'commerce-multi-categories', 'ambigu')
e(['CDISCOUNT'], 'Cdiscount', 'commerce-multi-categories', 'ambigu')
e(['FNAC'], 'Fnac', 'culture-loisirs', 'ambigu')
e(['DARTY'], 'Darty', 'equipement', 'sur')
# « BOULANGER » est contenu dans « BOULANGERIE », et la règle du motif le
# plus long sauve « BOULANGERIE DUPONT » — mais pas « BOULANGER DUPONT ».
# Marqué sûr, l'enseigne d'électroménager pointerait automatiquement une
# boulangerie. Ambigu, elle se contente de proposer.
e(['BOULANGER'], 'Boulanger', 'equipement', 'ambigu')
e(['LDLC', 'L D L C'], 'LDLC', 'equipement', 'sur')
e(['RUE DU COMMERCE'], 'Rue du Commerce', 'equipement', 'sur')
e(['VEEPEE'], 'Veepee', 'commerce-multi-categories', 'ambigu')
e(['ZALANDO'], 'Zalando', 'habillement', 'sur')
e(['VINTED'], 'Vinted', 'habillement', 'sur')
e(['DECATHLON'], 'Decathlon', 'culture-loisirs', 'sur')
e(['INTERSPORT'], 'Intersport', 'culture-loisirs', 'sur')
e(['GO SPORT'], 'Go Sport', 'culture-loisirs', 'sur')
e(['KIABI'], 'Kiabi', 'habillement', 'sur')
e(['ZARA'], 'Zara', 'habillement', 'sur')
e(['H ET M', 'H M FRANCE'], 'H&M', 'habillement', 'sur')
e(['UNIQLO'], 'Uniqlo', 'habillement', 'sur')
e(['CELIO'], 'Celio', 'habillement', 'sur')
e(['PRIMARK'], 'Primark', 'habillement', 'sur')
e(['GEMO'], 'Gémo', 'habillement', 'sur')
e(['LA HALLE'], 'La Halle', 'habillement', 'sur')
e(['CHAUSSEA'], 'Chausséa', 'habillement', 'sur')
e(['GIFI'], 'GiFi', 'equipement', 'sur')
e(['CULTURA'], 'Cultura', 'culture-loisirs', 'sur')
e(['MICROMANIA'], 'Micromania', 'culture-loisirs', 'sur')
e(['JOUECLUB'], 'JouéClub', 'culture-loisirs', 'sur')
e(['KING JOUET'], 'King Jouet', 'culture-loisirs', 'sur')
e(['NATURE ET DECOUVERTES'], 'Nature & Découvertes', 'culture-loisirs', 'sur')
e(['UGC CINE'], 'UGC', 'culture-loisirs', 'sur')
e(['CINEMAS PATHE', 'PATHE GAUMONT'], 'Pathé', 'culture-loisirs', 'sur')
e(['MAXI ZOO', 'MAXIZOO'], 'Maxi Zoo', 'animalerie', 'sur')
e(['ANIMALIS'], 'Animalis', 'animalerie', 'sur')
e(['VETERINAIRE'], 'Vétérinaire', 'animalerie', 'ambigu', generique=True)
e(['TRUFFAUT'], 'Truffaut', 'animalerie', 'ambigu')
e(['JARDILAND'], 'Jardiland', 'animalerie', 'ambigu')
e(['SEPHORA'], 'Sephora', 'equipement', 'sur')
e(['NOCIBE'], 'Nocibé', 'equipement', 'sur')
e(['MARIONNAUD'], 'Marionnaud', 'equipement', 'sur')
e(['YVES ROCHER'], 'Yves Rocher', 'equipement', 'sur')

# ── Banque ───────────────────────────────────────────────────────────────
e(['COTISATION CARTE'], 'Cotisation carte', 'frais-bancaires', 'sur')
e(['FRAIS DE TENUE DE COMPTE'], 'Frais de tenue de compte', 'frais-bancaires', 'sur')
e(['COMMISSION D INTERVENTION'], 'Commission d’intervention', 'frais-bancaires', 'sur')
e(['AGIOS'], 'Agios', 'frais-bancaires', 'sur')
e(['FRAIS SUR VIREMENT'], 'Frais sur virement', 'frais-bancaires', 'sur')
e(['INTERETS CREDITEURS'], 'Intérêts créditeurs', 'interets', 'sur')
e(['RETRAIT DAB'], 'Retrait au distributeur', 'retrait', 'sur')
e(['RETRAIT ESPECES'], 'Retrait d’espèces', 'retrait', 'sur')
e(['RETRAIT'], 'Retrait', 'retrait', 'ambigu', generique=True)
e(['ECHEANCE PRET', 'REMBOURSEMENT PRET'], 'Échéance de prêt', 'remboursement-credit', 'sur')
e(['CREDIT AGRICOLE'], 'Crédit Agricole', 'frais-bancaires', 'ambigu')
e(['CREDIT MUTUEL'], 'Crédit Mutuel', 'frais-bancaires', 'ambigu')
e(['BNP PARIBAS'], 'BNP Paribas', 'frais-bancaires', 'ambigu')
e(['SOCIETE GENERALE'], 'Société Générale', 'frais-bancaires', 'ambigu')
e(['LA BANQUE POSTALE'], 'La Banque Postale', 'frais-bancaires', 'ambigu')
e(['CAISSE D EPARGNE'], 'Caisse d’Épargne', 'frais-bancaires', 'ambigu')
e(['BOURSORAMA'], 'BoursoBank', 'frais-bancaires', 'ambigu')
e(['FORTUNEO'], 'Fortuneo', 'frais-bancaires', 'ambigu')
e(['HELLO BANK'], 'Hello bank!', 'frais-bancaires', 'ambigu')
e(['REVOLUT'], 'Revolut', 'frais-bancaires', 'ambigu')

# ── Administrations ──────────────────────────────────────────────────────
e(['DGFIP'], 'DGFiP', 'impots-taxes', 'sur')
e(['IMPOTS'], 'Impôts', 'impots-taxes', 'sur')
e(['TRESOR PUBLIC'], 'Trésor public', 'impots-taxes', 'ambigu')
e(['TAXE FONCIERE'], 'Taxe foncière', 'impots-taxes', 'sur')
e(['TAXE HABITATION'], 'Taxe d’habitation', 'impots-taxes', 'sur')
e(['ANTAI'], 'ANTAI', 'amende', 'sur')
e(['AMENDE'], 'Amende', 'amende', 'ambigu', generique=True)
e(['ANTS'], 'ANTS', 'administration', 'sur')
e(['PREFECTURE'], 'Préfecture', 'administration', 'ambigu', generique=True)
e(['MAIRIE'], 'Mairie', 'administration', 'ambigu', generique=True)
e(['LA POSTE'], 'La Poste', 'administration', 'ambigu')
e(['URSSAF'], 'URSSAF', 'organisme-social', 'sur')
e(['CPAM'], 'CPAM', 'organisme-social', 'sur')
e(['AMELI'], 'Ameli', 'organisme-social', 'sur')
e(['CARSAT'], 'CARSAT', 'organisme-social', 'sur')
e(['POLE EMPLOI', 'FRANCE TRAVAIL'], 'France Travail', 'organisme-social', 'sur')
e(['ALLOCATIONS FAMILIALES'], 'Allocations familiales', 'organisme-social', 'sur')

# ── Revenus et épargne ───────────────────────────────────────────────────
e(['SALAIRE'], 'Salaire', 'employeur', 'ambigu', generique=True)
e(['REMUNERATION'], 'Rémunération', 'employeur', 'ambigu', generique=True)
e(['PENSION'], 'Pension', 'pension', 'ambigu', generique=True)
e(['RETRAITE'], 'Retraite', 'pension', 'ambigu', generique=True)
e(['ALLOCATION'], 'Allocation', 'prestation-sociale', 'ambigu', generique=True)
e(['LIVRET A'], 'Livret A', 'virement-epargne', 'sur')
e(['LIVRET DEVELOPPEMENT DURABLE', 'LDDS'], 'LDDS', 'virement-epargne', 'sur')
e(['PLAN EPARGNE LOGEMENT'], 'PEL', 'virement-epargne', 'sur')
e(['ASSURANCE VIE'], 'Assurance vie', 'placement', 'ambigu', generique=True)

# ── Motifs génériques ────────────────────────────────────────────────────
# La part la plus sûre du dictionnaire, et la plus durable : ils ne nomment
# aucune enseigne, ne vieillissent pas, et couvrent les lignes qu'aucun
# dictionnaire d'enseignes n'attrape.
e(['VIREMENT DE'], 'Virement reçu', 'employeur', 'ambigu', generique=True)
e(['VIREMENT A'], 'Virement émis', 'virement-epargne', 'ambigu', generique=True)
e(['VIREMENT EN VOTRE FAVEUR'], 'Virement reçu', 'employeur', 'ambigu', generique=True)
e(['CHEQUE'], 'Chèque', 'frais-bancaires', 'ambigu', generique=True)
e(['REMISE DE CHEQUE'], 'Remise de chèque', 'frais-bancaires', 'ambigu', generique=True)
e(['COTISATION'], 'Cotisation', 'frais-bancaires', 'ambigu', generique=True)
e(['REMBOURSEMENT'], 'Remboursement', 'frais-bancaires', 'ambigu', generique=True)
e(['ABONNEMENT'], 'Abonnement', 'logiciel', 'ambigu', generique=True)
e(['FACTURE'], 'Facture', 'administration', 'ambigu', generique=True)
e(['ADHESION'], 'Adhésion', 'administration', 'ambigu', generique=True)
e(['PARKING'], 'Parking', 'stationnement', 'ambigu', generique=True)
e(['PEAGE'], 'Péage', 'peage', 'ambigu', generique=True)
e(['CARBURANT'], 'Carburant', 'carburant', 'ambigu', generique=True)
e(['INTERETS'], 'Intérêts', 'interets', 'ambigu', generique=True)
e(['FRAIS BANCAIRES'], 'Frais bancaires', 'frais-bancaires', 'sur', generique=True)


# ── Les contrôles, tenus par la machine ──────────────────────────────────
problemes: list[str] = []
proprietaire: dict[str, str] = {}
for entree in E:
    for motif in entree['motifs']:
        compact = motif.replace(' ', '')
        if len(compact) < 4 and motif not in COURTES_ADMISES:
            problemes.append(f"motif trop court : « {motif} » ({entree['nom']})")
        if motif in INTERDITS:
            problemes.append(f"motif trop courant : « {motif} » ({entree['nom']})")
        if motif in proprietaire and proprietaire[motif] != entree['nom']:
            problemes.append(
                f"motif « {motif} » disputé par {proprietaire[motif]} et {entree['nom']}")
        proprietaire[motif] = entree['nom']
    if not entree['type']:
        problemes.append(f"entrée sans type : {entree['nom']}")
    if entree['statut'] not in ('sur', 'ambigu'):
        problemes.append(f"statut inconnu : {entree['nom']}")

if problemes:
    print('\n'.join(problemes), file=sys.stderr)
    sys.exit(1)

doc = {
    'version': '2026-10-13',
    'note': (
        "Écrit à la main, sans reprise d'aucune liste tierce. Les entrées "
        "reposent sur la connaissance des enseignes et des formats de libellés "
        "français, et n'ont PAS été vérifiées sur des relevés réels : leur "
        "couverture ne se connaîtra qu'à l'usage."
    ),
    'entrees': E,
}
with open('src/donnees/vendeurs.json', 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
    f.write('\n')

surs = sum(1 for x in E if x['statut'] == 'sur')
print(f"{len(E)} entrées, {surs} sûres, {len(E) - surs} ambiguës, "
      f"{sum(len(x['motifs']) for x in E)} motifs.")
