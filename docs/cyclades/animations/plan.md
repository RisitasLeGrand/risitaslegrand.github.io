# Plan — animations et schéma du corps (prompt 34)

**14 octobre 2026.** Plan court soumis à validation. **Rien n'est codé** et rien
ne le sera avant le « go » d'Alexis sur ce document.

## Les six décisions sont closes

| | Décision | Tranchée par |
|---|---|---|
| 1 | Transitions entre pages : View Transitions entre documents, CSS seul | pilote, délégation **confirmée par Alexis le 14 octobre** |
| 2 | Intensité : sobre | idem |
| 3 | Célébrations : discrètes | idem |
| 4 | Interrupteur « Réduire les animations » dans les préférences | idem |
| 5 | Animations explicatives : les trois cas de A7 | idem |
| 6 | **Forme du corps par défaut : simplifiée** | **Alexis, 14 octobre** |

Sur la 6 : Alexis a répondu « simplifiée », sans reprendre la nuance par
appareil que recommandait le pilote. Le défaut est donc **simplifiée partout**,
le choix restant mémorisé et réversible comme le prompt le prévoit.

## Relevé de départ, refait dans l'état réel (`3b9c0af`)

M1 à M4 du prompt : **les quatre constats tiennent**. Vérifié par lecture.
`prefers-reduced-motion` en place (`global.css:317`) ; zéro occurrence de
`ClientRouter`, `ViewTransitions`, `svelte/transition`, `svelte/animate` ;
`schema-corps.ts` à 218 lignes, boîte 200 × 420.

**Un défaut non signalé par le prompt**, que j'ajoute : le bloc M2 neutralise
les **durées** mais pas `animation-iteration-count`. Sous mouvement réduit, une
animation infinie ne s'arrête donc pas — elle s'accélère. Pré-existant, traité
en phase 0, non compté comme une régression de ce lot.

> **Correction du 14 octobre, après mesure.** J'avais d'abord annoncé *deux*
> animations en cause, `Grille.svelte:95` et `QuadNBack.svelte:615`. C'était
> faux pour la première : `Grille.svelte` **se protège lui-même**, lignes 120 à
> 124, par `@media (prefers-reduced-motion: reduce) { .tourne { animation:
> none } }`. J'avais lu la ligne 95 sans lire la 120. `BarreProgression.astro`
> et `Deroule.svelte` ont également leur garde locale. **Une seule** animation
> était réellement exposée : `animate-pulse` sur le bouton de capture de touche
> du quad n-back.
>
> Et le constat n'est plus « lu dans le code » : il est **mesuré**.
> `animation-iteration-count` valait bien `infinite` sous mouvement réduit, sur
> la règle comme sur l'écran réel.

## Ordre des phases, et pourquoi il diffère de l'ordre du prompt

Le prompt liste A6 (cohérence) en sixième position. **Elle passe en premier** :
toutes les autres familles consomment son échelle de durées. Et la phase 6
(schéma du corps) précède la phase 7, parce que le premier cas de A7 allume des
muscles sur ce schéma.

---

## Phase 0 — socle : A6, décision 4, et le défaut du mouvement réduit

- **Technique** : jeton de durées et de courbes dans `global.css` (court 120 ms,
  moyen 200 ms, long 300 ms) ; `animation-iteration-count: 1 !important` ajouté
  au bloc `prefers-reduced-motion` ; extension du script avant peinture de
  `Base.astro:148` — il lit déjà `revinsp.theme`, il lira `revinsp.animations`
  et posera `data-animations` sur la racine. Le plus restrictif du réglage
  système et du réglage d'application s'applique.
- **Fichiers** : `src/styles/global.css`, `src/layouts/Base.astro`, l'écran des
  préférences, nouveau `scripts/essais-mouvement-reduit-navigateur.mjs`.
- **Risque** : l'arrêt des animations infinies touche le quad n-back. Vérifier
  que l'exercice reste jouable sous mouvement réduit, pas seulement qu'il
  cesse de clignoter.
- **Contrôle** : essai de navigateur sous `prefers-reduced-motion: reduce` sur
  les 54 routes. **Il doit être rouge avant le correctif** — sinon il ne mesure
  rien.

## Phase 1 — A1, transitions entre pages

