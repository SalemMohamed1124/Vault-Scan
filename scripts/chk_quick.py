#!/usr/bin/env python3
"""
VaultScan -- Quick Vulnerability Checker
=========================================
Performs rapid security checks against a target URL:

  - Security headers analysis (10 headers)
  - Server information disclosure
  - CORS misconfiguration
  - Cookie security flags
  - HTTP methods enumeration
  - Sensitive path/file exposure (35+ paths)
  - HTTPS redirect verification

Outputs a JSON array of findings to stdout.
"""

import re
import sys
import os
import time
from typing import Dict, List, Optional
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Ensure sibling imports work regardless of invocation path
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
# Constants -- Security Headers
# ---------------------------------------------------------------------------
# Each tuple: (header_name, severity_if_missing, description, https_only)
SECURITY_HEADERS = [
    ("X-Frame-Options", "MEDIUM",
     "Prevents clickjacking by controlling iframe embedding", False),
    ("X-Content-Type-Options", "MEDIUM",
     "Prevents MIME-type sniffing attacks", False),
    ("Content-Security-Policy", "MEDIUM",
     "Controls resources the browser is allowed to load", False),
    ("Strict-Transport-Security", "MEDIUM",
     "Enforces HTTPS connections (HSTS)", True),
    ("X-XSS-Protection", "LOW",
     "Legacy XSS filter for older browsers", False),
    ("Permissions-Policy", "LOW",
     "Controls browser feature access (camera, mic, geolocation)", False),
    ("Referrer-Policy", "LOW",
     "Controls how much referrer information is sent", False),
    ("Cross-Origin-Embedder-Policy", "LOW",
     "Controls cross-origin resource embedding", False),
    ("Cross-Origin-Opener-Policy", "LOW",
     "Isolates browsing context from cross-origin windows", False),
    ("Cross-Origin-Resource-Policy", "LOW",
     "Controls which origins can read the resource", False),
]

