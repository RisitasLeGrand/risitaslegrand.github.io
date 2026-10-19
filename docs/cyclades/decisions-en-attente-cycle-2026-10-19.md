# Suivi personnel — ce qui attend une décision d'Alexis

> Fichier propre au chantier du cycle, ouvert le 19 octobre 2026 sur la branche
> `claude/cycle-d2`. Il est **séparé** de
> `decisions-en-attente-2026-10-19.md`, qui est un fichier vivant du
> constructeur : écrire dans le sien aurait produit un conflit pour rien.
>
> Chaque entrée dit ce qui attend, qui doit trancher, et **ce que le code fait
> en attendant**. Cette dernière colonne est la plus importante : une décision
> en attente dont le code aurait déjà choisi à la place ne serait plus en
> attente.

---

## 1. Vérification visuelle de la collecte D2 — **à faire**

**Vérification visuelle d'Alexis : à faire.**

La collecte `collectes/D2-signes-alerte-regles-2026-10-19.md` le dit elle-même :
l'outil de lecture passait par un résumé limité à 125 signes par citation, et
les citations longues ont été recollées à partir de fragments. Les apostrophes
varient et les espaces insécables ne sont pas garanties — par exemple avant
« °C ».

**Qui tranche** : Alexis, en relisant les citations à l'œil contre les pages
d'origine.

**Ce que le code fait en attendant** : les vingt-neuf citations sont déclarées
dans `odyssee/cycle-signes-alerte.ts` et vérifiées contre la collecte, mais
**aucun écran ne les affiche encore** — l'écran arrive avec le module, parce
que la règle 5 veut que la liste soit consultable depuis le renvoi et non
posée à part.

Le complément qui gouverne ces citations est versé à côté de la collecte,
dans `collectes/D2-complement-regles-2026-10-19.md` : la règle et la citation
se relisent au même endroit.

**Ce que l'essai fera, et sa limite** : il comparera chaque phrase affichée à sa
citation dans la collecte, après normalisation des **apostrophes et des espaces
seulement** — aucun mot, aucune ponctuation, aucune casse. La comparaison
portera donc sur un texte qui n'a pas encore été vérifié à l'œil. L'essai garde
la fidélité de l'écran à la collecte ; il ne garde pas la fidélité de la
collecte aux pages.

---

## 2. Les statuts déjà saisis sous « Phase du cycle » — **à relire**

Le libellé de la nature `cycle` de `StatutHormonal` est passé de « Phase du
cycle » à « Phase de cure » le 19 octobre (décision B du plan de phase 0,
premier temps). Le libellé seul a changé ; la clé stockée n'a pas bougé et
aucune donnée n'a été touchée.

**Conséquence qu'il faut dire** : un statut déjà enregistré sous cette nature
s'affiche désormais comme une cure. Si l'un d'eux notait une phase menstruelle
— ce que le libellé d'origine autorisait à lire ainsi —, son étiquette est
maintenant fausse. **Rien dans le code ne permet de savoir lequel des deux sens
a été employé**, et la donnée est sous coffre.

**Qui tranche** : Alexis, en ouvrant Odyssée > Corps et en relisant ses statuts.

**Ce que le code fait en attendant** : il n'essaie pas de deviner. Aucune
reclassification automatique, et `NATURES_ECARTEES` continue d'écarter la
nature entière de l'analyse — plus large que nécessaire, ce qui est le bon sens
de l'erreur pour un filtre de confidentialité.

---

## 3. Les paramètres de produit du suivi — **à proposer, puis à trancher**

La décision 24 du plan de phase 0 est explicite : « proposés chiffrés en
phase 3, **aucun appliqué avant ta réponse** ». La décision 8 ajoute que la
fenêtre « avant les règles » est « à fixer avec toi ».

**Qui tranche** : Alexis. Ce sont des seuils de santé, et le pilote a renvoyé la
décision vers lui plutôt que de l'arbitrer.

**Ce que le code fait en attendant** : le journal enregistre et relit. Aucun
calcul de durée de cycle, aucune plage estimée, aucune fenêtre, aucune
statistique — ce n'est pas un manque de travail, c'est l'absence délibérée de
tout chiffre qu'une réponse pourrait démentir.

