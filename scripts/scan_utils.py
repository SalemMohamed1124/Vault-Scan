"""
VaultScan Shared Scanning Utilities
Common functions used across all scanning scripts.
"""

import argparse
import json
import os
import sys
import time
import re
import hashlib
import concurrent.futures
from urllib.parse import urlparse, urljoin, parse_qs, urlencode, urlunparse
from typing import List, Dict, Optional, Tuple, Any, Set, Callable

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_TIMEOUT = 10
DEFAULT_DELAY = 0.2
DEFAULT_CRAWL_DEPTH = 3
MAX_CRAWL_PAGES = 50
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# File extensions to skip during crawling
SKIP_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".webp", ".bmp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".wav",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".css", ".map",
}

# ---------------------------------------------------------------------------
# Mock Mode
# ---------------------------------------------------------------------------
def is_mock_mode() -> bool:
    """Check if SCAN_MOCK_MODE environment variable is set to 'true'."""
    return os.environ.get("SCAN_MOCK_MODE", "").lower() == "true"


def output_findings(findings: List[Dict]) -> None:
    """Print findings as JSON array to stdout and exit cleanly."""
    print(json.dumps(findings, indent=2))
    sys.exit(0)


def output_error(message: str) -> None:
    """Print error as JSON object to stdout and exit.
    Exit with code 0 so the orchestrator can parse the error gracefully.
    The 'error' key in JSON signals the issue without crashing the pipeline.
    """
    print(json.dumps({"error": message}))
    sys.exit(0)


# ---------------------------------------------------------------------------
# Argument Parsing
# ---------------------------------------------------------------------------
def base_argparser(description: str) -> argparse.ArgumentParser:
    """Create a base argument parser with common options including auth."""
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--target", required=True, help="Target URL, domain, or IP")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                        help=f"Request timeout in seconds (default: {DEFAULT_TIMEOUT})")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help=f"Delay between requests in seconds (default: {DEFAULT_DELAY})")
    parser.add_argument("--cookies", type=str, default="",
                        help="Cookies for authenticated scanning (format: name1=val1; name2=val2)")
    parser.add_argument("--headers", type=str, default="",
                        help="Custom headers (format: Header1:Value1;;Header2:Value2)")
    parser.add_argument("--crawl-depth", type=int, default=DEFAULT_CRAWL_DEPTH,
                        help=f"Crawl depth (default: {DEFAULT_CRAWL_DEPTH})")
    return parser


# ---------------------------------------------------------------------------
# URL Helpers
# ---------------------------------------------------------------------------
def normalize_url(target: str) -> str:
    """Ensure target has a proper scheme. Returns a URL string."""
    target = target.strip()
    if not target:
        return target
    # If it looks like an IP or domain without scheme, add https
    if not re.match(r'^https?://', target, re.IGNORECASE):
        target = f"https://{target}"
    # Remove trailing slash for consistency
    return target.rstrip("/")


def get_base_domain(url: str) -> str:
    """Extract the base domain from a URL."""
    parsed = urlparse(url)
    return parsed.netloc.lower()


def is_same_domain(url: str, base_url: str) -> bool:
    """Check if url belongs to the same domain as base_url."""
    return get_base_domain(url) == get_base_domain(base_url)


def extract_url_params(url: str) -> Dict[str, List[str]]:
    """Extract query parameters from a URL."""
    parsed = urlparse(url)
    return parse_qs(parsed.query)


