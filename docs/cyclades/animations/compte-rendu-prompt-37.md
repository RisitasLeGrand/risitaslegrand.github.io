# Prompt 37 — compte rendu

*15 octobre 2026. Lot de rectification demandé après l'audit du 14 octobre.*

## Ce qui a été fait

Les quinze corrections A1 à A15 sont livrées, plus la décision 1 — le retrait
de la forme complète du schéma du corps. Sept commits, A1 en premier comme
demandé, séparés par nature sauf un (A7 et la décision 1 touchent le même
balisage : les séparer imposait un commit intermédiaire qui ne construit pas).

| n° | Mesure avant → après | Essai qui le garde |
|---|---|---|
| A1 | CLS 0,608 → 0,211 (bibliothèque) ; 0,615 → 0,170 (recherche) | `essais:decalage` |
| A2 | jauge à 0,800 dès 60 ms → 0,345 à 60 ms | `essais:jauges` (F) |
| A3 | barre large de 0 px → mécanisme partagé, visible à 60 % | `essais:jauges` (A bis) |
| A4 | fond de dialogue ~190 ms → 0,01 ms, par les deux réglages | `essais:mouvement-reduit` (E) |
| A5 | 1 tâche close sur 2 → 2 sur 2, à 40, 100 et 200 ms | `essais:taches-gestes` |
| A6 | un réglage lu sur deux → les deux | `essais:mouvement-reduit` (E bis) |
| A7 | bouton figé sur « Interrompre » → restitution ; suite d'images 2,2,2,**0,0**,1 ; schéma 462→654 dans une boîte jusqu'à 806 | `essais:muscles` |
| A8 | 0,3 s → 0,2 s ; fondu final 0,35 s → 0,2 s | `essais:finitions` |
| A9 | `all` (dont l'épaisseur de bordure) → `box-shadow, border-color` | `essais:finitions` |
| A10 | deux `transition: all` → propriétés nommées, jetons | `essais:finitions` |
| A11 | lien 0,15 s / bouton sans fondu → les deux à 0,12 s, même courbe | `essais:finitions` |
| A12 | cadre dédoublé → groupes nommés, hors des pages sous coffre | `essais:cadre` |
| A13 | chevron 0,15 → 0,12 s ; dépliant 0,12 → 0,2 s ; `.jauge` retirée ; `--duree-succes` marquée réservée | `essais:finitions` |
| A14 | bulle à 828 pour une barre à 787 → 764 | `essais:finitions` |
| A15 | région `aria-live` recréée → fixe (**structure seulement**) | — |
| D1 | forme complète du corps, sélecteur, 44 `data-complete` → retirés | `essais:muscles` |

Six essais nouveaux (`essais:decalage`, `essais:taches-gestes`, `essais:cadre`,
`essais:muscles`, `essais:finitions`) et trois sections ajoutées à des essais
existants. **Chacun a été éprouvé rouge avant d'être déclaré vert.**

## Ce qui n'est pas flatteur, et qu'il faut lire

### Quatre instruments faux, tous de moi

1. **L'attente en aveugle.** Le premier essai de CLS attendait 4 000 ms : sur
   un serveur fraîchement démarré, le contenu n'était pas rendu, la mesure
   donnait 0,003 et paraissait excellente. Elle regardait trop tôt.
2. **Une bissection sans valeur.** L'arbre de travail était construit avec
   `npx astro build` au lieu de `npm run build`, donc sans l'étape de contenu :
   `dist/data/recherche.json` absent, 7,3 Mo au lieu de 463. Trois mesures
   regardaient une page de recherche **vide**.
3. **Un défilement doux pris pour instantané.** Mes sondes lisaient la position
   d'un bouton juste après `scrollIntoView` : le défilement n'avait pas eu
   lieu, le bouton était relevé sous la barre d'onglets, et le « clic sur le
   bouton » atteignait la barre et changeait de page.
4. **Deux contrôles qui ne contrôlaient rien.** Celui d'A10 dénonçait mes
   propres commentaires ; celui d'A14 écrivait lui-même dans la page la classe
   corrigée, puis mesurait son propre texte — il passait vert sur la version
   fautive pendant que onze autres échouaient.

Et une piste de correction abandonnée après mesure : `skipTransition()` au
`pointerdown`, que le prompt proposait en premier pour A5. Écrite, construite,
mesurée : l'appui restait perdu. Le test d'impact a déjà eu lieu quand le
gestionnaire s'exécute.

### Deux plafonds de CLS relevés, et pourquoi

Je ne reproduis pas deux chiffres du rapport : `/bibliotheque/` mesure 0,211
ici contre 0,018 annoncés, `/recherche/` 0,170 contre 0,098. L'écart vient
d'une course entre l'hydratation des contrôles et la première peinture, que le
bridage du processeur ×4 force vers le pire cas — sans bridage, la même page
rend 0,003 ou 0,211 d'un chargement à l'autre, avant comme après le lot.

Les plafonds retenus sont donc les valeurs **remesurées au commit d'avant le
lot**, les seules que ce contrôle puisse comparer à ce qu'il mesure lui-même.
Pour que le plafond relevé ne devienne pas aveugle, l'essai réinjecte le CSS
exact de la phase 5 et exige de le voir dépasser : 0,608 et 0,615 contre des
plafonds de 0,211 et 0,170.

### Une anomalie nouvelle, non corrigée (§4.2)

Le décalage résiduel de `/bibliotheque/` et `/recherche/` **n'est pas le texte
d'attente** : c'est la barre de filtres et ses deux listes déroulantes, qui
s'insèrent après la première peinture et poussent le pied de page. C'est
antérieur au lot. Je ne l'ai pas corrigé sous couvert d'A1 — il devient une
ligne du tableau suivant.

### Un invariant d'essai qui a changé par décision

`essais:chargements` exigeait que le texte d'attente disparaisse **en fondu**,
durée strictement positive. A1 a retiré ce fondu. Exiger encore le fondu
reviendrait à exiger le défaut : le contrôle demande désormais que la
disparition tienne dans le plafond, zéro compris, et c'est `essais:decalage`
qui mesure que la page ne décale plus.

## Ce qui n'est pas vérifié

- **A15** : la structure est corrigée, mais **aucun lecteur d'écran** n'a été
  essayé. Le prompt le classait déjà parmi les points non vérifiés.
- **Un vrai téléphone, Safari, Firefox** : rien de ce lot n'y a été vu.
- **Lighthouse** : non lancé.

## Captures

Huit, en données synthétiques, dans `audit/captures/prompt-37/` — dossier
ignoré par Git, parce qu'une capture montre l'état d'une base.

`a1-recherche-avant-le-fondu-reinjecte`, `a1-recherche-apres`,
`a2-jauge-en-cours-de-remplissage`, `a3-barre-appariement-visible`,
`a5-liste-pendant-le-glissement`, `a7-etape-1-allumee-et-schema-visible`,
`decision-1-schema-sans-la-forme-complete`, `a12-cadre-pendant-la-transition`.

L'« avant » d'A1 est **reconstitué** en réinjectant le CSS de la phase 5 sur le
build corrigé : le build fautif n'existe plus. C'est dit ici pour que personne
ne la prenne pour une archive.