**Ce que le code fait maintenant, et c'est une précision** : l'algorithme de
dérivation des cycles est écrit et mesuré (`odyssee/cycles.ts`,
`npm run essais:cycles`), mais il **reçoit ses chiffres en paramètres** et les
portes publiques refusent. `cyclesDeLHistorique`,
`statistiquesDeLHistorique` et `fenetresDeLHistorique` rendent aujourd'hui
`{ impossible: 'parametres-non-tranches', manquants: [...] }`. Un essai vérifie
que la valeur proposée n'est lue **qu'à un seul endroit**, derrière le
contrôle `applique`, et que les chiffres employés par les essais ne sont
aucune des propositions — sans quoi une proposition pourrait devenir la valeur
qui fait passer une mesure, et plus personne ne saurait si elle a été choisie
ou héritée.

Le jour où la réponse arrive : `applique: true` avec la valeur retenue, et
rien d'autre à changer.

### Les six chiffres, et ce que chacun décide

Chaque motivation dit **ce qui change si on prend autrement**, pour qu'on
puisse répondre sans relire le code.

**1. `jours-pour-ouvrir` — proposé : **2** jours.**
Combien de jours de saignement consécutifs, au moins « Légers », ouvrent un
cycle. La décision 8 exclut les « traces isolées », et « isolé » demande un
chiffre. Deux jours écartent le saignement d'un jour sans écarter des règles
courtes, qui existent. À un jour, un saignement isolé ouvrirait un cycle et
fausserait toutes les durées ; à trois, des règles de deux jours ne seraient
jamais comptées et l'écran dirait « aucun cycle » à quelqu'un qui en a.

**2. `ecart-minimal-entre-j1` — proposé : **15** jours.**
L'écart minimal entre deux J1 pour compter deux cycles et non un seul. Sans ce
seuil, un saignement de milieu de cycle ouvrirait un second cycle et
diviserait la durée par deux. Quinze jours est la moitié d'un cycle de trente :
en dessous, deux débuts sont plus probablement un seul épisode interrompu. Plus
bas, les durées se morcellent ; plus haut, deux cycles réellement courts se
confondent en un.

**3. `duree-maximale-fiable` — proposé : **90** jours.**
La durée au-delà de laquelle un cycle est dit non clos plutôt que long. Un
écart de plusieurs mois entre deux J1 est plus souvent une saisie manquée
qu'un cycle long, et le compter comme une durée abîmerait la médiane.
Quatre-vingt-dix jours laisse passer les cycles longs réels — ils existent, et
les écarter serait effacer la personne au profit d'une jolie statistique — tout
en écartant les trous d'usage. **Le cycle reste affiché** ; il n'entre pas dans
les statistiques, et l'écran dira pourquoi.

**4. `cycles-avant-une-mediane` — proposé : **3** cycles.**
Combien de cycles complets et fiables avant d'afficher une médiane. Une médiane
sur deux cycles est un chiffre qui a l'air d'un savoir. Trois est le minimum
pour qu'une valeur centrale ait un sens, et c'est aussi trois mois d'attente
avant que l'écran montre quoi que ce soit — ce qui est long. Plus haut, l'écran
reste muet une demi-année ; plus bas, il affirme. Les extrêmes, eux, sont
rendus dès le premier cycle : ce sont des faits, pas une valeur centrale.

**5. `largeur-fenetre-avant` — proposé : **5** jours.**
La largeur de la fenêtre « avant les règles », en jours avant un J1 **passé**.
Explicitement renvoyée à Alexis par la décision 8. Cinq jours couvrent la
période que les gens décrivent le plus souvent, sans s'étendre assez pour que
la fenêtre recouvre la moitié du cycle — à quoi elle ne distinguerait plus
rien. Cette fenêtre est passée : elle se calcule sur un J1 qui a eu lieu,
jamais sur un J1 attendu, et c'est la décision 12 qui l'impose.

**6. `delai-du-constat-de-retard` — proposé : **7** jours.**
Au bout de combien de jours après la fin de la plage estimée le constat de
retard paraît. C'est le « [N] jours » de la chaîne imposée `retard.constat`.
Sept jours laissent passer la variation ordinaire d'un cycle sans laisser
quelqu'un sans phrase pendant des semaines. Plus bas, le constat paraît pour
une variation banale et inquiète ; plus haut, il ne paraît plus quand il
servirait. Le constat reste un **fait affiché**, sans signal codé : décision 11,
tant qu'aucune source n'est atteignable.

