#!/usr/bin/env python3
"""
VaultScan — Host Header Injection Scanner
==========================================
Detects Host header injection vulnerabilities that can lead to:
  1. Password reset poisoning (Host header reflected in response body)
  2. Cache poisoning via X-Forwarded-Host / X-Host / X-Forwarded-Server
  3. Virtual host confusion (different Host headers yield different responses)
  4. Web-cache poisoning through Host header with port manipulation

Uses both the requests library and raw sockets (for absolute-URL request line
tests) to cover all attack vectors.

Outputs JSON array of findings to stdout.
"""

import os
import re
import socket
import ssl
import sys
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin

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
    rate_limited_request,
    make_finding,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "HOST_HEADER"
CANARY_HOST = "evil.vaultscan-inject.com"
CANARY_MARKER = "vaultscan-inject"
MAX_RECV_BYTES = 65536
DEFAULT_SOCKET_TIMEOUT = 10

# Paths commonly associated with password reset / account functionality
ACCOUNT_PATHS = [
    "/password/reset",
    "/password-reset",
    "/forgot-password",
    "/forgot_password",
    "/reset-password",
    "/reset_password",
    "/account/recover",
    "/account/reset",
    "/auth/forgot",
    "/auth/reset",
    "/users/password/new",
    "/wp-login.php?action=lostpassword",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_target(url: str) -> Tuple[str, int, bool, str]:
    """Return (host, port, use_ssl, path) from a URL string."""
    parsed = urlparse(url)
    use_ssl = parsed.scheme == "https"
    host = parsed.hostname or parsed.netloc
    default_port = 443 if use_ssl else 80
    port = parsed.port or default_port
    path = parsed.path or "/"
    return host, port, use_ssl, path


def _host_reflected(body: str, marker: str = CANARY_MARKER) -> bool:
    """Check whether the canary marker appears in the response body."""
    return marker.lower() in body.lower()


def _header_reflected_in_location(headers: Dict[str, str], marker: str = CANARY_MARKER) -> bool:
    """Check if canary appears in Location or other redirect headers."""
    for name in ("Location", "Content-Location", "Refresh"):
        value = headers.get(name, "")
        if not value:
            # Case-insensitive lookup
            for h, v in headers.items():
                if h.lower() == name.lower():
                    value = v
                    break
        if marker.lower() in value.lower():
            return True
    return False


def _raw_socket_request(
    host: str,
    port: int,
    use_ssl: bool,
    request_bytes: bytes,
    timeout: int = DEFAULT_SOCKET_TIMEOUT,
) -> Optional[bytes]:
    """Send raw bytes and return the response."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
        if use_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            sock = ctx.wrap_socket(sock, server_hostname=host)
        sock.sendall(request_bytes)
        response = b""
        while True:
            try:
                data = sock.recv(4096)
                if not data:
                    break
                response += data
                if len(response) > MAX_RECV_BYTES:
                    break
            except socket.timeout:
                break
        return response
    except Exception:
        return None
    finally:
        try:
            sock.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Check 1: Host header replaced with evil.com
# ---------------------------------------------------------------------------
def check_host_header_injection(
    session,
    target: str,
    host: str,
    paths: List[str],
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Replace the Host header with a canary domain and check whether the
    canary is reflected in the response body or redirect headers.
    This is the classic password-reset poisoning vector.
    """
    findings: List[Dict] = []

    for path in paths:
        url = target.rstrip("/") + path
        resp, err = rate_limited_request(
            session, "GET", url,
            delay=delay, timeout=timeout,
            headers={"Host": CANARY_HOST},
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        body = resp.text
        resp_headers = dict(resp.headers)

        reflected_in_body = _host_reflected(body)
        reflected_in_headers = _header_reflected_in_location(resp_headers)

        if reflected_in_body or reflected_in_headers:
            where = []
            if reflected_in_body:
                where.append("response body")
            if reflected_in_headers:
                where.append("redirect/location headers")

            findings.append(make_finding(
                vulnerability="Host Header Injection — Password Reset Poisoning",
                severity="HIGH",
                location=url,
                evidence=(
                    f"Injected Host header '{CANARY_HOST}' was reflected in "
                    f"{', '.join(where)}. An attacker can poison password reset "
                    f"links to steal tokens."
                ),
                category=CATEGORY,
                raw_details={
                    "injected_host": CANARY_HOST,
                    "reflected_in": where,
                    "status_code": resp.status_code,
                    "path": path,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 2: X-Forwarded-Host header injection
# ---------------------------------------------------------------------------
def check_x_forwarded_host(
    session,
    target: str,
    host: str,
    paths: List[str],
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Inject X-Forwarded-Host header and check if the value is reflected
    in the response body or redirect headers.  Many reverse proxies
    honour this header to build URLs.
    """
    findings: List[Dict] = []

    for path in paths:
        url = target.rstrip("/") + path
        resp, err = rate_limited_request(
            session, "GET", url,
            delay=delay, timeout=timeout,
            headers={"X-Forwarded-Host": CANARY_HOST},
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        body = resp.text
        resp_headers = dict(resp.headers)

        reflected_in_body = _host_reflected(body)
        reflected_in_headers = _header_reflected_in_location(resp_headers)

        if reflected_in_body or reflected_in_headers:
            where = []
            if reflected_in_body:
                where.append("response body")
            if reflected_in_headers:
                where.append("redirect/location headers")

            findings.append(make_finding(
                vulnerability="X-Forwarded-Host Header Injection",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"Injected X-Forwarded-Host header '{CANARY_HOST}' was "
                    f"reflected in {', '.join(where)}. This can be exploited "
                    f"for cache poisoning or password reset poisoning."
                ),
                category=CATEGORY,
                raw_details={
                    "header": "X-Forwarded-Host",
                    "injected_value": CANARY_HOST,
                    "reflected_in": where,
                    "status_code": resp.status_code,
                    "path": path,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 3: X-Host and X-Forwarded-Server header injection
# ---------------------------------------------------------------------------
def check_x_host_and_forwarded_server(
    session,
    target: str,
    host: str,
    paths: List[str],
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Test X-Host and X-Forwarded-Server headers — less common but
    still honoured by some frameworks and load balancers.
    """
    findings: List[Dict] = []

    alt_headers = [
        ("X-Host", CANARY_HOST),
        ("X-Forwarded-Server", CANARY_HOST),
    ]

    for header_name, header_value in alt_headers:
        for path in paths:
            url = target.rstrip("/") + path
            resp, err = rate_limited_request(
                session, "GET", url,
                delay=delay, timeout=timeout,
                headers={header_name: header_value},
                allow_redirects=False,
            )
            if err or resp is None:
                continue

            body = resp.text
            resp_headers = dict(resp.headers)

            reflected_in_body = _host_reflected(body)
            reflected_in_headers = _header_reflected_in_location(resp_headers)

            if reflected_in_body or reflected_in_headers:
                where = []
                if reflected_in_body:
                    where.append("response body")
                if reflected_in_headers:
                    where.append("redirect/location headers")

                findings.append(make_finding(
                    vulnerability=f"{header_name} Header Injection",
                    severity="MEDIUM",
                    location=url,
                    evidence=(
                        f"Injected {header_name} header '{header_value}' was "
                        f"reflected in {', '.join(where)}. This may enable "
                        f"cache poisoning or URL manipulation attacks."
                    ),
                    category=CATEGORY,
                    raw_details={
                        "header": header_name,
                        "injected_value": header_value,
                        "reflected_in": where,
                        "status_code": resp.status_code,
                        "path": path,
                    },
                ))

    return findings


# ---------------------------------------------------------------------------
# Check 4: Host header with port — target.com:evil.com
# ---------------------------------------------------------------------------
def check_host_with_port_injection(
    session,
    target: str,
    host: str,
    paths: List[str],
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Some servers parse the Host header port component loosely.
    Injecting 'legitimate-host:evil-payload' may cause the evil
    portion to appear in generated URLs.
    """
    findings: List[Dict] = []
    injected_host = f"{host}:{CANARY_HOST}"

    for path in paths:
        url = target.rstrip("/") + path
        resp, err = rate_limited_request(
            session, "GET", url,
            delay=delay, timeout=timeout,
            headers={"Host": injected_host},
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        body = resp.text
        resp_headers = dict(resp.headers)

        reflected_in_body = _host_reflected(body)
        reflected_in_headers = _header_reflected_in_location(resp_headers)

        if reflected_in_body or reflected_in_headers:
            where = []
            if reflected_in_body:
                where.append("response body")
            if reflected_in_headers:
                where.append("redirect/location headers")

            findings.append(make_finding(
                vulnerability="Host Header Port Injection",
                severity="HIGH",
                location=url,
                evidence=(
                    f"Host header with injected port '{injected_host}' caused "
                    f"the canary to appear in {', '.join(where)}. The server "
                    f"does not validate the port component of the Host header."
                ),
                category=CATEGORY,
                raw_details={
                    "injected_host": injected_host,
                    "reflected_in": where,
                    "status_code": resp.status_code,
                    "path": path,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 5: Absolute URL in request line (raw socket)
# ---------------------------------------------------------------------------
def check_absolute_url_request_line(
    host: str,
    port: int,
    use_ssl: bool,
    path: str,
    timeout: int,
) -> List[Dict]:
    """
    Send a request with an absolute URL in the request line while using
    a different Host header.  HTTP/1.1 says the request-line URI takes
    precedence over the Host header, but misconfigured servers may use
    the Host header value for URL generation instead.
    """
    findings: List[Dict] = []

    scheme = "https" if use_ssl else "http"
    absolute_url = f"{scheme}://{host}{path}"

    request_bytes = (
        f"GET {absolute_url} HTTP/1.1\r\n"
        f"Host: {CANARY_HOST}\r\n"
        f"Connection: close\r\n"
        f"Accept: text/html\r\n"
        f"\r\n"
    ).encode()

    resp_bytes = _raw_socket_request(host, port, use_ssl, request_bytes, timeout)
    if resp_bytes is None:
        return findings

    try:
        resp_text = resp_bytes.decode("utf-8", errors="replace")
    except Exception:
        resp_text = resp_bytes.decode("latin-1", errors="replace")

    # Split headers and body
    header_body = resp_text.split("\r\n\r\n", 1)
    body = header_body[1] if len(header_body) > 1 else ""
    headers_raw = header_body[0] if header_body else ""

    if _host_reflected(body):
        findings.append(make_finding(
            vulnerability="Absolute URL Request Line — Host Header Override",
            severity="HIGH",
            location=f"{scheme}://{host}:{port}{path}",
            evidence=(
                f"When using an absolute URL in the request line with "
                f"Host: {CANARY_HOST}, the canary was reflected in the "
                f"response body. The server incorrectly trusts the Host "
                f"header over the request-line URI."
            ),
            category=CATEGORY,
            raw_details={
                "technique": "absolute_url_request_line",
                "injected_host": CANARY_HOST,
                "absolute_url_sent": absolute_url,
            },
        ))

    # Also check Location header
    location_match = re.search(
        r"^Location:\s*(.+)$", headers_raw, re.IGNORECASE | re.MULTILINE
    )
    if location_match and CANARY_MARKER in location_match.group(1).lower():
        findings.append(make_finding(
            vulnerability="Absolute URL Request Line — Host Header in Redirect",
            severity="HIGH",
            location=f"{scheme}://{host}:{port}{path}",
            evidence=(
                f"When using an absolute URL in the request line, the "
                f"Host header value '{CANARY_HOST}' appeared in the "
                f"Location redirect header: {location_match.group(1).strip()}"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "absolute_url_request_line",
                "injected_host": CANARY_HOST,
                "location_header": location_match.group(1).strip(),
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Check 6: Virtual host confusion (behavioural differences)
# ---------------------------------------------------------------------------
def check_virtual_host_confusion(
    session,
    target: str,
    host: str,
    delay: float,
    timeout: int,
) -> List[Dict]:
    """
    Compare baseline response with responses obtained using different
    Host headers.  Significant differences in status code or content
    may indicate virtual host routing issues that leak internal content.
    """
    findings: List[Dict] = []

    # Get baseline response
    baseline_resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or baseline_resp is None:
        return findings

    baseline_status = baseline_resp.status_code
    baseline_length = len(baseline_resp.text)
    baseline_snippet = baseline_resp.text[:500]

    # Test with various fake Host headers
    test_hosts = [
        "localhost",
        "127.0.0.1",
        "internal.local",
        "admin.internal",
        f"dev.{host}",
        f"staging.{host}",
        f"internal.{host}",
    ]

    for test_host in test_hosts:
        resp, err = rate_limited_request(
            session, "GET", target,
            delay=delay, timeout=timeout,
            headers={"Host": test_host},
            allow_redirects=False,
        )
        if err or resp is None:
            continue

        status = resp.status_code
        length = len(resp.text)

        # Detect significant behavioural differences
        # Different status code (except common rejection codes)
        status_changed = status != baseline_status
        # Large content difference (more than 30% change and non-trivial content)
        length_ratio = abs(length - baseline_length) / max(baseline_length, 1)
        content_changed = length_ratio > 0.3 and length > 200

        # If we got a 200 with substantially different content, or
        # we got a 200 while baseline was non-200, that is interesting
        if (status == 200 and status_changed and baseline_status != 200) or \
           (status == 200 and content_changed and resp.text[:500] != baseline_snippet):
            findings.append(make_finding(
                vulnerability="Virtual Host Confusion",
                severity="MEDIUM",
                location=target,
                evidence=(
                    f"Host header '{test_host}' produced a significantly "
                    f"different response (status {status}, {length} bytes) "
                    f"compared to the legitimate Host (status {baseline_status}, "
                    f"{baseline_length} bytes). The server may expose internal "
                    f"virtual hosts or different applications."
                ),
                category=CATEGORY,
                raw_details={
                    "test_host": test_host,
                    "test_status": status,
                    "test_length": length,
                    "baseline_status": baseline_status,
                    "baseline_length": baseline_length,
                    "length_ratio": round(length_ratio, 2),
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 7: Discover password reset / account pages
# ---------------------------------------------------------------------------
def discover_account_pages(
    session,
    target: str,
    delay: float,
    timeout: int,
) -> List[str]:
    """
    Probe common account / password-reset paths and return those that
    exist (status 200 or 302).  These are high-value targets for Host
    header injection.
    """
    found: List[str] = []

    for path in ACCOUNT_PATHS:
        url = target.rstrip("/") + path
        resp, err = rate_limited_request(
            session, "HEAD", url,
            delay=delay, timeout=timeout,
            allow_redirects=False,
        )
        if err or resp is None:
            continue
        if resp.status_code in (200, 301, 302, 303, 307, 308):
            found.append(path)

    return found


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return a single realistic mock finding for development / demo mode."""
    return [
        make_finding(
            vulnerability="Host Header Injection — Password Reset Poisoning",
            severity="HIGH",
            location=f"{target}/password/reset",
            evidence=(
                f"Injected Host header '{CANARY_HOST}' was reflected in "
                f"response body. An attacker can poison password reset "
                f"links to steal tokens."
            ),
            category=CATEGORY,
            raw_details={
                "injected_host": CANARY_HOST,
                "reflected_in": ["response body"],
                "status_code": 200,
                "path": "/password/reset",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Host Header Injection Scanner")
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

    host, port, use_ssl, path = _parse_target(target)

    if not host:
        output_error(f"Cannot parse host from target URL: {target}")
        return

    # Step 0: Validate target is reachable
    resp, err = safe_request(session, "GET", target, timeout=timeout)
    if err or resp is None:
        output_error(f"Cannot reach target: {err}")
        return

    # Build list of paths to test — always include root
    test_paths = ["/"]

    # Step 1: Discover account / password-reset pages
    try:
        account_pages = discover_account_pages(session, target, delay, timeout)
        test_paths.extend(account_pages)
    except Exception:
        pass

    # Step 2: Host header injection (direct Host override)
    try:
        findings.extend(check_host_header_injection(
            session, target, host, test_paths, delay, timeout,
        ))
    except Exception:
        pass

    # Step 3: X-Forwarded-Host injection
    try:
        findings.extend(check_x_forwarded_host(
            session, target, host, test_paths, delay, timeout,
        ))
    except Exception:
        pass

    # Step 4: X-Host and X-Forwarded-Server injection
    try:
        findings.extend(check_x_host_and_forwarded_server(
            session, target, host, test_paths, delay, timeout,
        ))
    except Exception:
        pass

    # Step 5: Host header with port injection
    try:
        findings.extend(check_host_with_port_injection(
            session, target, host, test_paths, delay, timeout,
        ))
    except Exception:
        pass

    # Step 6: Absolute URL in request line (raw sockets)
    try:
        findings.extend(check_absolute_url_request_line(
            host, port, use_ssl, path, timeout,
        ))
    except Exception:
        pass

    # Step 7: Virtual host confusion
    try:
        findings.extend(check_virtual_host_confusion(
            session, target, host, delay, timeout,
        ))
    except Exception:
        pass

    # Deduplicate by (vulnerability, location)
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
