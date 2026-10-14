# Lot C — la longueur des pages

Ce plan traite les cinq constats du lot C de `critique-interface-cyclades.md`
(13 octobre 2026). Il est écrit avant l'exécution, et tenu à jour après :
chaque ligne porte son état et, quand il y a lieu, la mesure constatée.

Règle appliquée partout : **une piste de la critique n'est pas une
autorisation d'en inventer une autre**. Ce qui dépasse la piste est posé en
ligne de décision, pas fait en silence.

---

## L2 — Glossaire · **fait** (commit « L2 — le glossaire »)

| Piste de la critique | État | Mesure |
|---|---|---|
| Index collant | fait | collé sous l'en-tête, hauteur mesurée au lieu d'être écrite en dur |
| Bouton « Haut de page » | fait | rend aussi le focus au champ de filtre |
| Rendu différé | fait | mise en page 124 ms → 40 ms à 390 px |
| Deux colonnes sur grand écran | fait | 53 339 px → 35 645 px à 1280 px |

Deux défauts trouvés **par la mesure** et corrigés : l'estimation de taille
des sections (fausse de 6 %, un saut vers « Z » atterrissait sur le « S »), et
le saut lui-même (22 px de reste, maintenant 0). Onze contrôles dans
`essais:glossaire:navigateur`.

---

## L1 — Actualités : 40 659 px pour 109 articles · **fait**

Constat : aucune pagination, aucune recherche, 710 éléments interactifs.

**Mesuré avant et après**, dans le même navigateur, sur les actualités réelles
du dépôt (39 semaines, 109 articles) :

| | avant | après |
|---|---|---|
| Hauteur à 1280 px | 40 455 px | 1 955 px |
| Hauteur à 390 px | — | 3 676 px |
| Sections affichées | 39 | 1 |
| Cartes affichées | 109 | 7 (la semaine ouverte) |
| Éléments interactifs | 643 | 51 |

Le chiffre d'avant retrouve celui de la critique (40 659 px, 109 articles) à
0,5 % près : la mesure porte bien sur la même page. Les 643 éléments
interactifs contre les 710 annoncés : l'écart vient de ce que je ne compte que
ceux de l'archive, pas ceux de l'en-tête et du pied de page.

Pour reproduire : `npm run build && npm run actualites:dist`, puis
`npx astro preview` et `npm run essais:actualites:navigateur` (dix-neuf
contrôles). Sans `actualites:dist`, l'essai s'arrête au lieu de mesurer la
seule semaine de démonstration.

| Piste de la critique | Décision | Pourquoi |
|---|---|---|
| Une semaine à la fois, « ‹ précédente / suivante › », sélecteur de date | **fait** | c'est le cœur du constat ; vaut pour les quatre périodicités, pas seulement les semaines |
| Replier les mois anciens dans des `<details>` | **remplacé** | la navigation période par période rend le repliement sans objet ; empiler les deux donnerait deux mécanismes pour le même besoin |
| Carte limitée à 2–3 lignes avec « Lire la suite » | **fait** | le reste de la carte (lien avec le programme, sources, bouton IA) passe derrière le dépliant, ce qui enlève l'essentiel des 710 éléments interactifs |
| Recherche | **fait** | la recherche traverse toutes les périodes de la vue courante, sinon elle ne chercherait que dans la semaine affichée, ce qui ne sert à rien |
| Mémoriser le filtre de domaine dans l'adresse | **fait** | et aussi la période, la vue et la recherche : une adresse se partage et se recharge |
| Rendu différé | **fait** | utile surtout sur les résultats de recherche, qui peuvent traverser quarante semaines |
| Marqueur « lu / non lu » | **fait (D-039, validé le 14 octobre)** | magasin `actualitesLues`, migration v31, bascule par carte, compte restant à lire dans le sélecteur de période (sa forme a changé avec D-043), filtre « Non lues seulement » |

---

## L3 — Sport > Exercices : formulaire avant la liste · **fait**

