#!/usr/bin/env python3
"""
VaultScan — Cookie Security Analyzer
======================================
Comprehensive cookie security analysis that checks:
  1. Secure flag (missing on HTTPS = vulnerability)
  2. HttpOnly flag (missing on session cookies = XSS risk)
  3. SameSite attribute (missing or None = CSRF risk)
  4. Domain scope (overly broad = security risk)
  5. Path scope
  6. Expires/Max-Age (session vs persistent cookies)
  7. Cookie name patterns (detect session cookies)
  8. Cookie value entropy (low entropy = predictable IDs)
  9. Cookie prefixes (__Secure-, __Host-)
  10. Multi-page analysis (root, login page)

Outputs JSON array of findings to stdout.
"""

import math
import os
import re
import sys
import time
from collections import Counter
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

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
    make_finding,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "COOKIE_SECURITY"

# Known session cookie name patterns (case-insensitive matching)
SESSION_COOKIE_PATTERNS = [
    re.compile(r"^phpsessid$", re.I),
    re.compile(r"^jsessionid$", re.I),
    re.compile(r"^asp\.net_sessionid$", re.I),
    re.compile(r"^aspsessionid", re.I),
    re.compile(r"^session[-_]?id$", re.I),
    re.compile(r"^sessid$", re.I),
    re.compile(r"^sid$", re.I),
    re.compile(r"^session$", re.I),
    re.compile(r"^sess$", re.I),
    re.compile(r"^connect\.sid$", re.I),
    re.compile(r"^laravel_session$", re.I),
    re.compile(r"^_rails_session$", re.I),
    re.compile(r"^ci_session$", re.I),
    re.compile(r"^wp_.*logged_in", re.I),
    re.compile(r"^token$", re.I),
    re.compile(r"^access[-_]?token$", re.I),
    re.compile(r"^auth[-_]?token$", re.I),
    re.compile(r"^jwt$", re.I),
    re.compile(r"^_session$", re.I),
    re.compile(r"^user[-_]?session$", re.I),
    re.compile(r"^xsrf[-_]?token$", re.I),
    re.compile(r"^csrf[-_]?token$", re.I),
]

