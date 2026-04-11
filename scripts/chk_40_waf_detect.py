#!/usr/bin/env python3
"""
VaultScan -- WAF Detection & Analysis Scanner
===============================================
Detects and identifies Web Application Firewalls,
tests basic bypass techniques, and reports WAF configuration issues.
"""

import os
import sys
import re
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding,
)

# WAF detection signatures: (name, header_patterns, body_patterns, cookie_patterns)
WAF_SIGNATURES = [
    ("Cloudflare", ["cf-ray", "cf-cache-status", "cf-request-id"],
     ["cloudflare", "attention required", "ray id"], ["__cfduid", "cf_clearance"]),
    ("AWS WAF/CloudFront", ["x-amzn-requestid", "x-amz-cf-id", "x-amz-cf-pop"],
     ["awselb", "amazonaws"], []),
    ("Akamai", ["x-akamai-transformed", "akamai-grn"],
     ["akamai", "ghost"], ["akamai"]),
    ("Imperva/Incapsula", ["x-cdn", "x-iinfo"],
     ["incapsula", "imperva", "blocked"], ["visid_incap", "incap_ses"]),
    ("ModSecurity", [],
     ["modsecurity", "mod_security", "noyb"], []),
    ("F5 BIG-IP ASM", ["x-wa-info"],
     ["the requested url was rejected", "please consult with your administrator"], ["ts", "bigipserver"]),
    ("Sucuri", ["x-sucuri-id", "x-sucuri-cache"],
     ["sucuri", "access denied", "sucuri cloudproxy"], []),
    ("Barracuda", ["barra_counter_session"],
     ["barracuda", "barra_counter"], []),
    ("Fortinet FortiWeb", ["fortiwafsid"],
     ["fortiweb", "fortigate"], ["cookiesession1"]),
    ("Citrix NetScaler", ["cneonction", "via: ns-cache"],
     ["ns_af", "citrix", "netscaler"], ["citrix_ns_id"]),
    ("DDoS-Guard", ["ddos-guard"],
     ["ddos-guard"], []),
    ("Wordfence", [],
     ["wordfence", "wfvt_", "a]potentially unsafe operation has been detected"], []),
    ("Azure Front Door", ["x-azure-ref"],
     ["azure", "front door"], []),
    ("Google Cloud Armor", [],
     ["google cloud armor", "blocked by cloud armor"], []),
    ("StackPath", ["x-sp-"],
     ["stackpath", "highwinds"], []),
    ("Fastly", ["x-fastly-request-id", "fastly-io"],
     ["fastly error"], []),
    ("Varnish", ["x-varnish", "via: varnish"],
     ["varnish"], []),
    ("Kong", ["x-kong-", "via: kong"],
     ["kong"], []),
]

# Attack payloads to trigger WAF responses
TRIGGER_PAYLOADS = [
    ("SQL Injection", "?id=1' OR '1'='1' --"),
    ("XSS", "?q=<script>alert(1)</script>"),
    ("Path Traversal", "/../../etc/passwd"),
    ("Command Injection", "?cmd=;cat /etc/passwd"),
    ("XXE Probe", "?xml=<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>"),
]


def detect_waf(session, url: str, timeout: int) -> Tuple[Optional[str], Dict]:
    """Detect WAF by analyzing response headers, body, and cookies."""
    info = {"detected": False, "name": None, "evidence": []}

    # Normal request
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return None, info

    headers_str = " ".join(f"{k}: {v}" for k, v in resp.headers.items()).lower()
    body_lower = resp.text[:5000].lower()
    cookies_str = " ".join(resp.headers.get("Set-Cookie", "").split()).lower()

    for name, header_pats, body_pats, cookie_pats in WAF_SIGNATURES:
        matched = False

        for pat in header_pats:
            if pat.lower() in headers_str:
                info["evidence"].append(f"Header match: {pat}")
                matched = True
                break

        if not matched:
            for pat in body_pats:
                if pat.lower() in body_lower:
                    info["evidence"].append(f"Body match: {pat}")
                    matched = True
                    break

        if not matched:
            for pat in cookie_pats:
                if pat.lower() in cookies_str:
                    info["evidence"].append(f"Cookie match: {pat}")
                    matched = True
                    break

        if matched:
            info["detected"] = True
            info["name"] = name
            return name, info

    return None, info


