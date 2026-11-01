#!/usr/bin/env node
/**
 * La batterie complète, ou le socle seul : les essais dans l'ordre, et un verdict.
 *
 *   npm run batterie   # tout ce qui commence par « essais » — 329 au 26 octobre
 *   npm run socle      # les 40 transversaux, 18 minutes mesurées le 26 octobre
 *
 * CES DEUX NOMBRES SE PÉRIMENT, ET ILS SE SONT PÉRIMÉS DEUX FOIS. Cette ligne
 * annonçait « les 235 » et « les seize transversaux, onze minutes » alors que
 * la batterie en découvrait 315 et que le socle en comptait 31 ; corrigée le
 * 25 octobre à 316 et 32, elle était de nouveau fausse le 26 — 328 et 39 —
 * parce que sept essais transversaux se sont ajoutés entre-temps. Un en-tête
 * qui chiffre ce qu'il ne compte pas mentira donc encore : le vrai compte est
 * imprimé par la commande elle-même au début de chaque passage, c'est lui qui
 * fait foi, et c'est là qu'il faut le lire. Les chiffres ci-dessus portent
 * leur date pour qu'on sache ce qu'ils valent.
 *
 * La durée, elle, est de nouveau écrite — mais MESURÉE, et datée : dix-huit
 * minutes le 26 octobre, pour trente-neuf essais, dont quatre de navigateur
 * qui prennent à eux seuls dix minutes. « Onze minutes » avait traîné depuis
 * l'époque des seize essais, et mieux vaut pas de chiffre qu'un chiffre faux :
 * si celui-ci perd sa date, qu'on l'efface plutôt que de le croire.
 *
 * ## Pourquoi cette commande existe
 *
 * La règle de travail est « batterie complète avant chaque poussée et avant
 * chaque fusion ». Tant que la batterie n'était qu'une boucle shell écrite à
 * la main dans un dossier temporaire, elle n'était ni reproductible ni
 * vérifiable : deux lancements pouvaient ne pas couvrir les mêmes essais, et
 * personne ne pouvait relire ce qui avait tourné.
 *
 * ## Ce qu'elle refuse de faire
 *
 * Elle ne lance rien si les conditions d'un verdict honnête ne sont pas
 * réunies, et elle le dit au lieu de rendre des rouges qui n'en sont pas :
 *
 * - sans `SITE_PASSWORD`, les essais de navigateur ne peuvent pas
 *   déverrouiller le site : tous seraient rouges, pour une raison qui
 *   n'appartient pas au site ;
 * - sans aperçu servant `localhost:4321`, ils n'ont rien à visiter — et un
 *   aperçu d'un AUTRE répertoire de travail répondrait quand même, ce qui
 *   mesurerait un autre site que celui qu'on croit. L'adresse est donc
 *   affichée, et c'est à l'appelant de savoir ce qu'elle sert.
 *
 * Elle ne décide pas non plus si un rouge est acceptable : elle les nomme,
 * et la comparaison au tableau des anomalies reste un geste humain.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync as lireFichier,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  CODE_NON_MESURABLE,
  estNonMesurable,
  raisonNonMesurable,
} from './lib/non-mesurable.mjs';
import { motDePasseEssais } from './lib/mot-de-passe-essais.mjs';

const ADRESSE = process.env.RACINE ?? 'http://localhost:4321';
const DELAI_MS = Number(process.env.BATTERIE_DELAI_MS ?? 500_000);

const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {};

/**
 * LE SOCLE — les essais transversaux, à passer avant chaque poussée.
 *
 * La batterie complète demande une demi-heure quand elle se reprend, et
 * quatre heures quand elle repart de zéro. La faire tourner avant chaque
 * poussée coûterait plus que ce qu'elle garde : elle se lance donc à la fin
 * de chaque prompt, avant chaque fusion de branche et avant le lancement des
 * agents. Entre deux, c'est ce socle, avec « astro check » et les essais du
 * périmètre touché.
 *
 * Le socle ne remplace pas la batterie : il attrape ce qu'une modification
 * locale casse AILLEURS, et c'est le seul genre de dégât qu'on ne voit pas
 * en relisant son propre diff. Chaque ligne porte donc ce qu'elle garde, et
 * la liste se lit — elle ne s'allonge pas par réflexe.
 */
