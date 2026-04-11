#!/usr/bin/env python3
"""
VaultScan -- Insecure Deserialization Scanner
==============================================
Detects serialized data in cookies, headers, and responses that may indicate
insecure deserialization vulnerabilities across Java, PHP, Python, and .NET.
"""

import os
import sys
import re
import base64
from typing import Dict, List
from urllib.parse import urljoin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
)

# --------------------------------------------------------------------------
# Patterns
# --------------------------------------------------------------------------

# Java serialized object signatures
JAVA_B64_PREFIX = "rO0AB"          # base64-encoded 0xACED0005
JAVA_HEX_PREFIX = "aced0005"       # raw hex

# PHP serialized data patterns
PHP_SERIAL_PATTERNS = [
    re.compile(r'O:\d+:"[^"]+":'),       # O:4:"User":
    re.compile(r'a:\d+:\{'),              # a:2:{
    re.compile(r's:\d+:"[^"]*"'),         # s:4:"name"
]

# Python pickle signatures (base64)
PICKLE_B64_PREFIXES = ["gASV", "gAJV"]   # \x80\x04\x95 and \x80\x02\x95
PICKLE_HEX_PREFIX = "80049"              # raw hex of pickle protocol 4

# .NET ViewState
VIEWSTATE_PARAM = "__VIEWSTATE"
VIEWSTATE_GENERATOR = "__VIEWSTATEGENERATOR"
EVENT_VALIDATION = "__EVENTVALIDATION"

# Known vulnerable library error signatures
VULN_LIB_SIGNATURES = [
    ("org.apache.commons.collections", "Apache Commons Collections deserialization gadget"),
    ("org.apache.commons.beanutils", "Apache Commons BeanUtils deserialization gadget"),
    ("com.sun.org.apache.xalan", "Xalan XSLT deserialization gadget"),
    ("java.rmi.server", "Java RMI deserialization surface"),
    ("com.fasterxml.jackson.databind", "Jackson Databind polymorphic deserialization"),
    ("org.yaml.snakeyaml", "SnakeYAML unsafe deserialization"),
    ("ObjectInputStream", "Java ObjectInputStream usage exposed"),
    ("java.io.ObjectInputStream", "Java ObjectInputStream deserialization"),
    ("ClassNotFoundException", "Java class loading error (possible deserialization)"),
    ("InvalidClassException", "Java InvalidClassException (deserialization error)"),
    ("StreamCorruptedException", "Java StreamCorruptedException (malformed serialized data)"),
    ("unserialize()", "PHP unserialize() usage exposed"),
    ("pickle.loads", "Python pickle.loads usage exposed"),
    ("yaml.load", "Python yaml.load (unsafe YAML deserialization)"),
    ("Marshal.load", "Ruby Marshal.load deserialization"),
    ("BinaryFormatter", ".NET BinaryFormatter deserialization"),
    ("SoapFormatter", ".NET SoapFormatter deserialization"),
    ("LosFormatter", ".NET LosFormatter deserialization"),
    ("NetDataContractSerializer", ".NET NetDataContractSerializer deserialization"),
]

# Endpoints likely to accept serialized data
SERIAL_ENDPOINTS = [
    "/api/deserialize",
    "/api/import",
    "/api/data",
    "/api/object",
    "/remote/invoke",
    "/invoker/JMXInvokerServlet",
    "/invoker/EJBInvokerServlet",
    "/jmx-console",
    "/web-console",
    "/HtmlAdaptor",
    "/_async/AsyncResponseService",
]

# XML deserialization test paths
XML_ENDPOINTS = [
    "/api/xml",
    "/api/import",
    "/api/data",
    "/api/upload",
    "/xmlrpc.php",
    "/xmlrpc",
    "/soap",
    "/ws",
    "/wsdl",
]


# --------------------------------------------------------------------------
# Cookie analysis
# --------------------------------------------------------------------------

