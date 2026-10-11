# Synchronisation : les huit décisions à prendre

Livrable de la phase 0, section 7 du prompt « synchronisation ». Chaque point
porte ma recommandation et son coût. Rien n'est codé avant tes réponses.

J'ouvre par une neuvième question, parce qu'elle commande les autres.

---

## 0. Confirmation de ton interprétation de « aucun stockage sur le site »

Tu demandes de te confirmer ta lecture. **Je la confirme, et je la précise** :
aucun serveur exploité pour le compte de Cyclades, rien dans le dépôt GitHub ni
sur `gh-pages`, aucune base hébergée. Les données ne vivent que sur tes
appareils, et, si tu le choisis, dans un emplacement qui t'appartient, chiffré.

Deux nuances que ta formulation laisse ouvertes et qu'il faut trancher :

**Un relais de signalisation n'est pas du stockage, mais c'est un tiers.** Il ne
voit que des messages de mise en relation, chiffrés avec le secret du QR, et il
n'en garde rien. Il apprend en revanche qu'un salon existe, et il voit les
adresses IP. C'est l'objet de la décision 1.

**Un serveur STUN voit ton adresse IP.** Il est nécessaire dès que les deux
appareils ne sont pas sur le même réseau. Il ne voit aucune donnée. Je le
considère comme acceptable sous ta règle, parce que ton navigateur révèle déjà
son adresse IP à GitHub Pages à chaque chargement du site — refuser STUN
protégerait d'une fuite qui a déjà lieu par ailleurs. **Dis-moi si tu vois les
choses autrement.**

---

## 1. Le relais de signalisation, et TURN

Trois réalisations possibles pour le mode A1 (un scan, appairage mémorisé,
synchronisation en un bouton).

| Option | Ce qu'elle coûte | Ce qu'elle apporte |
|---|---|---|
| **(a) Réseaux publics existants** (type Trystero) | une dépendance externe dont je ne maîtrise ni la disponibilité ni la pérennité | zéro serveur à exploiter, appairage mémorisé, niveau 0 |
| **(b) Serveur auto-hébergé** | tu exploites un serveur : hébergement, maintenance, coût, et une adresse à garder en vie | contrôle total, aucune dépendance |
| **(c) Aucun relais** (A2 seul) | environ trois gestes de plus à chaque fois, **pas d'appairage mémorisé**, et un décodeur de QR embarqué pour que ton ordinateur puisse scanner | aucun tiers du tout |

**Ma recommandation : (a), avec bascule automatique vers (c).** Et je la donne
avec une réserve que j'ai vérifiée aujourd'hui plutôt que supposée.

Trystero fait exactement ce que décrit ta section 3.5 : la signalisation passe
par des réseaux existants, les données de l'application n'y transitent jamais, et
les messages sont chiffrés par une clé dérivée du mot de passe qu'on lui fournit
— donc du secret du QR. La licence MIT est confirmée par une source secondaire.

**Mais je n'ai pas pu confirmer son entretien en 2026.** La dernière publication
que j'ai trouvée est la 0.25.1, datée d'environ un an. Et un article d'août 2025
rapporte des difficultés de montée en charge et une dépendance persistante à des
services tiers pour la signalisation. Rien de disqualifiant pour deux appareils —
nous ne sommes pas une salle de cent personnes — mais une dépendance mal
entretenue est une dépendance qui tombera un jour sans préavis.

D'où la forme de ma recommandation : (a) **à condition que la bascule vers (c)
soit construite en même temps, et non promise pour plus tard**. Si le relais
tombe, tu dois pouvoir synchroniser le jour même, avec trois gestes de plus.

**Je ne recommande pas (b).** Exploiter un serveur pour un site personnel qui
n'en a jamais eu changerait la nature du projet : une chose de plus à surveiller,
à payer et à mettre à jour, pour une fonction qui marche sans.