const SOCLE = [
  ['essais:structure', 'un titre de niveau 1 par écran, un titre d’onglet unique'],
  ['essais:espaces', 'aucun mot collé à une balise en ligne, dans le site construit'],
  ['essais:mots-colles:navigateur', 'les mêmes, mesurés dans la page vivante'],
  /*
     LA DESCRIPTION PROMETTAIT TROIS CHOSES, L'ESSAI N'EN TENAIT QU'UNE.

     Elle annonçait « apostrophes, espaces insécables, accords sans "(s)" ».
     L'essai éprouve la seule fonction « insecables », sur onze cas, et ne
     regarde aucune page : ni les apostrophes, ni les accords.

     Le constat a été fait DEUX FOIS ce jour-là, de deux côtés, et la fusion
     des deux versions a montré les deux moitiés d'une même chose. L'autre
     relevé disait pourquoi cela coûtait : « c'est ainsi que quatre phrases de
     progression.astro ont porté des "(s)" sous un socle vert ». Le mien
     disait que j'avais failli écrire un second balayage, faute de savoir que
     le premier n'existait pas — la faute même que ce lot dénonce par
     ailleurs. Les deux sont gardés.

     Une description qui promet une garantie absente est pire qu'une absence
     de description : on croit le point couvert, et personne ne va voir.

     Les accords sans « (s) » sont désormais tenus, mais par « essais:accords »
     — qui les balaye, les compte, et refuse de mesurer quand son analyseur
     perd le fil. La ligne ci-dessous ne promet donc plus que ce qu'elle tient.
  */
  ['essais:typographie', 'ce que « insecables » pose, et ce qu’elle laisse tranquille'],
  /*
     0.1 DU 43 — le seul essai qui garde la copie de secours des paramètres
     publics, et le seul qui passe par `deverrouiller` sans réseau.
     `essais:hors-ligne-usage`, son voisin, déverrouille EN LIGNE puis coupe :
     il garde l'autre chemin, celui d'`obtenirCle`. Le défaut que celui-ci a
     trouvé laissait le bouton du verrou mort pour toujours, sans message —
     c'est-à-dire un site inutilisable hors ligne et sans recours.

     CETTE ENTRÉE A DISPARU UNE FOIS, ET C'EST LE COMPTE QUI L'A DIT. Elle
     vivait collée au commentaire de « typographie », donc DANS la région que
     le conflit suivant a redessinée ; prendre l'autre côté en bloc l'a
     emportée en silence. Rien ne l'aurait signalé : un essai retiré du socle
     ne rougit pas, il se taît. Le relevé d'après fusion — un grep par entrée
     attendue — l'a rendue visible.
  */
  ['essais:hors-ligne-a-froid', 'déverrouiller en mode avion, sans session, puis lire une donnée'],
  /*
     IL ENTRE AU SOCLE MAINTENANT, ET PAS PLUS TÔT — condition posée par le
     pilote le 31 octobre : « il entre au socle quand le compte est à 0, à la
     fin du lot 9 ».

     La raison de cette condition vaut d'être écrite, parce qu'elle ne va pas
     de soi. Un essai qui entre au socle en étant ROUGE rend le socle rouge, et
     un socle rouge en permanence cesse d'être lu : on apprend à passer outre,
     et le jour où il rougit pour une vraie raison, personne ne s'arrête. Le
     balayage a donc vécu hors du socle le temps du lot, pendant que le compte
     descendait de 246 sites dans 47 fichiers à zéro.

     Ce qu'il tient désormais : aucune forme parenthésée — « jour(s) » — dans
     une chaîne de `src/`, et aucun `toFixed` affiché qui ne déclare pourquoi
     il ne l'est pas. Et il REFUSE DE MESURER quand son analyseur perd le fil,
     plutôt que de rendre zéro : un analyseur cassé rend zéro, ce qui ressemble
     en tout point à un dépôt propre.
  */
  ['essais:accords', 'aucun « (s) » et aucun « toFixed » affiché dans « src/ » — et l’analyseur refuse de mesurer s’il perd le fil'],
  /*
     Deux garanties que n'importe quelle retouche du rendu Markdown peut
     défaire sans qu'on la voie : les 158 « $ » monétaires et les 100 ellipses
     « \[…\] » du contenu ne doivent jamais devenir des formules, et le HTML
     écrit à la main dans une fiche doit rester détruit — le rendu des
     mathématiques ouvre « allowDangerousHtml » sur la sortie, et c'est cet
     essai qui vérifie que la porte d'entrée, elle, est restée fermée.
  */
  ['essais:maths', 'le « $ » monétaire reste du texte, et le HTML d’auteur reste détruit'],
  /*
     H4 du prompt 43. Le catalogue d'icônes se tient par le typage et par le
     refus de « Icone.astro » — mais rien, dans le typage, ne relie
     « iconeDuGabarit('gabarit-alerte') » au fait que la page porte ce modèle :
     l'un est une chaîne dans un script, l'autre un élément du HTML. Déplacer
     le modèle et cinq écrans lèvent une erreur dans la console, là où
     personne ne regarde. Mesuré : le modèle retiré de la mise en page, l'essai
     nomme les quatre pages qui le réclament encore.
  */
  ['essais:icones', 'chaque page porte les modèles d’icône que ses scripts copient'],
  /*
     H4, la garde. Quatre-vingt-sept émojis sont partis ; rien n'empêchait le
     quatre-vingt-huitième. Un émoji s'écrit d'un caractère, s'affiche partout,
     et a l'air de marcher — ce qui le rend tenace : personne ne le refuse à la
     relecture. Ce qui est cassé ne se voit pas chez celui qui écrit — un dessin
     différent par plateforme, aucune réaction aux quatorze thèmes, rien à
     suivre en couleurs imposées, et un nom annoncé à voix haute avant chaque
     libellé. La garde laisse passer les MARQUES, qui sont du texte, et un essai
     le prouve dans les deux sens.
  */
  ['essais:pictogrammes', 'aucun émoji dans « src/ », et les marques passent'],
  /*
     Le palier de migration endormi. Une branche a posé un magasin au palier
     39 quand la version valait 42 : le numéro était libre, et pourtant
     inatteignable — « vers(n) » exige « ancienneVersion < n », et une base
     déjà à 42 ne rejoue rien. Le magasin aurait existé chez les nouveaux
     venus et JAMAIS chez les anciens, sans un mot. Et aucun essai n'aurait
     rougi : tous partent d'un profil neuf, qui va de zéro à la version
     courante et rejoue donc tout. La seule base qui révèle le défaut est une
     base ancienne, et aucun essai n'en a.
  */
  ['essais:migrations', 'aucun palier de migration ne dort sous la version publiée'],
  /*
     Le palier B-2. La clé du coffre est propre à l’appareil — le sel est tiré
     au sort à la première pose —, donc une entrée scellée partie d’ici est
     illisible en face. Dix-sept magasins étaient à la fois scellés et
     journalisés : leurs opérations partaient et arrivaient illisibles, rendant
     du même coup illisibles les données LOCALES de celui qui reçoit. Le refus
     est posé au seul point d’étranglement, et cette garde tient qu’il y reste
     tant que la clé n’est pas partagée.
  */
  ['essais:palier-scelles', 'aucun magasin scellé ne part tant que la clé n’est pas partagée'],
  /*
     La table « Peser chaque rubrique » affichait soixante-quinze noms
     techniques, dans un écran dont le but est de décider quoi garder. Les
     étiquettes françaises se défont de trois façons : un magasin ajouté sans
     étiquette — le refus à la construction l'attrape, s'il est encore là —,
     une étiquette laissée derrière un magasin disparu, et une étiquette qui
     recopie l'identifiant, ce qui satisfait la couverture sans rien corriger.
     Les trois sont tenues ici.
  */
  ['essais:intitules-magasins', 'chaque rubrique de données a un nom français'],
  /*
     Les deux réglages d'accessibilité du système. Ils se défont sans bruit :
     il a suffi qu'une feuille de thème soit injectée APRÈS « global.css » pour
     que le relèvement des teintes faibles cesse d'agir, et rien ne le disait.
     L'essai ne déverrouille rien et coûte quelques secondes.
  */
  ['essais:contraste-impose', 'le contraste renforcé relève bien les teintes faibles'],
  ['essais:accessibilite:navigateur', 'rôles, noms accessibles, ordre de tabulation'],
  ['essais:mobile:navigateur', '360 px : aucun débordement, cibles atteignables'],
  /*
     L'AUTRE CÔTÉ DE LA MÉDAILLE, et il manquait.

     L'essai ci-dessus déclare « hasTouch » : sans cela, « pointer: coarse »
     est faux et les planchers du site ne s'appliquent pas. C'est juste, et
     c'est la moitié du sujet — il ne mesure donc QUE le pointeur grossier.
     Celui-ci mesure à la souris, où WCAG 2.5.8 demande toujours 24 px, et où
     64 cibles passaient dessous sur un seul écran. Le laisser hors du socle
     répéterait l'omission qu'il corrige.
  */
  ['essais:cibles-souris:navigateur', 'à la souris, aucune cible sous 24 px'],
  ['essais:mouvement-reduit', 'le réglage d’animations existe, et il est respecté'],
  /*
     LE DÉFILEMENT ET LES GRAPHIQUES, au socle depuis le 26 octobre.

     Les deux existaient et ne tournaient qu'à la batterie complète. Ils y
     entrent parce qu'ils gardent chacun une règle qu'une retouche défait sans
     bruit, et qu'ils ne coûtent rien : pas de navigateur, deux secondes.

     - `essais:defilement` tient l'invariant qu'AUCUN écran ne contourne le
       module : c'est la forme qu'on recopie en ajoutant un écran, et le
       relevé balaie les `.astro`, les `.ts` ET les `.svelte` — l'extension
       qui avait piégé le lot des voiles de dialogue.
     - `essais:graphiques` mesure les teintes des deux histogrammes sur leur
       fond, et vérifie que l'écran emploie BIEN celles qu'il mesure : une
       mesure sur une table que le code n'utilise plus ne mesure rien.

     Éprouvés avant de les inscrire, et pas seulement lus : cinq sabotages,
     cinq rouges nommés — un septième défilement « smooth » hors du module,
     la règle amputée du réglage de l'application, le trait d'objectif cessant
     d'être pointillé, une tranche changeant de teinte sans que la table
     bouge, et la ligne d'objectif poussée sous 3:1.
  */
  /*
     LES CURSEURS DU QUAD N-BACK, inscrits au socle le 31 octobre.

     L'essai existait et ne tournait DANS AUCUNE batterie : il était absent de ce
     fichier, donc il ne gardait rien — un essai qu'on ne lance pas est une
     garantie qu'on croit avoir. Relevé par le pilote sur mon propre lot.

     Il tient deux invariants que l'écran défait sans bruit : les neuf curseurs
     avancent d'UN cran au doigt comme au clavier — la délégation à `stepUp` et
     `stepDown` du navigateur, et non un calcul à la main qui redériverait la
     grille —, et le maximum du curseur de n est celui du MOTEUR, faute de quoi
     une partie montée par progression s'afficherait au plafond du curseur.
  */
  ['essais:curseurs-pas:navigateur', 'les neuf curseurs avancent d’un cran, et n monte jusqu’au moteur'],
  ['essais:defilement', 'aucun écran ne contourne le module de défilement'],
  ['essais:graphiques', 'les deux histogrammes : ligne tracée, tableau, 3:1'],
  /*
     LES ANCRES, au socle dès son premier jour (E3).

     La marge d'ancre est une seule déclaration, dans `global.css`, pour tout
     le site. C'est sa force — elle vaut pour les cibles qui n'existent pas
     encore — et c'est la raison de l'inscrire ici : une déclaration unique se
     retire par distraction, et il ne resterait RIEN. Avant elle, trois ancres
     sur cinq atterrissaient entièrement derrière l'en-tête, et le lien
     « Aller au contenu » avec elles.

     Il mesure aux deux largeurs, parce que l'en-tête fait 103 px à 390 et
     119 px à 1280 — un nombre écrit à la main est faux à l'une des deux.

     Avant la correction : 9 rouges, dont trois ancres entièrement couvertes.
     Après : 0, aux deux largeurs, le glossaire restant à zéro pixel de jeu.

     Éprouvé par six sabotages avant d'y entrer, et chacun nomme ses rouges :

       A  la bande d'ancre retirée                              7 rouges
       B  la hauteur rendue à six rem écrits à la main          5 rouges
       C  la bande posée aussi là où l'en-tête n'est pas collant 2 rouges
       D  les barres d'écran retirées de la bande                2 rouges
       E  le panneau « Sommaire » recalé sur un nombre           1 rouge
       F  le saut du glossaire visant le HAUT de son index       2 rouges

     B mérite d'être lu : la cible arrive alors à 104 px, soit UN pixel de trop
     à 390 et quinze à 1280. Le nombre écrit à la main n'était juste que par
     accident, et c'est ce genre de marge qui rend un faux vert durable.
  */
  ['essais:ancres:navigateur', 'une ancre atterrit sous l’en-tête, ni derrière ni plus bas'],
  ['essais:themes-navigateur', 'les quatorze thèmes s’appliquent pour de vrai'],
  ['essais:themes-a-jour', 'le catalogue et les feuilles engendrées concordent'],
  ['essais:contrastes-themes', 'WCAG AA dans chaque thème'],
  ['essais:bulles:navigateur', 'les bulles : leurs classes existent, et elles se voient'],
  ['essais:couleurs-jetons', 'aucune couleur littérale hors des jetons'],
  ['essais:theme-menus', 'aucun menu hors palette, et refus de juger à vide'],
  ['essais:coffre-ferme', 'coffre fermé, rien de sensible n’apparaît'],
  ['essais:echecs-dits', 'un échec est dit, jamais avalé'],
  /*
     B-7. Au socle parce qu'il est PUR et tient en une seconde, et parce que ce
     qu'il garde est de la famille de l'irréparable : une restauration qui
     reprend l'identité d'un autre appareil met deux appareils sous le même nom,
     et ce nom est celui qui arbitre les horloges logiques égales. Le défaut ne
     se voit pas au moment où il se produit.
  */
  ['essais:identite-restauree', 'une restauration ne reprend l’identité que si on le demande'],
  ['essais:refus-dit', 'un mot de passe de coffre refusé est dit, sur chaque page'],
  ['essais:carte-ecrans', 'aucun écran orphelin, aucun au-delà de trois appuis'],
  /*
     LES BALAYAGES DE SOURCE, ajoutés au socle le 19 octobre, avec l'accord du
     pilote.

     Ils ne demandent ni navigateur ni aperçu, et coûtent quelques secondes
     chacun. Ce sont pourtant ceux qu'une écriture NOUVELLE fait rougir : une
     clé d'état qu'on vient d'inventer, un magasin qu'on vient d'ajouter, un
     essai qui sème sans le dire.

     Ils manquaient, et cela s'est payé le même jour : deux clés d'état non
     déclarées ont vécu sur `main` sans qu'un contrôle d'avant-poussée puisse
     les voir — le socle ne les contenait pas, et la batterie complète coûte
     une heure. C'est un agent qui les a signalées, pas la cadence.
  */
  ['essais:reglages-orphelins', 'aucune clé d’état écrite sans être déclarée'],
  ['essais:effacement', 'aucun magasin sans groupe, sans date déclarée, sans description'],
  ['essais:semis', 'aucun essai qui sème en base sans dire pourquoi'],
  ['essais:enregistrements', 'le registre des magasins journalisés, nommé et non compté'],
  /*
     Ajouté le 24 octobre, sur signalement du pilote. Celui-ci est resté ROUGE
     sur « main » depuis la fusion du 52 sans que personne le voie : le compte
     des magasins scellés disait 27 pour 28 réels, et seule une batterie
     complète le montrait. C'est exactement le genre d'écriture nouvelle que le
     socle est là pour attraper, et il coûte une seconde.
  */
  ['essais:coffre', 'le compte des magasins scellés, et leurs champs en clair'],
  /*
     Celui-ci garde une chose qu’aucun autre ne garde : que les tables soient
     réellement CONSULTÉES. B a saboté `compter()` et `effacer()` et tout le
     reste est resté vert — seul cet essai-ci rougissait. Un garde-fou qui
     vérifie la présence d’une déclaration ne dit rien de son effet ; c’est la
     leçon des créneaux, et elle se range ici.
  */
  ['essais:effacement:navigateur', 'les tables d’effacement sont consultées, et non seulement déclarées'],
  /*
     G-13. Celui-ci entre parce que 54 sites d’affichage viennent d’être
     routés d’un coup : le cinquante-cinquième s’écrira un jour sans que
     personne y pense, et la relecture ne l’attrapera pas. Son balayage de
     source coûte une seconde et nomme le fichier et la ligne.
  */
  ['essais:erreurs-dites', 'aucun texte brut de panne à l’écran, et les messages de domaine intacts'],
  /*
     La porte des actions. Il entre au socle pour une raison précise : ce qu'il
     garde n'est pas une phrase, c'est une DÉCISION — une action n'est jamais
     coupée par un délai, parce que couper un export remplacerait un bouton
     mort par une sauvegarde à moitié écrite. Un couperet ajouté de bonne foi
     par quelqu'un qui trouverait l'attente trop longue ne se verrait nulle
     part ailleurs, et ne se verrait surtout pas en relecture : il ne se montre
     que sur une promesse qui ne se règle jamais. L'essai en pose une.
  */
  ['essais:porte-des-actions', 'la porte dit qu’une action continue, et ne la coupe jamais'],
  /*
     Celui-ci garde le code de sortie de CETTE batterie-ci. Il entre au socle
     parce que le socle est justement ce qu'on enchaîne avec un `&&` avant de
     pousser : s'il est le seul passage dont le verdict compte, il doit porter
     le garde-fou de son propre verdict. Il coûte trois secondes, et il tourne
     contre un faux `npm`, donc sans site et sans mot de passe réel.
  */
  ['essais:code-de-sortie', 'la batterie rend un code non nul sur un rouge, croix à code nul comprise'],
  /*
     Celui-ci entre parce que le mot de passe avait CINQ lecteurs, dont deux
     qui rechiffrent ou chiffrent le corpus. Son balayage de source attrape
     la sixième copie, celle qu'on écrira sans y penser : une copie de
     quatre lignes a l'air juste, et une relecture ne l'attrape pas.
  */
  ['essais:mot-de-passe-une-source', 'une seule règle de lecture du mot de passe, et aucune copie'],
  /*
     Le chemin du navigateur a cassé les essais TROIS fois — quinze essais le
     19 octobre, cent soixante-un le 25, et deux de plus restés épinglés sur
     une version disparue. Chaque fois, le même piège : ne rien trouver ne
     levait pas, donc l'erreur parlait d'autre chose et on cherchait du côté
     du site. Celui-ci coûte une seconde et ne demande pas d'aperçu.
  */
  ['essais:chemin-du-navigateur', 'le navigateur se trouve, et son absence refuse au lieu de se taire'],
  /*
     L'ESSAI DES AIDES, ajouté au socle le 31 octobre avec l'accord du pilote.

     Les aides de `scripts/lib/post-condition.mjs` sont devenues l'outil par
     lequel une cinquantaine d'essais attendent quelque chose. Une aide qui se
     défait ne rend pas une erreur : elle rend la main trop tôt, et les essais
     qui s'appuient sur elle deviennent des verts qui ne mesurent plus rien.
     C'est le défaut le plus silencieux que ce dépôt puisse produire, et c'est
     pourquoi il entre ici plutôt qu'en batterie complète.

     Dix aides sur cette branche, mesuré et non supposé ; une onzième,
     `quandCelaSeFixe`, arrive avec `claude/a-temporisations`. Le libellé ne
     porte donc aucun compte : un nombre inscrit ici vieillirait au premier
     ajout, et un libellé qui annonce un compte faux est précisément ce que la
     correction du libellé de `essais:typographie` a appris aujourd'hui.

     Il les éprouve SATISFAITES et EXPIRÉES — une attente qui ne sait pas
     expirer est un faux garde-fou —, y compris les limites qu'elles s'avouent.
     `attendreEnBase` referme sa connexion, et c'est mesuré par ce qui en
     dépend : une montée de version qu'une connexion ouverte bloquerait.

     Il ne demande ni aperçu ni mot de passe — ses pages sont fabriquées et
     servies depuis une origine interceptée, parce que « about:blank » refuse
     IndexedDB. Six secondes.
  */
  ['essais:post-condition', 'les aides d’attente tiennent, satisfaites comme expirées'],
  /*
     LE VERROU AUTOMATIQUE, ajouté au socle le 1er novembre avec l'accord du
     pilote, en même temps que l'inscription des huit essais orphelins.

     **Il n'était joué par RIEN.** Aucun script `npm` ne le nommait, donc ni le
     socle ni la batterie complète ne le voyaient : cinq assertions vertes et
     muettes depuis son écriture. Un essai qu'aucun script ne nomme ne tourne
     pas, et son silence se lit comme une absence de défaut — c'est la même
     famille que le vert à vide, en pire, puisqu'il n'y a même pas de vert.

     Il entre au socle et non en batterie complète pour deux raisons. Il tient
     en **douze secondes**, sous le seuil de trente que le pilote a fixé. Et ce
     qu'il garde ne se voit nulle part ailleurs : qu'un coffre laissé seul se
     REFERME vraiment, dans un navigateur, et non seulement que la fonction qui
     doit le refermer existe. C'est la leçon des créneaux — un garde-fou qui
     vérifie la présence d'une déclaration ne dit rien de son effet.

     Les sept autres orphelins vont en batterie complète : ils y arrivent du
     seul fait d'avoir un script `npm`, puisque la batterie complète joue tout
     ce qui commence par « essais ».
  */
  ['essais:verrou-navigateur', 'un coffre laissé seul se referme vraiment, dans un navigateur'],
  /*
     ET LE BALAYAGE QUI EMPÊCHE LE NEUVIÈME ORPHELIN, ajouté le 1er novembre
     avec l'accord du pilote, le jour même où les huit ont été branchés.

     Un essai rouge se voit. Un fichier d'essai qu'aucun script `npm` ne nomme
     ne tourne PAS : la batterie joue les scripts, non les fichiers, et son
     silence se lit comme une absence de défaut. Huit l'étaient — 118
     assertions vertes et muettes, dont cinq qui gardaient la seule chose
     qu'aucun autre essai ne garde.

     Il entre au socle parce qu'il ne coûte rien — aucun navigateur, aucun
     aperçu, un balayage de source — et parce que le défaut qu'il garde
     s'introduit précisément au moment où l'on écrit un essai, c'est-à-dire
     devant le socle et non devant la batterie complète.

     Il refuse, code 2, s'il ne lit aucun fichier ou aucun script : zéro
     orphelin et zéro fichier lu se rendraient sinon de la même façon. Et il
     s'éprouve dans les deux sens, son premier contrôle étant ce qu'il DOIT
     voir — sans quoi un balayage qui ne trouve plus rien resterait vert.

     À ne pas confondre avec `essais:orphelins`, qui garde l'inverse : un
     module livré que nul écran n'appelle.
  */
  ['essais:essais-branches', 'tout fichier d’essai est branché à un script npm'],
  /*
     M5c entre au socle parce qu'il a trouvé un VRAI défaut du site le 25
     octobre — la position de défilement était lue à `pagehide`, après que
     le navigateur l'avait rabattue — et parce que sa tolérance de 80 px
     avait caché cinq pertes sur six listes. Un essai qui attrape cela n'a
     rien à faire hors du socle, d'autant que `lib/defilement.ts` est
     chargé par la mise en page de TOUTES les pages.
  */
  ['essais:defilement-rendu', 'la position de défilement est rendue, exactement, sur chaque liste'],
  /*
     L'aller-retour de la banque QCM vers sa source YAML, demandé au socle
     par le pilote avec la branche qui le livre. Il garde la seule chose
     qu'on ne peut pas reconstituer : 540 questions dont 387 viennent
     d'annales réelles. Un aller-retour qui perdrait un champ en silence ne
     se verrait qu'à la publication suivante.
  */
  ['essais:qcm-source', 'la banque QCM revient à sa source YAML sans perdre un champ'],
  /*
     Demandé au socle par le pilote, avec la raison : le module des saisies
     n'était couvert par aucun essai du socle, et c'est ce qui a permis de
     pousser une branche rouge. « essais:lu-par » nomme les sept champs que
     l'aiguillage des saisies dessert ; « saisies.ts » fait maintenant 602
     lignes et deux écrans en dépendent.
  */
  ['essais:lu-par', 'l’aiguillage des saisies dessert bien les sept champs qu’il nomme'],
  /*
     Le quinzième écran. Deux agents ont posé le même filtre à deux endroits
     opposés le même jour ; le placement de B l'a emporté, et l'argument de C
     reste vrai de l'autre côté — un écran qui RACONTE et qui prendrait le
     manifeste filtré mentirait sans rien casser. Cette garde classe chaque
     appelant et refuse celui qu'on ajouterait sans le classer.
  */
  ['essais:manifeste-filtre', 'qui voit le corpus entier, et qui ne voit que son parcours'],
  /*
     Celui-ci entre parce que la faute qu'il garde est INVISIBLE à la
     relecture. `waitForFunction(fonction, valeur, options)` : une borne écrite
     au second rang part comme valeur, la fonction ne la lit pas, et l'attente
     retombe sur les trente secondes par défaut. Les deux formes se
     ressemblent assez pour que personne ne les distingue, et une borne qu'on
     croit avoir fixée est pire qu'une borne absente — absente, elle se voit.

     Et il garde une seconde chose, qui est la raison de son volume : le
     balayage découpe les arguments à la main, parce qu'une fonction fléchée
     passée en premier porte ses propres virgules. Or un analyseur cassé ne
     lève pas, il rend ZÉRO FAUTE — ce qu'un dépôt propre rend aussi. L'essai
     l'éprouve donc dans les deux sens, et il refuse de se taire quand il ne
     lit aucun appel. Cela s'est payé le jour même : la forme sur plusieurs
     lignes n'était pas vue, et trente-quatre bornes étaient au mauvais rang
     dans huit essais derrière un « 0 borne ». Il coûte trois secondes et ne
     demande ni navigateur ni aperçu.
  */
  ['essais:bornes', 'les bornes de « waitForFunction » au bon rang, et le balayage qui le voit'],
  /*
     B l'a laissé hors socle en me laissant trancher. Je l'y mets, pour trois
     raisons mesurées plutôt que pour son sujet.

     Il coûte HUIT SECONDES, mesuré, et ne demande que l'aperçu. Il garde le
     seul geste du site qui soit sans recours, dans ses DEUX issues — l'ordre
     (le verdict vient après la peinture) et le mensonge (une peinture qui
     échoue après un effacement réussi ne dit plus « interrompu »). Et il porte
     le contrôle qui donne son sens aux quatorze autres : les données sont bien
     parties, sans quoi un écran qui aurait cessé d'effacer passerait l'essai en
     disant la bonne phrase.

     La troisième raison est la mienne : c'est le défaut que j'ai mis une
     journée à nommer, par une sonde, et dont l'intermittence a fait accuser
     tour à tour un correctif d'identité, une branche de C et neuf fusions. Un
     défaut qui a coûté cela à trois agents n'a pas sa place hors du socle.
  */
  ['essais:effacement-verdict', 'le verdict de l’effacement vient en dernier, et il ne ment pas'],
  /*
     IL GARDE UN INVARIANT QUE PERSONNE N'A CHOISI, et c'est la raison de sa
     présence ici plutôt qu'en relevé à la demande.

     Aucune absence affirmée dans ces essais ne peut faire VERDIR un essai à
     tort — non par discipline, mais parce que les aides d'assertion COMPTENT
     au lieu de lever : « let echecs = 0 », puis « process.exit(echecs ? 1 : 0) ».
     Il suffit donc qu'un cri figure dans le bloc pour qu'une course perdue
     rende l'essai rouge, et les dix absences du dépôt sont toutes encadrées
     ainsi.

     Cet effet de bord n'a jamais été décidé, et deux gestes anodins le
     défont : rendre « v() » levante — ce qui a l'air d'une amélioration — ou
     laisser un bloc avec une seule assertion, muette. Dans les deux cas rien
     ne change de forme et aucune relecture ne le verrait. Ce passage le voit.

     Il vaut 0 le jour où il entre, 1 dès qu'une absence se trouve seule dans
     son bloc, et 2 s'il ne lit aucune lecture du tout — un dossier renommé ne
     peut donc pas rendre le zéro d'un balayage mort. Il coûte une seconde et
     ne demande ni navigateur ni aperçu. Voir « cadence-des-essais.md » § 8.
  */
  ['essais:deguisees', 'aucune absence affirmée sans un cri dans son bloc'],
];

