import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAsset, getAssetKeys, isSea } from 'node:sea';
import qrcode from 'qrcode-terminal';
import { buildApp } from './app';
import { loadConfig, saveConfig } from './config';
import { MatchStore } from './store';

// Lancé depuis l'exe : les données vivent à côté de lui, les pages et les logos sont embarqués.
const packaged = isSea();
const root = packaged ? path.dirname(process.execPath) : process.cwd();
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const port = Number(process.env.PORT) || 4455;

/** Déplie les fichiers embarqués dans un dossier temporaire, une fois par version de l'exe. */
function unpack(): string {
  const dir = path.join(os.tmpdir(), 'matchday-overlay', getAsset('build-id', 'utf8'));
  if (fs.existsSync(path.join(dir, 'ok'))) return dir;
  for (const key of getAssetKeys()) {
    const file = path.join(dir, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(getAsset(key)));
  }
  fs.writeFileSync(path.join(dir, 'ok'), '');
  return dir;
}

async function main() {
  const bundle = packaged ? unpack() : null;
  const webDir = bundle ? path.join(bundle, 'web') : path.join(root, 'dist', 'web');
  if (!fs.existsSync(webDir)) throw new Error('Les pages ne sont pas construites. Lance « pnpm start » (ou « pnpm build » puis « pnpm serve »).');

  const { config, settings } = loadConfig(dataDir);
  const { pin } = settings;
  const store = new MatchStore(dataDir, config);
  const app = await buildApp({
    store,
    webDir,
    logosDir: bundle ? path.join(bundle, 'logos') : path.join(root, 'assets', 'logos'),
    uploadsDir: path.join(dataDir, 'uploads'),
    settings,
    onSave: (next, nextSettings) => saveConfig(dataDir, next, nextSettings),
  });
  await app.listen({ port, host: '0.0.0.0' });

  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  const { score, clock } = store.match;

  console.log('\n  matchday-overlay est lancé\n');
  console.log(`  Overlay 16:9 (vMix / OBS)  http://localhost:${port}/overlay/16x9`);
  console.log(`  Overlay 9:16 (vertical)    http://localhost:${port}/overlay/9x16`);
  console.log(`  Contrôle (ce PC)           http://localhost:${port}/control`);
  console.log(`  Simulation                 http://localhost:${port}/simulation`);
  console.log(`  Admin (configuration)      http://localhost:${port}/admin`);
  console.log(`  Galerie des thèmes         http://localhost:${port}/galerie`);
  if (lan) console.log(`  Contrôle (téléphone)       http://${lan}:${port}/control`);
  console.log(`\n  Code PIN du contrôle       ${pin}   (modifiable dans la page d'admin)`);
  console.log(`\n  Match repris : ${score.home} - ${score.away}, ${clock.phase === 'pre' ? 'pas encore commencé' : `période ${clock.period}`}`);
  if (store.skippedLines) console.log(`  Attention : ${store.skippedLines} ligne(s) illisible(s) ignorée(s) dans data/match.jsonl`);
  if (packaged) console.log(`  Données enregistrées dans  ${dataDir}`);
  if (lan) {
    console.log('\n  Scanne pour ouvrir le contrôle sur le téléphone :\n');
    qrcode.generate(`http://${lan}:${port}/control`, { small: true });
  }
  if (packaged) console.log('\n  Laisse cette fenêtre ouverte pendant le match. La fermer arrête l\'habillage.');
}

main().catch((err: NodeJS.ErrnoException) => {
  console.error(err.code === 'EADDRINUSE' ? `\n  Le port ${port} est déjà pris : matchday-overlay est sans doute déjà lancé dans une autre fenêtre.` : `\n  ${err.message}`);
  if (!packaged) process.exit(1);
  // Double-clic : sans cette attente, la fenêtre se fermerait avant qu'on puisse lire l'erreur.
  console.error('\n  Appuie sur Entrée pour fermer.');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});
