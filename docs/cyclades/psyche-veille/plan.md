# Veille du rythme de vie — plan et catalogue d'indicateurs (phase 0)

**13 octobre 2026.** Aucun code. Ce document contient l'inventaire que demande
ta section 3.1, le catalogue proposé, la spécification du moteur avec ses
paramètres justifiés, et mes réponses aux neuf décisions.

---

## 1. Ce que je peux construire, et ce que je refuse de laisser croire

Tu demandes un dispositif qui te prévienne **même si tu le nies**. C'est
cohérent : quelqu'un qui va mal est souvent le dernier à l'écrire dans un
check-in, et c'est précisément pour cela qu'un suivi déclaratif seul ne suffit
pas.

Ce que je peux faire tient en une phrase : **comparer tes repères factuels à
ta propre habitude, et te dire quand plusieurs s'écartent ensemble, longtemps.**

Ce que je ne peux pas faire, et qui doit être dit avant tout le reste :

- **Aucune vérité terrain.** Cyclades ne saura jamais si un signal était juste.
  Il n'y a pas d'évaluation clinique à laquelle se comparer, donc pas de
  sensibilité, pas de spécificité, pas de taux de détection. Toute interface
  qui laisserait croire à une précision mentirait.
- **Des faux signaux, et des manqués.** Les associations citées dans ta
  section 1 sont des associations **de groupe**. Une personne dont le sommeil
  est naturellement irrégulier déclenchera moins ; une personne très régulière
  déclenchera pour un déménagement. Les deux sont normaux et aucun réglage ne
  les supprime.
- **Je n'ai lu aucune des deux sources.** La passerelle réseau de cet
  environnement refuse tout, comme pour les échelles. Ta lecture est donc la
  seule, et je ne la reprends pas à mon compte. Heureusement, la conception
  n'en dépend pas : elle ne repose que sur ta ligne de base, et les études ne
  servent qu'à choisir **quelles grandeurs regarder**, pas quels seuils poser.

**L'unité du signal est donc « à examiner », jamais « à croire ».** Tout le
reste du document en découle.

## 2. Inventaire : tout ce que Cyclades enregistre aujourd'hui

Extrait du contrat de faits, pas de mémoire : **34 types déclarés, 7 domaines,
30 magasins journalisés.**

| Domaine | Types de faits |
|---|---|
| **corps** (13) | `sport.seance`, `sport.serie`, `sport.record`, `sport.phase`, `sport.blessure`, `odyssee.poids`, `odyssee.mesure`, `odyssee.sommeil`, `odyssee.repas`, `odyssee.hydratation`, `odyssee.medicament`, `odyssee.statut-hormonal`, `odyssee.sante` |
| **connaissances** (8) | `revision.seance`, `revision.flashcards`, `revision.note-seance`, `revision.fiche`, `revision.pretest`, `revision.qcm`, `revision.niveau`, `odyssee.apport-externe` |
| **psyche** (4) | `odyssee.checkin`, `odyssee.charge-percue`, `odyssee.journal`, `odyssee.revue` |
| **cognition** (3) | `revision.retention`, `revision.cog-training`, `odyssee.focus` |
| **ordre** (3) | `odyssee.tache`, `odyssee.quete`, `odyssee.evenement` |
| **finances** (2) | `odyssee.operation`, `odyssee.valorisation` |
| **lien** (1) | `odyssee.interaction` |

**Ce qui existe en plus des faits**, et que l'inventaire aurait manqué si je
m'étais arrêté au contrat : les **états d'habitudes** (érosion, dormance), le
**journal d'usage sans contenu**, les **occurrences du calendrier** et leurs
annulations, les **motifs de non-réalisation** d'une tâche planifiée (tu les
as demandés explicitement il y a deux prompts), les **trajectoires** ouvertes
et refermées, et les **refus locaux** de Sport.

### 2.1 Les deux natures d'indicateurs, et pourquoi la distinction décide de tout

| | **Déclaratif** | **Observé** |
|---|---|---|
| Origine | tu l'as saisi | l'usage l'a produit |
| Exemples | sommeil, repas, poids, séances | heures d'ouverture de l'application, durée de session, focus réellement lancé, tâches cochées |
| Faiblesse | **disparaît quand tu vas mal** | plus pauvre, plus indirect |

