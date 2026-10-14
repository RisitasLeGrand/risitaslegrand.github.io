# Profil (âge, sexe) et suivi du cycle menstruel — plan de phase 0

*Soumis à validation. **Aucune ligne de code n'est écrite** avant un « go » sur
ce document : le prompt l'exige en tête, et la règle de liaison le dit
indépendamment.*

Ce document répond à la phase 0 demandée : le plan en phases, le tableau des
amendements, le registre des usages, l'inventaire des repères sourcés, le
catalogue des facteurs, les quatre maquettes, la liste blanche des chaînes
imposées, et les vingt-cinq décisions avec une recommandation pour chacune.

Il commence par ce qui le rend nécessaire : **le prompt décrit un état du code
qui n'existe pas**, et **les sources dont il dépend sont hors de portée de ce
conteneur**. Ces deux faits changent l'ordre des phases, pas l'ambition.

---

## 1. Ce que j'ai vérifié dans le code, et ce que cela corrige

Le prompt écrit en 0.1 : « *le 14 octobre 2026, à partir des prompts seuls :
je n'ai pas lu le code, refais ces constats dans le dépôt* ». Fait, le même
jour. **Trois constats sur cinq supposent du code livré qui n'existe pas.**

| Constat de 0.1 | Vérification | Résultat |
|---|---|---|
| Aucun champ « sexe » dans le profil commun | `grep -rniE '\b(sexe\|gender)\b' src/ scripts/` | **0 occurrence.** Exact |
| « L'âge y est **facultatif** (année de naissance ou âge) » | les 32 `champ:` de `src/lib/noyau/profil.ts` | **Faux.** Ni âge, ni année de naissance. Le champ n'est pas facultatif : **il n'existe pas** |
| « **Règles d'âge existantes** » : substances, échelles, veille, menu des molécules sous 18 ans | `grep -rniE '18 ans\|mineur\|majeur\|AGE_MIN'` sur `src/` et `scripts/` | **Aucune.** Deux faux positifs (« changements législatifs majeurs », « versions majeures »). **Il n'y a aucune logique d'âge dans Cyclades** |
| « Rien ne garantit qu'une pilule figure au catalogue » | `molecules.ts`, `FAMILLES_MASQUEES` | **Exact, et plus net** : aucune classe contraceptif ni hormone sexuelle. Les familles masquées sont `androgenes`, `anabolisants`, `stimulants`, `opioides`, `psychedeliques` |
| Le « statut hormonal » de C.5 est trop grossier | `sensible.ts`, `NATURES` | **Exact**, et aggravé : sa nature `cycle` est déjà libellée **« Phase du cycle »** — l'homonymie que 0.2 n° 6 interdit est **déjà livrée** |

**Conséquence sur la phase 1.** Le prompt la décrit comme un **amendement** de
H.1 (« année, et mois à la frontière »). Il n'y a rien à amender : la règle
« module substances désactivé sous 18 ans » est **annoncée dans un prompt, pas
écrite dans le code**. La phase 1 ne corrige pas une incohérence, elle **crée**
le champ, le fichier de seuils, la machinerie de frontière et les points de
contrôle. C'est plus de travail que le prompt ne l'imagine, et aucun de ces
points n'a de dette existante à défaire.

### Deux choses que le prompt ne pouvait pas savoir

**Une collision de noms est déjà en production.** `/odyssee/mes-regles/` existe
et sert les **règles de classement des opérations bancaires** de Finances
(phase 3 bis). Si le suivi du cycle prend « Mes règles », la collision est dans
la **table de routage**, pas seulement dans les libellés. Le libellé neutre par
défaut que propose 4.8 (« Suivi personnel ») la résout — mais par accident.
**À inscrire comme contrainte technique**, pas comme préférence de ton : le
chemin `/odyssee/mes-regles/` est pris, définitivement.

**Trois mécanismes demandés existent déjà et sont réutilisables.**

| Ce que le prompt demande | Ce qui existe | Ce qu'il reste à faire |
|---|---|---|
| Registre des usages avec « ce qu'il lit » et un interrupteur (3.1, 2.6) | `src/lib/odyssee/consommateurs.ts` : sept consommateurs déclarés, phrase « voit » reprise du plan au mot près, `actifParDefaut`, interrupteurs ; écran `/odyssee/qui-lit-mon-budget/` | Décalquer le patron sur l'âge et le sexe. **Pas de mécanisme à inventer** |
| « Une valeur sans source n'est pas affichée » (0.3) | `ValeurSourcee<T>` (`sante.ts`) : une **union**, pas un objet à champ facultatif — *« il n'existe aucune manière d'en construire une qui porte un nombre et pas de source »*. Le compilateur refuse | Lui ajouter `population_visee` (3.3) |
| Contexte hormonal daté et versionné (4.2) | `StatutHormonal` (`sensible.ts`) : nature, intitulé, début, fin `null` tant que cela dure, `statutsEnCours()` ; fait `odyssee.statut-hormonal`, domaine `corps`, déjà sous coffre | Étendre les natures aux huit types de 4.2 **et renommer la nature `cycle`**, qui porte aujourd'hui le mauvais sens du mot |

