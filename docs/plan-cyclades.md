# Plan — Cyclades : renommage, parcours, stockage, sauvegarde, prétest, QCM

Ce plan répond aux deux prompts du 10 octobre 2026 : « parcours, QCM, prétest » et « stockage,
sauvegarde, branches ». Il est soumis à validation **avant toute écriture de code**, comme les deux
prompts l'exigent.

Les deux prompts se recouvrent sur un point : le renommage demande une migration des bases locales,
et le prompt « stockage » demande **un seul cadre de migration pour tout**. Le second prévalant sur
tout ce qui touche au stockage, l'ordre suggéré par le premier (renommage d'abord) est inversé sur
ce point précis — voir la phase 0 et sa justification.

## Ce que je dois décider avec toi avant de commencer

| # | Question | Pourquoi elle bloque |
|---|---|---|
| 1 | **Intitulé exact du parcours « DGFiP A+ »** | Le prompt demande de le confirmer avant affichage. Je ne l'inventerai pas. Mon hypothèse à valider : « DGFiP A+ — inspecteur principal des finances publiques ». |
| 2 | **Renommage du dépôt GitHub : oui ou non** | Impact détaillé ci-dessous. Tant que la réponse n'est pas donnée, je ne touche à rien côté GitHub et le chemin de base d'Astro reste `/`. |
| 3 | **Ordre des phases** | Je propose un ordre différent de celui suggéré, pour une raison technique (phase 0). À valider ou à corriger. |
| 4 | **Budget de stockage visé** | Le prompt demande que je le propose **après mesure**. La phase 0 produit les chiffres ; le budget sera soumis à ce moment-là, pas avant. |
| 5 | **Proportion de questions « à venir » par rubrique** | Je la proposerai dans le tableau d'audit (phase 7). Rien ne sera écrit avant ta validation. |

### L'impact d'un renommage du dépôt GitHub

Je ne le fais pas sans ton accord explicite. Voici ce qu'il coûte :

- **L'URL de GitHub Pages change** et GitHub **ne redirige pas** les pages d'un dépôt renommé de
  façon durable. Les signets sont perdus, et l'adresse apprise par cœur cesse de fonctionner.
- **Le chemin de base d'Astro** (`site.config.mjs`, champ `base`) doit suivre, sinon toutes les
  ressources se chargent sur un chemin mort : page blanche, pas d'erreur lisible.
- **Les `fetch` des données d'actualités** (`actualites-data/`) construisent leur URL depuis ce
  chemin de base : même défaut, mais silencieux — la rubrique Actualités se vide.
- **Les quatre routines Claude** et la tâche de reconstitution pointent le dépôt : elles cessent de
  publier, sans message.
- Le dépôt actuel affiche déjà `This repository moved. Please use the new location:
  risitaslegrand.github.io.git` à chaque push. Il y a donc **déjà** un renommage en vigueur côté
  GitHub, dont `origin` ne tient pas compte. C'est à traiter avant d'en ajouter un second, et je ne
  touche pas à `git remote set-url` — cette commande a déclenché un refus de classifieur par le
  passé et seule ta main peut la rejouer.

**Ma recommandation** : garder le dépôt tel quel pour l'instant. Le renommage de l'interface n'a
besoin d'aucun changement côté GitHub, et séparer les deux évite de mêler une panne de publication
à une refonte de nommage.

## Phase 0 — Mesurer et bâtir le cadre, sans rien changer de visible

Aucun effet sur l'interface. C'est le socle dont les six phases suivantes dépendent.

| Livrable | Détail |
|---|---|
| Générateur de données synthétiques | Cinq années d'usage intensif : pointages, séances, révisions FSRS, réponses de QCM, Cog-Training, journal d'erreurs, notes de séance (1 à 2 pages), prétests, événements de planification |
| `npm run bench-storage` | Taille par magasin, avant toute optimisation, rejouable à chaque évolution du modèle |
| Cadre de migration unique | Version de schéma par magasin, migrations chaînées, test sur données d'exemple, point d'entrée unique |
| Registre de branches, minimal | Révisions s'y enregistre et se comporte comme toutes le feront : identifiant, routes, magasins, versions, portées |
| Espaces de noms | `revisions/…`, portée **partagé / branche / parcours** déclarée par magasin |

