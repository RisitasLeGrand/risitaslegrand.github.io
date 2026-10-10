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
