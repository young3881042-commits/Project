#!/usr/bin/env node

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZES = [192, 512];
const BACKGROUND = [0x12, 0x17, 0x2b];
const MARK = [0x67, 0xe8, 0xd2];
const OUTER_RX = 0.3;
const OUTER_RY = 0.31;
const INNER_RX = 0.165;
const INNER_RY = 0.18;
const SAMPLES_PER_AXIS = 4;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(SCRIPT_DIR, '../apps/web/public/assets/lifehub-icons');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return chunk;
}

function markCoverage(pixelX, pixelY, size) {
  let hits = 0;
  for (let sampleY = 0; sampleY < SAMPLES_PER_AXIS; sampleY += 1) {
    for (let sampleX = 0; sampleX < SAMPLES_PER_AXIS; sampleX += 1) {
      const x = (pixelX + (sampleX + 0.5) / SAMPLES_PER_AXIS) / size - 0.5;
      const y = (pixelY + (sampleY + 0.5) / SAMPLES_PER_AXIS) / size - 0.5;
      const inOuter = (x / OUTER_RX) ** 2 + (y / OUTER_RY) ** 2 <= 1;
      const inInner = (x / INNER_RX) ** 2 + (y / INNER_RY) ** 2 < 1;
      if (inOuter && !inInner) hits += 1;
    }
  }
  return hits / (SAMPLES_PER_AXIS ** 2);
}

export function createOrbitIcon(size) {
  const stride = 1 + size * 4;
  const pixels = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const coverage = markCoverage(x, y, size);
      const offset = row + 1 + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          BACKGROUND[channel] + coverage * (MARK[channel] - BACKGROUND[channel])
        );
      }
      pixels[offset + 3] = 0xff;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  if (!checkOnly) await mkdir(OUTPUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const output = resolve(OUTPUT_DIR, `app-icon-${size}.png`);
    const generated = createOrbitIcon(size);
    if (checkOnly) {
      const current = await readFile(output);
      if (!current.equals(generated)) throw new Error(`${output} is not up to date`);
    } else {
      await writeFile(output, generated);
    }
    console.log(`${checkOnly ? 'checked' : 'wrote'} ${output}`);
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