- **Technique** : `@view-transition { navigation: auto }` en CSS seul.
- **Fichiers** : `src/styles/global.css`, `src/layouts/Base.astro`.
- **Le risque est le coffre, et il est précis.** Une transition entre documents
  capture la page sortante. **10 routes sont sous coffre** : `odyssee/corps`,
  `echelles`, `finances`, `mes-regles`, `molecule`, `psyche`,
  `qui-lit-mon-budget`, `rapprocher`, `sante`, `veille`.
- **Réserve de méthode** : je **retire ces 10 routes de la transition**, au lieu
  de poser `view-transition-name: none` sur chaque région sensible. L'interdit
  n° 2 est absolu ; une exclusion de route se prouve d'une ligne, un inventaire
  de régions se re-prouve à chaque écran ajouté.
- **Autres effets à vérifier et à lister** : scripts qui ne se relancent plus,
  connexions IndexedDB, minuteurs du quad n-back et des séances chronométrées,
  centre de notifications, raccourcis clavier, focus et annonce de la nouvelle
  page aux lecteurs d'écran.
- **Contrôle** : essai qui ferme le coffre, navigue, et vérifie qu'aucune donnée
  sensible n'apparaît ni dans la page ni dans la transition ; essai du focus et
  de l'annonce au clavier.

> **Corrections du 14 octobre, après exécution.** Trois, dont deux de mes
> propres erreurs.
>
> 1. **« 11 routes » était faux : il y en a 10.** `bibliographie` figurait dans
>    ma liste parce qu'un relevé antérieur avait retenu son `actif="sante"`.
>    Elle ne porte pas de coffre. Le chiffre est corrigé ci-dessus, et
>    `essais:coffre-transitions` établit désormais la liste depuis la source,
>    dans les deux sens, plutôt que de la recopier.
>
> 2. **Un bogue d'implémentation, invisible et grave.** La règle avait d'abord
>    été écrite dans un `<style>` contenant un littéral de gabarit JSX : Astro
>    a émis la syntaxe du littéral dans la feuille, qui devenait invalide dès
>    le premier caractère. Résultat : **aucune transition nulle part**, et mes
>    deux contrôles « coffre » verts pour la pire des raisons. Corrigé par une
>    constante de frontmatter et `<style is:inline set:html={…} />`.
>
> 3. **Ce que mesure `pageswap`, et ce qu'il ne mesure pas.** Mon essai
>    attendait « aucune transition » au départ d'une page ordinaire vers une
>    page sous coffre, et le relevé donnait « oui ». L'implémentation était
>    correcte, l'assertion fausse : `pageswap` n'atteste que le consentement de
>    la page **sortante**. Seul `pagereveal`, à l'arrivée, dit si la transition
>    s'est jouée. Mesuré :
>
>    | trajet | départ | arrivée |
>    |---|---|---|
>    | ordinaire → ordinaire | oui | **oui** — transition |
>    | ordinaire → sous coffre | oui | **non** — abandonnée |
>    | coffre ouvert → ordinaire | **non** | non — jamais amorcée |
>
>    La deuxième ligne n'est pas une fuite : la photographie annoncée est celle
>    de la page ordinaire. Ce qui protège les données est la troisième.
>    L'essai relève désormais les deux bouts du trajet.
>
> **Et la preuve que les contrôles mesurent.** Déclaration `coffre` retirée de
> `odyssee/psyche.astro`, reconstruit : `essais:coffre-transitions` et
> `essais:transitions:navigateur` virent au rouge tous les deux, ce dernier en
> relevant `{"depart":"oui","arrivee":"oui"}` sur l'écran sensible — la fuite
> exacte qu'interdit le point n° 2. Déclaration restaurée, les deux reviennent
> au vert.
>
> **Un effet à ne pas surestimer.** Les transitions **entre documents** ne
> préservent pas le document : la page entrante est chargée et ses scripts
> rejoués comme à toute navigation. Les risques listés ci-dessus (scripts qui
> ne se relancent plus, connexions IndexedDB, minuteurs) concernent un routeur
> client, pas ce mécanisme. Lu dans la spécification et cohérent avec les
> relevés ; non éprouvé écran par écran.

## Phase 2 — A2, apparition et disparition

