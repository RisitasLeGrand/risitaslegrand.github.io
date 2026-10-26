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
| `avis-de-fusion` | `sync/veille.ts` → `surFusion` | Une fusion automatique qui a apporté quelque chose | une par lot (`marque`), et le plafond de cinq par jour depuis 0.8 | le **nombre** d'opérations trahissait une saisie (décision 5) | le centre, groupe « Synchronisation », qui mène à `/appareils/` ; notification du système seulement si la source est activée et la page non regardée (0.8) | la fusion est locale, l'avis aussi | non | **oui** — branchée, phase 2 |
| `proposition` | `adaptation.ts` → `propositionLocale()` | Un écart d'usage observé, avec consentement | **une par semaine**, toutes catégories (§ 1 n° 6) | le domaine de l'écart | `/profil/` | le refus voyage par le journal | non | **oui** — branchée, phase 4 |
| `avertissement-avant-analyse` | `noyau/avertissements.ts` → `avertissement()` | Un export d'IA qui touche corps, psyché ou finances | un par export | le domaine visé | `/exporter-ia/` | local au geste | non | **oui** — branchée, phase 4 |
| `rappel-de-prise` | **—** : `prisesDuJour()` est un **constat**, pas un producteur (correction de ma part) | Une prise déclarée non pointée — mais rien ne sait ce qui était *prévu* : la posologie est du texte libre, et la décision 12 pose « sans schéma ni rappel » | la cadence des prises | **la molécule**, et par elle le traitement | `/odyssee/sante/` | sous coffre, donc local à l'ouverture | non | **non — différé** (signé le 16 octobre : pas de rappel sans posologie structurée) |
| `veille-du-rythme` | `odyssee/veille.astro` et son moteur | Le « rappel discret » unique de 5.1 du 27 | la cadence de 5.6 du 27 | le rythme de vie | hors de Psyché, titre neutre | sous coffre | non | **oui** — branchée, phase 5, **et muette** (le 27) |
| `rappel-de-sauvegarde` | `noyau/coffre.ts` ligne 604 → condition bloquante | Une donnée scellée existe et la sauvegarde est ancienne | aucun ; il se renforce | **aucune** : ne porte sur aucune donnée | `/stockage/` | l'état de sauvegarde est local | non | **oui** — branchée, phase 3 |
| `revue-manquee` | `odyssee-jour.ts` → `rappelDeRevue(revuesManquees(...))` | Une revue du soir non tenue | groupé en « N revues » | le fait d'avoir une revue, pas son contenu | liste d'Odyssée et accueil | sous coffre | non | **oui** — branchée, phase 3 (prompt 36) |
| `occurrence-manquee` | `odyssee/occurrences-lues.ts` → `enRetard()` | Une occurrence de série dépassée | **une fois, jamais accumulée** (prompt 38) | la tâche | `/odyssee/calendrier/` | les pointages voyagent | non | **oui** — branchée, phase 3 |
| `pointage-a-reporter` | `odyssee/modele.ts` — pointages retenus coffre fermé | Un geste fait coffre fermé | un compteur, pas une liste | **le contenu est chiffré** : seul le nombre sort | **aucun** : `combienDeReports` et `rejouerLesReports` ne sont appelés par aucun écran (correction de ma part) | local tant que le coffre est fermé | non | **non — manque nommé** (phase 5) |
| `apprentissage-etendu` | `consentement-apprentissage.ts` | Le consentement n'a jamais été demandé | un, J.5 du 25 | le fait qu'on observe | `/profil/` | le consentement voyage | non | **oui** — branchée, phase 4, **et muette** (le 25) |
| `trajectoire` | `odyssee/trajectoires.ts` | Une trajectoire atteinte ou abandonnée | `PLAFOND_ACTIVES = 3` | l'objectif suivi | `/syntheses/` | sous coffre | non | **oui** — branchée, phase 5 |
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

