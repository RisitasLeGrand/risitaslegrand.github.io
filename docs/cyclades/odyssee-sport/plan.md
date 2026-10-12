# Plan de construction — Odyssée et Sport

Les deux branches sont **déclarées** depuis la phase 1e et **nourries** depuis les phases A à F :
contrat de faits, matrice de permissions, domaines, moteur d'activité, désaccords inter-branches,
catalogue d'indicateurs, synthèses, export et import d'analyse. Il ne leur manque que ce qu'une
branche possède en propre : **ses magasins et ses écrans**.

Ce document découpe les phases 4 à 9 de `docs/cyclades/plan.md` — qui transcrivent le prompt P3 —
en lots livrables, et garde la trace de ce qui est fait. Il ne rajoute aucune exigence : ce qu'il
contient vient de `plan.md`, de `decisions-phase-0.md` et du catalogue d'indicateurs.

---

## Ce qui est déjà en place, et qu'il ne faut pas refaire

| Acquis | Où |
|---|---|
| Les 34 types de faits, dont 20 pour Odyssée et 5 pour Sport | `src/lib/noyau/faits.ts` |
| Les 8 domaines, 5 actifs par défaut (décision 1) | `src/lib/noyau/domaines.ts` |
| Propriétaire unique par fait, et la matrice de lecture | `src/lib/noyau/permissions.ts` |
| XP, niveau et série calculés **une seule fois** (décision 2) | `src/lib/odyssee/activite.ts` |
| Désaccords inter-branches et composante d'intégrité | `src/lib/odyssee/desaccords.ts` |
| Les 15 indicateurs, les périodes, la couverture et la fiabilité | `src/lib/odyssee/{indicateurs,syntheses,fiabilite}.ts` |
| Journal d'opérations, fusion, compaction, sauvegarde, synchronisation | `src/lib/noyau/*`, `src/lib/sauvegarde/*`, `src/lib/sync/*` |
| Profil commun, initialisation, réglages déduits, adaptation | `src/lib/noyau/{profil,initialisation,reglages,adaptation}.ts` |

**Une branche possède ses données et publie des faits** : `faits-revisions.ts` montre la forme à
suivre — une **projection en lecture**, à identifiants déterministes, jamais un second magasin qui
dupliquerait la vérité.

---

## Odyssée

### O1 — Magasins et projection de faits

> **O1 faite, le 12 octobre 2026.** Cinq magasins, la migration v15, l'inscription au registre
> journalisé, et la projection.
>
> **Les cinq magasins entrent au registre journalisé dès leur création**, et non après coup. Une
> donnée écrite avant d'y être inscrite ne voyagerait pas, et le socle de rattrapage devrait
> inventer une horloge pour elle. Ils entrent du même coup dans la sauvegarde, dans la rétention et
> dans l'effacement ciblé — c'est tout l'intérêt d'avoir un registre plutôt que des listes
> parallèles.
>
> **Tâche et quête ne sont pas la même chose, et la confusion coûterait cher.** Une tâche se fait
> une fois et se clôt ; une quête se tient, à chaque jour ou à chaque semaine. Le plancher du jour
> se calcule sur les quêtes, l'arriéré sur les tâches, et une quête close disparaîtrait là où une
> tâche répétée s'accumulerait. Les jours tenus d'une quête sont gardés en **liste**, pas en
> compteur : un compteur ne se corrige pas, il se croit.
>
> **La projection a été coupée en deux.** `publier` lit les magasins, `projeter` calcule, et
> `maintenant` est un paramètre. Une projection qu'on ne peut éprouver qu'à travers IndexedDB est
> testée une fois, mal, et jamais sur les cas tordus — un événement à cheval sur minuit, une quête
> tenue hors fenêtre, un Pomodoro interrompu.
>
> **Un créneau d'agenda est `estime`, seul des cinq à ne pas être `confirme`.** Il dit ce qui était
> **prévu** : la réunion a pu finir plus tôt, ou ne pas avoir lieu. Le marquer confirmé flatterait
> la couverture de mesure exactement là où elle est la plus fragile.
>
> **L'essai de migration sème une base v14 entière**, et non les trois magasins qu'il relit. Un
> schéma partiel fait échouer le site sur un magasin absent, l'écran reste sur « Déchiffrement du
> contenu… », et l'on conclut que la migration est cassée alors que c'est la base de départ qui
> n'existait pas. Le schéma complet vit dans `scripts/lib/base-ancienne.mjs`.
>
> **Au passage, un défaut du helper partagé.** `franchirInitialisation` attendait
> `#terminer, #aller-menu, #commencer` par `waitForSelector`, qui résout l'union puis attend le
> **premier** — `#terminer`, caché tant que l'écran allégé est affiché. L'attente expirait donc sur
> une base portant déjà de l'usage, c'est-à-dire précisément le cas où l'écran allégé existe. Aucun
> essai ne l'avait vu : ils partent tous d'une base vierge.