C'est le point dur de ce chantier, et il faut le nommer franchement.
**Quelqu'un qui se dégrade cesse de saisir.** Or ta section 3.4 interdit — avec
raison — de lire une absence comme un comportement : ne pas avoir noté son
sommeil ne veut pas dire qu'on a mal dormi.

Si l'on s'en tient là, la veille s'éteint exactement quand elle servirait.

**La sortie n'est pas d'assouplir la règle, c'est d'avoir des indicateurs qui
ne dépendent pas de la saisie.** Le journal d'usage en fournit trois — heure
d'ouverture, durée, fréquence —, et le focus lancé, les tâches cochées et les
séances démarrées en fournissent d'autres : ce ne sont pas des champs remplis,
ce sont des traces d'actes. Ces indicateurs-là survivent au décrochage.

L'absence, elle, reste traitée pour ce qu'elle est : un **statut « données
insuffisantes »**, nommé et affiché (« le sommeil n'est plus saisi depuis 12
jours »), jamais un élément de preuve.

## 3. Le catalogue proposé

Vingt-deux indicateurs, groupés en **six domaines indépendants** pour le
croisement. Le statut de preuve suit l'échelle des méthodes de musculation :
**solide** (essais contrôlés convergents), **plausible** (associations
observationnelles cohérentes), **faible** (une source, ou contestée),
**heuristique** (raisonnement, aucune étude).

**Aucun indicateur n'est « solide ».** Aucun ne le sera : la littérature citée
porte sur des associations, pas sur des preuves d'effet individuel.

### Domaine A — Sommeil

| id | Définition | Sens préoccupant | Preuve | Confusion |
|---|---|---|---|---|
| `sommeil.duree` | médiane des durées de nuit, 14 j | baisse | **plausible** (revue 2024) | garde d'enfant, travail de nuit |
| `sommeil.irregularite` | écart absolu médian des heures de coucher | hausse | **plausible** (revue 2024, actigraphie 2026) | décalage horaire, week-ends |
| `sommeil.nuits-courtes` | nombre de nuits < 6 h | hausse | plausible | idem |
| `sommeil.phase` | médiane de l'heure de coucher | retard | faible | saison, charge de travail |

**Le plus informatif du catalogue est `sommeil.irregularite`**, et c'est le
seul que les deux sources citées font remonter indépendamment. Il a aussi
l'avantage d'être **insensible au niveau** : quelqu'un qui dort peu mais
régulièrement ne déclenche pas.

### Domaine B — Activité et entraînement

| id | Définition | Sens préoccupant | Preuve | Confusion |
|---|---|---|---|---|
| `sport.frequence` | séances par semaine | baisse | **plausible** (sédentarité, revue 2024) | blessure déclarée, phase de décharge |
| `sport.abandons` | part de séances commencées non terminées | hausse | heuristique | matériel, horaires |
| `sport.rupture` | arrêt ≥ 14 j d'une pratique installée ≥ 8 semaines | survenue | plausible | saison, vacances |

`sport.phase` (décharge programmée) **décote automatiquement** ce domaine :
une décharge est une baisse voulue, et la compter serait absurde.

### Domaine C — Rythme de la journée et usage

| id | Définition | Sens préoccupant | Preuve | Confusion |
|---|---|---|---|---|
| `usage.heure-tardive` | part des sessions entre 1 h et 5 h | hausse | **plausible** (usage accru, revue 2024) | travail, fuseau |
| `usage.duree` | durée médiane d'une session | hausse ou baisse brusque | faible | — |
| `usage.fragmentation` | nombre de sessions par jour | hausse | heuristique | — |
| `jour.amplitude` | écart entre première et dernière trace du jour | hausse | heuristique | — |
| `jour.irregularite-debut` | écart absolu médian de l'heure de première trace | hausse | plausible (par analogie avec le sommeil) | — |

**Ce domaine est le seul entièrement observé.** C'est lui qui tient quand tout
le reste cesse d'être saisi, et c'est pour cela qu'il existe.

### Domaine D — Travail, révisions, engagement