**Aucune source n'attend plus son alimentation, et deux ne l'auront
pas.** La phase 3 en a
branché trois — sauvegarde, revues manquées, occurrences en retard —,
choisies parce que leur producteur est pur et leur signal sans contenu ;
la phase 4 trois autres — proposition, avertissement avant analyse,
apprentissage étendu —, qui ne touchent aucun magasin scellé pour décider
et dont la référence est toujours un **identifiant de mécanisme** : une
règle, une analyse, un état. La phase 5 en branche deux sous coffre —
trajectoires closes et veille du rythme — et **en déclare deux
impossibles**, `rappel-de-prise` et `pointage-a-reporter`, pour des
raisons qui ne sont pas techniques et qui sont dites plus bas. Celles-là
continuent de s'afficher là où elles sont aujourd'hui, quand elles le
sont : rien n'est perdu, rien n'est silencieux. Le centre est un
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

## Ce que la phase 4 ajoute : une référence qui ne dit rien

Les trois sources de cette phase ont en commun d'avoir un objet
sensible et une référence qui ne l'est pas.

- Une proposition d'adaptation porte une **valeur** — une heure de
  coucher, une durée de séance. La référence ne prend que l'identifiant
  de la règle, qui est un mécanisme et non une donnée de vie.
- Un avertissement avant analyse porte un **domaine** — corps, psyché,
  finances —, et c'est ce que la colonne « sensibilité » note. La
  référence ne prend que l'identifiant de l'analyse ; lequel de ses
  conseils demande un avis professionnel est l'affaire de l'écran.
- La demande de consentement ne porte rien, mais elle est **muette** au
  système : l'interdiction du prompt 25 vit dans `sources.ts`, et le
  contrôle de l'alimentation l'éprouve là où la source est branchée.

Une règle s'en dégage, et elle vaudra pour les quatre sources scellées :
**la référence nomme l'objet, jamais ce qu'il contient.**

## La phase 5, et deux colonnes que j'avais mal remplies

Deux sources ne seront pas branchées, et la raison tient dans ce que
l'inventaire disait d'elles — mal.

**`rappel-de-prise` — différé, et signé le 16 octobre.** Alexis a tranché :
« Accepter : pas de rappel de prise tant qu'il n'y a pas de posologie
structurée. » Cette réponse **précise et reporte** sa décision 3 du prompt
32, qui disait « rappels de prise oui, en libellé neutre » : le libellé
neutre reste la règle le jour où la source existera, et ce jour-là dépend
d'un modèle de posologie lisible par la machine, qui n'existe pas et que
je n'inventerai pas seul. La source reste donc non branchée, sans aucun
code nouveau. Ce n'est plus « impossible » : c'est **ajourné**, et la
condition de levée est nommée.

**Pourquoi j'avais écrit « impossible ».** J'avais mis `prisesDuJour()` en producteur. En le
lisant, ce n'en est pas un : son module déclare « aucune comparaison à
une posologie, aucune alerte d'oubli — le module ne sait pas ce qui était
prévu, et c'est délibéré ». La posologie d'un traitement est du **texte
libre**, et la décision 12 pose qu'une prise est « isolée, sans schéma ni
rappel ». Brancher cette source demanderait d'inventer un modèle de
posologie, c'est-à-dire de décider pour quelqu'un quand il a oublié un
médicament. La colonne passe à `—`, qui est la convention de cet
inventaire pour « décrit dans un prompt, absent du code ».

**`pointage-a-reporter`.** J'avais mis `/odyssee/` en affichage. Rien ne
l'affiche : `combienDeReports` et `rejouerLesReports` ne sont appelés par
aucun écran. Et surtout, ce signal existe **exactement quand le coffre
est fermé**, alors que le centre n'écrit rien dans cet état et que le
§ 3.2 lui interdit d'afficher le moindre nombre. La source et le lieu
sont incompatibles par construction.

Les deux sont déclarées dans `SOURCES_NON_BRANCHEES`, et un contrôle
tient la liste dans les deux sens — comme pour les règles de désaccord.

**Une anomalie trouvée en chemin, A-19.** Une source dont la condition est
permanente ressuscite ses éléments : la rétention supprime, le
recensement suivant redépose, et un élément rangé il y a six mois
reparaît comme neuf. Les trois sources de la phase 3 n'avaient pas le
défaut — leur condition s'éteint —, ce qui me l'avait caché. Les
trajectoires closes et les analyses conservées l'avaient : elles sortent
désormais du centre au bout de trente jours, **par leur source**, qui est
la seule sortie définitive.
