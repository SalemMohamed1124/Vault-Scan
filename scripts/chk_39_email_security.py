#!/usr/bin/env python3
"""
VaultScan -- Email Security Scanner
=====================================
Deep email security checks beyond basic DNS:
- SPF record analysis with includes/redirects
- DMARC policy enforcement validation
- DKIM selector brute-force
- Email spoofing risk assessment
- MX record security analysis
- STARTTLS enforcement on mail servers
"""

import os
import sys
import re
import socket
import ssl
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    make_finding,
)

try:
    import dns.resolver
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False


def get_domain(target: str) -> str:
    """Extract domain from URL or use as-is."""
    target = target.replace("https://", "").replace("http://", "")
    return target.split("/")[0].split(":")[0]


def resolve_txt(domain: str) -> List[str]:
    """Resolve TXT records for a domain."""
    if not HAS_DNSPYTHON:
        return []
    try:
        answers = dns.resolver.resolve(domain, "TXT")
        return [str(r).strip('"') for r in answers]
    except Exception:
        return []


def resolve_mx(domain: str) -> List[str]:
    """Resolve MX records for a domain."""
    if not HAS_DNSPYTHON:
        return []
    try:
        answers = dns.resolver.resolve(domain, "MX")
        return [str(r.exchange).rstrip(".") for r in sorted(answers, key=lambda x: x.preference)]
    except Exception:
        return []


def check_spf_deep(domain: str) -> List[Dict]:
    """Deep SPF analysis."""
    findings = []
    txt_records = resolve_txt(domain)
    spf_records = [r for r in txt_records if r.startswith("v=spf1")]

    if not spf_records:
        findings.append(make_finding(
            vulnerability="Missing SPF Record",
            severity="HIGH",
            location=domain,
            evidence=f"No SPF record found for {domain}. Anyone can send emails pretending to be from this domain.",
            category="EMAIL_SECURITY",
        ))
        return findings

    if len(spf_records) > 1:
        findings.append(make_finding(
            vulnerability="Multiple SPF Records",
            severity="MEDIUM",
            location=domain,
            evidence=f"Multiple SPF records found ({len(spf_records)}). RFC 7208 requires exactly one SPF record.",
            category="EMAIL_SECURITY",
        ))

    spf = spf_records[0]

    # Check for +all (accept all)
    if "+all" in spf:
        findings.append(make_finding(
            vulnerability="SPF Permits All Senders (+all)",
            severity="CRITICAL",
            location=domain,
            evidence=f"SPF record uses '+all' which allows ANY server to send email as {domain}. Record: {spf}",
            category="EMAIL_SECURITY",
        ))
    elif "~all" in spf:
        findings.append(make_finding(
            vulnerability="SPF Soft Fail (~all)",
            severity="MEDIUM",
            location=domain,
            evidence=f"SPF record uses '~all' (soft fail) instead of '-all' (hard fail). Spoofed emails may still be delivered. Record: {spf}",
            category="EMAIL_SECURITY",
        ))
    elif "?all" in spf:
        findings.append(make_finding(
            vulnerability="SPF Neutral Policy (?all)",
            severity="MEDIUM",
            location=domain,
            evidence=f"SPF record uses '?all' (neutral). This provides no protection against spoofing. Record: {spf}",
            category="EMAIL_SECURITY",
        ))

    # Count DNS lookups (max 10 per RFC)
    lookup_mechanisms = re.findall(r'\b(include:|a:|mx:|ptr:|redirect=)', spf)
    if len(lookup_mechanisms) > 8:
        findings.append(make_finding(
            vulnerability="SPF Too Many DNS Lookups",
            severity="MEDIUM",
            location=domain,
            evidence=f"SPF record has {len(lookup_mechanisms)} DNS lookup mechanisms. RFC 7208 limits to 10 total. Record may fail validation.",
            category="EMAIL_SECURITY",
        ))

    return findings


def check_dmarc_deep(domain: str) -> List[Dict]:
    """Deep DMARC analysis."""
    findings = []
    dmarc_domain = f"_dmarc.{domain}"
    txt_records = resolve_txt(dmarc_domain)
    dmarc_records = [r for r in txt_records if r.startswith("v=DMARC1")]

    if not dmarc_records:
        findings.append(make_finding(
            vulnerability="Missing DMARC Record",
            severity="HIGH",
            location=domain,
            evidence=f"No DMARC record at {dmarc_domain}. Without DMARC, email receivers cannot verify sender authenticity.",
            category="EMAIL_SECURITY",
        ))
        return findings

    dmarc = dmarc_records[0]

    # Check policy
    policy_match = re.search(r'p=(\w+)', dmarc)
    if policy_match:
        policy = policy_match.group(1).lower()
        if policy == "none":
            findings.append(make_finding(
                vulnerability="DMARC Policy Set to None",
                severity="MEDIUM",
                location=domain,
                evidence=f"DMARC policy is 'none' (monitoring only). Spoofed emails are still delivered. Record: {dmarc}",
                category="EMAIL_SECURITY",
            ))

    # Check subdomain policy
    sp_match = re.search(r'sp=(\w+)', dmarc)
    if not sp_match:
        findings.append(make_finding(
            vulnerability="DMARC Missing Subdomain Policy",
            severity="LOW",
            location=domain,
            evidence=f"No subdomain policy (sp=) in DMARC. Subdomains inherit the main policy which may not be appropriate.",
            category="EMAIL_SECURITY",
        ))

    # Check reporting
    if "rua=" not in dmarc:
        findings.append(make_finding(
            vulnerability="DMARC Missing Aggregate Reports",
            severity="LOW",
            location=domain,
            evidence=f"No aggregate reporting URI (rua=) in DMARC record. You won't receive reports about email authentication failures.",
            category="EMAIL_SECURITY",
        ))

    # Check percentage
    pct_match = re.search(r'pct=(\d+)', dmarc)
    if pct_match and int(pct_match.group(1)) < 100:
        findings.append(make_finding(
            vulnerability="DMARC Partial Enforcement",
            severity="MEDIUM",
            location=domain,
            evidence=f"DMARC pct={pct_match.group(1)}% - only a portion of emails are subject to DMARC policy. Set to 100 for full protection.",
            category="EMAIL_SECURITY",
        ))

    return findings


