// Install the already-built, credential-free helper in Termux's private home.
import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Pass the bundled orbit-travel-runtime.mjs path');
const bytes = await readFile(resolve(source));
if (!bytes.length || bytes.length > 100000) throw new Error('Invalid runtime bundle');
const home = homedir();
const directory = join(home, '.local', 'state', 'orbit-travel');
const bin = join(home, '.local', 'bin');
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
await mkdir(bin, { recursive: true, mode: 0o700 });
const file = join(directory, 'standby.mjs');
const temporary = `${file}.${process.pid}.tmp`;
await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
await rename(temporary, file);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const command = join(bin, 'orbit-travel');
await writeFile(command, `#!/data/data/com.termux/files/usr/bin/sh\nexec ${quote(process.execPath)} ${quote(file)} "$@"\n`, { mode: 0o700 });
await chmod(command, 0o700);
// One startup check per interactive terminal, no watchdog loop and no wake lock.
const rc = join(home, '.bashrc');
let current = '';
try { current = await readFile(rc, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const begin = '# BEGIN ORBIT TRAVEL STANDBY';
const end = '# END ORBIT TRAVEL STANDBY';
const block = `${begin}\ncase $- in\n  *i*) ${quote(command)} --ensure >/dev/null 2>&1 & ;;\nesac\nalias orbit-travel=${quote(command)}\n${end}`;
if (current.includes(begin)) {
  const first = current.indexOf(begin), last = current.indexOf(end, first);
  if (last < 0) throw new Error('Incomplete managed startup block');
  current = current.slice(0, first) + block + current.slice(last + end.length);
} else current += `\n${block}\n`;
await writeFile(rc, current, { mode: 0o600 });
process.stdout.write('Orbit 대기 연결 설치 완료. ~/.local/bin/orbit-travel 실행으로 준비 상태를 확인하세요.\n');
