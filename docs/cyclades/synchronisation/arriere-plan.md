# Synchronisation en arrière-plan sur un ordinateur certifié

Amendement du 11 octobre 2026, demandé après validation du plan : « Synchronisation
en arrière-plan uniquement avec un ordinateur *certifié*, à activer manuellement
par l'utilisateur. Une notification de synchronisation doit être envoyée à
l'utilisateur sur le site (et par PUSH sur téléphone). L'utilisateur doit pouvoir
annuler. »

Le plan refusait toute synchronisation en arrière-plan. L'amendement la rétablit
dans un périmètre restreint, et ce périmètre est le bon : la raison du refus
était qu'un site statique ne peut pas promettre un service qui tourne. Un
ordinateur désigné, allumé, sur lequel Cyclades est ouvert, n'est pas une
promesse de service : c'est un fait vérifiable.

Trois des quatre demandes sont réalisables. La quatrième, la notification PUSH,
ne l'est pas sous la forme demandée, et ce document dit pourquoi avant de
proposer ce qui l'est.

---

## 1. Ce qu'« arrière-plan » peut vouloir dire ici, exactement

Un site statique n'a pas de processus. Rien ne s'exécute quand toutes ses
fenêtres sont fermées — sauf un *service worker* réveillé par le navigateur, ce
qui a des conditions strictes.

| Ce qu'on voudrait | Possible ? | Condition |
|---|---|---|
| L'ordinateur synchronise sans geste, Cyclades ouvert dans un onglet | **oui** | l'onglet est ouvert, l'ordinateur allumé |
| L'ordinateur synchronise sans aucune fenêtre ouverte | **non** | `RTCPeerConnection` n'existe pas dans un *service worker* : la liaison directe est impossible hors page |
| Le téléphone se réveille seul pour synchroniser | **non en pratique** | *Periodic Background Sync* est Chromium seulement, exige une application installée, un intervalle de l'ordre de douze heures, et ne peut pas non plus faire de WebRTC |
| Le téléphone reçoit une notification PUSH envoyée par l'ordinateur | **non** | voir § 3 |

**Donc** : « arrière-plan » signifie *sans geste de l'utilisateur, pendant que
Cyclades est ouvert sur l'ordinateur certifié*. C'est une restriction réelle, et
elle doit être écrite sur l'écran qui active la fonction — pas dans une note de
bas de page. Un utilisateur qui croit que son ordinateur éteint synchronise est
exactement le genre de croyance que ce chantier doit refuser d'installer.

## 2. Ce qu'est un ordinateur « certifié »

Un appareil que l'utilisateur **désigne explicitement**, et un seul à la fois. La
certification n'est pas une propriété technique de l'appareil : c'est une
décision, enregistrée dans le registre d'appareils, et révocable d'un geste.

Un appareil certifié :
- a prouvé la connaissance du mot de passe lors de l'appairage ;
- porte une empreinte d'appareil enregistrée, affichée au moment de la
  certification pour que l'utilisateur voie **lequel** il certifie ;
- est le seul autorisé à **initier** une fusion sans geste ;
- ne gagne **aucun** droit de lecture supplémentaire : la matrice de permissions
  par type de fait (phase 3b) s'applique identiquement. Un appareil certifié
  n'est pas un appareil privilégié, c'est un appareil autorisé à agir seul.

La certification est désactivée par défaut, et s'active sur l'ordinateur
lui-même — jamais à distance depuis le téléphone, ce qui serait le chemin d'une
prise de contrôle par QR photographié.

## 3. La notification PUSH : pourquoi elle est impossible, et quoi à la place

### Le fait, vérifié

Le protocole Web Push (RFC 8030, RFC 8292) fait envoyer la notification par un
**serveur applicatif** : il chiffre la charge pour l'abonnement, signe un jeton
VAPID en ES256, et fait un POST vers le point de terminaison du service de push.
Cyclades n'a pas de serveur.

L'idée naturelle — faire jouer ce rôle à l'ordinateur certifié, dont le
navigateur ferait le POST — **ne fonctionne pas** : les services de push ont
retiré le partage de ressources entre origines (CORS) de leur point de
terminaison. Mozilla Autopush, FCM et WNS bloquent les requêtes Web Push venant
directement d'un navigateur. Un navigateur ne peut donc pas envoyer de push,
quelle que soit sa bonne foi.

