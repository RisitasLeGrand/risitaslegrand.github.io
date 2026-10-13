# Finances : budget, rapprochement, import — plan (phase 0)

**13 octobre 2026.** Aucun écran, aucun magasin, aucune migration n'a été
écrit : ce prompt l'interdit avant validation. Un seul fichier de modèle
existe, et la section 12 dit exactement ce qu'il est et ce qu'il n'est pas.

---

## 1. Ce que je retiens de ta demande, en une phrase

Le **prévu** devient un objet de premier rang, le **réel** entre avec le moins
de gestes possible, et le **rapprochement** est ce qui relie les deux — le
reste de Cyclades lisant le résultat sous permission.

Deux choses que je tiens pour acquises et qui ne se rediscutent pas dans ce
plan : rien ne quitte le navigateur, et l'outil calcule sans jamais conseiller.
Elles ne sont pas des contraintes à contourner, elles décident de la forme.

## 2. Ce que j'ai mesuré, plutôt que de l'affirmer

Ton annexe demande de vérifier les capacités des navigateurs **à la date**.
Fait, sur le Chromium de cet environnement (141), en contexte sûr :

| Capacité | Résultat | Ce qu'elle permet |
|---|---|---|
| `showOpenFilePicker` | **disponible** | sélection de fichier avec poignée réutilisable |
| `showDirectoryPicker` | **disponible** | **dossier surveillé** (méthode 3) |
| `showSaveFilePicker` | disponible | export |
| `launchQueue` | **disponible** | « ouvrir avec Cyclades » depuis le gestionnaire de fichiers |
| `navigator.clipboard.readText` | **disponible** | **collage** du tableau de la banque (méthode 2) |
| `navigator.share` / `canShare` | **absent** | **partage depuis l'app bancaire : non vérifiable ici** |
| `TextDecoder('windows-1252')` et `('iso-8859-1')` | **disponibles** | encodages français **sans bibliothèque** |
| `CompressionStream`, `Worker` | disponibles | déjà utilisés ailleurs |

**Ce que cette mesure ne prouve pas.** C'est un Chromium de serveur, Linux,
sans écran. Elle ne dit rien de **tes** navigateurs : Firefox et Safari
n'implémentent pas `showDirectoryPicker`, et iOS n'a ni dossier surveillé ni
poignée persistante. Le dossier surveillé sera donc proposé **si et seulement
si l'API répond**, avec un repli annoncé, jamais supposé présent. La cible de
partage (méthode 4) reste **à vérifier sur ton téléphone**, et je ne
l'inscrirai dans aucune phase avant.

## 3. Les méthodes d'import, classées

Le critère que tu demandes : gestes, durée, fiabilité, dépendance, maintenance.
« Gestes » compte à partir de l'application ouverte, **import suivant** (le
premier import ajoute le mappage, une fois).

| # | Méthode | Gestes | Fiabilité | Tiers | Maintenance | Retenue |
|---|---|---|---|---|---|---|
| 3 | **Dossier surveillé** | **1** (« importer les 2 nouveaux fichiers ») | haute | aucun | moyenne (permission à renouveler) | **oui, si l'API répond** |
| 1 | **Glisser-déposer / choisir un fichier** | 2 à 3 | haute | aucun | faible | **oui — socle obligatoire** |
| 2 | **Coller le tableau** | 2 à 3 | moyenne (colonnes devinées) | aucun | moyenne | **oui, surtout sur téléphone** |
| 5 | **Saisie rapide** | 2 (montant, valider) | haute | aucun | faible | **oui** — espèces et prévu |
| 4 | Partage depuis l'app bancaire | 2 | ? | aucun | ? | **à vérifier sur ton téléphone** |
| 6 | Relevés PDF | 2 | **basse** | aucun | forte | **non en v1** (décision 8) |
| — | Agrégateur DSP2 | 0 | haute | **oui** | forte | **écarté** (décision 9) |

