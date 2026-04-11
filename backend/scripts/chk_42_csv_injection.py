#!/usr/bin/env python3
"""
VaultScan -- CSV/Formula Injection Scanner
============================================
Tests for CSV injection (aka formula injection) vulnerabilities
where user input can inject spreadsheet formulas.
"""

import os
import sys
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
    extract_forms,
)

CSV_PAYLOADS = [
    ("=cmd|'/C calc'!A0", "Formula execution via cmd"),
    ("=HYPERLINK(\"http://evil.com\")", "Hyperlink injection"),
    ("+cmd|'/C calc'!A0", "Plus prefix formula"),
    ("-cmd|'/C calc'!A0", "Minus prefix formula"),
    ("@SUM(1+1)*cmd|'/C calc'!A0", "At prefix formula"),
    ("|cmd|'/C calc'!A0", "Pipe prefix formula"),
    ("=1+1", "Basic formula evaluation"),
]

EXPORT_PATHS = [
    "/export", "/download", "/csv", "/report",
    "/api/export", "/api/download", "/api/csv",
    "/admin/export", "/data/export", "/users/export",
]


def check_csv_injection_in_forms(session, urls: List[str], timeout: int) -> List[Dict]:
    """Test if form inputs are vulnerable to CSV injection."""
    findings = []
    tested_actions = set()

    for url in urls[:15]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue

        forms = extract_forms(url, resp.text)
        for form in forms:
            action = form["action"]
            if action in tested_actions:
                continue
            tested_actions.add(action)

            # Find text inputs
            text_inputs = [inp for inp in form["inputs"]
                          if inp["type"] in ("text", "search", "textarea", "email", "tel", "url")
                          and inp.get("name")]

            if not text_inputs:
                continue

            for payload, desc in CSV_PAYLOADS[:3]:
                form_data = {}
                for inp in form["inputs"]:
                    name = inp.get("name")
                    if not name:
                        continue
                    if inp["type"] in ("text", "search", "textarea"):
                        form_data[name] = payload
                    elif inp.get("value"):
                        form_data[name] = inp["value"]

                method = form["method"]
                if method == "GET":
                    resp2, err2 = safe_request(session, "GET", action, timeout=timeout, params=form_data)
                else:
                    resp2, err2 = safe_request(session, "POST", action, timeout=timeout, data=form_data)

                if err2 or not resp2:
                    continue

                # Check if the payload is stored/reflected without sanitization
                if payload in resp2.text:
                    findings.append(make_finding(
                        vulnerability="CSV/Formula Injection",
                        severity="MEDIUM",
                        location=action,
                        evidence=(
                            f"Form input reflects formula payload without sanitization. "
                            f"Payload: '{payload}' ({desc}). "
                            f"If this data is exported to CSV/Excel, the formula will execute."
                        ),
                        category="CSV_INJECTION",
                        raw_details={"payload": payload, "form_action": action, "desc": desc},
                    ))
                    break

    return findings


def check_export_endpoints(session, base_url: str, timeout: int) -> List[Dict]:
    """Check if export/download endpoints exist."""
    findings = []

    for path in EXPORT_PATHS:
        url = f"{base_url}{path}"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        if resp.status_code in (200, 302):
            content_type = resp.headers.get("Content-Type", "").lower()
            is_csv = "csv" in content_type or "spreadsheet" in content_type or "excel" in content_type

            if is_csv or resp.status_code == 200:
                findings.append(make_finding(
                    vulnerability=f"Export Endpoint Found: {path}",
                    severity="LOW",
                    location=url,
                    evidence=(
                        f"Data export endpoint at {path} (status {resp.status_code}). "
                        f"Content-Type: {content_type or 'unknown'}. "
                        f"Ensure exported data sanitizes formula characters (=, +, -, @, |)."
                    ),
                    category="CSV_INJECTION",
                    raw_details={"path": path, "content_type": content_type},
                ))

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="CSV/Formula Injection",
            severity="MEDIUM",
            location=f"{target}/search",
            evidence="Form reflects formula payload '=cmd|'/C calc'!A0' without sanitization.",
            category="CSV_INJECTION",
        ),
    ]


def main():
    parser = base_argparser("VaultScan CSV/Formula Injection Scanner")
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

    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=20)
    findings: List[Dict] = []

    findings.extend(check_csv_injection_in_forms(session, urls, args.timeout))
    findings.extend(check_export_endpoints(session, target, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
