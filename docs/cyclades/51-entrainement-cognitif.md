# Prompt 51 — faire comprendre les exercices d'Entraînement cognitif

**Établi le 19 octobre 2026, branche `claude/p51`.**

## En tête : trois défauts qu'aucune erreur ne signalait

Ils sont en tête parce que c'est ce que le lot a appris, et parce que les trois
se ressemblent : rien ne les trahissait, et c'est la mesure qui les a sortis.

**Le son échouait en silence.** Sur un téléphone en mode silencieux, la
dimension Son devenait inaudible sans que rien ne le dise. On jouait une partie
à quatre dimensions dont une était impossible, et le score en tenait compte : la
faute paraissait venir de la personne. L'échec remonte désormais à l'écran, et
la dimension sort de la partie en cours.

**Raisonnement n'avait aucun garde-fou d'écriture**, là où Mémoire en portait un
depuis toujours. Il enregistrait la session, les traces et l'XP sans condition —
ce qui rendait l'interdit 3 impossible à tenir pour la partie découverte.

**Le taux de correspondance s'exprime en pourcent, pas en fraction.** J'avais
écrit 0,3 en croyant dire « trois sur dix » : la découverte tournait à trois
pour mille, ne contenait aucune répétition, annonçait « 0 répétition sur 0 », et
l'astuce prévue par le constat P3 ne pouvait jamais paraître. Une découverte
sans rien à trouver n'apprend rien.

## Ce que chaque constat est devenu

### Corrigés

| Constat | Ce qui a été fait |
|---|---|
| Q1 — zone de jeu invisible au lancement | La page amène la zone sous les yeux et **attend** qu'elle y soit. Le sabotage a montré que le défaut touchait aussi l'ordinateur, contrairement à ce que Q1 laissait croire. |
| V1 — verdict porté par la couleur seule | Verdict en mots dans une région annoncée, plus un signe sur chaque cadre, à pleine opacité. |
| R5, R9 — verdict sans focus | Le verdict prend le focus après « Valider », et chaque ligne d'appariement porte un signe — pas seulement les fausses. |
| C1 — aucune consigne, pas de retour en arrière | Un encart « Comment ça marche » en tête, ouvert tant qu'aucune partie n'a été jouée, et « Revoir la consigne » pendant la partie. Dans Mémoire, elle met en pause. |
| Q2 — rien pour essayer | Une partie découverte par exercice, qui n'écrit rien. |
| R2, R1 — pas de première session guidée, pas d'arrêt | Six questions dont un exemple résolu ; un bouton « Arrêter » avec confirmation. |
| V3 — pas d'arrêt | Idem, et les réponses sont gardées par construction. |
| Q7, R4 — bilans muets | Trois lignes : ce qui s'est passé, ce qui progresse, la suite. L'emoji seul est remplacé par une phrase. |
| A1, A2, C5 — accueil sans orientation | « Nouveau ? Commencez par… », durée et matériel par carte, nom français en titre. |
| A3, R3, R7, R8, V10, C3 — mots incohérents | « niveau » partout, « question » au lieu d'« item », « Mes seuils », et les boutons nommés par ce qu'ils font. |
| Q9, V6, C4 — textes fautifs | « 2,5 s » au lieu de « 2.5 s », le ↻ décrit juste, la phrase de Correspondance refaite, l'assistant en français. |
| V7 — panneau illisible | Phrase d'ouverture, intitulés renommés, noms des échelles au lieu des identifiants. |
| Q6, V5 — son muet sans explication | Bandeau d'échec, avertissement étendu à la référence sonore, case « Sans son ». |
| Q4, Q10, Q11 — Mémoire au doigt | Lettre de touche cachée au doigt, ↻ nommé, agrandi et confirmé, jauge à largeur minimale. |
| Q5, Q12, C2 — couleurs et signes | Les couleurs de retour passent aux jetons ; les signes à pleine opacité. |
| V8 — boutons trop petits | `aria-pressed` et 44 px. |
| A5 — prudence inégale | « Ce que l'exercice fait travailler » remplace « Utile pour ». |

### Faits autrement que demandé, et pourquoi

**P14 — la prémisse du constat était inexacte.** Il demande de remplacer les
teintes `emerald`, `rose` et `amber` par les jetons. Or le générateur de thèmes
déclare ces familles *comme étant* ces rôles : les écrire est la voie par
laquelle on atteint les jetons, et elles suivent déjà les quatorze thèmes. Les
réécrire n'aurait rien changé à l'écran. Le travail utile était la seconde
moitié du constat — que la couleur ne porte jamais seule le sens — et c'est
celle-là qui est faite.

**Les huit couleurs du Quad N-Back restent écrites en dur**, conformément à une
décision antérieure que le fichier et l'essai des jetons portent déjà : ce sont
les stimuli de la dimension « Couleur », et les faire suivre le thème les
rendrait incomparables d'une séance à l'autre. Seules les couleurs de **retour**
ont bougé, ce qui **resserre** l'exception au lieu de l'élargir.

