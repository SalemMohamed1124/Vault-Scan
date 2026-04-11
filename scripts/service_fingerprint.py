#!/usr/bin/env python3
"""
VaultScan — Service/Banner Fingerprinting
Connects to specified ports, grabs banners, and identifies vulnerable service versions.
Outputs JSON array of findings to stdout.
"""

import argparse
import json
import os
import re
import socket
import sys
from typing import Any
from urllib.parse import urlparse

# Known vulnerable version patterns: (regex, service_name, severity, cve_id, description)
VULN_PATTERNS: list[tuple[str, str, str, str | None, str]] = [
    # OpenSSH
    (
        r"OpenSSH[_\s]([1-7]\.\d+)",
        "OpenSSH",
        "MEDIUM",
        "CVE-2023-38408",
        "OpenSSH version < 8.0 has known vulnerabilities",
    ),
    # Apache
    (
        r"Apache/2\.4\.([0-4]\d|49)(\s|$)",
        "Apache",
        "HIGH",
        "CVE-2021-44790",
        "Apache version < 2.4.50 has known vulnerabilities",
    ),
    (
        r"Apache/2\.[0-3]\.",
        "Apache",
        "HIGH",
        "CVE-2021-44790",
        "Apache version < 2.4 is severely outdated",
    ),
    # nginx
    (
        r"nginx/1\.1[0-9]\.",
        "nginx",
        "MEDIUM",
        None,
        "nginx version < 1.20 has known vulnerabilities",
    ),
    (
        r"nginx/1\.\d\.",
        "nginx",
        "MEDIUM",
        None,
        "nginx version < 1.20 has known vulnerabilities",
    ),
    (
        r"nginx/0\.",
        "nginx",
        "HIGH",
        None,
        "nginx version 0.x is severely outdated",
    ),
    # MySQL
    (
        r"mysql.*5\.[0-6]\.",
        "MySQL",
        "HIGH",
        None,
        "MySQL version 5.x is outdated",
    ),
    # ProFTPD
    (
        r"ProFTPD\s+1\.[0-2]\.",
        "ProFTPD",
        "HIGH",
        "CVE-2019-12815",
        "ProFTPD version < 1.3.6 has known vulnerabilities",
    ),
    # vsftpd
    (
        r"vsftpd\s+[12]\.",
        "vsftpd",
        "MEDIUM",
        None,
        "vsftpd version < 3.0 has known vulnerabilities",
    ),
    # Exim
    (
        r"Exim\s+4\.[0-8]\d",
        "Exim",
        "HIGH",
        "CVE-2019-15846",
        "Exim version < 4.92 has critical vulnerabilities",
    ),
]

# Common probes to send to elicit banner responses
PORT_PROBES: dict[int, bytes] = {
    21: b"\r\n",
    22: b"",
    25: b"EHLO test\r\n",
    80: b"HEAD / HTTP/1.0\r\nHost: test\r\n\r\n",
    110: b"\r\n",
    143: b"\r\n",
    443: b"",
    3306: b"",
    5432: b"",
}


def get_mock_data(target: str) -> list[dict[str, Any]]:
    """Return realistic mock data for development."""
    return [
        {
            "vulnerability": "Outdated OpenSSH Version",
            "severity": "MEDIUM",
            "location": f"{target}:22",
            "evidence": "OpenSSH_7.4 detected - version < 8.0 has known vulnerabilities",
            "category": "SERVICE_VERSION",
            "cve_id": "CVE-2023-38408",
            "raw_details": {
                "port": 22,
                "service": "OpenSSH",
                "version": "7.4",
                "banner": "SSH-2.0-OpenSSH_7.4",
            },
        },
        {
            "vulnerability": "Outdated Apache Version",
            "severity": "HIGH",
            "location": f"{target}:80",
            "evidence": "Apache/2.4.41 detected - version < 2.4.50 has known vulnerabilities",
            "category": "SERVICE_VERSION",
            "cve_id": "CVE-2021-44790",
            "raw_details": {
                "port": 80,
                "service": "Apache",
                "version": "2.4.41",
                "banner": "Server: Apache/2.4.41 (Ubuntu)",
            },
        },
        {
            "vulnerability": "Service Banner Detected",
            "severity": "LOW",
            "location": f"{target}:3306",
            "evidence": "MySQL 8.0.28 banner detected on port 3306",
            "category": "SERVICE_VERSION",
            "cve_id": None,
            "raw_details": {
                "port": 3306,
                "service": "MySQL",
                "banner": "8.0.28",
            },
        },
    ]


