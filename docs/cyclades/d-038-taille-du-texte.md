# D-038 — la taille du texte sur tout le site

Le constat T5 de la critique d'interface dit que le texte courant est petit.
« Petit » n'est pas une mesure : ce document en porte une, puis trois options
dont le coût a été **construit et mesuré**, pas estimé.

**L'option B est appliquée depuis le 14 octobre 2026.** Ce document garde le
relevé d'avant, les trois options et leur coût, puis ce qui a été constaté
après. `npm run mesure:tailles` rejoue la mesure à tout moment.

---

## 1. Ce qui est, mesuré

Dix-huit écrans, comptés en **caractères réellement rendus** et non en
éléments : une page peut porter cinquante étiquettes de 11 px et trois
paragraphes de 14 px, et c'est pourtant le paragraphe qu'on lit. Le texte
masqué aux yeux (`sr-only`), l'écran de verrouillage et les icônes sont
écartés.

| Taille | Caractères | Part | Cumulé |
|---:|---:|---:|---:|
| 10 px | 60 | 0,1 % | 0,1 % |
| 11 px | 25 | 0,0 % | 0,1 % |
| **12 px** | **21 425** | **31,0 %** | 31,1 % |
| **14 px** | **39 607** | **57,3 %** | 88,4 % |
| 16 px | 6 491 | 9,4 % | 97,8 % |
| 18 px | 1 107 | 1,6 % | 99,4 % |
| 20 px et plus | 397 | 0,5 % | 100 % |

**88,4 % du texte lu est sous 16 px, et 31 % est à 12 px.** À 390 px, les
chiffres sont les mêmes à 0,2 point près : le site ne grossit pas son texte
sur téléphone.

Les cinq écrans les plus touchés : `/quiz/dgfip/` (98 % sous 16 px),
`/quiz/` (97 %), `/odyssee/finances/` (97 %), `/progression/` (96 %),
`/syntheses/` (95 %).

Pour situer : 16 px est la taille par défaut d'un navigateur, et la valeur
que les guides d'accessibilité prennent comme plancher confortable pour du
texte continu. 12 px est la taille d'une mention légale.

---

## 2. Les trois options, construites et mesurées

Chacune a été **appliquée, reconstruite et mesurée** sur six écrans à 390 px,
puis retirée. Les trois gardent `essais:mobile` vert : aucun débordement
latéral, aucune cible sous 24 px.

### A — remonter d'un cran les deux tailles les plus courantes

```css
@theme { --text-xs: 0.8125rem; --text-sm: 0.9375rem; }
```

12 → 13 px, 14 → 15 px. Les titres, les espacements et les marges ne bougent
pas : seules les deux tailles qui portent 88 % du texte gagnent un pixel.

### B — faire disparaître le 12 px

```css
@theme { --text-xs: 0.875rem; --text-sm: 1rem; --text-base: 1.0625rem; }
```

12 → 14 px, 14 → 16 px, 16 → 17 px. Plus aucun texte courant sous 14 px, et
les 57 % qui étaient à 14 px passent au plancher de 16. Les espacements ne
bougent toujours pas.

### C — remonter la racine

```css
html { font-size: 106.25%; }
```

Tout grossit de 6,25 % — le texte **et** les marges, les paddings, les
rayons, puisque tout est exprimé en `rem`. La page respire davantage, mais le
texte ne gagne que 6 % quand l'option B lui en donne 14.

### Le coût, en pixels de hauteur à 390 px

| Écran | Référence | A | B | C |
|---|---:|---:|---:|---:|
| `/revisions/` | 10 914 | 11 495 **+5,3 %** | 11 919 **+9,2 %** | 12 018 **+10,1 %** |
| `/progression/` | 4 838 | 5 055 **+4,5 %** | 5 410 **+11,8 %** | 5 264 **+8,8 %** |
| `/syntheses/` | 3 747 | 3 866 **+3,2 %** | 4 050 **+8,1 %** | 3 978 **+6,2 %** |
| `/glossaire/` * | 89 115 | 96 842 **+8,7 %** | 104 993 **+17,8 %** | 98 774 **+10,8 %** |
| `/quiz/dgfip/` | 2 547 | 2 618 **+2,8 %** | 2 710 **+6,4 %** | 2 725 **+7,0 %** |
| `/statistiques/` | 5 427 | 5 609 **+3,4 %** | 5 851 **+7,8 %** | 5 851 **+7,8 %** |
| **Moyenne** | | **+4,7 %** | **+10,2 %** | **+8,5 %** |

\* Le glossaire est en rendu différé : sa hauteur est une estimation calibrée,
exacte à moins d'un pour cent, mais estimation tout de même.

---

## 3. Ce que je recommanderais, et pourquoi

**B.** A coûte peu mais ne règle rien : 13 px reste une mention légale, et
31 % du texte y resterait. C paie le prix de B pour deux fois moins de texte
gagné, parce qu'il grossit aussi les marges.

