# Décisions en attente — 19 octobre 2026

Liste « à trancher », tenue pendant la correction des vingt rouges
préexistants de la batterie. Chaque point est diagnostiqué : ce qui manque
est une décision, pas un diagnostic.

## 1. PHQ-9 : « Moderately Severe » ou « Moderately severe » ?

- **Où.** `src/lib/odyssee/echelles.ts:198` écrit l'étiquette de la tranche
  15-19 avec un S majuscule : `'Moderately Severe'`. L'essai
  `essais:echelles:ecran` attend un s minuscule : « Moderately severe ».
- **Pourquoi c'est une décision et non un défaut.** Les deux prétendent
  citer le manuel, et la règle du projet est de citer la source dans sa
  langue, sans la retoucher. Je ne peux pas trancher sans le manuel sous les
  yeux : les éditions diffèrent sur cette capitale, et choisir au jugé
  reviendrait à inventer une citation — exactement ce que la règle interdit.
- **Conséquence tant que ce n'est pas tranché.** `essais:echelles:ecran`
  reste rouge sur cette seule assertion, avec son diagnostic au tableau. Les
  autres contrôles de l'essai passent, dont « aucune graduation française
  n'est employée » et « la phrase cite le manuel au lieu de juger ».
- **Ce qu'il suffit de dire.** L'orthographe exacte de l'étiquette dans le
  manuel PHQ-9 retenu comme source. Je corrige alors le côté qui se trompe,
  et l'essai redevient vert.

## 2. Un geste délibéré refusé par le garde-fou du rebond ne dit rien

- **Où.** `src/lib/geste.ts` impose 600 ms de repos après un geste abouti,
  contre le doigt qui glisse et écrit deux fois. Pendant ce repos, un second
  appui est ignoré **en silence**.
- **Ce qui est déjà corrigé.** Le repos ne s'applique plus après un geste
  REFUSÉ (commit du 19 octobre) : la correction qui suit un refus passe
  désormais. Trois écrans en bénéficient.
- **Ce qui reste en question.** Deux gestes délibérés et distincts à moins
  de 600 ms — c'est rare à la main, mais possible au clavier — sont refusés
  sans un mot. Le silence est juste pour un rebond ; il contredit « un échec
  est dit, jamais avalé » pour un geste voulu. Trancher : laisser le silence
  (et l'écrire comme une exception à la règle), ou dire quelque chose de
  discret au second appui.
- **Aucun essai n'est rouge là-dessus** : `essais:tendances:navigateur`
  attend maintenant comme une main attendrait. Le point est noté pour que le
  silence reste un choix, et non un oubli.
- **Trois essais de plus l'ont rencontré le 19 octobre**, et c'est ce qui
  donne la mesure du silence : `essais:listes` enchaînait trois ajouts de
  tâche à 250 ms et n'en créait qu'un ; `essais:sport:navigateur` créait deux
  exercices coup sur coup et n'en créait qu'un ; `essais:sport:navigateur`
  encore, pour deux séries. Dans les trois cas le clic avait lieu,
  l'événement « submit » avait lieu, et **rien ne s'écrivait sans qu'un mot
  soit dit** — j'ai dû l'instrumenter pour le voir. Le garde-fou a raison sur
  le fond ; c'est son mutisme qui coûte une demi-heure à qui le rencontre.

## 3. Une séance de sport ouverte sans aucun exercice en bibliothèque

- **Où.** `src/pages/sport/seance.astro`, `peindreChoixExercice()`. Le
  `<select id="exercice">` est `required` et se peint depuis la bibliothèque.
  Bibliothèque vide : zéro `<option>`, et le navigateur refuse la soumission
  du formulaire. L'écran, lui, ne dit rien — ni « ajoutez d'abord un
  exercice », ni un lien vers la bibliothèque.
- **Comment c'est apparu.** `essais:sport:navigateur` supprimait le seul
  exercice qu'il venait de créer, puis ouvrait une séance : quinze secondes
  d'attente pour une série qui ne pouvait pas s'écrire. L'essai est corrigé
  (il garde de quoi tenir une séance), mais le cas reste atteignable à la
  main : une bibliothèque qu'on vide, ou une installation neuve dont la
  bibliothèque fournie n'a pas été posée.
- **Pourquoi je ne le corrige pas de moi-même.** C'est une anomalie
  nouvelle, et la règle du §4.2 veut qu'elle devienne une ligne du tableau
  suivant plutôt qu'un correctif glissé dans un lot qui ne la vise pas.
- **Ce qu'il suffit de dire.** Si l'écran doit, bibliothèque vide, remplacer
  le formulaire par une phrase et un lien vers « Exercices » — ce que je
  recommande —, ou laisser le refus natif.
