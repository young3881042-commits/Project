#!/usr/bin/env python3
"""Reject incomplete embedded-AI stages/APKs before publishing an unusable update."""
import argparse
import hashlib
import json
import pathlib
import zipfile

REQUIRED = {'liborbit_node.so', 'liborbit_codex.so'}

def verify(read):
    manifest = json.loads(read('assets/orbit-native-manifest.json'))
    records = manifest.get('files', [])
    names = {r['file'] for r in records}
    if manifest.get('abi') != 'arm64-v8a' or not REQUIRED <= names:
        raise ValueError('Native manifest must include Android arm64 Node and Codex')
    for record in records:
        name = record['file']
        if pathlib.PurePosixPath(name).name != name or not name.endswith('.so'):
            raise ValueError('Invalid native library name')
        data = read('lib/arm64-v8a/' + name)
        if data[:5] != b'\x7fELF\x02' or int.from_bytes(data[18:20], 'little') != 183:
            raise ValueError('Expected Android arm64 ELF: ' + name)
        if hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError('Native library checksum mismatch: ' + name)
    if b'BEGIN CERTIFICATE' not in read('assets/orbit-ca.pem'):
        raise ValueError('Missing runtime TLS certificates')
    if not read('assets/orbit-runtime-notices/codex-LICENSE'):
        raise ValueError('Missing runtime license')
    return len(records)

def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--stage', type=pathlib.Path)
    group.add_argument('--apk', type=pathlib.Path)
    args = parser.parse_args()
    try:
        if args.stage:
            count = verify(lambda name: (args.stage / name).read_bytes())
        else:
            with zipfile.ZipFile(args.apk) as archive:
                count = verify(archive.read)
        print(f'Embedded AI runtime verified: {count} native libraries, checksums, TLS and license')
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(2, 'Embedded AI runtime verification failed: ' + str(error) + '\n')

if __name__ == '__main__':
    main()
