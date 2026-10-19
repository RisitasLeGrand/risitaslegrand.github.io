# Compte rendu — 46 (P3, P5) et 55

Branche `claude/p46-55`. Trois commits, un par étape : le lecteur, les séances
par partie, les fiches audio.

Aucun titre de partie de `content/` ne figure ici : c'est du contenu de fiche
(interdit 2 du 46). Les exemples cités viennent de `content-exemple/`, qui est
dans le dépôt.

---

## 46 P3 — le lecteur

Fait : liste des parties sous le lecteur avec leur heure de début, appui pour
sauter, partie en cours mise en évidence par `aria-current` et non par la
seule couleur ; bouton « 🎧 Écouter à partir d'ici » sur les titres qui sont
des parties **atteignables** ; Media Session avec lecture, pause, ±15 s,
partie précédente et suivante ; progression « reste 6 min » et liste « Écoutes
en cours » à l'accueil de Révisions ; reprise écrite aussi sur `pause`,
`visibilitychange` et `pagehide`, reculée de trois secondes.

La position déménage de `localStorage` vers le magasin `podcastPositions`
(base en version **34**), donc dans la synchronisation et la sauvegarde.
L'ancienne clé est lue **une fois, en entier** — toutes les fiches, pas
seulement celle qu'on ouvre — puis retirée ; une position déjà présente n'est
pas écrasée, car elle peut venir d'un autre appareil et être plus récente.

Trois points qui ne se devinent pas :

- **L'écran verrouillé ne porte qu'un seul champ**, « Cyclades — fiche
  audio », le même pour toutes les fiches. Ni `artist`, ni `album`, ni
  illustration : chacun afficherait la matière révisée sur un téléphone posé
  sur une table.
- **L'écriture au fil de l'eau ne voyage pas.** Seuls les trois moments
  d'arrêt journalisent. Une opération de synchronisation toutes les cinq
  secondes ferait des centaines d'opérations indédoublonnables par fiche —
  c'est la faute que `partieJournalisable` évite déjà sur l'état d'une fiche,
  à un rythme dix fois pire.
- **Socle partagé, et pas de `combiner` : la dernière écriture gagne.** On
  pourrait croire qu'il faut garder la position la plus avancée. Ce serait un
  contresens : écouter jusqu'à la trentième minute chez soi puis revenir à la
  dixième dans le train, c'est vouloir reprendre à la dixième. Une position
  est un signet, pas un record.

Sur le coffre, P3 dit « sous coffre **si** les fiches écoutées y sont
rangées ». Vérifié : le coffre couvre des branches (Psyché, Santé, Finances),
pas le contenu de Révisions — `parcours/registre.ts` ne déclare aucun parcours
sensible. La condition est donc **sans objet aujourd'hui**, et les positions
vont dans le magasin ordinaire. `essais:coffre-ferme` reste vert.

**Défaut trouvé en chemin, et corrigé.** Le `textContent` d'un titre était
relu **après** qu'on y ait posé des boutons : le contexte envoyé à une IA
portait « Le contrôle de constitutionnalité Préparer une question pour une
IA ». Mon bouton d'écoute aurait aggravé la chose. Le titre propre est
désormais relevé avant tout ajout.

---

## 46 P5 — les séances par partie

**Le seuil, que le prompt demande d'annoncer : 5 cartes et 3 questions.** En
dessous, on complète depuis le reste de la fiche, et l'écran le **dit**. Cinq
est le plus petit nombre qui fasse encore une révision plutôt qu'un sondage ;
trois questions suffisent parce qu'une proportion sur trois se lit encore, et
qu'une question couvre plus de matière qu'une carte. Taire le complément
laisserait croire à un ciblage qui n'a pas eu lieu.