- **Technique** : fondu et glissement courts sur menus, panneaux, centre de
  notifications, boîtes de dialogue, messages de confirmation. Fermeture plus
  rapide que l'ouverture.
- **Réserve** : les sections dépliables (`details`) **posent un conflit avec
  l'interdit n° 4**. Animer un dépliage suppose d'animer une hauteur, ce que
  l'interdit proscrit. Deux issues honnêtes : un fondu du contenu **sans**
  animation de hauteur, ou `details` écarté de ce lot. Je propose le fondu seul,
  et je le dirai dans l'inventaire.

> **Phase 2 livrée le 14 octobre. Ce que le relevé a changé au plan.**
>
> **Le vrai obstacle n'était pas dans le plan.** Cyclades montre et cache
> presque tout en basculant `display` — l'attribut `hidden` sur le menu de
> thème, la classe `.hidden` de Tailwind ailleurs, **43 fichiers** au relevé.
> Or `display: none` → `display: block` **ne se transitionne pas**. Une
> transition d'opacité écrite sur un tel élément ne produit rien, tout en ayant
> l'air écrite : le même piège qu'en phase 1, à un étage différent.
>
> La parade, **mesurée avant d'être adoptée** (sonde du 14 octobre, Chromium
> 141) : `transition-behavior: allow-discrete` avec `@starting-style`.
> `transitionrun` s'est déclenché sur `opacity`, à 0,87 d'opacité après 120 ms.
> Sur un navigateur qui l'ignore, l'élément paraît d'un coup — c'est-à-dire
> comme aujourd'hui : la dégradation ne demande aucun repli écrit à la main.
>
> **Et les deux morceaux ne servent pas au même bout du geste.** En retirant
> `allow-discrete` pour éprouver le contrôle, seule la **fermeture** a cassé :
> l'ouverture continuait de fondre. `@starting-style` sert l'apparition,
> `allow-discrete` la disparition. Mon premier commentaire disait les deux ; il
> est corrigé.
>
> **Ce qui est branché** : le menu de thème (fondu et léger glissement), la
> feuille « Plus » de la navigation sur téléphone (fondu seul — un voile plein
> écran qui glisse donnerait le mal de mer), les boîtes de dialogue natives et
> leur fond, et les messages de confirmation. Fermeture à 120 ms contre 200 ms
> à l'ouverture, partout, comme l'A2 le demande.
>
> **`notifier()` animait déjà** — opacité et `translateY`, donc conforme à
> l'interdit n° 4 — mais avec ses durées écrites en dur (300 ms à l'aller comme
> au retour), hors de l'échelle de la phase 0 et sans dissymétrie. La durée vit
> désormais dans la feuille de style et le script la relit par
> `getComputedStyle` : un seul chiffre à tenir, au lieu de deux qui dérivent.
>
> **La réserve sur `details` est tranchée, pas levée.** Le contenu paraît en
> fondu ; la **hauteur ne s'anime pas**, parce que l'interdit n° 4 l'exclut sans
> réserve. La boîte s'ouvre d'un coup, son contenu paraît. Ce n'est pas le
> dépliage fluide qu'on imagine en lisant l'A2, et je préfère l'écrire que de
> contourner l'interdit.
>
> **Le centre de notifications, cible nommée par l'A2, n'existe pas.** Le
> prompt 32 n'est pas construit : aucun fichier, aucun composant. Cette cible
> est donc sans objet aujourd'hui, et je ne l'ai pas inventée pour la cocher.
>
> **Ce qui n'est pas converti, et pourquoi.** Les 43 fichiers qui basculent
> `.hidden` ne le sont pas tous : l'immense majorité échange du contenu
> (onglets, sections conditionnelles, états d'écran), ce que l'A2 ne vise pas.
> Seules les surfaces nommées par le prompt — menus, panneaux, boîtes de
> dialogue, messages — portent le mécanisme. Le mécanisme est une classe
> réutilisable : brancher une surface de plus coûte un mot dans sa liste de
> classes.
>
> **Contrôle** : `npm run essais:apparition`, 19 contrôles. Rouge avant le
> correctif sur 5 d'entre eux (« aucune transition ne démarre », durées à `0s`),
> et rouge de nouveau quand on retire `allow-discrete`.

## Phase 3 — A3, listes qui changent

- **Technique** : `animate:flip` de Svelte sur les cartes à réviser, les tâches,
  les notifications lues.
- **Risque** : `flip` exige des blocs `each` **clés**. Toute liste non clée
  animera de travers. Le relevé des listes concernées précède le code.

> **Phase 3 livrée le 14 octobre. La technique annoncée a été écartée, et une
> régression de la phase 1 corrigée en passant.**
>
> **`animate:flip` n'a aucune prise ici.** Le relevé l'établit : des 102 blocs
> `each` du site, 56 portent une clé d'identité stable, 36 une clé sur
> l'**indice** — inutile pour `flip`, puisqu'elle suit la position au lieu de
> suivre l'élément — et 10 aucune clé. Mais surtout, **les trois listes que
> l'A3 nomme ne sont pas des composants Svelte** : les tâches d'Odyssée sont
> peintes par `innerHTML` dans le script de la page, le centre de notifications
> n'existe pas (prompt 32 non construit, déjà constaté en phase 2), et les
> flashcards montrent une carte à la fois. J'avais d'abord cru tenir les tâches
> dans un bloc clé `taches as tache (tache.id)` : c'étaient celles de
> *Veridical Mapping*, un homonyme.
>
> **Ce qui a été fait à la place.** `document.startViewTransition()` avec un
> `view-transition-name` stable par carte — l'équivalent natif de FLIP, déjà
> retenu par la décision 1, sans dépendance nouvelle (interdit n° 6). Le
> navigateur apparie les cartes par leur nom, ce qui **traverse le
> `innerHTML = ''`** puisque l'appariement ne repose pas sur l'identité d'objet.
> La lecture de la base reste hors de la transition : y enfermer un accès
> IndexedDB ferait payer une attente qui n'est pas une animation (interdit
> n° 5).
>
> **Et la régression, qui n'était pas dans le lot.** Le socle de mouvement
> réduit de la phase 0 neutralise par un sélecteur `*`. Or `*` **ne sélectionne
> pas** `::view-transition-group` et ses semblables, qui vivent dans un arbre
> distinct. Les transitions de page de la phase 1 jouaient donc leur animation
> complète sous `prefers-reduced-motion: reduce`. Mesuré par la promesse
> `finished` : **246 ms sous mouvement réduit contre 245 ms en mode normal**,
> aucune différence. L'interdit n° 3 ne tolère qu'un fondu de 100 ms. C'est ma
> régression de la phase 1 ; corrigée ici, et maintenant 250 ms contre 12 ms.
>
> **Une erreur d'assertion, dite parce qu'elle instruit.** J'avais d'abord
> opposé le plafond de 100 ms à la durée que renvoie `finished` pour la liste :
> 108 ms, donc rouge. Mais `finished` couvre aussi la capture des
> photographies et l'attente d'une image — un surcoût que l'implémentation ne
> gouverne pas et que l'interdit ne vise pas. Le contrôle compare désormais les
> deux modes sur le même geste : **87 ms contre 296 ms**.
>
> **Contrôle** : `npm run essais:listes`, 7 contrôles, rouge sur 5 avant le
> correctif. La page des tâches n'est pas sous coffre — `essais:coffre-transitions`
> l'établit depuis la source — donc la capture de même document n'entre pas en
> conflit avec l'interdit n° 2.

