# Échelles de la psyché — relevé à la source

**Résultat : aucun relevé n'a pu être fait.** Les cinq hôtes nécessaires sont
refusés par la passerelle réseau du conteneur. Aucun octet n'a été téléchargé,
donc aucun texte d'échelle ne figure ci-dessous. Ce fichier est un constat
d'échec d'accès, pas un relevé.

Mesures faites le **13 octobre 2026**, entre **00:37:50 UTC** et **00:38:36 UTC**.

---

## 1. Atteignabilité des cinq hôtes

Commande exécutée telle quelle :

```
for u in https://cdn.who.int https://www.who.int https://iris.who.int https://www.phqscreeners.com https://phqscreeners.com; do
  printf '%-32s' "$u"; curl -sS -o /dev/null -w "%{http_code}\n" --max-time 25 "$u" 2>&1 | tail -1
done
```

Sortie brute :

```
https://cdn.who.int             000
https://www.who.int             000
https://iris.who.int            000
https://www.phqscreeners.com    000
https://phqscreeners.com        000
```

Le code `000` signifie que `curl` n'a jamais obtenu de réponse HTTP : la
connexion n'a pas été établie. En réexécutant sans masquer le canal d'erreur,
chacun des cinq hôtes rend la même ligne :

```
curl: (56) CONNECT tunnel failed, response 403
```

| Hôte | Code HTTP | Diagnostic |
|---|---|---|
| `cdn.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `www.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `iris.who.int` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `www.phqscreeners.com` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `phqscreeners.com` | — (`000`) | `CONNECT tunnel failed, response 403` |

**Cinq refus sur cinq.** Le `403` est rendu par la passerelle en réponse au
`CONNECT`, c'est-à-dire avant tout échange avec l'OMS ou avec Pfizer : ce n'est
pas un refus des sites, c'est la politique réseau du conteneur qui n'autorise
pas ces domaines. Le journal de la passerelle qualifie les cinq événements de
`connect_rejected` — « gateway answered 403 to CONNECT (policy denial or
upstream failure) ».

## 2. Les URL exactes visées, essayées nommément

Le refus portant sur l'hôte, les URL précises du cahier des charges ont été
essayées pour que le relevé soit sans ambiguïté. Même résultat, à 00:38:35 UTC :

| URL | Code HTTP | Diagnostic |
|---|---|---|
| `https://cdn.who.int/media/docs/default-source/mental-health/indice-(en-cinq-points)-de-bien--tre-de-l-oms.pdf` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.who.int/copyright` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.phqscreeners.com/select-screener` | — (`000`) | `CONNECT tunnel failed, response 403` |
| `https://www.phqscreeners.com/images/screeners/french_phq-9.pdf` | — (`000`) | `CONNECT tunnel failed, response 403` |

Les deux dernières URL sont celles que je visais de mémoire pour atteindre la
page de téléchargement et le PDF du PHQ-9 ; **je n'ai pas pu vérifier qu'elles
existent encore**, puisque l'hôte ne répond pas. Elles figurent ici comme
tentatives, pas comme adresses confirmées.

## 3. Ce qui n'a donc pas été obtenu

Rien n'a été téléchargé. `/tmp/echelles/` est resté vide : **aucune taille,
aucune empreinte SHA-256 à rapporter**, pour aucun des trois documents.

| Document attendu | Obtenu | Pourquoi |
|---|---|---|
| WHO-5 français (titre, consigne, période de rappel, 5 items, options et valeurs chiffrées, règle de score) | Néant | `cdn.who.int` et `www.who.int` refusés par la passerelle |
| Page de droits de l'OMS (`www.who.int/copyright`) | Néant | `www.who.int` refusé |
| PHQ-9 français (texte intégral, licence) | Néant | `www.phqscreeners.com` et `phqscreeners.com` refusés |
| GAD-7 français (texte intégral, licence) | Néant | idem |
| Liste des variantes de français du PHQ-9 et du GAD-7 (France, Belgique, Canada, Suisse…) | Néant | la page de sélection des langues est sur l'hôte refusé ; je ne peux ni énumérer les variantes offertes, ni dire si une variante « France » existe |
| Mentions de copyright, de licence, de non-responsabilité et d'attribution | Néant | elles vivent dans les documents et sur les pages de téléchargement inaccessibles |

## 4. Ce que je n'ai délibérément pas fait

La consigne prime sur le résultat, donc je me suis arrêté net :

