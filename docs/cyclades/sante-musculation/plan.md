# Plan — Santé et traitements, concentrations sériques, méthodes de Musculation

> **Statut : soumis à validation.** Le prompt demande de ne rien coder avant accord
> (partie P). Rien de ce document n'est implémenté, à une exception près, signalée
> en tête de la section « Ce qui existe déjà ».

Ce plan répond au prompt complémentaire du 12 octobre 2026. Il confirme les douze
interprétations du 0.4, tranche les seize décisions du 0.5, et découpe le chantier
en phases livrables et testables.

---

## 1. Ce qui existe déjà, et qui sert de socle

| Acquis | Où | Ce que le nouveau prompt en fait |
|---|---|---|
| **Le coffre** : chiffrement au repos, clé jamais écrite, champs d'index déclarés, contrôle des champs interdits | `src/lib/noyau/coffre.ts`, `src/lib/coffre.ts` | **Requis tel quel** par H.8 et la décision 7. Rien à refaire. |
| Rappel de sauvegarde gradué, urgent dès qu'il existe du scellé | `noyau/coffre.ts` | Condition bloquante de la décision 3, déjà tenue. |
| Domaine Corps : pesées, mesures, sommeil, repas, boissons, santé générale | `odyssee/corps.ts`, `/odyssee/corps/` | **Reste**. H.1 y ajoute l'espace Santé. |
| Contrat de faits, permissions, désaccords inter-branches, `etale` | `noyau/faits.ts`, `odyssee/desaccords.ts` | H.2 s'y branche ; B.2 s'étend en H.8. |
| Moteur de tendances : effectif minimal, taille d'effet, intervalle, Benjamini-Hochberg, vocabulaire sans causalité | `odyssee/tendances.ts` | **Réutilisé tel quel** par H.5 et J.3. Rien à réécrire. |
| Trajectoires, plafond de trois, refus mémorisé | `odyssee/trajectoires.ts` | Socle des propositions d'habitudes (J.3). |
| Sport : exercices, schéma du corps, programmes, séance en direct, force, modulations | `src/lib/sport/*` | Devient le **mode Simple** de M.1. |
| Initialisation conversationnelle « Essentiel » | `noyau/initialisation.ts` | Voie « Essentiel » de I.1 ; « Approfondi » s'ajoute à côté. |

> **L'exception à signaler.** Les magasins `odysseeMedicaments` et `odysseeHormonal`
> ont été créés **avant l'arrivée de ce prompt**, avec un modèle simple
> (`src/lib/odyssee/sensible.ts` : une prise porte directement nom, dose, voie,
> motif). **H.2 le remplace** par le triplet `molecule` / `traitement` / `prise`.
> La reprise est faite en phase 1 par une migration additive : les prises
> existantes reçoivent un `traitement_id` créé à la volée depuis leur nom. Le coût
> est nul aujourd'hui — aucune donnée réelle n'a été saisie —, et il croît chaque
> jour : c'est une raison de traiter la phase 1 tôt, pas de la précipiter.

---

## 2. Les douze interprétations du 0.4 : confirmées

Toutes confirmées telles qu'écrites, avec deux précisions.

**n° 2 — « Santé » : espace distinct ou domaine Corps ?** Ma décision est en 3.1 :
**un écran distinct, dans le même domaine**. Le prompt me laisse trancher.

**n° 5 — « Mode Complet ».** Aucun mode de ce nom n'existe aujourd'hui : Sport n'a
qu'un journal de séance. Je crée donc les deux niveaux, **Simple** (l'existant,
renommé) et **Complet**.

---

## 3. Les seize décisions du 0.5

### 3.1 Emplacement et nom de l'espace Santé

**Un écran `/odyssee/sante/`, distinct de `/odyssee/corps/`, dans le même domaine
`corps`.**

Pourquoi distinct : les deux ont des **rythmes d'usage opposés**. Le corps se note
tous les jours en dix secondes — une pesée, un verre d'eau, un repas. La santé
s'ouvre par épisodes : un bilan tous les trois mois, une déclaration de traitement,
une prise à marquer. Les mettre sur un même écran ferait un écran long où le geste
quotidien se noie.

Pourquoi le même domaine : les faits sont déjà déclarés `domaine: 'corps'` au
contrat (B.1), les permissions y sont écrites, et Sport lit « corps ». Inventer un
domaine « santé » obligerait à retoucher le contrat, la matrice, la roue
d'équilibre et les indicateurs pour un gain nul.

