#!/usr/bin/env python3
"""Scan APK entries without logging credential values.
Known native false positives are limited to reviewed bytes AND their surrounding
65 bytes in the specific binary: Node's bundled base64 WASM and Codex's merged
Rust string tables. Any changed context or any additional match still fails.
"""
import hashlib
import re
import sys
import zipfile

SENSITIVE_NAME = re.compile(r'(^|/)(auth\.json|credentials?\.json|secrets?\.json|[^/]*\.(keystore|jks|p12|pfx)|\.env([^/]*)?)$')
PATTERNS = [
    rb'sk-(proj-)?[A-Za-z0-9_-]{20,}',
    rb'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}',
    rb'lhb_[A-Za-z0-9._-]{4,}\.[A-Za-z0-9_-]{20,}',
    rb'AKIA[0-9A-Z]{16}',
    rb'gh[pousr]_[A-Za-z0-9]{30,}',
    rb'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'"(access_token|refresh_token|id_token|api_key)"\s*:\s*"[^"$]{16,}"',
]
REVIEWED_CONTEXTS = {
    'lib/arm64-v8a/liborbit_node.so': {
        '68793ca9aa681ab20f8361a3ae12ebf717b55164b65ff2dc3ca2f9a0264d802a',
        '8bdf465175848da3d092841fe9a105714c8402fc25b9d0d06866c53b90b2da0d',
        '052e48293d7b9536327d0d695962faa19cbe2d628e4e34e710ccd145b2448427',
        '0a43200f2182557c47bdf1486b581d528e9b1c5433ebeb5bf6d610362b1670d4',
    },
    'lib/arm64-v8a/liborbit_codex.so': {
        '437a15184d8913dc7c0114013ff8c09bbc3bdd15a1dd4c6c2f5100747ae4a1f9',
        '3a5b4bd00ab0cf584ecac02a3b1d9e295fa62559153349f1e38fc520f60868e1',
        'f5a28693f05204472a62283551bd2a45b1e69dcb818e97e069d89756cadd8b8b',
    },
}

def safe_entry(name, data):
    if SENSITIVE_NAME.search(name):
        return False
    for pattern in PATTERNS:
        for match in re.finditer(pattern, data):
            context = data[max(0, match.start() - 65):match.end() + 65]
            if hashlib.sha256(context).hexdigest() not in REVIEWED_CONTEXTS.get(name, set()):
                return False
    return True

if __name__ == '__main__':
    with zipfile.ZipFile(sys.argv[1]) as apk:
        if apk.testzip() is not None:
            raise SystemExit('APK archive validation failed.')
        for name in apk.namelist():
            if not safe_entry(name, apk.read(name)):
                raise SystemExit('APK credential scan rejected entry: ' + name)
    print('APK credential scan passed (native false positives checked by exact context).')
