# Prompt 43, lot E — clavier, états annoncés, alternatives

**Établi le 19 octobre 2026, branche `claude/p43-e`, partie de `origin/main`
à `5d74855`.**

## En tête : ce que le lot a trouvé

**Trois des quatre points touchent des fichiers que des branches non fusionnées
retiennent.** Mesuré avant d'écrire une ligne : E5 vit dans `flashcards.astro`,
que `claude/p43-f` modifie ; E9 dans `QuadNBack.svelte`, que `claude/p51`
modifie ; et le morceau QCM DGFiP de E7 dans `quiz/dgfip.astro`, qui est à
l'agent C. La règle est qu'un fichier ne vit que sur une branche à la fois :
ces points attendent les fusions, et le pilote a retenu cet ordre.

**Le défaut de E6 est pire que ce que l'audit en dit.** Le constat parle d'un
rechargement « dès le choix ». Or une liste déroulante se parcourt au clavier,
et sur la plupart des navigateurs chaque flèche sur une liste fermée change la
valeur : explorer les parcours à la flèche changeait le parcours préparé et
rechargeait tout le site, sans jamais atteindre le second choix.

**Un rôle qui ment coûte plus cher que pas de rôle du tout.** Trois conteneurs
annonçaient `role="tablist"` sans porter un seul onglet. Un lecteur d'écran
annonçait « liste d'onglets », puis n'y trouvait rien.

## Ce que chaque point est devenu

| Point | État | Ce qui a été fait |
|---|---|---|
| **E5** cartes de révision | **en attente** | `flashcards.astro` est retenu par `claude/p43-f`. À faire après sa fusion. |
| **E6** sélecteur de parcours | fait | Choisir et appliquer séparés ; `Base.astro` pas touché d'une ligne. |
| **E7** états annoncés | fait, sauf le QCM | Deux faux `tablist` de « À rapprocher », un des Actualités, et les quatre cases « noter » de Psyché. Le QCM DGFiP attend la fusion de `claude/p43-dc`. |
| **E9** curseurs du Quad N-Back | **en attente** | `QuadNBack.svelte` est retenu par `claude/p51`. À faire après sa fusion. |

## Les décisions que j'ai prises, et pourquoi

**E7b — pas de vrais onglets aux Actualités, et ce n'est pas une facilité.**
Le pilote m'a laissé trancher avec une règle : vrai `tablist` complet si les
boutons changent de vue sur une même région nommée, groupe à `aria-pressed`
sinon. J'ai regardé ce que ces cinq boutons gouvernent — et la liste d'en bas
est aussi changée par la recherche, par les filtres de domaine et par la barre
de période. **Un panneau d'onglet appartient à son onglet ; celui-ci appartient
à quatre commandes.** L'annoncer comme un panneau d'onglet aurait été un second
mensonge, plus poli que le premier. Ce sont donc cinq boutons à deux états dans
un groupe nommé — exactement comme les filtres de domaine juste en dessous,
qui, eux, étaient déjà justes. Deux rangées qui se ressemblent se comportent
désormais pareil.

**E7a — les filtres de « À rapprocher » ne sont pas des onglets non plus.** La
file reste la même, on la filtre. Groupe nommé, `aria-pressed` posé **à la
peinture**, avec la couleur : deux endroits qui décident du même état finissent
toujours par se contredire.

**E7c — le mot visible ne change pas.** La dimension entre dans le nom
accessible, par un texte réservé aux technologies d'assistance. Répéter
« noter l'humeur » à côté de « Humeur » aurait alourdi l'écran pour tout le
monde : corriger pour les uns en abîmant pour les autres n'est pas corriger.

**E6 — un bouton, et non une boîte de confirmation.** Une boîte à chaque
`change` aurait surgi à chaque flèche du clavier : le remède aurait repris le
défaut par l'autre bout. Le bouton, lui, ne fait rien tant qu'on ne l'actionne
pas. Il est dans le document dès le départ, caché, parce qu'un élément inséré
dans l'en-tête déplace ce qui l'entoure et peut passer sous le doigt qui visait
autre chose. Son nom accessible dit **vers quoi** il applique.

## Ce que les essais ont mesuré

**Un rechargement ne laisse aucune trace derrière lui.** Pour constater son
ABSENCE, l'essai de E6 pose un marqueur sur la page avant d'agir, et regarde
s'il a survécu. Il lit ensuite la préférence là où elle vit, dans
`localStorage`, et non ce que l'écran en dit.

**Un attribut posé au rendu et jamais remis à jour serait vert au premier
contrôle.** L'essai de E7 actionne donc chaque groupe et vérifie que l'état
pressé a suivi le geste.

**Les noms accessibles sont lus tels que le navigateur les calcule**, par les
sélecteurs de rôle, et non devinés dans la source.

## Mesures

`essais:etats-annonces` — créé par ce lot : 24 contrôles, **16 rouges** sur la
construction d'avant. `essais:parcours-validation` — créé par ce lot : 15
contrôles, rouge sur la construction d'avant, dont les trois qui comptent — la
page s'était rechargée, la préférence avait changé, le bouton n'existait pas.

**Socle complet : 20 verts, 0 rouge (11 min)** sur la construction de
`6c9b800`, et de nouveau sur celle qui porte E6. Le socle compte vingt essais
depuis `4ad0895`, et non seize.

`astro check` : 0 erreur, 0 avertissement.

## Les captures

Prises **avant le premier changement** : 36 images, six écrans aux trois
largeurs du 41 et dans les deux modes, dans `audit/captures/prompt-43-e/avant/`
— hors du dépôt. Les captures d'après sont au même format.

Il faut dire ce qu'elles ne montrent pas : **rien de ce que ce lot corrige n'a
d'aspect.** Un rôle, un nom accessible, une touche qui agit au mauvais endroit
ne se voient pas sur une image. Les captures servent ici à constater
qu'**aucun écran n'a bougé** là où le lot ne corrige que la façon dont il
s'annonce — sauf le bouton « Appliquer » de E6, qui est le seul changement
visible du lot. Le contrôle de débordement, lui, mesure à chaque prise.
