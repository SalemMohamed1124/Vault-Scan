#!/usr/bin/env python3
"""
VaultScan — Directory Listing Detection
=========================================
Detects directory listing vulnerabilities by checking:
  1. Root and common directories for directory listing indicators
  2. Apache, Nginx, IIS, Spring Boot, Node.js listing patterns
  3. Exposed filenames within directory listings (counted)
  4. .htaccess / web.config protections against listing
  5. Sensitive vs non-sensitive directory severity classification

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
import time
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin

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
    crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "DIRECTORY_LISTING"

# Directories to probe — tuple of (path, is_sensitive)
# Sensitive directories get HIGH severity; others get MEDIUM.
COMMON_DIRS: List[Tuple[str, bool]] = [
    ("/", False),
    ("/images/", False),
    ("/uploads/", True),
    ("/files/", False),
    ("/static/", False),
    ("/media/", False),
    ("/assets/", False),
    ("/backup/", True),
    ("/tmp/", False),
    ("/logs/", True),
    ("/data/", True),
    ("/docs/", False),
    ("/public/", False),
    ("/css/", False),
    ("/js/", False),
    ("/includes/", False),
    ("/lib/", False),
    ("/vendor/", False),
    ("/wp-content/uploads/", True),
]

# ---------------------------------------------------------------------------
# Detection patterns for directory listings
# ---------------------------------------------------------------------------

# Apache-style directory listings
APACHE_PATTERNS = [
    re.compile(r"<title>\s*Index of\s", re.I),
    re.compile(r"Index of /", re.I),
    re.compile(r"<h1>Index of", re.I),
    re.compile(r'Apache/[\d.]+ Server at', re.I),
    re.compile(r"Parent Directory", re.I),
    re.compile(r'<a href="\?C=[NMSD];O=[AD]"', re.I),
    re.compile(r'\[DIR\]', re.I),
    re.compile(r'Last modified\s*</th>', re.I),
]

# Nginx autoindex
NGINX_PATTERNS = [
    re.compile(r"nginx autoindex", re.I),
    re.compile(r"<title>Index of /", re.I),
    re.compile(r'<a href="\.\./">\.\./</a>', re.I),
]

# IIS directory listing
IIS_PATTERNS = [
    re.compile(r"<title>.*- /.*</title>", re.I),
    re.compile(r"Directory Listing", re.I),
    re.compile(r'\[To Parent Directory\]', re.I),
    re.compile(r'Microsoft-IIS', re.I),
]

# Python / Django / Flask / Spring Boot / Node.js
FRAMEWORK_PATTERNS = [
    re.compile(r"Directory listing for\s+/", re.I),           # Python http.server / Django debug
    re.compile(r"<title>Directory listing for", re.I),
    re.compile(r"Whitelabel Error Page", re.I),                # Spring Boot (may reveal structure)
    re.compile(r'"directory":\s*true', re.I),                  # Node.js serve-index JSON
    re.compile(r"serveIndex", re.I),                           # Node.js serve-index
    re.compile(r"<ul id=\"files\">", re.I),                    # Node.js directory listing
]

# Combined quick-match patterns (for initial detection before detailed analysis)
QUICK_INDICATORS = [
    "Index of /",
    "Directory listing for",
    "Parent Directory",
    "[DIR]",
    "Last modified",
    "nginx autoindex",
    "To Parent Directory",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _detect_listing(body: str) -> Optional[Dict]:
    """
    Analyse response body for directory listing indicators.
    Returns a dict with server_type, matched_patterns, confidence
    or None if no listing detected.
    """
    if not body:
        return None

    matched: List[str] = []

    # Quick check first — bail early if nothing matches
    body_lower = body.lower()
    has_any = False
    for indicator in QUICK_INDICATORS:
        if indicator.lower() in body_lower:
            has_any = True
            break
    # Also check framework patterns which may not be in quick list
    if not has_any:
        for pat in FRAMEWORK_PATTERNS:
            if pat.search(body):
                has_any = True
                break
    if not has_any:
        for pat in IIS_PATTERNS:
            if pat.search(body):
                has_any = True
                break

    if not has_any:
        return None

    server_type = "unknown"

    # Check Apache patterns
    apache_hits = 0
    for pat in APACHE_PATTERNS:
        if pat.search(body):
            matched.append(pat.pattern)
            apache_hits += 1

    # Check Nginx patterns
    nginx_hits = 0
    for pat in NGINX_PATTERNS:
        if pat.search(body):
            matched.append(pat.pattern)
            nginx_hits += 1

    # Check IIS patterns
    iis_hits = 0
    for pat in IIS_PATTERNS:
        if pat.search(body):
            matched.append(pat.pattern)
            iis_hits += 1

    # Check framework patterns
    framework_hits = 0
    for pat in FRAMEWORK_PATTERNS:
        if pat.search(body):
            matched.append(pat.pattern)
            framework_hits += 1

    if not matched:
        return None

    # Determine server type by most hits
    hit_map = {
        "Apache": apache_hits,
        "Nginx": nginx_hits,
        "IIS": iis_hits,
        "Framework": framework_hits,
    }
    server_type = max(hit_map, key=hit_map.get)
    if hit_map[server_type] == 0:
        server_type = "unknown"

    total_hits = sum(hit_map.values())
    confidence = "high" if total_hits >= 3 else ("medium" if total_hits >= 2 else "low")

    return {
        "server_type": server_type,
        "matched_patterns": matched,
        "match_count": total_hits,
        "confidence": confidence,
    }


def _extract_filenames(body: str) -> List[str]:
    """
    Extract exposed filenames from a directory listing page.
    Returns a list of filename strings found in the listing.
    """
    filenames: List[str] = []

    # Match href links that look like files (have an extension or end without /)
    # Skip common navigation links like ../, ?C=, etc.
    href_pattern = re.compile(
        r'<a\s+[^>]*href="([^"?#]+)"[^>]*>',
        re.I,
    )
    for match in href_pattern.finditer(body):
        href = match.group(1)
        # Skip parent directory links, query params, absolute URLs
        if href in ("../", "./", "/"):
            continue
        if href.startswith("?") or href.startswith("http://") or href.startswith("https://"):
            continue
        if href.startswith("/"):
            continue
        # Clean trailing slash for directory entries
        name = href.rstrip("/")
        if name and name not in filenames:
            filenames.append(name)

    return filenames


def _check_htaccess(session, target: str, timeout: int) -> Optional[bool]:
    """
    Check if .htaccess is accessible (which might reveal listing config).
    Returns True if .htaccess was found and contains Options -Indexes,
    False if accessible but no protection, None if not accessible.
    """
    url = target.rstrip("/") + "/.htaccess"
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return None
    if resp.status_code != 200:
        return None

    body = resp.text or ""
    if "Options -Indexes" in body or "Options All -Indexes" in body:
        return True
    return False


def _check_webconfig(session, target: str, timeout: int) -> Optional[bool]:
    """
    Check if web.config is accessible and contains directory browsing config.
    Returns True if web.config disables listing, False if it enables listing,
    None if not accessible.
    """
    url = target.rstrip("/") + "/web.config"
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return None
    if resp.status_code != 200:
        return None

    body = resp.text or ""
    # IIS directoryBrowse element
    if re.search(r'directoryBrowse\s+enabled\s*=\s*"false"', body, re.I):
        return True
    if re.search(r'directoryBrowse\s+enabled\s*=\s*"true"', body, re.I):
        return False
    return None


# ---------------------------------------------------------------------------
# Core Check: Analyse a single directory path
# ---------------------------------------------------------------------------
def check_directory(
    session,
    base_url: str,
    path: str,
    is_sensitive: bool,
    timeout: int,
) -> List[Dict]:
    """
    Fetch a directory path and check for directory listing.
    Returns a list of findings (may be empty).
    """
    findings: List[Dict] = []

    url = base_url.rstrip("/") + path
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or resp is None:
        return findings

    # Only check pages that return content
    if resp.status_code != 200:
        return findings

    body = resp.text or ""
    if not body:
        return findings

    listing_info = _detect_listing(body)
    if listing_info is None:
        return findings

    # We detected a directory listing
    severity = "HIGH" if is_sensitive else "MEDIUM"
    filenames = _extract_filenames(body)
    file_count = len(filenames)

    # Build evidence message
    server_label = listing_info["server_type"]
    evidence_parts = [
        f"Directory listing detected at '{path}' "
        f"(server type: {server_label}, confidence: {listing_info['confidence']}).",
    ]
    if file_count > 0:
        sample = filenames[:10]
        sample_str = ", ".join(sample)
        if file_count > 10:
            sample_str += f" ... and {file_count - 10} more"
        evidence_parts.append(
            f"Exposed {file_count} file/directory entries: {sample_str}."
        )
    else:
        evidence_parts.append("No individual file entries could be extracted.")

    evidence = " ".join(evidence_parts)

    findings.append(make_finding(
        vulnerability="Directory Listing Enabled",
        severity=severity,
        location=url,
        evidence=evidence,
        category=CATEGORY,
        raw_details={
            "path": path,
            "is_sensitive": is_sensitive,
            "server_type": server_label,
            "confidence": listing_info["confidence"],
            "matched_patterns_count": listing_info["match_count"],
            "exposed_file_count": file_count,
            "exposed_files_sample": filenames[:20],
        },
    ))

    return findings


# ---------------------------------------------------------------------------
# Configuration file checks
# ---------------------------------------------------------------------------
def check_config_files(
    session,
    target: str,
    timeout: int,
) -> List[Dict]:
    """
    Check for exposed .htaccess or web.config that reveal listing configuration.
    """
    findings: List[Dict] = []

    # Check .htaccess
    htaccess_result = _check_htaccess(session, target, timeout)
    if htaccess_result is False:
        # .htaccess is accessible but does NOT disable indexes
        findings.append(make_finding(
            vulnerability="Exposed .htaccess Without Directory Listing Protection",
            severity="MEDIUM",
            location=target.rstrip("/") + "/.htaccess",
            evidence=(
                "The .htaccess file is publicly accessible and does not contain "
                "'Options -Indexes' to prevent directory listings. The server "
                "configuration may allow directory browsing."
            ),
            category=CATEGORY,
            raw_details={
                "file": ".htaccess",
                "accessible": True,
                "has_options_no_indexes": False,
            },
        ))

    # Check web.config
    webconfig_result = _check_webconfig(session, target, timeout)
    if webconfig_result is False:
        # web.config explicitly enables directory browsing
        findings.append(make_finding(
            vulnerability="web.config Enables Directory Browsing",
            severity="HIGH",
            location=target.rstrip("/") + "/web.config",
            evidence=(
                "The web.config file is publicly accessible and explicitly enables "
                "directory browsing (directoryBrowse enabled=\"true\"). This allows "
                "attackers to enumerate files and directories on the server."
            ),
            category=CATEGORY,
            raw_details={
                "file": "web.config",
                "accessible": True,
                "directory_browse_enabled": True,
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
            vulnerability="Directory Listing Enabled",
            severity="HIGH",
            location=f"{target}/uploads/",
            evidence=(
                "Directory listing detected at '/uploads/' "
                "(server type: Apache, confidence: high). "
                "Exposed 15 file/directory entries: "
                "document.pdf, config_backup.sql, admin_notes.txt, "
                "credentials.bak, report_2025.xlsx ... and 10 more."
            ),
            category=CATEGORY,
            raw_details={
                "path": "/uploads/",
                "is_sensitive": True,
                "server_type": "Apache",
                "confidence": "high",
                "matched_patterns_count": 4,
                "exposed_file_count": 15,
                "exposed_files_sample": [
                    "document.pdf",
                    "config_backup.sql",
                    "admin_notes.txt",
                    "credentials.bak",
                    "report_2025.xlsx",
                ],
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Directory Listing Detection")
    args = parser.parse_args()

    target = normalize_url(args.target)

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

    # Step 0: Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_findings([])
        return

    # Step 1: Check common directories for directory listings
    for path, is_sensitive in COMMON_DIRS:
        time.sleep(delay)
        dir_findings = check_directory(session, target, path, is_sensitive, timeout)
        findings.extend(dir_findings)

    # Step 2: Crawl the site and check any discovered directory-like paths
    try:
        crawled_urls = crawl_same_domain(session, target, max_pages=30, timeout=timeout)
        checked_paths: Set[str] = {p for p, _ in COMMON_DIRS}

        for crawled_url in crawled_urls:
            # Extract path and check if it ends with / (directory-like)
            from urllib.parse import urlparse
            parsed = urlparse(crawled_url)
            cpath = parsed.path
            if not cpath.endswith("/"):
                # Try the parent directory
                last_slash = cpath.rfind("/")
                if last_slash > 0:
                    cpath = cpath[:last_slash + 1]
                else:
                    continue

            if cpath in checked_paths:
                continue
            checked_paths.add(cpath)

            # Determine sensitivity based on path components
            sensitive_keywords = {"upload", "backup", "log", "data", "private", "admin", "secret", "config"}
            path_lower = cpath.lower()
            is_sensitive = any(kw in path_lower for kw in sensitive_keywords)

            time.sleep(delay)
            dir_findings = check_directory(session, target, cpath, is_sensitive, timeout)
            findings.extend(dir_findings)

    except Exception:
        pass  # Crawling is best-effort; continue with what we have

    # Step 3: Check .htaccess and web.config for listing configuration
    config_findings = check_config_files(session, target, timeout)
    findings.extend(config_findings)

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
