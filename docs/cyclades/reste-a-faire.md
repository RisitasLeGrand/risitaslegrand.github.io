# Ce qui reste à faire — relevé du 13 octobre 2026, au soir

Dressé sur l'état réel du dépôt, pas sur la liste de tâches : les comptes
ci-dessous sont **mesurés**, et les écarts avec ce que le relevé précédent
annonçait sont signalés, y compris quand ils me donnent tort.

---

## 0. Les quatre chiffres qu'il faut avoir en tête

| Quoi | Compté aujourd'hui | Ce que le relevé du matin disait |
|---|---|---|
| Fiches de cours | **425** | 347 |
| Fiches avec voix | **250**, soit **175 sans** | 247, soit « une centaine sans » |
| Questions de QCM | **6 759**, dont **0 sans explication** | 8 048, dont 2 706 sans explication |
| Questions avec correction détaillée | **294**, soit **6 465 sans** | 146 |
| Scripts d'essai | **100** | 85 |

Deux de ces écarts méritent qu'on s'y arrête.

**« 8 048 questions, 2 706 sans explication » était faux.** Le compte réel est
de 6 759 questions, et **aucune** n'est sans explication. Le chiffre venait du
rapport de l'agent INSP et n'a jamais été recoupé contre le dépôt. Ce qui
manque, ce sont les **corrections détaillées** — le bloc `correction:` avec
son verdict par option, son détail et son visuel —, et il en manque 6 465.
C'est un chantier tout aussi grand, mais ce n'est pas le même, et le confondre
aurait fait croire que des milliers de questions s'affichent sans un mot
d'explication alors qu'elles en portent toutes une.

**Le fascicule 5 est écrit.** 78 fiches sur les 79 chapitres inventoriés, de
taille comparable à celles du fascicule 4 (médiane 54 ko contre 46 ko). Le
relevé du matin en annonçait 16. L'agent INSP a travaillé pendant la journée.

---

## A. Ce qui attend un geste, et rien d'autre

### A.1 — Les 175 fiches sans voix ★

Les textes de podcast existent pour **les 425 fiches** : c'est la synthèse
vocale qui n'a pas été passée sur 175 d'entre elles, dont les 78 du fascicule
5. La chaîne est locale, gratuite et longue ; il faut la lancer délibérément,
avec un `npm run build` **sans** `REVINSP_SANS_PODCAST=1`.

C'est le plus gros écart entre ce qui est écrit et ce qui est utilisable.

### A.2 — Publication des fascicules 3, 4 et 5

Tâches #62 et #90, plus le fascicule 5 qui vient de s'écrire. Les fiches et
les textes de podcast sont là, le glossaire porte 531 termes ; restent la
synthèse audio (A.1), le complément de glossaire pour le fascicule 5, et la
publication.

### A.3 — Deux écrans de Finances 3 bis

Les deux derniers de la maquette, et les deux ont leur moteur écrit et
éprouvé :

- le **compte rendu d'import** « N pointées, M à pointer, K à revoir »
  (maquette 8.1) — aujourd'hui les trois nombres figurent dans la file, mais
  rien ne les annonce après un import ;
- l'**affichage du sondage** — `sondage()` tire déjà, de façon déterministe,
  les opérations à faire revérifier ; aucun écran ne les montre.

### A.4 — Deux gestes de la maquette 4.3 (Finances phase 3)

« Autre ligne » et « Diviser » — ce dernier au sens de la phase 3, répartir
une opération entre plusieurs **occurrences de budget**, à ne pas confondre
avec le fractionnement par **catégories** livré aujourd'hui. Les moteurs
`diviser()` et `controlerParts()` existent et sont éprouvés ; l'interface
relève de l'écran du budget.

### A.5 — `MATIERES_MIGREES` est vide

Le régime à deux vitesses des corrections est en place, mais aucun périmètre
n'y est déclaré migré. L'agent INSP demandait d'y ajouter `cas-pratique`.
Une ligne, et le contrôle passe de l'inventaire à l'exigence sur ce périmètre.

### A.6 — Un magasin déclaré que personne n'écrit

`odysseeVeilleBases` existe dans le schéma, dans la liste des magasins
scellés et dans la politique de rétention — et **aucun code ne l'écrit**. Les
lignes de base de la veille sont recalculées à chaque évaluation, ce qui est
le bon choix (2,9 ms à l'horizon réel). Il faut donc soit retirer le magasin,
soit écrire pourquoi il est réservé. En l'état, il ment sur ce que
l'application garde.

---

## B. Les chantiers ouverts

| Chantier | Où en est-ce | Qui |
|---|---|---|
| **Corrections détaillées** | 294 sur 6 759. Le lot pilote a prouvé le format ; le reste demande un plan chiffré avant d'être lancé. | agent INSP |
| **Finances, phase 5** | Jeu synthétique de cinq ans, conflits entre deux appareils, mesures d'ergonomie, guide court. Rien de commencé. | moi |
| **Veille — rejouer sur de vraies données** | Phase 4 close. Le rejeu n'a **rien à lire** : cette installation ne porte aucun historique de veille. Ce qui reste n'est pas du code, c'est d'avoir vécu assez de jours. | le temps |
| **Santé, traitements, musculation** | Plan validé, valeurs bloquées. Voir C. | moi, en partie |

---

## C. Bloqué sur des sources extérieures

**Santé, traitements et musculation** — la forme se construit sans rien
attendre : modèle, écrans, enregistrement, programmes, volumes. Ce qui est
bloqué, ce sont les **valeurs** : demi-vies, interactions, limites de
sécurité, niveaux de preuve des méthodes. La liste est dans
`sources-a-atteindre.md`, lots 2 et 3.

La décision que je recommande, inchangée : **construire la forme maintenant**,
chaque valeur affichée « inconnue », avec un bandeau qui le dit. C'est le
comportement voulu de toute façon — une valeur inventée coûterait plus cher
qu'une case vide — et cela met le chantier en état de recevoir les sources le
jour où elles arrivent, au lieu de tout commencer ce jour-là.

---

## D. Bloqué sur des documents que toi seul peux fournir

| Quoi | Combien | Où c'est listé |
|---|---|---|
| Trois annexes INSP | 3 thèmes sur 29 | `fichiers-bloquants.md` § 2 |
| Corrigés DGFiP 2026, inspecteur et contrôleur | 70 questions non recoupées | `fichiers-bloquants.md` § 3 |
| Quatre sources du fascicule 5 | dont `Corrigé Cas Pratique IA_V2.pdf` | rapport de l'agent INSP |

---

## E. La dette méthodologique, et ce qu'elle a encore coûté

**La règle, rappelée** : la suite complète — **100 scripts**, une vingtaine de
minutes — après chaque changement de schéma, et pas seulement avant une
publication. Elle avait sorti trois défauts dormants la dernière fois qu'on
l'a oubliée.

Un piège de mesure à retenir, trouvé aujourd'hui : `essais-relationnel` dépasse
les 300 secondes. Une boucle de vérification qui coupe à 300 s le rapporte en
échec alors qu'il passe. Un essai lent qu'on croit cassé finit par être
ignoré, ce qui revient à ne plus l'avoir.

---

## F. Une question jamais tranchée

Le dépôt n'a toujours pas de branche `main` stable : tout vit sur
`claude/new-session-vlew41`, qui porte maintenant l'intégralité du travail. Je
n'y touche pas sans ton accord, mais la question se posera le jour où une
session repartira de zéro — et elle se posera mal ce jour-là.
