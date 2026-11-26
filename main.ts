// Garuda Ridge Run — the entrypoint (Node 22, standard library only).
//
// The game lives in game/ as plain static files a desktop browser loads
// offline: index.html plus ES modules, with Three.js vendored under
// game/vendor/ and no network request anywhere. screenshots/ holds 3 or 4
// real renders of the game's own code. This program hands the entry in: it
// copies game/ and screenshots/ to the output directory and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library (vendor/makefun-game.ts, copied unchanged from the kit).
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Count the files under a directory, descending into subdirectories.
function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
const gameFileCount = countFiles(join(here, 'game'));

const shotDir = join(here, 'screenshots');
const shotNames = existsSync(shotDir)
  ? readdirSync(shotDir).filter((name) => /\.(png|jpe?g)$/i.test(name))
  : [];
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (shotNames.length > 0) {
  cpSync(shotDir, join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits (RULES.txt, Before you submit):
// at most 4 screenshots of 256 KiB each, at most 993 files and 48 MiB under
// game/, no game/ path over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(
  `Garuda Ridge Run: ${gameFileCount} game files, ${shotNames.length} screenshots -> ${out}`,
);
