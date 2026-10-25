# Molécules — ce que les sources permettent de remplir, et ce qu'elles ne permettent pas

Établi le 25 octobre 2026, sur les cinq molécules du catalogue et les huit RCP
de la collecte du 14 octobre, reconstitués et contrôlés contre leurs manifestes.

## 1. Une correction à la passation

La passation annonçait : « Ce qui bloque, ce sont les valeurs : demi-vies,
interactions, limites de sécurité, niveaux de preuve. » **Deux de ces quatre
étaient déjà faites** sur `main`, depuis le 16 octobre :

| Valeur | État trouvé | Reste à faire |
| --- | --- | --- |
| Demi-vies | 4 sur 5 sourcées dans leur RCP ; la cinquième déclare l'absence | rien |
| Niveaux de preuve (`maturite`) | 5 sur 5 sourcés | rien |
| Interactions | 11, tirées du Thésaurus de l'ANSM | rien |
| **Limites de sécurité** | **0** | c'est le travail de ce lot |
| **Statut antidopage** | **0 sur 5** | voir § 4 : insourçable |

J'ai vérifié l'existant plutôt que de le refaire, et je l'ai vérifié
**contre les documents** : voir § 5.

## 2. Les limites — une seule est sourçable, et c'est une mesure

La nature `rcp` signifie, dans le code, « dose maximale du résumé des
caractéristiques du produit ». Pas la posologie ordinaire, qui n'est pas un
plafond.

Les huit RCP de la collecte ont été lus sur ce seul critère :

| RCP | Dose maximale énoncée ? |
| --- | --- |
| Fluimucil 600 (N-acétylcystéine) | **oui** — 600 mg par jour |
| Androtardyl (testostérone énantate) | non |
| Nebido (testostérone undécanoate) | non |
| Modiodal (modafinil) | non |
| Modafinil Viatris | non |
| Hidonac IV (N-acétylcystéine) | non |
| Citrate de caféine Cooper | non |
| Gencebok (caféine, EMA) | non |

Dans les sept « non », les occurrences de « maximale » désignent des
**concentrations plasmatiques** relevées en pharmacocinétique. Les prendre pour
des limites aurait transformé une mesure de sang en autorisation de dose, sous
un titre qui annonce « Limites à ne pas dépasser ».

Androtardyl mérite un mot, parce que c'est le cas où l'erreur aurait été la
plus facile : son RCP porte « 250 mg IM toutes les 2 à 4 semaines ». C'est une
**posologie**, pour une indication précise, avec un intervalle que le texte dit
d'ajuster sur les taux sériques. L'afficher comme une limite de sécurité aurait
donné un plafond à qui n'est pas dans cette indication.

### L'énoncé livré, et pourquoi il n'est pas celui du RCP

Le RCP écrit « La dose journalière maximale ne doit pas dépasser 600 mg ».
C'est une prescription, que la décision H.9 interdit d'afficher ici. La fiche
porte donc le **fait** — « 600 mg par jour, dose journalière maximale portée
par le RCP » — avec sa population (adulte ; le même RCP écarte les moins de
18 ans et contre-indique les moins de 2 ans), sa voie (orale, sachet de
600 mg), sa source et la date du document (26 juin 2024).

## 3. Les limites d'autorité — aucune, et c'est mesuré

La collecte porte deux documents d'autorité sur les apports : l'« Overview on
Tolerable Upper Intake Levels » de l'EFSA (version 11, août 2025) et le rapport
de l'ANSES de mars 2021.

**Ni l'un ni l'autre ne mentionne la caféine, pas une fois.** Ce sont des
documents sur les vitamines et les minéraux ; la demande E3 de la collecte
portait sur les vitamines. Aucune limite d'autorité n'est donc disponible, pour
aucune des cinq molécules.

## 4. Le statut antidopage — insourçable, et voici ce qui a été cherché

Les cinq fiches portent `inconnue`. C'est juste, et ce n'est pas un oubli.

