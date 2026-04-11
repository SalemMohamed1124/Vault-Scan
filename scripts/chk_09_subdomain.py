#!/usr/bin/env python3
"""
VaultScan — Subdomain Enumeration Scanner (Production)
=======================================================
Enumerates subdomains using multiple techniques:

1. **Certificate Transparency** — crt.sh
2. **DNS brute-force** — 300+ common subdomain prefixes
3. **TLS SAN extraction** — reads Subject Alternative Names from TLS certs
4. **Web archive** — queries web.archive.org for historical subdomains
5. **DNS record analysis** — checks CNAME, MX, NS for related subdomains

Verified subdomains are checked for:
  - HTTP service availability and status codes
  - Takeover indicators (CNAME dangling, cloud provider error pages)
  - Sensitive infrastructure classification

Outputs JSON array of findings to stdout.
"""

import json
import os
import re
import socket
import ssl
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
    output_error,
    normalize_url,
    get_base_domain,
    create_session,
    safe_request,
    make_finding,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CATEGORY = "DNS"
MAX_SUBDOMAINS = 1000
DNS_TIMEOUT = 3
CRTSH_TIMEOUT = 20
HTTP_CHECK_TIMEOUT = 5
MAX_CONCURRENT_RESOLVERS = 30

# Sensitive subdomain prefixes
SENSITIVE_NAMES: Set[str] = {
    "admin", "staging", "dev", "test", "internal", "jenkins", "docker",
    "git", "backup", "debug", "qa", "uat", "sandbox", "ci", "cd",
    "deploy", "build", "monitor", "sentry", "grafana", "kibana",
    "prometheus", "elastic", "intranet", "vpn", "remote", "panel",
    "control", "manage", "cp", "k8s", "kube", "svn", "repo",
    "phpmyadmin", "adminer", "pgadmin", "redis", "mongo", "mysql",
    "postgres", "db", "database", "minio", "vault", "consul",
    "traefik", "portainer", "rancher", "argocd", "gitlab", "sonar",
    "nexus", "artifactory", "harbor", "registry", "jira", "confluence",
}

# 300+ common subdomain prefixes
SUBDOMAIN_WORDLIST: List[str] = [
    # Infrastructure
    "www", "www1", "www2", "www3", "mail", "mail2", "email", "webmail",
    "api", "api2", "api-v2", "api-staging", "api-dev", "api-test",
    "dev", "dev1", "dev2", "develop", "development",
    "staging", "stage", "stg", "preprod", "pre-prod",
    "admin", "administrator", "panel", "cp", "cpanel", "whm",
    "app", "app2", "application", "apps",
    "cdn", "cdn1", "cdn2", "static", "assets", "media", "img", "images",
    "ftp", "sftp", "ftps", "files", "file", "upload", "uploads", "download",
    # DNS
    "ns", "ns1", "ns2", "ns3", "ns4", "dns", "dns1", "dns2",
    "mx", "mx1", "mx2", "smtp", "imap", "pop", "pop3",
    # Security
    "vpn", "vpn2", "remote", "rdp", "ssh", "bastion", "jump",
    "sso", "auth", "oauth", "login", "signin", "id", "identity",
    "secure", "security", "waf", "firewall",
    # Development
    "git", "gitlab", "github", "bitbucket", "svn", "repo", "repos",
    "ci", "cd", "jenkins", "travis", "circleci", "drone", "bamboo",
    "build", "builder", "deploy", "deployer", "release",
    "sonar", "sonarqube", "nexus", "artifactory", "harbor", "registry",
    "docker", "k8s", "kube", "kubernetes", "rancher", "portainer",
    # Monitoring
    "monitor", "monitoring", "nagios", "zabbix", "cacti",
    "grafana", "prometheus", "metrics", "stats", "status",
    "sentry", "elastic", "elasticsearch", "kibana", "logstash",
    "splunk", "datadog", "newrelic", "apm",
    # Services
    "portal", "gateway", "proxy", "lb", "load-balancer",
    "cache", "redis", "memcached", "varnish",
    "db", "database", "mysql", "postgres", "postgresql", "mongo", "mongodb",
    "mssql", "oracle", "mariadb", "couchdb", "cassandra", "dynamodb",
    "search", "solr", "elastic",
    "queue", "rabbit", "rabbitmq", "kafka", "activemq", "mq",
    "minio", "s3", "storage", "blob",
    # Business
    "blog", "news", "press", "cms", "wp", "wordpress", "joomla", "drupal",
    "shop", "store", "ecommerce", "cart", "checkout", "payment", "pay",
    "crm", "erp", "hr", "finance", "billing", "invoice",
    "support", "help", "helpdesk", "desk", "ticket", "tickets",
    "forum", "community", "social", "chat", "slack",
    "docs", "doc", "documentation", "wiki", "knowledge", "kb",
    "analytics", "track", "tracking", "pixel",
    "marketing", "promo", "campaign", "newsletter",
    "demo", "trial", "beta", "alpha", "preview", "canary",
    # Cloud / Infra
    "aws", "azure", "gcp", "cloud", "edge",
    "vault", "consul", "terraform", "ansible",
    "argocd", "argo", "flux", "helm",
    # Network
    "intranet", "internal", "corp", "corporate", "office",
    "extranet", "partner", "partners", "vendor",
    "router", "switch", "lan", "wan", "wifi",
    # Common legacy
    "old", "new", "legacy", "v1", "v2", "v3", "web", "web2",
    "backup", "bak", "temp", "tmp", "archive",
    "test", "test1", "test2", "testing", "qa", "uat",
    # Misc
    "data", "report", "reports", "api-gateway",
    "sandbox", "playground", "lab", "labs",
    "mobile", "m", "wap", "link", "links", "go", "redirect",
    "ad", "ads", "adserver", "tracking", "events", "event",
    "video", "stream", "streaming", "live", "tv",
    "mail1", "mail3", "mx3", "relay", "outbound",
    "phpmyadmin", "adminer", "pgadmin", "webmin",
    "confluence", "jira", "trello", "notion",
    "webhook", "webhooks", "callback", "notify", "notification",
    "graphql", "grpc", "ws", "websocket", "socket", "realtime",
    "config", "configuration", "settings", "env",
]

