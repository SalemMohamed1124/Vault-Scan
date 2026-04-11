#!/usr/bin/env python3
"""
VaultScan - Server-Side Template Injection (SSTI) Scanner
==========================================================
Tests URL parameters and form inputs for server-side template injection
vulnerabilities using expression evaluation, error-based detection, and
multi-engine polyglot payloads. Crawls same-domain pages and tests
discovered parameters and forms. Includes WAF detection and rate limiting.

Outputs JSON array of findings to stdout.
"""

import re
import sys
import os
import uuid
from typing import Dict, List, Optional, Tuple, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    base_argparser,
    is_mock_mode,
    output_findings,
    output_error,
    normalize_url,
    get_base_domain,
    create_session,
    safe_request,
    rate_limited_request,
    extract_forms,
    extract_url_params,
    replace_url_param,
    crawl_same_domain,
    make_finding,
    detect_waf,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "INJECTION"
MAX_CRAWL_PAGES = 5
TESTABLE_INPUT_TYPES = {"text", "search", "hidden", "password", "email", "url", "tel", "number"}
WAF_SAMPLE_SIZE = 4  # Number of probe requests before WAF check

# ---------------------------------------------------------------------------
# SSTI Payloads
# ---------------------------------------------------------------------------
SSTI_PAYLOADS: List[Dict[str, Optional[str]]] = [
    # Jinja2 / Twig
    {"payload": "{{7*7}}", "expected": "49", "engine": "Jinja2/Twig"},
    {"payload": "{{7*'7'}}", "expected": "7777777", "engine": "Jinja2"},
    {"payload": "${7*7}", "expected": "49", "engine": "FreeMarker/Mako"},
    {"payload": "#{7*7}", "expected": "49", "engine": "Ruby ERB/Java EL"},
    {"payload": "<%= 7*7 %>", "expected": "49", "engine": "ERB/EJS"},
    {"payload": "{{config}}", "expected": "Config", "engine": "Jinja2"},  # partial match
    {"payload": "{{self}}", "expected": "TemplateReference", "engine": "Jinja2"},
    {"payload": "${class.getClass()}", "expected": "java.lang.Class", "engine": "Java EL"},
    {"payload": "{{request}}", "expected": "Request", "engine": "Jinja2/Django"},
    {"payload": "{{[].__class__}}", "expected": "class 'list'", "engine": "Jinja2"},
    # Polyglot
    {"payload": "${{<%[%'\"}}%\\.", "expected": None, "engine": "Polyglot"},  # error detection
    {"payload": "{{dump(app)}}", "expected": "AppVariable", "engine": "Twig"},
    {"payload": "${T(java.lang.Runtime)}", "expected": "java.lang.Runtime", "engine": "Spring EL"},
    {"payload": "{{7*7}}${7*7}<%= 7*7 %>", "expected": "49", "engine": "Multi-engine"},
]

# Reduced payload set when WAF is detected
SSTI_PAYLOADS_REDUCED: List[Dict[str, Optional[str]]] = [
    {"payload": "{{7*7}}", "expected": "49", "engine": "Jinja2/Twig"},
    {"payload": "${7*7}", "expected": "49", "engine": "FreeMarker/Mako"},
    {"payload": "${{<%[%'\"}}%\\.", "expected": None, "engine": "Polyglot"},
]

# ---------------------------------------------------------------------------
# Template Engine Error Patterns
# ---------------------------------------------------------------------------
TEMPLATE_ERROR_PATTERNS: List[str] = [
    r"TemplateSyntaxError",
    r"TemplateError",
    r"Jinja2",
    r"Twig",
    r"FreeMarker",
    r"Mako",
    r"ERB",
    r"Velocity",
    r"Thymeleaf",
    r"template",
    r"SyntaxError",
    r"ParseError",
    r"UndefinedError",
]