### O2 — Le noyau des règles du jour

> **O2 faite, le 12 octobre 2026.** `odyssee/jour.ts` : la roue, le plancher, les huit règles, la
> couverture, les fenêtres de jours.
>
> **Une branche de roue porte un état, pas un nombre.** `mesure`, `sans-donnee`, `en-pause` : au
> premier lancement, une roue qui afficherait cinq branches à zéro dirait à la personne que sa vie
> est déséquilibrée, alors qu'elle dit seulement que le logiciel ne sait rien. `vide` est un champ
> du résultat et non une déduction laissée à l'appelant, parce que trois écrans poseront la même
> question et y répondraient chacun un peu autrement.
>
> **Seuls les faits qui portent une durée entrent dans la roue.** Une tâche close et une quête
> tenue n'en ont pas ; leur attribuer une valeur — « une tâche vaut dix minutes » — ferait d'un
> chiffre inventé la moitié de la roue. Elles nourrissent le plancher, qui est fait pour elles.
>
> **La surcharge est la seule règle qui en désactive d'autres**, et c'est sa raison d'être. Neuf
> heures d'agenda : les tâches et les domaines délaissés se taisent, les engagements du jour et les
> conflits restent. Proposer d'en faire plus un jour déjà plein est le plus sûr moyen de faire
> abandonner l'outil.
>
> **« Délaissé » suppose « suivi ».** Un domaine qui n'a jamais rien reçu n'est pas délaissé : il
> n'est pas mesuré, et le signaler reviendrait à reprocher de ne pas saisir, ce que E.6 refuse.
>
> **Un domaine en pause se tait entièrement**, suggestions comprises. Conséquence pour O5 : l'écran
> de saisie ne doit proposer que des domaines actifs, sans quoi on pourrait créer une tâche qui ne
> reparaîtrait jamais. C'est écrit comme un essai, pas comme une note.

### O3 — `/odyssee/` : le tableau de bord

> **O3 faite, le 12 octobre 2026.** Le bandeau du vide, « Que faire maintenant ? », le plancher,
> la roue, l'agenda du jour, le focus.
>
> **Une seule lecture, un seul instant.** `etatDuJour` lit tout en une fois. Cinq lectures séparées
> auraient donné cinq instants différents : la roue calculée à 23 h 59 et les suggestions à 0 h 00
> ne parleraient pas du même jour, et personne ne comprendrait pourquoi.
>
> **La roue additionne les deux branches.** Si elle ne voyait que les faits d'Odyssée, Cognition et
> Connaissances seraient vides alors que ce sont les deux domaines les mieux nourris — c'est tout
> le sens d'une roue d'équilibre.
>
> **Le bandeau du vide se vérifie sur ses mots**, parce que c'est par les mots qu'il se perdrait :
> l'essai exige « absence de données » et « n'est pas un déséquilibre ». Et la contrepartie, qui
> est la vraie preuve : une quête tenue **ne remplit pas** la roue, puisqu'elle n'a pas de durée.
> Le bandeau reste donc affiché après l'avoir cochée, et c'est voulu.
>
> **La règle est dans le DOM**, en `data-regle`, et pas seulement à l'écran : un essai vérifie
> ainsi *quelle* règle a parlé au lieu de deviner d'après un libellé qui changera. L'écran affiche
> l'**intitulé** de la règle, jamais sa raison — la raison explique au développeur pourquoi elle
> existe, l'intitulé dit à la personne ce qu'elle cherche.
>
> **Le focus n'écrit qu'à l'arrêt**, et il écrit le temps réellement passé. Les deux secondes de
> l'essai, pas les vingt-cinq minutes visées : compter la durée visée gonflerait le temps de
> concentration exactement les jours où l'on s'est le moins concentré.