| id | Définition | Sens préoccupant | Preuve | Confusion |
|---|---|---|---|---|
| `focus.minutes` | minutes de focus par jour ouvré | baisse | plausible | congés |
| `focus.abandons` | part de pomodoros interrompus | hausse | heuristique | — |
| `taches.report` | part de tâches planifiées repoussées | hausse | **plausible** | surcharge ponctuelle |
| `taches.sans-motif` | part de non-réalisations sans motif donné | hausse | heuristique | — |
| `revisions.regularite` | écart absolu médian de l'intervalle entre séances | hausse | heuristique | — |

`taches.sans-motif` mérite un mot : tu as demandé il y a deux prompts
qu'Odyssée sache **pourquoi** une tâche planifiée n'a pas eu lieu. Cesser de
répondre à cette question, alors qu'on y répondait, est un changement de
comportement observable — et non une absence de donnée, puisque la question a
été posée et l'écran ouvert.

### Domaine E — Agenda et lien

| id | Définition | Sens préoccupant | Preuve | Confusion |
|---|---|---|---|---|
| `agenda.annulations` | part d'événements annulés | hausse | plausible | — |
| `agenda.densite` | événements par semaine | baisse | **faible** — la revue dit les résultats sociaux **mitigés** | vacances, télétravail |
| `lien.interactions` | durée ou nombre d'interactions notées | baisse | **faible** (idem) | saisie facultative |

**Je garde ce domaine en le dégradant volontairement.** La revue que tu cites
dit les résultats sur les interactions sociales « mitigés » ; en faire un
domaine de plein droit donnerait du poids à ce que la littérature ne soutient
pas. Il ne compte donc **que comme domaine d'appoint** : il ne peut pas être
l'un des trois domaines qui déclenchent, seulement un quatrième qui renforce.

### Domaine F — Corps et alimentation

| id | Définition | Sens préoccupant | Preuve | Confusion |
|---|---|---|---|---|
| `repas.regularite` | écart absolu médian de l'heure des repas notés | hausse | plausible | — |
| `repas.sautes` | repas attendus non notés **alors que les autres le sont** | hausse | heuristique | — |
| `poids.variation` | variation sur 30 j rapportée à la dispersion habituelle | hausse en valeur absolue | plausible | sport, maladie |

`repas.sautes` illustre la règle d'absence : il ne compte **que** les jours où
d'autres repas ont été notés. Un jour sans aucune saisie n'est pas un jour de
jeûne.

### Ce que j'écarte, et pourquoi

| Écarté | Raison |
|---|---|
| `odyssee.checkin`, `charge-percue`, `journal` | ta décision 4 : auto-évaluations hors du moteur. Et la charge perçue en dérive. |
| `odyssee.medicament`, `statut-hormonal` | ta section 3.4 : un traitement est un **contexte**, jamais un jugement. Un changement déclaré **décote**, il ne déclenche pas. |
| `odyssee.sante`, `sport.blessure` | même raison : une blessure explique une baisse d'activité, elle n'en est pas un symptôme. |
| `revision.niveau`, `retention`, `qcm` | performance cognitive : trop dépendante du contenu révisé, et une mauvaise série de QCM n'est pas un rythme de vie. |
| `odyssee.operation` (finances) | **à ton arbitrage**, décision 5. S'il est autorisé, un seul indicateur : `depenses.rupture-de-rythme`, et **jamais** l'écart au budget. |
| `odyssee.valorisation` | un patrimoine qui baisse est un marché, pas une personne. |
| `odyssee.revue` | faire ou non sa revue du soir est trop proche de « tenir l'application à jour », donc circulaire. |

## 4. Le moteur

### 4.1 La base personnelle, et pourquoi elle se fige

Médiane et **écart absolu médian** sur une **période de référence de 8
semaines**, par type de jour (ouvré / week-end séparés).

Médiane plutôt que moyenne, et écart absolu médian plutôt qu'écart-type : une
nuit blanche ne doit pas déplacer la référence de toute une personne. Huit
semaines parce qu'il faut au moins deux fois la fenêtre de persistance pour
que la base ne soit pas majoritairement composée de la période qu'on lui
compare.

