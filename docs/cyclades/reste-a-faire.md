# Ce qui reste à faire — relevé du 13 octobre 2026

Dressé sur l'état réel du dépôt, pas sur la liste de tâches : les comptes
ci-dessous sont mesurés, et les écarts avec ce que la liste annonçait sont
signalés.

---

## A. En cours

| Chantier | Où en est-ce | Qui |
|---|---|---|
| **Veille du rythme de vie, phase 4** | Jeux synthétiques écrits, taux de faux signaux en cours de mesure sur cinq ans × dix graines × trois sensibilités. Restent : déterminisme sur deux appareils, synthèse médecin, mode rejeu, documentation. | moi |
| **Fascicule 5 — 79 fiches** | Inventaire rendu : 346 pages, 79 chapitres, dont **61 entièrement neufs**. 16 fiches écrites à l'heure de ce relevé. +23 % de contenu, qui porterait le total à 426 fiches. | agent INSP |
| **Explications et corrections détaillées** | 8 048 questions au total. **2 706 n'ont aucune explication**, et 7 902 n'ont pas de correction détaillée. Plan chiffré demandé avant exécution. | agent INSP, après le F5 |

---

## B. Déblocable tout de suite

### B.1 — Les trois échelles ne sont plus bloquées ★

C'est le changement le plus important de la journée, et la liste de tâches ne
le reflétait pas. `echelles-psyche/releve-sources.md` établit que **tout est
authentifié** : textes français intégraux du WHO-5, du PHQ-9 et du GAD-7,
options de réponse, règles de score, seuils d'interprétation, et licence —
domaine public pour le PHQ et le GAD. Six fichiers empreintés.

Il ne manque plus de **fichier**. Il manque une **décision**, posée en
section 14.5 : le manuel dit que peu de traductions ont été validées
psychométriquement, et les seuils sont établis sur les versions anglaises.
Trois formulations possibles, de la plus prudente à la plus informative :

1. score brut seul, sans palier ;
2. score et palier, **avec mention** que les paliers viennent de la validation
   anglaise et que la traduction française n'a pas été validée ;
3. score et palier sans mention — à écarter.

Mon avis reste la **2**. Dès qu'elle est tranchée, les trois échelles se
codent : elles entrent dans Psyché, sous coffre, et c'est un chantier d'une
phase, pas de quatre.

### B.2 — Finances, phase 3 — **livrée**

Appariement, file « à rapprocher », rapprochement de solde avec recherche de
causes, écarts par ligne, catégorie et mois, et 1.5 (déduire des lignes de
budget du réel). Schéma **v26**, magasin `odysseeRapprochements` scellé.
231 essais, dont une chaîne complète en navigateur — quatre relevés importés,
une récurrence déduite, une ligne créée, la file qui propose.

Les décisions et les six fautes corrigées sont dans
[`finances/phase-3.md`](finances/phase-3.md). Ce qui reste de la maquette 4.3 :
les gestes « Autre ligne » et « Diviser », dont les moteurs existent et sont
éprouvés mais dont l'interface relève de l'écran du budget.

### B.2 bis — Finances, phase 4 — **livrée**

« Qui lit mon budget » (sept consommateurs, projections réellement bornées),
dossier surveillé de relevés, export ICS des échéances. Schéma **v27**.
190 essais. Décisions dans [`finances/phase-4.md`](finances/phase-4.md).

### B.2 ter — Finances, phase 3 bis — **plan à valider, rien de codé**

Le prompt complet de Finances, reçu le 13 octobre 2026, contient une
**section 2 bis** que le plan de phase 0 n'avait pas : le **pointage
automatisé par type de vendeur**, avec un dictionnaire d'enseignes livré avec
l'application, des règles locales créées à la détection d'un nom inconnu, et
des catégories pointées comparables au budget.

Le plan de phase 0 n'en contient aucune occurrence — il a été écrit depuis une
version antérieure du prompt. Le calendrier, lui, tient : les phases 1, 2, 3
et 4 livrées correspondent à celles du prompt. C'est la **phase 3 bis** qui
manque, entière.

Le plan, les maquettes et les sept décisions (10 à 16) sont dans
[`finances/plan-2bis-pointage.md`](finances/plan-2bis-pointage.md).
**Décisions 11, 12 et 15 validées le 13 octobre 2026.**

