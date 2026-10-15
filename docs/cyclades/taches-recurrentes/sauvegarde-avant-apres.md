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

## Après

*(à remplir une fois la phase 2 écrite, avec le même protocole et le même
tableau.)*
