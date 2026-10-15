# Phase 2 — l'essai de sauvegarde et de restauration, avant et après

*La condition qu'Alexis a attachée au « go » de D2 : « Go, avec un essai de
sauvegarde et de restauration avant et après. » Elle n'est pas une formalité,
et ce document est la preuve qu'elle a été tenue dans l'ordre — la mesure
« avant » précède la première ligne touchant `noyau/enregistrements.ts`.*

## Avant — 15 octobre 2026, commit `19ca19c`

Build complet (`npm run build`, index de recherche présent, 464 Mio), aperçu
sur le port 4321, navigateur réel.

| Essai | Résultat |
|---|---|
| `essais:sauvegarde:cyclades` — l'aller-retour du format chiffré | **vert** |
| `essais:sauvegarde` — la sauvegarde et sa relecture | **vert** |
| `essais:sauvegarde:format` — le format du fichier | **vert** |
| `essais:instantane` — l'instantané avant migration | **rouge, 1 échec** |

### Ce que dit le rouge, et pourquoi il compte pour la phase 2

L'échec n'est pas dans la sauvegarde : c'est l'assertion « et tous les
magasins sont là : le premier bloc de migration n'a pas sauté ». Elle compare
la liste réelle des magasins à une **liste écrite en dur dans l'essai**, et
cette liste est périmée de **deux entrées** : `actualitesLues` et
`odysseeConditions` existent dans la base et manquent dans l'attendu.

C'est un défaut **antérieur à ce lot**, et il était déjà consigné. Mais il
cesse d'être anodin ici : la phase 2 déclare trois magasins nouveaux, donc
elle allongera cette même liste. Deux conséquences, écrites d'avance pour
qu'on puisse vérifier que je les ai tenues :

1. la phase 2 **doit** ajouter `odysseeOccurrences`, `odysseeEtapesCochees` et
   `odysseeReports` à l'attendu, sans quoi l'essai reste rouge et ne dit plus
   rien ;
2. elle ajoutera **aussi** les deux entrées manquantes, et c'est une
   correction **déclarée, pas silencieuse** (§4.2) : un contrôle rouge pour une
   raison périmée est un contrôle qu'on apprend à ignorer, et un contrôle
   qu'on ignore ne protège plus rien.

## Après — 15 octobre 2026, commit `1106f13`

Même protocole, à la lettre : build complet depuis zéro, `.env.local` écrit
puis supprimé et son absence vérifiée, aperçu **relancé** sur le `dist` neuf
— un serveur laissé debout aurait servi l'ancien, et la mesure « après »
aurait porté sur l'« avant ».

| Essai | Avant | Après |
|---|---|---|
| `essais:sauvegarde:cyclades` | vert | **vert** |
| `essais:sauvegarde` | vert | **vert** |
| `essais:sauvegarde:format` | vert | **vert** |
| `essais:instantane` | **rouge** | **vert** |

**La condition de D2 est tenue** : la sauvegarde et la restauration passent
avant comme après le changement de schéma, et le quatrième essai, lui, est
passé du rouge au vert.

## Ce que j'avais annoncé, et ce qui s'est réellement passé

J'avais écrit, avant d'ouvrir le code, que la phase 2 devrait ajouter mes
trois magasins — quatre en fin de compte — **et les deux entrées déjà
manquantes**.

**Il y en avait sept, pas deux.** J'avais lu une sortie d'essai tronquée à
l'écran et compté les premières lignes au lieu de comparer les deux
ensembles. Le relevé exact, fait cette fois par différence :

| Magasin | Absent de la liste depuis |
|---|---|
| `odysseeTraitements` | version 29 |
| `odysseePrelevements` | version 29 |
| `odysseeResultats` | version 29 |
| `odysseeSymptomes` | version 29 |
| `odysseeConditions` | version 29 |
| `odysseeRessentis` | version 30 |
| `actualitesLues` | version 31 |

**Trois versions de schéma consécutives sont passées sans que ce contrôle
soit tenu à jour.** Il était donc rouge depuis la 29, et rouge pour une
raison qui n'avait rien à voir avec ce qu'il prétend vérifier — exactement
l'état dans lequel un contrôle cesse d'être lu.

Deux choses en découlent, et je les écris plutôt que de les garder :

1. **Ma propre méthode a failli d'abord.** J'ai annoncé un chiffre tiré d'un
   coup d'œil sur une sortie tronquée, dans le document même qui servait de
   preuve. Le chiffre juste vient d'une comparaison d'ensembles, écrite et
   rejouable ; c'est elle qui aurait dû venir en premier.
2. **Une ligne pour le tableau suivant** : rien n'oblige aujourd'hui à tenir
   cette liste. Elle est recopiée à la main dans l'essai, et rien ne compare
   le schéma réel à ce que l'essai attend tant que personne ne lance l'essai
   sur une base neuve. Un contrôle qui dérive en silence pendant trois
   versions est un défaut du contrôle, pas de ceux qui ont oublié.

## Une observation qui touche D1 et D7

`odysseeTraitements`, `odysseePrelevements`, `odysseeResultats`,
`odysseeSymptomes` et `odysseeConditions` existent dans le schéma depuis la
version 29. Autrement dit, **une part de la phase 1 de Santé a bel et bien
été livrée** — ce qui recoupe la contradiction que j'ai signalée au pilote et
qui n'est toujours pas levée : la tâche #170 dit les phases Santé en attente
d'accord, et le code en porte déjà une partie.

Je ne tranche pas, et je n'ai rien écrit dans Santé. C'est un constat, daté,
pour la décision D7 — « faire constater ce qui reste de la phase 1 ». En
voici le premier élément.
