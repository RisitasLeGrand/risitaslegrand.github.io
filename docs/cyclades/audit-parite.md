# Audit de parité — ce qui dépend de l'INSP aujourd'hui

Livrable de la phase 0, partie A.1. L'audit répond à une question précise : **si l'on créait un
parcours DGFiP B ce soir, qu'est-ce qui ne marcherait pas ?**

La colonne « état » n'est pas une impression. Elle vaut **mesuré** quand j'ai lu le code qui le
décide, et **à vérifier** quand je ne l'ai pas fait — la distinction est maintenue exprès, parce
qu'un audit qui mélange les deux ne sert qu'à se rassurer.

## Les quatre dépendances codées en dur, trouvées et localisées

| Dépendance | Fichier | Ce qui bloque |
|---|---|---|
| **Les sept matières de l'INSP comme thèmes de planification** | `src/lib/rotation.ts`, `THEMES` | Les sept thèmes de la rotation hebdomadaire sont une constante du code, chacun portant une matière nommée (« Droit public », « Cas pratique »…). Un parcours DGFiP n'aurait aucun thème, donc aucune planification. **C'est la dépendance structurante** : tout le reste en découle. |
| **L'ouverture du prompt « Demander à l'IA »** | `src/features/assistant/prompt.ts` ligne 112 | « Tu m'aides à préparer le concours externe de l'INSP (Institut national du service public) » est une chaîne littérale. Un QCM DGFiP produit donc aujourd'hui un prompt qui nomme le mauvais concours. |
| **Un préréglage du prompt nomme l'INSP** | `src/features/assistant/prompt.ts` ligne 89 | « Dis-moi ce qu'une très bonne copie ajouterait sur ce point au concours de l'INSP ». Même défaut, dans le préréglage « approfondir ». |
| **Le champ « lien avec le cours » des actualités est unique** | `src/lib/actualites-rendu.ts` lignes 56-65 | `lien_cours` est une chaîne, pas un dictionnaire par parcours. Une actualité ne peut donc commenter le programme que d'un seul parcours. |

Le **concours interne** est par ailleurs désigné « externe » dans l'ouverture du prompt, alors que
le parcours par défaut est l'interne. C'est une erreur indépendante du chantier, à corriger au
passage.

## Ce qui est déjà agnostique, et c'est la bonne nouvelle

| Élément | Pourquoi il l'est |
|---|---|
| **La liste des matières** | Lue du manifeste produit par le build (`src/lib/contenu.ts`, `manifeste.matieres`), pas écrite dans le code. Un dossier `content/<parcours>/` donnera ses matières sans toucher une ligne. |
| **Les corrections de QCM et leurs visuels** | `MATIERES_MIGREES` et `RUBRIQUES_MIGREES` sont des listes **vides** (`scripts/lib/corrections-migrees.mjs`) : le régime de contrôle est déclaratif et ne nomme aucune matière. |
| **Les vingt-et-un moteurs de Cog-Training** | Aucun ne connaît de matière ni de concours. Cog-Training est partagé entre parcours par nature. |
| **FSRS, journal d'erreurs, niveau estimé** | Travaillent sur des identifiants de carte, de fiche et de matière, sans liste fermée. |
| **Le chiffrement** | Une clé pour tout le site, dérivée du mot de passe. Aucun parcours n'a de secret propre. |

## Le tableau fonctionnalité × parcours

État au 10 octobre 2026. « Vide » signifie que le parcours n'a pas encore de contenu, pas que la
fonctionnalité manque.

| Fonctionnalité | INSP | DGFiP B | DGFiP A | DGFiP A+ | État |
|---|---|---|---|---|---|
| Cours et fiche simplifiée | 262 fiches | vide | vide | vide | **mesuré** — agnostique, attend du contenu |
| Flashcards | oui | vide | vide | vide | **mesuré** — agnostique |
| Quiz de cours | oui | vide | vide | vide | **mesuré** — agnostique |
| Correction détaillée et visuels | 64 corrections | vide | vide | vide | **mesuré** — agnostique |
| Prétest | partiel | vide | vide | vide | **mesuré** — agnostique ; curseur par matière à écrire (phase 5 du plan précédent) |
| Glossaire | commun | commun | commun | commun | **mesuré** — un seul fichier `content/glossaire.yml`, **surcharge par parcours à écrire** |
| Podcasts | 127 fiches | vide | vide | vide | **à vérifier** — la chaîne de synthèse ne nomme pas de matière, mais je n'ai pas relu son indexation |
| Planification et rotation | oui | **bloqué** | **bloqué** | **bloqué** | **mesuré** — `THEMES` codé en dur |
| Niveau estimé, ZPD | oui | vide | vide | vide | **mesuré** — agnostique |
| Journal d'erreurs | oui | vide | vide | vide | **mesuré** — agnostique |
| QCM - DGFiP | 540 questions | 540 | 540 | 540 | **mesuré** — banque commune, **filtre par `categorie_origine` à écrire** |
| « Demander à l'IA » | oui | **faux** | **faux** | **faux** | **mesuré** — nomme l'INSP en dur |
| Actualités | oui | lien absent | lien absent | lien absent | **mesuré** — `lien_cours` unique |
| Cog-Training | partagé | partagé | partagé | partagé | **mesuré** — hors parcours par nature |