# ---------------------------------------------------------------------------
# Constants -- Sensitive Paths
# ---------------------------------------------------------------------------
# Each tuple: (path, severity, description, content_validator)
#   content_validator is a callable(text) -> bool used to confirm the finding
#   after a 200 response.  None means any 200 is sufficient.
SENSITIVE_PATHS = [
    # Version control
    (".git/HEAD", "HIGH",
     "Git repository metadata exposed",
     lambda t: "ref: refs/" in t or t.strip().startswith("ref:")),
    (".svn/entries", "HIGH",
     "SVN repository metadata exposed",
     lambda t: len(t.strip()) > 0),

    # Environment / config files
    (".env", "HIGH",
     "Environment file exposed -- may contain secrets",
     lambda t: "=" in t and len(t.strip()) > 2),
    (".htaccess", "MEDIUM",
     "Apache .htaccess file exposed",
     lambda t: any(k in t.lower() for k in ("rewrite", "deny", "allow", "auth"))),
    (".htpasswd", "HIGH",
     "Password hash file exposed",
     lambda t: ":" in t),
    ("web.config", "MEDIUM",
     "IIS web.config file exposed",
     lambda t: "<configuration" in t.lower() or "<?xml" in t.lower()),
    ("config.yml", "MEDIUM",
     "YAML configuration file exposed",
     lambda t: ":" in t and len(t.strip()) > 5),
    ("config.json", "MEDIUM",
     "JSON configuration file exposed",
     lambda t: t.strip().startswith("{") or t.strip().startswith("[")),
    ("application.properties", "MEDIUM",
     "Spring application properties exposed",
     lambda t: "=" in t),

    # CMS / framework config backups
    ("wp-config.php.bak", "HIGH",
     "WordPress config backup exposed",
     lambda t: "DB_" in t or "wp_" in t.lower()),
    ("wp-config.php~", "HIGH",
     "WordPress config editor backup exposed",
     lambda t: "DB_" in t or "wp_" in t.lower()),

    # Server info / debug endpoints
    ("phpinfo.php", "HIGH",
     "PHP info page exposed -- reveals server configuration",
     lambda t: "phpinfo()" in t or "PHP Version" in t),
    ("info.php", "HIGH",
     "PHP info page exposed",
     lambda t: "phpinfo()" in t or "PHP Version" in t),
    ("server-status", "MEDIUM",
     "Apache server-status page accessible",
     lambda t: "apache" in t.lower() or "server" in t.lower()),
    ("server-info", "MEDIUM",
     "Apache server-info page accessible",
     lambda t: "apache" in t.lower() or "module" in t.lower()),
    ("elmah.axd", "MEDIUM",
     "ELMAH error log accessible (.NET)",
     lambda t: "error" in t.lower() or "elmah" in t.lower()),
    ("trace.axd", "MEDIUM",
     "ASP.NET trace log accessible",
     lambda t: "trace" in t.lower()),

    # API documentation
    ("api/swagger", "MEDIUM",
     "Swagger API documentation exposed",
     lambda t: "swagger" in t.lower() or "openapi" in t.lower()),
    ("api/docs", "MEDIUM",
     "API documentation endpoint accessible",
     lambda t: len(t.strip()) > 20),
    ("graphql", "MEDIUM",
     "GraphQL endpoint accessible",
     lambda t: "graphql" in t.lower() or "query" in t.lower() or "{" in t),

    # Spring Boot Actuator
    ("actuator/health", "MEDIUM",
     "Spring Boot Actuator health endpoint exposed",
     lambda t: "status" in t.lower() or "UP" in t),
    ("actuator/env", "HIGH",
     "Spring Boot Actuator env endpoint exposed -- may leak secrets",
     lambda t: "property" in t.lower() or "{" in t),

    # Backup / database files
    ("backup.zip", "HIGH",
     "Backup archive exposed",
     None),  # Binary -- any 200 with content is suspicious
    ("backup.tar.gz", "HIGH",
     "Backup archive exposed",
     None),
    ("dump.sql", "HIGH",
     "SQL dump file exposed -- may contain database contents",
     lambda t: any(k in t.upper() for k in ("CREATE", "INSERT", "DROP", "SELECT"))),
    ("database.sql", "HIGH",
     "SQL database file exposed",
     lambda t: any(k in t.upper() for k in ("CREATE", "INSERT", "DROP", "SELECT"))),

    # Metadata / misc
    (".DS_Store", "LOW",
     "macOS .DS_Store file exposed -- reveals directory structure",
     None),
    ("crossdomain.xml", "LOW",
     "Flash crossdomain.xml policy file found",
     lambda t: "<cross-domain-policy" in t.lower()),
    ("robots.txt", "LOW",
     "robots.txt may reveal hidden paths",
     None),  # Special handling in code for content analysis
    ("sitemap.xml", "LOW",
     "Sitemap XML accessible -- reveals site structure",
     lambda t: "<urlset" in t.lower() or "<sitemapindex" in t.lower()),

    # Shell / history
    (".bash_history", "HIGH",
     "Bash history file exposed -- may contain credentials",
     lambda t: len(t.strip()) > 0),

    # Admin / debug panels
    ("admin/config", "MEDIUM",
     "Admin configuration panel accessible",
     lambda t: len(t.strip()) > 20),
    ("debug", "MEDIUM",
     "Debug endpoint accessible",
     lambda t: len(t.strip()) > 20),
    ("_debugbar", "MEDIUM",
     "Laravel Debugbar endpoint exposed",
     lambda t: "debugbar" in t.lower() or "laravel" in t.lower() or "{" in t),
    ("console", "MEDIUM",
     "Console endpoint accessible",
     lambda t: len(t.strip()) > 20),
    ("test", "LOW",
     "Test endpoint accessible",
     lambda t: len(t.strip()) > 20),
]

# Dangerous HTTP methods to flag
DANGEROUS_METHODS = {"PUT", "DELETE", "TRACE"}


# ===========================================================================
# Check Functions
# ===========================================================================

