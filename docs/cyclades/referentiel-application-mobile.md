# Référentiel de l'application mobile

État au 17 octobre 2026. Ce document dit ce qui **est mesuré** et ce qui ne
l'est pas. Les chiffres qu'il porte viennent tous d'une mesure dans un
navigateur, jamais d'une lecture de code ni d'une estimation.

## 1. Les trois largeurs de référence

| Largeur | Appareil représenté | Ce qu'elle sert à prouver |
| --- | --- | --- |
| 360 px | le plus étroit encore courant | le pire cas d'encombrement |
| 390 px | iPhone récent, format standard | le cas nominal |
| 430 px | grand téléphone | que rien ne s'étire mal |

La batterie `essais:mobile:navigateur` les parcourt toutes les trois, dans un
contexte `hasTouch: true, isMobile: true`. **Cette prémisse n'est pas un
détail** : le plancher de 44 px n'est posé que sous `@media (pointer: coarse)`,
et un essai qui l'oublie mesure un écran de bureau étroit — il a déjà mesuré
une flèche à 18×18 en la croyant conforme.

## 2. Les cibles tactiles

Trois classes, et ce qui les sépare :

- `.cible-tactile` — 44 px de **haut**. Pour ce qui s'étire en largeur.
- `.cible-tactile-pleine` — 44 px de haut **et** de large. Pour ce qui ne
  porte qu'une icône : une icône fait trente pixels de large, et aucune hauteur
  ne rattrape une largeur de trente.
- `.cible-minimale` — 24 px, le plancher de WCAG 2.2 AA. Pour ce qu'on touche
  rarement dans un espace compté. Son usage se justifie au cas par cas.

Les trois portent `display: none` quand elles sont aussi `hidden`, **hors des
couches d'utilitaires**. Conséquence à retenir : un `sm:inline-flex` posé sur
le même élément ne gagnera pas. Pour montrer ou cacher par largeur, la classe
va sur un conteneur, pas sur la cible.

Mesuré : 2 642 cibles isolées à chacune des trois largeurs, zéro sous 44 px.

## 3. L'encombrement fixe

Mesures à 360 px, hors bandeau de coffre (coffre fermé) :

| Élément | Hauteur | Part d'un écran de 780 px |
| --- | --- | --- |
| Barre du bas | 57 px | 7 % |
| En-tête, Odyssée et Sport | 90 px | 12 % |
| En-tête, Révisions | 111 px | 14 % |

Coffre **ouvert**, le bandeau s'ajoute et enveloppe : 243 px pour Odyssée et
Sport, 264 px pour Révisions. Ce sont ces valeurs que le cliquet M10bis tient,
parce que la batterie mobile travaille coffre ouvert.

Deux choses que ces chiffres ont démenties :

- Le sélecteur de parcours ne partage **pas** sa rangée à 360 px : il coûte
  les 21 px qui séparent Révisions des deux autres. Une mesure antérieure,
  faite à une autre largeur, avait conclu l'inverse — et cette conclusion
  était fausse hors de sa largeur.
- La cible de 15 % pour l'en-tête n'est pas atteignable en réarrangeant. Elle
  demande d'**enlever** une cible de la rangée du haut. La seule piste
  arithmétiquement viable nommée à ce jour : remplacer, sur téléphone, les
  trois boutons de branche par un bouton unique ouvrant un menu. Coût : le
  changement de branche passe de une à deux touches. **C'est une décision
  d'Alexis, elle n'est pas prise.**

## 4. Ce qui a été essayé et abandonné

Fusionner les deux rangées de l'en-tête. Mesuré : six cibles de 44 px, les
écarts et les marges font déjà 330 px pour 360 disponibles. Forcé, le bord
droit tombait à 388 px et le document défilait de 28 px sur quarante-quatre
pages. Le commentaire de `src/layouts/Base.astro` le documente sur place, pour
que personne ne le rouvre sans mesurer — moi compris : j'ai failli le refaire
le jour même où j'avais ajouté une septième cible.

