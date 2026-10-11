# Les six décisions à trancher

Livrable de la phase 0. Chaque point porte ma recommandation et ce qu'elle coûte. **Rien n'est codé
avant tes réponses.**

---

## 1. « Importer dans la session » — que veut dire conserver une analyse ?

Le prompt propose lui-même une interprétation : l'analyse est **rattachée à une période**, conservée,
visible dans Odyssée et dans la revue correspondante.

**Je la retiens, et j'ajoute une précision qui compte** : l'analyse est rattachée à **l'export** dont
elle est née (identifiant et empreinte), et c'est par là qu'elle est rattachée à une période — pas
par la période qu'elle déclare elle-même. Une IA qui se tromperait de trimestre rangerait sinon son
analyse dans la mauvaise revue, et personne ne s'en apercevrait.

Quand l'export est inconnu (journal effacé, fichier venu d'ailleurs), on retombe sur la période
déclarée, **avec l'avertissement** que B.6.3 demande.

Conséquence : une analyse apparaît à trois endroits, et nulle part ailleurs — l'historique des
analyses, la revue de sa période, et la liste des trajectoires pour ce qui a été adopté.

**Ce que je te demande** : cette interprétation, avec le rattachement par l'export plutôt que par la
période déclarée ?

---

## 2. La liste exacte des questions

Elle est dans `questions.md` : **quatorze questions de socle**, calibrées pour trois minutes, puis
six pour Révisions, six pour Sport, cinq pour Odyssée, posées à la première entrée dans la branche.

Deux choix méritent ton avis :

- **L'heure de lever est demandée très tôt** (question 5), parce qu'elle règle la bascule du jour
  logique. C'est le réglage qui, mal posé, fausse silencieusement toutes les séries. Le prix : deux
  questions d'horaire d'affilée au tiers du parcours.
- **Les objectifs sont en saisie libre** (questions 9 et 10), les seules du socle avec le prénom et
  l'activité. Une liste fermée d'objectifs de vie serait absurde ; mais ce sont trois écrans où il
  faut taper.

**Ce que je te demande** : la liste telle quelle, ou des questions à retirer, ajouter, reformuler ?
Toute question ajoutée en retire une autre si l'on tient les trois minutes.

---

## 3. Le schéma d'analyse définitif

Il est dans `schema-analyse.md`, avec six ajouts au point de départ du prompt, les énumérations
fermées, les plafonds et les neuf règles croisées.

Le point le plus important n'est pas un détail technique : **la liste des `nature` de proposition est
le garde-fou E.1 et E.4 tenu par la structure**. Une proposition de dose ou d'allocation n'a aucune
nature valide pour s'exprimer ; elle est refusée par le schéma, pas par un filtre de mots.

Deux plafonds à confirmer : **512 Kio** pour le fichier, et **1 %** d'écart pour un chiffre
« confirmé », 10 % pour « approché ».

**Ce que je te demande** : le schéma comme proposé, et ces deux seuils ?

---

## 4. La pseudonymisation par défaut des exports

**Oui, et plus que ce que le prompt demande.** Par défaut, l'export ne porte **ni prénom ni nom** —
c'est déjà la règle A.5. J'ajoute : le pseudonyme n'est **pas dérivé du nom**. Un pseudonyme calculé
depuis « Alexis » serait réversible par qui essaie dix mille prénoms. Il est tiré au hasard une fois,
gardé localement, de la forme `P-7F3A`, et il est **stable** pour que deux exports successifs
parlent de la même personne — ce qui est nécessaire à l'analyse en deux temps de B.8.

Le profil exporté est donc : activité, rythme, objectifs, contraintes de temps, domaines actifs, et
rien de nominatif. Chaque champ garde sa case, décochable.

**Ce que je te demande** : d'accord pour un pseudonyme aléatoire stable, non dérivé du nom ?

---

## 5. L'initialisation allégée pour les données existantes

Le site est en usage depuis cinq mois. À la prochaine ouverture, l'initialisation doit être **courte
et préremplie**, sans rien perdre.

Ce que je peux déduire sans rien inventer, et que je proposerai **affiché comme déduit** :

| Champ | Déduit de |
|---|---|
| `concours` | le parcours INSP, seul actif |
| `matieresFortes`, `matieresFaibles` | les notes de niveau déjà estimées, là où il y a assez d'observations |
| `joursTravail` | les jours de la rotation de planification déjà réglée |
| `lever`, `coucher` | les heures réelles d'usage du site, sur les trente derniers jours |
| `heuresRevision` | la moyenne hebdomadaire mesurée |
| `domainesActifs` | Cognition et Connaissances, les seuls alimentés aujourd'hui |

**Rien n'est écrit sans confirmation**, et chaque valeur porte « observé » plutôt que « déclaré » :
une valeur devinée présentée comme déclarée est un mensonge qui dure des mois. Le prénom reste la
seule question obligatoire, et c'est la seule que je ne peux pas deviner.

**Ce que je te demande** : d'accord pour ces six préremplissages, affichés comme déduits et soumis à
confirmation ?

---

## 6. La durée de relecture périodique

Le prompt propose **six mois**. Je le retiens, avec une réserve de forme : la relecture ne doit pas
être une fenêtre qui bloque l'entrée, mais une **carte au menu** — « Ces informations sont-elles
toujours justes ? » — qu'on ouvre quand on veut et qui se reporte.

Et une exception utile : un **changement observé qui contredit une déclaration** déclenche la
question **sans attendre** six mois, mais une seule fois, et sous le même plafond d'une proposition
par semaine. Attendre avril pour demander si l'on travaille toujours le lundi, quand les six
derniers mois disent le contraire, serait absurde.

**Ce que je te demande** : six mois, avec la relecture en carte et l'exception sur contradiction
observée ?

---

## Et une septième question, qui n'est pas dans ta liste

Le plan (`plan.md`, section 1.3) signale que la **synchronisation intégrale de la section 0.2 n'est
pas tenue aujourd'hui** : les faits de domaine ne sont pas journalisés, donc ils ne voyagent pas, et
la vérification des chiffres cités (B.6.4) répondrait « non vérifiable » presque partout. J'ai
proposé une **phase A** préalable pour les journaliser, avec un socle pour l'existant.

Elle n'est pas dans ta partie C, et elle ajoute un chantier avant le profil.

**Ce que je te demande** : je la place en préalable, comme proposé ? Ou je commence par le profil et
le menu — ce qui est visible tout de suite — et la phase A arrive juste avant les synthèses ?