Conséquence pratique et voulue : **le coffre ne verrouille pas le quotidien**. Peser
et noter un repas reste possible coffre fermé ; ouvrir le coffre n'est demandé que
sur `/odyssee/sante/`, et seulement pour sa partie scellée.

### 3.2 Courbe de concentration simulée : **non retenue, confirmé**

J'approuve sans réserve, et j'ajoute un motif aux deux vôtres : une courbe projetée
à partir des doses déclarées **est** un outil de planification de dose, quel que
soit l'avertissement qui l'accompagne. La lire, c'est répondre à « quand dois-je
reprendre pour rester au-dessus de X ». H.9 l'interdit ; la courbe la rendrait
possible en contournant l'interdit par l'image.

Ce qui est livré à la place : la **demi-vie de référence**, le **délai écoulé depuis
la dernière administration**, et la **frise** prises/résultats. Trois faits, aucune
extrapolation.

### 3.3 Libellé neutre des rappels de calendrier

**« Rappel Cyclades », sans autre mention.** Les trois niveaux de H.2 sont conservés :
`neutre` (défaut), `explicite` (le nom du traitement), `personnalise` (texte libre).
Pas de niveau intermédiaire par catégorie : « Rappel Cyclades — hormonal » en dirait
déjà trop sur un agenda synchronisé avec un compte tiers.

L'avertissement d'une ligne au moment du choix : *« Votre agenda peut être
synchronisé avec un service tiers. Un libellé explicite y sera lisible. »*

### 3.4 Périmètre du premier lot

**Méthodes (M.5)** — trois, et pas davantage :
1. **Double progression** (défaut du mode Complet) ;
2. **Progression linéaire** (débutants, conformément à M.3) ;
3. **Volume progressif par mésocycle** (M.3).

Pourquoi trois : chaque méthode est un fichier déclaratif **avec ses sources**, et
c'est le sourçage qui coûte, pas le code. Trois méthodes sourcées valent mieux que
douze étiquetées « heuristique » faute de temps.

**Molécules (H.3)** — le lot demandé, en deux groupes :
- **Groupe sourçable** (base de données publique des médicaments, RCP, publication
  primaire) : esters de testostérone commercialisés en France, nandrolone et ses
  esters, modafinil, N-acétylcystéine, bleu de méthylène, créatine, les treize
  vitamines, caféine, ACD856 (publication primaire citée en annexe S).
- **Groupe « à sourcer »**, fiche créée avec bandeau et `maturite_clinique` renseignée,
  demi-vie **« inconnue »** tant qu'aucune source primaire n'est obtenue : dihexa,
  PRL-8-53, KW-6356, aticaprant, NSI-189, TUDCA, piracétam, L-théanine, armodafinil.

Je ne promets pas de sourcer les dix-neuf : je promets qu'**aucune valeur non sourcée
n'entrera**, et que le registre dira pour chacune où j'en suis.

### 3.5 Valeurs de départ des repères de volume

**D'accord avec votre recommandation.** Fourchettes larges, étiquetées « heuristique »,
éditables par muscle, plus l'estimation personnelle.

Valeurs de départ proposées, en **séries directes par semaine et par muscle** :

| Repère | Fourchette de départ | Ancrage |
|---|---|---|
| MV | 4 à 8 | centrée sur le « environ 6 » cité par RP, élargie faute de source primaire |
| MEV | 8 à 12 | zone basse de la relation dose-réponse de Schoenfeld et coll. (2016) |
| MRV | 16 à 24 | au-delà des données disponibles : fourchette d'ignorance, pas de seuil |

Ces trois lignes portent, à l'écran, la mention *« heuristique — aucune source
primaire pour ces chiffres »*. Elles sont des **points de départ éditables**, pas des
cibles. L'estimation personnelle (volume observé en progression contre volume observé
en stagnation) les remplace dès qu'il y a de quoi la calculer, et c'est elle qui est
mise en avant.

### 3.6 Désactivation sous 18 ans : **confirmé**, avec une honnêteté

Le module substances est désactivé si l'année de naissance déclarée indique moins de
18 ans. **Et il faut dire ce que cela vaut** : l'année de naissance est déclarative,
facultative, modifiable. Ce contrôle évite un défaut malheureux ; il n'empêche
personne de rien. L'écran de réglage le dira plutôt que de laisser croire à une
barrière.

