import { build } from '../apps/web/node_modules/esbuild/lib/main.js';
import { resolve } from 'node:path';
const output = process.argv[2];
if (!output) throw new Error('Output asset path required');
await build({ entryPoints: [new URL('../tools/orbit-travel/android-runtime.mjs', import.meta.url).pathname],
  outfile: resolve(output), bundle: true, platform: 'node', format: 'esm', target: 'node20', minify: true });