Le filtre s'applique **là où la fiche est déjà ouverte et avant le plafond de
session**. L'ordre compte : filtrer après coup rendrait une session plus
courte que demandée et, surtout, ne pourrait pas aller chercher le complément
du seuil, qui est précisément dans les cartes que le plafond venait d'écarter.
Le plafond est donc levé pendant la collecte quand des parties sont demandées,
sans rouvrir la porte au défaut qu'il gardait : une sélection de parties vient
d'une séance, donc d'une poignée de fiches nommées, et c'est `ficheIds` qui
borne alors le travail. Le seuil se juge **fiche par fiche** : deux parties
maigres de deux fiches différentes ne se complètent pas l'une l'autre.

`Seance.parties` est facultatif, et son absence veut dire « la fiche
entière ». C'est ce qui fait tenir la compatibilité : une séance d'avant ce
prompt n'a pas le champ et vaut pour la fiche entière — ce qui est la vérité,
puisque les séances par partie n'existaient pas. Lire son absence comme
« aucune partie vue » aurait effacé d'un coup des centaines de séances
d'historique ; l'essai le vérifie nommément.

L'interdit 3 est tenu **par construction** : la restriction rend les cartes
elles-mêmes, par identité d'objet, jamais des copies — une copie serait la
première marche vers un second état FSRS. L'essai l'éprouve ainsi.

Le manifeste porte `nbParties`, un **nombre** et non des titres : la séance a
besoin de savoir s'il y a un choix à proposer sans ouvrir la fiche, et
l'interdit 2 fait des titres du contenu de fiche. Ils ne se chargent qu'à
l'ouverture du volet, deux fiches à la fois.

Le découpage automatique d'une longue fiche est un réglage **désactivé par
défaut** : éteint, la fonction ne fait rien. Allumé, il **coche des cases** au
lieu de filtrer une liste — un filtre ne se discute pas, des cases se
décochent. La durée d'une partie préfère le repère audio, qui est une mesure,
au débit moyen, qui se trompe précisément là où les parties sont inégales.

**Trois fautes de la section G corrigées** dans les fichiers touchés :
« fiche(s) » dans le rappel d'une séance passée, « mot(s) · signe(s) ·
page(s) » sous la note de séance, et le `toFixed` qui formatait ces pages.
`essais:typographie` ne les voyait pas : ces chaînes sont construites en
JavaScript, pas écrites dans le HTML qu'il relit.

---

## 55 — les douze propositions de l'audit