### 3.7 Chiffrement au repos : **coût mesuré**

Le coffre est construit. Voici le coût réel, mesuré sur cette machine (Node 22,
WebCrypto, AES-GCM 256, PBKDF2-SHA-256) :

| Opération | Coût |
|---|---|
| Dérivation de la clé, 310 000 itérations | **157 ms**, une fois par ouverture du coffre |
| Sceller un enregistrement | **90 µs** |
| Ouvrir un enregistrement | **76 µs** |
| Ouvrir 3 650 prises (cinq ans, deux par jour) | **0,28 s** |
| Ouvrir 20 000 enregistrements | **1,5 s** |
| Surcoût de taille | **+104 %** (233 → 475 octets sur un enregistrement réaliste) |

**Lecture.** Le coût de calcul est négligeable pour les volumes de ces domaines :
un journal quotidien sur cinq ans fait 1 825 entrées, soit **0,14 s** à l'ouverture.
Le coût de taille, lui, est réel : le chiffré est en base64 (+33 %) et les champs
d'index sont conservés en clair à côté. Cela reste sans conséquence ici — un million
d'octets pour cinq ans de prises — et c'est une raison supplémentaire de **ne pas
chiffrer** les séries de musculation, qui se comptent en dizaines de milliers.

**Recommandation : le périmètre de la décision 3 est le bon, et il s'étend** aux
objets de ce prompt, qui sont de même nature : `traitement`, `prise`, `prelevement`,
`resultat`, `symptome`, `condition_declaree`, `traitement_externe`, `alerte`, et le
**journal d'usage** de J.5. En clair : le `catalogue` des molécules (données publiques
versionnées, aucune donnée personnelle) et les `habitude` (voir 3.13 — à rediscuter).

**Le point ouvert, qu'il faut trancher avec vous.** La clé du coffre vit dans une
variable de module : elle ne survit pas à une **navigation**, pas seulement à un
rechargement. Sur un site multi-pages, cela veut dire **une saisie du mot de passe à
chaque visite de l'écran Santé**. Je l'ai constaté en écrivant l'essai navigateur, et
c'est plus lourd que ce que j'avais annoncé. Trois sorties :

| Option | Ce qu'elle protège | Ce qu'elle coûte |
|---|---|---|
| **A — rien changer** | tout attaquant qui lit le disque après coup, extension comprise | une saisie par visite d'écran |
| **B — `sessionStorage`** (recommandée) | l'ordinateur partagé, l'autre profil, l'outil d'inspection ouvert plus tard, la persistance après fermeture | une extension **active** dans l'onglet lirait la clé |
| **C — `localStorage`** | presque rien de plus que pas de chiffrement | aucune friction |

Je recommande **B**, pour une raison précise : la clé du **contenu** est déjà en
`localStorage` quand « rester connecté » est coché, donc A ne protège contre une
extension active que si cette case est décochée — un cas rare. B protège les menaces
réalistes (l'ordinateur ouvert, le profil partagé, l'inspection après coup) à un coût
acceptable : une saisie par session de navigation. **À confirmer.**

### 3.8 Sources des interactions, et licence du Thésaurus

**Hiérarchie retenue**, dans cet ordre, et c'est la première qui répond qui fait foi :
1. **RCP** (base de données publique des médicaments) ;
2. **Thésaurus ANSM**, avec sa date (dernière version du 15 septembre 2023, mises à
   jour arrêtées) ;
3. alertes et notices d'agences (ANSM, EMA, FDA) ;
4. littérature primaire ;
5. références pharmacologiques de mécanisme, pour les conflits **théoriques** seulement.