## 5. La flèche de retour

Une flèche sur chaque écran sauf le menu, qui n'a pas de parent.

**Où elle est.** Sous 640 px, dans l'en-tête complet, elle prend la place du
logo. Ce n'est pas un choix esthétique : la rangée du haut est saturée (§3), et
la seconde ligne fait 23 px — y loger une cible de 44 px aurait coûté +21 px
d'en-tête sur chaque page. Dans l'en-tête léger, qui ne porte que quatre
cibles, elle s'ajoute sans rien remplacer.

**Ce que l'échange coûte.** Le logo menait au menu. « Menu » entre donc dans la
feuille « Plus » : sur téléphone, le menu passe de une à deux touches. C'est le
prix, et il est dit plutôt que tu.

**Comment elle décide.** Deux retours existent dans une application : celui de
l'historique et celui de la hiérarchie. Ils divergent dès qu'on arrive par une
notification ou un signet.

- Le site pose `<meta name="referrer" content="no-referrer">`, une protection
  délibérée : sans elle, chaque lien sortant emporterait l'adresse de la page
  d'où il part, qui peut nommer une fiche ou une molécule. Un retour bâti sur
  `document.referrer` ne se serait donc **jamais** déclenché, tout en ayant
  l'air écrit. Ce piège a été rencontré et écarté, pas contourné en affaiblissant
  la protection.
- `history.length` ne convient pas davantage : il compte les entrées de tout
  l'onglet, y compris celles d'un autre site. Reculer là ferait sortir.
- La profondeur est donc inscrite dans `history.state`, le seul endroit attaché
  à l'**entrée** et non à l'onglet : elle revient telle quelle au retour, y
  compris depuis le cache de page, où aucun script ne se rejoue.

**Le saut hiérarchique remplace l'entrée, il n'en empile pas.** Empiler faisait
rebondir : depuis « QCM — DGFiP » ouvert seul, la flèche donnait
`/quiz/, /quiz/dgfip/, /quiz/, /quiz/dgfip/…`. Mesuré, puis corrigé.

**Sans JavaScript**, la flèche reste un lien vers le parent logique. Un retour
est la sortie de secours d'un écran : il doit marcher quand le reste ne marche
pas.

## 6. Les zones sûres des écrans à encoche

Quatre variables, posées une fois dans `global.css` :
`--sur-haut`, `--sur-bas`, `--sur-gauche`, `--sur-droite`, alimentées par
`env(safe-area-inset-*)`, avec `viewport-fit=cover` sur la fenêtre d'affichage.

Les classes qui les consomment : `.barre-sure` (barre du bas), `.entete-sur`
(en-tête collant), `.feuille-sure` (feuille « Plus »), `.contenu-sur`
(le contenu, pour qu'il ne finisse pas sous la barre).

Mesuré en simulant `--sur-haut: 47px; --sur-bas: 34px`.

## 7. Ce qui n'est pas mesuré

À tenir à jour honnêtement ; un référentiel qui ne liste que ses succès ne
sert à rien.

- **Le tri du plus long écran englobant**, dans `retour.ts` : aucun écran
  déclaré n'a aujourd'hui deux ancêtres déclarés imbriqués, donc l'inverser ne
  fait rougir aucun essai. Il existe en prévention. Un essai surveille cet
  angle mort et rougira le jour où un tel écran apparaîtra.
- **La première règle de taille de police** dans le bloc `pointer: coarse` :
  76 des 77 champs qu'elle semblait corriger étaient des boutons radio, qui ne
  déclenchent aucun zoom sur iOS. Elle reste en prévention, et le dit.
- **Le comportement sur un vrai appareil** : tout ici est mesuré dans Chromium
  avec un contexte tactile simulé. Safari sur iOS n'a pas été essayé.
