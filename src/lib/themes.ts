/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║  LES QUATORZE THÈMES DE CYCLADES — source unique                       ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * Un thème, c'est **douze rôles** et rien d'autre. Pas une échelle de gris,
 * pas une famille Tailwind : douze couleurs qui disent à quoi elles servent
 * — un fond, un texte, une action, une erreur. Tout le reste en est dérivé
 * par `scripts/construire-themes.mts`, qui écrit les fichiers CSS.
 *
 * C'est le seul endroit où une couleur de thème est écrite à la main. Le
 * contrôle `essais:couleurs-jetons` fait échouer la batterie si une couleur
 * littérale réapparaît ailleurs dans `src/`.
 *
 * ## Les modes manquants
 *
 * Trois thèmes n'ont qu'un mode : Papier est un thème de jour, Soir et Nuit
 * de Délos sont des thèmes de nuit. Dans l'autre mode, **Égée prend le
 * relais** — ce n'est pas un défaut, c'est la règle du § 4 de l'addendum.
 * `modeEffectif()` plus bas est la seule fonction qui connaisse ce relais ;
 * l'écran et le script d'amorçage l'appellent tous les deux, pour ne pas
 * répondre deux choses différentes à la même question.
 *
 * ## Séance n'est pas dans le sélecteur
 *
 * Il prend la main pendant une séance de sport, quel que soit le thème
 * choisi, puis rend la main. Il est donc rangé à part (`THEMES_DE_SEANCE`)
 * et n'apparaît jamais dans la liste proposée.
 */

/** Les douze rôles d'un mode. Les noms sont ceux des jetons `--etat-*`. */
export interface Roles {
  fond: string;
  fondEleve: string;
  fondAlt: string;
  bordure: string;
  texte: string;
  texteFaible: string;
  action: string;
  texteSurAction: string;
  actionFond: string;
  succes: string;
  alerte: string;
  erreur: string;
}

export type Mode = 'clair' | 'sombre';
export type Groupe = 'identite' | 'usage' | 'accessibilite';

export interface Theme {
  id: string;
  nom: string;
  /** Ce que le thème montre, en une phrase. Texte du tableau 4.2. */
  description: string;
  /** À quoi il sert. Texte du tableau 4.2. */
  pourQuoi: string;
  groupe: Groupe;
  clair?: Roles;
  sombre?: Roles;
}

export const GROUPES: { id: Groupe; nom: string }[] = [
  { id: 'identite', nom: 'Identité' },
  { id: 'usage', nom: 'Usage' },
  { id: 'accessibilite', nom: 'Accessibilité' },
];

export const THEME_PAR_DEFAUT = 'egee';