**TURN : non par défaut, et je recommande de ne pas l'ajouter du tout pour
l'instant.** Il ne servirait que si la liaison directe échoue, ce qui arrive sur
certains réseaux d'entreprise. Le trafic y serait doublement chiffré, donc le
risque est faible ; mais c'est un second tiers à choisir et à surveiller pour un
cas que tu ne rencontreras peut-être jamais. **La bonne séquence est d'attendre
de le rencontrer** : si la liaison directe échoue chez toi, le transport C
fonctionne, et nous ajouterons TURN à ce moment-là en sachant qu'il sert.

**Ce que je te demande** : (a) avec repli (c) construit d'emblée ? Et TURN
écarté pour l'instant ?

---

## 2. L'emplacement dans ton propre cloud (mode B)

**Ma recommandation : oui, mais en second, et sur ordinateur seulement.**

La vérification de compatibilité est nette : l'accès mémorisé à un dossier
n'existe que sur les navigateurs Chromium d'ordinateur. Ni Firefox, ni Safari, ni
aucun navigateur mobile ne l'offrent — ils n'exposent qu'un système de fichiers
privé, qui est un bac à sable et non ton disque.

Donc B tient sa promesse sur un seul des deux appareils du problème, et sur
téléphone il se réduit au sélecteur de fichiers, c'est-à-dire au transport C
déguisé en transport B.

Cela ne le rend pas inutile : sur ordinateur, c'est le seul transport **sans
aucun geste**, et il n'exige pas que les deux appareils soient ouverts en même
temps — ce qui est la seule faiblesse de A1. Il mérite donc d'exister, après A1.

**Ce que je te demande** : acceptes-tu que B soit construit en phase 3, après
A1, et documenté comme « ordinateur Chromium seulement » ?

---

## 3. Le parcours « ajouter un téléphone »

Trois candidats, chiffrés en gestes. Un « geste » est une action de ta part :
un appui, un scan, une saisie.

### Candidat 1 — QR affiché par l'ordinateur (le parcours de ton prompt)

| # | Appareil | Geste |
|---|---|---|
| 1 | ordinateur | ouvrir Données → Appareils, appuyer sur « Ajouter un téléphone » |
| 2 | téléphone | ouvrir l'appareil photo et viser le QR |
| 3 | téléphone | appuyer sur la notification qui ouvre le site |
| 4 | téléphone | saisir le mot de passe |
| 5 | téléphone | appuyer sur « Copier depuis l'ordinateur » |

**5 gestes, une seule saisie.** Points de panne : le QR expire (5 minutes) ; la
liaison directe échoue ; l'écran du téléphone s'éteint pendant le transfert.

### Candidat 2 — QR, puis copie automatique

Identique, mais le geste 5 disparaît : une fois le mot de passe saisi et
l'appareil reconnu, la copie démarre seule, avec une barre de progression et un
bouton « Annuler ».

**4 gestes.** Le gain est réel et le risque est faible : à ce stade, tu viens de
scanner un QR affiché par ton propre ordinateur et de saisir ton mot de passe —
l'intention ne fait aucun doute, et demander une confirmation de plus est une
politesse qui coûte un geste.

### Candidat 3 — Lien envoyé au téléphone, sans QR

L'ordinateur produit un lien que tu t'envoies par le moyen de ton choix. Tu
l'ouvres sur le téléphone, tu saisis le mot de passe, la copie démarre.

**4 gestes**, mais le lien porte le secret d'appairage : il transite par ta
messagerie, donc par un tiers, et il reste dans un historique. Le QR a
l'avantage de n'exister que sur un écran, cinq minutes.

### Ma recommandation : le candidat 2

Quatre gestes, une saisie, aucun secret qui sorte de l'écran. Le candidat 3 est
le secours quand aucune caméra ne fonctionne, et il doit alors afficher
clairement que le lien est à usage unique et à ne pas conserver.

**Ce que je te demande** : le candidat 2 comme parcours par défaut ?

---

## 4. La première fusion de deux bases déjà utilisées

**Ma recommandation : appareil de référence, et fermement.**

Le cas se présentera une fois : tu as cinq mois de progression sur l'ordinateur,
et tu ajoutes le téléphone. Il n'y a rien à fusionner — le téléphone est vide.
L'appareil de référence est évident, et la copie complète est la bonne réponse.

