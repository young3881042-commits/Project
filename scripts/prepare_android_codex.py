#!/usr/bin/env python3
"""Stage Android ELF runtimes for an APK. Never copies HOME, config or credentials.
Usage: python scripts/prepare_android_codex.py OUTPUT TERMUX_PREFIX CODEX_PACKAGE
Requires patchelf. Output is a private build artifact, not repository source.
"""
import pathlib, shutil, subprocess, sys, json, hashlib
out, prefix, package = map(pathlib.Path, sys.argv[1:])
lib = out / 'lib' / 'arm64-v8a'
assets = out / 'assets'
lib.mkdir(parents=True, exist_ok=True)
assets.mkdir(parents=True, exist_ok=True)
system = {'libc.so', 'libm.so', 'libdl.so', 'liblog.so', 'libandroid.so'}
files = {'liborbit_node.so': prefix / 'bin/node', 'liborbit_codex.so': package / 'bin/codex.bin'}
renames = {}
queue = list(files.values())
while queue:
    source = queue.pop()
    for dependency in subprocess.check_output(['patchelf', '--print-needed', str(source)], text=True).splitlines():
        if dependency in system or dependency in renames:
            continue
        name = 'liborbit_dep_' + dependency.replace('.', '_') + '.so'
        candidate = prefix / 'lib' / dependency
        if not candidate.is_file():
            raise RuntimeError('Missing native dependency: ' + dependency)
        renames[dependency] = name
        files[name] = candidate
        queue.append(candidate)
records = []
for name, source in files.items():
    destination = lib / name
    shutil.copyfile(source, destination)
    subprocess.run(['patchelf', '--set-rpath', '$ORIGIN', str(destination)], check=True)
    if name.startswith('liborbit_dep_'):
        subprocess.run(['patchelf', '--set-soname', name, str(destination)], check=True)
    for original in subprocess.check_output(['patchelf', '--print-needed', str(destination)], text=True).splitlines():
        if original in renames:
            subprocess.run(['patchelf', '--replace-needed', original, renames[original], str(destination)], check=True)
    destination.chmod(0o755)
    records.append({'file': name, 'sha256': hashlib.file_digest(destination.open('rb'), 'sha256').hexdigest()})
shutil.copyfile(prefix / 'etc/tls/cert.pem', assets / 'orbit-ca.pem')
notices = assets / 'orbit-runtime-notices'
notices.mkdir(exist_ok=True)
for name in ['LICENSE', 'THIRD-PARTY-NOTICES.md']:
    shutil.copyfile(package / name, notices / ('codex-' + name))
if (package / 'THIRD-PARTY-LICENSES').is_dir():
    shutil.copytree(package / 'THIRD-PARTY-LICENSES', notices / 'codex-third-party', dirs_exist_ok=True)
for copyright_file in (prefix / 'share/doc').glob('*/copyright'):
    shutil.copyfile(copyright_file, notices / (copyright_file.parent.name + '-copyright'))
(assets / 'orbit-native-manifest.json').write_text(json.dumps({'abi': 'arm64-v8a', 'minApi': 30, 'files': records}, indent=2))
print('Staged', len(files), 'native files in', out)
