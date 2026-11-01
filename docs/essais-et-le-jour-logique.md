# Les essais de navigateur et le jour logique

Réponse mesurée à la question : **lesquels des essais qui emploient une date
calendaire rougissent entre minuit et 4 h du matin ?**

Mesuré le 1er novembre 2026 sur `main` (908032c) augmenté de
`claude/tri-jour-logique`, site construit et servi par `astro preview`.

## La règle

Les écrans d'Odyssée — l'agenda, le calendrier, les tâches, la revue —
emploient le **jour logique** (`src/lib/noyau/jour-logique.ts`), qui bascule à
4 h heure de Paris : une soirée qui se prolonge appartient à la journée
commencée la veille, et c'est délibéré.

**Mais pas tous les écrans.** `src/lib/db.ts` expose un `jourISO()` qui est la
date **calendaire locale**, et plusieurs écrans l'emploient — le compte à
rebours des épreuves, par exemple, lit `jourISO()` et non le jour logique.

Le critère pour un essai n'est donc pas « le jour logique est plus juste », mais
**ce que l'écran mesuré emploie**. Un essai qui compare une date calendaire à un
écran qui emploie le jour logique est vert le jour et rouge la nuit ; un essai
qui compare une date calendaire à un écran qui emploie la date calendaire est
juste, et l'ancrer sur le jour logique le casserait.

## L'outil

    node --import scripts/lib/horloge-de-nuit.mjs scripts/essais-<nom>.mjs

Il place **Node et le navigateur** à 1 h 30 du matin, heure de Paris. La nuit
réelle ne décale rien entre les deux : à 1 h 30, les deux horloges sont à la
même heure, et seul diverge le jour logique. Déplacer les deux ensemble
reproduit donc la nuit telle qu'elle est.

`npm run essais:horloge-de-nuit` garde l'outil lui-même, et c'est nécessaire :
un outil de mesure dont la panne est silencieuse rend des verts qui ne prouvent
rien.

### Trois outils faux avant celui-là

Chacun a rendu des verdicts que j'ai failli livrer.

1. **Le signe à l'envers.** Le premier reculait l'horloge de Node. Or la nuit,
   c'est l'ÉCRAN qui est en retard — le jour logique vaut encore la veille —,
   donc Node est en avance. Il simulait une situation qui n'arrive jamais, et
   rendait « indépendant de l'heure » pour des essais qu'il n'avait pas
   éprouvés.
2. **Une perturbation de trop.** Corrigé de signe, il décalait Node SEUL d'un
   jour : le jour divergeait (le défaut cherché), mais les horodatages écrits
   par Node passaient dans le futur du navigateur (ce qui n'arrive jamais).
   `essais-faits-domaine` rendait ainsi deux croix sur son écran de conflit —
   « les deux versions sont résumées », « la plus récente s'affiche » — qui ne
   tenaient qu'à des enregistrements datés de demain. Un faux positif, qui
   allait faire corriger un défaut inexistant.
3. **Le silence.** Le troisième posait le script d'initialisation du navigateur
   sans l'attendre et avalait ses erreurs. Les verts qu'il rendait ne prouvaient
   rien : le navigateur pouvait être resté à l'heure réelle. D'où la garde.

## Le classement des douze

| essai | de jour | à 1 h 30 | verdict |
| --- | --- | --- | --- |
| `adaptation:navigateur` | vert | vert | tient la nuit |
| `compte-a-rebours:navigateur` | vert | vert | tient la nuit |
| `etiquettes:navigateur` | vert | vert | tient la nuit |
| `faits-domaine` | vert | vert | tient la nuit |
| `habitude:navigateur` | vert | vert | tient la nuit |
| `indicateurs:navigateur` | vert | vert | tient la nuit |
| `initialisation:navigateur` | vert | vert | tient la nuit |
| `odyssee:navigateur` | vert | vert | tient la nuit |
| `pastille:navigateur` | vert | vert | tient la nuit |
| `suivi:navigateur` | vert | vert | tient la nuit |
| `rejeu:navigateur` | **1 croix** | 1 croix | rouge de jour, pour une autre cause — corrigé ici |
| `parcours-planifiables:navigateur` | *non mesurable ici* | — | essai de laboratoire |

**Aucun des douze ne rougit la nuit.** Les quatre qui le faisaient —
`calendrier-occurrences`, `taches-parcours`, `phase6-ecrans`,
`branche-vers-tache` — sont ceux que `claude/tri-jour-logique` a déjà ancrés, et
ils ne sont pas dans cette liste.

### Les deux cas à part

**`parcours-planifiables:navigateur` n'est pas mesurable dans l'arbre
principal.** C'est un essai de **laboratoire** : la batterie lui donne un arbre
à lui (voir la liste commentée de `scripts/batterie.mjs`), parce qu'il plante
des fiches sous `dgfip-b/`, `dgfip-a/`, `dgfip-ap/` et `commun/`, construit,
puis efface. Lancé dans l'arbre principal, il REFUSE de travailler par-dessus du
contenu réel — « content, .env.local, public/data […] existe déjà » — et rend
une croix qui n'apprend rien sur les dates. Le mesurer demanderait de le lancer
dans son laboratoire, ce que seule la batterie fait.

**`rejeu:navigateur` était rouge de jour, et son essai avait tort.** Son motif
exigeait le pluriel — `gardés, pas effacés` — alors que la ligne au-dessus
vérifie que la mention compte « 1 ». Depuis que l'accord passe par
`noyau/accords.ts` (lot 9), l'écran dit justement au singulier « Il est gardé,
pas effacé ». Le motif accepte maintenant les deux nombres ; éprouvé par
sabotage (l'écran mis à dire « Il est supprimé, bel et bien supprimé » rend bien
la croix). Cet essai n'est PAS dans la batterie : son rouge n'était vu de
personne.

## Ce qu'on ne mesure pas ici

L'outil fait diverger le jour logique de la date calendaire. Il ne dit rien :

- d'un essai dont l'assertion est plus grossière qu'un jour — `compte-a-rebours`
  parle en semaines, et 150 jours font 21,4 semaines : un jour de plus ou de
  moins ne change pas l'arrondi, sauf à tomber sur la frontière. Un tel essai
  peut être juste sans être robuste ;
- des deux autres bascules du jour logique, le passage à l'heure d'été et celui
  à l'heure d'hiver. `essais:jour-logique` les garde, du côté de la règle.

## Pour un essai à venir

Avant d'employer une date dans un essai de navigateur, lire **quel
« aujourd'hui » l'écran mesuré emploie** :

- l'écran appelle le jour logique → l'essai doit employer
  `jourLogiqueDEssai()` de `scripts/lib/jour-logique-essais.mjs` ;
- l'écran appelle `jourISO()` de `db.ts` → l'essai doit employer la date
  calendaire, et l'ancrer sur le jour logique le casserait la nuit.

Dans le doute, le mesurer : `node --import scripts/lib/horloge-de-nuit.mjs`
coûte un tour.
