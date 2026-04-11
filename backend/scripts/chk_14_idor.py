#!/usr/bin/env python3
"""
VaultScan — IDOR (Insecure Direct Object Reference) Detection Scanner (Production)
=====================================================================================
Enhanced IDOR detection with:

1. **Parameter-based enumeration** — numeric IDs in query params
2. **Path-based enumeration** — numeric IDs in URL paths
3. **UUID prediction detection** — sequential or predictable UUIDs
4. **Response fingerprinting** — structural comparison to reduce false positives
5. **HTTP method testing** — tests PUT/DELETE on discovered resources
6. **API pattern detection** — identifies REST API patterns with ID references
7. **Deep crawling** — finds more endpoints to test

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
import time
import hashlib
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, urljoin, parse_qs, urlencode, urlunparse

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
    response_fingerprint,
    responses_differ,
    DEFAULT_TIMEOUT,
    DEFAULT_DELAY,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "ACCESS_CONTROL"
MAX_CRAWL_PAGES = 5
MAX_ENDPOINTS_TO_TEST = 30
MAX_NEARBY_IDS = 3

# Extended parameter name patterns
IDOR_PARAM_NAMES: Set[str] = {
    "id", "uid", "user_id", "userid", "user",
    "account", "accountid", "account_id",
    "order", "orderid", "order_id",
    "invoice", "invoiceid", "invoice_id",
    "doc", "docid", "doc_id", "document", "document_id",
    "file", "fileid", "file_id", "filename",
    "record", "recordid", "record_id",
    "item", "itemid", "item_id",
    "product", "productid", "product_id",
    "profile", "profileid", "profile_id",
    "report", "reportid", "report_id",
    "ticket", "ticketid", "ticket_id",
    "message", "messageid", "message_id",
    "comment", "commentid", "comment_id",
    "post", "postid", "post_id",
    "page", "num", "number", "ref", "key",
    "pid", "oid", "cid", "rid", "mid", "tid",
    "project", "project_id", "projectid",
    "org", "org_id", "orgid", "organization_id",
    "team", "team_id", "teamid",
    "workspace", "workspace_id",
    "channel", "channel_id",
    "group", "group_id", "groupid",
    "member", "member_id",
    "role", "role_id",
    "session", "session_id",
    "token", "api_key",
    "scan", "scan_id", "scanid",
    "asset", "asset_id", "assetid",
    "finding", "finding_id",
    "notification", "notification_id",
}

# Extended path patterns
PATH_ID_PATTERNS = [
    re.compile(
        r"/(?:api/(?:v\d+/)?)?(?:users?|orders?|accounts?|profiles?|items?|products?|"
        r"invoices?|tickets?|messages?|comments?|posts?|reports?|documents?|"
        r"files?|projects?|organizations?|teams?|workspaces?|channels?|"
        r"groups?|members?|roles?|sessions?|scans?|assets?|findings?|"
        r"notifications?|customers?|employees?|tasks?|events?|payments?|"
        r"subscriptions?|plans?|configs?|settings?)/(\d+)",
        re.IGNORECASE,
    ),
    # UUID path pattern
    re.compile(
        r"/(?:api/(?:v\d+/)?)?(?:users?|orders?|accounts?|profiles?|items?|products?|"
        r"reports?|documents?|scans?|assets?|findings?)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
        re.IGNORECASE,
    ),
]

AUTH_INDICATORS = re.compile(
    r"(?:login|sign[\s_-]?in|log[\s_-]?in|unauthorized|forbidden|"
    r"authentication[\s_-]required|access[\s_-]denied|please[\s_-]log[\s_-]?in|"
    r"session[\s_-]expired|not[\s_-]authenticated|401|403)",
    re.IGNORECASE,
)

ERROR_PAGE_INDICATORS = re.compile(
    r"(?:<title>(?:404|500|error|not\s+found|page\s+not\s+found)</title>|"
    r'"error"\s*:\s*"[^"]*not\s+found"|'
    r'"status"\s*:\s*(?:404|500)|'
    r'"message"\s*:\s*"[^"]*not\s+found"|'
    r"page\s+not\s+found|resource\s+not\s+found)",
    re.IGNORECASE,
)

MIN_MEANINGFUL_LENGTH = 50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_idor_param(param_name: str) -> bool:
    return param_name.lower() in IDOR_PARAM_NAMES


def _is_numeric(value: str) -> bool:
    return bool(value) and value.isdigit()


def _is_uuid(value: str) -> bool:
    return bool(re.match(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        value, re.I
    ))


def _get_nearby_ids(original_id: str) -> List[str]:
    try:
        val = int(original_id)
    except ValueError:
        return []
    nearby = []
    if val > 1:
        nearby.append(str(val - 1))
    nearby.append(str(val + 1))
    if val > 2:
        nearby.append(str(val + 2))
    return nearby[:MAX_NEARBY_IDS]


def _get_nearby_uuids(original_uuid: str) -> List[str]:
    """Generate nearby UUIDs for v1/v4 prediction testing."""
    parts = original_uuid.split("-")
    if len(parts) != 5:
        return []
    # Try incrementing the last segment (common in sequential UUIDs)
    try:
        last_int = int(parts[4], 16)
        nearby = []
        if last_int > 0:
            parts_copy = parts.copy()
            parts_copy[4] = format(last_int - 1, '012x')
            nearby.append("-".join(parts_copy))
        parts_copy = parts.copy()
        parts_copy[4] = format(last_int + 1, '012x')
        nearby.append("-".join(parts_copy))
        return nearby
    except ValueError:
        return []


def _has_auth_content(text: str) -> bool:
    return bool(AUTH_INDICATORS.search(text[:5000]))


def _is_error_page(text: str, status_code: int) -> bool:
    if status_code >= 400:
        return True
    return bool(ERROR_PAGE_INDICATORS.search(text[:5000]))


def _is_meaningful_response(text: str, status_code: int) -> bool:
    if status_code != 200:
        return False
    if len(text) < MIN_MEANINGFUL_LENGTH:
        return False
    if _is_error_page(text, status_code):
        return False
    if _has_auth_content(text):
        return False
    return True


def _responses_are_identical(texts: List[str]) -> bool:
    if len(texts) < 2:
        return False
    return all(t == texts[0] for t in texts[1:])


def _structural_diff(text1: str, text2: str) -> float:
    """Calculate structural difference ratio between two responses."""
    if not text1 and not text2:
        return 0.0
    if not text1 or not text2:
        return 1.0

    # Compare structure: strip variable content
    strip_pattern = re.compile(r'\b\d+\b|"[^"]{20,}"')
    s1 = strip_pattern.sub("VAR", text1[:5000])
    s2 = strip_pattern.sub("VAR", text2[:5000])

    if s1 == s2:
        return 0.0

    # Simple diff: count different lines
    lines1 = set(s1.split("\n"))
    lines2 = set(s2.split("\n"))
    total = max(len(lines1), len(lines2))
    if total == 0:
        return 0.0
    diff = len(lines1.symmetric_difference(lines2))
    return diff / total


def _build_path_with_id(url: str, match: re.Match, new_id: str) -> str:
    parsed = urlparse(url)
    start, end = match.span(1)
    new_path = parsed.path[:start] + new_id + parsed.path[end:]
    return urlunparse(parsed._replace(path=new_path))


def _pattern_key_for_param(url: str, param: str) -> str:
    parsed = urlparse(url)
    return f"param:{parsed.netloc}{parsed.path}?{param}"


def _pattern_key_for_path(url: str, match: re.Match) -> str:
    parsed = urlparse(url)
    start, end = match.span(1)
    pattern_path = parsed.path[:start] + "{id}" + parsed.path[end:]
    return f"path:{parsed.netloc}{pattern_path}"


# ---------------------------------------------------------------------------
# Core Detection: Parameter-based IDOR (Enhanced)
# ---------------------------------------------------------------------------
def test_param_idor(
    session, url: str, param: str, original_value: str,
    delay: float, timeout: int,
) -> List[Dict]:
    findings: List[Dict] = []

    resp_orig, err = rate_limited_request(
        session, "GET", url, delay=delay, timeout=timeout,
    )
    if err or resp_orig is None:
        return findings

    orig_status = resp_orig.status_code
    orig_text = resp_orig.text
    orig_length = len(orig_text)
    orig_fp = response_fingerprint(resp_orig) if orig_status == 200 else ""

    # Determine nearby IDs based on value type
    if _is_uuid(original_value):
        nearby_ids = _get_nearby_uuids(original_value)
        id_type = "UUID"
    elif _is_numeric(original_value):
        nearby_ids = _get_nearby_ids(original_value)
        id_type = "numeric"
    else:
        return findings

    if not nearby_ids:
        return findings

    tested_responses: Dict[str, Dict] = {}
    response_texts: List[str] = [orig_text]
    has_different_200 = False
    successful_nearby: List[str] = []

    for test_id in nearby_ids:
        test_url = replace_url_param(url, param, test_id)
        resp_test, err = rate_limited_request(
            session, "GET", test_url, delay=delay, timeout=timeout,
        )
        if err or resp_test is None:
            tested_responses[test_id] = {"status": 0, "length": 0}
            continue

        test_status = resp_test.status_code
        test_text = resp_test.text
        test_length = len(test_text)

        tested_responses[test_id] = {
            "status": test_status,
            "length": test_length,
        }

        if _is_meaningful_response(test_text, test_status):
            response_texts.append(test_text)
            successful_nearby.append(test_id)

            if _is_meaningful_response(orig_text, orig_status):
                # Use structural diff for better comparison
                diff_ratio = _structural_diff(orig_text, test_text)
                if diff_ratio > 0.1:  # More than 10% structural difference
                    has_different_200 = True

    if _responses_are_identical(response_texts) and len(response_texts) > 1:
        return findings

    if has_different_200:
        nearby_example = successful_nearby[0] if successful_nearby else nearby_ids[0]
        nearby_info = tested_responses.get(nearby_example, {})
        severity = "HIGH"
        findings.append(make_finding(
            vulnerability="Potential IDOR: Enumerable Resource via Parameter",
            severity=severity,
            location=url,
            evidence=(
                f"Parameter '{param}' with {id_type} value '{original_value}' returns "
                f"{orig_status} ({orig_length} bytes). Nearby ID '{nearby_example}' "
                f"returns {nearby_info.get('status', 'N/A')} "
                f"({nearby_info.get('length', 'N/A')} bytes) with different content, "
                f"suggesting enumerable resources without authorization checks."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "parameter": param,
                "original_value": original_value,
                "id_type": id_type,
                "tested_ids": list(tested_responses.keys()),
                "responses": tested_responses,
                "technique": "param-enumeration",
            },
        ))
    elif successful_nearby:
        severity = "MEDIUM"
        findings.append(make_finding(
            vulnerability="Predictable Resource ID Pattern",
            severity=severity,
            location=url,
            evidence=(
                f"Parameter '{param}' uses sequential {id_type} values. "
                f"Adjacent IDs ({', '.join(successful_nearby)}) return valid responses."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "parameter": param,
                "original_value": original_value,
                "id_type": id_type,
                "tested_ids": list(tested_responses.keys()),
                "responses": tested_responses,
                "technique": "param-enumeration",
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Core Detection: Path-based IDOR (Enhanced)
# ---------------------------------------------------------------------------
def test_path_idor(
    session, url: str, match: re.Match,
    delay: float, timeout: int,
) -> List[Dict]:
    findings: List[Dict] = []
    original_id = match.group(1)

    resp_orig, err = rate_limited_request(
        session, "GET", url, delay=delay, timeout=timeout,
    )
    if err or resp_orig is None:
        return findings

    orig_status = resp_orig.status_code
    orig_text = resp_orig.text
    orig_length = len(orig_text)

    # Determine ID type and nearby values
    if _is_uuid(original_id):
        nearby_ids = _get_nearby_uuids(original_id)
        id_type = "UUID"
    elif _is_numeric(original_id):
        nearby_ids = _get_nearby_ids(original_id)
        id_type = "numeric"
    else:
        return findings

    if not nearby_ids:
        return findings

    start, end = match.span(1)
    parsed = urlparse(url)
    path_pattern = parsed.path[:start] + "{id}" + parsed.path[end:]

    tested_responses: Dict[str, Dict] = {}
    response_texts: List[str] = [orig_text]
    has_different_200 = False
    successful_nearby: List[str] = []

    for test_id in nearby_ids:
        test_url = _build_path_with_id(url, match, test_id)
        resp_test, err = rate_limited_request(
            session, "GET", test_url, delay=delay, timeout=timeout,
        )
        if err or resp_test is None:
            tested_responses[test_id] = {"status": 0, "length": 0}
            continue

        test_status = resp_test.status_code
        test_text = resp_test.text
        test_length = len(test_text)

        tested_responses[test_id] = {
            "status": test_status,
            "length": test_length,
        }

        if _is_meaningful_response(test_text, test_status):
            response_texts.append(test_text)
            successful_nearby.append(test_id)

            if _is_meaningful_response(orig_text, orig_status):
                diff_ratio = _structural_diff(orig_text, test_text)
                if diff_ratio > 0.1:
                    has_different_200 = True

    if _responses_are_identical(response_texts) and len(response_texts) > 1:
        return findings

    if has_different_200:
        nearby_example = successful_nearby[0] if successful_nearby else nearby_ids[0]
        nearby_info = tested_responses.get(nearby_example, {})
        severity = "HIGH" if "/api/" in url.lower() else "MEDIUM"
        findings.append(make_finding(
            vulnerability="Potential IDOR: Sequential ID in API Endpoint",
            severity=severity,
            location=url,
            evidence=(
                f"Requests to {path_pattern.replace('{id}', original_id)} and "
                f"{path_pattern.replace('{id}', nearby_example)} both return "
                f"200 OK with different content ({orig_length} vs "
                f"{nearby_info.get('length', 'N/A')} bytes), suggesting "
                f"enumerable data."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "path_pattern": path_pattern,
                "original_id": original_id,
                "id_type": id_type,
                "tested_ids": list(tested_responses.keys()),
                "responses": tested_responses,
                "technique": "path-enumeration",
            },
        ))
    elif successful_nearby:
        severity = "MEDIUM"
        findings.append(make_finding(
            vulnerability="Potential IDOR: Sequential ID in API Endpoint",
            severity=severity,
            location=url,
            evidence=(
                f"Path pattern {path_pattern} uses sequential {id_type} IDs. "
                f"Adjacent IDs ({', '.join(successful_nearby)}) return valid responses."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "path_pattern": path_pattern,
                "original_id": original_id,
                "id_type": id_type,
                "tested_ids": list(tested_responses.keys()),
                "responses": tested_responses,
                "technique": "path-enumeration",
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# HTTP Method Testing (NEW)
# ---------------------------------------------------------------------------
def test_unsafe_methods(
    session, url: str, delay: float, timeout: int,
) -> List[Dict]:
    """Test if PUT/DELETE methods are accessible on resource endpoints."""
    findings: List[Dict] = []

    for method in ["PUT", "DELETE", "PATCH"]:
        resp, err = rate_limited_request(
            session, method, url, delay=delay, timeout=timeout,
        )
        if err or resp is None:
            continue

        # If the server doesn't return 405 Method Not Allowed
        if resp.status_code not in (405, 404, 403, 401):
            findings.append(make_finding(
                vulnerability=f"Resource Accepts {method} Without Auth Check",
                severity="HIGH" if method == "DELETE" else "MEDIUM",
                location=url,
                evidence=(
                    f"{method} request to {url} returned {resp.status_code} "
                    f"instead of 405/403. This may allow unauthorized "
                    f"modification or deletion of resources."
                ),
                category=CATEGORY,
                confidence="MEDIUM",
                raw_details={
                    "method": method,
                    "status_code": resp.status_code,
                    "url": url,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# URL Discovery
# ---------------------------------------------------------------------------
def find_param_idor_candidates(url: str) -> List[Tuple[str, str]]:
    params = extract_url_params(url)
    candidates = []
    for name, values in params.items():
        if _is_idor_param(name) and values:
            value = values[0]
            if _is_numeric(value) or _is_uuid(value):
                candidates.append((name, value))
    return candidates


def find_path_idor_candidates(url: str) -> List[re.Match]:
    parsed = urlparse(url)
    matches = []
    for pattern in PATH_ID_PATTERNS:
        matches.extend(pattern.finditer(parsed.path))
    return matches


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Potential IDOR: Sequential ID in API Endpoint",
            severity="HIGH",
            location=f"{target}/api/users/1",
            evidence=(
                "Requests to /api/users/1 and /api/users/2 both return "
                "200 OK with different content (1247 vs 1389 bytes), "
                "suggesting enumerable user data."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "path_pattern": "/api/users/{id}",
                "original_id": "1",
                "id_type": "numeric",
                "technique": "path-enumeration",
            },
        ),
        make_finding(
            vulnerability="Resource Accepts DELETE Without Auth Check",
            severity="HIGH",
            location=f"{target}/api/orders/42",
            evidence=(
                "DELETE request to /api/orders/42 returned 200 "
                "instead of 405/403. This may allow unauthorized deletion."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "method": "DELETE",
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="Predictable Resource ID Pattern",
            severity="MEDIUM",
            location=f"{target}/profile?id=100",
            evidence=(
                "Parameter 'id' uses sequential numeric values. "
                "Adjacent IDs (99, 101) return valid responses."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "parameter": "id",
                "original_value": "100",
                "id_type": "numeric",
                "technique": "param-enumeration",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — IDOR Detection Scanner")
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
    tested_patterns: Set[str] = set()
    endpoints_tested = 0

    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Deep crawl
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout,
            max_pages=MAX_CRAWL_PAGES, depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    if target not in pages:
        pages.insert(0, target)

    for page_url in pages:
        if endpoints_tested >= MAX_ENDPOINTS_TO_TEST:
            break

        # Test query parameters
        param_candidates = find_param_idor_candidates(page_url)
        for param_name, param_value in param_candidates:
            if endpoints_tested >= MAX_ENDPOINTS_TO_TEST:
                break

            pattern_key = _pattern_key_for_param(page_url, param_name)
            if pattern_key in tested_patterns:
                continue
            tested_patterns.add(pattern_key)
            endpoints_tested += 1

            param_findings = test_param_idor(
                session, page_url, param_name, param_value, delay, timeout,
            )
            findings.extend(param_findings)

        # Test path-based IDs
        for pattern in PATH_ID_PATTERNS:
            for match in pattern.finditer(urlparse(page_url).path):
                if endpoints_tested >= MAX_ENDPOINTS_TO_TEST:
                    break

                pattern_key = _pattern_key_for_path(page_url, match)
                if pattern_key in tested_patterns:
                    continue
                tested_patterns.add(pattern_key)
                endpoints_tested += 1

                path_findings = test_path_idor(
                    session, page_url, match, delay, timeout,
                )
                findings.extend(path_findings)

                # Test unsafe HTTP methods on API endpoints
                if "/api/" in page_url.lower():
                    method_findings = test_unsafe_methods(
                        session, page_url, delay, timeout,
                    )
                    findings.extend(method_findings)

    # Deduplicate
    seen: Set[str] = set()
    unique_findings: List[Dict] = []
    for f in findings:
        dedup_key = f"{f['vulnerability']}|{f['location']}"
        if dedup_key not in seen:
            seen.add(dedup_key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