/**
 * LES PRÉPARATIONS — ce qu'il faut avoir fait pour qu'un essai mesure.
 *
 * `essais:actualites:navigateur` mesure la LONGUEUR de l'archive des
 * actualités. Or les actualités ne viennent pas du build : elles vivent
 * chiffrées dans « actualites-data/ », et c'est la publication qui les copie
 * à côté du site. En local, « dist/ » ne porte que les quelques entrées de
 * démonstration — et l'essai disait donc « 1 période(s) seulement », en
 * expliquant lui-même quoi lancer.
 *
 * Ce n'était un défaut ni du site ni de l'essai : c'était l'ordre du
 * passage. La batterie joue donc la préparation avant l'essai qui en a
 * besoin, une seule fois, et le dit.
 *
 * Pourquoi ici et non dans l'essai : parce que l'essai, lancé seul, doit
 * continuer à REFUSER en expliquant — il est juste qu'un essai dise « il me
 * manque ceci » plutôt que de modifier « dist/ » dans le dos de qui le
 * lance. C'est le passage d'ensemble qui a la charge de l'ordre.
 */
const PREPARATIONS = {
  'essais:actualites:navigateur': [
    [
      'actualites:dist',
      'copie les actualités réelles dans « dist/ » et reconstruit leur ' +
        'inventaire ; sans elles, l’archive mesurée fait une période',
    ],
  ],
};

