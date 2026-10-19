# Décisions du 19 octobre 2026 — les trois points, tranchés

Liste « à trancher », tenue pendant la correction des vingt rouges
préexistants de la batterie. Chaque point était diagnostiqué : ce qui
manquait était une décision, pas un diagnostic.

**Les trois ont été tranchés par le pilote le 19 octobre 2026, au titre de la
délégation d'Alexis.** Chaque section porte la décision, ce qu'elle implique,
et ce qu'elle coûte quand elle contredit une règle antérieure — je ne tais
pas ce genre de conséquence.

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
### Tranché le 19 octobre par le pilote

- **Prendre le texte exact de la source déjà au dépôt**, celle que cite
  l'échelle. S'il n'y a qu'une source anglaise — Kroenke et coll., 2001,
  « moderately severe » —, afficher **« modérément sévère »**, avec dans
  l'aide la mention « traduction non validée, source : Kroenke 2001 ».
  L'essai doit faire citer la source, et ne porter aucun mot choisi au jugé.
  **Les seuils ne changent pas.**
- La validation française du PHQ-9 est déjà demandée à Alexis (D8) ; son
  libellé remplacera celui-ci quand elle arrivera.
- **Ce que cette décision coûte, et il faut le dire.** `essais:echelles:ecran`
  porte aujourd'hui l'assertion « aucune graduation française n'est
  employée », qui refuse `modéré|sévère|léger`. Afficher « modérément
  sévère » la met en contradiction : elle sera remplacée par un contrôle qui
  exige la mention de traduction non validée ET la citation de la source,
  c'est-à-dire ce qui protégeait vraiment — qu'un libellé français ne passe
  pas pour une citation validée. Ce n'est pas un assouplissement : l'essai
  demandera davantage qu'avant, mais autre chose.

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
### Tranché le 19 octobre par le pilote

- Le garde-fou ne doit écarter qu'un **double appui sur le même contrôle avec
  les mêmes données**, et cela **en silence** : c'est le comportement
  attendu, et le silence est donc entériné pour ce cas.
- **Deux gestes différents passent tous les deux, même à moins de 600 ms** :
  deux ajouts de textes distincts, deux boutons différents. Si `unSeulGeste`
  est global aujourd'hui, c'est un défaut à corriger — le repos devient local
  au contrôle ET à sa charge.
- Un essai doit le constater dans les deux sens : un double appui est écarté,
  deux ajouts distincts sont tous les deux écrits.
- **Ce que j'ai constaté dans le code**, et qui confirme le défaut : le repos
  est aujourd'hui indexé par le seul contrôle (`finiA`, une `WeakMap` sur
  l'élément — `src/lib/geste.ts`). Deux ajouts de titres distincts sur le même
  formulaire tombent donc dans le même repos. C'est exactement le cas que la
  décision veut voir passer.

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
### Tranché le 19 octobre par le pilote

- **Ma recommandation est retenue.** Bibliothèque vide, le formulaire est
  remplacé par la phrase « Aucun exercice dans votre bibliothèque pour
  l'instant. » et le lien « Ajouter un exercice », qui mène à Exercices.
- Un essai couvre ce cas, et la correction fait **un commit à part**.
