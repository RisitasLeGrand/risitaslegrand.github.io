# Synchronisation entre appareils — plan en phases

Livrable de la phase 0, écrit le 11 octobre 2026. Les trois autres livrables de
cette phase sont `decisions.md` (les huit décisions à valider), `maquettes.md`
(les parcours 3.1 et 3.2) et `compatibilite.md` (le tableau daté). Un cinquième
document, `arriere-plan.md`, porte l'amendement validé le même jour sur
l'ordinateur certifié, la notification et l'annulation.

Le prompt qualifie ce chantier de « plus risqué de tous ». Il l'est, et pour une
raison précise : c'est le premier qui peut **détruire des données déjà saisies**.
Tous les chantiers précédents ajoutaient. Celui-ci réécrit la base, puis la
fusionne. Le plan est donc construit autour de cette menace, et non autour de la
fonctionnalité.

---

## 1. Le modèle de fusion, avant toute ligne de code

C'est la partie qui doit être juste. Si elle est fausse, aucun écran, aucun
transport, aucun test d'interface ne la rattrapera.

### 1.1 Trois natures de données, trois traitements

| Nature | Exemples | Traitement |
|---|---|---|
| **Faits** | une révision de flashcard, un check-in, une pesée, un repas, une séance | **journalisés**, jamais écrasés, fusionnés par union |
| **État dérivé** | FSRS (stabilité, difficulté, échéance), XP, niveau, série, indicateurs | **jamais fusionné** : recalculé des journaux fusionnés |
| **Réglages** | rotation hebdomadaire, heure de bascule, parcours courant, matrice de permissions | **dernier écrivain gagne**, par champ, avec horloge logique |

La distinction est la clé de tout. Un fait est arrivé : deux appareils qui en ont
chacun un en ont deux. Un état dérivé est un calcul : deux appareils qui n'ont
pas le même n'ont pas un conflit, ils ont un désaccord qui se dissout dès qu'on
recalcule. Les fusionner serait l'erreur la plus coûteuse du chantier — une XP
additionnée deux fois ne se répare pas.

### 1.2 Le journal d'opérations

Une opération est immuable et porte :

```
{
  id:        ULID            identifiant unique, trié par le temps
  appareil:  string          identifiant court de l'appareil émetteur
  hlc:       [ms, compteur]  horloge logique hybride
  type:      string          'revision' | 'checkin' | 'pesee' | 'seance' | …
  cible:     string          l'identifiant stable de l'objet concerné
  charge:    objet           les champs du fait
}
```

**ULID** et non UUID v4 : il se trie par ordre chronologique, ce qui rend
l'itération d'un journal de dizaines de milliers d'entrées possible sans index
secondaire. **Horloge logique hybride** et non horodatage mural : deux appareils
dont les horloges diffèrent de trois minutes produiraient un ordre instable, et
un appareil dont l'horloge recule produirait des opérations « antérieures » à
des opérations qu'il a déjà vues. La HLC garantit que l'ordre observé par un
appareil est conservé, tout en restant lisible par un humain (sa partie haute
est une date).

L'ordre de fusion est `(hlc, appareil, id)`. Les trois composantes sont
nécessaires : la HLC peut être égale entre deux appareils, l'identifiant
d'appareil départage alors de façon stable, et l'ULID clôt le cas d'un même
appareil au même instant logique.

### 1.3 Les trois garanties, et leur démonstration

**Commutativité** — `fusion(A, B) = fusion(B, A)`.
Les faits sont une union d'ensembles d'opérations identifiées par un ULID :
l'union est commutative. Les réglages sont un dernier-écrivain-gagne sur un ordre
total `(hlc, appareil, champ)` : le maximum d'un ensemble ne dépend pas de l'ordre
d'insertion. L'état dérivé n'est pas fusionné.

**Associativité** — `fusion(fusion(A, B), C) = fusion(A, fusion(B, C))`.
Même argument : union d'ensembles et maximum sur un ordre total sont tous deux
associatifs. C'est ce qui rend légitime la synchronisation en étoile — le
téléphone peut recevoir de l'ordinateur ce que l'ordinateur avait reçu de la
tablette, sans que le résultat dépende du chemin.

