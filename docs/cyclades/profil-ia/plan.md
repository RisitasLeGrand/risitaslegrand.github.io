# Plan — Profil, menu de garde, synthèses pour une IA et import d'une analyse

Livrable de la **phase 0** du prompt complémentaire « profil et initialisation adaptative, menu de
garde, synchronisation intégrale, synthèses pour IA et import d'une analyse au format strict ».

**Aucune ligne de code n'a été écrite pour ce prompt.** Ce document, la liste des questions
(`questions.md`), le schéma d'analyse (`schema-analyse.md`), les maquettes (`maquettes.md`) et les
six décisions (`decisions.md`) sont tout ce que la phase 0 produit, et ils attendent ta validation.

---

## 1. Ce que ce prompt change dans ce qui existe déjà

Trois amendements de la section 0 touchent du code déjà écrit. Les voici mesurés, parce que c'est là
que se cachent les surprises.

### 1.1 La racine du site n'est plus Révisions

Aujourd'hui, `/` **est** le tableau de bord de Révisions : `src/pages/index.astro`, et
`src/lib/branches.ts` déclare `racine: '/'` pour la branche `revisions`. Le prompt demande que `/`
devienne un **menu** qui ouvre le choix entre Odyssée, Sport et Révisions.

Deux façons de le faire, et elles ne coûtent pas la même chose :

| | Ce que ça demande | Ce que ça casse |
|---|---|---|
| **A. Déplacer toute la branche sous `/revisions/`** | 17 pages renommées, tous les liens internes, le manifeste de contenu, les chemins d'audio et de podcasts, le *service worker* | Tous les favoris existants ; aucun serveur pour rediriger, GitHub Pages n'en offre pas |
| **B. Ne déplacer que l'accueil** (recommandé) | `/` devient le menu ; le tableau de bord de Révisions passe à `/revisions/` ; les autres pages (`/fiche/`, `/flashcards/`, `/quiz/`…) restent où elles sont | Un favori sur `/` arrive sur le menu, à un clic de l'accueil. Rien d'autre |

**Je recommande B**, et la raison n'est pas la paresse : les pages de Révisions portent déjà des
chemins qui leur sont propres (`/flashcards/`, `/planification/`), elles ne gagnent rien à être
nichées, et un renommage massif de chemins est exactement le genre de changement qui casse en
silence une ressource chiffrée dont le chemin est écrit dans un manifeste. Le jour où Sport aura des
pages, elles naîtront directement sous `/sport/`.