**Le plancher honnête : un geste.** Sans serveur ni tiers, aucune méthode ne
descend à zéro — rien ne peut aller chercher le fichier à ta place pendant que
l'application est fermée. Le dossier surveillé atteint ce plancher : tu choisis
le dossier **une fois**, et à chaque ouverture Cyclades dit « 2 nouveaux
fichiers, importer ? ». Je ne promettrai pas mieux.

**Le vrai gain n'est pas le geste, c'est le mappage.** Dès le deuxième import
d'une même banque, aucune colonne à désigner : le profil est reconnu par
l'empreinte de son en-tête. C'est là que se joue la différence entre « deux
minutes » et « dix secondes ».

## 4. Maquettes

### 4.1 Budget — mode simple

```
┌──────────────────────────────────────────────────────────┐
│ Mon budget                        [ Simple ] [ Détaillé ]│
├──────────────────────────────────────────────────────────┤
│ Ressources mensuelles nettes        [  2 450,00 € ]      │
│ Charges fixes mensuelles            [  1 180,00 € ]      │
│ Épargne visée                       [    300,00 € ]      │
│                                                          │
│   Reste à vivre              970,00 € par mois           │
│   ───────────────────────────────────────────            │
│   soit 31,3 € par jour sur 31 jours                      │
│   Taux d'effort : 48,2 %   Taux d'épargne : 12,2 %       │
│                                                          │
│   Reste à vivre = ressources − charges fixes − épargne   │
│   [ Modifier cette formule ]                             │
│                                                          │
│ ℹ Passer en détaillé ne perd rien : ces trois montants   │
│   deviennent trois lignes, que vous pourrez découper.    │
└──────────────────────────────────────────────────────────┘
```

Trois champs, un résultat, et la formule **écrite sous le résultat** plutôt que
cachée dans une aide. Un reste à vivre dont on ne voit pas le calcul est un
chiffre qu'on ne conteste pas, donc qu'on ne corrige pas.

### 4.2 Budget — mode détaillé

```
┌──────────────────────────────────────────────────────────────────────┐
│ Mon budget — octobre 2026              [ Simple ] [ Détaillé ]       │
│ [ + Ligne ]  [ Déduire du réel… ]  [ Scénarios (1) ]                 │
├──────────────────────────────────────────────────────────────────────┤
│ RESSOURCES                                      prévu      réel      │
│  Salaire net            mensuel, le 27        2 450,00   2 450,00  ✓ │
│  Prime                  ponctuelle                  —      300,00  + │
│                                               ────────   ────────    │
│                                               2 450,00   2 750,00    │
│                                                                      │
│ CHARGES FIXES                                                        │
│  Loyer                  mensuel, le 5           780,00     780,00  ✓ │
│  Assurance habitation   annuelle, en mars        12,50 /m       —    │
│      └ provision mensualisée · prochaine échéance 2027-03-14         │
│  Électricité            mensuel, le 15 ±3        95,00     112,40  ⚠ │
│      └ écart +17,40 € (+18,3 %) · hors tolérance (±10 €)             │
│                                                                      │
│ CHARGES VARIABLES (enveloppes)                                       │
│  Alimentation           mensuel                 400,00     318,20    │
│      └ 79 % de l'enveloppe · 9 jours restants                        │
│                                                                      │
│ ÉPARGNE PROGRAMMÉE                                                   │
│  Virement livret A      mensuel, le 2           300,00     300,00  ✓ │
├──────────────────────────────────────────────────────────────────────┤
│ Reste à vivre prévu 970,00 €  ·  projeté fin de mois 842,60 €        │
│ Moyenne lissée 31,3 €/j  ·  calendrier réel : 3 échéances d'ici le 31│
└──────────────────────────────────────────────────────────────────────┘
```

Quatre choix tiennent dans cet écran.

**Prévu et réel côte à côte, par ligne.** L'écart se lit sans ouvrir un second
écran, et sans soustraction mentale.

