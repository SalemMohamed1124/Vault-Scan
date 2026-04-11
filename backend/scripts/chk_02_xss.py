#!/usr/bin/env python3
"""
VaultScan — Comprehensive XSS (Cross-Site Scripting) Scanner
Detects reflected XSS, DOM-based XSS hints, and CSP weaknesses.
Tests URL parameters, form inputs, and crawled pages.
Outputs JSON array of findings to stdout.
"""

import html
import os
import re
import sys
import time
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urlparse, urljoin

# ---------------------------------------------------------------------------
# Ensure scan_utils is importable from the same directory
# ---------------------------------------------------------------------------
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
    detect_waf,
    is_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "XSS"
CANARY_PREFIX = "vs"
MAX_CRAWL_PAGES = 5
# Subset of payloads used when WAF is detected
WAF_SAFE_PAYLOAD_COUNT = 5

# ---------------------------------------------------------------------------
# Reflected XSS Payloads — organized by technique
# ---------------------------------------------------------------------------
REFLECTED_PAYLOADS: List[Dict[str, str]] = [
    # --- Basic script injection ---
    {"payload": "<script>alert(1)</script>", "type": "basic"},
    {"payload": "<script>confirm(1)</script>", "type": "basic"},
    {"payload": "<script>prompt(1)</script>", "type": "basic"},
    # --- Event-handler tags ---
    {"payload": "<img src=x onerror=alert(1)>", "type": "event"},
    {"payload": "<svg onload=alert(1)>", "type": "event"},
    {"payload": "<body onload=alert(1)>", "type": "event"},
    {"payload": "<input autofocus onfocus=alert(1)>", "type": "event"},
    {"payload": "<marquee onstart=alert(1)>", "type": "event"},
    {"payload": "<details open ontoggle=alert(1)>", "type": "event"},
    {"payload": "<video src=x onerror=alert(1)>", "type": "event"},
    {"payload": "<audio src=x onerror=alert(1)>", "type": "event"},
    # --- SVG / MathML ---
    {"payload": "<svg><script>alert(1)</script></svg>", "type": "svg"},
    {"payload": "<svg><animate onbegin=alert(1) attributeName=x>", "type": "svg"},
    {"payload": "<math><mi><xss>", "type": "mathml"},
    {"payload": "<svg/onload=alert(1)>", "type": "svg"},
    # --- Attribute injection (break out of quoted attributes) ---
    {"payload": '" autofocus onfocus="alert(1)', "type": "attr"},
    {"payload": "' autofocus onfocus='alert(1)", "type": "attr"},
    {"payload": '"><script>alert(1)</script>', "type": "attr"},
    {"payload": "'><script>alert(1)</script>", "type": "attr"},
    {"payload": '" onmouseover="alert(1)" "', "type": "attr"},
    # --- Polyglots ---
    {
        "payload": "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcliCk=alert() )//",
        "type": "polyglot",
    },
    {
        "payload": "\"><img src=x onerror=alert(1)>//",
        "type": "polyglot",
    },
    # --- Template injection ---
    {"payload": "{{constructor.constructor('alert(1)')()\u007d\u007d", "type": "template"},
    {"payload": "${alert(1)}", "type": "template"},
    {"payload": "#{alert(1)}", "type": "template"},
    # --- Encoding / filter bypass ---
    {"payload": "<scr<script>ipt>alert(1)</scr</script>ipt>", "type": "bypass"},
    {"payload": "<ScRiPt>alert(1)</ScRiPt>", "type": "bypass"},
    {"payload": "<img/src=x onerror=alert(1)>", "type": "bypass"},
    {"payload": "<iframe src=\"javascript:alert(1)\">", "type": "bypass"},
]

# ---------------------------------------------------------------------------
# DOM-Based XSS Patterns
# ---------------------------------------------------------------------------
DOM_SINKS: List[str] = [
    r"document\.write\s*\(",
    r"document\.writeln\s*\(",
    r"\.innerHTML\s*=",
    r"\.outerHTML\s*=",
    r"\.insertAdjacentHTML\s*\(",
    r"eval\s*\(",
    r"setTimeout\s*\(\s*['\"]",
    r"setTimeout\s*\(\s*[a-zA-Z]",
    r"setInterval\s*\(\s*['\"]",
    r"setInterval\s*\(\s*[a-zA-Z]",
    r"new\s+Function\s*\(",
    r"location\.href\s*=",
    r"location\.assign\s*\(",
    r"location\.replace\s*\(",
    r"window\.open\s*\(",
    r"\.src\s*=",
]

