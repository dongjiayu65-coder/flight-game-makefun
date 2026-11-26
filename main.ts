// main.ts — the hand-in program for this entry (Node 22, standard
// library only). The game itself is the static site under game/; this
// program copies game/ and screenshots/ into the output directory and
// writes dossier.json there with the kit's vendored library, exactly
// as the bounty asks. Run it locally the same way the grader does:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// With no MAKEFUN_OUTPUT_DIR it writes to /output, the grader's mount.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The caps below are the gate's own (see the bounty's RULES.txt, "The
// gate"): at most 4 screenshots of 256 KiB each, at most 993 files and
// 48 MiB under game/, no game path over 1000 bytes, and the dossier's
// source text capped at 160 KiB. buildDossier refuses anything the
// gate would refuse, so a clean run here means a clean gate there.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
