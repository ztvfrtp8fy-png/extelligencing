import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** SHA-256 over every file path and content under a directory. */
export function treeHash(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(path.relative(dir, p) + '\0' + fs.readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex');
}
