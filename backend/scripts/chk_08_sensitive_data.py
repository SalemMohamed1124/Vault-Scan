#!/usr/bin/env python3
"""
VaultScan - Sensitive Data Exposure Scanner
=============================================
Scans web pages for exposed secrets, API keys, stack traces, information
leakage in HTML comments, and JavaScript source maps.  Crawls same-domain
pages (depth=1, max 10) and applies pattern-based detection against every
response body.

Outputs JSON array of findings to stdout.
"""

import re
import sys
import os
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

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
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "INFORMATION_DISCLOSURE"
MAX_CRAWL_PAGES = 5
MAX_EVIDENCE_LENGTH = 200  # Truncate matched evidence to this length

# ---------------------------------------------------------------------------
# Secret / API-Key Patterns — (name, compiled regex, severity)
# ---------------------------------------------------------------------------
SECRET_PATTERNS: List[Tuple[str, "re.Pattern[str]", str]] = [
    (
        "AWS Access Key",
        re.compile(r"AKIA[0-9A-Z]{16}"),
        "CRITICAL",
    ),
    (
        "AWS Secret Key",
        re.compile(
            r"""(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY|SecretAccessKey)"""
            r"""\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?"""
        ),
        "CRITICAL",
    ),
    (
        "Google API Key",
        re.compile(r"AIza[0-9A-Za-z\-_]{35}"),
        "HIGH",
    ),
    (
        "Stripe Secret Key",
        re.compile(r"sk_live_[0-9a-zA-Z]{24,}"),
        "CRITICAL",
    ),
    (
        "Stripe Publishable Key",
        re.compile(r"pk_live_[0-9a-zA-Z]{24,}"),
        "MEDIUM",
    ),
    (
        "GitHub Token (ghp)",
        re.compile(r"ghp_[0-9a-zA-Z]{36}"),
        "CRITICAL",
    ),
    (
        "GitHub Token (gho)",
        re.compile(r"gho_[0-9a-zA-Z]{36}"),
        "CRITICAL",
    ),
    (
        "GitHub Token (ghu)",
        re.compile(r"ghu_[0-9a-zA-Z]{36}"),
        "CRITICAL",
    ),
    (
        "GitHub Token (ghs)",
        re.compile(r"ghs_[0-9a-zA-Z]{36}"),
        "CRITICAL",
    ),
    (
        "GitHub Token (ghr)",
        re.compile(r"ghr_[0-9a-zA-Z]{36}"),
        "CRITICAL",
    ),
    (
        "Slack Token",
        re.compile(r"xox[bpors]-[0-9a-zA-Z\-]{10,}"),
        "HIGH",
    ),
    (
        "Private Key",
        re.compile(
            r"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----"
        ),
        "CRITICAL",
    ),
    (
        "JWT Token",
        re.compile(
            r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"
        ),
        "MEDIUM",
    ),
    (
        "Generic API Key",
        re.compile(
            r"""api[_\-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]""",
            re.IGNORECASE,
        ),
        "MEDIUM",
    ),
    (
        "Generic Secret/Password",
        re.compile(
            r"""(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^\s'"]{8,}['"]""",
            re.IGNORECASE,
        ),
        "HIGH",
    ),
    (
        "Internal IP Address",
        re.compile(
            r"(?:^|[^\d])"
            r"(10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
            r"|192\.168\.\d{1,3}\.\d{1,3})"
            r"(?=[^\d]|$)"
        ),
        "LOW",
    ),
]

