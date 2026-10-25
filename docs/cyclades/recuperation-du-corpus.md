# Récupérer le corpus

`content/` — 427 fiches, 250 fiches audio, le glossaire, la banque de QCM — n'a
jamais été versionné : le dépôt est public, et le contenu est le seul bien du
projet. Le dossier a été perdu. Il n'en reste **qu'un exemplaire au monde** :
le site publié, chiffré, dans l'historique de `gh-pages`.

Ce document dit ce que l'outil de récupération rend, ce qu'il ne rend pas, et
le geste exact à faire.

## Le geste

Sur la machine qui construit, dans une copie du dépôt :

```
npm run recuperer:corpus -- --git cec51b3 --vers ../corpus-recupere
```

L'outil annonce ce qu'il a trouvé, **puis** demande le mot de passe du site.
La saisie ne s'affiche pas. Le mot de passe n'est ni un argument, ni un
fichier, ni une ligne de journal : il n'existe que le temps de dériver la clé.

Il ne touche à rien : la source est lue par `git show <ref>:data/…`, sans
changer de branche ni écrire dans l'arbre de travail. La sortie doit être hors
du dépôt, et l'outil refuse de l'écrire dedans — un corpus en clair dans
`content/` serait à un `git add .` de devenir public.

Le résultat :

| | |
| --- | --- |
| `<sortie>/content/` | le corpus au format source, à remettre en place |
| `<sortie>/annexes/` | la banque de QCM et l'index, au format publié (JSON) |
| `<sortie>/a-relire/` | le HTML publié des sections à comparer à la main |
| `<sortie>/RAPPORT.md` | ce qui est revenu, transformé, ou perdu, fiche par fiche |

**Mettez `<sortie>` à l'abri ailleurs avant toute autre chose.** C'est le
deuxième exemplaire au monde, et le premier en clair.

## Ce qui a été mesuré, et comment

### Sur le corpus réel, de bout en bout

La récupération a été exécutée sur `cec51b3`, puis le corpus récupéré a été
**reconstruit** et les deux publications comparées champ par champ. Ce ne sont
donc pas des estimations.

| | |
| --- | --- |
| Fiches récupérées | **427 sur 427** |
| Fiches audio | **250 sur 250**, octet pour octet |
| Flashcards | 12 554 |
| Questions de quiz | 6 235 |
| Questions de prétest | 3 446 |
| Termes de glossaire | 560 |
| Chemins certifiés par leur empreinte | **376 sur 427** |
| Le corpus récupéré se reconstruit | **oui**, sans erreur |

Sur les 376 fiches qui gardent leur identifiant, la comparaison des deux
publications déchiffrées donne : `titre`, `matiere`, `fascicule`, `tags`,
`sommaire`, `parties`, `flashcards`, `quiz`, `pretest`, `podcast`
**identiques, tous**. Le `quiz` inclut ses corrections imbriquées — `par_option`,
`sources`, `visuel`, les renvois.

Le texte rendu, hors soulignement du glossaire : **743 sections identiques sur
752** (8 cours et 1 fiche simplifiée divergent, et elles sont nommées dans le
rapport). 691 sections ne diffèrent que par le soulignement du glossaire,
conséquence des `formes:` que la publication ne porte pas.

### En laboratoire, à chaque exécution

`npm run essais:recuperation-corpus` — 45 vérifications, toutes vertes, avec un
mot de passe jetable sur `content-exemple`. Il construit, récupère, reconstruit
depuis le récupéré, et compare les deux publications. Sept de ces
vérifications passent **avant** la garde du laboratoire et ne peuvent donc
jamais être sautées : ce sont celles qui tiennent les deux défauts les plus
graves de l'outil (voir « Quatre défauts » plus bas).

### Sur la publication, sans aucun mot de passe

427 fiches, 250 audios (412 Mo), 427 enveloppes `{iv,ct}` sur 427, les 427 noms
de fichier conformes à un identifiant de seize caractères hexadécimaux,
en-tête PBKDF2-SHA256 à 600 000 itérations.

## Ce qui revient, et ce qui ne revient pas

### Identique, et démontré

