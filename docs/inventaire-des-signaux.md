# Inventaire des signaux de Cyclades

*§ 2.1 du prompt « Centre de notifications ». Dressé en lisant le code,
pas en recopiant le tableau du § 2.2 : celui-ci est un point de départ « à
compléter, regrouper ou écarter, avec raison », et c'est ce que fait la
dernière colonne.*

Un signal est un endroit où Cyclades dit quelque chose de lui-même, sans
qu'on le lui demande. Les écrans qui répondent à une question posée — un
tableau de bord, une recherche — n'en sont pas.

## Ce que chaque colonne veut dire

- **Producteur** : la fonction qui, aujourd'hui, décide qu'il y a quelque
  chose à dire. `—` veut dire qu'aucune ne le fait : le signal est décrit
  dans un prompt et n'existe pas dans le code.
- **Plafond existant** : la cadence que le signal respecte déjà, avant le
  budget d'attention du centre.
- **Sensibilité** : ce que le signal révélerait s'il était lu par-dessus
  l'épaule.
- **Entre appareils** : ce qui voyage, et ce qui reste local.

## Le tableau

| Source | Producteur | Déclencheur | Plafond existant | Sensibilité | Affichage aujourd'hui | Entre appareils | Urgence | Au centre ? |
|---|---|---|---|---|---|---|---|---|
| `question-a-trancher` | `sync/service.ts` → `conflitsALire()`, et `odyssee/desaccords.ts` | Deux valeurs en désaccord après fusion, ou un désaccord inter-branches | aucun, et c'est voulu (§ 1 n° 8) | la valeur en désaccord, donc **oui** | `/appareils/#conflits` | la résolution voyage par le journal | non | **oui** — branchée, phase 2 |
| `avis-de-fusion` | `sync/veille.ts` → `surFusion` | Une fusion automatique qui a apporté quelque chose | une par lot (`marque`) | le **nombre** d'opérations trahissait une saisie (décision 5) | notification du système | la fusion est locale, l'avis aussi | non | **oui** — branchée, phase 2 |
| `proposition` | `adaptation.ts` → `propositionLocale()` | Un écart d'usage observé, avec consentement | **une par semaine**, toutes catégories (§ 1 n° 6) | le domaine de l'écart | `/profil/` | le refus voyage par le journal | non | oui, à brancher |
| `avertissement-avant-analyse` | `noyau/avertissements.ts` → `avertissement()` | Un export d'IA qui touche corps, psyché ou finances | un par export | le domaine visé | `/exporter-ia/` | local au geste | non | oui, à brancher |
| `rappel-de-prise` | `odyssee/sensible.ts` → `prisesDuJour()` | Une prise déclarée non pointée | la cadence des prises | **la molécule**, et par elle le traitement | `/odyssee/sante/` | sous coffre, donc local à l'ouverture | non | oui, sauf classes du cycle |
| `veille-du-rythme` | `odyssee/veille.astro` et son moteur | Le « rappel discret » unique de 5.1 du 27 | la cadence de 5.6 du 27 | le rythme de vie | hors de Psyché, titre neutre | sous coffre | non | oui — **et muette** (le 27) |
| `rappel-de-sauvegarde` | `noyau/coffre.ts` ligne 604 → condition bloquante | Une donnée scellée existe et la sauvegarde est ancienne | aucun ; il se renforce | **aucune** : ne porte sur aucune donnée | `/stockage/` | l'état de sauvegarde est local | non | **oui** — branchée, phase 3 |
| `revue-manquee` | `odyssee-jour.ts` → `rappelDeRevue(revuesManquees(...))` | Une revue du soir non tenue | groupé en « N revues » | le fait d'avoir une revue, pas son contenu | liste d'Odyssée et accueil | sous coffre | non | **oui** — branchée, phase 3 (prompt 36) |
| `occurrence-manquee` | `odyssee/occurrences-lues.ts` → `enRetard()` | Une occurrence de série dépassée | **une fois, jamais accumulée** (prompt 38) | la tâche | `/odyssee/calendrier/` | les pointages voyagent | non | **oui** — branchée, phase 3 |
| `pointage-a-reporter` | `odyssee/modele.ts` — pointages retenus coffre fermé | Un geste fait coffre fermé | un compteur, pas une liste | **le contenu est chiffré** : seul le nombre sort | `/odyssee/` | local tant que le coffre est fermé | non | oui, à brancher |
| `apprentissage-etendu` | `consentement-apprentissage.ts` | Le consentement n'a jamais été demandé | un, J.5 du 25 | le fait qu'on observe | `/profil/` | le consentement voyage | non | oui — **et muet** (le 25) |
| `trajectoire` | `odyssee/trajectoires.ts` | Une trajectoire atteinte ou abandonnée | `PLAFOND_ACTIVES = 3` | l'objectif suivi | `/syntheses/` | sous coffre | non | oui, à brancher |
| Alertes molécules, orientation santé | `odyssee/molecules.ts`, H.7 et H.10 du 25 | Un conflit entre molécules | — | **très forte** | écran Santé | sous coffre | **oui** (15, 112) | **renvoi seulement**, titre neutre |
| Ressources de détresse | E.2 du 22 (3114) | Un score d'échelle bas | — | **très forte** | écran Psyché | sous coffre | **oui** | hors du centre (§ 1 n° 7) |
| Nouvelles Actualités | chaîne des actualités | Une publication | — | aucune | `/actualites/` | contenu public | non | **non — écartée** (décision 2) |
| `journal-du-cycle`, `statut-du-cycle` | n'existent pas encore | — | — | **maximale** | leur écran | — | non | **exclu** (§ 1 n° 3) |
| Témoin du coffre | `components/TemoinCoffre.astro` | Le coffre est ouvert | — | aucune | en-tête | local | non | **non** : c'est un état, pas un signal (prompt 35) |