def test_waf_triggers(session, url: str, timeout: int) -> List[Dict]:
    """Send attack payloads to trigger WAF and confirm detection."""
    results = []

    # Get baseline
    baseline, _ = safe_request(session, "GET", url, timeout=timeout)
    if not baseline:
        return results

    for attack_name, payload in TRIGGER_PAYLOADS:
        test_url = url + payload
        resp, err = safe_request(session, "GET", test_url, timeout=timeout)

        if err or not resp:
            results.append({"attack": attack_name, "blocked": True, "status": None, "method": "connection_error"})
            continue

        blocked = resp.status_code in (403, 406, 429, 503)

        # Check for WAF block pages
        body_lower = resp.text[:2000].lower()
        block_indicators = [
            "blocked", "forbidden", "access denied", "not acceptable",
            "request rejected", "security policy", "waf", "firewall",
            "malicious", "attack detected", "suspicious",
        ]
        if any(ind in body_lower for ind in block_indicators):
            blocked = True

        results.append({
            "attack": attack_name,
            "blocked": blocked,
            "status": resp.status_code,
            "method": "status_code" if resp.status_code in (403, 406, 429, 503) else "body_content",
        })

    return results


def analyze_waf(session, url: str, timeout: int) -> List[Dict]:
    """Full WAF analysis."""
    findings = []

    # Step 1: Detect WAF
    waf_name, waf_info = detect_waf(session, url, timeout)

    if waf_name:
        findings.append(make_finding(
            vulnerability=f"WAF Detected: {waf_name}",
            severity="LOW",
            location=url,
            evidence=(
                f"Web Application Firewall identified: {waf_name}. "
                f"Detection evidence: {', '.join(waf_info['evidence'])}. "
                f"While WAFs add protection, they should not be the only security layer."
            ),
            category="WAF_DETECTION",
            raw_details={"waf": waf_name, "evidence": waf_info["evidence"]},
        ))

    # Step 2: Test WAF triggers
    trigger_results = test_waf_triggers(session, url, timeout)
    blocked_count = sum(1 for r in trigger_results if r["blocked"])
    total_tests = len(trigger_results)

    if total_tests > 0 and blocked_count == 0:
        findings.append(make_finding(
            vulnerability="No WAF Protection Detected",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"None of {total_tests} attack payloads were blocked by a WAF. "
                f"Tested: {', '.join(r['attack'] for r in trigger_results)}. "
                f"All returned normal responses. Consider deploying a WAF."
            ),
            category="WAF_DETECTION",
            raw_details={"tests": trigger_results, "blocked": 0, "total": total_tests},
        ))
    elif total_tests > 0 and blocked_count < total_tests:
        unblocked = [r for r in trigger_results if not r["blocked"]]
        findings.append(make_finding(
            vulnerability="WAF Incomplete Coverage",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"WAF blocked {blocked_count}/{total_tests} attack payloads. "
                f"Unblocked attacks: {', '.join(r['attack'] for r in unblocked)}. "
                f"WAF rules may need updating."
            ),
            category="WAF_DETECTION",
            raw_details={"tests": trigger_results, "blocked": blocked_count, "total": total_tests},
        ))

    # Step 3: Check security headers that indicate WAF/CDN
    resp, _ = safe_request(session, "GET", url, timeout=timeout)
    if resp:
        # Check for rate limit headers
        rate_headers = ["x-ratelimit-limit", "x-rate-limit", "ratelimit-limit"]
        has_rate = any(h in {k.lower() for k in resp.headers} for h in rate_headers)

        if not has_rate and not waf_name:
            findings.append(make_finding(
                vulnerability="No Rate Limiting Headers",
                severity="LOW",
                location=url,
                evidence="No rate limiting headers detected. The application may be vulnerable to brute force and enumeration attacks.",
                category="WAF_DETECTION",
            ))

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="WAF Detected: Cloudflare",
            severity="LOW",
            location=target,
            evidence="Web Application Firewall identified: Cloudflare. Header: cf-ray.",
            category="WAF_DETECTION",
        ),
        make_finding(
            vulnerability="WAF Incomplete Coverage",
            severity="MEDIUM",
            location=target,
            evidence="WAF blocked 3/5 attack payloads. Unblocked: Command Injection, XXE.",
            category="WAF_DETECTION",
        ),
    ]


def main():
    parser = base_argparser("VaultScan WAF Detection Scanner")
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

    findings = analyze_waf(session, target, args.timeout)
    output_findings(findings)


if __name__ == "__main__":
    main()