**À corriger en conséquence** (le prompt le demande explicitement) : « page d'accueil » désigne
désormais l'accueil de **Révisions**. Les occurrences à reprendre sont connues —
`docs/cyclades/plan.md` (deux endroits, dont « `tr.recul-sauvegarde` sur la page d'accueil »),
`docs/cyclades/indicateurs.md`, le commentaire d'en-tête de `src/lib/branches.ts` qui annonce encore
« Odyssée … deviendra la page d'accueil », et les liens de retour de la rubrique Actualités.

### 1.2 Le mot « profil » est déjà pris

`etat.profil` porte aujourd'hui l'XP, la série et les badges. Le **profil commun** de ce prompt est
autre chose. Il ne faut pas les mélanger, et il ne faut pas renommer l'ancien — la clé est lue par
des installations existantes. Le profil commun sera donc écrit ailleurs, sous un nom distinct
(proposition : magasin `profilChamps`, un enregistrement **par champ**).

### 1.3 Une dépendance que je signale avant de commencer : les faits ne voyagent pas

La vérification automatique des chiffres cités (B.6.4) demande de **recalculer un indicateur à la
version des données de l'export**. C'est faisable exactement là où les données sont **journalisées**
— le journal d'opérations et le journal de révisions sont en ajout seul et totalement ordonnés par
horloge logique, donc « rejouer à l'état du 12 juillet » consiste à filtrer sur la borne de
l'horloge. Ce n'est **pas** faisable ailleurs.

Or, à la fin de la phase 5 du chantier de synchronisation, je l'ai écrit dans `plan.md` : **les faits
de domaine (séances, quiz, Cog-Training, QCM) ne sont pas journalisés**. Ils ne voyagent donc pas
entre appareils, et ils ne peuvent pas être rejoués à une version antérieure.

Cela a deux conséquences, et aucune ne doit être découverte en route :

1. **La « synchronisation intégrale » de la section 0.2 n'est pas tenue aujourd'hui.** Deux appareils
   n'aboutissent pas à la même empreinte globale sur les faits de domaine, parce que ces faits ne
   sont pas transportés. L'exigence du prompt est juste ; elle demande un chantier nommé.
2. **Sans journalisation, la vérification des chiffres serait « non vérifiable » presque partout**,
   ce qui viderait B.6.4 de son intérêt.

D'où une **phase préalable** dans le plan ci-dessous. Elle n'est pas dans la partie C du prompt, et
je la propose parce que les phases 3 et 4 reposent dessus.

### 1.4 Le catalogue d'indicateurs n'existe pas encore en code

L'export demande `indicateurs.json` : « catalogue d'indicateurs (identifiants stables, formule,
unité, source, fiabilité) et leurs valeurs par période ». Le catalogue existe aujourd'hui comme
**document** (`docs/cyclades/indicateurs.md`, 52 indicateurs dont 14 calculables) ; sa version code
(`src/lib/odyssee/indicateurs.ts`) était prévue pour la phase 4 du plan Cyclades, qui n'est pas
faite. La règle de fiabilité, elle, est écrite depuis la phase 3f (`fiabilite.ts`).

Je ne propose pas d'attendre Odyssée : je propose de construire le catalogue **réduit aux
indicateurs calculables aujourd'hui** (les 14 de Cognition et Connaissances, nourris par Révisions),
avec les identifiants stables du document. Un export qui annonce 52 indicateurs dont 38 vides serait
moins honnête qu'un export qui en annonce 14 et dit pourquoi.

---

## 2. Le plan en phases

Les phases suivent la partie C du prompt, avec la phase préalable du 1.3 et les dépendances dites.

### Phase 0 — Ce document. *Fait.*

Plan, liste des questions, schéma d'analyse, maquettes, décisions. **Validation attendue.**

### Phase A — Les faits de domaine deviennent journalisés *(préalable, nouveau)*

> **A1 faite, le 11 octobre 2026.** Cinq magasins d'événements immuables — quiz de cours, QCM
> DGFiP, Quad N-Back, Relational Reasoning, Veridical Mapping — entrent au journal et voyagent.
> L'opération porte **l'enregistrement entier** et non le fait typé : le fait typé est une vue,
> faite pour les indicateurs, et faire voyager la vue aurait perdu des données à chaque
> synchronisation. Le **socle est déterministe** — identifiant dérivé de la cible, horloge au
> plancher, appareil nommé `socle` —, de sorte que deux appareils migrés séparément produisent la
> même opération et se réconcilient en silence ; un même enregistrement de contenus différents
> donne le même identifiant, et c'est alors une **collision** signalée, ce qui est exactement ce
> qu'on veut. L'effacement ciblé journalise désormais ses suppressions, sans quoi la première
> synchronisation les aurait ressuscitées.

> **A2 faite, le 12 octobre 2026.** Les trois entités qui demandaient chacune leur règle.
>
> **Les séances** : dernière écriture gagne, ce qui est juste — leurs champs sont objectifs, et
> l'écriture la plus récente est la mieux informée. Leur suppression emporte leur note.
>
> **Les notes de séance** : un **second** registre de types à conflit, `TYPES_TEXTE_A_CONFLIT`.
> La première liste porte un invariant vérifié — un type à conflit explicite est un type *sensible*
> au sens de E.5 —, et une note de séance n'est pas sensible : ce n'est ni de la santé, ni de la
> psyché, ni des finances. Elle est **irremplaçable**, ce qui n'est pas la même chose. « Sensible »
> dit qui peut la lire ; « irremplaçable » dit ce que coûte sa perte. Deux raisons de montrer le
> désaccord, donc deux listes, chacune avec son contrôle. La plus récente s'affiche en attendant, et
> **la réponse décide** : `materialiser` lit les résolutions du journal — elles sont des opérations,
> donc elles voyagent, donc les deux appareils écrivent la même version.
>
> **L'état des fiches** se **combine** et ne s'écrase pas : lue sur l'ordinateur, prétestée sur le
> téléphone, les deux doivent tenir. `lu` par ou logique, `pretesteeLe` par la plus ancienne date
> (l'effet de prétest tient à ce qu'il précède la lecture), `pretestPasseLe` par la plus récente,
> `pretestVues` par union, `derniereOuverture` par la plus récente, `secondes` par le **maximum** —
> qui sous-estime quand on a lu la même fiche sur deux appareils, et ne surestime jamais : une
> surestimation ferait croire à un travail qui n'a pas eu lieu. Ils n'entrent au journal qu'au
> changement réel, l'écriture ayant lieu à chaque ouverture de fiche.
>
> Et une conséquence du socle déterministe qu'il a fallu trancher : pour ces trois magasins, le
> socle est **par appareil**. Un socle partagé aurait donné le même identifiant aux deux versions,
> l'union n'en aurait gardé qu'une — choisie par une règle de départage sans sens métier — et la
> seconde aurait disparu sans que rien ne le dise. Les cinq magasins d'événements immuables gardent
> leur socle partagé, qui est tout leur intérêt.
>
> Au passage, un défaut d'affichage qui devenait un défaut de sûreté : l'écran des conflits
> insérait `JSON.stringify(charge)` dans du HTML. Depuis que les enregistrements voyagent, cette
> charge peut être une note de deux pages écrite à la main — illisible, et **non échappée**. Elle
> est désormais résumée (début du texte, compte de signes, nombre de restitutions) et échappée sans
> exception.
>
> Reste hors du périmètre : les compteurs de tirage DGFiP, état dérivé que l'historique ne permet
> pas de recalculer.


Ce que la synchronisation intégrale (0.2) exige, et ce dont la vérification des chiffres (B.6.4) a
besoin.

- Une opération journalisée par fait de domaine : séance terminée, session de QCM, session de
  Cog-Training, prétest, fiche achevée. Le magasin reste la source d'affichage ; le journal devient
  la source de **vérité transportable**, comme pour FSRS depuis la phase 1b.
- Un **socle** pour l'existant, exactement comme pour FSRS : une entrée par fait déjà enregistré,
  marquée comme socle, reprise telle quelle. L'historique d'avant la migration n'est pas
  recalculable — il est repris, ce qui est honnête.
- L'empreinte d'état couvre alors les faits, et deux appareils peuvent se dire « identiques ✓ » sur
  les trois branches.
- `rejouerJusqua(borne)` : reconstruire l'état d'un indicateur à une borne d'horloge logique donnée.
  C'est la brique que la vérification des chiffres appellera.

**Essais** : deux appareils, une séance de chaque côté, même empreinte après fusion ; un indicateur
rejoué à une borne antérieure rend la valeur d'alors ; une compaction passée rend `non vérifiable`
et non une valeur fausse.

### Phase B — Le profil commun et « Mon profil » *(= phase 1 du prompt)*

> **B1 faite, le 12 octobre 2026.** Le modèle, le menu de garde et l'écran « Mon profil ».
>
> **Le profil est son journal.** Une opération par champ, cible `profil:<champ>`, et rien d'autre :
> pas de magasin. Trente champs font trente opérations que le journal porte et transporte déjà ; y
> ajouter un magasin aurait fait deux vérités du même champ. Conséquences obtenues sans rien
> écrire de plus : la fusion **champ par champ** d'A.6 (dernier écrivain par champ), la portée par
> champ, la suppression par champ, le versionnement par champ. Modifier le prénom ici et l'heure de
> lever là ne fait aucun conflit.
>
> **La divergence est vue, pas seulement fusionnée.** A.6 demande « une question de confirmation en
> cas de divergence ». La fusion a déjà lieu ; ce que `divergences()` ajoute, c'est de savoir
> qu'une valeur en a remplacé une autre, et laquelle. Deux écritures du même appareil n'en sont pas
> une : c'est une correction, et la personne a changé d'avis sur sa propre machine.
>
> **L'initialisation est un fait journalisé**, pas un drapeau local — sans quoi le téléphone
> reposerait les quatorze questions. C'est l'exigence d'A.6 tenue par le modèle.
>
> **Aucun champ sensible n'est dans le profil commun**, et l'essai le vérifie plutôt que de le
> promettre : il cherche un champ qui porterait le nom d'un type de fait sensible, et un champ
> nommé « blessures ». Une blessure connue reste un fait `sport.blessure`, sous la matrice.
>
> **Le menu de garde** est à `/`, et l'accueil de Révisions a suivi à `/revisions/` — l'option B du
> 1.1, qui ne déplace que l'accueil. L'en-tête porte désormais **deux** liens : le nom du produit
> ramène au menu, celui de la branche à son accueil. Le menu n'affiche **rien** de personnel hors
> le prénom : pas d'XP, pas de série, pas de carte due. Un menu qui annoncerait le retard du jour
> transformerait la porte d'entrée en reproche.
>
> **« Mon profil »** dit, pour chaque champ, sa valeur, **qui le lit**, d'où il vient (déclaré ou
> observé) et ce qu'il **règle** dans l'application. La portée se change par des cases, une par
> branche. La saisie passe par une invite du navigateur, et c'est assumé : l'écran d'initialisation
> de B2 portera les vrais champs, et laisser « Mon profil » en lecture seule en attendant aurait
> été pire — A.3 demande qu'on puisse corriger à tout moment.
>
> Un défaut trouvé au passage, dans un essai voisin : il comptait en jours **calendaires** là où le
> site compte en jours **logiques**, et échouait donc chaque nuit entre minuit et 4 h. Corrigé, avec
> la raison écrite.
>
> **Essais** : `essais:profil` (60 contrôles) et `essais:profil:navigateur` (33, dont le menu sans
> donnée personnelle, la salutation qui apparaît et disparaît avec le prénom, la portée qui tient
> après rechargement, et la suppression qui remet le champ dans les restants).