**« ⚠ » accompagné du chiffre et du mot.** Jamais la couleur seule : le
symbole, l'écart en euros, en pourcentage, et la raison (« hors tolérance »).
Vocabulaire neutre — « écart », jamais « dépassement ».

**La provision mensualisée affichée comme telle**, avec la date réelle en
dessous. Une assurance annuelle vaut 12,50 € par mois **et** 150 € en mars :
les deux sont vrais, et confondre les deux est la façon la plus courante de se
faire surprendre.

**« Déduire du réel… »**, en haut : c'est le chemin de 1.5, et il est à côté
de « + Ligne » parce qu'il doit être aussi visible que la saisie à la main.

### 4.3 La file « à rapprocher »

```
┌──────────────────────────────────────────────────────────────────────┐
│ À rapprocher — 14 opérations                      [ Tout confirmer ] │
│ 6 certaines (déjà appliquées) · 5 probables · 3 à classer            │
├──────────────────────────────────────────────────────────────────────┤
│ PROBABLES — un geste chacun                                          │
│                                                                      │
│  12/10  −112,40 €  PRLV EDF CLIENTS                                  │
│     → Électricité (charge fixe, prévu 95,00 € le 15 ±3)              │
│     Montant hors tolérance de 17,40 €, date dans la fenêtre,         │
│     libellé « EDF » déjà vu 11 fois sur cette ligne.                 │
│     [ Confirmer ]  [ Autre ligne ]  [ Hors budget ]  [ Diviser ]     │
│                                                                      │
│  11/10  −780,00 €  VIR M DUPONT LOYER                                │
│     → Loyer (prévu 780,00 € le 5 ±2)                                 │
│     Montant exact, date à 6 jours : hors fenêtre de 4 jours.         │
│     [ Confirmer ]  [ Autre ligne ]  [ Hors budget ]  [ Diviser ]     │
│                                                                      │
│ À CLASSER — aucune ligne ne correspond                               │
│                                                                      │
│  09/10   −43,90 €  SARL LE PETIT MARCHE                              │
│     [ Créer une ligne ]  [ Ranger dans… ]  [ Ignorer ]               │
├──────────────────────────────────────────────────────────────────────┤
│ 6 certaines appliquées automatiquement.  [ Les revoir ]  [ Annuler ] │
└──────────────────────────────────────────────────────────────────────┘
```

**Chaque proposition dit pourquoi**, en une phrase, avec les trois critères
chiffrés. Un appariement qu'on ne peut pas contester se confirme sans être lu,
et la file devient un bouton « oui » répété quatorze fois.

**Les certaines sont déjà appliquées**, annonçées en pied et annulables d'un
geste. Faire confirmer ce dont le système est sûr dépense l'attention là où
elle ne sert à rien — or le budget d'attention est précisément ce qui fait
abandonner un rapprochement mensuel.

**« Tout confirmer » porte sur les probables**, avec aperçu avant d'appliquer.

### 4.4 L'import

```
┌──────────────────────────────────────────────────────────┐
│ Importer des opérations                                  │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │   Déposez un fichier ici, ou [ choisissez-en un ]  │  │
│  └────────────────────────────────────────────────────┘  │
│  [ Coller un tableau ]   [ Surveiller un dossier… ]      │
│                                                          │
│  Dernier import : il y a 12 jours (Banque A)             │
├──────────────────────────────────────────────────────────┤
│ ✔ Format reconnu : « Banque A — export CSV »             │
│   point-virgule · Windows-1252 · JJ/MM/AAAA · virgule    │
│   [ Ce n'est pas le bon profil ]                         │
│                                                          │
│   87 opérations lues · 0 rejetée                         │
│   du 01/09/2026 au 12/10/2026 · somme −2 318,45 €        │
│   14 déjà présentes, ignorées                            │
│                                                          │
│   05/10  −12,90  ABONNEMENT ●●●● 4417                    │
│   05/10  −45,00  CARREFOUR CITY                          │
│   … 3 lignes de plus                                     │
│                                                          │
│   ⚠ 3 numéros masqués à la lecture (4 derniers chiffres  │
│     conservés). Le fichier n'est pas conservé.           │
│                                                          │
│            [ Annuler ]   [ Importer 73 opérations ]      │
└──────────────────────────────────────────────────────────┘
```