**La légende de la matrice décrit des symboles qui n'existent pas.** Le constat
P18 demande « X : la ligne a la relation avec la colonne ; −X : elle ne l'a
pas. » Il n'y a ni X ni −X dans le code : un seul producteur de matrice existe,
et ses cases portent « · », « ? » ou le nom bref de la relation. Recopier la
phrase aurait fait chercher des X. La légende écrite est celle des symboles
réels, et elle est montrée toujours — un symbole inexpliqué l'est aussi pour qui
ne fait pas la découverte.

**Le nom pluriel par dimension n'existe pas.** Le constat P17 propose « Lequel
des deux **sons**… », avec « sons », « ronds », « carrés ». Aucun de ces noms
n'est déclaré, et les inventer demanderait de dire ce que chaque dimension
dessine, ce qu'aucune source ne donne. La phrase emploie « propositions », qui
est déjà le mot de l'écran.

**L'avertissement de seuil est reformulé, pas déplacé à 96 essais.** Doubler le
nombre d'essais doublerait la durée — dix à vingt minutes là où la carte
d'accueil en annonce cinq à dix — et rien ne le demande : les écarts se cumulent
d'une session à l'autre. Une session courte n'est pas insuffisante.

**La durée de la découverte est calculée.** Le constat écrit « (1 minute) » ;
douze tours à trois secondes font trente-six. Elle se déduit des réglages.

**« Une session compte 12 questions » est faux deux fois** : douze est le nombre
d'énoncés par défaut, qui se règle, et un énoncé à suite en rend deux. La phrase
dit le réglage et ce qu'il compte.

### Ce qui reste, et à qui

**Six noms de types de questions portent encore un terme technique** — « Algèbre
cachée », « Isomorphisme partiel », « Prémisse manquante », « Prémisses
minimales », « Prémisse du second ordre », « Conclusion d'une chaîne ». Un nom
n'est pas une phrase : « la règle que suit une relation (algèbre) cachée » n'est
pas un nom. Les renommer est une décision de contenu sur vingt moteurs, hors de
ce lot. L'essai de vocabulaire les compte et les affiche, sous une exception
motivée, pour que le manque reste visible.

## Trois leçons que les essais m'ont apprises contre moi

**Un essai vert ne prouve rien avant qu'on l'ait vu rougir.** J'ai posé un
verrou contre un double comptage et j'allais annoncer un défaut corrigé. Retiré,
l'essai restait vert ; le chemin réel — double clic sur « Voir le bilan » —
restait vert aussi. La raison est que la fin de session change d'écran **avant**
sa première écriture, donc le bouton disparaît avant qu'un second clic
l'atteigne. Aucun geste ne produit de double compte. Le verrou reste, mais ni le
code ni l'essai ne prétendent qu'il corrige quelque chose.

**Un essai peut avoir tort, et il faut mesurer lequel des deux.** L'essai de
vocabulaire s'est trompé quatre fois avant d'avoir raison vingt : « n »
attrapait tout mot commençant par n, « pas » aurait attrapé l'adverbe, les
expressions enjambant plusieurs lignes laissaient du code dans le texte examiné,
et le glossaire écrit l'apostrophe typographique là où les écrans emploient
parfois la droite. Chaque fois, j'ai vérifié avant de toucher au code.

**Un essai qui ne voit pas la moitié de l'écran rassure à tort.** Le même essai
était vert pendant que l'écran affichait « Isomorphisme partiel » : il lisait les
composants, et ces mots sont déclarés dans les moteurs. Il les voit maintenant.

Et une quatrième, qui n'est pas des essais mais de moi : **reconstruire le site
pendant qu'une batterie tourne dessus invalide son verdict.** Je l'ai fait une
fois ; j'ai arrêté la batterie plutôt que de la laisser rendre un chiffre faux.

## Mesures

`essais:mots-cog` vert, dix-sept termes à la table, trois exceptions toutes
utiles. `essais:cog:navigateur` — créé par ce lot, la branche n'en avait aucun —
à 99 contrôles, aux deux tailles et dans les deux modes. `astro check` : 0
erreur, 0 avertissement. Socle 16 verts sur 16 pour L1, L2 et L3, chacun sur sa
propre construction, et une fois de plus sur la tête de branche.

## Les captures : la moitié du livrable est désormais impossible

Le § 4 demande des captures **avant et après**. Celles d'avant n'ont pas été
prises au début du lot, et l'état d'avant n'existe plus : je ne peux donc plus
les produire. C'est un manquement, et je ne le présente pas autrement.

Ce que j'ai fait à la place, et qui ne le remplace pas tout à fait : la branche
n'avait **aucun** essai de navigateur, et en écrire un de quatre-vingt-dix-neuf
contrôles constate à chaque passage ce qu'une capture ne montre qu'une fois.

Les captures d'après sont prises : trente images, aux trois largeurs du 41 et
dans les deux modes d'Égée, sur l'accueil, les trois écrans de réglages et le
glossaire ouvert sur une entrée — le seul endroit où P9 se voit. Le script
contrôle aussi le débordement en largeur à chaque prise, ce qui vaut mieux
qu'un œil sur trente images : aucune anomalie.
