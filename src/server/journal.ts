import fs from 'node:fs';
import path from 'node:path';
import type { JournalRecord } from '../shared/types';

/** Journal du match : une ligne JSON par événement, écrite sur disque avant d'être confirmée. */
export class Journal {
  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  load(): { records: JournalRecord[]; skipped: number } {
    if (!fs.existsSync(this.file)) return { records: [], skipped: 0 };
    const text = fs.readFileSync(this.file, 'utf8');
    const records: JournalRecord[] = [];
    let skipped = 0;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
        skipped++;
      }
    }
    // Une coupure peut laisser une dernière ligne tronquée : on la referme pour ne pas abîmer la suivante.
    if (text.length > 0 && !text.endsWith('\n')) fs.appendFileSync(this.file, '\n');
    return { records, skipped };
  }

  append(record: JournalRecord): void {
    const fd = fs.openSync(this.file, 'a');
    try {
      fs.writeSync(fd, JSON.stringify(record) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  /** Met le journal de côté et repart d'un fichier vide. */
  archive(now: number): void {
    if (!fs.existsSync(this.file)) return;
    const dir = path.join(path.dirname(this.file), 'archive');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    fs.renameSync(this.file, path.join(dir, `match-${stamp}.jsonl`));
  }
}