**Pourquoi cette phase d'abord, contre l'ordre suggéré.** Le renommage migre les bases locales ; les
parcours re-cloisonnent les mêmes magasins par espace de noms ; le stockage compressé les
re-segmente. Fait dans l'ordre suggéré, c'est **trois migrations successives** sur les mêmes données,
chacune devant gérer les reliquats des précédentes. Fait dans cet ordre, c'est un cadre et trois
migrations déclarées dedans. Le prompt « stockage » demande explicitement « un seul cadre de
migration pour tout », et il prévaut sur tout ce qui touche au stockage.

**Ce que la phase produit pour toi** : le tableau de rétention par magasin (volume estimé à cinq
ans, politique conserver / compresser / agréger, justification) et un budget chiffré. Je te les
soumets **avant** d'écrire la couche compressée. Mon intuition rejoint la tienne — ces volumes
devraient rester modestes face aux quotas — mais la mesure tranchera, magasin par magasin, et il est
possible que la compression se révèle marginale pour la plupart et utile pour deux ou trois.

## Phase 1 — Renommage Cyclades

- Le projet devient **Cyclades** ; RevINSP devient la branche **Révisions**, affichée
  « Cyclades · Révisions ». Une seule branche existe ; le code ne doit pas empêcher les autres.
- Remplacement partout où le nom est visible ou structurant : en-tête, `<title>`, manifeste,
  « à propos », README, nom du paquet, messages d'interface. Nom discret, sans « concours » ni
  « INSP ».
- **Migration des données locales** par le cadre de la phase 0 : lecture de l'ancien nom, copie,
  marquage « migré », repli en lecture tant que nécessaire. Test obligatoire sur progression, FSRS,
  journal d'erreurs, notes de séance, réglages, thème.
- Non-indexation et verrouillage par mot de passe inchangés.
- **Textes des routines** : je fournis les quatre prompts (hebdomadaire, mensuelle, trimestrielle,
  annuelle) et celui de la reconstitution, mis à jour. `actualites-data/` ne change pas.
- README : Cyclades → branche Révisions → parcours.

## Phase 2 — Parcours

- **Registre de parcours** : un fichier de configuration par parcours, aucun code à toucher pour en
  ajouter un. Déclare identifiant, nom, concours, catégorie ou corps, matières ordonnées avec leur
  thème de planification, rotation hebdomadaire, rubriques activées, paramètres de QCM
  (54 questions, +1 / −0,5 / 0, modifiables).
- **Contenu** : `content/<parcours>/<matière>/<fascicule>/<fiche>.md`. L'existant migre vers
  `content/insp/` par script, sans perte. **DGFiP B, A et A+ créés vides** — je n'inventerai pas
  leur programme. États vides explicites.
- **Sélecteur** dans l'en-tête, parcours actif mémorisé, INSP au premier lancement.
- **Isolé par parcours** : planification, séances et notes, niveaux estimés, états FSRS, journal
  d'erreurs, curseur de prétest. **Partagé** : streak, XP et niveau global, Cog-Training, thème,
  glossaire (surcharge possible).
- **Chiffrement** : même mot de passe, même clé, aucun secret nouveau.
- **Actualités** : flux unique commun ; le lien avec le cours reste celui d'INSP. Je ne code pas son
  extension.
- **QCM - DGFiP** : `categorie_origine: A | B` sur chaque question quand elle est connue. Par
  défaut, DGFiP B tire dans B ; A et A+ tirent dans A et B. Réglable.
- **Routage proposé** : `/<parcours>/…` avec `/` qui résout vers le parcours actif, et redirections
  depuis les URL actuelles (`/fiche?id=…` → `/insp/fiche?id=…`). Aucun lien existant ne casse. À
  valider : je peux aussi garder les URL actuelles et ne mettre le parcours qu'en paramètre, ce qui
  casse moins mais lit moins bien.

## Phase 3 — Sauvegarde et restauration

Avant la compression, parce que le prompt demande qu'une sauvegarde soit proposée **avant toute
opération risquée** — dont la compression et l'agrégation.

- Format `.cyclades`, nom `cyclades-sauvegarde-AAAA-MM-JJ-HHmm`, en-tête lisible, charge utile
  **compressée puis chiffrée** (dans cet ordre), somme de contrôle SHA-256.
- **Chiffrement par défaut**, même mot de passe que le site, PBKDF2 avec sel propre à la sauvegarde,
  AES-GCM. Désactivable explicitement, avec avertissement.
- **Changement de mot de passe** : les anciennes sauvegardes restent lisibles avec l'**ancien** mot
  de passe ; le dialogue de restauration le dit et accepte un mot de passe différent de l'actuel.