def check_cookies_java(session, url: str, timeout: int) -> List[Dict]:
    """Detect Java serialized objects in cookies."""
    findings = []
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return findings

    for cookie in resp.cookies:
        value = cookie.value
        # Base64-encoded Java serialized object
        if value.startswith(JAVA_B64_PREFIX):
            findings.append(make_finding(
                vulnerability="Java Serialized Object in Cookie",
                severity="HIGH",
                location=url,
                evidence=(
                    f"Cookie '{cookie.name}' contains a base64-encoded Java "
                    f"serialized object (starts with '{JAVA_B64_PREFIX}'). "
                    f"Value prefix: {value[:60]}..."
                ),
                category="DESERIALIZATION",
                raw_details={
                    "cookie_name": cookie.name,
                    "value_prefix": value[:80],
                    "type": "java_serialized_base64",
                },
            ))
        # Hex-encoded check
        try:
            hex_val = value.lower().replace("%", "")
            if hex_val.startswith(JAVA_HEX_PREFIX):
                findings.append(make_finding(
                    vulnerability="Java Serialized Object in Cookie (hex)",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Cookie '{cookie.name}' contains a hex-encoded Java "
                        f"serialized object (starts with '{JAVA_HEX_PREFIX}'). "
                        f"Value prefix: {value[:60]}..."
                    ),
                    category="DESERIALIZATION",
                    raw_details={
                        "cookie_name": cookie.name,
                        "value_prefix": value[:80],
                        "type": "java_serialized_hex",
                    },
                ))
        except Exception:
            pass

    return findings


def check_cookies_php(session, url: str, timeout: int) -> List[Dict]:
    """Detect PHP serialized data in cookies."""
    findings = []
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return findings

    for cookie in resp.cookies:
        value = cookie.value
        # Try URL-decoded value
        from urllib.parse import unquote
        decoded = unquote(value)

        for pattern in PHP_SERIAL_PATTERNS:
            if pattern.search(decoded):
                findings.append(make_finding(
                    vulnerability="PHP Serialized Data in Cookie",
                    severity="HIGH",
                    location=url,
                    evidence=(
                        f"Cookie '{cookie.name}' contains PHP serialized data "
                        f"matching pattern '{pattern.pattern}'. "
                        f"Value: {decoded[:80]}..."
                    ),
                    category="DESERIALIZATION",
                    raw_details={
                        "cookie_name": cookie.name,
                        "value_preview": decoded[:120],
                        "pattern_matched": pattern.pattern,
                        "type": "php_serialized",
                    },
                ))
                break  # one finding per cookie

        # Also try base64 decoding
        try:
            b64_decoded = base64.b64decode(value).decode("utf-8", errors="ignore")
            for pattern in PHP_SERIAL_PATTERNS:
                if pattern.search(b64_decoded):
                    findings.append(make_finding(
                        vulnerability="PHP Serialized Data in Cookie (base64)",
                        severity="HIGH",
                        location=url,
                        evidence=(
                            f"Cookie '{cookie.name}' contains base64-encoded PHP "
                            f"serialized data. Decoded preview: {b64_decoded[:80]}..."
                        ),
                        category="DESERIALIZATION",
                        raw_details={
                            "cookie_name": cookie.name,
                            "decoded_preview": b64_decoded[:120],
                            "type": "php_serialized_b64",
                        },
                    ))
                    break
        except Exception:
            pass

    return findings


def check_cookies_pickle(session, url: str, timeout: int) -> List[Dict]:
    """Detect Python pickle data in cookies."""
    findings = []
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return findings

    for cookie in resp.cookies:
        value = cookie.value
        for prefix in PICKLE_B64_PREFIXES:
            if value.startswith(prefix):
                findings.append(make_finding(
                    vulnerability="Python Pickle Data in Cookie",
                    severity="CRITICAL",
                    location=url,
                    evidence=(
                        f"Cookie '{cookie.name}' contains base64-encoded Python "
                        f"pickle data (starts with '{prefix}'). Pickle deserialization "
                        f"allows arbitrary code execution. Value prefix: {value[:60]}..."
                    ),
                    category="DESERIALIZATION",
                    raw_details={
                        "cookie_name": cookie.name,
                        "value_prefix": value[:80],
                        "type": "python_pickle",
                    },
                ))
                break

        # Check raw hex
        try:
            raw = base64.b64decode(value)
            if raw[:3] == b"\x80\x04\x95" or raw[:3] == b"\x80\x02\x95":
                findings.append(make_finding(
                    vulnerability="Python Pickle Data in Cookie (binary)",
                    severity="CRITICAL",
                    location=url,
                    evidence=(
                        f"Cookie '{cookie.name}' contains binary Python pickle data. "
                        f"Pickle deserialization allows arbitrary code execution."
                    ),
                    category="DESERIALIZATION",
                    raw_details={
                        "cookie_name": cookie.name,
                        "type": "python_pickle_binary",
                    },
                ))
        except Exception:
            pass

    return findings