Le contrôle avant validation montre **ce qui entre et ce qui n'entre pas** :
lues, rejetées, déjà présentes, plage, somme. La somme est là pour une raison
précise — c'est le seul chiffre qu'on peut comparer d'un coup d'œil à son
relevé, et une erreur de séparateur décimal la rend absurde immédiatement.

## 5. Le modèle

Treize entités, toutes **scellées** (domaine Finances = sensible), toutes en
événements ajoutés avec suppression par marqueur, conformément au prompt de
synchronisation.

| Entité | Rôle | Note |
|---|---|---|
| `compte` | intitulé, type, devise | **jamais** de numéro ni d'IBAN |
| `valorisation` | valeur datée d'un compte | saisie à la main |
| `ligneBudget` | le prévu, **versionné** | une modification crée une version datée |
| `scenario` | copie de travail du budget | **ne touche jamais le réel** |
| `occurrence` | une échéance datée d'une ligne | **dérivée, recalculée, jamais synchronisée** |
| `operation` | le réel | libellé = donnée sensible |
| `rapprochement` | occurrence ↔ opération | type, statut, auteur, date |
| `regleLocale` | catégorisation et motifs | **visible et modifiable** |
| `profilImport` | mappage par banque | reconnu par l'empreinte d'en-tête |
| `import` | métadonnées | **sans le fichier** |
| `periodeRapprochee` | verrou de période | réouverture **avec trace** |
| `objectifEpargne` | montant, date | |
| `consommateur` | qui lit le budget | interrupteur par consommateur |

**Ce qui est dérivé n'est jamais stocké comme vérité** : occurrences, écarts,
soldes prévisionnels se recalculent. Les synchroniser comme un cache
fabriquerait des divergences invisibles entre deux appareils d'accord sur les
faits.

**Conflits.** Deux appareils qui rapprochent la même opération différemment :
les deux rapprochements sont conservés et signalés. Un rapprochement que tu as
confirmé l'emporte sur un rapprochement automatique — quelle que soit l'heure,
parce que « le dernier gagne » laisserait une machine défaire ton choix.

## 6. Les calculs

En centimes entiers, arrondi au centime le plus proche, demi vers le haut, et
**l'arrondi se fait une fois, à l'affichage** — jamais entre deux étapes.

- **Mensualisation** : montant annuel ÷ 12, le reste de la division entière
  étant réparti sur les premiers mois, de sorte que la somme des douze
  provisions **égale exactement** l'annuel. Douze fois 12,50 € pour 150 €, et
  non douze fois un arrondi qui laisse deux centimes orphelins.
- **Périodicités** : hebdomadaire, mensuelle, trimestrielle, annuelle,
  ponctuelle, règle personnalisée. Le 31 d'un mois de 30 jours tombe le 30 ;
  le 29 février d'une année non bissextile tombe le 28. Les occurrences sont
  **déterministes** : même ligne, même période, mêmes dates, toujours.
- **Taux d'effort** = charges fixes ÷ ressources. **Taux d'épargne** =
  (ressources − charges) ÷ ressources. Les deux rendent `null` sans ressource :
  zéro divisé par zéro n'est pas « 0 % ».
- **Trésorerie prévisionnelle** : solde de départ, puis occurrences jour par
  jour. Affichée **avec** la moyenne lissée, et l'écran dit laquelle est
  laquelle — c'est ton 1.4, et c'est la différence entre « j'ai 970 € » et
  « j'ai 970 € dont 780 partent le 5 ».

## 7. L'appariement

Déterministe, local, sans IA. Score sur trois critères, **et le résultat est
toujours explicable en une phrase** (maquette 4.3).