| Piste | Décision |
|---|---|
| Liste d'abord, avec recherche | **fait** — le champ de filtre existait déjà ; c'est l'ordre qui changeait |
| Création dans un panneau ou une boîte de dialogue | **fait** — `<dialog>` natif, `showModal()` : le piège du focus, Échap et l'inertie de la page sont ceux du navigateur, pas une réimplémentation qui oublierait un cas |
| Muscles par la silhouette, les 15 listes dans un bloc « Avancé » | **fait, avec une réserve** — le bloc est `open` dans le balisage, et le script ne le referme qu'en dessous de `lg`. La liste de cases est l'**alternative accessible** du schéma cliquable, pas un supplément : la replier par défaut partout l'aurait rendue plus difficile d'accès pour les seuls à qui elle est indispensable. |
| « Supprimer » dans un menu « … » avec annulation | **confirmation faite, annulation non** : conserver l'exercice supprimé demande de toucher au magasin → **D-040** |

**Mesuré avant et après**, 31 exercices en bibliothèque :

| | avant | après |
|---|---|---|
| Hauteur à 1280 px | 5 097 px | 3 214 px |
| Hauteur à 390 px | 7 397 px | 3 981 px |
| Éléments interactifs visibles | 75 | 33 |

Les chiffres d'avant retrouvent ceux de la critique (5 353 px et 7 454 px) à
5 % près — l'écart tient au nombre d'exercices, qui n'est pas forcément le
même que sur le site en ligne.

---

## L4 — Le bruit des états vides · **fait**

- **Programmes** : les 18 lignes de tirets remplacées par une phrase et une
  action, le tableau replié tant qu'il n'y a pas de donnée.
- **Force** : plus de présélection d'un exercice jamais pratiqué ; le dernier
  exercice pratiqué, ou une invite s'il n'y en a aucun.
- **Statistiques** : un message à la place d'un graphique vide, et la valeur
  réelle quand elle est trop petite pour être dessinée.

Constaté à l'exécution : le cas « zéro absolu » n'est presque jamais celui
qu'on rencontre. Sur un carnet neuf, l'essai mesure **5 s** de révision —
cinq secondes sur une échelle de dix heures, soit la barre de trois pixels
que la critique décrit. Le remplacement du graphique ne suffisait donc pas :
c'est le **chiffre écrit** qui répond au « sans valeur ni message », et les
deux branches sont contrôlées séparément.

---

## L5 — Planification : des jours passés marqués « non tenue » · **fait**

La cause était marquée **[D]** par la critique : à établir avant de
corriger. Elle est établie, et c'est la première des deux hypothèses :
`peindrePlanning` partait de `aujourd'hui − 7` sans regarder depuis quand le
carnet existe, et étiquetait « non tenue » sept jours antérieurs à son
ouverture. Il part maintenant au plus tôt de `creeLe`.

Un cas de bord, trouvé en écrivant le correctif : un profil enregistré avant
que ce champ n'existe prendrait « maintenant », et masquerait des jours
réellement passés. Quand le dernier jour étudié est antérieur à `creeLe`,
c'est donc lui qui fait foi. Et le chapeau, qui annonçait « les séances à
venir » en montrant sept jours passés, dit maintenant ce qu'il montre.

**Mesuré** : 21 jours affichés avant, 14 après, et zéro « non tenue ».

---

## Anomalie trouvée en chemin, et qui n'est pas dans la critique

L'essai `essais:sport:navigateur` cliquait `details >> nth=0` sur
`/sport/corps/`. Depuis que la barre de navigation du lot B groupe ses
onglets dans des `details`, la page en porte **trois avant son contenu** : le
sélecteur désignait un menu de l'en-tête, caché à cette largeur, et l'essai
expirait. C'est une conséquence de mon propre lot B, trouvée en relançant
les essais, et c'est le sélecteur qui était trop large — la page est intacte.
Corrigé en `#contenu-principal details >> nth=0`. Aucun autre essai
n'utilisait un sélecteur `details` non qualifié.

