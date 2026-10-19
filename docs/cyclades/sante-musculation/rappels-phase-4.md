# Santé, phase 4 — ce qui marche, et ce qui n'est pas vérifié

*Compte rendu du prompt 52, écrit le 19 octobre 2026. Branche `claude/p52-mol`.*

Trois colonnes, et une seule règle pour les remplir : **constaté** veut dire
que je l'ai exécuté et vu dans ce conteneur ; **lu dans le code** veut dire
que je l'ai déduit d'une lecture sans l'exécuter ; **non vérifié** veut dire
que je n'ai pas pu, et je dis pourquoi.

Ce conteneur n'a ni téléphone, ni agenda, ni réseau sortant au-delà de
GitHub et des dépôts de paquets. Tout ce qui concerne un appareil réel est
donc non vérifié, et le restera jusqu'à ce que tu l'essaies toi-même.

## 1. Deux défauts antérieurs, sortis en construisant ce lot

*En tête à la demande du pilote : ils ne touchaient pas que Santé.*

1. **`ecrirePrise()` n'écrivait jamais `traitementId`.** Le champ existait au
   type depuis la phase 1 ; aucun chemin d'écriture ne le remplissait.
   `heuresDepuisLaDernierePrise()` filtre dessus, et rendait donc `null` pour
   tous les traitements, toujours : l'écran affichait « aucune prise
   enregistrée » sous chacun, y compris sous celui dont on venait de noter une
   prise. Corrigé en P2.
2. **L'écran des tâches ne lisait qu'un magasin d'exceptions sur deux.** Il
   appelait `occurrencesDuJour`, qui n'interroge que le magasin en clair,
   alors que toute tâche liée à une branche sous coffre range son exception
   dans le magasin scellé. Le pointage s'écrivait et ne se voyait jamais. Le
   défaut touchait déjà Psyché et Finances. Corrigé en P5.

## 2. Application ouverte

| | État | Comment je le sais |
|---|---|---|
| Le créneau prévu apparaît, avec son heure et sa quantité | **constaté** | `essais:sante:navigateur`, parcours complet depuis un carnet vierge |
| « Pris » note une prise à l'heure réelle | **constaté** | idem : l'écran affiche « Noté à 6 h 53 » pour une prise prévue à 8 h |
| « Pas aujourd'hui » ne laisse aucune marque négative | **constaté** | idem : ni mot de reproche, ni compteur, ni couleur d'échec |
| L'annulation de six secondes tient | **constaté** | idem : pendant le délai, la ligne annonce et n'offre aucun autre bouton |
| Le rappel d'oubli paraît après le délai, une fois | **constaté** | idem, avec un créneau posé trois heures plus tôt et un délai de trente minutes |
| Il dépose un élément au centre, et une réponse le retire | **constaté** | idem : le magasin `centreElements` est lu comme une extension le lirait |
| Pointer une tâche liée note une prise ; défaire la retire | **constaté** | idem, de bout en bout, en lisant le magasin des prises |

## 3. Application fermée — Android

| | État | Comment je le sais |
|---|---|---|
| L'agenda sonne à l'heure prévue | **non vérifié** | il faut un téléphone et un agenda ; le FICHIER, lui, est constaté valide (RRULE, VALARM, VTIMEZONE, TZID) |
| La notification de Cyclades part | **non vérifié** | elle demande que le navigateur réveille l'application, donc une application installée et *Periodic Background Sync* |
| Le rappel d'oubli part | **non — et pas seulement faute d'essai** | voir § 5 |

## 4. Application fermée — iPhone

| | État | Comment je le sais |
|---|---|---|
| L'agenda sonne à l'heure prévue | **non vérifié** | même raison qu'Android ; c'est la seule voie que le plan ait jamais annoncée pour iPhone (§ 5 n° 2) |
| La notification de Cyclades part | **non** | *Periodic Background Sync* n'existe pas sur iOS, et iOS impose WebKit à tous les navigateurs. L'écran le dit. **Lu dans le code et dans le tableau de compatibilité**, non mesuré sur un appareil |
| Le rappel d'oubli part | **non** | voir § 5 |