# ---------------------------------------------------------------------------
# Stack-Trace / Error Patterns — (name, compiled regex, severity)
# ---------------------------------------------------------------------------
STACK_TRACE_PATTERNS: List[Tuple[str, "re.Pattern[str]", str]] = [
    # Python
    (
        "Python Traceback",
        re.compile(r"Traceback \(most recent call last\)", re.IGNORECASE),
        "MEDIUM",
    ),
    (
        "Python File Reference",
        re.compile(r'File ".*?\.py", line \d+', re.IGNORECASE),
        "MEDIUM",
    ),
    # Java / JVM
    (
        "Java Stack Trace",
        re.compile(
            r"(?:java\.\w+\.[\w.]+Exception|at [\w.$]+\([\w.]+\.java:\d+\))",
            re.IGNORECASE,
        ),
        "MEDIUM",
    ),
    # PHP
    (
        "PHP Error",
        re.compile(
            r"(?:Fatal error|Parse error|Warning):\s+.*?\bin\b\s+.*?\.php(?:\s+on\s+line\s+\d+)?",
            re.IGNORECASE,
        ),
        "MEDIUM",
    ),
    (
        "PHP Stack Trace",
        re.compile(r"#\d+\s+.*?\.php\(\d+\)", re.IGNORECASE),
        "MEDIUM",
    ),
    # .NET
    (
        ".NET Stack Trace",
        re.compile(
            r"(?:System\.\w+Exception|at [\w.]+\s+in\s+.*?:line\s+\d+)",
            re.IGNORECASE,
        ),
        "MEDIUM",
    ),
    (
        "ASP.NET Error",
        re.compile(r"Server Error in '/' Application", re.IGNORECASE),
        "MEDIUM",
    ),
    # Node.js
    (
        "Node.js Error",
        re.compile(
            r"(?:at\s+\w+\s+\((?:\/|\\).*?\.js:\d+:\d+\)|"
            r"ReferenceError:|TypeError:|SyntaxError:.*?\.js)",
            re.IGNORECASE,
        ),
        "MEDIUM",
    ),
    # SQL errors in error pages
    (
        "MySQL Error",
        re.compile(
            r"(?:You have an error in your SQL syntax|"
            r"mysql_fetch_array|"
            r"MySqlException|"
            r"com\.mysql\.jdbc)",
            re.IGNORECASE,
        ),
        "HIGH",
    ),
    (
        "PostgreSQL Error",
        re.compile(
            r"(?:pg_query|pg_exec|PostgreSQL.*?ERROR|"
            r"unterminated quoted string at or near|"
            r"syntax error at or near)",
            re.IGNORECASE,
        ),
        "HIGH",
    ),
    (
        "SQL Server Error",
        re.compile(
            r"(?:Unclosed quotation mark|"
            r"Microsoft OLE DB Provider|"
            r"Microsoft SQL Native Client|"
            r"\[SQL Server\])",
            re.IGNORECASE,
        ),
        "HIGH",
    ),
    (
        "SQLite Error",
        re.compile(
            r"(?:SQLite3?::(?:query|exec)|"
            r"sqlite3\.OperationalError|"
            r"SQLITE_ERROR)",
            re.IGNORECASE,
        ),
        "HIGH",
    ),
    # File path disclosure
    (
        "File Path Disclosure (Unix)",
        re.compile(
            r"(?:/var/www/|/home/[\w-]+/|/usr/(?:local/)?|/etc/[\w-]+|/opt/[\w-]+)",
        ),
        "MEDIUM",
    ),
    (
        "File Path Disclosure (Windows)",
        re.compile(
            r"(?:C:\\inetpub\\|C:\\Users\\|C:\\Windows\\|D:\\wwwroot\\)",
            re.IGNORECASE,
        ),
        "MEDIUM",
    ),
]

# ---------------------------------------------------------------------------
# Error-probing paths
# ---------------------------------------------------------------------------
ERROR_PATHS: List[Dict[str, object]] = [
    {
        "path": "/__nonexistent_path_404_test__",
        "method": "GET",
        "description": "Non-existent path to trigger 404 error page",
        "headers": None,
    },
    {
        "path": "/'+OR+1=1--",
        "method": "GET",
        "description": "SQL-injection-like path to trigger error page",
        "headers": None,
    },
    {
        "path": "/",
        "method": "POST",
        "description": "POST with malformed Content-Type",
        "headers": {"Content-Type": "application/x-invalid-type-%%%"},
    },
]

# ---------------------------------------------------------------------------
# HTML-comment patterns that hint at sensitive info
# ---------------------------------------------------------------------------
COMMENT_PATTERNS: List[Tuple[str, "re.Pattern[str]"]] = [
    (
        "TODO/FIXME with credentials",
        re.compile(
            r"(?:TODO|FIXME|HACK|XXX).*?(?:password|secret|token|key|cred)",
            re.IGNORECASE,
        ),
    ),
    (
        "Hardcoded URL with token/key",
        re.compile(
            r"https?://[^\s]+(?:token|key|secret|api_key|apikey|access_key)=[^\s]+",
            re.IGNORECASE,
        ),
    ),
    (
        "Internal hostname/IP",
        re.compile(
            r"(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
            r"|192\.168\.\d{1,3}\.\d{1,3}"
            r"|localhost:\d+"
            r"|[\w-]+\.internal(?:\.[\w-]+)*"
            r"|[\w-]+\.local(?:\.[\w-]+)*)",
            re.IGNORECASE,
        ),
    ),
    (
        "Password/secret mention",
        re.compile(
            r"(?:password|passwd|pwd|secret|credential|api[_-]?key)\s*[:=]",
            re.IGNORECASE,
        ),
    ),
]