B fait disparaître le 12 px du texte courant et amène la majorité du texte à
16 px, le plancher. Son coût réel n'est pas les dix pour cent de hauteur —
c'est que **les écrans les plus denses vont devoir être relus** : une liste
de quiz, un tableau de progression, une tuile de statistiques sont dessinés
pour la taille qu'ils ont aujourd'hui. Les contrôles disent qu'il n'y a ni
débordement ni cible trop petite, pas que la mise en page reste belle.

Si B est retenu, le bon ordre est : appliquer, reconstruire, relancer
`essais:mobile`, `essais:colonnes` et `essais:accessibilite`, puis **regarder
les cinq écrans les plus touchés** avant de garder.


---

## 4. Après — ce qui a été constaté

L'option B est en place dans `src/styles/global.css`, en trois variables et
rien d'autre. Relevé du même jour, même commande, mêmes dix-huit écrans :

| Taille | Avant | Après |
|---:|---:|---:|
| 10–11 px | 85 car. | 276 car. |
| **12 px** | **21 425 (31,0 %)** | **0** |
| 14 px | 39 607 (57,3 %) | 22 825 (27,3 %) |
| 16 px | 6 491 (9,4 %) | 58 841 (70,4 %) |
| 17 px et plus | 1 504 | 1 602 |

> **Sous 16 px : 88,4 % → 27,7 %. Sous 14 px : 31,1 % → 0,3 %.**

Le palier de 12 px a disparu du texte courant, et la majorité du texte est
au plancher de 16 px. Les cinq écrans les plus denses ne sont plus les mêmes :
`/sport/exercices/` (56 % sous 16 px), `/sport/`, `/quiz/dgfip/`,
`/bibliotheque/` et `/fiche/` — tous autour de la moitié, contre 95 à 98 %
pour les cinq premiers d'avant.

**Essais verts** : espaces, structure, mobile (aucun débordement latéral,
aucune cible sous 24 px), colonnes, accessibilité, navigation, quiz.

**Regardé à l'œil**, comme annoncé : captures des cinq écrans les plus denses
à 390 px et à 1280 px. Les mises en page tiennent — les cartes d'exercice,
les tuiles de barème du QCM et les listes de la bibliothèque respirent plutôt
mieux qu'avant.

## 5. Ce que la mesure d'après a fait apparaître

**Deux cent soixante-seize caractères restent à 10 et 11 px.** Ce sont des
tailles écrites à la main (`text-[10px]`, `text-[11px]`) sur des étiquettes et
des crédits d'image, qui ne passent pas par l'échelle et que l'option B n'a
donc pas touchées. Elles sont désormais **le seul texte du site sous 14 px**.
Les remonter à `text-xs` — maintenant 14 px — est une ligne de décision, pas
une suite automatique de D-038.

> **Suite donnée le 14 octobre** : les treize occurrences HTML sont passées
> à `text-xs`, les dix-neuf autres sont des unités de dessin et relèvent de
> D-042. Voir la section 6.

**L'essai des colonnes mesure quinze paires d'en-têtes au lieu de vingt-trois.**
Ce n'est pas la taille du texte : c'est le lot C. Le tableau des volumes de
Programmes et le tableau des points de Force sont désormais repliés tant
qu'il n'y a rien à montrer, et sur un profil vierge ils n'ont plus d'en-tête
à mesurer. Sur un profil qui porte des données, les vingt-trois paires
reviennent.


---

## 6. La suite — les tailles écrites hors de l'échelle

Trente-deux au total, comptées dans la source (`text-[10px]`,
`text-[11px]`). Elles se partagent en deux familles que seule la mesure
distingue, et que confondre aurait conduit à un geste faux.

**Treize sont du texte HTML** : barre de navigation du bas, crédits et
sources d'actualité, pastilles de la planification et de la bibliothèque,
étiquettes du graphique des statistiques, jours des quêtes, raccourci
clavier du Quad n-back, mention des annotations. Elles passent à `text-xs`.
Relevé du jour, même commande, mêmes dix-huit écrans, 1280 × 900 :

| Taille | Caractères | Part |
|---:|---:|---:|
| 14 px | 21 633 | 31,3 % |
| 16 px | 45 985 | 66,4 % |
| 17 px | 88 | 0,1 % |
| 18 px | 1 107 | 1,6 % |

> **Sous 16 px : 31,3 %. Sous 14 px : 0,0 %.**

Le site n'a plus aucun texte HTML sous 14 px.

**Dix-neuf sont des `<text>` dans un `viewBox`**, c'est-à-dire des unités de
dessin et non des tailles d'écran. Trois d'entre elles — les deux courbes
tracées à la main — étaient sous le plancher à toutes les largeurs et sont
corrigées ; les seize autres varient du simple au double selon l'écran et
demandent de revoir une géométrie, pas une valeur. Le détail, les mesures et
la raison de ne pas avoir touché aux seize sont dans `plan-lot-c.md`,
section D-042.

**Essais verts** : espaces, structure, courbes, actualités, mobile (dont M4),
accessibilité, colonnes, navigation, sport, odyssée.