### Une chose qu'aucun de ces chiffres ne règle

Rien ici ne dit ce qu'est un cycle **normal**, et rien ne le dira : aucune
source n'est atteignable, et un chiffre de référence sans source est
exactement ce que le § 1 n° 6 interdit. Les statistiques portent sur la seule
base de la personne (décision 16, « contexte affiché seulement »). Si Alexis
veut un jour une comparaison, il faudra d'abord une source — et c'est une autre
décision.

---

## 4. La méthode des pistes entre cycles — **à valider avant d'être écrite**

La décision 14 demande que la méthode soit « proposée chiffrée en phase 5,
**validée avant implémentation** ».

**Qui tranche** : Alexis.

**Ce que le code fait en attendant** : rien n'est écrit. Si la réponse n'arrive
pas dans le délai du chantier, le lot reste une proposition écrite et aucun
calcul n'est livré.

---

## 5. La matrice de permissions B.2 — **à vérifier avant la fiche de cycle**

Le § 11 du plan de phase 0 le déclare comme un angle mort : « je sais que le
contrat de faits porte `proprietaire` et `domaine` pour les 36 types ; je n'ai
pas vérifié que la matrice couvre toutes les lectures inter-branches que 4.7
restreint ».

Or la fiche de cycle lit d'autres domaines, et la maquette 8.3 impose de
distinguer « domaine non autorisé » de « non mesuré » — deux lignes distinctes,
parce que les confondre laisserait croire qu'un domaine coupé est un domaine
vide.

**Qui tranche** : le pilote d'abord, Alexis ensuite si la matrice doit changer.

**Ce que le code fait en attendant** : la vérification est faite **avant**
d'entrer dans le lot de la fiche, et son résultat remonté. Aucune lecture
inter-branches n'est écrite avant cela.

---

## 6. Décision B, second temps : la clé `cycle` n'est pas renommée — **tranché**

Le plan de phase 0 prévoyait de renommer la clé `cycle` de `StatutHormonal`
« avec l'arrivée du module, qui impose de toute façon un changement de
schéma : la migration voyage avec lui ».

**La prémisse ne tient pas**, et c'est mesuré : `nature` est à l'intérieur du
scellé, la clé du coffre vit en mémoire, et le bloc `upgrade` de `db.ts` ne
l'a pas. Une migration de schéma ne peut pas lire ce champ, donc pas le
réécrire.

Il aurait fallu une **conversion paresseuse coffre ouvert** : une seconde
opération touchant des données de santé chiffrées, après
`migration-du-coffre.ts` — la seule du dépôt de cette espèce, qu'Alexis avait
conditionnée à une sauvegarde confirmée. Plus une période à deux clés, et
`NATURES_ECARTEES` à faire fonctionner sur les deux noms, puisque c'est un
filtre de confidentialité accroché à cette chaîne.

**Tranché par le pilote le 19 octobre : on ne renomme pas.** Le libellé
affiché est déjà « Phase de cure », donc l'ambiguïté que la décision visait
est levée. Le risque de collision est écarté autrement : les statuts que le
suivi ajoutera porteront `contraception`, `grossesse`, `allaitement` et
`menopause`.

**Si Alexis préfère la conversion** — l'option (b) — elle demande une
**sauvegarde confirmée** avant toute réécriture, par la même règle qu'il a
posée pour le rechiffrement du coffre. Rien n'est fait dans ce sens, et rien
ne le sera sans sa parole.

---

## 7. « Modules disponibles » : une surface que le registre décrit et qui n'existe pas

`registre-usages.ts` nomme cet écran deux fois : dans l'`effetVisible` de
`profil.modules-a-seuil` — « Le module n'apparaît pas dans "Modules
disponibles" » — et dans le `siInconnu` de `profil.question-cycle` — « Le
module reste accessible depuis "Modules disponibles", sous un libellé
neutre ». **Aucun écran ne porte ce nom**, vérifié sur tout `src/`.

La formulation du registre **reste telle quelle**, avec un commentaire qui dit
qu'elle désigne une surface à construire. L'adoucir aurait fait reculer la
déclaration devant l'implémentation, alors que c'est l'implémentation qui doit
venir.

