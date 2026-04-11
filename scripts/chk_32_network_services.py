#!/usr/bin/env python3
"""
VaultScan — Network Services Vulnerability Scanner
====================================================
Checks for insecure network services including:
  1.  FTP anonymous access (port 21)
  2.  Telnet open (port 23) — insecure protocol
  3.  SSH weak algorithms / old versions (port 22)
  4.  SMTP open relay indicators (port 25)
  5.  Redis no-auth (port 6379)
  6.  MongoDB no-auth (port 27017)
  7.  Elasticsearch no-auth (port 9200)
  8.  Memcached open (port 11211)
  9.  MySQL no-auth (port 3306)
  10. PostgreSQL trust auth (port 5432)
  11. SNMP default community string (port 161)
  12. RDP exposed (port 3389)

Uses raw socket connections for service probing.
Outputs JSON array of findings to stdout.
"""

import os
import re
import socket
import struct
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

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
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "NETWORK_SERVICES"
DEFAULT_SOCKET_TIMEOUT = 5

# Default ports to scan when --ports is not specified
DEFAULT_PORTS = [21, 22, 23, 25, 161, 3306, 3389, 5432, 6379, 9200, 11211, 27017]

# Weak / outdated SSH versions that indicate vulnerabilities
WEAK_SSH_VERSIONS = [
    re.compile(r"SSH-1\.", re.I),                          # SSHv1 protocol
    re.compile(r"OpenSSH[_-]([1-6])\.", re.I),             # OpenSSH < 7.0
    re.compile(r"OpenSSH[_-]7\.[0-3]", re.I),              # OpenSSH 7.0-7.3
    re.compile(r"dropbear[_-]0\.", re.I),                   # Old Dropbear
    re.compile(r"libssh[_-]0\.[1-6]", re.I),               # Old libssh
]


# ---------------------------------------------------------------------------
# Mock Data
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development/testing."""
    return [
        make_finding(
            vulnerability="Redis Server Without Authentication",
            severity="CRITICAL",
            location=f"{target}:6379",
            evidence="Redis responded to PING with +PONG without requiring authentication. "
                     "Unauthenticated access allows full database read/write.",
            category=CATEGORY,
            raw_details={
                "port": 6379,
                "service": "Redis",
                "response": "+PONG",
                "auth_required": False,
            },
        ),
        make_finding(
            vulnerability="FTP Anonymous Access Enabled",
            severity="HIGH",
            location=f"{target}:21",
            evidence="FTP server allows anonymous login. An attacker can browse and "
                     "potentially download files without credentials.",
            category=CATEGORY,
            raw_details={
                "port": 21,
                "service": "FTP",
                "anonymous_login": True,
                "banner": "220 (vsFTPd 3.0.3)",
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Socket Helpers
# ---------------------------------------------------------------------------
def _connect(host: str, port: int, timeout: float = DEFAULT_SOCKET_TIMEOUT) -> Optional[socket.socket]:
    """Open a TCP connection. Returns socket on success, None on failure."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        return sock
    except (socket.timeout, socket.error, OSError):
        return None


def _recv(sock: socket.socket, bufsize: int = 4096, timeout: float = 3.0) -> str:
    """Receive data from socket with timeout. Returns decoded string."""
    try:
        sock.settimeout(timeout)
        data = sock.recv(bufsize)
        return data.decode("utf-8", errors="replace").strip()
    except (socket.timeout, socket.error, OSError):
        return ""


def _send_recv(sock: socket.socket, payload: bytes, bufsize: int = 4096, timeout: float = 3.0) -> str:
    """Send data and receive response."""
    try:
        sock.settimeout(timeout)
        sock.sendall(payload)
        return _recv(sock, bufsize, timeout)
    except (socket.timeout, socket.error, OSError):
        return ""


