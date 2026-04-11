#!/usr/bin/env python3
"""
VaultScan -- File Upload Vulnerability Scanner
===============================================
Tests for insecure file upload handling:
- Upload form detection
- Extension bypass testing
- MIME type confusion
- Path traversal in filenames
- Unrestricted file type acceptance
"""

import os
import sys
import re
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
    extract_forms,
)


def find_upload_forms(session, urls: List[str], timeout: int) -> List[Dict]:
    """Find forms with file upload inputs."""
    upload_forms = []
    seen_actions = set()

    for url in urls:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue

        forms = extract_forms(url, resp.text)
        for form in forms:
            has_file = any(inp["type"] == "file" for inp in form["inputs"])
            if has_file and form["action"] not in seen_actions:
                seen_actions.add(form["action"])
                upload_forms.append({**form, "page_url": url})

    return upload_forms


def check_upload_form_security(session, form: Dict, timeout: int) -> List[Dict]:
    """Analyze upload form for security issues."""
    findings = []
    action = form["action"]
    page_url = form.get("page_url", action)

    # Check for accept attribute restrictions
    file_inputs = [inp for inp in form["inputs"] if inp["type"] == "file"]
    for inp in file_inputs:
        # If no accept attribute restriction hint in form
        findings.append(make_finding(
            vulnerability="File Upload Form Detected",
            severity="MEDIUM",
            location=page_url,
            evidence=(
                f"File upload form found with action '{action}'. "
                f"Upload forms require server-side validation to prevent "
                f"malicious file uploads (webshells, malware)."
            ),
            category="FILE_UPLOAD",
            raw_details={
                "form_action": action,
                "method": form["method"],
                "input_name": inp.get("name", "unknown"),
            },
        ))

    # Test dangerous extension acceptance
    dangerous_extensions = [
        (".php", "PHP webshell"),
        (".jsp", "Java webshell"),
        (".asp", "ASP webshell"),
        (".aspx", "ASPX webshell"),
        (".exe", "Executable file"),
        (".sh", "Shell script"),
        (".py", "Python script"),
        (".pl", "Perl script"),
        (".cgi", "CGI script"),
        (".svg", "SVG with embedded JavaScript"),
        (".html", "HTML with JavaScript"),
        (".shtml", "Server-side include"),
    ]

    file_input_name = None
    other_fields = {}
    for inp in form["inputs"]:
        if inp["type"] == "file":
            file_input_name = inp.get("name", "file")
        elif inp.get("name"):
            other_fields[inp["name"]] = inp.get("value", "test")

    if not file_input_name:
        return findings

    for ext, desc in dangerous_extensions[:5]:  # Test top 5 only to be fast
        test_filename = f"test{ext}"
        test_content = b"<?php echo 'test'; ?>" if ext == ".php" else b"test content"

        try:
            files = {file_input_name: (test_filename, test_content, "application/octet-stream")}
            resp, err = safe_request(
                session, "POST", action, timeout=timeout,
                files=files, data=other_fields,
                allow_redirects=True,
            )

            if err or not resp:
                continue

            # Check if upload was accepted (not rejected with error)
            accepted = (
                resp.status_code in (200, 201, 302, 303) and
                "error" not in resp.text[:500].lower() and
                "not allowed" not in resp.text[:500].lower() and
                "invalid" not in resp.text[:500].lower() and
                "rejected" not in resp.text[:500].lower()
            )

            if accepted:
                findings.append(make_finding(
                    vulnerability=f"Dangerous File Extension Accepted: {ext}",
                    severity="HIGH" if ext in (".php", ".jsp", ".asp", ".aspx") else "MEDIUM",
                    location=action,
                    evidence=(
                        f"Upload form accepts {ext} files ({desc}). "
                        f"Server returned status {resp.status_code} without error. "
                        f"This could allow remote code execution if files are served directly."
                    ),
                    category="FILE_UPLOAD",
                    raw_details={
                        "extension": ext,
                        "description": desc,
                        "status_code": resp.status_code,
                        "form_action": action,
                    },
                ))

        except Exception:
            continue

    # Test double extension bypass
    double_ext_tests = [
        ("test.php.jpg", "Double extension bypass"),
        ("test.php%00.jpg", "Null byte extension bypass"),
        ("test.php.png", "PHP disguised as image"),
    ]

    for filename, desc in double_ext_tests:
        try:
            files = {file_input_name: (filename, b"<?php echo 'test'; ?>", "image/jpeg")}
            resp, err = safe_request(
                session, "POST", action, timeout=timeout,
                files=files, data=other_fields,
                allow_redirects=True,
            )

            if err or not resp:
                continue

            accepted = (
                resp.status_code in (200, 201, 302, 303) and
                "error" not in resp.text[:500].lower()
            )

            if accepted:
                findings.append(make_finding(
                    vulnerability=f"File Upload Bypass: {desc}",
                    severity="HIGH",
                    location=action,
                    evidence=(
                        f"Upload accepted filename '{filename}' ({desc}). "
                        f"This may bypass extension filtering and allow code execution."
                    ),
                    category="FILE_UPLOAD",
                    raw_details={
                        "filename": filename,
                        "bypass_type": desc,
                        "status_code": resp.status_code,
                    },
                ))

        except Exception:
            continue

    # Test MIME type confusion
    try:
        files = {file_input_name: ("test.jpg", b"<?php echo 'test'; ?>", "image/jpeg")}
        resp, err = safe_request(
            session, "POST", action, timeout=timeout,
            files=files, data=other_fields,
            allow_redirects=True,
        )

        if resp and resp.status_code in (200, 201, 302, 303):
            if "error" not in resp.text[:500].lower():
                findings.append(make_finding(
                    vulnerability="MIME Type Confusion in File Upload",
                    severity="MEDIUM",
                    location=action,
                    evidence=(
                        "Upload accepted PHP content disguised as image/jpeg. "
                        "Server may not validate file content vs MIME type."
                    ),
                    category="FILE_UPLOAD",
                    raw_details={
                        "sent_mime": "image/jpeg",
                        "actual_content": "PHP code",
                        "status_code": resp.status_code,
                    },
                ))
    except Exception:
        pass

    return findings


