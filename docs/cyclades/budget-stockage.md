# Budget de stockage, mesuré

Livrable de la phase 2. Le prompt « stockage » demande de **commencer par
mesurer, sans présupposer**, et de dire « si la compression est un gain réel ou
marginal pour chaque magasin ». Voici les chiffres, puis ce qu'ils imposent.

Rejouable : `npm run bench-storage` pour la mesure du modèle,
`npm run bench-storage -- --navigateur` pour la mesure réelle.

## Protocole

Cinq ans d'usage intensif engendrés par `scripts/lib/donnees-synthetiques.mjs`,
graine 7, hypothèses déclarées dans le script et rappelées par le banc. Les notes
de séance sont du **vrai français** assemblé depuis un vocabulaire fini : mesurer
un taux de compression sur des chaînes aléatoires n'aurait rien mesuré, puisque
des octets aléatoires ne se compressent pas.

Deux mesures, qui ne disent pas la même chose :

- **hors navigateur** — la taille des enregistrements sérialisés, et ce que gzip
  en fait. C'est la mesure du *modèle de données*, reproductible et rapide ;
- **dans le navigateur** — l'occupation rapportée par
  `navigator.storage.estimate()` après écriture dans la vraie base, et le temps
  de chargement réel des écrans. C'est celle qui compte.

## Les chiffres

### Taille

| Grandeur | Valeur |
|---|---|
| Enregistrements, magasins existants | 22 718 |
| Sérialisé (JSON, un objet par ligne) | **17,73 Mio** |
| Le même, compressé en gzip | **1,44 Mio** (−92 %) |
| Occupation réelle d'IndexedDB | **9,12 Mio** |
| Rapport réel ÷ sérialisé | **0,51×** |

**La première surprise est dans la dernière ligne.** IndexedDB occupe la moitié
du sérialisé. Chromium comprime les valeurs sans qu'on lui demande rien —
LevelDB le fait pour son propre compte. Le gain que la mesure hors navigateur
laissait espérer est donc **déjà pris à moitié**.

### Les magasins, du plus lourd au plus léger

| Magasin | Enreg. | Sérialisé | Par enreg. | gzip | Gain | Un balayage |
|---|---|---|---|---|---|---|
| `seances` | 1 470 | **11,60 Mio** | 8 273 o | 670,6 Kio | 94 % | **259 ms** |
| `relationnel` | 1 470 | 1,82 Mio | 1 301 o | 159,1 Kio | 91 % | 62 ms |
| `cartes` | 4 160 | 1,61 Mio | 406 o | 247,7 Kio | 85 % | 56 ms |
| `journal` | 1 671 | 665,0 Kio | 299 o | 94,8 Kio | 86 % | 15 ms |
| `difficultes` | 4 700 | 433,9 Kio | 95 o | 81,8 Kio | 81 % | 40 ms |
| `qcmSessions` | 383 | 417,3 Kio | 1 116 o | 26,8 Kio | 94 % | 10 ms |
| `nback` | 1 470 | 309,0 Kio | 215 o | 37,9 Kio | 88 % | 13 ms |
| `quiz` | 1 802 | 217,2 Kio | 123 o | 37,8 Kio | 83 % | 15 ms |
| `jours` | 1 826 | 164,0 Kio | 92 o | 22,4 Kio | 86 % | 14 ms |
| `vmSessions` | 733 | 149,1 Kio | 208 o | 21,1 Kio | 86 % | 7 ms |
| `aides` | 740 | 109,6 Kio | 152 o | 17,0 Kio | 84 % | 12 ms |
| `fiches` | 520 | 103,9 Kio | 205 o | 21,7 Kio | 79 % | 4 ms |
| `competences` | 583 | 99,9 Kio | 175 o | 17,4 Kio | 83 % | 5 ms |
| `qcmDgfip` | 540 | 80,5 Kio | 153 o | 11,0 Kio | 86 % | 4 ms |
| `vmSeuils` | 42 | 16,3 Kio | 398 o | 3,8 Kio | 77 % | 1 ms |
| `etat` | 3 | 511 o | 170 o | 320 o | 37 % | — |