# Regex to extract HTML comments
HTML_COMMENT_RE = re.compile(r"<!--(.*?)-->", re.DOTALL)

# Regex to find JS source references in HTML
JS_SRC_RE = re.compile(r"""(?:src|href)\s*=\s*['"]([^'"]+\.js)['"]""", re.IGNORECASE)

# Regex to detect sourceMappingURL inside JS content
SOURCE_MAP_INLINE_RE = re.compile(r"//[#@]\s*sourceMappingURL\s*=\s*(\S+)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _truncate(text: str, max_len: int = MAX_EVIDENCE_LENGTH) -> str:
    """Truncate evidence string for readable output."""
    text = text.strip()
    if len(text) > max_len:
        return text[:max_len] + "..."
    return text


# ---------------------------------------------------------------------------
# 1. Scan page HTML for secret / API-key patterns
# ---------------------------------------------------------------------------
def scan_page_for_secrets(html: str, url: str) -> List[Dict]:
    """Scan raw HTML body for known secret patterns."""
    findings: List[Dict] = []
    seen: set = set()

    for name, pattern, severity in SECRET_PATTERNS:
        for match in pattern.finditer(html):
            matched_text = match.group(0)
            # De-duplicate by (pattern-name, first-20-chars-of-match)
            dedup_key = (name, matched_text[:20])
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            findings.append(
                make_finding(
                    vulnerability=f"Sensitive Data Exposure: {name}",
                    severity=severity,
                    location=url,
                    evidence=_truncate(matched_text),
                    category=CATEGORY,
                    raw_details={
                        "pattern_name": name,
                        "matched_text": _truncate(matched_text, 100),
                    },
                )
            )
    return findings


# ---------------------------------------------------------------------------
# 2. Scan error pages for stack traces & information leakage
# ---------------------------------------------------------------------------
def scan_error_pages(
    session: "requests.Session",
    url: str,
    timeout: int,
    delay: float,
) -> List[Dict]:
    """Request deliberately invalid paths and inspect responses for leakage."""
    findings: List[Dict] = []
    seen: set = set()

    for probe in ERROR_PATHS:
        probe_url = url.rstrip("/") + probe["path"]
        kwargs: Dict = {}
        if probe["headers"]:
            kwargs["headers"] = probe["headers"]
        if probe["method"] == "POST":
            kwargs["data"] = "test=1"

        resp, err = rate_limited_request(
            session, probe["method"], probe_url,
            delay=delay, timeout=timeout, **kwargs,
        )
        if err or resp is None:
            continue

        body = resp.text or ""

        for name, pattern, severity in STACK_TRACE_PATTERNS:
            if pattern.search(body):
                dedup_key = (name, probe["path"])
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                # Grab a snippet around the match
                m = pattern.search(body)
                start = max(0, m.start() - 40)
                end = min(len(body), m.end() + 80)
                snippet = body[start:end].replace("\n", " ").strip()

                findings.append(
                    make_finding(
                        vulnerability=f"Error Page Information Leak: {name}",
                        severity=severity,
                        location=probe_url,
                        evidence=_truncate(snippet),
                        category=CATEGORY,
                        raw_details={
                            "probe_description": probe["description"],
                            "status_code": resp.status_code,
                            "pattern_name": name,
                        },
                    )
                )
    return findings


# ---------------------------------------------------------------------------
# 3. Scan HTML comments for sensitive information
# ---------------------------------------------------------------------------
def scan_html_comments(html: str, url: str) -> List[Dict]:
    """Extract HTML comments and scan them for sensitive content."""
    findings: List[Dict] = []
    comments = HTML_COMMENT_RE.findall(html)

    for comment in comments:
        comment_text = comment.strip()
        if not comment_text or len(comment_text) < 4:
            continue

        for label, pattern in COMMENT_PATTERNS:
            if pattern.search(comment_text):
                findings.append(
                    make_finding(
                        vulnerability=f"Sensitive HTML Comment: {label}",
                        severity="MEDIUM",
                        location=url,
                        evidence=_truncate(comment_text),
                        category=CATEGORY,
                        raw_details={
                            "comment_type": label,
                            "comment_text": _truncate(comment_text, 120),
                        },
                    )
                )
                break  # One finding per comment is enough

    return findings


# ---------------------------------------------------------------------------
# 4. Detect exposed JavaScript source maps
# ---------------------------------------------------------------------------
def scan_source_maps(
    html: str,
    url: str,
    session: "requests.Session",
    timeout: int,
) -> List[Dict]:
    """Check if JS files reference .map files and whether those maps exist."""
    findings: List[Dict] = []
    seen_maps: set = set()

    # Collect JS URLs from the page
    js_urls: List[str] = []
    for match in JS_SRC_RE.finditer(html):
        js_url = urljoin(url, match.group(1))
        js_urls.append(js_url)

    for js_url in js_urls:
        # Quick approach: try appending .map to the JS URL
        map_url = js_url + ".map"
        if map_url in seen_maps:
            continue
        seen_maps.add(map_url)

        resp, err = safe_request(session, "HEAD", map_url, timeout=timeout)
        if err or resp is None:
            continue
        if resp.status_code == 200:
            content_type = resp.headers.get("Content-Type", "")
            # Source maps are typically application/json
            if "json" in content_type or "octet" in content_type or "javascript" in content_type:
                findings.append(
                    make_finding(
                        vulnerability="JavaScript Source Map Exposed",
                        severity="LOW",
                        location=map_url,
                        evidence=f"Source map accessible at {map_url}",
                        category=CATEGORY,
                        raw_details={
                            "js_file": js_url,
                            "map_url": map_url,
                            "content_type": content_type,
                        },
                    )
                )
                continue

        # Also fetch the JS itself and look for sourceMappingURL directive
        resp_js, err_js = safe_request(session, "GET", js_url, timeout=timeout)
        if err_js or resp_js is None:
            continue
        # Only inspect last 500 bytes to save time
        tail = resp_js.text[-500:] if resp_js.text else ""
        sm_match = SOURCE_MAP_INLINE_RE.search(tail)
        if sm_match:
            declared_map = sm_match.group(1)
            declared_map_url = urljoin(js_url, declared_map)
            if declared_map_url in seen_maps:
                continue
            seen_maps.add(declared_map_url)

            resp_map, _ = safe_request(session, "HEAD", declared_map_url, timeout=timeout)
            if resp_map and resp_map.status_code == 200:
                findings.append(
                    make_finding(
                        vulnerability="JavaScript Source Map Exposed",
                        severity="LOW",
                        location=declared_map_url,
                        evidence=f"Source map declared via sourceMappingURL in {js_url}",
                        category=CATEGORY,
                        raw_details={
                            "js_file": js_url,
                            "map_url": declared_map_url,
                            "directive": sm_match.group(0),
                        },
                    )
                )

    return findings


# ---------------------------------------------------------------------------
# Mock findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for demo / CI testing."""
    return [
        make_finding(
            vulnerability="Sensitive Data Exposure: AWS Access Key",
            severity="CRITICAL",
            location=f"{target}/config.js",
            evidence="AKIAIOSFODNN7EXAMPLE",
            category=CATEGORY,
            raw_details={
                "pattern_name": "AWS Access Key",
                "matched_text": "AKIAIOSFODNN7EXAMPLE",
            },
        ),
        make_finding(
            vulnerability="Sensitive Data Exposure: GitHub Token (ghp)",
            severity="CRITICAL",
            location=f"{target}/js/app.js",
            evidence="ghp_ABCDEFghijklmnopqrstuvwxyz0123456789",
            category=CATEGORY,
            raw_details={
                "pattern_name": "GitHub Token (ghp)",
                "matched_text": "ghp_ABCDEFghijklmnopqrstuvwxyz0123456789",
            },
        ),
        make_finding(
            vulnerability="Sensitive Data Exposure: Generic Secret/Password",
            severity="HIGH",
            location=f"{target}/settings",
            evidence="password = 'SuperS3cretPassw0rd!'",
            category=CATEGORY,
            raw_details={
                "pattern_name": "Generic Secret/Password",
                "matched_text": "password = 'SuperS3cretPassw0rd!'",
            },
        ),
        make_finding(
            vulnerability="Sensitive Data Exposure: JWT Token",
            severity="MEDIUM",
            location=f"{target}/dashboard",
            evidence="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
            category=CATEGORY,
            raw_details={
                "pattern_name": "JWT Token",
                "matched_text": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
        ),
        make_finding(
            vulnerability="Error Page Information Leak: Python Traceback",
            severity="MEDIUM",
            location=f"{target}/__nonexistent_path_404_test__",
            evidence='Traceback (most recent call last): File "/var/www/app/views.py", line 42, in handler',
            category=CATEGORY,
            raw_details={
                "probe_description": "Non-existent path to trigger 404 error page",
                "status_code": 500,
                "pattern_name": "Python Traceback",
            },
        ),
        make_finding(
            vulnerability="Error Page Information Leak: MySQL Error",
            severity="HIGH",
            location=f"{target}/'+OR+1=1--",
            evidence="You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version",
            category=CATEGORY,
            raw_details={
                "probe_description": "SQL-injection-like path to trigger error page",
                "status_code": 500,
                "pattern_name": "MySQL Error",
            },
        ),
        make_finding(
            vulnerability="Error Page Information Leak: File Path Disclosure (Unix)",
            severity="MEDIUM",
            location=f"{target}/__nonexistent_path_404_test__",
            evidence="/var/www/html/app/controllers/main.py",
            category=CATEGORY,
            raw_details={
                "probe_description": "Non-existent path to trigger 404 error page",
                "status_code": 404,
                "pattern_name": "File Path Disclosure (Unix)",
            },
        ),
        make_finding(
            vulnerability="Sensitive HTML Comment: TODO/FIXME with credentials",
            severity="MEDIUM",
            location=f"{target}/login",
            evidence="TODO: remove hardcoded admin password before production",
            category=CATEGORY,
            raw_details={
                "comment_type": "TODO/FIXME with credentials",
                "comment_text": "TODO: remove hardcoded admin password before production",
            },
        ),
        make_finding(
            vulnerability="Sensitive HTML Comment: Internal hostname/IP",
            severity="MEDIUM",
            location=f"{target}/",
            evidence="API endpoint: http://192.168.1.50:8080/internal/api",
            category=CATEGORY,
            raw_details={
                "comment_type": "Internal hostname/IP",
                "comment_text": "API endpoint: http://192.168.1.50:8080/internal/api",
            },
        ),
        make_finding(
            vulnerability="JavaScript Source Map Exposed",
            severity="LOW",
            location=f"{target}/static/js/main.chunk.js.map",
            evidence=f"Source map accessible at {target}/static/js/main.chunk.js.map",
            category=CATEGORY,
            raw_details={
                "js_file": f"{target}/static/js/main.chunk.js",
                "map_url": f"{target}/static/js/main.chunk.js.map",
                "content_type": "application/json",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan - Sensitive Data Exposure Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)
    if not target:
        output_error("Invalid target URL")

    # Mock mode
    if is_mock_mode():
        output_findings(get_mock_findings(target))

    # Live scan
    timeout = args.timeout
    delay = args.delay

    session = create_session(timeout=timeout, cookies=args.cookies, headers=args.headers)
    findings: List[Dict] = []

    # Verify target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err:
        output_error(f"Cannot reach target: {err}")

    # Crawl same-domain pages (depth=1, max 10)
    try:
        pages = crawl_same_domain(
            target, session,
            delay=delay, timeout=timeout,
            max_pages=MAX_CRAWL_PAGES,
            depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    # Scan each discovered page
    for page_url in pages:
        page_resp, page_err = rate_limited_request(
            session, "GET", page_url,
            delay=delay, timeout=timeout,
        )
        if page_err or page_resp is None:
            continue

        html = page_resp.text or ""
        if not html:
            continue

        # Secret / API key detection
        findings.extend(scan_page_for_secrets(html, page_url))

        # HTML comment scanning
        findings.extend(scan_html_comments(html, page_url))

        # Source map detection
        findings.extend(scan_source_maps(html, page_url, session, timeout))

    # Error page analysis (only against the base target)
    findings.extend(scan_error_pages(session, target, timeout, delay))

    # De-duplicate findings by (vulnerability, location)
    unique: Dict[Tuple[str, str], Dict] = {}
    for f in findings:
        key = (f["vulnerability"], f["location"])
        if key not in unique:
            unique[key] = f
    findings = list(unique.values())

    output_findings(findings)


if __name__ == "__main__":
    main()