**Pendant qu'un signal est actif, la base reste celle d'avant.** Sans cela, une
dégradation lente devient la nouvelle normale et le signal s'éteint de
lui-même — c'est le défaut qui ruine la plupart des détections par écart, et
il est silencieux.

### 4.2 Données suffisantes

| Niveau | Condition |
|---|---|
| Par indicateur | ≥ 10 jours valides dans la fenêtre de 14, **et** ≥ 28 jours dans la base |
| Global | ≥ 6 indicateurs éligibles répartis sur ≥ 3 domaines |

En dessous : statut **« Données insuffisantes »**, avec la liste de ce qui
manque. Jamais de silence : le statut (Active, Données insuffisantes, En pause,
Désactivée) est lisible à tout moment dans Psyché.

### 4.3 Déviation, persistance, croisement

- **Déviation** : écart à la base > **2 écarts absolus médians**, dans le sens
  préoccupant. (Pour une loi normale, 2 ÉAM ≈ 1,35 σ — un seuil volontairement
  bas pris indicateur par indicateur, puisque c'est le **croisement** qui porte
  la spécificité, pas le seuil individuel.)
- **Persistance** : **14 jours**, conformément à ta section 4.3.
- **Croisement** : **k = 3 domaines indépendants** parmi A, B, C, D, F. Le
  domaine E ne compte pas dans les trois (voir plus haut). Des indicateurs du
  même domaine comptent **pour un**.

| Sensibilité | Seuil | Persistance | k |
|---|---|---|---|
| Discrète | 2,5 ÉAM | 21 j | 4 |
| **Standard** (défaut) | 2,5 ÉAM | 21 j | 3 |
| Attentive | 1,5 ÉAM | 10 j | 3 |

### 4.4 Contexte

Les événements que tu déclares — voyage, maladie, blessure, examens, vacances,
deuil, changement de traitement — **décotent** les domaines concernés pendant
leur durée, plus une marge de 7 jours. Le contexte retenu est **écrit dans
l'explication**, jamais appliqué en coulisse.

**Un contexte ne masque pas indéfiniment.** Au-delà de la période déclarée et
de sa marge, l'écart reprend son poids : des vacances de deux semaines
n'expliquent pas deux mois.

### 4.5 Faux signaux : la cible que je me fixe

**Au plus un signal par an sur une série stable** avec bruit réaliste, mesuré
sur jeu synthétique de cinq ans. C'est ce que les réglages Standard visent, et
le rapport de validation donnera le chiffre obtenu — pas celui espéré.

Pourquoi un par an et pas zéro : à zéro, les seuils deviennent tels que rien ne
déclenche jamais, et la veille est une case cochée qui ne sert à rien. Pourquoi
pas plus : au-delà, on apprend à l'ignorer, et un dispositif qu'on ignore est
pire qu'absent puisqu'il occupe la place.

## 5. La carte, et ce qu'elle dit

```
┌──────────────────────────────────────────────────────────┐
│ Un repère à examiner                                     │
├──────────────────────────────────────────────────────────┤
│ Depuis environ trois semaines, plusieurs repères que     │
│ vous avez enregistrés s'écartent de votre habitude :     │
│                                                          │
│   • vos heures de coucher sont plus dispersées           │
│     qu'à votre habitude ;                                │
│   • vos séances de sport se sont espacées ;              │
│   • vos soirées se prolongent plus tard.                 │
│                                                          │
│ Ces repères ne disent pas ce qui se passe, et vous êtes  │
│ le mieux placé pour le savoir.                           │
│                                                          │
│ Contexte pris en compte : aucun n'a été déclaré sur      │
│ cette période.                                           │
│                                                          │
│ ─────────────────────────────────────────────────        │
│ Vos check-ins sur la même période disent : humeur et     │
│ énergie dans votre moyenne. Les deux peuvent être vrais. │
│ ─────────────────────────────────────────────────        │
│                                                          │
│ Si vous vous reconnaissez là-dedans, en parler à un      │
│ proche ou à votre médecin peut être utile.               │
│                                                          │
│ [ Je l'ai vu ]  [ Il y a une explication ]               │
│ [ Pas pertinent ]  [ Plus tard ]                         │
│                                                          │
│ [ Pourquoi ce repère ? ]       [ Besoin d'en parler ? ]  │
│                                                          │
│ Ce repère ne remplace pas un avis médical. L'absence de  │
│ repère ne signifie pas que tout va bien.                 │
└──────────────────────────────────────────────────────────┘
```

