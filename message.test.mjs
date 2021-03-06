import { format } from './message.mjs';
import fs from 'fs';
import path from 'path';

const LENGTH = 500;
const files = await fs.promises.readdir('./schedule');

for (let i = 0; i < files.length; ++i) {
  console.log(files[i]);
  const msg = await fs.promises.readFile(path.join('./schedule', files[i]), {
    encoding: 'utf8',
  });
  const formatted = format(msg, LENGTH);
  console.log('\nformatted\n', formatted, '\n');
}