def check_security_headers(
    session, url: str, timeout: int
) -> List[Dict]:
    """
    Fetch the target and inspect response headers for the presence of
    10 important security headers.  Returns one finding per missing header.
    """
    findings: List[Dict] = []

    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return findings

    # Build a case-insensitive lookup of response headers
    header_lookup = {k.lower(): v for k, v in resp.headers.items()}
    is_https = urlparse(url).scheme == "https"

    for header_name, severity, description, https_only in SECURITY_HEADERS:
        # Strict-Transport-Security only applies to HTTPS targets
        if https_only and not is_https:
            continue

        if header_name.lower() not in header_lookup:
            findings.append(make_finding(
                vulnerability=f"Missing {header_name} Header",
                severity=severity,
                location=url,
                evidence=(
                    f"{header_name} header not found in response. "
                    f"{description}."
                ),
                category="HTTP_SECURITY",
                raw_details={
                    "header": header_name,
                    "status": "missing",
                    "description": description,
                },
            ))

    return findings


def check_server_disclosure(
    session, url: str, timeout: int
) -> List[Dict]:
    """
    Inspect the Server header for software name and version disclosure.
    Version numbers are HIGH severity; bare server names are MEDIUM.
    """
    findings: List[Dict] = []

    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return findings

    server_value = resp.headers.get("Server", "")
    if not server_value:
        return findings

    # Check for version numbers (e.g. Apache/2.4.51, nginx/1.21.3)
    version_pattern = re.compile(r"[\d]+\.[\d]+(?:\.[\d]+)?")
    has_version = bool(version_pattern.search(server_value))

    if has_version:
        findings.append(make_finding(
            vulnerability="Server Version Disclosure",
            severity="HIGH",
            location=url,
            evidence=f"Server header exposes version: {server_value}",
            category="INFORMATION_DISCLOSURE",
            raw_details={
                "header": "Server",
                "value": server_value,
                "version_exposed": True,
            },
        ))
    elif server_value.strip():
        # Server name without version -- still informational leakage
        findings.append(make_finding(
            vulnerability="Server Name Disclosure",
            severity="MEDIUM",
            location=url,
            evidence=f"Server header exposes software name: {server_value}",
            category="INFORMATION_DISCLOSURE",
            raw_details={
                "header": "Server",
                "value": server_value,
                "version_exposed": False,
            },
        ))

    return findings


def check_cors(
    session, url: str, timeout: int
) -> List[Dict]:
    """
    Test for CORS misconfiguration by sending a request with a malicious
    Origin header and inspecting the Access-Control-Allow-Origin response.
    """
    findings: List[Dict] = []

    evil_origin = "https://evil.com"
    resp, err = safe_request(
        session, "GET", url, timeout=timeout,
        headers={"Origin": evil_origin},
    )
    if err or resp is None:
        return findings

    acao = resp.headers.get("Access-Control-Allow-Origin", "")
    acac = resp.headers.get("Access-Control-Allow-Credentials", "")

    if acao == evil_origin:
        detail = "Origin is reflected back verbatim"
        if acac.lower() == "true":
            detail += " with credentials allowed -- full account takeover risk"
        findings.append(make_finding(
            vulnerability="CORS Misconfiguration -- Origin Reflection",
            severity="HIGH",
            location=url,
            evidence=(
                f"Access-Control-Allow-Origin reflects attacker origin "
                f"'{evil_origin}'. {detail}."
            ),
            category="CORS",
            raw_details={
                "origin_sent": evil_origin,
                "acao": acao,
                "acac": acac,
            },
        ))
    elif acao == "*":
        findings.append(make_finding(
            vulnerability="CORS Misconfiguration -- Wildcard Origin",
            severity="HIGH",
            location=url,
            evidence=(
                "Access-Control-Allow-Origin is set to '*', allowing "
                "any website to read responses."
            ),
            category="CORS",
            raw_details={
                "origin_sent": evil_origin,
                "acao": acao,
                "acac": acac,
            },
        ))

    return findings