## Phase 4 — A4, retours d'action

- **Technique** : retour bref sur bouton pressé, réponse juste ou fausse,
  carte révisée, enregistrement réussi. Décision 3 : une coche, pas de confetti.
- **Contrainte tenue** : le sens ne repose jamais sur l'animation ni sur la
  couleur seules — le texte ou l'icône dit déjà juste ou faux, et le reste.

> **Phase 4 livrée le 14 octobre. Le piège était dans le mouvement réduit, une
> fois de plus, et sous une forme nouvelle.**
>
> **Relevé.** Sur 282 boutons, **aucun** ne donnait de retour à la pression :
> 180 portent une classe `transition`, mais pour le survol seulement, et
> l'unique `active:` du code est une propriété de quête sans rapport avec
> l'état CSS. En revanche **deux exigences étaient déjà tenues avant ce lot**,
> et je le dis plutôt que de me les attribuer : `marquerOption` pose un signe
> `✓`/`✗` doublé d'un texte pour lecteur d'écran, et les quatre boutons de
> notation portent leur libellé en toutes lettres. Le sens n'y a jamais reposé
> sur la couleur.
>
> **Ce qui est ajouté.** Un retour de pression sur `button:active`, en
> `transform` seul, 120 ms — posé sur l'élément plutôt que par une classe à
> répandre sur 282 boutons, parce qu'un retour qui dépend de la mémoire de
> celui qui écrit le bouton suivant n'est pas un retour. L'apparition de la
> marque de correction, 200 ms. Et la **coche** de la décision 3 sur les
> messages de succès — masquée aux lecteurs d'écran, puisque le message dit
> déjà ce qui a réussi. Pas de confetti.
>
> **Le piège, et il est nouveau.** Le socle de la phase 0 neutralise les
> *durées*. Cela ne suffit pas ici : une mise à l'échelle dont la durée vaut
> 0,01 ms **saute à sa valeur** — le bouton se déplace tout de même, plus
> brutalement même. Or l'interdit n° 3 proscrit le déplacement, pas sa lenteur.
> Il faut annuler `transform` lui-même. **Éprouvé** : en retirant l'annulation
> pour ne laisser que la neutralisation de durée, le contrôle vire au rouge en
> relevant `matrix(0.97, 0, 0, 0.97, 0, 0)` sous mouvement réduit.
>
> C'est le troisième visage du même défaut, et il vaut d'être noté comme règle
> plutôt que comme incident : phase 0, la durée ne suffisait pas pour une
> animation *infinie* ; phase 3, le sélecteur `*` n'atteignait pas les
> pseudo-éléments de *transition* ; phase 4, neutraliser la durée ne supprime
> pas un *déplacement*. À chaque fois, « réduire la durée » a été confondu avec
> « supprimer le mouvement ».
>
> **Contrôle** : `npm run essais:retours`, 14 contrôles, rouge sur 4 avant le
> correctif.

