/**
 * Moteur « Réseau relationnel » — catégorie Induction.
 *
 * Le même réseau est montré deux fois : une fois avec ses étiquettes, une fois
 * entièrement réétiqueté et réordonné. La personne apparie chaque entité à son
 * équivalent, par la seule structure.
 *
 * Deux précautions décident de la validité de l'exercice.
 *
 * **Les deux réseaux sont montrés en matrice, non en dessin.** Le cahier des
 * charges demande que la disposition ne donne aucun indice ; une matrice n'a pas
 * de disposition, et elle reste lisible là où un ordre total sur cinq entités
 * donnerait dix arêtes illisibles.
 *
 * **L'appariement doit se trouver par élimination.** La rigidité ne suffit pas :
 * elle garantit que l'appariement est unique, non qu'on puisse le trouver sans
 * fouiller toutes les permutations. Le moteur exige donc que `eliminer` aboutisse
 * — profils d'abord, puis appuis sur ce qui est déjà épinglé. C'est aussi ce qui
 * donne la trace de correction : une permutation trouvée par force brute ne
 * s'explique pas, une élimination s'explique étape par étape. La contrainte ne
 * coûte presque rien, mesuré : au moins 99 % des structures rigides s'y plient.
 *
 * **La structure doit être rigide.** Si elle admet une symétrie non triviale,
 * deux appariements différents sont tous deux corrects et corriger l'un comme
 * faux serait une faute. Le moteur retire donc jusqu'à quarante fois, puis
 * renonce — c'est notamment le cas de `groups`, dont les camps sont
 * interchangeables par construction et qui n'y parvient presque jamais.
 */
import { blocMatrice, libelle, libelleNu, texte } from '../../noyaux/presentation';
import { eliminer, matrice, profil, reetiqueter, rigide } from '../../noyaux/isomorphisme';
import { journal, ref } from '../../../correction/trace';
import type { Alea, Systeme } from '../../systemes/types';
import type { Item, Moteur } from '../types';

const GRECS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ'];

const TIRAGES = 40;