- **Aucun contournement.** Ni miroir, ni cache, ni proxy tiers, ni moteur de
  recherche, ni dépôt documentaire de substitution, ni site tiers (INSPQ,
  psychomedia, helpsy, université, PDF trouvé ailleurs).
- **Aucune reconstitution de mémoire.** Je connais approximativement la forme de
  ces trois échelles ; je n'en écris pas une ligne. Un énoncé reconstitué à un
  mot près — un « senti(e) » devenu « senti », une période de rappel approchée —
  a l'apparence du juste et n'est plus l'échelle : il vaut moins que rien, parce
  qu'il se relit sans alerter personne. Le texte français intégral demandé à
  l'étape 4 est donc **absent, et non approximé**.
- **Aucun fichier de données, aucun `NOTICE`, aucun code, aucun test.** La
  phase 1 n'est pas validée et la condition d'accès aux sources n'est pas
  remplie.

## 5. Pour débloquer

La politique d'accès réseau de l'environnement a refusé ces hôtes. Le réglage se
fait dans les paramètres de l'environnement cloud (menu de l'environnement dans
la barre de titre de la session, puis **Edit**, section **Network access**) :
soit un niveau d'accès plus large, soit l'ajout de `cdn.who.int`, `www.who.int`,
`iris.who.int`, `www.phqscreeners.com` et `phqscreeners.com` sous **Allowed
domains**, en laissant cochée la case **Allow package managers**. La marche à
suivre est décrite sur <https://code.claude.com/docs/en/cloud-environments#network-access>.

Une fois ces cinq domaines autorisés, le relevé de l'étape 2 peut être refait
sans rien changer d'autre : il ne dépend que de l'atteignabilité.

---

## 6. Tentative par un modèle externe (13 octobre 2026) — rejetée

Un relevé a été demandé à un modèle externe (Gemini) disposant d'un accès web,
le conteneur restant privé des cinq hôtes. **Son rapport est rejeté : il
n'apporte aucun texte authentifiable.** Les motifs, vérifiables :

- **Horodatage impossible.** Le rapport date la consultation du 13 octobre à
  06:35 UTC. Il a été remis à 04:36 UTC le 13 octobre — deux heures dans
  l'avenir. Cette date n'a pas été lue sur une horloge.
- **Aucune empreinte SHA-256, aucune taille en octets, aucun code HTTP**, pour
  aucun des quatre documents. Le motif invoqué — « données binaires exactes non
  accessibles par l'interpréteur de commande, mais le texte est extrait de
  manière intègre depuis l'index de données WHO » — décrit un mécanisme
  inexistant : il n'y a pas d'« index de recherche documentaire d'infrastructure
  WHO ». Un transfert réel livre la taille du fichier d'office.
- **Items du WHO-5 tronqués en milieu de phrase**, selon le motif caractéristique
  des extraits de moteur de recherche et non d'une extraction de PDF, avec
  renvoi au document pour « le contenu intégral et exact ». Les cinq items sont
  donc absents.
- **Licence paraphrasée.** La page de droits de l'OMS est rendue en « verbatim
  résumé » — contradiction dans les termes. Une licence paraphrasée est sans
  valeur. La mention de copyright du WHO-5 s'achève sur « texte abrégé, voir
  l'intégralité dans », préposition suivie de rien : artefact d'une citation qui
  n'a pas eu lieu.
- **PHQ-9, GAD-7 et la liste des variantes de français : non obtenus**, ce que le
  rapport reconnaît. Bilan réel sur quatre documents : zéro.

La règle de calcul du score qu'il avance est conforme à ce que l'on croit savoir
du WHO-5. C'est ce qui la rend inutilisable ici : rien n'établit qu'elle a été
lue plutôt que reconstituée, et sa plausibilité sert de caution au reste. Un
rapport dont les éléments vérifiables sont faux ne se rachète pas par ceux qui
sont seulement vraisemblables.

**Les fragments d'items ne sont volontairement pas recopiés dans ce fichier.**
Les y consigner, même sous étiquette, serait déposer dans le dépôt un texte
d'apparence juste qu'une relecture ultérieure prendrait pour le relevé. L'étape
du mot-à-mot reste entière.

---

## 7. Relevé externe n°2 (Qwen, 13 octobre 2026) — recevable comme piste, pas comme relevé

Second relevé externe, d'une qualité sans rapport avec le premier. **Il reste
néanmoins non authentifié, et une contradiction interne l'empêche d'être retenu
comme relevé à la source.**

### 7.1 La contradiction centrale