## Phase 5 — A5, chargements

- **Technique** : squelette ou fondu d'arrivée au déchiffrement, à la lecture
  IndexedDB, à la construction d'un graphique. Aucun indicateur tournant sans
  texte.

> **Phase 5 livrée le 14 octobre. Une exigence déjà tenue, une couverture
> inégale, et je donne les deux chiffres.**
>
> **Déjà tenu avant ce lot** : « aucun indicateur qui tourne indéfiniment sans
> texte ». Il n'y a **aucun indicateur tournant** dans le site — zéro
> `animate-spin` sur 341 fichiers — et toutes les attentes sont annoncées par
> du texte. Le contrôle fige ce fait plutôt que de me l'attribuer : la règle
> est facile à enfreindre d'une classe Tailwind, et l'enfreindre ne casserait
> rien de visible.
>
> **Ce qui manquait** : l'arrivée. Le contenu sautait à l'écran au terme du
> déchiffrement.
>
> **Deux règles posées sur la convention, aucune page touchée.** Les
> identifiants `chargement` et `vue` sont uniques par page : une règle couvre
> donc le site, et la page écrite demain en hérite. Le contenu paraît par une
> *animation* — un élément qui passe de `display: none` à visible les relance,
> et il n'arrive qu'une fois ; le texte d'attente s'efface par une *transition*
> avec `allow-discrete`, puisqu'il doit s'effacer **avant** de quitter le
> rendu. 200 ms à l'arrivée, 120 ms au départ.
>
> **La couverture est inégale, et le contrôle l'imprime lui-même** plutôt que
> de la laisser dans une note : **46 pages annoncent une attente, 22 seulement
> révèlent un conteneur `vue`**. Celles-là ont le fondu d'arrivée. Les 24
> autres rendent dans un conteneur déjà présent — le glossaire en est le cas
> type — et n'offrent aucun instant unique où accrocher une arrivée sans
> toucher à chacune ; elles n'ont que la disparition adoucie du texte
> d'attente. C'est moins que « tous les chargements paraissent en fondu », et
> le contrôle B bis se mesure exprès sur le glossaire, c'est-à-dire sur une
> page **sans** conteneur `vue` : le mesurer sur une page qui en a un ne
> prouverait rien pour les 24 autres.
>
> **Le squelette n'est pas fait, et c'est un choix.** Il demande, par écran, un
> gabarit qui imite la forme du contenu à venir : du balisage sur 46 pages, à
> tenir à jour quand chaque écran change. Le fondu couvre le même besoin — ne
> pas sauter — pour un coût sans commune mesure. Le squelette reste possible
> là où une attente sera longue au point de le mériter.
>
> **Contrôle** : `npm run essais:chargements`, 10 contrôles, rouge sur 3 avant
> le correctif.