L'asymétrie est nette, et c'est elle qui structure le plan : **le socle de
confidentialité et de sourçage est déjà bâti ; le profil, lui, est à créer de
zéro.**

---

## 2. La contrainte qui commande tout : les sources sont hors de portée

Relevé **ce jour**, depuis ce conteneur, cinq hôtes à la même minute :

| Hôte | Pour quoi | Résultat |
|---|---|---|
| `pubmed.ncbi.nlm.nih.gov` | FIGO 2018, McNulty 2020, ACOG 651 | **injoignable** |
| `doi.org` | résolution des DOI de l'annexe | **injoignable** |
| `www.figo.org` | source primaire des repères de 4.4.3 | **injoignable** |
| `www.merckmanuals.com` | la table par laquelle le prompt a lu le FIGO | **injoignable** |
| `github.com` | **témoin** | répond |

Cela confirme, un jour plus tard et sur les hôtes propres à ce prompt, le
relevé de douze hôtes du 13 octobre (`docs/cyclades/acces-sources.md`). Le
refus vient de la passerelle, avant tout échange avec les sites : c'est la
politique réseau de l'environnement.

**Ce que cela interdit, littéralement.** Le prompt pose en 0.3 que *« une valeur
que tu ne retrouves pas à la source n'est pas affichée »*, et en 4.4.5 que
*« un déclencheur n'est codé que s'il a une source et une date »*. Je ne peux
atteindre **aucune** des sources de son annexe. Donc, en appliquant sa propre
règle sans l'assouplir :

- **aucun repère FIGO** n'est affichable (4.4.3) ;
- **aucun signal d'orientation** n'est codable (4.4.5) ;
- **la liste des symptômes d'urgence** n'est pas validable (4.4.6) — et le
  prompt la veut disponible *à tout âge et sous tout statut* ;
- **aucun repère de sommeil par tranche d'âge** (3.2.2, 3.2.5) ;
- **aucun intervalle de repli stratifié** (3.2.6) ;
- **aucune population de validation des trois échelles** (3.2.7) ;
- **aucun repère financier lié à l'âge** (3.2.8) ;
- **aucun `influence_cycle`** de molécule (3.2.6) ;
- **la question de l'âge minimum** (4.1, décision 5) reste tranchée par prudence
  et non par source, puisque ACOG 651 est injoignable.

Je **n'ai vérifié aucune source médicale moi-même**. Tout ce que l'annexe
contient vient de la lecture du pilote, et le prompt lui-même en classe une
partie comme « pistes non vérifiées ». Je ne reprendrai aucun de ces nombres à
mon compte.

**Ce que cela n'interdit pas**, et c'est considérable : tout ce qui ne compare
qu'à **ma propre base**. Le journal, les statuts, la saisie, les statistiques
personnelles, les fenêtres ancrées, l'estimation mesurée sur mon historique et
son rétro-test, la fiche de cycle, la couverture, la discrétion, et **tout le
socle de confidentialité**. C'est le principe 0.4 (a) du prompt : *« la seule
référence défendable est ma propre base »*. Il se trouve que c'est aussi la
partie que ce conteneur peut construire.

### Ce qui en découle : une inversion de l'ordre des phases

Le prompt place en **phase 2** les populations visées et les usages hors cycle,
et en **phase 3** le suivi du cycle. Or la phase 2 est **bloquée à près de 90 %
sur des sources injoignables**, tandis que le cœur de la phase 3 ne dépend
d'aucune source.

Suivre l'ordre du prompt, c'est passer des semaines sur une phase qui ne peut
livrer que des écrans disant « repère non affiché, source non vérifiée ».

**Je recommande d'inverser**, et je donne l'ordre révisé en section 4. Le prompt
autorise explicitement ce genre d'arbitrage : *« Tes décisions de conception
antérieures prévalent sur mes prompts »*. Mais c'est un écart à son plan, donc
c'est à toi de le valider — **décision A**, ajoutée aux vingt-cinq.

---

## 3. Tableau des amendements

Le prompt amende sept règles existantes et demande le tableau complet. J'ajoute
une colonne que sa consigne ne prévoyait pas, et qui change tout : **ce qui est
réellement livré aujourd'hui**.

