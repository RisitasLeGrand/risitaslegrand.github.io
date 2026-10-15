# Prompt 32 — les plafonds, et ce qu'ils valent entre deux appareils

J'avais signalé au plan, sans l'instruire, que « au plus une proposition
par semaine » est un **plafond réparti** : deux appareils hors ligne
peuvent chacun le croire libre. Voici le constat fait, source par source,
et ce que j'en conclus pour le centre.

## 1. Où vit l'état de chaque plafond — constaté dans le code

| Source | Plafond | État lu | Converge après fusion ? |
|---|---|---|---|
| 3 Proposition d'adaptation | 7 jours entre deux | journal des opérations, type `profil.adaptation` | oui |
| 5 Proposition de modulation | 21 jours par refus | `localStorage` (`sport/refus-locaux.ts`) | **non, délibérément** |
| 6 Veille du rythme | `SILENCE_APRES` par réponse | magasin de veille, journalisé | oui |
| 8 Revue manquée | 7 jours, un seul rappel pour N jours | jours tenus, journalisés | oui |
| 10 Apprentissage étendu | 3 mois, **dans l'application seulement** | réglages, journalisés | oui, et jamais en notification |

## 2. La source 5 est locale par décision, pas par oubli

`refus-locaux.ts` l'écrit noir sur blanc : un magasin journalisé « aurait
rendu l'inverse » de ce qu'on cherche, parce qu'il **garderait la trace
d'un refus** — dans la synchronisation, dans la sauvegarde, dans l'export.
Le prix accepté est connu : deux appareils peuvent proposer la même
modulation. Ce n'est pas une anomalie, c'est un arbitrage déjà rendu.

## 3. Le vrai trou, et il n'est pas celui que j'annonçais

Pour la source 3, le plafond se mesure sur les **décisions**, pas sur les
**affichages** : `lireDecisions()` ne retient que les opérations de type
`profil.adaptation`, et **montrer une proposition n'écrit rien**. Deux
appareils hors ligne la même semaine en montrent donc chacun une, sans que
le plafond s'oppose à rien — et si les deux sont répondues, deux décisions
atterrissent dans le journal pour la même semaine.

Le même raisonnement vaut pour 6, 8 et 10, avec une nuance : leur état
*est* journalisé, donc après fusion ils convergent. Mais la fusion arrive
**après** l'affichage. Autrement dit :

> Aucun plafond de Cyclades n'est réparti. Tous sont **plafonnés à terme**,
> et la fenêtre de dépassement vaut exactement le délai entre deux
> synchronisations.

C'est une propriété structurelle du choix « journal répliqué, pas de
serveur », qui est le choix du projet. Elle ne se corrige pas, elle se
borne.

## 4. Ce que j'en fais pour le centre, et ce que je ne touche pas

**Ce que je décide** (rien ici ne touche une donnée réelle, le format ni le
chiffrement — § 4.2) : le plafond quotidien de notifications système de la
phase 6 sera **par appareil et par jour**, et il sera écrit comme tel. La
raison est l'honnêteté : un plafond annoncé « global » que la mécanique ne
peut pas tenir est pire qu'un plafond modeste et tenu. Une personne
n'utilise qu'un appareil à la fois ; le pire cas est donc le plafond
multiplié par le nombre d'appareils réveillés le même jour, ce qui reste
borné et dicible.

**Ce que je ne change pas**, et que je signale plutôt que de l'emporter
dans ce prompt :

- resserrer le plafond de la source 3 demanderait de **journaliser
  l'affichage** d'une proposition, donc un type d'opération nouveau. C'est
  une modification du journal, hors du périmètre du prompt 32 ;
- la source 5 reste locale, conformément à son arbitrage ;
- rien n'est touché dans 6, 8 et 10.

## 5. Honnêteté sur la méthode

Constaté en ouvrant les cinq modules : `adaptation.ts` (lignes 85–140 et
415–443), `sport/modulation.ts` et `sport/refus-locaux.ts`,
`odyssee/signal-veille.ts` (`decider`), `odyssee/moment-revue.ts`,
`odyssee/consentement.ts` (`RAPPEL`). La ligne « montrer n'écrit rien » est
vérifiée par l'absence de tout type d'opération autre que
`profil.adaptation` et `profil.champ` dans `adaptation.ts` — et cette fois
j'ai ouvert le fichier, je ne l'ai pas conclu d'un `grep` sur un mot.
