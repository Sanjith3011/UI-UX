import io
import zipfile
import tempfile
import os
from django.test import TestCase
from .security_scanner import scan_zip_for_secrets, format_scan_error


class SecretScannerTest(TestCase):
    def _make_zip(self, files: dict) -> str:
        tmp = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
        with zipfile.ZipFile(tmp, 'w') as zf:
            for name, content in files.items():
                zf.writestr(name, content)
        tmp.close()
        return tmp.name

    def tearDown(self):
        pass

    def test_blocks_env_file(self):
        path = self._make_zip({'.env': 'DATABASE_URL=postgres://user:pass@host/db'})
        try:
            findings = scan_zip_for_secrets(path)
            self.assertTrue(any(f['file'] == '.env' for f in findings))
        finally:
            os.remove(path)

    def test_blocks_api_key_in_source(self):
        path = self._make_zip({'src/config.js': 'const API_KEY = "sk-live-abcdefghijklmnop"'})
        try:
            findings = scan_zip_for_secrets(path)
            self.assertTrue(len(findings) > 0)
            self.assertIn('API key', findings[0]['details'])
        finally:
            os.remove(path)

    def test_allows_clean_ui_code(self):
        path = self._make_zip({
            'src/App.jsx': 'export default function App() { return <div>Hello</div>; }',
            'src/styles.css': 'body { margin: 0; }',
        })
        try:
            findings = scan_zip_for_secrets(path)
            self.assertEqual(findings, [])
        finally:
            os.remove(path)

    def test_format_scan_error(self):
        msg = format_scan_error([{'file': '.env', 'details': 'Blocked sensitive filename'}])
        self.assertIn('Upload blocked', msg)
        self.assertIn('.env', msg)