Dans sa partie « preuve de téléchargement », le rapport porte pour **les quatre
documents** la phrase exacte : « Je n'ai pas téléchargé ce fichier. » Tous les
champs — code HTTP, en-tête `Date`, `ETag`, `Content-Length`, taille, SHA-256,
ligne `%PDF`, producteur, nombre de pages — sont à `NON OBTENU`.

Or chaque bloc transcrit porte l'étiquette `[FICHIER] copié du fichier que j'ai
effectivement téléchargé`.

**Les deux affirmations ne peuvent pas être vraies ensemble.** L'étiquette
`[FICHIER]` est démentie par la partie B du rapport lui-même. Au mieux le texte
vient d'une page rendue par un outil d'extraction (`[PAGE]`), au pire d'ailleurs.
Aucune empreinte n'existe, donc rien n'est vérifiable : le texte ci-dessous est
**sous quarantaine**.

### 7.2 Ce que ce relevé apporte réellement

Trois choses, qui valent d'être conservées :

1. **Des URL de structure crédible**, bien plus que les chemins devinés en
   section 2 :
   - `https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/PHQ9_French%20for%20France.pdf`
   - `https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD7_French%20for%20France.pdf`
   Le segment `g10060481` et l'horodatage `201412` ont la forme d'un chemin de
   gestionnaire de contenu réel, difficilement inventable de mémoire. **À
   vérifier en premier** le jour où les domaines s'ouvrent.
2. **Une variante « Canada »** signalée pour le PHQ-9 (`PHQ9_French for
   Canada.pdf`). Le rapport n'en signale aucune autre : ni Belgique, ni Suisse.
   Cette liste est donc **possiblement incomplète** et reste à établir sur la
   page de sélection.
3. **Des anomalies typographiques — dont la valeur de preuve est annulée par
   l'OCR (voir 7.2 bis).** Le texte comporte « vousavez » sans espace,
   « bienêtre » sans trait d'union, « ont- ils » avec espace interne, et un
   « géné(e) » dans le GAD-7 là où le PHQ-9 porte « gêné(e) ». Elles sont
   conservées ci-dessous sans correction, mais **elles ne prouvent rien quant à
   la fidélité du texte** : elles sont très probablement produites par le moteur
   d'OCR, non portées par les documents.

### 7.2 bis — RECTIFICATION : le texte provient d'une extraction OCR

L'utilisateur a précisé après coup que **ces transcriptions sont issues d'une
extraction OCR**. Deux conséquences, dont la première annule un raisonnement
écrit plus haut dans ce fichier et poussé le 13 octobre.

**1. L'argument d'empreinte était faux, et il est retiré.** J'avais soutenu que
les anomalies typographiques signaient une lecture réelle du PDF et que, si les
vrais fichiers les portaient, le texte serait authentifié. C'est inversé : sous
OCR, « ê » lu « é », une espace avalée et un trait d'union perdu sont les erreurs
les plus banales du procédé. Le PDF réel porte donc très probablement
« gêné(e) » dans le GAD-7 comme dans le PHQ-9, « vous avez » et « bien-être ».
**L'absence de ces anomalies dans les vrais fichiers ne réfuterait rien, et leur
présence ne confirmerait rien** : le test que j'avais proposé ne départage pas.

**2. Un texte d'échelle issu d'OCR ne peut pas satisfaire l'exigence du
mot-à-mot.** L'OCR échoue précisément sur ce qui fait la valeur de ces
documents : les accents, les suffixes « (e) » et « (s) », les parenthèses, le
glyphe « ✓ », et les chiffres des tableaux de cotation — donc les valeurs de
réponse et les seuils de score. Chaque caractère ci-dessous est suspect
individuellement, y compris dans les mentions de licence.

**3. L'étiquetage du rapport est fautif une seconde fois.** La consigne imposait
d'étiqueter tout recours à l'OCR par `OCR NON VÉRIFIÉ`. Le rapport a étiqueté
`[FICHIER] copié du fichier que j'ai effectivement téléchargé`, sans mentionner
l'OCR. La provenance réelle n'est venue ni du rapport ni de ses étiquettes.

À l'inverse, l'OCR éclaire partiellement la contradiction de la section 7.1 :
océriser suppose d'avoir obtenu un rendu des pages, ce qui situe le procédé
au-dessus de l'invention pure. Mais cela reste incompatible avec « Je n'ai pas
téléchargé ce fichier » et avec un nombre de pages à `NON OBTENU`, que toute
océrisation fournit.

### 7.3 Ce qui manque toujours