- Ne contient **jamais** le mot de passe, la clé dérivée, ni le contenu de cours chiffré. Test
  automatique à l'appui.
- Destinations : téléchargement partout ; feuille de partage du système sur mobile ; dossier choisi
  une fois sur Chromium de bureau, avec **rotation** (10 par défaut). Permission à redemander gérée.
- Sauvegarde **partielle** par branche et par parcours.
- **Jamais** d'envoi vers le dépôt GitHub : il est public et la sauvegarde contient des données
  personnelles. Pas d'API cloud.
- Rappels réglables (hebdomadaire par défaut), bannière non bloquante, plus insistante après
  30 jours, reportable. Date de dernière sauvegarde toujours visible au tableau de bord.
- Restauration : **vérification à blanc** d'abord, bouton « Vérifier cette sauvegarde » séparé, modes
  **Remplacer** et **Fusionner** (union par identifiant, dernière modification gagnante),
  **instantané de sécurité** avant d'appliquer, refus clair d'un format trop récent, conservation des
  magasins inconnus.
- **Point que je ne tranche pas seul** : la fusion de l'**état FSRS** d'une carte. Deux appareils
  ayant révisé la même carte ont deux états légitimes, et « la dernière modification gagne » peut
  détruire un historique de stabilité. Je propose de **ne pas fusionner** cet état et de demander un
  choix par carte conflictuelle, ou de retenir l'état dont le journal de révisions est le plus long.
  À décider ensemble.
- Remplace l'export/import JSON actuel, sans perdre la synchronisation à la main.

## Phase 4 — Stockage compressé et durable

Trois leviers, du moins risqué au plus risqué, et seuls ceux que la mesure de la phase 0 justifie.

1. **Modélisation compacte** : identifiants courts, dates en entiers, énumérations numériques, pas de
   champ dérivé stocké, un enregistrement par événement.
2. **Compression de segments** : magasin × mois, `CompressionStream` natif, **fenêtre récente non
   compressée** (90 jours), **index léger** pour que les tableaux de bord ne décompressent jamais,
   décompression à la demande avec petit cache, **Web Worker** pour ne pas figer l'interface, repli
   sans compression.
3. **Agrégation** des journaux à très fort volume, après délai configurable, et seulement là où le
   détail perd son intérêt.