À vérifier sur appareil, non vérifiable depuis cette machine : le comportement
CORS exact de chaque service aujourd'hui. Mais la direction est claire et
ancienne, et construire dessus serait imprudent.

### Écartée : GitHub Actions comme expéditeur

Le dépôt est public, les Actions y sont gratuites : un workflow pourrait signer
et envoyer le push. Écartée, pour trois raisons qui tiennent chacune seule.
L'abonnement push du téléphone — donc un identifiant stable de l'appareil —
devrait être déposé chez GitHub. La clé privée VAPID deviendrait un secret de
dépôt, c'est-à-dire un secret hors de la machine. Et il faudrait un jeton pour
déclencher le workflow depuis l'ordinateur, soit un troisième secret. Cela
reconstitue un serveur, avec ses clés, pour une notification.

### Écartée pour l'instant : un relais public de notifications

Un service libre et gratuit du type ntfy permet de publier par un simple POST et
de recevoir sur téléphone. Deux réserves, et la seconde est sérieuse : la
publication depuis une origine de navigateur n'est pas documentée comme
autorisée par CORS et reste à éprouver ; et sans compte, **le nom du sujet fait
office de mot de passe** — or il vivrait dans du code côté client. Le contenu
serait chiffré, donc illisible, mais quiconque devine le sujet apprend *qu'une
synchronisation a eu lieu*, et peut en fabriquer de fausses. À retenir comme
option de la phase 5 si tu l'acceptes explicitement, avec le nom de sujet tiré
au hasard et stocké chiffré ; pas par défaut.

### Retenu : la notification locale, qui ne mentait jamais

Deux chemins, qui couvrent ensemble tous les navigateurs du tableau de
compatibilité :

1. **Sur le site** — un bandeau et une entrée dans le registre, visibles dès
   l'ouverture de Cyclades sur n'importe quel appareil. C'est la demande
   « notification sur le site », et elle est entièrement réalisable.
2. **Sur le téléphone** — l'API `Notification` depuis la page quand elle est
   ouverte, et depuis le *service worker* quand il est réveillé. Sur Android avec
   une application installée, *Periodic Background Sync* peut le réveiller pour
   afficher la notification en attente — sans synchroniser, seulement notifier.
   Sur iPhone, l'affichage d'une notification exige une application ajoutée à
   l'écran d'accueil, ce que la maquette propose déjà au bon moment.

La différence avec un vrai push : la notification arrive à la prochaine
ouverture, ou au prochain réveil du *service worker*, pas dans la seconde. Pour
un journal de révision, c'est sans conséquence. Et c'est **vrai**, ce qui est la
propriété qui compte.

## 4. L'annulation

C'est la demande qui tombe le mieux : le modèle de fusion la rend simple, là où
une fusion par écrasement l'aurait rendue impossible.

Chaque fusion automatique porte un **identifiant de lot**. Toute opération
intégrée par cette fusion référence ce lot. Annuler, c'est :

1. retirer du journal les opérations du lot — et elles seules ;
2. recalculer les états dérivés à partir du journal restant ;
3. journaliser l'annulation elle-même, qui est une opération comme une autre.

Trois propriétés tombent de là, et aucune ne demande de code supplémentaire.
L'annulation est **exacte** : elle ne retire pas « les changements d'hier », elle
retire ce lot. Elle est **sans perte** : les faits locaux saisis entre-temps ne
sont pas touchés, puisqu'ils ne portent pas ce lot. Et elle est **rejouable** :
le lot annulé sera réintégré à la prochaine fusion si l'utilisateur change
d'avis, parce que l'autre appareil l'a toujours — l'annulation est locale, pas
une suppression.

Un cas à nommer, parce qu'il est le seul vraiment délicat : **annuler un lot dont
un lot ultérieur dépend**. Le journal n'a pas de dépendances entre opérations —
un fait ne présuppose pas un autre fait —, donc le cas ne se produit pas pour les
faits. Il se produit pour les **réglages** : si le lot 1 a changé l'heure de
bascule et le lot 2 l'a changée encore, annuler le lot 1 ne doit pas ressusciter
l'ancienne valeur. La règle est celle du dernier écrivain sur le journal restant,
et elle donne la bonne réponse sans cas particulier.