| | Verdict avant | Ce qui a été fait |
|---|---|---|
| **N°1** glossaire | **à faire — défaut mesuré** | Corrigé en entier. Le podcast n'expliquait **aucun terme accentué** : l'index est bâti sur des formes désaccentuées et était cherché dans le texte accentué, si bien qu'il ne correspondait jamais. Constaté sur `content-exemple/` : « gouvernance » et « soft power » glosés, « hiérarchie des normes », « multilatéralisme » et « règlement sanitaire international » jamais. Le site n'avait pas le défaut — son plugin passe par `normaliserPositions`. Second volet corrigé aussi : une forme en majuscules ne correspond plus qu'à une occurrence en majuscules. |
| **N°2** repères | à faire | Corrigé en entier : plan annoncé à l'ouverture, rang dit sous la forme de la décision 2 (« Deuxième partie, sur trois : … »), `silencePartieMs: 1400`. |
| **N°3** mémorisation | à faire | Corrigé en entier : récapitulatif depuis le titre et les exergues, question de rappel depuis une carte rattachée, 4 s de silence, pas de carte → pas de question, question de plus de 30 mots omise. |
| **N°4** sonie | à faire | Corrigé, **et au-delà** : voir « ce que la mesure a appris » ci-dessous. |
| **N°5** tableaux et listes | en partie fait | Complété : nombre d'éléments annoncé au-delà de quatre, renvois « ci-dessus / ci-dessous / ci-contre » réécrits sans avaler leur article. Les colonnes nommées une fois, le regroupement par blocs et les liaisons variées existaient déjà. |
| **N°6** relances | **à faire — cause trouvée** | Corrigé. `/\b(par\|à\|avec\|dans)$/` : sans le drapeau `u`, `\b` est une limite ASCII et « à » n'en est pas un caractère, donc le motif ne correspondait **jamais** et produisait « Venons-en maintenant à : une crise… ». Contractions « du / au » ajoutées aux relances, et l'élision de « de » devant une voyelle, qui manquait. |
| **N°7** prononciation | à faire | Corrigé en entier : « L. 169 » → « L 169 », « N+3 » → « N plus 3 », « Partie 2 » → « Partie deux » (et seulement après un mot qui désigne un morceau de cours : « article 55 » et « 1958 » sont épargnés). Table des sigles explicite et close aux sept du prompt. |
| **N°8** gloses | **à faire — appliqué en partie, exprès** | Voir « les deux choses que je n'ai pas faites comme demandé ». |
| **N°9** générique | à faire | Corrigé en entier : cinq accueils de quinze mots au plus, trois clôtures, et « première écoute sans rien noter » remplacé par « Laissez-vous porter, on reviendra à l'essentiel à la fin » — qui vaut à chaque écoute, et qui annonce le récapitulatif que N°3 ajoute. |
| **N°10** parenthèses | **à faire — pire que l'audit ne le disait** | Corrigé. `aerer` transformait les points-virgules en points **sans regarder les parenthèses** : une fiche s'entendait « …pour la Cour de cassation. Nicolo, 1989… », une chute de voix en plein milieu d'une incise. |
| **N°11** énumérations | à faire | Corrigé : coupure après les deux-points quand les deux côtés valent une phrase. |
| **N°12** contenu omis | à faire | Corrigé. `texteDe` rend la chaîne vide pour une image : un schéma était **muet, sans un mot**. Une phrase, la première fois seulement. |
| **N°13** lecteur sans écran | à faire | Fondu dans P3, sans doublon : un seul lecteur, celui de `src/lib/podcast.ts`. |

Aucune proposition contestée sur le fond.

### Les deux choses que je n'ai pas faites comme demandé

**1. Le silence de N°3 n'est pas un marqueur dans le texte.** Le prompt en
propose un, « par exemple `[[silence 4000]]` ». Or le garde-fou anti-fuite du
43 refuse déjà les crochets doubles — et il a raison, puisque tout ce qui
reste dans le texte sera **prononcé**. Le poser dans le texte dit aurait
obligé à percer une exception dans la seule table qui garde l'audio des fuites
techniques, ce que la règle 5 du chantier interdit. Le silence est donc
déclaré dans l'en-tête du script, par rang de paragraphe, exactement comme les
repères de partie du 46 : il **ne peut pas** être prononcé, puisqu'il n'est
jamais un mot. La table reste intacte, et l'essai anti-fuite la vérifie sans
aménagement. Le « par exemple » du prompt m'a semblé autoriser ce choix.

**2. N°8 n'est appliqué qu'à moitié.** « La gouvernance, c'est l'ensemble… »
demande l'article du premier nom de la définition, donc son **genre**, que le
glossaire ne déclare pas. Une table explicite et close de trente noms
définitionnels le donne — le genre d'un nom français est un fait vérifiable,
pas du contenu. Hors de cette table, la glose garde l'apposition par virgule,
qui est juste elle aussi : l'interdit 1 dit que si une information manque, la
phrase est omise, pas complétée. Deviner aurait produit « c'est la principe »,
dit à voix haute — et une faute dite est pire que la raideur qu'on voulait
corriger.

### Ce que la mesure a appris sur la sonie

`loudnorm` **en une seule passe n'atteint pas sa cible** : mesuré à −14,1 LUFS
pour −16 demandés, soit presque deux fois l'écart que le prompt tolère. Il
normalise au fil de l'eau, sans connaître la sonie du fichier quand il
commence à le corriger. L'encodage se fait donc **en deux passes** — la
première mesure, la seconde applique un gain calculé —, et tombe alors au
dixième de décibel près sur un signal maîtrisé. Cela compte, puisque tu ne
régénères qu'une fois.

