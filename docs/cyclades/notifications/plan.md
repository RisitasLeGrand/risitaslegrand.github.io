# Prompt 32 — le centre de notifications : plan, inventaire, sensibilité

Écrit le 15 octobre 2026, après réception du prompt (20 941 octets,
empreinte `e169c234…d257c8cb`, recalculée et identique). **Aucun code n'est
écrit**, conformément au point d'arrêt : plan, maquettes, inventaire et
tableau de sensibilité d'abord.

## 0. Les cinq lectures du § 0.2 — confirmées, avec une précision

1. **Un panneau dans le site**, plus des notifications du système affichées
   seulement pendant qu'une page est ouverte. Confirmé.
2. **Pas de push, pas de réveil.** Confirmé, et j'ajoute la raison technique
   qui le rend structurel plutôt que choisi : `public/sw.js` n'affiche que
   sur message d'une page (`cyclades:avis`), et **il ne peut rien
   déchiffrer** — la clé du coffre ne vit qu'en mémoire d'onglet. Un service
   worker réveillé seul n'aurait donc littéralement rien à dire.
3. **Le centre n'invente aucun signal.** Confirmé.
4. **Le centre n'est pas un deuxième lieu de décision.** Confirmé.
5. **Le centre ne stocke pas de contenu.** Confirmé, et c'est la contrainte
   la plus structurante du lot : elle décide du modèle, du coffre, de la
   sauvegarde et de l'effacement d'un seul coup.

**La précision.** Le § 2.3 veut un `id` « dérivé de la source ». C'est la
même règle que les clés déterministes du prompt 38, et elle a la même
conséquence, qu'il faut écrire : **un identifiant dérivé est lisible**. Si
l'`id` d'un élément était `psyche/checkin/2026-10-12`, le magasin trahirait
en clair ce que son chiffrement protège. Le § 4.1 impose déjà que tout le
magasin soit dans le coffre et que les index en clair n'aient « ni domaine,
ni source, ni date fine » — donc **l'`id` doit être une empreinte de la
référence, pas la référence**. Je le propose ainsi : `id = SHA-256(source +
ref_source)` tronqué, ce qui garde le déterminisme entre appareils sans
rien dire. À valider : c'est une lecture de ma part, pas une décision du
prompt.

## 1. Inventaire des sources — constats refaits dans l'état réel

Le prompt demande de refaire ses constats. Trois écarts avec son § 0.1,
tous mineurs, tous à dire :

| Ce que le prompt situe | Ce que j'ai trouvé |
|---|---|
| `corrections.ts` | `src/lib/noyau/corrections.ts` (le prompt le cite sans chemin, à côté de `desaccords.ts` qui est dans `odyssee/`). Il porte `TYPE_RESOLUTION = 'conflit.resolu'`, `resolutions()` et `trier()` — le partage de type avec les conflits de synchronisation est confirmé. |
| « alertes de conflit entre molécules (H.10) » | **Aucun producteur d'alerte** trouvé. `odyssee/molecules.ts` porte un registre, une recherche, des statuts d'interaction et `MESSAGE_PROBABLE`, mais rien qui émette un signal. À vérifier à la phase 0 avant de l'inscrire comme source. |
| « propositions de modulation (D.7 du 22) » | Le mot n'apparaît que dans `sport/refus-locaux.ts`. À vérifier de même. |

**Sources confirmées par lecture du code :**

