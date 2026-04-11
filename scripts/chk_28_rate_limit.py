#!/usr/bin/env python3
"""
VaultScan -- Rate Limiting & Brute Force Protection Scanner
============================================================
Tests for missing rate limiting on sensitive endpoints.
"""

import os
import sys
import time
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, extract_forms,
)


LOGIN_PATHS = [
    "/login", "/signin", "/auth/login", "/user/login", "/admin/login",
    "/api/login", "/api/auth/login", "/api/v1/auth/login", "/account/login",
    "/wp-login.php", "/administrator",
]

API_PATHS = [
    "/api/users", "/api/v1/users", "/api/search", "/api/data",
    "/api/v1/search", "/api/forgot-password", "/api/reset-password",
]


def find_login_endpoints(session, base_url: str, timeout: int) -> List[Dict]:
    """Find login endpoints that should have rate limiting."""
    endpoints = []

    for path in LOGIN_PATHS:
        url = f"{base_url}{path}"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        if resp.status_code in (200, 301, 302):
            forms = extract_forms(url, resp.text) if resp.status_code == 200 else []
            has_password = any(
                any(inp.get("type") == "password" for inp in f.get("inputs", []))
                for f in forms
            )
            endpoints.append({
                "url": url,
                "path": path,
                "has_form": len(forms) > 0,
                "has_password": has_password,
                "method": "POST" if forms else "GET",
                "forms": forms,
            })

    return endpoints


def test_rate_limiting(session, url: str, method: str, timeout: int, data: Dict = None) -> Dict:
    """Send multiple rapid requests and check if rate limiting kicks in."""
    results = {
        "blocked": False,
        "status_codes": [],
        "has_rate_headers": False,
        "rate_limit_header": None,
        "requests_sent": 0,
    }

    for i in range(15):
        kwargs = {"timeout": timeout}
        if method == "POST" and data:
            kwargs["data"] = data

        resp, err = safe_request(session, method, url, **kwargs)
        results["requests_sent"] += 1

        if err or not resp:
            continue

        results["status_codes"].append(resp.status_code)

        # Check for rate limiting headers
        for header in ["X-RateLimit-Limit", "X-RateLimit-Remaining",
                       "RateLimit-Limit", "RateLimit-Remaining",
                       "Retry-After", "X-Rate-Limit"]:
            if header.lower() in {k.lower() for k in resp.headers}:
                results["has_rate_headers"] = True
                results["rate_limit_header"] = header
                break

        # Check if we got blocked
        if resp.status_code == 429:
            results["blocked"] = True
            break

        if resp.status_code == 403 and i > 5:
            results["blocked"] = True
            break

    return results


def check_login_rate_limiting(session, endpoint: Dict, timeout: int) -> List[Dict]:
    """Test rate limiting on a login endpoint."""
    findings = []
    url = endpoint["url"]

    # Build test login data
    login_data = {"username": "test@invalid.com", "password": "wrongpassword123"}
    if endpoint["forms"]:
        form = endpoint["forms"][0]
        for inp in form.get("inputs", []):
            name = inp.get("name", "")
            if inp.get("type") == "password":
                login_data[name] = "wrongpassword123"
            elif "email" in name.lower() or "user" in name.lower():
                login_data[name] = "test@invalid.com"
            elif "csrf" in name.lower() or "token" in name.lower():
                login_data[name] = inp.get("value", "")
            elif inp.get("value"):
                login_data[name] = inp["value"]

    result = test_rate_limiting(
        session, endpoint.get("forms", [{}])[0].get("action", url) if endpoint["forms"] else url,
        "POST", timeout, login_data
    )

    if not result["blocked"] and not result["has_rate_headers"]:
        findings.append(make_finding(
            vulnerability="No Rate Limiting on Login Endpoint",
            severity="HIGH",
            location=url,
            evidence=(
                f"Login endpoint accepts {result['requests_sent']} rapid requests "
                f"without rate limiting or blocking. Status codes: "
                f"{list(set(result['status_codes']))[:5]}. "
                f"This enables brute force password attacks."
            ),
            category="RATE_LIMITING",
            raw_details={
                "endpoint": url,
                "requests_sent": result["requests_sent"],
                "status_codes": result["status_codes"],
                "blocked": False,
                "rate_headers": False,
            },
        ))

    if result["has_rate_headers"] and not result["blocked"]:
        findings.append(make_finding(
            vulnerability="Rate Limiting Headers Present But Not Enforced",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"Rate limit headers detected ({result['rate_limit_header']}) but "
                f"endpoint did not block after {result['requests_sent']} requests."
            ),
            category="RATE_LIMITING",
            raw_details={
                "endpoint": url,
                "rate_header": result["rate_limit_header"],
                "requests_sent": result["requests_sent"],
            },
        ))

    return findings


def check_api_rate_limiting(session, base_url: str, timeout: int) -> List[Dict]:
    """Test rate limiting on API endpoints."""
    findings = []

    for path in API_PATHS:
        url = f"{base_url}{path}"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code in (404, 405):
            continue

        result = test_rate_limiting(session, url, "GET", timeout)

        if not result["blocked"] and not result["has_rate_headers"] and result["requests_sent"] >= 10:
            findings.append(make_finding(
                vulnerability="No Rate Limiting on API Endpoint",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"API endpoint accepts {result['requests_sent']} rapid requests "
                    f"without rate limiting. This enables enumeration and abuse."
                ),
                category="RATE_LIMITING",
                raw_details={
                    "endpoint": url,
                    "requests_sent": result["requests_sent"],
                    "blocked": False,
                },
            ))
            break  # Only report one API endpoint to avoid noise

    return findings


def check_password_reset_rate_limit(session, base_url: str, timeout: int) -> List[Dict]:
    """Check rate limiting on password reset."""
    findings = []
    reset_paths = ["/forgot-password", "/reset-password", "/api/forgot-password",
                   "/api/auth/forgot-password", "/password/reset", "/account/recover"]

    for path in reset_paths:
        url = f"{base_url}{path}"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code in (404, 405):
            continue

        # Found password reset endpoint
        result = test_rate_limiting(
            session, url, "POST", timeout,
            {"email": "test@test.com"}
        )

        if not result["blocked"]:
            findings.append(make_finding(
                vulnerability="No Rate Limiting on Password Reset",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Password reset endpoint accepts {result['requests_sent']} "
                    f"rapid requests without blocking. This enables email bombing."
                ),
                category="RATE_LIMITING",
                raw_details={"endpoint": url, "requests_sent": result["requests_sent"]},
            ))
        break

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="No Rate Limiting on Login Endpoint",
            severity="HIGH",
            location=f"{target}/login",
            evidence="Login endpoint accepts 15 rapid requests without blocking.",
            category="RATE_LIMITING",
        ),
        make_finding(
            vulnerability="No Rate Limiting on API Endpoint",
            severity="MEDIUM",
            location=f"{target}/api/users",
            evidence="API endpoint accepts 15 rapid requests without rate limiting.",
            category="RATE_LIMITING",
        ),
    ]


def main():
    parser = base_argparser("VaultScan Rate Limiting Scanner")
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

    # Find and test login endpoints
    login_endpoints = find_login_endpoints(session, target, args.timeout)
    for endpoint in login_endpoints[:3]:  # Test max 3 login endpoints
        findings.extend(check_login_rate_limiting(session, endpoint, args.timeout))

    # Test API rate limiting
    findings.extend(check_api_rate_limiting(session, target, args.timeout))

    # Test password reset rate limiting
    findings.extend(check_password_reset_rate_limit(session, target, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