- **Modèle** : un enregistrement par champ — `{ champ, valeur, portee, sensible, source, modifieLe,
  version }` — et une **opération journalisée par champ** (`profil.champ`, cible
  `profil:<champ>`). Conséquence heureuse : la fusion champ par champ réclamée par A.6 est **déjà
  écrite** (dernier écrivain par champ sur `(hlc, appareil, valeur)`), et une divergence réelle
  passe par la notification de correction de la phase 3c, avec ses quatre issues. Rien de neuf à
  inventer pour ça.
- **Interface du cœur** : `lireProfil(branche)` rend les champs dont la portée inclut la branche.
  Un champ restreint est **retiré**, pas masqué — la matrice de permissions de la phase 3b a déjà
  tranché ce point, et pour la même raison : rendre un champ caviardé apprendrait qu'il existe.
- **Écran « Mon profil »** : chaque champ avec sa valeur, sa portée (« utilisé par Révisions et
  Sport »), un bouton pour restreindre, un pour supprimer, et l'historique de ses versions.
- **Salutation par le prénom** sur le menu, réglage désactivable, et rien d'autre de personnel.
- **Initialisation allégée pour l'existant** (A.7) : préremplie de ce qui est déduit sans rien
  écraser — parcours INSP actif, matières déjà travaillées, heures d'usage observées, série et
  record repris du socle d'activité. Chaque préremplissage est **affiché comme déduit** et attend
  confirmation : une valeur devinée présentée comme déclarée est un mensonge qui dure des mois.

### Phase C — Initialisation, modules par branche, adaptation *(= phase 2)*

> **C1 faite, le 12 octobre 2026.** Le parcours, les reports, les modules de branche et
> l'initialisation allégée.
>
> **Le report est journalisé, et c'est tout le parcours qui tient là-dessus.** Toucher
> « Plus tard » sur l'heure de lever, fermer l'onglet, revenir : si le report n'est pas gardé,
> l'écran repose la même question, et la personne comprend qu'on ne l'a pas écoutée. Un drapeau
> local aurait suffi à un seul appareil ; le fait journalisé vaut pour les deux. « Réglée » couvre
> donc **répondue ou reportée** — sans quoi le parcours ne se terminerait jamais —, et la question
> reportée reparaît dans « Mon profil », parmi les champs restants : l'endroit prévu pour y
> revenir quand on veut, et non celui où l'on est retenu.
>
> **Un écran peut régler deux champs.** La question 3 — « Français, et heure de Paris : c'est bien
> ça ? » — en règle deux. Les poser séparément aurait affiché deux fois la même phrase, et la
> seconde aurait paru un bug. Le regroupement se fait sur la **question affichée**, pas sur une
> liste de champs : deux champs qui recevraient un jour la même formulation seraient réunis sans
> qu'on y pense, et un contrôle vérifie que la liste `GROUPES` ne nomme que des champs qui posent
> bien la même question.
>
> **Les réponses proposées sont des données, pas du HTML.** Les choix fermés des quatorze
> questions et des modules vivent dans le cœur, et un essai vérifie que **chaque valeur proposée
> passe la validation de son champ** : un bouton qui écrit une valeur refusée est un écran mort, et
> il ne se découvre qu'en cliquant. Le même contrôle exige que **tout champ déclaré sache se
> poser** — liste de choix, bornes, saisie libre de sa nature, ou registre nommé. Un champ ajouté
> sans moyen de répondre ne se verrait qu'en arrivant dessus.
>
> **L'initialisation allégée (A.7) propose au lieu de demander, et le dit.** Sept déductions :
> le parcours ouvert, le rythme hebdomadaire médian, le temps disponible — **plancher**, pas
> estimation, parce qu'on a au moins le temps qu'on a déjà passé —, le moment préféré, les
> matières solides et fragiles d'après le niveau estimé, et un domaine que l'usage montre et que
> le défaut n'allume pas. Chacune porte **le constat qui l'établit** en français, et rien n'est
> écrit avant qu'on ait continué. Trois règles d'honnêteté tenues par des essais : **aucune
> déduction sans effectif** (six faits, et un niveau non fiable ne devient jamais une matière
> « solide ») ; **le constat dit ce qui a été vu**, pas ce qui en est conclu ; et **ce qui n'est
> pas observable n'est pas déduit** — les jours de travail, par exemple, parce que les jours où
> l'on révise ne sont pas les jours où l'on travaille, et que pour beaucoup c'est l'inverse.
>
> La `Source` d'un champ compte désormais **trois** valeurs et non deux, comme A.3 le disait
> depuis le début : déclaré, observé, **observé puis confirmé**. Les fondre aurait effacé la seule
> information qui serve le jour où un réglage est faux — savoir si c'est une déclaration qui
> l'était, ou une déduction.
>
> **Les huit domaines entrent en code** (`noyau/domaines.ts`), cinq allumés, pour que la question
> 12 ait ses libellés et que la roue d'équilibre n'invente pas les siens.
>
> **La garde est aux deux portes** : `/` mène à l'initialisation tant qu'elle n'a pas eu lieu,
> `/revisions/` à ses six questions tant qu'elles n'ont pas été posées. Elle ne retient personne —
> « Terminer maintenant » est sur chaque écran —, et le socle passe avant le module : demander les
> matières fortes avant d'avoir montré à quoi elles servent, c'est demander à quelqu'un de se
> noter sur un programme qu'il n'a pas vu.
>
> Un défaut de méthode corrigé au passage : « l'installation porte-t-elle de l'usage ? » se lisait
> d'abord dans le **journal**. Une base restaurée d'une sauvegarde, ou migrée avant que son socle
> soit posé, porte des séances sans porter leurs opérations — et aurait donc reçu les quatorze
> questions complètes. La question se lit maintenant dans les magasins, au premier non vide.
>
> **Essais** : `essais:initialisation` (119 contrôles) et `essais:initialisation:navigateur` (50,
> dont le report qui tient après rechargement, le module posé une seule fois, et la déduction
> confirmée écrite « observé, puis confirmé » et jamais « déclaré »). Deux suites voisines
> traversent désormais la garde comme une personne le ferait, par « Terminer maintenant » : un
> essai qui passerait par la porte de service cesserait de remarquer que la porte principale est
> cassée.

