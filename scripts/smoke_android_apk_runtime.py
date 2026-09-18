#!/usr/bin/env python3
"""Run APK-owned Android engines in a disposable HOME, without real login or data."""
import argparse
import json
import os
import pathlib
import subprocess
import tempfile
import zipfile
from verify_android_runtime import verify

parser = argparse.ArgumentParser()
parser.add_argument('apk', type=pathlib.Path)
args = parser.parse_args()
if not pathlib.Path('/system/bin/linker64').exists():
    parser.exit(2, 'This runtime smoke test requires an Android arm64 host.\n')
with tempfile.TemporaryDirectory(prefix='orbit-apk-smoke-') as temporary, zipfile.ZipFile(args.apk) as archive:
    count = verify(archive.read)
    root = pathlib.Path(temporary)
    lib = root / 'lib'
    lib.mkdir()
    for entry in json.loads(archive.read('assets/orbit-native-manifest.json'))['files']:
        target = lib / entry['file']
        target.write_bytes(archive.read('lib/arm64-v8a/' + entry['file']))
        target.chmod(0o700)
    runtime = root / 'runtime.mjs'
    runtime.write_bytes(archive.read('assets/orbit-travel-runtime.mjs'))
    env = {'HOME': str(root), 'CODEX_HOME': str(root / '.codex'), 'TMPDIR': str(root), 'PATH': '/system/bin',
           'ANDROID_ROOT': '/system', 'ANDROID_DATA': '/data', 'LD_LIBRARY_PATH': str(lib), 'ORBIT_EMBEDDED': '1'}
    for name in ['node', 'codex']:
        result = subprocess.run(['/system/bin/linker64', str(lib / ('liborbit_' + name + '.so')), '--version'], env=env, cwd=root, capture_output=True, text=True, timeout=15, check=True)
        print(name + ': ' + result.stdout.strip())
    request = '\n'.join(json.dumps(value) for value in [
        {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {}},
        {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'}]) + '\n'
    result = subprocess.run(['/system/bin/linker64', str(lib / 'liborbit_node.so'), str(runtime), '--workspace-mcp'],
                            input=request, env=env, cwd=root, capture_output=True, text=True, timeout=15, check=True)
    replies = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    assert any(row.get('id') == 1 and row.get('result', {}).get('serverInfo', {}).get('name') == 'orbit_local' for row in replies)
    assert any(row.get('id') == 2 and row.get('result', {}).get('tools') == [] for row in replies)
    print(f'APK runtime smoke passed: {count} libraries, both engines launch, bundled MCP starts without credentials')
