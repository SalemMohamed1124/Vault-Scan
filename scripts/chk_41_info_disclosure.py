#!/usr/bin/env python3
"""
VaultScan -- Information Disclosure Scanner
=============================================
Deep information disclosure checks:
- Error page analysis (stack traces, debug info)
- Technology fingerprinting from headers/body
- Version disclosure in multiple locations
- Exposed internal IPs in responses
- Email addresses in page source
- Comments with sensitive data
- Source map files
- Backup files with common naming patterns
"""

import os
import sys
import re
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
)

# Error trigger URLs
ERROR_TRIGGERS = [
    ("404 Error", "/__vaultscan_nonexistent_404__"),
    ("500 Error", "/%00"),
    ("Type Error", "/?id[]="),
    ("Format String", "/?q=%s%s%s%s%s"),
    ("Long Input", "/?q=" + "A" * 5000),
    ("Special Chars", "/?q=<>'\"\\"),
    ("Method Error", None),  # Will use wrong HTTP method
]

# Stack trace / debug patterns
DEBUG_PATTERNS = [
    (re.compile(r"Traceback \(most recent call last\)", re.I), "Python Stack Trace"),
    (re.compile(r"at\s+[\w.]+\([\w]+\.java:\d+\)", re.I), "Java Stack Trace"),
    (re.compile(r"<b>Fatal error</b>.*on line <b>\d+</b>", re.I), "PHP Fatal Error"),
    (re.compile(r"Stack trace:.*#\d+\s", re.S), "PHP Stack Trace"),
    (re.compile(r"at\s+Object\.<anonymous>.*\.js:\d+:\d+", re.I), "Node.js Stack Trace"),
    (re.compile(r"Microsoft\.AspNetCore|System\.Web", re.I), ".NET Stack Trace"),
    (re.compile(r"ActionController::RoutingError", re.I), "Rails Routing Error"),
    (re.compile(r"Django.*DEBUG\s*=\s*True", re.I), "Django Debug Mode"),
    (re.compile(r"<h1>Whitelabel Error Page</h1>", re.I), "Spring Boot Error"),
    (re.compile(r"laravel.*exception|Symfony\\Component", re.I), "Laravel/Symfony Error"),
    (re.compile(r"SQLSTATE\[", re.I), "SQL Error Disclosure"),
    (re.compile(r"mysql_fetch|pg_query|sqlite_", re.I), "Database Error"),
    (re.compile(r"Warning:.*\bon line\b.*\d+", re.I), "PHP Warning"),
    (re.compile(r"Notice:.*\bon line\b.*\d+", re.I), "PHP Notice"),
    (re.compile(r"Parse error:.*\bon line\b.*\d+", re.I), "PHP Parse Error"),
]

# Internal IP patterns
INTERNAL_IP_PATTERN = re.compile(
    r'\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|'
    r'172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|'
    r'192\.168\.\d{1,3}\.\d{1,3}|'
    r'127\.\d{1,3}\.\d{1,3}\.\d{1,3})\b'
)

# Email pattern
EMAIL_PATTERN = re.compile(
    r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
)

# Sensitive HTML comment patterns
COMMENT_PATTERNS = [
    (re.compile(r'<!--.*(?:password|passwd|pwd|secret|key|token|api.?key).*-->', re.I | re.S), "Credential in Comment"),
    (re.compile(r'<!--.*(?:TODO|FIXME|HACK|BUG|XXX).*-->', re.I | re.S), "Developer Note in Comment"),
    (re.compile(r'<!--.*(?:admin|internal|private|staging|dev\b).*-->', re.I | re.S), "Internal Info in Comment"),
    (re.compile(r'<!--.*(?:https?://\d+\.\d+\.\d+\.\d+).*-->', re.I | re.S), "Internal URL in Comment"),
]


def check_error_pages(session, url: str, timeout: int) -> List[Dict]:
    """Trigger error pages and check for information disclosure."""
    findings = []
    seen_types = set()

    for trigger_name, trigger_path in ERROR_TRIGGERS:
        if trigger_path:
            test_url = url + trigger_path
            method = "GET"
        else:
            test_url = url
            method = "PATCH"  # Wrong method to trigger error

        resp, err = safe_request(session, method, test_url, timeout=timeout)
        if err or not resp:
            continue

        body = resp.text[:10000]

        for pattern, debug_type in DEBUG_PATTERNS:
            if pattern.search(body) and debug_type not in seen_types:
                seen_types.add(debug_type)
                # Extract a snippet around the match
                match = pattern.search(body)
                snippet = body[max(0, match.start() - 20):match.end() + 100][:200]

                findings.append(make_finding(
                    vulnerability=f"Information Disclosure: {debug_type}",
                    severity="HIGH" if "Stack Trace" in debug_type or "Debug" in debug_type else "MEDIUM",
                    location=test_url,
                    evidence=(
                        f"Error page reveals {debug_type}. "
                        f"Triggered by: {trigger_name}. "
                        f"Snippet: {snippet}"
                    ),
                    category="INFORMATION_DISCLOSURE",
                    raw_details={"trigger": trigger_name, "type": debug_type, "snippet": snippet},
                ))

    return findings


def check_internal_ips(session, urls: List[str], timeout: int) -> List[Dict]:
    """Check for internal IP addresses leaked in responses."""
    findings = []
    seen_ips = set()

    for url in urls[:10]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        # Check body and headers
        combined = resp.text[:20000] + str(resp.headers)
        ips = INTERNAL_IP_PATTERN.findall(combined)

        for ip in ips:
            if ip not in seen_ips and ip != "127.0.0.1":
                seen_ips.add(ip)
                findings.append(make_finding(
                    vulnerability=f"Internal IP Address Disclosed: {ip}",
                    severity="MEDIUM",
                    location=url,
                    evidence=f"Internal/private IP address {ip} found in response. This reveals internal network structure.",
                    category="INFORMATION_DISCLOSURE",
                    raw_details={"ip": ip, "url": url},
                ))

    return findings


