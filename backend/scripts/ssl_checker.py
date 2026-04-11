#!/usr/bin/env python3
"""
VaultScan — SSL/TLS Certificate Checker
Checks certificate expiry, self-signed status, cipher suites, TLS version,
HSTS headers, key size, and certificate chain validation.
Uses Python built-in modules (ssl, socket) and requests for HTTP checks.
Outputs JSON array of findings to stdout.
"""

import argparse
import datetime
import json
import os
import socket
import ssl
import sys
from typing import Any
from urllib.parse import urlparse

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Import scan_utils helpers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import make_finding


def get_mock_data(target: str) -> list[dict[str, Any]]:
    """Return realistic mock data for development."""
    return [
        {
            "vulnerability": "SSL Certificate Expiring Soon",
            "severity": "MEDIUM",
            "location": f"{target}:443",
            "evidence": "Certificate expires in 45 days (2026-04-27)",
            "category": "SSL_TLS",
            "cve_id": None,
            "raw_details": {
                "days_remaining": 45,
                "expiry_date": "2026-04-27",
                "issuer": "Let's Encrypt",
            },
        },
        {
            "vulnerability": "TLS 1.0 Supported",
            "severity": "HIGH",
            "location": f"{target}:443",
            "evidence": "Server supports TLS 1.0 which is deprecated and insecure",
            "category": "SSL_TLS",
            "cve_id": None,
            "raw_details": {"protocol": "TLSv1", "status": "supported"},
        },
        {
            "vulnerability": "Weak Cipher Suite Detected",
            "severity": "HIGH",
            "location": f"{target}:443",
            "evidence": "Server supports weak cipher: TLS_RSA_WITH_RC4_128_SHA",
            "category": "SSL_TLS",
            "cve_id": None,
            "raw_details": {"cipher": "TLS_RSA_WITH_RC4_128_SHA"},
        },
        {
            "vulnerability": "Weak Cipher Suite Supported: TLS_RSA_WITH_3DES_EDE_CBC_SHA",
            "severity": "MEDIUM",
            "location": f"{target}:443",
            "evidence": "Server supports weak cipher suite: TLS_RSA_WITH_3DES_EDE_CBC_SHA (uses 3DES)",
            "category": "SSL_TLS",
            "cve_id": None,
            "raw_details": {"cipher": "TLS_RSA_WITH_3DES_EDE_CBC_SHA", "weakness": "3DES"},
        },
        {
            "vulnerability": "HSTS Header Missing",
            "severity": "MEDIUM",
            "location": f"{target}:443",
            "evidence": "The server does not set the Strict-Transport-Security header",
            "category": "SSL_TLS",
            "cve_id": None,
            "raw_details": {"header": "Strict-Transport-Security", "status": "missing"},
        },
        {
            "vulnerability": "RSA Key Size Below Recommended (2048 bits)",
            "severity": "HIGH",
            "location": f"{target}:443",
            "evidence": "RSA public key is only 1024 bits, minimum recommended is 2048 bits",
            "category": "SSL_TLS",
            "cve_id": None,
            "raw_details": {"key_type": "RSA", "key_size": 1024, "recommended_minimum": 2048},
        },
    ]


