/**
 * Les repères audio des parties d'une fiche (prompt 46, P2).
 *
 *   npm run essais:reperes-audio
 *   npm run essais:reperes-audio -- --avec-la-voix   (Kokoro réel ; long)
 *
 * ## Ce que cet essai constate, et comment
 *
 * Le prompt exige « moins de 0,5 s d'écart avec le début de la lecture du
 * titre de la partie ». Un écart ne se raisonne pas : il se mesure sur l'onde
 * produite. L'essai part donc des deux commandes réelles — celle qui écrit le
 * script parlé, celle qui le met en voix — et relit le son qui en sort.
 *
 * La voix, elle, est remplacée. Non pour s'épargner la mesure, mais pour que
 * l'essai tourne partout : le modèle Kokoro pèse 325 Mo et n'est pas dans le
 * dépôt. La voix de laboratoire émet, au premier échantillon de chaque
 * paragraphe, une impulsion d'amplitude connue — un jalon qu'on retrouve dans
 * l'onde finale. Tout le reste est le code livré : le découpage en
 * paragraphes, les respirations, le cumul des échantillons, le calcul du
 * repère. C'est précisément ce code-là qu'on éprouve ; la qualité de la
 * diction n'entre pas en jeu dans la position d'un repère.
 *
 * Avec « --avec-la-voix », l'essai refait la mesure sur du vrai Kokoro :
 * l'audio publié est décodé par ffmpeg et l'on cherche l'attaque de la voix
 * autour de chaque repère. C'est la mesure de référence, et elle demande le
 * modèle installé (« npm run podcasts:installer »).
 *
 * ## Ce qu'il ne touche pas
 *
 * Il travaille dans « content/ », qu'il crée à partir de « content-exemple/ »
 * et qu'il efface ensuite. Si « content/ » existe déjà, il ne s'exécute pas et
 * le dit : les fiches réelles ne sont pas un terrain d'essai.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const avecLaVoix = process.argv.includes('--avec-la-voix');

let rouges = 0;
const vert = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rouge = (t: string) => `\x1b[31m${t}\x1b[0m`;
const jaune = (t: string) => `\x1b[33m${t}\x1b[0m`;

function verifier(quoi: string, vrai: boolean, detail = '') {
  if (vrai) {
    console.log(`${vert('✓')} ${quoi}${detail ? ` ${jaune(detail)}` : ''}`);
    return;
  }
  console.log(`${rouge('✗')} ${quoi}${detail ? `\n    ${detail}` : ''}`);
  rouges += 1;
}

/* ── Le laboratoire ──────────────────────────────────────────────────────── */

const dossierContenu = path.join(racine, 'content');
if (existsSync(dossierContenu)) {
  console.log(
    jaune('! essai non exécuté : « content/ » existe déjà.') +
      '\n  Cet essai crée et efface « content/ » ; il ne touchera pas à des fiches réelles.',
  );
  process.exit(0);
}