# --------------------------------------------------------------------------
# .NET ViewState
# --------------------------------------------------------------------------

def check_viewstate(session, url: str, timeout: int) -> List[Dict]:
    """Check for .NET ViewState with disabled MAC validation."""
    findings = []
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return findings

    body = resp.text

    # Find __VIEWSTATE in hidden fields
    viewstate_match = re.search(
        r'<input[^>]*name=["\']__VIEWSTATE["\'][^>]*value=["\']([^"\']*)["\']',
        body, re.IGNORECASE,
    )
    if not viewstate_match:
        return findings

    viewstate_value = viewstate_match.group(1)

    # Check for __VIEWSTATEGENERATOR (present means ASP.NET)
    has_generator = VIEWSTATE_GENERATOR.lower() in body.lower()

    # Check for __EVENTVALIDATION
    has_event_validation = EVENT_VALIDATION.lower() in body.lower()

    # Try to determine if MAC is disabled by analyzing the ViewState
    # A ViewState without MAC is typically shorter and decodable
    mac_likely_disabled = False
    try:
        decoded = base64.b64decode(viewstate_value)
        # ViewState with MAC has 20-byte HMAC appended (SHA1) or 32-byte (SHA256)
        # If it's very short or doesn't end with typical MAC bytes, MAC may be off
        if len(decoded) < 20:
            mac_likely_disabled = True
        # Check for the absence of MAC indicator byte (0xFF at specific positions)
        if len(decoded) > 2 and decoded[0:2] == b"\xff\x01":
            # Version 2 ViewState - check for MAC
            mac_likely_disabled = False
    except Exception:
        pass

    severity = "HIGH" if mac_likely_disabled else "MEDIUM"

    evidence_parts = [
        f"__VIEWSTATE parameter found (length: {len(viewstate_value)} chars).",
    ]
    if mac_likely_disabled:
        evidence_parts.append(
            "MAC validation appears to be DISABLED. This allows an attacker to "
            "tamper with or inject malicious serialized objects into the ViewState."
        )
    else:
        evidence_parts.append(
            "MAC validation status could not be confirmed as disabled, but the "
            "ViewState is present. If MAC is disabled, this could allow deserialization attacks."
        )

    if not has_event_validation:
        evidence_parts.append("EventValidation is absent, reducing protections.")
        severity = "HIGH"

    findings.append(make_finding(
        vulnerability=".NET ViewState Deserialization Risk",
        severity=severity,
        location=url,
        evidence=" ".join(evidence_parts),
        category="DESERIALIZATION",
        raw_details={
            "viewstate_length": len(viewstate_value),
            "has_generator": has_generator,
            "has_event_validation": has_event_validation,
            "mac_likely_disabled": mac_likely_disabled,
            "type": "dotnet_viewstate",
        },
    ))

    return findings


# --------------------------------------------------------------------------
# Java serialization endpoints
# --------------------------------------------------------------------------

