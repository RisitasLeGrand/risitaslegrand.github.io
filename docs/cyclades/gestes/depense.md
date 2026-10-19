# Geste quotidien — Pointer une dépense

**Mesuré le 2026-10-19, sur `/odyssee/rapprocher/`, avec des données synthétiques.**

> **Testé par l’auteur seul**, et par un script qu’il a écrit. Il faut en dire
> la portée exacte, sans quoi ces trois nombres se liraient pour ce qu’ils ne
> sont pas.
>
> Les **appuis** sont le chemin le plus court, pris par quelqu’un qui sait
> d’avance où appuyer — pas le chemin qu’on prend quand on cherche. C’est le
> nombre le plus solide des trois : il ne dépend ni de la machine ni de la
> personne.
>
> Les **secondes** mesurent la réponse de l’application à cette suite
> d’appuis, enchaînés par un script. Ce n’est donc **pas** le temps d’une
> personne : il n’y a ici ni hésitation, ni lecture, ni main qui se déplace.
> C’est un plancher, et il ne vaut que comparé à lui-même d’une version à
> l’autre.
>
> Les **retours en arrière** disent si le geste oblige à revenir sur ses pas.
> Zéro ne veut pas dire que personne ne revient : il veut dire que le chemin
> le plus court n’y oblige pas.

## Protocole

1. Prémisse, hors mesure : ouvrir le coffre et importer un relevé synthétique d’un mois — trois opérations inventées, solde qui boucle — par l’écran « Finances ».
2. Arriver sur « À rapprocher » par son adresse.
3. Appuyer sur le premier geste proposé sur la première ligne.
4. La mesure s’arrête quand la file s’est repeinte.

Rejouable : `SITE_PASSWORD=… npm run mesures:gestes`. Les chiffres ci-dessous
sont écrits par le script, jamais à la main.

## Mesure

| Ce qui est compté | Valeur |
|---|---|
| Appuis | 1 |
| Secondes | 1.1 |
| Retours en arrière | 0 |

La saisie au clavier n’est pas comptée comme un appui — elle compte dans les
secondes. Chaque appui passe par une seule fonction du script, de sorte qu’un
clic non compté ne puisse pas exister.