**Qui tranche** : le constructeur, à qui l'écran appartient (phase 1).

**Ce que le code fait en attendant** : le suivi personnel s'atteint par une
**ligne neutre depuis l'écran Corps**, qui est déjà sous coffre et où le
registre dit que la question du cycle se pose. Décision du pilote,
19 octobre, option (c). L'entrée de branche sous Odyssée — un libellé
« Suivi personnel » dans la navigation — sera demandée au constructeur quand
le module aura ses écrans à lui ; `branches.ts` n'est pas touché.

---

## 8. Le sexe déclaré n'est stocké nulle part

La porte `etatDeLaPersonne()` rend `sexe: null`, et ce n'est pas un oubli de
ce chantier : **aucun magasin du dépôt ne stocke ce champ.** Ni `profil.ts` ni
`initialisation.ts` ne le déclarent, vérifié ligne par ligne. Le plan de
phase 0 le range dans Odyssée > Corps sous coffre, et la phase 1 n'a livré que
les trois champs d'âge.

**La conséquence est visible, et le registre l'avait déjà prévue** :
`profil.question-cycle` lit `sexe_physio`, donc la question du suivi n'est
**jamais posée d'office**. Son `siInconnu` dit exactement ce qui se passe
alors. Le module fonctionne ; il ne se propose pas tout seul.

**Qui tranche** : le pilote, puis le constructeur si le champ relève de la
phase 1. Créer son magasin serait une vingtaine de lignes, mais la forme — un
magasin scellé propre, ou un champ d'un magasin existant du corps — est une
décision d'architecture qui appartient à qui possède la phase 1.

**Ce que le code fait en attendant** : il rend `null` honnêtement, et le
balayage du graphe d'imports garde **déjà** le nom `sexe` et `aUnCycle`, pour
que le jour où ils seront créés, aucun écran ne puisse les lire en
contournant la porte.

---

## 9. La sauvegarde en clair ne déclare pas ses exclusions — **à trancher**

Le § 6.9 du prompt 30 demande que « le cycle n'entre dans aucune sauvegarde non
chiffrée, et l'écran le dit ». C'est fait : `magasinsDUneSauvegarde(false)`
retire les deux magasins du suivi, et la case « Ne pas chiffrer ce fichier »
(écran Progression) le dit.

**Ce que cela coûte, et qui doit le décider.** `remplacerMagasins` (`db.ts`)
vide chaque magasin connu, **même absent du fichier** — c'est le sens de
« remplacer », et c'était déjà celui de `viderProgression`. Donc restaurer une
sauvegarde non chiffrée **efface le suivi** au lieu de le laisser en place.
L'écran le dit à l'endroit du choix, mais le dire ne suffit peut-être pas : une
personne qui restaure a déjà perdu quelque chose, et c'est le plus mauvais
moment pour découvrir qu'elle perd autre chose.

Trois issues, et la première est celle que je recommande :

1. **Le fichier déclare ses exclusions, et la restauration les respecte.** Un
   champ de plus dans le format (`magasinsExclus`), que `remplacerMagasins` lit
   pour laisser ces magasins intacts au lieu de les vider. C'est un changement
   de format de sauvegarde, donc hors de ce lot, et il demande de décider ce
   qu'une version ancienne fait d'un fichier qui porte ce champ.
2. **Laisser comme c'est, l'écran le disant.** Le moins de code, et le risque
   reste sur la personne.
3. **Refuser la sauvegarde non chiffrée quand le suivi est actif.** Franc, mais
   cela retire un choix que la personne avait, pour une raison qui ne la
   concerne pas toute entière.

Aucun paramètre de produit n'est appliqué ici : la décision 24 réserve cela à
Alexis.

---

## 10. L'effacement par période du suivi passe par son écran, pas par le vôtre

Pas une décision en attente, mais une **asymétrie à connaître** : elle se
rattrape mal si on l'apprend par surprise.

`dateDe` (`sauvegarde/groupes.ts`) lit le champ de date **dans l'enregistrement
en clair**. Le journal du suivi n'en a aucun — le § 6.9 l'interdit, et c'est ce
qui a corrigé mon `clairs: ['id', 'majLe']` du lot 4 —, donc son `CHAMP_DATE`
vaut `null` et l'écran « Vos données » le **laisse entier** quand une période
est demandée. C'est le conflit d'architecture que la décision 25 demande
d'énoncer plutôt que de contourner.