# Cloud provider takeover signatures
TAKEOVER_SIGNATURES = {
    "AWS S3": ["NoSuchBucket", "The specified bucket does not exist"],
    "GitHub Pages": ["There isn't a GitHub Pages site here"],
    "Heroku": ["No such app", "herokucdn.com/error-pages"],
    "Azure": ["404 Web Site not found", "The web app you have attempted"],
    "Shopify": ["Sorry, this shop is currently unavailable"],
    "Fastly": ["Fastly error: unknown domain"],
    "Pantheon": ["404 error unknown site"],
    "Tumblr": ["Whatever you were looking for doesn't currently exist"],
    "Zendesk": ["Help Center Closed"],
    "Unbounce": ["The requested URL was not found on this server"],
    "Ghost": ["The thing you were looking for is no longer here"],
}

_IP_RE = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_ip_address(host: str) -> bool:
    if _IP_RE.match(host):
        return True
    if host.startswith("[") or host.count(":") > 1:
        return True
    return False


def _strip_port(netloc: str) -> str:
    if netloc.startswith("["):
        bracket_end = netloc.find("]")
        if bracket_end != -1:
            return netloc[1:bracket_end]
        return netloc
    if ":" in netloc:
        return netloc.rsplit(":", 1)[0]
    return netloc


def _classify_severity(subdomain_prefix: str) -> str:
    prefix_lower = subdomain_prefix.lower()
    for sensitive in SENSITIVE_NAMES:
        if sensitive in prefix_lower:
            return "MEDIUM"
    return "LOW"


def _resolve_subdomain(fqdn: str) -> Optional[str]:
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

    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT
        answers = resolver.resolve(fqdn, "A")
        for rdata in answers:
            return str(rdata)
    except Exception:
        pass

    return None


def _get_cname(fqdn: str) -> Optional[str]:
    """Get CNAME record for a subdomain (useful for takeover detection)."""
    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT
        answers = resolver.resolve(fqdn, "CNAME")
        for rdata in answers:
            return str(rdata.target).rstrip(".")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Certificate Transparency — crt.sh
# ---------------------------------------------------------------------------
def _query_crtsh(domain: str, session) -> Set[str]:
    subdomains: Set[str] = set()
    url = f"https://crt.sh/?q=%.{domain}&output=json"

    resp, err = safe_request(session, "GET", url, timeout=CRTSH_TIMEOUT)
    if err or resp is None:
        return subdomains

    try:
        entries = resp.json()
    except (json.JSONDecodeError, ValueError):
        return subdomains

    for entry in entries:
        name_value = entry.get("name_value", "")
        for name in name_value.splitlines():
            name = name.strip().lower()
            if not name or "*" in name:
                continue
            if name == domain or not name.endswith(f".{domain}"):
                continue
            subdomains.add(name)

    return subdomains