### O4 — Calendrier, tâches, et le suivi « prévu / réalisé »

> **O4 et O5 faites, le 12 octobre 2026**, avec l'addendum du même jour : *« l'utilisateur doit
> pouvoir gérer intégralement son planning depuis Odyssée ; Odyssée doit réaliser un suivi de ce
> qui est fait ou non ; si une tâche ou un événement planifié n'a pas eu lieu, Odyssée doit savoir
> pourquoi. »*
>
> **Le relevé a résolu une gêne que j'avais signalée en O1.** Un créneau d'agenda était publié
> `estime` faute de mieux : il disait ce qui était prévu, et nul ne savait si cela avait eu lieu.
> Maintenant que la personne peut répondre, un moment déclaré fait devient `confirme`, un moment
> déclaré **non fait n'est plus publié du tout** — publier sa durée compterait un temps que
> personne n'a passé — et seul ce qui n'est pas relevé reste une supposition.
>
> **« Je ne sais pas » n'est pas « pas fait ».** C'est la règle qui tient tout le suivi. Les
> moments non relevés sont comptés **à part** et n'entrent pas dans le taux : les compter comme
> des échecs ferait baisser le chiffre pour une absence de réponse, ce qui apprendrait à ne plus
> rien planifier. Et sans aucun relevé, le taux vaut `null` plutôt que zéro.
>
> **« En partie » vaut une demie**, et le chiffre est déclaré dans `POIDS_PARTIEL` plutôt que
> fondu dans une formule. Le compter pour 1 effacerait la différence entre une séance tenue et une
> séance rognée ; pour 0, il la rendrait équivalente à un abandon. C'est aussi le cas le plus
> fréquent : la plupart des plans ne sont ni tenus ni abandonnés, ils sont rognés.
>
> **Une tâche a trois sorties, pas deux.** L'abandon n'est pas un confort d'interface : sans lui,
> retirer une tâche de l'arriéré imposerait de la supprimer, et supprimer ferait **remonter** le
> taux à chaque renoncement — l'inverse de ce qu'un suivi doit faire. Une tâche **sans échéance**
> n'entre pas dans le compte : une liste de choses à faire « un jour » n'est pas un plan, et la
> compter ferait baisser le taux à chaque idée notée.
>
> **Les dix motifs sont une liste fermée, parce qu'un texte libre ne se compte pas.** « Savoir
> pourquoi » ne veut rien dire si la réponse n'est lisible que par un humain relisant trois ans de
> notes : il faut que la cause dominante se **calcule**. Le texte libre existe à côté, pour ce que
> la liste ne dit pas.
>
> Deux motifs méritent d'être défendus. **`trop-ambitieux` met en cause le plan et non la
> personne** : c'est le seul qui débouche sur une correction — planifier moins —, là où « je n'ai
> pas réussi » ne débouche sur rien. **`sans-envie` est dit sans détour** : l'omettre forcerait à
> choisir un motif faux, et un suivi qu'on remplit de travers ne vaut rien.
>
> **Le motif est exigé par le contrôle du modèle, pas par l'écran.** Un écran se contourne ; un
> contrôle refuse l'écriture. L'écran le demande **avant**, pour que l'échec ne soit jamais la
> façon dont on apprend la règle — mais la garantie est ailleurs.
>
> **Aucune cause dominante sous quatre observations, ni à égalité.** Nommer une cause sur deux
> relevés serait exactement la conclusion que le catalogue d'indicateurs interdit ailleurs, et il
> n'y a pas de raison de se l'autoriser ici parce que c'est plus facile à calculer.
>
> **L'iCalendar est écrit à la main**, et ce que cela coûte est dit plutôt que caché : les règles
> de récurrence ne sont pas lues, une série est importée comme son seul premier terme, et les
> séries concernées sont **nommées** dans le rapport d'import. Une bibliothèque pesant de 50 à
> 200 ko aurait chargé chaque page du site pour un import qu'on fait trois fois par an. Ce qui
> n'est pas négociable y est : CRLF, pliage à 75 **octets** — un « é » en pèse deux —, échappement,
> et un `UID` stable, qui est la seule chose rendant un réimport utilisable plus d'une fois.
>
> **Les relevés ne sont pas retenus par la surcharge.** Toutes les autres suggestions qui ajoutent
> du travail se taisent une journée à neuf heures d'agenda ; celle-là passe, parce que répondre
> « pas fait » est le geste le plus utile d'une journée trop pleine.