**Jamais agrégé ni supprimé automatiquement** : notes de séance et tout texte rédigé par toi ;
journal complet des révisions FSRS (l'optimisation des paramètres en a besoin) ; entrées ouvertes du
journal d'erreurs ; état courant des cartes ; réglages ; séances ; historiques de seuils de Veridical
Mapping. Compression admise, perte non.

**Durabilité** : `navigator.storage.persist()` avec état affiché et refus géré ;
`navigator.storage.estimate()` et page « Stockage » (taille par branche, parcours et magasin, taux de
compression, état persistant, date de dernière sauvegarde), avertissements à 70 % puis 90 %, bouton
« Compacter maintenant ».

**Le risque réel, à dire dans l'interface** : le danger n'est pas le quota, c'est la **perte**.
Safari a appliqué un plafond de sept jours sur les données de site écrites par script en cas de
non-utilisation ; l'application exacte dépend de la version et de l'installation à l'écran d'accueil.
Je **vérifierai le comportement actuel** avant de rédiger les textes d'aide plutôt que de recopier
une source de 2020. Conseil d'installation à l'écran d'accueil sur mobile ; j'évaluerai l'intérêt
d'un manifeste d'application web dans le plan de phase, sans bâtir de mode hors ligne sans ton
accord.

**Intégrité** : version de schéma par magasin, somme de contrôle par segment, vérification légère au
démarrage, segment corrompu **isolé et signalé** avec proposition de restauration — jamais effacé en
silence. Chaque enregistrement porte un identifiant unique et une date de dernière modification, ce
qui rend la fusion possible sans l'imposer.

## Phase 5 — Prétest revu

- **Ordre canonique par matière** : fascicule, puis fiche. **Curseur par matière et par parcours**
  sur la première fiche non étudiée. Le prétest porte sur **cette fiche seule**, jamais sur
  plusieurs, jamais au hasard.
- Une fiche passe « étudiée » quand une séance a été terminée dessus, ou que tu la marques. Le
  curseur avance alors. Le « nouveau contenu du jour » d'une matière est la fiche du curseur.
- Navigation libre : ouvrir une autre fiche non étudiée propose son prétest **sans déplacer** le
  curseur. Fiche sans prétest sautée sans bloquer ; fin de matière signalée.
- **3 à 4 questions** adossées chacune à une notion centrale ou contre-intuitive, jamais une
  trivialité, et permettant une tentative raisonnée sans connaissance préalable.
- **Réponse libre courte** plus niveau de confiance (« je devine / je pense / je sais »). Pas de QCM.
- **Ancres** : chaque question pointe la section du cours qui contient la réponse.
- **Lecture guidée** : repère discret au passage concerné (« Répond à ta question n° 2 »), questions
  accessibles dans un panneau replié.
- **Retour** en fin de lecture : ta réponse face à celle du cours (extrait et lien vers l'ancre),
  auto-évaluation juste / partiel / faux, résumé de ce que tu savais déjà et de ce qui était nouveau.
- **Exploitation** : notions manquées signalées « points d'attention » sur la fiche et **priorisées
  dans le rappel n-1** de la séance suivante ; une réponse fausse donnée avec confiance élevée est
  signalée comme idée reçue et proposée en sujet de note de séance.
- Aucune pénalité, aucun effet sur le niveau estimé ni sur le journal d'erreurs ; petite récompense
  forfaitaire d'XP. 3 à 5 minutes. « Passer » conservé et enregistré ; après trois sauts d'affilée,
  un rappel bref non bloquant, une seule fois.
- `check-content` vérifie par fiche : 3 à 4 questions, notion renseignée, **ancre existante**,
  réponse attendue **présente dans le passage ancré**. Le build échoue sinon ; un statut
  « brouillon » avertit sans bloquer.
- **Rédaction** : lot pilote de **trois fiches par matière**, validé par toi, puis les 259 autres.
- Déroulé de séance : rappels n-1 / n-2 → reprise des erreurs → **prétest du curseur → lecture
  guidée → retour sur le prétest** → note de séance.

## Phase 6 — « Demander à l'IA »

- **Retrait** du bouton et du lien « Ouvrir dans Claude » et de tout ce qui s'y rattache :
  construction de l'URL, encodage, seuil de longueur, textes d'aide, tests, mentions du README. Plus
  aucun lien sortant vers un assistant. Restent **« Copier le prompt »** et **« Partager »** sur
  mobile.
- Le prompt devient **composé par couches**, et n'inclut **aucune phrase hors sujet** :
  1. **parcours actif** — concours, catégorie ou corps, matière, épreuve, format et barème quand
     c'est un QCM, y compris la consigne d'abstention ;
  2. **nature de l'élément** — consignes propres à chacune des neuf natures (QCM de cours, QCM
     DGFiP par rubrique, flashcard orientée **mémorisation**, fiche, exercice de Cog-Training
     présenté comme tel et non comme du contenu de concours, actualité, terme de glossaire) ;
  3. **état sur l'élément** — juste, faux, partiel, et **échecs répétés** appelant une approche
     différente et la recherche du prérequis manquant ;
  4. **fraîcheur** — date du jour toujours ; pour un élément « actuel » ou « à venir », sa date de
     référence et la demande de signaler une information possiblement périmée ; pour une correction
     à `confiance: moyenne`, la demande de **vérifier la réponse** avant de s'appuyer dessus.
- Le niveau estimé règle profondeur et vocabulaire. Aucun appel à un modèle par le site, aperçu
  éditable obligatoire, aucun secret ni donnée personnelle, budget de taille maintenu.
- **Tests** : un cas par nature et par état, avec vérification qu'**aucune consigne hors sujet**
  n'apparaît. C'est le test qui compte : un prompt composé par couches échoue en incluant une phrase
  qui ne s'applique pas, pas en en oubliant une.

## Phase 7 — QCM DGFiP remis à l'époque actuelle

**Règle** : aucune question ne s'appuie sur un événement passé non historique, et toute donnée
susceptible d'évoluer est exacte à la date du jour.

1. **Tableau d'audit** des 540 questions : identifiant, rubrique, nature (intemporelle, historique,
   actuelle, passée non historique, à venir), action, **cas douteux listés pour ta validation** —
   je ne tranche pas seul entre « historique » et « passé non historique » —, et proportion proposée
   de questions à venir par rubrique. **Validation par toi.**
2. **Lot pilote** d'une dizaine de questions modifiées ou créées, toutes natures confondues.
   **Validation par toi.**