Le cas difficile serait celui où tu aurais déjà travaillé sur les deux sans
synchroniser. Il **ne s'est pas produit** et il ne se produira pas si le
téléphone est ajouté par copie. Construire un assistant de fusion de deux bases
divergentes pour un cas qui n'arrivera pas serait du travail pur, et du travail
risqué : c'est exactement là que se logent les pertes.

Ce que je propose à la place, et qui couvre le vrai risque : **l'assistant
refuse** de fusionner deux bases qui n'ont aucun ancêtre commun, explique
pourquoi, et propose de désigner une référence. Un refus clair vaut mieux qu'une
fusion hasardeuse.

**Ce que je te demande** : d'accord pour que la fusion de deux bases sans
ancêtre commun soit refusée, et non tentée ?

---

## 5. Le changement de mot de passe avec rechiffrement

Tu demandes périmètre et coût. Les voici, et le résultat est moins coûteux qu'il
n'y paraît — mais il a une limite qu'il faut dire.

**Ce qui est à rechiffrer** : rien, ou presque. Le contenu de cours est chiffré
par le build et se republie ; la base locale n'est **pas** chiffrée au repos
aujourd'hui ; les sauvegardes `.cyclades` portent chacune leur propre sel et
restent lisibles avec le mot de passe de leur date.

**Le coût réel** est donc : `npm run hash`, une ligne dans `site.config.mjs`, un
build, un déploiement, et la ressaisie du mot de passe sur chaque appareil. Je
l'ai fait aujourd'hui en quelques minutes.

**La limite, et elle est importante** : changer le mot de passe ne rend **pas**
illisibles les paquets de synchronisation déjà transmis, ni les sauvegardes
déjà faites. Un appareil retiré qui aurait conservé un ancien paquet pourra
toujours l'ouvrir avec l'ancien mot de passe. Le changement protège l'avenir, pas
le passé — et c'est ce que l'interface devra dire au moment de retirer un
appareil, au lieu de laisser croire à une révocation.

**Si la décision 3 du prompt Odyssée est retenue** (chiffrement au repos de
Psyché, Finances, médicaments et statut hormonal), le coût change : il faudra
alors rechiffrer ces magasins, sur chaque appareil, et le faire sur un état
déjà synchronisé. Ce n'est pas difficile mais ce n'est plus gratuit, et cela
explique pourquoi je place le chiffrement au repos **après** la synchronisation
dans l'ordre des phases.

**Ce que je te demande** : rien à décider tout de suite, sinon de confirmer que
l'interface doit dire franchement qu'un retrait d'appareil n'est pas une
révocation.

---

## 6. La liste des champs à conflit explicite

Ta section 1.2 donne un point de départ. Je l'ai croisée avec le catalogue de
types de faits déjà écrit (`src/lib/noyau/faits.ts`), où onze types portent déjà
le drapeau « sensible ». Les deux listes doivent être **la même**, sans quoi un
type serait sensible pour le partage et pas pour la fusion.

| Type de fait | À conflit explicite | Pourquoi |
|---|---|---|
| `odyssee.poids` | **oui** | deux pesées pour la même date : ta section 1.2 le nomme |
| `odyssee.statut-hormonal` | **oui** | la contradiction avec une phase Sport est une règle de B.4 |
| `odyssee.medicament` | **oui** | un dernier-écrivain silencieux pourrait effacer une prise |
| `odyssee.valorisation` | **oui** | un solde écrasé sans trace fausse un patrimoine |
| `odyssee.operation` | **oui** | une opération corrigée des deux côtés |
| `sport.blessure` | **oui** | présente d'un côté, absente de l'autre : règle de B.4 |
| `odyssee.mesure` | **oui** | même raison que le poids |
| `odyssee.checkin` | **non** | un check-in est un événement daté, jamais modifié : union par identifiant |
| `odyssee.journal` | **non** | idem, et une correction est une nouvelle version |
| `odyssee.repas` | **non** | événement ajouté |
| `odyssee.sante` | **oui** | une maladie déclarée d'un côté et pas de l'autre change les propositions de Sport |

