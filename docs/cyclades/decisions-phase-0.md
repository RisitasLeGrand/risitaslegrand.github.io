# Décisions à prendre avant la phase 1

Livrable de la phase 0, section 0.3 du prompt « Odyssée, Sport, parité ». Chaque point porte ma
recommandation et ce qu'elle coûte. Rien n'est codé avant tes réponses.

## 1. Les domaines d'Odyssée

Tu demandes de confirmer cinq domaines et proposes trois ajouts.

| Domaine | Ce qu'il porte | Alimenté par |
|---|---|---|
| **Corps** | Poids et mesures, sommeil, nutrition, médicaments, santé générale, statut hormonal | Sport (séances) + saisie Odyssée |
| **Cognition** | Temps focus, Cog-Training, rétention FSRS | Révisions, automatiquement |
| **Connaissances** | Couverture du programme, niveau estimé, apports externes (lecture, cours) | Révisions + saisie manuelle |
| **Psyché** | Check-in quotidien, check-in hebdomadaire, journal | Saisie Odyssée |
| **Finances** | Comptes, budget, portefeuille | Saisie et imports CSV |
| **Lien** | Relations : temps passé avec des proches, contacts entretenus | Saisie |
| **Ordre** | Foyer, démarches administratives, organisation | Tâches d'Odyssée |
| **Œuvre** | Travail, projets, créations | Tâches et temps focus |

**Ma recommandation : retenir les huit, mais n'activer que cinq au départ.** Les trois ajouts (Lien,
Ordre, Œuvre) sont justes — une roue d'équilibre à cinq branches dont quatre sont nourries par le
même outil ne mesure pas l'équilibre d'une vie, elle mesure l'usage du logiciel. Mais ils reposent
**entièrement** sur de la saisie manuelle, et ton propre garde-fou E.6 dit que la saisie doit rester
réduite à l'utile.

D'où la proposition : les huit domaines existent dans la configuration, **Lien, Ordre et Œuvre sont
désactivés par défaut**, et tu les actives quand tu veux les tenir. Un domaine désactivé ne compte
pas dans la roue d'équilibre et ne crée aucune culpabilité — c'est exactement ce que E.3 demande pour
le poids et les calories, étendu à tout domaine.

**Ce que je te demande** : les huit, ou seulement cinq ? Et si huit, lesquels actifs au départ ?

## 2. Propriété de l'XP, du niveau et de la série

Tu recommandes qu'elles soient calculées **une seule fois par Odyssée**, à partir des faits émis par
toutes les branches. **Je suis d'accord, et la raison est plus forte que la simplicité.**

Deux calculateurs d'XP produisent deux vérités, et c'est le genre de divergence qu'on ne découvre
qu'après des mois d'historique — quand il est trop tard pour la réconcilier. Un seul calcul, des
affichages partiels : Révisions montre sa part, Sport la sienne.

### Ce que cela coûte, et c'est le vrai sujet

L'XP et la série **existent déjà** dans Révisions, avec un historique réel. La migration doit donc
répondre à deux questions que je ne peux pas trancher seul :

**La série.** Aujourd'hui, un jour compte si tu as révisé. Demain, il comptera si tu as fait
**quelque chose** — réviser, t'entraîner, tenir un check-in. La série devient donc **plus facile à
tenir**. Deux options :

- **Reprendre la série telle quelle** : honnête vis-à-vis du passé, mais le compteur change de sens
  en cours de route. Un « 240 jours » signifierait « 180 jours de révision puis 60 jours de vie ».
- **Repartir de zéro, en conservant le record** : le compteur garde un sens unique, l'effort passé
  reste visible comme record. C'est **ce que je recommande**, et c'est aussi ce qui évite qu'une
  journée de sport sauve une série de révision qu'elle n'a pas méritée.

**L'XP.** Le total accumulé dans Révisions devient l'XP du domaine **Connaissances** (et Cognition
pour Cog-Training). Je recommande de **convertir sans recalculer** : rejouer cinq mois d'historique
sous des règles neuves produirait un nombre différent de celui que tu as vu tous les jours, sans
qu'aucun des deux soit plus vrai.

**Ce que je te demande** : série reprise ou repartie de zéro avec record conservé ?

## 3. Chiffrement au repos des données sensibles

Tu demandes le coût mesuré et une recommandation.

**Je ne peux pas te donner le coût mesuré aujourd'hui** : il dépend du volume, et le volume sort du
générateur de données synthétiques, qui est le premier livrable de la phase 1. Te donner un chiffre
maintenant serait l'inventer. Ce que je peux donner, c'est la structure du coût et ma
recommandation.

**Ce que le chiffrement au repos empêche** : qu'une donnée de santé, de psyché ou de finances soit
lisible par quiconque accède au navigateur — une extension, un autre profil, un outil
d'inspection, un ordinateur partagé. C'est un gain réel, et le seul endroit où il se joue.

**Ce qu'il coûte**, par ordre de gravité :

1. **La perte du mot de passe devient la perte des données.** C'est déjà vrai du contenu de cours,
   mais celui-ci se reconstruit depuis le dépôt. Un journal psychique de trois ans ne se reconstruit
   pas. Le risque change de nature.
2. **Les agrégations exigent de déchiffrer.** Une roue d'équilibre sur sept jours lit sept jours ;
   une tendance sur un an lit un an. Chaque lecture devient un déchiffrement.