## La suite complète des essais de navigateur, relancée

Vingt-huit scripts, passés un par un. **Quatre rouges, aucun défaut du
site** : quatre essais qui mesuraient autre chose que ce qu'ils croyaient.
Trois viennent de mes propres changements, le quatrième d'une horloge.

| Essai | Ce qui n'allait pas | Corrigé en |
|---|---|---|
| `positionnement` | seul des vingt-neuf à ne pas porter de chemin de navigateur par défaut : sans `CHROMIUM` dans l'environnement, il s'arrêtait avant d'ouvrir une page. **Un essai qui ne démarre pas n'échoue pas : il disparaît.** | lui donnant le même défaut que les vingt-huit autres |
| `psyche` | « un onglet Psyché est proposé » : depuis le lot B les onglets sont groupés, le lien est dans un `details` replié, donc invisible — mais à un geste | contrôlant le geste : le groupe est visible, l'ouvrir montre le lien |
| `odyssee` (magasins) | égalité stricte sur la liste des magasins ; deux magasins ajoutés par le domaine Santé la faisaient tomber sur un essai dont le sujet est la migration depuis la v14 | un plancher, comme pour le numéro de version juste au-dessus — `essais:coffre` compte toujours les scellés exactement |
| `odyssee` (relevés) | les moments « passés » étaient semés à partir de `Date.now()`, dont la date de calendrier (14 oct.) diffère du **jour logique** affiché (13 oct.) entre minuit et 4 h. L'essai échouait donc quatre heures par nuit | ancrant les moments dans le jour logique |

Le dernier a demandé une sonde pour être établi plutôt que supposé : le
calendrier affichait bien « mardi 13 octobre » à 3 h 55, et les moments
datés du 14 n'y figuraient pas. Le site fait exactement ce qu'on lui
demande ; c'est l'essai qui regardait le mauvais jour.

