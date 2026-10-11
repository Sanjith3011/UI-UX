"""
Security Architecture & Cryptographic Utilities
-----------------------------------------------
Provides robust credential validation, password hashing, 
symmetric data encryption/decryption, and cryptographically secure token generation.
"""

import re
import os
import json
import base64
import secrets
import hashlib
import hmac
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

# Cryptography primitives for symmetric encryption (Fernet / AES-128-CBC + HMAC-SHA256)
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


# ----------------------------------------------------------------------
# 1. Credential Validators
# ----------------------------------------------------------------------

RESERVED_USERNAMES = {
    'admin', 'administrator', 'root', 'api', 'auth', 'token', 'tokens',
    'explore', 'login', 'register', 'dashboard', 'settings', 'support',
    'system', 'help', 'static', 'media', 'null', 'undefined', 'test',
    'guest', 'public', 'anonymous', 'superuser', 'moderator'
}

USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_.-]{3,30}$')
EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
)


def validate_username_credentials(username: str, current_user_id: int = None) -> str:
    """
    Validates username format, length, reserved words, and database uniqueness.
    """
    if not username or not isinstance(username, str):
        raise serializers.ValidationError("Username is compulsory and cannot be empty.")
    
    clean_username = username.strip()

    if len(clean_username) < 3:
        raise serializers.ValidationError("Username must be at least 3 characters long.")
    if len(clean_username) > 30:
        raise serializers.ValidationError("Username cannot exceed 30 characters.")

    if not USERNAME_REGEX.match(clean_username):
        raise serializers.ValidationError(
            "Username can only contain letters, numbers, underscores, hyphens, and periods."
        )

    if clean_username.lower() in RESERVED_USERNAMES:
        raise serializers.ValidationError(
            f"'{clean_username}' is a reserved system identifier. Please choose another username."
        )

    # Check case-insensitive uniqueness
    query = User.objects.filter(username__iexact=clean_username)
    if current_user_id:
        query = query.exclude(id=current_user_id)
    if query.exists():
        raise serializers.ValidationError(
            f"The username '{clean_username}' is already registered. Please choose another."
        )

    return clean_username


def validate_email_credentials(email: str, current_user_id: int = None) -> str:
    """
    Validates that email is compulsory, well-formed, and unique across all accounts.
    """
    if not email or not isinstance(email, str) or not email.strip():
        raise serializers.ValidationError("Email address is compulsory. Please enter a valid email.")

    clean_email = email.strip().lower()

    if len(clean_email) > 254:
        raise serializers.ValidationError("Email address cannot exceed 254 characters.")

    if not EMAIL_REGEX.match(clean_email):
        raise serializers.ValidationError("Please provide a valid email format (e.g., designer@company.com).")

    # Check case-insensitive uniqueness in database
    query = User.objects.filter(email__iexact=clean_email)
    if current_user_id:
        query = query.exclude(id=current_user_id)
    if query.exists():
        raise serializers.ValidationError(
            "An account with this email address already exists. Please log in or use another email."
        )

    return clean_email


def validate_password_strength(password: str, username: str = None, email: str = None) -> str:
    """
    Enforces strong password policy:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character
    - Not matching or containing username or email local-part
    - Runs Django's built-in password validators (common password checks)
    """
    if not password or not isinstance(password, str):
        raise serializers.ValidationError("Password is compulsory.")

    if len(password) < 8:
        raise serializers.ValidationError("Password must be at least 8 characters long.")
    if len(password) > 128:
        raise serializers.ValidationError("Password cannot exceed 128 characters.")

    if not re.search(r'[A-Z]', password):
        raise serializers.ValidationError("Password must contain at least one uppercase letter (A-Z).")
    if not re.search(r'[a-z]', password):
        raise serializers.ValidationError("Password must contain at least one lowercase letter (a-z).")
    if not re.search(r'[0-9]', password):
        raise serializers.ValidationError("Password must contain at least one numeric digit (0-9).")
    if not re.search(r'[^a-zA-Z0-9]', password):
        raise serializers.ValidationError("Password must contain at least one special character (!@#$%^&* etc.).")

    if username and username.lower() in password.lower():
        raise serializers.ValidationError("Password cannot contain your username.")

    if email:
        local_part = email.split('@')[0].lower()
        if len(local_part) >= 3 and local_part in password.lower():
            raise serializers.ValidationError("Password cannot contain parts of your email address.")

    # Run Django validators (similarity, common passwords, numeric)
    try:
        user_stub = User(username=username or '', email=email or '')
        django_validate_password(password, user=user_stub)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))

    return password