| # | Règle d'origine | Règle amendée | Raison | État réel du code |
|---|---|---|---|---|
| 1 | **H.1** : « la date de naissance du profil » pour le seuil de 18 ans | **Année**, et **mois seulement à la frontière** d'un seuil utilisé ; côté prudent en cas de doute (2.4) | H.1 dit « date » quand I.2 recommande l'année ; et une date complète n'est pas nécessaire | **Rien à amender.** Ni date, ni année, ni seuil, ni module substances dans le code |
| 2 | **H.5** et la convention « source, date, population » | Tout repère porte `population_visee` ; le moteur rend `applicable` / `non_applicable` / `indeterminable` ; **seul `applicable` affiche** (3.3) | Un repère adulte affiché à une personne de 16 ans est faux, pas approximatif | `ValeurSourcee` existe et **refuse déjà** une valeur sans source. Il manque le champ et le moteur d'évaluation |
| 3 | **B.4** : conflit si Sport déclare « naturel » et Odyssée a un traitement hormonal actif | Se déclenche sur la **classe** de la molécule, jamais sur le motif ; ce que « naturel » exclut est **réglé par la personne** ; défaut hors traitements prescrits (4.6) | Une contraception hormonale déclencherait le conflit à tort | Le flux B.4 existe (phase 3f). Les **classes de molécules n'existent pas** : rien à quoi accrocher la règle |
| 4 | **C.5, D.5, H.8** — ce que Sport lit | Sport ne lit **que les fenêtres passées** du cycle ; aucun statut, aucun bilan hormonal sexuel, aucune molécule contraceptive (4.7) | Le « statut hormonal » à quatre valeurs est trop grossier et trahirait le suivi | `StatutHormonal` existe sous coffre. **Sa nature `cycle` est libellée « Phase du cycle »** : à renommer avant toute extension |
| 5 | **E.7** (`contexte.md`, `qualite-des-donnees.md`) et la catégorie d'export « traitements » de H.8 | Aucune ligne du cycle sans la case « cycle » ; les molécules contraceptives **sortent** de la catégorie « traitements » (6.3) | Sinon la liste des traitements trahit le suivi par déduction | L'export IA existe (`export-ia.ts`). Les catégories sont à rouvrir |
| 6 | **Notifications de correction** du tableau de bord | Une notification touchant le cycle ne s'affiche **jamais** sur le tableau de bord ; elle se lit dans l'écran du cycle (6.3) | Une notification lue par-dessus l'épaule révèle le suivi | Le flux de notification existe (phase 3c) ; le filtre est à ajouter |
| 7 | **J.5.4** « tout voir » | Le cycle et le statut hormonal sont des **sous-interrupteurs distincts**, désactivés même après « Oui, tout voir » (6.7) | Un consentement global ne vaut pas pour la donnée la plus sensible | À vérifier dans J.5 ; non examiné à ce jour |

**Un huitième amendement, que le prompt ne demande pas et que je propose.**
La nature `cycle` de `StatutHormonal`, libellée « Phase du cycle », doit être
**renommée** (`cure` ou `phase-de-cure`, selon ce que Sport entend par là) avant
qu'un module menstruel n'existe. Garder les deux, c'est garantir que le test de
vocabulaire de 0.2 n° 6 échoue dès sa première exécution — sur du code déjà
livré, pas sur du neuf. C'est une **migration de données** sur un magasin sous
coffre : elle a un coût et elle doit être décidée. **Décision B.**

---

## 4. Les phases, révisées

Je garde les intitulés du prompt. Je change l'ordre, et j'ajoute à chaque phase
ce qui la bloque.

| Phase | Contenu | Dépend d'une source ? | Faisable ici |
|---|---|---|---|
| **0** | Ce document | non | **fait** |
| **1** | **Profil** : champs `naissance_annee`, `naissance_mois`, `majeur_declare`, `sexe`, `a_un_cycle` ; **interface de contexte** `contexte_personne()` ; fichier déclaratif des seuils ; collecte avec trois sorties ; demande au moment du besoin ; carte « utilisateur existant » ; écran « Qui utilise mon âge et mon sexe » ; test sur le graphe d'imports | non — le seuil de 18 ans est une **règle de produit** | **oui, intégralement** |
| **2** | **Socle `population_visee`** : le champ sur `Source`, le moteur `applicable / non_applicable / indeterminable`, les messages, les tests sur fixtures | non — le **moteur** ne demande aucune source ; seules les **valeurs** en demandent | **oui.** Livrable « à vide » : tous les repères rendent `indeterminable`, honnêtement |
| **3** *(était 3)* | **Cycle, socle** : confidentialité d'abord (6.1 à 6.5, 6.9) — chiffrement, index, exclusions d'export et d'ICS, effacement par purge, synchronisation ; puis activation, statuts (4.2), saisie (4.3), cycles et statistiques personnelles (4.4.1, 4.4.2), fenêtres (4.5), discrétion (4.8) | non | **oui** |
| **4** *(était 5)* | **Facteurs** : catalogue, fiche de cycle, couverture, traçabilité (5.1 à 5.3, 5.5, 5.6) — **sans** les énoncés de lien, qui restent « lien non établi par Cyclades » | non pour le moteur ; **oui** pour chaque énoncé | **oui, en partie** — la mécanique et les écarts à ma base ; pas les phrases sourcées |
| **5** *(était 6)* | **Pistes entre cycles** et intégrations (5.4, 4.7, dérivées S2 de 6.6) | non | **oui** |
| **6** *(était 2)* | **Usages de l'âge et du sexe par rubrique** (3.2), par lots | **oui, presque tous** | **non**, sauf trois usages (§5) |
| **7** *(était 4)* | **Repères FIGO, estimation, retard, signaux, urgences, documentation** (4.4.3 à 4.4.8) | **oui**, sauf l'estimation et le retard | **partiellement** |
| **8** | Facultative : marqueurs d'ovulation, import d'historique, repères de prévention, non-synchronisation, orientation croisée | oui | **non** |

