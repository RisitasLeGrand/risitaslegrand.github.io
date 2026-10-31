# Inventaire des organigrammes types de la DGFiP — 25 octobre 2026

Premier temps du prompt 61. Cet inventaire dit ce qui est déjà écrit, ce que les
sources permettent d'écrire, ce qu'elles ne permettent pas, et dans quel ordre
les lots d'organigrammes peuvent suivre. Aucun contenu de fiche n'est reproduit
ici, et aucun nom de personne n'est retenu.

**Convention d'honnêteté.** « **Exécuté et constaté** » = j'ai lancé la commande
et lu sa sortie. « **Lu dans la source** » = j'ai ouvert le document et lu la
phrase. « **Relevé dans l'index de la collecte** » = la ligne vient du tableau
CSV de la collecte du 14 octobre, qui est le travail d'une IA tierce et que je
n'ai pas recoupé document par document. « **Supposé** » = raisonnement de ma
part, signalé comme tel.

---

## 1. Ce qui est déjà écrit, et où il se trouve

Deux fiches existent dans la matière « Organisation de la DGFiP », écrites au
lot du 17 octobre et décrites au § 1.2 de `docs/cyclades/contenu-dgfip-2026-10-17.md` :

| Fiche | Objet |
|---|---|
| `fiche-01-administration-centrale-de-la-dgfip` | l'administration centrale : deux directions, sept services, deux délégations, et l'écart entre l'arrêté et l'organigramme publié |
| `fiche-02-reseau-deconcentre-et-services-de-proximite` | les quatre catégories de services déconcentrés, les services de proximité, les anciennes appellations |

**Ces deux fichiers ne sont pas dans ce conteneur** — exécuté et constaté :
`content/` n'y porte que `droit-public`, `questions-internationales`,
`glossaire.yml` et `actualites-cle-privee.json`, soit trois fiches en tout. Le
corpus n'a jamais été versionné, et il n'a pas été remis en place ici.

**Conséquence sur le déplacement vers la matière commune.** Le passage de
`dgfip-a/organisation-dgfip/` à `commun/organisation-dgfip/` est un déplacement
de deux fichiers qui n'existent que sur la machine d'Alexis. Je ne peux pas
l'exécuter : je peux seulement livrer le chemin d'arrivée exact et le dire en
une ligne au moment du lot. Le déplacement lui-même est un `git mv` impossible
— `content/` n'est pas suivi — donc un `mv` ordinaire, sans rien à committer.

---

## 2. L'état du code pour une matière partagée

Le partage est prêt, et il n'a besoin de rien de plus pour les concours B et A —
lu dans le code, branche `claude/partage-commun`, commit `b55a103` :

- `RACINE_COMMUNE = 'commun'` ;
- les trois parcours `dgfip-b`, `dgfip-a`, `dgfip-ap` déclarent
  `racinesPartagees: [RACINE_COMMUNE]` ; `insp` déclare `[]`, donc la matière ne
  lui est pas servie ;
- le thème `environnement-dgfip` de `dgfip-b` et celui de `dgfip-a` portent le
  même identifiant, le même intitulé et la même matière, `['Organisation de la DGFiP']`.

**Un écart à trancher, pour le concours A+.** `fichesDuTheme`
(`src/lib/planification.ts:313`) rapproche une fiche de son thème **par le nom
exact de la matière**, à la casse près. Or aucun thème de `dgfip-ap` ne porte
« Organisation de la DGFiP » : son épreuve professionnelle porte six matières
d'option, dont « Gestion des ressources et l'organisation de la DGFiP », qui est
le libellé de l'arrêté. Une fiche déposée dans `commun/` serait donc **servie au
parcours A+ sans être proposée par aucune séance**.

Deux issues, et c'est au Pilote de choisir :

1. ajouter `'Organisation de la DGFiP'` à la liste des matières du thème
   `option-metier` de A+ — l'option de l'arrêté nomme bien l'organisation de la
   DGFiP, donc le rattachement est fidèle ;
2. laisser la matière aux seuls B et A, et retirer `commun` des racines
   partagées de A+ pour ne pas servir au parcours un contenu qu'il ne planifie pas.

Je n'applique ni l'une ni l'autre avant sa réponse : la première touche le
programme d'un concours, la seconde défait une décision déjà prise.

---

## 3. Les sources, et leur contrôle

Quatre archives de la collecte du 14 octobre ont été recollées depuis l'artefact
et vérifiées. **Exécuté et constaté** :

| Archive | Empreinte après recollage | Manifeste interne |
|---|---|---|
| `collecte-03-textes-juridiques-B1-A10-A11-structures` | identique à la table publiée | **174 OK, 0 en échec** |
| `collecte-07-B4-organisation-DGFiP-partie1sur3` | identique | **10 OK, 0 en échec** |
| `collecte-08-B4-organisation-DGFiP-partie2sur3` | identique | **42 OK, 0 en échec** |
| `collecte-09-B4-organisation-DGFiP-partie3sur3` | identique | **14 OK, 0 en échec** |

