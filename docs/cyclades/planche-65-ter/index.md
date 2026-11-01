# Planche de choix — l'animation d'entrée (prompt 65 ter)

Six bandes, engendrées par `npm run planche:logotype:ter`. Chacune montre une
proposition **à six instants** — 0, 20, 40, 60, 80 et 100 % — dans l'en-tête,
en thème Égée, clair et sombre.

Comme toujours, le script importe le dessin livré (`src/lib/logotype.ts`) et la
feuille des animations (`src/lib/logotype-animation.ts`) : la planche ne peut
pas montrer autre chose que ce qu'on brancherait.

## Les trois propositions

| | proposition | durée | ce qu'elle fait |
| --- | --- | --- | --- |
| **A** | **l'horizon** | 900 ms | le mot se découvre de gauche à droite, comme une côte qui sort de la brume |
| **B** | **la marée** | 826 ms | chaque lettre monte à sa place à son tour, de gauche à droite |
| **C** | **la levée** | 620 ms | le mot entier paraît en montant de quelques pixels — le plus sobre |

Les trois laissent le dessin livré **rigoureusement intact** : aucune ne
demande de modifier `logotype.ts` si elle est retenue.

## LE VOILE N'EST PAS ANIMÉ, ET C'EST UNE MESURE QUI L'A DÉCIDÉ

Le voile est l'image que le sélecteur d'applications garde en vignette ; sa
raison d'être est de ne rien livrer de l'écran qu'il cache. `src/lib/voile.ts`
documente déjà que le système prend sa vignette quand il veut, et que rien ne
garantit que `visibilitychange` soit traité **avant** la capture : le voile
réduit la fenêtre, il ne la ferme pas.

Mesuré, cinq tours : le voile est dans le DOM **synchroniquement** sur
l'événement, et à la **première trame peinte** — 4 à 13 ms plus tard — il est
déjà dans son état final : opacité 1, aucune transformation, **zéro animation
en cours**, pleine largeur. La fenêtre pendant laquelle la vignette pourrait
montrer un logo à moitié dessiné est donc aujourd'hui de **zéro trame**.

Une animation d'entrée la porterait à une centaine. Je ne peux pas mesurer
d'ici le moment où iOS prend sa capture, et je ne le prétends pas — mais
l'argument n'en a pas besoin : il est de **domination stricte**. Aujourd'hui,
si le voile gagne la course, la vignette montre le logo entier ; avec une
animation, la gagner ne suffirait plus.

Si une animation sur le voile est tout de même souhaitée, le bon moment est sa
**levée** — jamais capturée en vignette —, et le déclencheur existe déjà
(`focus`, `pageshow`, ou un clic).

## Ce qui est gardé

`npm run essais:logotype:animation` mesure les six règles sur les trois
propositions, **avant tout branchement** :

- une animation est bien posée, et elle **ne se répète jamais** ;
- sa durée totale tient sous le plafond d'une seconde et demie (900, 826 et
  620 ms) ;
- prémisse : l'état de départ **diffère** de l'état d'arrivée — sans quoi
  toutes les gardes seraient vides ;
- la **place ne bouge pas** pendant l'animation, relevée au début, au milieu
  et à la fin ;
- à la fin, le logo est **identique au logo statique** — boîte, opacité,
  transformation, découpe ;
- `prefers-reduced-motion` : **aucune animation**, et le logo final
  directement ;
- la feuille ne contient ni script, ni URL, ni couleur.

Quatre sabotages l'ont éprouvée : une animation mise en boucle, une durée
portée à 2,2 s, le bloc de mouvement réduit retiré, une couleur posée par une
image clé. Chacun rend la croix attendue.

## Deux défauts trouvés en mesurant, et pas en relisant

**`animation-fill-mode: both` laissait la dernière image appliquée pour
toujours.** « Horizon » gardait un `clip-path: inset(0 0 0 0)` et « levée » une
matrice identité : invisibles à l'œil, mais ce sont des propriétés qui créent
un bloc conteneur et un contexte d'empilement, de quoi rogner un jour un
contour de focus. Avec `backwards`, l'élément revient à son état naturel dès
l'animation finie — et c'est aussi ce qui rend `prefers-reduced-motion` trivial :
il n'y a littéralement rien à retirer.

**« Marée » passait cette garde à tort.** Elle anime les `<tspan>` et laisse la
`<svg>` intacte ; ma sonde regardait la `<svg>`, donc déclarait « identique au
statique » sans rien avoir mesuré. Elle était verte pendant que les deux autres
rougissaient, ce qui aurait dû m'alerter plus tôt.

**Et une première version de « marée » abîmait le lettrage.** Elle séparait le
mot en huit `<text>` placés au centre de cellules de largeur égale : la vague
traversait bien le mot, mais l'espacement final était faux — un « I » occupait
la même cellule qu'un « D », le « S » partait à la dérive. J'avais documenté ce
compromis comme acceptable ; **la planche a dit le contraire, et c'est elle qui
avait raison.** Les `<tspan>` à l'intérieur du `<text textLength>` l'annulent :
les lettres héritent de la composition du parent, donc la géométrie finale est
celle du logo statique au pixel près.

## Les six bandes

| fichier | proposition | mode |
| --- | --- | --- |
| `horizon-clair.png` | A · l'horizon | clair |
| `horizon-sombre.png` | A · l'horizon | sombre |
| `maree-clair.png` | B · la marée | clair |
| `maree-sombre.png` | B · la marée | sombre |
| `levee-clair.png` | C · la levée | clair |
| `levee-sombre.png` | C · la levée | sombre |

## Comment les images sont figées

Non pas en rejouant l'animation et en capturant au bon moment — ce serait une
course, et une course perdue donnerait une image fausse sans qu'on le sache.
Chaque ligne pose `animation-play-state: paused` et un **délai négatif** :
l'animation est arrêtée exactement à l'instant voulu, de façon déterministe.

Et la planche **refuse de rendre une bande qui ne bouge pas** : elle relève
l'état effectif des six lignes et exige qu'il varie. C'est ce contrôle qui a
attrapé, au premier tour, que ma sonde mesurait l'icône de menu — elle aussi
une `<svg>`, et placée avant le logotype dans la rangée — au lieu du logotype.
J'ai failli corriger l'animation pour un défaut de ma mesure.

## Ce qui reste à faire après le choix

Le branchement, à l'endroit centralisé de `logotype.ts`, avec :

- dans l'en-tête, l'animation jouée **une fois par session** et non à chaque
  navigation — l'en-tête persiste par `view-transition-name: entete-principal`,
  donc une animation posée à chaque page se rejouerait sur un élément qui n'a
  pas bougé ;
- les deux propositions non retenues **retirées du dépôt**, comme l'ont été
  celles du 65 bis.
