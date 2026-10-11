# Renommage en Cyclades : ce qui change de nom, et ce qui n'en change pas

Le produit s'appelle **Cyclades**. Ce qui s'appelait RevINSP en est la branche
**Révisions**, désignée « Cyclades · Révisions ».

## Ce qui change

| Élément | Avant | Après |
|---|---|---|
| Nom affiché (`site.config.mjs`, `titre`) | « Espace de révision » | « Cyclades » |
| En-tête de page | « 🎓 Espace de révision » | « 🎓 Cyclades · Révisions » |
| Titre de l'onglet | « Accueil · Espace de révision » | « Accueil · Cyclades » |
| Titre du README | « Espace de révision personnel » | « Cyclades » |
| Structure | une application | trois branches, dont une disponible |
| Branche Révisions | un seul programme, implicite | quatre parcours déclarés |

## Ce qui ne change pas, et pourquoi

**Aucun nom de stockage n'est renommé.** La base IndexedDB s'appelle toujours
`revinsp`, et les clés de `localStorage` gardent le préfixe `revinsp.`.

Le gain d'un renommage serait cosmétique et invisible : personne ne lit le nom
d'une base IndexedDB. Le coût, lui, serait réel et immédiat — une migration de
seize magasins et de onze clés, qui doit réussir du premier coup sur la seule
installation qui compte, celle où vivent cinq mois de progression. Chaque
magasin manqué par la migration serait une perte silencieuse : l'application
repartirait de zéro sur ce magasin sans rien signaler, puisqu'une base vide est
un état parfaitement normal au premier lancement.

Les noms de stockage sont donc traités comme ce qu'ils sont : des identifiants
internes, dont la stabilité vaut plus que la cohérence avec le nom du produit.

### La table de correspondance

Noms stockés, et ce qu'ils portent. Le préfixe se lit « historique », pas
« RevINSP ».

| Nom stocké | Nature | Ce qu'il porte |
|---|---|---|
| `revinsp` | base IndexedDB | les seize magasins de progression |
| `revinsp.cle` | localStorage | la clé de session dérivée du mot de passe |
| `revinsp.theme` | localStorage | clair, sombre ou système |
| `revinsp.parcours` | localStorage | le parcours ouvert (nouveau) |
| `revinsp.assistant.intention` | localStorage | le dernier préréglage de « Demander à l'IA » |
| `revinsp.assistant.options` | localStorage | les cases cochées du prompt |
| `revinsp.assistant.avertissement-vu` | localStorage | l'avertissement a été lu |
| `revinsp.bibliotheque.sections` | localStorage | sections dépliées de la bibliothèque |
| `revinsp.vue-fiche` | localStorage | cours complet ou fiche simplifiée |
| `revinsp.podcast.position` | localStorage | position de lecture audio |
| `revinsp.nback.reglages` | localStorage | réglages du quad n-back |
| `revinsp.temps-en-attente` | localStorage | reliquat de temps non encore versé en base |
| `revinsp:deverrouille` | événement DOM | la session vient d'être déverrouillée |
| `revinsp:verrouille` | événement DOM | la session vient d'être verrouillée |
| `revinsp:theme` | événement DOM | le thème a changé |
| `revinsp:rr:tutoriels` | localStorage | tutoriels vus de Relational Reasoning |
| `revinsp-progression` | format d'export | en-tête des sauvegardes de progression |
| `revinsp-veridical` | format d'export | en-tête des exports Veridical Mapping |

**Un nouveau nom suit la nouvelle convention** quand il ne touche pas à
l'existant : `cyclades:parcours` est l'événement émis au changement de parcours.
Le mélange est assumé — un préfixe cohérent ne vaut pas de casser une donnée.

### Le format de sauvegarde

`revinsp-progression` reste l'en-tête des sauvegardes actuelles, et l'import
continue de le refuser s'il ne le trouve pas. Le format `.cyclades` de la phase 2
est un format **nouveau**, qui n'a pas à relire celui-ci : les deux coexisteront,
et l'ancien restera importable aussi longtemps qu'il existera des sauvegardes
écrites avec lui.