Les documents sont hors du dépôt, dans le répertoire de travail de la session,
et n'y entreront pas. Les PDF utiles rendent bien du texte : l'organigramme de
la DRFiP d'Île-de-France et de Paris de juillet 2025 en rend 2 277 caractères,
le BOFiP `BOI-CF-DG-20` en vigueur 36 729, une annonce de poste 9 709 — exécuté
et constaté avec `pdftotext`.

**Deux textes manquent, et ils manquent exactement là où l'organigramme général
se joue.** L'arrêté du 20 décembre 2019 (administration centrale) et le décret
n° 2009-707 (réseau déconcentré) **ne sont pas dans la collecte** : son
« lisez-moi » les déclare « déjà en main, non collectés sur instruction », et
ils vivaient dans `sources/officiels/`, absent de ce conteneur. Légifrance
répondait `403` à la passerelle au relevé du 13 octobre. Les deux fiches
existantes, elles, ont été écrites quand ces textes étaient là.

**Réserve de forme à porter partout.** 57 PDF de textes juridiques sont des
*reconstitutions* à partir des données ouvertes de la DILA, non les pages
Légifrance ; chacun le déclare en tête, et les XML d'origine sont joints. Les
annonces de poste et les questions écrites décrivent **une direction, à une
date** : elles sont datées comme telles et ne primeront jamais sur un texte.

---

## 4. Le constat qui commande tout le lot

**Il n'existe pas d'organigramme type unique d'une direction départementale.**
Lu dans les sources, trois directions, trois formes, à quelques mois d'écart :

| Direction | Ce que l'annonce écrit |
|---|---|
| Haute-Saône, 2026 | « organisée en 3 pôles (pilotage et ressources, gestion fiscale et gestion publique) et une mission directement rattachée au directeur départemental » |
| Ariège, 2026 | « structurée autour de trois pôles : pôle pilotage et ressources ; pôle gestion fiscale ; pôle gestion publique » |
| Essonne, 2026 | « structurée autour de **deux** pôles dont les responsables sont les adjoints du directeur départemental » — un pôle « Métiers » et un pôle « Pilotage et Ressources » |

Relevé dans l'index de la collecte, non recoupé : l'Eure à quatre pôles, la
Vendée à trois pôles aux intitulés tout autres, le Doubs à deux pôles métiers.

Un organigramme présenté comme « l'organigramme d'une DDFiP » serait donc
**faux pour une bonne part des candidats**, et faux d'une manière qui ne se voit
pas. Chaque organigramme type de ce lot portera par conséquent :

- une **version simplifiée** : le squelette que toutes les directions observées
  partagent — un directeur, des pôles métiers, un pôle de moyens, une mission
  d'audit rattachée au directeur — et rien de plus ;
- une **version détaillée** : les divisions nommées, **direction par direction
  et date par date**, chaque branche citant son document ;
- une phrase qui dit que le nombre et le nom des pôles varient, parce que c'est
  un fait du concours et non une imprécision de la fiche.

C'est le même geste que pour l'écart « sept services à l'arrêté, huit blocs à
l'organigramme » traité dans la fiche 1 : nommer l'écart plutôt que le lisser.

---

## 5. Les organigrammes candidats

Dix objets, classés par ce que les sources tiennent. « Fort » = un texte
d'organisation ou un document officiel décrit la structure ; « moyen » = des
documents officiels mais locaux et datés ; « faible » = l'index de la collecte
porte « non vérifié » sur l'essentiel de la décomposition.