### O5 — Tâches et quêtes *(fait avec O4 — voir ci-dessus)*

### O6 — Revue du soir, et le coût de saisie affiché (E.6)

> **O6 faite, le 12 octobre 2026.** Quatre questions, dont **aucune** obligatoire prise
> séparément, et une seule exigence : une revue entièrement vide n'est pas enregistrée. Une revue
> d'une ligne l'est — la tenir compte plus que de la bien remplir, et un écran qui exige quatre
> réponses complètes apprend à ne plus l'ouvrir.
>
> **Le relevé passe avant les questions.** La première chose que montre l'écran n'est pas une
> question mais ce qui était prévu et attend une réponse : c'est le moment de la journée où l'on
> peut y répondre de mémoire, et c'est la seule partie qui alimente un calcul.
>
> **Le coût de saisie est affiché**, et c'est E.6 pris au mot : l'écran dit combien de secondes on
> y a passé. S'il coûte plus qu'il n'annonce, cela se voit, et c'est l'écran qu'il faudra
> raccourcir.

### O7 — Ouverture de la branche

> **O7 faite, le 12 octobre 2026.** Odyssée est ouverte ; Sport reste fermée.
>
> **Les onglets ont quitté la mise en page pour le registre.** `Base.astro` ne connaît plus aucun
> écran : il déduit la branche du chemin et affiche les onglets qu'elle déclare. C'est le critère
> d'extensibilité que la phase 8 posait — « si ce test passe sans modifier le cœur, l'extensibilité
> est démontrée » —, et Sport n'aura donc aucune ligne à y ajouter.
>
> **Un écran d'Odyssée passe en en-tête complet.** Ils étaient en en-tête léger, ce qui était juste
> tant que la branche était fermée : un écran accessible seulement par son adresse n'a pas de barre
> à montrer. L'ouvrir sans le changer aurait livré une branche sans navigation, et l'essai l'a
> attrapé — la barre ne contenait ni les écrans d'Odyssée ni ceux de Révisions, parce qu'il n'y
> avait pas de barre du tout.
>
> **Le passage d'une branche à l'autre est un lien par branche ouverte**, et non un menu : à deux
> branches, un menu coûte un clic de plus pour cacher une seule option. Il disparaît entièrement
> quand il n'y a nulle part où aller.

---

## Sport

### S1 — Magasins et bibliothèque d'exercices

Nature, latéralité, équipement, muscles, unité de charge, et l'**identité de comparaison** incluant
variante et équipement — sans quoi deux exercices différents se compareraient.

### S2 — Le schéma du corps

SVG **dessiné nativement**, avant et arrière, trois états par clic, **avec l'alternative en cases à
cocher obligatoire** : utilisable au clavier et au lecteur d'écran seuls.

