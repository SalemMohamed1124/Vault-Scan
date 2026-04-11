#!/usr/bin/env python3
"""
VaultScan -- Cloud Storage Misconfiguration Scanner
=====================================================
Detects exposed cloud storage buckets (S3, GCS, Azure Blob),
tests for public access, directory listing, upload permissions,
and checks for hardcoded cloud credentials in JavaScript files.
"""

import os
import re
import sys
import time
from urllib.parse import urlparse
from typing import Dict, List, Set

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scan_utils import (
    is_mock_mode, output_findings, base_argparser, normalize_url,
    create_session, safe_request, make_finding, crawl_same_domain,
)

# ---------------------------------------------------------------------------
# Regex patterns for cloud storage URLs
# ---------------------------------------------------------------------------

S3_PATTERNS = [
    # https://s3.amazonaws.com/bucket-name/key
    re.compile(r'https?://s3\.amazonaws\.com/([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])(?:/[^\s"\'<>]*)?', re.I),
    # https://s3-region.amazonaws.com/bucket-name/key
    re.compile(r'https?://s3-[a-z0-9\-]+\.amazonaws\.com/([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])(?:/[^\s"\'<>]*)?', re.I),
    # https://bucket-name.s3.amazonaws.com/key
    re.compile(r'https?://([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])\.s3\.amazonaws\.com(?:/[^\s"\'<>]*)?', re.I),
    # https://bucket-name.s3-region.amazonaws.com/key
    re.compile(r'https?://([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])\.s3-[a-z0-9\-]+\.amazonaws\.com(?:/[^\s"\'<>]*)?', re.I),
    # https://bucket-name.s3.region.amazonaws.com/key
    re.compile(r'https?://([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])\.s3\.[a-z0-9\-]+\.amazonaws\.com(?:/[^\s"\'<>]*)?', re.I),
]

GCS_PATTERNS = [
    # https://storage.googleapis.com/bucket-name/key
    re.compile(r'https?://storage\.googleapis\.com/([a-z0-9][a-z0-9._\-]{1,61}[a-z0-9])(?:/[^\s"\'<>]*)?', re.I),
    # https://storage.cloud.google.com/bucket-name/key
    re.compile(r'https?://storage\.cloud\.google\.com/([a-z0-9][a-z0-9._\-]{1,61}[a-z0-9])(?:/[^\s"\'<>]*)?', re.I),
]

AZURE_PATTERNS = [
    # https://account.blob.core.windows.net/container/key
    re.compile(r'https?://([a-z0-9]{3,24})\.blob\.core\.windows\.net/([a-z0-9][a-z0-9\-]{1,62}[a-z0-9])(?:/[^\s"\'<>]*)?', re.I),
]

# Patterns for hardcoded cloud credentials in JavaScript
CREDENTIAL_PATTERNS = [
    (re.compile(r'(?:AKIA|ASIA)[A-Z0-9]{16}', re.I), "AWS Access Key ID"),
    (re.compile(r'aws_secret_access_key\s*[=:]\s*["\']([A-Za-z0-9/+=]{40})["\']', re.I), "AWS Secret Access Key"),
    (re.compile(r'(?:aws_session_token|x-amz-security-token)\s*[=:]\s*["\']([A-Za-z0-9/+=]+)["\']', re.I), "AWS Session Token"),
    (re.compile(r'AIza[A-Za-z0-9_\-]{35}'), "Google API Key"),
    (re.compile(r'AccountKey\s*=\s*([A-Za-z0-9/+=]{86}==)', re.I), "Azure Storage Account Key"),
    (re.compile(r'SharedAccessSignature\s*=\s*(sv=[^\s&"\']+)', re.I), "Azure SAS Token"),
    (re.compile(r'GOOG[A-Z0-9]{10,}'), "Google Cloud Service Account Key Marker"),
]


# ---------------------------------------------------------------------------
# Discovery helpers
# ---------------------------------------------------------------------------

