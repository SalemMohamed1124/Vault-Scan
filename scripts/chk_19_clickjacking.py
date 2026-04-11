#!/usr/bin/env python3
"""
VaultScan — Clickjacking / Frame Protection Scanner
=====================================================
Checks for clickjacking vulnerabilities by analysing frame-protection headers:
  1. X-Frame-Options header (DENY, SAMEORIGIN, ALLOW-FROM)
  2. Content-Security-Policy frame-ancestors directive
  3. Multiple important pages (root, login, account, settings, admin)
  4. Missing frame protection
  5. Weak frame protection (deprecated ALLOW-FROM, wildcard frame-ancestors)
  6. Conflicting X-Frame-Options and CSP frame-ancestors directives
  7. Effective framability based on header analysis (no browser needed)

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

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
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "CLICKJACKING"

# Pages to test — tuple of (path, is_sensitive)
# Sensitive pages get HIGH severity when unprotected; others get MEDIUM.
TEST_PAGES: List[Tuple[str, bool]] = [
    ("/", False),
    ("/login", True),
    ("/signin", True),
    ("/auth/login", True),
    ("/admin", True),
    ("/admin/login", True),
    ("/account", True),
    ("/settings", True),
    ("/profile", True),
    ("/dashboard", True),
    ("/user/login", True),
    ("/register", False),
    ("/signup", False),
]


# ---------------------------------------------------------------------------
# Header Parsing Helpers
# ---------------------------------------------------------------------------
def _get_header_ci(headers: Dict[str, str], name: str) -> Optional[str]:
    """Case-insensitive header lookup."""
    name_lower = name.lower()
    for h, v in headers.items():
        if h.lower() == name_lower:
            return v
    return None


def _parse_xfo(value: str) -> Dict:
    """
    Parse an X-Frame-Options header value.
    Returns dict with keys: directive, valid, deprecated, details.
    """
    val_upper = value.strip().upper()

    if val_upper == "DENY":
        return {"directive": "DENY", "valid": True, "deprecated": False,
                "details": "Frames completely blocked."}
    elif val_upper == "SAMEORIGIN":
        return {"directive": "SAMEORIGIN", "valid": True, "deprecated": False,
                "details": "Frames allowed only from same origin."}
    elif val_upper.startswith("ALLOW-FROM"):
        origin = value.strip()[len("ALLOW-FROM"):].strip()
        return {"directive": "ALLOW-FROM", "valid": True, "deprecated": True,
                "details": f"ALLOW-FROM is deprecated and ignored by modern browsers. Origin: {origin}"}
    else:
        return {"directive": val_upper, "valid": False, "deprecated": False,
                "details": f"Unrecognised X-Frame-Options value: {value.strip()}"}


def _parse_frame_ancestors(csp_header: str) -> Optional[Dict]:
    """
    Extract and parse the frame-ancestors directive from a CSP header.
    Returns None if frame-ancestors is not present.
    """
    # Split directives by semicolons
    directives = [d.strip() for d in csp_header.split(";")]
    for directive in directives:
        if directive.lower().startswith("frame-ancestors"):
            sources = directive.split()[1:]  # everything after 'frame-ancestors'
            has_wildcard = "*" in sources
            has_none = "'none'" in [s.lower() for s in sources]
            has_self = "'self'" in [s.lower() for s in sources]

            weak = has_wildcard
            strong = has_none or (has_self and not has_wildcard and len(sources) == 1)

            return {
                "raw": directive,
                "sources": sources,
                "has_wildcard": has_wildcard,
                "has_none": has_none,
                "has_self": has_self,
                "weak": weak,
                "strong": strong,
            }
    return None


def _headers_conflict(xfo_parsed: Dict, fa_parsed: Dict) -> Optional[str]:
    """
    Check if X-Frame-Options and CSP frame-ancestors give conflicting signals.
    Returns a description of the conflict, or None.
    """
    # DENY vs frame-ancestors that allows framing
    if xfo_parsed["directive"] == "DENY" and not fa_parsed["has_none"]:
        if fa_parsed["has_wildcard"] or fa_parsed["has_self"] or fa_parsed["sources"]:
            return (
                "X-Frame-Options is DENY but CSP frame-ancestors allows framing "
                f"({fa_parsed['raw']}). Modern browsers use CSP over X-Frame-Options, "
                "so the page IS framable despite the DENY header."
            )

    # SAMEORIGIN vs frame-ancestors 'none'
    if xfo_parsed["directive"] == "SAMEORIGIN" and fa_parsed["has_none"]:
        return (
            "X-Frame-Options is SAMEORIGIN but CSP frame-ancestors is 'none'. "
            "Modern browsers honour CSP, so no framing is allowed despite "
            "X-Frame-Options allowing same-origin."
        )

    return None


# ---------------------------------------------------------------------------
# Core Check: Analyse a single page
# ---------------------------------------------------------------------------
def check_page(
    session,
    page_url: str,
    path: str,
    is_sensitive: bool,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Fetch a page and analyse its frame-protection headers.
    Returns a list of findings (may be empty).
    """
    findings: List[Dict] = []

    resp, err = rate_limited_request(
        session, "GET", page_url, delay=delay, timeout=timeout,
        allow_redirects=True,
    )
    if err or resp is None:
        return findings

    # Only analyse pages that return actual content
    if resp.status_code not in (200, 301, 302, 303, 307, 308):
        return findings

    # For redirects the headers still matter (clickjacking on the redirect
    # response itself is possible in some browsers), but we focus on 200.
    if resp.status_code != 200:
        return findings

    headers = dict(resp.headers)
    severity = "HIGH" if is_sensitive else "MEDIUM"
    page_label = f"page '{path}'"

    xfo_value = _get_header_ci(headers, "X-Frame-Options")
    csp_value = _get_header_ci(headers, "Content-Security-Policy")
    csp_ro_value = _get_header_ci(headers, "Content-Security-Policy-Report-Only")

    xfo_parsed = _parse_xfo(xfo_value) if xfo_value else None
    fa_parsed = _parse_frame_ancestors(csp_value) if csp_value else None

    # Also check report-only CSP (it doesn't enforce, just reports)
    fa_ro_parsed = _parse_frame_ancestors(csp_ro_value) if csp_ro_value else None

    has_xfo = xfo_parsed is not None
    has_fa = fa_parsed is not None

    # ------------------------------------------------------------------
    # 1. No frame protection at all
    # ------------------------------------------------------------------
    if not has_xfo and not has_fa:
        findings.append(make_finding(
            vulnerability="Missing Clickjacking Protection",
            severity=severity,
            location=page_url,
            evidence=(
                f"The {page_label} has neither X-Frame-Options nor CSP "
                f"frame-ancestors header. The page can be embedded in an "
                f"iframe on any external site, enabling clickjacking attacks."
            ),
            category=CATEGORY,
            raw_details={
                "path": path,
                "is_sensitive": is_sensitive,
                "x_frame_options": None,
                "csp_frame_ancestors": None,
            },
        ))
        # If report-only CSP has frame-ancestors, note it
        if fa_ro_parsed:
            findings.append(make_finding(
                vulnerability="Frame Protection in Report-Only Mode",
                severity="MEDIUM",
                location=page_url,
                evidence=(
                    f"The {page_label} has frame-ancestors in "
                    f"Content-Security-Policy-Report-Only "
                    f"({fa_ro_parsed['raw']}) but NOT in the enforcing CSP. "
                    f"Report-only headers do not prevent clickjacking."
                ),
                category=CATEGORY,
                raw_details={
                    "path": path,
                    "csp_report_only_frame_ancestors": fa_ro_parsed["raw"],
                },
            ))
        return findings

    # ------------------------------------------------------------------
    # 2. Deprecated ALLOW-FROM
    # ------------------------------------------------------------------
    if has_xfo and xfo_parsed["deprecated"]:
        findings.append(make_finding(
            vulnerability="Deprecated X-Frame-Options ALLOW-FROM",
            severity=severity,
            location=page_url,
            evidence=(
                f"The {page_label} uses X-Frame-Options: {xfo_value}. "
                f"The ALLOW-FROM directive is deprecated and ignored by "
                f"Chrome, Firefox, and Edge. Without a supplementary CSP "
                f"frame-ancestors directive the page is effectively unprotected."
            ),
            category=CATEGORY,
            raw_details={
                "path": path,
                "x_frame_options": xfo_value,
                "deprecated": True,
                "browser_support": "Not supported in Chrome, Firefox, Edge",
            },
        ))
        # If there is no CSP frame-ancestors backing it up, it's fully vulnerable
        if not has_fa:
            findings.append(make_finding(
                vulnerability="Missing Clickjacking Protection (ALLOW-FROM only)",
                severity=severity,
                location=page_url,
                evidence=(
                    f"The {page_label} relies solely on the deprecated "
                    f"ALLOW-FROM directive with no CSP frame-ancestors fallback. "
                    f"Modern browsers ignore ALLOW-FROM, leaving the page framable."
                ),
                category=CATEGORY,
                raw_details={
                    "path": path,
                    "x_frame_options": xfo_value,
                    "csp_frame_ancestors": None,
                },
            ))

    # ------------------------------------------------------------------
    # 3. Invalid X-Frame-Options value
    # ------------------------------------------------------------------
    if has_xfo and not xfo_parsed["valid"]:
        findings.append(make_finding(
            vulnerability="Invalid X-Frame-Options Value",
            severity=severity,
            location=page_url,
            evidence=(
                f"The {page_label} has an unrecognised X-Frame-Options value: "
                f"'{xfo_value}'. Browsers will ignore this header, leaving the "
                f"page without frame protection."
            ),
            category=CATEGORY,
            raw_details={
                "path": path,
                "x_frame_options": xfo_value,
            },
        ))

    # ------------------------------------------------------------------
    # 4. CSP frame-ancestors with wildcard
    # ------------------------------------------------------------------
    if has_fa and fa_parsed["weak"]:
        findings.append(make_finding(
            vulnerability="Weak CSP frame-ancestors (Wildcard)",
            severity=severity,
            location=page_url,
            evidence=(
                f"The {page_label} has CSP '{fa_parsed['raw']}' which uses a "
                f"wildcard (*) source. This allows any site to embed the page "
                f"in an iframe, effectively negating clickjacking protection."
            ),
            category=CATEGORY,
            raw_details={
                "path": path,
                "csp_frame_ancestors": fa_parsed["raw"],
                "sources": fa_parsed["sources"],
            },
        ))

    # ------------------------------------------------------------------
    # 5. Conflicting X-Frame-Options and CSP frame-ancestors
    # ------------------------------------------------------------------
    if has_xfo and has_fa:
        conflict = _headers_conflict(xfo_parsed, fa_parsed)
        if conflict:
            findings.append(make_finding(
                vulnerability="Conflicting Frame Protection Headers",
                severity="MEDIUM",
                location=page_url,
                evidence=f"The {page_label} has conflicting headers: {conflict}",
                category=CATEGORY,
                raw_details={
                    "path": path,
                    "x_frame_options": xfo_value,
                    "csp_frame_ancestors": fa_parsed["raw"],
                    "conflict": conflict,
                },
            ))

    # ------------------------------------------------------------------
    # 6. Only X-Frame-Options, no CSP frame-ancestors (informational)
    #    XFO alone is fine but CSP is more flexible and recommended.
    #    We only flag this as LOW / informational for sensitive pages.
    # ------------------------------------------------------------------
    if has_xfo and xfo_parsed["valid"] and not xfo_parsed["deprecated"] and not has_fa:
        if is_sensitive:
            findings.append(make_finding(
                vulnerability="Frame Protection via X-Frame-Options Only",
                severity="LOW",
                location=page_url,
                evidence=(
                    f"The {page_label} uses X-Frame-Options: {xfo_value} but "
                    f"does not set CSP frame-ancestors. While X-Frame-Options "
                    f"is still honoured by browsers, CSP frame-ancestors is the "
                    f"modern replacement and provides more granular control."
                ),
                category=CATEGORY,
                raw_details={
                    "path": path,
                    "x_frame_options": xfo_value,
                    "recommendation": "Add Content-Security-Policy: frame-ancestors 'self'",
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
            vulnerability="Missing Clickjacking Protection",
            severity="HIGH",
            location=f"{target}/login",
            evidence=(
                "The page '/login' has neither X-Frame-Options nor CSP "
                "frame-ancestors header. The page can be embedded in an "
                "iframe on any external site, enabling clickjacking attacks."
            ),
            category=CATEGORY,
            raw_details={
                "path": "/login",
                "is_sensitive": True,
                "x_frame_options": None,
                "csp_frame_ancestors": None,
            },
        ),
        make_finding(
            vulnerability="Weak CSP frame-ancestors (Wildcard)",
            severity="MEDIUM",
            location=f"{target}/",
            evidence=(
                "The page '/' has CSP 'frame-ancestors *' which uses a "
                "wildcard (*) source. This allows any site to embed the page "
                "in an iframe, effectively negating clickjacking protection."
            ),
            category=CATEGORY,
            raw_details={
                "path": "/",
                "csp_frame_ancestors": "frame-ancestors *",
                "sources": ["*"],
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Clickjacking / Frame Protection Scanner")
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

    # Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Test each page
    for path, is_sensitive in TEST_PAGES:
        page_url = target.rstrip("/") + path
        page_findings = check_page(session, page_url, path, is_sensitive, delay, timeout)
        findings.extend(page_findings)

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