**`seances` pèse 65 % du total à lui seul**, et il représente 49 % de tout ce
que la compression pourrait économiser. Ce sont les notes de séance d'une à deux
pages, et leurs restitutions à blanc. C'est aussi exactement ce que le prompt
interdit d'agréger : « compression admise, perte non ».

### Temps de chargement, base pleine

| Écran | Prêt en |
|---|---|
| `/` (tableau de bord) | **2,25 s** |
| `/planification/` | 1,54 s |
| `/statistiques/` | 0,48 s |
| `/flashcards/` | 0,17 s |
| `/journal/` | 0,13 s |

Ces durées comprennent le déverrouillage et le déchiffrement du manifeste : ce
n'est pas le coût d'IndexedDB seul, c'est le temps que la personne attend.

### Le magasin qui n'existe pas

Le modèle ne journalise **pas** les révisions FSRS : `cartes` ne porte que l'état
courant. Or le prompt dit, à juste titre, que « l'optimisation personnalisée des
paramètres FSRS en a besoin ». Ce qu'il coûterait :

| Magasin | Enreg. | Sérialisé | Par enreg. | gzip | Gain |
|---|---|---|---|---|---|
| `revisions` | 59 248 | 7,59 Mio | 134 o | 1,33 Mio | 82 % |

Soit **25,32 Mio sérialisés** au total, et de l'ordre de 13 Mio réels. Le créer
reste de loin la décision la plus structurante de tout ce chantier — sans lui,
l'optimisation des paramètres FSRS est hors d'atteinte pour toujours, parce
qu'un historique non écrit ne se reconstitue pas.

## Ce que les mesures imposent, et qui renverse le plan

### 1. La compression ne résout pas le problème qu'on croyait

Neuf mégaoctets après cinq ans. Les quotas de navigateur se comptent en
gigaoctets — typiquement 60 % de l'espace libre du disque. **Le quota n'est pas
en jeu, et ne le sera pas.** Ton estimation initiale (« ces volumes restent
modestes ») était la bonne, et la mesure la confirme plutôt que de la corriger.

Une couche de compression segmentée gagnerait tout de même beaucoup en octets :
1,44 Mio contre 9,12 Mio, soit **−84 % du réel**. Le gain est réel. Mais il
porte sur une ressource qui n'est pas rare.

### 2. Le problème réel est le temps, et la compression l'aggraverait

Un balayage complet de `seances` coûte **259 ms**, et plusieurs écrans le
refont quatre ou cinq fois par peinture — `seanceDuJour`, `historique`,
`planning`, `suggestionTrimestrielle` appellent chacun `toutesLesSeances()`.
D'où les 2,25 s du tableau de bord.

Or ces lectures n'ont **presque jamais besoin des notes**. Elles veulent le
thème, le jour, le statut. Elles chargent 11,6 Mio de prose pour lire trois
champs.

Comprimer les segments anciens ne ferait pas disparaître ce coût : il faudrait
décomprimer pour balayer. **La compression déplacerait le travail du disque vers
le processeur, sans réduire le nombre de lectures.**

### 3. Ce qu'il faut faire à la place, et d'abord

**Séparer la note de son enregistrement.** Un magasin `seances` qui ne porte que
les champs de pilotage (thème, jour, statut, secondes, étendue, fiches), et un
magasin `notes` séparé, chargé à la demande quand on ouvre une séance. Le
balayage tombe alors de 11,6 Mio à moins de 300 Kio.

C'est le **levier 1** du prompt — « modélisation compacte » — et il est annoncé
comme le moins risqué des trois. Les mesures disent qu'il est aussi le seul qui
porte sur le vrai goulot.