def check_cookies(
    session, url: str, timeout: int
) -> List[Dict]:
    """
    Parse Set-Cookie headers and flag cookies missing Secure, HttpOnly,
    or SameSite attributes.
    """
    findings: List[Dict] = []

    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return findings

    is_https = urlparse(url).scheme == "https"

    # raw_headers preserves multiple Set-Cookie headers
    set_cookie_headers = resp.raw.headers.getlist("Set-Cookie") if resp.raw else []
    # Fallback if raw is unavailable
    if not set_cookie_headers:
        sc = resp.headers.get("Set-Cookie", "")
        if sc:
            set_cookie_headers = [sc]

    for cookie_str in set_cookie_headers:
        if not cookie_str.strip():
            continue

        # Extract cookie name (everything before the first '=')
        cookie_name = cookie_str.split("=", 1)[0].strip()
        attrs_lower = cookie_str.lower()

        # Secure flag (only relevant on HTTPS)
        if is_https and "secure" not in attrs_lower:
            findings.append(make_finding(
                vulnerability=f"Cookie Missing Secure Flag: {cookie_name}",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Cookie '{cookie_name}' is set over HTTPS without the "
                    f"Secure flag, allowing transmission over HTTP."
                ),
                category="COOKIE_SECURITY",
                raw_details={
                    "cookie": cookie_name,
                    "flag": "Secure",
                    "set_cookie": cookie_str[:200],
                },
            ))

        # HttpOnly flag
        if "httponly" not in attrs_lower:
            findings.append(make_finding(
                vulnerability=f"Cookie Missing HttpOnly Flag: {cookie_name}",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Cookie '{cookie_name}' lacks the HttpOnly flag, "
                    f"making it accessible to JavaScript (XSS risk)."
                ),
                category="COOKIE_SECURITY",
                raw_details={
                    "cookie": cookie_name,
                    "flag": "HttpOnly",
                    "set_cookie": cookie_str[:200],
                },
            ))

        # SameSite attribute
        if "samesite" not in attrs_lower:
            findings.append(make_finding(
                vulnerability=f"Cookie Missing SameSite Attribute: {cookie_name}",
                severity="LOW",
                location=url,
                evidence=(
                    f"Cookie '{cookie_name}' lacks the SameSite attribute, "
                    f"which may allow cross-site request forgery."
                ),
                category="COOKIE_SECURITY",
                raw_details={
                    "cookie": cookie_name,
                    "flag": "SameSite",
                    "set_cookie": cookie_str[:200],
                },
            ))

    return findings


def check_http_methods(
    session, url: str, timeout: int
) -> List[Dict]:
    """
    Send an OPTIONS request and inspect the Allow header for dangerous
    HTTP methods (PUT, DELETE, TRACE).
    """
    findings: List[Dict] = []

    resp, err = safe_request(session, "OPTIONS", url, timeout=timeout)
    if err or resp is None:
        return findings

    allow_header = resp.headers.get("Allow", "")
    if not allow_header:
        # Some servers return allowed methods via Access-Control-Allow-Methods
        allow_header = resp.headers.get("Access-Control-Allow-Methods", "")
    if not allow_header:
        return findings

    allowed_methods = {m.strip().upper() for m in allow_header.split(",")}
    dangerous_found = allowed_methods & DANGEROUS_METHODS

    for method in sorted(dangerous_found):
        findings.append(make_finding(
            vulnerability=f"Dangerous HTTP Method Allowed: {method}",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"HTTP {method} method is enabled. "
                f"Allow header: {allow_header}"
            ),
            category="HTTP_SECURITY",
            raw_details={
                "method": method,
                "allow_header": allow_header,
                "all_methods": sorted(allowed_methods),
            },
        ))

    return findings