- **Toute preuve de téléchargement**, pour les quatre documents.
- **La règle de calcul du score du PHQ-9 et du GAD-7**, et leurs seuils
  d'interprétation. Seul un fragment de codage interne est rapporté pour le
  GAD-7.
- **La liste complète des variantes de français** (deux signalées sur un nombre
  inconnu).
- Le rapport initial était **tronqué** en cours de partie « droits » ; la page
  de droits de l'OMS, la ligne de licence PHQ/GAD du site et l'attribution
  portée par les PDF PHQ-9 / GAD-7 en français ont été transmises séparément,
  par collage de l'utilisateur. Leur provenance exacte à l'intérieur de la
  session externe n'est donc pas établie, et elles ne portent elles non plus
  aucune empreinte.

### 7.4 TEXTE SOUS QUARANTAINE — ne pas utiliser comme donnée d'échelle

> **OCR NON VÉRIFIÉ.** Tout ce qui suit provient d'une extraction OCR, sans
> empreinte, sans taille, sans code HTTP, et sous une étiquette d'origine
> contredite par le rapport qui la porte (voir 7.1 et 7.2 bis). **Chaque
> caractère est suspect**, en particulier les accents, les suffixes « (e) », les
> parenthèses, le glyphe « ✓ » et les chiffres de cotation. Ce texte est consigné
> pour être **recoupé contre la couche texte des PDF réels**, pas pour être
> employé, et aucun fichier de données d'échelle n'en sera tiré.

#### WHO-5 — version française (non authentifié)

Titre : `Indice (en cinq points) de bien-être de l’OMS (1999)`

Consigne : `Veuillez indiquer, pour chacune des cinq affirmations, laquelle se rapproche le plus de ce que vousavez ressenti au cours des deux dernières semaines. Notez que le chiffre est proportionnel au bienêtre.`

Exemple : `si vous vous êtes senti(e) bien et de bonne humeur plus de la moitié du temps au cours des deux dernières semaines, cochez la case 3.`

Période de rappel : `Au cours des deux dernières semaines`

Options : `Tout le Temps (5) | La plupart du temps (4) | Plus de la moitié du temps (3) | Moins de la moitié du temps (2) | De temps en temps (1) | Jamais (0)`

Items :

```text
1. Je me suis senti(e) bien et de bonne humeur
2. Je me suis senti(e) calme et tranquille
3. Je me suis senti(e) plein(e) d'énergie et vigoureux(se)
4. Je me suis réveillé(e) en me sentant frais(che) et dispos(e)
5. Ma vie quotidienne a été remplie de choses intéressantes
```

Score : `Pour calculer votre score, ajoutez les chiffres correspondant aux cases que vous avez cochées et multipliez la somme par quatre. Vous obtiendrez alors un score compris entre 0 et 100. Un score élevé signifie un meilleur bien-être.`

Mentions portées par le PDF :

```text
French translation

* * *

The WHO-5 was developed during the 1990s by the late Per Bech of the Psychiatric Centre North Zealand
(Copenhagen, Denmark), which hosted a WHO Collaborating Centre for Mental Health. The WHO-5 was derived
from other scales and studies by the WHO Regional Office in Europe [1][2]. It has been translated, tested and used
in a wide range of languages and settings across the globe [3].

In 2024 the Psychiatric Centre North Zealand and WHO agreed to assign copyright in the WHO-5 to WHO, thereby
creating the opportunity to publish and disseminate the tool as a WHO open access product.

The translation displayed on the next page was completed before WHO accepted copyright of the English version
in 2024. The translation was published on the website of the Psychiatric Centre North Zealand (Copenhagen,
Denmark). WHO is not responsible for the content or accuracy of this translation. In the event of any inconsistency
between the English and the translated version, the English version shall be the binding and authentic version.
```

#### PHQ-9 — version française France (non authentifié)

Titre : `QUESTIONNAIRE SUR LA SANTÉ DU PATIENT – 9 (PHQ-9)`

Consigne : `Au cours des 2 dernières semaines, selon quelle fréquence avez-vous été gêné(e) par les problèmes suivants ?(Veuillez cocher(✓) votre réponse)`

Options : `Jamais (0) | Plusieurs jours (1) | Plus de la moitié du temps (2) | Presque tous les jours (3)`

Items :