L'alternative est en place, et elle ne demande aucune date en clair : les clés
du journal sont les empreintes déterministes des jours, donc le module efface
une période en **recalculant les empreintes** des jours voulus
(`effacerLaPeriode`, `odyssee/donnees-cycle.ts`), coffre ouvert. Un bloc replié
« Effacer des saisies » sur l'écran du suivi l'offre à la personne, en deux
temps — compter, puis effacer ce qui a été compté. Sans ce bloc,
« effaçable par période » (partie 1 point 10) aurait été vrai pour un
programmeur et faux pour la personne.

Le motif du refus affiché sur « Vos données » a été corrigé par la même
occasion : il disait « ce magasin porte un état courant et non un historique »,
phrase recopiée à trois endroits et **fausse** pour un journal de saisies
quotidiennes. Chaque magasin porte maintenant son motif
(`raisonDuRefusDeDecoupage`).

---

## 11. Le même défaut existe ailleurs, hors de ce chantier — **à relayer**

`odysseeExceptionsScellees` (`noyau/coffre.ts`) déclare `clairs: ['id',
'majLe']`, avec un commentaire qui dit « Rien d'autre que la clé et la date
d'écriture. Pas de `jour` ici » — c'est-à-dire **le raisonnement exact** qui
m'avait fait écrire la même chose pour le journal du suivi, et la même faute :
`majLe` est une date, donc la liste des `majLe` donne les jours où une
exception de pointage a été posée.

Ce n'est pas le même enjeu — une exception de pointage n'est pas une donnée de
cycle —, et ce magasin n'appartient pas à ce chantier : rien n'est touché ici.
Signalé pour que la session qui en a la charge en décide, sachant que le
remède y est le même (`clairs: ['id']`, `CHAMP_DATE` à `null`, effacement par
période dans le module) et que son coût y est le même aussi.

---

## 12. Le suivi ne s'affiche que pour un sexe féminin — **décision d'Alexis, appliquée**

Décision d'Alexis du 19 octobre, vers 16 h UTC, relayée par le pilote :
« Le cycle menstruel ne doit s'afficher QUE pour les utilisateurs féminins. »
Elle est appliquée. Ce qui suit est l'écart avec le prompt 30, comme le demande
son point 7, et les conséquences que l'application a fait apparaître.

### Ce que le prompt 30 prévoyait, et qui ne vaut plus

Le registre des usages portait, pour `profil.question-cycle`, un `siInconnu`
qui disait : « La question n'est pas posée d'office. Le module reste accessible
depuis "Modules disponibles", sous un libellé neutre. » Le module existait donc
pour tout le monde, et seule la **question** était ou non posée d'office.

Désormais le module n'existe visiblement que pour une réponse « Féminin », et
il n'y a **aucun libellé neutre de repli** — ni ligne sur l'écran Corps, ni
écran, ni signes d'alerte, ni entrée dans « Modules disponibles » quand cet
écran sera construit. L'usage a changé de nature : il restreint au lieu
d'ordonner une question.

### Ce que cela a coûté, et qu'Alexis doit savoir

1. **« Quand consulter » reste accessible sans condition — tranché.** La
   première version de la décision nommait les signes d'alerte parmi ce qui est
   masqué. Cela retirait à tout le monde la seule partie de ce domaine qui
   n'est pas du suivi : une personne qui saigne beaucoup, ou qui a une douleur
   qu'elle ne s'explique pas, lisait les trois niveaux et les quatre sources
   ameli **sans rien déverrouiller ni rien déclarer** — et une personne de sexe
   féminin qui n'avait pas encore ouvert son coffre n'aurait rien vu, au moment
   où elle en aurait eu le plus besoin.

   Alexis a tranché le 19 octobre vers 17 h 10 pour l'option 2 : le suivi reste
   restreint, « Quand consulter » reste accessible **sans coffre, sans
   déclaration, quel que soit le sexe**. Ces phrases ont donc leur propre
   écran, `/odyssee/corps/quand-consulter/`, lié depuis Corps par une ligne
   sans condition.

   Deux exigences tirent en sens opposés, et les deux sont mesurées : la page
   ne se referme jamais (aucun appel à la règle de visibilité, aucun coffre
   demandé), et elle ne révèle rien — **aucun lien vers le suivi, pas même
   conditionnel**, parce qu'un lien qui paraît pour certaines personnes et pas
   pour d'autres est précisément ce qui se remarque quand on compare deux
   écrans. Son intitulé, son adresse et son contenu ne nomment ni le cycle ni
   le suivi.