const SOCLE_SEUL = process.argv.includes('--socle');

/* Tout ce qui commence par « essais » : la liste ne se tient pas à la main. */
const tous = Object.keys(scripts).filter((n) => n.startsWith('essais'));
const noms = SOCLE_SEUL ? SOCLE.map(([n]) => n) : tous;

if (SOCLE_SEUL) {
  /*
     Un nom du socle qui n'existe plus doit arrêter la commande, et non
     disparaître du passage : un socle qui rétrécit en silence ne garde plus
     ce qu'il annonce.
  */
  const inconnus = noms.filter((n) => !(n in scripts));
  if (inconnus.length > 0) {
    console.error(
      `✗ REFUS — le socle nomme des essais qui n’existent pas : ${inconnus.join(', ')}.\n` +
        '  Un essai renommé se renomme aussi dans le socle ; un essai retiré se retire\n' +
        '  du socle avec la raison de son retrait.',
    );
    process.exit(1);
  }
}

if (noms.length === 0) {
  console.error('✗ PANNE — aucun essai trouvé dans package.json.');
  process.exit(1);
}

/* ── Les deux refus ────────────────────────────────────────────────────── */

/*
   LE MOT DE PASSE SE LIT AUSSI DANS `.env.local`, ET C'EST MIEUX AINSI.

   Ce refus exigeait la variable d'environnement, et sa phrase disait « donnez-
   le dans l'environnement de la commande ». C'est précisément ce qu'il ne faut
   pas faire : une commande s'enregistre dans le journal de la session, en
   clair, et le secret y reste. `.env.local` est le fichier du build, ignoré
   par Git, et `essais:secret` vérifie qu'il n'est pas suivi.

   On passe donc par le module partagé, que cent trente-trois essais emploient
   déjà, et on POSE la valeur dans l'environnement : les essais-enfants
   reçoivent `process.env` et n'ont rien à changer.

   Le refus reste entier quand il n'y a de mot de passe nulle part : sans lui,
   les essais de navigateur ne déverrouilleraient pas le site et la batterie
   rendrait des rouges qui n'appartiennent pas au site.
*/
process.env.SITE_PASSWORD ||= motDePasseEssais();

