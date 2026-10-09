import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import { buildApp } from './app';
import { loadConfig, saveConfig } from './config';
import { MatchStore } from './store';

const root = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const webDir = path.join(root, 'dist', 'web');
const port = Number(process.env.PORT) || 4455;

if (!fs.existsSync(webDir)) {
  console.error('Les pages ne sont pas construites. Lance « pnpm start » (ou « pnpm build » puis « pnpm serve »).');
  process.exit(1);
}

const { config, pin } = loadConfig(dataDir);
const store = new MatchStore(dataDir, config);
const app = await buildApp({
  store,
  webDir,
  logosDir: path.join(root, 'assets', 'logos'),
  uploadsDir: path.join(dataDir, 'uploads'),
  pin,
  onSave: (next, nextPin) => saveConfig(dataDir, next, nextPin),
});
await app.listen({ port, host: '0.0.0.0' });

const lan = Object.values(os.networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
const { score, clock } = store.match;

console.log('\n  matchday-overlay est lancé\n');
console.log(`  Overlay 16:9 (vMix / OBS)  http://localhost:${port}/overlay/16x9`);
console.log(`  Contrôle (ce PC)           http://localhost:${port}/control`);
console.log(`  Simulation                 http://localhost:${port}/simulation`);
console.log(`  Admin (configuration)      http://localhost:${port}/admin`);
if (lan) console.log(`  Contrôle (téléphone)       http://${lan}:${port}/control`);
console.log(`\n  Code PIN du contrôle       ${pin}   (modifiable dans la page d'admin)`);
console.log(`\n  Match repris : ${score.home} - ${score.away}, ${clock.phase === 'pre' ? 'pas encore commencé' : `période ${clock.period}`}`);
if (store.skippedLines) console.log(`  Attention : ${store.skippedLines} ligne(s) illisible(s) ignorée(s) dans data/match.jsonl`);
if (lan) {
  console.log('\n  Scanne pour ouvrir le contrôle sur le téléphone :\n');
  qrcode.generate(`http://${lan}:${port}/control`, { small: true });
}
