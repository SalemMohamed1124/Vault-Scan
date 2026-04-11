#!/usr/bin/env python3
"""
VaultScan — CRLF Injection / HTTP Header Injection Scanner
============================================================
Detects CRLF injection vulnerabilities that allow attackers to inject
arbitrary HTTP headers or split HTTP responses.

Tests:
1. Parameter-based CRLF injection — injects CRLF sequences into query
   parameter values and checks if injected headers appear in the response.
2. Response splitting — checks if double-CRLF payloads allow injecting
   arbitrary HTML body content via HTTP response splitting.
3. Path-based CRLF injection — injects CRLF sequences into the URL path
   segment to test servers that reflect path components into headers.
4. Cookie-setting injection — attempts to set arbitrary cookies via
   CRLF-injected Set-Cookie headers.

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
import time
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse, quote

# ---------------------------------------------------------------------------
# Ensure scan_utils is importable from the same directory
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    is_mock_mode,
    output_findings,
    output_error,
    base_argparser,
    normalize_url,
    create_session,
    safe_request,
    rate_limited_request,
    make_finding,
    extract_url_params,
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "INJECTION"
MAX_CRAWL_PAGES = 5

# Unique marker used to detect injection — random enough to avoid FPs
INJECTED_HEADER_NAME = "X-Crlf-Test"
INJECTED_HEADER_VALUE = "vaultscan_crlf_7f3a"
INJECTED_COOKIE_NAME = "crlf"
INJECTED_COOKIE_VALUE = "injected_7f3a"
INJECTED_BODY_MARKER = "<vaultscan_crlf_split>"

# ---------------------------------------------------------------------------
# Payloads
# ---------------------------------------------------------------------------
# Each payload dict contains:
#   raw  — the literal string to inject (will NOT be re-encoded by us;
#          we place it into the URL with manual string concatenation so
#          the encoded bytes reach the server verbatim).
#   desc — human-readable description.
#   kind — "header" (single header injection) or "split" (response splitting)
#          or "cookie" (Set-Cookie injection).

CRLF_PAYLOADS: List[Dict[str, str]] = [
    # --- Header injection payloads ---
    {
        "raw": f"%0d%0a{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "URL-encoded CRLF header injection (%0d%0a)",
        "kind": "header",
    },
    {
        "raw": f"%0D%0A{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "Uppercase URL-encoded CRLF header injection (%0D%0A)",
        "kind": "header",
    },
    {
        "raw": f"%0d%0a%20{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "CRLF with leading space (header folding bypass)",
        "kind": "header",
    },
    {
        "raw": f"\\r\\n{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "Literal backslash-r backslash-n injection",
        "kind": "header",
    },
    {
        "raw": f"%E5%98%8A%E5%98%8D{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "Unicode CRLF injection (U+560A U+560D — Webkit/Edge bypass)",
        "kind": "header",
    },
    {
        "raw": f"%0a{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "LF-only header injection (%0a)",
        "kind": "header",
    },
    {
        "raw": f"%23%0d%0a{INJECTED_HEADER_NAME}:{INJECTED_HEADER_VALUE}",
        "desc": "Hash prefix CRLF injection (%23%0d%0a)",
        "kind": "header",
    },

    # --- Response splitting payloads ---
    {
        "raw": f"%0d%0a%0d%0a{INJECTED_BODY_MARKER}",
        "desc": "Double CRLF response splitting (%0d%0a%0d%0a)",
        "kind": "split",
    },
    {
        "raw": f"%0D%0A%0D%0A{INJECTED_BODY_MARKER}",
        "desc": "Uppercase double CRLF response splitting",
        "kind": "split",
    },
    {
        "raw": f"%E5%98%8A%E5%98%8D%E5%98%8A%E5%98%8D{INJECTED_BODY_MARKER}",
        "desc": "Unicode double CRLF response splitting",
        "kind": "split",
    },

    # --- Cookie injection payloads ---
    {
        "raw": f"%0d%0aSet-Cookie:{INJECTED_COOKIE_NAME}={INJECTED_COOKIE_VALUE}",
        "desc": "CRLF Set-Cookie injection",
        "kind": "cookie",
    },
    {
        "raw": f"%0D%0ASet-Cookie:{INJECTED_COOKIE_NAME}={INJECTED_COOKIE_VALUE}",
        "desc": "Uppercase CRLF Set-Cookie injection",
        "kind": "cookie",
    },
]


# ---------------------------------------------------------------------------
# Detection Helpers
# ---------------------------------------------------------------------------
def _check_header_injected(resp) -> bool:
    """Return True if the injected header appears in the response headers."""
    if resp is None:
        return False
    # Check case-insensitively
    for hdr_name, hdr_value in resp.headers.items():
        if INJECTED_HEADER_NAME.lower() in hdr_name.lower():
            if INJECTED_HEADER_VALUE in hdr_value:
                return True
    return False


def _check_body_split(resp) -> bool:
    """Return True if the body marker appears in the response body,
    indicating successful HTTP response splitting."""
    if resp is None:
        return False
    return INJECTED_BODY_MARKER in resp.text


def _check_cookie_injected(resp) -> bool:
    """Return True if the injected Set-Cookie header is present."""
    if resp is None:
        return False
    set_cookies = resp.headers.get("Set-Cookie", "")
    if INJECTED_COOKIE_NAME in set_cookies and INJECTED_COOKIE_VALUE in set_cookies:
        return True
    # Some servers return multiple Set-Cookie headers; check raw
    for hdr_name, hdr_value in resp.headers.items():
        if hdr_name.lower() == "set-cookie":
            if INJECTED_COOKIE_NAME in hdr_value and INJECTED_COOKIE_VALUE in hdr_value:
                return True
    return False


def _build_injected_url(base_url: str, param: str, payload_raw: str) -> str:
    """Build a URL with the CRLF payload placed into the given parameter.

    We deliberately avoid standard URL-encoding so that our pre-encoded
    CRLF sequences (%0d%0a) are sent verbatim.
    """
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    # Build query string manually to preserve our encoded sequences
    parts = []
    for key, values in params.items():
        if key == param:
            # Inject the payload as the value
            parts.append(f"{key}={values[0]}{payload_raw}")
        else:
            for v in values:
                parts.append(f"{key}={v}")
    # If the param didn't exist in the query, append it
    if param not in params:
        parts.append(f"{param}=test{payload_raw}")

    new_query = "&".join(parts)
    return urlunparse(parsed._replace(query=new_query))


def _build_path_injected_url(base_url: str, payload_raw: str) -> str:
    """Append CRLF payload to the URL path segment."""
    parsed = urlparse(base_url)
    new_path = parsed.path.rstrip("/") + "/" + payload_raw
    return urlunparse(parsed._replace(path=new_path))


# ---------------------------------------------------------------------------
# Core Testing
# ---------------------------------------------------------------------------
def test_param_crlf(
    session,
    url: str,
    param: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test a single parameter for CRLF injection."""
    findings: List[Dict] = []

    for pdef in CRLF_PAYLOADS:
        payload_raw = pdef["raw"]
        kind = pdef["kind"]
        desc = pdef["desc"]

        test_url = _build_injected_url(url, param, payload_raw)

        resp, err = rate_limited_request(
            session, "GET", test_url,
            delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        # --- Evaluate based on payload kind ---
        if kind == "header" and _check_header_injected(resp):
            findings.append(make_finding(
                vulnerability="CRLF Injection — HTTP Header Injection",
                severity="HIGH",
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload '{desc}' in parameter '{param}' caused the "
                    f"injected header '{INJECTED_HEADER_NAME}: "
                    f"{INJECTED_HEADER_VALUE}' to appear in the HTTP response "
                    f"headers (status {resp.status_code})."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "parameter": param,
                    "payload": payload_raw,
                    "payload_description": desc,
                    "status_code": resp.status_code,
                    "test_url": test_url,
                    "injected_header": f"{INJECTED_HEADER_NAME}: {INJECTED_HEADER_VALUE}",
                },
            ))
            return findings  # One confirmed finding per param is enough

        if kind == "split" and _check_body_split(resp):
            findings.append(make_finding(
                vulnerability="CRLF Injection — HTTP Response Splitting",
                severity="CRITICAL",
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload '{desc}' in parameter '{param}' caused HTTP "
                    f"response splitting — the marker '{INJECTED_BODY_MARKER}' "
                    f"appeared in the response body, indicating full control "
                    f"over the HTTP response (status {resp.status_code})."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "parameter": param,
                    "payload": payload_raw,
                    "payload_description": desc,
                    "status_code": resp.status_code,
                    "test_url": test_url,
                },
            ))
            return findings

        if kind == "cookie" and _check_cookie_injected(resp):
            findings.append(make_finding(
                vulnerability="CRLF Injection — Set-Cookie Header Injection",
                severity="HIGH",
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload '{desc}' in parameter '{param}' injected a "
                    f"Set-Cookie header ({INJECTED_COOKIE_NAME}="
                    f"{INJECTED_COOKIE_VALUE}) into the response "
                    f"(status {resp.status_code})."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "parameter": param,
                    "payload": payload_raw,
                    "payload_description": desc,
                    "status_code": resp.status_code,
                    "test_url": test_url,
                    "injected_cookie": f"{INJECTED_COOKIE_NAME}={INJECTED_COOKIE_VALUE}",
                },
            ))
            return findings

    return findings


