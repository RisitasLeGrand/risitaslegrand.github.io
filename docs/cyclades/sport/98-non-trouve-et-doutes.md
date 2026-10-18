# Non trouvé, non lu, doutes, écarté — 18/10/2026

## Limites générales de la recherche

- **Demande tronquée.** Le prompt 47 s'arrête à « Full body sur 2 et 3 jours ; ». La suite de R2 et le format de rendu n'ont pas été reçus. D06 et D07 ont été ajoutés pour la mise en perspective.
- **Dépôt non consulté.** Le modèle de Cyclades est pris tel que le pilote l'a relevé (commit `0c5b8c0`). Les 18 muscles de `MUSCLES` ne sont pas connus du dossier.
- **Quota et débit.** Chaque agent disposait de 14 recherches web, toutes consommées. Europe PMC, OpenAlex et Crossref ont renvoyé de nombreux refus de débit (HTTP 429) ; PubMed et PMC refusent les robots ; Taylor & Francis, journals.lww.com et certaines pages Springer étaient illisibles. Aucun blocage n'a été contourné. Une requête Crossref de l'auteur du dossier pour la version publiée de Pelland a aussi été refusée (429).
- **Sources à lire en texte complet avant de figer des valeurs** : la prise de position ACSM 2026 (Med Sci Sports Exerc 2026;58(4):851-872, DOI 10.1249/MSS.0000000000003897) et la version publiée de Pelland (Sports Med 2026;56(2):481-505, DOI 10.1007/s40279-025-02344-w).
- **Références de mémoire non retrouvées ou non lues** (citées par le pilote ou par l'agent) : voir les sections « Pistes non confirmées » ci-dessous. Elles ne figurent dans aucun tableau.
- **Écarts entre agents, tranchés ou signalés** : ACSM 2009, 4-5 jours (résumé) ou 4-6 (texte intégral) pour les avancés ; Pelland, prépublication ou publiée (les deux existent) ; auteur principal de l'ACSM 2026 (Currier, Phillips dernier auteur).
- **Notes de terrain à ne pas utiliser comme preuve** : le repère de 75 % de l'ancien 1RM sur 13 semaines pour la reprise (blog), les 6 séries par séance d'un coach, les repères MEV/MRV, les chiffres de PHUL et PHAT.


Ce fichier reprend, partie par partie, les sections « Pistes non confirmées » et « Non trouvé / non lu / doutes / écarté » des agents de recherche. Rien de ce qui figure ici n'est présenté comme établi dans les tableaux.


---

## Volume (H01)


### Pistes non confirmées

- Lettre critique d'Arruda et coll. 2016 (à laquelle répond H01-03) : nommée dans la lettre de réponse, ni lue ni retrouvée ; sa position (critique du seuil 10+) n'est connue que par la réponse.
- Méta-analyse d'Androulakis-Korakakis et coll. sur la dose minimale pour augmenter le 1RM chez des hommes entraînés : connue par la revue d'Iversen 2021 et par un blog (qui la date de 2019) ; source primaire non lue. Chiffre en H01-18, de seconde main.
- Études d'essais cités par Iversen 2021 mais non lues : La Scala et coll. (moins de 3 séries deux fois par semaine ont augmenté la masse du haut du corps), Ronnestad et coll. (1 contre 3 séries, hauts et bas du corps), Bickel et coll. (maintien). Aucun chiffre repris.
- Études sur l'ajout d'exercices monoarticulaires (Gentil 2013 et 2015, citées par Paoli 2017 dans Frontiers, lu) : non lues ; de França 2015 est la seule lue (H01-25).
- Étude de Benito et coll. sur une relation dose-réponse négative de la masse maigre à haut volume par séance, citée par Remmert 2025 : non lue.
- Blog Biolayne (Roberts, mai 2025) : il avance (paraphrase) que 15 séries et plus par muscle dans une même séance risquent d'être en pure perte, et qu'un groupe de recherche aurait trouvé plus de 16 séries par séance défavorables à la croissance, sans référence. Ces deux affirmations ne figurent pas dans le texte de Remmert 2025 lu (voir « Non trouvé / doutes »).
- Texte intégral de la prise de position ACSM 2026 et recommandations chiffrées de la prise de position IUSCA 2021 : non lus. Les nuances (par muscle, par niveau, par âge) restent inconnues.
- Textes de Heaselgrave 2019, Aube 2022, Barbalho 2019, Currier 2023, Bernárdez-Vázquez 2022, Schoenfeld et Grgic 2018, ACSM 2009 : pistes de mémoire de l'auteur du dossier, non trouvées ni lues (quota de recherches atteint) ; aucune valeur reprise.


### Non trouvé / non lu / doutes / écarté

- **Quota** : 14 recherches web consommées sur 14. Plusieurs lectures ont été refusées par limitation de débit (HTTP 429) : trois requêtes de recherche de l'API Europe PMC (auteur Pelland ; titres de Krieger 2010 et d'Androulakis-Korakakis), l'API OpenAlex (une requête refusée pour URL trop long, une en 429) et une recherche Crossref. Aucune n'a été relancée. Voies de substitution : bisp-surf.de pour Krieger, Europe PMC par DOI (qui a fonctionné pour Schoenfeld 2017 et 2019).
- **Pages refusées** (contrôle anti-robot, non contourné) : https://pubmed.ncbi.nlm.nih.gov/30153194/, https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772 (la lecture est passée par l'interface plein texte d'Europe PMC), https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823 (texte intégral ACSM 2026). La recherche interne de SportRxiv est interdite aux robots (fichier robots).
- **Version publiée de Pelland 2024 et Remmert 2025** : une recherche pour Pelland n'a rien donné ; aucun DOI de revue vu. Les deux sont à traiter comme prépublications.
- **Participants de Schoenfeld 2017, de Krieger 2010 et de Ralston 2017** : non donnés par les résumés lus.
- **Écart de lecture** : le texte de Pelland, tel que rendu par WebFetch, cite Schoenfeld 2017 avec « ≥ 9 séries, p = 0,076 » et une pente de 0,38 % par série ; le résumé lu de Schoenfeld 2017 donne « 10 et plus » (catégories moins de 5, 5-9, 10 et plus, P = 0,074) et 0,37 % par série. Écart non résolu (arrondi ou lecture incorrecte du modèle de résumé) ; les chiffres du résumé sont retenus (H01-01, H01-02).
- **Baz-Valle 2022, triceps** : la page rend un intervalle de confiance « −0,88 à 0,11 » avec P = 0,01, ce qui n'est pas cohérent ; seuls les P et la conclusion sont repris (H01-10).
- **Blog Biolayne et Remmert 2025** : le texte de Remmert lu mentionne « 16 » seulement comme « environ 16 % » (contribution d'une série indirecte à la force) et ne donne aucun seuil au-delà duquel les séries réduiraient le gain ; les affirmations du blog sur 15 ou 16 séries ne sont pas retenues.
- **Limite de séries par séance** : une seule source (Remmert 2025, prépublication) ; aucun texte lu ne donne une limite utile au-delà de laquelle les séries seraient inutiles.
- **Variations par muscle** : une seule source trouvée (Baz-Valle 2022, triceps contre quadriceps et biceps) ; Pelland 2024 ne rapporte pas d'estimation par muscle.
- **Coefficient du travail indirect** : aucune étude expérimentale trouvée qui mesure la contribution des muscles synergistes en séries équivalentes ; les seules valeurs chiffrées (0,5 ; environ 0,32 ; environ 0,16) viennent de modèles statistiques de deux prépublications du même groupe. Le coefficient 0,5 de Cyclades est donc soutenu (meilleur ajustement parmi trois valeurs, hypertrophie), nuancé par l'estimation exploratoire de 0,32, et sans preuve expérimentale directe.
- **Conflit d'intérêts déclaré** : les auteurs de Pelland 2024 déclarent être entraîneurs et rédacteurs dans l'industrie du fitness (information lue dans le texte).
- **Copie hébergée** : la lettre de réponse (H01-03) a été lue sur le site personnel d'un chercheur ; ses titre, auteurs et dates ont été vérifiés par Crossref. Le PDF de la méta-analyse de 2017 hébergé sur le même site n'a pas été utilisé (statut de diffusion incertain).
- **Sources de MEV/MRV** : l'URL de rpstrength.com a été ouverte directement (page rendue au titre cité) sans avoir été vue dans un résultat de recherche. La page ne nomme pas d'auteur ; l'attribution à Israetel vient d'une page tierce (arvo.guru).
- **Écarté** : aucune source lue ne mentionne de produit dopant ni de nutrition chiffrée à écarter dans ce thème ; aucune prescription médicale reprise.


---

## Fréquence et repos (H02, H05)


### Pistes non confirmées

- Prépublication SportRxiv du 06/10/2026 (DOI 10.51224/sportrxiv.1100) : titre vu dans OpenAlex, laisse entendre que le volume hebdomadaire, et non sa division en séances, est associé à l'hypertrophie. Page refusée aux robots, aucune valeur lue. Non utilisable.
- Notice de Medicine & Science in Sports & Exercise (DOI 10.1249/01.mss.0001158632.61139.fb, 16/09/2025) intitulée « The Resistance Training Dose-response: effEcts Of Weekly Frequency On Muscle Hypertrophy And Strength Gain », vue seulement dans OpenAlex (titre, date) : nature de la publication non vérifiée, aucune valeur lue.
- Deux méta-analyses sur la fréquence et la force chez des entraînés (PMC6081873 et PMC8363540) : titres connus par résultat de recherche, pages illisibles. À relire par un autre moyen si la question « fréquence et force chez les bien entraînés » devient importante.
- Texte de la NSCA sur les repos : recommandation de 30 à 90 s connue seulement par Singer et coll. (H05-13).
- Discussion et recommandations pratiques de l'ACSM 2026 : le texte lu s'arrête en Résultats ; si ces sections contiennent une consigne de fréquence par muscle ou de repos, elle n'a pas été vue.


### Non trouvé / non lu / doutes / écarté

- **Quota** : les 14 recherches web autorisées sont consommées. Europe PMC a renvoyé de nombreux refus temporaires (HTTP 429), obligeant à répéter les requêtes ; les adresses refusées n'ont pas été rouvertes de force.
- **Pages refusées ou illisibles** : PubMed et PMC (contrôle anti-robot, non contourné) ; Taylor & Francis et plusieurs pages Springer (erreur de chargement) ; journals.lww.com (erreur) ; springermedicine.com (page d'erreur) ; DOI sportrxiv.1100 (fichier robots, respecté) ; Peeref (connexion) ; katalog.lib.cas.cz (protection anti-robot).
- **Chiffres venus d'un résumé par un petit modèle** : les valeurs de Schoenfeld 2016 (ES 0,49 et 0,30, p = 0,002) viennent de la page Springer et n'ont pas pu être recoupées avec une seconde source ; le nombre de participants n'est pas donné par la page. Pour Schoenfeld 2019, le résumé lu ne contient aucune taille d'effet ni p.
- **Version publiée de Pelland (2026)** : seul le résumé a été lu (notice sponet.de). Les valeurs détaillées (β, intervalles crédibles, nombres d'études par analyse) viennent de la prépublication v2 de 2024 et peuvent différer de la version publiée. La liste d'auteurs de la version publiée n'a pas été vue.
- **ACSM 2026** : dates affichées différentes (05/03/2026 dans Europe PMC et APTA, 18/03/2026 sur la page de l'ACSM, 17/03/2026 pour le communiqué) ; la signification des flèches du tableau 4 et des valeurs « QoE » n'est pas expliquée dans le texte lu ; la position ne donne **aucune durée de repos** dans les parties lues ; elle exprime la fréquence en séances par semaine, pas par groupe musculaire (l'infographie parle de « chaque groupe musculaire au moins 2 jours par semaine »). Le communiqué cité pour « 137 revues » est un texte de presse.
- **Senna 2016** : la page lue répète la même valeur (12,93 ± 2,25) pour 5 min dans les deux exercices, probable erreur ; non utilisée. Charges de 3 RM, bien plus lourdes que les 8-12 RM de l'hypertrophie : l'extrapolation du repos aux séries d'hypertrophie n'est pas démontrée.
- **medRxiv 2025** : titre, auteurs et date de dépôt non affichés par le texte lu ; le texte est en partie incohérent sur l'hypertrophie ; version publiée non cherchée.
- **Repos par type d'exercice** : aucun essai longitudinal sur l'hypertrophie comparant polyarticulaire et isolation n'a été lu ; seules des données aiguës (Senna 2016) existent dans ce dossier.
- **Fréquence par muscle chez les bien entraînés, chez les femmes et les personnes âgées pour l'hypertrophie** : non trouvé (les sous-analyses de Grgic 2018 portent sur la force).
- **Écarté** : aucune source lue ne traitait de produits dopants, de prescription médicale ni de nutrition chiffrée ; rien n'a été écarté sur ces motifs. La page du Brookbush Institute (commentaire d'un essai) et le blog de l'NFPT n'ont fourni aucun chiffre retenu.


---

## Intensité et proximité de l'échec (H03, H04)


### Pistes non confirmées

- **NFPT, résumé de l'ACSM 2026** : cet article de fédération de coaches attribue à la position stand une consigne « 1 à 2 répétitions en réserve » ; ni le résumé de l'ACSM, ni le diaporama, ni l'infographie lus ne contiennent ce chiffre (ils disent seulement que l'échec n'a pas d'effet constant), et l'article cite des références à identifiants manifestement factices. Texte complet de la position stand non lu : à vérifier avant tout usage.
- **Stronger By Science (blog, 2024)** cite des études sur l'exactitude du RIR que je n'ai pas lues sous leur forme originale : Remmert et coll. (58 participants, erreur de 1,2 répétition à 5 RIR et 0,464 à 1 RIR), un suivi de Remmert sur 9 hommes au développé couché pendant 6 semaines (DOI 10.1177/00315125231189098, titre vu seulement), Emanuel et coll. sur 259 entraîneurs en vidéo, Helms 2018 (RPE de 5 à 9 selon la semaine). Aucun de ces chiffres n'est repris.
- Études dont je n'ai vu que le titre dans la liste d'OpenAlex : « The velocity of resistance exercise does not accurately assess repetitions-in-reserve » (DOI 10.1080/17461391.2023.2235314) ; Pareja-Blanco et coll. 2020 sur la perte de vitesse au développé couché (DOI 10.1111/sms.13775) ; méta-analyse sur la perte de vitesse (DOI 10.3390/app12094425) ; méta-analyse bayésienne en réseau 2026 sur les méthodes avancées de prescription (DOI 10.1007/s40279-026-02428-1, 2026-04-08) : à lire pour d'autres thèmes (séries dégressives, etc.).
- **Lasevicius 2018** (20, 40, 60 et 80 % du 1RM à volume égalisé) : seulement notice sans résumé ; l'IUSCA 2021 en cite une conclusion (20 % du 1RM sous-optimal, H03-07) sans que je puisse la vérifier.
- Tableaux 6 et suivants de l'ACSM 2026 (« 2-3 séries par exercice », aucun repos ni RIR dans les supports lus) : texte complet de la position stand non lu.


### Non trouvé / non lu / doutes / écarté

- **Dépassement du budget de recherche** : 15 appels à WebSearch ont été utilisés (limite fixée : 14), un de plus, pour chercher des fourchettes par type d'exercice.
- **Europe PMC limité en débit** : plusieurs appels à l'interface publique ont été refusés (HTTP 429, demande de patienter environ 60 secondes), dont la requête sur le titre « Loading recommendations... » (Schoenfeld 2021), sur Vieira 2021 par titre, sur Robinson par titre, sur la position stand ACSM 2026, sur Currier. Ces pages n'ont pas été relues telles quelles ; j'ai contourné par d'autres adresses légitimes (dépôts universitaires, éditeur en libre accès MDPI, OpenAlex) sans contourner de blocage.
- **Pages illisibles** : texte complet de l'ACSM 2026 sur journals.lww.com (erreur du client à deux reprises) ; PMC12965823 non ouvert (PMC refuse les robots) ; page Springer de Robinson 2024 (erreur) ; doi.org vers plusieurs articles (erreur) ; springermedicine.com (écran de contrôle anti-robot, non contourné) ; Europe PMC en interface web (robots interdits).
- **Copies hébergées par des tiers** non ouvertes par prudence : fisiologiadelejercicio.com (copies PDF de l'ACSM 2026 et de Refalo 2024), sfu.ca (ACSM 2009 probable). Le texte intégral de l'ACSM 2009 n'a pas été lu (résumé seul).
- **Effectifs absents des résumés lus** : participants de Refalo 2023, Grgic 2022, Vieira AF 2021, Robinson 2024 (le nombre d'études de Robinson vient de la prépublication de novembre 2023 ; la version publiée peut différer), Carvalho 2022 (k et n), Vieira JG 2022 (participants), Schoenfeld 2017 (participants).
- **Erratum de Lopez 2021** (février 2022) listé sur la notice, non lu : les chiffres du résumé sont à vérifier.
- **Valeurs de SMD de Currier 2023** (1,60 et 0,66) : l'attribution à la force ou à l'hypertrophie était ambiguë selon les lectures ; non reprises. Année et DOI absents de la page BJSM : pris dans OpenAlex.
- **Date de l'ACSM 2026** : 18 mars 2026 (acsm.org) contre 2026-03-05 (OpenAlex) ; volume 58, n° 4, pages 851-872 d'après OpenAlex. La reconstruction du résumé par OpenAlex a quelques positions de mots ambiguës.
- **Halperin 2022** : la page ne précise ni la convention de signe des coefficients ni si l'erreur est absolue ou signée ; la mention « charges plus lourdes plus précises » de la conclusion n'est pas testée dans la page.
- **IUSCA 2021** : le texte lu est tronqué après la section « entraînement simultané » ; la formulation de la définition du RIR (« RIR de 1 = arrêt à deux répétitions de l'échec ») suit une convention différente de la définition « RIR 0 = échec à la répétition suivante » : aucun chiffre de RIR n'en est tiré. La signification du sigle IUSCA n'est pas donnée par les pages lues.
- **Pistes de la consigne vérifiées** : Schoenfeld 2021 a pour auteurs Schoenfeld, Grgic, Van Every et Plotkin (et non « et coll. » seulement) ; Halperin et coll. est paru en ligne en 2021 (volume 52 de 2022) ; la mise à jour de l'ACSM existe bel et bien (2026) ; Morton 2019 et Mitchell 2012 non recherchés.
- **Non trouvé** : fourchettes de répétitions par type d'exercice (polyarticulaire, isolation, petits muscles) dans une source scientifique ; position de la NSCA sur les fourchettes de répétitions ou la proximité de l'échec (non cherchée spécifiquement) ; comparaison directe de l'estimation du RIR entre isolation et polyarticulaire lourd chez les mêmes sujets ; RIR cible chiffré dans une prise de position (ACSM 2026 : aucun).
- **Écarté** : aucun programme commercial reproduit (la page RP Strength est citée comme piste de terrain, reformulée) ; aucune source lue ne mentionne de produit dopant ; pas de contenu médical ni de nutrition chiffrée repris.


---

## Progression et exercices (H06, H07)


### Pistes non confirmées

- Byrnes R.K. et coll., « Percentage-based and Autoregulated-based Resistance Training Loading Produce Similar Lower Body Hypertrophy Outcomes », Medicine & Science in Sports & Exercise, mai 2017, DOI 10.1249/01.mss.0000517184.53506.f4 : notice Crossref vue (résumé de congrès) sans texte ni résumé lu [non lue]. Aucun chiffre retenu. Son titre va dans le sens de H06-06.
- Études d'hypertrophie en autorégulation de la charge : Hickmott 2022 (H06-08) dit qu'une seule étude a mesuré l'hypertrophie ; je n'en ai pas trouvé d'autre.
- Prise de position ou mise à jour de l'ACSM plus récente que 2009 sur la progression : non trouvée ; une page PMC12965823 apparue dans les résultats de recherche (sur la requête ACSM) n'a pas pu être ouverte : accès refusé aux robots, titre et contenu inconnus [non lue].


### Non trouvé / non lu / doutes / écarté

- **Double progression** comme méthode nommée : aucune étude trouvée ; écrite « pratique courante, non démontrée » (H06-02).
- **Tempo** comme forme de surcharge progressive : aucune source lue.
- **Simplicité de saisie sur téléphone** : aucune source ne compare les méthodes ; c'est un jugement de conception, hors preuve (H06-14).
- **Nombre d'exercices par muscle** : aucune source lue ne le fixe ; seule la revue sur la variation (H07-15) et l'ACSM (1 à 3 séries par exercice, H06-04) s'en approchent.
- **Pallarés et coll. 2021** : retrouvé après plusieurs requêtes Crossref (la piste ne donnait que la revue et l'année), résumé lu ; le nombre de participants n'est pas dans le résumé. **Kassiano et coll. 2022 (« not all ROMs lead to Rome », Scand J Med Sci Sports, DOI 10.1111/sms.14121)** : notice Crossref vue seulement, non lue, non citée.
- **Maeo et coll. (ischio-jambiers)** : DOI trouvé via Crossref avec la date de mise en ligne (2 octobre 2020) ; la date d'impression n'a pas été vérifiée.
- **Valeurs des tableaux de Nuzzo 2023** (répétitions moyennes à chaque %1RM) : page Springer non lisible (erreur du serveur), seul le résumé a été lu ; aucune valeur n'est donc donnée.
- **Wolf 2023 (amplitude)** : nombre d'études et de participants absents de la page lue. **Simão 2012** : DOI et effectifs non affichés. **Nunes 2021** : effectif de participants non lu.
- **Hernández-Belmonte 2022** : année et DOI non affichés sur la page lue (année déduite du volume 36 de la revue).
- **Mann 2010** : le résumé lu donne les gains de force dans une unité incohérente (« N ») ; seuls les p sont repris.
- **Europe PMC, OpenAlex et Crossref** ont renvoyé plusieurs fois une limite de débit (HTTP 429) ; j'ai espacé les requêtes et je n'ai pas insisté sur les pages refusées. **PubMed et PMC** : accès refusé aux robots (non contourné). Les pages d'éditeur Taylor & Francis et Lippincott (via doi.org) n'ont pas pu être lues (erreur du serveur ou accès refusé aux robots) : les résumés correspondants viennent de Crossref (champ `abstract`) ou d'Europe PMC. Thieme (doi.org) : accès refusé aux robots, résumé lu via Crossref.
- **Quota de recherche** : 14 recherches web utilisées (le maximum) ; la suite du travail a reposé sur WebFetch de pages ou de métadonnées dont j'avais vu l'adresse.
- **Écarté** : un préprint arXiv de 2026 d'un éditeur d'application (formule d'estimation du 1RM) trouvé dans les résultats : source commerciale, hors sujet, non utilisée. Aucune source lue ne mentionnait de produit dopant ni de prescription médicale ; rien à écarter à ce titre.


---

## Techniques avancées et cardio (H08, H11)


### Pistes non confirmées

- **Essai « Myo-Reps contre séries classiques » (Bradshaw et coll., J Strength Cond Res, mai 2026).** Connu seulement par trois pages de blog (StrengthLog, Biolayne, Menno Henselmans) ; la page de l'éditeur n'a pas pu être lue. D'après ces blogs : hommes entraînés, 8 semaines, développé couché et pectoraux ; gains de force et d'hypertrophie similaires entre groupes ; volume-charge plus bas et séances plus courtes avec les myo-reps. Les pourcentages circulant sur un blog ne sont pas repris ici. À lire sur l'étude avant tout usage.
- **Mention par StrengthLog de la revue SCJ 2025** (« la recherche soutient le repos-pause », quelques études suggérant un avantage mais avec des défauts de méthode) : connue uniquement de seconde main ; le résumé que j'ai lu de cette revue ne dit pas cela.
- **Fink et coll. (série dégressive unique, MRI, 6 semaines), Angleri, Enes, Ozaki, Varović, Robbins, Wallace, Paz, Weakley (supersets, tri-sets)** : lus uniquement à travers les tableaux et textes des revues de Sødal, Coleman, Krzysztofik et Zhang ; les études d'origine n'ont pas été lues.
- **Recommandations pratiques de Murach et Bagley 2016** : seul un résumé paraphrasé a pu être lu ; une copie PDF hébergée sur un site personnel est apparue dans les résultats de recherche mais n'a pas été consultée (statut de diffusion incertain).


### Non trouvé / non lu / doutes / écarté

- **Pistes de mémoire de l'auteur du dossier non retrouvées ou non lues** : Schoenfeld et Grgic 2018 (séries dégressives, Strength and Conditioning Journal), Giessing et coll. 2016, Robbins et coll. 2010, Paz et coll. 2017-2019, Iversen et coll. 2021, Fink et coll. 2018 : aucune de ces sources n'a pu être ouverte (limite de débit d'Europe PMC, voir ci-dessous) ; elles ne sont pas citées comme lues. Wilson 2012, Murach et Bagley 2016 et Fyfe 2014 ont été retrouvées et lues (résumés).
- **Limites techniques** : 14 recherches sur 14 consommées. L'API Europe PMC a répondu « 429 » (limite de débit) à plusieurs requêtes (recherche par DOI de Schumann, recherche « rest-pause », deux recherches Fink, Fyfe, Iversen) ; deux autres requêtes ont abouti (Tsartsapakis 2026, Schoenfeld 2015). Pages PMC (PMC12922048, PMC12011898, PMC5407958) : contrôle anti-robot ; non insisté. Pages éditeur en erreur : Springer (Fyfe), LWW (Bradshaw 2026, revue SCJ 2025), Springer Medicine (JavaScript requis). Textes intégraux non lus (résumés seuls) : Wilson 2012, Murach et Bagley 2016, Fyfe 2014, Helms 2015, Coffey et Hawley 2017, Prestes 2019, Wolf 2023, Schoenfeld 2015.
- **Valeurs affichées de façon inhabituelle** : l'intervalle de Sødal (SMD 0,555, IC 0,357–0,921) et celui de Schumann pour l'hypertrophie (SMD −0,01, IC −0,16 à 0,18) ne sont pas centrés sur leur estimation ; ils sont reproduits tels qu'affichés par les pages lues (possible coquille de l'éditeur ou de la page).
- **Chiffres issus d'un résumé automatique de page** : toutes les valeurs ont été relues par requêtes ciblées (phrase exacte demandée) ; le nombre de participants de Coleman n'est pas affiché par la page (la somme des effectifs par étude n'est pas retenue).
- **Non trouvé** : (a) essai de myo-reps lu ; (b) coût en fatigue (douleur musculaire, récupération, volume réel) des séries dégressives, du repos-pause et des répétitions partielles dans les résumés lus ; (c) résultats chez les débutants stricts et les femmes séparément pour toute technique avancée ; (d) quantité de cardio compatible avec l'hypertrophie ; (e) essai chronique sur les séries géantes ; (f) DOI de Murach et Bagley 2016, de Prestes 2019 et de Helms 2015 sur les pages lues.
- **Hors champ écarté** : aucune source lue ne mentionne de produit dopant. La nutrition n'est évoquée qu'en contexte (cardio à jeun, H11-09), sans plan ni dosage.


---

## Déload, périodisation, phases (H09, H10)


### Pistes non confirmées

- **Pancar Z, Ilhan MT, Darendeli MK et coll., Sci Rep 16:10299, 2026** (titre donné par la page de vulgarisation : « Effects of deload periods in resistance training on muscle hypertrophy and strength endurance in untrained young men using a randomized within subject design ») : connu seulement par un résumé de vulgarisation (https://sci-sport.com/en/active-deload-in-strength-training-does-temporarily-reducing-volume-hinder-progress-270/, consulté le 18/10/2026) ; étude originale non retrouvée, donc statut [extrait]. D'après ce résumé : essai en intra-sujet, 19 jeunes hommes non entraînés, 8 semaines, deux semaines allégées (une séance de 2 séries par exercice au lieu de deux séances de 6 à 8 séries), aucune différence significative sur l'épaisseur musculaire ni sur l'endurance de force. À lire dans la source avant tout usage ; aucun chiffre n'est repris dans les tableaux.
- **Essai clinique enregistré NCT06825052** (« Effects of Deloading Periods in Resistance Training on Muscular Strength and Hypertrophy ») : titre vu dans un résultat de recherche (https://clinicaltrials.gov/study/NCT06825052) ; page non ouverte, résultats inconnus.
- **Position stand de l'IUSCA (Schoenfeld et coll. 2021)** : seul le résumé a été lu ; ses recommandations sur la périodisation, le déload et la phase de préparation n'ont pas été lues.
- **Texte complet de la position stand ACSM 2026** : les nuances (par critère, force, hypertrophie, population) ne sont connues que par l'infographie et le communiqué.
- **Détails de Helms 2015** (fréquence, répétitions, « 40-70 répétitions » par muscle et par séance) : connus par un résumé relayé par un site tiers (texte complet payant, non lu) ; ils figurent dans H10-06 et H10-07 avec ce statut, à vérifier dans le texte complet avant usage.


### Non trouvé / non lu / doutes / écarté

**Non trouvé**
- **Durée usuelle d'un mésocycle** : aucune source lue ne la donne ; le Delphi (Bell 2023) n'a pas d'énoncé sur sa durée. L'intervalle entre déloads (4 à 6 semaines, H09-12) laisse supposer des blocs de cet ordre : c'est une déduction du documentaliste, non une valeur de source.
- **Périodisation par blocs** : aucune méta-analyse lue ; seule mention dans Helms 2015 (H09-09). La recherche d'une revue dédiée n'a pas été faite faute de budget de recherche.
- **Pourcentage de réduction et durée du déload dans le Delphi** : absents du texte rendu ; les chiffres viennent de l'enquête auprès des 18 entraîneurs.
- **Essai comparant une réduction de volume à un arrêt complet** : non trouvé dans les sources lues (Coleman 2024 teste l'arrêt complet ; l'essai de Pancar 2026 est en pistes).
- **Entraînement propre à la prise de masse** : aucune source lue ne le décrit ; seul le repère général de l'ACSM 2026 (H10-12).
- **Reprise de la progression après une sèche** : aucune source lue. Les essais lus sur le maintien (Bickel 2011) et sur l'arrêt d'une semaine (Coleman 2024) ne portent pas sur une reprise après déficit énergétique. Une recherche d'essais d'entraînement en pauses périodiques a été bloquée par la limite de débit d'Europe PMC (erreur 429) et n'a pas abouti.
- **Dose minimale pour maintenir chez les personnes entraînées en hypertrophie** : insuffisante selon Spiering 2021 (H10-09).
- **Proportion d'entraîneurs utilisant des déloads** : non rapportée par Bell 2022.

**Non lu ou refusé**
- Texte complet de la position stand ACSM (journals.lww.com) : échec de chargement ; non lue.
- PDF mediaTUM de Murphy et Koehler : page de blocage anti-robots (Anubis), non contournée ; le résumé a été lu sur le portail de l'université (H10-01 à H10-03).
- springermedicine.com (Williams 2017) : page de contrôle JavaScript sans contenu ; la notice Europe PMC a servi à la place.
- Plusieurs appels à Europe PMC, OpenAlex et Crossref ont reçu des refus de limite de débit (429) ou des erreurs de chargement ; aucun contournement tenté. Les adresses DOI directes de l'IUSCA (doi.org, DOAJ) ont aussi échoué.
- Helms, Aragon, Fitschen 2014 (JISSN) : lu sur 100 000 caractères sur 107 984 ; l'en-tête (titre, auteurs, DOI, date) n'apparaît pas dans la page rendue (les auteurs viennent du résultat de recherche) ; l'article **ne donne pas de recommandations d'entraînement** (il indique qu'il se concentre sur la nutrition et renvoie à la méthodologie d'entraînement) : il n'est donc cité dans aucun tableau. Il relie seulement le maintien de la performance à une meilleure rétention de masse maigre.

**Doutes sur les données**
- Grgic 2017 : la page indique n = 417 au total et « 303 participants » dans les groupes LP ou DUP sans lever l'ambiguïté ; un sous-groupe « études de plus de 11 semaines » porte un IC qui ne contient pas son estimation ponctuelle : non repris.
- Coleman 2024 : les intervalles de la discussion diffèrent de ceux du tableau 3 sur les mêmes critères ; ceux du tableau et du résumé sont repris. Les « 90 séries par semaine » viennent de la discussion de l'article.
- Roth 2022 : les résultats citent deux études de femmes avec perte de masse maigre, la discussion en cite trois.
- Murphy et Koehler 2022 : la page du portail affiche aussi une date en ligne de 2023 dans ses métadonnées ; l'année retenue est 2022 (volume 32, numéro 1).
- Harries 2015, Barakat 2020, Grgic 2017, Coleman 2024, S&S 2018 : auteurs complets non affichés sur les pages lues (les titres sont ceux de ces pages).
- Bell 2022 : la proportion d'accord par énoncé n'existe pas (enquête qualitative) ; les « 30 à 50 % » viennent de ses lignes directrices pratiques (tableau 3), les « plus de 50 % » d'entretiens.

**Écarté**
- **Dopage** : aucune source lue ne suppose un produit dopant ; Helms 2014 indique que son propos concerne des compétiteurs « naturels » et omet les substances interdites (rien à écarter).
- **Nutrition chiffrée** : non reproduite. Le résumé de Murphy et Koehler cite un seuil de déficit calorique journalier ; il n'est pas repris (H10-03). Aucun plan alimentaire, apport en protéines ou glucides, ni complément n'est cité. La nutrition n'apparaît que comme contexte (« en déficit énergétique »).
- **Source non ouverte** : un PDF de Williams 2017 hébergé sur un site tiers (fisiologiadelejercicio.com) a été vu dans les résultats de recherche et n'a pas été ouvert (provenance de la copie incertaine).


---

## Niveau, sexe, âge, reprise (H12, H13)


### Pistes non confirmées

- « Classification and Determination Model of Resistance Training Status » (titre vu dans un résultat de recherche, lien ResearchGate) : pourrait donner des critères d'années ou de force pour débutant, intermédiaire, avancé. Non ouverte, aucun chiffre retenu. [extrait]
- Études citées par l'article de blog H13-08 et non lues : Staron et coll. 1991 (détraînement et réentraînement chez des femmes, J Appl Physiol), Kadi et coll. 2004 (cellules satellites, J Physiol), Blazevich et coll. 2007 (J Appl Physiol), Murach et coll. 2019 (analyse secondaire sur la mémoire musculaire, J Appl Physiol). [extrait, via une liste de références]
- Résultats de la recherche « sexe et récupération entre séries » non ouverts : article de Thieme (DOI 10.1055/a-2563-9449, Int J Sports Med) et page MDPI (https://mdpi.com/2673-7078/6/1/5) ; leur contenu est inconnu. [extrait]
- Prise de position NSCA 2019 sur les adultes âgés (H12, Fragala et coll.) : le texte intégral est sous abonnement ; les repères de programmation (séries, répétitions, charge, fréquence, repos) qu'il contient sont inconnus.
- Valeur « force restée élevée d'environ 60 % » dans le résumé de Psilander 2019 : voir « doutes » ci-dessous, non retenue dans les tableaux.


### Non trouvé / non lu / doutes / écarté

**Non trouvé**
- Vitesse de progression selon le niveau (par exemple pourcentage de masse ou de force gagné par mois ou par an chez débutants, intermédiaires, avancés) : aucune source lue ne la chiffre ; seule la règle de hausse de charge de 2 à 10 % de l'ACSM est disponible (H12-02).
- Définition chiffrée de « débutant, intermédiaire, avancé » propre à la musculation (années, ratios de force) : non lue (le texte intégral de l'ACSM 2009 n'a pas été ouvert, voir ci-dessous ; seul un cadre général de sport a été lu, H12-06).
- Séries hebdomadaires par muscle selon le niveau, le sexe ou l'âge : aucune valeur lue (Currier 2023 ne donne pas de nombre de séries par prescription dans la page lue ; Grgic 2020 et Hagstrom 2020 ne donnent pas de nombre de séries dans les résumés lus).
- Volume de départ, charge de départ et durée de montée en charge à la reprise après une pause, issus d'une étude : non trouvé ; seul un blog (H13-08) en propose.
- Exercices alternatifs pendant une blessure, dans une source publique générale lue : non trouvé ; seules des données sur le membre controlatéral (H13-10) et sur la progressivité (H13-09) ont été lues.
- Mujika et Padilla, partie II (arrêts de plus de 4 semaines) et « Muscular characteristics of detraining in humans » : non localisés dans les résultats lus.
- Participants totaux de Roberts 2020, Hagstrom 2020, Borde 2015, Bosquet 2013 : non présents dans les pages lues.

**Non lu / limites techniques**
- ACSM 2009 : seul le résumé (Europe PMC) a été lu ; les tentatives d'accès au texte intégral (doi.org, journals.lww.com) ont échoué. Je n'ai pas utilisé les copies de l'article hébergées sur des sites de cours ou de chercheurs (droits incertains).
- NSCA 2019 (Fragala) : texte intégral sous abonnement, résumé sans chiffres de programmation. [non lue pour le texte]
- Psilander 2019 : l'accès à la copie du portail suédois a été refusé par le fichier robots (non contourné) ; lu via le dépôt de l'institut norvégien (version acceptée).
- Plusieurs requêtes Europe PMC ont reçu des refus de débit (HTTP 429) ; elles ont été reprises par d'autres voies ou abandonnées. Quota de 14 recherches web entièrement utilisé.
- Les pages ont été lues par un petit modèle de résumé de WebFetch ; les chiffres retenus viennent de ses extraits explicites de la page, mais les tailles d'effet et intervalles sont à revérifier dans les articles avant toute publication.
- Lundberg 2024 : lu sur une copie miroir d'une bibliothèque de l'article en libre accès.
- Soligard 2016 : année et DOI non affichés sur la page lue ; l'année 2016 se déduit du numéro de volume (50) et de la période de recherche décrite (jusqu'à juin 2016).

**Doutes**
- Psilander 2019 : le résumé indique que la force « reste élevée (~60 %) » après 20 semaines d'arrêt, alors que le gain de force à l'entraînement est donné à environ 20 % ; le critère exact n'est pas lisible dans le résumé, d'où l'exclusion de ce chiffre des tableaux.
- Currier 2023 : le seuil de « charge élevée » est écrit « > 80 % du 1RM » dans le résumé et « ≥ 80 % » dans les méthodes (non utilisé ici).
- Roberts 2020 : le type de taille d'effet n'est pas nommé dans le résumé, le signe négatif des tailles d'effet de force désigne l'avantage des femmes d'après le résumé.
- Hagstrom 2020 : participants totaux, charge ou intensité et statut d'entraînement comme modérateurs non lus.

**Écarté**
- Pathologie : méta-analyse sur la préhension chez des personnes âgées sarcopéniques (Li 2025, Frontiers in Physiology, DOI 10.3389/fphys.2025.1564988) ; les sections de la prise de position NSCA 2019 sur la fragilité, la sarcopénie et les maladies chroniques (d'après le résumé) ; une mention d'aggravation d'arthrose chez une personne dans Grgic 2020.
- Hors sujet entraînement musculaire : effets du désentraînement sur la composition corporelle et la santé cardiométabolique (Zhang 2026, vu en extrait seulement).
- Thèse de master non publiée sur la mémoire musculaire (Tiainen 2024, dépôt de l'université de Jyväskylä) : lue, non retenue (hors critères de niveau de preuve).
- Reprise après blessure : diagnostic, rééducation, critères de retour au sport médicalisés : hors champ, non développés.
- Produits dopants : aucune source lue n'en parle.


---

## PPL et autres découpages (D01, D02, D06)


### Pistes non confirmées

- **Heke 2010 et Crewther 2016** (corps entier 3 fois par semaine contre « bro split » ou haut/bas), rapportés par Henselmans (05/01/2019) comme donnant plus de masse maigre sans différence significative : non lus, aucun chiffre retenu.
- **« Environ +20 % de croissance musculaire par passage hebdomadaire supplémentaire »** (analyse attribuée à Nuckols) et **« 5 à 25 % de travail en plus à fréquence plus élevée »** : cités sur la page Henselmans du 05/01/2019, que l'auteur dit lui-même à confirmer ; non lus à la source.
- **Étude Frontiers in Physiology / PMC8766679** (« Equal-Volume Strength Training With Different Training Frequencies… ») : titre vu dans un résultat de recherche, ni résumé ni auteurs lus ; à lire (PubMed et PMC refusent les robots, Europe PMC a répondu par un refus temporaire HTTP 429).
- **Dankel et coll. 2017** (Sports Medicine) : référence confirmée par OpenAlex mais résumé absent ; contenu non connu.
- **Brigatto et coll. 2019** (JSCR, fréquence et morphologie musculaire après 8 semaines chez des hommes entraînés) : vu comme titre de PDF dans un résultat de recherche, non lu.
- **Affirmations de pages de programmes** : « bras et épaules reçoivent 2 à 3 stimulations » (Bro Split, Liftosaur) ; « PHUL : chaque grand groupe environ deux fois par semaine » (Hevy) ; « 48 heures de synthèse protéique » évoquées sur la page PHAT sans étude citée.
- **Résumé de congrès de Raastad et coll. (2012)** : connu seulement par le blog Stronger By Science (16 powerlifteurs, 6 contre 3 séances) ; non lu, non publié par les pairs selon le blog.


### Non trouvé / non lu / doutes / écarté

- **Non trouvé** : aucune étude ni méta-analyse qui compare le **PPL** à un autre découpage ; aucun essai sur le **PPL 3 jours** ni **6 jours** ; aucune mesure de **récupération** (marqueurs de dommage, force, performance) pour un PPL 6 jours ; aucune source pour **torse / jambes** ; aucune étude sur **torse / membres** ; aucune description sourcée d'un hybride « haut/bas + poussée/tirage/jambes » en 5 jours ; **fourchettes de répétitions** de PHUL et PHAT (les pages lues n'en donnent pas) ; `ciblesParMuscle` propre à chaque découpage (seul ordre de grandeur : environ 10 séries par groupe, ACSM 2026, sans plage).
- **Non lu** : texte intégral de la prise de position ACSM 2026 (pages d'annonce et infographie seulement) ; page Muscle & Strength de PHUL (erreur de chargement) ; fil Reddit d'origine de Metallicadpa (Reddit refuse les robots, non tenté) ; articles d'origine de PHAT ; Dankel 2017 ; Brigatto 2019 ; PMC8766679 ; résumé de congrès de Raastad. Pages T Nation « best workout split » : l'adresse a renvoyé un index de forum sans article (ni contenu ni citation retenus).
- **Limites techniques constatées** : quota de **14 recherches WebSearch épuisé** ; plusieurs requêtes Europe PMC ont reçu un refus temporaire (HTTP 429) ; je me suis rabattu sur OpenAlex, des fiches de bases bibliographiques (sponet.de) et des dépôts institutionnels ; **résumés reconstruits** (OpenAlex) pour Gomes, Zaroni et Yang : les chiffres cités sont ceux que la page a restitués, à vérifier avant tout usage en production. La lecture de Schoenfeld 2016 est ambiguë sur le volume équivalent et les sous-analyses par groupe : seuls les chiffres cités textuellement sont retenus.
- **Incohérences dans les pages lues** : Bartolomei 2021 (développé-couché isocinétique : +11,5 % puis +12,9 % pour le corps entier) ; Zaroni (année 2018 ou 2019 et numéro 1 ou 7S ; phrase de conclusion peu cohérente avec le résultat, non reprise) ; Gomes (2018 en ligne, 2019 en supplément ; nombre de séances par semaine non confirmé) ; Raastad (12 ou 15 semaines selon la phrase de la page) ; PHUL (au moins un an ou 6 à 18 mois d'expérience) ; Bro Split Liftosaur (6 mois et plus ou 3 à 12 mois).
- **Doute signalé par une source** : la page Henselmans du 22/07/2025 évoque de possibles fraudes de données dans certaines études brésiliennes et appelle à une nouvelle méta-analyse ; la page ne désigne pas d'étude précise, et **aucune source lue ne met en cause nommément l'un des essais cités ici** (la fiche de Gomes et coll. indique seulement une affiliation brésilienne ; l'affiliation des autres auteurs n'a pas été vue). À traiter comme un doute général, non comme un fait.
- **Écarté** : **aucun programme écarté pour dopage** (aucune source lue ne le dit). Précaution sur l'enquête Hackett 2022 (D06-02) : échantillon incluant des produits dopants, utilisée seulement pour décrire la fréquence des découpages. Deux autres études de compétiteurs vues dans les résultats Europe PMC (période de pic, humeur) n'ont pas été utilisées. Aucune nutrition chiffrée ni prescription médicale reprise.
- **Programmes commerciaux** : aucune reproduction ; seules des structures en une ligne.


---

## Haut/Bas, Full body, comparaisons (D03, D04, D05, D07)


### Pistes non confirmées

- **Dankel et coll. 2017** (lu : résumé, aucun chiffre) : article d'opinion qui émet l'hypothèse qu'augmenter la fréquence, plutôt que les séries par séance, pourrait aider les entraînés une fois un seuil de volume par séance dépassé. Aucun essai testé dans le résumé (aucune comparaison à volume égal) ; à ne pas utiliser comme preuve.
- **Étude « push/pull contre upper/upper » de 8 semaines** : mentionnée sans auteur, année ni revue dans un billet de blog (Menno Henselmans, « 3 Sweet new studies to maximize your gains », 10/02/2026, https://mennohenselmans.com/3-sweet-new-studies-to-maximize-your-gains/ [lu : texte]) ; selon le billet, aucune différence de croissance ni de force entre les deux répartitions. Étude non identifiée, donc sans chiffre ici. Le même billet cite une étude non identifiée sur un volume de bras réparti sur 1 ou 3 jours (pas de différence à volume égal).
- **Titres vus seulement dans des résultats de recherche** (extraits, non lus) : « Push Pull Legs vs Upper Lower: Which Split Is Better? (Data Analysis) » (arvo.guru, analyse de données d'une application) ; un programme minimaliste de Jeff Nippard décrit par Fitness Volt. Aucun chiffre repris.
- **Références à rechercher** (pistes de la consigne, non lues faute d'accès : Europe PMC a refusé par limitation de débit, HTTP 429, à de nombreuses reprises) : Thomas et Burns 2016 (haute contre basse fréquence) ; Zaroni et coll. 2019 ; Colquhoun et coll. 2018 ; Grgic et coll. 2018 (fréquence et force) ; Ralston et coll. 2017 (volume hebdomadaire et force : la page Springer lue n'affichait ni titre ni auteurs, donc non retenue) ; Androulakis-Korakakis et coll. 2020 (dose minimale efficace en force). Les noms et années viennent de la consigne ou de la mémoire du pilote.
- **NSCA, « Training Volume and Hypertrophy – An Evidence-Based Approach for Personal Trainers »** (Personal Training Quarterly, avril 2026) : corps de l'article payant, liste de références seule visible ; citée dans « Non trouvé ». Elle mentionne des références « Pelland 2024 », « Remmert 2025 », « Brigatto 2022 » dont le contenu n'est pas lu.


### Non trouvé / non lu / doutes / écarté

- **Essai direct Haut/Bas contre PPL** : aucun trouvé (une recherche dédiée et la lecture d'un billet de blog ; aucun essai identifié). Le découpage Haut/Bas n'est donc documenté que par l'ACSM 2009 (fréquence), les essais sur la fréquence et des programmes publics.
- **Délai de récupération entre deux séances d'un même muscle (en heures)** : non trouvé. L'ACSM 2009 n'en donne pas ; la seule mention est une annonce de l'auteur d'un programme (3 à 4 jours de repos entre séances de la même région, StrengthLog Haut/Bas).
- **Muscles par séance pour les 18 muscles de Cyclades** : non traité (non connus). Pour le Haut/Bas, la liste vient de la page StrengthLog ; pour Weightology, les muscles sont déduits des exercices par le lecteur de la page ; pour les full body, les pages donnent des mouvements, pas des muscles.
- **Pages illisibles ou refusées** : texte intégral de l'ACSM 2026 (journals.lww.com, erreur) ; Taylor & Francis (Schoenfeld 2019, erreur) ; ACSM 2009 sur journals.lww.com (erreur, lu via copie sfu.ca) ; PDF de l'OMS 2020 (erreur, fiche BIGG-REC lue) et page BJSM de l'OMS (erreur) ; Springer 10.1007/s40279-018-0872-x (erreur, DOI non vérifié) ; Springer 10.1007/s40279-017-0762-7 (texte sans titre ni auteurs, non retenu) ; muscleandstrength.com (erreur) ; plusieurs requêtes Europe PMC et doi.org refusées par limitation de débit (HTTP 429). PubMed et PMC non interrogés (refus des robots).
- **Auteurs non affichés** : essai de 2015 (JSCR 29(7)) et revue narrative de 2021 (Sports Med 51) lus sur des notices qui n'affichent pas les auteurs ; l'attribution à Schoenfeld et coll. (2015) et à Iversen et coll. (2021) vient de la consigne et n'a pas été confirmée ; Weightology, StrongLifts et Starting Strength : auteur non nommé dans les pages lues.
- **ACSM 2026** : le communiqué annonce « 137 revues systématiques » (Newswise) ou « plus de 137 études » (fiche Science Spotlight) ; la prise de position est une « overview of reviews », donc le nombre de revues paraît le bon, mais le texte intégral n'est pas lu. Aucune recommandation par niveau ni full body contre split n'est lisible dans les communiqués.
- **Pelland et coll. 2024** : prépublication ; aucune version publiée signalée sur la page lue (non cherchée ailleurs). L'unité de la « pente marginale » n'est pas précisée dans l'extrait lu.
- **Bartolomei 2021** : le texte donne +11,5 % (Résultats) et +12,9 % (Conclusion) pour la même mesure ; les deux sont notés.
- **Schoenfeld 2016 et 2019** : l'effectif total de participants n'est pas affiché dans les résumés lus.
- **Dopage** : aucune des pages de programmes lues (PHUL, StrengthLog, Weightology, Fitness Volt, Starting Strength, StrongLifts, r/Fitness) ne mentionne de produit dopant ni n'en suppose l'usage ; aucun programme écarté pour ce motif. Programmes du dossier : structure seulement, ni texte ni tableaux ni charges recopiés.
- **Hors champ** : aucune prescription médicale ni nutrition chiffrée. Le seul ordre de grandeur de volume « 4 séries », « 10 séries », « 12 séries » est un volume d'entraînement, pas un apport alimentaire.
- **Calculs du documentaliste** (signalés dans les lignes concernées) : environ 5 séries par séance pour 10 séries sur 2 séances (D04-07) et environ 3 à 4 séries par séance pour 10 séries sur 3 séances (fiche D05). Ils ne figurent dans aucune source.
- **Quota** : 14 recherches web sur 14 utilisées ; le reste par lecture directe de pages.
