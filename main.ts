// main.ts — the hand-in program for PRISM BREAK v2 (make.fun best-game-01).
//
// It assembles the entry exactly as the bounty's starter contract asks:
// copy game/ and screenshots/ from this repository into the output
// directory, then write dossier.json with buildDossier from the kit's
// vendor library, using the same caps the scorer uses, so the dossier it
// grades is byte for byte the one produced here. Standard library only;
// the output directory is MAKEFUN_OUTPUT_DIR, or /output when that is
// unset. Running it twice writes the same bytes.

import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Start from a clean slate inside the output directory so a re-run can
// never smuggle stale files into the entry.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`PRISM BREAK v2 handed in: game/ + screenshots/ + dossier.json (${dossier.length} bytes) -> ${outDir}`);