`actualites` compte pour vert : il s'arrête tant que `npm run
actualites:dist` n'a pas été lancé, et c'est voulu.

## Lignes de décision nées de ce lot

| Réf. | Question | État |
|---|---|---|
| D-037 | Le tableau de bord, seul écran sans `h1` hors du verrou | **livré** le 14 octobre, en `sr-only` : le nom de l'écran est partout pour qui voit la page, il manquait à qui l'écoute, et la structure commençait à `h2`. L'exception nommée disparaît de `essais:structure` — 51 écrans, 51 titres distincts, zéro exception. |
| D-038 | La taille du texte sur tout le site | **option B appliquée** le 14 octobre, puis les tailles écrites hors de l'échelle traitées. Document dédié : `d-038-taille-du-texte.md`. |
| D-039 | Marqueur « lu / non lu » sur les actualités | **validé et livré** le 14 octobre. Magasin `actualitesLues`, non scellé — un marqueur de lecture qui ne marcherait que coffre ouvert serait absurde sur une liste d'actualités. La clef est « période:empreinte du titre » : IndexedDB n'est pas chiffré pour Révisions, et une liste de titres en clair sur le disque dirait ce qui est lu. |
| D-040 | Annulation après suppression d'un exercice | **écartée pour l'instant** le 14 octobre. La confirmation reste, le retour en arrière n'est pas fait. |
| D-041 | Les liens de phrase portaient « cible-tactile » | **corrigée** le 14 octobre. WCAG 2.5.8 exempte un lien posé au fil d'une phrase, et l'essai appliquait déjà l'exception : la classe n'obéissait à rien et fabriquait une boîte plus haute que la ligne. Retirée de huit liens, gardée sur les fils d'Ariane, les boutons et les liens isolés. Contrôle M4 de `essais:mobile`. |
| D-042 | Les étiquettes en unités de dessin, sous 14 px à l'écran | **corrigée sur les deux courbes**, le reste **remonté sans être touché**, le 14 octobre. Voir la section ci-dessous. |
| D-043 | Le menu de période des actualités, rogné sur téléphone | **corrigée** le 14 octobre. Mise en page et libellé, les deux étaient en cause. Contrôle N8 de `essais:actualites:navigateur`. |
| D-044 | Les étiquettes des visuels de correction, sous 14 px | **corrigée** le 14 octobre, après que la mesure a démenti ce que D-042 en disait. Voir la section réécrite ci-dessous. |

---

## D-042 — les deux courbes tracées à la main

La suite de D-038 a fait apparaître des tailles écrites à la main, hors de
l'échelle typographique. Treize sont du **texte HTML** : elles sont passées à
`text-xs`. Les autres sont des `<text>` dans un `viewBox`, et c'est une tout
autre affaire — dont cette section ne traite que les deux courbes tracées à
la main, le reste relevant de D-044.

**Dans un `viewBox`, une taille de police est une unité de dessin.** Ce que
l'œil reçoit vaut la valeur déclarée multipliée par le facteur d'échelle,
c'est-à-dire le rapport entre la boîte rendue et le `viewBox`. Écrire
« 14 » n'y donne pas 14 px. Mesuré au navigateur, en injectant la géométrie
réelle dans le conteneur réel :

| | 390 px | 1280 px |
|---|---:|---:|
| `sport/force` — courbe, 11 u | **7,8 px** | **10,8 px** |
| `odyssee/corps` — courbe, 11 u | **6,8 px** | **10,6 px** |

**Les deux courbes sont un défaut franc.** Hauteur figée contre un dessin
plus haut, largeur minimale plus étroite que le dessin : le facteur ne
montait jamais à 1, donc elles étaient **sous le plancher à toutes les
largeurs**, et aucune valeur de police n'y aurait rien changé. La largeur
minimale passe à celle du `viewBox`, la hauteur se libère, le facteur ne
descend plus sous 1. Le prix est assumé : un dessin large de 720 px se
parcourt sur un écran de 390, dans un conteneur qui défilait déjà.
`npm run essais:dessins` garde l'invariant.

**Ce que je disais des seize autres était faux.** J'avais écrit qu'elles
variaient de 9,4 à 23,1 px selon l'écran, et qu'il fallait donc revoir un
rapport plutôt qu'une taille. Les deux affirmations sont tombées à la mesure,
et la section D-044 ci-dessous les remplace.

## D-044 — les visuels de correction, et trois erreurs de ma part

### Ce que la mesure a démenti

J'avais calculé le facteur d'échelle de ces visuels en supposant que leur SVG
s'étirait à la largeur de sa colonne. Il ne s'étire pas : `Cadre.svelte` pose
`style="max-width: {largeur}px"` en ligne, le dessin ne grandit **jamais**
au-delà de son `viewBox` et ne fait que rétrécir sous un écran plus étroit.
Je ne l'avais pas vu en lisant le fichier.

Le facteur est donc plafonné à 1, mesuré à 1,00 sur sept visuels sur huit à
390 comme à 1280 px. Les étiquettes rendaient à leur valeur déclarée — 9, 10
et 11 px — et c'était une simple remontée, pas une reprise de géométrie.

Deux autres erreurs sont venues avec : un palier à **9 px** que je n'avais pas
compté, ce qui porte l'inventaire à **neuf fichiers** et non seize
étiquettes ; et un premier aperçu que j'ai mesuré **sans la feuille de style
du site**, qui donnait toutes les étiquettes à 16 px — un chiffre qui n'avait
aucun sens et qui a servi à le voir.

### Ce que la remontée a cassé, et pourquoi

Remonter les étiquettes à 14 a fait passer les chevauchements de **0 à 26**,
constatés sur les huit visuels les plus chargés de la banque réelle — 210
visuels dépouillés, le plus lourd de chaque type retenu, parce que c'est lui
qui révèle les collisions.

La cause est la même partout, et elle est instructive : ces visuels placent
leurs textes à la main, donc ils en **estiment la largeur**. Ces estimations
étaient des nombres nus calés sur dix unités — « largeur d'un caractère à 10
points : 5,1 », « hauteur de ligne : 11 », « écart au sommet : 12 ». Les
étiquettes ont changé, pas eux : le replieur croyait les libellés quarante
pour cent plus courts qu'ils ne sont, concluait qu'ils tenaient, et les
laissait se heurter. **Les algorithmes étaient justes ; la mesure qu'on leur
donnait ne l'était plus.**

Toutes ces constantes dérivent maintenant de `TAILLE_ETIQUETTE`, et une seule
valeur à changer suffira la prochaine fois.

### Les quatre réglages qui ne découlaient pas de là

| Visuel | Ce qui n'allait pas | Corrigé en |
|---|---|---|
| `VisuelVenn` | les libellés de zone, posés d'un bloc et centrés, se heurtaient dès qu'ils dépassaient la largeur du lobe : « Irlande, Chypre » entrait dans « 25 États » et sortait du cercle | les repliant sur la largeur du lobe, l'intersection recevant moins |
| `VisuelFigure` | « Parlement » s'affichait « Parlemen » : les noms de sommets sont en demi-gras, et leur largeur était estimée au rapport du texte courant, donc le recadrage les croyait à l'intérieur | un rapport propre au demi-gras |
| `VisuelFigure` | seul visuel large de 380, il était le seul réduit sur un téléphone — facteur 0,94, étiquettes à 13,2 px | 340, la largeur commune, la hauteur lui rendant la place |
| `VisuelFigure` | la cote du côté bas arrivait à seize unités du nom de sommet, soit moins qu'une ligne de texte | un écart une fois et demie plus grand pour les cotes |

### Constaté après correction

**58 étiquettes, toutes à 14 px, 0 chevauchement**, à 390 comme à 1280 px.

La mesure s'est faite sur un aperçu temporaire des huit visuels, monté avec
les données réelles de la banque et supprimé ensuite : ces visuels ne
s'affichent qu'au sein d'une correction de QCM, c'est-à-dire après une
mauvaise réponse à une question qui en porte un.

`npm run essais:dessins` — l'ancien `essais:courbes`, élargi — garde les deux
invariants : aucune taille écrite hors de l'échelle, et toute constante de
placement dérivée de `TAILLE_ETIQUETTE`. Éprouvé en rendant son nombre nu à
la frise : rouge, « LARGEUR_CARACTERE = 5.1 est un nombre nu ».

## D-043 — les deux causes, séparées

Un `<option>` ne se replie pas, ne s'abrège pas et n'avertit pas : ce qui
dépasse disparaît sans que rien ne le signale. Le menu faisait **69 px**
pour un libellé qui en demandait **414** — on lisait « 202 ».

1. **La mise en page.** Le menu était glissé entre « Précédente » et
   « Suivante », en `flex-1` : les deux boutons et le compteur prenaient
   266 px des 358 disponibles, il héritait du reste. Il passe en tête — on
   lit la période avant les flèches qui la font avancer, et la tabulation
   suit — et prend la ligne entière sous 640 px. Il gagne 358 px.
2. **Le libellé**, car 358 ne suffisaient toujours pas. Le qualificatif
   part, puisqu'il reste sous les yeux dans le titre de section juste en
   dessous ; et tant qu'il reste des actualités à lire, le compte à lire
   remplace le compte total, qu'il porte déjà.

Le défaut est **antérieur** au passage du texte à 16 px, qui n'a fait que
l'aggraver : vérifié en rétablissant l'ancienne échelle dans le navigateur,
96 px pour 363 demandés. C'est une ligne de mon propre lot C, pas une
régression de D-038.

Constaté après correction, sur les trente-neuf périodes réelles à 360 px —
la largeur que `docs/ajouter-une-branche.md` retient comme écran le plus
étroit : le plus long libellé fait **194 px pour 296 disponibles**.
