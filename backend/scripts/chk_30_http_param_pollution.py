#!/usr/bin/env python3
"""
VaultScan -- HTTP Parameter Pollution (HPP) Scanner
=====================================================
Tests for HPP vulnerabilities where duplicate parameters
cause unexpected server behavior.
"""

import os
import sys
from typing import Dict, List
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
    extract_url_params, extract_forms, responses_differ,
)


def test_hpp_on_url(session, url: str, timeout: int) -> List[Dict]:
    """Test HPP by duplicating query parameters."""
    findings = []
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    if not params:
        return findings

    # Get baseline response
    baseline_resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not baseline_resp:
        return findings

    for param_name, values in params.items():
        original_value = values[0] if values else ""

        # Test 1: Duplicate parameter with different value
        test_value = "hpp_test_vaultscan"
        new_query = parsed.query + f"&{param_name}={test_value}"
        test_url = urlunparse(parsed._replace(query=new_query))

        test_resp, err = safe_request(session, "GET", test_url, timeout=timeout)
        if err or not test_resp:
            continue

        # Check if the test value appears in response (server used attacker's value)
        if test_value in test_resp.text:
            findings.append(make_finding(
                vulnerability="HTTP Parameter Pollution (HPP)",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Parameter '{param_name}' is vulnerable to HPP. "
                    f"Duplicate parameter value '{test_value}' was reflected in response. "
                    f"Server uses the last/combined value of duplicate parameters."
                ),
                category="HPP",
                raw_details={
                    "parameter": param_name,
                    "original_value": original_value,
                    "injected_value": test_value,
                    "test_url": test_url,
                },
            ))
            continue

        # Test 2: Check if response significantly differs (parameter confusion)
        if responses_differ(baseline_resp, test_resp):
            # Verify it's not just dynamic content
            baseline2, _ = safe_request(session, "GET", url, timeout=timeout)
            if baseline2 and not responses_differ(baseline_resp, baseline2):
                findings.append(make_finding(
                    vulnerability="HTTP Parameter Pollution - Server Behavior Change",
                    severity="LOW",
                    location=url,
                    evidence=(
                        f"Duplicate parameter '{param_name}' causes different server response. "
                        f"Baseline status: {baseline_resp.status_code}, "
                        f"HPP status: {test_resp.status_code}."
                    ),
                    category="HPP",
                    raw_details={
                        "parameter": param_name,
                        "baseline_status": baseline_resp.status_code,
                        "hpp_status": test_resp.status_code,
                    },
                ))

    return findings


def test_hpp_on_form(session, form: Dict, timeout: int) -> List[Dict]:
    """Test HPP on form parameters."""
    findings = []
    action = form["action"]
    method = form["method"]

    if method != "POST":
        return findings

    # Build form data
    form_data = {}
    for inp in form.get("inputs", []):
        name = inp.get("name")
        if name:
            form_data[name] = inp.get("value", "test")

    if not form_data:
        return findings

    # Get baseline
    baseline_resp, err = safe_request(session, "POST", action, timeout=timeout, data=form_data)
    if err or not baseline_resp:
        return findings

    # Test each parameter
    for param_name in list(form_data.keys()):
        if "csrf" in param_name.lower() or "token" in param_name.lower():
            continue

        # Duplicate the parameter by adding it to the URL query string
        test_url = f"{action}?{param_name}=hpp_test_vaultscan"
        test_resp, err = safe_request(session, "POST", test_url, timeout=timeout, data=form_data)
        if err or not test_resp:
            continue

        if "hpp_test_vaultscan" in test_resp.text:
            findings.append(make_finding(
                vulnerability="HTTP Parameter Pollution in Form",
                severity="MEDIUM",
                location=action,
                evidence=(
                    f"Form parameter '{param_name}' vulnerable to HPP. "
                    f"URL query parameter overrides POST body parameter."
                ),
                category="HPP",
                raw_details={
                    "parameter": param_name,
                    "form_action": action,
                    "method": "POST",
                },
            ))
            break  # One is enough to prove the point

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="HTTP Parameter Pollution (HPP)",
            severity="MEDIUM",
            location=f"{target}/search?q=test",
            evidence="Parameter 'q' is vulnerable to HPP. Duplicate value reflected.",
            category="HPP",
        ),
    ]


def main():
    parser = base_argparser("VaultScan HTTP Parameter Pollution Scanner")
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

    findings: List[Dict] = []

    # Crawl for pages with parameters
    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=25)

    # Test HPP on URLs with parameters
    urls_with_params = [u for u in urls if "?" in u]
    for url in urls_with_params[:10]:
        findings.extend(test_hpp_on_url(session, url, args.timeout))

    # Test HPP on forms
    for url in urls[:15]:
        resp, err = safe_request(session, "GET", url, timeout=args.timeout)
        if err or not resp or resp.status_code != 200:
            continue
        forms = extract_forms(url, resp.text)
        for form in forms:
            findings.extend(test_hpp_on_form(session, form, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
