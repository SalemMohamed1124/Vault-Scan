#!/usr/bin/env python3
"""
VaultScan — CSRF (Cross-Site Request Forgery) Detection Scanner (Production)
==============================================================================
Enhanced CSRF detection with:

1. **Token presence check** — scans POST forms for anti-CSRF tokens
2. **Token validation verification** — submits forms with modified/missing tokens
   to verify the server actually enforces them
3. **SameSite cookie analysis** — checks all session cookies for SameSite attribute
4. **Origin/Referer header enforcement** — tests if server validates Origin header
5. **Custom CSRF header detection** — finds AJAX-based CSRF patterns
6. **Content-Type based bypass** — tests if JSON endpoints accept form data

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse

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
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "CSRF"
MAX_CRAWL_PAGES = 5

CSRF_TOKEN_NAMES = {
    "csrf", "_csrf", "csrf_token", "csrfmiddlewaretoken", "_token",
    "authenticity_token", "__requestverificationtoken", "token",
    "_csrftoken", "xsrf-token", "anti-csrf-token", "__csrf_magic",
    "nonce", "csrf-token", "_csrf_token", "csrftoken", "formtoken",
    "security_token", "request_token", "form_token", "verify_token",
}

STATE_CHANGING_KEYWORDS = {
    "password", "settings", "profile", "delete", "update", "edit",
    "admin", "account", "transfer", "payment", "checkout", "create",
    "remove", "change", "modify", "submit", "post", "save", "upload",
    "invite", "revoke", "disable", "enable", "subscribe", "unsubscribe",
}

SESSION_COOKIE_PATTERNS = [
    re.compile(r"sess", re.IGNORECASE),
    re.compile(r"sid", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"auth", re.IGNORECASE),
    re.compile(r"jwt", re.IGNORECASE),
    re.compile(r"csrf", re.IGNORECASE),
    re.compile(r"login", re.IGNORECASE),
    re.compile(r"remember", re.IGNORECASE),
    re.compile(r"connect\.sid", re.IGNORECASE),
    re.compile(r"phpsessid", re.IGNORECASE),
    re.compile(r"jsessionid", re.IGNORECASE),
    re.compile(r"asp\.net_sessionid", re.IGNORECASE),
    re.compile(r"laravel_session", re.IGNORECASE),
    re.compile(r"_session", re.IGNORECASE),
]

CSRF_HEADER_PATTERNS = [
    re.compile(r"""['"]X-CSRF-Token['"]""", re.IGNORECASE),
    re.compile(r"""['"]X-XSRF-TOKEN['"]""", re.IGNORECASE),
    re.compile(r"""['"]X-Requested-With['"]""", re.IGNORECASE),
    re.compile(r"""['"]X-CSRFToken['"]""", re.IGNORECASE),
    re.compile(r"""csrf[_-]?header""", re.IGNORECASE),
    re.compile(r"""meta\s+name\s*=\s*['"]csrf""", re.IGNORECASE),
]


# ---------------------------------------------------------------------------
# Form CSRF Token Detection
# ---------------------------------------------------------------------------
def _form_has_csrf_token(form: Dict) -> Optional[Dict]:
    """Check for CSRF token; return token info if found, None otherwise."""
    for inp in form.get("inputs", []):
        if inp.get("type", "").lower() != "hidden":
            continue
        name = (inp.get("name") or "").lower()
        if name in CSRF_TOKEN_NAMES:
            return {"name": inp.get("name"), "value": inp.get("value", "")}
        for token_name in CSRF_TOKEN_NAMES:
            if token_name in name:
                return {"name": inp.get("name"), "value": inp.get("value", "")}
    return None


def _form_is_state_changing(form: Dict) -> bool:
    action_lower = (form.get("action") or "").lower()
    for keyword in STATE_CHANGING_KEYWORDS:
        if keyword in action_lower:
            return True
    for inp in form.get("inputs", []):
        if inp.get("type", "").lower() == "password":
            return True
    return False


