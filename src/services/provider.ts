import { ethers } from 'ethers';

/**
 * A JsonRpcProvider that does not resolve ENS names.
 * This is useful for local testing or on networks where ENS is not deployed
 * to avoid errors and unnecessary network requests.
 */
class UncheckedJsonRpcProvider extends ethers.JsonRpcProvider {
  /**
   * Prevents ENS name resolution by always returning null for the resolver.
   */
  getResolver(): Promise<ethers.EnsResolver | null> {
    return Promise.resolve(null);
  }
}

/**
 * Returns a configured ethers.js provider that bypasses ENS resolution.
 * @param url - The RPC URL to connect to.
 * @returns An instance of UncheckedJsonRpcProvider.
 */
export function getProvider(url: string): ethers.JsonRpcProvider {
  return new UncheckedJsonRpcProvider(url);
}