// Assemble assets/icon/icon.ico à partir de PNG carrés (icon-16.png, icon-32.png…) rendus depuis icon.svg.
// À relancer seulement si l'icône change : node scripts/make-ico.mjs
import fs from 'node:fs';

const dir = 'assets/icon';
const images = fs
  .readdirSync(dir)
  .map((f) => /^icon-(\d+)\.png$/.exec(f))
  .filter(Boolean)
  .map((m) => ({ size: Number(m[1]), data: fs.readFileSync(`${dir}/${m[0]}`) }))
  .sort((a, b) => a.size - b.size);
if (!images.length) throw new Error(`Aucun fichier icon-<taille>.png dans ${dir}.`);

const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2); // type : icône
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(({ size, data }, i) => {
  const at = 6 + 16 * i;
  // 0 veut dire 256 dans ce format.
  header.writeUInt8(size % 256, at);
  header.writeUInt8(size % 256, at + 1);
  header.writeUInt16LE(1, at + 4); // plans
  header.writeUInt16LE(32, at + 6); // bits par pixel
  header.writeUInt32LE(data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += data.length;
});
fs.writeFileSync(`${dir}/icon.ico`, Buffer.concat([header, ...images.map((i) => i.data)]));
console.log(`${dir}/icon.ico : ${images.map((i) => i.size).join(', ')} px`);