const sert = await fetch(`${ADRESSE}/robots.txt`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.ok)
  .catch(() => false);
if (!sert) {
  console.error(
    `✗ REFUS — rien ne répond sur ${ADRESSE}.\n` +
      '  Construisez puis lancez l’aperçu avant la batterie :\n' +
      '    node scripts/build-content.mjs            (le manifeste chiffré)\n' +
      '    REVINSP_SANS_PODCAST=1 npx astro build    (avec .env.local, puis effacé)\n' +
      '    npx astro preview stop && npx astro preview --port 4321\n' +
      '  La première ligne manquait à ce message, et son absence coûte cher sur\n' +
      '  un conteneur neuf : le site se construit, l’aperçu répond, mais le\n' +
      '  manifeste de contenu n’existe pas, donc le déverrouillage échoue — et\n' +
      '  les essais de navigateur expirent sans dire pourquoi.\n' +
      '  Un aperçu d’un AUTRE répertoire de travail répondrait aussi : vérifiez\n' +
      '  qu’il sert bien le « dist/ » que vous venez de construire.',
  );
  process.exit(1);
}

/*
   ET IL FAUT QUE CE SOIT CE « dist/ »-CI, CE QUE LE REFUS CI-DESSUS NE
   VÉRIFIAIT PAS.

   Le contrôle sondait `robots.txt`. Il répondait donc à une seule question —
   « quelque chose écoute-t-il sur ce port » — et jamais à celle qui compte.
   L'avertissement était écrit juste au-dessus, en prose, à l'intention d'un
   humain : « un aperçu d'un AUTRE répertoire de travail répondrait aussi ».
   Une mise en garde qui n'est pas mesurée ne garde rien.

   Elle a coûté un socle entier. Treize minutes de mesure, pendant lesquelles
   l'arbre de travail est passé sur une autre branche et « dist/ » a été
   reconstruit : les trente-huit premiers essais ont mesuré un arbre, les cinq
   derniers un autre, et le récapitulatif a rendu « cinq rouges » sans
   distinguer les deux. C'est la pire sortie possible, parce qu'un verdict faux
   a exactement la même forme qu'un verdict vrai — et que celui-là se lit comme
   la preuve qu'il y avait quelque chose à trouver.

   L'EMPREINTE EST CELLE DU DISQUE CONTRE CELLE DU RÉSEAU, et non une valeur
   qu'on s'attendrait à trouver : on lit « dist/index.html », on demande « / »
   à l'aperçu, et on compare les deux. Rien n'est supposé de ce que le fichier
   contient, donc rien à maintenir le jour où il change. Et les deux états
   diffèrent — c'est tout ce qu'on demande à une post-condition. Mesuré :
   l'aperçu rend ce fichier à l'octet près, compressé ou non.

   ON LA REPREND À L'ARRIVÉE, parce que le départ ne dit rien de la suite :
   c'est précisément en cours de route que l'arbre avait changé. Si elle a
   bougé, le récapitulatif ne rend plus un verdict — il dit que la mesure est
   nulle, et pourquoi.
*/

const TEMOIN_DU_DISQUE = join('dist', 'index.html');

function empreinteDuDisque() {
  try {
    return createHash('sha256').update(readFileSync(TEMOIN_DU_DISQUE)).digest('hex');
  } catch {
    return null;
  }
}

/*
   « INJOIGNABLE » N'EST PAS « DIFFÉRENT », et les confondre a coûté une course.

   Première écriture, cette fonction rendait `null` à la moindre défaillance.
   Un `null` ne vaut pas l'empreinte attendue, donc un seul `fetch` manqué
   suffisait à annuler dix-huit minutes de mesure : 43 essais verts, et
   « MESURE NULLE » quand même. Mesuré après coup — l'empreinte du disque
   inchangée depuis le début de la course, le processus de l'aperçu vivant sans
   interruption depuis 1167 secondes, et les deux côtés identiques à l'arrivée.
   Rien n'avait bougé. C'était ma garde qui criait.

   Un pari à un coup ne doit pas pouvoir annuler une mesure qui a duré : on
   réessaie, borné, et la boucle RAPPORTE ce qu'elle a vu au lieu de trancher.

   Et les deux états sont rendus séparément, parce qu'ils ne disent pas la même
   chose. « L'aperçu répond autre chose » est une preuve que l'arbre a basculé.
   « L'aperçu ne répond pas » n'en est pas une : c'est l'absence de preuve, et
   une absence de preuve ne doit pas s'énoncer comme un verdict.
*/
const TENTATIVES = 3;

async function empreinteServie() {
  let derniere = 'aucune raison recueillie';
  for (let tentative = 1; tentative <= TENTATIVES; tentative += 1) {
    try {
      const reponse = await fetch(`${ADRESSE}/`, { signal: AbortSignal.timeout(20_000) });
      if (reponse.ok) {
        return {
          empreinte: createHash('sha256')
            .update(Buffer.from(await reponse.arrayBuffer()))
            .digest('hex'),
        };
      }
      derniere = `réponse ${reponse.status}`;
    } catch (erreur) {
      derniere = erreur instanceof Error ? erreur.message : String(erreur);
    }
    if (tentative < TENTATIVES) await new Promise((suite) => setTimeout(suite, 1000));
  }
  return { injoignable: derniere };
}