def extract_s3_urls(text: str) -> List[Dict]:
    """Extract S3 bucket references from text."""
    results = []
    seen = set()
    for pattern in S3_PATTERNS:
        for match in pattern.finditer(text):
            bucket = match.group(1).lower()
            full_url = match.group(0)
            if bucket not in seen:
                seen.add(bucket)
                results.append({
                    "provider": "AWS S3",
                    "bucket": bucket,
                    "url": full_url,
                })
    return results


def extract_gcs_urls(text: str) -> List[Dict]:
    """Extract Google Cloud Storage references from text."""
    results = []
    seen = set()
    for pattern in GCS_PATTERNS:
        for match in pattern.finditer(text):
            bucket = match.group(1).lower()
            full_url = match.group(0)
            if bucket not in seen:
                seen.add(bucket)
                results.append({
                    "provider": "Google Cloud Storage",
                    "bucket": bucket,
                    "url": full_url,
                })
    return results


def extract_azure_urls(text: str) -> List[Dict]:
    """Extract Azure Blob Storage references from text."""
    results = []
    seen = set()
    for pattern in AZURE_PATTERNS:
        for match in pattern.finditer(text):
            account = match.group(1).lower()
            container = match.group(2).lower()
            full_url = match.group(0)
            key = f"{account}/{container}"
            if key not in seen:
                seen.add(key)
                results.append({
                    "provider": "Azure Blob Storage",
                    "account": account,
                    "container": container,
                    "bucket": f"{account}/{container}",
                    "url": full_url,
                })
    return results


def extract_all_cloud_urls(text: str) -> List[Dict]:
    """Extract all cloud storage references from text."""
    results = []
    results.extend(extract_s3_urls(text))
    results.extend(extract_gcs_urls(text))
    results.extend(extract_azure_urls(text))
    return results


# ---------------------------------------------------------------------------
# Access testing
# ---------------------------------------------------------------------------

def test_public_access(session, cloud_ref: Dict, timeout: int) -> Dict | None:
    """Test if a cloud storage resource is publicly accessible via GET."""
    url = cloud_ref["url"]
    resp, err = safe_request(session, "GET", url, timeout=timeout)
    if err or not resp:
        return None

    if resp.status_code == 200:
        content_type = resp.headers.get("Content-Type", "").lower()
        return {
            "accessible": True,
            "status_code": resp.status_code,
            "content_type": content_type,
            "content_length": len(resp.content),
        }
    return None


def test_listing_enabled(session, cloud_ref: Dict, timeout: int) -> Dict | None:
    """Test if directory/bucket listing is enabled."""
    provider = cloud_ref["provider"]

    if provider == "AWS S3":
        bucket = cloud_ref["bucket"]
        list_urls = [
            f"https://{bucket}.s3.amazonaws.com/?list-type=2",
            f"https://s3.amazonaws.com/{bucket}?list-type=2",
        ]
    elif provider == "Google Cloud Storage":
        bucket = cloud_ref["bucket"]
        list_urls = [
            f"https://storage.googleapis.com/{bucket}",
        ]
    elif provider == "Azure Blob Storage":
        account = cloud_ref.get("account", "")
        container = cloud_ref.get("container", "")
        list_urls = [
            f"https://{account}.blob.core.windows.net/{container}?restype=container&comp=list",
        ]
    else:
        return None

    for list_url in list_urls:
        resp, err = safe_request(session, "GET", list_url, timeout=timeout)
        if err or not resp:
            continue

        if resp.status_code == 200:
            body = resp.text.lower()
            listing_indicators = [
                "<listbucketresult",       # S3
                "<enumerationresults",     # Azure
                "<contents>",              # S3
                "<blob>",                  # Azure
                "<key>",                   # S3 / GCS
                "<name>",                  # Azure
            ]
            if any(indicator in body for indicator in listing_indicators):
                return {
                    "listing_enabled": True,
                    "list_url": list_url,
                    "status_code": resp.status_code,
                    "snippet": resp.text[:500],
                }

    return None