# ---------------------------------------------------------------------------
# Token Validation Verification (NEW)
# ---------------------------------------------------------------------------
def verify_csrf_token_enforcement(
    session, form: Dict, page_url: str, token_info: Dict,
    delay: float, timeout: int
) -> List[Dict]:
    """
    Verify that the server actually validates the CSRF token.
    Tests: missing token, empty token, modified token.
    """
    findings: List[Dict] = []
    action = form.get("action", page_url)
    method = form.get("method", "POST").upper()

    if method != "POST":
        return findings

    # Build base form data
    form_data = {}
    for inp in form.get("inputs", []):
        name = inp.get("name", "")
        if name:
            form_data[name] = inp.get("value", "")

    token_name = token_info["name"]
    original_token = token_info["value"]

    # Test 1: Submit without token
    data_no_token = {k: v for k, v in form_data.items() if k != token_name}
    resp_no_token, err = rate_limited_request(
        session, "POST", action, delay=delay, timeout=timeout,
        data=data_no_token, allow_redirects=True,
    )

    # Test 2: Submit with modified token
    data_bad_token = form_data.copy()
    data_bad_token[token_name] = "INVALID_TOKEN_12345"
    resp_bad_token, err2 = rate_limited_request(
        session, "POST", action, delay=delay, timeout=timeout,
        data=data_bad_token, allow_redirects=True,
    )

    # Test 3: Submit with empty token
    data_empty_token = form_data.copy()
    data_empty_token[token_name] = ""
    resp_empty_token, err3 = rate_limited_request(
        session, "POST", action, delay=delay, timeout=timeout,
        data=data_empty_token, allow_redirects=True,
    )

    # Analyze results - if any modified request succeeds (200/302 without error)
    for test_name, resp in [
        ("missing token", resp_no_token),
        ("invalid token", resp_bad_token),
        ("empty token", resp_empty_token),
    ]:
        if resp is None:
            continue

        # Success indicators: 200 OK, or 302 redirect to non-error page
        is_accepted = False
        if resp.status_code in (200, 201):
            # Check body for error indicators
            body_lower = resp.text[:3000].lower()
            error_indicators = [
                "csrf", "token", "invalid", "expired", "forbidden",
                "403", "error", "denied", "verification failed",
            ]
            if not any(ind in body_lower for ind in error_indicators):
                is_accepted = True
        elif resp.status_code in (301, 302, 303, 307):
            # Redirect that's NOT to an error/login page
            location = resp.headers.get("Location", "").lower()
            if not any(err in location for err in ["error", "login", "403", "forbidden"]):
                is_accepted = True

        if is_accepted:
            is_state_changing = _form_is_state_changing(form)
            severity = "HIGH" if is_state_changing else "MEDIUM"
            findings.append(make_finding(
                vulnerability="CSRF Token Not Validated by Server",
                severity=severity,
                location=f"{page_url} -> {action}",
                evidence=(
                    f"Form has CSRF token '{token_name}' but server accepted "
                    f"request with {test_name} (HTTP {resp.status_code}). "
                    f"The token is not properly validated server-side."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "page_url": page_url,
                    "form_action": action,
                    "token_name": token_name,
                    "test_type": test_name,
                    "response_status": resp.status_code,
                    "state_changing": is_state_changing,
                },
            ))
            return findings  # One proof is enough

    return findings


