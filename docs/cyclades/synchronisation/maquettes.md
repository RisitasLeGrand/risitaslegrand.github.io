# Maquettes des écrans de synchronisation

Livrable de la phase 0. Le prompt demande les maquettes des parcours 3.1
(« ajouter un téléphone ») et 3.2 (synchronisation de tous les jours) **avant
tout code**.

Elles sont textuelles plutôt qu'en HTML, et c'est un choix : une maquette HTML de
cette taille demanderait d'inventer le style avant d'avoir validé le parcours, et
on finirait par discuter des marges au lieu des gestes. Les textes affichés, en
revanche, sont écrits ici dans leur forme définitive — ce sont eux qui portent
l'honnêteté de l'écran, et ils ne doivent pas être improvisés au moment de coder.

---

## Parcours 3.1 — Ajouter un téléphone

Quatre gestes, une seule saisie (le candidat 2 des décisions).

### Écran 1 — Ordinateur · Données → Appareils

```
┌────────────────────────────────────────────────────────────────┐
│  Appareils et synchronisation                                  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Cet ordinateur                            À jour ✓      │  │
│  │  Dernière synchronisation : jamais                       │  │
│  │  Empreinte  7F2A · 91C4 · 8D06 · B3E1                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Aucun autre appareil.                                         │
│                                                                │
│  Toute votre progression vit dans ce navigateur. En ajouter    │
│  un second ne la sauvegarde pas — la synchronisation propage   │
│  aussi les erreurs et les suppressions. Continuez à            │
│  sauvegarder.                                                  │
│                                                                │
│  [ Ajouter un téléphone ]   [ Ajouter un ordinateur ]          │
└────────────────────────────────────────────────────────────────┘
```

**Geste 1** : appuyer sur « Ajouter un téléphone ».

L'avertissement n'est pas décoratif. C'est ici que la confusion naît : avoir deux
appareils donne le sentiment d'être à l'abri, et c'est faux.

### Écran 2 — Ordinateur · le QR

```
┌────────────────────────────────────────────────────────────────┐
│  Ajouter un téléphone                                   [ × ]  │
│                                                                │
│         ┌───────────────────────────┐                          │
│         │                           │                          │
│         │     ███ ▄▄▄ █▀█ ███       │   noir sur blanc,        │
│         │     █ █ ▀▄▀ ▄▄█ █▄█       │   quel que soit le       │
│         │     ███ █▄█ ▀▀▀ ███       │   thème                  │
│         │                           │                          │
│         └───────────────────────────┘                          │
│                                                                │
│  Ouvrez l'appareil photo de votre téléphone et visez ce code.  │
│  Rien à installer.                                             │
│                                                                │
│  Ce code expire dans 4 min 38 s et ne sert qu'une fois.        │
│                                                                │
│  Le scan ne marche pas ?                                       │
│  → Copier le lien   (à usage unique, ne le conservez pas)      │
│  → Code à saisir : 428 931                                     │
│                                                                │
│  En attente du téléphone…                                      │
└────────────────────────────────────────────────────────────────┘
```

**Geste 2** : viser le code avec l'appareil photo du téléphone.
**Geste 3** : appuyer sur la notification qui ouvre le site.

Trois choses sont dites sans qu'on ait à les chercher : le code expire, il ne
sert qu'une fois, et il existe deux secours. Le compte à rebours est affiché
parce qu'un QR expiré sans explication est la première cause d'abandon.

### Écran 3 — Téléphone · le mot de passe

```
┌──────────────────────────────┐
│  Cyclades                    │
│                              │
│  Cet ordinateur vous propose │
│  de copier Cyclades ici.     │
│                              │
│  « Ordinateur de bureau »     │
│  7F2A · 91C4 · 8D06 · B3E1   │
│                              │
│  Mot de passe du site        │
│  ┌────────────────────────┐  │
│  │ ••••••                 │  │
│  └────────────────────────┘  │
│                              │
│  Le même que sur l'ordinateur.│
│  Il déchiffre vos données :  │
│  sans lui, rien n'est        │
│  lisible, ici comme ailleurs.│
│                              │
│  [ Continuer ]               │
└──────────────────────────────┘
```

**Geste 4** : saisir le mot de passe.