def check_certificate(target: str, port: int = 443) -> list[dict[str, Any]]:
    """Check SSL certificate details."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"

    try:
        context = ssl.create_default_context()
        with socket.create_connection((target, port), timeout=3) as sock:
            with context.wrap_socket(sock, server_hostname=target) as ssock:
                cert = ssock.getpeercert()
                if not cert:
                    findings.append(make_finding(
                        vulnerability="No SSL Certificate Found",
                        severity="CRITICAL",
                        location=location,
                        evidence="Server did not present an SSL certificate",
                        category="SSL_TLS",
                    ))
                    return findings

                # Check expiry
                not_after_str = cert.get("notAfter", "")
                if not_after_str:
                    not_after = datetime.datetime.strptime(
                        not_after_str, "%b %d %H:%M:%S %Y %Z"
                    ).replace(tzinfo=datetime.timezone.utc)
                    now = datetime.datetime.now(datetime.timezone.utc)
                    days_remaining = (not_after - now).days
                    expiry_date = not_after.strftime("%Y-%m-%d")

                    if days_remaining < 0:
                        findings.append(make_finding(
                            vulnerability="SSL Certificate Expired",
                            severity="CRITICAL",
                            location=location,
                            evidence=f"Certificate expired {abs(days_remaining)} days ago ({expiry_date})",
                            category="SSL_TLS",
                            raw_details={
                                "days_remaining": days_remaining,
                                "expiry_date": expiry_date,
                            },
                        ))
                    elif days_remaining <= 30:
                        findings.append(make_finding(
                            vulnerability="SSL Certificate Expiring Soon",
                            severity="HIGH",
                            location=location,
                            evidence=f"Certificate expires in {days_remaining} days ({expiry_date})",
                            category="SSL_TLS",
                            raw_details={
                                "days_remaining": days_remaining,
                                "expiry_date": expiry_date,
                            },
                        ))
                    elif days_remaining <= 90:
                        findings.append(make_finding(
                            vulnerability="SSL Certificate Expiring Soon",
                            severity="MEDIUM",
                            location=location,
                            evidence=f"Certificate expires in {days_remaining} days ({expiry_date})",
                            category="SSL_TLS",
                            raw_details={
                                "days_remaining": days_remaining,
                                "expiry_date": expiry_date,
                            },
                        ))

                # Check hostname match
                try:
                    subject = dict(x[0] for x in cert.get("subject", ()))
                    cn = subject.get("commonName", "")
                    san_list = []
                    for ext_type, ext_val in cert.get("subjectAltName", ()):
                        if ext_type == "DNS":
                            san_list.append(ext_val)
                    # Check if target matches CN or any SAN
                    hostname_match = False
                    for name in [cn] + san_list:
                        if name == target or (name.startswith("*.") and target.endswith(name[1:])):
                            hostname_match = True
                            break
                    if not hostname_match:
                        findings.append(make_finding(
                            vulnerability="SSL Certificate Hostname Mismatch",
                            severity="CRITICAL",
                            location=location,
                            evidence=f"Certificate CN '{cn}' does not match hostname '{target}'",
                            category="SSL_TLS",
                            raw_details={
                                "common_name": cn,
                                "hostname": target,
                                "san": san_list,
                            },
                        ))
                except Exception:
                    pass

                # Check issuer for self-signed
                subject_dict = dict(x[0] for x in cert.get("subject", ()))
                issuer_dict = dict(x[0] for x in cert.get("issuer", ()))
                if subject_dict == issuer_dict:
                    findings.append(make_finding(
                        vulnerability="Self-Signed SSL Certificate",
                        severity="HIGH",
                        location=location,
                        evidence=f"Certificate is self-signed (issuer matches subject: {issuer_dict.get('commonName', 'unknown')})",
                        category="SSL_TLS",
                        raw_details={
                            "subject": subject_dict,
                            "issuer": issuer_dict,
                        },
                    ))

    except ssl.SSLCertVerificationError as e:
        error_msg = str(e)
        if "self-signed" in error_msg.lower() or "self signed" in error_msg.lower():
            findings.append(make_finding(
                vulnerability="Self-Signed SSL Certificate",
                severity="HIGH",
                location=location,
                evidence=f"SSL verification failed: {error_msg}",
                category="SSL_TLS",
                raw_details={"error": error_msg},
            ))
        else:
            findings.append(make_finding(
                vulnerability="SSL Certificate Verification Failed",
                severity="HIGH",
                location=location,
                evidence=f"SSL verification error: {error_msg}",
                category="SSL_TLS",
                raw_details={"error": error_msg},
            ))
    except (socket.timeout, ConnectionRefusedError, OSError) as e:
        findings.append(make_finding(
            vulnerability="SSL Connection Failed",
            severity="HIGH",
            location=location,
            evidence=f"Cannot establish SSL connection: {str(e)}",
            category="SSL_TLS",
            raw_details={"error": str(e)},
        ))

    return findings


def check_tls_versions(target: str, port: int = 443) -> list[dict[str, Any]]:
    """Check for deprecated TLS versions."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"

    deprecated_protocols = [
        (ssl.TLSVersion.TLSv1, "TLS 1.0"),
        (ssl.TLSVersion.TLSv1_1, "TLS 1.1"),
    ]

    for protocol_version, protocol_name in deprecated_protocols:
        try:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ctx.minimum_version = protocol_version
            ctx.maximum_version = protocol_version

            with socket.create_connection((target, port), timeout=3) as sock:
                sock.settimeout(3)
                with ctx.wrap_socket(sock, server_hostname=target) as ssock:
                    actual_version = ssock.version()
                    findings.append(make_finding(
                        vulnerability=f"{protocol_name} Supported",
                        severity="HIGH",
                        location=location,
                        evidence=f"Server supports {protocol_name} which is deprecated and insecure",
                        category="SSL_TLS",
                        raw_details={
                            "protocol": actual_version,
                            "status": "supported",
                        },
                    ))
        except Exception:
            # Protocol not supported or connection failed — this is fine
            pass

    return findings