| Source | Module constaté | Statut |
|---|---|---|
| Questions à trancher (corrections + conflits de synchronisation, une seule source) | `noyau/corrections.ts`, `odyssee/desaccords.ts` (455 l., `REGLES_DESACCORD`) | Confirmée |
| Avis de fusion | `sync/veille.ts` (85 l.) → `sync/notification.ts` | Confirmée ; le corps compte les opérations, à retirer (décision 5) |
| Propositions d'adaptation | `noyau/adaptation.ts` (565 l., `TYPE_DECISION = 'profil.adaptation'`) | Confirmée |
| Avertissements avant analyse | `noyau/avertissements.ts` (`DOMAINES_A_AVERTISSEMENT`, `BANNIERE_ANALYSE`) | **Non listée par le prompt.** À verser à l'inventaire. |
| Veille du rythme de vie | `odyssee/signal-veille.ts` (`SILENCE_APRES`, quatre réponses) | Confirmée ; la cadence existe déjà, par réponse |
| Rappel de sauvegarde | `noyau/coffre.ts` → `rappelDeSauvegarde()`, quatre degrés | Confirmée |
| Rappel de revue manquée | `odyssee/moment-revue.ts` → `rappelDeRevue()` | Confirmée (§ 2 bis) |
| Trajectoires | `odyssee/trajectoires.ts` | Confirmée comme module ; le producteur de signal reste à identifier |
| Occurrences manquées | prompt 38 | **À construire** : rien ne les signale aujourd'hui |
| Pointages en attente de report | `odyssee/donnees-occurrences.ts` → `combienDeReports()` | **Déjà prêt**, et lisible coffre fermé : seul le nombre sort |
| Apprentissage étendu | `odyssee/consentement.ts` | Confirmée |

## 2. Tableau de sensibilité (§ 4.2) — forme à remplir en phase 0

Six colonnes par source, comme le prompt les nomme : compteur, panneau
coffre fermé, panneau coffre ouvert, notification du système, sauvegarde,
effet de l'effacement. Trois lignes de ce tableau sont déjà écrites par les
interdits et ne se discutent pas :

| Source | Compteur | Coffre fermé | Coffre ouvert | Notification | Sauvegarde | Effacement |
|---|---|---|---|---|---|---|
| Cycle et ce qui suit sa sensibilité | **exclu** | **exclu** | **exclu** | **exclu** | exclu | sans objet |
| Pointages en attente de report | non | **le nombre seul** | le nombre seul | non | exclu | suit la source |
| Toute autre source | selon 2.2 | rien de nommé | texte recalculé | libellé neutre ou rien | **exclue partout** | suit la source |

## 3. Le plan en phases

**Phase 0 — le relevé, et les trois vérifications ci-dessus.** Inventaire
exhaustif, tableau de sensibilité rempli, maquettes du panneau et du
compteur. Aucun code. C'est le point d'arrêt : rien ne commence sans ta
validation.

**Phase 1 — le filtre du cycle, en premier et seul.** Le § 1 n° 3 l'exige
« testé dès la phase 1, même si le module de cycle n'est pas construit ».
Le construire d'abord, avant toute source, est la seule façon de ne pas
l'ajouter après coup à un centre qui marche déjà — un filtre ajouté à la
fin est un filtre qu'on oublie de brancher quelque part.

**Phase 2 — le magasin et le modèle.** Sept champs, aucun contenu, `id`
dérivé par empreinte, magasin entièrement sous coffre, exclu des
sauvegardes. Rétention 30 / 180 jours réglables, jamais pour une question
ouverte.

**Phase 3 — le recalcul du texte depuis la source**, et ce qu'il affiche
quand la source est illisible coffre fermé. Même règle qu'au prompt 38 :
dire qu'on ne peut pas savoir, jamais deviner.

**Phase 4 — le compteur et le panneau**, avec l'`aria-live` limité au
nombre et jamais un titre, l'ouverture au clavier et le renvoi de focus.

**Phase 5 — les sources, une par une**, en commençant par les deux déjà
prêtes (rappel de sauvegarde, pointages à reporter) et en finissant par
celles qui demandent un producteur neuf (occurrences manquées).

**Phase 6 — les notifications du système** : libellé neutre pour tout,
plafond quotidien, retrait du nombre d'opérations des avis de fusion.

**Phase 7 — le remplacement du bloc du tableau de bord** (décision 9), les
essais de bout en bout et le compte rendu.

## 4. Ce que je signale avant de commencer

- **Le plafond « environ 5 » est à justifier comme règle de produit**
  (décision 4). Je le ferai en phase 6, pas maintenant : la justification
  dépend du nombre réel de sources, que la phase 0 établira.
- **« Une seule proposition par semaine, toutes catégories confondues »**
  (§ 1 n° 6) se compte sur le journal, deux appareils compris. C'est un
  plafond **réparti**, donc il tombe sous la même difficulté que la fusion :
  deux appareils hors ligne peuvent chacun croire le plafond libre. À
  traiter explicitement, pas à supposer résolu.