Sur les trois fiches d'exemple réellement synthétisées, la sonie mesurée par
ffmpeg vaut **−16,82, −16,99 et −16,85 LUFS** : dans le ±1 demandé. À noter
tout de même, parce que cela pourrait différer chez toi avec Kokoro : la voix
sort avec des crêtes proches de zéro, et le plafond de crête à −1,5 dBTP
limite donc le gain que `loudnorm` peut appliquer. Dans une version
intermédiaire, la plus courte des trois fiches mesurait −17,15, soit 0,15 dB
hors tolérance. Les paramètres du filtre sont ceux que le prompt fixe ; si tu
veux la cible dead-on, le levier est le plafond de crête, et c'est ton choix.

### Le temps de régénération, réestimé

Mesuré sur cette machine, avec **Piper**, sur les trois fiches de
`content-exemple/` :

| | Valeur mesurée |
|---|---|
| Parole produite | 654 s, soit 10,9 min pour 3 fiches |
| Temps de synthèse | 47 s |
| Rapport | **0,072 s de calcul par seconde de parole**, soit ≈ 14× le temps réel |
| Kokoro, d'après le facteur 5 documenté dans le dépôt | ≈ 0,36 s/s, soit ≈ 2,8× le temps réel |

**L'allongement dû au 55**, mesuré sur les mêmes fiches, en mots du script :
+28 % et +18 %. Les récapitulatifs, le plan et les annonces de rang en sont la
cause ; les questions de rappel y ajoutent peu ici, parce qu'une seule des
trois fiches d'exemple porte des cartes rattachées à une partie. **Sur du
contenu réel, où les cartes sont rattachées, attends-toi à davantage** :
compte un ordre de grandeur de +25 à +35 %.

Pour convertir en heures, multiplie la durée totale de parole de ton contenu
par le rapport ci-dessus, puis ajoute l'allongement. Je ne donne pas de total
en heures : il faudrait lire `content/`, que je n'ai ni lu ni régénéré.

Deux réserves honnêtes sur ces chiffres : ils viennent d'un conteneur dont je
ne connais pas les cœurs, et le facteur 5 entre Kokoro et Piper est **lu dans
la documentation du dépôt**, pas mesuré par moi — le modèle Kokoro pèse 325 Mo
et n'était pas installable utilement ici.

---

## Ce qui reste à faire, et qui n'est pas à moi

- **La régénération complète de l'audio** : c'est ton geste, et le tien seul.
  Les trois fiches d'essai t'ont été envoyées dans la conversation ; elles ne
  peuvent pas être commitées.
- **Le rattachement des cartes et des QCM aux parties** (46, P4, travail de
  contenu) : confié à l'agent `fiches-insp`. Sans lui, les questions de rappel
  de N°3 n'ont pas de matière, et le ciblage des séances par partie retombe
  sur le complément de la fiche.
- **Un rouge qui n'est pas un rouge, et qu'il faut savoir lire.**
  `npm run essais:scripts-parles` a deux parties : la règle, puis le corpus
  réel. La seconde refuse de certifier un corpus qui n'est pas celui du dépôt
  — elle exige « plusieurs centaines » de scripts. Conséquence : sur une
  machine dont `content/` vient de `content-exemple/` (trois fiches), elle
  rougit, alors que « aucune fuite technique » est vert juste au-dessus. Sans
  `content/`, l'essai passe et le dit en jaune ; avec le contenu réel, il
  passe. Ce n'est donc **pas** un rouge de cette branche : c'est un corpus de
  laboratoire. Je ne l'ai pas touché — l'assouplir reviendrait à baisser son
  exigence, et c'est précisément ce que la règle 5 interdit.

- **Un essai de navigateur pour les séances par partie.** Les règles sont
  éprouvées (`essais:seances-parties`, 35 verts) et le lecteur l'est à l'écran
  (`essais:lecteur-parties`, 33 verts), mais le volet des parties en séance
  n'a pas encore son essai de navigateur. C'est le trou que je signale plutôt
  que de le laisser deviner.