```text
1. Peu d'intérêt ou de plaisir à faire les choses
2. Être triste, déprimé(e) ou désespéré(e)
3. Difficultés à s'endormir ou à rester endormi(e), ou dormir trop
4. Se sentir fatigué(e) ou manquer d'énergie
5. Avoir peu d'appétit ou manger trop
6. Avoir une mauvaise opinion de soi-même, ou avoir le sentiment d'être nul(le), ou d'avoir déçu sa famille ou s'être déçu(e) soi-même
7. Avoir du mal à se concentrer, par exemple, pour lire le journal ou regarder la télévision
8. Bouger ou parler si lentement que les autres auraient pu le remarquer. Ou au contraire, être si agité(e) que vous avez eu du mal à tenir en place par rapport à d'habitude
9. Penser qu'il vaudrait mieux mourir ou envisager de vous faire du mal d'une manière ou d'une autre
```

Question complémentaire : `Si vous avez coché au moins un des problèmes évoqués, à quel point ce(s) problème(s) a-t-il (ont- ils) rendu votre travail, vos tâches à la maison ou votre capacité à vous entendre avec les autres difficile(s) ?`
Options : `Pas du tout difficile(s) | Assez difficile(s) | Très difficile(s) | Extrêmement difficile(s)`

**Règle de score : NON OBTENUE.**

#### GAD-7 — version française France (non authentifié)

Titre : `GAD-7`

Consigne : `Au cours des 2 dernières semaines, selon quelle fréquence avez-vous été géné(e) par les problèmes suivants ? (Veuillez cocher (✓) votre réponse)`

Options : `Jamais (0) | Plusieurs jours (1) | Plus de la moitié du temps (2) | Presque tous les jours (3)`

Items :

```text
1. Un sentiment de nervosité, d'anxiété ou de tension
2. Une incapacité à arrêter de s'inquiéter ou à contrôler ses inquiétudes
3. Une inquiétude excessive à propos de différentes choses
4. Des difficultés à se détendre
5. Une agitation telle qu'il est difficile à tenir en place
6. Une tendance à être facilement contrarié(e) ou irritable
7. Un sentiment de peur comme si quelque chose de terrible risquait de se produire
```

Note de codage portée par le document : `(*For office coding: Total Score T____ = ____ + ____ + ____ )`

**Règle de score : NON OBTENUE.**

#### Licence PHQ / GAD-7 (non authentifié, transmise séparément)

```text
All PHQ, GAD-7 screeners and translations are downloadable from this website and no permission is required to reproduce, translate, display or distribute them.
```

#### Attribution portée par les PDF PHQ-9 / GAD-7, en français (non authentifié, transmise séparément)

Les retours à la ligne et les espaces en fin de ligne sont conservés tels quels,
**non pas parce qu'ils feraient preuve** — l'extraction est océrisée, ils peuvent
venir du moteur d'OCR autant que de la mise en page — mais parce qu'un relevé ne
se retouche pas. **Ne pas les normaliser.**

```text
Développé par les Dr Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke et leurs collègues grâce à 
une allocation d’études de Pfizer Inc. La reproduction, la traduction, l’affichage ou la distribution de ce 
document sont autorisés.
```

À recouper : la traduction de *educational grant* en « allocation d’études », et
la formule « sont autorisés » là où la version anglaise du site porte « no
permission is required ». Ces deux formules sont des choix de traducteur, donc
plus robustes à l'OCR qu'un accent ou une parenthèse : ce sont les seuls
marqueurs de cette section qui gardent une valeur indicative.

#### Page de droits de l'OMS (non authentifié, transmise séparément)

