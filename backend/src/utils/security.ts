import ipaddr from 'ipaddr.js';
import dns from 'dns';
import http from 'http';
import https from 'https';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

/**
 * Checks if an IP address is part of a private or restricted range.
 */
export const isPrivateIP = (ip: string): boolean => {
  try {
    let addr = ipaddr.parse(ip);
    
    // Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1) to IPv4
    if (addr.kind() === 'ipv6' && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      addr = (addr as ipaddr.IPv6).toIPv4Address();
    }
    
    const range = addr.range();
    return ['private', 'loopback', 'linkLocal', 'multicast', 'unspecified'].includes(range);
  } catch (e) {
    return true; // If we can't parse it, assume it's unsafe
  }
};

/**
 * Validates a URL to prevent SSRF by checking both the literal hostname 
 * and the resolved DNS IP addresses against private/local ranges.
 */
export const validateUrlForSSRF = async (urlStr: string): Promise<boolean> => {
  try {
    const url = new URL(urlStr);
    
    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    
    const hostname = url.hostname;

    // 1. Block literal private IPs in the URL
    if (ipaddr.isValid(hostname)) {
      if (isPrivateIP(hostname)) return false;
    }

    // 2. Resolve DNS and check result IPs
    try {
      const ipv4s = await resolve4(hostname).catch(() => []);
      const ipv6s = await resolve6(hostname).catch(() => []);
      const allIps = [...ipv4s, ...ipv6s];

      for (const ip of allIps) {
        if (isPrivateIP(ip)) return false;
      }
    } catch {
      // DNS failure = treat as safe to attempt (the fetch will fail anyway)
    }

    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Phase 2: TOCTOU-safe HTTP Agent
 * Creates an http/https agent that validates the destination IP *at socket
 * connection time* — closing the DNS-rebinding race window that exists when
 * you only check DNS before the fetch.
 */
export const createSafeAgent = (protocol: 'http' | 'https') => {
  const AgentClass = protocol === 'https' ? https.Agent : http.Agent;

  return new AgentClass({
    lookup: (hostname: string, options: any, callback: any) => {
      dns.lookup(hostname, options, (err, address, family) => {
        if (err) return callback(err, address, family);
        if (isPrivateIP(address)) {
          return callback(
            new Error(`SSRF Block: Resolved IP ${address} is in a private/reserved range`),
            address,
            family
          );
        }
        callback(null, address, family);
      });
    },
  } as any);
};