**Puis supprimer les balayages redondants.** Quatre appels à
`toutesLesSeances()` par peinture est une faute indépendante du volume ; elle ne
se voyait pas à 50 séances, elle se voit à 1 470.

## Politique de rétention, magasin par magasin

Le prompt demande ce tableau. « Compresser » veut dire : segments mensuels
au-delà de la fenêtre récente, hors de la fenêtre de 90 jours. « Agréger » n'est
proposé pour aucun magasin, et c'est une conclusion, pas une prudence : le gain
en octets ne vaut nulle part la perte d'information, puisque les octets ne
manquent pas.

| Magasin | Volume à 5 ans | Politique | Justification |
|---|---|---|---|
| `seances` (pilotage) | ~300 Kio | **conserver** | Balayé en permanence ; doit rester chaud et léger |
| `notes` (nouveau) | 11,3 Mio | **compresser** après 90 j | Texte rédigé par la personne : perte interdite, compression à 94 % acquise, et il n'est lu qu'à l'ouverture d'une séance |
| `revisions` (à créer) | 7,6 Mio | **compresser** après 12 mois | Journal FSRS : l'optimisation des paramètres a besoin du détail complet. Jamais agrégé |
| `relationnel` | 1,8 Mio | **compresser** après 12 mois | Le détail par item sert au calcul de progression, qui se recalcule ; la fenêtre récente suffit aux écrans |
| `cartes` | 1,6 Mio | **conserver** | État courant, lu à chaque session. Jamais compressé |
| `journal` | 665 Kio | **conserver** | Borné par le nombre d'items, pas par le nombre d'erreurs : une entrée par item au plus. Les entrées ouvertes sont lues en permanence |
| `difficultes` | 434 Kio | **conserver** | Une note par item, lue à chaque tirage |
| `qcmSessions` | 417 Kio | **compresser** après 12 mois | Historique ; seuls les derniers scores s'affichent |
| `nback`, `quiz`, `vmSessions` | ~675 Kio | **compresser** après 12 mois | Historiques de session |
| `jours` | 164 Kio | **conserver** | Un enregistrement par jour, 92 o : la frise et la série les lisent tous |
| `vmSeuils` | 16 Kio | **conserver** tel quel | Série temporelle d'une paire de dimensions ; le prompt l'exige explicitement |
| `fiches`, `competences`, `qcmDgfip`, `aides`, `etat` | ~295 Kio | **conserver** | Volumes négligeables |

## Budget visé

| Grandeur | Aujourd'hui (5 ans simulés) | Visé après chantier |
|---|---|---|
| Occupation réelle | 9,12 Mio | **≤ 4 Mio** (notes et historiques compressés) |
| Avec le journal FSRS | ~13 Mio | ≤ 6 Mio |
| Balayage du magasin le plus lourd | 259 ms | **≤ 30 ms** |
| Tableau de bord prêt | 2,25 s | **≤ 1 s** |

Le budget d'octets est **secondaire** et je le dis franchement : il est tenu
d'avance. Les deux lignes qui comptent sont les deux dernières.

## Deux limites de cette mesure, à ne pas oublier

**`navigator.storage.persist()` a été refusé** pendant la mesure. C'est attendu
dans un Chromium sans interface : la permission dépend de signaux d'engagement
que le mode automatisé n'a pas. On ne peut donc **rien conclure** du
comportement réel sur ton navigateur — à vérifier à la main, et c'est au
programme de la section « durabilité ».

**Le générateur produit des identifiants de journal en doublon.** 2 276 entrées
engendrées, 1 671 distinctes en base : le magasin est clé par identifiant
d'item, donc une seconde erreur sur le même item écrase la première. Ce n'est
pas un défaut du générateur mais une propriété du modèle qu'il a révélée : la
taille de `journal` est **bornée par le nombre d'items**, et non par le nombre
d'erreurs. Elle ne peut donc pas déraper.