def test_path_crlf(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test CRLF injection via the URL path."""
    findings: List[Dict] = []

    # Only test header and split payloads on the path
    path_payloads = [p for p in CRLF_PAYLOADS if p["kind"] in ("header", "split")]

    for pdef in path_payloads:
        payload_raw = pdef["raw"]
        kind = pdef["kind"]
        desc = pdef["desc"]

        test_url = _build_path_injected_url(url, payload_raw)

        resp, err = rate_limited_request(
            session, "GET", test_url,
            delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        if kind == "header" and _check_header_injected(resp):
            findings.append(make_finding(
                vulnerability="CRLF Injection — Path-based Header Injection",
                severity="HIGH",
                location=f"{url} [path]",
                evidence=(
                    f"Payload '{desc}' appended to URL path caused the "
                    f"injected header '{INJECTED_HEADER_NAME}: "
                    f"{INJECTED_HEADER_VALUE}' to appear in the response "
                    f"headers (status {resp.status_code})."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "payload": payload_raw,
                    "payload_description": desc,
                    "status_code": resp.status_code,
                    "test_url": test_url,
                    "injection_point": "path",
                },
            ))
            return findings

        if kind == "split" and _check_body_split(resp):
            findings.append(make_finding(
                vulnerability="CRLF Injection — Path-based Response Splitting",
                severity="CRITICAL",
                location=f"{url} [path]",
                evidence=(
                    f"Payload '{desc}' appended to URL path caused HTTP "
                    f"response splitting — injected content appeared in "
                    f"the response body (status {resp.status_code})."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "payload": payload_raw,
                    "payload_description": desc,
                    "status_code": resp.status_code,
                    "test_url": test_url,
                    "injection_point": "path",
                },
            ))
            return findings

    return findings


# ---------------------------------------------------------------------------
# Reflection Check (lower-confidence finding)
# ---------------------------------------------------------------------------
def check_header_reflection(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Check if any response headers reflect URL parameter values,
    which is a prerequisite for CRLF injection even if the actual
    injection is blocked by encoding."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    reflection_marker = "vaultscanreflect42"

    for param in params:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        qs[param] = [reflection_marker]
        new_query = urlencode(qs, doseq=True)
        test_url = urlunparse(parsed._replace(query=new_query))

        resp, err = rate_limited_request(
            session, "GET", test_url,
            delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        # Check if our marker is reflected in any response header
        for hdr_name, hdr_value in resp.headers.items():
            if reflection_marker in hdr_value:
                findings.append(make_finding(
                    vulnerability="HTTP Header Parameter Reflection",
                    severity="MEDIUM",
                    location=f"{url} [param: {param}]",
                    evidence=(
                        f"Parameter '{param}' value is reflected in the "
                        f"response header '{hdr_name}'. This may enable "
                        f"CRLF injection if input is not properly sanitized. "
                        f"Header value: {hdr_value[:200]}"
                    ),
                    category=CATEGORY,
                    confidence="MEDIUM",
                    raw_details={
                        "parameter": param,
                        "reflected_header": hdr_name,
                        "header_value": hdr_value[:500],
                        "status_code": resp.status_code,
                    },
                ))
                break  # one finding per param

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return a single mock finding for development / demo mode."""
    return [
        make_finding(
            vulnerability="CRLF Injection — HTTP Header Injection",
            severity="HIGH",
            location=f"{target}/search?q=test [param: q]",
            evidence=(
                "Payload 'URL-encoded CRLF header injection (%0d%0a)' in "
                "parameter 'q' caused the injected header "
                "'X-Crlf-Test: vaultscan_crlf_7f3a' to appear in the HTTP "
                "response headers (status 302)."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "parameter": "q",
                "payload": "%0d%0aX-Crlf-Test:vaultscan_crlf_7f3a",
                "payload_description": "URL-encoded CRLF header injection (%0d%0a)",
                "status_code": 302,
                "test_url": f"{target}/search?q=test%0d%0aX-Crlf-Test:vaultscan_crlf_7f3a",
                "injected_header": "X-Crlf-Test: vaultscan_crlf_7f3a",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — CRLF Injection / HTTP Header Injection Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return

    # ---- Live scan --------------------------------------------------------
    session = create_session(
        timeout=args.timeout,
        cookies=args.cookies,
        headers=args.headers,
    )
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []

    # Verify connectivity
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Step 1: Path-based CRLF injection on the target root
    findings.extend(test_path_crlf(session, target, delay, timeout))

    # Step 2: Crawl for pages with parameters
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout,
            max_pages=MAX_CRAWL_PAGES, depth=1,
        )
    except Exception:
        pages = [target]

    if target not in pages:
        pages.insert(0, target)

    tested_params: Set[Tuple[str, str]] = set()  # (path, param) dedup
    tested_paths: Set[str] = set()

    for page_url in pages:
        parsed_page = urlparse(page_url)

        # --- Parameter-based CRLF testing ---
        params = extract_url_params(page_url)
        for param in params:
            dedup_key = (parsed_page.path, param.lower())
            if dedup_key in tested_params:
                continue
            tested_params.add(dedup_key)

            param_findings = test_param_crlf(
                session, page_url, param, delay, timeout,
            )
            findings.extend(param_findings)

        # --- Header reflection check (lower severity) ---
        if params:
            findings.extend(
                check_header_reflection(session, page_url, delay, timeout)
            )

        # --- Path-based CRLF on crawled pages ---
        if parsed_page.path not in tested_paths:
            tested_paths.add(parsed_page.path)
            findings.extend(
                test_path_crlf(session, page_url, delay, timeout)
            )

    # Deduplicate findings
    seen: Set[Tuple[str, str]] = set()
    unique_findings: List[Dict] = []
    for f in findings:
        key = (f["vulnerability"], f["location"])
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
