# Prompt 35 — compte rendu

Six phases, six commits. Ce qui est fait, ce qui ne l'est pas, ce qui reste.

## Ce qui est fait

| Phase | Commit | Livré |
|---|---|---|
| 1 | `f7ede26` | Socle de clés : la clé du coffre encapsulée, l'enveloppe non extractible dans IndexedDB, renouvelée à chaque ouverture |
| 2 | `7a91806` | Témoin permanent dans l'en-tête, les deux cases, fermeture possible depuis n'importe quelle page |
| 3 | `6d49454` | Session multi-onglets par relais en mémoire, sans passer par le disque |
| 4 | `3d353a5` | Finances dans l'analyse globale, manque nommé coffre fermé |
| 5 | `0ec3580` | Export pour une IA : les branches sous coffre exclues sans leur case |
| 6 | *(celui-ci)* | Tableau « ce que ce choix protège », et ce compte rendu |

Cinq essais nouveaux : `coffre-session`, `coffre-temoin`, `coffre-onglets`,
`coffre-analyse`, `export-coffre`. `astro check` à **9 erreurs** — la ligne de
base exacte — à chacune des six phases.

## Ce qui a été mesuré, et non supposé

**Le cycle de vie du coffre**, sur le site construit, deux tailles d'écran,
résultats identiques : navigation et rechargement ne redemandent rien ; un
nouvel onglet hérite par le relais ; un contexte sans donneur redemande.

**La compatibilité des données**, pour de bon et non par raisonnement : build
de la version précédente, note scellée dans un profil persistant, build de la
nouvelle, relecture du même profil. La note est relue ; le stockage de
l'onglet passe de 32 octets (la clé brute) à 40 (son chiffré).

**Le relais a été saboté** pour vérifier que son essai savait échouer. C'était
nécessaire : si Playwright avait partagé `sessionStorage` entre les pages d'un
contexte, l'essai aurait été vert **sans aucun relais**.

## Ce qui n'est pas fait, et pourquoi

- **Médicaments et statut hormonal** n'entrent pas dans l'analyse : décision 3
  d'Alexis, ils accompagneront le lot Santé.
- **La catégorie d'export « Corps et santé »** reste sans émission, pour la
  même raison.
- **Aucune capture** n'accompagne ce lot. Le prompt en demande ; les données
  synthétiques du coffre ne sont pas outillées à ce jour, et je préfère
  l'écrire que de livrer des captures d'écrans vides.

## Trois écarts constatés, portés ici plutôt que corrigés en silence

1. **`/odyssee/` ne rend pas les manques** de l'état du jour ; seul
   `tendances.astro` les affiche. Le manque « Finances, coffre fermé » existe
   donc dans l'agrégat sans être vu sur le tableau de bord. Mon contrôle
   prouve que la page n'échoue pas, **pas** qu'elle le dise.
2. **`qui-lit-mon-budget.astro` ouvre le coffre sans porter de formulaire** :
   il appelle `ouvrirLeCoffre` mais n'a pas de bloc `coffre-ferme`. Les dix
   pages sous coffre ne sont donc pas neuf plus une, mais neuf formulaires et
   une page qui dépend d'ailleurs.
3. **`essais:instantane` est rouge**, et il l'était avant : vérifié à
   l'identique en retirant mes modifications. Préexistant, sur un bloc de
   migration sans rapport.

## Une décision de conception, signalée et non glissée

Le **verrouillage explicite de la session efface aussi la mémorisation** sur
l'appareil. Le prompt distingue « Fermer » d'« Oublier » et ne dit rien du
verrou de session. Laisser le coffre se rouvrir sans mot de passe après avoir
tout verrouillé dirait le contraire de ce que ce bouton promet.

## Une erreur de ma part, et ce qu'elle a coûté

La phase 4 a fait entrer Finances dans l'agrégat — et, du même coup, dans
l'export, **sans aucune case cochée**. Mon plan annonçait pour la phase 5
« ajouter l'émission » des catégories sensibles : c'était un contresens. Il
n'y avait rien à ajouter, il y avait une porte à refermer. Elle l'a été, et
un garde structurel interdit désormais tout appel à `rassembler()` sans liste
de branches dans le module d'export.

Entre la phase 4 et la phase 5, l'export pouvait donc emporter des données du
coffre sans geste explicite. Rien n'a été publié dans cet intervalle.