def check_cipher_suites(target: str, port: int = 443) -> list[dict[str, Any]]:
    """Connect to the server and flag weak cipher suites."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"

    # Weak cipher indicators and their severity
    # NULL and anon ciphers are HIGH severity; others are MEDIUM
    high_severity_keywords = ["NULL", "anon"]
    weak_keywords = ["RC4", "DES", "3DES", "EXPORT", "MD5"]

    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        # Allow all ciphers including weak ones so we can detect them
        ctx.set_ciphers("ALL:COMPLEMENTOFALL:eNULL:aNULL")
    except ssl.SSLError:
        # Fallback if the broad cipher string is rejected
        try:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ctx.set_ciphers("ALL:eNULL:aNULL")
        except ssl.SSLError:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

    try:
        with socket.create_connection((target, port), timeout=3) as sock:
            with ctx.wrap_socket(sock, server_hostname=target) as ssock:
                # Get the negotiated cipher
                cipher_info = ssock.cipher()
                if cipher_info:
                    cipher_name = cipher_info[0]
                    # Check if the negotiated cipher is weak
                    for keyword in high_severity_keywords:
                        if keyword.upper() in cipher_name.upper():
                            findings.append(make_finding(
                                vulnerability=f"Weak Cipher Suite Supported: {cipher_name}",
                                severity="HIGH",
                                location=location,
                                evidence=f"Server negotiated weak cipher suite: {cipher_name} (uses {keyword})",
                                category="SSL_TLS",
                                raw_details={"cipher": cipher_name, "weakness": keyword},
                            ))
                            break
                    else:
                        for keyword in weak_keywords:
                            if keyword.upper() in cipher_name.upper():
                                findings.append(make_finding(
                                    vulnerability=f"Weak Cipher Suite Supported: {cipher_name}",
                                    severity="MEDIUM",
                                    location=location,
                                    evidence=f"Server negotiated weak cipher suite: {cipher_name} (uses {keyword})",
                                    category="SSL_TLS",
                                    raw_details={"cipher": cipher_name, "weakness": keyword},
                                ))
                                break

                # Also enumerate shared ciphers if available
                shared_ciphers = ssock.shared_ciphers()
                if shared_ciphers:
                    seen = set()
                    for cipher_tuple in shared_ciphers:
                        c_name = cipher_tuple[0]
                        if c_name in seen:
                            continue
                        seen.add(c_name)
                        # Skip the already-reported negotiated cipher
                        if cipher_info and c_name == cipher_info[0]:
                            continue
                        for keyword in high_severity_keywords:
                            if keyword.upper() in c_name.upper():
                                findings.append(make_finding(
                                    vulnerability=f"Weak Cipher Suite Supported: {c_name}",
                                    severity="HIGH",
                                    location=location,
                                    evidence=f"Server supports weak cipher suite: {c_name} (uses {keyword})",
                                    category="SSL_TLS",
                                    raw_details={"cipher": c_name, "weakness": keyword},
                                ))
                                break
                        else:
                            for keyword in weak_keywords:
                                if keyword.upper() in c_name.upper():
                                    findings.append(make_finding(
                                        vulnerability=f"Weak Cipher Suite Supported: {c_name}",
                                        severity="MEDIUM",
                                        location=location,
                                        evidence=f"Server supports weak cipher suite: {c_name} (uses {keyword})",
                                        category="SSL_TLS",
                                        raw_details={"cipher": c_name, "weakness": keyword},
                                    ))
                                    break

    except (ssl.SSLError, socket.error, OSError):
        # Connection failed; cipher check not possible
        pass

    return findings


def check_hsts(target: str, port: int = 443) -> list[dict[str, Any]]:
    """Check for Strict-Transport-Security (HSTS) header."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"
    url = f"https://{target}:{port}" if port != 443 else f"https://{target}"

    try:
        resp = requests.get(url, timeout=3, verify=False, allow_redirects=True)
        hsts = resp.headers.get("Strict-Transport-Security")

        if not hsts:
            findings.append(make_finding(
                vulnerability="HSTS Header Missing",
                severity="MEDIUM",
                location=location,
                evidence="The server does not set the Strict-Transport-Security header",
                category="SSL_TLS",
                raw_details={"header": "Strict-Transport-Security", "status": "missing"},
            ))
        else:
            # Check for includeSubDomains
            if "includesubdomains" not in hsts.lower():
                findings.append(make_finding(
                    vulnerability="HSTS Missing includeSubDomains Directive",
                    severity="LOW",
                    location=location,
                    evidence=f"HSTS header is set but missing includeSubDomains directive: {hsts}",
                    category="SSL_TLS",
                    raw_details={"header_value": hsts, "missing": "includeSubDomains"},
                ))

            # Check max-age value
            import re
            max_age_match = re.search(r'max-age\s*=\s*(\d+)', hsts, re.IGNORECASE)
            if max_age_match:
                max_age = int(max_age_match.group(1))
                one_year = 31536000
                if max_age < one_year:
                    findings.append(make_finding(
                        vulnerability="HSTS max-age Below Recommended Value",
                        severity="LOW",
                        location=location,
                        evidence=f"HSTS max-age is {max_age} seconds ({max_age // 86400} days), recommended minimum is {one_year} seconds (365 days)",
                        category="SSL_TLS",
                        raw_details={
                            "max_age": max_age,
                            "recommended_minimum": one_year,
                        },
                    ))
            else:
                findings.append(make_finding(
                    vulnerability="HSTS max-age Not Specified",
                    severity="LOW",
                    location=location,
                    evidence=f"HSTS header is set but max-age directive is missing or invalid: {hsts}",
                    category="SSL_TLS",
                    raw_details={"header_value": hsts, "missing": "max-age"},
                ))

    except requests.exceptions.RequestException:
        # Cannot reach the server via HTTPS for HSTS check
        pass

    return findings