3. **Reste de la banque**, avec tableau de couverture final par rubrique et par nature.

Le remplacement d'une question passée non historique **conserve rubrique et compétence testée**, pour
que chaque rubrique garde de quoi tirer 54 questions.

**Questions à venir** : seulement des faits **programmés**, vérifiables aujourd'hui, formulés
prudemment, sourcés et datés. Aucune question dont la réponse dépend d'un résultat ou d'un pronostic.

**Schéma** : bloc `temporalite` (nature, `date_de_reference`, `a_reverifier_le`, `expire_le`) et bloc
`origine` (annale, modifiée). Les corrections détaillées des questions modifiées sont mises à jour
avec leurs sources datées, visuel compris.

**Garde-fous** : `check-content` échoue sur une question « à venir » dépassant `expire_le` et avertit
sur `a_reverifier_le` dépassé. **Et surtout, expiration à l'exécution** : le site étant statique, la
banque ignore au chargement toute question expirée à la date du navigateur, même sans
reconstruction. Une question expirée n'est jamais servie. Je proposerai une routine trimestrielle de
contrôle de fraîcheur, sans l'imposer.

## Phase 8 — Fondations des branches futures, et preuve

- **Rien** des branches Sport et Vie quotidienne n'est créé : ni écran, ni entrée de menu, ni page
  « bientôt disponible ». Seules les fondations.
- Registre de branches complété : icône, routes, navigation, magasins et migrations, politique de
  rétention et de compression, export et import pour la sauvegarde, widgets, **niveau de
  sensibilité** (ordinaire ou personnel/santé).
- Les branches **n'accèdent pas** aux magasins des autres : interface du cœur. Point d'extension pour
  un service d'« activité du jour », **sans trancher** s'il sera partagé — la décision t'appartient.
- Une branche « personnel/santé » est **exclue par défaut** de tout export partagé sans confirmation.
- Le chiffrement **au repos** des données locales n'est pas demandé ; je dirai dans le bilan de phase
  si la sensibilité attendue le justifie et ce qu'il coûterait (recherche, performance, perte du mot
  de passe).
- `docs/ajouter-une-branche.md` et une **branche factice réservée aux tests**, jamais livrée, qui
  exerce tout le chemin : enregistrement, magasins, migration, compression, sauvegarde, restauration,
  effacement, fusion. **Si ce test passe sans modifier le cœur, l'extensibilité est démontrée** — et
  c'est le seul critère qui vaille.

## Critères d'acceptation

- Aller-retour compression → décompression **identique** sur le jeu de cinq ans.
- Sauvegarde → restauration **identique**, enregistrement par enregistrement, avec et sans
  chiffrement, avec et sans fusion.
- Cas dégradés : mauvais mot de passe, fichier tronqué, somme de contrôle fausse, format trop récent,
  magasin inconnu, quota presque plein, permission de dossier retirée.
- Aucun secret dans la sauvegarde ; une sauvegarde faite avec l'ancien mot de passe se restaure après
  changement.
- Le démarrage ne décompresse **aucun** segment ancien ; l'interface ne se fige ni pendant la
  compression ni pendant la sauvegarde — **mesure fournie**, pas affirmation.
- La branche factice n'oblige à modifier **aucune** ligne du cœur.
- Migration du renommage et des parcours testée sur données d'exemple, sans perte.

## Ce que je signale avant de commencer

**Le temps de la suite relationnelle.** `essais:relationnel` tient maintenant en 4,5 minutes, mais
`npm run build` complet et les essais de navigateur restent longs, et le conteneur coupe les tâches
de fond à trente minutes. Les phases 4 et 7 vont ajouter des essais lourds (jeu de cinq ans, 540
questions). Je proposerai dès la phase 0 une organisation qui tienne dans ce plafond plutôt que de
m'y heurter en route.

**Le volume de rédaction.** La phase 5 demande de réécrire le prétest de **262 fiches**, et la phase 7
de traiter **540 questions**. Ce sont les deux plus gros postes, très loin devant le code. Ils se
feront par lots validés, et je donnerai une couverture chiffrée à chaque étape plutôt qu'une
impression d'avancement.

**Ce qui reste du travail précédent** : le backlog de corrections de QCM (4 746 sur 4 892), la trace
du second temps en B, et les lots de contenu du fascicule 4. Ces chantiers ne disparaissent pas ;
dis-moi s'ils passent après les sept phases ci-dessus ou s'ils s'y intercalent.
