# D-038 — la taille du texte sur tout le site

Le constat T5 de la critique d'interface dit que le texte courant est petit.
« Petit » n'est pas une mesure : ce document en porte une, puis trois options
dont le coût a été **construit et mesuré**, pas estimé.

Rien n'est appliqué. `npm run mesure:tailles` rejoue le relevé,
`src/styles/global.css` est intact.

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
