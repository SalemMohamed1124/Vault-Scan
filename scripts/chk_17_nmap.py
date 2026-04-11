#!/usr/bin/env python3
"""
VaultScan — Port Scanner
Uses nmap if available, falls back to Python socket scanning.
Outputs JSON array of findings to stdout.
"""

import argparse
import json
import os
import socket
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

# Port severity mapping
PORT_SEVERITY: dict[int, tuple[str, str]] = {
    21: ("MEDIUM", "FTP"),
    22: ("MEDIUM", "SSH"),
    23: ("HIGH", "Telnet"),
    25: ("LOW", "SMTP"),
    53: ("LOW", "DNS"),
    110: ("LOW", "POP3"),
    135: ("MEDIUM", "MSRPC"),
    139: ("MEDIUM", "NetBIOS"),
    143: ("LOW", "IMAP"),
    445: ("MEDIUM", "SMB"),
    993: ("LOW", "IMAPS"),
    995: ("LOW", "POP3S"),
    1433: ("CRITICAL", "MSSQL"),
    1521: ("CRITICAL", "Oracle DB"),
    3306: ("CRITICAL", "MySQL"),
    3389: ("HIGH", "RDP"),
    5432: ("CRITICAL", "PostgreSQL"),
    5900: ("HIGH", "VNC"),
    6379: ("CRITICAL", "Redis"),
    8080: ("LOW", "HTTP-Alt"),
    8443: ("LOW", "HTTPS-Alt"),
    27017: ("CRITICAL", "MongoDB"),
}

# Ports to exclude from findings (web ports)
EXCLUDED_PORTS = {80, 443}


def get_mock_data(target: str) -> list[dict[str, Any]]:
    """Return realistic mock data for development."""
    return [
        {
            "vulnerability": "SSH Port Exposed",
            "severity": "MEDIUM",
            "location": f"{target}:22",
            "evidence": "Port 22 open - SSH-2.0-OpenSSH_7.4 (outdated version)",
            "category": "NETWORK",
            "cve_id": None,
            "raw_details": {"port": 22, "service": "SSH", "state": "open"},
        },
        {
            "vulnerability": "Telnet Port Exposed",
            "severity": "HIGH",
            "location": f"{target}:23",
            "evidence": "Port 23 open - Telnet (unencrypted protocol)",
            "category": "NETWORK",
            "cve_id": None,
            "raw_details": {"port": 23, "service": "Telnet", "state": "open"},
        },
        {
            "vulnerability": "Database Port Exposed",
            "severity": "CRITICAL",
            "location": f"{target}:3306",
            "evidence": "Port 3306 open - MySQL database publicly accessible",
            "category": "NETWORK",
            "cve_id": None,
            "raw_details": {"port": 3306, "service": "MySQL", "state": "open"},
        },
        {
            "vulnerability": "FTP Port Exposed",
            "severity": "MEDIUM",
            "location": f"{target}:21",
            "evidence": "Port 21 open - FTP (consider SFTP instead)",
            "category": "NETWORK",
            "cve_id": None,
            "raw_details": {"port": 21, "service": "FTP", "state": "open"},
        },
        {
            "vulnerability": "RDP Port Exposed",
            "severity": "HIGH",
            "location": f"{target}:3389",
            "evidence": "Port 3389 open - Remote Desktop Protocol",
            "category": "NETWORK",
            "cve_id": None,
            "raw_details": {"port": 3389, "service": "RDP", "state": "open"},
        },
    ]