**Ce que l'inversion produit concrètement** : les phases 1 à 5 sont intégralement
réalisables dans ce conteneur et livrent un module utilisable — journal,
statuts, statistiques personnelles, fiche de cycle, pistes — sans afficher un
seul chiffre que je n'aurais pas pu vérifier. Les phases 6 à 8 attendent les
sources, exactement comme les phases 2 à 14 du chantier Santé.

**Deux réserves que je ne masque pas.**

1. **L'estimation (4.4.4) est en phase 7 chez toi, et je la laisse là** alors
   qu'elle ne dépend d'aucune source. Raison : elle porte la mention fixe de
   1 n° 2, et son rétro-test ne vaut qu'avec un historique réel. La livrer avant
   d'avoir des cycles saisis, c'est livrer un écran qui ne dira jamais que
   « données insuffisantes ». Elle est prête techniquement dès la phase 3 ; elle
   s'affiche quand il y a de quoi l'afficher.
2. **La liste des symptômes d'urgence (4.4.6)** est le seul point où la règle
   « pas de source, pas d'affichage » a un coût de sécurité : le prompt la veut
   disponible à tout âge, sous tout statut, et même dans la variante où le
   module est désactivé. Je ne l'inventerai pas. **Il faut que tu me fournisses
   cette liste depuis une source officielle** — c'est le seul élément dont
   l'absence est pire que l'attente. **Décision C.**

---

## 5. Le registre des usages (3.1)

### Schéma

Décalqué de `consommateurs.ts`, étendu aux champs que 3.1 énumère :

```
{ id, rubrique, consommateur, cles_lues[], but, effet_visible,
  source | 'règle de produit', population, defaut, si_inconnu,
  interrupteur, derive_S2, revu_le }
```

Deux règles tenues du précédent de Finances, et une ajoutée :
- la phrase **« ce qu'il lit »** est reprise **au mot près** du registre dans
  l'interface — deux formulations de la même promesse et la personne ne sait
  plus laquelle l'engage ;
