/**
 * CIDR Expansion Utility
 * Expands CIDR notation (e.g., 192.168.1.0/24) into individual IP addresses.
 */

export function expandCidr(cidr: string): string[] {
  const parts = cidr.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid CIDR notation: ${cidr}`);
  }

  const ip = parts[0];
  const prefix = parseInt(parts[1], 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix length: ${parts[1]}`);
  }

  // Safety: only allow /24 or smaller (max 256 hosts)
  if (prefix < 24) {
    throw new Error(
      `CIDR range too large (/${prefix}). Maximum supported is /24 (256 hosts).`,
    );
  }

  const ipParts = ip.split('.').map(Number);
  if (
    ipParts.length !== 4 ||
    ipParts.some((p) => isNaN(p) || p < 0 || p > 255)
  ) {
    throw new Error(`Invalid IP address: ${ip}`);
  }

  const ipNum =
    (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const mask = ~((1 << (32 - prefix)) - 1);
  const network = ipNum & mask;
  const broadcast = network | ~mask;
  const hostCount = broadcast - network + 1;

  const ips: string[] = [];
  // Skip network address (first) and broadcast (last) for /24 and above
  const start = prefix < 31 ? network + 1 : network;
  const end = prefix < 31 ? broadcast - 1 : broadcast;

  for (let i = start; i <= end; i++) {
    const a = (i >>> 24) & 0xff;
    const b = (i >>> 16) & 0xff;
    const c = (i >>> 8) & 0xff;
    const d = i & 0xff;
    ips.push(`${a}.${b}.${c}.${d}`);
  }

  return ips;
}

export function isValidCidr(cidr: string): boolean {
  try {
    const parts = cidr.split('/');
    if (parts.length !== 2) return false;
    const prefix = parseInt(parts[1], 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
    const ipParts = parts[0].split('.').map(Number);
    if (
      ipParts.length !== 4 ||
      ipParts.some((p) => isNaN(p) || p < 0 || p > 255)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