def check_sensitive_paths(
    session, url: str, timeout: int, delay: float
) -> List[Dict]:
    """
    Probe 35+ sensitive paths using HEAD (fast) then GET (to verify content).
    Each path has an optional content validator to reduce false positives.
    """
    findings: List[Dict] = []

    for path, severity, description, validator in SENSITIVE_PATHS:
        full_url = f"{url}/{path}"

        # -- Step 1: HEAD request (fast existence check) -------------------
        head_resp, head_err = safe_request(
            session, "HEAD", full_url, timeout=timeout,
            allow_redirects=False,
        )

        if head_err or head_resp is None:
            time.sleep(delay)
            continue

        # Only pursue 200 OK responses (skip redirects, 403, 404, etc.)
        if head_resp.status_code != 200:
            time.sleep(delay)
            continue

        # -- Step 2: GET request to verify content -------------------------
        get_resp, get_err = safe_request(
            session, "GET", full_url, timeout=timeout,
            allow_redirects=False,
        )

        if get_err or get_resp is None:
            time.sleep(delay)
            continue

        if get_resp.status_code != 200:
            time.sleep(delay)
            continue

        body = get_resp.text[:10000]  # Limit body inspection size

        # -- Step 3: Content validation ------------------------------------
        # For binary files (backup.zip, etc.) validator is None: any 200 is enough
        # but we verify there is actual content (not a custom 200 error page).
        if validator is not None:
            if not validator(body):
                time.sleep(delay)
                continue
        else:
            # For paths with no validator, ensure non-trivial response size
            content_length = len(get_resp.content)
            if content_length < 10:
                time.sleep(delay)
                continue

        # -- Special handling: robots.txt ----------------------------------
        # Upgrade severity if robots.txt reveals admin/internal paths
        effective_severity = severity
        if path == "robots.txt":
            sensitive_keywords = (
                "admin", "login", "secret", "private", "internal",
                "backup", "config", "dashboard", "api/v", "staging",
            )
            for keyword in sensitive_keywords:
                if keyword in body.lower():
                    effective_severity = "MEDIUM"
                    description = (
                        "robots.txt reveals sensitive paths "
                        f"(contains '{keyword}')"
                    )
                    break

        findings.append(make_finding(
            vulnerability=f"Sensitive Path Exposed: /{path}",
            severity=effective_severity,
            location=full_url,
            evidence=(
                f"/{path} returned HTTP 200. {description}. "
                f"Response size: {len(get_resp.content)} bytes."
            ),
            category="INFORMATION_DISCLOSURE",
            raw_details={
                "path": f"/{path}",
                "status_code": 200,
                "content_length": len(get_resp.content),
                "content_type": get_resp.headers.get("Content-Type", ""),
            },
        ))

        time.sleep(delay)

    return findings


def check_https_redirect(
    session, url: str, timeout: int
) -> List[Dict]:
    """
    If the target uses HTTPS, verify that the plain HTTP equivalent
    issues a redirect to HTTPS.  Missing redirect is MEDIUM severity.
    """
    findings: List[Dict] = []

    parsed = urlparse(url)
    if parsed.scheme != "https":
        return findings

    http_url = url.replace("https://", "http://", 1)

    resp, err = safe_request(
        session, "GET", http_url, timeout=timeout,
        allow_redirects=False,
    )

    if err or resp is None:
        # Cannot reach HTTP version -- could be firewalled (acceptable)
        return findings

    location = resp.headers.get("Location", "")
    redirects_to_https = (
        resp.status_code in (301, 302, 307, 308)
        and location.lower().startswith("https")
    )

    if not redirects_to_https:
        findings.append(make_finding(
            vulnerability="No HTTP to HTTPS Redirect",
            severity="MEDIUM",
            location=http_url,
            evidence=(
                f"HTTP request to {http_url} returned status "
                f"{resp.status_code} without redirecting to HTTPS. "
                f"Location header: '{location or '(empty)'}'"
            ),
            category="HTTP_SECURITY",
            raw_details={
                "http_url": http_url,
                "status_code": resp.status_code,
                "location_header": location,
            },
        ))

    return findings


# ===========================================================================
# Mock Mode
# ===========================================================================