L'empreinte de l'ordinateur est montrée **avant** la saisie. C'est ce qui permet
de voir qu'on parle au bon appareil, et c'est la seule défense contre un QR
photographié par quelqu'un d'autre — l'autre défense, la preuve de connaissance
du mot de passe, est invisible et opère juste après.

### Écran 4 — Téléphone · la copie, sans geste de plus

```
┌──────────────────────────────┐
│  Copie en cours              │
│                              │
│  ████████████░░░░░░░  58 %   │
│  18,4 Mo sur 31,6 Mo         │
│  Environ 40 s restantes      │
│                              │
│  Gardez cet écran allumé.    │
│  Les navigateurs de téléphone│
│  suspendent les pages        │
│  passées à l'arrière-plan :  │
│  le transfert s'arrêterait.  │
│                              │
│  [ Annuler ]                 │
└──────────────────────────────┘
```

Aucun geste. La copie démarre dès que le mot de passe est prouvé : à ce stade,
l'intention ne fait aucun doute, et demander une confirmation de plus coûterait
un geste pour ne rien protéger.

La consigne sur l'écran allumé est là parce que c'est la panne la plus probable,
et qu'elle est invisible : le transfert s'arrête sans message, et le téléphone
semble simplement lent.

### Écran 5 — Les deux appareils, la même empreinte

```
   ORDINATEUR                          TÉLÉPHONE
┌───────────────────────────┐    ┌──────────────────────────────┐
│  Identiques ✓             │    │  Identiques ✓                │
│                           │    │                              │
│  7F2A · 91C4 · 8D06 · B3E1│    │  7F2A · 91C4 · 8D06 · B3E1   │
│                           │    │                              │
│  Comparez les deux        │    │  Comparez les deux écrans :  │
│  écrans : les quatre      │    │  les quatre groupes doivent  │
│  groupes doivent être     │    │  être identiques.            │
│  identiques.              │    │                              │
│                           │    │  ┌────────────────────────┐  │
│  [ Comparer en détail ]   │    │  │ Ajouter à l'écran      │  │
│                           │    │  │ d'accueil              │  │
│                           │    │  │                        │  │
│                           │    │  │ Sur iPhone, un site    │  │
│                           │    │  │ non ajouté peut voir   │  │
│                           │    │  │ ses données effacées   │  │
│                           │    │  │ après sept jours sans  │  │
│                           │    │  │ visite.                │  │
│                           │    │  │                        │  │
│                           │    │  │ [ Me montrer comment ] │  │
│                           │    │  └────────────────────────┘  │
└───────────────────────────┘    └──────────────────────────────┘
```

L'empreinte est affichée **des deux côtés en même temps**, en quatre groupes de
quatre signes, parce que c'est ce qu'un œil compare sans se tromper. « Identiques
✓ » n'est pas une affirmation du logiciel : c'est une invitation à vérifier
soi-même, et le texte le dit.

La proposition d'ajouter à l'écran d'accueil arrive ici, et pas avant : c'est le
seul moment où elle a un sens, parce que les données viennent d'arriver et
qu'elles sont désormais à protéger.

---

## Parcours 3.2 — La synchronisation de tous les jours

### Le cas normal : zéro geste

```
┌────────────────────────────────────────────────────────────────┐
│  Cyclades · Révisions                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⟳ Synchronisé avec « Téléphone » à l'instant.  Identiques ✓│ │
│  └──────────────────────────────────────────────────────────┘  │
```

Un bandeau qui disparaît au bout de quelques secondes. Rien à faire, rien à
confirmer.

### Les trois états, visibles en permanence

L'état vit dans l'en-tête, à côté du sélecteur de parcours.

```
  ⟳ À jour                     les appareils connus ont le même état
  ⟳ 14 différences en attente  un bouton « Synchroniser »
  ⚠ 2 conflits à traiter       un bouton « Voir les conflits »
```

Aucun n'est bloquant. Un conflit en attente ne doit pas empêcher de réviser : il
dégrade la fiabilité des analyses concernées, et c'est tout.

### Un geste, quand l'autre appareil n'était pas ouvert

