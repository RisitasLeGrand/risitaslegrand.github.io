# Anomalies connues

Le tableau auquel la batterie renvoie : « à comparer au tableau des anomalies
avant toute poussée — un rouge qui n'y figure pas est un rouge NOUVEAU, et il
se corrige avant de pousser » (`scripts/batterie.mjs`). Il n'existait pas ; la
consigne pointait dans le vide.

On n'y inscrit **que ce qui a été mesuré**, avec la mesure. Une entrée dit ce
qu'on sait, ce qu'on ne sait pas, et ce qui la ferait disparaître. Une
anomalie qu'on ne sait pas reproduire reste une anomalie : elle n'est pas
résolue, elle est *décrite*.

Une entrée n'autorise personne à corriger à l'aveugle. Un risque noté ici sans
mesure est un risque à MESURER, jamais à réparer sur la foi de sa description.

---

## 1. `peindre()` du calendrier : onze appelants sur un état partagé

**Risque non mesuré.** Signalé le 1er novembre 2026.

`src/pages/odyssee/calendrier.astro` — `peindre()` est asynchrone, attend deux
fois (les événements, puis les occurrences) avant d'effacer la zone, et écrit
dans `occurrencesAffichees`, qui est au niveau du module. Onze endroits
l'appellent, dont plusieurs en « lance et oublie » (`void peindre()`). Rien ne
garantit que le dessin le plus RÉCENT soit celui qui peint en dernier.

**Ce qui a été mesuré, et ce qu'il dit.** En cherchant la cause de quatre
essais rouges, j'ai posé un compteur de rang pour faire abandonner un dessin
dépassé. L'instrumentation a RÉFUTÉ l'hypothèse : les deux dessins observés ne
se chevauchaient pas, et la cause était ailleurs (le jour logique — voir
`scripts/lib/jour-logique-essais.mjs`). La garde a donc été retirée.

**Ce qui n'est pas su.** Si la course est seulement improbable, ou impossible.
Aucune mesure ne l'a produite.

**Ce qui ferait disparaître cette entrée.** Soit une mesure qui PRODUIT la
course — deux dessins concurrents dont le plus ancien peint en dernier —, et
alors un compteur de rang se justifie et s'éprouve par sabotage ; soit une
lecture qui démontre que les onze chemins ne peuvent pas se chevaucher.

---

## 2. L'accueil décale sa mise en page de 0,0345 au chargement

**Défaut mesuré, non corrigé.** Relevé le 1er novembre 2026.

`scripts/essais-logotype-navigateur.mjs` relève, par `PerformanceObserver` sur
les entrées `layout-shift`, un décalage cumulé de **0,0345** au chargement de
l'accueil. Les sources nommées par le navigateur :

    UL.grid (0,0303), NAV.mt-10 (0,0303), SPAN.mt-4 (0,0042), LI (0,0042)

C'est la grille des branches, et non le logotype : celui-ci a exactement la
même géométrie d'une page à l'autre (x 318, y 27, 63,56 × 18 px), vérifié.

**Pourquoi ce n'est pas gardé.** Faire porter ce total au lot du logotype
aurait rendu sa garde rouge en permanence, jusqu'à ce que quelqu'un la
désarme. La garde mesure donc les décalages dont la SOURCE est le logotype, et
imprime le total de la page à côté, pour qu'il ne se perde pas.

**Ce qui ferait disparaître cette entrée.** Une réserve de place sur la grille
des branches, et un relevé repassé sous 0,01.

---

## 3. Un module dynamique échoue une fois sur un balayage de 62 routes

**Non reproduit.** Vu deux fois, le 31 octobre et le 1er novembre 2026.

`essais:cibles-souris:navigateur` a rendu « Failed to fetch dynamically
imported module », sur deux modules DIFFÉRENTS. Les deux fois le fichier
existait dans `dist/` et l'aperçu le servait en 200, vérifié à la main ; les
deux fois l'essai était vert à la relance. Quatre lancements de plus le
1er novembre : pas reparu.

**Ce qui a été fait.** Pas de correctif — on ne répare pas ce qu'on ne sait pas
reproduire. L'essai se diagnostique désormais lui-même : à la prochaine
occurrence il redemande le module et note `200` (« le fichier était là, le
transport a lâché ») ou `404` (« fichier absent de la bâtisse »). Sans cela,
chaque enquête repart de zéro, ce qui s'est produit deux fois.

**Ce qui ferait disparaître cette entrée.** Deux occurrences de plus portant le
même code à la relecture, qui trancheraient entre le transport et la bâtisse.

---

## Ce qui N'A PAS sa place ici

- **Un rouge qu'on sait reproduire et corriger.** Il se corrige.
- **Un rouge dont on ignore tout.** Il se mesure d'abord ; une entrée sans
  mesure ne fait qu'habituer à la voir.
- **Un essai qu'on a rendu vert en affaiblissant sa mesure.** Celui-là n'est
  pas une anomalie connue, c'est une anomalie cachée.