**Ne pas embarquer le Thésaurus.** Décision : **renvoyer vers lui par lien**, et ne
stocker que des **faits dérivés avec citation précise** (molécule, molécule, niveau,
libellé d'origine, date de la version). Trois raisons : ses conditions de réutilisation
doivent être vérifiées et ne l'ont pas été ; il n'est plus mis à jour, donc l'embarquer
figerait une photographie périmée dans un dépôt **public** ; et les RCP prévalent de
toute façon, ce qui en fait une source de second rang.

Le dépôt étant public, le catalogue d'interactions qu'il contient ne portera **que**
des faits dérivés et des citations courtes, jamais une copie de table.

### 3.9 Fenêtre d'exposition résiduelle

**Cinq demi-vies**, paramétrable de 3 à 7. Justification : après cinq demi-vies, il
reste environ 3 % de la quantité initiale ; c'est la convention pharmacocinétique
usuelle pour considérer une élimination quasi complète. Elle sera sourcée sur une
référence de pharmacologie, pas sur ce paragraphe.

**Demi-vie inconnue : aucune extension.** La fenêtre se limite aux dates déclarées, et
l'écran affiche *« durée d'exposition résiduelle inconnue »*. Ne rien inventer, y
compris par prudence : étendre « au cas où » produirait des alertes dont personne ne
pourrait dire si elles portent.

### 3.10 Conception anti-fatigue des alertes

- **Trois rangs d'affichage.** Documentées dépliées, toujours en tête, triées par
  gravité de la source. Théoriques repliées en un bloc avec compteur. Non documentées
  repliées en un second bloc avec compteur. **Rien n'est supprimé.**
- **Plafond d'affichage déplié** : les cinq premières documentées, le reste derrière
  « voir les N autres ». Un plafond d'affichage, jamais de suppression.
- **Une alerte examinée avec un professionnel** quitte le rang déplié sans disparaître.
- **Mesure** : le générateur synthétique produira des profils à 5, 15 et 30 molécules
  actives, et le plan de test exigera le **nombre d'alertes de chaque rang**. Si une
  configuration ordinaire dépasse une vingtaine d'alertes dépliées, la hiérarchie est
  à revoir — et ce sera écrit dans le rapport, pas masqué.

### 3.11 Cumul de vitamines face aux limites supérieures

**Oui**, et uniquement quand une autorité publie la limite pour le nutriment et la
population.

**Autorités, dans cet ordre** : **EFSA** (valeurs de référence pour l'Union, les plus
récemment révisées), puis **ANSES** pour la France. Jamais de moyenne entre les deux,
jamais de valeur reprise d'un fabricant. La source et sa date sont affichées avec le
chiffre, et la mention fixe *« limite de sécurité, pas un objectif d'apport »*.

Affiché seulement si la personne a **saisi des quantités** : sans quantité, le cumul
n'existe pas, et un cumul inventé serait pire que pas de cumul.

### 3.12 Initialisation étendue

- **Voie recommandée : « Approfondi »**, mise en avant comme le demande I.1, les trois
  voies étant également cliquables et « Plus tard » jamais dévalorisée.
- **Durée cible : moins de 25 minutes**, moins de 4 minutes par chapitre, **mesurée** :
  le parcours chronomètre réellement chaque chapitre, et la durée affichée est la
  **médiane observée** une fois qu'il y a de quoi la calculer, l'estimation initiale
  étant étiquetée comme telle.
- **Chapitres sensibles en dernier** (7, 8, 10, 11, 12), chacun précédé de son écran
  « à quoi ça sert, où c'est stocké, ce que je peux sauter ».
- **La liste exacte des questions est livrée en phase 0**, comme une **banque
  déclarative** (`contenu/initialisation/*.json`) validée par schéma, avec pour chaque
  question : libellé, type, choix, temps estimé, pourquoi elle est posée, qui l'utilise,
  sensibilité, portée. Je ne la fige pas dans ce plan : elle se discute mieux sur
  pièce, et elle doit pouvoir évoluer sans toucher au code.

### 3.13 Seuils de détection des habitudes

Tous **étiquetés « heuristique »**, tous ajustables, tous mesurés sur jeux synthétiques
à résultat connu.

| État | Seuil de départ | Raison |
|---|---|---|
| **Émergente** | 3 occurrences en 3 semaines, dans un créneau cohérent (± 2 h) | reprend la valeur de J.3 ; assez bas pour proposer tôt, assez haut pour ne pas proposer un hasard |
| **En formation** | déclarée, ou émergente acceptée | état choisi par la personne, pas mesuré |
| **Installée** | ≥ 8 semaines d'ancienneté **et** ≥ 70 % de semaines conformes à la signature | huit semaines parce que la médiane de Lally et coll. (66 jours) est une médiane, pas une échéance — et qu'on observe, on ne prédit pas |
| **En érosion** | fréquence en baisse d'au moins 40 % sur 3 semaines par rapport à la ligne de base de 8 semaines, **hors pauses explicables** | une baisse franche et durable, pas une semaine creuse |
| **Dormante** | pause explicable déclarée ou détectée (vacances, maladie, déplacement) | jamais une érosion |

**Et la règle qui prime sur tous ces seuils** : absence de donnée ≠ absence de
comportement. Une source désactivée, hors ligne ou en pause **gèle** l'état au lieu de
le dégrader.

**Point à rediscuter** : les habitudes sont-elles « les plus sensibles » au sens de la
décision 3 ? J.5.4 le dit du journal d'usage et des données dérivées. Je recommande de
**chiffrer le journal d'usage** (volumineux mais révélateur) et de **laisser les fiches
d'habitudes en clair** : elles sont lues par le plancher du jour et la revue, à chaque
ouverture, et les chiffrer rendrait le tableau de bord dépendant du coffre. À arbitrer
avec la décision 7.

### 3.14 Sources externes du premier lot

**Imports de fichiers seulement.** Aucun capteur dans le premier lot, et voici pourquoi
— c'est le point où il ne faut rien promettre :

| Source | État réel | Décision |
|---|---|---|
| **Web Bluetooth** (ceinture cardiaque) | **absent de Safari sur iOS**, et iOS impose WebKit à tous les navigateurs : indisponible sur iPhone, quel que soit le navigateur | **hors premier lot**, à réévaluer sur Android seul et à annoncer comme tel |
| **Géolocalisation ponctuelle** | disponible partout, sur permission | hors premier lot : aucun usage établi pour les habitudes |
| **Capteurs de mouvement** | disponibles, permission explicite sur iOS | hors premier lot |
| **Import CSV** (relevés, applications) | fonctionne partout | **premier lot** |
| **Import GPX / TCX** | fonctionne partout | **premier lot** |
| **Import ICS** (agenda) | déjà construit pour Odyssée | **premier lot**, réutilisé |
| **Exports d'écosystèmes de santé** (Apple Santé, Google Fit) | formats et faisabilité **non vérifiés** | à évaluer, pas promis |

Le mappage de colonnes CSV est **conservé et rejouable** (B.3), comme demandé.

### 3.15 Journal d'usage

| Question | Réponse |
|---|---|
| **Contenu** | horodatage à la minute, identifiant d'écran, type d'action dans une liste fermée (`ouvrir`, `terminer`, `reporter`, `annuler`, `saisir`). **Jamais** de contenu saisi, de frappe, de position de pointeur, de capture |
| **Conservation** | 90 jours au détail, puis **agrégation hebdomadaire** (comptes par écran et par type), détail effacé |
| **Sauvegarde** | **exclu par défaut**, avec une case pour l'inclure. Il est volumineux, dérivable, et sa perte ne coûte qu'une précision d'analyse |
| **Chiffrement** | oui (voir 3.13) |
| **Coût** | à **mesurer** en phase, sur le générateur synthétique : une entrée fait ~60 octets en clair, ~140 scellée ; à 200 actions par jour, 90 jours font environ **2,5 Mo**. Chiffre à confirmer par la mesure, pas à croire sur parole |

### 3.16 Apprentissage étendu

- **Texte de consentement** : lisible en une minute, en langage simple, livré en phase 0
  pour relecture. Trois paragraphes : ce que Cyclades lit, ce qui ne change **jamais**
  (J.5.3, en toutes lettres), comment arrêter.
- **Sous-interrupteurs** : un par **domaine** (corps, santé, psyché, finances, lien,
  ordre, œuvre, connaissances) et un par **source** (journal d'usage, texte libre,
  imports, capteurs). « Tout voir » les coche tous ; « Choisir » ouvre la liste.
- **Rappel périodique** : **3 mois** par défaut, réglable de 1 à 12 mois, désactivable.
  Dans l'application, jamais en notification.
- **Jamais précoché**, refus aussi visible que l'acceptation, et **aucune autre réponse
  de l'initialisation ne vaut consentement** — vérifié par un essai.

---

## 4. Les phases

Chacune est livrable, testée, et close par un build vert et une publication possible.

| Phase | Contenu | Dépend de |
|---|---|---|
| **0 — Socle documentaire** | Registre des sources (`docs/sources-sante-musculation.md`) ; registre des décisions mis à jour ; banque de questions d'initialisation (schéma + chapitres 1 à 6) ; **texte de consentement** de J.5 ; schémas de validation des fichiers déclaratifs (molécule, interaction, méthode, question) | — |
| **1 — Santé : modèle et espace** | H.1, H.2 : `/odyssee/sante/`, activation explicite, triplet molécule/traitement/prise, prélèvements et résultats, symptômes, conditions déclarées, traitements externes. **Migration du modèle simple existant.** Tout sous coffre | 0 |
| **2 — Catalogue des molécules** | H.3 : fichier déclaratif validé, premier lot (3.4), bandeaux, `maturite_clinique`, `donnees_humaines`, `statut_antidopage`, niveau de preuve. Sourçage effectif, registre tenu | 1 |
| **3 — Conflits (H.10)** | Catalogue d'interactions, quatre familles, quatre statuts, règles de classe et de paire, fenêtre d'exposition résiduelle, hiérarchie anti-fatigue, écran « Conflits détectés », pastilles, « examiné avec un professionnel », rapport de différences | 2 |
| **4 — Calendrier et rappels** | H.4 : prises prévues, marquage en deux appuis, traitements importants, intervalles réels, export ICS avec RRULE et VALARM, libellé neutre, récurrence au changement d'heure, règle de fusion | 1 |
| **5 — Bilans et mise en regard** | H.5 : saisie avec intervalle du laboratoire, délai depuis la dernière prise, frise, ruptures de comparabilité, corrélations exploratoires **réutilisant `tendances.ts`** | 2 |
| **6 — Indicateurs et orientation** | H.6 (simplifiés/détaillés), H.7 (moteur de règles sourcées, quatre niveaux, symptômes d'urgence, liste « à aborder avec un médecin »), H.8 (permissions, export, rétention) | 3, 5 |
| **7 — Garde-fous H.9** | Relecture de **tous** les textes ; **test automatique** qui échoue sur un verbe de prescription hors citation sourcée ; revue des règles d'XP | 1 à 6 |
| **8 — Musculation : mode Complet** | M.1, M.2 : bascule Simple/Complet sans perte, schéma des fichiers de méthode, étiquettes de preuve, double progression et progression linéaire | — (parallèle) |
| **9 — Volume progressif** | M.3, M.4 : repères par muscle, estimation personnelle, mésocycle, RIR décroissant, autorégulation, déload, sélection d'exercices, tri documenté dans le registre | 8 |
| **10 — Techniques et analyses** | M.6, M.7 : marquage par série, comptage paramétrable, plafond, analyses du mode Complet, bilan de mésocycle | 9 |
| **11 — Initialisation « Approfondi »** | Partie I, par chapitres, chacun livré avec le domaine qu'il concerne ; écran « Ce que j'ai compris » | 0, puis au fil |
| **12 — Habitudes** | Partie J : taxonomie, journal d'usage, détection et états, fiches, profil, propositions, garde-fous J.4, écrans « Ce que Cyclades voit » et « Ce que Cyclades a retenu de moi » | 11 |
| **13 — Apprentissage étendu** | J.5 complet : interrupteurs, pause, mode privé, révocation avec choix d'effacement, journal d'accès, rappel périodique. **L'écran de consentement est livré dès la phase 0** | 12 |
| **14 — Jeux synthétiques et mesures** | Générateur étendu à cinq ans de prises, bilans, symptômes, mésocycles ; mesures de taille et de temps ; volume d'alertes mesuré (3.10) ; coût du journal d'usage mesuré (3.15) | au fil |

**Ordre recommandé** : 0, 1, 2, 3, 4, 5, 6, 7 — puis 8, 9, 10 — puis 11, 12, 13, avec
14 tissée en continu. Les phases 8 à 10 ne dépendent de rien de la santé et peuvent
s'intercaler si vous préférez voir la Musculation plus tôt.

---

## 5. Ce que je refuse de promettre

Par honnêteté, trois choses que le prompt demande et que je ne garantirai pas :

1. **Sourcer les dix-neuf molécules.** Je sourcerai ce que je peux atteindre, et
   chaque fiche dira où j'en suis. Une demi-vie « inconnue » restera inconnue.
2. **Les notifications poussées.** Un site statique ne pousse rien quand il est fermé.
   L'ICS avec alarme est la seule voie qui fasse sonner un téléphone, et elle dépend de
   l'agenda de la personne. Je le testerai avant de l'annoncer.
3. **Les capteurs sur iPhone.** Web Bluetooth n'existe pas sur iOS. Je ne promettrai
   pas une ceinture cardiaque sur iPhone, et je le dirai à l'écran plutôt que de
   laisser un bouton qui échoue.