> **S2 faite, le 12 octobre 2026.** `src/lib/sport/schema-corps.ts` et `/sport/exercices/`.
>
> **Le dessin est une donnée, pas une image.** Un tableau de primitives par muscle, que la page
> assemble en SVG. C'est ce qui permet à `controlerSchema()` de vérifier que chaque muscle déclaré
> a une forme, qu'aucune forme ne déborde de la boîte, et qu'aucune face n'est vide — trois
> contrôles qu'aucun PNG ne permettrait, et trois erreurs qu'on découvrirait autrement à l'usage.
>
> **L'alternative en cases n'est pas un repli, c'est l'égal.** Les deux sont affichées en même
> temps et écrivent le même état, par une seule fonction `poser()` : il n'existe aucun chemin qui
> change le schéma sans changer les cases. C'est ce qui en fait une équivalence plutôt qu'un mode
> dégradé qu'on oublierait de tenir à jour.
>
> **Les zones sont de vrais boutons au clavier.** `role="button"`, `tabindex`, `aria-pressed`, un
> nom accessible qui dit l'état, et Entrée comme Espace qui cyclent — sans quoi le parcours clavier
> mènerait à des zones qu'on ne peut pas activer, le pire des deux mondes. L'ordre de tabulation
> suit le corps de haut en bas, calculé depuis les formes et non écrit à la main.
>
> **La silhouette porte `aria-hidden`.** C'est un repère visuel ; l'exposer ajouterait au parcours
> une étape qui ne mène nulle part.

### S3 — Séances types, programmes, volume par muscle

Coefficient secondaire 0,5 réglable, **stocké avec chaque calcul** — un coefficient changé plus tard
ne doit pas réécrire l'histoire.

> **S3 faite, le 12 octobre 2026.** `src/lib/sport/programmes.ts`, le magasin `sportProgrammes`
> (migration v17, additive) et `/sport/programmes/`.
>
> **Une séance type n'est pas une séance.** Rien dans ce module n'écrit dans `sportSeances` : un
> programme prépare, la saisie en direct enregistre. Les confondre ferait apparaître dans
> l'historique des séances jamais faites, et dans le volume réalisé des séries jamais soulevées —
> l'illusion exacte que le relevé d'Odyssée combat.
>
> **Le prévu passe par le même calcul que le réalisé.** `volumePrevu` fabrique des séries fictives
> et les donne à `volumeParMuscle` plutôt que de refaire la pondération. Deux formules à tenir
> d'accord auraient fait mesurer à l'écart prévu/réalisé la divergence du code autant que celle de
> la personne.
>
> **Le facteur `parSemaine / nombre de séances types`** ramène un programme à l'échelle
> hebdomadaire du réalisé. Trois séances types tournées quatre fois par semaine, ce n'est ni trois
> ni quatre : c'est 4/3 par type, et un code qui multiplierait par `parSemaine` triplerait le
> prévu.
>
> **Le tableau montre tous les muscles, y compris à zéro partout** — la ligne vide est
> l'information. Et `musclesAbsents` nomme ce qu'aucun exercice du programme ne touche : un trou ne
> se voit pas en lisant un programme, puisqu'on y voit ce qui est, jamais ce qui n'y est pas.
> C'est une alerte, pas un refus : un programme du haut du corps est un programme.

### S4 — La séance en direct

Saisie série par série, minuteur de récupération réelle, Wake Lock, **sauvegarde à chaque série**,
hors réseau. Une séance interrompue se reprend sans perte.

> **S4 faite, le 12 octobre 2026.** `/sport/seance/`.
>
> **Le repos enregistré est mesuré, pas consigné.** Le minuteur relit l'horloge à chaque battement
> au lieu d'incrémenter un compteur — un onglet en arrière-plan voit ses minuteurs ralentis, et un
> compteur incrémenté dériverait de plusieurs minutes sur une séance. Et il **continue de compter
> au-delà de la cible** : un minuteur qui s'arrêterait à sa consigne enregistrerait sa consigne.
>
> **L'instant de la dernière série est lu dans les données**, jamais dans une variable. Au retour
> d'une interruption, la variable serait vide et le repos repartirait de zéro, alors que la donnée
> sait l'heure qu'il était.
>
> **Le Wake Lock est repris au retour d'arrière-plan.** Le navigateur le relâche de lui-même et ne
> le rend pas ; sans cette reprise, l'écran s'éteindrait dès le premier passage par une autre
> application. Là où il n'existe pas, l'écran le dit en une ligne plutôt que d'échouer en silence.
>
> **La charge est gardée d'une série à l'autre, les répétitions sont vidées.** On enchaîne presque
> toujours la même charge, et la retaper est le genre de friction qui fait abandonner la saisie au
> milieu d'une séance — c'est-à-dire qui fait perdre la séance.

