# Prompt 32 — le relevé d'avant, et ce qui me manque

Fait le 15 octobre 2026, après la livraison du prompt 38. Rien n'est
construit : ce document est un **état des lieux**, écrit avant d'avoir le
texte du prompt, pour que la construction parte de ce qui existe plutôt que
de ce que j'imagine.

## Ce qui me manque, et c'est bloquant

**Le texte du prompt 32 n'est pas dans le dépôt.** `audit/prompts/` contient
cinq prompts ; aucun ne concerne les notifications. Les seules traces du lot
sont des renvois écrits par d'autres lots :

| Où | Ce qui est dit |
|---|---|
| `docs/cyclades/revue/plan.md:22` | « Seul `src/lib/sync/notification.ts` existe. Aucun centre de notifications : le prompt 32 n'est pas construit. » |
| `docs/cyclades/revue/plan.md:98` | Un seul rappel regroupé (« 3 revues en attente »), **sur 7 jours au plus**, dans la liste d'Odyssée et sur l'accueil **dès maintenant** ; dans le centre **quand il existera**. |
| `audit/decisions/…prompts-31-36.md:61` | Même règle pour les oublis. |

Construire « le centre de notifications » sans son texte reviendrait à en
inventer la spécification — ce qui est précisément le cas où je dois
m'arrêter. Je m'arrête donc ici, et pas avant : le relevé ci-dessous ne
dépendait pas de lui.

## Ce qui existe

### Le transport — `src/lib/sync/notification.ts`, 122 lignes

Une couche mince, et honnête sur ce qu'elle est :

- `etatPermission()` rend `accordee | refusee | a-demander | indisponible` ;
- `demanderPermission()` ;
- `enregistrerServiceWorker()` ;
- `avertir(avis)` où `Avis` porte `titre`, `corps`, `vers` (le chemin du
  clic) et `marque` (le `tag`, pour ne pas empiler deux fois la même) ;
- `avertir()` **ne lève jamais** : une notification qui échoue ne doit pas
  faire paraître échouée l'opération qui l'a déclenchée. Elle rend `false`.

**Ce n'est pas un centre de notifications.** C'est un émetteur, sans file,
sans historique, sans écran, sans regroupement et sans réglage par source.

### Les producteurs de rappel déjà écrits

Deux, et ils ne se connaissent pas :

| Module | Ce qu'il rend |
|---|---|
| `noyau/coffre.ts:591` — `rappelDeSauvegarde()` | Un `RappelDeSauvegarde` avec quatre degrés d'insistance (`aucune`, `discrete`, `insistante`, `urgente`), au-delà de 14 jours sans sauvegarde. |
| `odyssee/moment-revue.ts:132` — `rappelDeRevue()` | Une phrase, ou `null`. C'est déjà le « rappel regroupé » voulu par la décision du 15 octobre. |

### Le réglage déjà au profil

`heureRappel` — « À quelle heure voulez-vous être relancé, si vous le
voulez ? ». Champ de branche (`odyssee`), nature `heure`, portée `toutes`.
Il existe, personne ne le lit.

## Les quatre questions que le prompt devra trancher

Je les note maintenant pour ne pas les redécouvrir à mi-parcours, et parce
qu'elles décident de la forme du lot :

1. **Le centre est-il une page, un panneau, ou les deux ?** Les deux rappels
   existants s'affichent aujourd'hui dans le flux des écrans, pas dans un
   lieu à eux.
2. **Qu'est-ce qui est gardé, et combien de temps ?** Un centre sans
   historique est une liste qui se vide ; un centre avec historique est un
   magasin de plus, donc une ligne de rétention et une ligne d'effacement.
3. **Une notification du système sort-elle de l'appareil ?** Non, techniquement
   — mais elle affiche un texte sur un écran verrouillé. Une notification
   venue d'une branche sous coffre ne doit donc pas porter son contenu, et
   c'est la même règle que le libellé neutre du prompt 38.
4. **Qui décide de l'insistance ?** `rappelDeSauvegarde()` a déjà ses quatre
   degrés. Soit le centre les reprend, soit il impose les siens — et alors
   deux échelles coexistent.

## Ce que je ne fais pas

Je ne commence aucune construction. Je ne touche ni à
`sync/notification.ts`, ni aux deux producteurs, ni au champ `heureRappel`.