```
┌────────────────────────────────────────────────────────────────┐
│  Appareils et synchronisation                                  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Cet ordinateur                   14 différences          │  │
│  │  Empreinte  7F2A · 91C4 · 8D06 · B3E1                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Téléphone                        vu il y a 2 jours       │  │
│  │  Empreinte  C1D8 · 44AF · 2B70 · 9E35                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Les empreintes diffèrent : les deux appareils n'ont pas le    │
│  même état. Ouvrez Cyclades sur le téléphone, puis :           │
│                                                                │
│  [ Synchroniser ]            [ Comparer en détail ]            │
│                                                                │
│  Sauvegardes — la même liste sur les deux appareils            │
│  11 oct. 05 h 17   ordinateur   couvert jusqu'au 11 oct.       │
│  04 oct. 21 h 02   téléphone    couvert jusqu'au 04 oct.       │
└────────────────────────────────────────────────────────────────┘
```

Les empreintes différentes sont montrées **côte à côte**, et la phrase dit ce
qu'il faut faire. « Les empreintes diffèrent » sans consigne serait un constat
inutile.

Le registre des sauvegardes est partagé : une sauvegarde faite sur le téléphone
compte pour l'ordinateur, et la colonne « couvert jusqu'au » dit exactement ce
qu'elle protège. C'est ce qui évite de sauvegarder deux fois ou pas du tout.

### L'aperçu avant fusion

```
┌────────────────────────────────────────────────────────────────┐
│  Avant de fusionner                                     [ × ]  │
│                                                                │
│  À recevoir du téléphone        À envoyer au téléphone         │
│  11 opérations                  3 opérations                   │
│  · 8 révisions de flashcards    · 2 séances de révision        │
│  · 2 check-ins                  · 1 réglage                    │
│  · 1 pesée                                                     │
│                                                                │
│  ⚠ 1 conflit prévu                                             │
│    Poids du 9 octobre : 74,2 kg (ordinateur) / 73,8 kg         │
│    (téléphone). Les deux valeurs seront conservées et vous     │
│    serez consulté. Aucune ne sera écrasée.                     │
│                                                                │
│  Une sauvegarde de l'état actuel sera téléchargée avant la     │
│  fusion. La fusion est annulable.                              │
│                                                                │
│  [ Fusionner ]                        [ Annuler ]              │
└────────────────────────────────────────────────────────────────┘
```

Le conflit est annoncé **avant**, avec les deux valeurs et leur appareil. La
phrase « aucune ne sera écrasée » est la promesse centrale de tout le chantier,
et elle doit être lisible là où elle s'applique.

### La notification de correction, quand le conflit porte sur un champ sensible

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠ Deux valeurs pour le poids du 9 octobre                     │
│                                                                │
│  74,2 kg          saisi sur l'ordinateur, 9 oct. à 07 h 12     │
│  73,8 kg          saisi sur le téléphone, 9 oct. à 07 h 40     │
│                                                                │
│  En attendant votre choix, la plus récente est affichée,       │
│  marquée « à vérifier », et la même sur les deux appareils.    │
│  Les analyses qui s'en servent le disent.                      │
│                                                                │
│  [ Garder 74,2 ]  [ Garder 73,8 ]                              │
│  [ Les deux sont justes ]  [ Ignorer ]                         │
│                                                                │
│  « Les deux sont justes » demandera une précision (deux pesées │
│  dans la journée, par exemple). « Ignorer » demandera un motif.│
│  Votre choix est journalisé.                                   │
└────────────────────────────────────────────────────────────────┘
```

Les quatre issues de B.4, dans cet ordre. Les deux premières sont les plus
fréquentes et viennent en premier ; les deux suivantes demandent une précision,
et le dire d'avance évite la surprise d'un second écran.

---

## Ce que ces maquettes décident, et qui vaut d'être relevé

**L'empreinte est partout.** Sur l'écran d'un appareil, sur l'autre, dans la
liste, dans l'aperçu. C'est ton exigence n° 1 — « identiques doit être
vérifiable » — et la seule façon de la tenir est de montrer l'empreinte si
souvent qu'on n'ait jamais à la chercher.

**Aucun écran ne promet l'arrière-plan.** Pas de « synchronisation automatique »
qui laisserait croire à un service qui tourne. Le bandeau dit « synchronisé à
l'instant », au passé, parce que c'est la seule chose vraie d'un site statique.

**L'avertissement « ce n'est pas une sauvegarde » apparaît trois fois** : à
l'ajout d'un appareil, dans l'aperçu de fusion, et dans la liste des
sauvegardes. Trois fois, parce que c'est la croyance la plus coûteuse que ce
chantier risque d'installer.
