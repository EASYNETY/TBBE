"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = getProvider;
const ethers_1 = require("ethers");
/**
 * A JsonRpcProvider that does not resolve ENS names.
 * This is useful for local testing or on networks where ENS is not deployed
 * to avoid errors and unnecessary network requests.
 */
class UncheckedJsonRpcProvider extends ethers_1.ethers.JsonRpcProvider {
    /**
     * Prevents ENS name resolution by always returning null for the resolver.
     */
    getResolver() {
        return Promise.resolve(null);
    }
}
/**
 * Returns a configured ethers.js provider that bypasses ENS resolution.
 * @param url - The RPC URL to connect to.
 * @returns An instance of UncheckedJsonRpcProvider.
 */
function getProvider(url) {
    return new UncheckedJsonRpcProvider(url);
}
//# sourceMappingURL=provider.js.map