| # | Organigramme | Sources | Tenue |
|---|---|---|---|
| 1 | **La direction départementale type** — pôles de direction, mission risques et audit | 6 annonces 2026 (Haute-Saône, Ariège, Essonne, Eure-et-Loir, Vendée, Bas-Rhin), présentation DRFiP Bretagne 2016 | moyen, nombreux |
| 2 | **La direction régionale type** — les cinq pôles, et ce que le régional ajoute (PRIE, contrôle budgétaire, conseil aux décideurs publics) | organigramme DRFiP Île-de-France et Paris 07/2025, annonces DRFiP Nord et Loire-Atlantique, DRFiP Bretagne 2016 et 2017 | fort |
| 3 | **Le contrôle fiscal local** — PCE, PUC, PCRP, BDV, BCR | BOFiP `BOI-CF-DG-20` (2012, 2013, 2017 en vigueur) et `BOI-CF-DG-30`, 6 annonces 2026, deux questions écrites | fort |
| 4 | **Les directions spécialisées et nationales de contrôle** — DIRCOFI, DVNI, DNVSF, DNEF | arrêtés du 24 juillet 2000 et leur modificatif du 2 août 2013, arrêté DIRCOFI du 16 mars 2012, BOFiP, audition parlementaire 2013, 5 annonces | fort |
| 5 | **Les services de proximité fiscaux** — SIP, SIE et SIE départemental, SDIF, SPF et SPFE | arrêtés de 1970, 2009, 2012, 2013, 2016, 2017, 2020 et les ajustements de 2026, carte des services DRFiP Île-de-France 01/2025 | fort |
| 6 | **La sphère gestion publique locale** — SGC, conseiller aux décideurs locaux, CGF | sept questions écrites, rapport du Sénat n° 303 (2023-2024), présentation DRFiP 35 de 2020, dépliant et page « collectivités locales », PAP et RAP du programme 156 | moyen |
| 7 | **Le domaine** — PED, SLD, PRIE, DNID, et la DIE en centrale | décret n° 2016-1234 et arrêté du 19 septembre 2016, décret n° 2017-1827 et arrêtés DNID, 4 annonces 2026 | fort |
| 8 | **Le recouvrement spécialisé** — PRS | arrêté du 13 novembre 2009, BOFiP `BOI-REC-FORCE-60` et `BOI-REC-PREA-10-10-20`, annuaire du service public, annonce Ariège | fort |
| 9 | **Les services à compétence nationale hors contrôle** — DGE, DINR, SRE, ENFiP, DiSI, DCST, DSFiP étranger, DSFiP AP-HP | un texte fondateur par structure, tous dans `collecte-03` ; décrets SRE de 2009 | fort |
| 10 | **L'administration centrale** — déjà écrite, à relire seulement | **l'arrêté du 20 décembre 2019 n'est pas dans ce conteneur** | bloqué |

---

## 6. Ce qui ne sera pas écrit, et pourquoi

Ces structures existent, et leur **décomposition interne** porte « non vérifié »
dans l'index de la collecte. Les nommer dans un organigramme avec des branches
inventées serait la faute que ce lot doit éviter :

trésorerie hospitalière, paierie départementale et régionale, service
départemental de l'enregistrement, pôle topographique et de gestion cadastrale,
centre d'encaissement, centre de services partagés, service facturier, mission
de maîtrise de l'activité et de la comptabilité, centres de contact, trésorerie
amendes.

Elles figureront **par leur nom et leur rattachement** là où un document les
situe, sans arborescence interne, et la fiche dira que le détail n'est pas
publié.

**Un cas nommément relevé par la collecte** : le découpage « assiette /
recouvrement » d'un service des impôts des particuliers **ne figure dans aucun
texte officiel obtenu**. C'est pourtant le découpage que la préparation au
concours enseigne couramment. Aucune fiche ne l'affirmera sur cette base ; le
BOFiP de 2017 ne donne que le service d'accueil et d'information du
contribuable, et le contrôle sur pièces.

---

## 7. L'ordre des lots proposé

Deux organigrammes par lot, du mieux tenu au moins tenu, en commençant par
celui dont la source est la plus forte et la plus récente :

| Lot | Organigrammes | Raison de l'ordre |
|---|---|---|
| 61-a | 2 (direction régionale) et 1 (direction départementale) | la source la plus forte, et le constat du § 4 à poser une fois pour toutes |
| 61-b | 3 (contrôle fiscal local) et 4 (directions de contrôle) | la chaîne du contrôle, du local au national, d'un seul tenant |
| 61-c | 5 (services de proximité fiscaux) | le plus grand nombre de textes à citer |
| 61-d | 7 (domaine) et 8 (recouvrement spécialisé) | deux filières courtes et bien tenues |
| 61-e | 9 (services à compétence nationale hors contrôle) et 6 (gestion publique locale) | le reste, dont la partie la moins tenue |

Chaque lot rend, par organigramme : la **version détaillée**, la **version
simplifiée**, et la **fiche complète** au format de la maison — prétest, cours
complet, fiche simplifiée, cartes de révision, quiz avec corrections détaillées
et visuels déclaratifs. Les fichiers sont remis à Alexis dans la conversation,
avec leur empreinte SHA-256 ; rien de `content/` n'entre au dépôt.

---

## 8. Ce qui attend une décision

1. **Le concours A+** : ajouter la matière au thème `option-metier`, ou retirer
   `commun` de ses racines partagées — § 2.
2. **L'administration centrale** : relire la fiche 1 demande l'arrêté du
   20 décembre 2019, qui n'est pas ici. Soit Alexis le remet dans
   `sources/officiels/`, soit l'organigramme n° 10 reste hors du lot.
3. **Les annonces de poste comme sources** : la collecte les signale comme
   d'autorité faible et la décision n° 8 de son « lisez-moi » la laisse au
   propriétaire. Les organigrammes 1 et 3 en dépendent pour l'essentiel de leur
   version détaillée. Je les emploierai datées et nommées, sauf refus.