> **C2 faite, le 12 octobre 2026.** L'adaptation, et les réglages déduits avec leur cause.
>
> **Les réglages déduits ne sont pas des champs.** Le §3 de `questions.md` le posait : « aucune de
> ces déductions ne modifie une donnée. Elles changent des **réglages**. » L'heure de bascule du
> jour logique découle de l'heure de lever ; ce n'est pas une seconde vérité sur le lever, c'est une
> conséquence. En faire un champ aurait créé deux valeurs à tenir d'accord, et le jour où elles
> divergent, la personne ne saurait plus laquelle elle a dite. Huit réglages, chacun affiché avec
> **la réponse dont il découle** et ce qu'il ne change pas : « votre bascule de journée est à 6 h
> parce que vous vous levez à 7 h ; la changer ne changera pas votre heure de lever ». Et chacun
> existe toujours : faute de réponse, il porte sa valeur d'usine et **le dit**, au lieu de
> disparaître — une liste qui se vide laisserait croire qu'il n'y a pas de réglage.
>
> **Cinq règles d'adaptation, et deux seuils par règle plutôt qu'un.** Le rythme déclaré contre
> l'observé ne se signale que si l'écart est à la fois grand **en proportion** et grand **en
> heures** : le seuil relatif seul ferait proposer de passer de 1 h à 1 h 30, le seuil absolu seul
> ferait proposer de passer de 30 h à 28 h. Un domaine muet depuis un mois n'est proposé à
> l'extinction que s'il n'est **pas le seul** à l'être : tous muets veut dire que l'application
> n'est pas utilisée, pas que les domaines sont mal choisis — prendre une absence pour un choix est
> la faute la plus facile ici. Et un coucher déclaré après minuit se compare dans le **jour
> logique** : 1 h est postérieur à 23 h, pas antérieur.
>
> **« Au plus une par semaine » porte sur l'attention demandée, pas sur la règle.** Le plafond se
> mesure sur **toutes** les décisions : avoir refusé une proposition lundi ne doit pas en faire
> apparaître une autre mardi. Il se lit dans le journal et non dans un compteur local, sans quoi
> deux appareils en proposeraient deux. Un refus est **définitif** — pas « pas avant trois mois » :
> jamais. Redemander ce qu'on a refusé est la façon la plus sûre de faire désinstaller un logiciel.
>
> **Le silence a sa raison, et « Mon profil » la donne.** Trois silences distincts : aucun écart,
> un écart connu qui attend son tour, ou des écarts qui portent tous sur des questions refusées.
> L'écran montre **tous** les écarts détectés, même ceux qu'il ne proposera pas aujourd'hui :
> quelqu'un qui ouvre cette page a le droit de savoir ce que Cyclades a remarqué, plutôt que de
> l'apprendre dans trois jours.
>
> **« Réinitialiser l'adaptation » retrouve la valeur déclarée au lieu de la deviner.** Le journal
> garde toutes les versions de chaque champ : la remise relit celle qui précédait l'acceptation. Un
> « retour aux valeurs par défaut » aurait effacé la déclaration en même temps que l'adaptation, et
> la personne aurait perdu une réponse qu'elle avait donnée. Deux acceptations successives sur le
> même champ se défont **d'un coup**, jusqu'avant la première : remonter d'un cran laisserait une
> valeur que personne n'a jamais déclarée. Un refus, lui, n'est pas défait par la remise — refuser
> n'est pas une adaptation, c'est son contraire.
>
> Le défaut qu'un essai a trouvé là : `accepter()` écrit le champ **puis** journalise la décision,
> dans cet ordre, pour qu'aucune décision ne prétende qu'une écriture a eu lieu si elle a échoué.
> La remise cherchait donc « la dernière écriture avant la décision » — qui est celle de
> l'adaptation elle-même. Elle réécrivait la valeur adaptée et ne défaisait rien. La décision porte
> désormais ce qui avait été proposé, et la remise écarte par la valeur, pas par la position.
>
> **Pourquoi un écart déclaré/observé n'est pas un désaccord au sens de 3f.** La phase 3f montre
> des désaccords entre **faits** : deux faits qui ne peuvent pas être vrais ensemble — un sommeil
> de neuf heures dans une nuit où une séance a eu lieu. Une déclaration et un fait, eux, ne se
> contredisent pas de cette façon : l'un dit ce qui s'est passé, l'autre ce qu'on fait
> d'habitude. Aucune des deux n'est fausse, et la seule réponse admissible est de poser la
> question. L'adaptation ne touche donc **jamais** un fait, et `desaccords.ts` n'a reçu aucune
> règle nouvelle : il lui en faudra le jour où une seconde branche publiera des faits.
>
> Un troisième silence est né d'un essai de navigateur : l'écran disait « vous avez refusé » à
> quelqu'un qui venait de répondre « plus tard ». Les deux états étaient confondus parce qu'ils
> produisent le même silence, et dire l'un pour l'autre est une petite trahison — elle se remarque.
> Un report rend désormais le délai qui lui reste, et « tout refusé » n'est dit que quand c'est vrai
> de tous les écarts connus.
>
> **Essais** : `essais:adaptation` (89 contrôles) et `essais:adaptation:navigateur` (27, dont le
> plafond hebdomadaire après une réponse, l'acceptation écrite « observé, puis confirmé » et jamais
> « déclaré », la remise qui retrouve la valeur déclarée, et les huit réglages déduits affichés avec
> leur cause).