## Ce que l'inventaire ajoute au § 2.2, et pourquoi

Quatre lignes ne figuraient pas au tableau de départ.

1. **Le témoin du coffre**, écarté. Le prompt 35 dit « aucun signal
   nouveau », et un témoin d'état permanent n'est pas une notification :
   il ne dit pas qu'il s'est passé quelque chose, il dit où l'on en est.
   Le faire entrer au centre produirait un élément qui ne se range jamais
   et ne se résout jamais.
2. **Les ressources de détresse**, séparées des alertes molécules. Le
   § 2.2 les mentionne au détour du § 1 n° 7 ; elles méritent leur ligne
   parce que leur déclencheur et leur écran diffèrent.
3. **`veille-du-rythme` et `apprentissage-etendu` sont muets**, et le code
   le garde désormais par un champ obligatoire (`peutNotifier`), non par
   un commentaire. C'est l'anomalie A-17.
4. **`rappel-de-sauvegarde` n'a pas de sensibilité**, et c'est la seule
   source dans ce cas. C'est ce qui en ferait la candidate naturelle d'une
   liste de sources à texte détaillé — liste que la décision 3 garde
   **vide**, et le registre le dit plutôt que de le laisser deviner.

## Ce qui n'est pas branché, et ce que cela coûte

Sept sources sur douze attendent leur alimentation — la phase 3 en a
branché trois de plus : la sauvegarde, les revues manquées et les
occurrences en retard, choisies parce que leur producteur est pur et leur
signal sans contenu. Tant que les autres ne sont pas branchées, **elles
continuent de s'afficher là où elles sont aujourd'hui** : rien n'est
perdu, rien n'est silencieux. Le centre est un
lieu supplémentaire, pas un remplacement — sauf pour la veille du rythme,
dont le § 2.2 dit que l'entrée du centre **est** le rappel discret unique,
et qui sera donc un déplacement et non un ajout.

## Ce que la phase 3 apprend sur les lieux d'alimentation

Une source n'est pas branchée « quelque part » : elle est branchée **là
où son signal se calcule déjà**. Les trois de cette phase le montrent.

- Le rappel de sauvegarde se calcule au Corps et à la Psyché, et c'est de
  là qu'il entre. Le recalculer dans le centre aurait fait deux lectures,
  et un jour deux réponses différentes.
- Les revues manquées et les occurrences en retard viennent toutes deux
  d'`etatDuJour`, qui les connaissait déjà — à une nuance près : la
  fenêtre des occurrences a dû passer du seul jour aux sept jours de la
  roue, parce qu'une occurrence d'aujourd'hui n'est jamais en retard et
  qu'un tableau de bord qui ne lisait qu'aujourd'hui n'en aurait jamais
  trouvé aucune.

La conséquence se dit franchement : **le centre apprend quand l'écran
d'origine est ouvert**, pas avant. C'est un délai, pas une perte — le
signal reste affiché là où il l'était —, et c'est le prix de n'avoir
qu'un seul endroit qui décide, par source, s'il y a quelque chose à dire.
