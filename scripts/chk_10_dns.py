#!/usr/bin/env python3
"""
VaultScan — DNS Misconfiguration Scanner
=========================================
Checks the target domain for common DNS security misconfigurations including
missing or weak SPF, DMARC, and DKIM records, DNSSEC validation, zone
transfer vulnerabilities (AXFR), and nameserver redundancy.

Outputs JSON array of findings to stdout.
"""

import os
import re
import sys
import ipaddress
import socket
from typing import Dict, List, Optional

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

import dns.resolver
import dns.zone
import dns.query
import dns.rdatatype

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "DNS"
DNS_TIMEOUT = 5

# Common DKIM selectors to probe
DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mail", "dkim"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_resolver(timeout: int = DNS_TIMEOUT) -> dns.resolver.Resolver:
    """Create a DNS resolver with a sensible timeout."""
    resolver = dns.resolver.Resolver()
    resolver.timeout = timeout
    resolver.lifetime = timeout
    return resolver


def _resolve_domain_from_target(target: str) -> str:
    """
    Extract a domain suitable for DNS checks.

    If the target is an IP address, attempt a reverse DNS lookup.
    Otherwise extract the domain from the URL via get_base_domain().
    """
    url = normalize_url(target)
    domain = get_base_domain(url)

    # Strip port if present (e.g. "example.com:8080")
    if ":" in domain:
        domain = domain.split(":")[0]

    # Detect bare IP addresses and attempt reverse lookup
    try:
        ipaddress.ip_address(domain)
        # It's a valid IP — try reverse DNS
        try:
            hostnames = socket.gethostbyaddr(domain)
            if hostnames and hostnames[0]:
                domain = hostnames[0].rstrip(".")
        except (socket.herror, socket.gaierror, OSError):
            pass  # Keep the IP; DNS checks will mostly fail gracefully
    except ValueError:
        pass  # Not an IP — already a domain

    return domain


def _query_txt_records(domain: str, resolver: dns.resolver.Resolver) -> List[str]:
    """Return all TXT record strings for *domain*, or an empty list on failure."""
    try:
        answers = resolver.resolve(domain, "TXT")
        records: List[str] = []
        for rdata in answers:
            # TXT records may be split across multiple strings
            txt = b"".join(rdata.strings).decode("utf-8", errors="replace")
            records.append(txt)
        return records
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN,
            dns.resolver.NoNameservers, dns.exception.Timeout,
            Exception):
        return []