export const reseauRelationnel: Moteur = {
  id: 'reseau-relationnel',
  nom: 'Réseau relationnel',
  categorie: 'induction',
  resume: 'Le même réseau, réétiqueté : retrouvez qui est qui, par la structure seule.',
  regimes: ['algebre', 'clos'],

  engendrer(systeme: Systeme, difficulte: number, alea: Alea): Item | null {
    for (let essai = 0; essai < TIRAGES; essai += 1) {
      const instance = systeme.engendrer(Math.max(2, Math.min(difficulte, 8)), alea);
      if (instance.entites.length < 3 || instance.entites.length > GRECS.length) continue;
      if (!rigide(systeme, instance)) continue;

      const n = instance.entites.length;
      const ordreAffichage = alea.melanger(Array.from({ length: n }, (_, i) => i));
      const { instance: copie, correspondance } = reetiqueter(
        instance,
        GRECS.slice(0, n),
        ordreAffichage,
      );

      const structure = matrice(systeme, instance);
      const copieStructure = matrice(systeme, copie);
      const epinglages = eliminer(structure, copieStructure);
      if (!epinglages) continue;

      // La trace est écrite par l'élimination elle-même, dans son ordre : ce
      // que le premier tour tranche sur les seuls profils, ce que les tours
      // suivants tirent de ce qui est déjà épinglé.
      const carnet = journal();

      /**
       * Le profil mis en mots : « A est avant 2 entités et après 1 autre ».
       *
       * Les relations entrantes sont **omises quand elles sont le miroir des
       * sortantes** — ce qui est le cas sur les quinze systèmes, mesuré : un
       * vocabulaire fermé par converse donne toujours `entrantes[converse(r)]
       * === sortantes[r]`. Les écrire doublerait la longueur de chaque légende
       * sans rien apprendre. Le test reste là pour qu'un vocabulaire futur qui
       * briserait le miroir soit dit, au lieu d'être tu.
       */
      const mettreEnMots = (p: ReturnType<typeof profil>) => {
        const sortantes = Object.entries(p.sortantes);

        // L'auxiliaire ne s'élide qu'à la condition d'être répété. « est avant
        // 2 entités et après 1 entité » se lit ; « précède 2 entités et
        // incomparable à 1 entité » ne se lit pas, parce qu'en ôtant « est » à
        // la seconde on lui ôte son seul verbe. On n'élide donc que si la
        // première relation porte le même auxiliaire que celle qu'on abrège.
        const tete = sortantes.length
          ? /^(est|occupe) /.exec(libelle(systeme, sortantes[0][0]))?.[1]
          : undefined;
        /*
         * La forme naturelle — « A est avant 2 entités » — se gâte dès qu'un
         * libellé porte lui-même une virgule. `classes` dit « a des éléments
         * communs avec, sans qu'aucun ne contienne l'autre, » : la phrase reste
         * juste prise seule, mais une fois trois d'entre elles enfilées par des
         * virgules et un « et », on ne sait plus où finit une relation et où
         * commence la suivante.
         *
         * Dans ce cas la relation est **citée** au lieu d'être conjuguée, pour
         * tout le profil — mélanger les deux formes dans une même légende serait
         * pire. Les guillemets rendent alors la découpe visible.
         */
        const citer = sortantes.some(([relation]) => libelle(systeme, relation).includes(','));
        const morceaux = sortantes.map(([relation, combien], i) => {
          const combien_ = `${combien} ${combien > 1 ? 'entités' : 'entité'}`;
          // La virgule finale du libellé n'a de sens qu'avant un objet ; citée,
          // elle traîne dans les guillemets.
          if (citer) return `${combien_} « ${libelleNu(systeme, relation).replace(/[,\s]+$/, '')} »`;
          const entier = libelle(systeme, relation);
          const elidable = i > 0 && tete !== undefined && entier.startsWith(`${tete} `);
          return `${elidable ? libelleNu(systeme, relation) : entier} ${combien_}`;
        });
        const miroir =
          sortantes.length === Object.keys(p.entrantes).length &&
          sortantes.every(([relation, combien]) => p.entrantes[systeme.converse(relation)] === combien);
        if (!miroir) {
          const entrantes = Object.entries(p.entrantes)
            .map(([relation, combien]) => `${combien} × « ${libelleNu(systeme, relation)} »`)
            .join(', ');
          morceaux.push(`reçoit ${entrantes}`);
        }
        if (!morceaux.length) return 'n’est en relation avec aucune autre entité';
        if (morceaux.length === 1) return morceaux[0];
        return `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`;
      };

      /**
       * Le lien d'une entité libre à une entité déjà épinglée, des deux côtés.
       *
       * C'est ce qui rend l'étape d'appui vérifiable. Dire « c'est la seule qui
       * convient » n'apprend rien ; dire « Pôle E transmet à Pôle D, et β est la
       * seule entité qui transmet à α » se relit sur les deux matrices.
       *
       * Quand aucune relation ne les lie, c'est **l'absence** qui discrimine —
       * licite en régime clos, où l'absence vaut négation.
       */
      const lien = (libre: number, appui: number) => {
        const nom = instance.entites[appui];
        const image = correspondance[nom];
        const sortante = structure[libre][appui];
        const entrante = structure[appui][libre];
        if (sortante) {
          const verbe = libelle(systeme, sortante);
          return { chez: `${verbe} ${nom}`, enFace: `${verbe} ${image}` };
        }
        if (entrante) {
          const verbe = libelle(systeme, systeme.converse(entrante));
          return { chez: `${verbe} ${nom}`, enFace: `${verbe} ${image}` };
        }
        return {
          chez: `n’est en relation avec ${nom} dans aucun sens`,
          enFace: `n’est en relation avec ${image} dans aucun sens`,
        };
      };

      for (const epinglage of epinglages) {
        const gauche = instance.entites[epinglage.gauche];
        const droite = copie.entites[epinglage.droite];

        let legende: string;
        if (epinglage.motif === 'profil') {
          const p = profil(structure, epinglage.gauche);
          const cite = Object.keys(p.sortantes).some((r) => libelle(systeme, r).includes(','));
          legende =
            `${gauche} ${cite ? 'porte ' : ''}${mettreEnMots(p)} : ${droite} est ` +
            'la seule entité du second réseau dans le même cas.';
        } else {
          const liens = epinglage.appuis.map((appui) => lien(epinglage.gauche, appui));
          const acquis = epinglage.appuis
            .map((i) => `${instance.entites[i]} → ${correspondance[instance.entites[i]]}`)
            .join(' et ');
          legende =
            `${gauche} ${liens.map((l) => l.chez).join(' et ')}. ${acquis} étant acquis, ` +
            `${droite} est la seule entité du second réseau qui ` +
            `${liens.map((l) => l.enFace).join(' et ')}.`;
        }

        carnet.utile(ref('noeud', gauche));
        carnet.etape({
          utilise: [
            ref('noeud', gauche),
            ...epinglage.appuis.map((i) => ref('noeud', instance.entites[i])),
          ],
          produit: `${gauche} → ${droite}`,
          loi: epinglage.motif === 'profil' ? 'profil invariant' : 'appui sur les entités épinglées',
          legende,
          surbrillance: [ref('noeud', gauche), ref('noeud', droite)],
        });
      }

      return {
        moteur: 'reseau-relationnel',
        systeme: systeme.id,
        consigne: 'Quelle entité grecque correspond à quelle entité du premier réseau ?',
        enonce: [
          texte('Premier réseau — chaque case dit la relation de la ligne vers la colonne.'),
          blocMatrice(systeme, instance),
          texte(
            'Second réseau — le même, réétiqueté et réordonné. Ni les noms ni l’ordre des ' +
              'lignes ne vous aideront : seule la structure le fera.',
          ),
          blocMatrice(systeme, copie),
        ],
        reponse: {
          genre: 'appariement',
          gauche: instance.entites,
          droite: alea.melanger(copie.entites),
          paires: correspondance,
        },
        explication:
          'L’appariement est ' +
          instance.entites.map((entite) => `${entite} → ${correspondance[entite]}`).join(', ') +
          '. Il est unique parce que la structure n’admet aucune symétrie : ' +
          'aucune permutation des entités autre que l’identité ne laisse toutes les ' +
          'relations inchangées.',
        trace: carnet.sceller({ genre: 'appariement', paires: correspondance }),
      };
    }
    return null;
  },
};