DOM_SOURCES: List[str] = [
    r"document\.URL",
    r"document\.documentURI",
    r"document\.referrer",
    r"location\.search",
    r"location\.hash",
    r"location\.href",
    r"location\.pathname",
    r"window\.name",
    r"document\.cookie",
    r"history\.pushState",
    r"history\.replaceState",
    r"localStorage\.",
    r"sessionStorage\.",
]


# ---------------------------------------------------------------------------
# Helper: generate unique canary per parameter
# ---------------------------------------------------------------------------
def _make_canary(param: str) -> str:
    """Generate a short, unique canary string unlikely to appear naturally."""
    digest = hashlib.md5(param.encode()).hexdigest()[:6]
    return f"{CANARY_PREFIX}{digest}"


# ---------------------------------------------------------------------------
# Context detection
# ---------------------------------------------------------------------------
def detect_reflection_context(response_text: str, canary: str) -> Optional[str]:
    """
    Determine where a canary string is reflected in the HTML.
    Returns one of: 'html_body', 'attr_value', 'script_block',
    'html_comment', or None if not reflected.
    """
    if canary not in response_text:
        return None

    idx = response_text.find(canary)
    # Grab surrounding context (up to 200 chars before)
    prefix = response_text[max(0, idx - 200):idx]

    # Inside an HTML comment
    if "<!--" in prefix and "-->" not in prefix.split("<!--")[-1]:
        return "html_comment"

    # Inside a <script> block
    script_open = prefix.rfind("<script")
    script_close = prefix.rfind("</script")
    if script_open != -1 and (script_close == -1 or script_close < script_open):
        return "script_block"

    # Inside an attribute value — look for an unclosed quote after the last '<'
    tag_open = prefix.rfind("<")
    if tag_open != -1:
        tag_fragment = prefix[tag_open:]
        # Count quotes to determine if we are inside an attribute
        dq = tag_fragment.count('"')
        sq = tag_fragment.count("'")
        # Odd count means we are inside a quoted attribute
        if dq % 2 == 1 or sq % 2 == 1:
            return "attr_value"
        # Check for unquoted attribute context (e.g., value=CANARY)
        if re.search(r'=\s*$', tag_fragment) or re.search(r'=\s*[^\s"\'<>]*$', tag_fragment):
            return "attr_value"

    return "html_body"


def _payloads_for_context(context: Optional[str]) -> List[Dict[str, str]]:
    """Select the most effective payloads for a given reflection context."""
    if context == "attr_value":
        # Prioritise attribute-breakout payloads
        priority = ("attr", "polyglot", "event")
    elif context == "script_block":
        # Need to close script or inject expressions
        priority = ("basic", "template", "bypass")
    elif context == "html_comment":
        # Need to close comment first — polyglots are best bet
        priority = ("polyglot", "basic", "event")
    else:
        # html_body or unknown — try everything, events first
        priority = ("event", "basic", "svg", "attr", "polyglot", "template", "bypass")

    ordered: List[Dict[str, str]] = []
    seen = set()
    for ptype in priority:
        for p in REFLECTED_PAYLOADS:
            if p["type"] == ptype and p["payload"] not in seen:
                ordered.append(p)
                seen.add(p["payload"])
    # Append any remaining
    for p in REFLECTED_PAYLOADS:
        if p["payload"] not in seen:
            ordered.append(p)
            seen.add(p["payload"])
    return ordered