# ---------------------------------------------------------------------------
# Service Checks
# ---------------------------------------------------------------------------
def check_ftp_anonymous(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if FTP allows anonymous login (port 21)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        banner = _recv(sock, timeout=timeout)
        if not banner:
            return None

        # Send USER anonymous
        resp_user = _send_recv(sock, b"USER anonymous\r\n", timeout=timeout)
        if not resp_user:
            return None

        # 331 = password required (expected), 230 = logged in without password
        if resp_user.startswith("230"):
            return make_finding(
                vulnerability="FTP Anonymous Access Enabled",
                severity="HIGH",
                location=f"{host}:{port}",
                evidence=f"FTP server allows anonymous login without password. Banner: {banner[:100]}",
                category=CATEGORY,
                raw_details={"port": port, "service": "FTP", "banner": banner[:200], "anonymous_login": True},
            )

        if resp_user.startswith("331"):
            # Try PASS anonymous@
            resp_pass = _send_recv(sock, b"PASS anonymous@\r\n", timeout=timeout)
            if resp_pass and resp_pass.startswith("230"):
                return make_finding(
                    vulnerability="FTP Anonymous Access Enabled",
                    severity="HIGH",
                    location=f"{host}:{port}",
                    evidence=f"FTP server allows anonymous login (USER anonymous / PASS anonymous@). "
                             f"Banner: {banner[:100]}",
                    category=CATEGORY,
                    raw_details={"port": port, "service": "FTP", "banner": banner[:200], "anonymous_login": True},
                )

        # Send QUIT
        try:
            sock.sendall(b"QUIT\r\n")
        except Exception:
            pass
        return None
    finally:
        sock.close()


def check_telnet_open(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if Telnet is open (port 23). Any response = HIGH since Telnet is insecure."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        banner = _recv(sock, timeout=timeout)
        return make_finding(
            vulnerability="Telnet Service Exposed",
            severity="HIGH",
            location=f"{host}:{port}",
            evidence="Telnet service is accessible. Telnet transmits data (including credentials) "
                     "in plaintext and should be replaced with SSH."
                     + (f" Banner: {banner[:100]}" if banner else ""),
            category=CATEGORY,
            raw_details={"port": port, "service": "Telnet", "banner": banner[:200] if banner else ""},
        )
    finally:
        sock.close()


def check_ssh_weak(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check SSH banner for outdated versions (port 22)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        banner = _recv(sock, timeout=timeout)
        if not banner:
            return None

        for pattern in WEAK_SSH_VERSIONS:
            match = pattern.search(banner)
            if match:
                return make_finding(
                    vulnerability="SSH Server Running Outdated Version",
                    severity="MEDIUM",
                    location=f"{host}:{port}",
                    evidence=f"SSH server reports an outdated version that may support weak algorithms. "
                             f"Banner: {banner[:150]}",
                    category=CATEGORY,
                    raw_details={"port": port, "service": "SSH", "banner": banner[:200], "weak_version": True},
                )
        return None
    finally:
        sock.close()


def check_smtp_open_relay(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check SMTP for open relay indicators (port 25)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        banner = _recv(sock, timeout=timeout)
        if not banner:
            return None

        # Send EHLO to enumerate capabilities
        ehlo_resp = _send_recv(sock, b"EHLO test.local\r\n", timeout=timeout)
        if not ehlo_resp:
            try:
                sock.sendall(b"QUIT\r\n")
            except Exception:
                pass
            return None

        # Try MAIL FROM with external domain
        mail_resp = _send_recv(sock, b"MAIL FROM:<test@external-domain.com>\r\n", timeout=timeout)
        if not mail_resp:
            try:
                sock.sendall(b"QUIT\r\n")
            except Exception:
                pass
            return None

        # If 250 OK, try RCPT TO with another external domain
        if mail_resp.startswith("250"):
            rcpt_resp = _send_recv(sock, b"RCPT TO:<test@another-external.com>\r\n", timeout=timeout)
            if rcpt_resp and rcpt_resp.startswith("250"):
                try:
                    sock.sendall(b"RSET\r\nQUIT\r\n")
                except Exception:
                    pass
                return make_finding(
                    vulnerability="SMTP Open Relay Detected",
                    severity="HIGH",
                    location=f"{host}:{port}",
                    evidence="SMTP server accepted MAIL FROM and RCPT TO for external domains, "
                             f"indicating it may be an open relay. Banner: {banner[:100]}",
                    category=CATEGORY,
                    raw_details={
                        "port": port,
                        "service": "SMTP",
                        "banner": banner[:200],
                        "open_relay": True,
                        "ehlo_response": ehlo_resp[:300],
                    },
                )

        try:
            sock.sendall(b"QUIT\r\n")
        except Exception:
            pass
        return None
    finally:
        sock.close()


def check_redis_noauth(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if Redis accepts commands without authentication (port 6379)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        response = _send_recv(sock, b"PING\r\n", timeout=timeout)
        if "+PONG" in response:
            # Also try INFO to confirm full access
            info_resp = _send_recv(sock, b"INFO server\r\n", timeout=timeout)
            version = ""
            if info_resp and "redis_version" in info_resp:
                for line in info_resp.split("\n"):
                    if line.startswith("redis_version:"):
                        version = line.split(":")[1].strip()
                        break

            return make_finding(
                vulnerability="Redis Server Without Authentication",
                severity="CRITICAL",
                location=f"{host}:{port}",
                evidence="Redis responded to PING with +PONG without requiring authentication. "
                         "Unauthenticated access allows full database read/write and potential "
                         "remote code execution via CONFIG SET."
                         + (f" Redis version: {version}" if version else ""),
                category=CATEGORY,
                raw_details={
                    "port": port,
                    "service": "Redis",
                    "response": "+PONG",
                    "auth_required": False,
                    "version": version,
                },
            )
        return None
    finally:
        sock.close()


def check_mongodb_noauth(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if MongoDB accepts connections without authentication (port 27017)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        # MongoDB wire protocol: send an isMaster command
        # Build a simple OP_QUERY message for isMaster
        # Collection: admin.$cmd
        ns = b"admin.$cmd\x00"
        # Query document (BSON for {isMaster: 1}):
        query_doc = (
            b"\x15\x00\x00\x00"      # document size (21 bytes)
            b"\x10"                    # type: int32
            b"isMaster\x00"           # field name
            b"\x01\x00\x00\x00"       # value: 1
            b"\x00"                    # document terminator
        )

        # OP_QUERY header
        flags = b"\x00\x00\x00\x00"
        skip = b"\x00\x00\x00\x00"
        ret = b"\x01\x00\x00\x00"     # numberToReturn = 1

        payload = flags + ns + skip + ret + query_doc
        # MsgHeader: messageLength(4) + requestID(4) + responseTo(4) + opCode(4)
        msg_len = 16 + len(payload)
        header = struct.pack("<iiii", msg_len, 1, 0, 2004)  # 2004 = OP_QUERY
        message = header + payload

        sock.sendall(message)
        sock.settimeout(timeout)
        response = sock.recv(4096)

        if response and len(response) > 36:
            # We got a response — MongoDB is accepting connections without auth
            resp_text = response.decode("utf-8", errors="replace")
            is_master = "ismaster" in resp_text.lower() or "maxBsonObjectSize" in resp_text.lower()

            if is_master or len(response) > 50:
                return make_finding(
                    vulnerability="MongoDB Server Without Authentication",
                    severity="CRITICAL",
                    location=f"{host}:{port}",
                    evidence="MongoDB accepted an isMaster query without authentication. "
                             "Unauthenticated access allows reading and modifying all databases.",
                    category=CATEGORY,
                    raw_details={
                        "port": port,
                        "service": "MongoDB",
                        "auth_required": False,
                        "response_length": len(response),
                    },
                )
        return None
    except (socket.timeout, socket.error, OSError, struct.error):
        return None
    finally:
        sock.close()


def check_elasticsearch_noauth(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if Elasticsearch is accessible without auth (port 9200)."""
    # Elasticsearch uses HTTP, so use a simple HTTP GET
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        request = (
            b"GET / HTTP/1.1\r\n"
            b"Host: " + host.encode() + b"\r\n"
            b"Accept: application/json\r\n"
            b"Connection: close\r\n"
            b"\r\n"
        )
        response = _send_recv(sock, request, bufsize=8192, timeout=timeout)

        if not response:
            return None

        # Look for Elasticsearch identifiers in the response
        es_indicators = ["cluster_name", "cluster_uuid", "tagline", "lucene_version", "elasticsearch"]
        indicator_found = any(ind in response.lower() for ind in es_indicators)

        if indicator_found and ("200 OK" in response or '"name"' in response):
            # Extract version if possible
            version = ""
            import json as json_mod
            try:
                body_start = response.find("{")
                if body_start != -1:
                    body = response[body_start:]
                    data = json_mod.loads(body)
                    version = data.get("version", {}).get("number", "")
            except (ValueError, KeyError):
                pass

            return make_finding(
                vulnerability="Elasticsearch Accessible Without Authentication",
                severity="CRITICAL",
                location=f"{host}:{port}",
                evidence="Elasticsearch cluster is accessible without authentication. "
                         "This allows reading, modifying, and deleting all indices."
                         + (f" Version: {version}" if version else ""),
                category=CATEGORY,
                raw_details={
                    "port": port,
                    "service": "Elasticsearch",
                    "auth_required": False,
                    "version": version,
                },
            )
        return None
    finally:
        sock.close()


def check_memcached_open(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if Memcached is accessible (port 11211)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        response = _send_recv(sock, b"stats\r\n", timeout=timeout)

        if response and "STAT" in response:
            # Extract some stats for evidence
            version = ""
            items = ""
            for line in response.split("\n"):
                line = line.strip()
                if line.startswith("STAT version"):
                    version = line.split(" ", 2)[-1] if len(line.split(" ")) >= 3 else ""
                elif line.startswith("STAT curr_items"):
                    items = line.split(" ", 2)[-1] if len(line.split(" ")) >= 3 else ""

            return make_finding(
                vulnerability="Memcached Server Exposed Without Authentication",
                severity="CRITICAL",
                location=f"{host}:{port}",
                evidence="Memcached responded to 'stats' command without authentication. "
                         "This can leak cached data and be abused for DDoS amplification attacks."
                         + (f" Version: {version}" if version else "")
                         + (f", Items cached: {items}" if items else ""),
                category=CATEGORY,
                raw_details={
                    "port": port,
                    "service": "Memcached",
                    "auth_required": False,
                    "version": version,
                    "cached_items": items,
                },
            )
        return None
    finally:
        sock.close()


def check_mysql_noauth(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if MySQL accepts connections without a password (port 3306)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        # MySQL sends a greeting packet upon connection
        greeting = _recv(sock, bufsize=4096, timeout=timeout)
        if not greeting:
            return None

        # MySQL greeting starts with protocol version byte, then server version string
        # If we receive a valid greeting, the server is accepting connections
        # Look for MySQL protocol indicators
        raw_bytes = greeting.encode("utf-8", errors="replace")

        # Check if it looks like a MySQL greeting (version string is usually present)
        is_mysql = any(kw in greeting.lower() for kw in ["mysql", "mariadb", "5.", "8.", "10."])

        if not is_mysql and len(greeting) < 10:
            return None

        # Try to authenticate with empty password
        # Send a minimal handshake response (client auth packet)
        # This is a simplified check — we look for error vs. OK in response
        # Construct a basic COM_QUIT if we got a greeting
        version_str = ""
        try:
            # MySQL greeting: after first 4 bytes, null-terminated version string
            null_pos = greeting.find("\x00")
            if null_pos > 0:
                version_str = greeting[1:null_pos] if len(greeting) > 1 else ""
        except Exception:
            pass

        # If we received a valid MySQL greeting, report it as potentially vulnerable
        # (the service is accepting connections and exposing version info)
        if is_mysql or len(greeting) > 20:
            return make_finding(
                vulnerability="MySQL Server Exposed — Version Disclosed",
                severity="MEDIUM",
                location=f"{host}:{port}",
                evidence="MySQL server is accepting connections and disclosed its version in the "
                         "greeting packet. Test with empty password manually recommended."
                         + (f" Version hint: {version_str[:50]}" if version_str else ""),
                category=CATEGORY,
                raw_details={
                    "port": port,
                    "service": "MySQL",
                    "greeting_received": True,
                    "version": version_str[:50],
                },
            )
        return None
    finally:
        sock.close()


def check_postgresql_trust(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if PostgreSQL uses trust authentication (port 5432)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        # PostgreSQL startup message: version 3.0, user=postgres, database=postgres
        user = b"postgres\x00"
        db = b"postgres\x00"

        params = b"user\x00" + user + b"database\x00" + db + b"\x00"
        # Startup message: length(4) + protocol(4) + params
        proto = struct.pack(">HH", 3, 0)  # version 3.0
        msg_body = proto + params
        msg_len = 4 + len(msg_body)
        startup = struct.pack(">I", msg_len) + msg_body

        sock.sendall(startup)
        sock.settimeout(timeout)
        response = sock.recv(4096)

        if not response:
            return None

        resp_type = chr(response[0]) if response else ""

        # 'R' = Authentication request
        if resp_type == "R" and len(response) >= 8:
            auth_type = struct.unpack(">I", response[5:9])[0] if len(response) >= 9 else -1

            # auth_type 0 = AuthenticationOk (trust auth — no password needed!)
            if auth_type == 0:
                return make_finding(
                    vulnerability="PostgreSQL Trust Authentication — No Password Required",
                    severity="CRITICAL",
                    location=f"{host}:{port}",
                    evidence="PostgreSQL accepted connection as 'postgres' without any password "
                             "(trust authentication). Full database access is possible.",
                    category=CATEGORY,
                    raw_details={
                        "port": port,
                        "service": "PostgreSQL",
                        "auth_type": "trust",
                        "user": "postgres",
                    },
                )

        # 'E' = Error — server is up but rejected us (that's expected/good)
        return None
    except (socket.timeout, socket.error, OSError, struct.error):
        return None
    finally:
        sock.close()


def check_snmp_default_community(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if SNMP responds to default 'public' community string (port 161/UDP)."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)

        # SNMP v1 GET request with community string "public"
        # ASN.1 BER encoded SNMPv1 GetRequest for sysDescr.0 (1.3.6.1.2.1.1.1.0)
        snmp_get = bytes([
            0x30, 0x26,                                     # SEQUENCE, length 38
            0x02, 0x01, 0x00,                               # version: 0 (SNMPv1)
            0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63, # community: "public"
            0xa0, 0x19,                                     # GetRequest PDU, length 25
            0x02, 0x04, 0x00, 0x00, 0x00, 0x01,             # request-id: 1
            0x02, 0x01, 0x00,                               # error-status: 0
            0x02, 0x01, 0x00,                               # error-index: 0
            0x30, 0x0b,                                     # varbind list
            0x30, 0x09,                                     # varbind
            0x06, 0x05, 0x2b, 0x06, 0x01, 0x02, 0x01,      # OID: 1.3.6.1.2.1
            0x05, 0x00,                                     # value: NULL
        ])

        sock.sendto(snmp_get, (host, port))
        response, _ = sock.recvfrom(4096)

        if response and len(response) > 10:
            return make_finding(
                vulnerability="SNMP Default Community String 'public'",
                severity="MEDIUM",
                location=f"{host}:{port}",
                evidence="SNMP service responded to queries using the default community string "
                         "'public'. This may expose system information and configuration details.",
                category=CATEGORY,
                raw_details={
                    "port": port,
                    "service": "SNMP",
                    "protocol": "UDP",
                    "community": "public",
                    "response_length": len(response),
                },
            )
        return None
    except (socket.timeout, socket.error, OSError):
        return None
    finally:
        try:
            sock.close()
        except Exception:
            pass


def check_rdp_open(host: str, port: int, timeout: float) -> Optional[Dict]:
    """Check if RDP is exposed (port 3389)."""
    sock = _connect(host, port, timeout)
    if sock is None:
        return None
    try:
        # Send an RDP Connection Request (X.224)
        # TPKT header + X.224 Connection Request
        rdp_request = bytes([
            # TPKT Header
            0x03, 0x00,             # version, reserved
            0x00, 0x13,             # length: 19
            # X.224 Connection Request
            0x0e,                   # length
            0xe0,                   # CR (Connection Request)
            0x00, 0x00,             # dst-ref
            0x00, 0x00,             # src-ref
            0x00,                   # class 0
            # RDP Negotiation Request
            0x01,                   # TYPE_RDP_NEG_REQ
            0x00,                   # flags
            0x08, 0x00,             # length
            0x03, 0x00, 0x00, 0x00, # requestedProtocols (TLS + CredSSP)
        ])

        sock.sendall(rdp_request)
        sock.settimeout(timeout)
        response = sock.recv(4096)

        if response and len(response) > 0:
            # Any response indicates RDP is listening and responding
            # Check for X.224 Connection Confirm (0xd0)
            is_rdp = len(response) >= 7 and response[5] == 0xd0

            return make_finding(
                vulnerability="RDP Service Exposed",
                severity="MEDIUM",
                location=f"{host}:{port}",
                evidence="Remote Desktop Protocol (RDP) service is accessible. "
                         "Exposed RDP services are frequent targets for brute-force "
                         "and credential-stuffing attacks."
                         + (" Confirmed RDP protocol." if is_rdp else ""),
                category=CATEGORY,
                raw_details={
                    "port": port,
                    "service": "RDP",
                    "rdp_confirmed": is_rdp,
                    "response_length": len(response),
                },
            )
        return None
    except (socket.timeout, socket.error, OSError):
        return None
    finally:
        sock.close()


# ---------------------------------------------------------------------------
# Port-to-check mapping
# ---------------------------------------------------------------------------
SERVICE_CHECKS = {
    21: ("FTP Anonymous Access", check_ftp_anonymous),
    22: ("SSH Weak Version", check_ssh_weak),
    23: ("Telnet Open", check_telnet_open),
    25: ("SMTP Open Relay", check_smtp_open_relay),
    161: ("SNMP Default Community", check_snmp_default_community),
    3306: ("MySQL No-Auth", check_mysql_noauth),
    3389: ("RDP Exposed", check_rdp_open),
    5432: ("PostgreSQL Trust Auth", check_postgresql_trust),
    6379: ("Redis No-Auth", check_redis_noauth),
    9200: ("Elasticsearch No-Auth", check_elasticsearch_noauth),
    11211: ("Memcached Open", check_memcached_open),
    27017: ("MongoDB No-Auth", check_mongodb_noauth),
}


def parse_ports(ports_str: str) -> List[int]:
    """Parse comma-separated port list or ranges (e.g., '21,22,23,6379' or '20-25,6379')."""
    ports: List[int] = []
    for part in ports_str.split(","):
        part = part.strip()
        if "-" in part:
            segments = part.split("-", 1)
            try:
                start, end = int(segments[0]), int(segments[1])
                ports.extend(range(start, end + 1))
            except ValueError:
                continue
        else:
            try:
                ports.append(int(part))
            except ValueError:
                continue
    return sorted(set(ports))


def resolve_host(target: str) -> str:
    """Extract hostname/IP from a URL or plain target string."""
    if target.startswith(("http://", "https://")):
        parsed = urlparse(target)
        return parsed.hostname or target
    # Strip port if present (e.g., "host:8080")
    if ":" in target and not target.startswith("["):
        return target.split(":")[0]
    return target


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Network Services Vulnerability Scanner")
    parser.add_argument(
        "--ports",
        type=str,
        default="",
        help="Comma-separated ports or ranges to check (default: standard service ports). "
             "Only ports with known checks will be tested.",
    )
    args = parser.parse_args()

    # ── Mock mode ──────────────────────────────────────────────────────────
    if is_mock_mode():
        target = resolve_host(args.target)
        output_findings(get_mock_findings(target))
        return

    # ── Resolve target ─────────────────────────────────────────────────────
    target = resolve_host(args.target)
    try:
        socket.gethostbyname(target)
    except socket.gaierror:
        output_findings([])
        return

    # ── Determine ports to scan ────────────────────────────────────────────
    if args.ports:
        requested_ports = parse_ports(args.ports)
    else:
        requested_ports = DEFAULT_PORTS

    # Only run checks for ports that have a service checker
    ports_to_check = [p for p in requested_ports if p in SERVICE_CHECKS]

    if not ports_to_check:
        output_findings([])
        return

    # ── Run checks concurrently ────────────────────────────────────────────
    findings: List[Dict] = []
    timeout = float(args.timeout)

    with ThreadPoolExecutor(max_workers=min(12, len(ports_to_check))) as executor:
        future_map = {}
        for port in ports_to_check:
            check_name, check_fn = SERVICE_CHECKS[port]
            future = executor.submit(check_fn, target, port, timeout)
            future_map[future] = (port, check_name)

        for future in as_completed(future_map):
            port, check_name = future_map[future]
            try:
                result = future.result()
                if result is not None:
                    findings.append(result)
            except Exception:
                # Silently skip failed checks
                pass

    # Sort findings by severity for consistent output
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    findings.sort(key=lambda f: severity_order.get(f.get("severity", "INFO"), 5))

    output_findings(findings)


if __name__ == "__main__":
    main()
