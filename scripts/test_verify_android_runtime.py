import hashlib
import json
import unittest
from verify_android_runtime import verify

class RuntimeVerificationTest(unittest.TestCase):
    def fixture(self):
        elf = bytearray(64)
        elf[:5] = b'\x7fELF\x02'
        elf[18:20] = (183).to_bytes(2, 'little')
        files = {f'lib/arm64-v8a/{name}': bytes(elf) for name in ['liborbit_node.so', 'liborbit_codex.so', 'liborbit_dep_test.so']}
        files['assets/orbit-native-manifest.json'] = json.dumps({'abi': 'arm64-v8a', 'files': [{'file': path.rsplit('/', 1)[1], 'sha256': hashlib.sha256(data).hexdigest()} for path, data in files.items()]}).encode()
        files['assets/orbit-ca.pem'] = b'-----BEGIN CERTIFICATE-----'
        files['assets/orbit-runtime-notices/codex-LICENSE'] = b'license fixture'
        return files
    def test_complete_runtime(self):
        self.assertEqual(verify(self.fixture().__getitem__), 3)
    def test_web_only_apk_is_rejected(self):
        with self.assertRaises(KeyError): verify({}.__getitem__)
    def test_missing_dependency_or_engine_is_rejected(self):
        for name in ['liborbit_node.so', 'liborbit_codex.so', 'liborbit_dep_test.so']:
            files = self.fixture(); del files['lib/arm64-v8a/' + name]
            with self.assertRaises(KeyError): verify(files.__getitem__)
    def test_corruption_is_rejected(self):
        files = self.fixture(); files['lib/arm64-v8a/liborbit_node.so'] += b'changed'
        with self.assertRaises(ValueError): verify(files.__getitem__)
    def test_tls_is_required(self):
        files = self.fixture(); files['assets/orbit-ca.pem'] = b''
        with self.assertRaises(ValueError): verify(files.__getitem__)

if __name__ == '__main__': unittest.main()