## Ce que l'audit change au plan

Trois choses, et la première est la plus importante.

**`rotation.ts` est le pivot, pas le registre de parcours.** Je pensais le registre de parcours
indépendant ; il ne l'est pas. Les thèmes de planification y vivent, et la planification est ce qui
fait tourner les séances, donc les rappels, donc le journal d'erreurs. Le registre devra donc
**déclarer les thèmes**, et `rotation.ts` devenir un lecteur du registre. C'est une modification plus
profonde que « ajouter un fichier de configuration ».

**Le prompt « Demander à l'IA » est déjà faux sur le QCM DGFiP, aujourd'hui, pour l'INSP.** Une
question de maths de la DGFiP produit un prompt qui annonce le concours de l'INSP. Ce n'est pas un
défaut à venir, c'en est un en production. Il passe donc de la phase 6 à **corriger dès la phase où
le registre existe**.

**Le mot « externe » est faux.** Le parcours par défaut est le concours **interne**, et le prompt dit
« externe ». À corriger dans le même mouvement.

---

## Addendum du 25 octobre 2026 — ce qui a bougé depuis

Le relevé ci-dessus garde sa date : c'est un état mesuré le 10 octobre, et le
réécrire effacerait la trace de ce qui a été trouvé. Ce qui suit dit ce qui a
changé, et ce qui n'a pas changé.

**La dépendance structurante est levée.** Le registre déclare les thèmes et
`rotation.ts` en est devenu le lecteur, comme l'audit le demandait. Les trois
parcours DGFiP se planifient : leurs thèmes viennent de l'arrêté, et la ligne
« Planification et rotation : **bloqué** » ne vaut plus.

**Le filtre par `categorie_origine` est écrit** (`src/lib/qcm-temporalite.ts`,
`questionsServables`), et l'écran de l'épreuve blanche lui passe le parcours
courant. La ligne « filtre par `categorie_origine` à écrire » ne vaut plus non
plus.

**Un défaut que l'audit n'avait pas vu, parce qu'il ne pouvait pas le voir.**
Le tableau dit « la liste des matières est agnostique : lue du manifeste, pas
écrite dans le code » — et c'est vrai. Mais la séance choisissait ses fiches par
le SEUL NOM DE LA MATIÈRE, et deux parcours peuvent déclarer la même :
« Organisation de la DGFiP » est au programme de DGFiP B comme de DGFiP A.
Un samedi, la séance de B proposait donc la fiche rangée sous `dgfip-a/`. Rien
ne rougissait, et rien ne pouvait rougir : les trois parcours DGFiP n'ont aucune
fiche, donc aucun essai ne pouvait mesurer la question. Il a fallu un essai de
navigateur qui PLANTE du contenu factice sous les quatre racines
(`essais:parcours-planifiables:navigateur`) pour le faire apparaître, en deux
rouges.

Le manifeste portait déjà de quoi trancher — `parcoursServis`, écrit par le
build — et personne ne le lisait. La séance le lit maintenant
(`ficheServieAuParcours`). La bibliothèque, la recherche et les statistiques,
elles, servent toujours le corpus entier : voir `docs/ajouter-un-parcours.md`
pour ce que ce choix préserve.

**`lien_cours` a cédé la place à un dictionnaire.** `liens_cours`, un lien par
parcours, est déclaré et lu (`src/lib/actualites.ts`, `actualites-rendu.ts`),
l'ancienne chaîne unique restant acceptée en repli — `essais:parcours` garde les
deux formes et le repli. Ce que je n'ai **pas** vérifié : si des actualités déjà
écrites portent encore l'ancienne forme. Lu dans le code ; non mesuré sur le
contenu.

**Ce qui reste du relevé, et n'a pas bougé :** le prompt « Demander à l'IA » —
les deux chaînes littérales qui nomment l'INSP, et le mot « externe » faux pour
un parcours interne —, et la surcharge du glossaire par parcours.