const node = (script: string, env: Record<string, string> = {}) =>
  execFileSync(process.execPath, [path.join(racine, 'scripts', script)], {
    cwd: racine,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

const nettoyer = () => rmSync(dossierContenu, { recursive: true, force: true });
process.once('exit', nettoyer);

console.log('\nLE SCRIPT PARLÉ');
node('init-contenu.mjs');
const journal = node('podcasts.mjs', avecLaVoix ? {} : { REVINSP_SANS_PODCAST: '1' });
verifier('« podcasts.mjs » écrit les scripts parlés', /script\(s\) à jour/.test(journal));

/* Les fiches de « content-exemple/ » : trois parties chacune, identifiants posés. */
const SCRIPTS = [
  'droit-public/fascicule-1/fiche-01-hierarchie-des-normes.podcast.md',
  'droit-public/fascicule-1/fiche-02-principe-de-legalite.podcast.md',
  'questions-internationales/fascicule-3/fiche-01-pandemie-relations-internationales.podcast.md',
].map((r) => path.join(dossierContenu, r));

verifier('les trois scripts parlés sont là', SCRIPTS.every((s) => existsSync(s)));

/*
   LE DÉFAUT QUE P2 CORRIGE AU PASSAGE : le marqueur d'identifiant posé par P1
   se disait à voix haute, et le commentaire d'en-tête du script s'entendait en
   ouverture de chaque fiche. Les deux se constatent sur le fichier produit.
*/
for (const chemin of SCRIPTS) {
  const brut = readFileSync(chemin, 'utf8');
  const corps = brut.slice(brut.indexOf('\n---', 3) + 4);
  verifier(
    `aucun marqueur « {#…} » dans le texte dit — ${path.basename(chemin)}`,
    !corps.includes('{#'),
  );
  verifier(
    `le front-matter porte la ligne « parties: » — ${path.basename(chemin)}`,
    /^parties:\s*\[\{/m.test(brut),
  );
}

/* ── La mesure ───────────────────────────────────────────────────────────── */

/**
 * Le banc Python : il importe « scripts/synthese-voix.py », substitue la voix,
 * et laisse le code livré faire le reste. Écrit en dur ici plutôt que dans un
 * fichier du dépôt : c'est l'instrument de cet essai, il n'a pas d'autre
 * usage, et le lire à côté de ce qu'il mesure vaut mieux que de le chercher.
 */
const BANC = `
import importlib.util, json, re, sys, types, wave

chemin_module, dossier, sortie_wav = sys.argv[1], sys.argv[2], sys.argv[3]
spec = importlib.util.spec_from_file_location("sv", chemin_module)
sv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sv)

TAUX = 24000

class VoixDeLaboratoire:
    """
    Une voix dont on connaît l'onde par avance.

    Au PREMIER échantillon de chaque paragraphe, une impulsion d'amplitude
    « 30000 - rang du paragraphe » : un jalon unique, qu'on retrouve ensuite
    dans l'onde finale sans avoir à refaire le calcul qu'on veut vérifier.
    Le corps de la parole reste sous 250, les silences sont nuls.
    """

    taux = TAUX

    def __init__(self):
        self.rang = -1

    def phrases(self, paragraphe):
        self.rang += 1
        phrases = [p for p in re.split(r"(?<=[.!?])\\s+", paragraphe) if p]
        for k, phrase in enumerate(phrases):
            n = max(2, len(phrase) * TAUX // 100)  # 10 ms par caractère
            valeurs = [((i * 37 + 11) % 400) - 200 for i in range(n)]
            if k == 0:
                valeurs[0] = 30000 - self.rang
            yield b"".join(int(v).to_bytes(2, "little", signed=True) for v in valeurs)

args = types.SimpleNamespace(silence_paragraphe=560, silence_phrase=190)

resultats = []
for relatif in json.loads(dossier):
    paragraphes = sv.lire_script(relatif)
    reperes_declares = sv.lire_reperes(relatif)
    brut, reperes = sv.synthetiser(VoixDeLaboratoire(), paragraphes, args, reperes_declares)
    resultats.append({
        "fichier": relatif,
        "paragraphes": paragraphes,
        "declares": reperes_declares,
        "reperes": reperes,
        "secondes": round(len(brut) / 2 / TAUX, 3),
    })
    if relatif == json.loads(dossier)[0]:
        with wave.open(sortie_wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(TAUX)
            w.writeframes(brut)

print(json.dumps(resultats, ensure_ascii=False))
`;

const scratch = path.join(racine, 'content', '.essai');
execFileSync('mkdir', ['-p', scratch]);
const cheminBanc = path.join(scratch, 'banc.py');
const cheminWav = path.join(scratch, 'laboratoire.wav');
writeFileSync(cheminBanc, BANC);

type Resultat = {
  fichier: string;
  paragraphes: string[];
  declares: { id: string; paragraphe: number }[];
  reperes: { id: string; debut: number }[];
  secondes: number;
};

const mesures: Resultat[] = JSON.parse(
  execFileSync(
    'python3',
    ['-I', cheminBanc, path.join(racine, 'scripts', 'synthese-voix.py'), JSON.stringify(SCRIPTS), cheminWav],
    { cwd: racine, encoding: 'utf8' },
  ),
);

console.log('\nLE REPÈRE TOMBE SUR LE TITRE');
for (const m of mesures) {
  const nom = path.basename(m.fichier);
  verifier(
    `${nom} — autant de repères que de parties déclarées`,
    m.reperes.length === m.declares.length && m.declares.length === 3,
    `déclarées ${m.declares.length}, mesurées ${m.reperes.length}`,
  );
  /*
     Le repère doit désigner le paragraphe qui DIT le titre. On le vérifie sur
     le texte : la relance d'un titre est la seule phrase courte du script qui
     contient les mots du titre après un deux-points ou une préposition.
  */
  for (const d of m.declares) {
    const paragraphe = m.paragraphes[d.paragraphe] ?? '';
    verifier(
      `${nom} — le paragraphe ${d.paragraphe} est bien une relance de titre`,
      paragraphe.length > 0 && paragraphe.length < 160 && /[:,]|par |avec |à /.test(paragraphe),
      paragraphe.slice(0, 90),
    );
  }
  verifier(
    `${nom} — le premier paragraphe est la phrase d’accueil, pas le commentaire d’en-tête`,
    m.paragraphes[0]?.startsWith('Bienvenue') === true,
    m.paragraphes[0]?.slice(0, 60),
  );
}

/* ── L'onde, lue indépendamment du calcul ────────────────────────────────── */

console.log('\nL’ÉCART, MESURÉ SUR L’ONDE');

/** Échantillons d'un WAV PCM 16 bits mono, chunks lus un par un. */
function echantillons(chemin: string): { taux: number; valeurs: Int16Array } {
  const octets = readFileSync(chemin);
  let position = 12; // après « RIFF…WAVE »
  let taux = 0;
  let donnees: Buffer | null = null;
  while (position + 8 <= octets.length) {
    const nom = octets.toString('ascii', position, position + 4);
    const taille = octets.readUInt32LE(position + 4);
    const corps = octets.subarray(position + 8, position + 8 + taille);
    if (nom === 'fmt ') taux = corps.readUInt32LE(4);
    if (nom === 'data') donnees = corps;
    position += 8 + taille + (taille % 2);
  }
  if (!donnees) throw new Error(`WAV sans bloc « data » : ${chemin}`);
  return {
    taux,
    valeurs: new Int16Array(donnees.buffer, donnees.byteOffset, Math.floor(donnees.length / 2)),
  };
}

const { taux, valeurs } = echantillons(cheminWav);
verifier('l’onde du laboratoire est lisible', taux === 24000 && valeurs.length > 0, `${taux} Hz, ${valeurs.length} échantillons`);

/* Les jalons : amplitude ≥ 20000, une seule par paragraphe. */
const jalons = new Map<number, number>();
for (let i = 0; i < valeurs.length; i += 1) {
  const v = valeurs[i];
  if (v >= 20000) {
    const rang = 30000 - v;
    if (!jalons.has(rang)) jalons.set(rang, i / taux);
  }
}

const premier = mesures[0];
verifier(
  'chaque paragraphe a laissé son jalon dans l’onde',
  jalons.size === premier.paragraphes.length,
  `${jalons.size} jalons pour ${premier.paragraphes.length} paragraphes`,
);

let ecartMax = 0;
for (const d of premier.declares) {
  const annonce = premier.reperes.find((r) => r.id === d.id)?.debut;
  const reel = jalons.get(d.paragraphe);
  if (annonce === undefined || reel === undefined) {
    verifier(`« ${d.id} » : repère et jalon retrouvés`, false);
    continue;
  }
  const ecart = Math.abs(annonce - reel);
  ecartMax = Math.max(ecartMax, ecart);
  verifier(
    `« ${d.id} » : moins de 0,5 s d’écart`,
    ecart < 0.5,
    `annoncé ${annonce.toFixed(3)} s · onde ${reel.toFixed(3)} s · écart ${ecart.toFixed(3)} s`,
  );
  /*
     ET LE REPÈRE TOMBE SUR LA PAROLE, PAS DANS LA RESPIRATION. Une demi-
     seconde de silence précède chaque paragraphe : si le repère était posé
     avant elle, sauter à la partie ferait entendre un blanc.
  */
  const avant = valeurs.subarray(Math.max(0, Math.round((reel - 0.3) * taux)), Math.round(reel * taux));
  verifier(
    `« ${d.id} » : le repère est posé après la respiration`,
    avant.length > 0 && !avant.some((v) => Math.abs(v) > 100),
    `${avant.length} échantillons de silence avant le jalon`,
  );
}
console.log(`  écart maximal mesuré : ${jaune(ecartMax.toFixed(3) + ' s')}`);

/* ── Une fiche sans repères s'écoute comme avant ─────────────────────────── */

console.log('\nSANS REPÈRES, RIEN NE CHANGE');
const sansLigne = path.join(scratch, 'sans-reperes.podcast.md');
writeFileSync(
  sansLigne,
  readFileSync(SCRIPTS[0], 'utf8')
    .split('\n')
    .filter((l) => !l.startsWith('parties:'))
    .join('\n'),
);
const sans: Resultat[] = JSON.parse(
  execFileSync(
    'python3',
    ['-I', cheminBanc, path.join(racine, 'scripts', 'synthese-voix.py'), JSON.stringify([sansLigne]), cheminWav],
    { cwd: racine, encoding: 'utf8' },
  ),
);
verifier('un script sans ligne « parties: » ne produit aucun repère', sans[0].reperes.length === 0);
verifier(
  'et il produit exactement le même audio qu’avec',
  Math.abs(sans[0].secondes - mesures[0].secondes) < 0.001,
  `${sans[0].secondes} s contre ${mesures[0].secondes} s`,
);

/* ── Avec la vraie voix, sur demande ─────────────────────────────────────── */

/**
 * La mesure de référence, sur l'audio publié et la vraie voix.
 *
 * Elle décode l'Opus avec ffmpeg et cherche l'attaque de la voix autour de
 * chaque repère : la respiration qui précède un paragraphe dure 0,56 s, et
 * l'on remonte un peu avant elle pour être sûr de ne pas partir déjà dans la
 * parole. L'écart rendu est « attaque de la voix moins repère annoncé ».
 */
const BANC_ONDE = `
import array, json, subprocess, sys, wave

ffmpeg, taux, metas = sys.argv[1], 24000, json.loads(sys.argv[2])
SEUIL = 400

def pcm(chemin):
    sortie = chemin + ".essai.wav"
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", chemin,
                    "-ac", "1", "-ar", str(taux), "-f", "wav", sortie], check=True)
    with wave.open(sortie, "rb") as w:
        brut = w.readframes(w.getnframes())
    ech = array.array("h"); ech.frombytes(brut)
    return ech

def attaque(ech, repere):
    depart = max(0, int((repere - 0.45) * taux))
    for i in range(depart, min(len(ech), int((repere + 1.5) * taux))):
        if abs(ech[i]) > SEUIL:
            fenetre = ech[i : i + taux // 100]
            if sum(1 for v in fenetre if abs(v) > SEUIL) > len(fenetre) // 5:
                return i / taux
    return None

sortie = []
for meta in metas:
    with open(meta, encoding="utf8") as f:
        d = json.load(f)
    ech = pcm(meta[:-5] + ".opus")
    for p in d.get("parties", []):
        reel = attaque(ech, p["debut"])
        sortie.append({
            "fichier": meta.rsplit("/", 1)[-1], "id": p["id"], "annonce": p["debut"],
            "reel": reel, "ecart": None if reel is None else round(reel - p["debut"], 3),
        })
print(json.dumps(sortie, ensure_ascii=False))
`;

/** ffmpeg : sur le PATH, sinon celui qu'apporte imageio-ffmpeg. */
function trouverFfmpeg(): string | null {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    /* pas sur le PATH */
  }
  try {
    return execFileSync(
      'python3',
      ['-I', '-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return null;
  }
}

if (avecLaVoix) {
  console.log('\nAVEC LA VOIX RÉELLE (Kokoro, ff_siwis)');
  const metas = execFileSync('ls', [path.join(dossierContenu, '.audio')], { encoding: 'utf8' })
    .split('\n')
    .filter((n) => n.endsWith('.json'))
    .map((n) => path.join(dossierContenu, '.audio', n));
  verifier('la synthèse a produit des métadonnées', metas.length > 0, `${metas.length} fiche(s)`);
  for (const meta of metas) {
    const d = JSON.parse(readFileSync(meta, 'utf8'));
    verifier(
      `${path.basename(meta)} — les repères sont écrits avec les autres métadonnées`,
      Array.isArray(d.parties) && d.parties.length === 3,
      JSON.stringify(d.parties),
    );
  }

  const ffmpeg = trouverFfmpeg();
  if (!ffmpeg) {
    console.log(jaune('  ! écart non mesuré sur l’onde réelle : ffmpeg introuvable.'));
  } else {
    const cheminOnde = path.join(scratch, 'onde.py');
    writeFileSync(cheminOnde, BANC_ONDE);
    const gaps: { fichier: string; id: string; annonce: number; reel: number | null; ecart: number | null }[] =
      JSON.parse(
        execFileSync('python3', ['-I', cheminOnde, ffmpeg, JSON.stringify(metas)], {
          cwd: racine,
          encoding: 'utf8',
        }),
      );
    let pire = 0;
    for (const g of gaps) {
      if (g.ecart === null) {
        verifier(`« ${g.id} » : attaque de la voix retrouvée dans l’audio publié`, false);
        continue;
      }
      pire = Math.max(pire, Math.abs(g.ecart));
      verifier(
        `« ${g.id} » : moins de 0,5 s d’écart sur l’onde réelle`,
        Math.abs(g.ecart) < 0.5,
        `repère ${g.annonce.toFixed(2)} s · voix à ${(g.reel ?? 0).toFixed(2)} s · écart ${g.ecart >= 0 ? '+' : ''}${g.ecart.toFixed(3)} s`,
      );
    }
    console.log(`  écart maximal sur la voix réelle : ${jaune(pire.toFixed(3) + ' s')} (${gaps.length} repères)`);
  }
} else {
  console.log(
    '\n' + jaune('! la voix réelle n’a pas été sollicitée') +
      ' (ajoutez « -- --avec-la-voix » ; le modèle Kokoro doit être installé).',
  );
}

console.log(rouges === 0 ? `\n${vert('Tout est vert.')}` : `\n${rouge(`${rouges} rouge(s).`)}`);
process.exit(rouges === 0 ? 0 : 1);
