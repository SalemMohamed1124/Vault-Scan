#!/usr/bin/env python3
"""
VaultScan — GraphQL Security Scanner
======================================
Deep GraphQL endpoint security testing:
  1. Discover GraphQL endpoints by testing common paths
  2. Test introspection query (__schema) — if enabled = MEDIUM
  3. Check for GraphQL IDE/playground exposed (GraphiQL, Altair)
  4. Test query depth attacks (deeply nested query)
  5. Test batch query support (send array of queries)
  6. Check for field suggestions in error messages (information disclosure)
  7. Test mutation access without auth
  8. Check rate limiting on GraphQL endpoint

Outputs JSON array of findings to stdout.
"""

import os
import sys
import time
import json as _json
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Ensure scan_utils is importable from the same directory
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    base_argparser,
    is_mock_mode,
    output_findings,
    output_error,
    normalize_url,
    create_session,
    safe_request,
    make_finding,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "GRAPHQL"

# Common GraphQL endpoint paths
GRAPHQL_PATHS = [
    "/graphql",
    "/graphiql",
    "/api/graphql",
    "/v1/graphql",
    "/gql",
    "/query",
    "/api/gql",
    "/graphql/console",
    "/v2/graphql",
    "/api/v1/graphql",
]

# Introspection query
INTROSPECTION_QUERY = {
    "query": "{ __schema { types { name fields { name } } } }"
}

# Simple type-name query (lightweight probe)
PROBE_QUERY = {
    "query": "{ __typename }"
}

# Deep nested query for depth-limit testing
DEPTH_QUERY = {
    "query": (
        "{ __typename "
        "__schema { types { name fields { name type { name fields { name "
        "type { name fields { name type { name fields { name type { name "
        "fields { name type { name } } } } } } } } } } } } }"
    )
}

# Batch query (array of queries)
BATCH_QUERIES = [
    {"query": "{ __typename }"},
    {"query": "{ __typename }"},
    {"query": "{ __typename }"},
]

# Field suggestion probe — intentionally misspelled field
SUGGESTION_QUERY = {
    "query": "{ __typenme }"
}

# Common mutation probes (no auth)
MUTATION_PROBES = [
    {
        "query": 'mutation { createUser(input: {email: "test@test.com", password: "test123"}) { id } }',
        "label": "createUser",
    },
    {
        "query": 'mutation { register(email: "test@test.com", password: "test123") { id } }',
        "label": "register",
    },
    {
        "query": 'mutation { updateSettings(input: {debug: true}) { success } }',
        "label": "updateSettings",
    },
    {
        "query": 'mutation { deleteUser(id: "1") { success } }',
        "label": "deleteUser",
    },
]

# IDE / playground indicators in HTML responses
PLAYGROUND_INDICATORS = [
    ("graphiql", "GraphiQL"),
    ("graphql-playground", "GraphQL Playground"),
    ("altair", "Altair GraphQL Client"),
    ("graphql-voyager", "GraphQL Voyager"),
    ("apollo-server", "Apollo Server"),
    ("sandbox.embed", "Apollo Sandbox"),
]

# Rate-limit test: number of rapid requests
RATE_LIMIT_REQUESTS = 20


# ---------------------------------------------------------------------------
# Endpoint Discovery
# ---------------------------------------------------------------------------
def discover_graphql_endpoints(
    session,
    target: str,
    timeout: int,
) -> List[str]:
    """
    Probe common paths to find active GraphQL endpoints.
    A path is considered a GraphQL endpoint if it responds with valid JSON
    to the __typename probe or returns a recognisable GraphQL error.
    """
    endpoints: List[str] = []

    for path in GRAPHQL_PATHS:
        url = f"{target}{path}"

        # Try POST with JSON body (standard GraphQL transport)
        resp, err = safe_request(
            session, "POST", url, timeout=timeout,
            json=PROBE_QUERY,
            headers={"Content-Type": "application/json"},
        )
        if resp is not None and resp.status_code in (200, 400, 405):
            body = resp.text.lower()
            if any(marker in body for marker in [
                "__typename", "errors", "graphql", "query", "must provide",
                "syntax error", "cannot query",
            ]):
                endpoints.append(url)
                continue

        # Try GET with query param
        resp, err = safe_request(
            session, "GET", url, timeout=timeout,
            params={"query": "{ __typename }"},
        )
        if resp is not None and resp.status_code in (200, 400):
            body = resp.text.lower()
            if any(marker in body for marker in [
                "__typename", "errors", "graphql", "query",
            ]):
                endpoints.append(url)

    return endpoints