| Niveau | Condition | Effet |
|---|---|---|
| **Certain** | même compte · montant dans la tolérance · date dans la fenêtre · motif enregistré sur la ligne | appliqué, annulable |
| **Probable** | deux des trois, le troisième proche | proposé, un geste |
| **Incertain** | le reste | non proposé, va dans « à classer » |

Les cas que tu listes, et comment chacun est tenu :

- **1 → N** (loyer en deux virements) : une occurrence accepte plusieurs
  opérations ; elle est rapprochée quand leur somme entre dans la tolérance.
- **N → 1** (prélèvement groupé, carte à débit différé) : une opération se
  **divise** en parts rattachées à plusieurs occurrences. Le débit différé est
  le même mécanisme, avec un compte « carte » dont le prélèvement mensuel est
  un virement interne.
- **Montant différent** : rapproché **et** l'écart conservé. Ne pas rapprocher
  une facture de 112,40 € prévue à 95 € ferait une ligne en retard et une
  opération orpheline, c'est-à-dire deux anomalies pour un fait ordinaire.
- **Virements internes** : exclus du budget, détectés par montants opposés et
  dates proches (déjà écrit, section 12).
- **Remboursements** : une opération positive sur une ligne de charge réduit le
  réel de cette ligne, au lieu de gonfler les ressources.
- **Libellé changé par la banque** : les motifs sont des fragments, pas des
  égalités, et tes confirmations en ajoutent automatiquement — visibles et
  modifiables dans l'écran des règles.

## 8. Qui lit mon budget

Un écran, une ligne par consommateur, un interrupteur, et **ce que chacun voit
écrit en toutes lettres** :

```
  Agenda                    [ ● ]  Les dates et les montants des échéances.
  Que faire maintenant ?    [ ● ]  Le nombre d'opérations à rapprocher.
  Objectifs et planification[ ● ]  Les objectifs d'épargne, pas les opérations.
  Habitudes                 [ ● ]  La régularité de la tenue. Aucun montant.
  Quêtes                    [ ● ]  « Revue du mois faite », oui ou non.
  Veille du rythme de vie   [ ○ ]  Un changement brusque du rythme de dépenses
                                   par rapport à votre propre base. Jamais un
                                   écart au budget.
  Demander à l'IA           [ ○ ]  Rien, sauf si vous cochez à chaque fois.
```

Le dernier point mérite d'être dit ici : **la veille du rythme de vie ne doit
jamais s'allumer parce qu'un budget est dépassé.** Un budget serré est un choix,
pas un signal de santé. Elle ne regarde qu'une rupture par rapport à ta propre
base — et elle est décochée par défaut.

## 9. Les neuf décisions

| # | Question | Ma recommandation |
|---|---|---|
| 1 | Banques et formats | **J'attends ta liste.** Un export CSV par banque suffit : je déduis le profil du fichier, pas d'une documentation. |
| 2 | Méthodes retenues | **1, 2, 3, 5** (fichier, collage, dossier surveillé, saisie rapide). 4 à vérifier sur ton téléphone, 6 et 7 : voir ci-dessous. |
| 3 | Masquage | **Quatre derniers chiffres conservés.** Rien du tout casserait la distinction entre deux cartes du même foyer, et quatre chiffres sans le reste n'identifient aucun compte. |
| 4 | Reste à vivre | **ressources − charges fixes − épargne programmée.** Les enveloppes variables n'en sont pas déduites : c'est dedans qu'on vit. Formule modifiable, affichée sous le résultat. |
| 5 | Tolérances | **± 2 jours** et **± 2 % ou 2 €, le plus grand des deux** par défaut, réglables par ligne. Le « plus grand des deux » évite qu'un abonnement à 9,99 € exige une exactitude au centime. |
| 6 | Fichier source | **Jamais conservé.** Il n'apporte qu'un risque : les opérations sont déjà là, et un relevé oublié dans un stockage de navigateur est exactement ce que ce chantier cherche à éviter. |
| 7 | Consommateurs par défaut | Les cinq premiers de la section 8 **activés**, veille du rythme et IA **décochés**. |
| 8 | Relevés PDF | **Non en v1.** Fiabilité basse, formats mouvants, maintenance forte, pour un gain d'un geste sur une méthode qui en demande deux. À reconsidérer si une banque n'offre aucun export. |
| 9 | Agrégateur DSP2 | **Écarté, et je le recommande fermement.** Il impose un tiers agréé, un compte, des clés, et fait transiter **l'intégralité de tes opérations** par ses serveurs. C'est la seule méthode qui annule la propriété qui fonde Cyclades. Le gain — un geste en moins par mois — ne la paie pas. |