Quatre choix méritent d'être défendus.

**« Un repère à examiner »**, et non « alerte ». Le titre fixe le registre, et
c'est le mot qu'on retient.

**L'ampleur en langage courant** — « plus dispersées », « se sont espacées ».
Aucun chiffre, aucun pourcentage, aucune jauge : ta section 5.5. Les valeurs
exactes existent, dans « Pourquoi ce repère ? », pour qui veut vérifier.

**Les check-ins affichés à côté, et la phrase « les deux peuvent être vrais ».**
C'est le cœur de ta demande et l'endroit le plus facile à rater. Ni « tu te
trompes », ni « tu mens », ni une mise en doute déguisée en bienveillance. Deux
constats, posés l'un à côté de l'autre, et la personne décide.

**La mention finale en deux moitiés.** « Ne remplace pas un avis médical » est
attendu. « L'absence de repère ne signifie pas que tout va bien » l'est moins,
et compte autant : sans elle, le silence de la veille devient un bulletin de
santé.

## 6. Mes réponses aux neuf décisions

| # | Question | Ma réponse |
|---|---|---|
| 1 | Le catalogue | Section 3 : **22 indicateurs, 6 domaines**, dont un dégradé en appoint. Aucun n'est « solide », et je le dis dans l'écran « À propos ». |
| 2 | Activation | **Chapitre sensible facultatif, choix explicite.** Un dispositif qui te surveille sans que tu l'aies demandé n'a pas sa place, quelle que soit son utilité. |
| 3 | Paramètres | Base **8 semaines**, persistance **14 jours**, **k = 3**, seuil **2 ÉAM**. Trois niveaux, Standard par défaut. Tous justifiés en 4.1 à 4.3. |
| 4 | Auto-évaluations hors du moteur | **Oui, ton interprétation est la bonne**, et j'ajoute une raison : si un check-in pouvait éteindre le signal, le dispositif perdrait exactement la propriété que tu lui demandes. Elles restent **affichées à côté**. |
| 5 | Domaines sensibles | **Santé : non** (c'est un contexte, pas un indicateur — voir 3, « ce que j'écarte »). **Finances : à ton choix**, et si oui, un seul indicateur, la rupture de rythme, jamais l'écart au budget. Mon avis : commence sans, ajoute si la veille te paraît trop silencieuse. |
| 6 | Synthèse pour un médecin | **Oui.** C'est la sortie la plus utile du dispositif : des faits datés qu'un professionnel lit en trente secondes. À ta demande exclusive, hors des exports par défaut. |
| 7 | Mode rejeu | **Oui, et c'est le seul moyen d'évaluation dont tu disposes.** Rejouer sur ton historique et comparer aux périodes dont tu te souviens vaut mieux que n'importe quel jeu synthétique. Éphémère, sur copie, jamais exporté. |
| 8 | Adresse | **Vouvoiement**, comme partout dans Cyclades. Ton brouillon tutoie ; j'ai vouvoyé la maquette. Dis-moi si tu préfères basculer tout le site. |
| 9 | Libellé sans revendication médicale | **« Repère de rythme de vie »** dans l'interface, le README et le dépôt. Jamais « dépistage », jamais « détection », jamais « prévention ». Un contrôle automatique refusera ces trois mots dans les textes du module, comme `controlerPsyche()` refuse déjà les étiquettes cliniques. |

## 7. Les phases

