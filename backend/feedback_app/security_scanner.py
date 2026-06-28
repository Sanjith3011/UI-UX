import os
import re
import zipfile

# Filenames that should never be analyzed or uploaded
BLOCKED_FILENAMES = frozenset({
    '.env', '.env.local', '.env.production', '.env.development', '.env.staging',
    'credentials.json', 'secrets.json', 'secrets.yml', 'secrets.yaml',
    'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
    'service-account.json', 'firebase-adminsdk.json',
    '.npmrc', '.pypirc', 'netrc', '.netrc',
    'docker-compose.override.yml',
})

BLOCKED_EXTENSIONS = frozenset({
    'pem', 'key', 'p12', 'pfx', 'crt', 'cer', 'keystore', 'jks',
})

BLOCKED_PATH_SEGMENTS = frozenset({
    '.ssh', 'secrets', 'credentials', '.aws', '.azure',
})

# Content patterns that indicate secrets (case-insensitive)
SECRET_CONTENT_PATTERNS = [
    (re.compile(r'(?i)(api[_-]?key|apikey)\s*[:=]\s*["\']?[a-zA-Z0-9_\-]{8,}'), 'API key assignment'),
    (re.compile(r'(?i)(secret[_-]?key|secretkey)\s*[:=]\s*["\']?[a-zA-Z0-9_\-]{8,}'), 'Secret key assignment'),
    (re.compile(r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?[^\s"\']{4,}'), 'Password assignment'),
    (re.compile(r'(?i)(access[_-]?token|auth[_-]?token)\s*[:=]\s*["\']?[a-zA-Z0-9_\-\.]{8,}'), 'Access token'),
    (re.compile(r'(?i)(private[_-]?key)\s*[:=]'), 'Private key reference'),
    (re.compile(r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'), 'Private key block'),
    (re.compile(r'(?i)(aws[_-]?secret|aws[_-]?access[_-]?key)\s*[:=]'), 'AWS credential'),
    (re.compile(r'(?i)(database[_-]?url|db[_-]?url|connection[_-]?string)\s*[:=]\s*["\']?[^\s"\']{10,}'), 'Database connection string'),
    (re.compile(r'(?i)(mongodb(\+srv)?|postgres(ql)?|mysql)://[^\s"\']+'), 'Database URI'),
    (re.compile(r'(?i)gsk_[a-zA-Z0-9]{20,}'), 'Groq API key'),
    (re.compile(r'(?i)sk-[a-zA-Z0-9]{20,}'), 'OpenAI API key'),
    (re.compile(r'(?i)AIza[a-zA-Z0-9_\-]{30,}'), 'Google API key'),
    (re.compile(r'(?i)ghp_[a-zA-Z0-9]{20,}'), 'GitHub personal access token'),
    (re.compile(r'(?i)xox[baprs]-[a-zA-Z0-9\-]+'), 'Slack token'),
]

MAX_SCAN_BYTES = 64 * 1024  # scan first 64 KB of each file


def _is_blocked_filename(filename: str) -> str | None:
    base = os.path.basename(filename).lower()
    if base in BLOCKED_FILENAMES:
        return f'Blocked sensitive filename: {base}'
    ext = base.rsplit('.', 1)[-1] if '.' in base else ''
    if ext in BLOCKED_EXTENSIONS:
        return f'Blocked credential file type: .{ext}'
    parts = filename.replace('\\', '/').lower().split('/')
    for part in parts:
        if part in BLOCKED_PATH_SEGMENTS:
            return f'Blocked sensitive directory: {part}/'
    if base.startswith('.env'):
        return f'Blocked environment file: {base}'
    return None


def _scan_content(content: str) -> list[str]:
    findings = []
    for pattern, label in SECRET_CONTENT_PATTERNS:
        if pattern.search(content):
            findings.append(label)
    return findings


def scan_zip_for_secrets(archive_path: str) -> list[dict]:
    """
    Scan a ZIP archive for sensitive files and secret patterns.
    Returns a list of findings: {file, reason, details}.
    """
    if not zipfile.is_zipfile(archive_path):
        return []

    findings = []
    seen_files = set()

    with zipfile.ZipFile(archive_path, 'r') as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue

            name = info.filename.replace('\\', '/')
            if name in seen_files:
                continue
            seen_files.add(name)

            blocked = _is_blocked_filename(name)
            if blocked:
                findings.append({
                    'file': name,
                    'reason': 'blocked_filename',
                    'details': blocked,
                })
                continue

            try:
                raw = zf.read(info.filename)[:MAX_SCAN_BYTES]
                try:
                    text = raw.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        text = raw.decode('latin-1')
                    except Exception:
                        continue

                content_findings = _scan_content(text)
                for detail in content_findings:
                    findings.append({
                        'file': name,
                        'reason': 'secret_pattern',
                        'details': detail,
                    })
            except Exception:
                continue

    return findings


def format_scan_error(findings: list[dict], max_listed: int = 8) -> str:
    if not findings:
        return ''

    lines = [
        'Upload blocked: potential secrets or credentials detected in your ZIP.',
        'Remove sensitive files before uploading. Do not include .env files, API keys, passwords, or private keys.',
        '',
    ]
    for item in findings[:max_listed]:
        lines.append(f"  • {item['file']}: {item['details']}")
    if len(findings) > max_listed:
        lines.append(f"  • ...and {len(findings) - max_listed} more issue(s)")
    return '\n'.join(lines)