# ---------------------------------------------------------------------------
# TLS SAN Extraction
# ---------------------------------------------------------------------------
def _extract_tls_sans(domain: str) -> Set[str]:
    """Extract Subject Alternative Names from the TLS certificate."""
    subdomains: Set[str] = set()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((domain, 443), timeout=DNS_TIMEOUT) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert(binary_form=False)
                if cert:
                    for type_val, name in cert.get("subjectAltName", []):
                        if type_val == "DNS":
                            name = name.lower().strip()
                            if "*" not in name and name.endswith(f".{domain}"):
                                subdomains.add(name)
    except Exception:
        pass
    return subdomains


# ---------------------------------------------------------------------------
# Web Archive
# ---------------------------------------------------------------------------
def _query_web_archive(domain: str, session) -> Set[str]:
    """Query web.archive.org for historical subdomains."""
    subdomains: Set[str] = set()
    url = f"https://web.archive.org/cdx/search/cdx?url=*.{domain}&output=json&fl=original&collapse=urlkey&limit=200"

    resp, err = safe_request(session, "GET", url, timeout=15)
    if err or resp is None:
        return subdomains

    try:
        entries = resp.json()
        for entry in entries[1:]:  # Skip header row
            if entry and len(entry) > 0:
                parsed = urlparse(entry[0])
                host = parsed.netloc.lower().split(":")[0]
                if host and host.endswith(f".{domain}") and "*" not in host:
                    subdomains.add(host)
    except Exception:
        pass

    return subdomains


# ---------------------------------------------------------------------------
# DNS Record Analysis
# ---------------------------------------------------------------------------
def _check_dns_records(domain: str) -> Set[str]:
    """Check MX, NS, and TXT records for related subdomains."""
    subdomains: Set[str] = set()
    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.lifetime = DNS_TIMEOUT

        # MX records
        try:
            answers = resolver.resolve(domain, "MX")
            for rdata in answers:
                mx_host = str(rdata.exchange).rstrip(".").lower()
                if mx_host.endswith(f".{domain}"):
                    subdomains.add(mx_host)
        except Exception:
            pass

        # NS records
        try:
            answers = resolver.resolve(domain, "NS")
            for rdata in answers:
                ns_host = str(rdata.target).rstrip(".").lower()
                if ns_host.endswith(f".{domain}"):
                    subdomains.add(ns_host)
        except Exception:
            pass

    except ImportError:
        pass

    return subdomains


# ---------------------------------------------------------------------------
# Subdomain Takeover Detection
# ---------------------------------------------------------------------------
def _check_takeover(session, fqdn: str, cname: Optional[str]) -> Optional[Dict]:
    """Check if a subdomain is vulnerable to takeover."""
    # Check if CNAME points to a cloud service but the service is unclaimed
    if cname:
        cloud_patterns = [
            (".s3.amazonaws.com", "AWS S3"),
            (".s3-website", "AWS S3"),
            (".herokuapp.com", "Heroku"),
            (".herokudns.com", "Heroku"),
            (".azurewebsites.net", "Azure"),
            (".cloudapp.net", "Azure"),
            (".trafficmanager.net", "Azure"),
            (".blob.core.windows.net", "Azure"),
            (".github.io", "GitHub Pages"),
            (".shopify.com", "Shopify"),
            (".fastly.net", "Fastly"),
            (".pantheonsite.io", "Pantheon"),
            (".ghost.io", "Ghost"),
            (".zendesk.com", "Zendesk"),
            (".unbounce.com", "Unbounce"),
        ]

        for pattern, provider in cloud_patterns:
            if cname.endswith(pattern):
                # Verify by fetching the page
                for scheme in ["https", "http"]:
                    resp, err = safe_request(
                        session, "GET", f"{scheme}://{fqdn}",
                        timeout=HTTP_CHECK_TIMEOUT
                    )
                    if resp:
                        body = resp.text[:5000]
                        signatures = TAKEOVER_SIGNATURES.get(provider, [])
                        for sig in signatures:
                            if sig in body:
                                return {
                                    "provider": provider,
                                    "cname": cname,
                                    "signature": sig,
                                }
    return None