Le front-matter en entier (`matiere`, `fascicule`, `titre`, `tags` depuis la
charge de la fiche ; `ordre` depuis le manifeste). Les flashcards, le quiz et
le prétest, au champ près : la publication les porte sous forme structurée, pas
rendue. Les fiches audio, **octet pour octet** — le fichier publié est le
fichier source chiffré.

Pour le cours et la fiche simplifiée, la fidélité est *vérifiée*, pas espérée :
le Markdown écrit est re-rendu avec le convertisseur du build, et comparé au
HTML publié. Une section qui ne coïncide pas est **nommée** dans le rapport et
son HTML publié est gardé dans `a-relire/`. Aucune fiche n'est dégradée en
silence.

### Transformé

Le site publie le HTML rendu, pas la source : la mise en page du fichier ne
revient pas (largeur des lignes, lignes vides, `*` ou `_` pour l'emphase).
Les flashcards reviennent en `question:`/`reponse:` même si la source écrivait
`q:`/`r:`. Les réponses de quiz reviennent par leur rang, la publication ne
portant pas le texte d'origine du champ `reponse:`.

### Perdu

**Le chemin de chaque fiche — et c'est la perte qui coûte.**
`ficheId = idStable(cheminRelatif)` : l'identifiant d'une fiche est l'empreinte
SHA-256 de son chemin, et le chemin n'est pas publié. Toute la progression
enregistrée dans le navigateur est rangée par identifiant de fiche. Une fiche
replacée à son vrai chemin garde son identifiant au prochain build ; replacée
ailleurs, elle en reçoit un neuf, et tout ce qui la concernait devient
orphelin, sans un message.

Une empreinte ne se renverse pas, mais elle se **vérifie**. Le dossier est
dérivable (`matiere`, `fascicule`). Le nom de fichier ne l'est pas : c'est une
abréviation choisie à la main — « La hiérarchie des normes et le contrôle de
constitutionnalité » s'est écrit `fiche-01-hierarchie-des-normes.md`. Aucune
règle ne produit ce nom, mais il est un **préfixe de mots** du titre
débarrassé de ses articles, et un préfixe, ça s'énumère. L'outil propose donc
large et ne retient que ce dont le SHA-256 tombe exactement juste : une
proposition fausse est rejetée, jamais acceptée par ressemblance.

**Mesuré : 376 chemins sur 427 sont certifiés**, en trois temps — la liste
fournie s'il y en a une, puis les formes dérivables, puis l'énumération
exhaustive des sous-suites ordonnées du titre. Ce dernier temps a été ajouté
après mesure : les 284 chemins que les formes dérivables trouvaient ont servi
d'échantillon d'apprentissage, et ils ont montré que 157 noms sont le titre
entier, 30 un préfixe exact, et 97 une sous-suite ordonnée — des mots retirés
au milieu, pas seulement à la fin. Énumérer les sous-suites a porté le compte
de 284 à 376.

**Les 51 restantes résistent à toute dérivation**, et c'est établi, pas
supposé : leur nom n'est pas une sous-suite du titre, le numéro du fichier
n'est pas en cause (éprouvé de 1 à 99), le dossier de fascicule n'est pas une
abréviation de son propre titre, et elles ne se regroupent ni par parcours ni
par matière. Ce sont des noms choisis à la main, hors de toute règle.

Pour celles-là, deux conséquences concrètes : leur progression enregistrée
devient orpheline, **et leur fiche audio aussi** — la reconstruction n'a
retrouvé que 217 audios sur 250, les 33 manquants étant ceux de ces fiches,
dont le nouvel identifiant ne désigne plus leur fichier.

Toute liste d'anciens chemins les sauve sans risque : une sauvegarde, une
capture de l'arborescence, un vieux `ls -R`. Elle se dépose dans un fichier, un
chemin par ligne, et se repasse avec `--chemins`. Chaque ligne est éprouvée
contre les identifiants publiés ; celles qui tombent juste certifient leur
fiche, les autres sont ignorées sans dommage. **C'est ce qu'il faut chercher
avant de reconstruire.**

**Les `formes:` du glossaire.** `glossaire.json` ne publie que
`{terme, definition}` : les variantes déclinées sont perdues. Le
`glossaire.yml` écrit porte `formes: []` et un avertissement en tête. Le
soulignement automatique ne reconnaîtra plus que la forme exacte jusqu'à
réécriture — c'est le seul écart mesuré entre les deux publications de
l'aller-retour.

**Tout ce qui précède le premier `##`.** `decouperSections` ne retient que ce
qui suit un `##` reconnu : un texte placé entre le front-matter et le premier
titre n'est jamais entré dans la publication. Il était déjà perdu avant la
perte du dossier — le site ne l'affichait pas.

**Les commentaires et le HTML écrits à la main.** `remark-rehype` tourne sans
`allowDangerousHtml` : un `<!-- commentaire -->` ou une balise HTML dans une
fiche n'est pas rendu, donc jamais publié, donc irrécupérable.

**L'empreinte des fiches audio.** Les MP3 reviennent intacts, mais pas
l'empreinte qui dit à `npm run podcasts` qu'ils sont à jour. **`npm run
podcasts` les croira périmés et voudra les resynthétiser** — ce qui coûte. Ne
pas le lancer sans l'avoir décidé.

## Quatre défauts que la mesure a trouvés, et qui seraient tous passés

Ils sont écrits ici parce que ce sont exactement les défauts qu'une lecture du
code ne voit pas, et qu'un outil livré sans aller-retour les aurait emportés.

**1. Le repli en HTML verbatim détruisait la section.** La première version
gardait le HTML publié tel quel quand la reconversion ne coïncidait pas, en se
disant que « du HTML dans un Markdown reste du HTML ». C'est faux dans cette
chaîne : `remark-rehype` tourne sans `allowDangerousHtml` et **jette** le HTML
écrit à la main. Une section « gardée en verbatim » ne différait donc pas un
peu — elle disparaissait entièrement, et le rapport la déclarait intacte.

**2. Les tableaux GFM n'étaient pas convertis**, et tombaient dans ce même
repli : une synthèse en tableau comparatif revenait en page blanche.

**3. Le YAML écrit à la main écrasait toute structure imbriquée.** Celui-ci
n'a été trouvé que sur le corpus réel. `correction.par_option` est une liste
d'objets, `sources` et `visuel` en sont : un `String(valeur)` les écrivait
`'[object Object]'`, et le build **refusait le corpus récupéré en bloc**. Le
module emploie désormais `yaml`, déjà dans les dépendances de développement.

Ce défaut dit quelque chose d'important sur la méthode : l'aller-retour ne
portait que sur `content-exemple/`, et les trois fiches d'exemple n'ont aucune
`correction`. **Un corpus d'exemple est un échantillon, pas une garantie.**
Les vérifications du § 0 de l'essai éprouvent maintenant la structure complète
contre le schéma du dépôt, sans dépendre de ce que l'exemple contient.

**4. Les renvois « rappel de cours » devaient être défaits.** La source écrit
un renvoi comme un chemin de fiche ; le build le résout en `{id, titre}`, et
c'est la forme résolue que la publication porte. Sans la défaire, le schéma
reçoit un objet là où il attend une chaîne et le build refuse tout. La défaire
exige de connaître le chemin de la fiche visée, donc d'avoir examiné toutes les
fiches d'abord : l'outil fonctionne en deux passes pour cette seule raison.

Et un cinquième dans l'essai lui-même : la comparaison champ par champ sautait
les fiches absentes de la reconstruction. Quand tous les identifiants
changeaient, elle ne comparait rien et douze assertions passaient au vert sur
un corpus qui n'avait pas été retrouvé. Un essai qui se tait quand il n'a rien
mesuré est pire qu'un essai rouge ; il compte désormais ce qu'il compare.

## Un angle mort du dépôt, signalé au passage

`tsconfig.json` n'inclut que `**/*.ts` : **`astro check` ne type-vérifie aucun
fichier `.mts`**. Mesuré en introduisant une erreur de type volontaire dans
`scripts/recuperer-corpus.mts` — `astro check` a rendu « 0 errors ». Beaucoup
d'essais du dépôt sont des `.mts`. Les fichiers de cette branche ont donc été
vérifiés à part, par `tsc --noEmit --strict` : zéro erreur. Ce n'est pas
corrigé ici — cela touche la configuration de tout le dépôt.
