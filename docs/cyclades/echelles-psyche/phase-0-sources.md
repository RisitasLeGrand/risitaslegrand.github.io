# Échelles de la psyché — phase 0 : registre de sources et plan

**État au 13 octobre 2026.** Aucune échelle n'est intégrée. Aucune ligne de code
n'a été écrite pour ce chantier : la section 8 du prompt l'interdit avant
validation, et la section 2 l'interdit de toute façon tant que la condition 1
n'est pas remplie.

---

## 1. Ce que j'ai pu atteindre, et ce qui m'a été refusé

L'environnement d'exécution de Cyclades est un conteneur dont les sorties HTTPS
passent par une passerelle à liste blanche. **Les trois sources officielles en
sont absentes.** Chaque hôte a été essayé directement, le 13 octobre 2026 :

| Hôte | Ce que j'y cherchais | Résultat |
|---|---|---|
| `cdn.who.int` | Le PDF « Indice (en cinq points) de bien-être de l'OMS » | `CONNECT tunnel failed, response 403` |
| `www.who.int` | La page de droits (`/copyright`) et la fiche du WHO-5 | `403` |
| `iris.who.int`, `apps.who.int` | Les dépôts documentaires de l'OMS | `403` |
| `www.phqscreeners.com` | Les textes français du PHQ-9 et du GAD-7 | `403` |
| `www.inspq.qc.ca` | La fiche secondaire (pour mémoire, non utilisable) | `403` |

Le refus vient de la passerelle, pas des sites : `github.com` répond
normalement depuis le même conteneur, à la même seconde. Ce n'est donc ni une
panne, ni un blocage anti-robot — c'est la politique réseau de l'environnement.

**Ce que je n'ai pas fait, et pourquoi.** Une recherche web m'a renvoyé un
résumé du PDF français de l'OMS, rédigé par un moteur de recherche à partir du
document. Il affirme notamment que la traduction précède l'acquisition des
droits par l'OMS en 2024 et qu'elle a d'abord été publiée par le Psychiatric
Centre North Zealand. C'est **crédible et inutilisable** : la section 3.2 du
prompt dit « ne reconstitue rien de mémoire et ne copie pas depuis un site
tiers ». Un résumé de moteur de recherche est une copie tierce, et un texte
d'échelle recopié à un mot près n'est plus l'échelle. Je ne l'ai donc pas
transcrit, et je ne m'en sers pas pour trancher.

## 2. Décision d'intégration, échelle par échelle

La section 2 du prompt pose quatre conditions cumulatives. La première —
« texte français officiel retrouvé **à la source** » — échoue pour les trois.
Les trois autres ne se posent donc pas encore.

| Échelle | Condition 1 (texte à la source) | Verdict |
|---|---|---|
| **WHO-5** | Non : `cdn.who.int` refusé | **Non intégrée** |
| **PHQ-9** | Non : `phqscreeners.com` refusé | **Non intégrée** |
| **GAD-7** | Non : `phqscreeners.com` refusé | **Non intégrée** |

Conséquence immédiate, conforme à la section 2 : **le check-in rapide suffit**,
et il est en place depuis la phase 7 d'Odyssée (quatre glissières de 0 à 10,
point de semaine, journal libre, écart à une ligne de base personnelle). Rien
n'est en attente côté produit ; ce chantier ajoute, il ne débloque pas.

## 3. Ce dont j'ai besoin de toi

Deux voies, au choix.

**A. Tu me transmets les fichiers** (le plus simple). Trois PDF, tels que
téléchargés depuis la source, sans retraitement :
1. le WHO-5 français hébergé par l'OMS (`cdn.who.int`, « Indice (en cinq
   points) de bien-être de l'OMS ») ;
2. le PHQ-9 français depuis `phqscreeners.com`, **variante « France »** si elle
   existe — sinon dis-moi laquelle tu as prise (décision 5) ;
3. le GAD-7 français, même source, même réserve.

Et, pour les mentions, une capture ou un copier-coller de ce qui est écrit sur
la page de téléchargement elle-même : c'est là que vit l'énoncé de licence, pas
toujours dans le PDF.

**B. Tu ouvres la passerelle** à `cdn.who.int`, `www.who.int` et
`www.phqscreeners.com`. Dans les réglages de l'environnement cloud (menu de
l'environnement dans la barre de titre de la session, puis **Edit**), sous
**Network access** : soit un niveau d'accès plus large, soit ces trois hôtes
ajoutés sous **Allowed domains**, la case des gestionnaires de paquets laissée
cochée. La marche à suivre est à
<https://code.claude.com/docs/en/cloud-environments#network-access>. J'irai
alors lire les sources moi-même, ce qui est ce que la section 2 demande.

La voie A est plus sûre pour la condition 2 : la mention de licence est souvent
sur la page, et tu la verras mieux que moi.

## 4. Mes réponses aux sept décisions de la section 9

Elles sont **conditionnelles** : elles ne s'appliquent que si une échelle
franchit la section 2.