Les **deux pages de l'AFLD** déposées dans la collecte ont été lues en entier.
Elles ne classent **aucune** des cinq molécules :

- l'article du 5 janvier 2026 ne donne que les **ajouts** de la liste 2026,
  classe par classe ;
- la page « liste des substances et méthodes interdites » ne fait que renvoyer
  au PDF de l'AMA.

**Un piège s'y trouve, et il faut le nommer.** L'article liste, sous
« S6. Stimulants », le **flmodafinil** et le **fladrafinil**. Ce ne sont pas le
modafinil : ce sont deux analogues, ajoutés à la liste 2026. Lire cette ligne
comme classant le modafinil serait une erreur de lecture — et l'erreur est
d'autant plus tentante que le classement réel du modafinil est de notoriété
publique. La règle de cette branche l'interdit : ce qui n'est pas dans le
dossier ne s'écrit pas, même quand on croit le savoir.

**Les deux documents qui lèveraient le voile**, tous deux relevés « trouvé, non
téléchargeable » dans la collecte :

1. le PDF officiel de la liste 2026 de l'AMA (`wada-ama.org`, défi AWS WAF) ;
2. le **décret n° 2025-1226 du 15 décembre 2025** (`JORFTEXT000053036083`), qui
   transpose la liste en droit français — bloqué sur Légifrance.

Le second est la meilleure piste : c'est un texte au Journal officiel, et la
collecte a déjà reconstitué 57 textes depuis les données ouvertes de la DILA.
Les incréments JORF de décembre 2025 figurent dans le relevé de provenance, mais
les 318 incréments JORF restants n'ont pas été lus. **Une reconstitution du
décret depuis la base JORF est donc plausible**, et c'est à l'agent de recherche
d'Alexis, pas à moi.

## 5. Ce que la collecte reconstituée a permis de vérifier en plus

Les sondes de `essais:catalogue-molecules` se mettaient en veille faute des PDF
sur la machine. Ils y sont maintenant, et les sondes tournent :

- chaque durée de chaque demi-vie **figure dans le RCP cité** ;
- le RCP de la N-acétylcystéine **ne mentionne effectivement aucune demi-vie**,
  comme la fiche le déclare ;
- les onze interactions sont au bon niveau de l'ANSM, et les pages citées
  (17, 47, 177) portent bien les substances qu'on leur fait dire ;
- l'empreinte SHA-256 du RCP de Fluimucil reconstitué est **identique** à celle
  que le catalogue avait enregistrée le 16 octobre. Le document est le même,
  octet pour octet.

Ce dernier point vaut plus que lui-même : il relie la reconstitution de
`sources/` et le catalogue, et montre que les deux parlent du même document.

## 6. Un défaut de ma propre sonde, trouvé en la posant

La sonde des limites a d'abord **passé à vide**. Elle réutilisait `couplesDe`,
qui ne reconnaît que les durées — jours, heures, semaines —, et rendait donc une
liste vide sur « 600 mg par jour ». La comparaison qui suivait ne comparait rien
et s'affichait verte.

C'est la deuxième fois dans la même journée qu'une de mes vérifications réussit
sans rien mesurer. Un extracteur de doses distinct la corrige, et l'absence
d'extraction est désormais **rouge** plutôt que silencieuse.

## 7. Ce qui reste, et à qui

- **Le statut antidopage des cinq molécules** : attend le décret du 15 décembre
  2025 ou le PDF de l'AMA (§ 4).
- **La demi-vie de la N-acétylcystéine** : absente de son RCP ; demande une
  autre source primaire.
- **Les doses étudiées** : zéro ligne, comme la décision 8 l'avait laissé. Je ne
  les ai pas instruites : elles relèvent de publications, pas des RCP, et aucune
  n'est au dossier pour ces molécules.
- **Les limites des quatre autres molécules** : elles n'existeront que si une
  autorité en fixe une, ou si un autre RCP en énonce une. En l'état, la phrase
  affichée est la bonne, et sa seconde moitié est l'essentiel : « l'absence de
  limite n'est pas une preuve d'innocuité ».