| Phase | Contenu | Testée |
|---|---|---|
| **0** | Ce document. | — |
| **1** | Registre déclaratif des indicateurs, calcul des valeurs, complétude, base personnelle robuste. Tests : médiane et ÉAM sur cas connus, séparation ouvré / week-end, « non saisi » ≠ « valeur basse ». | **faite** — 65 essais |
| **2** | Moteur : déviation, persistance, croisement, décote de contexte, trois sensibilités, base figée. ~~Web Worker, calcul incrémental~~ — écartés après mesure, voir 7 ter. Tests : déclin multi-domaines détecté après 14 j, déclin mono-domaine jamais, base non entraînée. | **faite** — 60 essais |
| **3** | Carte, « Pourquoi ce repère », « Ce que la veille regarde », « À propos », statut, journal des signaux, cadence, pause, désactivation. Tests : check-in rassurant ne lève rien, un seul signal actif, désactivation sans relance. | **faite** — 96 essais purs + 29 navigateur |
| **4** | Jeux synthétiques sur cinq ans et **taux de faux signaux mesuré** (voir `mesures.md` — la mesure a trouvé deux défauts de conception), recalcul identique sur deux appareils, synthèse médecin, mode rejeu. | **faite** — 45 + 35 essais purs, 11 navigateur |

## 7 bis. Ce que la phase 1 a appris

Trois choses se sont découvertes en construisant, et aucune n'était dans le
plan.

**Le croisement était inatteignable sans saisie.** Le catalogue de la section 3
ne plaçait d'indicateurs observés que dans deux domaines comptants — `rythme`
et `engagement` — alors que le croisement en exige trois. Quelqu'un qui cesse
de saisir faisait donc tomber la veille en « données insuffisantes »,
c'est-à-dire au silence, au moment précis où elle aurait servi : exactement le
défaut que le domaine C existait pour éviter. L'abandon d'une séance de sport
est désormais compté comme **observé** — une séance se conduit dans
l'application, qui la voit ouverte puis délaissée sans que personne n'ait rien
à saisir — et `controlerCatalogue()` refuse maintenant tout catalogue où moins
de trois domaines comptants portent un indicateur observé.

**Le journal d'usage ne voyage pas.** Il a été inscrit au registre de
synchronisation, puis retiré. Un appareil écrit une session chaque fois qu'on
l'ouvre ; si ces sessions voyageaient, deux appareils ne pourraient plus jamais
présenter la même empreinte, puisque les ouvrir pour comparer suffirait à créer
l'écart qu'on vient constater. La veille n'observe donc que l'appareil sur
lequel elle tourne. Ce qu'on craignait de perdre — qu'un changement d'appareil
se lise comme un effondrement — n'arrive pas : un appareil neuf n'a pas les
vingt-huit jours de base qu'exige `suffisance()`, et dit « données
insuffisantes » plutôt que de crier.

**L'enregistreur a menti à une installation neuve.** Branché sur le cycle de
vie des pages, il écrivait sa première session à la première ouverture — et
l'écran d'accueil, qui demande « cette installation porte-t-elle déjà de
l'usage ? » en comptant les magasins journalisés, répondait oui. Une
installation vierge annonçait donc à son propriétaire qu'elle le connaissait
déjà, sur la foi d'une ligne écrite une seconde plus tôt par le programme
lui-même. D'où `MAGASINS_SANS_GESTE` : ce que l'application écrit sur elle-même
n'est pas de l'usage.

## 7 ter. Ce que la phase 2 a appris

**L'heure de coucher est une grandeur circulaire, et je l'avais traitée comme
un nombre.** En heures d'horloge, quelqu'un qui repousse son coucher de 23 h à
3 h voit sa valeur chuter de vingt : le moteur y lisait un coucher
spectaculairement avancé, c'est-à-dire une amélioration, là où la personne se
couche quatre heures plus tard. L'indicateur est désormais défini en **heures
écoulées depuis 18 h**, ce qui le rend monotone sur toute la soirée et la
nuit, et un essai porte la convention pour que nul ne la défasse.

**Une dispersion habituelle nulle faisait diverger l'écart.** Quelqu'un qui
dort exactement huit heures toutes les nuits a un écart absolu médian de zéro :
la moindre nuit à sept heures cinquante le faisait dévier d'une infinité
d'écarts. Chacun des vingt-trois indicateurs déclare donc maintenant un
**plancher de dispersion** — la plus petite différence qui vaille d'être
remarquée, dans son unité — et `controlerCatalogue()` refuse qu'il manque. Ce
défaut ne se serait jamais vu sur des données moyennes : il ne frappe que les
gens les plus réguliers, c'est-à-dire tous les jours, chez eux.