# ---------------------------------------------------------------------------
# Canary Baseline — inject random string and capture response
# ---------------------------------------------------------------------------
def _get_canary_baseline(
    session,
    url: str,
    param: str,
    value: str,
    delay: float,
    timeout: int,
    method: str = "GET",
    base_data: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    """
    Inject a random canary string into the parameter and return the response
    body. This establishes a baseline so we can distinguish genuine SSTI
    reflection from content that already contains the expected string.
    """
    canary = f"ssti_canary_{uuid.uuid4().hex[:8]}"

    if method == "GET" and base_data is None:
        canary_url = replace_url_param(url, param, canary)
        resp, err = rate_limited_request(session, "GET", canary_url, delay=delay, timeout=timeout)
    else:
        form_data = {**(base_data or {}), param: canary} if base_data is not None else {param: canary}
        if method == "POST":
            resp, err = rate_limited_request(session, "POST", url, delay=delay, timeout=timeout, data=form_data)
        else:
            resp, err = rate_limited_request(session, "GET", url, delay=delay, timeout=timeout, params=form_data)

    if err or resp is None:
        return None
    return resp.text


# ---------------------------------------------------------------------------
# Check for template engine errors in response body
# ---------------------------------------------------------------------------
def _check_template_errors(body: str) -> Optional[str]:
    """
    Scan the response body for template engine error strings.
    Returns the first matched pattern or None.
    """
    for pattern in TEMPLATE_ERROR_PATTERNS:
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            return match.group(0)
    return None


# ---------------------------------------------------------------------------
# URL Parameter Testing
# ---------------------------------------------------------------------------
def test_url_params(
    session,
    url: str,
    delay: float,
    timeout: int,
    payloads: List[Dict[str, Optional[str]]],
) -> Tuple[List[Dict], List]:
    """
    Extract query parameters from *url* and inject SSTI payloads into each.
    Uses a canary baseline to avoid false positives.
    Returns (findings, collected_responses_for_waf_check).
    """
    findings: List[Dict] = []
    waf_responses: List = []
    params = extract_url_params(url)

    if not params:
        return findings, waf_responses

    # Track already-reported (param, technique) pairs for deduplication
    reported: set = set()

    for param, values in params.items():
        original_value = values[0] if values else ""

        # Get canary baseline
        baseline_body = _get_canary_baseline(
            session, url, param, original_value, delay, timeout,
        )

        for entry in payloads:
            payload = entry["payload"]
            expected = entry["expected"]
            engine = entry["engine"]

            test_url = replace_url_param(url, param, payload)
            resp, err = rate_limited_request(
                session, "GET", test_url, delay=delay, timeout=timeout,
            )
            if err or resp is None:
                continue

            waf_responses.append(resp)
            body = resp.text

            # --- Expression evaluation detection (expected != None) ---
            if expected is not None:
                dedup_key = (param, "expression-evaluation")
                if dedup_key not in reported and expected in body:
                    # Verify it's not already in the baseline
                    if baseline_body is None or expected not in baseline_body:
                        reported.add(dedup_key)
                        findings.append(make_finding(
                            vulnerability=f"Server-Side Template Injection ({engine})",
                            severity="CRITICAL",
                            location=f"{url} [param: {param}]",
                            evidence=(
                                f"Payload {payload} returned '{expected}' in response"
                            ),
                            category=CATEGORY,
                            raw_details={
                                "parameter": param,
                                "payload": payload,
                                "engine": engine,
                                "expected": expected,
                                "technique": "expression-evaluation",
                                "status_code": resp.status_code,
                            },
                        ))

            # --- Error-based detection (polyglot or any payload) ---
            dedup_key_err = (param, "error-based")
            if dedup_key_err not in reported:
                error_match = _check_template_errors(body)
                if error_match:
                    # Verify error is not in the baseline
                    if baseline_body is None or error_match not in baseline_body:
                        reported.add(dedup_key_err)
                        findings.append(make_finding(
                            vulnerability="Template Engine Error Detected",
                            severity="HIGH",
                            location=f"{url} [param: {param}]",
                            evidence=(
                                f"Template error '{error_match}' triggered by "
                                f"payload {payload}"
                            ),
                            category=CATEGORY,
                            raw_details={
                                "parameter": param,
                                "payload": payload,
                                "error_pattern": error_match,
                                "engine": engine,
                                "technique": "error-based",
                                "status_code": resp.status_code,
                            },
                        ))

    return findings, waf_responses


# ---------------------------------------------------------------------------
# Form Input Testing
# ---------------------------------------------------------------------------
def test_forms(
    session,
    url: str,
    html: str,
    delay: float,
    timeout: int,
    payloads: List[Dict[str, Optional[str]]],
) -> Tuple[List[Dict], List]:
    """
    Extract forms from *html*, inject SSTI payloads into text inputs.
    Returns (findings, collected_responses_for_waf_check).
    """
    findings: List[Dict] = []
    waf_responses: List = []
    forms = extract_forms(url, html)

    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        inputs = form.get("inputs", [])

        # Track already-reported (field, technique) pairs for deduplication
        reported: set = set()

        for inp in inputs:
            inp_type = inp.get("type", "text").lower()
            if inp_type not in TESTABLE_INPUT_TYPES:
                continue

            inp_name = inp.get("name")
            if not inp_name:
                continue

            # Build base form data (fill other fields with benign values)
            base_data: Dict[str, str] = {}
            for other in inputs:
                other_name = other.get("name")
                if not other_name or other_name == inp_name:
                    continue
                base_data[other_name] = other.get("value", "") or "test"

            # Get canary baseline for this form field
            baseline_body = _get_canary_baseline(
                session, action, inp_name, "", delay, timeout,
                method=method, base_data=base_data,
            )

            for entry in payloads:
                payload = entry["payload"]
                expected = entry["expected"]
                engine = entry["engine"]

                form_data = {**base_data, inp_name: payload}

                if method == "POST":
                    resp, err = rate_limited_request(
                        session, "POST", action, delay=delay, timeout=timeout, data=form_data,
                    )
                else:
                    resp, err = rate_limited_request(
                        session, "GET", action, delay=delay, timeout=timeout, params=form_data,
                    )

                if err or resp is None:
                    continue

                waf_responses.append(resp)
                body = resp.text

                # --- Expression evaluation ---
                if expected is not None:
                    dedup_key = (inp_name, "expression-evaluation")
                    if dedup_key not in reported and expected in body:
                        if baseline_body is None or expected not in baseline_body:
                            reported.add(dedup_key)
                            findings.append(make_finding(
                                vulnerability=f"Server-Side Template Injection in Form ({engine})",
                                severity="CRITICAL",
                                location=f"{action} [form field: {inp_name}]",
                                evidence=(
                                    f"Payload {payload} in form field '{inp_name}' "
                                    f"({method}) returned '{expected}' in response"
                                ),
                                category=CATEGORY,
                                raw_details={
                                    "form_action": action,
                                    "form_method": method,
                                    "field": inp_name,
                                    "payload": payload,
                                    "engine": engine,
                                    "expected": expected,
                                    "technique": "expression-evaluation",
                                    "status_code": resp.status_code,
                                },
                            ))

                # --- Error-based ---
                dedup_key_err = (inp_name, "error-based")
                if dedup_key_err not in reported:
                    error_match = _check_template_errors(body)
                    if error_match:
                        if baseline_body is None or error_match not in baseline_body:
                            reported.add(dedup_key_err)
                            findings.append(make_finding(
                                vulnerability="Template Engine Error in Form",
                                severity="HIGH",
                                location=f"{action} [form field: {inp_name}]",
                                evidence=(
                                    f"Template error '{error_match}' triggered by "
                                    f"payload {payload} in form field '{inp_name}' ({method})"
                                ),
                                category=CATEGORY,
                                raw_details={
                                    "form_action": action,
                                    "form_method": method,
                                    "field": inp_name,
                                    "payload": payload,
                                    "error_pattern": error_match,
                                    "engine": engine,
                                    "technique": "error-based",
                                    "status_code": resp.status_code,
                                },
                            ))

    return findings, waf_responses


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for SSTI detection."""
    return [
        make_finding(
            vulnerability="Server-Side Template Injection (Jinja2/Twig)",
            severity="CRITICAL",
            location=f"{target}/search?q=test",
            evidence="Payload {{7*7}} returned '49' in response",
            category=CATEGORY,
            raw_details={
                "parameter": "q",
                "payload": "{{7*7}}",
                "engine": "Jinja2/Twig",
                "technique": "expression-evaluation",
            },
        ),
        make_finding(
            vulnerability="Template Engine Error Detected",
            severity="HIGH",
            location=f"{target}/render?template=test",
            evidence="Template error 'TemplateSyntaxError' triggered by polyglot payload",
            category=CATEGORY,
            raw_details={
                "parameter": "template",
                "payload": "${{<%[%'\"}}%\\.",
                "error_pattern": "TemplateSyntaxError",
                "technique": "error-based",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan - Server-Side Template Injection Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode ----
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan ----
    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []
    all_waf_responses: List = []
    waf_detected = False
    active_payloads = SSTI_PAYLOADS

    # Step 1: Crawl same-domain pages (depth 1)
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
            depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    # Step 2: Iterate over discovered pages
    for page_url in pages:
        if waf_detected:
            # Continue with reduced payloads rather than stopping entirely
            active_payloads = SSTI_PAYLOADS_REDUCED

        # Fetch page HTML for form extraction
        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        page_html = resp.text if resp else ""

        # 2a: Test URL parameters
        param_findings, param_waf = test_url_params(
            session, page_url, delay, timeout, active_payloads,
        )
        findings.extend(param_findings)
        all_waf_responses.extend(param_waf)

        # Check WAF status after parameter testing
        if not waf_detected and detect_waf(all_waf_responses):
            waf_detected = True
            active_payloads = SSTI_PAYLOADS_REDUCED
            findings.append(make_finding(
                vulnerability="Web Application Firewall Detected",
                severity="INFO",
                location=target,
                evidence=(
                    "Over 50% of injection probe responses returned "
                    "403/429/406 status codes, indicating a WAF is active. "
                    "Continuing with reduced payload set."
                ),
                category=CATEGORY,
                raw_details={
                    "technique": "waf-detection",
                    "blocked_ratio": round(
                        sum(1 for r in all_waf_responses if r and r.status_code in (403, 429, 406))
                        / max(len([r for r in all_waf_responses if r]), 1),
                        2,
                    ),
                    "total_probes": len(all_waf_responses),
                },
            ))

        # 2b: Test forms
        if page_html:
            form_findings, form_waf = test_forms(
                session, page_url, page_html, delay, timeout, active_payloads,
            )
            findings.extend(form_findings)
            all_waf_responses.extend(form_waf)

            # Re-check WAF after form testing
            if not waf_detected and detect_waf(all_waf_responses):
                waf_detected = True
                active_payloads = SSTI_PAYLOADS_REDUCED
                findings.append(make_finding(
                    vulnerability="Web Application Firewall Detected",
                    severity="INFO",
                    location=target,
                    evidence=(
                        "WAF detected after form testing — majority of responses "
                        "were 403/429/406. Continuing with reduced payload set."
                    ),
                    category=CATEGORY,
                    raw_details={"technique": "waf-detection"},
                ))

    # Deduplicate findings by (vulnerability, location) to keep reports clean
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