```text
Copyright, Licensing and Permissions

WHO supports open access to the published output of its activities as a fundamental part of its mission and a public benefit to be encouraged wherever possible.

WHO’s open access applies to:

- all publications published by WHO  CC BY-NC-SA 3.0 IGO;
- articles or chapters published in non-WHO publications that are authored or co-authored by WHO staff CC BY 3.0 IGO or CC BY-NC 3.0 IGO;
- articles or chapters published in non-WHO publications that are authored or co-authored by individuals or institutions funded in whole or in part by WHO CC BY 3.0 IGO or CC BY-NC 3.0 IGO.

While most of the content in WHO publications is owned by WHO, there may be materials that are credited to another published source. Permission will normally be required from the originating publisher to reproduce such materials. Please refer to the copyright notice in the publication concerned for complete information.

Permissions and licensing

Permission from WHO is not required for the use of WHO materials issued under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Intergovernmental Organization ( CC BY-NC-SA 3.0 IGO) licence.

It is important to note that:

• WHO publications cannot be used to promote or endorse products, services or any specific organization.

• WHO logo cannot be used without written authorization from WHO.

• WHO provides no warranty of any kind, either expressed or implied. In no event shall WHO be liable for damages arising from the use of WHO publications.

The  CC BY-NC-SA 3.0 IGO licence allows users to freely copy, reproduce, reprint, distribute, translate and adapt the work for non-commercial purposes, provided WHO is acknowledged as the source using the following suggested citation:

[Title]. [Place of publication]: World Health Organization; [Year]. Licence: CC BY-NC-SA 3.0 IGO.

The use of WHO materials that are not available under the CC BY-NC-SA 3.0 IGO licence is subject to permission being granted by WHO. Some of the uses of such materials are:

• reproduction and translation of figures, tables, maps, photos, etc.

• reprint and translation of complete works.

• licensing of materials or other technical information in electronic database products and services.

To request permission to use such materials, please complete the following permissions form.

Translations and adaptations

If you create an adaptation or a translation of a WHO publication available under the CC BY-NC-SA 3.0 IGO licence, the following disclaimer should be included, as applicable:

For translations: “This translation was not created by the World Health Organization (WHO). WHO is not responsible for the content or accuracy of this translation. The original English edition “[Title]. Geneva: World Health Organization; [Year]. Licence: CC BY-NC-SA 3.0 IGO” shall be the binding and authentic edition”.

For adaptations: “This is an adaptation of an original work “[Title]. Geneva: World Health Organization (WHO); [Year]. Licence: CC BY-NC-SA 3.0 IGO”. This adaptation was not created by WHO. WHO is not responsible for the content or accuracy of this adaptation. The original edition shall be the binding and authentic edition”.

The adaptation or translation must be licensed under the same or similar licence terms. Note that the CC BY-NC-SA 3.0 IGO licence can only be used by organizations established by a treaty or other instrument governed by international law and possessing its own international legal personality, and that are not subject to national laws, such as United Nations agencies, Intergovernmental organizations and International Organizations.

Similar licences that could be used are the  CC BY-NC-SA 3.0 licence or the  CC BY-NC-SA 4.0 licence.

Commercial uses

Permission is required for commercial uses and licensing of WHO materials, such as using the material in the context of a commercial activity. Requests can be made by completing the following permissions form.

Licensing of WHO Classifications

- the International Statistical Classification of Diseases and Related Health Problems (ICD),
- the International Classification of Functioning, Disability and Health (ICF),
- and the International Classification of Health Interventions (ICHI).

These Classifications are now available on the ICD-11 platform https://icd.who.int. They are licensed under the Creative Commons Attribution-NoDerivs 3.0 IGO (CC BY-ND 3.0 IGO) license and may be used for commercial and non-commercial purposes, provided there is no adaptation of the codes and the work is appropriately cited. Further information on the special aspects of the ICD license is available here: ICD-11 Terms of Use and License Agreement.

You can also access the codes via an API by registering here https://icd.who.int/icdapi. Proposals for amendments to ICD-11 can be submitted through our website https://icd.who.int.

WHO grants Governments, eventually represented by the relevant institutions, the translation rights of ICD-11, and other Classifications. Translations are prepared and delivered directly using the ICD-11 Translation Platform. Requests for translations will require written agreements and should be submitted online via icd@who.int.

For further information, visit https://icd.who.int
```

### 7.5 Ce qui reste à faire, par ordre

1. Ouvrir les cinq domaines, puis **recouper caractère par caractère contre la
   couche texte des PDF réels** — `pdftotext -layout`, pas une relecture à
   l'œil. Le texte de la section 7.4 étant océrisé, les divergences sont
   attendues et ne tranchent rien par elles-mêmes : seule la couche texte du
   fichier d'origine fait foi. Si les PDF sont des images sans couche texte, le
   mot-à-mot exigé est hors d'atteinte par ce chemin et il faudra le dire.
2. Vérifier en priorité les deux URL en `g10060481/f/201412/`.
3. Établir la liste réelle des variantes de français sur la page de sélection.
4. Relever les règles de score du PHQ-9 et du GAD-7, absentes ici.
5. **Point à trancher ensuite, hors relevé** : si le WHO-5 relève bien de
   CC BY-NC-SA 3.0 IGO, les clauses *NonCommercial* et *ShareAlike* ont des
   conséquences sur l'intégration dans une application. À décider sur pièces, pas
   sur ce relevé sous quarantaine.

Le mot-à-mot authentifié reste donc à faire. Aucun fichier de données d'échelle,
aucun `NOTICE`, aucun code n'est produit : la phase 1 n'est pas validée.