# Pages to probe for cookies beyond the root
LOGIN_PATHS = [
    "/login",
    "/signin",
    "/auth/login",
    "/user/login",
    "/admin/login",
    "/account/login",
    "/wp-login.php",
    "/api/auth",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_session_cookie(name: str) -> bool:
    """Check if a cookie name matches known session cookie patterns."""
    for pattern in SESSION_COOKIE_PATTERNS:
        if pattern.search(name):
            return True
    return False


def _calculate_entropy(value: str) -> float:
    """
    Calculate Shannon entropy of a cookie value in bits per character.
    Higher entropy indicates more randomness (better for session IDs).
    """
    if not value:
        return 0.0
    length = len(value)
    if length == 0:
        return 0.0
    freq = Counter(value)
    entropy = 0.0
    for count in freq.values():
        prob = count / length
        if prob > 0:
            entropy -= prob * math.log2(prob)
    return round(entropy, 2)


def _parse_set_cookie_header(header_value: str) -> Dict:
    """
    Parse a single Set-Cookie header value into its components.
    Returns a dict with: name, value, secure, httponly, samesite,
    domain, path, expires, max_age, raw.
    """
    cookie = {
        "name": "",
        "value": "",
        "secure": False,
        "httponly": False,
        "samesite": None,
        "domain": None,
        "path": None,
        "expires": None,
        "max_age": None,
        "raw": header_value,
    }

    parts = header_value.split(";")
    if not parts:
        return cookie

    # First part is name=value
    name_value = parts[0].strip()
    if "=" in name_value:
        cookie["name"], cookie["value"] = name_value.split("=", 1)
        cookie["name"] = cookie["name"].strip()
        cookie["value"] = cookie["value"].strip()
    else:
        cookie["name"] = name_value

    # Parse attributes
    for part in parts[1:]:
        part = part.strip()
        part_lower = part.lower()

        if part_lower == "secure":
            cookie["secure"] = True
        elif part_lower == "httponly":
            cookie["httponly"] = True
        elif part_lower.startswith("samesite"):
            if "=" in part:
                cookie["samesite"] = part.split("=", 1)[1].strip()
            else:
                cookie["samesite"] = "unspecified"
        elif part_lower.startswith("domain"):
            if "=" in part:
                cookie["domain"] = part.split("=", 1)[1].strip()
        elif part_lower.startswith("path"):
            if "=" in part:
                cookie["path"] = part.split("=", 1)[1].strip()
        elif part_lower.startswith("expires"):
            if "=" in part:
                cookie["expires"] = part.split("=", 1)[1].strip()
        elif part_lower.startswith("max-age"):
            if "=" in part:
                try:
                    cookie["max_age"] = int(part.split("=", 1)[1].strip())
                except ValueError:
                    cookie["max_age"] = None

    return cookie


def _is_domain_too_broad(cookie_domain: Optional[str], target_host: str) -> bool:
    """
    Check if a cookie domain is overly broad relative to the target.
    A domain like .example.com on a host app.sub.example.com is broad.
    """
    if not cookie_domain:
        return False

    cookie_domain = cookie_domain.lstrip(".").lower()
    target_host = target_host.lower()

    # If cookie domain is shorter than target host and target ends with it,
    # check how many extra sub-levels the target has
    if target_host.endswith(cookie_domain) and target_host != cookie_domain:
        target_parts = target_host.split(".")
        cookie_parts = cookie_domain.split(".")
        extra_levels = len(target_parts) - len(cookie_parts)
        if extra_levels >= 1:
            return True

    return False


def _has_secure_prefix(name: str) -> bool:
    """Check if cookie uses __Secure- prefix."""
    return name.startswith("__Secure-")


def _has_host_prefix(name: str) -> bool:
    """Check if cookie uses __Host- prefix."""
    return name.startswith("__Host-")


def _validate_host_prefix(cookie: Dict) -> List[str]:
    """
    Validate __Host- prefix requirements:
    - Must have Secure flag
    - Must not have Domain attribute
    - Path must be /
    """
    issues = []
    if not cookie["secure"]:
        issues.append("__Host- cookie missing Secure flag")
    if cookie["domain"]:
        issues.append("__Host- cookie must not set Domain attribute")
    if cookie["path"] != "/":
        issues.append("__Host- cookie Path must be '/'")
    return issues


def _validate_secure_prefix(cookie: Dict) -> List[str]:
    """
    Validate __Secure- prefix requirements:
    - Must have Secure flag
    """
    issues = []
    if not cookie["secure"]:
        issues.append("__Secure- cookie missing Secure flag")
    return issues


# ---------------------------------------------------------------------------
# Cookie Collection
# ---------------------------------------------------------------------------
def collect_cookies_from_url(
    session,
    url: str,
    timeout: int,
) -> List[Dict]:
    """
    Fetch a URL and extract all Set-Cookie headers.
    Returns a list of parsed cookie dicts.
    """
    cookies = []
    resp, err = safe_request(
        session, "GET", url, timeout=timeout,
        allow_redirects=False,
    )
    if err or resp is None:
        return cookies

    # Extract Set-Cookie headers (may appear multiple times)
    raw_cookies = resp.headers.get("Set-Cookie")
    if not raw_cookies:
        # Try to get all Set-Cookie headers from raw response
        # requests stores multiple Set-Cookie in response.headers as combined
        # We need to use the raw headers
        if hasattr(resp, "raw") and resp.raw and hasattr(resp.raw, "headers"):
            raw_items = resp.raw.headers.getlist("Set-Cookie")
            if raw_items:
                for raw_val in raw_items:
                    parsed = _parse_set_cookie_header(raw_val)
                    if parsed["name"]:
                        parsed["source_url"] = url
                        cookies.append(parsed)
        return cookies

    # If we got a single combined header, try to split intelligently
    # requests may combine multiple Set-Cookie headers
    # Use raw headers for accurate parsing
    if hasattr(resp, "raw") and resp.raw and hasattr(resp.raw, "headers"):
        raw_items = resp.raw.headers.getlist("Set-Cookie")
        if raw_items:
            for raw_val in raw_items:
                parsed = _parse_set_cookie_header(raw_val)
                if parsed["name"]:
                    parsed["source_url"] = url
                    cookies.append(parsed)
            return cookies

    # Fallback: parse the combined header
    parsed = _parse_set_cookie_header(raw_cookies)
    if parsed["name"]:
        parsed["source_url"] = url
        cookies.append(parsed)

    return cookies


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------
def analyze_cookie(
    cookie: Dict,
    is_https: bool,
    target_host: str,
) -> List[Dict]:
    """
    Analyze a single cookie for security issues.
    Returns a list of findings.
    """
    findings: List[Dict] = []
    name = cookie["name"]
    value = cookie["value"]
    source_url = cookie.get("source_url", "unknown")
    is_session = _is_session_cookie(name)
    cookie_type = "session cookie" if is_session else "cookie"

    # ----- 1. Missing Secure flag on HTTPS site -----
    if is_https and not cookie["secure"]:
        severity = "HIGH" if is_session else "MEDIUM"
        findings.append(make_finding(
            vulnerability=f"Cookie Missing Secure Flag",
            severity=severity,
            location=source_url,
            evidence=(
                f"The {cookie_type} '{name}' is served over HTTPS but lacks "
                f"the Secure flag. It may be transmitted over unencrypted HTTP "
                f"connections, exposing it to interception."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": name,
                "is_session_cookie": is_session,
                "flag_missing": "Secure",
                "attributes": _cookie_attrs_summary(cookie),
            },
        ))

    # ----- 2. Missing HttpOnly on session cookies -----
    if is_session and not cookie["httponly"]:
        findings.append(make_finding(
            vulnerability=f"Session Cookie Missing HttpOnly Flag",
            severity="HIGH",
            location=source_url,
            evidence=(
                f"The session cookie '{name}' lacks the HttpOnly flag. "
                f"Client-side JavaScript can access this cookie, making it "
                f"vulnerable to theft via Cross-Site Scripting (XSS) attacks."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": name,
                "is_session_cookie": True,
                "flag_missing": "HttpOnly",
                "attributes": _cookie_attrs_summary(cookie),
            },
        ))
    elif not is_session and not cookie["httponly"]:
        # Non-session cookie without HttpOnly is lower priority
        findings.append(make_finding(
            vulnerability=f"Cookie Missing HttpOnly Flag",
            severity="LOW",
            location=source_url,
            evidence=(
                f"The cookie '{name}' lacks the HttpOnly flag. While not "
                f"identified as a session cookie, client-side scripts can "
                f"read its value."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": name,
                "is_session_cookie": False,
                "flag_missing": "HttpOnly",
                "attributes": _cookie_attrs_summary(cookie),
            },
        ))

    # ----- 3. Missing or weak SameSite attribute -----
    samesite = cookie["samesite"]
    if samesite is None:
        severity = "MEDIUM" if is_session else "LOW"
        findings.append(make_finding(
            vulnerability=f"Cookie Missing SameSite Attribute",
            severity=severity,
            location=source_url,
            evidence=(
                f"The {cookie_type} '{name}' does not set the SameSite attribute. "
                f"Modern browsers default to Lax, but explicit declaration is "
                f"recommended to prevent CSRF attacks."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": name,
                "is_session_cookie": is_session,
                "flag_missing": "SameSite",
                "attributes": _cookie_attrs_summary(cookie),
            },
        ))
    elif samesite and samesite.lower() == "none":
        if not cookie["secure"]:
            findings.append(make_finding(
                vulnerability=f"SameSite=None Without Secure Flag",
                severity="HIGH",
                location=source_url,
                evidence=(
                    f"The {cookie_type} '{name}' sets SameSite=None without the "
                    f"Secure flag. Browsers will reject this cookie. SameSite=None "
                    f"requires the Secure attribute."
                ),
                category=CATEGORY,
                raw_details={
                    "cookie_name": name,
                    "samesite": samesite,
                    "secure": False,
                    "attributes": _cookie_attrs_summary(cookie),
                },
            ))
        else:
            findings.append(make_finding(
                vulnerability=f"Cookie Uses SameSite=None",
                severity="MEDIUM",
                location=source_url,
                evidence=(
                    f"The {cookie_type} '{name}' sets SameSite=None, allowing "
                    f"cross-site transmission. This increases exposure to CSRF "
                    f"attacks unless other mitigations are in place."
                ),
                category=CATEGORY,
                raw_details={
                    "cookie_name": name,
                    "samesite": samesite,
                    "attributes": _cookie_attrs_summary(cookie),
                },
            ))

    # ----- 4. Domain scope too broad -----
    if _is_domain_too_broad(cookie["domain"], target_host):
        findings.append(make_finding(
            vulnerability=f"Cookie Domain Scope Too Broad",
            severity="MEDIUM",
            location=source_url,
            evidence=(
                f"The {cookie_type} '{name}' is scoped to domain "
                f"'{cookie['domain']}', which is broader than the target host "
                f"'{target_host}'. Sibling subdomains can read this cookie."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": name,
                "cookie_domain": cookie["domain"],
                "target_host": target_host,
                "attributes": _cookie_attrs_summary(cookie),
            },
        ))

    # ----- 5. Cookie value entropy (session cookies only) -----
    if is_session and value and len(value) >= 8:
        entropy = _calculate_entropy(value)
        # Good session IDs should have entropy > 3.0 bits/char
        if entropy < 3.0:
            findings.append(make_finding(
                vulnerability=f"Low Entropy Session Cookie Value",
                severity="MEDIUM",
                location=source_url,
                evidence=(
                    f"The session cookie '{name}' has a value with low Shannon "
                    f"entropy ({entropy} bits/char). Predictable session IDs "
                    f"can be brute-forced. Value length: {len(value)} chars."
                ),
                category=CATEGORY,
                raw_details={
                    "cookie_name": name,
                    "value_length": len(value),
                    "entropy_bits_per_char": entropy,
                    "threshold": 3.0,
                },
            ))

    # ----- 6. Cookie prefix validation -----
    if _has_host_prefix(name):
        issues = _validate_host_prefix(cookie)
        for issue in issues:
            findings.append(make_finding(
                vulnerability=f"Invalid __Host- Cookie Prefix",
                severity="HIGH",
                location=source_url,
                evidence=(
                    f"The cookie '{name}' uses the __Host- prefix but violates "
                    f"its requirements: {issue}. Browsers may reject this cookie."
                ),
                category=CATEGORY,
                raw_details={
                    "cookie_name": name,
                    "prefix": "__Host-",
                    "violation": issue,
                    "attributes": _cookie_attrs_summary(cookie),
                },
            ))

    if _has_secure_prefix(name):
        issues = _validate_secure_prefix(cookie)
        for issue in issues:
            findings.append(make_finding(
                vulnerability=f"Invalid __Secure- Cookie Prefix",
                severity="HIGH",
                location=source_url,
                evidence=(
                    f"The cookie '{name}' uses the __Secure- prefix but lacks "
                    f"the Secure flag. Browsers may reject this cookie."
                ),
                category=CATEGORY,
                raw_details={
                    "cookie_name": name,
                    "prefix": "__Secure-",
                    "violation": issue,
                    "attributes": _cookie_attrs_summary(cookie),
                },
            ))

    return findings


def _cookie_attrs_summary(cookie: Dict) -> Dict:
    """Build a summary dict of cookie attributes for raw_details."""
    return {
        "secure": cookie["secure"],
        "httponly": cookie["httponly"],
        "samesite": cookie["samesite"],
        "domain": cookie["domain"],
        "path": cookie["path"],
        "has_expires": cookie["expires"] is not None,
        "has_max_age": cookie["max_age"] is not None,
    }


# ---------------------------------------------------------------------------
# Multi-page cookie collection
# ---------------------------------------------------------------------------
def discover_cookies(
    session,
    target: str,
    timeout: int,
    delay: float,
) -> List[Dict]:
    """
    Collect cookies from the root page and common login/auth pages.
    Returns deduplicated list of parsed cookies.
    """
    all_cookies: List[Dict] = []
    seen_names: set = set()

    # 1. Root page
    root_cookies = collect_cookies_from_url(session, target, timeout)
    for c in root_cookies:
        if c["name"] not in seen_names:
            seen_names.add(c["name"])
            all_cookies.append(c)

    # 2. Probe login/auth paths
    for path in LOGIN_PATHS:
        url = target.rstrip("/") + path
        time.sleep(delay)
        page_cookies = collect_cookies_from_url(session, url, timeout)
        for c in page_cookies:
            if c["name"] not in seen_names:
                seen_names.add(c["name"])
                all_cookies.append(c)

    # 3. Follow redirects on root to capture cookies set during redirect chain
    resp_redirect, err = safe_request(
        session, "GET", target, timeout=timeout,
        allow_redirects=True,
    )
    if resp_redirect and not err:
        # Check cookies accumulated in the session jar
        for cookie_obj in session.cookies:
            if cookie_obj.name not in seen_names:
                seen_names.add(cookie_obj.name)
                # Build a parsed cookie dict from the cookie jar entry
                all_cookies.append({
                    "name": cookie_obj.name,
                    "value": cookie_obj.value or "",
                    "secure": cookie_obj.secure,
                    "httponly": bool(
                        cookie_obj._rest.get("HttpOnly", False)
                        or cookie_obj._rest.get("httponly", False)
                    ),
                    "samesite": cookie_obj._rest.get("SameSite",
                                cookie_obj._rest.get("samesite", None)),
                    "domain": cookie_obj.domain,
                    "path": cookie_obj.path,
                    "expires": cookie_obj.expires,
                    "max_age": None,
                    "raw": f"{cookie_obj.name}={cookie_obj.value}",
                    "source_url": target,
                })

    return all_cookies


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="Session Cookie Missing HttpOnly Flag",
            severity="HIGH",
            location=target,
            evidence=(
                "The session cookie 'PHPSESSID' lacks the HttpOnly flag. "
                "Client-side JavaScript can access this cookie, making it "
                "vulnerable to theft via Cross-Site Scripting (XSS) attacks."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": "PHPSESSID",
                "is_session_cookie": True,
                "flag_missing": "HttpOnly",
                "attributes": {
                    "secure": False,
                    "httponly": False,
                    "samesite": None,
                    "domain": None,
                    "path": "/",
                    "has_expires": False,
                    "has_max_age": False,
                },
            },
        ),
        make_finding(
            vulnerability="Cookie Missing SameSite Attribute",
            severity="MEDIUM",
            location=target,
            evidence=(
                "The session cookie 'session_id' does not set the SameSite "
                "attribute. Modern browsers default to Lax, but explicit "
                "declaration is recommended to prevent CSRF attacks."
            ),
            category=CATEGORY,
            raw_details={
                "cookie_name": "session_id",
                "is_session_cookie": True,
                "flag_missing": "SameSite",
                "attributes": {
                    "secure": True,
                    "httponly": True,
                    "samesite": None,
                    "domain": None,
                    "path": "/",
                    "has_expires": False,
                    "has_max_age": False,
                },
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Cookie Security Analyzer")
    args = parser.parse_args()

    target = normalize_url(args.target)
    if not target:
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
        output_error(f"Cannot reach target: {err}")
        return

    # Determine if target uses HTTPS
    parsed_target = urlparse(target)
    is_https = parsed_target.scheme.lower() == "https"
    target_host = parsed_target.netloc.lower()
    # Strip port from host for domain comparison
    if ":" in target_host:
        target_host = target_host.split(":")[0]

    # Step 1: Collect cookies from multiple pages
    cookies = discover_cookies(session, target, timeout, delay)

    if not cookies:
        # No cookies found -- output empty findings
        output_findings([])
        return

    # Step 2: Analyze each cookie
    for cookie in cookies:
        cookie_findings = analyze_cookie(cookie, is_https, target_host)
        findings.extend(cookie_findings)

    # Step 3: Overall assessment -- session cookies without both Secure+HttpOnly
    for cookie in cookies:
        if _is_session_cookie(cookie["name"]):
            if not cookie["secure"] and not cookie["httponly"] and is_https:
                # Check we haven't already flagged the combo
                combo_key = f"{cookie['name']}-combo"
                already = any(
                    f["raw_details"].get("cookie_name") == cookie["name"]
                    and f["severity"] == "HIGH"
                    for f in findings
                )
                if not already:
                    findings.append(make_finding(
                        vulnerability="Session Cookie Missing Both Secure and HttpOnly",
                        severity="HIGH",
                        location=cookie.get("source_url", target),
                        evidence=(
                            f"The session cookie '{cookie['name']}' lacks both "
                            f"Secure and HttpOnly flags. This is a critical "
                            f"security gap: the cookie can be stolen via XSS "
                            f"and intercepted over unencrypted connections."
                        ),
                        category=CATEGORY,
                        raw_details={
                            "cookie_name": cookie["name"],
                            "is_session_cookie": True,
                            "flags_missing": ["Secure", "HttpOnly"],
                            "attributes": _cookie_attrs_summary(cookie),
                        },
                    ))

    # Deduplicate findings by (vulnerability, location, cookie_name)
    seen: set = set()
    unique_findings: List[Dict] = []
    for f in findings:
        cookie_name = f.get("raw_details", {}).get("cookie_name", "")
        key = (f["vulnerability"], f["location"], cookie_name)
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