# ---------------------------------------------------------------------------
# Reflected XSS testing
# ---------------------------------------------------------------------------
def test_reflected_xss(
    session,
    url: str,
    param: str,
    value: str,
    delay: float,
    timeout: int,
    waf_detected: bool = False,
) -> List[Dict]:
    """
    Inject payloads into a single URL parameter and check for reflection.
    Returns list of findings.
    """
    findings: List[Dict] = []

    # Step 1 — send a canary to detect reflection context
    canary = _make_canary(param)
    canary_url = replace_url_param(url, param, canary)
    resp, err = rate_limited_request(session, "GET", canary_url, delay=delay, timeout=timeout)
    if err or resp is None:
        return findings

    context = detect_reflection_context(resp.text, canary)
    if context is None:
        # Parameter not reflected at all — skip heavy testing
        return findings

    # Step 2 — choose payloads based on context
    payloads = _payloads_for_context(context)
    if waf_detected:
        payloads = payloads[:WAF_SAFE_PAYLOAD_COUNT]

    for pdef in payloads:
        payload = pdef["payload"]
        test_url = replace_url_param(url, param, payload)
        r, e = rate_limited_request(session, "GET", test_url, delay=delay, timeout=timeout)
        if e or r is None:
            continue

        body = r.text

        # Unencoded reflection — HIGH
        if payload in body:
            findings.append(make_finding(
                vulnerability="Reflected XSS Detected",
                severity="HIGH",
                location=url,
                evidence=(
                    f"Payload reflected unencoded in parameter '{param}' "
                    f"(context: {context}): {payload}"
                ),
                category=CATEGORY,
                raw_details={
                    "parameter": param,
                    "payload": payload,
                    "payload_type": pdef["type"],
                    "reflection_type": "unencoded",
                    "context": context,
                    "test_url": test_url,
                },
            ))
            # One confirmed HIGH per parameter is sufficient
            return findings

        # HTML-encoded but inside an attribute context — MEDIUM
        encoded = html.escape(payload, quote=True)
        if context == "attr_value" and encoded in body:
            findings.append(make_finding(
                vulnerability="Potential XSS — Encoded Reflection in Attribute",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Payload HTML-encoded but reflected inside attribute "
                    f"for parameter '{param}': {payload}"
                ),
                category=CATEGORY,
                raw_details={
                    "parameter": param,
                    "payload": payload,
                    "payload_type": pdef["type"],
                    "reflection_type": "encoded_in_attribute",
                    "context": context,
                },
            ))
            return findings

    return findings