**Le Web Worker et le calcul incrémental sont écartés.** Mesure faite : 2,9 ms
à l'horizon réel de cent quatre-vingts jours, 4,9 ms à cinq ans. Un Worker
exigerait de copier les mesures à chaque appel — à cinq ans, la copie coûte
plus que le calcul — et l'incrémental introduirait un état à invalider, soit
la source classique du chiffre affiché qui n'est plus celui des données. La
décision est écrite dans l'en-tête du moteur, avec le seuil qui la ferait
reprendre.

**La persistance se mesure par la médiane de la fenêtre, pas par un compteur
de jours consécutifs.** C'est équivalent dans l'intention, plus robuste aux
trous, et cela évite un compteur à remettre à zéro — un objet d'état de plus,
donc un objet de plus à faire diverger.

## 7 quater. Ce que la phase 3 a appris

**Mon collecteur lisait l'heure dans un autre fuseau que le reste de
l'application.** Il employait `getHours()`, c'est-à-dire l'heure de la
machine, pendant que le journal d'usage passait par `heureLocale` en
Europe/Paris. Les deux cohabitaient dans le même calcul : une session de 3 h
du matin était nocturne pour un indicateur et diurne pour l'autre, selon le
fuseau de l'appareil. Un essai l'a montré ; une relecture ne l'aurait pas vu.

**Plusieurs indicateurs n'étaient pas journaliers.** « Nombre de nuits
courtes », « séances par semaine », « part des séances abandonnées » sont des
grandeurs de fenêtre : prises au jour, elles valent 0 ou 1, et la médiane
d'une série de 0 et de 1 ne dit rien. Elles sont désormais calculées **en
roulant sur sept jours**, ce qui leur rend une médiane qui a un sens. Le prix
est une semaine d'inertie, qui ne coûte rien à un dispositif exigeant déjà dix
à vingt-et-un jours de persistance.

**Changer un réglage ne relançait rien.** La règle « une évaluation par jour »
bloquait le recalcul : on choisissait une autre sensibilité, et l'écran
répondait « la veille a déjà regardé aujourd'hui ». Un réglage qu'on modifie
sans effet visible est pire qu'un réglage absent — on le change deux fois,
puis on cesse d'y croire. Activer, changer de sensibilité et lever une pause
remettent maintenant le compteur du jour à zéro.

**Le contrôle de vocabulaire ne doit pas porter sur les dénégations.** L'écran
dit « il n'existe aucun taux de détection », et c'est exactement la mise en
garde qu'on veut lire. Interdire le mot partout aurait obligé à l'écrire en
périphrase, c'est-à-dire à dire moins clairement la seule chose qui compte. Le
contrôle porte donc sur les textes **fabriqués** — statut et carte —, pas sur
la prose de l'écran. C'est la même leçon que le contrôle des finances, qui
s'était piégé en refusant « aucun conseil en investissement ».

**Cinq indicateurs sur vingt-trois ne sont pas encore alimentés**, et la liste
est déclarée dans `NON_COLLECTES` plutôt que devinée : la rupture d'une
pratique installée, les non-réalisations sans motif, la régularité des
révisions, les interactions notées et les repas sautés. L'écran les affiche
avec la mention « pas encore alimenté », et un essai compare la liste à ce que
le collecteur produit réellement — le jour où une branche se met à alimenter
l'un d'eux sans qu'on retire la ligne, l'essai le dira.

## 7 quinquies. Ce que la phase 4 a appris

**Je fabriquais moi-même la divergence que je cherchais à mesurer.** Un repère
recevait un ULID, c'est-à-dire un identifiant tiré de l'heure et du hasard.
Deux appareils tenant les mêmes données et levant le même repère le même jour
lui donnaient donc deux noms différents — et le jour où ce magasin voyagerait,
la même carte apparaîtrait deux fois sans qu'aucun défaut ne se soit produit
nulle part. L'identité est désormais le condensé de ce qui fait le repère, et
elle ne dépend même pas de l'ordre dans lequel le moteur a classé les écarts.

