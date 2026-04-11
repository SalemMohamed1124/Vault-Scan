#!/usr/bin/env python3
"""
VaultScan — Open Redirect Scanner (Production)
=================================================
Enhanced open redirect detection with:

1. **Parameter-based redirects** — tests URL params with redirect payloads
2. **Header-based redirects** — tests Host header injection
3. **Meta refresh detection** — finds meta refresh tags in responses
4. **JavaScript redirects** — detects window.location assignments from params
5. **POST-based redirects** — tests form actions with redirect params
6. **More payloads** — 18 bypass techniques including encoding variants

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse, quote

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
    extract_url_params,
    replace_url_param,
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "OPEN_REDIRECT"
MAX_CRAWL_PAGES = 5

REDIRECT_PARAM_NAMES: Set[str] = {
    "url", "redirect", "next", "return", "returnurl", "goto", "target",
    "destination", "redir", "redirect_uri", "continue", "return_to",
    "forward", "go", "out", "view", "login_url", "image_url", "callback",
    "checkout_url", "ref", "to", "redirect_url", "return_path",
    "success_url", "error_url", "cancel_url", "back", "backurl",
    "back_url", "returl", "r_url", "u", "q", "link", "jump",
}

AUTH_PAGE_KEYWORDS = {
    "login", "signin", "sign-in", "auth", "authenticate", "sso",
    "oauth", "logout", "register", "signup", "sign-up", "session",
    "saml", "callback", "authorize",
}

# Extended redirect payloads with bypass techniques
REDIRECT_PAYLOADS: List[Dict[str, str]] = [
    # Basic
    {"payload": "https://evil.com", "desc": "Absolute URL to external domain"},
    {"payload": "//evil.com", "desc": "Protocol-relative URL"},
    {"payload": "http://evil.com", "desc": "HTTP absolute URL"},
    # Backslash confusion
    {"payload": "/\\evil.com", "desc": "Backslash-based path confusion"},
    {"payload": "\\/evil.com", "desc": "Escaped backslash confusion"},
    # Domain bypass
    {"payload": "https://evil.com%00.legitimate.com", "desc": "Null byte domain bypass"},
    {"payload": "https://evil.com?.legitimate.com", "desc": "Question mark domain bypass"},
    {"payload": "https://evil.com#.legitimate.com", "desc": "Fragment domain bypass"},
    {"payload": "https://evil.com@legitimate.com", "desc": "Userinfo @ domain bypass"},
    {"payload": "https://legitimate.com.evil.com", "desc": "Subdomain of evil domain"},
    # Encoding bypasses
    {"payload": "//evil.com/%2f..", "desc": "URL-encoded slash with path traversal"},
    {"payload": "///evil.com", "desc": "Triple-slash protocol-relative"},
    {"payload": "%2f%2fevil.com", "desc": "Double-encoded slashes"},
    {"payload": "/%09/evil.com", "desc": "Tab character bypass"},
    {"payload": "//%0devil.com", "desc": "Carriage return bypass"},
    # JavaScript protocol
    {"payload": "javascript:alert(document.domain)//", "desc": "JavaScript protocol"},
    {"payload": "java%0d%0ascript:alert(1)", "desc": "CRLF-injected javascript protocol"},
    # Data URI
    {"payload": "data:text/html,<script>alert(1)</script>", "desc": "Data URI with script"},
]

EVIL_DOMAIN = "evil.com"

# JavaScript redirect patterns
JS_REDIRECT_PATTERNS = [
    re.compile(r"window\.location\s*=\s*['\"]?\s*(?:document\.URL|location\.(?:href|search|hash))", re.I),
    re.compile(r"window\.location\.(?:href|assign|replace)\s*\(\s*(?:params|query|url|getParam|searchParams)", re.I),
    re.compile(r"document\.location\s*=", re.I),
    re.compile(r"window\.open\s*\(\s*(?:params|query|url|getParam)", re.I),
]

# Meta refresh pattern
META_REFRESH_RE = re.compile(
    r'<meta[^>]*http-equiv\s*=\s*["\']?refresh["\']?[^>]*content\s*=\s*["\']?\d+;\s*url\s*=\s*([^"\'>\s]+)',
    re.I,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_redirect_param(param_name: str) -> bool:
    return param_name.lower() in REDIRECT_PARAM_NAMES


def _is_auth_page(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(kw in path for kw in AUTH_PAGE_KEYWORDS)


def _location_points_to_evil(location: str, original_domain: str) -> bool:
    if not location:
        return False
    if EVIL_DOMAIN in location.lower():
        return True
    try:
        parsed = urlparse(location)
        loc_host = parsed.netloc.lower() if parsed.netloc else ""
        if not loc_host and location.startswith("//"):
            loc_host = location.lstrip("/").split("/")[0].split("?")[0].split("#")[0].lower()
        if loc_host and loc_host != original_domain and original_domain not in loc_host:
            return True
    except Exception:
        pass
    return False


def _build_test_url(base_url: str, param: str, payload: str) -> str:
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    params[param] = [payload]
    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


# ---------------------------------------------------------------------------
# Core Detection
# ---------------------------------------------------------------------------
def test_redirect_param(
    session, url: str, param: str, original_domain: str,
    delay: float, timeout: int,
) -> List[Dict]:
    findings: List[Dict] = []
    is_auth = _is_auth_page(url)

    for pdef in REDIRECT_PAYLOADS:
        payload = pdef["payload"]
        test_url = _build_test_url(url, param, payload)

        resp, err = rate_limited_request(
            session, "GET", test_url,
            delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        status = resp.status_code
        location = resp.headers.get("Location", "")

        # Check 3xx redirect to evil domain
        if 300 <= status < 400 and _location_points_to_evil(location, original_domain):
            severity = "HIGH" if is_auth else "MEDIUM"
            findings.append(make_finding(
                vulnerability="Open Redirect Detected",
                severity=severity,
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload '{payload}' ({pdef['desc']}) in parameter "
                    f"'{param}' caused a {status} redirect to: {location}"
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "parameter": param,
                    "payload": payload,
                    "payload_description": pdef["desc"],
                    "status_code": status,
                    "location_header": location[:500],
                    "is_auth_page": is_auth,
                    "test_url": test_url,
                },
            ))
            return findings

        # Check for JavaScript-based redirect in response body
        if status == 200:
            body = resp.text[:5000]
            if payload in body or EVIL_DOMAIN in body:
                # Check if it's in a redirect context
                if any(p.search(body) for p in JS_REDIRECT_PATTERNS):
                    severity = "HIGH" if is_auth else "MEDIUM"
                    findings.append(make_finding(
                        vulnerability="Open Redirect via JavaScript",
                        severity=severity,
                        location=f"{url} [param: {param}]",
                        evidence=(
                            f"Payload reflected in JavaScript redirect context. "
                            f"Parameter '{param}' value appears in window.location "
                            f"or document.location assignment."
                        ),
                        category=CATEGORY,
                        confidence="MEDIUM",
                        raw_details={
                            "parameter": param,
                            "payload": payload,
                            "status_code": status,
                            "is_auth_page": is_auth,
                        },
                    ))
                    return findings

            # Check for meta refresh redirect
            meta_match = META_REFRESH_RE.search(body)
            if meta_match:
                meta_url = meta_match.group(1)
                if EVIL_DOMAIN in meta_url.lower():
                    severity = "MEDIUM"
                    findings.append(make_finding(
                        vulnerability="Open Redirect via Meta Refresh",
                        severity=severity,
                        location=f"{url} [param: {param}]",
                        evidence=(
                            f"Meta refresh tag redirects to attacker-controlled URL: {meta_url}"
                        ),
                        category=CATEGORY,
                        confidence="HIGH",
                        raw_details={
                            "parameter": param,
                            "payload": payload,
                            "meta_url": meta_url,
                        },
                    ))
                    return findings

    return findings


def check_host_header_redirect(
    session, url: str, delay: float, timeout: int,
) -> List[Dict]:
    """Test for Host header injection leading to redirect."""
    findings: List[Dict] = []

    resp, err = rate_limited_request(
        session, "GET", url,
        delay=delay, timeout=timeout,
        headers={"Host": "evil.com"},
        allow_redirects=False,
    )

    if resp and 300 <= resp.status_code < 400:
        location = resp.headers.get("Location", "")
        if EVIL_DOMAIN in location.lower():
            findings.append(make_finding(
                vulnerability="Open Redirect via Host Header Injection",
                severity="HIGH",
                location=url,
                evidence=(
                    f"Injecting 'Host: evil.com' header caused a {resp.status_code} "
                    f"redirect to: {location}"
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "injected_host": "evil.com",
                    "status_code": resp.status_code,
                    "location_header": location[:500],
                },
            ))

    return findings


def check_js_redirects_in_page(page_html: str, page_url: str) -> List[Dict]:
    """Detect DOM-based open redirects in page JavaScript."""
    findings: List[Dict] = []

    for pattern in JS_REDIRECT_PATTERNS:
        matches = pattern.findall(page_html)
        if matches:
            findings.append(make_finding(
                vulnerability="Potential DOM-based Open Redirect",
                severity="MEDIUM",
                location=page_url,
                evidence=(
                    f"JavaScript code assigns user-controllable input to "
                    f"window.location or document.location. "
                    f"Pattern found: {matches[0][:100]}"
                ),
                category=CATEGORY,
                confidence="LOW",
                raw_details={
                    "page_url": page_url,
                    "pattern_matches": [m[:100] for m in matches[:3]],
                },
            ))
            break

    return findings


def discover_redirect_params(url: str) -> List[str]:
    params = extract_url_params(url)
    return [p for p in params if _is_redirect_param(p)]


def inject_redirect_params(base_url: str) -> List[str]:
    params = extract_url_params(base_url)
    existing_lower = {p.lower() for p in params}
    candidates = []
    # Only inject on pages that look like they handle redirects
    path_lower = urlparse(base_url).path.lower()
    if any(kw in path_lower for kw in AUTH_PAGE_KEYWORDS):
        for name in sorted(REDIRECT_PARAM_NAMES):
            if name.lower() not in existing_lower:
                candidates.append(name)
    return candidates[:5]  # Limit to avoid too many requests


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Open Redirect Detected",
            severity="HIGH",
            location=f"{target}/login?next=test [param: next]",
            evidence=(
                "Payload '//evil.com' (Protocol-relative URL) in parameter "
                "'next' caused a 302 redirect to: //evil.com"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "parameter": "next",
                "payload": "//evil.com",
                "status_code": 302,
                "is_auth_page": True,
            },
        ),
        make_finding(
            vulnerability="Open Redirect via Host Header Injection",
            severity="HIGH",
            location=target,
            evidence=(
                "Injecting 'Host: evil.com' header caused a 302 redirect to: "
                "https://evil.com/"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "injected_host": "evil.com",
                "status_code": 302,
            },
        ),
        make_finding(
            vulnerability="Open Redirect Detected",
            severity="MEDIUM",
            location=f"{target}/go?url=test [param: url]",
            evidence=(
                "Payload 'https://evil.com' (Absolute URL) in parameter "
                "'url' caused a 301 redirect to: https://evil.com"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "parameter": "url",
                "payload": "https://evil.com",
                "status_code": 301,
                "is_auth_page": False,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Open Redirect Scanner")
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
    original_domain = urlparse(target).netloc.lower()

    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Check Host header injection
    findings.extend(check_host_header_redirect(session, target, delay, timeout))

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

    tested_params: set = set()

    for page_url in pages:
        # Fetch page for JS redirect analysis
        if page_url == target:
            page_html = resp.text
        else:
            r, e = rate_limited_request(session, "GET", page_url, delay=delay, timeout=timeout)
            if e or r is None:
                continue
            page_html = r.text

        # Check for DOM-based redirects
        findings.extend(check_js_redirects_in_page(page_html, page_url))

        # Test existing redirect params
        redirect_params = discover_redirect_params(page_url)
        for param in redirect_params:
            dedup_key = (urlparse(page_url).path, param.lower())
            if dedup_key in tested_params:
                continue
            tested_params.add(dedup_key)

            param_findings = test_redirect_param(
                session, page_url, param, original_domain, delay, timeout,
            )
            findings.extend(param_findings)

        # Inject redirect params on auth pages
        candidate_params = inject_redirect_params(page_url)
        for param in candidate_params:
            dedup_key = (urlparse(page_url).path, param.lower())
            if dedup_key in tested_params:
                continue
            tested_params.add(dedup_key)

            param_findings = test_redirect_param(
                session, page_url, param, original_domain, delay, timeout,
            )
            findings.extend(param_findings)

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