# ---------------------------------------------------------------------------
# DOM-Based XSS analysis
# ---------------------------------------------------------------------------
def test_dom_xss(page_html: str, url: str) -> List[Dict]:
    """
    Analyse page JavaScript for dangerous source-to-sink patterns.
    Returns DOM-XSS hint findings.
    """
    findings: List[Dict] = []

    # Extract all inline <script> content and on* attribute values
    js_content = ""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(page_html, "html.parser")
        for script in soup.find_all("script"):
            if script.string:
                js_content += script.string + "\n"
        # Also check event-handler attributes
        for tag in soup.find_all(True):
            for attr_name, attr_val in tag.attrs.items():
                if attr_name.startswith("on") and isinstance(attr_val, str):
                    js_content += attr_val + "\n"
    except Exception:
        # Fallback: regex extraction
        js_content = "\n".join(re.findall(
            r"<script[^>]*>(.*?)</script>", page_html, re.DOTALL | re.IGNORECASE
        ))

    if not js_content.strip():
        return findings

    # Find which sinks and sources are present
    found_sinks: List[str] = []
    for pattern in DOM_SINKS:
        matches = re.findall(pattern, js_content)
        if matches:
            # Store the human-readable version
            found_sinks.append(pattern.replace(r"\s*\(", "(").replace("\\.", ".").replace("\\s*=", " ="))

    found_sources: List[str] = []
    for pattern in DOM_SOURCES:
        if re.search(pattern, js_content):
            found_sources.append(pattern.replace("\\.", "."))

    # Only flag if both a source and sink are present on the same page
    if found_sources and found_sinks:
        findings.append(make_finding(
            vulnerability="Potential DOM-Based XSS",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"JavaScript contains user-controllable sources "
                f"({', '.join(found_sources[:3])}) and dangerous sinks "
                f"({', '.join(found_sinks[:3])}). Manual review recommended."
            ),
            category=CATEGORY,
            raw_details={
                "sources": found_sources,
                "sinks": found_sinks,
                "note": "Presence of both source and sink patterns suggests "
                        "possible DOM-XSS. Requires manual verification.",
            },
        ))
    elif found_sinks:
        # Sinks without obvious user-controllable sources — informational
        findings.append(make_finding(
            vulnerability="DOM XSS Sink Detected",
            severity="LOW",
            location=url,
            evidence=(
                f"JavaScript uses dangerous sinks ({', '.join(found_sinks[:3])}) "
                f"but no obvious taint sources were detected inline. "
                f"External scripts may still introduce risk."
            ),
            category=CATEGORY,
            raw_details={
                "sinks": found_sinks,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# CSP Analysis
# ---------------------------------------------------------------------------
def analyze_csp(headers: Dict[str, str], url: str) -> List[Dict]:
    """
    Parse Content-Security-Policy header for XSS-relevant weaknesses.
    """
    findings: List[Dict] = []

    # Normalise header lookup (case-insensitive)
    csp_value = None
    for h, v in headers.items():
        if h.lower() == "content-security-policy":
            csp_value = v
            break

    if csp_value is None:
        findings.append(make_finding(
            vulnerability="No Content-Security-Policy Header",
            severity="LOW",
            location=url,
            evidence=(
                "The server does not set a Content-Security-Policy header. "
                "CSP is a critical defence-in-depth mechanism against XSS."
            ),
            category=CATEGORY,
            raw_details={"header": "Content-Security-Policy", "status": "missing"},
        ))
        return findings

    directives = _parse_csp(csp_value)

    # Check script-src (or default-src as fallback)
    script_src = directives.get("script-src", directives.get("default-src", ""))

    if "'unsafe-inline'" in script_src:
        findings.append(make_finding(
            vulnerability="CSP Allows unsafe-inline Scripts",
            severity="MEDIUM",
            location=url,
            evidence=(
                "Content-Security-Policy script-src includes 'unsafe-inline', "
                "which significantly weakens XSS protection."
            ),
            category=CATEGORY,
            raw_details={
                "directive": "script-src",
                "issue": "unsafe-inline",
                "csp": csp_value,
            },
        ))

    if "'unsafe-eval'" in script_src:
        findings.append(make_finding(
            vulnerability="CSP Allows unsafe-eval Scripts",
            severity="MEDIUM",
            location=url,
            evidence=(
                "Content-Security-Policy script-src includes 'unsafe-eval', "
                "which allows eval() and similar dynamic code execution."
            ),
            category=CATEGORY,
            raw_details={
                "directive": "script-src",
                "issue": "unsafe-eval",
                "csp": csp_value,
            },
        ))

    # Wildcard in script-src
    if "*" in script_src.split():
        findings.append(make_finding(
            vulnerability="CSP script-src Contains Wildcard",
            severity="MEDIUM",
            location=url,
            evidence=(
                "Content-Security-Policy script-src contains a wildcard (*), "
                "allowing scripts from any origin."
            ),
            category=CATEGORY,
            raw_details={
                "directive": "script-src",
                "issue": "wildcard",
                "csp": csp_value,
            },
        ))

    return findings


def _parse_csp(csp_header: str) -> Dict[str, str]:
    """Parse CSP header into a dict of directive -> value."""
    directives: Dict[str, str] = {}
    for part in csp_header.split(";"):
        part = part.strip()
        if not part:
            continue
        tokens = part.split(None, 1)
        name = tokens[0].lower()
        value = tokens[1] if len(tokens) > 1 else ""
        directives[name] = value
    return directives


# ---------------------------------------------------------------------------
# URL parameter testing (orchestrator for a single page)
# ---------------------------------------------------------------------------
def test_url_params(
    session,
    url: str,
    delay: float,
    timeout: int,
    waf_detected: bool = False,
) -> List[Dict]:
    """Test all query-string parameters of a URL for reflected XSS."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    for param, values in params.items():
        original_value = values[0] if values else ""
        results = test_reflected_xss(
            session, url, param, original_value, delay, timeout, waf_detected
        )
        findings.extend(results)

    return findings


# ---------------------------------------------------------------------------
# Form testing
# ---------------------------------------------------------------------------
def test_forms(
    session,
    url: str,
    page_html: str,
    delay: float,
    timeout: int,
    waf_detected: bool = False,
) -> List[Dict]:
    """Test text-like form inputs for reflected XSS."""
    findings: List[Dict] = []
    forms = extract_forms(url, page_html)

    testable_types = {"text", "search", "url", "email", "tel", "textarea", "hidden"}

    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        inputs = form.get("inputs", [])

        # Identify text inputs to test
        text_inputs = [i for i in inputs if i.get("type", "text") in testable_types]
        if not text_inputs:
            continue

        for target_input in text_inputs:
            target_name = target_input["name"]

            # Build baseline form data
            form_data = {}
            for inp in inputs:
                if inp["name"] == target_name:
                    continue
                form_data[inp["name"]] = inp.get("value", "") or "test"

            # First send canary to detect reflection
            canary = _make_canary(target_name)
            test_data = dict(form_data)
            test_data[target_name] = canary

            if method == "POST":
                resp, err = rate_limited_request(
                    session, "POST", action, delay=delay, timeout=timeout, data=test_data
                )
            else:
                resp, err = rate_limited_request(
                    session, "GET", action, delay=delay, timeout=timeout, params=test_data
                )

            if err or resp is None:
                continue

            context = detect_reflection_context(resp.text, canary)
            if context is None:
                continue  # Not reflected

            # Now test payloads
            payloads = _payloads_for_context(context)
            if waf_detected:
                payloads = payloads[:WAF_SAFE_PAYLOAD_COUNT]

            found = False
            for pdef in payloads:
                payload = pdef["payload"]
                test_data = dict(form_data)
                test_data[target_name] = payload

                if method == "POST":
                    r, e = rate_limited_request(
                        session, "POST", action, delay=delay, timeout=timeout, data=test_data
                    )
                else:
                    r, e = rate_limited_request(
                        session, "GET", action, delay=delay, timeout=timeout, params=test_data
                    )

                if e or r is None:
                    continue

                body = r.text

                if payload in body:
                    findings.append(make_finding(
                        vulnerability="Reflected XSS in Form Input",
                        severity="HIGH",
                        location=action,
                        evidence=(
                            f"Payload reflected unencoded in form field '{target_name}' "
                            f"(method: {method}, context: {context}): {payload}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "form_action": action,
                            "form_method": method,
                            "parameter": target_name,
                            "payload": payload,
                            "payload_type": pdef["type"],
                            "reflection_type": "unencoded",
                            "context": context,
                        },
                    ))
                    found = True
                    break

                encoded = html.escape(payload, quote=True)
                if context == "attr_value" and encoded in body:
                    findings.append(make_finding(
                        vulnerability="Potential XSS — Encoded Reflection in Form",
                        severity="MEDIUM",
                        location=action,
                        evidence=(
                            f"Payload HTML-encoded but reflected inside attribute "
                            f"for form field '{target_name}': {payload}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "form_action": action,
                            "form_method": method,
                            "parameter": target_name,
                            "payload": payload,
                            "reflection_type": "encoded_in_attribute",
                            "context": context,
                        },
                    ))
                    found = True
                    break

            if found:
                continue  # Move to next input

    return findings


# ---------------------------------------------------------------------------
# Mock findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="Reflected XSS Detected",
            severity="HIGH",
            location=f"{target}/search?q=test",
            evidence=(
                "Payload reflected unencoded in parameter 'q' "
                "(context: html_body): <script>alert(1)</script>"
            ),
            category=CATEGORY,
            raw_details={
                "parameter": "q",
                "payload": "<script>alert(1)</script>",
                "payload_type": "basic",
                "reflection_type": "unencoded",
                "context": "html_body",
            },
        ),
        make_finding(
            vulnerability="Reflected XSS in Form Input",
            severity="HIGH",
            location=f"{target}/contact",
            evidence=(
                "Payload reflected unencoded in form field 'name' "
                "(method: POST, context: attr_value): \" autofocus onfocus=\"alert(1)"
            ),
            category=CATEGORY,
            raw_details={
                "form_action": f"{target}/contact",
                "form_method": "POST",
                "parameter": "name",
                "payload": "\" autofocus onfocus=\"alert(1)",
                "payload_type": "attr",
                "reflection_type": "unencoded",
                "context": "attr_value",
            },
        ),
        make_finding(
            vulnerability="Potential DOM-Based XSS",
            severity="MEDIUM",
            location=f"{target}/dashboard",
            evidence=(
                "JavaScript contains user-controllable sources "
                "(location.hash, document.referrer) and dangerous sinks "
                "(document.write(, .innerHTML =). Manual review recommended."
            ),
            category=CATEGORY,
            raw_details={
                "sources": ["location.hash", "document.referrer"],
                "sinks": ["document.write(", ".innerHTML ="],
            },
        ),
        make_finding(
            vulnerability="CSP Allows unsafe-inline Scripts",
            severity="MEDIUM",
            location=target,
            evidence=(
                "Content-Security-Policy script-src includes 'unsafe-inline', "
                "which significantly weakens XSS protection."
            ),
            category=CATEGORY,
            raw_details={
                "directive": "script-src",
                "issue": "unsafe-inline",
                "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'",
            },
        ),
        make_finding(
            vulnerability="Potential XSS — Encoded Reflection in Attribute",
            severity="MEDIUM",
            location=f"{target}/profile?user=admin",
            evidence=(
                "Payload HTML-encoded but reflected inside attribute "
                "for parameter 'user': ' autofocus onfocus='alert(1)"
            ),
            category=CATEGORY,
            raw_details={
                "parameter": "user",
                "payload": "' autofocus onfocus='alert(1)",
                "payload_type": "attr",
                "reflection_type": "encoded_in_attribute",
                "context": "attr_value",
            },
        ),
        make_finding(
            vulnerability="No Content-Security-Policy Header",
            severity="LOW",
            location=f"{target}/login",
            evidence=(
                "The server does not set a Content-Security-Policy header. "
                "CSP is a critical defence-in-depth mechanism against XSS."
            ),
            category=CATEGORY,
            raw_details={"header": "Content-Security-Policy", "status": "missing"},
        ),
    ]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Comprehensive XSS Scanner")
    args = parser.parse_args()

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        target = normalize_url(args.target)
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    target = normalize_url(args.target)
    delay = args.delay
    timeout = args.timeout
    session = create_session(timeout=timeout, cookies=args.cookies, headers=args.headers)
    findings: List[Dict] = []
    waf_responses: List = []

    # --- Initial fetch -----------------------------------------------------
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    initial_html = resp.text
    initial_headers = dict(resp.headers)

    # --- CSP analysis on the landing page ----------------------------------
    findings.extend(analyze_csp(initial_headers, target))

    # --- DOM-XSS analysis on the landing page ------------------------------
    findings.extend(test_dom_xss(initial_html, target))

    # --- Crawl to discover more pages (limited for speed) -------------------
    pages = crawl_same_domain(
        target, session, delay=0.05, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
        depth=1,
    )

    # Ensure the target itself is included
    if target not in pages:
        pages.insert(0, target)

    # --- WAF probe (use a small sample of aggressive payloads) -------------
    probe_param = "_vsprobe"
    probe_responses = []
    for payload_def in REFLECTED_PAYLOADS[:3]:
        probe_url = f"{target}?{probe_param}={payload_def['payload']}"
        r, _ = rate_limited_request(session, "GET", probe_url, delay=delay, timeout=timeout)
        probe_responses.append(r)

    waf_detected = detect_waf(probe_responses)
    if waf_detected:
        findings.append(make_finding(
            vulnerability="Web Application Firewall Detected",
            severity="INFO",
            location=target,
            evidence=(
                "A WAF or input filter is blocking XSS payloads. "
                "Scan will continue with reduced payload set to avoid blocking."
            ),
            category=CATEGORY,
            raw_details={"waf_detected": True},
        ))

    # --- Test each discovered page -----------------------------------------
    tested_params: set = set()
    tested_forms: set = set()

    for page_url in pages:
        # Fetch page if not the initial one
        if page_url == target:
            page_html = initial_html
            page_headers = initial_headers
        else:
            r, e = rate_limited_request(session, "GET", page_url, delay=delay, timeout=timeout)
            if e or r is None:
                continue
            page_html = r.text
            page_headers = dict(r.headers)

            # CSP might differ per page
            findings.extend(analyze_csp(page_headers, page_url))

            # DOM-XSS on each page
            findings.extend(test_dom_xss(page_html, page_url))

        # --- Test URL parameters -------------------------------------------
        params = extract_url_params(page_url)
        if params:
            param_key = f"{urlparse(page_url).path}:{','.join(sorted(params.keys()))}"
            if param_key not in tested_params:
                tested_params.add(param_key)
                findings.extend(test_url_params(
                    session, page_url, delay, timeout, waf_detected
                ))

        # --- Test forms ----------------------------------------------------
        forms = extract_forms(page_url, page_html)
        for form in forms:
            form_key = f"{form.get('action', '')}:{form.get('method', '')}".lower()
            if form_key not in tested_forms:
                tested_forms.add(form_key)

        # Run form tests for the entire page (dedup handled inside test_forms)
        findings.extend(test_forms(
            session, page_url, page_html, delay, timeout, waf_detected
        ))

    # --- Deduplicate findings ----------------------------------------------
    findings = _deduplicate(findings)

    output_findings(findings)


def _deduplicate(findings: List[Dict]) -> List[Dict]:
    """Remove duplicate findings based on vulnerability + location + evidence key."""
    seen: set = set()
    unique: List[Dict] = []
    for f in findings:
        key = (
            f.get("vulnerability", ""),
            f.get("location", ""),
            f.get("severity", ""),
            # Use param/payload from raw_details if present for finer dedup
            f.get("raw_details", {}).get("parameter", ""),
            f.get("raw_details", {}).get("issue", ""),
        )
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


if __name__ == "__main__":
    main()