# ----------------------------------------------------------------------
# 2. Hashing Utilities (Pass & Sensitive Fingerprints)
# ----------------------------------------------------------------------

def hash_sha256(data: str, salt: str = "") -> str:
    """Computes a SHA-256 hash with optional salt."""
    salted_bytes = f"{salt}:{data}".encode('utf-8')
    return hashlib.sha256(salted_bytes).hexdigest()


def hmac_sha256_signature(key: str, message: str) -> str:
    """Generates an HMAC-SHA256 signature for tamper-proofing."""
    return hmac.new(key.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).hexdigest()


def constant_time_verify(val_a: str, val_b: str) -> bool:
    """Timing-attack-resistant string equality comparison."""
    if not isinstance(val_a, str) or not isinstance(val_b, str):
        return False
    return secrets.compare_digest(val_a, val_b)


# ----------------------------------------------------------------------
# 3. Cryptographic Token Generators & Validators
# ----------------------------------------------------------------------

def generate_secure_token(length: int = 32) -> str:
    """Generates a cryptographically secure URL-safe random string."""
    return secrets.token_urlsafe(length)


def generate_signed_token(data_payload: dict, salt: str = "uiux-token-salt") -> str:
    """
    Generates a cryptographically signed, timestamped token containing arbitrary JSON payload.
    Uses Django's TimestampSigner with HMAC-SHA256.
    """
    signer = TimestampSigner(salt=salt)
    serialized = json.dumps(data_payload, separators=(',', ':'))
    return signer.sign(serialized)


def verify_signed_token(signed_token: str, max_age_seconds: int = 86400, salt: str = "uiux-token-salt") -> dict:
    """
    Verifies a timestamped signed token.
    Raises ValueError on tampering or expiration.
    Returns the decoded dict payload.
    """
    signer = TimestampSigner(salt=salt)
    try:
        raw_str = signer.unsign(signed_token, max_age=max_age_seconds)
        return json.loads(raw_str)
    except SignatureExpired:
        raise ValueError("Token has expired. Please request a new one.")
    except (BadSignature, json.JSONDecodeError):
        raise ValueError("Invalid or tampered token.")


# ----------------------------------------------------------------------
# 4. Symmetric Data Encryption (Fernet / AES-128-CBC + HMAC)
# ----------------------------------------------------------------------

def _get_encryption_cipher() -> Fernet:
    """
    Derives a consistent 32-byte Fernet key from Django's SECRET_KEY
    using PBKDF2HMAC with SHA-256.
    """
    secret = getattr(settings, 'SECRET_KEY', 'default-uiux-feedback-key').encode('utf-8')
    # Fixed application salt for key derivation
    kdf_salt = b"uiux-analyzer-aes-kdf-salt-v1"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=kdf_salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


def encrypt_data(plain_text: str) -> str:
    """
    Encrypts a plaintext string into an authenticated ciphertext (base64 string).
    """
    if plain_text is None:
        return ""
    cipher = _get_encryption_cipher()
    encrypted_bytes = cipher.encrypt(str(plain_text).encode('utf-8'))
    return encrypted_bytes.decode('utf-8')


def decrypt_data(cipher_text: str) -> str:
    """
    Decrypts an authenticated ciphertext string back into plaintext.
    Returns empty string if invalid or tampered.
    """
    if not cipher_text:
        return ""
    cipher = _get_encryption_cipher()
    try:
        decrypted_bytes = cipher.decrypt(cipher_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception:
        return ""
