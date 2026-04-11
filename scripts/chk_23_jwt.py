#!/usr/bin/env python3
"""
VaultScan — JWT Vulnerability Scanner
=======================================
Comprehensive JWT security analysis that checks:
  1. Detect JWTs in responses (cookies, headers, body) via eyJ regex
  2. Decode JWT header — check algorithm (none, HS256 public key confusion)
  3. Check if token accepted without signature (strip signature)
  4. Check weak secrets by testing common passwords against HS256 tokens
  5. Check token expiration (exp claim missing or too long >24h)
  6. Check sensitive data in payload (passwords, SSN, credit cards)
  7. Test algorithm confusion: change alg to "none" and send
  8. Check kid parameter injection

Outputs JSON array of findings to stdout.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Ensure scan_utils is importable from the same directory
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    is_mock_mode,
    output_findings,
    base_argparser,
    normalize_url,
    create_session,
    safe_request,
    make_finding,
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "JWT_SECURITY"

# Regex to find JWT tokens (three base64url segments separated by dots)
JWT_REGEX = re.compile(
    r'(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*)'
)

# Common weak secrets used for HS256 signing
WEAK_SECRETS = [
    "secret",
    "password",
    "123456",
    "12345678",
    "123456789",
    "admin",
    "changeme",
    "key",
    "private",
    "default",
    "test",
    "jwt_secret",
    "supersecret",
    "s3cr3t",
    "passw0rd",
    "qwerty",
    "letmein",
    "welcome",
    "monkey",
    "master",
    "",
]

# Sensitive field names in JWT payloads
SENSITIVE_FIELD_PATTERNS = [
    re.compile(r"passw(or)?d", re.I),
    re.compile(r"secret", re.I),
    re.compile(r"ssn", re.I),
    re.compile(r"social.?security", re.I),
    re.compile(r"credit.?card", re.I),
    re.compile(r"card.?number", re.I),
    re.compile(r"cvv", re.I),
    re.compile(r"pin", re.I),
    re.compile(r"private.?key", re.I),
    re.compile(r"api.?key", re.I),
    re.compile(r"api.?secret", re.I),
    re.compile(r"access.?key", re.I),
    re.compile(r"token", re.I),
    re.compile(r"auth.?key", re.I),
]

# Credit card regex (basic pattern for common card types)
CREDIT_CARD_REGEX = re.compile(
    r'\b(?:4[0-9]{12}(?:[0-9]{3})?'       # Visa
    r'|5[1-5][0-9]{14}'                     # MasterCard
    r'|3[47][0-9]{13}'                      # Amex
    r'|6(?:011|5[0-9]{2})[0-9]{12})\b'      # Discover
)

# SSN regex
SSN_REGEX = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

# Pages likely to return JWTs
AUTH_PATHS = [
    "/",
    "/login",
    "/signin",
    "/auth/login",
    "/api/auth/login",
    "/api/login",
    "/api/token",
    "/api/auth/token",
    "/oauth/token",
    "/api/v1/auth/login",
    "/api/v1/login",
    "/api/users/login",
]

# kid injection payloads
KID_INJECTION_PAYLOADS = [
    "../../../../../../dev/null",
    "/dev/null",
    "| ls",
    "'; DROP TABLE users; --",
    "../../etc/passwd",
]


# ---------------------------------------------------------------------------
# Base64URL helpers
# ---------------------------------------------------------------------------
def b64url_decode(data: str) -> bytes:
    """Decode base64url-encoded data with padding correction."""
    data = data.replace("-", "+").replace("_", "/")
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    try:
        return base64.b64decode(data)
    except Exception:
        return b""


def b64url_encode(data: bytes) -> str:
    """Encode data to base64url without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------------------
# JWT parsing helpers
# ---------------------------------------------------------------------------
def decode_jwt_part(part: str) -> Optional[Dict]:
    """Decode a JWT header or payload section to a dict."""
    raw = b64url_decode(part)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def parse_jwt(token: str) -> Optional[Tuple[Dict, Dict, str]]:
    """
    Parse a JWT into (header, payload, signature_b64).
    Returns None if the token is not a valid JWT structure.
    """
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header = decode_jwt_part(parts[0])
    payload = decode_jwt_part(parts[1])
    if header is None or payload is None:
        return None
    return header, payload, parts[2]