# ---------------------------------------------------------------------------
# 1. Introspection Check
# ---------------------------------------------------------------------------
def check_introspection(
    session,
    endpoint: str,
    timeout: int,
) -> List[Dict]:
    """Test if full introspection is enabled on the GraphQL endpoint."""
    findings: List[Dict] = []

    resp, err = safe_request(
        session, "POST", endpoint, timeout=timeout,
        json=INTROSPECTION_QUERY,
        headers={"Content-Type": "application/json"},
    )
    if resp is None:
        return findings

    try:
        data = resp.json()
    except Exception:
        return findings

    # Check if __schema data is present in the response
    has_schema = False
    if isinstance(data, dict):
        if "data" in data and data["data"] and "__schema" in data.get("data", {}):
            schema = data["data"]["__schema"]
            if isinstance(schema, dict) and "types" in schema:
                has_schema = True

    if has_schema:
        type_names = []
        try:
            type_names = [t["name"] for t in schema["types"] if not t["name"].startswith("__")][:10]
        except Exception:
            pass

        findings.append(make_finding(
            vulnerability="GraphQL Introspection Enabled",
            severity="MEDIUM",
            location=endpoint,
            evidence=(
                "Full GraphQL introspection is enabled. An attacker can query "
                "__schema to enumerate all types, fields, queries, and mutations, "
                "revealing the entire API surface. "
                f"Sample types found: {', '.join(type_names) if type_names else 'N/A'}."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "types_count": len(schema.get("types", [])),
                "sample_types": type_names,
                "status_code": resp.status_code,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 2. GraphQL IDE / Playground Exposed
# ---------------------------------------------------------------------------
def check_playground_exposed(
    session,
    target: str,
    timeout: int,
) -> List[Dict]:
    """Check if a GraphQL IDE or playground is publicly accessible."""
    findings: List[Dict] = []

    ide_paths = [
        "/graphiql",
        "/graphql",
        "/playground",
        "/graphql/playground",
        "/api/graphql",
        "/altair",
        "/graphql-explorer",
    ]

    for path in ide_paths:
        url = f"{target}{path}"
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if resp is None or resp.status_code != 200:
            continue

        body = resp.text.lower()
        content_type = resp.headers.get("Content-Type", "").lower()

        # Only check HTML responses for IDE indicators
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            continue

        for indicator, ide_name in PLAYGROUND_INDICATORS:
            if indicator in body:
                findings.append(make_finding(
                    vulnerability="GraphQL IDE/Playground Exposed",
                    severity="MEDIUM",
                    location=url,
                    evidence=(
                        f"{ide_name} is publicly accessible at {url}. "
                        f"This interactive interface allows anyone to explore "
                        f"the API schema, craft queries, and test mutations "
                        f"without authentication."
                    ),
                    category=CATEGORY,
                    confidence="HIGH",
                    raw_details={
                        "ide_name": ide_name,
                        "indicator": indicator,
                        "path": path,
                        "status_code": resp.status_code,
                    },
                ))
                break  # One finding per path

    # Deduplicate by location
    seen: set = set()
    deduped: List[Dict] = []
    for f in findings:
        if f["location"] not in seen:
            seen.add(f["location"])
            deduped.append(f)

    return deduped


# ---------------------------------------------------------------------------
# 3. Query Depth Attack
# ---------------------------------------------------------------------------
def check_query_depth(
    session,
    endpoint: str,
    timeout: int,
) -> List[Dict]:
    """Test whether the server enforces query depth limits."""
    findings: List[Dict] = []

    resp, err = safe_request(
        session, "POST", endpoint, timeout=timeout,
        json=DEPTH_QUERY,
        headers={"Content-Type": "application/json"},
    )
    if resp is None:
        return findings

    try:
        data = resp.json()
    except Exception:
        return findings

    # If the deeply nested query succeeds without depth error, no limit
    has_data = isinstance(data, dict) and data.get("data") is not None
    has_depth_error = False

    if isinstance(data, dict) and "errors" in data:
        errors_text = str(data["errors"]).lower()
        if any(kw in errors_text for kw in ["depth", "too complex", "complexity", "nested"]):
            has_depth_error = True

    if has_data and not has_depth_error:
        findings.append(make_finding(
            vulnerability="GraphQL No Query Depth Limit",
            severity="MEDIUM",
            location=endpoint,
            evidence=(
                "The GraphQL endpoint processes deeply nested queries without "
                "enforcing a depth limit. An attacker can craft recursive queries "
                "to cause denial-of-service by exhausting server resources."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "query_depth": "6+ levels nested",
                "status_code": resp.status_code,
                "response_has_data": True,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 4. Batch Query Support
# ---------------------------------------------------------------------------
def check_batch_queries(
    session,
    endpoint: str,
    timeout: int,
) -> List[Dict]:
    """Test whether the endpoint accepts batched queries (array of operations)."""
    findings: List[Dict] = []

    resp, err = safe_request(
        session, "POST", endpoint, timeout=timeout,
        json=BATCH_QUERIES,
        headers={"Content-Type": "application/json"},
    )
    if resp is None:
        return findings

    try:
        data = resp.json()
    except Exception:
        return findings

    # Batch queries return an array of results
    if isinstance(data, list) and len(data) >= 2:
        findings.append(make_finding(
            vulnerability="GraphQL Batch Query Supported",
            severity="LOW",
            location=endpoint,
            evidence=(
                f"The GraphQL endpoint accepts batched queries (sent {len(BATCH_QUERIES)} "
                f"queries, received {len(data)} responses). Batch queries can be "
                f"abused to bypass rate limiting, brute-force authentication, or "
                f"amplify denial-of-service attacks."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "queries_sent": len(BATCH_QUERIES),
                "responses_received": len(data),
                "status_code": resp.status_code,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# 5. Field Suggestions (Information Disclosure)
# ---------------------------------------------------------------------------
def check_field_suggestions(
    session,
    endpoint: str,
    timeout: int,
) -> List[Dict]:
    """Check if error messages contain field suggestions that leak schema info."""
    findings: List[Dict] = []

    resp, err = safe_request(
        session, "POST", endpoint, timeout=timeout,
        json=SUGGESTION_QUERY,
        headers={"Content-Type": "application/json"},
    )
    if resp is None:
        return findings

    try:
        data = resp.json()
    except Exception:
        return findings

    if isinstance(data, dict) and "errors" in data:
        errors_text = str(data["errors"])
        suggestion_keywords = ["did you mean", "suggest", "similar", "perhaps you meant"]
        has_suggestion = any(kw in errors_text.lower() for kw in suggestion_keywords)

        if has_suggestion:
            findings.append(make_finding(
                vulnerability="GraphQL Field Suggestions Enabled",
                severity="LOW",
                location=endpoint,
                evidence=(
                    "The GraphQL endpoint provides field name suggestions in error "
                    "messages (e.g., 'Did you mean __typename?'). Attackers can "
                    "systematically probe field names to reconstruct the schema, "
                    "even when introspection is disabled."
                ),
                category=CATEGORY,
                confidence="HIGH",
                raw_details={
                    "error_message": errors_text[:500],
                    "status_code": resp.status_code,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# 6. Mutation Access Without Auth
# ---------------------------------------------------------------------------
def check_mutations_no_auth(
    session,
    endpoint: str,
    timeout: int,
) -> List[Dict]:
    """
    Test common mutation operations without authentication.
    If any mutation is processed (not rejected with auth error), flag it.
    """
    findings: List[Dict] = []

    for probe in MUTATION_PROBES:
        resp, err = safe_request(
            session, "POST", endpoint, timeout=timeout,
            json={"query": probe["query"]},
            headers={"Content-Type": "application/json"},
        )
        if resp is None:
            continue

        try:
            data = resp.json()
        except Exception:
            continue

        if not isinstance(data, dict):
            continue

        # Check if mutation was actually processed (has data, no auth error)
        has_data = data.get("data") is not None
        errors = data.get("errors", [])
        errors_text = str(errors).lower()

        # Auth-related error keywords
        auth_errors = [
            "unauthorized", "unauthenticated", "forbidden",
            "not authenticated", "access denied", "login required",
            "must be logged in", "permission denied", "auth",
        ]
        has_auth_error = any(kw in errors_text for kw in auth_errors)

        # Schema errors mean the mutation doesn't exist (not a vuln)
        schema_errors = [
            "cannot query field", "unknown field", "not found",
            "undefined", "does not exist", "is not defined",
        ]
        has_schema_error = any(kw in errors_text for kw in schema_errors)

        if has_data and not has_auth_error and not has_schema_error:
            findings.append(make_finding(
                vulnerability="GraphQL Mutation Accessible Without Authentication",
                severity="HIGH",
                location=endpoint,
                evidence=(
                    f"The mutation '{probe['label']}' was processed without "
                    f"authentication. Sensitive mutations should require valid "
                    f"credentials to prevent unauthorized data modification."
                ),
                category=CATEGORY,
                confidence="MEDIUM",
                raw_details={
                    "mutation": probe["label"],
                    "query": probe["query"][:200],
                    "status_code": resp.status_code,
                    "has_data": True,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# 7. Rate Limiting Check
# ---------------------------------------------------------------------------
def check_rate_limiting(
    session,
    endpoint: str,
    timeout: int,
) -> List[Dict]:
    """Send rapid GraphQL requests to check if rate limiting is enforced."""
    findings: List[Dict] = []

    success_count = 0
    rate_limited = False
    status_codes: List[int] = []

    for i in range(RATE_LIMIT_REQUESTS):
        resp, err = safe_request(
            session, "POST", endpoint, timeout=timeout,
            json=PROBE_QUERY,
            headers={"Content-Type": "application/json"},
        )
        if resp is None:
            continue

        status_codes.append(resp.status_code)

        if resp.status_code == 429:
            rate_limited = True
            break

        # Some servers return 403 or include rate-limit headers
        rate_headers = [
            "x-ratelimit-remaining", "x-rate-limit-remaining",
            "retry-after", "ratelimit-remaining",
        ]
        for header in rate_headers:
            if header in (h.lower() for h in resp.headers.keys()):
                remaining = resp.headers.get(header, resp.headers.get(header.title(), ""))
                if remaining and remaining.isdigit() and int(remaining) <= 0:
                    rate_limited = True
                    break

        if rate_limited:
            break

        if resp.status_code == 200:
            success_count += 1

    if not rate_limited and success_count >= RATE_LIMIT_REQUESTS - 2:
        findings.append(make_finding(
            vulnerability="GraphQL Endpoint Not Rate Limited",
            severity="LOW",
            location=endpoint,
            evidence=(
                f"Sent {RATE_LIMIT_REQUESTS} rapid requests to the GraphQL endpoint "
                f"without being rate-limited. {success_count} requests succeeded "
                f"(HTTP 200). Without rate limiting, attackers can brute-force "
                f"queries, perform denial-of-service, or abuse batch operations."
            ),
            category=CATEGORY,
            confidence="MEDIUM",
            raw_details={
                "requests_sent": RATE_LIMIT_REQUESTS,
                "successful": success_count,
                "status_codes": list(set(status_codes)),
                "rate_limited": False,
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
            vulnerability="GraphQL Introspection Enabled",
            severity="MEDIUM",
            location=f"{target}/graphql",
            evidence=(
                "Full GraphQL introspection is enabled. An attacker can query "
                "__schema to enumerate all types, fields, queries, and mutations, "
                "revealing the entire API surface. "
                "Sample types found: User, Post, Comment, Organization, Setting."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "types_count": 42,
                "sample_types": ["User", "Post", "Comment", "Organization", "Setting"],
                "status_code": 200,
            },
        ),
        make_finding(
            vulnerability="GraphQL IDE/Playground Exposed",
            severity="MEDIUM",
            location=f"{target}/graphiql",
            evidence=(
                "GraphiQL is publicly accessible at the endpoint. "
                "This interactive interface allows anyone to explore "
                "the API schema, craft queries, and test mutations "
                "without authentication."
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "ide_name": "GraphiQL",
                "indicator": "graphiql",
                "path": "/graphiql",
                "status_code": 200,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — GraphQL Security Scanner")
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
    findings: List[Dict] = []

    # Step 0: Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Step 1: Discover GraphQL endpoints
    endpoints = discover_graphql_endpoints(session, target, timeout)

    if not endpoints:
        # No GraphQL endpoints found — return empty findings
        output_findings([])
        return

    # Step 2: Run all checks against each discovered endpoint
    seen_keys: set = set()

    for endpoint in endpoints:
        checks = [
            check_introspection(session, endpoint, timeout),
            check_playground_exposed(session, target, timeout),
            check_query_depth(session, endpoint, timeout),
            check_batch_queries(session, endpoint, timeout),
            check_field_suggestions(session, endpoint, timeout),
            check_mutations_no_auth(session, endpoint, timeout),
            check_rate_limiting(session, endpoint, timeout),
        ]

        for check_results in checks:
            for f in check_results:
                key = (f["vulnerability"], f["location"])
                if key not in seen_keys:
                    seen_keys.add(key)
                    findings.append(f)

    output_findings(findings)


if __name__ == "__main__":
    main()