### S5 — Le suivi de la force

Epley et Brzycki, **imprécision signalée au-delà de dix répétitions**, bandes de contexte datées,
filtre « périodes comparables », détection de plateau.

> **S5 faite, le 12 octobre 2026.** `/sport/force/`.
>
> **L'imprécision a une forme, pas seulement une mention.** Les points tirés de séries de plus de
> dix répétitions sont des cercles **creux** sur la courbe et portent « approximative » dans le
> tableau. Un tracé lisse donnerait à une approximation l'allure d'une mesure.
>
> **L'échelle ne part pas de zéro, et la légende le dit.** À partir de zéro, deux kilos gagnés sur
> cent seraient invisibles ; tronquée sans le dire, l'échelle exagérerait la pente. Les deux
> défauts s'évitent en annonçant l'échelle.
>
> **Le graphique porte `aria-hidden`, et le tableau est la version complète.** Même raison qu'au
> schéma du corps : exposer un tracé au lecteur d'écran produit une liste de coordonnées, qui
> n'informe personne.
>
> **Le filtre « périodes comparables » compte ce qu'il écarte**, et l'annonce. Un filtre qui
> escamoterait des points sans le dire ferait passer une sélection pour l'histoire entière.

### S6 — Les modulations, et le garde-fou

Selon la lecture de la décision 5 : **Sport propose, la personne dispose, et le réel fait foi** —
aucune mémoire de désobéissance, aucun compteur de propositions non suivies. **Exception non
négociable** : en présence d'une douleur ou d'une blessure déclarée, aucune proposition de
progresser.

> **S6 faite, le 12 octobre 2026.** `src/lib/sport/refus-locaux.ts`, et les propositions sur
> `/sport/seance/`, `/sport/force/`, `/sport/corps/`.
>
> **Le refus vit dans le stockage local, et nulle part ailleurs.** Un refus doit laisser une trace,
> sans quoi la même proposition reviendrait le lendemain — une façon de ne pas écouter. Mais cette
> trace n'entre **ni dans les magasins, ni dans la synchronisation, ni dans la sauvegarde, ni dans
> l'export pour une IA** : on ne pourra jamais bâtir un reproche sur ce qu'elle contient. Elle
> expire d'elle-même, et la perdre coûte au pire une proposition qui revient une fois. Choisir le
> stockage le plus faible est ici le choix de fond.
>
> **Un seul refus par couple exercice / sorte**, et un bouton pour tout oublier : une donnée
> invisible doit rester effaçable.
>
> **Le garde-fou est à deux endroits, et c'est voulu.** Dans `proposer()`, comme premier test que
> rien ne contourne ; et sur le tableau de bord, en clair — une protection qu'on ne sait pas avoir
> ne rassure personne.

### S7 — Ouverture de la branche

