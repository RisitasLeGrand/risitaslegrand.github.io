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
### Tranché le 19 octobre, en deux temps

**Premier temps.** Le pilote a décidé de traduire le palier en français,
puis les cinq paliers, avec la mention « traduction non validée ».

**Second temps : il a retiré cette décision**, après que je lui ai montré ce
que je n'avais pas vu moi-même en la lui signalant d'abord comme une simple
assertion d'essai — `src/lib/odyssee/echelles.ts` porte un contrôle qui
**refuse toute étiquette accentuée**, avec sa raison écrite : « traduites,
elles cesseraient d'être une citation pour devenir un jugement ». Le même
commentaire rappelle que « léger », « modéré » et « sévère » sont refusés
ailleurs dans Psyché par `MOTS_INTERDITS`. La garde est donc restée entière,
le GAD-7 n'a pas bougé, et l'exception déclarée que je proposais n'a pas été
retenue — ce qui est le bon choix tant qu'aucune source française validée
n'existe.

**Ce que le rouge cachait vraiment, et personne ne l'avait vu.** Le désaccord
n'était pas entre le code et le manuel : il était **entre deux essais du
dépôt**. `essais:echelles.mts`, contrôle 4.5, exige « Moderately Severe »
et écrit pourquoi — « la casse est celle de la table 4 du manuel, qui écrit
"Moderately Severe" sur deux lignes ; la phrase en prose du manuel écrit la
même chose en minuscules ; comme le module cite la table, c'est la casse de
la table qui fait foi ». `essais:echelles:ecran` attendait la minuscule,
sans raison écrite. **C'est l'essai d'écran qui avait tort**, et c'est lui
qui a été corrigé : le code n'a pas changé d'un caractère.

**Ce qui reste, et que je ne tais pas.** Le manuel d'instructions du PHQ-9
n'est pas dans `sources/`. Ce qui est constaté est l'accord du code avec
l'essai et avec la raison écrite au contrôle 4.5, non l'accord avec le
document lui-même. Déposer ce manuel dans `sources/` fermerait la question
pour de bon ; c'est le geste d'Alexis.

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

## 4. Les créneaux marqués déjà écrits : le correctif est prospectif

- **Le défaut, mesuré le 19 octobre.** `odysseeCreneaux` déclarait
  `CHAMP_DATE` à `jour` et `clairs: ['id', 'majLe']`. Or `dateDe` lit le
  champ nommé sur la ligne **brute**, telle que `getAll` la rend, donc avant
  tout déchiffrement : `jour` étant à l'intérieur du scellé, `dateDe` rendait
  `null`, `dansLaPeriode` rendait `false`, et un effacement par période
  passait à côté de **chaque** créneau en annonçant « 0 visé ». Un effacement
  qui se dit fait et qui n'efface rien. Un seul magasin sur les vingt-huit
  scellés était dans cet état.
- **Ce qui est appliqué.** `clairs: ['id']` — `majLe` part à l'intérieur du
  scellé, où il voyage chiffré : plus en clair n'est pas plus transporté.
  `CHAMP_DATE` à `null`. Le découpage par période vit désormais dans le module
  qui a la clé (`effacerLesMarquesDeLaPeriode`), que le mécanisme générique
  appelle par `DECOUPAGES_DE_MODULE`. Coffre fermé, le magasin est laissé
  entier et l'écran dit **pourquoi** : « ses dates sont scellées », et non
  « un état courant et non un historique », qui aurait été faux.
- **CE QUI RESTE EN ATTENTE, ET C'EST UNE QUESTION POUR ALEXIS.** Le
  correctif est **prospectif**. Une migration de schéma ne peut pas le
  rattraper : la clé du coffre ne vit qu'en mémoire, et un `upgrade` ne peut
  ni lire ni réécrire un champ scellé. Les créneaux **déjà écrits** gardent
  donc leur `majLe` en clair à côté du scellé jusqu'à leur prochaine
  écriture. La lecture ne change pas — `ouvrir()` fusionne le clair et le
  déchiffré, donc les deux formes se relisent, et l'effacement par période
  les atteint toutes les deux, puisqu'il lit le jour **déchiffré**.
- **Les trois issues, et celle qui est retenue.**
  - **A — prospectif seulement.** Retenue par le pilote, et appliquée. Ce qui
    est déjà écrit reste tel quel, et c'est dit ici plutôt que tu.
  - **B — réécriture silencieuse au premier coffre ouvert.** **Refusée par le
    pilote.** Réécrire les enregistrements de quelqu'un sans le lui dire, au
    détour d'une ouverture de coffre, est précisément ce qu'on ne fait pas.
  - **C — une passe explicite, derrière une sauvegarde confirmée.** Soumise à
    Alexis, et **non écrite** avant sa réponse. Elle demanderait : une
    sauvegarde chiffrée confirmée, puis la réécriture des créneaux à la forme
    neuve, annoncée et dénombrée à l'écran.
- **Question jointe : les sauvegardes non chiffrées.** Une sauvegarde sans
  mot de passe emporte les lignes telles qu'elles sont en base. Le scellé y
  reste scellé ; ce qui sort en clair, c'est ce que `clairs` nomme. Après ce
  correctif, pour les créneaux, c'est **la clé opaque et rien d'autre** —
  avant, c'était aussi la date d'écriture, donc le rythme. La question reste
  entière et elle n'est pas tranchée : un magasin scellé a-t-il sa place dans
  une sauvegarde non chiffrée ? Je ne l'en retire pas de moi-même.
- **Le garde-fou qui manquait est posé.** `essais:schema` balaie désormais
  les vingt-huit magasins scellés : pour chacun, `CHAMP_DATE` vaut `null` ou
  nomme un champ présent dans `clairs`. C'est l'assertion qui aurait attrapé
  ceci à la seconde où elle aurait existé, et elle est rouge sur l'état
  d'avant — vérifié avant de corriger, pas après.