## Phase 6 — schéma du corps, deux formes

- **Technique** : les formes deviennent des **chemins SVG déclarés par muscle**,
  en deux jeux — complète et simplifiée — au lieu des ellipses et rectangles
  actuels. Défaut : **simplifiée**. Choix mémorisé dans les préférences
  existantes, sans nouveau modèle de données.
- **Fichiers** : `src/lib/sport/schema-corps.ts`, `/sport/exercices/`,
  l'essai « chaque muscle a sa forme », étendu **aux deux jeux**.
- **Source et licence** : **dessin original**. Le réseau de ce conteneur ne
  donne accès à aucune banque d'images, et aucune planche protégée ne sera
  reprise. Les contours seront écrits à la main d'après des proportions
  humaines usuelles. Attribution : aucune à porter, l'œuvre est produite ici.
- **Réserve, et c'est la plus sérieuse du lot** : « une silhouette aux contours
  anatomiquement crédibles » écrite à la main en données de chemin est la partie
  dont je garantis le moins le résultat. Je propose de livrer cette phase
  **en dernier** et de la soumettre sur captures — deux formes, deux faces, deux
  thèmes — avant d'aller plus loin. Si le rendu ne convainc pas, il vaudra mieux
  une simplifiée très soignée qu'une complète approximative.
- **Exigences conservées de la décision antérieure** : nom accessible par zone,
  coloration selon le volume, sélection, cases à cocher synchronisées et égales
  au schéma, un muscle sur sa seule face, SVG uniquement, contrastes AA.

## Phase 7 — A7, animations explicatives

- **Les trois cas, dans l'ordre du prompt** : muscles sollicités sur le schéma
  (dépend de la phase 6) ; déroulé de `src/features/correction/composants/Deroule.svelte`
  révélant chaque étape ; `src/components/BarreProgression.astro` se remplissant
  jusqu'à sa valeur, une seule fois, le chiffre affiché d'emblée.
- **Règles tenues** : lancement à la demande, jamais en boucle ; pause, rejeu,
  pas à pas au clavier ; état final lisible sans l'animation ; aucune animation
  explicative sur une donnée du coffre.
- **Les deux propositions supplémentaires** : **je n'en fais aucune pour
  l'instant.** Le prompt en autorise deux au plus, soumises à l'audit ; en
  proposer avant que le pilote ait jugé les trois premières serait deviner.

## Livrables

- Commits séparés par phase, chacun décrit.
- `docs/cyclades/inventaire-animations.md` : par animation, le lieu, le
  déclencheur, la propriété animée, la durée, la courbe, le rendu en mouvement
  réduit, et le gain visé. C'est la pièce sur laquelle le pilote fera son audit.
- Batterie complète verte avant et après ; mesure de performance et de CLS
  avant et après ; captures par famille en 390 × 844, données synthétiques.

## Réserves sur les décisions 1 à 5, en clair

1. **Décision 1** : aucune réserve sur le choix. Une sur la méthode — exclusion
   des 10 routes sous coffre plutôt qu'un inventaire de régions.
2. **Décision 2** : aucune.
3. **Décision 3** : aucune.
4. **Décision 4** : aucune sur le choix. Le mécanisme existe déjà pour le thème ;
   je m'y branche.
5. **Décision 5** : une remarque d'ordre — le cas 1 dépend de la phase 6, donc
   le schéma passe avant. Et zéro proposition supplémentaire avant l'audit.

Une réserve de plus, hors décisions : **`details` contre l'interdit n° 4**,
phase 2.

## Ce qui attend un « go »

Ce plan. Après quoi : phase 0, puis les suivantes, chacune testée, livrées une
par une.
