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
| `<sortie>/content/` | le corpus au format source, à remettre en place — fiches, glossaire, bibliographie, registre des molécules |
| `<sortie>/annexes/` | la banque de QCM et l'index de recherche, au format publié (JSON) |
| `<sortie>/a-relire/` | le HTML publié des sections à comparer à la main |
| `<sortie>/RAPPORT.md` | ce qui est revenu, transformé, ou perdu, fiche par fiche |

**Mettez `<sortie>` à l'abri ailleurs avant toute autre chose.** C'est le
deuxième exemplaire au monde, et le premier en clair.

## Ce qui a été mesuré, et comment

### Sur le corpus réel, de bout en bout

La récupération a été exécutée sur `cec51b3`, le corpus récupéré a été
**reconstruit**, et les deux publications comparées champ par champ. Ce ne sont
pas des estimations.

| | |
| --- | --- |
| Fiches récupérées | **427 sur 427** |
| **Identifiants conservés après reconstruction** | **427 sur 427** |
| Fiches audio républiées | **250 sur 250** |
| Chemins certifiés par leur empreinte | 378 sur 427 |
| Fiches portant `id_publie` | 49 |
| Flashcards | 12 554 |
| Questions de quiz | 6 235 |
| Questions de prétest | 3 446 |
| Termes de glossaire | 560 |
| Le corpus récupéré se reconstruit | **oui**, sans erreur |

Les 427 identifiants survivent : 378 parce que leur chemin a été retrouvé, 49
parce qu'elles déclarent `id_publie`. Toute la progression enregistrée dans le
navigateur reste donc valable, et les 250 fiches audio aussi — contre 217 avant
que ce champ n'existe.

La comparaison des deux publications déchiffrées donne : `titre`, `matiere`,
`fascicule`, `tags`, `sommaire`, `parties`, `flashcards`, `quiz`, `pretest`,
`podcast` **identiques, tous les 427**. Le `quiz` inclut ses corrections
imbriquées — `par_option`, `sources`, `visuel`, les renvois.

Le texte rendu, hors soulignement du glossaire : **843 sections identiques sur
854**. Les 11 autres sont nommées dans le rapport, avec leur HTML publié gardé
à côté dans `a-relire/`.

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

**Mesuré : 378 chemins sur 427 sont certifiés**, en trois temps — la liste
fournie s'il y en a une, les formes dérivables, puis l'énumération exhaustive
des sous-suites ordonnées.

Les 284 chemins que les seules formes dérivables trouvaient ont servi
d'échantillon d'apprentissage : 157 noms sont le titre entier, 30 un préfixe
exact, et **97 une sous-suite ordonnée** — des mots retirés au milieu, pas
seulement à la fin. Énumérer les sous-suites a porté le compte à 376.

Deux de plus sont venues de l'historique Git, et elles valent plus que leur
nombre : `git log --all -p` ne contient que onze chemins de fiche en clair dans
tout le dépôt, mais deux tombent juste et **apprennent la règle qui manquait**.
`dgfip-a/organisation-dgfip/fiche-01-…` n'a pas de segment de matière — la
racine du parcours tient ce rôle — et `organisation-dgfip` est une sous-suite de
« Organisation de la DGFiP » : le DOSSIER est abrégé à la main comme les noms
de fiche. La recherche énumère donc les deux côtés, sous un plafond, parce que
le produit des deux énumérations atteint cent cinquante millions de candidats
pour une seule fiche.

**Les 49 restantes résistent à toute dérivation**, et c'est établi, pas
supposé : leur nom n'est pas une sous-suite du titre, le numéro du fichier n'est
pas en cause (éprouvé de 1 à 99), le dossier de fascicule n'est pas une
abréviation de son propre titre, et elles ne se regroupent ni par parcours ni
par matière. Ce sont des noms choisis à la main, hors de toute règle.

**Mais elles ne perdent plus rien pour autant.** Elles déclarent `id_publie`,
et gardent donc leur identifiant, leur progression et leur fiche audio — c'est
ce qui fait passer la reconstruction de 217 audios retrouvés à 250, et de 376
identifiants conservés à 427. Le chemin exact reste préférable, et toute liste
d'anciens chemins les certifiera sans risque : une sauvegarde, une capture de
l'arborescence, un vieux `ls -R`, déposés un par ligne et repassés avec
`--chemins`. Mais ce n'est plus une urgence : c'est du rangement, plus du
sauvetage.

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

## Ce que le chiffrement du site protège, et ce qu'il ne protège pas

Un fait mesuré pendant ce travail, et qui dépasse la récupération.

**Le mot de passe du site fait cinq caractères.** Avec la PBKDF2-SHA256 à
600 000 itérations du projet, l'espace entier se parcourt en une demi-heure sur
un seul GPU en supposant majuscules et chiffres, en huit heures en
alphanumérique sensible à la casse. Les 600 000 itérations multiplient le coût
d'**un essai** ; elles ne multiplient pas le **nombre d'essais** à faire, et
contre un mot de passe court elles n'achètent presque rien.

Or les 412 Mo du corpus sont publiés chiffrés sous ce mot de passe dans un
dépôt **public**. Le contenu est donc déjà lisible par qui clone `gh-pages` et
accepte d'attendre quelques heures de calcul.

Deux conséquences. D'abord, mettre le corpus à l'abri de la PERTE n'a pas
demandé de publier quoi que ce soit : le texte des 427 fiches pèse 4,5 Mo
compressé et a été remis directement. Ensuite, ranger une archive chiffrée avec
ce même mot de passe dans ce même dépôt public donnerait l'apparence d'une
protection, et non une protection — c'est écrit en tête de
`scripts/archiver-corpus.mts` pour que personne ne s'y trompe plus tard.

Le geste qui changerait réellement quelque chose est de passer à une vraie
phrase de passe et de reconstruire. Il est devenu possible précisément parce
que le corpus est récupéré. Il invalide les sauvegardes déjà faites par qui
révise, et c'est donc une décision d'Alexis, pas une correction à glisser dans
une branche.

## Un angle mort du dépôt, signalé au passage

`tsconfig.json` n'inclut que `**/*.ts` : **`astro check` ne type-vérifie aucun
fichier `.mts`**. Mesuré en introduisant une erreur de type volontaire dans
`scripts/recuperer-corpus.mts` — `astro check` a rendu « 0 errors ». Beaucoup
d'essais du dépôt sont des `.mts`. Les fichiers de cette branche ont donc été
vérifiés à part, par `tsc --noEmit --strict` : zéro erreur. Ce n'est pas
corrigé ici — cela touche la configuration de tout le dépôt.