# ---------------------------------------------------------------------------
# HTTP Service Check
# ---------------------------------------------------------------------------
def _check_http_service(
    session, fqdn: str
) -> Optional[Dict]:
    """Check if the subdomain has an HTTP service running."""
    for scheme in ["https", "http"]:
        resp, err = safe_request(
            session, "GET", f"{scheme}://{fqdn}",
            timeout=HTTP_CHECK_TIMEOUT
        )
        if resp:
            return {
                "scheme": scheme,
                "status_code": resp.status_code,
                "server": resp.headers.get("Server", ""),
                "title": _extract_title(resp.text),
                "content_length": len(resp.text),
            }
    return None


def _extract_title(html: str) -> str:
    """Extract <title> from HTML."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html[:5000], "html.parser")
        title = soup.find("title")
        if title:
            return title.text.strip()[:100]
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# Parallel Resolution
# ---------------------------------------------------------------------------
def _resolve_batch(candidates: List[str]) -> Dict[str, Optional[str]]:
    """Resolve a batch of subdomains in parallel."""
    results: Dict[str, Optional[str]] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_RESOLVERS) as executor:
        future_to_fqdn = {
            executor.submit(_resolve_subdomain, fqdn): fqdn
            for fqdn in candidates
        }
        for future in concurrent.futures.as_completed(future_to_fqdn):
            fqdn = future_to_fqdn[future]
            try:
                results[fqdn] = future.result()
            except Exception:
                results[fqdn] = None

    return results


# ---------------------------------------------------------------------------
# Core Scan Logic
# ---------------------------------------------------------------------------
def scan_subdomains(target: str, session) -> List[Dict]:
    findings: List[Dict] = []

    base = get_base_domain(target)
    domain = _strip_port(base)

    if not domain or _is_ip_address(domain):
        return findings

    # Collect candidates from multiple sources
    crtsh_results = _query_crtsh(domain, session)
    brute_candidates = {f"{prefix}.{domain}" for prefix in SUBDOMAIN_WORDLIST}
    tls_sans = _extract_tls_sans(domain)
    archive_results = _query_web_archive(domain, session)
    dns_records = _check_dns_records(domain)

    all_candidates = sorted(
        crtsh_results | brute_candidates | tls_sans | archive_results | dns_records
    )
    if len(all_candidates) > MAX_SUBDOMAINS:
        all_candidates = all_candidates[:MAX_SUBDOMAINS]

    # Track sources
    source_map: Dict[str, List[str]] = {}
    for fqdn in all_candidates:
        sources = []
        if fqdn in crtsh_results:
            sources.append("crt.sh")
        if fqdn in brute_candidates:
            sources.append("bruteforce")
        if fqdn in tls_sans:
            sources.append("tls-san")
        if fqdn in archive_results:
            sources.append("web-archive")
        if fqdn in dns_records:
            sources.append("dns-records")
        source_map[fqdn] = sources

    # Parallel DNS resolution
    resolution_results = _resolve_batch(all_candidates)

    # Process resolved subdomains
    for fqdn, ip in resolution_results.items():
        if ip is None:
            # Check for dangling CNAME (potential takeover)
            cname = _get_cname(fqdn)
            if cname:
                takeover = _check_takeover(session, fqdn, cname)
                if takeover:
                    findings.append(make_finding(
                        vulnerability=f"Subdomain Takeover Possible: {fqdn}",
                        severity="HIGH",
                        location=fqdn,
                        evidence=(
                            f"CNAME points to {cname} ({takeover['provider']}) "
                            f"but the service appears unclaimed. "
                            f"Signature: '{takeover['signature']}'"
                        ),
                        category=CATEGORY,
                        confidence="HIGH",
                        raw_details={
                            "subdomain": fqdn,
                            "cname": cname,
                            "provider": takeover["provider"],
                            "takeover_signature": takeover["signature"],
                        },
                    ))
            continue

        prefix = fqdn[: -(len(domain) + 1)]
        severity = _classify_severity(prefix)
        sources = source_map.get(fqdn, ["unknown"])
        source_str = "+".join(sources)

        # Check HTTP service
        http_info = _check_http_service(session, fqdn)

        evidence_parts = [f"Live subdomain resolved to {ip}."]
        if severity == "MEDIUM":
            evidence_parts.append(
                f"Name '{prefix}' suggests sensitive infrastructure."
            )
        evidence_parts.append(f"Discovery source: {source_str}.")

        raw_details: Dict = {
            "subdomain": fqdn,
            "ip": ip,
            "source": source_str,
            "sources": sources,
        }

        if http_info:
            evidence_parts.append(
                f"HTTP service: {http_info['scheme']}://{fqdn} "
                f"({http_info['status_code']})"
            )
            if http_info.get("server"):
                evidence_parts.append(f"Server: {http_info['server']}")
            if http_info.get("title"):
                evidence_parts.append(f"Title: {http_info['title']}")
            raw_details["http"] = http_info

            # Check for takeover on live subdomains with CNAME
            cname = _get_cname(fqdn)
            if cname:
                raw_details["cname"] = cname
                takeover = _check_takeover(session, fqdn, cname)
                if takeover:
                    findings.append(make_finding(
                        vulnerability=f"Subdomain Takeover Possible: {fqdn}",
                        severity="HIGH",
                        location=fqdn,
                        evidence=(
                            f"CNAME points to {cname} ({takeover['provider']}) "
                            f"with takeover signature detected."
                        ),
                        category=CATEGORY,
                        confidence="HIGH",
                        raw_details={
                            "subdomain": fqdn,
                            "cname": cname,
                            "provider": takeover["provider"],
                        },
                    ))

        findings.append(make_finding(
            vulnerability=f"Subdomain Discovered: {fqdn}",
            severity=severity,
            location=fqdn,
            evidence=" ".join(evidence_parts),
            category=CATEGORY,
            raw_details=raw_details,
        ))

    return findings


# ---------------------------------------------------------------------------
# Mock Findings
# ---------------------------------------------------------------------------
def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Subdomain Discovered: staging.example.com",
            severity="MEDIUM",
            location="staging.example.com",
            evidence=(
                "Live subdomain resolved to 93.184.216.34. "
                "Name 'staging' suggests sensitive infrastructure. "
                "Discovery source: crt.sh+bruteforce. "
                "HTTP service: https://staging.example.com (200)"
            ),
            category=CATEGORY,
            raw_details={
                "subdomain": "staging.example.com",
                "ip": "93.184.216.34",
                "source": "crt.sh+bruteforce",
                "sources": ["crt.sh", "bruteforce"],
                "http": {"scheme": "https", "status_code": 200, "server": "nginx"},
            },
        ),
        make_finding(
            vulnerability="Subdomain Discovered: api.example.com",
            severity="LOW",
            location="api.example.com",
            evidence=(
                "Live subdomain resolved to 93.184.216.35. "
                "Discovery source: bruteforce+tls-san."
            ),
            category=CATEGORY,
            raw_details={
                "subdomain": "api.example.com",
                "ip": "93.184.216.35",
                "source": "bruteforce+tls-san",
                "sources": ["bruteforce", "tls-san"],
            },
        ),
        make_finding(
            vulnerability="Subdomain Takeover Possible: old-blog.example.com",
            severity="HIGH",
            location="old-blog.example.com",
            evidence=(
                "CNAME points to example.herokuapp.com (Heroku) "
                "but the service appears unclaimed. "
                "Signature: 'No such app'"
            ),
            category=CATEGORY,
            confidence="HIGH",
            raw_details={
                "subdomain": "old-blog.example.com",
                "cname": "example.herokuapp.com",
                "provider": "Heroku",
                "takeover_signature": "No such app",
            },
        ),
        make_finding(
            vulnerability="Subdomain Discovered: admin.example.com",
            severity="MEDIUM",
            location="admin.example.com",
            evidence=(
                "Live subdomain resolved to 93.184.216.36. "
                "Name 'admin' suggests sensitive infrastructure. "
                "Discovery source: crt.sh+bruteforce+web-archive."
            ),
            category=CATEGORY,
            raw_details={
                "subdomain": "admin.example.com",
                "ip": "93.184.216.36",
                "source": "crt.sh+bruteforce+web-archive",
                "sources": ["crt.sh", "bruteforce", "web-archive"],
            },
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = base_argparser("VaultScan — Subdomain Enumeration Scanner")
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
    findings: List[Dict] = []

    try:
        findings = scan_subdomains(target, session)
    except Exception as exc:
        output_error(f"Subdomain enumeration failed: {exc}")
        return

    output_findings(findings)


if __name__ == "__main__":
    main()