## 10. Les phases

| Phase | Contenu | Livrée testée |
|---|---|---|
| **0** | Ce plan et ces maquettes. | — |
| **1** | Modèle, magasins scellés, calculs du budget, occurrences déterministes, scénarios. Tests : centimes, périodicités, fin de mois, bissextiles, mensualisation exacte. | oui |
| **2** | Import : glisser-déposer, détection de format, profils par banque, collage, saisie rapide. Dédoublonnage, contrôle avant validation, annulation. Tests : encodages, chevauchements, masquage. | oui |
| **3** | Appariement, file « à rapprocher », rapprochement de solde et recherche de causes, écarts par ligne, catégorie et mois. Tests : 1→N, N→1, débit différé, remboursements. | oui |
| **4** | Dossier surveillé (si l'API répond), usage par Odyssée, écran « Qui lit mon budget », export ICS des échéances. | oui |
| **5** | Jeu synthétique de cinq ans, conflits entre deux appareils, mesures d'ergonomie (gestes et temps pour les quatre parcours que tu listes), guide court. | oui |

**Construire le budget depuis le réel (1.5) est en phase 3**, pas en phase 1 :
il faut des opérations importées et un appariement qui marche pour que la
détection de récurrences ait de quoi se nourrir.

## 11. Ce que je n'ai pas pu vérifier

- **Les capacités de tes navigateurs** : la mesure de la section 2 porte sur un
  Chromium de serveur. Firefox, Safari et iOS sont à vérifier sur tes appareils.
- **La cible de partage** (méthode 4) : `navigator.share` est absent ici, ce qui
  ne dit rien de ton téléphone.
- **Les formats d'export de tes banques** : décision 1, j'attends les fichiers.
- **Les plafonds et barèmes** (livret A, PEA, PER) : aucun n'est en dur, et
  aucun ne s'affichera sans source officielle et date de vérification. Les
  sources officielles ne sont pas atteignables depuis cet environnement en ce
  moment — même refus de passerelle que pour les échelles de la psyché.

## 12. Le fichier qui existe déjà, et ce qu'il n'est pas

`src/lib/odyssee/finances.ts` a été écrit **avant l'arrivée de ton prompt**,
quand la phase 8 d'Odyssée démarrait sur la base de C.7 seul. Il contient le
socle non-budgétaire : montants en **centimes entiers**, comptes, valorisations,
patrimoine net, opérations, règles de catégorisation, détection des virements
internes, flux et taux d'épargne, réconciliation de solde sans tolérance,
arithmétique de rééquilibrage, et le garde-fou de vocabulaire E.4.

Il est **branché à rien** : aucun magasin, aucune migration, aucun écran,
aucune projection de faits ne l'importe. Il est committé pour ne pas disparaître
avec ce conteneur, pas pour être exécuté.

Ce qu'il apporte au plan : trois des décisions ci-dessus y sont déjà éprouvées
plutôt que supposées — les centimes entiers (ton 1.4), l'interdiction des
numéros de compte vérifiée à l'écriture, et le garde-fou E.4. Ce dernier s'est
d'ailleurs pris lui-même au piège au premier essai, en refusant la mention
« aucun conseil en investissement » que E.4 oblige à afficher ; il distingue
désormais l'emploi de la négation, et se contrôle dans les deux sens.

Un mot de toi et je le supprime, ou il devient le point de départ de la phase 1.