def test_upload_allowed(session, cloud_ref: Dict, timeout: int) -> Dict | None:
    """Test if upload (PUT) is allowed on the bucket/container."""
    provider = cloud_ref["provider"]
    test_key = "vaultscan-upload-test.txt"
    test_content = b"VaultScan security test - safe to delete"

    if provider == "AWS S3":
        bucket = cloud_ref["bucket"]
        put_url = f"https://{bucket}.s3.amazonaws.com/{test_key}"
    elif provider == "Google Cloud Storage":
        bucket = cloud_ref["bucket"]
        put_url = f"https://storage.googleapis.com/{bucket}/{test_key}"
    elif provider == "Azure Blob Storage":
        account = cloud_ref.get("account", "")
        container = cloud_ref.get("container", "")
        put_url = f"https://{account}.blob.core.windows.net/{container}/{test_key}"
    else:
        return None

    headers = {"Content-Type": "text/plain"}
    if provider == "Azure Blob Storage":
        headers["x-ms-blob-type"] = "BlockBlob"

    resp, err = safe_request(
        session, "PUT", put_url, timeout=timeout,
        headers=headers, data=test_content,
    )
    if err or not resp:
        return None

    if resp.status_code in (200, 201):
        return {
            "upload_allowed": True,
            "put_url": put_url,
            "status_code": resp.status_code,
        }

    return None


# ---------------------------------------------------------------------------
# Common bucket name guessing
# ---------------------------------------------------------------------------

def check_common_bucket_names(session, domain: str, timeout: int) -> List[Dict]:
    """Try common bucket naming patterns based on the target domain."""
    findings = []
    base_name = domain.replace(".", "-").replace("www-", "")
    short_name = domain.split(".")[0] if "." in domain else domain

    suffixes = ["backup", "assets", "uploads", "static", "media",
                "data", "logs", "dev", "staging", "prod", "public"]

    candidate_buckets = set()
    for name in [base_name, short_name]:
        for suffix in suffixes:
            candidate_buckets.add(f"{name}-{suffix}")
            candidate_buckets.add(f"{suffix}-{name}")
        candidate_buckets.add(name)

    for bucket_name in candidate_buckets:
        # Test S3
        s3_url = f"https://{bucket_name}.s3.amazonaws.com/"
        resp, err = safe_request(session, "GET", s3_url, timeout=timeout)
        if not err and resp and resp.status_code == 200:
            body_lower = resp.text.lower()
            if "<listbucketresult" in body_lower or "<contents>" in body_lower:
                findings.append(make_finding(
                    vulnerability="Publicly Listable S3 Bucket (Guessed Name)",
                    severity="HIGH",
                    location=s3_url,
                    evidence=(
                        f"S3 bucket '{bucket_name}' associated with domain '{domain}' "
                        f"is publicly accessible and has listing enabled."
                    ),
                    category="CLOUD_STORAGE",
                    raw_details={
                        "provider": "AWS S3",
                        "bucket": bucket_name,
                        "url": s3_url,
                        "guessed": True,
                    },
                ))
            elif resp.status_code == 200:
                findings.append(make_finding(
                    vulnerability="Publicly Accessible S3 Bucket (Guessed Name)",
                    severity="MEDIUM",
                    location=s3_url,
                    evidence=(
                        f"S3 bucket '{bucket_name}' associated with domain '{domain}' "
                        f"appears to be publicly accessible (HTTP 200)."
                    ),
                    category="CLOUD_STORAGE",
                    raw_details={
                        "provider": "AWS S3",
                        "bucket": bucket_name,
                        "url": s3_url,
                        "guessed": True,
                    },
                ))

        # Test GCS
        gcs_url = f"https://storage.googleapis.com/{bucket_name}"
        resp, err = safe_request(session, "GET", gcs_url, timeout=timeout)
        if not err and resp and resp.status_code == 200:
            findings.append(make_finding(
                vulnerability="Publicly Accessible GCS Bucket (Guessed Name)",
                severity="MEDIUM",
                location=gcs_url,
                evidence=(
                    f"Google Cloud Storage bucket '{bucket_name}' associated with "
                    f"domain '{domain}' is publicly accessible (HTTP 200)."
                ),
                category="CLOUD_STORAGE",
                raw_details={
                    "provider": "Google Cloud Storage",
                    "bucket": bucket_name,
                    "url": gcs_url,
                    "guessed": True,
                },
            ))

    return findings