- Le parcours : mot de passe → *(première fois)* initialisation → menu. Une question à la fois,
  boutons et suggestions, « Plus tard » partout sauf le prénom, reprise après fermeture (l'avancement
  est un champ de profil comme les autres, donc il se synchronise).
- Les modules de branche, posés **à la première entrée dans la branche**.
- L'adaptation : ce qui est **observé** localement et sans aucune IA (heures d'usage, jours
  effectifs, durée moyenne, régularité, domaines délaissés) donne des **propositions** — au plus une
  par semaine, jamais bloquante, acceptées, reportées ou refusées, **refus mémorisé**, et un bouton
  « Réinitialiser l'adaptation » qui remet tous les réglages adaptatifs à leur valeur déclarée.
- Les écarts entre le déclaré et l'observé deviennent soit une question de confirmation, soit — pour
  un **fait** — un désaccord au sens de la phase 3f. Le mécanisme existe, il attend ses règles.

### Phase D — Le catalogue d'indicateurs et les synthèses *(= phase 3)*

> **D1 faite, le 12 octobre 2026.** Le catalogue, les périodes, les comparaisons et les séries.
>
> **Quinze entrées, et pas cinquante-deux.** `docs/cyclades/indicateurs.md` en décrit cinquante-deux
> pour les cinq domaines d'Odyssée ; quatorze sont calculables aujourd'hui, parce que seule
> Révisions publie des faits. Le code ne déclare que celles-là, plus `tr.couverture-mesure`, qui se
> calcule sur le catalogue lui-même. Un export qui annoncerait cinquante-deux indicateurs dont
> trente-huit vides serait moins honnête qu'un export qui en annonce quatorze et dit pourquoi ; le
> reste attend sa branche, nommé, dans le document.
>
> **`null`, jamais zéro, et l'essai le vérifie indicateur par indicateur.** « Aucune donnée » et
> « zéro » sont deux choses différentes, et les confondre fait passer un domaine non mesuré pour un
> domaine délaissé. La règle ne tient que si l'**assembleur** la respecte aussi : un bloc de fenêtre
> qu'on ne sait pas remplir reste absent, car un `cartes: []` à la place d'un `cartes` manquant
> transformerait « on ne sait pas » en « aucune carte n'atteint 0,9 » — une mesure, et fausse.
> Un seul indicateur inverse la distinction, et il porte son commentaire : `cog.charge-arrieree`
> rend zéro quand des cartes existent et qu'aucune n'est due, et `null` quand il n'y a pas de
> cartes du tout.
>
> **La pente de la courbe d'oubli rend `null` quand tous les intervalles sont égaux.** Rendre zéro
> dirait « l'oubli ne joue pas », ce qui est une affirmation forte tirée d'une absence de variation.
>
> **Le pivot commande la dégradation.** `fiabilite.ts` savait déjà dégrader ; ce qui manquait, c'est
> que la fenêtre porte les désaccords **entiers** et non un compte, pour que `evaluer` fasse le tri
> par indicateur. Un conflit sur une source étrangère ne touche donc plus rien, un conflit sur une
> source secondaire abîme de moitié, un conflit sur le pivot annule — et les trois cas ont leur
> essai.
>
> **Les périodes sont calendaires et non glissantes.** « Cette semaine » est la semaine du lundi au
> dimanche, pas les sept derniers jours. Une période glissante ne se compare pas à la précédente —
> elles se chevauchent —, et toute la comparaison repose là-dessus. Les essais couvrent la fin de
> mois, la fin d'année et le 29 février 2028.
>
> **La comparaison ne juge pas ce qui ne se juge pas.** Un indicateur `neutre` reçoit un **écart** et
> jamais un verdict : l'écart est un fait, le verdict est une opinion. E.3 l'exige pour le corps et
> l'humeur ; le catalogue étend la règle au taux de bonnes réponses — qui dépend de la difficulté
> tirée, donc un taux qui monte parce que le tirage s'est adouci n'est pas un progrès — et au niveau
> estimé, qui n'est pas une note de valeur. Un essai vérifie qu'aucun indicateur neutre ne reçoit
> « mieux » ni « moins bien », et un contrôle du catalogue qu'aucun ne porte de cible proposée.
>
> **La résolution des séries se dégrade avec l'ancienneté**, et la règle est déclarée et non
> choisie à l'affichage : au jour sur trente jours, à la semaine sur un an, au mois au-delà. La
> valeur d'un pas est la **moyenne** et non la somme — une somme mensuelle à côté de valeurs
> journalières écraserait les jours récents, et une courbe de régularité additionnée n'a aucun sens.
>
> **La rétention est demandée à la bibliothèque** (`retentionPredite`, nouvelle dans `srs.ts`) et non
> recalculée : la courbe d'oubli de FSRS a changé de formule entre deux versions majeures, et une
> copie locale aurait divergé en silence à la montée de version.
>
> **« Mes synthèses »** affiche les trois sections : les mesures avec leur formule, leur source,
> leur effectif et leur fiabilité ; la comparaison avec la période précédente ; et **ce qui n'a pas
> pu être mesuré**, avec la source qui manque. La troisième est celle qui manque partout : sans
> elle, une couverture de 50 % se lit comme un échec plutôt que comme l'état normal d'un tableau de
> bord dont une seule branche sur trois publie.
>
> **Essais** : `essais:indicateurs` (116 contrôles) et `essais:indicateurs:navigateur`.

