#!/usr/bin/env python3
"""
VaultScan — Subdomain Takeover Scanner (Production)
=====================================================
Detects subdomain takeover vulnerabilities by:

1. Resolving CNAME records for the target domain and known subdomains
2. Checking if CNAME targets are dangling (NXDOMAIN)
3. Fetching HTTP responses and matching against known service fingerprints
4. Detecting unclaimed resources on cloud/SaaS providers

Supported providers:
  GitHub Pages, Heroku, AWS S3, Shopify, Tumblr, WordPress.com,
  Ghost, Surge.sh, Fastly, Pantheon, Netlify, Fly.io, Azure,
  Google Cloud, Zendesk, Freshdesk, Unbounce

Outputs JSON array of findings to stdout.
"""

import os
import re
import socket
import sys
import time
import concurrent.futures
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan_utils import (
    base_argparser,
    is_mock_mode,
    output_findings,
    normalize_url,
    create_session,
    safe_request,
    make_finding,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "SUBDOMAIN_TAKEOVER"
DNS_TIMEOUT = 4
HTTP_CHECK_TIMEOUT = 8
MAX_CONCURRENT = 20

# CNAME patterns mapping to cloud/SaaS providers
CNAME_PROVIDER_MAP: List[Tuple[str, str]] = [
    (".github.io", "GitHub Pages"),
    (".githubusercontent.com", "GitHub Pages"),
    (".herokuapp.com", "Heroku"),
    (".herokudns.com", "Heroku"),
    (".s3.amazonaws.com", "AWS S3"),
    (".s3-website", "AWS S3"),
    (".s3-us", "AWS S3"),
    (".s3-eu", "AWS S3"),
    (".s3-ap", "AWS S3"),
    (".myshopify.com", "Shopify"),
    (".tumblr.com", "Tumblr"),
    (".wordpress.com", "WordPress.com"),
    (".ghost.io", "Ghost"),
    (".surge.sh", "Surge.sh"),
    (".fastly.net", "Fastly"),
    (".fastlylb.net", "Fastly"),
    (".pantheonsite.io", "Pantheon"),
    (".pantheon.io", "Pantheon"),
    (".netlify.app", "Netlify"),
    (".netlify.com", "Netlify"),
    (".fly.dev", "Fly.io"),
    (".edgeapp.net", "Fly.io"),
    (".azurewebsites.net", "Azure"),
    (".cloudapp.net", "Azure"),
    (".cloudapp.azure.com", "Azure"),
    (".azure-api.net", "Azure"),
    (".azureedge.net", "Azure"),
    (".azurefd.net", "Azure"),
    (".trafficmanager.net", "Azure"),
    (".blob.core.windows.net", "Azure"),
    (".appspot.com", "Google Cloud"),
    (".cloudfunctions.net", "Google Cloud"),
    (".run.app", "Google Cloud"),
    (".zendesk.com", "Zendesk"),
    (".freshdesk.com", "Freshdesk"),
    (".unbouncepages.com", "Unbounce"),
]

# HTTP response fingerprints for unclaimed service detection
SERVICE_FINGERPRINTS: Dict[str, List[str]] = {
    "GitHub Pages": [
        "There isn't a GitHub Pages site here",
        "For root URLs (like http://example.com/) you must provide an index.html file",
    ],
    "Heroku": [
        "No such app",
        "no-such-app",
        "herokucdn.com/error-pages",
    ],
    "AWS S3": [
        "NoSuchBucket",
        "The specified bucket does not exist",
    ],
    "Shopify": [
        "Sorry, this shop is currently unavailable",
        "Only one step left",
    ],
    "Tumblr": [
        "There's nothing here",
        "Whatever you were looking for doesn't currently exist",
    ],
    "WordPress.com": [
        "Do you want to register",
        "doesn't exist",
    ],
    "Ghost": [
        "The thing you were looking for is no longer here",
        "This Ghost site doesn't seem to exist",
    ],
    "Surge.sh": [
        "project not found",
    ],
    "Fastly": [
        "Fastly error: unknown domain",
    ],
    "Pantheon": [
        "The gods are wise",
        "404 error unknown site",
    ],
    "Netlify": [
        "Not found - Request ID",
        "Not Found - Request ID",
    ],
    "Fly.io": [
        "404 Not Found",
    ],
    "Azure": [
        "404 Web Site not found",
        "The web app you have attempted",
        "Error 404 - Web app not found",
    ],
    "Google Cloud": [
        "The requested URL was not found on this server",
        "Error: Server Error",
    ],
    "Zendesk": [
        "Help Center Closed",
    ],
    "Freshdesk": [
        "is not a valid",
        "There is no helpdesk here",
        "May be this is still not configured",
    ],
    "Unbounce": [
        "The requested URL was not found on this server",
        "The requested URL / was not found",
    ],
}

# Common subdomain prefixes to probe
SUBDOMAIN_PREFIXES: List[str] = [
    "www", "mail", "email", "webmail", "ftp", "sftp",
    "api", "api2", "api-v2", "api-staging", "api-dev",
    "dev", "dev1", "dev2", "develop", "development",
    "staging", "stage", "stg", "preprod", "pre-prod",
    "admin", "panel", "cp", "dashboard",
    "app", "app2", "apps", "mobile",
    "cdn", "cdn1", "cdn2", "static", "assets", "media", "img", "images",
    "blog", "news", "press", "kb", "docs", "doc", "wiki",
    "shop", "store", "ecommerce",
    "support", "help", "helpdesk", "status",
    "portal", "gateway", "proxy", "lb",
    "auth", "sso", "login", "id", "identity",
    "git", "gitlab", "ci", "cd", "jenkins", "build",
    "monitor", "grafana", "prometheus", "metrics", "sentry",
    "demo", "test", "test1", "test2", "qa", "uat", "sandbox",
    "old", "new", "legacy", "v1", "v2", "web", "web2",
    "backup", "bak", "temp", "archive",
    "chat", "forum", "community",
    "analytics", "track", "tracking",
    "marketing", "promo", "campaign", "landing",
    "vpn", "remote", "intranet", "internal",
    "ns1", "ns2", "dns", "mx", "smtp",
    "db", "database", "redis", "mongo",
    "search", "elastic", "solr",
    "video", "stream", "live",
    "files", "upload", "download",
    "go", "link", "links", "redirect",
]

_IP_RE = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")


# ---------------------------------------------------------------------------
# DNS Helpers
# ---------------------------------------------------------------------------
def _is_ip_address(host: str) -> bool:
    """Check if host is an IP address."""
    if _IP_RE.match(host):
        return True
    if host.startswith("[") or host.count(":") > 1:
        return True
    return False


def _strip_port(netloc: str) -> str:
    """Remove port from netloc."""
    if netloc.startswith("["):
        bracket_end = netloc.find("]")
        if bracket_end != -1:
            return netloc[1:bracket_end]
        return netloc
    if ":" in netloc:
        return netloc.rsplit(":", 1)[0]
    return netloc


def _get_cname(fqdn: str) -> Optional[str]:
    """Resolve CNAME record for a given FQDN using dns.resolver or socket."""
    # Try dnspython first
    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT
        resolver.timeout = DNS_TIMEOUT
        answers = resolver.resolve(fqdn, "CNAME")
        for rdata in answers:
            return str(rdata.target).rstrip(".")
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback: use socket getfqdn heuristic (limited but works sometimes)
    try:
        result = socket.getfqdn(fqdn)
        if result and result != fqdn and "." in result:
            # Verify it looks like a CNAME (different domain)
            fqdn_parts = fqdn.split(".")
            result_parts = result.split(".")
            if len(result_parts) >= 2 and result_parts[-2:] != fqdn_parts[-2:]:
                return result
    except Exception:
        pass

    return None


def _resolve_host(fqdn: str) -> Optional[str]:
    """Resolve a hostname to an IP address."""
    old_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(DNS_TIMEOUT)
        results = socket.getaddrinfo(fqdn, None)
        if results:
            return results[0][4][0]
    except (socket.gaierror, socket.timeout, OSError):
        pass
    finally:
        socket.setdefaulttimeout(old_timeout)
    return None


def _is_nxdomain(fqdn: str) -> bool:
    """Check if a hostname results in NXDOMAIN (does not exist)."""
    # Try dnspython for accurate NXDOMAIN detection
    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT
        resolver.timeout = DNS_TIMEOUT
        resolver.resolve(fqdn, "A")
        return False
    except ImportError:
        pass
    except dns.resolver.NXDOMAIN:
        return True
    except dns.resolver.NoAnswer:
        return False
    except dns.resolver.NoNameservers:
        return True
    except Exception:
        pass

    # Fallback: use socket
    try:
        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(DNS_TIMEOUT)
        try:
            socket.getaddrinfo(fqdn, None)
            return False
        except socket.gaierror as e:
            # errno 8 = nodename nor servname provided, or not known
            # errno 11001 = getaddrinfo failed (Windows NXDOMAIN)
            if e.errno in (socket.EAI_NONAME, 8, 11001, -2, -5):
                return True
            return False
        finally:
            socket.setdefaulttimeout(old_timeout)
    except Exception:
        return False


def _identify_provider(cname: str) -> Optional[str]:
    """Identify the cloud/SaaS provider from a CNAME target."""
    cname_lower = cname.lower()
    for pattern, provider in CNAME_PROVIDER_MAP:
        if cname_lower.endswith(pattern) or pattern in cname_lower:
            return provider
    return None


# ---------------------------------------------------------------------------
# HTTP Fingerprint Checking
# ---------------------------------------------------------------------------
def _check_http_fingerprint(
    session, fqdn: str, provider: Optional[str] = None
) -> Optional[Dict]:
    """
    Fetch the subdomain over HTTP/HTTPS and check for takeover fingerprints.
    Returns dict with match details or None.
    """
    for scheme in ["https", "http"]:
        url = f"{scheme}://{fqdn}"
        resp, err = safe_request(session, "GET", url, timeout=HTTP_CHECK_TIMEOUT)
        if resp is None:
            continue

        body = resp.text[:10000] if resp.text else ""
        headers_str = str(resp.headers)

        # Special case: Fly.io needs header check
        if provider == "Fly.io" or (not provider):
            if "fly-request-id" in headers_str.lower() or "fly.io" in headers_str.lower():
                if "404" in body[:200] or resp.status_code == 404:
                    return {
                        "provider": "Fly.io",
                        "signature": "404 Not Found with Fly headers",
                        "status_code": resp.status_code,
                        "url": url,
                    }

        # Check fingerprints for specific provider first, then all
        providers_to_check = []
        if provider:
            providers_to_check.append(provider)
        # Also check all providers in case CNAME identification was imprecise
        providers_to_check.extend(
            p for p in SERVICE_FINGERPRINTS if p not in providers_to_check
        )

        for check_provider in providers_to_check:
            signatures = SERVICE_FINGERPRINTS.get(check_provider, [])
            for sig in signatures:
                if sig.lower() in body.lower():
                    return {
                        "provider": check_provider,
                        "signature": sig,
                        "status_code": resp.status_code,
                        "url": url,
                    }

    return None


# ---------------------------------------------------------------------------
# Single Subdomain Check
# ---------------------------------------------------------------------------
def _check_subdomain(
    session, fqdn: str
) -> Optional[Dict]:
    """
    Check a single subdomain for takeover vulnerability.
    Returns a finding dict or None.
    """
    cname = _get_cname(fqdn)
    if not cname:
        return None

    provider = _identify_provider(cname)

    # Check 1: Is the CNAME target an NXDOMAIN? (dangling CNAME)
    cname_is_nxdomain = _is_nxdomain(cname)

    # Check 2: HTTP fingerprint on the subdomain itself
    http_match = _check_http_fingerprint(session, fqdn, provider)

    if cname_is_nxdomain and provider:
        # Dangling CNAME pointing to a known provider — high confidence
        evidence = (
            f"CNAME for {fqdn} points to {cname} ({provider}), "
            f"but the CNAME target does not resolve (NXDOMAIN). "
            f"This is a strong indicator of subdomain takeover."
        )
        if http_match:
            evidence += f" HTTP fingerprint confirmed: '{http_match['signature']}'"

        return {
            "vulnerability": f"Subdomain Takeover — {fqdn} ({provider})",
            "severity": "HIGH",
            "location": fqdn,
            "evidence": evidence,
            "confidence": "HIGH",
            "raw_details": {
                "subdomain": fqdn,
                "cname": cname,
                "provider": provider,
                "cname_nxdomain": True,
                "http_match": http_match,
            },
        }

    if cname_is_nxdomain and not provider:
        # Dangling CNAME to unknown provider — still suspicious
        return {
            "vulnerability": f"Dangling CNAME — {fqdn}",
            "severity": "MEDIUM",
            "location": fqdn,
            "evidence": (
                f"CNAME for {fqdn} points to {cname}, "
                f"but the target does not resolve (NXDOMAIN). "
                f"This may indicate an abandoned service or potential takeover."
            ),
            "confidence": "MEDIUM",
            "raw_details": {
                "subdomain": fqdn,
                "cname": cname,
                "provider": "Unknown",
                "cname_nxdomain": True,
            },
        }

    if http_match and provider:
        # CNAME resolves but HTTP fingerprint shows unclaimed service
        return {
            "vulnerability": f"Subdomain Takeover — {fqdn} ({http_match['provider']})",
            "severity": "HIGH",
            "location": fqdn,
            "evidence": (
                f"CNAME for {fqdn} points to {cname} ({http_match['provider']}). "
                f"The service responded with takeover indicator: "
                f"'{http_match['signature']}' (HTTP {http_match['status_code']})."
            ),
            "confidence": "HIGH",
            "raw_details": {
                "subdomain": fqdn,
                "cname": cname,
                "provider": http_match["provider"],
                "cname_nxdomain": False,
                "http_signature": http_match["signature"],
                "http_status": http_match["status_code"],
            },
        }

    if http_match and not provider:
        # No known CNAME provider but HTTP fingerprint matched
        return {
            "vulnerability": f"Possible Subdomain Takeover — {fqdn}",
            "severity": "MEDIUM",
            "location": fqdn,
            "evidence": (
                f"CNAME for {fqdn} points to {cname}. "
                f"HTTP response matched {http_match['provider']} fingerprint: "
                f"'{http_match['signature']}' (HTTP {http_match['status_code']})."
            ),
            "confidence": "MEDIUM",
            "raw_details": {
                "subdomain": fqdn,
                "cname": cname,
                "provider": http_match["provider"],
                "cname_nxdomain": False,
                "http_signature": http_match["signature"],
                "http_status": http_match["status_code"],
            },
        }

    return None


# ---------------------------------------------------------------------------
# Core Scan Logic
# ---------------------------------------------------------------------------
def scan_subdomain_takeover(target: str, session, timeout: int = 10) -> List[Dict]:
    """
    Scan a target domain for subdomain takeover vulnerabilities.
    """
    findings: List[Dict] = []

    parsed = urlparse(target)
    domain = _strip_port(parsed.netloc or parsed.path).lower()

    if not domain or _is_ip_address(domain):
        return findings

    # Remove www. prefix to get the base domain
    if domain.startswith("www."):
        domain = domain[4:]

    # Build candidate list
    candidates: List[str] = [domain]  # Check bare domain too
    for prefix in SUBDOMAIN_PREFIXES:
        candidates.append(f"{prefix}.{domain}")

    # Also check the target itself if it is a subdomain
    parts = domain.split(".")
    if len(parts) > 2:
        candidates.append(domain)

    # Deduplicate
    candidates = list(dict.fromkeys(candidates))

    # Phase 1: Parallel CNAME resolution to find subdomains with CNAMEs
    cname_results: Dict[str, Optional[str]] = {}

    def _resolve_cname_task(fqdn: str) -> Tuple[str, Optional[str]]:
        return fqdn, _get_cname(fqdn)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        futures = {
            executor.submit(_resolve_cname_task, fqdn): fqdn
            for fqdn in candidates
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                fqdn, cname = future.result()
                if cname:
                    cname_results[fqdn] = cname
            except Exception:
                pass

    if not cname_results:
        return findings

    # Phase 2: For subdomains with CNAMEs, check takeover conditions
    def _takeover_check_task(fqdn: str) -> Optional[Dict]:
        return _check_subdomain(session, fqdn)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        futures = {
            executor.submit(_takeover_check_task, fqdn): fqdn
            for fqdn in cname_results
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
                if result:
                    findings.append(make_finding(
                        vulnerability=result["vulnerability"],
                        severity=result["severity"],
                        location=result["location"],
                        evidence=result["evidence"],
                        category=CATEGORY,
                        confidence=result.get("confidence"),
                        raw_details=result.get("raw_details", {}),
                    ))
            except Exception:
                pass

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    parsed = urlparse(target)
    domain = _strip_port(parsed.netloc or parsed.path).lower()
    if domain.startswith("www."):
        domain = domain[4:]

    return [
        make_finding(
            vulnerability=f"Subdomain Takeover — staging.{domain} (Heroku)",
            severity="HIGH",
            location=f"staging.{domain}",
            evidence=(
                f"CNAME for staging.{domain} points to "
                f"staging-{domain.replace('.', '-')}.herokuapp.com (Heroku), "
                f"but the CNAME target does not resolve (NXDOMAIN). "
                f"This is a strong indicator of subdomain takeover. "
                f"HTTP fingerprint confirmed: 'No such app'"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "subdomain": f"staging.{domain}",
                "cname": f"staging-{domain.replace('.', '-')}.herokuapp.com",
                "provider": "Heroku",
                "cname_nxdomain": True,
                "http_match": {
                    "provider": "Heroku",
                    "signature": "No such app",
                    "status_code": 404,
                    "url": f"https://staging.{domain}",
                },
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Subdomain Takeover Scanner")
    args = parser.parse_args()

    target = normalize_url(args.target)

    if is_mock_mode():
        output_findings(get_mock_findings(target))
        return

    session = create_session(
        timeout=args.timeout,
        cookies=args.cookies,
        headers=args.headers,
    )

    try:
        findings = scan_subdomain_takeover(target, session, timeout=args.timeout)
    except Exception as exc:
        from scan_utils import output_error
        output_error(f"Subdomain takeover scan failed: {exc}")
        return

    output_findings(findings)


if __name__ == "__main__":
    main()
