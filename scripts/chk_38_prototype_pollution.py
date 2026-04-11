#!/usr/bin/env python3
"""
VaultScan -- Prototype Pollution Scanner
==========================================
Tests for JavaScript prototype pollution via URL params,
JSON bodies, and query string manipulation.
"""

import os
import sys
import json
import re
from typing import Dict, List
from urllib.parse import urlparse, urlencode

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
    extract_url_params,
)

# Prototype pollution payloads for URL parameters
URL_PAYLOADS = [
    ("__proto__[polluted]", "vaultscan_pp_test"),
    ("__proto__.polluted", "vaultscan_pp_test"),
    ("constructor[prototype][polluted]", "vaultscan_pp_test"),
    ("constructor.prototype.polluted", "vaultscan_pp_test"),
    ("__proto__[status]", "polluted"),
    ("__proto__[toString]", "vaultscan"),
]

# JSON body payloads
JSON_PAYLOADS = [
    {"__proto__": {"polluted": "vaultscan_pp_test"}},
    {"constructor": {"prototype": {"polluted": "vaultscan_pp_test"}}},
    {"__proto__": {"isAdmin": True}},
    {"__proto__": {"role": "admin"}},
]


def check_url_prototype_pollution(session, urls: List[str], timeout: int) -> List[Dict]:
    """Test prototype pollution via URL query parameters."""
    findings = []
    tested = set()

    for url in urls:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if base in tested:
            continue
        tested.add(base)

        # Get baseline
        baseline_resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not baseline_resp:
            continue

        baseline_body = baseline_resp.text

        for param_name, param_value in URL_PAYLOADS:
            sep = "&" if "?" in url else "?"
            test_url = f"{url}{sep}{param_name}={param_value}"

            resp, err = safe_request(session, "GET", test_url, timeout=timeout)
            if err or not resp:
                continue

            # Check if pollution indicator appears in response
            if "vaultscan_pp_test" in resp.text and "vaultscan_pp_test" not in baseline_body:
                findings.append(make_finding(
                    vulnerability="Prototype Pollution via URL Parameter",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Prototype pollution payload '{param_name}={param_value}' "
                        f"was processed by the server. The pollution value appeared "
                        f"in the response, indicating the server-side JavaScript "
                        f"merged user input into object prototypes."
                    ),
                    category="PROTOTYPE_POLLUTION",
                    raw_details={"payload": param_name, "value": param_value, "url": test_url},
                ))
                break

            # Check for server errors indicating prototype access
            if resp.status_code == 500 and baseline_resp.status_code == 200:
                error_indicators = ["prototype", "cannot read", "undefined", "typeerror", "__proto__"]
                body_lower = resp.text[:2000].lower()
                if any(ind in body_lower for ind in error_indicators):
                    findings.append(make_finding(
                        vulnerability="Potential Prototype Pollution (Server Error)",
                        severity="MEDIUM",
                        location=url,
                        evidence=(
                            f"Sending '{param_name}' parameter caused a server error (500). "
                            f"This may indicate prototype pollution affecting server-side JavaScript."
                        ),
                        category="PROTOTYPE_POLLUTION",
                        raw_details={"payload": param_name, "status": 500},
                    ))
                    break

    return findings


def check_json_prototype_pollution(session, urls: List[str], timeout: int) -> List[Dict]:
    """Test prototype pollution via JSON request bodies."""
    findings = []
    tested = set()

    # Find endpoints that accept JSON
    api_paths = ["/api", "/graphql", "/data", "/search", "/users", "/login", "/register"]

    for url in urls:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        for path in api_paths:
            endpoint = f"{base}{path}"
            if endpoint in tested:
                continue
            tested.add(endpoint)

            for payload in JSON_PAYLOADS:
                try:
                    resp, err = safe_request(
                        session, "POST", endpoint, timeout=timeout,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
                    if err or not resp:
                        continue

                    body = resp.text[:3000].lower()

                    # Check for pollution indicators
                    if "vaultscan_pp_test" in resp.text:
                        findings.append(make_finding(
                            vulnerability="Prototype Pollution via JSON Body",
                            severity="HIGH",
                            location=endpoint,
                            evidence=(
                                f"JSON body with __proto__ was processed and pollution "
                                f"value reflected in response. Payload: {json.dumps(payload)}"
                            ),
                            category="PROTOTYPE_POLLUTION",
                            raw_details={"endpoint": endpoint, "payload": payload},
                        ))
                        return findings  # One is enough

                    # Check for privilege escalation indicators
                    if '"isadmin":true' in body or '"role":"admin"' in body:
                        if resp.status_code == 200:
                            findings.append(make_finding(
                                vulnerability="Prototype Pollution Privilege Escalation",
                                severity="CRITICAL",
                                location=endpoint,
                                evidence=(
                                    f"Prototype pollution via __proto__.isAdmin/role "
                                    f"appears to have granted admin privileges."
                                ),
                                category="PROTOTYPE_POLLUTION",
                                raw_details={"endpoint": endpoint, "payload": payload},
                            ))
                            return findings

                except Exception:
                    continue

    return findings


def check_client_side_pollution(session, urls: List[str], timeout: int) -> List[Dict]:
    """Check for client-side prototype pollution indicators in JavaScript."""
    findings = []
    seen = set()

    pollution_patterns = [
        re.compile(r"Object\.assign\s*\(\s*\{\s*\}"),  # Object.assign({}, userInput)
        re.compile(r"_\.merge\s*\("),  # lodash merge
        re.compile(r"_\.defaultsDeep\s*\("),  # lodash defaultsDeep
        re.compile(r"jQuery\.extend\s*\(\s*true"),  # deep jQuery extend
        re.compile(r"\$\.extend\s*\(\s*true"),  # deep jQuery extend shorthand
        re.compile(r"deepmerge\s*\("),  # deepmerge library
        re.compile(r"merge\s*\(\s*\{\s*\}"),  # generic deep merge
    ]

    for url in urls[:15]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue

        body = resp.text
        for pattern in pollution_patterns:
            matches = pattern.findall(body)
            if matches and url not in seen:
                seen.add(url)
                findings.append(make_finding(
                    vulnerability="Client-Side Prototype Pollution Risk",
                    severity="LOW",
                    location=url,
                    evidence=(
                        f"JavaScript code contains deep merge/extend patterns "
                        f"that may be vulnerable to prototype pollution: "
                        f"'{matches[0][:80]}'. Review if user input flows into these functions."
                    ),
                    category="PROTOTYPE_POLLUTION",
                    raw_details={"pattern": str(pattern.pattern), "url": url},
                ))
                break

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Prototype Pollution via URL Parameter",
            severity="HIGH",
            location=target,
            evidence="Prototype pollution payload '__proto__[polluted]' was processed.",
            category="PROTOTYPE_POLLUTION",
        ),
    ]


def main():
    parser = base_argparser("VaultScan Prototype Pollution Scanner")
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

    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=5)
    findings: List[Dict] = []

    findings.extend(check_url_prototype_pollution(session, urls, args.timeout))
    findings.extend(check_json_prototype_pollution(session, urls, args.timeout))
    findings.extend(check_client_side_pollution(session, urls, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