def grab_banner(target: str, port: int, timeout: float = 3.0) -> str:
    """Connect to a port and grab the service banner."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            sock.connect((target, port))

            # Some services send banner immediately
            try:
                banner = sock.recv(1024).decode("utf-8", errors="ignore").strip()
                if banner:
                    return banner
            except socket.timeout:
                pass

            # Send a probe if no immediate banner
            probe = PORT_PROBES.get(port, b"\r\n")
            if probe:
                try:
                    sock.sendall(probe)
                    banner = sock.recv(1024).decode("utf-8", errors="ignore").strip()
                    return banner
                except (socket.timeout, BrokenPipeError):
                    pass

    except (socket.timeout, ConnectionRefusedError, OSError):
        pass

    return ""


def identify_service(banner: str) -> tuple[str, str]:
    """Identify service name and version from banner."""
    # SSH
    ssh_match = re.search(r"SSH-[\d.]+-OpenSSH[_\s]([\d.p]+)", banner)
    if ssh_match:
        return "OpenSSH", ssh_match.group(1)

    # Apache
    apache_match = re.search(r"Apache/([\d.]+)", banner)
    if apache_match:
        return "Apache", apache_match.group(1)

    # nginx
    nginx_match = re.search(r"nginx/([\d.]+)", banner)
    if nginx_match:
        return "nginx", nginx_match.group(1)

    # MySQL
    mysql_match = re.search(r"(\d+\.\d+\.\d+).*MySQL", banner, re.IGNORECASE)
    if mysql_match:
        return "MySQL", mysql_match.group(1)

    # ProFTPD
    proftpd_match = re.search(r"ProFTPD\s+([\d.]+)", banner)
    if proftpd_match:
        return "ProFTPD", proftpd_match.group(1)

    # vsftpd
    vsftpd_match = re.search(r"vsftpd\s+([\d.]+)", banner)
    if vsftpd_match:
        return "vsftpd", vsftpd_match.group(1)

    # FTP generic
    if "FTP" in banner.upper():
        return "FTP", ""

    # SMTP
    if "SMTP" in banner.upper() or "ESMTP" in banner.upper():
        exim_match = re.search(r"Exim\s+([\d.]+)", banner)
        if exim_match:
            return "Exim", exim_match.group(1)
        return "SMTP", ""

    # HTTP response
    if banner.startswith("HTTP/"):
        server_match = re.search(r"Server:\s*(.+)", banner, re.IGNORECASE)
        if server_match:
            server_val = server_match.group(1).strip()
            return server_val.split("/")[0], server_val.split("/")[1] if "/" in server_val else ""

    return "unknown", ""


def check_vulnerabilities(
    target: str, port: int, banner: str, service: str, version: str
) -> list[dict[str, Any]]:
    """Check banner against known vulnerable patterns."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"
    matched = False

    for pattern, svc_name, severity, cve_id, description in VULN_PATTERNS:
        if re.search(pattern, banner, re.IGNORECASE):
            findings.append({
                "vulnerability": f"Outdated {svc_name} Version",
                "severity": severity,
                "location": location,
                "evidence": f"{service} {version} detected - {description}".strip(),
                "category": "SERVICE_VERSION",
                "cve_id": cve_id,
                "raw_details": {
                    "port": port,
                    "service": service,
                    "version": version,
                    "banner": banner[:200],
                },
            })
            matched = True
            break

    # If no vulnerability found but banner exists, report as informational
    if not matched and banner and service != "unknown":
        findings.append({
            "vulnerability": "Service Banner Detected",
            "severity": "LOW",
            "location": location,
            "evidence": f"{service} {version} banner detected on port {port}".strip(),
            "category": "SERVICE_VERSION",
            "cve_id": None,
            "raw_details": {
                "port": port,
                "service": service,
                "version": version,
                "banner": banner[:200],
            },
        })

    return findings


def main() -> None:
    parser = argparse.ArgumentParser(description="VaultScan Service Fingerprinting")
    parser.add_argument("--target", required=True, help="Target hostname or IP")
    parser.add_argument(
        "--ports",
        default="22,80,443,3306",
        help="Comma-separated list of ports to fingerprint",
    )
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

        ports = [int(p.strip()) for p in args.ports.split(",") if p.strip()]
        all_findings: list[dict[str, Any]] = []

        for port in ports:
            banner = grab_banner(target, port)
            if banner:
                service, version = identify_service(banner)
                findings = check_vulnerabilities(target, port, banner, service, version)
                all_findings.extend(findings)

        print(json.dumps(all_findings, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