def craft_jwt(header: Dict, payload: Dict, secret: str = "") -> str:
    """Craft a JWT with the given header, payload, and optional HMAC secret."""
    header_b64 = b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}"

    alg = header.get("alg", "").lower()
    if alg == "none" or not secret:
        return f"{signing_input}."
    elif alg == "hs256":
        sig = hmac.new(
            secret.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return f"{signing_input}.{b64url_encode(sig)}"
    elif alg == "hs384":
        sig = hmac.new(
            secret.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha384,
        ).digest()
        return f"{signing_input}.{b64url_encode(sig)}"
    elif alg == "hs512":
        sig = hmac.new(
            secret.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha512,
        ).digest()
        return f"{signing_input}.{b64url_encode(sig)}"
    else:
        # Unknown algorithm, return without signature
        return f"{signing_input}."


def verify_hs256(token: str, secret: str) -> bool:
    """Verify an HS256 JWT against a given secret."""
    parts = token.split(".")
    if len(parts) != 3:
        return False
    signing_input = f"{parts[0]}.{parts[1]}"
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    expected_b64 = b64url_encode(expected_sig)
    return hmac.compare_digest(expected_b64, parts[2])


# ---------------------------------------------------------------------------
# JWT extraction from responses
# ---------------------------------------------------------------------------
def extract_jwts_from_response(resp) -> List[Tuple[str, str]]:
    """
    Extract JWTs from an HTTP response.
    Returns list of (jwt_token, source_description) tuples.
    """
    tokens: List[Tuple[str, str]] = []
    seen: set = set()

    # Check response headers (Authorization, custom headers)
    for header_name, header_value in resp.headers.items():
        header_lower = header_name.lower()
        # Check Authorization header
        if header_lower == "authorization":
            match = re.search(r'Bearer\s+(' + JWT_REGEX.pattern + ')', header_value)
            if match:
                tok = match.group(1)
                if tok not in seen:
                    seen.add(tok)
                    tokens.append((tok, f"header:{header_name}"))
        # Check any header for JWT pattern
        for match in JWT_REGEX.finditer(header_value):
            tok = match.group(1)
            if tok not in seen:
                seen.add(tok)
                tokens.append((tok, f"header:{header_name}"))

    # Check cookies
    if hasattr(resp, "headers"):
        for cookie_header in resp.headers.get("Set-Cookie", "").split(","):
            for match in JWT_REGEX.finditer(cookie_header):
                tok = match.group(1)
                if tok not in seen:
                    seen.add(tok)
                    tokens.append((tok, "cookie"))

    # Check response body
    body = resp.text or ""
    if body:
        for match in JWT_REGEX.finditer(body[:50000]):  # Limit body scan
            tok = match.group(1)
            if tok not in seen:
                seen.add(tok)
                tokens.append((tok, "body"))

    return tokens


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------
def check_algorithm_none(header: Dict, payload: Dict, token: str, location: str) -> List[Dict]:
    """Check 2 & 7: algorithm 'none' or alg confusion."""
    findings: List[Dict] = []
    alg = header.get("alg", "")

    # Already using none algorithm
    if alg.lower() == "none":
        findings.append(make_finding(
            vulnerability="JWT Algorithm Set to None",
            severity="CRITICAL",
            location=location,
            evidence=(
                f"The JWT uses alg='none', meaning the token has no "
                f"cryptographic signature. Any user can forge valid tokens. "
                f"Algorithm in header: '{alg}'."
            ),
            category=CATEGORY,
            raw_details={
                "algorithm": alg,
                "header": header,
                "check": "alg_none",
            },
        ))

    return findings


def check_stripped_signature(
    session, header: Dict, payload: Dict, token: str,
    location: str, target: str, timeout: int,
) -> List[Dict]:
    """Check 3: Test if the server accepts a token without a signature."""
    findings: List[Dict] = []
    parts = token.split(".")
    if len(parts) != 3:
        return findings

    # Strip the signature (empty third segment)
    stripped_token = f"{parts[0]}.{parts[1]}."

    # Send the stripped token to the target
    resp, err = safe_request(
        session, "GET", target, timeout=timeout,
        headers={"Authorization": f"Bearer {stripped_token}"},
    )
    if err or resp is None:
        return findings

    # Also send the original for baseline comparison
    resp_original, err_orig = safe_request(
        session, "GET", target, timeout=timeout,
        headers={"Authorization": f"Bearer {token}"},
    )

    # If both return same status and stripped didn't get 401/403, it's accepted
    if resp_original and not err_orig:
        if (resp.status_code == resp_original.status_code
                and resp.status_code not in (401, 403)):
            findings.append(make_finding(
                vulnerability="JWT Accepted Without Signature",
                severity="CRITICAL",
                location=location,
                evidence=(
                    f"The server accepted a JWT with the signature stripped "
                    f"(empty signature segment). This means signature verification "
                    f"may be disabled. Original status: {resp_original.status_code}, "
                    f"Stripped status: {resp.status_code}."
                ),
                category=CATEGORY,
                raw_details={
                    "original_status": resp_original.status_code,
                    "stripped_status": resp.status_code,
                    "check": "stripped_signature",
                },
            ))

    return findings


def check_weak_secrets(
    header: Dict, token: str, location: str,
) -> List[Dict]:
    """Check 4: Test common weak secrets against HS256 tokens."""
    findings: List[Dict] = []
    alg = header.get("alg", "").upper()

    if alg not in ("HS256", "HS384", "HS512"):
        return findings

    for secret in WEAK_SECRETS:
        if verify_hs256(token, secret):
            display_secret = repr(secret) if secret else "'(empty string)'"
            findings.append(make_finding(
                vulnerability="JWT Signed With Weak Secret",
                severity="CRITICAL",
                location=location,
                evidence=(
                    f"The JWT is signed with a weak/guessable secret: "
                    f"{display_secret}. An attacker can forge arbitrary tokens "
                    f"using this secret. Algorithm: {alg}."
                ),
                category=CATEGORY,
                raw_details={
                    "algorithm": alg,
                    "weak_secret": secret,
                    "check": "weak_secret",
                },
            ))
            break  # One finding is enough

    return findings


def check_expiration(
    payload: Dict, location: str,
) -> List[Dict]:
    """Check 5: Token expiration — missing exp or too long (>24h)."""
    findings: List[Dict] = []

    exp = payload.get("exp")
    iat = payload.get("iat")

    if exp is None:
        findings.append(make_finding(
            vulnerability="JWT Missing Expiration Claim",
            severity="HIGH",
            location=location,
            evidence=(
                "The JWT payload does not contain an 'exp' (expiration) claim. "
                "Tokens without expiration never expire and can be reused "
                "indefinitely if stolen."
            ),
            category=CATEGORY,
            raw_details={
                "claims_present": list(payload.keys()),
                "check": "missing_exp",
            },
        ))
    else:
        # Check if expiration is too far in the future (>24 hours)
        try:
            exp_val = int(exp)
            now = int(time.time())

            if iat is not None:
                iat_val = int(iat)
                token_lifetime = exp_val - iat_val
            else:
                token_lifetime = exp_val - now

            max_lifetime = 24 * 3600  # 24 hours in seconds

            if token_lifetime > max_lifetime:
                hours = token_lifetime / 3600
                findings.append(make_finding(
                    vulnerability="JWT Expiration Too Long",
                    severity="MEDIUM",
                    location=location,
                    evidence=(
                        f"The JWT has an expiration lifetime of {hours:.1f} hours "
                        f"({token_lifetime} seconds), which exceeds the recommended "
                        f"maximum of 24 hours. Long-lived tokens increase the window "
                        f"for token theft and replay attacks."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "exp": exp_val,
                        "iat": iat,
                        "lifetime_seconds": token_lifetime,
                        "lifetime_hours": round(hours, 1),
                        "check": "long_expiration",
                    },
                ))
        except (ValueError, TypeError):
            pass

    return findings


def check_sensitive_data(
    payload: Dict, location: str,
) -> List[Dict]:
    """Check 6: Look for sensitive data in JWT payload."""
    findings: List[Dict] = []
    sensitive_fields_found: List[str] = []

    # Check field names for sensitive patterns
    for key in payload.keys():
        for pattern in SENSITIVE_FIELD_PATTERNS:
            if pattern.search(key):
                # Skip common non-sensitive fields named 'token' in JWT context
                if key.lower() in ("token_type", "token_use", "at_hash"):
                    continue
                sensitive_fields_found.append(key)
                break

    # Check all string values for credit card numbers and SSNs
    for key, value in payload.items():
        if not isinstance(value, str):
            value = str(value)
        if CREDIT_CARD_REGEX.search(value):
            sensitive_fields_found.append(f"{key} (contains credit card number)")
        if SSN_REGEX.search(value):
            sensitive_fields_found.append(f"{key} (contains SSN)")

    if sensitive_fields_found:
        findings.append(make_finding(
            vulnerability="JWT Contains Sensitive Data",
            severity="HIGH",
            location=location,
            evidence=(
                f"The JWT payload contains potentially sensitive fields: "
                f"{', '.join(sensitive_fields_found)}. JWTs are base64-encoded "
                f"(not encrypted) and can be decoded by anyone. Sensitive data "
                f"should never be stored in JWT payloads."
            ),
            category=CATEGORY,
            raw_details={
                "sensitive_fields": sensitive_fields_found,
                "payload_keys": list(payload.keys()),
                "check": "sensitive_data",
            },
        ))

    return findings


def check_algorithm_confusion(
    session, header: Dict, payload: Dict, token: str,
    location: str, target: str, timeout: int,
) -> List[Dict]:
    """Check 7: Try changing algorithm to 'none' and send the forged token."""
    findings: List[Dict] = []
    alg = header.get("alg", "").lower()

    # Only test if the original uses a real algorithm
    if alg in ("none", ""):
        return findings

    # Forge token with alg=none
    forged_header = dict(header)
    for none_variant in ["none", "None", "NONE", "nOnE"]:
        forged_header["alg"] = none_variant
        forged_token = craft_jwt(forged_header, payload)

        resp, err = safe_request(
            session, "GET", target, timeout=timeout,
            headers={"Authorization": f"Bearer {forged_token}"},
        )
        if err or resp is None:
            continue

        # Compare with an invalid token to establish baseline
        resp_invalid, _ = safe_request(
            session, "GET", target, timeout=timeout,
            headers={"Authorization": "Bearer invalid.token.here"},
        )

        if resp_invalid and resp.status_code != resp_invalid.status_code:
            if resp.status_code not in (401, 403) and resp.status_code < 400:
                findings.append(make_finding(
                    vulnerability="JWT Algorithm Confusion (none)",
                    severity="CRITICAL",
                    location=location,
                    evidence=(
                        f"The server accepted a JWT with the algorithm changed "
                        f"to '{none_variant}' (original: '{alg}'). This indicates "
                        f"the server does not properly validate the algorithm, "
                        f"allowing token forgery. Forged token status: "
                        f"{resp.status_code}."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "original_algorithm": alg,
                        "forged_algorithm": none_variant,
                        "forged_status": resp.status_code,
                        "invalid_status": resp_invalid.status_code if resp_invalid else None,
                        "check": "alg_confusion_none",
                    },
                ))
                break  # One finding is enough

    return findings


def check_kid_injection(
    session, header: Dict, payload: Dict, token: str,
    location: str, target: str, timeout: int,
) -> List[Dict]:
    """Check 8: Test kid (Key ID) parameter for injection vulnerabilities."""
    findings: List[Dict] = []

    kid = header.get("kid")
    if kid is None:
        return findings

    for injection_payload in KID_INJECTION_PAYLOADS:
        forged_header = dict(header)
        forged_header["kid"] = injection_payload

        # For /dev/null injection, sign with empty secret
        if "dev/null" in injection_payload:
            forged_token = craft_jwt(forged_header, payload, secret="")
        else:
            forged_token = craft_jwt(forged_header, payload)

        resp, err = safe_request(
            session, "GET", target, timeout=timeout,
            headers={"Authorization": f"Bearer {forged_token}"},
        )
        if err or resp is None:
            continue

        # Check for signs of injection success
        body = (resp.text or "")[:5000].lower()

        # Look for error messages that reveal injection worked
        injection_indicators = [
            "root:",           # /etc/passwd content
            "sql",             # SQL error
            "syntax error",    # Command injection error
            "no such file",    # Path traversal partial success
            "permission denied",
        ]

        for indicator in injection_indicators:
            if indicator in body:
                findings.append(make_finding(
                    vulnerability="JWT kid Parameter Injection",
                    severity="CRITICAL",
                    location=location,
                    evidence=(
                        f"The JWT 'kid' (Key ID) header parameter may be vulnerable "
                        f"to injection. Payload: '{injection_payload}' produced a "
                        f"response containing '{indicator}'. Original kid: '{kid}'. "
                        f"This could allow path traversal, SQL injection, or "
                        f"command injection through the kid parameter."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "original_kid": kid,
                        "injection_payload": injection_payload,
                        "indicator_found": indicator,
                        "response_status": resp.status_code,
                        "check": "kid_injection",
                    },
                ))
                return findings  # One finding is enough

        # Also check if the /dev/null trick worked (token accepted)
        if "dev/null" in injection_payload and resp.status_code not in (401, 403):
            resp_invalid, _ = safe_request(
                session, "GET", target, timeout=timeout,
                headers={"Authorization": "Bearer invalid.token.here"},
            )
            if resp_invalid and resp_invalid.status_code in (401, 403):
                findings.append(make_finding(
                    vulnerability="JWT kid Parameter Path Traversal",
                    severity="CRITICAL",
                    location=location,
                    evidence=(
                        f"The JWT 'kid' parameter is vulnerable to path traversal. "
                        f"Setting kid to '{injection_payload}' and signing with an "
                        f"empty secret produced an accepted token (status "
                        f"{resp.status_code}). This allows forging tokens by "
                        f"reading /dev/null as the signing key."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "original_kid": kid,
                        "injection_payload": injection_payload,
                        "forged_status": resp.status_code,
                        "check": "kid_path_traversal",
                    },
                ))
                return findings

    return findings


def check_public_key_confusion(
    header: Dict, location: str,
) -> List[Dict]:
    """Check 2 (supplement): HS256 with public key confusion risk."""
    findings: List[Dict] = []
    alg = header.get("alg", "").upper()

    # If using RSA/EC but we can detect the public key in the header
    # or if using HMAC which could be confused with asymmetric
    if alg in ("RS256", "RS384", "RS512", "ES256", "ES384", "ES512"):
        # Flag that algorithm confusion to HS256 should be tested
        # (actual exploitation needs the public key, so we flag the risk)
        findings.append(make_finding(
            vulnerability="JWT Asymmetric Algorithm (Key Confusion Risk)",
            severity="MEDIUM",
            location=location,
            evidence=(
                f"The JWT uses asymmetric algorithm '{alg}'. If the server "
                f"does not enforce the expected algorithm, an attacker who "
                f"obtains the public key could switch the algorithm to HS256 "
                f"and sign tokens using the public key as the HMAC secret "
                f"(CVE-2016-10555 / algorithm confusion attack)."
            ),
            category=CATEGORY,
            cve_id="CVE-2016-10555",
            raw_details={
                "algorithm": alg,
                "check": "public_key_confusion_risk",
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# JWT collection across pages
# ---------------------------------------------------------------------------
def collect_jwts(
    session, target: str, urls: List[str],
    timeout: int, delay: float,
) -> List[Tuple[str, str, str]]:
    """
    Collect JWTs from multiple URLs.
    Returns list of (jwt_token, source_description, source_url) tuples.
    """
    all_tokens: List[Tuple[str, str, str]] = []
    seen_tokens: set = set()

    for url in urls:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or resp is None:
            continue

        jwt_hits = extract_jwts_from_response(resp)
        for token, source in jwt_hits:
            if token not in seen_tokens:
                seen_tokens.add(token)
                all_tokens.append((token, source, url))

        # Also try POST to login-like endpoints
        if any(p in url.lower() for p in ("/login", "/signin", "/auth", "/token")):
            resp_post, err_post = safe_request(
                session, "POST", url, timeout=timeout,
                json={"username": "test", "password": "test"},
                headers={"Content-Type": "application/json"},
            )
            if not err_post and resp_post is not None:
                jwt_hits_post = extract_jwts_from_response(resp_post)
                for token, source in jwt_hits_post:
                    if token not in seen_tokens:
                        seen_tokens.add(token)
                        all_tokens.append((token, source, url))

        if delay > 0:
            time.sleep(delay)

    return all_tokens


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="JWT Signed With Weak Secret",
            severity="CRITICAL",
            location=target,
            evidence=(
                "The JWT is signed with a weak/guessable secret: 'secret'. "
                "An attacker can forge arbitrary tokens using this secret. "
                "Algorithm: HS256."
            ),
            category=CATEGORY,
            raw_details={
                "algorithm": "HS256",
                "weak_secret": "secret",
                "check": "weak_secret",
            },
        ),
        make_finding(
            vulnerability="JWT Missing Expiration Claim",
            severity="HIGH",
            location=target,
            evidence=(
                "The JWT payload does not contain an 'exp' (expiration) claim. "
                "Tokens without expiration never expire and can be reused "
                "indefinitely if stolen."
            ),
            category=CATEGORY,
            raw_details={
                "claims_present": ["sub", "name", "iat", "role"],
                "check": "missing_exp",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — JWT Vulnerability Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)
    if not target:
        from scan_utils import output_error
        output_error("Invalid target URL")

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    session = create_session(
        timeout=args.timeout, cookies=args.cookies, headers=args.headers,
    )
    timeout = args.timeout
    delay = args.delay
    findings: List[Dict] = []

    # Step 0: Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        from scan_utils import output_error
        output_error(f"Cannot reach target: {err}")
        return

    # Step 1: Crawl target for pages
    urls = crawl_same_domain(
        target, session, delay=delay, timeout=timeout,
        max_pages=30, depth=args.crawl_depth,
    )

    # Add common auth paths that might not be linked
    parsed_target = urlparse(target)
    base = f"{parsed_target.scheme}://{parsed_target.netloc}"
    for path in AUTH_PATHS:
        auth_url = base + path
        if auth_url not in urls:
            urls.append(auth_url)

    # Step 2: Collect JWTs from all discovered URLs
    jwt_tokens = collect_jwts(session, target, urls, timeout, delay)

    # Also check if the session already has JWTs in cookies
    for cookie in session.cookies:
        if JWT_REGEX.match(cookie.value or ""):
            token = cookie.value
            if token not in {t[0] for t in jwt_tokens}:
                jwt_tokens.append((token, f"cookie:{cookie.name}", target))

    if not jwt_tokens:
        # No JWTs found — output empty findings
        output_findings([])
        return

    # Step 3: Analyze each discovered JWT
    for token, source, source_url in jwt_tokens:
        parsed = parse_jwt(token)
        if parsed is None:
            continue

        header, payload, signature = parsed
        location = f"{source_url} ({source})"

        # Check 1/2: Algorithm issues (none, asymmetric confusion risk)
        findings.extend(check_algorithm_none(header, payload, token, location))
        findings.extend(check_public_key_confusion(header, location))

        # Check 3: Stripped signature acceptance
        findings.extend(check_stripped_signature(
            session, header, payload, token, location, target, timeout,
        ))

        # Check 4: Weak secrets
        findings.extend(check_weak_secrets(header, token, location))

        # Check 5: Expiration
        findings.extend(check_expiration(payload, location))

        # Check 6: Sensitive data in payload
        findings.extend(check_sensitive_data(payload, location))

        # Check 7: Algorithm confusion (none variant)
        findings.extend(check_algorithm_confusion(
            session, header, payload, token, location, target, timeout,
        ))

        # Check 8: kid injection
        findings.extend(check_kid_injection(
            session, header, payload, token, location, target, timeout,
        ))

        time.sleep(delay)

    # Deduplicate findings by (vulnerability, location)
    seen: set = set()
    unique_findings: List[Dict] = []
    for f in findings:
        check_type = f.get("raw_details", {}).get("check", "")
        key = (f["vulnerability"], f["location"], check_type)
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