const empreinteAttendue = empreinteDuDisque();
const auDepart = await empreinteServie();
if (empreinteAttendue === null || auDepart.empreinte !== empreinteAttendue) {
  console.error(
    `✗ REFUS — ${ADRESSE} répond, mais ne sert pas le « dist/ » de cet arbre.\n` +
      (empreinteAttendue === null
        ? '  « dist/index.html » n’existe pas : rien n’a encore été construit ici.\n'
        : auDepart.injoignable !== undefined
          ? `  Et pourtant « / » ne se lit pas, après ${TENTATIVES} tentatives : ${auDepart.injoignable}\n`
          : '  L’aperçu sert un AUTRE « dist/ » — un autre répertoire de travail, ou\n' +
            '  une construction antérieure à vos derniers changements.\n') +
      '  Construisez, puis relancez l’aperçu sur CE répertoire :\n' +
      '    node scripts/build-content.mjs            (le manifeste chiffré)\n' +
      '    REVINSP_SANS_PODCAST=1 npx astro build    (avec .env.local, puis effacé)\n' +
      '    npx astro preview stop && npx astro preview --port 4321\n' +
      '  Sans cela la batterie mesure un site qui n’est pas le vôtre, et ses\n' +
      '  rouges comme ses verts ne disent rien de vos changements.',
  );
  process.exit(1);
}

/* ── Le laboratoire ────────────────────────────────────────────────────── */

/*
   HUIT ESSAIS NE PEUVENT PAS TOURNER DANS L'ARBRE DE TRAVAIL, ET C'EST VOULU.

   Ils bâtissent eux-mêmes un « content/ » depuis « content-exemple/ », avec un
   mot de passe factice, servent sur le port 4322, puis effacent tout. Ils
   REFUSENT donc de démarrer si « content/ », « .env.local » ou « public/data/ »
   existent déjà — c'est-à-dire toujours, dans le répertoire où le travail se
   fait. La batterie les comptait rouges, et la règle « aucun rouge avant de
   fusionner » devenait inapplicable.

   Le compte, lui, se lit dans le `Set` et non dans cette phrase : il disait
   « cinq » pour sept, le temps que deux essais s'ajoutent sans que personne
   recompte. Il est tenu à jour, et c'est tout ce qu'on peut en promettre.

   Les déplacer eux n'était pas la réponse : déplacer le « content/ » réel pour
   leur faire de la place, non plus, puisqu'ils le suppriment en fin de course
   et qu'il n'est pas dans Git.

   La réponse est un **arbre de travail séparé**, pris sur le même commit. Il
   ne porte aucun des trois fichiers, puisqu'aucun n'est suivi : leurs gardes
   sont satisfaites sans qu'on touche à quoi que ce soit ici. `node_modules` y
   est lié plutôt que réinstallé.

   Le laboratoire n'est créé que si au moins un de ces essais doit tourner, et
   il est retiré à la fin.
*/
const EN_LABORATOIRE = new Set([
  'essais:acces-m9',
  'essais:lecteur-parties',
  'essais:seances-parties:navigateur',
  'essais:parties-client',
  'essais:reperes-audio',
  /*
     Point e du 60. Les formules ne s'affichent que si une fiche en porte une,
     et le conteneur de travail n'en a aucune : l'essai pose donc son propre
     décor dans le contenu d'exemple, ce qui exige un arbre à part.
  */
  'essais:maths-ecran',
  /*
     C3 du prompt 43. L'écran du QCM DGFiP ne s'ouvre que si la banque de
     questions existe, et aucune n'est servie dans le conteneur de travail :
     « Commencer » y est désactivé, donc aucune épreuve ne peut être
     commencée ni gardée. Celui-ci se bâtit une banque synthétique de quatre
     questions, et tombe donc sous la même garde que les autres.
  */
  'essais:epreuve-gardee:navigateur',
  /*
     L'aller-retour de récupération construit `content/`, le publie, le
     récupère, puis RECONSTRUIT depuis le récupéré. Il lui faut donc un arbre
     à lui : lancé ici, il verrait le `content/` d'un autre essai de
     laboratoire et se tairait sur sa garde.
  */
  'essais:recuperation-corpus',
  /*
     Les trois parcours DGFiP n'ont AUCUN contenu, et n'en auront pas avant des
     mois : mesurer une séance qui propose vraiment quelque chose demande donc
     de planter des fiches sous `dgfip-b/`, `dgfip-a/`, `dgfip-ap/` et
     `commun/`. Il les plante, construit, puis efface — même garde que les
     autres, pour la même raison.
  */
  'essais:parcours-planifiables:navigateur',
  /*
     La correction détaillée à l'écran se vérifie sur un décor dont on connaît
     le contenu : quatre questions corrigées de la même façon, et une question
     de fiche injectée. Elle tombe donc sous la même garde que les autres —
     elle bâtit son `content/` et l'efface.
  */
  'essais:correction-ecran',
  /*
     61 du prompt. Les deux lectures d'un organigramme ne s'éprouvaient que sur
     le corpus réel, qui n'est pas dans Git : sur un conteneur neuf, l'essai
     retombait sur son refus « non mesurable » et la bascule redevenait non
     gardée sans que rien ne rougisse. Celui-ci pose son propre organigramme
     FICTIF dans le contenu d'exemple, ce qui exige un arbre à part.
  */
  'essais:organigramme-exemple',
]);

/*
   Une batterie lancée DANS un laboratoire n'en crée pas un second : elle y est
   déjà, et la récursion coûterait un arbre par essai.

   Le signe est que « .git » y est un FICHIER, qui renvoie au dépôt principal,
   et non un dossier. Une première version regardait seulement s'il existait :
   il existe des deux côtés, et la détection ne détectait rien.
*/
const DANS_UN_LABORATOIRE = (() => {
  try {
    return statSync(join(process.cwd(), '.git')).isFile();
  } catch {
    return false;
  }
})();