def check_key_size(target: str, port: int = 443) -> list[dict[str, Any]]:
    """Check the public key size of the server certificate."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"

    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        with socket.create_connection((target, port), timeout=3) as sock:
            with ctx.wrap_socket(sock, server_hostname=target) as ssock:
                cert_bin = ssock.getpeercert(binary_form=True)
                if not cert_bin:
                    return findings

                # Use ssl to get certificate info via the DER-encoded cert
                # We need to parse the public key information
                try:
                    from cryptography import x509
                    from cryptography.hazmat.primitives.asymmetric import rsa, ec, dsa

                    cert_obj = x509.load_der_x509_certificate(cert_bin)
                    pub_key = cert_obj.public_key()
                    key_size = pub_key.key_size

                    if isinstance(pub_key, rsa.RSAPublicKey):
                        if key_size < 2048:
                            findings.append(make_finding(
                                vulnerability=f"RSA Key Size Below Recommended ({key_size} bits)",
                                severity="HIGH",
                                location=location,
                                evidence=f"RSA public key is only {key_size} bits, minimum recommended is 2048 bits",
                                category="SSL_TLS",
                                raw_details={
                                    "key_type": "RSA",
                                    "key_size": key_size,
                                    "recommended_minimum": 2048,
                                },
                            ))
                        elif key_size < 4096:
                            findings.append(make_finding(
                                vulnerability=f"RSA Key Size Below 4096 bits ({key_size} bits)",
                                severity="LOW",
                                location=location,
                                evidence=f"RSA public key is {key_size} bits; 4096 bits is recommended for stronger security",
                                category="SSL_TLS",
                                raw_details={
                                    "key_type": "RSA",
                                    "key_size": key_size,
                                    "recommended": 4096,
                                },
                            ))

                    elif isinstance(pub_key, ec.EllipticCurvePublicKey):
                        if key_size < 256:
                            findings.append(make_finding(
                                vulnerability=f"EC Key Size Below Recommended ({key_size} bits)",
                                severity="MEDIUM",
                                location=location,
                                evidence=f"EC public key is only {key_size} bits, minimum recommended is 256 bits",
                                category="SSL_TLS",
                                raw_details={
                                    "key_type": "EC",
                                    "key_size": key_size,
                                    "recommended_minimum": 256,
                                },
                            ))

                    elif isinstance(pub_key, dsa.DSAPublicKey):
                        if key_size < 2048:
                            findings.append(make_finding(
                                vulnerability=f"DSA Key Size Below Recommended ({key_size} bits)",
                                severity="HIGH",
                                location=location,
                                evidence=f"DSA public key is only {key_size} bits, minimum recommended is 2048 bits",
                                category="SSL_TLS",
                                raw_details={
                                    "key_type": "DSA",
                                    "key_size": key_size,
                                    "recommended_minimum": 2048,
                                },
                            ))

                except ImportError:
                    # cryptography library not available; fall back to ssl module info
                    # The ssl module doesn't expose key size directly from binary cert,
                    # so we attempt to get it from the peercert dict
                    pass

    except (ssl.SSLError, socket.error, OSError):
        pass

    return findings


def check_certificate_chain(target: str, port: int = 443) -> list[dict[str, Any]]:
    """Check certificate chain completeness and CRL distribution point."""
    findings: list[dict[str, Any]] = []
    location = f"{target}:{port}"

    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        with socket.create_connection((target, port), timeout=3) as sock:
            with ctx.wrap_socket(sock, server_hostname=target) as ssock:
                cert_bin = ssock.getpeercert(binary_form=True)
                cert_dict = ssock.getpeercert()

                if not cert_bin or not cert_dict:
                    return findings

                # Self-signed check is already in check_certificate(), so skip here
                # to avoid duplicates.

                # Check certificate chain completeness via verified chain
                try:
                    chain = ssock.get_verified_chain()
                    if chain is not None and len(chain) <= 1:
                        # Only one cert in chain means no intermediates
                        # (but only flag if it's not self-signed, which is already reported)
                        subject_dict = dict(x[0] for x in cert_dict.get("subject", ()))
                        issuer_dict = dict(x[0] for x in cert_dict.get("issuer", ()))
                        if subject_dict != issuer_dict:
                            findings.append(make_finding(
                                vulnerability="Incomplete Certificate Chain",
                                severity="MEDIUM",
                                location=location,
                                evidence="Server does not send intermediate certificates; clients may fail to validate the chain",
                                category="SSL_TLS",
                                raw_details={"chain_length": len(chain)},
                            ))
                except AttributeError:
                    # get_verified_chain() not available in older Python versions
                    pass

                # Check for CRL Distribution Point
                try:
                    from cryptography import x509 as cx509
                    from cryptography.x509.oid import ExtensionOID

                    cert_obj = cx509.load_der_x509_certificate(cert_bin)

                    has_crl = False
                    try:
                        crl_ext = cert_obj.extensions.get_extension_for_oid(
                            ExtensionOID.CRL_DISTRIBUTION_POINTS
                        )
                        if crl_ext:
                            has_crl = True
                    except cx509.ExtensionNotFound:
                        pass

                    if not has_crl:
                        # Also check if there's an OCSP responder as alternative
                        has_ocsp = False
                        try:
                            aia_ext = cert_obj.extensions.get_extension_for_oid(
                                ExtensionOID.AUTHORITY_INFORMATION_ACCESS
                            )
                            if aia_ext:
                                has_ocsp = True
                        except cx509.ExtensionNotFound:
                            pass

                        if not has_ocsp:
                            findings.append(make_finding(
                                vulnerability="No Certificate Revocation Check Available",
                                severity="LOW",
                                location=location,
                                evidence="Certificate has no CRL Distribution Point or OCSP responder URI",
                                category="SSL_TLS",
                                raw_details={
                                    "crl_distribution_points": False,
                                    "ocsp_responder": False,
                                },
                            ))

                except ImportError:
                    # cryptography library not available
                    pass

    except (ssl.SSLError, socket.error, OSError):
        pass

    return findings


def main() -> None:
    parser = argparse.ArgumentParser(description="VaultScan SSL/TLS Checker")
    parser.add_argument("--target", required=True, help="Target hostname")
    parser.add_argument("--port", type=int, default=443, help="Port (default: 443)")
    args = parser.parse_args()

    # Extract hostname from URL if needed
    target = args.target
    if target.startswith(("http://", "https://")):
        parsed = urlparse(target)
        target = parsed.hostname or target
        if parsed.port:
            args.port = parsed.port

    # Mock mode
    if os.environ.get("SCAN_MOCK_MODE", "").lower() == "true":
        print(json.dumps(get_mock_data(target), indent=2))
        return

    try:
        # Resolve hostname first
        try:
            socket.gethostbyname(target)
        except socket.gaierror:
            print(json.dumps({"error": f"Cannot resolve hostname: {target}"}))
            sys.exit(1)

        all_findings: list[dict[str, Any]] = []
        all_findings.extend(check_certificate(target, args.port))
        all_findings.extend(check_tls_versions(target, args.port))
        all_findings.extend(check_cipher_suites(target, args.port))
        all_findings.extend(check_hsts(target, args.port))
        all_findings.extend(check_key_size(target, args.port))
        all_findings.extend(check_certificate_chain(target, args.port))

        print(json.dumps(all_findings, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