def scan_port_socket(target: str, port: int, timeout: float = 1.5) -> dict[str, Any] | None:
    """Scan a single port using socket."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((target, port))
            if result == 0:
                service = PORT_SEVERITY.get(port, (None, None))[1] or "unknown"
                # Try to grab banner
                banner = ""
                try:
                    sock.settimeout(1.0)
                    sock.sendall(b"\r\n")
                    banner = sock.recv(1024).decode("utf-8", errors="ignore").strip()
                except Exception:
                    pass
                return {
                    "port": port,
                    "state": "open",
                    "service": service,
                    "banner": banner,
                }
    except Exception:
        pass
    return None


def parse_port_spec(port_range: str) -> list[int]:
    """Parse port specification like '1-1024,3306,5432,8080' into a list of ports."""
    ports: list[int] = []
    for part in port_range.split(","):
        part = part.strip()
        if "-" in part:
            segments = part.split("-")
            start = int(segments[0])
            end = int(segments[1])
            ports.extend(range(start, end + 1))
        else:
            ports.append(int(part))
    return sorted(set(ports))


def socket_scan(target: str, port_range: str, full: bool) -> list[dict[str, Any]]:
    """Scan ports using Python sockets with threading."""
    if full:
        port_list = list(range(1, 65536))
    elif port_range:
        port_list = parse_port_spec(port_range)
    else:
        port_list = list(range(1, 1001))

    open_ports: list[dict[str, Any]] = []
    max_workers = min(200, len(port_list))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(scan_port_socket, target, port): port
            for port in port_list
        }
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                open_ports.append(result)

    return sorted(open_ports, key=lambda x: x["port"])


def nmap_scan(target: str, port_range: str, full: bool) -> list[dict[str, Any]]:
    """Scan using python-nmap library."""
    import nmap  # type: ignore[import-untyped]

    nm = nmap.PortScanner()

    if full:
        args = "-sV -T4 -p-"
    elif port_range:
        args = f"-sV -T4 -p {port_range}"
    else:
        args = "-sV -T4 -p 1-1000"

    nm.scan(hosts=target, arguments=args)

    open_ports: list[dict[str, Any]] = []
    for host in nm.all_hosts():
        for proto in nm[host].all_protocols():
            ports = nm[host][proto].keys()
            for port in ports:
                port_info = nm[host][proto][port]
                if port_info["state"] == "open":
                    open_ports.append({
                        "port": port,
                        "state": "open",
                        "service": port_info.get("name", "unknown"),
                        "banner": port_info.get("product", "")
                        + (" " + port_info.get("version", "")).strip(),
                    })

    return sorted(open_ports, key=lambda x: x["port"])


def build_findings(target: str, open_ports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert open port data into vulnerability findings."""
    findings: list[dict[str, Any]] = []

    for port_info in open_ports:
        port = port_info["port"]

        # Skip web ports
        if port in EXCLUDED_PORTS:
            continue

        severity_info = PORT_SEVERITY.get(port)
        if severity_info:
            severity, service_name = severity_info
        else:
            severity = "LOW"
            service_name = port_info.get("service", "unknown")

        service_display = port_info.get("service", service_name)
        banner = port_info.get("banner", "")
        evidence = f"Port {port} open - {service_display}"
        if banner:
            evidence += f" ({banner})"

        vuln_name = f"{service_display} Port Exposed"
        if severity == "CRITICAL":
            vuln_name = f"{service_display} Database Port Publicly Accessible"
        elif severity == "HIGH":
            vuln_name = f"{service_display} Port Exposed (High Risk)"

        findings.append({
            "vulnerability": vuln_name,
            "severity": severity,
            "location": f"{target}:{port}",
            "evidence": evidence,
            "category": "NETWORK",
            "cve_id": None,
            "raw_details": port_info,
        })

    return findings


def main() -> None:
    parser = argparse.ArgumentParser(description="VaultScan Port Scanner")
    parser.add_argument("--target", required=True, help="Target hostname or IP")
    parser.add_argument("--ports", default="1-1000", help="Port range (e.g., 1-1000)")
    parser.add_argument("--full", action="store_true", help="Scan all 65535 ports")
    args = parser.parse_args()

    # Extract hostname from URL if needed
    target = args.target
    if target.startswith(("http://", "https://")):
        parsed = urlparse(target)
        target = parsed.hostname or target

    # Mock mode
    if os.environ.get("SCAN_MOCK_MODE", "").lower() == "true":
        print(json.dumps(get_mock_data(target), indent=2))
        return

    try:
        # Resolve hostname
        try:
            socket.gethostbyname(target)
        except socket.gaierror:
            print(json.dumps({"error": f"Cannot resolve hostname: {target}"}))
            sys.exit(1)

        # Try nmap first, fall back to socket
        try:
            import nmap  # type: ignore[import-untyped]  # noqa: F401
            open_ports = nmap_scan(target, args.ports, args.full)
        except ImportError:
            open_ports = socket_scan(target, args.ports, args.full)

        findings = build_findings(target, open_ports)
        print(json.dumps(findings, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