**Idempotence** — `fusion(A, A) = A`.
Une opération déjà présente est reconnue par son ULID et ignorée. C'est ce qui
rend un paquet rejouable : une coupure en cours de transfert se répare en
renvoyant le paquet entier, sans comptabilité partielle.

Ces trois propriétés ne sont pas une élégance : ce sont les conditions pour que
la fusion soit **rejouable sans dommage**. Elles seront vérifiées par génération
aléatoire, et non seulement par raisonnement — c'est l'objet des tests de
propriétés de la phase 2. Le raisonnement ci-dessus repose en effet sur une
hypothèse que seul le code peut tenir : qu'aucune opération ne soit jamais
modifiée après émission. Une seule mutation en place et les trois garanties
tombent ensemble.

### 1.4 L'empreinte d'état

Un hachage SHA-256 sur la liste triée des ULID du journal, plus le hachage des
réglages normalisés. Affiché en quatre groupes de quatre signes, c'est
l'« identiques ✓ » des maquettes.

Elle porte sur les **journaux**, non sur l'état dérivé. Deux appareils peuvent
avoir la même empreinte et un état dérivé momentanément différent — l'un n'a pas
encore recalculé. L'écran doit dire « identiques » dans ce cas, parce que c'est
vrai de ce qui compte, et le recalcul est déterministe.

### 1.5 Les suppressions

Une suppression est une opération, pas une absence. Sans cela, un appareil en
retard ressusciterait à chaque fusion ce que l'autre a supprimé. Le journal porte
donc des pierres tombales, et la compaction (phase 5) ne peut effacer une pierre
tombale qu'une fois que **tous les appareils du registre** l'ont vue — d'où le
registre d'appareils, qui n'est pas un ornement de l'écran mais une pièce du
moteur.

### 1.6 Ce que ce modèle coûte, dit franchement

Le journal double le volume : on garde le fait **et** l'état qu'il produit. La
mesure de cinq ans donne 22 718 enregistrements et 9,12 Mio réels ; le journal
FSRS à lui seul en ajoute 59 248, soit 7,59 Mio sérialisés et de l'ordre de
3,9 Mio réels. On passe donc d'environ 9 à environ 14 Mio sur cinq ans, contre un
quota de l'ordre du gigaoctet. Le coût est en lecture, pas en place : un recalcul
complet lit tout le journal, et c'est l'opération qu'il faudra mesurer.

---

## 2. Les phases

Chaque phase est livrée et validée seule. L'ordre n'est pas négociable : il suit
le risque décroissant.

### Phase 1 — Identifiants stables, journal, migration

**La phase la plus risquée du chantier entier.** Elle réécrit la base existante.

- Identifiants stables (ULID) sur les enregistrements qui n'en ont pas : `quiz`,
  `nback`, `seances`, `relationnel`, `vmSessions`, `qcmSessions`, `aides` ont
  aujourd'hui des clés auto-incrémentées, qui sont par construction en conflit
  entre deux appareils — deux appareils produisent tous deux un `id: 1`.
- Magasin `operations`, indexé par `hlc` et par `cible`.
- **Journal de révisions FSRS**, qui n'existe pas aujourd'hui. `cartes` ne porte
  que l'état courant : sans journal, l'état FSRS n'est pas recalculable, et la
  règle « les états dérivés sont recalculés » est inapplicable. C'est un
  **prérequis**, pas une amélioration.
- Empreinte d'état.
- Champ `lot` sur les opérations, nul pour une saisie locale, portant
  l'identifiant de la fusion qui les a intégrées. Posé dès cette phase : ajouté
  plus tard, il priverait d'annulation toutes les fusions antérieures.
- Migration avec **instantané `.cyclades` automatique avant** et retour arrière
  possible tant que la version précédente du schéma est connue.

**Critère de sortie** : la migration tourne sur le jeu de cinq ans, sa durée est
mesurée, le retour arrière est éprouvé, et l'application fonctionne exactement
comme avant — aucune fonctionnalité nouvelle n'est visible. Si cette phase est
validée sans que rien n'ait changé à l'écran, elle a réussi.

