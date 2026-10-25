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