> **S7 faite, le 12 octobre 2026.** Six écrans, six onglets, `disponible: true`.
>
> **Les onglets ont été déclarés avant l'ouverture**, branche encore fermée. Ce n'est pas une
> contradiction : `disponible` commande ce que **les autres** branches montrent, les onglets
> commandent ce que Sport montre d'elle-même. Les écrans se répondaient donc pendant la
> construction sans que la branche soit promise à qui ne l'avait pas demandée.
>
> **`essais:sport:navigateur` vérifie les trois promesses** qu'aucun essai pur n'atteint : le
> schéma utilisable au clavier seul (focus, Entrée, Espace, noms accessibles, et la case qui
> commande le schéma dans l'autre sens), la séance rechargée en plein milieu qui revient avec ses
> séries, et la douleur déclarée qui s'affiche. Il vérifie aussi que la barre ne montre **pas** les
> onglets de Révisions — l'erreur exacte attrapée en O7.

---

## Phase 6 — Le domaine Corps

> **Faite le 12 octobre 2026, à une réserve près.** `src/lib/odyssee/corps.ts`,
> `donnees-corps.ts`, `faits-corps.ts`, `faits-branches.ts`, le magasin ×6 (migration v18,
> additive) et `/odyssee/corps/`.
>
> **La réserve : ni médicaments ni statut hormonal.** Les deux appartiennent au domaine et sont
> déclarés au contrat de faits, mais la **décision 3** — le chiffrement au repos — n'est pas prise.
> Les écrire en clair aujourd'hui puis les chiffrer plus tard laisserait une trace en clair dans
> les instantanés de migration et dans les sauvegardes déjà faites : *on ne rattrape pas une donnée
> qu'on a écrite*. Le plan ne rangeait la décision 3 que devant les phases 7 et 8 ; elle tient
> aussi sur ces deux objets-ci, et c'est le seul endroit où la phase 6 s'arrête.
>
> Un essai nomme les deux magasins **en négatif** (`ni médicaments ni statut hormonal`) : une
> absence ne se remarque pas toute seule, et sans cette ligne ils pourraient arriver sans que la
> décision ait été prise.
>
> **L'impossible est refusé, l'invraisemblable passe.** Un poids de −5 kg est une faute de frappe ;
> un poids de 300 kg est le corps de quelqu'un. Les contrôles du modèle ne reprennent donc que la
> borne du possible, et c'est `valider()` qui abaisse la fiabilité d'une valeur hors du plausible —
> elle sort `a-verifier`, pas un refus.
>
> **L'absence n'est pas un zéro**, encore. `journee()` rend `null` partout où rien n'a été saisi,
> et un repas non chiffré est publié avec `chiffre: false` : sans lui, un café noté sans calories
> compterait comme un jeûne dans toute moyenne.
>
> **La moyenne mobile ne comble pas les trous.** Les jours sans pesée sont sautés, non interpolés,
> et chaque point dit sur combien de jours il porte. Une courbe plus lisse serait moins vraie.
>
> **Aucun appel réseau, aucune base d'aliments** : décision 4, défaut sûr. Les calories et les
> macros se saisissent, et se contrôlent entre elles par Atwater à 25 % près — un écart d'un quart
> signale presque toujours une unité confondue.

### Ce que la phase 6 a révélé : deux règles muettes

> **Les faits ne circulaient pas entre branches.** `publierFaitsSport` n'était appelé nulle part
> dans l'application, et `publierFaitsCorps` n'existait pas. Les règles de désaccord
> `effort-sous-sante` et `chevauchement-exclusif`, écrites en phase 3f pour opposer deux branches,
> n'avaient donc **jamais rien eu à opposer**. Une règle qui ne peut pas se déclencher se tait
> exactement comme une règle satisfaite.
>
> `faits-branches.ts` assemble les quatre publications ; la roue du jour et les indicateurs la
> lisent. L'**XP ne bouge pas** : ses règles n'écoutent que les types `revision.*`, et tout le
> reste tombe dans `sansRegle`, qui dit en toutes lettres « compte pour les indicateurs, pas pour
> l'XP ». C'est la décision 2, et c'est ce qui rend ce branchement sans danger.
>
> **Un fait porte un seul jour logique, et cela ne convient pas aux états.** Une maladie déclarée
> le 8 et encore ouverte le 12 ne rencontrait pas la séance du 12 : `detecter` range chaque fait
> dans le bucket de son unique jour. Les règles déclarent désormais `etale`, la liste des types
> dont un fait **dure** et doit être vu chaque jour couvert. Étaler n'est pas le défaut : le
> sommeil somme par jour, et une nuit à cheval sur minuit comptée deux fois ferait un jour
> impossible de seize heures.

---

## Ce qui attend une décision avant d'être construit

| Décision | Ce qu'elle bloque | État |
|---|---|---|
| **3 — chiffrement au repos** de Psyché, Finances, médicaments et statut hormonal | Phases 7 et 8, **et les deux derniers objets de la phase 6** | **non tranchée** |
| **5 — lecture des modulations Sport** | S6 | non tranchée ; je construis sur la recommandation écrite, qui est révocable |
| **4 — appels réseau** (cours de bourse, base d'aliments) | Finances, nutrition | non tranchée ; je construis **sans**, ce qui est la recommandation et le défaut sûr |

Les phases 6 à 9 — Corps, Psyché, Finances, Tendances — viennent **après** O7 et S7, et la
décision 3 doit être prise avant Psyché.