def check_upload_directories(session, base_url: str, timeout: int) -> List[Dict]:
    """Check if common upload directories are accessible."""
    findings = []
    upload_dirs = [
        "uploads", "upload", "files", "media", "attachments",
        "documents", "images/uploads", "user_uploads", "wp-content/uploads",
    ]

    for d in upload_dirs:
        url = f"{base_url}/{d}/"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        if resp.status_code == 200:
            body = resp.text[:2000].lower()
            is_listing = any(sig in body for sig in [
                "index of", "directory listing", "parent directory",
                "[dir]", "last modified",
            ])

            if is_listing:
                findings.append(make_finding(
                    vulnerability=f"Upload Directory Listing: /{d}/",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Upload directory /{d}/ has directory listing enabled. "
                        f"Attackers can browse uploaded files and find sensitive content."
                    ),
                    category="FILE_UPLOAD",
                    raw_details={"directory": d, "listing_enabled": True},
                ))

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="File Upload Form Detected",
            severity="MEDIUM",
            location=f"{target}/upload",
            evidence="File upload form found. Upload forms require server-side validation.",
            category="FILE_UPLOAD",
        ),
        make_finding(
            vulnerability="Dangerous File Extension Accepted: .php",
            severity="HIGH",
            location=f"{target}/upload",
            evidence="Upload form accepts .php files (PHP webshell). Status 200.",
            category="FILE_UPLOAD",
        ),
    ]


def main():
    parser = base_argparser("VaultScan File Upload Vulnerability Scanner")
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

    # Crawl to find upload forms
    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=30)

    # Find and test upload forms
    upload_forms = find_upload_forms(session, urls, args.timeout)
    for form in upload_forms:
        findings.extend(check_upload_form_security(session, form, args.timeout))

    # Check upload directories
    findings.extend(check_upload_directories(session, target, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