def replace_url_param(url: str, param: str, value: str) -> str:
    """Replace a single query parameter value in a URL."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    params[param] = [value]
    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def url_has_extension(url: str) -> Optional[str]:
    """Return the file extension of a URL path, or None."""
    parsed = urlparse(url)
    path = parsed.path.lower()
    for ext in SKIP_EXTENSIONS:
        if path.endswith(ext):
            return ext
    return None


def strip_url_fragment(url: str) -> str:
    """Remove fragment (#...) from URL."""
    return url.split("#")[0]


# ---------------------------------------------------------------------------
# HTTP Session & Requests
# ---------------------------------------------------------------------------
def create_session(
    timeout: int = DEFAULT_TIMEOUT,
    cookies: str = "",
    headers: str = "",
) -> requests.Session:
    """Create a requests session with default headers and optional auth."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "close",
    })
    session.verify = False  # Allow self-signed certs for scanning
    session.timeout = timeout

    # Apply authentication cookies
    if cookies:
        for pair in cookies.split(";"):
            pair = pair.strip()
            if "=" in pair:
                name, value = pair.split("=", 1)
                session.cookies.set(name.strip(), value.strip())

    # Apply custom headers
    if headers:
        for header_pair in headers.split(";;"):
            header_pair = header_pair.strip()
            if ":" in header_pair:
                name, value = header_pair.split(":", 1)
                session.headers[name.strip()] = value.strip()

    return session


def safe_request(
    session: requests.Session,
    method: str,
    url: str,
    timeout: int = DEFAULT_TIMEOUT,
    **kwargs
) -> Tuple[Optional[requests.Response], Optional[str]]:
    """
    Make a safe HTTP request that never throws.
    Returns (response, error_message). One will always be None.
    """
    try:
        kwargs.setdefault("timeout", timeout)
        kwargs.setdefault("allow_redirects", True)
        kwargs.setdefault("verify", False)
        resp = session.request(method, url, **kwargs)
        return resp, None
    except requests.exceptions.Timeout:
        return None, f"Timeout connecting to {url}"
    except requests.exceptions.ConnectionError:
        return None, f"Connection error for {url}"
    except requests.exceptions.TooManyRedirects:
        return None, f"Too many redirects for {url}"
    except requests.exceptions.RequestException as e:
        return None, f"Request error for {url}: {str(e)}"
    except Exception as e:
        return None, f"Unexpected error for {url}: {str(e)}"


def rate_limited_request(
    session: requests.Session,
    method: str,
    url: str,
    delay: float = DEFAULT_DELAY,
    timeout: int = DEFAULT_TIMEOUT,
    **kwargs
) -> Tuple[Optional[requests.Response], Optional[str]]:
    """Make a rate-limited request with configurable delay."""
    time.sleep(delay)
    return safe_request(session, method, url, timeout=timeout, **kwargs)


# ---------------------------------------------------------------------------
# Form Extraction
# ---------------------------------------------------------------------------
def extract_forms(url: str, html: str) -> List[Dict]:
    """
    Extract forms from HTML content.
    Returns list of dicts with: action, method, inputs[{name, type, value}]
    """
    forms = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        for form in soup.find_all("form"):
            action = form.get("action", "")
            if action:
                action = urljoin(url, action)
            else:
                action = url

            method = form.get("method", "GET").upper()

            inputs = []
            for inp in form.find_all(["input", "textarea", "select"]):
                name = inp.get("name")
                if not name:
                    continue
                inp_type = inp.get("type", "text").lower()
                value = inp.get("value", "")
                inputs.append({
                    "name": name,
                    "type": inp_type,
                    "value": value
                })

            forms.append({
                "action": action,
                "method": method,
                "inputs": inputs
            })
    except Exception:
        pass
    return forms


# ---------------------------------------------------------------------------
# Deep Crawler (Production-grade)
# ---------------------------------------------------------------------------
def crawl_same_domain(
    base_url: str,
    session: requests.Session,
    delay: float = DEFAULT_DELAY,
    timeout: int = DEFAULT_TIMEOUT,
    max_pages: int = MAX_CRAWL_PAGES,
    depth: int = DEFAULT_CRAWL_DEPTH,
) -> List[str]:
    """
    Deep same-domain crawler with configurable depth.
    Returns list of unique same-domain URLs found.
    Always includes the base_url itself.
    Also extracts URLs from:
      - <a href> links
      - <form action> attributes
      - JavaScript files (API endpoint patterns)
      - Inline scripts (fetch/axios/XMLHttpRequest URLs)
    """
    visited: Set[str] = set()
    to_visit: List[Tuple[str, int]] = [(base_url, 0)]
    found_urls: Set[str] = set()
    found_urls.add(base_url)
    js_urls_extracted: Set[str] = set()

    while to_visit and len(visited) < max_pages:
        current_url, current_depth = to_visit.pop(0)

        if current_url in visited:
            continue
        visited.add(current_url)

        # Skip non-HTML resources
        if url_has_extension(current_url):
            continue

        resp, err = safe_request(session, "GET", current_url, timeout=timeout)
        if err or not resp:
            continue

        content_type = resp.headers.get("Content-Type", "")
        html = resp.text

        # Extract links from HTML pages
        if "text/html" in content_type or "application/xhtml" in content_type or not content_type:
            new_urls = _extract_links_from_html(current_url, html, base_url)
            # Extract endpoints from inline scripts
            inline_endpoints = _extract_endpoints_from_inline_js(html, base_url)
            new_urls.update(inline_endpoints)

            for new_url in new_urls:
                if new_url not in found_urls and len(found_urls) < max_pages * 2:
                    found_urls.add(new_url)
                    if current_depth < depth and new_url not in visited:
                        to_visit.append((new_url, current_depth + 1))

            # Find JavaScript file URLs and extract endpoints from them
            js_file_urls = _find_js_file_urls(current_url, html)
            for js_url in js_file_urls:
                if js_url not in js_urls_extracted:
                    js_urls_extracted.add(js_url)
                    js_endpoints = _extract_endpoints_from_js_file(
                        session, js_url, base_url, timeout
                    )
                    for ep in js_endpoints:
                        if ep not in found_urls:
                            found_urls.add(ep)

        if delay > 0:
            time.sleep(delay)

    return list(found_urls)[:max_pages]


def _extract_links_from_html(
    page_url: str, html: str, base_url: str
) -> Set[str]:
    """Extract same-domain links from HTML."""
    urls: Set[str] = set()
    try:
        soup = BeautifulSoup(html, "html.parser")

        # <a href>
        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            full_url = urljoin(page_url, href)
            full_url = strip_url_fragment(full_url)
            if is_same_domain(full_url, base_url) and not url_has_extension(full_url):
                urls.add(full_url)

        # <form action>
        for form in soup.find_all("form", action=True):
            action = form["action"]
            full_url = urljoin(page_url, action)
            full_url = strip_url_fragment(full_url)
            if is_same_domain(full_url, base_url):
                urls.add(full_url)

        # <iframe src>, <frame src>
        for tag in soup.find_all(["iframe", "frame"], src=True):
            src = tag["src"]
            full_url = urljoin(page_url, src)
            if is_same_domain(full_url, base_url):
                urls.add(full_url)

    except Exception:
        pass
    return urls


def _find_js_file_urls(page_url: str, html: str) -> Set[str]:
    """Find JavaScript file URLs referenced in the page."""
    js_urls: Set[str] = set()
    try:
        soup = BeautifulSoup(html, "html.parser")
        for script in soup.find_all("script", src=True):
            src = script["src"]
            full_url = urljoin(page_url, src)
            if full_url.endswith(".js") or ".js?" in full_url:
                js_urls.add(full_url)
    except Exception:
        pass
    return js_urls


# Regex patterns for API endpoint extraction from JavaScript
_JS_ENDPOINT_PATTERNS = [
    # fetch('/api/users') or fetch("/api/users")
    re.compile(r"""(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*['"`]([/][^'"`\s]{3,})['"`]"""),
    # url: '/api/users' or path: '/api/users'
    re.compile(r"""(?:url|path|endpoint|apiUrl|baseUrl|href)\s*[:=]\s*['"`]([/][^'"`\s]{3,})['"`]"""),
    # XMLHttpRequest .open('GET', '/api/users')
    re.compile(r"""\.open\s*\(\s*['"][A-Z]+['"]\s*,\s*['"`]([/][^'"`\s]{3,})['"`]"""),
    # router.get('/users') or app.post('/api/data')
    re.compile(r"""(?:router|app)\.(?:get|post|put|delete|patch|use)\s*\(\s*['"`]([/][^'"`\s]{3,})['"`]"""),
]


def _extract_endpoints_from_inline_js(html: str, base_url: str) -> Set[str]:
    """Extract API endpoints from inline <script> blocks."""
    endpoints: Set[str] = set()
    try:
        soup = BeautifulSoup(html, "html.parser")
        for script in soup.find_all("script"):
            if script.string:
                for pattern in _JS_ENDPOINT_PATTERNS:
                    for match in pattern.finditer(script.string):
                        path = match.group(1)
                        full_url = urljoin(base_url, path)
                        if is_same_domain(full_url, base_url):
                            endpoints.add(full_url)
    except Exception:
        pass
    return endpoints


def _extract_endpoints_from_js_file(
    session: requests.Session,
    js_url: str,
    base_url: str,
    timeout: int = DEFAULT_TIMEOUT,
) -> Set[str]:
    """Fetch a JS file and extract API endpoint paths from it."""
    endpoints: Set[str] = set()
    resp, err = safe_request(session, "GET", js_url, timeout=timeout)
    if err or not resp:
        return endpoints

    js_content = resp.text
    if len(js_content) > 2_000_000:  # Skip very large files
        return endpoints

    for pattern in _JS_ENDPOINT_PATTERNS:
        for match in pattern.finditer(js_content):
            path = match.group(1)
            # Skip common false positives
            if any(fp in path for fp in [".js", ".css", ".png", ".svg", "node_modules"]):
                continue
            full_url = urljoin(base_url, path)
            if is_same_domain(full_url, base_url):
                endpoints.add(full_url)

    return endpoints


# ---------------------------------------------------------------------------
# WAF Detection
# ---------------------------------------------------------------------------
WAF_SIGNATURES = {
    "cloudflare": [re.compile(r"cloudflare", re.I), re.compile(r"cf-ray", re.I)],
    "akamai": [re.compile(r"akamai", re.I), re.compile(r"akamaighost", re.I)],
    "aws-waf": [re.compile(r"awselb", re.I), re.compile(r"x-amzn-requestid", re.I)],
    "imperva": [re.compile(r"incapsula", re.I), re.compile(r"visid_incap", re.I)],
    "modsecurity": [re.compile(r"mod_security", re.I), re.compile(r"modsecurity", re.I)],
    "f5-bigip": [re.compile(r"bigipserver", re.I), re.compile(r"f5", re.I)],
    "sucuri": [re.compile(r"sucuri", re.I), re.compile(r"x-sucuri", re.I)],
}


def detect_waf(responses: List[Optional[requests.Response]]) -> bool:
    """
    Check if a WAF is likely blocking our requests.
    Returns True if >50% of responses are 403/429/406.
    """
    if not responses:
        return False
    blocked = 0
    total = 0
    for r in responses:
        if r is not None:
            total += 1
            if r.status_code in (403, 429, 406):
                blocked += 1
    if total == 0:
        return False
    return (blocked / total) > 0.5


def identify_waf(response: Optional[requests.Response]) -> Optional[str]:
    """Identify specific WAF from response headers and body."""
    if response is None:
        return None

    headers_str = str(response.headers).lower()
    body_sample = response.text[:5000].lower() if response.text else ""
    combined = headers_str + " " + body_sample

    for waf_name, patterns in WAF_SIGNATURES.items():
        for pattern in patterns:
            if pattern.search(combined):
                return waf_name

    return None


# ---------------------------------------------------------------------------
# Finding Builder
# ---------------------------------------------------------------------------
def make_finding(
    vulnerability: str,
    severity: str,
    location: str,
    evidence: str,
    category: str,
    cve_id: Optional[str] = None,
    raw_details: Optional[Dict] = None,
    confidence: Optional[str] = None,
) -> Dict:
    """Create a standardized finding dictionary."""
    finding = {
        "vulnerability": vulnerability,
        "severity": severity.upper(),
        "location": location,
        "evidence": evidence,
        "category": category,
        "cve_id": cve_id,
        "raw_details": raw_details or {}
    }
    if confidence:
        finding["confidence"] = confidence
    return finding


# ---------------------------------------------------------------------------
# Response Analysis Helpers
# ---------------------------------------------------------------------------
def measure_response_time(
    session: requests.Session,
    method: str,
    url: str,
    timeout: int = DEFAULT_TIMEOUT,
    **kwargs
) -> Tuple[Optional[requests.Response], float, Optional[str]]:
    """
    Make a request and measure response time in seconds.
    Returns (response, elapsed_seconds, error).
    """
    start = time.time()
    resp, err = safe_request(session, method, url, timeout=max(timeout, 15), **kwargs)
    elapsed = time.time() - start
    return resp, elapsed, err


def get_baseline_time(
    session: requests.Session,
    url: str,
    timeout: int = DEFAULT_TIMEOUT,
    samples: int = 3
) -> float:
    """Get average baseline response time for a URL."""
    times = []
    for _ in range(samples):
        _, elapsed, err = measure_response_time(session, "GET", url, timeout=timeout)
        if not err:
            times.append(elapsed)
        time.sleep(0.1)
    if not times:
        return 2.0  # Default baseline if all failed
    return sum(times) / len(times)


def response_fingerprint(response: requests.Response) -> str:
    """
    Create a fingerprint of a response for comparison.
    Uses status code + content length bucket + structural hash.
    """
    status = response.status_code
    body = response.text
    length_bucket = len(body) // 100  # bucket by 100 chars

    # Structural hash: strip variable content, hash structure
    # Remove numbers, UUIDs, timestamps
    stripped = re.sub(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', 'UUID', body)
    stripped = re.sub(r'\b\d{10,13}\b', 'TIMESTAMP', stripped)
    stripped = re.sub(r'\b\d+\b', 'NUM', stripped)
    struct_hash = hashlib.md5(stripped[:5000].encode(errors='ignore')).hexdigest()[:12]

    return f"{status}:{length_bucket}:{struct_hash}"


def responses_differ(resp1: requests.Response, resp2: requests.Response) -> bool:
    """Check if two responses are meaningfully different."""
    if resp1.status_code != resp2.status_code:
        return True

    len1, len2 = len(resp1.text), len(resp2.text)
    if len1 == 0 and len2 == 0:
        return False

    # Content length differs by more than 20%
    max_len = max(len1, len2)
    if abs(len1 - len2) / max_len > 0.2:
        return True

    # Structural fingerprint differs
    return response_fingerprint(resp1) != response_fingerprint(resp2)


def statistical_time_analysis(
    times: List[float],
    baseline: float,
    threshold_multiplier: float = 3.0,
) -> bool:
    """
    Determine if response times indicate a time-based injection.
    Uses statistical analysis: returns True if the mean of test times
    exceeds baseline * threshold_multiplier and standard deviation is low.
    """
    if not times:
        return False

    mean_time = sum(times) / len(times)

    # Mean must exceed threshold
    if mean_time < baseline * threshold_multiplier:
        return False

    # If only one sample, just check the threshold
    if len(times) == 1:
        return True

    # Standard deviation should be relatively low (consistent delay)
    variance = sum((t - mean_time) ** 2 for t in times) / len(times)
    std_dev = variance ** 0.5

    # Coefficient of variation < 0.5 means reasonably consistent
    if mean_time > 0 and (std_dev / mean_time) < 0.5:
        return True

    return False


# ---------------------------------------------------------------------------
# Robots.txt and Sitemap Parser
# ---------------------------------------------------------------------------
def parse_robots_txt(
    session: requests.Session,
    base_url: str,
    timeout: int = DEFAULT_TIMEOUT,
) -> List[str]:
    """
    Parse robots.txt for disallowed paths (often interesting targets).
    Returns list of full URLs.
    """
    urls: List[str] = []
    robots_url = f"{base_url}/robots.txt"
    resp, err = safe_request(session, "GET", robots_url, timeout=timeout)
    if err or not resp or resp.status_code != 200:
        return urls

    for line in resp.text.splitlines():
        line = line.strip()
        if line.lower().startswith("disallow:") or line.lower().startswith("allow:"):
            path = line.split(":", 1)[1].strip()
            if path and path != "/" and not path.startswith("#"):
                # Remove wildcards for basic path extraction
                clean_path = path.replace("*", "").rstrip("$")
                if clean_path:
                    full_url = urljoin(base_url, clean_path)
                    if is_same_domain(full_url, base_url):
                        urls.append(full_url)

        # Sitemap directive
        if line.lower().startswith("sitemap:"):
            sitemap_url = line.split(":", 1)[1].strip()
            if sitemap_url.startswith("http"):
                sitemap_urls = _parse_sitemap(session, sitemap_url, base_url, timeout)
                urls.extend(sitemap_urls)

    return urls


def _parse_sitemap(
    session: requests.Session,
    sitemap_url: str,
    base_url: str,
    timeout: int = DEFAULT_TIMEOUT,
    max_urls: int = 100,
) -> List[str]:
    """Parse a sitemap.xml for URLs."""
    urls: List[str] = []
    resp, err = safe_request(session, "GET", sitemap_url, timeout=timeout)
    if err or not resp or resp.status_code != 200:
        return urls

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
        for loc in soup.find_all("loc"):
            url = loc.text.strip()
            if is_same_domain(url, base_url):
                urls.append(url)
                if len(urls) >= max_urls:
                    break
    except Exception:
        pass

    return urls


# ---------------------------------------------------------------------------
# Technology Detection
# ---------------------------------------------------------------------------
TECH_PATTERNS = {
    "WordPress": [
        re.compile(r"/wp-content/", re.I),
        re.compile(r"/wp-includes/", re.I),
        re.compile(r"wp-json", re.I),
    ],
    "Django": [
        re.compile(r"csrfmiddlewaretoken", re.I),
        re.compile(r"__debug__", re.I),
    ],
    "Laravel": [
        re.compile(r"laravel_session", re.I),
        re.compile(r"XSRF-TOKEN", re.I),
    ],
    "Express": [
        re.compile(r"x-powered-by:\s*express", re.I),
    ],
    "ASP.NET": [
        re.compile(r"__VIEWSTATE", re.I),
        re.compile(r"x-aspnet-version", re.I),
        re.compile(r"x-powered-by:\s*asp\.net", re.I),
    ],
    "PHP": [
        re.compile(r"x-powered-by:\s*php", re.I),
        re.compile(r"PHPSESSID", re.I),
    ],
    "Spring": [
        re.compile(r"JSESSIONID", re.I),
        re.compile(r"x-application-context", re.I),
    ],
    "Rails": [
        re.compile(r"x-powered-by:\s*phusion passenger", re.I),
        re.compile(r"_rails_session", re.I),
    ],
    "Next.js": [
        re.compile(r"__next", re.I),
        re.compile(r"x-powered-by:\s*next\.js", re.I),
    ],
    "React": [
        re.compile(r"__react", re.I),
        re.compile(r"data-reactroot", re.I),
    ],
    "Angular": [
        re.compile(r"ng-version", re.I),
        re.compile(r"ng-app", re.I),
    ],
    "Vue.js": [
        re.compile(r"data-v-[a-f0-9]", re.I),
        re.compile(r"vue\.js", re.I),
    ],
}


def detect_technologies(
    response: requests.Response,
) -> List[str]:
    """Detect web technologies from response headers and body."""
    detected: List[str] = []
    headers_str = str(response.headers)
    body_sample = response.text[:10000] if response.text else ""
    combined = headers_str + " " + body_sample

    for tech, patterns in TECH_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(combined):
                detected.append(tech)
                break

    return detected


# Suppress InsecureRequestWarning globally for scanning
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