| Sous-phase | Contenu | État |
|---|---|---|
| **3 bis a** | Taxonomie (12 familles, 59 types + 3 états), normalisation, résolution, appariement approché, groupement des inconnus | **livrée**, 93 essais |
| **3 bis b** | Dictionnaire de 296 entrées, mesure du taux de reconnaissance | **livrée** |
| **3 bis c** | Politique de pointage, préréglages, anomalies, sondage, rétrogradation d'une règle | **livrée**, 69 essais |
| **3 bis d** | Magasins scellés (v28), règles locales, vendeurs inconnus, « Mes règles » | **livrée**, 61 essais |
| **3 bis e** | Catégories pointées, vue prévu / réalisé / écart, file unique filtrable | **livrée** |

Décisions et défauts dans [`finances/phase-3bis.md`](finances/phase-3bis.md).
Restent, et c'est dit : l'écran de fractionnement, le mode avancé de
création de règle, le compte rendu d'import de la maquette 8.1, et
l'affichage du sondage — tous quatre ont leur moteur écrit et éprouvé.

Mesure sur le jeu synthétique de 51 libellés : **100 % reconnus, 0 faux
positif** — avec la réserve, écrite dans le rapport de `npm run
mesurer:reconnaissance`, que le jeu et le dictionnaire sortent de la même
main et que ce chiffre ne dit rien de relevés réels.

Reste ensuite la **phase 5** (jeu synthétique de cinq ans, conflits entre deux
appareils, mesures d'ergonomie, guide court).

### B.3 — Audio : cent fiches sans voix

Mesuré à l'instant : **347 fiches, 247 fichiers audio chiffrés publiés**. Les
textes de podcast existent pour la totalité des fascicules 1 à 4 — c'est la
synthèse vocale qui n'a pas été passée sur une centaine d'entre eux. La
chaîne est locale et longue ; c'est une tâche à lancer délibérément, pas un
effet de bord d'une construction.

### B.4 — Publication des fascicules 3 et 4

Les tâches #62 et #90 restent ouvertes. Les fiches et les textes de podcast
sont là ; il reste le glossaire à compléter, la synthèse audio (B.3) et la
publication.

---

## C. Bloqué sur des sources extérieures

**Santé, traitements et musculation** — plan validé, et la forme se construit
sans rien attendre : modèle, écrans, enregistrement, programmes, volumes. Ce
qui est bloqué, ce sont les **valeurs** : demi-vies, interactions, limites de
sécurité, niveaux de preuve des méthodes. La liste de courses est dans
`sources-a-atteindre.md`, lots 2 et 3.

Décision possible : **construire la forme maintenant**, avec chaque valeur
affichée « inconnue » et un bandeau qui le dit. C'est le comportement voulu de
toute façon — une valeur inventée coûterait plus cher qu'une case vide — et
cela met le chantier en état de recevoir les sources le jour où elles
arrivent, plutôt que de tout commencer ce jour-là.

---

## D. Bloqué sur des documents que toi seul peux fournir

| Quoi | Combien | Où c'est listé |
|---|---|---|
| Trois annexes INSP | 3 thèmes sur 29 | `fichiers-bloquants.md` § 2 |
| Corrigés DGFiP 2026, inspecteur et contrôleur | 70 questions non recoupées | `fichiers-bloquants.md` § 3 |

---

## E. La dette méthodologique trouvée aujourd'hui

Elle mérite une ligne à part, parce qu'elle a coûté trois défauts.

**La suite d'essais n'avait pas été relancée depuis deux phases.** En la
passant entièrement, trois défauts dormants sont sortis : Sport proposait de
progresser sur un muscle douloureux toute la matinée ; deux magasins de
Finances n'avaient pas de politique de rétention ; un essai du calendrier ne
pouvait passer que l'après-midi. Aucun n'aurait été trouvé autrement, et tous
trois dataient de la version 22.

**La règle à tenir** : la suite complète — 85 scripts, une vingtaine de
minutes — après chaque changement de schéma, et pas seulement avant une
publication.

---

## F. Une question jamais tranchée

Le dépôt n'a pas de branche `main` stable : tout vit sur
`claude/new-session-vlew41`. Je ne l'ai pas touché en ton absence, mais la
question se posera le jour où une session repartira de zéro.