# ---------------------------------------------------------------------------
# Origin/Referer Header Enforcement Check (NEW)
# ---------------------------------------------------------------------------
def check_origin_enforcement(
    session, form: Dict, page_url: str,
    delay: float, timeout: int
) -> List[Dict]:
    """Test if server validates Origin/Referer headers."""
    findings: List[Dict] = []
    action = form.get("action", page_url)
    method = form.get("method", "POST").upper()

    if method != "POST":
        return findings

    form_data = {}
    for inp in form.get("inputs", []):
        name = inp.get("name", "")
        if name:
            form_data[name] = inp.get("value", "")

    # Submit with a cross-origin Origin header
    resp, err = rate_limited_request(
        session, "POST", action, delay=delay, timeout=timeout,
        data=form_data,
        headers={
            "Origin": "https://evil-attacker.com",
            "Referer": "https://evil-attacker.com/csrf-attack",
        },
        allow_redirects=True,
    )

    if resp and resp.status_code in (200, 201, 301, 302, 303, 307):
        body_lower = resp.text[:3000].lower()
        error_indicators = ["csrf", "origin", "forbidden", "403", "denied", "cross-origin"]
        if not any(ind in body_lower for ind in error_indicators):
            findings.append(make_finding(
                vulnerability="No Origin Header Validation on POST Form",
                severity="MEDIUM",
                location=f"{page_url} -> {action}",
                evidence=(
                    f"Server accepted POST request with Origin: https://evil-attacker.com "
                    f"(HTTP {resp.status_code}). No cross-origin request validation detected."
                ),
                category=CATEGORY,
                confidence="MEDIUM",
                raw_details={
                    "page_url": page_url,
                    "form_action": action,
                    "test_origin": "https://evil-attacker.com",
                    "response_status": resp.status_code,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Content-Type Bypass Check (NEW)
# ---------------------------------------------------------------------------
def check_content_type_bypass(
    session, url: str, delay: float, timeout: int
) -> List[Dict]:
    """Test if JSON API endpoints accept form-encoded data (CSRF bypass)."""
    findings: List[Dict] = []

    # Try common API paths that might accept JSON
    api_paths = ["/api/user", "/api/settings", "/api/profile", "/api/account"]
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    for path in api_paths:
        api_url = f"{base}{path}"

        # First check if endpoint exists with JSON
        resp_json, _ = rate_limited_request(
            session, "POST", api_url, delay=delay, timeout=timeout,
            json={"test": "csrf_check"},
            headers={"Content-Type": "application/json"},
        )

        if not resp_json or resp_json.status_code in (404, 405):
            continue

        # Now try form-encoded (CSRF-exploitable)
        resp_form, _ = rate_limited_request(
            session, "POST", api_url, delay=delay, timeout=timeout,
            data={"test": "csrf_check"},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://evil-attacker.com",
            },
        )

        if resp_form and resp_form.status_code in (200, 201):
            findings.append(make_finding(
                vulnerability="JSON API Accepts Form-Encoded Data (CSRF Bypass)",
                severity="MEDIUM",
                location=api_url,
                evidence=(
                    f"API endpoint accepts application/x-www-form-urlencoded "
                    f"in addition to JSON. This allows CSRF attacks via HTML forms "
                    f"since browsers can submit form data cross-origin."
                ),
                category=CATEGORY,
                confidence="MEDIUM",
                raw_details={
                    "api_url": api_url,
                    "json_status": resp_json.status_code,
                    "form_status": resp_form.status_code,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# SameSite Cookie Check (Enhanced)
# ---------------------------------------------------------------------------
def check_samesite_cookies(
    session, url: str, timeout: int, delay: float,
) -> List[Dict]:
    findings: List[Dict] = []

    resp, err = rate_limited_request(session, "GET", url, delay=delay, timeout=timeout)
    if err or resp is None:
        return findings

    raw_cookies = resp.headers.get("Set-Cookie", "")
    if not raw_cookies:
        for cookie in resp.cookies:
            _check_single_cookie(cookie.name, cookie._rest, url, findings)
        return findings

    for header_val in resp.raw.headers.getlist("Set-Cookie") if hasattr(resp.raw, "headers") else [raw_cookies]:
        _parse_set_cookie_header(header_val, url, findings)

    return findings


def _is_session_cookie(name: str) -> bool:
    for pattern in SESSION_COOKIE_PATTERNS:
        if pattern.search(name):
            return True
    return False


def _check_single_cookie(name: str, attrs: dict, url: str, findings: List[Dict]) -> None:
    if not _is_session_cookie(name):
        return

    samesite = None
    for key in attrs:
        if key.lower() == "samesite":
            samesite = attrs[key]
            break

    if samesite is None or samesite.strip() == "":
        findings.append(make_finding(
            vulnerability="Session Cookie Missing SameSite Attribute",
            severity="LOW",
            location=url,
            evidence=(
                f"Cookie '{name}' appears session-related but does not set "
                f"the SameSite attribute. Without SameSite, the cookie may "
                f"be sent with cross-origin requests, enabling CSRF."
            ),
            category=CATEGORY,
            raw_details={"cookie_name": name, "samesite_value": None},
        ))
    elif samesite.strip().lower() == "none":
        findings.append(make_finding(
            vulnerability="Session Cookie SameSite=None (Cross-Origin Allowed)",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"Cookie '{name}' has SameSite=None, meaning it will be sent "
                f"with cross-origin requests. Combined with missing CSRF tokens, "
                f"this enables CSRF attacks."
            ),
            category=CATEGORY,
            raw_details={"cookie_name": name, "samesite_value": "None"},
        ))


def _parse_set_cookie_header(header: str, url: str, findings: List[Dict]) -> None:
    parts = [p.strip() for p in header.split(";")]
    if not parts:
        return

    name_value = parts[0]
    name = name_value.split("=", 1)[0].strip()
    if not _is_session_cookie(name):
        return

    has_samesite = False
    samesite_value = None
    for part in parts[1:]:
        part_lower = part.lower().strip()
        if part_lower.startswith("samesite"):
            has_samesite = True
            if "=" in part:
                samesite_value = part.split("=", 1)[1].strip().lower()
            break

    if not has_samesite:
        findings.append(make_finding(
            vulnerability="Session Cookie Missing SameSite Attribute",
            severity="LOW",
            location=url,
            evidence=(
                f"Cookie '{name}' appears session-related but does not set "
                f"the SameSite attribute."
            ),
            category=CATEGORY,
            raw_details={"cookie_name": name, "raw_header": header[:300]},
        ))
    elif samesite_value == "none":
        findings.append(make_finding(
            vulnerability="Session Cookie SameSite=None (Cross-Origin Allowed)",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"Cookie '{name}' has SameSite=None. Cross-origin requests "
                f"will include this cookie."
            ),
            category=CATEGORY,
            raw_details={"cookie_name": name, "samesite_value": "None"},
        ))


# ---------------------------------------------------------------------------
# Custom CSRF Header Detection
# ---------------------------------------------------------------------------
def check_custom_csrf_headers(page_html: str, url: str) -> List[Dict]:
    findings: List[Dict] = []
    detected_headers: List[str] = []

    for pattern in CSRF_HEADER_PATTERNS:
        matches = pattern.findall(page_html)
        if matches:
            detected_headers.extend(matches)

    if detected_headers:
        unique = list(dict.fromkeys(h.strip("'\"") for h in detected_headers))
        findings.append(make_finding(
            vulnerability="Custom CSRF Header Detected in AJAX Patterns",
            severity="INFO",
            location=url,
            evidence=(
                f"Page JavaScript or meta tags reference custom CSRF headers: "
                f"{', '.join(unique[:5])}. AJAX endpoints may "
                f"rely on custom headers for CSRF protection."
            ),
            category=CATEGORY,
            raw_details={"detected_patterns": unique[:10]},
        ))

    return findings


# ---------------------------------------------------------------------------
# Form CSRF Check (Enhanced)
# ---------------------------------------------------------------------------
def check_forms_for_csrf(
    session, page_url: str, page_html: str,
    delay: float, timeout: int,
) -> List[Dict]:
    findings: List[Dict] = []
    forms = extract_forms(page_url, page_html)

    for form in forms:
        method = form.get("method", "GET").upper()
        if method != "POST":
            continue

        token_info = _form_has_csrf_token(form)
        action = form.get("action", page_url)
        is_state_changing = _form_is_state_changing(form)

        if token_info:
            # Token present — verify it's actually enforced
            verification_findings = verify_csrf_token_enforcement(
                session, form, page_url, token_info, delay, timeout
            )
            findings.extend(verification_findings)
        else:
            # No token at all
            severity = "HIGH" if is_state_changing else "MEDIUM"
            input_names = [i.get("name", "") for i in form.get("inputs", [])]
            evidence_detail = (
                "State-changing form without CSRF token"
                if is_state_changing
                else "POST form without identifiable anti-CSRF token"
            )

            findings.append(make_finding(
                vulnerability="Missing CSRF Token on POST Form",
                severity=severity,
                location=f"{page_url} -> {action}",
                evidence=(
                    f"{evidence_detail}. "
                    f"Form action: {action}, inputs: {', '.join(input_names[:8])}"
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "page_url": page_url,
                    "form_action": action,
                    "form_method": method,
                    "input_names": input_names,
                    "state_changing": is_state_changing,
                },
            ))

            # Also check Origin header enforcement
            origin_findings = check_origin_enforcement(
                session, form, page_url, delay, timeout
            )
            findings.extend(origin_findings)

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Missing CSRF Token on POST Form",
            severity="HIGH",
            location=f"{target}/settings -> {target}/settings/update",
            evidence=(
                "State-changing form without CSRF token. "
                "Form action: /settings/update, inputs: email, password, submit"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "page_url": f"{target}/settings",
                "form_action": f"{target}/settings/update",
                "state_changing": True,
            },
        ),
        make_finding(
            vulnerability="CSRF Token Not Validated by Server",
            severity="HIGH",
            location=f"{target}/profile -> {target}/profile/update",
            evidence=(
                "Form has CSRF token 'csrf_token' but server accepted "
                "request with invalid token (HTTP 200). "
                "The token is not properly validated server-side."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "page_url": f"{target}/profile",
                "form_action": f"{target}/profile/update",
                "token_name": "csrf_token",
                "test_type": "invalid token",
                "response_status": 200,
            },
        ),
        make_finding(
            vulnerability="Session Cookie SameSite=None (Cross-Origin Allowed)",
            severity="MEDIUM",
            location=target,
            evidence=(
                "Cookie 'session_id' has SameSite=None. Cross-origin requests "
                "will include this cookie."
            ),
            category=CATEGORY,
            raw_details={"cookie_name": "session_id", "samesite_value": "None"},
        ),
        make_finding(
            vulnerability="Session Cookie Missing SameSite Attribute",
            severity="LOW",
            location=target,
            evidence=(
                "Cookie 'PHPSESSID' appears session-related but does not set "
                "the SameSite attribute."
            ),
            category=CATEGORY,
            raw_details={"cookie_name": "PHPSESSID", "samesite_value": None},
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — CSRF Detection Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return

    session = create_session(
        timeout=args.timeout,
        cookies=args.cookies,
        headers=args.headers,
    )
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []

    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Check SameSite cookies
    findings.extend(check_samesite_cookies(session, target, timeout, delay))

    # Check Content-Type bypass on API endpoints
    findings.extend(check_content_type_bypass(session, target, delay, timeout))

    # Crawl pages
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout,
            max_pages=MAX_CRAWL_PAGES, depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    if target not in pages:
        pages.insert(0, target)

    # Check each page
    tested_forms: set = set()

    for page_url in pages:
        if page_url == target:
            page_html = resp.text
        else:
            r, e = rate_limited_request(session, "GET", page_url, delay=delay, timeout=timeout)
            if e or r is None:
                continue
            page_html = r.text

        form_findings = check_forms_for_csrf(
            session, page_url, page_html, delay, timeout
        )
        for f in form_findings:
            dedup_key = (
                f.get("raw_details", {}).get("form_action", ""),
                f.get("vulnerability", ""),
            )
            if dedup_key not in tested_forms:
                tested_forms.add(dedup_key)
                findings.append(f)

        findings.extend(check_custom_csrf_headers(page_html, page_url))

    # Deduplicate
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