**Classer une divergence par ses indicateurs était faux dans le sens
dangereux.** Ma première version distinguait les divergences « attendues » —
celles qui ne portent que sur des indicateurs tirés du journal d'usage, lequel
ne voyage pas — des autres. Or un repère exige trois domaines : sa liste
d'indicateurs déborde toujours du rythme. Une divergence réellement causée par
le journal d'usage se présentait donc comme un défaut de reproductibilité, et
à force d'en voir, on aurait cessé de regarder — donc on aurait cessé de voir
le vrai désaccord, le jour où il serait arrivé.

La bonne méthode ne demande aucun jugement : on **rejoue deux fois**. Sur la
part qui voyage, toute divergence est un défaut, sans exception et sans
interprétation. Sur la totalité, ce qui apparaît en plus est le prix du
journal d'usage, et ce prix se constate au lieu de se déduire.

**Les chiffres sont interdits sur la carte et obligatoires dans la synthèse
médecin.** Ce n'est pas une incohérence : c'est le même raisonnement appliqué
à deux lecteurs. Devant quelqu'un qui n'a aucun moyen d'en juger, un chiffre
donne à une comparaison avec soi-même l'allure d'une mesure clinique. Devant
un professionnel qui en a les moyens, les retenir serait lui demander un avis
en lui cachant ce sur quoi le donner. Un essai porte explicitement la
différence, parce qu'une prochaine lecture la prendrait sinon pour un oubli et
« harmoniserait » les deux contrôles.

**Un repère sans donnée a deux raisons de l'être, et les confondre ment.** La
première version de la synthèse disait « trois repères ne sont pas
renseignés » en mêlant ceux que la personne n'a pas saisis et ceux
qu'*aucune source de l'application n'alimente encore*. Un lecteur y aurait lu
un relâchement de saisie là où c'est le programme qui ne sait pas mesurer.
Trois états, donc, et non deux.

**Un chiffre recopié vieillit en silence.** La synthèse cite les taux mesurés
plutôt que de relancer un calcul de plusieurs minutes à chaque impression.
Changer un seuil sans refaire la mesure produirait un document qui affirme,
sur un réglage, ce qui avait été observé sur un autre. D'où `REGLAGES_FIXES_LE`
et un garde qui refuse une mesure antérieure : qui touche aux seuils doit
relancer la mesure et avancer les deux dates.

**Le rejeu existe, la lecture qu'il devait permettre n'existe pas encore.**
`mesures.md` concluait que le rejeu sur l'historique réel était le seul moyen
d'évaluation disponible. L'instrument est là, éprouvé sur des vies
synthétiques ; mais cette installation ne porte aucun historique de veille, et
il n'a donc encore rien à lire. Ce qui reste à faire n'est plus du code : c'est
d'attendre d'avoir vécu assez de jours pour le rejouer.

## 8. Ce que je n'ai pas pu vérifier

- **Les deux sources de ta section 1.** Passerelle réseau fermée. Je ne les ai
  pas lues, je ne les cite donc pas dans l'interface, et le catalogue marque
  « plausible » là où tu rapportes une association — jamais « solide ».
- **La réglementation européenne sur les dispositifs médicaux logiciels.**
  Inaccessible également. Je m'en tiens donc à la règle la plus prudente :
  aucun vocabulaire de dépistage, de détection ou de prévention, nulle part,
  et un contrôle automatique pour que cela tienne dans le temps.
- **Les chiffres de sensibilité et de spécificité** de ce type d'approche. Ils
  n'existent pas dans ce que j'ai pu lire, et le dispositif n'en revendique
  aucun.

## 9. Ce que ce prompt change dans ce qui est déjà construit

Rien n'est à défaire. Trois ajouts seulement, le jour où tu valides :

- `controlerPsyche()` refuse déjà dix-neuf étiquettes cliniques et les trois
  graduations de gravité ; il accueillera « dépistage », « détection » et
  « prévention » sans changer de forme.
- Les ressources — 3114, 15, 112 — sont déjà hors du coffre et hors de tout
  seuil ; « Besoin d'en parler ? » les atteint en un geste depuis la carte.
- Le domaine C (usage) demande un **journal d'usage sans contenu** qui n'existe
  pas encore. C'est le seul magasin à créer, et c'est la pièce qui fait tenir
  tout le dispositif quand la saisie s'arrête.
