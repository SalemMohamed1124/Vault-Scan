#!/usr/bin/env python3
"""
VaultScan -- WebSocket Security Scanner
=========================================
Tests for WebSocket security issues:
- Unencrypted WebSocket (ws:// instead of wss://)
- Missing origin validation
- Cross-site WebSocket hijacking
- WebSocket endpoint discovery
"""

import os
import sys
import re
import socket
import ssl
import hashlib
import base64
from typing import Dict, List
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
)

WS_PATHS = [
    "/ws", "/websocket", "/socket.io/", "/sockjs-node/",
    "/cable", "/realtime", "/live", "/events", "/stream",
    "/hub", "/signalr", "/chat", "/notifications",
    "/api/ws", "/api/websocket", "/api/v1/ws",
]


def discover_websocket_endpoints(session, base_url: str, urls: List[str], timeout: int) -> List[Dict]:
    """Discover WebSocket endpoints via path probing and HTML analysis."""
    endpoints = []
    seen = set()

    # Check common WebSocket paths
    for path in WS_PATHS:
        url = f"{base_url}{path}"
        ws_info = try_websocket_handshake(url, timeout)
        if ws_info["accepted"]:
            if url not in seen:
                seen.add(url)
                endpoints.append({"url": url, "path": path, **ws_info})

    # Scan crawled pages for WebSocket URLs in JavaScript
    ws_pattern = re.compile(r"""(?:new\s+WebSocket|io\.connect|io\()\s*\(\s*['"`](wss?://[^'"`]+)['"`]""")
    ws_path_pattern = re.compile(r"""(?:new\s+WebSocket|io\.connect|io\()\s*\(\s*['"`](/[^'"`]+)['"`]""")

    for url in urls[:20]:
        resp, err = safe_request(session, "GET", url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue

        body = resp.text

        # Full WebSocket URLs
        for match in ws_pattern.finditer(body):
            ws_url = match.group(1)
            if ws_url not in seen:
                seen.add(ws_url)
                endpoints.append({
                    "url": ws_url,
                    "path": urlparse(ws_url).path,
                    "found_in": url,
                    "accepted": True,
                })

        # Relative WebSocket paths
        for match in ws_path_pattern.finditer(body):
            ws_path = match.group(1)
            parsed = urlparse(base_url)
            scheme = "wss" if parsed.scheme == "https" else "ws"
            ws_url = f"{scheme}://{parsed.netloc}{ws_path}"
            if ws_url not in seen:
                seen.add(ws_url)
                endpoints.append({
                    "url": ws_url,
                    "path": ws_path,
                    "found_in": url,
                    "accepted": True,
                })

    return endpoints


def try_websocket_handshake(url: str, timeout: int) -> Dict:
    """Attempt a WebSocket upgrade handshake."""
    result = {"accepted": False, "status": None, "headers": {}}

    parsed = urlparse(url)
    # Convert http(s) to ws(s)
    if parsed.scheme in ("http", "https"):
        host = parsed.netloc
        port = 443 if parsed.scheme == "https" else 80
        use_ssl = parsed.scheme == "https"
    elif parsed.scheme in ("ws", "wss"):
        host = parsed.netloc
        port = 443 if parsed.scheme == "wss" else 80
        use_ssl = parsed.scheme == "wss"
    else:
        return result

    if ":" in host:
        host, port_str = host.rsplit(":", 1)
        try:
            port = int(port_str)
        except ValueError:
            pass

    path = parsed.path or "/"

    # Generate WebSocket key
    ws_key = base64.b64encode(os.urandom(16)).decode()

    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {ws_key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"Origin: https://evil.com\r\n"
        f"\r\n"
    )

    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        if use_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            sock = ctx.wrap_socket(sock, server_hostname=host)

        sock.sendall(request.encode())
        response = b""
        while b"\r\n\r\n" not in response:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk

        sock.close()

        response_str = response.decode(errors="ignore")
        lines = response_str.split("\r\n")

        if lines:
            status_line = lines[0]
            if "101" in status_line:
                result["accepted"] = True
                result["status"] = 101
            else:
                match = re.search(r"(\d{3})", status_line)
                result["status"] = int(match.group(1)) if match else None

        # Parse headers
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                result["headers"][key.strip().lower()] = value.strip()

    except Exception:
        pass

    return result


def check_websocket_security(endpoint: Dict, base_url: str) -> List[Dict]:
    """Check security issues with a WebSocket endpoint."""
    findings = []
    ws_url = endpoint["url"]
    parsed = urlparse(ws_url)

    # Check for unencrypted WebSocket
    if parsed.scheme == "ws" or (parsed.scheme == "" and urlparse(base_url).scheme == "http"):
        findings.append(make_finding(
            vulnerability="Unencrypted WebSocket Connection (ws://)",
            severity="HIGH",
            location=ws_url,
            evidence=(
                f"WebSocket endpoint uses unencrypted ws:// protocol. "
                f"All WebSocket traffic can be intercepted. Use wss:// instead."
            ),
            category="WEBSOCKET",
            raw_details={"url": ws_url, "protocol": "ws"},
        ))

    # Check if evil origin was accepted (CSWSH)
    if endpoint.get("accepted") and endpoint.get("status") == 101:
        findings.append(make_finding(
            vulnerability="Cross-Site WebSocket Hijacking (CSWSH)",
            severity="HIGH",
            location=ws_url,
            evidence=(
                f"WebSocket endpoint accepted connection from evil origin "
                f"'https://evil.com'. This allows cross-site WebSocket hijacking. "
                f"Server should validate Origin header."
            ),
            category="WEBSOCKET",
            raw_details={
                "url": ws_url,
                "origin_sent": "https://evil.com",
                "status": 101,
            },
        ))

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Cross-Site WebSocket Hijacking (CSWSH)",
            severity="HIGH",
            location=f"{target}/ws",
            evidence="WebSocket accepted connection from evil origin 'https://evil.com'.",
            category="WEBSOCKET",
        ),
    ]


def main():
    parser = base_argparser("VaultScan WebSocket Security Scanner")
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

    # Crawl for JavaScript containing WebSocket references
    urls = crawl_same_domain(target, session, delay=args.delay, timeout=args.timeout, max_pages=20)

    # Discover WebSocket endpoints
    endpoints = discover_websocket_endpoints(session, target, urls, args.timeout)

    # Check security of each endpoint
    for endpoint in endpoints:
        findings.extend(check_websocket_security(endpoint, target))

    output_findings(findings)


if __name__ == "__main__":
    main()
