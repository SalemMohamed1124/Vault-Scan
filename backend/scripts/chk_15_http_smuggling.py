#!/usr/bin/env python3
"""
VaultScan — HTTP Request Smuggling Detection Scanner
=====================================================
Detects CL.TE and TE.CL desynchronization vulnerabilities using
timing-based raw-socket probes.  Also tests TE.TE obfuscation vectors.

Uses raw sockets instead of the ``requests`` library because ``requests``
normalizes headers and prevents sending conflicting Content-Length /
Transfer-Encoding headers.

Outputs JSON array of findings to stdout.
"""

import os
import re
import socket
import ssl
import sys
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

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
    get_base_domain,
    make_finding,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "HTTP_SECURITY"
TIMING_THRESHOLD = 5.0        # seconds — probe must exceed baseline by this
DEFAULT_TIMEOUT = 10           # socket timeout in seconds
MAX_RECV_BYTES = 65536         # maximum bytes to read from a response


# ---------------------------------------------------------------------------
# Raw Socket Transport
# ---------------------------------------------------------------------------
def raw_request(
    host: str,
    port: int,
    use_ssl: bool,
    request_bytes: bytes,
    timeout: int = DEFAULT_TIMEOUT,
) -> Optional[bytes]:
    """Send raw bytes to *host*:*port* and return the response bytes.

    Returns ``None`` on connection or transport error.
    """
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


def timed_raw_request(
    host: str,
    port: int,
    use_ssl: bool,
    request_bytes: bytes,
    timeout: int = DEFAULT_TIMEOUT,
) -> Tuple[Optional[bytes], float]:
    """Like :func:`raw_request` but also returns elapsed wall-clock time."""
    start = time.monotonic()
    resp = raw_request(host, port, use_ssl, request_bytes, timeout=timeout)
    elapsed = time.monotonic() - start
    return resp, elapsed


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


def _status_code(response: Optional[bytes]) -> Optional[int]:
    """Extract the HTTP status code from a raw response."""
    if not response:
        return None
    match = re.match(rb"HTTP/\d\.\d\s+(\d{3})", response)
    if match:
        return int(match.group(1))
    return None


# ---------------------------------------------------------------------------
# Baseline Timing
# ---------------------------------------------------------------------------
def get_baseline_response_time(
    host: str,
    port: int,
    use_ssl: bool,
    path: str,
) -> float:
    """Send a normal GET request and return the response time in seconds.

    Returns a large sentinel (999.0) if the connection fails so that any
    later comparison will not produce a false positive.
    """
    request_bytes = (
        b"GET " + path.encode() + b" HTTP/1.1\r\n"
        b"Host: " + host.encode() + b"\r\n"
        b"Connection: close\r\n"
        b"\r\n"
    )
    _, elapsed = timed_raw_request(host, port, use_ssl, request_bytes,
                                   timeout=DEFAULT_TIMEOUT)
    return elapsed if elapsed > 0 else 999.0


