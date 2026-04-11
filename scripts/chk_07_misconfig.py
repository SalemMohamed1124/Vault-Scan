#!/usr/bin/env python3
"""
VaultScan — Security Misconfiguration Scanner
===============================================
Comprehensive scanner that checks for:
  1. Exposed admin panels and management interfaces (45+ paths)
  2. Default credentials on discovered login forms
  3. Technology/version information disclosure
  4. Debug mode and profiler endpoint exposure
  5. Error page information leakage

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin

from bs4 import BeautifulSoup

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
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "MISCONFIGURATION"

# ---------------------------------------------------------------------------
# Admin Panel Paths (45+)
# ---------------------------------------------------------------------------
ADMIN_PATHS: List[str] = [
    "/admin",
    "/admin/",
    "/administrator",
    "/wp-admin",
    "/wp-login.php",
    "/phpmyadmin",
    "/pma",
    "/mysql",
    "/jenkins",
    "/manager/html",
    "/cpanel",
    "/webmail",
    "/panel",
    "/portal",
    "/login",
    "/admin/login",
    "/console",
    "/manage",
    "/dashboard",
    "/controlpanel",
    "/admin-console",
    "/jmx-console",
    "/web-console",
    "/system",
    "/admin.php",
    "/user/login",
    "/auth/login",
    "/api/admin",
    "/swagger-ui",
    "/api-docs",
    "/redoc",
    "/graphiql",
    "/kibana",
    "/grafana",
    "/prometheus",
    "/solr",
    "/haproxy?stats",
    "/status",
    "/health",
    "/info",
    "/debug/pprof",
    "/actuator",
    "/actuator/env",
    "/actuator/health",
    "/.env",
    "/server-status",
    "/server-info",
]

# Default credential pairs to test on login forms (max 3)
DEFAULT_CREDENTIALS: List[Tuple[str, str]] = [
    ("admin", "admin"),
    ("admin", "password"),
    ("root", "root"),
]

# Debug endpoint paths
DEBUG_PATHS: List[str] = [
    "/debug",
    "/_debugbar",
    "/_profiler",
    "/trace.axd",
    "/elmah.axd",
    "/_debug",
    "/debug/default/view",
    "/debug/vars",
    "/__debug__",
]

# Debug-related response headers
DEBUG_HEADERS = [
    "X-Debug-Token",
    "X-Debug-Token-Link",
    "X-Debug-Info",
]

# Technology detection paths
TECH_DETECTION_PATHS: List[Tuple[str, str]] = [
    ("/wp-includes/version.php", "WordPress"),
    ("/joomla.xml", "Joomla"),
    ("/web.config", "ASP.NET"),
    ("/RELEASE_NOTES.txt", "Generic CMS"),
    ("/CHANGELOG.txt", "Generic CMS"),
    ("/readme.html", "WordPress"),
    ("/wp-includes/js/jquery/jquery.js", "WordPress"),
    ("/modules/system/system.info", "Drupal"),
    ("/sites/default/settings.php", "Drupal"),
]

# Patterns indicating info leakage in error pages
ERROR_LEAK_PATTERNS: List[Tuple[str, str]] = [
    (r"<b>Warning</b>:\s+\w+\(\)", "PHP warning with function call"),
    (r"<b>Fatal error</b>:", "PHP fatal error"),
    (r"Traceback \(most recent call last\)", "Python stack trace"),
    (r"at\s+[\w.]+\([\w]+\.java:\d+\)", "Java stack trace"),
    (r"Microsoft\.AspNetCore", "ASP.NET Core framework disclosure"),
    (r"System\.Web\.HttpException", "ASP.NET exception disclosure"),
    (r"DOCUMENT_ROOT\s*=", "Server document root disclosure"),
    (r"/home/[\w]+/", "Unix file path disclosure"),
    (r"[A-Z]:\\[\w\\]+", "Windows file path disclosure"),
    (r"Django\s+Version:\s+[\d.]+", "Django version disclosure"),
    (r"Laravel\s+v[\d.]+", "Laravel version disclosure"),
    (r"Rails\s+version:\s+[\d.]+", "Rails version disclosure"),
    (r"<b>Server Version</b>:", "Server version disclosure"),
    (r"Apache/[\d.]+", "Apache version in error page"),
    (r"nginx/[\d.]+", "Nginx version in error page"),
    (r"IIS/[\d.]+", "IIS version in error page"),
    (r"X-Powered-By", "Technology header in page body"),
]

# Django debug page detection
DJANGO_DEBUG_PATTERNS = [
    r"You're seeing this error because you have <code>DEBUG = True</code>",
    r"Request Method:",
    r"Django Version:",
    r"Traceback.*django",
]

# Laravel debug mode detection
LARAVEL_DEBUG_PATTERNS = [
    r"Whoops, looks like something went wrong",
    r"vendor/laravel",
    r"Illuminate\\",
    r"Laravel.*Exception",
]

# Rails verbose error detection
RAILS_DEBUG_PATTERNS = [
    r"Action Controller: Exception caught",
    r"Rails\.root:",
    r"ActionView::Template::Error",
    r"ActiveRecord::.*Error",
]


# ---------------------------------------------------------------------------
# 1. Admin Panel Discovery
# ---------------------------------------------------------------------------
def check_admin_panels(
    session,
    target: str,
    delay: float,
    timeout: int,
) -> Tuple[List[Dict], List[str]]:
    """
    Probe 45+ common admin/management paths.
    Returns (findings, urls_with_login_forms) for default credential testing.
    """
    findings: List[Dict] = []
    login_form_urls: List[str] = []

    for path in ADMIN_PATHS:
        url = target + path
        resp, err = rate_limited_request(
            session, "HEAD", url, delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        status = resp.status_code

        if status not in (200, 401, 403):
            continue

        # For 200 responses, do a GET to inspect content
        page_html = ""
        if status == 200:
            get_resp, get_err = rate_limited_request(
                session, "GET", url, delay=delay, timeout=timeout,
            )
            if get_resp and not get_err:
                page_html = get_resp.text
                # Check if it's actually a soft 404 or generic page
                if _is_soft_404(page_html, path):
                    continue

        if status == 200:
            severity = "MEDIUM"
            status_desc = "accessible (200 OK)"
        else:
            severity = "LOW"
            status_desc = f"exists but protected ({status})"

        findings.append(make_finding(
            vulnerability="Exposed Admin/Management Interface",
            severity=severity,
            location=url,
            evidence=(
                f"Admin panel path '{path}' is {status_desc}. "
                f"This interface should not be publicly discoverable."
            ),
            category=CATEGORY,
            raw_details={
                "path": path,
                "status_code": status,
                "accessible": status == 200,
            },
        ))

        # Track URLs with login forms for default credential testing
        if status == 200 and page_html and _has_login_form(page_html):
            login_form_urls.append(url)

    return findings, login_form_urls


def _is_soft_404(html: str, path: str) -> bool:
    """
    Heuristic to detect soft 404 pages that return 200 but show
    generic 'not found' content.
    """
    lower = html.lower()
    # Very short responses are likely error/redirect pages
    if len(html) < 100:
        return True
    not_found_signals = [
        "page not found",
        "404 not found",
        "not found",
        "does not exist",
        "no longer available",
    ]
    # If multiple not-found signals appear, likely a soft 404
    matches = sum(1 for signal in not_found_signals if signal in lower)
    return matches >= 2


def _has_login_form(html: str) -> bool:
    """Detect whether a page contains a login form (form with password input)."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        for form in soup.find_all("form"):
            for inp in form.find_all("input"):
                if inp.get("type", "").lower() == "password":
                    return True
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# 2. Default Credential Testing
# ---------------------------------------------------------------------------
def check_default_credentials(
    session,
    login_urls: List[str],
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    For each URL known to have a login form, attempt a maximum of 3
    default credential pairs.
    """
    findings: List[Dict] = []

    for url in login_urls:
        # Fetch the login page to extract form details
        resp, err = rate_limited_request(
            session, "GET", url, delay=delay, timeout=timeout,
        )
        if err or resp is None:
            continue

        form_data = _extract_login_form(resp.text, url)
        if form_data is None:
            continue

        action, username_field, password_field, extra_fields = form_data
        baseline_length = len(resp.text)
        baseline_url = resp.url  # Where the login page lives after redirects

        for username, password in DEFAULT_CREDENTIALS:
            post_data = dict(extra_fields)
            post_data[username_field] = username
            post_data[password_field] = password

            login_resp, login_err = rate_limited_request(
                session, "POST", action,
                delay=delay, timeout=timeout,
                data=post_data,
                allow_redirects=True,
            )
            if login_err or login_resp is None:
                continue

            if _login_succeeded(login_resp, baseline_length, baseline_url):
                findings.append(make_finding(
                    vulnerability="Default Credentials Accepted",
                    severity="CRITICAL",
                    location=url,
                    evidence=(
                        f"Login form at '{url}' accepted default credentials "
                        f"({username}:{password}). The application may be "
                        f"using factory-default authentication."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "login_url": url,
                        "form_action": action,
                        "username_field": username_field,
                        "password_field": password_field,
                        "credentials_tested": f"{username}:***",
                        "response_status": login_resp.status_code,
                    },
                ))
                break  # No need to test more creds on this form

    return findings


def _extract_login_form(
    html: str,
    page_url: str,
) -> Optional[Tuple[str, str, str, Dict[str, str]]]:
    """
    Parse a login page and return (action_url, username_field, password_field, extra_fields).
    Returns None if no suitable login form is found.
    """
    try:
        soup = BeautifulSoup(html, "html.parser")
        for form in soup.find_all("form"):
            password_field = None
            username_field = None
            extra_fields: Dict[str, str] = {}

            inputs = form.find_all("input")
            for inp in inputs:
                inp_type = inp.get("type", "text").lower()
                inp_name = inp.get("name")
                if not inp_name:
                    continue

                if inp_type == "password":
                    password_field = inp_name
                elif inp_type in ("text", "email") and username_field is None:
                    username_field = inp_name
                elif inp_type == "hidden":
                    extra_fields[inp_name] = inp.get("value", "")
                elif inp_type == "submit":
                    extra_fields[inp_name] = inp.get("value", "")

            if password_field and username_field:
                action = form.get("action", "")
                if action:
                    action = urljoin(page_url, action)
                else:
                    action = page_url
                return action, username_field, password_field, extra_fields

    except Exception:
        pass
    return None


def _login_succeeded(
    resp,
    baseline_length: int,
    baseline_url: str,
) -> bool:
    """
    Heuristic to determine whether a login attempt succeeded.
    Checks for: redirect to a different page, significant content change,
    absence of common login failure indicators.
    """
    body_lower = resp.text.lower()

    # Failure indicators — if present, login likely failed
    failure_indicators = [
        "invalid", "incorrect", "wrong", "failed", "error",
        "try again", "bad credentials", "authentication failed",
        "login failed", "access denied",
    ]
    for indicator in failure_indicators:
        if indicator in body_lower:
            return False

    # If redirected away from the login page to a different path
    if resp.url != baseline_url:
        resp_path = urlparse(resp.url).path.lower()
        baseline_path = urlparse(baseline_url).path.lower()
        if resp_path != baseline_path:
            # Redirected to a dashboard-like page
            success_paths = ["dashboard", "admin", "home", "index", "panel", "welcome"]
            if any(sp in resp_path for sp in success_paths):
                return True

    # Significant content length change may indicate success
    if baseline_length > 0:
        diff_ratio = abs(len(resp.text) - baseline_length) / max(baseline_length, 1)
        if diff_ratio > 0.4:
            # Large content change AND no failure indicators
            return True

    return False


# ---------------------------------------------------------------------------
# 3. Technology Detection
# ---------------------------------------------------------------------------
def check_technology_disclosure(
    session,
    target: str,
    initial_headers: Dict[str, str],
    initial_html: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Detect technology and version information from headers, meta tags,
    and known technology-specific paths.
    """
    findings: List[Dict] = []

    # 3a: X-Powered-By header
    powered_by = initial_headers.get("X-Powered-By", "")
    if not powered_by:
        # Case-insensitive search
        for h, v in initial_headers.items():
            if h.lower() == "x-powered-by":
                powered_by = v
                break

    if powered_by:
        findings.append(make_finding(
            vulnerability="Technology Version Disclosed via X-Powered-By",
            severity="LOW",
            location=target,
            evidence=(
                f"X-Powered-By header reveals: {powered_by}. "
                f"This information helps attackers identify the technology stack."
            ),
            category=CATEGORY,
            raw_details={
                "header": "X-Powered-By",
                "value": powered_by,
            },
        ))

    # Server header
    server_header = initial_headers.get("Server", "")
    if not server_header:
        for h, v in initial_headers.items():
            if h.lower() == "server":
                server_header = v
                break

    if server_header and re.search(r"[\d.]+", server_header):
        findings.append(make_finding(
            vulnerability="Server Version Disclosed via Server Header",
            severity="LOW",
            location=target,
            evidence=(
                f"Server header reveals: {server_header}. "
                f"Version information aids attackers in finding known exploits."
            ),
            category=CATEGORY,
            raw_details={
                "header": "Server",
                "value": server_header,
            },
        ))

    # 3b: Meta generator tag
    try:
        soup = BeautifulSoup(initial_html, "html.parser")
        generator_meta = soup.find("meta", attrs={"name": re.compile(r"generator", re.I)})
        if generator_meta:
            content = generator_meta.get("content", "")
            if content:
                findings.append(make_finding(
                    vulnerability="CMS/Framework Detected via Meta Generator Tag",
                    severity="LOW",
                    location=target,
                    evidence=(
                        f"Meta generator tag reveals: {content}. "
                        f"CMS identification helps attackers target known vulnerabilities."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "meta_tag": "generator",
                        "content": content,
                    },
                ))
    except Exception:
        pass

    # 3c: Technology-specific paths
    for path, tech_name in TECH_DETECTION_PATHS:
        url = target + path
        resp, err = rate_limited_request(
            session, "HEAD", url, delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        if resp.status_code == 200:
            findings.append(make_finding(
                vulnerability=f"{tech_name} Detected via Known Path",
                severity="LOW",
                location=url,
                evidence=(
                    f"Technology-specific path '{path}' returned 200 OK, "
                    f"confirming {tech_name} is in use."
                ),
                category=CATEGORY,
                raw_details={
                    "path": path,
                    "technology": tech_name,
                    "status_code": 200,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# 4. Debug Mode Detection
# ---------------------------------------------------------------------------
def check_debug_mode(
    session,
    target: str,
    initial_headers: Dict[str, str],
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Check for debug mode indicators via headers and debug endpoint paths.
    """
    findings: List[Dict] = []

    # 4a: Debug headers on the main page
    for header_name in DEBUG_HEADERS:
        value = None
        for h, v in initial_headers.items():
            if h.lower() == header_name.lower():
                value = v
                break

        if value:
            findings.append(make_finding(
                vulnerability="Debug Header Exposed",
                severity="HIGH",
                location=target,
                evidence=(
                    f"Response contains debug header '{header_name}: {value}'. "
                    f"Debug information should not be exposed in production."
                ),
                category=CATEGORY,
                raw_details={
                    "header": header_name,
                    "value": value,
                },
            ))

    # 4b: Debug endpoint paths
    for path in DEBUG_PATHS:
        url = target + path
        resp, err = rate_limited_request(
            session, "GET", url, delay=delay, timeout=timeout,
            allow_redirects=True,
        )
        if err or resp is None:
            continue

        if resp.status_code == 200 and len(resp.text) > 200:
            # Verify it's not a soft 404
            if not _is_soft_404(resp.text, path):
                findings.append(make_finding(
                    vulnerability="Debug Endpoint Accessible",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Debug endpoint '{path}' is accessible and returned "
                        f"content ({len(resp.text)} bytes). Debug interfaces "
                        f"can leak sensitive internal information."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "path": path,
                        "status_code": resp.status_code,
                        "content_length": len(resp.text),
                    },
                ))

    # 4c: Framework-specific debug page detection on error trigger
    error_url = target + "/__vaultscan_debug_trigger_nonexistent"
    resp, err = rate_limited_request(
        session, "GET", error_url, delay=delay, timeout=timeout,
    )
    if resp and not err:
        body = resp.text

        # Django debug page
        if any(re.search(pat, body, re.IGNORECASE | re.DOTALL) for pat in DJANGO_DEBUG_PATTERNS):
            findings.append(make_finding(
                vulnerability="Django Debug Mode Enabled",
                severity="HIGH",
                location=target,
                evidence=(
                    "Django debug page detected on a 404 error. DEBUG=True "
                    "exposes source code, settings, and stack traces."
                ),
                category=CATEGORY,
                raw_details={
                    "framework": "Django",
                    "trigger_url": error_url,
                    "status_code": resp.status_code,
                },
            ))

        # Laravel debug mode
        if any(re.search(pat, body, re.IGNORECASE | re.DOTALL) for pat in LARAVEL_DEBUG_PATTERNS):
            findings.append(make_finding(
                vulnerability="Laravel Debug Mode Enabled",
                severity="HIGH",
                location=target,
                evidence=(
                    "Laravel debug/error page detected. APP_DEBUG=true "
                    "exposes environment variables, database credentials, "
                    "and full stack traces."
                ),
                category=CATEGORY,
                raw_details={
                    "framework": "Laravel",
                    "trigger_url": error_url,
                    "status_code": resp.status_code,
                },
            ))

        # Rails verbose errors
        if any(re.search(pat, body, re.IGNORECASE | re.DOTALL) for pat in RAILS_DEBUG_PATTERNS):
            findings.append(make_finding(
                vulnerability="Rails Verbose Error Pages Enabled",
                severity="HIGH",
                location=target,
                evidence=(
                    "Rails detailed error page detected. "
                    "config.consider_all_requests_local or development mode "
                    "appears to be active in production."
                ),
                category=CATEGORY,
                raw_details={
                    "framework": "Rails",
                    "trigger_url": error_url,
                    "status_code": resp.status_code,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# 5. Error Page Information Leakage
# ---------------------------------------------------------------------------
def check_error_page_leakage(
    session,
    target: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Request a deliberately nonexistent path and check whether the 404 page
    reveals server technology, stack traces, file paths, or framework versions.
    """
    findings: List[Dict] = []

    error_url = target + "/__404_test_nonexistent"
    resp, err = rate_limited_request(
        session, "GET", error_url, delay=delay, timeout=timeout,
    )
    if err or resp is None:
        return findings

    body = resp.text
    leaked_info: List[str] = []

    for pattern, description in ERROR_LEAK_PATTERNS:
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            leaked_info.append(f"{description}: {match.group(0)[:80]}")

    if leaked_info:
        findings.append(make_finding(
            vulnerability="Error Page Information Leakage",
            severity="MEDIUM",
            location=error_url,
            evidence=(
                f"The 404 error page reveals internal information: "
                f"{'; '.join(leaked_info[:5])}"
            ),
            category=CATEGORY,
            raw_details={
                "trigger_url": error_url,
                "status_code": resp.status_code,
                "leaked_patterns": leaked_info[:10],
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="Exposed Admin/Management Interface",
            severity="MEDIUM",
            location=f"{target}/phpmyadmin",
            evidence=(
                "Admin panel path '/phpmyadmin' is accessible (200 OK). "
                "This interface should not be publicly discoverable."
            ),
            category=CATEGORY,
            raw_details={
                "path": "/phpmyadmin",
                "status_code": 200,
                "accessible": True,
            },
        ),
        make_finding(
            vulnerability="Technology Version Disclosed via X-Powered-By",
            severity="LOW",
            location=target,
            evidence=(
                "X-Powered-By header reveals: PHP/8.1.12. "
                "This information helps attackers identify the technology stack."
            ),
            category=CATEGORY,
            raw_details={
                "header": "X-Powered-By",
                "value": "PHP/8.1.12",
            },
        ),
        make_finding(
            vulnerability="Debug Endpoint Accessible",
            severity="HIGH",
            location=f"{target}/_debugbar",
            evidence=(
                "Debug endpoint '/_debugbar' is accessible and returned "
                "content (14832 bytes). Debug interfaces can leak sensitive "
                "internal information."
            ),
            category=CATEGORY,
            raw_details={
                "path": "/_debugbar",
                "status_code": 200,
                "content_length": 14832,
            },
        ),
        make_finding(
            vulnerability="Error Page Information Leakage",
            severity="MEDIUM",
            location=f"{target}/__404_test_nonexistent",
            evidence=(
                "The 404 error page reveals internal information: "
                "Apache version in error page: Apache/2.4.54; "
                "Unix file path disclosure: /home/webapp/"
            ),
            category=CATEGORY,
            raw_details={
                "trigger_url": f"{target}/__404_test_nonexistent",
                "status_code": 404,
                "leaked_patterns": [
                    "Apache version in error page: Apache/2.4.54",
                    "Unix file path disclosure: /home/webapp/",
                ],
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Security Misconfiguration Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []

    # Step 0: Validate target is reachable and capture baseline
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    initial_html = resp.text
    initial_headers = dict(resp.headers)

    # Step 1: Admin panel discovery
    admin_findings, login_urls = check_admin_panels(session, target, delay, timeout)
    findings.extend(admin_findings)

    # Step 2: Default credential testing on discovered login forms
    if login_urls:
        findings.extend(check_default_credentials(session, login_urls, delay, timeout))

    # Step 3: Technology detection
    findings.extend(check_technology_disclosure(
        session, target, initial_headers, initial_html, delay, timeout,
    ))

    # Step 4: Debug mode detection
    findings.extend(check_debug_mode(session, target, initial_headers, delay, timeout))

    # Step 5: Error page information leakage
    findings.extend(check_error_page_leakage(session, target, delay, timeout))

    # Deduplicate findings by (vulnerability, location)
    seen: set = set()
    unique_findings: List[Dict] = []
    for f in findings:
        key = (f["vulnerability"], f["location"])
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