- `indicateurs.ts` : les 14 indicateurs calculables aujourd'hui, identifiants stables du document,
  formule en français, unité, sources (pivot en premier, comme `fiabilite.ts` l'attend), fréquence,
  minimum d'effectif. `calcul` rend `null`, jamais zéro.
- Les synthèses : période (semaine, mois, trimestre, année, libre), bilan global, par domaine ou
  transversale. Précalcul des indicateurs, détail à part, séries à résolution dégradée avec
  l'ancienneté.
> **D2 faite, le 12 octobre 2026.** Les huit fichiers, le manifeste, le journal et l'assistant.
>
> **Le schéma est une donnée, et il n'est écrit qu'une fois.** Trois choses en ont besoin et doivent
> dire la même : le `schema-analyse.json` servi avec l'export, que l'IA lit ; le validateur de
> l'import, qui refuse ce qui n'est pas conforme ; et `exemple-analyse.json`, qui doit passer ce
> validateur. Un fichier écrit à la main et un validateur écrit à la main divergent au premier champ
> ajouté, et la divergence ne se voit pas — l'IA suit le fichier, le site suit son code, et l'import
> refuse une réponse pourtant conforme à ce qu'on avait demandé. `noyau/schema-analyse.ts` porte la
> déclaration ; le fichier en est le rendu, et le validateur de la phase E en sera le lecteur.
> L'exemple est **engendré** sur un vrai identifiant d'indicateur et de l'export courant, donc il
> passe le schéma par construction : un exemple non conforme apprendrait le mauvais format, ce qui
> est pire qu'aucun exemple.
>
> **`additionalProperties: false` partout, et c'est ce qui tient E.1 et E.4.** Les garde-fous ne
> reposent pas sur la prudence du modèle : la `nature` d'une proposition est fermée à
> l'organisation, aux habitudes, aux mesures, aux questions et aux vérifications de données. Une IA
> qui proposerait une dose, un protocole ou un placement n'a **aucune valeur pour le dire**, et sa
> réponse est refusée à l'import. Un essai le vérifie sur une nature « dose » et sur un champ
> `conseil_medical` ajouté à la racine.
>
> **Trois champs sont facultatifs** — les questions, les remarques de qualité, les limites
> globales : une IA qui n'a rien à demander ni à signaler doit pouvoir répondre sans inventer des
> listes vides.
>
> **Les protections de E.7 vivent dans le catalogue, pas dans l'écran.** Catégories sensibles
> décochées, textes libres et profil exclus par défaut : un garde-fou qui vit dans une case à cocher
> se perd à la première refonte de l'interface, et personne ne s'en aperçoit. Le contrôle du
> catalogue refuse une catégorie sensible cochée par défaut, et l'essai de navigateur vérifie
> qu'une confirmation **refusée** laisse la case décochée.
>
> **Le prénom et le nom ne traversent jamais l'export**, quelle que soit la sélection : A.5 ne
> laisse pas de case à cocher là-dessus, et le module les retire avant de construire. Par-dessus,
> un **contrôle** les cherche dans tous les fichiers — y compris dans les textes libres, où la
> personne peut s'être nommée elle-même — et refuse l'écriture s'il les trouve. C'est le filet, pas
> la règle.
>
> **Le catalogue exporté porte tous les indicateurs, mesurés ou non**, et les valeurs absentes
> sortent en `null` avec la raison. Une IA qui ne verrait que ce qui est mesuré ne pourrait pas
> signaler ce qui manque, et le type de constat `lacune_de_donnees` perdrait son objet.
>
> **Le vecteur de versions dit aussi quand la vérification sera impossible.** Les bornes d'horloge
> par appareil disent jusqu'où le journal portait ; le périmètre de compaction dit ce qui avait déjà
> été effacé. Sans le second, une preuve portant sur une période compactée serait recalculée sur un
> journal amputé et déclarée « non retrouvée » — alors que la bonne réponse est « non vérifiable ».
> `qualite-des-donnees.md` le dit en français.
>
> **Le journal des exports est une opération, pas un magasin** — comme le profil, et pour la même
> raison. Il porte l'identifiant, l'empreinte, la date, la portée, les catégories et le poids ;
> **jamais le contenu**, et un essai de navigateur lit l'opération en base pour le vérifier.
> L'inscription a lieu **après** le téléchargement : un export construit pour l'aperçu puis
> abandonné n'a jamais quitté la machine, et l'inscrire ferait croire qu'il est dehors.
>
> **L'empreinte couvre les noms et les contenus**, dans l'ordre : deux exports aux mêmes contenus
> sous des noms différents ne sont pas le même export. Le manifeste est construit en dernier,
> puisqu'il porte l'empreinte des autres et ne peut pas s'inclure dans son propre hachage.
>
> **Le découpage proposé est par domaine, puis transversal**, et non par période : une IA qui ne
> voit qu'un trimestre ne peut rien dire d'une tendance annuelle, alors qu'elle traite parfaitement
> un domaine à la fois.
>
> **Essais** : `essais:export-ia` (93 contrôles, dont un lecteur minimal de la déclaration qui
> prouve que l'exemple passe le schéma) et `essais:export-ia:navigateur` (57, dont la confirmation
> refusée, l'empreinte du manifeste téléchargé rapprochée de celle du journal, et l'opération
> journalisée sans un octet de contenu).

- Les huit fichiers de B.3, la variante fichier unique, le `manifest.json` avec l'identifiant
  d'export, l'empreinte SHA-256 et le **vecteur de versions** (les bornes d'horloge par appareil,
  plus le périmètre de compaction — c'est ce qui rend la vérification possible, et ce qui dit quand
  elle ne l'est pas).
- Le **journal des exports** : identifiant, empreinte, date, périmètre, **jamais le contenu**.
- Les protections de E.7 sans changement : catégories sensibles décochées par défaut, textes libres
  exclus par défaut, confirmation par catégorie, aperçu avant génération, aucune copie conservée.
- L'estimation de taille et la proposition de découpage.

### Phase E — Le schéma strict, l'import, la vérification *(= phase 4)*

> **E faite, le 12 octobre 2026.** Le validateur, l'enveloppe, le prompt de réparation, la
> vérification des chiffres, l'aperçu, le tri et la conservation.
>
> **Le validateur lit la déclaration du schéma**, pas une copie. Écrit à côté, il aurait divergé du
> fichier servi à l'IA au premier champ ajouté — et l'import aurait refusé une réponse pourtant
> conforme à ce qu'on avait demandé. Il est **écrit à la main**, parce que les messages en français
> avec le chemin exact — « constats[2].preuves[0].indicateur : identifiant inconnu » — **sont** la
> fonctionnalité : ce sont eux qui nourrissent le prompt de réparation, la seule façon de faire
> corriger une IA sans l'appeler.
>
> **Enveloppe tolérante, contenu strict.** Un bloc de code, une phrase d'introduction, une
> conclusion, une virgule finale : retirés, et **dits** — l'écran annonce ce qu'il a enlevé, car
> taire un retrait ferait croire que le texte collé était propre. Le contenu, lui, ne se négocie
> pas, et **rien n'est importé partiellement** : l'analyse est entière ou nulle.
>
> **Les quatre références croisées sont la moitié du travail.** Le schéma dit la forme ; il ne dit
> pas qu'un `lie_aux_constats` pointe sur un constat qui existe, qu'un identifiant d'indicateur est
> au catalogue, que les identifiants sont uniques *dans toute l'analyse* et que les dates tombent
> dans la période. Ce sont ces quatre contrôles qui attrapent une IA qui a inventé. Elles ne sont
> cherchées que si la forme tient : chercher un lien dans un objet dont `constats` n'est pas une
> liste produirait des messages qui parlent d'un autre problème que le vrai.
>
> **Quatre verdicts, et les deux qui manquent partout.** « Approché » : une IA qui lit 5,3 h et cite
> 5 h n'a pas inventé, elle a arrondi, et la signaler comme fausse ferait cesser de lire les
> verdicts. « Non vérifiable » : une compaction a effacé le détail, ou l'unité ne correspond pas —
> dire « non retrouvé » accuserait l'IA d'avoir inventé alors que c'est **nous** qui ne savons plus.
> C'est la distinction la plus importante du module, et l'ordre des contrôles la protège :
> l'impossibilité de vérifier passe **avant** la comparaison.
>
> **L'unité ne se convertit jamais en silence.** Des heures citées là où le catalogue compte des
> secondes donnent « non vérifiable », pas une conversion devinée : une conversion marcherait neuf
> fois sur dix et, la dixième, confirmerait un chiffre faux.
>
> **La borne de compaction est lue du journal local**, et non du manifeste : une compaction peut
> avoir eu lieu **depuis** l'export, et c'est précisément le cas où la vérification devient
> impossible. Lire le manifeste dirait « tout était là au moment de l'export », ce qui est vrai et
> sans intérêt pour un recalcul fait aujourd'hui.
>
> **Une seule preuve non retrouvée rend tout le constat douteux**, et l'écran le signale en
> évidence : un constat bâti sur trois chiffres dont un est inventé n'est pas aux deux tiers juste.
>
> **Le tri refuse d'adopter une action dont le constat est écarté.** Adopter l'action en rejetant sa
> raison laisserait une trajectoire que plus rien ne justifie, et qu'on ne saurait pas évaluer. Le
> plafond de trois trajectoires actives de C.8 est tenu, les questions rejoignent la revue, et les
> remarques de qualité deviennent des « à vérifier » — **jamais** des corrections automatiques.
>
> **L'analyse conservée est une opération journalisée**, donc chiffrée et synchronisée, **étiquetée**
> « analyse externe produite par une IA, non vérifiée ». L'étiquette est posée par le module et non
> par l'appelant : un appelant qui l'oublierait conserverait une analyse d'IA indiscernable d'une
> donnée mesurée. Un export inconnu — journal effacé, autre source — n'empêche pas l'import : il
> porte un avertissement, comme B.6.3 le demande.
>
> **Tout est rendu en texte échappé.** Le site sait rendre du Markdown, pour les fiches qui viennent
> du dépôt ; une analyse importée n'emprunte jamais ce chemin. Et le balisage est refusé **à la
> validation** et pas seulement à l'affichage : un refus à la source évite d'avoir à se demander, à
> chaque rendu, si tel champ a été nettoyé.
>
> Un défaut de formulation trouvé par l'essai de navigateur : une virgule qui traîne après
> l'accolade finale était annoncée comme « une phrase de conclusion ». Ce n'en est pas une, et le
> dire ferait chercher à la personne une phrase qu'elle n'a pas écrite.
>
> **Essais** : `essais:validateur` (88 contrôles), `essais:verification` (57) et
> `essais:import:navigateur` (47, le cycle complet depuis un export réel : un chiffre juste
> confirmé, un chiffre inventé non retrouvé, une unité non convertie, et l'opération journalisée
> avec son étiquette).

- `schema-analyse.json` et `exemple-analyse.json`, servis avec l'export.
- Le validateur : **écrit à la main**, sans dépendance. Un validateur de schéma JSON générique
  pèserait plus que ce qu'il apporte pour un schéma fermé de cette taille, et les messages d'erreur
  en français avec le chemin exact (« constats[2].preuves[0].indicateur : identifiant inconnu »)
  sont précisément ce qu'une bibliothèque rend mal.
- L'enveloppe tolérante : un bloc de code, une phrase d'introduction, une virgule finale sont
  retirés ; le contenu, lui, est strict.
- Le **prompt de réparation**, généré localement, à copier.
- La **vérification des chiffres** : pour chaque preuve, recalcul de l'indicateur sur la période à la
  version de l'export, et quatre verdicts — confirmé, approché, non retrouvé, non vérifiable.
- L'aperçu, le tri (garder / écarter ; adopter / reporter / refuser ; les questions vers la revue ;
  la qualité vers des « à vérifier »), la conservation compressée, chiffrée, synchronisée, étiquetée
  « analyse externe produite par une IA, non vérifiée », rattachée à sa période et à sa revue.

### Phase F — Durcissement, sécurité, documentation *(= phase 5)*

> **F faite, le 12 octobre 2026.** Le durcissement du validateur, l'avertissement décidé
> localement, le bouclage sur cinq ans, le guide et le README.
>
> **Le texte échappé ne suffisait pas.** `textContent` protège du HTML ; il ne protège pas d'un
> Unicode qui ment sur son propre ordre. Une marque bidirectionnelle (`U+202E` et ses voisines)
> retourne l'affichage d'un fragment sans rien changer aux caractères : une proposition peut
> s'afficher à l'envers de ce qu'elle dit, et la lecture humaine — le seul contrôle qui reste une
> fois la forme validée — y perd. Les caractères de contrôle font la même chose au copier-coller.
> Les uns et les autres sont désormais **refusés à la validation**, avec le rappel correspondant
> dans le prompt de réparation : une IA honnête n'en produit pas, et une réponse qui en porte doit
> être refaite, pas nettoyée en silence.
>
> **L'avertissement professionnel se décide ici, pas chez l'IA.** `avertissement_professionnel` est
> rempli par la partie dont on se méfie : s'y fier seul reviendrait à laisser le modèle décider
> quand il doit être encadré. La règle locale déclenche sur le **domaine** (corps, psyché,
> finances) ou la **nature** (une mesure), et le champ de l'IA ne fait que s'y ajouter — d'où les
> quatre origines `regle`, `ia`, `les-deux`, `aucune`, lisibles dans le DOM pour qu'un essai
> distingue « l'écran a averti » de « l'écran a cru l'IA ». La bannière, elle, est permanente :
> aucune analyse importée ne s'affiche sans dire qu'elle vient d'une IA et n'a pas été vérifiée.
>
> **Le bouclage mesure ce que les essais ne disent pas.** Cinq ans synthétiques, **24 354
> enregistrements** semés en 18,5 s, puis le cycle joué par l'interface réelle :
>
> | Étape | Mesure |
> |---|---|
> | Construction de l'export | **45,7 s** |
> | Poids des neuf fichiers | **220 ko**, soit environ **56 300 jetons** |
> | Découpage proposé | non — cela tient en un seul envoi |
> | Validation + vérification à l'import | **28,2 s** |
> | Occupation de la base après bouclage | 13,14 Mo |
>
> L'analyse n'est pas écrite à la main : elle est **engendrée à partir du manifeste et du catalogue
> que l'export vient de produire**, avec un chiffre délibérément faux. Les six chiffres repris sont
> confirmés, le septième n'est pas retrouvé, et le constat qui le porte est signalé. Une analyse
> écrite d'avance aurait cité des chiffres choisis pour passer ; celle-ci cite ce qui existe.
>
> **220 ko est le chiffre qui valide l'architecture.** Le découpage par domaine est écrit et
> testé, mais sur cinq ans d'usage il ne sert pas : une année entière tient dans ce qu'une IA lit
> d'un coup. Si le volume avait débordé, c'est le format qu'il aurait fallu revoir, pas l'envoi.


- Rendu **en texte échappé uniquement**. Le site sait rendre du Markdown — pour les fiches de cours,
  qui viennent du dépôt. Une analyse importée n'empruntera **jamais** ce chemin : `textContent`, pas
  `innerHTML`, aucune image distante, aucun lien ouvert automatiquement.
- Taille maximale à l'import, ensemble de champs fermé, plafonds de nombre et de longueur.
- Bannière permanente, et rappel de consulter un professionnel sur les propositions qui touchent au
  corps ou aux finances — par le champ `avertissement_professionnel` **et** par une règle locale, le
  champ étant rempli par l'IA et donc non fiable.
- Le bouclage complet sur le jeu synthétique de cinq ans, taille et durée mesurées.
- Guide utilisateur : « Mon profil », « Exporter pour une IA », « Importer une analyse ». README mis
  à jour.

---

## 3. Ce que je signale avant de commencer

**Le menu coûte un déplacement d'accueil, pas un renommage du site.** Voir 1.1, option B.

**La synchronisation intégrale n'existe pas encore**, et la phase A est le prix à payer. Je préfère
le dire maintenant qu'après avoir livré un import dont la vérification répondrait « non vérifiable »
à chaque preuve.

**La vérification des chiffres sera parfois impossible, et c'est bien.** Une compaction passée
efface le détail d'avant une borne : le verdict est alors « non vérifiable », jamais une valeur
reconstituée. C'est écrit dans le prompt, et c'est la seule réponse honnête.

**Le profil ne sera pas un objet unique.** Un enregistrement par champ coûte quelques lignes de plus
et donne gratuitement : la portée par champ, la suppression par champ, le versionnement par champ, et
la fusion champ par champ. Un objet unique aurait fait de chaque modification sur deux appareils un
conflit sur tout le profil.

**Trois minutes, c'est quatorze questions.** La liste de `questions.md` est calibrée là-dessus, à
une douzaine de secondes par question, boutons compris. Toute question ajoutée en enlève une autre.

**Je ne construirai pas de garde-fou contre moi-même sur les catégories sensibles** : elles ne sont
pas dans le profil commun, elles restent dans leur domaine sous la matrice de permissions. C'est la
seule architecture qui tient, parce qu'elle ne repose pas sur la discipline d'un écran.