3. **La recherche devient impossible** sur les champs chiffrés : on ne peut pas indexer ce qu'on ne
   lit pas. Il faut donc laisser en clair les champs d'index, et c'est là que la fuite se reforme —
   un index en clair sur les dates et les domaines dit déjà beaucoup.

**Ma recommandation : oui, mais par domaine et pas par principe.** Chiffrer Psyché, Finances,
médicaments et statut hormonal ; laisser en clair le reste (sommeil, poids, séances de sport,
révisions). La raison : ces quatre-là sont ceux dont la lecture par un tiers fait un dommage, et ce
sont aussi ceux dont les agrégations sont les plus légères — un check-in par jour, pas six cents
séries de musculation.

Et une condition, que je poserai comme bloquante : **le rappel de sauvegarde doit devenir plus
insistant** sur ces domaines. Chiffrer sans sauvegarder, c'est fabriquer une perte définitive.

**Ce que je te demande** : d'accord pour chiffrer ces quatre domaines-là, le reste en clair ?

## 4. Appels réseau optionnels

Deux options sont en jeu, désactivées par défaut dans les deux cas.

| Option | Ce qu'elle révèle à un tiers | Ma recommandation |
|---|---|---|
| **Cours de bourse** | Les titres que tu détiens, et leur quantité si les requêtes sont groupées | **Ne pas l'implémenter en v1.** Un portefeuille se valorise en saisissant quelques cours par mois ; l'automatiser économise cinq minutes et révèle une allocation complète. Le rapport est mauvais. |
| **Base d'aliments en ligne** | Ce que tu manges, repas par repas | **Ne pas l'implémenter.** Une bibliothèque d'aliments que tu construis toi-même couvre en trois semaines 95 % de ce que tu manges réellement, et ne révèle rien. |

Dans les deux cas, le site est statique et sans serveur : un appel réseau partirait du **navigateur**,
avec son adresse IP et son empreinte. Il n'y a pas d'intermédiaire pour l'anonymiser.

**Ce que je te demande** : confirmer qu'on s'en passe en v1, ou dire laquelle tu veux quand même.

## 5. L'interprétation de la consigne Sport sur les modulations

Tu demandes de te confirmer comment je lis « s'il le fait malgré tout, Sport doit l'intégrer ».

**Ma lecture** : Sport propose, la personne dispose, et **le réel fait foi**. Concrètement :

- Sport propose de monter de 2,5 kg. Tu refuses. **La proposition disparaît** pour une durée
  réglable, et ne revient que si les données changent nettement.
- Sport propose de monter. Tu refuses, **et tu montes quand même** de 5 kg à la séance suivante.
  Sport **enregistre les 5 kg comme la vérité**, met à jour ta progression et tes records, et
  **ne dit rien** — ni « tu avais refusé », ni « attention ». Le programme est ajusté sur ce que tu
  fais, pas sur ce que tu as accepté.
- Sport propose de monter. Tu acceptes, **et tu ne montes pas**. Même traitement : le réel fait foi,
  le programme suit le réel.

**Ce que cela implique, et que je veux dire clairement** : Sport n'a **aucune mémoire de
désobéissance**. Il n'existe nulle part un compteur de « propositions non suivies », et aucun écran
ne te renvoie ton refus. La seule trace est l'historique de ce que tu as fait.

**La seule exception, et elle est non négociable** (D.7, dernier point) : en présence d'une blessure
ou d'une douleur déclarée, Sport **ne propose jamais** de progresser — il propose de réduire, et de
consulter si la douleur persiste. Si tu progresses quand même, il l'enregistre sans commentaire,
comme le reste.

**Ce que je te demande** : cette lecture est-elle la bonne ?

## Une sixième question, que le prompt ne pose pas et que je dois poser

**Le périmètre a triplé, et le temps de séance est fini.**

Les trois prompts cumulés demandent : huit phases de refonte du stockage et des parcours, une
branche Odyssée complète (calendrier, tâches, quêtes, focus, cinq à huit domaines, moteur de
tendances, revues périodiques), une branche Sport complète (bibliothèque d'exercices, schéma
corporel SVG accessible, séance en direct, suivi de force, modulations), la parité des explications
sur quatre parcours, la réécriture du prétest de 262 fiches, la mise à jour de 540 questions de QCM,
et les référentiels officiels des trois concours DGFiP à établir sur sources.

Ce n'est pas un refus : c'est le constat qu'un ordre de priorité va être nécessaire, et qu'il valait
mieux le dire maintenant que de découvrir à la quinzième phase que l'essentiel attend.

**Ma proposition** : traiter en premier ce qui **répare ce qui est faux aujourd'hui** (le prompt qui
nomme le mauvais concours, l'absence de sauvegarde alors que les données ne tiennent qu'au
navigateur), puis ce qui **débloque** (registre de parcours, thèmes), et ne construire Odyssée et
Sport qu'ensuite. L'ordre de la section F du prompt met le socle en phase 1 et Odyssée en phase 2,
ce qui est compatible — à condition d'y glisser la sauvegarde, qui n'y figure pas et qui est la
seule protection contre une perte totale.

**Ce que je te demande** : la sauvegarde (prompt stockage, section 2) passe-t-elle **avant** Odyssée
et Sport ? Je recommande oui, fermement : aujourd'hui, un nettoyage de données de site efface cinq
mois de progression sans recours.