## 5. La limite du rappel d'oubli, qui est plus sévère que celle annoncée

Le prompt disait : « application fermée, le rappel d'oubli ne peut partir que
si le navigateur réveille l'application (Android, application installée) ».
C'est vrai et insuffisant, et je l'ai découvert en lisant le coffre plutôt
qu'en l'essayant.

La clé du coffre vit dans **`sessionStorage`** — décision 3.7 du plan,
option B, signée le 13 octobre. Elle meurt à la fermeture de l'onglet, et
**un *service worker* n'a accès à aucun stockage de session** : il ne dispose
que d'IndexedDB et du cache. Même réveillé, il ne pourrait donc lire ni le
schéma prévu ni les prises notées, qui sont tous deux scellés.

**Conclusion : le rappel d'oubli ne part que Cyclades ouvert et coffre
ouvert.** Ce n'est pas une lacune de ce lot, c'est le prix du chiffrement, et
le lever demanderait de ranger le schéma des prises en clair — c'est-à-dire
de rendre lisible, sans mot de passe, « tous les jours à 8 h pour ce
traitement ». Je ne l'ai pas fait et je ne le recommande pas.

L'écran du réglage dit cette limite en toutes lettres, et dit d'où elle
vient. L'agenda reste la seule voie qui sonne application fermée — et il ne
sait pas si la prise a été notée : il sonne à l'heure prévue, jamais « en cas
d'oubli ».

## 6. Ce que le fichier d'agenda contient, constaté

Lu dans le fichier réellement téléchargé par le navigateur, et non dans le
code qui l'écrit :

- `RRULE:FREQ=DAILY` pour un schéma quotidien, `FREQ=WEEKLY;BYDAY=MO,TH`
  pour des jours de semaine, avec `INTERVAL` et `UNTIL` quand il le faut ;
- `BEGIN:VALARM` avec `TRIGGER:PT0S` — l'alarme à l'heure même ;
- `DTSTART;TZID=Europe/Paris` et le bloc `VTIMEZONE` complet, avec les deux
  bascules de la règle européenne. **C'est ce qui empêche un rappel de 8 h de
  sonner à 9 h à partir du 25 octobre** ;
- `SUMMARY:Rappel Cyclades` par défaut : ni le nom du traitement, ni sa
  posologie, ni sa quantité, ni son prescripteur.

Un fuseau autre qu'Europe/Paris fait **refuser** l'export, avec son nom. Les
règles d'heure d'été se changent par décision politique ; en inventer
produirait des rappels faux d'une heure pendant six mois, et une heure fausse
ne se voit pas, là où un refus se lit.

## 7. Ce qui reste à trancher par la session principale

- **Un lien n'écrit rien sur une tâche sans répétition.** `pointerLaTache`
  clôt simplement une tâche unique, sans passer par la branche — vrai pour
  Sport et les quêtes comme pour Santé. Je ne l'ai pas étendu : le mécanisme
  des occurrences appartient au prompt 38, et le changer toucherait deux
  autres branches sans décision. L'écran dit désormais ce qu'il fait et ne
  fait pas, au lieu de se taire.
- **Le texte détaillé en notification du système.** Le prompt propose
  « Créatine : prévue à 8 h, rien n'est noté » en libellé explicite.
  `emission.ts` porte un libellé unique et constant, et la liste fermée des
  sources autorisées à en dire plus est **vide** (décision 3 du prompt 32).
  J'ai gardé cette décision : le texte explicite s'affiche à l'écran et dans
  l'agenda, jamais sur un écran verrouillé. À confirmer ou à renverser.
- **Les gestes « Pris » et « Pas aujourd'hui » dans le centre.** Le § 2.3 du
  prompt 32 veut un élément sans contenu, et la cloche est présente sur
  toutes les pages. Les deux boutons vivent donc sur l'écran Santé, où le
  centre mène en un appui. À confirmer ou à renverser.
