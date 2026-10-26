/**
 * H3 — CONTRASTE RENFORCÉ ET COULEURS IMPOSÉES PAR LE SYSTÈME.
 *
 * ## Le défaut que cet essai est né pour attraper
 *
 * Quand le système impose ses couleurs — contraste élevé de Windows, et ses
 * équivalents —, le navigateur remplace les couleurs mais SUPPRIME les ombres
 * portées. Or dix endroits du site posent « outline-none » et confient le
 * focus à un « ring-* », qui est une ombre : dans ce mode, ces dix éléments
 * perdaient TOUT indicateur de focus, et l'on ne savait plus où l'on était au
 * clavier. La règle globale « :focus-visible » ne les rattrapait pas, puisque
 * le gabarit l'avait explicitement annulée.
 *
 * Le champ de mot de passe de l'écran de déverrouillage est l'un des dix, et
 * c'est le plus exposé : c'est la toute première chose qu'on atteint au
 * clavier en arrivant sur le site.
 *
 * ## Pourquoi cet essai ne déverrouille rien
 *
 * Il mesure l'écran de verrou lui-même, qui s'affiche sans mot de passe. Il n'a
 * donc besoin ni de contenu, ni de secret, ni d'arbre de laboratoire — juste
 * d'un aperçu. C'est l'essai le moins cher du lot, et il garde ce qui se perd
 * le plus silencieusement.
 */
import { chromium } from 'playwright-core';

const RACINE = process.env.RACINE ?? 'http://localhost:4321';

const vert = (t) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t) => `\x1b[31m${t}\x1b[0m`;
const gras = (t) => `\x1b[1m${t}\x1b[0m`;

/**
 * La couleur de l'icône du verrou, sous couleurs imposées.
 *
 * Elle est relevée au point 1 et relue au point 3, dans un autre contexte de
 * navigateur : c'est la COMPARAISON des deux qui prouve quelque chose. Prise
 * seule, l'égalité « trait = couleur du texte » est vraie par construction —
 * « currentColor » la garantit — et passerait même si l'émulation du système
 * ne s'appliquait pas.
 */
let couleurImposeeDeLIcone = null;

let echecs = 0;
function verifier(quoi, vrai, detail = '') {
  if (vrai) {
    console.log(`  ${vert('✓')} ${quoi}`);
  } else {
    echecs += 1;
    console.log(`  ${rouge('✗')} ${quoi}${detail ? ` — ${detail}` : ''}`);
  }
}

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

/**
 * Ce qu'une icône du catalogue montre d'elle-même.
 *
 * On lit le trait et le remplissage CALCULÉS, et non les attributs : l'attribut
 * dit « currentColor », et c'est justement la résolution de ce mot qu'on veut
 * mesurer. Le trait doit valoir la couleur du texte, quoi qu'il arrive —
 * c'est tout ce qui fait qu'une icône suit les quatorze thèmes sans qu'aucun
 * soit nommé, et qu'elle survit aux couleurs imposées du système.
 */
const iconeDe = (page, selecteur) =>
  page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    if (!svg) return null;
    const s = getComputedStyle(svg);
    return {
      trait: s.stroke,
      remplissage: s.fill,
      couleurDuTexte: s.color,
      /* Et celle du parent : une icône qui aurait sa propre couleur passerait
         le contrôle d'égalité ci-dessus en ne suivant rien. */
      couleurDuParent: svg.parentElement ? getComputedStyle(svg.parentElement).color : null,
    };
  }, selecteur);

/** Ce qu'on peut lire du focus d'un élément, une fois qu'il l'a. */
const auFocus = (page, selecteur) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.focus();
    const s = getComputedStyle(el);
    return {
      largeurContour: Number.parseFloat(s.outlineWidth) || 0,
      styleContour: s.outlineStyle,
      ombre: s.boxShadow,
      /* L'élément a-t-il vraiment le focus ? Sans cela, on mesurerait le style
         au repos et l'essai passerait à vide. */
      aLeFocus: document.activeElement === el,
    };
  }, selecteur);