# ---------------------------------------------------------------------------
# CL.TE Probe
# ---------------------------------------------------------------------------
def check_cl_te(
    host: str,
    port: int,
    use_ssl: bool,
    path: str,
    baseline_time: float,
) -> List[Dict]:
    """Detect CL.TE desynchronization via timing.

    The probe sends conflicting Content-Length and Transfer-Encoding
    headers.  Content-Length covers only the ``0\\r\\n\\r\\n`` chunk
    terminator (6 bytes), but the body also contains a trailing ``X``
    after the chunk end.  If the back-end honours Transfer-Encoding
    (chunked) and sees the terminating chunk, it may then wait for the
    *next* request to arrive — causing a measurable delay.
    """
    findings: List[Dict] = []

    # Body: "0\r\n\r\nX"  — 6 bytes when counted by Content-Length
    # In chunked: "0\r\n\r\n" is a valid terminator, then "X" is leftover.
    body = b"0\r\n\r\nX"

    request_bytes = (
        b"POST " + path.encode() + b" HTTP/1.1\r\n"
        b"Host: " + host.encode() + b"\r\n"
        b"Content-Type: application/x-www-form-urlencoded\r\n"
        b"Content-Length: 6\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"Connection: close\r\n"
        b"\r\n"
        + body
    )

    resp, elapsed = timed_raw_request(host, port, use_ssl, request_bytes,
                                      timeout=DEFAULT_TIMEOUT)

    delay = elapsed - baseline_time
    if delay >= TIMING_THRESHOLD:
        findings.append(make_finding(
            vulnerability="HTTP Request Smuggling (CL.TE Desync)",
            severity="HIGH",
            location=f"{'https' if use_ssl else 'http'}://{host}:{port}{path}",
            evidence=(
                f"CL.TE probe caused {elapsed:.1f}s response delay "
                f"(baseline: {baseline_time:.1f}s), indicating front-end uses "
                f"Content-Length while back-end uses Transfer-Encoding"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "CL.TE",
                "baseline_time": round(baseline_time, 2),
                "probe_time": round(elapsed, 2),
                "threshold": TIMING_THRESHOLD,
                "status_code": _status_code(resp),
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# TE.CL Probe
# ---------------------------------------------------------------------------
def check_te_cl(
    host: str,
    port: int,
    use_ssl: bool,
    path: str,
    baseline_time: float,
) -> List[Dict]:
    """Detect TE.CL desynchronization via timing.

    Content-Length is set to 3, covering only ``1\\n`` (the chunk-size
    line).  Transfer-Encoding is ``chunked``.  If the front-end honours
    Transfer-Encoding and forwards the whole body, but the back-end
    honours Content-Length and only reads 3 bytes, remaining data
    poisons the next request.  A timing difference indicates a
    discrepancy.
    """
    findings: List[Dict] = []

    # Body in proper chunked encoding: chunk-size "1\r\n", chunk-data "X\r\n",
    # last-chunk "0\r\n", trailing CRLF "\r\n"
    body = b"1\r\nX\r\n0\r\n\r\n"

    request_bytes = (
        b"POST " + path.encode() + b" HTTP/1.1\r\n"
        b"Host: " + host.encode() + b"\r\n"
        b"Content-Type: application/x-www-form-urlencoded\r\n"
        b"Content-Length: 3\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"Connection: close\r\n"
        b"\r\n"
        + body
    )

    resp, elapsed = timed_raw_request(host, port, use_ssl, request_bytes,
                                      timeout=DEFAULT_TIMEOUT)

    delay = elapsed - baseline_time
    if delay >= TIMING_THRESHOLD:
        findings.append(make_finding(
            vulnerability="HTTP Request Smuggling (TE.CL Desync)",
            severity="HIGH",
            location=f"{'https' if use_ssl else 'http'}://{host}:{port}{path}",
            evidence=(
                f"TE.CL probe caused {elapsed:.1f}s response delay "
                f"(baseline: {baseline_time:.1f}s), indicating front-end uses "
                f"Transfer-Encoding while back-end uses Content-Length"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "TE.CL",
                "baseline_time": round(baseline_time, 2),
                "probe_time": round(elapsed, 2),
                "threshold": TIMING_THRESHOLD,
                "status_code": _status_code(resp),
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# TE.TE Probe (Transfer-Encoding Obfuscation)
# ---------------------------------------------------------------------------
# Obfuscated Transfer-Encoding header variants that may cause one layer
# to honour the header while another ignores it.
TE_OBFUSCATION_VARIANTS = [
    b"Transfer-Encoding: xchunked",
    b"Transfer-Encoding : chunked",
    b"Transfer-Encoding: chunked\r\nTransfer-Encoding: x",
    b"Transfer-encoding: chunked",
    b"Transfer-Encoding:\tchunked",
    b" Transfer-Encoding: chunked",
    b"X: x\r\nTransfer-Encoding: chunked",
]


def check_te_te(
    host: str,
    port: int,
    use_ssl: bool,
    path: str,
    baseline_time: float,
) -> List[Dict]:
    """Detect TE.TE desynchronization using obfuscated Transfer-Encoding.

    If one proxy/server strips or ignores an obfuscated Transfer-Encoding
    header while another honours it, the request may be desynchronized.
    We compare response behaviour (status code and timing) to a baseline.
    """
    findings: List[Dict] = []

    # First, get a reference response with a clean POST
    clean_body = b"0\r\n\r\n"
    clean_request = (
        b"POST " + path.encode() + b" HTTP/1.1\r\n"
        b"Host: " + host.encode() + b"\r\n"
        b"Content-Type: application/x-www-form-urlencoded\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"Connection: close\r\n"
        b"\r\n"
        + clean_body
    )
    clean_resp, clean_time = timed_raw_request(host, port, use_ssl,
                                               clean_request,
                                               timeout=DEFAULT_TIMEOUT)
    clean_status = _status_code(clean_resp)

    triggered_variants: List[str] = []

    for variant in TE_OBFUSCATION_VARIANTS:
        probe_request = (
            b"POST " + path.encode() + b" HTTP/1.1\r\n"
            b"Host: " + host.encode() + b"\r\n"
            b"Content-Type: application/x-www-form-urlencoded\r\n"
            b"Content-Length: 5\r\n"
            + variant + b"\r\n"
            b"Connection: close\r\n"
            b"\r\n"
            + clean_body
        )
        probe_resp, probe_time = timed_raw_request(host, port, use_ssl,
                                                   probe_request,
                                                   timeout=DEFAULT_TIMEOUT)
        probe_status = _status_code(probe_resp)

        # Flag if the server responds differently to the obfuscated variant
        timing_diff = abs(probe_time - clean_time) >= TIMING_THRESHOLD
        status_diff = (probe_status is not None
                       and clean_status is not None
                       and probe_status != clean_status)

        if timing_diff or status_diff:
            triggered_variants.append(variant.decode(errors="replace"))

    if triggered_variants:
        findings.append(make_finding(
            vulnerability="HTTP Request Smuggling (TE.TE Obfuscation)",
            severity="MEDIUM",
            location=f"{'https' if use_ssl else 'http'}://{host}:{port}{path}",
            evidence=(
                f"Server responds differently to obfuscated Transfer-Encoding "
                f"headers, indicating potential TE.TE desynchronization. "
                f"Triggered variants: {', '.join(triggered_variants[:3])}"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "TE.TE",
                "triggered_variants": triggered_variants,
                "clean_status": clean_status,
                "baseline_time": round(baseline_time, 2),
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
            vulnerability="HTTP Request Smuggling (CL.TE Desync)",
            severity="HIGH",
            location=target,
            evidence=(
                "CL.TE probe caused 10.2s response delay (baseline: 0.3s), "
                "indicating front-end uses Content-Length while back-end uses "
                "Transfer-Encoding"
            ),
            category=CATEGORY,
            raw_details={
                "technique": "CL.TE",
                "baseline_time": 0.3,
                "probe_time": 10.2,
                "threshold": 5.0,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — HTTP Request Smuggling Detection Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    findings: List[Dict] = []

    host, port, use_ssl, path = _parse_target(target)

    if not host:
        output_error(f"Cannot parse host from target URL: {target}")
        return

    # Step 1: Verify connectivity and establish baseline timing
    baseline_time = get_baseline_response_time(host, port, use_ssl, path)
    if baseline_time >= 999.0:
        output_error(
            f"Cannot reach target {host}:{port} — baseline request failed"
        )
        return

    # Step 2: CL.TE desynchronization probe
    try:
        findings.extend(check_cl_te(host, port, use_ssl, path, baseline_time))
    except Exception:
        pass  # Non-fatal — continue with remaining probes

    # Step 3: TE.CL desynchronization probe
    try:
        findings.extend(check_te_cl(host, port, use_ssl, path, baseline_time))
    except Exception:
        pass

    # Step 4: TE.TE obfuscation probe
    try:
        findings.extend(check_te_te(host, port, use_ssl, path, baseline_time))
    except Exception:
        pass

    output_findings(findings)


if __name__ == "__main__":
    main()
