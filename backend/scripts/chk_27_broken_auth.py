#!/usr/bin/env python3
"""
VaultScan — Broken Authentication Scanner
============================================
Comprehensive broken authentication analysis that checks:
  1. Find login pages by testing common paths
  2. Test default credentials on found login forms
  3. Check for username enumeration (different responses for valid vs invalid users)
  4. Check password policy by analyzing registration/change-password forms
  5. Check session fixation (does session ID change after login?)
  6. Check for account lockout (multiple failed attempts)
  7. Check logout functionality (does session get invalidated?)
  8. Check if login page is served over HTTP (not HTTPS)
  9. Check for auto-complete enabled on password fields
  10. Check for remember-me functionality without secure cookies

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin

# ---------------------------------------------------------------------------
# Ensure scan_utils is importable from the same directory
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    is_mock_mode,
    output_findings,
    base_argparser,
    normalize_url,
    create_session,
    safe_request,
    make_finding,
)

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "BROKEN_AUTH"

LOGIN_PATHS = [
    "/login",
    "/signin",
    "/auth",
    "/admin",
    "/user/login",
    "/api/login",
    "/api/auth/login",
    "/account/login",
]

DEFAULT_CREDENTIALS = [
    ("admin", "admin"),
    ("admin", "password"),
    ("admin", "123456"),
    ("root", "root"),
    ("test", "test"),
    ("user", "user"),
    ("guest", "guest"),
]

REGISTRATION_PATHS = [
    "/register",
    "/signup",
    "/account/register",
    "/user/register",
    "/api/register",
    "/api/auth/register",
]

CHANGE_PASSWORD_PATHS = [
    "/change-password",
    "/password/change",
    "/account/password",
    "/user/password",
    "/settings/password",
    "/api/auth/change-password",
]

LOGOUT_PATHS = [
    "/logout",
    "/signout",
    "/auth/logout",
    "/api/logout",
    "/api/auth/logout",
    "/account/logout",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_html(html: str):
    """Parse HTML with BeautifulSoup if available, else return None."""
    if BeautifulSoup is None:
        return None
    try:
        return BeautifulSoup(html, "html.parser")
    except Exception:
        return None


def _find_login_pages(
    session, target: str, timeout: int, delay: float
) -> List[Dict]:
    """
    Probe common login paths and return a list of dicts with info about
    each discovered login page: {url, status, html, has_form}.
    """
    found = []
    for path in LOGIN_PATHS:
        url = target.rstrip("/") + path
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        time.sleep(delay)
        if err or resp is None:
            continue
        if resp.status_code in (200, 301, 302, 303, 307, 308):
            html = resp.text or ""
            has_form = _has_login_form(html)
            found.append({
                "url": url,
                "path": path,
                "status": resp.status_code,
                "html": html,
                "has_form": has_form,
                "response": resp,
            })
    return found


def _has_login_form(html: str) -> bool:
    """Check if HTML contains a login form (password input field)."""
    soup = _parse_html(html)
    if soup:
        password_inputs = soup.find_all("input", attrs={"type": "password"})
        if password_inputs:
            return True
    # Fallback regex
    if re.search(r'<input[^>]*type=["\']password["\']', html, re.I):
        return True
    return False


def _extract_login_form_details(html: str, page_url: str) -> Optional[Dict]:
    """
    Extract login form details: action URL, method, field names.
    Returns None if no login form found.
    """
    soup = _parse_html(html)
    if not soup:
        # Fallback: try regex-based extraction
        return _extract_login_form_regex(html, page_url)

    # Find forms containing a password field
    for form in soup.find_all("form"):
        password_field = form.find("input", attrs={"type": "password"})
        if not password_field:
            continue

        action = form.get("action", "")
        if action:
            action = urljoin(page_url, action)
        else:
            action = page_url

        method = form.get("method", "POST").upper()

        # Find username/email field
        username_field = None
        for inp in form.find_all("input"):
            inp_type = (inp.get("type") or "text").lower()
            inp_name = inp.get("name", "")
            if inp_type in ("text", "email") and inp_name:
                username_field = inp_name
                break

        # If no text/email field found, look for common name patterns
        if not username_field:
            for inp in form.find_all("input"):
                inp_name = (inp.get("name") or "").lower()
                if any(kw in inp_name for kw in
                       ["user", "email", "login", "name", "account", "id"]):
                    username_field = inp.get("name")
                    break

        password_name = password_field.get("name", "password")

        # Collect hidden fields (CSRF tokens, etc.)
        hidden_fields = {}
        for inp in form.find_all("input", attrs={"type": "hidden"}):
            name = inp.get("name")
            value = inp.get("value", "")
            if name:
                hidden_fields[name] = value

        return {
            "action": action,
            "method": method,
            "username_field": username_field or "username",
            "password_field": password_name,
            "hidden_fields": hidden_fields,
        }

    return None


def _extract_login_form_regex(html: str, page_url: str) -> Optional[Dict]:
    """Fallback regex-based login form extraction."""
    # Look for password input
    pw_match = re.search(
        r'<input[^>]*name=["\']([^"\']+)["\'][^>]*type=["\']password["\']',
        html, re.I
    )
    if not pw_match:
        pw_match = re.search(
            r'<input[^>]*type=["\']password["\'][^>]*name=["\']([^"\']+)["\']',
            html, re.I
        )
    if not pw_match:
        return None

    password_field = pw_match.group(1)

    # Find username field
    username_field = "username"
    user_match = re.search(
        r'<input[^>]*name=["\']([^"\']*(?:user|email|login|name|account)[^"\']*)["\']',
        html, re.I
    )
    if user_match:
        username_field = user_match.group(1)

    # Find form action
    action = page_url
    action_match = re.search(
        r'<form[^>]*action=["\']([^"\']+)["\']', html, re.I
    )
    if action_match:
        action = urljoin(page_url, action_match.group(1))

    return {
        "action": action,
        "method": "POST",
        "username_field": username_field,
        "password_field": password_field,
        "hidden_fields": {},
    }


def _get_session_cookies(resp) -> Dict[str, str]:
    """Extract session-related cookies from a response."""
    cookies = {}
    if resp is None:
        return cookies
    for cookie in resp.cookies:
        cookies[cookie.name] = cookie.value
    return cookies


# ---------------------------------------------------------------------------
# Check 1: Find login pages (used by other checks)
# ---------------------------------------------------------------------------
# (Integrated into _find_login_pages above)


# ---------------------------------------------------------------------------
# Check 2: Test default credentials
# ---------------------------------------------------------------------------
def check_default_credentials(
    session, login_pages: List[Dict], timeout: int, delay: float
) -> List[Dict]:
    """Test default credential pairs on discovered login forms."""
    findings = []

    for page in login_pages:
        if not page["has_form"]:
            continue

        form = _extract_login_form_details(page["html"], page["url"])
        if not form:
            continue

        for username, password in DEFAULT_CREDENTIALS:
            time.sleep(delay)

            data = dict(form["hidden_fields"])
            data[form["username_field"]] = username
            data[form["password_field"]] = password

            resp, err = safe_request(
                session, form["method"], form["action"],
                timeout=timeout, data=data, allow_redirects=False,
            )
            if err or resp is None:
                continue

            # Indicators of successful login:
            # - 302/303 redirect (common post-login)
            # - response sets new session cookies
            # - response body contains dashboard/welcome indicators
            # - no error message in the response
            login_success = False
            evidence_detail = ""

            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location", "").lower()
                # Redirect to something other than login page itself
                if not any(kw in location for kw in
                           ["login", "signin", "auth", "error", "fail"]):
                    login_success = True
                    evidence_detail = (
                        f"Server returned {resp.status_code} redirect to "
                        f"'{resp.headers.get('Location', '')}'"
                    )

            if resp.status_code == 200 and not login_success:
                body_lower = resp.text.lower() if resp.text else ""
                # Check for success indicators
                success_indicators = [
                    "dashboard", "welcome", "logout", "sign out",
                    "my account", "profile", "successfully logged in",
                ]
                error_indicators = [
                    "invalid", "incorrect", "wrong", "failed",
                    "error", "denied", "unauthorized", "bad credentials",
                ]
                has_success = any(kw in body_lower for kw in success_indicators)
                has_error = any(kw in body_lower for kw in error_indicators)

                if has_success and not has_error:
                    login_success = True
                    evidence_detail = (
                        "Response body contains success indicators "
                        "(dashboard/welcome/logout) without error messages"
                    )

            if login_success:
                findings.append(make_finding(
                    vulnerability="Default Credentials Accepted",
                    severity="CRITICAL",
                    location=page["url"],
                    evidence=(
                        f"The login form at {page['url']} accepted default "
                        f"credentials: username='{username}', "
                        f"password='{password}'. {evidence_detail}. "
                        f"Attackers can gain unauthorized access using "
                        f"well-known default credential pairs."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "login_url": page["url"],
                        "form_action": form["action"],
                        "username": username,
                        "password": "***",
                        "response_code": resp.status_code,
                    },
                ))
                # Stop testing more creds on this page once one works
                break

    return findings


# ---------------------------------------------------------------------------
# Check 3: Username enumeration
# ---------------------------------------------------------------------------
def check_username_enumeration(
    session, login_pages: List[Dict], timeout: int, delay: float
) -> List[Dict]:
    """
    Check for username enumeration by comparing responses for
    a likely-valid username vs a random invalid username.
    """
    findings = []

    for page in login_pages:
        if not page["has_form"]:
            continue

        form = _extract_login_form_details(page["html"], page["url"])
        if not form:
            continue

        # Try common usernames as "likely valid" and a random one as "invalid"
        likely_valid_users = ["admin", "administrator", "root", "user"]
        invalid_user = "xz_nonexistent_user_9q7w3k_vaultscan"
        invalid_password = "definitely_wrong_password_vaultscan"

        # First, get response for the invalid user
        data_invalid = dict(form["hidden_fields"])
        data_invalid[form["username_field"]] = invalid_user
        data_invalid[form["password_field"]] = invalid_password

        resp_invalid, err = safe_request(
            session, form["method"], form["action"],
            timeout=timeout, data=data_invalid, allow_redirects=True,
        )
        time.sleep(delay)
        if err or resp_invalid is None:
            continue

        invalid_status = resp_invalid.status_code
        invalid_body = resp_invalid.text or ""
        invalid_length = len(invalid_body)

        for valid_user in likely_valid_users:
            data_valid = dict(form["hidden_fields"])
            data_valid[form["username_field"]] = valid_user
            data_valid[form["password_field"]] = invalid_password

            resp_valid, err = safe_request(
                session, form["method"], form["action"],
                timeout=timeout, data=data_valid, allow_redirects=True,
            )
            time.sleep(delay)
            if err or resp_valid is None:
                continue

            valid_status = resp_valid.status_code
            valid_body = resp_valid.text or ""
            valid_length = len(valid_body)

            # Detect enumeration: different status codes or significantly
            # different response lengths or different error messages
            enumeration_detected = False
            evidence_parts = []

            # Different status codes
            if valid_status != invalid_status:
                enumeration_detected = True
                evidence_parts.append(
                    f"Status code differs: {valid_status} (valid user) vs "
                    f"{invalid_status} (invalid user)"
                )

            # Significantly different content length (>10% difference)
            if invalid_length > 0:
                diff_ratio = abs(valid_length - invalid_length) / max(
                    invalid_length, 1
                )
                if diff_ratio > 0.10:
                    enumeration_detected = True
                    evidence_parts.append(
                        f"Response length differs significantly: "
                        f"{valid_length} vs {invalid_length} bytes "
                        f"({diff_ratio:.0%} difference)"
                    )

            # Different error messages
            valid_lower = valid_body.lower()
            invalid_lower = invalid_body.lower()
            specific_user_msgs = [
                "user not found", "account not found",
                "no account", "unknown user", "invalid username",
                "user does not exist", "account does not exist",
            ]
            specific_pass_msgs = [
                "wrong password", "incorrect password",
                "invalid password", "password is incorrect",
            ]

            has_user_msg = any(m in invalid_lower for m in specific_user_msgs)
            has_pass_msg = any(m in valid_lower for m in specific_pass_msgs)

            if has_user_msg or has_pass_msg:
                enumeration_detected = True
                if has_user_msg:
                    evidence_parts.append(
                        "Server returns user-specific error message "
                        "(e.g., 'user not found') for invalid usernames"
                    )
                if has_pass_msg:
                    evidence_parts.append(
                        "Server returns password-specific error message "
                        "(e.g., 'wrong password') for valid usernames, "
                        "confirming the username exists"
                    )

            if enumeration_detected:
                findings.append(make_finding(
                    vulnerability="Username Enumeration",
                    severity="HIGH",
                    location=page["url"],
                    evidence=(
                        f"The login form at {page['url']} reveals whether a "
                        f"username exists based on differing responses. "
                        + "; ".join(evidence_parts)
                        + ". Attackers can enumerate valid usernames to "
                        "narrow brute-force attacks."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "login_url": page["url"],
                        "tested_valid_user": valid_user,
                        "tested_invalid_user": invalid_user,
                        "valid_status": valid_status,
                        "invalid_status": invalid_status,
                        "valid_length": valid_length,
                        "invalid_length": invalid_length,
                    },
                ))
                break  # One finding per login page is enough

    return findings


# ---------------------------------------------------------------------------
# Check 4: Password policy
# ---------------------------------------------------------------------------
def check_password_policy(
    session, target: str, timeout: int, delay: float
) -> List[Dict]:
    """
    Analyze registration and change-password forms for weak password policy
    by checking if the form enforces any client-side constraints.
    """
    findings = []
    checked_paths = REGISTRATION_PATHS + CHANGE_PASSWORD_PATHS

    for path in checked_paths:
        url = target.rstrip("/") + path
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        time.sleep(delay)
        if err or resp is None:
            continue
        if resp.status_code != 200:
            continue

        html = resp.text or ""
        if not _has_password_field(html):
            continue

        # Check for password policy indicators
        policy_indicators = [
            r"minlength", r"pattern=", r"min.*length",
            r"password.*must", r"password.*require",
            r"at\s+least\s+\d+\s+character",
            r"uppercase", r"lowercase", r"special\s+char",
            r"digit", r"number",
        ]

        has_policy = False
        for indicator in policy_indicators:
            if re.search(indicator, html, re.I):
                has_policy = True
                break

        # Check for minlength attribute on password fields
        soup = _parse_html(html)
        has_minlength = False
        min_val = 0
        if soup:
            for inp in soup.find_all("input", attrs={"type": "password"}):
                ml = inp.get("minlength")
                if ml:
                    has_minlength = True
                    try:
                        min_val = int(ml)
                    except ValueError:
                        pass

        if not has_policy and not has_minlength:
            findings.append(make_finding(
                vulnerability="Weak Password Policy",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"The form at {url} does not enforce any visible "
                    f"password policy (no minimum length, complexity "
                    f"requirements, or pattern validation). Users can "
                    f"set trivially weak passwords."
                ),
                category=CATEGORY,
                raw_details={
                    "form_url": url,
                    "has_policy_text": has_policy,
                    "has_minlength": has_minlength,
                },
            ))
        elif has_minlength and min_val > 0 and min_val < 8:
            findings.append(make_finding(
                vulnerability="Insufficient Password Length Requirement",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"The form at {url} enforces a minimum password "
                    f"length of only {min_val} characters. NIST SP 800-63B "
                    f"recommends at least 8 characters."
                ),
                category=CATEGORY,
                raw_details={
                    "form_url": url,
                    "min_length": min_val,
                    "recommended_min": 8,
                },
            ))

    return findings


def _has_password_field(html: str) -> bool:
    """Check if HTML contains a password input field."""
    return bool(re.search(r'<input[^>]*type=["\']password["\']', html, re.I))


# ---------------------------------------------------------------------------
# Check 5: Session fixation
# ---------------------------------------------------------------------------
def check_session_fixation(
    session, login_pages: List[Dict], timeout: int, delay: float
) -> List[Dict]:
    """
    Check if the session ID changes after a login attempt.
    If the session cookie remains the same before and after login,
    session fixation may be possible.
    """
    findings = []

    for page in login_pages:
        if not page["has_form"]:
            continue

        form = _extract_login_form_details(page["html"], page["url"])
        if not form:
            continue

        # Get session cookies before login
        fresh_session = create_session(timeout=timeout)
        resp_before, err = safe_request(
            fresh_session, "GET", page["url"], timeout=timeout
        )
        time.sleep(delay)
        if err or resp_before is None:
            continue

        cookies_before = {}
        for c in fresh_session.cookies:
            cookies_before[c.name] = c.value

        if not cookies_before:
            continue

        # Attempt login (with invalid creds -- we just care about cookie change)
        data = dict(form["hidden_fields"])
        data[form["username_field"]] = "admin"
        data[form["password_field"]] = "wrongpassword_vaultscan"

        resp_after, err = safe_request(
            fresh_session, form["method"], form["action"],
            timeout=timeout, data=data, allow_redirects=True,
        )
        time.sleep(delay)
        if err or resp_after is None:
            continue

        cookies_after = {}
        for c in fresh_session.cookies:
            cookies_after[c.name] = c.value

        # Check if any session-like cookies remained unchanged
        session_cookie_names = [
            n for n in cookies_before
            if any(kw in n.lower() for kw in
                   ["sess", "sid", "session", "token", "jsessionid", "phpsessid"])
        ]

        for name in session_cookie_names:
            if name in cookies_after and cookies_before[name] == cookies_after[name]:
                findings.append(make_finding(
                    vulnerability="Possible Session Fixation",
                    severity="MEDIUM",
                    location=page["url"],
                    evidence=(
                        f"The session cookie '{name}' did not change after "
                        f"a login attempt at {page['url']}. If the session "
                        f"ID is not regenerated upon authentication, an "
                        f"attacker who sets a known session ID can hijack "
                        f"the user's authenticated session."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "login_url": page["url"],
                        "cookie_name": name,
                        "cookie_unchanged": True,
                    },
                ))
                break  # One finding per page

    return findings


# ---------------------------------------------------------------------------
# Check 6: Account lockout
# ---------------------------------------------------------------------------
def check_account_lockout(
    session, login_pages: List[Dict], timeout: int, delay: float
) -> List[Dict]:
    """
    Send multiple failed login attempts and check if the account
    gets locked or rate-limited.
    """
    findings = []
    MAX_ATTEMPTS = 10

    for page in login_pages:
        if not page["has_form"]:
            continue

        form = _extract_login_form_details(page["html"], page["url"])
        if not form:
            continue

        locked_or_limited = False
        last_status = None

        for i in range(MAX_ATTEMPTS):
            data = dict(form["hidden_fields"])
            data[form["username_field"]] = "admin"
            data[form["password_field"]] = f"wrong_password_{i}_vaultscan"

            resp, err = safe_request(
                session, form["method"], form["action"],
                timeout=timeout, data=data, allow_redirects=True,
            )
            time.sleep(delay)
            if err or resp is None:
                continue

            last_status = resp.status_code
            body_lower = (resp.text or "").lower()

            # Check for lockout indicators
            lockout_indicators = [
                "locked", "too many attempts", "rate limit",
                "temporarily blocked", "try again later",
                "account disabled", "captcha", "blocked",
            ]
            if any(kw in body_lower for kw in lockout_indicators):
                locked_or_limited = True
                break

            if resp.status_code == 429:
                locked_or_limited = True
                break

        if not locked_or_limited:
            findings.append(make_finding(
                vulnerability="No Account Lockout Mechanism",
                severity="MEDIUM",
                location=page["url"],
                evidence=(
                    f"After {MAX_ATTEMPTS} failed login attempts at "
                    f"{page['url']}, no account lockout or rate limiting "
                    f"was detected. Attackers can perform unlimited "
                    f"brute-force attacks against user accounts."
                ),
                category=CATEGORY,
                raw_details={
                    "login_url": page["url"],
                    "attempts": MAX_ATTEMPTS,
                    "last_status_code": last_status,
                    "lockout_detected": False,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 7: Logout functionality
# ---------------------------------------------------------------------------
def check_logout_invalidation(
    session, target: str, timeout: int, delay: float
) -> List[Dict]:
    """
    Check if logout endpoints exist and whether they invalidate the session.
    """
    findings = []

    for path in LOGOUT_PATHS:
        url = target.rstrip("/") + path
        resp, err = safe_request(
            session, "GET", url, timeout=timeout, allow_redirects=False,
        )
        time.sleep(delay)
        if err or resp is None:
            continue

        # A logout endpoint typically returns 200 or redirects
        if resp.status_code in (200, 301, 302, 303, 307, 308):
            # Check if session cookies are being cleared
            set_cookies = resp.headers.get("Set-Cookie", "")
            cookies_cleared = False

            if set_cookies:
                # Look for session cookies set to empty/expired
                if any(kw in set_cookies.lower() for kw in
                       ["max-age=0", "expires=thu, 01 jan 1970",
                        "expires=thu, 01-jan-1970", "deleted"]):
                    cookies_cleared = True

            if not cookies_cleared and resp.status_code == 200:
                body_lower = (resp.text or "").lower()
                # If the logout page still shows authenticated content
                auth_indicators = [
                    "dashboard", "my account", "profile",
                    "settings", "welcome back",
                ]
                if any(kw in body_lower for kw in auth_indicators):
                    findings.append(make_finding(
                        vulnerability="Incomplete Logout Implementation",
                        severity="MEDIUM",
                        location=url,
                        evidence=(
                            f"The logout endpoint at {url} does not appear "
                            f"to properly invalidate the session. The "
                            f"response still contains authenticated content "
                            f"indicators and session cookies are not cleared."
                        ),
                        category=CATEGORY,
                        raw_details={
                            "logout_url": url,
                            "status_code": resp.status_code,
                            "cookies_cleared": cookies_cleared,
                        },
                    ))
            break  # Only report on the first found logout endpoint

    return findings


# ---------------------------------------------------------------------------
# Check 8: Login page over HTTP
# ---------------------------------------------------------------------------
def check_login_over_http(login_pages: List[Dict]) -> List[Dict]:
    """Check if any login page is served over HTTP instead of HTTPS."""
    findings = []

    for page in login_pages:
        parsed = urlparse(page["url"])
        if parsed.scheme == "http":
            findings.append(make_finding(
                vulnerability="Login Page Served Over HTTP",
                severity="MEDIUM",
                location=page["url"],
                evidence=(
                    f"The login page at {page['url']} is served over "
                    f"unencrypted HTTP. User credentials submitted to "
                    f"this form can be intercepted by network attackers "
                    f"via man-in-the-middle attacks."
                ),
                category=CATEGORY,
                raw_details={
                    "login_url": page["url"],
                    "scheme": "http",
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 9: Autocomplete on password fields
# ---------------------------------------------------------------------------
def check_autocomplete_password(login_pages: List[Dict]) -> List[Dict]:
    """Check if password fields have autocomplete enabled."""
    findings = []

    for page in login_pages:
        if not page["has_form"]:
            continue

        html = page["html"]
        soup = _parse_html(html)

        autocomplete_enabled = False
        if soup:
            for inp in soup.find_all("input", attrs={"type": "password"}):
                ac = (inp.get("autocomplete") or "").lower()
                # autocomplete is enabled by default if not set to "off"
                # or "new-password" / "current-password" (which are fine)
                if ac not in ("off", "new-password"):
                    autocomplete_enabled = True
                    break
        else:
            # Regex fallback: check if password fields lack autocomplete="off"
            pw_fields = re.findall(
                r'<input[^>]*type=["\']password["\'][^>]*>', html, re.I
            )
            for field in pw_fields:
                if 'autocomplete="off"' not in field.lower() and \
                   "autocomplete='off'" not in field.lower() and \
                   'autocomplete="new-password"' not in field.lower():
                    autocomplete_enabled = True
                    break

        if autocomplete_enabled:
            findings.append(make_finding(
                vulnerability="Password Autocomplete Enabled",
                severity="MEDIUM",
                location=page["url"],
                evidence=(
                    f"The login form at {page['url']} has autocomplete "
                    f"enabled on password fields. Browsers may cache "
                    f"credentials, allowing other users of the same "
                    f"machine to access stored passwords."
                ),
                category=CATEGORY,
                raw_details={
                    "login_url": page["url"],
                    "autocomplete": "not disabled",
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 10: Remember-me without secure cookies
# ---------------------------------------------------------------------------
def check_remember_me_cookies(
    session, login_pages: List[Dict], timeout: int, delay: float
) -> List[Dict]:
    """
    Check if login forms have remember-me functionality and whether
    the resulting cookies are properly secured.
    """
    findings = []

    for page in login_pages:
        if not page["has_form"]:
            continue

        html = page["html"]
        soup = _parse_html(html)

        has_remember_me = False
        remember_field_name = None

        if soup:
            for inp in soup.find_all("input", attrs={"type": "checkbox"}):
                name = (inp.get("name") or "").lower()
                inp_id = (inp.get("id") or "").lower()
                if any(kw in name or kw in inp_id for kw in
                       ["remember", "keep", "stay", "persist"]):
                    has_remember_me = True
                    remember_field_name = inp.get("name", "remember")
                    break
        else:
            if re.search(
                r'<input[^>]*(?:name|id)=["\'][^"\']*'
                r'(?:remember|keep|stay|persist)[^"\']*["\']',
                html, re.I
            ):
                has_remember_me = True

        if not has_remember_me:
            continue

        # Try submitting with remember-me enabled
        form = _extract_login_form_details(page["html"], page["url"])
        if not form:
            continue

        data = dict(form["hidden_fields"])
        data[form["username_field"]] = "admin"
        data[form["password_field"]] = "test"
        if remember_field_name:
            data[remember_field_name] = "on"

        resp, err = safe_request(
            session, form["method"], form["action"],
            timeout=timeout, data=data, allow_redirects=False,
        )
        time.sleep(delay)
        if err or resp is None:
            continue

        # Check Set-Cookie headers for long-lived cookies without Secure flag
        raw_cookies = resp.headers.get("Set-Cookie", "")
        if raw_cookies:
            cookie_lower = raw_cookies.lower()
            has_long_expiry = (
                "max-age=" in cookie_lower or "expires=" in cookie_lower
            )
            missing_secure = "secure" not in cookie_lower
            missing_httponly = "httponly" not in cookie_lower

            issues = []
            if has_long_expiry and missing_secure:
                issues.append("missing Secure flag")
            if has_long_expiry and missing_httponly:
                issues.append("missing HttpOnly flag")

            if issues:
                findings.append(make_finding(
                    vulnerability="Insecure Remember-Me Cookie",
                    severity="MEDIUM",
                    location=page["url"],
                    evidence=(
                        f"The login form at {page['url']} provides "
                        f"remember-me functionality that sets a persistent "
                        f"cookie with security issues: "
                        + ", ".join(issues) + ". "
                        f"Long-lived authentication cookies without proper "
                        f"security flags can be stolen or intercepted."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "login_url": page["url"],
                        "remember_me_field": remember_field_name,
                        "issues": issues,
                    },
                ))

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    return [
        make_finding(
            vulnerability="Default Credentials Accepted",
            severity="CRITICAL",
            location=f"{target}/login",
            evidence=(
                f"The login form at {target}/login accepted default "
                f"credentials: username='admin', password='admin'. "
                f"Server returned 302 redirect to '/dashboard'. "
                f"Attackers can gain unauthorized access using "
                f"well-known default credential pairs."
            ),
            category=CATEGORY,
            raw_details={
                "login_url": f"{target}/login",
                "form_action": f"{target}/api/auth/login",
                "username": "admin",
                "password": "***",
                "response_code": 302,
            },
        ),
        make_finding(
            vulnerability="Username Enumeration",
            severity="HIGH",
            location=f"{target}/login",
            evidence=(
                f"The login form at {target}/login reveals whether a "
                f"username exists based on differing responses. "
                f"Response length differs significantly: 1245 vs 987 bytes "
                f"(26% difference). Attackers can enumerate valid usernames "
                f"to narrow brute-force attacks."
            ),
            category=CATEGORY,
            raw_details={
                "login_url": f"{target}/login",
                "tested_valid_user": "admin",
                "tested_invalid_user": "xz_nonexistent_user_9q7w3k_vaultscan",
                "valid_status": 200,
                "invalid_status": 200,
                "valid_length": 1245,
                "invalid_length": 987,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Broken Authentication Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)
    if not target:
        from scan_utils import output_error
        output_error("Invalid target URL")

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    session = create_session(
        timeout=args.timeout, cookies=args.cookies, headers=args.headers,
    )
    timeout = args.timeout
    delay = args.delay
    findings: List[Dict] = []

    # Step 1: Find login pages
    login_pages = _find_login_pages(session, target, timeout, delay)

    if not login_pages:
        # No login pages found -- output empty findings
        output_findings([])
        return

    # Step 2: Test default credentials
    findings.extend(
        check_default_credentials(session, login_pages, timeout, delay)
    )

    # Step 3: Check username enumeration
    findings.extend(
        check_username_enumeration(session, login_pages, timeout, delay)
    )

    # Step 4: Check password policy
    findings.extend(
        check_password_policy(session, target, timeout, delay)
    )

    # Step 5: Check session fixation
    findings.extend(
        check_session_fixation(session, login_pages, timeout, delay)
    )

    # Step 6: Check account lockout
    findings.extend(
        check_account_lockout(session, login_pages, timeout, delay)
    )

    # Step 7: Check logout functionality
    findings.extend(
        check_logout_invalidation(session, target, timeout, delay)
    )

    # Step 8: Check login over HTTP
    findings.extend(
        check_login_over_http(login_pages)
    )

    # Step 9: Check password autocomplete
    findings.extend(
        check_autocomplete_password(login_pages)
    )

    # Step 10: Check remember-me cookies
    findings.extend(
        check_remember_me_cookies(session, login_pages, timeout, delay)
    )

    # Deduplicate findings by (vulnerability, location)
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