try {
  /* ── 1. Couleurs imposées ────────────────────────────────────────────── */
  console.log(`\n${gras('1. QUAND LE SYSTÈME IMPOSE SES COULEURS')}\n`);
  {
    const contexte = await nav.newContext({ forcedColors: 'active' });
    const page = await contexte.newPage();
    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });

    const champ = await auFocus(page, '#champ-mdp');
    verifier('le champ de mot de passe est là', champ !== null);
    if (champ) {
      verifier('et il prend bien le focus', champ.aLeFocus);
      /*
         LA MESURE QUI COMPTE. Le « ring » de Tailwind est une ombre portée,
         que ce mode supprime : si le contour ne revient pas, il ne reste
         RIEN. On exige donc une épaisseur non nulle et un style visible.
      */
      verifier(
        'son contour de focus existe malgré « outline-none »',
        champ.largeurContour >= 2 && champ.styleContour !== 'none',
        `épaisseur ${champ.largeurContour} px, style « ${champ.styleContour} », ombre « ${champ.ombre} »`,
      );
    }

    const bouton = await auFocus(page, '#bouton-verrou');
    if (bouton) {
      verifier(
        'le bouton de déverrouillage aussi',
        bouton.largeurContour >= 2 && bouton.styleContour !== 'none',
        `épaisseur ${bouton.largeurContour} px, style « ${bouton.styleContour} »`,
      );
    }

    /* ── L'icône du verrou, sous couleurs imposées ────────────────── */
    /*
       H4. L'écran de déverrouillage porte un cadenas, et c'était un émoji :
       en couleurs imposées, un émoji garde SES couleurs — le système ne
       remplace que ce qui passe par les propriétés de couleur. Il devenait
       donc une tache de couleur sur un fond qu'on a demandé contrasté, ou
       disparaissait sur certaines implémentations.

       Devenu un SVG au trait « currentColor », il suit la couleur du texte
       imposée par le système, comme le libellé à côté de lui. C'est ce que
       cette mesure établit, et elle serait impossible sur un émoji.
    */
    const icone = await iconeDe(page, '#ecran-verrou svg');
    verifier('l’écran de verrou porte une icône du catalogue', icone !== null);
    if (icone) {
      couleurImposeeDeLIcone = icone.couleurDuTexte;
      verifier(
        'son trait suit la couleur du texte',
        icone.trait === icone.couleurDuTexte && icone.trait !== 'none',
        `trait « ${icone.trait} » · texte « ${icone.couleurDuTexte} »`,
      );
      verifier(
        'et cette couleur est celle de ce qui l’entoure, pas une couleur propre',
        icone.couleurDuParent === null || icone.couleurDuTexte === icone.couleurDuParent,
        `icône « ${icone.couleurDuTexte} » · parent « ${icone.couleurDuParent} »`,
      );
      /*
         Le remplissage reste absent : la forme est ouverte, et « global.css »
         ne force « fill: currentColor » que pour les formes qui le supportent.
         Un remplissage apparu ici serait un cadenas plein, donc un dessin
         différent de celui des autres thèmes.
      */
      verifier(
        'son remplissage reste ce que le catalogue a posé',
        icone.remplissage === 'none' || icone.remplissage === icone.couleurDuTexte,
        `remplissage « ${icone.remplissage} »`,
      );
    }

    /*
       Et le témoin : dans ce mode, l'ombre portée DOIT avoir disparu. S'il en
       restait une, c'est que l'émulation ne s'applique pas, et les deux
       contrôles ci-dessus ne prouveraient rien.
    */
    verifier(
      'l’émulation est bien active : plus aucune ombre portée',
      champ === null || champ.ombre === 'none',
      `ombre lue : « ${champ?.ombre} »`,
    );
    await contexte.close();
  }

  /* ── 2. Contraste renforcé ───────────────────────────────────────────── */
  console.log(`\n${gras('2. QUAND ON DEMANDE PLUS DE CONTRASTE')}\n`);
  {
    const contexte = await nav.newContext({ contrast: 'more' });
    const page = await contexte.newPage();
    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });

    const jetons = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const lu = (n) => s.getPropertyValue(n).trim();
      return {
        faible: lu('--etat-texte-faible'),
        texte: lu('--etat-texte'),
        bordure: lu('--etat-bordure'),
        fort: lu('--etat-texte-fort'),
      };
    });
    /*
       Les teintes faibles rejoignent les fortes. On le vérifie sur les JETONS
       plutôt que sur un élément : c'est là que la règle agit, et tout ce qui
       les emploie suit sans qu'on ait à énumérer les écrans.
    */
    verifier(
      'le gris de confort rejoint la couleur du texte',
      jetons.faible === jetons.texte && jetons.faible !== '',
      `faible « ${jetons.faible} » · texte « ${jetons.texte} »`,
    );
    verifier(
      'et la bordure discrète rejoint la teinte forte',
      jetons.bordure === jetons.fort && jetons.bordure !== '',
      `bordure « ${jetons.bordure} » · fort « ${jetons.fort} »`,
    );

    const champ = await auFocus(page, '#champ-mdp');
    if (champ) {
      verifier(
        'le contour de focus s’épaissit',
        champ.largeurContour >= 3,
        `épaisseur ${champ.largeurContour} px`,
      );
    }
    await contexte.close();
  }

  /* ── 3. Le témoin, sans aucun réglage ────────────────────────────────── */
  console.log(`\n${gras('3. LE TÉMOIN, SANS RÉGLAGE PARTICULIER')}\n`);
  {
    const contexte = await nav.newContext();
    const page = await contexte.newPage();
    await page.goto(`${RACINE}/`, { waitUntil: 'networkidle' });
    const jetons = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        faible: s.getPropertyValue('--etat-texte-faible').trim(),
        texte: s.getPropertyValue('--etat-texte').trim(),
      };
    });
    /*
       Sans réglage, les deux teintes DIFFÈRENT. Sans ce témoin, un thème où
       elles seraient égales par hasard ferait passer le contrôle du point 2
       sans que la règle y soit pour quoi que ce soit.
    */
    verifier(
      'au repos, le gris de confort reste distinct du texte',
      jetons.faible !== jetons.texte,
      `faible « ${jetons.faible} » · texte « ${jetons.texte} »`,
    );

    /*
       LE TÉMOIN DE L'ICÔNE, et il est le plus utile des trois.

       Sans réglage, l'icône suit déjà la couleur du texte — c'est le propre de
       « currentColor ». Le contrôle du point 1 passerait donc même si
       l'émulation des couleurs imposées ne s'appliquait pas du tout. Ce qu'on
       exige ici, c'est que la couleur AIT CHANGÉ entre les deux modes : c'est
       la preuve que le système a bien substitué sa teinte, et que l'icône l'a
       suivie au lieu de garder la sienne.
    */
    const iconeAuRepos = await iconeDe(page, '#ecran-verrou svg');
    if (iconeAuRepos) {
      verifier(
        'au repos aussi, le trait de l’icône suit la couleur du texte',
        iconeAuRepos.trait === iconeAuRepos.couleurDuTexte,
        `trait « ${iconeAuRepos.trait} » · texte « ${iconeAuRepos.couleurDuTexte} »`,
      );
      /*
         LA COMPARAISON, qui est le seul contrôle non trivial des trois : la
         couleur de l'icône DIFFÈRE entre les deux modes. C'est elle qui dit que
         le système a substitué sa teinte et que l'icône l'a suivie, au lieu de
         garder la sienne comme le faisait l'émoji.
      */
      verifier(
        'et sous couleurs imposées, cette couleur n’était pas la même',
        couleurImposeeDeLIcone !== null &&
          couleurImposeeDeLIcone !== iconeAuRepos.couleurDuTexte,
        `imposée « ${couleurImposeeDeLIcone} » · au repos « ${iconeAuRepos.couleurDuTexte} »`,
      );
    }
    await contexte.close();
  }
} catch (erreur) {
  echecs += 1;
  console.log(`\n${rouge('✗ PANNE')} — ${String(erreur?.message ?? erreur).slice(0, 700)}`);
} finally {
  await nav.close().catch(() => {});
}

console.log(
  echecs
    ? `\n${rouge(`${echecs} essai(s) en échec.`)}\n`
    : `\n${vert('Tous les essais passent.')}\n`,
);
process.exit(echecs ? 1 : 0);
