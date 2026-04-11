#!/usr/bin/env python3
"""
VaultScan -- Web Cache Poisoning Scanner
==========================================
Tests for cache poisoning via unkeyed headers and parameters.
"""

import os
import sys
import hashlib
import time
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding,
)

# Headers that might be unkeyed but reflected in response
POISON_HEADERS = [
    ("X-Forwarded-Host", "evil-cache-test.vaultscan.com", "X-Forwarded-Host header reflected"),
    ("X-Forwarded-Scheme", "nothttps", "X-Forwarded-Scheme reflected"),
    ("X-Original-URL", "/admin", "X-Original-URL reflected"),
    ("X-Rewrite-URL", "/admin", "X-Rewrite-URL reflected"),
    ("X-Forwarded-Port", "1337", "X-Forwarded-Port reflected"),
    ("X-Forwarded-Prefix", "/evil", "X-Forwarded-Prefix reflected"),
    ("X-Custom-IP-Authorization", "127.0.0.1", "Custom IP authorization header"),
    ("Transfer-Encoding", "chunked", "Transfer-Encoding manipulation"),
]

# Query parameters that might be unkeyed
POISON_PARAMS = [
    ("utm_source", "vaultscan_cache_test", "UTM parameter reflected in cached response"),
    ("callback", "vaultscan_jsonp_test", "JSONP callback parameter"),
    ("_", str(int(time.time())), "Cache buster parameter"),
    ("cb", "vaultscan_cb_test", "Callback parameter"),
]


def get_cache_indicators(resp) -> Dict:
    """Extract cache-related headers from response."""
    headers = {k.lower(): v for k, v in resp.headers.items()}
    return {
        "has_cache": any(k in headers for k in [
            "x-cache", "cf-cache-status", "x-varnish", "x-cache-hits",
            "age", "x-fastly-request-id", "x-served-by",
        ]),
        "x_cache": headers.get("x-cache", ""),
        "cf_cache": headers.get("cf-cache-status", ""),
        "age": headers.get("age", ""),
        "cache_control": headers.get("cache-control", ""),
        "vary": headers.get("vary", ""),
        "x_varnish": headers.get("x-varnish", ""),
    }


def test_header_poisoning(session, url: str, timeout: int) -> List[Dict]:
    """Test if unkeyed headers are reflected in cached responses."""
    findings = []

    # Get baseline
    baseline_resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not baseline_resp:
        return findings

    cache_info = get_cache_indicators(baseline_resp)
    baseline_body = baseline_resp.text

    for header_name, header_value, description in POISON_HEADERS:
        # Send request with poison header
        poison_resp, err = safe_request(
            session, "GET", url, timeout=timeout,
            headers={header_name: header_value},
        )
        if err or not poison_resp:
            continue

        # Check if the poison value is reflected in the response
        if header_value in poison_resp.text and header_value not in baseline_body:
            severity = "HIGH" if "Host" in header_name or "URL" in header_name else "MEDIUM"

            # Check if response might be cached
            poison_cache = get_cache_indicators(poison_resp)
            is_cached = (
                poison_cache["has_cache"] or
                "public" in poison_cache["cache_control"].lower() or
                poison_cache["age"] not in ("", "0")
            )

            if is_cached:
                severity = "CRITICAL" if "Host" in header_name else "HIGH"

            findings.append(make_finding(
                vulnerability=f"Cache Poisoning via {header_name}",
                severity=severity,
                location=url,
                evidence=(
                    f"{description}. The value '{header_value}' sent in "
                    f"{header_name} header appears in the response body. "
                    f"{'Response appears to be cached.' if is_cached else 'Cache status unknown.'} "
                    f"Cache-Control: {poison_cache['cache_control'] or 'none'}"
                ),
                category="CACHE_POISONING",
                raw_details={
                    "header": header_name,
                    "value": header_value,
                    "reflected": True,
                    "cached": is_cached,
                    "cache_headers": poison_cache,
                },
            ))

    return findings


def test_param_poisoning(session, url: str, timeout: int) -> List[Dict]:
    """Test if unkeyed query parameters are reflected in cached responses."""
    findings = []

    sep = "&" if "?" in url else "?"

    for param_name, param_value, description in POISON_PARAMS:
        test_url = f"{url}{sep}{param_name}={param_value}"

        resp, err = safe_request(session, "GET", test_url, timeout=timeout)
        if err or not resp:
            continue

        if param_value in resp.text:
            cache_info = get_cache_indicators(resp)

            findings.append(make_finding(
                vulnerability=f"Unkeyed Parameter Reflected: {param_name}",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"{description}. Parameter '{param_name}={param_value}' "
                    f"is reflected in the response. If this parameter is unkeyed "
                    f"by the cache, it could lead to cache poisoning."
                ),
                category="CACHE_POISONING",
                raw_details={
                    "parameter": param_name,
                    "value": param_value,
                    "reflected": True,
                    "cache_headers": cache_info,
                },
            ))

    return findings


def test_cache_deception(session, url: str, timeout: int) -> List[Dict]:
    """Test for web cache deception (accessing /profile/test.css caches profile page)."""
    findings = []

    deception_paths = [
        f"{url}/test.css",
        f"{url}/test.js",
        f"{url}/test.jpg",
        f"{url}/.css",
    ]

    baseline_resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not baseline_resp:
        return findings

    for deception_url in deception_paths:
        resp, err = safe_request(session, "GET", deception_url, timeout=timeout)
        if err or not resp:
            continue

        # If the deception URL returns the same content as the original page
        # AND has cache headers, it might be vulnerable
        if resp.status_code == 200 and len(resp.text) > 100:
            # Check similarity
            baseline_sample = baseline_resp.text[:500]
            resp_sample = resp.text[:500]

            if baseline_sample == resp_sample:
                cache_info = get_cache_indicators(resp)
                if cache_info["has_cache"] or "public" in cache_info["cache_control"].lower():
                    findings.append(make_finding(
                        vulnerability="Web Cache Deception",
                        severity="HIGH",
                        location=deception_url,
                        evidence=(
                            f"Requesting {deception_url} returns the same content "
                            f"as {url} and the response appears cacheable. "
                            f"An attacker could trick a user into visiting a URL like "
                            f"{url}/profile.css to cache their private page content."
                        ),
                        category="CACHE_POISONING",
                        raw_details={
                            "original_url": url,
                            "deception_url": deception_url,
                            "cache_headers": cache_info,
                        },
                    ))
                    break

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Cache Poisoning via X-Forwarded-Host",
            severity="HIGH",
            location=target,
            evidence="X-Forwarded-Host header value reflected in cached response.",
            category="CACHE_POISONING",
        ),
    ]


def main():
    parser = base_argparser("VaultScan Cache Poisoning Scanner")
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

    # Test header-based cache poisoning
    findings.extend(test_header_poisoning(session, target, args.timeout))

    # Test parameter-based cache poisoning
    findings.extend(test_param_poisoning(session, target, args.timeout))

    # Test web cache deception
    findings.extend(test_cache_deception(session, target, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
