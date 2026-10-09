// Fabrique release/matchday-overlay.exe : Node, le serveur et les pages dans un seul fichier.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { inject } from 'postject';

const out = 'dist/exe';
const exe = 'release/matchday-overlay.exe';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

execSync('pnpm build', { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.dirname(exe), { recursive: true });

await build({
  entryPoints: ['src/server/main.ts'],
  outfile: `${out}/server.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  minify: true,
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
});

// Les pages et les logos fournis sont embarqués ; l'exe les déplie dans un dossier temporaire au démarrage.
const assets = {};
for (const [prefix, dir] of [['web', 'dist/web'], ['logos', 'assets/logos']])
  for (const file of walk(dir)) assets[`${prefix}/${path.relative(dir, file).split(path.sep).join('/')}`] = file;
fs.writeFileSync(`${out}/build-id`, Date.now().toString(36));
assets['build-id'] = `${out}/build-id`;

fs.writeFileSync(
  `${out}/sea.json`,
  JSON.stringify({ main: `${out}/server.cjs`, output: `${out}/sea.blob`, disableExperimentalSEAWarning: true, assets }, null, 2),
);
execFileSync(process.execPath, ['--experimental-sea-config', `${out}/sea.json`], { stdio: 'inherit' });

fs.copyFileSync(process.execPath, exe);
await inject(exe, 'NODE_SEA_BLOB', fs.readFileSync(`${out}/sea.blob`), { sentinelFuse: FUSE });

console.log(`\n  ${exe}  (${Math.round(fs.statSync(exe).size / 1e6)} Mo, ${Object.keys(assets).length - 1} fichiers embarqués)`);