let laboratoire = null;
function ouvrirLeLaboratoire() {
  if (laboratoire !== null) return laboratoire;
  const chemin = mkdtempSync(join(tmpdir(), 'labo-batterie-'));
  try {
    execFileSync('git', ['worktree', 'add', '--detach', chemin, 'HEAD'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
    symlinkSync(join(process.cwd(), 'node_modules'), join(chemin, 'node_modules'));
    laboratoire = chemin;
  } catch (erreur) {
    /*
       L'échec n'est pas avalé : sans laboratoire, ces essais tomberaient sur
       leur garde et seraient comptés rouges pour une raison qui n'est pas la
       leur. On le dit une fois, et ils tournent là où ils sont.
    */
    console.log(
      `  \x1b[33m—\x1b[0m le laboratoire n'a pas pu être ouvert : ` +
        `${(erreur.stderr || erreur.message || '').toString().trim().slice(0, 200)}`,
    );
    laboratoire = false;
  }
  return laboratoire;
}

function fermerLeLaboratoire() {
  if (!laboratoire) return;
  try {
    rmSync(join(laboratoire, 'node_modules'), { force: true });
    execFileSync('git', ['worktree', 'remove', '--force', laboratoire], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  } catch {
    /* Un laboratoire qui survit coûte de la place, pas une mesure fausse. */
  }
}

/* ── Le passage ────────────────────────────────────────────────────────── */

/*
   REPRENDRE UNE BATTERIE INTERROMPUE — 19 octobre.

   Le conteneur a redémarré au 151ᵉ essai sur 235, après deux heures et
   demie. Tout refaire aurait coûté deux heures et demie de plus pour
   remesurer la même construction, et la règle « batterie complète avant
   chaque poussée » serait devenue impraticable au premier incident.

   `BATTERIE_JOURNAL` désigne un journal existant : les essais qui y ont
   déjà un verdict sont REPRIS tels quels, et seuls les autres tournent.
   C'est juste à une condition, qui ne se devine pas et qui est donc
   rappelée à l'écran : la construction servie doit être la même. Reprendre
   un journal après un `astro build` mesurerait deux sites à la fois.

   Les verdicts s'écrivent au fur et à mesure, et non à la fin : un journal
   d'une batterie tuée en route doit rester exploitable, sinon il ne sert à
   rien le jour où il sert.
*/
const journal = process.env.BATTERIE_JOURNAL ?? mkdtempSync(join(tmpdir(), 'batterie-'));
if (!existsSync(journal)) mkdirSync(journal, { recursive: true });
const cheminDesVerdicts = join(journal, 'verdicts.json');

let verdicts = {};
if (existsSync(cheminDesVerdicts)) {
  try {
    verdicts = JSON.parse(lireFichier(cheminDesVerdicts, 'utf8'));
  } catch {
    /* Journal illisible : on remesure tout plutôt que de deviner. */
    verdicts = {};
  }
}

/*
   Les journaux de la batterie tuée au redémarrage n'ont pas de verdict
   écrit — le fichier n'existait pas encore. On les relit, et on les juge
   sur ce que le journal porte : une croix en tête de ligne, ou une signature
   de panne.
   Le code de sortie, lui, est perdu : c'est dit, essai par essai, dans le
   récapitulatif, parce qu'un juge amputé qui se présente comme entier est
   pire qu'un essai relancé.
*/
/**
 * Une ligne d'échec, c'est une ligne qui COMMENCE par une croix.
 *
 * Il a fallu trois états du monde pour arriver à cette règle, et les deux
 * premières versions du juge se sont trompées, chacune dans un sens :
 *
 * - la plupart des essais écrivent leur croix en rouge : la chercher ainsi
 *   les attrape ;
 * - « essais:retours » écrit, dans un libellé VERT, « et ✗ pour une réponse
 *   fausse ». Il décrit le signe, il ne l'émet pas : chercher la croix nue le
 *   déclarait rouge à tort — un faux rouge ;
 * - « essais:sante » écrit sa croix SANS couleur, en tête de ligne. Chercher
 *   la croix rouge l'a donc compté VERT alors qu'il est rouge — un faux vert,
 *   pire, et c'est la batterie elle-même qui l'a montré : elle annonçait 215
 *   verts là où il y en avait 214.
 *
 * La POSITION tranche les trois : une ligne d'échec porte sa croix en tête,
 * un libellé qui parle de la croix la porte au milieu. On retire donc les
 * séquences d'échappement et l'indentation, puis on regarde le premier
 * caractère visible.
 */
const sansCouleur = (ligne) => ligne.replace(/\u001b\[[0-9;]*m/g, '').trim();
const lignesDEchec = (texte) =>
  texte.split('\n').filter((l) => sansCouleur(l).startsWith('✗'));

const PANNE = /\n(?:node:internal|.*Error: |npm error )/;
const reprisSansCode = [];
for (const nom of noms) {
  if (verdicts[nom]) continue;
  const fichier = join(journal, `${nom.replace(/[:/]/g, '-')}.log`);
  if (!existsSync(fichier)) continue;
  const texte = lireFichier(fichier, 'utf8');
  const croix = lignesDEchec(texte).length > 0;
  const panne = PANNE.test(texte);
  verdicts[nom] = {
    code: null,
    croix: croix || panne,
    /*
       Le code de sortie est perdu, mais la LIGNE DE MARQUE est dans le journal :
       un refus se reconnaît donc même ici, et il ne redevient pas un rouge
       muet du seul fait qu'on relit un journal.
    */
    marque: estNonMesurable(texte),
    raison: raisonNonMesurable(texte),
    repris: true,
  };
  reprisSansCode.push(nom);
}

/*
   Le titre dit lequel des deux passages tourne. Un journal qui annonce
   « batterie complète » après seize essais mentirait de la même façon qu'un
   faux vert : sur ce qui a été mesuré.
*/
const INTITULE = SOCLE_SEUL ? 'SOCLE' : 'BATTERIE COMPLÈTE';
console.log(`\n${INTITULE} — ${noms.length} essais, aperçu sur ${ADRESSE}`);
console.log(`Journaux : ${journal}`);
const dejaJuges = noms.filter((n) => verdicts[n]).length;
if (dejaJuges > 0) {
  console.log(
    `Repris du journal : ${dejaJuges} essais (dont ${reprisSansCode.length} jugés sur leur ` +
      'journal seul, code de sortie perdu).\n' +
      '  Valable À LA SEULE CONDITION que la construction servie soit la même.',
  );
}
console.log('');

const rouges = [];
/*
   LE TROISIÈME SEAU, et pourquoi il n'est ni l'un ni l'autre.

   Deux essais du dépôt ne peuvent rien dire sans le corpus réel — plus de cent
   fiches au manifeste pour l'un, la matière « Économie » pour l'autre. Dans un
   conteneur qui ne sert que le contenu d'exemple, ils rendaient un rouge
   indistinguable d'un défaut du site.

   Les compter verts aurait acheté un nombre flatteur contre une garantie
   perdue : un essai vert AFFIRME quelque chose, et celui-là n'affirme rien.
   Ils se comptent donc à part, et le verdict porte les trois nombres. Voir
   « scripts/lib/non-mesurable.mjs », qui tient le code de sortie des deux
   côtés pour qu'il ne puisse pas diverger.
*/
const nonMesurables = [];
let verts = 0;
const debut = Date.now();

for (const [index, nom] of noms.entries()) {
  const compteur = `${String(index + 1).padStart(3, ' ')}/${noms.length}`;

  /* Déjà jugé : on reprend le verdict, on ne relance pas. */
  const connu = verdicts[nom];
  if (connu) {
    if (!connu.croix && connu.marque && (connu.code === CODE_NON_MESURABLE || connu.code === null)) {
      nonMesurables.push({ nom, raison: connu.raison ?? '' });
      console.log(`  \x1b[33m⚠\x1b[0m ${compteur} ${nom} (non mesurable, repris)`);
    } else if (connu.croix || (connu.code !== null && connu.code !== 0)) {
      rouges.push(nom);
      console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (repris du journal)`);
    } else {
      verts += 1;
      console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (repris)`);
    }
    continue;
  }
  /*
     La préparation d'abord, s'il y en a une. Son échec n'est pas avalé : un
     essai lancé sans sa préparation mesurerait autre chose que ce qu'il dit,
     et un rouge de cette sorte-là coûte une heure de diagnostic.
  */
  for (const [prep, pourquoi] of PREPARATIONS[nom] ?? []) {
    console.log(`  \x1b[36m…\x1b[0m ${compteur} ${nom} — préparation « ${prep} » : ${pourquoi}`);
    try {
      execFileSync('npm', ['run', '--silent', prep], {
        encoding: 'utf8',
        timeout: DELAI_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (erreur) {
      console.log(
        `  \x1b[31m✗\x1b[0m la préparation « ${prep} » a échoué : ` +
          `${(erreur.stderr || erreur.stdout || erreur.message || '').toString().trim().slice(0, 300)}`,
      );
    }
  }

  /*
     Les essais de laboratoire tournent dans l'arbre séparé — voir plus haut.
     Les autres tournent ici, et rien ne change pour eux.
  */
  const ou =
    EN_LABORATOIRE.has(nom) && !DANS_UN_LABORATOIRE ? ouvrirLeLaboratoire() : null;
  if (ou) console.log(`  \x1b[36m…\x1b[0m ${compteur} ${nom} — dans l'arbre de laboratoire`);

  let sortie = '';
  let code = 0;
  const depart = Date.now();
  try {
    sortie = execFileSync('npm', ['run', '--silent', nom], {
      encoding: 'utf8',
      timeout: DELAI_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      ...(ou ? { cwd: ou } : {}),
    });
  } catch (erreur) {
    code = erreur.status ?? (erreur.signal ? 124 : 1);
    sortie = `${erreur.stdout ?? ''}${erreur.stderr ?? ''}`;
    if (erreur.signal) sortie += `\n[batterie] interrompu après ${DELAI_MS} ms (${erreur.signal})`;
  }
  writeFileSync(join(journal, `${nom.replace(/[:/]/g, '-')}.log`), sortie);
  verdicts[nom] = {
    code,
    croix: lignesDEchec(sortie).length > 0,
    marque: estNonMesurable(sortie),
    raison: raisonNonMesurable(sortie),
  };
  writeFileSync(cheminDesVerdicts, JSON.stringify(verdicts, null, 1));

  /*
     Deux juges, et non un seul : le code de sortie, et la présence d'une
     croix EN TÊTE DE LIGNE. Certains essais rendent 0 en affichant des croix — c'est un
     défaut de ces essais, consigné ailleurs, mais la batterie ne doit pas
     s'en rendre complice en les comptant verts.

     Le juge est décrit au-dessus de « lignesDEchec » : ni la croix nue, qui
     fabriquait un faux rouge, ni la croix rouge, qui a fabriqué un faux
     vert, mais la croix en tête de ligne.
  */
  const croix = lignesDEchec(sortie).length > 0;
  const secondes = ((Date.now() - depart) / 1000).toFixed(0);
  /*
     TROIS CONDITIONS, ET LA MARQUE EN EST UNE.

     Un code 3 SANS la ligne de marque compte rouge : sans cette exigence, un
     essai qui rendrait 3 par accident — un `process.exit` mal choisi, un outil
     tiers — disparaîtrait du compte en silence, et c'est exactement ce que
     cette convention existe pour empêcher.

     Et la croix l'emporte toujours : un essai qui renonce ET affiche une croix
     a mesuré quelque chose qui cloche avant de renoncer.
  */
  if (code === CODE_NON_MESURABLE && !croix && estNonMesurable(sortie)) {
    nonMesurables.push({ nom, raison: raisonNonMesurable(sortie) });
    console.log(`  \x1b[33m⚠\x1b[0m ${compteur} ${nom} (non mesurable, ${secondes} s)`);
    console.log(`        ${raisonNonMesurable(sortie).slice(0, 150)}`);
  } else if (code === 0 && !croix) {
    verts += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${compteur} ${nom} (${secondes} s)`);
  } else {
    rouges.push(nom);
    console.log(`  \x1b[31m✗\x1b[0m ${compteur} ${nom} (code ${code}, ${secondes} s)`);
    for (const ligne of lignesDEchec(sortie).slice(0, 3)) {
      console.log(`        ${ligne.trim().slice(0, 160)}`);
    }
  }
}

const minutes = ((Date.now() - debut) / 60_000).toFixed(0);
console.log(
  /*
     LE RÉSUMÉ DU SOCLE S'ACCORDE, ET IL NE LE FAISAIT PAS : « 42 verts ;
     1 rouges ». C'est la sortie d'un outil, donc le balayage des accords ne la
     voit pas — il ne lit que `src/`. Raison de plus pour la corriger à la main,
     puisque rien ne le fera à ma place, et que c'est la ligne la plus relue de
     tout le dépôt : celle qu'on regarde avant chaque poussée.

     Un accord local plutôt qu'un import : la batterie est un script sans
     dépendance vers `src/`, et lui en donner une pour trois mots serait un
     mauvais échange. Le seuil est le même — singulier jusqu'à deux exclu.
  */
  `\n${SOCLE_SEUL ? 'socle' : 'batterie complète'} : ` +
    `${verts} ${verts > 1 ? 'verts' : 'vert'} ; ` +
    `${rouges.length} ${rouges.length > 1 ? 'rouges' : 'rouge'}` +
    (nonMesurables.length
      ? ` ; ${nonMesurables.length} non ${nonMesurables.length > 1 ? 'mesurables' : 'mesurable'}`
      : '') +
    ` (${minutes} min)`,
);
if (nonMesurables.length > 0) {
  console.log(
    `non mesurables : ${nonMesurables.map(({ nom }) => nom).join(' ')}`,
  );
  /*
     Avec leur RAISON, et non seulement leur nom : un nom oblige à ouvrir un
     journal, une raison se lit sur place et dit s'il y a quelque chose à faire.
  */
  for (const { nom, raison } of nonMesurables) {
    console.log(`  ${nom} — ${raison || 'raison non annoncée'}`);
  }
  console.log(
    'Ceux-là n’ont RIEN mesuré : ils ne sont ni verts ni rouges, et le compte des\n' +
      'verts ne les porte pas.',
  );
}
/*
   L'EMPREINTE, REPRISE : la mesure valait-elle encore à l'arrivée ?

   On regarde les deux côtés, parce qu'ils se perdent séparément — l'aperçu peut
   mourir ou être relancé sur un autre arbre, et « dist/ » peut être reconstruit
   sous un aperçu qui, lui, n'a pas bougé.
*/
const aLArrivee = await empreinteServie();
const disqueALArrivee = empreinteDuDisque();

/*
   TROIS ÉTATS, ET UN SEUL ANNULE.

   — l'aperçu répond AUTRE CHOSE, ou « dist/ » a changé sur le disque : l'arbre
     a basculé en cours de course. La mesure est nulle.
   — l'aperçu NE RÉPOND PAS, après trois tentatives : on ne sait pas. On le dit,
     et on ne touche pas au verdict — les essais, eux, ont bien tourné, et c'est
     d'eux que le verdict parle. Annuler ici reviendrait à faire dire à une
     absence de preuve ce qu'elle ne dit pas.
   — tout concorde : rien à signaler.
*/
const aBascule =
  (aLArrivee.empreinte !== undefined && aLArrivee.empreinte !== empreinteAttendue) ||
  (disqueALArrivee !== null && disqueALArrivee !== empreinteAttendue);
const finNonConfirmee = !aBascule && aLArrivee.injoignable !== undefined;
const mesureNulle = aBascule;

if (rouges.length > 0) {
  console.log(`rouges : ${rouges.join(' ')}`);
  if (!mesureNulle) {
    console.log(
      'À comparer au tableau des anomalies avant toute poussée : un rouge qui n’y\n' +
        'figure pas est un rouge NOUVEAU, et il se corrige avant de pousser.',
    );
  }
}
if (finNonConfirmee) {
  console.log(
    `⚠ FIN NON CONFIRMÉE — « / » ne s’est pas lu à l’arrivée, après ${TENTATIVES} tentatives :\n` +
      `  ${aLArrivee.injoignable}\n` +
      '  Le verdict ci-dessus TIENT : « dist/ » n’a pas changé sur le disque, et les\n' +
      '  essais ont bien tourné contre l’aperçu. Ce qui manque, c’est la preuve\n' +
      '  qu’il servait encore le même arbre à la dernière seconde.\n' +
      '  Si un rouge vous surprend, relancez-le seul avant de l’inscrire au tableau.',
  );
}
if (mesureNulle) {
  console.log(
    '✗ MESURE NULLE — l’aperçu ou « dist/ » a changé PENDANT la course.\n' +
      '  Les premiers essais ont mesuré un arbre, les derniers un autre, et rien\n' +
      '  ici ne dit où la bascule s’est faite. Les croix ci-dessus ne sont donc\n' +
      '  pas des rouges : ce sont des mesures perdues, et le compte des verts ne\n' +
      '  vaut pas davantage.\n' +
      '  Ne comparez rien au tableau des anomalies. Recommencez sans toucher à\n' +
      '  l’arbre de travail, à « dist/ », ni au port, pendant la course.\n' +
      (disqueALArrivee !== empreinteAttendue
        ? '  Côté qui a bougé : « dist/ » sur le disque — quelque chose a reconstruit.'
        : '  Côté qui a bougé : l’aperçu — il sert un autre « dist/ » que celui d’ici.'),
  );
}
console.log(`Journaux conservés : ${journal}\n`);
fermerLeLaboratoire();

/*
   LE CODE DE SORTIE JUGE, DÉSORMAIS.

   Il rendait zéro quoi qu'il arrive, et son commentaire l'assumait : « la
   batterie rapporte, l'humain tranche ». La phrase est juste pour un humain
   qui lit les vingt lignes du récapitulatif. Elle est fausse pour tout le
   reste : un `npm run socle && git push` passe, un enchaînement s'enchaîne,
   et une relecture rapide ne voit que « terminé ». TROIS agents s'y sont
   trompés, chacun de bonne foi, en lisant le zéro comme un verdict.

   Un passage qui ne peut pas dire non ne garde rien. Le code de sortie dit
   donc ce que le récapitulatif dit déjà : un si la liste des rouges n'est
   pas vide, zéro sinon. Les REFUS en amont rendaient déjà un, et ils
   continuent.

   Le récapitulatif reste entier : le code de sortie ne remplace pas la
   lecture, il empêche seulement de s'en passer sans le savoir.

   `essais:code-de-sortie` le garde, par sabotage : il fait tourner cette
   batterie-ci contre un faux `npm`, et vérifie les trois cas — tout vert,
   un code non nul, et une croix avec un code nul, qui est celui qui a
   trompé.
*/
process.exit(rouges.length > 0 || mesureNulle ? 1 : 0);