1. **Quelles échelles, laquelle par défaut.** D'accord avec ta préférence :
   WHO-5 proposé au premier check-in approfondi, activable en un geste ; PHQ-9
   et GAD-7 jamais proposés spontanément, activables depuis un écran qui
   explique ce qu'ils mesurent et prévient que le PHQ-9 contient une question
   sur les pensées de mort. **Une nuance** : je ne les mettrais pas sur le même
   plan que les « chapitres sensibles facultatifs » de l'initialisation, qui
   s'activent en cochant. Ces deux-là passeraient par un écran dédié, lu avant
   d'activer.
2. **Cadence.** Quatorze jours, comme tu le proposes, et pour la raison que tu
   donnes : la période de rappel est de quatorze jours, donc une passation
   hebdomadaire mesurerait deux fois les mêmes jours. Réglable vers le plus
   espacé, **jamais vers le plus resserré** — et c'est une borne dans le code,
   pas un conseil dans un texte.
3. **Repères de la source.** Panneau d'information neutre, replié par défaut,
   avec la citation exacte, sa source et sa date. Formulé comme une raison d'en
   parler. **Condition** : le repère doit venir du texte officiel. Si je ne
   trouve le seuil « inférieur à 50 » que dans une fiche tierce, le panneau
   n'existe pas.
4. **Item sur les pensées de mort.** D'accord sur l'exclusion totale, y compris
   sous « tout voir ». J'ajoute une garde : l'exclusion doit être **vérifiable
   par un test qui lit les données exportées**, pas seulement une branche
   d'affichage — c'est la même règle que pour le journal, dont la projection ne
   publie que la longueur. Sur le texte du message, je te le soumettrai à
   l'adresse du site (Cyclades vouvoie) ; ton brouillon tutoie, et il faudra
   choisir l'un ou l'autre partout.
5. **Variante de français.** Sans réponse de ma part tant que je n'ai pas vu la
   liste des variantes offertes. Je ne choisirai pas seul, comme tu le demandes.
6. **Licence de la traduction du WHO-5.** Ta recommandation (intégrer avec
   mentions, consigner le point) me paraît raisonnable **pour un usage
   personnel**, mais je signale ce qu'elle suppose : que l'absence d'énoncé de
   licence sur la traduction vaille silence, et non réserve. Le dépôt est
   public. Je propose donc un intermédiaire : intégrer, consigner, **et**
   écrire à l'OMS en parallèle — la réponse, quand elle vient, soit confirme,
   soit fait sortir l'échelle. Rien n'attend la réponse.
7. **Références de validation.** D'accord, sans réserve : aucune référence
   affichée sans avoir lu l'étude. Pour le GAD-7, je n'ai pas lu
   Micoulaud-Franchi et coll. (2016) et je n'y ai pas accès ; la ligne affichée
   sera donc « Version française : validation formelle non confirmée », sans
   citation.

## 5. Le plan, si tu valides

Chaque phase est livrée testée, comme les précédentes.

| Phase | Contenu | Condition d'entrée |
|---|---|---|
| **0** | Ce document. Registre, verdict, décisions. | — |
| **1** | Un fichier de données par échelle retenue (identifiant, version, langue et variante, consigne, période de rappel, items mot pour mot, options et valeurs, règle de calcul, source, date de consultation, licence, mention exigée, statut de validation). Empreinte du texte vérifiée par un test. Calcul des scores. `NOTICE` à la racine. | Les fichiers officiels en main |
| **2** | Passation (une question à la fois sur téléphone avec progression, liste complète sur ordinateur), brouillon repris après interruption, « Préfère ne pas répondre » et « Plus tard » sur l'échelle entière, aucun score partiel. Résultats, courbe avec alternative textuelle, écran « À propos de ces échelles ». Cadence et effacement. | Phase 1 |
| **3** | Message de détresse déclenché par toute réponse non nulle à l'item du PHQ-9, **avant** le score. Exclusion de cet item des exports, de « Demander à l'IA », du moteur d'apprentissage et des courbes. Accès permanent « Besoin d'en parler ? ». | Phase 2, et seulement si le PHQ-9 est retenu |

**Ce que les tests devront prouver**, au-delà des vecteurs de score que tu
listes : que l'exclusion de l'item sensible tient *dans les données produites*
et non dans l'écran, et qu'aucune chaîne d'étiquette de gravité n'existe dans
l'interface. Ce second contrôle est déjà écrit et tourne : `controlerPsyche()`
refuse « léger », « modéré », « sévère », « dépression », « diagnostic » et
quinze autres formes, accents retirés, dans tous les textes du module. Il
couvrira les écrans d'échelles sans modification.

## 6. Ce que je n'ai pas pu vérifier

Tout, à la source. Nommément :

- le texte français du WHO-5, sa mention de licence, et la licence propre à la
  traduction (non énoncée d'après ta vérification) ;
- la page de droits de l'OMS, et donc la portée exacte de CC BY-NC-SA 3.0 IGO
  pour un dépôt public personnel ;
- la page de droit d'auteur du centre danois ;
- les textes français du PHQ-9 et du GAD-7, les variantes offertes, et le pied
  de page « aucune autorisation n'est nécessaire » **sur la source officielle**
  plutôt que sur des copies ;
- l'étude de Micoulaud-Franchi et coll. (2016), et donc toute affirmation de
  validation française.

Ce qui se tient dans ta section 1 reste ta vérification, pas la mienne : je ne
la reprends pas à mon compte, et je ne l'ai pas utilisée pour décider.