# ---------------------------------------------------------------------------
# JavaScript credential scanning
# ---------------------------------------------------------------------------

def extract_js_urls(text: str, base_url: str) -> Set[str]:
    """Extract JavaScript file URLs from HTML content."""
    js_urls = set()
    parsed_base = urlparse(base_url)

    # <script src="...">
    for match in re.finditer(r'<script[^>]+src=["\']([^"\']+)["\']', text, re.I):
        src = match.group(1)
        if src.startswith("//"):
            src = f"{parsed_base.scheme}:{src}"
        elif src.startswith("/"):
            src = f"{parsed_base.scheme}://{parsed_base.netloc}{src}"
        elif not src.startswith("http"):
            src = f"{parsed_base.scheme}://{parsed_base.netloc}/{src}"
        if src.endswith(".js") or ".js?" in src:
            js_urls.add(src)

    return js_urls


def check_js_credentials(session, page_content: str, page_url: str,
                         timeout: int) -> List[Dict]:
    """Check JavaScript files for hardcoded cloud storage credentials."""
    findings = []
    js_urls = extract_js_urls(page_content, page_url)
    checked: Set[str] = set()

    # Also check inline scripts
    all_scripts = [page_content]

    for js_url in js_urls:
        if js_url in checked:
            continue
        checked.add(js_url)

        resp, err = safe_request(session, "GET", js_url, timeout=timeout)
        if err or not resp or resp.status_code != 200:
            continue
        all_scripts.append(resp.text)

    for script_content in all_scripts:
        for pattern, cred_type in CREDENTIAL_PATTERNS:
            matches = pattern.findall(script_content)
            if matches:
                # Mask the credential for safe reporting
                for raw_match in matches:
                    if isinstance(raw_match, str) and len(raw_match) > 8:
                        masked = raw_match[:4] + "*" * (len(raw_match) - 8) + raw_match[-4:]
                    elif isinstance(raw_match, str):
                        masked = raw_match[:2] + "****"
                    else:
                        masked = "****"

                    findings.append(make_finding(
                        vulnerability=f"Hardcoded Cloud Credential in JavaScript: {cred_type}",
                        severity="CRITICAL",
                        location=page_url,
                        evidence=(
                            f"Found {cred_type} in page/script content: {masked}. "
                            f"Hardcoded cloud credentials can allow unauthorized access "
                            f"to cloud storage resources."
                        ),
                        category="CLOUD_STORAGE",
                        raw_details={
                            "credential_type": cred_type,
                            "masked_value": masked,
                            "source": page_url,
                        },
                    ))

    return findings


# ---------------------------------------------------------------------------
# Page scanner (combines all checks on discovered cloud URLs)
# ---------------------------------------------------------------------------

