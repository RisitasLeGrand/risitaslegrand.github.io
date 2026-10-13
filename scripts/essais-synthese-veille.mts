/**
 * Essais de la synthèse médecin — phase 4.
 *
 * Le document le plus dangereux du dispositif : il est fait pour être lu par
 * quelqu'un dont l'avis compte, et il sort d'un programme qui ne mesure rien
 * de clinique. Trois choses doivent donc tenir, et aucune ne se relit.
 *
 *   1. **Les avertissements sont là.** Un document d'apparence médicale qui
 *      aurait perdu ses dénégations en route serait pire que pas de document.
 *   2. **Les chiffres sont permis ici, et interdits sur la carte.** C'est
 *      délibéré, et un essai le dit — sans quoi la prochaine lecture prendra
 *      l'écart pour un oubli et l'« harmonisera ».
 *   3. **Rien n'y fuit.** Ni auto-évaluation, ni score d'échelle, ni intitulé
 *      de note, de tâche ou de repas.
 */
import {
  MESURE,
  controlerLaMesure,
  controlerLaSynthese,
  lignesFabriquees,
  syntheseEnTexte,
  syntheseMedecin,
  type EntreeDeSynthese,
} from '../src/lib/odyssee/synthese-veille';
import { controlerFormulations, REGLAGES_FIXES_LE } from '../src/lib/odyssee/moteur-veille';
import { CATALOGUE, type Indicateur } from '../src/lib/odyssee/veille';
import { NON_COLLECTES } from '../src/lib/odyssee/mesures-veille';
import { REGLAGES_PAR_DEFAUT, type SignalEnregistre } from '../src/lib/odyssee/signal-veille';

let reussis = 0;
const echecs: string[] = [];
const verifier = (titre: string, condition: boolean, detail = '') => {
  if (condition) reussis += 1;
  else echecs.push(`${titre}${detail ? ` — ${detail}` : ''}`);
};
const egal = (titre: string, obtenu: unknown, attendu: unknown) =>
  verifier(
    titre,
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
  );

const signal = (bout: Partial<SignalEnregistre> = {}): SignalEnregistre => ({
  id: 'vr-2026-05-04-0000',
  jour: '2026-05-04',
  depuis: '2026-04-14',
  sensibilite: 'standard',
  indicateurs: ['sommeil.duree', 'focus.minutes', 'sport.frequence'],
  domaines: ['sommeil', 'engagement', 'activite'],
  appuis: [],
  contextes: [],
  baseArreteeAu: '2026-04-13',
  closLe: '2026-05-05',
  reponse: 'vu',
  montreLe: '2026-05-04',
  majLe: '2026-05-05',
  ...bout,
});

const entree = (bout: Partial<EntreeDeSynthese> = {}): EntreeDeSynthese => ({
  jour: '2026-10-13',
  reglages: { ...REGLAGES_PAR_DEFAUT, active: true, majLe: '2026-10-13' },
  signaux: [signal()],
  contextes: [
    {
      id: 'c1',
      motif: 'examens',
      debut: '2026-04-20',
      fin: '2026-04-30',
      domaines: ['engagement'],
    },
  ],
  /*
     Ce que le collecteur alimenterait vraiment : ni les cinq indicateurs que
     personne n'alimente encore, ni le domaine du corps, que cette personne ne
     saisit pas. Un jeu d'essai qui déclarerait tout alimenté masquerait
     justement la distinction que la synthèse doit faire.
  */
  alimentes: CATALOGUE.filter(
    (i) => i.domaine !== 'corps' && !NON_COLLECTES.includes(i.id),
  ).map((i) => i.id),
  ...bout,
});