**Délai** : l'annulation reste offerte **sept jours**, et au-delà seule la
restauration d'une sauvegarde reste possible. Le délai n'est pas une limite
technique — le journal garde tout —, mais une limite d'honnêteté : au-delà d'une
semaine, les états dérivés ont été recalculés tant de fois qu'annuler une fusion
ancienne reviendrait à défaire du travail réel sans que l'utilisateur puisse
prévoir ce qu'il perd.

## 5. Les écrans

### Activation, sur l'ordinateur à certifier

```
┌────────────────────────────────────────────────────────────────┐
│  Synchronisation automatique                       ( ) inactif │
│                                                                │
│  Cet ordinateur peut synchroniser sans que vous ayez à         │
│  appuyer sur un bouton.                                        │
│                                                                │
│  Ce que cela veut dire exactement :                            │
│  · pendant que Cyclades est ouvert dans un onglet ici ;        │
│  · et que l'autre appareil est ouvert aussi.                   │
│                                                                │
│  Cyclades fermé, ou cet ordinateur éteint, rien ne se          │
│  synchronise. Un site web ne peut pas tourner tout seul, et    │
│  nous préférons le dire.                                       │
│                                                                │
│  Cet ordinateur  « Ordinateur de bureau »                      │
│                  7F2A · 91C4 · 8D06 · B3E1                     │
│                                                                │
│  Vous serez averti de chaque synchronisation, et vous aurez     │
│  sept jours pour l'annuler.                                    │
│                                                                │
│  [ Certifier cet ordinateur ]                                  │
└────────────────────────────────────────────────────────────────┘
```

### La notification d'une fusion automatique

```
┌────────────────────────────────────────────────────────────────┐
│  ⟳ Synchronisé automatiquement, il y a 12 min                   │
│                                                                │
│  Reçu de « Téléphone » : 8 révisions, 2 check-ins, 1 pesée.    │
│  Envoyé : 3 opérations.                                        │
│  Identiques ✓   7F2A · 91C4 · 8D06 · B3E1                      │
│                                                                │
│  [ Voir le détail ]        [ Annuler cette synchronisation ]    │
│                                                                │
│  Annulable jusqu'au 18 octobre.                                │
└────────────────────────────────────────────────────────────────┘
```

### L'annulation, avec ce qu'elle retire nommé

```
┌────────────────────────────────────────────────────────────────┐
│  Annuler la synchronisation du 11 octobre à 05 h 17     [ × ]  │
│                                                                │
│  Seront retirées les 11 opérations reçues dans cette           │
│  synchronisation, et elles seules :                            │
│  · 8 révisions de flashcards du 9 et 10 octobre                │
│  · 2 check-ins du 10 octobre                                   │
│  · 1 pesée du 9 octobre (74,2 kg)                              │
│                                                                │
│  Ce que vous avez saisi ici depuis n'est pas touché.           │
│  XP, série et échéances FSRS seront recalculés.                │
│                                                                │
│  Le téléphone garde ces opérations : elles reviendront à la     │
│  prochaine synchronisation si vous ne les refusez pas aussi     │
│  là-bas.                                                       │
│                                                                │
│  [ Annuler la synchronisation ]            [ Revenir ]          │
└────────────────────────────────────────────────────────────────┘
```

La dernière phrase est celle qui évite une incompréhension coûteuse : annuler
chez soi n'efface pas chez l'autre, et l'idempotence du moteur fera revenir le
lot. C'est une conséquence du modèle, pas un défaut, mais elle doit être dite.

## 6. Conséquences sur le plan

- **Phase 1** : les opérations portent un champ `lot` (nul pour une saisie
  locale). Ajouté maintenant, parce que l'ajouter après coup priverait
  d'annulation toutes les fusions antérieures.
- **Phase 4** : l'écran d'activation, la notification sur le site, l'écran
  d'annulation.
- **Phase 5** : la notification sur téléphone par *service worker*, et le relais
  public de notifications si tu l'acceptes.
- Le refus « pas de synchronisation en arrière-plan » du plan est remplacé par ce
  document. Les deux autres refus — pas de fusion sans ancêtre commun, pas de
  TURN — tiennent.