2. **L'écran du suivi ne peut plus proposer d'ouvrir le coffre.** Hors de
   portée, il ne rend que la page neutre ; et il est hors de portée tant que la
   réponse n'a pas pu être lue, c'est-à-dire tant que le coffre est fermé. Le
   déverrouillage a donc lieu sur l'écran Corps, où la question est posée. Le
   chemin de la maquette 8.2 est passé de trois appuis à deux depuis cet écran,
   plus un appui avant d'y arriver. Le `FormulaireCoffre` de cette page est
   devenu inatteignable ; il est laissé en place, et c'est dit en commentaire.

3. **Le masquage est visuel, pas une absence.** Le HTML servi à
   `/odyssee/corps/suivi/` contient le module entier quelle que soit la
   réponse : le bloc est caché par une classe, il n'est pas absent. Quelqu'un
   qui lit le source de la page le voit. Pour qu'il en soit autrement, il
   faudrait que ce contenu ne soit pas rendu côté serveur mais injecté après la
   décision — un autre chantier, et une décision à prendre. **Tant qu'elle
   n'est pas prise, il ne faut pas dire que le module est invisible : il est
   masqué.**

4. **`intersexe_ou_autre` n'a pas de réponse.** `SexePhysio`
   (`noyau/registre-usages.ts`) connaît trois valeurs physiologiques, dont
   `intersexe_ou_autre`. Les trois réponses d'Alexis — « Féminin », « Masculin »,
   « Je préfère ne pas répondre » — ne l'offrent pas. Une personne dans ce cas
   répondra donc « Je préfère ne pas répondre », et le suivi lui sera masqué.
   Je n'ai pas inventé une quatrième réponse qu'Alexis n'a pas demandée, et je
   n'ai pas retiré `intersexe_ou_autre` du type, que d'autres modules utilisent
   pour leurs populations. À lever ou à garder.

### Ce qui est tenu, et par quoi

- Une seule fonction décide : `leSuiviEstVisible` (`odyssee/sexe.ts`), pure,
  mesurée en table de vérité par `essais:sexe`. Elle reçoit un `Contexte` de la
  porte du registre des usages, donc l'usage est réellement exercé et **couper
  cet usage masque** au lieu de débloquer.
- Elle est écrite en liste blanche : seul `'femme'` ouvre. Un état nouveau, une
  lecture qui échoue, un champ illisible tombent du côté fermé.
- Le sens du défaut est dans le gabarit : la page neutre est rendue, le contenu
  part caché. Un script qui échoue laisse la page neutre.
- Le champ suit les règles du suivi, par consigne du pilote : scellé, `clairs:
  ['id']`, hors de toute sauvegarde non chiffrée, aucun champ d'index en clair,
  non journalisé, effacé avec le groupe Odyssée.
- Changer de réponse ou l'effacer **ne touche aucune saisie** : mesuré dans la
  base par `essais:suivi:navigateur`, et le sabotage qui élargit l'effacement
  fait rougir deux lignes.

---

## 13. Ce qui n'attend rien, et ne doit pas se retrouver ici

Par symétrie, et pour qu'on ne vienne pas chercher une décision là où il n'y en
a pas :

- **La fenêtre fertile, l'ovulation prédite et le conseil de contraception**
  sont refusés par la décision 12, déclarée **non levable**. Ils sont nommés
  dans `JAMAIS_CALCULE` (`odyssee/cycle-confidentialite.ts`) et un essai
  vérifie qu'aucun identifiant du module ne les calcule. Ce n'est pas une
  décision en attente, c'est un refus.
- **La synchronisation du suivi** n'attend pas non plus : non synchronisée par
  défaut (décision 18), et l'interrupteur appartient au lot B-6 du
  constructeur. La part de ce chantier est de garder les magasins à part et
  déclarés.