def check_java_serial_endpoints(session, url: str, timeout: int) -> List[Dict]:
    """Check for endpoints accepting Java serialized objects."""
    findings = []

    for path in SERIAL_ENDPOINTS:
        test_url = urljoin(url, path)

        # Send a request with Java serialization content type
        resp, err = safe_request(
            session, "POST", test_url, timeout=timeout,
            headers={"Content-Type": "application/x-java-serialized-object"},
            data=b"\xac\xed\x00\x05",  # minimal Java serialized header
        )
        if err or not resp:
            continue

        # If server doesn't return 404/405, it might accept serialized data
        if resp.status_code not in (404, 405, 403, 301, 302):
            content_type = resp.headers.get("Content-Type", "").lower()
            resp_body = resp.text[:500]

            # Stronger signal if response content-type is also serialized
            is_serial_response = "java-serialized-object" in content_type

            # Check for error messages indicating deserialization was attempted
            deser_attempted = any(
                sig in resp_body
                for sig, _ in VULN_LIB_SIGNATURES
                if "java" in sig.lower() or "Object" in sig or "Class" in sig or "Stream" in sig
            )

            if is_serial_response or deser_attempted or resp.status_code == 200:
                severity = "CRITICAL" if deser_attempted else "HIGH"
                evidence_msg = (
                    f"Endpoint {test_url} accepts Content-Type: "
                    f"application/x-java-serialized-object "
                    f"(status {resp.status_code})."
                )
                if deser_attempted:
                    evidence_msg += (
                        " Response contains Java deserialization error messages, "
                        "confirming the endpoint processes serialized objects."
                    )
                if is_serial_response:
                    evidence_msg += " Response Content-Type also indicates serialized objects."

                findings.append(make_finding(
                    vulnerability="Java Deserialization Endpoint",
                    severity=severity,
                    location=test_url,
                    evidence=evidence_msg,
                    category="DESERIALIZATION",
                    raw_details={
                        "endpoint": test_url,
                        "status_code": resp.status_code,
                        "response_content_type": content_type,
                        "deserialization_attempted": deser_attempted,
                        "type": "java_endpoint",
                    },
                ))

    return findings


# --------------------------------------------------------------------------
# Deserialization indicators in headers & bodies
# --------------------------------------------------------------------------

def check_deserialization_indicators(session, urls: List[str], timeout: int) -> List[Dict]:
    """Check for deserialization indicators in headers and response bodies."""
    findings = []
    checked_sigs = set()

    for url in urls:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp:
            continue

        body = resp.text
        all_headers_str = " ".join(f"{k}: {v}" for k, v in resp.headers.items())
        combined = body + all_headers_str

        for signature, description in VULN_LIB_SIGNATURES:
            if signature in combined and signature not in checked_sigs:
                checked_sigs.add(signature)

                # Determine context
                in_headers = signature in all_headers_str
                in_body = signature in body

                context = "response headers" if in_headers else "response body"

                findings.append(make_finding(
                    vulnerability=f"Deserialization Library Detected: {signature}",
                    severity="MEDIUM",
                    location=url,
                    evidence=(
                        f"{description}. Signature '{signature}' found in {context}. "
                        f"This may indicate the application uses an unsafe deserialization "
                        f"library or exposes error details revealing its technology stack."
                    ),
                    category="DESERIALIZATION",
                    raw_details={
                        "signature": signature,
                        "description": description,
                        "in_headers": in_headers,
                        "in_body": in_body,
                        "type": "vuln_library",
                    },
                ))

        # Check for serialized data in response body (PHP/Java/Python)
        for pattern in PHP_SERIAL_PATTERNS:
            if pattern.search(body):
                key = f"php_body_{url}"
                if key not in checked_sigs:
                    checked_sigs.add(key)
                    findings.append(make_finding(
                        vulnerability="PHP Serialized Data in Response Body",
                        severity="MEDIUM",
                        location=url,
                        evidence=(
                            f"Response body contains PHP serialized data matching "
                            f"'{pattern.pattern}'. This data may be user-controllable."
                        ),
                        category="DESERIALIZATION",
                        raw_details={
                            "pattern": pattern.pattern,
                            "type": "php_body",
                        },
                    ))
                    break

        # Check for base64-encoded Java serialized objects in response body
        b64_java = re.findall(r'[A-Za-z0-9+/=]{20,}', body)
        for candidate in b64_java[:20]:  # limit to first 20 matches
            if candidate.startswith(JAVA_B64_PREFIX):
                key = f"java_body_{url}"
                if key not in checked_sigs:
                    checked_sigs.add(key)
                    findings.append(make_finding(
                        vulnerability="Java Serialized Data in Response Body",
                        severity="MEDIUM",
                        location=url,
                        evidence=(
                            f"Response body contains base64-encoded Java serialized "
                            f"data starting with '{JAVA_B64_PREFIX}'. "
                            f"Preview: {candidate[:60]}..."
                        ),
                        category="DESERIALIZATION",
                        raw_details={
                            "value_prefix": candidate[:80],
                            "type": "java_body",
                        },
                    ))
                break

    return findings


# --------------------------------------------------------------------------
# XML deserialization endpoints
# --------------------------------------------------------------------------