def check_dkim_selectors(domain: str) -> List[Dict]:
    """Brute-force common DKIM selectors."""
    findings = []
    selectors = [
        "default", "google", "selector1", "selector2", "k1", "k2",
        "mail", "dkim", "s1", "s2", "smtp", "email", "mandrill",
        "mailgun", "sendgrid", "amazonses", "ses", "zoho", "cm",
        "protonmail", "mimecast", "postmark", "sparkpost",
    ]

    found_selectors = []
    for selector in selectors:
        dkim_domain = f"{selector}._domainkey.{domain}"
        records = resolve_txt(dkim_domain)
        if records:
            found_selectors.append((selector, records[0][:100]))

    if not found_selectors:
        findings.append(make_finding(
            vulnerability="No DKIM Records Found",
            severity="MEDIUM",
            location=domain,
            evidence=f"No DKIM records found for {len(selectors)} common selectors. DKIM adds cryptographic authentication to emails.",
            category="EMAIL_SECURITY",
        ))
    else:
        # Check key strength
        for selector, record in found_selectors:
            if "p=" in record:
                key_match = re.search(r'p=([A-Za-z0-9+/=]+)', record)
                if key_match:
                    key_b64 = key_match.group(1)
                    key_bits = len(key_b64) * 6  # Approximate
                    if key_bits < 1024:
                        findings.append(make_finding(
                            vulnerability=f"Weak DKIM Key ({selector})",
                            severity="MEDIUM",
                            location=domain,
                            evidence=f"DKIM selector '{selector}' has a short key (~{key_bits} bits). Minimum 1024 bits recommended, 2048 preferred.",
                            category="EMAIL_SECURITY",
                        ))

    return findings


def check_mx_security(domain: str) -> List[Dict]:
    """Check MX record security."""
    findings = []
    mx_records = resolve_mx(domain)

    if not mx_records:
        return findings

    # Check STARTTLS on mail servers
    for mx in mx_records[:3]:
        try:
            sock = socket.create_connection((mx, 25), timeout=5)
            banner = sock.recv(1024).decode(errors="ignore")

            sock.sendall(b"EHLO vaultscan.test\r\n")
            ehlo_resp = sock.recv(4096).decode(errors="ignore")

            if "STARTTLS" not in ehlo_resp.upper():
                findings.append(make_finding(
                    vulnerability=f"Mail Server Missing STARTTLS: {mx}",
                    severity="HIGH",
                    location=domain,
                    evidence=f"MX server {mx} does not advertise STARTTLS. Email sent to this server may be transmitted in plaintext.",
                    category="EMAIL_SECURITY",
                    raw_details={"mx": mx, "banner": banner[:200]},
                ))

            # Check for open relay
            sock.sendall(f"MAIL FROM:<test@vaultscan.com>\r\n".encode())
            mail_resp = sock.recv(1024).decode(errors="ignore")

            if "250" in mail_resp:
                sock.sendall(f"RCPT TO:<test@example.com>\r\n".encode())
                rcpt_resp = sock.recv(1024).decode(errors="ignore")

                if "250" in rcpt_resp:
                    findings.append(make_finding(
                        vulnerability=f"Potential Open Mail Relay: {mx}",
                        severity="HIGH",
                        location=domain,
                        evidence=f"MX server {mx} accepted RCPT TO for external domain. This may indicate an open relay allowing spam/phishing.",
                        category="EMAIL_SECURITY",
                        raw_details={"mx": mx},
                    ))

            sock.sendall(b"QUIT\r\n")
            sock.close()
        except Exception:
            continue

    return findings


def get_mock_findings(target: str) -> List[Dict]:
    domain = get_domain(target)
    return [
        make_finding(
            vulnerability="DMARC Policy Set to None",
            severity="MEDIUM",
            location=domain,
            evidence="DMARC policy is 'none' (monitoring only). Spoofed emails are still delivered.",
            category="EMAIL_SECURITY",
        ),
        make_finding(
            vulnerability="SPF Soft Fail (~all)",
            severity="MEDIUM",
            location=domain,
            evidence="SPF record uses '~all' instead of '-all'. Spoofed emails may still be delivered.",
            category="EMAIL_SECURITY",
        ),
    ]


def main():
    parser = base_argparser("VaultScan Email Security Scanner")
    args = parser.parse_args()
    target = normalize_url(args.target)

    if not target:
        from scan_utils import output_error
        output_error("No target specified.")

    if is_mock_mode():
        output_findings(get_mock_findings(target))

    domain = get_domain(target)
    findings: List[Dict] = []

    findings.extend(check_spf_deep(domain))
    findings.extend(check_dmarc_deep(domain))
    findings.extend(check_dkim_selectors(domain))
    findings.extend(check_mx_security(domain))

    output_findings(findings)


if __name__ == "__main__":
    main()
