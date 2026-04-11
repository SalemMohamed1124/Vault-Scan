#!/usr/bin/env python3
"""
VaultScan — CORS Misconfiguration Scanner
==========================================
Deep Cross-Origin Resource Sharing (CORS) misconfiguration testing:
  1. Origin reflection (server reflects back any origin)
  2. Null origin acceptance
  3. Subdomain wildcard bypass (evil.target.com)
  4. Prefix/suffix bypass (target.com.evil.com, eviltarget.com)
  5. Credentials with wildcard/reflected origin (critical)
  6. Dangerous allowed methods (PUT, DELETE, PATCH)
  7. Sensitive exposed headers (Authorization, Set-Cookie)
  8. Preflight (OPTIONS) response analysis
  9. Tests on multiple crawled pages, not just the root

Outputs JSON array of findings to stdout.
"""

import os
import sys
import time
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Ensure scan_utils is importable from the same directory
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    base_argparser,
    is_mock_mode,
    output_findings,
    output_error,
    normalize_url,
    get_base_domain,
    create_session,
    safe_request,
    rate_limited_request,
    make_finding,
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "CORS"

# Evil origins used for reflection testing
EVIL_ORIGINS = [
    "https://evil.com",
    "https://attacker.com",
]

# Dangerous HTTP methods that should not be broadly allowed
DANGEROUS_METHODS = {"PUT", "DELETE", "PATCH", "TRACE", "CONNECT"}

# Sensitive headers that should not be broadly exposed
SENSITIVE_EXPOSED_HEADERS = {
    "authorization", "set-cookie", "x-csrf-token", "x-xsrf-token",
    "cookie", "proxy-authorization", "www-authenticate",
}

# Maximum pages to test CORS on
MAX_CORS_PAGES = 5


# ---------------------------------------------------------------------------
# CORS Header Extraction
# ---------------------------------------------------------------------------
def _get_cors_headers(headers: Dict[str, str]) -> Dict[str, Optional[str]]:
    """Extract CORS-related headers (case-insensitive) from a response."""
    result: Dict[str, Optional[str]] = {
        "acao": None,   # Access-Control-Allow-Origin
        "acac": None,   # Access-Control-Allow-Credentials
        "acam": None,   # Access-Control-Allow-Methods
        "acah": None,   # Access-Control-Allow-Headers
        "aceh": None,   # Access-Control-Expose-Headers
        "acma": None,   # Access-Control-Max-Age
    }
    header_map = {
        "access-control-allow-origin": "acao",
        "access-control-allow-credentials": "acac",
        "access-control-allow-methods": "acam",
        "access-control-allow-headers": "acah",
        "access-control-expose-headers": "aceh",
        "access-control-max-age": "acma",
    }
    for name, value in headers.items():
        key = header_map.get(name.lower())
        if key:
            result[key] = value
    return result


def _send_cors_request(
    session,
    method: str,
    url: str,
    origin: Optional[str],
    timeout: int,
    delay: float,
) -> Tuple[Optional[Dict[str, Optional[str]]], Optional[int]]:
    """
    Send a request with an Origin header and return parsed CORS headers
    and the HTTP status code.  Returns (None, None) on failure.
    """
    extra_headers = {}
    if origin is not None:
        extra_headers["Origin"] = origin

    resp, err = rate_limited_request(
        session, method, url,
        delay=delay, timeout=timeout,
        headers=extra_headers,
    )
    if err or resp is None:
        return None, None

    cors = _get_cors_headers(dict(resp.headers))
    return cors, resp.status_code