export const THEMES: Theme[] = [
  {
    id: 'egee',
    nom: 'Égée',
    description: 'Chaux blanche et bleu des volets ; la nuit, bleu marine',
    pourQuoi: 'Le thème de Cyclades, sobre et net',
    groupe: 'identite',
    clair: {
      fond: '#F7F5F0',
      fondEleve: '#FFFFFF',
      fondAlt: '#ECEAE3',
      bordure: '#D9D5CB',
      texte: '#1C2430',
      texteFaible: '#59616C',
      action: '#0B4F8A',
      texteSurAction: '#FFFFFF',
      actionFond: '#E3EDF7',
      succes: '#1E6B3A',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#0B1622',
      fondEleve: '#122233',
      fondAlt: '#1A2D42',
      bordure: '#24384F',
      texte: '#E6EDF3',
      texteFaible: '#9AABBD',
      action: '#7FB2E5',
      texteSurAction: '#0B1622',
      actionFond: '#16304A',
      succes: '#6FCF97',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'republique',
    nom: 'République',
    description: 'Bleu France et rouge Marianne ; la nuit, bleu nuit et indigo',
    pourQuoi: "L'allure des sites de l'État, celle des débuts",
    groupe: 'identite',
    clair: {
      fond: '#F6F6F6',
      fondEleve: '#FFFFFF',
      fondAlt: '#EEEEEE',
      bordure: '#DDDDDD',
      texte: '#3A3A3A',
      texteFaible: '#666666',
      action: '#000091',
      texteSurAction: '#FFFFFF',
      actionFond: '#F5F5FE',
      succes: '#18753C',
      alerte: '#B34000',
      erreur: '#E1000F',
    },
    sombre: {
      fond: '#020617',
      fondEleve: '#0F172A',
      fondAlt: '#1E293B',
      bordure: '#1E293B',
      texte: '#E2E8F0',
      texteFaible: '#94A3B8',
      action: '#818CF8',
      texteSurAction: '#020617',
      actionFond: '#1E1B4B',
      succes: '#34D399',
      alerte: '#FBBF24',
      erreur: '#F87171',
    },
  },
  {
    id: 'santorin',
    nom: 'Santorin',
    description: 'Pierre claire et terre cuite ; la nuit, roche volcanique et braise',
    pourQuoi: 'Chaleureux, pour les longues journées',
    groupe: 'identite',
    clair: {
      fond: '#F6F1EA',
      fondEleve: '#FFFDF9',
      fondAlt: '#ECE4D9',
      bordure: '#DACDBC',
      texte: '#2B211C',
      texteFaible: '#6A5A4F',
      action: '#A3442A',
      texteSurAction: '#FFFFFF',
      actionFond: '#F6E3DB',
      succes: '#2F6B33',
      alerte: '#8A4B00',
      erreur: '#A8231B',
    },
    sombre: {
      fond: '#1A1412',
      fondEleve: '#241C19',
      fondAlt: '#2F2521',
      bordure: '#3D312C',
      texte: '#EFE6DD',
      texteFaible: '#B3A397',
      action: '#E58C6E',
      texteSurAction: '#1A1412',
      actionFond: '#3A2219',
      succes: '#8BCF8F',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'olivier',
    nom: 'Olivier',
    description: 'Sable et vert olive ; la nuit, sous-bois',
    pourQuoi: 'Reposant, proche de la nature',
    groupe: 'identite',
    clair: {
      fond: '#F4F5EF',
      fondEleve: '#FFFFFF',
      fondAlt: '#E8EADF',
      bordure: '#D2D6C5',
      texte: '#1F2A1F',
      texteFaible: '#596357',
      action: '#4A6B2A',
      texteSurAction: '#FFFFFF',
      actionFond: '#E5EDD9',
      succes: '#1E6B3A',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#121711',
      fondEleve: '#1A2119',
      fondAlt: '#232B21',
      bordure: '#2F392C',
      texte: '#E4EADF',
      texteFaible: '#A2AE9C',
      action: '#A3C47A',
      texteSurAction: '#121711',
      actionFond: '#253118',
      succes: '#7FD39A',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'naxos',
    nom: 'Naxos',
    description: 'Marbre gris et or ancien ; la nuit, pierre sombre et or doux',
    pourQuoi: 'Solennel, pour se mettre en condition de concours',
    groupe: 'identite',
    clair: {
      fond: '#F5F4F1',
      fondEleve: '#FFFFFF',
      fondAlt: '#EAE8E2',
      bordure: '#D6D2C8',
      texte: '#23211D',
      texteFaible: '#5E5A52',
      action: '#7A5A12',
      texteSurAction: '#FFFFFF',
      actionFond: '#F3EAD3',
      succes: '#2C6A35',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#16150F',
      fondEleve: '#201F18',
      fondAlt: '#2A2820',
      bordure: '#3A372C',
      texte: '#EDEAE1',
      texteFaible: '#B1AB9C',
      action: '#D9B45A',
      texteSurAction: '#16150F',
      actionFond: '#352B12',
      succes: '#86D19A',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'milos',
    nom: 'Milos',
    description: 'Roche blanche et turquoise ; la nuit, lagon sombre',
    pourQuoi: 'Frais, très lisible en plein jour',
    groupe: 'identite',
    clair: {
      fond: '#F3F7F6',
      fondEleve: '#FFFFFF',
      fondAlt: '#E4EDEB',
      bordure: '#C9D8D5',
      texte: '#14262A',
      texteFaible: '#4D6064',
      action: '#0B6B6B',
      texteSurAction: '#FFFFFF',
      actionFond: '#D8EEEC',
      succes: '#1E6B3A',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#0A1A1C',
      fondEleve: '#112427',
      fondAlt: '#183034',
      bordure: '#223E42',
      texte: '#E2F0EE',
      texteFaible: '#98B2B0',
      action: '#5FD0C8',
      texteSurAction: '#0A1A1C',
      actionFond: '#123B3B',
      succes: '#7FD39A',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'amorgos',
    nom: 'Amorgos',
    description: 'Lavande et violet profond ; la nuit, violet sombre',
    pourQuoi: 'Apaisant, pour réviser le soir',
    groupe: 'identite',
    clair: {
      fond: '#F6F4F8',
      fondEleve: '#FFFFFF',
      fondAlt: '#ECE8F1',
      bordure: '#D6CFE0',
      texte: '#221D2B',
      texteFaible: '#5D5668',
      action: '#5B3E96',
      texteSurAction: '#FFFFFF',
      actionFond: '#EAE2F6',
      succes: '#1E6B3A',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#14111B',
      fondEleve: '#1D1926',
      fondAlt: '#272232',
      bordure: '#352E44',
      texte: '#ECE7F3',
      texteFaible: '#ADA4BD',
      action: '#B9A1EC',
      texteSurAction: '#14111B',
      actionFond: '#2C2342',
      succes: '#7FD39A',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'aube',
    nom: 'Aube',
    description: 'Blanc rosé et framboise ; la nuit, prune',
    pourQuoi: 'Doux, pour bien commencer la journée',
    groupe: 'identite',
    clair: {
      fond: '#FBF4F0',
      fondEleve: '#FFFFFF',
      fondAlt: '#F3E7E0',
      bordure: '#E3D0C6',
      texte: '#2A1E1C',
      texteFaible: '#665552',
      action: '#A3365A',
      texteSurAction: '#FFFFFF',
      actionFond: '#F8E1E8',
      succes: '#2C6A35',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#1B1214',
      fondEleve: '#251A1C',
      fondAlt: '#302326',
      bordure: '#413033',
      texte: '#F2E6E4',
      texteFaible: '#B9A5A3',
      action: '#F09AB4',
      texteSurAction: '#1B1214',
      actionFond: '#40202B',
      succes: '#86D19A',
      alerte: '#F2B866',
      erreur: '#FF9A8A',
    },
  },
  {
    id: 'papier',
    nom: 'Papier',
    description: "Sépia et encre brune, comme une page de livre",
    pourQuoi: 'Lire longtemps sans être ébloui',
    groupe: 'usage',
    clair: {
      fond: '#F4ECD8',
      fondEleve: '#FAF5E8',
      fondAlt: '#EADFC6',
      bordure: '#D8C9A8',
      texte: '#3B2F1E',
      texteFaible: '#6B5A42',
      action: '#7A4E1D',
      texteSurAction: '#FFFFFF',
      actionFond: '#EBDDBF',
      succes: '#3A6326',
      alerte: '#8A4300',
      erreur: '#9E2A1E',
    },
  },
  {
    id: 'soir',
    nom: 'Soir',
    description: 'Ambre doux, presque sans lumière bleue',
    pourQuoi: 'Les derniers moments avant de dormir',
    groupe: 'usage',
    sombre: {
      fond: '#1A1410',
      fondEleve: '#231B16',
      fondAlt: '#2D231C',
      bordure: '#3B2E25',
      texte: '#E8D8C0',
      texteFaible: '#B09D86',
      action: '#D9A066',
      texteSurAction: '#1A1410',
      actionFond: '#3A2A1A',
      succes: '#A8C98A',
      alerte: '#E8B860',
      erreur: '#E8907E',
    },
  },
  {
    id: 'delos',
    nom: 'Nuit de Délos',
    description: 'Noir pur, texte gris clair, touches de bleu pâle',
    pourQuoi: 'Lire dans le noir et ménager la batterie (écrans OLED)',
    groupe: 'usage',
    sombre: {
      fond: '#000000',
      fondEleve: '#0E0E10',
      fondAlt: '#18181C',
      bordure: '#26262C',
      texte: '#E8E8E8',
      texteFaible: '#A0A0A8',
      action: '#9DB8FF',
      texteSurAction: '#000000',
      actionFond: '#141C33',
      succes: '#6FCF97',
      alerte: '#F2C066',
      erreur: '#FF8A80',
    },
  },
  {
    id: 'ardoise',
    nom: 'Ardoise',
    description: 'Gris et graphite, sans couleur vive',
    pourQuoi: "Se concentrer, sans rien qui attire l'œil",
    groupe: 'usage',
    clair: {
      fond: '#F4F4F3',
      fondEleve: '#FFFFFF',
      fondAlt: '#E8E8E6',
      bordure: '#D0D0CD',
      texte: '#1D1E20',
      texteFaible: '#58595C',
      action: '#2E3238',
      texteSurAction: '#FFFFFF',
      actionFond: '#E2E3E5',
      succes: '#2B6A3C',
      alerte: '#8A4B00',
      erreur: '#B3261E',
    },
    sombre: {
      fond: '#131416',
      fondEleve: '#1B1C1F',
      fondAlt: '#24262A',
      bordure: '#33363B',
      texte: '#E6E7E9',
      texteFaible: '#A3A6AB',
      action: '#D8DBDF',
      texteSurAction: '#131416',
      actionFond: '#2C2F34',
      succes: '#86D19A',
      alerte: '#F2B866',
      erreur: '#F28B82',
    },
  },
  {
    id: 'contraste',
    nom: 'Contraste élevé',
    description: 'Noir sur blanc ; blanc et jaune sur noir',
    pourQuoi: 'En plein soleil, ou quand la vue fatigue',
    groupe: 'accessibilite',
    clair: {
      fond: '#FFFFFF',
      fondEleve: '#FFFFFF',
      fondAlt: '#F0F0F0',
      bordure: '#000000',
      texte: '#000000',
      texteFaible: '#333333',
      action: '#0000CC',
      texteSurAction: '#FFFFFF',
      actionFond: '#E6E6FF',
      succes: '#005A1F',
      alerte: '#6B3500',
      erreur: '#A00000',
    },
    sombre: {
      fond: '#000000',
      fondEleve: '#000000',
      fondAlt: '#141414',
      bordure: '#FFFFFF',
      texte: '#FFFFFF',
      texteFaible: '#DDDDDD',
      action: '#FFFF00',
      texteSurAction: '#000000',
      actionFond: '#262600',
      succes: '#7CFF9E',
      alerte: '#FFC24D',
      erreur: '#FF8A8A',
    },
  },
  {
    id: 'adaptees',
    nom: 'Couleurs adaptées',
    description: 'Bleu et orange au lieu du vert et du rouge',
    pourQuoi: "Si l'on distingue mal le rouge du vert",
    groupe: 'accessibilite',
    clair: {
      fond: '#F7F7F5',
      fondEleve: '#FFFFFF',
      fondAlt: '#ECECE8',
      bordure: '#D4D4CE',
      texte: '#1B1F24',
      texteFaible: '#565C64',
      action: '#0B57B3',
      texteSurAction: '#FFFFFF',
      actionFond: '#E1ECFA',
      succes: '#0B57B3',
      alerte: '#7A5C00',
      erreur: '#A8430A',
    },
    sombre: {
      fond: '#0F1318',
      fondEleve: '#171C23',
      fondAlt: '#20262F',
      bordure: '#2D3540',
      texte: '#E7EBF0',
      texteFaible: '#A0A9B4',
      action: '#7DB4FF',
      texteSurAction: '#0F1318',
      actionFond: '#18304F',
      succes: '#7DB4FF',
      alerte: '#F0D060',
      erreur: '#FFA05C',
    },
  },
];

/**
 * Les deux variantes du thème Séance. Hors sélecteur : il s'impose pendant
 * une séance de sport et rend la main à la fin.
 */
export const THEMES_DE_SEANCE: { id: string; nom: string; mode: Mode; roles: Roles }[] = [
  {
    id: 'seance-soleil',
    nom: 'Plein soleil',
    mode: 'clair',
    roles: {
      fond: '#FFFFFF',
      fondEleve: '#FFFFFF',
      fondAlt: '#F1F1F1',
      bordure: '#CFCFCF',
      texte: '#000000',
      texteFaible: '#3D3D3D',
      action: '#B34100',
      texteSurAction: '#FFFFFF',
      actionFond: '#FFE9DC',
      succes: '#0B6B2C',
      alerte: '#7A3E00',
      erreur: '#B00020',
    },
  },
  {
    id: 'seance-salle',
    nom: 'Salle',
    mode: 'sombre',
    roles: {
      fond: '#000000',
      fondEleve: '#0F0F0F',
      fondAlt: '#1A1A1A',
      bordure: '#2A2A2A',
      texte: '#FFFFFF',
      texteFaible: '#B5B5B5',
      action: '#FF8A3D',
      texteSurAction: '#000000',
      actionFond: '#2A1608',
      succes: '#6FDB8F',
      alerte: '#FFC24D',
      erreur: '#FF7A70',
    },
  },
];

export const theme = (id: string): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === THEME_PAR_DEFAUT)!;

/**
 * Quel thème rend réellement un mode donné.
 *
 * Papier n'a pas de mode sombre, Soir et Nuit de Délos pas de mode clair :
 * Égée prend le relais. Une seule fonction le sait, et l'écran comme le
 * script d'amorçage l'appellent — deux réponses différentes à la même
 * question produiraient un éclair au chargement, qui est précisément ce que
 * l'addendum interdit.
 */
export function themeEffectif(id: string, mode: Mode): string {
  return theme(id)[mode] ? theme(id).id : THEME_PAR_DEFAUT;
}

/** Les modes qu'un thème possède en propre. */
export const modesDe = (t: Theme): Mode[] =>
  (['clair', 'sombre'] as Mode[]).filter((m) => Boolean(t[m]));