XML_DESER_PAYLOADS = [
    (
        '<?xml version="1.0"?><test>vaultscan_deser_probe</test>',
        "text/xml",
    ),
    (
        '<?xml version="1.0"?>'
        '<methodCall><methodName>system.listMethods</methodName></methodCall>',
        "text/xml",
    ),
]


def check_xml_deserialization(session, url: str, timeout: int) -> List[Dict]:
    """Test XML deserialization endpoints."""
    findings = []

    for path in XML_ENDPOINTS:
        test_url = urljoin(url, path)

        for payload, content_type in XML_DESER_PAYLOADS:
            resp, err = safe_request(
                session, "POST", test_url, timeout=timeout,
                headers={"Content-Type": content_type},
                data=payload,
            )
            if err or not resp:
                continue

            if resp.status_code in (404, 405, 403, 301, 302):
                continue

            body = resp.text
            content_type_resp = resp.headers.get("Content-Type", "").lower()

            # Check if server processed XML
            xml_processed = (
                "xml" in content_type_resp
                or "<?xml" in body
                or "<methodResponse" in body
                or "vaultscan_deser_probe" in body
            )

            if xml_processed:
                # Check for dangerous patterns in error responses
                dangerous = any(
                    indicator in body
                    for indicator in [
                        "XMLDecoder", "XStream", "xmlrpc", "JAXB",
                        "Unmarshaller", "deserialize", "readObject",
                        "system.listMethods",
                    ]
                )

                severity = "HIGH" if dangerous else "MEDIUM"
                evidence_msg = (
                    f"Endpoint {test_url} processes XML input "
                    f"(status {resp.status_code}, response Content-Type: {content_type_resp})."
                )
                if dangerous:
                    evidence_msg += (
                        " Response contains indicators of XML deserialization "
                        "processing (e.g., XMLDecoder, XStream, readObject)."
                    )

                findings.append(make_finding(
                    vulnerability="XML Deserialization Endpoint",
                    severity=severity,
                    location=test_url,
                    evidence=evidence_msg,
                    category="DESERIALIZATION",
                    raw_details={
                        "endpoint": test_url,
                        "status_code": resp.status_code,
                        "xml_processed": xml_processed,
                        "dangerous_indicators": dangerous,
                        "type": "xml_deserialization",
                    },
                ))
                break  # one finding per endpoint

    return findings


# --------------------------------------------------------------------------
# Mock
# --------------------------------------------------------------------------

def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Java Serialized Object in Cookie",
            severity="HIGH",
            location=target,
            evidence=(
                "Cookie 'JSESSION' contains a base64-encoded Java serialized "
                "object (starts with 'rO0AB'). This may allow remote code execution "
                "via insecure deserialization."
            ),
            category="DESERIALIZATION",
        ),
    ]


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    parser = base_argparser("VaultScan Insecure Deserialization Scanner")
    args = parser.parse_args()
    target = normalize_url(args.target)

    if not target:
        from scan_utils import output_error
        output_error("No target specified.")

    if is_mock_mode():
        output_findings(get_mock_findings(target))

    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)

    # Verify target is reachable
    resp, err = safe_request(session, "GET", target, timeout=args.timeout)
    if err:
        output_findings([])

    findings: List[Dict] = []

    # Crawl for more pages to inspect
    crawled_urls = crawl_same_domain(session, target, timeout=args.timeout)
    if target not in crawled_urls:
        crawled_urls.insert(0, target)

    # 1. Check cookies for Java serialized objects
    findings.extend(check_cookies_java(session, target, args.timeout))

    # 2. Check cookies for PHP serialized data
    findings.extend(check_cookies_php(session, target, args.timeout))

    # 3. Check cookies for Python pickle data
    findings.extend(check_cookies_pickle(session, target, args.timeout))

    # 4. Check .NET ViewState on crawled pages
    for page_url in crawled_urls[:15]:
        findings.extend(check_viewstate(session, page_url, args.timeout))

    # 5. Check for Java serialization endpoints
    findings.extend(check_java_serial_endpoints(session, target, args.timeout))

    # 6 & 7. Check deserialization indicators in headers/bodies and vuln libraries
    findings.extend(check_deserialization_indicators(session, crawled_urls[:15], args.timeout))

    # 8. Test XML deserialization endpoints
    findings.extend(check_xml_deserialization(session, target, args.timeout))

    output_findings(findings)


if __name__ == "__main__":
    main()