# ---------------------------------------------------------------------------
# Check 1 — SPF Record Validation
# ---------------------------------------------------------------------------
def check_spf(domain: str, resolver: dns.resolver.Resolver) -> List[Dict]:
    """Validate the SPF TXT record for *domain*."""
    findings: List[Dict] = []
    txt_records = _query_txt_records(domain, resolver)

    spf_records = [r for r in txt_records if r.lower().startswith("v=spf1")]

    if not spf_records:
        findings.append(make_finding(
            vulnerability="Missing SPF Record",
            severity="HIGH",
            location=domain,
            evidence=(
                f"No SPF (v=spf1) TXT record found for {domain}. "
                "Without SPF, any server can send email on behalf of this domain."
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "txt_records": txt_records[:10],
            },
        ))
        return findings

    for spf in spf_records:
        spf_lower = spf.lower()

        if "+all" in spf_lower:
            findings.append(make_finding(
                vulnerability="SPF Record Too Permissive",
                severity="MEDIUM",
                location=domain,
                evidence=(
                    f"SPF record uses +all which allows any server to send email "
                    f"as {domain}. Record: {spf}"
                ),
                category=CATEGORY,
                raw_details={
                    "domain": domain,
                    "spf_record": spf,
                    "mechanism": "+all",
                },
            ))
        elif "~all" in spf_lower:
            findings.append(make_finding(
                vulnerability="SPF Softfail Policy",
                severity="LOW",
                location=domain,
                evidence=(
                    f"SPF record uses ~all (softfail) which marks unauthorized "
                    f"senders but does not reject them. Record: {spf}"
                ),
                category=CATEGORY,
                raw_details={
                    "domain": domain,
                    "spf_record": spf,
                    "mechanism": "~all",
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 2 — DMARC Record Validation
# ---------------------------------------------------------------------------
def check_dmarc(domain: str, resolver: dns.resolver.Resolver) -> List[Dict]:
    """Validate the DMARC TXT record for *domain*."""
    findings: List[Dict] = []
    dmarc_domain = f"_dmarc.{domain}"
    txt_records = _query_txt_records(dmarc_domain, resolver)

    dmarc_records = [r for r in txt_records if r.lower().startswith("v=dmarc1")]

    if not dmarc_records:
        findings.append(make_finding(
            vulnerability="Missing DMARC Record",
            severity="HIGH",
            location=domain,
            evidence=(
                f"No DMARC TXT record found at {dmarc_domain}. "
                "Without DMARC, email receivers cannot verify the authenticity "
                "of messages from this domain."
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "dmarc_domain": dmarc_domain,
                "txt_records": txt_records[:10],
            },
        ))
        return findings

    for dmarc in dmarc_records:
        dmarc_lower = dmarc.lower()

        # Check policy
        policy_match = re.search(r"p\s*=\s*(\w+)", dmarc_lower)
        if policy_match and policy_match.group(1) == "none":
            findings.append(make_finding(
                vulnerability="DMARC Policy Set to None",
                severity="MEDIUM",
                location=domain,
                evidence=(
                    f"DMARC policy is set to p=none (monitoring only, no enforcement). "
                    f"Spoofed emails will still be delivered. Record: {dmarc}"
                ),
                category=CATEGORY,
                raw_details={
                    "domain": domain,
                    "dmarc_record": dmarc,
                    "policy": "none",
                },
            ))

        # Check for aggregate reporting URI
        if "rua=" not in dmarc_lower:
            findings.append(make_finding(
                vulnerability="DMARC Missing Aggregate Report URI",
                severity="LOW",
                location=domain,
                evidence=(
                    f"DMARC record does not include a rua= tag for aggregate "
                    f"reports. Without reporting, domain owners cannot monitor "
                    f"authentication results. Record: {dmarc}"
                ),
                category=CATEGORY,
                raw_details={
                    "domain": domain,
                    "dmarc_record": dmarc,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# Check 3 — DKIM Selector Probing
# ---------------------------------------------------------------------------
def check_dkim(domain: str, resolver: dns.resolver.Resolver) -> List[Dict]:
    """Probe common DKIM selectors and flag if none are found."""
    findings: List[Dict] = []
    found_selectors: List[str] = []
    found_records: Dict[str, str] = {}

    for selector in DKIM_SELECTORS:
        dkim_domain = f"{selector}._domainkey.{domain}"
        records = _query_txt_records(dkim_domain, resolver)
        if records:
            found_selectors.append(selector)
            found_records[selector] = records[0][:200]

    if not found_selectors:
        findings.append(make_finding(
            vulnerability="No DKIM Record Found",
            severity="MEDIUM",
            location=domain,
            evidence=(
                f"No DKIM TXT records found for common selectors "
                f"({', '.join(DKIM_SELECTORS)}) at {domain}. "
                "DKIM helps verify that email content has not been altered in transit."
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "selectors_checked": DKIM_SELECTORS,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Check 4 — Zone Transfer Attempt (AXFR)
# ---------------------------------------------------------------------------
def check_zone_transfer(domain: str, resolver: dns.resolver.Resolver) -> List[Dict]:
    """Attempt AXFR zone transfers against each authoritative nameserver."""
    findings: List[Dict] = []

    try:
        ns_answers = resolver.resolve(domain, "NS")
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN,
            dns.resolver.NoNameservers, dns.exception.Timeout,
            Exception):
        return findings

    for ns_rdata in ns_answers:
        ns_host = str(ns_rdata.target).rstrip(".")
        try:
            zone = dns.zone.from_xfr(
                dns.query.xfr(ns_host, domain, timeout=DNS_TIMEOUT)
            )
            # If we reach here, the transfer succeeded — critical finding
            record_names = [str(name) for name in zone.nodes.keys()]
            findings.append(make_finding(
                vulnerability="DNS Zone Transfer Allowed (AXFR)",
                severity="CRITICAL",
                location=domain,
                evidence=(
                    f"Nameserver {ns_host} allows full zone transfer (AXFR) "
                    f"for {domain}. {len(record_names)} records exposed. "
                    "An attacker can enumerate all DNS records in the zone."
                ),
                category=CATEGORY,
                raw_details={
                    "domain": domain,
                    "nameserver": ns_host,
                    "records_count": len(record_names),
                    "sample_records": record_names[:20],
                },
            ))
        except Exception:
            # Expected — most nameservers refuse AXFR
            pass

    return findings


# ---------------------------------------------------------------------------
# Check 5 — DNSSEC Validation
# ---------------------------------------------------------------------------
def check_dnssec(domain: str, resolver: dns.resolver.Resolver) -> List[Dict]:
    """Check whether DNSKEY records exist for the domain."""
    findings: List[Dict] = []

    try:
        resolver.resolve(domain, "DNSKEY")
        # DNSKEY exists — DNSSEC appears configured
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN,
            dns.resolver.NoNameservers, dns.exception.Timeout,
            Exception):
        findings.append(make_finding(
            vulnerability="DNSSEC Not Enabled",
            severity="LOW",
            location=domain,
            evidence=(
                f"No DNSKEY records found for {domain}. DNSSEC helps prevent "
                "DNS cache poisoning and man-in-the-middle attacks by "
                "cryptographically signing DNS records."
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Check 6 — Nameserver Redundancy
# ---------------------------------------------------------------------------
def check_nameserver_redundancy(
    domain: str, resolver: dns.resolver.Resolver,
) -> List[Dict]:
    """Ensure the domain has at least two authoritative nameservers."""
    findings: List[Dict] = []

    try:
        ns_answers = resolver.resolve(domain, "NS")
        nameservers = [str(ns.target).rstrip(".") for ns in ns_answers]
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN,
            dns.resolver.NoNameservers, dns.exception.Timeout,
            Exception):
        nameservers = []

    if len(nameservers) == 1:
        findings.append(make_finding(
            vulnerability="Single Nameserver (No Redundancy)",
            severity="MEDIUM",
            location=domain,
            evidence=(
                f"Only one authoritative nameserver found for {domain}: "
                f"{nameservers[0]}. A minimum of two nameservers is recommended "
                "for redundancy and availability."
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "nameservers": nameservers,
                "count": len(nameservers),
            },
        ))
    elif len(nameservers) == 0:
        findings.append(make_finding(
            vulnerability="No Nameservers Found",
            severity="MEDIUM",
            location=domain,
            evidence=(
                f"Could not retrieve NS records for {domain}. The domain may "
                "not exist or the nameserver query failed."
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "nameservers": [],
                "count": 0,
            },
        ))

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    """Return realistic mock findings for development / demo mode."""
    domain = _resolve_domain_from_target(target)
    return [
        make_finding(
            vulnerability="Missing DMARC Record",
            severity="HIGH",
            location=domain,
            evidence=f"No DMARC TXT record found at _dmarc.{domain}",
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "dmarc_domain": f"_dmarc.{domain}",
                "txt_records": [],
            },
        ),
        make_finding(
            vulnerability="SPF Record Too Permissive",
            severity="MEDIUM",
            location=domain,
            evidence=(
                "SPF record uses +all which allows any server to send email"
            ),
            category=CATEGORY,
            raw_details={
                "domain": domain,
                "spf_record": "v=spf1 +all",
                "mechanism": "+all",
            },
        ),
        make_finding(
            vulnerability="DNSSEC Not Enabled",
            severity="LOW",
            location=domain,
            evidence="No DNSKEY records found",
            category=CATEGORY,
            raw_details={
                "domain": domain,
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — DNS Misconfiguration Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    # ---- Mock mode --------------------------------------------------------
    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return  # output_findings calls sys.exit

    # ---- Live scan --------------------------------------------------------
    domain = _resolve_domain_from_target(args.target)
    if not domain:
        output_error("Could not determine a valid domain from the target.")
        return

    resolver = _make_resolver(timeout=DNS_TIMEOUT)
    findings: List[Dict] = []

    # Run all DNS checks
    findings.extend(check_spf(domain, resolver))
    findings.extend(check_dmarc(domain, resolver))
    findings.extend(check_dkim(domain, resolver))
    findings.extend(check_zone_transfer(domain, resolver))
    findings.extend(check_dnssec(domain, resolver))
    findings.extend(check_nameserver_redundancy(domain, resolver))

    output_findings(findings)


if __name__ == "__main__":
    main()