/* ══════════════════════════════════════════════════════════════════════════
   1. Le document tient debout
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n1. LE DOCUMENT');
{
  const s = syntheseMedecin(entree());
  egal('1.1 les sept sections sont là, dans l’ordre de lecture',
    s.sections.map((x) => x.titre),
    [
      'Ce que ce document est',
      'La période et le réglage',
      'Les repères levés',
      'Les périodes particulières déclarées',
      'Ce qui est observé, et ce qui ne l’est pas',
      'Ce que ces repères valent',
      'Ce que ce document ne contient pas',
    ]);
  egal('1.2 le contrôle ne trouve rien à redire', controlerLaSynthese(s), []);
  egal('1.3 ni les chiffres recopiés', controlerLaMesure(), []);

  const texte = syntheseEnTexte(s);
  verifier('1.4 le texte porte le titre et la date', texte.startsWith('Veille du rythme de vie'));
  verifier('1.5 il cite le jour du repère', texte.includes('04/05/2026'));
  verifier('1.6 il nomme les domaines concernés en toutes lettres',
    texte.includes('Sommeil') && texte.includes('Travail, révisions, engagement'));
  verifier('1.7 il rapporte la réponse donnée', texte.includes('Réponse : « Je l’ai vu »'));
  verifier('1.7 bis les domaines ne se confondent pas avec leurs virgules',
    texte.includes('Sommeil / Travail, révisions, engagement / Activité et entraînement'));
  verifier('1.8 il cite la période particulière déclarée',
    texte.includes('des examens') && texte.includes('20/04/2026'));
  verifier('1.9 aucune ligne vide en triple', !/\n\n\n/.test(texte));
}

{
  const s = syntheseMedecin(entree({ signaux: [], contextes: [] }));
  const texte = syntheseEnTexte(s);
  verifier('1.10 sans repère, il le dit au lieu de laisser un blanc',
    texte.includes('Aucun repère n’a été levé.'));
  verifier('1.11 sans contexte déclaré non plus',
    texte.includes('Aucune période particulière n’a été déclarée.'));
  egal('1.12 et il reste valide', controlerLaSynthese(s), []);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Les avertissements
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n2. LES AVERTISSEMENTS');
{
  const s = syntheseMedecin(entree());
  const prose = s.sections.flatMap((x) => x.prose).join(' ');
  verifier('2.1 il est dit que rien n’est dépisté', prose.includes('ne dépiste rien'));
  verifier('2.2 et rien diagnostiqué', prose.includes('ne diagnostique rien'));
  verifier('2.3 qu’il n’existe ni sensibilité ni spécificité',
    prose.includes('ni sensibilité, ni spécificité'));
  verifier('2.4 que l’absence de repère ne rassure pas',
    prose.includes('L’absence de repère ne signifie pas que tout va bien'));
  verifier('2.5 et que rien ne sort de l’appareil',
    prose.includes('rien n’en sort') && prose.includes('n’est conservé nulle part'));

  /*
     Le garde doit pouvoir échouer, sinon il ne prouve rien. On retire une
     dénégation, et on vérifie qu'elle manque bruyamment.
  */
  const ampute = {
    ...s,
    sections: s.sections.map((x) =>
      x.titre === 'Ce que ce document est'
        ? { ...x, prose: x.prose.filter((p) => !p.includes('ne dépiste rien')) }
        : x,
    ),
  };
  verifier('2.6 une dénégation retirée est signalée',
    controlerLaSynthese(ampute).some((p) => p.includes('ne dépiste rien')),
    JSON.stringify(controlerLaSynthese(ampute)));

  const sansSection = { ...s, sections: s.sections.slice(0, 6) };
  verifier('2.7 la section de ce qui est tu ne peut pas disparaître',
    controlerLaSynthese(sansSection).some((p) => p.includes('ne contient pas')));
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Les deux régimes de chiffres
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n3. LES CHIFFRES, ICI OUI, SUR LA CARTE NON');
{
  const lignes = lignesFabriquees(syntheseMedecin(entree()));
  verifier('3.1 les lignes fabriquées portent bien des chiffres',
    lignes.some((l) => /\d/.test(l)));
  /*
     Le même texte, soumis au contrôle de la carte, serait refusé — et c'est
     exactement la différence qu'on veut rendre visible. Un lecteur pressé
     prendrait sinon l'écart pour un oubli, et « harmoniserait » les deux
     contrôles au détriment du seul document qu'un médecin lira.
  */
  verifier('3.2 le contrôle de la carte les refuserait, lui',
    controlerFormulations(lignes).some((p) => p.includes('Un chiffre')));
  egal('3.3 celui de la synthèse ne s’en émeut pas',
    controlerLaSynthese(syntheseMedecin(entree())), []);

  // Le vocabulaire, lui, reste interdit des deux côtés.
  const catalogue: Indicateur[] = CATALOGUE.map((i) =>
    i.id === 'sommeil.duree' ? { ...i, libelle: 'Détection des nuits courtes' } : i,
  );
  const s = syntheseMedecin(entree({ catalogue }));
  verifier('3.4 un libellé d’indicateur au mauvais vocabulaire est signalé',
    controlerLaSynthese(s).some((p) => p.includes('détection')),
    JSON.stringify(controlerLaSynthese(s)).slice(0, 200));
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Ce qui ne doit pas s'y trouver
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n4. CE QUI N’Y EST PAS');
{
  const texte = syntheseEnTexte(syntheseMedecin(entree()));
  for (const interdit of ['PHQ', 'GAD', 'WHO-5']) {
    verifier(`4.1 aucun score d’échelle (${interdit})`, !texte.includes(interdit));
  }
  /*
     Le mot « humeur » figure dans la prose, et il doit y figurer : c'est la
     dénégation. Ce qu'on surveille, ce sont les **lignes fabriquées** — celles
     qui sortent des données —, où ni une humeur ni un check-in ne doivent
     jamais apparaître.
  */
  const lignes = lignesFabriquees(syntheseMedecin(entree()));
  verifier('4.2 aucune auto-évaluation dans ce qui vient des données',
    !lignes.some((l) => /humeur|check-?in|échelle/i.test(l)),
    lignes.filter((l) => /humeur|check-?in|échelle/i.test(l)).join(' | '));
  verifier('4.3 mais il est dit qu’elles existent et qu’elles sont tues',
    texte.includes('Aucune auto-évaluation d’humeur') &&
      texte.includes('Aucun score de questionnaire'));
  verifier('4.4 et qu’aucun intitulé n’a traversé le calcul',
    texte.includes('jamais des intitulés'));

  /*
     Les identifiants techniques n'ont rien à faire sous les yeux d'un
     médecin : la synthèse doit parler de « Durée de sommeil », pas de
     « sommeil.duree ». C'est aussi la garantie qu'elle ne recopie pas une
     structure interne sans la traduire.
  */
  verifier('4.5 aucun identifiant technique n’apparaît',
    !/\b[a-z]+\.[a-z-]+\b/.test(texte.replace(/\.\s/g, ' ')),
    (texte.match(/\b[a-z]+\.[a-z-]+\b/) ?? []).join());
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Les chiffres recopiés vieillissent
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n5. LES CHIFFRES RECOPIÉS');
{
  verifier('5.1 la mesure n’est pas antérieure au dernier arrêt des seuils',
    MESURE.faiteLe >= REGLAGES_FIXES_LE, `${MESURE.faiteLe} contre ${REGLAGES_FIXES_LE}`);

  const sauvegarde = { ...MESURE.parSensibilite.attentive };
  MESURE.parSensibilite.attentive = { ...sauvegarde, vues: 10 };
  verifier('5.2 si « Attentive » se mettait à mieux repérer, le garde le dirait',
    controlerLaMesure().some((p) => p.includes('réglage par défaut')),
    JSON.stringify(controlerLaMesure()));
  MESURE.parSensibilite.attentive = { ...sauvegarde, fauxParAn: 0 };
  verifier('5.3 si elle cessait de déranger davantage, aussi',
    controlerLaMesure().some((p) => p.includes('dérange davantage')));
  MESURE.parSensibilite.attentive = sauvegarde;
  egal('5.4 et tout rentre dans l’ordre une fois rétabli', controlerLaMesure(), []);
}

/* ── Bilan ─────────────────────────────────────────────────────────────── */

console.log(`\n${reussis} essais réussis, ${echecs.length} échec(s).`);
for (const e of echecs) console.log(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