# ---------------------------------------------------------------------------
# 1 & 2. Origin Reflection + Evil Origin Tests
# ---------------------------------------------------------------------------
def check_origin_reflection(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test whether the server reflects arbitrary origins and whether
    credentials are allowed alongside a reflected/wildcard origin.
    """
    findings: List[Dict] = []
    tested_origins: List[str] = []

    for evil_origin in EVIL_ORIGINS:
        cors, status = _send_cors_request(
            session, "GET", url, evil_origin, timeout, delay,
        )
        if cors is None:
            continue

        acao = cors["acao"]
        acac = cors["acac"]
        credentials_allowed = acac and acac.lower() == "true"

        if acao is None:
            # No CORS header returned for this origin — not vulnerable
            continue

        # Origin reflected back verbatim
        if acao == evil_origin:
            if credentials_allowed:
                findings.append(make_finding(
                    vulnerability="CORS Origin Reflection with Credentials",
                    severity="CRITICAL",
                    location=url,
                    evidence=(
                        f"Server reflects the Origin header '{evil_origin}' in "
                        f"Access-Control-Allow-Origin AND sets "
                        f"Access-Control-Allow-Credentials: true. An attacker "
                        f"page can read authenticated responses cross-origin."
                    ),
                    category=CATEGORY,
                    confidence="HIGH",
                    raw_details={
                        "tested_origin": evil_origin,
                        "acao": acao,
                        "acac": acac,
                        "status_code": status,
                    },
                ))
            else:
                findings.append(make_finding(
                    vulnerability="CORS Origin Reflection (No Credentials)",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Server reflects the Origin header '{evil_origin}' in "
                        f"Access-Control-Allow-Origin. While credentials are not "
                        f"explicitly allowed, unauthenticated data can still be "
                        f"exfiltrated cross-origin."
                    ),
                    category=CATEGORY,
                    confidence="HIGH",
                    raw_details={
                        "tested_origin": evil_origin,
                        "acao": acao,
                        "acac": acac,
                        "status_code": status,
                    },
                ))
            tested_origins.append(evil_origin)

        # Wildcard origin with credentials (spec violation but some servers do it)
        elif acao == "*" and credentials_allowed:
            findings.append(make_finding(
                vulnerability="CORS Wildcard Origin with Credentials",
                severity="CRITICAL",
                location=url,
                evidence=(
                    "Server returns Access-Control-Allow-Origin: * alongside "
                    "Access-Control-Allow-Credentials: true. Although browsers "
                    "block this combination, it signals a severely misconfigured "
                    "CORS policy that may be exploitable via other vectors."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "tested_origin": evil_origin,
                    "acao": acao,
                    "acac": acac,
                    "status_code": status,
                },
            ))
            tested_origins.append(evil_origin)

        # Plain wildcard (no credentials)
        elif acao == "*":
            findings.append(make_finding(
                vulnerability="CORS Wildcard Origin",
                severity="MEDIUM",
                location=url,
                evidence=(
                    "Server returns Access-Control-Allow-Origin: *. Any website "
                    "can make cross-origin requests and read the response. "
                    "Verify that no sensitive data is served from this endpoint."
                ),
                category=CATEGORY,
                confidence="MEDIUM",
                raw_details={
                    "tested_origin": evil_origin,
                    "acao": acao,
                    "acac": acac,
                    "status_code": status,
                },
            ))
            tested_origins.append(evil_origin)
            break  # Wildcard applies to all origins, no need to test more

    return findings


# ---------------------------------------------------------------------------
# 2. Null Origin Test
# ---------------------------------------------------------------------------
def check_null_origin(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test whether the server accepts the 'null' origin.
    Sandboxed iframes and data: URIs send Origin: null.
    """
    findings: List[Dict] = []

    cors, status = _send_cors_request(
        session, "GET", url, "null", timeout, delay,
    )
    if cors is None:
        return findings

    acao = cors["acao"]
    acac = cors["acac"]
    credentials_allowed = acac and acac.lower() == "true"

    if acao and acao.lower() == "null":
        severity = "CRITICAL" if credentials_allowed else "HIGH"
        cred_note = (
            " with Access-Control-Allow-Credentials: true" if credentials_allowed
            else ""
        )
        findings.append(make_finding(
            vulnerability="CORS Null Origin Accepted",
            severity=severity,
            location=url,
            evidence=(
                f"Server accepts Origin: null{cred_note}. Attackers can exploit "
                f"this via sandboxed iframes (sandbox attribute) or data: URIs "
                f"to perform cross-origin reads."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "tested_origin": "null",
                "acao": acao,
                "acac": acac,
                "status_code": status,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 3. Subdomain Wildcard Bypass
# ---------------------------------------------------------------------------
def check_subdomain_bypass(
    session,
    url: str,
    target_domain: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test whether the server trusts arbitrary subdomains of the target,
    e.g. evil.target.com.  If any subdomain is compromised or user-
    controllable, CORS protections are bypassed.
    """
    findings: List[Dict] = []

    evil_subdomain = f"https://evil.{target_domain}"
    cors, status = _send_cors_request(
        session, "GET", url, evil_subdomain, timeout, delay,
    )
    if cors is None:
        return findings

    acao = cors["acao"]
    acac = cors["acac"]
    credentials_allowed = acac and acac.lower() == "true"

    if acao and acao == evil_subdomain:
        severity = "CRITICAL" if credentials_allowed else "HIGH"
        cred_note = " with credentials" if credentials_allowed else ""
        findings.append(make_finding(
            vulnerability="CORS Subdomain Wildcard Bypass",
            severity=severity,
            location=url,
            evidence=(
                f"Server trusts arbitrary subdomains: Origin '{evil_subdomain}' "
                f"is reflected in Access-Control-Allow-Origin{cred_note}. "
                f"If any subdomain is compromised (XSS, takeover), attackers "
                f"can read cross-origin responses."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "tested_origin": evil_subdomain,
                "acao": acao,
                "acac": acac,
                "status_code": status,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 4. Prefix / Suffix Bypass
# ---------------------------------------------------------------------------
def check_prefix_suffix_bypass(
    session,
    url: str,
    target_domain: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test whether the server performs incomplete origin validation:
      - Suffix bypass:  https://target.com.evil.com  (attacker-controlled)
      - Prefix bypass:  https://eviltarget.com       (attacker-controlled)
    """
    findings: List[Dict] = []

    bypass_origins = [
        (f"https://{target_domain}.evil.com", "suffix"),
        (f"https://evil{target_domain}", "prefix"),
    ]

    for evil_origin, technique in bypass_origins:
        cors, status = _send_cors_request(
            session, "GET", url, evil_origin, timeout, delay,
        )
        if cors is None:
            continue

        acao = cors["acao"]
        acac = cors["acac"]
        credentials_allowed = acac and acac.lower() == "true"

        if acao and acao == evil_origin:
            severity = "CRITICAL" if credentials_allowed else "HIGH"
            cred_note = " with credentials" if credentials_allowed else ""
            findings.append(make_finding(
                vulnerability=f"CORS Origin {technique.title()} Bypass",
                severity=severity,
                location=url,
                evidence=(
                    f"Server accepts the attacker-controlled origin "
                    f"'{evil_origin}' ({technique} of target domain){cred_note}. "
                    f"The origin validation regex is too permissive."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "tested_origin": evil_origin,
                    "technique": technique,
                    "acao": acao,
                    "acac": acac,
                    "status_code": status,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# 6. Dangerous Allowed Methods
# ---------------------------------------------------------------------------
def check_dangerous_methods(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Check Access-Control-Allow-Methods for dangerous HTTP methods
    (PUT, DELETE, PATCH, TRACE, CONNECT).
    """
    findings: List[Dict] = []

    cors, status = _send_cors_request(
        session, "GET", url, "https://evil.com", timeout, delay,
    )
    if cors is None:
        return findings

    acam = cors["acam"]
    if not acam:
        return findings

    methods = {m.strip().upper() for m in acam.split(",")}
    dangerous_found = methods & DANGEROUS_METHODS

    if dangerous_found:
        findings.append(make_finding(
            vulnerability="CORS Allows Dangerous HTTP Methods",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"Access-Control-Allow-Methods includes dangerous methods: "
                f"{', '.join(sorted(dangerous_found))}. Combined with a "
                f"permissive origin policy, attackers could modify or delete "
                f"resources cross-origin."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "allowed_methods": sorted(methods),
                "dangerous_methods": sorted(dangerous_found),
                "full_header": acam,
                "status_code": status,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 7. Sensitive Exposed Headers
# ---------------------------------------------------------------------------
def check_exposed_headers(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Check Access-Control-Expose-Headers for sensitive headers that should
    not be readable cross-origin (Authorization, Set-Cookie, etc.).
    """
    findings: List[Dict] = []

    cors, status = _send_cors_request(
        session, "GET", url, "https://evil.com", timeout, delay,
    )
    if cors is None:
        return findings

    aceh = cors["aceh"]
    if not aceh:
        return findings

    exposed = {h.strip().lower() for h in aceh.split(",")}
    sensitive_found = exposed & SENSITIVE_EXPOSED_HEADERS

    if sensitive_found:
        findings.append(make_finding(
            vulnerability="CORS Exposes Sensitive Headers",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"Access-Control-Expose-Headers includes sensitive headers: "
                f"{', '.join(sorted(sensitive_found))}. Cross-origin scripts "
                f"can read these header values from responses."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "exposed_headers": sorted(exposed),
                "sensitive_headers": sorted(sensitive_found),
                "full_header": aceh,
                "status_code": status,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 8. Preflight (OPTIONS) Response Analysis
# ---------------------------------------------------------------------------
def check_preflight(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Send an OPTIONS preflight request and analyse the CORS headers
    returned.  A permissive preflight can widen the attack surface.
    """
    findings: List[Dict] = []

    extra_headers = {
        "Origin": "https://evil.com",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "Authorization, X-Custom-Header",
    }

    resp, err = rate_limited_request(
        session, "OPTIONS", url,
        delay=delay, timeout=timeout,
        headers=extra_headers,
    )
    if err or resp is None:
        return findings

    cors = _get_cors_headers(dict(resp.headers))
    acao = cors["acao"]
    acac = cors["acac"]
    acam = cors["acam"]
    acah = cors["acah"]
    credentials_allowed = acac and acac.lower() == "true"

    issues: List[str] = []

    # Reflected or wildcard origin in preflight
    if acao == "https://evil.com":
        issues.append("reflects attacker origin in preflight")
    elif acao == "*":
        issues.append("wildcard origin in preflight")

    # Credentials in preflight
    if credentials_allowed:
        issues.append("allows credentials in preflight")

    # Overly permissive allowed methods
    if acam:
        methods = {m.strip().upper() for m in acam.split(",")}
        dangerous = methods & DANGEROUS_METHODS
        if dangerous:
            issues.append(f"allows dangerous methods: {', '.join(sorted(dangerous))}")

    # Wildcard allowed headers
    if acah and acah.strip() == "*":
        issues.append("allows any request header (wildcard)")

    if issues:
        severity = "HIGH" if credentials_allowed else "MEDIUM"
        findings.append(make_finding(
            vulnerability="Permissive CORS Preflight Response",
            severity=severity,
            location=url,
            evidence=(
                f"OPTIONS preflight response has permissive CORS policy: "
                f"{'; '.join(issues)}. This may allow cross-origin state-changing "
                f"requests."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "acao": acao,
                "acac": acac,
                "acam": acam,
                "acah": acah,
                "issues": issues,
                "status_code": resp.status_code,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Run All Checks on a Single URL
# ---------------------------------------------------------------------------
def test_url(
    session,
    url: str,
    target_domain: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Run all CORS checks against a single URL."""
    findings: List[Dict] = []

    findings.extend(check_origin_reflection(session, url, delay, timeout))
    findings.extend(check_null_origin(session, url, delay, timeout))
    findings.extend(check_subdomain_bypass(session, url, target_domain, delay, timeout))
    findings.extend(check_prefix_suffix_bypass(session, url, target_domain, delay, timeout))
    findings.extend(check_dangerous_methods(session, url, delay, timeout))
    findings.extend(check_exposed_headers(session, url, delay, timeout))
    findings.extend(check_preflight(session, url, delay, timeout))

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="CORS Origin Reflection with Credentials",
            severity="CRITICAL",
            location=f"{target}/api/user/profile",
            evidence=(
                "Server reflects the Origin header 'https://evil.com' in "
                "Access-Control-Allow-Origin AND sets "
                "Access-Control-Allow-Credentials: true. An attacker page can "
                "read authenticated responses cross-origin."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "tested_origin": "https://evil.com",
                "acao": "https://evil.com",
                "acac": "true",
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="CORS Null Origin Accepted",
            severity="HIGH",
            location=target,
            evidence=(
                "Server accepts Origin: null with "
                "Access-Control-Allow-Credentials: true. Attackers can exploit "
                "this via sandboxed iframes to perform cross-origin reads."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "tested_origin": "null",
                "acao": "null",
                "acac": "true",
                "status_code": 200,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — CORS Misconfiguration Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    session = create_session(
        timeout=args.timeout, cookies=args.cookies, headers=args.headers,
    )
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []

    # Step 0: Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    target_domain = get_base_domain(target)

    # Step 1: Crawl the target to discover pages
    crawled_urls = crawl_same_domain(
        target, session,
        delay=0.05, timeout=timeout,
        max_pages=MAX_CORS_PAGES,
        depth=1,
    )

    # Ensure root URL is included
    if target not in crawled_urls:
        crawled_urls.insert(0, target)

    # Step 2: Test CORS on each discovered page
    seen_keys: Set[Tuple[str, str]] = set()

    for page_url in crawled_urls[:MAX_CORS_PAGES]:
        try:
            page_findings = test_url(
                session, page_url, target_domain, delay, timeout,
            )
        except Exception:
            continue

        # Deduplicate by (vulnerability, location)
        for f in page_findings:
            key = (f["vulnerability"], f["location"])
            if key not in seen_keys:
                seen_keys.add(key)
                findings.append(f)

    output_findings(findings)


if __name__ == "__main__":
    main()