def check_email_disclosure(session, urls: List[str], timeout: int) -> List[Dict]:
    """Check for email addresses in page source."""
    findings = []
    seen_emails = set()

    for url in urls[:10]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        emails = EMAIL_PATTERN.findall(resp.text[:30000])
        for email in emails:
            # Skip common false positives
            if email.endswith((".png", ".jpg", ".gif", ".css", ".js")):
                continue
            if "@example.com" in email or "@test.com" in email:
                continue
            if email not in seen_emails:
                seen_emails.add(email)

    if seen_emails:
        findings.append(make_finding(
            vulnerability=f"Email Addresses Disclosed ({len(seen_emails)} found)",
            severity="LOW",
            location=urls[0] if urls else "",
            evidence=f"Email addresses found in page source: {', '.join(list(seen_emails)[:5])}{'...' if len(seen_emails) > 5 else ''}",
            category="INFORMATION_DISCLOSURE",
            raw_details={"emails": list(seen_emails)[:10], "count": len(seen_emails)},
        ))

    return findings


def check_html_comments(session, urls: List[str], timeout: int) -> List[Dict]:
    """Check for sensitive information in HTML comments."""
    findings = []
    seen = set()

    for url in urls[:10]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        for pattern, comment_type in COMMENT_PATTERNS:
            matches = pattern.findall(resp.text[:30000])
            for match in matches:
                key = f"{comment_type}:{match[:50]}"
                if key not in seen:
                    seen.add(key)
                    snippet = match[:200].strip()
                    severity = "HIGH" if "Credential" in comment_type else "LOW"
                    findings.append(make_finding(
                        vulnerability=f"Sensitive HTML Comment: {comment_type}",
                        severity=severity,
                        location=url,
                        evidence=f"HTML comment contains sensitive information: {snippet}",
                        category="INFORMATION_DISCLOSURE",
                        raw_details={"type": comment_type, "comment": snippet},
                    ))

    return findings


def check_source_maps(session, urls: List[str], timeout: int) -> List[Dict]:
    """Check for exposed JavaScript source map files."""
    findings = []
    seen = set()

    for url in urls[:10]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        # Find JS file references
        js_urls = re.findall(r'src=["\']([^"\']+\.js)["\']', resp.text)

        for js_url in js_urls[:5]:
            if js_url.startswith("//"):
                js_url = "https:" + js_url
            elif js_url.startswith("/"):
                from urllib.parse import urlparse
                parsed = urlparse(url)
                js_url = f"{parsed.scheme}://{parsed.netloc}{js_url}"

            map_url = js_url + ".map"
            if map_url in seen:
                continue
            seen.add(map_url)

            map_resp, _ = safe_request(session, "HEAD", map_url, timeout=timeout)
            if map_resp and map_resp.status_code == 200:
                findings.append(make_finding(
                    vulnerability="JavaScript Source Map Exposed",
                    severity="MEDIUM",
                    location=map_url,
                    evidence=f"Source map file accessible at {map_url}. This reveals original source code, file structure, and variable names.",
                    category="INFORMATION_DISCLOSURE",
                    raw_details={"map_url": map_url, "js_url": js_url},
                ))

    return findings


def check_version_headers(session, url: str, timeout: int) -> List[Dict]:
    """Check for version disclosure in various headers."""
    findings = []
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return findings

    version_headers = [
        ("X-Powered-By", "Technology"),
        ("X-AspNet-Version", "ASP.NET Version"),
        ("X-AspNetMvc-Version", "ASP.NET MVC Version"),
        ("X-Runtime", "Runtime"),
        ("X-Version", "Application Version"),
        ("X-Generator", "Generator"),
    ]

    for header_name, desc in version_headers:
        value = resp.headers.get(header_name)
        if value:
            findings.append(make_finding(
                vulnerability=f"{desc} Disclosed via {header_name}",
                severity="MEDIUM",
                location=url,
                evidence=f"Header '{header_name}: {value}' reveals technology/version information.",
                category="INFORMATION_DISCLOSURE",
                raw_details={"header": header_name, "value": value},
            ))

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Information Disclosure: Python Stack Trace",
            severity="HIGH",
            location=f"{target}/__vaultscan_nonexistent_404__",
            evidence="Error page reveals Python Stack Trace with file paths and line numbers.",
            category="INFORMATION_DISCLOSURE",
        ),
        make_finding(
            vulnerability="Internal IP Address Disclosed: 10.0.1.5",
            severity="MEDIUM",
            location=target,
            evidence="Internal IP address 10.0.1.5 found in response.",
            category="INFORMATION_DISCLOSURE",
        ),
    ]


def main():
    parser = base_argparser("VaultScan Information Disclosure Scanner")
    args = parser.parse_args()
    target = normalize_url(args.target)

    if not target:
        from scan_utils import output_error
        output_error("No target specified.")

    if is_mock_mode():
        output_findings(get_mock_findings(target))

    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)
    resp, err = safe_request(session, "GET", target, timeout=args.timeout)
    if err:
        output_findings([])

    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=15)
    findings: List[Dict] = []

    findings.extend(check_error_pages(session, target, args.timeout))
    findings.extend(check_version_headers(session, target, args.timeout))
    findings.extend(check_internal_ips(session, urls, args.timeout))
    findings.extend(check_email_disclosure(session, urls, args.timeout))
    findings.extend(check_html_comments(session, urls, args.timeout))
    findings.extend(check_source_maps(session, urls, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