def scan_page_for_cloud_storage(session, page_url: str, page_content: str,
                                timeout: int) -> List[Dict]:
    """Scan a single page for cloud storage misconfigurations."""
    findings = []
    cloud_refs = extract_all_cloud_urls(page_content)

    for ref in cloud_refs:
        provider = ref["provider"]
        bucket = ref["bucket"]
        url = ref["url"]

        # 1. Test public access
        access_result = test_public_access(session, ref, timeout)
        if access_result:
            findings.append(make_finding(
                vulnerability=f"Publicly Accessible {provider} Resource",
                severity="MEDIUM",
                location=url,
                evidence=(
                    f"{provider} resource '{bucket}' referenced on {page_url} "
                    f"is publicly accessible (HTTP {access_result['status_code']}). "
                    f"Content-Type: {access_result['content_type']}, "
                    f"Size: {access_result['content_length']} bytes."
                ),
                category="CLOUD_STORAGE",
                raw_details={
                    "provider": provider,
                    "bucket": bucket,
                    "source_page": page_url,
                    **access_result,
                },
            ))

        # 2. Test listing
        listing_result = test_listing_enabled(session, ref, timeout)
        if listing_result:
            findings.append(make_finding(
                vulnerability=f"{provider} Bucket Listing Enabled",
                severity="HIGH",
                location=listing_result["list_url"],
                evidence=(
                    f"{provider} bucket '{bucket}' has directory listing enabled. "
                    f"An attacker can enumerate all objects in the bucket. "
                    f"Snippet: {listing_result['snippet'][:200]}"
                ),
                category="CLOUD_STORAGE",
                raw_details={
                    "provider": provider,
                    "bucket": bucket,
                    "source_page": page_url,
                    **listing_result,
                },
            ))

        # 3. Test upload
        upload_result = test_upload_allowed(session, ref, timeout)
        if upload_result:
            findings.append(make_finding(
                vulnerability=f"{provider} Bucket Allows Public Upload",
                severity="CRITICAL",
                location=upload_result["put_url"],
                evidence=(
                    f"{provider} bucket '{bucket}' allows unauthenticated uploads "
                    f"(PUT returned HTTP {upload_result['status_code']}). "
                    f"An attacker could upload malicious content."
                ),
                category="CLOUD_STORAGE",
                raw_details={
                    "provider": provider,
                    "bucket": bucket,
                    "source_page": page_url,
                    **upload_result,
                },
            ))

    # 4. Check JavaScript files for hardcoded credentials
    findings.extend(check_js_credentials(session, page_content, page_url, timeout))

    return findings


# ---------------------------------------------------------------------------
# Mock findings
# ---------------------------------------------------------------------------

def get_mock_findings(target: str) -> List[Dict]:
    return [
        make_finding(
            vulnerability="Publicly Accessible AWS S3 Bucket with Listing Enabled",
            severity="HIGH",
            location=f"https://example-assets.s3.amazonaws.com/?list-type=2",
            evidence=(
                f"S3 bucket 'example-assets' referenced on {target} has public "
                f"listing enabled. An attacker can enumerate all objects in the bucket."
            ),
            category="CLOUD_STORAGE",
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = base_argparser("VaultScan Cloud Storage Misconfiguration Scanner")
    args = parser.parse_args()
    target = normalize_url(args.target)

    if not target:
        from scan_utils import output_error
        output_error("No target specified.")

    if is_mock_mode():
        output_findings(get_mock_findings(target))

    session = create_session(timeout=args.timeout, cookies=args.cookies, headers=args.headers)

    # Verify target is reachable
    resp, err = safe_request(session, "GET", target, timeout=args.timeout)
    if err:
        output_findings([])

    findings: List[Dict] = []

    # Crawl target to discover pages
    pages = crawl_same_domain(
        target, session,
        delay=args.delay, timeout=args.timeout,
        max_pages=5, depth=1,
    )

    # Scan each discovered page for cloud storage references
    scanned_content: Set[str] = set()
    for page_url in pages:
        page_resp, page_err = safe_request(session, "GET", page_url, timeout=args.timeout)
        if page_err or not page_resp or page_resp.status_code != 200:
            continue

        content = page_resp.text
        content_hash = str(hash(content[:2000]))
        if content_hash in scanned_content:
            continue
        scanned_content.add(content_hash)

        findings.extend(
            scan_page_for_cloud_storage(session, page_url, content, args.timeout)
        )
        time.sleep(args.delay)

    # Check common bucket names based on domain
    parsed = urlparse(target)
    domain = parsed.hostname or parsed.netloc
    if domain:
        findings.extend(check_common_bucket_names(session, domain, args.timeout))

    # Deduplicate findings by location
    seen_keys: Set[str] = set()
    unique_findings = []
    for f in findings:
        key = f"{f.get('vulnerability', '')}|{f.get('location', '')}"
        if key not in seen_keys:
            seen_keys.add(key)
            unique_findings.append(f)

    output_findings(unique_findings)


if __name__ == "__main__":
    main()