- un consommateur **absent du registre ne reçoit rien** (test sur le graphe
  d'imports) ;
- **nouveau** : un consommateur dont la `source` est vide et qui n'est pas
  marqué « règle de produit » **échoue à la validation du schéma**. C'est la
  transposition de ce que `ValeurSourcee` fait déjà au niveau du type.

### Les usages retenus

| id | Rubrique | Lit | Effet visible | Fondement | Défaut | Si inconnu | Livrable ici |
|---|---|---|---|---|---|---|---|
| `profil.modules-a-seuil` | Profil | `majeur` | Un module à seuil apparaît dans « Modules disponibles » | règle de produit | actif | module **non proposé** ; `majeur_declare` suffit | **oui** |
| `profil.question-cycle` | Profil | `sexe_physio` | La question « avez-vous un cycle ? » est posée d'office | règle de produit (inclusivité, 0.2 n° 2) | actif | question **non posée** d'office ; module accessible par « Modules disponibles » | **oui** |
| `revisions.condition-age-concours` | Révisions | date saisie ponctuellement | « âge à la date du … », **sans conclure à l'éligibilité** | **l'avis de concours, que je saisis** | inactif | rien affiché | **oui** — la source est fournie par la personne, pas par le réseau |
| `corps.repere-sommeil` | Corps | `tranche_age` | Un repère publié de durée de sommeil, **comme repère** | source à obtenir | inactif | repère non affiché | **non** |
| `revisions.avert-planification` | Révisions | `tranche_age` | Avertissement sobre si le plan réduit durablement le sommeil déclaré | source + règle de produit (décisions 6 et 24) | **inactif** | pas d'avertissement | **non** |
| `sante.intervalles-repli` | Santé | `tranche_age`, `sexe_physio` | Intervalle de repli **quand le laboratoire n'a pas fourni le sien** | source à obtenir | actif | **non affiché** ; l'intervalle du laboratoire prévaut toujours | **non** |
| `sante.mentions-population` | Santé | `tranche_age`, statuts | Les mentions de population de la source en tête | la source elle-même | actif | mentions non triées | **non** (dépend du catalogue H.3) |
| `sante.substances-majeur` | Santé | `majeur` | Module substances non proposé sous 18 ans | règle de produit (H.1) | actif | **non proposé** | **oui** |
| `psyche.population-echelles` | Psyché | `tranche_age` | « Cette échelle n'a pas été validée pour votre âge » + score non interprété | source à obtenir | actif | message « population de validation non confirmée » | **non** |
| `psyche.echelles-majeur` | Psyché | `majeur` | Échelles non proposées à un mineur | règle de produit | actif | **non proposées** | **oui** |
| `finances.reperes-age` | Finances | `tranche_age` | Repères officiels liés à la génération ; horizon en années | source officielle datée | inactif | repère non affiché | **non** |
| `export.tranche-age` | Exports | `tranche_age` | Une case **décochée** ; l'année **jamais** | règle de produit | inactif | case absente | **oui** |
| `export.sexe` | Exports | `sexe_physio` | Une case **décochée** | règle de produit | inactif | case absente | **oui** |

**Sept usages livrables maintenant, six bloqués sur des sources.** Et parmi les
sept, cinq sont des **restrictions** (ne pas proposer, ne pas cocher) plutôt que
des enrichissements. C'est un résultat, pas une déception : le prompt demande en
3.0 qu'un usage change « quelque chose de concret », et retirer une fonction à
un mineur en est un.

### Les non-usages déclarés

Repris de 3.2 et consignés avec leur raison, car 3.1 l'exige :

| Rubrique | Écarté | Raison |
|---|---|---|
| Profil, adaptation | tutoiement, ton, style, rappels, ordre des cartes | l'adaptation reste fondée sur le déclaré et l'observé (A.4), jamais sur l'âge ou le sexe |
| Révisions | difficulté, tri, niveau estimé, ZPD, normes Cog-Training, actualités, glossaire | 1 n° 6 : aucune comparaison à une tranche d'âge ou à un sexe |
| Sport | standards de force par sexe ou âge, programmes genrés, couleurs genrées, zones de fréquence cardiaque, **repère de force de préhension** | 1 n° 6. Le repère de préhension est écarté **même en bande de contexte** |
| Corps | IMC et catégories, dépense énergétique, cible calorique, poids idéal, tour de taille, comparaison à une moyenne | 1 n° 7, prudence propre aux troubles du comportement alimentaire |
| Santé | score de santé, « âge biologique », risque chiffré, dose selon l'âge ou le sexe | H.9 |
| Psyché | seuils cliniques par sexe, « profil psychologique » | aucune source, et 1 n° 6 |
| Finances | « 100 moins l'âge », comparaison de revenus ou de patrimoine, **finances comme indice de stress du cycle** | E.4 ; décision 13 |
| Odyssée | XP, série, jauge, compteur issus du cycle | 1 n° 11 — **et c'est un test**, pas une intention |
| Interface | accord grammatical selon le sexe | 2.1 : formulations neutres par défaut |

---

## 6. Inventaire des repères sourcés et de leur population (3.3)

Le prompt demande de relever **tous les repères sourcés déjà présents ou prévus**
et de vérifier qu'ils portent une population. Relevé :

| Repère | Où | Source présente ? | Population ? | Suite |
|---|---|---|---|---|
| Paliers du **PHQ-9** et du **GAD-7** | `echelles.ts` | **oui** — champ `origineDesPaliers`, « mot pour mot dans l'interface » | **non** — il y a `reserve` (ce que la source dit de sa portée) mais pas de population structurée | ajouter `population_visee` ; sa **valeur** demande la source, injoignable |
| **WHO-5** | `echelles.ts` | sans objet — `paliers: []`, `origineDesPaliers: null` | sans objet | **rien à faire, et c'est exemplaire** : le document ne porte aucun seuil, vérifié ; les seuils de 13 ou 50 qui circulent viennent d'ailleurs et n'ont pas été inscrits |
| Valeurs des **fiches de molécules** (demi-vie, interactions, antidopage) | `sante.ts`, `molecules.ts` | **structurellement garanti** — `ValeurSourcee` est une union que le compilateur refuse de construire sans source | **non** | ajouter `population_visee` à `Source` |
| **Intervalles de référence** des bilans | `sante.ts` | **par construction** : c'est l'intervalle **du laboratoire**, saisi avec le résultat — *« un intervalle de référence posé par le logiciel »* a été refusé dès l'origine | sans objet | **ne rien changer.** H.5 est déjà respecté plus strictement que 3.3 ne l'exige |
| Repères **FIGO** du cycle | n'existe pas | — | — | phase 7, source injoignable |
| Repère de **sommeil par tranche d'âge** | n'existe pas | — | — | phase 6, source injoignable |
| Repères **financiers liés à l'âge** | n'existe pas | — | — | phase 6, source injoignable |

**Deux enseignements.** D'abord, Cyclades n'a **aujourd'hui aucun repère de
population affiché** : il n'y a donc rien à retirer, seulement un champ à
ajouter avant que le premier n'arrive. Ensuite, le choix du WHO-5 — afficher le
score nu plutôt que des seuils trouvés ailleurs — est exactement la règle de
0.3 appliquée avant qu'elle ne soit écrite. Le moteur de 3.3 doit être au moins
aussi strict, pas moins.

---

## 7. Catalogue des facteurs (5.2), confronté aux faits réels

Le prompt propose treize facteurs et demande de parcourir **tous les faits que
Cyclades enregistre**. Le contrat en déclare **36**, chacun avec son
`proprietaire` et son `domaine` — ce qui sert directement le `domaine_a_autoriser`
du schéma 5.2.

| # | Facteur proposé | Fait réel | Couverture | Statut de preuve |
|---|---|---|---|---|
| 1 | Sommeil : durée, nuits courtes, irrégularité | `odyssee.sommeil` *(corps, durée)* | **complète** | **inconnu** — piste non vérifiée (annexe) |
| 2 | Horaires atypiques, travail de nuit | aucun fait ; `joursTravail` et `plagesTravail` sont des **champs de profil déclarés** | **partielle** — déclaré, pas observé | **inconnu** |
| 3 | Déplacements, changement de fuseau | **aucun.** `fuseau` est un champ de profil à valeur unique ; `odyssee.evenement` est un événement d'agenda sans notion de lieu | **absente** | **inconnu** |
| 4 | Stress et charge perçus | `odyssee.checkin` *(psyche)*, `odyssee.charge-percue` *(psyche, nombre)* | **complète** | **inconnu** |
| 5 | Charge de révision, proximité d'une épreuve | `revision.seance`, `odyssee.focus`, + `datesEpreuves` du profil | **complète** | **inconnu** |
| 6 | Charge d'entraînement | `sport.seance`, `sport.serie`, `sport.phase`, `sport.blessure` | **complète** | **inconnu** |
| 7 | Poids ; apports déclarés | `odyssee.poids` ; `odyssee.repas`, `odyssee.apport-externe` | **complète** | **inconnu** — et **aucune disponibilité énergétique** (1 n° 7) |
| 8 | Alcool, tabac, caféine | `odyssee.hydratation` *(corps, nombre)* couvre les boissons ; **tabac et alcool n'ont pas de fait dédié** | **partielle** | **inconnu** |
| 9 | Médicaments et compléments | `odyssee.medicament` *(sous coffre)* | **complète pour les prises** ; `influence_cycle` **n'existe pas** | **inconnu**, et le champ dépend des RCP |
| 10 | Maladie, fièvre, symptômes, blessure | `odyssee.sante` *(corps, texte)*, `sport.blessure` | **complète** | **inconnu** |
| 11 | Événements marquants | `odyssee.evenement` | **complète** | **inconnu** |
| 12 | Stade de vie déclaré | `odyssee.statut-hormonal` *(corps, sous coffre)* — **existe déjà** | **complète** | déclaré, pas inféré (1 n° 5) |
| 13 | Contraception d'urgence saisie par moi | à créer dans le journal du cycle | **absente** | **inconnu** |

**Huit facteurs sur treize ont un fait réel derrière eux aujourd'hui**, deux sont
partiels, un est absent, deux restent à créer. **Aucun n'a de statut de preuve
meilleur que « inconnu »**, puisque je n'ai pu lire aucune source.

**Ce que cela impose à la phase 4.** La fiche de cycle est construite — écarts à
ma base, couverture, frise, bloc final — mais **chaque énoncé de lien reste dans
la rubrique « Mesuré par Cyclades, lien non établi par Cyclades »** (décision 13,
recommandée). Une fiche qui dit *« votre sommeil médiane a été de 5 h 50 contre
7 h 10 d'habitude, sur 22 nuits renseignées sur 31 »* est utile et entièrement
vraie. Y ajouter *« décrit dans la littérature comme associé à… »* sans avoir lu
la littérature serait précisément ce que 0.3 interdit.

**Le facteur 3 est un angle mort à déclarer**, pas une lacune à combler en
douce : Cyclades **ne sait pas** que je me suis déplacé. L'écran 5.5 doit le dire
en toutes lettres.

---

## 8. Les quatre maquettes

Décrites, non dessinées : ce sont des écrans de texte, et une description
testable vaut mieux qu'une image.

### 8.1 Questions de profil

Une question par écran, trois sorties toujours présentes et de même poids visuel
que la réponse, rien de précoché.

```
┌──────────────────────────────────────────────┐
│ Quelle est votre année de naissance ?        │
│                                              │
│   [ 19▁▁ ]                                   │
│                                              │
│   Pourquoi cette question ?            ⌄     │  ← replié
│   Qui utilisera la réponse ?           ⌄     │
│   Que se passe-t-il si je saute ?      ⌄     │
│                                              │
│   [ Je ne sais pas ]  [ Je préfère ne pas    │
│     répondre ]  [ Plus tard ]                │
└──────────────────────────────────────────────┘
```

« Pourquoi » déplié : *« Elle sert à calculer votre âge. Cyclades ne conserve
jamais votre jour de naissance, et votre mois seulement si une fonction l'exige
à la frontière d'un âge. »* « Qui » déplié : **la liste vient du registre**, pas
d'un texte écrit à la main — sinon les deux divergent au premier usage ajouté.

Sur refus de l'année : *« Êtes-vous majeur(e) ? »* — *Oui · Non · Je préfère ne
pas répondre*.

Pour le sexe, même gabarit, avec l'explication : *« Ce n'est pas une question
d'identité. Choisissez ce qui correspond le mieux à votre physiologie et aux
repères que votre médecin utilise pour vos analyses. Vous pourrez le
modifier. »*

### 8.2 Saisie rapide du cycle — trois appuis au plus

Comptés **depuis l'ouverture du module**, ce que le test mesurera.

```
┌──────────────────────────────────────────────┐
│ Aujourd'hui                                  │
│                                              │
│  Saignements :                               │
│  (aucun) (traces) (légers) (moyens)(abondants)│  ← appui 1, et c'est fini
│                                              │
│  [ Mes règles commencent aujourd'hui ]       │  ← ou appui 1 ici
│                                              │
│  Symptômes                             ⌄     │  ← facultatif, replié
│  Note                                  ⌄     │
└──────────────────────────────────────────────┘
```

« Abondants » déplie seul les deux indicateurs de volume. **Le mot « règles »
n'apparaît qu'à l'intérieur du module** (4.8). Confirmation neutre : « Saisie
enregistrée ».

### 8.3 Fiche de cycle

Ordre imposé par 5.3, et le bloc final est fixe.

```
Cycle du 3 au 31 (28 jours · dans vos habitudes)

  Ce que Cyclades a observé, classé par écart à vos habitudes
  ─────────────────────────────────────────────────────
  Sommeil          5 h 50   habituel 7 h 10   −1 h 20
                   22 nuits renseignées sur 31
                   › Mesuré par Cyclades, lien non établi par Cyclades
                   › Autres explications possibles : …

  Charge Sport     +38 %    habituel …
                   …

  4 autres facteurs                                 ⌄

  Non évalués
  ─────────────────────────────────────────────────────
  Déplacements     Cyclades ne mesure pas vos déplacements
  Psyché           domaine non autorisé            [ autoriser ]

  ─────────────────────────────────────────────────────
  D'autres facteurs, mesurés ou non par Cyclades,
  ont pu intervenir.
```

**« Non autorisé » et « non mesuré » sont deux lignes distinctes** : les
confondre laisserait croire qu'un domaine coupé est un domaine vide.

### 8.4 « Qui utilise mon âge et mon sexe »

```
  Mon profil › Qui utilise mon âge et mon sexe

  ☐ Afficher les usages sensibles          ← décoché par défaut

  Santé — intervalles de repli            [actif]  ⌾
    Lit : tranche d'âge, sexe
    Pour : afficher un intervalle quand le laboratoire
           n'a pas fourni le sien
    État : inconnu faute de donnée

  Psyché — échelles réservées aux majeurs [actif]  ⌾
    Lit : majeur (oui/non)
    …

  [ Voir ce qui change sans mon sexe ]
  [ Voir ce qui change sans mon âge ]
```

Les lignes lisant `suivi_cycle` ou `statut_hormonal` sont **repliées et masquées
par défaut** : l'écran ne doit pas révéler l'existence du suivi à qui regarde
par-dessus l'épaule.

---

## 9. Liste blanche des chaînes imposées

Un fichier unique, versionné, relu par toi. Le balayage des **tournures
causales** s'applique **partout, liste blanche comprise**.

| Clé | Chaîne | D'où |
|---|---|---|
| `mention.pas-contraceptif` | « Cyclades n'est pas une méthode contraceptive et n'est pas un dispositif médical. » | 1 n° 2 |
| `mention.ouverture-module` | « Cyclades n'est pas une méthode contraceptive, n'est pas un dispositif médical et ne remplace pas un professionnel de santé. » | 4.0 |
| `retard.constat` | « Aucun début de règles n'est enregistré depuis [N] jours après la fin de la plage estimée. Vous pouvez saisir vos règles, ou indiquer "règles sautées" ou "saisie oubliée". » | 4.4.4 |
| `orientation.cloture` | « Cela peut avoir de nombreuses causes. À signaler à un professionnel de santé, notamment si cela vous gêne. » | 4.4.5 |
| `fiche.bloc-final` | « D'autres facteurs, mesurés ou non par Cyclades, ont pu intervenir. » | 5.3 |
| `fiche.pas-explication` | « Ce n'est pas une explication. » | 5.3 |
| `piste.avertissement` | « piste, pas une cause » | 5.4 |
| `rdv.pas-diagnostic` | « Document factuel, pas un diagnostic. » | 4.4.7 |
| `repere.general` | « repère général, pas une prévision » | 4.4.4 |
| `doc.citations` | citations de l'étude de 2019, entre guillemets, avec leur source | 4.4.8 |

**Mots interdits** hors citation d'une source : *normal*, *anormal*, *jours sûrs*,
*fertile*, *infertile*, *tout va bien*, *rassurant*, *idéal*, *optimal*,
*diagnostic*, et *cause* hors liste blanche. **Tournures balayées partout** :
*provoque*, *à cause de*, *explique*, *responsable de*, *dû à*.

**Test de vocabulaire** (0.2 n° 6) : aucun libellé ne dit « cycle » ou « phase »
sans qualificatif dans une zone où les deux sens coexistent. Il échouera dès sa
première exécution sur `NATURES.cycle = 'Phase du cycle'` — voir l'amendement 8.

---

## 10. Les décisions

Vingt-cinq du prompt, trois ajoutées par ce plan. Ma recommandation suit chacune ;
**aucune n'est appliquée sans ta réponse.**

| # | Décision | Ma recommandation |
|---|---|---|
| **A** | **Inverser l'ordre des phases** : cycle et facteurs avant les usages âge/sexe | **oui** — 90 % des usages de l'ancienne phase 2 sont bloqués sur des sources injoignables |
| **B** | **Renommer la nature `cycle`** de `StatutHormonal` (migration sous coffre) | **oui**, avant toute extension — sinon l'homonymie est garantie |
| **C** | **Me fournir la liste des symptômes d'urgence** depuis une source officielle | **indispensable** — le seul point où l'attente coûte plus que l'imperfection |
| 1 | Un coffre par personne, sans partage | **confirmé** |
| 2 | Valeurs du sexe ; champ « genre » ou accord grammatical | **non** — formulations neutres |
| 3 | Question posée d'office à *femme* et *intersexe ou autre*, module ouvert à tous | **confirmé** |
| 4 | Emplacements de la collecte (chapitres 1 et 7) | **confirmé** |
| 5 | Frontière à 18 ans ; cycle sous 18 ans | **« journal seul »**, avec les urgences — ACOG 651 est injoignable, donc aucun repère d'adolescente |
| 6 | Avertissement de planification sur le repère de sommeil | **option désactivée par défaut**, et **non livrable** faute de source |
| 7 | Repères de prévention par âge et sexe | **plus tard** |
| 8 | Définition de J1 ; fenêtre « avant les règles » | J1 = premier jour de saignement menstruel, traces isolées exclues ; fenêtre **à fixer avec toi** (décision 24) |
| 9 | Marqueurs d'ovulation | **oui, phase 8**, et seulement a posteriori |
| 10 | Import d'un historique | **oui, phase 8**, brut non conservé |
| 11 | Signaux d'orientation | **aucun signal codé** tant qu'aucune source n'est atteignable ; le repère reste un fait affiché |
| 12 | Fenêtre fertile, ovulation prédite, contraception | **jamais** — non levable |
| 13 | Facteurs sans source | **rubrique séparée** « Mesuré, lien non établi ». Écartés : finances, usage de l'application, saison, lumière, météo |
| 14 | Méthode des pistes entre cycles | à proposer chiffrée en phase 5, **validée avant implémentation** |
| 15 | Le cycle dans « Que faire maintenant ? » | **jamais** |
| 16 | Base personnelle stratifiée par le cycle | **non** — contexte affiché seulement |
| 17 | Amendements B.4, lectures de Sport, exports | **confirmés**, avec la réserve que les classes de molécules n'existent pas encore |
| 18 | Option « ne pas synchroniser le cycle » | **non synchronisé par défaut** tant que les garanties ne sont pas démontrées |
| 19 | Dérivées S2 et sous-interrupteur indépendant de « tout voir » | **confirmé** |
| 20 | Libellé du module | **« Suivi personnel »** — et la collision avec `/odyssee/mes-regles/` l'impose autant que la discrétion |
| 21 | Largeur de la tranche d'âge à l'export | **dix ans** |
| 22 | Ordre de vérification des sources | **tu les fournis** ; ordre proposé : symptômes d'urgence, FIGO, sommeil par tranche, populations des échelles, RCP |
| 23 | Points appelant un avis juridique | **trois** : la qualification du suivi, la mention « pas un dispositif médical », le régime des données de santé |
| 24 | Paramètres de produit à justifier | proposés chiffrés en phase 3, **aucun appliqué avant ta réponse** |
| 25 | Purge physique, sauvegardes, index | **confirmé** ; ce que l'architecture ne permet pas sera dit, pas contourné |

---

## 11. Ce que je n'ai pas vérifié

Par honnêteté, et parce que le prompt l'exige dans ses livrables.

- **Aucune source médicale.** Ni FIGO 2018, ni Bull 2019, ni McNulty 2020, ni le
  consensus CIO 2023, ni ACOG 651. Les hôtes sont injoignables depuis ce
  conteneur, mesuré ce jour. Tout ce que l'annexe en dit vient de la lecture du
  pilote, que je ne reprends pas à mon compte.
- **J.5.4 et le mécanisme « tout voir »** : amendement n° 7 du tableau, non
  examiné dans le code. À faire avant la phase concernée.
- **Le prompt de synchronisation** sur ce que voient le relais de signalisation
  et les serveurs STUN (6.5) : non relu. La réponse conditionne la décision 18.
- **La matrice de permissions B.2** dans son état livré : je sais que le contrat
  de faits porte `proprietaire` et `domaine` pour les 36 types ; je n'ai pas
  vérifié que la matrice couvre toutes les lectures inter-branches que 4.7
  restreint.
- **Les quatre prompts absents de mes fichiers** (6, 7, 16, 17) : leur travail
  est livré, leur texte m'est inconnu. Si l'un d'eux porte une règle que ce plan
  contredit, je ne peux pas le savoir.