**Risque pour les données déjà saisies** : réel. Une migration qui échoue à
mi-course laisse une base incohérente. Parade : la migration est écrite comme une
seule transaction IndexedDB par magasin, l'instantané précède tout, et la version
du schéma ne s'incrémente qu'en dernier — une base à l'ancienne version est
toujours lisible par l'ancien code.

### Phase 2 — Moteur de fusion, format de paquet, simulateur

Pas un octet de réseau dans cette phase. Deux bases en mémoire, un moteur, des
tests.

- Moteur de fusion, avec la documentation des règles **par type de donnée**.
- Format de paquet : en-tête en clair (version, appareil émetteur, sel,
  itérations, bornes HLC couvertes), charge chiffrée. Même discipline que
  `.cyclades` : compresser **puis** chiffrer, somme de contrôle sur les octets du
  fichier. Le sel voyage dans le paquet, puisqu'il est régénéré à chaque build du
  site et diffère donc entre deux versions.
- **Simulateur de deux appareils** : deux instances du moteur, un canal que le
  test contrôle, de quoi injecter dérive d'horloge, troncature, doublon et
  partition.
- Tests de propriétés (`fast-check`) : ordre aléatoire, doublons, partitions →
  même empreinte.

**Critère de sortie** : cinq ans de données, 30 jours de divergence, fusion dans
les deux sens, empreintes identiques, et XP, série et FSRS identiques après
recalcul.

### Phase 3 — Transports, dans l'ordre de la confiance

- **C d'abord** : transfert manuel de fichier. C'est le transport universel, et
  surtout celui qui éprouve le moteur sans qu'un bug de réseau puisse être
  confondu avec un bug de fusion.
- **A1 ensuite** : appairage par QR, liaison directe WebRTC, relais de
  signalisation public, **A2 construit en même temps** (sans relais, par
  échange de deux QR). La décision 1 explique pourquoi les deux ensemble : A1
  seul rend le chantier dépendant d'un réseau tiers qui peut disparaître.
- **B enfin** : fichier dans un emplacement choisi. Chromium de bureau seulement,
  d'après le tableau de compatibilité.

### Phase 4 — Les écrans

L'écran « Appareils et synchronisation », les deux parcours des maquettes, le
registre d'appareils, le registre de sauvegardes partagé, l'assistant de première
fusion.

### Phase 5 — Durcissement

Changement de mot de passe avec rechiffrement, compaction déterministe avec un
appareil en retard, rétention, et les cas limites de la section 6 du prompt.

---

## 3. Ce que ce plan ne fera pas

- **Pas de fusion de deux bases sans ancêtre commun.** La décision 4 le refuse,
  et le plan n'en prévoit aucune phase. Une telle fusion n'a pas de réponse juste
  pour les séries, les niveaux et les états FSRS.
- **Pas de relais TURN.** Si la liaison directe échoue, l'écran bascule sur A2 ou
  sur C. Un TURN verrait passer le trafic chiffré, et serait un service à payer
  ou à exploiter.
- **Pas de synchronisation en arrière-plan non surveillée.** Amendé le 11 octobre
  2026 : elle est rétablie pour un **ordinateur certifié**, activée à la main,
  avec notification et annulation sous sept jours. Voir `arriere-plan.md`, qui
  dit aussi ce qui est abandonné : la notification PUSH, faute de serveur pour
  la signer, les services de push ayant retiré CORS de leur point de
  terminaison. Ni push, ni relais qui en prendrait le nom — la notification est
  sur le site et, sur téléphone, par l'API « Notification ».

---

## 4. Les quatre points de validation

1. **Maintenant** : ce plan, les maquettes, les décisions, le tableau de
   compatibilité.
2. **Après la phase 1** : la migration, seule, sans fonctionnalité visible.
3. **Après la phase 2** : le moteur et ses tests, sans réseau.
4. **Après la phase 3a** (transport C) : la première synchronisation réelle, par
   fichier, avant d'ouvrir le moindre canal réseau.

Le reste peut avancer d'un trait.