def get_mock_findings(target: str) -> List[Dict]:
    """
    Return a realistic set of mock findings for development and testing.
    Covers headers, CORS, cookies, server disclosure, and a sensitive path.
    """
    return [
        make_finding(
            vulnerability="Missing Content-Security-Policy Header",
            severity="MEDIUM",
            location=target,
            evidence=(
                "Content-Security-Policy header not found in response. "
                "Controls resources the browser is allowed to load."
            ),
            category="HTTP_SECURITY",
            raw_details={"header": "Content-Security-Policy", "status": "missing"},
        ),
        make_finding(
            vulnerability="Missing Strict-Transport-Security Header",
            severity="MEDIUM",
            location=target,
            evidence="HSTS header not present on HTTPS site.",
            category="HTTP_SECURITY",
            raw_details={"header": "Strict-Transport-Security", "status": "missing"},
        ),
        make_finding(
            vulnerability="Missing Permissions-Policy Header",
            severity="LOW",
            location=target,
            evidence=(
                "Permissions-Policy header not found in response. "
                "Controls browser feature access (camera, mic, geolocation)."
            ),
            category="HTTP_SECURITY",
            raw_details={"header": "Permissions-Policy", "status": "missing"},
        ),
        make_finding(
            vulnerability="Server Version Disclosure",
            severity="HIGH",
            location=target,
            evidence="Server header exposes version: Apache/2.4.41 (Ubuntu)",
            category="INFORMATION_DISCLOSURE",
            raw_details={
                "header": "Server",
                "value": "Apache/2.4.41 (Ubuntu)",
                "version_exposed": True,
            },
        ),
        make_finding(
            vulnerability="CORS Misconfiguration -- Origin Reflection",
            severity="HIGH",
            location=target,
            evidence=(
                "Access-Control-Allow-Origin reflects attacker origin "
                "'https://evil.com'. Origin is reflected back verbatim "
                "with credentials allowed -- full account takeover risk."
            ),
            category="CORS",
            raw_details={
                "origin_sent": "https://evil.com",
                "acao": "https://evil.com",
                "acac": "true",
            },
        ),
        make_finding(
            vulnerability="Cookie Missing Secure Flag: session_id",
            severity="MEDIUM",
            location=target,
            evidence=(
                "Cookie 'session_id' is set over HTTPS without the "
                "Secure flag, allowing transmission over HTTP."
            ),
            category="COOKIE_SECURITY",
            raw_details={
                "cookie": "session_id",
                "flag": "Secure",
                "set_cookie": "session_id=abc123; Path=/; HttpOnly",
            },
        ),
        make_finding(
            vulnerability="Cookie Missing SameSite Attribute: session_id",
            severity="LOW",
            location=target,
            evidence=(
                "Cookie 'session_id' lacks the SameSite attribute, "
                "which may allow cross-site request forgery."
            ),
            category="COOKIE_SECURITY",
            raw_details={
                "cookie": "session_id",
                "flag": "SameSite",
                "set_cookie": "session_id=abc123; Path=/; HttpOnly",
            },
        ),
        make_finding(
            vulnerability="Sensitive Path Exposed: /.env",
            severity="HIGH",
            location=f"{target}/.env",
            evidence=(
                "/.env returned HTTP 200. Environment file exposed -- "
                "may contain secrets. Response size: 384 bytes."
            ),
            category="INFORMATION_DISCLOSURE",
            raw_details={
                "path": "/.env",
                "status_code": 200,
                "content_length": 384,
                "content_type": "text/plain",
            },
        ),
    ]


# ===========================================================================
# Main Entry Point
# ===========================================================================

def main() -> None:
    """Run all quick security checks and output findings as JSON."""
    parser = base_argparser("VaultScan Quick Security Checker")
    args = parser.parse_args()

    target = normalize_url(args.target)
    if not target:
        output_error("No target specified.")

    # ---- Mock mode (for development / CI) --------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        # output_findings calls sys.exit(0)

    # ---- Live scanning ---------------------------------------------------
    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)

    # Verify the target is reachable before running all checks
    probe_resp, probe_err = safe_request(
        session, "GET", target, timeout=args.timeout,
    )
    if probe_err:
        output_error(f"Cannot reach target: {probe_err}")

    findings: List[Dict] = []

    # 1. Security headers
    findings.extend(check_security_headers(session, target, args.timeout))

    # 2. Server information disclosure
    findings.extend(check_server_disclosure(session, target, args.timeout))

    # 3. CORS misconfiguration
    findings.extend(check_cors(session, target, args.timeout))

    # 4. Cookie security
    findings.extend(check_cookies(session, target, args.timeout))

    # 5. HTTP methods
    findings.extend(check_http_methods(session, target, args.timeout))

    # 6. Sensitive paths (slowest -- runs last)
    findings.extend(check_sensitive_paths(
        session, target, args.timeout, args.delay,
    ))

    # 7. HTTPS redirect
    findings.extend(check_https_redirect(session, target, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