**Ma recommandation : les huit « oui » ci-dessus.** Les trois « non » ne sont pas
moins sensibles — ils le restent pour le partage — mais ils sont des
**événements**, pas des états : ils s'unissent par identifiant sans conflit
possible, et leur ajouter une notification serait fabriquer des conflits qui
n'existent pas.

**Ce que je te demande** : valider ces huit, ou en ajouter.

---

## 7. La migration vers des identifiants stables

C'est la phase la plus risquée du chantier, et tu demandes son calendrier et son
risque. Voici ce que j'ai mesuré dans le code existant.

**Sept magasins ont des clés auto-incrémentées** : `quiz`, `nback`, `seances`,
`relationnel`, `vmSessions`, `qcmSessions`, `aides`. Leurs identifiants sont
attribués par le navigateur, donc **identiques des deux côtés pour des
enregistrements différents** — c'est la collision garantie.

**Un magasin est clé par un de ces identifiants** : `notes`, par `seanceId`. Il
migre avec les séances.

**Neuf magasins ont déjà des clés stables** : `cartes`, `fiches`, `journal`,
`competences`, `difficultes`, `qcmDgfip`, `vmSeuils`, `etat` — leurs clés sont
des identifiants de contenu ou des dates, identiques sur les deux appareils par
construction. Ils ne migrent pas.

**Le risque n'est pas la migration elle-même** — attribuer un ULID à chaque
enregistrement est mécanique — mais les **références croisées** : `notes` pointe
vers une séance par son numéro, et les rappels de séance aussi. Un oubli de
réécriture de référence donne une note orpheline, c'est-à-dire exactement
l'anomalie que le contrôle d'intégrité de la page Stockage sait déjà détecter.

**Ce que je propose** : la migration en phase 1, **seule**, avec instantané
automatique avant, retour arrière possible, et le contrôle d'intégrité exécuté
après pour prouver qu'aucune référence n'est cassée. Mesurée sur le jeu de cinq
ans avant d'être proposée sur tes données.

**Et un prérequis que tu n'as pas nommé, qui est bloquant.** Ta section 1.2 range
« état FSRS des cartes » parmi les états dérivés, « jamais fusionnés, recalculés
de manière déterministe à partir des journaux fusionnés ». **Or aucun journal des
révisions n'existe** : `cartes` ne porte que l'état courant. Sans journal, la
seule fusion possible est un dernier-écrivain-gagnant — précisément ce que ta
règle interdit, et le moyen le plus sûr de perdre une révision faite sur le
téléphone.

Le journal des révisions FSRS passe donc de « souhaitable » à **prérequis de la
phase 1**. Il coûte 7,59 Mio sérialisés sur cinq ans, environ 3,9 Mio réels — je
l'ai mesuré en phase 2.

**Ce que je te demande** : valider que la phase 1 comprend la création du journal
des révisions, sans quoi la phase 2 n'a pas de fondation.

---

## 8. La reprise de code sous GPL-3.0

**Ma recommandation : réécriture inspirée du modèle, sans reprise de code.** Et
ce n'est pas par principe mais par arithmétique.

Reprendre du code de Snapdrop ou de PairDrop rendrait **la partie concernée
GPL-3.0**, et par contamination le site qui la contient. Or le dépôt mélange déjà
des licences dont certaines ne sont pas vérifiées — tu le signales toi-même pour
`quad-box`, et des contenus sont sous CC BY-NC, qui est incompatible avec la
GPL. Résoudre cela demanderait un audit de licences pour un gain qui est faible :
l'appairage par QR et la liaison WebRTC tiennent en quelques centaines de lignes
sur des API standard du navigateur.

Ce qui se reprend sans aucune contrainte, c'est **le modèle** : liaison directe,
signalisation qui ne stocke rien, appairage par code ou par QR, appairage
persistant. Un modèle n'est pas couvert par une licence de code.

**Ce que je te demande** : confirmer la réécriture, et que je cite Snapdrop et
PairDrop comme inspiration dans la documentation — c'est la moindre des choses,
et cela ne coûte rien.
